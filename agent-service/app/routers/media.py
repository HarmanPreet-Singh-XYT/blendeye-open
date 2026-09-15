import asyncio
import base64
import io
import json
import logging
import os
import re
import time
import uuid
import wave
from collections.abc import Callable
from pathlib import Path
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from google import genai
from google.genai.types import (
    GenerateContentConfig,
    HarmBlockThreshold,
    HarmCategory,
    MultiSpeakerVoiceConfig,
    PrebuiltVoiceConfig,
    SafetySetting,
    SpeakerVoiceConfig,
    SpeechConfig,
    VoiceConfig,
)
from pydantic import BaseModel, Field

from app.config import get_settings
from app.services.observability import (
    AUDIO_TTS_SYNTHESIS_SECONDS,
    IMAGEN_STORYBOARDS_TOTAL,
    OMNI_VIDEO_RENDERS_TOTAL,
)
from app.services.prompt_sanitizer import sanitize_character_name, sanitize_video_prompt

logger = logging.getLogger(__name__)

# Permissive safety thresholds for dramatic cinematic screenplay dialogue and concepts
CINEMA_SAFETY_SETTINGS = [
    SafetySetting(
        category=HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold=HarmBlockThreshold.BLOCK_NONE,
    ),
    SafetySetting(
        category=HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold=HarmBlockThreshold.BLOCK_NONE,
    ),
    SafetySetting(
        category=HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold=HarmBlockThreshold.BLOCK_NONE,
    ),
    SafetySetting(
        category=HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold=HarmBlockThreshold.BLOCK_NONE,
    ),
    SafetySetting(
        category=HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY,
        threshold=HarmBlockThreshold.BLOCK_NONE,
    ),
]

router = APIRouter(prefix="/media", tags=["media"])

# Character voice mappings for cinematic multi-speaker reads
VOICE_MAP = {
    "MARCUS": "Fenrir",
    "ELENA": "Aoede",
    "TEO": "Charon",
    "VANCE": "Kore",
    "COMMANDER VANCE": "Kore",
    "RAY": "Puck",
    "ENGINEER RAY": "Puck",
    "COLONEL": "Charon",
    "DR. ARLO": "Puck",
    "DETECTIVE": "Charon",
    "AUTOMATED VOICE": "Zephyr",
    "NARRATOR": "Zephyr",
    "DEFAULT": "Puck",
}


def pcm_to_wav(pcm_bytes: bytes, sample_rate: int = 24000, channels: int = 1, sampwidth: int = 2) -> bytes:
    """Wrap raw 16-bit linear PCM audio into a standard WAV container."""
    wav_io = io.BytesIO()
    with wave.open(wav_io, "wb") as wav_file:
        wav_file.setnchannels(channels)
        wav_file.setsampwidth(sampwidth)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(pcm_bytes)
    return wav_io.getvalue()


class GenerateImageRequest(BaseModel):
    prompt: str = Field(..., description="Cinematic visual concept or storyboard prompt")
    aspect_ratio: str = Field(default="16:9", description="Aspect ratio (16:9, 1:1, etc.)")


class GenerateImageResponse(BaseModel):
    image_url: str
    prompt: str
    model: str


class GenerateTTSRequest(BaseModel):
    text: str = Field(..., description="Dialogue line or direction to speak")
    speaker: str | None = Field(default=None, description="Character name to assign voice timbre")
    voice_name: str | None = Field(default=None, description="Direct voice override (Aoede, Fenrir, Puck, Zephyr, Charon, Kore)")
    delivery_style: str | None = Field(default=None, description="Delivery style / tone instruction")
    speed: float | None = Field(default=1.0, description="Pacing multiplier (0.8 - 1.3)")
    pitch_fine: float | None = Field(default=0.0, description="Pitch modifier (-6 to +6)")
    formant_shift: float | None = Field(default=0.0, description="Formant shift / chest resonance (-6 to +6)")
    reverb_room: str | None = Field(default=None, description="Acoustic environment space")
    reverb_send: float | None = Field(default=0.0, description="Reverb wet send percentage (0 - 100)")


class GenerateTTSResponse(BaseModel):
    audio_url: str
    speaker: str
    voice_name: str
    duration_estimate_sec: float
    dsp_applied: dict[str, Any] | None = None
    fallback: bool = False


@router.post("/image", response_model=GenerateImageResponse)
async def generate_image(req: GenerateImageRequest):
    """Generate a cinematic storyboard or location keyframe using Gemini / Imagen 3 models."""
    settings = get_settings()
    api_key = settings.google_api_key
    if not api_key:
        raise HTTPException(status_code=500, detail="GOOGLE_API_KEY not configured")

    client = genai.Client(api_key=api_key)

    clean_prompt = sanitize_video_prompt(req.prompt)
    cinematic_prompt = (
        f"{clean_prompt.strip().rstrip('.')}. "
        f"Aspect ratio {req.aspect_ratio}, photoreal cinematography, high production value, "
        f"sharp focus on the main subject, no text or watermarks, no distorted anatomy."
    )

    models_to_try = [
        "models/gemini-3.1-flash-image",
        "models/gemini-3-pro-image",
    ]

    last_error = None
    for model_name in models_to_try:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=cinematic_prompt,
                config=GenerateContentConfig(
                    safety_settings=CINEMA_SAFETY_SETTINGS,
                ),
            )
            if not response or not response.candidates:
                last_error = f"No candidates returned by {model_name}"
                continue
            cand = response.candidates[0]
            if not cand.content or not cand.content.parts:
                last_error = f"Candidate has no content parts (finish_reason: {cand.finish_reason})"
                continue
            for part in cand.content.parts:
                if part.inline_data is not None and part.inline_data.data:
                    b64_data = base64.b64encode(part.inline_data.data).decode("utf-8")
                    mime = part.inline_data.mime_type or "image/png"
                    data_uri = f"data:{mime};base64,{b64_data}"
                    IMAGEN_STORYBOARDS_TOTAL.labels(aspect_ratio=req.aspect_ratio).inc()
                    return GenerateImageResponse(
                        image_url=data_uri,
                        prompt=req.prompt,
                        model=model_name,
                    )
        except Exception as e:  # noqa: BLE001
            last_error = str(e)
            continue

    raise HTTPException(status_code=502, detail=f"Image generation failed across models: {last_error}")


