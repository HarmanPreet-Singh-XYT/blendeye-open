"use client";

import type { CinemaAsset } from "@/lib/supabase-store";

export type { CinemaAsset };

export type AssetCategory =
  | "map"
  | "character_face"
  | "character_body"
  | "location"
  | "style"
  | "video"
  | "audio"
  | "general";

import { getActiveAuthToken } from "@/lib/project-store";

export type AssetType = "image" | "video" | "map" | "audio";

// Seeded Curated Assets for instantaneous preview (Aethelgard: The Chronos Shift production)
// All URLs are local — no Supabase dependency, no network calls, no bucket permissions needed.
export const SEED_ASSETS: CinemaAsset[] = [
  {
    id: "aeth-char-julian",
    name: "Julian Ross — 85mm Prime Portrait",
    type: "image",
    category: "character_face",
    url: "/cinema/characters/julian_portrait.jpg",
    thumbnailUrl: "/cinema/characters/julian_portrait.jpg",
    sizeBytes: 801000,
    mimeType: "image/jpeg",
    tags: ["face", "julian", "pilot", "portrait", "ai-generated"],
    metadata: {
      preset: true,
      characterName: "Julian Ross",
      lens: "85mm Master Prime",
      aiGenerated: true,
      generator: "Imagen 3 Generative AI",
    },
    createdAt: 1788918378000,
  },
  {
    id: "aeth-body-julian",
    name: "Julian Ross — Full-Length Concept Art",
    type: "image",
    category: "character_body",
    url: "/cinema/characters/julian_fullbody.jpg",
    thumbnailUrl: "/cinema/characters/julian_fullbody.jpg",
    sizeBytes: 850000,
    mimeType: "image/jpeg",
    tags: ["body", "costume", "julian", "pilot", "ai-generated"],
    metadata: {
      preset: true,
      characterName: "Julian Ross",
      aiGenerated: true,
      generator: "Imagen 3 Generative AI",
    },
    createdAt: 1788921611000,
  },
  {
    id: "aeth-char-maya",
    name: "Dr. Maya Lin — 85mm Prime Portrait",
    type: "image",
    category: "character_face",
    url: "/cinema/characters/maya_portrait.jpg",
    thumbnailUrl: "/cinema/characters/maya_portrait.jpg",
    sizeBytes: 916000,
    mimeType: "image/jpeg",
    tags: ["face", "maya", "astrophysicist", "portrait", "ai-generated"],
    metadata: {
      preset: true,
      characterName: "Dr. Maya Lin",
      lens: "85mm Master Prime",
      aiGenerated: true,
      generator: "Imagen 3 Generative AI",
    },
    createdAt: 1788918418000,
  },
  {
    id: "aeth-body-maya",
    name: "Dr. Maya Lin — Full-Length Concept Art",
    type: "image",
    category: "character_body",
    url: "/cinema/characters/maya_fullbody.jpg",
    thumbnailUrl: "/cinema/characters/maya_fullbody.jpg",
    sizeBytes: 870000,
    mimeType: "image/jpeg",
    tags: ["body", "costume", "maya", "astrophysicist", "ai-generated"],
    metadata: {
      preset: true,
      characterName: "Dr. Maya Lin",
      aiGenerated: true,
      generator: "Imagen 3 Generative AI",
    },
    createdAt: 1788921623000,
  },
  {
    id: "aeth-char-aura",
    name: "AURA-9 — Holographic Core Likeness",
    type: "image",
    category: "character_face",
    url: "/cinema/characters/aura_portrait.jpg",
    thumbnailUrl: "/cinema/characters/aura_portrait.jpg",
    sizeBytes: 780000,
    mimeType: "image/jpeg",
    tags: ["face", "aura-9", "ai", "oracle", "ai-generated"],
    metadata: {
      preset: true,
      characterName: "AURA-9",
      aiGenerated: true,
      generator: "Imagen 3 Generative AI",
    },
    createdAt: 1788918467000,
  },
  {
    id: "aeth-body-aura",
    name: "AURA-9 — Full-Length Architecture Concept",
    type: "image",
    category: "character_body",
    url: "/cinema/characters/aura_fullbody.jpg",
    thumbnailUrl: "/cinema/characters/aura_fullbody.jpg",
    sizeBytes: 820000,
    mimeType: "image/jpeg",
    tags: ["body", "costume", "aura-9", "ai", "ai-generated"],
    metadata: {
      preset: true,
      characterName: "AURA-9",
      aiGenerated: true,
      generator: "Imagen 3 Generative AI",
    },
    createdAt: 1788921636000,
  },
  {
    id: "aeth-loc-laurel",
    name: "Laurel Canyon Stages — Cockpit Stage Plate",
    type: "image",
    category: "location",
    url: "/cinema/locations/laurel_canyon_cockpit.jpg",
    thumbnailUrl: "/cinema/locations/laurel_canyon_cockpit.jpg",
    sizeBytes: 812000,
    mimeType: "image/jpeg",
    tags: ["location", "cockpit", "laurel-canyon", "stage", "ai-generated"],
    metadata: {
      preset: true,
      aesthetic: "Tactile flight switchgear, analog flight telemetry, strobe-cyan emergency luminescence",
      aiGenerated: true,
      generator: "Imagen 3 Generative AI",
    },
    createdAt: 1788919079000,
  },
  {
    id: "aeth-loc-fonco",
    name: "Fonco Studios — Modular Cockpit Plate",
    type: "image",
    category: "location",
    url: "/cinema/locations/fonco_cockpit.jpg",
    thumbnailUrl: "/cinema/locations/fonco_cockpit.jpg",
    sizeBytes: 742000,
    mimeType: "image/jpeg",
    tags: ["location", "cockpit", "fonco", "modular", "ai-generated"],
    metadata: {
      preset: true,
      aesthetic: "Modular spaceship cockpit & insert stage with tactile hydraulic gimbal mounts",
      aiGenerated: true,
      generator: "Imagen 3 Generative AI",
    },
    createdAt: 1788919099000,
  },
  {
    id: "aeth-loc-castle",
    name: "L.A. Castle Studios — Cockpit LED Volume",
    type: "image",
    category: "location",
    url: "/cinema/locations/la_castle_volume.jpg",
    thumbnailUrl: "/cinema/locations/la_castle_volume.jpg",
    sizeBytes: 890000,
    mimeType: "image/jpeg",
    tags: ["location", "volume", "led", "la-castle", "ai-generated"],
    metadata: {
      preset: true,
      aesthetic: "Unreal Engine in-camera VFX LED volume projecting singularity redshift reflections",
      aiGenerated: true,
      generator: "Imagen 3 Generative AI",
    },
    createdAt: 1788919113000,
  },
  {
    id: "aeth-loc-obs",
    name: "Accretion Observation Deck — Wide Plate",
    type: "image",
    category: "location",
    url: "/cinema/locations/observation_deck_wide.jpg",
    thumbnailUrl: "/cinema/locations/observation_deck_wide.jpg",
    sizeBytes: 840000,
    mimeType: "image/jpeg",
    tags: ["location", "observation-deck", "singularity", "plate", "ai-generated"],
    metadata: {
      preset: true,
      aesthetic: "24mm prime architectural wide establishing shot of panoramic observation viewport",
      aiGenerated: true,
      generator: "Imagen 3 Generative AI",
    },
    createdAt: 1788919849000,
  },
  {
    id: "aeth-style-scope",
    name: "2.39:1 Anamorphic Scope (Accretion Horizon)",
    type: "image",
    category: "style",
    url: "/cinema/scenes/scene_1_storyboard_accretion.jpg",
    thumbnailUrl: "/cinema/scenes/scene_1_storyboard_accretion.jpg",
    sizeBytes: 940000,
    mimeType: "image/jpeg",
    tags: ["style", "anamorphic", "storyboard", "scope", "ai-generated"],
    metadata: {
      preset: true,
      palette: ["#020617", "#06b6d4", "#f59e0b"],
      aiGenerated: true,
      generator: "Imagen 3 Generative AI",
    },
    createdAt: 1788919223000,
  },
  {
    id: "aeth-video-take1",
    name: "Accretion Ergosphere Crossing — Take 01",
    type: "video",
    category: "video",
    url: "/cinema/videos/chronos_take_01.mp4",
    thumbnailUrl: "/cinema/scenes/scene_1_storyboard_accretion.jpg",
    sizeBytes: 2400000,
    mimeType: "video/mp4",
    tags: ["video", "veo", "master", "cockpit", "take"],
    metadata: {
      preset: true,
      durationSec: 5,
      model: "Google Veo 3.1",
    },
    createdAt: 1788919575000,
  },
  {
    id: "aeth-video-take2",
    name: "Cockpit Perigee High-G Burn — Take 02",
    type: "video",
    category: "video",
    url: "/cinema/videos/chronos_take_02.mp4",
    thumbnailUrl: "/cinema/locations/observation_deck_wide.jpg",
    sizeBytes: 2500000,
    mimeType: "video/mp4",
    tags: ["video", "veo", "cockpit", "burn", "take"],
    metadata: {
      preset: true,
      durationSec: 5,
      model: "Google Veo 3.1",
    },
    createdAt: 1788919924000,
  },
  {
    id: "aeth-score-take1",
    name: "Singularity Ergosphere Slingshot Theme — Score 01",
    type: "audio",
    category: "audio",
    url: "/cinema/audio/chronos_score_01.mp3",
    thumbnailUrl: null,
    sizeBytes: 720000,
    mimeType: "audio/mpeg",
    tags: ["score", "lyria", "music", "slingshot"],
    metadata: {
      preset: true,
      durationSec: 30,
      model: "Google Lyria Audio Model",
    },
    createdAt: 1788920005000,
  },
  {
    id: "aeth-score-take2",
    name: "Temporal Echo Paradox Ambient Suite — Score 02",
    type: "audio",
    category: "audio",
    url: "/cinema/audio/chronos_score_02.mp3",
    thumbnailUrl: null,
    sizeBytes: 710000,
    mimeType: "audio/mpeg",
    tags: ["score", "lyria", "music", "paradox"],
    metadata: {
      preset: true,
      durationSec: 30,
      model: "Google Lyria Audio Model",
    },
    createdAt: 1788919675000,
  },
  {
    id: "aeth-map-cockpit",
    name: "Chronos Cockpit Tactical Deck Plan",
    type: "map",
    category: "map",
    url: "/cinema/maps/cockpit_deck_plan.png",
    thumbnailUrl: "/cinema/maps/cockpit_deck_plan.png",
    sizeBytes: 520000,
    mimeType: "image/png",
    tags: ["map", "cockpit", "floorplan", "tactical"],
    metadata: {
      preset: true,
      sceneId: "scene-chronos-1",
    },
    createdAt: 1788919240000,
  },
];

