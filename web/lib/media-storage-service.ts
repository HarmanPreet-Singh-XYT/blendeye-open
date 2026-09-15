import path from "node:path";
import { promises as fs } from "node:fs";
import { getSupabaseAdminClient, getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import { upsertAssetToSupabase, type CinemaAsset } from "@/lib/supabase-store";
import { normalizeMediaUrl } from "@/lib/media-url";

export const CINEMA_ASSETS_BUCKET = "cinema_assets";

export interface UploadMediaOptions {
  name: string;
  category: CinemaAsset["category"];
  targetFolder: "videos" | "audio/scores" | "audio/tts" | "images" | "uploads";
  projectId?: string;
  userId?: string | null;
  mimeType?: string;
  tags?: string[];
  metadata?: Record<string, any>;
  filename?: string;
}

let bucketChecked = false;

async function ensureBucketExists(client: any) {
  if (bucketChecked) return;
  try {
    const { data: buckets } = await client.storage.listBuckets();
    const exists = buckets?.some((b: any) => b.id === CINEMA_ASSETS_BUCKET || b.name === CINEMA_ASSETS_BUCKET);
    if (!exists) {
      await client.storage.createBucket(CINEMA_ASSETS_BUCKET, {
        public: true,
        fileSizeLimit: 104857600, // 100MB
      });
    }
    bucketChecked = true;
  } catch (err) {
    // Non-fatal if client lacks admin bucket creation privileges
  }
}

/**
 * Uploads a raw buffer to the Supabase cinema_assets storage bucket.
 * Returns the permanent public URL on success, or null if unconfigured/failed.
 */
export async function uploadBufferToStorage(
  buffer: Buffer,
  storagePath: string,
  contentType: string
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const client = getSupabaseAdminClient() || getSupabaseClient();
    if (!client) return null;

    await ensureBucketExists(client);

    let { error } = await client.storage
      .from(CINEMA_ASSETS_BUCKET)
      .upload(storagePath, buffer, {
        contentType,
        upsert: true,
      });

    // If bucket was missing, attempt creation and retry once
    if (error && error.message?.toLowerCase().includes("not found")) {
      try {
        await client.storage.createBucket(CINEMA_ASSETS_BUCKET, { public: true });
        const retry = await client.storage
          .from(CINEMA_ASSETS_BUCKET)
          .upload(storagePath, buffer, {
            contentType,
            upsert: true,
          });
        error = retry.error;
      } catch {
        // ignore
      }
    }

    if (error) {
      console.warn(`[MediaStorage] Storage upload warning for ${storagePath}:`, error.message);
      return null;
    }

    const { data } = client.storage.from(CINEMA_ASSETS_BUCKET).getPublicUrl(storagePath);
    // getPublicUrl already yields the permanent form; normalising here keeps
    // that true even if a future change swaps in a signed URL.
    return data?.publicUrl ? normalizeMediaUrl(data.publicUrl) : null;
  } catch (err) {
    console.warn(`[MediaStorage] Storage exception for ${storagePath}:`, err);
    return null;
  }
}

/**
 * Ingests a local file (e.g. `/videos/omni_*.mp4` or `/audio/scores/*.mp3`),
 * uploads it to the Supabase bucket, and catalogs it into public.assets.
 */
