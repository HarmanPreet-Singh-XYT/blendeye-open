"use client";

import * as React from "react";
import {
  Handle,
  Position,
  useNodeId,
  useReactFlow,
  useNodeConnections,
  type NodeProps,
} from "@xyflow/react";
import { cn } from "@/lib/utils";
import { SlateLabel } from "@/components/cinema/slate-label";
import { FilmstripLoader } from "@/components/cinema/filmstrip-loader";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { notifyIfFallback } from "@/lib/fallback-notice";
import {
  Video,
  FileText,
  User,
  Sliders,
  Sparkles,
  Clapperboard,
  Image as ImageIcon,
  Compass,
  Activity,
  Volume2,
  Globe2,
  Users2,
  Flame,
  MessageSquare,
  Lock,
  Unlock,
  Play,
  RotateCcw,
  Unlink,
  AlertTriangle,
  MapPin,
  Building2,
  DollarSign,
  Check,
  Pencil,
  SlidersHorizontal,
} from "lucide-react";

export type NodeState = "idle" | "generating" | "ready" | "stale" | "error";

const STATE_BADGE: Record<NodeState, { label: string; className: string }> = {
  idle: { label: "Idle", className: "border-border text-muted-foreground" },
  generating: { label: "Generating", className: "border-accent/40 bg-accent/10 text-accent" },
  ready: { label: "Ready", className: "border-success/40 bg-success/15 text-success" },
  stale: { label: "Pending Sync", className: "border-warning/40 bg-warning/15 text-warning animate-pulse" },
  error: { label: "Error", className: "border-destructive/40 bg-destructive/15 text-destructive" },
};

const handleBaseClass =
  "!h-3 !w-3 !border-2 !border-background transition-all hover:!scale-150 hover:ring-4 hover:ring-accent/40 cursor-crosshair z-20";

/**
 * Shared themed shell for all nodes in the Unreal Engine Blueprint-style graph.
 */
function BlueprintNodeShell({
  kind,
  title,
  icon: Icon,
  state = "ready",
  selected,
  colorScheme = "default",
  headerRight,
  children,
}: {
  kind: string;
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  state?: NodeState;
  selected?: boolean;
  colorScheme?: "default" | "purple" | "cyan" | "emerald" | "amber" | "rose" | "blue";
  headerRight?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const badge = STATE_BADGE[state];
  const nodeId = useNodeId();
  const { setEdges } = useReactFlow();
  const connections = useNodeConnections();
  const connCount = connections ? connections.length : 0;

  const borderColors = {
    default: selected ? "border-accent ring-2 ring-accent/30" : "border-border/80",
    purple: selected ? "border-purple-500 ring-2 ring-purple-500/30" : "border-purple-500/40",
    cyan: selected ? "border-cyan-500 ring-2 ring-cyan-500/30" : "border-cyan-500/40",
    emerald: selected ? "border-emerald-500 ring-2 ring-emerald-500/30" : "border-emerald-500/40",
    amber: selected ? "border-amber-500 ring-2 ring-amber-500/30" : "border-amber-500/40",
    rose: selected ? "border-rose-500 ring-2 ring-rose-500/30" : "border-rose-500/40",
    blue: selected ? "border-blue-500 ring-2 ring-blue-500/30" : "border-blue-500/40",
  };

  return (
    <div
      className={cn(
        "sprocket-edge film-grain w-80 rounded-xl border bg-card/95 py-3.5 text-sm shadow-xl backdrop-blur transition-all",
        borderColors[colorScheme]
      )}
    >
      <div className="flex items-start justify-between gap-2 border-b border-border/40 px-3.5 pb-2">
        <div className="flex items-center gap-2">
          {Icon && (
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-secondary/80 text-foreground">
              <Icon className="h-3.5 w-3.5" />
            </div>
          )}
          <div className="flex flex-col gap-0.5">
            <SlateLabel>{kind}</SlateLabel>
            <span className="font-heading text-xs font-semibold leading-tight text-foreground truncate max-w-[150px]">
              {title}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 nodrag">
          {connCount > 0 && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                if (nodeId) {
                  setEdges((eds) =>
                    eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId)
                  );
                }
              }}
              className="flex items-center gap-1 rounded bg-secondary/90 hover:bg-rose-500/20 hover:text-rose-400 hover:border-rose-500/40 border border-border/80 px-1.5 py-0.5 text-[9px] font-mono text-muted-foreground transition-all cursor-pointer nodrag"
              title={`Unlink all ${connCount} wires attached to this node`}
            >
              <Unlink className="h-2.5 w-2.5" />
              <span>{connCount}</span>
            </button>
          )}
          <div className="nodrag">{headerRight}</div>
          <Badge className={cn("text-[9px] py-0 px-1.5", badge.className)}>{badge.label}</Badge>
        </div>
      </div>

      {state === "generating" ? (
        <div className="px-3.5 pt-3 nodrag">
          <FilmstripLoader frames={6} />
        </div>
      ) : (
        <div className="px-3.5 pt-2.5 nodrag cursor-default">{children}</div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// 1. YouTube Clip / Reference Node
// -------------------------------------------------------------
export interface ClipNodeData extends Record<string, unknown> {
  title: string;
  url: string;
  timestampRange: string;
  lightingStyle: string;
  palette: string[];
  pacing: string;
}

export function ClipNode({ data, selected }: NodeProps & { data: ClipNodeData }) {
  return (
    <BlueprintNodeShell
      kind="Clip Reference"
      title={data.title || "YouTube Cinematography"}
      icon={Video}
      colorScheme="purple"
      selected={selected}
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground">
          <span className="truncate max-w-[170px] text-accent/90">{data.url}</span>
          <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px]">{data.timestampRange}</span>
        </div>

        <div className="rounded border border-border/50 bg-background/60 p-2 text-xs">
          <div className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground">Extracted Aesthetic:</div>
          <p className="mt-0.5 text-[11px] leading-snug text-foreground/90">{data.lightingStyle}</p>
        </div>

        {data.palette && data.palette.length > 0 && (
          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] text-muted-foreground">Palette Swatches:</span>
            <div className="flex items-center gap-1">
              {data.palette.map((hex, i) => (
                <div
                  key={i}
                  className="h-3.5 w-3.5 rounded-full border border-border/60 shadow-sm"
                  style={{ backgroundColor: hex }}
                  title={hex}
                />
              ))}
            </div>
          </div>
        )}

        {/* Output & Universal Input Ports */}
        <div className="relative mt-1 flex items-center justify-between pt-1 border-t border-border/30">
          <div className="flex items-center">
            <Handle
              type="target"
              position={Position.Left}
              id="flow_in"
              className={cn(handleBaseClass, "!bg-purple-500 -left-5")}
            />
            <span className="text-[10px] font-mono text-purple-400 ml-1">← in</span>
          </div>
          <div className="flex items-center">
            <span className="text-[10px] font-mono text-purple-400 mr-2">style_ref →</span>
            <Handle
              type="source"
              position={Position.Right}
              id="style_ref"
              className={cn(handleBaseClass, "!bg-purple-500 -right-5")}
            />
          </div>
        </div>
      </div>
    </BlueprintNodeShell>
  );
}

// -------------------------------------------------------------
// 2. Brainstorm Note / Voice Memo / Plot Seed Node
// -------------------------------------------------------------
export interface NoteNodeData extends Record<string, unknown> {
  noteType: "Voice Memo" | "Plot Seed" | "Dialogue Snippet" | "World Lore";
  content: string;
  audioDuration?: string;
}

export function NoteNode({ id, data, selected }: NodeProps & { data: NoteNodeData }) {
  const { updateNodeData } = useReactFlow();
  const [isEditing, setIsEditing] = React.useState(false);
  const [content, setContent] = React.useState(data.content || "");

  const handleBlur = () => {
    setIsEditing(false);
    updateNodeData(id, { content });
  };

  return (
    <BlueprintNodeShell
      kind={data.noteType || "Idea Note"}
      title={data.noteType || "Brainstorm"}
      icon={FileText}
      colorScheme="amber"
      selected={selected}
    >
      <div className="flex flex-col gap-2">
        {data.audioDuration && (
          <div className="flex items-center gap-1.5 rounded bg-amber-500/10 px-2 py-1 text-[11px] text-amber-400 border border-amber-500/20">
            <Volume2 className="h-3 w-3 animate-pulse" />
            <span className="font-mono">Voice Memo ({data.audioDuration})</span>
          </div>
        )}

        {isEditing ? (
          <textarea
            autoFocus
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onBlur={handleBlur}
            rows={3}
            className="w-full rounded border border-accent bg-background/90 p-1.5 text-xs text-foreground outline-none font-sans resize-none"
          />
        ) : (
          <p
            onClick={() => setIsEditing(true)}
            className="rounded border border-border/50 bg-background/60 p-2 text-xs leading-relaxed text-foreground/90 line-clamp-3 italic cursor-text hover:border-accent/60 transition-colors"
            title="Click to edit brainstorm note inline"
          >
            &ldquo;{content}&rdquo;
          </p>
        )}

        {/* Output & Universal Input Ports */}
        <div className="relative mt-1 flex items-center justify-between pt-1 border-t border-border/30">
          <div className="flex items-center">
            <Handle
              type="target"
              position={Position.Left}
              id="flow_in"
              className={cn(handleBaseClass, "!bg-amber-500 -left-5")}
            />
            <span className="text-[10px] font-mono text-amber-400 ml-1">← in</span>
          </div>
          <div className="flex items-center">
            <span className="text-[10px] font-mono text-amber-400 mr-2">plot_seed →</span>
            <Handle
              type="source"
              position={Position.Right}
              id="plot_seed"
              className={cn(handleBaseClass, "!bg-amber-500 -right-5")}
            />
          </div>
        </div>
      </div>
    </BlueprintNodeShell>
  );
}

