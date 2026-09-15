"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Send,
  Sparkles,
  Play,
  Film,
  Compass,
  Users,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Plus,
  Zap,
  RotateCcw,
  Check,
  Bot,
  AtSign,
  ArrowRight,
  Database,
  Shuffle,
  ChevronRight,
  ArrowUp,
  X,
  Clapperboard,
  Orbit,
  Brain,
  Layers,
  Aperture,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  type ProjectData,
  type ProjectCharacter,
  type FilmScene,
  type ScoreTake,
  createNewProjectEntry,
  buildProjectNodesAndEdges,
  saveProject,
  synthesizeDynamicCharacters,
} from "@/lib/project-store";
import { MarkdownRenderer } from "@/components/cinema/markdown-renderer";
import { toast } from "@/components/ui/toast";

export interface DashboardChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  thought?: string;
  createdProject?: ProjectData;
  updatedProject?: ProjectData;
  modifiedFields?: string[];
  suggestedPrompts?: string[];
}

interface StudioChatWorkspaceProps {
  projects: ProjectData[];
  onRefreshProjects: () => void;
  onOpenProject: (projectId: string) => void;
  onOpenNewProjectDialog: () => void;
  onOpenFusionDialog: () => void;
  onOpenToolbox: () => void;
}

// Chat transcripts are session state, not documents: they are intentionally
// not persisted to the browser (see the storage note in lib/project-store.ts).
// The durable artifacts a chat produces live in the project itself.

export type AtmosphereKey = "screening" | "cyberpunk" | "orbital" | "vault" | "minimal";

export interface StudioAtmosphere {
  id: AtmosphereKey;
  name: string;
  tagline: string;
  image: string | null;
  themeColor: string;
  glowClass: string;
}

export const STUDIO_ATMOSPHERES: Record<AtmosphereKey, StudioAtmosphere> = {
  screening: {
    id: "screening",
    name: "Screening Lounge",
    tagline: "Dolby Vision · 35mm Master",
    image: "/cinema/showrunner_room_bg.jpg",
    themeColor: "amber",
    glowClass: "from-amber-500/20 via-orange-500/10 to-transparent",
  },
  cyberpunk: {
    id: "cyberpunk",
    name: "Cyberpunk Backlot",
    tagline: "Anamorphic 2.39:1 · Rain Neon",
    image: "/cinema/cyberpunk_noir_bg.jpg",
    themeColor: "teal",
    glowClass: "from-teal-500/20 via-cyan-500/10 to-transparent",
  },
  orbital: {
    id: "orbital",
    name: "Orbital Airlock",
    tagline: "Deep Space Observation Deck",
    image: "/cinema/space_airlock.jpg",
    themeColor: "cyan",
    glowClass: "from-cyan-500/20 via-blue-500/10 to-transparent",
  },
  vault: {
    id: "vault",
    name: "High-Sec Vault",
    tagline: "Subterranean Heist Facility",
    image: "/cinema/vault_heist.jpg",
    themeColor: "amber",
    glowClass: "from-amber-600/20 via-yellow-500/10 to-transparent",
  },
  minimal: {
    id: "minimal",
    name: "Minimalist Studio",
    tagline: "Deep OLED Void · Clean Focus",
    image: null,
    themeColor: "slate",
    glowClass: "from-purple-500/10 via-cyan-500/10 to-transparent",
  },
};

export const GENRE_ATMOSPHERE_MAP: Record<string, AtmosphereKey> = {
  "Crime Heist": "vault",
  "Deep Space Sci-Fi": "orbital",
  "Cyberpunk Noir": "cyberpunk",
  "Psychological Drama": "screening",
  "Action Thriller": "screening",
};

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

