"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { notifyIfFallback } from "@/lib/fallback-notice";
import { SlateLabel } from "@/components/cinema/slate-label";
import {
  Video,
  Play,
  Pause,
  Download,
  Sparkles,
  Camera,
  Film,
  Maximize2,
  RefreshCw,
  Clock,
  User,
  Eye,
  Shirt,
  Wand2,
  Volume2,
  VolumeX,
  RotateCcw,
  Star,
  Trash2,
  Check,
  Layers,
  Upload,
} from "lucide-react";
import { AssetPickerModal } from "@/components/cinema/asset-picker-modal";
import { saveLocalAsset } from "@/lib/asset-store";
import type { Node } from "@xyflow/react";
import type { ProjectCharacter } from "@/lib/project-store";
import {
  getVideoTakes,
  saveVideoTake,
  setMasterVideoTake,
  deleteVideoTake,
  type VideoTake,
} from "@/lib/project-store";
import {
  synthesizeCinemaPrompt,
  type NodeContribution,
} from "@/lib/cinema-prompt-synthesizer";

interface VideoGenerationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sceneTitle: string;
  sceneSummary?: string;
  visualPrompt?: string;
  characters?: ProjectCharacter[];
  characterContext?: ProjectCharacter;
  activeCharacterName?: string;
  projectId?: string;
  sceneId?: string;
  onTakeCreated?: (take: VideoTake) => void;
  nodes?: Node[];
  screenplayText?: string;
  genre?: string;
}

const CAMERA_MOTIONS = [
  "Slow Cinematic Dolly In",
  "High Crane Overhead Sweep",
  "Handheld Gritty Tension",
  "35mm Anamorphic Tracking Shot",
  "Static Master Table View",
];

const STYLE_PRESETS = [
  "35mm Anamorphic Film, 2.39:1 Scope",
  "Neo-Noir Cyberpunk, Sodium Vapor & Rain",
  "70mm IMAX High-Contrast Master",
  "Gritty 16mm Indie Grain",
];

const RESOLUTIONS = [
  { id: "360p", label: "360p Draft" },
  { id: "720p", label: "720p Standard" },
  { id: "1080p", label: "1080p High" },
  { id: "4k", label: "4K Master" },
];

// Omni renders synchronously and a 4K clip can take several minutes, so the
// dialog polls well past the old 90s give-up budget.
const RENDER_POLL_INTERVAL_MS = 5000;
const RENDER_POLL_MAX_ATTEMPTS = 120;

