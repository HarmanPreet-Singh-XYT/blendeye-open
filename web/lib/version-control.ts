"use client";

import type { Node, Edge } from "@xyflow/react";
import type { ProjectCharacter } from "@/lib/project-store";

export type HistoryCategory =
  | "node_add"
  | "node_remove"
  | "wire_add"
  | "wire_remove"
  | "parameter"
  | "script"
  | "layout"
  | "milestone"
  | "initial";

export interface SnapshotState {
  nodes: Node[];
  edges: Edge[];
  characters?: ProjectCharacter[];
  sceneTitle?: string;
  sceneSummary?: string;
  screenplayText?: string;
}

export interface HistoryEntry {
  id: string;
  timestamp: string; // ISO string
  displayTime: string;
  summary: string;
  description?: string;
  category: HistoryCategory;
  snapshot: SnapshotState;
}

const MAX_HISTORY = 40;

export class StudioVersionControl {
  private projectId: string;
  private history: HistoryEntry[] = [];
  private currentIndex: number = -1;
  private listeners: Array<() => void> = [];

  constructor(projectId: string, initialState?: SnapshotState) {
    this.projectId = projectId;
    this.loadFromStorage();

    if (this.history.length === 0 && initialState) {
      const now = new Date();
      const initialEntry: HistoryEntry = {
        id: `rev-init-${Date.now().toString(36)}`,
        timestamp: now.toISOString(),
        displayTime: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        summary: "Project Backlot Initialized",
        description: "Initial seed graph loaded with characters, scenes and director suite",
        category: "initial",
        snapshot: this.cloneSnapshot(initialState),
      };
      this.history = [initialEntry];
      this.currentIndex = 0;
      this.saveToStorage();
    }
  }

  private cloneSnapshot(snap: SnapshotState): SnapshotState {
    return {
      nodes: JSON.parse(JSON.stringify(snap.nodes || [])),
      edges: JSON.parse(JSON.stringify(snap.edges || [])),
      characters: snap.characters ? JSON.parse(JSON.stringify(snap.characters)) : undefined,
      sceneTitle: snap.sceneTitle,
      sceneSummary: snap.sceneSummary,
      screenplayText: snap.screenplayText,
    };
  }

  /**
   * Revision history is intentionally session-scoped.
   *
   * It used to be mirrored into localStorage, which made it survive a refresh
   * but also made it a second source of truth alongside the cloud project —
   * exactly the local-vs-cloud split this refactor removes. The durable,
   * cross-session equivalent is the `project_snapshots` table; wiring this
   * class to it needs its own API route and is not done here, so undo/redo
   * now covers the current session only.
   */
  private loadFromStorage() {
    // No browser persistence by design — see the comment above.
    this.history = [];
    this.currentIndex = -1;
  }

  private saveToStorage() {
    // No browser persistence by design — see the comment above.
  }

  public subscribe(fn: () => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  private notify() {
    this.saveToStorage();
    this.listeners.forEach((fn) => fn());
  }

  public recordChange(
    summary: string,
    category: HistoryCategory,
    snapshot: SnapshotState,
    description?: string
  ): HistoryEntry {
    const now = new Date();
    const entry: HistoryEntry = {
      id: `rev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: now.toISOString(),
      displayTime: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      summary,
      description,
      category,
      snapshot: this.cloneSnapshot(snapshot),
    };

    // If we've undone some steps and then make a new change, discard the redo future
    if (this.currentIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.currentIndex + 1);
    }

    this.history.push(entry);
    if (this.history.length > MAX_HISTORY) {
      this.history.shift();
    }
    this.currentIndex = this.history.length - 1;

    this.notify();
    return entry;
  }

  public canUndo(): boolean {
    return this.currentIndex > 0;
  }

  public canRedo(): boolean {
    return this.currentIndex < this.history.length - 1;
  }

  public undo(): SnapshotState | null {
    if (!this.canUndo()) return null;
    this.currentIndex--;
    this.notify();
    return this.cloneSnapshot(this.history[this.currentIndex].snapshot);
  }

  public redo(): SnapshotState | null {
    if (!this.canRedo()) return null;
    this.currentIndex++;
    this.notify();
    return this.cloneSnapshot(this.history[this.currentIndex].snapshot);
  }

  public revertTo(entryId: string): SnapshotState | null {
    const idx = this.history.findIndex((h) => h.id === entryId);
    if (idx === -1) return null;
    this.currentIndex = idx;
    this.notify();
    return this.cloneSnapshot(this.history[idx].snapshot);
  }

  public getHistory(): HistoryEntry[] {
    return [...this.history];
  }

  public getCurrentIndex(): number {
    return this.currentIndex;
  }

  public getCurrentEntry(): HistoryEntry | null {
    return this.history[this.currentIndex] || null;
  }

  public createMilestone(milestoneName: string, description?: string): HistoryEntry | null {
    const current = this.getCurrentEntry();
    if (!current) return null;
    return this.recordChange(
      `Milestone Take: ${milestoneName}`,
      "milestone",
      current.snapshot,
      description || `Locked take checkpoint at ${new Date().toLocaleTimeString()}`
    );
  }
}
