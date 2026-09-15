"""Observability Router — Exposes Prometheus metrics and Grafana telemetry for BlendEye.
Enables real-time studio pipeline monitoring and Grafana Cloud dashboard integration.
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

from fastapi import APIRouter, Response

from app.services.clickhouse_store import get_clickhouse_store
from app.services.observability import (
    CLICKHOUSE_QUERY_LATENCY_MS,
    HTTP_REQUESTS_TOTAL,
    STORY_EVENTS_GAUGE,
    get_agentic_requests_summary,
    get_mcp_status,
    get_prometheus_metrics,
    get_studio_health_status,
    measure_network_latencies,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/observability", tags=["observability"])


@router.get("/metrics")
async def prometheus_metrics() -> Response:
    """Returns standard Prometheus exposition text format for Grafana Cloud scrapers."""
    data, content_type = get_prometheus_metrics()
    return Response(content=data, media_type=content_type)


def _collect_overview() -> dict[str, Any]:
    """Synchronous collection body. Every dependency here (clickhouse-connect,
    httpx) is blocking, so the route below runs this in a worker thread rather
    than on the event loop.
    """
    ch_latency = None
    events_count = 0
    precedents_count = 0

    try:
        store = get_clickhouse_store()
        if store.is_connected and store.client is not None:
            t0 = time.time()
            store.client.query("SELECT 1")
            ch_latency = round((time.time() - t0) * 1000, 2)
            CLICKHOUSE_QUERY_LATENCY_MS.observe(ch_latency)

            events_count = store.client.query("SELECT count() FROM story_events").result_rows[0][0]
            precedents_count = store.client.query("SELECT count() FROM cinematic_precedents").result_rows[0][0]
            STORY_EVENTS_GAUGE.set(events_count)
    except Exception as e:  # noqa: BLE001
        # ClickHouse telemetry is best-effort: the overview still renders with
        # null/zero values so the dashboard degrades instead of 500ing.
        logger.warning("ClickHouse telemetry unavailable for /observability/overview: %s", e)

    health = get_studio_health_status()
    agentic_summary = get_agentic_requests_summary()
    mcp_status = get_mcp_status()

    return {
        "studio": "BlendEye Executive Studio Backlot",
        "observability_provider": "Grafana Labs (mcp-grafana & Prometheus)",
        "telemetry": {
            "clickhouse_latency_ms": ch_latency,
            "clickhouse_events_sharded": events_count,
            "cinematic_precedents_rows": precedents_count,
            "pipeline_state": health["pipeline"],
        },
        "agentic_request_distribution": agentic_summary,
        "promql_targets": [
            {
                "metric": "rate(blendeye_http_requests_total[5m])",
                "label": "Studio Request Throughput",
            },
            {
                "metric": "histogram_quantile(0.95, sum(rate(blendeye_clickhouse_query_latency_ms_bucket[5m])) by (le))",
                "label": "ClickHouse Time-Gate p95 Latency",
                "value": f"{ch_latency} ms",
            },
            {
                "metric": "sum(blendeye_agentic_requests_total) by (agentic_use, status_code)",
                "label": "Agentic Requests by Role & Status Code",
                "value": f"{agentic_summary['total_requests']} calls ({agentic_summary['success_rate_percent']}% 2xx)",
            },
            {
                "metric": "blendeye_story_events_total",
                "label": "Total Active Story Events",
                "value": str(events_count),
            },
        ],
        "network_latencies": health.get("network_latencies", []),
        "mcp_status": mcp_status,
    }


@router.get("/overview")
async def studio_observability_overview() -> dict[str, Any]:
    """Provides a unified observability snapshot for the studio's Grafana telemetry inspector."""
    HTTP_REQUESTS_TOTAL.labels(method="GET", endpoint="/observability/overview", status="200").inc()
    return await asyncio.to_thread(_collect_overview)


def _run_benchmark() -> dict[str, Any]:
    """Synchronous benchmark body — see _collect_overview."""
    t_start = time.perf_counter()

    # 1. Real ClickHouse queries (5 executions)
    ch_latencies: list[float] = []
    store = get_clickhouse_store()
    if store.is_connected and store.client is not None:
        for _ in range(5):
            t0 = time.perf_counter()
            try:
                store.client.query("SELECT 1")
                elapsed_ms = round((time.perf_counter() - t0) * 1000, 2)
                ch_latencies.append(elapsed_ms)
                CLICKHOUSE_QUERY_LATENCY_MS.observe(elapsed_ms)
            except Exception as e:  # noqa: BLE001
                logger.warning("ClickHouse benchmark probe failed: %s", e)

    if ch_latencies:
        avg_ch = round(sum(ch_latencies) / len(ch_latencies), 2)
        sorted_lat = sorted(ch_latencies)
        p95_ch = sorted_lat[int(len(sorted_lat) * 0.95)] if len(sorted_lat) > 1 else sorted_lat[0]
        ch_status = "PASSED (< 4.0ms target)" if avg_ch < 4.0 else "DEGRADED (> 4.0ms target)"
    else:
        avg_ch = None
        p95_ch = None
        ch_status = "DISCONNECTED (ClickHouse store offline)"

    # 2. Real network latency probes
    network_latencies = measure_network_latencies()

    # 3. Overall benchmark duration
    bench_duration_ms = round((time.perf_counter() - t_start) * 1000, 2)

    return {
        "status": "success",
        "benchmark_duration_ms": bench_duration_ms,
        "clickhouse": {
            "queries_executed": len(ch_latencies),
            "avg_latency_ms": avg_ch,
            "p95_latency_ms": p95_ch,
            "slo_status": ch_status,
        },
        "network_latencies": network_latencies,
        "grafana_cloud_status": "telemetry_emitted",
    }


@router.post("/benchmark")
async def run_studio_benchmark() -> dict[str, Any]:
    """Runs a real live telemetry benchmark across ClickHouse and external network dependencies."""
    return await asyncio.to_thread(_run_benchmark)

