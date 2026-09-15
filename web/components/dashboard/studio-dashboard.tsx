"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search,
  Star,
  Clock,
  Home,
  Film,
  Shuffle,
  Database,
  Sparkles,
  Plus,
  Tv,
  Palette,
  Trash2,
  ChevronRight,
  Clapperboard,
  PanelLeft,
  PanelLeftClose,
  Users,
  Compass,
  Zap,
  X,
  FileText,
  LogOut,
  LogIn,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getAllProjects,
  syncProjectsWithSupabase,
  saveProject,
  toggleStarProject,
  deleteProject,
  createNewProjectEntry,
  ensureProjectScenes,
  type ProjectData,
} from "@/lib/project-store";
import {
  NewProjectDialog,
  type NewProjectFormData,
} from "@/components/cinema/new-project-dialog";
import { VAULT_PROTOCOL_PRESET } from "@/lib/demo-preset";
import { FilmFusionDialog } from "@/components/cinema/film-fusion-dialog";
import { ClickHouseToolboxDialog } from "@/components/cinema/clickhouse-toolbox-dialog";
import { CharacterLabDialog } from "@/components/cinema/character-lab-dialog";
import { ScratchpadDialog } from "@/components/cinema/scratchpad-dialog";
import { OnboardingDialog } from "@/components/cinema/onboarding-dialog";
import { AuthUserButton } from "@/components/cinema/auth-user-button";
import { StudioChatWorkspace } from "./studio-chat-workspace";

type DashboardTab = "home" | "projects" | "starred" | "recent" | "fusion";

const GENRE_STYLES: Record<string, { gradient: string; accent: string; badge: string }> = {
  heist: {
    gradient: "from-amber-950/40 via-background to-background",
    accent: "border-amber-500/30 text-amber-400",
    badge: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  },
  "sci-fi": {
    gradient: "from-cyan-950/40 via-background to-background",
    accent: "border-cyan-500/30 text-cyan-400",
    badge: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
  },
  noir: {
    gradient: "from-purple-950/40 via-background to-background",
    accent: "border-purple-500/30 text-purple-400",
    badge: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  },
  drama: {
    gradient: "from-rose-950/40 via-background to-background",
    accent: "border-rose-500/30 text-rose-400",
    badge: "bg-rose-500/10 text-rose-400 border-rose-500/30",
  },
  thriller: {
    gradient: "from-emerald-950/40 via-background to-background",
    accent: "border-emerald-500/30 text-emerald-400",
    badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  },
  default: {
    gradient: "from-slate-900/50 via-background to-background",
    accent: "border-border text-foreground",
    badge: "bg-secondary text-muted-foreground border-border",
  },
};

function getGenreStyle(genre: string) {
  const g = (genre || "").toLowerCase();
  if (g.includes("heist") || g.includes("crime")) return GENRE_STYLES.heist;
  if (g.includes("sci-fi") || g.includes("space")) return GENRE_STYLES["sci-fi"];
  if (g.includes("noir") || g.includes("cyber")) return GENRE_STYLES.noir;
  if (g.includes("drama") || g.includes("character")) return GENRE_STYLES.drama;
  if (g.includes("thriller") || g.includes("action")) return GENRE_STYLES.thriller;
  return GENRE_STYLES.default;
}

