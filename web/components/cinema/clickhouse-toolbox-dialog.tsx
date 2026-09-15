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
import { Database, ShieldCheck, Terminal, Activity, CheckCircle2, AlertTriangle } from "lucide-react";
import type { ClickHouseQueryLog } from "@/components/cinema/clickhouse-inspector";

interface ClickHouseToolboxDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  queryLogs?: ClickHouseQueryLog[];
}

interface ClickHouseTelemetry {
  uptime_seconds?: number;
  clickhouse_ping_ms?: number;
  story_events_rows?: number;
  cinematic_precedents_rows?: number;
  distinct_projects_sharded?: number;
}

export function ClickHouseToolboxDialog({
  open,
  onOpenChange,
  projectId,
  queryLogs = [],
}: ClickHouseToolboxDialogProps) {
  const [metrics, setMetrics] = React.useState<ClickHouseTelemetry | null>(null);
  const [isLive, setIsLive] = React.useState<boolean>(true);

  React.useEffect(() => {
    if (open) {
      fetch("/api/metrics")
        .then((res) => res.json())
        .then((data) => {
          setMetrics(data.telemetry || null);
          setIsLive(!data._fallback && data.mcp_servers?.clickhouse_mcp === "online");
        })
        .catch(() => {
          setMetrics(null);
          setIsLive(false);
        });
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-card border-border shadow-2xl p-6">
        <DialogHeader className="border-b border-border/80 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                <Database className="h-4 w-4 text-amber-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-base font-heading">
                    ClickHouse MCP Database Toolbox
                  </DialogTitle>
                  <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-400 text-[10px] font-mono">
                    <CheckCircle2 className="h-2.5 w-2.5 mr-1" />
                    Official MCP Server
                  </Badge>
                </div>
                <DialogDescription className="text-xs text-muted-foreground">
                  Model Context Protocol (MCP) server managing time-gated character perspective firewalls.
                </DialogDescription>
              </div>
            </div>

            <div className={`flex items-center gap-1.5 font-mono text-[11px] px-2.5 py-1 rounded-md border ${
              isLive
                ? "text-muted-foreground bg-secondary/40 border-border/60"
                : "text-amber-400 bg-amber-500/10 border-amber-500/40"
            }`}>
              <span className={`h-2 w-2 rounded-full animate-pulse ${isLive ? "bg-emerald-500" : "bg-amber-500"}`} />
              <span>{isLive ? "ClickHouse Connected" : "ClickHouse Unreachable"}</span>
            </div>
          </div>
        </DialogHeader>

        {!isLive && (
          <div className="flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>ClickHouse is unreachable — the figures below are unavailable, not live.</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 py-3">
          {/* Telemetry Cards — real ClickHouse row counts & ping, not static numbers */}
          <div className="rounded-lg border border-border/70 bg-secondary/20 p-3 flex flex-col gap-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Activity className="h-3 w-3 text-cyan-400" />
              ClickHouse Ping
            </span>
            <span className="text-xl font-heading font-bold text-foreground">
              {metrics?.clickhouse_ping_ms != null ? `${metrics.clickhouse_ping_ms} ms` : "—"}
            </span>
            <span className="text-[10px] text-emerald-400">Live SELECT 1 round-trip</span>
          </div>

          <div className="rounded-lg border border-border/70 bg-secondary/20 p-3 flex flex-col gap-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <ShieldCheck className="h-3 w-3 text-amber-400" />
              Story Events Stored
            </span>
            <span className="text-xl font-heading font-bold text-foreground">
              {metrics?.story_events_rows != null ? metrics.story_events_rows.toLocaleString() : "—"}
            </span>
            <span className="text-[10px] text-muted-foreground">
              Across {metrics?.distinct_projects_sharded ?? 0} sharded project{metrics?.distinct_projects_sharded === 1 ? "" : "s"}
            </span>
          </div>

          <div className="rounded-lg border border-border/70 bg-secondary/20 p-3 flex flex-col gap-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Database className="h-3 w-3 text-purple-400" />
              Cinematic Precedent Rows
            </span>
            <span className="text-xl font-heading font-bold text-foreground">
              {metrics?.cinematic_precedents_rows != null ? metrics.cinematic_precedents_rows.toLocaleString() : "—"}
            </span>
            <span className="text-[10px] text-muted-foreground">Grounding table for market &amp; commander agents</span>
          </div>
        </div>

        {/* MCP Schema Overview */}
        <div className="rounded-lg border border-border/80 bg-black/40 p-3 font-mono text-xs space-y-2">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground pb-1 border-b border-border/40">
            <span className="flex items-center gap-1.5 text-amber-400 font-semibold">
              <Terminal className="h-3.5 w-3.5" />
              story_events Schema (ClickHouse MCP Toolbox)
            </span>
            <span>Table: story_events</span>
          </div>
          <pre className="text-[10.5px] text-muted-foreground leading-relaxed overflow-x-auto">
{`CREATE TABLE story_events (
    project_id        String,
    event_timestamp   String,    -- Timecode: "00:14:32"
    character_name    String,    -- Perspective Owner
    event_type        Enum8('known_fact'=1, 'unaware_of'=2, 'location'=3, 'objective'=4),
    content           String     -- Fact payload
) ENGINE = MergeTree()
ORDER BY (project_id, character_name, event_timestamp);`}
          </pre>
        </div>

        {/* Live Query Logs */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Terminal className="h-3.5 w-3.5 text-cyan-400" />
              Live ClickHouse MCP Execution Log ({queryLogs.length} queries captured)
            </span>
            <span className="text-[10px] font-mono text-muted-foreground">Current Project: {projectId}</span>
          </div>

          <div className="max-h-48 overflow-y-auto space-y-1.5 rounded-lg border border-border/70 bg-secondary/15 p-2 font-mono text-[11px]">
            {queryLogs.length === 0 ? (
              <div className="p-3 text-center text-muted-foreground text-xs italic">
                No ClickHouse queries logged yet. Scrub the timeline or interrogate Marcus to trigger MCP queries.
              </div>
            ) : (
              queryLogs.map((log) => (
                <div
                  key={log.id}
                  className="rounded border border-border/50 bg-card/60 p-2 flex flex-col gap-1"
                >
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span className="text-cyan-400 uppercase font-semibold">[{log.type}]</span>
                    <span>{log.timestamp} · {log.durationMs || 8}ms</span>
                  </div>
                  <code className="text-foreground/90 break-all text-[10.5px]">{log.sql}</code>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex items-center justify-end pt-2 border-t border-border/80">
          <Button
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 text-xs bg-secondary text-foreground hover:bg-secondary/80 cursor-pointer"
          >
            Close Toolbox
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
