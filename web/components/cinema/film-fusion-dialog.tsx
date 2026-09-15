"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SlateLabel } from "@/components/cinema/slate-label";
import { Shuffle, Sparkles, ArrowRight, Layers, UserCheck } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { notifyIfFallback } from "@/lib/fallback-notice";
import type { FilmFusionResponse } from "@/lib/agent-service";
import { getAllProjects, saveProject, type ProjectData, type ProjectCharacter } from "@/lib/project-store";
import { useAuth } from "@/lib/auth-context";

interface FilmFusionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFusionComplete?: (res: FilmFusionResponse) => void;
}

export function FilmFusionDialog({
  open,
  onOpenChange,
  onFusionComplete,
}: FilmFusionDialogProps) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [projects, setProjects] = React.useState<ProjectData[]>([]);
  const [selectedProjAId, setSelectedProjAId] = React.useState<string>("");
  const [selectedProjBId, setSelectedProjBId] = React.useState<string>("");
  const [isFusing, setIsFusing] = React.useState(false);
  const [directive, setDirective] = React.useState(
    "The heist crew infiltrates an orbital research station during an emergency quarantine breach, forcing opposing survivors into an armed standoff."
  );
  const [fusionResult, setFusionResult] = React.useState<FilmFusionResponse | null>(null);

  React.useEffect(() => {
    if (open) {
      const projs = getAllProjects();
      setProjects(projs);
      if (projs.length >= 2) {
        if (!projs.some((p) => p.id === selectedProjAId)) setSelectedProjAId(projs[0].id);
        if (!projs.some((p) => p.id === selectedProjBId)) setSelectedProjBId(projs[1].id);
      }
    }
  }, [open]);

  const projA = projects.find((p) => p.id === selectedProjAId) || projects[0];
  const projB = projects.find((p) => p.id === selectedProjBId) || projects[1] || projects[0];

  const handleRunFusion = async () => {
    if (isFusing) return;
    setIsFusing(true);
    setFusionResult(null);

    const titleA = projA?.title || "Film Alpha";
    const scriptA =
      projA?.screenplayText ||
      `INT. UNDERGROUND VAULT - NIGHT\nMARCUS: The bypass keys are gone. Elena, you were the last one at the locker.\nELENA: We have six minutes until atmospheric purge.`;
    const titleB =
      projB?.title || "Film Beta";
    const scriptB =
      projB?.screenplayText ||
      `INT. ORBITAL RESEARCH MODULE - ZERO GRAVITY\nCOMMANDER VANCE: Ray, someone entered the override sequence to purge the airlock!\nENGINEER RAY: If I didn't vent that compartment, whatever was inside would have reached life support.`;

    const fusionPid = `fusion-${selectedProjAId.slice(0, 8)}-${selectedProjBId.slice(0, 8)}`;

    try {
      const res = await fetch("/api/fusion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title_a: titleA,
          script_a: scriptA,
          title_b: titleB,
          script_b: scriptB,
          fusion_directive: directive,
          fusion_project_id: fusionPid,
        }),
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(detail || `Film fusion failed (${res.status})`);
      }
      const data: FilmFusionResponse = await res.json();
      notifyIfFallback(data, "Film Fusion");
      setFusionResult(data);
      if (onFusionComplete) onFusionComplete(data);
    } catch (err) {
      console.error("Fusion error:", err);
      toast.add({
        title: "Film fusion failed",
        description: err instanceof Error ? err.message : "Could not reach the fusion backend.",
        type: "error",
      });
    } finally {
      setIsFusing(false);
    }
  };

  const handleEnterFusedStudio = () => {
    if (fusionResult) {
      // The fused slate is saved to the account and opened in the studio, both
      // of which require a session. Public pages gate the dialog before it
      // opens; this is the backstop for any other caller.
      if (!isAuthenticated) {
        onOpenChange(false);
        router.push("/auth?mode=signup&redirect=%2Fdashboard");
        return;
      }

      const fusedChars: ProjectCharacter[] = fusionResult.character_remappings.map((remap) => ({
        name: remap.original_name,
        archetype: `${remap.fused_role} (${remap.alignment})`,
        speechStyle: remap.speech_style || "sharp, dramatic",
        subtextRatio: remap.subtext_ratio || "extreme",
        actorComp: `${remap.original_name} Comp`,
        objective: remap.fused_role,
      }));

      const fusedPid = fusionResult.fusion_project_id || `fusion-${selectedProjAId.slice(0, 8)}-${selectedProjBId.slice(0, 8)}`;

      const fusedProject: ProjectData = {
        id: fusedPid,
        title: fusionResult.fused_title,
        genre: "Crossover Speculative Thriller",
        premise: fusionResult.fused_logline,
        sceneTitle: `${fusionResult.fused_title} — Reconciled Climax`,
        sceneSummary: fusionResult.fused_logline,
        screenplayText: fusionResult.fused_screenplay,
        characters: fusedChars,
        initialEvents: (fusionResult.reconciled_events || []).map((ev) => {
          const parts = ev.event_timestamp.split(":").map(Number);
          const totalSec = (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
          return {
            atSeconds: totalSec,
            characterName: ev.character_name,
            eventType: ev.event_type as any,
          };
        }),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isCustom: true,
      };

      saveProject(fusedProject);
      onOpenChange(false);
      router.push(`/studio/${fusedPid}`);
    } else {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card border-border p-6 overflow-hidden max-h-[85vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Shuffle className="h-5 w-5 text-accent" />
            <SlateLabel>Layer 4b · Multiverse Crossover Engine</SlateLabel>
          </div>
          <DialogTitle className="text-lg font-heading tracking-tight">
            Film Fusion: Reconcile Two Distinct Stories
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Select two source screenplays to re-map character objectives, resolve narrative conflicts, and reconcile a unified ClickHouse story timeline.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          {/* Dynamic Source Stories Selection */}
          <div className="grid grid-cols-2 gap-3 p-3 rounded-lg border border-border bg-secondary/20 text-xs">
            <div className="space-y-1.5">
              <span className="font-mono text-[10px] text-accent uppercase tracking-wider block">
                Source Story Alpha
              </span>
              <select
                value={selectedProjAId}
                onChange={(e) => setSelectedProjAId(e.target.value)}
                className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground font-semibold"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
              <p className="text-muted-foreground text-[11px] truncate">
                Cast: {projA?.characters?.map((c) => c.name).join(", ") || "Ensemble"}
              </p>
            </div>

            <div className="space-y-1.5">
              <span className="font-mono text-[10px] text-accent uppercase tracking-wider block">
                Source Story Beta
              </span>
              <select
                value={selectedProjBId}
                onChange={(e) => setSelectedProjBId(e.target.value)}
                className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground font-semibold"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
              <p className="text-muted-foreground text-[11px] truncate">
                Cast: {projB?.characters?.map((c) => c.name).join(", ") || "Ensemble"}
              </p>
            </div>
          </div>

          {/* Fusion Directive Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground block">
              Showrunner Fusion Directive:
            </label>
            <textarea
              value={directive}
              onChange={(e) => setDirective(e.target.value)}
              disabled={isFusing}
              rows={2}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-accent resize-none text-foreground placeholder:text-muted-foreground"
            />
          </div>

          {/* Fusion Result Preview */}
          {fusionResult && (
            <div className="p-4 rounded-xl border border-accent/40 bg-accent/5 space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-border/60 pb-2">
                <div>
                  <span className="text-[10px] font-mono text-accent uppercase">Reconciled Crossover</span>
                  <h4 className="font-semibold text-sm">{fusionResult.fused_title}</h4>
                </div>
                <span className="text-[10px] font-mono bg-success/15 border border-success/30 text-success px-2 py-0.5 rounded-full">
                  {fusionResult.events_written_to_clickhouse} Events Committed to ClickHouse
                </span>
              </div>

              <p className="text-xs text-muted-foreground italic">
                &ldquo;{fusionResult.fused_logline}&rdquo;
              </p>

              {/* Character Re-mappings */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-semibold uppercase text-muted-foreground block">
                  Re-mapped Character Roles:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {fusionResult.character_remappings.map((remap, idx) => (
                    <div key={idx} className="p-2 rounded border border-border bg-card text-xs space-y-0.5">
                      <div className="flex items-center justify-between font-semibold">
                        <span className="text-accent">{remap.original_name}</span>
                        <span className="text-[10px] text-muted-foreground font-normal">
                          {remap.alignment}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-snug">
                        {remap.fused_role}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="pt-2 border-t border-border">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>

          {fusionResult ? (
            <Button
              type="button"
              size="sm"
              className="text-xs gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90"
              onClick={handleEnterFusedStudio}
            >
              <span>Enter Fused Writers&apos; Room</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              className="text-xs gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90"
              disabled={isFusing}
              onClick={handleRunFusion}
            >
              <Sparkles className="h-3.5 w-3.5" />
              {isFusing ? "Reconciling Timelines with Gemini & ClickHouse..." : "Reconcile & Fuse Timeline"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
