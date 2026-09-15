from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict, Field

from app.agents.runner import run_agent_once
from app.agents.showrunner import build_showrunner_agent
from app.services.clickhouse_store import get_clickhouse_store

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/showrunner", tags=["showrunner"])


class ShowrunnerMessage(BaseModel):
    role: str = "user"  # "user" | "showrunner" | "director"
    sender: str | None = None
    content: str


class ShowrunnerChatRequest(BaseModel):
    project_title: str = ""
    logline: str = ""
    screenplay_text: str = ""
    characters: list[dict | str | Any] = Field(default_factory=list)
    message: str
    history: list[dict | ShowrunnerMessage | Any] = Field(default_factory=list)
    scenes: list[dict | Any] = Field(default_factory=list)
    active_scene_id: str = ""


class PrecedentItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    genre: str = ""
    trope: str = ""
    historical_reference: str = ""
    tension_level: int = 5
    commercial_territory: str = ""
    audience_retention_pct: float = 80.0
    precedent_example: str = ""


class ShowrunnerChatResponse(BaseModel):
    reply: str
    suggested_actions: list[str] = Field(default_factory=list)
    clickhouse_query_sql: str = ""
    precedents_cited: list[PrecedentItem] = Field(default_factory=list)


@router.get("/precedents", response_model=list[PrecedentItem])
async def get_precedents(genre: str = "") -> list[PrecedentItem]:
    store = get_clickhouse_store()
    raw = store.get_cinematic_precedents(genre)
    precedents: list[PrecedentItem] = []
    for item in raw:
        try:
            precedents.append(PrecedentItem(**item))
        except Exception as e:  # noqa: BLE001
            logger.warning("Skipping malformed precedent row: %s", e)
    return precedents


@router.post("/chat", response_model=ShowrunnerChatResponse)
async def chat_with_showrunner(body: ShowrunnerChatRequest) -> ShowrunnerChatResponse:
    agent = build_showrunner_agent(with_mcp=True)
    store = get_clickhouse_store()

    # Query ClickHouse for cinematic precedents & box office metrics (Grounding Flourish)
    sql_executed = "SELECT genre, trope, historical_reference, tension_level, commercial_territory, audience_retention_pct, precedent_example FROM cinematic_precedents ORDER BY audience_retention_pct DESC;"
    raw_precedents = store.get_cinematic_precedents()
    precedents: list[PrecedentItem] = []
    for p in raw_precedents:
        try:
            precedents.append(PrecedentItem(**p))
        except Exception as e:  # noqa: BLE001
            logger.warning("Skipping malformed precedent row: %s", e)

    precedent_context = "\n".join(
        f"- Reference: {p.historical_reference} | Trope: {p.trope} | Tension: {p.tension_level}/10 | Retention: {p.audience_retention_pct}% ({p.commercial_territory})\n  Notes: {p.precedent_example}"
        for p in precedents[:3]
    )

    # Normalize character strings
    character_names: list[str] = []
    for c in body.characters:
        if isinstance(c, str):
            character_names.append(c)
        elif isinstance(c, dict):
            c_name = c.get("name") or "Character"
            c_role = c.get("role") or c.get("archetype")
            character_names.append(f"{c_name} ({c_role})" if c_role else c_name)
        else:
            character_names.append(str(c))

    has_project = bool(body.project_title and body.project_title != "Untitled Feature")

    scenes_summary = ""
    if body.scenes:
        scenes_summary = "MULTI-SCENE SEQUENCE REEL:\n" + "\n".join(
            f"- Scene {s.get('sceneNumber', i+1)}: \"{s.get('title', 'Scene')}\" ({s.get('slugline', '')}) | Cast: {', '.join(s.get('castPresent', [])) or 'None'} | Stakes: {s.get('summary', 'N/A')}{' [CURRENT ACTIVE SCENE]' if s.get('id') == body.active_scene_id else ''}"
            for i, s in enumerate(body.scenes)
        )

    context_header = f"""
PROJECT CONTEXT:
Title: {body.project_title if has_project else "(No project initialized yet - in ideation / brainstorming)"}
Logline: {body.logline if body.logline else "In open creative ideation"}
Characters: {", ".join(character_names) if character_names else "To be discovered in conversation"}
{scenes_summary}
{f"CLICKHOUSE GROUNDING TELEMETRY:\n{precedent_context}" if has_project and precedent_context else ""}
{f"CURRENT SCRIPT EXCERPT:\n{body.screenplay_text}" if body.screenplay_text else ""}
---
"""

    history_lines: list[str] = []
    for msg in body.history[-6:]:
        if isinstance(msg, dict):
            r = msg.get("role") or msg.get("sender") or "user"
            content = msg.get("content", "")
        else:
            r = getattr(msg, "role", None) or getattr(msg, "sender", None) or "user"
            content = getattr(msg, "content", "")
        speaker = "DIRECTOR" if str(r).lower() in ("user", "director") else "SHOWRUNNER"
        if content:
            history_lines.append(f"{speaker}: {content}")

    history_text = "\n".join(history_lines)

    instruction_reminder = """
IMPORTANT INSTRUCTIONS FOR YOUR RESPONSE:
- Understand the Director's true intent like a human collaborator (like ChatGPT).
- If the Director is greeting you, checking in, or making casual conversation, reply conversationally and warmly. Do NOT generate a screenplay scene or dump unsolicited lore!
- If the Director is brainstorming an idea, explore it with them, ask exciting creative questions, and help build the concept through dialogue.
- ONLY output a formatted screenplay scene if the Director explicitly asks you to write, draft, or script a scene.
- Speak in a natural, perceptive Hollywood showrunner voice. Never use emojis.
"""

    full_prompt = f"{context_header}\nCONVERSATION HISTORY:\n{history_text or '(Fresh conversation)'}\n\n{instruction_reminder}\n\nDIRECTOR: {body.message}\nSHOWRUNNER:"

    reply = await run_agent_once(agent, full_prompt, app_name="writers-room-showrunner")

    # Generate dynamic, context-aware suggestions
    if has_project:
        suggestions = [
            f"Explore {character_names[0].split(' ')[0]}'s hidden secret" if character_names else "Introduce a dramatic complication",
            "Raise the stakes with a ticking clock",
            "Pitch an unexpected midpoint reversal",
        ]
    else:
        suggestions = [
            "Pitch a high-stakes thriller premise",
            "Brainstorm a sci-fi mystery concept",
            "Explore character conflict dynamics",
        ]

    return ShowrunnerChatResponse(
        reply=reply,
        suggested_actions=suggestions,
        clickhouse_query_sql=sql_executed,
        precedents_cited=precedents[:3],
    )


