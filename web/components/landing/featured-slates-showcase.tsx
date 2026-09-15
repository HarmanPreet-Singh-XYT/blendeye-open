"use client";

import * as React from "react";
import Image from "next/image";
import { SlateLabel } from "@/components/cinema/slate-label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Play, Plus, Clock, ArrowRight } from "lucide-react";
import { VAULT_PROTOCOL_SUMMARY } from "@/lib/demo-preset";

interface ProductionSlate {
  id: string;
  title: string;
  genre: string;
  runtime: string;
  imageSrc: string;
  characters: string[];
  logline: string;
  hook: string;
  badge: string;
  badgeVariant: string;
  isCustom?: boolean;
  isDemo?: boolean;
}

const CUSTOM_SLATE: ProductionSlate = {
  id: "custom-slate",
  title: "Director's Custom Studio",
  genre: "Any Genre / Custom Premise",
  runtime: "Configurable Runtime",
  imageSrc: "/cinema/directors_suite.jpg",
  characters: ["Your Characters"],
  logline:
    "Create your own production slate from a prompt or logline. Gemini 3.7 Flash shards your script into timestamped ClickHouse story events.",
  hook:
    "Full control over character psychological DNA, camera lens packages, stage blocking, and custom time-gated knowledge firewalls.",
  badge: "Writers' Room",
  badgeVariant: "border-cyan-500/40 bg-cyan-500/15 text-cyan-300",
  isCustom: true,
};

const FEATURED_SLATES: ProductionSlate[] = [
  {
    id: "vault-protocol-demo",
    ...VAULT_PROTOCOL_SUMMARY,
    isDemo: true,
  },
  CUSTOM_SLATE,
];

export function FeaturedSlatesShowcase({
  onOpenNewProject,
  onLoadDemoProject,
}: {
  onOpenNewProject: () => void;
  onLoadDemoProject: () => void;
}) {

  return (
    <div id="slates" className="w-full space-y-6 pt-12">
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border pb-5">
        <div className="space-y-1">
          <SlateLabel>Production Slates</SlateLabel>
          <h2 className="text-2xl md:text-3xl font-heading font-bold tracking-tight text-foreground">
            Start a Production Slate
          </h2>
          <p className="text-xs md:text-sm text-muted-foreground max-w-2xl">
            Load the guided demo production into your own studio, or start a custom film from scratch. Every slate is
            generated and sharded into your account.
          </p>
        </div>

        <Button
          size="sm"
          className="h-8 text-xs gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90"
          onClick={onOpenNewProject}
        >
          <Plus className="h-3.5 w-3.5" />
          Create New Slate
        </Button>
      </div>

      {/* Slates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl">
        {FEATURED_SLATES.map((slate) => (
          <div
            key={slate.id}
            onClick={() => {
              if (slate.isCustom) {
                onOpenNewProject();
              } else {
                onLoadDemoProject();
              }
            }}
            className="group relative rounded-2xl border border-border bg-card hover:border-accent/60 transition-all duration-300 overflow-hidden flex flex-col justify-between shadow-lg hover:shadow-2xl cursor-pointer"
          >
            {/* Top Widescreen Storyboard Still (2.39:1 Letterbox Frame) */}
            <div className="relative w-full aspect-[2.39/1] overflow-hidden bg-black">
              <Image
                src={slate.imageSrc}
                alt={slate.title}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-500"
                sizes="(max-width: 768px) 100vw, 400px"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent opacity-90" />
              
              <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                <Badge variant="outline" className={`text-[10px] py-0.5 backdrop-blur-md bg-black/60 ${slate.badgeVariant}`}>
                  {slate.badge}
                </Badge>
              </div>

              <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-[11px] font-mono text-muted-foreground">
                <span className="text-white/90 font-semibold">{slate.genre}</span>
                <span className="text-accent">{slate.runtime}</span>
              </div>
            </div>

            {/* Slate Content Body */}
            <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <h3 className="text-lg font-heading font-bold text-foreground group-hover:text-accent transition-colors flex items-center justify-between">
                  <span>{slate.title}</span>
                  <ArrowRight className="h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-accent" />
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                  {slate.logline}
                </p>
              </div>

              {/* Characters */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-mono uppercase text-muted-foreground font-semibold block">
                  Ensemble Cast:
                </span>
                <div className="flex flex-wrap gap-1">
                  {slate.characters.map((c) => (
                    <span
                      key={c}
                      className="px-2 py-0.5 rounded border border-border/70 bg-secondary/50 text-[10px] font-medium text-foreground"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>

              {/* Centerpiece Hook Box */}
              <div className="p-3 rounded-lg border border-border/70 bg-secondary/30 space-y-1 text-xs">
                <div className="flex items-center gap-1 text-accent font-medium text-[11px]">
                  <Clock className="h-3 w-3" />
                  <span>Time-Gate Challenge:</span>
                </div>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  {slate.hook}
                </p>
              </div>

              {/* Action Button */}
              <Button
                size="sm"
                className="w-full text-xs gap-2 bg-secondary text-foreground hover:bg-accent hover:text-accent-foreground transition-colors font-medium h-9 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  if (slate.isCustom) {
                    onOpenNewProject();
                  } else {
                    onLoadDemoProject();
                  }
                }}
              >
                {slate.isCustom ? (
                  <>
                    <Plus className="h-3.5 w-3.5" />
                    <span>Create Custom Slate</span>
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5 fill-current" />
                    <span>Load Guided Demo</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
