import { getSupabaseClient, getSupabaseAdminClient, isSupabaseConfigured } from "@/lib/supabase";
import type { ProjectData, ScratchpadNote } from "@/lib/project-store";
import { normalizeMediaUrl } from "@/lib/media-url";

/**
 * Rewrites any signed/expiring Storage URL among a project's media fields back
 * to the permanent public form.
 *
 * The write-path guards (see lib/media-url.ts) stop signed URLs being persisted
 * from here on; this heals anything stored before them. A take, keyframe,
 * portrait or floor plan saved with a since-lapsed token becomes loadable again
 * instead of 400ing forever with what looks like data loss.
 */
function healProjectMediaUrls(p: ProjectData): ProjectData {
  const url = (v: string | undefined): string | undefined => (v ? normalizeMediaUrl(v) : v);
  const nullableUrl = (v: string | null | undefined): string | null | undefined =>
    v ? normalizeMediaUrl(v) : v;

  return {
    ...p,
    activeVideoUrl: url(p.activeVideoUrl),
    activeScoreUrl: url(p.activeScoreUrl),
    storyboardFrameUrl: url(p.storyboardFrameUrl),
    floorPlanMapUrl: url(p.floorPlanMapUrl),
    videoTakes: p.videoTakes?.map((t) => ({ ...t, videoUrl: url(t.videoUrl) ?? t.videoUrl })),
    scoreTakes: p.scoreTakes?.map((t) => ({
      ...t,
      audioUrl: url(t.audioUrl) ?? t.audioUrl,
      conditioningImageUrl: nullableUrl(t.conditioningImageUrl),
      conditioningImageUrls: t.conditioningImageUrls?.map((u) => normalizeMediaUrl(u)),
    })),
    characters: p.characters?.map((c) => ({
      ...c,
      imageUrl: url(c.imageUrl),
      fullBodyImageUrl: url(c.fullBodyImageUrl),
    })),
    scenes: p.scenes?.map((s) => ({
      ...s,
      activeVideoUrl: url(s.activeVideoUrl),
      preview_image_url: url(s.preview_image_url),
      floorPlanMapUrl: url(s.floorPlanMapUrl),
      sceneImages: s.sceneImages?.map((img) => ({ ...img, url: normalizeMediaUrl(img.url) })),
      videoTakes: s.videoTakes?.map((t) => ({ ...t, videoUrl: url(t.videoUrl) ?? t.videoUrl })),
      scoreTakes: s.scoreTakes?.map((t) => ({ ...t, audioUrl: url(t.audioUrl) ?? t.audioUrl })),
      locationCandidates: s.locationCandidates?.map((c) => ({
        ...c,
        preview_image_url: url(c.preview_image_url),
      })),
    })),
  };
}

export function projectToRow(p: ProjectData, explicitUserId?: string | null) {
  // Bundle all multi-scene sequence and media data into initial_events JSONB column
  const extendedBundle = {
    _v: 2,
    events: p.initialEvents || [],
    scenes: p.scenes || [],
    activeSceneId: p.activeSceneId || null,
    activeVideoUrl: p.activeVideoUrl || null,
    activeScoreUrl: p.activeScoreUrl || null,
    videoTakes: p.videoTakes || [],
    scoreTakes: p.scoreTakes || [],
    storyboardFrameUrl: p.storyboardFrameUrl || null,
    floorPlanMapUrl: p.floorPlanMapUrl || null,
    floorPlanMapName: p.floorPlanMapName || null,
    floorPlanMapConfig: p.floorPlanMapConfig || null,
    locationClusters: p.locationClusters || [],
  };

  return {
    id: p.id,
    user_id: explicitUserId !== undefined ? explicitUserId : p.userId || null,
    title: p.title,
    genre: p.genre || null,
    premise: p.premise || null,
    scene_title: p.sceneTitle || null,
    scene_summary: p.sceneSummary || null,
    screenplay_text: p.screenplayText || null,
    director_style: p.directorStyle || null,
    core_secret: p.coreSecret || null,
    primary_location: p.primaryLocation || null,
    target_territories: p.targetTerritories || [],
    narrative_format: p.narrativeFormat || "feature",
    target_runtime_minutes: p.targetRuntimeMinutes || 105,
    scene_placement_seconds: p.scenePlacementSeconds || 1800,
    scene_duration_seconds: p.sceneDurationSeconds || 180,
    characters: p.characters || [],
    initial_events: extendedBundle,
    nodes: p.nodes || [],
    edges: p.edges || [],
    is_custom: p.isCustom ?? true,
    created_at: p.createdAt || Date.now(),
    updated_at: p.updatedAt || Date.now(),
  };
}

