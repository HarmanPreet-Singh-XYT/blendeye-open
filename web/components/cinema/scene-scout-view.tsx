"use client";

import * as React from "react";
import {
  type FilmScene,
  type LocationCandidate,
  type SupportedCurrency,
} from "@/lib/project-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { notifyIfFallback } from "@/lib/fallback-notice";
import { cn } from "@/lib/utils";
import {
  MapPin,
  Building2,
  Image as ImageIcon,
  Sparkles,
  Camera,
  Layers,
  RotateCcw,
  Check,
  Star,
  Download,
  Maximize2,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  DollarSign,
  Lock,
  Unlock,
  Clapperboard,
  Sliders,
  Film,
  Video,
  Eye,
  Loader2,
  Compass,
  FileText,
  Copy,
  Plus,
  Trash2,
  Zap,
  Upload,
} from "lucide-react";
import { AssetPickerModal } from "@/components/cinema/asset-picker-modal";
import { saveLocalAsset } from "@/lib/asset-store";
import {
  LOCATION_STYLE_PRESETS,
  LOCATION_CAMERA_FRAMINGS,
  cleanCandidateName,
} from "@/components/cinema/location-board";
import { LocationDossierDialog } from "@/components/cinema/location-dossier-dialog";

export interface SceneScoutViewProps {
  projectId?: string;
  scenes?: FilmScene[];
  activeSceneId?: string;
  onSelectScene?: (sceneId: string) => void;
  onUpdateScene?: (updatedScene: FilmScene) => void;
  onLinkToVideo?: (imageUrl: string, promptInfo: string) => void;
  currency?: SupportedCurrency;
}