export function VideoGenerationDialog({
  open,
  onOpenChange,
  sceneTitle,
  sceneSummary,
  visualPrompt,
  characters,
  characterContext,
  activeCharacterName,
  projectId,
  sceneId,
  onTakeCreated,
  nodes = [],
  screenplayText,
  genre,
}: VideoGenerationDialogProps) {
  const effectiveProjectId = projectId || "";

  const [selectedCharName, setSelectedCharName] = React.useState<string | null>(
    characterContext?.name || activeCharacterName || null
  );
  const [cameraMotion, setCameraMotion] = React.useState<string>(CAMERA_MOTIONS[0]);
  const [stylePreset, setStylePreset] = React.useState<string>(STYLE_PRESETS[0]);
  // Metadata only — Omni derives clip length from the prompt, not a parameter.
  const [durationSec, setDurationSec] = React.useState<number>(6);
  const [resolution, setResolution] = React.useState<string>("720p");
  const [customPrompt, setCustomPrompt] = React.useState<string>(
    visualPrompt ||
      `Cinematic establishing shot of ${sceneTitle}. Moody shadows, photoreal anamorphic lens, high dramatic tension.`
  );

  // Active conditioning image and contributing canvas nodes
  const [activeConditioningImage, setActiveConditioningImage] = React.useState<string | null>(null);
  const [activeImageType, setActiveImageType] = React.useState<"face" | "body" | "custom" | null>(null);
  const [conditioningCustomName, setConditioningCustomName] = React.useState<string | null>(null);
  const [isAssetPickerOpen, setIsAssetPickerOpen] = React.useState<boolean>(false);
  const [activeNodeContributions, setActiveNodeContributions] = React.useState<NodeContribution[]>([]);

  const [isGenerating, setIsGenerating] = React.useState<boolean>(false);
  const [generationStage, setGenerationStage] = React.useState<string>("");
  const [operationName, setOperationName] = React.useState<string | null>(null);
  const pollIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  // Persistent takes library for this project
  const [savedTakes, setSavedTakes] = React.useState<VideoTake[]>([]);
  const [activeTakeId, setActiveTakeId] = React.useState<string | null>(null);

  // Video playback controls state
  const [videoUrl, setVideoUrl] = React.useState<string>("/videos/vault_heist_take_01.mp4");
  const [isPlaying, setIsPlaying] = React.useState<boolean>(false);
  const [currentTime, setCurrentTime] = React.useState<number>(0);
  const [videoDuration, setVideoDuration] = React.useState<number>(6);
  const [isMuted, setIsMuted] = React.useState<boolean>(false);
  const [isLooping, setIsLooping] = React.useState<boolean>(true);

  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  const stopPolling = React.useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  // Stop any in-flight poll loop if the dialog unmounts or is closed mid-generation.
  React.useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  // Load project takes when dialog opens
  React.useEffect(() => {
    if (open) {
      const takes = getVideoTakes(effectiveProjectId);
      setSavedTakes(takes);
      if (takes.length > 0) {
        const masterTake = takes.find((t) => t.isMaster) || takes[0];
        setActiveTakeId(masterTake.id);
        setVideoUrl(masterTake.videoUrl);
      } else {
        const fallbackTake: VideoTake = {
          id: "take-initial",
          takeNumber: 1,
          title: `${sceneTitle} — Take 01`,
          cameraMotion: CAMERA_MOTIONS[0],
          stylePreset: STYLE_PRESETS[0],
          durationSec: 6,
          createdAt: Date.now(),
          videoUrl: "/videos/vault_heist_take_01.mp4",
          prompt: `Cinematic establishing shot of ${sceneTitle}.`,
          isMaster: true,
        };
        setSavedTakes([fallbackTake]);
        setActiveTakeId(fallbackTake.id);
        setVideoUrl(fallbackTake.videoUrl);
      }
    } else {
      stopPolling();
    }
  }, [open, effectiveProjectId, sceneTitle, stopPolling]);

  const activeChar =
    (characters || []).find((c) => c.name === selectedCharName) ||
    (characterContext?.name === selectedCharName ? characterContext : null);

  // Multi-node & character context synthesizer
  const runSynthesis = React.useCallback(
    (charName: string | null = selectedCharName, imgPref: "face" | "body" | "auto" = "auto") => {
      const res = synthesizeCinemaPrompt({
        nodes,
        characters,
        sceneTitle,
        sceneSummary,
        screenplayText,
        genre,
        focusCharacterName: charName,
        cameraMotion,
        stylePreset,
        imagePreference: imgPref,
      });

      setCustomPrompt(res.fullPrompt);
      setActiveNodeContributions(res.contributions);
      setActiveConditioningImage(res.conditioningImageUrl);
      setActiveImageType(res.conditioningImageType === "scene" ? null : res.conditioningImageType);
    },
    [nodes, characters, sceneTitle, sceneSummary, screenplayText, genre, cameraMotion, stylePreset, selectedCharName]
  );

  React.useEffect(() => {
    if (open) {
      if (characterContext) {
        setSelectedCharName(characterContext.name);
        runSynthesis(characterContext.name);
      } else if (activeCharacterName) {
        setSelectedCharName(activeCharacterName);
        runSynthesis(activeCharacterName);
      } else {
        runSynthesis(selectedCharName);
      }
    }
  }, [open, characterContext, activeCharacterName]);

  // Handle video generation via Gemini Omni Flash
  const handleGenerateVideo = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setGenerationStage("Conditioning Gemini Omni Flash motion vectors...");

    try {
      const fullPrompt = customPrompt.trim();
      const res = await fetch("/api/media/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: fullPrompt,
          aspect_ratio: "16:9",
          resolution,
          style_preset: stylePreset,
          image_url: activeConditioningImage || undefined,
          character_name: selectedCharName || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setOperationName(data.operation_name);

        if (data.video_url && data.status === "completed") {
          commitNewTake(data.video_url, data.interaction_id);
          setIsGenerating(false);
          setGenerationStage("");
          notifyIfFallback(data, "Video Render");
        } else {
          pollVideoStatus(data.operation_name);
        }
      } else {
        const detail = await res.text().catch(() => "");
        toast.add({
          title: "Video generation failed",
          description: detail || `Render request failed (${res.status}). Try again.`,
          type: "error",
        });
        setIsGenerating(false);
        setGenerationStage("");
      }
    } catch (err) {
      console.error("Video dispatch error:", err);
      toast.add({
        title: "Video generation failed",
        description: err instanceof Error ? err.message : "Could not reach the render backend.",
        type: "error",
      });
      setIsGenerating(false);
      setGenerationStage("");
    }
  };

  const pollVideoStatus = async (opName: string) => {
    setGenerationStage("Gemini Omni Flash synthesis: painting 16:9 frames...");
    let attempts = 0;
    stopPolling();
    pollIntervalRef.current = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch(`/api/media/video/status?operation_name=${encodeURIComponent(opName)}`);
        if (res.ok) {
          const statusData = await res.json();
          if (statusData.status === "completed" && statusData.video_url) {
            stopPolling();
            commitNewTake(statusData.video_url, statusData.interaction_id);
            setIsGenerating(false);
            setGenerationStage("");
            notifyIfFallback(statusData, "Video Render");
          } else if (statusData.status === "failed" || statusData.status === "error") {
            stopPolling();
            toast.add({
              title: "Video generation failed",
              description: statusData.error || "Omni reported a failed render.",
              type: "error",
            });
            setIsGenerating(false);
            setGenerationStage("");
          } else if (attempts > RENDER_POLL_MAX_ATTEMPTS) {
            stopPolling();
            toast.add({
              title: "Video generation timed out",
              description: "Omni didn't finish rendering in time. Try again, or check the agent-service logs.",
              type: "warning",
            });
            setIsGenerating(false);
            setGenerationStage("");
          }
        } else if (attempts > RENDER_POLL_MAX_ATTEMPTS) {
          stopPolling();
          toast.add({
            title: "Video generation timed out",
            description: "Couldn't confirm render status. Try again.",
            type: "warning",
          });
          setIsGenerating(false);
          setGenerationStage("");
        }
      } catch {
        stopPolling();
        toast.add({
          title: "Lost connection to render backend",
          description: "The status check failed. Try generating again.",
          type: "error",
        });
        setIsGenerating(false);
        setGenerationStage("");
      }
    }, RENDER_POLL_INTERVAL_MS);
  };

  // Permanently save a rendered take into the project store
  const commitNewTake = (url: string, interactionId?: string) => {
    const nextNum = savedTakes.length + 1;
    const newTake = saveVideoTake(effectiveProjectId, {
      title: `${sceneTitle} — Take ${String(nextNum).padStart(2, "0")}`,
      cameraMotion,
      stylePreset,
      durationSec,
      videoUrl: url,
      prompt: customPrompt,
      characterName: selectedCharName || undefined,
      sceneId: sceneId,
      interactionId,
      // Only the first take for this scene auto-becomes Master; later takes are
      // saved as alternates so a render never silently bumps the director's pick.
    });
    setSavedTakes((prev) => [newTake, ...prev]);
    setActiveTakeId(newTake.id);
    setVideoUrl(newTake.videoUrl);
    setCurrentTime(0);
    onTakeCreated?.(newTake);

    // Auto-register in Asset Hub under 'video' category
    saveLocalAsset({
      id: newTake.id,
      name: newTake.title,
      type: "video",
      category: "video",
      url: newTake.videoUrl,
      sizeBytes: 0,
      mimeType: "video/mp4",
      tags: ["omni-flash", "video-take", "take"],
      metadata: {
        cameraMotion,
        stylePreset,
        durationSec,
        prompt: customPrompt,
        characterName: selectedCharName,
      },
      createdAt: Date.now(),
    });

    toast.add({
      title: `Take #${nextNum} Saved to Project Vault`,
      description: newTake.isMaster
        ? "Video file saved to disk and set as Master Scene Take."
        : "Video file saved to disk as an alternate take. Use \"Set as Master\" to promote it.",
      type: "success",
    });
  };

  const handleSelectTake = (take: VideoTake) => {
    setActiveTakeId(take.id);
    setVideoUrl(take.videoUrl);
    setCurrentTime(0);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleSetMaster = (takeId: string) => {
    setMasterVideoTake(effectiveProjectId, takeId);
    setSavedTakes((prev) =>
      prev.map((t) => ({ ...t, isMaster: t.id === takeId }))
    );
    toast.add({
      title: "Master Scene Take Updated",
      description: "Attached to Scene node in Canvas and Screening Room.",
      type: "success",
    });
  };

  const handleDeleteTake = (takeId: string) => {
    deleteVideoTake(effectiveProjectId, takeId);
    setSavedTakes((prev) => prev.filter((t) => t.id !== takeId));
    toast.add({ title: "Take deleted from vault", type: "info" });
  };

  const handleCancelGeneration = () => {
    stopPolling();
    setIsGenerating(false);
    setGenerationStage("");
    toast.add({
      title: "Stopped watching this render",
      description: "Omni has no cancel API — the job keeps rendering on Google's side, it just won't be picked up here.",
      type: "info",
    });
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const loaded = videoRef.current.duration;
      setVideoDuration(loaded || durationSec);
      if (loaded) setDurationSec(Math.round(loaded));
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
  };

  const handleVideoError = () => {
    console.warn("Omni player video load error on:", videoUrl);
    const fallback = "/videos/vault_heist_take_01.mp4";
    if (videoUrl !== fallback) {
      setVideoUrl(fallback);
      toast.add({
        title: "Video Stream Recovered",
        description: "Loaded verified local 720p cinematic take from disk.",
        type: "info",
      });
    }
  };

  const formatTimecode = (sec: number) => {
    const s = Math.floor(sec);
    const m = Math.floor(s / 60);
    const remainder = s % 60;
    return `${String(m).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[94vh] flex flex-col p-0 overflow-hidden bg-card border-border shadow-2xl">
        {/* Header */}
        <DialogHeader className="p-4 sm:p-5 border-b border-border bg-secondary/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center">
                <Video className="h-4 w-4 text-purple-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-base font-heading">
                    Gemini Omni Flash Cinema Video Generation · {sceneTitle}
                  </DialogTitle>
                  <Badge variant="outline" className="border-purple-500/40 bg-purple-500/10 text-purple-300 text-[10px] font-mono">
                    Omni Flash
                  </Badge>
                </div>
                <DialogDescription className="text-xs text-muted-foreground">
                  Direct neural diffusion 16:9 takes, audition character visual references, and save to project take vault.
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
              <div className="flex items-center gap-1.5 bg-secondary/50 px-2.5 py-1 rounded-md border border-border/70">
                <Clock className="h-3 w-3 text-accent" />
                <span>{resolution} · {durationSec}s Take</span>
              </div>
              <div className="hidden sm:flex items-center gap-1.5 bg-purple-500/10 text-purple-300 px-2.5 py-1 rounded-md border border-purple-500/20">
                <Film className="h-3 w-3" />
                <span>{savedTakes.length} Takes in Vault</span>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-12 flex-1 min-h-0 overflow-hidden">
          {/* Left Column: Video Theater View & Saved Takes Vault (7 Cols) */}
          <div className="md:col-span-7 bg-[#07090e] flex flex-col p-4 overflow-y-auto space-y-3.5 border-r border-border/80">
            {/* Aspect 16:9 Video Player Viewport */}
            <div
              ref={containerRef}
              className="relative w-full aspect-video rounded-xl overflow-hidden border border-border/90 shadow-2xl bg-black group select-none flex items-center justify-center"
            >
              <video
                ref={videoRef}
                src={videoUrl}
                loop={isLooping}
                muted={isMuted}
                playsInline
                className="w-full h-full object-cover cursor-pointer"
                onClick={togglePlay}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onError={handleVideoError}
              />

              {/* Center Play Button Overlay (when paused) */}
              {!isPlaying && !isGenerating && (
                <button
                  type="button"
                  onClick={togglePlay}
                  className="absolute inset-0 m-auto h-16 w-16 rounded-full bg-black/60 hover:bg-black/80 border border-white/30 backdrop-blur-md flex items-center justify-center text-white shadow-2xl transition-all duration-200 hover:scale-110 active:scale-95 cursor-pointer z-10"
                  title="Play Take"
                >
                  <Play className="h-7 w-7 fill-white translate-x-0.5 text-white" />
                </button>
              )}

              {/* Theater Scope Header Pill */}
              <div className="absolute top-3 left-3 flex items-center gap-2 pointer-events-none z-10">
                <span className="text-[10px] font-mono uppercase tracking-widest text-white/90 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded border border-white/10 shadow-xs">
                  Gemini Omni Flash · 16:9 Take
                </span>
              </div>

              {/* Loading / Generating Overlay */}
              {isGenerating && (
                <div className="absolute inset-0 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center space-y-3 z-30">
                  <RefreshCw className="h-8 w-8 text-purple-400 animate-spin" />
                  <div className="space-y-1">
                    <h4 className="text-sm font-heading font-semibold text-foreground">
                      Gemini Omni Flash Synthesizing Scene...
                    </h4>
                    <p className="text-xs text-purple-300 font-mono">
                      {generationStage}
                    </p>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    Neural diffusion rendering takes ~30-45 seconds. Automatically saves to your project vault.
                  </span>
                </div>
              )}

              {/* Floating Bottom Player Controls Bar */}
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-3 pt-6 flex flex-col gap-2 opacity-90 group-hover:opacity-100 transition-opacity z-20">
                {/* Scrubber Progress Slider */}
                <input
                  type="range"
                  min={0}
                  max={videoDuration || 6}
                  step={0.05}
                  value={currentTime}
                  onChange={handleSeek}
                  className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-purple-400 hover:h-1.5 transition-all"
                />

                {/* Controls Row */}
                <div className="flex items-center justify-between text-white text-xs">
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={togglePlay}
                      className="h-7 w-7 p-0 text-white hover:bg-white/20 rounded-md"
                    >
                      {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 fill-white" />}
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={toggleMute}
                      className="h-7 w-7 p-0 text-white hover:bg-white/20 rounded-md"
                    >
                      {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                    </Button>

                    <span className="font-mono text-[11px] text-white/80">
                      {formatTimecode(currentTime)} / {formatTimecode(videoDuration)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setIsLooping(!isLooping)}
                      className={`h-7 px-2 text-[10px] font-mono rounded-md gap-1 ${
                        isLooping ? "text-purple-300 bg-purple-500/20" : "text-white/70 hover:bg-white/10"
                      }`}
                      title="Toggle Loop"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>Loop</span>
                    </Button>

                    <a
                      href={videoUrl}
                      download={`${sceneTitle.replace(/\s+/g, "_")}_take.mp4`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-7 px-2.5 flex items-center gap-1 text-[11px] font-mono text-white bg-white/15 hover:bg-white/25 rounded-md transition-colors"
                      title="Download Take File"
                    >
                      <Download className="h-3 w-3" />
                      <span>MP4</span>
                    </a>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={toggleFullscreen}
                      className="h-7 w-7 p-0 text-white hover:bg-white/20 rounded-md"
                      title="Fullscreen"
                    >
                      <Maximize2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Saved Takes Vault Deck (Dailies Reel) */}
            <div className="space-y-2 p-3 rounded-xl border border-border/80 bg-secondary/15">
              <div className="flex items-center justify-between border-b border-border/60 pb-1.5">
                <div className="flex items-center gap-2">
                  <Film className="h-3.5 w-3.5 text-purple-400" />
                  <span className="text-xs font-bold text-foreground">
                    Project Take Vault · Saved Takes ({savedTakes.length})
                  </span>
                </div>
                <span className="text-[10px] font-mono text-muted-foreground">
                  Takes persist to your project in the cloud
                </span>
              </div>

              <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                {savedTakes.map((take) => {
                  const isActive = activeTakeId === take.id;
                  return (
                    <div
                      key={take.id}
                      className={`p-2 rounded-lg border text-xs flex items-center justify-between gap-2 transition-all ${
                        isActive
                          ? "border-purple-500/70 bg-purple-500/15 shadow-xs"
                          : "border-border/60 bg-card/60 hover:bg-card hover:border-border"
                      }`}
                    >
                      <div
                        className="flex items-center gap-2.5 min-w-0 cursor-pointer flex-1"
                        onClick={() => handleSelectTake(take)}
                      >
                        <div
                          className={`h-7 w-7 rounded flex items-center justify-center text-xs font-mono font-bold shrink-0 ${
                            isActive
                              ? "bg-purple-600 text-white"
                              : "bg-secondary text-muted-foreground"
                          }`}
                        >
                          T{take.takeNumber}
                        </div>
                        <div className="min-w-0 truncate">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold truncate text-foreground text-xs">
                              {take.title}
                            </span>
                            {take.isMaster && (
                              <Badge className="bg-emerald-600/20 text-emerald-300 border-emerald-500/40 text-[9px] py-0 px-1 font-mono">
                                Master
                              </Badge>
                            )}
                          </div>
                          <span className="text-[10px] font-mono text-muted-foreground block truncate">
                            {take.cameraMotion} · {take.durationSec}s take
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {!take.isMaster && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleSetMaster(take.id)}
                            className="h-6 px-2 text-[10px] font-mono text-muted-foreground hover:text-emerald-300 hover:bg-emerald-500/10 gap-1"
                            title="Set as Master Scene Take"
                          >
                            <Star className="h-3 w-3" />
                            <span className="hidden sm:inline">Make Master</span>
                          </Button>
                        )}
                        <a
                          href={take.videoUrl}
                          download={`${sceneTitle.replace(/\s+/g, "_")}_take_${take.takeNumber}.mp4`}
                          className="h-6 w-6 flex items-center justify-center text-muted-foreground hover:text-foreground rounded hover:bg-secondary/40"
                          title="Download MP4"
                        >
                          <Download className="h-3 w-3" />
                        </a>
                        {savedTakes.length > 1 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteTake(take.id)}
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10"
                            title="Delete Take"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Director Controls & Prompt Conditioning (5 Cols) */}
          <div className="md:col-span-5 flex flex-col p-4 bg-secondary/15 border-l border-border/80 space-y-3.5 overflow-y-auto">
            <div className="flex items-center gap-2 border-b border-border/60 pb-2">
              <Camera className="h-4 w-4 text-purple-400" />
              <SlateLabel>Video Camera &amp; Cinematography Deck</SlateLabel>
            </div>

            {/* Character Focus & Visual Conditioning Module */}
            {((characters && characters.length > 0) || characterContext) && (
              <div className="space-y-2.5 p-3 rounded-xl border border-purple-500/30 bg-purple-500/10 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-purple-400" />
                    <span className="text-xs font-bold text-foreground">Character Visual Reference</span>
                  </div>
                  <Badge variant="outline" className="text-[9px] font-mono border-purple-500/40 text-purple-300 py-0">
                    Omni Flash Cast
                  </Badge>
                </div>

                {/* Character Selection Pills with Avatars */}
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCharName(null);
                      runSynthesis(null);
                    }}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-mono transition-all flex items-center gap-1 cursor-pointer ${
                      selectedCharName === null
                        ? "bg-purple-600 text-white font-semibold shadow-xs"
                        : "bg-card/80 border border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span>Master Scene (Ensemble)</span>
                  </button>

                  {(characters || (characterContext ? [characterContext] : [])).map((c, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setSelectedCharName(c.name);
                        runSynthesis(c.name);
                      }}
                      className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                        selectedCharName === c.name
                          ? "bg-purple-600 text-white font-semibold shadow-xs"
                          : "bg-card/80 border border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {c.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={c.imageUrl}
                          alt={c.name}
                          className="h-3.5 w-3.5 rounded-full object-cover border border-white/40"
                        />
                      ) : (
                        <span className="h-3.5 w-3.5 rounded-full bg-secondary flex items-center justify-center text-[8px] font-bold">
                          {c.name.charAt(0)}
                        </span>
                      )}
                      <span>{c.name}</span>
                    </button>
                  ))}
                </div>

                {/* Canvas Node Context Pipeline Badges */}
                {activeNodeContributions.length > 0 && (
                  <div className="pt-2 border-t border-purple-500/20 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-[10px] font-mono text-purple-300">
                        <Layers className="h-3 w-3" />
                        <span>Connected Canvas Nodes ({activeNodeContributions.length})</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => runSynthesis(selectedCharName)}
                        className="text-[9px] font-mono text-accent hover:underline flex items-center gap-1 cursor-pointer"
                        title="Re-synthesize prompt using current nodes"
                      >
                        <RefreshCw className="h-2.5 w-2.5" />
                        <span>Re-Synthesize</span>
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {activeNodeContributions.map((contrib) => (
                        <span
                          key={contrib.id}
                          className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${contrib.badgeColor}`}
                          title={contrib.summary}
                        >
                          {contrib.label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Image Conditioning Controls (Image-to-Video) */}
                <div className="p-2 rounded-lg border border-purple-500/30 bg-purple-950/20 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase text-purple-300 font-semibold flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-accent" />
                      <span>Image-to-Video Conditioning</span>
                    </span>
                    {activeConditioningImage ? (
                      <Badge variant="outline" className="text-[8px] font-mono border-emerald-500/50 bg-emerald-500/10 text-emerald-300 py-0">
                        {conditioningCustomName || "Active Reference"}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[8px] font-mono text-muted-foreground py-0">
                        Text Only
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {activeConditioningImage && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={activeConditioningImage}
                        alt="Conditioning reference"
                        className="h-9 w-9 rounded-md object-cover border border-purple-400 shrink-0"
                      />
                    )}
                    <div className="flex items-center gap-1 flex-1 flex-wrap">
                      {activeChar?.imageUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveConditioningImage(activeChar.imageUrl!);
                            setActiveImageType("face");
                            setConditioningCustomName(`${activeChar.name} Face`);
                          }}
                          className={`px-2 py-1 rounded text-[10px] font-mono border cursor-pointer transition-colors ${
                            activeConditioningImage === activeChar.imageUrl
                              ? "bg-purple-600 border-purple-400 text-white font-semibold"
                              : "bg-card border-border text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          Face
                        </button>
                      )}
                      {activeChar?.fullBodyImageUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveConditioningImage(activeChar.fullBodyImageUrl!);
                            setActiveImageType("body");
                            setConditioningCustomName(`${activeChar.name} Stance`);
                          }}
                          className={`px-2 py-1 rounded text-[10px] font-mono border cursor-pointer transition-colors ${
                            activeConditioningImage === activeChar.fullBodyImageUrl
                              ? "bg-purple-600 border-purple-400 text-white font-semibold"
                              : "bg-card border-border text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          Body
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsAssetPickerOpen(true)}
                        className={`px-2 py-1 rounded text-[10px] font-mono border cursor-pointer transition-colors flex items-center gap-1 ${
                          activeImageType === "custom"
                            ? "bg-purple-600 border-purple-400 text-white font-semibold"
                            : "bg-card border-border text-purple-300 hover:text-purple-200"
                        }`}
                      >
                        <Upload className="h-2.5 w-2.5" />
                        <span>{activeImageType === "custom" ? "Custom (Hub)" : "Asset Hub..."}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveConditioningImage(null);
                          setActiveImageType(null);
                          setConditioningCustomName(null);
                        }}
                        className={`px-1.5 py-1 rounded text-[10px] font-mono border cursor-pointer transition-colors ${
                          !activeConditioningImage
                            ? "bg-secondary border-border text-foreground font-semibold"
                            : "bg-card/40 border-border/60 text-muted-foreground hover:text-foreground"
                        }`}
                        title="Generate text-only without conditioning image"
                      >
                        Off
                      </button>
                    </div>
                  </div>
                </div>

                {/* Active Character Visual Dossier */}
                {activeChar && (
                  <div className="p-2.5 rounded-lg border border-purple-500/20 bg-black/40 space-y-2">
                    <div className="flex items-start gap-2.5">
                      {/* Face Thumbnail */}
                      <div className="h-12 w-12 rounded-md overflow-hidden border border-border bg-black shrink-0 relative">
                        {activeChar.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={activeChar.imageUrl}
                            alt={activeChar.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                            <Eye className="h-4 w-4" />
                          </div>
                        )}
                        <span className="absolute bottom-0 inset-x-0 bg-black/75 text-[7px] font-mono text-center text-white">
                          Face
                        </span>
                      </div>

                      {/* Full-Body Thumbnail */}
                      <div className="h-12 w-9 rounded-md overflow-hidden border border-border bg-black shrink-0 relative">
                        {activeChar.fullBodyImageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={activeChar.fullBodyImageUrl}
                            alt={`${activeChar.name} body`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                            <Shirt className="h-3.5 w-3.5" />
                          </div>
                        )}
                        <span className="absolute bottom-0 inset-x-0 bg-black/75 text-[7px] font-mono text-center text-white">
                          Body
                        </span>
                      </div>

                      {/* Character Details */}
                      <div className="min-w-0 flex-1 space-y-0.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-foreground truncate">{activeChar.name}</span>
                          <Badge variant="outline" className="text-[9px] py-0 px-1 border-purple-500/40 text-purple-300">
                            {activeChar.role || "Cast"}
                          </Badge>
                        </div>
                        {activeChar.actorComp && (
                          <div className="text-[10px] text-cyan-400 font-mono truncate">
                            Comp: {activeChar.actorComp}
                          </div>
                        )}
                        {activeChar.wardrobe && (
                          <p className="text-[10px] text-muted-foreground line-clamp-1">
                            Wardrobe: {activeChar.wardrobe}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Quick Shot Conditioning Recipes */}
                    <div className="space-y-1 pt-1 border-t border-border/50">
                      <span className="text-[9px] font-mono uppercase text-muted-foreground block">
                        Character Camera Takes:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setCameraMotion("Slow Cinematic Dolly In");
                            runSynthesis(activeChar.name, "face");
                          }}
                          className="px-2 py-0.5 rounded bg-secondary/80 hover:bg-secondary text-[10px] font-mono text-foreground border border-border/60 transition-colors cursor-pointer"
                        >
                          👤 Face Push-In
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCameraMotion("35mm Anamorphic Tracking Shot");
                            runSynthesis(activeChar.name, "body");
                          }}
                          className="px-2 py-0.5 rounded bg-secondary/80 hover:bg-secondary text-[10px] font-mono text-foreground border border-border/60 transition-colors cursor-pointer"
                        >
                          🏃 Full-Body Action
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCameraMotion("Handheld Gritty Tension");
                            runSynthesis(activeChar.name, "face");
                          }}
                          className="px-2 py-0.5 rounded bg-secondary/80 hover:bg-secondary text-[10px] font-mono text-foreground border border-border/60 transition-colors cursor-pointer"
                        >
                          ⚔️ Two-Shot Standoff
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Camera Motion */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Camera Movement Dynamics</label>
              <select
                value={cameraMotion}
                onChange={(e) => setCameraMotion(e.target.value)}
                className="w-full text-xs font-mono rounded-md border border-border bg-card px-2.5 py-1.5 text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-accent"
              >
                {CAMERA_MOTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {/* Style Preset */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Visual Film Stock &amp; Color Grade</label>
              <select
                value={stylePreset}
                onChange={(e) => setStylePreset(e.target.value)}
                className="w-full text-xs rounded-md border border-border bg-card px-2.5 py-1.5 text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-accent"
              >
                {STYLE_PRESETS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            {/* Output Resolution */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-medium text-foreground">Output Resolution</span>
                <span className="font-mono text-accent">{resolution}</span>
              </div>
              <div className="flex items-center gap-2">
                {RESOLUTIONS.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setResolution(r.id)}
                    title={r.label}
                    className={`flex-1 py-1 rounded text-xs font-mono font-semibold transition-all cursor-pointer ${
                      resolution === r.id
                        ? "bg-purple-600 text-white shadow-sm"
                        : "bg-card border border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {r.id}
                  </button>
                ))}
              </div>
              <span className="text-[10px] font-mono text-muted-foreground">
                Clip length is prompt-driven (3-10s per render).
              </span>
            </div>

            {/* Scene Conditioning Prompt */}
            <div className="space-y-1 flex-1 flex flex-col">
              <label className="text-xs font-medium text-foreground">Scene Visual Conditioning Prompt</label>
              <textarea
                rows={4}
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                className="w-full text-xs font-mono bg-card rounded-md border border-border/80 p-2.5 text-foreground focus:outline-none focus:ring-1 focus:ring-accent leading-relaxed flex-1"
                placeholder="Describe scene visual framing and action..."
              />
            </div>

            {/* Primary Action Button */}
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleGenerateVideo}
                disabled={isGenerating || !customPrompt.trim()}
                className="flex-1 h-9 text-xs font-semibold gap-2 bg-purple-600 hover:bg-purple-700 text-white shadow-md cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>{isGenerating ? "Rendering with Omni Flash..." : "Render Scene with Gemini Omni Flash"}</span>
              </Button>
              {isGenerating && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCancelGeneration}
                  className="h-9 text-xs cursor-pointer"
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Conditioning Asset Picker Modal */}
        <AssetPickerModal
          open={isAssetPickerOpen}
          onOpenChange={setIsAssetPickerOpen}
          title="Select Reference Image or Video Frame for Gemini Omni Flash"
          description="Condition Gemini Omni Flash motion diffusion on character faces, location plates, or style reference images."
          acceptedTypes={["image"]}
          projectId={projectId}
          onSelectAsset={(asset) => {
            setActiveConditioningImage(asset.url);
            setActiveImageType("custom");
            setConditioningCustomName(asset.name);
            toast.add({
              title: "Conditioning Reference Linked",
              description: `"${asset.name}" selected as the visual anchor.`,
              type: "success",
            });
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