@router.post("/tts", response_model=GenerateTTSResponse)
async def generate_tts(req: GenerateTTSRequest):
    """Synthesize expressive character speech using Gemini 3.1 Flash TTS with multi-speaker voice mapping."""
    _tts_start = time.time()
    settings = get_settings()
    api_key = settings.google_api_key
    if not api_key:
        raise HTTPException(status_code=500, detail="GOOGLE_API_KEY not configured")

    client = genai.Client(api_key=api_key)

    speaker_clean = (req.speaker or "NARRATOR").strip().upper()
    voice_selected = req.voice_name
    if not voice_selected:
        voice_selected = VOICE_MAP.get(speaker_clean, VOICE_MAP["DEFAULT"])

    # Construct cinematic delivery guidance for Gemini TTS
    directives: list[str] = []
    if req.delivery_style:
        directives.append(f"Tone: {req.delivery_style}")
    if req.speed and abs(req.speed - 1.0) > 0.05:
        cadence = "deliberate and measured" if req.speed < 1.0 else "urgent and rapid"
        directives.append(f"Cadence: {cadence} ({req.speed:.2f}x)")
    if req.formant_shift and req.formant_shift != 0:
        weight = "deep chest resonance" if req.formant_shift < 0 else "elevated high-tension timbre"
        directives.append(f"Resonance: {weight}")
    if req.reverb_room:
        directives.append(f"Acoustics: {req.reverb_room}")

    prompt_text = f"({', '.join(directives)}) {req.text}" if directives else req.text

    dsp_profile = {
        "delivery_style": req.delivery_style,
        "speed": req.speed or 1.0,
        "pitch_fine": req.pitch_fine or 0.0,
        "formant_shift": req.formant_shift or 0.0,
        "reverb_room": req.reverb_room,
        "reverb_send": req.reverb_send or 0.0,
    }

    prompts_to_try = [prompt_text]
    if directives and req.text != prompt_text:
        prompts_to_try.append(req.text)
    # Theatrical framing fallback if dramatic raw text triggers safety heuristics
    prompts_to_try.append(f"In a theatrical screenplay scene, {speaker_clean} says: {req.text}")

    tts_models = [
        "models/gemini-3.1-flash-tts-preview",
    ]

    last_err = None
    for m in tts_models:
        for p_text in prompts_to_try:
            try:
                res = client.models.generate_content(
                    model=m,
                    contents=p_text,
                    config=GenerateContentConfig(
                        response_modalities=["AUDIO"],
                        speech_config=SpeechConfig(
                            voice_config=VoiceConfig(
                                prebuilt_voice_config=PrebuiltVoiceConfig(
                                    voice_name=voice_selected
                                )
                            )
                        ),
                        safety_settings=CINEMA_SAFETY_SETTINGS,
                    ),
                )
                if not res or not res.candidates:
                    feedback = getattr(res, "prompt_feedback", None)
                    last_err = f"No candidates returned from {m} (feedback: {feedback})"
                    continue
                cand = res.candidates[0]
                if not cand.content or not cand.content.parts:
                    last_err = f"Candidate has no content parts (finish_reason: {cand.finish_reason})"
                    continue
                for part in cand.content.parts:
                    if part.inline_data is not None and part.inline_data.data:
                        raw_pcm = part.inline_data.data
                        wav_bytes = pcm_to_wav(raw_pcm, sample_rate=24000)
                        b64_wav = base64.b64encode(wav_bytes).decode("utf-8")
                        data_uri = f"data:audio/wav;base64,{b64_wav}"
                        duration = len(raw_pcm) / 48000.0
                        AUDIO_TTS_SYNTHESIS_SECONDS.labels(voice_count="1").observe(time.time() - _tts_start)
                        return GenerateTTSResponse(
                            audio_url=data_uri,
                            speaker=speaker_clean,
                            voice_name=voice_selected,
                            duration_estimate_sec=round(duration, 2),
                            dsp_applied=dsp_profile,
                            fallback=False,
                        )
            except Exception as e:  # noqa: BLE001
                last_err = str(e)
                continue

    logger.warning("All Gemini TTS attempts failed (%s). Generating fallback audio tone.", last_err)
    fallback_pcm = b"\x00\x00" * int(24000 * 0.4)
    wav_bytes = pcm_to_wav(fallback_pcm, sample_rate=24000)
    b64_wav = base64.b64encode(wav_bytes).decode("utf-8")
    return GenerateTTSResponse(
        audio_url=f"data:audio/wav;base64,{b64_wav}",
        speaker=speaker_clean,
        voice_name=voice_selected,
        duration_estimate_sec=0.4,
        dsp_applied=dsp_profile,
        fallback=True,
    )


class MultiSpeakerLine(BaseModel):
    speaker: str
    text: str
    voice_name: str | None = None


class GenerateMultiSpeakerTTSRequest(BaseModel):
    lines: list[MultiSpeakerLine] = Field(default_factory=list)
    script_text: str | None = None
    speaker_a: str | None = None
    voice_a: str | None = None
    speaker_b: str | None = None
    voice_b: str | None = None


class GenerateMultiSpeakerTTSResponse(BaseModel):
    audio_url: str
    duration_estimate_sec: float
    speakers: list[str]
    voice_mapping: dict[str, str]
    line_count: int


def _parse_screenplay_dialogue(text: str) -> list[tuple[str, str]]:
    """Parse dialogue turns from raw screenplay text."""
    parsed: list[tuple[str, str]] = []
    current_speaker = ""
    for raw in text.split("\n"):
        line = raw.strip()
        if not line:
            continue
        if line.startswith(("INT.", "EXT.")):
            current_speaker = ""
            continue
        if re.match(r"^[A-Z0-9\s.]{2,25}$", line) and not line.startswith("SCENE") and " - " not in line:
            current_speaker = line.split("(")[0].strip().upper()
        elif line.startswith("(") and line.endswith(")"):
            continue
        elif current_speaker:
            parsed.append((current_speaker, line))
    return parsed


