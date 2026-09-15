import { NextRequest, NextResponse } from "next/server";
import { extendMediaVideo } from "@/lib/agent-service";

/**
 * Extends an existing clip from its tail. Append-only — the model uses the last
 * 10s of the source as context. Returns a render job id polled through
 * /api/media/video/status.
 *
 * The source is either `interaction_id` (a clip this render pipeline produced)
 * or `video_url` (a user-supplied clip, uploaded to the model's Files API).
 * Uploaded clips must be 10s or shorter, cannot be extended with new dialogue
 * when the subject is talking, and extension is unavailable in the EEA,
 * Switzerland and the UK.
 */
export async function POST(req: NextRequest) {
  try {
    const { interaction_id, video_url, prompt, aspect_ratio } = await req.json();

    if (!interaction_id && !video_url) {
      return NextResponse.json(
        { error: "Provide either interaction_id (a render from here) or video_url (an uploaded clip)" },
        { status: 400 }
      );
    }

    const result = await extendMediaVideo({
      interactionId: interaction_id,
      videoUrl: video_url,
      prompt: prompt || "Continue the scene.",
      aspectRatio: aspect_ratio === "9:16" ? "9:16" : "16:9",
    });
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Gemini Omni Flash video extension error:", message);
    return NextResponse.json(
      { operation_name: null, status: "error", error: message },
      { status: 502 }
    );
  }
}