export function rowToProject(r: any): ProjectData {
  const ext =
    r.initial_events &&
    typeof r.initial_events === "object" &&
    !Array.isArray(r.initial_events) &&
    r.initial_events._v === 2
      ? r.initial_events
      : null;

  return healProjectMediaUrls({
    id: r.id,
    userId: r.user_id || undefined,
    title: r.title,
    genre: r.genre || "General Fiction",
    premise: r.premise || "",
    sceneTitle: r.scene_title || "Untitled Scene",
    sceneSummary: r.scene_summary || "",
    screenplayText: r.screenplay_text || "",
    directorStyle: r.director_style,
    coreSecret: r.core_secret,
    primaryLocation: r.primary_location,
    targetTerritories: Array.isArray(r.target_territories) ? r.target_territories : [],
    narrativeFormat: r.narrative_format || "feature",
    targetRuntimeMinutes: r.target_runtime_minutes || 105,
    scenePlacementSeconds: r.scene_placement_seconds || 1800,
    sceneDurationSeconds: r.scene_duration_seconds || 180,
    characters: Array.isArray(r.characters) ? r.characters : [],
    initialEvents: ext?.events || (Array.isArray(r.initial_events) ? r.initial_events : []),
    nodes: Array.isArray(r.nodes) ? r.nodes : [],
    edges: Array.isArray(r.edges) ? r.edges : [],
    isCustom: r.is_custom ?? true,
    createdAt: typeof r.created_at === "number" ? r.created_at : Number(r.created_at) || Date.now(),
    updatedAt: typeof r.updated_at === "number" ? r.updated_at : Number(r.updated_at) || Date.now(),
    // Unpack extended multi-scene sequence & media fields
    scenes: ext?.scenes || (Array.isArray(r.scenes) ? r.scenes : undefined),
    activeSceneId: ext?.activeSceneId || r.active_scene_id || undefined,
    activeVideoUrl: ext?.activeVideoUrl || r.active_video_url || undefined,
    activeScoreUrl: ext?.activeScoreUrl || r.active_score_url || undefined,
    videoTakes: ext?.videoTakes || [],
    scoreTakes: ext?.scoreTakes || [],
    storyboardFrameUrl: ext?.storyboardFrameUrl || undefined,
    floorPlanMapUrl: ext?.floorPlanMapUrl || undefined,
    floorPlanMapName: ext?.floorPlanMapName || undefined,
    floorPlanMapConfig: ext?.floorPlanMapConfig || undefined,
    locationClusters: ext?.locationClusters || undefined,
  });
}

/**
 * Loads projects from Supabase.
 * Projects are owned by a single account. There are no shared/guest rows any
 * more, so a call without a userId yields nothing rather than falling back to
 * globally-visible seed templates.
 */
export async function fetchProjectsFromSupabase(userId?: string | null): Promise<ProjectData[] | null> {
  if (!isSupabaseConfigured()) return null;
  if (!userId) return [];

  try {
    const client = typeof window === "undefined" ? getSupabaseAdminClient() || getSupabaseClient() : getSupabaseClient();
    if (!client) return null;

    const { data, error } = await client
      .from("projects")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (error) {
      console.warn("[SupabaseStore] Could not fetch projects:", error.message);
      return null;
    }

    return (data || []).map(rowToProject);
  } catch (err) {
    console.warn("[SupabaseStore] fetchProjectsFromSupabase error:", err);
    return null;
  }
}

/**
 * Loads a single project by id from Supabase, verifying access.
 */
export async function fetchProjectByIdFromSupabase(id: string, userId?: string | null): Promise<ProjectData | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const client = typeof window === "undefined" ? getSupabaseAdminClient() || getSupabaseClient() : getSupabaseClient();
    if (!client) return null;

    const { data, error } = await client
      .from("projects")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    // If the project is owned by a user, the requester must be that user.
    if (data.user_id) {
      if (!userId || data.user_id !== userId) {
        console.warn(`[SupabaseStore] Project ${id} access denied (owned by ${data.user_id}, requested by ${userId || "anonymous"})`);
        return null;
      }
    }

    return rowToProject(data);
  } catch (err) {
    console.warn(`[SupabaseStore] fetchProjectByIdFromSupabase error for ${id}:`, err);
    return null;
  }
}

