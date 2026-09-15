"use client";

import * as React from "react";
import { SlateLabel } from "@/components/cinema/slate-label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DollarSign, Calendar, Layers, Sparkles, RefreshCw, Flame } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { notifyIfFallback } from "@/lib/fallback-notice";
import { type FilmScene, type SupportedCurrency, getProjectById, formatCurrency } from "@/lib/project-store";
import type { SceneProductionBreakdown, StripboardBreakdownResponse } from "@/lib/agent-service";

interface StripboardScene {
  sceneNumber: string;
  setting: "INT" | "EXT";
  timeOfDay: "DAY" | "NIGHT";
  location: string;
  pages: string;
  castIds: number[];
  stuntsOrFX: string;
  shootDay: number;
  isBridge?: boolean;
  summary?: string;
  screenplayText?: string;
}

interface StripboardViewProps {
  projectTitle: string;
  characters?: Array<{ name: string }>;
  screenplayText?: string;
  scenes?: FilmScene[];
  className?: string;
  projectId?: string;
  budgetPerShootDay?: number;
  currency?: SupportedCurrency;
}

interface CachedStripboard {
  breakdown: Record<string, SceneProductionBreakdown>;
  productionSummary: string;
  fingerprint: string;
}

const stripboardCache = new Map<string, CachedStripboard>();

// Session-scoped cache only. This used to be mirrored into sessionStorage;
// the app no longer persists working data in the browser, so a refresh
// re-derives the stripboard.
function getCachedStripboard(projectId: string): CachedStripboard | null {
  return stripboardCache.get(projectId) ?? null;
}

function setCachedStripboard(projectId: string, data: CachedStripboard) {
  stripboardCache.set(projectId, data);
}

