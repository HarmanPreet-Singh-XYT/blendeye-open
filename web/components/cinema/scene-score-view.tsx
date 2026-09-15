"use client";

import * as React from "react";
import {
  Music,
  Play,
  Pause,
  Download,
  Sparkles,
  Layers,
  Check,
  RotateCcw,
  Volume2,
  VolumeX,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Info,
  Clock,
  Mic,
  FileText,
  Image as ImageIcon,
  Activity,
  Film,
  Video,
  Star,
  ExternalLink,
  ChevronRight,
  HelpCircle,
  RefreshCw,
  Plus,
  Radio,
  Copy,
  CheckCheck,
  Zap,
  SlidersHorizontal,
  Trash2,
  Pencil,
  Check as CheckIcon,
  X,
  Upload,
} from "lucide-react";
import { AssetPickerModal } from "@/components/cinema/asset-picker-modal";
import { saveLocalAsset } from "@/lib/asset-store";
import type { Node } from "@xyflow/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { FilmScene, ProjectCharacter, ScoreTake } from "@/lib/project-store";
import { getScoreTakes, saveScoreTake, setMasterScoreTake, deleteScoreTake, renameScoreTake } from "@/lib/project-store";
import {
  analyzeSceneMusicContext,
  synthesizeSceneScorePrompt,
  autoDraftLyrics,
  type SceneContextReadiness,
} from "@/lib/scene-score-synthesizer";
import { notifyIfFallback } from "@/lib/fallback-notice";

export interface MoodboardCandidate {
  id: string;
  url: string;
  label: string;
  type: "scene_keyframe" | "scene_scout" | "timeline_moment" | "character" | "other_scene";
}

export type ResponseModalityChoice = "AUDIO_TEXT" | "AUDIO_ONLY" | "TEXT_ONLY";

interface SceneScoreViewProps {
  projectId?: string;
  scenes?: FilmScene[];
  activeSceneId?: string;
  onSelectScene?: (sceneId: string) => void;
  onUpdateScene?: (updatedScene: FilmScene) => void;
  characters?: ProjectCharacter[];
  genre?: string;
  projectTitle?: string;
  nodes?: Node[];
  /** Project-level video takes (from Veo 3.1 generation) for Video Sync mode */
  videoTakes?: import("@/lib/project-store").VideoTake[];
}

const INSTRUMENT_OPTIONS = [
  "Layered Orchestral Strings",
  "808 Sub-Bass Pulse",
  "Analog Synth Pads",
  "Solo Cello",
  "Heavy Cinematic Brass",
  "Acoustic Guitar",
  "Grand Piano",
  "Taiko / Cinematic Percussion",
  "Muted Electric Guitar",
  "Choral Vocal Textures",
];

const DYNAMIC_ARCS = [
  { id: "Slow crescendo building from quiet tension to a climactic percussive climax", label: "Slow Build to Climax" },
  { id: "Low-frequency steady tension drone with subtle rhythmic pulses throughout", label: "Tense Steady Drone" },
  { id: "Starts quietly then sudden percussive action burst and stinger", label: "Sudden Action Stinger" },
  { id: "Atmospheric, ethereal harmonic fade with long reverb decay", label: "Atmospheric Fade" },
  { id: "Urgent, driving kinetic pulse with 128 BPM forward momentum", label: "Kinetic Chase Pulse" },
];

const VOCAL_PROFILES = [
  "Breathy Alto Female Textures with Heavy Reverb",
  "Deep Resonant Baritone Male Vocal",
  "Ethereal Choral Oohs and Aahs (Wordless)",
  "Whispered Low-Register Noir Delivery",
  "Crisp Melodic Lead Vocal",
];

const SUPPORTED_LANGUAGES = [
  "English",
  "Spanish",
  "French",
  "German",
  "Hindi",
  "Japanese",
  "Korean",
  "Portuguese",
];

