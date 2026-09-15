"""Tests for the Gemini Omni Flash video layer: prompt composition, request
normalization, delivery-mode selection, the in-memory job store's lifecycle
bounds, and the uploaded-clip path used by conversational editing.

The job store and the Files API upload are the pieces most likely to regress
silently — nothing upstream would notice if jobs leaked, were evicted
mid-render, or if a user-supplied clip never reached the model.
"""

import asyncio
import base64
import time

import pytest

from app.routers import media
from app.routers.media import (
    _MAX_OMNI_JOBS,
    _OMNI_JOBS,
    OmniVideoJob,
    _build_omni_video_prompt,
    _omni_response_format,
    _prune_omni_jobs,
    _resolve_aspect_ratio,
    _resolve_conversational_source,
    _start_omni_job,
    _upload_video_to_files_api,
    _wait_for_file_active,
    resolve_video_bytes,
    resolve_video_resolution,
    run_omni_video_interaction,
)


def setup_function():
    _OMNI_JOBS.clear()


def teardown_function():
    _OMNI_JOBS.clear()


def _job(job_id: str, *, status: str, updated_at: float) -> OmniVideoJob:
    return OmniVideoJob(job_id=job_id, status=status, updated_at=updated_at)


# --- prompt composition -----------------------------------------------------


def test_prompt_forces_a_single_continuous_take():
    """Omni cuts between shots by default, so a single take must be requested."""
    prompt = _build_omni_video_prompt("A vault door opening")
    assert "single continuous shot" in prompt.lower()
    assert "no scene cuts" in prompt.lower()


def test_prompt_includes_style_and_named_character():
    prompt = _build_omni_video_prompt(
        "Two figures face a vault",
        style_preset="Neo-Noir Cyberpunk",
        character_name="Elena",
    )
    assert "Neo-Noir Cyberpunk" in prompt
    assert "Elena" in prompt


def test_prompt_strips_celebrity_likeness_before_dispatch():
    """RAI filters silently drop real-person likeness, so it must be scrubbed."""
    prompt = _build_omni_video_prompt("A heist crew led by likeness resembling Florence Pugh")
    assert "Florence Pugh" not in prompt


# --- request normalization --------------------------------------------------


def test_aspect_ratio_only_accepts_the_two_supported_values():
    assert _resolve_aspect_ratio("9:16") == "9:16"
    assert _resolve_aspect_ratio("16:9") == "16:9"
    # 2.39:1 anamorphic is a prompt-level style, not a render ratio.
    assert _resolve_aspect_ratio("2.39:1") == "16:9"
    assert _resolve_aspect_ratio(None) == "16:9"


def test_resolution_falls_back_to_the_configured_default():
    assert resolve_video_resolution("4k") == "4k"
    assert resolve_video_resolution("1080P") == "1080p"  # normalized to lower case
    assert resolve_video_resolution("bogus") == "720p"
    assert resolve_video_resolution(None) in {"360p", "720p", "1080p", "4k"}


def test_high_resolutions_switch_to_uri_delivery():
    """Inline base64 breaks past ~4MB, so 1080p/4k must ask for a file URI."""
    assert "delivery" not in _omni_response_format("16:9", "720p")
    assert _omni_response_format("16:9", "1080p")["delivery"] == "uri"
    assert _omni_response_format("9:16", "4k")["aspect_ratio"] == "9:16"


# --- job store --------------------------------------------------------------


def test_prune_removes_finished_jobs_past_ttl():
    now = time.time()
    _OMNI_JOBS["old"] = _job("old", status="completed", updated_at=now - 7200)
    _OMNI_JOBS["fresh"] = _job("fresh", status="completed", updated_at=now)

    _prune_omni_jobs()

    assert "old" not in _OMNI_JOBS
    assert "fresh" in _OMNI_JOBS


def test_prune_never_evicts_an_in_flight_render():
    now = time.time()
    _OMNI_JOBS["running"] = _job("running", status="running", updated_at=now - 7200)

    _prune_omni_jobs()

    assert "running" in _OMNI_JOBS


