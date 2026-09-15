import re

from fastapi import APIRouter
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

from app.agents.hot_seat import CharacterTimelineState, build_hot_seat_agent
from app.agents.runner import run_agent_once
from app.services.clickhouse_store import get_clickhouse_store

router = APIRouter(prefix="/hot-seat", tags=["hot-seat"])


class HotSeatTurnIn(BaseModel):
    role: str  # "interviewer" | "character"
    content: str


class HotSeatAskRequest(BaseModel):
    project_id: str
    character_name: str
    current_timestamp: str  # HH:MM:SS
    question: str
    physical_location: str = ""
    active_objective: str = ""
    speech_style: str = "naturalistic"
    subtext_ratio: str = "moderate"
    # Prior turns in this conversation — passed back in on every request
    # since each hot-seat call is a fresh, stateless agent (see
    # agents/hot_seat.py). The frontend owns transcript state.
    prior_turns: list[HotSeatTurnIn] = Field(default_factory=list)


class KnowledgeFactOut(BaseModel):
    content: str
    type: str  # "known_fact" | "unaware_of"


class KnowledgeStateResponse(BaseModel):
    character_name: str
    current_timestamp: str
    known_facts: list[KnowledgeFactOut]
    query_sql: str


class HotSeatAskResponse(BaseModel):
    answer: str
    known_facts: list[KnowledgeFactOut]
    is_within_firewall: bool = False
    query_sql: str = ""


def _sql_literal(value: str) -> str:
    """Renders a Python string as a single-quoted SQL literal for *display*
    purposes only. The real time-gate query always uses bound parameters
    (see clickhouse_store.knowledge_state) — this exists because the SQL is
    echoed to the UI's ClickHouse inspector, and an unescaped project or
    character name containing a quote would render as broken/injectable SQL.
    """
    escaped = value.replace("\\", "\\\\").replace("'", "''")
    return f"'{escaped}'"


def _format_query_sql(project_id: str, character_name: str, at_timestamp: str) -> str:
    return (
        f"SELECT event_type, content FROM story_events\n"
        f"WHERE project_id = {_sql_literal(project_id)}\n"
        f"  AND character_name = {_sql_literal(character_name)}\n"
        f"  AND event_timestamp <= {_sql_literal(at_timestamp)}\n"
        f"ORDER BY event_timestamp;"
    )


# Common question words that carry no topical signal. Without filtering these,
# any two English sentences overlap on "what/where/would/about/...", which is
# exactly how the old firewall check degenerated into a constant `True`.
_STOPWORDS = frozenset({
    "about", "above", "after", "again", "against", "almost", "along", "already",
    "also", "although", "always", "among", "another", "answer", "anyone",
    "anything", "around", "back", "because", "become", "been", "before",
    "behind", "being", "below", "beside", "between", "beyond", "both", "cannot",
    "could", "does", "doing", "done", "down", "during", "each", "either",
    "else", "even", "ever", "every", "everything", "except", "feel", "felt",
    "find", "first", "from", "give", "goes", "going", "gone", "good", "have",
    "having", "heard", "here", "hers", "herself", "himself", "however", "into",
    "itself", "just", "keep", "know", "known", "last", "later", "least",
    "less", "like", "little", "many", "maybe", "mean", "might", "more",
    "most", "much", "must", "myself", "near", "need", "never", "next", "none",
    "nothing", "often", "once", "only", "other", "others", "ought", "over",
    "perhaps", "please", "quite", "rather", "really", "right", "said", "same",
    "says", "seem", "seen", "several", "shall", "should", "since", "some",
    "someone", "something", "still", "such", "sure", "take", "tell", "than",
    "thank", "that", "their", "theirs", "them", "themselves", "then", "there",
    "these", "they", "thing", "think", "this", "those", "though", "through",
    "thus", "time", "together", "told", "toward", "under", "until", "upon",
    "used", "very", "want", "well", "were", "what", "whatever", "when",
    "whenever", "where", "whereas", "which", "while", "whom", "whose", "will",
    "with", "within", "without", "would", "yeah", "your", "yours", "yourself",
})


