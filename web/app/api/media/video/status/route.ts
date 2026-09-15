import { NextRequest, NextResponse } from "next/server";
import { getVideoStatus } from "@/lib/agent-service";
import { persistLocalMediaToBucket, persistDataUriToBucket } from "@/lib/media-storage-service";
import { normalizeMediaUrl } from "@/lib/media-url";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const operationName = searchParams.get("operation_name");

  if (!operationName) {
    return NextResponse.json({ error: "Missing operation_name" }, { status: 400 });
  }

  try {
    const result = await getVideoStatus(operationName);
    if (result && result.status === "completed" && result.video_url) {
      // If the agent service already pushed to Supabase (cloud URL), use it as-is.
      // Only attempt local→Supabase migration for the dev-fallback /videos/ path.
      if (!result.video_url.startsWith("http://") && !result.video_url.startsWith("https://")) {
        const renderName = `Omni Render: ${operationName.slice(0, 12)}`;
        const meta = {
          name: renderName,
          category: "video" as const,
          targetFolder: "videos" as const,
          mimeType: "video/mp4",
          tags: ["omni-flash", "video-take", "ai-generated"],
          metadata: { operationName },
        };
        if (result.video_url.startsWith("data:")) {
          const { publicUrl } = await persistDataUriToBucket(result.video_url, meta);
          if (publicUrl) {
            result.video_url = publicUrl;
          }
        } else {
          const { publicUrl } = await persistLocalMediaToBucket(result.video_url, meta);
          if (publicUrl) {
            result.video_url = publicUrl;
          }
        }
      }
      // The client persists whatever URL it receives into the take vault, so
      // hand back only the permanent public form — never a signed/expiring one.
      result.video_url = normalizeMediaUrl(result.video_url);
    }
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        status: "error",
        error: message,
        video_url: null,
      },
      { status: 502 }
    );
  }
}
