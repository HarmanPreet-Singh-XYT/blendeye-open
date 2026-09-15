"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Play,
  Plus,
  Shuffle,
  Clock,
  ArrowRight,
  Film,
  LogIn,
  UserPlus,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";

interface LandingHeroProps {
  onOpenNewProject: () => void;
  onOpenFusion: () => void;
  onLoadDemoProject: () => void;
}

export function LandingHero({ onOpenNewProject, onOpenFusion, onLoadDemoProject }: LandingHeroProps) {
  const { isAuthenticated } = useAuth();

  const scrollToSimulator = () => {
    const el = document.getElementById("simulator");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section className="relative w-full pt-10 pb-16 md:pt-16 md:pb-24 flex flex-col items-center text-center space-y-10">
      {/* Platform Announcement Pill */}
      <div className="inline-flex items-center gap-2.5 rounded-full border border-border/80 bg-card/80 px-4 py-1.5 shadow-sm backdrop-blur text-xs">
        <span className="h-2 w-2 rounded-full bg-accent shadow-[0_0_8px_rgba(212,160,84,0.8)]" />
        <span className="font-heading font-semibold text-foreground tracking-wide">
          AI Film Director Studio
        </span>
        <span className="text-border">·</span>
        <span className="font-mono text-accent font-medium">
          ClickHouse Time-Gate Engine
        </span>
      </div>

      {/* Main Headline */}
      <div className="space-y-5 max-w-4xl mx-auto px-4">
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-heading font-extrabold tracking-tight leading-[1.1] text-foreground">
          The Writers&apos; Room That Knows{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent via-amber-300 to-cyan-400">
            What Your Characters Know.
          </span>
        </h1>

        <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed font-normal">
          Scrub a story timeline to any minute and interrogate any character live. Characters strictly answer within their time-gated knowledge boundary — backed by sub-millisecond ClickHouse event scans and Gemini 3.7 Flash.
        </p>
      </div>

      {/* Call to Actions Bar — the studio is cloud-only and login-gated, so the
          primary action is sign-in/sign-up until there is a session. */}
      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        {isAuthenticated ? (
          <Link
            href="/dashboard"
            prefetch={true}
            className={cn(
              buttonVariants({ size: "lg" }),
              "h-12 px-7 text-sm font-semibold gap-2 bg-accent text-accent-foreground hover:bg-accent/90 shadow-xl shadow-accent/25 transition-all inline-flex items-center cursor-pointer"
            )}
          >
            <Film className="h-4 w-4" />
            Enter Studio Dashboard
          </Link>
        ) : (
          <>
            <Link
              href="/auth?mode=signup&redirect=%2Fdashboard"
              prefetch={true}
              className={cn(
                buttonVariants({ size: "lg" }),
                "h-12 px-7 text-sm font-semibold gap-2 bg-accent text-accent-foreground hover:bg-accent/90 shadow-xl shadow-accent/25 transition-all inline-flex items-center cursor-pointer"
              )}
            >
              <UserPlus className="h-4 w-4" />
              Create Free Account
            </Link>

            <Link
              href="/auth?mode=signin&redirect=%2Fdashboard"
              prefetch={true}
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "h-12 px-6 text-sm font-medium gap-2 border-border bg-card/60 hover:bg-secondary transition-all inline-flex items-center cursor-pointer"
              )}
            >
              <LogIn className="h-4 w-4 text-accent" />
              Sign In
            </Link>
          </>
        )}

        {isAuthenticated && (
          <Button
            size="lg"
            variant="outline"
            className="h-12 px-5 text-sm font-medium gap-2 border-border bg-card/60 hover:bg-secondary transition-all"
            onClick={onOpenNewProject}
          >
            <Plus className="h-4 w-4 text-accent" />
            New Production
          </Button>
        )}

        <Button
          size="lg"
          variant="secondary"
          className="h-12 px-5 text-sm font-medium gap-2 border border-border/80 hover:bg-secondary/80 transition-all"
          onClick={scrollToSimulator}
        >
          <Clock className="h-4 w-4 text-accent" />
          Time-Gate Simulator
          <ArrowRight className="h-4 w-4" />
        </Button>

        <Button
          size="lg"
          variant="ghost"
          className="h-12 px-4 text-sm font-medium gap-2 text-muted-foreground hover:text-foreground transition-all"
          onClick={onLoadDemoProject}
        >
          <Play className="h-4 w-4 fill-current text-accent" />
          Load Demo Production
        </Button>

        <Button
          size="lg"
          variant="ghost"
          className="h-12 px-4 text-sm font-medium gap-2 text-muted-foreground hover:text-foreground transition-all"
          onClick={onOpenFusion}
        >
          <Shuffle className="h-4 w-4 text-accent" />
          Film Fusion
        </Button>
      </div>

      {/* Key Stats Bar (Terminal Metrics) */}
      <div className="w-full max-w-4xl mx-auto px-4 pt-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-2xl border border-border/70 bg-card/40 backdrop-blur shadow-lg text-left">
          <div className="space-y-0.5 border-r border-border/60 pr-2">
            <div className="text-xl sm:text-2xl font-mono font-bold text-accent">&lt; 2ms</div>
            <div className="text-[11px] text-muted-foreground font-mono">Time-Gate Query Latency</div>
          </div>

          <div className="space-y-0.5 border-r border-border/60 pr-2">
            <div className="text-xl sm:text-2xl font-mono font-bold text-success">100%</div>
            <div className="text-[11px] text-muted-foreground font-mono">Ignorance Firewall Guarantee</div>
          </div>

          <div className="space-y-0.5 border-r border-border/60 pr-2">
            <div className="text-xl sm:text-2xl font-mono font-bold text-cyan-400">14 Nodes</div>
            <div className="text-[11px] text-muted-foreground font-mono">Unreal-Style Backlot Graph</div>
          </div>

          <div className="space-y-0.5">
            <div className="text-xl sm:text-2xl font-mono font-bold text-amber-300">2.39:1</div>
            <div className="text-[11px] text-muted-foreground font-mono">Scope Storyboard Generation</div>
          </div>
        </div>
      </div>

      {/* Hero Cinematic Artwork Frame with Sprocket Perforations */}
      <div className="w-full max-w-5xl mx-auto px-4 pt-6">
        <div className="relative rounded-2xl border border-border overflow-hidden bg-black shadow-2xl cinema-glow">
          {/* Top Film Sprocket Strip */}
          <div className="sprocket-strip bg-secondary/80 border-b border-border/60" />

          {/* 2.39:1 Cinematic Frame Preview */}
          <div className="relative w-full aspect-[2.39/1] overflow-hidden">
            <Image
              src="/cinema/vault_heist.jpg"
              alt="The Vault Heist Cinematic Still Frame"
              fill
              priority
              className="object-cover"
              sizes="(max-width: 1200px) 100vw, 1200px"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent opacity-80" />

            {/* Burn-in Cinema Slate Metadata */}
            <div className="absolute top-4 left-4 flex items-center gap-2">
              <span className="px-2.5 py-1 rounded bg-black/80 backdrop-blur font-mono text-xs text-accent border border-accent/40 font-bold">
                SCENE 04 · TAKE 01
              </span>
              <span className="px-2.5 py-1 rounded bg-black/80 backdrop-blur font-mono text-xs text-white/90 border border-border">
                INT. UNDERGROUND VAULT - 00:34:00
              </span>
            </div>

            <div className="absolute bottom-4 left-4 right-4 flex flex-col sm:flex-row sm:items-end justify-between gap-3 text-left">
              <div className="space-y-1 max-w-xl">
                <span className="text-[10px] font-mono uppercase tracking-wider text-accent font-bold">
                  Live Interactive Centerpiece Scene · Chronos Shift
                </span>
                <h3 className="text-base sm:text-xl font-heading font-bold text-white leading-tight">
                  &ldquo;That is my voice dying on Deck Three. Four minutes from now.&rdquo;
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={onLoadDemoProject}
                  className="h-8 text-xs bg-accent text-accent-foreground hover:bg-accent/90 font-medium inline-flex items-center cursor-pointer"
                >
                  <Play className="h-3 w-3 fill-current mr-1.5" />
                  Generate This Scene
                </Button>
              </div>
            </div>
          </div>

          {/* Bottom Film Sprocket Strip */}
          <div className="sprocket-strip bg-secondary/80 border-t border-border/60" />
        </div>
      </div>
    </section>
  );
}
