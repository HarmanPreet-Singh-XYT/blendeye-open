import re

from fastapi import APIRouter
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

from app.agents.perspective_sharder import (
    CharacterProfile,
    PerspectiveShardResult,
    build_perspective_sharder_agent,
)
from app.agents.runner import run_agent_once
from app.services.clickhouse_store import StoryEvent, get_clickhouse_store

router = APIRouter(prefix="/sharding", tags=["sharding"])


class ShardScriptRequest(BaseModel):
    project_id: str
    screenplay_text: str


class ShardScriptResponse(BaseModel):
    scene_title: str
    scene_summary: str
    characters: list[CharacterProfile]
    events_written: int
    events: list[StoryEvent]


def _clean_json_str(raw: str) -> str:
    """Strips markdown code fences and extraneous text if present."""
    text = raw.strip()
    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
    if match:
        return match.group(1).strip()
    return text


@router.post("/shard", response_model=ShardScriptResponse)
async def shard_script(body: ShardScriptRequest) -> ShardScriptResponse:
    agent = build_perspective_sharder_agent()
    raw = await run_agent_once(agent, body.screenplay_text, app_name="perspective-sharder")
    cleaned = _clean_json_str(raw)
    parsed = PerspectiveShardResult.model_validate_json(cleaned)

    events = [
        StoryEvent(
            project_id=body.project_id,
            character_name=e.character_name,
            event_timestamp=e.event_timestamp,
            event_type=e.event_type,
            content=e.content,
        )
        for e in parsed.events
    ]

    store = get_clickhouse_store()
    # Both store calls are synchronous clickhouse-connect round-trips; run the
    # clear+insert pair in one threadpool hop so a re-shard can't block the
    # event loop for the duration of a ClickHouse mutation.
    await run_in_threadpool(_replace_project_events, store, body.project_id, events)

    return ShardScriptResponse(
        scene_title=parsed.scene_title,
        scene_summary=parsed.scene_summary,
        characters=parsed.characters,
        events_written=len(events),
        events=events,
    )


def _replace_project_events(store, project_id: str, events: list[StoryEvent]) -> None:
    store.clear_project_events(project_id)
    store.insert_events(events)


@router.get("/events/{project_id}", response_model=list[StoryEvent])
def get_project_events(project_id: str) -> list[StoryEvent]:
    """Declared `def` (not `async def`) because clickhouse-connect is a
    synchronous driver — FastAPI runs sync handlers in its threadpool, which
    keeps the ClickHouse round-trip off the event loop.
    """
    store = get_clickhouse_store()
    return store.events_for_project(project_id)
