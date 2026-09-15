"use client";

import * as React from "react";
import { SlateLabel } from "@/components/cinema/slate-label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Clock,
  ShieldAlert,
  ShieldCheck,
  Database,
  Activity,
  Heart,
  Send,
  Sparkles,
  Lock,
  Unlock,
  CheckCircle2,
  XCircle,
  FileText,
  HelpCircle,
  Play,
  RotateCcw,
  Zap,
} from "lucide-react";

interface StoryBeatMarker {
  seconds: number;
  timecode: string;
  label: string;
  phase: string;
  stress: number;
  heartRate: number;
}

const STORY_BEATS: StoryBeatMarker[] = [
  {
    seconds: 18 * 60,
    timecode: "00:18:00",
    label: "Laser Grid Breach",
    phase: "Infiltration",
    stress: 35,
    heartRate: 78,
  },
  {
    seconds: 34 * 60,
    timecode: "00:34:00",
    label: "Keys Missing (Centerpiece)",
    phase: "The Turning Point",
    stress: 72,
    heartRate: 118,
  },
  {
    seconds: 52 * 60,
    timecode: "00:52:00",
    label: "Elena's Syndicate Deal",
    phase: "The Betrayal",
    stress: 94,
    heartRate: 156,
  },
  {
    seconds: 76 * 60,
    timecode: "00:76:00",
    label: "Atmospheric Vent Cycle",
    phase: "Lethal Crisis",
    stress: 100,
    heartRate: 172,
  },
];

interface KnowledgeFactItem {
  timestamp: string;
  seconds: number;
  type: "known_fact" | "unaware_of";
  content: string;
}

const ALL_EVENTS: KnowledgeFactItem[] = [
  {
    timestamp: "00:10:00",
    seconds: 10 * 60,
    type: "known_fact",
    content: "Marcus memorized the bank sub-basement layout from Elena's schematics.",
  },
  {
    timestamp: "00:18:00",
    seconds: 18 * 60,
    type: "known_fact",
    content: "Elena bypassed the optical laser grid with an EMP frequency jammer.",
  },
  {
    timestamp: "00:28:00",
    seconds: 28 * 60,
    type: "known_fact",
    content: "Outer vault hydraulic door unlocked; Marcus secured the drill rig.",
  },
  {
    timestamp: "00:34:00",
    seconds: 34 * 60,
    type: "known_fact",
    content: "Marcus tears open the canvas gear bag: the sub-level bypass keys are missing.",
  },
  {
    timestamp: "00:52:00",
    seconds: 52 * 60,
    type: "known_fact",
    content: "Elena pocketed the keys in her coat and brokered a private secondary deal with the Vane Syndicate.",
  },
  {
    timestamp: "00:76:00",
    seconds: 76 * 60,
    type: "known_fact",
    content: "Atmospheric purge valve triggered; 120 seconds of breathable oxygen remaining in vault.",
  },
];

const PRESET_QUESTIONS = [
  {
    id: "q_keys",
    question: "Marcus, where are the vault bypass keys?",
  },
  {
    id: "q_elena",
    question: "Did Elena set you up with the Vane Syndicate?",
  },
  {
    id: "q_bag",
    question: "Why is your gear bag still unzipped on the floor?",
  },
  {
    id: "q_timer",
    question: "What happens when that wall timer hits zero?",
  },
];

