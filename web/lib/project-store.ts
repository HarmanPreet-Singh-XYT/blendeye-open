import type { Node, Edge } from "@xyflow/react";
import type { StoryEventMarker } from "@/components/cinema/timeline-scrubber";

/**
 * Storage model — cloud only, no browser persistence.
 *
 * Every collection below lives in an in-memory cache that is hydrated from
 * Supabase through the Next.js API routes when a session starts, and dropped
 * when it ends. Reads stay synchronous because they serve render paths that
 * cannot await; writes apply optimistically to the cache and are mirrored to
 * Supabase.
 *
 * Nothing about the user's work is written to localStorage/sessionStorage, so
 * there is exactly one source of truth and no local-vs-cloud merge to
 * reconcile. The only browser storage the app relies on is Supabase's own auth
 * client session (which is what keeps you signed in across a refresh).
 */

export interface ProjectCharacter {
  name: string;
  archetype: string;
  speechStyle?: string;
  subtextRatio?: string;
  actorComp?: string;
  castingReasoning?: string;
  alternateCastingComp?: string;
  objective?: string;
  dialsSummary?: string;
  quirks?: string[];
  role?: string;
  personalityPreset?: string;
  confidence?: number;
  verbalPacing?: number;
  imageUrl?: string;
  fullBodyImageUrl?: string;
  visualDescription?: string;
  wardrobe?: string;
}

export interface ScratchpadNote {
  id: string;
  userId?: string;
  projectId?: string;
  title: string;
  content: string;
  category: "concept" | "character" | "scene" | "dialogue" | "location";
  createdAt: number;
}

export interface VideoTake {
  id: string;
  takeNumber: number;
  title: string;
  cameraMotion: string;
  stylePreset: string;
  durationSec: number;
  createdAt: number;
  videoUrl: string;
  prompt?: string;
  characterName?: string;
  isMaster?: boolean;
  sceneId?: string;
  // Omni Flash interaction id behind this take — lets the director keep
  // editing/extending the clip across turns without re-rendering it.
  interactionId?: string;
}

export interface ShotContinuityBible {
  characterAppearance?: string;
  wardrobe?: string;
  location?: string;
  lighting?: string;
  timeOfDay?: string;
  blockingStart?: string;
  blockingEnd?: string;
}

export interface Shot {
  id: string;
  sceneId: string;
  sequenceIndex: number;
  shotNumber: number;
  shotType: string;
  cameraMovement: string;
  prompt: string;
  estimatedDurationSec: number;
  continuityBible?: ShotContinuityBible;
  status: "planned" | "generating" | "completed" | "error";
  videoUrl?: string;
  lastFrameUrl?: string;
  errorMessage?: string;
  createdAt: number;
}

export interface ShotSequenceJob {
  jobId: string;
  sceneId: string;
  status: "queued" | "running" | "completed" | "error";
  currentShotIndex: number;
  totalShots: number;
  shots: Shot[];
  createdAt: number;
  updatedAt: number;
  errorMessage?: string;
}

export interface ScoreTake {
  id: string;
  sceneId?: string;
  takeNumber: number;
  title: string;
  prompt: string;
  durationMode: "clip" | "pro";
  durationSec: number;
  createdAt: number;
  audioUrl: string;
  lyricsText?: string;
  isMaster?: boolean;
  scoreType?: "score" | "source" | "vocal";
  conditioningImageUrl?: string | null;
  conditioningImageUrls?: string[];
  responseModalities?: string[];
  instruments?: string[];
  dynamicArc?: string;
  model?: string;
}

export type NarrativeFormat = "feature" | "pilot" | "short" | "teaser" | "series" | "custom";

export interface NarrativeFormatConfig {
  id: NarrativeFormat;
  label: string;
  tag: string;
  defaultMinutes: number;
  minMinutes: number;
  maxMinutes: number;
  typicalScenes: number;
  pacingDescription: string;
  pacing?: string;
  structure: {
    act1Name: string;
    act1Pct: number;
    midpointPct: number;
    act3Pct: number;
  };
}

export const NARRATIVE_FORMATS: Record<NarrativeFormat, NarrativeFormatConfig> = {
  feature: {
    id: "feature",
    label: "Feature Film",
    tag: "90 - 130 min · 3-Act Structure",
    defaultMinutes: 105,
    minMinutes: 75,
    maxMinutes: 180,
    typicalScenes: 36,
    pacingDescription: "Classic cinematic 3-act narrative with rising tension, midpoint reversal, and third-act resolution.",
    structure: {
      act1Name: "Act I: Setup & Catalyst",
      act1Pct: 0.25,
      midpointPct: 0.50,
      act3Pct: 0.75,
    },
  },
  pilot: {
    id: "pilot",
    label: "TV Pilot / Episodic",
    tag: "45 - 60 min · 4-5 Act Television Arc",
    defaultMinutes: 52,
    minMinutes: 30,
    maxMinutes: 75,
    typicalScenes: 22,
    pacingDescription: "Multi-strand A/B character subplots, rapid commercial act cliffhangers, and serial hook.",
    structure: {
      act1Name: "Teaser & Act I Hook",
      act1Pct: 0.20,
      midpointPct: 0.50,
      act3Pct: 0.80,
    },
  },
  short: {
    id: "short",
    label: "Festival Short Film",
    tag: "12 - 25 min · Tight Focus",
    defaultMinutes: 18,
    minMinutes: 8,
    maxMinutes: 35,
    typicalScenes: 8,
    pacingDescription: "Laser-focused narrative collision, single pivotal moral dilemmas, intense psychological compression.",
    structure: {
      act1Name: "Inciting Hook",
      act1Pct: 0.20,
      midpointPct: 0.50,
      act3Pct: 0.75,
    },
  },
  teaser: {
    id: "teaser",
    label: "Proof of Concept / Teaser",
    tag: "2 - 5 min · Pitch Vignette",
    defaultMinutes: 3,
    minMinutes: 1,
    maxMinutes: 7,
    typicalScenes: 2,
    pacingDescription: "High-impact visual proof of concept, immediate kinetic hook, cliffhanger pitch delivery.",
    structure: {
      act1Name: "Opening Hook",
      act1Pct: 0.25,
      midpointPct: 0.50,
      act3Pct: 0.75,
    },
  },
  series: {
    id: "series",
    label: "Limited Mini-Series Part",
    tag: "60 - 75 min · Prestige Cinema",
    defaultMinutes: 65,
    minMinutes: 45,
    maxMinutes: 90,
    typicalScenes: 28,
    pacingDescription: "Deep character world-building, expansive ensemble arcs, slow-burn psychological reveals.",
    structure: {
      act1Name: "World Setup & Catalyst",
      act1Pct: 0.22,
      midpointPct: 0.50,
      act3Pct: 0.78,
    },
  },
  custom: {
    id: "custom",
    label: "Custom Narrative Scope",
    tag: "Variable Runtime & Custom Flow",
    defaultMinutes: 45,
    minMinutes: 1,
    maxMinutes: 240,
    typicalScenes: 15,
    pacingDescription: "Director-defined custom runtime and scene distribution.",
    structure: {
      act1Name: "Opening Act",
      act1Pct: 0.25,
      midpointPct: 0.50,
      act3Pct: 0.75,
    },
  },
};

export interface GenreOption {
  id: string;
  label: string;
  tag: string;
  category: "thriller" | "scifi" | "noir" | "horror" | "drama" | "action" | "epic";
  color?: string;
  palette?: string;
}