// -------------------------------------------------------------
// 3. Actor Legacy / Dream Comp Node
// -------------------------------------------------------------
export interface ActorNodeData extends Record<string, unknown> {
  actorName: string;
  roleReference: string;
  vocalWeight: string;
  energyProfile: string;
}

export function ActorNode({ id, data, selected }: NodeProps & { data: ActorNodeData }) {
  const nodeId = id || useNodeId();
  const connections = useNodeConnections();
  const isWired = connections && connections.length > 0;

  return (
    <BlueprintNodeShell
      kind="Actor Legacy Comp"
      title={data.actorName || "Dream Actor"}
      icon={User}
      colorScheme="emerald"
      selected={selected}
    >
      <div className="flex flex-col gap-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono text-emerald-400 uppercase font-semibold">
            Dream Casting Intent
          </span>
          {isWired && (
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
              <Check className="h-2.5 w-2.5" /> Wired to Cast
            </span>
          )}
        </div>

        <div className="rounded border border-emerald-500/20 bg-emerald-500/5 p-2">
          <div className="text-[10px] font-mono uppercase text-emerald-400/90">Past Performance Baseline:</div>
          <p className="mt-0.5 text-[11px] font-medium text-foreground">{data.roleReference || "Intense cinematic benchmark"}</p>
        </div>

        <div className="grid grid-cols-2 gap-1.5 text-[11px]">
          <div className="rounded bg-secondary/40 border border-border/40 p-1.5">
            <span className="text-[9px] font-mono text-muted-foreground block">Vocal Delivery:</span>
            <span className="font-mono text-foreground font-medium text-[10px] truncate block">
              {data.vocalWeight || "Authoritative"}
            </span>
          </div>
          <div className="rounded bg-secondary/40 border border-border/40 p-1.5">
            <span className="text-[9px] font-mono text-muted-foreground block">Energy Profile:</span>
            <span className="font-mono text-foreground font-medium text-[10px] truncate block">
              {data.energyProfile || "Simmering High Stakes"}
            </span>
          </div>
        </div>

        <p className="text-[9px] text-muted-foreground/80 leading-tight">
          Wire <code className="text-emerald-400">actor_out</code> into Character Core <code className="text-emerald-400">actor_ref</code> to inject casting likeness & vocal tone into Gemini/Omni Flash.
        </p>

        {/* Output & Universal Input Ports */}
        <div className="relative mt-1 flex items-center justify-between pt-1 border-t border-border/30">
          <div className="flex items-center">
            <Handle
              type="target"
              position={Position.Left}
              id="flow_in"
              className={cn(handleBaseClass, "!bg-emerald-500 -left-5")}
            />
            <span className="text-[10px] font-mono text-emerald-400 ml-1">← in</span>
          </div>
          <div className="flex items-center">
            <span className="text-[10px] font-mono text-emerald-400 mr-2">actor_out →</span>
            <Handle
              type="source"
              position={Position.Right}
              id="actor_out"
              className={cn(handleBaseClass, "!bg-emerald-500 -right-5")}
            />
          </div>
        </div>
      </div>
    </BlueprintNodeShell>
  );
}

// -------------------------------------------------------------
// 4. Personality Dial Node
// -------------------------------------------------------------
export interface PersonalityNodeData extends Record<string, unknown> {
  confidence: number;
  speed: number;
  subtext: number;
  presetName?: string;
  onTweak?: (dials: { confidence: number; speed: number; subtext: number }) => void;
}

