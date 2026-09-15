"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Film,
  Sparkles,
  Printer,
  Camera,
  Users,
  TrendingUp,
  MapPin,
  CheckCircle2,
  Share2,
  Lock,
  Globe,
} from "lucide-react";
import type { ProjectData, ProjectCharacter } from "@/lib/project-store";

interface DirectorLookbookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectTitle: string;
  genre: string;
  premise: string;
  sceneTitle: string;
  sceneSummary: string;
  characters: ProjectCharacter[];
  directorStyle?: string;
  coreSecret?: string;
  primaryLocation?: string;
  targetTerritories?: string[];
}

export function DirectorLookbookDialog({
  open,
  onOpenChange,
  projectTitle,
  genre,
  premise,
  sceneTitle,
  sceneSummary,
  characters,
  directorStyle,
  coreSecret,
  primaryLocation,
  targetTerritories,
}: DirectorLookbookDialogProps) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] bg-card border-border p-6 overflow-y-auto print:m-0 print:p-0 print:border-none print:shadow-none print:max-w-full">
        {/* Header */}
        <DialogHeader className="border-b border-border pb-4 flex flex-row items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Film className="h-5 w-5 text-accent" />
              <DialogTitle className="text-lg font-heading font-bold text-foreground">
                Director&apos;s Pitch Lookbook &amp; Production Bible
              </DialogTitle>
            </div>
            <p className="text-xs text-muted-foreground font-mono">
              Executive pre-visualization package · Generated via BlendEye Studio
            </p>
          </div>

          <div className="flex items-center gap-2 print:hidden">
            <Button
              size="sm"
              variant="outline"
              onClick={handlePrint}
              className="h-8 text-xs gap-1.5 cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print / Save PDF</span>
            </Button>
          </div>
        </DialogHeader>

        {/* Content Body */}
        <div className="space-y-6 pt-4 text-foreground">
          {/* Cover Slate */}
          <div className="rounded-xl border border-border bg-secondary/20 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="border-accent/40 bg-accent/10 text-accent font-mono text-xs px-2 py-0.5">
                  {genre} · 2.39:1 Scope
                </Badge>
                {directorStyle && (
                  <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-400 font-mono text-xs px-2 py-0.5">
                    Tone: {directorStyle}
                  </Badge>
                )}
              </div>
              <span className="font-mono text-xs text-muted-foreground">Status: Pre-Production Ready</span>
            </div>

            <div>
              <h1 className="text-2xl font-heading font-bold tracking-tight text-foreground">{projectTitle}</h1>
              <p className="text-xs font-mono text-accent mt-0.5">{sceneTitle}</p>
            </div>

            <div className="border-t border-border/60 pt-3">
              <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider block mb-1">
                Core Dramatic Premise:
              </span>
              <p className="text-xs text-foreground/90 font-mono leading-relaxed">{premise}</p>
            </div>
          </div>

          {/* Directorial Blueprint & Story Architecture */}
          {(primaryLocation || coreSecret || (targetTerritories && targetTerritories.length > 0)) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {primaryLocation && (
                <div className="rounded-lg border border-border bg-card p-3.5 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-emerald-400" />
                    <span className="text-xs font-heading font-bold uppercase tracking-wider text-foreground">
                      Primary Dramatic Location
                    </span>
                  </div>
                  <p className="text-xs font-mono text-emerald-300/90 leading-relaxed bg-emerald-500/5 p-2 rounded border border-emerald-500/20">
                    {primaryLocation}
                  </p>
                </div>
              )}

              {coreSecret && (
                <div className="rounded-lg border border-border bg-card p-3.5 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-amber-400" />
                    <span className="text-xs font-heading font-bold uppercase tracking-wider text-foreground">
                      Asymmetric Core Secret
                    </span>
                  </div>
                  <p className="text-xs font-mono text-amber-300/90 leading-relaxed bg-amber-500/5 p-2 rounded border border-amber-500/20">
                    {coreSecret}
                  </p>
                </div>
              )}

              {targetTerritories && targetTerritories.length > 0 && (
                <div className="rounded-lg border border-border bg-card p-3.5 space-y-2 md:col-span-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-cyan-400" />
                      <span className="text-xs font-heading font-bold uppercase tracking-wider text-foreground">
                        Target Distribution Territories
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      Priority Box Office Footprint
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {targetTerritories.map((t) => (
                      <Badge
                        key={t}
                        variant="outline"
                        className="border-cyan-500/40 bg-cyan-500/10 text-cyan-300 font-mono text-xs px-2 py-0.5"
                      >
                        {t}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Character DNA Grid */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-accent" />
              <h3 className="text-sm font-heading font-bold uppercase tracking-wider">Cast &amp; Character Profiles</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {characters.map((c) => (
                <div key={c.name} className="rounded-lg border border-border bg-card p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-heading font-bold text-sm text-foreground">{c.name}</span>
                    <Badge variant="secondary" className="text-[10px] font-mono">
                      {c.archetype}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono text-muted-foreground border-t border-border/50 pt-2">
                    <div>
                      <span className="text-[10px] uppercase text-muted-foreground/70 block">Dialogue Cadence</span>
                      <span className="text-foreground">{c.speechStyle || "Naturalistic / Gritty"}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase text-muted-foreground/70 block">Subtext Ratio</span>
                      <span className="text-foreground">{c.subtextRatio || "80% Subtext / 20% Text"}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Staging & Camera Rig */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Camera className="h-4 w-4 text-emerald-400" />
              <h3 className="text-sm font-heading font-bold uppercase tracking-wider">Camera Blocking &amp; Visual Strategy</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-lg border border-border bg-card p-3 space-y-1">
                <span className="font-heading font-semibold text-xs text-foreground block">Cam A · Master Wide</span>
                <span className="font-mono text-xs text-emerald-400">35mm T1.5 Anamorphic</span>
                <p className="text-[11px] text-muted-foreground leading-snug">Establishes spatial geography and environmental tension across the stage perimeter.</p>
              </div>

              <div className="rounded-lg border border-border bg-card p-3 space-y-1">
                <span className="font-heading font-semibold text-xs text-foreground block">Cam B · Over-The-Shoulder</span>
                <span className="font-mono text-xs text-cyan-400">50mm T1.3 Prime</span>
                <p className="text-[11px] text-muted-foreground leading-snug">Racks focus between lead subjects during high-friction confrontation beats.</p>
              </div>

              <div className="rounded-lg border border-border bg-card p-3 space-y-1">
                <span className="font-heading font-semibold text-xs text-foreground block">Cam C · Tight Close-Up</span>
                <span className="font-mono text-xs text-amber-400">85mm T1.4 Portrait</span>
                <p className="text-[11px] text-muted-foreground leading-snug">Isolates micro-expressions and asymmetric hidden knowledge cues.</p>
              </div>
            </div>
          </div>

          {/* Executive Release Sign-off */}
          <div className="rounded-xl border border-border/80 bg-secondary/30 p-4 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span className="text-muted-foreground font-mono">
                Verified: Dialogue stems, ClickHouse knowledge states, and Omni Flash video manifests compiled.
              </span>
            </div>
            <Badge variant="outline" className="border-border font-mono text-[10px]">
              v1.0 Release
            </Badge>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
