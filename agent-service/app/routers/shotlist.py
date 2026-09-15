from __future__ import annotations

import json
import logging

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.agents.runner import run_agent_once
from app.agents.shotlist_generator import build_shotlist_agent

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/shotlist", tags=["shotlist"])


class ContinuityBible(BaseModel):
    character_appearance: str = ""
    wardrobe: str = ""
    location: str = ""
    lighting: str = ""
    time_of_day: str = ""
    blocking_start: str = ""
    blocking_end: str = ""


class ShotItem(BaseModel):
    shot_number: int
    shot_type: str
    lens: str
    angle: str
    camera_movement: str
    blocking_notes: str
    lighting_setup: str
    dramatic_intent: str
    imagen_prompt: str
    estimated_duration_sec: int = 6
    continuity_bible: ContinuityBible = Field(default_factory=ContinuityBible)
    # What this shot's video generation should be image-conditioned on.
    # "character_ref" | "location_ref" | "previous_frame" | "none"
    conditioning_source: str = "previous_frame"
    conditioning_ref: str = ""  # character name when conditioning_source == "character_ref"


class CharacterDetail(BaseModel):
    """Everything the director agent needs about a cast member present in
    this specific scene — not just their name, but what reference imagery
    already exists (so the agent can anchor a shot on it) and their
    objective in THIS scene (not their general character sheet).
    """

    name: str
    objective: str = ""
    wardrobe: str = ""
    has_face_ref: bool = False
    has_body_ref: bool = False


class SceneLocation(BaseModel):
    """The scouted real-world location for this scene, if one was chosen —
    lets the director agent anchor the establishing shot on the actual
    scouted location image instead of inventing one.
    """

    name: str = ""
    category: str = ""
    has_preview_image: bool = False


class ShotlistRequest(BaseModel):
    scene_text: str
    scene_title: str = "INT. REINFORCED CHAMBER - NIGHT"
    director_style: str = "David Fincher / Neo-Noir Precision"
    characters: list[str] = Field(default_factory=list)
    target_total_duration_sec: int | None = Field(
        default=None,
        description="If set, the shot list is budgeted so shot durations sum to roughly this total, "
        "covering scenes longer than a single Veo call's 4-8s ceiling.",
    )
    # Full studio context — previously only scene_text/characters (names only)
    # reached this agent, leaving camera style, character reference images,
    # and scouted location entirely unused by shot planning.
    camera_motion: str = ""
    style_preset: str = ""
    aspect_ratio: str = "16:9"
    characters_detail: list[CharacterDetail] = Field(default_factory=list)
    location: SceneLocation | None = None


class ShotlistResponse(BaseModel):
    scene_title: str
    director_style: str
    visual_rhythm: str
    aspect_ratio: str
    color_temperature: str
    total_planned_duration_sec: int = 0
    shots: list[ShotItem]