export function PersonalityNode({ id, data, selected }: NodeProps & { data: PersonalityNodeData }) {
  const { updateNodeData } = useReactFlow();
  const [confidence, setConfidence] = React.useState(data.confidence ?? 60);
  const [speed, setSpeed] = React.useState(data.speed ?? 45);
  const [subtext, setSubtext] = React.useState(data.subtext ?? 75);

  const handleConfidenceChange = (val: number) => {
    setConfidence(val);
    updateNodeData(id, { confidence: val });
    data.onTweak?.({ confidence: val, speed, subtext });
  };

  const handleSpeedChange = (val: number) => {
    setSpeed(val);
    updateNodeData(id, { speed: val });
    data.onTweak?.({ confidence, speed: val, subtext });
  };

  const handleSubtextChange = (val: number) => {
    setSubtext(val);
    updateNodeData(id, { subtext: val });
    data.onTweak?.({ confidence, speed, subtext: val });
  };

  return (
    <BlueprintNodeShell
      kind="Personality Dials"
      title={data.presetName || "Character Dials"}
      icon={Sliders}
      colorScheme="cyan"
      selected={selected}
    >
      <div className="flex flex-col gap-2.5 text-xs">
        {/* Confidence Dial Slider */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
            <span>Confidence</span>
            <span className="text-cyan-400 font-bold">{confidence}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={confidence}
            onChange={(e) => handleConfidenceChange(Number(e.target.value))}
            className="w-full h-1.5 accent-cyan-400 bg-secondary rounded-lg appearance-none cursor-pointer nodrag"
          />
        </div>

        {/* Verbal Pacing Dial Slider */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
            <span>Verbal Pacing (Staccato ↔ Manic)</span>
            <span className="text-cyan-400 font-bold">{speed}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={speed}
            onChange={(e) => handleSpeedChange(Number(e.target.value))}
            className="w-full h-1.5 accent-cyan-400 bg-secondary rounded-lg appearance-none cursor-pointer nodrag"
          />
        </div>

        {/* Subtext & Sarcasm Dial Slider */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
            <span>Subtext & Sarcasm</span>
            <span className="text-cyan-400 font-bold">{subtext}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={subtext}
            onChange={(e) => handleSubtextChange(Number(e.target.value))}
            className="w-full h-1.5 accent-cyan-400 bg-secondary rounded-lg appearance-none cursor-pointer nodrag"
          />
        </div>

        {/* Output & Universal Input Ports */}
        <div className="relative mt-1 flex items-center justify-between pt-1 border-t border-border/30">
          <div className="flex items-center">
            <Handle
              type="target"
              position={Position.Left}
              id="flow_in"
              className={cn(handleBaseClass, "!bg-cyan-500 -left-5")}
            />
            <span className="text-[10px] font-mono text-cyan-400 ml-1">← in</span>
          </div>
          <div className="flex items-center">
            <span className="text-[10px] font-mono text-cyan-400 mr-2">personality_out →</span>
            <Handle
              type="source"
              position={Position.Right}
              id="personality_out"
              className={cn(handleBaseClass, "!bg-cyan-500 -right-5")}
            />
          </div>
        </div>
      </div>
    </BlueprintNodeShell>
  );
}

// -------------------------------------------------------------
// 5. Behavioral Quirks & Tics Node
// -------------------------------------------------------------
export interface QuirksNodeData extends Record<string, unknown> {
  tics: string[];
}

export function QuirksNode({ data, selected }: NodeProps & { data: QuirksNodeData }) {
  return (
    <BlueprintNodeShell
      kind="Behavioral Quirks"
      title="Character Tics"
      icon={Sparkles}
      colorScheme="rose"
      selected={selected}
    >
      <div className="flex flex-col gap-1.5 text-xs">
        {data.tics?.map((tic, i) => (
          <div
            key={i}
            className="flex items-center gap-1.5 rounded bg-rose-500/10 px-2 py-1 text-[11px] text-rose-300 border border-rose-500/20"
          >
            <span className="h-1 w-1 rounded-full bg-rose-400" />
            <span>{tic}</span>
          </div>
        ))}

        {/* Output & Universal Input Ports */}
        <div className="relative mt-1 flex items-center justify-between pt-1 border-t border-border/30">
          <div className="flex items-center">
            <Handle
              type="target"
              position={Position.Left}
              id="flow_in"
              className={cn(handleBaseClass, "!bg-rose-500 -left-5")}
            />
            <span className="text-[10px] font-mono text-rose-400 ml-1">← in</span>
          </div>
          <div className="flex items-center">
            <span className="text-[10px] font-mono text-rose-400 mr-2">quirks_out →</span>
            <Handle
              type="source"
              position={Position.Right}
              id="quirks_out"
              className={cn(handleBaseClass, "!bg-rose-500 -right-5")}
            />
          </div>
        </div>
      </div>
    </BlueprintNodeShell>
  );
}

// -------------------------------------------------------------
// 6. Modular Character Core Node (Anchor)
// -------------------------------------------------------------
export interface CharacterCoreNodeData extends Record<string, unknown> {
  name: string;
  archetype: string;
  objective: string;
  ttsVoice?: string;
  actorComp?: string;
  dialsSummary?: string;
  quirksSummary?: string;
  isStale?: boolean;
  onOpenHotSeat?: () => void;
  onTuneVoice?: () => void;
}

export function CharacterCoreNode({ data, selected }: NodeProps & { data: CharacterCoreNodeData }) {
  const nodeId = useNodeId();
  const { setEdges, getNode } = useReactFlow();
  const connections = useNodeConnections();
  const connCount = connections ? connections.length : 0;

  // Check if an ActorNode is wired into actor_ref
  const actorConn = connections.find(
    (c) => c.targetHandle === "actor_ref" || (c.target === nodeId && c.targetHandle === "actor_ref")
  );
  const wiredActorNode = actorConn ? getNode(actorConn.source) : null;
  const wiredActorData = wiredActorNode?.data as { actorName?: string; roleReference?: string } | undefined;
  const hasWiredActor = Boolean(wiredActorData?.actorName);
  const effectiveActorComp = hasWiredActor
    ? `${wiredActorData!.actorName}${wiredActorData!.roleReference ? ` (${wiredActorData!.roleReference})` : ""}`
    : (data.actorComp || "Unbound");

  return (
    <div
      className={cn(
        "sprocket-edge film-grain relative w-84 rounded-xl border bg-card/95 p-3.5 text-sm shadow-xl backdrop-blur transition-all",
        data.isStale
          ? "border-warning/60 ring-2 ring-warning/30"
          : selected
          ? "border-accent ring-2 ring-accent/30"
          : "border-border/80"
      )}
    >
      {/* Target Input Ports on Left */}
      <div className="absolute -left-3 top-5 flex flex-col gap-4 z-20">
        <div className="relative group">
          <Handle
            type="target"
            position={Position.Left}
            id="general_in"
            className={cn(handleBaseClass, "!bg-purple-500")}
          />
          <span className="absolute left-4 top-0 hidden rounded bg-popover px-1.5 py-0.5 text-[9px] font-mono text-purple-400 group-hover:block whitespace-nowrap shadow">
            link_in (character / note / clip)
          </span>
        </div>
        <div className="relative group">
          <Handle
            type="target"
            position={Position.Left}
            id="actor_ref"
            className={cn(handleBaseClass, "!bg-emerald-500")}
          />
          <span className="absolute left-4 top-0 hidden rounded bg-popover px-1.5 py-0.5 text-[9px] font-mono text-emerald-400 group-hover:block whitespace-nowrap shadow">
            actor_ref (dream comp / likeness)
          </span>
        </div>
        <div className="relative group">
          <Handle
            type="target"
            position={Position.Left}
            id="personality"
            className={cn(handleBaseClass, "!bg-cyan-500")}
          />
          <span className="absolute left-4 top-0 hidden rounded bg-popover px-1.5 py-0.5 text-[9px] font-mono text-cyan-400 group-hover:block whitespace-nowrap shadow">
            personality
          </span>
        </div>
        <div className="relative group">
          <Handle
            type="target"
            position={Position.Left}
            id="quirks"
            className={cn(handleBaseClass, "!bg-rose-500")}
          />
          <span className="absolute left-4 top-0 hidden rounded bg-popover px-1.5 py-0.5 text-[9px] font-mono text-rose-400 group-hover:block whitespace-nowrap shadow">
            quirks
          </span>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-2 border-b border-border/40 pb-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/20 border border-accent/40 font-heading text-sm font-bold text-accent">
            {data.name?.slice(0, 2).toUpperCase() || "CH"}
          </div>
          <div>
            <SlateLabel>Character Core</SlateLabel>
            <h3 className="font-heading text-sm font-bold text-foreground leading-tight">{data.name}</h3>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 nodrag">
          {connCount > 0 && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                if (nodeId) {
                  setEdges((eds) =>
                    eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId)
                  );
                }
              }}
              className="flex items-center gap-1 rounded bg-secondary/90 hover:bg-rose-500/20 hover:text-rose-400 hover:border-rose-500/40 border border-border/80 px-1.5 py-0.5 text-[9px] font-mono text-muted-foreground transition-all cursor-pointer nodrag"
              title={`Unlink all ${connCount} wires attached to ${data.name}`}
            >
              <Unlink className="h-2.5 w-2.5" />
              <span>{connCount}</span>
            </button>
          )}
          <Badge
            className={cn(
              "text-[9px]",
              data.isStale
                ? "border-warning/40 bg-warning/15 text-warning animate-pulse"
                : "border-success/40 bg-success/15 text-success"
            )}
          >
            {data.isStale ? "Pending Sync" : "Bound"}
          </Badge>
        </div>
      </div>

      {/* Body Details */}
      <div className="mt-2.5 flex flex-col gap-2 text-xs nodrag cursor-default">
        <p className="text-[11px] text-muted-foreground leading-snug">{data.archetype}</p>

        <div className="rounded border border-border/50 bg-background/50 p-2 text-[11px]">
          <span className="font-mono text-[9px] uppercase text-muted-foreground block">Active Objective:</span>
          <span className="text-foreground/90 font-medium">{data.objective || "Survive and secure assets"}</span>
        </div>

        {/* Connected modules indicators */}
        <div className="grid grid-cols-2 gap-1 text-[10px] font-mono">
          <div
            className={cn(
              "rounded px-1.5 py-0.5 border truncate flex items-center gap-1",
              hasWiredActor
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-semibold"
                : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
            )}
            title={effectiveActorComp}
          >
            <User className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">{effectiveActorComp}</span>
            {hasWiredActor && <Check className="h-2.5 w-2.5 shrink-0 text-emerald-400" />}
          </div>
          <div className="rounded bg-cyan-500/10 px-1.5 py-0.5 text-cyan-400 border border-cyan-500/20 truncate">
            Dials: {data.dialsSummary || "Default"}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-1 flex items-center gap-1.5 nodrag">
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              data.onOpenHotSeat?.();
            }}
            className="flex-1 flex items-center justify-center gap-1 rounded bg-accent/15 hover:bg-accent/25 text-accent py-1 text-[10px] font-medium transition-colors cursor-pointer nodrag"
          >
            <MessageSquare className="h-3 w-3" />
            Hot Seat Chat
          </button>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              data.onTuneVoice?.();
            }}
            className="flex items-center justify-center gap-1 rounded bg-secondary hover:bg-secondary/80 text-foreground px-2 py-1 text-[10px] transition-colors cursor-pointer nodrag"
            title="Tune Dialogue Cadence"
          >
            <Sliders className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Output Port on Right */}
      <div className="absolute -right-3 top-1/2 -translate-y-1/2 z-20 group">
        <Handle
          type="source"
          position={Position.Right}
          id="character_out"
          className={cn(handleBaseClass, "!bg-accent")}
        />
        <span className="absolute right-4 top-0 hidden rounded bg-popover px-1.5 py-0.5 text-[9px] font-mono text-accent group-hover:block whitespace-nowrap shadow">
          character_out
        </span>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// 7. Dream Casting Chemistry Bench Node
// -------------------------------------------------------------
export interface ChemistryNodeData extends Record<string, unknown> {
  scenario: string;
  lastGeneratedScene?: string;
  onRunChemistry?: () => void;
}

export function ChemistryNode({ data, selected }: NodeProps & { data: ChemistryNodeData }) {
  return (
    <BlueprintNodeShell
      kind="Casting Bench"
      title="Chemistry Sandbox"
      icon={Users2}
      colorScheme="rose"
      selected={selected}
    >
      <div className="relative flex flex-col gap-2 text-xs">
        {/* Target Ports for Char A and Char B and Universal */}
        <div className="absolute -left-6 top-2 flex flex-col gap-3">
          <Handle
            type="target"
            position={Position.Left}
            id="flow_in"
            className={cn(handleBaseClass, "!bg-rose-400")}
          />
          <Handle
            type="target"
            position={Position.Left}
            id="char_a"
            className={cn(handleBaseClass, "!bg-blue-400")}
          />
          <Handle
            type="target"
            position={Position.Left}
            id="char_b"
            className={cn(handleBaseClass, "!bg-purple-400")}
          />
        </div>

        <div className="rounded border border-border/50 bg-background/60 p-2">
          <div className="text-[10px] font-mono uppercase text-muted-foreground">Friction Scenario:</div>
          <p className="mt-0.5 text-[11px] italic text-foreground">{data.scenario}</p>
        </div>

        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            data.onRunChemistry?.();
          }}
          className="flex items-center justify-center gap-1.5 w-full rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 py-1.5 text-xs font-semibold transition-colors border border-rose-500/30 cursor-pointer nodrag"
        >
          <Flame className="h-3.5 w-3.5" />
          Test 1-Page Dynamic Friction
        </button>

        {/* Output Port */}
        <div className="relative mt-1 flex items-center justify-end pt-1 border-t border-border/30">
          <span className="text-[10px] font-mono text-rose-400 mr-2">friction_scene →</span>
          <Handle
            type="source"
            position={Position.Right}
            id="scene_out"
            className={cn(handleBaseClass, "!bg-rose-500 -right-5")}
          />
        </div>
      </div>
    </BlueprintNodeShell>
  );
}

// -------------------------------------------------------------
// 8. Scene Node
// -------------------------------------------------------------
export interface SceneNodeData extends Record<string, unknown> {
  title: string;
  slugline: string;
  stakes: string;
  state: NodeState;
  characterCount?: number;
  hasStyleRef?: boolean;
  hasVideoTake?: boolean;
  videoTakeUrl?: string;
  onGenerateDraft?: () => void;
  onViewScript?: () => void;
}

