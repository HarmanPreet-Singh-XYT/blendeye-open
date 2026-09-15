"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SlateLabel } from "@/components/cinema/slate-label";
import {
  Users,
  Sparkles,
  Sliders,
  UserCheck,
  Plus,
  Trash2,
  Check,
  Save,
  MessageSquare,
  RefreshCw,
  Copy,
  FolderDown,
  Flame,
  UserPlus,
  Eye,
  Video,
  Maximize2,
  Film,
  Shirt,
  X,
  Upload,
} from "lucide-react";
import { AssetPickerModal } from "@/components/cinema/asset-picker-modal";
import { saveLocalAsset } from "@/lib/asset-store";
import { toast } from "@/components/ui/toast";
import { notifyIfFallback } from "@/lib/fallback-notice";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  type ProjectCharacter,
  getTalentVault,
  saveToTalentVault,
  deleteFromTalentVault,
} from "@/lib/project-store";

interface CharacterLabDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  characters: ProjectCharacter[];
  onUpdateCharacters: (characters: ProjectCharacter[]) => void;
  onOpenHotSeat?: (charName: string) => void;
  onSendToVideo?: (character: ProjectCharacter) => void;
  /** Which project's roster is being edited — shown so it's never ambiguous which production this affects. */
  projectTitle?: string;
}

const ARCHETYPE_PRESETS = [
  { name: "70% Landa + 30% Kendall Roy", conf: 95, spd: 35, sub: 95, desc: "Polite, icy tension masked with corporate anxiety" },
  { name: "Rust Cohle Bleak Truth-Teller", conf: 45, spd: 75, sub: 80, desc: "Philosophical pessimism, observant, hyper-laconic" },
  { name: "Charming Syndicate Fixer", conf: 85, spd: 60, sub: 85, desc: "Velvety exterior masking ruthless leverage" },
  { name: "Hyper-Literal Tactical Soldier", conf: 90, spd: 40, sub: 15, desc: "Blunt, military clipped cadence, zero irony" },
  { name: "Desperate Rogue Specialist", conf: 60, spd: 85, sub: 70, desc: "Fast-talking, paranoid, racing against the clock" },
];

