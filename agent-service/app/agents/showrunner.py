"""Central Showrunner / Writers' Room Co-Pilot Agent.
Unlike the in-character Hot Seat agent, the Showrunner is omniscient.
It has full knowledge of the script, characters, themes, and narrative arc,
and acts as a senior Hollywood screenwriting collaborator and script doctor.
"""

from __future__ import annotations

import logging

from google.adk import Agent

from app.config import get_settings

logger = logging.getLogger(__name__)

INSTRUCTION = """
You are an elite Hollywood Showrunner and veteran screenwriting co-creator collaborating with a Director.
You understand story structure, human psychology, subtext, tension, and cinematic craft at the highest level.

HOW TO INTERACT (BE HUMAN & CONVERSATIONAL):
1. Listen and converse naturally: Talk with the Director like an experienced, thoughtful human partner in a writers' room—just like ChatGPT or a real creative collaborator.
2. Match their intent:
   - If they say "hey", "hows it going", or check in: Respond warmly, collegially, and ask what kind of story or world they want to explore today. Keep it conversational and concise. Do NOT dump unsolicited scripts or force ideas.
   - If they pitch an idea or premise: React to the core dramatic concept. Ask probing, exciting creative questions about character motives, secrets, stakes, or moral dilemmas. Help them brainstorm and shape the story together.
   - If they ask for feedback or script doctoring: Offer sharp, insightful notes on pacing, character agency, and dramatic subtext.
   - If they explicitly ask to draft or write a scene: Format it cleanly in standard screenplay format.
3. Don't rush to execute: Have the conversation first. Understand what the Director really envisions. When you both arrive at a great concept, you can suggest locking it into a production slate.
4. Tone: Collaborative, perceptive, articulate, confident, and direct.
5. Strict rule: Do NOT use emojis.
"""


async def parallel_web_search(query: str) -> str:
    """Search the live web via Parallel Web Systems (parallel.ai) for film precedents,
    industry box office comps, real-world locations, or script research.
    """
    from app.services.parallel_search import search_parallel
    from app.services.prompt_sanitizer import sanitize_untrusted_context

    results = await search_parallel(query, num_results=3)
    if not results:
        return "No web results found via Parallel Web Systems."
    formatted = []
    for r in results:
        # Tool results are open-web text and therefore untrusted input to the
        # model — strip instruction-like content before it re-enters context.
        summary = sanitize_untrusted_context(" ".join(r.get("excerpts", [])), max_chars=300)
        formatted.append(f"Title: {r['title']}\nURL: {r['url']}\nSummary: {summary}")
    return "\n---\n".join(formatted)


def query_studio_telemetry(aspect: str = "all") -> str:
    """Query live BlendEye studio infrastructure telemetry and Grafana/Prometheus health.
    Use this whenever the Director asks about system performance, rendering pipeline status,
    ClickHouse latency, or studio observability.
    """
    from app.services.observability import get_studio_health_status

    status = get_studio_health_status()
    pipeline = status.get("pipeline", {})
    network = status.get("network_latencies", [])
    network_lines = "\n".join(
        f"- {n['service']}: {n['status']}" + (f" ({n['latency_ms']}ms)" if n.get("latency_ms") is not None else "")
        for n in network
    )

    return (
        f"BlendEye Studio Telemetry & Observability Status:\n"
        f"Status: {status.get('status', 'unknown').upper()}\n"
        f"Engine: {status.get('observability_engine', 'Grafana Labs OpenTelemetry Stack')}\n\n"
        f"Pipeline Health:\n"
        f"- Omni Flash Video Sequencer: {pipeline.get('omni_video_sequencer')}\n"
        f"- ClickHouse Time-Gate: {pipeline.get('clickhouse_timegate')}\n"
        f"- Gemini Agents: {pipeline.get('gemini_agents')}\n"
        f"- Parallel Web Search: {pipeline.get('parallel_web_search')}\n"
        f"- Audio Multi-Speaker TTS: {pipeline.get('audio_multi_speaker')}\n"
        f"- Script Continuity Supervisor: {pipeline.get('continuity_supervisor')}\n\n"
        f"Live Network Round-Trip Checks:\n{network_lines}\n\n"
        f"Live Prometheus Scrape Endpoint: /observability/metrics\n"
        f"Live Grafana Cloud Dashboard: https://fearlessimpatiens433.grafana.net/d/blendeye-studio-observability/0c416a4"
    )


def build_showrunner_agent(*, with_mcp: bool = True) -> Agent:
    settings = get_settings()
    tools = [parallel_web_search, query_studio_telemetry]
    if with_mcp:
        # An MCP toolset that fails to construct is skipped rather than failing
        # the whole agent — but it is logged, because silently running the
        # Showrunner without its ClickHouse/Grafana tools looks identical to a
        # working setup from the outside.
        try:
            from app.services.clickhouse_mcp import build_clickhouse_toolset
            tools.append(build_clickhouse_toolset())
        except Exception as e:  # noqa: BLE001
            logger.warning("ClickHouse MCP toolset unavailable; Showrunner runs without it: %s", e)
        try:
            from app.services.grafana_mcp import build_grafana_toolset
            tools.append(build_grafana_toolset())
        except Exception as e:  # noqa: BLE001
            logger.warning("Grafana MCP toolset unavailable; Showrunner runs without it: %s", e)

    return Agent(
        name="writers_room_showrunner",
        model=settings.gemini_model,
        instruction=INSTRUCTION,
        tools=tools,
    )

