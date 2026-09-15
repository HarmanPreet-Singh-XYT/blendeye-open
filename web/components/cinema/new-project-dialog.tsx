"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SlateLabel } from "@/components/cinema/slate-label";
import {
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Plus,
  Trash2,
  Check,
  Clapperboard,
  Lock,
  Zap,
  Sliders,
  Users,
  Compass,
  Film,
  Globe2,
  Eye,
  UserCheck,
  RefreshCw,
  Shirt,
  Clock,
  Timer,
  Milestone,
  DollarSign,
  ShieldAlert,
  Navigation,
} from "lucide-react";
import {
  type ProjectCharacter,
  type NarrativeFormat,
  type GenreOption,
  type SupportedCurrency,
  type BudgetCapPolicy,
  type ProjectBudgetAllocation,
  GENRE_OPTIONS,
  synthesizeDynamicCharacters,
  NARRATIVE_FORMATS,
  CURRENCY_SYMBOLS,
  formatCurrency,
} from "@/lib/project-store";
import { useAuth } from "@/lib/auth-context";
import { toast } from "@/components/ui/toast";
import { notifyIfFallback } from "@/lib/fallback-notice";

export interface NewProjectFormData {
  title: string;
  logline: string;
  genre: string;
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

interface NewProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: NewProjectFormData) => void;
  isSubmitting?: boolean;
}

const GENRE_CATEGORIES = [
  { id: "all", label: "All Genres" },
  { id: "thriller", label: "Thriller" },
  { id: "scifi", label: "Sci-Fi" },
  { id: "noir", label: "Noir & Mystery" },
  { id: "horror", label: "Horror & Occult" },
  { id: "action", label: "Action & Survival" },
  { id: "drama", label: "Drama & Western" },
  { id: "epic", label: "Mythic & Epic" },
] as const;

const CUSTOM_GENRE_PRESETS = [
  "Afrofuturist Cyber-Western",
  "Samurai Gothic Noir",
  "Supernatural Heist",
  "Cosmic Folk Horror",
  "Erotic Legal Thriller",
  "Biopunk Corporate Espionage",
  "Solarpunk Utopian Mystery",
  "Dark Fantasy Siege",
];

const DIRECTOR_STYLES = [
  { id: "Denis Villeneuve", style: "Brutalist scale, atmospheric sound design, deliberate slow-burn spatial geometry" },
  { id: "David Fincher", style: "Meticulous procedural rhythm, low-key amber/green chiaroscuro, relentless technical precision" },
  { id: "Christopher Nolan", style: "Non-linear chronological cross-cutting, practical scale, escalating tension" },
  { id: "Michael Mann", style: "Neo-noir sodium vapor & wet reflections, hyper-tactical realism, telephoto lens compression" },
  { id: "Bong Joon-ho", style: "Social status friction, sudden violent tonal turns, intense claustrophobic framing" },
  { id: "Greta Gerwig", style: "High-density conversational cadence, vivid emotional realism, razor-sharp status wit" },
];

const TARGET_TERRITORIES = [
  { code: "US", name: "North America", note: "Pacing & 3-Act Structure Focus", icon: "🇺🇸" },
  { code: "IN", name: "India", note: "Emotional Stakes, Music & Family Dynamics", icon: "🇮🇳" },
  { code: "KR", name: "South Korea", note: "Moral Ambiguity & Psychological Twists", icon: "🇰🇷" },
  { code: "DE", name: "Western Europe", note: "Procedural Realism & Authentic Logic", icon: "🇩🇪" },
  { code: "BR", name: "Latin America", note: "Ensemble Chemistry & High Energy", icon: "🇧🇷" },
  { code: "JP", name: "Japan", note: "Atmospheric Subtlety & Tension Control", icon: "🇯🇵" },
];

const ARCHETYPE_PRESETS = [
  { name: "70% Landa + 30% Kendall", conf: 95, spd: 35, sub: "extreme" },
  { name: "Rust Cohle Truth-Teller", conf: 50, spd: 70, sub: "high" },
  { name: "Hyper-Literal Soldier", conf: 90, spd: 40, sub: "low" },
  { name: "Charming Fixer", conf: 85, spd: 65, sub: "high" },
];

const FORMAT_OPTIONS: Array<{
  id: NarrativeFormat;
  label: string;
  minutes: number;
  badge: string;
  scenes: number;
  description: string;
  icon: string;
}> = [
  {
    id: "feature",
    label: "Feature Film",
    minutes: 105,
    badge: "105 min",
    scenes: 24,
    description: "3-Act cinematic feature with midpoint reversal & climax",
    icon: "🎬",
  },
  {
    id: "pilot",
    label: "TV Pilot",
    minutes: 52,
    badge: "52 min",
    scenes: 14,
    description: "Serialized episodic pilot with cliffhangers & multiple arcs",
    icon: "📺",
  },
  {
    id: "short",
    label: "Festival Short",
    minutes: 18,
    badge: "18 min",
    scenes: 6,
    description: "Compressed festival narrative with high emotional momentum",
    icon: "🎞️",
  },
  {
    id: "teaser",
    label: "PoC Teaser",
    minutes: 3,
    badge: "3 min",
    scenes: 2,
    description: "Ultra-condensed proof-of-concept scene & visual hook",
    icon: "⚡",
  },
  {
    id: "series",
    label: "Limited Series",
    minutes: 65,
    badge: "65 min",
    scenes: 18,
    description: "Prestige prestige drama chapter with ensemble architecture",
    icon: "📽️",
  },
  {
    id: "custom",
    label: "Custom Scope",
    minutes: 45,
    badge: "Custom",
    scenes: 12,
    description: "Freeform experimental runtime tailored precisely to your story",
    icon: "⚙️",
  },
];

const SCENE_ANCHORS = [
  { id: "opening", label: "Act I Hook", pct: 0.05, desc: "Status quo & inciting incident" },
  { id: "act1_break", label: "Act I Break", pct: 0.25, desc: "Locks into journey" },
  { id: "midpoint", label: "Midpoint", pct: 0.50, desc: "Central confrontation / reversal" },
  { id: "act3_climax", label: "Climax Standoff", pct: 0.80, desc: "Final third-act crisis" },
];

