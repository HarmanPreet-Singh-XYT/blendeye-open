"use client";

import * as React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  type Edge,
  type Node,
  type Connection,
  useNodesState,
  useEdgesState,
  addEdge,
} from "@xyflow/react";
import { StoryCanvas } from "@/components/cinema/story-canvas";
import {
  TimelineScrubber,
  formatTimecode,
  type StoryEventMarker,
} from "@/components/cinema/timeline-scrubber";
import {
  HotSeatChat,
  type HotSeatTurn,
  type KnowledgeFact,
} from "@/components/cinema/hot-seat-chat";
import { ShowrunnerChat } from "@/components/cinema/showrunner-chat";
import { MarkdownRenderer } from "@/components/cinema/markdown-renderer";
import {
  NewProjectDialog,
  type NewProjectFormData,
} from "@/components/cinema/new-project-dialog";
import { FilmFusionDialog } from "@/components/cinema/film-fusion-dialog";
import { ScreenplayDialog } from "@/components/cinema/screenplay-dialog";
import { CreateSceneDialog } from "@/components/cinema/create-scene-dialog";
import { EditProjectDialog } from "@/components/cinema/edit-project-dialog";
import { FloorPlanView, type FloorPlanMapConfig } from "@/components/cinema/floor-plan-view";
import { TensionCurveView } from "@/components/cinema/tension-curve-view";
import { ProjectScenesPage, isBridgeScene } from "@/components/cinema/project-scenes-page";
import { TableReadPlayer } from "@/components/cinema/table-read-player";
import {
  MultiverseTakesDialog,
  type MultiverseTake,
} from "@/components/cinema/multiverse-takes-dialog";
import { ContinuityCheckerDialog } from "@/components/cinema/continuity-checker-dialog";
import { VersionControlDialog } from "@/components/cinema/version-control-dialog";
import { AICommanderDialog } from "@/components/cinema/ai-commander-dialog";
import { ClickHouseToolboxDialog } from "@/components/cinema/clickhouse-toolbox-dialog";
import { AudioStudioView } from "@/components/cinema/audio-studio-view";
import { VideoGenerationDialog } from "@/components/cinema/video-generation-dialog";
import { GenerationStudioView } from "@/components/cinema/generation-studio-view";
import { LocationDossierDialog } from "@/components/cinema/location-dossier-dialog";
import { DirectorLookbookDialog } from "@/components/cinema/director-lookbook-dialog";
import { CharacterLabDialog } from "@/components/cinema/character-lab-dialog";
import { ScratchpadDialog } from "@/components/cinema/scratchpad-dialog";
import { AssetHubDialog } from "@/components/cinema/asset-hub-dialog";
import { AuthUserButton } from "@/components/cinema/auth-user-button";
import { getLocalAssets } from "@/lib/asset-store";
import { toast } from "@/components/ui/toast";
import { notifyIfFallback } from "@/lib/fallback-notice";
import {
  StudioVersionControl,
  type SnapshotState,
  type HistoryCategory,
} from "@/lib/version-control";
import { autoTidyBacklot } from "@/lib/backlot-layout";
import { executeStudioActions } from "@/lib/studio-commander";
import type { CommanderExecutionResponse } from "@/lib/studio-actions";
import type { ExtendedShowrunnerMessage } from "@/components/cinema/showrunner-chat";
import {
  ClickHouseInspector,
  type ClickHouseQueryLog,
} from "@/components/cinema/clickhouse-inspector";
import { SlateLabel } from "@/components/cinema/slate-label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { usePanelRef } from "react-resizable-panels";
import { StudioInspector } from "@/components/cinema/studio-inspector";
import { cn } from "@/lib/utils";
import {
  Film,
  Clapperboard,
  Sparkles,
  Bot,
  UserCheck,
  FileText,
  Plus,
  ArrowLeft,
  Shuffle,
  Database,
  Sliders,
  Layers,
  MapPin,
  Volume2,
  Headphones,
  Video,
  Users2,
  Flame,
  Square,
  Rows,
  PanelBottom,
  PanelBottomClose,
  PanelBottomOpen,
  Maximize2,
  Minimize2,
  RefreshCw,
  Loader2,
  History,
  RotateCcw,
  RotateCw,
  Zap,
  ChevronDown,
  Check,
  Cpu,
  Activity,
  Camera,
  MessageSquare,
  Clock,
  Timer,
  Milestone,
  ShieldAlert,
  Settings2,
  Pencil,
} from "lucide-react";
import type { ShowrunnerMessage } from "@/lib/agent-service";
import {
  getAllProjects,
  getProjectById,
  saveProject,
  createNewProjectEntry,
  buildProjectNodesAndEdges,
  rehydrateNodeCallbacks,
  type ProjectData,
  type ProjectCharacter,
  type NarrativeFormat,
  type FilmScene,
  ensureProjectScenes,
  NARRATIVE_FORMATS,
  updateProjectTimeframe,
  type NodeCallbacks,
  getActiveUserId,
  getActiveAuthToken,
  getAuthHeaders,
} from "@/lib/project-store";
import { ProjectTimeframeDialog } from "@/components/cinema/project-timeframe-dialog";
import { SceneLocationDock } from "@/components/cinema/scene-location-dock";
import { cleanCandidateName } from "@/components/cinema/location-board";
import { AuthGate } from "@/components/cinema/auth-gate";

type MainStudioTab = "planning" | "simulation" | "generation" | "showrunner";
type SimulationSubTab = "audio" | "hotseat" | "chemistry";
type DeckSubTab = "blocking" | "location" | "tension";