def _fallback_shotlist(req: ShotlistRequest) -> ShotlistResponse:
    charA = req.characters[0] if req.characters else "Marcus"
    charB = req.characters[1] if len(req.characters) > 1 else "Elena"

    detail_by_name = {c.name: c for c in req.characters_detail}
    has_location_ref = bool(req.location and req.location.has_preview_image)

    base_bible = ContinuityBible(
        character_appearance=f"{charA}: rumpled grey suit, sweat visible. {charB}: sharp black tactical jumpsuit, hair pulled back tight.",
        wardrobe=detail_by_name.get(charA, CharacterDetail(name=charA)).wardrobe
        or detail_by_name.get(charB, CharacterDetail(name=charB)).wardrobe
        or "Unchanged from scene start — no costume changes in this scene.",
        location=req.location.name if req.location and req.location.name else "Reinforced bank vault antechamber, brushed steel walls, single blast door",
        lighting="Cold cyan-white 4300K overhead fluorescent, flickering, deep shadow falloff at edges",
        time_of_day="Night, interior, no windows",
    )

    template_shots = [
        {
            "shot_type": "Wide Establishing Master",
            "lens": "24mm Anamorphic Prime",
            "angle": "Eye-Level Center Axis",
            "camera_movement": req.camera_motion or "Slow creeping track forward (2mm/sec)",
            "blocking_notes": f"{charB} stands dead center facing the vault steel door. {charA} enters frame left at 00:03, stopping at terminal perimeter.",
            "lighting_setup": "Overhead flickering 4300K cyan tube fixture; deep silhouettes on periphery.",
            "dramatic_intent": f"Establish spatial claustrophobia and the power asymmetry between {charB} and {charA}.",
            "imagen_prompt": f"Cinematic wide establishing shot in bank vault. Cold cyan lighting, two silhouetted figures {charA} and {charB} facing a massive bank vault safe door. 35mm anamorphic scope, film grain.",
            "blocking_start": f"{charB} centered facing vault door, {charA} off-frame left",
            "blocking_end": f"{charB} still centered, {charA} entering frame left edge",
            "conditioning_source": "location_ref" if has_location_ref else (
                "character_ref" if detail_by_name.get(charB, CharacterDetail(name=charB)).has_face_ref else "none"
            ),
            "conditioning_ref": charB if not has_location_ref and detail_by_name.get(charB, CharacterDetail(name=charB)).has_face_ref else "",
        },
        {
            "shot_type": "Medium Over-the-Shoulder",
            "lens": "50mm T1.3 Master Prime",
            "angle": "Slight Low Angle",
            "camera_movement": "Locked off, rigid tripod",
            "blocking_notes": f"Looking past {charA}'s tense shoulder into {charB}'s unblinking profile as she holds the bypass key.",
            "lighting_setup": "Side-lit with warm tungsten spill from the security panel contrast against cold background.",
            "dramatic_intent": f"Force audience into {charA}'s subjective vulnerability as he realizes the setup.",
            "imagen_prompt": "Cinematic medium over-the-shoulder shot looking past a man's shoulder at a calculating woman holding a keycard. Moody shadow, shallow depth of field, photoreal film still.",
            "blocking_start": f"{charA} foreground left, {charB} facing camera mid-ground",
            "blocking_end": f"{charA} foreground left, {charB} raising keycard into frame",
            "conditioning_source": "character_ref" if detail_by_name.get(charA, CharacterDetail(name=charA)).has_face_ref else "previous_frame",
            "conditioning_ref": charA if detail_by_name.get(charA, CharacterDetail(name=charA)).has_face_ref else "",
        },
        {
            "shot_type": "Extreme Close-Up Insert",
            "lens": "85mm Macro Prime",
            "angle": "Top-Down 45 deg",
            "camera_movement": "Static macro lock",
            "blocking_notes": f"{charA}'s fingers trembling as he inspects the empty keycard slot on the electronic lock.",
            "lighting_setup": "High-contrast specular reflection off brushed titanium safe surface.",
            "dramatic_intent": "Visceral tangible evidence that escape has been compromised.",
            "imagen_prompt": "Macro close up shot of trembling hand touching a brushed titanium electronic keypad in shadows. Cinematic lighting, photoreal 35mm.",
            "blocking_start": f"{charA}'s hand entering frame top",
            "blocking_end": f"{charA}'s hand resting on empty keycard slot",
            "conditioning_source": "previous_frame",
            "conditioning_ref": "",
        },
        {
            "shot_type": "Tight Close-Up Reaction",
            "lens": "85mm Portrait Anamorphic",
            "angle": "Direct Eye-Level",
            "camera_movement": "Slow push-in concluding in sudden snap rack focus",
            "blocking_notes": f"{charB} turns head 15 degrees toward {charA}, expression completely devoid of remorse.",
            "lighting_setup": "Edge rim light in icy cyan; eye catchlight pinpoint reflection.",
            "dramatic_intent": "Confirm the emotional betrayal without words before the klaxon sounds.",
            "imagen_prompt": "Cinematic tight close up portrait of an enigmatic woman in shadows, cold calculating eyes, subtle blue rim lighting, 35mm anamorphic film.",
            "blocking_start": f"{charB} facing away 15 degrees",
            "blocking_end": f"{charB} facing {charA} directly, holding gaze",
            "conditioning_source": "previous_frame",
            "conditioning_ref": "",
        },
    ]

    # Budget shots (repeating the template cycle) so the sum covers the requested
    # total duration, since a single scene may need far more than 4 template beats.
    target = req.target_total_duration_sec or 25
    per_shot = 6
    shot_count = max(len(template_shots), round(target / per_shot))

    shots: list[ShotItem] = []
    remaining = target
    for i in range(shot_count):
        tpl = template_shots[i % len(template_shots)]
        shots_left = shot_count - i
        duration = max(4, min(8, round(remaining / shots_left))) if shots_left > 0 else 6
        remaining -= duration
        # Only the very first occurrence of a template beat gets its designed
        # conditioning source (e.g. the true establishing shot); repeats of
        # the cycle (for long scenes) fall back to previous_frame so we don't
        # re-anchor on a reference image mid-scene without a reason to.
        is_first_cycle = i < len(template_shots)
        shots.append(
            ShotItem(
                shot_number=i + 1,
                shot_type=tpl["shot_type"],
                lens=tpl["lens"],
                angle=tpl["angle"],
                camera_movement=tpl["camera_movement"],
                blocking_notes=tpl["blocking_notes"],
                lighting_setup=tpl["lighting_setup"],
                dramatic_intent=tpl["dramatic_intent"],
                imagen_prompt=tpl["imagen_prompt"],
                estimated_duration_sec=duration,
                conditioning_source=tpl["conditioning_source"] if is_first_cycle else "previous_frame",
                conditioning_ref=tpl["conditioning_ref"] if is_first_cycle else "",
                continuity_bible=ContinuityBible(
                    **{
                        **base_bible.model_dump(),
                        "blocking_start": tpl["blocking_start"],
                        "blocking_end": tpl["blocking_end"],
                    }
                ),
            )
        )

    return ShotlistResponse(
        scene_title=req.scene_title,
        director_style=req.director_style,
        visual_rhythm="Calculated neo-noir tension; static frames escalating into kinetic close-ups",
        aspect_ratio="2.39:1 Anamorphic",
        color_temperature="4300K Cold Cyan & Deep Tungsten",
        total_planned_duration_sec=sum(s.estimated_duration_sec for s in shots),
        shots=shots,
    )


