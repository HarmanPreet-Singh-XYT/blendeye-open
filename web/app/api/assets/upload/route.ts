import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { getSupabaseAdminClient, getSupabaseClient, isSupabaseConfigured, getAuthUserFromHeader } from "@/lib/supabase";
import { upsertAssetToSupabase, type CinemaAsset } from "@/lib/supabase-store";
import { normalizeMediaUrl } from "@/lib/media-url";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const requestedName = (formData.get("name") as string | null) || "";
    const category = ((formData.get("category") as string | null) || "general") as CinemaAsset["category"];
    const projectId = (formData.get("projectId") as string | null) || undefined;
    const tagsRaw = formData.get("tags") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const authUser = await getAuthUserFromHeader(req.headers.get("authorization"));
    const userId = authUser?.id || null;

    let parsedTags: string[] = [];
    if (tagsRaw) {
      try {
        parsedTags = JSON.parse(tagsRaw);
      } catch {
        parsedTags = tagsRaw.split(",").map((t) => t.trim()).filter(Boolean);
      }
    }

    // Determine type
    const mime = file.type || "application/octet-stream";
    let assetType: CinemaAsset["type"] = "image";
    if (mime.startsWith("video/")) {
      assetType = "video";
    } else if (mime.startsWith("audio/")) {
      assetType = "audio";
    } else if (category === "map" || mime.includes("svg") || mime.includes("pdf")) {
      assetType = "map";
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const originalName = file.name || "unnamed_asset";
    const displayName = requestedName.trim() || originalName.replace(/\.[^/.]+$/, "");
    const safeExt = path.extname(originalName) || (mime.startsWith("video/") ? ".mp4" : ".png");
    const uniqueFileName = `${Date.now()}_${originalName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

    let publicUrl = "";
    let uploadedToCloud = false;

    // 1. Try Supabase Storage
    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseAdminClient() || getSupabaseClient();
        if (client) {
          const userFolder = userId ? `users/${userId}` : "shared";
          const storagePath = `uploads/${userFolder}/${uniqueFileName}`;
          const { error: uploadError } = await client.storage
            .from("cinema_assets")
            .upload(storagePath, buffer, {
              contentType: mime,
              upsert: true,
            });

          if (!uploadError) {
            const { data: urlData } = client.storage.from("cinema_assets").getPublicUrl(storagePath);
            if (urlData?.publicUrl) {
              publicUrl = normalizeMediaUrl(urlData.publicUrl);
              uploadedToCloud = true;
            }
          } else {
            console.warn("[Upload API] Supabase storage upload warning:", uploadError.message);
          }
        }
      } catch (err) {
        console.warn("[Upload API] Cloud storage exception, using local disk fallback:", err);
      }
    }

    // 2. Local disk fallback if not uploaded to cloud
    if (!publicUrl) {
      const userFolder = userId ? `users/${userId}` : "shared";
      const publicUploadsDir = path.join(process.cwd(), "public", "uploads", "assets", userFolder);
      await mkdir(publicUploadsDir, { recursive: true });
      const localFilePath = path.join(publicUploadsDir, uniqueFileName);
      await writeFile(localFilePath, buffer);
      publicUrl = `/uploads/assets/${userFolder}/${uniqueFileName}`;
    }

    const assetId = `asset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const asset: CinemaAsset = {
      id: assetId,
      userId,
      projectId,
      name: displayName,
      type: assetType,
      category,
      url: publicUrl,
      thumbnailUrl: assetType === "image" || assetType === "map" ? publicUrl : null,
      sizeBytes: buffer.length,
      mimeType: mime,
      tags: parsedTags,
      metadata: {
        originalFileName: originalName,
        uploadedToCloud,
        extension: safeExt,
      },
      createdAt: Date.now(),
    };

    // Save metadata to Supabase if configured
    if (isSupabaseConfigured()) {
      await upsertAssetToSupabase(asset, userId);
    }

    return NextResponse.json({
      success: true,
      asset,
      uploadedToCloud,
    });
  } catch (err) {
    console.error("[Upload API] Error processing upload:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to upload asset" },
      { status: 500 }
    );
  }
}