/**
 * Upserts a project into Supabase linked to the user account.
 * Guarantees that callers cannot overwrite another user's project.
 */
export async function upsertProjectToSupabase(project: ProjectData, explicitUserId?: string | null): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  try {
    const client = typeof window === "undefined" ? getSupabaseAdminClient() || getSupabaseClient() : getSupabaseClient();
    if (!client) return false;

    // Check ownership of existing project to prevent IDOR overwrites
    const { data: existing } = await client
      .from("projects")
      .select("user_id")
      .eq("id", project.id)
      .maybeSingle();

    if (existing && existing.user_id && existing.user_id !== explicitUserId) {
      console.warn(`[SupabaseStore] IDOR prevented: project ${project.id} belongs to user ${existing.user_id}, denied to ${explicitUserId}`);
      return false;
    }

    const row = projectToRow(project, explicitUserId);
    const { error } = await client
      .from("projects")
      .upsert(row, { onConflict: "id" });

    if (error) {
      console.warn("[SupabaseStore] Could not upsert project:", error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.warn("[SupabaseStore] upsertProjectToSupabase error:", err);
    return false;
  }
}

/**
 * Deletes a project by id from Supabase, ensuring ownership if userId is provided.
 * Requires authenticated userId so unauthenticated requests cannot delete arbitrary projects.
 */
export async function deleteProjectFromSupabase(id: string, userId?: string | null): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  if (!userId) {
    console.warn(`[SupabaseStore] Refusing to delete project ${id}: authenticated userId required.`);
    return false;
  }

  try {
    const client = typeof window === "undefined" ? getSupabaseAdminClient() || getSupabaseClient() : getSupabaseClient();
    if (!client) return false;

    const query = client.from("projects").delete().eq("id", id).eq("user_id", userId);

    const { error } = await query;

    if (error) {
      console.warn("[SupabaseStore] Could not delete project:", error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.warn("[SupabaseStore] deleteProjectFromSupabase error:", err);
    return false;
  }
}

/**
 * Loads scratchpad notes from Supabase linked to user account.
 */
export async function fetchNotesFromSupabase(projectId?: string, userId?: string | null): Promise<ScratchpadNote[] | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const client = typeof window === "undefined" ? getSupabaseAdminClient() || getSupabaseClient() : getSupabaseClient();
    if (!client) return null;

    let query = client.from("scratchpad_notes").select("*").order("created_at", { ascending: false });
    if (projectId) {
      query = query.eq("project_id", projectId);
    }
    // Notes belong to an account; there are no shared/guest note rows any more.
    if (userId) {
      query = query.eq("user_id", userId);
    } else {
      return [];
    }

    const { data, error } = await query;
    if (error) {
      console.warn("[SupabaseStore] Could not fetch notes:", error.message);
      return null;
    }

    return (data || []).map((r: any) => ({
      id: r.id,
      userId: r.user_id || undefined,
      projectId: r.project_id || undefined,
      title: r.title,
      content: r.content || "",
      category: r.category || "concept",
      createdAt: typeof r.created_at === "number" ? r.created_at : Number(r.created_at) || Date.now(),
    }));
  } catch (err) {
    console.warn("[SupabaseStore] fetchNotesFromSupabase error:", err);
    return null;
  }
}

/**
 * Upserts a scratchpad note into Supabase.
 */
