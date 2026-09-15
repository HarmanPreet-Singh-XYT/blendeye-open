import { NextRequest, NextResponse } from "next/server";
import {
  fetchAssetsFromSupabase,
  upsertAssetToSupabase,
  deleteAssetFromSupabase,
  type CinemaAsset,
} from "@/lib/supabase-store";
import { isSupabaseConfigured, getAuthUserFromHeader } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId") || undefined;
  const category = searchParams.get("category") || undefined;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ assets: [], configured: false });
  }

  const authUser = await getAuthUserFromHeader(req.headers.get("authorization"));
  if (!authUser) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const assets = await fetchAssetsFromSupabase(authUser.id, projectId, category);
  return NextResponse.json({ assets: assets || [], configured: true });
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || !body.url || !body.name) {
    return NextResponse.json({ error: "Asset name and url are required" }, { status: 400 });
  }

  const authUser = await getAuthUserFromHeader(req.headers.get("authorization"));
  const assetId = body.id || `asset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const asset: CinemaAsset = {
    id: assetId,
    userId: authUser?.id || null,
    projectId: body.projectId || undefined,
    name: body.name,
    type: body.type || "image",
    category: body.category || "general",
    url: body.url,
    thumbnailUrl: body.thumbnailUrl || null,
    sizeBytes: body.sizeBytes || 0,
    mimeType: body.mimeType,
    tags: Array.isArray(body.tags) ? body.tags : [],
    metadata: body.metadata || {},
    createdAt: body.createdAt || Date.now(),
  };

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ saved: true, asset, configured: false });
  }

  const success = await upsertAssetToSupabase(asset, authUser?.id || null);
  return NextResponse.json({ saved: success, asset, configured: true });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Asset ID is required" }, { status: 400 });
  }

  const authUser = await getAuthUserFromHeader(req.headers.get("authorization"));
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ deleted: true, id, configured: false });
  }

  const success = await deleteAssetFromSupabase(id, authUser?.id || null);
  return NextResponse.json({ deleted: success, id, configured: true });
}
