"use client";

import * as React from "react";
import {
  Clapperboard,
  Film,
  MessageSquareText,
  Database,
  Video,
  Users,
  ChevronRight,
  ChevronLeft,
  Mic,
  Map,
  GitBranch,
  Terminal,
  ArrowRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface OnboardingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ────────────────────────────────────────────────────────────
// Step visuals — built from the app's own motifs (timecode,
// letterbox, sprocket, slate-label) and real data pulled from
// the README's Vault Heist benchmark production, so the numbers
// and quotes shown here are the actual demo content, not filler.
// ────────────────────────────────────────────────────────────

function ProblemVisual() {
  return (
    <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-3 sprocket-edge">
      <div className="rounded-md bg-destructive/10 border border-destructive/25 px-3 py-2.5">
        <div className="slate-label mb-1 before:bg-destructive">Writer Leakage</div>
        <p className="text-xs text-foreground/90 leading-relaxed">
          "I always knew Elena would betray us." <span className="text-muted-foreground italic">— said at minute 12, before the betrayal happens.</span>
        </p>
      </div>
      <div className="rounded-md bg-success/10 border border-success/25 px-3 py-2.5">
        <div className="slate-label mb-1 before:bg-success">Time-gated</div>
        <p className="text-xs text-foreground/90 leading-relaxed">
          "Elena? She's solid. Why would you ask that?" <span className="text-muted-foreground italic">— same character, same minute, honest ignorance.</span>
        </p>
      </div>
    </div>
  );
}

function TimelineVisual() {
  return (
    <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-3 sprocket-edge">
      <div className="flex items-center justify-between">
        <span className="slate-label">Vault Heist / Marcus</span>
        <span className="timecode text-sm">00:34:00</span>
      </div>
      <div className="relative h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="absolute inset-y-0 left-0 w-[38%] bg-accent/70" />
        <div className="absolute inset-y-0 left-[38%] w-px bg-accent shadow-[0_0_8px_var(--accent)]" />
      </div>
      <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-foreground/90 leading-relaxed">
        "The keys are in my vest, right where they've always been. Why do you keep asking?"
      </div>
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <ArrowRight className="h-3 w-3" />
        <span>drag to <span className="timecode text-[10px]">00:52:00</span> — after Elena locks the blast doors</span>
      </div>
      <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-foreground/90 leading-relaxed">
        "They're gone. She took them. There's a backup airshaft — third grate past the server room."
      </div>
    </div>
  );
}

function QueryVisual() {
  return (
    <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-2.5 sprocket-edge">
      <div className="flex items-center justify-between">
        <span className="slate-label">story_events · MergeTree</span>
        <span className="text-[10px] font-mono text-success">1–3ms</span>
      </div>
      <pre className="rounded-md bg-muted/60 px-3 py-2.5 text-[10.5px] font-mono text-foreground/85 leading-relaxed overflow-x-auto">
{`SELECT event_type, content FROM story_events
WHERE project_id = ? AND character_name = ?
  AND event_timestamp <= '00:34:00'
ORDER BY event_timestamp`}
      </pre>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Every scrub and every Hot Seat question runs this query. No LLM pass needed just to move the playhead — the knowledge boundary is enforced by the database, not a prompt instruction the model can ignore.
      </p>
    </div>
  );
}

function PrecedentsVisual() {
  const rows = [
    { film: "Heat", trope: "Crew fracture under pressure", retention: "88%" },
    { film: "Sicario", trope: "Moral ambiguity reveal", retention: "81%" },
    { film: "Alien", trope: "Isolated crew, hidden threat", retention: "84%" },
  ];
  return (
    <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-2.5 sprocket-edge">
      <div className="flex items-center justify-between">
        <span className="slate-label">cinematic_precedents</span>
        <Database className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div
            key={r.film}
            className="flex items-center justify-between text-xs rounded-md bg-muted/50 px-2.5 py-1.5"
          >
            <div className="min-w-0">
              <span className="font-medium text-foreground">{r.film}</span>
              <span className="text-muted-foreground"> — {r.trope}</span>
            </div>
            <span className="font-mono text-[10px] text-muted-foreground shrink-0 pl-2">
              {r.retention} retention
            </span>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        The Showrunner AI cites rows like these when it critiques pacing — creative notes backed by comps, not just opinion.
      </p>
    </div>
  );
}

function ProductionVisual() {
  const items = [
    { icon: Mic, label: "Table read", detail: "Multi-speaker TTS, 6 voice timbres, DSP reverb/pitch" },
    { icon: Map, label: "Floor plan", detail: "35mm / 50mm / 85mm / 24mm lens presets" },
    { icon: Video, label: "Omni Flash shots", detail: "Pixel-anchored across cuts, 2.39:1 widescreen" },
    { icon: GitBranch, label: "Version control", detail: "Full snapshots, undo/redo, rollback" },
  ];
  return (
    <div className="rounded-lg border border-border bg-secondary/30 p-4 sprocket-edge">
      <div className="grid grid-cols-2 gap-2">
        {items.map(({ icon: Icon, label, detail }) => (
          <div key={label} className="rounded-md bg-muted/50 px-2.5 py-2 space-y-1">
            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
            <div className="text-xs font-medium text-foreground">{label}</div>
            <div className="text-[10px] text-muted-foreground leading-snug">{detail}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CommanderVisual() {
  return (
    <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-2.5 sprocket-edge">
      <div className="flex items-center gap-2">
        <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="slate-label">Studio Commander</span>
      </div>
      <div className="rounded-md bg-muted/60 px-3 py-2 text-xs text-foreground/90 font-mono">
        "Add a corrupt security officer named Silas, then increase tension in the third beat."
      </div>
      <div className="space-y-1">
        {["Character node created — Silas", "Beat 3 tension raised", "Continuity check run"].map((s) => (
          <div key={s} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <div className="h-1 w-1 rounded-full bg-success shrink-0" />
            {s}
          </div>
        ))}
      </div>
    </div>
  );
}

const STEPS: Array<{
  icon: React.ElementType;
  tag: string;
  title: string;
  description: string;
  visual: React.ReactNode;
}> = [
  {
    icon: Clapperboard,
    tag: "The problem",
    title: "Characters shouldn't know the ending",
    description:
      "Writers constantly fight \"writer leakage\": characters who speak as if they've read the whole script, foreshadowing twists they haven't lived through yet. BlendEye fixes this by treating every character's knowledge as a queryable, timestamped fact — not something an AI has to be told to forget.",
    visual: <ProblemVisual />,
  },
  {
    icon: Film,
    tag: "Timeline scrubber",
    title: "Scrub the runtime, watch answers change",
    description:
      "This is the actual Vault Heist demo. Ask Marcus about the vault keys at minute 34 and he answers honestly — he still has them. Drag forward 18 minutes, past the point where Elena locks the blast doors, and his answer changes because the story changed, not because you re-prompted him.",
    visual: <TimelineVisual />,
  },
  {
    icon: Database,
    tag: "How it works",
    title: "Enforced by ClickHouse, not a prompt",
    description:
      "Every character fact is a row in a MergeTree table ordered by (project, character, timestamp). Scrubbing the timeline runs a real SQL query with a timestamp cutoff — it returns in 1 to 3 milliseconds and produces the exact knowledge context handed to the model. The firewall is structural, so it can't be talked around.",
    visual: <QueryVisual />,
  },
  {
    icon: MessageSquareText,
    tag: "Showrunner AI",
    title: "Notes grounded in stored comps",
    description:
      "The Showrunner co-writer doesn't just have opinions about your pacing — it queries a table of real films, tropes, and retention benchmarks and cites them when it critiques a scene. (The numeric benchmarks are hand-authored demo data, not measured box office.) Apply its rewrites directly through conversation.",
    visual: <PrecedentsVisual />,
  },
  {
    icon: Video,
    tag: "Production tools",
    title: "Pre-production, end to end",
    description:
      "Beyond the writers' room: cast table reads with distinct AI voices, block scenes on a 2D floor plan with real lens presets, and generate Omni Flash video shots that stay visually consistent across cuts by conditioning each shot on the last frame of the one before it.",
    visual: <ProductionVisual />,
  },
  {
    icon: Users,
    tag: "Studio Commander",
    title: "Direct the studio in plain language",
    description:
      "Type a instruction and the Commander dispatches it as real actions — creating characters, editing scenes, adjusting tension, running a continuity check — instead of you clicking through five separate tools.",
    visual: <CommanderVisual />,
  },
];

export function OnboardingDialog({ open, onOpenChange }: OnboardingDialogProps) {
  const [stepIndex, setStepIndex] = React.useState(0);

  React.useEffect(() => {
    if (open) setStepIndex(0);
  }, [open]);

  const step = STEPS[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === STEPS.length - 1;
  const StepIcon = step.icon;

  const goNext = () => {
    if (isLast) {
      onOpenChange(false);
      return;
    }
    setStepIndex((i) => i + 1);
  };
  const goBack = () => setStepIndex((i) => Math.max(0, i - 1));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 overflow-hidden bg-card border-border shadow-2xl gap-0">
        <DialogHeader className="p-6 pb-0 gap-3">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center shrink-0">
              <StepIcon className="h-4 w-4 text-accent" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle>{step.title}</DialogTitle>
            </div>
            <Badge variant="outline" className="text-[10px] font-mono shrink-0">
              {stepIndex + 1} / {STEPS.length} · {step.tag}
            </Badge>
          </div>
          <DialogDescription className="text-[13px] leading-relaxed">
            {step.description}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-5">{step.visual}</div>

        <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/30 px-6 py-4">
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStepIndex(i)}
                aria-label={`Go to step ${i + 1}`}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === stepIndex ? "w-5 bg-accent" : "w-1.5 bg-border hover:bg-muted-foreground/50"
                )}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {!isFirst && (
              <Button variant="ghost" size="sm" onClick={goBack} className="gap-1">
                <ChevronLeft className="h-3.5 w-3.5" />
                Back
              </Button>
            )}
            {!isLast && (
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                Skip
              </Button>
            )}
            <Button size="sm" onClick={goNext} className="gap-1">
              {isLast ? "Start creating" : "Next"}
              {!isLast && <ChevronRight className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