export async function upsertNoteToSupabase(note: ScratchpadNote, explicitUserId?: string | null): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  if (!explicitUserId) {
    console.warn(`[SupabaseStore] Refusing to upsert note ${note.id}: authenticated userId required.`);
    return false;
  }

  try {
    const client = typeof window === "undefined" ? getSupabaseAdminClient() || getSupabaseClient() : getSupabaseClient();
    if (!client) return false;

    // Check ownership of existing note to prevent IDOR overwrites
    const { data: existing } = await client
      .from("scratchpad_notes")
      .select("user_id")
      .eq("id", note.id)
      .maybeSingle();

    if (existing && existing.user_id && existing.user_id !== explicitUserId) {
      console.warn(`[SupabaseStore] IDOR prevented: note ${note.id} belongs to user ${existing.user_id}, denied to ${explicitUserId}`);
      return false;
    }

    const { error } = await client
      .from("scratchpad_notes")
      .upsert({
        id: note.id,
        user_id: explicitUserId,
        project_id: note.projectId || null,
        title: note.title,
        content: note.content || "",
        category: note.category || "concept",
        created_at: note.createdAt || Date.now(),
      }, { onConflict: "id" });

    if (error) {
      console.warn("[SupabaseStore] Could not upsert note:", error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.warn("[SupabaseStore] upsertNoteToSupabase error:", err);
    return false;
  }
}

/**
 * Deletes a scratchpad note from Supabase.
 */
export async function deleteNoteFromSupabase(id: string, userId?: string | null): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  if (!userId) {
    console.warn(`[SupabaseStore] Refusing to delete note ${id}: authenticated userId required.`);
    return false;
  }

  try {
    const client = typeof window === "undefined" ? getSupabaseAdminClient() || getSupabaseClient() : getSupabaseClient();
    if (!client) return false;

    const query = client.from("scratchpad_notes").delete().eq("id", id).eq("user_id", userId);

    const { error } = await query;

    if (error) {
      console.warn("[SupabaseStore] Could not delete note:", error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.warn("[SupabaseStore] deleteNoteFromSupabase error:", err);
    return false;
  }
}

/**
 * Loads saved characters from the Talent Vault in Supabase.
 */
export async function fetchTalentFromSupabase(userId?: string | null): Promise<any[] | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const client = typeof window === "undefined" ? getSupabaseAdminClient() || getSupabaseClient() : getSupabaseClient();
    if (!client) return null;

    let query = client.from("talent_vault").select("*").order("created_at", { ascending: false });
    // Vault entries belong to an account; there are no shared/guest rows any more.
    if (userId) {
      query = query.eq("user_id", userId);
    } else {
      return [];
    }

    const { data, error } = await query;
    if (error) {
      console.warn("[SupabaseStore] Could not fetch talent vault:", error.message);
      return null;
    }

    return (data || []).map((r: any) => ({
      name: r.name,
      role: r.role || "Lead",
      archetype: r.archetype || "",
      speechStyle: r.speech_style || "",
      subtextRatio: r.subtext_ratio || "high",
      actorComp: r.actor_comp,
      objective: r.objective || "",
      dialsSummary: r.dials_summary || "",
      quirks: Array.isArray(r.quirks) ? r.quirks : [],
      personalityPreset: r.personality_preset,
      confidence: r.confidence ?? 0.7,
      verbalPacing: r.verbal_pacing ?? 0.5,
      imageUrl: r.image_url,
      fullBodyImageUrl: r.full_body_image_url,
      visualDescription: r.visual_description,
      wardrobe: r.wardrobe,
    }));
  } catch (err) {
    console.warn("[SupabaseStore] fetchTalentFromSupabase error:", err);
    return null;
  }
}

/**
 * Upserts a character into the Talent Vault in Supabase.
 */