def _significant_tokens(text: str) -> set[str]:
    """Lowercased topical tokens (length >= 4, stopwords removed)."""
    return {
        token
        for token in re.findall(r"[a-z0-9]+", text.lower())
        if len(token) >= 4 and token not in _STOPWORDS
    }


def question_touches_firewall(question: str, unaware_of: list[str]) -> bool:
    """True only when the interviewer's question actually references something
    in this character's information firewall.

    The previous implementation ended with `or len(unaware_of) > 0`, which
    short-circuited the whole token match: the flag was `True` for essentially
    every sharded character (they almost always have at least one
    unaware_of row), so it conveyed nothing. This requires genuine overlap.
    """
    if not unaware_of:
        return False

    question_tokens = _significant_tokens(question)
    if not question_tokens:
        return False

    firewall_tokens: set[str] = set()
    for fact in unaware_of:
        firewall_tokens |= _significant_tokens(fact)

    return bool(question_tokens & firewall_tokens)


def _knowledge_facts_out(knowledge: dict[str, list[str]]) -> list[KnowledgeFactOut]:
    return [
        KnowledgeFactOut(content=f, type="known_fact") for f in knowledge["known_facts"]
    ] + [KnowledgeFactOut(content=f, type="unaware_of") for f in knowledge["unaware_of"]]


@router.get("/knowledge", response_model=KnowledgeStateResponse)
def get_knowledge_state(
    project_id: str,
    character_name: str,
    current_timestamp: str,
) -> KnowledgeStateResponse:
    """Instant ClickHouse time-gate query: fetches known_facts and unaware_of
    firewall for a character at or before current_timestamp.
    Fires on timeline scrubber movement without calling an LLM.

    Declared `def` (not `async def`) on purpose: clickhouse-connect is a
    synchronous driver, so running this in FastAPI's threadpool keeps the
    event loop free instead of blocking every other in-flight request.
    """
    store = get_clickhouse_store()
    knowledge = store.knowledge_state(
        project_id=project_id,
        character_name=character_name,
        at_timestamp=current_timestamp,
    )

    return KnowledgeStateResponse(
        character_name=character_name,
        current_timestamp=current_timestamp,
        known_facts=_knowledge_facts_out(knowledge),
        query_sql=_format_query_sql(project_id, character_name, current_timestamp),
    )


@router.post("/ask", response_model=HotSeatAskResponse)
async def ask_hot_seat(body: HotSeatAskRequest) -> HotSeatAskResponse:
    store = get_clickhouse_store()
    # clickhouse-connect is synchronous — keep it off the event loop.
    knowledge = await run_in_threadpool(
        store.knowledge_state,
        body.project_id,
        body.character_name,
        body.current_timestamp,
    )

    state = CharacterTimelineState(
        character_name=body.character_name,
        current_timestamp=body.current_timestamp,
        physical_location=body.physical_location,
        active_objective=body.active_objective,
        known_facts=knowledge["known_facts"],
        unaware_of=knowledge["unaware_of"],
    )

    agent = build_hot_seat_agent(
        state, speech_style=body.speech_style, subtext_ratio=body.subtext_ratio
    )

    transcript = "\n".join(
        f"{'INTERVIEWER' if t.role == 'interviewer' else body.character_name.upper()}: {t.content}"
        for t in body.prior_turns
    )
    prompt = f"{transcript}\nINTERVIEWER: {body.question}" if transcript else body.question

    answer = await run_agent_once(agent, prompt, app_name="hot-seat")

    return HotSeatAskResponse(
        answer=answer,
        known_facts=_knowledge_facts_out(knowledge),
        is_within_firewall=question_touches_firewall(body.question, knowledge["unaware_of"]),
        query_sql=_format_query_sql(body.project_id, body.character_name, body.current_timestamp),
    )
