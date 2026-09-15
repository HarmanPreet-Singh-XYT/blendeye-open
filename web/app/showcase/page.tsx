"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AmbientBackground } from "@/components/landing/ambient-background";
import { LandingNavbar } from "@/components/landing/landing-navbar";
import { LandingHero } from "@/components/landing/landing-hero";
import { TimeGateSimulator } from "@/components/landing/time-gate-simulator";
import { BacklotCanvasSimulator } from "@/components/landing/backlot-canvas-simulator";
import { DirectorsDeckSuite } from "@/components/landing/directors-deck-suite";
import { MultiverseTakesSwitcher } from "@/components/landing/multiverse-takes-switcher";
import { FilmFusionCrossover } from "@/components/landing/film-fusion-crossover";
import { FeaturedSlatesShowcase } from "@/components/landing/featured-slates-showcase";
import { ClickHouseDeepDive } from "@/components/landing/clickhouse-deep-dive";
import { LandingFooter } from "@/components/landing/landing-footer";
import {
  NewProjectDialog,
  type NewProjectFormData,
} from "@/components/cinema/new-project-dialog";
import { FilmFusionDialog } from "@/components/cinema/film-fusion-dialog";
import { createNewProjectEntry, saveProject } from "@/lib/project-store";
import { VAULT_PROTOCOL_PRESET } from "@/lib/demo-preset";
import { useAuth } from "@/lib/auth-context";

export default function ShowcasePage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [newProjectOpen, setNewProjectOpen] = React.useState(false);
  const [isGeneratingProject, setIsGeneratingProject] = React.useState(false);
  const [fusionOpen, setFusionOpen] = React.useState(false);

  // Showcase is public, but productions are account-scoped (cloud-only,
  // login-gated). Visitors are routed to sign-up instead of into a wizard
  // whose result could not be saved.
  const goToSignUp = React.useCallback(() => {
    router.push("/auth?mode=signup&redirect=%2Fdashboard");
  }, [router]);

  const handleOpenNewProject = React.useCallback(() => {
    if (!isAuthenticated) {
      goToSignUp();
      return;
    }
    setNewProjectOpen(true);
  }, [isAuthenticated, goToSignUp]);

  const handleOpenFusion = React.useCallback(() => {
    if (!isAuthenticated) {
      goToSignUp();
      return;
    }
    setFusionOpen(true);
  }, [isAuthenticated, goToSignUp]);

  const handleCreateProject = async (data: NewProjectFormData) => {
    if (!isAuthenticated) {
      goToSignUp();
      return;
    }
    setIsGeneratingProject(true);
    try {
      let genData: any = null;
      try {
        const genRes = await fetch("/api/project/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: data.title,
            logline: data.logline,
            genre: data.genre,
            characters: data.characters,
            customCharacters: data.customCharacters,
            directorStyle: data.directorStyle,
            coreSecret: data.coreSecret,
            primaryLocation: data.primaryLocation,
            targetTerritories: data.targetTerritories,
            narrativeFormat: data.narrativeFormat,
            targetRuntimeMinutes: data.targetRuntimeMinutes,
          }),
        });
        if (genRes.ok) {
          genData = await genRes.json();
        }
      } catch (e) {
        console.warn("Showrunner AI sequence generation error, falling back:", e);
      }

      const project = createNewProjectEntry({
        title: data.title,
        logline: data.logline,
        genre: data.genre,
        characters: data.characters,
        directorStyle: data.directorStyle,
        coreSecret: data.coreSecret,
        primaryLocation: data.primaryLocation,
        targetTerritories: data.targetTerritories,
        customCharacters: data.customCharacters,
        narrativeFormat: data.narrativeFormat,
        targetRuntimeMinutes: data.targetRuntimeMinutes,
        scenePlacementSeconds: data.scenePlacementSeconds,
        sceneDurationSeconds: data.sceneDurationSeconds,
        totalScenesEstimate: data.totalScenesEstimate,
      });

      if (genData?.scenes && Array.isArray(genData.scenes) && genData.scenes.length > 0) {
        project.scenes = genData.scenes;
        project.activeSceneId = genData.scenes[0].id;
        project.sceneTitle = genData.scenes[0].title;
        project.sceneSummary = genData.scenes[0].summary;
        project.screenplayText = genData.scenes[0].screenplayText;
        if (genData.scenes[0].location) {
          project.primaryLocation = genData.scenes[0].location;
        }
      }
      if (genData?.characters && Array.isArray(genData.characters) && genData.characters.length > 0) {
        project.characters = genData.characters;
      }

      saveProject(project);
      setNewProjectOpen(false);
      router.push(`/studio/${project.id}`);
    } catch (err) {
      console.error("Failed to create project:", err);
    } finally {
      setIsGeneratingProject(false);
    }
  };

  // Pre-fills the New Production wizard with the guided demo preset and runs
  // the ordinary generation pipeline, so the demo takes exactly the same code
  // path as a hand-authored slate.
  const handleLoadDemoProject = () => {
    if (!isAuthenticated) {
      goToSignUp();
      return;
    }
    setNewProjectOpen(true);
    void handleCreateProject(VAULT_PROTOCOL_PRESET);
  };

  return (
    <div className="relative min-h-screen bg-background text-foreground flex flex-col selection:bg-accent/30 selection:text-accent-foreground overflow-x-hidden">
      {/* Ambient Visual Background Effects */}
      <AmbientBackground />

      {/* Top Studio Nav */}
      <LandingNavbar
        onOpenNewProject={handleOpenNewProject}
        onOpenFusion={handleOpenFusion}
      />

      {/* Main Landing Page Content Container */}
      <main className="relative z-10 flex-1 flex flex-col items-center px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full space-y-20">
        {/* 1. High-Impact Cinematic Hero */}
        <LandingHero
          onOpenNewProject={handleOpenNewProject}
          onOpenFusion={handleOpenFusion}
          onLoadDemoProject={handleLoadDemoProject}
        />

        {/* 2. Centerpiece: Interactive Time-Gate Engine & Interrogation Simulator */}
        <TimeGateSimulator />

        {/* 3. The Visual Backlot: Unreal-Style Node Graph Simulator */}
        <BacklotCanvasSimulator />

        {/* 4. The Director's Deck Suite: 2D Floor Plan, Tension Curve, Box Office, Audio Table Read, Stripboard */}
        <DirectorsDeckSuite />

        {/* 5. Multiverse Alternate Takes: 3-Way Director Styles (A24 / Mann / Nolan) */}
        <MultiverseTakesSwitcher />

        {/* 6. Film Fusion Screenplay Crossover Engine */}
        <FilmFusionCrossover onOpenFusionDialog={handleOpenFusion} />

        {/* 7. Featured Production Slates (With 2.39:1 Letterbox Frames) */}
        <FeaturedSlatesShowcase
          onOpenNewProject={handleOpenNewProject}
          onLoadDemoProject={handleLoadDemoProject}
        />

        {/* 8. ClickHouse Deep Dive: Architecture & Performance Benchmarks */}
        <ClickHouseDeepDive />
      </main>

      {/* Footer */}
      <LandingFooter />

      {/* New Project Dialog */}
      <NewProjectDialog
        open={newProjectOpen}
        onOpenChange={setNewProjectOpen}
        isSubmitting={isGeneratingProject}
        onSubmit={handleCreateProject}
      />

      {/* Film Fusion Crossover Dialog */}
      <FilmFusionDialog
        open={fusionOpen}
        onOpenChange={setFusionOpen}
      />
    </div>
  );
}