export function SceneNode({ id, data, selected }: NodeProps & { data: SceneNodeData }) {
  const nodeId = id || useNodeId();
  const { setNodes, getNode } = useReactFlow();
  const connections = useNodeConnections();
  const [isEditing, setIsEditing] = React.useState(false);
  const [editSlugline, setEditSlugline] = React.useState(data.slugline || "");
  const [editStakes, setEditStakes] = React.useState(data.stakes || "");

  // Detect connected floorplan or style clip
  const hasFloorPlan = connections.some((c) => {
    const otherId = c.source === nodeId ? c.target : c.source;
    const otherNode = getNode(otherId);
    return otherNode?.type === "floorplan";
  });

  const handleSaveEdit = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsEditing(false);
    if (nodeId) {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                data: {
                  ...n.data,
                  slugline: editSlugline.trim() || data.slugline,
                  stakes: editStakes.trim() || data.stakes,
                },
              }
            : n
        )
      );
    }
  };

  return (
    <BlueprintNodeShell
      kind="Scene Master"
      title={data.title || "Scene Master"}
      icon={Clapperboard}
      colorScheme="default"
      state={data.state}
      selected={selected}
    >
      <div className="relative flex flex-col gap-2 text-xs">
        {/* Input Ports for Characters, Style Ref, Floor Plan, Plot Seed, Scene Chaining */}
        <div className="absolute -left-6 top-2 flex flex-col gap-3">
          <Handle
            type="target"
            position={Position.Left}
            id="flow_in"
            className={cn(handleBaseClass, "!bg-cyan-400")}
          />
          <Handle
            type="target"
            position={Position.Left}
            id="character_in"
            className={cn(handleBaseClass, "!bg-accent")}
          />
          <Handle
            type="target"
            position={Position.Left}
            id="style_ref"
            className={cn(handleBaseClass, "!bg-purple-500")}
          />
          <Handle
            type="target"
            position={Position.Left}
            id="plot_seed"
            className={cn(handleBaseClass, "!bg-amber-500")}
          />
        </div>

        {/* Inline Editing Mode vs Display Mode */}
        {isEditing ? (
          <div className="flex flex-col gap-2 rounded bg-background/80 p-2 border border-accent/40 nodrag">
            <div>
              <label className="text-[9px] font-mono uppercase text-accent font-semibold block mb-0.5">
                Scene Slugline:
              </label>
              <input
                type="text"
                value={editSlugline}
                onChange={(e) => setEditSlugline(e.target.value)}
                placeholder="INT. SCENE LOCATION - TIME"
                className="w-full bg-secondary/80 border border-border/60 rounded px-2 py-1 text-[11px] font-mono font-bold text-accent uppercase focus:outline-none focus:border-accent"
                autoFocus
              />
            </div>
            <div>
              <label className="text-[9px] font-mono uppercase text-muted-foreground font-semibold block mb-0.5">
                Dramatic Conflict / Stakes:
              </label>
              <textarea
                value={editStakes}
                onChange={(e) => setEditStakes(e.target.value)}
                rows={2}
                placeholder="What is the core dramatic conflict driving this scene?"
                className="w-full bg-secondary/80 border border-border/60 rounded px-2 py-1 text-[11px] text-foreground focus:outline-none focus:border-accent resize-none"
              />
            </div>
            <div className="flex items-center justify-end gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-2 py-0.5 text-[10px] rounded bg-secondary hover:bg-secondary/80 text-muted-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="px-2.5 py-0.5 text-[10px] font-medium rounded bg-accent text-accent-foreground hover:bg-accent/90"
              >
                Save Plan
              </button>
            </div>
          </div>
        ) : (
          <div className="group relative cursor-pointer" onClick={() => setIsEditing(true)}>
            <div className="flex items-center justify-between">
              <div className="font-mono text-[11px] font-bold text-accent tracking-wide uppercase">
                {data.slugline || "INT. SCENE LOCATION - TIME"}
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditing(true);
                }}
                className="opacity-40 group-hover:opacity-100 p-0.5 rounded hover:bg-accent/20 text-accent transition-opacity nodrag"
                title="Edit Slugline & Stakes directly on canvas"
              >
                <Pencil className="h-2.5 w-2.5" />
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2 mt-0.5">
              {data.stakes || "Dramatic conflict and objectives"}
            </p>
          </div>
        )}

        <div className="flex items-center justify-between text-[10px] text-muted-foreground border-t border-border/40 pt-1.5">
          <span>{data.characterCount ?? 2} Cast Members Wired</span>
          <div className="flex items-center gap-1.5">
            {data.hasVideoTake && <span className="text-purple-400 font-mono font-semibold">Video Take ✓</span>}
            {hasFloorPlan && <span className="text-blue-400 font-mono">Floor Plan ✓</span>}
            {data.hasStyleRef && <span className="text-purple-400 font-mono">Style Sync ✓</span>}
          </div>
        </div>

        <div className="flex items-center gap-1.5 pt-1 nodrag">
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              data.onGenerateDraft?.();
            }}
            className="flex-1 rounded bg-accent text-accent-foreground hover:bg-accent/90 py-1 text-[11px] font-semibold transition-colors text-center cursor-pointer nodrag"
          >
            Generate Screenplay Draft
          </button>
        </div>

        {/* Output Port */}
        <div className="relative mt-1 flex items-center justify-end pt-1 border-t border-border/30">
          <span className="text-[10px] font-mono text-accent mr-2">scene_out →</span>
          <Handle
            type="source"
            position={Position.Right}
            id="scene_out"
            className={cn(handleBaseClass, "!bg-accent -right-5")}
          />
        </div>
      </div>
    </BlueprintNodeShell>
  );
}

// -------------------------------------------------------------
// 9. Screenplay Script Node
// -------------------------------------------------------------
export interface ScriptNodeData extends Record<string, unknown> {
  title: string;
  previewText: string;
  wordCount: number;
  isLocked?: boolean;
  onViewScript?: () => void;
  onToggleLock?: () => void;
}

export function ScriptNode({ data, selected }: NodeProps & { data: ScriptNodeData }) {
  return (
    <BlueprintNodeShell
      kind="Screenplay Draft"
      title={data.title || "Hollywood Script"}
      icon={FileText}
      colorScheme="default"
      selected={selected}
      headerRight={
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            data.onToggleLock?.();
          }}
          className="text-muted-foreground hover:text-foreground cursor-pointer nodrag"
          title={data.isLocked ? "Lines Locked" : "Lines Unlocked"}
        >
          {data.isLocked ? <Lock className="h-3.5 w-3.5 text-accent" /> : <Unlock className="h-3.5 w-3.5" />}
        </button>
      }
    >
      <div className="relative flex flex-col gap-2 text-xs">
        <Handle
          type="target"
          position={Position.Left}
          id="script_in"
          className={cn(handleBaseClass, "!bg-accent -left-5")}
        />

        <div className="rounded border border-border/60 bg-background/80 p-2 font-mono text-[10px] leading-relaxed text-foreground/90 max-h-24 overflow-hidden line-clamp-4">
          {data.previewText}
        </div>

        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>{data.wordCount || 420} words</span>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              data.onViewScript?.();
            }}
            className="text-accent hover:underline font-medium cursor-pointer nodrag"
          >
            Open Screenplay Reader →
          </button>
        </div>

        {/* Output Port */}
        <div className="relative mt-1 flex items-center justify-end pt-1 border-t border-border/30">
          <span className="text-[10px] font-mono text-accent mr-2">script_out →</span>
          <Handle
            type="source"
            position={Position.Right}
            id="script_out"
            className={cn(handleBaseClass, "!bg-accent -right-5")}
          />
        </div>
      </div>
    </BlueprintNodeShell>
  );
}

// -------------------------------------------------------------
// 10. Storyboard Node (Imagen 3)
// -------------------------------------------------------------
export interface StoryboardNodeData extends Record<string, unknown> {
  prompt: string;
  shotType?: string;
  lighting?: string;
  imageUrl?: string;
}

export function StoryboardNode({ id, data, selected }: NodeProps & { data: StoryboardNodeData }) {
  const { updateNodeData } = useReactFlow();
  const [currentImage, setCurrentImage] = React.useState<string | undefined>(
    (data.imageUrl as string) || undefined
  );
  const [isRendering, setIsRendering] = React.useState(false);

  const handleRender = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isRendering) return;
    setIsRendering(true);

    try {
      const res = await fetch("/api/media/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: data.prompt || "cinematic anamorphic film frame, dramatic lighting",
          aspect_ratio: "16:9",
        }),
      });

      if (res.ok) {
        const result = await res.json();
        if (result.image_url) {
          setCurrentImage(result.image_url);
          updateNodeData(id, { imageUrl: result.image_url });
          notifyIfFallback(result, "Storyboard Render");
        } else {
          toast.add({ title: "Storyboard render failed", description: "No image returned. Try again.", type: "error" });
        }
      } else {
        const detail = await res.text().catch(() => "");
        toast.add({
          title: "Storyboard render failed",
          description: detail || `Request failed (${res.status}). Try again.`,
          type: "error",
        });
      }
    } catch (err) {
      console.error("Storyboard Imagen render error:", err);
      toast.add({
        title: "Storyboard render failed",
        description: err instanceof Error ? err.message : "Could not reach the image backend.",
        type: "error",
      });
    } finally {
      setIsRendering(false);
    }
  };

  return (
    <BlueprintNodeShell
      kind="Visual Concept"
      title="Imagen 3 Storyboard"
      icon={ImageIcon}
      colorScheme="purple"
      selected={selected}
    >
      <div className="relative flex flex-col gap-2 text-xs">
        <Handle
          type="target"
          position={Position.Left}
          id="script_in"
          className={cn(handleBaseClass, "!bg-purple-500 -left-5")}
        />

        {currentImage ? (
          <div className="group relative w-full overflow-hidden rounded-lg border border-purple-500/40 bg-black shadow-lg">
            <img
              src={currentImage}
              alt="Imagen 3 Storyboard Frame"
              className="w-full h-32 object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-2 pointer-events-none">
              <span className="text-[9px] font-mono uppercase tracking-widest text-accent font-semibold">
                {data.shotType || "2.39:1 Anamorphic Scope"}
              </span>
              <p className="text-[10px] text-white/90 line-clamp-1 italic">
                &ldquo;{data.prompt}&rdquo;
              </p>
            </div>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={handleRender}
              disabled={isRendering}
              className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-black/70 hover:bg-black text-[10px] text-accent px-2 py-0.5 rounded border border-accent/40 font-mono flex items-center gap-1 cursor-pointer nodrag"
            >
              <Sparkles className="h-2.5 w-2.5" />
              <span>{isRendering ? "Rendering..." : "Re-roll"}</span>
            </button>
          </div>
        ) : (
          <div className="relative w-full overflow-hidden rounded-lg border border-border/70 bg-gradient-to-br from-secondary/80 via-card to-background p-3 text-center flex flex-col items-center gap-2">
            <span className="text-[9px] font-mono uppercase tracking-widest text-accent font-semibold">
              {data.shotType || "2.39:1 Anamorphic Scope"}
            </span>
            <p className="text-[11px] leading-snug text-foreground/90 line-clamp-2 italic">
              &ldquo;{data.prompt}&rdquo;
            </p>

            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={handleRender}
              disabled={isRendering}
              className="mt-1 flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/50 text-purple-300 text-[11px] font-medium transition-all cursor-pointer shadow-sm disabled:opacity-50 nodrag"
            >
              <Sparkles className="h-3 w-3 text-purple-400" />
              <span>{isRendering ? "Painting Frame with Imagen 3..." : "Render 16:9 Frame (Imagen 3)"}</span>
            </button>
          </div>
        )}

        {data.lighting && (
          <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5">
            <span>Atmosphere: {data.lighting}</span>
            <span className="font-mono text-purple-400 font-medium">Google Imagen 3</span>
          </div>
        )}

        {/* Output Port */}
        <div className="relative mt-1 flex items-center justify-end pt-1 border-t border-border/30">
          <span className="text-[10px] font-mono text-purple-400 mr-2">concept_out →</span>
          <Handle
            type="source"
            position={Position.Right}
            id="storyboard_out"
            className={cn(handleBaseClass, "!bg-purple-500 -right-5")}
          />
        </div>
      </div>
    </BlueprintNodeShell>
  );
}

