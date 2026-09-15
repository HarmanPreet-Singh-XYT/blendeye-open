import { NextRequest, NextResponse } from "next/server";
import { fetchProjectsFromSupabase, upsertProjectToSupabase } from "@/lib/supabase-store";
import { isSupabaseConfigured, getAuthUserFromHeader } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      projects: [],
      configured: false,
      message: "Supabase not configured; cloud storage is required.",
    });
  }

  // The app is cloud-only and login-gated, so there is no anonymous project
  // view: without a verified token this returns nothing rather than leaking
  // shared/seed rows.
  const authUser = await getAuthUserFromHeader(req.headers.get("authorization"));
  if (!authUser) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const projects = await fetchProjectsFromSupabase(authUser.id);

  if (projects === null) {
    return NextResponse.json({
      projects: [],
      configured: true,
      tablesReady: false,
      message: "Supabase tables not yet initialized. Run supabase/schema.sql in Supabase SQL editor.",
    });
  }

  return NextResponse.json({
    projects,
    configured: true,
    tablesReady: true,
    user: { id: authUser.id, email: authUser.email },
  });
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || !body.id || !body.title) {
    return NextResponse.json({ error: "Project id and title are required" }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      saved: false,
      configured: false,
      message: "Supabase not configured; stored locally only.",
    });
  }

  // Bind project to authenticated user if session is provided
  const authUser = await getAuthUserFromHeader(req.headers.get("authorization"));
  if (!authUser) {
    return NextResponse.json({
      saved: false,
      configured: true,
      id: body.id,
      message: "Authentication required to sync projects with cloud storage; stored locally only.",
    }, { status: 401 });
  }

  // Strictly enforce user_id from verified auth token, never client payload
  const effectiveUserId = authUser.id;
  body.userId = effectiveUserId;

  const success = await upsertProjectToSupabase(body, effectiveUserId);
  if (!success) {
    return NextResponse.json({
      saved: false,
      configured: true,
      error: "Failed to persist project or unauthorized access to project ID",
    }, { status: 403 });
  }

  return NextResponse.json({
    saved: true,
    configured: true,
    id: body.id,
    userId: effectiveUserId,
  });
}