def test_prune_enforces_cap_by_dropping_oldest_finished_jobs():
    now = time.time()
    for i in range(_MAX_OMNI_JOBS + 10):
        _OMNI_JOBS[f"job-{i:03d}"] = _job(f"job-{i:03d}", status="completed", updated_at=now - i)

    _prune_omni_jobs()

    assert len(_OMNI_JOBS) <= _MAX_OMNI_JOBS
    assert "job-000" in _OMNI_JOBS
    assert f"job-{_MAX_OMNI_JOBS + 9:03d}" not in _OMNI_JOBS


# --- job execution ----------------------------------------------------------


def test_start_omni_job_completes_and_keeps_a_strong_task_reference():
    async def _run():
        job = _start_omni_job(lambda: {"video_url": "https://cdn/take.mp4", "interaction_id": "v1_abc"})
        assert job.job_id in _OMNI_JOBS

        pending = list(media._OMNI_RUNNING_TASKS)
        assert len(pending) == 1, "the render must be strongly referenced until it settles"

        await asyncio.gather(*pending, return_exceptions=True)
        await asyncio.sleep(0)

        assert not media._OMNI_RUNNING_TASKS, "settled renders must not leak references"
        assert job.status == "completed"
        assert job.video_url == "https://cdn/take.mp4"
        assert job.interaction_id == "v1_abc"

    asyncio.run(_run())


def test_start_omni_job_surfaces_runner_failure_as_job_error():
    async def _run():
        def _boom():
            raise RuntimeError("Omni interaction returned no video output")

        job = _start_omni_job(_boom)
        await asyncio.gather(*list(media._OMNI_RUNNING_TASKS), return_exceptions=True)

        assert job.status == "error"
        assert "no video output" in (job.error or "")
        assert job.video_url is None

    asyncio.run(_run())


# --- uploaded-clip handling (Files API) -------------------------------------


class _State:
    def __init__(self, name: str):
        self.name = name


class _File:
    def __init__(self, state: str, uri: str | None = None, name: str = "files/uploaded"):
        self.state = _State(state)
        self.uri = uri
        self.name = name


class _FakeFiles:
    """Stands in for client.files, replaying a scripted sequence of states."""

    def __init__(self, states: list[str]):
        self._states = states
        self.uploaded: tuple | None = None
        self.downloaded: str | None = None

    def upload(self, *, file, config=None):
        self.uploaded = (file, config)
        return _File("PROCESSING", uri="https://files/uploaded", name="files/uploaded")

    def get(self, *, name, config=None):
        # Hold on the last scripted state once the script runs out.
        state = self._states.pop(0) if len(self._states) > 1 else self._states[0]
        return _File(state, uri="https://generativelanguage.googleapis.com/v1beta/files/abc:download?alt=media")

    def download(self, *, file, destination=None):
        self.downloaded = file
        if destination is not None:
            destination.write(b"\x00\x01\x02")


class _FakeClient:
    def __init__(self, states: list[str]):
        self.files = _FakeFiles(states)


@pytest.fixture(autouse=True)
def _no_poll_sleep(monkeypatch):
    """The real poll interval is 5s; tests must not actually wait on it."""
    monkeypatch.setattr(media, "_OMNI_FILE_POLL_INTERVAL_SEC", 0)


def test_wait_for_file_active_returns_once_the_file_goes_active():
    client = _FakeClient(["PROCESSING", "ACTIVE"])
    info = _wait_for_file_active(client, "files/abc")
    assert info.uri.endswith(":download?alt=media")


def test_wait_for_file_active_raises_when_processing_fails():
    client = _FakeClient(["PROCESSING", "FAILED"])
    with pytest.raises(RuntimeError, match="failed processing"):
        _wait_for_file_active(client, "files/abc")


def test_wait_for_file_active_times_out(monkeypatch):
    monkeypatch.setattr(media, "_OMNI_FILE_POLL_ATTEMPTS", 3)
    client = _FakeClient(["PROCESSING"])
    with pytest.raises(TimeoutError):
        _wait_for_file_active(client, "files/abc")