export function SceneScoreView({
  projectId = "",
  scenes = [],
  activeSceneId,
  onSelectScene,
  onUpdateScene,
  characters = [],
  genre = "Cinematic Drama",
  projectTitle = "Production",
  nodes = [],
  videoTakes = [],
}: SceneScoreViewProps) {
  const activeScene =
    scenes.find((s) => s.id === activeSceneId) || scenes[0] || null;

  // ── Selected video for Video Sync mode ──────────────────────────────────
  const defaultVideoUrl = React.useMemo(() => {
    const master = videoTakes.find((t) => t.isMaster);
    return master?.videoUrl || videoTakes[0]?.videoUrl || "";
  }, [videoTakes]);
  const [selectedVideoUrl, setSelectedVideoUrl] = React.useState<string>(defaultVideoUrl);
  React.useEffect(() => { setSelectedVideoUrl(defaultVideoUrl); }, [defaultVideoUrl]);

  // Music configuration state
  const [scoreType, setScoreType] = React.useState<"score" | "source" | "vocal">("score");
  const [mediaDeliveryMode, setMediaDeliveryMode] = React.useState<"audio_only" | "sync_video">("audio_only");
  const videoClipDuration = 6; // Typical Veo 3.1 video take duration (5-8s)
  const sceneCutDuration = activeScene?.durationSeconds || 30;
  const [durationSeconds, setDurationSeconds] = React.useState<number>(30);
  const [durationMode, setDurationMode] = React.useState<"clip" | "pro">("clip");
  const [selectedInstruments, setSelectedInstruments] = React.useState<string[]>([
    "Layered Orchestral Strings",
    "808 Sub-Bass Pulse",
    "Analog Synth Pads",
  ]);
  const [selectedArc, setSelectedArc] = React.useState<string>(DYNAMIC_ARCS[0].id);
  const [vocalProfile, setVocalProfile] = React.useState<string>(VOCAL_PROFILES[0]);
  const [targetLanguage, setTargetLanguage] = React.useState<string>("English");
  const [customLyrics, setCustomLyrics] = React.useState<string>("");
  const [promptText, setPromptText] = React.useState<string>("");
  const [includeImageConditioning, setIncludeImageConditioning] = React.useState<boolean>(true);
  const [selectedMoodboardUrls, setSelectedMoodboardUrls] = React.useState<string[]>([]);
  const [responseModality, setResponseModality] = React.useState<ResponseModalityChoice>("AUDIO_TEXT");
  const [enableStreaming, setEnableStreaming] = React.useState<boolean>(true);
  const [streamingText, setStreamingText] = React.useState<string>("");
  const [copiedLyrics, setCopiedLyrics] = React.useState<boolean>(false);
  const [showReadinessDetails, setShowReadinessDetails] = React.useState<boolean>(false);
  const [customHubImages, setCustomHubImages] = React.useState<Array<{ id: string; url: string; label: string; type: MoodboardCandidate["type"] }>>([]);
  const [isAssetPickerOpen, setIsAssetPickerOpen] = React.useState<boolean>(false);

  // ── Moodboard candidates — scene visuals and user-selected references from Asset Hub ──────────
  const moodboardCandidates = React.useMemo<MoodboardCandidate[]>(() => {
    const list: MoodboardCandidate[] = [];
    const seen = new Set<string>();

    const add = (url: string | undefined | null, label: string, type: MoodboardCandidate["type"]) => {
      if (url && !seen.has(url)) {
        seen.add(url);
        list.push({ id: `img-${list.length}`, url, label, type });
      }
    };

    // 1. Scene master keyframe
    if (activeScene?.preview_image_url) {
      add(activeScene.preview_image_url, "Scene Keyframe", "scene_keyframe");
    }

    // 2. Scene scouting / custom generated images
    activeScene?.sceneImages?.forEach((img, idx) => {
      const label = img.title || `Scout Image ${idx + 1}`;
      add(img.url, label, "scene_scout");
    });

    // 3. Timeline still frames generated for this scene
    activeScene?.timelineMoments?.forEach((m, idx) => {
      const label = (m as typeof m & { label?: string }).label || `Timeline Frame ${idx + 1}`;
      add(m.imageUrl, label, "timeline_moment");
    });

    // 4. Custom reference images imported from Asset Hub
    customHubImages.forEach((m) => {
      add(m.url, m.label, m.type);
    });

    return list;
  }, [activeScene, customHubImages]);

  // Prepopulate selected moodboard with active scene keyframe or first scout
  React.useEffect(() => {
    const defaultUrl = activeScene?.preview_image_url || activeScene?.sceneImages?.[0]?.url;
    if (defaultUrl) {
      setSelectedMoodboardUrls((prev) => {
        if (prev.length === 0) return [defaultUrl];
        return prev;
      });
    }
  }, [activeScene?.id]);

  const toggleMoodboardImage = (url: string) => {
    setSelectedMoodboardUrls((prev) => {
      if (prev.includes(url)) {
        return prev.filter((u) => u !== url);
      }
      if (prev.length >= 10) {
        toast.add({
          title: "Max 10 Images Reached",
          description: "Lyria 3 API conditions on up to 10 moodboard reference images.",
          type: "warning",
        });
        return prev;
      }
      return [...prev, url];
    });
  };

  const selectAllSceneImages = () => {
    const sceneUrls = moodboardCandidates
      .filter((c) => c.type === "scene_keyframe" || c.type === "scene_scout")
      .map((c) => c.url)
      .slice(0, 10);
    setSelectedMoodboardUrls(sceneUrls);
  };

  const clearMoodboard = () => {
    setSelectedMoodboardUrls([]);
  };

  const resolvedModalities = React.useMemo<string[]>(() => {
    if (responseModality === "AUDIO_ONLY") return ["AUDIO"];
    if (responseModality === "TEXT_ONLY") return ["TEXT"];
    return ["AUDIO", "TEXT"];
  }, [responseModality]);

  const handleCopyLyrics = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLyrics(true);
    toast.add({
      title: "Score Sheet Copied",
      description: "Lyrics and arrangement breakdown copied to clipboard.",
      type: "success",
    });
    setTimeout(() => setCopiedLyrics(false), 2000);
  };

  // Generation & Playback state
  const [isGenerating, setIsGenerating] = React.useState<boolean>(false);
  const [generationStage, setGenerationStage] = React.useState<string>("");
  const [musicBatchCount, setMusicBatchCount] = React.useState<number>(1);
  const [variationMode, setVariationMode] = React.useState<"arrangements" | "timbres">("arrangements");
  const [batchProgress, setBatchProgress] = React.useState<{ current: number; total: number; stageName: string } | null>(null);
  const [currentScoreTakes, setCurrentScoreTakes] = React.useState<ScoreTake[]>([]);
  const [activeScoreTake, setActiveScoreTake] = React.useState<ScoreTake | null>(null);

  // Audio Playback
  const [isPlaying, setIsPlaying] = React.useState<boolean>(false);
  const [audioCurrentTime, setAudioCurrentTime] = React.useState<number>(0);
  const [audioDuration, setAudioDuration] = React.useState<number>(0);
  const [volume, setVolume] = React.useState<number>(0.85);
  const [isMuted, setIsMuted] = React.useState<boolean>(false);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  // Dual-Track Synced Playback with Veo Video
  const [syncWithVideo, setSyncWithVideo] = React.useState<boolean>(true);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const [videoBalance, setVideoBalance] = React.useState<number>(0.5); // 0 = Video only, 1 = Score only

  // Context Readiness evaluation
  const readiness: SceneContextReadiness = React.useMemo(() => {
    return analyzeSceneMusicContext(activeScene, { genre, sceneTitle: activeScene?.title }, nodes);
  }, [activeScene, genre, nodes]);

  // Load saved takes for this scene
  React.useEffect(() => {
    if (projectId) {
      const takes = getScoreTakes(projectId, activeScene?.id);
      setCurrentScoreTakes(takes);
      if (takes.length > 0) {
        const master = takes.find((t) => t.isMaster) || takes[0];
        setActiveScoreTake(master);
      } else {
        setActiveScoreTake(null);
      }
    }
  }, [projectId, activeScene?.id]);

  // Initial prompt auto-population
  const handleAutoSynthesize = React.useCallback(() => {
    if (!activeScene) return;

    const result = synthesizeSceneScorePrompt({
      scene: activeScene,
      project: { genre, title: projectTitle },
      nodes,
      characters,
      scoreType,
      intensityArc: selectedArc,
      leadInstruments: selectedInstruments,
      vocalStyle: vocalProfile,
      customLyrics: customLyrics || undefined,
      targetLanguage,
      targetDurationSec: durationSeconds,
    });

    setPromptText(result.fullPrompt);
    setDurationMode(durationSeconds > 30 ? "pro" : "clip");
    if (result.genreLyrics && !customLyrics) {
      setCustomLyrics(result.genreLyrics);
    }

    toast.add({
      title: "✨ Scene Score Prompt Synthesized",
      description: `Gathered ${result.readiness.readyCount} scene signals into Lyria prompt.`,
      type: "success",
    });
  }, [activeScene, genre, projectTitle, nodes, characters, scoreType, selectedArc, selectedInstruments, vocalProfile, customLyrics, targetLanguage, durationSeconds]);

  // Run initial synthesis once on mount or when active scene switches
  React.useEffect(() => {
    if (activeScene && !promptText) {
      handleAutoSynthesize();
    }
  }, [activeScene?.id]);

  // Audio event listeners
  React.useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setAudioCurrentTime(audio.currentTime);
    const updateDuration = () => setAudioDuration(audio.duration || 0);
    const handleEnded = () => {
      setIsPlaying(false);
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      }
    };

    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [activeScoreTake?.audioUrl]);

  // Toggle playback
  const togglePlay = () => {
    const audio = audioRef.current;
    const video = videoRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      if (video) video.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => {
        setIsPlaying(true);
        if (video && syncWithVideo) {
          video.currentTime = audio.currentTime;
          video.play().catch(() => {});
        }
      }).catch((e) => {
        console.error("Audio playback error:", e);
      });
    }
  };

  // Sync volume with balance
  React.useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume * (syncWithVideo ? videoBalance : 1);
    }
    if (videoRef.current) {
      videoRef.current.volume = isMuted ? 0 : volume * (1 - videoBalance);
    }
  }, [volume, isMuted, videoBalance, syncWithVideo]);

  // Generate Score with Google Lyria 3 (supports single stream or multi-take batch)
  const handleGenerateScore = async (countOverride?: number, modeOverride?: "arrangements" | "timbres") => {
    if (!promptText.trim()) {
      toast.add({
        title: "Missing Prompt",
        description: "Please enter or synthesize a score prompt first.",
        type: "error",
      });
      return;
    }

    const count = Math.min(4, Math.max(1, countOverride ?? musicBatchCount));
    const mode = modeOverride ?? variationMode;

    setIsGenerating(true);
    setStreamingText("");

    const activeImages = includeImageConditioning ? selectedMoodboardUrls : [];

    const ARRANGEMENT_VARIATIONS = [
      { name: "Master Dynamic", modifier: "Balanced orchestral master arrangement with cinematic dynamic arc." },
      { name: "Heightened Urgency", modifier: "Intense accelerating tempo, urgent driving rhythmic pulses, heightened dramatic percussion." },
      { name: "Subtle Atmospheric", modifier: "Delicate atmospheric acoustic textures, sparse arrangement, deep sub-bass resonance." },
      { name: "Symphonic Crescendo", modifier: "Full symphonic swell, expansive brass, lush soaring strings, climactic emotional peak." },
    ];

    const TIMBRE_VARIATIONS = [
      { name: "Selected Palette", modifier: "Primary acoustic and synthetic instruments as configured." },
      { name: "Analog Synthesizer & Sub-Bass", modifier: "Vintage analog synthesizer drones, warm moog basslines, dark electronic textures." },
      { name: "Acoustic Strings & Cello", modifier: "Solo expressive cello, intimate bowed strings, organic wood resonance." },
      { name: "Hybrid Sound Design", modifier: "Granular sound design, industrial acoustic distortions, deep cinematic sub-impacts." },
    ];

    try {
      if (count === 1 && enableStreaming) {
        // Single take with SSE streaming
        setGenerationStage("Opening Lyria 3 Live SSE Stream...");
        const payload = {
          prompt: promptText.trim(),
          duration_mode: durationSeconds > 30 ? "pro" : "clip",
          duration_seconds: durationSeconds,
          image_url: activeImages[0] || null,
          image_urls: activeImages,
          lyrics: scoreType === "vocal" ? customLyrics || null : null,
          language: targetLanguage,
          response_modalities: resolvedModalities,
        };

        const streamRes = await fetch("/api/media/music/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!streamRes.ok || !streamRes.body) {
          throw new Error(`Streaming failed with status HTTP ${streamRes.status}`);
        }

        const reader = streamRes.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let accumulatedText = "";
        let receivedAudioUrl = "";
        let modelUsed = durationSeconds > 30 ? "lyria-3-pro-preview" : "lyria-3-clip-preview";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const dataStr = trimmed.slice(5).trim();
            if (!dataStr) continue;

            try {
              const evt = JSON.parse(dataStr);
              if (evt.type === "status") {
                setGenerationStage(evt.message);
              } else if (evt.type === "text_delta") {
                accumulatedText += evt.text;
                setStreamingText(accumulatedText);
              } else if (evt.type === "audio_delta") {
                if (evt.data) {
                  receivedAudioUrl = `data:${evt.mime_type || "audio/wav"};base64,${evt.data}`;
                }
              } else if (evt.type === "done") {
                if (evt.model) modelUsed = evt.model;
              }
            } catch (parseErr) {
              console.warn("SSE event parsing notice:", parseErr);
            }
          }
        }

        if (!receivedAudioUrl && resolvedModalities.includes("AUDIO")) {
          setGenerationStage("Finalizing audio master rendering...");
          const batchRes = await fetch("/api/media/music", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (batchRes.ok) {
            const batchData = await batchRes.json();
            receivedAudioUrl = batchData.audio_url;
            if (batchData.lyrics_text && !accumulatedText) accumulatedText = batchData.lyrics_text;
            if (batchData.model) modelUsed = batchData.model;
          }
        }

        const finalLyrics = accumulatedText.trim() || (scoreType === "vocal" ? customLyrics : undefined);

        const newTake = saveScoreTake(projectId, {
          sceneId: activeScene?.id,
          title: `${activeScene?.title || "Scene"} — ${responseModality === "TEXT_ONLY" ? "Score Sheet Take" : "Score Take"}`,
          prompt: promptText,
          durationMode: durationSeconds > 30 ? "pro" : "clip",
          durationSec: durationSeconds,
          audioUrl: receivedAudioUrl,
          lyricsText: finalLyrics,
          scoreType,
          conditioningImageUrl: activeImages[0] || null,
          conditioningImageUrls: activeImages,
          responseModalities: resolvedModalities,
          instruments: selectedInstruments,
          dynamicArc: selectedArc,
          model: modelUsed,
        });

        const updatedTakes = getScoreTakes(projectId, activeScene?.id);
        setCurrentScoreTakes(updatedTakes);
        setActiveScoreTake(newTake);

        // Auto-register in Asset Hub under 'audio' category
        if (newTake.audioUrl) {
          saveLocalAsset({
            id: newTake.id,
            name: newTake.title,
            type: "audio",
            category: "audio",
            url: newTake.audioUrl,
            sizeBytes: 0,
            mimeType: newTake.audioUrl.endsWith(".wav") ? "audio/wav" : "audio/mp3",
            tags: ["lyria-3", "music-score", "audio"],
            metadata: {
              sceneId: activeScene?.id,
              prompt: promptText,
              durationSec: durationSeconds,
              model: modelUsed,
            },
            createdAt: Date.now(),
          });
        }

        if (activeScene && onUpdateScene && receivedAudioUrl) {
          onUpdateScene({
            ...activeScene,
            activeScoreUrl: newTake.audioUrl,
            scoreTakes: updatedTakes,
          });
        }

        toast.add({
          title: responseModality === "TEXT_ONLY" ? "📝 Score Sheet Synthesized" : "🎵 Scene Score Rendered",
          description: `Generated via live stream with ${modelUsed}.`,
          type: "success",
        });
      } else {
        // Multi-take batch or non-streaming generation
        const variationList = mode === "arrangements" ? ARRANGEMENT_VARIATIONS : TIMBRE_VARIATIONS;
        const newlyCreatedTakes: ScoreTake[] = [];

        for (let i = 0; i < count; i++) {
          const varObj = variationList[i % variationList.length];
          const varTitle = count > 1 ? `${activeScene?.title || "Scene"} — Cue 0${i + 1} (${varObj.name})` : `${activeScene?.title || "Scene"} — Score Take`;
          const tailoredPrompt = count > 1
            ? `${promptText.trim()}. ${varObj.modifier}`
            : promptText.trim();

          setBatchProgress({
            current: i + 1,
            total: count,
            stageName: varObj.name,
          });
          setGenerationStage(`Synthesizing Variation ${i + 1} of ${count}: ${varObj.name}...`);

          const payload = {
            prompt: tailoredPrompt,
            duration_mode: durationSeconds > 30 ? "pro" : "clip",
            duration_seconds: durationSeconds,
            image_url: activeImages[0] || null,
            image_urls: activeImages,
            lyrics: scoreType === "vocal" ? customLyrics || null : null,
            language: targetLanguage,
            response_modalities: resolvedModalities,
          };

          const res = await fetch("/api/media/music", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          if (res.ok) {
            const data = await res.json();
            notifyIfFallback(data, `Lyria 3 Music: ${varObj.name}`);

            const newTake = saveScoreTake(projectId, {
              sceneId: activeScene?.id,
              title: varTitle,
              prompt: tailoredPrompt,
              durationMode: durationSeconds > 30 ? "pro" : "clip",
              durationSec: data.duration_estimate_sec || durationSeconds,
              audioUrl: data.audio_url || "",
              lyricsText: data.lyrics_text || (scoreType === "vocal" ? customLyrics : undefined),
              scoreType,
              conditioningImageUrl: activeImages[0] || null,
              conditioningImageUrls: activeImages,
              responseModalities: resolvedModalities,
              instruments: selectedInstruments,
              dynamicArc: selectedArc,
              model: data.model,
            });
            newlyCreatedTakes.push(newTake);
          }
        }

        if (newlyCreatedTakes.length > 0) {
          const updatedTakes = getScoreTakes(projectId, activeScene?.id);
          setCurrentScoreTakes(updatedTakes);
          setActiveScoreTake(newlyCreatedTakes[0]);

          if (activeScene && onUpdateScene && newlyCreatedTakes[0].audioUrl) {
            onUpdateScene({
              ...activeScene,
              activeScoreUrl: newlyCreatedTakes[0].audioUrl,
              scoreTakes: updatedTakes,
            });
          }

          toast.add({
            title: count > 1 ? `🎵 ${newlyCreatedTakes.length} Score Variations Rendered` : "🎵 Scene Score Rendered",
            description: `Generated music variations for Scene ${activeScene?.sceneNumber || ""}.`,
            type: "success",
          });
        } else {
          throw new Error("No music tracks could be generated.");
        }
      }
    } catch (err: unknown) {
      console.error("Score generation failed:", err);
      toast.add({
        title: "Generation Failed",
        description: err instanceof Error ? err.message : String(err),
        type: "error",
      });
    } finally {
      setIsGenerating(false);
      setGenerationStage("");
      setBatchProgress(null);
    }
  };

  // Delete Score Take from Project and Scene
  const handleDeleteScoreTake = (takeId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!projectId) return;

    deleteScoreTake(projectId, takeId, activeScene?.id);
    const updated = getScoreTakes(projectId, activeScene?.id);
    setCurrentScoreTakes(updated);

    if (activeScoreTake?.id === takeId) {
      const nextTake = updated[0] || null;
      setActiveScoreTake(nextTake);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setIsPlaying(false);
    }

    if (activeScene && onUpdateScene) {
      onUpdateScene({
        ...activeScene,
        activeScoreUrl: updated[0]?.audioUrl || undefined,
        scoreTakes: updated,
      });
    }

    toast.add({
      title: "Score Take Removed",
      description: "Music cue deleted from scene score vault.",
      type: "info",
    });
  };

  const handleSetMaster = (take: ScoreTake) => {
    setMasterScoreTake(projectId, take.id, activeScene?.id);
    const updated = getScoreTakes(projectId, activeScene?.id);
    setCurrentScoreTakes(updated);
    setActiveScoreTake(take);

    if (activeScene && onUpdateScene) {
      onUpdateScene({
        ...activeScene,
        activeScoreUrl: take.audioUrl,
        scoreTakes: updated,
      });
    }

    toast.add({
      title: "Master Score Locked",
      description: `Take ${take.takeNumber} set as master soundtrack for ${activeScene?.title || "scene"}.`,
      type: "success",
    });
  };

  const toggleInstrument = (inst: string) => {
    setSelectedInstruments((prev) =>
      prev.includes(inst) ? prev.filter((i) => i !== inst) : [...prev, inst]
    );
  };

  // ── Inline rename state ──────────────────────────────────────────────────
  const [renamingTakeId, setRenamingTakeId] = React.useState<string | null>(null);
  const [draftTitle, setDraftTitle] = React.useState<string>("");
  const renameInputRef = React.useRef<HTMLInputElement>(null);

  const startRename = (take: ScoreTake, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingTakeId(take.id);
    setDraftTitle(take.title);
    // Focus on next tick after render
    setTimeout(() => renameInputRef.current?.focus(), 30);
  };

  const commitRename = (takeId: string) => {
    const trimmed = draftTitle.trim();
    if (trimmed && projectId) {
      renameScoreTake(projectId, takeId, trimmed, activeScene?.id);
      const updated = getScoreTakes(projectId, activeScene?.id);
      setCurrentScoreTakes(updated);
      // Update active take title in state if it was the one being renamed
      if (activeScoreTake?.id === takeId) {
        setActiveScoreTake((prev) => prev ? { ...prev, title: trimmed } : prev);
      }
    }
    setRenamingTakeId(null);
    setDraftTitle("");
  };

  const cancelRename = () => {
    setRenamingTakeId(null);
    setDraftTitle("");
  };




  return (
    <div className="flex flex-1 flex-col min-h-0 bg-background overflow-hidden">
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={activeScoreTake?.audioUrl || ""}
        preload="metadata"
      />

      {/* Main Workspace (Scrollable) */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-6">
        {/* Context Readiness & Information Inspector Banner */}
        <Card className="border-border/80 bg-gradient-to-r from-purple-950/20 via-background to-blue-950/20 shadow-md">
          <CardHeader className="pb-3 pt-4 px-4 sm:px-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-400">
                  <Activity className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-sm font-heading font-bold flex items-center gap-2">
                    <span>Scene Context Readiness for Lyria 3</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "font-mono text-[10px]",
                        readiness.scorePercentage >= 80
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                          : readiness.scorePercentage >= 50
                          ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                          : "border-rose-500/40 bg-rose-500/10 text-rose-300"
                      )}
                    >
                      {readiness.scorePercentage}% Ready ({readiness.readyCount}/{readiness.items.length} Signals)
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    {readiness.missingCount === 0
                      ? "All optimal scene context signals detected. Lyria 3 will compose with full audiovisual synchronization."
                      : `${readiness.missingCount} recommended context signal(s) missing. You can generate now, or review suggestions below to enrich composition.`}
                  </CardDescription>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowReadinessDetails(!showReadinessDetails)}
                  className="h-8 text-xs gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground"
                >
                  <Info className="h-3.5 w-3.5" />
                  <span>{showReadinessDetails ? "Hide Context Details" : "Inspect Signals"}</span>
                </Button>
                <Button
                  size="sm"
                  onClick={handleAutoSynthesize}
                  className="h-8 text-xs gap-1.5 bg-purple-600 hover:bg-purple-500 text-white shadow-xs cursor-pointer"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Auto-Synthesize from Scene</span>
                </Button>
              </div>
            </div>
          </CardHeader>

          {/* Context Signals Grid (Always shows summary chips; expands with details) */}
          <CardContent className="pt-0 px-4 sm:px-6 pb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2 pt-2">
              {readiness.items.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "p-2.5 rounded-lg border text-xs flex flex-col justify-between gap-1 transition-all",
                    item.isReady
                      ? "border-emerald-500/30 bg-emerald-500/5 text-foreground"
                      : "border-amber-500/30 bg-amber-500/5 text-muted-foreground"
                  )}
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="font-semibold text-[11px] truncate">{item.label}</span>
                    {item.isReady ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                    )}
                  </div>
                  <div className="text-[10px] truncate text-muted-foreground font-mono">
                    {item.valueDescription}
                  </div>
                </div>
              ))}
            </div>

            {/* Detailed Explanation Drawer when user clicks "Inspect Signals" */}
            {showReadinessDetails && (
              <div className="mt-4 p-3.5 rounded-lg border border-border/80 bg-secondary/30 space-y-3 animate-in fade-in-50 duration-200">
                <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <HelpCircle className="h-3.5 w-3.5 text-purple-400" />
                  <span>Why these signals matter for AI Music Composition</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  {readiness.items.map((item) => (
                    <div key={item.id} className="p-2.5 rounded border border-border/60 bg-background/50 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground">{item.label}</span>
                        <Badge variant="outline" className={cn("text-[9px] font-mono", item.isReady ? "text-emerald-400" : "text-amber-400")}>
                          {item.isReady ? "Active" : "Recommended"}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">{item.whyItMatters}</p>
                      {item.actionRecommendation && (
                        <p className="text-[10px] text-amber-400/90 font-mono pt-1">
                          💡 Tip: {item.actionRecommendation}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Studio Columns: Controls (Left) and Playback / Takes (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT: Composer Controls & Prompt (7 Columns) */}
          <div className="lg:col-span-7 space-y-5">
            {/* 1. Score Function, Media Scope & Duration Controls */}
            <Card className="border-border bg-card">
              <CardHeader className="pb-3 pt-4">
                <CardTitle className="text-xs font-heading uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>1. Score Scope, Role &amp; Duration</span>
                  <Badge variant="secondary" className="font-mono text-[10px]">
                    {durationSeconds <= 30 ? `Lyria 3 Clip (${durationSeconds}s)` : `Lyria 3 Pro (${durationSeconds}s)`}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                {/* Media Scope Switcher: Pure Audio vs Video Sync */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground flex items-center justify-between">
                    <span>Output Media Scope</span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {mediaDeliveryMode === "audio_only" ? "Standalone Music Track" : "Synced Audiovisual Composite"}
                    </span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setMediaDeliveryMode("audio_only")}
                      className={cn(
                        "p-2.5 rounded-lg border text-left transition-all cursor-pointer flex items-center gap-2.5",
                        mediaDeliveryMode === "audio_only"
                          ? "border-purple-500 bg-purple-500/10 text-foreground shadow-xs font-semibold"
                          : "border-border/70 hover:bg-secondary/40 text-muted-foreground"
                      )}
                    >
                      <div className="p-2 rounded bg-purple-500/10 text-purple-400 shrink-0">
                        <Music className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-heading">Music Only</div>
                        <div className="text-[10px] text-muted-foreground truncate">Pure audio score / track</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setMediaDeliveryMode("sync_video")}
                      className={cn(
                        "p-2.5 rounded-lg border text-left transition-all cursor-pointer flex items-center gap-2.5",
                        mediaDeliveryMode === "sync_video"
                          ? "border-purple-500 bg-purple-500/10 text-foreground shadow-xs font-semibold"
                          : "border-border/70 hover:bg-secondary/40 text-muted-foreground"
                      )}
                    >
                      <div className="p-2 rounded bg-purple-500/10 text-purple-400 shrink-0">
                        <Video className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-heading">Include Video Clip</div>
                        <div className="text-[10px] text-muted-foreground truncate">Sync with Veo 3.1 visual take</div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Score Type Buttons */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setScoreType("score")}
                    className={cn(
                      "p-2.5 rounded-lg border text-left transition-all cursor-pointer",
                      scoreType === "score"
                        ? "border-purple-500 bg-purple-500/10 text-foreground shadow-xs font-semibold"
                        : "border-border/70 hover:bg-secondary/40 text-muted-foreground"
                    )}
                  >
                    <div className="text-xs font-heading">Cinematic Score</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">Non-diegetic background score</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setScoreType("source")}
                    className={cn(
                      "p-2.5 rounded-lg border text-left transition-all cursor-pointer",
                      scoreType === "source"
                        ? "border-purple-500 bg-purple-500/10 text-foreground shadow-xs font-semibold"
                        : "border-border/70 hover:bg-secondary/40 text-muted-foreground"
                    )}
                  >
                    <div className="text-xs font-heading">In-World Source</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">Diegetic club/radio track</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setScoreType("vocal")}
                    className={cn(
                      "p-2.5 rounded-lg border text-left transition-all cursor-pointer",
                      scoreType === "vocal"
                        ? "border-purple-500 bg-purple-500/10 text-foreground shadow-xs font-semibold"
                        : "border-border/70 hover:bg-secondary/40 text-muted-foreground"
                    )}
                  >
                    <div className="text-xs font-heading">Vocal Theme</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">Custom lyrics &amp; vocals</div>
                  </button>
                </div>

                {/* Response Modalities Selector Chips (Lyria 3 API control) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <SlidersHorizontal className="h-3.5 w-3.5 text-purple-400" />
                      <span>Lyria 3 Response Modality</span>
                    </label>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      api: response_modalities={JSON.stringify(resolvedModalities)}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setResponseModality("AUDIO_TEXT")}
                      className={cn(
                        "p-2 rounded-lg border text-left transition-all cursor-pointer",
                        responseModality === "AUDIO_TEXT"
                          ? "border-purple-500 bg-purple-500/10 text-foreground font-semibold shadow-xs"
                          : "border-border/70 hover:bg-secondary/40 text-muted-foreground"
                      )}
                    >
                      <div className="text-xs font-heading flex items-center gap-1">
                        <span>Full Production</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground">Audio + Lyrics / Structure</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setResponseModality("AUDIO_ONLY")}
                      className={cn(
                        "p-2 rounded-lg border text-left transition-all cursor-pointer",
                        responseModality === "AUDIO_ONLY"
                          ? "border-purple-500 bg-purple-500/10 text-foreground font-semibold shadow-xs"
                          : "border-border/70 hover:bg-secondary/40 text-muted-foreground"
                      )}
                    >
                      <div className="text-xs font-heading flex items-center gap-1">
                        <span>Instrumental Only</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground">Pure Audio (No Text)</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setResponseModality("TEXT_ONLY")}
                      className={cn(
                        "p-2 rounded-lg border text-left transition-all cursor-pointer",
                        responseModality === "TEXT_ONLY"
                          ? "border-purple-500 bg-purple-500/10 text-foreground font-semibold shadow-xs"
                          : "border-border/70 hover:bg-secondary/40 text-muted-foreground"
                      )}
                    >
                      <div className="text-xs font-heading flex items-center gap-1">
                        <span>Score Sheet Only</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground">Lyrics &amp; Cues (Fast)</div>
                    </button>
                  </div>
                </div>

                {/* Duration Controls: Presets, Stepper & Precision Slider */}
                <div className="space-y-3 p-3 rounded-lg border border-border/80 bg-secondary/20">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-purple-400" />
                        <span>Music Duration Target</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Select whether music covers just the clip or extends further across the scene.
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="5"
                        max="180"
                        value={durationSeconds}
                        onChange={(e) => {
                          const val = Math.max(5, Math.min(180, parseInt(e.target.value) || 5));
                          setDurationSeconds(val);
                          setDurationMode(val > 30 ? "pro" : "clip");
                        }}
                        className="w-16 h-7 rounded border border-border bg-background px-2 text-xs font-mono text-center font-bold text-foreground"
                      />
                      <span className="text-xs text-muted-foreground font-mono">sec</span>
                    </div>
                  </div>

                  {/* Duration Slider */}
                  <div className="space-y-1">
                    <input
                      type="range"
                      min="5"
                      max="180"
                      step="1"
                      value={durationSeconds}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setDurationSeconds(val);
                        setDurationMode(val > 30 ? "pro" : "clip");
                      }}
                      className="w-full h-1.5 accent-purple-500 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                      <span>5s (Clip)</span>
                      <span>30s (Lyria Clip limit)</span>
                      <span>60s (1 min)</span>
                      <span>180s (3 min Pro max)</span>
                    </div>
                  </div>

                  {/* Quick Preset Buttons */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] text-muted-foreground font-mono">Presets:</span>
                    <button
                      type="button"
                      onClick={() => {
                        setDurationSeconds(videoClipDuration);
                        setDurationMode("clip");
                      }}
                      className={cn(
                        "px-2 py-0.5 rounded text-[11px] font-mono transition-colors cursor-pointer",
                        durationSeconds === videoClipDuration
                          ? "bg-purple-600 text-white font-bold"
                          : "bg-secondary text-muted-foreground hover:text-foreground border border-border/70"
                      )}
                    >
                      Match Video Clip ({videoClipDuration}s)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDurationSeconds(sceneCutDuration);
                        setDurationMode(sceneCutDuration > 30 ? "pro" : "clip");
                      }}
                      className={cn(
                        "px-2 py-0.5 rounded text-[11px] font-mono transition-colors cursor-pointer",
                        durationSeconds === sceneCutDuration && durationSeconds !== videoClipDuration
                          ? "bg-purple-600 text-white font-bold"
                          : "bg-secondary text-muted-foreground hover:text-foreground border border-border/70"
                      )}
                    >
                      Scene Cut ({sceneCutDuration}s)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDurationSeconds(60);
                        setDurationMode("pro");
                      }}
                      className={cn(
                        "px-2 py-0.5 rounded text-[11px] font-mono transition-colors cursor-pointer",
                        durationSeconds === 60
                          ? "bg-purple-600 text-white font-bold"
                          : "bg-secondary text-muted-foreground hover:text-foreground border border-border/70"
                      )}
                    >
                      60s (1 Min)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDurationSeconds(180);
                        setDurationMode("pro");
                      }}
                      className={cn(
                        "px-2 py-0.5 rounded text-[11px] font-mono transition-colors cursor-pointer",
                        durationSeconds === 180
                          ? "bg-purple-600 text-white font-bold"
                          : "bg-secondary text-muted-foreground hover:text-foreground border border-border/70"
                      )}
                    >
                      Full 3 Min Score (180s)
                    </button>
                  </div>

                  {/* Context Note on Timing */}
                  <div className="p-2 rounded bg-background/50 border border-border/60 text-[11px] text-muted-foreground leading-relaxed">
                    {durationSeconds <= videoClipDuration ? (
                      <span className="text-emerald-400 font-mono">
                        ✓ Tightly bounded to the {videoClipDuration}s video cut. Music resolves cleanly at the cut point.
                      </span>
                    ) : (
                      <span>
                        💡 Music extends for {durationSeconds}s across the sequence.{" "}
                        {mediaDeliveryMode === "sync_video" && (
                          <span className="text-purple-300">
                            Video will loop smoothly during preview while the full score plays.
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                </div>

                {/* Multimodal Moodboard Reference Selector (Up to 10 Images) */}
                <div className="space-y-2 p-3 rounded-lg border border-border/80 bg-secondary/15">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="moodboard-toggle"
                        checked={includeImageConditioning}
                        onChange={(e) => setIncludeImageConditioning(e.target.checked)}
                        className="h-4 w-4 rounded accent-purple-600 cursor-pointer"
                      />
                      <label htmlFor="moodboard-toggle" className="text-xs font-semibold text-foreground cursor-pointer flex items-center gap-1.5">
                        <ImageIcon className="h-3.5 w-3.5 text-blue-400" />
                        <span>Multimodal Moodboard Conditioning</span>
                      </label>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-mono text-[10px]",
                          selectedMoodboardUrls.length > 0 ? "text-purple-300 border-purple-500/40 bg-purple-500/10" : "text-muted-foreground"
                        )}
                      >
                        {selectedMoodboardUrls.length} / 10 attached
                      </Badge>
                      {includeImageConditioning && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={selectAllSceneImages}
                            className="text-[10px] text-purple-400 hover:text-purple-300 underline cursor-pointer"
                          >
                            Scene All
                          </button>
                          <span className="text-muted-foreground text-[10px]">·</span>
                          <button
                            type="button"
                            onClick={() => setIsAssetPickerOpen(true)}
                            className="text-[10px] text-accent hover:underline flex items-center gap-1 cursor-pointer font-medium"
                          >
                            <Upload className="h-2.5 w-2.5" />
                            <span>Add from Asset Hub...</span>
                          </button>
                          <span className="text-muted-foreground text-[10px]">·</span>
                          <button
                            type="button"
                            onClick={clearMoodboard}
                            className="text-[10px] text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            Clear
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Images from <span className="text-foreground font-medium">this scene only</span> — keyframes, scouting shots, and timeline stills. Lyria 3 reads colour palette, lighting, and mood from each selected image.
                  </p>

                  {includeImageConditioning && (
                    <div className="pt-2">
                      {moodboardCandidates.length === 0 ? (
                        <div className="p-3 text-center rounded border border-dashed border-border/70 text-[11px] text-muted-foreground">
                          No images for this scene yet. Generate scouting shots in <span className="text-foreground">Scene Scouting</span> or capture timeline frames in the <span className="text-foreground">Timeline</span> tab.
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-1">
                          {moodboardCandidates.map((candidate) => {
                            const isSelected = selectedMoodboardUrls.includes(candidate.url);
                            const sourceLabel =
                              candidate.type === "scene_keyframe" ? "Keyframe" :
                              candidate.type === "scene_scout" ? "Scout" :
                              candidate.type === "timeline_moment" ? "Timeline" : candidate.type;
                            const sourceBadgeClass =
                              candidate.type === "scene_keyframe" ? "bg-amber-500/80 text-black" :
                              candidate.type === "scene_scout" ? "bg-blue-500/80 text-white" :
                              "bg-purple-500/80 text-white";
                            return (
                              <button
                                key={candidate.id}
                                type="button"
                                onClick={() => toggleMoodboardImage(candidate.url)}
                                className={cn(
                                  "relative group rounded-md overflow-hidden border text-left transition-all cursor-pointer aspect-video bg-black/40",
                                  isSelected
                                    ? "border-purple-500 ring-2 ring-purple-500/40"
                                    : "border-border/60 hover:border-border opacity-70 hover:opacity-100"
                                )}
                              >
                                <img
                                  src={candidate.url}
                                  alt={candidate.label}
                                  className="w-full h-full object-cover"
                                />

                                {/* Source type chip */}
                                <div className={cn("absolute top-1 left-1 px-1 py-0.5 rounded text-[8px] font-mono font-bold", sourceBadgeClass)}>
                                  {sourceLabel}
                                </div>

                                {/* Checkmark Overlay */}
                                <div
                                  className={cn(
                                    "absolute top-1 right-1 p-0.5 rounded-full transition-colors",
                                    isSelected ? "bg-purple-600 text-white" : "bg-black/60 text-white/50"
                                  )}
                                >
                                  <Check className="h-3 w-3" />
                                </div>

                                {/* Label Banner */}
                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-1">
                                  <div className="text-[9px] font-sans text-white truncate font-medium">
                                    {candidate.label}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 2. Instrumentation & Dynamic Arc */}
            <Card className="border-border bg-card">
              <CardHeader className="pb-3 pt-4">
                <CardTitle className="text-xs font-heading uppercase tracking-wider text-muted-foreground">
                  2. Acoustic Palette &amp; Dynamic Arc
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                {/* Dynamic Progression Presets */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Dynamic Progression Arc</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {DYNAMIC_ARCS.map((arc) => (
                      <button
                        key={arc.id}
                        type="button"
                        onClick={() => setSelectedArc(arc.id)}
                        className={cn(
                          "px-2.5 py-1.5 rounded-md border text-left text-xs transition-all cursor-pointer flex items-center justify-between",
                          selectedArc === arc.id
                            ? "border-purple-500 bg-purple-500/10 text-foreground font-semibold"
                            : "border-border/60 hover:bg-secondary/40 text-muted-foreground"
                        )}
                      >
                        <span className="truncate">{arc.label}</span>
                        {selectedArc === arc.id && <Check className="h-3 w-3 text-purple-400 shrink-0 ml-1" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Instrumentation Chips */}
                <div className="space-y-1.5 pt-1">
                  <label className="text-xs font-medium text-foreground">Lead Instrumentation (Multi-select)</label>
                  <div className="flex flex-wrap gap-1.5">
                    {INSTRUMENT_OPTIONS.map((inst) => {
                      const isSelected = selectedInstruments.includes(inst);
                      return (
                        <button
                          key={inst}
                          type="button"
                          onClick={() => toggleInstrument(inst)}
                          className={cn(
                            "px-2.5 py-1 rounded-full text-xs font-mono transition-all cursor-pointer flex items-center gap-1",
                            isSelected
                              ? "bg-purple-600/80 text-white font-semibold shadow-xs"
                              : "bg-secondary/60 text-muted-foreground hover:text-foreground border border-border/60"
                          )}
                        >
                          {isSelected && <Check className="h-3 w-3" />}
                          <span>{inst}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Vocal Studio (Only active if Vocal Theme is picked) */}
                {scoreType === "vocal" && (
                  <div className="space-y-3 pt-3 border-t border-border/80">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Mic className="h-3.5 w-3.5 text-purple-400" />
                        <span>Vocal Studio &amp; Lyrics</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground font-mono">Language:</span>
                        <select
                          value={targetLanguage}
                          onChange={(e) => setTargetLanguage(e.target.value)}
                          className="text-xs bg-secondary border border-border rounded px-2 py-0.5 text-foreground cursor-pointer"
                        >
                          {SUPPORTED_LANGUAGES.map((lang) => (
                            <option key={lang} value={lang}>
                              {lang}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] text-muted-foreground">Vocal Profile</label>
                      <select
                        value={vocalProfile}
                        onChange={(e) => setVocalProfile(e.target.value)}
                        className="w-full text-xs bg-secondary border border-border rounded px-2.5 py-1.5 text-foreground cursor-pointer"
                      >
                        {VOCAL_PROFILES.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] text-muted-foreground">Custom Lyrics / Song Structure</label>
                        <button
                          type="button"
                          onClick={() => {
                            const drafted = autoDraftLyrics(
                              activeScene?.title || "Scene",
                              activeScene?.summary || "",
                              activeScene?.screenplayText,
                              genre
                            );
                            setCustomLyrics(drafted);
                            toast.add({
                              title: "Lyrics Generated",
                              description: "Auto-drafted rhymed verses from screenplay subtext.",
                              type: "success",
                            });
                          }}
                          className="text-[10px] text-purple-400 hover:text-purple-300 flex items-center gap-1 cursor-pointer"
                        >
                          <Sparkles className="h-3 w-3" />
                          <span>Auto-Draft from Script</span>
                        </button>
                      </div>
                      <Textarea
                        rows={5}
                        value={customLyrics}
                        onChange={(e) => setCustomLyrics(e.target.value)}
                        placeholder="[Verse 1]&#10;Shadows fall upon the street...&#10;&#10;[Chorus]&#10;In the silence of the night..."
                        className="text-xs font-mono bg-secondary/30 resize-none border-border"
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 3. Composed Music Prompt & Execution */}
            <Card className="border-border bg-card">
              <CardHeader className="pb-3 pt-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs font-heading uppercase tracking-wider text-muted-foreground">
                    3. Synthesized Lyria 3 Prompt
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleAutoSynthesize}
                    className="h-6 text-[11px] text-purple-400 hover:text-purple-300 gap-1 px-2 cursor-pointer"
                  >
                    <RefreshCw className="h-3 w-3" />
                    <span>Re-synthesize</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <Textarea
                  rows={3}
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  placeholder="Enter cinematic score prompt describing tempo, mood, acoustic space..."
                  className="text-xs leading-relaxed bg-secondary/30 border-border resize-none font-sans"
                />

                {/* Live SSE Streaming Toggle */}
                <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/80 bg-secondary/20">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="streaming-toggle"
                      checked={enableStreaming}
                      onChange={(e) => setEnableStreaming(e.target.checked)}
                      className="h-4 w-4 rounded accent-purple-600 cursor-pointer"
                    />
                    <label htmlFor="streaming-toggle" className="text-xs font-medium text-foreground cursor-pointer flex items-center gap-1.5">
                      <Zap className="h-3.5 w-3.5 text-amber-400" />
                      <span>Real-Time SSE Live Stream Generation</span>
                    </label>
                  </div>

                  <Badge variant="outline" className="font-mono text-[9px] text-muted-foreground">
                    {enableStreaming ? "Typewriter Stream Active" : "Standard Batch Render"}
                  </Badge>
                </div>

                {/* Live Typewriter Streaming Telemetry Box */}
                {(isGenerating || streamingText) && (
                  <div className="p-3 rounded-lg border border-purple-500/30 bg-purple-950/10 space-y-1.5 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between text-[11px] font-mono text-purple-300">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-purple-400 animate-ping" />
                        <span>{generationStage || "Lyria 3 Live Telemetry"}</span>
                      </div>
                      {streamingText && (
                        <button
                          type="button"
                          onClick={() => handleCopyLyrics(streamingText)}
                          className="hover:text-purple-200 flex items-center gap-1 cursor-pointer"
                        >
                          {copiedLyrics ? <CheckCheck className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          <span>{copiedLyrics ? "Copied" : "Copy"}</span>
                        </button>
                      )}
                    </div>
                    {streamingText && (
                      <pre className="text-xs font-mono text-foreground/90 whitespace-pre-wrap max-h-36 overflow-y-auto leading-relaxed pt-1">
                        {streamingText}
                        {isGenerating && <span className="inline-block w-1.5 h-3.5 bg-purple-400 ml-1 animate-pulse" />}
                      </pre>
                    )}
                  </div>
                )}

                {/* Multi-Track Music Quantity & Variation Mode */}
                <div className="space-y-2 p-3 rounded-lg border border-border/80 bg-secondary/15">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Zap className="h-3.5 w-3.5 text-amber-400" />
                      <span>Multi-Track Variations</span>
                    </label>
                    <Badge variant="outline" className="font-mono text-[9px] border-purple-500/30 text-purple-300">
                      {musicBatchCount} {musicBatchCount === 1 ? "Cue" : "Variations"}
                    </Badge>
                  </div>

                  {/* Quantity selector */}
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { count: 1, label: "1 Cue" },
                      { count: 2, label: "2 Variations" },
                      { count: 3, label: "3 Variations" },
                      { count: 4, label: "4 Suite" },
                    ].map(({ count, label }) => {
                      const isSelected = musicBatchCount === count;
                      return (
                        <button
                          key={count}
                          type="button"
                          onClick={() => setMusicBatchCount(count)}
                          className={cn(
                            "py-1 px-1 rounded border text-[10px] font-mono transition-all text-center cursor-pointer",
                            isSelected
                              ? "border-purple-500 bg-purple-500/20 text-purple-200 font-bold"
                              : "border-border bg-secondary/30 text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>

                  {musicBatchCount > 1 && (
                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setVariationMode("arrangements")}
                        className={cn(
                          "py-1 px-2 rounded border text-[10px] text-left cursor-pointer transition-all",
                          variationMode === "arrangements"
                            ? "border-purple-500/80 bg-purple-500/15 text-purple-200 font-semibold"
                            : "border-border/60 bg-secondary/20 text-muted-foreground hover:text-foreground"
                        )}
                        title="Varies dynamic arc: urgent pulses, atmospheric decay, and symphonic swell"
                      >
                        <span className="block font-mono font-bold">Arrangements</span>
                        <span className="text-[8px] text-muted-foreground">Dynamic arc shifts</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setVariationMode("timbres")}
                        className={cn(
                          "py-1 px-2 rounded border text-[10px] text-left cursor-pointer transition-all",
                          variationMode === "timbres"
                            ? "border-purple-500/80 bg-purple-500/15 text-purple-200 font-semibold"
                            : "border-border/60 bg-secondary/20 text-muted-foreground hover:text-foreground"
                        )}
                        title="Varies instrumentation: analog synth, solo strings, and hybrid distortion"
                      >
                        <span className="block font-mono font-bold">Timbres</span>
                        <span className="text-[8px] text-muted-foreground">Sonic texture shifts</span>
                      </button>
                    </div>
                  )}
                </div>

                <Button
                  onClick={() => handleGenerateScore(musicBatchCount, variationMode)}
                  disabled={isGenerating || !promptText.trim()}
                  className="w-full h-10 text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-lg cursor-pointer gap-2"
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>
                        {batchProgress && batchProgress.total > 1
                          ? `Composing Variation ${batchProgress.current}/${batchProgress.total}: ${batchProgress.stageName}...`
                          : (generationStage || "Composing Scene Score...")}
                      </span>
                    </>
                  ) : (
                    <>
                      <Music className="h-4 w-4" />
                      <span>
                        {musicBatchCount > 1
                          ? `Generate ${musicBatchCount} Score Variations`
                          : `Generate Scene Score (${durationMode === "clip" ? "30s Clip" : "3 min Pro"} · ${responseModality === "TEXT_ONLY" ? "Score Sheet" : "Audio"})`}
                      </span>
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* RIGHT: Master Playback, Dual-Track Synced Cinema & Takes Reel (5 Columns) */}
          <div className="lg:col-span-5 space-y-5">
            {/* Master Audio / Video Player Card */}
            <Card className="border-border bg-card overflow-hidden shadow-xl">
              <CardHeader className="pb-2 pt-3 px-4 bg-secondary/40 border-b border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-heading font-semibold text-xs text-foreground truncate">
                      {activeScoreTake ? activeScoreTake.title : "Scene Score Player"}
                    </span>
                    {activeScoreTake?.isMaster && (
                      <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[9px] font-mono">
                        <Star className="h-2.5 w-2.5 mr-0.5 fill-amber-400" /> Master
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 bg-secondary/80 p-0.5 rounded border border-border/80">
                      <button
                        type="button"
                        onClick={() => setMediaDeliveryMode("audio_only")}
                        className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-mono cursor-pointer transition-colors",
                          mediaDeliveryMode === "audio_only"
                            ? "bg-purple-600 text-white font-bold"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        Music Only
                      </button>
                      <button
                        type="button"
                        onClick={() => setMediaDeliveryMode("sync_video")}
                        className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-mono cursor-pointer transition-colors",
                          mediaDeliveryMode === "sync_video"
                            ? "bg-purple-600 text-white font-bold"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        Video Sync
                      </button>
                    </div>
                    <Badge variant="outline" className="font-mono text-[9px]">
                      {activeScoreTake?.durationMode === "pro" ? "Lyria 3 Pro" : "Lyria 3 Clip"}
                    </Badge>
                    {activeScoreTake && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => handleDeleteScoreTake(activeScoreTake.id, e)}
                        className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-1 cursor-pointer"
                        title="Delete current score take"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span className="hidden sm:inline">Delete</span>
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-4 space-y-4">
                {/* Media Monitor: Video Sync vs Standalone Audio Visualizer */}
                {mediaDeliveryMode === "sync_video" ? (
                  <div className="space-y-2">
                    {/* Video Monitor */}
                    <div className="relative rounded-lg overflow-hidden bg-black aspect-video border border-border flex items-center justify-center group">
                      <video
                        ref={videoRef}
                        src={selectedVideoUrl}
                        className="w-full h-full object-cover"
                        playsInline
                        loop
                        muted={isMuted || videoBalance === 1}
                      />

                      {/* Play Overlay */}
                      <button
                        type="button"
                        onClick={togglePlay}
                        className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      >
                        <div className="p-3.5 rounded-full bg-purple-600/90 text-white shadow-lg hover:scale-105 transition-transform">
                          {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 ml-0.5" />}
                        </div>
                      </button>

                      <div className="absolute top-2 left-2 flex items-center gap-1.5">
                        <Badge className="bg-black/70 backdrop-blur-md text-[10px] font-mono text-white border-white/10">
                          Synced ({durationSeconds}s Score + {videoClipDuration}s Video)
                        </Badge>
                      </div>
                    </div>

                    {/* Video clip selector — pick which take to sync with */}
                    {videoTakes.length > 0 ? (
                      <div className="rounded-lg border border-border/70 bg-secondary/10 p-2.5 space-y-1.5">
                        <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                          <Video className="h-3 w-3" />
                          Select Video Clip to Sync
                          <Badge variant="secondary" className="font-mono text-[9px] ml-auto">
                            {videoTakes.length} clip{videoTakes.length !== 1 ? "s" : ""}
                          </Badge>
                        </p>
                        <div className="space-y-1">
                          {videoTakes.map((vt) => {
                            const isSelected = selectedVideoUrl === vt.videoUrl;
                            return (
                              <button
                                key={vt.id}
                                type="button"
                                onClick={() => {
                                  setSelectedVideoUrl(vt.videoUrl);
                                  if (isPlaying && videoRef.current) {
                                    videoRef.current.src = vt.videoUrl;
                                    videoRef.current.play().catch(() => {});
                                  }
                                }}
                                className={cn(
                                  "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md border text-left transition-all cursor-pointer",
                                  isSelected
                                    ? "border-purple-500/70 bg-purple-500/10 text-foreground"
                                    : "border-border/50 bg-secondary/20 text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                                )}
                              >
                                <div className="p-1 rounded bg-secondary/80 text-purple-400 shrink-0">
                                  <Video className="h-3 w-3" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[11px] font-semibold truncate">{vt.title}</span>
                                    {vt.isMaster && (
                                      <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[8px] font-mono px-1 py-0 shrink-0">
                                        Master
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="text-[9px] font-mono text-muted-foreground/60">{vt.durationSec}s</span>
                                    {vt.cameraMotion && (
                                      <span className="text-[9px] font-mono text-muted-foreground/50 truncate">· {vt.cameraMotion}</span>
                                    )}
                                  </div>
                                </div>
                                {isSelected && (
                                  <CheckIcon className="h-3.5 w-3.5 text-purple-400 shrink-0" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-border/60 p-3 text-center text-[11px] text-muted-foreground">
                        No video takes yet. Generate a video in the Veo 3.1 studio — it will appear here for sync.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="relative rounded-lg overflow-hidden bg-gradient-to-br from-purple-950/40 via-background to-blue-950/40 aspect-[16/8] border border-border flex flex-col items-center justify-center p-6 text-center space-y-3">
                    <div className="flex items-center gap-1.5 h-12">
                      {[40, 70, 95, 60, 85, 100, 75, 45, 90, 65, 80, 50, 95, 70, 40].map((h, idx) => (
                        <div
                          key={idx}
                          className={cn(
                            "w-1.5 rounded-full transition-all duration-300",
                            isPlaying
                              ? "bg-gradient-to-t from-purple-500 to-cyan-400 animate-pulse"
                              : "bg-purple-500/30"
                          )}
                          style={{
                            height: isPlaying ? `${Math.max(15, h * (idx % 2 === 0 ? 0.9 : 1.1))}%` : "20%",
                            animationDelay: `${idx * 75}ms`,
                          }}
                        />
                      ))}
                    </div>

                    <div className="space-y-1">
                      <div className="text-xs font-heading font-bold text-foreground">
                        {activeScoreTake ? activeScoreTake.title : "Pure Audio Master"}
                      </div>
                      <p className="text-[11px] text-muted-foreground font-mono">
                        {durationSeconds}s Target · {durationSeconds <= 30 ? "Lyria 3 Clip Model" : "Lyria 3 Pro Model"} · SynthID Watermarked
                      </p>
                    </div>
                  </div>
                )}

                {/* Waveform Scrubber & Transport Controls */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
                    <span>{formatTime(audioCurrentTime)}</span>
                    <div className="flex items-center gap-1">
                      <span className="text-purple-400 font-bold font-sans text-[11px]">
                        {activeScoreTake?.model || "Google Lyria 3"}
                      </span>
                    </div>
                    <span>{formatTime(audioDuration || (activeScoreTake?.durationSec || 30))}</span>
                  </div>

                  {/* Progress bar */}
                  <div
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const clickPos = (e.clientX - rect.left) / rect.width;
                      if (audioRef.current && audioDuration) {
                        audioRef.current.currentTime = clickPos * audioDuration;
                        if (videoRef.current) {
                          videoRef.current.currentTime = clickPos * audioDuration;
                        }
                      }
                    }}
                    className="h-2 rounded-full bg-secondary/80 overflow-hidden cursor-pointer relative"
                  >
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all"
                      style={{
                        width: `${audioDuration ? (audioCurrentTime / audioDuration) * 100 : 0}%`,
                      }}
                    />
                  </div>

                  {/* Transport Buttons */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={togglePlay}
                        className="h-8 w-8 rounded-full p-0 bg-purple-600 hover:bg-purple-500 text-white cursor-pointer shadow-xs"
                      >
                        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
                      </Button>

                      <button
                        type="button"
                        onClick={() => setIsMuted(!isMuted)}
                        className="text-muted-foreground hover:text-foreground cursor-pointer p-1"
                      >
                        {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                      </button>

                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={volume}
                        onChange={(e) => setVolume(parseFloat(e.target.value))}
                        className="w-16 h-1 accent-purple-500 cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center gap-1.5">
                      {activeScoreTake && !activeScoreTake.isMaster && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSetMaster(activeScoreTake)}
                          className="h-7 text-xs gap-1 cursor-pointer border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
                        >
                          <Star className="h-3 w-3" />
                          <span>Set Master</span>
                        </Button>
                      )}

                      {activeScoreTake?.audioUrl && (
                        <a
                          href={activeScoreTake.audioUrl}
                          download={`score_${activeScene?.title || "scene"}.wav`}
                          className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer"
                          title="Download Audio Track"
                        >
                          <Download className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Crossfader between Video Dialogue & Lyria Score (Only in Video Sync mode) */}
                  {mediaDeliveryMode === "sync_video" && (
                    <div className="pt-2 border-t border-border/70 space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                        <span>Video Sound</span>
                        <span className="font-semibold text-foreground">Audiovisual Balance</span>
                        <span>Lyria Score</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={videoBalance}
                        onChange={(e) => setVideoBalance(parseFloat(e.target.value))}
                        className="w-full h-1 accent-purple-500 cursor-pointer"
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Lyrics & Score Sheet Viewer */}
            {activeScoreTake?.lyricsText && (
              <Card className="border-border bg-card shadow-md">
                <CardHeader className="pb-2 pt-3 px-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-heading uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-purple-400" />
                      <span>Lyria Lyrical Score Sheet &amp; Cues</span>
                    </CardTitle>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCopyLyrics(activeScoreTake.lyricsText || "")}
                      className="h-6 text-[11px] gap-1 px-2 cursor-pointer text-muted-foreground hover:text-foreground"
                    >
                      {copiedLyrics ? <CheckCheck className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      <span>{copiedLyrics ? "Copied" : "Copy"}</span>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-1">
                  <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed bg-secondary/30 p-2.5 rounded-md border border-border/60">
                    {activeScoreTake.lyricsText}
                  </pre>
                </CardContent>
              </Card>
            )}

            {/* Saved Score Takes Vault */}
            <Card className="border-border bg-card">
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-xs font-heading uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Music className="h-3.5 w-3.5 text-purple-400" />
                    <span>Score Takes Vault</span>
                    <Badge variant="secondary" className="font-mono text-[9px]">
                      {currentScoreTakes.length} {currentScoreTakes.length === 1 ? "take" : "takes"}
                    </Badge>
                  </div>
                  <span className="text-[9px] font-normal normal-case tracking-normal text-muted-foreground/60">
                    click row to audition · pencil to rename
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-1 space-y-2">
                {currentScoreTakes.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground border border-dashed border-border rounded-lg">
                    No score takes yet for this scene. Configure the prompt and click &quot;Generate Scene Score&quot;.
                  </div>
                ) : (
                  currentScoreTakes.map((take) => {
                    const isActive = activeScoreTake?.id === take.id;
                    const isRenaming = renamingTakeId === take.id;
                    return (
                      <div
                        key={take.id}
                        className={cn(
                          "rounded-lg border text-xs transition-all",
                          isActive
                            ? "border-purple-500/80 bg-purple-500/10 shadow-xs"
                            : "border-border/60 hover:bg-secondary/40"
                        )}
                      >
                        {/* Main row */}
                        <div className="flex items-center gap-2.5 p-2.5">
                          {/* Icon */}
                          <button
                            type="button"
                            className="p-2 rounded bg-secondary/80 text-purple-400 shrink-0 cursor-pointer hover:bg-secondary"
                            onClick={() => {
                              setActiveScoreTake(take);
                              setIsPlaying(false);
                            }}
                            title="Select take"
                          >
                            {take.audioUrl ? <Music className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5 text-blue-400" />}
                          </button>

                          {/* Title / rename field */}
                          <div className="min-w-0 flex-1">
                            {isRenaming ? (
                              <div className="flex items-center gap-1">
                                <input
                                  ref={renameInputRef}
                                  type="text"
                                  value={draftTitle}
                                  onChange={(e) => setDraftTitle(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") { e.preventDefault(); commitRename(take.id); }
                                    if (e.key === "Escape") cancelRename();
                                  }}
                                  onBlur={() => commitRename(take.id)}
                                  className="flex-1 min-w-0 px-1.5 py-0.5 rounded border border-purple-500/60 bg-purple-950/20 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                                  placeholder="Take name…"
                                />
                                <button
                                  type="button"
                                  onMouseDown={(e) => { e.preventDefault(); commitRename(take.id); }}
                                  className="p-1 rounded text-emerald-400 hover:bg-emerald-500/10 cursor-pointer"
                                  title="Save name"
                                >
                                  <CheckIcon className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  onMouseDown={(e) => { e.preventDefault(); cancelRename(); }}
                                  className="p-1 rounded text-muted-foreground hover:text-foreground cursor-pointer"
                                  title="Cancel rename"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ) : (
                              <div
                                className="flex items-center gap-1.5 cursor-pointer"
                                onClick={() => { setActiveScoreTake(take); setIsPlaying(false); }}
                              >
                                <span className="font-semibold text-foreground truncate max-w-[160px]">
                                  {take.title}
                                </span>
                                {take.isMaster && (
                                  <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[8px] font-mono px-1 py-0 shrink-0">
                                    Master
                                  </Badge>
                                )}
                                {take.conditioningImageUrls && take.conditioningImageUrls.length > 0 && (
                                  <Badge variant="outline" className="text-[8px] font-mono px-1 py-0 text-blue-300 border-blue-500/30 shrink-0">
                                    {take.conditioningImageUrls.length}img
                                  </Badge>
                                )}
                              </div>
                            )}

                            {/* Subtitle meta row */}
                            {!isRenaming && (
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[10px] font-mono text-muted-foreground/60">
                                  {take.durationSec}s
                                </span>
                                {take.scoreType && (
                                  <span className="text-[9px] font-mono text-purple-400/60 capitalize">
                                    · {take.scoreType}
                                  </span>
                                )}
                                {take.model && (
                                  <span className="text-[9px] font-mono text-muted-foreground/40 truncate">
                                    · {take.model}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Action buttons */}
                          <div className="flex items-center gap-0.5 shrink-0">
                            {/* Rename */}
                            {!isRenaming && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => startRename(take, e)}
                                className="h-7 w-7 p-0 cursor-pointer text-muted-foreground hover:text-purple-300 hover:bg-purple-500/10"
                                title="Rename take"
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                            )}

                            {/* Play/Pause */}
                            {take.audioUrl && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setActiveScoreTake(take);
                                  togglePlay();
                                }}
                                className="h-7 w-7 p-0 cursor-pointer text-muted-foreground hover:text-foreground"
                                title={isActive && isPlaying ? "Pause" : "Play"}
                              >
                                {isActive && isPlaying ? (
                                  <Pause className="h-3.5 w-3.5" />
                                ) : (
                                  <Play className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            )}

                            {/* Download */}
                            {take.audioUrl && (
                              <a
                                href={take.audioUrl}
                                download={`score_${take.title.replace(/\s+/g, "_").toLowerCase()}.wav`}
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer"
                                title="Download audio"
                              >
                                <Download className="h-3.5 w-3.5" />
                              </a>
                            )}

                            {/* Set master */}
                            {!take.isMaster && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => { e.stopPropagation(); handleSetMaster(take); }}
                                className="h-7 w-7 p-0 cursor-pointer text-muted-foreground hover:text-amber-300 hover:bg-amber-500/10"
                                title="Set as master score"
                              >
                                <Star className="h-3.5 w-3.5" />
                              </Button>
                            )}

                            {/* Delete */}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => handleDeleteScoreTake(take.id, e)}
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                              title="Delete take"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>

                        {/* Lyrics preview if available */}
                        {isActive && take.lyricsText && !isRenaming && (
                          <div className="px-3 pb-2.5 pt-0">
                            <div className="px-2.5 py-1.5 rounded-md bg-secondary/30 border border-border/50">
                              <p className="text-[9px] font-mono text-muted-foreground/70 line-clamp-2 leading-relaxed">
                                {take.lyricsText}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Lyria Moodboard Asset Picker Modal */}
      <AssetPickerModal
        open={isAssetPickerOpen}
        onOpenChange={setIsAssetPickerOpen}
        title="Select Moodboard Reference for Lyria 3 Music Score"
        description="Choose an uploaded concept plate, style image, or location reference from your Asset Hub."
        acceptedTypes={["image"]}
        acceptedCategories={["style", "location", "character_face", "general"]}
        onSelectAsset={(asset) => {
          const newEntry = {
            id: `hub-${Date.now()}`,
            url: asset.url,
            label: `${asset.name} (Hub)`,
            type: "scene_scout" as const,
          };
          setCustomHubImages((prev) => [newEntry, ...prev]);
          setSelectedMoodboardUrls((prev) => {
            if (prev.includes(asset.url)) return prev;
            if (prev.length >= 10) return prev;
            return [...prev, asset.url];
          });
          toast.add({
            title: "Moodboard Reference Added",
            description: `"${asset.name}" added to Lyria 3 musical conditioning set.`,
            type: "success",
          });
        }}
      />
    </div>
  );
}

function formatTime(seconds: number): string {
  if (isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
