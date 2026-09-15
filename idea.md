# Agentic Cinema — Product Spec

> Full original vision preserved in `idea-full-vision.md`. This document is the scoped-down
> product actually being built.

---

## 1. The Core Idea

A writers'-room tool where you build a screenplay on an interactive node graph, and can
**scrub a timeline to any minute of the story and interrogate any character live** — the
character only knows what they'd know at that exact moment. Ask them about something that
happens later in the script and they genuinely don't know it, react with suspicion, or guess
wrong, exactly the way a real character would.

This is the single feature the whole product exists to deliver convincingly. Everything else
is in service of making that moment land.

```
 [Inspiration / Scene Input]
            |
            v
   [Master Script Generator]  (Gemini + ADK)
            |
            v
  [Character Perspective Sharder]
   - per-character timeline of location, knowledge, off-screen action
   - writes timestamped events into ClickHouse (story_events table)
            |
            v
  [Timeline Scrubber] --scrubs to timestamp T--> [Hot-Seat Chat]
                                                        |
                                    ClickHouse query: events WHERE
                                    character = X AND timestamp <= T
                                                        |
                                                        v
                                    Gemini agent answers strictly
                                    within that knowledge boundary
                                                        |
                                    (optional) live ClickHouse query
                                    against public box-office/territory
                                    dataset for grounding detail
```

---

## 2. AI / Platform Constraints

- **Runtime AI is Google Cloud only**: Gemini models via Google Cloud Agent Builder / ADK,
  Imagen 3, Gemini TTS. No Anthropic/OpenAI/AWS/Microsoft AI in the shipped product's runtime
  logic. (Claude Code is fine as a dev tool — this restricts what ships, not how it's built.)
- **ClickHouse is the only external data plane.** The `mcp-clickhouse` server must be actually
  imported and called at runtime, not just named in the README.
- **Public repo**, open-source license file detectable at the top of the repo page.
- **Web platform**, hosted URL.

---

## 3. Data Layer

| Store | Owns | Why |
| --- | --- | --- |
| **Supabase (Postgres)** | Projects, users, node graph structure (nodes/edges), generated script text, UI/session state | Relational + jsonb hybrid, fast to iterate schema, auth/realtime included |
| **ClickHouse** | `story_events` (character, timestamp, fact, location, off-screen action) — the actual time-gate query target; secondary grounding dataset (box office / territory) | Genuinely the right tool for fast filtered scans over many timestamped rows — the query pattern behind the time-gate mechanic |

ClickHouse is not replacing Supabase — it's the backing store specifically for the
timeline/knowledge-state mechanic, where its query pattern (`WHERE timestamp <= X`) is the
actual mechanism powering the demo's centerpiece feature.

**Backend split**: Next.js owns all Postgres/Supabase writes and serves the frontend + API
routes. A Python service (ADK agents) handles Gemini/ADK generation and the ClickHouse MCP
calls, invoked from Next.js as a stateless sidecar.

---

## 4. Feature Scope (this build)

### Must-have (core loop, no external deps except ClickHouse plumbing)
1. **Node graph canvas** (React Flow) — inspiration/scene input → master script node.
2. **Master script generation** — Gemini/ADK agent generates a scene from user input.
3. **Character Perspective Sharder** — auto-derives per-character knowledge state
   (location, known facts, unaware-of) from the master script; writes events to ClickHouse.
   Auto-derived, not hand-authored, so it scales past one demo scene.
4. **Timeline Scrubber + Time-Gated Hot-Seat Chat** — scrub to timestamp T, chat with a
   character whose context is bounded by a ClickHouse query (`timestamp <= T`). This is the
   centerpiece; gets the most build and polish time.
5. **ClickHouse Story Event Engine** — the table/query design underlying #3 and #4.

### Should-have (only after must-haves are solid)
6. **One visual payoff node** — Imagen 3 storyboard generation for the scene.
7. **ClickHouse grounding flourish** — one live query against a public box-office/territory
   dataset surfaced visibly during a hot-seat answer.

### Stretch (only if 1–7 finish early)
8. **Film Fusion / Crossover** — user picks 2+ existing films/scripts, describes how they want
   them combined; the agent matches characters across the source stories, auto-connects
   compatible scenes, and remaps roles that don't fit (e.g., a character needs a modified
   motivation/relationship to slot into the merged timeline). Reuses the same `story_events`
   ClickHouse infrastructure from #3/#5 — each source film is sharded independently, and
   "fusion" is largely a reconciliation query/pass over that same table (align timelines,
   detect character-role conflicts, remap) rather than a new subsystem. Genuinely novel and a
   strong second demo beat, but higher creative-judgment risk than the time-gate (matching
   tone/characters across two different works is fuzzy, not a clean right/wrong check) —
   explicitly a stretch goal, not a Day 1–6 commitment. See `plan.md` Layer 4b.

