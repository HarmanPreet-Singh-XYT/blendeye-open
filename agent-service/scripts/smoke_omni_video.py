"""Live end-to-end smoke test for the Gemini Omni Flash video layer.

Everything in this module was originally implemented from the Interactions API
docs and unit-tested against stubs, so the *shape* of the SDK responses —
`interaction.output_video.data` vs `.uri`, `files.get(...).state`,
`files.download(...)` — was never confirmed against the real service. This
script runs the real production functions against the live API to close that
gap.

It exercises, in order:
  1. generate_inline  — text-to-video via inline base64 delivery
  2. generate_uri     — the same at a forced `delivery="uri"` (the >4MB path
                        that 1080p/4K renders take), polled to ACTIVE + downloaded
  3. edit             — conversational edit of step 1's clip (multi-turn)
  4. extend           — tail extension of step 1's clip
  5. upload_edit      — uploads a local clip through the Files API, then edits
                        it (the user-supplied-video path)

Renders are real and billable. All steps run at 360p with short prompts to keep
the cost minimal; generation duration is prompt-driven and not a parameter.

Usage:
    .venv/bin/python scripts/smoke_omni_video.py                  # all steps
    .venv/bin/python scripts/smoke_omni_video.py --only generate_inline
    .venv/bin/python scripts/smoke_omni_video.py --upload-clip ../web/public/videos/vault_heist_take_01.mp4
"""

from __future__ import annotations

import argparse
import sys
import time
from collections.abc import Callable
from pathlib import Path
from typing import Any

# Running a file puts its own directory on sys.path, not the cwd — the app
# package lives one level up.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

import os

from google import genai

from app.routers.media import (
    _omni_extract_video_bytes,
    _persist_omni_video,
    _resolve_conversational_source,
    _upload_video_to_files_api,
    run_omni_video_interaction,
)

PROMPT = "A single red rubber ball rolling slowly across a wooden table. In one continuous shot."
EDIT_INSTRUCTION = "Make the ball bright blue. Keep everything else the same."
EXTEND_PROMPT = "Continue the scene: the ball rolls off the edge of the table."


def _short(value: Any, limit: int = 90) -> str:
    """Truncates anything long (base64 data URIs) before it hits the terminal."""
    text = value if isinstance(value, str) else repr(value)
    return text if len(text) <= limit else f"{text[:limit]}… ({len(text)} chars)"


def describe_interaction(interaction: Any) -> str:
    """Summarizes the real response shape — the thing that was never verified."""
    output = getattr(interaction, "output_video", None)
    lines = [
        (
            f"    interaction: {type(interaction).__name__} id={getattr(interaction, 'id', None)!r} "
            f"status={getattr(interaction, 'status', None)!r}"
        ),
        f"    output_video: {type(output).__name__ if output is not None else 'None'}",
    ]
    if output is not None:
        data = getattr(output, "data", None)
        uri = getattr(output, "uri", None)
        lines.append(f"      .data: {'set ' + str(len(data)) + ' chars' if data else 'unset'}")
        lines.append(f"      .uri : {_short(uri) if uri else 'unset'}")

    steps = getattr(interaction, "steps", None)
    if steps:
        kinds = []
        for step in steps:
            stype = getattr(step, "type", None) or type(step).__name__
            parts = getattr(step, "content", None) or []
            inner = [getattr(p, "type", type(p).__name__) for p in parts]
            kinds.append(f"{stype}{inner if inner else ''}")
        lines.append(f"    steps: {kinds}")
    return "\n".join(lines)


