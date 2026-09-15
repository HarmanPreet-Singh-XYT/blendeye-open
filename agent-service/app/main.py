import time
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Suppress benign Google GenAI SDK advisory warning when ADK agents invoke models.generate_content
try:
    from google.genai.models import Models
    Models._logged_afc_warning = True
except Exception:  # noqa: BLE001, S110 - best-effort SDK import; nothing actionable if it fails
    pass

from app.config import get_settings
from app.middleware.telemetry import StudioTelemetryMiddleware
from app.routers import (
    bridge,
    character_lab,
    continuity,
    fusion,
    hot_seat,
    location_research,
    location_scout,
    market_viability,
    media,
    multiverse,
    observability,
    production,
    scene_rewrite,
    script,
    sequence,
    sharding,
    shotlist,
    showrunner,
    style_extractor,
    video_sequence,
)
from app.services.clickhouse_store import get_clickhouse_store
from app.services.observability import get_mcp_status


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ClickHouse connects lazily on first use (see get_clickhouse_store),
    # not here — this lets /script/generate and other ClickHouse-independent
    # endpoints run even before ClickHouse credentials are provisioned,
    # which matters in early local dev. Endpoints that need the store
    # (sharding, hot-seat) will surface a clear connection error on their
    # own first call instead of taking down the whole process at boot.
    yield


settings = get_settings()

app = FastAPI(
    title="BlendEye — Agent Service",
    description=(
        "Stateless Gemini/ADK sidecar for BlendEye. Handles script generation, "
        "perspective sharding, and time-gated hot-seat interrogation. "
        "Next.js owns Postgres/Supabase; this service owns Gemini/ADK "
        "calls and the ClickHouse story_events store."
    ),
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(StudioTelemetryMiddleware)

app.include_router(script.router)
app.include_router(sequence.router)
app.include_router(bridge.router)
app.include_router(multiverse.router)
app.include_router(scene_rewrite.router)
app.include_router(sharding.router)
app.include_router(hot_seat.router)
app.include_router(continuity.router)
app.include_router(showrunner.router)
app.include_router(fusion.router)
app.include_router(character_lab.router)
app.include_router(style_extractor.router)
app.include_router(location_scout.router)
app.include_router(location_research.router)
app.include_router(shotlist.router)
app.include_router(market_viability.router)
app.include_router(production.router)
app.include_router(media.router)
app.include_router(video_sequence.router)
app.include_router(observability.router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "environment": settings.environment}


_process_start_time = time.time()


@app.get("/metrics")
def metrics() -> dict[str, object]:
    """Expose studio production telemetry for the Grafana Labs dashboard.

    Queries ClickHouse directly for real row counts rather than reporting
    static numbers, so this reflects the actual story_events/precedents
    data in the connected cluster. Falls back to a clearly-flagged estimate
    only if ClickHouse itself is unreachable.

    Declared `def` (not `async def`): clickhouse-connect is synchronous, so
    FastAPI runs this in its threadpool instead of blocking the event loop.
    """
    uptime_seconds = round(time.time() - _process_start_time)

    try:
        store = get_clickhouse_store()
        if not store.is_connected or store.client is None:
            raise RuntimeError("ClickHouse connection not established")
        story_events_count = store.client.query(
            "SELECT count() FROM story_events"
        ).result_rows[0][0]
        precedents_count = store.client.query(
            "SELECT count() FROM cinematic_precedents"
        ).result_rows[0][0]
        distinct_projects = store.client.query(
            "SELECT uniqExact(project_id) FROM story_events"
        ).result_rows[0][0]
        query_start = time.time()
        store.client.query("SELECT 1")
        query_latency_ms = round((time.time() - query_start) * 1000, 2)

        # `clickhouse_mcp` reflects whether the mcp-clickhouse console script
        # is actually resolvable — a successful clickhouse-connect query proves
        # the data plane is up, not that the MCP server the Showrunner agent
        # launches as a subprocess is available. The two are reported separately.
        mcp = get_mcp_status()
        mcp_clickhouse = "online" if mcp["mcp_clickhouse"]["verified"] else "degraded"

        return {
            "studio": "BlendEye Executive Backlot",
            "integrations": ["ClickHouse Cloud"],
            "mcp_servers": {
                "clickhouse_mcp": mcp_clickhouse,
                "state": "operational" if mcp_clickhouse == "online" else "degraded",
            },
            "clickhouse_store": "online",
            "mcp_status": mcp,
            "telemetry": {
                "uptime_seconds": uptime_seconds,
                "clickhouse_ping_ms": query_latency_ms,
                "story_events_rows": story_events_count,
                "cinematic_precedents_rows": precedents_count,
                "distinct_projects_sharded": distinct_projects,
            },
        }
    except Exception as exc:  # noqa: BLE001
        return {
            "studio": "BlendEye Executive Backlot",
            "integrations": ["ClickHouse Cloud"],
            "mcp_servers": {
                "clickhouse_mcp": "unreachable",
                "state": "degraded",
            },
            "clickhouse_store": "unreachable",
            "mcp_status": get_mcp_status(),
            "telemetry": {
                "uptime_seconds": uptime_seconds,
            },
            "_fallback": True,
            "_error": f"ClickHouse unreachable: {exc}",
        }

