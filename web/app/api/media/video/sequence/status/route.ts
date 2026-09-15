import { NextRequest, NextResponse } from "next/server";
import { getVideoSequenceStatus } from "@/lib/agent-service";
import { persistLocalMediaToBucket, persistDataUriToBucket } from "@/lib/media-storage-service";
import { normalizeMediaUrl } from "@/lib/media-url";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("job_id");

  if (!jobId) {
    return NextResponse.json({ error: "Missing job_id" }, { status: 400 });
  }

  try {
    const result = await getVideoSequenceStatus(jobId);
    if (result && Array.isArray(result.shots)) {
      for (const shot of result.shots) {
        if (shot.status === "completed" && shot.video_url && !shot.video_url.startsWith("http")) {
          if (shot.video_url.startsWith("data:")) {
            const { publicUrl } = await persistDataUriToBucket(shot.video_url, {
              name: `Omni Sequence ${jobId.slice(0, 8)} Shot ${shot.shot_number}`,
              category: "video",
              targetFolder: "videos",
              mimeType: "video/mp4",
              tags: ["omni-sequence", "shot-chain", "ai-generated"],
              metadata: { jobId, shotNumber: shot.shot_number },
            });
            if (publicUrl) {
              shot.video_url = publicUrl;
            }
          } else {
            const { publicUrl } = await persistLocalMediaToBucket(shot.video_url, {
              name: `Omni Sequence ${jobId.slice(0, 8)} Shot ${shot.shot_number}`,
              category: "video",
              targetFolder: "videos",
              mimeType: "video/mp4",
              tags: ["omni-sequence", "shot-chain", "ai-generated"],
              metadata: { jobId, shotNumber: shot.shot_number },
            });
            if (publicUrl) {
              shot.video_url = publicUrl;
            }
          }
        }
        // Shot URLs land in the shot manifest the client stores, so normalise
        // every one of them — including the already-cloud ones.
        if (shot.video_url) {
          shot.video_url = normalizeMediaUrl(shot.video_url);
        }
      }
    }
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ status: "error", error: message }, { status: 502 });
  }
}