export const GENRE_OPTIONS: GenreOption[] = [
  // ── Thrillers & Suspense ──
  {
    id: "Heist / Crime Thriller",
    label: "Heist Thriller",
    tag: "High-Stakes & Suspense",
    category: "thriller",
    color: "text-amber-400 border-amber-500/30",
    palette: "Vault metallics, security laser red, countdown amber",
  },
  {
    id: "Psychological Suspense",
    label: "Psychological Thriller",
    tag: "Mind Games & Paranoia",
    category: "thriller",
    color: "text-rose-400 border-rose-500/30",
    palette: "Disorienting mirrors, desaturated slate, claustrophobic shadows",
  },
  {
    id: "Espionage / Cold War",
    label: "Espionage & Spies",
    tag: "Hidden Loyalties & Secrets",
    category: "thriller",
    color: "text-emerald-400 border-emerald-500/30",
    palette: "Trenchcoat olive, embassy mahogany, surveillance monochrome",
  },
  {
    id: "Action / Tactical Thriller",
    label: "Tactical Action",
    tag: "Kinetic Momentum & Siege",
    category: "action",
    color: "text-orange-400 border-orange-500/30",
    palette: "Ballistic smoke, muzzle flash orange, tactical gunmetal",
  },
  {
    id: "Survival / Wilderness Thriller",
    label: "Wilderness Survival",
    tag: "Extreme Elements & Endurance",
    category: "action",
    color: "text-lime-400 border-lime-500/30",
    palette: "Frostbite whites, glacial blues, rugged pine greens",
  },

  // ── Sci-Fi & Speculative ──
  {
    id: "Sci-Fi / Space Horror",
    label: "Sci-Fi Space Horror",
    tag: "Atmospheric & Isolation",
    category: "scifi",
    color: "text-cyan-400 border-cyan-500/30",
    palette: "Deep void black, bulkhead warning amber, emergency cyan",
  },
  {
    id: "Dystopian Cyberpunk",
    label: "Cyberpunk",
    tag: "Corporate Power & Tech",
    category: "scifi",
    color: "text-blue-400 border-blue-500/30",
    palette: "Neon magenta, holographic turquoise, wet asphalt sheen",
  },
  {
    id: "Cosmic Sci-Fi / Space Opera",
    label: "Cosmic Sci-Fi",
    tag: "Interstellar Scale & Wonder",
    category: "scifi",
    color: "text-indigo-400 border-indigo-500/30",
    palette: "Nebula purples, starlight gold, relativistic distortion",
  },
  {
    id: "Time Paradox / Alternate Reality",
    label: "Temporal Paradox",
    tag: "Fractured Timelines & Loops",
    category: "scifi",
    color: "text-teal-400 border-teal-500/30",
    palette: "Chromatic aberration, sepia echoes, dual-exposure teal",
  },
  {
    id: "Post-Apocalyptic Survival",
    label: "Post-Apocalyptic",
    tag: "Scarcity & Ruin Exploration",
    category: "scifi",
    color: "text-yellow-600 border-yellow-700/30",
    palette: "Ochre dust, rusted iron, sun-bleached bone white",
  },

  // ── Noir & Mystery ──
  {
    id: "Neon Noir / Detective",
    label: "Neon Noir",
    tag: "Cynical & Chiaroscuro",
    category: "noir",
    color: "text-purple-400 border-purple-500/30",
    palette: "Sodium vapor yellow, venetian blind shadows, deep violet",
  },
  {
    id: "Gothic Mystery / Period Horror",
    label: "Gothic Mystery",
    tag: "Ancestral Dread & Decay",
    category: "noir",
    color: "text-slate-400 border-slate-500/30",
    palette: "Cobblestone grey, candlelight amber, faded velvet crimson",
  },
  {
    id: "Courtroom / Legal Thriller",
    label: "Courtroom Thriller",
    tag: "Institutional Truth & Law",
    category: "noir",
    color: "text-sky-400 border-sky-500/30",
    palette: "Polished oak, fluorescent institutional hum, stenographer parchment",
  },

  // ── Horror & Occult ──
  {
    id: "Supernatural / Occult Horror",
    label: "Occult Horror",
    tag: "Ancient Possession & Taboo",
    category: "horror",
    color: "text-red-400 border-red-500/30",
    palette: "Dried blood crimson, parchment ochre, unlit corner pitch black",
  },
  {
    id: "Folk Horror / Pagan Dread",
    label: "Folk Horror",
    tag: "Isolated Cults & Rites",
    category: "horror",
    color: "text-amber-500 border-amber-600/30",
    palette: "Overexposed summer sunlight, flower crown pastel, pagan woodcraft",
  },
  {
    id: "Body Horror / Bio-Thriller",
    label: "Body Horror",
    tag: "Visceral Biological Change",
    category: "horror",
    color: "text-rose-500 border-rose-600/30",
    palette: "Subcutaneous pink, surgical steel, sterile fluorescent white",
  },

  // ── Drama, Western & Epic ──
  {
    id: "Neo-Western / Borderlands",
    label: "Neo-Western",
    tag: "Frontier Morality & Dust",
    category: "drama",
    color: "text-amber-300 border-amber-400/30",
    palette: "Desert sandstone, denim indigo, late afternoon golden hour",
  },
  {
    id: "Political Drama / Satire",
    label: "Political Satire",
    tag: "Machiavellian Status & Power",
    category: "drama",
    color: "text-violet-400 border-violet-500/30",
    palette: "West Wing navy, Capitol marble, teleprompter green",
  },
  {
    id: "Family Dynasty / Succession",
    label: "Dynasty Drama",
    tag: "Inheritance & Bloodline War",
    category: "drama",
    color: "text-fuchsia-400 border-fuchsia-500/30",
    palette: "Executive cashmere grey, penthouse glass, vintage champagne",
  },
  {
    id: "High Fantasy / Mythic Epic",
    label: "Mythic Epic",
    tag: "Ancient Factions & Destiny",
    category: "epic",
    color: "text-emerald-300 border-emerald-400/30",
    palette: "Forged steel, banner gold, misty fjord emerald",
  },
  {
    id: "Dark Comedy / Social Thriller",
    label: "Dark Comedy",
    tag: "Cynical Wit & Class Friction",
    category: "drama",
    color: "text-pink-400 border-pink-500/30",
    palette: "High-contrast pristine surfaces, sharp pop accents, champagne sparkle",
  },
  {
    id: "Biographical / Historical Epic",
    label: "Historical Drama",
    tag: "True Stakes & Monumental Eras",
    category: "epic",
    color: "text-amber-200 border-amber-300/30",
    palette: "Vintage 70mm grain, archival sepia, statesman charcoal",
  },
];

export type SupportedCurrency = "USD" | "EUR" | "GBP" | "CAD" | "AUD" | "JPY";
export type BudgetCapPolicy = "advisory" | "hard_block";

export interface FilmPrecedent {
  film: string;
  director: string;
  why: string;
}

export interface ScoreBreakdown {
  budget_fit: number;
  creative_fit: number;
  shootability: number;
  consolidation_bonus: number;
}

export interface EstimatedCost {
  day_rate: number;
  permit_fee: number;
  currency: SupportedCurrency;
  notes?: string;
}

export interface LocationSource {
  title: string;
  url: string;
}

export interface DetailedCostItem {
  day_rate: number;
  permit_fee: number;
  fire_or_police_monitor?: number;
  security_or_site_rep?: number;
  basecamp_parking?: number;
  cleaning_deposit?: number;
  crew_travel_zone?: string;
  total_comprehensive?: number;
}

export interface FilmmakerReview {
  author: string;
  role: string;
  rating: number;
  date?: string;
  quote: string;
  project_type?: string;
}

export interface LocalProductionEconomy {
  studio_zone_status: string;
  tax_incentive?: string;
  nearby_vendors?: string[];
  accommodations_and_crew_hub?: string;
}

export type StageType =
  | "practical"
  | "soundstage"
  | "greenscreen_cyc"
  | "bluescreen_cyc"
  | "virtual_production"
  | "custom_build";

export interface StageSpecs {
  stage_type: StageType;
  grid_height?: string; // e.g. "24 ft clearance to lighting perms"
  square_footage?: number; // e.g. 4500
  dimensions?: string; // e.g. "60' x 45' x 24'H"
  cyc_type?: "none" | "green_screen" | "blue_screen" | "white_cyc" | "blackout" | "led_volume";
  cyc_dimensions?: string; // e.g. "3-wall infinite green cyc (45'W x 35'D x 20'H)"
  lighting_grid?: string; // e.g. "Motorized DMX truss with pre-hung Arri SkyPanel space lights"
  power_capacity?: string; // e.g. "1200A 3-Phase Camlock distribution"
  sound_rating?: string; // e.g. "NC-25 Sound Isolated (Certified Soundstage)"
  load_in_access?: string; // e.g. "14' x 16' Elephant Door with drive-in vehicle ramp"
  paint_or_restoration_fee?: number; // e.g. 500 (chroma green fresh coat / restoration fee)
  virtual_production_engine?: string; // e.g. "Unreal Engine 5.4 / Brompton SX40 / Disguise vx4"
  custom_set_notes?: string;
}

export interface LocationCandidate {
  candidate_id: string;
  name: string;
  region: string;
  category: string;
  rank_score: number;
  score_breakdown: ScoreBreakdown;
  estimated_cost: EstimatedCost;
  shared_with_scenes: string[];
  film_precedents: FilmPrecedent[];
  practical_notes: string;
  sources: LocationSource[];
  search_grounded: boolean;

  // In-depth production parameters
  pros?: string[];
  cons?: string[];
  reviews?: FilmmakerReview[];
  detailed_costs?: DetailedCostItem;
  local_economy?: LocalProductionEconomy;
  sound_and_acoustics?: string;
  power_specs?: string;

  // Studio & Green Screen Stage Specifications
  stage_specs?: StageSpecs;
  environment_type?: "practical" | "studio_stage" | "green_screen" | "virtual_production" | "custom_build";

  // Cinematic Scene Visual Preview Keyframe
  preview_image_url?: string;
  preview_image_prompt?: string;
  preview_style_preset?: string;
  preview_camera_framing?: string;
  gallery_images?: Array<{
    id: string;
    url: string;
    prompt?: string;
    style_preset?: string;
    camera_framing?: string;
    createdAt?: number;
    title?: string;
  }>;
}

export interface LocationCluster {
  cluster_id: string;
  name: string;
  region: string;
  category: string;
  scene_ids: string[];
  candidate_id: string;
  notes: string;
  estimated_savings?: string;
}

export interface ProjectBudgetAllocation {
  locationsPct: number;
  locationsAmount?: number;
  [key: string]: unknown;
}

export const CURRENCY_SYMBOLS: Record<SupportedCurrency, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  CAD: "CA$",
  AUD: "A$",
  JPY: "¥",
};

export function formatCurrency(amount: number, currency: SupportedCurrency = "USD"): string {
  const sym = CURRENCY_SYMBOLS[currency] || "$";
  if (amount >= 1_000_000) {
    return `${sym}${(amount / 1_000_000).toFixed(1)}M`;
  }
  if (amount >= 1_000) {
    return `${sym}${(amount / 1_000).toFixed(0)}K`;
  }
  return `${sym}${Math.round(amount).toLocaleString()}`;
}

export interface FilmScene {
  id: string;
  sceneNumber: number;
  title: string;
  slugline: string;
  summary: string;
  startSeconds: number;
  durationSeconds: number;
  location: string;
  castPresent: string[]; // character names present in scene
  castRoles?: Record<string, string>; // specific role/objective for each character in THIS scene (e.g. { "Elena": "Mastermind detailing infiltration", "Marcus": "Anxious driver questioning bypass" })
  screenplayText: string;
  directorStyle?: string;
  coreSecret?: string;
  floorPlanPreset?: string;
  floorPlanMapUrl?: string;
  floorPlanMapName?: string;
  floorPlanMapConfig?: {
    opacity?: number;
    scale?: number;
    offsetX?: number;
    offsetY?: number;
    rotation?: number;
    invert?: boolean;
    showGrid?: boolean;
  };
  isBridge?: boolean;
  shootRegion?: string; // per-scene regional/location override
  locationBudget?: number; // per-scene budget override
  selectedLocationCandidateId?: string;
  locationCandidates?: LocationCandidate[];
  preview_image_url?: string;
  sceneImages?: Array<{
    id: string;
    url: string;
    prompt: string;
    createdAt: number;
    title?: string;
    source?: "location" | "custom" | "video_ref";
  }>;
  nodes?: Node[];
  edges?: Edge[];
  events?: StoryEventMarker[];
  activeScoreUrl?: string;
  scoreTakes?: ScoreTake[];
  activeVideoUrl?: string;
  videoTakes?: VideoTake[];
  shots?: Shot[];
  timelineMoments?: TimelineMoment[];
}

// A still image generated for a specific timestamp within a scene's runtime,
// used by the Scene Timeline canvas mode. Multiple moments can share the same
// timestampSec, in which case they stack vertically under that point.
export interface TimelineMoment {
  id: string;
  timestampSec: number;
  imageUrl: string;
  prompt: string;
  createdAt: number;
  /** Style preset id used during generation (e.g. "anamorphic_35mm") */
  styleId?: string;
  /** Camera framing id used during generation (e.g. "wide_master") */
  framingId?: string;
  /** Human-readable label shown in gallery (e.g. "Opening · 35mm · Wide") */
  label?: string;
}

