from __future__ import annotations

import json

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.agents.runner import run_agent_once
from app.agents.stripboard_analyzer import build_stripboard_analyzer_agent

router = APIRouter(prefix="/production", tags=["production"])


class StripboardSceneInput(BaseModel):
    scene_number: str = "01"
    setting: str = "INT"
    time_of_day: str = "NIGHT"
    location: str = ""
    summary: str = ""
    screenplay_text: str = ""


class StripboardBreakdownRequest(BaseModel):
    project_title: str = "Vault Heist"
    genre: str = "Sci-Fi / Thriller"
    scenes: list[StripboardSceneInput] = Field(default_factory=list)
    raw_screenplay: str = ""


class SceneProductionBreakdown(BaseModel):
    scene_number: str
    stunts: str = "None"
    stunt_tier: str = "None"
    practical_fx: str = "None"
    vfx_tier: str = "None"
    special_equipment: str = "Standard Package"
    permits_and_hazards: str = "Standard Stage Clearance"
    complexity_rating: int = 1
    production_notes: str = ""


class StripboardBreakdownResponse(BaseModel):
    total_shoot_days: int = 3
    estimated_budget_multiplier: float = 1.0
    production_summary: str = ""
    breakdown: list[SceneProductionBreakdown] = Field(default_factory=list)


def _build_fallback_breakdown(scenes: list[StripboardSceneInput]) -> list[SceneProductionBreakdown]:
    if not scenes:
        return [
            SceneProductionBreakdown(
                scene_number="01",
                stunts="Zero-G Wire Rig & Stunt Double disarm choreography",
                stunt_tier="Moderate",
                practical_fx="Depressurization fog, pulsed amber strobe",
                vfx_tier="Class B",
                special_equipment="Technocrane 30 + Master Prime Anamorphics",
                permits_and_hazards="Confined space ventilation safety clearance",
                complexity_rating=3,
                production_notes="Pre-light bulkhead rig during morning crew call.",
            ),
            SceneProductionBreakdown(
                scene_number="02",
                stunts="Precision hand-to-hand grapple against console",
                stunt_tier="Low",
                practical_fx="Sparks discharge, hydraulic steam valve release",
                vfx_tier="Class C",
                special_equipment="Ronin 4D Steadicam + Macro Probe Lens",
                permits_and_hazards="Pyrotechnic spark squib certification",
                complexity_rating=2,
                production_notes="Ensure electrical grounding on console deck.",
            ),
        ]

    result = []
    for sc in scenes:
        txt = f"{sc.location} {sc.summary} {sc.screenplay_text}".lower()
        has_action = any(w in txt for w in ["fight", "crash", "explosion", "gun", "breach", "run", "jump", "wire", "fall"])
        has_atm = any(w in txt for w in ["smoke", "fog", "steam", "rain", "fire", "amber", "strobe", "haze"])
        has_vfx = any(w in txt for w in ["screen", "interface", "hologram", "space", "outer", "hull", "portal", "drone"])

        result.append(
            SceneProductionBreakdown(
                scene_number=sc.scene_number,
                stunts="Wirework & tactical disarm fall" if has_action else "Controlled physical blocking",
                stunt_tier="High" if has_action else "Low",
                practical_fx="Pressurized atmospheric haze & practical amber flicker" if has_atm else "Subtle atmospheric haze",
                vfx_tier="Class A" if (has_vfx and has_action) else ("Class B" if has_vfx else "Class C"),
                special_equipment="Technocrane 30 + Anamorphic package" if has_action else "Steadicam sled + 35mm Prime",
                permits_and_hazards="High-impact safety padding & medic standby" if has_action else "Standard interior stage permit",
                complexity_rating=4 if has_action else 2,
                production_notes="Schedule technical rehearsal before principal cast call." if has_action else "Two-hander dialogue coverage, prioritize clean audio.",
            )
        )
    return result


@router.post("/stripboard-breakdown", response_model=StripboardBreakdownResponse)
async def generate_stripboard_breakdown(req: StripboardBreakdownRequest):
    agent = build_stripboard_analyzer_agent()

    scene_bullets = []
    if req.scenes:
        for s in req.scenes:
            scene_bullets.append(
                f"- Scene {s.scene_number} [{s.setting} - {s.time_of_day}]: {s.location}\n"
                f"  Summary: {s.summary or 'Standard narrative progression'}\n"
                f"  Screenplay snippet: {s.screenplay_text[:200]}"
            )
        scenes_block = "\n".join(scene_bullets)
    elif req.raw_screenplay:
        scenes_block = req.raw_screenplay[:3000]
    else:
        scenes_block = "Scene 01: INT. AIRLOCK - NIGHT. Depressurization countdown with physical struggle."

    prompt = (
        f"PROJECT TITLE: {req.project_title}\n"
        f"GENRE: {req.genre}\n\n"
        f"SCENE SLATE TO AUDIT:\n"
        f"{scenes_block}\n\n"
        f"Produce the full 1st AD / Line Producer stripboard technical breakdown in JSON."
    )

    raw_output = await run_agent_once(agent, prompt, app_name="stripboard-breakdown")
    cleaned = raw_output.strip()
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        cleaned = "\n".join(lines[1:-1] if lines[-1].startswith("```") else lines[1:])

    try:
        data = json.loads(cleaned)
        # Ensure all fields exist
        breakdown_items = []
        for item in data.get("breakdown", []):
            breakdown_items.append(SceneProductionBreakdown(**item))

        return StripboardBreakdownResponse(
            total_shoot_days=int(data.get("total_shoot_days", max(len(breakdown_items) // 2 + 1, 2))),
            estimated_budget_multiplier=float(data.get("estimated_budget_multiplier", 1.15)),
            production_summary=str(data.get("production_summary", f"Technical breakdown for {req.project_title} encompassing {len(breakdown_items)} scenes.")),
            breakdown=breakdown_items,
        )
    except (json.JSONDecodeError, KeyError, TypeError, ValueError):
        fallback_items = _build_fallback_breakdown(req.scenes)
        return StripboardBreakdownResponse(
            total_shoot_days=max(len(fallback_items) // 2 + 1, 2),
            estimated_budget_multiplier=1.2,
            production_summary=f"Technical shooting logistics breakdown for {req.project_title} calibrated to {len(fallback_items)} scenes.",
            breakdown=fallback_items,
        )
