"""Runs a chained sequence of Veo shots to cover a scene duration longer than
a single Veo call's 4-8s ceiling.

Continuity across shots is enforced two ways:
  1. Pixel anchoring — the last frame of shot N is extracted and passed as
     the image-conditioning input for shot N+1, so lighting/character/framing
     drift is constrained by an actual reference image, not just text.
  2. A locked continuity_bible per shot (produced upfront by the shotlist
     planner, see routers/shotlist.py) — each shot's prompt is built fresh
     from this fixed structured spec, never from an accumulating log of
     prior prompts/generations. This is what keeps hallucination from
     compounding shot-over-shot: the per-shot generation step only ever
     sees {bible, this shot's beat, previous last-frame}, nothing more.

This runs as a plain in-memory background asyncio task (this service is
otherwise stateless — see runner.py's docstring — so a process restart
loses in-flight jobs; that's an acceptable tradeoff for a demo-scope
feature and mirrors how Veo operations themselves are already not
persisted anywhere durable).
"""

from __future__ import annotations

import asyncio
import logging
import time
import uuid
from pathlib import Path
from typing import Any

from google import genai
from pydantic import BaseModel, Field

from app.config import get_settings
from app.routers.media import dispatch_veo_generation, poll_veo_operation
from app.services.frame_extractor import FrameExtractionError, extract_last_frame
from app.services.observability import VEO_GENERATION_SECONDS, VEO_VIDEO_RENDERS_TOTAL
from app.services.prompt_sanitizer import sanitize_veo_prompt

logger = logging.getLogger(__name__)

_WEB_PUBLIC_DIR = Path(__file__).resolve().parent.parent.parent.parent / "web" / "public"

# Server-side polling: cadence and ceiling per shot. Client no longer owns
# the timeout — a 10-shot chain at up to 6 min/shot would blow past any
# sane client-side setInterval budget, which is what forced this to move
# server-side in the first place.
_POLL_INTERVAL_SEC = 4
_MAX_POLL_ATTEMPTS_PER_SHOT = 90  # ~6 minutes/shot ceiling


class SequenceShotInput(BaseModel):
    shot_number: int
    prompt: str
    estimated_duration_sec: int = 6
    continuity_bible: dict[str, Any] = Field(default_factory=dict)
    # Decided by the director agent (see routers/shotlist.py) at planning
    # time, not by this sequencer: "character_ref" | "location_ref" |
    # "previous_frame" | "none". Lets a character's own reference image (or
    # the scouted location's image) anchor a shot instead of always forcing
    # every non-first shot onto the previous shot's last frame.
    conditioning_source: str = "previous_frame"
    conditioning_ref: str = ""  # character name, when conditioning_source == "character_ref"


class SequenceShotState(BaseModel):
    shot_number: int
    status: str = "planned"  # planned | generating | completed | error
    video_url: str | None = None
    last_frame_data_uri: str | None = None
    error_message: str | None = None


class SequenceJob(BaseModel):
    job_id: str
    scene_id: str
    status: str = "queued"  # queued | running | completed | error
    current_shot_index: int = 0
    total_shots: int
    shots: list[SequenceShotState]
    error_message: str | None = None
    created_at: float = Field(default_factory=time.time)
    updated_at: float = Field(default_factory=time.time)


# In-memory job store. Fine for a single-process dev/demo deployment;
# would need Redis/DB-backed state to survive a restart or scale beyond
# one worker process.
_JOBS: dict[str, SequenceJob] = {}

# `asyncio.create_task` only keeps a *weak* reference to the task, so a long
# chained run (up to ~6 min/shot) can be garbage-collected mid-flight unless
# something holds a strong reference. This set is that reference; the done
# callback drops it so finished jobs don't leak.
_RUNNING_TASKS: set[asyncio.Task] = set()

# Bound the in-memory job store. Nothing else evicts entries, so without this
# a long-lived process accumulates every job it has ever run.
_MAX_JOBS = 64
_JOB_TTL_SECONDS = 3600


def _is_terminal(job: SequenceJob) -> bool:
    return job.status in ("completed", "error")