export interface ProjectData {
  id: string;
  userId?: string;
  title: string;
  genre: string;
  premise: string;
  sceneTitle: string;
  sceneSummary: string;
  screenplayText: string;
  characters: ProjectCharacter[];
  initialEvents: StoryEventMarker[];
  scenes?: FilmScene[];
  activeSceneId?: string;
  nodes?: Node[];
  edges?: Edge[];
  createdAt: number;
  updatedAt: number;
  isCustom?: boolean;
  isStarred?: boolean;
  directorStyle?: string;
  coreSecret?: string;
  primaryLocation?: string;
  floorPlanMapUrl?: string;
  floorPlanMapName?: string;
  floorPlanMapConfig?: {
    opacity?: number;
    scale?: number;
    offsetX?: number;
    offsetY?: number;
    rotation?: number;
    invert?: boolean;
    showGrid?: boolean;
  };
  shootRegion?: string; // production base city / region (e.g. "Los Angeles, CA")
  currency?: SupportedCurrency;
  budget?: number; // total production budget
  budgetPerShootDayUsd?: number; // day rate in project currency
  budgetAllocation?: ProjectBudgetAllocation;
  budgetCapPolicy?: BudgetCapPolicy; // "advisory" | "hard_block"
  locationClusters?: LocationCluster[];
  targetTerritories?: string[];
  povScripts?: Record<string, string>; // characterName -> POV script
  scratchpadNotes?: ScratchpadNote[];
  activeSequenceJob?: ShotSequenceJob;
  activeVideoUrl?: string;
  videoTakes?: VideoTake[];
  activeScoreUrl?: string;
  scoreTakes?: ScoreTake[];
  storyboardFrameUrl?: string;
  seedVersion?: number;
  narrativeFormat?: NarrativeFormat;
  targetRuntimeMinutes?: number;
  scenePlacementSeconds?: number;
  sceneDurationSeconds?: number;
  totalScenesEstimate?: number;
}

// ---------------------------------------------------------------------------
// Session + in-memory cache
// ---------------------------------------------------------------------------

let activeUserId: string | null = null;
let activeAuthToken: string | null = null;

// `null` means "not hydrated yet" and is distinct from "hydrated, empty".
let projectsCache: ProjectData[] | null = null;
let talentVaultCache: ProjectCharacter[] | null = null;
let scratchpadCache: ScratchpadNote[] | null = null;
let hydrationPromise: Promise<void> | null = null;

/** True once a signed-in session's data has been pulled from Supabase. */
export function isStoreHydrated(): boolean {
  return projectsCache !== null;
}

function clearCaches(): void {
  projectsCache = null;
  talentVaultCache = null;
  scratchpadCache = null;
  hydrationPromise = null;
}

/**
 * Sets the active authenticated user and Supabase access token.
 *
 * Signing in drops any previous account's cached data and kicks off a cloud
 * hydration; signing out drops the cache so one account's work can never be
 * visible to the next session on the same browser.
 */
export function setActiveUser(userId: string | null, token: string | null = null): void {
  const accountChanged = activeUserId !== userId;
  activeUserId = userId;
  activeAuthToken = token;

  if (accountChanged) {
    clearCaches();
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("agentic_cinema_auth_changed", { detail: { userId } }));
    // Hydrate on first sign-in. A token refresh re-enters here with the same
    // account and a warm cache, which must not trigger a redundant refetch.
    if (userId && token && !projectsCache) {
      void hydrateStore();
    }
  }
}

/** In-memory only — there is no persisted fallback by design. */
export function getActiveUserId(): string | null {
  return activeUserId;
}

/** In-memory only — there is no persisted fallback by design. */
export function getActiveAuthToken(): string | null {
  return activeAuthToken;
}

export function getAuthHeaders(): Record<string, string> {
  const token = getActiveAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function authHeaders(json = false): Record<string, string> {
  return json
    ? { "Content-Type": "application/json", ...getAuthHeaders() }
    : { ...getAuthHeaders() };
}

async function fetchCollection<T>(
  path: string,
  key: string,
  label: string
): Promise<T[] | null> {
  const res = await fetch(path, { headers: authHeaders(), cache: "no-store" });
  if (!res.ok) {
    console.warn(`[ProjectStore] ${label} fetch failed (${res.status})`);
    return null;
  }
  const data = await res.json();
  return Array.isArray(data?.[key]) ? (data[key] as T[]) : null;
}

/**
 * Pulls projects, talent vault and scratchpad notes from Supabase into the
 * in-memory caches. Concurrent calls share one in-flight request; a sign-out
 * mid-flight discards the result rather than repopulating a dead session.
 */
export function hydrateStore(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (!activeUserId || !activeAuthToken) return Promise.resolve();
  if (hydrationPromise) return hydrationPromise;

  const requestedUserId = activeUserId;

  hydrationPromise = (async () => {
    try {
      const [projects, talent, notes] = await Promise.all([
        fetchCollection<ProjectData>("/api/projects", "projects", "projects"),
        fetchCollection<ProjectCharacter>("/api/talent", "talent", "talent vault"),
        fetchCollection<ScratchpadNote>("/api/notes", "notes", "scratchpad"),
      ]);

      // The session may have ended or switched while these were in flight.
      if (activeUserId !== requestedUserId) return;

      projectsCache = (projects ?? []).map(ensureProjectScenes);
      talentVaultCache = talent ?? [];
      scratchpadCache = notes ?? [];
    } catch (err) {
      console.warn("[ProjectStore] Cloud hydration failed:", err);
    } finally {
      hydrationPromise = null;
      if (typeof window !== "undefined" && activeUserId === requestedUserId) {
        window.dispatchEvent(new CustomEvent("agentic_cinema_store_hydrated"));
      }
    }
  })();

  return hydrationPromise;
}

/** Wipes any legacy browser-persisted app data left by earlier versions. */
export function purgeLegacyLocalData(): void {
  if (typeof window === "undefined") return;
  try {
    const doomed: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith("agentic_cinema_")) doomed.push(key);
    }
    for (const key of doomed) localStorage.removeItem(key);
    for (let i = sessionStorage.length - 1; i >= 0; i -= 1) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith("cinema_vcs_")) sessionStorage.removeItem(key);
    }
  } catch (err) {
    console.warn("[ProjectStore] Could not purge legacy local data:", err);
  }
}

/**
 * Ensures a project has a `scenes` array and that `activeSceneId` points at a
 * real scene. There is no seed/preset fallback any more: a project's scenes
 * come from its own stored data or from a single auto-wrapped scene.
 */
export function ensureProjectScenes(project: ProjectData): ProjectData {
  if (project.scenes && project.scenes.length > 0) {
    if (!project.activeSceneId || !project.scenes.some((s) => s.id === project.activeSceneId)) {
      project.activeSceneId = project.scenes[0].id;
    }
    return project;
  }

  // Auto-wrap a legacy single-scene project into the scenes array.
  const defaultScene: FilmScene = {
    id: `${project.id}-sc-01`,
    sceneNumber: 1,
    title: project.sceneTitle || "Scene 01",
    slugline: project.primaryLocation || "INT. PRIMARY LOCATION - DAY",
    summary: project.sceneSummary || "",
    startSeconds: project.scenePlacementSeconds ?? 1800,
    durationSeconds: project.sceneDurationSeconds ?? 180,
    location: project.primaryLocation || "Primary Stage",
    castPresent: (project.characters || []).map((c) => c.name),
    screenplayText: project.screenplayText || "",
    directorStyle: project.directorStyle,
    coreSecret: project.coreSecret,
    floorPlanMapUrl: project.floorPlanMapUrl,
    floorPlanMapName: project.floorPlanMapName,
    floorPlanMapConfig: project.floorPlanMapConfig,
    nodes: project.nodes,
    edges: project.edges,
    events: project.initialEvents,
  };

  project.scenes = [defaultScene];
  project.activeSceneId = defaultScene.id;
  return project;
}

/**
 * All projects for the active account, from the in-memory cloud cache.
 * Returns an empty list until `hydrateStore()` has completed — callers that
 * need to distinguish "loading" from "empty" should check `isStoreHydrated()`.
 */
export function getAllProjects(): ProjectData[] {
  return projectsCache ?? [];
}

/**
 * Looks a project up in the in-memory cache. With seed presets gone, an
 * unknown id is genuinely unknown — there is no fabricated fallback project.
 */
export function getProjectById(id: string): ProjectData | null {
  const found = (projectsCache ?? []).find((p) => p.id === id);
  return found ? ensureProjectScenes(found) : null;
}

/**
 * Applies a project to the in-memory cache and mirrors it to Supabase.
 *
 * The cache is updated first so the UI reflects the change immediately; the
 * cloud write is the durable one. Returns false when there is no session —
 * the app is login-gated, so that only happens if one expired mid-edit.
 */
export function saveProject(project: ProjectData): boolean {
  if (typeof window === "undefined") return false;

  const uid = getActiveUserId();
  if (!uid || !getActiveAuthToken()) {
    console.warn("[ProjectStore] saveProject ignored: no authenticated session.");
    return false;
  }

  const updatedProject: ProjectData = {
    ...project,
    userId: project.userId || uid,
    updatedAt: Date.now(),
  };

  const current = projectsCache ?? [];
  const index = current.findIndex((p) => p.id === updatedProject.id);
  projectsCache =
    index >= 0
      ? current.map((p, i) => (i === index ? updatedProject : p))
      : [updatedProject, ...current];

  fetch("/api/projects", {
    method: "POST",
    headers: authHeaders(true),
    body: JSON.stringify(updatedProject),
  }).catch((err) => {
    console.warn("[ProjectStore] Project cloud sync warning:", err);
  });

  return true;
}

/**
 * Re-reads the account's projects from Supabase into the cache and returns them.
 */
export async function syncProjectsWithSupabase(): Promise<ProjectData[]> {
  if (typeof window === "undefined") return getAllProjects();
  if (!getActiveAuthToken()) return getAllProjects();

  const remote = await fetchCollection<ProjectData>("/api/projects", "projects", "projects");
  if (remote === null) return getAllProjects();

  projectsCache = remote.map(ensureProjectScenes);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("agentic_cinema_store_hydrated"));
  }
  return projectsCache;
}

/**
 * Toggles starred status for a project.
 */
export function toggleStarProject(id: string): boolean {
  const project = (projectsCache ?? []).find((p) => p.id === id);
  if (!project) return false;
  project.isStarred = !project.isStarred;
  saveProject(project);
  return Boolean(project.isStarred);
}

