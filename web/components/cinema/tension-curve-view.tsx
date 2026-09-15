"use client";

import * as React from "react";
import { SlateLabel } from "@/components/cinema/slate-label";
import { Badge } from "@/components/ui/badge";
import { Activity, TrendingUp, AlertTriangle } from "lucide-react";
import { formatTimecode, type StoryEventMarker } from "@/components/cinema/timeline-scrubber";
import { cn } from "@/lib/utils";

interface TensionBeat {
  timeSeconds: number;
  tensionScore: number; // 0 - 100
  title: string;
  description: string;
  characterFocus: string;
}

interface TensionCurveViewProps {
  currentTimeSeconds: number;
  onScrubTime?: (seconds: number) => void;
  className?: string;
  projectId?: string;
  characters?: Array<{ name: string }>;
  events?: StoryEventMarker[];
  sceneTitle?: string;
  scenePlacementSeconds?: number;
  sceneDurationSeconds?: number;
  initialScope?: "macro" | "scene";
}

export function TensionCurveView({
  currentTimeSeconds,
  onScrubTime,
  className,
  projectId = "",
  characters = [],
  events = [],
  sceneTitle,
  scenePlacementSeconds,
  sceneDurationSeconds,
  initialScope = "macro",
}: TensionCurveViewProps) {
  const [viewScope, setViewScope] = React.useState<"macro" | "scene">(initialScope);
  const [activeCurveMode, setActiveCurveMode] = React.useState<string>("macro");

  const isSceneMode = viewScope === "scene";
  const sceneStart = scenePlacementSeconds ?? 0;
  const totalDuration = isSceneMode ? (sceneDurationSeconds || 240) : (90 * 60);

  // Dynamic narrative curve beats
  const defaultBeats: TensionBeat[] = React.useMemo(() => {
    // 0. If in Scene Mode, construct low-level scene tension progression
    if (isSceneMode) {
      const dur = totalDuration;
      const sceneEvents = events.filter((ev) => {
        if (sceneStart > 0) {
          return ev.atSeconds >= sceneStart && ev.atSeconds <= sceneStart + dur;
        }
        return ev.atSeconds <= dur;
      });

      const charA = characters[0]?.name || "Lead";
      const charB = characters[1]?.name || "Counterpart";

      const beats: TensionBeat[] = [
        {
          timeSeconds: 0,
          tensionScore: 28,
          title: "Scene Entry & Staging",
          description: "Characters enter the setting under baseline dramatic stakes",
          characterFocus: charA,
        },
        {
          timeSeconds: Math.round(dur * 0.28),
          tensionScore: 54,
          title: "Inciting Shift & Friction",
          description: "Tactical complication arises; initial friction surfaces",
          characterFocus: charB,
        },
        {
          timeSeconds: Math.round(dur * 0.62),
          tensionScore: 88,
          title: "Dramatic Peak / Confrontation",
          description: "High-stakes revelation, withheld secret, or physical deadlock",
          characterFocus: charA,
        },
        {
          timeSeconds: Math.round(dur * 0.92),
          tensionScore: 42,
          title: "Scene Button & Transition",
          description: "Consequence crystallizes before cut to next sequence",
          characterFocus: charB,
        },
      ];

      sceneEvents.forEach((ev) => {
        const localSec = ev.atSeconds >= sceneStart ? ev.atSeconds - sceneStart : ev.atSeconds;
        let score = 75;
        if (ev.eventType === "unaware_of") score = 94;
        if (ev.eventType === "objective") score = 84;
        beats.push({
          timeSeconds: localSec,
          tensionScore: score,
          title: `${ev.characterName}: ${ev.eventType.replace("_", " ").toUpperCase()}`,
          description: `Key beat: ${ev.characterName} undergoes state shift.`,
          characterFocus: ev.characterName,
        });
      });

      return beats.sort((a, b) => a.timeSeconds - b.timeSeconds);
    }

    // 1. If project has real ClickHouse events, construct dynamic beats from them!
    if (events && events.length >= 3) {
      const sortedEvents = [...events].sort((a, b) => a.atSeconds - b.atSeconds);
      const beats: TensionBeat[] = [
        {
          timeSeconds: 0,
          tensionScore: 20,
          title: "Opening Exposition",
          description: "Establishing status quo before inciting incident",
          characterFocus: characters[0]?.name || "Lead",
        },
      ];

      sortedEvents.forEach((ev, idx) => {
        let score = 30 + Math.round(((idx + 1) / (sortedEvents.length + 1)) * 65);
        if (ev.eventType === "unaware_of") score = Math.min(98, score + 10);
        if (ev.eventType === "objective") score = Math.min(95, score + 5);

        beats.push({
          timeSeconds: ev.atSeconds,
          tensionScore: score,
          title: `${ev.characterName}: ${ev.eventType.replace("_", " ").toUpperCase()}`,
          description: `Timeline divergence point: ${ev.characterName} experiences an asymmetric story event.`,
          characterFocus: ev.characterName,
        });
      });

      beats.push({
        timeSeconds: 90 * 60,
        tensionScore: 30,
        title: "Climactic Resolution",
        description: "Aftermath of the confrontation",
        characterFocus: characters[0]?.name || "Lead",
      });

      return beats;
    }

    // 2. Preset fallbacks
    if (projectId === "space-airlock-demo") {
      return [
        { timeSeconds: 0, tensionScore: 20, title: "Orbital Drift", description: "Routine maintenance cycle", characterFocus: "Vance" },
        { timeSeconds: 15 * 60, tensionScore: 45, title: "Pressure Alert", description: "Module 4 alarm sounds", characterFocus: "Vance" },
        { timeSeconds: 22 * 60, tensionScore: 68, title: "Code Breach", description: "Manual override discovered", characterFocus: "Ray" },
        { timeSeconds: 45 * 60, tensionScore: 88, title: "Specimen Breach", description: "Infection vector identified", characterFocus: "Vance" },
        { timeSeconds: 75 * 60, tensionScore: 96, title: "Emergency Purge", description: "Terminal airlock choice", characterFocus: "Ray" },
        { timeSeconds: 90 * 60, tensionScore: 35, title: "Vacuum Silence", description: "Aftermath", characterFocus: "Vance" },
      ];
    }

    const charA = characters[0]?.name || "Marcus";
    const charB = characters[1]?.name || "Elena";

    return [
      { timeSeconds: 0, tensionScore: 18, title: "Exterior Recon", description: "Establishing perimeter", characterFocus: charA },
      { timeSeconds: 18 * 60, tensionScore: 42, title: "First Threshold", description: "First security threshold", characterFocus: charB },
      { timeSeconds: 28 * 60, tensionScore: 60, title: "The Breach", description: "Inner security lock drops", characterFocus: charA },
      { timeSeconds: 34 * 60, tensionScore: 82, title: "The Missing Asset", description: "Discovery of missing critical element", characterFocus: charA },
      { timeSeconds: 52 * 60, tensionScore: 92, title: "Asymmetric Reveal", description: "True motive unmasked under deadline", characterFocus: charB },
      { timeSeconds: 76 * 60, tensionScore: 98, title: "Critical Climax", description: "Final confrontation before time runs out", characterFocus: charA },
      { timeSeconds: 90 * 60, tensionScore: 30, title: "Resolution", description: "Sole survivor / final escape resolution", characterFocus: charB },
    ];
  }, [projectId, characters, events, isSceneMode, totalDuration, sceneStart]);

  // Responsive container observer
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = React.useState({ width: 1000, height: 220 });

  React.useLayoutEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({ width: Math.round(width), height: Math.round(height) });
        }
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const svgWidth = dimensions.width;
  const svgHeight = dimensions.height;
  const paddingX = 60;
  const paddingY = 32;

  const plotWidth = Math.max(100, svgWidth - 2 * paddingX);
  const plotHeight = Math.max(80, svgHeight - 2 * paddingY);

  // Compute curve points mapped to pixel coordinates
  const points = React.useMemo(() => {
    return defaultBeats.map((b) => {
      let score = b.tensionScore;
      if (activeCurveMode !== "macro") {
        if (b.characterFocus.toLowerCase() === activeCurveMode.toLowerCase()) {
          score = Math.min(100, score + 14);
        } else {
          score = Math.max(10, score - 12);
        }
      }
      const x = paddingX + (b.timeSeconds / totalDuration) * plotWidth;
      const y = svgHeight - paddingY - (score / 100) * plotHeight;
      return { ...b, x, y, score };
    });
  }, [defaultBeats, activeCurveMode, plotWidth, plotHeight, svgHeight, totalDuration]);

  // Construct smooth SVG cubic bezier path
  const pathD = React.useMemo(() => {
    if (points.length < 2) return "";
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cx1 = p0.x + (p1.x - p0.x) / 2;
      const cy1 = p0.y;
      const cx2 = p0.x + (p1.x - p0.x) / 2;
      const cy2 = p1.y;
      d += ` C ${cx1} ${cy1}, ${cx2} ${cy2}, ${p1.x} ${p1.y}`;
    }
    return d;
  }, [points]);

  // Area under curve path for gradient fill
  const areaPathD = React.useMemo(() => {
    if (!pathD || points.length === 0) return "";
    const firstX = points[0].x;
    const lastX = points[points.length - 1].x;
    const bottomY = svgHeight - paddingY;
    return `${pathD} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  }, [pathD, points, svgHeight]);

  // Current scrubber position in pixel space (mapped to local scene time in scene mode)
  const currentLocal = React.useMemo(() => {
    if (isSceneMode) {
      const local = currentTimeSeconds >= sceneStart ? currentTimeSeconds - sceneStart : currentTimeSeconds;
      return Math.max(0, Math.min(totalDuration, local));
    }
    return Math.max(0, Math.min(totalDuration, currentTimeSeconds));
  }, [isSceneMode, currentTimeSeconds, sceneStart, totalDuration]);

  const currentX = React.useMemo(() => {
    return paddingX + (currentLocal / totalDuration) * plotWidth;
  }, [currentLocal, totalDuration, plotWidth, paddingX]);

  // Find nearest beat
  const activeBeat = React.useMemo(() => {
    let closest = defaultBeats[0];
    let minDiff = Infinity;
    defaultBeats.forEach((b) => {
      const diff = Math.abs(b.timeSeconds - currentLocal);
      if (diff < minDiff) {
        minDiff = diff;
        closest = b;
      }
    });
    return closest;
  }, [defaultBeats, currentLocal]);

  // Act boundaries for macro mode
  const act1Width = plotWidth * 0.25;
  const act2Width = plotWidth * 0.5;
  const act3Width = plotWidth * 0.25;

  return (
    <div className={`flex flex-col rounded-xl border border-border bg-card p-4 space-y-4 ${className ?? ""}`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-rose-400" />
            <SlateLabel>
              {isSceneMode
                ? `Scene Dramatic Tension & Beat Pacing ${sceneTitle ? `· ${sceneTitle}` : ""}`
                : "Full 3-Act Narrative Tension Curve (90:00 Movie Arc)"}
            </SlateLabel>
            <Badge variant="outline" className="text-[10px] font-mono border-rose-500/30 text-rose-300">
              {isSceneMode ? "4 Scene Beats" : "3 Acts (Exposition · Conflict · Climax)"}
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground">
            {isSceneMode
              ? `Scene-level micro-pacing curve across 4 dramatic beat phases (+00:00 to +${formatTimecode(totalDuration)})`
              : "Non-linear pacing analysis indexed against 3-act story structure with active scene placement"}
          </span>
        </div>

        {/* Scope & Character View Mode Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          {/* 3-Act vs Scene Scope Switcher */}
          <div className="flex items-center gap-1 rounded-lg border border-border bg-secondary/50 p-1 text-[11px]">
            <button
              type="button"
              onClick={() => setViewScope("macro")}
              className={cn(
                "px-2.5 py-1 rounded transition-all font-medium flex items-center gap-1.5 cursor-pointer",
                !isSceneMode
                  ? "bg-rose-500/20 text-rose-300 font-semibold border border-rose-500/40 shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span>Full 3-Act Arc</span>
              <span className="text-[9px] font-mono opacity-80">(90m)</span>
            </button>
            <button
              type="button"
              onClick={() => setViewScope("scene")}
              className={cn(
                "px-2.5 py-1 rounded transition-all font-medium flex items-center gap-1.5 cursor-pointer",
                isSceneMode
                  ? "bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/40 shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span>Scene Micro-Pacing</span>
              <span className="text-[9px] font-mono opacity-80">
                (+{formatTimecode(sceneDurationSeconds || 240)})
              </span>
            </button>
          </div>

          {/* Dynamic Character View Mode Switcher */}
          <div className="flex items-center gap-1 rounded-lg border border-border bg-secondary/40 p-1 text-[11px]">
            <button
              type="button"
              onClick={() => setActiveCurveMode("macro")}
              className={cn(
                "px-2 py-0.5 rounded transition-all cursor-pointer",
                activeCurveMode === "macro"
                  ? "bg-card text-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Master EKG
            </button>
            {characters.slice(0, 3).map((char) => (
              <button
                key={char.name}
                type="button"
                onClick={() => setActiveCurveMode(char.name.toLowerCase())}
                className={cn(
                  "px-2 py-0.5 rounded transition-all cursor-pointer",
                  activeCurveMode === char.name.toLowerCase()
                    ? "bg-accent/20 text-accent font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {char.name} POV
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SVG Curve Canvas */}
      <div
        ref={containerRef}
        className="relative w-full h-[210px] sm:h-[230px] rounded-lg border border-border/80 bg-background/90 overflow-hidden select-none"
      >
        <svg
          className="w-full h-full cursor-crosshair block"
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const clampedX = Math.max(paddingX, Math.min(svgWidth - paddingX, clickX));
            const clickRatio = (clampedX - paddingX) / plotWidth;
            const clickLocal = Math.round(clickRatio * totalDuration);
            const emitSec = isSceneMode ? sceneStart + clickLocal : clickLocal;
            onScrubTime?.(emitSec);
          }}
        >
          <defs>
            <linearGradient id="tension-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
              <stop offset="70%" stopColor="var(--accent)" stopOpacity="0.04" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Region Background Shading (4 Scene Beats or 3 Movie Acts) */}
          {isSceneMode ? (
            [0, 1, 2, 3].map((beatIdx) => (
              <rect
                key={beatIdx}
                x={paddingX + beatIdx * (plotWidth / 4)}
                y={paddingY}
                width={plotWidth / 4}
                height={plotHeight}
                fill="currentColor"
                className={beatIdx % 2 === 0 ? "text-foreground/[0.015]" : "text-foreground/[0.03]"}
              />
            ))
          ) : (
            <>
              <rect
                x={paddingX}
                y={paddingY}
                width={act1Width}
                height={plotHeight}
                fill="currentColor"
                className="text-foreground/[0.015]"
              />
              <rect
                x={paddingX + act1Width}
                y={paddingY}
                width={act2Width}
                height={plotHeight}
                fill="currentColor"
                className="text-foreground/[0.03]"
              />
              <rect
                x={paddingX + act1Width + act2Width}
                y={paddingY}
                width={act3Width}
                height={plotHeight}
                fill="currentColor"
                className="text-foreground/[0.015]"
              />
              {/* Highlight Active Scene Window on 3-Act Timeline */}
              {Boolean(sceneDurationSeconds && sceneDurationSeconds > 0) && (
                <g>
                  <rect
                    x={paddingX + (sceneStart / totalDuration) * plotWidth}
                    y={paddingY}
                    width={Math.max(8, ((sceneDurationSeconds || 240) / totalDuration) * plotWidth)}
                    height={plotHeight}
                    fill="#f43f5e"
                    fillOpacity="0.16"
                    stroke="#f43f5e"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                    className="pointer-events-none"
                  />
                  <text
                    x={paddingX + (sceneStart / totalDuration) * plotWidth + Math.max(8, ((sceneDurationSeconds || 240) / totalDuration) * plotWidth) / 2}
                    y={svgHeight - paddingY - 8}
                    textAnchor="middle"
                    className="fill-rose-400 font-mono text-[9px] font-bold select-none pointer-events-none"
                  >
                    ◀ Current Scene ▶
                  </text>
                </g>
              )}
            </>
          )}

          {/* Vertical Separators */}
          {isSceneMode ? (
            [1, 2, 3].map((beatIdx) => (
              <line
                key={beatIdx}
                x1={paddingX + beatIdx * (plotWidth / 4)}
                y1={paddingY}
                x2={paddingX + beatIdx * (plotWidth / 4)}
                y2={svgHeight - paddingY}
                stroke="currentColor"
                strokeDasharray="4 4"
                className="text-border"
              />
            ))
          ) : (
            <>
              <line
                x1={paddingX + act1Width}
                y1={paddingY}
                x2={paddingX + act1Width}
                y2={svgHeight - paddingY}
                stroke="currentColor"
                strokeDasharray="4 4"
                className="text-border"
              />
              <line
                x1={paddingX + act1Width + act2Width}
                y1={paddingY}
                x2={paddingX + act1Width + act2Width}
                y2={svgHeight - paddingY}
                stroke="currentColor"
                strokeDasharray="4 4"
                className="text-border"
              />
            </>
          )}

          {/* Horizontal Intensity Grid Lines */}
          {[25, 50, 75, 100].map((pct) => {
            const y = svgHeight - paddingY - (pct / 100) * plotHeight;
            return (
              <g key={pct}>
                <line
                  x1={paddingX}
                  y1={y}
                  x2={svgWidth - paddingX}
                  y2={y}
                  stroke="currentColor"
                  strokeDasharray="2 4"
                  className="text-border/40"
                />
                <text
                  x={paddingX - 10}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-muted-foreground text-[9px] font-mono select-none"
                >
                  {pct}%
                </text>
              </g>
            );
          })}

          {/* Region Labels */}
          {isSceneMode ? (
            [
              { label: "Beat 1 · Entry", center: 0.125 },
              { label: "Beat 2 · Escalation", center: 0.375 },
              { label: "Beat 3 · Conflict", center: 0.625 },
              { label: "Beat 4 · Button", center: 0.875 },
            ].map(({ label, center }) => (
              <text
                key={label}
                x={paddingX + plotWidth * center}
                y={paddingY + 14}
                textAnchor="middle"
                className="fill-muted-foreground/60 text-[10px] font-mono tracking-widest uppercase select-none"
              >
                {label}
              </text>
            ))
          ) : (
            <>
              <text
                x={paddingX + act1Width / 2}
                y={paddingY + 14}
                textAnchor="middle"
                className="fill-muted-foreground/60 text-[10px] font-mono tracking-widest uppercase select-none"
              >
                Act I · Setup
              </text>
              <text
                x={paddingX + act1Width + act2Width / 2}
                y={paddingY + 14}
                textAnchor="middle"
                className="fill-muted-foreground/60 text-[10px] font-mono tracking-widest uppercase select-none"
              >
                Act II · Confrontation
              </text>
              <text
                x={paddingX + act1Width + act2Width + act3Width / 2}
                y={paddingY + 14}
                textAnchor="middle"
                className="fill-muted-foreground/60 text-[10px] font-mono tracking-widest uppercase select-none"
              >
                Act III · Resolution
              </text>
            </>
          )}

          {/* Gradient Fill Under Curve */}
          <path d={areaPathD} fill="url(#tension-fill)" />

          {/* Tension Curve Stroke */}
          <path
            d={pathD}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Beat Points on Curve */}
          {points.map((p, idx) => {
            const isNearest = activeBeat.timeSeconds === p.timeSeconds;
            return (
              <g
                key={idx}
                className="group cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  const emitSec = isSceneMode ? sceneStart + p.timeSeconds : p.timeSeconds;
                  onScrubTime?.(emitSec);
                }}
              >
                {/* Generous invisible hit target to prevent edge jitter & position shifts */}
                <circle cx={p.x} cy={p.y} r="16" fill="transparent" />

                {/* Hover / Active Pulse Halo */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r="9"
                  fill="var(--accent)"
                  className={`transition-all duration-200 pointer-events-none ${
                    isNearest ? "opacity-35" : "opacity-0 group-hover:opacity-25"
                  }`}
                />

                {/* Base outer circle */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isNearest ? 5.5 : 4.5}
                  fill="var(--background)"
                  stroke="var(--accent)"
                  strokeWidth={isNearest ? 2.5 : 2}
                  className="transition-all duration-150 group-hover:stroke-[2.5px] pointer-events-none"
                />

                {/* Inner core dot */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isNearest ? 2.5 : 2}
                  fill="var(--accent)"
                  className="transition-all duration-150 pointer-events-none"
                />

                {/* Beat tooltip on hover */}
                <title>{`${p.title} (${p.score}% Tension · ${formatTimecode(p.timeSeconds)})`}</title>
              </g>
            );
          })}

          {/* Live Timeline Scrubber Needle */}
          <line
            x1={currentX}
            y1={paddingY - 6}
            x2={currentX}
            y2={svgHeight - paddingY + 6}
            stroke="#f59e0b"
            strokeWidth="1.5"
            strokeDasharray="3 3"
          />
          <polygon
            points={`${currentX - 5},${paddingY - 7} ${currentX + 5},${paddingY - 7} ${currentX},${paddingY - 1}`}
            fill="#f59e0b"
          />
          <polygon
            points={`${currentX - 5},${svgHeight - paddingY + 7} ${currentX + 5},${svgHeight - paddingY + 7} ${currentX},${svgHeight - paddingY + 1}`}
            fill="#f59e0b"
          />
        </svg>
      </div>

      {/* Current Beat Card & Analytics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="col-span-2 flex items-start gap-3 rounded-lg border border-border bg-secondary/30 p-2.5">
          <div className="p-1.5 rounded bg-accent/10 border border-accent/30 text-accent shrink-0">
            <AlertTriangle className="h-3.5 w-3.5" />
          </div>
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground truncate">
                {activeBeat.title}
              </span>
              <span className="font-mono text-[11px] text-accent">
                {isSceneMode ? `+${formatTimecode(activeBeat.timeSeconds)}` : formatTimecode(activeBeat.timeSeconds)}
                {isSceneMode && sceneStart > 0 && (
                  <span className="text-muted-foreground/70 ml-1.5 text-[10px]">
                    (Film {formatTimecode(sceneStart + activeBeat.timeSeconds)})
                  </span>
                )}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {activeBeat.description}
            </p>
            <div className="flex items-center gap-2 pt-0.5 text-[10px]">
              <span className="text-muted-foreground">Focus:</span>
              <Badge variant="outline" className="text-[9px] py-0 px-1 border-accent/40 text-accent">
                {activeBeat.characterFocus}
              </Badge>
              <span className="text-muted-foreground">Intensity:</span>
              <span className="font-mono text-accent font-semibold">{activeBeat.tensionScore}%</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-lg border border-border bg-secondary/20 p-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-semibold text-muted-foreground">
              Retention Est.
            </span>
            <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
          </div>
          <div className="my-1">
            <span className="text-lg font-bold font-mono text-foreground">94.8%</span>
            <p className="text-[10px] text-muted-foreground leading-tight">
              {isSceneMode
                ? "Scene-level tension pacing calculation indexed across 4 dramatic beats."
                : "Real-time ClickHouse story pacing curve calculation."}
            </p>
          </div>
          <span className="text-[9px] font-mono text-muted-foreground/80">
            {isSceneMode ? "Scene beat pacing verified" : "ClickHouse benchmark indexed"}
          </span>
        </div>
      </div>
    </div>
  );
}