export async function persistLocalMediaToBucket(
  localUrlOrPath: string,
  options: UploadMediaOptions
): Promise<{ publicUrl: string; asset?: CinemaAsset; uploadedToCloud: boolean }> {
  // If it's already a cloud URL, don't re-upload
  if (localUrlOrPath.startsWith("http://") || localUrlOrPath.startsWith("https://")) {
    return { publicUrl: localUrlOrPath, uploadedToCloud: false };
  }

  const cleanPath = localUrlOrPath.replace(/^\//, "");
  const absolutePath =
    localUrlOrPath.startsWith("/") && !localUrlOrPath.startsWith("/Users") && !localUrlOrPath.startsWith("/app")
      ? path.join(process.cwd(), "public", cleanPath)
      : path.isAbsolute(localUrlOrPath)
      ? localUrlOrPath
      : path.join(process.cwd(), "public", cleanPath);

  try {
    const buffer = await fs.readFile(absolutePath);
    const filename = options.filename || path.basename(absolutePath);
    const storagePath = `${options.targetFolder}/${filename}`;

    const mime =
      options.mimeType ||
      (filename.endsWith(".mp4")
        ? "video/mp4"
        : filename.endsWith(".mp3")
        ? "audio/mp3"
        : filename.endsWith(".wav")
        ? "audio/wav"
        : filename.endsWith(".png")
        ? "image/png"
        : "image/jpeg");

    const publicUrl = await uploadBufferToStorage(buffer, storagePath, mime);

    if (publicUrl) {
      const assetType: CinemaAsset["type"] =
        options.category === "video" ? "video" : options.category === "audio" ? "audio" : "image";

      const assetId = `asset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const assetRecord: CinemaAsset = {
        id: assetId,
        userId: options.userId || null,
        projectId: options.projectId,
        name: options.name,
        type: assetType,
        category: options.category,
        url: publicUrl,
        thumbnailUrl: assetType === "image" ? publicUrl : null,
        sizeBytes: buffer.length,
        mimeType: mime,
        tags: options.tags || [],
        metadata: {
          ...options.metadata,
          sourcePath: localUrlOrPath,
          uploadedToCloud: true,
          storagePath,
        },
        createdAt: Date.now(),
      };

      await upsertAssetToSupabase(assetRecord, options.userId || null);
      return { publicUrl, asset: assetRecord, uploadedToCloud: true };
    }
  } catch (err) {
    console.warn(`[MediaStorage] Could not persist local file ${localUrlOrPath} to cloud:`, err);
  }

  // Graceful fallback to original local URL
  return { publicUrl: localUrlOrPath, uploadedToCloud: false };
}

/**
 * Ingests an inline base64 data URI (e.g. `data:image/png;base64,...` or `data:audio/wav;base64,...`),
 * uploads the decoded binary buffer into the Supabase bucket, and catalogs it into public.assets.
 */
export async function persistDataUriToBucket(
  dataUri: string,
  options: UploadMediaOptions
): Promise<{ publicUrl: string; asset?: CinemaAsset; uploadedToCloud: boolean }> {
  if (!dataUri.startsWith("data:")) {
    return { publicUrl: dataUri, uploadedToCloud: false };
  }

  try {
    const [header, encoded] = dataUri.split(",", 2);
    if (!encoded) return { publicUrl: dataUri, uploadedToCloud: false };

    const mime = options.mimeType || header.split(";")[0].replace("data:", "") || "image/png";
    const buffer = Buffer.from(encoded, "base64");

    const ext = mime.includes("wav")
      ? "wav"
      : mime.includes("mp3") || mime.includes("mpeg")
      ? "mp3"
      : mime.includes("jpeg") || mime.includes("jpg")
      ? "jpg"
      : mime.includes("mp4")
      ? "mp4"
      : "png";

    const uniqueId = Math.random().toString(36).slice(2, 10);
    const filename = options.filename || `${options.targetFolder.replace(/\//g, "_")}_${Date.now()}_${uniqueId}.${ext}`;
    const storagePath = `${options.targetFolder}/${filename}`;

    const publicUrl = await uploadBufferToStorage(buffer, storagePath, mime);

    if (publicUrl) {
      const assetType: CinemaAsset["type"] =
        mime.startsWith("audio/") ? "audio" : mime.startsWith("video/") ? "video" : "image";

      const assetId = `asset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const assetRecord: CinemaAsset = {
        id: assetId,
        userId: options.userId || null,
        projectId: options.projectId,
        name: options.name,
        type: assetType,
        category: options.category,
        url: publicUrl,
        thumbnailUrl: assetType === "image" ? publicUrl : null,
        sizeBytes: buffer.length,
        mimeType: mime,
        tags: options.tags || [],
        metadata: {
          ...options.metadata,
          uploadedToCloud: true,
          storagePath,
        },
        createdAt: Date.now(),
      };

      await upsertAssetToSupabase(assetRecord, options.userId || null);
      return { publicUrl, asset: assetRecord, uploadedToCloud: true };
    }
  } catch (err) {
    console.warn("[MediaStorage] Could not persist data URI to cloud storage:", err);
  }

  // Graceful fallback to original data URI
  return { publicUrl: dataUri, uploadedToCloud: false };
}
