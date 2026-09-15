"""Tests for the in-memory sequence-job store's lifecycle bounds.

`_JOBS` previously had no eviction at all, so a long-lived process accumulated
every sequence job it had ever run, and the asyncio task driving each chain
was created without a strong reference (Python only keeps a weak one, so a
multi-minute chain could be garbage-collected mid-render).
"""

import asyncio
import time

from app.services import video_sequencer
from app.services.video_sequencer import (
    _JOBS,
    _MAX_JOBS,
    SequenceJob,
    SequenceShotState,
    _prune_jobs,
)


def _job(job_id: str, *, status: str, updated_at: float, scene_id: str = "scene-1") -> SequenceJob:
    return SequenceJob(
        job_id=job_id,
        scene_id=scene_id,
        status=status,
        total_shots=1,
        shots=[SequenceShotState(shot_number=1)],
        created_at=updated_at,
        updated_at=updated_at,
    )


def setup_function():
    _JOBS.clear()


def teardown_function():
    _JOBS.clear()


def test_prune_removes_finished_jobs_past_ttl():
    now = time.time()
    _JOBS["old"] = _job("old", status="completed", updated_at=now - 7200)
    _JOBS["fresh"] = _job("fresh", status="completed", updated_at=now)

    _prune_jobs()

    assert "old" not in _JOBS
    assert "fresh" in _JOBS


def test_prune_never_evicts_in_flight_jobs():
    now = time.time()
    # Very old but still running — must survive so a render is never killed.
    _JOBS["running"] = _job("running", status="running", updated_at=now - 7200)

    _prune_jobs()

    assert "running" in _JOBS


def test_prune_enforces_cap_by_dropping_oldest_finished_jobs():
    now = time.time()
    for i in range(_MAX_JOBS + 10):
        job_id = f"job-{i:03d}"
        _JOBS[job_id] = _job(job_id, status="completed", updated_at=now - i)

    _prune_jobs()

    assert len(_JOBS) <= _MAX_JOBS
    # The most recently finished jobs are the ones kept.
    assert "job-000" in _JOBS
    assert f"job-{_MAX_JOBS + 9:03d}" not in _JOBS


def test_prune_allows_temporary_overflow_when_all_jobs_are_running():
    now = time.time()
    for i in range(_MAX_JOBS + 5):
        job_id = f"run-{i:03d}"
        _JOBS[job_id] = _job(job_id, status="running", updated_at=now)

    _prune_jobs()

    # Nothing evictable, so the cap yields rather than aborting live renders.
    assert len(_JOBS) == _MAX_JOBS + 5


def test_start_sequence_job_holds_strong_task_reference():
    """The task must be tracked in _RUNNING_TASKS until it settles, then released."""
    async def _run():
        job = video_sequencer.start_sequence_job("scene-1", [])
        assert job.job_id in _JOBS

        pending = list(video_sequencer._RUNNING_TASKS)
        assert len(pending) == 1, "the sequence task must be strongly referenced"

        # Zero shots, so the run terminates immediately without any Omni call.
        await asyncio.gather(*pending, return_exceptions=True)
        # Let the done-callback's discard run.
        await asyncio.sleep(0)

        assert not video_sequencer._RUNNING_TASKS, "settled tasks must not leak references"
        assert _JOBS[job.job_id].status in ("completed", "error")

    asyncio.run(_run())