export function TimeGateSimulator() {
  const [currentSeconds, setCurrentSeconds] = React.useState<number>(34 * 60);
  const [selectedQuestion, setSelectedQuestion] = React.useState<string>(PRESET_QUESTIONS[0].question);
  const [isAnswering, setIsAnswering] = React.useState<boolean>(false);
  const [insertedToScript, setInsertedToScript] = React.useState<boolean>(false);
  const [queryLatency, setQueryLatency] = React.useState<number>(1.3);

  // Derive timecode string
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = Math.floor(secs % 60).toString().padStart(2, "0");
    return `00:${m}:${s}`;
  };

  const currentTimecode = formatTime(currentSeconds);

  // Derive known facts from ClickHouse simulation
  const knownFacts = React.useMemo(() => {
    return ALL_EVENTS.filter((e) => e.seconds <= currentSeconds);
  }, [currentSeconds]);

  const blockedFacts = React.useMemo(() => {
    return ALL_EVENTS.filter((e) => e.seconds > currentSeconds);
  }, [currentSeconds]);

  // Derive biometrics
  const currentStress = React.useMemo(() => {
    if (currentSeconds < 18 * 60) return 30;
    if (currentSeconds < 34 * 60) return 45;
    if (currentSeconds < 52 * 60) return 72;
    if (currentSeconds < 76 * 60) return 92;
    return 100;
  }, [currentSeconds]);

  const currentHeartRate = React.useMemo(() => {
    if (currentSeconds < 18 * 60) return 74;
    if (currentSeconds < 34 * 60) return 92;
    if (currentSeconds < 52 * 60) return 122;
    if (currentSeconds < 76 * 60) return 158;
    return 174;
  }, [currentSeconds]);

  // Simulate latency variation on scrub
  const handleScrub = (seconds: number) => {
    setCurrentSeconds(seconds);
    setInsertedToScript(false);
    setQueryLatency(Number((1.0 + Math.random() * 0.7).toFixed(1)));
  };

  // Generate dynamic time-gated character response
  const characterResponse = React.useMemo(() => {
    if (selectedQuestion.includes("keys")) {
      if (currentSeconds < 34 * 60) {
        return {
          dialogue: "They're right in my canvas bag where Elena packed them. We haven't popped the inner vault lock yet—give me two minutes with the hydraulic tensioner.",
          subtext: "Confident, focused on stage mechanics, zero inkling of missing hardware.",
          firewalled: false,
        };
      } else if (currentSeconds < 52 * 60) {
        return {
          dialogue: "I don't have them! I turned the whole pouch inside out twice! Elena, tell me you didn't leave them at the staging locker! Panic won't pop this steel door!",
          subtext: "High anxiety, authentic ignorance, frantically defending himself while questioning Elena.",
          firewalled: true,
        };
      } else {
        return {
          dialogue: "Elena has them. She had them the whole time in her left coat pocket. She was never gonna let us walk out that service tunnel.",
          subtext: "Cold fury, betrayal acknowledged, survival instinct kicking in.",
          firewalled: false,
        };
      }
    } else if (selectedQuestion.includes("Syndicate") || selectedQuestion.includes("Elena")) {
      if (currentSeconds < 52 * 60) {
        return {
          dialogue: "Syndicate?! What the hell are you talking about?! Elena's been my crew lead for four years. She brought the schematics! Stop asking conspiracy questions while the security clock is ticking!",
          subtext: "STRICT IGNORANCE FIREWALL ACTIVE: Marcus treats the betrayal as absurd paranoia because the event has not occurred in his timeline yet.",
          firewalled: true,
        };
      } else {
        return {
          dialogue: "Look at her eyes—she's not even entering the bypass codes. That timer isn't a delay, it's the building decontamination flush! She sold our route to the Vane Syndicate for double the take.",
          subtext: "TRUTH UNMASKED: Marcus connects Elena's cold demeanor to the syndicate deal revealed at 00:52:00.",
          firewalled: false,
        };
      }
    } else if (selectedQuestion.includes("bag")) {
      if (currentSeconds < 34 * 60) {
        return {
          dialogue: "Standard extraction protocol. Once the safe tumblers drop, we pack the bearer bonds in ninety seconds flat.",
          subtext: "Professional criminal rhythm.",
          firewalled: false,
        };
      } else {
        return {
          dialogue: "Because I tore through every zipper looking for the keys! Look at the floor—flares, tension picks, wire cutters—everything is here except the one thing we need to get out alive!",
          subtext: "Desperate frustration, physical panic.",
          firewalled: true,
        };
      }
    } else {
      // timer question
      if (currentSeconds < 76 * 60) {
        return {
          dialogue: "The main magnetic locks re-engage and the facility sends a silent alert to Metro SWAT. We have under six minutes to clear this room.",
          subtext: "Believes standard bank security protocol applies.",
          firewalled: true,
        };
      } else {
        return {
          dialogue: "Cyan gas. Look at the ceiling vents—they're venting the intake fans. It's not police coming, it's a lethal clean-slate protocol!",
          subtext: "Terminal emergency, acute mortality realization.",
          firewalled: false,
        };
      }
    }
  }, [selectedQuestion, currentSeconds]);

  return (
    <div id="simulator" className="w-full space-y-6 pt-6">
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border pb-5">
        <div className="space-y-1">
          <SlateLabel>Interactive Live Simulation</SlateLabel>
          <h2 className="text-2xl md:text-3xl font-heading font-bold tracking-tight text-foreground">
            The ClickHouse Time-Gate Engine in Action
          </h2>
          <p className="text-xs md:text-sm text-muted-foreground max-w-2xl">
            Drag the timeline scrubber below. Watch how Marcus&apos;s internal knowledge, biometric stress, and hot-seat dialogue automatically adapt to what he has witnessed.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-xs font-mono border-accent/40 bg-accent/10 text-accent gap-1.5 py-1">
            <Database className="h-3 w-3" />
            <span>ClickHouse: &lt; {queryLatency}ms</span>
          </Badge>
          <Badge variant="outline" className="text-xs font-mono border-success/40 bg-success/10 text-success gap-1.5 py-1">
            <ShieldCheck className="h-3 w-3" />
            <span>Firewall: Active</span>
          </Badge>
        </div>
      </div>

      {/* Main Interactive Studio Mockup Frame */}
      <div className="rounded-2xl border border-border bg-card/90 shadow-2xl overflow-hidden cinema-glow">
        {/* Scrubber Control Center Header */}
        <div className="p-4 md:p-6 bg-secondary/40 border-b border-border space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                Story Playhead:
              </span>
              <span className="timecode text-xl md:text-2xl font-bold bg-background/80 px-3 py-1 rounded border border-border/80 shadow-inner">
                {currentTimecode}
              </span>
              <span className="text-xs text-muted-foreground">/ 01:30:00 (90 min)</span>
            </div>

            {/* Quick-Jump Chapter Chips */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-mono text-muted-foreground hidden sm:inline">
                Jump to Turning Point:
              </span>
              {STORY_BEATS.map((beat) => (
                <button
                  key={beat.timecode}
                  onClick={() => handleScrub(beat.seconds)}
                  className={`text-xs px-2.5 py-1 rounded-md border font-mono transition-all ${
                    Math.abs(currentSeconds - beat.seconds) < 180
                      ? "border-accent bg-accent/20 text-accent font-semibold shadow-sm"
                      : "border-border/70 bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
                >
                  {beat.timecode} · {beat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Range Slider Track */}
          <div className="space-y-2">
            <div className="relative w-full flex items-center">
              <input
                type="range"
                min={0}
                max={90 * 60}
                step={30}
                value={currentSeconds}
                onChange={(e) => handleScrub(Number(e.target.value))}
                className="w-full h-2.5 bg-background rounded-lg appearance-none cursor-pointer accent-accent"
              />
            </div>
            
            {/* Markers underneath timeline */}
            <div className="flex justify-between text-[10px] font-mono text-muted-foreground px-1">
              <span>00:00:00 (Exterior Recon)</span>
              <span className="text-accent font-semibold">00:34:00 (Vault Keys Missing)</span>
              <span className="text-warning">00:52:00 (Betrayal Unmasked)</span>
              <span>01:30:00 (Resolution)</span>
            </div>
          </div>
        </div>

        {/* 3-Column Production Workspace Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-border">
          {/* Column 1: Character Telemetry & Knowledge Boundaries (4 cols) */}
          <div className="lg:col-span-4 p-5 space-y-5 bg-card/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-full bg-secondary border border-border flex items-center justify-center font-heading font-bold text-accent">
                  M
                </div>
                <div>
                  <h3 className="text-sm font-heading font-bold text-foreground flex items-center gap-1.5">
                    Marcus Vance
                    <span className="text-[10px] font-normal text-muted-foreground">(Getaway)</span>
                  </h3>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    Speech: Terse, breathless, defensive
                  </span>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] border-accent/40 bg-accent/10 text-accent">
                Hot Seat Ready
              </Badge>
            </div>

            {/* Biometric Vital Signs */}
            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl border border-border/70 bg-secondary/30">
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground uppercase">
                  <Heart className="h-3 w-3 text-destructive animate-pulse" />
                  <span>Heart Rate</span>
                </div>
                <div className="text-lg font-mono font-bold text-foreground">
                  {currentHeartRate} <span className="text-xs font-normal text-muted-foreground">BPM</span>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground uppercase">
                  <Activity className="h-3 w-3 text-warning" />
                  <span>Stress Index</span>
                </div>
                <div className="text-lg font-mono font-bold text-warning">
                  {currentStress}%
                </div>
              </div>
            </div>

            {/* ClickHouse Verified Known Facts List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                  Verified Known Events ({knownFacts.length})
                </span>
                <span className="text-[10px] font-mono text-muted-foreground">&lt;= {currentTimecode}</span>
              </div>

              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {knownFacts.map((fact) => (
                  <div
                    key={fact.timestamp}
                    className="p-2 rounded border border-success/30 bg-success/5 text-xs space-y-0.5"
                  >
                    <div className="flex items-center justify-between text-[10px] font-mono text-success">
                      <span>{fact.timestamp}</span>
                      <span className="uppercase">Known Fact</span>
                    </div>
                    <p className="text-foreground/90 text-[11px] leading-relaxed">
                      {fact.content}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Strict Ignorance Firewall Box */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase tracking-wider text-destructive font-semibold flex items-center gap-1">
                  <Lock className="h-3.5 w-3.5 text-destructive" />
                  Firewalled Blind Spots ({blockedFacts.length})
                </span>
                <span className="text-[10px] font-mono text-destructive/80">Strictly Enforced</span>
              </div>

              {blockedFacts.length > 0 ? (
                <div className="space-y-1.5">
                  {blockedFacts.slice(0, 2).map((fact) => (
                    <div
                      key={fact.timestamp}
                      className="p-2 rounded border border-destructive/30 bg-destructive/5 text-xs space-y-0.5"
                    >
                      <div className="flex items-center justify-between text-[10px] font-mono text-destructive">
                        <span>{fact.timestamp}</span>
                        <span className="uppercase">Blocked from Memory</span>
                      </div>
                      <p className="text-muted-foreground text-[11px] leading-relaxed line-clamp-2">
                        {fact.content}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 rounded border border-border bg-secondary/30 text-center text-xs text-muted-foreground font-mono">
                  All timeline secrets unlocked at terminal minute.
                </div>
              )}
            </div>
          </div>

          {/* Column 2: The Interrogation Chamber (Hot Seat) (5 cols) */}
          <div className="lg:col-span-5 p-5 space-y-5 flex flex-col justify-between bg-card/60">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-border/70 pb-3">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-destructive shadow-[0_0_6px_rgba(239,68,68,0.9)]" />
                  <span className="text-xs font-heading font-semibold uppercase tracking-wider text-foreground">
                    Hot Seat Interrogation Monitor
                  </span>
                </div>
                <span className="text-[11px] font-mono text-muted-foreground">
                  Gemini 3.7 Flash · Persona Bound
                </span>
              </div>

              {/* Interrogator Prompt Preset Chips */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider block">
                  Select Question to Ask Marcus:
                </span>
                <div className="grid grid-cols-1 gap-1.5">
                  {PRESET_QUESTIONS.map((q) => (
                    <button
                      key={q.id}
                      onClick={() => {
                        setSelectedQuestion(q.question);
                        setInsertedToScript(false);
                      }}
                      className={`text-left text-xs p-2.5 rounded-lg border transition-all flex items-center justify-between ${
                        selectedQuestion === q.question
                          ? "border-accent bg-accent/20 text-accent font-semibold shadow-sm"
                          : "border-border/70 bg-secondary/40 text-foreground/85 hover:bg-secondary hover:text-foreground"
                      }`}
                    >
                      <span>&ldquo;{q.question}&rdquo;</span>
                      <Send className={`h-3 w-3 shrink-0 ml-2 ${selectedQuestion === q.question ? "text-accent" : "opacity-40"}`} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Character Output Screenplay Box */}
              <div className="p-4 rounded-xl border border-border bg-background/90 space-y-3 shadow-inner">
                <div className="flex items-center justify-between border-b border-border/50 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-heading font-bold text-xs text-accent">MARCUS</span>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      at timecode {currentTimecode}
                    </span>
                  </div>
                  {characterResponse.firewalled && (
                    <Badge variant="outline" className="text-[9px] border-amber-500/40 text-amber-400 bg-amber-500/10">
                      Firewall Defended
                    </Badge>
                  )}
                </div>

                <p className="text-sm font-sans leading-relaxed text-foreground italic">
                  &ldquo;{characterResponse.dialogue}&rdquo;
                </p>

                <div className="pt-2 border-t border-border/40 text-[11px] font-mono text-muted-foreground space-y-1">
                  <span className="text-accent text-[10px] uppercase font-bold block">
                    Subtext Analysis:
                  </span>
                  <p className="text-xs text-muted-foreground/90">
                    {characterResponse.subtext}
                  </p>
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="pt-2 flex items-center justify-between gap-3">
              <Button
                size="sm"
                variant={insertedToScript ? "secondary" : "default"}
                className={`text-xs gap-1.5 w-full ${
                  insertedToScript
                    ? "bg-success/20 text-success border border-success/40"
                    : "bg-accent text-accent-foreground hover:bg-accent/90"
                }`}
                onClick={() => setInsertedToScript(true)}
              >
                <FileText className="h-3.5 w-3.5" />
                {insertedToScript ? "Inserted into Production Draft ✓" : "Insert Dialogue into Screenplay Draft"}
              </Button>
            </div>
          </div>

          {/* Column 3: Live ClickHouse SQL Telemetry Console (3 cols) */}
          <div className="lg:col-span-3 p-5 space-y-4 bg-background/60">
            <div className="flex items-center justify-between border-b border-border/70 pb-3">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-accent" />
                <span className="text-xs font-mono font-semibold uppercase tracking-wider text-foreground">
                  ClickHouse SQL Plane
                </span>
              </div>
              <span className="text-[10px] font-mono text-success">200 OK</span>
            </div>

            {/* SQL Code Block */}
            <div className="p-3 rounded-lg border border-border bg-black/80 font-mono text-[11px] space-y-2 overflow-x-auto">
              <div className="text-muted-foreground text-[10px] flex items-center justify-between border-b border-border/40 pb-1">
                <span>STORY_EVENTS RANGE SCAN</span>
                <span className="text-accent">{queryLatency} ms</span>
              </div>
              <pre className="text-foreground/90 leading-relaxed">
                <span className="text-cyan-400">SELECT</span> event_type, content{"\n"}
                <span className="text-cyan-400">FROM</span> story_events{"\n"}
                <span className="text-cyan-400">WHERE</span> project_id = <span className="text-amber-300">&apos;vault-heist&apos;</span>{"\n"}
                {"  "}<span className="text-cyan-400">AND</span> character = <span className="text-amber-300">&apos;Marcus&apos;</span>{"\n"}
                {"  "}<span className="text-cyan-400">AND</span> event_timestamp &lt;= <span className="text-accent font-bold">&apos;{currentTimecode}&apos;</span>{"\n"}
                <span className="text-cyan-400">ORDER BY</span> event_timestamp;
              </pre>
            </div>

            {/* Execution Metrics */}
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between text-muted-foreground font-mono text-[11px]">
                <span>Scan Duration:</span>
                <span className="text-success font-semibold">{queryLatency} ms</span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground font-mono text-[11px]">
                <span>Rows Matched:</span>
                <span className="text-foreground font-semibold">{knownFacts.length} rows</span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground font-mono text-[11px]">
                <span>Table Engine:</span>
                <span className="text-foreground font-semibold">MergeTree</span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground font-mono text-[11px]">
                <span>Primary Key:</span>
                <span className="text-accent font-semibold text-[10px]">(project, char, time)</span>
              </div>
            </div>

            {/* Takeaway Note */}
            <div className="p-3 rounded-lg border border-accent/30 bg-accent/5 space-y-1 text-[11px]">
              <span className="font-heading font-bold text-accent flex items-center gap-1">
                <Zap className="h-3 w-3" />
                Why ClickHouse?
              </span>
              <p className="text-muted-foreground leading-relaxed text-[10px]">
                ClickHouse scans the ordered compound index in under 2ms. No LLM context re-parsing or hallucination-prone negative prompting required.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