export function StudioDashboard() {
  const router = useRouter();
  const { user, signOut, loading: authLoading } = useAuth();

  // Navigation & View state
  const [activeTab, setActiveTab] = React.useState<DashboardTab>("home");
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedGenreFilter, setSelectedGenreFilter] = React.useState<string>("All");
  const [sortBy, setSortBy] = React.useState<"updated" | "title" | "scenes">("updated");

  // Project data state
  const [projects, setProjects] = React.useState<ProjectData[]>([]);

  // Dialog states
  const [newProjectOpen, setNewProjectOpen] = React.useState(false);
  const [isGeneratingProject, setIsGeneratingProject] = React.useState(false);
  const [fusionOpen, setFusionOpen] = React.useState(false);
  const [toolboxOpen, setToolboxOpen] = React.useState(false);
  const [characterLabOpen, setCharacterLabOpen] = React.useState(false);
  const [scratchpadOpen, setScratchpadOpen] = React.useState(false);
  const [onboardingOpen, setOnboardingOpen] = React.useState(false);

  // ClickHouse connection status for the header badge — actually probed, not hardcoded
  const [clickhouseLive, setClickhouseLive] = React.useState<boolean | null>(null);
  const [clickhousePingMs, setClickhousePingMs] = React.useState<number | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/metrics")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setClickhouseLive(!data._fallback && data.mcp_servers?.clickhouse_mcp === "online");
        setClickhousePingMs(data.telemetry?.clickhouse_ping_ms ?? null);
      })
      .catch(() => {
        if (cancelled) return;
        setClickhouseLive(false);
        setClickhousePingMs(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Most recently edited project — used as the implicit target for global
  // (not per-card) actions like the header Character Lab button, since those
  // have no project context of their own.
  const mostRecentProject = React.useMemo(() => {
    if (projects.length === 0) return null;
    return [...projects].sort(
      (a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0)
    )[0];
  }, [projects]);

  // Load projects for the signed-in account. The AuthGate above has already
  // hydrated the store from Supabase, so the cache read is authoritative; the
  // refetch is a cheap correctness backstop, not the primary source.
  const refreshProjects = React.useCallback(async () => {
    setProjects(getAllProjects());
    if (!user) return;
    try {
      const cloudProjects = await syncProjectsWithSupabase();
      setProjects(cloudProjects.map(ensureProjectScenes));
    } catch (err) {
      console.warn("[Dashboard] Cloud refresh error, keeping cached state:", err);
    }
  }, [user]);

  React.useEffect(() => {
    // Wait until auth state is known before reading projects to prevent anon/auth flash
    if (authLoading) return;

    refreshProjects();
    const handleAuthChange = () => {
      refreshProjects();
    };

    window.addEventListener("agentic_cinema_auth_changed", handleAuthChange);
    return () => {
      window.removeEventListener("agentic_cinema_auth_changed", handleAuthChange);
    };
  }, [refreshProjects, user, authLoading]);

  // First-visit onboarding — shown once per session for accounts with no work
  // yet. This is intentionally session-scoped rather than persisted.
  const onboardingShownRef = React.useRef(false);
  React.useEffect(() => {
    if (authLoading || !user) return;
    if (!onboardingShownRef.current && projects.length === 0) {
      onboardingShownRef.current = true;
      setOnboardingOpen(true);
    }
  }, [authLoading, user, projects.length]);

  // Pre-warm agent-service sidecar on dashboard load to mitigate cold starts
  React.useEffect(() => {
    fetch("/api/health").catch(() => {});
  }, []);

  const handleOnboardingOpenChange = (nextOpen: boolean) => {
    setOnboardingOpen(nextOpen);
  };

  // One-click demo preset — "The Vault Protocol" heist thriller.
  // Runs through the exact same generation + sharding pipeline as the
  // wizard (see project_create.md), just pre-filled so nobody has to type the
  // fields in by hand. The preset itself is shared with the public landing
  // page (see lib/demo-preset.ts) so the two cannot drift.
  const handleLoadDemoProject = () => {
    // Opens the same dialog so its full-screen "Architecting Production
    // Slate" loading overlay covers the (unused) form steps instead of the
    // button just looking frozen while Gemini generates + ClickHouse shards.
    setNewProjectOpen(true);
    handleCreateNewProject(VAULT_PROTOCOL_PRESET);
  };

  // Handle New Project from dialog with Autonomous AI Showrunner Sequence Architect
  const handleCreateNewProject = async (data: NewProjectFormData) => {
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
        userId: user?.id || undefined,
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
      refreshProjects();
      router.push(`/studio/${project.id}?pipeline=1`);
      // Keep the dialog + loading overlay mounted through navigation so the
      // user isn't left staring at a blank dashboard while the studio route loads.
    } catch (err) {
      console.error("Failed to create project:", err);
      setIsGeneratingProject(false);
    }
  };

  // Handle Starring
  const handleToggleStar = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    toggleStarProject(id);
    refreshProjects();
  };

  // Handle Deleting
  const handleDelete = (id: string, title: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (confirm(`Are you sure you want to remove "${title}" from your studio slate?`)) {
      deleteProject(id);
      // Optimistic local update — deleteProject fires its Supabase DELETE
      // without awaiting it, so an immediate refreshProjects() GET can race
      // ahead of that delete committing server-side and bring the project
      // back in the cloud list, requiring a second click to actually remove
      // it. Filtering it out of local state now avoids depending on that
      // race resolving in our favor; refreshProjects() still runs after to
      // reconcile with the server once the delete has had time to land.
      setProjects((prev) => prev.filter((p) => p.id !== id));
      refreshProjects();
    }
  };

  // Filter and sort projects (with defensive checks to prevent runtime errors)
  const filteredProjects = React.useMemo(() => {
    let list = [...projects];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((p) => {
        const titleMatch = (p.title || "").toLowerCase().includes(q);
        const premiseMatch = (p.premise || "").toLowerCase().includes(q);
        const genreMatch = (p.genre || "").toLowerCase().includes(q);
        const charMatch =
          Array.isArray(p.characters) &&
          p.characters.some((c: any) => {
            if (typeof c === "string") return c.toLowerCase().includes(q);
            return (
              (c?.name || "").toLowerCase().includes(q) ||
              (c?.role || "").toLowerCase().includes(q) ||
              (c?.archetype || "").toLowerCase().includes(q)
            );
          });
        return titleMatch || premiseMatch || genreMatch || charMatch;
      });
    }

    if (selectedGenreFilter !== "All") {
      list = list.filter((p) => (p.genre || "").toLowerCase().includes(selectedGenreFilter.toLowerCase()));
    }

    if (activeTab === "starred") {
      list = list.filter((p) => p.isStarred);
    }

    if (sortBy === "title") {
      list.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    } else if (sortBy === "scenes") {
      list.sort((a, b) => (b.nodes?.length || 0) - (a.nodes?.length || 0));
    } else {
      list.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
    }

    return list;
  }, [projects, searchQuery, selectedGenreFilter, activeTab, sortBy]);

  const starredCount = projects.filter((p) => p.isStarred).length;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground selection:bg-accent/30 selection:text-accent-foreground font-sans">
      {/* ──────────────────────────────────────────────────────────
          LEFT SIDEBAR (Inspired by Bolt.new Workspace Hub)
      ────────────────────────────────────────────────────────── */}
      <aside
        className={`relative flex flex-col shrink-0 bg-[#0c0d10] transition-all duration-300 ease-in-out z-30 ${
          sidebarCollapsed
            ? "w-0 border-none overflow-hidden opacity-0 pointer-events-none p-0"
            : "w-64 border-r border-border opacity-100"
        }`}
      >
        {/* Brand Header */}
        <div className="flex h-14 items-center justify-between px-3.5 border-b border-border/80 shrink-0">
          <Link href="/" className="flex items-center gap-2.5 overflow-hidden group">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-black/50 border border-accent/30 overflow-hidden shadow-sm group-hover:scale-105 transition-transform">
              <img src="/logo.png" alt="BlendEye" className="h-full w-full object-cover" />
            </div>
            <div className="flex flex-col">
              <span className="font-heading text-xs font-black tracking-wider uppercase text-foreground">
                BlendEye
              </span>
              <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                Studio Lot v2.5
              </span>
            </div>
          </Link>

          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setSidebarCollapsed(true)}
            className="text-muted-foreground hover:text-foreground shrink-0 h-7 w-7"
            title="Collapse sidebar"
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        </div>

        {/* Search Input in Sidebar */}
        <div className="px-3 pt-3 pb-1 relative shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setActiveTab("projects");
                }
              }}
              placeholder="Search slates..."
              className="h-8 w-full rounded-lg border border-border bg-secondary/40 pl-8 pr-7 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent/50 transition-colors"
            />
            {searchQuery ? (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                title="Clear search"
              >
                <X className="h-3 w-3" />
              </button>
            ) : (
              <kbd className="absolute right-2 top-1/2 -translate-y-1/2 rounded border border-border bg-background px-1 py-0.5 text-[9px] font-mono text-muted-foreground pointer-events-none">
                ⌘K
              </kbd>
            )}
          </div>

          {/* Instant Search Dropdown when typing in sidebar */}
          {searchQuery.trim().length > 0 && (
            <div className="absolute left-3 right-3 top-full mt-1 rounded-xl border border-border bg-[#15171f] shadow-2xl p-1.5 z-40 max-h-60 overflow-y-auto space-y-1">
              <div className="flex items-center justify-between px-2 py-1 text-[10px] font-mono uppercase text-muted-foreground border-b border-border/40">
                <span>Matching Slates ({filteredProjects.length})</span>
                <button
                  onClick={() => setActiveTab("projects")}
                  className="text-accent hover:underline lowercase font-sans text-[11px]"
                >
                  view all
                </button>
              </div>

              {filteredProjects.length > 0 ? (
                filteredProjects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      router.push(`/studio/${p.id}`);
                      setSearchQuery("");
                    }}
                    className="w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-foreground hover:bg-secondary/70 text-left transition-colors group"
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <span className="font-medium text-xs truncate group-hover:text-accent transition-colors">
                        {p.title}
                      </span>
                      <span className="text-[10px] text-muted-foreground truncate">
                        {p.genre}
                      </span>
                    </div>
                    <ChevronRight className="h-3 w-3 text-muted-foreground group-hover:text-accent shrink-0" />
                  </button>
                ))
              ) : (
                <div className="px-3 py-3 text-center text-xs text-muted-foreground">
                  No slates match &quot;{searchQuery}&quot;
                </div>
              )}
            </div>
          )}
        </div>

        {/* User / Director Profile Card */}
        <div className="px-3 py-2 border-b border-border/60 shrink-0">
          {user ? (
            <div className="flex items-center gap-2.5 rounded-lg border border-border/40 bg-secondary/20 p-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground font-heading text-xs font-bold shadow-inner">
                {(user.email || "D").slice(0, 2).toUpperCase()}
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="truncate text-xs font-medium text-foreground">
                  {user.user_metadata?.full_name || user.email?.split("@")[0] || "Director"}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1 truncate">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block animate-pulse shrink-0" />
                  {user.email}
                </span>
              </div>
              <button
                type="button"
                onClick={() => signOut()}
                className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer shrink-0"
                title="Log Out of Account"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-lg border border-border/40 bg-secondary/15 p-2 gap-2">
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-medium text-foreground">Not signed in</span>
                <span className="text-[10px] font-mono text-muted-foreground">Sign in to load your studio</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/auth?mode=signin")}
                className="h-6 text-[11px] px-2 border-accent/40 text-accent hover:bg-accent/15 gap-1 font-mono cursor-pointer"
              >
                <LogIn className="h-3 w-3" />
                <span>Sign In</span>
              </Button>
            </div>
          )}
        </div>


        {/* Primary Navigation Links */}
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
          {/* Home */}
          <button
            onClick={() => setActiveTab("home")}
            className={`w-full flex items-center gap-3 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors ${
              activeTab === "home"
                ? "bg-secondary text-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
            }`}
            title="Home"
          >
            <Home className={`h-4 w-4 shrink-0 ${activeTab === "home" ? "text-accent" : ""}`} />
            <span className="truncate">Home</span>
          </button>

          {/* All Projects */}
          <button
            onClick={() => setActiveTab("projects")}
            className={`w-full flex items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition-colors ${
              activeTab === "projects"
                ? "bg-secondary text-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
            }`}
            title="All Productions"
          >
            <div className="flex items-center gap-3 min-w-0">
              <Film className={`h-4 w-4 shrink-0 ${activeTab === "projects" ? "text-accent" : ""}`} />
              <span className="truncate">All Productions</span>
            </div>
            <span className="rounded-full bg-secondary/80 px-1.5 py-0.2 text-[10px] font-mono text-muted-foreground">
              {projects.length}
            </span>
          </button>

          {/* Starred */}
          <button
            onClick={() => setActiveTab("starred")}
            className={`w-full flex items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition-colors ${
              activeTab === "starred"
                ? "bg-secondary text-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
            }`}
            title="Starred"
          >
            <div className="flex items-center gap-3 min-w-0">
              <Star className={`h-4 w-4 shrink-0 ${activeTab === "starred" ? "text-amber-400 fill-amber-400" : ""}`} />
              <span className="truncate">Starred</span>
            </div>
            {starredCount > 0 && (
              <span className="rounded-full bg-amber-500/15 text-amber-400 px-1.5 py-0.2 text-[10px] font-mono">
                {starredCount}
              </span>
            )}
          </button>

          {/* Recently Viewed */}
          <button
            onClick={() => setActiveTab("recent")}
            className={`w-full flex items-center gap-3 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors ${
              activeTab === "recent"
                ? "bg-secondary text-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
            }`}
            title="Recently viewed"
          >
            <Clock className={`h-4 w-4 shrink-0 ${activeTab === "recent" ? "text-accent" : ""}`} />
            <span className="truncate">Recently viewed</span>
          </button>

          {/* Film Fusion Crossovers */}
          <button
            onClick={() => setActiveTab("fusion")}
            className={`w-full flex items-center gap-3 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors ${
              activeTab === "fusion"
                ? "bg-secondary text-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
            }`}
            title="Film Fusion"
          >
            <Shuffle className={`h-4 w-4 shrink-0 ${activeTab === "fusion" ? "text-accent" : ""}`} />
            <span className="truncate">Film Fusion</span>
          </button>

          {/* Divider */}
          <div className="my-3 border-t border-border/60" />

          {/* Studio Suite Section Label */}
          <div className="px-2 py-1 text-[10px] font-mono tracking-wider text-muted-foreground uppercase">
            Studio Creative Suite
          </div>

          {/* Modular Character Lab */}
          <button
            onClick={() => setCharacterLabOpen(true)}
            className="w-full flex items-center gap-3 rounded-lg px-2.5 py-2 text-xs font-medium text-muted-foreground hover:bg-secondary/40 hover:text-foreground transition-colors"
            title="Modular Character Lab & Talent Vault"
          >
            <Users className="h-4 w-4 shrink-0 text-emerald-400" />
            <span className="truncate">Character Lab</span>
          </button>

          {/* Showrunner Scratchpad */}
          <button
            onClick={() => setScratchpadOpen(true)}
            className="w-full flex items-center gap-3 rounded-lg px-2.5 py-2 text-xs font-medium text-muted-foreground hover:bg-secondary/40 hover:text-foreground transition-colors"
            title="Showrunner Scratchpad & Ideas"
          >
            <FileText className="h-4 w-4 shrink-0 text-amber-400" />
            <span className="truncate">Ideas Scratchpad</span>
          </button>

          {/* ClickHouse Telemetry */}
          <button
            onClick={() => setToolboxOpen(true)}
            className="w-full flex items-center gap-3 rounded-lg px-2.5 py-2 text-xs font-medium text-muted-foreground hover:bg-secondary/40 hover:text-foreground transition-colors"
            title="ClickHouse Telemetry"
          >
            <Database className="h-4 w-4 shrink-0 text-cyan-400" />
            <span className="truncate">ClickHouse Telemetry</span>
          </button>

          {/* Canvas Interactive Demo */}
          <Link
            href="/canvas-demo"
            className="w-full flex items-center gap-3 rounded-lg px-2.5 py-2 text-xs font-medium text-muted-foreground hover:bg-secondary/40 hover:text-foreground transition-colors"
            title="Interactive Canvas Demo"
          >
            <Tv className="h-4 w-4 shrink-0 text-amber-400" />
            <span className="truncate">Canvas Demo</span>
          </Link>

          {/* Design System */}
          <Link
            href="/design-system"
            className="w-full flex items-center gap-3 rounded-lg px-2.5 py-2 text-xs font-medium text-muted-foreground hover:bg-secondary/40 hover:text-foreground transition-colors"
            title="Design System"
          >
            <Palette className="h-4 w-4 shrink-0 text-purple-400" />
            <span className="truncate">Design System</span>
          </Link>
        </div>

        {/* Sidebar Footer */}
        <div className="border-t border-border/80 p-3 bg-secondary/10 shrink-0">
          <div className="flex flex-col gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={() => setNewProjectOpen(true)}
              className="w-full justify-center gap-1.5 bg-foreground text-background hover:bg-foreground/90 font-medium text-xs shadow-sm cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              New Production
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleLoadDemoProject}
              disabled={isGeneratingProject}
              title="Instantly generate a ready-to-test heist thriller with a built-in character secret — for quick demos"
              className="w-full justify-center gap-1.5 font-medium text-xs cursor-pointer"
            >
              <Zap className="h-3.5 w-3.5" />
              Load Demo: The Vault Protocol
            </Button>

            {user ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => signOut()}
                className="w-full justify-start gap-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive font-mono h-8 px-2 cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Log Out</span>
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/auth?mode=signin")}
                className="w-full justify-start gap-2 text-xs border-border/80 hover:border-accent/40 font-mono h-8 px-2 cursor-pointer text-muted-foreground hover:text-foreground"
              >
                <LogIn className="h-3.5 w-3.5 text-accent" />
                <span>Sign In / Register</span>
              </Button>
            )}

            <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground pt-1">
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> ClickHouse Cloud
              </span>
              <span>v24.3</span>
            </div>
          </div>
        </div>

      </aside>

      {/* ──────────────────────────────────────────────────────────
          MAIN CONTENT AREA
      ────────────────────────────────────────────────────────── */}
      <main className={`flex-1 flex flex-col min-w-0 bg-[#090a0d] relative overflow-x-hidden ${activeTab === "home" ? "h-screen overflow-hidden" : "overflow-y-auto"}`}>
        {/* Top App Bar */}
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b border-border/80 bg-[#0c0d10]/95 backdrop-blur-md px-6">
          <div className="flex items-center gap-3">
            {sidebarCollapsed && (
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setSidebarCollapsed(false)}
                className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0 -ml-2"
                title="Expand sidebar"
              >
                <PanelLeft className="h-4 w-4" />
              </Button>
            )}

            <span className="font-mono text-xs text-muted-foreground flex items-center gap-1.5 hidden md:flex">
              Studio Lot <ChevronRight className="h-3 w-3" />
              <span className="text-foreground font-medium capitalize">
                {activeTab === "home"
                  ? "Home"
                  : activeTab === "projects"
                  ? "All Productions"
                  : activeTab === "starred"
                  ? "Starred Productions"
                  : activeTab === "recent"
                  ? "Recently Viewed"
                  : "Film Fusion Slates"}
              </span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/")}
              className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1.5 hidden md:flex"
            >
              <Compass className="h-3.5 w-3.5 text-accent" />
              <span>SaaS Landing</span>
            </Button>

            <button
              onClick={() => setToolboxOpen(true)}
              className={`hidden lg:flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-mono transition-colors ${
                clickhouseLive
                  ? "border-border/80 bg-secondary/30 text-muted-foreground hover:border-accent/40 hover:text-foreground"
                  : "border-amber-500/40 bg-amber-500/10 text-amber-400"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  clickhouseLive ? "bg-emerald-400 animate-pulse" : "bg-amber-500"
                }`}
              />
              {clickhouseLive === null
                ? "ClickHouse Checking…"
                : clickhouseLive
                ? `ClickHouse Live${clickhousePingMs != null ? ` · ${clickhousePingMs.toFixed(1)}ms` : ""}`
                : "ClickHouse Unreachable"}
            </button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCharacterLabOpen(true)}
              className="h-8 text-xs border-emerald-500/30 bg-emerald-500/5 text-emerald-400 hover:bg-emerald-500/15 gap-1.5 hidden md:flex"
            >
              <Users className="h-3.5 w-3.5 text-emerald-400" />
              Character Lab
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setScratchpadOpen(true)}
              className="h-8 text-xs border-amber-500/30 bg-amber-500/5 text-amber-400 hover:bg-amber-500/15 gap-1.5 hidden md:flex"
            >
              <FileText className="h-3.5 w-3.5 text-amber-400" />
              Scratchpad
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setFusionOpen(true)}
              className="h-8 text-xs border-border/80 gap-1.5 hidden sm:flex"
            >
              <Shuffle className="h-3.5 w-3.5 text-accent" />
              Film Fusion
            </Button>

            <Button
              variant="default"
              size="sm"
              onClick={() => setNewProjectOpen(true)}
              className="h-8 text-xs bg-foreground text-background hover:bg-foreground/90 gap-1.5 shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              Create Project
            </Button>

            <div className="h-4 w-px bg-border/60 mx-0.5 hidden sm:block" />

            <AuthUserButton />
          </div>
        </header>

        {/* ────────────────────────────────────────────────────────
            TAB 1: HOME (Conversational Showrunner Workspace)
        ──────────────────────────────────────────────────────── */}
        {activeTab === "home" && (
          <StudioChatWorkspace
            projects={projects}
            onRefreshProjects={refreshProjects}
            onOpenProject={(id) => router.push(`/studio/${id}`)}
            onOpenNewProjectDialog={() => setNewProjectOpen(true)}
            onOpenFusionDialog={() => setFusionOpen(true)}
            onOpenToolbox={() => setToolboxOpen(true)}
          />
        )}

        {/* ────────────────────────────────────────────────────────
            TAB 2: ALL PRODUCTIONS (Bolt.new "All Projects" layout)
        ──────────────────────────────────────────────────────── */}
        {activeTab === "projects" && (
          <div className="px-6 py-8 max-w-7xl mx-auto w-full flex-1 flex flex-col">
            {/* Top Filter Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h1 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
                  All productions
                  <Badge variant="outline" className="font-mono text-xs font-normal">
                    {filteredProjects.length}
                  </Badge>
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Browse, search, and manage all interactive features in your studio slate
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setNewProjectOpen(true)}
                  className="bg-foreground text-background hover:bg-foreground/90 gap-1.5 text-xs shadow-sm"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create project
                </Button>
              </div>
            </div>

            {/* Search and Filters Strip */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6 p-2 rounded-xl border border-border bg-secondary/20">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by title, character, or premise..."
                  className="h-9 w-full rounded-lg border border-border/60 bg-background pl-9 pr-4 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent/40"
                />
              </div>

              <div className="flex items-center gap-2">
                {/* Genre Filter */}
                <select
                  value={selectedGenreFilter}
                  onChange={(e) => setSelectedGenreFilter(e.target.value)}
                  className="h-9 rounded-lg border border-border/60 bg-background px-3 text-xs text-foreground focus:outline-none focus:border-accent/40 cursor-pointer"
                >
                  <option value="All">All Genres</option>
                  <option value="Heist">Heist / Crime</option>
                  <option value="Sci-Fi">Sci-Fi / Space</option>
                  <option value="Noir">Noir / Cyberpunk</option>
                  <option value="Drama">Drama</option>
                  <option value="Thriller">Thriller</option>
                </select>

                {/* Sort Order */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="h-9 rounded-lg border border-border/60 bg-background px-3 text-xs text-foreground focus:outline-none focus:border-accent/40 cursor-pointer"
                >
                  <option value="updated">Last edited</option>
                  <option value="title">Title (A-Z)</option>
                  <option value="scenes">Scene complexity</option>
                </select>
              </div>
            </div>

            {/* Projects Grid */}
            {filteredProjects.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onOpen={() => router.push(`/studio/${project.id}`)}
                    onToggleStar={(e) => handleToggleStar(project.id, e)}
                    onDelete={(e) => handleDelete(project.id, project.title, e)}
                  />
                ))}
              </div>
            ) : projects.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-20 text-center max-w-md mx-auto">
                <div className="h-16 w-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent mb-4 shadow-sm">
                  <Clapperboard className="h-8 w-8" />
                </div>
                <h3 className="font-heading text-lg font-bold text-foreground">Your studio slate is currently empty</h3>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  Start an autonomous pre-production slate to write scenes, synthesize cast ensembles, scout real locations, and generate cinematic Veo video takes.
                </p>
                <div className="flex flex-col sm:flex-row items-center gap-3 mt-6 w-full justify-center">
                  <Button
                    size="sm"
                    onClick={() => setNewProjectOpen(true)}
                    className="gap-2 bg-foreground text-background hover:bg-foreground/90 w-full sm:w-auto"
                  >
                    <Plus className="h-4 w-4" />
                    Create First Production
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLoadDemoProject}
                    disabled={isGeneratingProject}
                    className="gap-2 border-border text-foreground hover:bg-secondary w-full sm:w-auto"
                  >
                    <Sparkles className="h-4 w-4 text-accent" />
                    Load Demo: The Vault Protocol
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
                <div className="h-12 w-12 rounded-2xl bg-secondary/50 border border-border flex items-center justify-center text-muted-foreground mb-4">
                  <Film className="h-6 w-6" />
                </div>
                <h3 className="font-heading text-sm font-bold text-foreground">No matching productions found</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                  {searchQuery
                    ? `No productions match "${searchQuery}".`
                    : `No productions match the filter "${selectedGenreFilter}".`}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedGenreFilter("All");
                  }}
                  className="mt-4 text-xs"
                >
                  Clear filters
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ────────────────────────────────────────────────────────
            TAB 3: STARRED (Matching Bolt.new Starred Projects)
        ──────────────────────────────────────────────────────── */}
        {activeTab === "starred" && (
          <div className="px-6 py-8 max-w-7xl mx-auto w-full flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="font-heading text-2xl font-bold text-foreground">
                  Starred productions
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Pinned feature projects and priority studio slates
                </p>
              </div>
            </div>

            {filteredProjects.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onOpen={() => router.push(`/studio/${project.id}`)}
                    onToggleStar={(e) => handleToggleStar(project.id, e)}
                    onDelete={(e) => handleDelete(project.id, project.title, e)}
                  />
                ))}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center py-24 text-center">
                <div className="h-12 w-12 rounded-full border border-border/80 bg-secondary/40 flex items-center justify-center text-muted-foreground mb-4">
                  <Star className="h-5 w-5" />
                </div>
                <h3 className="font-heading text-sm font-bold text-foreground">No starred productions</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                  Star projects from your production list to easily pin them here for quick access.
                </p>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setActiveTab("projects")}
                  className="mt-5 bg-foreground text-background hover:bg-foreground/90 text-xs shadow-sm"
                >
                  Browse productions
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ────────────────────────────────────────────────────────
            TAB 4: RECENTLY VIEWED (Matching Bolt.new Recently Viewed)
        ──────────────────────────────────────────────────────── */}
        {activeTab === "recent" && (
          <div className="px-6 py-8 max-w-7xl mx-auto w-full flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="font-heading text-2xl font-bold text-foreground">
                  Recently viewed
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Productions ordered by recent editing activity
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[...projects]
                .sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt))
                .map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onOpen={() => router.push(`/studio/${project.id}`)}
                    onToggleStar={(e) => handleToggleStar(project.id, e)}
                    onDelete={(e) => handleDelete(project.id, project.title, e)}
                  />
                ))}
            </div>
          </div>
        )}

        {/* ────────────────────────────────────────────────────────
            TAB 5: FILM FUSION CROSSOVER SLATES
        ──────────────────────────────────────────────────────── */}
        {activeTab === "fusion" && (
          <div className="px-6 py-8 max-w-5xl mx-auto w-full flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
                  <Shuffle className="h-6 w-6 text-accent" />
                  Film Fusion Multiverse Hub
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Collide two distinct feature screenplays into an unprecedented crossover scene with synchronized timeline firewalls
                </p>
              </div>

              <Button
                variant="default"
                size="sm"
                onClick={() => setFusionOpen(true)}
                className="bg-accent text-accent-foreground hover:bg-accent/90 gap-1.5 text-xs font-semibold shadow-sm"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Launch Film Fusion
              </Button>
            </div>

            {/* Fusion Explainer Hero */}
            <div className="rounded-2xl border border-border bg-card p-6 md:p-8 mb-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 h-40 w-60 bg-gradient-to-bl from-accent/15 via-purple-500/10 to-transparent blur-2xl pointer-events-none" />
              <div className="relative z-10">
                <span className="font-mono text-[10px] text-accent uppercase tracking-wider font-semibold">
                  Two Worlds Collide
                </span>
                <h2 className="font-heading text-xl font-bold text-foreground mt-1">
                  Cross-World Narrative Synthesis
                </h2>
                <p className="text-xs text-muted-foreground mt-2 max-w-2xl leading-relaxed">
                  Film Fusion selects any two projects from your production slate (e.g. <em>The Vault Heist</em> and <em>Deep Space Airlock</em>), remaps their characters with conflicting objectives, synchronizes knowledge facts into ClickHouse, and drafts a high-stakes crossover scene.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
                  <div className="rounded-xl border border-border/80 bg-secondary/30 p-3.5">
                    <div className="font-mono text-[10px] text-muted-foreground uppercase">Step 1</div>
                    <div className="font-medium text-xs text-foreground mt-1">Select 2 Feature Slates</div>
                    <p className="text-[11px] text-muted-foreground mt-1">Pick source scripts from your local studio library.</p>
                  </div>
                  <div className="rounded-xl border border-border/80 bg-secondary/30 p-3.5">
                    <div className="font-mono text-[10px] text-muted-foreground uppercase">Step 2</div>
                    <div className="font-medium text-xs text-foreground mt-1">Character Alignment</div>
                    <p className="text-[11px] text-muted-foreground mt-1">Automatic remapping of loyalties, speech styles & subtext.</p>
                  </div>
                  <div className="rounded-xl border border-border/80 bg-secondary/30 p-3.5">
                    <div className="font-mono text-[10px] text-muted-foreground uppercase">Step 3</div>
                    <div className="font-medium text-xs text-foreground mt-1">Backlot Generation</div>
                    <p className="text-[11px] text-muted-foreground mt-1">Spawns a full fused canvas project with interactive nodes.</p>
                  </div>
                </div>

                <div className="mt-6 flex items-center gap-3">
                  <Button
                    onClick={() => setFusionOpen(true)}
                    size="sm"
                    className="bg-foreground text-background hover:bg-foreground/90 text-xs font-medium gap-1.5"
                  >
                    <Shuffle className="h-3.5 w-3.5" />
                    Fuse Slates Now
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLoadDemoProject}
                    disabled={isGeneratingProject}
                    className="text-xs border-border"
                  >
                    Load Guided Demo First
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ──────────────────────────────────────────────────────────
          MODAL DIALOGS
      ────────────────────────────────────────────────────────── */}
      {/* New Project Dialog */}
      <NewProjectDialog
        open={newProjectOpen}
        onOpenChange={setNewProjectOpen}
        isSubmitting={isGeneratingProject}
        onSubmit={handleCreateNewProject}
      />

      {/* Film Fusion Crossover Dialog */}
      <FilmFusionDialog
        open={fusionOpen}
        onOpenChange={setFusionOpen}
        onFusionComplete={() => refreshProjects()}
      />

      {/* ClickHouse Toolbox Dialog */}
      <ClickHouseToolboxDialog
        open={toolboxOpen}
        onOpenChange={setToolboxOpen}
        projectId="studio-dashboard"
      />

      {/* Character Lab & Talent Vault Dialog */}
      <CharacterLabDialog
        open={characterLabOpen}
        onOpenChange={setCharacterLabOpen}
        projectTitle={mostRecentProject?.title}
        characters={
          mostRecentProject?.characters && mostRecentProject.characters.length > 0
            ? mostRecentProject.characters
            : [
                {
                  name: "Marcus",
                  role: "Lead Protagonist",
                  archetype: "Desperate specialist racing against a closing escape window",
                  actorComp: "Jake Gyllenhaal",
                  speechStyle: "Breathless, guarded",
                  subtextRatio: "high",
                  confidence: 75,
                  verbalPacing: 70,
                },
                {
                  name: "Elena",
                  role: "Strategic Foil",
                  archetype: "Mastermind concealing a clandestine syndicate contract",
                  actorComp: "Florence Pugh",
                  speechStyle: "Chillingly measured, quiet",
                  subtextRatio: "extreme",
                  confidence: 95,
                  verbalPacing: 45,
                },
              ]
        }
        onUpdateCharacters={(newChars) => {
          if (mostRecentProject) {
            const updated = { ...mostRecentProject, characters: newChars };
            saveProject(updated);
            refreshProjects();
          }
        }}
        onOpenHotSeat={(name) => {
          setCharacterLabOpen(false);
          if (mostRecentProject) {
            router.push(`/studio/${mostRecentProject.id}?hotSeat=${encodeURIComponent(name)}`);
          } else {
            setNewProjectOpen(true);
          }
        }}
      />

      {/* Showrunner Scratchpad Dialog */}
      <ScratchpadDialog
        open={scratchpadOpen}
        onOpenChange={setScratchpadOpen}
      />

      {/* First-visit Onboarding Dialog */}
      <OnboardingDialog
        open={onboardingOpen}
        onOpenChange={handleOnboardingOpenChange}
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Sub-component: Cinematic Project Slate Card
// ────────────────────────────────────────────────────────────
interface ProjectCardProps {
  project: ProjectData;
  onOpen: () => void;
  onToggleStar: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
}

