"use client";

import Link from "next/link";
import { SlateLabel } from "@/components/cinema/slate-label";

export function LandingFooter() {
  return (
    <footer className="w-full border-t border-border bg-card/60 mt-20 relative z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-7 w-7 rounded-md bg-black/50 border border-accent/30 overflow-hidden shadow-sm">
                <img src="/logo.png" alt="BlendEye" className="h-full w-full object-cover" />
              </div>
              <span className="font-heading font-bold text-lg text-foreground">
                BlendEye
              </span>
              <span className="text-border">/</span>
              <SlateLabel>Production Suite</SlateLabel>
            </div>
            <p className="text-xs text-muted-foreground max-w-md">
              The writers&apos; room that knows what your characters know. Built on Google Cloud AI and the ClickHouse story events plane.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs text-muted-foreground">
            <Link href="/dashboard" className="hover:text-foreground transition-colors">
              Studio Dashboard
            </Link>
            <Link href="/canvas-demo" className="hover:text-foreground transition-colors">
              Canvas Sandbox
            </Link>
            <Link href="/design-system" className="hover:text-foreground transition-colors">
              Design System
            </Link>
          </div>
        </div>

        <div className="border-t border-border/50 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] font-mono text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span>ClickHouse Story Events Plane · Gemini 3.7 Flash Engine</span>
          </div>

          <div className="flex items-center gap-4">
            <span>MIT License</span>
            <span>·</span>
            <span>© 2026 BlendEye</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