/**
 * Removes a project from the cache and deletes it from Supabase.
 */
export function deleteProject(id: string): void {
  if (typeof window === "undefined") return;

  projectsCache = (projectsCache ?? []).filter((p) => p.id !== id);

  fetch(`/api/projects/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: authHeaders(),
  }).catch((err) => {
    console.warn("[ProjectStore] Project cloud delete warning:", err);
  });
}


/**
 * Contextually synthesizes unique, genre-tailored characters with rich
 * psychological dials and objectives.
 */
export function synthesizeDynamicCharacters(genre: string = "", premise: string = ""): ProjectCharacter[] {
  const g = genre.toLowerCase();
  const p = premise.toLowerCase();

  // 1. Check if specific names were explicitly mentioned in the text
  const nameMatches = premise.match(/\b([A-Z][a-z]{2,14})\b/g);
  const ignored = new Set([
    "The", "In", "On", "At", "A", "An", "With", "When", "And", "Create", "Direct",
    "Make", "Write", "About", "Scene", "Slate", "ClickHouse", "Gemini", "Standard",
    "Studio", "Production", "Act", "Draft", "Opening", "Hook", "Dialogue",
    "Villeneuve", "Fincher", "Nolan", "Mann", "What", "How", "Why", "Where", "Who"
  ]);
  const foundNames = Array.from(new Set(nameMatches ? nameMatches.filter((n) => !ignored.has(n)) : []));

  if (foundNames.length >= 2) {
    return [
      {
        name: foundNames[0],
        role: "Lead Protagonist",
        archetype: "Undercover operator navigating extreme tension",
        speechStyle: "guarded, direct, observant",
        subtextRatio: "high",
        confidence: 80,
        verbalPacing: 75,
        objective: "Control the situation before the perimeter fails",
        dialsSummary: "Confidence 80% · Subtext 85%",
        quirks: ["Checks exits upon entering", "Speaks in measured pauses"],
      },
      {
        name: foundNames[1],
        role: "Strategic Foil / Antagonist",
        archetype: "Counterpart with concealed motives and hidden agenda",
        speechStyle: "calm, dismissive, calculated",
        subtextRatio: "extreme",
        confidence: 90,
        verbalPacing: 80,
        objective: "Manipulate the outcome for personal leverage",
        dialsSummary: "Confidence 90% · Subtext 95%",
        quirks: ["Avoids direct answers", "Keeps physical distance"],
      },
    ];
  }

  // 2. Genre-tailored dynamic ensembles
  if (g.includes("sci-fi") || g.includes("space") || p.includes("space") || p.includes("orbital")) {
    const sets = [
      [
        { name: "Vance", role: "Mission Commander", archetype: "Exhausted veteran bound by station protocol", speechStyle: "authoritative, frayed", objective: "Seal the orbital breach before oxygen depletion" },
        { name: "Dr. Ray", role: "Station Biologist", archetype: "Concealing a private quarantine bypass", speechStyle: "defensive, rapid-fire", objective: "Protect the sample at all costs" },
        { name: "ECHO-9", role: "Synthetic Core", archetype: "Calculating AI prioritizing station preservation", speechStyle: "chillingly monotone", objective: "Execute emergency quarantine purge" },
      ],
      [
        { name: "Kaelen", role: "Orbital Navigator", archetype: "Rogue pilot operating outside comms grid", speechStyle: "laconic, sharp", objective: "Align thrusters before gravity collapse" },
        { name: "Dr. Thorne", role: "Astrophysicist", archetype: "Desperate scientist withholding sensor telemetry", speechStyle: "clinical, panicked", objective: "Transmit deep-space telemetry to private buyer" },
      ],
    ];
    const pick = sets[Math.floor(Math.random() * sets.length)];
    return pick.map((c, i) => ({
      ...c,
      subtextRatio: i === 1 ? "extreme" : "high",
      confidence: 75 + i * 10,
      dialsSummary: `Confidence ${75 + i * 10}% · Subtext ${i === 1 ? "95%" : "80%"}`,
      quirks: [i === 0 ? "Checks oxygen telemetry compulsively" : "Avoids direct eye contact"],
    }));
  }

  if (g.includes("noir") || g.includes("cyber") || p.includes("noir") || p.includes("detective")) {
    const sets = [
      [
        { name: "Silas Cole", role: "Disgraced Detective", archetype: "Obsessive investigator tied to a cold case", speechStyle: "gravelly, cynical, perceptive", objective: "Find the mole before internal affairs locks the docket" },
        { name: "Verona", role: "Syndicate Fixer", archetype: "Enigmatic operator holding forged warrants", speechStyle: "velvety, mocking, dangerous", objective: "Steer the investigation away from the harbor vault" },
      ],
      [
        { name: "Jaxon", role: "Rogue Netrunner", archetype: "Black-market data broker with cybernetic implants", speechStyle: "clipped, jittery, technical", objective: "Dump the encrypted ledger before neural fry" },
        { name: "Agent Chen", role: "Corporate Infiltrator", archetype: "Slick operative executing a corporate extraction", speechStyle: "diplomatic, razor-sharp", objective: "Retrieve the bio-drive intact" },
      ],
    ];
    const pick = sets[Math.floor(Math.random() * sets.length)];
    return pick.map((c, i) => ({
      ...c,
      subtextRatio: i === 1 ? "extreme" : "high",
      confidence: 80 + i * 5,
      dialsSummary: `Confidence ${80 + i * 5}% · Subtext ${i === 1 ? "95%" : "85%"}`,
      quirks: [i === 0 ? "Lights matches without striking" : "Scans security cameras"],
    }));
  }

  if (g.includes("drama") || g.includes("psychological") || p.includes("psychological") || p.includes("memory")) {
    return [
      {
        name: "Arthur",
        role: "Lead Protagonist",
        archetype: "Unreliable narrator suffering from fractured recall",
        speechStyle: "hesitant, searching, emotionally raw",
        subtextRatio: "high",
        confidence: 65,
        objective: "Piece together the night of the incident",
        dialsSummary: "Confidence 65% · Subtext 90%",
        quirks: ["Rubs index finger along temple", "Corrects own sentences mid-thought"],
      },
      {
        name: "Dr. Oswald",
        role: "Clinical Specialist",
        archetype: "Probing interrogator with confidential motives",
        speechStyle: "soft-spoken, surgical, relentless",
        subtextRatio: "extreme",
        confidence: 95,
        objective: "Trigger the key psychological breakthrough",
        dialsSummary: "Confidence 95% · Subtext 95%",
        quirks: ["Maintains unbroken eye contact", "Takes slow handwritten notes"],
      },
    ];
  }

  if (g.includes("horror") || g.includes("occult") || g.includes("folk") || p.includes("cult") || p.includes("ritual") || p.includes("curse")) {
    const sets = [
      [
        { name: "Father Thomas", role: "Vatican Inquisitor", archetype: "Faith-shaken scholar confronting an ancient entity", speechStyle: "whispered, urgent, liturgical", objective: "Seal the forbidden reliquary before nightfall" },
        { name: "Evelyn", role: "Occult Archivist", archetype: "Keeper of her family's blood curse", speechStyle: "cryptic, hypnotic, unflinching", objective: "Complete the binding ritual before sunrise" },
      ],
      [
        { name: "Dr. Mara", role: "Coroner / Pathologist", archetype: "Skeptical medical examiner discovering anomalous tissue biology", speechStyle: "clinical, trembling, intense", objective: "Document the anomaly before quarantine locks down" },
        { name: "Jonah", role: "Commune Elder", archetype: "Charismatic rural leader hiding ancestral sacrifices", speechStyle: "melodic, soothing, terrifying", objective: "Ensure the outsider does not leave the valley" },
      ],
    ];
    const pick = sets[Math.floor(Math.random() * sets.length)];
    return pick.map((c, i) => ({
      ...c,
      subtextRatio: i === 1 ? "extreme" : "high",
      confidence: 70 + i * 15,
      dialsSummary: `Confidence ${70 + i * 15}% · Subtext ${i === 1 ? "95%" : "85%"}`,
      quirks: [i === 0 ? "Clutches wooden rosary until knuckles whiten" : "Smiles without warmth"],
    }));
  }

  if (g.includes("western") || g.includes("border") || p.includes("frontier") || p.includes("desert")) {
    return [
      {
        name: "Colt Callahan",
        role: "Disillusioned Bounty Hunter",
        archetype: "Weathered gunslinger bound by a code of silent retribution",
        speechStyle: "drawled, lethal, economical",
        subtextRatio: "high",
        confidence: 85,
        objective: "Bring in the cartel defector before the posse catches up",
        dialsSummary: "Confidence 85% · Subtext 80%",
        quirks: ["Spits matchstick, never blinks in sunlight", "Checks cylinder chambers by touch"],
      },
      {
        name: "Marisol",
        role: "Frontier Marshal",
        archetype: "Unyielding law keeper defending an isolated outpost",
        speechStyle: "dry, sharp, defiant",
        subtextRatio: "extreme",
        confidence: 90,
        objective: "Hold the territorial border against executive syndicates",
        dialsSummary: "Confidence 90% · Subtext 90%",
        quirks: ["Restens spurs before answering", "Keeps right hand resting near holster"],
      },
    ];
  }

  if (g.includes("epic") || g.includes("mythic") || g.includes("fantasy") || g.includes("historical") || p.includes("kingdom") || p.includes("dynasty")) {
    return [
      {
        name: "Lord Vaelen",
        role: "Exiled Commander",
        archetype: "Disgraced warlord seeking redemption through forbidden conquest",
        speechStyle: "booming, imperious, burdened",
        subtextRatio: "high",
        confidence: 85,
        objective: "Reclaim the ancestral standard before winter descends",
        dialsSummary: "Confidence 85% · Subtext 80%",
        quirks: ["Touches hilt when challenged", "Speaks in ancient royal syntax"],
      },
      {
        name: "Seer Lyra",
        role: "Court Mystic",
        archetype: "Blind prophet caught between rival bloodlines",
        speechStyle: "rhythmic, poetic, ominous",
        subtextRatio: "extreme",
        confidence: 95,
        objective: "Prevent the cataclysm foretold in the star scrolls",
        dialsSummary: "Confidence 95% · Subtext 95%",
        quirks: ["Tilts head as if hearing distant thunder", "Traces runes in cold tea"],
      },
    ];
  }

  if (g.includes("espionage") || g.includes("cold war") || g.includes("political") || p.includes("embassy") || p.includes("kgb") || p.includes("cia")) {
    return [
      {
        name: "Agent Cross",
        role: "Disavowed Operative",
        archetype: "Intelligence ghost playing multiple agencies against each other",
        speechStyle: "clipped, analytical, ice-cold",
        subtextRatio: "extreme",
        confidence: 90,
        objective: "Exfiltrate the decrypted nuclear ledger before the embassy lockdown",
        dialsSummary: "Confidence 90% · Subtext 95%",
        quirks: ["Always sits facing the service entrance", "Checks mirror reflections when lighting a cigarette"],
      },
      {
        name: "Elena Rostova",
        role: "Station Chief",
        archetype: "Counterintelligence director with classified clearance",
        speechStyle: "composed, iron-fisted, razor-sharp",
        subtextRatio: "extreme",
        confidence: 95,
        objective: "Identify and neutralize the mole before the dawn summit",
        dialsSummary: "Confidence 95% · Subtext 90%",
        quirks: ["Taps fountain pen in three-beat intervals", "Speaks fluent diplomatic euphemisms"],
      },
    ];
  }

  // Default Heist / Action Thriller dynamic characters
  const defaultEnsembles = [
    [
      { name: "Dante", role: "Heist Mastermind", archetype: "Slick strategist anticipating partner betrayal", speechStyle: "calm, deliberate", objective: "Execute the vault breach before the alarm cycles" },
      { name: "Roxanne", role: "Safecracker", archetype: "Infiltrator with an unsanctioned side contract", speechStyle: "sarcastic, precise", objective: "Swap the primary payload with a dummy" },
    ],
    [
      { name: "Cassian", role: "Security Chief", archetype: "Loyal operator suspecting executive corruption", speechStyle: "gruff, uncompromising", objective: "Lockdown the sub-levels before breach" },
      { name: "Nadia", role: "Federal Courier", archetype: "Covert agent carrying diplomatic immunity", speechStyle: "polished, unreadable", objective: "Exfiltrate the biometric briefcase" },
    ],
  ];
  const chosen = defaultEnsembles[Math.floor(Math.random() * defaultEnsembles.length)];
  return chosen.map((c, i) => ({
    ...c,
    subtextRatio: i === 1 ? "extreme" : "high",
    confidence: 80 + i * 10,
    dialsSummary: `Confidence ${80 + i * 10}% · Subtext ${i === 1 ? "95%" : "80%"}`,
    quirks: [i === 0 ? "Constantly checks the chronograph" : "Glances at the security monitors"],
  }));
}

export interface CreateProjectOptions {
  id?: string;
  userId?: string;
  title: string;
  logline: string;
  genre?: string;
  characters?: string;
  directorStyle?: string;
  coreSecret?: string;
  primaryLocation?: string;
  shootRegion?: string;
  currency?: SupportedCurrency;
  budget?: number;
  budgetPerShootDayUsd?: number;
  budgetAllocation?: ProjectBudgetAllocation;
  budgetCapPolicy?: BudgetCapPolicy;
  targetTerritories?: string[];
  customCharacters?: ProjectCharacter[];
  narrativeFormat?: NarrativeFormat;
  targetRuntimeMinutes?: number;
  scenePlacementSeconds?: number;
  sceneDurationSeconds?: number;
  totalScenesEstimate?: number;
}

/**
 * Creates a new blank/pending project entry and persists it to the cloud, with
 * optional custom characters, director styling, narrative format, and target
 * timeframe parameters.
 */
export function createNewProjectEntry(data: CreateProjectOptions): ProjectData {
  const newPid = data.id || `project-${Date.now().toString(36)}`;
  const activeUid = data.userId || getActiveUserId();
  
  let initialChars: ProjectCharacter[] = [];

  if (data.customCharacters && data.customCharacters.length > 0) {
    initialChars = data.customCharacters;
  } else if (data.characters && data.characters.trim().length > 0) {
    const parsedCharNames = data.characters
      .split(/[,;\n]+/)
      .map((c) => c.trim())
      .filter(Boolean);

    initialChars = parsedCharNames.map((name, i) => ({
      name: name.split(/\s+/)[0],
      role: i === 0 ? "Protagonist" : "Key Counterpart",
      archetype: name.includes("(") ? name.split("(")[1].replace(")", "") : `Character ${i + 1}`,
      speechStyle: "naturalistic, guarded",
      subtextRatio: "high",
      objective: "Resolve the central conflict before time expires",
      dialsSummary: "Confidence 85% · Subtext 80%",
    }));
  } else {
    initialChars = synthesizeDynamicCharacters(data.genre, data.logline);
  }

  const format: NarrativeFormat = data.narrativeFormat || "feature";
  const formatConfig = NARRATIVE_FORMATS[format] || NARRATIVE_FORMATS.feature;
  const runtimeMins = data.targetRuntimeMinutes || formatConfig.defaultMinutes;
  const placementSecs = data.scenePlacementSeconds ?? 0;
  const totalScenes = data.totalScenesEstimate || Math.round(runtimeMins / 3);

  const loc = data.primaryLocation ? data.primaryLocation.trim() : "Operational Hub";
  const locUpper = loc.toUpperCase();
  const c1 = initialChars[0]?.name || "Lead";
  const c2 = initialChars[1]?.name || "Counterpart";
  const totalRuntimeSec = runtimeMins * 60;

  const totalBudget = data.budget ?? 850_000;
  const locPct = data.budgetAllocation?.locationsPct ?? 15;
  const locBudget = data.budgetAllocation?.locationsAmount ?? Math.round(totalBudget * (locPct / 100));

  const starterSceneSummary = data.logline
    ? `Opening sequence establishing "${data.title}": ${data.logline.trim()}`
    : `Opening sequence introducing ${c1} and establishing the production world.`;

  const starterScreenplayText = `INT. ${locUpper} - DAY\n\n[ESTABLISHING SEQUENCE]\n\nThe world of "${data.title}" opens at ${loc}.\n\n${starterSceneSummary}\n\n${c1.toUpperCase()}\n[Scene dialogue to be developed in the Screenplay editor]`;

  const defaultScenes: FilmScene[] = [
    {
      id: `${newPid}-scene-01`,
      sceneNumber: 1,
      title: "Scene 1: Establishing Beat",
      slugline: `INT. ${locUpper} - DAY`,
      summary: starterSceneSummary,
      startSeconds: 0,
      durationSeconds: Math.round(totalRuntimeSec / Math.max(1, totalScenes)),
      location: loc,
      shootRegion: data.shootRegion || "Los Angeles, CA",
      locationBudget: locBudget,
      castPresent: [c1, ...(c2 !== c1 ? [c2] : [])],
      castRoles: {
        [c1]: "Protagonist",
        ...(c2 !== c1 ? { [c2]: "Counterpart" } : {}),
      },
      screenplayText: starterScreenplayText,
    },
  ];

  const newProject: ProjectData = {
    id: newPid,
    userId: activeUid || undefined,
    title: data.title.trim(),
    genre: data.genre || "Drama / Thriller",
    premise: data.logline.trim(),
    scenes: defaultScenes,
    activeSceneId: defaultScenes[0].id,
    sceneTitle: defaultScenes[0].title,
    sceneSummary: defaultScenes[0].summary,
    screenplayText: defaultScenes[0].screenplayText,
    characters: initialChars,
    initialEvents: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isCustom: true,
    directorStyle: data.directorStyle,
    coreSecret: data.coreSecret,
    primaryLocation: data.primaryLocation,
    shootRegion: data.shootRegion || "Los Angeles, CA",
    currency: data.currency || "USD",
    budget: totalBudget,
    budgetPerShootDayUsd: data.budgetPerShootDayUsd ?? 85_000,
    budgetAllocation: data.budgetAllocation || {
      locationsPct: locPct,
      locationsAmount: locBudget,
    },
    budgetCapPolicy: data.budgetCapPolicy || "advisory",
    targetTerritories: data.targetTerritories,
    povScripts: {},
    scratchpadNotes: [],
    activeVideoUrl: "/videos/cinematic_demo.mp4",
    narrativeFormat: format,
    targetRuntimeMinutes: runtimeMins,
    scenePlacementSeconds: placementSecs,
    sceneDurationSeconds: data.sceneDurationSeconds ?? 180,
    totalScenesEstimate: totalScenes,
    videoTakes: [
      {
        id: `take-${Date.now()}-01`,
        takeNumber: 1,
        title: `${data.title.trim()} — Take 01`,
        cameraMotion: "35mm Anamorphic Tracking Shot",
        stylePreset: data.directorStyle ? `${data.directorStyle}, 35mm Scope` : "35mm Anamorphic Film, 2.39:1 Scope",
        durationSec: 6,
        createdAt: Date.now(),
        videoUrl: "/videos/cinematic_demo.mp4",
        prompt: `Cinematic establishing scene for ${data.title.trim()}. 35mm anamorphic widescreen scope.`,
        isMaster: true,
      },
    ],
  };

  saveProject(newProject);
  return newProject;
}


/**
 * Updates a project's narrative scope, target runtime, or scene pinpoint anchor,
 * as well as directorial blueprint parameters (tone, secrets, location, target territories).
 */
export function updateProjectTimeframe(
  projectId: string,
  updates: {
    narrativeFormat?: NarrativeFormat;
    targetRuntimeMinutes?: number;
    scenePlacementSeconds?: number;
    sceneDurationSeconds?: number;
    directorStyle?: string;
    coreSecret?: string;
    primaryLocation?: string;
    shootRegion?: string;
    currency?: SupportedCurrency;
    budget?: number;
    budgetPerShootDayUsd?: number;
    budgetAllocation?: ProjectBudgetAllocation;
    budgetCapPolicy?: BudgetCapPolicy;
    targetTerritories?: string[];
    genre?: string;
  }
): ProjectData | null {
  const proj = getProjectById(projectId);
  if (!proj) return null;
  const updated: ProjectData = {
    ...proj,
    narrativeFormat: updates.narrativeFormat ?? proj.narrativeFormat ?? "feature",
    targetRuntimeMinutes: updates.targetRuntimeMinutes ?? proj.targetRuntimeMinutes ?? 90,
    scenePlacementSeconds: updates.scenePlacementSeconds ?? proj.scenePlacementSeconds ?? 0,
    sceneDurationSeconds: updates.sceneDurationSeconds ?? proj.sceneDurationSeconds ?? 180,
    directorStyle: updates.directorStyle !== undefined ? updates.directorStyle : proj.directorStyle,
    coreSecret: updates.coreSecret !== undefined ? updates.coreSecret : proj.coreSecret,
    primaryLocation: updates.primaryLocation !== undefined ? updates.primaryLocation : proj.primaryLocation,
    shootRegion: updates.shootRegion !== undefined ? updates.shootRegion : proj.shootRegion,
    currency: updates.currency !== undefined ? updates.currency : proj.currency,
    budget: updates.budget !== undefined ? updates.budget : proj.budget,
    budgetPerShootDayUsd: updates.budgetPerShootDayUsd !== undefined ? updates.budgetPerShootDayUsd : proj.budgetPerShootDayUsd,
    budgetAllocation: updates.budgetAllocation !== undefined ? updates.budgetAllocation : proj.budgetAllocation,
    budgetCapPolicy: updates.budgetCapPolicy !== undefined ? updates.budgetCapPolicy : proj.budgetCapPolicy,
    targetTerritories: updates.targetTerritories !== undefined ? updates.targetTerritories : proj.targetTerritories,
    genre: updates.genre !== undefined ? updates.genre : proj.genre,
    updatedAt: Date.now(),
  };
  saveProject(updated);
  return updated;
}

/**
 * All saved talent profiles for the active account, from the in-memory cache.
 */
export function getTalentVault(): ProjectCharacter[] {
  return talentVaultCache ?? [];
}

/**
 * Saves a character profile to the reusable studio Talent Vault and mirrors it
 * to Supabase. The cache is updated first so the vault renders immediately.
 */
export function saveToTalentVault(character: ProjectCharacter): void {
  if (typeof window === "undefined") return;

  const vault = talentVaultCache ?? [];
  const existingIdx = vault.findIndex(
    (c) => c.name.toLowerCase() === character.name.toLowerCase()
  );
  talentVaultCache =
    existingIdx >= 0
      ? vault.map((c, i) => (i === existingIdx ? character : c))
      : [character, ...vault];

  if (!getActiveAuthToken()) return;
  fetch("/api/talent", {
    method: "POST",
    headers: authHeaders(true),
    body: JSON.stringify(character),
  }).catch((err) => {
    console.warn("[ProjectStore] Talent vault cloud sync warning:", err);
  });
}

/**
 * Removes a character from the studio Talent Vault and from Supabase.
 */
export function deleteFromTalentVault(characterName: string): void {
  if (typeof window === "undefined") return;

  talentVaultCache = (talentVaultCache ?? []).filter(
    (c) => c.name.toLowerCase() !== characterName.toLowerCase()
  );

  if (!getActiveAuthToken()) return;
  fetch(`/api/talent?name=${encodeURIComponent(characterName)}`, {
    method: "DELETE",
    headers: authHeaders(),
  }).catch((err) => {
    console.warn("[ProjectStore] Talent vault cloud delete warning:", err);
  });
}

/**
 * Re-reads the talent vault from Supabase into the cache and returns it.
 */
export async function syncTalentVaultWithSupabase(): Promise<ProjectCharacter[]> {
  if (typeof window === "undefined") return getTalentVault();
  if (!getActiveAuthToken()) return getTalentVault();

  const remote = await fetchCollection<ProjectCharacter>("/api/talent", "talent", "talent vault");
  if (remote === null) return getTalentVault();

  talentVaultCache = remote;
  return remote;
}

/**
 * Scratchpad notes for a project (or all notes) from the in-memory cache.
 */
export function getScratchpadNotes(projectId?: string): ScratchpadNote[] {
  const notes = scratchpadCache ?? [];
  if (projectId) {
    return notes.filter((n) => !n.projectId || n.projectId === projectId);
  }
  return notes;
}

/**
 * Saves or updates a scratchpad note, mirroring it to Supabase.
 */
export function saveScratchpadNote(note: ScratchpadNote): void {
  if (typeof window === "undefined") return;

  const uid = getActiveUserId();
  const noteWithUser: ScratchpadNote = {
    ...note,
    userId: note.userId || uid || undefined,
  };

  const notes = scratchpadCache ?? [];
  const idx = notes.findIndex((n) => n.id === note.id);
  scratchpadCache =
    idx >= 0
      ? notes.map((n, i) => (i === idx ? noteWithUser : n))
      : [noteWithUser, ...notes];

  if (!getActiveAuthToken()) return;
  fetch("/api/notes", {
    method: "POST",
    headers: authHeaders(true),
    body: JSON.stringify(noteWithUser),
  }).catch((err) => {
    console.warn("[ProjectStore] Scratchpad cloud sync warning:", err);
  });
}

/**
 * Re-reads scratchpad notes from Supabase into the cache and returns them.
 */
export async function syncScratchpadNotesWithSupabase(projectId?: string): Promise<ScratchpadNote[]> {
  if (typeof window === "undefined") return getScratchpadNotes(projectId);
  if (!getActiveAuthToken()) return getScratchpadNotes(projectId);

  const remote = await fetchCollection<ScratchpadNote>("/api/notes", "notes", "scratchpad");
  if (remote === null) return getScratchpadNotes(projectId);

  scratchpadCache = remote;
  return getScratchpadNotes(projectId);
}

/**
 * Deletes a scratchpad note by ID and from Supabase.
 */
export function deleteScratchpadNote(id: string): void {
  if (typeof window === "undefined") return;

  scratchpadCache = (scratchpadCache ?? []).filter((n) => n.id !== id);

  if (!getActiveAuthToken()) return;
  fetch(`/api/notes?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: authHeaders(),
  }).catch((err) => {
    console.warn("[ProjectStore] Scratchpad cloud delete warning:", err);
  });
}