// -------------------------------------------------------------
// 11. Director Floor Plan Node
// -------------------------------------------------------------
export interface FloorPlanNodeData extends Record<string, unknown> {
  sceneTitle: string;
  cameraCount?: number;
  blockingPreset?: "confrontation" | "ots" | "parallel" | "depth";
  activeCam?: "35mm" | "50mm" | "85mm";
  blockingPrompt?: string;
  onOpenDeck?: () => void;
}

const BLOCKING_PRESETS = {
  confrontation: {
    label: "Standoff",
    desc: "Face-to-face intense confrontation across room",
    posA: { x: 30, y: 20 },
    posB: { x: 70, y: 20 },
  },
  ots: {
    label: "OTS Depth",
    desc: "Over-the-shoulder dirty foreground into midground",
    posA: { x: 26, y: 26 },
    posB: { x: 68, y: 15 },
  },
  parallel: {
    label: "Two-Shot",
    desc: "Side-by-side alliance staging facing unified direction",
    posA: { x: 38, y: 20 },
    posB: { x: 62, y: 20 },
  },
  depth: {
    label: "Layered",
    desc: "Commanding foreground subject with background observer",
    posA: { x: 50, y: 27 },
    posB: { x: 50, y: 12 },
  },
} as const;

export function FloorPlanNode({ id, data, selected }: NodeProps & { data: FloorPlanNodeData }) {
  const nodeId = id || useNodeId();
  const { setNodes, getNodes } = useReactFlow();
  const connections = useNodeConnections();

  const [activeCam, setActiveCam] = React.useState<"35mm" | "50mm" | "85mm">(
    data.activeCam || "35mm"
  );
  const [blockingPreset, setBlockingPreset] = React.useState<"confrontation" | "ots" | "parallel" | "depth">(
    data.blockingPreset || "confrontation"
  );

  // Discover connected character nodes
  const connectedChars = React.useMemo(() => {
    const nodes = getNodes();
    // 1. Check direct wires into character_in or flow_in
    const directIds = connections
      .map((c) => (c.source === nodeId ? c.target : c.source))
      .filter(Boolean);
    const directChars = nodes.filter(
      (n) => directIds.includes(n.id) && (n.type === "characterCore" || n.type === "actor")
    );
    if (directChars.length > 0) return directChars;

    // 2. Fall back to character nodes on canvas
    return nodes.filter((n) => n.type === "characterCore").slice(0, 2);
  }, [connections, nodeId, getNodes]);

  const charAName = (connectedChars[0]?.data?.name as string) || "Subject A";
  const charBName = (connectedChars[1]?.data?.name as string) || "Subject B";
  const charAInit = (connectedChars[0]?.data?.name as string)?.slice(0, 2).toUpperCase() || "A1";
  const charBInit = (connectedChars[1]?.data?.name as string)?.slice(0, 2).toUpperCase() || "A2";
  const isDirectlyWired = connections.some((c) => c.targetHandle === "character_in" || c.sourceHandle === "character_in");

  // Compute and persist blocking prompt
  const updateBlocking = React.useCallback(
    (newCam: "35mm" | "50mm" | "85mm", newPreset: "confrontation" | "ots" | "parallel" | "depth") => {
      setActiveCam(newCam);
      setBlockingPreset(newPreset);

      const lensNote =
        newCam === "35mm"
          ? "35mm anamorphic wide master establishing spatial tension"
          : newCam === "50mm"
          ? "50mm cinematic over-the-shoulder medium shot"
          : "85mm portrait telephoto compression with shallow depth of field";

      const presetInfo = BLOCKING_PRESETS[newPreset];
      const blockingDesc = `${lensNote}: ${charAName} and ${charBName} staged in ${presetInfo.desc}. Low-angle camera perspective, cinematic mise-en-scène.`;

      if (nodeId) {
        setNodes((nds) =>
          nds.map((n) =>
            n.id === nodeId
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    activeCam: newCam,
                    blockingPreset: newPreset,
                    blockingPrompt: blockingDesc,
                  },
                }
              : n
          )
        );
      }
    },
    [charAName, charBName, nodeId, setNodes]
  );

  const presetLayout = BLOCKING_PRESETS[blockingPreset];

  return (
    <BlueprintNodeShell
      kind="Camera Blocking"
      title="2D Floor Plan"
      icon={Compass}
      colorScheme="blue"
      selected={selected}
    >
      <div className="relative flex flex-col gap-2 text-xs">
        {/* Input Handles: character_in, script_in, flow_in */}
        <div className="absolute -left-6 top-1 flex flex-col gap-3">
          <Handle
            type="target"
            position={Position.Left}
            id="character_in"
            className={cn(handleBaseClass, "!bg-purple-500")}
          />
          <Handle
            type="target"
            position={Position.Left}
            id="script_in"
            className={cn(handleBaseClass, "!bg-blue-500")}
          />
          <Handle
            type="target"
            position={Position.Left}
            id="flow_in"
            className={cn(handleBaseClass, "!bg-cyan-500")}
          />
        </div>

        {/* Header Metadata */}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span className="truncate max-w-[140px]">{data.sceneTitle || "Production Set Master"}</span>
          <span className="text-blue-400 font-semibold font-mono">
            {isDirectlyWired ? "Cast Wired ✓" : "Default Setups"}
          </span>
        </div>

        {/* Blocking Preset Selector */}
        <div className="flex flex-col gap-1 nodrag">
          <span className="text-[9px] font-mono text-muted-foreground uppercase font-semibold">
            Director Staging:
          </span>
          <div className="grid grid-cols-4 gap-1">
            {(Object.keys(BLOCKING_PRESETS) as Array<keyof typeof BLOCKING_PRESETS>).map((preset) => (
              <button
                key={preset}
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  updateBlocking(activeCam, preset);
                }}
                className={cn(
                  "py-0.5 text-[9px] font-mono rounded border transition-all cursor-pointer text-center",
                  blockingPreset === preset
                    ? "bg-blue-500/30 text-blue-200 border-blue-400/60 font-bold shadow-sm"
                    : "bg-secondary/40 text-muted-foreground border-border/40 hover:bg-secondary/70 hover:text-foreground"
                )}
              >
                {BLOCKING_PRESETS[preset].label}
              </button>
            ))}
          </div>
        </div>

        {/* Camera Lens Selector */}
        <div className="grid grid-cols-3 gap-1 nodrag">
          {(["35mm", "50mm", "85mm"] as const).map((cam) => (
            <button
              key={cam}
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                updateBlocking(cam, blockingPreset);
              }}
              className={cn(
                "py-0.5 text-[9px] font-mono rounded border transition-all cursor-pointer nodrag",
                activeCam === cam
                  ? "bg-blue-500/30 text-blue-300 border-blue-400/50 shadow-sm font-semibold"
                  : "bg-secondary/40 text-muted-foreground border-border/40 hover:bg-secondary/70 hover:text-foreground"
              )}
            >
              {cam === "35mm" ? "35mm Wide" : cam === "50mm" ? "50mm OTS" : "85mm CU"}
            </button>
          ))}
        </div>

        {/* Dynamic 2D Floor Plan SVG Canvas */}
        <div className="w-full h-20 bg-black/50 rounded border border-blue-500/25 relative overflow-hidden flex items-center justify-center">
          <svg className="w-full h-full" viewBox="0 0 100 40">
            {/* Grid background */}
            <defs>
              <pattern id="node-grid" width="10" height="10" patternUnits="userSpaceOnUse">
                <circle cx="5" cy="5" r="0.4" fill="rgba(255,255,255,0.15)" />
              </pattern>
            </defs>
            <rect x="0" y="0" width="100" height="40" fill="url(#node-grid)" />
            <rect x="5" y="4" width="90" height="32" fill="none" stroke="rgba(56,189,248,0.2)" strokeWidth="0.8" strokeDasharray="2 2" />

            {/* Dynamic Camera Frustums based on active lens */}
            {activeCam === "35mm" && (
              <>
                <polygon points="12,36 60,6 20,6" fill="rgba(56,189,248,0.15)" stroke="#38bdf8" strokeWidth="0.8" strokeDasharray="1.5 1.5" />
                <circle cx="12" cy="36" r="2.2" fill="#38bdf8" />
                <text x="12" y="39" fontSize="3.5" fill="#38bdf8" textAnchor="middle" fontWeight="bold">CAM A</text>
              </>
            )}
            {activeCam === "50mm" && (
              <>
                <polygon points="24,34 76,14 60,26" fill="rgba(244,114,182,0.18)" stroke="#f472b6" strokeWidth="0.8" strokeDasharray="1.5 1.5" />
                <circle cx="24" cy="34" r="2.2" fill="#f472b6" />
                <text x="24" y="39" fontSize="3.5" fill="#f472b6" textAnchor="middle" fontWeight="bold">CAM B</text>
              </>
            )}
            {activeCam === "85mm" && (
              <>
                <polygon points="80,35 34,18 40,24" fill="rgba(250,204,21,0.18)" stroke="#facc15" strokeWidth="0.8" strokeDasharray="1.5 1.5" />
                <circle cx="80" cy="35" r="2.2" fill="#facc15" />
                <text x="80" y="39" fontSize="3.5" fill="#facc15" textAnchor="middle" fontWeight="bold">CAM C</text>
              </>
            )}

            {/* Dynamic Actor Positions from Preset */}
            <g>
              <circle cx={presetLayout.posA.x} cy={presetLayout.posA.y} r="3.6" fill="#38bdf8" stroke="#ffffff" strokeWidth="0.6" />
              <text x={presetLayout.posA.x} y={presetLayout.posA.y + 1.2} fontSize="3.2" fill="#0f172a" textAnchor="middle" fontWeight="bold">
                {charAInit}
              </text>
              <text x={presetLayout.posA.x} y={presetLayout.posA.y - 4.5} fontSize="3.5" fill="#38bdf8" textAnchor="middle">
                {charAName.slice(0, 8)}
              </text>
            </g>

            <g>
              <circle cx={presetLayout.posB.x} cy={presetLayout.posB.y} r="3.6" fill="#34d399" stroke="#ffffff" strokeWidth="0.6" />
              <text x={presetLayout.posB.x} y={presetLayout.posB.y + 1.2} fontSize="3.2" fill="#0f172a" textAnchor="middle" fontWeight="bold">
                {charBInit}
              </text>
              <text x={presetLayout.posB.x} y={presetLayout.posB.y - 4.5} fontSize="3.5" fill="#34d399" textAnchor="middle">
                {charBName.slice(0, 8)}
              </text>
            </g>
          </svg>
        </div>

        {/* Live Blocking Prompt Preview */}
        <div className="rounded bg-blue-500/10 border border-blue-500/20 px-2 py-1">
          <span className="text-[9px] font-mono text-blue-300 block truncate">
            {activeCam} · {BLOCKING_PRESETS[blockingPreset].label}: {charAName} &amp; {charBName}
          </span>
        </div>

        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            data.onOpenDeck?.();
          }}
          className="w-full mt-0.5 py-1 rounded bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 text-[10px] font-medium transition-colors text-center border border-blue-500/30 cursor-pointer nodrag"
        >
          Open Director Blocking Deck →
        </button>

        {/* Universal In/Out Ports */}
        <div className="relative mt-1 flex items-center justify-between pt-1 border-t border-border/30">
          <div className="flex items-center">
            <span className="text-[9px] font-mono text-blue-400/80 ml-1">← cast/script</span>
          </div>
          <div className="flex items-center">
            <span className="text-[10px] font-mono text-blue-400 mr-2">floorplan_out →</span>
            <Handle
              type="source"
              position={Position.Right}
              id="floorplan_out"
              className={cn(handleBaseClass, "!bg-blue-500 -right-5")}
            />
          </div>
        </div>
      </div>
    </BlueprintNodeShell>
  );
}

