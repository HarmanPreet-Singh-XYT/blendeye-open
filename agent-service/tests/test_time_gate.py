"""Regression tests for the time-gate mechanic — the product's centerpiece
(see idea.md Section 1, plan.md Layer 2) and, until now, the least-tested
code in the service.

These exercise the in-memory fallback path of ClickHouseStore by bypassing
`__init__`, so they run with no ClickHouse connection and no credentials.
"""

from app.routers.hot_seat import _format_query_sql, question_touches_firewall
from app.services.clickhouse_store import ClickHouseStore, StoryEvent


def _memory_store(events: list[StoryEvent]) -> ClickHouseStore:
    """A ClickHouseStore wired to the memory fallback, without touching the network."""
    store = ClickHouseStore.__new__(ClickHouseStore)
    store._client = None
    store._memory_events = list(events)
    return store


def _event(project, character, timestamp, event_type, content):
    return StoryEvent(
        project_id=project,
        character_name=character,
        event_timestamp=timestamp,
        event_type=event_type,
        content=content,
    )


SAMPLE = [
    _event("p1", "Elena", "00:05:00", "known_fact", "Elena saw the vault code"),
    _event("p1", "Elena", "00:10:00", "known_fact", "Elena learned Marcus lied"),
    _event("p1", "Elena", "00:20:00", "unaware_of", "Marcus moved the money"),
    _event("p1", "Elena", "00:25:00", "location", "Elena is in the sub-basement"),
    _event("p1", "Marcus", "00:05:00", "known_fact", "Marcus hid the money"),
    _event("p2", "Elena", "00:05:00", "known_fact", "different project entirely"),
]


def test_knowledge_state_is_bounded_by_timestamp():
    """The exact `WHERE event_timestamp <= T` boundary the whole product rests on."""
    store = _memory_store(SAMPLE)

    at_10 = store.knowledge_state("p1", "Elena", "00:10:00")
    assert at_10["known_facts"] == ["Elena saw the vault code", "Elena learned Marcus lied"]
    assert at_10["unaware_of"] == []

    # Scrubbing forward past 00:20 must surface the firewall row.
    at_25 = store.knowledge_state("p1", "Elena", "00:25:00")
    assert at_25["known_facts"] == [
        "Elena saw the vault code",
        "Elena learned Marcus lied",
    ]
    assert at_25["unaware_of"] == ["Marcus moved the money"]


def test_knowledge_state_scopes_to_character_and_project():
    store = _memory_store(SAMPLE)

    marcus = store.knowledge_state("p1", "Marcus", "00:30:00")
    assert marcus["known_facts"] == ["Marcus hid the money"]
    assert marcus["unaware_of"] == []

    # Elena has rows in p2 as well; a p1 query must not leak them.
    other = store.knowledge_state("p2", "Elena", "00:30:00")
    assert other["known_facts"] == ["different project entirely"]


def test_knowledge_state_before_story_start_is_empty():
    store = _memory_store(SAMPLE)
    state = store.knowledge_state("p1", "Elena", "00:00:00")
    assert state == {"known_facts": [], "unaware_of": []}


def test_clear_project_events_only_removes_that_project():
    store = _memory_store(SAMPLE)
    store.clear_project_events("p1")

    assert store.events_for_project("p1") == []
    assert len(store.events_for_project("p2")) == 1


# ---------------------------------------------------------------------------
# Firewall detection
#
# The original implementation ended with `or len(unaware_of) > 0`, which
# short-circuited the token match and made the flag True for essentially every
# character. These tests pin the corrected behaviour.
# ---------------------------------------------------------------------------

FIREWALL = ["Marcus moved the money to the offshore account"]


def test_question_about_firewall_fact_is_flagged():
    assert question_touches_firewall("Did Marcus move the money?", FIREWALL) is True


def test_unrelated_question_is_not_flagged_even_with_firewall_rows():
    """The old code returned True here purely because unaware_of was non-empty."""
    assert question_touches_firewall("What is the weather like today?", FIREWALL) is False
    assert question_touches_firewall("How are you feeling?", FIREWALL) is False


def test_no_firewall_rows_is_never_flagged():
    assert question_touches_firewall("Did Marcus move the money?", []) is False


def test_stopword_only_question_is_not_flagged():
    assert question_touches_firewall("What about that?", FIREWALL) is False


def test_firewall_detection_does_not_depend_on_unaware_count():
    """Explicit guard against the regression: a populated firewall plus an
    unrelated question must stay False."""
    many = [f"unrelated firewall fact number {i} about shipments" for i in range(1, 6)]
    assert question_touches_firewall("Who is driving the car?", many) is False


# ---------------------------------------------------------------------------
# Display SQL escaping
# ---------------------------------------------------------------------------


def test_query_sql_escapes_single_quotes():
    sql = _format_query_sql("proj'1", "Elena", "00:10:00")
    assert "'proj''1'" in sql
    # The unescaped form must not appear as a closed literal.
    assert "= 'proj'1'" not in sql


def test_query_sql_matches_documented_time_gate_shape():
    sql = _format_query_sql("p1", "Elena", "00:34:00")
    assert "FROM story_events" in sql
    assert "character_name = 'Elena'" in sql
    assert "event_timestamp <= '00:34:00'" in sql