function ProjectCard({ project, onOpen, onToggleStar, onDelete }: ProjectCardProps) {
  const genreStyle = getGenreStyle(project.genre);
  const formattedDate = React.useMemo(() => {
    const timestamp = project.updatedAt || project.createdAt || Date.now();
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }, [project.updatedAt, project.createdAt]);

  return (
    <div
      onClick={onOpen}
      className="group relative flex flex-col justify-between rounded-xl border border-border/80 bg-card/80 hover:bg-card hover:border-accent/40 hover:shadow-lg transition-all duration-200 cursor-pointer p-4 space-y-3.5 overflow-hidden"
    >
      {/* Top Header: Genre, Scene, Star & Delete */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 overflow-hidden">
          <Badge
            variant="outline"
            className={`text-[10px] px-2 py-0.5 font-mono font-medium shrink-0 ${genreStyle.badge}`}
          >
            {project.genre}
          </Badge>
          <span className="text-[10px] font-mono text-muted-foreground truncate border-l border-border/60 pl-2">
            {project.sceneTitle || "Scene 01"}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onToggleStar}
            className={`h-7 w-7 rounded-lg flex items-center justify-center transition-colors ${
              project.isStarred
                ? "bg-amber-500/20 text-amber-400"
                : "bg-secondary/40 text-muted-foreground hover:text-foreground"
            }`}
            title={project.isStarred ? "Remove from starred" : "Star production"}
          >
            <Star className={`h-3.5 w-3.5 ${project.isStarred ? "fill-amber-400" : ""}`} />
          </button>

          {project.isCustom && (
            <button
              onClick={onDelete}
              className="h-7 w-7 rounded-lg bg-secondary/40 text-muted-foreground hover:text-destructive hover:bg-destructive/15 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
              title="Delete production slate"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Title & Logline */}
      <div className="space-y-1.5 flex-1">
        <h3 className="font-heading text-base font-bold text-foreground group-hover:text-accent transition-colors line-clamp-1">
          {project.title}
        </h3>
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed pl-2.5 border-l-2 border-border/60 group-hover:border-accent/40 transition-colors">
          {project.premise || "No logline defined for this production slate."}
        </p>
      </div>

      {/* Dynamic Cast Chips */}
      {project.characters && project.characters.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-hidden">
          <Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <div className="flex items-center gap-1.5 truncate">
            {project.characters.slice(0, 3).map((c, i) => (
              <span
                key={i}
                className="text-[10px] font-mono px-2 py-0.5 rounded bg-secondary/60 border border-border/50 text-foreground truncate"
                title={`${c.name} (${c.role})`}
              >
                {c.name}
              </span>
            ))}
            {project.characters.length > 3 && (
              <span className="text-[10px] font-mono text-muted-foreground">
                +{project.characters.length - 3}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Footer Strip */}
      <div className="flex items-center justify-between pt-2 border-t border-border/40 text-[10px] font-mono text-muted-foreground">
        <div className="flex items-center gap-2">
          {project.targetRuntimeMinutes ? (
            <>
              <span className="text-accent font-semibold flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {project.targetRuntimeMinutes}m
              </span>
              <span>•</span>
            </>
          ) : null}
          <span>{project.nodes?.length ?? 0} Nodes</span>
          <span>•</span>
          <span>{formattedDate}</span>
        </div>

        <span className="text-xs font-medium text-foreground flex items-center gap-1 group-hover:text-accent group-hover:translate-x-0.5 transition-all">
          Open Studio <ChevronRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </div>
  );
}
