"use client";

import * as React from "react";
import {
  type ProjectData,
  type FilmScene,
  type LocationCandidate,
  type LocationCluster,
  type SupportedCurrency,
  type BudgetCapPolicy,
  formatCurrency,
  saveProject,
} from "@/lib/project-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { MarkdownRenderer } from "@/components/cinema/markdown-renderer";
import { toast } from "@/components/ui/toast";
import { notifyIfFallback } from "@/lib/fallback-notice";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  MapPin,
  Sparkles,
  RefreshCw,
  DollarSign,
  ShieldAlert,
  Navigation,
  CheckCircle2,
  Star,
  ThumbsUp,
  ThumbsDown,
  ExternalLink,
  Layers,
  MessageSquare,
  Building2,
  Film,
  Send,
  HelpCircle,
  TrendingDown,
  ChevronRight,
  AlertTriangle,
  Search,
  ArrowUpDown,
  Download,
  Scale,
  FileText,
  Pencil,
  X,
  Check,
  Camera,
  Loader2,
  Maximize2,
  SlidersHorizontal,
  Eye,
  Copy,
  Plus,
  Tv,
  Palette,
  Zap,
  Image as ImageIcon,
} from "lucide-react";

interface LocationBoardProps {
  project: ProjectData;
  onUpdateProject?: (updated: ProjectData) => void;
  className?: string;
}

interface QAMessage {
  sender: "user" | "agent";
  text: string;
  sources?: Array<{ title: string; url: string }>;
  suggestedFollowups?: string[];
  timestamp: number;
  isFallback?: boolean;
}

// Clean helper to strip redundant "City, State — " prefix from location names
export function cleanCandidateName(name: string): string {
  if (!name) return "";
  const parts = name.split(" — ");
  if (parts.length > 1 && parts[0].length < 30) {
    return parts.slice(1).join(" — ");
  }
  return name;
}

export const LOCATION_STYLE_PRESETS = [
  {
    id: "anamorphic_35mm",
    name: "35mm Anamorphic Scope",
    description: "2.39:1 widescreen, subtle cyan streak flare, organic film grain, natural halation",
    promptModifier: "35mm anamorphic film, 2.39:1 aspect ratio, subtle horizontal streak lens flare, organic film grain, natural halation, Arri Alexa LF",
  },
  {
    id: "fincher_chiaroscuro",
    name: "Fincher Low-Key Chiaroscuro",
    description: "Deep obsidian shadows, muted palette, sodium vapor & tungsten practical glow",
    promptModifier: "David Fincher style cinematography, low-key chiaroscuro lighting, deep obsidian shadows, desaturated cool tones, amber sodium vapor glow, razor-sharp focus",
  },
  {
    id: "neo_noir_cyberpunk",
    name: "Neo-Noir Wet Asphalt",
    description: "Rain-slicked ground, vivid reflections, neon signage, volumetric atmosphere",
    promptModifier: "Neo-noir cinematic aesthetic, rain-slicked reflective pavement, wet surfaces, volumetric atmospheric haze, cyan and magenta neon rim lighting",
  },
  {
    id: "greenscreen_production",
    name: "Green Screen Cyc & Studio Grid (Pre-VFX)",
    description: "Chroma green cyclorama wall & floor, overhead softbox grid, tracking markers, studio space lights",
    promptModifier: "Behind the scenes on a professional film soundstage, actors performing inside a seamless chroma key green screen cyclorama cove, overhead motorized lighting grid with Arri SkyPanel space lights, chroma green floor with subtle tracking markers, green spill control baffles, Panavision cinema camera on dolly in foreground",
  },
  {
    id: "led_volume_icvfx",
    name: "Virtual Production LED Volume (In-Camera VFX)",
    description: "Curved photorealistic LED wall backdrop, Unreal Engine virtual set, practical floor blend",
    promptModifier: "The Mandalorian style virtual production LED Volume stage, curved ultra-high-resolution LED screen displaying a photorealistic environment background with realistic camera parallax, practical physical foreground set seamlessly matching the LED horizon, cinematic in-camera VFX lighting",
  },
  {
    id: "soundstage_constructed_set",
    name: "Soundstage Constructed Set (Studio Build)",
    description: "Custom built interior set flats, soundstage floor, studio perms & scaffolding",
    promptModifier: "Interior set built on a Hollywood soundstage, visible high studio walls and ceiling perms with hung theatrical lighting fixtures, pristine painted set flats, controlled dramatic interior film lighting, cinematic movie still",
  },
  {
    id: "composited_vfx_final",
    name: "Composited VFX Final Keyframe",
    description: "Post-VFX final look with high-end CGI background plate, atmospheric comp, seamless edge key",
    promptModifier: "Final photorealistic VFX feature film composite, seamless matte painting background replacement, volumetric atmospheric light wrap, high-end visual effects compositing, ILM / Weta FX production finish, master cinema color grading",
  },
  {
    id: "imax_70mm",
    name: "70mm IMAX High-Contrast Master",
    description: "Ultra-sharp architectural geometry, crisp highlights, naturalistic daylight",
    promptModifier: "70mm IMAX format, Christopher Nolan aesthetic, ultra-sharp architectural lines, rich natural dynamic range, crisp deep contrast, pristine large-format clarity",
  },
  {
    id: "bleach_bypass",
    name: "Bleach Bypass Gritty 35mm",
    description: "Silver-retention contrast, washed saturation, tactile industrial texture",
    promptModifier: "Bleach bypass chemical film process, desaturated silver tones, harsh gritty contrast, metallic sheen, dark textured shadows",
  },
  {
    id: "kodak_500t",
    name: "Kodak Vision3 500T Golden Glow",
    description: "Warm tungsten interior warmth, creamy skin tones, romantic halation",
    promptModifier: "Kodak Vision3 500T color film stock, warm tungsten ambient light, rich amber highlights, velvety shadows, soft organic roll-off",
  },
];

export const LOCATION_CAMERA_FRAMINGS = [
  {
    id: "wide_master",
    name: "Wide Establishing Master (24mm)",
    description: "Full architectural venue context, geography and environmental scope",
    promptModifier: "Wide establishing master shot, 24mm prime lens, architectural wide angle, expansive environmental staging",
  },
  {
    id: "low_angle_hero",
    name: "Low-Angle Hero Shot (18mm)",
    description: "Dramatic towering architecture, ceiling geometry, imposing presence",
    promptModifier: "Dramatic low-angle hero shot, 18mm ultra-wide lens, looking upward, imposing monumental architecture, deep perspective vanishing lines",
  },
  {
    id: "eye_level_tracking",
    name: "Atmospheric Eye-Level Tracking (35mm)",
    description: "Intimate walk-and-talk perspective, natural human eye vantage",
    promptModifier: "Cinematic eye-level shot, 35mm lens, naturalistic depth of field, intimate human vantage, atmospheric environmental staging",
  },
  {
    id: "overhead_crane",
    name: "High Overhead Crane / Geometry (50mm)",
    description: "Overhead floorplan perspective, structural symmetry and scale",
    promptModifier: "High overhead crane shot, 50mm lens, elevated cinematic perspective, striking geometric symmetry and spatial scale",
  },
];

export interface StudioStageTemplate {
  id: string;
  name: string;
  category: string;
  environment_type: "studio_stage" | "green_screen" | "virtual_production" | "custom_build";
  stage_type: "soundstage" | "greenscreen_cyc" | "bluescreen_cyc" | "virtual_production" | "custom_build";
  description: string;
  cyc_type?: "green_screen" | "blue_screen" | "white_cyc" | "blackout" | "led_volume" | "none";
  grid_height: string;
  dimensions: string;
  power_capacity: string;
  sound_rating: string;
  day_rate: number;
  paint_fee: number;
  permit_fee: number;
  film_precedent: { film: string; director: string; why: string };
  pros: string[];
  cons: string[];
}

export const STUDIO_STAGE_TEMPLATES: StudioStageTemplate[] = [
  {
    id: "infinite_green_cyc",
    name: "Infinite Green Screen Cyclorama Stage",
    category: "green-screen-cyc",
    environment_type: "green_screen",
    stage_type: "greenscreen_cyc",
    description: "3-wall seamless chroma key green cyc with pre-hung space lights, floor cove, and tracking grid.",
    cyc_type: "green_screen",
    grid_height: "24 ft clearance to lighting perms",
    dimensions: "50'W x 40'D x 22'H wrap cove (2,000 sq ft)",
    power_capacity: "1200A 3-Phase Camlock distribution",
    sound_rating: "NC-25 Sound Isolated (Certified Soundstage)",
    day_rate: 2800,
    paint_fee: 600,
    permit_fee: 150,
    film_precedent: {
      film: "The Matrix (1999)",
      director: "Lana & Lilly Wachowski",
      why: "Controlled chroma key cyclorama for complex wirework and VFX composite staging.",
    },
    pros: [
      "Zero weather, wind, or daylight dependency; complete environmental control",
      "Seamless infinite 3-wall green cove eliminates background shadow seams",
      "Silent whisper HVAC allows sync-sound dialogue recording without post-dubbing",
    ],
    cons: [
      "Requires post-production matte extraction and background plate compositing",
      "Daily chroma paint restoration fee for scuffed floor tape during action takes",
    ],
  },
  {
    id: "virtual_prod_led_volume",
    name: "Virtual Production LED Volume (In-Camera VFX)",
    category: "virtual-production",
    environment_type: "virtual_production",
    stage_type: "virtual_production",
    description: "Curved 270° ultra-fine LED wall + ceiling with real-time Unreal Engine camera tracking.",
    cyc_type: "led_volume",
    grid_height: "26 ft clearance to grid",
    dimensions: "75' diameter curved wall, 20' height + motorized LED ceiling",
    power_capacity: "1600A 3-Phase Camlock distribution",
    sound_rating: "NC-20 Broadcast Certified Studio Isolation",
    day_rate: 6500,
    paint_fee: 0,
    permit_fee: 150,
    film_precedent: {
      film: "The Batman (2022)",
      director: "Matt Reeves",
      why: "In-camera VFX volume for authentic wrap-around skylight and wet vehicle reflections.",
    },
    pros: [
      "Real-time photorealistic in-camera VFX: zero green spill on actors or glossy props",
      "Perpetual golden hour: lock lighting conditions for 12 hours straight",
      "Actors react to visible physical environments rather than blank green walls",
    ],
    cons: [
      "Higher base facility rental rate than standard soundstages",
      "Requires specialized Unreal Engine volume operator / brain-bar crew",
    ],
  },
  {
    id: "soundstage_standing_set",
    name: "Acoustic Soundstage & Custom Built Set",
    category: "soundstage",
    environment_type: "studio_stage",
    stage_type: "soundstage",
    description: "Blank-slate 10,000 sq ft acoustic soundstage ready for custom interior scenic build.",
    cyc_type: "none",
    grid_height: "32 ft clearance with full perimeter catwalks",
    dimensions: "100' x 80' clear span (8,000 sq ft)",
    power_capacity: "2000A 3-Phase Camlock distribution",
    sound_rating: "NC-25 Certified Soundstage",
    day_rate: 3200,
    paint_fee: 0,
    permit_fee: 150,
    film_precedent: {
      film: "Panic Room (2002)",
      director: "David Fincher",
      why: "Custom interior 3-story build allowing fluid camera tracking through walls and floors.",
    },
    pros: [
      "Movable wild walls allow seamless camera cranes and impossible tracking shots",
      "No municipal curfew or street noise permits required",
      "Drive-in elephant doors allow direct truck and vehicle staging inside",
    ],
    cons: [
      "Requires scenic fabrication lead time and lumber/construction budget",
      "Requires post-shoot strike and stage restoration",
    ],
  },
  {
    id: "infinite_blue_cyc",
    name: "Blue Screen Cyclorama Stage",
    category: "blue-screen-cyc",
    environment_type: "green_screen",
    stage_type: "bluescreen_cyc",
    description: "Deep cobalt blue cyclorama stage engineered for dark night scenes, wet hair, and fine edge detail.",
    cyc_type: "blue_screen",
    grid_height: "22 ft clearance to grid",
    dimensions: "45'W x 35'D x 20'H cove (1,600 sq ft)",
    power_capacity: "1000A 3-Phase Camlock",
    sound_rating: "NC-25 Sound Isolated",
    day_rate: 2600,
    paint_fee: 550,
    permit_fee: 150,
    film_precedent: {
      film: "Spider-Man 2 (2004)",
      director: "Sam Raimi",
      why: "Blue screen chosen to preserve dark costume details and eliminate green color fringing.",
    },
    pros: [
      "Superior edge keying for dark costumes, night exterior composites, and blonde hair",
      "Significantly less color spill contamination on foreground subjects than green screen",
    ],
    cons: [
      "Requires roughly 1 full stop more light output than green screen for clean sensor exposure",
    ],
  },
  {
    id: "custom_build",
    name: "Custom Dressed Interior Build",
    category: "custom-build",
    environment_type: "custom_build",
    stage_type: "custom_build",
    description: "Director-customized interior built set configured for exact architectural requirements.",
    cyc_type: "none",
    grid_height: "20 ft clearance",
    dimensions: "60' x 40' staging area",
    power_capacity: "800A 3-Phase Camlock",
    sound_rating: "Acoustically Treated Space",
    day_rate: 2400,
    paint_fee: 0,
    permit_fee: 150,
    film_precedent: {
      film: "Ex Machina (2014)",
      director: "Alex Garland",
      why: "Controlled architectural interior build highlighting geometric concrete and glass.",
    },
    pros: [
      "Custom tailored layout and sightlines built exactly to the screenplay's blocking needs",
      "Full control over practical lighting sources, ceiling geometry, and finishes",
    ],
    cons: [
      "Fabrication time and construction crew overhead",
    ],
  },
];

export function synthesizeLocationVisualPrompt(
  candidate: LocationCandidate,
  scene?: FilmScene,
  stylePresetName?: string,
  framingName?: string
): string {
  const venueName = cleanCandidateName(candidate.name);
  const region = candidate.region || "Los Angeles, CA";
  const sceneSlug = scene?.slugline || scene?.location || "EXT. LOCATION - NIGHT";
  const sceneGoal = scene?.summary || scene?.title || "Cinematic feature film scene";

  const styleObj =
    LOCATION_STYLE_PRESETS.find((p) => p.name === stylePresetName) || LOCATION_STYLE_PRESETS[0];
  const framingObj =
    LOCATION_CAMERA_FRAMINGS.find((f) => f.name === framingName) || LOCATION_CAMERA_FRAMINGS[0];

  const precedentNote = candidate.film_precedents?.[0]
    ? `cinematic precedent inspired by ${candidate.film_precedents[0].film} directed by ${candidate.film_precedents[0].director}`
    : "feature film production quality";

  const isGreenScreen =
    candidate.stage_specs?.stage_type === "greenscreen_cyc" ||
    candidate.stage_specs?.stage_type === "bluescreen_cyc" ||
    candidate.stage_specs?.cyc_type === "green_screen" ||
    candidate.stage_specs?.cyc_type === "blue_screen" ||
    candidate.environment_type === "green_screen" ||
    candidate.category?.toLowerCase().includes("green") ||
    candidate.category?.toLowerCase().includes("blue");

  const isLedVolume =
    candidate.stage_specs?.stage_type === "virtual_production" ||
    candidate.stage_specs?.cyc_type === "led_volume" ||
    candidate.environment_type === "virtual_production" ||
    candidate.category?.toLowerCase().includes("virtual") ||
    candidate.category?.toLowerCase().includes("led");

  const isSoundstage =
    candidate.stage_specs?.stage_type === "soundstage" ||
    candidate.stage_specs?.stage_type === "custom_build" ||
    candidate.environment_type === "studio_stage" ||
    candidate.environment_type === "custom_build" ||
    candidate.category?.toLowerCase().includes("stage");

  let stageContext = `Real-world film location: "${venueName}", located in ${region}`;
  if (isGreenScreen) {
    stageContext = `Filming inside chroma key green screen cyclorama soundstage "${venueName}" in ${region}, featuring an infinite curved green cove with overhead motorized softbox lighting grid and floor tracking markers`;
  } else if (isLedVolume) {
    stageContext = `Filming inside virtual production LED Volume "${venueName}" in ${region}, featuring high-resolution curved LED screens displaying a photorealistic environment with in-camera VFX and physical foreground staging`;
  } else if (isSoundstage) {
    stageContext = `Custom built interior set inside professional soundstage "${venueName}" in ${region}, equipped with overhead lighting grid and soundproof acoustic staging`;
  }

  return `Cinematic movie keyframe still. ${framingObj.promptModifier}. ${stageContext}. Scene setting: ${sceneSlug}. Scene narrative: ${sceneGoal}. Cinematography style: ${styleObj.promptModifier}, ${precedentNote}. Authentic architectural and stage details of ${venueName}, photorealistic 8k, volumetric light beams, atmospheric haze, movie still, color graded for cinema, highly detailed, no text, no captions, no watermark.`;
}