@router.post("/tts-multi", response_model=GenerateMultiSpeakerTTSResponse)
async def generate_multi_tts(req: GenerateMultiSpeakerTTSRequest):
    """Generate a multi-speaker continuous audio table read using Gemini 3.1 Flash TTS MultiSpeakerVoiceConfig."""
    _tts_start = time.time()
    settings = get_settings()
    api_key = settings.google_api_key
    if not api_key:
        raise HTTPException(status_code=500, detail="GOOGLE_API_KEY not configured")

    client = genai.Client(api_key=api_key)

    dialogue_pairs: list[tuple[str, str]] = []
    if req.lines:
        dialogue_pairs = [(line.speaker.strip().upper(), line.text.strip()) for line in req.lines if line.text.strip()]
    elif req.script_text:
        dialogue_pairs = _parse_screenplay_dialogue(req.script_text)

    if not dialogue_pairs:
        raise HTTPException(status_code=400, detail="No dialogue lines found for multi-speaker TTS")

    # Determine unique speakers in order of appearance
    unique_speakers: list[str] = []
    for spk, _ in dialogue_pairs:
        if spk not in unique_speakers:
            unique_speakers.append(spk)

    # Establish voice mapping
    voice_mapping: dict[str, str] = {}
    for spk in unique_speakers:
        if spk == req.speaker_a and req.voice_a:
            voice_mapping[spk] = req.voice_a
        elif spk == req.speaker_b and req.voice_b:
            voice_mapping[spk] = req.voice_b
        else:
            voice_mapping[spk] = VOICE_MAP.get(spk, VOICE_MAP["DEFAULT"])

    # Ensure two distinct voices if 2 speakers share a default
    if len(unique_speakers) == 2:
        s1, s2 = unique_speakers[0], unique_speakers[1]
        if voice_mapping[s1] == voice_mapping[s2]:
            voice_mapping[s2] = "Aoede" if voice_mapping[s1] != "Aoede" else "Fenrir"

    accumulated_pcm = bytearray()

    # Gemini MultiSpeakerVoiceConfig requires exactly 2 speaker_voice_configs
    # We partition dialogue into 2-speaker chunks and concatenate raw linear PCM
    def chunk_dialogue(pairs: list[tuple[str, str]]) -> list[list[tuple[str, str]]]:
        chunks: list[list[tuple[str, str]]] = []
        current_chunk: list[tuple[str, str]] = []
        chunk_speakers: set[str] = set()

        for spk, txt in pairs:
            if spk not in chunk_speakers and len(chunk_speakers) >= 2:
                if current_chunk:
                    chunks.append(current_chunk)
                current_chunk = [(spk, txt)]
                chunk_speakers = {spk}
            else:
                chunk_speakers.add(spk)
                current_chunk.append((spk, txt))

        if current_chunk:
            chunks.append(current_chunk)
        return chunks

    dialogue_chunks = chunk_dialogue(dialogue_pairs)

    for chunk in dialogue_chunks:
        chunk_speakers = list(dict.fromkeys(spk for spk, _ in chunk))
        formatted_script = "\n".join(f"{spk}: {txt}" for spk, txt in chunk)

        # Single speaker chunk
        if len(chunk_speakers) == 1:
            spk = chunk_speakers[0]
            v_name = voice_mapping.get(spk, "Fenrir")
            try:
                res = client.models.generate_content(
                    model="gemini-3.1-flash-tts-preview",
                    contents=formatted_script,
                    config=GenerateContentConfig(
                        response_modalities=["AUDIO"],
                        speech_config=SpeechConfig(
                            voice_config=VoiceConfig(
                                prebuilt_voice_config=PrebuiltVoiceConfig(
                                    voice_name=v_name
                                )
                            )
                        ),
                        safety_settings=CINEMA_SAFETY_SETTINGS,
                    ),
                )
                if res and res.candidates and res.candidates[0].content and res.candidates[0].content.parts:
                    for part in res.candidates[0].content.parts:
                        if part.inline_data and part.inline_data.data:
                            accumulated_pcm.extend(part.inline_data.data)
                            break
            except Exception as e:  # noqa: BLE001
                logger.warning("Single-speaker chunk TTS failed: %s", e)
                continue

        # Two speaker chunk - Native Gemini MultiSpeakerVoiceConfig
        elif len(chunk_speakers) == 2:
            s1, s2 = chunk_speakers[0], chunk_speakers[1]
            v1, v2 = voice_mapping.get(s1, "Fenrir"), voice_mapping.get(s2, "Aoede")
            tts_prompt = f"TTS the following conversation between speakers {s1} & {s2}:\n{formatted_script}"

            try:
                res = client.models.generate_content(
                    model="gemini-3.1-flash-tts-preview",
                    contents=tts_prompt,
                    config=GenerateContentConfig(
                        speech_config=SpeechConfig(
                            language_code="en-us",
                            multi_speaker_voice_config=MultiSpeakerVoiceConfig(
                                speaker_voice_configs=[
                                    SpeakerVoiceConfig(
                                        speaker=s1,
                                        voice_config=VoiceConfig(
                                            prebuilt_voice_config=PrebuiltVoiceConfig(voice_name=v1)
                                        ),
                                    ),
                                    SpeakerVoiceConfig(
                                        speaker=s2,
                                        voice_config=VoiceConfig(
                                            prebuilt_voice_config=PrebuiltVoiceConfig(voice_name=v2)
                                        ),
                                    ),
                                ]
                            ),
                        ),
                        safety_settings=CINEMA_SAFETY_SETTINGS,
                    ),
                )
                if res and res.candidates and res.candidates[0].content and res.candidates[0].content.parts:
                    for part in res.candidates[0].content.parts:
                        if part.inline_data and part.inline_data.data:
                            accumulated_pcm.extend(part.inline_data.data)
                            # Add natural 300ms breathing silence between conversation blocks
                            accumulated_pcm.extend(b"\x00" * int(24000 * 2 * 0.3))
                            break
            except Exception as e:  # noqa: BLE001
                logger.warning("Multi-speaker chunk TTS failed: %s", e)
                # Fallback to line by line
                for spk, txt in chunk:
                    v_name = voice_mapping.get(spk, "Fenrir")
                    try:
                        single_res = client.models.generate_content(
                            model="gemini-3.1-flash-tts-preview",
                            contents=txt,
                            config=GenerateContentConfig(
                                response_modalities=["AUDIO"],
                                speech_config=SpeechConfig(
                                    voice_config=VoiceConfig(
                                        prebuilt_voice_config=PrebuiltVoiceConfig(voice_name=v_name)
                                    )
                                ),
                                safety_settings=CINEMA_SAFETY_SETTINGS,
                            ),
                        )
                        if single_res and single_res.candidates and single_res.candidates[0].content:
                            for part in single_res.candidates[0].content.parts:
                                if part.inline_data and part.inline_data.data:
                                    accumulated_pcm.extend(part.inline_data.data)
                                    accumulated_pcm.extend(b"\x00" * int(24000 * 2 * 0.25))
                    except Exception as e:  # noqa: BLE001
                        logger.debug("Skipping one multi-speaker TTS part: %s", e)

    if not accumulated_pcm:
        raise HTTPException(status_code=502, detail="Multi-speaker TTS synthesis returned no audio data")

    wav_bytes = pcm_to_wav(bytes(accumulated_pcm), sample_rate=24000)
    b64_wav = base64.b64encode(wav_bytes).decode("utf-8")
    data_uri = f"data:audio/wav;base64,{b64_wav}"
    duration = len(accumulated_pcm) / 48000.0

    AUDIO_TTS_SYNTHESIS_SECONDS.labels(voice_count=str(len(unique_speakers))).observe(time.time() - _tts_start)

    return GenerateMultiSpeakerTTSResponse(
        audio_url=data_uri,
        duration_estimate_sec=round(duration, 2),
        speakers=unique_speakers,
        voice_mapping=voice_mapping,
        line_count=len(dialogue_pairs),
    )


def resolve_image_bytes(image_url: str | None) -> tuple[bytes | None, str | None]:
    """Extract raw image bytes and mime type from data URI, public static path, or HTTP URL."""
    if not image_url:
        return None, None
    try:
        if image_url.startswith("data:image/"):
            header, encoded = image_url.split(",", 1)
            mime = header.split(";")[0].replace("data:", "")
            return base64.b64decode(encoded), mime
        if image_url.startswith(("http://", "https://")):
            import httpx
            with httpx.Client(timeout=10.0) as http_client:
                res = http_client.get(image_url)
                if res.is_success:
                    mime = res.headers.get("content-type", "image/jpeg").split(";")[0]
                    return res.content, mime
        if image_url.startswith("/"):
            cleaned = image_url.lstrip("/")
            p = Path(__file__).resolve().parent.parent.parent.parent / "web" / "public" / cleaned
            if p.exists() and p.is_file():
                mime = "image/png" if p.suffix.lower() == ".png" else "image/jpeg"
                return p.read_bytes(), mime
    except Exception as e:  # noqa: BLE001
        logger.warning("Could not resolve image bytes from %s: %s", image_url[:60], e)
    return None, None


# ---------------------------------------------------------------------------
# Gemini Omni Flash — generative video (generation, editing, extension)
# ---------------------------------------------------------------------------
#
# Omni Flash is driven through the Interactions API: one `interactions.create`
# call returns the rendered clip (inline base64, or a Google-hosted file URI
# for large renders). There is no operation to poll, so instead of dispatching
# an operation and polling it, each request runs as a background asyncio task
# over a small in-memory job store and the status endpoint reports that job.
# That keeps long renders (a 1080p clip can take minutes) off the HTTP request
# path while preserving the dispatch/status contract the frontend already
# speaks.
#
# Capabilities exposed below, per the Interactions API:
#   * text-to-video, image-to-video and reference-to-video generation
#   * first/last-frame interpolation (two conditioning images)
#   * conversational editing across turns (previous_interaction_id, or a
#     user-supplied clip uploaded through the Files API)
#   * video extension at the tail of an existing clip
#   * explicit aspect ratio (16:9 / 9:16) and output resolution
#
# Duration is deliberately NOT a request parameter: the model derives clip
# length (3-10s) from the prompt, so callers express timing in natural
# language instead (see the sequencer's per-shot prompt hint).