export function CharacterLabDialog({
  open,
  onOpenChange,
  characters,
  onUpdateCharacters,
  onOpenHotSeat,
  onSendToVideo,
  projectTitle,
}: CharacterLabDialogProps) {
  const [selectedCharIndex, setSelectedCharIndex] = React.useState(0);
  const [activeTab, setActiveTab] = React.useState<"visual" | "dna" | "dials" | "actor" | "chemistry" | "vault">("visual");

  // Visual image generation state
  const [isGeneratingFace, setIsGeneratingFace] = React.useState(false);
  const [isGeneratingBody, setIsGeneratingBody] = React.useState(false);
  const [assetPickerTarget, setAssetPickerTarget] = React.useState<"face" | "body" | null>(null);
  const [previewModal, setPreviewModal] = React.useState<{ url: string; title: string; subtitle: string } | null>(null);

  // Local copy of characters
  const [roster, setRoster] = React.useState<ProjectCharacter[]>(characters);
  const [talentVault, setTalentVault] = React.useState<ProjectCharacter[]>([]);
  const [showUnsavedPrompt, setShowUnsavedPrompt] = React.useState(false);

  // Track if local roster differs from saved characters prop
  const hasUnsavedChanges = React.useMemo(() => {
    return JSON.stringify(roster) !== JSON.stringify(characters);
  }, [roster, characters]);

  // Chemistry bench state
  const [chemistryPartnerIdx, setChemistryPartnerIdx] = React.useState(1);
  const [isSimulatingChemistry, setIsSimulatingChemistry] = React.useState(false);
  const [chemistrySceneResult, setChemistrySceneResult] = React.useState<string | null>(null);

  // Dialogue cadence tune state
  const [sampleLine, setSampleLine] = React.useState("Tell me where you hid the access codes.");
  const [isTuningDialogue, setIsTuningDialogue] = React.useState(false);
  const [tunedDialogueResult, setTunedDialogueResult] = React.useState<string | null>(null);

  // Actor comp synthesis state
  const [isRecompingActor, setIsRecompingActor] = React.useState(false);

  // Load characters and vault
  React.useEffect(() => {
    if (open) {
      setRoster(characters);
      setTalentVault(getTalentVault());
      setShowUnsavedPrompt(false);
    }
  }, [characters, open]);

  const handleRequestClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      if (hasUnsavedChanges) {
        setShowUnsavedPrompt(true);
        return;
      }
      onOpenChange(false);
    } else {
      onOpenChange(true);
    }
  };

  const handleDiscardAndClose = () => {
    setRoster(characters);
    setShowUnsavedPrompt(false);
    onOpenChange(false);
  };

  const handleSaveAndClose = () => {
    handleSaveSlateCharacters();
    setShowUnsavedPrompt(false);
    onOpenChange(false);
  };

  const activeChar = roster[selectedCharIndex] || roster[0];

  const handleUpdateActiveChar = (partial: Partial<ProjectCharacter>) => {
    setRoster((prev) => {
      const next = [...prev];
      if (next[selectedCharIndex]) {
        next[selectedCharIndex] = { ...next[selectedCharIndex], ...partial };
      }
      return next;
    });
  };

  const handleSaveSlateCharacters = () => {
    onUpdateCharacters(roster);
    toast.add({
      title: "Characters Updated",
      description: `Saved ${roster.length} character profiles to this production slate.`,
      type: "success",
    });
  };

  const handleSaveToVault = (char: ProjectCharacter) => {
    saveToTalentVault(char);
    setTalentVault(getTalentVault());
    toast.add({
      title: "Saved to Talent Vault",
      description: `${char.name} is now available in your studio-wide roster for future movies.`,
      type: "success",
    });
  };

  const handleImportFromVault = (char: ProjectCharacter) => {
    setRoster((prev) => [...prev, { ...char }]);
    toast.add({
      title: "Imported from Vault",
      description: `Added ${char.name} to this project's active cast.`,
      type: "success",
    });
  };

  const handleDeleteFromVault = (charName: string) => {
    deleteFromTalentVault(charName);
    setTalentVault(getTalentVault());
  };

  const handleAddNewCharacter = () => {
    const newChar: ProjectCharacter = {
      name: `Character ${roster.length + 1}`,
      role: "Key Ensemble",
      archetype: "Complex dramatic operator with private motivations",
      actorComp: "Talent Comp",
      speechStyle: "Naturalistic, guarded",
      subtextRatio: "high",
      confidence: 75,
      verbalPacing: 60,
      objective: "Resolve conflict without compromise",
      quirks: ["Keeps physical distance"],
    };
    const next = [...roster, newChar];
    setRoster(next);
    setSelectedCharIndex(next.length - 1);
  };

  const handleDeleteCharacter = (idx: number) => {
    if (roster.length <= 1) return;
    const next = roster.filter((_, i) => i !== idx);
    setRoster(next);
    setSelectedCharIndex(0);
  };

  // Run Chemistry Bench simulation
  const handleSimulateChemistry = async () => {
    const partner = roster[chemistryPartnerIdx];
    if (!activeChar || !partner || isSimulatingChemistry) return;

    setIsSimulatingChemistry(true);
    setChemistrySceneResult(null);

    try {
      const res = await fetch("/api/character/chemistry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          char_a: {
            name: activeChar.name,
            archetype: activeChar.archetype,
            speech_style: activeChar.speechStyle || "naturalistic",
            subtext_ratio: activeChar.subtextRatio || "high",
          },
          char_b: {
            name: partner.name,
            archetype: partner.archetype,
            speech_style: partner.speechStyle || "calculated",
            subtext_ratio: partner.subtextRatio || "extreme",
          },
          scenario: "High-friction standoff in an enclosed space with ticking timeline.",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        notifyIfFallback(data, "Chemistry Bench");
        setChemistrySceneResult(data.screenplay_snippet || data.dialogue || data.scene_text);
      } else {
        toast.add({
          title: "Chemistry Bench Failed",
          description: "Could not simulate impromptu scene.",
          type: "error",
        });
      }
    } catch (err) {
      console.error("Chemistry bench error:", err);
      toast.add({
        title: "Chemistry Bench Failed",
        description: "Could not reach the agent-service backend.",
        type: "error",
      });
    } finally {
      setIsSimulatingChemistry(false);
    }
  };

  // Run Dialogue Cadence Tuning
  const handleTuneDialogue = async () => {
    if (!sampleLine.trim() || isTuningDialogue) return;
    setIsTuningDialogue(true);
    setTunedDialogueResult(null);

    try {
      const res = await fetch("/api/character/tune", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          character_name: activeChar.name,
          speech_style:
            (activeChar.verbalPacing ?? 50) > 65
              ? "Rapid-fire staccato cadence with clipped phrasing"
              : "Measured, icy cadence with pregnant pauses",
          subtext_ratio:
            activeChar.subtextRatio === "extreme"
              ? "Heavy subtext, words conceal the real danger"
              : "Direct, guarded",
          raw_dialogue: sampleLine,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        notifyIfFallback(data, "Dialogue Tuning");
        setTunedDialogueResult(data.tuned_dialogue || data.dialogue);
      } else {
        toast.add({
          title: "Dialogue Tuning Failed",
          description: "Could not tune the sample line.",
          type: "error",
        });
      }
    } catch (err) {
      console.error("Dialogue tune error:", err);
      toast.add({
        title: "Dialogue Tuning Failed",
        description: "Could not reach the agent-service backend.",
        type: "error",
      });
    } finally {
      setIsTuningDialogue(false);
    }
  };

  // Re-comp Actor with Gemini based on character dials
  const handleRecompActor = async () => {
    if (isRecompingActor || !activeChar) return;
    setIsRecompingActor(true);
    try {
      const res = await fetch("/api/character/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: activeChar.name,
          base_archetype: activeChar.archetype,
          dream_actor: activeChar.actorComp || "",
          personality_dials: {
            confidence: (activeChar.confidence || 75) / 100,
            verbal_speed: (activeChar.verbalPacing ?? 50) > 65 ? "rapid-staccato" : "measured-deliberate",
            subtext_ratio: activeChar.subtextRatio || "high",
          },
          behavioral_tics: activeChar.quirks || [],
          additional_notes: `Role: ${activeChar.role || "Lead"}. Objective: ${activeChar.objective || ""}`,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        handleUpdateActiveChar({
          actorComp: data.dream_actor_comp || activeChar.actorComp,
          castingReasoning: data.casting_reasoning,
          alternateCastingComp: data.alternate_casting_comp,
        });
        notifyIfFallback(data, "Actor Comp Synthesis");
        toast.add({
          title: "Casting Comp Synthesized",
          description: `Comp grounded in ${activeChar.name}'s psychological dials.`,
          type: "success",
        });
      } else {
        toast.add({
          title: "Casting Comp Failed",
          description: "Could not synthesize casting comp.",
          type: "error",
        });
      }
    } catch (err) {
      console.error("Failed to recomp actor:", err);
      toast.add({
        title: "Casting Comp Failed",
        description: err instanceof Error ? err.message : "Backend unavailable.",
        type: "error",
      });
    } finally {
      setIsRecompingActor(false);
    }
  };

  // Generate Character Face / Portrait via Imagen 3 / Gemini Image
  const handleGenerateFace = async () => {
    if (!activeChar || isGeneratingFace) return;
    setIsGeneratingFace(true);

    try {
      const prompt = `Cinematic 85mm portrait, close-up headshot, single subject: ${activeChar.name}. ${
        activeChar.visualDescription || activeChar.archetype
      }. Dramatic chiaroscuro rim lighting, sharp cinematic features, shallow depth of field, photorealistic skin texture, neutral out-of-focus background, no text or watermarks, no distorted features.`;

      const res = await fetch("/api/media/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          aspect_ratio: "1:1",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.image_url) {
          handleUpdateActiveChar({ imageUrl: data.image_url });
          saveLocalAsset({
            id: `char-face-${activeChar.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${Date.now()}`,
            name: `${activeChar.name} — Face Portrait`,
            type: "image",
            category: "character_face",
            url: data.image_url,
            sizeBytes: 0,
            mimeType: "image/png",
            tags: ["face", activeChar.name.toLowerCase(), "character", "ai-generated"],
            metadata: {
              characterName: activeChar.name,
              actorComp: activeChar.actorComp,
            },
            createdAt: Date.now(),
          });
          toast.add({
            title: "Face Portrait Generated",
            description: `Rendered cinematic face portrait for ${activeChar.name}.`,
            type: "success",
          });
        }
      } else {
        toast.add({
          title: "Generation Failed",
          description: "Could not generate face portrait.",
          type: "error",
        });
      }
    } catch (err) {
      console.error("Face image generation error:", err);
      toast.add({
        title: "Generation Failed",
        description: "Error communicating with image generator.",
        type: "error",
      });
    } finally {
      setIsGeneratingFace(false);
    }
  };

  // Generate Full-Body Character Silhouette & Wardrobe via Imagen 3 / Gemini Image
  const handleGenerateFullBody = async () => {
    if (!activeChar || isGeneratingBody) return;
    setIsGeneratingBody(true);

    try {
      const prompt = `Full-length character concept art, head-to-toe, single subject standing in a neutral studio pose: ${activeChar.name}. ${
        activeChar.wardrobe ? `Wearing ${activeChar.wardrobe}. ` : ""
      }${
        activeChar.visualDescription || activeChar.archetype
      }. Dramatic volumetric studio rim lighting, detailed clothing and fabric texture, plain neutral background, costume design reference sheet quality, no text or watermarks, no cropped limbs.`;

      const res = await fetch("/api/media/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          aspect_ratio: "9:16",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.image_url) {
          handleUpdateActiveChar({ fullBodyImageUrl: data.image_url });
          saveLocalAsset({
            id: `char-body-${activeChar.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${Date.now()}`,
            name: `${activeChar.name} — Wardrobe & Stance`,
            type: "image",
            category: "character_body",
            url: data.image_url,
            sizeBytes: 0,
            mimeType: "image/png",
            tags: ["wardrobe", "full-body", activeChar.name.toLowerCase(), "character", "ai-generated"],
            metadata: {
              characterName: activeChar.name,
              wardrobe: activeChar.wardrobe,
            },
            createdAt: Date.now(),
          });
          toast.add({
            title: "Full-Body Look Generated",
            description: `Rendered full-body stance and wardrobe for ${activeChar.name}.`,
            type: "success",
          });
        }
      } else {
        toast.add({
          title: "Generation Failed",
          description: "Could not generate full body look.",
          type: "error",
        });
      }
    } catch (err) {
      console.error("Full body image generation error:", err);
      toast.add({
        title: "Generation Failed",
        description: "Error communicating with image generator.",
        type: "error",
      });
    } finally {
      setIsGeneratingBody(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleRequestClose}>
      <DialogContent className="max-w-4xl bg-[#0b0c10] border-border/80 p-0 overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="border-b border-border/70 bg-[#10121a] p-5 pb-4 shrink-0 flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                <Users className="h-4 w-4" />
              </div>
              <SlateLabel>Modular Character Lab · Casting Bench</SlateLabel>
            </div>
            <DialogTitle className="text-xl font-heading tracking-tight text-foreground">
              Character DNA Studio &amp; Talent Vault
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {projectTitle ? (
                <>Editing roster for <span className="text-foreground/80 font-semibold">{projectTitle}</span>. </>
              ) : null}
              Craft psychological profiles, test dream actor likenesses, simulate 2-character chemistry, and swap traits.
            </DialogDescription>
          </div>

          <div className="flex items-center gap-2">
            {hasUnsavedChanges && (
              <Badge
                variant="outline"
                className="border-amber-500/50 bg-amber-500/10 text-amber-400 font-mono text-[10px] animate-pulse"
              >
                Unsaved Changes
              </Badge>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleSaveToVault(activeChar)}
              className="text-xs h-8 gap-1.5 border-border text-muted-foreground hover:text-foreground"
              title="Save to reusable Studio Talent Vault"
            >
              <FolderDown className="h-3.5 w-3.5 text-accent" />
              <span>Save to Vault</span>
            </Button>
            <Button
              size="sm"
              onClick={handleSaveSlateCharacters}
              className="text-xs h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
            >
              <Save className="h-3.5 w-3.5" />
              <span>Save Changes</span>
            </Button>
            <Button
              size="icon-xs"
              variant="ghost"
              onClick={() => handleRequestClose(false)}
              className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer"
              title="Close Character Lab"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Body Layout: Left Character Nav, Right Workspace */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Left Column: Character List */}
          <div className="w-56 border-r border-border/70 bg-[#0d0e14] p-3 flex flex-col justify-between shrink-0">
            <div className="space-y-1.5 overflow-y-auto pr-1">
              <div className="flex items-center justify-between px-1.5 py-1 text-[10px] font-mono uppercase text-muted-foreground">
                <span>Active Cast ({roster.length})</span>
                <button
                  type="button"
                  onClick={handleAddNewCharacter}
                  className="text-accent hover:underline flex items-center gap-0.5 text-[11px]"
                >
                  <Plus className="h-3 w-3" /> add
                </button>
              </div>

              {roster.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelectedCharIndex(i)}
                  className={`w-full p-2 rounded-lg text-left text-xs transition-all flex items-center justify-between group ${
                    selectedCharIndex === i
                      ? "bg-secondary text-foreground border border-accent/40 shadow-xs"
                      : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {c.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.imageUrl}
                        alt={c.name}
                        className="h-6 w-6 rounded-full object-cover border border-accent/50 shrink-0"
                      />
                    ) : (
                      <div
                        className={`h-6 w-6 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${
                          selectedCharIndex === i
                            ? "bg-accent/20 text-accent border border-accent/40"
                            : "bg-secondary text-muted-foreground"
                        }`}
                      >
                        {c.name.charAt(0)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <span className="font-semibold block truncate text-xs">{c.name}</span>
                        {c.imageUrl && (
                          <span className="h-1.5 w-1.5 rounded-full bg-accent inline-block shrink-0" title="Has visual look" />
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground block truncate">
                        {c.role || "Cast"}
                      </span>
                    </div>
                  </div>
                </button>
              ))}

              <div className="pt-3">
                <button
                  type="button"
                  onClick={() => setActiveTab("vault")}
                  className={`w-full p-2 rounded-lg text-left text-xs transition-all flex items-center gap-2 ${
                    activeTab === "vault"
                      ? "bg-accent/15 border border-accent/30 text-accent font-medium"
                      : "text-muted-foreground hover:bg-secondary/30 hover:text-foreground border border-border/40"
                  }`}
                >
                  <FolderDown className="h-3.5 w-3.5" />
                  <span>Talent Vault ({talentVault.length})</span>
                </button>
              </div>
            </div>

            <div className="pt-3 border-t border-border/60 space-y-1.5">
              {onSendToVideo && activeChar && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onSendToVideo(activeChar)}
                  className="w-full text-xs h-8 gap-1.5 border-purple-500/40 text-purple-300 hover:bg-purple-500/10 cursor-pointer"
                  title="Condition Gemini Omni Flash with this character's look"
                >
                  <Video className="h-3.5 w-3.5 text-purple-400" />
                  <span>Pre-viz in Omni Flash</span>
                </Button>
              )}

              {onOpenHotSeat && activeChar && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onOpenHotSeat(activeChar.name)}
                  className="w-full text-xs h-8 gap-1.5 border-accent/40 text-accent hover:bg-accent/10 cursor-pointer"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>Hot-Seat Chat</span>
                </Button>
              )}
            </div>
          </div>

          {/* Right Column: Workshop Area */}
          <div className="flex-1 flex flex-col min-w-0 bg-[#090a0d] overflow-y-auto p-5">
            {/* Sub-Tabs */}
            <div className="flex items-center gap-2 border-b border-border/70 pb-3 mb-4 shrink-0 overflow-x-auto">
              {[
                { id: "visual", label: "Visual Look & Concept", icon: Eye },
                { id: "dna", label: "Character DNA", icon: UserCheck },
                { id: "dials", label: "Trait Dials & Cadence", icon: Sliders },
                { id: "actor", label: "Dream Actor & Comps", icon: Sparkles },
                { id: "chemistry", label: "Chemistry Bench", icon: Flame },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                      activeTab === tab.id
                        ? "bg-secondary text-foreground border border-border shadow-xs"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/30"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 text-accent" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* TAB 0: VISUAL LOOK & CONCEPT ART (Face + Full Body) */}
            {activeTab === "visual" && (
              <div className="space-y-4 animate-in fade-in-50 duration-150">
                {/* Omni Flash Direct Pipeline Banner */}
                <div className="p-3.5 rounded-xl border border-purple-500/30 bg-purple-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-inner">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Video className="h-4 w-4 text-purple-400" />
                      <span className="text-xs font-bold text-foreground">
                        Gemini Omni Flash Visual Conditioning Deck
                      </span>
                      <Badge variant="outline" className="text-[9px] border-purple-500/40 text-purple-300 font-mono py-0">
                        Omni Flash Ready
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Condition camera choreography and motion diffusion with {activeChar.name}&apos;s face likeness, wardrobe textures, and physical demeanor.
                    </p>
                  </div>

                  {onSendToVideo && (
                    <Button
                      size="sm"
                      onClick={() => onSendToVideo(activeChar)}
                      className="text-xs h-8 gap-1.5 bg-purple-600 hover:bg-purple-500 text-white font-medium shrink-0 cursor-pointer shadow-md"
                    >
                      <Film className="h-3.5 w-3.5" />
                      <span>Pre-viz in Gemini Omni Flash</span>
                    </Button>
                  )}
                </div>

                {/* Dual Visual Concept Art Viewport: Face Headshot (1:1) & Full-Body Stance (9:16) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 1. Face / Close-up Headshot */}
                  <div className="p-4 rounded-xl border border-border/80 bg-secondary/20 flex flex-col justify-between space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Eye className="h-3.5 w-3.5 text-accent" />
                        <span className="text-xs font-bold text-foreground">Face &amp; Close-Up Headshot</span>
                      </div>
                      <Badge variant="outline" className="text-[10px] font-mono border-accent/40 text-accent py-0">
                        1:1 Portrait · 85mm
                      </Badge>
                    </div>

                    {/* Visual Frame */}
                    <div className="relative aspect-square w-full rounded-lg overflow-hidden border border-border bg-black/60 flex items-center justify-center group shadow-inner">
                      {activeChar.imageUrl ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={activeChar.imageUrl}
                            alt={`${activeChar.name} portrait`}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-3 pointer-events-none">
                            <span className="text-[10px] font-mono text-white/90">
                              {activeChar.name} · Face
                            </span>
                            <div className="flex items-center gap-1.5 pointer-events-auto">
                              <Button
                                size="icon-xs"
                                variant="secondary"
                                onClick={() =>
                                  setPreviewModal({
                                    url: activeChar.imageUrl!,
                                    title: `${activeChar.name} — Face Portrait`,
                                    subtitle: activeChar.visualDescription || "85mm Anamorphic Headshot",
                                  })
                                }
                                className="h-7 w-7 text-white bg-black/60 hover:bg-black/90 cursor-pointer"
                                title="View Full Resolution"
                              >
                                <Maximize2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="icon-xs"
                                variant="secondary"
                                onClick={handleGenerateFace}
                                disabled={isGeneratingFace}
                                className="h-7 w-7 text-white bg-black/60 hover:bg-black/90 cursor-pointer"
                                title="Regenerate Face Portrait"
                              >
                                <RefreshCw className={`h-3.5 w-3.5 ${isGeneratingFace ? "animate-spin" : ""}`} />
                              </Button>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="p-6 text-center space-y-2 flex flex-col items-center justify-center">
                          <div className="h-12 w-12 rounded-full bg-secondary/40 border border-border flex items-center justify-center text-muted-foreground">
                            <Eye className="h-6 w-6" />
                          </div>
                          <div className="space-y-0.5">
                            <span className="text-xs font-medium text-foreground block">No Face Portrait Rendered</span>
                            <span className="text-[10px] text-muted-foreground block max-w-[200px]">
                              Click below to synthesize a photoreal 85mm cinematic headshot via Imagen 3.
                            </span>
                          </div>
                        </div>
                      )}

                      {isGeneratingFace && (
                        <div className="absolute inset-0 bg-black/85 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-center space-y-2 z-10">
                          <RefreshCw className="h-6 w-6 text-accent animate-spin" />
                          <span className="text-xs font-semibold text-foreground">Conditioning Imagen 3...</span>
                          <span className="text-[10px] font-mono text-accent">Synthesizing 85mm facial chiaroscuro</span>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        size="sm"
                        onClick={handleGenerateFace}
                        disabled={isGeneratingFace}
                        className="text-xs h-8 gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90 font-semibold cursor-pointer shadow-xs"
                      >
                        {isGeneratingFace ? (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5" />
                        )}
                        <span>{isGeneratingFace ? "Generating..." : "Generate AI"}</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setAssetPickerTarget("face")}
                        className="text-xs h-8 gap-1.5 border-border hover:bg-secondary cursor-pointer font-medium"
                      >
                        <Upload className="h-3.5 w-3.5 text-accent" />
                        <span>Upload / Hub</span>
                      </Button>
                    </div>
                  </div>

                  {/* 2. Full-Body Stance & Wardrobe */}
                  <div className="p-4 rounded-xl border border-border/80 bg-secondary/20 flex flex-col justify-between space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Shirt className="h-3.5 w-3.5 text-cyan-400" />
                        <span className="text-xs font-bold text-foreground">Full-Body Stance &amp; Wardrobe</span>
                      </div>
                      <Badge variant="outline" className="text-[10px] font-mono border-cyan-500/40 text-cyan-400 py-0">
                        9:16 Full Length · Silhouette
                      </Badge>
                    </div>

                    {/* Visual Frame */}
                    <div className="relative aspect-square w-full rounded-lg overflow-hidden border border-border bg-black/60 flex items-center justify-center group shadow-inner">
                      {activeChar.fullBodyImageUrl ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={activeChar.fullBodyImageUrl}
                            alt={`${activeChar.name} full body`}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-3 pointer-events-none">
                            <span className="text-[10px] font-mono text-white/90">
                              {activeChar.name} · Full Stance
                            </span>
                            <div className="flex items-center gap-1.5 pointer-events-auto">
                              <Button
                                size="icon-xs"
                                variant="secondary"
                                onClick={() =>
                                  setPreviewModal({
                                    url: activeChar.fullBodyImageUrl!,
                                    title: `${activeChar.name} — Full-Body Stance & Wardrobe`,
                                    subtitle: activeChar.wardrobe || "Full Length Silhouette",
                                  })
                                }
                                className="h-7 w-7 text-white bg-black/60 hover:bg-black/90 cursor-pointer"
                                title="View Full Resolution"
                              >
                                <Maximize2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="icon-xs"
                                variant="secondary"
                                onClick={handleGenerateFullBody}
                                disabled={isGeneratingBody}
                                className="h-7 w-7 text-white bg-black/60 hover:bg-black/90 cursor-pointer"
                                title="Regenerate Full-Body Stance"
                              >
                                <RefreshCw className={`h-3.5 w-3.5 ${isGeneratingBody ? "animate-spin" : ""}`} />
                              </Button>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="p-6 text-center space-y-2 flex flex-col items-center justify-center">
                          <div className="h-12 w-12 rounded-full bg-secondary/40 border border-border flex items-center justify-center text-muted-foreground">
                            <Shirt className="h-6 w-6" />
                          </div>
                          <div className="space-y-0.5">
                            <span className="text-xs font-medium text-foreground block">No Full-Body Look Rendered</span>
                            <span className="text-[10px] text-muted-foreground block max-w-[200px]">
                              Click below to synthesize a full-length costume &amp; stance concept frame.
                            </span>
                          </div>
                        </div>
                      )}

                      {isGeneratingBody && (
                        <div className="absolute inset-0 bg-black/85 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-center space-y-2 z-10">
                          <RefreshCw className="h-6 w-6 text-cyan-400 animate-spin" />
                          <span className="text-xs font-semibold text-foreground">Conditioning Imagen 3...</span>
                          <span className="text-[10px] font-mono text-cyan-400">Synthesizing wardrobe &amp; posture</span>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        size="sm"
                        onClick={handleGenerateFullBody}
                        disabled={isGeneratingBody}
                        className="text-xs h-8 gap-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold cursor-pointer shadow-xs"
                      >
                        {isGeneratingBody ? (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5" />
                        )}
                        <span>{isGeneratingBody ? "Generating..." : "Generate AI"}</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setAssetPickerTarget("body")}
                        className="text-xs h-8 gap-1.5 border-border hover:bg-secondary cursor-pointer font-medium"
                      >
                        <Upload className="h-3.5 w-3.5 text-cyan-400" />
                        <span>Upload / Hub</span>
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Conditioning Metadata Editors */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  {/* Visual Facial & Physical Features */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-foreground block uppercase font-mono tracking-wider">
                      Facial Features &amp; Physical Demeanor
                    </label>
                    <textarea
                      rows={3}
                      value={activeChar.visualDescription || ""}
                      onChange={(e) => handleUpdateActiveChar({ visualDescription: e.target.value })}
                      placeholder="e.g. Mid-30s, sharp jawline, nervous sweat glistening on brow, intense piercing gaze, 85mm rim lighting..."
                      className="w-full rounded-lg border border-border bg-secondary/20 p-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent resize-none placeholder:text-muted-foreground leading-relaxed"
                    />
                    <div className="flex flex-wrap gap-1">
                      {[
                        "+ Anamorphic Rim Light",
                        "+ Sharp Angular Jaw",
                        "+ Nervous Sweat / Intense",
                        "+ Weathered Stubble",
                        "+ Cold Penetrating Eyes",
                      ].map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => {
                            const cur = activeChar.visualDescription || "";
                            handleUpdateActiveChar({
                              visualDescription: cur ? `${cur}, ${tag.replace("+ ", "")}` : tag.replace("+ ", ""),
                            });
                          }}
                          className="text-[10px] font-mono px-2 py-0.5 rounded bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground border border-border/60 transition-colors cursor-pointer"
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Costume & Wardrobe Design */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-foreground block uppercase font-mono tracking-wider">
                      Costume &amp; Wardrobe Design
                    </label>
                    <textarea
                      rows={3}
                      value={activeChar.wardrobe || ""}
                      onChange={(e) => handleUpdateActiveChar({ wardrobe: e.target.value })}
                      placeholder="e.g. Tailored charcoal wool trench coat, matte black turtleneck, tactical harness, combat boots, steel chronograph..."
                      className="w-full rounded-lg border border-border bg-secondary/20 p-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent resize-none placeholder:text-muted-foreground leading-relaxed"
                    />
                    <div className="flex flex-wrap gap-1">
                      {[
                        "+ Charcoal Trench Coat",
                        "+ Tactical Harness",
                        "+ Black Turtleneck",
                        "+ Distressed Bomber",
                        "+ Steel Chronograph",
                      ].map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => {
                            const cur = activeChar.wardrobe || "";
                            handleUpdateActiveChar({
                              wardrobe: cur ? `${cur}, ${tag.replace("+ ", "")}` : tag.replace("+ ", ""),
                            });
                          }}
                          className="text-[10px] font-mono px-2 py-0.5 rounded bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground border border-border/60 transition-colors cursor-pointer"
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Omni Flash Live Prompt Preview Card */}
                <div className="p-3.5 rounded-xl border border-border/80 bg-secondary/15 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-foreground font-mono uppercase tracking-wider flex items-center gap-1.5">
                      <Film className="h-3.5 w-3.5 text-purple-400" />
                      Gemini Omni Flash Prompt Conditioning Synthesis
                    </span>
                    <span className="text-[10px] font-mono text-purple-300">Live Camera Injector</span>
                  </div>
                  <div className="rounded-lg bg-black/60 p-2.5 border border-border font-mono text-[11px] text-muted-foreground leading-relaxed">
                    <span className="text-purple-300 font-semibold">[Character Identity]:</span> {activeChar.name}
                    {activeChar.actorComp ? ` (Likeness: ${activeChar.actorComp})` : ""}
                    <br />
                    <span className="text-purple-300 font-semibold">[Wardrobe Staging]:</span> {activeChar.wardrobe || "Standard cinematic costume"}
                    <br />
                    <span className="text-purple-300 font-semibold">[Facial Expression]:</span> {activeChar.visualDescription || "Dramatic tension"}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 1: CHARACTER DNA */}
            {activeTab === "dna" && (
              <div className="space-y-4 animate-in fade-in-50 duration-150">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">
                      Character Full Name
                    </label>
                    <Input
                      value={activeChar.name}
                      onChange={(e) => handleUpdateActiveChar({ name: e.target.value })}
                      className="text-xs h-8 bg-secondary/20"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">
                      Dramatic Role
                    </label>
                    <Input
                      value={activeChar.role || ""}
                      onChange={(e) => handleUpdateActiveChar({ role: e.target.value })}
                      placeholder="e.g. Lead Protagonist, Reluctant Accomplice..."
                      className="text-xs h-8 bg-secondary/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">
                    Archetype &amp; Core Motivation
                  </label>
                  <textarea
                    value={activeChar.archetype}
                    onChange={(e) => handleUpdateActiveChar({ archetype: e.target.value })}
                    rows={2}
                    className="w-full rounded-lg border border-border bg-secondary/20 px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-accent resize-none text-foreground"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">
                      Active Scene Objective
                    </label>
                    <Input
                      value={activeChar.objective || ""}
                      onChange={(e) => handleUpdateActiveChar({ objective: e.target.value })}
                      placeholder="What are they desperately fighting to achieve right now?"
                      className="text-xs h-8 bg-secondary/20"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">
                      Subtext Ratio
                    </label>
                    <select
                      value={activeChar.subtextRatio || "high"}
                      onChange={(e) => handleUpdateActiveChar({ subtextRatio: e.target.value })}
                      className="h-8 w-full rounded border border-border bg-secondary/20 px-2 text-xs text-foreground focus:outline-none"
                    >
                      <option value="low">Low (Direct, literal, military)</option>
                      <option value="moderate">Moderate (Standard cinematic dialogue)</option>
                      <option value="high">High (Veiled threats, implicit tension)</option>
                      <option value="extreme">Extreme (Every sentence carries double-meaning)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">
                    Behavioral Tics &amp; Mannerisms
                  </label>
                  <Input
                    value={(activeChar.quirks || []).join(", ")}
                    onChange={(e) =>
                      handleUpdateActiveChar({
                        quirks: e.target.value.split(/[,;]+/).map((s) => s.trim()).filter(Boolean),
                      })
                    }
                    placeholder="e.g. Fidgets with silver lighter, checks chronograph, speaks in monotone..."
                    className="text-xs h-8 bg-secondary/20"
                  />
                </div>
              </div>
            )}

            {/* TAB 2: TRAIT DIALS & CADENCE */}
            {activeTab === "dials" && (
              <div className="space-y-4 animate-in fade-in-50 duration-150">
                <div className="p-3.5 rounded-xl border border-border/80 bg-secondary/20 space-y-3">
                  <span className="text-xs font-bold text-foreground block">
                    Modular Personality Dials
                  </span>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-muted-foreground">Confidence &amp; Dominance</span>
                      <span className="text-cyan-400 font-bold">{activeChar.confidence ?? 75}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={activeChar.confidence ?? 75}
                      onChange={(e) => handleUpdateActiveChar({ confidence: Number(e.target.value) })}
                      className="w-full accent-cyan-500 cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-muted-foreground">Verbal Pacing (Staccato ↔ Manic)</span>
                      <span className="text-cyan-400 font-bold">{activeChar.verbalPacing ?? 60}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={activeChar.verbalPacing ?? 60}
                      onChange={(e) => handleUpdateActiveChar({ verbalPacing: Number(e.target.value) })}
                      className="w-full accent-cyan-500 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Modular Archetype Presets */}
                <div>
                  <span className="text-xs font-semibold text-foreground block mb-2">
                    Quick Archetype Blends
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {ARCHETYPE_PRESETS.map((p, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() =>
                          handleUpdateActiveChar({
                            confidence: p.conf,
                            verbalPacing: p.spd,
                            subtextRatio: p.sub > 80 ? "extreme" : "high",
                          })
                        }
                        className="p-2.5 rounded-lg border border-border bg-secondary/20 hover:bg-secondary/40 text-left transition-all text-xs"
                      >
                        <span className="font-bold text-xs text-foreground block">{p.name}</span>
                        <span className="text-[10px] text-muted-foreground block mt-0.5">{p.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Live Cadence Tuning */}
                <div className="p-3.5 rounded-xl border border-cyan-500/30 bg-cyan-500/5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-cyan-400 flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5" />
                      Live Dialogue Cadence Tuner
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground">Gemini 3.7 Flash</span>
                  </div>
                  <Input
                    value={sampleLine}
                    onChange={(e) => setSampleLine(e.target.value)}
                    placeholder="Test dialogue line to polish into character cadence..."
                    className="text-xs h-8 bg-background"
                  />
                  <Button
                    size="sm"
                    onClick={handleTuneDialogue}
                    disabled={isTuningDialogue}
                    className="w-full text-xs h-7 bg-cyan-600 hover:bg-cyan-500 text-white"
                  >
                    {isTuningDialogue ? (
                      <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <Sliders className="h-3 w-3 mr-1" />
                    )}
                    <span>{isTuningDialogue ? "Tuning..." : "Tune to Character Voice"}</span>
                  </Button>
                  {tunedDialogueResult && (
                    <div className="rounded bg-background/80 p-2.5 text-xs italic font-serif text-cyan-200 border border-cyan-500/30">
                      &ldquo;{tunedDialogueResult}&rdquo;
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: DREAM ACTOR & COMPS */}
            {activeTab === "actor" && (
              <div className="space-y-4 animate-in fade-in-50 duration-150">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-bold text-foreground block">
                      Dream Actor Likeness
                    </label>
                    <p className="text-[11px] text-muted-foreground">
                      Reference actor for vocal tone, status posture, and visual likeness.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleRecompActor}
                    disabled={isRecompingActor}
                    className="text-xs h-7 gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90 font-medium"
                  >
                    {isRecompingActor ? (
                      <RefreshCw className="h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="h-3 w-3" />
                    )}
                    <span>{isRecompingActor ? "Synthesizing Comp..." : "AI Re-Comp (Gemini 3.7)"}</span>
                  </Button>
                </div>

                <Input
                  value={activeChar.actorComp || ""}
                  onChange={(e) => handleUpdateActiveChar({ actorComp: e.target.value })}
                  placeholder="e.g. Willem Dafoe (The Lighthouse), Florence Pugh (Oppenheimer)..."
                  className="text-xs h-8 bg-secondary/20 font-medium"
                />

                {activeChar.castingReasoning ? (
                  <div className="p-3.5 rounded-xl border border-accent/30 bg-accent/5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-accent flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5" />
                        Psychological Casting Rationale
                      </span>
                      <Badge variant="outline" className="text-[10px] font-mono text-accent border-accent/30">
                        Dial-Grounded
                      </Badge>
                    </div>
                    <p className="text-xs text-foreground/90 leading-relaxed">
                      {activeChar.castingReasoning}
                    </p>
                    <div className="text-[10px] font-mono text-muted-foreground pt-1 border-t border-accent/20 flex items-center justify-between">
                      <span>Grounded in {activeChar.confidence || 75}% Confidence • {activeChar.subtextRatio || "high"} Subtext</span>
                      <span>Gemini 3.7 Casting Agent</span>
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl border border-border/80 bg-secondary/20 text-xs text-muted-foreground space-y-1">
                    <span className="font-semibold text-foreground block">
                      Autonomous Performance Comping
                    </span>
                    <p className="text-[11px]">
                      Click <strong>AI Re-Comp</strong> to let Gemini 3.7 analyze {activeChar.name}&apos;s psychological dials ({activeChar.confidence || 75}% confidence, {activeChar.verbalPacing || 75}% pacing, {activeChar.subtextRatio || "high"} subtext) and propose an exact performance comp with psychological casting reasoning.
                    </p>
                  </div>
                )}

                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Alternate Contemporary Comp
                  </label>
                  <div className="flex gap-2">
                    <Input
                      value={activeChar.alternateCastingComp || ""}
                      onChange={(e) => handleUpdateActiveChar({ alternateCastingComp: e.target.value })}
                      placeholder="e.g. Ben Foster in Hell or High Water (gritty psychological resilience)..."
                      className="text-xs h-8 bg-secondary/20 flex-1"
                    />
                    {activeChar.alternateCastingComp && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const currentMain = activeChar.actorComp;
                          handleUpdateActiveChar({
                            actorComp: activeChar.alternateCastingComp,
                            alternateCastingComp: currentMain,
                          });
                          toast.add({
                            title: "Casting Comp Swapped",
                            description: `Promoted ${activeChar.alternateCastingComp} to primary likeness.`,
                            type: "success",
                          });
                        }}
                        className="text-xs h-8 text-xs font-mono shrink-0"
                      >
                        Swap Primary
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: CHEMISTRY BENCH */}
            {activeTab === "chemistry" && (
              <div className="space-y-4 animate-in fade-in-50 duration-150">
                <div className="p-3.5 rounded-xl border border-accent/40 bg-accent/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-accent flex items-center gap-1.5">
                      <Flame className="h-3.5 w-3.5" />
                      Impromptu 2-Character Chemistry Bench
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground">Screenplay Doctor</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Test the conversational tempo, power dynamics, and emotional friction between <strong>{activeChar.name}</strong> and a counterpart before drafting full scenes.
                  </p>

                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-foreground">Confront Against:</span>
                    <select
                      value={chemistryPartnerIdx}
                      onChange={(e) => setChemistryPartnerIdx(Number(e.target.value))}
                      className="h-8 rounded border border-border bg-background px-2 text-xs text-foreground focus:outline-none flex-1"
                    >
                      {roster.map((c, i) => (
                        <option key={i} value={i} disabled={i === selectedCharIndex}>
                          {c.name} ({c.role || "Cast"})
                        </option>
                      ))}
                    </select>
                  </div>

                  <Button
                    size="sm"
                    onClick={handleSimulateChemistry}
                    disabled={isSimulatingChemistry}
                    className="w-full text-xs h-8 bg-accent text-accent-foreground hover:bg-accent/90 font-medium"
                  >
                    {isSimulatingChemistry ? (
                      <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <Sparkles className="h-3 w-3 mr-1" />
                    )}
                    <span>
                      {isSimulatingChemistry
                        ? "Simulating Confrontation..."
                        : `Simulate ${activeChar.name} vs ${roster[chemistryPartnerIdx]?.name || "Partner"} Scene`}
                    </span>
                  </Button>
                </div>

                {chemistrySceneResult && (
                  <div className="p-4 rounded-xl border border-border bg-black font-mono text-xs text-foreground/90 whitespace-pre-wrap max-h-80 overflow-y-auto leading-relaxed">
                    {chemistrySceneResult}
                  </div>
                )}
              </div>
            )}

            {/* TAB 5: TALENT VAULT */}
            {activeTab === "vault" && (
              <div className="space-y-4 animate-in fade-in-50 duration-150">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">
                    Studio Talent Vault ({talentVault.length} Reusable Characters)
                  </span>
                </div>

                {talentVault.length === 0 ? (
                  <div className="p-6 rounded-xl border border-dashed border-border/80 text-center text-xs text-muted-foreground">
                    No characters saved to your Talent Vault yet. Click &ldquo;Save to Vault&rdquo; on any character to make them reusable across your studio slate.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {talentVault.map((c, i) => (
                      <div
                        key={i}
                        className="p-3 rounded-lg border border-border bg-secondary/20 flex items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-foreground">{c.name}</span>
                            <Badge variant="outline" className="text-[10px] py-0">
                              {c.role || "Talent"}
                            </Badge>
                            {c.actorComp && (
                              <span className="text-[10px] font-mono text-cyan-400">
                                {c.actorComp}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{c.archetype}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleImportFromVault(c)}
                            className="text-xs h-7 gap-1"
                          >
                            <UserPlus className="h-3 w-3" />
                            <span>Import</span>
                          </Button>
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            onClick={() => handleDeleteFromVault(c.name)}
                            className="h-7 w-7 text-muted-foreground hover:text-rose-400"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>

      {/* Lightbox / Full Resolution Image Inspection Modal */}
      {previewModal && (
        <Dialog open={Boolean(previewModal)} onOpenChange={() => setPreviewModal(null)}>
          <DialogContent className="max-w-2xl bg-black border-border/80 p-4 flex flex-col items-center justify-center shadow-2xl">
            <div className="flex items-center justify-between w-full mb-3 border-b border-border/60 pb-2">
              <div>
                <DialogTitle className="text-sm font-bold text-foreground">{previewModal.title}</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">{previewModal.subtitle}</DialogDescription>
              </div>
            </div>
            <div className="relative max-h-[75vh] w-full flex items-center justify-center overflow-hidden rounded-lg bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewModal.url}
                alt={previewModal.title}
                className="max-h-[70vh] w-auto object-contain rounded-md shadow-2xl"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Unsaved Changes Confirmation Modal */}
      <AlertDialog open={showUnsavedPrompt} onOpenChange={setShowUnsavedPrompt}>
        <AlertDialogContent className="bg-[#10121a] border-border text-foreground max-w-md shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-heading font-bold text-foreground">
              Unsaved Character Changes
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
              You have modified character profiles in the Character Lab. If you exit now without saving, these changes will be discarded.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-row items-center justify-end gap-2 pt-2">
            <AlertDialogCancel
              onClick={() => setShowUnsavedPrompt(false)}
              className="text-xs h-8 cursor-pointer"
            >
              Keep Editing
            </AlertDialogCancel>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDiscardAndClose}
              className="text-xs h-8 cursor-pointer"
            >
              Discard Edits
            </Button>
            <Button
              size="sm"
              onClick={handleSaveAndClose}
              className="text-xs h-8 bg-emerald-600 hover:bg-emerald-500 text-white font-medium cursor-pointer"
            >
              Save &amp; Close
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Character Visual Asset Picker Modal */}
      <AssetPickerModal
        open={Boolean(assetPickerTarget)}
        onOpenChange={(open) => !open && setAssetPickerTarget(null)}
        title={
          assetPickerTarget === "face"
            ? `Select Portrait Headshot for ${activeChar?.name || "Character"}`
            : `Select Full-Body Stance & Wardrobe for ${activeChar?.name || "Character"}`
        }
        description="Link an uploaded reference photo or actor likeness comp directly to this character profile."
        acceptedTypes={["image"]}
        acceptedCategories={
          assetPickerTarget === "face"
            ? ["character_face", "general", "style"]
            : ["character_body", "general", "style"]
        }
        onSelectAsset={(asset) => {
          if (assetPickerTarget === "face") {
            handleUpdateActiveChar({ imageUrl: asset.url });
            toast.add({
              title: "Character Portrait Linked",
              description: `Linked "${asset.name}" as ${activeChar?.name || "character"}'s face.`,
              type: "success",
            });
          } else if (assetPickerTarget === "body") {
            handleUpdateActiveChar({ fullBodyImageUrl: asset.url });
            toast.add({
              title: "Character Stance Linked",
              description: `Linked "${asset.name}" as ${activeChar?.name || "character"}'s full-body look.`,
              type: "success",
            });
          }
          setAssetPickerTarget(null);
        }}
      />
    </Dialog>
  );
}
