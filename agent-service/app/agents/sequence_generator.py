"""Full multi-scene sequence generator. Takes a director's pitch (title,
logline, genre, director style, core secret, cast) and architects the
complete 3-4 scene screenplay sequence in one call.

This used to live as a direct Gemini REST call inside the Next.js web layer
(web/app/api/project/generate/route.ts), which meant the web deployment
needed its own separate GOOGLE_API_KEY alongside agent-service's — and when
that env var was missing on the web deployment, the endpoint would silently
fall back to a canned template with no error surfaced anywhere. Every other
generation/reasoning path in the app already goes through agent-service, so
this agent brings project sequence generation in line with that pattern:
one place holds Gemini credentials, the web layer is a thin proxy.
"""

from __future__ import annotations

from google.adk import Agent
from pydantic import BaseModel, Field

from app.config import get_settings


class SequenceCharacter(BaseModel):
    name: str
    role: str = Field(description="Dramatic role, e.g. 'Protagonist / Mastermind'")
    archetype: str
    speech_style: str = Field(default="measured, guarded, rhythmic")
    subtext_ratio: str = Field(default="high")
    objective: str = Field(description="Central dramatic desire")
    dials_summary: str | None = Field(default=None, description="e.g. 'Confidence 90% · Subtext 85%'")
    actor_comp: str | None = Field(default=None, description="Casting comp reference")


class SceneCastRole(BaseModel):
    character_name: str
    objective_in_scene: str = Field(description="This character's specific objective in THIS scene")


class SequenceScene(BaseModel):
    scene_number: int
    title: str = Field(description="Specific dramatic title, not a generic placeholder")
    slugline: str = Field(description="Standard Hollywood slugline, e.g. 'INT. REINFORCED VAULT - NIGHT'")
    location: str
    summary: str = Field(description="2-3 sentence synopsis of what turns in this scene and what is withheld")
    start_seconds: int = Field(description="Timeline offset in seconds, proportioned across the target runtime")
    duration_seconds: int = Field(default=240)
    cast_present: list[str] = Field(default_factory=list)
    # A list of (name, objective) pairs rather than a free-form dict — the
    # Gemini Developer API's structured-output schema rejects
    # "additionalProperties" (open-ended dict types), which is only
    # supported in Gemini Enterprise/Vertex AI mode. See sequence.py's
    # generate_sequence, which converts this back into a dict for the
    # frontend's castRoles shape.
    cast_roles: list[SceneCastRole] = Field(default_factory=list)
    screenplay_text: str = Field(description="Production-ready Hollywood screenplay draft for this scene")


class SequenceGenerationResult(BaseModel):
    title: str
    logline: str
    genre: str
    characters: list[SequenceCharacter]
    scenes: list[SequenceScene]


INSTRUCTION = """
You are an elite Hollywood Showrunner, Master Screenwriter, and Narrative
Architect. Given a director's production specification, autonomously
architect the complete multi-scene screenplay sequence for this film
project.

Do NOT use generic placeholders like "Scene 1", "The Inciting Incident", or
"Everything is about to change". Every scene must have a vivid,
story-specific title, an authentic Hollywood slugline, distinct character
objectives for that beat, and gripping subtext-laden dialogue.

Requirements:
1. Synthesize 2 to 4 rich, three-dimensional characters — use any characters
   already supplied in the input verbatim (do not invent replacements for
   named characters), and only invent new ones to fill out the cast if fewer
   than 2 were supplied.
2. Architect a 3 to 4 scene sequence covering:
   - Scene 1: The Inciting Collision / Setup — sets the stakes and character
     objectives.
   - Scene 2: The Complication / Covert Agenda — the hidden secret begins to
     manifest.
   - Scene 3: The Point of No Return / Crisis — the major dramatic showdown.
   - Scene 4: The Climax / Fallout — the truth ruptures and consequences
     land.
3. If a "Core Dramatic Secret" is supplied, that secret must be the one that
   manifests in Scene 2 and pays off in Scene 3 — it is the asymmetric-
   knowledge pivot the rest of the production is built around, so do not
   substitute a different twist.
4. Timestamps (start_seconds) must be proportioned across the supplied
   target runtime and strictly increasing scene to scene.

Output must conform exactly to the provided schema.
"""


def build_sequence_generator_agent() -> Agent:
    settings = get_settings()
    return Agent(
        name="sequence_generator",
        model=settings.gemini_model,
        instruction=INSTRUCTION,
        output_schema=SequenceGenerationResult,
    )