def _prune_jobs() -> None:
    """Drops finished jobs older than the TTL, then trims the oldest finished
    jobs until the store is back under `_MAX_JOBS`. In-flight jobs are never
    evicted — exceeding the cap temporarily is preferable to killing a render.
    """
    now = time.time()
    for job_id, job in list(_JOBS.items()):
        if _is_terminal(job) and (now - job.updated_at) > _JOB_TTL_SECONDS:
            _JOBS.pop(job_id, None)

    overflow = len(_JOBS) - _MAX_JOBS
    if overflow <= 0:
        return

    finished = sorted(
        (job for job in _JOBS.values() if _is_terminal(job)),
        key=lambda job: job.updated_at,
    )
    for job in finished[:overflow]:
        _JOBS.pop(job.job_id, None)


def get_job(job_id: str) -> SequenceJob | None:
    _prune_jobs()
    return _JOBS.get(job_id)


def _build_shot_prompt(shot: SequenceShotInput) -> str:
    """Builds the per-shot Veo prompt from ONLY the fixed continuity bible and
    this shot's own beat — deliberately not from any prior shot's prompt or
    generation history, so drift can't compound across the chain.
    """
    bible = shot.continuity_bible or {}
    clean_base_prompt = sanitize_veo_prompt(shot.prompt.strip().rstrip("."))
    parts = [clean_base_prompt]

    if bible.get("character_appearance"):
        clean_appearance = sanitize_veo_prompt(bible["character_appearance"])
        if clean_appearance:
            parts.append(f"Characters look exactly like: {clean_appearance}")
    if bible.get("wardrobe"):
        parts.append(f"Wardrobe: {bible['wardrobe']}")
    if bible.get("location"):
        parts.append(f"Location: {bible['location']}")
    if bible.get("lighting"):
        parts.append(f"Lighting: {bible['lighting']}")
    if bible.get("time_of_day"):
        parts.append(f"Time of day: {bible['time_of_day']}")
    if bible.get("blocking_start"):
        parts.append(f"Shot opens with: {bible['blocking_start']}")
    if bible.get("blocking_end"):
        parts.append(f"Shot ends with: {bible['blocking_end']}")

    return sanitize_veo_prompt(". ".join(parts) + ".")


def _resolve_conditioning_image_url(
    shot: SequenceShotInput,
    *,
    previous_frame_bytes: bytes | None,
    reference_images: dict[str, str],
) -> str | None:
    """Resolves which image (if any) this shot should be conditioned on,
    following the director agent's per-shot decision rather than always
    defaulting to the previous shot's last frame. `reference_images` maps
    character names (and the literal key "location") to image URLs/data URIs
    supplied by the caller (see StartSequenceRequest.reference_images).
    """
    source = (shot.conditioning_source or "previous_frame").strip().lower()

    if source == "character_ref" and shot.conditioning_ref:
        ref_url = reference_images.get(shot.conditioning_ref)
        if ref_url:
            return ref_url
        logger.warning(
            "Shot %d requested character_ref conditioning for '%s' but no reference image was supplied; "
            "falling back to previous frame.",
            shot.shot_number,
            shot.conditioning_ref,
        )
    elif source == "location_ref":
        ref_url = reference_images.get("location")
        if ref_url:
            return ref_url
        logger.warning(
            "Shot %d requested location_ref conditioning but no location reference image was supplied; "
            "falling back to previous frame.",
            shot.shot_number,
        )
    elif source == "none":
        return None

    # Default / fallback: previous shot's extracted last frame.
    if previous_frame_bytes is not None:
        import base64
        return f"data:image/jpeg;base64,{base64.b64encode(previous_frame_bytes).decode()}"
    return None