_OMNI_TASKS = {"text_to_video", "image_to_video", "reference_to_video", "edit", "extend"}
_OMNI_ASPECT_RATIOS = {"16:9", "9:16"}
_OMNI_RESOLUTIONS = {"360p", "720p", "1080p", "4k"}
# Inline base64 delivery is only viable up to ~4MB; higher-resolution renders
# come back as a file URI that has to be fetched separately.
_OMNI_INLINE_RESOLUTIONS = {"360p", "720p"}
_OMNI_FILE_POLL_INTERVAL_SEC = 5
_OMNI_FILE_POLL_ATTEMPTS = 60
_FILE_ID_PATTERN = re.compile(r"files/([A-Za-z0-9_-]+)")


class GenerateVideoRequest(BaseModel):
    prompt: str = Field(..., description="Cinematic scene visual, action and camera movement prompt")
    aspect_ratio: str = Field(default="16:9", description="Aspect ratio (16:9 or 9:16)")
    resolution: str | None = Field(default=None, description="Output resolution: 360p, 720p, 1080p or 4k")
    style_preset: str | None = Field(default="35mm Anamorphic Film", description="Film style preset")
    image_url: str | None = Field(default=None, description="Optional character concept or storyboard reference image")
    first_frame_url: str | None = Field(default=None, description="Optional starting frame for interpolation")
    last_frame_url: str | None = Field(default=None, description="Optional ending frame for interpolation")
    character_name: str | None = Field(default=None, description="Optional focused character name")
    task: str | None = Field(default=None, description="Optional explicit task hint (text_to_video, image_to_video, reference_to_video)")


class EditVideoRequest(BaseModel):
    instruction: str = Field(..., description="Simple natural-language edit, e.g. 'Change the lighting to be more dramatic'")
    interaction_id: str | None = Field(
        default=None,
        description="Interaction id of a clip this service rendered (multi-turn edit, no re-upload)",
    )
    video_url: str | None = Field(
        default=None,
        description="URL / data-URI of a user-supplied clip to edit. Must be <=10s on upload; "
        "editing uploaded clips is unavailable in the EEA, Switzerland and the UK.",
    )
    aspect_ratio: str = Field(default="16:9", description="Aspect ratio (16:9 or 9:16)")


class ExtendVideoRequest(BaseModel):
    prompt: str = Field(default="Continue the scene.", description="How the scene should continue")
    interaction_id: str | None = Field(
        default=None,
        description="Interaction id of a clip this service rendered (multi-turn extension)",
    )
    video_url: str | None = Field(
        default=None,
        description="URL / data-URI of a user-supplied clip to extend. Must be <=10s on upload; "
        "cannot add dialogue to a talking subject; unavailable in the EEA, Switzerland and the UK.",
    )
    aspect_ratio: str = Field(default="16:9", description="Aspect ratio (16:9 or 9:16)")


class GenerateVideoResponse(BaseModel):
    operation_name: str
    prompt: str
    status: str
    video_url: str | None = None
    interaction_id: str | None = None
    error: str | None = None


class OmniVideoJob(BaseModel):
    job_id: str
    status: str = "queued"  # queued | running | completed | error
    video_url: str | None = None
    interaction_id: str | None = None
    error: str | None = None
    created_at: float = Field(default_factory=time.time)
    updated_at: float = Field(default_factory=time.time)


# In-memory job store — same tradeoff as the sequence jobs in
# services/video_sequencer.py: fine for a single-process deployment, would need
# Redis/DB-backed state to survive a restart or scale past one worker.
_OMNI_JOBS: dict[str, OmniVideoJob] = {}
# `asyncio.create_task` only holds a weak reference, so a multi-minute render
# can be garbage-collected mid-flight without this strong reference.
_OMNI_RUNNING_TASKS: set[asyncio.Task] = set()
_MAX_OMNI_JOBS = 64
_OMNI_JOB_TTL_SECONDS = 3600


def _prune_omni_jobs() -> None:
    """Drops finished jobs past the TTL, then trims the oldest finished jobs
    until the store is back under the cap. In-flight renders are never evicted.
    """
    now = time.time()
    for job_id, job in list(_OMNI_JOBS.items()):
        if job.status in ("completed", "error") and (now - job.updated_at) > _OMNI_JOB_TTL_SECONDS:
            _OMNI_JOBS.pop(job_id, None)

    overflow = len(_OMNI_JOBS) - _MAX_OMNI_JOBS
    if overflow <= 0:
        return

    finished = sorted(
        (job for job in _OMNI_JOBS.values() if job.status in ("completed", "error")),
        key=lambda job: job.updated_at,
    )
    for job in finished[:overflow]:
        _OMNI_JOBS.pop(job.job_id, None)


def get_omni_video_job(job_id: str) -> OmniVideoJob | None:
    _prune_omni_jobs()
    return _OMNI_JOBS.get(job_id)


def _resolve_aspect_ratio(value: str | None) -> str:
    return value if value in _OMNI_ASPECT_RATIOS else "16:9"


def resolve_video_resolution(value: str | None) -> str:
    """Normalizes a requested resolution, falling back to the configured default."""
    requested = (value or get_settings().omni_video_resolution or "720p").lower()
    return requested if requested in _OMNI_RESOLUTIONS else "720p"


def _build_omni_video_prompt(
    prompt: str,
    *,
    style_preset: str | None = None,
    character_name: str | None = None,
) -> str:
    """Composes the sanitized generation prompt.

    Omni cuts between several shots by default, so a single continuous take has
    to be asked for explicitly. The negative tail keeps rendered lettering out
    of frame — Omni can render readable text, which would collide with the
    studio's own slates/titles.
    """
    sanitized = sanitize_video_prompt(prompt)
    clean_char = sanitize_character_name(character_name)

    parts = [sanitized.strip().rstrip(".")]
    if clean_char:
        parts.append(f"Keep {clean_char} as the primary subject in frame throughout")
    if style_preset and style_preset.lower() not in sanitized.lower():
        parts.append(f"Overall visual style: {style_preset}")
    parts.append("In a single continuous shot, no scene cuts")
    parts.append(
        "photoreal depth, consistent lighting and continuity across frames, "
        "no text or watermarks"
    )
    return ". ".join(part.rstrip(".") for part in parts if part) + "."


def build_video_input(prompt: str, images: list[tuple[bytes, str]]) -> str | list[dict[str, Any]]:
    """Builds the Interactions API `input` payload, binding images ahead of the prompt."""
    if not images:
        return prompt

    parts: list[dict[str, Any]] = [
        {
            "type": "image",
            "data": base64.b64encode(raw).decode("utf-8"),
            "mime_type": mime or "image/jpeg",
        }
        for raw, mime in images
    ]
    parts.append({"type": "text", "text": prompt})
    return parts


def _omni_response_format(aspect_ratio: str, resolution: str) -> dict[str, Any]:
    response_format: dict[str, Any] = {
        "type": "video",
        "aspect_ratio": aspect_ratio,
        "resolution": resolution,
    }
    if resolution not in _OMNI_INLINE_RESOLUTIONS:
        response_format["delivery"] = "uri"
    return response_format