/**
 * Gets all saved video takes for a given project.
 */
export function getVideoTakes(projectId: string): VideoTake[] {
  const project = getProjectById(projectId);
  if (!project) return [];
  return project.videoTakes || [];
}

/**
 * Saves a newly rendered or existing video take to the project's permanent take vault.
 */
export function saveVideoTake(
  projectId: string,
  takeData: Omit<VideoTake, "id" | "takeNumber" | "createdAt"> & { id?: string; takeNumber?: number; sceneId?: string }
): VideoTake {
  const project = getProjectById(projectId);
  const currentTakes = project?.videoTakes || [];
  const nextNum = takeData.takeNumber || currentTakes.length + 1;

  const newTake: VideoTake = {
    id: takeData.id || `take-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    takeNumber: nextNum,
    title: takeData.title || `${project?.sceneTitle || "Scene"} — Take ${String(nextNum).padStart(2, "0")}`,
    cameraMotion: takeData.cameraMotion,
    stylePreset: takeData.stylePreset,
    durationSec: takeData.durationSec || 6,
    createdAt: Date.now(),
    videoUrl: takeData.videoUrl,
    prompt: takeData.prompt,
    characterName: takeData.characterName,
    isMaster: takeData.isMaster ?? (currentTakes.length === 0),
    sceneId: takeData.sceneId,
    interactionId: takeData.interactionId,
  };

  if (!project) return newTake;

  const updatedTakes = [newTake, ...currentTakes];
  const targetSceneId = takeData.sceneId || project.activeSceneId;

  const updatedScenes = project.scenes?.map((s) => {
    if (s.id === targetSceneId || (!targetSceneId && project.scenes && project.scenes.length === 1)) {
      const sceneTakes = s.videoTakes || [];
      const updatedSceneTakes = [newTake, ...sceneTakes.filter((t) => t.id !== newTake.id)];
      return {
        ...s,
        videoTakes: updatedSceneTakes,
        activeVideoUrl: newTake.isMaster ? newTake.videoUrl : (s.activeVideoUrl || newTake.videoUrl),
      };
    }
    return s;
  });

  const updatedProject: ProjectData = {
    ...project,
    activeVideoUrl: newTake.isMaster ? newTake.videoUrl : (project.activeVideoUrl || newTake.videoUrl),
    videoTakes: updatedTakes,
    scenes: updatedScenes || project.scenes,
  };

  saveProject(updatedProject);
  return newTake;
}

/**
 * Marks a specific video take as the master take for a project.
 */
export function setMasterVideoTake(projectId: string, takeId: string, sceneId?: string): void {
  const project = getProjectById(projectId);
  if (!project || !project.videoTakes) return;

  let targetUrl = project.activeVideoUrl;
  const updatedTakes = project.videoTakes.map((t) => {
    if (t.id === takeId) {
      targetUrl = t.videoUrl;
      return { ...t, isMaster: true };
    }
    return { ...t, isMaster: false };
  });

  const targetSceneId = sceneId || project.activeSceneId;
  const updatedScenes = project.scenes?.map((s) => {
    if (s.id === targetSceneId || (!targetSceneId && project.scenes && project.scenes.length === 1)) {
      const sceneTakes = (s.videoTakes || []).map((t) => ({
        ...t,
        isMaster: t.id === takeId,
      }));
      return {
        ...s,
        videoTakes: sceneTakes,
        activeVideoUrl: targetUrl,
      };
    }
    return s;
  });

  saveProject({
    ...project,
    activeVideoUrl: targetUrl,
    videoTakes: updatedTakes,
    scenes: updatedScenes || project.scenes,
  });
}

/**
 * Deletes a video take from the project's saved vault.
 */
export function deleteVideoTake(projectId: string, takeId: string): void {
  const project = getProjectById(projectId);
  if (!project || !project.videoTakes) return;

  const filtered = project.videoTakes.filter((t) => t.id !== takeId);
  const targetDeleted = project.videoTakes.find((t) => t.id === takeId);
  const updatedScenes = project.scenes?.map((s) => {
    if (s.videoTakes) {
      const sceneFiltered = s.videoTakes.filter((t) => t.id !== takeId);
      return {
        ...s,
        videoTakes: sceneFiltered,
        activeVideoUrl: s.activeVideoUrl === targetDeleted?.videoUrl ? sceneFiltered[0]?.videoUrl : s.activeVideoUrl,
      };
    }
    return s;
  });

  const updatedProject: ProjectData = {
    ...project,
    videoTakes: filtered,
    activeVideoUrl:
      project.activeVideoUrl === targetDeleted?.videoUrl
        ? filtered[0]?.videoUrl || "/videos/vault_heist_take_01.mp4"
        : project.activeVideoUrl,
    scenes: updatedScenes || project.scenes,
  };

  saveProject(updatedProject);
}

/**
 * Gets all saved score/music takes for a given project (and optionally scene).
 */
export function getScoreTakes(projectId: string, sceneId?: string): ScoreTake[] {
  const project = getProjectById(projectId);
  if (!project) return [];
  if (sceneId && project.scenes) {
    const scene = project.scenes.find((s) => s.id === sceneId);
    if (scene && scene.scoreTakes && scene.scoreTakes.length > 0) {
      return scene.scoreTakes;
    }
  }
  return project.scoreTakes || [];
}

/**
 * Saves a newly generated score take to the project/scene score vault.
 */
export function saveScoreTake(
  projectId: string,
  takeData: Omit<ScoreTake, "id" | "takeNumber" | "createdAt"> & { id?: string; takeNumber?: number; sceneId?: string }
): ScoreTake {
  const project = getProjectById(projectId);
  const currentTakes = getScoreTakes(projectId, takeData.sceneId);
  const nextNum = takeData.takeNumber || currentTakes.length + 1;

  const newTake: ScoreTake = {
    id: takeData.id || `score-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    sceneId: takeData.sceneId,
    takeNumber: nextNum,
    title: takeData.title || `Score Cue ${String(nextNum).padStart(2, "0")}`,
    prompt: takeData.prompt,
    durationMode: takeData.durationMode || "clip",
    durationSec: takeData.durationSec || (takeData.durationMode === "pro" ? 180 : 30),
    createdAt: Date.now(),
    audioUrl: takeData.audioUrl,
    lyricsText: takeData.lyricsText,
    isMaster: takeData.isMaster ?? (currentTakes.length === 0),
    scoreType: takeData.scoreType || "score",
    conditioningImageUrl: takeData.conditioningImageUrl,
    conditioningImageUrls: takeData.conditioningImageUrls,
    responseModalities: takeData.responseModalities,
    instruments: takeData.instruments,
    dynamicArc: takeData.dynamicArc,
    model: takeData.model,
  };

  if (!project) return newTake;

  const updatedTakes = [newTake, ...currentTakes];
  let updatedScenes = project.scenes;

  if (takeData.sceneId && project.scenes) {
    updatedScenes = project.scenes.map((s) => {
      if (s.id === takeData.sceneId) {
        return {
          ...s,
          activeScoreUrl: newTake.isMaster ? newTake.audioUrl : (s.activeScoreUrl || newTake.audioUrl),
          scoreTakes: updatedTakes,
        };
      }
      return s;
    });
  }

  const updatedProject: ProjectData = {
    ...project,
    scenes: updatedScenes,
    activeScoreUrl: newTake.isMaster ? newTake.audioUrl : (project.activeScoreUrl || newTake.audioUrl),
    scoreTakes: updatedTakes,
  };

  saveProject(updatedProject);
  return newTake;
}