// -------------------------------------------------------------
// 12. Tension Curve Node
// -------------------------------------------------------------
export interface TensionCurveNodeData extends Record<string, unknown> {
  peakTension?: number;
  arcPreset?: "slow_burn" | "medias_res" | "double_peak" | "ticking_clock";
  pacingPrompt?: string;
  hasWarning?: boolean;
  onOpenDeck?: () => void;
}

const ARC_PRESETS = {
  slow_burn: {
    label: "Slow-Burn",
    path: "M 0,26 Q 35,24 60,16 T 82,4 T 100,16",
    peakX: 82,
    peakY: 4,
    desc: "Gradual escalation building to Act 3 climax followed by swift resolution",
  },
  medias_res: {
    label: "In Medias Res",
    path: "M 0,6 Q 20,24 50,18 T 75,10 T 100,22",
    peakX: 12,
    peakY: 6,
    desc: "Explosive opening confrontation, mid-scene exposition valley, secondary climax",
  },
  double_peak: {
    label: "Double Peak",
    path: "M 0,22 Q 25,6 45,20 T 75,5 T 100,18",
    peakX: 75,
    peakY: 5,
    desc: "Initial skirmish, false sense of safety, followed by catastrophic standoff",
  },
  ticking_clock: {
    label: "Ticking Clock",
    path: "M 0,25 Q 40,23 65,14 T 92,3 T 100,4",
    peakX: 92,
    peakY: 3,
    desc: "Compounding psychological urgency with escalating stakes and zero relief",
  },
} as const;

export function TensionCurveNode({ id, data, selected }: NodeProps & { data: TensionCurveNodeData }) {
  const nodeId = id || useNodeId();
  const { setNodes } = useReactFlow();

  const [arcPreset, setArcPreset] = React.useState<"slow_burn" | "medias_res" | "double_peak" | "ticking_clock">(
    data.arcPreset || "slow_burn"
  );
  const [peakVal, setPeakVal] = React.useState<number>(
    typeof data.peakTension === "number" ? data.peakTension : 88
  );

  const updateArc = React.useCallback(
    (newPreset: "slow_burn" | "medias_res" | "double_peak" | "ticking_clock", newPeak: number) => {
      setArcPreset(newPreset);
      setPeakVal(newPeak);

      const presetInfo = ARC_PRESETS[newPreset];
      const pacingDesc = `${presetInfo.label} Arc: ${presetInfo.desc}, peaking at ${newPeak}% dramatic intensity`;

      if (nodeId) {
        setNodes((nds) =>
          nds.map((n) =>
            n.id === nodeId
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    arcPreset: newPreset,
                    peakTension: newPeak,
                    pacingPrompt: pacingDesc,
                  },
                }
              : n
          )
        );
      }
    },
    [nodeId, setNodes]
  );

  const activeArc = ARC_PRESETS[arcPreset];

  return (
    <BlueprintNodeShell
      kind="Audience EKG"
      title="Pacing & Tension Curve"
      icon={Activity}
      colorScheme="rose"
      selected={selected}
    >
      <div className="relative flex flex-col gap-1.5 text-xs">
        {/* Handles */}
        <div className="absolute -left-6 top-2 flex flex-col gap-3">
          <Handle
            type="target"
            position={Position.Left}
            id="script_in"
            className={cn(handleBaseClass, "!bg-rose-500")}
          />
          <Handle
            type="target"
            position={Position.Left}
            id="flow_in"
            className={cn(handleBaseClass, "!bg-pink-500")}
          />
        </div>

        <div className="flex items-center justify-between text-[10px]">
          <span className="text-muted-foreground">Dramatic Arc &amp; Urgency</span>
          <span className="font-mono text-rose-400 font-bold">
            Peak: {peakVal}%
          </span>
        </div>

        {/* Arc Preset Selector */}
        <div className="grid grid-cols-2 gap-1 nodrag">
          {(Object.keys(ARC_PRESETS) as Array<keyof typeof ARC_PRESETS>).map((presetKey) => (
            <button
              key={presetKey}
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                updateArc(presetKey, peakVal);
              }}
              className={cn(
                "py-0.5 px-1 text-[9px] font-mono rounded border transition-all cursor-pointer truncate",
                arcPreset === presetKey
                  ? "bg-rose-500/30 text-rose-200 border-rose-400/60 font-semibold shadow-sm"
                  : "bg-secondary/40 text-muted-foreground border-border/40 hover:bg-secondary/70 hover:text-foreground"
              )}
            >
              {ARC_PRESETS[presetKey].label}
            </button>
          ))}
        </div>

        {/* Interactive Dynamic SVG Bezier Curve */}
        <div className="w-full h-14 bg-secondary/30 rounded border border-border/50 relative overflow-hidden flex items-center justify-center p-1">
          <svg className="w-full h-full" viewBox="0 0 100 30" preserveAspectRatio="none">
            {/* Grid lines */}
            <line x1="0" y1="15" x2="100" y2="15" stroke="rgba(255,255,255,0.06)" strokeDasharray="2 2" strokeWidth="0.5" />
            <line x1="0" y1="25" x2="100" y2="25" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />

            {/* Dynamic Curve Path */}
            <path
              d={activeArc.path}
              fill="none"
              stroke="#f43f5e"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            {/* Climax Peak Indicator */}
            <circle cx={activeArc.peakX} cy={activeArc.peakY} r="3" fill="#f43f5e" />
            <circle cx={activeArc.peakX} cy={activeArc.peakY} r="5" fill="none" stroke="#f43f5e" strokeWidth="0.8" opacity="0.6" />
          </svg>
        </div>

        {/* Interactive Peak Tension Slider */}
        <div className="flex items-center gap-2 nodrag pt-0.5">
          <span className="text-[9px] font-mono text-muted-foreground shrink-0">Peak:</span>
          <input
            type="range"
            min={45}
            max={99}
            value={peakVal}
            onChange={(e) => updateArc(arcPreset, Number(e.target.value))}
            className="w-full accent-rose-500 h-1 bg-secondary rounded cursor-pointer"
          />
          <span className="text-[10px] font-mono font-bold text-rose-400 shrink-0 w-8 text-right">
            {peakVal}%
          </span>
        </div>

        {data.hasWarning && (
          <div className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
            <AlertTriangle className="h-3 w-3 shrink-0" />
            <span>Tension plateau detected in Act 2</span>
          </div>
        )}

        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            data.onOpenDeck?.();
          }}
          className="w-full mt-0.5 py-1 rounded bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-[10px] font-medium transition-colors text-center border border-rose-500/30 cursor-pointer nodrag"
        >
          View Full 3-Act Curve →
        </button>

        {/* Output Port */}
        <div className="relative mt-1 flex items-center justify-end pt-1 border-t border-border/30">
          <span className="text-[10px] font-mono text-rose-400 mr-2">tension_out →</span>
          <Handle
            type="source"
            position={Position.Right}
            id="tension_out"
            className={cn(handleBaseClass, "!bg-rose-500 -right-5")}
          />
        </div>
      </div>
    </BlueprintNodeShell>
  );
}