function StudioWorkspace() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawProjectId = (params?.projectId as string) || "";
  const routeSceneId = params?.sceneId as string | undefined;
  const shouldAutoRunPipeline = searchParams?.get("pipeline") === "1";

  // Load project from persistent store (or seed presets)
  const foundProject = React.useMemo(() => {
    if (!rawProjectId) return null;
    return getProjectById(rawProjectId);
  }, [rawProjectId]);

  const initialProject: ProjectData =
    foundProject || {
      id: rawProjectId || "unknown",
      title: "Untitled Production",
      genre: "Drama",
      premise: "",
      sceneTitle: "",
      sceneSummary: "",
      screenplayText: "",
      characters: [],
      initialEvents: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  const isProjectNotFound = !foundProject;

  // Dedicated View Mode: "scenes" (Dedicated Project Overview & Scenes Sequence) vs "studio" (Scene Studio Workspace)
  const [pageViewMode, setPageViewMode] = React.useState<"scenes" | "studio">(() => {
    if (routeSceneId) return "studio";
    if (searchParams?.get("studio") === "1" || searchParams?.get("scene") || searchParams?.get("hotSeat")) {
      return "studio";
    }
    return "scenes";
  });

  // Core Production State
  const [projectId, setProjectId] = React.useState(initialProject.id);
  const [projectTitle, setProjectTitle] = React.useState(initialProject.title);
  const [genre, setGenre] = React.useState(initialProject.genre);
  const [premiseInput, setPremiseInput] = React.useState(initialProject.premise);
  const [sceneTitle, setSceneTitle] = React.useState(initialProject.sceneTitle);
  const [sceneSummary, setSceneSummary] = React.useState(initialProject.sceneSummary);
  const [screenplayText, setScreenplayText] = React.useState(initialProject.screenplayText);
  const [characters, setCharacters] = React.useState<ProjectCharacter[]>(initialProject.characters);
  const [activeCharacterName, setActiveCharacterName] = React.useState<string>(
    initialProject.characters[0]?.name || "Marcus"
  );

  // Timeframe Scope & Narrative Placement State
  const [timeframeModalOpen, setTimeframeModalOpen] = React.useState(false);
  const [narrativeFormat, setNarrativeFormat] = React.useState<NarrativeFormat>(
    initialProject.narrativeFormat || "feature"
  );
  const [targetRuntimeMinutes, setTargetRuntimeMinutes] = React.useState<number>(
    initialProject.targetRuntimeMinutes || 95
  );
  const [scenePlacementSeconds, setScenePlacementSeconds] = React.useState<number>(
    initialProject.scenePlacementSeconds ?? 34 * 60
  );
  const [sceneDurationSeconds, setSceneDurationSeconds] = React.useState<number>(
    initialProject.sceneDurationSeconds ?? 6 * 60
  );
  const [directorStyle, setDirectorStyle] = React.useState<string>(
    initialProject.directorStyle || ""
  );
  const [coreSecret, setCoreSecret] = React.useState<string>(
    initialProject.coreSecret || ""
  );
  const [primaryLocation, setPrimaryLocation] = React.useState<string>(
    initialProject.primaryLocation || ""
  );
  const [targetTerritories, setTargetTerritories] = React.useState<string[]>(
    initialProject.targetTerritories || []
  );
  const durationSeconds = targetRuntimeMinutes * 60;

  // Multi-Scene Sequence Reel State
  const [scenes, setScenes] = React.useState<FilmScene[]>(() => {
    const norm = ensureProjectScenes(initialProject);
    return norm.scenes || [];
  });
  const scenesRef = React.useRef<FilmScene[]>(scenes);
  React.useEffect(() => {
    scenesRef.current = scenes;
  }, [scenes]);

  const [activeSceneId, setActiveSceneId] = React.useState<string>(() => {
    if (routeSceneId) return routeSceneId;
    const queryScene = searchParams?.get("scene");
    if (queryScene) return queryScene;
    const norm = ensureProjectScenes(initialProject);
    return norm.activeSceneId || norm.scenes?.[0]?.id || "vault-sc-03";
  });
  // Tracks the live active scene so long-running async work (e.g. runFullPipeline)
  // can tell whether the user has since navigated away, instead of relying on
  // a stale closure over activeSceneId captured before any await.
  const activeSceneIdRef = React.useRef<string>(activeSceneId);
  React.useEffect(() => {
    activeSceneIdRef.current = activeSceneId;
  }, [activeSceneId]);

  const [projectSettingsOpen, setProjectSettingsOpen] = React.useState(false);
  const [sceneSettingsOpen, setSceneSettingsOpen] = React.useState(false);
  const [dossierCandidate, setDossierCandidate] = React.useState<any>(null);
  const [dossierOpen, setDossierOpen] = React.useState<boolean>(false);

  // Slates list for navigation
  const [allProjects, setAllProjects] = React.useState<ProjectData[]>([]);

  React.useEffect(() => {
    setAllProjects(getAllProjects());
  }, [projectId]);

  const isMountedRef = React.useRef(false);
  const hasLocalEditRef = React.useRef(false);
  React.useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      return;
    }
    hasLocalEditRef.current = true;
  }, [scenes, activeSceneId, screenplayText]);

  // Warm up agent-service sidecar on studio open to eliminate container/serverless cold starts
  React.useEffect(() => {
    fetch("/api/health").catch(() => {
      // Non-blocking fire-and-forget ping to wake agent-service
    });
  }, []);

  // When logged in, hydrate from Supabase Cloud once at mount only — cloud is
  // the source of truth for authenticated users, but this must never fire
  // after the user starts editing (see hasLocalEditRef above), and must only
  // ever apply on top of the scene/state shape already loaded locally, not
  // force-navigate the user to a different active scene.
  React.useEffect(() => {
    if (!rawProjectId) return;
    const uid = getActiveUserId();
    const token = getActiveAuthToken();
    if (!uid || !token) return;

    let cancelled = false;
    fetch(`/api/projects/${encodeURIComponent(rawProjectId)}`, {
      headers: getAuthHeaders(),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || hasLocalEditRef.current) return;
        if (data?.project) {
          const cloudProj = ensureProjectScenes(data.project);
          saveProject(cloudProj);
          setAllProjects(getAllProjects());
          if (cloudProj.scenes && cloudProj.scenes.length > 0) {
            setScenes(cloudProj.scenes);
          }
          // videoTakes/activeVideoUrl live top-level on ProjectData and are
          // read directly by GenerationStudioView from project-store, which
          // may have already initialized its state before this fetch
          // resolved. Notify listeners so they can re-read fresh data.
          window.dispatchEvent(
            new CustomEvent("agentic_cinema_project_hydrated", { detail: { projectId: rawProjectId } })
          );
        }
      })
      .catch((e) => console.warn("[StudioPage] Cloud project sync note:", e));

    return () => {
      cancelled = true;
    };
  }, [rawProjectId]);

  // Ref to hold nodeCallbacks for effects running before/during state initialization
  const nodeCallbacksRef = React.useRef<NodeCallbacks>({});

  // Synchronize state when initialProject changes
  React.useEffect(() => {
    if (initialProject) {
      const normalized = ensureProjectScenes(initialProject);
      setProjectId(normalized.id);
      setProjectTitle(normalized.title);
      setGenre(normalized.genre);
      setPremiseInput(normalized.premise);
      setCharacters(normalized.characters);
      setActiveCharacterName(normalized.characters[0]?.name || "Marcus");
      setEvents(normalized.initialEvents || []);
      setNarrativeFormat(normalized.narrativeFormat || "feature");
      setTargetRuntimeMinutes(normalized.targetRuntimeMinutes || 95);
      setDirectorStyle(normalized.directorStyle || "");
      setCoreSecret(normalized.coreSecret || "");
      setTargetTerritories(normalized.targetTerritories || []);

      const nextScenes = normalized.scenes || [];
      setScenes(nextScenes);
      const nextActiveId = normalized.activeSceneId || nextScenes[0]?.id || "";
      setActiveSceneId(nextActiveId);

      const targetSc = nextScenes.find((s) => s.id === nextActiveId) || nextScenes[0];
      if (targetSc) {
        setSceneTitle(targetSc.title || "");
        setSceneSummary(targetSc.summary || "");
        setScreenplayText(targetSc.screenplayText || "");
        setPrimaryLocation(targetSc.location || "");
        setScenePlacementSeconds(targetSc.startSeconds || 0);
        setTimeSeconds(targetSc.startSeconds || 0);
        setSceneDurationSeconds(targetSc.durationSeconds || 120);
        if (targetSc.nodes !== undefined) {
          setNodes(rehydrateNodeCallbacks(targetSc.nodes, nodeCallbacksRef.current));
        }
        if (targetSc.edges !== undefined) {
          setEdges(targetSc.edges);
        }
        if (targetSc.events !== undefined) {
          setEvents(targetSc.events);
        }
        setFloorPlanCustomMapUrl(targetSc.floorPlanMapUrl || normalized.floorPlanMapUrl || null);
        setFloorPlanCustomMapName(targetSc.floorPlanMapName || normalized.floorPlanMapName || undefined);
        setFloorPlanCustomMapConfig(targetSc.floorPlanMapConfig || normalized.floorPlanMapConfig || undefined);
      } else {
        setSceneTitle(normalized.sceneTitle);
        setSceneSummary(normalized.sceneSummary);
        setScreenplayText(normalized.screenplayText);
        setPrimaryLocation(normalized.primaryLocation || "");
        setFloorPlanCustomMapUrl(normalized.floorPlanMapUrl || null);
        setFloorPlanCustomMapName(normalized.floorPlanMapName || undefined);
        setFloorPlanCustomMapConfig(normalized.floorPlanMapConfig || undefined);
        const placement = normalized.scenePlacementSeconds ?? 34 * 60;
        setScenePlacementSeconds(placement);
        setTimeSeconds(placement);
        setSceneDurationSeconds(normalized.sceneDurationSeconds ?? 6 * 60);
      }
    }
  }, [initialProject]);

  const handleSaveTimeframe = (updates: {
    targetRuntimeMinutes: number;
    narrativeFormat: NarrativeFormat;
    scenePlacementSeconds: number;
    sceneDurationSeconds: number;
    directorStyle?: string;
    coreSecret?: string;
    primaryLocation?: string;
    targetTerritories?: string[];
    genre?: string;
  }) => {
    setTargetRuntimeMinutes(updates.targetRuntimeMinutes);
    setNarrativeFormat(updates.narrativeFormat);
    setScenePlacementSeconds(updates.scenePlacementSeconds);
    setSceneDurationSeconds(updates.sceneDurationSeconds);
    setTimeSeconds(updates.scenePlacementSeconds);
    if (updates.directorStyle !== undefined) setDirectorStyle(updates.directorStyle);
    if (updates.coreSecret !== undefined) setCoreSecret(updates.coreSecret);
    if (updates.primaryLocation !== undefined) setPrimaryLocation(updates.primaryLocation);
    if (updates.targetTerritories !== undefined) setTargetTerritories(updates.targetTerritories);
    if (updates.genre !== undefined) setGenre(updates.genre);

    updateProjectTimeframe(projectId, updates);
    setAllProjects(getAllProjects());
  };

  const handleExtendRuntime = (minutes = 15) => {
    setTargetRuntimeMinutes((prev) => {
      const next = Math.min(240, prev + minutes);
      updateProjectTimeframe(projectId, { targetRuntimeMinutes: next });
      setAllProjects(getAllProjects());
      return next;
    });
  };

  const handleShrinkRuntime = (minutes = 15) => {
    setTargetRuntimeMinutes((prev) => {
      const next = Math.max(2, prev - minutes);
      const nextDuration = next * 60;
      if (scenePlacementSeconds > nextDuration) {
        const clamped = Math.max(0, nextDuration - sceneDurationSeconds);
        setScenePlacementSeconds(clamped);
        updateProjectTimeframe(projectId, {
          targetRuntimeMinutes: next,
          scenePlacementSeconds: clamped,
        });
      } else {
        updateProjectTimeframe(projectId, { targetRuntimeMinutes: next });
      }
      setAllProjects(getAllProjects());
      return next;
    });
  };

  // Timeline & Interrogation State
  const [timeSeconds, setTimeSeconds] = React.useState(initialProject.scenePlacementSeconds ?? 34 * 60);
  const [events, setEvents] = React.useState<StoryEventMarker[]>(initialProject.initialEvents || []);
  const [knownFacts, setKnownFacts] = React.useState<KnowledgeFact[]>([]);
  const [hotSeatTurns, setHotSeatTurns] = React.useState<HotSeatTurn[]>([]);

  // Showrunner Chat & Central AI Commander State
  const [showrunnerMessages, setShowrunnerMessages] = React.useState<ExtendedShowrunnerMessage[]>([]);
  const [isShowrunnerThinking, setIsShowrunnerThinking] = React.useState(false);
  const [aiCommanderOpen, setAiCommanderOpen] = React.useState(false);

  // Chemistry Bench State
  const [chemistryScenario, setChemistryScenario] = React.useState(
    "Stuck in a broken service elevator with a ticking 2-minute security countdown"
  );
  const [chemistrySceneOutput, setChemistrySceneOutput] = React.useState<string>("");
  const [isChemistryRunning, setIsChemistryRunning] = React.useState(false);

  // 3-Tab Director Architecture: Planning | Simulation | Generation
  const [mainTab, setMainTab] = React.useState<MainStudioTab>("planning");
  const [simulationTab, setSimulationTab] = React.useState<SimulationSubTab>("audio");
  const [deckSubTab, setDeckSubTab] = React.useState<DeckSubTab>("blocking");

  // Deep link from elsewhere in the app (e.g. dashboard Character Lab "Talk to this
  // character" action) straight into Hot Seat for a specific character.
  React.useEffect(() => {
    const requestedChar = searchParams.get("hotSeat");
    if (requestedChar) {
      setActiveCharacterName(requestedChar);
      setMainTab("simulation");
      setSimulationTab("hotseat");
    }
    // Only consult the deep-link param once on mount — later param changes aren't re-navigations.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard Shortcuts (Shift+1 for Planning, Shift+2 for Simulation, Shift+3 for Generation, Shift+C for ClickHouse)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.shiftKey) {
        if (e.key === "1") {
          e.preventDefault();
          setMainTab("planning");
        } else if (e.key === "2") {
          e.preventDefault();
          setMainTab("simulation");
        } else if (e.key === "3") {
          e.preventDefault();
          setMainTab("generation");
        } else if (e.key === "4") {
          e.preventDefault();
          setMainTab("showrunner");
        } else if (e.key.toLowerCase() === "c") {
          e.preventDefault();
          setIsClickHouseInspectorOpen((prev) => !prev);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // UI Navigation & Modals
  const [newProjectOpen, setNewProjectOpen] = React.useState(false);
  const [isGeneratingProject, setIsGeneratingProject] = React.useState(false);
  const [fusionOpen, setFusionOpen] = React.useState(false);
  const [multiverseOpen, setMultiverseOpen] = React.useState(false);
  const [continuityOpen, setContinuityOpen] = React.useState(false);
  const [scriptViewerOpen, setScriptViewerOpen] = React.useState(false);
  const [showTableRead, setShowTableRead] = React.useState(false);
  const [versionControlOpen, setVersionControlOpen] = React.useState(false);
  const [clickhouseToolboxOpen, setClickhouseToolboxOpen] = React.useState(false);
  const [videoGenOpen, setVideoGenOpen] = React.useState(false);
  const [videoCharacterContext, setVideoCharacterContext] = React.useState<ProjectCharacter | null>(null);
  const [lookbookOpen, setLookbookOpen] = React.useState(false);
  const [characterLabOpen, setCharacterLabOpen] = React.useState(false);
  const [scratchpadOpen, setScratchpadOpen] = React.useState(false);
  const [assetHubOpen, setAssetHubOpen] = React.useState(false);
  const initialFloorPlanMap = React.useMemo(() => {
    const norm = ensureProjectScenes(initialProject);
    const curSc = norm.scenes?.find((s) => s.id === activeSceneId) || norm.scenes?.[0];
    return {
      url: curSc?.floorPlanMapUrl || initialProject.floorPlanMapUrl || null,
      name: curSc?.floorPlanMapName || initialProject.floorPlanMapName || undefined,
      config: curSc?.floorPlanMapConfig || initialProject.floorPlanMapConfig || undefined,
    };
  }, [initialProject, activeSceneId]);

  const [floorPlanCustomMapUrl, setFloorPlanCustomMapUrl] = React.useState<string | null>(
    initialFloorPlanMap.url
  );
  const [floorPlanCustomMapName, setFloorPlanCustomMapName] = React.useState<string | undefined>(
    initialFloorPlanMap.name
  );
  const [floorPlanCustomMapConfig, setFloorPlanCustomMapConfig] = React.useState<FloorPlanMapConfig | undefined>(
    initialFloorPlanMap.config
  );
  const [stagedCameraMotion, setStagedCameraMotion] = React.useState<string>("");
  const [stagedPromptNote, setStagedPromptNote] = React.useState<string>("");

  const handleSendStagingToVideo = React.useCallback(
    (camData: { camName: string; lens: string; motion: string; promptNote: string }) => {
      setStagedCameraMotion(camData.motion);
      setStagedPromptNote(camData.promptNote);
      setMainTab("generation");
    },
    []
  );

  const [vcs, setVcs] = React.useState<StudioVersionControl | null>(null);
  const [canUndo, setCanUndo] = React.useState(false);
  const [canRedo, setCanRedo] = React.useState(false);
  const [vcsHistoryCount, setVcsHistoryCount] = React.useState(0);

  // Pipeline Status & Logs
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [generationStage, setGenerationStage] = React.useState<string>("");
  const pipelineAbortRef = React.useRef<AbortController | null>(null);
  const [isAsking, setIsAsking] = React.useState(false);
  const [queryLogs, setQueryLogs] = React.useState<ClickHouseQueryLog[]>([]);
  const [lastSql, setLastSql] = React.useState<string>("");
  const [isClickHouseInspectorOpen, setIsClickHouseInspectorOpen] = React.useState(false);
  const [inspectorTab, setInspectorTab] = React.useState<"clickhouse" | "grafana">("clickhouse");

  const activeCharacter = characters.find((c) => c.name === activeCharacterName) || characters[0];

  // Log ClickHouse Queries
  const logClickHouseQuery = React.useCallback(
    (sql: string, type: ClickHouseQueryLog["type"], durationMs?: number) => {
      setLastSql(sql);
      setQueryLogs((prev) => [
        {
          id: Math.random().toString(36).substring(2, 9),
          timestamp: new Date().toLocaleTimeString(),
          sql,
          durationMs,
          type,
        },
        ...prev.slice(0, 24),
      ]);
    },
    []
  );

  // Query ClickHouse Knowledge State
  const fetchKnowledge = React.useCallback(
    async (pid: string, charName: string, seconds: number) => {
      const timecode = formatTimecode(seconds);
      const start = performance.now();
      try {
        const res = await fetch(
          `/api/hot-seat/knowledge?projectId=${encodeURIComponent(pid)}&characterName=${encodeURIComponent(
            charName
          )}&currentTimestamp=${encodeURIComponent(timecode)}`
        );
        if (res.ok) {
          const data = await res.json();
          setKnownFacts(data.known_facts || []);
          if (data.query_sql) {
            const elapsed = Math.round(performance.now() - start);
            logClickHouseQuery(data.query_sql, "scrub", elapsed);
          }
        }
      } catch (err) {
        console.error("Knowledge query error:", err);
      }
    },
    [logClickHouseQuery]
  );

  // Fetch Event Markers from ClickHouse
  const fetchProjectEvents = React.useCallback(async (pid: string) => {
    try {
      const res = await fetch(`/api/events?projectId=${encodeURIComponent(pid)}`);
      if (res.ok) {
        const rawEvents = await res.json();
        if (Array.isArray(rawEvents) && rawEvents.length > 0) {
          const parsed: StoryEventMarker[] = rawEvents.map(
            (ev: {
              event_timestamp: string;
              character_name: string;
              event_type: StoryEventMarker["eventType"];
            }) => {
              const parts = ev.event_timestamp.split(":").map(Number);
              const totalSec = (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
              return {
                atSeconds: totalSec,
                characterName: ev.character_name,
                eventType: ev.event_type,
              };
            }
          );
          setEvents(parsed);
        }
      }
    } catch (err) {
      console.error("Events fetch error:", err);
    }
  }, []);

  React.useEffect(() => {
    fetchKnowledge(projectId, activeCharacterName, timeSeconds);
  }, [projectId, activeCharacterName, timeSeconds, fetchKnowledge]);

  React.useEffect(() => {
    fetchProjectEvents(projectId);
  }, [projectId, fetchProjectEvents]);

  // Dialogue Insertion Micro-Interaction
  const handleInsertIntoScript = (characterName: string, dialogue: string) => {
    const formatted = `\n\n${characterName.toUpperCase()}\n(interrogation alternate)\n${dialogue}\n`;
    setScreenplayText((prev) => {
      const updated = prev + formatted;
      saveCurrentProject({ screenplayText: updated });
      return updated;
    });
  };

  // Helper to persist current state
  const saveCurrentProject = React.useCallback(
    (partial?: Partial<ProjectData>) => {
      const existingProject = getProjectById(projectId) || initialProject;
      const effectiveScenes = partial?.scenes || (scenesRef.current.length > 0 ? scenesRef.current : (existingProject?.scenes || []));
      const effectiveActiveSceneId = partial?.activeSceneId || activeSceneId || effectiveScenes[0]?.id || "";

      const proj: ProjectData = {
        ...existingProject,
        id: projectId,
        title: projectTitle,
        genre: genre,
        premise: premiseInput,
        sceneTitle: sceneTitle,
        sceneSummary: sceneSummary,
        screenplayText: screenplayText,
        characters: characters,
        initialEvents: events,
        nodes: nodesRef.current,
        edges: edgesRef.current,
        createdAt: existingProject?.createdAt || initialProject.createdAt,
        updatedAt: Date.now(),
        isCustom: existingProject?.isCustom ?? initialProject.isCustom,
        isStarred: existingProject?.isStarred ?? initialProject.isStarred,
        directorStyle: directorStyle,
        coreSecret: coreSecret,
        primaryLocation: primaryLocation,
        floorPlanMapUrl: floorPlanCustomMapUrl || undefined,
        floorPlanMapName: floorPlanCustomMapName || undefined,
        floorPlanMapConfig: floorPlanCustomMapConfig || undefined,
        targetTerritories: targetTerritories,
        narrativeFormat: narrativeFormat,
        targetRuntimeMinutes: targetRuntimeMinutes,
        scenePlacementSeconds: scenePlacementSeconds,
        sceneDurationSeconds: sceneDurationSeconds,
        scenes: effectiveScenes.map((s) =>
          s.id === effectiveActiveSceneId
            ? {
                ...s,
                nodes: nodesRef.current,
                edges: edgesRef.current,
                floorPlanMapUrl: floorPlanCustomMapUrl || undefined,
                floorPlanMapName: floorPlanCustomMapName || undefined,
                floorPlanMapConfig: floorPlanCustomMapConfig || undefined,
              }
            : s
        ),
        activeSceneId: effectiveActiveSceneId,
        ...partial,
      };
      saveProject(proj);
      setAllProjects(getAllProjects());
    },
    [
      projectId,
      projectTitle,
      genre,
      premiseInput,
      sceneTitle,
      sceneSummary,
      screenplayText,
      characters,
      events,
      initialProject,
      directorStyle,
      coreSecret,
      primaryLocation,
      floorPlanCustomMapUrl,
      floorPlanCustomMapName,
      floorPlanCustomMapConfig,
      targetTerritories,
      narrativeFormat,
      targetRuntimeMinutes,
      scenePlacementSeconds,
      sceneDurationSeconds,
      activeSceneId,
    ]
  );

  React.useEffect(() => {
    saveCurrentProjectRef.current = saveCurrentProject;
  }, [saveCurrentProject]);

  // Chemistry Test Execution
  const handleRunChemistry = async () => {
    if (isChemistryRunning) return;
    setIsChemistryRunning(true);
    const charA = characters[0] || { name: "Lead", archetype: "Protagonist" };
    const charB = characters[1] || characters[0] || { name: "Counterpart", archetype: "Antagonist" };

    try {
      const res = await fetch("/api/character/chemistry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          char_a_name: charA.name,
          char_a_dna: `${charA.name}: ${charA.archetype}, ${charA.speechStyle || "naturalistic"}`,
          char_b_name: charB.name,
          char_b_dna: `${charB.name}: ${charB.archetype}, ${charB.speechStyle || "measured"}`,
          scenario: chemistryScenario,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setChemistrySceneOutput(data.micro_scene);
        setMainTab("simulation");
        setSimulationTab("chemistry");
        notifyIfFallback(data, "Chemistry Test");
      } else {
        const detail = await res.text().catch(() => "");
        toast.add({
          title: "Chemistry test failed",
          description: detail || `Request failed (${res.status}). Try again.`,
          type: "error",
        });
      }
    } catch (err) {
      console.error("Chemistry test failed:", err);
      toast.add({
        title: "Chemistry test failed",
        description: err instanceof Error ? err.message : "Could not reach the chemistry backend.",
        type: "error",
      });
    } finally {
      setIsChemistryRunning(false);
    }
  };

  // Forward ref to handleUpdateNodeData (defined later, after setNodes exists)
  // so nodeCallbacks can call it without reordering the whole hook chain.
  const handleUpdateNodeDataRef = React.useRef<
    (nodeId: string, newData: Record<string, unknown>) => void
  >(null);
  const setViewModeRef = React.useRef<
    (mode: "split" | "canvas-only" | "dock-only") => void
  >(null);

  // Dynamic Blueprint Node Callbacks
  const nodeCallbacks: NodeCallbacks = React.useMemo(
    () => ({
      onOpenHotSeat: (charName: string) => {
        setActiveCharacterName(charName);
        setMainTab("simulation");
        setSimulationTab("hotseat");
      },
      onTuneVoice: (charName: string) => {
        setActiveCharacterName(charName);
        setMainTab("simulation");
        setSimulationTab("audio");
      },
      onGenerateDraft: () => {
        runFullPipeline(projectId, premiseInput);
      },
      onViewScript: () => {
        setScriptViewerOpen(true);
      },
      onOpenDeck: (subTab) => {
        if ((subTab as string) === "territory" || (subTab as string) === "stripboard") {
          setPageViewMode("scenes");
        } else {
          setMainTab("planning");
          setDeckSubTab(subTab as DeckSubTab);
          // Maximize the bottom panel so the deck gets full workspace
          setViewModeRef.current?.("dock-only");
          toast.add({
            title:
              (subTab as string) === "blocking"
                ? "2D Camera Blocking Deck"
                : (subTab as string) === "tension"
                  ? "Pacing & Tension Curve"
                  : "Director Staging",
            description: "Bottom panel maximized. Click Restore to return to split view.",
            type: "info",
          });
        }
      },
      onOpenTableRead: () => {
        setMainTab("simulation");
        setSimulationTab("audio");
      },
      onOpenHeatmap: () => {
        setPageViewMode("scenes");
      },
      onRunChemistry: () => {
        setMainTab("simulation");
        setSimulationTab("chemistry");
        handleRunChemistry();
      },
      onTweakDials: (charName, dials) => {
        // Delegate to handleUpdateNodeData's node-dial-* branch (defined below)
        // via a ref, since nodeCallbacks must exist before useNodesState/setNodes.
        handleUpdateNodeDataRef.current?.(`node-dial-${charName.toLowerCase()}`, dials);
      },
      onOpenDossier: (candId?: string) => {
        const curScene = scenes.find((s) => s.id === activeSceneId);
        const candidates = curScene?.locationCandidates || [];
        const matched = candidates.find((c) => c.candidate_id === candId) || candidates[0];
        if (matched) {
          setDossierCandidate(matched);
        }
        setDossierOpen(true);
      },
    }),
    [projectId, premiseInput]
  );
  nodeCallbacksRef.current = nodeCallbacks;

  // Generate initial React Flow nodes & edges directly from project data, then
  // overlay any persisted per-node customization (dials, quirks, images, style)
  // from the last save — the structural rebuild keeps callbacks/positions live,
  // the overlay keeps edits from vanishing on refresh.
  const initialGraph = React.useMemo(() => {
    const targetId = routeSceneId || searchParams?.get("scene") || initialProject.activeSceneId || initialProject.scenes?.[0]?.id;
    const currentScene = (initialProject.scenes || []).find((s) => s.id === targetId);
    if (currentScene && currentScene.nodes !== undefined) {
      return {
        nodes: rehydrateNodeCallbacks(currentScene.nodes, nodeCallbacks),
        edges: currentScene.edges || [],
      };
    }

    const fresh = buildProjectNodesAndEdges(initialProject, nodeCallbacks, isGenerating);
    const savedNodesById = new Map((initialProject.nodes || []).map((n) => [n.id, n]));
    const freshIds = new Set(fresh.nodes.map((n) => n.id));
    const mergedNodes = fresh.nodes.map((n) => {
      const saved = savedNodesById.get(n.id);
      if (!saved || !saved.data) return n;
      // Saved customization (dials, quirks, images, extracted style) wins;
      // callback functions must always come from the fresh build since they
      // close over the current nodeCallbacks/isGenerating.
      const mergedData: Record<string, unknown> = { ...n.data, ...saved.data };
      for (const key of Object.keys(n.data || {})) {
        if (/^on[A-Z]/.test(key)) mergedData[key] = (n.data as Record<string, unknown>)[key];
      }
      return { ...n, data: mergedData };
    });
    // Ad-hoc nodes the user spawned manually (e.g. via handleAddBlueprintNode)
    // have no counterpart in the structural rebuild — keep them as-is instead
    // of silently dropping them.
    const extraSavedNodes = rehydrateNodeCallbacks(
      (initialProject.nodes || []).filter((n) => !freshIds.has(n.id)),
      nodeCallbacks
    );
    const extraSavedIds = new Set(extraSavedNodes.map((n) => n.id));
    const extraSavedEdges = (initialProject.edges || []).filter(
      (e) => extraSavedIds.has(e.source) || extraSavedIds.has(e.target)
    );
    return {
      nodes: [...mergedNodes, ...extraSavedNodes],
      edges: [...fresh.edges, ...extraSavedEdges],
    };
  }, [initialProject, nodeCallbacks, isGenerating]);

  const [nodes, setNodes, onNodesChangeBase] = useNodesState(initialGraph.nodes);
  const [edges, setEdges, onEdgesChangeBase] = useEdgesState(initialGraph.edges);

  // Refs mirror node/edge state for saveCurrentProject to read without
  // taking nodes/edges as a dependency (which would thrash on every drag).
  const nodesRef = React.useRef(nodes);
  const edgesRef = React.useRef(edges);
  React.useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);
  React.useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  // Populated once saveCurrentProject is defined below; lets onNodesChange/
  // onEdgesChange (declared before it exists) call the latest version.
  const saveCurrentProjectRef = React.useRef<(partial?: Partial<ProjectData>) => void>(() => {});

  // Wrap the raw React Flow change handlers so keyboard/UI deletions
  // (which bypass every other saveCurrentProject call site) get persisted.
  const onNodesChange = React.useCallback(
    (changes: Parameters<typeof onNodesChangeBase>[0]) => {
      onNodesChangeBase(changes);
      if (changes.some((c) => c.type === "remove")) {
        saveCurrentProjectRef.current();
      }
    },
    [onNodesChangeBase]
  );
  const onEdgesChange = React.useCallback(
    (changes: Parameters<typeof onEdgesChangeBase>[0]) => {
      onEdgesChangeBase(changes);
      if (changes.some((c) => c.type === "remove")) {
        saveCurrentProjectRef.current();
      }
    },
    [onEdgesChangeBase]
  );

  // Initialize Studio Version Control
  React.useEffect(() => {
    if (!projectId) return;
    const instance = new StudioVersionControl(projectId, {
      nodes: initialGraph.nodes,
      edges: initialGraph.edges,
      characters,
      sceneTitle,
      sceneSummary,
      screenplayText,
    });
    setVcs(instance);

    const updateVcsState = () => {
      setCanUndo(instance.canUndo());
      setCanRedo(instance.canRedo());
      setVcsHistoryCount(instance.getHistory().length);
    };

    updateVcsState();
    return instance.subscribe(updateVcsState);
  }, [projectId]);

  // Apply VCS snapshot back into live canvas and project storage
  const applySnapshot = React.useCallback(
    (snap: SnapshotState) => {
      if (snap.nodes) setNodes(rehydrateNodeCallbacks(snap.nodes, nodeCallbacks));
      if (snap.edges) setEdges(snap.edges);
      if (snap.characters) setCharacters(snap.characters);
      if (snap.sceneTitle) setSceneTitle(snap.sceneTitle);
      if (snap.sceneSummary) setSceneSummary(snap.sceneSummary);
      if (snap.screenplayText !== undefined) setScreenplayText(snap.screenplayText);

      saveCurrentProject({
        characters: snap.characters,
        sceneTitle: snap.sceneTitle,
        sceneSummary: snap.sceneSummary,
        screenplayText: snap.screenplayText,
      });
    },
    [setNodes, setEdges, saveCurrentProject]
  );

  const handleUndo = React.useCallback(() => {
    if (!vcs) return;
    const snap = vcs.undo();
    if (snap) {
      applySnapshot(snap);
    }
  }, [vcs, applySnapshot]);

  const handleRedo = React.useCallback(() => {
    if (!vcs) return;
    const snap = vcs.redo();
    if (snap) {
      applySnapshot(snap);
    }
  }, [vcs, applySnapshot]);

  const handleRevertSnapshot = React.useCallback(
    (snap: SnapshotState) => {
      applySnapshot(snap);
    },
    [applySnapshot]
  );

  const recordTakeChange = React.useCallback(
    (summary: string, category: HistoryCategory, customSnapshot?: Partial<SnapshotState>) => {
      if (!vcs) return;
      vcs.recordChange(
        summary,
        category,
        {
          nodes,
          edges,
          characters,
          sceneTitle,
          sceneSummary,
          screenplayText,
          ...customSnapshot,
        }
      );
    },
    [vcs, nodes, edges, characters, sceneTitle, sceneSummary, screenplayText]
  );

  // Handler when selecting a scene from dropdown, timeline, or sequence reel
  const handleSelectScene = React.useCallback(
    (newSceneId: string) => {
      setScenes((prev) => {
        // Save currently active scene modifications
        const updated = prev.map((s) =>
          s.id === activeSceneId
            ? {
                ...s,
                title: sceneTitle,
                summary: sceneSummary,
                screenplayText: screenplayText,
                location: primaryLocation,
                nodes: nodes,
                edges: edges,
                durationSeconds: sceneDurationSeconds,
                startSeconds: scenePlacementSeconds,
                events: events,
                floorPlanMapUrl: floorPlanCustomMapUrl || undefined,
                floorPlanMapName: floorPlanCustomMapName || undefined,
                floorPlanMapConfig: floorPlanCustomMapConfig || undefined,
              }
            : s
        );
        const target = updated.find((s) => s.id === newSceneId);
        if (target) {
          setActiveSceneId(target.id);
          setSceneTitle(target.title || "");
          setSceneSummary(target.summary || "");
          setScreenplayText(target.screenplayText || "");
          setPrimaryLocation(target.location || "");
          setScenePlacementSeconds(target.startSeconds || 0);
          setSceneDurationSeconds(target.durationSeconds || 120);
          setTimeSeconds(target.startSeconds || 0);
          setNodes(rehydrateNodeCallbacks(target.nodes || [], nodeCallbacks));
          setEdges(target.edges || []);
          setEvents(target.events || []);
          setFloorPlanCustomMapUrl(target.floorPlanMapUrl || null);
          setFloorPlanCustomMapName(target.floorPlanMapName || undefined);
          setFloorPlanCustomMapConfig(target.floorPlanMapConfig || undefined);
        }
        // Persist updated scene list and current active scene's floor plan map
        saveCurrentProject({
          scenes: updated,
          activeSceneId: newSceneId,
          floorPlanMapUrl: target?.floorPlanMapUrl || undefined,
          floorPlanMapName: target?.floorPlanMapName || undefined,
          floorPlanMapConfig: target?.floorPlanMapConfig || undefined,
        });
        return updated;
      });
    },
    [
      activeSceneId,
      sceneTitle,
      sceneSummary,
      screenplayText,
      primaryLocation,
      nodes,
      edges,
      events,
      floorPlanCustomMapUrl,
      floorPlanCustomMapName,
      floorPlanCustomMapConfig,
      sceneDurationSeconds,
      scenePlacementSeconds,
      setNodes,
      setEdges,
      setEvents,
      setTimeSeconds,
    ]
  );

  const handleAutoTidy = React.useCallback(() => {
    const tidied = autoTidyBacklot(nodes);
    setNodes(tidied);
    recordTakeChange("Auto-Tidy Backlot Lanes", "layout", { nodes: tidied });
  }, [nodes, setNodes, recordTakeChange]);

  // Update nodes and edges whenever project graph needs re-sync
  const syncGraphWithProject = React.useCallback(
    (proj: ProjectData) => {
      const { nodes: newNodes, edges: newEdges } = buildProjectNodesAndEdges(
        proj,
        nodeCallbacks,
        false
      );
      setNodes(newNodes);
      setEdges(newEdges);
    },
    [nodeCallbacks, setNodes, setEdges]
  );

  // Run Script Generation & Sharding Pipeline
  const runFullPipeline = async (pid: string, premise: string) => {
    setIsGenerating(true);
    const controller = new AbortController();
    pipelineAbortRef.current = controller;
    // Capture the scene this pipeline is generating for once, up front.
    // Never re-derive it from live activeSceneId/scenes state later in this
    // function — the user may navigate to a different scene while the
    // pipeline (several awaited network calls) is still running, and this
    // function must only ever write into the scene it started generating
    // for, and must never force-navigate the UI away from wherever the
    // user has since gone.
    const pipelineTargetSceneId = activeSceneIdRef.current;
    try {
      setGenerationStage("Drafting Master Screenplay (Gemini 3.7 Flash)...");
      let enrichedPremise = premise;
      const effectiveDirectorStyle = directorStyle || initialProject.directorStyle;
      const effectiveCoreSecret = coreSecret || initialProject.coreSecret;
      const effectivePrimaryLocation = primaryLocation || initialProject.primaryLocation;

      if (effectiveDirectorStyle) {
        enrichedPremise += `\nDirectorial Tone: Style of ${effectiveDirectorStyle}.`;
      }
      if (effectiveCoreSecret) {
        enrichedPremise += `\nAsymmetric Knowledge / Hidden Secret: ${effectiveCoreSecret}.`;
      }
      if (effectivePrimaryLocation) {
        enrichedPremise += `\nPrimary Setting / Dramatic Location: ${effectivePrimaryLocation}.`;
      }
      if (characters && characters.length > 0) {
        const charRoster = characters
          .map((c) => `${c.name} (${c.role || c.archetype}${c.actorComp ? `, comp: ${c.actorComp}` : ""})`)
          .join("; ");
        enrichedPremise += `\nFeatured Characters: ${charRoster}.`;
      }

      const existingProject = getProjectById(pid) || initialProject;
      let currentScenes = scenes.length > 0 ? scenes : (existingProject.scenes || []);
      const needsFullSequenceGen =
        currentScenes.length <= 1 ||
        currentScenes.some(
          (s) =>
            s.title === "The Inciting Incident" ||
            s.title === "The Midpoint Escalation" ||
            s.title.startsWith("Scene ")
        );

      if (needsFullSequenceGen) {
        setGenerationStage("Architecting Complete Sequence Breakdown (Gemini 3.7 Flash)...");
        try {
          const genRes = await fetch("/api/project/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: projectTitle,
              logline: premise,
              genre,
              directorStyle: effectiveDirectorStyle,
              coreSecret: effectiveCoreSecret,
              primaryLocation: effectivePrimaryLocation,
              targetRuntimeMinutes,
              narrativeFormat,
              customCharacters: characters,
            }),
            signal: controller.signal,
          });
          if (genRes.ok) {
            const genData = await genRes.json();
            if (genData._generatedBy === "semantic-showrunner-fallback") {
              toast.add({
                title: "Sequence Breakdown: showing template scenes",
                description: "Gemini was unreachable, so this sequence is a curated template, not live AI output.",
                type: "warning",
              });
            }
            if (Array.isArray(genData.scenes) && genData.scenes.length > 0) {
              currentScenes = genData.scenes;
              setScenes(genData.scenes);
              scenesRef.current = genData.scenes;
              // Do not force-navigate via setActiveSceneId/setSceneTitle/etc here —
              // this pipeline may still be running after the user has already
              // navigated elsewhere, and this step only needs to update the
              // underlying scenes array, not steer the UI.
              if (Array.isArray(genData.characters) && genData.characters.length > 0) {
                setCharacters(genData.characters);
              }
            }
          }
        } catch (e) {
          console.warn("Sequence generation step notice:", e);
        }
      }

      // Only draft a fresh single-scene screenplay from scratch when there's
      // nothing real yet (needsFullSequenceGen). If /api/project/generate
      // above already produced real multi-scene content, drafting again here
      // would silently overwrite it with a single regenerated scene — shard
      // the existing scenes' text instead, joined with markers so the
      // sharder can anchor timestamps across all of them (see
      // handleReshardScript for the same pattern).
      let generatedScript: string;
      if (needsFullSequenceGen) {
        setGenerationStage("Drafting Master Screenplay (Gemini 3.7 Flash)...");
        const scriptRes = await fetch("/api/script/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ premise: enrichedPremise, projectId: pid }),
          signal: controller.signal,
        });
        if (!scriptRes.ok) {
          const detail = await scriptRes.text().catch(() => "");
          throw new Error(detail || "Script generation failed");
        }
        const scriptData = await scriptRes.json();
        generatedScript = scriptData.screenplay_text;
        if (activeSceneIdRef.current === pipelineTargetSceneId) {
          setScreenplayText(generatedScript);
        }
      } else {
        generatedScript = currentScenes
          .map(
            (s: FilmScene) =>
              `=== SCENE ${s.sceneNumber}: ${s.title} (starts at ${s.startSeconds}s) ===\n${s.screenplayText || ""}`
          )
          .join("\n\n");
      }

      setGenerationStage("Sharding Perspectives & Asymmetric Knowledge into ClickHouse...");
      const shardRes = await fetch("/api/sharding/shard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: pid,
          screenplayText: generatedScript,
        }),
        signal: controller.signal,
      });
      if (!shardRes.ok) {
        const detail = await shardRes.text().catch(() => "");
        throw new Error(detail || "Perspective sharding failed");
      }
      const shardData = await shardRes.json();

      const newSceneTitle = shardData.scene_title || `${projectTitle} — Scene 01`;
      const newSceneSummary = shardData.scene_summary || premise;
      if (activeSceneIdRef.current === pipelineTargetSceneId) {
        setSceneTitle(newSceneTitle);
        setSceneSummary(newSceneSummary);
      }

      let newCharacters: ProjectCharacter[] = characters;
      if (Array.isArray(shardData.characters) && shardData.characters.length > 0) {
        // Intelligently preserve authored character profiles
        newCharacters = shardData.characters.map((sc: any) => {
          const existing = characters.find(
            (c) => c.name.toLowerCase() === sc.name.toLowerCase()
          );
          if (existing) {
            return {
              ...existing,
              archetype: existing.archetype || sc.archetype,
              speechStyle: existing.speechStyle || sc.speech_style || "naturalistic",
              subtextRatio: existing.subtextRatio || sc.subtext_ratio || "high",
            };
          }
          return {
            name: sc.name,
            archetype: sc.archetype,
            speechStyle: sc.speech_style || "naturalistic",
            subtextRatio: sc.subtext_ratio || "high",
            actorComp: `${sc.name} Comp`,
            objective: "Confront the central crisis",
          };
        });

        // Retain any authored characters that weren't mentioned in the shard
        for (const authored of characters) {
          if (!newCharacters.some((nc) => nc.name.toLowerCase() === authored.name.toLowerCase())) {
            newCharacters.push(authored);
          }
        }

        setCharacters(newCharacters);
        if (newCharacters.length > 0) {
          setActiveCharacterName(newCharacters[0].name);
        }
      }

      logClickHouseQuery(
        `INSERT INTO story_events VALUES (${shardData.events_written} events committed)`,
        "insert",
        15
      );

      setGenerationStage("Finalizing Timeline & Syncing Graph...");
      await fetchProjectEvents(pid);

      const baseScenes = currentScenes.length > 0 ? currentScenes : (scenesRef.current.length > 0 ? scenesRef.current : (existingProject.scenes || []));
      // Write generated content into the scene this pipeline was started for,
      // captured before any await — never the live/current activeSceneId,
      // which may have changed while this pipeline was running.
      const effectiveActiveId = baseScenes.some((s) => s.id === pipelineTargetSceneId)
        ? pipelineTargetSceneId
        : (baseScenes[0]?.id || "");
      const nextScenes = baseScenes.map((sc: FilmScene) =>
        sc.id === effectiveActiveId
          ? {
              ...sc,
              title: newSceneTitle,
              summary: newSceneSummary,
              screenplayText: generatedScript,
              location: effectivePrimaryLocation || sc.location,
            }
          : sc
      );
      setScenes(nextScenes);
      scenesRef.current = nextScenes;

      const updatedProject: ProjectData = {
        ...existingProject,
        id: pid,
        title: projectTitle,
        genre: genre,
        premise: premise,
        scenes: nextScenes,
        activeSceneId: effectiveActiveId,
        sceneTitle: newSceneTitle,
        sceneSummary: newSceneSummary,
        screenplayText: generatedScript,
        characters: newCharacters,
        initialEvents: events,
        createdAt: existingProject?.createdAt || initialProject.createdAt,
        updatedAt: Date.now(),
        isCustom: true,
        directorStyle: effectiveDirectorStyle,
        coreSecret: effectiveCoreSecret,
        primaryLocation: effectivePrimaryLocation,
        targetTerritories: targetTerritories.length > 0 ? targetTerritories : (existingProject?.targetTerritories || []),
        narrativeFormat,
        targetRuntimeMinutes,
        scenePlacementSeconds,
        sceneDurationSeconds,
      };

      saveProject(updatedProject);
      // Only touch the visible node/edge graph if the user is still on the
      // scene this pipeline generated for — otherwise this would overwrite
      // whatever scene's graph they've since navigated to.
      if (activeSceneIdRef.current === pipelineTargetSceneId) {
        syncGraphWithProject(updatedProject);
      }
      setAllProjects(getAllProjects());
      setMainTab("planning");

      // Clean up ?pipeline=1 from URL so back/refresh doesn't re-execute pipeline
      if (typeof window !== "undefined" && window.location.search.includes("pipeline=1")) {
        const cleanSearch = window.location.search
          .replace(/[?&]pipeline=1/, "")
          .replace(/^&/, "?");
        const cleanUrl = window.location.pathname + (cleanSearch.startsWith("?") ? cleanSearch : "");
        window.history.replaceState(null, "", cleanUrl);
      }
    } catch (err) {
      console.error("Pipeline failed:", err);
      if (err instanceof Error && err.name === "AbortError") {
        toast.add({ title: "Generation cancelled", type: "info" });
      } else {
        toast.add({
          title: "Script generation pipeline failed",
          description: err instanceof Error ? err.message : "Could not reach the generation backend.",
          type: "error",
        });
      }
    } finally {
      setIsGenerating(false);
      setGenerationStage("");
      pipelineAbortRef.current = null;
    }
  };

  const handleCancelPipeline = () => {
    pipelineAbortRef.current?.abort();
  };

  // Re-shard script after user edits
  const handleReshardScript = async (newScript: string) => {
    setIsGenerating(true);
    setGenerationStage("Re-sharding Perspectives with Gemini 3.7 & ClickHouse...");
    try {
      // Sharding wipes and rebuilds ALL story_events for this project_id
      // (see clear_project_events in clickhouse_store.py), so we must send
      // the full multi-scene script here, not just the active scene's text —
      // otherwise every reshard silently erases every other scene's
      // knowledge events, breaking the time-gate across scene boundaries.
      const sceneList = scenes.length > 0 ? scenes : (getProjectById(projectId)?.scenes || []);
      const fullScript = sceneList
        .map((s: FilmScene) =>
          `=== SCENE ${s.sceneNumber}: ${s.title} (starts at ${s.startSeconds}s) ===\n${
            s.id === activeSceneId ? newScript : s.screenplayText || ""
          }`
        )
        .join("\n\n");

      const shardRes = await fetch("/api/sharding/shard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          screenplayText: fullScript || newScript,
        }),
      });
      if (!shardRes.ok) throw new Error("Perspective sharding failed");
      const shardData = await shardRes.json();

      if (shardData.scene_title) setSceneTitle(shardData.scene_title);
      if (shardData.scene_summary) setSceneSummary(shardData.scene_summary);

      let updatedChars = characters;
      if (Array.isArray(shardData.characters) && shardData.characters.length > 0) {
        updatedChars = shardData.characters.map((c: any) => ({
          name: c.name,
          archetype: c.archetype,
          speechStyle: c.speech_style || "naturalistic",
          subtextRatio: c.subtext_ratio || "moderate",
          actorComp: `${c.name} Comp`,
          objective: "Resolve scene conflict",
        }));
        setCharacters(updatedChars);
        setActiveCharacterName(updatedChars[0].name);
      }

      setScreenplayText(newScript);

      const existingProject = getProjectById(projectId) || initialProject;
      const nextScenes = (scenes.length > 0 ? scenes : (existingProject.scenes || [])).map((s: FilmScene) =>
        s.id === activeSceneId
          ? {
              ...s,
              title: shardData.scene_title || s.title,
              summary: shardData.scene_summary || s.summary,
              screenplayText: newScript,
            }
          : s
      );
      setScenes(nextScenes);

      const updatedProject: ProjectData = {
        ...existingProject,
        id: projectId,
        title: projectTitle,
        genre: genre,
        premise: premiseInput,
        scenes: nextScenes,
        activeSceneId: activeSceneId,
        sceneTitle: shardData.scene_title || sceneTitle,
        sceneSummary: shardData.scene_summary || sceneSummary,
        screenplayText: newScript,
        characters: updatedChars,
        initialEvents: events,
        createdAt: existingProject?.createdAt || initialProject.createdAt,
        updatedAt: Date.now(),
        isCustom: true,
        directorStyle: directorStyle || existingProject?.directorStyle,
        coreSecret: coreSecret || existingProject?.coreSecret,
        primaryLocation: primaryLocation || existingProject?.primaryLocation,
        targetTerritories: targetTerritories.length > 0 ? targetTerritories : (existingProject?.targetTerritories || []),
        narrativeFormat,
        targetRuntimeMinutes,
        scenePlacementSeconds,
        sceneDurationSeconds,
      };

      saveProject(updatedProject);
      syncGraphWithProject(updatedProject);
      setAllProjects(getAllProjects());

      logClickHouseQuery(
        `INSERT INTO story_events VALUES (${shardData.events_written} events committed)`,
        "insert",
        12
      );
      await fetchProjectEvents(projectId);
    } catch (err) {
      console.error("Resharding failed:", err);
      toast.add({
        title: "Re-sharding failed",
        description: err instanceof Error ? err.message : "Could not reach the sharding backend.",
        type: "error",
      });
    } finally {
      setIsGenerating(false);
      setGenerationStage("");
    }
  };

  // Multiverse Take Application with automatic ClickHouse re-sharding
  const handleApplyTake = async (take: MultiverseTake) => {
    setScreenplayText(take.scriptSnippet);
    setSceneSummary(take.synopsis);
    saveCurrentProject({ screenplayText: take.scriptSnippet, sceneSummary: take.synopsis });
    await handleReshardScript(take.scriptSnippet);
  };

  // Trigger auto pipeline if navigated with ?pipeline=1 or brand new empty custom project
  React.useEffect(() => {
    if (shouldAutoRunPipeline || (initialProject.isCustom && !initialProject.screenplayText)) {
      runFullPipeline(initialProject.id, initialProject.premise);
    }
  }, [shouldAutoRunPipeline]);

  // Interrogate Character in Hot Seat
  const handleAskHotSeat = async (question: string) => {
    if (!question.trim() || isAsking) return;
    setIsAsking(true);

    const userTurn: HotSeatTurn = { role: "interviewer", content: question };
    setHotSeatTurns((prev) => [...prev, userTurn]);

    const timecode = formatTimecode(timeSeconds);
    const start = performance.now();

    try {
      const res = await fetch("/api/hot-seat/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          characterName: activeCharacterName,
          currentTimestamp: timecode,
          question,
          speechStyle: activeCharacter?.speechStyle,
          subtextRatio: activeCharacter?.subtextRatio,
          priorTurns: hotSeatTurns.slice(-6).map((t) => ({ role: t.role, content: t.content })),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const characterTurn: HotSeatTurn = {
          role: "character",
          content: data.answer,
          isWithinFirewall: data.is_within_firewall,
        };
        setHotSeatTurns((prev) => [...prev, characterTurn]);
        if (data.known_facts) setKnownFacts(data.known_facts);
        if (data.query_sql) {
          const elapsed = Math.round(performance.now() - start);
          logClickHouseQuery(data.query_sql, "interrogate", elapsed);
        }
      }
    } catch (err) {
      console.error("Hot-seat error:", err);
    } finally {
      setIsAsking(false);
    }
  };

  // Centralized Studio Executive AI Commander (Autonomous CRUD Orchestrator)
  const handleExecuteCommanderPrompt = React.useCallback(
    async (prompt: string): Promise<CommanderExecutionResponse | null> => {
      const trimmed = prompt.trim();
      if (!trimmed) return null;

      setIsShowrunnerThinking(true);
      const userMsg: ExtendedShowrunnerMessage = { role: "user", content: trimmed };
      setShowrunnerMessages((prev) => [...prev, userMsg]);

      const start = performance.now();
      try {
        const res = await fetch("/api/showrunner/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userPrompt: trimmed,
            project: {
              id: projectId,
              title: projectTitle,
              genre,
              premise: premiseInput,
              sceneTitle,
              sceneSummary,
              screenplayText,
              characters,
              nodes,
              edges,
              scenes,
              activeSceneId,
              assets: typeof window !== "undefined" ? getLocalAssets() : [],
            },
            history: showrunnerMessages.slice(-6).map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }),
        });

        if (!res.ok) {
          throw new Error(`Commander execution failed (${res.status})`);
        }

        const data: CommanderExecutionResponse = await res.json();

        // Autonomously execute mutations across project & backlot canvas
        let executedSummaries: string[] = [];
        if (data.actions && data.actions.length > 0) {
          const result = executeStudioActions(
            data.actions,
            {
              nodes,
              edges,
              characters,
              screenplayText,
              sceneTitle,
              sceneSummary,
              genre,
              projectId,
              projectTitle,
              premise: premiseInput,
              directorStyle,
              vcs,
              scenes,
              activeSceneId,
              events,
            },
            {
              setNodes,
              setEdges,
              setCharacters,
              setScreenplayText,
              setSceneTitle,
              setSceneSummary,
              setProjectTitle,
              setGenre,
              setPremise: setPremiseInput,
              setDirectorStyle,
              saveProject: saveCurrentProject,
              recordTakeChange,
              setScenes,
              setActiveSceneId,
              setEvents,
              switchView: (tab, subview) => {
                if (tab === "planning") {
                  setMainTab("planning");
                } else if (tab === "simulation") {
                  setMainTab("simulation");
                  if (subview === "audio" || subview === "score") setSimulationTab("audio");
                  else if (subview === "hotseat") setSimulationTab("hotseat");
                  else if (subview === "chemistry") setSimulationTab("chemistry");
                } else if (tab === "generation") {
                  setMainTab("generation");
                } else if (tab === "showrunner") {
                  setMainTab("showrunner");
                }
                if (subview === "assets") {
                  setAssetHubOpen(true);
                }
              },
              openAssetHub: () => setAssetHubOpen(true),
            }
          );
          executedSummaries = result.summaries;
        }

        const aiMsg: ExtendedShowrunnerMessage = {
          role: "showrunner",
          content: data.assistant_message,
          thought_process: data.thought_process,
          actions: data.actions,
          execution_summaries: executedSummaries,
          precedents_cited: data.precedents_cited,
          is_fallback: data._fallback,
        };

        setShowrunnerMessages((prev) => [...prev, aiMsg]);

        if (data._fallback) {
          toast.add({
            title: "Executive AI running in degraded mode",
            description: data._error || "The AI backend was unreachable — this directive was handled by a local fallback, not live reasoning.",
            type: "warning",
          });
        }

        // Log the real ClickHouse precedent query the commander used to ground
        // its creative reasoning (only if precedent rows actually came back).
        if (data.clickhouse_query_sql) {
          const elapsed = Math.round(performance.now() - start);
          logClickHouseQuery(data.clickhouse_query_sql, "precedents", elapsed);
        }

        return {
          ...data,
          execution_summary: executedSummaries,
        };
      } catch (err) {
        console.error("Studio Commander execution error:", err);
        const errMsg: ExtendedShowrunnerMessage = {
          role: "showrunner",
          content: `Executive AI encountered an issue executing your directive: ${err instanceof Error ? err.message : String(err)}`,
        };
        setShowrunnerMessages((prev) => [...prev, errMsg]);
        return null;
      } finally {
        setIsShowrunnerThinking(false);
      }
    },
    [
      projectId,
      projectTitle,
      genre,
      premiseInput,
      sceneTitle,
      sceneSummary,
      screenplayText,
      characters,
      nodes,
      edges,
      vcs,
      showrunnerMessages,
      setNodes,
      setEdges,
      setCharacters,
      saveCurrentProject,
      recordTakeChange,
      logClickHouseQuery,
    ]
  );

  // Showrunner Central AI Chat maps directly to Commander execution
  const handleSendShowrunner = async (message: string) => {
    await handleExecuteCommanderPrompt(message);
  };

  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
  const inspectorPanelRef = usePanelRef();
  const topPanelRef = usePanelRef();
  const bottomPanelRef = usePanelRef();
  const [layoutMode, setLayoutMode] = React.useState<"split" | "canvas-only" | "dock-only">("split");
  // Prevents onResize callbacks from fighting programmatic layout changes mid-animation
  const isProgrammaticResize = React.useRef(false);

  const setViewMode = React.useCallback(
    (mode: "split" | "canvas-only" | "dock-only") => {
      // Lock out onResize callbacks during the animation (panels report intermediate sizes)
      isProgrammaticResize.current = true;
      setLayoutMode(mode);
      if (mode === "canvas-only") {
        bottomPanelRef.current?.collapse();
        inspectorPanelRef.current?.collapse();
        setIsSidebarOpen(false);
        topPanelRef.current?.expand();
      } else if (mode === "dock-only") {
        // Collapsing the top panel automatically gives all space to the bottom
        topPanelRef.current?.collapse();
        bottomPanelRef.current?.expand();
      } else {
        // "split" — expand both; library restores their last non-collapsed sizes
        topPanelRef.current?.expand();
        bottomPanelRef.current?.expand();
      }
      // Release the lock after animations finish (~300ms is enough for CSS transitions)
      setTimeout(() => {
        isProgrammaticResize.current = false;
      }, 350);
    },
    [topPanelRef, bottomPanelRef, inspectorPanelRef]
  );

  React.useEffect(() => {
    setViewModeRef.current = setViewMode;
  }, [setViewMode]);

  const toggleSidebar = React.useCallback(() => {
    const panel = inspectorPanelRef.current;
    if (!panel) {
      setIsSidebarOpen((prev) => !prev);
      return;
    }
    if (panel.isCollapsed()) {
      panel.expand();
      setIsSidebarOpen(true);
    } else {
      panel.collapse();
      setIsSidebarOpen(false);
    }
  }, [inspectorPanelRef]);

  const [selectedNode, setSelectedNode] = React.useState<Node | null>(() => nodes[5] || nodes[0] || null);

  // Two-way synchronization between inspector edits and project state
  const handleUpdateNodeData = React.useCallback(
    (nodeId: string, newData: Record<string, unknown>) => {
      setNodes((nds) => {
        const target = nds.find((n) => n.id === nodeId);
        if (!target) return nds;
        const hasChange = Object.entries(newData).some(
          ([key, val]) => target.data?.[key] !== val
        );
        if (!hasChange) return nds;
        return nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...newData } } : n));
      });
      setSelectedNode((prev) => {
        if (!prev || prev.id !== nodeId) return prev;
        const hasChange = Object.entries(newData).some(
          ([key, val]) => (prev.data as Record<string, unknown>)?.[key] !== val
        );
        if (!hasChange) return prev;
        return { ...prev, data: { ...prev.data, ...newData } };
      });

      // Two-way synchronization with Project State
      if (nodeId.startsWith("node-core-")) {
        const charName = (newData.name as string) || "";
        const charArchetype = (newData.archetype as string) || "";
        const charObj = (newData.objective as string) || "";
        if (charName || charArchetype || charObj) {
          setCharacters((prevChars) => {
            const updated = prevChars.map((c) => {
              if (`node-core-${c.name.toLowerCase()}` === nodeId) {
                return {
                  ...c,
                  name: charName || c.name,
                  archetype: charArchetype || c.archetype,
                  objective: charObj || c.objective,
                };
              }
              return c;
            });
            saveCurrentProject({ characters: updated });
            return updated;
          });
          if (charName) setActiveCharacterName(charName);
        }
      } else if (nodeId === "node-scene-1") {
        if (newData.title) {
          setSceneTitle(newData.title as string);
          saveCurrentProject({ sceneTitle: newData.title as string });
        }
        if (newData.stakes) {
          setSceneSummary(newData.stakes as string);
          saveCurrentProject({ sceneSummary: newData.stakes as string });
        }
      } else if (nodeId === "node-script-1") {
        if (newData.previewText) {
          setScreenplayText(newData.previewText as string);
          saveCurrentProject({ screenplayText: newData.previewText as string });
        }
      } else if (nodeId.startsWith("node-dial-")) {
        const charName = nodeId.slice("node-dial-".length);
        let nextSummary: string | undefined;
        setCharacters((prevChars) => {
          const updated = prevChars.map((c) => {
            if (c.name.toLowerCase() !== charName) return c;
            const nextConfidence = (newData.confidence as number) ?? c.confidence ?? 60;
            const nextSpeed = (newData.speed as number) ?? c.verbalPacing ?? 75;
            const nextSubtext = (newData.subtext as number) ?? 85;
            nextSummary = `Confidence ${nextConfidence}% · Speed ${nextSpeed}% · Subtext ${nextSubtext}%`;
            return {
              ...c,
              confidence: nextConfidence,
              verbalPacing: nextSpeed,
              dialsSummary: nextSummary,
            };
          });
          saveCurrentProject({ characters: updated });
          return updated;
        });
        if (nextSummary) {
          const summary = nextSummary;
          setNodes((nds) =>
            nds.map((n) =>
              n.id === `node-core-${charName}` ? { ...n, data: { ...n.data, dialsSummary: summary } } : n
            )
          );
        }
      }
    },
    [saveCurrentProject, setNodes]
  );
  handleUpdateNodeDataRef.current = handleUpdateNodeData;

  // Allow user to draw new connections between nodes (loose, deletable, multi-wired)
  const onConnect = React.useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target || connection.source === connection.target) {
        return;
      }
      setEdges((eds) => {
        const next = addEdge(
          {
            ...connection,
            id: `e-${connection.source}-${connection.target}-${Date.now().toString(36)}`,
            type: "deletable",
            animated: true,
          },
          eds
        );
        recordTakeChange(`Connected wire: ${connection.source} → ${connection.target}`, "wire_add", { edges: next });
        return next;
      });
    },
    [setEdges, recordTakeChange]
  );

  const handleDeleteEdge = React.useCallback(
    (edgeId: string) => {
      setEdges((eds) => {
        const next = eds.filter((e) => e.id !== edgeId);
        recordTakeChange("Unlinked connection wire", "wire_remove", { edges: next });
        return next;
      });
    },
    [setEdges, recordTakeChange]
  );

  const handleLinkMultipleNodes = React.useCallback(
    (nodeIds: string[], mode: "chain" | "all") => {
      if (nodeIds.length < 2) return;
      setEdges((prevEdges) => {
        let updated = [...prevEdges];
        if (mode === "chain") {
          for (let i = 0; i < nodeIds.length - 1; i++) {
            const source = nodeIds[i];
            const target = nodeIds[i + 1];
            const exists = updated.some(
              (e) =>
                (e.source === source && e.target === target) ||
                (e.source === target && e.target === source)
            );
            if (!exists) {
              updated = addEdge(
                {
                  id: `e-${source}-${target}-${Date.now().toString(36)}`,
                  source,
                  target,
                  type: "deletable",
                  animated: true,
                },
                updated
              );
            }
          }
        } else {
          for (let i = 0; i < nodeIds.length; i++) {
            for (let j = i + 1; j < nodeIds.length; j++) {
              const source = nodeIds[i];
              const target = nodeIds[j];
              const exists = updated.some(
                (e) =>
                  (e.source === source && e.target === target) ||
                  (e.source === target && e.target === source)
              );
              if (!exists) {
                updated = addEdge(
                  {
                    id: `e-${source}-${target}-${Date.now().toString(36)}`,
                    source,
                    target,
                    type: "deletable",
                    animated: true,
                  },
                  updated
                );
              }
            }
          }
        }
        recordTakeChange(`Batch linked ${nodeIds.length} nodes (${mode})`, "wire_add", { edges: updated });
        return updated;
      });
    },
    [setEdges, recordTakeChange]
  );

  const handleUnlinkSelectedNodes = React.useCallback(
    (nodeIds: string[]) => {
      const idSet = new Set(nodeIds);
      setEdges((prevEdges) => {
        const next = prevEdges.filter((e) => !(idSet.has(e.source) && idSet.has(e.target)));
        recordTakeChange(`Severed connections between ${nodeIds.length} nodes`, "wire_remove", { edges: next });
        return next;
      });
    },
    [setEdges, recordTakeChange]
  );

  const handleUnlinkAllForNode = React.useCallback(
    (nodeId: string) => {
      setEdges((eds) => {
        const next = eds.filter((e) => e.source !== nodeId && e.target !== nodeId);
        recordTakeChange(`Severed all wires for node ${nodeId}`, "wire_remove", { edges: next });
        return next;
      });
    },
    [setEdges, recordTakeChange]
  );

  // Spawner for new blueprint nodes on canvas
  const handleAddBlueprintNode = (type: string) => {
    const id = `node-${type}-${Date.now().toString(36)}`;
    const randomOffset = Math.floor(Math.random() * 80);
    const pos = { x: 200 + randomOffset, y: 200 + randomOffset };

    let newNode: Node;
    switch (type) {
      case "clip":
        newNode = {
          id,
          type: "clip",
          position: pos,
          data: {
            title: "Custom Aesthetic Study",
            url: "cinematic-reference.mp4",
            timestampRange: "01:00 - 02:30",
            lightingStyle: "Extracted golden hour contrast",
            palette: ["#ffb703", "#fb8500", "#023047"],
            pacing: "Moderate slow-burn",
          },
        };
        break;
      case "note":
        newNode = {
          id,
          type: "note",
          position: pos,
          data: {
            noteType: "Brainstorm Note",
            content: "Add a sudden power failure before the protagonist reaches the safe.",
          },
        };
        break;
      case "actor":
        newNode = {
          id,
          type: "actor",
          position: pos,
          data: {
            actorName: "New Actor Comp",
            roleReference: "Iconic Film Reference",
            vocalWeight: "Deep, gravelly",
            energyProfile: "Method actor intensity",
          },
        };
        break;
      case "personality":
        newNode = {
          id,
          type: "personality",
          position: pos,
          data: {
            presetName: "Custom Dial Set",
            confidence: 70,
            speed: 50,
            subtext: 65,
          },
        };
        break;
      case "quirks":
        newNode = {
          id,
          type: "quirks",
          position: pos,
          data: {
            tics: ["Constantly glances at wristwatch", "Taps fingers against holster"],
          },
        };
        break;
      case "characterCore":
        newNode = {
          id,
          type: "characterCore",
          position: pos,
          data: {
            name: "New Hero",
            archetype: "Reluctant protagonist",
            objective: "Survive the night",
            onOpenHotSeat: () => {
              setActiveCharacterName("New Hero");
              setMainTab("simulation");
              setSimulationTab("hotseat");
            },
            onTuneVoice: () => {
              setActiveCharacterName("New Hero");
              setMainTab("simulation");
              setSimulationTab("audio");
            },
          },
        };
        setCharacters((prev) => [
          ...prev,
          {
            name: "New Hero",
            archetype: "Reluctant protagonist",
            objective: "Survive the night",
          },
        ]);
        break;
      case "scene":
        newNode = {
          id,
          type: "scene",
          position: pos,
          data: {
            title: "New Scene Master",
            slugline: "EXT. INDUSTRIAL COMPLEX - DAWN",
            stakes: "A standoff where negotiations break down.",
            state: "ready",
          },
        };
        break;
      case "script":
        newNode = {
          id,
          type: "script",
          position: pos,
          data: {
            title: "New Screenplay Draft",
            previewText: "INT. UNKNOWN LOCATION - CONTINUOUS\n\nA shadow moves across the doorway...",
            wordCount: 150,
            onViewScript: () => setScriptViewerOpen(true),
          },
        };
        break;
      case "chemistry":
        newNode = {
          id,
          type: "chemistry",
          position: pos,
          data: {
            scenario: "Two strangers trapped in an interrogation holding cell",
            onRunChemistry: handleRunChemistry,
          },
        };
        break;
      case "storyboard":
        newNode = {
          id,
          type: "storyboard",
          position: pos,
          data: {
            prompt: `2.39:1 low-angle dramatic shot of the scene with high-contrast volumetric illumination.`,
            shotType: "2.39:1 Anamorphic Scope",
            lighting: "Chiaroscuro key lighting",
          },
        };
        break;
      case "floorplan":
        newNode = {
          id,
          type: "floorplan",
          position: pos,
          data: {
            sceneTitle: sceneTitle || "Production Set Master",
            cameraCount: 3,
            onOpenDeck: () => nodeCallbacksRef.current.onOpenDeck?.("blocking"),
          },
        };
        break;
      case "tensionCurve":
        newNode = {
          id,
          type: "tensionCurve",
          position: pos,
          data: {
            peakTension: 88,
            actCount: 3,
            currentSeconds: timeSeconds,
            onOpenDeck: () => nodeCallbacksRef.current.onOpenDeck?.("tension"),
          },
        };
        break;
      case "tableRead":
        newNode = {
          id,
          type: "tableRead",
          position: pos,
          data: {
            screenplayText: screenplayText,
            onOpenTableRead: () => {
              setMainTab("simulation");
              setSimulationTab("audio");
            },
          },
        };
        break;
      case "market":
        newNode = {
          id,
          type: "market",
          position: pos,
          data: {
            genre: genre,
            onOpenDeck: () => {
              setPageViewMode("scenes");
            },
          },
        };
        break;
      case "location": {
        const curScene = scenes.find((s) => s.id === activeSceneId) || scenes[0];
        const sceneCandidates = curScene?.locationCandidates || [];
        const lockedCand = sceneCandidates.find((c) => c.candidate_id === curScene?.selectedLocationCandidateId);
        const venueName = lockedCand?.name || curScene?.location || "Industrial Vault Stage A";
        const regionName = lockedCand?.region || curScene?.shootRegion || "Brooklyn, NY";
        const dayRate = lockedCand?.estimated_cost?.day_rate || 3200;
        const permitFee = lockedCand?.estimated_cost?.permit_fee || 450;
        const candSummaries = sceneCandidates.length > 0
          ? sceneCandidates.map((c) => ({
              candidate_id: c.candidate_id,
              name: c.name,
              region: c.region,
              category: c.category,
              day_rate: c.estimated_cost?.day_rate,
              permit_fee: c.estimated_cost?.permit_fee,
              preview_image_url: c.preview_image_url,
              preview_image_prompt: c.preview_image_prompt,
              sound_rating: c.stage_specs?.sound_rating,
            }))
          : [
              {
                candidate_id: "c1",
                name: venueName,
                region: regionName,
                category: "practical",
                day_rate: dayRate,
                permit_fee: permitFee,
              },
            ];

        newNode = {
          id,
          type: "location",
          position: pos,
          data: {
            name: venueName,
            region: regionName,
            dayRate,
            permitFee,
            isLocked: Boolean(lockedCand),
            imageUrl: lockedCand?.preview_image_url || curScene?.preview_image_url,
            candidates: candSummaries,
            selectedCandidateId: lockedCand?.candidate_id || candSummaries[0]?.candidate_id,
            onOpenDossier: (candId?: string) => {
              const matched = sceneCandidates.find((c) => c.candidate_id === candId) || sceneCandidates[0] || (lockedCand as any);
              if (matched) {
                setDossierCandidate(matched);
                setDossierOpen(true);
              }
            },
            onToggleLock: () => {
              const isCurrentlyLocked = curScene?.selectedLocationCandidateId !== undefined;
              const nextSelectedId = isCurrentlyLocked
                ? undefined
                : (lockedCand?.candidate_id || sceneCandidates[0]?.candidate_id);
              const updatedScene = {
                ...curScene,
                selectedLocationCandidateId: nextSelectedId,
              };
              const nextScenes = scenes.map((s) => (s.id === curScene.id ? updatedScene : s));
              setScenes(nextScenes);
              saveCurrentProject({ scenes: nextScenes });
              toast.add({
                title: isCurrentlyLocked ? "Venue Unlocked" : "Venue Locked",
                description: isCurrentlyLocked
                  ? `Unlocked location for Scene ${curScene.sceneNumber}.`
                  : `Locked "${venueName}" for Scene ${curScene.sceneNumber}.`,
                type: "success",
              });
            },
          },
        };
        break;
      }
      default:
        return;
    }

    const updated = [...nodesRef.current, newNode];
    setNodes(updated);
    recordTakeChange(`Spawned ${type} blueprint node`, "node_add", { nodes: updated });
    saveCurrentProject({ nodes: updated });
    setSelectedNode(newNode);
  };

  // Node Selection in Inspector
  const handleNodeClick = React.useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedNode(node);
      const panel = inspectorPanelRef.current;
      if (panel && panel.isCollapsed()) {
        panel.expand();
        setIsSidebarOpen(true);
      }
    },
    [inspectorPanelRef]
  );

  if (isProjectNotFound) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-background text-foreground p-6 text-center">
        <div className="h-16 w-16 rounded-2xl bg-secondary/60 border border-border flex items-center justify-center text-muted-foreground mb-4">
          <Clapperboard className="h-8 w-8 text-accent" />
        </div>
        <h1 className="font-heading text-xl font-bold text-foreground">Production Slate Not Found</h1>
        <p className="text-xs text-muted-foreground mt-2 max-w-md">
          The production &ldquo;{rawProjectId || "unknown"}&rdquo; was not found in your studio slate. It may have been removed or created under another account.
        </p>
        <div className="flex items-center gap-3 mt-6">
          <Button onClick={() => router.push("/dashboard")} className="gap-2 bg-foreground text-background hover:bg-foreground/90">
            Back to Dashboard
          </Button>
          <Button variant="outline" onClick={() => router.push("/dashboard")} className="gap-2">
            Load the Guided Demo
          </Button>
        </div>
      </div>
    );
  }

  if (pageViewMode === "scenes") {
    const existing = getProjectById(projectId) || initialProject;
    const currentProj: ProjectData = {
      ...existing,
      id: projectId,
      title: projectTitle,
      genre,
      premise: premiseInput,
      scenes,
      activeSceneId,
      sceneTitle,
      sceneSummary,
      screenplayText,
      characters,
      initialEvents: events,
      targetRuntimeMinutes,
      directorStyle,
      coreSecret,
      primaryLocation,
      targetTerritories,
      videoTakes: existing.videoTakes || [],
      activeVideoUrl: existing.activeVideoUrl,
      createdAt: initialProject.createdAt,
      updatedAt: Date.now(),
    };
    return (
      <ProjectScenesPage
        project={currentProj}
        onUpdateProject={(updated) => {
          saveCurrentProject(updated);
          if (updated.scenes) setScenes(updated.scenes);
          if (updated.activeSceneId) setActiveSceneId(updated.activeSceneId);
        }}
        onOpenSceneStudio={(targetSceneId) => {
          handleSelectScene(targetSceneId);
          router.push(`/studio/${projectId}/scene/${targetSceneId}`);
        }}
      />
    );
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground selection:bg-accent/30 selection:text-accent-foreground">
      {/* Studio Header Bar */}
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-border/70 bg-[#0a0c10]/95 px-3 backdrop-blur select-none z-20">
        {/* Left: Breadcrumbs & Scene Context */}
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/"
            className="flex items-center gap-1.5 hover:opacity-90 transition-opacity mr-1 shrink-0"
            title="BlendEye Studio Home"
          >
            <div className="h-6 w-6 rounded-md bg-black/60 border border-accent/30 overflow-hidden shadow-sm flex items-center justify-center">
              <img src="/logo.png" alt="BlendEye" className="h-full w-full object-cover" />
            </div>
          </Link>

          <span className="text-border/70 text-xs select-none">/</span>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              router.push(`/studio/${projectId}`);
            }}
            className="h-7 px-2 gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 cursor-pointer shrink-0"
            title={`Return to Project Scenes Overview for "${projectTitle}"`}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="font-semibold">Scenes</span>
          </Button>

          <span className="text-border/70 text-xs select-none">/</span>

          {/* Project Title (Clickable link back to project scenes overview) */}
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => {
                router.push(`/studio/${projectId}`);
              }}
              className="flex items-center gap-1 text-xs font-semibold text-foreground/80 hover:text-foreground transition-colors truncate max-w-[130px] sm:max-w-[170px] cursor-pointer"
              title={`Project: ${projectTitle} (${genre})`}
            >
              <Film className="h-3 w-3 text-accent/80 shrink-0" />
              <span className="truncate">{projectTitle}</span>
            </button>
            <button
              type="button"
              onClick={() => setProjectSettingsOpen(true)}
              className="p-1 rounded text-muted-foreground hover:text-accent hover:bg-secondary/60 transition-colors cursor-pointer"
              title="Edit Project Configuration (Title, Genre, Scope, Characters)"
            >
              <Settings2 className="h-3 w-3" />
            </button>
          </div>

          <span className="text-border/70 text-xs select-none">/</span>

          {/* Active Scene Dropdown Switcher */}
          {(() => {
            const currentScene = scenes.find((s) => s.id === activeSceneId);
            const isCurrentBridge = isBridgeScene(currentScene);
            return (
              <div className="flex items-center gap-1">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-semibold transition-all cursor-pointer min-w-0 shadow-2xs",
                      isCurrentBridge
                        ? "border-purple-500/60 bg-purple-500/15 hover:bg-purple-500/25 text-purple-200"
                        : "border-accent/40 bg-accent/10 hover:bg-accent/20 text-accent"
                    )}
                  >
                    <Layers className={cn("h-3 w-3 shrink-0", isCurrentBridge && "text-purple-300")} />
                    <span className="truncate max-w-[130px] sm:max-w-[200px] text-xs">
                      {currentScene?.title || sceneTitle}
                    </span>
                    {isCurrentBridge && (
                      <span className="text-[9px] px-1 py-0.2 rounded bg-purple-500/30 text-purple-200 font-mono font-bold">
                        BRIDGE
                      </span>
                    )}
                    {isGenerating && (
                      <Loader2 className="h-2.5 w-2.5 shrink-0 animate-spin text-amber-400" />
                    )}
                    <ChevronDown className="h-2.5 w-2.5 opacity-60 shrink-0" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-72 bg-card border-border shadow-2xl p-1.5 z-50">
                    <DropdownMenuLabel className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-2 py-1 flex items-center gap-1.5">
                      <span>Project Scenes ({scenes.length})</span>
                      {isGenerating && (
                        <span className="flex items-center gap-1 text-amber-400 normal-case tracking-normal font-sans">
                          <Loader2 className="h-2.5 w-2.5 animate-spin" />
                          more arriving…
                        </span>
                      )}
                    </DropdownMenuLabel>
                    {scenes.map((sc) => {
                      const isBridge = isBridgeScene(sc);
                      return (
                        <DropdownMenuItem
                          key={sc.id}
                          onClick={() => {
                            handleSelectScene(sc.id);
                            router.push(`/studio/${projectId}/scene/${sc.id}`);
                          }}
                          className={cn(
                            "flex items-center justify-between px-2.5 py-1.5 rounded text-xs cursor-pointer",
                            sc.id === activeSceneId
                              ? isBridge
                                ? "bg-purple-500/20 text-purple-200 font-semibold"
                                : "bg-accent/15 text-accent font-semibold"
                              : "text-foreground hover:bg-secondary"
                          )}
                        >
                          <div className="flex flex-col truncate min-w-0 pr-2">
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="font-medium truncate">
                                Sc. {sc.sceneNumber}: {sc.title}
                              </span>
                              {isBridge && (
                                <Badge variant="outline" className="text-[9px] py-0 px-1 border-purple-500/40 bg-purple-500/20 text-purple-300 font-mono shrink-0">
                                  Bridge
                                </Badge>
                              )}
                            </div>
                            <span className="text-[10px] font-mono text-muted-foreground truncate">
                              {sc.slugline}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                            {Math.round((sc.durationSeconds || 180) / 60)}m
                          </span>
                        </DropdownMenuItem>
                      );
                    })}
                    <div className="h-px bg-border/50 my-1" />
                    <DropdownMenuItem
                      onClick={() => {
                        router.push(`/studio/${projectId}`);
                      }}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded text-xs text-accent hover:bg-accent/10 cursor-pointer font-medium"
                    >
                      <Film className="h-3.5 w-3.5" />
                      <span>All Scenes &amp; Bridge Timeline...</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <button
                  type="button"
                  onClick={() => setSceneSettingsOpen(true)}
                  className="p-1 rounded text-muted-foreground hover:text-accent hover:bg-secondary/60 transition-colors cursor-pointer"
                  title="Edit Active Scene Details (Slugline, Duration, Cast)"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              </div>
            );
          })()}
        </div>

        {/* Center: 4 Scene Workspaces (Studio | Simulation | Generation | Showrunner AI) */}
        <div className="flex items-center justify-center">
          <div className="flex items-center rounded-lg border border-border/80 bg-secondary/30 p-0.5 shadow-xs">
            <button
              type="button"
              onClick={() => setMainTab("planning")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-all cursor-pointer",
                mainTab === "planning"
                  ? "bg-accent text-accent-foreground shadow-xs"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
              title="Scene Planning: Backlot Graph, Script & Staging (Shift+1)"
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Studio</span>
            </button>

            <button
              type="button"
              onClick={() => setMainTab("simulation")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-all cursor-pointer",
                mainTab === "simulation"
                  ? "bg-accent text-accent-foreground shadow-xs"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
              title="Character Interrogation & Voice Simulation (Shift+2)"
            >
              <Cpu className="h-3.5 w-3.5" />
              <span>Simulation</span>
            </button>

            <button
              type="button"
              onClick={() => setMainTab("generation")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-all cursor-pointer",
                mainTab === "generation"
                  ? "bg-accent text-accent-foreground shadow-xs"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
              title="AI Media Generation: Gemini Omni Flash & Pre-viz Reels (Shift+3)"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Generation</span>
            </button>

            <button
              type="button"
              onClick={() => setMainTab("showrunner")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-all cursor-pointer",
                mainTab === "showrunner"
                  ? "bg-accent text-accent-foreground shadow-xs"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
              title="Showrunner AI Co-Pilot: Central Directing Partner & Strategy (Shift+4)"
            >
              <Bot className="h-3.5 w-3.5 text-emerald-400" />
              <span>Showrunner AI</span>
            </button>
          </div>
        </div>

        {/* Right: Revision History, Tools, Inspector & AI Commander */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Takes Version Control History */}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setVersionControlOpen(true)}
            className="h-7 px-2 gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/60 cursor-pointer"
            title="Takes History & Revisions"
          >
            <History className="h-3.5 w-3.5 text-accent" />
            <span className="hidden sm:inline">Takes</span>
            {vcsHistoryCount > 0 && (
              <Badge variant="outline" className="border-accent/40 bg-accent/15 text-accent text-[9px] px-1 py-0 h-3.5">
                {vcsHistoryCount}
              </Badge>
            )}
          </Button>

          {/* Continuity & Plot-Hole Auditor (ClickHouse Knowledge Firewall) */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setContinuityOpen(true)}
            className="h-7 px-2.5 gap-1.5 text-xs border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 cursor-pointer transition-colors"
            title="ClickHouse Asymmetric Knowledge & Continuity Audit"
          >
            <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
            <span className="hidden md:inline">Continuity Audit</span>
          </Button>

          {/* Asset Hub Vault Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAssetHubOpen(true)}
            className="h-7 px-2.5 gap-1.5 text-xs border-accent/50 bg-accent/10 hover:bg-accent/20 text-accent font-medium cursor-pointer transition-colors shadow-xs"
            title="Open Production Asset Hub & Media Library"
          >
            <Layers className="h-3.5 w-3.5 text-accent" />
            <span className="hidden sm:inline">Asset Hub</span>
          </Button>

          {/* Unified Creative Tools Dropdown Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center h-7 gap-1.5 text-xs font-medium border border-border/70 rounded-md px-2.5 bg-secondary/30 hover:bg-secondary/70 text-foreground cursor-pointer transition-colors">
              <Sparkles className="h-3.5 w-3.5 text-purple-400" />
              <span>Tools</span>
              <ChevronDown className="h-3 w-3 opacity-60" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 bg-card border-border shadow-2xl p-1.5 z-50">
              <DropdownMenuLabel className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-2 py-1">
                Media &amp; Character Lab
              </DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => setAssetHubOpen(true)}
                className="flex items-center gap-2.5 px-2.5 py-1.5 rounded text-xs cursor-pointer hover:bg-secondary"
              >
                <Layers className="h-4 w-4 text-accent shrink-0" />
                <div className="flex flex-col">
                  <span className="font-medium text-accent">Asset Hub &amp; Media Vault</span>
                  <span className="text-[10px] text-muted-foreground">Upload blueprints, faces, &amp; b-roll</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setCharacterLabOpen(true)}
                className="flex items-center gap-2.5 px-2.5 py-1.5 rounded text-xs cursor-pointer hover:bg-secondary"
              >
                <Users2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <div className="flex flex-col">
                  <span className="font-medium">Character DNA Lab</span>
                  <span className="text-[10px] text-muted-foreground">Modular casting &amp; voice chemistry</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setContinuityOpen(true)}
                className="flex items-center gap-2.5 px-2.5 py-1.5 rounded text-xs cursor-pointer hover:bg-secondary"
              >
                <ShieldAlert className="h-4 w-4 text-amber-400 shrink-0" />
                <div className="flex flex-col">
                  <span className="font-medium">Continuity &amp; Plot-Hole Auditor</span>
                  <span className="text-[10px] text-muted-foreground">ClickHouse knowledge firewall audit</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setScratchpadOpen(true)}
                className="flex items-center gap-2.5 px-2.5 py-1.5 rounded text-xs cursor-pointer hover:bg-secondary"
              >
                <FileText className="h-4 w-4 text-amber-400 shrink-0" />
                <div className="flex flex-col">
                  <span className="font-medium">Showrunner Scratchpad</span>
                  <span className="text-[10px] text-muted-foreground">Creative memos &amp; unformatted notes</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setLookbookOpen(true)}
                className="flex items-center gap-2.5 px-2.5 py-1.5 rounded text-xs cursor-pointer hover:bg-secondary"
              >
                <Film className="h-4 w-4 text-cyan-400 shrink-0" />
                <div className="flex flex-col">
                  <span className="font-medium">Director&apos;s Lookbook</span>
                  <span className="text-[10px] text-muted-foreground">Executive pitch &amp; production bible</span>
                </div>
              </DropdownMenuItem>

              <DropdownMenuSeparator className="my-1 bg-border/50" />

              <DropdownMenuLabel className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-2 py-1">
                Audio &amp; Multiverse Simulation
              </DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => setShowTableRead(true)}
                className="flex items-center gap-2.5 px-2.5 py-1.5 rounded text-xs cursor-pointer hover:bg-secondary"
              >
                <Volume2 className="h-4 w-4 text-cyan-400 shrink-0" />
                <div className="flex flex-col">
                  <span className="font-medium">Multi-Voice Table Read</span>
                  <span className="text-[10px] text-muted-foreground">Synchronized character voice playback</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setMultiverseOpen(true)}
                className="flex items-center gap-2.5 px-2.5 py-1.5 rounded text-xs cursor-pointer hover:bg-secondary"
              >
                <Shuffle className="h-4 w-4 text-purple-400 shrink-0" />
                <div className="flex flex-col">
                  <span className="font-medium">Alternate Takes</span>
                  <span className="text-[10px] text-muted-foreground">Multiverse branching scene takes</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setFusionOpen(true)}
                className="flex items-center gap-2.5 px-2.5 py-1.5 rounded text-xs cursor-pointer hover:bg-secondary"
              >
                <Sparkles className="h-4 w-4 text-accent shrink-0" />
                <div className="flex flex-col">
                  <span className="font-medium">Film Fusion</span>
                  <span className="text-[10px] text-muted-foreground">Crossover narrative synthesis</span>
                </div>
              </DropdownMenuItem>

              <DropdownMenuSeparator className="my-1 bg-border/50" />

              <DropdownMenuLabel className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-2 py-1">
                Production &amp; Telemetry
              </DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => router.push(`/studio/${projectId}/locations`)}
                className="flex items-center gap-2.5 px-2.5 py-1.5 rounded text-xs cursor-pointer hover:bg-secondary"
              >
                <MapPin className="h-4 w-4 text-cyan-400 shrink-0" />
                <div className="flex flex-col">
                  <span className="font-medium">Location Board</span>
                  <span className="text-[10px] text-muted-foreground">Real-world scouting, budget &amp; permits</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setTimeframeModalOpen(true)}
                className="flex items-center gap-2.5 px-2.5 py-1.5 rounded text-xs cursor-pointer hover:bg-secondary"
              >
                <Clock className="h-4 w-4 text-accent shrink-0" />
                <div className="flex flex-col">
                  <span className="font-medium">Runtime &amp; Blueprint Scope</span>
                  <span className="text-[10px] text-muted-foreground">{targetRuntimeMinutes}m · {narrativeFormat}</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setClickhouseToolboxOpen(true)}
                className="flex items-center gap-2.5 px-2.5 py-1.5 rounded text-xs cursor-pointer hover:bg-secondary"
              >
                <Database className="h-4 w-4 text-emerald-400 shrink-0" />
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium">ClickHouse MCP Toolbox</span>
                    <Badge variant="outline" className="text-[9px] border-emerald-500/30 text-emerald-400 py-0 px-1">
                      Official
                    </Badge>
                  </div>
                  <span className="text-[10px] text-muted-foreground">Live story queries &amp; state audit (Shift+C)</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setInspectorTab("grafana");
                  setIsClickHouseInspectorOpen(true);
                }}
                className="flex items-center gap-2.5 px-2.5 py-1.5 rounded text-xs cursor-pointer hover:bg-secondary"
              >
                <Activity className="h-4 w-4 text-emerald-400 shrink-0" />
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-emerald-300">Grafana Observability</span>
                    <Badge variant="outline" className="text-[9px] border-emerald-500/30 text-emerald-400 py-0 px-1 font-mono">
                      99.8% SLO
                    </Badge>
                  </div>
                  <span className="text-[10px] text-muted-foreground">PromQL telemetry, network RTT &amp; benchmark</span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="h-4 w-px bg-border/60 mx-0.5 shrink-0" />

          {/* Inspector Toggle (Planning mode only) */}
          {mainTab === "planning" && (
            <Button
              size="sm"
              variant={isSidebarOpen ? "secondary" : "ghost"}
              onClick={toggleSidebar}
              className={cn(
                "h-7 w-7 p-0 cursor-pointer transition-colors shrink-0",
                isSidebarOpen
                  ? "bg-secondary text-accent border border-accent/40 shadow-2xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
              )}
              title={isSidebarOpen ? "Hide Inspector Sidebar" : "Show Inspector Sidebar"}
            >
              <Sliders className="h-3.5 w-3.5" />
            </Button>
          )}

          {/* AI Commander Primary Action Button */}
          <Button
            size="sm"
            onClick={() => setAiCommanderOpen(true)}
            className="h-7 gap-1.5 text-xs bg-accent text-accent-foreground hover:bg-accent/90 font-semibold cursor-pointer px-2.5 shadow-xs shrink-0"
            title="Summon Studio AI Commander"
          >
            <Zap className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">AI Commander</span>
          </Button>

          <div className="h-4 w-px bg-border/60 mx-0.5 shrink-0" />

          <AuthUserButton className="h-7 text-xs" />
        </div>
      </header>

      {/* Active Studio Workspace */}
      <div className="flex-1 min-h-0 relative overflow-hidden flex flex-col">
        {mainTab === "planning" && (
          <ResizablePanelGroup orientation="vertical" className="h-full w-full">
          {/* Top Panel: Canvas + Resizable Inspector Sidebar */}
          <ResizablePanel
            panelRef={topPanelRef}
            collapsible={true}
            collapsedSize="0%"
            defaultSize="65%"
            minSize="15%"
            maxSize="90%"
            className="relative"
            onResize={(panelSize) => {
              if (isProgrammaticResize.current) return;
              if (panelSize.asPercentage <= 2) {
                setLayoutMode((prev) => (prev !== "dock-only" ? "dock-only" : prev));
              } else {
                const bottomSize = bottomPanelRef.current?.getSize()?.asPercentage;
                if (bottomSize !== undefined && bottomSize <= 2) {
                  setLayoutMode((prev) => (prev !== "canvas-only" ? "canvas-only" : prev));
                } else {
                  setLayoutMode((prev) => (prev !== "split" ? "split" : prev));
                }
              }
            }}
          >
            <ResizablePanelGroup orientation="horizontal" className="h-full w-full">
              {/* Left Panel: React Flow Story Canvas */}
              <ResizablePanel defaultSize="72%" minSize="20%">
                <div className="relative h-full w-full overflow-hidden bg-background">
                  <StoryCanvas
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onNodeClick={handleNodeClick}
                    onAddNode={handleAddBlueprintNode}
                    onDeleteEdge={handleDeleteEdge}
                    onLinkMultipleNodes={handleLinkMultipleNodes}
                    onUnlinkSelectedNodes={handleUnlinkSelectedNodes}
                    onUnlinkAllForNode={handleUnlinkAllForNode}
                    canUndo={canUndo}
                    canRedo={canRedo}
                    onUndo={handleUndo}
                    onRedo={handleRedo}
                    onOpenRevisions={() => setVersionControlOpen(true)}
                    revisionCount={vcsHistoryCount}
                    onAutoTidy={handleAutoTidy}
                    onOpenCommander={() => setAiCommanderOpen(true)}
                  />

                  {/* Canvas Only Quick Restore Pill */}
                  {layoutMode === "canvas-only" && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setViewMode("split")}
                        className="flex items-center gap-2 rounded-full border border-border/80 bg-card/95 px-4 py-2 text-xs font-semibold text-foreground shadow-2xl backdrop-blur hover:bg-secondary hover:border-accent transition-all cursor-pointer"
                      >
                        <PanelBottomOpen className="h-4 w-4 text-accent" />
                        <span>Open Staging Deck</span>
                        <span className="text-[10px] text-muted-foreground font-mono">({sceneTitle})</span>
                      </button>
                    </div>
                  )}
                </div>
              </ResizablePanel>

              {/* Vertical Separator Handle between Canvas and Sidebar */}
              <ResizableHandle withHandle />

              {/* Right Panel: Studio Parameter Inspector Sidebar */}
              <ResizablePanel
                panelRef={inspectorPanelRef}
                collapsible={true}
                collapsedSize="0%"
                defaultSize="28%"
                minSize="14%"
                maxSize="80%"
                onResize={(panelSize) => {
                  const open = panelSize.asPercentage > 2;
                  setIsSidebarOpen((prev) => (prev !== open ? open : prev));
                }}
              >
                <StudioInspector
                  selectedNode={selectedNode}
                  nodes={nodes}
                  edges={edges}
                  onSelectNode={(nodeId) => {
                    const found = nodes.find((n) => n.id === nodeId);
                    if (found) setSelectedNode(found);
                  }}
                  onUpdateNodeData={handleUpdateNodeData}
                  onDeleteEdge={handleDeleteEdge}
                  onAddEdge={(src, tgt) =>
                    onConnect({
                      source: src,
                      target: tgt,
                      sourceHandle: null,
                      targetHandle: null,
                    })
                  }
                  onUnlinkAllForNode={handleUnlinkAllForNode}
                  onOpenHotSeat={(charName) => {
                    setActiveCharacterName(charName);
                    setMainTab("simulation");
                    setSimulationTab("hotseat");
                  }}
                  onOpenScriptReader={() => setScriptViewerOpen(true)}
                  onOpenDeck={(subTab) => {
                    setMainTab("planning");
                    setDeckSubTab(subTab as DeckSubTab);
                  }}
                  onOpenTableRead={() => {
                    setMainTab("simulation");
                    setSimulationTab("audio");
                  }}
                  onClose={() => {
                    inspectorPanelRef.current?.collapse();
                    setIsSidebarOpen(false);
                  }}
                />
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>

          {/* Horizontal Resizable Handle between Canvas and Bottom Dock */}
          <ResizableHandle withHandle />

          {/* Bottom Panel: Resizable Cinema Dock */}
          <ResizablePanel
            panelRef={bottomPanelRef}
            collapsible={true}
            collapsedSize="0%"
            defaultSize="35%"
            minSize="10%"
            maxSize="85%"
            className="flex flex-col overflow-hidden bg-card/95 backdrop-blur border-t border-border"
            onResize={(panelSize) => {
              if (isProgrammaticResize.current) return;
              if (panelSize.asPercentage <= 2) {
                setLayoutMode((prev) => (prev !== "canvas-only" ? "canvas-only" : prev));
              } else {
                const topSize = topPanelRef.current?.getSize()?.asPercentage;
                if (topSize !== undefined && topSize <= 2) {
                  setLayoutMode((prev) => (prev !== "dock-only" ? "dock-only" : prev));
                } else {
                  setLayoutMode((prev) => (prev !== "split" ? "split" : prev));
                }
              }
            }}
          >
            {/* Director Staging Strip */}
            <div id="director-staging-dock" className="flex h-10 shrink-0 items-center justify-between border-b border-border px-4 bg-secondary/30">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider mr-1 hidden sm:inline">
                  Director Staging:
                </span>
                <button
                  type="button"
                  onClick={() => setDeckSubTab("blocking")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer",
                    deckSubTab === "blocking"
                      ? "bg-accent text-accent-foreground shadow-xs"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <Camera className="h-3.5 w-3.5 text-emerald-400" />
                  <span>2D Camera Blocking</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDeckSubTab("location")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer",
                    deckSubTab === "location"
                      ? "bg-accent text-accent-foreground shadow-xs"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <MapPin className="h-3.5 w-3.5 text-amber-400" />
                  <span>Scene Location &amp; Scout</span>
                  {(() => {
                    const currentScene = scenes.find((s) => s.id === activeSceneId);
                    return currentScene?.selectedLocationCandidateId ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                    ) : null;
                  })()}
                </button>

                <button
                  type="button"
                  onClick={() => setDeckSubTab("tension")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer",
                    deckSubTab === "tension"
                      ? "bg-accent text-accent-foreground shadow-xs"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <Activity className="h-3.5 w-3.5 text-cyan-400" />
                  <span>Tension Curve</span>
                </button>
              </div>

              {/* Status Badge & Dock View Controls */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMainTab("simulation")}
                  className="hidden md:flex items-center gap-1.5 text-xs text-cyan-300 hover:text-cyan-200 px-2.5 py-1 rounded-md border border-cyan-500/30 bg-cyan-500/10 cursor-pointer"
                  title="Switch to Pre-viz Simulation Suite (Shift+2)"
                >
                  <Cpu className="h-3 w-3" />
                  <span>Simulation Suite ↗</span>
                </button>

                <div className="h-3.5 w-[1px] bg-border" />

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setViewMode(layoutMode === "dock-only" ? "split" : "dock-only")}
                    className={cn(
                      "flex items-center gap-1 rounded px-2 py-0.5 text-xs transition-colors cursor-pointer",
                      layoutMode === "dock-only"
                        ? "bg-accent/20 text-accent font-medium border border-accent/40"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    )}
                    title={layoutMode === "dock-only" ? "Restore Split View" : "Maximize Bottom Panel (Hide Canvas)"}
                  >
                    {layoutMode === "dock-only" ? (
                      <>
                        <Minimize2 className="h-3.5 w-3.5" />
                        <span className="text-[11px]">Restore</span>
                      </>
                    ) : (
                      <>
                        <Maximize2 className="h-3.5 w-3.5" />
                        <span className="text-[11px]">Maximize</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setViewMode("canvas-only")}
                    className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer"
                    title="Hide Bottom Panel (Canvas Only)"
                  >
                    <PanelBottomClose className="h-3.5 w-3.5" />
                    <span className="text-[11px]">Hide</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Timeline Scrubber Bar for Staging Deck */}
            <div className="border-b border-border/50 px-4 py-2 bg-background/50 shrink-0">
              <TimelineScrubber
                durationSeconds={sceneDurationSeconds}
                value={timeSeconds}
                onChange={setTimeSeconds}
                events={events}
                scenePlacementSeconds={scenePlacementSeconds}
                sceneDurationSeconds={sceneDurationSeconds}
                sceneTitle={scenes.find((s) => s.id === activeSceneId)?.title || sceneTitle}
                sceneNumber={scenes.find((s) => s.id === activeSceneId)?.sceneNumber || 1}
                slugline={scenes.find((s) => s.id === activeSceneId)?.slugline || primaryLocation}
                isBridge={isBridgeScene(scenes.find((s) => s.id === activeSceneId))}
                onExtend={(delta) => setSceneDurationSeconds((prev) => Math.min(1200, prev + delta))}
                onShrink={(delta) => setSceneDurationSeconds((prev) => Math.max(60, prev - delta))}
              />
            </div>

            {/* Active Staging Deck Sub-View */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4">
              {deckSubTab === "blocking" && (
                <FloorPlanView
                  sceneTitle={sceneTitle}
                  characters={characters}
                  primaryLocation={primaryLocation}
                  screenplayText={screenplayText}
                  directorStyle={directorStyle}
                  initialMapUrl={floorPlanCustomMapUrl}
                  initialMapName={floorPlanCustomMapName}
                  initialMapConfig={floorPlanCustomMapConfig}
                  onMapChange={(mapUrl, mapName) => {
                    setFloorPlanCustomMapUrl(mapUrl);
                    setFloorPlanCustomMapName(mapName);
                    setScenes((prev) =>
                      prev.map((s) =>
                        s.id === activeSceneId
                          ? {
                              ...s,
                              floorPlanMapUrl: mapUrl || undefined,
                              floorPlanMapName: mapName || undefined,
                            }
                          : s
                      )
                    );
                    saveCurrentProject({
                      floorPlanMapUrl: mapUrl || undefined,
                      floorPlanMapName: mapName || undefined,
                      scenes: scenes.map((s) =>
                        s.id === activeSceneId
                          ? {
                              ...s,
                              floorPlanMapUrl: mapUrl || undefined,
                              floorPlanMapName: mapName || undefined,
                            }
                          : s
                      ),
                    });
                  }}
                  onMapConfigChange={(cfg) => {
                    setFloorPlanCustomMapConfig(cfg);
                    setScenes((prev) =>
                      prev.map((s) =>
                        s.id === activeSceneId
                          ? {
                              ...s,
                              floorPlanMapConfig: cfg,
                            }
                          : s
                      )
                    );
                    saveCurrentProject({
                      floorPlanMapConfig: cfg,
                      scenes: scenes.map((s) =>
                        s.id === activeSceneId
                          ? {
                              ...s,
                              floorPlanMapConfig: cfg,
                            }
                          : s
                      ),
                    });
                  }}
                  onSendToVideo={handleSendStagingToVideo}
                />
              )}
              {deckSubTab === "location" && (() => {
                const currentScene = scenes.find((s) => s.id === activeSceneId);
                if (!currentScene) {
                  return (
                    <div className="p-8 text-center text-xs text-muted-foreground">
                      No active scene selected.
                    </div>
                  );
                }
                const currentProjData: ProjectData = {
                  ...(getProjectById(projectId) || initialProject),
                  id: projectId,
                  title: projectTitle,
                  genre: genre,
                  premise: premiseInput,
                  scenes: scenes,
                  characters: characters,
                  shootRegion: initialProject.shootRegion || "Los Angeles, CA",
                  currency: initialProject.currency || "USD",
                  budget: initialProject.budget,
                  budgetAllocation: initialProject.budgetAllocation,
                };
                return (
                  <SceneLocationDock
                    project={currentProjData}
                    scene={currentScene}
                    onUpdateScene={(updated) => {
                      const nextScenes = scenes.map((s) => (s.id === updated.id ? updated : s));
                      setScenes(nextScenes);
                      if (updated.location) {
                        setPrimaryLocation(updated.location);
                      }
                      saveCurrentProject({
                        scenes: nextScenes,
                        primaryLocation: updated.location || primaryLocation,
                      });
                    }}
                    onUpdateProject={(upd) => {
                      saveCurrentProject(upd);
                    }}
                  />
                );
              })()}
              {deckSubTab === "tension" && (
                <TensionCurveView
                  currentTimeSeconds={timeSeconds}
                  onScrubTime={setTimeSeconds}
                  projectId={projectId}
                  characters={characters}
                  events={events}
                  sceneTitle={scenes.find((s) => s.id === activeSceneId)?.title || sceneTitle}
                  scenePlacementSeconds={scenePlacementSeconds}
                  sceneDurationSeconds={sceneDurationSeconds}
                  initialScope="macro"
                />
              )}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
        )}

        {/* TAB 2: Pre-viz Simulation Suite (Voice Cadence, Interrogation, Chemistry Bench, Showrunner Co-Pilot) */}
        {mainTab === "simulation" && (
          <div className="flex flex-1 flex-col min-h-0 overflow-hidden bg-background">
            {/* Simulation Sub-Navigation Bar */}
            <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-4 bg-card/60 backdrop-blur-sm">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider mr-2 hidden md:inline">
                  Simulation Arena:
                </span>

                <button
                  type="button"
                  onClick={() => setSimulationTab("audio")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer",
                    simulationTab === "audio"
                      ? "bg-accent text-accent-foreground shadow-xs"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <Headphones className="h-3.5 w-3.5 text-cyan-400" />
                  <span>AI Voice &amp; Cadence</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSimulationTab("hotseat")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer",
                    simulationTab === "hotseat"
                      ? "bg-accent text-accent-foreground shadow-xs"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <MessageSquare className="h-3.5 w-3.5 text-amber-400" />
                  <span>Character Interrogation</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSimulationTab("chemistry")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer",
                    simulationTab === "chemistry"
                      ? "bg-accent text-accent-foreground shadow-xs"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <Flame className="h-3.5 w-3.5 text-rose-400" />
                  <span>Dream Casting &amp; Chemistry</span>
                </button>
              </div>

              {/* Quick Links to Showrunner & Generation */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMainTab("showrunner")}
                  className="flex items-center gap-1.5 text-xs text-emerald-300 hover:text-emerald-200 px-2.5 py-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 cursor-pointer transition-colors"
                  title="Switch to Showrunner AI Co-Pilot (Shift+4)"
                >
                  <Bot className="h-3.5 w-3.5" />
                  <span>Showrunner AI ↗</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMainTab("generation")}
                  className="flex items-center gap-1.5 text-xs text-amber-300 hover:text-amber-200 px-2.5 py-1 rounded-md border border-amber-500/30 bg-amber-500/10 cursor-pointer transition-colors"
                  title="Switch to Omni Flash Media Generation (Shift+3)"
                >
                  <Film className="h-3.5 w-3.5" />
                  <span>Video Generation ↗</span>
                </button>
              </div>
            </div>

            {/* Sub-Tab 1: AI Voice & Audio Cadence */}
            {simulationTab === "audio" && (
              <div className="flex-1 min-h-0 overflow-hidden">
                <AudioStudioView
                  characters={characters}
                  screenplayText={screenplayText}
                  sceneTitle={sceneTitle}
                  onOpenVideoGenerator={() => setMainTab("generation")}
                />
              </div>
            )}

            {/* Sub-Tab 2: Character Interrogation Chamber */}
            {simulationTab === "hotseat" && (
              <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
                <div className="border-b border-border/50 px-4 py-2 bg-background/50 shrink-0 flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <TimelineScrubber
                      durationSeconds={sceneDurationSeconds}
                      value={timeSeconds}
                      onChange={setTimeSeconds}
                      events={events}
                      scenePlacementSeconds={scenePlacementSeconds}
                      sceneDurationSeconds={sceneDurationSeconds}
                      sceneTitle={scenes.find((s) => s.id === activeSceneId)?.title || sceneTitle}
                      sceneNumber={scenes.find((s) => s.id === activeSceneId)?.sceneNumber || 1}
                      slugline={scenes.find((s) => s.id === activeSceneId)?.slugline || primaryLocation}
                      isBridge={isBridgeScene(scenes.find((s) => s.id === activeSceneId))}
                      onExtend={(delta) => setSceneDurationSeconds((prev) => Math.min(1200, prev + delta))}
                      onShrink={(delta) => setSceneDurationSeconds((prev) => Math.max(60, prev - delta))}
                    />
                  </div>

                  {/* Character Quick Switcher */}
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[10px] uppercase font-mono text-muted-foreground mr-1 hidden sm:inline">
                      Subject:
                    </span>
                    {characters.map((c) => (
                      <button
                        key={c.name}
                        type="button"
                        onClick={() => setActiveCharacterName(c.name)}
                        className={`rounded px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
                          activeCharacterName === c.name
                            ? "bg-accent text-accent-foreground shadow-xs"
                            : "bg-secondary/40 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1 min-h-0 overflow-hidden p-3 flex flex-col">
                  {(() => {
                    const activeScene = scenes.find((s) => s.id === activeSceneId);
                    const isCastPresentInScene = activeScene
                      ? (activeScene.castPresent || []).some(
                          (c) => c.toLowerCase() === activeCharacterName.toLowerCase()
                        )
                      : true;
                    return (
                      <HotSeatChat
                        characterName={activeCharacterName}
                        characterArchetype={activeCharacter?.archetype}
                        currentTimecode={formatTimecode(timeSeconds)}
                        turns={hotSeatTurns}
                        knownFacts={knownFacts}
                        onSend={handleAskHotSeat}
                        onResetChat={() => setHotSeatTurns([])}
                        isAsking={isAsking}
                        onInsertIntoScript={handleInsertIntoScript}
                        activeSceneTitle={activeScene?.title || sceneTitle}
                        isCastPresentInScene={isCastPresentInScene}
                        suggestedQuestions={[
                          `What are you hiding right now at minute ${Math.round(timeSeconds / 60)}?`,
                          "Why won't you turn around and answer directly?",
                          "Where were you when the situation compromised?",
                        ]}
                        className="h-full w-full"
                      />
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Sub-Tab 3: Dream Casting & Friction Sandbox */}
            {simulationTab === "chemistry" && (
              <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between shrink-0">
                  <div>
                    <h4 className="font-heading text-sm font-bold text-foreground flex items-center gap-2">
                      <Flame className="h-4 w-4 text-rose-500" />
                      Dynamic Friction Sandbox ({characters[0]?.name || "Lead"} vs{" "}
                      {characters[1]?.name || "Counterpart"})
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Simulate how contrasting character motivations, secrets, and speech styles clash before production.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleRunChemistry}
                    disabled={isChemistryRunning}
                    className="bg-rose-500 hover:bg-rose-600 text-white font-semibold gap-1.5 cursor-pointer"
                  >
                    {isChemistryRunning ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        <span>Simulating Conflict...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>Run Chemistry Test</span>
                      </>
                    )}
                  </Button>
                </div>

                <div className="flex gap-3 shrink-0">
                  <input
                    type="text"
                    value={chemistryScenario}
                    onChange={(e) => setChemistryScenario(e.target.value)}
                    placeholder="Enter an environmental conflict scenario..."
                    className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>

                {chemistrySceneOutput ? (
                  <div className="flex-1 min-h-0 rounded-lg border border-border bg-card/60 p-4 font-mono text-xs leading-relaxed text-foreground overflow-y-auto shadow-inner">
                    <MarkdownRenderer content={chemistrySceneOutput} />
                  </div>
                ) : (
                  <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border/80 p-8 text-center text-xs text-muted-foreground">
                    Click &ldquo;Run Chemistry Test&rdquo; to simulate an impromptu friction scene between{" "}
                    {characters[0]?.name || "Lead"} and {characters[1]?.name || "Counterpart"}.
                  </div>
                )}
              </div>
            )}

          </div>
        )}

        {/* TAB 3: Gemini Omni Flash & Master Cinema Video Generator */}
        {mainTab === "generation" && (
          <GenerationStudioView
            projectId={projectId}
            nodes={nodes}
            edges={edges}
            sceneTitle={sceneTitle}
            sceneSummary={sceneSummary}
            screenplayText={screenplayText}
            characters={characters}
            genre={genre}
            projectTitle={projectTitle}
            onReturnToStudio={() => setMainTab("planning")}
            initialCameraMotion={stagedCameraMotion}
            initialPromptNote={stagedPromptNote}
            scenes={scenes}
            activeSceneId={activeSceneId}
            onSelectScene={(scId) => {
              setActiveSceneId(scId);
              const target = scenes.find((s) => s.id === scId);
              if (target) {
                setSceneTitle(target.title);
                setSceneSummary(target.summary);
                if (target.screenplayText) setScreenplayText(target.screenplayText);
              }
            }}
            onUpdateScene={(updated) => {
              const nextScenes = scenes.map((s) => (s.id === updated.id ? updated : s));
              setScenes(nextScenes);
              saveCurrentProject({
                scenes: nextScenes,
                ...(updated.id === activeSceneId
                  ? {
                      sceneTitle: updated.title,
                      sceneSummary: updated.summary,
                      screenplayText: updated.screenplayText || screenplayText,
                    }
                  : {}),
              });
            }}
          />
        )}

        {/* TAB 4: Showrunner AI Co-Pilot Dedicated Workspace */}
        {mainTab === "showrunner" && (
          <div className="flex flex-1 flex-col min-h-0 overflow-hidden bg-background">
            {/* Showrunner Header Bar */}
            <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-4 bg-card/60 backdrop-blur-sm">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center h-6 w-6 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                  <Bot className="h-3.5 w-3.5" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-foreground tracking-tight">
                    Showrunner AI Co-Pilot
                  </span>
                  <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10 text-[10px] font-mono">
                    Autonomous Creative Partner
                  </Badge>
                </div>
                <span className="text-[11px] text-muted-foreground hidden sm:inline border-l border-border pl-2 font-mono">
                  {projectTitle} &bull; {genre}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setInspectorTab("grafana");
                    setIsClickHouseInspectorOpen(true);
                  }}
                  className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-300 hover:text-foreground px-2 py-1 rounded border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 transition-all cursor-pointer"
                  title="Open Grafana Telemetry & Studio Health"
                >
                  <Activity className="h-3 w-3 text-emerald-400" />
                  <span>Grafana Health</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setInspectorTab("clickhouse");
                    setIsClickHouseInspectorOpen((prev) => !prev);
                  }}
                  className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground hover:text-foreground px-2 py-1 rounded border border-border bg-secondary/30 transition-colors cursor-pointer"
                  title="Toggle ClickHouse Telemetry & Query Log (Shift+C)"
                >
                  <Database className="h-3 w-3 text-amber-400" />
                  <span>ClickHouse</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMainTab("planning")}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2.5 py-1 rounded-md border border-border bg-secondary/40 cursor-pointer transition-colors"
                  title="Return to Studio Blueprint (Shift+1)"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Back to Studio</span>
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-hidden p-3 md:p-4 flex flex-col">
              <ShowrunnerChat
                messages={showrunnerMessages}
                isThinking={isShowrunnerThinking}
                onSendMessage={handleSendShowrunner}
                onResetChat={() => {
                  setShowrunnerMessages([
                    {
                      role: "showrunner",
                      content: `Showrunner AI Director session reset for "${projectTitle}". How shall we refine the reel?`,
                    },
                  ]);
                }}
                suggestedPrompts={[
                  `Analyze dramatic tension for ${projectTitle}`,
                  `Suggest subtext improvements for ${activeCharacterName}'s dialogue`,
                  "Query ClickHouse box-office precedents for this premise",
                  "Showrunner, check studio health and Grafana telemetry status",
                  `Draft a plot twist connecting ${sceneTitle} to the climax`,
                ]}
                className="h-full w-full"
              />
            </div>
          </div>
        )}
      </div>

      {/* ClickHouse Live Query Inspector Drawer */}
      <ClickHouseInspector
        logs={queryLogs}
        lastSql={lastSql}
        isOpen={isClickHouseInspectorOpen}
        initialTab={inspectorTab}
        onToggle={() => setIsClickHouseInspectorOpen(!isClickHouseInspectorOpen)}
        onClose={() => setIsClickHouseInspectorOpen(false)}
      />

      {/* Screenplay Reader & Editor Modal with Multi-POV Support */}
      <ScreenplayDialog
        open={scriptViewerOpen}
        onOpenChange={setScriptViewerOpen}
        title={sceneTitle}
        summary={sceneSummary}
        screenplayText={screenplayText}
        characters={characters}
        currentTimecode={formatTimecode(timeSeconds)}
        onOpenHotSeat={(name) => {
          setScriptViewerOpen(false);
          setActiveCharacterName(name);
          setMainTab("simulation");
          setSimulationTab("hotseat");
        }}
        onSaveScript={(newScript) => {
          setScreenplayText(newScript);
          saveCurrentProject({ screenplayText: newScript });
        }}
        onReshard={handleReshardScript}
        isResharding={isGenerating}
      />

      {/* Modular Character Lab & Talent Vault Modal */}
      <CharacterLabDialog
        open={characterLabOpen}
        onOpenChange={setCharacterLabOpen}
        characters={characters}
        onUpdateCharacters={(updatedChars) => {
          setCharacters(updatedChars);
          saveCurrentProject({ characters: updatedChars });
          if (updatedChars.length > 0) {
            setActiveCharacterName(updatedChars[0].name);
          }
          syncGraphWithProject({
            ...initialProject,
            characters: updatedChars,
          });
        }}
        onOpenHotSeat={(name) => {
          setCharacterLabOpen(false);
          setActiveCharacterName(name);
          setMainTab("simulation");
          setSimulationTab("hotseat");
        }}
        onSendToVideo={(char) => {
          setVideoCharacterContext(char);
          setCharacterLabOpen(false);
          setVideoGenOpen(true);
        }}
      />

      {/* Showrunner Scratchpad & Creative Brain */}
      <ScratchpadDialog
        open={scratchpadOpen}
        onOpenChange={setScratchpadOpen}
        projectId={projectId}
        onApplyNoteToScript={(noteText) => {
          const updated = `${screenplayText}\n\n// SCRATCHPAD BEAT:\n${noteText}`;
          setScreenplayText(updated);
          saveCurrentProject({ screenplayText: updated });
          toast.add({
            title: "Appended to Screenplay",
            description: "Scratchpad memo inserted into master screenplay.",
            type: "success",
          });
        }}
      />

      {/* Production Asset Hub & Media Vault */}
      <AssetHubDialog
        open={assetHubOpen}
        onOpenChange={setAssetHubOpen}
        projectId={projectId}
        projectTitle={projectTitle}
        onSetFloorPlanMap={(mapUrl, asset) => {
          setFloorPlanCustomMapUrl(mapUrl);
          setFloorPlanCustomMapName(asset.name);
          setScenes((prev) =>
            prev.map((s) =>
              s.id === activeSceneId
                ? {
                    ...s,
                    floorPlanMapUrl: mapUrl || undefined,
                    floorPlanMapName: asset.name || undefined,
                  }
                : s
            )
          );
          saveCurrentProject({
            floorPlanMapUrl: mapUrl || undefined,
            floorPlanMapName: asset.name || undefined,
            scenes: scenes.map((s) =>
              s.id === activeSceneId
                ? {
                    ...s,
                    floorPlanMapUrl: mapUrl || undefined,
                    floorPlanMapName: asset.name || undefined,
                  }
                : s
            ),
          });
          setMainTab("planning");
          setDeckSubTab("blocking");
          setAssetHubOpen(false);
          toast.add({
            title: "2D Floor Plan Active",
            description: `Switched to 2D Blocking canvas with "${asset.name}".`,
            type: "success",
          });
        }}
        onSendToVideo={(_imageUrl, asset) => {
          setVideoGenOpen(true);
          setAssetHubOpen(false);
          toast.add({
            title: "Omni Flash Pre-viz",
            description: `Conditioning the render with "${asset.name}".`,
            type: "success",
          });
        }}
        onSetCharacterFace={(_imageUrl, _asset) => {
          setCharacterLabOpen(true);
          setAssetHubOpen(false);
        }}
        onAddToSceneScout={(_imageUrl, _asset) => {
          setMainTab("planning");
          setDeckSubTab("location");
          setAssetHubOpen(false);
        }}
        onInsertToTimeline={(_mediaUrl, _asset) => {
          setMainTab("generation");
          setAssetHubOpen(false);
        }}
        onAddToLyraScore={(_imageUrl, _asset) => {
          setMainTab("generation");
          setAssetHubOpen(false);
        }}
      />

      {/* Director's Pitch Lookbook & Production Bible */}
      <DirectorLookbookDialog
        open={lookbookOpen}
        onOpenChange={setLookbookOpen}
        projectTitle={projectTitle}
        genre={genre}
        premise={premiseInput}
        sceneTitle={sceneTitle}
        sceneSummary={sceneSummary}
        characters={characters}
        directorStyle={directorStyle}
        coreSecret={coreSecret}
        primaryLocation={primaryLocation}
        targetTerritories={targetTerritories}
      />

      {/* Audio Table Read Modal */}
      <Dialog open={showTableRead} onOpenChange={setShowTableRead}>
        <DialogContent className="max-w-2xl bg-card border-border p-5">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-cyan-400" />
              <DialogTitle className="text-base font-heading">
                Multi-Voice Audio Table Read · {sceneTitle}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Synchronized actor voice synthesis for script rhythm &amp; cadence testing.
            </DialogDescription>
          </DialogHeader>
          <TableReadPlayer
            screenplayText={screenplayText}
            className="border-0 bg-transparent p-0"
            hideHeader
          />
        </DialogContent>
      </Dialog>

      {/* Hollywood Slate Version Control & Take Changelog Modal */}
      <VersionControlDialog
        open={versionControlOpen}
        onOpenChange={setVersionControlOpen}
        vcs={vcs}
        onRevertSnapshot={handleRevertSnapshot}
      />

      {/* Centralized Studio Executive AI Commander Dialog */}
      <AICommanderDialog
        open={aiCommanderOpen}
        onOpenChange={setAiCommanderOpen}
        onExecutePrompt={handleExecuteCommanderPrompt}
      />

      {/* ClickHouse MCP Database Toolbox Modal */}
      <ClickHouseToolboxDialog
        open={clickhouseToolboxOpen}
        onOpenChange={setClickhouseToolboxOpen}
        projectId={projectId}
        queryLogs={queryLogs}
      />

      {/* Gemini Omni Flash Cinema Video Generation Modal */}
      <VideoGenerationDialog
        open={videoGenOpen}
        onOpenChange={(isOpen) => {
          setVideoGenOpen(isOpen);
          if (!isOpen) {
            setVideoCharacterContext(null);
          }
        }}
        projectId={projectId}
        sceneId={activeSceneId}
        onTakeCreated={(take) => {
          const nextScenes = scenes.map((s) =>
            s.id === activeSceneId
              ? {
                  ...s,
                  activeVideoUrl: take.videoUrl,
                  videoTakes: [take, ...(s.videoTakes || []).filter((t) => t.id !== take.id)],
                }
              : s
          );
          setScenes(nextScenes);
          saveCurrentProject({
            scenes: nextScenes,
            activeVideoUrl: take.videoUrl,
          });
        }}
        nodes={nodes}
        sceneTitle={sceneTitle}
        sceneSummary={sceneSummary}
        screenplayText={screenplayText}
        genre={genre}
        characters={characters}
        characterContext={videoCharacterContext || undefined}
        activeCharacterName={activeCharacterName}
        visualPrompt={
          videoCharacterContext
            ? `Cinematic 16:9 take featuring ${videoCharacterContext.name}${
                videoCharacterContext.wardrobe ? `, wearing ${videoCharacterContext.wardrobe}` : ""
              }. ${
                videoCharacterContext.visualDescription || ""
              } in ${sceneTitle}. 35mm anamorphic scope.`
            : ((nodes.find((n) => n.type === "storyboard")?.data?.prompt as string) ||
              `Cinematic 16:9 widescreen establishing shot of ${sceneTitle}. Moody shadows, photoreal 35mm film.`)
        }
      />

      {/* Multiverse Alternate Takes Modal */}
      <MultiverseTakesDialog
        open={multiverseOpen}
        onOpenChange={setMultiverseOpen}
        onApplyTake={handleApplyTake}
        projectTitle={projectTitle}
        characters={characters}
        screenplayText={screenplayText}
      />

      {/* Physical Production Location Dossier Dialog */}
      <LocationDossierDialog
        candidate={dossierCandidate}
        isOpen={dossierOpen}
        onClose={() => setDossierOpen(false)}
        scene={scenes.find((s) => s.id === activeSceneId) || scenes[0]}
        currency={(initialProject.currency as any) || "USD"}
        isLocked={Boolean(
          dossierCandidate &&
            scenes.find((s) => s.id === activeSceneId)?.selectedLocationCandidateId === dossierCandidate.candidate_id
        )}
        onLockCandidate={(cand) => {
          const cur = scenes.find((s) => s.id === activeSceneId) || scenes[0];
          if (cur) {
            const updated = {
              ...cur,
              selectedLocationCandidateId: cand.candidate_id,
              location: cand.name,
            };
            const nextScenes = scenes.map((s) => (s.id === cur.id ? updated : s));
            setScenes(nextScenes);
            saveCurrentProject({ scenes: nextScenes });
          }
        }}
        onUnlockCandidate={() => {
          const cur = scenes.find((s) => s.id === activeSceneId) || scenes[0];
          if (cur) {
            const updated = {
              ...cur,
              selectedLocationCandidateId: undefined,
            };
            const nextScenes = scenes.map((s) => (s.id === cur.id ? updated : s));
            setScenes(nextScenes);
            saveCurrentProject({ scenes: nextScenes });
          }
        }}
      />

      {/* Continuity & Plot-Hole Auditor Modal (ClickHouse Knowledge Firewalls) */}
      <ContinuityCheckerDialog
        open={continuityOpen}
        onOpenChange={setContinuityOpen}
        projectId={projectId}
        projectTitle={projectTitle}
        screenplayText={screenplayText}
        characters={characters}
        scenes={scenes}
        onApplyFix={(fixedSnippet, originalCitation) => {
          if (originalCitation && screenplayText.includes(originalCitation)) {
            const updated = screenplayText.replace(originalCitation, fixedSnippet);
            setScreenplayText(updated);
            saveCurrentProject({ screenplayText: updated });
          } else {
            const updated = `${screenplayText}\n\n/* Continuity Revision */\n${fixedSnippet}`;
            setScreenplayText(updated);
            saveCurrentProject({ screenplayText: updated });
          }
        }}
      />

      {/* Film Fusion Crossover Modal */}
      <FilmFusionDialog
        open={fusionOpen}
        onOpenChange={setFusionOpen}
        onFusionComplete={() => {
          setAllProjects(getAllProjects());
        }}
      />

      {/* Project Settings / Configuration Modal */}
      <EditProjectDialog
        open={projectSettingsOpen}
        onOpenChange={setProjectSettingsOpen}
        project={{
          id: projectId,
          title: projectTitle,
          genre,
          premise: premiseInput,
          directorStyle,
          coreSecret,
          primaryLocation,
          targetTerritories,
          characters,
          narrativeFormat,
          targetRuntimeMinutes,
          scenes,
          activeSceneId,
          sceneTitle,
          sceneSummary,
          screenplayText,
          initialEvents: events,
          createdAt: initialProject.createdAt || Date.now(),
          updatedAt: Date.now(),
        }}
        onSaveProject={(updated) => {
          setProjectTitle(updated.title);
          setGenre(updated.genre);
          setPremiseInput(updated.premise);
          setDirectorStyle(updated.directorStyle || "");
          setCoreSecret(updated.coreSecret || "");
          setPrimaryLocation(updated.primaryLocation || "");
          setTargetTerritories(updated.targetTerritories || []);
          setCharacters(updated.characters || []);
          setNarrativeFormat(updated.narrativeFormat || "feature");
          setTargetRuntimeMinutes(updated.targetRuntimeMinutes || 95);
          saveCurrentProject(updated);
        }}
      />

      {/* Active Scene Metadata & Slugline Edit Modal */}
      {(() => {
        const currentScene = scenes.find((s) => s.id === activeSceneId);
        return (
          <CreateSceneDialog
            open={sceneSettingsOpen}
            onOpenChange={setSceneSettingsOpen}
            projectTitle={projectTitle}
            projectCharacters={characters}
            nextSceneNumber={scenes.length + 1}
            onAddScene={() => {}}
            sceneToEdit={currentScene || null}
            onUpdateScene={(updated) => {
              setSceneTitle(updated.title);
              setSceneSummary(updated.summary);
              if (updated.screenplayText) {
                setScreenplayText(updated.screenplayText);
              }
              const nextScenes = scenes.map((s) => (s.id === updated.id ? updated : s));
              setScenes(nextScenes);
              saveCurrentProject({
                scenes: nextScenes,
                sceneTitle: updated.title,
                sceneSummary: updated.summary,
                screenplayText: updated.screenplayText || screenplayText,
              });
              toast.add({
                title: "Scene Details Saved",
                description: `Saved changes to Scene ${updated.sceneNumber}: "${updated.title}".`,
                type: "success",
              });
            }}
            existingScenes={scenes}
          />
        );
      })()}

      {/* New Project Slate Creation Dialog */}
      <NewProjectDialog
        open={newProjectOpen}
        onOpenChange={setNewProjectOpen}
        isSubmitting={isGeneratingProject}
        onSubmit={async (data) => {
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
              console.warn("AI generation notice:", e);
            }

            const newProject = createNewProjectEntry({
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
              newProject.scenes = genData.scenes;
              newProject.activeSceneId = genData.scenes[0].id;
              newProject.sceneTitle = genData.scenes[0].title;
              newProject.sceneSummary = genData.scenes[0].summary;
              newProject.screenplayText = genData.scenes[0].screenplayText;
              if (genData.scenes[0].location) {
                newProject.primaryLocation = genData.scenes[0].location;
              }
            }
            if (genData?.characters && Array.isArray(genData.characters) && genData.characters.length > 0) {
              newProject.characters = genData.characters;
            }

            if (genData?._generatedBy === "semantic-showrunner-fallback") {
              toast.add({
                title: "Sequence Breakdown: showing template scenes",
                description: "Gemini was unreachable, so this sequence is a curated template, not live AI output.",
                type: "warning",
              });
            }

            saveProject(newProject);
            setAllProjects(getAllProjects());
            setNewProjectOpen(false);
            router.push(`/studio/${newProject.id}`);
          } catch (err) {
            console.error("Project creation error:", err);
          } finally {
            setIsGeneratingProject(false);
          }
        }}
      />

      {/* Project Timeframe & Scope Configuration Dialog */}
      <ProjectTimeframeDialog
        open={timeframeModalOpen}
        onOpenChange={setTimeframeModalOpen}
        projectId={projectId}
        projectTitle={projectTitle}
        genre={genre}
        targetRuntimeMinutes={targetRuntimeMinutes}
        narrativeFormat={narrativeFormat}
        scenePlacementSeconds={scenePlacementSeconds}
        sceneDurationSeconds={sceneDurationSeconds}
        directorStyle={directorStyle}
        coreSecret={coreSecret}
        primaryLocation={primaryLocation}
        targetTerritories={targetTerritories}
        onSave={handleSaveTimeframe}
      />

      {/* Real-time Autonomous Agent Generation Overlay */}
      {isGenerating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md">
          <div className="max-w-md w-full mx-4 rounded-xl border border-accent/40 bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-accent/15 border border-accent/30 text-accent">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
              <div>
                <SlateLabel>BlendEye Engine</SlateLabel>
                <h3 className="text-base font-heading font-bold text-foreground">
                  Autonomous Writers&apos; Room
                </h3>
              </div>
            </div>

            <div className="space-y-2 rounded-lg bg-secondary/30 p-3.5 border border-border">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground">Active Agent Stage:</span>
                <span className="font-mono text-[11px] text-accent animate-pulse">Running</span>
              </div>
              <p className="text-xs text-muted-foreground font-mono leading-relaxed">
                {generationStage || "Orchestrating Gemini 3.7 Flash & ClickHouse Story Event Engine..."}
              </p>
            </div>

            <div className="text-[11px] text-muted-foreground text-center">
              Generating screenplay text, sharding character knowledge firewalls, and synchronizing blueprint node graph.
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={handleCancelPipeline}
              className="w-full text-xs cursor-pointer"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function StudioPage() {
  return (
    <AuthGate>
      <StudioWorkspace />
    </AuthGate>
  );
}
