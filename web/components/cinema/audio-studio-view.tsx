"use client";

import * as React from "react";
import { SlateLabel } from "@/components/cinema/slate-label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { notifyIfFallback } from "@/lib/fallback-notice";
import {
  Volume2,
  VolumeX,
  Play,
  Pause,
  Sparkles,
  Sliders,
  Headphones,
  Radio,
  RotateCcw,
  Check,
  Film,
  Music,
  User,
  MessageSquare,
  Volume1,
  Layers,
  Activity,
  Mic,
  RefreshCw,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProjectCharacter } from "@/lib/project-store";

interface AudioStudioViewProps {
  characters: ProjectCharacter[];
  screenplayText: string;
  sceneTitle: string;
  onOpenVideoGenerator?: () => void;
}

interface ChannelVoiceState {
  id: string;
  name: string;
  characterKey: string;
  voiceName: string;
  deliveryStyle: string;
  speed: number; // 0.8 to 1.3
  pitchFine: number; // -6 to +6
  formantShift: number; // -6 to +6
  pan: number; // -100 to +100
  reverbSend: number; // 0 to 100%
  reverbRoom: string;
  isMuted: boolean;
  isSolo: boolean;
}

const AVAILABLE_VOICES = [
  { id: "Fenrir", label: "Fenrir (Deep, Measured, Noir Resonance)", gender: "Male", comp: "Detective / Anti-Hero" },
  { id: "Aoede", label: "Aoede (Dynamic, Expressive, Sharp Intensity)", gender: "Female", comp: "Informant / Lead Female" },
  { id: "Puck", label: "Puck (Agile, Naturalistic, Quick-witted)", gender: "Neutral", comp: "Hacker / Tech Specialist" },
  { id: "Zephyr", label: "Zephyr (Whispering, Low-Register Noir)", gender: "Male", comp: "Narrator / Mastermind" },
  { id: "Charon", label: "Charon (Authoritative, Deep Sub-Bass)", gender: "Male", comp: "Colonel / Mob Boss" },
  { id: "Kore", label: "Kore (Crisp, Articulate, Razor-Sharp)", gender: "Female", comp: "Executive / Corrupt Official" },
];

const DELIVERY_STYLES = [
  "High Stakes Interrogation",
  "Whispered Urgency (Breath-Heavy)",
  "Cold Analytical (Detached)",
  "Gravelly Neo-Noir",
  "Heated Confrontation (Crescendo)",
  "Subtle Veiled Subtext",
];

const REVERB_ROOMS = [
  { id: "vault", name: "Interrogation Vault (Dry Concrete)", desc: "Short decay, cold reflections, high dialogue clarity" },
  { id: "pier", name: "Rain-Slicked Pier (Exterior Slap)", desc: "Open air slapback with distant ambient spill" },
  { id: "warehouse", name: "Industrial Warehouse (Long Tail)", desc: "Deep cinematic metallic reverberation" },
  { id: "soundstage", name: "Scoring Sound Stage (Warm Wood)", desc: "Acoustically treated Hollywood soundstage" },
];

