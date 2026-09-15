import { NextRequest, NextResponse } from "next/server";
import { editMediaVideo } from "@/lib/agent-service";

/**
 * Conversational video edit. Each turn builds on the source clip and returns a
 * render job id that is polled through /api/media/video/status, same as a fresh
 * generation.
 *
 * The source is either `interaction_id` (a clip this render pipeline produced,
 * edited in place with no re-upload) or `video_url` (a user-supplied clip,
 * uploaded to the model's Files API). Uploaded clips must be 10s or shorter,
 * and editing them is unavailable in the EEA, Switzerland and the UK.
 */
export async function POST(req: NextRequest) {
  try {
    const { interaction_id, video_url, instruction, aspect_ratio } = await req.json();

    if (!interaction_id && !video_url) {
      return NextResponse.json(
        { error: "Provide either interaction_id (a render from here) or video_url (an uploaded clip)" },
        { status: 400 }
      );
    }
    if (!instruction) {
      return NextResponse.json({ error: "Missing instruction" }, { status: 400 });
    }

    const result = await editMediaVideo({
      instruction,
      interactionId: interaction_id,
      videoUrl: video_url,
      aspectRatio: aspect_ratio === "9:16" ? "9:16" : "16:9",
    });
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Gemini Omni Flash video edit error:", message);
    return NextResponse.json(
      { operation_name: null, status: "error", error: message },
      { status: 502 }
    );
  }
}