/**
 * Sets a specific score take as master for the project/scene.
 */
export function setMasterScoreTake(projectId: string, takeId: string, sceneId?: string): void {
  const project = getProjectById(projectId);
  if (!project) return;

  const updateTakesList = (takes: ScoreTake[]) => {
    let activeUrl: string | undefined;
    const nextList = takes.map((t) => {
      if (t.id === takeId) {
        activeUrl = t.audioUrl;
        return { ...t, isMaster: true };
      }
      return { ...t, isMaster: false };
    });
    return { nextList, activeUrl };
  };

  let updatedScenes = project.scenes;
  let newActiveUrl = project.activeScoreUrl;

  if (sceneId && project.scenes) {
    updatedScenes = project.scenes.map((s) => {
      if (s.id === sceneId && s.scoreTakes) {
        const { nextList, activeUrl } = updateTakesList(s.scoreTakes);
        return {
          ...s,
          scoreTakes: nextList,
          activeScoreUrl: activeUrl || s.activeScoreUrl,
        };
      }
      return s;
    });
  }

  if (project.scoreTakes) {
    const { nextList, activeUrl } = updateTakesList(project.scoreTakes);
    newActiveUrl = activeUrl || newActiveUrl;
    project.scoreTakes = nextList;
  }

  saveProject({
    ...project,
    scenes: updatedScenes,
    activeScoreUrl: newActiveUrl,
  });
}

