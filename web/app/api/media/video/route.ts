import { NextRequest, NextResponse } from "next/server";
import { generateMediaVideo } from "@/lib/agent-service";
import { getCachedGeneration, setCachedGeneration } from "@/lib/generation-cache";
import { normalizeMediaUrl } from "@/lib/media-url";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      prompt,
      resolution,
      style_preset,
      image_url,
      first_frame_url,
      last_frame_url,
      character_name,
      aspect_ratio,
      task,
    } = body;

    if (!prompt) {
      return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
    }

    // Gemini Omni Flash renders landscape or portrait only; anything else
    // (e.g. the 2.39:1 anamorphic style) falls back to 16:9, since that look
    // is a prompt-level aesthetic rather than a supported output ratio.
    const resolvedAspectRatio = aspect_ratio === "9:16" ? "9:16" : "16:9";

    const cachePayload = {
      prompt: prompt.trim(),
      resolution: resolution || null,
      style_preset: style_preset || "35mm Anamorphic Film",
      image_url: image_url || null,
      first_frame_url: first_frame_url || null,
      last_frame_url: last_frame_url || null,
      character_name: character_name || null,
      aspect_ratio: resolvedAspectRatio,
      task: task || null,
    };

    const cached = await getCachedGeneration<any>("video", cachePayload);
    if (cached && (cached.video_url || cached.status === "completed")) {
      return NextResponse.json({ ...cached, _cached: true });
    }

    const result = await generateMediaVideo({
      prompt,
      resolution,
      stylePreset: style_preset,
      imageUrl: image_url,
      firstFrameUrl: first_frame_url,
      lastFrameUrl: last_frame_url,
      characterName: character_name,
      aspectRatio: resolvedAspectRatio,
      task,
    });
    if (result && typeof result.video_url === "string") {
      // Never let a time-limited URL reach (or be cached for) the client, which
      // persists it into the take vault.
      result.video_url = normalizeMediaUrl(result.video_url);
    }
    if (result && (result.video_url || result.status === "completed")) {
      await setCachedGeneration("video", cachePayload, result);
    }
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Gemini Omni Flash video generation error:", message);

    return NextResponse.json(
      {
        operation_name: null,
        status: "error",
        error: message,
      },
      { status: 502 }
    );
  }
}