export function SceneScoutView({
  projectId,
  scenes = [],
  activeSceneId,
  onSelectScene,
  onUpdateScene,
  onLinkToVideo,
  currency = "USD",
}: SceneScoutViewProps) {
  // Current Active Scene
  const [currentSceneId, setCurrentSceneId] = React.useState<string>(
    activeSceneId || scenes[0]?.id || "scene-1"
  );

  React.useEffect(() => {
    if (activeSceneId) {
      setCurrentSceneId(activeSceneId);
    }
  }, [activeSceneId]);

  const activeScene =
    scenes.find((s) => s.id === currentSceneId) || scenes[0] || null;

  // Selected Location Candidate from Scene
  const candidates = activeScene?.locationCandidates || [];
  const lockedCandidate = candidates.find(
    (c) => c.candidate_id === activeScene?.selectedLocationCandidateId
  );

  const isFallbackHero =
    !lockedCandidate?.preview_image_url &&
    !activeScene?.preview_image_url &&
    !candidates[0]?.preview_image_url;

  // Active Concept Look Image (either selected candidate preview, scene master keyframe, or custom generation)
  const defaultInitialImage =
    lockedCandidate?.preview_image_url ||
    activeScene?.preview_image_url ||
    candidates[0]?.preview_image_url ||
    "/cinema/scenes/scene_1_storyboard_accretion.jpg";

  const [heroImage, setHeroImage] = React.useState<string>(defaultInitialImage);
  const [heroPrompt, setHeroPrompt] = React.useState<string>("");
  const [heroTitle, setHeroTitle] = React.useState<string>(
    lockedCandidate?.name || activeScene?.location || "Scene Concept Look"
  );

  // Sync hero image if scene changes
  React.useEffect(() => {
    if (activeScene) {
      const topImg =
        lockedCandidate?.preview_image_url ||
        activeScene.preview_image_url ||
        candidates[0]?.preview_image_url ||
        "/cinema/scenes/scene_1_storyboard_accretion.jpg";
      setHeroImage(topImg);
      setHeroTitle(lockedCandidate?.name || activeScene.location || activeScene.title);
      setHeroPrompt(
        lockedCandidate?.preview_image_prompt ||
          `Cinematic 35mm anamorphic wide establishing shot of ${activeScene.location || activeScene.title}. ${activeScene.slugline}. Moody volumetric lighting, photoreal, master cinematography.`
      );
    }
  }, [activeScene?.id, lockedCandidate?.candidate_id]);

  // Generation Controls
  const [stylePresetId, setStylePresetId] = React.useState<string>(
    LOCATION_STYLE_PRESETS[0].id
  );
  const [cameraFramingId, setCameraFramingId] = React.useState<string>(
    LOCATION_CAMERA_FRAMINGS[0].id
  );
  const [aspectRatio, setAspectRatio] = React.useState<"16:9" | "9:16">("16:9");
  const [customPrompt, setCustomPrompt] = React.useState<string>("");
  const [isGenerating, setIsGenerating] = React.useState<boolean>(false);
  const [lightboxOpen, setLightboxOpen] = React.useState<boolean>(false);
  const [isAssetPickerOpen, setIsAssetPickerOpen] = React.useState<boolean>(false);

  // Location Dossier Modal
  const [dossierCandidate, setDossierCandidate] = React.useState<LocationCandidate | null>(null);
  const [isDossierOpen, setIsDossierOpen] = React.useState<boolean>(false);

  // Initialize prompt when scene changes
  React.useEffect(() => {
    if (activeScene) {
      const locName = lockedCandidate?.name || activeScene.location || "Urban Metropolitan Setting";
      const region = lockedCandidate?.region || activeScene.shootRegion || "Production Base";
      const preset = LOCATION_STYLE_PRESETS.find((p) => p.id === stylePresetId);
      const framing = LOCATION_CAMERA_FRAMINGS.find((f) => f.id === cameraFramingId);

      setCustomPrompt(
        `${framing?.promptModifier || "Wide establishing shot"} of ${locName} in ${region}. ${activeScene.slugline}. ${activeScene.summary}. ${preset?.promptModifier || "35mm anamorphic film, volumetric haze, cinematic lighting"}. Photoreal, high dynamic range.`
      );
    }
  }, [activeScene?.id, stylePresetId, cameraFramingId]);


  // Multi-Image Generation Controls
  const [batchCount, setBatchCount] = React.useState<number>(1);
  const [coverageMode, setCoverageMode] = React.useState<"multi_angle" | "variations">("multi_angle");
  const [generatingProgress, setGeneratingProgress] = React.useState<{
    current: number;
    total: number;
    stageName: string;
  } | null>(null);

  // Generate Multiple Scene / Location Images with Imagen 3
  const handleGenerateImages = async (
    countOverride?: number,
    modeOverride?: "multi_angle" | "variations"
  ) => {
    if (!activeScene || isGenerating) return;
    const count = Math.min(4, Math.max(1, countOverride ?? batchCount));
    const mode = modeOverride ?? coverageMode;
    const locName = lockedCandidate?.name || activeScene.location || activeScene.title || "Scene Location";
    const region = lockedCandidate?.region || activeScene.shootRegion || "Production Base";
    const preset = LOCATION_STYLE_PRESETS.find((p) => p.id === stylePresetId);

    setIsGenerating(true);
    const newImgEntries: Array<{
      id: string;
      url: string;
      prompt: string;
      createdAt: number;
      title: string;
      source: "location";
    }> = [];

    try {
      for (let i = 0; i < count; i++) {
        let framingToUse =
          LOCATION_CAMERA_FRAMINGS.find((f) => f.id === cameraFramingId) ||
          LOCATION_CAMERA_FRAMINGS[0];
        let titleSuffix = `Look ${i + 1}`;

        if (mode === "multi_angle" && count > 1) {
          framingToUse = LOCATION_CAMERA_FRAMINGS[i % LOCATION_CAMERA_FRAMINGS.length];
          titleSuffix = framingToUse.name;
        } else if (count > 1) {
          titleSuffix = `Take ${i + 1} (${framingToUse.name.split(" ")[0]})`;
        }

        const promptToUse =
          mode === "multi_angle" && count > 1
            ? `${framingToUse.promptModifier} of ${locName} in ${region}. ${activeScene.slugline}. ${activeScene.summary}. ${preset?.promptModifier || "35mm anamorphic film, volumetric haze, cinematic lighting"}. Photoreal master cinematography.`
            : (customPrompt.trim() || `Cinematic establishing frame of ${locName}, ${activeScene.slugline}. Master Hollywood lighting.`) +
              (i > 0 ? ` (Camera angle take ${i + 1}, dynamic volumetric lighting shift)` : "");

        setGeneratingProgress({
          current: i + 1,
          total: count,
          stageName: titleSuffix,
        });

        const res = await fetch("/api/media/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: promptToUse,
            aspect_ratio: aspectRatio,
          }),
        });

        if (res.ok) {
          const result = await res.json();
          if (result.image_url) {
            newImgEntries.push({
              id: `img-${Date.now()}-${i}`,
              url: result.image_url,
              prompt: promptToUse,
              createdAt: Date.now() + i * 10,
              title: `${locName} — ${titleSuffix}`,
              source: "location" as const,
            });
            notifyIfFallback(result, `Location Shot: ${titleSuffix}`);
          }
        }
      }

      if (newImgEntries.length > 0) {
        setHeroImage(newImgEntries[0].url);
        setHeroPrompt(newImgEntries[0].prompt);
        setHeroTitle(newImgEntries[0].title);

        // Auto-register scouted plates in Asset Hub under 'location' category
        newImgEntries.forEach((entry) => {
          saveLocalAsset({
            id: entry.id,
            name: entry.title || `${locName} — Scout Plate`,
            type: "image",
            category: "location",
            url: entry.url,
            sizeBytes: 0,
            mimeType: "image/png",
            tags: ["location", "plate", locName.toLowerCase(), "scout"],
            metadata: {
              prompt: entry.prompt,
              locationName: locName,
            },
            createdAt: entry.createdAt || Date.now(),
          });
        });

        const existingImgs = activeScene.sceneImages || [];

        // Also update candidate gallery_images if a candidate is locked or active
        let updatedCandidates = activeScene.locationCandidates;
        if (lockedCandidate && activeScene.locationCandidates) {
          updatedCandidates = activeScene.locationCandidates.map((c) => {
            if (c.candidate_id === lockedCandidate.candidate_id) {
              const existingGallery = c.gallery_images || [];
              return {
                ...c,
                preview_image_url: c.preview_image_url || newImgEntries[0].url,
                gallery_images: [...newImgEntries, ...existingGallery],
              };
            }
            return c;
          });
        }

        const updatedScene: FilmScene = {
          ...activeScene,
          sceneImages: [...newImgEntries, ...existingImgs],
          preview_image_url: activeScene.preview_image_url || newImgEntries[0].url,
          locationCandidates: updatedCandidates,
        };

        onUpdateScene?.(updatedScene);

        toast.add({
          title: count > 1 ? `${newImgEntries.length} Location Angles Synthesized` : "Location Visual Rendered",
          description: `Generated cinematic coverage for "${cleanCandidateName(locName)}".`,
          type: "success",
        });
      } else {
        toast.add({
          title: "Generation failed",
          description: "No images could be synthesized. Please verify connectivity.",
          type: "error",
        });
      }
    } catch (err) {
      console.error("Multi-image location generation error:", err);
      toast.add({
        title: "Generation error",
        description: err instanceof Error ? err.message : "Failed to synthesize location images.",
        type: "error",
      });
    } finally {
      setIsGenerating(false);
      setGeneratingProgress(null);
    }
  };

  // Convenience wrapper for single or configured generation run
  const handleGenerateImage = () => handleGenerateImages(batchCount, coverageMode);

  // Delete an individual generated scene image
  const handleDeleteSceneImage = (imgId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!activeScene) return;
    const deletedImg = (activeScene.sceneImages || []).find((im) => im.id === imgId);
    const remaining = (activeScene.sceneImages || []).filter((im) => im.id !== imgId);
    const updatedScene: FilmScene = {
      ...activeScene,
      sceneImages: remaining,
      preview_image_url:
        deletedImg && activeScene.preview_image_url === deletedImg.url
          ? remaining[0]?.url
          : activeScene.preview_image_url,
    };
    onUpdateScene?.(updatedScene);
    if (deletedImg && heroImage === deletedImg.url) {
      setHeroImage(remaining[0]?.url || candidates[0]?.preview_image_url || defaultInitialImage);
    }
    toast.add({
      title: "Look Removed",
      description: "Visual frame removed from location gallery.",
      type: "info",
    });
  };

  // Delete / Dismiss Candidate Location from Scene
  const handleDeleteCandidate = (candId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!activeScene) return;

    const remaining = (activeScene.locationCandidates || []).filter((c) => c.candidate_id !== candId);
    const updatedScene: FilmScene = {
      ...activeScene,
      selectedLocationCandidateId:
        activeScene.selectedLocationCandidateId === candId ? undefined : activeScene.selectedLocationCandidateId,
      locationCandidates: remaining,
    };
    onUpdateScene?.(updatedScene);

    const deletedCand = candidates.find((c) => c.candidate_id === candId);
    if (deletedCand && heroImage === deletedCand.preview_image_url) {
      setHeroImage(remaining[0]?.preview_image_url || activeScene.sceneImages?.[0]?.url || defaultInitialImage);
    }

    toast.add({
      title: "Candidate Dismissed",
      description: "Venue removed from scene scout candidates.",
      type: "info",
    });
  };

  // Set as Scene Master Keyframe
  const handleSetMasterKeyframe = (url: string) => {
    if (!activeScene) return;
    const updatedScene: FilmScene = {
      ...activeScene,
      preview_image_url: url,
    };
    onUpdateScene?.(updatedScene);
    toast.add({
      title: "Master Keyframe Set",
      description: `Scene ${activeScene.sceneNumber} primary visual updated.`,
      type: "success",
    });
  };

  // Link to the video generator for reference conditioning
  const handleLinkToVideo = (imgUrl: string, promptText: string) => {
    if (onLinkToVideo) {
      onLinkToVideo(imgUrl, promptText);
      toast.add({
        title: "🎬 Linked to Gemini Omni Flash",
        description: "Scene image set as reference conditioning for cinematic video generation.",
        type: "success",
      });
    }
  };

  // Prompt Context Injection Chips
  const appendPromptContext = (addition: string) => {
    setCustomPrompt((prev) => `${prev.trim()} ${addition}`);
  };

  return (
    <div className="flex flex-1 flex-col h-full min-h-0 bg-background overflow-hidden">
      {/* Main Workstation Grid */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Side: Cinema Hero Monitor & Actions (~55-60%) */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-border bg-background/50 overflow-y-auto">
          {/* Hero Monitor Viewport */}
          <div className="p-4 sm:p-6 flex flex-col items-center justify-center flex-1 min-h-0 relative">
            <div
              className={cn(
                "w-full max-w-4xl rounded-xl bg-black border border-border/80 shadow-2xl overflow-hidden relative flex flex-col items-center justify-center group transition-all duration-300",
                aspectRatio === "9:16" ? "max-w-xs aspect-[9/16]" : "aspect-video"
              )}
            >
              {/* Concept Image */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={heroImage}
                alt={heroTitle}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-102"
              />

              {/* Idle fallback watermark disclosure */}
              {isFallbackHero && (
                <div className="absolute top-3 left-3 pointer-events-none group-hover:opacity-0 transition-opacity z-10">
                  <Badge variant="outline" className="border-cyan-500/40 bg-black/80 text-cyan-300 font-mono text-[10px] backdrop-blur-xs">
                    Starter Look Frame · Generate or Scout to Customize
                  </Badge>
                </div>
              )}

              {/* Cinema Scope Letterbox Gradient Overlays */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/60 opacity-0 group-hover:opacity-100 transition-opacity p-4 flex flex-col justify-between pointer-events-none">
                {/* Top Overlay Strip */}
                <div className="flex items-center justify-between pointer-events-auto">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-amber-400/60 bg-black/80 text-amber-300 font-mono text-[10px]">
                      {activeScene?.slugline || "SCENE CONCEPT FRAME"}
                    </Badge>
                    {isFallbackHero && (
                      <Badge variant="outline" className="border-cyan-400/60 bg-cyan-950/80 text-cyan-300 font-mono text-[10px]">
                        STARTER PLACEHOLDER
                      </Badge>
                    )}
                    <span className="text-xs text-white/90 font-medium">{heroTitle}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setLightboxOpen(true)}
                      className="p-1.5 rounded-md bg-black/70 hover:bg-black text-white/90 hover:text-white transition-colors border border-white/20 cursor-pointer"
                      title="Inspect Full-Res Lightbox"
                    >
                      <Maximize2 className="h-3.5 w-3.5" />
                    </button>
                    <a href={heroImage} download={`scene_${activeScene?.sceneNumber}_concept.jpg`} target="_blank" rel="noreferrer">
                      <button
                        type="button"
                        className="p-1.5 rounded-md bg-black/70 hover:bg-black text-white/90 hover:text-white transition-colors border border-white/20 cursor-pointer"
                        title="Download Image"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>
                    </a>
                  </div>
                </div>

                {/* Bottom Overlay Strip */}
                <div className="pointer-events-auto flex flex-col gap-2">
                  <p className="text-xs text-white/90 font-sans line-clamp-2 italic bg-black/60 p-2 rounded backdrop-blur-xs border border-white/10">
                    &ldquo;{heroPrompt || customPrompt}&rdquo;
                  </p>
                </div>
              </div>

              {/* Generating Overlay */}
              {isGenerating && (
                <div className="absolute inset-0 bg-black/85 backdrop-blur-xs flex flex-col items-center justify-center gap-3 z-30 p-6">
                  <Loader2 className="h-8 w-8 text-amber-400 animate-spin" />
                  <div className="text-center max-w-sm">
                    <span className="text-sm font-heading font-semibold text-foreground block">
                      {generatingProgress && generatingProgress.total > 1
                        ? `Synthesizing Angle ${generatingProgress.current} of ${generatingProgress.total}...`
                        : "Rendering Concept Frame..."}
                    </span>
                    <span className="text-xs font-mono text-amber-400/90 block mt-1">
                      {generatingProgress?.stageName || "Imagen 3 High-Fidelity Photoreal Synthesis"}
                    </span>
                    {generatingProgress && generatingProgress.total > 1 && (
                      <div className="w-48 h-1.5 bg-white/10 rounded-full mx-auto mt-3 overflow-hidden">
                        <div
                          className="h-full bg-amber-500 rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.round((generatingProgress.current / generatingProgress.total) * 100)}%`,
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Quick Action Control Bar under the Hero Monitor */}
            <div className="w-full max-w-4xl mt-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {/* PRIMARY CTA: LINK AS VIDEO REFERENCE */}
                <Button
                  size="sm"
                  onClick={() => handleLinkToVideo(heroImage, heroPrompt || customPrompt)}
                  className="h-8 gap-1.5 bg-purple-600 text-white hover:bg-purple-500 font-semibold cursor-pointer shadow-sm text-xs"
                  title="Use this exact image to condition Gemini Omni Flash video generation"
                >
                  <Video className="h-3.5 w-3.5 text-purple-200" />
                  <span>Link Image as Video Reference</span>
                </Button>

                {/* Set as Scene Master Keyframe */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSetMasterKeyframe(heroImage)}
                  className="h-8 gap-1.5 border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 text-xs cursor-pointer"
                  title="Pin this visual as the primary thumbnail across Scene Studio and Scripts"
                >
                  <Star className="h-3.5 w-3.5 text-amber-400" />
                  <span>Set as Scene Keyframe</span>
                </Button>

                {/* Delete Current Look Button if it's a user-generated scene image */}
                {activeScene?.sceneImages?.some((im) => im.url === heroImage) && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      const found = activeScene.sceneImages?.find((im) => im.url === heroImage);
                      if (found) handleDeleteSceneImage(found.id, e);
                    }}
                    className="h-8 gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10 text-xs cursor-pointer"
                    title="Delete current visual frame from lookbook"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete Look</span>
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Multi-Angle Quick Shot */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleGenerateImages(3, "multi_angle")}
                  disabled={isGenerating}
                  className="h-8 gap-1.5 border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 text-xs cursor-pointer"
                  title="Generate 3 multi-camera angles (Wide Master, Low Angle, Eye Level) for this location"
                >
                  <Zap className="h-3.5 w-3.5 text-amber-400" />
                  <span>3 Angles</span>
                </Button>

                {/* Inspect Venue Dossier */}
                {(lockedCandidate || candidates[0]) && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setDossierCandidate(lockedCandidate || candidates[0]);
                      setIsDossierOpen(true);
                    }}
                    className="h-8 gap-1.5 border-border bg-secondary/40 hover:bg-secondary text-xs cursor-pointer"
                  >
                    <FileText className="h-3.5 w-3.5 text-accent" />
                    <span>Venue Specs Dossier</span>
                  </Button>
                )}

                {/* Re-roll */}
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleGenerateImage}
                  disabled={isGenerating}
                  className="h-8 gap-1.5 text-xs cursor-pointer"
                >
                  <RotateCcw className={cn("h-3.5 w-3.5", isGenerating && "animate-spin")} />
                  <span>Re-roll Look</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Bottom Scouted Gallery / Lookbook Filmstrip */}
          <div className="h-36 shrink-0 border-t border-border bg-card/60 px-4 py-2 flex flex-col justify-between overflow-hidden">
            <div className="flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Layers className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-xs font-heading font-semibold uppercase tracking-wider text-foreground">
                  Lookbook Reel &amp; Candidates
                </span>
                <Badge variant="outline" className="text-[10px] font-mono border-amber-500/30 text-amber-300">
                  {candidates.length + (activeScene?.sceneImages?.filter((img) => !candidates.some((c) => c.preview_image_url === img.url)).length || 0)} Visuals
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsAssetPickerOpen(true)}
                  className="h-6 px-2 text-[10px] font-mono border-border hover:border-accent/40 text-accent hover:bg-accent/10 gap-1 cursor-pointer"
                  title="Import a location reference plate or blueprint from your Asset Hub"
                >
                  <Upload className="h-3 w-3" />
                  <span>Import Plate / Hub</span>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleGenerateImages(3, "multi_angle")}
                  disabled={isGenerating}
                  className="h-6 px-2 text-[10px] font-mono text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 gap-1 cursor-pointer"
                  title="Generate 3 multi-camera angles (Wide Master, Low Angle, Eye Level) for this location"
                >
                  <Zap className="h-3 w-3" />
                  <span>+3 Angles Coverage</span>
                </Button>
                <span className="hidden sm:inline text-[10px] font-mono text-muted-foreground">
                  Click any look to preview on hero monitor
                </span>
              </div>
            </div>

            {/* Horizontal Thumbnails Filmstrip */}
            <div className="flex-1 min-h-0 flex items-center gap-2.5 overflow-x-auto pb-0.5 scrollbar-thin">
              {/* 1. Scouted Venue Candidates */}
              {candidates.map((cand) => {
                const isCurrentHero = heroImage === cand.preview_image_url;
                const isLocked = activeScene?.selectedLocationCandidateId === cand.candidate_id;
                const thumbUrl =
                  cand.preview_image_url ||
                  "/cinema/scenes/scene_1_storyboard_accretion.jpg";

                return (
                  <div
                    key={cand.candidate_id}
                    onClick={() => {
                      setHeroImage(thumbUrl);
                      setHeroTitle(cand.name);
                      setHeroPrompt(cand.preview_image_prompt || cand.practical_notes);
                    }}
                    className={cn(
                      "w-48 shrink-0 rounded-lg border bg-card/90 overflow-hidden cursor-pointer transition-all duration-200 group flex flex-col",
                      isCurrentHero
                        ? "border-amber-500 ring-2 ring-amber-500/50 bg-amber-500/10 shadow-md"
                        : "border-border/80 hover:border-amber-500/40 hover:bg-secondary/40"
                    )}
                  >
                    {/* Widescreen 16:9 Thumbnail */}
                    <div className="relative h-18 w-full bg-black overflow-hidden shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={thumbUrl}
                        alt={cand.name}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute top-1 left-1 z-10">
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-[8px] font-mono py-0 px-1.5 bg-black/85 backdrop-blur-xs border",
                            isLocked
                              ? "text-amber-300 border-amber-500/50"
                              : "text-white/90 border-white/20"
                          )}
                        >
                          {isLocked ? "🔒 Locked" : "Scouted"}
                        </Badge>
                      </div>
                      {/* Dismiss Candidate Button */}
                      {!isLocked && (
                        <div className="absolute top-1 right-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={(e) => handleDeleteCandidate(cand.candidate_id, e)}
                            className="p-1 rounded bg-black/80 hover:bg-destructive/80 text-muted-foreground hover:text-white transition-colors cursor-pointer border border-white/10"
                            title="Dismiss location candidate"
                          >
                            <Trash2 className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      )}
                      <div className="absolute bottom-1 right-1 z-10">
                        <span className="text-[9px] font-mono font-bold bg-black/85 backdrop-blur-xs text-emerald-400 px-1 rounded border border-emerald-500/30">
                          ${(cand.estimated_cost?.day_rate || 2500).toLocaleString()}/d
                        </span>
                      </div>
                    </div>

                    {/* Metadata Header */}
                    <div className="px-2 py-1 bg-card/95 flex items-center justify-between min-w-0 border-t border-border/40">
                      <span className="font-heading font-medium text-[11px] truncate text-foreground group-hover:text-amber-400 transition-colors">
                        {cleanCandidateName(cand.name)}
                      </span>
                      <span className="text-[9px] font-mono text-muted-foreground shrink-0 ml-1.5">
                        {cand.region?.split(",")[0] || "Set"}
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* 2. User-Generated Scene Images (deduplicated — skip any already shown as a candidate preview) */}
              {activeScene?.sceneImages
                ?.filter((img) => !candidates.some((c) => c.preview_image_url === img.url))
                .map((img) => {
                const isCurrentHero = heroImage === img.url;
                const isMasterKeyframe = activeScene.preview_image_url === img.url;

                return (
                  <div
                    key={img.id}
                    onClick={() => {
                      setHeroImage(img.url);
                      setHeroTitle(img.title || activeScene.title);
                      setHeroPrompt(img.prompt);
                    }}
                    className={cn(
                      "w-48 shrink-0 rounded-lg border bg-card/90 overflow-hidden cursor-pointer transition-all duration-200 group flex flex-col",
                      isCurrentHero
                        ? "border-amber-500 ring-2 ring-amber-500/50 bg-amber-500/10 shadow-md"
                        : "border-border/80 hover:border-amber-500/40 hover:bg-secondary/40"
                    )}
                  >
                    {/* Widescreen 16:9 Thumbnail */}
                    <div className="relative h-18 w-full bg-black overflow-hidden shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.url}
                        alt={img.title || "Scene Frame"}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute top-1 left-1 z-10">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[8px] font-mono py-0 px-1.5 bg-black/85 backdrop-blur-xs border",
                            isMasterKeyframe
                              ? "text-amber-300 border-amber-400/50"
                              : "text-purple-300 border-purple-500/40"
                          )}
                        >
                          {isMasterKeyframe ? "⭐ Keyframe" : "Imagen 3"}
                        </Badge>
                      </div>
                      {/* Delete Look Button */}
                      <div className="absolute top-1 right-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={(e) => handleDeleteSceneImage(img.id, e)}
                          className="p-1 rounded bg-black/80 hover:bg-destructive/80 text-muted-foreground hover:text-white transition-colors cursor-pointer border border-white/10"
                          title="Remove image from gallery"
                        >
                          <Trash2 className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    </div>

                    {/* Metadata Header */}
                    <div className="px-2 py-1 bg-card/95 flex items-center justify-between min-w-0 border-t border-border/40">
                      <span className="font-heading font-medium text-[11px] truncate text-foreground group-hover:text-purple-300 transition-colors">
                        {img.title || "Custom Look"}
                      </span>
                      <span className="text-[9px] font-mono text-muted-foreground shrink-0 ml-1.5">
                        {new Date(img.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* 3. Render New Look Quick Action Tile */}
              <button
                type="button"
                onClick={() => handleGenerateImages(batchCount, coverageMode)}
                disabled={isGenerating}
                className="w-40 h-[96px] shrink-0 rounded-lg border-2 border-dashed border-border/80 hover:border-amber-500/60 hover:bg-amber-500/5 p-2 flex flex-col items-center justify-center text-center cursor-pointer transition-all group gap-1"
                title="Synthesize location visual coverage with Imagen 3"
              >
                <div className="p-1 rounded-full bg-amber-500/10 group-hover:bg-amber-500/20 text-amber-400 transition-colors">
                  {isGenerating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                </div>
                <span className="text-[11px] font-heading font-semibold text-foreground group-hover:text-amber-400 transition-colors">
                  {batchCount > 1 ? `Render ${batchCount} Angles` : "Render New Look"}
                </span>
                <span className="text-[9px] font-mono text-muted-foreground">
                  {batchCount > 1 ? "Multi-Cam Coverage" : "Imagen 3 Photoreal"}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Concept Image Studio & Prompt Controls (~40-45%) */}
        <div className="w-[380px] xl:w-[440px] shrink-0 flex flex-col bg-card/60 overflow-y-auto p-4 gap-4">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-amber-400" />
              <h3 className="text-xs font-heading font-bold uppercase tracking-wider text-foreground">
                Scene Visual Synthesizer
              </h3>
            </div>
            <Badge variant="outline" className="text-[10px] font-mono border-amber-500/30 text-amber-400">
              Photoreal 35mm
            </Badge>
          </div>

          {/* Active Scene Context Summary */}
          {activeScene && (
            <div className="rounded-xl border border-border/80 bg-background/60 p-3 flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground">
                <span className="font-bold text-foreground">Scene {activeScene.sceneNumber}: {activeScene.title}</span>
                <span>{activeScene.durationSeconds || 180}s</span>
              </div>
              <div className="text-[11px] font-mono text-amber-400 font-semibold truncate">
                {activeScene.slugline || "INT. SCENE LOCATION - TIME"}
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                {activeScene.summary || "Dramatic conflict & story stakes."}
              </p>

              {/* Locked Venue Information */}
              {lockedCandidate && (
                <div className="mt-1 pt-1.5 border-t border-border/40 flex items-center justify-between text-[11px] font-mono">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Lock className="h-3 w-3 text-amber-400" /> Locked Venue:
                  </span>
                  <span className="text-foreground font-semibold truncate max-w-[180px]">
                    {lockedCandidate.name}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Visual Concept Prompt Box */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-heading font-semibold text-foreground">
                Visual Concept Prompt
              </label>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(customPrompt);
                  toast.add({ title: "Copied", description: "Prompt copied to clipboard.", type: "success" });
                }}
                className="text-[10px] font-mono text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
              >
                <Copy className="h-3 w-3" /> Copy
              </button>
            </div>
            <Textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              rows={4}
              placeholder="Describe the visual composition, lighting, camera framing, atmospheric textures..."
              className="font-mono text-xs leading-relaxed resize-none bg-background/80 border-border"
            />

            {/* Smart Context Injection Chips */}
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => appendPromptContext("Arri Alexa 65, 35mm Panavision anamorphic lens, subtle cyan flares.")}
                className="px-2 py-0.5 rounded bg-secondary/80 hover:bg-secondary text-[10px] font-mono text-muted-foreground hover:text-foreground border border-border/50 cursor-pointer"
              >
                + Panavision Lens
              </button>
              <button
                type="button"
                onClick={() => appendPromptContext("Deep chiaroscuro shadows, high contrast rim lighting, atmospheric haze.")}
                className="px-2 py-0.5 rounded bg-secondary/80 hover:bg-secondary text-[10px] font-mono text-muted-foreground hover:text-foreground border border-border/50 cursor-pointer"
              >
                + Chiaroscuro Haze
              </button>
              <button
                type="button"
                onClick={() => appendPromptContext("Wet rain-slicked asphalt, sodium vapor street reflections.")}
                className="px-2 py-0.5 rounded bg-secondary/80 hover:bg-secondary text-[10px] font-mono text-muted-foreground hover:text-foreground border border-border/50 cursor-pointer"
              >
                + Rain &amp; Reflections
              </button>
              {lockedCandidate?.stage_specs?.sound_rating && (
                <button
                  type="button"
                  onClick={() => appendPromptContext(`Certified ${lockedCandidate.stage_specs?.sound_rating} soundstage setting.`)}
                  className="px-2 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-[10px] font-mono text-amber-300 border border-amber-500/30 cursor-pointer"
                >
                  + Venue Specs
                </button>
              )}
            </div>
          </div>

          {/* Cinematography Style Presets */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-heading font-semibold text-foreground flex items-center justify-between">
              <span>Cinematic Lighting &amp; Aesthetic</span>
              <span className="text-[10px] font-mono text-muted-foreground">Color Grading</span>
            </label>
            <div className="grid grid-cols-1 gap-1.5">
              {LOCATION_STYLE_PRESETS.map((preset) => {
                const isSelected = stylePresetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setStylePresetId(preset.id)}
                    className={cn(
                      "p-2 rounded-lg border text-left transition-all cursor-pointer flex flex-col gap-0.5",
                      isSelected
                        ? "border-amber-500 bg-amber-500/10 ring-1 ring-amber-500/30"
                        : "border-border bg-secondary/30 hover:bg-secondary/70 text-muted-foreground"
                    )}
                  >
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className={isSelected ? "text-amber-400 font-semibold" : "text-foreground"}>
                        {preset.name}
                      </span>
                      {isSelected && <Check className="h-3.5 w-3.5 text-amber-400" />}
                    </div>
                    <span className="text-[10px] text-muted-foreground line-clamp-1">{preset.description}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Camera Framing & Angles */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-heading font-semibold text-foreground flex items-center justify-between">
              <span>Camera Framing &amp; Lens Axis</span>
              <span className="text-[10px] font-mono text-muted-foreground">Geometry</span>
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {LOCATION_CAMERA_FRAMINGS.map((framing) => {
                const isSelected = cameraFramingId === framing.id;
                return (
                  <button
                    key={framing.id}
                    type="button"
                    onClick={() => setCameraFramingId(framing.id)}
                    className={cn(
                      "p-2 rounded-lg border text-left transition-all cursor-pointer flex flex-col gap-0.5",
                      isSelected
                        ? "border-amber-500 bg-amber-500/10 ring-1 ring-amber-500/30"
                        : "border-border bg-secondary/30 hover:bg-secondary/70 text-muted-foreground"
                    )}
                  >
                    <span className={cn("text-xs font-medium truncate", isSelected ? "text-amber-400 font-semibold" : "text-foreground")}>
                      {framing.name}
                    </span>
                    <span className="text-[9px] text-muted-foreground line-clamp-1">{framing.description}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Aspect Ratio Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-heading font-semibold text-foreground">
              Canvas Aspect Ratio
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAspectRatio("16:9")}
                className={cn(
                  "py-2 px-3 rounded-lg border text-xs font-mono font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                  aspectRatio === "16:9"
                    ? "border-amber-500 bg-amber-500/15 text-amber-300 font-bold"
                    : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground"
                )}
              >
                <Film className="h-3.5 w-3.5" />
                <span>16:9 Widescreen</span>
              </button>
              <button
                type="button"
                onClick={() => setAspectRatio("9:16")}
                className={cn(
                  "py-2 px-3 rounded-lg border text-xs font-mono font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                  aspectRatio === "9:16"
                    ? "border-amber-500 bg-amber-500/15 text-amber-300 font-bold"
                    : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground"
                )}
              >
                <Sliders className="h-3.5 w-3.5" />
                <span>9:16 Mobile</span>
              </button>
            </div>
          </div>

          {/* Location Coverage & Batch Quantity Controls */}
          <div className="flex flex-col gap-2 pt-1 border-t border-border/60">
            <div className="flex items-center justify-between">
              <label className="text-xs font-heading font-semibold text-foreground flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-amber-400" />
                <span>Multi-Image Coverage</span>
              </label>
              <Badge variant="outline" className="text-[10px] font-mono border-amber-500/30 text-amber-300">
                {batchCount} {batchCount === 1 ? "Image" : "Angles"}
              </Badge>
            </div>

            {/* Quantity Selector: 1, 2, 3, 4 */}
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { count: 1, label: "1 Take" },
                { count: 2, label: "2 Angles" },
                { count: 3, label: "3 Angles" },
                { count: 4, label: "4 Coverage" },
              ].map(({ count, label }) => {
                const isSelected = batchCount === count;
                return (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setBatchCount(count)}
                    className={cn(
                      "py-1.5 px-1 rounded-md border text-[11px] font-mono transition-all text-center cursor-pointer",
                      isSelected
                        ? "border-amber-500 bg-amber-500/20 text-amber-300 font-bold"
                        : "border-border bg-secondary/30 text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Mode Selector (shown when batchCount > 1) */}
            {batchCount > 1 && (
              <div className="grid grid-cols-2 gap-1.5 mt-0.5">
                <button
                  type="button"
                  onClick={() => setCoverageMode("multi_angle")}
                  className={cn(
                    "py-1 px-2 rounded border text-[10px] font-medium transition-all text-left cursor-pointer",
                    coverageMode === "multi_angle"
                      ? "border-amber-500/80 bg-amber-500/15 text-amber-300 font-semibold"
                      : "border-border/60 bg-secondary/20 text-muted-foreground hover:text-foreground"
                  )}
                  title="Cycles through Wide 24mm, Low-Angle 18mm, Eye-Level 35mm, and Crane 50mm framings"
                >
                  <span className="block font-mono font-bold">Multi-Angle</span>
                  <span className="text-[9px] text-muted-foreground line-clamp-1">Cycle 4 camera angles</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCoverageMode("variations")}
                  className={cn(
                    "py-1 px-2 rounded border text-[10px] font-medium transition-all text-left cursor-pointer",
                    coverageMode === "variations"
                      ? "border-amber-500/80 bg-amber-500/15 text-amber-300 font-semibold"
                      : "border-border/60 bg-secondary/20 text-muted-foreground hover:text-foreground"
                  )}
                  title="Varies volumetric lighting and atmosphere while holding camera framing"
                >
                  <span className="block font-mono font-bold">Variations</span>
                  <span className="text-[9px] text-muted-foreground line-clamp-1">Atmosphere shifts</span>
                </button>
              </div>
            )}
          </div>

          {/* PRIMARY GENERATE BUTTON */}
          <div className="pt-2">
            <Button
              size="lg"
              onClick={() => handleGenerateImages(batchCount, coverageMode)}
              disabled={isGenerating}
              className="w-full h-11 gap-2 bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm cursor-pointer shadow-md"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>
                    {generatingProgress && generatingProgress.total > 1
                      ? `Synthesizing Angle ${generatingProgress.current} of ${generatingProgress.total}...`
                      : "Synthesizing Concept Image (Imagen 3)..."}
                  </span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>
                    {batchCount > 1
                      ? `Generate ${batchCount} Location Angles`
                      : "Generate Scene Concept Image"}
                  </span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Lightbox Modal */}
      {lightboxOpen && (
        <div
          onClick={() => setLightboxOpen(false)}
          className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4 backdrop-blur-md cursor-zoom-out"
        >
          <div className="relative max-w-6xl max-h-[90vh] flex flex-col items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={heroImage} alt={heroTitle} className="max-h-[85vh] max-w-full rounded-lg object-contain shadow-2xl" />
            <div className="mt-3 flex items-center gap-3">
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleLinkToVideo(heroImage, heroPrompt || customPrompt);
                  setLightboxOpen(false);
                }}
                className="bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs gap-1.5"
              >
                <Video className="h-3.5 w-3.5" />
                <span>Link to Video Reference</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSetMasterKeyframe(heroImage);
                }}
                className="border-amber-500 text-amber-300 text-xs gap-1.5"
              >
                <Star className="h-3.5 w-3.5" />
                <span>Set Master Keyframe</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Specs Dossier Dialog */}
      <LocationDossierDialog
        candidate={dossierCandidate}
        isOpen={isDossierOpen}
        onClose={() => setIsDossierOpen(false)}
        scene={activeScene || undefined}
        currency={currency}
        isLocked={Boolean(
          dossierCandidate &&
            activeScene?.selectedLocationCandidateId === dossierCandidate.candidate_id
        )}
        onLockCandidate={(cand) => {
          if (!activeScene) return;
          const updated: FilmScene = {
            ...activeScene,
            selectedLocationCandidateId: cand.candidate_id,
            location: cand.name,
          };
          onUpdateScene?.(updated);
        }}
        onUnlockCandidate={() => {
          if (!activeScene) return;
          const updated: FilmScene = {
            ...activeScene,
            selectedLocationCandidateId: undefined,
          };
          onUpdateScene?.(updated);
        }}
      />

      {/* Location Plate Asset Picker Modal */}
      <AssetPickerModal
        open={isAssetPickerOpen}
        onOpenChange={setIsAssetPickerOpen}
        title={`Import Location Plate for ${activeScene?.location || activeScene?.title || "Scene"}`}
        description="Choose an uploaded location scouting plate, architectural photo, or moodboard reference from your Asset Hub."
        acceptedTypes={["image"]}
        acceptedCategories={["location", "style", "general", "map"]}
        projectId={projectId}
        onSelectAsset={(asset) => {
          setHeroImage(asset.url);
          setHeroTitle(`${asset.name} (Imported)`);
          setHeroPrompt(`Scouted plate reference: ${asset.name}`);
          if (activeScene && onUpdateScene) {
            const newImg = {
              id: `scout-plate-${Date.now()}`,
              url: asset.url,
              prompt: `Scouted plate reference: ${asset.name}`,
              createdAt: Date.now(),
              title: asset.name,
              source: "location" as const,
            };
            const existing = activeScene.sceneImages || [];
            onUpdateScene({
              ...activeScene,
              preview_image_url: asset.url,
              sceneImages: [newImg, ...existing],
            });
          }
          toast.add({
            title: "Location Plate Linked",
            description: `"${asset.name}" set as active scene concept plate.`,
            type: "success",
          });
        }}
      />
    </div>
  );
}