def run_step(name: str, fn: Callable[[], dict[str, Any]]) -> dict[str, Any] | None:
    print(f"\n=== {name} " + "=" * max(0, 58 - len(name)))
    started = time.time()
    try:
        result = fn()
    except Exception as exc:  # noqa: BLE001 - a smoke test reports, never hides
        print(f"  FAIL  {type(exc).__name__}: {exc}")
        return None
    elapsed = time.time() - started
    print(f"  PASS  {elapsed:.1f}s")
    print(f"    interaction_id: {result.get('interaction_id')!r}")
    print(f"    video_url: {_short(result.get('video_url'))}")
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--only",
        default="",
        help="Comma-separated subset of steps to run (default: all).",
    )
    parser.add_argument(
        "--upload-clip",
        default="web/public/videos/vault_heist_take_01.mp4",
        help="Repo-relative clip used by the upload_edit step (must be <=10s for the model).",
    )
    args = parser.parse_args()

    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        print("GOOGLE_API_KEY is not configured — cannot run a live smoke test.")
        return 2

    selected = {s.strip() for s in args.only.split(",") if s.strip()}
    wanted = lambda step: not selected or step in selected

    client = genai.Client(api_key=api_key)

    # Same resolution/delivery split the production endpoint uses: 360p renders
    # inline, higher resolutions request a file URI.
    generated: dict[str, Any] | None = None

    if wanted("generate_inline"):
        generated = run_step(
            "generate_inline",
            lambda: run_omni_video_interaction(
                client,
                input_payload=PROMPT,
                aspect_ratio="16:9",
                resolution="360p",
            ),
        )

    if wanted("generate_uri"):
        # The >4MB delivery path: the response carries a file URI instead of
        # inline base64, which must be polled to ACTIVE and then downloaded.
        # 360p keeps this cheap. The step asserts the URI branch was actually
        # taken — if the API hands back inline data instead, `_omni_extract_video_bytes`
        # would fall through to the data branch and this path would go untested.
        def _uri_delivery() -> dict[str, Any]:
            interaction = client.interactions.create(
                model="gemini-omni-1.1-flash",
                input=PROMPT,
                response_format={
                    "type": "video",
                    "aspect_ratio": "16:9",
                    "resolution": "360p",
                    "delivery": "uri",
                },
            )
            print(describe_interaction(interaction))
            output = getattr(interaction, "output_video", None)
            if getattr(output, "data", None):
                raise AssertionError(
                    "delivery='uri' returned inline data, so the file-URI branch "
                    "(files.get -> ACTIVE -> files.download) was NOT exercised"
                )
            video_bytes = _omni_extract_video_bytes(client, interaction)
            print(f"    downloaded {len(video_bytes)} bytes via files.download")
            return {
                "interaction_id": getattr(interaction, "id", None),
                "video_url": _persist_omni_video(video_bytes),
            }

        run_step("generate_uri", _uri_delivery)

    interaction_id = (generated or {}).get("interaction_id")

    if wanted("edit"):
        if not interaction_id:
            print("\n=== edit ===\n  SKIP  no interaction_id from generate_inline")
        else:
            def _edit() -> dict[str, Any]:
                source = _resolve_conversational_source(
                    client,
                    interaction_id=interaction_id,
                    video_url=None,
                    prompt=EDIT_INSTRUCTION,
                )
                return run_omni_video_interaction(
                    client, **source, task="edit", response_format={"type": "video"}
                )

            run_step("edit", _edit)

    if wanted("extend"):
        if not interaction_id:
            print("\n=== extend ===\n  SKIP  no interaction_id from generate_inline")
        else:
            def _extend() -> dict[str, Any]:
                source = _resolve_conversational_source(
                    client,
                    interaction_id=interaction_id,
                    video_url=None,
                    prompt=EXTEND_PROMPT,
                )
                return run_omni_video_interaction(
                    client, **source, task="extend", response_format={"type": "video"}
                )

            run_step("extend", _extend)

    if wanted("upload_edit"):
        repo_root = Path(__file__).resolve().parent.parent.parent
        clip = Path(args.upload_clip)
        if not clip.is_absolute():
            clip = repo_root / clip
        if not clip.exists():
            print(f"\n=== upload_edit ===\n  SKIP  clip not found: {clip}")
        else:
            def _upload_edit() -> dict[str, Any]:
                # Exercises files.upload + the PROCESSING→ACTIVE poll, then feeds
                # the resulting video URI into a real edit turn.
                uploaded_uri = _upload_video_to_files_api(client, clip.read_bytes())
                print(f"    uploaded and ACTIVE: {_short(uploaded_uri)}")
                interaction = client.interactions.create(
                    model="gemini-omni-1.1-flash",
                    input=[
                        {"type": "video", "uri": uploaded_uri},
                        {"type": "text", "text": "Change the lighting to be warmer. Keep everything else the same."},
                    ],
                    response_format={"type": "video"},
                )
                print(describe_interaction(interaction))
                video_bytes = _omni_extract_video_bytes(client, interaction)
                print(f"    uploaded-clip render: {len(video_bytes)} bytes")
                return {
                    "interaction_id": getattr(interaction, "id", None),
                    "video_url": _persist_omni_video(video_bytes),
                }

            run_step("upload_edit", _upload_edit)

    print("\nSmoke run complete.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
