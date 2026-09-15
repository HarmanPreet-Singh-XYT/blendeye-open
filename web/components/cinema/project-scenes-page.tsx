"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Film,
  Plus,
  Clapperboard,
  Clock,
  ArrowLeft,
  Users,
  MapPin,
  Sparkles,
  ChevronUp,
  ChevronDown,
  Trash2,
  FileText,
  Calendar,
  Layers,
  Zap,
  Check,
  Play,
  TrendingUp,
  Sliders,
  SlidersHorizontal,
  GitFork,
  ExternalLink,
  Pencil,
  Settings2,
  DollarSign,
  Building2,
  Camera,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SlateLabel } from "@/components/cinema/slate-label";
import { CreateSceneDialog } from "@/components/cinema/create-scene-dialog";
import { EditProjectDialog } from "@/components/cinema/edit-project-dialog";
import { BridgeSceneDialog } from "@/components/cinema/bridge-scene-dialog";
import { StripboardView } from "@/components/cinema/stripboard-view";
import { LocationBoard, cleanCandidateName } from "@/components/cinema/location-board";
import { LocationDossierDialog } from "@/components/cinema/location-dossier-dialog";
import { TerritoryHeatmapView } from "@/components/cinema/territory-heatmap-view";
import { ShowrunnerChat, type ExtendedShowrunnerMessage } from "@/components/cinema/showrunner-chat";
import { SequenceTimelineView } from "@/components/cinema/sequence-timeline-view";
import { SceneGraphView } from "@/components/cinema/scene-graph-view";
import { executeStudioActions } from "@/lib/studio-commander";
import { toast } from "@/components/ui/toast";
import {
  type ProjectData,
  type FilmScene,
  type ProjectCharacter,
  type LocationCandidate,
  saveProject,
  formatCurrency,
} from "@/lib/project-store";
import { cn } from "@/lib/utils";

export function isBridgeScene(scene?: { isBridge?: boolean; id?: string; title?: string } | null): boolean {
  if (!scene) return false;
  return Boolean(
    scene.isBridge ||
    scene.id?.startsWith("bridge") ||
    scene.title?.toLowerCase().includes("bridge")
  );
}

interface ProjectScenesPageProps {
  project: ProjectData;
  onUpdateProject?: (updated: ProjectData) => void;
  onOpenSceneStudio?: (sceneId: string) => void;
}

