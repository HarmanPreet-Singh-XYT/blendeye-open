"""Endpoints for chained multi-shot Gemini Omni Flash generation — covers
scenes longer than a single Omni clip's 3-10s ceiling by rendering shots
sequentially, each conditioned on the previous shot's last frame. See
services/video_sequencer.py for the continuity design.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.video_sequencer import SequenceShotInput, get_job, start_sequence_job

router = APIRouter(prefix="/media/video/sequence", tags=["media"])


class StartSequenceRequest(BaseModel):
    scene_id: str
    shots: list[SequenceShotInput] = Field(default_factory=list)
    # Maps character names (and the literal key "location") to a reference
    # image URL/data-URI, resolved from whichever shot the director agent
    # decided should be conditioned on that reference rather than the
    # previous shot's last frame (see conditioning_source/conditioning_ref
    # on each shot).
    reference_images: dict[str, str] = Field(default_factory=dict)


class StartSequenceResponse(BaseModel):
    job_id: str
    scene_id: str
    status: str
    total_shots: int


@router.post("/start", response_model=StartSequenceResponse)
async def start_sequence(req: StartSequenceRequest) -> StartSequenceResponse:
    if not req.shots:
        raise HTTPException(status_code=400, detail="shots list is required and must not be empty")

    job = start_sequence_job(req.scene_id, req.shots, req.reference_images)
    return StartSequenceResponse(
        job_id=job.job_id,
        scene_id=job.scene_id,
        status=job.status,
        total_shots=job.total_shots,
    )


@router.get("/status")
async def sequence_status(job_id: str):
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Sequence job not found")
    return job.model_dump()
