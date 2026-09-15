from fastapi.testclient import TestClient

from app.main import app
from app.services.observability import (
    get_agentic_requests_summary,
    map_endpoint_to_agentic,
    record_agentic_request,
)


def test_map_endpoint_to_agentic():
    # Test creative development routes
    assert map_endpoint_to_agentic("/showrunner/chat")["agentic_use"] == "showrunner_copilot"
    assert map_endpoint_to_agentic("/script/generate")["agentic_use"] == "screenplay_generator"
    assert map_endpoint_to_agentic("/multiverse/branch")["agentic_use"] == "multiverse_takes"
    assert map_endpoint_to_agentic("/continuity/check")["agentic_use"] == "continuity_supervisor"

    # Test research routes
    assert map_endpoint_to_agentic("/location/research")["agentic_use"] == "location_scouting"
    assert map_endpoint_to_agentic("/location-scout/precedents")["agentic_use"] == "location_scouting"

    # Test media routes
    assert map_endpoint_to_agentic("/video-sequence/plan")["agentic_use"] == "video_sequencer_omni"
    assert map_endpoint_to_agentic("/media/tts")["agentic_use"] == "audio_dialogue_tts"
    assert map_endpoint_to_agentic("/media/image")["agentic_use"] == "storyboard_artist_imagen"

    # Test fallback
    assert map_endpoint_to_agentic("/unknown/path")["agentic_use"] == "general_api"


def test_record_agentic_request_and_summary():
    # Record a test request
    record_agentic_request(
        endpoint="/location/research",
        method="POST",
        status_code=200,
        duration_sec=0.15,
    )

    summary = get_agentic_requests_summary()
    assert summary["total_requests"] > 0
    assert "2xx" in summary["status_classes"]
    assert summary["success_rate_percent"] > 0

    location_role = next((r for r in summary["roles"] if r["agentic_use"] == "location_scouting"), None)
    assert location_role is not None
    assert location_role["total_calls"] > 0
    assert location_role["status_codes"]["200"] > 0


def test_observability_api_endpoints():
    client = TestClient(app)

    # Pre-record an actual showrunner request to test Prometheus label export
    record_agentic_request(
        endpoint="/showrunner/chat",
        method="POST",
        status_code=200,
        duration_sec=0.25,
    )

    # 1. Test /observability/overview
    res = client.get("/observability/overview")
    assert res.status_code == 200
    data = res.json()
    assert "agentic_request_distribution" in data
    dist = data["agentic_request_distribution"]
    assert dist["total_requests"] > 0
    assert len(dist["roles"]) > 0

    # mcp_status must be derived from real checks, not asserted strings.
    mcp = data["mcp_status"]
    assert set(mcp) == {"mcp_clickhouse", "mcp_grafana"}
    for entry in mcp.values():
        assert isinstance(entry["on_path"], bool)
        assert isinstance(entry["verified"], bool)
        assert isinstance(entry["state"], str)
    # Regression guard: this field used to be a hardcoded capability brag.
    assert "60+ tools" not in res.text
    assert mcp["mcp_clickhouse"]["allow_write"] is False

    # 2. Test /observability/metrics (Prometheus exporter)
    res_metrics = client.get("/observability/metrics")
    assert res_metrics.status_code == 200
    text = res_metrics.text
    assert "blendeye_agentic_requests_total" in text
    assert 'agentic_use="showrunner_copilot"' in text

    # 3. Test /observability/benchmark
    res_bench = client.post("/observability/benchmark")
    assert res_bench.status_code == 200
    bench_data = res_bench.json()
    assert bench_data["status"] == "success"
    assert "network_latencies" in bench_data


def test_metrics_endpoint_reports_mcp_and_store_separately():
    """`/metrics` used to report clickhouse_mcp: "online" purely because a
    clickhouse-connect SELECT 1 succeeded — which says nothing about whether the
    mcp-clickhouse subprocess is available. The two are now reported as
    distinct fields.
    """
    client = TestClient(app)
    res = client.get("/metrics")
    assert res.status_code == 200
    data = res.json()

    assert data["mcp_servers"]["clickhouse_mcp"] in ("online", "degraded", "unreachable")
    assert data["clickhouse_store"] in ("online", "unreachable")
    assert set(data["mcp_status"]) == {"mcp_clickhouse", "mcp_grafana"}

    # The MCP claim must track the capability probe, never the SQL driver.
    verified = data["mcp_status"]["mcp_clickhouse"]["verified"]
    reported = data["mcp_servers"]["clickhouse_mcp"]
    if data["clickhouse_store"] == "unreachable":
        assert reported == "unreachable"
    else:
        assert reported == ("online" if verified else "degraded")