function formatTimecode(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) {
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function NewProjectDialog({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting = false,
}: NewProjectDialogProps) {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = React.useState<1 | 2 | 3 | 4 | 5>(1);

  // Step 1: Foundation & Timeframe Scope
  const [title, setTitle] = React.useState("");
  const [logline, setLogline] = React.useState("");
  const [genre, setGenre] = React.useState(GENRE_OPTIONS[0].id);
  const [genreCategory, setGenreCategory] = React.useState<string>("all");
  const [isCustomGenre, setIsCustomGenre] = React.useState<boolean>(false);
  const [customGenre, setCustomGenre] = React.useState<string>("");

  const effectiveGenre = isCustomGenre && customGenre.trim() ? customGenre.trim() : genre;

  const filteredGenres = React.useMemo(() => {
    if (genreCategory === "all") return GENRE_OPTIONS;
    return GENRE_OPTIONS.filter((g) => g.category === genreCategory);
  }, [genreCategory]);

  const [directorStyle, setDirectorStyle] = React.useState(DIRECTOR_STYLES[0].id);
  const [narrativeFormat, setNarrativeFormat] = React.useState<NarrativeFormat>("feature");
  const [targetRuntimeMinutes, setTargetRuntimeMinutes] = React.useState<number>(95);
  const [scenePlacementSeconds, setScenePlacementSeconds] = React.useState<number>(34 * 60);
  const [sceneDurationSeconds, setSceneDurationSeconds] = React.useState<number>(6 * 60);

  const handleSelectFormat = (fmt: NarrativeFormat) => {
    setNarrativeFormat(fmt);
    const cfg = NARRATIVE_FORMATS[fmt];
    const defaultMins = cfg?.defaultMinutes || 95;
    setTargetRuntimeMinutes(defaultMins);
    // Pinpoint scene at ~35% into the story
    setScenePlacementSeconds(Math.round(defaultMins * 60 * 0.35));
  };

  const handleAdjustRuntime = (deltaMinutes: number) => {
    setTargetRuntimeMinutes((prev) => {
      const next = Math.max(2, Math.min(240, prev + deltaMinutes));
      if (scenePlacementSeconds > next * 60) {
        setScenePlacementSeconds(Math.max(0, next * 60 - sceneDurationSeconds));
      }
      return next;
    });
  };

  // Step 2: Characters
  const [charactersList, setCharactersList] = React.useState<ProjectCharacter[]>([
    {
      name: "Marcus",
      role: "Lead Protagonist",
      archetype: "Desperate specialist racing against a closing escape window",
      actorComp: "Jake Gyllenhaal (Nightcrawler / Prisoners)",
      speechStyle: "Breathless, guarded, hyper-observant",
      subtextRatio: "high",
      confidence: 75,
      verbalPacing: 70,
      objective: "Retrieve the bypass keys before the alarm cycles",
      quirks: ["Compulsively checks pocket watch", "Scans security cameras"],
    },
    {
      name: "Elena",
      role: "Strategic Foil / Counterpart",
      archetype: "Mastermind concealing a clandestine syndicate contract",
      actorComp: "Florence Pugh (Lady Macbeth)",
      speechStyle: "Chillingly measured, quiet, evasive",
      subtextRatio: "extreme",
      confidence: 95,
      verbalPacing: 45,
      objective: "Hold the room in place until extraction arrives",
      quirks: ["Unblinking eye contact", "Maintains whisper-quiet posture"],
    },
  ]);

  const [selectedCharIdx, setSelectedCharIdx] = React.useState(0);

  // Step 3: Dramatic Tension & Secret
  const [primaryLocation, setPrimaryLocation] = React.useState(
    "Underground reinforced bank vault sub-level under emergency lighting"
  );
  const [coreSecret, setCoreSecret] = React.useState(
    "Elena swapped the physical security keys 10 minutes ago and is executing an unsanctioned secondary syndicate extraction."
  );
  const [shootRegion, setShootRegion] = React.useState("Los Angeles, CA");
  const [currency, setCurrency] = React.useState<SupportedCurrency>("USD");
  const [budget, setBudget] = React.useState<number>(850_000);
  const [budgetPerShootDay, setBudgetPerShootDay] = React.useState<number>(85_000);
  const [locationsPct, setLocationsPct] = React.useState<number>(15);
  const [budgetCapPolicy, setBudgetCapPolicy] = React.useState<BudgetCapPolicy>("advisory");

  // Step 4: Audience & Distribution
  const [selectedTerritories, setSelectedTerritories] = React.useState<string[]>([
    "US",
    "IN",
    "KR",
  ]);

  // Reset or load initial values on open
  React.useEffect(() => {
    if (open) {
      setCurrentStep(1);
      setSelectedCharIdx(0);
    }
  }, [open]);

  const activeChar = charactersList[selectedCharIdx] || charactersList[0];

  const handleUpdateActiveChar = (partial: Partial<ProjectCharacter>) => {
    setCharactersList((prev) => {
      const next = [...prev];
      if (next[selectedCharIdx]) {
        next[selectedCharIdx] = { ...next[selectedCharIdx], ...partial };
      }
      return next;
    });
  };

  const [isGeneratingVisual, setIsGeneratingVisual] = React.useState(false);
  const [isMatchingGenre, setIsMatchingGenre] = React.useState(false);

  const handleGenerateCharacterVisual = async () => {
    if (!activeChar || isGeneratingVisual) return;
    setIsGeneratingVisual(true);
    try {
      const facePrompt = `Cinematic 85mm character portrait close-up headshot of ${activeChar.name}. ${
        activeChar.visualDescription || activeChar.archetype
      }. 35mm anamorphic film still, dramatic chiaroscuro rim lighting, sharp bone structure, photorealistic.`;

      const res = await fetch("/api/media/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: facePrompt, aspect_ratio: "1:1" }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.image_url) {
          handleUpdateActiveChar({
            imageUrl: data.image_url,
            fullBodyImageUrl: data.image_url, // provides a visual reference for both
          });
        }
      }
    } catch (err) {
      console.error("Visual generation error:", err);
    } finally {
      setIsGeneratingVisual(false);
    }
  };

  const handleAddCharacter = () => {
    const newChar: ProjectCharacter = {
      name: `Character ${charactersList.length + 1}`,
      role: "Key Counterpart",
      archetype: "Complex dramatic operator with private motivations",
      actorComp: "Talent Comp",
      speechStyle: "Naturalistic, situational cadence",
      subtextRatio: "high",
      confidence: 80,
      verbalPacing: 65,
      objective: "Navigate the escalating crisis without exposure",
      quirks: ["Observant stance"],
    };
    const next = [...charactersList, newChar];
    setCharactersList(next);
    setSelectedCharIdx(next.length - 1);
  };

  const handleRemoveCharacter = (idx: number) => {
    if (charactersList.length <= 2) return;
    const next = charactersList.filter((_, i) => i !== idx);
    setCharactersList(next);
    setSelectedCharIdx(0);
  };

  const handleToggleTerritory = (code: string) => {
    setSelectedTerritories((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const handleFinalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !logline.trim() || isSubmitting) return;

    const totalBudget = Number(budget) || 850_000;
    const locPct = Number(locationsPct) || 15;
    const locAmount = Math.round(totalBudget * (locPct / 100));

    onSubmit({
      title: title.trim(),
      logline: logline.trim(),
      genre: effectiveGenre,
      directorStyle,
      coreSecret,
      primaryLocation,
      shootRegion: shootRegion.trim() || "Los Angeles, CA",
      currency,
      budget: totalBudget,
      budgetPerShootDayUsd: Number(budgetPerShootDay) || 85_000,
      budgetAllocation: {
        locationsPct: locPct,
        locationsAmount: locAmount,
      },
      budgetCapPolicy,
      targetTerritories: selectedTerritories,
      customCharacters: charactersList,
      characters: charactersList.map((c) => `${c.name} (${c.role || c.archetype})`).join(", "),
      narrativeFormat,
      targetRuntimeMinutes,
      scenePlacementSeconds,
      sceneDurationSeconds,
      totalScenesEstimate: NARRATIVE_FORMATS[narrativeFormat]?.typicalScenes || 24,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isSubmitting) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-5xl w-[94vw] h-[88vh] max-h-[90vh] bg-[#0c0d12] border-border/80 p-0 overflow-hidden shadow-2xl flex flex-col rounded-2xl sm:rounded-3xl">
        {/* Full-screen loading overlay when autonomous showrunner is architecting sequence */}
        {isSubmitting && (
          <div className="absolute inset-0 z-50 bg-background/90 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center animate-in fade-in-0 duration-200">
            <div className="relative mb-6">
              <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-xl shadow-emerald-500/10">
                <RefreshCw className="h-8 w-8 animate-spin" />
              </div>
              <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-accent flex items-center justify-center text-accent-foreground shadow-md">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
            </div>
            <h3 className="text-xl font-heading font-bold text-foreground mb-2">
              Architecting Production Slate
            </h3>
            <p className="text-sm text-muted-foreground max-w-md leading-relaxed font-sans mb-4">
              Autonomous Showrunner AI is generating multi-scene sequence reel, cast psychological profiles, and dramatic story beats...
            </p>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border/60 bg-secondary/30 text-[11px] font-mono text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Gemini 3.7 Flash · Showrunner Engine Active</span>
            </div>
          </div>
        )}
        {/* Header with Step Wizard Indicator */}
        <div className="border-b border-border/70 bg-[#10121a] p-6 pb-4 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 border border-accent/30 text-accent shadow-xs">
                <Clapperboard className="h-4 w-4" />
              </div>
              <div className="flex flex-col">
                <SlateLabel>Studio Greenlight Command Center · Production Setup</SlateLabel>
                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                  Step {currentStep} of 5 · Feature Film Induction
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {user ? (
                <Badge variant="outline" className="font-mono text-[10px] text-emerald-400 border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 hidden sm:inline-flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {user.email}
                </Badge>
              ) : (
                <Badge variant="outline" className="font-mono text-[10px] text-amber-300 border-amber-500/30 bg-amber-500/10 px-2 py-0.5 hidden sm:inline-flex items-center gap-1">
                  Not signed in
                </Badge>
              )}
              <Badge variant="outline" className="font-mono text-[11px] text-accent border-accent/30 px-2 py-0.5">
                {currentStep === 1 && "Phase 1: Concept & Tone"}
                {currentStep === 2 && "Phase 2: Character Lab"}
                {currentStep === 3 && "Phase 3: Asymmetric Secret"}
                {currentStep === 4 && "Phase 4: Global Strategy"}
                {currentStep === 5 && "Phase 5: Production Brief"}
              </Badge>
            </div>

          </div>

          <DialogTitle className="text-xl lg:text-2xl font-heading tracking-tight text-foreground">
            {currentStep === 1 && "1. Story Concept & Directorial Vision"}
            {currentStep === 2 && "2. Modular Character Lab & Dream Casting"}
            {currentStep === 3 && "3. Dramatic Staging & Concealed Secret"}
            {currentStep === 4 && "4. Global Distribution & Territory Strategy"}
            {currentStep === 5 && "5. Review Production Slate & Greenlight"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-0.5">
            {currentStep === 1 && "Define the high-concept premise, genre space, and directorial cinematic blueprint."}
            {currentStep === 2 && "Construct each character's psychological DNA, speech cadence, and dream actor performance reference."}
            {currentStep === 3 && "Establish the physical location and the secret that creates asymmetric knowledge for ClickHouse time-gating."}
            {currentStep === 4 && "Target global cinematic territories and configure regional cultural localization."}
            {currentStep === 5 && "Inspect the comprehensive production manifest before compiling the interactive graph and screenplay."}
          </DialogDescription>

          {/* Stepper Progress Bar */}
          <div className="grid grid-cols-5 gap-2 mt-4">
            {[1, 2, 3, 4, 5].map((stepNum) => (
              <div
                key={stepNum}
                className={`h-1.5 rounded-full transition-all ${
                  stepNum === currentStep
                    ? "bg-accent shadow-[0_0_10px_rgba(234,179,8,0.6)]"
                    : stepNum < currentStep
                    ? "bg-emerald-500"
                    : "bg-secondary/60"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Wizard Step Bodies (Spacious Scrollable Center) */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 lg:p-8 bg-[#090a0e]">
          {/* ──────────────────────────────────────────────────────────
              STEP 1: CONCEPT & DIRECTOR STYLE (Wide 2-Column Grid)
          ────────────────────────────────────────────────────────── */}
          {currentStep === 1 && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in-50 duration-200">
              {/* Left Column: Title, Premise, Genre (7 cols) */}
              <div className="lg:col-span-7 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1.5 uppercase tracking-wide font-mono">
                    Feature Film Title <span className="text-accent">*</span>
                  </label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Midnight Horizon, The Geneva Exchange, Chrono Null, Pale Rain..."
                    className="text-sm h-10 bg-secondary/20 border-border/80 font-heading font-semibold"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1.5 uppercase tracking-wide font-mono">
                    Core Premise / Opening Dramatic Hook <span className="text-accent">*</span>
                  </label>
                  <textarea
                    value={logline}
                    onChange={(e) => setLogline(e.target.value)}
                    placeholder="Describe the central conflict, who is in the room, what high-stakes dilemma is in play, and what impending deadline or crisis forces immediate action..."
                    rows={4}
                    className="w-full rounded-xl border border-border/80 bg-secondary/20 p-3 text-xs focus:outline-none focus:ring-1 focus:ring-accent resize-none text-foreground placeholder:text-muted-foreground leading-relaxed"
                    required
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-semibold text-foreground uppercase tracking-wide font-mono">
                        Genre &amp; Cinematic Palette
                      </label>
                      <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 border-accent/30 text-accent">
                        {isCustomGenre ? (customGenre.trim() || "Custom Hybrid") : GENRE_OPTIONS.find((g) => g.id === genre)?.label || genre}
                      </Badge>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsCustomGenre(!isCustomGenre)}
                      className={`text-[11px] font-mono px-2.5 py-0.5 rounded-full transition-all flex items-center gap-1.5 ${
                        isCustomGenre
                          ? "bg-accent text-accent-foreground font-semibold shadow-xs"
                          : "text-muted-foreground hover:text-foreground border border-border/80 hover:border-accent/40 bg-secondary/20"
                      }`}
                    >
                      <Sparkles className="h-3 w-3" />
                      {isCustomGenre ? `Catalog (${GENRE_OPTIONS.length})` : "+ Custom / Hybrid"}
                    </button>
                  </div>

                  {isCustomGenre ? (
                    <div className="p-3.5 rounded-xl border border-accent/40 bg-accent/5 space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-semibold text-foreground">Custom / Hybrid Genre Definition</span>
                          <span className="text-[10px] text-muted-foreground font-mono">Any subgenre or fusion</span>
                        </div>
                        <Input
                          value={customGenre}
                          onChange={(e) => setCustomGenre(e.target.value)}
                          placeholder="e.g. Afrofuturist Cyber-Western, Samurai Gothic Noir, Supernatural Heist..."
                          className="bg-secondary/40 border-accent/30 text-xs font-mono text-foreground placeholder:text-muted-foreground/60 h-9"
                          autoFocus
                        />
                      </div>

                      {/* Quick preset suggestions */}
                      <div className="space-y-1.5">
                        <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider block">
                          Suggested Hybrids:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {CUSTOM_GENRE_PRESETS.map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => setCustomGenre(preset)}
                              className={`text-[10px] font-mono px-2 py-0.5 rounded-md border transition-all ${
                                customGenre === preset
                                  ? "border-accent bg-accent/20 text-accent font-semibold"
                                  : "border-border/60 bg-secondary/30 text-muted-foreground hover:text-foreground hover:border-border"
                              }`}
                            >
                              {preset}
                            </button>
                          ))}
                        </div>
                      </div>

                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        The AI director will dynamically tailor lighting palettes, emotional tension, and character archetypes to your specific genre fusion.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {/* Category filter pills */}
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar border-b border-border/40">
                        {GENRE_CATEGORIES.map((cat) => {
                          const isActive = genreCategory === cat.id;
                          const count = cat.id === "all" ? GENRE_OPTIONS.length : GENRE_OPTIONS.filter((g) => g.category === cat.id).length;
                          return (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => setGenreCategory(cat.id)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all whitespace-nowrap flex items-center gap-1 ${
                                isActive
                                  ? "bg-accent/20 text-accent border border-accent/40 font-semibold shadow-xs"
                                  : "bg-secondary/20 text-muted-foreground hover:text-foreground border border-border/40 hover:bg-secondary/40"
                              }`}
                            >
                              <span>{cat.label}</span>
                              <span className="text-[9px] opacity-60 font-mono">({count})</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Genre cards grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
                        {filteredGenres.map((g) => {
                          const isSelected = genre === g.id && !isCustomGenre;
                          return (
                            <button
                              key={g.id}
                              type="button"
                              onClick={() => {
                                setGenre(g.id);
                                setIsCustomGenre(false);
                              }}
                              className={`p-2.5 rounded-xl text-left border transition-all text-xs flex flex-col justify-between ${
                                isSelected
                                  ? "border-accent bg-accent/15 text-accent font-medium shadow-sm ring-1 ring-accent/30"
                                  : "border-border/70 bg-secondary/15 text-muted-foreground hover:text-foreground hover:bg-secondary/30"
                              }`}
                            >
                              <div>
                                <div className="flex items-center justify-between gap-1">
                                  <span className="font-bold text-xs text-foreground block truncate">{g.label}</span>
                                  {isSelected && <Check className="h-3 w-3 text-accent shrink-0" />}
                                </div>
                                <span className="text-[10px] text-muted-foreground mt-0.5 block line-clamp-1">{g.tag}</span>
                              </div>
                              {g.palette && (
                                <span className="text-[9px] text-muted-foreground/80 font-mono mt-2 line-clamp-1 block border-t border-border/30 pt-1">
                                  🎨 {g.palette}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* ── NARRATIVE FORMAT & TIMEFRAME SCOPE ── */}
                <div className="p-4 rounded-xl border border-accent/25 bg-secondary/10 space-y-3.5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-foreground uppercase tracking-wide font-mono flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-accent" />
                      Narrative Format &amp; Target Timeframe
                    </label>
                    <span className="text-xs font-mono font-bold text-accent bg-accent/15 px-2 py-0.5 rounded border border-accent/30">
                      {targetRuntimeMinutes} min ({formatTimecode(targetRuntimeMinutes * 60)})
                    </span>
                  </div>

                  {/* Format Selector Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {FORMAT_OPTIONS.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => handleSelectFormat(f.id)}
                        className={`p-2.5 rounded-lg text-left border transition-all text-xs flex flex-col justify-between ${
                          narrativeFormat === f.id
                            ? "border-accent bg-accent/15 text-accent font-medium shadow-xs ring-1 ring-accent/30"
                            : "border-border/60 bg-secondary/20 text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-sm">{f.icon}</span>
                          <Badge variant="outline" className="text-[9px] py-0 px-1 font-mono">
                            {f.badge}
                          </Badge>
                        </div>
                        <span className="font-bold text-xs text-foreground mt-1 block">{f.label}</span>
                        <span className="text-[10px] text-muted-foreground mt-0.5 block leading-tight">{f.description}</span>
                      </button>
                    ))}
                  </div>

                  {/* Runtime Slider & Extend/Shrink Buttons */}
                  <div className="space-y-1.5 pt-1 border-t border-border/40">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-[11px] text-muted-foreground">Adjust Total Runtime:</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleAdjustRuntime(-15)}
                          className="h-6 px-2 text-[10px] font-mono rounded bg-secondary/50 border border-border/70 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                          title="Shrink project runtime by 15 minutes"
                        >
                          -15m
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAdjustRuntime(-5)}
                          className="h-6 px-1.5 text-[10px] font-mono rounded bg-secondary/50 border border-border/70 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                          title="Shrink project runtime by 5 minutes"
                        >
                          -5m
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAdjustRuntime(5)}
                          className="h-6 px-1.5 text-[10px] font-mono rounded bg-secondary/50 border border-border/70 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                          title="Extend project runtime by 5 minutes"
                        >
                          +5m
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAdjustRuntime(15)}
                          className="h-6 px-2 text-[10px] font-mono rounded bg-secondary/50 border border-border/70 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                          title="Extend project runtime by 15 minutes"
                        >
                          +15m
                        </button>
                      </div>
                    </div>
                    <input
                      type="range"
                      min={2}
                      max={240}
                      step={1}
                      value={targetRuntimeMinutes}
                      onChange={(e) => {
                        const next = Number(e.target.value);
                        setTargetRuntimeMinutes(next);
                        if (scenePlacementSeconds > next * 60) {
                          setScenePlacementSeconds(Math.max(0, next * 60 - sceneDurationSeconds));
                        }
                      }}
                      className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-accent"
                    />
                    <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                      <span>2m (Teaser)</span>
                      <span>52m (Pilot)</span>
                      <span>95m (Feature)</span>
                      <span>150m (Epic)</span>
                      <span>240m</span>
                    </div>
                  </div>

                  {/* Scene Pinpoint Along Narrative Flow */}
                  <div className="space-y-2 pt-1 border-t border-border/40">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-[11px] text-foreground flex items-center gap-1">
                        <Milestone className="h-3 w-3 text-cyan-400" />
                        Pinpoint Scene 1 Narrative Placement:
                      </span>
                      <span className="font-mono text-[11px] text-cyan-400 font-bold">
                        {formatTimecode(scenePlacementSeconds)} / {formatTimecode(targetRuntimeMinutes * 60)} ({Math.round((scenePlacementSeconds / (targetRuntimeMinutes * 60)) * 100)}%)
                      </span>
                    </div>

                    {/* Macro Act Flow Progress Bar */}
                    <div className="relative h-6 bg-black/60 rounded-md border border-border/70 overflow-hidden flex items-center px-1">
                      {/* Act 1 segment (0% to 25%) */}
                      <div className="absolute left-0 top-0 bottom-0 w-[25%] bg-blue-500/10 border-r border-blue-500/30 flex items-center pl-1.5">
                        <span className="text-[9px] font-mono text-blue-400/80 uppercase">Act I</span>
                      </div>
                      {/* Act 2 segment (25% to 75%) */}
                      <div className="absolute left-[25%] top-0 bottom-0 w-[50%] bg-amber-500/10 border-r border-amber-500/30 flex items-center justify-between px-2">
                        <span className="text-[9px] font-mono text-amber-400/80 uppercase">Act II</span>
                        <span className="text-[8px] font-mono text-amber-300/60 uppercase">Midpoint 50%</span>
                      </div>
                      {/* Act 3 segment (75% to 100%) */}
                      <div className="absolute left-[75%] top-0 bottom-0 w-[25%] bg-rose-500/10 flex items-center pl-2">
                        <span className="text-[9px] font-mono text-rose-400/80 uppercase">Act III</span>
                      </div>

                      {/* Active Scene Pin Marker */}
                      <div
                        className="absolute top-0 bottom-0 w-1.5 bg-accent shadow-[0_0_8px_rgba(234,179,8,0.9)] z-10 transition-all pointer-events-none"
                        style={{
                          left: `${Math.min(99, Math.max(0, (scenePlacementSeconds / (targetRuntimeMinutes * 60)) * 100))}%`,
                        }}
                      />
                    </div>

                    {/* Quick Snap Anchor Buttons */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      {SCENE_ANCHORS.map((a) => {
                        const anchorSec = Math.round(targetRuntimeMinutes * 60 * a.pct);
                        const isSelected = Math.abs(scenePlacementSeconds - anchorSec) < (targetRuntimeMinutes * 60 * 0.05);
                        return (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => setScenePlacementSeconds(anchorSec)}
                            className={`p-1.5 rounded text-left border text-[10px] transition-all flex flex-col cursor-pointer ${
                              isSelected
                                ? "border-cyan-400 bg-cyan-500/15 text-cyan-300 font-bold ring-1 ring-cyan-400/30"
                                : "border-border/60 bg-secondary/20 text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                            }`}
                          >
                            <span className="font-semibold">{a.label}</span>
                            <span className="text-[9px] font-mono opacity-70">
                              {formatTimecode(anchorSec)} ({Math.round(a.pct * 100)}%)
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Directorial Blueprint & Scope Profile (5 cols) */}
              <div className="lg:col-span-5 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground uppercase tracking-wide font-mono flex items-center gap-1.5">
                    <Film className="h-3.5 w-3.5 text-cyan-400" />
                    Director Aesthetic Blueprint
                  </label>
                  <span className="text-[10px] font-mono text-muted-foreground">Tone &amp; Pacing</span>
                </div>

                <div className="space-y-2">
                  {DIRECTOR_STYLES.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setDirectorStyle(d.id)}
                      className={`w-full p-3 rounded-xl text-left border text-xs transition-all flex flex-col gap-1 ${
                        directorStyle === d.id
                          ? "border-cyan-500 bg-cyan-500/15 text-foreground ring-1 ring-cyan-500/30"
                          : "border-border/70 bg-secondary/15 text-muted-foreground hover:text-foreground hover:bg-secondary/30"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-foreground text-xs">{d.id}</span>
                        {directorStyle === d.id && (
                          <Badge variant="outline" className="text-[9px] border-cyan-500/40 text-cyan-400 py-0">
                            Active
                          </Badge>
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground leading-snug">{d.style}</span>
                    </button>
                  ))}
                </div>

                {/* Timeframe Scope Summary & Pacing Blueprint */}
                <div className="p-3.5 rounded-xl border border-border/70 bg-secondary/15 space-y-2 mt-3">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-muted-foreground uppercase text-[10px] flex items-center gap-1.5">
                      <Timer className="h-3.5 w-3.5 text-accent" />
                      Scope &amp; Pacing Profile
                    </span>
                    <Badge variant="outline" className="text-[10px] font-mono text-accent border-accent/40">
                      {NARRATIVE_FORMATS[narrativeFormat]?.label || "Custom"}
                    </Badge>
                  </div>

                  <p className="text-[11px] text-muted-foreground leading-snug">
                    {NARRATIVE_FORMATS[narrativeFormat]?.pacingDescription || "Balanced narrative pace and act cadence."}
                  </p>

                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/40 text-[10px] font-mono">
                    <div className="p-2 rounded bg-background/50 border border-border/50">
                      <span className="text-muted-foreground block">Act I Break</span>
                      <span className="text-foreground font-semibold">
                        {formatTimecode(targetRuntimeMinutes * 60 * 0.25)}
                      </span>
                    </div>
                    <div className="p-2 rounded bg-background/50 border border-border/50">
                      <span className="text-muted-foreground block">Midpoint Turn</span>
                      <span className="text-foreground font-semibold">
                        {formatTimecode(targetRuntimeMinutes * 60 * 0.50)}
                      </span>
                    </div>
                    <div className="p-2 rounded bg-background/50 border border-border/50">
                      <span className="text-muted-foreground block">Third Act Climax</span>
                      <span className="text-foreground font-semibold">
                        {formatTimecode(targetRuntimeMinutes * 60 * 0.75)}
                      </span>
                    </div>
                    <div className="p-2 rounded bg-background/50 border border-border/50">
                      <span className="text-muted-foreground block">Scene Budget</span>
                      <span className="text-accent font-semibold">
                        ~{NARRATIVE_FORMATS[narrativeFormat]?.typicalScenes || 24} scenes
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ──────────────────────────────────────────────────────────
              STEP 2: CHARACTER LAB (Expansive Workshop Layout)
          ────────────────────────────────────────────────────────── */}
          {currentStep === 2 && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in-50 duration-200">
              {/* Left Column: Active Cast Roster (5 cols) */}
              <div className="lg:col-span-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground uppercase tracking-wide font-mono flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-accent" />
                    Ensemble Roster ({charactersList.length})
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={isMatchingGenre}
                      onClick={async () => {
                        setIsMatchingGenre(true);
                        try {
                          const res = await fetch("/api/character/synthesize-ensemble", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ genre: effectiveGenre, premise: logline }),
                          });
                          const data = await res.json();
                          const isFallback = notifyIfFallback(data, "Match Genre");
                          if (Array.isArray(data.characters) && data.characters.length > 0 && !isFallback) {
                            const mapped: ProjectCharacter[] = data.characters.map((c: any) => ({
                              name: c.name,
                              role: c.role || "Lead",
                              archetype: c.archetype,
                              speechStyle: c.speechStyle || "",
                              subtextRatio: c.subtextRatio || "high",
                              actorComp: c.actorComp || c.dreamActorComp || "",
                              castingReasoning: c.castingReasoning || "",
                              confidence: typeof c.confidence === "number" ? c.confidence : 80,
                              verbalPacing: typeof c.verbalPacing === "number" ? c.verbalPacing : 75,
                              objective: c.objective || "",
                              quirks: Array.isArray(c.quirks) ? c.quirks : [],
                            }));
                            setCharactersList(mapped);
                            setSelectedCharIdx(0);
                          } else {
                            const dynamicChars = synthesizeDynamicCharacters(effectiveGenre, logline);
                            if (dynamicChars.length > 0) {
                              if (!isFallback) {
                                toast.add({
                                  title: "Match Genre: showing template cast",
                                  description: "The AI casting service returned no characters, so this ensemble is a curated template, not live AI output.",
                                  type: "warning",
                                });
                              }
                              setCharactersList(dynamicChars);
                              setSelectedCharIdx(0);
                            }
                          }
                        } catch (err) {
                          console.error("Ensemble synthesis error:", err);
                          toast.add({
                            title: "Match Genre: showing template cast",
                            description: "Could not reach the AI casting service, so this ensemble is a curated template, not live AI output.",
                            type: "warning",
                          });
                          const dynamicChars = synthesizeDynamicCharacters(effectiveGenre, logline);
                          if (dynamicChars.length > 0) {
                            setCharactersList(dynamicChars);
                            setSelectedCharIdx(0);
                          }
                        } finally {
                          setIsMatchingGenre(false);
                        }
                      }}
                      className="text-xs h-7 gap-1 text-muted-foreground hover:text-accent border border-border/50 hover:border-accent/40"
                      title="Synthesize cast ensemble matching the selected genre and premise via AI"
                    >
                      <RefreshCw className={`h-3 w-3 ${isMatchingGenre ? "animate-spin" : ""}`} />
                      {isMatchingGenre ? "Synthesizing..." : "Match Genre"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleAddCharacter}
                      className="text-xs h-7 gap-1 border-accent/40 text-accent hover:bg-accent/10"
                    >
                      <Plus className="h-3 w-3" />
                      Add Character
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  {charactersList.map((c, idx) => (
                    <div
                      key={idx}
                      onClick={() => setSelectedCharIdx(idx)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                        selectedCharIdx === idx
                          ? "border-accent bg-accent/10 shadow-sm ring-1 ring-accent/30"
                          : "border-border/70 bg-secondary/15 hover:bg-secondary/30"
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        {c.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={c.imageUrl}
                            alt={c.name}
                            className="h-8 w-8 rounded-full object-cover border border-accent/40 shrink-0"
                          />
                        ) : (
                          <div
                            className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                              selectedCharIdx === idx
                                ? "bg-accent/25 text-accent border border-accent/40"
                                : "bg-secondary text-muted-foreground"
                            }`}
                          >
                            {c.name.charAt(0)}
                          </div>
                        )}
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-foreground">{c.name}</span>
                            <Badge variant="outline" className="text-[9px] py-0 px-1.5 border-border">
                              {c.role || (idx === 0 ? "Protagonist" : "Foil")}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground line-clamp-1">
                            {c.archetype}
                          </p>
                          {c.actorComp && (
                            <span className="text-[10px] font-mono text-cyan-400 block truncate">
                              Comp: {c.actorComp}
                            </span>
                          )}
                        </div>
                      </div>

                      {charactersList.length > 2 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveCharacter(idx);
                          }}
                          className="text-muted-foreground hover:text-rose-400 h-6 w-6 shrink-0"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column: Active Character DNA Workshop (7 cols) */}
              <div className="lg:col-span-7 rounded-xl border border-border/80 bg-secondary/15 p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-accent" />
                    <span className="text-xs font-bold text-foreground">
                      Editing Character DNA: {activeChar.name}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    Modular Trait Studio
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-mono uppercase text-muted-foreground block mb-1">
                      Character Name
                    </label>
                    <Input
                      value={activeChar.name}
                      onChange={(e) => handleUpdateActiveChar({ name: e.target.value })}
                      className="text-xs h-8 bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono uppercase text-muted-foreground block mb-1">
                      Dramatic Role
                    </label>
                    <select
                      value={activeChar.role || "Lead Protagonist"}
                      onChange={(e) => handleUpdateActiveChar({ role: e.target.value })}
                      className="h-8 w-full rounded border border-border bg-background px-2 text-xs text-foreground focus:outline-none"
                    >
                      <option value="Lead Protagonist">Lead Protagonist</option>
                      <option value="Strategic Foil / Antagonist">Strategic Foil / Antagonist</option>
                      <option value="Unpredictable Wildcard">Unpredictable Wildcard</option>
                      <option value="Inside Informant">Inside Informant</option>
                      <option value="Reluctant Specialist">Reluctant Specialist</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-mono uppercase text-muted-foreground block mb-1">
                    Archetype &amp; Core Motivation
                  </label>
                  <Input
                    value={activeChar.archetype}
                    onChange={(e) => handleUpdateActiveChar({ archetype: e.target.value })}
                    placeholder="e.g. Rogue netrunner racing against biometric burnout..."
                    className="text-xs h-8 bg-background"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-mono uppercase text-muted-foreground block mb-1">
                    Dream Actor Performance Comp
                  </label>
                  <Input
                    value={activeChar.actorComp || ""}
                    onChange={(e) => handleUpdateActiveChar({ actorComp: e.target.value })}
                    placeholder="e.g. Jake Gyllenhaal (Nightcrawler) or Florence Pugh (Lady Macbeth)..."
                    className="text-xs h-8 bg-background"
                  />
                  {activeChar.castingReasoning && (
                    <div className="mt-2 p-2.5 rounded-lg bg-accent/5 border border-accent/25 text-[11px] text-muted-foreground flex items-start gap-2">
                      <Sparkles className="h-3.5 w-3.5 text-accent shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-accent block mb-0.5">Gemini Casting Rationale</span>
                        <span>{activeChar.castingReasoning}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-mono uppercase text-muted-foreground block mb-1">
                      Speech Style &amp; Cadence
                    </label>
                    <Input
                      value={activeChar.speechStyle || ""}
                      onChange={(e) => handleUpdateActiveChar({ speechStyle: e.target.value })}
                      placeholder="e.g. Breathless, staccato, guarded..."
                      className="text-xs h-8 bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono uppercase text-muted-foreground block mb-1">
                      Subtext Level
                    </label>
                    <select
                      value={activeChar.subtextRatio || "high"}
                      onChange={(e) => handleUpdateActiveChar({ subtextRatio: e.target.value })}
                      className="h-8 w-full rounded border border-border bg-background px-2 text-xs text-foreground focus:outline-none"
                    >
                      <option value="low">Low (Direct, military, literal)</option>
                      <option value="moderate">Moderate (Standard cinematic)</option>
                      <option value="high">High (Veiled tension, subtextual)</option>
                      <option value="extreme">Extreme (Double meanings everywhere)</option>
                    </select>
                  </div>
                </div>

                {/* Trait Presets Pills */}
                <div>
                  <label className="text-[10px] font-mono uppercase text-muted-foreground block mb-1.5">
                    Archetype DNA Presets:
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {ARCHETYPE_PRESETS.map((p, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() =>
                          handleUpdateActiveChar({
                            confidence: p.conf,
                            verbalPacing: p.spd,
                            subtextRatio: p.sub,
                          })
                        }
                        className="rounded-lg bg-secondary/80 hover:bg-secondary px-2.5 py-1 text-[10px] font-mono text-foreground transition-colors border border-border"
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Character Visual Concept Frame */}
                <div className="p-3.5 rounded-xl border border-border/80 bg-background/50 flex items-center justify-between gap-3 shadow-inner">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-12 w-12 rounded-lg overflow-hidden border border-border bg-black shrink-0 relative flex items-center justify-center">
                      {activeChar.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={activeChar.imageUrl}
                          alt={activeChar.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Eye className="h-5 w-5 text-muted-foreground/60" />
                      )}
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-foreground block">
                          Visual Concept Look
                        </span>
                        <Badge variant="outline" className="text-[9px] font-mono border-accent/40 text-accent py-0">
                          Imagen 3
                        </Badge>
                      </div>
                      <span className="text-[10px] text-muted-foreground block truncate">
                        {activeChar.imageUrl
                          ? "Cinematic portrait rendered and attached"
                          : "Generate 85mm face portrait & character look"}
                      </span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleGenerateCharacterVisual}
                    disabled={isGeneratingVisual}
                    className="text-xs h-8 gap-1.5 border-accent/40 text-accent hover:bg-accent/10 shrink-0 cursor-pointer"
                  >
                    {isGeneratingVisual ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    <span>
                      {isGeneratingVisual
                        ? "Generating..."
                        : activeChar.imageUrl
                        ? "Regenerate Look"
                        : "Generate Character Look"}
                    </span>
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ──────────────────────────────────────────────────────────
              STEP 3: DRAMATIC TENSION & ASYMMETRIC SECRET (Wide Layout)
          ────────────────────────────────────────────────────────── */}
          {currentStep === 3 && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in-50 duration-200">
              {/* Left Column: Physical Staging (6 cols) */}
              <div className="lg:col-span-6 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-foreground uppercase tracking-wide font-mono block mb-1.5 flex items-center gap-1.5">
                    <Compass className="h-3.5 w-3.5 text-accent" />
                    Primary Scene Staging Location
                  </label>
                  <Input
                    value={primaryLocation}
                    onChange={(e) => setPrimaryLocation(e.target.value)}
                    placeholder="e.g. Sub-level bank vault, Orbital research airlock, Abandoned dock..."
                    className="text-xs h-9 bg-secondary/20 border-border/80"
                  />
                  <span className="text-[11px] text-muted-foreground mt-1.5 block leading-relaxed">
                    Grounds the architectural location scout, natural lighting angles, and multi-cam sightlines.
                  </span>
                </div>

                <div className="p-4 rounded-xl border border-border/80 bg-secondary/15 space-y-2">
                  <span className="text-xs font-bold text-foreground block">
                    Spatial Architecture &amp; Sound Staging
                  </span>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    The location dictates acoustic isolation and camera packages. In enclosed locations like vaults or airlocks, 85mm close-ups compress character intimacy while ambient reverberations accentuate silent pauses.
                  </p>
                </div>
              </div>

              {/* Right Column: Concealed Secret & Knowledge Firewall (6 cols) */}
              <div className="lg:col-span-6 space-y-4">
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-amber-400" />
                    <span className="text-xs font-bold text-amber-400">
                      The Concealed Secret (Asymmetric Knowledge Firewall)
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    This powers the ClickHouse time-gate. One character holds this secret; other characters are completely unaware of it until later in the timeline.
                  </p>
                  <textarea
                    value={coreSecret}
                    onChange={(e) => setCoreSecret(e.target.value)}
                    placeholder="Describe the hidden fact, unsanctioned side-deal, or off-screen action..."
                    rows={4}
                    className="w-full rounded-lg border border-border/80 bg-background p-3 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none text-foreground placeholder:text-muted-foreground leading-relaxed"
                  />
                </div>

                <div className="p-4 rounded-xl border border-border/80 bg-secondary/15 text-xs text-muted-foreground space-y-1.5">
                  <span className="font-bold text-foreground block text-xs">Epistemic Status:</span>
                  <p className="text-[11px]">
                    • <strong className="text-foreground">{charactersList[0]?.name || "Lead"}</strong>: Completely blind to this fact at timeline minute 00:00:00.
                  </p>
                  <p className="text-[11px]">
                    • <strong className="text-foreground">{charactersList[1]?.name || "Foil"}</strong>: Actively manipulating dialogue to prevent discovery.
                  </p>
                </div>
              </div>

              {/* Bottom Row: Production Logistics, Financials & Budget Cap Policy (12 cols) */}
              <div className="lg:col-span-12 rounded-xl border border-border/80 bg-secondary/10 p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-border/50 pb-2.5">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-emerald-400" />
                    <span className="text-xs font-bold text-foreground">
                      Production Base, Financial Logistics &amp; Budget Cap Policy
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    Real-World Location Grounding
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                  {/* Shoot Region / Base */}
                  <div className="sm:col-span-4 space-y-1.5">
                    <label className="text-[10px] font-mono uppercase text-muted-foreground block flex items-center gap-1">
                      <Navigation className="h-3 w-3 text-accent" />
                      Production Base (City / Region)
                    </label>
                    <Input
                      value={shootRegion}
                      onChange={(e) => setShootRegion(e.target.value)}
                      placeholder="e.g. Los Angeles, CA or London, UK"
                      className="text-xs h-8 bg-background"
                    />
                    <div className="flex flex-wrap gap-1 pt-1">
                      {["Los Angeles, CA", "London, UK", "New York, NY", "Vancouver, BC"].map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setShootRegion(c)}
                          className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
                            shootRegion === c
                              ? "border-accent bg-accent/20 text-accent font-semibold"
                              : "border-border text-muted-foreground hover:bg-secondary/60"
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Currency */}
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="text-[10px] font-mono uppercase text-muted-foreground block">
                      Currency
                    </label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value as SupportedCurrency)}
                      className="h-8 w-full rounded border border-border bg-background px-2 text-xs text-foreground focus:outline-none"
                    >
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="CAD">CAD (CA$)</option>
                      <option value="AUD">AUD (A$)</option>
                      <option value="JPY">JPY (¥)</option>
                    </select>
                  </div>

                  {/* Total Budget */}
                  <div className="sm:col-span-3 space-y-1.5">
                    <label className="text-[10px] font-mono uppercase text-muted-foreground block">
                      Total Production Budget
                    </label>
                    <Input
                      type="number"
                      min={5000}
                      step={5000}
                      value={budget}
                      onChange={(e) => setBudget(Number(e.target.value) || 0)}
                      className="text-xs h-8 bg-background font-mono"
                    />
                  </div>

                  {/* Day Rate */}
                  <div className="sm:col-span-3 space-y-1.5">
                    <label className="text-[10px] font-mono uppercase text-muted-foreground block">
                      Budget Per Shoot Day
                    </label>
                    <Input
                      type="number"
                      min={500}
                      step={1000}
                      value={budgetPerShootDay}
                      onChange={(e) => setBudgetPerShootDay(Number(e.target.value) || 0)}
                      className="text-xs h-8 bg-background font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center pt-2 border-t border-border/40">
                  {/* Location Allocation % */}
                  <div className="sm:col-span-6 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[10px] font-mono uppercase text-muted-foreground">
                        Location Allocation: {locationsPct}%
                      </span>
                      <span className="font-mono font-bold text-emerald-400">
                        {formatCurrency(Math.round(budget * (locationsPct / 100)), currency)} earmarked
                      </span>
                    </div>
                    <input
                      type="range"
                      min={5}
                      max={50}
                      step={1}
                      value={locationsPct}
                      onChange={(e) => setLocationsPct(Number(e.target.value))}
                      className="w-full accent-emerald-500 cursor-pointer"
                    />
                  </div>

                  {/* Cap Policy */}
                  <div className="sm:col-span-6 space-y-1.5">
                    <label className="text-[10px] font-mono uppercase text-muted-foreground block flex items-center gap-1">
                      <ShieldAlert className="h-3 w-3 text-accent" />
                      Budget Cap Policy
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setBudgetCapPolicy("advisory")}
                        className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                          budgetCapPolicy === "advisory"
                            ? "border-emerald-500 bg-emerald-500/10 text-foreground font-semibold"
                            : "border-border bg-background text-muted-foreground hover:border-emerald-500/40"
                        }`}
                      >
                        <div className="text-[11px] flex items-center justify-between">
                          <span>Advisory Warning</span>
                          <span className="text-[9px] text-emerald-400">Flexible</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground block truncate">
                          Alerts on overages
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setBudgetCapPolicy("hard_block")}
                        className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                          budgetCapPolicy === "hard_block"
                            ? "border-rose-500 bg-rose-500/10 text-foreground font-semibold"
                            : "border-border bg-background text-muted-foreground hover:border-rose-500/40"
                        }`}
                      >
                        <div className="text-[11px] flex items-center justify-between">
                          <span>Hard Block</span>
                          <span className="text-[9px] text-rose-400">Strict</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground block truncate">
                          Blocks over-budget picks
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ──────────────────────────────────────────────────────────
              STEP 4: AUDIENCE & DISTRIBUTION TARGETING (Grid Layout)
          ────────────────────────────────────────────────────────── */}
          {currentStep === 4 && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-foreground uppercase tracking-wide font-mono block">
                    Target Theatrical &amp; Streaming Territories
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Select international markets to activate territory-specific ClickHouse precedent modeling.
                  </span>
                </div>
                <Badge variant="outline" className="text-xs font-mono border-accent/40 text-accent">
                  {selectedTerritories.length} Active Targets
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {TARGET_TERRITORIES.map((t) => {
                  const isSelected = selectedTerritories.includes(t.code);
                  return (
                    <div
                      key={t.code}
                      onClick={() => handleToggleTerritory(t.code)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-3 text-xs ${
                        isSelected
                          ? "border-emerald-500/50 bg-emerald-500/10 text-foreground ring-1 ring-emerald-500/30"
                          : "border-border/70 bg-secondary/15 text-muted-foreground hover:bg-secondary/30"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className="text-base">{t.icon}</span>
                          <div>
                            <span className="font-bold text-xs text-foreground block">{t.name}</span>
                            <span className="text-[10px] font-mono text-muted-foreground">{t.code}</span>
                          </div>
                        </div>
                        <div
                          className={`h-4 w-4 rounded flex items-center justify-center border text-[9px] ${
                            isSelected
                              ? "bg-emerald-500 border-emerald-500 text-white"
                              : "border-border bg-background"
                          }`}
                        >
                          {isSelected && <Check className="h-3 w-3" />}
                        </div>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-snug">{t.note}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ──────────────────────────────────────────────────────────
              STEP 5: REVIEW & GREENLIGHT (Cinematic Slate Dossier)
          ────────────────────────────────────────────────────────── */}
          {currentStep === 5 && (
            <div className="space-y-5 animate-in fade-in-50 duration-200">
              <div className="rounded-2xl border border-border/80 bg-secondary/15 p-6 space-y-4 shadow-inner">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border/60 pb-3 gap-2">
                  <div>
                    <span className="font-heading text-xl lg:text-2xl font-bold text-foreground block">
                      {title || "Untitled Production"}
                    </span>
                    <span className="text-xs text-accent font-semibold">{effectiveGenre}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs font-mono border-cyan-500/40 text-cyan-400">
                      Director Tone: {directorStyle}
                    </Badge>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-mono uppercase text-muted-foreground block">
                    Core Premise &amp; Scene Beat
                  </span>
                  <p className="text-xs text-foreground mt-1 leading-relaxed">{logline}</p>
                </div>

                {/* Cast Ensemble Dossiers */}
                <div>
                  <span className="text-[10px] font-mono uppercase text-muted-foreground block mb-2">
                    Cast Ensemble ({charactersList.length} Characters)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {charactersList.map((c, i) => (
                      <div key={i} className="p-3 rounded-xl border border-border/60 bg-background/50 flex items-start gap-2.5">
                        {c.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={c.imageUrl}
                            alt={c.name}
                            className="h-9 w-9 rounded-md object-cover border border-accent/40 shrink-0"
                          />
                        ) : (
                          <div className="h-9 w-9 rounded-md bg-secondary flex items-center justify-center font-bold text-xs shrink-0 text-muted-foreground">
                            {c.name.charAt(0)}
                          </div>
                        )}
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-foreground truncate">{c.name}</span>
                            <Badge variant="outline" className="text-[9px] py-0 px-1 shrink-0">
                              {c.role}
                            </Badge>
                          </div>
                          <p className="text-[10px] text-muted-foreground line-clamp-1">{c.archetype}</p>
                          {c.actorComp && (
                            <span className="text-[9px] font-mono text-cyan-400 block truncate">
                              Comp: {c.actorComp}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Timeframe & Narrative Architecture */}
                <div className="p-3.5 rounded-xl border border-accent/30 bg-accent/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase text-accent font-semibold flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-accent" />
                      Timeframe Scope &amp; Scene Pinpoint
                    </span>
                    <Badge variant="outline" className="text-[10px] font-mono border-accent/40 text-accent">
                      {targetRuntimeMinutes} min ({formatTimecode(targetRuntimeMinutes * 60)}) · {NARRATIVE_FORMATS[narrativeFormat]?.label || "Custom"}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <div className="p-2 rounded bg-background/50 border border-border/50">
                      <span className="text-[10px] text-muted-foreground block font-mono">Format &amp; Scenes:</span>
                      <span className="font-semibold text-foreground">
                        {NARRATIVE_FORMATS[narrativeFormat]?.label || "Custom"} (~{NARRATIVE_FORMATS[narrativeFormat]?.typicalScenes || 24} scenes)
                      </span>
                    </div>
                    <div className="p-2 rounded bg-background/50 border border-border/50">
                      <span className="text-[10px] text-muted-foreground block font-mono">Scene 1 Pinpoint:</span>
                      <span className="font-semibold text-cyan-400 font-mono">
                        {formatTimecode(scenePlacementSeconds)} ({Math.round((scenePlacementSeconds / (targetRuntimeMinutes * 60)) * 100)}% through story)
                      </span>
                    </div>
                    <div className="p-2 rounded bg-background/50 border border-border/50">
                      <span className="text-[10px] text-muted-foreground block font-mono">Midpoint Turn:</span>
                      <span className="font-semibold text-amber-400 font-mono">
                        {formatTimecode(targetRuntimeMinutes * 60 * 0.5)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Staging & Secret */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  <div className="p-3 rounded-xl border border-border/60 bg-background/50">
                    <span className="text-[10px] font-mono uppercase text-muted-foreground block">
                      Staging Location
                    </span>
                    <p className="text-xs text-foreground font-semibold mt-0.5">{primaryLocation}</p>
                  </div>
                  <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/5">
                    <span className="text-[10px] font-mono uppercase text-amber-400 block">
                      Concealed Asymmetric Secret
                    </span>
                    <p className="text-xs text-foreground mt-0.5 line-clamp-2">{coreSecret}</p>
                  </div>
                </div>

                {/* Target Markets */}
                <div>
                  <span className="text-[10px] font-mono uppercase text-muted-foreground block">
                    Target Distribution Markets
                  </span>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {selectedTerritories.map((code) => (
                      <Badge key={code} variant="secondary" className="text-xs font-mono">
                        {code}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Wizard Footer Controls */}
        <DialogFooter className="m-0 mx-0 mb-0 border-t border-border/80 bg-[#10121a] p-5 shrink-0 flex items-center justify-between rounded-b-2xl sm:rounded-b-3xl">
          <div>
            {currentStep > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setCurrentStep((prev) => (prev - 1) as any)}
                className="text-xs gap-1 text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>

            {currentStep < 5 ? (
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={() => {
                  if (currentStep === 1 && (!title.trim() || !logline.trim())) return;
                  setCurrentStep((prev) => (prev + 1) as any);
                }}
                disabled={currentStep === 1 && (!title.trim() || !logline.trim())}
                className="text-xs gap-1 bg-foreground text-background hover:bg-foreground/90 font-medium px-4 h-9"
              >
                Next Step
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={handleFinalSubmit}
                disabled={isSubmitting || !title.trim() || !logline.trim()}
                className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-md px-5 h-9 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Showrunner Agent Architecting Sequence...</span>
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4" />
                    <span>Greenlight Production Slate</span>
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