def _build_director_prompt(req: ShotlistRequest) -> str:
    char_str = ", ".join(req.characters) if req.characters else "Marcus, Elena"

    cast_lines = []
    for c in req.characters_detail:
        refs = []
        if c.has_face_ref:
            refs.append("face reference image available")
        if c.has_body_ref:
            refs.append("full-body reference image available")
        ref_note = "; ".join(refs) if refs else "no reference image available"
        cast_lines.append(
            f"- {c.name}: objective in this scene = \"{c.objective or 'unspecified'}\"; "
            f"wardrobe = \"{c.wardrobe or 'unspecified'}\"; {ref_note}"
        )
    cast_block = "\n".join(cast_lines) if cast_lines else "(no detailed cast context provided)"

    if req.location and req.location.name:
        location_block = (
            f"{req.location.name} ({req.location.category or 'unspecified category'}); "
            f"{'scouted preview image available' if req.location.has_preview_image else 'no preview image available'}"
        )
    else:
        location_block = "(no scouted location — invent a location consistent with the screenplay)"

    duration_clause = (
        f"\nTARGET TOTAL DURATION: {req.target_total_duration_sec} seconds. "
        f"Plan enough sequential shots (each 4-8 sec) so their durations sum to approximately this total."
        if req.target_total_duration_sec
        else "\nGenerate a cinematic sequence of 4-6 camera shots."
    )

    return (
        f"SCENE TITLE: {req.scene_title}\n"
        f"DIRECTOR STYLE: {req.director_style}\n"
        f"CAMERA STYLE: motion = \"{req.camera_motion or 'unspecified, choose one consistent with director style'}\", "
        f"visual style preset = \"{req.style_preset or 'unspecified, choose one consistent with director style'}\", "
        f"aspect ratio = \"{req.aspect_ratio}\"\n"
        f"CAST ON THIS SCENE:\n{cast_block}\n"
        f"SCOUTED LOCATION: {location_block}\n"
        f"CHARACTERS PRESENT: {char_str}\n"
        f"SCREENPLAY TEXT:\n\n{req.scene_text}\n"
        f"{duration_clause}\n"
        f"Include blocking notes, lens specs, Imagen 3 prompts, a continuity_bible, and a "
        f"conditioning_source + conditioning_ref for every shot."
    )


@router.post("/generate", response_model=ShotlistResponse)
async def generate_shotlist(req: ShotlistRequest) -> ShotlistResponse:
    prompt = _build_director_prompt(req)

    agent = build_shotlist_agent()
    raw_output = await run_agent_once(agent, prompt, app_name="shotlist-generator")

    cleaned = raw_output.strip()
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        cleaned = "\n".join(lines[1:-1] if lines[-1].startswith("```") else lines[1:])

    try:
        data = json.loads(cleaned)
        shots_raw = data.get("shots", [])
        parsed_shots = [ShotItem(**s) for s in shots_raw]
        return ShotlistResponse(
            scene_title=data.get("scene_title", req.scene_title),
            director_style=data.get("director_style", req.director_style),
            visual_rhythm=data.get("visual_rhythm", "Deliberate tension with sharp conversational cuts"),
            aspect_ratio=data.get("aspect_ratio", "2.39:1 Anamorphic"),
            color_temperature=data.get("color_temperature", "4300K Cyan and Tungsten"),
            total_planned_duration_sec=data.get(
                "total_planned_duration_sec", sum(s.estimated_duration_sec for s in parsed_shots)
            ),
            shots=parsed_shots,
        )
    except Exception as e:  # noqa: BLE001
        logger.warning("Failed to parse Shotlist JSON from Gemini output: %s", e)

    return _fallback_shotlist(req)