export function ProjectScenesPage({
  project,
  onUpdateProject,
  onOpenSceneStudio,
}: ProjectScenesPageProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = React.useState<"scenes" | "stripboard" | "locations" | "screenplay" | "showrunner" | "market">("scenes");
  const [sceneViewMode, setSceneViewMode] = React.useState<"timeline" | "graph" | "cards">("timeline");
  const [scenes, setScenes] = React.useState<FilmScene[]>(() => project.scenes || []);
  const [activeSceneId, setActiveSceneId] = React.useState<string>(
    () => project.activeSceneId || project.scenes?.[0]?.id || "vault-sc-03"
  );
  const [currentProject, setCurrentProject] = React.useState<ProjectData>(project);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
  const [isProjectEditDialogOpen, setIsProjectEditDialogOpen] = React.useState(false);
  const [sceneToEdit, setSceneToEdit] = React.useState<FilmScene | null>(null);
  const [isGeneratingBridge, setIsGeneratingBridge] = React.useState<number | null>(null);
  const [bridgeDialogIndex, setBridgeDialogIndex] = React.useState<number | null>(null);
  const [dossierState, setDossierState] = React.useState<{ candidate: LocationCandidate; scene: FilmScene } | null>(null);
  const [previewVideoUrl, setPreviewVideoUrl] = React.useState<{ url: string; title: string } | null>(null);

  // Sync state if project changes
  React.useEffect(() => {
    setCurrentProject(project);
    if (project.scenes && project.scenes.length > 0) {
      setScenes(project.scenes);
      if (!activeSceneId || !project.scenes.some((s) => s.id === activeSceneId)) {
        setActiveSceneId(project.activeSceneId || project.scenes[0].id);
      }
    }
  }, [project]);

  const totalRuntimeSeconds = React.useMemo(() => {
    return scenes.reduce((acc, s) => acc + (s.durationSeconds || 180), 0);
  }, [scenes]);

  const totalRuntimeMinutes = Math.round(totalRuntimeSeconds / 60);

  const saveScenes = React.useCallback(
    (nextScenes: FilmScene[], nextActiveId?: string) => {
      setScenes(nextScenes);
      const aid = nextActiveId || activeSceneId;
      if (nextActiveId) setActiveSceneId(nextActiveId);

      const activeSc = nextScenes.find((s) => s.id === aid) || nextScenes[0];
      const updatedProj: ProjectData = {
        ...currentProject,
        scenes: nextScenes,
        activeSceneId: aid,
        sceneTitle: activeSc?.title || currentProject.sceneTitle,
        sceneSummary: activeSc?.summary || currentProject.sceneSummary,
        screenplayText: activeSc?.screenplayText || currentProject.screenplayText,
        videoTakes: currentProject.videoTakes || [],
        activeVideoUrl: currentProject.activeVideoUrl,
        updatedAt: Date.now(),
      };

      setCurrentProject(updatedProj);
      saveProject(updatedProj);
      if (onUpdateProject) onUpdateProject(updatedProj);
    },
    [currentProject, activeSceneId, onUpdateProject]
  );

  const handleOpenSceneStudio = (sceneId: string) => {
    saveScenes(scenes, sceneId);
    if (onOpenSceneStudio) {
      onOpenSceneStudio(sceneId);
    } else {
      router.push(`/studio/${currentProject.id}/scene/${sceneId}`);
    }
  };

  const handleAddScene = (newScene: FilmScene, openStudioImmediately: boolean) => {
    const next = [...scenes, newScene];
    saveScenes(next, newScene.id);
    toast.add({
      title: `Scene added to sequence`,
      description: `"${newScene.title}" is now Scene ${next.length}.`,
      type: "success",
    });
    if (openStudioImmediately) {
      if (onOpenSceneStudio) {
        onOpenSceneStudio(newScene.id);
      } else {
        router.push(`/studio/${currentProject.id}/scene/${newScene.id}`);
      }
    }
  };

  const handleUpdateScene = (updatedScene: FilmScene, openStudioImmediately: boolean) => {
    const next = scenes.map((s) => (s.id === updatedScene.id ? updatedScene : s));
    saveScenes(next, updatedScene.id);
    toast.add({
      title: `Scene Updated`,
      description: `Saved changes to Scene ${updatedScene.sceneNumber}: "${updatedScene.title}".`,
      type: "success",
    });
    if (openStudioImmediately) {
      handleOpenSceneStudio(updatedScene.id);
    }
  };

  const handleUpdateProject = (updatedProj: ProjectData) => {
    setCurrentProject(updatedProj);
    if (updatedProj.scenes && updatedProj.scenes.length > 0) {
      setScenes(updatedProj.scenes);
    }
    if (onUpdateProject) onUpdateProject(updatedProj);
  };

  const handleQuickAddScene = (pos?: { x: number; y: number }) => {
    const nextNum = scenes.length + 1;
    const newScene: FilmScene = {
      id: `scene-${Date.now()}`,
      sceneNumber: nextNum,
      title: `Beat ${nextNum}`,
      slugline: "INT. UNTITLED LOCATION - DAY",
      summary: "Newly added dramatic beat ready for screenplay drafting.",
      durationSeconds: 180,
      startSeconds: totalRuntimeSeconds,
      location: "Main Location",
      castPresent: (project.characters || []).slice(0, 2).map((c) => c.name),
      castRoles: {},
      screenplayText: "INT. UNTITLED LOCATION - DAY\n\n[Action description]\n\nCHARACTER\n(beat)\nDialogue goes here.",
    };
    handleAddScene(newScene, false);
  };

  const handleMoveScene = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= scenes.length) return;

    const next = [...scenes];
    const temp = next[index];
    next[index] = next[targetIndex];
    next[targetIndex] = temp;

    // Recalculate scene numbers & startSeconds
    let cursor = 0;
    const reindexed = next.map((s, idx) => {
      const updated = {
        ...s,
        sceneNumber: idx + 1,
        startSeconds: cursor,
      };
      cursor += s.durationSeconds || 180;
      return updated;
    });

    saveScenes(reindexed);
    toast.add({
      title: "Sequence Reordered",
      description: `Moved "${temp.title}" to Scene ${targetIndex + 1}.`,
      type: "info",
    });
  };

  const handleReorderScenes = React.useCallback(
    (reordered: FilmScene[]) => {
      let cursor = 0;
      const reindexed = reordered.map((s, idx) => {
        const updated = {
          ...s,
          sceneNumber: idx + 1,
          startSeconds: cursor,
        };
        cursor += s.durationSeconds || 180;
        return updated;
      });
      saveScenes(reindexed);
      toast.add({
        title: "Sequence Reordered",
        description: `Updated sequence order for ${reindexed.length} scenes.`,
        type: "info",
      });
    },
    [saveScenes]
  );

  const handleDeleteScene = (sceneId: string) => {
    if (scenes.length <= 1) {
      toast.add({
        title: "Cannot delete only scene",
        description: "A project must contain at least one scene.",
        type: "warning",
      });
      return;
    }
    const next = scenes.filter((s) => s.id !== sceneId);
    let cursor = 0;
    const reindexed = next.map((s, idx) => {
      const sc = { ...s, sceneNumber: idx + 1, startSeconds: cursor };
      cursor += s.durationSeconds || 180;
      return sc;
    });
    const nextActive = activeSceneId === sceneId ? reindexed[0]?.id : activeSceneId;
    saveScenes(reindexed, nextActive);
    toast.add({
      title: "Scene removed",
      type: "info",
    });
  };

  const handleOpenBridgeDialog = (index: number) => {
    setBridgeDialogIndex(index);
  };

  const handleGenerateBridgeAI = async (
    index: number,
    options: { userPrompt?: string; durationSeconds?: number } = {}
  ) => {
    const prevScene = scenes[index];
    const nextScene = scenes[index + 1];
    if (!prevScene || !nextScene) return;

    setIsGeneratingBridge(index);
    try {
      const res = await fetch("/api/script/bridge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prevScene: {
            title: prevScene.title,
            slugline: prevScene.slugline,
            summary: prevScene.summary,
            location: prevScene.location,
            castPresent: prevScene.castPresent,
          },
          nextScene: {
            title: nextScene.title,
            slugline: nextScene.slugline,
            summary: nextScene.summary,
            location: nextScene.location,
            castPresent: nextScene.castPresent,
          },
          premise: project.premise,
          characters: project.characters,
          userPrompt: options.userPrompt,
          targetDurationSeconds: options.durationSeconds,
        }),
      });

      if (!res.ok) throw new Error("Bridge generation request failed");
      const data = await res.json();
      const bridgeScene: FilmScene = {
        id: `bridge-${Date.now()}`,
        sceneNumber: index + 2,
        title: data.title || "Transitional Bridge Beat",
        slugline: data.slugline || "INT. CORRIDOR - CONTINUOUS",
        summary: data.summary || "Connective story beat bridging escalating narrative stakes.",
        startSeconds: (prevScene.startSeconds || 0) + (prevScene.durationSeconds || 180),
        durationSeconds: data.durationSeconds || options.durationSeconds || 120,
        location: data.location || "Transit Area",
        castPresent: data.castPresent || prevScene.castPresent || [],
        castRoles: {
          [(prevScene.castPresent?.[0] || "Lead")]: "Executing transition beat",
        },
        screenplayText: data.screenplayText || "",
        isBridge: true,
      };

      const updated = [...scenes.slice(0, index + 1), bridgeScene, ...scenes.slice(index + 1)];
      let cursor = 0;
      const reindexed = updated.map((s, idx) => {
        const sc = { ...s, sceneNumber: idx + 1, startSeconds: cursor };
        cursor += s.durationSeconds || 180;
        return sc;
      });

      saveScenes(reindexed, bridgeScene.id);
      if (data && typeof data === "object" && (data as Record<string, unknown>)._fallback) {
        toast.add({
          title: "Template Bridge Scene Inserted",
          description: `Inserted "${bridgeScene.title}" as a placeholder between Scene ${index + 1} and Scene ${index + 2}.`,
          type: "warning",
        });
      } else {
        toast.add({
          title: options.userPrompt ? "Directed Bridge Scene Generated" : "AI Bridge Scene Generated",
          description: `Inserted "${bridgeScene.title}" between Scene ${index + 1} and Scene ${index + 2}.`,
          type: "success",
        });
      }
    } catch (err) {
      console.error("Bridge generation error:", err);
      toast.add({
        title: "Bridge Generation Failed",
        description: "Could not synthesize connective scene.",
        type: "error",
      });
    } finally {
      setIsGeneratingBridge(null);
    }
  };

  const handleInsertBlankBridge = (
    index: number,
    blankData: {
      title: string;
      slugline: string;
      location: string;
      summary: string;
      screenplayText?: string;
      durationSeconds: number;
      castPresent: string[];
      isCompletelyEmpty?: boolean;
    }
  ) => {
    const prevScene = scenes[index];
    const nextScene = scenes[index + 1];
    if (!prevScene || !nextScene) return;

    const isCleanEmpty = blankData.isCompletelyEmpty;
    const bridgeScene: FilmScene = {
      id: `bridge-${Date.now()}`,
      sceneNumber: index + 2,
      title: blankData.title || (isCleanEmpty ? `Scene ${index + 2}` : "Transitional Beat"),
      slugline: blankData.slugline || "INT. TRANSIT LOCATION - CONTINUOUS",
      summary: blankData.summary || "",
      startSeconds: (prevScene.startSeconds || 0) + (prevScene.durationSeconds || 180),
      durationSeconds: blankData.durationSeconds || 120,
      location: blankData.location || "Transit Location",
      castPresent: blankData.castPresent || [],
      castRoles: {},
      screenplayText: blankData.screenplayText !== undefined
        ? blankData.screenplayText
        : (isCleanEmpty ? "" : `${blankData.slugline}\n\n`),
      isBridge: true,
      nodes: [],
      edges: [],
      events: [],
    };

    const updated = [...scenes.slice(0, index + 1), bridgeScene, ...scenes.slice(index + 1)];
    let cursor = 0;
    const reindexed = updated.map((s, idx) => {
      const sc = { ...s, sceneNumber: idx + 1, startSeconds: cursor };
      cursor += s.durationSeconds || 180;
      return sc;
    });

    saveScenes(reindexed, bridgeScene.id);
    toast.add({
      title: "Blank Bridge Scene Inserted",
      description: `Inserted "${bridgeScene.title}" between Scene ${index + 1} and Scene ${index + 2}.`,
      type: "success",
    });
  };

  const [showrunnerMessages, setShowrunnerMessages] = React.useState<ExtendedShowrunnerMessage[]>([
    {
      role: "showrunner",
      content: `Greetings, Director. I'm your Showrunner co-pilot for "${project.title}". We can brainstorm narrative arcs, audit sequence continuity, weave in new story beats, or restructure the reel. Where would you like to take our story today?`,
    },
  ]);
  const [isShowrunnerThinking, setIsShowrunnerThinking] = React.useState(false);

  const handleSendShowrunner = async (userText: string) => {
    const userMsg: ExtendedShowrunnerMessage = {
      role: "user",
      content: userText,
    };
    const updatedHistory = [...showrunnerMessages, userMsg];
    setShowrunnerMessages(updatedHistory);
    setIsShowrunnerThinking(true);

    try {
      const activeSc = scenes.find((s) => s.id === activeSceneId) || scenes[0];
      const payload = {
        instruction: userText,
        history: updatedHistory.slice(-6).map((m) => ({
          role: m.role,
          content: m.content,
        })),
        projectContext: {
          id: project.id,
          title: project.title,
          genre: project.genre,
          directorStyle: project.directorStyle,
          premise: project.premise,
          activeSceneId,
          activeSceneTitle: activeSc?.title,
          activeSceneSummary: activeSc?.summary,
          activeScreenplayText: activeSc?.screenplayText,
          scenes: scenes.map((s) => ({
            id: s.id,
            sceneNumber: s.sceneNumber,
            title: s.title,
            slugline: s.slugline,
            summary: s.summary,
            location: s.location,
            castPresent: s.castPresent,
            durationSeconds: s.durationSeconds,
            startSeconds: s.startSeconds,
          })),
          characters: (project.characters || []).map((c) => ({
            name: c.name,
            role: c.role,
            archetype: c.archetype,
          })),
        },
      };

      const res = await fetch("/api/showrunner/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Showrunner directive failed with status ${res.status}`);
      }

      const data = await res.json();
      const actions = data.actions || [];
      const commentary = data.assistant_message || data.commentary || data.reply || data.result || "Directive processed.";

      let executedSummaries: string[] = data.execution_summaries || [];
      if (actions.length > 0) {
        const actionResult = executeStudioActions(
          actions,
          {
            scenes,
            activeSceneId,
            characters: project.characters || [],
          },
          {
            setScenes: (updatedScenes) => {
              saveScenes(updatedScenes);
            },
            setActiveSceneId: (newId) => {
              setActiveSceneId(newId);
            },
            setScreenplayText: (newText) => {
              if (activeSc) {
                const updated = scenes.map((s) => (s.id === activeSc.id ? { ...s, screenplayText: newText } : s));
                saveScenes(updated);
              }
            },
          }
        );
        if (actionResult?.summaries?.length) {
          executedSummaries = actionResult.summaries;
        }
      }

      const assistantMsg: ExtendedShowrunnerMessage = {
        role: "showrunner",
        content: commentary,
        thought_process: data.thought_process,
        actions,
        execution_summaries: executedSummaries,
        precedents_cited: data.precedents_cited,
      };
      setShowrunnerMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error("Showrunner execution error:", err);
      toast.add({
        title: "Showrunner Directive Failed",
        description: err?.message || "Failed to process directive.",
        type: "error",
      });
      const errorMsg: ExtendedShowrunnerMessage = {
        role: "showrunner",
        content: `Error processing directive: ${err?.message || "Unknown error"}. Please try again.`,
      };
      setShowrunnerMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsShowrunnerThinking(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {/* ── TOP HERO BANNER: Project Overview & Meta ── */}
      <header className="border-b border-border bg-card/60 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link href="/dashboard">
                <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>

              <div className="flex flex-col">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
                    {currentProject.title}
                  </h1>
                  <button
                    type="button"
                    onClick={() => setIsProjectEditDialogOpen(true)}
                    className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors cursor-pointer"
                    title="Edit Project Configuration (Title, Genre, Director, Scope, Characters)"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <Badge variant="outline" className="border-accent/40 bg-accent/10 text-accent font-medium text-xs">
                    {currentProject.genre || "Cinema Feature"}
                  </Badge>
                  {currentProject.directorStyle && (
                    <Badge variant="outline" className="border-border text-muted-foreground text-xs font-mono">
                      Dir. {currentProject.directorStyle}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl line-clamp-1">
                  {currentProject.premise || "No logline specified."}
                </p>
              </div>
            </div>

            {/* Quick Metrics & Actions */}
            <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
              <div className="hidden sm:flex items-center gap-3 bg-secondary/50 border border-border px-3 py-1.5 rounded-lg text-xs font-mono">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Film className="h-3.5 w-3.5 text-accent" />
                  <strong className="text-foreground">{scenes.length}</strong> Scenes
                </span>
                <span className="text-border">|</span>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="h-3.5 w-3.5 text-accent" />
                  <strong className="text-foreground">{totalRuntimeMinutes}m</strong>
                  {currentProject.targetRuntimeMinutes ? ` / ${currentProject.targetRuntimeMinutes}m Target` : ""}
                </span>
              </div>

              <Button
                variant="outline"
                onClick={() => setIsProjectEditDialogOpen(true)}
                className="gap-1.5 text-xs border-border hover:border-accent text-foreground shadow-2xs"
              >
                <Settings2 className="h-3.5 w-3.5 text-accent" />
                <span>Project Settings</span>
              </Button>

              <Button
                onClick={() => setIsCreateDialogOpen(true)}
                className="gap-1.5 text-xs font-semibold bg-accent text-accent-foreground hover:bg-accent/90 shadow-sm"
              >
                <Plus className="h-4 w-4" />
                Create Scene
              </Button>

              <Button
                variant="outline"
                onClick={() => handleOpenSceneStudio(activeSceneId || scenes[0]?.id || "vault-sc-03")}
                className="gap-1.5 text-xs border-accent/40 text-accent hover:bg-accent/10"
              >
                <Clapperboard className="h-3.5 w-3.5" />
                Open Scene Studio
              </Button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 mt-4 border-t border-border/60 pt-2 overflow-x-auto">
            <button
              onClick={() => setActiveTab("scenes")}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer",
                activeTab === "scenes"
                  ? "bg-accent text-accent-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
              )}
            >
              <Film className="h-3.5 w-3.5" />
              Sequence Reel ({scenes.length})
            </button>

            <button
              onClick={() => setActiveTab("stripboard")}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer",
                activeTab === "stripboard"
                  ? "bg-accent text-accent-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
              )}
            >
              <Calendar className="h-3.5 w-3.5" />
              Stripboard &amp; Schedule
            </button>

            <button
              onClick={() => setActiveTab("locations")}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer",
                activeTab === "locations"
                  ? "bg-accent text-accent-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
              )}
            >
              <MapPin className="h-3.5 w-3.5" />
              Location Board
            </button>

            <button
              onClick={() => setActiveTab("screenplay")}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer",
                activeTab === "screenplay"
                  ? "bg-accent text-accent-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
              )}
            >
              <FileText className="h-3.5 w-3.5" />
              Master Screenplay
            </button>

            <button
              onClick={() => setActiveTab("market")}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer",
                activeTab === "market"
                  ? "bg-accent text-accent-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
              )}
            >
              <TrendingUp className="h-3.5 w-3.5" />
              Market Grounding (ClickHouse)
            </button>
            <button
              onClick={() => setActiveTab("showrunner")}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer",
                activeTab === "showrunner"
                  ? "bg-accent text-accent-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
              )}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Showrunner AI Director
            </button>
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT AREA ── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full">
        {/* TAB 1: SEQUENCE REEL (THE DEDICATED SCENES PAGE) */}
        <div className={activeTab === "scenes" ? "space-y-6" : "hidden"}>
          {/* View Mode Switcher Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card/60 border border-border p-2.5 rounded-xl shadow-xs">
              <div className="flex items-center gap-1.5 bg-secondary/70 p-1 rounded-lg border border-border/60">
                <button
                  type="button"
                  onClick={() => setSceneViewMode("timeline")}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer",
                    sceneViewMode === "timeline"
                      ? "bg-accent text-accent-foreground shadow-xs font-bold"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  )}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  <span>NLE Timeline</span>
                  <span className="text-[10px] opacity-70 font-mono hidden md:inline">Multi-Track</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSceneViewMode("graph")}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer",
                    sceneViewMode === "graph"
                      ? "bg-accent text-accent-foreground shadow-xs font-bold"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  )}
                >
                  <GitFork className="h-3.5 w-3.5" />
                  <span>Story Graph</span>
                  <span className="text-[10px] opacity-70 font-mono hidden md:inline">Flow Nodes</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSceneViewMode("cards")}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer",
                    sceneViewMode === "cards"
                      ? "bg-accent text-accent-foreground shadow-xs font-bold"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  )}
                >
                  <Layers className="h-3.5 w-3.5" />
                  <span>Scene Cards</span>
                  <span className="text-[10px] opacity-70 font-mono hidden md:inline">Supervisor</span>
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                <span className="hidden sm:inline">Active Scene:</span>
                <Badge variant="outline" className="text-foreground font-mono text-[11px] border-accent/40 bg-accent/5">
                  S{scenes.find((s) => s.id === activeSceneId)?.sceneNumber || 1}: {scenes.find((s) => s.id === activeSceneId)?.title || "Scene"}
                </Badge>
              </div>
            </div>

            {/* Mode 1: Interactive NLE Video Editor Timeline */}
            {sceneViewMode === "timeline" && (
              <SequenceTimelineView
                scenes={scenes}
                activeSceneId={activeSceneId}
                onSelectScene={setActiveSceneId}
                onOpenSceneStudio={handleOpenSceneStudio}
                onMoveScene={handleMoveScene}
                onReorderScenes={handleReorderScenes}
                onGenerateBridge={handleOpenBridgeDialog}
                isGeneratingBridge={isGeneratingBridge}
                onDeleteScene={handleDeleteScene}
                onAddScene={() => setIsCreateDialogOpen(true)}
                onEditScene={(scene) => setSceneToEdit(scene)}
                characters={currentProject.characters}
                projectTitle={currentProject.title}
              />
            )}

            {/* Mode 2: Interactive Story Node Graph */}
            {sceneViewMode === "graph" && (
              <SceneGraphView
                scenes={scenes}
                activeSceneId={activeSceneId}
                onSelectScene={setActiveSceneId}
                onOpenSceneStudio={handleOpenSceneStudio}
                onMoveScene={handleMoveScene}
                onReorderScenes={handleReorderScenes}
                onGenerateBridge={handleOpenBridgeDialog}
                isGeneratingBridge={isGeneratingBridge}
                onDeleteScene={handleDeleteScene}
                onAddScene={() => setIsCreateDialogOpen(true)}
                onQuickAddScene={handleQuickAddScene}
                onEditScene={(scene) => setSceneToEdit(scene)}
                characters={currentProject.characters}
                projectTitle={currentProject.title}
              />
            )}

            {/* Mode 3: Traditional Script Supervisor Cards */}
            {sceneViewMode === "cards" && (
              <div className="space-y-6">
                {/* Timeline Progress Track */}
            <div className="rounded-xl border border-border bg-card/40 p-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-semibold uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-accent" />
                  Continuous Sequence Timeline
                </span>
                <span className="font-mono text-[11px]">
                  Total: {totalRuntimeMinutes} minutes ({scenes.length} scenes)
                </span>
              </div>

              {/* Segmented scene blocks track */}
              <div className="h-8 rounded-lg bg-secondary/50 border border-border p-1 flex gap-1 overflow-hidden">
                {scenes.map((s, idx) => {
                  const duration = s.durationSeconds || 180;
                  const pct = totalRuntimeSeconds > 0 ? (duration / totalRuntimeSeconds) * 100 : 100 / scenes.length;
                  const isActive = s.id === activeSceneId;
                  const isBridge = isBridgeScene(s);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setActiveSceneId(s.id)}
                      style={{ width: `${Math.max(6, pct)}%` }}
                      className={cn(
                        "h-full rounded text-[10px] font-mono font-bold flex items-center justify-center transition-all px-1 truncate cursor-pointer",
                        isActive
                          ? isBridge
                            ? "bg-purple-500 text-purple-950 ring-2 ring-purple-400 font-black shadow-xs"
                            : "bg-accent text-accent-foreground ring-1 ring-accent shadow-xs"
                          : isBridge
                          ? "bg-purple-950/70 text-purple-300 border border-purple-500/50 hover:bg-purple-900/60"
                          : "bg-card/70 text-muted-foreground hover:bg-card hover:text-foreground border border-border/50"
                      )}
                      title={`Scene ${s.sceneNumber}: ${s.title}${isBridge ? " [BRIDGE SCENE]" : ""} (${Math.round(duration / 60)}m)`}
                    >
                      {isBridge ? `S${s.sceneNumber} ⚡` : `S${s.sceneNumber}`}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Featured Demo Callout (for The Vault Heist) */}
            {project.id.includes("vault-heist") && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                    <Zap className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-amber-400">
                        Featured Demo: Scene 3 (The Vault Breach)
                      </span>
                      <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px]">
                        Minute 34 vs 52 Time-Gate
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Marcus searches for keys at minute 34 while Elena secretly holds them. In Scene 4, Marcus is interrogated at minute 52 after discovering the truth.
                    </p>
                  </div>
                </div>

                <Button
                  onClick={() => handleOpenSceneStudio("vault-sc-03")}
                  className="bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs gap-1.5 shrink-0 shadow-sm"
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                  Launch Scene 3 Studio
                </Button>
              </div>
            )}

            {/* Scene Cards Sequence */}
            <div className="space-y-4">
              {scenes.map((scene, index) => {
                const isActive = scene.id === activeSceneId;
                const isBridge = isBridgeScene(scene);
                const durationMinutes = Math.round((scene.durationSeconds || 180) / 60);
                const sceneVideoUrl =
                  scene.activeVideoUrl ||
                  (scene.videoTakes && scene.videoTakes.length > 0 ? scene.videoTakes[0].videoUrl : null) ||
                  (isActive && currentProject.activeVideoUrl ? currentProject.activeVideoUrl : null);
                const hasVideoTake = Boolean(sceneVideoUrl);

                return (
                  <React.Fragment key={scene.id}>
                    {/* Scene Card */}
                    <div
                      className={cn(
                        "rounded-xl border transition-all duration-200 overflow-hidden shadow-sm",
                        isBridge
                          ? isActive
                            ? "bg-purple-950/20 border-purple-500/80 ring-1 ring-purple-500/40 shadow-md"
                            : "bg-purple-950/10 border-purple-500/35 hover:border-purple-500/70 hover:bg-purple-950/15"
                          : isActive
                          ? "bg-card/70 border-accent/80 ring-1 ring-accent/30 shadow-md"
                          : "bg-card/70 border-border hover:border-border/90 hover:bg-card"
                      )}
                    >
                      <div className="p-4 sm:p-5 flex flex-col gap-4">
                        {/* Header: Scene #, Slugline, Badges & Actions */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <span
                              className={cn(
                                "rounded-md font-mono text-xs font-black px-2 py-1",
                                isBridge
                                  ? "bg-purple-500/20 border border-purple-500/40 text-purple-300"
                                  : "bg-accent/15 border border-accent/30 text-accent"
                              )}
                            >
                              SCENE {String(scene.sceneNumber).padStart(2, "0")}
                            </span>
                            <span className="font-mono text-xs sm:text-sm font-bold text-foreground tracking-wide">
                              {scene.slugline || "INT. LOCATION - NIGHT"}
                            </span>
                            {isBridge && (
                              <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/50 text-[10px] font-mono flex items-center gap-1 font-bold">
                                <Sparkles className="h-3 w-3 text-purple-400" />
                                BRIDGE SCENE
                              </Badge>
                            )}
                            {hasVideoTake && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (sceneVideoUrl) {
                                    setPreviewVideoUrl({
                                      url: sceneVideoUrl,
                                      title: `Scene ${scene.sceneNumber}: ${scene.slugline || scene.title} — Master Video Take`,
                                    });
                                  }
                                }}
                                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/40 hover:bg-purple-500/35 hover:text-purple-200 transition-colors cursor-pointer shadow-xs"
                                title="Play Omni Flash Master Take"
                              >
                                <Play className="h-2.5 w-2.5 fill-purple-300 text-purple-300" />
                                Omni Flash Master Take
                              </button>
                            )}
                            {isActive && (
                              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] font-mono">
                                Active Scene
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                            <span className="text-xs font-mono text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded border border-border">
                              {durationMinutes} min ({scene.durationSeconds || 180}s)
                            </span>

                            {/* Reorder Buttons */}
                            <div className="flex items-center rounded border border-border bg-secondary/40">
                              <button
                                type="button"
                                disabled={index === 0}
                                onClick={() => handleMoveScene(index, "up")}
                                className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer"
                                title="Move Earlier"
                              >
                                <ChevronUp className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={index === scenes.length - 1}
                                onClick={() => handleMoveScene(index, "down")}
                                className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer border-l border-border"
                                title="Move Later"
                              >
                                <ChevronDown className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            {/* Edit Scene Button */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSceneToEdit(scene)}
                              className="h-8 text-xs font-semibold gap-1.5 border-border hover:border-accent hover:text-accent shadow-2xs"
                              title={`Edit Scene ${scene.sceneNumber} Details & Script`}
                            >
                              <Pencil className="h-3 w-3" />
                              <span>Edit Scene</span>
                            </Button>

                            {/* Open Studio Button */}
                            <Button
                              onClick={() => handleOpenSceneStudio(scene.id)}
                              className={cn(
                                "h-8 text-xs font-semibold gap-1.5 shadow-xs",
                                isBridge
                                  ? "bg-purple-600 hover:bg-purple-500 text-white"
                                  : "bg-accent text-accent-foreground hover:bg-accent/90"
                              )}
                            >
                              <Clapperboard className="h-3.5 w-3.5" />
                              Enter Scene Studio
                            </Button>

                            {/* Delete button */}
                            <button
                              type="button"
                              onClick={() => handleDeleteScene(scene.id)}
                              className="p-1.5 text-muted-foreground hover:text-destructive transition-colors cursor-pointer rounded"
                              title="Delete Scene"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Title & Dramatic Stakes */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm sm:text-base font-bold text-foreground">
                              {scene.title}
                            </h3>
                            {isBridge && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 font-mono font-medium inline-flex items-center gap-1">
                                <Sparkles className="h-2.5 w-2.5 text-purple-400" />
                                AI Transitional Bridge Beat
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {scene.summary || "No synopsis recorded."}
                          </p>
                        </div>

                        {/* Production Details: Location, Budget, Shoot Region & Keyframe */}
                        {(() => {
                          const lockedCandidate = scene.locationCandidates?.find(
                            (c) => c.candidate_id === scene.selectedLocationCandidateId
                          );
                          const currency = currentProject.currency || "USD";
                          const defaultBudget = Math.round(
                            (((currentProject.budgetAllocation?.locationsPct ?? 15) / 100) *
                              (currentProject.budget || 250000)) /
                              Math.max(1, scenes.length)
                          );
                          const effectiveBudget =
                            scene.locationBudget !== undefined ? scene.locationBudget : defaultBudget;

                          return (
                            <div className="flex flex-wrap items-center justify-between gap-3 p-2.5 rounded-lg bg-secondary/35 border border-border/70 text-xs">
                              <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                                {/* Location Setting & Locked Candidate */}
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <MapPin className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                                  {lockedCandidate ? (
                                    <>
                                      <span
                                        onClick={() => setDossierState({ candidate: lockedCandidate, scene })}
                                        className="text-[11px] font-semibold text-foreground cursor-pointer hover:text-accent hover:underline transition-colors"
                                        title="Click to view complete production dossier, acoustics & specs"
                                      >
                                        {cleanCandidateName(lockedCandidate.name)}
                                      </span>
                                      <Badge
                                        variant="outline"
                                        onClick={() => setDossierState({ candidate: lockedCandidate, scene })}
                                        className="text-[9px] py-0 px-1 border-emerald-500/40 bg-emerald-500/10 text-emerald-300 font-mono flex items-center gap-0.5 cursor-pointer hover:bg-emerald-500/20"
                                        title="Click to view venue specs"
                                      >
                                        <CheckCircle2 className="h-2.5 w-2.5 text-emerald-400" />
                                        Locked (${(lockedCandidate.estimated_cost?.day_rate || 0).toLocaleString()}/day)
                                      </Badge>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => setDossierState({ candidate: lockedCandidate, scene })}
                                        className="h-5 px-1.5 text-[10px] gap-1 font-semibold text-accent hover:bg-accent/15 rounded cursor-pointer"
                                        title="Inspect acoustic isolation, electrical Camlock power, permit fees, and film precedents"
                                      >
                                        <FileText className="h-2.5 w-2.5" />
                                        <span>Venue Specs</span>
                                      </Button>
                                    </>
                                  ) : (
                                    <>
                                      <span className="text-[11px] font-semibold text-foreground">
                                        {scene.location || "Set Location"}
                                      </span>
                                      <Badge variant="outline" className="text-[9px] py-0 px-1 text-muted-foreground font-mono">
                                        Not Locked
                                      </Badge>
                                      {scene.locationCandidates && scene.locationCandidates.length > 0 && (
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => {
                                            if (scene.locationCandidates && scene.locationCandidates[0]) {
                                              setDossierState({ candidate: scene.locationCandidates[0], scene });
                                            }
                                          }}
                                          className="h-5 px-1.5 text-[10px] gap-1 font-semibold text-muted-foreground hover:text-accent rounded cursor-pointer"
                                          title="View candidate venue specs"
                                        >
                                          <FileText className="h-2.5 w-2.5" />
                                          <span>{scene.locationCandidates.length} Options</span>
                                        </Button>
                                      )}
                                    </>
                                  )}
                                </div>

                                {/* Shoot Region */}
                                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                  <span className="font-mono text-[10px] uppercase text-muted-foreground/80">Region:</span>
                                  <span className="text-foreground font-medium">
                                    {scene.shootRegion || currentProject.shootRegion || "Production Base"}
                                  </span>
                                </div>

                                {/* Location Budget */}
                                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                  <span className="font-mono text-[10px] uppercase text-muted-foreground/80">Budget:</span>
                                  <span className="text-emerald-400 font-mono font-semibold">
                                    {formatCurrency(effectiveBudget, currency)}
                                  </span>
                                  {scene.locationBudget !== undefined && (
                                    <span className="text-[9px] text-muted-foreground font-mono">(override)</span>
                                  )}
                                </div>
                              </div>

                              {/* Right: Keyframe thumbnail or video take preview */}
                              <div className="flex items-center gap-2 shrink-0">
                                {hasVideoTake && sceneVideoUrl && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setPreviewVideoUrl({
                                        url: sceneVideoUrl,
                                        title: `Scene ${scene.sceneNumber}: ${scene.slugline || scene.title} — Master Video Take`,
                                      })
                                    }
                                    className="h-8 w-14 rounded overflow-hidden border border-purple-500/60 bg-black shrink-0 relative shadow-2xs cursor-pointer group hover:ring-2 hover:ring-purple-400 transition-all flex items-center justify-center"
                                    title="Play Omni Flash Master Take"
                                  >
                                    <video
                                      src={sceneVideoUrl}
                                      className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                      muted
                                      playsInline
                                      preload="metadata"
                                    />
                                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center group-hover:bg-black/10 transition-colors">
                                      <Play className="h-3 w-3 fill-white text-white drop-shadow-md" />
                                    </div>
                                    <span className="absolute bottom-0.5 right-0.5 bg-purple-950/90 text-[7px] font-mono text-purple-300 px-0.5 rounded-xs leading-none">
                                       VIDEO
                                    </span>
                                  </button>
                                )}

                                {lockedCandidate?.preview_image_url && (
                                  <div
                                    onClick={() => setDossierState({ candidate: lockedCandidate, scene })}
                                    className="h-8 w-14 rounded overflow-hidden border border-border/80 bg-black shrink-0 relative shadow-2xs cursor-pointer group hover:ring-1 hover:ring-accent"
                                    title="Click to view 16:9 visual concept look and specs"
                                  >
                                    <img
                                      src={lockedCandidate.preview_image_url}
                                      alt="Keyframe"
                                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })()}

                        {/* Characters Present & Specific Scene Roles */}
                        {scene.castPresent && scene.castPresent.length > 0 && (
                          <div className="space-y-2 pt-1 border-t border-border/40">
                            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                              <Users className="h-3 w-3 text-accent" />
                              Cast in this Scene &amp; Specific Roles:
                            </span>

                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                              {scene.castPresent.map((charName) => {
                                const specificRole = scene.castRoles?.[charName] || "Participant in dramatic conflict";
                                return (
                                  <div
                                    key={charName}
                                    className="rounded-lg border border-border bg-secondary/30 p-2 text-xs flex flex-col gap-0.5"
                                  >
                                    <div className="flex items-center gap-1.5">
                                      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                                      <strong className="text-foreground">{charName}</strong>
                                    </div>
                                    <span className="text-[11px] text-muted-foreground italic line-clamp-1">
                                      &ldquo;{specificRole}&rdquo;
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Connective Tissue: [+ Bridge Scene] between scenes */}
                    {index < scenes.length - 1 && (
                      <div className="flex items-center justify-center my-2 relative">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-dashed border-border" />
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isGeneratingBridge === index}
                          onClick={() => handleOpenBridgeDialog(index)}
                          className="relative z-10 h-7 text-[11px] font-mono gap-1.5 bg-background border-accent/40 text-accent hover:bg-accent/10 px-3 rounded-full shadow-xs"
                        >
                          <Sparkles className={cn("h-3 w-3", isGeneratingBridge === index && "animate-spin")} />
                          {isGeneratingBridge === index ? "Synthesizing Bridge Beat..." : "+ Bridge Scene"}
                        </Button>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            {/* Bottom Add Scene Trigger */}
            <div className="pt-2 flex justify-center">
              <Button
                variant="outline"
                size="lg"
                onClick={() => setIsCreateDialogOpen(true)}
                className="gap-2 border-dashed border-border/80 hover:border-accent hover:text-accent py-6 px-8 rounded-xl text-xs font-semibold"
              >
                <Plus className="h-4 w-4" />
                Add Another Scene to {project.title}
              </Button>
            </div>
              </div>
            )}
        </div>

        {/* TAB 2: STRIPBOARD & SHOOTING SCHEDULE */}
        <div className={activeTab === "stripboard" ? "rounded-xl border border-border bg-card p-4 min-h-[500px]" : "hidden"}>
          <StripboardView
            projectTitle={project.title}
            characters={project.characters}
            screenplayText={project.screenplayText}
            scenes={scenes}
            projectId={project.id}
          />
        </div>

        {/* TAB: LOCATION BOARD & SCOUTING */}
        <div className={activeTab === "locations" ? "min-h-[500px]" : "hidden"}>
          <LocationBoard
            project={currentProject}
            onUpdateProject={(upd) => {
              setCurrentProject(upd);
              setScenes(upd.scenes || []);
              onUpdateProject?.(upd);
            }}
          />
        </div>

        {/* TAB 3: MASTER SCREENPLAY (CONTINUOUS SCRIPT) */}
        <div className={activeTab === "screenplay" ? "rounded-xl border border-border bg-card p-6 space-y-6" : "hidden"}>
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h2 className="text-base font-bold text-foreground">Continuous Master Screenplay</h2>
                <p className="text-xs text-muted-foreground">
                  Complete sequential reading draft compiled from all {scenes.length} scenes.
                </p>
              </div>
              <Button
                onClick={() => handleOpenSceneStudio(activeSceneId || scenes[0]?.id || "vault-sc-03")}
                className="gap-1.5 text-xs bg-accent text-accent-foreground font-semibold"
              >
                <Clapperboard className="h-3.5 w-3.5" />
                Edit in Scene Studio
              </Button>
            </div>

            <div className="space-y-8 max-w-3xl mx-auto font-mono text-xs sm:text-sm leading-relaxed text-foreground/90 bg-secondary/20 p-6 rounded-xl border border-border">
              {scenes.map((s) => (
                <div key={s.id} className="space-y-3">
                  <div className="flex items-center justify-between border-b border-border/60 pb-1">
                    <span className="text-accent font-bold flex items-center gap-2">
                      SCENE {s.sceneNumber}: {s.title}
                      {isBridgeScene(s) && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 uppercase font-mono font-medium">
                          Bridge Scene
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleOpenSceneStudio(s.id)}
                      className="text-[11px] text-muted-foreground hover:text-accent flex items-center gap-1 cursor-pointer"
                    >
                      Open in Studio <ExternalLink className="h-3 w-3" />
                    </button>
                  </div>
                  <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-foreground">
                    {s.screenplayText || `${s.slugline}\n\n[Scene action and dialogue to be written in Scene Studio]`}
                  </pre>
                </div>
              ))}
            </div>
        </div>

        {/* TAB 4: MARKET GROUNDING (CLICKHOUSE) */}
        <div className={activeTab === "market" ? "rounded-xl border border-border bg-card p-6" : "hidden"}>
          <TerritoryHeatmapView
            projectTitle={project.title}
            genre={project.genre}
            logline={project.premise}
            targetTerritories={project.targetTerritories}
          />
        </div>

        {/* TAB 5: SHOWRUNNER AI DIRECTOR */}
        <div className={activeTab === "showrunner" ? "grid grid-cols-1 lg:grid-cols-12 gap-6 items-start" : "hidden"}>
            {/* Left Sidebar: Real-time Sequence Reel State (4 columns on lg) */}
            <div className="lg:col-span-4 space-y-4">
              <div className="rounded-xl border border-border bg-card p-4 space-y-3.5 shadow-sm">
                <div className="flex items-center justify-between border-b border-border pb-2.5">
                  <div className="flex items-center gap-2">
                    <Film className="h-4 w-4 text-accent" />
                    <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                      Sequence Reel ({scenes.length})
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {totalRuntimeMinutes}m Runtime
                  </span>
                </div>

                <div className="space-y-2 max-h-[calc(100vh-380px)] min-h-[260px] overflow-y-auto pr-1">
                  {scenes.map((sc, idx) => (
                    <div
                      key={sc.id}
                      onClick={() => handleOpenSceneStudio(sc.id)}
                      className={cn(
                        "rounded-lg border p-2.5 text-xs transition-all space-y-1.5 cursor-pointer",
                        activeSceneId === sc.id
                          ? "border-accent/60 bg-accent/10"
                          : "border-border/70 bg-secondary/30 hover:border-accent/40 hover:bg-secondary/50"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] font-bold text-accent">
                          SCENE {sc.sceneNumber || idx + 1}
                          {isBridgeScene(sc) && (
                            <span className="ml-1.5 text-[9px] px-1 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase">
                              Bridge
                            </span>
                          )}
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {Math.round((sc.durationSeconds || 180) / 60)}m
                        </span>
                      </div>
                      <div className="font-semibold text-foreground truncate">{sc.title}</div>
                      <div className="text-[11px] font-mono text-muted-foreground truncate">
                        {sc.slugline}
                      </div>
                      {sc.castPresent && sc.castPresent.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {sc.castPresent.map((c) => (
                            <span
                              key={c}
                              className="text-[9px] px-1.5 py-0.2 rounded bg-background/80 border border-border text-muted-foreground font-mono"
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-border/60">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsCreateDialogOpen(true)}
                    className="w-full text-xs font-medium gap-1.5 border-dashed hover:border-accent hover:text-accent"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Scene Manually
                  </Button>
                </div>
              </div>

              {/* Quick Directives / Macro Audits */}
              <div className="rounded-xl border border-border bg-card p-4 space-y-2.5 shadow-sm">
                <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-muted-foreground block">
                  One-Click Sequence Directives
                </span>
                <div className="grid grid-cols-1 gap-1.5 text-left">
                  <button
                    type="button"
                    onClick={() => handleSendShowrunner("Audit franchise continuity and character logic across all scenes")}
                    className="p-2.5 text-left text-xs rounded-lg border border-border/80 bg-secondary/20 hover:bg-accent/10 hover:border-accent/40 transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <div>
                      <div className="font-medium text-foreground">🔍 Audit Continuity</div>
                      <div className="text-[10px] text-muted-foreground font-mono">Cross-scene narrative check</div>
                    </div>
                    <Sparkles className="h-3.5 w-3.5 text-accent shrink-0" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendShowrunner("Analyze sequence pacing and suggest where a bridge scene is needed to build tension")}
                    className="p-2.5 text-left text-xs rounded-lg border border-border/80 bg-secondary/20 hover:bg-accent/10 hover:border-accent/40 transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <div>
                      <div className="font-medium text-foreground">⚡ Pacing &amp; Bridge Audit</div>
                      <div className="text-[10px] text-muted-foreground font-mono">Tension curve analysis</div>
                    </div>
                    <Sparkles className="h-3.5 w-3.5 text-accent shrink-0" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendShowrunner("Break down the shooting schedule, night shoots, and stunt risk for these scenes")}
                    className="p-2.5 text-left text-xs rounded-lg border border-border/80 bg-secondary/20 hover:bg-accent/10 hover:border-accent/40 transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <div>
                      <div className="font-medium text-foreground">📋 Production Breakdown</div>
                      <div className="text-[10px] text-muted-foreground font-mono">Stripboard &amp; risk factors</div>
                    </div>
                    <Sparkles className="h-3.5 w-3.5 text-accent shrink-0" />
                  </button>
                </div>
              </div>
            </div>

            {/* Right Main Panel: Showrunner AI Chat Console (8 columns on lg) */}
            <div className="lg:col-span-8 h-[calc(100vh-210px)] min-h-[640px]">
              <ShowrunnerChat
                messages={showrunnerMessages}
                isThinking={isShowrunnerThinking}
                onSendMessage={handleSendShowrunner}
                onResetChat={() => {
                  setShowrunnerMessages([
                    {
                      role: "showrunner",
                      content: `Session refreshed. I'm your Showrunner co-pilot for "${project.title}". How would you like to develop the reel or character dynamics next?`,
                    },
                  ]);
                }}
                title="Showrunner AI Director"
                subtitle="Story & Sequence Co-Pilot · Multi-Scene Chronology & Narrative Continuity"
                badgeLabel="Collaborative Mode"
                placeholder="Talk with Showrunner AI (e.g. brainstorm scene ideas, pacing, dialogue, or sequence changes)..."
                suggestedPrompts={[
                  "Insert a high-tension bridge scene between Scene 1 and Scene 2",
                  "How can we raise the emotional stakes across the midpoint?",
                  "Audit continuity and character logic across all scenes",
                  "Pitch a surprise complication to open the climax",
                  "Synthesize an emotional fallout scene after the breach",
                ]}
                className="h-full shadow-sm"
              />
            </div>
        </div>
      </main>

      {/* Dedicated Project Settings / Edit Project Dialog */}
      <EditProjectDialog
        open={isProjectEditDialogOpen}
        onOpenChange={setIsProjectEditDialogOpen}
        project={currentProject}
        onSaveProject={handleUpdateProject}
      />

      {/* Dedicated Scene Creation & Editing Dialog */}
      <CreateSceneDialog
        open={isCreateDialogOpen || sceneToEdit !== null}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateDialogOpen(false);
            setSceneToEdit(null);
          }
        }}
        projectTitle={currentProject.title}
        projectCharacters={currentProject.characters || []}
        nextSceneNumber={scenes.length + 1}
        onAddScene={handleAddScene}
        sceneToEdit={sceneToEdit}
        onUpdateScene={handleUpdateScene}
        existingScenes={scenes}
      />

      {/* Dedicated Bridge Scene Dialog (AI Guided or Blank) */}
      <BridgeSceneDialog
        open={bridgeDialogIndex !== null}
        onOpenChange={(open) => {
          if (!open) setBridgeDialogIndex(null);
        }}
        prevScene={bridgeDialogIndex !== null ? scenes[bridgeDialogIndex] || null : null}
        nextScene={bridgeDialogIndex !== null ? scenes[bridgeDialogIndex + 1] || null : null}
        targetIndex={bridgeDialogIndex}
        projectTitle={currentProject.title}
        projectCharacters={currentProject.characters || []}
        isGenerating={isGeneratingBridge !== null}
        onGenerateAI={handleGenerateBridgeAI}
        onInsertBlank={handleInsertBlankBridge}
      />

      {/* Location Production Dossier & Specs Dialog */}
      <LocationDossierDialog
        candidate={dossierState?.candidate || null}
        isOpen={Boolean(dossierState)}
        onClose={() => setDossierState(null)}
        currency={currentProject.currency || "USD"}
        scene={dossierState?.scene}
        isLocked={
          dossierState
            ? dossierState.scene.selectedLocationCandidateId === dossierState.candidate.candidate_id
            : false
        }
        onLockCandidate={(cand) => {
          if (!dossierState) return;
          const updatedScene: FilmScene = {
            ...dossierState.scene,
            selectedLocationCandidateId: cand.candidate_id,
            location: cleanCandidateName(cand.name),
          };
          handleUpdateScene(updatedScene, false);
        }}
        onUnlockCandidate={() => {
          if (!dossierState) return;
          const updatedScene: FilmScene = {
            ...dossierState.scene,
            selectedLocationCandidateId: undefined,
          };
          handleUpdateScene(updatedScene, false);
        }}
      />

      {/* Video Preview Modal */}
      {previewVideoUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in"
          onClick={() => setPreviewVideoUrl(null)}
        >
          <div
            className="relative w-full max-w-4xl bg-card border border-purple-500/40 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-card/90">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-purple-500 animate-pulse" />
                <span className="font-mono text-sm font-semibold text-foreground">
                  {previewVideoUrl.title}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewVideoUrl(null)}
                className="text-muted-foreground hover:text-foreground text-sm font-mono px-2 py-1 rounded hover:bg-secondary transition-colors cursor-pointer"
              >
                ✕ Close
              </button>
            </div>
            <div className="relative aspect-video bg-black flex items-center justify-center">
              <video
                src={previewVideoUrl.url}
                controls
                autoPlay
                className="w-full h-full object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