async def _run_sequence(
    job_id: str,
    shots: list[SequenceShotInput],
    reference_images: dict[str, str] | None = None,
) -> None:
    job = _JOBS[job_id]
    settings = get_settings()
    api_key = settings.google_api_key
    if not api_key:
        job.status = "error"
        job.error_message = "GOOGLE_API_KEY not configured"
        job.updated_at = time.time()
        return

    client = genai.Client(api_key=api_key)
    job.status = "running"
    job.updated_at = time.time()

    reference_images = reference_images or {}
    previous_frame_bytes: bytes | None = None

    for idx, shot in enumerate(shots):
        job.current_shot_index = idx
        shot_state = job.shots[idx]
        shot_state.status = "generating"
        job.updated_at = time.time()

        prompt = _build_shot_prompt(shot)

        image_url = _resolve_conditioning_image_url(
            shot,
            previous_frame_bytes=previous_frame_bytes,
            reference_images=reference_images,
        )

        shot_start_time = time.time()
        shot_type = "chained_continuation" if idx > 0 else "opening_shot"

        try:
            operation_name = dispatch_veo_generation(
                client,
                prompt=prompt,
                duration_seconds=shot.estimated_duration_sec,
                image_url=image_url,
            )
        except Exception as e:  # noqa: BLE001
            logger.error("Sequence job %s shot %d dispatch failed: %s", job_id, shot.shot_number, e)
            shot_state.status = "error"
            shot_state.error_message = str(e)
            job.status = "error"
            job.error_message = f"Shot {shot.shot_number} failed to dispatch: {e}"
            job.updated_at = time.time()
            return

        video_url: str | None = None
        for _ in range(_MAX_POLL_ATTEMPTS_PER_SHOT):
            await asyncio.sleep(_POLL_INTERVAL_SEC)
            try:
                result = poll_veo_operation(client, operation_name)
            except Exception as e:  # noqa: BLE001
                logger.error("Sequence job %s shot %d poll error: %s", job_id, shot.shot_number, e)
                continue

            if result["status"] == "completed":
                video_url = result["video_url"]
                break
            if result["status"] == "error":
                VEO_VIDEO_RENDERS_TOTAL.labels(aspect_ratio="16:9", status="error").inc()
                VEO_GENERATION_SECONDS.labels(shot_type=shot_type).observe(time.time() - shot_start_time)
                shot_state.status = "error"
                shot_state.error_message = result.get("error", "unknown Veo error")
                job.status = "error"
                job.error_message = f"Shot {shot.shot_number} failed: {shot_state.error_message}"
                job.updated_at = time.time()
                return

        if not video_url:
            VEO_VIDEO_RENDERS_TOTAL.labels(aspect_ratio="16:9", status="timeout").inc()
            VEO_GENERATION_SECONDS.labels(shot_type=shot_type).observe(time.time() - shot_start_time)
            shot_state.status = "error"
            shot_state.error_message = "Timed out waiting for Veo render"
            job.status = "error"
            job.error_message = f"Shot {shot.shot_number} timed out"
            job.updated_at = time.time()
            return

        VEO_VIDEO_RENDERS_TOTAL.labels(aspect_ratio="16:9", status="completed").inc()
        VEO_GENERATION_SECONDS.labels(shot_type=shot_type).observe(time.time() - shot_start_time)
        shot_state.status = "completed"
        shot_state.video_url = video_url
        job.updated_at = time.time()

        # Extract last frame for the NEXT shot's conditioning. A failure here
        # is non-fatal to the shot itself (it already completed) — the chain
        # just continues without a reference image for the next shot, rather
        # than aborting a scene over a frame-grab hiccup.
        try:
            if video_url.startswith(("http://", "https://", "data:")):
                video_source = video_url
            else:
                video_source = _WEB_PUBLIC_DIR / video_url.lstrip("/")
            previous_frame_bytes = await extract_last_frame(video_source)
            import base64
            shot_state.last_frame_data_uri = (
                f"data:image/jpeg;base64,{base64.b64encode(previous_frame_bytes).decode()}"
            )
        except FrameExtractionError as e:
            logger.warning("Sequence job %s shot %d: last-frame extraction failed (%s); next shot loses pixel continuity anchor.", job_id, shot.shot_number, e)
            previous_frame_bytes = None

    job.status = "completed"
    job.current_shot_index = len(shots)
    job.updated_at = time.time()


def start_sequence_job(
    scene_id: str,
    shots: list[SequenceShotInput],
    reference_images: dict[str, str] | None = None,
) -> SequenceJob:
    _prune_jobs()

    job_id = f"seq-{uuid.uuid4().hex[:12]}"
    job = SequenceJob(
        job_id=job_id,
        scene_id=scene_id,
        total_shots=len(shots),
        shots=[SequenceShotState(shot_number=s.shot_number) for s in shots],
    )
    _JOBS[job_id] = job

    # Hold a strong reference for the lifetime of the run (see _RUNNING_TASKS).
    task = asyncio.create_task(_run_sequence(job_id, shots, reference_images))
    _RUNNING_TASKS.add(task)
    task.add_done_callback(_RUNNING_TASKS.discard)
    return job
