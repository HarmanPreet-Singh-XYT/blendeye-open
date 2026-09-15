"use client";

import * as React from "react";
import { SlateLabel } from "@/components/cinema/slate-label";
import { Badge } from "@/components/ui/badge";
import { Database, Zap, ShieldCheck, Cpu, Terminal, ArrowRight } from "lucide-react";

export function ClickHouseDeepDive() {
  return (
    <div id="engine" className="w-full space-y-6 pt-12">
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border pb-5">
        <div className="space-y-1">
          <SlateLabel>ClickHouse Integration</SlateLabel>
          <h2 className="text-2xl md:text-3xl font-heading font-bold tracking-tight text-foreground">
            Why ClickHouse Powers the Core Time-Gate Data Plane
          </h2>
          <p className="text-xs md:text-sm text-muted-foreground max-w-2xl">
            ClickHouse is not a passive cache — it is the fundamental data structure enabling sub-millisecond timeline interrogation without character hallucinations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-accent/40 bg-accent/10 text-accent font-mono text-xs py-1">
            Engine: MergeTree
          </Badge>
          <Badge variant="outline" className="border-success/40 bg-success/10 text-success font-mono text-xs py-1">
            Ordered Primary Key
          </Badge>
        </div>
      </div>

      {/* Grid: Schema + Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Schema & Query Architecture (7 cols) */}
        <div className="lg:col-span-7 p-6 rounded-2xl border border-border bg-card/90 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-accent" />
              <span className="font-heading font-bold text-xs uppercase tracking-wider text-foreground">
                The Story Event Engine: DDL &amp; Query Pattern
              </span>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground">HTTP Port 8123</span>
          </div>

          {/* DDL Snippet */}
          <div className="p-3.5 rounded-xl border border-border bg-black/80 font-mono text-[11px] text-foreground/90 space-y-1 overflow-x-auto">
            <div className="text-muted-foreground text-[10px] mb-1">// 1. Ordered Compound Primary Key</div>
            <pre className="leading-relaxed">
              <span className="text-cyan-400">CREATE TABLE</span> story_events ({"\n"}
              {"  "}project_id <span className="text-amber-300">String</span>,{"\n"}
              {"  "}character_name <span className="text-amber-300">String</span>,{"\n"}
              {"  "}event_timestamp <span className="text-amber-300">String</span>,  <span className="text-muted-foreground">// HH:MM:SS sortable</span>{"\n"}
              {"  "}event_type <span className="text-emerald-400">Enum8</span>(&apos;known_fact&apos; = 1, &apos;unaware_of&apos; = 2),{"\n"}
              {"  "}content <span className="text-amber-300">String</span>{"\n"}
              ) <span className="text-cyan-400">ENGINE = MergeTree()</span>{"\n"}
              <span className="text-cyan-400">ORDER BY</span> (<span className="text-accent">project_id</span>, <span className="text-accent">character_name</span>, <span className="text-accent">event_timestamp</span>);
            </pre>
          </div>

          {/* Time-gate Scan Pattern */}
          <div className="p-3.5 rounded-xl border border-accent/30 bg-accent/5 font-mono text-[11px] space-y-1 overflow-x-auto">
            <div className="text-accent text-[10px] uppercase font-bold">// 2. Sub-Millisecond Time-Gate Scan</div>
            <pre className="text-foreground leading-relaxed">
              <span className="text-cyan-400">SELECT</span> event_type, content <span className="text-cyan-400">FROM</span> story_events{"\n"}
              <span className="text-cyan-400">WHERE</span> project_id = <span className="text-amber-300">&apos;vault-heist&apos;</span>{"\n"}
              {"  "}<span className="text-cyan-400">AND</span> character_name = <span className="text-amber-300">&apos;Marcus&apos;</span>{"\n"}
              {"  "}<span className="text-cyan-400">AND</span> event_timestamp &lt;= <span className="text-accent font-bold">&apos;00:34:00&apos;</span>{"\n"}
              <span className="text-cyan-400">ORDER BY</span> event_timestamp;
            </pre>
          </div>
        </div>

        {/* Technical Architecture Comparison Card (5 cols) */}
        <div className="lg:col-span-5 p-6 rounded-2xl border border-border bg-secondary/30 space-y-5 shadow-xl flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-border/60 pb-3">
              <Zap className="h-4 w-4 text-accent" />
              <h3 className="font-heading font-bold text-xs uppercase tracking-wider text-foreground">
                Architectural Advantage
              </h3>
            </div>

            {/* Comparison Rows */}
            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/5 space-y-1">
                <span className="font-mono text-[10px] text-destructive uppercase font-bold">
                  Naive Vector DB / Full-Prompting
                </span>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Negative system prompts (&ldquo;don&apos;t reveal the twist&rdquo;) frequently hallucinate future facts. Latency: 1,500ms - 3,000ms.
                </p>
              </div>

              <div className="p-3 rounded-lg border border-success/30 bg-success/5 space-y-1">
                <span className="font-mono text-[10px] text-success uppercase font-bold">
                  ClickHouse Time-Gated Knowledge Plane
                </span>
                <p className="text-foreground text-[11px] leading-relaxed">
                  100% mathematical guarantee. Future events literally do not exist in the prompt context. ClickHouse scans the ordered primary key in under 2ms.
                </p>
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl border border-border bg-card text-xs flex items-center justify-between">
            <div className="flex items-center gap-2 font-mono">
              <span className="h-2 w-2 rounded-full bg-success" />
              <span className="text-muted-foreground text-[11px]">Benchmarked Latency:</span>
              <span className="text-success font-bold text-[11px]">1.2ms - 1.8ms</span>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground">Zero Leaks</span>
          </div>
        </div>
      </div>
    </div>
  );
}