### Explicitly deprioritized / cut for this build
- **YouTube/video-essay ingestion** — pushed to last/optional. A filmmaker pitching original
  work is unlikely to want visible sourcing from someone else's copyrighted video in a demo,
  and it raises IP/rights questions around third-party footage. Not worth the build time or
  the risk for this scope.
- Budget/stripboard node, territory heatmap as a standalone tab, dream-casting chemistry bench,
  continuity sentry, dialogue subtext tuner, live bidirectional voice rehearsal, director's
  floor plan, cinematic precedents engine, multiverse/alternate takes. These are real ideas
  (see `idea-full-vision.md`) but don't strengthen the 3-minute demo's central moment enough to
  justify build time in 6 days.

---

## 5. Reference: Time-Gated Character Agent (ADK)

```python
from google.adk import Agent
from pydantic import BaseModel, Field

class CharacterTimelineState(BaseModel):
    character_name: str
    current_timestamp: str = Field(description="Format HH:MM:SS")
    physical_location: str
    active_objective: str
    known_facts: list[str] = Field(
        description="Events that happened prior to or at this timestamp that the character witnessed or learned"
    )
    unaware_of: list[str] = Field(
        description="Events that happened off-screen or in the future that this character does not know"
    )

def create_time_gated_interrogator(state: CharacterTimelineState, character_profile: dict) -> Agent:
    """Builds an agent instance whose context is strictly bounded by the timeline.

    known_facts / unaware_of are derived by querying ClickHouse story_events for this
    character filtered by timestamp, not hand-authored per character.
    """

    instruction = f"""
    You are strictly in-character as {state.character_name}.

    CURRENT TIME IN STORY: {state.current_timestamp}
    CURRENT LOCATION: {state.physical_location}
    CURRENT GOAL: {state.active_objective}

    WHAT YOU CURRENTLY KNOW:
    {chr(10).join('- ' + fact for fact in state.known_facts)}

    CRITICAL INFORMATION FIREWALL:
    You have ABSOLUTELY ZERO KNOWLEDGE of the following facts or any future events:
    {chr(10).join('- ' + secret for secret in state.unaware_of)}

    BEHAVIORAL RULES:
    1. If asked about something in your 'CRITICAL INFORMATION FIREWALL', react with genuine
       ignorance, suspicion, or make assumptions based on your personal flaws.
    2. Speak using the speech cadence ({character_profile.get('speech_style')}) and subtext
       level ({character_profile.get('subtext_ratio')}) of your profile.
    3. Never acknowledge that you are in a movie, script, or simulated timeline.
    """

    return Agent(
        name=f"timegated_{state.character_name.lower()}_{state.current_timestamp.replace(':', '_')}",
        model="gemini-3.7-flash",
        instruction=instruction
    )
```

---

## 6. The 3-Minute Demo Arc

1. **0:00–0:30 Ingest** — drop in a scene premise, graph forms.
2. **0:30–1:00 Generate** — master script + auto-sharded per-character timelines appear.
3. **1:00–2:15 The hook** — scrub to Minute 34, ask Character A who has the keys → wrong-but-honest
   answer grounded in what they knew then. Scrub to Minute 52, ask again → correct answer,
   different tone. ClickHouse query visibly firing as the mechanism, not hidden.
4. **2:15–2:45 One payoff** — Imagen storyboard frames snap in for the scene, or the ClickHouse
   grounding flourish fires visibly in a hot-seat answer.
5. **2:45–3:00 Close** — one sentence on Gemini/ADK/ClickHouse under the hood, end on the hook.

See `plan.md` for the day-by-day build plan and cut points.