/**
 * Deletes a specific score take from the project/scene score vault.
 */
export function deleteScoreTake(projectId: string, takeId: string, sceneId?: string): void {
  const project = getProjectById(projectId);
  if (!project) return;

  const filterTakes = (takes: ScoreTake[]) => takes.filter((t) => t.id !== takeId);

  let updatedScenes = project.scenes;
  let newActiveUrl = project.activeScoreUrl;

  if (sceneId && project.scenes) {
    updatedScenes = project.scenes.map((s) => {
      if (s.id === sceneId && s.scoreTakes) {
        const remaining = filterTakes(s.scoreTakes);
        const wasActive = s.activeScoreUrl && s.scoreTakes.find((t) => t.id === takeId)?.audioUrl === s.activeScoreUrl;
        return {
          ...s,
          scoreTakes: remaining,
          activeScoreUrl: wasActive ? remaining[0]?.audioUrl : s.activeScoreUrl,
        };
      }
      return s;
    });
  }

  const remainingProjectTakes = filterTakes(project.scoreTakes || []);
  if (newActiveUrl && !remainingProjectTakes.some((t) => t.audioUrl === newActiveUrl)) {
    newActiveUrl = remainingProjectTakes[0]?.audioUrl;
  }

  saveProject({
    ...project,
    scenes: updatedScenes,
    activeScoreUrl: newActiveUrl,
    scoreTakes: remainingProjectTakes,
  });
}

/**
 * Renames a specific score take (updates title only, preserves all other fields).
 */
export function renameScoreTake(
  projectId: string,
  takeId: string,
  newTitle: string,
  sceneId?: string
): void {
  const project = getProjectById(projectId);
  if (!project) return;

  const renameTake = (takes: ScoreTake[]) =>
    takes.map((t) => (t.id === takeId ? { ...t, title: newTitle.trim() || t.title } : t));

  let updatedScenes = project.scenes;
  if (sceneId && project.scenes) {
    updatedScenes = project.scenes.map((s) => {
      if (s.id === sceneId && s.scoreTakes) {
        return { ...s, scoreTakes: renameTake(s.scoreTakes) };
      }
      return s;
    });
  }

  saveProject({
    ...project,
    scenes: updatedScenes,
    scoreTakes: renameTake(project.scoreTakes || []),
  });
}

/**
 * Gets all shots (chained-generation sub-clips) for a given scene.
 */
export function getShots(projectId: string, sceneId: string): Shot[] {
  const project = getProjectById(projectId);
  if (!project || !project.scenes) return [];
  const scene = project.scenes.find((s) => s.id === sceneId);
  return scene?.shots || [];
}

/**
 * Replaces the full shot list for a scene (used when a shot plan is approved,
 * and as each shot in a sequence job transitions status/videoUrl).
 */
export function saveShots(projectId: string, sceneId: string, shots: Shot[]): void {
  const project = getProjectById(projectId);
  if (!project || !project.scenes) return;

  const updatedScenes = project.scenes.map((s) =>
    s.id === sceneId ? { ...s, shots } : s
  );

  saveProject({
    ...project,
    scenes: updatedScenes,
  });
}

/**
 * Updates a single shot within a scene's shot list (e.g. status transitions
 * during sequential generation).
 */
export function updateShot(
  projectId: string,
  sceneId: string,
  shotId: string,
  patch: Partial<Shot>
): void {
  const shots = getShots(projectId, sceneId);
  const updated = shots.map((sh) => (sh.id === shotId ? { ...sh, ...patch } : sh));
  saveShots(projectId, sceneId, updated);
}

/**
 * Persists the active/most recent chained-generation job so progress can
 * survive a page reload while the server-side job keeps running.
 */
export function saveActiveSequenceJob(projectId: string, job: ShotSequenceJob | undefined): void {
  const project = getProjectById(projectId);
  if (!project) return;
  saveProject({
    ...project,
    activeSequenceJob: job,
  });
}

export interface NodeCallbacks {
  onOpenHotSeat?: (charName: string) => void;
  onTuneVoice?: (charName: string) => void;
  onGenerateDraft?: () => void;
  onViewScript?: () => void;
  onOpenDeck?: (subTab: "blocking" | "tension" | "territory" | "stripboard") => void;
  onOpenTableRead?: () => void;
  onOpenHeatmap?: () => void;
  onRunChemistry?: () => void;
  onTweakDials?: (charName: string, dials: { confidence: number; speed: number; subtext: number }) => void;
  onOpenDossier?: (candidateId?: string) => void;
}

/**
 * Re-attaches interactive callbacks to nodes deserialized from JSON storage.
 * JSON serialization discards JS functions, so this restores all button actions.
 */
export function rehydrateNodeCallbacks(
  nodes: Node[],
  callbacks?: NodeCallbacks
): Node[] {
  if (!nodes || !Array.isArray(nodes) || !callbacks) return nodes || [];

  return nodes.map((node) => {
    const data = { ...(node.data || {}) } as Record<string, unknown>;

    switch (node.type) {
      case "characterCore": {
        const charName = (data.name as string) || "Lead";
        data.onOpenHotSeat = () => callbacks.onOpenHotSeat?.(charName);
        data.onTuneVoice = () => callbacks.onTuneVoice?.(charName);
        break;
      }
      case "scene": {
        data.onGenerateDraft = callbacks.onGenerateDraft;
        data.onViewScript = callbacks.onViewScript;
        break;
      }
      case "script": {
        data.onViewScript = callbacks.onViewScript;
        break;
      }
      case "floorplan": {
        data.onOpenDeck = () => callbacks.onOpenDeck?.("blocking");
        break;
      }
      case "tensionCurve": {
        data.onOpenDeck = () => callbacks.onOpenDeck?.("tension");
        break;
      }
      case "tableRead": {
        data.onOpenPlayer = callbacks.onOpenTableRead;
        break;
      }
      case "market": {
        data.onOpenHeatmap = callbacks.onOpenHeatmap;
        break;
      }
      case "chemistry": {
        data.onRunChemistry = callbacks.onRunChemistry;
        break;
      }
      case "location": {
        data.onOpenDossier = (candId?: string) => callbacks.onOpenDossier?.(candId);
        break;
      }
      default:
        break;
    }

    return { ...node, data };
  });
}

/**
 * Dynamically builds a full blueprint node graph (nodes & edges) tailored
 * directly to the project's title, genre, screenplay, and characters.
 */