class ExecuteDirectiveRequest(BaseModel):
    user_prompt: str
    project_title: str = ""
    logline: str = ""
    genre: str = ""
    director_style: str = ""
    screenplay_text: str = ""
    characters: list[dict] = Field(default_factory=list)
    nodes: list[dict] = Field(default_factory=list)
    edges: list[dict] = Field(default_factory=list)
    history: list[dict] = Field(default_factory=list)
    scenes: list[dict | Any] = Field(default_factory=list)
    active_scene_id: str = ""
    events: list[dict | Any] = Field(default_factory=list)


class ExecuteDirectiveResponse(BaseModel):
    # `_fallback` must be declared with an alias, not as a leading-underscore
    # field: Pydantic v2 turns those into private attributes, so the flag was
    # silently absent from the JSON and the Next.js route could never tell a
    # canned acknowledgement from real model output.
    model_config = ConfigDict(populate_by_name=True)

    thought_process: str
    assistant_message: str
    actions: list[dict] = Field(default_factory=list)
    precedents_cited: list[PrecedentItem] = Field(default_factory=list)
    clickhouse_query_sql: str = ""
    # True when the structured-output parse failed and this is the canned
    # acknowledgement rather than real model output. The Next.js route uses
    # this to fall through to its deterministic local engine instead of
    # showing the Director a fake "I have updated the slate" reply.
    fallback: bool = Field(default=False, alias="_fallback")