export async function upsertTalentToSupabase(character: any, userId?: string | null): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  try {
    const client = typeof window === "undefined" ? getSupabaseAdminClient() || getSupabaseClient() : getSupabaseClient();
    if (!client) return false;

    const charId = `talent-${character.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;

    const { error } = await client.from("talent_vault").upsert({
      id: charId,
      user_id: userId || null,
      name: character.name,
      archetype: character.archetype || null,
      speech_style: character.speechStyle || null,
      subtext_ratio: character.subtextRatio || null,
      actor_comp: character.actorComp || null,
      objective: character.objective || null,
      dials_summary: character.dialsSummary || null,
      quirks: character.quirks || [],
      role: character.role || null,
      personality_preset: character.personalityPreset || null,
      confidence: character.confidence ?? 0.7,
      verbal_pacing: character.verbalPacing ?? 0.5,
      image_url: character.imageUrl || null,
      full_body_image_url: character.fullBodyImageUrl || null,
      visual_description: character.visualDescription || null,
      wardrobe: character.wardrobe || null,
      created_at: Date.now(),
    }, { onConflict: "id" });

    if (error) {
      console.warn("[SupabaseStore] Could not upsert talent vault character:", error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.warn("[SupabaseStore] upsertTalentToSupabase error:", err);
    return false;
  }
}

/**
 * Deletes a character from the Talent Vault in Supabase.
 */
export async function deleteTalentFromSupabase(characterName: string, userId?: string | null): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  try {
    const client = typeof window === "undefined" ? getSupabaseAdminClient() || getSupabaseClient() : getSupabaseClient();
    if (!client) return false;

    const charId = `talent-${characterName.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
    let query = client.from("talent_vault").delete().eq("id", charId);
    if (userId) {
      query = query.eq("user_id", userId);
    }

    const { error } = await query;
    if (error) {
      console.warn("[SupabaseStore] Could not delete talent vault character:", error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.warn("[SupabaseStore] deleteTalentFromSupabase error:", err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Cinema Assets (Media Library & Floor Plan Maps)
// ---------------------------------------------------------------------------

export interface CinemaAsset {
  id: string;
  userId?: string | null;
  projectId?: string | null;
  name: string;
  type: "image" | "video" | "map" | "audio";
  category: "map" | "character_face" | "character_body" | "location" | "style" | "video" | "audio" | "general";
  url: string;
  thumbnailUrl?: string | null;
  sizeBytes?: number;
  mimeType?: string;
  tags?: string[];
  metadata?: Record<string, any>;
  createdAt: number;
}

export function assetToRow(asset: CinemaAsset, explicitUserId?: string | null) {
  return {
    id: asset.id,
    user_id: explicitUserId !== undefined ? explicitUserId : asset.userId || null,
    project_id: asset.projectId || null,
    name: asset.name,
    type: asset.type,
    category: asset.category,
    url: asset.url,
    thumbnail_url: asset.thumbnailUrl || null,
    size_bytes: asset.sizeBytes || 0,
    mime_type: asset.mimeType || null,
    tags: asset.tags || [],
    metadata: asset.metadata || {},
    created_at: asset.createdAt || Date.now(),
  };
}

export function rowToAsset(r: any): CinemaAsset {
  return {
    id: r.id,
    userId: r.user_id || undefined,
    projectId: r.project_id || undefined,
    name: r.name,
    type: r.type || "image",
    category: r.category || "general",
    url: normalizeMediaUrl(r.url),
    thumbnailUrl: r.thumbnail_url ? normalizeMediaUrl(r.thumbnail_url) : null,
    sizeBytes: typeof r.size_bytes === "number" ? r.size_bytes : Number(r.size_bytes) || 0,
    mimeType: r.mime_type || undefined,
    tags: Array.isArray(r.tags) ? r.tags : [],
    metadata: r.metadata && typeof r.metadata === "object" ? r.metadata : {},
    createdAt: typeof r.created_at === "number" ? r.created_at : Number(r.created_at) || Date.now(),
  };
}

export async function fetchAssetsFromSupabase(
  userId?: string | null,
  projectId?: string | null,
  category?: string | null
): Promise<CinemaAsset[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const client = typeof window === "undefined" ? getSupabaseAdminClient() || getSupabaseClient() : getSupabaseClient();
    if (!client) return [];

    let query = client.from("assets").select("*").order("created_at", { ascending: false });

    // Assets belong to an account. There are no shared/guest asset rows any
    // more, so an unauthenticated call returns nothing.
    if (userId) {
      query = query.eq("user_id", userId);
    } else {
      return [];
    }
    if (projectId) {
      query = query.or(`project_id.is.null,project_id.eq.${projectId}`);
    }
    if (category && category !== "all") {
      query = query.eq("category", category);
    }

    const { data, error } = await query;
    if (error) {
      console.warn("[SupabaseStore] fetchAssetsFromSupabase query error:", error.message);
      return [];
    }

    return (data || []).map(rowToAsset);
  } catch (err) {
    console.warn("[SupabaseStore] fetchAssetsFromSupabase error:", err);
    return [];
  }
}

export async function upsertAssetToSupabase(
  asset: CinemaAsset,
  userId?: string | null
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  try {
    const client = typeof window === "undefined" ? getSupabaseAdminClient() || getSupabaseClient() : getSupabaseClient();
    if (!client) return false;

    const row = assetToRow(asset, userId);
    const { error } = await client.from("assets").upsert(row, { onConflict: "id" });

    if (error) {
      console.warn("[SupabaseStore] Could not upsert asset:", error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.warn("[SupabaseStore] upsertAssetToSupabase error:", err);
    return false;
  }
}

export async function deleteAssetFromSupabase(
  assetId: string,
  userId?: string | null
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  try {
    const client = typeof window === "undefined" ? getSupabaseAdminClient() || getSupabaseClient() : getSupabaseClient();
    if (!client) return false;

    let query = client.from("assets").delete().eq("id", assetId);
    if (userId) {
      query = query.eq("user_id", userId);
    }

    const { error } = await query;
    if (error) {
      console.warn("[SupabaseStore] Could not delete asset:", error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.warn("[SupabaseStore] deleteAssetFromSupabase error:", err);
    return false;
  }
}