def test_upload_video_to_files_api_returns_an_active_uri():
    client = _FakeClient(["PROCESSING", "ACTIVE"])
    uri = _upload_video_to_files_api(client, b"\x00\x01\x02")
    assert uri.endswith(":download?alt=media")
    _stream, config = client.files.uploaded
    assert config["mime_type"] == "video/mp4"


def test_resolve_video_bytes_decodes_a_data_uri():
    payload = b"fake-mp4-bytes"
    data_uri = f"data:video/mp4;base64,{base64.b64encode(payload).decode()}"
    assert resolve_video_bytes(data_uri) == payload


def test_resolve_video_bytes_returns_none_for_unreadable_input():
    assert resolve_video_bytes(None) is None
    assert resolve_video_bytes("/definitely/not/a/real/clip.mp4") is None


def test_conversational_source_prefers_interaction_id_over_upload():
    """A clip this service rendered must not be re-uploaded."""
    client = _FakeClient(["ACTIVE"])
    source = _resolve_conversational_source(
        client,
        interaction_id="v1_abc",
        video_url="https://cdn/take.mp4",
        prompt="Change the lighting",
    )
    assert source == {"input_payload": "Change the lighting", "previous_interaction_id": "v1_abc"}
    assert client.files.uploaded is None, "no upload should happen on the multi-turn path"


def test_conversational_source_uploads_a_user_supplied_clip(monkeypatch):
    monkeypatch.setattr(media, "resolve_video_bytes", lambda _url: b"fake-mp4-bytes")
    client = _FakeClient(["PROCESSING", "ACTIVE"])

    source = _resolve_conversational_source(
        client,
        interaction_id=None,
        video_url="https://cdn/user-clip.mp4",
        prompt="Extend this video",
    )

    assert "previous_interaction_id" not in source
    parts = source["input_payload"]
    assert parts[0]["type"] == "video"
    assert parts[0]["uri"].startswith("https://")
    assert parts[-1] == {"type": "text", "text": "Extend this video"}
    assert client.files.uploaded is not None


def test_conversational_source_raises_when_the_clip_is_unreadable(monkeypatch):
    monkeypatch.setattr(media, "resolve_video_bytes", lambda _url: None)
    client = _FakeClient(["ACTIVE"])
    with pytest.raises(ValueError, match="Could not read video bytes"):
        _resolve_conversational_source(
            client,
            interaction_id=None,
            video_url="https://cdn/gone.mp4",
            prompt="Edit",
        )


# --- request shape: task vs previous_interaction_id -------------------------


class _Output:
    def __init__(self, data: str | None, uri: str | None = None):
        self.data = data
        self.uri = uri


class _Interaction:
    def __init__(self):
        self.id = "v1_test"
        self.output_video = _Output(base64.b64encode(b"fake-mp4").decode())


class _RecordingInteractions:
    def __init__(self):
        self.kwargs: dict | None = None

    def create(self, **kwargs):
        self.kwargs = kwargs
        return _Interaction()


class _RecordingClient:
    def __init__(self):
        self.interactions = _RecordingInteractions()


@pytest.fixture
def _no_supabase(monkeypatch):
    """Keep the persistence branch out of the request-shape assertions."""
    monkeypatch.setattr(media, "_persist_omni_video", lambda _bytes: "https://cdn/out.mp4")


def test_task_hint_is_dropped_when_acting_on_a_prior_interaction(_no_supabase):
    """Regression: sending both 400s with 'previous_interaction_id is not allowed
    when video task is set' — confirmed against the live API."""
    client = _RecordingClient()
    run_omni_video_interaction(
        client,
        input_payload="Make the ball blue.",
        previous_interaction_id="v1_prev",
        task="edit",
        response_format={"type": "video"},
    )
    assert "generation_config" not in client.interactions.kwargs
    assert client.interactions.kwargs["previous_interaction_id"] == "v1_prev"


def test_task_hint_is_still_sent_for_a_first_turn(_no_supabase):
    """`task` is a useful disambiguator when no prior interaction is referenced."""
    client = _RecordingClient()
    run_omni_video_interaction(client, input_payload="turn this photo into footage", task="image_to_video")
    assert client.interactions.kwargs["generation_config"] == {"video_config": {"task": "image_to_video"}}