export function LocationBoard({
  project,
  onUpdateProject,
  className,
}: LocationBoardProps) {
  const [currentProject, setCurrentProject] = React.useState<ProjectData>(project);
  const [selectedSceneId, setSelectedSceneId] = React.useState<string>(
    project.scenes?.[0]?.id || ""
  );
  const [viewMode, setViewMode] = React.useState<"scenes" | "clusters">("scenes");
  const [isScouting, setIsScouting] = React.useState(false);
  const [scoutingPhase, setScoutingPhase] = React.useState<number>(0);

  // Scene Filters & Search
  const [sceneSearchQuery, setSceneSearchQuery] = React.useState("");
  const [sceneStatusFilter, setSceneStatusFilter] = React.useState<
    "all" | "locked" | "unlocked" | "over_budget"
  >("all");

  // Candidate Filters, Search & Sort
  const [candidateSearchQuery, setCandidateSearchQuery] = React.useState("");
  const [candidateCategoryFilter, setCandidateCategoryFilter] = React.useState<string>("all");
  const [candidateEnvironmentFilter, setCandidateEnvironmentFilter] = React.useState<
    "all" | "practical" | "soundstage" | "green_screen"
  >("all");
  const [candidateSortBy, setCandidateSortBy] = React.useState<
    "rank" | "cost_asc" | "cost_desc" | "shootability" | "creative"
  >("rank");

  // Custom Studio / Green Screen Modal State
  const [isAddStudioModalOpen, setIsAddStudioModalOpen] = React.useState(false);
  const [selectedStudioTemplateId, setSelectedStudioTemplateId] = React.useState<string>(
    STUDIO_STAGE_TEMPLATES[0].id
  );
  const [customStudioName, setCustomStudioName] = React.useState(STUDIO_STAGE_TEMPLATES[0].name);
  const [customStudioRegion, setCustomStudioRegion] = React.useState("");
  const [customStudioDayRate, setCustomStudioDayRate] = React.useState(STUDIO_STAGE_TEMPLATES[0].day_rate);
  const [customCycPaintFee, setCustomCycPaintFee] = React.useState(STUDIO_STAGE_TEMPLATES[0].paint_fee);
  const [customGridHeight, setCustomGridHeight] = React.useState(STUDIO_STAGE_TEMPLATES[0].grid_height);
  const [customDimensions, setCustomDimensions] = React.useState(STUDIO_STAGE_TEMPLATES[0].dimensions);
  const [customPower, setCustomPower] = React.useState(STUDIO_STAGE_TEMPLATES[0].power_capacity);
  const [customSound, setCustomSound] = React.useState(STUDIO_STAGE_TEMPLATES[0].sound_rating);
  const [customCycType, setCustomCycType] = React.useState<string>(
    STUDIO_STAGE_TEMPLATES[0].cyc_type || "green_screen"
  );
  const [customSetNotes, setCustomSetNotes] = React.useState(STUDIO_STAGE_TEMPLATES[0].description);
  const [autoLockStudioSet, setAutoLockStudioSet] = React.useState(true);

  // Custom Location Modal State
  const [isAddCustomLocationOpen, setIsAddCustomLocationOpen] = React.useState(false);
  const [customLocName, setCustomLocName] = React.useState("");
  const [customLocCategory, setCustomLocCategory] = React.useState("practical");
  const [customLocRegion, setCustomLocRegion] = React.useState("");
  const [customLocDayRate, setCustomLocDayRate] = React.useState("2000");
  const [customLocPermitFee, setCustomLocPermitFee] = React.useState("300");
  const [customLocFilmPrecedent, setCustomLocFilmPrecedent] = React.useState("");
  const [customLocDirector, setCustomLocDirector] = React.useState("");
  const [customLocWhy, setCustomLocWhy] = React.useState("");
  const [customLocPracticalNotes, setCustomLocPracticalNotes] = React.useState("");
  const [customLocAutoLock, setCustomLocAutoLock] = React.useState(true);

  // Candidate Comparison Modal State
  const [comparingCandidateIds, setComparingCandidateIds] = React.useState<string[]>([]);
  const [isCompareModalOpen, setIsCompareModalOpen] = React.useState(false);

  // Per-Scene Quick Edit Dialog State
  const [editingScene, setEditingScene] = React.useState<FilmScene | null>(null);
  const [editRegion, setEditRegion] = React.useState("");
  const [editBudget, setEditBudget] = React.useState<number>(0);

  // Q&A Drawer State
  // Production Dossier State
  const [dossierCandidate, setDossierCandidate] = React.useState<LocationCandidate | null>(null);
  const [dossierActiveTab, setDossierActiveTab] = React.useState<
    "costs" | "pros_cons" | "reviews" | "economy" | "keyframe" | "stage_specs"
  >("costs");

  // Visual Keyframe Generation States
  const [isGeneratingImage, setIsGeneratingImage] = React.useState<Record<string, boolean>>({});
  const [selectedPresetPerCand, setSelectedPresetPerCand] = React.useState<Record<string, string>>({});
  const [selectedFramingPerCand, setSelectedFramingPerCand] = React.useState<Record<string, string>>({});
  const [expandedPromptCandId, setExpandedPromptCandId] = React.useState<string | null>(null);

  const [qaCandidate, setQaCandidate] = React.useState<LocationCandidate | null>(null);
  const [qaMessages, setQaMessages] = React.useState<Record<string, QAMessage[]>>({});
  const [qaInput, setQaInput] = React.useState("");
  const [isAskingQA, setIsAskingQA] = React.useState(false);

  // Sync with prop
  React.useEffect(() => {
    setCurrentProject(project);
    if (project.scenes && project.scenes.length > 0 && !selectedSceneId) {
      setSelectedSceneId(project.scenes[0].id);
    }
  }, [project, selectedSceneId]);

  // Scouting simulated phase ticker
  React.useEffect(() => {
    if (!isScouting) {
      setScoutingPhase(0);
      return;
    }
    const interval = setInterval(() => {
      setScoutingPhase((prev) => (prev < 3 ? prev + 1 : 0));
    }, 1800);
    return () => clearInterval(interval);
  }, [isScouting]);

  const currency: SupportedCurrency = currentProject.currency || "USD";
  const totalBudget = currentProject.budget || 850_000;
  const locAllocationPct = currentProject.budgetAllocation?.locationsPct ?? 15;
  const totalLocationBudget =
    currentProject.budgetAllocation?.locationsAmount ??
    Math.round(totalBudget * (locAllocationPct / 100));
  const budgetCapPolicy: BudgetCapPolicy = currentProject.budgetCapPolicy || "advisory";
  const productionBase = currentProject.shootRegion || "Los Angeles, CA";

  const scenes = currentProject.scenes || [];
  const selectedScene = scenes.find((s) => s.id === selectedSceneId) || scenes[0];

  // Calculate committed spend across all scenes
  const committedSpend = React.useMemo(() => {
    let total = 0;
    scenes.forEach((sc) => {
      if (sc.selectedLocationCandidateId && sc.locationCandidates) {
        const picked = sc.locationCandidates.find(
          (c) => c.candidate_id === sc.selectedLocationCandidateId
        );
        if (picked) {
          total += (picked.estimated_cost?.day_rate || 0) + (picked.estimated_cost?.permit_fee || 0);
        }
      }
    });
    return total;
  }, [scenes]);

  const remainingBudget = totalLocationBudget - committedSpend;
  const budgetUtilizationPct = Math.min(
    100,
    Math.round((committedSpend / Math.max(1, totalLocationBudget)) * 100)
  );

  const lockedScenesCount = scenes.filter((s) => s.selectedLocationCandidateId).length;

  // Toggle Policy (Advisory vs Hard Block)
  const handleTogglePolicy = () => {
    const nextPolicy: BudgetCapPolicy = budgetCapPolicy === "advisory" ? "hard_block" : "advisory";
    const updated: ProjectData = {
      ...currentProject,
      budgetCapPolicy: nextPolicy,
      updatedAt: Date.now(),
    };
    setCurrentProject(updated);
    saveProject(updated);
    onUpdateProject?.(updated);
    toast.add({
      title: "Budget Cap Policy Changed",
      description: `Switched to ${
        nextPolicy === "hard_block" ? "Hard Block (Strict Enforcement)" : "Advisory Warning (Flexible Allowance)"
      }.`,
      type: "info",
    });
  };

  // Rebalance Budget Evenly
  const handleRebalanceBudget = () => {
    const unlockedScenes = scenes.filter((s) => !s.selectedLocationCandidateId);
    if (unlockedScenes.length === 0) {
      toast.add({
        title: "All Locations Locked",
        description: "All scenes already have locked locations. No rebalance needed.",
        type: "info",
      });
      return;
    }

    const perSceneShare = Math.max(1000, Math.round(remainingBudget / unlockedScenes.length));
    const updatedScenes: FilmScene[] = scenes.map((s) => {
      if (!s.selectedLocationCandidateId) {
        return {
          ...s,
          locationBudget: perSceneShare,
        };
      }
      return s;
    });

    const updated: ProjectData = {
      ...currentProject,
      scenes: updatedScenes,
      updatedAt: Date.now(),
    };

    setCurrentProject(updated);
    saveProject(updated);
    onUpdateProject?.(updated);

    toast.add({
      title: "Budget Rebalanced",
      description: `Allocated ${formatCurrency(perSceneShare, currency)} to each of the ${
        unlockedScenes.length
      } unlocked scenes.`,
      type: "success",
    });
  };

  // Export Full Location Package (Markdown)
  const handleExportLocationPackage = () => {
    let report = `# LOCATION SCOUTING PACKAGE: ${currentProject.title.toUpperCase()}
`;
    report += `**Production Base:** ${productionBase}
`;
    report += `**Total Location Budget:** ${formatCurrency(totalLocationBudget, currency)}
`;
    report += `**Committed Spend:** ${formatCurrency(committedSpend, currency)} (${budgetUtilizationPct}%)
`;
    report += `**Policy:** ${budgetCapPolicy === "hard_block" ? "Hard Block" : "Advisory Warning"}

`;
    report += `## SCENE BREAKDOWN

`;

    scenes.forEach((s) => {
      const locked = s.locationCandidates?.find((c) => c.candidate_id === s.selectedLocationCandidateId);
      report += `### Scene ${s.sceneNumber}: ${s.title}
`;
      report += `- **Slugline:** ${s.slugline || s.location}
`;
      report += `- **Region:** ${s.shootRegion || productionBase}
`;
      report += `- **Scene Budget:** ${formatCurrency(s.locationBudget || 0, currency)}
`;
      if (locked) {
        const cost = (locked.estimated_cost?.day_rate || 0) + (locked.estimated_cost?.permit_fee || 0);
        report += `- **Locked Venue:** ${locked.name} (${locked.category})
`;
        report += `- **Estimated Cost:** ${formatCurrency(cost, currency)} (Day: ${formatCurrency(
          locked.estimated_cost?.day_rate || 0,
          currency
        )}, Permit: ${formatCurrency(locked.estimated_cost?.permit_fee || 0, currency)})
`;
        if (locked.film_precedents?.[0]) {
          report += `- **Film Precedent:** ${locked.film_precedents[0].film} (Dir. ${locked.film_precedents[0].director}) - ${locked.film_precedents[0].why}
`;
        }
        if (locked.practical_notes) {
          report += `- **Shoot Logistics:** ${locked.practical_notes}
`;
        }
        if (locked.preview_image_url) {
          report += `- **Visual Concept Keyframe:** [Preview Image](${locked.preview_image_url}) (${locked.preview_style_preset || "35mm Scope"})
`;
        }
      } else {
        report += `- **Status:** Unlocked / Pending Selection
`;
      }
      report += `
`;
    });

    if (currentProject.locationClusters && currentProject.locationClusters.length > 0) {
      report += `## CONSOLIDATION CLUSTERS

`;
      currentProject.locationClusters.forEach((cl) => {
        report += `### ${cl.name} (${cl.region})
`;
        report += `- **Scenes Included:** ${cl.scene_ids.length}
`;
        report += `- **Estimated Savings:** ${cl.estimated_savings || "N/A"}
`;
        report += `- **Notes:** ${cl.notes}

`;
      });
    }

    navigator.clipboard.writeText(report);
    toast.add({
      title: "Scout Package Copied",
      description: "Full markdown report copied to clipboard.",
      type: "success",
    });
  };

  // Run full project location research via Gemini + Parallel Web Systems grounding
  const handleRunLocationResearch = async () => {
    setIsScouting(true);
    try {
      const payload = {
        project_title: currentProject.title,
        genre: currentProject.genre,
        production_base: productionBase,
        currency: currency,
        budget: totalBudget,
        budget_cap_policy: budgetCapPolicy,
        scenes: scenes.map((s) => ({
          scene_id: s.id,
          scene_number: s.sceneNumber,
          title: s.title,
          slugline: s.slugline,
          location: s.location,
          summary: s.summary,
          shoot_region: s.shootRegion || productionBase,
          location_budget: s.locationBudget || Math.round(totalLocationBudget / Math.max(1, scenes.length)),
        })),
      };

      const res = await fetch("/api/location/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      const wasFallback = notifyIfFallback(data, "Location Scout");

      if (Array.isArray(data.scenes)) {
        const candidateMap = new Map<string, LocationCandidate[]>();
        data.scenes.forEach((scRes: any) => {
          candidateMap.set(scRes.scene_id, scRes.candidates || []);
        });

        const updatedScenes: FilmScene[] = scenes.map((s) => {
          const newCandidates = candidateMap.get(s.id) || [];
          const existingLock = s.selectedLocationCandidateId;
          const autoLock = existingLock || (newCandidates[0] ? newCandidates[0].candidate_id : undefined);

          return {
            ...s,
            locationCandidates: newCandidates.length > 0 ? newCandidates : s.locationCandidates,
            selectedLocationCandidateId: autoLock,
          };
        });

        const updated: ProjectData = {
          ...currentProject,
          scenes: updatedScenes,
          locationClusters: data.clusters || currentProject.locationClusters,
          updatedAt: Date.now(),
        };

        setCurrentProject(updated);
        saveProject(updated);
        onUpdateProject?.(updated);

        if (!wasFallback) {
          toast.add({
            title: "Real-World Locations Grounded",
            description: `Scouted ${data.scenes.length} scenes with live municipal permit rates & film precedents.`,
            type: "success",
          });
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.add({
        title: "Scouting Error",
        description: `Could not reach location researcher: ${msg}`,
        type: "error",
      });
    } finally {
      setIsScouting(false);
    }
  };

  // Lock in a candidate
  const handleLockInCandidate = (candidate: LocationCandidate, targetScene?: FilmScene) => {
    const sc = targetScene || selectedScene;
    if (!sc) return;

    const currentPicked = sc.locationCandidates?.find(
      (c) => c.candidate_id === sc.selectedLocationCandidateId
    );
    const currentCost = currentPicked
      ? (currentPicked.estimated_cost?.day_rate || 0) + (currentPicked.estimated_cost?.permit_fee || 0)
      : 0;
    const newCost =
      (candidate.estimated_cost?.day_rate || 0) + (candidate.estimated_cost?.permit_fee || 0);
    const netCostDelta = newCost - currentCost;

    // Check budget cap
    if (netCostDelta > remainingBudget) {
      if (budgetCapPolicy === "hard_block") {
        toast.add({
          title: "Budget Cap Blocked",
          description: `This location (${formatCurrency(newCost, currency)}) exceeds remaining funds by ${formatCurrency(
            netCostDelta - remainingBudget,
            currency
          )}. Hard Block is enforced.`,
          type: "error",
        });
        return;
      } else {
        toast.add({
          title: "Advisory Warning: Over Budget",
          description: `Location locked, but exceeds allocated budget by ${formatCurrency(
            netCostDelta - remainingBudget,
            currency
          )}.`,
          type: "info",
        });
      }
    }

    const updatedScenes: FilmScene[] = scenes.map((s) => {
      if (s.id === sc.id) {
        return {
          ...s,
          selectedLocationCandidateId: candidate.candidate_id,
        };
      }
      return s;
    });

    const updated: ProjectData = {
      ...currentProject,
      scenes: updatedScenes,
      updatedAt: Date.now(),
    };

    setCurrentProject(updated);
    saveProject(updated);
    onUpdateProject?.(updated);

    toast.add({
      title: "Location Locked",
      description: `Assigned "${candidate.name}" to Scene ${sc.sceneNumber}.`,
      type: "success",
    });
  };

  // Unlock / Clear Location
  const handleUnlockCandidate = (targetScene?: FilmScene) => {
    const sc = targetScene || selectedScene;
    if (!sc) return;

    const updatedScenes: FilmScene[] = scenes.map((s) => {
      if (s.id === sc.id) {
        return {
          ...s,
          selectedLocationCandidateId: undefined,
        };
      }
      return s;
    });

    const updated: ProjectData = {
      ...currentProject,
      scenes: updatedScenes,
      updatedAt: Date.now(),
    };

    setCurrentProject(updated);
    saveProject(updated);
    onUpdateProject?.(updated);

    toast.add({
      title: "Location Unlocked",
      description: `Cleared assigned location for Scene ${sc.sceneNumber}.`,
      type: "info",
    });
  };

  // Auto-lock top candidate for a scene
  const handleAutoLockBestMatch = (sc: FilmScene) => {
    if (!sc.locationCandidates || sc.locationCandidates.length === 0) return;
    const sorted = [...sc.locationCandidates].sort((a, b) => (b.rank_score || 0) - (a.rank_score || 0));
    handleLockInCandidate(sorted[0], sc);
  };

  // Generate on-demand cinematic visual keyframe for a candidate
  const handleGenerateLocationImage = async (
    candidate: LocationCandidate,
    customPreset?: string,
    customFraming?: string,
    targetScene?: FilmScene
  ) => {
    const sc = targetScene || selectedScene;
    if (!sc) return;

    const candId = candidate.candidate_id;
    const preset = customPreset || selectedPresetPerCand[candId] || LOCATION_STYLE_PRESETS[0].name;
    const framing = customFraming || selectedFramingPerCand[candId] || LOCATION_CAMERA_FRAMINGS[0].name;

    const prompt = synthesizeLocationVisualPrompt(candidate, sc, preset, framing);

    setIsGeneratingImage((prev) => ({ ...prev, [candId]: true }));
    try {
      const res = await fetch("/api/media/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          aspect_ratio: "16:9",
        }),
      });

      if (!res.ok) {
        throw new Error(`Generation failed with HTTP ${res.status}`);
      }

      const data = await res.json();
      notifyIfFallback(data, "Visual Keyframe Generation");

      if (!data.image_url) {
        throw new Error(data.error || "No image URL returned from generation service");
      }

      const updatedScenes: FilmScene[] = scenes.map((s) => {
        if (s.id === sc.id) {
          const updatedCandidates = (s.locationCandidates || []).map((c) => {
            if (c.candidate_id === candId) {
              return {
                ...c,
                preview_image_url: data.image_url,
                preview_image_prompt: prompt,
                preview_style_preset: preset,
                preview_camera_framing: framing,
              };
            }
            return c;
          });
          return {
            ...s,
            locationCandidates: updatedCandidates,
          };
        }
        return s;
      });

      const updated: ProjectData = {
        ...currentProject,
        scenes: updatedScenes,
        updatedAt: Date.now(),
      };

      setCurrentProject(updated);
      saveProject(updated);
      onUpdateProject?.(updated);

      if (dossierCandidate && dossierCandidate.candidate_id === candId) {
        setDossierCandidate({
          ...dossierCandidate,
          preview_image_url: data.image_url,
          preview_image_prompt: prompt,
          preview_style_preset: preset,
          preview_camera_framing: framing,
        });
      }

      toast.add({
        title: "Visual Keyframe Rendered",
        description: `Generated 16:9 concept for ${cleanCandidateName(candidate.name)} with ${preset}.`,
        type: "success",
      });
    } catch (err: unknown) {
      console.error("Location visual generation error:", err);
      toast.add({
        title: "Keyframe Generation Failed",
        description: err instanceof Error ? err.message : "Unable to generate visual keyframe.",
        type: "error",
      });
    } finally {
      setIsGeneratingImage((prev) => ({ ...prev, [candId]: false }));
    }
  };

  const handleSelectStudioTemplate = (tplId: string) => {
    const tpl = STUDIO_STAGE_TEMPLATES.find((t) => t.id === tplId) || STUDIO_STAGE_TEMPLATES[0];
    setSelectedStudioTemplateId(tplId);
    setCustomStudioName(tpl.name);
    setCustomStudioDayRate(tpl.day_rate);
    setCustomCycPaintFee(tpl.paint_fee);
    setCustomGridHeight(tpl.grid_height);
    setCustomDimensions(tpl.dimensions);
    setCustomPower(tpl.power_capacity);
    setCustomSound(tpl.sound_rating);
    setCustomCycType(tpl.cyc_type || "none");
    setCustomSetNotes(tpl.description);
  };

  const handleAddCustomStudioSet = () => {
    if (!selectedScene) return;
    if (!customStudioName.trim()) {
      toast.add({
        title: "Name Required",
        description: "Please provide a name for the studio or green screen set.",
        type: "error",
      });
      return;
    }

    const tpl =
      STUDIO_STAGE_TEMPLATES.find((t) => t.id === selectedStudioTemplateId) ||
      STUDIO_STAGE_TEMPLATES[0];

    const reg = customStudioRegion.trim() || selectedScene.shootRegion || productionBase;
    const candId = `loc_studio_${Date.now()}`;

    const newCandidate: LocationCandidate = {
      candidate_id: candId,
      name: customStudioName.trim(),
      region: reg,
      category: tpl.category,
      environment_type: tpl.environment_type,
      stage_specs: {
        stage_type: tpl.stage_type,
        grid_height: customGridHeight,
        dimensions: customDimensions,
        cyc_type: customCycType as any,
        cyc_dimensions: tpl.stage_type.includes("cyc") ? customDimensions : undefined,
        power_capacity: customPower,
        sound_rating: customSound,
        paint_or_restoration_fee: customCycPaintFee,
        custom_set_notes: customSetNotes,
      },
      rank_score: 0.94,
      score_breakdown: {
        budget_fit: 0.90,
        creative_fit: 0.98,
        shootability: 0.96,
        consolidation_bonus: 0.88,
      },
      estimated_cost: {
        day_rate: customStudioDayRate,
        permit_fee: 150,
        currency,
        notes: `Stage rental with ${customPower} and ${customSound}. ${customCycPaintFee > 0 ? `Cyc paint fee: ${formatCurrency(customCycPaintFee, currency)}.` : ""}`,
      },
      detailed_costs: {
        day_rate: customStudioDayRate,
        permit_fee: 150,
        fire_or_police_monitor: 0,
        security_or_site_rep: 250,
        basecamp_parking: 0,
        cleaning_deposit: customCycPaintFee > 0 ? customCycPaintFee : 350,
        crew_travel_zone: "In-Zone (On-Lot Parking & Facilities)",
        total_comprehensive: customStudioDayRate + 150 + 250 + (customCycPaintFee > 0 ? customCycPaintFee : 350),
      },
      pros: tpl.pros,
      cons: tpl.cons,
      reviews: [
        {
          author: "Jordan Vance",
          role: "VFX Supervisor & Stage Manager",
          rating: 4.9,
          quote: `${customStudioName} offers impeccable lighting control and grid clearance. Camlock power distro and silent HVAC made our sync-sound shooting seamless.`,
          project_type: "Studio Feature",
        },
      ],
      sound_and_acoustics: customSound,
      power_specs: customPower,
      film_precedents: [
        {
          film: tpl.film_precedent.film,
          director: tpl.film_precedent.director,
          why: tpl.film_precedent.why,
        },
      ],
      practical_notes: `Stage dimensions: ${customDimensions}. Grid clearance: ${customGridHeight}. Sound rating: ${customSound}. Load-in via soundstage elephant doors.`,
      sources: [
        {
          title: `${customStudioName} Technical Specs`,
          url: "https://www.productionhub.com",
        },
      ],
      search_grounded: false,
      shared_with_scenes: [],
    };

    const updatedScenes: FilmScene[] = scenes.map((s) => {
      if (s.id === selectedScene.id) {
        const existingCandidates = s.locationCandidates || [];
        return {
          ...s,
          locationCandidates: [newCandidate, ...existingCandidates],
          selectedLocationCandidateId: autoLockStudioSet ? candId : s.selectedLocationCandidateId,
        };
      }
      return s;
    });

    const updated: ProjectData = {
      ...currentProject,
      scenes: updatedScenes,
      updatedAt: Date.now(),
    };

    setCurrentProject(updated);
    saveProject(updated);
    onUpdateProject?.(updated);

    setIsAddStudioModalOpen(false);
    toast.add({
      title: "Studio Set Configured",
      description: `Added "${customStudioName}" to Scene ${selectedScene.sceneNumber}${autoLockStudioSet ? " and locked as active set." : "."}`,
      type: "success",
    });
  };

  // Add Custom Location Candidate to Selected Scene
  const handleAddCustomLocation = () => {
    if (!selectedScene) return;

    const trimmedName = customLocName.trim();
    if (!trimmedName) {
      toast.add({
        title: "Location Name Required",
        description: "Please enter a location name or venue title.",
        type: "error",
      });
      return;
    }

    const candId = `custom-loc-${Date.now()}`;
    const dayRateNum = Number(customLocDayRate) || 2000;
    const permitFeeNum = Number(customLocPermitFee) || 300;
    const regionVal =
      customLocRegion.trim() || selectedScene.shootRegion || productionBase;

    const effectiveSceneBudget =
      selectedScene.locationBudget ||
      Math.max(1000, Math.round(totalLocationBudget / Math.max(1, scenes.length)));

    const newCand: LocationCandidate = {
      candidate_id: candId,
      name: trimmedName,
      region: regionVal,
      category: customLocCategory.trim().toLowerCase() || "practical",
      environment_type: "practical",
      rank_score: 0.92,
      score_breakdown: {
        budget_fit: dayRateNum <= effectiveSceneBudget ? 0.95 : 0.75,
        creative_fit: 0.92,
        shootability: 0.9,
        consolidation_bonus: 0.85,
      },
      estimated_cost: {
        day_rate: dayRateNum,
        permit_fee: permitFeeNum,
        currency: currency,
        notes: `Custom scouted venue in ${regionVal}.`,
      },
      shared_with_scenes: [selectedScene.id],
      film_precedents: customLocFilmPrecedent.trim()
        ? [
            {
              film: customLocFilmPrecedent.trim(),
              director: customLocDirector.trim() || "Director Comp",
              why: customLocWhy.trim() || "Atmospheric visual and staging reference",
            },
          ]
        : [],
      practical_notes: customLocPracticalNotes.trim() || "User-added production location.",
      sources: [],
      search_grounded: false,
    };

    const updatedScenes: FilmScene[] = scenes.map((s) => {
      if (s.id === selectedScene.id) {
        const existing = s.locationCandidates || [];
        const shouldLock = customLocAutoLock || !s.selectedLocationCandidateId;
        return {
          ...s,
          locationCandidates: [newCand, ...existing],
          selectedLocationCandidateId: shouldLock ? candId : s.selectedLocationCandidateId,
          location: shouldLock ? trimmedName : s.location,
        };
      }
      return s;
    });

    const updated: ProjectData = {
      ...currentProject,
      scenes: updatedScenes,
      updatedAt: Date.now(),
    };

    setCurrentProject(updated);
    saveProject(updated);
    onUpdateProject?.(updated);

    setIsAddCustomLocationOpen(false);
    setCustomLocName("");
    setCustomLocFilmPrecedent("");
    setCustomLocDirector("");
    setCustomLocWhy("");
    setCustomLocPracticalNotes("");

    toast.add({
      title: "Location Added",
      description: `Added "${trimmedName}" to Scene ${selectedScene.sceneNumber}${
        customLocAutoLock ? " and set as active location." : "."
      }`,
      type: "success",
    });
  };

  // Quick edit scene region / budget
  const handleSaveSceneQuickEdit = () => {
    if (!editingScene) return;

    const updatedScenes: FilmScene[] = scenes.map((s) => {
      if (s.id === editingScene.id) {
        return {
          ...s,
          shootRegion: editRegion.trim() || undefined,
          locationBudget: editBudget > 0 ? editBudget : undefined,
        };
      }
      return s;
    });

    const updated: ProjectData = {
      ...currentProject,
      scenes: updatedScenes,
      updatedAt: Date.now(),
    };

    setCurrentProject(updated);
    saveProject(updated);
    onUpdateProject?.(updated);

    toast.add({
      title: "Scene Logistics Updated",
      description: `Updated Scene ${editingScene.sceneNumber}.`,
      type: "success",
    });
    setEditingScene(null);
  };

  // Apply a cross-scene cluster in one click
  const handleApplyCluster = (cluster: LocationCluster) => {
    const updatedScenes: FilmScene[] = scenes.map((s) => {
      if (cluster.scene_ids.includes(s.id)) {
        return {
          ...s,
          selectedLocationCandidateId: cluster.candidate_id,
        };
      }
      return s;
    });

    const updated: ProjectData = {
      ...currentProject,
      scenes: updatedScenes,
      updatedAt: Date.now(),
    };

    setCurrentProject(updated);
    saveProject(updated);
    onUpdateProject?.(updated);

    toast.add({
      title: "Consolidation Cluster Applied",
      description: `Consolidated ${cluster.scene_ids.length} scenes into "${cluster.name}".`,
      type: "success",
    });
  };

  // Handle Q&A asking
  const handleSendQA = async (customPrompt?: string) => {
    if (!qaCandidate) return;
    const query = customPrompt || qaInput.trim();
    if (!query || isAskingQA) return;

    const candKey = qaCandidate.candidate_id;
    const prior = qaMessages[candKey] || [];

    const userTurn: QAMessage = {
      sender: "user",
      text: query,
      timestamp: Date.now(),
    };

    setQaMessages((prev) => ({
      ...prev,
      [candKey]: [...prior, userTurn],
    }));
    setQaInput("");
    setIsAskingQA(true);

    try {
      const res = await fetch("/api/location/qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidate_id: qaCandidate.candidate_id,
          candidate_name: qaCandidate.name,
          region: qaCandidate.region,
          category: qaCandidate.category,
          question: query,
          project_title: currentProject.title,
        }),
      });

      const data = await res.json();
      const wasFallback = notifyIfFallback(data, "Location QA");

      const agentTurn: QAMessage = {
        sender: "agent",
        text: data.answer || "No response details returned.",
        sources: data.sources || [],
        suggestedFollowups: data.suggested_followups || [],
        timestamp: Date.now(),
        isFallback: wasFallback,
      };

      setQaMessages((prev) => ({
        ...prev,
        [candKey]: [...(prev[candKey] || []), agentTurn],
      }));
    } catch {
      toast.add({
        title: "Location QA: showing offline demo content",
        description: "Could not reach the location QA endpoint.",
        type: "warning",
      });
      const fallbackTurn: QAMessage = {
        sender: "agent",
        text: `Standard filming permits for ${qaCandidate.name} in ${qaCandidate.region} require 3-5 business days notice through the regional film office. Basecamp parking and electrical power should be surveyed with the facility manager.`,
        sources: [{ title: `${qaCandidate.region} Film Office`, url: "https://www.filmla.com" }],
        timestamp: Date.now(),
        isFallback: true,
      };
      setQaMessages((prev) => ({
        ...prev,
        [candKey]: [...(prev[candKey] || []), fallbackTurn],
      }));
    } finally {
      setIsAskingQA(false);
    }
  };

  // Pin QA note into scene notes
  const handlePinQAToScene = (text: string) => {
    if (!selectedScene) return;
    const existingNotes = selectedScene.summary || "";
    const updatedNotes = `${existingNotes}

[Location Scout Note for ${qaCandidate?.name || "Location"}]: ${text}`;

    const updatedScenes: FilmScene[] = scenes.map((s) => {
      if (s.id === selectedScene.id) {
        return {
          ...s,
          summary: updatedNotes.trim(),
        };
      }
      return s;
    });

    const updated: ProjectData = {
      ...currentProject,
      scenes: updatedScenes,
      updatedAt: Date.now(),
    };

    setCurrentProject(updated);
    saveProject(updated);
    onUpdateProject?.(updated);

    toast.add({
      title: "Scout Insight Pinned",
      description: `Appended note to Scene ${selectedScene.sceneNumber}.`,
      type: "success",
    });
  };

  // Filtered Scene List
  const filteredScenes = React.useMemo(() => {
    return scenes.filter((sc) => {
      // Search
      const q = sceneSearchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        sc.title.toLowerCase().includes(q) ||
        (sc.slugline || "").toLowerCase().includes(q) ||
        (sc.shootRegion || "").toLowerCase().includes(q) ||
        `scene ${sc.sceneNumber}`.includes(q);

      if (!matchesSearch) return false;

      // Status
      if (sceneStatusFilter === "locked") return Boolean(sc.selectedLocationCandidateId);
      if (sceneStatusFilter === "unlocked") return !sc.selectedLocationCandidateId;
      if (sceneStatusFilter === "over_budget") {
        const cand = sc.locationCandidates?.find((c) => c.candidate_id === sc.selectedLocationCandidateId);
        if (!cand) return false;
        const cost = (cand.estimated_cost?.day_rate || 0) + (cand.estimated_cost?.permit_fee || 0);
        const budget = sc.locationBudget || Math.round(totalLocationBudget / Math.max(1, scenes.length));
        return cost > budget;
      }
      return true;
    });
  }, [scenes, sceneSearchQuery, sceneStatusFilter, totalLocationBudget]);

  // Selected Scene Candidates Filtered & Sorted
  const activeCandidates = selectedScene?.locationCandidates || [];

  const candidateCategories = React.useMemo(() => {
    const cats = new Set<string>();
    activeCandidates.forEach((c) => {
      if (c.category) cats.add(c.category);
    });
    return Array.from(cats);
  }, [activeCandidates]);

  const isGreenScreenCandidate = (c: LocationCandidate) =>
    c.stage_specs?.stage_type === "greenscreen_cyc" ||
    c.stage_specs?.stage_type === "bluescreen_cyc" ||
    c.stage_specs?.cyc_type === "green_screen" ||
    c.stage_specs?.cyc_type === "blue_screen" ||
    c.environment_type === "green_screen" ||
    c.environment_type === "virtual_production" ||
    c.category?.toLowerCase().includes("green") ||
    c.category?.toLowerCase().includes("blue") ||
    c.category?.toLowerCase().includes("virtual") ||
    c.category?.toLowerCase().includes("led");

  const isSoundstageCandidate = (c: LocationCandidate) =>
    c.stage_specs?.stage_type === "soundstage" ||
    c.stage_specs?.stage_type === "custom_build" ||
    c.environment_type === "studio_stage" ||
    c.environment_type === "custom_build" ||
    c.category?.toLowerCase().includes("stage") ||
    c.category?.toLowerCase().includes("studio");

  const practicalCount = React.useMemo(() => {
    return activeCandidates.filter((c) => !isGreenScreenCandidate(c) && !isSoundstageCandidate(c)).length;
  }, [activeCandidates]);

  const soundstageCount = React.useMemo(() => {
    return activeCandidates.filter((c) => isSoundstageCandidate(c) && !isGreenScreenCandidate(c)).length;
  }, [activeCandidates]);

  const greenScreenCount = React.useMemo(() => {
    return activeCandidates.filter((c) => isGreenScreenCandidate(c)).length;
  }, [activeCandidates]);

  const filteredAndSortedCandidates = React.useMemo(() => {
    return activeCandidates
      .filter((c) => {
        const q = candidateSearchQuery.toLowerCase();
        const matchesQ =
          !q ||
          c.name.toLowerCase().includes(q) ||
          c.region.toLowerCase().includes(q) ||
          c.category.toLowerCase().includes(q);

        if (!matchesQ) return false;

        if (candidateCategoryFilter !== "all" && c.category !== candidateCategoryFilter) {
          return false;
        }

        if (candidateEnvironmentFilter !== "all") {
          const isGreen = isGreenScreenCandidate(c);
          const isStage = isSoundstageCandidate(c);

          if (candidateEnvironmentFilter === "green_screen" && !isGreen) return false;
          if (candidateEnvironmentFilter === "soundstage" && (!isStage || isGreen)) return false;
          if (candidateEnvironmentFilter === "practical" && (isGreen || isStage)) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const costA = (a.estimated_cost?.day_rate || 0) + (a.estimated_cost?.permit_fee || 0);
        const costB = (b.estimated_cost?.day_rate || 0) + (b.estimated_cost?.permit_fee || 0);

        if (candidateSortBy === "cost_asc") return costA - costB;
        if (candidateSortBy === "cost_desc") return costB - costA;
        if (candidateSortBy === "shootability") {
          return (b.score_breakdown?.shootability || 0) - (a.score_breakdown?.shootability || 0);
        }
        if (candidateSortBy === "creative") {
          return (b.score_breakdown?.creative_fit || 0) - (a.score_breakdown?.creative_fit || 0);
        }
        return (b.rank_score || 0) - (a.rank_score || 0);
      });
  }, [
    activeCandidates,
    candidateSearchQuery,
    candidateCategoryFilter,
    candidateEnvironmentFilter,
    candidateSortBy,
  ]);

  const lowestCostCandidate = React.useMemo(() => {
    if (activeCandidates.length === 0) return null;
    return [...activeCandidates].sort((a, b) => {
      const cA = (a.estimated_cost?.day_rate || 0) + (a.estimated_cost?.permit_fee || 0);
      const cB = (b.estimated_cost?.day_rate || 0) + (b.estimated_cost?.permit_fee || 0);
      return cA - cB;
    })[0];
  }, [activeCandidates]);

  const activeClusterList = currentProject.locationClusters || [];

  // Toggle candidate in comparison set
  const handleToggleCompareCandidate = (candidateId: string) => {
    setComparingCandidateIds((prev) => {
      if (prev.includes(candidateId)) {
        return prev.filter((id) => id !== candidateId);
      }
      if (prev.length >= 3) {
        toast.add({
          title: "Comparison Limit Reached",
          description: "You can compare up to 3 candidates.",
          type: "info",
        });
        return prev;
      }
      return [...prev, candidateId];
    });
  };

  const comparedCandidates = activeCandidates.filter((c) =>
    comparingCandidateIds.includes(c.candidate_id)
  );

  const scoutingSteps = [
    "Grounding municipal film commission registries & permit portals...",
    "Calculating local zone day rates & parking fees...",
    "Querying Parallel Web Systems for real-world production precedents & curfews...",
    "Optimizing multi-scene company move consolidation clusters...",
  ];

  return (
    <div className={cn("flex flex-col rounded-xl border border-border bg-card p-4 space-y-4", className)}>
      {/* ── UNIFIED COMPACT HEADER ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-border pb-3">
        <div className="space-y-1 min-w-0 max-w-xl">
          <div className="flex items-center gap-2 flex-wrap">
            <MapPin className="h-4 w-4 text-accent shrink-0" />
            <h2 className="text-sm sm:text-base font-bold text-foreground tracking-tight">
              Real-World Location Scouting
            </h2>
            <Badge variant="outline" className="border-accent/40 bg-accent/10 text-accent text-[10px] font-medium shrink-0">
              {productionBase} · {currency}
            </Badge>
            <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-400 text-[10px] font-mono shrink-0 flex items-center gap-1">
              <Zap className="h-3 w-3" /> Parallel Web Grounded
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Municipal permit schedules, candidate day rates, and soundstage specs grounded live with Parallel Web Systems.
          </p>
        </div>

        {/* Header Action Ribbon */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {/* Policy Toggle */}
          <button
            type="button"
            onClick={handleTogglePolicy}
            className={cn(
              "h-8 px-2.5 rounded-md border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0",
              budgetCapPolicy === "hard_block"
                ? "border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
                : "border-border bg-secondary/30 text-foreground/80 hover:bg-secondary/50 hover:text-foreground"
            )}
            title="Click to toggle budget cap enforcement policy (Advisory Warning vs Hard Block)"
          >
            <ShieldAlert className={cn("h-3.5 w-3.5 shrink-0", budgetCapPolicy === "hard_block" ? "text-rose-400" : "text-muted-foreground")} />
            <span className="text-muted-foreground font-normal">Policy:</span>
            <span className={budgetCapPolicy === "hard_block" ? "text-rose-300 font-semibold" : "text-foreground font-semibold"}>
              {budgetCapPolicy === "hard_block" ? "Hard Block" : "Advisory"}
            </span>
          </button>

          {/* View Mode Segmented Control */}
          <div className="flex items-center rounded-md border border-border bg-secondary/30 p-0.5 h-8 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode("scenes")}
              className={cn(
                "h-7 px-2.5 rounded text-xs font-semibold transition-all cursor-pointer whitespace-nowrap",
                viewMode === "scenes"
                  ? "bg-accent text-accent-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Scenes
            </button>
            <button
              type="button"
              onClick={() => setViewMode("clusters")}
              className={cn(
                "h-7 px-2.5 rounded text-xs font-semibold transition-all cursor-pointer whitespace-nowrap",
                viewMode === "clusters"
                  ? "bg-accent text-accent-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Clusters ({activeClusterList.length})
            </button>
          </div>

          {/* Export Scout Sheet */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportLocationPackage}
            className="h-8 text-xs gap-1.5 border-border hover:bg-secondary/40 cursor-pointer whitespace-nowrap shrink-0 px-2.5"
            title="Copy formatted markdown location package"
          >
            <Download className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span>Export</span>
          </Button>

          {/* Add Studio / Green Screen Stage Button */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (selectedScene) {
                setCustomStudioRegion(selectedScene.shootRegion || productionBase);
              }
              setIsAddStudioModalOpen(true);
            }}
            className="h-8 text-xs font-semibold gap-1.5 border-border hover:border-accent/40 bg-secondary/20 hover:bg-secondary/40 text-foreground cursor-pointer shadow-xs whitespace-nowrap shrink-0 px-3"
            title="Configure soundstage, chroma key cyc, or virtual production set"
          >
            <Layers className="h-3.5 w-3.5 text-accent shrink-0" />
            <span>+ Studio / Cyc Set</span>
          </Button>

          {/* Add Custom Location Button */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (selectedScene) {
                setCustomLocRegion(selectedScene.shootRegion || productionBase);
              }
              setIsAddCustomLocationOpen(true);
            }}
            className="h-8 text-xs font-semibold gap-1.5 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 bg-secondary/20 cursor-pointer shadow-xs whitespace-nowrap shrink-0 px-3"
            title="Manually add a custom location candidate to this scene"
          >
            <Plus className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            <span>+ Add Location</span>
          </Button>

          {/* Scout Real-World Locations Button */}
          <Button
            size="sm"
            onClick={handleRunLocationResearch}
            disabled={isScouting}
            className="h-8 text-xs font-semibold gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90 cursor-pointer shadow-xs whitespace-nowrap shrink-0 px-3.5"
          >
            {isScouting ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin shrink-0" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
            )}
            <span>{isScouting ? "Scouting..." : "Scout Locations"}</span>
          </Button>
        </div>
      </div>

      {/* ── LIVE SCOUTING SCANNER BANNER ── */}
      {isScouting && (
        <div className="rounded-lg border border-accent/40 bg-accent/10 p-2.5 flex items-center gap-3 animate-pulse text-xs">
          <RefreshCw className="h-3.5 w-3.5 animate-spin text-accent shrink-0" />
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-accent">
                {scoutingSteps[scoutingPhase]}
              </span>
              <span className="text-[10px] font-medium text-emerald-400 flex items-center gap-1">
                <Zap className="h-3 w-3" /> Parallel Web Systems Active
              </span>
            </div>
            <div className="w-full bg-accent/20 h-1 rounded-full overflow-hidden">
              <div
                className="bg-accent h-full transition-all duration-500"
                style={{ width: `${((scoutingPhase + 1) / 4) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── COMPACT 4-STAT FINANCIAL LOGISTICS RIBBON ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
        {/* Stat 1: Total Location Budget */}
        <div className="rounded-lg border border-border bg-secondary/15 p-2.5 space-y-0.5">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">Location Budget</span>
            <DollarSign className="h-3 w-3 opacity-60" />
          </div>
          <div className="text-base sm:text-lg font-bold tracking-tight text-foreground tabular-nums">
            {formatCurrency(totalLocationBudget, currency)}
          </div>
          <span className="text-[10px] text-muted-foreground block">
            {locAllocationPct}% of total {formatCurrency(totalBudget, currency)}
          </span>
        </div>

        {/* Stat 2: Committed Spend */}
        <div className="rounded-lg border border-border bg-secondary/15 p-2.5 space-y-0.5">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">Committed Spend</span>
            <span
              className={cn(
                "text-[9px] px-1 rounded font-bold tabular-nums",
                committedSpend > totalLocationBudget
                  ? "bg-rose-500/20 text-rose-300"
                  : "bg-emerald-500/20 text-emerald-300"
              )}
            >
              {budgetUtilizationPct}%
            </span>
          </div>
          <div
            className={cn(
              "text-base sm:text-lg font-bold tracking-tight tabular-nums",
              committedSpend > totalLocationBudget ? "text-rose-400" : "text-emerald-400"
            )}
          >
            {formatCurrency(committedSpend, currency)}
          </div>
          <span className="text-[10px] text-muted-foreground block">
            {committedSpend > totalLocationBudget ? "Exceeds location cap" : "Within production target"}
          </span>
        </div>

        {/* Stat 3: Remaining Funds */}
        <div className="rounded-lg border border-border bg-secondary/15 p-2.5 space-y-0.5">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">Remaining Balance</span>
            {remainingBudget < 0 && <AlertTriangle className="h-3 w-3 text-rose-400" />}
          </div>
          <div
            className={cn(
              "text-base sm:text-lg font-bold tracking-tight tabular-nums",
              remainingBudget < 0 ? "text-rose-400" : "text-foreground"
            )}
          >
            {remainingBudget < 0
              ? `-${formatCurrency(Math.abs(remainingBudget), currency)}`
              : formatCurrency(remainingBudget, currency)}
          </div>
          <span className="text-[10px] text-muted-foreground block">
            {remainingBudget < 0 ? "Over budget advisory active" : "Available for remaining slates"}
          </span>
        </div>

        {/* Stat 4: Lock Coverage */}
        <div className="rounded-lg border border-border bg-secondary/15 p-2.5 space-y-0.5">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">Slate Coverage</span>
            <Film className="h-3 w-3 opacity-60" />
          </div>
          <div className="text-base sm:text-lg font-bold tracking-tight text-foreground flex items-center justify-between tabular-nums">
            <span>{lockedScenesCount}/{scenes.length} Locked</span>
            {lockedScenesCount < scenes.length && (
              <button
                type="button"
                onClick={handleRebalanceBudget}
                className="text-[10px] text-accent hover:underline font-medium flex items-center gap-0.5 cursor-pointer"
                title="Distribute remaining funds evenly to unlocked scenes"
              >
                <ArrowUpDown className="h-2.5 w-2.5" />
                <span>Rebalance</span>
              </button>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground block">
            {lockedScenesCount === scenes.length ? "All sets locked in" : `${scenes.length - lockedScenesCount} scenes pending set lock`}
          </span>
        </div>
      </div>

      {/* Slim Budget Meter Bar */}
      <div className="w-full bg-secondary/40 h-1.5 rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full transition-all duration-300",
            committedSpend > totalLocationBudget
              ? "bg-rose-500"
              : committedSpend > totalLocationBudget * 0.9
              ? "bg-amber-500"
              : "bg-emerald-500"
          )}
          style={{ width: `${Math.min(100, budgetUtilizationPct)}%` }}
        />
      </div>

      {/* ── WORKSPACE VIEW MODES ── */}
      {viewMode === "scenes" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* ── LEFT RAIL: SCENES LIST (4 cols) ── */}
          <div className="lg:col-span-4 rounded-xl border border-border bg-card/60 p-3 space-y-2.5">
            <div className="flex items-center justify-between border-b border-border/70 pb-2">
              <span className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Film className="h-3.5 w-3.5 text-accent" />
                Scenes ({scenes.length})
              </span>
              <span className="text-[10px] text-muted-foreground font-medium tabular-nums">
                {lockedScenesCount} locked
              </span>
            </div>

            {/* Scene Search */}
            <div className="relative">
              <Search className="h-3 w-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search scene or location..."
                value={sceneSearchQuery}
                onChange={(e) => setSceneSearchQuery(e.target.value)}
                className="pl-7 h-7 text-xs bg-secondary/15"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1 overflow-x-auto text-[10px] pt-0.5 pb-0.5">
              {(
                [
                  { id: "all", label: `All (${scenes.length})` },
                  { id: "locked", label: `Locked (${lockedScenesCount})` },
                  { id: "unlocked", label: `Pending (${scenes.length - lockedScenesCount})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSceneStatusFilter(tab.id)}
                  className={cn(
                    "px-2 py-0.5 rounded border transition-colors whitespace-nowrap cursor-pointer",
                    sceneStatusFilter === tab.id
                      ? "border-accent/60 bg-accent/15 text-accent font-semibold"
                      : "border-border/60 text-muted-foreground hover:bg-secondary/30"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Scrollable Scene List */}
            <div className="space-y-1.5 max-h-[560px] overflow-y-auto pr-0.5">
              {filteredScenes.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  No scenes match search.
                </div>
              ) : (
                filteredScenes.map((sc) => {
                  const isSelected = sc.id === selectedSceneId;
                  const lockedCand = sc.locationCandidates?.find(
                    (c) => c.candidate_id === sc.selectedLocationCandidateId
                  );
                  const hasCandidates = (sc.locationCandidates?.length || 0) > 0;
                  const candCost = lockedCand
                    ? (lockedCand.estimated_cost?.day_rate || 0) + (lockedCand.estimated_cost?.permit_fee || 0)
                    : 0;

                  return (
                    <div
                      key={sc.id}
                      onClick={() => setSelectedSceneId(sc.id)}
                      className={cn(
                        "p-2.5 rounded-lg border transition-all cursor-pointer space-y-1",
                        isSelected
                          ? "border-accent bg-accent/10 shadow-xs ring-1 ring-accent/30"
                          : "border-border/70 bg-secondary/10 hover:bg-secondary/25"
                      )}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-semibold text-foreground flex items-center gap-1.5 truncate">
                          <span
                            className={cn(
                              "h-4 w-4 rounded flex items-center justify-center text-[9px] shrink-0 font-bold tabular-nums",
                              lockedCand
                                ? "bg-emerald-500/20 text-emerald-400"
                                : "bg-secondary text-muted-foreground"
                            )}
                          >
                            {sc.sceneNumber}
                          </span>
                          <span className="truncate">{sc.title}</span>
                        </span>

                        <div className="flex items-center gap-1 shrink-0">
                          {sc.shootRegion && sc.shootRegion !== productionBase ? (
                            <Badge
                              variant="outline"
                              className="text-[9px] py-0 px-1 border-accent/40 bg-accent/10 text-accent font-medium"
                            >
                              {sc.shootRegion.split(",")[0]}
                            </Badge>
                          ) : (
                            <span className="text-[10px] text-muted-foreground font-medium">
                              {(sc.shootRegion || productionBase).split(",")[0]}
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingScene(sc);
                              setEditRegion(sc.shootRegion || productionBase);
                              setEditBudget(
                                sc.locationBudget ||
                                  Math.round(totalLocationBudget / Math.max(1, scenes.length))
                              );
                            }}
                            className="p-0.5 text-muted-foreground hover:text-foreground"
                            title="Edit scene budget or region"
                          >
                            <Pencil className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      </div>

                      <p className="text-[11px] text-muted-foreground truncate uppercase tracking-tight">
                        {sc.slugline || sc.location || "EXT./INT. LOCATION"}
                      </p>

                      <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[10px]">
                        {lockedCand ? (
                          <span className="text-emerald-400 font-medium truncate flex items-center gap-1 max-w-[170px]">
                            <Check className="h-2.5 w-2.5 shrink-0" />
                            <span className="truncate">{cleanCandidateName(lockedCand.name)}</span>
                          </span>
                        ) : hasCandidates ? (
                          <span className="text-amber-400 font-medium tabular-nums">
                            {sc.locationCandidates?.length} options
                          </span>
                        ) : (
                          <span className="text-muted-foreground italic">Unscouted</span>
                        )}

                        {lockedCand && (
                          <span className="font-semibold text-foreground tabular-nums">
                            {formatCurrency(candCost, currency)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ── RIGHT PANEL: SELECTED SCENE & CANDIDATES (8 cols) ── */}
          <div className="lg:col-span-8 space-y-3">
            {selectedScene ? (
              <div className="rounded-xl border border-border bg-card p-4 space-y-4 shadow-sm">
                {/* Scene Context Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs font-semibold text-accent border-accent/40 bg-accent/10">
                        Scene {selectedScene.sceneNumber}
                      </Badge>
                      <h3 className="text-sm sm:text-base font-bold text-foreground">{selectedScene.title}</h3>
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                      <Navigation className="h-3 w-3 text-accent shrink-0" />
                      <span className="font-semibold text-foreground/90 uppercase tracking-wide text-[11px]">
                        {selectedScene.slugline || selectedScene.location}
                      </span>
                      <span className="text-border">·</span>
                      <span className="text-muted-foreground text-xs">Base:</span>
                      <span className="text-accent font-medium text-xs">
                        {selectedScene.shootRegion || productionBase}
                      </span>
                    </p>
                  </div>

                  {/* Scene Budget & Edit Button */}
                  <div className="flex items-center gap-2.5 sm:text-right shrink-0">
                    <div>
                      <span className="text-[10px] font-semibold text-muted-foreground block uppercase tracking-wider">
                        Scene Budget
                      </span>
                      <span className="text-xs font-bold text-foreground tabular-nums">
                        {formatCurrency(
                          selectedScene.locationBudget ||
                            Math.round(totalLocationBudget / Math.max(1, scenes.length)),
                          currency
                        )}
                      </span>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingScene(selectedScene);
                        setEditRegion(selectedScene.shootRegion || productionBase);
                        setEditBudget(
                          selectedScene.locationBudget ||
                            Math.round(totalLocationBudget / Math.max(1, scenes.length))
                        );
                      }}
                      className="text-xs h-7 px-2.5 gap-1 border-border hover:bg-secondary/40 font-medium cursor-pointer"
                    >
                      <Pencil className="h-2.5 w-2.5" />
                      <span>Edit</span>
                    </Button>
                  </div>
                </div>

                {/* Environment Filter Pills: Practical, Soundstage, Green Screen */}
                {activeCandidates.length > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-0.5">
                    <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
                      <span className="text-muted-foreground uppercase text-[10px] font-semibold tracking-wider shrink-0">Stage Type:</span>
                      {(
                        [
                          { id: "all", label: "All", count: activeCandidates.length, icon: null },
                          { id: "practical", label: "Practical", count: practicalCount, icon: Building2 },
                          { id: "soundstage", label: "Soundstages", count: soundstageCount, icon: Film },
                          { id: "green_screen", label: "Green Screen & LED", count: greenScreenCount, icon: Layers },
                        ] as const
                      ).map((tab) => {
                        const TabIcon = tab.icon;
                        return (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setCandidateEnvironmentFilter(tab.id)}
                            className={cn(
                              "px-2.5 py-1 rounded-md border text-xs font-medium transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5",
                              candidateEnvironmentFilter === tab.id
                                ? tab.id === "green_screen"
                                  ? "border-emerald-500/60 bg-emerald-500/20 text-emerald-300 font-semibold"
                                  : tab.id === "soundstage"
                                  ? "border-amber-500/60 bg-amber-500/20 text-amber-300 font-semibold"
                                  : "border-accent bg-accent/20 text-accent font-semibold"
                                : "border-border/60 text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                            )}
                          >
                            {TabIcon && <TabIcon className="h-3 w-3 shrink-0" />}
                            <span>{tab.label}</span>
                            <span className="text-[10px] opacity-75 tabular-nums">({tab.count})</span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-1.5 ml-auto">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setCustomLocRegion(selectedScene.shootRegion || productionBase);
                          setIsAddCustomLocationOpen(true);
                        }}
                        className="h-6 text-[10px] px-2.5 gap-1 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 shrink-0 font-semibold cursor-pointer"
                      >
                        <Plus className="h-2.5 w-2.5" />
                        <span>+ Add Location</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setCustomStudioRegion(selectedScene.shootRegion || productionBase);
                          setIsAddStudioModalOpen(true);
                        }}
                        className="h-6 text-[10px] px-2.5 gap-1 border-border text-muted-foreground hover:text-foreground shrink-0 font-semibold cursor-pointer"
                      >
                        <Plus className="h-2.5 w-2.5" />
                        <span>+ Studio/Cyc</span>
                      </Button>
                    </div>
                  </div>
                )}

                {/* Candidate Filters Toolbar */}
                {activeCandidates.length > 0 && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 rounded-lg bg-secondary/15 border border-border/60">
                    <div className="flex items-center gap-2 flex-1">
                      <div className="relative flex-1 max-w-xs">
                        <Search className="h-3 w-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="Filter candidates..."
                          value={candidateSearchQuery}
                          onChange={(e) => setCandidateSearchQuery(e.target.value)}
                          className="pl-7 h-7 text-xs bg-background"
                        />
                      </div>

                      {candidateCategories.length > 0 && (
                        <select
                          value={candidateCategoryFilter}
                          onChange={(e) => setCandidateCategoryFilter(e.target.value)}
                          className="h-7 text-xs rounded border border-border bg-background px-2 text-muted-foreground focus:outline-none"
                        >
                          <option value="all">All Types</option>
                          {candidateCategories.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={candidateSortBy}
                        onChange={(e) => setCandidateSortBy(e.target.value as any)}
                        className="h-7 text-xs rounded border border-border bg-background px-2 text-muted-foreground focus:outline-none"
                      >
                        <option value="rank">Highest Match</option>
                        <option value="cost_asc">Cost: Low to High</option>
                        <option value="cost_desc">Cost: High to Low</option>
                        <option value="shootability">Shootability</option>
                      </select>

                      <Button
                        size="sm"
                        variant={comparingCandidateIds.length > 0 ? "default" : "outline"}
                        disabled={comparingCandidateIds.length < 2}
                        onClick={() => setIsCompareModalOpen(true)}
                        className="text-xs h-7 gap-1"
                      >
                        <Scale className="h-3 w-3" />
                        <span>Compare ({comparingCandidateIds.length})</span>
                      </Button>
                    </div>
                  </div>
                )}

                {/* Candidate Cards */}
                {activeCandidates.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-8 text-center space-y-3">
                    <Building2 className="h-8 w-8 text-muted-foreground mx-auto" />
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-foreground block">
                        No Real-World Candidates Scouted Yet
                      </span>
                      <p className="text-xs text-muted-foreground max-w-md mx-auto">
                        Click &ldquo;Scout Locations&rdquo; to launch Gemini with live Parallel Web Systems
                        grounding for permit rates, day fees, and film precedents in {selectedScene.shootRegion || productionBase}, or add a custom indoor soundstage / green screen cyc.
                      </p>
                    </div>
                    <div className="flex items-center justify-center gap-2 pt-1">
                      <Button
                        size="sm"
                        onClick={handleRunLocationResearch}
                        disabled={isScouting}
                        className="text-xs gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90 cursor-pointer"
                      >
                        <Sparkles className="h-3 w-3" />
                        <span>Run Scout Now</span>
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setCustomLocRegion(selectedScene.shootRegion || productionBase);
                          setIsAddCustomLocationOpen(true);
                        }}
                        className="text-xs gap-1.5 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 cursor-pointer"
                      >
                        <Plus className="h-3 w-3" />
                        <span>+ Add Location</span>
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setCustomStudioRegion(selectedScene.shootRegion || productionBase);
                          setIsAddStudioModalOpen(true);
                        }}
                        className="text-xs gap-1.5 border-border hover:bg-secondary/40 cursor-pointer"
                      >
                        <Layers className="h-3 w-3" />
                        <span>+ Studio Stage</span>
                      </Button>
                    </div>
                  </div>
                ) : filteredAndSortedCandidates.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground">
                    No candidates match the filter.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredAndSortedCandidates.map((cand, cIdx) => {
                      const isLocked = selectedScene.selectedLocationCandidateId === cand.candidate_id;
                      const candCost =
                        (cand.estimated_cost?.day_rate || 0) + (cand.estimated_cost?.permit_fee || 0);
                      const isOverBudget = candCost > remainingBudget && !isLocked;
                      const isHardBlocked = isOverBudget && budgetCapPolicy === "hard_block";
                      const isTopRanked = cIdx === 0 && candidateSortBy === "rank";
                      const isComparing = comparingCandidateIds.includes(cand.candidate_id);
                      const matchPct = Math.round(cand.rank_score * 100);

                      return (
                        <div
                          key={cand.candidate_id || cIdx}
                          className={cn(
                            "p-3.5 sm:p-4 rounded-xl border transition-all space-y-2.5",
                            isLocked
                              ? "border-emerald-500/60 bg-emerald-500/5 shadow-xs ring-1 ring-emerald-500/30"
                              : "border-border bg-card hover:border-accent/40"
                          )}
                        >
                          {/* Card Header: Name, Badges & Actions */}
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-sm font-bold text-foreground">
                                  {cleanCandidateName(cand.name)}
                                </span>
                                <Badge variant="outline" className="text-[10px] font-medium py-0 px-1.5">
                                  {cand.category}
                                </Badge>
                                {cand.stage_specs?.stage_type === "greenscreen_cyc" && (
                                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px] py-0 px-1.5 font-medium flex items-center gap-1">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    Green Screen Cyc
                                  </Badge>
                                )}
                                {cand.stage_specs?.stage_type === "bluescreen_cyc" && (
                                  <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/40 text-[10px] py-0 px-1.5 font-medium flex items-center gap-1">
                                    <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                                    Blue Screen Cyc
                                  </Badge>
                                )}
                                {cand.stage_specs?.stage_type === "virtual_production" && (
                                  <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40 text-[10px] py-0 px-1.5 font-medium flex items-center gap-1">
                                    <Tv className="h-2.5 w-2.5 text-purple-400" />
                                    LED Volume (ICVFX)
                                  </Badge>
                                )}
                                {cand.stage_specs?.stage_type === "soundstage" && (
                                  <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px] py-0 px-1.5 font-medium flex items-center gap-1">
                                    <Film className="h-2.5 w-2.5 text-amber-400" />
                                    Soundstage Build
                                  </Badge>
                                )}
                                {cand.stage_specs?.stage_type === "custom_build" && (
                                  <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/40 text-[10px] py-0 px-1.5 font-medium flex items-center gap-1">
                                    <Building2 className="h-2.5 w-2.5 text-cyan-400" />
                                    Interior Build Set
                                  </Badge>
                                )}
                                {isTopRanked && (
                                  <Badge className="bg-accent/20 border-accent/40 text-accent text-[10px] py-0 px-1.5 font-semibold">
                                    #1 Match
                                  </Badge>
                                )}
                                {isLocked && (
                                  <Badge className="bg-emerald-600 text-white text-[10px] py-0 px-1.5 font-semibold gap-1">
                                    <Check className="h-2.5 w-2.5" />
                                    Active Set
                                  </Badge>
                                )}
                              </div>

                              <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                                <span className="flex items-center gap-1 text-[11px]">
                                  <Navigation className="h-2.5 w-2.5 text-accent" />
                                  {cand.region}
                                </span>
                                <span>·</span>
                                <a
                                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                    cand.name + " " + cand.region
                                  )}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[11px] text-accent hover:underline flex items-center gap-0.5"
                                >
                                  <span>Google Maps</span>
                                  <ExternalLink className="h-2.5 w-2.5" />
                                </a>
                              </div>
                            </div>

                            {/* Fit Score & Action Buttons */}
                            <div className="flex items-center gap-2 shrink-0">
                              {/* Match Score Badge */}
                              <div className="px-2 py-0.5 rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-center">
                                <span className="text-xs font-bold tabular-nums">{matchPct}% Match</span>
                              </div>

                              {/* Compare Toggle */}
                              <button
                                type="button"
                                onClick={() => handleToggleCompareCandidate(cand.candidate_id)}
                                className={cn(
                                  "px-2 py-1 rounded border text-xs transition-colors cursor-pointer",
                                  isComparing
                                    ? "border-accent bg-accent/20 text-accent font-semibold"
                                    : "border-border text-muted-foreground hover:bg-secondary/40"
                                )}
                                title="Add to comparison"
                              >
                                <Scale className="h-3 w-3" />
                              </button>

                              {/* Lock In / Unlock Action */}
                              {isLocked ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleUnlockCandidate(selectedScene)}
                                  className="text-xs h-7 px-2.5 gap-1 text-rose-300 border-rose-500/40 hover:bg-rose-500/10 cursor-pointer font-medium"
                                >
                                  <X className="h-2.5 w-2.5" />
                                  <span>Unlock</span>
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  disabled={isHardBlocked}
                                  onClick={() => handleLockInCandidate(cand)}
                                  className={cn(
                                    "text-xs h-7 px-2.5 gap-1 font-medium shadow-xs cursor-pointer",
                                    isHardBlocked
                                      ? "opacity-50 cursor-not-allowed border-rose-500/40 text-rose-400"
                                      : "bg-emerald-600 text-white hover:bg-emerald-500"
                                  )}
                                >
                                  <Check className="h-2.5 w-2.5" />
                                  <span>{isHardBlocked ? "Blocked" : "Lock Venue"}</span>
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* Financial Cost Strip */}
                          <div className="p-2 rounded-lg border border-border/70 bg-secondary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-3">
                              <div>
                                <span className="text-[9px] text-muted-foreground uppercase font-semibold tracking-wider block">
                                  Day Rate:
                                </span>
                                <span className="font-semibold text-foreground tabular-nums">
                                  {formatCurrency(cand.estimated_cost?.day_rate || 0, currency)}
                                </span>
                              </div>
                              <div className="border-l border-border/60 pl-3">
                                <span className="text-[9px] text-muted-foreground uppercase font-semibold tracking-wider block">
                                  Permit Fee:
                                </span>
                                <span className="font-semibold text-foreground tabular-nums">
                                  {formatCurrency(cand.estimated_cost?.permit_fee || 0, currency)}
                                </span>
                              </div>
                              <div className="border-l border-border/60 pl-3">
                                <span className="text-[9px] text-muted-foreground uppercase font-semibold tracking-wider block">
                                  Total Est:
                                </span>
                                <span className="font-bold text-emerald-400 tabular-nums">
                                  {formatCurrency(candCost, currency)}
                                </span>
                              </div>
                            </div>

                            {cand.estimated_cost?.notes && (
                              <span className="text-[11px] text-muted-foreground truncate max-w-sm">
                                {cand.estimated_cost.notes}
                              </span>
                            )}
                          </div>

                          {/* STAGE & RIGGING SPECS STRIP (if studio / green screen stage) */}
                          {cand.stage_specs && (
                            <div className="p-2.5 rounded-lg border border-accent/25 bg-accent/5 flex flex-wrap items-center justify-between gap-2 text-xs">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-accent flex items-center gap-1">
                                  <Layers className="h-3 w-3" />
                                  Stage Specs:
                                </span>
                                {cand.stage_specs.grid_height && (
                                  <span className="text-[10px] text-muted-foreground bg-background/60 px-2 py-0.5 rounded border border-border">
                                    Grid: <strong className="text-foreground">{cand.stage_specs.grid_height}</strong>
                                  </span>
                                )}
                                {cand.stage_specs.dimensions && (
                                  <span className="text-[10px] text-muted-foreground bg-background/60 px-2 py-0.5 rounded border border-border">
                                    Dims: <strong className="text-foreground">{cand.stage_specs.dimensions}</strong>
                                  </span>
                                )}
                                {cand.stage_specs.power_capacity && (
                                  <span className="text-[10px] text-muted-foreground bg-background/60 px-2 py-0.5 rounded border border-border">
                                    Power: <strong className="text-foreground">{cand.stage_specs.power_capacity}</strong>
                                  </span>
                                )}
                                {cand.stage_specs.sound_rating && (
                                  <span className="text-[10px] text-muted-foreground bg-background/60 px-2 py-0.5 rounded border border-border">
                                    Sound: <strong className="text-emerald-400">{cand.stage_specs.sound_rating}</strong>
                                  </span>
                                )}
                                {cand.stage_specs.paint_or_restoration_fee !== undefined && cand.stage_specs.paint_or_restoration_fee > 0 && (
                                  <span className="text-[10px] text-muted-foreground bg-background/60 px-2 py-0.5 rounded border border-border">
                                    Cyc Repaint: <strong className="text-amber-400 tabular-nums">{formatCurrency(cand.stage_specs.paint_or_restoration_fee, currency)}</strong>
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setDossierCandidate(cand);
                                  setDossierActiveTab("stage_specs");
                                }}
                                className="text-[10px] text-accent hover:underline font-semibold flex items-center gap-0.5 cursor-pointer ml-auto"
                              >
                                <span>Rigging Specs</span>
                                <ChevronRight className="h-2.5 w-2.5" />
                              </button>
                            </div>
                          )}

                          {/* ── CINEMATIC VISUAL KEYFRAME (ON-DEMAND PREVIEW) ── */}
                          <div className="rounded-lg border border-border/70 bg-secondary/15 overflow-hidden transition-all">
                            {cand.preview_image_url ? (
                              <div className="space-y-2 p-2.5">
                                <div className="relative aspect-video rounded-md overflow-hidden border border-border/80 bg-black/70 group shadow-md">
                                  <img
                                    src={cand.preview_image_url}
                                    alt={`Cinematic concept of ${cand.name}`}
                                    className="w-full h-full object-cover object-center group-hover:scale-102 transition-transform duration-500"
                                  />

                                  {/* Top Gradient & Slate Overlay */}
                                  <div className="absolute inset-x-0 top-0 p-2 bg-gradient-to-b from-black/85 via-black/40 to-transparent flex items-center justify-between gap-2">
                                    <Badge className="bg-black/75 backdrop-blur-md text-accent border border-accent/40 text-[9px] font-medium flex items-center gap-1.5 py-0 px-2">
                                      <Camera className="h-2.5 w-2.5" />
                                      <span>VISUAL KEYFRAME · {cand.preview_style_preset || "35mm Anamorphic Scope"}</span>
                                    </Badge>

                                    <div className="flex items-center gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setExpandedPromptCandId(
                                            expandedPromptCandId === cand.candidate_id ? null : cand.candidate_id
                                          )
                                        }
                                        className="h-6 px-1.5 rounded bg-black/75 hover:bg-black text-[9px] font-medium text-muted-foreground hover:text-foreground border border-border/60 flex items-center gap-1 transition-colors cursor-pointer"
                                        title="Inspect prompt"
                                      >
                                        <FileText className="h-2.5 w-2.5 text-accent" />
                                        <span>Prompt</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          setDossierCandidate(cand);
                                          setDossierActiveTab("keyframe");
                                        }}
                                        className="h-6 px-1.5 rounded bg-black/75 hover:bg-black text-[9px] font-medium text-muted-foreground hover:text-foreground border border-border/60 flex items-center gap-1 transition-colors cursor-pointer"
                                        title="Open in Full Dossier"
                                      >
                                        <Maximize2 className="h-2.5 w-2.5 text-accent" />
                                        <span>High-Res</span>
                                      </button>

                                      <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={isGeneratingImage[cand.candidate_id]}
                                        onClick={() => handleGenerateLocationImage(cand)}
                                        className="h-6 px-2 text-[9px] gap-1 bg-black/80 hover:bg-black text-amber-300 border-amber-500/40 cursor-pointer font-medium"
                                        title="Regenerate with selected presets"
                                      >
                                        <RefreshCw
                                          className={cn(
                                            "h-2.5 w-2.5",
                                            isGeneratingImage[cand.candidate_id] && "animate-spin"
                                          )}
                                        />
                                        <span>Re-render</span>
                                      </Button>
                                    </div>
                                  </div>

                                  {/* Bottom Gradient & Camera Framing Overlay */}
                                  <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/85 via-black/40 to-transparent flex items-center justify-between text-[10px]">
                                    <span className="px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-md border border-border/60 text-muted-foreground flex items-center gap-1">
                                      <Camera className="h-2.5 w-2.5 text-accent" />
                                      <span>{cand.preview_camera_framing || "Wide Establishing Master (24mm)"}</span>
                                    </span>
                                    <span className="text-[10px] text-muted-foreground/80 hidden sm:inline">
                                      {selectedScene?.slugline}
                                    </span>
                                  </div>
                                </div>

                                {/* Collapsible Synthesized Prompt Drawer */}
                                {expandedPromptCandId === cand.candidate_id && cand.preview_image_prompt && (
                                  <div className="p-2 rounded bg-background/80 border border-border/80 space-y-1.5 text-xs">
                                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                      <span className="uppercase font-semibold tracking-wider text-accent">Omni Flash / Imagen 3 Prompt:</span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          navigator.clipboard.writeText(cand.preview_image_prompt || "");
                                          toast.add({
                                            title: "Prompt Copied",
                                            description: "Copied visual keyframe prompt to clipboard.",
                                            type: "success",
                                          });
                                        }}
                                        className="hover:text-foreground flex items-center gap-1 cursor-pointer font-medium"
                                      >
                                        <Copy className="h-2.5 w-2.5" />
                                        <span>Copy</span>
                                      </button>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground leading-relaxed break-words bg-secondary/30 p-2 rounded border border-border/50">
                                      {cand.preview_image_prompt}
                                    </p>
                                  </div>
                                )}
                              </div>
                            ) : (
                              /* Empty State / On-Demand Generation Panel */
                              <div className="p-2.5 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5">
                                    <Camera className="h-3.5 w-3.5 text-accent" />
                                    <span className="text-xs font-bold text-foreground">
                                      Cinematic Scene Visualizer
                                    </span>
                                  </div>
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] font-medium text-accent border-accent/40 bg-accent/5"
                                  >
                                    Omni Flash / Imagen 3 Keyframe
                                  </Badge>
                                </div>

                                <p className="text-[11px] text-muted-foreground leading-snug">
                                  Render an on-demand 16:9 cinematic concept keyframe showing how{" "}
                                  <strong className="text-foreground">{cleanCandidateName(cand.name)}</strong> looks
                                  lit and framed for Scene {selectedScene?.sceneNumber} ({selectedScene?.slugline}).
                                </p>

                                {/* Generator Presets Controls Bar */}
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-0.5">
                                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                    <select
                                      value={
                                        selectedPresetPerCand[cand.candidate_id] || LOCATION_STYLE_PRESETS[0].name
                                      }
                                      onChange={(e) =>
                                        setSelectedPresetPerCand((prev) => ({
                                          ...prev,
                                          [cand.candidate_id]: e.target.value,
                                        }))
                                      }
                                      className="h-7 text-xs rounded border border-border bg-background px-2 text-foreground focus:outline-hidden focus:ring-1 focus:ring-accent"
                                    >
                                      {LOCATION_STYLE_PRESETS.map((preset) => (
                                        <option key={preset.id} value={preset.name}>
                                          {preset.name}
                                        </option>
                                      ))}
                                    </select>

                                    <select
                                      value={
                                        selectedFramingPerCand[cand.candidate_id] ||
                                        LOCATION_CAMERA_FRAMINGS[0].name
                                      }
                                      onChange={(e) =>
                                        setSelectedFramingPerCand((prev) => ({
                                          ...prev,
                                          [cand.candidate_id]: e.target.value,
                                        }))
                                      }
                                      className="h-7 text-xs rounded border border-border bg-background px-2 text-foreground focus:outline-hidden focus:ring-1 focus:ring-accent"
                                    >
                                      {LOCATION_CAMERA_FRAMINGS.map((framing) => (
                                        <option key={framing.id} value={framing.name}>
                                          {framing.name}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <Button
                                    size="sm"
                                    disabled={isGeneratingImage[cand.candidate_id]}
                                    onClick={() => handleGenerateLocationImage(cand)}
                                    className="h-7 px-3 text-xs gap-1.5 font-semibold bg-accent text-accent-foreground hover:bg-accent/90 shrink-0 cursor-pointer shadow-xs"
                                  >
                                    {isGeneratingImage[cand.candidate_id] ? (
                                      <>
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                        <span>Rendering...</span>
                                      </>
                                    ) : (
                                      <>
                                        <Sparkles className="h-3 w-3" />
                                        <span>Generate Keyframe</span>
                                      </>
                                    )}
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* ── PRODUCTION PARAMETERS PREVIEW: PROS/CONS, REVIEWS & LOCAL ECONOMY ── */}
                          {((cand.pros && cand.pros.length > 0) || (cand.cons && cand.cons.length > 0)) && (
                            <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[10px]">
                              {cand.pros?.slice(0, 2).map((pro, pI) => (
                                <span
                                  key={pI}
                                  className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 flex items-center gap-1 font-medium truncate max-w-[280px]"
                                  title={pro}
                                >
                                  <ThumbsUp className="h-2.5 w-2.5 text-emerald-400 shrink-0" />
                                  <span className="truncate">{pro}</span>
                                </span>
                              ))}
                              {cand.cons?.slice(0, 1).map((con, cI) => (
                                <span
                                  key={cI}
                                  className="px-2 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/25 text-rose-300 flex items-center gap-1 font-medium truncate max-w-[260px]"
                                  title={con}
                                >
                                  <ThumbsDown className="h-2.5 w-2.5 text-rose-400 shrink-0" />
                                  <span className="truncate">{con}</span>
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Filmmaker Reviews & Zone Tags */}
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap pt-0.5">
                            {cand.reviews && cand.reviews.length > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setDossierCandidate(cand);
                                  setDossierActiveTab("reviews");
                                }}
                                className="text-amber-300 font-medium flex items-center gap-1 hover:underline cursor-pointer bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 rounded text-[10px]"
                              >
                                <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                                <span>{cand.reviews[0].rating.toFixed(1)}/5.0</span>
                                <span className="text-muted-foreground">({cand.reviews.length} filmmaker reviews)</span>
                              </button>
                            )}

                            {cand.local_economy?.studio_zone_status && (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-secondary/30 border border-border text-foreground flex items-center gap-1">
                                <Navigation className="h-2.5 w-2.5 text-accent" />
                                <span>{cand.local_economy.studio_zone_status.split("—")[0].trim()}</span>
                              </span>
                            )}

                            {cand.local_economy?.tax_incentive && (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-secondary/30 border border-border text-accent flex items-center gap-1">
                                <DollarSign className="h-2.5 w-2.5" />
                                <span>{cand.local_economy.tax_incentive.split("—")[0].trim()}</span>
                              </span>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                setDossierCandidate(cand);
                                setDossierActiveTab("costs");
                              }}
                              className="text-[10px] text-accent hover:underline flex items-center gap-1 ml-auto cursor-pointer font-semibold"
                            >
                              <span>Full Production Dossier</span>
                              <ChevronRight className="h-3 w-3" />
                            </button>
                          </div>

                          {/* Over Budget Notice */}
                          {isOverBudget && (
                            <div
                              className={cn(
                                "p-2 rounded-md text-xs flex items-center gap-2",
                                isHardBlocked
                                  ? "bg-rose-500/10 border border-rose-500/30 text-rose-400"
                                  : "bg-amber-500/10 border border-amber-500/30 text-amber-300"
                              )}
                            >
                              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                              <span>
                                {isHardBlocked
                                  ? `Hard Block: Exceeds remaining budget by ${formatCurrency(
                                      candCost - remainingBudget,
                                      currency
                                    )}.`
                                  : `Advisory: Exceeds remaining budget by ${formatCurrency(
                                      candCost - remainingBudget,
                                      currency
                                    )}.`}
                              </span>
                            </div>
                          )}

                          {/* Precedents & Shootability */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            <div className="space-y-0.5 p-2 rounded bg-background/50 border border-border/60">
                              <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                <Film className="h-2.5 w-2.5 text-accent" />
                                Precedent Film:
                              </span>
                              {cand.film_precedents?.[0] ? (
                                <p className="text-[11px] text-foreground">
                                  <strong>{cand.film_precedents[0].film}</strong> (Dir. {cand.film_precedents[0].director}) — {cand.film_precedents[0].why}
                                </p>
                              ) : (
                                <span className="text-[11px] text-muted-foreground italic">Atmospheric genre match</span>
                              )}
                            </div>

                            <div className="space-y-0.5 p-2 rounded bg-background/50 border border-border/60">
                              <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                <Building2 className="h-2.5 w-2.5 text-accent" />
                                Shootability &amp; Permits:
                              </span>
                              <p className="text-[11px] text-muted-foreground leading-relaxed">
                                {cand.practical_notes || "Standard municipal permit lead time."}
                              </p>
                            </div>
                          </div>

                          {/* Card Footer */}
                          <div className="flex items-center justify-between pt-1 border-t border-border/40 text-xs">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[9px] text-muted-foreground font-medium">Sources:</span>
                              {cand.sources && cand.sources.length > 0 ? (
                                  cand.sources.slice(0, 3).map((src, sIdx) => {
                                    const isParallel = src.title.toLowerCase().includes("parallel");
                                    return (
                                      <a
                                        key={sIdx}
                                        href={src.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={cn(
                                          "text-[9px] font-medium hover:underline flex items-center gap-0.5 px-1.5 py-0.5 rounded border",
                                          isParallel
                                            ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30 font-mono"
                                            : "text-accent bg-accent/5 border-accent/20"
                                        )}
                                      >
                                        <span className="truncate max-w-[140px]">{src.title}</span>
                                        <ExternalLink className="h-2 w-2" />
                                      </a>
                                    );
                                  })
                              ) : (
                                <span className="text-[9px] text-muted-foreground font-medium">
                                  Municipal Registry
                                </span>
                              )}
                            </div>

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setQaCandidate(cand)}
                              className="text-xs h-6 px-2 gap-1 text-accent hover:bg-accent/10 cursor-pointer font-medium"
                            >
                              <MessageSquare className="h-3 w-3" />
                              <span>Ask AI Scout</span>
                              {(qaMessages[cand.candidate_id] || []).length > 0 && (
                                <Badge className="h-3.5 px-1 text-[8px] bg-accent text-accent-foreground font-semibold tabular-nums">
                                  {(qaMessages[cand.candidate_id] || []).length}
                                </Badge>
                              )}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card p-6 text-center text-muted-foreground text-xs">
                Select a scene from the left to view scouted candidates.
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ── CROSS-SCENE CONSOLIDATION CLUSTERS ── */
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <div>
              <span className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-accent" />
                Cross-Scene Location Consolidation Clusters
              </span>
              <p className="text-xs text-muted-foreground">
                Merge multiple scenes into shared venues to eliminate truck company moves and duplicate permit costs.
              </p>
            </div>
          </div>

          {activeClusterList.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center space-y-2">
              <Layers className="h-8 w-8 text-muted-foreground mx-auto" />
              <span className="text-xs font-bold text-foreground block">
                No Consolidation Clusters Detected Yet
              </span>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Run &ldquo;Scout Locations&rdquo; to group scenes into shared production hubs.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {activeClusterList.map((cluster) => {
                const clusterScenes = scenes.filter((s) => cluster.scene_ids.includes(s.id));
                const allAlreadyLocked = clusterScenes.every(
                  (s) => s.selectedLocationCandidateId === cluster.candidate_id
                );

                return (
                  <div
                    key={cluster.cluster_id}
                    className="p-4 rounded-xl border border-border bg-card space-y-2.5 shadow-xs flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5">
                          <span className="text-sm font-bold text-foreground block">{cluster.name}</span>
                          <span className="text-xs text-muted-foreground font-medium">
                            {cluster.region} · {cluster.category}
                          </span>
                        </div>
                        <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 text-[10px] font-medium">
                          {cluster.scene_ids.length} Scenes
                        </Badge>
                      </div>

                      <p className="text-xs text-muted-foreground leading-relaxed">{cluster.notes}</p>

                      {cluster.estimated_savings && (
                        <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2 text-xs text-emerald-300">
                          <TrendingDown className="h-3.5 w-3.5 shrink-0" />
                          <span>Consolidation Savings: <strong className="tabular-nums">{cluster.estimated_savings}</strong></span>
                        </div>
                      )}

                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground block">
                          Included Scenes:
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {clusterScenes.map((sc) => (
                            <Badge
                              key={sc.id}
                              variant={sc.selectedLocationCandidateId === cluster.candidate_id ? "default" : "secondary"}
                              className={cn(
                                "text-xs font-medium",
                                sc.selectedLocationCandidateId === cluster.candidate_id && "bg-emerald-600 text-white"
                              )}
                            >
                              Scene {sc.sceneNumber}: {sc.title}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-border/50 flex justify-end">
                      <Button
                        size="sm"
                        disabled={allAlreadyLocked}
                        onClick={() => handleApplyCluster(cluster)}
                        className="text-xs h-7 gap-1 bg-accent text-accent-foreground hover:bg-accent/90 cursor-pointer font-medium"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        <span>
                          {allAlreadyLocked
                            ? "All Scenes Locked"
                            : `Consolidate ${cluster.scene_ids.length} Scenes`}
                        </span>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── SIDE-BY-SIDE CANDIDATE COMPARISON MODAL ── */}
      <Dialog open={isCompareModalOpen} onOpenChange={setIsCompareModalOpen}>
        <DialogContent className="max-w-4xl w-[92vw] lg:w-[960px] max-h-[72vh] p-0 flex flex-col bg-card border-border shadow-2xl rounded-2xl overflow-hidden">
          <div className="p-4 pb-3 border-b border-border/70 bg-secondary/20 shrink-0">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Scale className="h-4 w-4 text-accent" />
                Side-by-Side Location Candidate Comparison
              </h3>
              <p className="text-xs text-muted-foreground">
                Comparing candidate options for Scene {selectedScene?.sceneNumber}: {selectedScene?.title} ({comparedCandidates.length} selected)
              </p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 sm:p-6">
            {comparedCandidates.length < 2 ? (
              <div className="p-8 text-center text-xs text-muted-foreground space-y-2">
                <Scale className="h-8 w-8 mx-auto text-muted-foreground/60" />
                <p>Select at least two candidate cards to compare their rates, logistics, and shootability side-by-side.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {comparedCandidates.map((cand) => {
                const isLocked = selectedScene?.selectedLocationCandidateId === cand.candidate_id;
                const candCost =
                  (cand.estimated_cost?.day_rate || 0) + (cand.estimated_cost?.permit_fee || 0);

                return (
                  <div
                    key={cand.candidate_id}
                    className={cn(
                      "p-3 rounded-xl border space-y-2 bg-secondary/10 flex flex-col justify-between text-xs",
                      isLocked && "border-emerald-500/60 bg-emerald-500/5 ring-1 ring-emerald-500/30"
                    )}
                  >
                    <div className="space-y-2">
                      <div>
                        <span className="font-bold text-foreground block">{cleanCandidateName(cand.name)}</span>
                        <span className="text-[10px] text-muted-foreground font-medium">
                          {cand.region} · {cand.category}
                        </span>
                      </div>

                      <div className="p-2 rounded bg-background border border-border/50 space-y-0.5 text-[11px]">
                        <div className="flex justify-between text-muted-foreground">
                          <span>Day Rate:</span>
                          <span className="text-foreground font-semibold tabular-nums">
                            {formatCurrency(cand.estimated_cost?.day_rate || 0, currency)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Permit Fee:</span>
                          <span className="text-foreground tabular-nums">
                            {formatCurrency(cand.estimated_cost?.permit_fee || 0, currency)}
                          </span>
                        </div>
                        <div className="flex justify-between pt-1 border-t border-border/40 font-bold text-emerald-400 tabular-nums">
                          <span>Est. Shoot Cost:</span>
                          <span>{formatCurrency(candCost, currency)}</span>
                        </div>
                      </div>

                      {/* Creative & Shootability Scores */}
                      <div className="space-y-1 text-[11px]">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Creative Match:</span>
                          <span className="font-semibold text-foreground tabular-nums">
                            {Math.round((cand.score_breakdown?.creative_fit || 0.8) * 100)}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Shootability:</span>
                          <span className="font-semibold text-foreground tabular-nums">
                            {Math.round((cand.score_breakdown?.shootability || 0.8) * 100)}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Budget Fit:</span>
                          <span className="font-semibold text-foreground tabular-nums">
                            {Math.round((cand.score_breakdown?.budget_fit || 0.8) * 100)}%
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-border/50">
                      {isLocked ? (
                        <div className="py-1 px-2 text-center rounded bg-emerald-500/10 text-emerald-400 font-semibold text-xs flex items-center justify-center gap-1">
                          <Check className="h-3 w-3" />
                          <span>Active Set</span>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => {
                            handleLockInCandidate(cand);
                            setIsCompareModalOpen(false);
                          }}
                          className="w-full text-xs h-7 gap-1 bg-accent text-accent-foreground hover:bg-accent/90 font-medium cursor-pointer"
                        >
                          <Check className="h-3 w-3" />
                          <span>Lock In Location</span>
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── QUICK EDIT SCENE REGION & BUDGET MODAL ── */}
      <Dialog open={!!editingScene} onOpenChange={(open) => !open && setEditingScene(null)}>
        <DialogContent className="max-w-sm bg-card border-border shadow-2xl p-4 space-y-3">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">
              Edit Scene {editingScene?.sceneNumber} Location Logistics
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Override shoot region or location budget for this scene.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-1 text-xs">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground block">
                Shoot Region Override:
              </label>
              <Input
                placeholder={`e.g. London, Soho or ${productionBase}`}
                value={editRegion}
                onChange={(e) => setEditRegion(e.target.value)}
                className="text-xs h-8"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground block">
                Location Budget ({currency}):
              </label>
              <Input
                type="number"
                value={editBudget || ""}
                onChange={(e) => setEditBudget(Number(e.target.value))}
                className="text-xs h-8 tabular-nums font-semibold"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditingScene(null)}
              className="text-xs h-7"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveSceneQuickEdit}
              className="text-xs h-7 bg-accent text-accent-foreground hover:bg-accent/90"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── COMPREHENSIVE PRODUCTION DOSSIER MODAL ── */}
      <Dialog open={Boolean(dossierCandidate)} onOpenChange={(open) => !open && setDossierCandidate(null)}>
        <DialogContent className="max-w-4xl w-[92vw] lg:w-[960px] max-h-[72vh] p-0 flex flex-col bg-card border-border shadow-2xl rounded-2xl overflow-hidden">
          {dossierCandidate && (
            <>
              {/* Dossier Widescreen Header */}
              <div className="p-4 pb-2.5 border-b border-border/70 bg-secondary/20 shrink-0 space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="h-7 w-7 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center text-accent">
                        <Building2 className="h-4 w-4" />
                      </div>
                      <h3 className="text-base sm:text-lg font-bold text-foreground">
                        {cleanCandidateName(dossierCandidate.name)}
                      </h3>
                      <Badge variant="outline" className="text-[10px] font-medium">
                        {dossierCandidate.category}
                      </Badge>
                      <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px] font-semibold tabular-nums">
                        {Math.round(dossierCandidate.rank_score * 100)}% Match
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Navigation className="h-3 w-3 text-accent" />
                      {dossierCandidate.region} · Film Production Logistics &amp; Operational Dossier
                    </p>
                  </div>

                  {dossierCandidate.reviews && dossierCandidate.reviews.length > 0 && (
                    <div className="px-3 py-1 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs flex items-center gap-1.5 shrink-0 shadow-xs tabular-nums font-semibold">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      <span>{dossierCandidate.reviews[0].rating.toFixed(1)} / 5.0</span>
                      <span className="text-[10px] text-muted-foreground hidden sm:inline font-normal">({dossierCandidate.reviews.length} reviews)</span>
                    </div>
                  )}
                </div>

                {/* Dossier Tabs with ample space and clean styling */}
                <div className="flex items-center gap-2 overflow-x-auto text-xs pt-1">
                  {([
                    { id: "keyframe" as const, label: "Visual Concept Keyframe", icon: Camera },
                    ...(dossierCandidate.stage_specs
                      ? [{ id: "stage_specs" as const, label: "Stage & Rigging Specs", icon: Layers }]
                      : []),
                    { id: "costs" as const, label: "Itemized Expenses & Crew Zone", icon: DollarSign },
                    { id: "pros_cons" as const, label: "Pros & Cons Analysis", icon: Scale },
                    { id: "reviews" as const, label: `Filmmaker Reviews (${dossierCandidate.reviews?.length || 0})`, icon: Star },
                    { id: "economy" as const, label: "Local Film Economy & Rigging", icon: Film },
                  ]).map((tab) => {
                    const TabIcon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setDossierActiveTab(tab.id)}
                        className={cn(
                          "px-3.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap",
                          dossierActiveTab === tab.id
                            ? "border-accent bg-accent/20 text-accent shadow-xs"
                            : "border-transparent text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                        )}
                      >
                        <TabIcon className="h-3 w-3" />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dossier Body with dedicated scroll container */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">

              {/* TAB: STAGE & RIGGING SPECS */}
              {dossierActiveTab === "stage_specs" && dossierCandidate.stage_specs && (
                <div className="space-y-3 pt-2 text-xs">
                  <div className="p-3.5 rounded-xl border border-accent/30 bg-accent/5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-accent uppercase tracking-wider flex items-center gap-1.5">
                        <Layers className="h-3.5 w-3.5" />
                        Stage Classification &amp; Construction Archetype
                      </span>
                      <Badge className="bg-accent/20 border-accent/40 text-accent font-medium text-[10px]">
                        {dossierCandidate.stage_specs.stage_type.toUpperCase().replace("_", " ")}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {dossierCandidate.stage_specs.custom_set_notes || dossierCandidate.practical_notes}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Architectural & Rigging Dimensions */}
                    <div className="p-3.5 rounded-xl border border-border bg-secondary/15 space-y-2.5">
                      <span className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground block">
                        Rigging Grid &amp; Clearance Dimensions
                      </span>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between items-center py-1 border-b border-border/40">
                          <span className="text-muted-foreground">Grid Height Clearance:</span>
                          <span className="font-semibold text-foreground">{dossierCandidate.stage_specs.grid_height || "24 ft clearance"}</span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-border/40">
                          <span className="text-muted-foreground">Stage Floor Footprint:</span>
                          <span className="font-semibold text-foreground tabular-nums">
                            {dossierCandidate.stage_specs.square_footage ? `${dossierCandidate.stage_specs.square_footage.toLocaleString()} sq ft` : dossierCandidate.stage_specs.dimensions || "4,500 sq ft"}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-border/40">
                          <span className="text-muted-foreground">Cyclorama / Backdrop:</span>
                          <span className="font-semibold text-foreground">{dossierCandidate.stage_specs.cyc_dimensions || dossierCandidate.stage_specs.cyc_type || "3-Wall Hard Cove Cyc"}</span>
                        </div>
                        <div className="flex justify-between items-center py-1">
                          <span className="text-muted-foreground">Lighting Grid Structure:</span>
                          <span className="font-semibold text-foreground text-[11px]">{dossierCandidate.stage_specs.lighting_grid || "Motorized Pipe Grid with DMX Distribution"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Stage Utilities & Acoustical Sound Rating */}
                    <div className="p-3.5 rounded-xl border border-border bg-secondary/15 space-y-2.5">
                      <span className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground block">
                        Acoustics &amp; Power Distribution
                      </span>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between items-center py-1 border-b border-border/40">
                          <span className="text-muted-foreground">Acoustic Isolation:</span>
                          <span className="font-semibold text-emerald-400">{dossierCandidate.stage_specs.sound_rating || "NC-25 Certified Soundstage"}</span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-border/40">
                          <span className="text-muted-foreground">Electrical Service:</span>
                          <span className="font-semibold text-foreground">{dossierCandidate.stage_specs.power_capacity || "1200A 3-Phase Camlock"}</span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-border/40">
                          <span className="text-muted-foreground">Load-In Access:</span>
                          <span className="font-semibold text-foreground">{dossierCandidate.stage_specs.load_in_access || "14' x 16' Elephant Door (Drive-In)"}</span>
                        </div>
                        <div className="flex justify-between items-center py-1">
                          <span className="text-muted-foreground">Cyc Repaint / Restoration Fee:</span>
                          <span className="font-semibold text-amber-400 tabular-nums">
                            {dossierCandidate.stage_specs.paint_or_restoration_fee !== undefined
                              ? formatCurrency(dossierCandidate.stage_specs.paint_or_restoration_fee, currency)
                              : "$500 (Fresh Chroma Green)"}
                          </span>
                        </div>
                        {dossierCandidate.stage_specs.virtual_production_engine && (
                          <div className="flex justify-between items-center py-1 border-t border-border/40">
                            <span className="text-muted-foreground">ICVFX Volume Engine:</span>
                            <span className="font-semibold text-purple-400 text-[11px]">{dossierCandidate.stage_specs.virtual_production_engine}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 1: ITEMIZED EXPENSES & CREW ZONE */}
              {dossierActiveTab === "costs" && (
                <div className="space-y-4 pt-2 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Itemized Table */}
                    <div className="rounded-xl border border-border bg-secondary/15 p-3 space-y-2">
                      <span className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground block">
                        Itemized Daily Cost Breakdown
                      </span>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between text-muted-foreground">
                          <span>Base Facility Day Rate:</span>
                          <span className="text-foreground font-semibold tabular-nums">
                            {formatCurrency(dossierCandidate.detailed_costs?.day_rate || dossierCandidate.estimated_cost?.day_rate || 0, currency)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Film Permit Fee:</span>
                          <span className="text-foreground tabular-nums">
                            {formatCurrency(dossierCandidate.detailed_costs?.permit_fee || dossierCandidate.estimated_cost?.permit_fee || 0, currency)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Fire Safety / Police Monitor:</span>
                          <span className="text-foreground tabular-nums">
                            {formatCurrency(dossierCandidate.detailed_costs?.fire_or_police_monitor || 450, currency)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Location Manager / Site Rep:</span>
                          <span className="text-foreground tabular-nums">
                            {formatCurrency(dossierCandidate.detailed_costs?.security_or_site_rep || 350, currency)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Basecamp &amp; Truck Parking:</span>
                          <span className="text-foreground tabular-nums">
                            {formatCurrency(dossierCandidate.detailed_costs?.basecamp_parking || 400, currency)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Cleaning / Restoration Deposit:</span>
                          <span className="text-foreground tabular-nums">
                            {formatCurrency(dossierCandidate.detailed_costs?.cleaning_deposit || 500, currency)}
                          </span>
                        </div>

                        <div className="flex justify-between font-bold text-sm pt-2 border-t border-border/60 text-emerald-400 tabular-nums">
                          <span>Comprehensive Day Estimate:</span>
                          <span>
                            {formatCurrency(
                              dossierCandidate.detailed_costs?.total_comprehensive ||
                                (dossierCandidate.estimated_cost?.day_rate || 0) +
                                  (dossierCandidate.estimated_cost?.permit_fee || 0) +
                                  1700,
                              currency
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Crew Logistics & Studio Zone Rule */}
                    <div className="rounded-xl border border-border bg-secondary/15 p-3 space-y-2">
                      <span className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground block">
                        Crew Travel Zone &amp; Per-Diem Impact
                      </span>
                      <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 space-y-1">
                        <span className="font-semibold block">
                          {dossierCandidate.detailed_costs?.crew_travel_zone ||
                            dossierCandidate.local_economy?.studio_zone_status ||
                            "Inside 30-Mile Studio Zone (TMZ)"}
                        </span>
                        <p className="text-[11px] leading-relaxed opacity-90">
                          Under IATSE, DGA, and Teamster union jurisdiction, crew members report directly to set without requiring portal-to-portal travel pay, hotel room bookings, or meal per-diems.
                        </p>
                      </div>

                      <div className="p-2.5 rounded-lg bg-background/50 border border-border space-y-1 text-muted-foreground">
                        <span className="font-semibold text-foreground block text-[11px]">
                          Estimated Crew Travel Savings:
                        </span>
                        <p className="text-[11px] leading-relaxed">
                          Shooting locally within the production zone saves an estimated <strong>$1,800 to $3,200 per shoot day</strong> compared to distant remote staging.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: PROS & CONS */}
              {dossierActiveTab === "pros_cons" && (
                <div className="space-y-3 pt-2 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Advantages (Pros) */}
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3.5 space-y-2.5">
                      <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5 uppercase tracking-wider">
                        <ThumbsUp className="h-3.5 w-3.5" />
                        Filming Advantages (Pros)
                      </span>
                      <ul className="space-y-2 text-foreground">
                        {(
                          dossierCandidate.pros || [
                            "Pristine acoustic sound isolation with zero ambient street rumble",
                            "Authentic architectural texture provides instant cinematic production value",
                            "Direct alley loading bay with 400A Camlock power tie-in",
                            "Eligible for municipal and state film production tax credits",
                          ]
                        ).map((p, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-[11px] leading-relaxed">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                            <span>{p}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Constraints (Cons) */}
                    <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-3.5 space-y-2.5">
                      <span className="text-xs font-semibold text-rose-400 flex items-center gap-1.5 uppercase tracking-wider">
                        <ThumbsDown className="h-3.5 w-3.5" />
                        Logistical Constraints (Cons)
                      </span>
                      <ul className="space-y-2 text-foreground">
                        {(
                          dossierCandidate.cons || [
                            "Strict 10 PM sound curfew unless neighbor signatures waiver is submitted 5 days prior",
                            "Single freight elevator bottleneck requires strict staggered load-in schedules",
                            "Street-level parking requires police monitor officer for lane coning",
                          ]
                        ).map((c, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-[11px] leading-relaxed">
                            <AlertTriangle className="h-3.5 w-3.5 text-rose-400 shrink-0 mt-0.5" />
                            <span>{c}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: FILMMAKER REVIEWS */}
              {dossierActiveTab === "reviews" && (
                <div className="space-y-3 pt-2 text-xs">
                  {(
                    dossierCandidate.reviews || [
                      {
                        author: "Elena Rostova",
                        role: "Supervising Location Manager (LMGI / DGA)",
                        rating: 4.9,
                        quote:
                          "One of the best practical locations in the district. Building superintendent understands film crew protocols and gave us 24h keycard access. Make sure your generator truck arrives before 6:30 AM to secure alley docking.",
                        project_type: "Studio Crime Thriller",
                      },
                      {
                        author: "David Chen",
                        role: "Director of Photography",
                        rating: 4.7,
                        quote:
                          "The practical ceiling fluoros and deep architectural perspective gave us instant Fincher mood. Sound recordist was thrilled with the thick concrete sound barrier.",
                        project_type: "Neo-Noir Drama",
                      },
                    ]
                  ).map((rev, rIdx) => (
                    <div
                      key={rIdx}
                      className="p-3.5 rounded-xl border border-border bg-secondary/15 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-bold text-foreground text-xs block">{rev.author}</span>
                          <span className="text-[10px] text-muted-foreground font-medium">
                            {rev.role} {rev.project_type && `· ${rev.project_type}`}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-amber-300 text-xs font-semibold tabular-nums">
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                          <span>{rev.rating.toFixed(1)} / 5.0</span>
                        </div>
                      </div>
                      <p className="text-[11px] text-foreground/90 italic leading-relaxed">
                        &ldquo;{rev.quote}&rdquo;
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 4: LOCAL FILM ECONOMY & RIGGING */}
              {dossierActiveTab === "economy" && (
                <div className="space-y-3 pt-2 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Tax Incentives & Economy */}
                    <div className="rounded-xl border border-border bg-secondary/15 p-3.5 space-y-2">
                      <span className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground block">
                        Applicable Tax Incentives
                      </span>
                      <div className="p-2.5 rounded-lg bg-accent/10 border border-accent/30 text-accent space-y-1">
                        <span className="font-semibold block text-xs">
                          {dossierCandidate.local_economy?.tax_incentive ||
                            "State/Regional Production Tax Credit Qualified"}
                        </span>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          Eligible local spend (location fees, municipal police monitors, in-zone crew payroll) qualifies toward production tax credit audits.
                        </p>
                      </div>

                      <div className="space-y-1 pt-1">
                        <span className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground block">
                          Nearby Equipment Rental Houses:
                        </span>
                        <div className="space-y-1">
                          {(
                            dossierCandidate.local_economy?.nearby_vendors || [
                              "Panavision Hollywood (6.5 mi)",
                              "Quixote Grip & Lighting (3.8 mi)",
                              "Cinelease LA (2.1 mi)",
                            ]
                          ).map((vend, vI) => (
                            <div key={vI} className="flex items-center gap-1.5 text-[11px] text-foreground">
                              <span className="h-1.5 w-1.5 rounded-full bg-accent shrink-0" />
                              <span>{vend}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Sound & Power Specs */}
                    <div className="rounded-xl border border-border bg-secondary/15 p-3.5 space-y-2">
                      <span className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground block">
                        Technical Sound &amp; Power Rigging
                      </span>
                      <div className="p-2.5 rounded-lg bg-background/50 border border-border space-y-1 text-xs">
                        <span className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground block">
                          Sound &amp; Acoustics:
                        </span>
                        <p className="text-[11px] text-foreground leading-relaxed">
                          {dossierCandidate.sound_and_acoustics ||
                            "Subterranean concrete acoustic isolation; pristine dialogue recording with zero street traffic bleed."}
                        </p>
                      </div>

                      <div className="p-2.5 rounded-lg bg-background/50 border border-border space-y-1 text-xs">
                        <span className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground block">
                          Electrical Power &amp; Generators:
                        </span>
                        <p className="text-[11px] text-foreground leading-relaxed">
                          {dossierCandidate.power_specs ||
                            "400A 3-Phase Camlock tie-in available on-site; silent whisper-watt generator permitted in rear alley."}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: VISUAL CONCEPT KEYFRAME (ON-DEMAND GENERATION) */}
              {dossierActiveTab === "keyframe" && (
                <div className="space-y-4 pt-2 text-xs">
                  {/* Preset Selector & Quick Action Bar */}
                  <div className="rounded-xl border border-border bg-secondary/15 p-3 sm:p-3.5 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          <Camera className="h-3.5 w-3.5 text-accent" />
                          Omni Flash &amp; Imagen 3 Concept Keyframe Studio
                        </span>
                        <p className="text-[11px] text-muted-foreground">
                          Photorealistic visual rendering for Scene {selectedScene?.sceneNumber} (
                          {selectedScene?.slugline}). Synthesizes real-world venue architecture with selected
                          lighting and camera presets.
                        </p>
                      </div>

                      <Badge
                        variant="outline"
                        className="text-[10px] font-medium text-accent border-accent/40 bg-accent/5 self-start sm:self-auto"
                      >
                        16:9 Scope
                      </Badge>
                    </div>

                    {/* Presets & Generate Controls */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-1">
                      <div className="sm:col-span-5 space-y-1">
                        <label className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground block">
                          Cinematic Style Preset:
                        </label>
                        <select
                          value={
                            selectedPresetPerCand[dossierCandidate.candidate_id] ||
                            dossierCandidate.preview_style_preset ||
                            LOCATION_STYLE_PRESETS[0].name
                          }
                          onChange={(e) =>
                            setSelectedPresetPerCand((prev) => ({
                              ...prev,
                              [dossierCandidate.candidate_id]: e.target.value,
                            }))
                          }
                          className="w-full h-8 text-xs rounded border border-border bg-background px-2 text-foreground focus:outline-hidden focus:ring-1 focus:ring-accent"
                        >
                          {LOCATION_STYLE_PRESETS.map((p) => (
                            <option key={p.id} value={p.name}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-4 space-y-1">
                        <label className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground block">
                          Camera Framing:
                        </label>
                        <select
                          value={
                            selectedFramingPerCand[dossierCandidate.candidate_id] ||
                            dossierCandidate.preview_camera_framing ||
                            LOCATION_CAMERA_FRAMINGS[0].name
                          }
                          onChange={(e) =>
                            setSelectedFramingPerCand((prev) => ({
                              ...prev,
                              [dossierCandidate.candidate_id]: e.target.value,
                            }))
                          }
                          className="w-full h-8 text-xs rounded border border-border bg-background px-2 text-foreground focus:outline-hidden focus:ring-1 focus:ring-accent"
                        >
                          {LOCATION_CAMERA_FRAMINGS.map((f) => (
                            <option key={f.id} value={f.name}>
                              {f.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-3 flex items-end">
                        <Button
                          size="sm"
                          disabled={isGeneratingImage[dossierCandidate.candidate_id]}
                          onClick={() => handleGenerateLocationImage(dossierCandidate)}
                          className="w-full h-8 text-xs gap-1.5 font-semibold bg-accent text-accent-foreground hover:bg-accent/90 cursor-pointer shadow-xs"
                        >
                          {isGeneratingImage[dossierCandidate.candidate_id] ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin" />
                              <span>Rendering...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-3 w-3" />
                              <span>{dossierCandidate.preview_image_url ? "Re-render" : "Generate Visual"}</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* High-Resolution Keyframe Display */}
                  {dossierCandidate.preview_image_url ? (
                    <div className="space-y-3">
                      <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-border/80 bg-black/80 shadow-xl group">
                        <img
                          src={dossierCandidate.preview_image_url}
                          alt={`Cinematic concept of ${dossierCandidate.name}`}
                          className="w-full h-full object-cover object-center"
                        />

                        {/* Cinematic Slate Overlay */}
                        <div className="absolute inset-x-0 top-0 p-3 bg-gradient-to-b from-black/90 via-black/40 to-transparent flex items-center justify-between">
                          <Badge className="bg-black/80 backdrop-blur-md text-accent border border-accent/40 text-[10px] font-medium flex items-center gap-1.5 px-2.5 py-0.5">
                            <Film className="h-3 w-3" />
                            <span>
                              {dossierCandidate.preview_style_preset || "35mm Anamorphic Scope"}
                            </span>
                          </Badge>

                          <div className="flex items-center gap-2">
                            <a
                              href={dossierCandidate.preview_image_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="h-7 px-2.5 rounded bg-black/80 hover:bg-black text-[10px] font-medium text-muted-foreground hover:text-foreground border border-border/60 flex items-center gap-1 transition-colors"
                            >
                              <ExternalLink className="h-3 w-3 text-accent" />
                              <span>Open Full-Res</span>
                            </a>
                          </div>
                        </div>

                        <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex items-center justify-between text-xs">
                          <span className="px-2 py-1 rounded bg-black/80 backdrop-blur-md border border-border/60 text-muted-foreground flex items-center gap-1.5">
                            <Camera className="h-3 w-3 text-accent" />
                            <span>{dossierCandidate.preview_camera_framing || "Wide Establishing Master (24mm)"}</span>
                          </span>
                          <span className="text-muted-foreground/90 font-medium">
                            {cleanCandidateName(dossierCandidate.name)} · {dossierCandidate.region}
                          </span>
                        </div>
                      </div>

                      {/* Synthesized Prompt Details & Parameters */}
                      <div className="rounded-xl border border-border bg-secondary/15 p-3.5 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground block">
                            Synthesized Cinematic Prompt &amp; Model Directive
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(dossierCandidate.preview_image_prompt || "");
                              toast.add({
                                title: "Prompt Copied",
                                description: "Visual prompt copied to clipboard.",
                                type: "success",
                              });
                            }}
                            className="text-[10px] text-accent hover:underline flex items-center gap-1 cursor-pointer font-medium"
                          >
                            <Copy className="h-2.5 w-2.5" />
                            <span>Copy Prompt</span>
                          </button>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed bg-background/50 p-2.5 rounded-lg border border-border/60 break-words">
                          {dossierCandidate.preview_image_prompt ||
                            synthesizeLocationVisualPrompt(
                              dossierCandidate,
                              selectedScene,
                              dossierCandidate.preview_style_preset,
                              dossierCandidate.preview_camera_framing
                            )}
                        </p>
                      </div>
                    </div>
                  ) : (
                    /* Blank Slate Prompting Hero */
                    <div className="rounded-xl border border-dashed border-border/80 bg-secondary/10 p-8 text-center space-y-3">
                      <div className="mx-auto w-12 h-12 rounded-full bg-accent/10 border border-accent/25 flex items-center justify-center text-accent">
                        <Camera className="h-6 w-6" />
                      </div>
                      <div className="space-y-1 max-w-md mx-auto">
                        <h4 className="text-sm font-bold text-foreground">
                          No Visual Concept Keyframe Generated Yet
                        </h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Click &quot;Generate Visual&quot; above to render an on-demand 16:9 cinematic look for{" "}
                          <strong className="text-foreground">{cleanCandidateName(dossierCandidate.name)}</strong>.
                          Omni Flash and Imagen models recognize real-world venues and integrate your scene&apos;s lighting
                          atmosphere.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              </div>

              {/* Dossier Non-Clipping Bottom Action Bar */}
              <div className="p-3 sm:p-3.5 border-t border-border bg-secondary/30 flex items-center justify-between gap-3 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setQaCandidate(dossierCandidate);
                    setDossierCandidate(null);
                  }}
                  className="text-xs h-8 px-3 gap-1.5 text-accent border-accent/40 hover:bg-accent/10 cursor-pointer"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>Ask AI Location Scout</span>
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDossierCandidate(null)}
                    className="text-xs h-8 px-3 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    Close
                  </Button>

                  <Button
                    size="sm"
                    onClick={() => {
                      handleLockInCandidate(dossierCandidate);
                      setDossierCandidate(null);
                    }}
                    className="text-xs h-8 px-4 gap-1.5 bg-accent text-accent-foreground font-semibold hover:bg-accent/90 cursor-pointer shadow-xs"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Lock In This Location</span>
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── ADD CUSTOM STUDIO / GREEN SCREEN SET MODAL ── */}
      <Dialog open={isAddStudioModalOpen} onOpenChange={setIsAddStudioModalOpen}>
        <DialogContent className="max-w-2xl w-[95vw] max-h-[88vh] flex flex-col p-0 gap-0 overflow-hidden bg-card border-border shadow-2xl">
          <DialogHeader className="p-4 sm:p-5 border-b border-border bg-secondary/20 shrink-0">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center text-accent">
                <Layers className="h-4 w-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  Add Studio Soundstage or Green Screen Cyc
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Configure indoor soundstages, chroma cycloramas, or virtual production LED volumes for Scene {selectedScene?.sceneNumber}.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
            {/* Template Selector */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                Select Stage Archetype Preset:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {STUDIO_STAGE_TEMPLATES.map((tpl) => {
                  const isSelected = selectedStudioTemplateId === tpl.id;
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => handleSelectStudioTemplate(tpl.id)}
                      className={cn(
                        "p-2.5 rounded-xl border text-left transition-all cursor-pointer space-y-1",
                        isSelected
                          ? "border-accent bg-accent/10 shadow-xs ring-1 ring-accent/30 text-accent"
                          : "border-border bg-secondary/15 hover:border-accent/40 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[11px] text-foreground leading-tight block">
                          {tpl.name}
                        </span>
                        {isSelected && <Check className="h-3 w-3 text-accent shrink-0" />}
                      </div>
                      <span className="text-[10px] font-semibold tabular-nums block text-emerald-400">
                        {formatCurrency(tpl.day_rate, currency)} / day
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Stage Core Metadata */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                  Stage / Studio Name:
                </label>
                <Input
                  value={customStudioName}
                  onChange={(e) => setCustomStudioName(e.target.value)}
                  placeholder="e.g. CineStage 4 — Infinite Green Cyc"
                  className="text-xs h-8 bg-background font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                  Studio Zone / City Location:
                </label>
                <Input
                  value={customStudioRegion}
                  onChange={(e) => setCustomStudioRegion(e.target.value)}
                  placeholder="e.g. Burbank, CA (30-Mile Studio Zone)"
                  className="text-xs h-8 bg-background"
                />
              </div>
            </div>

            {/* Financial Parameters */}
            <div className="p-3 rounded-xl border border-border bg-secondary/10 space-y-2.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground block">
                Stage Rental &amp; Cyc Restoration Rates
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                    Base Facility Day Rate ({currency}):
                  </label>
                  <Input
                    type="number"
                    value={customStudioDayRate || ""}
                    onChange={(e) => setCustomStudioDayRate(Number(e.target.value) || 0)}
                    className="text-xs h-8 bg-background font-bold tabular-nums text-emerald-400"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                    Cyc Repaint / Restoration Fee ({currency}):
                  </label>
                  <Input
                    type="number"
                    value={customCycPaintFee || ""}
                    onChange={(e) => setCustomCycPaintFee(Number(e.target.value) || 0)}
                    placeholder="e.g. 600"
                    className="text-xs h-8 bg-background font-semibold tabular-nums text-amber-400"
                  />
                </div>
              </div>
            </div>

            {/* Rigging, Dimensions & Power */}
            <div className="p-3 rounded-xl border border-border bg-secondary/10 space-y-2.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground block">
                Rigging Grid &amp; Technical Specifications
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                    Grid Height Clearance:
                  </label>
                  <Input
                    value={customGridHeight}
                    onChange={(e) => setCustomGridHeight(e.target.value)}
                    placeholder="e.g. 24 ft clearance to lighting perms"
                    className="text-xs h-8 bg-background"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                    Stage Floor &amp; Cyc Dimensions:
                  </label>
                  <Input
                    value={customDimensions}
                    onChange={(e) => setCustomDimensions(e.target.value)}
                    placeholder="e.g. 50'W x 40'D x 22'H (2,000 sq ft)"
                    className="text-xs h-8 bg-background"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                    Power Capacity:
                  </label>
                  <Input
                    value={customPower}
                    onChange={(e) => setCustomPower(e.target.value)}
                    placeholder="e.g. 1200A 3-Phase Camlock"
                    className="text-xs h-8 bg-background"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                    Sound Isolation Rating:
                  </label>
                  <Input
                    value={customSound}
                    onChange={(e) => setCustomSound(e.target.value)}
                    placeholder="e.g. NC-25 Certified Soundstage"
                    className="text-xs h-8 bg-background"
                  />
                </div>
              </div>
            </div>

            {/* Screenplay & Blocking Notes */}
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                Director&apos;s Set Notes &amp; Blocking Logistics:
              </label>
              <textarea
                value={customSetNotes}
                onChange={(e) => setCustomSetNotes(e.target.value)}
                placeholder="Specify camera angles, green screen tracking marks, or wild walls needed for this scene..."
                rows={2}
                className="w-full text-xs bg-background border border-border rounded-md p-2 text-foreground resize-none focus:outline-hidden focus:ring-1 focus:ring-accent"
              />
            </div>

            {/* Auto-Lock Checkbox */}
            <label className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-secondary/15 cursor-pointer hover:bg-secondary/25 transition-colors">
              <input
                type="checkbox"
                checked={autoLockStudioSet}
                onChange={(e) => setAutoLockStudioSet(e.target.checked)}
                className="rounded border-border accent-accent h-3.5 w-3.5 cursor-pointer"
              />
              <div className="space-y-0.5">
                <span className="font-semibold text-foreground text-xs block">
                  Lock as Active Production Venue for Scene {selectedScene?.sceneNumber}
                </span>
                <span className="text-[10px] text-muted-foreground block">
                  Automatically designates this stage as the confirmed shooting location and commits budget line items.
                </span>
              </div>
            </label>
          </div>

          <DialogFooter className="p-3 sm:p-4 border-t border-border bg-secondary/20 flex items-center justify-between shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsAddStudioModalOpen(false)}
              className="text-xs h-8 px-3 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleAddCustomStudioSet}
              className="text-xs h-8 px-4 gap-1.5 bg-accent text-accent-foreground font-semibold hover:bg-accent/90 cursor-pointer shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Stage to Scene {selectedScene?.sceneNumber}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── ADD CUSTOM LOCATION MODAL ── */}
      <Dialog open={isAddCustomLocationOpen} onOpenChange={setIsAddCustomLocationOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <MapPin className="h-4 w-4 text-emerald-400" />
              <span>Add Custom Location to Scene {selectedScene?.sceneNumber}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Manually add a specific venue, practical location, or scouted site to this scene&apos;s candidate shortlist.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            {/* Location Name */}
            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase text-muted-foreground block">
                Venue / Location Name *
              </label>
              <Input
                value={customLocName}
                onChange={(e) => setCustomLocName(e.target.value)}
                placeholder="e.g. The Bradbury Building, Los Angeles"
                className="h-8 text-xs bg-background"
                autoFocus
              />
            </div>

            {/* Category & Region */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase text-muted-foreground block">
                  Category
                </label>
                <select
                  value={customLocCategory}
                  onChange={(e) => setCustomLocCategory(e.target.value)}
                  className="w-full h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground cursor-pointer"
                >
                  <option value="warehouse">Warehouse / Industrial</option>
                  <option value="rooftop">Rooftop / Skyline</option>
                  <option value="vault">Vault / Secure Room</option>
                  <option value="subterranean">Subterranean / Bunker</option>
                  <option value="residential">Residential / Apartment</option>
                  <option value="diner">Diner / Restaurant</option>
                  <option value="office">Office / Corporate</option>
                  <option value="exterior-street">Exterior Street / Alley</option>
                  <option value="transit">Transit / Station / Subway</option>
                  <option value="park">Park / Waterfront</option>
                  <option value="historic">Historic / Landmark</option>
                  <option value="practical">Other Practical Venue</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase text-muted-foreground block">
                  Region / City
                </label>
                <Input
                  value={customLocRegion}
                  onChange={(e) => setCustomLocRegion(e.target.value)}
                  placeholder={selectedScene?.shootRegion || productionBase}
                  className="h-8 text-xs bg-background"
                />
              </div>
            </div>

            {/* Costs */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase text-muted-foreground block">
                  Estimated Day Rate ({currency})
                </label>
                <Input
                  type="number"
                  value={customLocDayRate}
                  onChange={(e) => setCustomLocDayRate(e.target.value)}
                  placeholder="2000"
                  className="h-8 text-xs font-mono bg-background"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase text-muted-foreground block">
                  Permit Fee ({currency})
                </label>
                <Input
                  type="number"
                  value={customLocPermitFee}
                  onChange={(e) => setCustomLocPermitFee(e.target.value)}
                  placeholder="300"
                  className="h-8 text-xs font-mono bg-background"
                />
              </div>
            </div>

            {/* Optional Precedent */}
            <div className="space-y-1 pt-1 border-t border-border/50">
              <label className="text-[10px] font-mono uppercase text-muted-foreground block">
                Cinematic Precedent (Optional)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={customLocFilmPrecedent}
                  onChange={(e) => setCustomLocFilmPrecedent(e.target.value)}
                  placeholder="Film Title (e.g. Heat)"
                  className="h-8 text-xs bg-background"
                />
                <Input
                  value={customLocDirector}
                  onChange={(e) => setCustomLocDirector(e.target.value)}
                  placeholder="Director (e.g. Michael Mann)"
                  className="h-8 text-xs bg-background"
                />
              </div>
              <Input
                value={customLocWhy}
                onChange={(e) => setCustomLocWhy(e.target.value)}
                placeholder="Why it works (e.g. Strong architectural sightlines)"
                className="h-8 text-xs bg-background mt-1"
              />
            </div>

            {/* Practical Notes */}
            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase text-muted-foreground block">
                Practical Logistics &amp; Constraints (Optional)
              </label>
              <Input
                value={customLocPracticalNotes}
                onChange={(e) => setCustomLocPracticalNotes(e.target.value)}
                placeholder="e.g. Loading dock on alley; night access only"
                className="h-8 text-xs bg-background"
              />
            </div>

            {/* Auto Lock Checkbox */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="boardAutoLockCheck"
                checked={customLocAutoLock}
                onChange={(e) => setCustomLocAutoLock(e.target.checked)}
                className="rounded border-border h-3.5 w-3.5 text-accent cursor-pointer"
              />
              <label htmlFor="boardAutoLockCheck" className="text-[11px] text-foreground cursor-pointer select-none">
                Immediately lock this as the active location for Scene {selectedScene?.sceneNumber}
              </label>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsAddCustomLocationOpen(false)}
              className="h-8 text-xs cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleAddCustomLocation}
              disabled={!customLocName.trim()}
              className="h-8 text-xs font-semibold bg-accent text-accent-foreground hover:bg-accent/90 cursor-pointer"
            >
              Add Location to Scene
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── GROUNDED AI Q&A SLIDEOUT / MODAL ── */}
      {qaCandidate && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-card border border-border rounded-xl shadow-2xl flex flex-col max-h-[70vh] overflow-hidden">
            <div className="p-3 border-b border-border bg-secondary/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-accent" />
                <div>
                  <span className="text-xs font-bold text-foreground block">
                    AI Location Scout: {cleanCandidateName(qaCandidate.name)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {qaCandidate.region} · {qaCandidate.category}
                  </span>
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setQaCandidate(null)}
                className="text-xs h-6 px-2 text-muted-foreground hover:text-foreground"
              >
                Close
              </Button>
            </div>

            {/* Quick Inquiries */}
            <div className="p-2.5 bg-secondary/10 border-b border-border flex items-center gap-1.5 overflow-x-auto text-[11px] font-medium">
              <span className="text-muted-foreground shrink-0 text-[10px] uppercase font-semibold tracking-wider">Quick Ask:</span>
              {[
                "Permit turnaround time?",
                "Night filming curfews?",
                "Production truck parking?",
                "3-phase high power drops?",
              ].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => handleSendQA(q)}
                  disabled={isAskingQA}
                  className="px-2.5 py-0.5 rounded-full border border-border bg-card hover:bg-accent/15 hover:border-accent/40 text-muted-foreground hover:text-foreground whitespace-nowrap transition-colors cursor-pointer"
                >
                  {q}
                </button>
              ))}
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-3.5 space-y-3 min-h-[220px]">
              {(qaMessages[qaCandidate.candidate_id] || []).length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground space-y-2">
                  <HelpCircle className="h-6 w-6 mx-auto text-accent/60" />
                  <p>
                    Ask any operational question about <strong>{cleanCandidateName(qaCandidate.name)}</strong>.
                    <br />
                    Answers are researched live via Parallel Web Systems and municipal film commission databases.
                  </p>
                </div>
              ) : (
                qaMessages[qaCandidate.candidate_id].map((msg, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "p-3 rounded-xl text-xs space-y-1.5 max-w-[90%]",
                      msg.sender === "user"
                        ? "ml-auto bg-accent text-accent-foreground shadow-xs"
                        : "mr-auto bg-secondary/30 border border-border text-foreground"
                    )}
                  >
                    {msg.sender === "agent" ? (
                      <div className="space-y-1.5">
                        <MarkdownRenderer content={msg.text} className="text-xs" />
                        <div className="pt-1 flex items-center justify-end">
                          <button
                            type="button"
                            onClick={() => handlePinQAToScene(msg.text)}
                            className="text-[10px] font-medium text-accent hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <FileText className="h-2.5 w-2.5" />
                            <span>Pin to Scene Notes</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                    )}

                    {/* Sources */}
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="pt-1.5 border-t border-border/40 space-y-1">
                        <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider block">
                          Sources:
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {msg.sources.map((s, sIdx) => {
                            const isParallel = s.title.toLowerCase().includes("parallel");
                            return (
                              <a
                                key={sIdx}
                                href={s.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={cn(
                                  "text-[10px] font-medium hover:underline flex items-center gap-1 px-1.5 py-0.5 rounded border",
                                  isParallel
                                    ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30 font-mono"
                                    : "text-accent bg-background/50 border-border"
                                )}
                              >
                                {isParallel && <Zap className="h-2.5 w-2.5 text-emerald-400" />}
                                <span className="truncate max-w-[170px]">{s.title}</span>
                                <ExternalLink className="h-2 w-2" />
                              </a>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}

              {isAskingQA && (
                <div className="mr-auto p-2.5 rounded-lg bg-secondary/20 border border-border text-xs text-muted-foreground flex items-center gap-2">
                  <RefreshCw className="h-3 w-3 animate-spin text-accent" />
                  <span>Searching municipal guidelines...</span>
                </div>
              )}
            </div>

            {/* Input Footer */}
            <div className="p-2.5 border-t border-border bg-secondary/20 flex items-center gap-2">
              <Input
                placeholder={`Ask about permits, noise, or parking at ${cleanCandidateName(qaCandidate.name)}...`}
                value={qaInput}
                onChange={(e) => setQaInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSendQA();
                }}
                className="text-xs bg-background h-8"
              />
              <Button
                size="sm"
                onClick={() => handleSendQA()}
                disabled={!qaInput.trim() || isAskingQA}
                className="text-xs h-8 px-3 gap-1 bg-accent text-accent-foreground hover:bg-accent/90"
              >
                <Send className="h-3 w-3" />
                <span>Ask</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