def _wait_for_file_active(client: "genai.Client", file_name: str) -> Any:
    """Polls a Files API object until it finishes PROCESSING.

    Shared by both delivery paths: large model renders arriving as a file URI,
    and user-supplied clips uploaded before a conversational edit.
    """
    for _ in range(_OMNI_FILE_POLL_ATTEMPTS):
        info = client.files.get(name=file_name)
        state = getattr(getattr(info, "state", None), "name", None) or str(getattr(info, "state", ""))
        if state == "ACTIVE":
            return info
        if state == "FAILED":
            error = getattr(info, "error", None)
            raise RuntimeError(f"Gemini file {file_name} failed processing: {error or 'no reason given'}")
        time.sleep(_OMNI_FILE_POLL_INTERVAL_SEC)

    raise TimeoutError(f"Timed out waiting for Gemini file {file_name} to become ACTIVE")


def _omni_extract_video_bytes(client: "genai.Client", interaction: Any) -> bytes:
    """Pulls the rendered clip off an Omni interaction.

    Inline responses carry base64 in `output_video.data`; large renders come
    back as a Google-hosted file URI that has to be polled to ACTIVE before it
    can be downloaded. Both shapes are handled here so callers don't need to
    know which delivery mode they got.
    """
    output = getattr(interaction, "output_video", None)
    if output is None:
        raise RuntimeError("Omni interaction returned no video output")

    data = getattr(output, "data", None)
    if data:
        return base64.b64decode(data)

    uri = getattr(output, "uri", None)
    if not uri:
        raise RuntimeError("Omni interaction returned neither inline video data nor a file URI")

    match = _FILE_ID_PATTERN.search(uri)
    if not match:
        raise RuntimeError(f"Could not parse a file id out of the Omni output URI: {uri}")

    _wait_for_file_active(client, f"files/{match.group(1)}")

    buf = io.BytesIO()
    client.files.download(file=uri, destination=buf)
    return buf.getvalue()


def resolve_video_bytes(video_url: str | None) -> bytes | None:
    """Extracts raw video bytes from a data URI, HTTP URL, or local static path.

    Mirrors `resolve_image_bytes`, but aware of video data-URIs — this is how a
    user-supplied clip reaches the Files API for editing/extension.
    """
    if not video_url:
        return None
    try:
        if video_url.startswith("data:"):
            _, encoded = video_url.split(",", 1)
            return base64.b64decode(encoded)
        if video_url.startswith(("http://", "https://")):
            with httpx.Client(timeout=60.0) as http_client:
                res = http_client.get(video_url)
                if res.is_success:
                    return res.content
        if video_url.startswith("/"):
            p = Path(__file__).resolve().parent.parent.parent.parent / "web" / "public" / video_url.lstrip("/")
            if p.exists() and p.is_file():
                return p.read_bytes()
    except Exception as e:  # noqa: BLE001
        logger.warning("Could not resolve video bytes from %s: %s", video_url[:60], e)
    return None


def _upload_video_to_files_api(client: "genai.Client", video_bytes: bytes) -> str:
    """Uploads a user-supplied clip and returns its ACTIVE file URI.

    Uploaded clips must be 10s or shorter, and the API rejects any audio track
    in them — so an uploaded reference contributes picture only.
    """
    uploaded = client.files.upload(
        file=io.BytesIO(video_bytes),
        config={"mime_type": "video/mp4", "display_name": "blendeye_upload.mp4"},
    )

    file_name = getattr(uploaded, "name", None)
    if not file_name:
        raise RuntimeError("Files API upload returned no file name")

    info = _wait_for_file_active(client, file_name)
    uri = getattr(info, "uri", None) or getattr(uploaded, "uri", None)
    if not uri:
        raise RuntimeError("Files API upload returned no URI")

    logger.info("Uploaded user clip to the Files API (%d bytes) for conversational editing", len(video_bytes))
    return uri


def _resolve_conversational_source(
    client: "genai.Client",
    *,
    interaction_id: str | None,
    video_url: str | None,
    prompt: str,
) -> dict[str, Any]:
    """Builds the Interactions-API kwargs for acting on an existing clip.

    Two routes to the same capability:
      * `interaction_id` — a clip this service rendered, referenced by id with
        no re-upload (the cheap multi-turn path).
      * `video_url` — a user-supplied clip, uploaded through the Files API and
        passed as a video input.
    """
    if interaction_id:
        return {"input_payload": prompt, "previous_interaction_id": interaction_id}

    raw = resolve_video_bytes(video_url)
    if not raw:
        raise ValueError(f"Could not read video bytes from '{video_url}'")

    uri = _upload_video_to_files_api(client, raw)
    return {"input_payload": [{"type": "video", "uri": uri}, {"type": "text", "text": prompt}]}


def _persist_omni_video(video_bytes: bytes) -> str:
    """Stores a rendered clip and returns a URL the frontend can play.

    Supabase Storage first (works on any serverless host), then local disk for
    dev, then inline base64 as a last resort so a render is never dropped.
    """
    filename = f"omni_{uuid.uuid4().hex[:12]}.mp4"

    cloud_url = _upload_bytes_to_supabase(
        video_bytes, filename, folder="videos", content_type="video/mp4"
    )
    if cloud_url:
        return cloud_url

    try:
        target_dir = Path(__file__).resolve().parent.parent.parent.parent / "web" / "public" / "videos"
        if target_dir.parent.exists():
            target_dir.mkdir(parents=True, exist_ok=True)
            (target_dir / filename).write_bytes(video_bytes)
            logger.info("[Omni] Saved locally (no Supabase): /videos/%s", filename)
            return f"/videos/{filename}"
    except OSError as write_err:
        logger.info("[Omni] Local disk write skipped: %s", write_err)

    logger.info(
        "[Omni] Packaged %d bytes as base64 data URI for cloud persistence via Next.js proxy",
        len(video_bytes),
    )
    return f"data:video/mp4;base64,{base64.b64encode(video_bytes).decode('utf-8')}"