// -------------------------------------------------------------
// 13. Audio Table Read Node
// -------------------------------------------------------------
export interface TableReadNodeData extends Record<string, unknown> {
  voiceCount: number;
  duration?: string;
  onOpenPlayer?: () => void;
}

export function TableReadNode({ id, data, selected }: NodeProps & { data: TableReadNodeData }) {
  const nodeId = id || useNodeId();
  const { getNodes } = useReactFlow();
  const connections = useNodeConnections();

  // Find characters in the graph to show voice assignments
  const characterNodes = React.useMemo(() => {
    const all = getNodes();
    return all.filter((n) => n.type === "characterCore");
  }, [getNodes]);

  const castVoiceList = characterNodes.slice(0, 3).map((cn) => {
    const name = (cn.data?.name as string) || "Cast";
    const voice = (cn.data?.ttsVoice as string) || "Default Voice";
    return { name, voice };
  });

  return (
    <BlueprintNodeShell
      kind="Speech Studio"
      title="Gemini TTS Table Read"
      icon={Volume2}
      colorScheme="cyan"
      selected={selected}
    >
      <div className="relative flex flex-col gap-2 text-xs">
        <div className="absolute -left-6 top-2 flex flex-col gap-3">
          <Handle
            type="target"
            position={Position.Left}
            id="script_in"
            className={cn(handleBaseClass, "!bg-cyan-500")}
          />
          <Handle
            type="target"
            position={Position.Left}
            id="flow_in"
            className={cn(handleBaseClass, "!bg-blue-500")}
          />
        </div>

        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>Cast Voice Rehearsal</span>
          <span className="font-mono text-cyan-400 font-semibold">
            {characterNodes.length || data.voiceCount || 2} Voices Wired
          </span>
        </div>

        {/* Cast Voice Readiness Cards */}
        {castVoiceList.length > 0 ? (
          <div className="flex flex-col gap-1 nodrag">
            {castVoiceList.map((c, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded bg-secondary/40 border border-border/40 px-2 py-1 text-[10px]"
              >
                <span className="font-medium text-foreground">{c.name}</span>
                <span className="font-mono text-cyan-300 text-[9px] bg-cyan-500/15 px-1.5 py-0.5 rounded border border-cyan-500/25">
                  {c.voice}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center gap-1 h-7 rounded bg-background/60 border border-border/40 px-2">
            {[40, 70, 30, 90, 60, 80, 45, 95, 65, 35, 75, 50].map((h, i) => (
              <div
                key={i}
                className="w-1.5 rounded-full bg-cyan-400/70 animate-pulse"
                style={{ height: `${h}%`, animationDelay: `${i * 0.08}s` }}
              />
            ))}
          </div>
        )}

        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            data.onOpenPlayer?.();
          }}
          className="flex items-center justify-center gap-1.5 w-full rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 py-1 text-[11px] font-semibold transition-colors border border-cyan-500/30 cursor-pointer nodrag"
        >
          <Play className="h-3 w-3 fill-current" />
          Play Multi-Speaker Table Read
        </button>

        {/* Output Port */}
        <div className="relative mt-1 flex items-center justify-end pt-1 border-t border-border/30">
          <span className="text-[10px] font-mono text-cyan-400 mr-2">audio_out →</span>
          <Handle
            type="source"
            position={Position.Right}
            id="audio_out"
            className={cn(handleBaseClass, "!bg-cyan-500 -right-5")}
          />
        </div>
      </div>
    </BlueprintNodeShell>
  );
}

// -------------------------------------------------------------
// 14. Global Territory Viability Node (ClickHouse)
// -------------------------------------------------------------
export interface MarketNodeData extends Record<string, unknown> {
  globalScore?: number;
  topTerritory?: string;
  onOpenHeatmap?: () => void;
}

export function MarketNode({ data, selected }: NodeProps & { data: MarketNodeData }) {
  return (
    <BlueprintNodeShell
      kind="Distribution Intel"
      title="ClickHouse Territory Map"
      icon={Globe2}
      colorScheme="emerald"
      selected={selected}
    >
      <div className="relative flex flex-col gap-1.5 text-xs">
        <Handle
          type="target"
          position={Position.Left}
          id="script_in"
          className={cn(handleBaseClass, "!bg-emerald-500 -left-5")}
        />

        <div className="flex items-center justify-between text-[10px]">
          <span className="text-muted-foreground">Historical Box Office Comps</span>
          <span className="font-mono text-emerald-400 font-bold">
            {typeof data.globalScore === "number" ? `Global: ${data.globalScore}%` : "Not yet analyzed"}
          </span>
        </div>

        <div className="rounded border border-emerald-500/20 bg-emerald-500/10 p-2 text-[11px]">
          <div className="text-[9px] font-mono uppercase text-emerald-400">Prime Market Fit:</div>
          <p className="mt-0.5 text-foreground font-medium">
            {data.topTerritory || "Open Territory Map to run a live prediction"}
          </p>
        </div>

        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            data.onOpenHeatmap?.();
          }}
          className="w-full mt-1 py-1 rounded bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-[10px] font-medium transition-colors text-center border border-emerald-500/30 cursor-pointer nodrag"
        >
          Inspect World Choropleth Map →
        </button>

        {/* Output Port */}
        <div className="relative mt-1 flex items-center justify-end pt-1 border-t border-border/30">
          <span className="text-[10px] font-mono text-emerald-400 mr-2">market_out →</span>
          <Handle
            type="source"
            position={Position.Right}
            id="market_out"
            className={cn(handleBaseClass, "!bg-emerald-500 -right-5")}
          />
        </div>
      </div>
    </BlueprintNodeShell>
  );
}

// -------------------------------------------------------------
// 15. Location Scout & Concept Visual Node
// -------------------------------------------------------------
export interface LocationCandidateSummary {
  candidate_id: string;
  name: string;
  region?: string;
  category?: string;
  day_rate?: number;
  permit_fee?: number;
  preview_image_url?: string;
  preview_image_prompt?: string;
  sound_rating?: string;
}

export interface LocationNodeData extends Record<string, unknown> {
  name: string;
  category?: string;
  region?: string;
  dayRate?: number;
  permitFee?: number;
  environmentType?: string;
  isLocked?: boolean;
  imageUrl?: string;
  prompt?: string;
  candidates?: LocationCandidateSummary[];
  selectedCandidateId?: string;
  onSelectCandidate?: (candidateId: string) => void;
  onToggleLock?: () => void;
  onOpenDossier?: (candidateId?: string) => void;
}

