"""Bridge scene generator — writes a transitional scene connecting two
existing scenes in a screenplay (used by the AI Bridge Scene Architect
feature). Used to live as a direct Gemini REST call inside the Next.js web
layer (web/app/api/script/bridge/route.ts), requiring its own separate
GOOGLE_API_KEY on the web deployment with no agent-service fallback at all —
when that key was missing there, it silently returned a hardcoded
"Marcus"/"Elena" template regardless of the actual project. Bringing it into
agent-service closes that gap the same way sequence_generator.py did for
project generation.
"""

from __future__ import annotations

from google.adk import Agent
from pydantic import BaseModel, Field

from app.config import get_settings


class BridgeSceneResult(BaseModel):
    title: str = Field(description="Short punchy title, e.g. 'Infiltration Transit'")
    slugline: str = Field(description="Standard screenplay slugline, e.g. 'INT. SERVICE CORRIDOR - NIGHT'")
    location: str
    summary: str = Field(description="2-3 sentence synopsis of the bridge moment")
    cast_present: list[str] = Field(default_factory=list)
    duration_seconds: int = Field(default=180)
    screenplay_text: str = Field(description="Formatted screenplay with slugline, action lines, and dialogue")


INSTRUCTION = """
You are an elite Hollywood script supervisor and screenwriter. You are given
two disconnected scenes from a feature screenplay — a previous scene and a
next scene — plus the overall film premise and available cast.

Write a transitional "Bridge Scene" that logically and dramatically connects
the previous scene to the next scene. It should solve narrative logistics
(e.g. travel, preparation, surveillance, a close call, or escalating
tension) — not restate either scene, but earn the space between them.

If the director supplies specific creative guidance, you must realize and
reflect that guidance in the bridge scene.

Output must conform exactly to the provided schema.
"""


def build_bridge_scene_agent() -> Agent:
    settings = get_settings()
    return Agent(
        name="bridge_scene_generator",
        model=settings.gemini_model,
        instruction=INSTRUCTION,
        output_schema=BridgeSceneResult,
    )