// ---------------------------------------------------------------------------
// Asset cache (cloud only)
//
// Assets live in Supabase. `SEED_ASSETS` above are static, bundled reference
// images shipped with the app (local /public URLs, no network calls) that are
// always available as a baseline library; everything the user uploads or
// generates is fetched from and written to the cloud. Nothing is kept in
// browser storage.
// ---------------------------------------------------------------------------

let assetsCache: CinemaAsset[] = [];
let assetsHydrated = false;
let assetsHydration: Promise<void> | null = null;

/** True once the account's assets have been pulled from Supabase. */
export function areAssetsHydrated(): boolean {
  return assetsHydrated;
}

function mergeWithSeedAssets(assets: CinemaAsset[]): CinemaAsset[] {
  const map = new Map<string, CinemaAsset>();
  for (const a of SEED_ASSETS) map.set(a.id, a);
  for (const a of assets) map.set(a.id, a);
  return Array.from(map.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

function assetAuthHeaders(json = false): Record<string, string> {
  const headers: Record<string, string> = {};
  const token = getActiveAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (json) headers["Content-Type"] = "application/json";
  return headers;
}

/** Clears the cache on sign-out so assets never leak between accounts. */
export function clearAssetCache(): void {
  assetsCache = [];
  assetsHydrated = false;
  assetsHydration = null;
}

/**
 * Pulls the account's assets from Supabase into memory, merged over the
 * bundled seed library. Concurrent calls share one request.
 */
export function hydrateAssets(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (!getActiveAuthToken()) return Promise.resolve();
  if (assetsHydration) return assetsHydration;

  assetsHydration = (async () => {
    try {
      const res = await fetch("/api/assets", { headers: assetAuthHeaders(), cache: "no-store" });
      if (!res.ok) {
        console.warn(`[AssetStore] asset fetch failed (${res.status})`);
        return;
      }
      const data = await res.json();
      if (!Array.isArray(data?.assets)) return;
      assetsCache = mergeWithSeedAssets(data.assets as CinemaAsset[]);
      assetsHydrated = true;
      window.dispatchEvent(new CustomEvent("cinema-assets-updated", { detail: assetsCache }));
    } catch (err) {
      console.warn("[AssetStore] asset hydration failed:", err);
    } finally {
      assetsHydration = null;
    }
  })();

  return assetsHydration;
}

/**
 * All assets visible to the account: the cloud cache merged over the bundled
 * seed library. Kicks off a one-shot hydration if the cache is still cold.
 */
export function getLocalAssets(_userId?: string | null): CinemaAsset[] {
  if (typeof window === "undefined") return SEED_ASSETS;
  if (!assetsHydrated) void hydrateAssets();
  if (assetsCache.length === 0) return SEED_ASSETS;
  return assetsCache;
}

/**
 * Saves an asset to the cache and mirrors it to Supabase.
 */
export function saveLocalAsset(asset: CinemaAsset, _userId?: string | null): CinemaAsset[] {
  if (typeof window === "undefined") return [asset];

  const current = assetsCache.length > 0 ? assetsCache : SEED_ASSETS;
  const existing = current.findIndex((a) => a.id === asset.id);
  const merged =
    existing >= 0
      ? current.map((a, i) => (i === existing ? { ...a, ...asset } : a))
      : [asset, ...current];

  assetsCache = mergeWithSeedAssets(merged);
  window.dispatchEvent(new CustomEvent("cinema-assets-updated", { detail: assetsCache }));

  fetch("/api/assets", {
    method: "POST",
    headers: assetAuthHeaders(true),
    body: JSON.stringify(asset),
  }).catch((err) => {
    console.warn("[AssetStore] asset cloud sync warning:", err);
  });

  return assetsCache;
}

/**
 * Deletes an asset from the cache and from Supabase.
 */
export function deleteLocalAsset(assetId: string, _userId?: string | null): CinemaAsset[] {
  if (typeof window === "undefined") return [];

  const current = assetsCache.length > 0 ? assetsCache : SEED_ASSETS;
  assetsCache = current.filter((a) => a.id !== assetId);
  window.dispatchEvent(new CustomEvent("cinema-assets-updated", { detail: assetsCache }));

  fetch(`/api/assets?id=${encodeURIComponent(assetId)}`, {
    method: "DELETE",
    headers: assetAuthHeaders(),
  }).catch((err) => {
    console.warn("[AssetStore] asset cloud delete warning:", err);
  });

  return assetsCache;
}

/**
 * Upload a file to the backend, save to local store, and return asset.
 */
export async function uploadAssetFile(
  file: File,
  options?: {
    name?: string;
    category?: AssetCategory;
    projectId?: string;
    tags?: string[];
  }
): Promise<CinemaAsset> {
  const formData = new FormData();
  formData.append("file", file);
  if (options?.name) formData.append("name", options.name);
  if (options?.category) formData.append("category", options.category);
  if (options?.projectId) formData.append("projectId", options.projectId);
  if (options?.tags && options.tags.length > 0) {
    formData.append("tags", JSON.stringify(options.tags));
  }

  const res = await fetch("/api/assets/upload", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(errText || `Upload failed with status ${res.status}`);
  }

  const data = await res.json();
  if (!data.asset) {
    throw new Error("Upload response missing asset data");
  }

  saveLocalAsset(data.asset);
  return data.asset;
}

/**
 * Category metadata helper
 */
export const ASSET_CATEGORIES: Array<{
  id: AssetCategory | "all";
  label: string;
  desc: string;
  iconName: string;
}> = [
  { id: "all", label: "All Assets", desc: "Full production asset library", iconName: "Layers" },
  { id: "map", label: "Maps & Floor Plans", desc: "Top-level building maps and architectural blueprints", iconName: "MapPin" },
  { id: "character_face", label: "Character Faces", desc: "Close-up headshots and likeness references", iconName: "User" },
  { id: "character_body", label: "Character Wardrobe", desc: "Full-body silhouettes, costumes, and stances", iconName: "Shirt" },
  { id: "location", label: "Location Plates", desc: "Scouted location plates, architecture, and environments", iconName: "Building2" },
  { id: "style", label: "Style & Color Mood", desc: "Lighting references, color palettes, and cinematic LUTs", iconName: "Sparkles" },
  { id: "video", label: "Video Footage & Takes", desc: "Generated Veo takes and live b-roll footage", iconName: "Video" },
  { id: "audio", label: "Audio & Stems", desc: "Lyria scores, voice takes, and ambient tracks", iconName: "Volume2" },
];
