"use client";

import * as React from "react";
import Link from "next/link";
import { Film, Plus, Database, Layers, LogIn } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { AuthUserButton } from "@/components/cinema/auth-user-button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

interface LandingNavbarProps {
  onOpenNewProject: () => void;
  onOpenFusion: () => void;
}

export function LandingNavbar({ onOpenNewProject }: LandingNavbarProps) {
  const { isAuthenticated } = useAuth();
  const [scrolled, setScrolled] = React.useState(false);
  const [clickhouseLatency, setClickhouseLatency] = React.useState<string | null>(null);

  React.useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  React.useEffect(() => {
    let isMounted = true;
    async function fetchLatency() {
      try {
        const res = await fetch("/api/observability", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          const latency = data?.telemetry?.clickhouse_latency_ms;
          if (isMounted && typeof latency === "number" && !isNaN(latency)) {
            setClickhouseLatency(`${latency.toFixed(1)}ms`);
            return;
          }
        }
      } catch {
        // Fallback handled below
      }
      if (isMounted) {
        setClickhouseLatency("< 2.0ms");
      }
    }
    fetchLatency();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-colors duration-200 border-b ${
        scrolled
          ? "bg-background/95 backdrop-blur-md border-border shadow-xl"
          : "bg-background/60 backdrop-blur-sm border-border/80"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
        {/* Left: Brand Identity (Single clean line, no wrapping) */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0 hover:opacity-90 transition-opacity">
          <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-black/50 border border-accent/30 overflow-hidden shadow-sm">
            <img src="/logo.png" alt="BlendEye" className="h-full w-full object-cover" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-heading font-semibold tracking-tight text-sm sm:text-base text-foreground whitespace-nowrap">
              BlendEye
            </span>
            <span className="text-border text-xs hidden sm:inline">/</span>
            <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider hidden sm:inline">
              Studio
            </span>
          </div>
        </Link>

        {/* Center: Quick navigation links */}
        <nav className="hidden lg:flex items-center gap-5 text-xs font-medium text-muted-foreground">
          <a
            href="#simulator"
            className="hover:text-foreground transition-colors flex items-center gap-1.5 whitespace-nowrap"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Time-Gate
          </a>
          <a
            href="#canvas-backlot"
            className="hover:text-foreground transition-colors flex items-center gap-1.5 whitespace-nowrap"
          >
            <Layers className="h-3 w-3 text-cyan-400" />
            Visual Backlot
          </a>
          <a
            href="#directors-deck"
            className="hover:text-foreground transition-colors whitespace-nowrap"
          >
            Director&apos;s Deck
          </a>
          <a
            href="#multiverse"
            className="hover:text-foreground transition-colors whitespace-nowrap"
          >
            Multiverse
          </a>
          <a
            href="#slates"
            className="hover:text-foreground transition-colors whitespace-nowrap"
          >
            Film Slates
          </a>
          <a
            href="#engine"
            className="hover:text-foreground transition-colors flex items-center gap-1 whitespace-nowrap"
          >
            <Database className="h-3 w-3 text-emerald-400" />
            ClickHouse
          </a>
        </nav>

        {/* Right: Live Telemetry & Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden xl:flex items-center gap-1.5 text-[11px] font-mono bg-secondary/50 px-2.5 py-1 rounded-full border border-border text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
            <span>ClickHouse:</span>
            <span className="text-emerald-400 font-semibold">{clickhouseLatency || "< 2.0ms"}</span>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5 border-border hover:bg-secondary cursor-pointer"
            onClick={onOpenNewProject}
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">New Slate</span>
            <span className="sm:hidden">New</span>
          </Button>

          {isAuthenticated ? (
            <Link
              href="/dashboard"
              prefetch={true}
              className={cn(
                buttonVariants({ size: "sm" }),
                "h-8 px-3 text-xs gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90 shadow-sm font-semibold whitespace-nowrap cursor-pointer inline-flex items-center"
              )}
            >
              <Film className="h-3.5 w-3.5" />
              <span>Studio Dashboard</span>
            </Link>
          ) : (
            <Link
              href="/auth?mode=signin&redirect=%2Fdashboard"
              prefetch={true}
              className={cn(
                buttonVariants({ size: "sm" }),
                "h-8 px-3 text-xs gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90 shadow-sm font-semibold whitespace-nowrap cursor-pointer inline-flex items-center"
              )}
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>Sign In</span>
            </Link>
          )}

          <AuthUserButton />
        </div>
      </div>
    </header>
  );
}