export function AudioStudioView({
  characters,
  screenplayText,
  sceneTitle,
  onOpenVideoGenerator,
}: AudioStudioViewProps) {
  const [activeTab, setActiveTab] = React.useState<"tableread" | "cast" | "acoustics">("tableread");

  // Character voice profiles
  const [channels, setChannels] = React.useState<Record<string, ChannelVoiceState>>(() => {
    if (characters && characters.length > 0) {
      const initial: Record<string, ChannelVoiceState> = {};
      characters.forEach((c, idx) => {
        const id = `DX${idx + 1}`;
        const key = c.name.toUpperCase().replace(/\s+/g, "_");
        const voiceChoice = AVAILABLE_VOICES[idx % AVAILABLE_VOICES.length];
        const styleChoice = DELIVERY_STYLES[idx % DELIVERY_STYLES.length];
        initial[id] = {
          id,
          name: c.name.toUpperCase(),
          characterKey: key,
          voiceName: (c as any).voiceName || voiceChoice.id,
          deliveryStyle: styleChoice,
          speed: 1.0,
          pitchFine: 0,
          formantShift: idx % 2 === 0 ? -2 : 1,
          pan: idx === 0 ? -20 : idx === 1 ? 20 : 0,
          reverbSend: 20,
          reverbRoom: "Interrogation Vault (Dry Concrete)",
          isMuted: false,
          isSolo: false,
        };
      });
      return initial;
    }
    return {
      DX1: {
        id: "DX1",
        name: "MARCUS",
        characterKey: "MARCUS",
        voiceName: "Fenrir",
        deliveryStyle: "High Stakes Interrogation",
        speed: 1.0,
        pitchFine: 0,
        formantShift: -2,
        pan: -20,
        reverbSend: 20,
        reverbRoom: "Interrogation Vault (Dry Concrete)",
        isMuted: false,
        isSolo: false,
      },
      DX2: {
        id: "DX2",
        name: "ELENA",
        characterKey: "ELENA",
        voiceName: "Aoede",
        deliveryStyle: "Cold Analytical (Detached)",
        speed: 0.98,
        pitchFine: 1,
        formantShift: 1,
        pan: 20,
        reverbSend: 25,
        reverbRoom: "Interrogation Vault (Dry Concrete)",
        isMuted: false,
        isSolo: false,
      },
      DX3: {
        id: "DX3",
        name: "NARRATOR",
        characterKey: "NARRATOR",
        voiceName: "Zephyr",
        deliveryStyle: "Gravelly Neo-Noir",
        speed: 1.02,
        pitchFine: -1,
        formantShift: -4,
        pan: 0,
        reverbSend: 15,
        reverbRoom: "Scoring Sound Stage (Warm Wood)",
        isMuted: false,
        isSolo: false,
      },
    };
  });

  // Active character selected in Voice Shaper
  const [selectedChannelId, setSelectedChannelId] = React.useState<string>("DX1");

  // Ambient Drone Soundtrack (Lyria Bed)
  const [isAmbientPlaying, setIsAmbientPlaying] = React.useState<boolean>(false);
  const ambientContextRef = React.useRef<AudioContext | null>(null);

  // Audition single line test
  const [auditionText, setAuditionText] = React.useState<string>(
    "The vault codes were wiped before we breached the perimeter."
  );
  const [isAuditioning, setIsAuditioning] = React.useState<boolean>(false);
  const [auditioningSpeaker, setAuditioningSpeaker] = React.useState<string | null>(null);
  const [auditionSuccess, setAuditionSuccess] = React.useState<boolean>(false);

  // Client-Side Audio Cache to avoid duplicate API requests and cost
  const [cachedAudioMap, setCachedAudioMap] = React.useState<Record<string, string>>({});
  const [isPreCaching, setIsPreCaching] = React.useState<boolean>(false);

  // Helper to build deterministic line cache key incorporating real DSP settings
  const getLineKey = React.useCallback(
    (speakerKey: string, text: string) => {
      const speakerUpper = speakerKey.toUpperCase();
      const ch =
        Object.values(channels).find(
          (c) => c.characterKey.toUpperCase() === speakerUpper || c.name.toUpperCase() === speakerUpper
        ) || channels.DX1;
      return `${ch.characterKey}:${ch.voiceName}:${ch.deliveryStyle}:${ch.speed}:${ch.formantShift}:${ch.reverbRoom}:${text.trim()}`;
    },
    [channels]
  );

  // Sequential Scene Table Read
  const [isPlayingMaster, setIsPlayingMaster] = React.useState<boolean>(false);
  const [currentLineIdx, setCurrentLineIdx] = React.useState<number>(0);
  const activeAudioRef = React.useRef<HTMLAudioElement | null>(null);

  // Gemini 3.1 Multi-Speaker Continuous Synthesis
  const [isMultiSpeakerLoading, setIsMultiSpeakerLoading] = React.useState<boolean>(false);
  const [isMultiSpeakerPlaying, setIsMultiSpeakerPlaying] = React.useState<boolean>(false);
  const [multiSpeakerAudioUrl, setMultiSpeakerAudioUrl] = React.useState<string | null>(null);
  const multiSpeakerAudioRef = React.useRef<HTMLAudioElement | null>(null);

  // Parse lines for sequential playback
  const scriptLines = React.useMemo(() => {
    const raw = screenplayText.split("\n");
    const parsed: Array<{ id: number; speaker: string; text: string }> = [];
    let currentSpeaker = "NARRATOR";

    raw.forEach((r, idx) => {
      const line = r.trim();
      if (!line) return;
      if (/^[A-Z0-9\s]{2,25}$/.test(line) && !line.includes(" - ")) {
        currentSpeaker = line;
      } else if (line.startsWith("(") && line.endsWith(")")) {
        // Skip purely visual cues
      } else {
        parsed.push({ id: idx, speaker: currentSpeaker, text: line });
      }
    });
    return parsed;
  }, [screenplayText]);

  const updateChannel = (channelId: string, patch: Partial<ChannelVoiceState>) => {
    setChannels((prev) => ({
      ...prev,
      [channelId]: { ...prev[channelId], ...patch },
    }));
  };

  // Resolve a channel for a given speaker label, falling back to the first
  // available channel. Channels are keyed dynamically (DX1, DX2, ...) based on
  // the character list, so DX2/DX3 are not guaranteed to exist.
  const resolveChannelForSpeaker = React.useCallback(
    (speakerKey: string): ChannelVoiceState => {
      const speakerUpper = speakerKey.toUpperCase();
      const fallback = channels.DX1 || Object.values(channels)[0];
      return (
        Object.values(channels).find(
          (c) => c.characterKey.toUpperCase() === speakerUpper || c.name.toUpperCase() === speakerUpper
        ) ||
        Object.values(channels).find((c) => speakerUpper.includes(c.name.toUpperCase())) ||
        fallback
      );
    },
    [channels]
  );

  // Audition a specific line or custom text (checking client cache first)
  const handleAuditionLine = async (speakerKey: string, text: string) => {
    if (isAuditioning) return;
    setIsAuditioning(true);
    setAuditioningSpeaker(speakerKey);
    setAuditionSuccess(false);

    const speakerUpper = speakerKey.toUpperCase();
    const ch =
      Object.values(channels).find(
        (c) => c.characterKey.toUpperCase() === speakerUpper || c.name.toUpperCase() === speakerUpper
      ) || channels.DX1;

    const cacheKey = getLineKey(speakerKey, text);

    // 1. Check client-side memory cache
    if (cachedAudioMap[cacheKey]) {
      try {
        if (activeAudioRef.current) activeAudioRef.current.pause();
        const audio = new Audio(cachedAudioMap[cacheKey]);
        activeAudioRef.current = audio;
        audio.playbackRate = ch.speed;
        await audio.play();
        setAuditionSuccess(true);
        setTimeout(() => setAuditionSuccess(false), 2500);
      } finally {
        setIsAuditioning(false);
      }
      return;
    }

    // 2. Fetch from cached server proxy parameterized with real DSP dials
    try {
      const res = await fetch("/api/media/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          speaker: ch.characterKey,
          voice_name: ch.voiceName,
          delivery_style: ch.deliveryStyle,
          speed: ch.speed,
          pitch_fine: ch.pitchFine,
          formant_shift: ch.formantShift,
          reverb_room: ch.reverbRoom,
          reverb_send: ch.reverbSend,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.audio_url) {
          setCachedAudioMap((prev) => ({ ...prev, [cacheKey]: data.audio_url }));

          if (activeAudioRef.current) activeAudioRef.current.pause();
          const audio = new Audio(data.audio_url);
          activeAudioRef.current = audio;
          audio.playbackRate = ch.speed;
          await audio.play();
          setAuditionSuccess(true);
          setTimeout(() => setAuditionSuccess(false), 2500);
          notifyIfFallback(data, "Voice Audition");
        } else {
          toast.add({ title: "Audition failed", description: "No audio returned. Try again.", type: "error" });
        }
      } else {
        const detail = await res.text().catch(() => "");
        toast.add({
          title: "Audition failed",
          description: detail || `TTS request failed (${res.status}).`,
          type: "error",
        });
      }
    } catch (err) {
      console.error("Audition failed:", err);
      toast.add({
        title: "Audition failed",
        description: err instanceof Error ? err.message : "Could not reach the TTS backend.",
        type: "error",
      });
    } finally {
      setIsAuditioning(false);
      setAuditioningSpeaker(null);
    }
  };

  // Ambient sound synthesizer
  const toggleAmbientSoundtrack = () => {
    if (isAmbientPlaying) {
      if (ambientContextRef.current) {
        ambientContextRef.current.close();
        ambientContextRef.current = null;
      }
      setIsAmbientPlaying(false);
    } else {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        ambientContextRef.current = ctx;

        const oscSub = ctx.createOscillator();
        const oscDrone = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        oscSub.type = "sine";
        oscSub.frequency.setValueAtTime(45, ctx.currentTime);

        oscDrone.type = "sawtooth";
        oscDrone.frequency.setValueAtTime(90, ctx.currentTime);

        filter.type = "lowpass";
        filter.frequency.setValueAtTime(220, ctx.currentTime);

        gain.gain.setValueAtTime(0.08, ctx.currentTime);

        oscSub.connect(filter);
        oscDrone.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        oscSub.start();
        oscDrone.start();
        setIsAmbientPlaying(true);
      } catch (err) {
        console.error("Ambient audio error:", err);
      }
    }
  };

  // Sequential Scene Table Read Player
  const playMasterLine = React.useCallback(
    async (idx: number) => {
      if (idx >= scriptLines.length) {
        setIsPlayingMaster(false);
        setCurrentLineIdx(0);
        return;
      }

      const item = scriptLines[idx];
      const targetChannel = resolveChannelForSpeaker(item.speaker.trim());

      const anySoloed = Object.values(channels).some((c) => c.isSolo);
      const isSilenced = targetChannel.isMuted || (anySoloed && !targetChannel.isSolo);

      if (isSilenced) {
        setCurrentLineIdx(idx + 1);
        playMasterLine(idx + 1);
        return;
      }

      const cacheKey = getLineKey(item.speaker, item.text);

      // Check client-side cache first
      if (cachedAudioMap[cacheKey]) {
        const audio = new Audio(cachedAudioMap[cacheKey]);
        activeAudioRef.current = audio;
        audio.playbackRate = targetChannel.speed;
        audio.onended = () => {
          if (idx + 1 < scriptLines.length) {
            setCurrentLineIdx(idx + 1);
            playMasterLine(idx + 1);
          } else {
            setIsPlayingMaster(false);
            setCurrentLineIdx(0);
          }
        };
        audio.onerror = () => setIsPlayingMaster(false);
        await audio.play();
        return;
      }

      try {
        const res = await fetch("/api/media/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: item.text,
            speaker: targetChannel.characterKey,
            voice_name: targetChannel.voiceName,
            delivery_style: targetChannel.deliveryStyle,
            speed: targetChannel.speed,
            pitch_fine: targetChannel.pitchFine,
            formant_shift: targetChannel.formantShift,
            reverb_room: targetChannel.reverbRoom,
            reverb_send: targetChannel.reverbSend,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.audio_url) {
            setCachedAudioMap((prev) => ({ ...prev, [cacheKey]: data.audio_url }));
            const audio = new Audio(data.audio_url);
            activeAudioRef.current = audio;
            audio.playbackRate = targetChannel.speed;
            audio.onended = () => {
              if (idx + 1 < scriptLines.length) {
                setCurrentLineIdx(idx + 1);
                playMasterLine(idx + 1);
              } else {
                setIsPlayingMaster(false);
                setCurrentLineIdx(0);
              }
            };
            audio.onerror = () => setIsPlayingMaster(false);
            await audio.play();
          } else {
            setIsPlayingMaster(false);
            toast.add({
              title: "Table read stopped",
              description: `No audio returned for line ${idx + 1}. Playback halted.`,
              type: "error",
            });
          }
        } else {
          setIsPlayingMaster(false);
          toast.add({
            title: "Table read stopped",
            description: `TTS request failed on line ${idx + 1}. Playback halted.`,
            type: "error",
          });
        }
      } catch (err) {
        console.error("Sequential play error:", err);
        setIsPlayingMaster(false);
        toast.add({
          title: "Table read stopped",
          description: err instanceof Error ? err.message : `Playback failed on line ${idx + 1}.`,
          type: "error",
        });
      }
    },
    [scriptLines, channels, cachedAudioMap, getLineKey, resolveChannelForSpeaker]
  );

  // Pre-cache all dialogue turns in background
  const handlePrecacheAll = async () => {
    if (isPreCaching) return;
    setIsPreCaching(true);
    let failures = 0;
    try {
      for (const item of scriptLines) {
        const cacheKey = getLineKey(item.speaker, item.text);
        if (cachedAudioMap[cacheKey]) continue;

        const targetChannel = resolveChannelForSpeaker(item.speaker.trim());

        try {
          const res = await fetch("/api/media/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: item.text,
              speaker: targetChannel.characterKey,
              voice_name: targetChannel.voiceName,
              delivery_style: targetChannel.deliveryStyle,
              speed: targetChannel.speed,
              pitch_fine: targetChannel.pitchFine,
              formant_shift: targetChannel.formantShift,
              reverb_room: targetChannel.reverbRoom,
              reverb_send: targetChannel.reverbSend,
            }),
          });

          if (res.ok) {
            const data = await res.json();
            if (data.audio_url) {
              setCachedAudioMap((prev) => ({ ...prev, [cacheKey]: data.audio_url }));
            } else {
              failures++;
            }
          } else {
            failures++;
          }
        } catch {
          failures++;
        }
      }
      if (failures > 0) {
        toast.add({
          title: "Pre-cache incomplete",
          description: `${failures} line${failures === 1 ? "" : "s"} failed to synthesize. You can retry via Pre-cache All.`,
          type: "warning",
        });
      } else {
        toast.add({ title: "Pre-cache complete", description: "All dialogue lines cached.", type: "success" });
      }
    } catch (err) {
      console.error("Pre-cache error:", err);
      toast.add({
        title: "Pre-cache failed",
        description: err instanceof Error ? err.message : "Could not reach the TTS backend.",
        type: "error",
      });
    } finally {
      setIsPreCaching(false);
    }
  };

  const togglePlayMaster = () => {
    if (multiSpeakerAudioRef.current) {
      multiSpeakerAudioRef.current.pause();
    }
    setIsMultiSpeakerPlaying(false);

    if (isPlayingMaster) {
      if (activeAudioRef.current) activeAudioRef.current.pause();
      setIsPlayingMaster(false);
    } else {
      setIsPlayingMaster(true);
      playMasterLine(currentLineIdx);
    }
  };

  const toggleMultiSpeakerMaster = async () => {
    // Stop any active single-line / sequential audio
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
    }
    setIsPlayingMaster(false);

    if (isMultiSpeakerPlaying) {
      if (multiSpeakerAudioRef.current) {
        multiSpeakerAudioRef.current.pause();
      }
      setIsMultiSpeakerPlaying(false);
      return;
    }

    if (multiSpeakerAudioUrl) {
      if (!multiSpeakerAudioRef.current) {
        multiSpeakerAudioRef.current = new Audio(multiSpeakerAudioUrl);
      }
      const audio = multiSpeakerAudioRef.current;
      audio.onended = () => setIsMultiSpeakerPlaying(false);
      audio.onerror = () => setIsMultiSpeakerPlaying(false);
      setIsMultiSpeakerPlaying(true);
      await audio.play();
      return;
    }

    setIsMultiSpeakerLoading(true);
    try {
      const linesPayload = scriptLines.map((l) => ({
        speaker: l.speaker,
        text: l.text,
        voice_name: resolveChannelForSpeaker(l.speaker).voiceName,
      }));

      const orderedChannels = Object.values(channels);
      const channelA = orderedChannels[0];
      const channelB = orderedChannels[1] || orderedChannels[0];

      const res = await fetch("/api/media/tts/multi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: linesPayload,
          scriptText: screenplayText,
          speakerA: channelA.name,
          voiceA: channelA.voiceName,
          speakerB: channelB.name,
          voiceB: channelB.voiceName,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.audio_url && !data._fallback) {
          setMultiSpeakerAudioUrl(data.audio_url);
          const audio = new Audio(data.audio_url);
          multiSpeakerAudioRef.current = audio;
          audio.onended = () => setIsMultiSpeakerPlaying(false);
          audio.onerror = () => setIsMultiSpeakerPlaying(false);
          setIsMultiSpeakerPlaying(true);
          await audio.play();
          toast.add({
            title: "Multi-Speaker Table Read Active",
            description: `Generated continuous dialogue for ${data.speakers?.join(", ") || "cast"} via Gemini 3.1 Flash TTS.`,
            type: "success",
          });
          return;
        }
      }

      toast.add({
        title: "Falling back to line stems",
        description: "Multi-speaker service unavailable. Switching to sequential line synthesis.",
        type: "warning",
      });
      togglePlayMaster();
    } catch (err) {
      console.error("Multi-speaker synthesis error:", err);
      toast.add({
        title: "Multi-speaker synthesis failed",
        description: err instanceof Error ? err.message : "Network error. Reverting to sequential table read.",
        type: "error",
      });
      togglePlayMaster();
    } finally {
      setIsMultiSpeakerLoading(false);
    }
  };

  React.useEffect(() => {
    return () => {
      if (activeAudioRef.current) activeAudioRef.current.pause();
      if (multiSpeakerAudioRef.current) multiSpeakerAudioRef.current.pause();
      if (ambientContextRef.current) ambientContextRef.current.close();
    };
  }, []);

  const activeChannel = channels[selectedChannelId] || channels.DX1;
  const cachedCount = scriptLines.filter((l) => Boolean(cachedAudioMap[getLineKey(l.speaker, l.text)])).length;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background text-foreground select-none">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5 bg-card/60 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center text-accent">
            <Headphones className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-heading font-bold uppercase tracking-wider text-foreground">
                AI Voice &amp; Cadence Simulation
              </span>
              <Badge variant="outline" className="border-accent/40 bg-accent/10 text-accent text-[9px] font-mono px-1.5 py-0">
                Gemini 3.1 TTS
              </Badge>
              <Badge variant="outline" className="border-border text-muted-foreground text-[9px] font-mono px-1.5 py-0 hidden sm:inline-flex">
                EBU R128 (-23 LUFS)
              </Badge>
              {cachedCount > 0 && (
                <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-400 text-[9px] font-mono px-1.5 py-0 flex items-center gap-1">
                  <Zap className="h-2.5 w-2.5" />
                  {cachedCount}/{scriptLines.length} Cached
                </Badge>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground font-mono">
              Pre-production acoustic simulation · Cadence &amp; timbre shaping for {sceneTitle}
            </p>
          </div>
        </div>

        {/* Global Transport & Mode Actions */}
        <div className="flex items-center gap-2">
          {/* Pre-cache All Scene Lines */}
          <button
            type="button"
            onClick={handlePrecacheAll}
            disabled={isPreCaching}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-mono transition-colors cursor-pointer",
              cachedCount === scriptLines.length && scriptLines.length > 0
                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                : "bg-secondary/40 border-border text-muted-foreground hover:text-foreground"
            )}
            title="Pre-synthesize all dialogue lines to disk cache for zero-latency, zero-cost playback"
          >
            {isPreCaching ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin text-accent" />
            ) : (
              <Zap className={cn("h-3.5 w-3.5", cachedCount > 0 ? "text-emerald-400" : "text-muted-foreground")} />
            )}
            <span>
              {isPreCaching
                ? "Caching Audio..."
                : cachedCount === scriptLines.length && scriptLines.length > 0
                ? "All Cached"
                : `${cachedCount}/${scriptLines.length} Cached`}
            </span>
          </button>

          {/* Lyria Ambient Bed */}
          <button
            type="button"
            onClick={toggleAmbientSoundtrack}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-mono transition-colors cursor-pointer",
              isAmbientPlaying
                ? "bg-purple-500/20 border-purple-500/50 text-purple-300"
                : "bg-secondary/40 border-border text-muted-foreground hover:text-foreground"
            )}
            title="Toggle ambient score bed (synthetic drone)"
          >
            <Radio className={cn("h-3.5 w-3.5", isAmbientPlaying ? "text-purple-400 animate-pulse" : "text-muted-foreground")} />
            <span className="hidden sm:inline">{isAmbientPlaying ? "Score Bed Active" : "Lyria Ambient Bed"}</span>
          </button>

          {/* Gemini 3.1 Multi-Speaker Master Read */}
          <Button
            size="sm"
            onClick={toggleMultiSpeakerMaster}
            disabled={isMultiSpeakerLoading}
            className={cn(
              "h-8 px-3 gap-1.5 text-xs font-semibold cursor-pointer shadow-xs",
              isMultiSpeakerPlaying
                ? "bg-purple-600 hover:bg-purple-500 text-white animate-pulse"
                : "bg-purple-700/90 hover:bg-purple-600 text-white"
            )}
            title="Generate continuous multi-speaker table read with natural conversational pacing using Gemini 3.1 TTS MultiSpeakerVoiceConfig"
          >
            {isMultiSpeakerLoading ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : isMultiSpeakerPlaying ? (
              <Pause className="h-3.5 w-3.5" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 fill-current text-purple-200" />
            )}
            <span>
              {isMultiSpeakerLoading
                ? "Synthesizing Cast..."
                : isMultiSpeakerPlaying
                ? "Multi-Speaker Active"
                : "Play Multi-Speaker Scene"}
            </span>
          </Button>

          {/* Sequential Stems Table Read */}
          <Button
            size="sm"
            variant="outline"
            onClick={togglePlayMaster}
            className={cn(
              "h-8 px-3 gap-1.5 text-xs font-medium cursor-pointer shadow-xs border-border/80",
              isPlayingMaster
                ? "bg-accent text-accent-foreground animate-pulse"
                : "bg-secondary/60 hover:bg-secondary text-foreground"
            )}
            title="Step through dialogue line-by-line with individual character channel processing"
          >
            {isPlayingMaster ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 fill-current" />}
            <span>
              {isPlayingMaster
                ? `Line ${currentLineIdx + 1}/${scriptLines.length}`
                : "Play Line Stems"}
            </span>
          </Button>

          {/* Jump to Video Generation */}
          {onOpenVideoGenerator && (
            <Button
              size="sm"
              variant="outline"
              onClick={onOpenVideoGenerator}
              className="h-8 text-xs gap-1.5 border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 cursor-pointer hidden md:flex"
            >
              <Film className="h-3.5 w-3.5" />
              <span>Send Stems to Video ↗</span>
            </Button>
          )}
        </div>
      </div>

      {/* Sub-Navigation Switcher */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-4 bg-secondary/20">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab("tableread")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors cursor-pointer",
              activeTab === "tableread"
                ? "bg-accent text-accent-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>Scene Table Read &amp; Dialogue Flow</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("cast")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors cursor-pointer",
              activeTab === "cast"
                ? "bg-accent text-accent-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
          >
            <User className="h-3.5 w-3.5" />
            <span>Character Voice Casting</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("acoustics")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors cursor-pointer",
              activeTab === "acoustics"
                ? "bg-accent text-accent-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Spatial Acoustics &amp; Room Impulses</span>
          </button>
        </div>

        <div className="text-[11px] font-mono text-muted-foreground hidden sm:block">
          {scriptLines.length} Dialogue Turns · {Object.keys(channels).length} Voice Tracks
        </div>
      </div>

      {/* VIEW 1: SCENE TABLE READ & ACTIVE VOICE SHAPER */}
      {activeTab === "tableread" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 min-h-0 divide-y lg:divide-y-0 lg:divide-x divide-border overflow-hidden">
          {/* Left: Screenplay Dialogue Stream (7 cols) */}
          <div className="lg:col-span-7 flex flex-col min-h-0 overflow-hidden bg-card/20">
            <div className="flex items-center justify-between border-b border-border px-4 py-2 bg-secondary/30">
              <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                Dialogue Sequence ({scriptLines.length} Lines)
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">
                Click any line to audition individual delivery
              </span>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2.5">
              {scriptLines.map((line, idx) => {
                const speakerUpper = line.speaker.toUpperCase();
                const isMarcus = speakerUpper.includes("MARCUS");
                const isElena = speakerUpper.includes("ELENA");
                const isCurrent = isPlayingMaster && currentLineIdx === idx;

                const badgeColor = isMarcus
                  ? "border-accent/40 bg-accent/10 text-accent"
                  : isElena
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                  : "border-cyan-500/40 bg-cyan-500/10 text-cyan-400";

                return (
                  <div
                    key={line.id}
                    className={cn(
                      "p-3 rounded-lg border transition-all text-xs flex flex-col gap-1.5",
                      isCurrent
                        ? "border-accent bg-accent/10 shadow-md ring-1 ring-accent"
                        : "border-border/60 bg-card hover:border-border hover:bg-card/80"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={cn("text-[10px] font-mono font-semibold", badgeColor)}>
                          {line.speaker}
                        </Badge>
                        {isCurrent && (
                          <span className="flex items-center gap-1 text-[10px] text-accent font-mono animate-pulse font-bold">
                            <Activity className="h-3 w-3" /> Speaking...
                          </span>
                        )}
                      </div>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleAuditionLine(line.speaker, line.text)}
                        disabled={isAuditioning}
                        className="h-6 px-2 text-[10px] gap-1 text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        <Volume1 className="h-3 w-3" />
                        <span>Audition</span>
                      </Button>
                    </div>

                    <p className="font-mono text-foreground/90 leading-relaxed pl-1">
                      &ldquo;{line.text}&rdquo;
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Active Speaker Tuning Sandbox (5 cols) */}
          <div className="lg:col-span-5 flex flex-col min-h-0 overflow-y-auto p-4 space-y-4 bg-card/40">
            <div>
              <SlateLabel>Select Character to Tune</SlateLabel>
              <div className="grid grid-cols-3 gap-2 mt-1.5">
                {Object.values(channels).map((ch) => {
                  const isSelected = selectedChannelId === ch.id;
                  return (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => setSelectedChannelId(ch.id)}
                      className={cn(
                        "p-2.5 rounded-lg border text-left transition-colors cursor-pointer flex flex-col gap-0.5",
                        isSelected
                          ? "border-accent bg-accent/15 text-accent shadow-xs font-semibold"
                          : "border-border bg-secondary/30 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <span className="text-xs font-mono font-bold uppercase">{ch.name}</span>
                      <span className="text-[10px] font-mono text-muted-foreground truncate">{ch.voiceName}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Voice Model Selector */}
            <div>
              <SlateLabel>Assigned Voice Profile (Gemini 3.1 TTS)</SlateLabel>
              <select
                value={activeChannel.voiceName}
                onChange={(e) => updateChannel(activeChannel.id, { voiceName: e.target.value })}
                className="w-full mt-1.5 rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-accent"
              >
                {AVAILABLE_VOICES.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Delivery Style */}
            <div>
              <SlateLabel>Dramatic Delivery Style &amp; Mood</SlateLabel>
              <select
                value={activeChannel.deliveryStyle}
                onChange={(e) => updateChannel(activeChannel.id, { deliveryStyle: e.target.value })}
                className="w-full mt-1.5 rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-accent"
              >
                {DELIVERY_STYLES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            {/* Cadence & Pacing Slider */}
            <div className="space-y-1.5 bg-secondary/30 p-3 rounded-lg border border-border">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-muted-foreground">Pacing &amp; Speed</span>
                <span className="text-foreground font-bold">{activeChannel.speed.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min="0.8"
                max="1.3"
                step="0.02"
                value={activeChannel.speed}
                onChange={(e) => updateChannel(activeChannel.id, { speed: parseFloat(e.target.value) })}
                className="w-full h-1.5 accent-accent bg-secondary rounded cursor-pointer"
              />
              <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                <span>0.80x (Measured / Slow)</span>
                <span>1.0x (Natural)</span>
                <span>1.30x (Rapid / Panicked)</span>
              </div>
            </div>

            {/* Pitch & Timbre Mod — parameterizes Gemini TTS prompt and applies real-time WebAudio DSP */}
            <div className="space-y-1.5 bg-secondary/30 p-3 rounded-lg border border-border">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-muted-foreground">Formant / Vocal Weight</span>
                <span className="text-foreground font-bold">{activeChannel.formantShift > 0 ? `+${activeChannel.formantShift}` : activeChannel.formantShift}</span>
              </div>
              <p className="text-[10px] font-mono text-cyan-400/90 flex items-center gap-1">
                <Zap className="h-3 w-3 text-cyan-400" />
                <span>Active DSP: Parameterizes Gemini speech resonance &amp; WebAudio chest weight</span>
              </p>
              <input
                type="range"
                min="-6"
                max="6"
                step="1"
                value={activeChannel.formantShift}
                onChange={(e) => updateChannel(activeChannel.id, { formantShift: parseInt(e.target.value) })}
                className="w-full h-1.5 accent-cyan-400 bg-secondary rounded cursor-pointer"
              />
              <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                <span>-6 (Deep Chest)</span>
                <span>0 (Neutral)</span>
                <span>+6 (High Tension)</span>
              </div>
            </div>

            {/* Audition Sandbox Input */}
            <div className="space-y-2 pt-2 border-t border-border">
              <SlateLabel>Live Audition Test</SlateLabel>
              <textarea
                rows={2}
                value={auditionText}
                onChange={(e) => setAuditionText(e.target.value)}
                placeholder="Type custom test dialogue for this character..."
                className="w-full rounded-md border border-border bg-background p-2.5 text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-accent resize-none"
              />
              <Button
                size="sm"
                onClick={() => handleAuditionLine(activeChannel.characterKey, auditionText)}
                disabled={isAuditioning}
                className="w-full text-xs font-semibold gap-1.5 cursor-pointer bg-accent text-accent-foreground hover:bg-accent/90"
              >
                {isAuditioning ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Synthesizing Voice...</span>
                  </>
                ) : auditionSuccess ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    <span>Audition Playing!</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="h-3.5 w-3.5" />
                    <span>Audition &ldquo;{activeChannel.name}&rdquo; Voice</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: CHARACTER VOICE CASTING OVERVIEW */}
      {activeTab === "cast" && (
        <div className="flex-1 min-h-0 overflow-y-auto p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.values(channels).map((ch) => (
              <div
                key={ch.id}
                className="rounded-xl border border-border bg-card p-4 space-y-3.5 shadow-sm"
              >
                <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center font-mono font-bold text-xs text-accent">
                      {ch.name[0]}
                    </div>
                    <div>
                      <span className="font-heading font-bold text-xs uppercase tracking-wider text-foreground">
                        {ch.name}
                      </span>
                      <p className="text-[10px] font-mono text-muted-foreground">{ch.voiceName} Model</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="border-border text-muted-foreground text-[10px] font-mono">
                    Track {ch.id}
                  </Badge>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase">Voice Actor Model:</span>
                  <select
                    value={ch.voiceName}
                    onChange={(e) => updateChannel(ch.id, { voiceName: e.target.value })}
                    className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs text-foreground font-mono focus:outline-none"
                  >
                    {AVAILABLE_VOICES.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase">Delivery Tone:</span>
                  <select
                    value={ch.deliveryStyle}
                    onChange={(e) => updateChannel(ch.id, { deliveryStyle: e.target.value })}
                    className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs text-foreground font-mono focus:outline-none"
                  >
                    {DELIVERY_STYLES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                    <span>Cadence Speed:</span>
                    <span className="text-foreground font-bold">{ch.speed.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.8"
                    max="1.3"
                    step="0.02"
                    value={ch.speed}
                    onChange={(e) => updateChannel(ch.id, { speed: parseFloat(e.target.value) })}
                    className="w-full h-1 accent-accent bg-secondary rounded cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/60">
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateChannel(ch.id, { isMuted: !ch.isMuted })}
                      className={cn(
                        "h-6 px-2 text-[10px] font-mono cursor-pointer",
                        ch.isMuted ? "bg-rose-500/20 text-rose-300 border-rose-500/40" : ""
                      )}
                    >
                      {ch.isMuted ? "MUTED" : "Mute"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateChannel(ch.id, { isSolo: !ch.isSolo })}
                      className={cn(
                        "h-6 px-2 text-[10px] font-mono cursor-pointer",
                        ch.isSolo ? "bg-amber-500/20 text-amber-300 border-amber-500/40" : ""
                      )}
                    >
                      {ch.isSolo ? "SOLO" : "Solo"}
                    </Button>
                  </div>

                  <Button
                    size="sm"
                    disabled={isAuditioning}
                    onClick={() =>
                      handleAuditionLine(ch.characterKey, `This is an acoustic test of the ${ch.voiceName} voice profile.`)
                    }
                    className="h-6 px-2.5 text-[10px] gap-1 bg-secondary hover:bg-secondary/80 text-foreground cursor-pointer"
                  >
                    {auditioningSpeaker === ch.characterKey ? (
                      <>
                        <RefreshCw className="h-3 w-3 animate-spin text-accent" />
                        <span>Testing...</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="h-3 w-3" />
                        <span>Test Voice</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW 3: ACOUSTICS & ROOM IMPULSES */}
      {activeTab === "acoustics" && (
        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
          <div>
            <h3 className="font-heading text-sm font-bold text-foreground">Spatial Room Acoustics</h3>
            <p className="text-xs text-muted-foreground">
              Select room simulation profiles to match the environmental setting of {sceneTitle}.
            </p>
            <p className="text-[10px] font-mono text-amber-400/80 mt-1">
              Sets the room profile referenced in production notes — reverb convolution isn&apos;t
              rendered into the audition/table-read audio yet.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {REVERB_ROOMS.map((room) => {
              const isSelected = activeChannel.reverbRoom.toLowerCase().includes(room.id);
              return (
                <div
                  key={room.id}
                  onClick={() => updateChannel(activeChannel.id, { reverbRoom: room.name })}
                  className={cn(
                    "p-4 rounded-xl border text-left cursor-pointer transition-all flex flex-col gap-1.5",
                    isSelected
                      ? "border-accent bg-accent/10 shadow-sm"
                      : "border-border bg-card/60 hover:bg-card"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-foreground">{room.name}</span>
                    {isSelected && <Badge variant="outline" className="text-[9px] border-accent text-accent">Active</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{room.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