function applyShowrunnerActionsToProject(
  proj: ProjectData,
  actions: any[]
): { updatedProject: ProjectData; modifiedFields: string[] } {
  const currentProj: ProjectData = {
    ...proj,
    characters: [...(proj.characters || [])],
  };
  const modifiedFields: string[] = [];

  for (const action of actions) {
    switch (action.type) {
      case "create_character": {
        const charName = (action.name || "").trim();
        if (
          charName &&
          !currentProj.characters.some((c) => c.name.toLowerCase() === charName.toLowerCase())
        ) {
          const newChar: ProjectCharacter = {
            name: charName,
            role: action.role || "Supporting Role",
            archetype: action.archetype || "Key Dramatic Dynamic",
            speechStyle: action.speechStyle || "naturalistic",
            subtextRatio: action.subtextRatio || "high",
            confidence: typeof action.confidence === "number" ? action.confidence : 75,
            verbalPacing: typeof action.verbalPacing === "number" ? action.verbalPacing : 65,
            personalityPreset: action.personalityPreset || "Balanced Professional",
            actorComp: action.actorComp || `${charName} Prototype`,
            objective: action.objective || "Navigate the unfolding dramatic crisis",
            quirks: Array.isArray(action.quirks) ? action.quirks : ["Observant, measures each pause"],
          };
          currentProj.characters.push(newChar);
          modifiedFields.push(`Created Character: ${charName} (${newChar.role})`);
        }
        break;
      }
      case "update_character": {
        const charName = (action.name || "").trim().toLowerCase();
        const idx = currentProj.characters.findIndex((c) => c.name.toLowerCase() === charName);
        if (idx !== -1 && action.patch) {
          currentProj.characters[idx] = {
            ...currentProj.characters[idx],
            ...action.patch,
          };
          const patchKeys = Object.keys(action.patch).join(", ");
          modifiedFields.push(`Updated ${currentProj.characters[idx].name} (${patchKeys})`);
        }
        break;
      }
      case "delete_character": {
        const charName = (action.name || "").trim().toLowerCase();
        const initialLen = currentProj.characters.length;
        currentProj.characters = currentProj.characters.filter(
          (c) => c.name.toLowerCase() !== charName
        );
        if (currentProj.characters.length < initialLen) {
          modifiedFields.push(`Removed Character: ${action.name}`);
        }
        break;
      }
      case "replace_character": {
        const charName = (action.name || "").trim().toLowerCase();
        const idx = currentProj.characters.findIndex((c) => c.name.toLowerCase() === charName);
        const rep = action.replacement || {};
        const newName = rep.name ? rep.name.trim() : action.name;
        const replacedChar: ProjectCharacter = {
          name: newName,
          role: rep.role || (idx !== -1 ? currentProj.characters[idx].role : "Key Dynamic"),
          archetype: rep.archetype || (idx !== -1 ? currentProj.characters[idx].archetype : "Dynamic Specialist"),
          speechStyle: rep.speechStyle || (idx !== -1 ? currentProj.characters[idx].speechStyle : "naturalistic"),
          subtextRatio: rep.subtextRatio || (idx !== -1 ? currentProj.characters[idx].subtextRatio : "high"),
          confidence: typeof rep.confidence === "number" ? rep.confidence : (idx !== -1 ? (currentProj.characters[idx].confidence ?? 75) : 75),
          verbalPacing: typeof rep.verbalPacing === "number" ? rep.verbalPacing : (idx !== -1 ? (currentProj.characters[idx].verbalPacing ?? 65) : 65),
          personalityPreset: rep.personalityPreset || (idx !== -1 ? currentProj.characters[idx].personalityPreset : "Balanced Professional"),
          actorComp: rep.actorComp || `${newName} Prototype`,
          objective: rep.objective || (idx !== -1 ? currentProj.characters[idx].objective : "Navigate the unfolding dramatic crisis"),
          quirks: Array.isArray(rep.quirks) ? rep.quirks : (idx !== -1 ? currentProj.characters[idx].quirks : ["Observant"]),
        };
        if (idx !== -1) {
          currentProj.characters[idx] = replacedChar;
        } else {
          currentProj.characters.push(replacedChar);
        }
        modifiedFields.push(`Replaced Character: ${action.name} → ${newName}`);
        break;
      }
      case "update_project_meta": {
        const patch = action.patch || {};
        if (patch.title) {
          currentProj.title = patch.title;
          modifiedFields.push(`Project Title: "${patch.title}"`);
        }
        if (patch.genre) {
          currentProj.genre = patch.genre;
          modifiedFields.push(`Project Genre: "${patch.genre}"`);
        }
        if (patch.premise || patch.logline) {
          currentProj.premise = patch.premise || patch.logline;
          modifiedFields.push(`Project Premise updated`);
        }
        if (patch.directorStyle) {
          currentProj.directorStyle = patch.directorStyle;
          modifiedFields.push(`Director Style: "${patch.directorStyle}"`);
        }
        if (patch.targetRuntimeMinutes) {
          currentProj.targetRuntimeMinutes = patch.targetRuntimeMinutes;
          modifiedFields.push(`Target Runtime: ${patch.targetRuntimeMinutes}m`);
        }
        break;
      }
      case "update_screenplay": {
        if (action.screenplayText) {
          currentProj.screenplayText = action.screenplayText;
          modifiedFields.push("Updated Screenplay Draft");
        }
        if (action.summary) {
          currentProj.sceneSummary = action.summary;
          modifiedFields.push("Updated Scene Stakes");
        }
        break;
      }
      case "update_scene_meta": {
        if (action.title) {
          currentProj.sceneTitle = action.title;
          modifiedFields.push(`Scene Title: ${action.title}`);
        }
        if (action.stakes) {
          currentProj.sceneSummary = action.stakes;
          modifiedFields.push(`Scene Stakes: ${action.stakes}`);
        }
        break;
      }
      case "create_scene": {
        const currentScenes: FilmScene[] = [...(currentProj.scenes || [])];
        const nextSceneNumber = currentScenes.length + 1;
        const newSceneId = `scene-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
        const duration = action.durationSeconds || 180;
        const newScene: FilmScene = {
          id: newSceneId,
          sceneNumber: nextSceneNumber,
          title: action.title || `Scene ${nextSceneNumber}`,
          slugline: action.slugline || "INT. SCENE LOCATION - DAY",
          summary: action.summary || "New dramatic beat created by Studio Showrunner.",
          location: action.location || "Studio Location",
          durationSeconds: duration,
          startSeconds: 0,
          castPresent: Array.isArray(action.castPresent) && action.castPresent.length > 0
            ? action.castPresent
            : currentProj.characters.slice(0, 2).map((c) => c.name),
          castRoles: {},
          screenplayText:
            action.screenplayText ||
            `${action.slugline || "INT. SCENE LOCATION - DAY"}\n\n[Action description]\n\n${currentProj.characters[0]?.name || "CHARACTER"}\n(beat)\nDialogue goes here.`,
        };

        let insertIdx = currentScenes.length;
        if (action.position === "start") {
          insertIdx = 0;
        } else if (typeof action.position === "number") {
          insertIdx = Math.max(0, Math.min(action.position - 1, currentScenes.length));
        }

        currentScenes.splice(insertIdx, 0, newScene);
        let cursor = 0;
        currentProj.scenes = currentScenes.map((s, idx) => {
          const updated = { ...s, sceneNumber: idx + 1, startSeconds: cursor };
          cursor += s.durationSeconds || 180;
          return updated;
        });

        currentProj.activeSceneId = newScene.id;
        currentProj.sceneTitle = newScene.title;
        currentProj.sceneSummary = newScene.summary;
        modifiedFields.push(`Created Scene ${newScene.sceneNumber}: "${newScene.title}"`);
        break;
      }
      case "delete_scene": {
        const currentScenes: FilmScene[] = [...(currentProj.scenes || [])];
        if (currentScenes.length > 1) {
          const ident = String(action.sceneIdentifier).toLowerCase().trim();
          const numIdent = parseInt(ident, 10);
          const targetIdx = currentScenes.findIndex((s, idx) => {
            if (!isNaN(numIdent) && (s.sceneNumber === numIdent || idx + 1 === numIdent)) return true;
            if (s.id.toLowerCase() === ident) return true;
            if (s.title.toLowerCase().includes(ident)) return true;
            return false;
          });

          if (targetIdx !== -1) {
            const removed = currentScenes[targetIdx];
            currentScenes.splice(targetIdx, 1);
            let cursor = 0;
            currentProj.scenes = currentScenes.map((s, idx) => {
              const updated = { ...s, sceneNumber: idx + 1, startSeconds: cursor };
              cursor += s.durationSeconds || 180;
              return updated;
            });
            if (currentProj.activeSceneId === removed.id) {
              currentProj.activeSceneId = currentProj.scenes[0]?.id;
            }
            modifiedFields.push(`Deleted Scene: "${removed.title}"`);
          }
        }
        break;
      }
      case "reorder_scenes": {
        const currentScenes: FilmScene[] = [...(currentProj.scenes || [])];
        if (Array.isArray(action.sceneOrder) && action.sceneOrder.length > 0 && currentScenes.length > 0) {
          const orderMap = new Map<string, number>();
          action.sceneOrder.forEach((item: any, orderIdx: number) => {
            orderMap.set(String(item).toLowerCase().trim(), orderIdx);
            const n = parseInt(String(item), 10);
            if (!isNaN(n)) orderMap.set(String(n), orderIdx);
          });

          const reordered = [...currentScenes].sort((a, b) => {
            const aKey1 = String(a.sceneNumber);
            const aKey2 = a.id.toLowerCase();
            const aKey3 = a.title.toLowerCase();
            const bKey1 = String(b.sceneNumber);
            const bKey2 = b.id.toLowerCase();
            const bKey3 = b.title.toLowerCase();

            const orderA = orderMap.get(aKey1) ?? orderMap.get(aKey2) ?? orderMap.get(aKey3) ?? 999;
            const orderB = orderMap.get(bKey1) ?? orderMap.get(bKey2) ?? orderMap.get(bKey3) ?? 999;
            return orderA - orderB;
          });

          let cursor = 0;
          currentProj.scenes = reordered.map((s, idx) => {
            const updated = { ...s, sceneNumber: idx + 1, startSeconds: cursor };
            cursor += s.durationSeconds || 180;
            return updated;
          });

          modifiedFields.push(`Reordered Sequence (${currentProj.scenes.length} Scenes)`);
        }
        break;
      }
      case "move_scene": {
        const currentScenes: FilmScene[] = [...(currentProj.scenes || [])];
        const ident = String(action.sceneIdentifier).toLowerCase().trim();
        const numIdent = parseInt(ident, 10);
        const idx = currentScenes.findIndex((s, i) => {
          if (!isNaN(numIdent) && (s.sceneNumber === numIdent || i + 1 === numIdent)) return true;
          if (s.id.toLowerCase() === ident) return true;
          if (s.title.toLowerCase().includes(ident)) return true;
          return false;
        });

        if (idx !== -1) {
          let destIdx = idx;
          if (typeof action.targetIndex === "number") {
            destIdx = Math.max(0, Math.min(action.targetIndex, currentScenes.length - 1));
          } else if (action.direction === "up") {
            destIdx = Math.max(0, idx - 1);
          } else if (action.direction === "down") {
            destIdx = Math.min(currentScenes.length - 1, idx + 1);
          }

          if (destIdx !== idx) {
            const [moved] = currentScenes.splice(idx, 1);
            currentScenes.splice(destIdx, 0, moved);
            let cursor = 0;
            currentProj.scenes = currentScenes.map((s, i) => {
              const updated = { ...s, sceneNumber: i + 1, startSeconds: cursor };
              cursor += s.durationSeconds || 180;
              return updated;
            });
            modifiedFields.push(`Moved "${moved.title}" to Scene ${destIdx + 1}`);
          }
        }
        break;
      }
      case "update_scene": {
        const currentScenes: FilmScene[] = [...(currentProj.scenes || [])];
        const ident = String(action.sceneIdentifier).toLowerCase().trim();
        const numIdent = parseInt(ident, 10);
        const idx = currentScenes.findIndex((s, i) => {
          if (!isNaN(numIdent) && (s.sceneNumber === numIdent || i + 1 === numIdent)) return true;
          if (s.id.toLowerCase() === ident) return true;
          if (s.title.toLowerCase().includes(ident)) return true;
          return false;
        });

        if (idx !== -1 && action.patch) {
          currentScenes[idx] = { ...currentScenes[idx], ...action.patch };
          currentProj.scenes = currentScenes;
          modifiedFields.push(`Updated Scene ${currentScenes[idx].sceneNumber}: "${currentScenes[idx].title}"`);
        }
        break;
      }
      case "replace_scene": {
        const currentScenes: FilmScene[] = [...(currentProj.scenes || [])];
        const ident = String(action.sceneIdentifier).toLowerCase().trim();
        const numIdent = parseInt(ident, 10);
        let targetIdx = currentScenes.findIndex((s, i) => {
          if (!isNaN(numIdent) && (s.sceneNumber === numIdent || i + 1 === numIdent)) return true;
          if (s.id.toLowerCase() === ident) return true;
          if (s.title.toLowerCase().includes(ident)) return true;
          return false;
        });

        if (targetIdx === -1 && currentScenes.length === 1) {
          targetIdx = 0;
        }

        if (targetIdx !== -1) {
          const old = currentScenes[targetIdx];
          const rep = action.replacement || {};
          const duration = rep.durationSeconds || old.durationSeconds || 180;
          const updated: FilmScene = {
            ...old,
            ...rep,
            title: rep.title || old.title,
            slugline: rep.slugline || old.slugline,
            summary: rep.summary || old.summary,
            location: rep.location || old.location || "Studio Location",
            durationSeconds: duration,
            castPresent: Array.isArray(rep.castPresent) && rep.castPresent.length > 0
              ? rep.castPresent
              : old.castPresent,
            screenplayText: rep.screenplayText !== undefined
              ? rep.screenplayText
              : old.screenplayText,
          };

          currentScenes[targetIdx] = updated;
          let cursor = 0;
          currentProj.scenes = currentScenes.map((s, idx) => {
            const reindexed = { ...s, sceneNumber: idx + 1, startSeconds: cursor };
            cursor += s.durationSeconds || 180;
            return reindexed;
          });

          if (currentProj.activeSceneId === old.id) {
            currentProj.sceneTitle = updated.title;
            currentProj.sceneSummary = updated.summary;
            currentProj.screenplayText = updated.screenplayText;
          }

          modifiedFields.push(`Replaced Scene ${targetIdx + 1}: "${old.title}" → "${updated.title}"`);
        }
        break;
      }
      case "create_story_event": {
        const events = [...(currentProj.initialEvents || [])];
        events.push({
          atSeconds: typeof action.atSeconds === "number" ? action.atSeconds : 0,
          characterName: action.characterName || (currentProj.characters[0]?.name || "Lead"),
          eventType: action.eventType || "known_fact",
        });
        events.sort((a, b) => a.atSeconds - b.atSeconds);
        currentProj.initialEvents = events;
        modifiedFields.push(`Added Story Event (${action.eventType}) at ${action.atSeconds}s`);
        break;
      }
      case "delete_story_event": {
        const ident = String(action.identifier).toLowerCase().trim();
        const numIdent = parseInt(ident, 10);
        const prevLen = (currentProj.initialEvents || []).length;
        currentProj.initialEvents = (currentProj.initialEvents || []).filter((ev, idx) => {
          if (!isNaN(numIdent) && (ev.atSeconds === numIdent || idx === numIdent)) return false;
          if (ev.characterName.toLowerCase() === ident) return false;
          if (ev.eventType.toLowerCase() === ident) return false;
          return true;
        });
        if ((currentProj.initialEvents || []).length < prevLen) {
          modifiedFields.push(`Deleted Story Event "${action.identifier}"`);
        }
        break;
      }
      case "replace_story_event": {
        const events = [...(currentProj.initialEvents || [])];
        const ident = String(action.identifier).toLowerCase().trim();
        const numIdent = parseInt(ident, 10);
        const idx = events.findIndex((ev, i) => {
          if (!isNaN(numIdent) && (ev.atSeconds === numIdent || i === numIdent)) return true;
          if (ev.characterName.toLowerCase() === ident) return true;
          return false;
        });
        if (idx !== -1) {
          const old = events[idx];
          events[idx] = {
            atSeconds: typeof action.replacement.atSeconds === "number" ? action.replacement.atSeconds : old.atSeconds,
            characterName: action.replacement.characterName || old.characterName,
            eventType: action.replacement.eventType || old.eventType,
          };
          events.sort((a, b) => a.atSeconds - b.atSeconds);
          currentProj.initialEvents = events;
          modifiedFields.push(`Replaced Story Event at ${events[idx].atSeconds}s`);
        }
        break;
      }
      case "lock_location": {
        const currentScenes: FilmScene[] = [...(currentProj.scenes || [])];
        const ident = String(action.sceneIdentifier).toLowerCase().trim();
        const numIdent = parseInt(ident, 10);
        const targetIdx = currentScenes.findIndex((s, idx) => {
          if (!isNaN(numIdent) && (s.sceneNumber === numIdent || idx + 1 === numIdent)) return true;
          if (s.id.toLowerCase() === ident) return true;
          if (s.title.toLowerCase().includes(ident)) return true;
          return false;
        });
        if (targetIdx !== -1) {
          const sc = currentScenes[targetIdx];
          const candId = action.candidateId;
          const locName = action.locationName?.trim();
          let matchedCand = sc.locationCandidates?.find((c) => {
            if (candId && c.candidate_id === candId) return true;
            if (locName && c.name.toLowerCase().includes(locName.toLowerCase())) return true;
            return false;
          });
          if (matchedCand) {
            currentScenes[targetIdx] = {
              ...sc,
              selectedLocationCandidateId: matchedCand.candidate_id,
              location: matchedCand.name,
            };
            currentProj.scenes = currentScenes;
            modifiedFields.push(`Locked Location: "${matchedCand.name}" for Scene ${sc.sceneNumber}`);
          }
        }
        break;
      }
      case "unlock_location": {
        const currentScenes: FilmScene[] = [...(currentProj.scenes || [])];
        const ident = String(action.sceneIdentifier).toLowerCase().trim();
        const numIdent = parseInt(ident, 10);
        const targetIdx = currentScenes.findIndex((s, idx) => {
          if (!isNaN(numIdent) && (s.sceneNumber === numIdent || idx + 1 === numIdent)) return true;
          if (s.id.toLowerCase() === ident) return true;
          if (s.title.toLowerCase().includes(ident)) return true;
          return false;
        });
        if (targetIdx !== -1) {
          currentScenes[targetIdx] = {
            ...currentScenes[targetIdx],
            selectedLocationCandidateId: undefined,
          };
          currentProj.scenes = currentScenes;
          modifiedFields.push(`Unlocked Location for Scene ${currentScenes[targetIdx].sceneNumber}`);
        }
        break;
      }
      case "set_scene_location": {
        const currentScenes: FilmScene[] = [...(currentProj.scenes || [])];
        const ident = String(action.sceneIdentifier).toLowerCase().trim();
        const numIdent = parseInt(ident, 10);
        const targetIdx = currentScenes.findIndex((s, idx) => {
          if (!isNaN(numIdent) && (s.sceneNumber === numIdent || idx + 1 === numIdent)) return true;
          if (s.id.toLowerCase() === ident) return true;
          if (s.title.toLowerCase().includes(ident)) return true;
          return false;
        });
        if (targetIdx !== -1) {
          currentScenes[targetIdx] = {
            ...currentScenes[targetIdx],
            location: action.location || currentScenes[targetIdx].location,
            shootRegion: action.shootRegion !== undefined ? action.shootRegion : currentScenes[targetIdx].shootRegion,
            locationBudget: typeof action.locationBudget === "number" ? action.locationBudget : currentScenes[targetIdx].locationBudget,
          };
          currentProj.scenes = currentScenes;
          modifiedFields.push(`Updated Location for Scene ${currentScenes[targetIdx].sceneNumber}: "${action.location}"`);
        }
        break;
      }
      case "add_location_candidate": {
        const currentScenes: FilmScene[] = [...(currentProj.scenes || [])];
        const ident = String(action.sceneIdentifier).toLowerCase().trim();
        const numIdent = parseInt(ident, 10);
        const targetIdx = currentScenes.findIndex((s, idx) => {
          if (!isNaN(numIdent) && (s.sceneNumber === numIdent || idx + 1 === numIdent)) return true;
          if (s.id.toLowerCase() === ident) return true;
          if (s.title.toLowerCase().includes(ident)) return true;
          return false;
        });
        if (targetIdx !== -1) {
          const sc = currentScenes[targetIdx];
          const cand = action.candidate;
          const candId = `cand-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
          const newCand = {
            candidate_id: candId,
            name: cand.name || "Custom Scouted Venue",
            category: cand.category || "practical",
            region: cand.region || sc.shootRegion || currentProj.shootRegion || "Production Base",
            rank_score: 0.93,
            score_breakdown: { budget_fit: 0.9, creative_fit: 0.94, shootability: 0.92, consolidation_bonus: 0.85 },
            estimated_cost: {
              day_rate: cand.day_rate || 2500,
              permit_fee: cand.permit_fee || 400,
              currency: currentProj.currency || "USD",
              notes: cand.practical_notes || "Configured via Showrunner Directive.",
            },
            film_precedents: cand.film_precedent ? [{ film: cand.film_precedent, director: cand.director || "Director Comp", why: cand.why || "Cinematic visual precedent" }] : [],
            practical_notes: cand.practical_notes || "Production venue added by Showrunner AI.",
            sources: [],
            search_grounded: false,
            environment_type: cand.environment_type || "practical",
            stage_specs: cand.stage_specs,
            shared_with_scenes: [sc.id],
          };
          const autoLock = cand.auto_lock ?? true;
          currentScenes[targetIdx] = {
            ...sc,
            locationCandidates: [newCand, ...(sc.locationCandidates || [])],
            selectedLocationCandidateId: autoLock ? candId : sc.selectedLocationCandidateId,
            location: autoLock ? newCand.name : sc.location,
          };
          currentProj.scenes = currentScenes;
          modifiedFields.push(`Added Location: "${newCand.name}" to Scene ${sc.sceneNumber}`);
        }
        break;
      }
      case "set_location_budget": {
        if (action.sceneIdentifier !== undefined) {
          const currentScenes: FilmScene[] = [...(currentProj.scenes || [])];
          const ident = String(action.sceneIdentifier).toLowerCase().trim();
          const numIdent = parseInt(ident, 10);
          const targetIdx = currentScenes.findIndex((s, idx) => {
            if (!isNaN(numIdent) && (s.sceneNumber === numIdent || idx + 1 === numIdent)) return true;
            if (s.id.toLowerCase() === ident) return true;
            if (s.title.toLowerCase().includes(ident)) return true;
            return false;
          });
          if (targetIdx !== -1) {
            currentScenes[targetIdx] = {
              ...currentScenes[targetIdx],
              locationBudget: typeof action.budget === "number" ? action.budget : currentScenes[targetIdx].locationBudget,
            };
            currentProj.scenes = currentScenes;
            modifiedFields.push(`Set Scene ${currentScenes[targetIdx].sceneNumber} Budget: $${action.budget?.toLocaleString()}`);
          }
        }
        if (typeof action.locationsPct === "number") {
          currentProj.budgetAllocation = {
            ...(currentProj.budgetAllocation || { locationsPct: 15 }),
            locationsPct: action.locationsPct,
          };
          modifiedFields.push(`Project Location Allocation: ${action.locationsPct}%`);
        }
        break;
      }
      case "set_shoot_region": {
        const region = action.shootRegion?.trim();
        if (region) {
          if (action.sceneIdentifier !== undefined) {
            const currentScenes: FilmScene[] = [...(currentProj.scenes || [])];
            const ident = String(action.sceneIdentifier).toLowerCase().trim();
            const numIdent = parseInt(ident, 10);
            const targetIdx = currentScenes.findIndex((s, idx) => {
              if (!isNaN(numIdent) && (s.sceneNumber === numIdent || idx + 1 === numIdent)) return true;
              if (s.id.toLowerCase() === ident) return true;
              if (s.title.toLowerCase().includes(ident)) return true;
              return false;
            });
            if (targetIdx !== -1) {
              currentScenes[targetIdx] = {
                ...currentScenes[targetIdx],
                shootRegion: region,
              };
              currentProj.scenes = currentScenes;
              modifiedFields.push(`Scene ${currentScenes[targetIdx].sceneNumber} Shoot Region: "${region}"`);
            }
          } else {
            currentProj.shootRegion = region;
            modifiedFields.push(`Production Shoot Region: "${region}"`);
          }
        }
        break;
      }
      case "create_score_take": {
        const currentScenes: FilmScene[] = [...(currentProj.scenes || [])];
        const ident = String(action.sceneIdentifier).toLowerCase().trim();
        const numIdent = parseInt(ident, 10);
        const targetIdx = currentScenes.findIndex((s, idx) => {
          if (!isNaN(numIdent) && (s.sceneNumber === numIdent || idx + 1 === numIdent)) return true;
          if (s.id.toLowerCase() === ident) return true;
          if (s.title.toLowerCase().includes(ident)) return true;
          return false;
        });
        if (targetIdx !== -1) {
          const sc = currentScenes[targetIdx];
          const existingTakes = sc.scoreTakes || [];
          const nextTakeNum = existingTakes.length + 1;
          const newTake: ScoreTake = {
            id: `score-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            sceneId: sc.id,
            takeNumber: nextTakeNum,
            title: action.title || `${sc.title} — Score Take ${String(nextTakeNum).padStart(2, "0")}`,
            prompt: action.prompt || "Atmospheric cinematic score",
            durationMode: (action.durationSec || 30) > 30 ? "pro" : "clip",
            durationSec: action.durationSec || 30,
            createdAt: Date.now(),
            audioUrl: action.audioUrl || "/audio/demo-score.wav",
            lyricsText: action.lyricsText,
            isMaster: action.isMaster ?? (existingTakes.length === 0),
            scoreType: action.scoreType || "score",
            instruments: action.instruments,
            dynamicArc: action.dynamicArc,
            model: action.model || "Lyria 3",
          };
          const updatedTakes = [newTake, ...existingTakes];
          currentScenes[targetIdx] = {
            ...sc,
            activeScoreUrl: newTake.isMaster ? newTake.audioUrl : (sc.activeScoreUrl || newTake.audioUrl),
            scoreTakes: updatedTakes,
          };
          currentProj.scenes = currentScenes;
          modifiedFields.push(`Created Score Take for Scene ${sc.sceneNumber}: "${newTake.title}"`);
        }
        break;
      }
      case "set_master_score": {
        const currentScenes: FilmScene[] = [...(currentProj.scenes || [])];
        const ident = String(action.sceneIdentifier).toLowerCase().trim();
        const numIdent = parseInt(ident, 10);
        const targetIdx = currentScenes.findIndex((s, idx) => {
          if (!isNaN(numIdent) && (s.sceneNumber === numIdent || idx + 1 === numIdent)) return true;
          if (s.id.toLowerCase() === ident) return true;
          if (s.title.toLowerCase().includes(ident)) return true;
          return false;
        });
        if (targetIdx !== -1) {
          const sc = currentScenes[targetIdx];
          const takes = (sc.scoreTakes || []).map((t) => {
            const isMatch = (typeof action.takeNumber === "number" && t.takeNumber === action.takeNumber) || (action.takeId && t.id === action.takeId);
            return { ...t, isMaster: isMatch };
          });
          const masterTake = takes.find((t) => t.isMaster);
          currentScenes[targetIdx] = {
            ...sc,
            activeScoreUrl: masterTake ? masterTake.audioUrl : sc.activeScoreUrl,
            scoreTakes: takes,
          };
          currentProj.scenes = currentScenes;
          modifiedFields.push(`Locked Master Score for Scene ${sc.sceneNumber}`);
        }
        break;
      }
      case "delete_score_take": {
        const currentScenes: FilmScene[] = [...(currentProj.scenes || [])];
        const ident = String(action.sceneIdentifier).toLowerCase().trim();
        const numIdent = parseInt(ident, 10);
        const targetIdx = currentScenes.findIndex((s, idx) => {
          if (!isNaN(numIdent) && (s.sceneNumber === numIdent || idx + 1 === numIdent)) return true;
          if (s.id.toLowerCase() === ident) return true;
          if (s.title.toLowerCase().includes(ident)) return true;
          return false;
        });
        if (targetIdx !== -1) {
          const sc = currentScenes[targetIdx];
          const takes = (sc.scoreTakes || []).filter((t) => t.id !== action.takeId && t.takeNumber !== action.takeNumber);
          currentScenes[targetIdx] = {
            ...sc,
            scoreTakes: takes,
            activeScoreUrl: takes[0]?.audioUrl || undefined,
          };
          currentProj.scenes = currentScenes;
          modifiedFields.push(`Removed Score Take from Scene ${sc.sceneNumber}`);
        }
        break;
      }
    }
  }

  const { nodes, edges } = buildProjectNodesAndEdges(currentProj);
  currentProj.nodes = nodes;
  currentProj.edges = edges;
  currentProj.updatedAt = Date.now();

  return { updatedProject: currentProj, modifiedFields };
}

export function StudioChatWorkspace({
  projects,
  onRefreshProjects,
  onOpenProject,
  onOpenNewProjectDialog,
  onOpenFusionDialog,
  onOpenToolbox,
}: StudioChatWorkspaceProps) {
  const router = useRouter();

  // Chat messages live for the session only — a refresh starts a clean slate.
  const [messages, setMessages] = React.useState<DashboardChatMessage[]>([]);

  // Active project bound to chat: defaults to null so user is never locked to an old slate
  const [activeProjectId, setActiveProjectId] = React.useState<string | null>(null);

  const [input, setInput] = React.useState("");
  const [isThinking, setIsThinking] = React.useState(false);
  const [selectedGenre, setSelectedGenre] = React.useState("Crime Heist");
  const [selectedDirectorStyle, setSelectedDirectorStyle] = React.useState("Denis Villeneuve (Atmospheric)");
  const [activeAtmosphereKey, setActiveAtmosphereKey] = React.useState<AtmosphereKey>("screening");
  const [showAtmosphereMenu, setShowAtmosphereMenu] = React.useState(false);
  const [openThoughts, setOpenThoughts] = React.useState<Record<string, boolean>>({});
  const [showMentionMenu, setShowMentionMenu] = React.useState(false);
  const [mentionQuery, setMentionQuery] = React.useState("");

  const activeAtmosphere = STUDIO_ATMOSPHERES[activeAtmosphereKey] || STUDIO_ATMOSPHERES.screening;

  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Auto-scroll on new messages
  React.useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isThinking]);

  // Find active project object
  const activeProject = React.useMemo(() => {
    if (!activeProjectId) return null;
    return projects.find((p) => p.id === activeProjectId) || null;
  }, [projects, activeProjectId]);

  const toggleThought = (msgId: string) => {
    setOpenThoughts((prev) => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  const handleResetToLanding = () => {
    setMessages([]);
    setActiveProjectId(null);
    setInput("");
  };

  // Check mention triggers
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);

    const lastWord = val.split(/\s+/).pop() || "";
    if (lastWord.startsWith("@")) {
      setShowMentionMenu(true);
      setMentionQuery(lastWord.slice(1).toLowerCase());
    } else {
      setShowMentionMenu(false);
    }
  };

  const handleSelectMention = (text: string) => {
    const words = input.split(/\s+/);
    words.pop();
    words.push(`@${text}`);
    setInput(words.join(" ") + " ");
    setShowMentionMenu(false);
    textareaRef.current?.focus();
  };

  // Helper to extract a title the director already stated in conversation.
  // Returns null if no explicit title was found in the text (caller then
  // asks the Showrunner AI to generate one, rather than picking a canned name).
  const extractStatedTitle = (recentContext: string): string | null => {
    const quoteMatch = recentContext.match(/["']([^"']{3,40})["']/);
    if (quoteMatch) {
      const q = quoteMatch[1].trim();
      if (!/^(hey|hello|hi|yes|no|please|create|ok|thanks)/i.test(q)) {
        return q;
      }
    }
    const titleMatch = recentContext.match(/(?:titled|called|name it|named|working title:?)\s+([A-Za-z0-9\s:—–-]{3,35}?)(?:\s+(?:with|about|where|set|in)|[.,]|$)/i);
    if (titleMatch) {
      return titleMatch[1].trim();
    }
    return null;
  };

  // Static templates used ONLY when the AI casting/title service is
  // unreachable — always paired with a toast disclosure so this never
  // masquerades as live AI output.
  const FALLBACK_TITLES: Record<string, string[]> = {
    "sci-fi": ["The Orbital Horizon", "Chrono Null", "Silicon Horizon", "Station 9 Drift", "Solaris Echo"],
    heist: ["The Velvet Lock", "Monaco Breach", "Zero Sum Protocol", "The Geneva Exchange"],
    noir: ["Neon Protocol", "The Pale Rain", "Midnight Meridian", "Shadows of Cobalt"],
    thriller: ["Fractured Reflection", "The Solitary Echo", "Perception Glass", "Blind Angle"],
    horror: ["The Blackwood Vigil", "Hollow Pines", "Whispers of the Deep"],
    drama: ["The Winter Concord", "Iron & Glass", "The Last Commission"],
  };

  const fallbackTitleFor = (genre: string): string => {
    const g = genre.toLowerCase();
    const bucket =
      (g.includes("sci-fi") || g.includes("space") || g.includes("cyber")) ? FALLBACK_TITLES["sci-fi"] :
      (g.includes("heist") || g.includes("crime")) ? FALLBACK_TITLES.heist :
      (g.includes("noir") || g.includes("detective")) ? FALLBACK_TITLES.noir :
      (g.includes("psych") || g.includes("thriller") || g.includes("mystery")) ? FALLBACK_TITLES.thriller :
      (g.includes("horror") || g.includes("gothic")) ? FALLBACK_TITLES.horror :
      (g.includes("drama") || g.includes("historical")) ? FALLBACK_TITLES.drama :
      null;
    if (!bucket) return "Aethelgard Protocol";
    return bucket[Math.floor(Math.random() * bucket.length)];
  };

  // Calls the real AI ensemble-casting endpoint (Gemini via agent-service).
  // Falls back to curated genre templates ONLY on network/backend failure,
  // and always discloses that fallback to the director via toast.
  const synthesizeCastForContext = async (
    recentContext: string,
    genre: string
  ): Promise<ProjectCharacter[]> => {
    try {
      const res = await fetch("/api/character/synthesize-ensemble", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ genre, premise: recentContext.slice(-1500) }),
      });
      const data = await res.json();
      if (Array.isArray(data.characters) && data.characters.length > 0 && !data._fallback) {
        return data.characters;
      }
    } catch (err) {
      console.warn("Ensemble synthesis request failed:", err);
    }
    toast.add({
      title: "Casting: showing template ensemble",
      description: "The AI casting service is unreachable, so this cast is a curated template, not live AI output.",
      type: "warning",
    });
    return synthesizeDynamicCharacters(genre, recentContext);
  };

  // Main submission handler
  const handleSendMessage = async (customPrompt?: string) => {
    const userPrompt = (customPrompt || input).trim();
    if (!userPrompt || isThinking) return;

    setInput("");
    setShowMentionMenu(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    const userMessage: DashboardChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: userPrompt,
      timestamp: Date.now(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsThinking(true);

    const promptLower = userPrompt.toLowerCase();

    // Check if user is referencing an existing project via @ or exact title match
    let targetProject = activeProject;
    for (const p of projects) {
      if (
        userPrompt.includes(`@${p.title}`) ||
        (userPrompt.length > 5 && promptLower.includes(p.title.toLowerCase()))
      ) {
        targetProject = p;
        setActiveProjectId(p.id);
        break;
      }
    }

    // ────────────────────────────────────────────────────────
    // EXPLICIT PROJECT CREATION CHECK
    // Only triggers if user explicitly commands creation or clicks the creation button
    // ────────────────────────────────────────────────────────
    const isExplicitCreateCommand =
      promptLower === "create project" ||
      promptLower === "create the project" ||
      promptLower === "create a project" ||
      promptLower === "create new project" ||
      promptLower === "create slate" ||
      promptLower === "create the slate" ||
      promptLower === "create a slate" ||
      promptLower === "create production slate" ||
      promptLower === "create the production slate" ||
      promptLower === "create production slate for this story" ||
      promptLower === "spin up the slate" ||
      promptLower === "initialize the project" ||
      promptLower === "initialize project" ||
      promptLower === "yes, create the project" ||
      promptLower === "build this project slate" ||
      promptLower.startsWith("create project for ") ||
      promptLower.startsWith("create the project for ") ||
      promptLower.startsWith("create a project for ") ||
      promptLower.startsWith("create project titled ") ||
      promptLower.startsWith("create project called ") ||
      promptLower.startsWith("create production slate for ");

    try {
      // ────────────────────────────────────────────────────────
      // CASE 1: EXPLICIT PROJECT INITIALIZATION
      // ────────────────────────────────────────────────────────
      if (isExplicitCreateCommand) {
        // Collect discussion history to synthesize premise and characters
        const conversationContext = newMessages
          .map((m) => m.content)
          .join("\n");

        // Extract a strong logline from the conversation
        let logline = userPrompt;
        if (logline.length < 25) {
          const prevUserMsg = newMessages
            .slice(0, -1)
            .reverse()
            .find((m) => m.role === "user");
          logline = prevUserMsg?.content || `A high-tension ${selectedGenre} narrative directed in the style of ${selectedDirectorStyle}.`;
        }

        const statedTitle = extractStatedTitle(conversationContext);
        const characters = await synthesizeCastForContext(conversationContext, selectedGenre);

        let title = statedTitle || "";
        if (!title) {
          try {
            const genRes = await fetch("/api/project/generate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                logline,
                genre: selectedGenre,
                directorStyle: selectedDirectorStyle,
                customCharacters: characters,
              }),
            });
            const genData = await genRes.json();
            if (genData._fallback || genData._generatedBy === "semantic-showrunner-fallback") {
              toast.add({
                title: "Title: showing template name",
                description: "The AI title service is unreachable, so this title is a curated template, not live AI output.",
                type: "warning",
              });
            }
            if (typeof genData.title === "string" && genData.title.trim()) {
              title = genData.title.trim();
            }
          } catch (err) {
            console.warn("Title generation request failed:", err);
          }
        }
        if (!title) {
          toast.add({
            title: "Title: showing template name",
            description: "The AI title service is unreachable, so this title is a curated template, not live AI output.",
            type: "warning",
          });
          title = fallbackTitleFor(selectedGenre);
        }

        const newProject = createNewProjectEntry({
          title,
          logline,
          genre: selectedGenre,
          characters: characters.map((c) => `${c.name} (${c.role || c.archetype})`).join(", "),
        });

        newProject.characters = characters;
        newProject.directorStyle = selectedDirectorStyle;
        const { nodes, edges } = buildProjectNodesAndEdges(newProject);
        newProject.nodes = nodes;
        newProject.edges = edges;

        saveProject(newProject);
        onRefreshProjects();
        setActiveProjectId(newProject.id);

        // Fetch executive analysis and cold open from Showrunner backend
        let showrunnerAnalysis = "";
        let showrunnerSuggestions = [
          `Open Studio & Visual Backlot for "${title}"`,
          `Add a rival named Viktor who suspects ${characters[0]?.name || "the lead"}`,
          `Crank ${characters[1]?.name || "the antagonist"}'s subtext dial to 95%`,
          `Brainstorm the opening cold open scene`,
        ];

        try {
          const res = await fetch("/api/showrunner/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              projectTitle: newProject.title,
              logline: newProject.premise,
              genre: newProject.genre,
              characters: newProject.characters,
              screenplayText: newProject.screenplayText,
              message: `We just locked the premise and initialized the production slate "${newProject.title}". Give me an executive creative review and cold open pitch based on our discussion.`,
              history: newMessages.slice(-6).map((m) => ({
                role: m.role === "user" ? "user" : "showrunner",
                content: m.content,
              })),
            }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.reply) showrunnerAnalysis = data.reply;
            if (Array.isArray(data.suggested_actions) && data.suggested_actions.length > 0) {
              showrunnerSuggestions = [
                `Open Studio & Visual Backlot for "${title}"`,
                ...data.suggested_actions,
              ];
            }
          }
        } catch (apiErr) {
          console.warn("Showrunner creative review failed, using default summary:", apiErr);
        }

        const replyContent = showrunnerAnalysis
          ? `I have initialized the production slate **"${title}"** with 14 visual backlot nodes and registered timeline firewalls in ClickHouse.\n\n${showrunnerAnalysis}\n\nYou can click below to enter the studio and inspect the visual backlot canvas, or continue chatting right here to refine scenes and character beats.`
          : `I have initialized the production slate **"${title}"** with 14 visual backlot nodes—including the Scene Master, Screenplay Draft, 2.39:1 Storyboard Frame, 2D Floor Plan, and Audience Tension Curve. Character psychologies for ${characters.map((c) => c.name).join(" and ")} are wired with ignorance firewalls.\n\nYou can click below to launch the studio, or continue chatting here to direct further.`;

        const assistantReply: DashboardChatMessage = {
          id: `asst-${Date.now()}`,
          role: "assistant",
          content: replyContent,
          thought: `1. Parsed film premise and conversation history.\n2. Synthesized title: "${title}" (${selectedGenre})\n3. Initialized 14 backlot nodes and character psychology graph for ${characters.map((c) => c.name).join(", ")}.\n4. Registered temporal boundaries and event firewalls in ClickHouse.\n5. Production slate created with ID: ${newProject.id}.`,
          timestamp: Date.now(),
          createdProject: newProject,
          suggestedPrompts: showrunnerSuggestions,
        };

        setMessages((prev) => [...prev, assistantReply]);
        setIsThinking(false);
        return;
      }

      // ────────────────────────────────────────────────────────
      // CASE 2: SHOWRUNNER DIRECTIVE EXECUTION ON ACTIVE SLATE
      // Replaced regex with live Gemini 3.7 Showrunner Directive Agent
      // ────────────────────────────────────────────────────────
      if (targetProject) {
        try {
          const res = await fetch("/api/showrunner/execute", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userPrompt,
              project: targetProject,
              history: newMessages.slice(-6).map((m) => ({
                role: m.role === "user" ? "user" : "assistant",
                content: m.content,
              })),
            }),
          });

          if (res.ok) {
            const data = await res.json();
            const actions = Array.isArray(data.actions) ? data.actions : [];

            if (actions.length > 0) {
              const { updatedProject, modifiedFields } = applyShowrunnerActionsToProject(
                targetProject,
                actions
              );

              saveProject(updatedProject);
              onRefreshProjects();

              let thought = data.thought_process || `Showrunner executed directive for "${updatedProject.title}".`;
              if (data.precedents_cited && data.precedents_cited.length > 0) {
                thought +=
                  `\n\nClickHouse Precedent Telemetry:\n` +
                  data.precedents_cited
                    .map(
                      (p: any) =>
                        `- ${p.historical_reference}: ${p.trope} (Retention ${p.audience_retention_pct}%)`
                    )
                    .join("\n");
              }

              const assistantReply: DashboardChatMessage = {
                id: `asst-${Date.now()}`,
                role: "assistant",
                content:
                  data.assistant_message ||
                  `I have executed your requested modifications on **"${updatedProject.title}"**. The visual backlot nodes and temporal timeline reflect these live changes.`,
                thought,
                timestamp: Date.now(),
                updatedProject,
                modifiedFields,
                suggestedPrompts: [
                  `Open Studio & Backlot for "${updatedProject.title}"`,
                  `Audit shoot logistics on stripboard`,
                  `Check continuity against ClickHouse timeline`,
                ],
              };

              setMessages((prev) => [...prev, assistantReply]);
              setIsThinking(false);
              return;
            } else if (data.assistant_message) {
              // Showrunner answered conversationally without mutating state
              let thought = data.thought_process || `Showrunner cognitive analysis for "${targetProject.title}".`;
              if (data.precedents_cited && data.precedents_cited.length > 0) {
                thought +=
                  `\n\nClickHouse Grounding:\n` +
                  data.precedents_cited
                    .map(
                      (p: any) =>
                        `- ${p.historical_reference}: ${p.trope} (Retention ${p.audience_retention_pct}%)`
                    )
                    .join("\n");
              }

              const assistantReply: DashboardChatMessage = {
                id: `asst-${Date.now()}`,
                role: "assistant",
                content: data.assistant_message,
                thought,
                timestamp: Date.now(),
                suggestedPrompts: [
                  `Open Studio & Backlot for "${targetProject.title}"`,
                  `Crank scene tension to 95%`,
                  `Introduce a rival operative`,
                ],
              };

              setMessages((prev) => [...prev, assistantReply]);
              setIsThinking(false);
              return;
            }
          }
        } catch (execErr) {
          console.warn("Showrunner directive execution failed, falling back to chat:", execErr);
        }
      }

      // ────────────────────────────────────────────────────────
      // CASE 3: CONVERSATIONAL HUMAN-LIKE SHOWRUNNER CHAT (DEFAULT)
      // Chats like ChatGPT in a writers' room: listens, brainstorms, explores ideas.
      // ────────────────────────────────────────────────────────
      try {
        const payload = {
          projectTitle: targetProject?.title || "",
          logline: targetProject?.premise || "",
          genre: targetProject?.genre || selectedGenre,
          screenplayText: targetProject?.screenplayText || "",
          characters: targetProject?.characters || [],
          message: userPrompt,
          history: newMessages.slice(-8).map((m) => ({
            role: m.role === "user" ? "user" : "showrunner",
            content: m.content,
          })),
        };

        const res = await fetch("/api/showrunner/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          const data = await res.json();
          let thought = `Executive Showrunner cognitive analysis. Connected to Google ADK reasoning engine.`;
          if (data.precedents_cited && data.precedents_cited.length > 0) {
            thought += `\n\nClickHouse Grounding Benchmarks:\n` +
              data.precedents_cited.map((p: any) => `- ${p.historical_reference}: ${p.trope} (Tension ${p.tension_level}/10, Retention ${p.audience_retention_pct}%)`).join("\n");
          }
          if (data.clickhouse_query_sql) {
            thought += `\n\nExecuted ClickHouse SQL:\n${data.clickhouse_query_sql}`;
          }

          let followups: string[] = [];
          if (Array.isArray(data.suggested_actions) && data.suggested_actions.length > 0) {
            followups = [...data.suggested_actions];
          }

          if (!targetProject) {
            if (!followups.some((f) => f.toLowerCase().includes("create"))) {
              followups.push("Create production slate for this story");
            }
          }

          const assistantReply: DashboardChatMessage = {
            id: `asst-${Date.now()}`,
            role: "assistant",
            content: data.reply || "I am listening, Director. How would you like to develop this further?",
            thought,
            timestamp: Date.now(),
            suggestedPrompts: followups.slice(0, 4),
          };

          setMessages((prev) => [...prev, assistantReply]);
          setIsThinking(false);
          return;
        }
      } catch (chatErr) {
        console.warn("Showrunner chat endpoint fetch error:", chatErr);
      }

      // Contextual fallback if network/service temporarily unreachable
      const fallbackReply: DashboardChatMessage = {
        id: `asst-${Date.now()}`,
        role: "assistant",
        content: targetProject
          ? `Loud and clear. I am actively tracking **"${targetProject.title}"** with ${targetProject.characters.map((c) => c.name).join(" and ")}. What specific beat or dynamic shall we explore next?`
          : `I am here and listening. What kind of world or conflict are we thinking about building today?`,
        thought: `Showrunner listening channel verified.`,
        timestamp: Date.now(),
        suggestedPrompts: targetProject
          ? [
              `Add a rival character to accelerate tension`,
              `Crank scene tension to 95%`,
              `Open Studio & Backlot`,
            ]
          : [
              `Pitch a crime heist film premise`,
              `Brainstorm a hard sci-fi airlock sequence`,
              `Create production slate for this story`,
            ],
      };
      setMessages((prev) => [...prev, fallbackReply]);
      setIsThinking(false);
    } catch (err) {
      console.error("Showrunner error:", err);
      setIsThinking(false);
      setMessages((prev) => [
        ...prev,
        {
          id: `asst-err-${Date.now()}`,
          role: "assistant",
          content: "I encountered an interruption in the writers' room connection. Please try sending your message again.",
          timestamp: Date.now(),
        },
      ]);
    }
  };

  // ──────────────────────────────────────────────────────────────
  // STATE A: INITIAL CLEAN HERO LANDING (Before first message is sent)
  // ──────────────────────────────────────────────────────────────
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center px-4 sm:px-6 py-12 relative overflow-y-auto bg-[#090a0d] min-h-0">
        {/* ── Cinematic Atmosphere Backdrop ── */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden z-0">
          {activeAtmosphere.image ? (
            <div
              key={activeAtmosphere.id}
              className="absolute inset-0 bg-cover bg-center transition-all duration-1000 ease-out transform scale-105 opacity-35 filter brightness-75 contrast-125 pointer-events-none"
              style={{ backgroundImage: `url('${activeAtmosphere.image}')` }}
            />
          ) : null}

          {/* Deep cinematic radial vignette */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_38%,rgba(9,10,13,0.3)_0%,rgba(9,10,13,0.78)_58%,#090a0d_100%)] pointer-events-none" />

          {/* Top & Bottom seamless gradient blend */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#090a0d] via-transparent to-[#090a0d] pointer-events-none" />

          {/* Volumetric Projector Beam / Glowing Spotlight */}
          <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-[760px] h-[380px] bg-gradient-to-b from-amber-400/12 via-cyan-400/5 to-transparent blur-3xl opacity-75 pointer-events-none" />

          {/* Film Grain Texture */}
          <div className="film-grain absolute inset-0 opacity-40 pointer-events-none" />

          {/* Cinematic Viewfinder HUD Overlay */}
          <div className="absolute inset-4 sm:inset-8 border border-white/[0.04] rounded-2xl pointer-events-none hidden lg:block">
            {/* Top-left: Camera Roll / Scope Spec */}
            <div className="absolute top-3 left-3 text-[9px] font-mono tracking-widest text-muted-foreground/45 flex items-center gap-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
              <span>REC 24.00 FPS</span>
              <span>·</span>
              <span>2.39:1 SCOPE</span>
              <span>·</span>
              <span>8K RAW</span>
            </div>
            {/* Top-right: Lens Spec */}
            <div className="absolute top-3 right-3 text-[9px] font-mono tracking-widest text-muted-foreground/45 flex items-center gap-1.5">
              <Aperture className="h-2.5 w-2.5 text-accent/70" />
              <span>T1.5 · 50MM ANAMORPHIC</span>
            </div>
            {/* Bottom-left: Color LUT */}
            <div className="absolute bottom-3 left-3 text-[9px] font-mono tracking-widest text-muted-foreground/45">
              <span>LUT: SHOWRUNNER_VISION3_500T</span>
            </div>
            {/* Bottom-right: Telemetry Status */}
            <div className="absolute bottom-3 right-3 text-[9px] font-mono tracking-widest text-muted-foreground/45 flex items-center gap-1.5">
              <Database className="h-2.5 w-2.5 text-emerald-400/70" />
              <span>CLICKHOUSE PRECEDENTS: ONLINE</span>
            </div>
          </div>
        </div>

        {/* ── Main Hero Content ── */}
        <div className="relative z-10 max-w-2xl mx-auto flex flex-col items-center text-center w-full">
          {/* Status & Atmosphere Selector Pill */}
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#12141c]/80 backdrop-blur-xl px-3.5 py-1 text-xs font-mono text-muted-foreground mb-6 shadow-xl relative">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-foreground/90 font-medium">Showrunner AI</span>
            <span className="text-white/20">·</span>
            <span className="text-muted-foreground/80 hidden sm:inline">ADK & ClickHouse</span>
            <span className="text-white/20 hidden sm:inline">·</span>

            {/* Atmosphere Menu Trigger */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowAtmosphereMenu((prev) => !prev)}
                className="inline-flex items-center gap-1.5 text-[11px] text-accent hover:text-accent/80 font-medium transition-colors cursor-pointer"
                title="Switch Studio Atmosphere"
              >
                <Film className="h-3 w-3" />
                <span>{activeAtmosphere.name}</span>
                <ChevronDown className="h-2.5 w-2.5 opacity-70" />
              </button>

              {showAtmosphereMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowAtmosphereMenu(false)}
                  />
                  <div className="absolute top-full right-0 mt-2 w-64 rounded-xl border border-white/10 bg-[#14161f]/95 backdrop-blur-2xl shadow-2xl p-1.5 z-50 text-left">
                    <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70 border-b border-white/5 mb-1">
                      Select Studio Atmosphere
                    </div>
                    {(Object.keys(STUDIO_ATMOSPHERES) as AtmosphereKey[]).map((key) => {
                      const atm = STUDIO_ATMOSPHERES[key];
                      const isSelected = activeAtmosphereKey === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            setActiveAtmosphereKey(key);
                            setShowAtmosphereMenu(false);
                          }}
                          className={`w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition-colors cursor-pointer ${
                            isSelected
                              ? "bg-accent/20 text-accent font-medium"
                              : "text-neutral-300 hover:bg-white/5 hover:text-white"
                          }`}
                        >
                          <div className="flex flex-col text-left">
                            <span>{atm.name}</span>
                            <span className="text-[10px] text-muted-foreground/60">{atm.tagline}</span>
                          </div>
                          {isSelected && <Check className="h-3.5 w-3.5 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Hero Title with Metallic Cinema Shimmer */}
          <h1 className="font-heading text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-balance">
            <span className="bg-gradient-to-b from-white via-white/95 to-neutral-300/80 bg-clip-text text-transparent drop-shadow-[0_4px_30px_rgba(0,0,0,0.8)]">
              The Showrunner&apos;s Room
            </span>
          </h1>
          <p className="mt-3.5 text-sm md:text-base text-neutral-300/85 max-w-xl text-balance leading-relaxed">
            Brainstorm concepts, develop character psychologies, and shape screenplays. When you&apos;re ready, initialize an interactive production slate.
          </p>

          {/* ── Director Prompt Input Box ── */}
          <div className="mt-8 w-full rounded-2xl border border-white/10 bg-[#0e1118]/85 backdrop-blur-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.95),0_0_35px_rgba(212,160,84,0.07)] p-3.5 text-left focus-within:border-accent/60 focus-within:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.95),0_0_40px_rgba(212,160,84,0.18)] transition-all">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              placeholder="Ask a story question, pitch a scene, or brainstorm a premise (e.g. 'I want to write a high-tension heist where the two leads realize they're both working for rival cartels...')"
              className="w-full min-h-[82px] bg-transparent text-sm md:text-base text-foreground placeholder:text-muted-foreground/60 resize-none focus:outline-none leading-relaxed"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />

            {/* Bottom toolbar */}
            <div className="flex items-center justify-between gap-2 pt-3 border-t border-white/5">
              <div className="flex items-center gap-2">
                {/* Genre Selector */}
                <div className="relative flex items-center">
                  <select
                    value={selectedGenre}
                    onChange={(e) => {
                      const nextGenre = e.target.value;
                      setSelectedGenre(nextGenre);
                      if (GENRE_ATMOSPHERE_MAP[nextGenre]) {
                        setActiveAtmosphereKey(GENRE_ATMOSPHERE_MAP[nextGenre]);
                      }
                    }}
                    className="h-7.5 rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] px-2.5 text-xs text-foreground focus:outline-none cursor-pointer appearance-none pr-6 font-medium transition-colors"
                  >
                    <option value="Crime Heist" className="bg-[#12141a] text-foreground">Crime Heist</option>
                    <option value="Deep Space Sci-Fi" className="bg-[#12141a] text-foreground">Deep Space Sci-Fi</option>
                    <option value="Cyberpunk Noir" className="bg-[#12141a] text-foreground">Cyberpunk Noir</option>
                    <option value="Psychological Drama" className="bg-[#12141a] text-foreground">Psychological Drama</option>
                    <option value="Action Thriller" className="bg-[#12141a] text-foreground">Action Thriller</option>
                  </select>
                  <ChevronDown className="absolute right-1.5 h-3 w-3 text-muted-foreground pointer-events-none" />
                </div>

                {/* Director Style */}
                <div className="relative items-center hidden sm:flex">
                  <select
                    value={selectedDirectorStyle}
                    onChange={(e) => setSelectedDirectorStyle(e.target.value)}
                    className="h-7.5 rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] px-2.5 text-xs text-foreground focus:outline-none cursor-pointer appearance-none pr-6 font-medium transition-colors"
                  >
                    <option value="Denis Villeneuve (Atmospheric)" className="bg-[#12141a] text-foreground">Denis Villeneuve</option>
                    <option value="David Fincher (Procedural)" className="bg-[#12141a] text-foreground">David Fincher</option>
                    <option value="Christopher Nolan (Temporal)" className="bg-[#12141a] text-foreground">Christopher Nolan</option>
                    <option value="Michael Mann (High Tension)" className="bg-[#12141a] text-foreground">Michael Mann</option>
                    <option value="A24 Indie (Psychological)" className="bg-[#12141a] text-foreground">A24 Indie</option>
                  </select>
                  <ChevronDown className="absolute right-1.5 h-3 w-3 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              <Button
                variant="default"
                size="sm"
                onClick={() => handleSendMessage()}
                disabled={isThinking || !input.trim()}
                className="h-7.5 px-4 bg-foreground text-background hover:bg-foreground/90 font-semibold text-xs gap-1.5 shadow-md ml-auto rounded-lg transition-transform active:scale-95"
              >
                <span>Send</span>
                <ArrowUp className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Quick Conversational Starter Chips */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
            <button
              onClick={() => {
                setSelectedGenre("Cyberpunk Noir");
                setActiveAtmosphereKey("cyberpunk");
                handleSendMessage("Let's brainstorm a neo-noir crime thriller set in a rain-slicked port city");
              }}
              className="rounded-full border border-teal-500/25 bg-[#12151c]/80 hover:bg-teal-950/40 hover:border-teal-400/60 px-3.5 py-1.5 text-xs text-neutral-300 hover:text-white transition-all shadow-md flex items-center gap-1.5 group backdrop-blur-md cursor-pointer"
            >
              <Clapperboard className="h-3 w-3 text-teal-400 group-hover:rotate-6 transition-transform" />
              <span>Neo-noir crime thriller</span>
            </button>

            <button
              onClick={() => {
                setSelectedGenre("Deep Space Sci-Fi");
                setActiveAtmosphereKey("orbital");
                handleSendMessage("How do I build tension between two estranged operators trapped in a locked airlock?");
              }}
              className="rounded-full border border-cyan-500/25 bg-[#12151c]/80 hover:bg-cyan-950/40 hover:border-cyan-400/60 px-3.5 py-1.5 text-xs text-neutral-300 hover:text-white transition-all shadow-md flex items-center gap-1.5 group backdrop-blur-md cursor-pointer"
            >
              <Orbit className="h-3 w-3 text-cyan-400 group-hover:scale-110 transition-transform" />
              <span>Sci-fi airlock tension</span>
            </button>

            <button
              onClick={() => {
                setSelectedGenre("Psychological Drama");
                setActiveAtmosphereKey("screening");
                handleSendMessage("Help me write an interrogation scene with an unreliable narrator");
              }}
              className="rounded-full border border-purple-500/25 bg-[#12151c]/80 hover:bg-purple-950/40 hover:border-purple-400/60 px-3.5 py-1.5 text-xs text-neutral-300 hover:text-white transition-all shadow-md flex items-center gap-1.5 group backdrop-blur-md cursor-pointer"
            >
              <Brain className="h-3 w-3 text-purple-400 group-hover:scale-110 transition-transform" />
              <span>Psychological interrogation</span>
            </button>

            <button
              onClick={onOpenNewProjectDialog}
              className="rounded-full border border-white/10 bg-[#12151c]/80 hover:bg-white/10 px-3.5 py-1.5 text-xs text-neutral-300 hover:text-white transition-all shadow-md flex items-center gap-1.5 backdrop-blur-md cursor-pointer"
            >
              <Plus className="h-3 w-3 text-accent" />
              <span>Blank Slate</span>
            </button>
          </div>

          {/* Sub-links / Quick Telemetry */}
          <div className="mt-5 flex items-center gap-3 text-xs text-muted-foreground/80">
            <span>or jump to:</span>
            <button onClick={onOpenToolbox} className="hover:text-foreground underline decoration-dotted transition-colors flex items-center gap-1 cursor-pointer">
              <Database className="h-3 w-3 text-accent" />
              ClickHouse Precedents
            </button>
            <span>·</span>
            <Link href="/canvas-demo" className="hover:text-foreground underline decoration-dotted transition-colors flex items-center gap-1">
              <Layers className="h-3 w-3 text-cyan-400" />
              Interactive Canvas
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────
  // STATE B: INTERACTIVE CHAT SCREEN (Spacious, Full-Height ChatGPT Style)
  // ──────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#090a0d] text-foreground relative">
      {/* Subtle cinematic backdrop in chat mode */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden z-0">
        {activeAtmosphere.image ? (
          <div
            key={activeAtmosphere.id}
            className="absolute inset-0 bg-cover bg-center transition-all duration-1000 ease-out opacity-20 filter brightness-60 contrast-125 pointer-events-none"
            style={{ backgroundImage: `url('${activeAtmosphere.image}')` }}
          />
        ) : null}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,rgba(9,10,13,0.7)_0%,rgba(9,10,13,0.95)_70%,#090a0d_100%)] pointer-events-none" />
        <div className="film-grain absolute inset-0 opacity-30 pointer-events-none" />
      </div>

      {/* ── Ultra-Slim Sub-Header Strip (h-10) ── */}
      <div className="h-10 border-b border-border/70 px-4 sm:px-6 flex items-center justify-between bg-[#0c0d10]/95 backdrop-blur shrink-0 z-10">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-foreground font-medium">Showrunner AI</span>
          </div>

          {activeProject ? (
            <div className="flex items-center gap-1.5 ml-2 pl-2.5 border-l border-border/60">
              <span className="text-[11px] font-mono text-muted-foreground hidden sm:inline">
                Slate:
              </span>
              <button
                onClick={() => onOpenProject(activeProject.id)}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-accent/15 border border-accent/30 text-accent hover:bg-accent/25 text-xs font-medium truncate transition-colors"
                title="Open visual studio"
              >
                <Film className="h-3 w-3 shrink-0" />
                <span className="truncate max-w-[140px]">{activeProject.title}</span>
                <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-70" />
              </button>
              <button
                onClick={() => setActiveProjectId(null)}
                className="text-muted-foreground hover:text-foreground p-0.5"
                title="Detach slate to ideate freely"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <span className="text-[11px] font-mono text-muted-foreground/70 hidden sm:inline ml-2 pl-2 border-l border-border/60">
              Writers&apos; Room Ideation
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Atmosphere Selector in Chat Strip */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowAtmosphereMenu((prev) => !prev)}
              className="h-6 text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 px-2 rounded border border-border/60 hover:bg-secondary/40 transition-colors cursor-pointer"
              title="Switch studio atmosphere"
            >
              <Film className="h-3 w-3 text-accent" />
              <span className="hidden sm:inline">{activeAtmosphere.name}</span>
              <ChevronDown className="h-2.5 w-2.5 opacity-60" />
            </button>
            {showAtmosphereMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowAtmosphereMenu(false)}
                />
                <div className="absolute top-full right-0 mt-1.5 w-64 rounded-xl border border-white/10 bg-[#14161f]/95 backdrop-blur-2xl shadow-2xl p-1.5 z-50 text-left">
                  <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70 border-b border-white/5 mb-1">
                    Select Studio Atmosphere
                  </div>
                  {(Object.keys(STUDIO_ATMOSPHERES) as AtmosphereKey[]).map((key) => {
                    const atm = STUDIO_ATMOSPHERES[key];
                    const isSelected = activeAtmosphereKey === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          setActiveAtmosphereKey(key);
                          setShowAtmosphereMenu(false);
                        }}
                        className={`w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-accent/20 text-accent font-medium"
                            : "text-neutral-300 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        <div className="flex flex-col text-left">
                          <span>{atm.name}</span>
                          <span className="text-[10px] text-muted-foreground/60">{atm.tagline}</span>
                        </div>
                        {isSelected && <Check className="h-3.5 w-3.5 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {activeProject && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenProject(activeProject.id)}
              className="h-6 text-[11px] border-accent/40 text-accent hover:bg-accent/10 gap-1 px-2"
            >
              <Play className="h-2.5 w-2.5 fill-current" />
              <span>Studio</span>
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetToLanding}
            className="h-6 text-[11px] text-muted-foreground hover:text-foreground gap-1 px-2"
            title="Start new conversation"
          >
            <RotateCcw className="h-3 w-3" />
            <span>New Chat</span>
          </Button>
        </div>
      </div>

      {/* ── Chat Messages Scroll Feed (Takes 85%+ Screen Height) ── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-6 py-6 space-y-6 max-w-3xl mx-auto w-full relative z-10">
        {messages.map((msg, idx) => {
          const isUser = msg.role === "user";
          const isLastAssistant = !isUser && (idx === messages.length - 1 || (idx === messages.length - 2 && messages[messages.length - 1].role === "user"));

          return (
            <div
              key={msg.id}
              className={`flex gap-3 min-w-0 ${isUser ? "justify-end" : "justify-start"}`}
            >
              {/* Showrunner Avatar */}
              {!isUser && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/15 border border-accent/30 text-accent shadow-xs mt-0.5">
                  <Bot className="h-3.5 w-3.5" />
                </div>
              )}

              <div className={`flex flex-col gap-1.5 min-w-0 max-w-[88%] sm:max-w-[82%] ${isUser ? "items-end" : "items-start"}`}>
                {/* Author Label */}
                <div className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground">
                  <span>{isUser ? "Director" : "Showrunner"}</span>
                  <span>·</span>
                  <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </div>

                {/* Message Bubble */}
                <div
                  className={`rounded-2xl px-4 py-3 text-sm leading-relaxed min-w-0 max-w-full overflow-hidden backdrop-blur-xl ${
                    isUser
                      ? "bg-secondary/90 border border-white/10 text-foreground shadow-sm rounded-tr-xs"
                      : "bg-[#12141c]/90 border border-white/10 text-foreground shadow-xl rounded-tl-xs"
                  }`}
                >
                  {/* Showrunner Telemetry Accordion (Collapsed by Default) */}
                  {!isUser && msg.thought && (
                    <div className="mb-2.5 rounded-lg border border-border/60 bg-secondary/20 overflow-hidden">
                      <button
                        onClick={() => toggleThought(msg.id)}
                        className="w-full flex items-center justify-between px-2.5 py-1 text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <span className="flex items-center gap-1.5 text-accent/90">
                          <Sparkles className="h-3 w-3" />
                          <span>Showrunner Telemetry & Precedents (ClickHouse)</span>
                        </span>
                        {openThoughts[msg.id] ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )}
                      </button>
                      {openThoughts[msg.id] && (
                        <div className="px-2.5 pb-2 pt-1 border-t border-border/40 text-[10px] font-mono text-muted-foreground whitespace-pre-wrap leading-relaxed">
                          {msg.thought}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Message Content */}
                  {isUser ? (
                    <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                  ) : (
                    <div className="break-words max-w-full overflow-hidden">
                      <MarkdownRenderer content={msg.content} />
                    </div>
                  )}

                  {/* ──────────────────────────────────────────────────────────
                      INTERACTIVE CARD: CREATED PRODUCTION SLATE
                  ────────────────────────────────────────────────────────── */}
                  {msg.createdProject && (
                    <div className="mt-3.5 rounded-xl border border-accent/40 bg-card overflow-hidden shadow-lg p-4 space-y-3">
                      {/* Slate Header */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <Badge variant="outline" className={`text-[10px] font-mono font-medium ${getGenreStyle(msg.createdProject.genre).badge}`}>
                            {msg.createdProject.genre}
                          </Badge>
                          <span className="text-[10px] font-mono text-muted-foreground truncate border-l border-border/60 pl-2">
                            {msg.createdProject.sceneTitle || "Scene 01"}
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-accent/15 border border-accent/30 font-mono text-[10px] text-accent font-semibold shrink-0">
                          SLATE CREATED
                        </span>
                      </div>

                      {/* Title & Logline */}
                      <div className="space-y-1">
                        <h3 className="font-heading text-base font-bold text-foreground">
                          {msg.createdProject.title}
                        </h3>
                        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 pl-2.5 border-l-2 border-accent/40">
                          {msg.createdProject.premise}
                        </p>
                      </div>

                      {/* Dynamic Cast Badges */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1 mr-1">
                          <Users className="h-3 w-3" />
                          Cast:
                        </span>
                        {msg.createdProject.characters.map((c, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded bg-secondary/80 border border-border/70 text-[10px] font-mono text-foreground"
                          >
                            {c.name} {c.role ? `(${c.role})` : ""}
                          </span>
                        ))}
                      </div>

                      {/* Metadata Strip */}
                      <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground pt-1.5 border-t border-border/40">
                        <span>Director: {msg.createdProject.directorStyle || "Hollywood Standard"}</span>
                        <span className="text-emerald-400">14 Backlot Nodes Configured</span>
                      </div>

                      {/* Primary Action Button */}
                      <div>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => onOpenProject(msg.createdProject!.id)}
                          className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-semibold text-xs gap-2 h-8 shadow-md"
                        >
                          <Play className="h-3 w-3 fill-current" />
                          <span>Enter Studio & Visual Backlot</span>
                          <ArrowRight className="h-3 w-3 ml-auto" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* ──────────────────────────────────────────────────────────
                      INTERACTIVE CARD: MODIFIED PRODUCTION SLATE
                  ────────────────────────────────────────────────────────── */}
                  {msg.updatedProject && msg.modifiedFields && (
                    <div className="mt-3 rounded-xl border border-border/80 bg-secondary/20 p-2.5 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-heading text-xs font-bold text-foreground flex items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5 text-accent" />
                          {msg.updatedProject.title} (Updated)
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onOpenProject(msg.updatedProject!.id)}
                          className="h-6 text-[11px] text-accent hover:text-accent/80 gap-1 p-1"
                        >
                          <span>Open Studio</span>
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {msg.modifiedFields.map((field, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-mono text-emerald-400 flex items-center gap-1"
                          >
                            <Check className="h-2.5 w-2.5" />
                            {field}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Suggested Follow-up Prompts */}
                {!isUser && isLastAssistant && msg.suggestedPrompts && msg.suggestedPrompts.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {msg.suggestedPrompts.map((p, i) => (
                      <button
                        key={i}
                        onClick={() => handleSendMessage(p)}
                        className="rounded-full border border-border/70 bg-secondary/30 hover:bg-secondary/70 hover:border-accent/40 px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground transition-all text-left flex items-center gap-1.5 shadow-xs"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-accent/60" />
                        <span>{p}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* User Avatar */}
              {isUser && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-secondary border border-border text-foreground font-mono text-[10px] font-bold shadow-xs mt-0.5">
                  YOU
                </div>
              )}
            </div>
          );
        })}

        {/* Thinking Indicator */}
        {isThinking && (
          <div className="flex gap-3 items-start">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/15 border border-accent/30 text-accent shadow-xs animate-pulse">
              <Bot className="h-3.5 w-3.5" />
            </div>
            <div className="rounded-2xl rounded-tl-xs px-3.5 py-2.5 bg-[#13151b] border border-border text-foreground shadow-md flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: "300ms" }} />
              <span className="text-xs font-mono text-muted-foreground ml-1.5">
                Showrunner considering story beats...
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Compact, Modern Floating Chat Input (Height ~60px) ── */}
      <div className="border-t border-white/10 bg-[#0c0d12]/85 backdrop-blur-2xl px-4 py-3 shrink-0 z-20 shadow-2xl">
        <div className="max-w-3xl mx-auto">
          {/* Autocomplete Dropdown for @ mentions */}
          {showMentionMenu && (
            <div className="mb-2 w-72 rounded-xl border border-white/10 bg-[#161822]/95 backdrop-blur-xl shadow-2xl p-1.5 z-30 space-y-1">
              <div className="px-2 py-1 text-[10px] font-mono uppercase text-muted-foreground border-b border-white/5">
                Mention Slate
              </div>
              <div className="max-h-40 overflow-y-auto space-y-0.5">
                {projects
                  .filter((p) => p.title.toLowerCase().includes(mentionQuery))
                  .map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleSelectMention(p.title)}
                      className="w-full flex items-center justify-between rounded-lg px-2 py-1 text-xs text-foreground hover:bg-secondary/60 text-left"
                    >
                      <span className="truncate">{p.title}</span>
                      <span className="text-[10px] font-mono text-accent">Slate</span>
                    </button>
                  ))}
              </div>
            </div>
          )}

          {/* Sleek Pill Input Container */}
          <div className="relative rounded-2xl border border-white/10 bg-[#12141c]/90 backdrop-blur-xl px-3.5 py-1.5 text-left focus-within:border-accent/60 shadow-xl transition-all flex items-center gap-2 min-h-[46px]">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                handleInputChange(e);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={
                activeProject
                  ? `Direct "${activeProject.title}" or ask questions...`
                  : "Talk with the Showrunner, pitch an idea, or type 'create project'..."
              }
              rows={1}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none leading-5 py-1 m-0 max-h-28 overflow-y-auto block"
            />

            <Button
              variant="default"
              size="icon-sm"
              onClick={() => handleSendMessage()}
              disabled={isThinking || !input.trim()}
              className="h-8 w-8 rounded-full bg-foreground text-background hover:bg-foreground/90 shrink-0 shadow-sm flex items-center justify-center self-center"
              title="Send message"
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          </div>

          {/* Micro Footer Information */}
          <div className="flex items-center justify-between pt-1.5 px-2 text-[10px] font-mono text-muted-foreground/70">
            <div className="flex items-center gap-2">
              <span>Genre: {selectedGenre}</span>
              <span>·</span>
              <span>Lens: {selectedDirectorStyle.split(" ")[0]}</span>
            </div>
            <span>Type &quot;create project&quot; when ready to spin up slate</span>
          </div>
        </div>
      </div>
    </div>
  );
}