export function StripboardView({
  projectTitle,
  characters = [],
  screenplayText = "",
  scenes = [],
  className,
  projectId = "",
  budgetPerShootDay,
  currency,
}: StripboardViewProps) {
  const [aiBreakdown, setAiBreakdown] = React.useState<Record<string, SceneProductionBreakdown>>(() => {
    const cached = getCachedStripboard(projectId);
    return cached ? cached.breakdown : {};
  });
  const [productionSummary, setProductionSummary] = React.useState<string>(() => {
    const cached = getCachedStripboard(projectId);
    return cached ? cached.productionSummary : "";
  });
  const [isAuditing, setIsAuditing] = React.useState(false);

  const strips: StripboardScene[] = React.useMemo(() => {
    // 1. If multi-scene reel exists, map directly from scenes
    if (scenes && scenes.length > 0) {
      return scenes.map((sc, idx) => {
        const slug = sc.slugline?.toUpperCase() || "INT. LOCATION - NIGHT";
        const setting: "INT" | "EXT" = slug.includes("EXT") ? "EXT" : "INT";
        const timeOfDay: "DAY" | "NIGHT" = slug.includes("DAY") ? "DAY" : "NIGHT";
        const loc = sc.location?.toUpperCase() || sc.title.toUpperCase();

        const activeCast: number[] = [];
        characters.forEach((char, cIdx) => {
          if (
            (sc.castPresent && sc.castPresent.includes(char.name)) ||
            (sc.screenplayText && sc.screenplayText.includes(char.name.toUpperCase()))
          ) {
            activeCast.push(cIdx + 1);
          }
        });
        if (activeCast.length === 0) activeCast.push(1);

        const totalEighths = Math.max(1, Math.round(((sc.durationSeconds || 180) / 60) * 8));
        const pageWhole = Math.floor(totalEighths / 8);
        const pageEighths = totalEighths % 8;
        const isBridge = Boolean(
          sc.isBridge ||
          sc.id?.startsWith("bridge") ||
          sc.title?.toLowerCase().includes("bridge")
        );

        const sceneText = `${sc.summary || ""} ${sc.screenplayText || ""}`.toLowerCase();
        const cueTags: string[] = [];
        if (/\b(explo|blast|gunfire|gunshot|crash|collision|fight|brawl|chase)\b/.test(sceneText)) {
          cueTags.push("Stunt Rigging / SFX");
        }
        if (/\b(fire|flame|smoke|fog|rain|steam|strobe)\b/.test(sceneText)) {
          cueTags.push("Practical Atmospheric FX");
        }
        if (/\b(dark|shadow|dim|flicker|amber|strobe|low-key)\b/.test(sceneText)) {
          cueTags.push("Low-Key / Chiaroscuro Lighting");
        }

        return {
          sceneNumber: String(sc.sceneNumber || idx + 1).padStart(2, "0"),
          setting,
          timeOfDay,
          location: loc,
          pages: `${pageWhole} ${pageEighths}/8`,
          castIds: activeCast,
          stuntsOrFX: cueTags.length > 0 ? cueTags.join(", ") : "—",
          shootDay: Math.floor(idx / 2) + 1,
          isBridge,
          summary: sc.summary || "",
          screenplayText: sc.screenplayText || "",
        };
      });
    }

    // 2. Fallback to parsing scenes directly from screenplay text
    if (screenplayText && screenplayText.trim()) {
      const sluglineRegex = /(?:^|\n)(INT\.|EXT\.|INT\.\/EXT\.)\s+([^\n\-–]+)(?:[\-–]\s*([^\n]+))?/gi;
      const matches: RegExpExecArray[] = [];
      let m: RegExpExecArray | null;
      while ((m = sluglineRegex.exec(screenplayText)) !== null) {
        matches.push(m);
      }

      if (matches.length > 0) {
        return matches.map((match, idx) => {
          const settingRaw = match[1].toUpperCase();
          const setting: "INT" | "EXT" = settingRaw.includes("EXT") ? "EXT" : "INT";
          const location = match[2]?.trim().toUpperCase() || "LOCATION";
          const timeRaw = match[3]?.trim().toUpperCase() || "NIGHT";
          const timeOfDay: "DAY" | "NIGHT" = timeRaw.includes("DAY") ? "DAY" : "NIGHT";

          const blockStart = match.index + match[0].length;
          const blockEnd = idx + 1 < matches.length ? matches[idx + 1].index : screenplayText.length;
          const block = screenplayText.slice(blockStart, blockEnd);
          const blockLower = block.toLowerCase();

          const activeCast: number[] = [];
          characters.forEach((char, cIdx) => {
            if (block.toUpperCase().includes(char.name.toUpperCase())) {
              activeCast.push(cIdx + 1);
            }
          });
          if (activeCast.length === 0) activeCast.push(1);

          const lineCount = Math.max(1, block.split("\n").filter((l) => l.trim()).length);
          const totalEighths = Math.max(1, Math.round((lineCount / 55) * 8));
          const pageWhole = Math.floor(totalEighths / 8);
          const pageEighths = totalEighths % 8;

          const cueTags: string[] = [];
          if (/\b(explo|blast|gunfire|gunshot|crash|collision|fight|brawl|chase)\b/.test(blockLower)) {
            cueTags.push("Stunt Rigging / SFX");
          }
          if (/\b(fire|flame|smoke|fog|rain|steam|strobe)\b/.test(blockLower)) {
            cueTags.push("Practical Atmospheric FX");
          }
          if (/\b(dark|shadow|dim|flicker|amber|strobe|low-key)\b/.test(blockLower)) {
            cueTags.push("Low-Key / Chiaroscuro Lighting");
          }

          return {
            sceneNumber: String(idx + 1).padStart(2, "0"),
            setting,
            timeOfDay,
            location,
            pages: `${pageWhole} ${pageEighths}/8`,
            castIds: activeCast,
            stuntsOrFX: cueTags.length > 0 ? cueTags.join(", ") : "—",
            shootDay: Math.floor(idx / 2) + 1,
            summary: block.slice(0, 150),
            screenplayText: block,
          };
        });
      }
    }

    // 3. Project-specific fallbacks
    if (projectId === "space-airlock-demo" || projectTitle.toLowerCase().includes("space")) {
      return [
        {
          sceneNumber: "01",
          setting: "INT",
          timeOfDay: "NIGHT",
          location: "ORBITAL CORRIDOR - BULKHEAD C",
          pages: "1 2/8",
          castIds: [1],
          stuntsOrFX: "Zero-G Wire Rig, Amber Strobe",
          shootDay: 1,
          summary: "Astronaut scrambles through depressurizing tunnel as bulkheads seal.",
        },
        {
          sceneNumber: "02",
          setting: "INT",
          timeOfDay: "NIGHT",
          location: "MODULE 4 AIRLOCK CONSOLE",
          pages: "2 4/8",
          castIds: [1, 2],
          stuntsOrFX: "Depressurization Fog, Manual Purge Valve",
          shootDay: 1,
          summary: "High-friction dispute over override sequence while pressure gauge drops.",
        },
        {
          sceneNumber: "03",
          setting: "INT",
          timeOfDay: "NIGHT",
          location: "HYDROPONICS QUARANTINE LAB",
          pages: "3 1/8",
          castIds: [2],
          stuntsOrFX: "Practical Specimen Pod, Shattered Acrylic",
          shootDay: 2,
          summary: "Specimen containment breaches under emergency power fluctuation.",
        },
        {
          sceneNumber: "04",
          setting: "EXT",
          timeOfDay: "NIGHT",
          location: "OUTER HULL AIRLOCK GANTRY",
          pages: "2 0/8",
          castIds: [1, 2],
          stuntsOrFX: "Space Suit Rigging, Vacuum Purge Explosion",
          shootDay: 3,
          summary: "Spacewalk tether severance under micrometeorite shower.",
        },
      ];
    }

    // Default: dynamic strips for custom projects or Vault Heist
    return [
      {
        sceneNumber: "01",
        setting: "EXT",
        timeOfDay: "NIGHT",
        location: "PERIMETER EXTRACTION ZONE",
        pages: "1 4/8",
        castIds: characters.length > 0 ? [1] : [1, 2],
        stuntsOrFX: "Atmospheric Smoke, Getaway Staging",
        shootDay: 1,
        summary: "Getaway van idles in rain slick alley as police sirens approach.",
      },
      {
        sceneNumber: "02",
        setting: "INT",
        timeOfDay: "NIGHT",
        location: "INTERIOR BREACH STAGING CONDUIT",
        pages: "2 1/8",
        castIds: characters.map((_, i) => i + 1),
        stuntsOrFX: "Sparks FX, Low-key Practical Key",
        shootDay: 1,
        summary: "Thermal cutter breaches security grid as laser tripwires activate.",
      },
      {
        sceneNumber: "03",
        setting: "INT",
        timeOfDay: "NIGHT",
        location: "PRIMARY CONFRONTATION CHAMBER",
        pages: "3 3/8",
        castIds: characters.slice(0, 2).map((_, i) => i + 1),
        stuntsOrFX: "Electronic Timer Display, Hydraulic Locking Safe",
        shootDay: 2,
        summary: "Double-cross revealed as vault timer counts down to nerve gas deployment.",
      },
      {
        sceneNumber: "04",
        setting: "EXT",
        timeOfDay: "DAY",
        location: "AFTERMATH EXTRACTION CANAL",
        pages: "1 6/8",
        castIds: [1],
        stuntsOrFX: "Dawn Haze, Water Tank Footwork",
        shootDay: 3,
        summary: "Lone survivor emerges into morning mist with the encrypted drive.",
      },
    ];
  }, [projectId, projectTitle, screenplayText, characters, scenes]);

  const fingerprint = React.useMemo(() => {
    return strips.map((s) => `${s.sceneNumber}:${s.location}:${s.pages}:${s.stuntsOrFX}`).join("|");
  }, [strips]);

  // Trigger Gemini production breakdown audit
  const handleAuditProduction = React.useCallback(async (isManual: boolean = false) => {
    if (isAuditing || strips.length === 0) return;
    setIsAuditing(true);
    try {
      const payload = {
        project_title: projectTitle,
        genre: "Drama / Thriller",
        scenes: strips.map((s) => ({
          scene_number: s.sceneNumber,
          setting: s.setting,
          time_of_day: s.timeOfDay,
          location: s.location,
          summary: s.summary || "",
          screenplay_text: s.screenplayText || "",
        })),
        raw_screenplay: screenplayText || "",
      };

      const res = await fetch("/api/production/stripboard-breakdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data: StripboardBreakdownResponse = await res.json();
        const map: Record<string, SceneProductionBreakdown> = {};
        if (Array.isArray(data.breakdown)) {
          data.breakdown.forEach((b) => {
            map[b.scene_number] = b;
            const num = parseInt(b.scene_number, 10);
            if (!isNaN(num)) {
              map[String(num)] = b;
              map[String(num).padStart(2, "0")] = b;
            }
          });
        }
        setAiBreakdown(map);
        if (data.production_summary) {
          setProductionSummary(data.production_summary);
        }
        setCachedStripboard(projectId, {
          breakdown: map,
          productionSummary: data.production_summary || "",
          fingerprint,
        });
        notifyIfFallback(data, "Stripboard Logistics Breakdown");
        if (isManual) {
          toast.add({
            title: "Shooting Logistics Audited",
            description: `Analyzed stunts, atmospheric FX, and VFX tiers across ${strips.length} scenes.`,
            type: "success",
          });
        }
      }
    } catch (err) {
      console.error("Failed to audit production:", err);
      if (isManual) {
        toast.add({
          title: "Production Audit Failed",
          description: "Could not reach stripboard breakdown service.",
          type: "error",
        });
      }
    } finally {
      setIsAuditing(false);
    }
  }, [isAuditing, strips, projectTitle, screenplayText, projectId, fingerprint]);

  React.useEffect(() => {
    const cached = getCachedStripboard(projectId);
    const hasValidCache = cached && cached.fingerprint === fingerprint && Object.keys(cached.breakdown).length > 0;
    if (hasValidCache) {
      if (Object.keys(aiBreakdown).length === 0) {
        setAiBreakdown(cached.breakdown);
        setProductionSummary(cached.productionSummary);
      }
      return;
    }
    if (strips.length > 0 && Object.keys(aiBreakdown).length === 0 && !isAuditing) {
      handleAuditProduction(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strips.length, projectId, fingerprint]);

  const castRoster = React.useMemo(() => {
    return characters.map((c, idx) => ({ id: idx + 1, name: c.name }));
  }, [characters]);

  const getStripColor = (setting: "INT" | "EXT", time: "DAY" | "NIGHT") => {
    if (setting === "INT" && time === "NIGHT") return "border-blue-500/50 bg-blue-950/20 text-blue-300";
    if (setting === "INT" && time === "DAY") return "border-slate-400/50 bg-slate-900/30 text-slate-200";
    if (setting === "EXT" && time === "DAY") return "border-amber-500/50 bg-amber-950/20 text-amber-300";
    return "border-emerald-500/50 bg-emerald-950/20 text-emerald-300";
  };

  const totalDays = Math.max(...strips.map((s) => s.shootDay), 1);

  const totalEighths = strips.reduce((sum, s) => {
    const match = s.pages.match(/^(\d+)\s+(\d+)\/8$/);
    if (!match) return sum;
    return sum + Number(match[1]) * 8 + Number(match[2]);
  }, 0);
  const totalPages = Math.round((totalEighths / 8) * 10) / 10;
  const project = React.useMemo(() => (projectId ? getProjectById(projectId) : null), [projectId]);
  const activeCurrency = currency || project?.currency || "USD";
  const activeDayRate = budgetPerShootDay ?? project?.budgetPerShootDayUsd ?? 85_000;
  const isCustomRate = budgetPerShootDay !== undefined || project?.budgetPerShootDayUsd !== undefined;
  const estimatedBudget = totalDays * activeDayRate;
  const formattedBudget = formatCurrency(estimatedBudget, activeCurrency);

  return (
    <div className={`flex flex-col rounded-xl border border-border bg-card p-4 space-y-4 ${className ?? ""}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-accent" />
            <SlateLabel>Production Stripboard &amp; Shooting Logistics</SlateLabel>
          </div>
          <span className="text-xs text-muted-foreground">{projectTitle} · Daily Call &amp; Strip Schedule</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleAuditProduction(true)}
            disabled={isAuditing}
            className="h-7 text-xs gap-1.5 border-accent/40 bg-accent/5 hover:bg-accent/15 text-accent font-medium"
          >
            {isAuditing ? (
              <RefreshCw className="h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
            <span>{isAuditing ? "Auditing Rigging..." : "Audit Cues (Gemini 3.7)"}</span>
          </Button>
          <Badge variant="outline" className="border-accent/40 bg-accent/10 text-accent text-[10px]">
            {totalDays} Shoot Days · {strips.length} Slates Loaded
          </Badge>
        </div>
      </div>

      {/* Production KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div className="rounded-lg border border-border bg-secondary/20 p-2.5 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] uppercase font-semibold">Estimated Budget</span>
            <DollarSign className="h-3.5 w-3.5 text-emerald-400" />
          </div>
          <div className="text-base font-bold font-mono text-foreground">{formattedBudget}</div>
          <span className="text-[10px] text-muted-foreground block">
            {totalDays} shoot day{totalDays === 1 ? "" : "s"} × {formatCurrency(activeDayRate, activeCurrency)}/day ({isCustomRate ? "configured rate" : "default estimate — edit in project settings"})
          </span>
        </div>

        <div className="rounded-lg border border-border bg-secondary/20 p-2.5 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] uppercase font-semibold">Script Pages</span>
            <Calendar className="h-3.5 w-3.5 text-accent" />
          </div>
          <div className="text-base font-bold font-mono text-foreground">{totalPages || "—"}</div>
          <span className="text-[10px] text-muted-foreground block">
            Summed from {strips.length} strip slugline{strips.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="rounded-lg border border-border bg-secondary/20 p-2.5 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] uppercase font-semibold">Cast Roster</span>
          </div>
          <div className="text-base font-bold font-mono text-foreground">{characters.length || 2} Leads</div>
          <span className="text-[10px] text-muted-foreground block">
            {characters.map((c) => c.name).join(", ") || "Active Roster"}
          </span>
        </div>

        <div className="rounded-lg border border-border bg-secondary/20 p-2.5 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] uppercase font-semibold">Shooting Strip Count</span>
          </div>
          <div className="text-base font-bold font-mono text-foreground">{strips.length} Strips</div>
          <span className="text-[10px] text-muted-foreground block">Dynamic 1st AD breakdown</span>
        </div>
      </div>

      {/* 1st AD Summary Banner */}
      {productionSummary && (
        <div className="rounded-lg border border-accent/30 bg-accent/5 p-3 text-xs text-foreground/90 flex items-start gap-2.5">
          <Sparkles className="h-4 w-4 text-accent shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-accent block mb-0.5">1st AD Shooting Logistics &amp; Rigging Plan (Gemini 3.7)</span>
            <p className="text-[11px] text-muted-foreground leading-relaxed">{productionSummary}</p>
          </div>
        </div>
      )}

      {/* Cast Numbers Reference Strip */}
      <div className="flex flex-wrap items-center gap-2 rounded-md bg-secondary/30 p-2 text-xs border border-border/50">
        <span className="text-[10px] uppercase font-semibold text-muted-foreground">Cast Legend:</span>
        {castRoster.map((c) => (
          <span
            key={c.id}
            className="inline-flex items-center gap-1 rounded bg-background px-2 py-0.5 font-mono text-[11px] border border-border"
          >
            <span className="font-bold text-accent">[{c.id}]</span>
            <span className="text-foreground">{c.name}</span>
          </span>
        ))}
      </div>

      {/* Strips Table */}
      <div className="overflow-x-auto rounded-lg border border-border bg-background">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-border bg-secondary/40 text-[10px] uppercase font-mono text-muted-foreground">
              <th className="p-2.5 w-14">Day</th>
              <th className="p-2.5 w-14">Scene</th>
              <th className="p-2.5 w-16">Set</th>
              <th className="p-2.5 w-16">Time</th>
              <th className="p-2.5">Location Description</th>
              <th className="p-2.5 w-16 text-right">Pages</th>
              <th className="p-2.5 w-20 text-center">Cast</th>
              <th className="p-2.5 min-w-[200px]">Stunts &amp; Practical FX (Gemini 3.7)</th>
              <th className="p-2.5 min-w-[220px]">VFX Tier &amp; Special Gear</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60 font-mono">
            {strips.map((strip, idx) => {
              const isNewDay = idx === 0 || strips[idx - 1].shootDay !== strip.shootDay;
              const ai = aiBreakdown[strip.sceneNumber] || aiBreakdown[String(parseInt(strip.sceneNumber, 10))];

              return (
                <React.Fragment key={strip.sceneNumber + idx}>
                  {isNewDay && (
                    <tr className="bg-accent/10 font-bold border-y border-accent/30 text-accent text-[10px]">
                      <td colSpan={9} className="p-1.5 px-3">
                        --- SHOOT DAY #{strip.shootDay} ---
                      </td>
                    </tr>
                  )}
                  <tr className={`hover:bg-secondary/20 transition-colors ${getStripColor(strip.setting, strip.timeOfDay)}`}>
                    <td className="p-2.5 font-bold text-muted-foreground">#{strip.shootDay}</td>
                    <td className="p-2.5 font-bold text-foreground">
                      <div className="flex items-center gap-1.5">
                        <span>{strip.sceneNumber}</span>
                        {strip.isBridge && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 font-mono font-normal">
                            BRIDGE
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-2.5">
                      <span className="rounded px-1.5 py-0.5 text-[10px] font-bold border border-current/30">
                        {strip.setting}
                      </span>
                    </td>
                    <td className="p-2.5">{strip.timeOfDay}</td>
                    <td className="p-2.5 font-sans font-medium text-foreground">
                      <span>{strip.location}</span>
                      {strip.isBridge && (
                        <span className="ml-2 text-[10px] text-purple-400 font-mono font-normal">
                          · AI Connective Beat
                        </span>
                      )}
                    </td>
                    <td className="p-2.5 text-right font-bold text-foreground">{strip.pages}</td>
                    <td className="p-2.5 text-center">
                      <div className="flex justify-center gap-1">
                        {strip.castIds.map((cid) => (
                          <span
                            key={cid}
                            className="inline-block w-4 h-4 rounded-full bg-accent/20 text-accent text-[10px] font-bold text-center leading-4"
                            title={characters[cid - 1]?.name || `Actor ${cid}`}
                          >
                            {cid}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-2.5 font-sans text-xs">
                      {ai ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge
                              variant="outline"
                              className={`text-[9px] py-0 px-1 font-mono uppercase ${
                                ai.stunt_tier === "High"
                                  ? "border-rose-500/50 bg-rose-500/15 text-rose-300"
                                  : ai.stunt_tier === "Moderate"
                                  ? "border-amber-500/50 bg-amber-500/15 text-amber-300"
                                  : "border-border text-muted-foreground"
                              }`}
                            >
                              {ai.stunt_tier !== "None" ? `Stunts: ${ai.stunt_tier}` : "No Stunts"}
                            </Badge>
                            {ai.practical_fx && ai.practical_fx !== "None" && (
                              <span className="text-[10px] text-amber-300 font-mono flex items-center gap-1">
                                <Flame className="h-2.5 w-2.5 shrink-0" />
                                {ai.practical_fx}
                              </span>
                            )}
                          </div>
                          {ai.stunts && ai.stunts !== "None" && (
                            <p className="text-[11px] text-muted-foreground line-clamp-2">{ai.stunts}</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-[11px]">{strip.stuntsOrFX}</span>
                      )}
                    </td>
                    <td className="p-2.5 font-sans text-xs">
                      {ai ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge
                              variant="outline"
                              className={`text-[9px] py-0 px-1 font-mono uppercase ${
                                ai.vfx_tier === "Class A"
                                  ? "border-purple-500/50 bg-purple-500/20 text-purple-300 font-bold"
                                  : ai.vfx_tier === "Class B"
                                  ? "border-cyan-500/50 bg-cyan-500/15 text-cyan-300"
                                  : "border-border text-muted-foreground"
                              }`}
                            >
                              {ai.vfx_tier !== "None" ? `VFX: ${ai.vfx_tier}` : "Zero VFX"}
                            </Badge>
                            {ai.complexity_rating > 2 && (
                              <span className="text-[9px] font-mono text-muted-foreground">
                                Risk Lvl {ai.complexity_rating}/5
                              </span>
                            )}
                          </div>
                          {ai.special_equipment && ai.special_equipment !== "Standard Package" && (
                            <div className="text-[10px] text-cyan-300 font-mono truncate" title={ai.special_equipment}>
                              Gear: {ai.special_equipment}
                            </div>
                          )}
                          {ai.permits_and_hazards && (
                            <div className="text-[10px] text-rose-300/90 font-mono truncate" title={ai.permits_and_hazards}>
                              Permit: {ai.permits_and_hazards}
                            </div>
                          )}
                          {ai.production_notes && (
                            <p className="text-[10px] text-muted-foreground italic line-clamp-1" title={ai.production_notes}>
                              AD: {ai.production_notes}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-[11px] font-mono">Standard Package</span>
                      )}
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