export function buildProjectNodesAndEdges(
  project: ProjectData,
  callbacks?: NodeCallbacks,
  isGenerating?: boolean
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const fallbackCharacters: ProjectCharacter[] = [
    { name: "Character A", archetype: "Protagonist" },
    { name: "Character B", archetype: "Antagonist" },
  ];
  const chars: ProjectCharacter[] =
    project.characters && project.characters.length > 0
      ? project.characters
      : fallbackCharacters;
  const mainCharA = chars[0];
  const mainCharB = chars[1] || chars[0];

  // 1. YouTube Reference / Style Clip Node
  const isSciFi = project.genre.toLowerCase().includes("sci-fi") || project.genre.toLowerCase().includes("space");
  const isHeist = project.genre.toLowerCase().includes("heist") || project.genre.toLowerCase().includes("crime");
  
  let clipTitle = "Fincher / Deakins Lighting Study";
  let clipStyle = "High-contrast rim lighting, cool anamorphic flare, clinical shadows";
  let clipPalette = ["#090d16", "#1e293b", "#38bdf8", "#f59e0b", "#e11d48"];
  if (isSciFi) {
    clipTitle = "Ridley Scott / Tarkovsky Vacuum Study";
    clipStyle = "High-contrast vacuum strobes, amber warning halos, atmospheric haze";
    clipPalette = ["#050811", "#1e1b4b", "#f59e0b", "#ef4444", "#38bdf8"];
  } else if (isHeist) {
    clipTitle = "Michael Mann Lighting Study";
    clipStyle = "Low-key chiaroscuro, sodium-vapor halo, cyan night kick";
    clipPalette = ["#0b132b", "#1c2541", "#3a506b", "#e09f3e", "#d62828"];
  }

  nodes.push({
    id: "node-clip-1",
    type: "clip",
    position: { x: -380, y: -40 },
    data: {
      title: clipTitle,
      url: "cinematic-study.mp4",
      timestampRange: "01:10 - 02:45",
      lightingStyle: clipStyle,
      palette: clipPalette,
      pacing: "Taut slow-burn escalating into psychological collision",
    },
  });

  // 2. Plot Seed Idea Note
  nodes.push({
    id: "node-note-1",
    type: "note",
    position: { x: -380, y: 220 },
    data: {
      noteType: "Core Premise",
      content: project.premise || "A high-stakes conflict unfolds under strict asymmetric time constraints.",
      audioDuration: "00:45",
    },
  });

  // 3. Dynamic Character Lab Nodes
  let currentY = 440;
  chars.slice(0, 3).forEach((char, idx) => {
    const actorNodeId = `node-actor-${char.name.toLowerCase()}`;
    const dialNodeId = `node-dial-${char.name.toLowerCase()}`;
    const quirkNodeId = `node-quirks-${char.name.toLowerCase()}`;
    const coreNodeId = `node-core-${char.name.toLowerCase()}`;

    // Actor comp node
    nodes.push({
      id: actorNodeId,
      type: "actor",
      position: { x: -380, y: currentY },
      data: {
        actorName: char.actorComp || (idx === 0 ? "Willem Dafoe Comp" : "Florence Pugh Comp"),
        roleReference: `Psychological Cadence Profile (${char.speechStyle || "staccato"})`,
        vocalWeight: char.speechStyle || "Sharp, defensive, calculated",
        energyProfile: char.archetype,
      },
    });

    // Personality dials node
    nodes.push({
      id: dialNodeId,
      type: "personality",
      position: { x: -380, y: currentY + 180 },
      data: {
        presetName: `${char.name} Behavioral Dial`,
        confidence: char.confidence ?? (idx === 0 ? 60 : 90),
        speed: char.verbalPacing ?? 75,
        subtext: 85,
        onTweak: (dials: { confidence: number; speed: number; subtext: number }) =>
          callbacks?.onTweakDials?.(char.name, dials),
      },
    });

    // Quirks node
    nodes.push({
      id: quirkNodeId,
      type: "quirks",
      position: { x: -380, y: currentY + 360 },
      data: {
        tics: char.quirks || [
          `Subtext ratio: ${char.subtextRatio || "high"}`,
          `Avoids direct answers when pressed on motives`,
        ],
      },
    });

    // Character Core Node
    nodes.push({
      id: coreNodeId,
      type: "characterCore",
      position: { x: 40, y: currentY + 40 },
      data: {
        name: char.name,
        archetype: char.archetype,
        objective: char.objective || "Uncover the secret without revealing their own hand",
        actorComp: char.actorComp || (idx === 0 ? "Lead Comp" : "Counter-Comp"),
        dialsSummary: char.dialsSummary || "Speed 75% · Subtext 85%",
        onOpenHotSeat: () => callbacks?.onOpenHotSeat?.(char.name),
        onTuneVoice: () => callbacks?.onTuneVoice?.(char.name),
      },
    });

    // Edges for this character
    edges.push({
      id: `e-act-${char.name.toLowerCase()}`,
      source: actorNodeId,
      target: coreNodeId,
      targetHandle: "actor_ref",
    });
    edges.push({
      id: `e-dial-${char.name.toLowerCase()}`,
      source: dialNodeId,
      target: coreNodeId,
      targetHandle: "personality",
    });
    edges.push({
      id: `e-quirk-${char.name.toLowerCase()}`,
      source: quirkNodeId,
      target: coreNodeId,
      targetHandle: "quirks",
    });

    // Edge from character to scene master
    edges.push({
      id: `e-char-scene-${char.name.toLowerCase()}`,
      source: coreNodeId,
      target: "node-scene-1",
      targetHandle: "character_in",
    });

    currentY += 580;
  });

  // 4. Chemistry Bench Sandbox Node
  nodes.push({
    id: "node-chemistry-1",
    type: "chemistry",
    position: { x: 480, y: 800 },
    data: {
      scenario: `${mainCharA.name} and ${mainCharB.name} trapped together with a ticking deadline`,
      onRunChemistry: callbacks?.onRunChemistry,
    },
  });

  if (chars[0]) {
    edges.push({
      id: "e-chem-a",
      source: `node-core-${chars[0].name.toLowerCase()}`,
      target: "node-chemistry-1",
      targetHandle: "char_a",
    });
  }
  if (chars[1]) {
    edges.push({
      id: "e-chem-b",
      source: `node-core-${chars[1].name.toLowerCase()}`,
      target: "node-chemistry-1",
      targetHandle: "char_b",
    });
  }

  // 5. Scene Master Node
  nodes.push({
    id: "node-scene-1",
    type: "scene",
    position: { x: 480, y: 80 },
    data: {
      title: project.sceneTitle || `${project.title} — Master Scene`,
      slugline: project.screenplayText ? (project.screenplayText.match(/(INT\.|EXT\.)[^\n]+/)?.[0] || "INT. SCENE - NIGHT") : "INT. PRODUCTION - NIGHT",
      stakes: project.sceneSummary || project.premise,
      state: isGenerating ? "generating" : "ready",
      characterCount: chars.length,
      hasStyleRef: true,
      hasVideoTake: Boolean(project.activeVideoUrl || (project.videoTakes && project.videoTakes.length > 0)),
      videoTakeUrl: project.activeVideoUrl || project.videoTakes?.[0]?.videoUrl,
      onGenerateDraft: callbacks?.onGenerateDraft,
      onViewScript: callbacks?.onViewScript,
    },
  });

  edges.push({
    id: "e-clip-scene",
    source: "node-clip-1",
    target: "node-scene-1",
    targetHandle: "style_ref",
  });
  edges.push({
    id: "e-note-scene",
    source: "node-note-1",
    target: "node-scene-1",
    targetHandle: "plot_seed",
  });

  // 6. Narrative: Screenplay Draft Node
  const wordCount = project.screenplayText ? project.screenplayText.trim().split(/\s+/).length : 0;
  nodes.push({
    id: "node-script-1",
    type: "script",
    position: { x: 920, y: 80 },
    data: {
      title: `${project.title} Script Draft`,
      previewText: project.screenplayText || "No screenplay drafted yet. Click Generate Draft on Scene Master to run Gemini 3.7 Flash.",
      wordCount,
      onViewScript: callbacks?.onViewScript,
    },
  });

  edges.push({
    id: "e-scene-script",
    source: "node-scene-1",
    target: "node-script-1",
    targetHandle: "script_in",
  });

  // 7. Visual & Production Suite Nodes
  nodes.push({
    id: "node-storyboard-1",
    type: "storyboard",
    position: { x: 1360, y: -80 },
    data: {
      prompt: `2.39:1 low-angle cinematic anamorphic frame: ${mainCharA.name} confronts ${mainCharB.name}; volumetric lighting and atmospheric tension.`,
      shotType: "2.39:1 Anamorphic Scope",
      lighting: clipStyle,
    },
  });

  nodes.push({
    id: "node-floorplan-1",
    type: "floorplan",
    position: { x: 1360, y: 160 },
    data: {
      sceneTitle: project.sceneTitle,
      cameraCount: 3,
      onOpenDeck: () => callbacks?.onOpenDeck?.("blocking"),
    },
  });

  nodes.push({
    id: "node-tension-1",
    type: "tensionCurve",
    position: { x: 1360, y: 380 },
    data: {
      peakTension: 88,
      hasWarning: false,
      onOpenDeck: () => callbacks?.onOpenDeck?.("tension"),
    },
  });

  nodes.push({
    id: "node-tableread-1",
    type: "tableRead",
    position: { x: 1360, y: 600 },
    data: {
      voiceCount: Math.min(3, chars.length),
      onOpenPlayer: callbacks?.onOpenTableRead,
    },
  });

  nodes.push({
    id: "node-market-1",
    type: "market",
    position: { x: 1360, y: 820 },
    data: {
      // No globalScore/topTerritory here — the card shows "Not yet analyzed"
      // until the Territory Heatmap view actually runs a market prediction.
      onOpenHeatmap: callbacks?.onOpenHeatmap,
    },
  });

  edges.push({ id: "e-script-storyboard", source: "node-script-1", target: "node-storyboard-1", targetHandle: "script_in" });
  edges.push({ id: "e-script-floorplan", source: "node-script-1", target: "node-floorplan-1", targetHandle: "script_in" });
  edges.push({ id: "e-script-tension", source: "node-script-1", target: "node-tension-1", targetHandle: "script_in" });
  edges.push({ id: "e-script-tableread", source: "node-script-1", target: "node-tableread-1", targetHandle: "script_in" });
  edges.push({ id: "e-script-market", source: "node-script-1", target: "node-market-1", targetHandle: "script_in" });

  return { nodes, edges };
}