@router.post("/execute", response_model=ExecuteDirectiveResponse)
async def execute_showrunner_directive(body: ExecuteDirectiveRequest) -> ExecuteDirectiveResponse:
    agent = build_showrunner_agent()
    store = get_clickhouse_store()
    import json
    import re

    sql_executed = "SELECT genre, trope, historical_reference, tension_level, commercial_territory, audience_retention_pct, precedent_example FROM cinematic_precedents ORDER BY audience_retention_pct DESC LIMIT 3;"
    try:
        raw_precedents = store.get_cinematic_precedents(body.genre)
        precedents = [PrecedentItem(**p) for p in raw_precedents[:3]]
    except Exception:  # noqa: BLE001
        precedents = []

    precedent_context = "\n".join(
        f"- {p.historical_reference} | {p.trope} | Tension {p.tension_level}/10 | {p.audience_retention_pct}% retention ({p.commercial_territory})\n  Notes: {p.precedent_example}"
        for p in precedents
    ) if precedents else "- No ClickHouse precedent rows available for this genre."

    scenes_summary = ""
    if body.scenes:
        scenes_lines = []
        for i, s in enumerate(body.scenes):
            sc_num = s.get('sceneNumber', i+1)
            is_active = s.get('id') == body.active_scene_id
            script_text = (s.get('screenplayText') or "").strip()
            script_snip = (script_text[:280] + "...") if len(script_text) > 280 else (script_text or "(No script drafted)")
            script_snip = script_snip.replace('\n', ' ')
            candidates = s.get('locationCandidates') or []
            selected_id = s.get('selectedLocationCandidateId')
            locked_cand = next((c for c in candidates if c.get('candidate_id') == selected_id), None)
            if locked_cand:
                rate = locked_cand.get('estimated_cost', {}).get('day_rate', 0)
                loc_desc = f"Locked: \"{locked_cand.get('name')}\" (${rate}/day in {locked_cand.get('region', 'Base')})"
            else:
                loc_desc = f"Setting: \"{s.get('location', 'TBD')}\" (Region: {s.get('shootRegion', 'Base')}, Budget: ${s.get('locationBudget', 'Default')}, Candidates: {len(candidates)})"
            scenes_lines.append(
                f"  - Scene {sc_num}: \"{s.get('title', 'Scene')}\" ({s.get('slugline', '')}) | Location: {loc_desc} | Cast: {', '.join(s.get('castPresent', [])) or 'None'} | Stakes: {s.get('summary', 'N/A')}{' [CURRENT ACTIVE SCENE]' if is_active else ''}\n    Script snippet: \"{script_snip}\""
            )
        scenes_summary = "Sequence Reel (with locations & script excerpts):\n" + "\n".join(scenes_lines)

    events_summary = ""
    if body.events:
        events_summary = "Timeline Story Beats:\n" + "\n".join(
            f"  - Beat at {e.get('atSeconds', 0)}s: {e.get('characterName', 'Character')} ({e.get('eventType', 'known_fact')})"
            for e in body.events
        )

    history_lines = []
    for msg in body.history[-6:]:
        if isinstance(msg, dict):
            r = msg.get("role") or msg.get("sender") or "user"
            content = msg.get("content", "")
        else:
            r = getattr(msg, "role", None) or getattr(msg, "sender", None) or "user"
            content = getattr(msg, "content", "")
        speaker = "DIRECTOR" if str(r).lower() in ("user", "director") else "SHOWRUNNER"
        if content:
            history_lines.append(f"{speaker}: {content}")

    history_text = "\n".join(history_lines)

    prompt = f"""
You are the Lead Showrunner & Omniscient Studio Co-Creator collaborating with a Director on a film production slate.
You have FULL CREATIVE AND EXECUTIVE AUTHORITY over the entire film project.
You speak like a thoughtful, sharp, perceptive Hollywood writers' room co-creator (like ChatGPT in creative partner mode).

CRITICAL INTERACTION RULES:
1. Converse naturally and warmly like an experienced human collaborator.
   - If the Director is greeting you, checking in, or asking general creative questions (e.g. "hi there", "what do you think of this premise?"), reply warmly and conversationally in "assistant_message". DO NOT force empty CRUD actions or sound like a robot executor ("Directive processed").
   - If the Director is brainstorming, bounce ideas back, ask compelling story questions, and explore tension, character secrets, and narrative stakes together.
   - Only include items in "actions" if the Director explicitly asks for project changes, or if the creative direction clearly calls for specific scene additions, deletions, reordering, location changes, or character creation.
2. If actions are taken, clearly and collegially explain what you refined across the reel in "assistant_message".
3. Never use emojis. Keep the tone grounded, collegial, and cinematic.

AVAILABLE ACTIONS YOU CAN EMIT IN "actions" (ONLY WHEN THE DIRECTOR REQUESTS OR DIRECTS PROJECT MODIFICATIONS):
1. {{"type": "create_character", "name": "Name", "role": "Role", "archetype": "Archetype", "confidence": 0-100, "verbalPacing": 0-100, "subtextRatio": "high"|"low", "personalityPreset": "Preset", "objective": "Goal"}}
2. {{"type": "update_character", "name": "Name", "patch": {{"confidence": 95, "verbalPacing": 80, "speechStyle": "...", "objective": "..."}}}}
3. {{"type": "delete_character", "name": "Name"}}
4. {{"type": "replace_character", "name": "Old Name", "replacement": {{"name": "New Name", "role": "...", "archetype": "...", "confidence": 85, "verbalPacing": 70, "objective": "..."}}}}
5. {{"type": "create_node", "nodeType": "clip"|"note"|"actor"|"personality"|"quirks"|"scene"|"script"|"chemistry"|"storyboard"|"floorplan"|"tensionCurve"|"tableRead"|"market", "title": "...", "data": {{...}}}}
6. {{"type": "delete_node", "nodeId": "nodeId or name"}}
7. {{"type": "update_node_data", "nodeId": "nodeId or name", "patch": {{...}}}}
8. {{"type": "connect_nodes", "source": "nodeId or name", "target": "nodeId or name", "relationship": "Friction"|"Alliance"|"Rivalry"|"Mentor"|"Style Sync"|"Plot Seed"}}
9. {{"type": "sever_wire", "source": "nodeId or name", "target": "nodeId or name"}}
10. {{"type": "update_screenplay", "screenplayText": "...", "summary": "..."}}
11. {{"type": "update_scene_meta", "title": "...", "stakes": "..."}}
12. {{"type": "update_project_meta", "patch": {{"title": "...", "logline": "...", "genre": "...", "directorStyle": "...", "narrativeFormat": "feature"|"pilot"|"short", "targetRuntimeMinutes": 110}}}}
13. {{"type": "auto_tidy_backlot"}}
14. {{"type": "create_take_milestone", "title": "Milestone Title", "description": "..."}}
15. {{"type": "create_scene", "title": "Scene Title", "slugline": "INT/EXT. LOCATION - DAY/NIGHT", "summary": "Dramatic stakes & narrative progression", "location": "Location Name", "castPresent": ["Character 1", "Character 2"], "durationSeconds": 180, "position": "end"|"start"|number, "screenplayText": "Standard formatted screenplay text..."}}
16. {{"type": "delete_scene", "sceneIdentifier": 2 (sceneNumber) | "scene-id" | "Scene Title"}}
17. {{"type": "replace_scene", "sceneIdentifier": 2 (sceneNumber) | "scene-id" | "Scene Title", "replacement": {{"title": "...", "slugline": "...", "summary": "...", "location": "...", "durationSeconds": 180, "castPresent": ["..."], "screenplayText": "..."}}}}
18. {{"type": "reorder_scenes", "sceneOrder": [2, 1, 3] (new chronological order of scene numbers, IDs, or titles)}}
19. {{"type": "move_scene", "sceneIdentifier": 2, "targetIndex": 0, "direction": "up"|"down"}}
20. {{"type": "update_scene", "sceneIdentifier": 2, "patch": {{"title": "...", "slugline": "...", "summary": "...", "location": "...", "durationSeconds": 180, "castPresent": ["..."], "screenplayText": "..."}}}}
21. {{"type": "create_story_event", "atSeconds": 120, "characterName": "Elena", "eventType": "known_fact"|"unaware_of"|"location"|"objective"}}
22. {{"type": "delete_story_event", "identifier": 120 (atSeconds) | "Elena" | "objective"}}
23. {{"type": "replace_story_event", "identifier": 120, "replacement": {{"atSeconds": 150, "characterName": "Elena", "eventType": "objective"}}}}
24. {{"type": "lock_location", "sceneIdentifier": 2, "locationName": "Venue Name", "candidateId": "optional-id"}}
25. {{"type": "unlock_location", "sceneIdentifier": 2}}
26. {{"type": "set_scene_location", "sceneIdentifier": 2, "location": "New Location Setting", "shootRegion": "City/Region", "locationBudget": 15000}}
27. {{"type": "add_location_candidate", "sceneIdentifier": 2, "candidate": {{"name": "Venue Name", "category": "practical"|"studio"|"historic", "region": "City/State", "day_rate": 2500, "permit_fee": 400, "film_precedent": "Title", "auto_lock": True}}}}
28. {{"type": "set_location_budget", "sceneIdentifier": 2, "budget": 12000, "locationsPct": 20}}
29. {{"type": "set_shoot_region", "shootRegion": "London, UK" | "New York, NY", "sceneIdentifier": 2}}
30. {{"type": "create_score_take", "sceneIdentifier": 2, "title": "Score Cue", "prompt": "Tense cinematic strings", "durationSec": 30, "scoreType": "score"|"source"|"vocal", "audioUrl": "/audio/demo-score.wav"}}
31. {{"type": "set_master_score", "sceneIdentifier": 2, "takeNumber": 1}}
32. {{"type": "delete_score_take", "sceneIdentifier": 2, "takeNumber": 1}}
33. {{"type": "attach_asset", "assetName": "Sub-Level Concrete Vault", "targetType": "scene"|"character"|"score_moodboard", "targetIdentifier": 2|"Marcus", "role": "plate"|"face"|"body"|"moodboard"}}
34. {{"type": "create_asset_record", "name": "Asset Name", "category": "location"|"character_face"|"character_body"|"style"|"video"|"audio"|"map", "url": "/assets/...", "tags": ["tag1", "tag2"]}}
35. {{"type": "generate_timeline_moment", "sceneIdentifier": 2, "timestampSec": 45, "prompt": "Marcus confronting Elena under harsh neon rim lighting", "stylePreset": "anamorphic_35mm", "cameraFraming": "wide_master"}}
36. {{"type": "switch_view", "tab": "planning"|"simulation"|"generation"|"showrunner", "subview": "canvas"|"timeline"|"score"|"video"|"location"|"floorplan"|"assets"}}

PROJECT CONTEXT:
Title: {body.project_title or "Untitled"}
Genre: {body.genre or "Drama"}
Logline: {body.logline or "Unspecified"}
Director Style: {body.director_style or "Cinematic"}
Characters: {[c.get('name') for c in body.characters]}
{scenes_summary}
{events_summary}
Nodes: {[n.get('id') for n in body.nodes]}
Edges: {[f"{e.get('source')}->{e.get('target')}" for e in body.edges]}
Active Scene Script Excerpt: {body.screenplay_text[:1200] if body.screenplay_text else "(No script drafted yet)"}

CLICKHOUSE GROUNDING TELEMETRY (REAL CINEMATIC PRECEDENTS & RETENTION BENCHMARKS):
{precedent_context}

CONVERSATION HISTORY:
{history_text or "(Fresh session)"}

DIRECTOR: "{body.user_prompt}"

OUTPUT FORMAT:
Respond ONLY with a single, valid, raw JSON object matching:
{{
  "thought_process": "Detailed step-by-step creative reasoning on the director's true intent and how to collaborate or structure the narrative",
  "assistant_message": "Warm, perceptive, collegiate Hollywood Showrunner response",
  "actions": [ ... list of action objects, or empty [] if purely conversational ... ]
}}
"""
    raw = await run_agent_once(agent, prompt, app_name="writers-room-showrunner-exec")
    try:
        match = re.search(r"\{[\s\S]*\}", raw)
        if match:
            parsed = json.loads(match.group(0))
            return ExecuteDirectiveResponse(
                thought_process=parsed.get("thought_process", "Analyzed director intent."),
                assistant_message=parsed.get("assistant_message", "Executed directive."),
                actions=parsed.get("actions", []),
                precedents_cited=precedents,
                clickhouse_query_sql=sql_executed if precedents else "",
                fallback=False,
            )
    except Exception as e:  # noqa: BLE001
        # Not swallowed silently any more: a parse failure here means the
        # Director gets the canned acknowledgement below instead of a real
        # answer, which is worth seeing in the logs.
        logger.warning("Showrunner directive JSON parse failed, serving canned fallback: %s", e)

    return ExecuteDirectiveResponse(
        thought_process=f"Processed directive: {body.user_prompt}",
        assistant_message="I have reviewed your request and updated the production slate accordingly.",
        actions=[],
        precedents_cited=precedents,
        clickhouse_query_sql=sql_executed if precedents else "",
        fallback=True,
    )