def run_omni_video_interaction(
    client: "genai.Client",
    *,
    input_payload: str | list[dict[str, Any]],
    aspect_ratio: str = "16:9",
    resolution: str | None = None,
    previous_interaction_id: str | None = None,
    task: str | None = None,
    response_format: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Blocking Interactions API call for generation, editing or extension.

    Synchronous by nature — callers on the event loop must hand this to
    `asyncio.to_thread` (see `_start_omni_job` and the video sequencer).
    """
    if response_format is None:
        response_format = _omni_response_format(aspect_ratio, resolve_video_resolution(resolution))

    kwargs: dict[str, Any] = {
        "model": get_settings().omni_video_model,
        "input": input_payload,
        "response_format": response_format,
    }
    if previous_interaction_id:
        kwargs["previous_interaction_id"] = previous_interaction_id
    elif task and task in _OMNI_TASKS:
        # `task` and `previous_interaction_id` are mutually exclusive — the API
        # rejects the pair outright with "previous_interaction_id is not allowed
        # when video task is set". A turn that references a prior interaction is
        # already an edit/extension by construction, so the hint is redundant
        # there anyway. It is still useful for a first turn that carries a video
        # or image input and would otherwise be ambiguous.
        kwargs["generation_config"] = {"video_config": {"task": task}}

    interaction = client.interactions.create(**kwargs)
    video_bytes = _omni_extract_video_bytes(client, interaction)

    return {
        "interaction_id": getattr(interaction, "id", None),
        "video_url": _persist_omni_video(video_bytes),
    }


def _start_omni_job(
    runner: Callable[[], dict[str, Any]],
    *,
    aspect_ratio: str = "16:9",
) -> OmniVideoJob:
    """Registers a job and runs `runner` — a blocking Omni call — off the event loop."""
    _prune_omni_jobs()

    job = OmniVideoJob(job_id=f"omni-{uuid.uuid4().hex[:12]}")
    _OMNI_JOBS[job.job_id] = job

    async def _execute() -> None:
        job.status = "running"
        job.updated_at = time.time()
        try:
            result = await asyncio.to_thread(runner)
            job.video_url = result.get("video_url")
            job.interaction_id = result.get("interaction_id")
            job.status = "completed"
            OMNI_VIDEO_RENDERS_TOTAL.labels(aspect_ratio=aspect_ratio, status="completed").inc()
        except Exception as exc:  # noqa: BLE001
            logger.error("Omni video job %s failed: %s", job.job_id, exc)
            job.status = "error"
            job.error = str(exc)
            OMNI_VIDEO_RENDERS_TOTAL.labels(aspect_ratio=aspect_ratio, status="error").inc()
        finally:
            job.updated_at = time.time()

    task = asyncio.create_task(_execute())
    _OMNI_RUNNING_TASKS.add(task)
    task.add_done_callback(_OMNI_RUNNING_TASKS.discard)
    return job


def _collect_conditioning_images(req: GenerateVideoRequest) -> list[tuple[bytes, str]]:
    """Resolves the ordered conditioning images for a render.

    First/last frame (interpolation) come first so the model sees them in the
    documented order, followed by a general reference image.
    """
    images: list[tuple[bytes, str]] = []
    for url in (req.first_frame_url, req.last_frame_url, req.image_url):
        raw, mime = resolve_image_bytes(url)
        if raw:
            images.append((raw, mime or "image/jpeg"))
    return images


def _upload_bytes_to_supabase(
    media_bytes: bytes,
    filename: str,
    folder: str = "videos",
    content_type: str = "video/mp4",
) -> str | None:
    """Upload raw media bytes directly to Supabase Storage via REST API.
    Returns the public URL on success, or None if Supabase is not configured.
    """
    supabase_url = (
        os.environ.get("SUPABASE_URL")
        or os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
        or getattr(get_settings(), "supabase_url", "")
    )
    supabase_key = (
        os.environ.get("SUPABASE_SECRET_KEY")
        or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        or os.environ.get("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
        or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")
        or getattr(get_settings(), "supabase_secret_key", "")
    )

    if not supabase_url or not supabase_key:
        logger.warning("[Supabase] Supabase not configured in agent service — media will be returned inline for cloud persistence")
        return None

    bucket = "cinema_assets"
    storage_path = f"{folder}/{filename}"
    upload_url = f"{supabase_url.rstrip('/')}/storage/v1/object/{bucket}/{storage_path}"

    try:
        with httpx.Client(timeout=120) as http:
            resp = http.post(
                upload_url,
                content=media_bytes,
                headers={
                    "apikey": supabase_key,
                    "Authorization": f"Bearer {supabase_key}",
                    "Content-Type": content_type,
                    "x-upsert": "true",
                },
            )
            if resp.status_code in (200, 201):
                # Always hand back the permanent public URL. `cinema_assets` is a
                # public bucket, so this carries no credential and never expires.
                # A signed URL (`.../object/sign/...?token=<jwt>`) would embed a
                # time-limited JWT that lapses days later and presents as data
                # loss — the web layer's lib/media-url.ts normalises defensively,
                # but the invariant has to hold here too.
                public_url = f"{supabase_url.rstrip('/')}/storage/v1/object/public/{bucket}/{storage_path}"
                logger.info("[Supabase] Uploaded %s to Supabase: %s", filename, public_url)
                return public_url
            else:
                logger.error("[Supabase] Upload failed (%s): %s", resp.status_code, resp.text[:300])
                return None
    except Exception as exc:  # noqa: BLE001
        logger.error("[Supabase] Upload exception: %s", exc)
        return None


@router.post("/video", response_model=GenerateVideoResponse)
async def generate_video(req: GenerateVideoRequest):
    """Start a cinematic Gemini Omni Flash render and return its job id.

    Supports text-to-video, image-to-video, reference-to-video, and first/last
    frame interpolation (supply both frame URLs).
    """
    settings = get_settings()
    if not settings.google_api_key:
        raise HTTPException(status_code=500, detail="GOOGLE_API_KEY not configured")

    aspect_ratio = _resolve_aspect_ratio(req.aspect_ratio)

    prompt = _build_omni_video_prompt(
        req.prompt,
        style_preset=req.style_preset,
        character_name=req.character_name,
    )
    if req.first_frame_url and req.last_frame_url:
        prompt = f"<FIRST_FRAME> <LAST_FRAME> {prompt}"

    images = _collect_conditioning_images(req)
    client = genai.Client(api_key=settings.google_api_key)

    job = _start_omni_job(
        lambda: run_omni_video_interaction(
            client,
            input_payload=build_video_input(prompt, images),
            aspect_ratio=aspect_ratio,
            resolution=req.resolution,
            task=req.task,
        ),
        aspect_ratio=aspect_ratio,
    )
    return GenerateVideoResponse(
        operation_name=job.job_id,
        prompt=req.prompt,
        status=job.status,
    )


@router.get("/video/status")
async def get_video_status(operation_name: str):
    """Report the state of a Gemini Omni Flash render job."""
    if not operation_name:
        raise HTTPException(status_code=400, detail="Missing operation_name")

    job = get_omni_video_job(operation_name)
    if not job:
        raise HTTPException(status_code=404, detail="Video job not found or expired")

    return {
        "status": job.status,
        "video_url": job.video_url,
        "interaction_id": job.interaction_id,
        "error": job.error,
    }


@router.post("/video/edit", response_model=GenerateVideoResponse)
async def edit_video(req: EditVideoRequest):
    """Edit an existing clip through conversation.

    Each turn builds on the source clip and returns a new render, preserving
    everything the instruction doesn't mention. Simple instructions work best —
    over-described edits tend to change more than intended.

    Acts on either a clip this service rendered (`interaction_id`) or a
    user-supplied one (`video_url`, uploaded via the Files API).
    """
    settings = get_settings()
    if not settings.google_api_key:
        raise HTTPException(status_code=500, detail="GOOGLE_API_KEY not configured")

    if not req.interaction_id and not req.video_url:
        raise HTTPException(
            status_code=400,
            detail="Provide either interaction_id (a clip rendered here) or video_url (an uploaded clip)",
        )

    instruction = sanitize_video_prompt(req.instruction).strip()
    if not instruction:
        raise HTTPException(status_code=400, detail="instruction is required")

    aspect_ratio = _resolve_aspect_ratio(req.aspect_ratio)
    client = genai.Client(api_key=settings.google_api_key)

    def _run() -> dict[str, Any]:
        source = _resolve_conversational_source(
            client,
            interaction_id=req.interaction_id,
            video_url=req.video_url,
            prompt=instruction,
        )
        return run_omni_video_interaction(
            client,
            **source,
            task="edit",
            response_format={"type": "video"},
        )

    job = _start_omni_job(_run, aspect_ratio=aspect_ratio)
    return GenerateVideoResponse(
        operation_name=job.job_id,
        prompt=req.instruction,
        status=job.status,
    )


@router.post("/video/extend", response_model=GenerateVideoResponse)
async def extend_video(req: ExtendVideoRequest):
    """Continue an existing clip from its tail.

    Extension is append-only: Omni uses the last 10s of the source clip as
    context and generates a 3-10s continuation, up to a 40s total. Prepending
    or extending the middle of a clip is not supported by the model.

    Acts on either a clip this service rendered (`interaction_id`) or a
    user-supplied one (`video_url`, uploaded via the Files API). An uploaded
    clip whose subject is talking cannot be extended with new dialogue.
    """
    settings = get_settings()
    if not settings.google_api_key:
        raise HTTPException(status_code=500, detail="GOOGLE_API_KEY not configured")

    if not req.interaction_id and not req.video_url:
        raise HTTPException(
            status_code=400,
            detail="Provide either interaction_id (a clip rendered here) or video_url (an uploaded clip)",
        )

    prompt = sanitize_video_prompt(req.prompt).strip() or "Continue the scene."
    aspect_ratio = _resolve_aspect_ratio(req.aspect_ratio)
    client = genai.Client(api_key=settings.google_api_key)

    def _run() -> dict[str, Any]:
        source = _resolve_conversational_source(
            client,
            interaction_id=req.interaction_id,
            video_url=req.video_url,
            prompt=prompt,
        )
        return run_omni_video_interaction(
            client,
            **source,
            task="extend",
            response_format={"type": "video"},
        )

    job = _start_omni_job(_run, aspect_ratio=aspect_ratio)
    return GenerateVideoResponse(
        operation_name=job.job_id,
        prompt=req.prompt,
        status=job.status,
    )


def _create_cinematic_fallback_score(duration_sec: float = 6.0, sample_rate: int = 24000) -> bytes:
    """Synthesize a rich, warm cinematic ambient drone chord (D-minor / A-minor cinematic chord) in 16-bit PCM."""
    import math

    num_samples = int(sample_rate * duration_sec)
    pcm = bytearray()
    # D2 (73.42Hz), A2 (110Hz), F3 (174.61Hz), C4 (261.63Hz), E4 (329.63Hz)
    freqs = [73.42, 110.0, 174.61, 261.63, 329.63]

    for i in range(num_samples):
        t = i / sample_rate
        # Gentle fade-in (1.5s) and fade-out (2.0s) envelope
        envelope = 1.0
        if t < 1.5:
            envelope = t / 1.5
        elif t > (duration_sec - 2.0):
            envelope = (duration_sec - t) / 2.0

        sample_val = 0.0
        for idx, f in enumerate(freqs):
            # Add subtle slow chorusing / phasing LFO
            lfo = 1.0 + 0.03 * math.sin(2 * math.pi * 0.25 * t + idx)
            amplitude = (0.25 / (idx + 1)) * envelope
            sample_val += amplitude * math.sin(2 * math.pi * f * lfo * t)

        # Soft clip and convert to signed 16-bit
        clamped = max(-1.0, min(1.0, sample_val))
        val_int = int(clamped * 30000)
        pcm.extend(val_int.to_bytes(2, byteorder="little", signed=True))

    return pcm_to_wav(bytes(pcm), sample_rate=sample_rate)


class GenerateMusicRequest(BaseModel):
    prompt: str = Field(..., description="Cinematic music prompt describing genre, mood, instrumentation, and dynamics")
    duration_mode: str = Field(default="clip", description="'clip' (30s via lyria-3-clip-preview) or 'pro' (up to 3 min via lyria-3-pro-preview)")
    duration_seconds: float | None = Field(default=None, description="Requested duration in seconds (e.g. 5 to 180)")
    image_url: str | None = Field(default=None, description="Optional scene keyframe or concept image for visual mood conditioning")
    image_urls: list[str] = Field(default_factory=list, description="Up to 10 moodboard/keyframe images for multimodal conditioning")
    lyrics: str | None = Field(default=None, description="Optional custom lyrics / song structure [Verse], [Chorus]")
    language: str | None = Field(default="English", description="Target language for vocals (English, Spanish, French, etc.)")
    response_modalities: list[str] = Field(default_factory=lambda: ["AUDIO", "TEXT"], description="Modalities: ['AUDIO', 'TEXT'], ['AUDIO'], or ['TEXT']")
    stream: bool = Field(default=False, description="Whether to stream response events")


class GenerateMusicResponse(BaseModel):
    audio_url: str
    prompt: str
    model: str
    duration_mode: str
    lyrics_text: str | None = None
    duration_estimate_sec: float
    fallback: bool = False


@router.post("/music", response_model=GenerateMusicResponse)
async def generate_music(req: GenerateMusicRequest):
    """Generate high-fidelity cinematic score or soundtrack using Google Lyria 3 models.

    Supports multimodal visual conditioning from up to 10 moodboard images, custom lyrics, and flexible duration.
    """
    settings = get_settings()
    api_key = settings.google_api_key

    # Pick appropriate Lyria model based on duration_seconds or duration_mode
    if req.duration_seconds and req.duration_seconds > 0:
        target_duration = float(req.duration_seconds)
        model_name = "lyria-3-pro-preview" if target_duration > 30.0 else "lyria-3-clip-preview"
        resolved_duration_mode = "pro" if target_duration > 30.0 else "clip"
    else:
        model_name = "lyria-3-pro-preview" if req.duration_mode == "pro" else "lyria-3-clip-preview"
        target_duration = 180.0 if req.duration_mode == "pro" else 30.0
        resolved_duration_mode = req.duration_mode

    # Format text prompt incorporating style, duration hint, language, and lyrics
    composed_prompt = req.prompt.strip()
    if req.duration_seconds and req.duration_seconds > 0:
        composed_prompt = f"{composed_prompt}. Target cue duration: exactly {int(target_duration)} seconds, timed with a natural musical ending cadence."

    if req.language and req.language.lower() != "english":
        composed_prompt = f"{composed_prompt}. Language of vocal delivery: {req.language}."

    if req.lyrics:
        composed_prompt = f"{composed_prompt}\n\nLyrics:\n{req.lyrics.strip()}"

    # Multimodal image conditioning: aggregate up to 10 distinct moodboard images
    all_image_candidates: list[str] = []
    if req.image_url:
        all_image_candidates.append(req.image_url)
    for u in req.image_urls:
        if u and u not in all_image_candidates:
            all_image_candidates.append(u)
    all_image_candidates = all_image_candidates[:10]

    # Validate response modalities
    raw_modalities = req.response_modalities or ["AUDIO", "TEXT"]
    modalities = [m.upper() for m in raw_modalities if m.upper() in ("AUDIO", "TEXT")]
    if not modalities:
        modalities = ["AUDIO", "TEXT"]

    if api_key:
        try:
            from google.genai import types

            client = genai.Client(api_key=api_key)

            contents: list[Any] = []
            for img_url in all_image_candidates:
                img_bytes, mime = resolve_image_bytes(img_url)
                if img_bytes:
                    contents.append(
                        types.Part.from_bytes(
                            data=img_bytes,
                            mime_type=mime or "image/jpeg",
                        )
                    )

            if len(contents) > 0:
                logger.info("Conditioning Lyria 3 with %d moodboard images", len(contents))

            contents.append(composed_prompt)

            res = client.models.generate_content(
                model=model_name,
                contents=contents,
                config=types.GenerateContentConfig(
                    response_modalities=modalities,
                    safety_settings=CINEMA_SAFETY_SETTINGS,
                ),
            )

            extracted_text = None
            audio_bytes = None
            audio_mime = "audio/mp3"

            if res and res.candidates and res.candidates[0].content and res.candidates[0].content.parts:
                for part in res.candidates[0].content.parts:
                    if part.text:
                        extracted_text = (extracted_text or "") + "\n" + part.text.strip()
                    if part.inline_data and part.inline_data.data:
                        audio_bytes = part.inline_data.data
                        if part.inline_data.mime_type:
                            audio_mime = part.inline_data.mime_type

            # If user requested TEXT only (lyrics/arrangement breakdown)
            if "AUDIO" not in modalities:
                return GenerateMusicResponse(
                    audio_url="",
                    prompt=req.prompt,
                    model=model_name,
                    duration_mode=resolved_duration_mode,
                    lyrics_text=extracted_text or "Lyrics & arrangement preview generated.",
                    duration_estimate_sec=target_duration,
                    fallback=False,
                )

            if audio_bytes:
                file_id = uuid.uuid4().hex[:12]
                ext = "mp3" if "mp3" in audio_mime or "mpeg" in audio_mime else "wav"
                filename = f"score_{file_id}.{ext}"
                mime_for_upload = "audio/mpeg" if ext == "mp3" else "audio/wav"

                # Try Supabase first (Vercel-safe, no disk needed)
                cloud_url = _upload_bytes_to_supabase(audio_bytes, filename, folder="audio/scores", content_type=mime_for_upload)
                if cloud_url:
                    audio_url = cloud_url
                else:
                    # Local dev fallback
                    try:
                        target_dir = Path(__file__).resolve().parent.parent.parent.parent / "web" / "public" / "audio" / "scores"
                        target_dir.mkdir(parents=True, exist_ok=True)
                        (target_dir / filename).write_bytes(audio_bytes)
                        audio_url = f"/audio/scores/{filename}"
                    except OSError:
                        b64 = base64.b64encode(audio_bytes).decode("utf-8")
                        audio_url = f"data:{mime_for_upload};base64,{b64}"

                return GenerateMusicResponse(
                    audio_url=audio_url,
                    prompt=req.prompt,
                    model=model_name,
                    duration_mode=resolved_duration_mode,
                    lyrics_text=extracted_text,
                    duration_estimate_sec=target_duration,
                    fallback=False,
                )
        except Exception as e:  # noqa: BLE001
            logger.warning("Lyria 3 music generation call failed (%s). Falling back to atmospheric cinematic synthesizer.", e)

    # High-quality cinematic fallback ambient score
    logger.info("Providing synthetic cinematic ambient score fallback.")
    fallback_wav = _create_cinematic_fallback_score(duration_sec=min(target_duration, 30.0 if resolved_duration_mode == "clip" else 180.0))
    file_id = uuid.uuid4().hex[:12]
    filename = f"score_fallback_{file_id}.wav"

    # Try Supabase first (Vercel-safe)
    cloud_url = _upload_bytes_to_supabase(fallback_wav, filename, folder="audio/scores", content_type="audio/wav")
    if cloud_url:
        audio_url = cloud_url
    else:
        # Local dev fallback
        try:
            target_dir = Path(__file__).resolve().parent.parent.parent.parent / "web" / "public" / "audio" / "scores"
            target_dir.mkdir(parents=True, exist_ok=True)
            (target_dir / filename).write_bytes(fallback_wav)
            audio_url = f"/audio/scores/{filename}"
        except OSError:
            b64_wav = base64.b64encode(fallback_wav).decode("utf-8")
            audio_url = f"data:audio/wav;base64,{b64_wav}"

    return GenerateMusicResponse(
        audio_url=audio_url,
        prompt=req.prompt,
        model=f"{model_name}-ambient-synth",
        duration_mode=resolved_duration_mode,
        lyrics_text=req.lyrics or "Instrumental Cinematic Score [Atmospheric Tone]",
        duration_estimate_sec=target_duration,
        fallback=True,
    )


@router.post("/music/stream")
async def stream_music(req: GenerateMusicRequest):
    """Stream Lyria 3 music generation events (lyrics and audio deltas) in real-time via SSE."""
    settings = get_settings()
    api_key = settings.google_api_key

    target_duration = float(req.duration_seconds) if req.duration_seconds and req.duration_seconds > 0 else (180.0 if req.duration_mode == "pro" else 30.0)
    model_name = "lyria-3-pro-preview" if target_duration > 30.0 else "lyria-3-clip-preview"

    composed_prompt = req.prompt.strip()
    if req.duration_seconds and req.duration_seconds > 0:
        composed_prompt = f"{composed_prompt}. Target cue duration: exactly {int(target_duration)} seconds, timed with a natural musical ending cadence."
    if req.language and req.language.lower() != "english":
        composed_prompt = f"{composed_prompt}. Language of vocal delivery: {req.language}."
    if req.lyrics:
        composed_prompt = f"{composed_prompt}\n\nLyrics:\n{req.lyrics.strip()}"

    async def event_generator():
        yield f"data: {json.dumps({'type': 'status', 'message': f'Connecting to {model_name} live stream...'})}\n\n"

        if api_key:
            try:
                client = genai.Client(api_key=api_key)
                stream = client.interactions.create(
                    model=model_name,
                    input=composed_prompt,
                    stream=True,
                )
                for event in stream:
                    if getattr(event, "event_type", "") == "content.delta":
                        delta_dict = event.delta if isinstance(event.delta, dict) else getattr(event, "delta", {})
                        if delta_dict.get("text"):
                            yield f"data: {json.dumps({'type': 'text_delta', 'text': delta_dict['text']})}\n\n"
                        if delta_dict.get("data"):
                            yield f"data: {json.dumps({'type': 'audio_delta', 'data': delta_dict['data'], 'mime_type': delta_dict.get('mime_type', 'audio/mp3')})}\n\n"

                yield f"data: {json.dumps({'type': 'done', 'model': model_name, 'duration_sec': target_duration})}\n\n"
                return
            except Exception as e:  # noqa: BLE001
                logger.warning("Lyria streaming failed: %s, falling back to local simulation", e)
                yield f"data: {json.dumps({'type': 'status', 'message': f'Streaming fallback ({e})'})}\n\n"

        # Fallback simulation of real-time streaming deltas
        lyrics_mock = req.lyrics or f"[Intro]\nAtmospheric cinematic score in {req.language}...\n\n[Verse 1]\nEchoes in the quiet night,\nSearching for the morning light."
        import asyncio
        for word in lyrics_mock.split(" "):
            yield f"data: {json.dumps({'type': 'text_delta', 'text': word + ' '})}\n\n"
            await asyncio.sleep(0.04)

        fallback_wav = _create_cinematic_fallback_score(duration_sec=min(target_duration, 180.0))
        b64_wav = base64.b64encode(fallback_wav).decode("utf-8")
        yield f"data: {json.dumps({'type': 'audio_delta', 'data': b64_wav, 'mime_type': 'audio/wav'})}\n\n"
        yield f"data: {json.dumps({'type': 'done', 'model': f'{model_name}-ambient-synth', 'duration_sec': target_duration, 'fallback': True})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