export function LocationNode({ id, data, selected }: NodeProps & { data: LocationNodeData }) {
  const { updateNodeData } = useReactFlow();
  const [candidates, setCandidates] = React.useState<LocationCandidateSummary[]>(
    data.candidates || [
      {
        candidate_id: "c1",
        name: data.name || "Industrial Vault Stage A",
        region: data.region || "Brooklyn, NY",
        category: data.category || "practical",
        day_rate: data.dayRate || 3200,
        permit_fee: data.permitFee || 450,
        preview_image_url: data.imageUrl,
        preview_image_prompt: data.prompt,
      },
    ]
  );

  const [activeCandId, setActiveCandId] = React.useState<string>(
    data.selectedCandidateId || candidates[0]?.candidate_id || "c1"
  );
  const activeCand = candidates.find((c) => c.candidate_id === activeCandId) || candidates[0];

  const [currentImage, setCurrentImage] = React.useState<string | undefined>(
    activeCand?.preview_image_url || data.imageUrl || undefined
  );
  const [isLocked, setIsLocked] = React.useState<boolean>(Boolean(data.isLocked));
  const [isRendering, setIsRendering] = React.useState<boolean>(false);

  // Sync state if candidate changes
  const handleSwitchCandidate = (candId: string) => {
    setActiveCandId(candId);
    const target = candidates.find((c) => c.candidate_id === candId);
    if (target) {
      if (target.preview_image_url) {
        setCurrentImage(target.preview_image_url);
      }
      updateNodeData(id, {
        selectedCandidateId: candId,
        name: target.name,
        region: target.region,
        dayRate: target.day_rate,
        permitFee: target.permit_fee,
        imageUrl: target.preview_image_url || currentImage,
      });
      data.onSelectCandidate?.(candId);
    }
  };

  const handleToggleLock = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextLocked = !isLocked;
    setIsLocked(nextLocked);
    updateNodeData(id, { isLocked: nextLocked });
    data.onToggleLock?.();
  };

  const handleGenerateConceptLook = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isRendering) return;
    setIsRendering(true);

    const venueName = activeCand?.name || data.name || "Cinematic Location";
    const regionName = activeCand?.region || data.region || "Metropolitan Backlot";
    const basePrompt =
      data.prompt ||
      activeCand?.preview_image_prompt ||
      `Cinematic 35mm anamorphic wide shot of ${venueName} in ${regionName}. Low-key volumetric lighting, atmospheric haze, industrial cinematic texture, photoreal, master cinematography.`;

    try {
      const res = await fetch("/api/media/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: basePrompt,
          aspect_ratio: "16:9",
        }),
      });

      if (res.ok) {
        const result = await res.json();
        if (result.image_url) {
          setCurrentImage(result.image_url);
          // Also update candidate cache
          setCandidates((prev) =>
            prev.map((c) =>
              c.candidate_id === activeCandId
                ? { ...c, preview_image_url: result.image_url, preview_image_prompt: basePrompt }
                : c
            )
          );
          updateNodeData(id, {
            imageUrl: result.image_url,
            prompt: basePrompt,
          });
          notifyIfFallback(result, "Location Concept Look");
          toast.add({
            title: "Location Concept Generated",
            description: `Rendered Imagen 3 concept frame for "${venueName}".`,
            type: "success",
          });
        } else {
          toast.add({ title: "Image generation failed", description: "No image URL returned.", type: "error" });
        }
      } else {
        toast.add({ title: "Generation failed", description: `Server returned status ${res.status}`, type: "error" });
      }
    } catch (err) {
      console.error("Location node image render error:", err);
      toast.add({
        title: "Image generation error",
        description: err instanceof Error ? err.message : "Failed to connect to image service.",
        type: "error",
      });
    } finally {
      setIsRendering(false);
    }
  };

  return (
    <BlueprintNodeShell
      kind="Physical Production"
      title={activeCand?.name || data.name || "Location Scout"}
      icon={MapPin}
      colorScheme="amber"
      selected={selected}
      headerRight={
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={handleToggleLock}
          className="text-muted-foreground hover:text-amber-400 transition-colors p-0.5 rounded cursor-pointer nodrag"
          title={isLocked ? "Venue Locked for Shoot" : "Candidate Open (Click to Lock)"}
        >
          {isLocked ? <Lock className="h-3.5 w-3.5 text-amber-400" /> : <Unlock className="h-3.5 w-3.5" />}
        </button>
      }
    >
      <div className="relative flex flex-col gap-2 text-xs">
        {/* Input Target Ports for Scene and Characters */}
        <div className="absolute -left-6 top-2 flex flex-col gap-3">
          <Handle
            type="target"
            position={Position.Left}
            id="scene_in"
            className={cn(handleBaseClass, "!bg-amber-400")}
          />
          <Handle
            type="target"
            position={Position.Left}
            id="character_in"
            className={cn(handleBaseClass, "!bg-purple-500")}
          />
        </div>

        {/* Candidate Switcher Dropdown / Pills for Location Experimentation */}
        {candidates.length > 1 && (
          <div className="flex flex-col gap-1 rounded border border-amber-500/20 bg-amber-500/5 p-1.5 nodrag">
            <div className="flex items-center justify-between text-[10px] font-mono text-amber-400 font-bold">
              <span>Scouted Candidates ({candidates.length})</span>
              <span className="text-[9px] text-muted-foreground">Experiment &amp; Compare</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {candidates.map((c) => {
                const isSelectedCand = c.candidate_id === activeCandId;
                return (
                  <button
                    key={c.candidate_id}
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSwitchCandidate(c.candidate_id);
                    }}
                    className={cn(
                      "px-1.5 py-0.5 rounded text-[10px] font-mono truncate max-w-[130px] transition-all cursor-pointer nodrag",
                      isSelectedCand
                        ? "bg-amber-500 text-black font-bold shadow-xs"
                        : "bg-secondary/70 hover:bg-secondary text-muted-foreground hover:text-foreground border border-border/50"
                    )}
                    title={`${c.name} (${c.region || "Base"})`}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Venue Telemetry Badges */}
        <div className="grid grid-cols-2 gap-1 text-[10px] font-mono">
          <div className="rounded bg-background/80 border border-border/60 px-1.5 py-0.5 text-muted-foreground truncate flex items-center gap-1">
            <Building2 className="h-2.5 w-2.5 text-amber-400 shrink-0" />
            <span className="truncate">{activeCand?.region || data.region || "Production Base"}</span>
          </div>
          <div className="rounded bg-background/80 border border-border/60 px-1.5 py-0.5 text-emerald-400 font-bold truncate flex items-center gap-1">
            <DollarSign className="h-2.5 w-2.5 shrink-0" />
            <span>
              {activeCand?.day_rate || data.dayRate
                ? `$${(activeCand?.day_rate || data.dayRate)!.toLocaleString()}/day`
                : "Rate TBD"}
            </span>
          </div>
        </div>

        {/* Visual Concept Image Display with Imagen 3 generation */}
        {currentImage ? (
          <div className="group relative w-full overflow-hidden rounded-lg border border-amber-500/40 bg-black shadow-md">
            <img
              src={currentImage}
              alt={activeCand?.name || data.name}
              className="w-full h-28 object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent flex flex-col justify-end p-2 pointer-events-none">
              <span className="text-[9px] font-mono uppercase tracking-wider text-amber-400 font-bold flex items-center gap-1">
                <Sparkles className="h-2.5 w-2.5" /> Concept Look
              </span>
              <span className="text-[10px] text-white/90 truncate font-sans">
                {activeCand?.name || data.name}
              </span>
            </div>

            {/* Re-roll overlay button */}
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={handleGenerateConceptLook}
              disabled={isRendering}
              className="absolute top-1.5 right-1.5 flex items-center gap-1 rounded bg-black/75 hover:bg-black text-white px-1.5 py-0.5 text-[9px] font-mono opacity-80 group-hover:opacity-100 transition-opacity border border-white/20 cursor-pointer disabled:opacity-50 nodrag"
            >
              <RotateCcw className={cn("h-2.5 w-2.5", isRendering && "animate-spin")} />
              <span>{isRendering ? "Rendering..." : "Re-roll"}</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-amber-500/30 bg-amber-500/5 p-3 text-center">
            <ImageIcon className="h-5 w-5 text-amber-400/70" />
            <span className="text-[10px] text-muted-foreground font-mono">No visual concept rendered yet</span>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={handleGenerateConceptLook}
              disabled={isRendering}
              className="flex items-center gap-1 rounded bg-amber-500 text-black hover:bg-amber-400 px-2 py-1 text-[10px] font-semibold transition-colors cursor-pointer disabled:opacity-50 nodrag"
            >
              <Sparkles className={cn("h-3 w-3", isRendering && "animate-spin")} />
              <span>{isRendering ? "Rendering Look..." : "Generate Concept Look (Imagen 3)"}</span>
            </button>
          </div>
        )}

        {/* Action Controls Footer */}
        <div className="mt-1 flex items-center gap-1.5 nodrag">
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              data.onOpenDossier?.(activeCand?.candidate_id);
            }}
            className="flex-1 flex items-center justify-center gap-1 rounded bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 py-1 text-[10px] font-medium transition-colors border border-amber-500/30 cursor-pointer nodrag"
          >
            <FileText className="h-3 w-3" />
            Specs Dossier &amp; Grid
          </button>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={handleToggleLock}
            className={cn(
              "flex items-center justify-center gap-1 rounded px-2 py-1 text-[10px] font-medium transition-colors cursor-pointer nodrag",
              isLocked
                ? "bg-amber-500 text-black font-semibold"
                : "bg-secondary hover:bg-secondary/80 text-foreground"
            )}
            title={isLocked ? "Venue Locked" : "Click to Lock Venue"}
          >
            {isLocked ? <Check className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
            <span>{isLocked ? "Locked" : "Lock"}</span>
          </button>
        </div>

        {/* Output Ports: loc_out (amber) and visual_out (purple) */}
        <div className="relative mt-1 flex items-center justify-between pt-1 border-t border-border/30">
          <span className="text-[9px] font-mono text-muted-foreground">ports:</span>
          <div className="flex items-center gap-3">
            <span className="text-[9px] font-mono text-amber-400">loc_out →</span>
            <span className="text-[9px] font-mono text-purple-400">visual_out →</span>
          </div>

          <Handle
            type="source"
            position={Position.Right}
            id="loc_out"
            className={cn(handleBaseClass, "!bg-amber-500 -right-5 !top-3")}
          />
          <Handle
            type="source"
            position={Position.Right}
            id="visual_out"
            className={cn(handleBaseClass, "!bg-purple-500 -right-5 !top-8")}
          />
        </div>
      </div>
    </BlueprintNodeShell>
  );
}

// -------------------------------------------------------------
// React Flow NodeTypes Registry
// -------------------------------------------------------------
export const nodeTypes = {
  clip: ClipNode,
  note: NoteNode,
  actor: ActorNode,
  personality: PersonalityNode,
  quirks: QuirksNode,
  characterCore: CharacterCoreNode,
  chemistry: ChemistryNode,
  scene: SceneNode,
  script: ScriptNode,
  storyboard: StoryboardNode,
  floorplan: FloorPlanNode,
  tensionCurve: TensionCurveNode,
  tableRead: TableReadNode,
  market: MarketNode,
  location: LocationNode,
};

