"""Extracts the last frame of a rendered clip so it can be used as the
image-conditioning input for the next chained Veo shot. This is the core
continuity mechanism for multi-shot scene generation: anchoring pixels
(not just a text description) is far stronger than prompt-only continuity.
"""

from __future__ import annotations

import asyncio
import logging
import shutil
import tempfile
import time
from pathlib import Path

from app.services.observability import PIXEL_ANCHORING_LATENCY_MS

logger = logging.getLogger(__name__)

_FFMPEG_BIN = shutil.which("ffmpeg")


class FrameExtractionError(RuntimeError):
    pass


async def extract_last_frame(video_source: Path | str) -> bytes:
    """Returns JPEG bytes of the final frame of the given video file, URL, or data URI.

    Uses ffmpeg's -sseof (seek from end-of-file) to grab the last frame
    without decoding the whole clip, which stays fast even as chains grow long.
    """
    if not _FFMPEG_BIN:
        raise FrameExtractionError("ffmpeg is not installed or not on PATH")

    _start_time = time.time()
    with tempfile.TemporaryDirectory() as tmpdir:
        input_target: str
        if isinstance(video_source, str) and video_source.startswith("data:"):
            # Decode inline base64 data URI to a temp mp4 file
            encoded = video_source.split(",", 1)[-1]
            import base64
            decoded_bytes = base64.b64decode(encoded)
            temp_vid = Path(tmpdir) / "input.mp4"
            temp_vid.write_bytes(decoded_bytes)
            input_target = str(temp_vid)
        elif isinstance(video_source, str) and video_source.startswith(("http://", "https://")):
            # Direct HTTP URL streamable by ffmpeg
            input_target = video_source
        else:
            path_obj = Path(video_source)
            if not path_obj.exists():
                raise FrameExtractionError(f"video file not found: {video_source}")
            input_target = str(path_obj)

        out_path = Path(tmpdir) / "last_frame.jpg"
        cmd = [
            _FFMPEG_BIN,
            "-y",
            "-sseof",
            "-1",
            "-i",
            input_target,
            "-update",
            "1",
            "-q:v",
            "2",
            str(out_path),
        ]
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await proc.communicate()

        if proc.returncode != 0 or not out_path.exists():
            raise FrameExtractionError(
                f"ffmpeg last-frame extraction failed (code {proc.returncode}): "
                f"{stderr.decode(errors='ignore')[-500:]}"
            )

        frame_bytes = out_path.read_bytes()
        PIXEL_ANCHORING_LATENCY_MS.observe((time.time() - _start_time) * 1000.0)
        return frame_bytes
