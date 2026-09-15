import type { Node, Edge } from "@xyflow/react";
import type { ProjectCharacter } from "@/lib/project-store";

export interface NodeContribution {
  id: string;
  type: string;
  label: string;
  summary: string;
  badgeColor: string;
}

export interface SynthesisOptions {
  nodes?: Node[];
  edges?: Edge[];
  characters?: ProjectCharacter[];
  sceneTitle: string;
  sceneSummary?: string;
  screenplayText?: string;
  genre?: string;
  focusCharacterName?: string | null;
  cameraMotion?: string;
  stylePreset?: string;
  imagePreference?: "face" | "body" | "auto";
}

export interface SynthesisResult {
  fullPrompt: string;
  summary: string;
  conditioningImageUrl: string | null;
  conditioningImageType: "face" | "body" | "scene" | null;
  activeCharacter: ProjectCharacter | null;
  contributions: NodeContribution[];
}

/**
 * Extract a concise dialogue or action beat from screenplay text
 */
function extractScreenplayBeat(screenplayText?: string, targetCharacter?: string): string {
  if (!screenplayText) return "";
  const lines = screenplayText.split("\n").map((l) => l.trim()).filter(Boolean);
  
  if (targetCharacter) {
    const targetUpper = targetCharacter.toUpperCase();
    for (let i = 0; i < lines.length; i++) {
      if (lines[i] === targetUpper && lines[i + 1] && !lines[i + 1].startsWith("(")) {
        return `"${lines[i + 1]}"`;
      }
    }
  }

  // Look for first strong action line or dialogue
  for (const line of lines) {
    if (
      !line.startsWith("INT.") &&
      !line.startsWith("EXT.") &&
      line !== line.toUpperCase() &&
      line.length > 20 &&
      line.length < 160
    ) {
      return line;
    }
  }

  return "";
}

/**
 * Walk the ReactFlow edge graph from `startNodeId` and collect all reachable
 * nodes. Traversal is bidirectional (both source→target and target→source edges
 * are followed) so that a Style Ref Clip wired INTO the Scene Master is still
 * reachable even though the edge points from Clip → Scene.
 *
 * Falls back to returning ALL nodes when:
 *  - no `startNodeId` is provided (no Scene Master on canvas), or
 *  - `edges` is empty (nothing wired — legacy behaviour preserved)
 */
function resolveConnectedNodes(
  nodes: Node[],
  edges: Edge[],
  startNodeId?: string
): Node[] {
  // No anchor node or no wiring at all → legacy glob (all nodes contribute)
  if (!startNodeId || edges.length === 0) return nodes;

  const adjacency = new Map<string, string[]>();

  for (const e of edges) {
    if (!adjacency.has(e.source)) adjacency.set(e.source, []);
    if (!adjacency.has(e.target)) adjacency.set(e.target, []);
    adjacency.get(e.source)!.push(e.target);
    adjacency.get(e.target)!.push(e.source);
  }

  const visited = new Set<string>();
  const queue = [startNodeId];
  visited.add(startNodeId);

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const neighbor of adjacency.get(current) || []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  return nodes.filter((n) => visited.has(n.id));
}

/**
 * Intelligently synthesize a comprehensive cinematic prompt and image conditioning
 * by aggregating data across all Canvas Nodes and Character profiles.
 */
export function synthesizeCinemaPrompt(options: SynthesisOptions): SynthesisResult {
  const {
    nodes = [],
    edges = [],
    characters = [],
    sceneTitle,
    sceneSummary = "",
    screenplayText = "",
    genre = "Cinema",
    focusCharacterName,
    cameraMotion = "Slow Cinematic Dolly In",
    stylePreset = "35mm Anamorphic Film, 2.39:1 Scope",
    imagePreference = "auto",
  } = options;

  const contributions: NodeContribution[] = [];

  // 1. Scene Master Node Context
  const sceneNode = nodes.find((n) => n.type === "scene");
  const slugline = (sceneNode?.data?.slugline as string) || "INT. PRODUCTION - CINEMATIC LIGHT";
  const sceneStakes = (sceneNode?.data?.stakes as string) || sceneSummary;

  // Compute the connected subgraph — only nodes reachable from the Scene Master
  // via wired edges contribute to the prompt. Falls back to all nodes when there
  // is no scene anchor or when the canvas has no edges at all (legacy compat).
  const connectedNodes = resolveConnectedNodes(nodes, edges, sceneNode?.id);

  contributions.push({
    id: sceneNode?.id || "node-scene-master",
    type: "scene",
    label: "Scene Master",
    summary: `${slugline} · ${sceneTitle}`,
    badgeColor: "border-blue-500/40 bg-blue-500/10 text-blue-300",
  });

  // 2. Style Reference Clip Node Context (Lighting, Palette, Pacing)
  const clipNode = connectedNodes.find((n) => n.type === "clip");
  const lightingStudy = (clipNode?.data?.lightingStyle as string) || "High-contrast cinematic chiaroscuro, volumetric rim lighting";
  const colorPalette = (clipNode?.data?.palette as string[]) || ["#0b132b", "#1c2541", "#3a506b"];
  const pacingStyle = (clipNode?.data?.pacing as string) || "Taut cinematic slow-burn";

  if (clipNode) {
    contributions.push({
      id: clipNode.id,
      type: "clip",
      label: "Style Study Clip",
      summary: `${lightingStudy.slice(0, 45)}...`,
      badgeColor: "border-amber-500/40 bg-amber-500/10 text-amber-300",
    });
  }

  // 3. Storyboard Node Context
  const storyboardNode = connectedNodes.find((n) => n.type === "storyboard");
  const storyboardFraming = (storyboardNode?.data?.shotType as string) || "2.39:1 Anamorphic Scope";
  const storyboardPrompt = (storyboardNode?.data?.prompt as string) || "";
  if (storyboardNode) {
    contributions.push({
      id: storyboardNode.id,
      type: "storyboard",
      label: "Storyboard Framing",
      summary: storyboardFraming,
      badgeColor: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
    });
  }

  // 4. Director 2D Floor Plan Staging Context
  const floorplanNode = connectedNodes.find((n) => n.type === "floorplan");
  const floorplanBlocking = (floorplanNode?.data?.blockingPrompt as string) || "";
  const floorplanCam = (floorplanNode?.data?.activeCam as string) || "";
  if (floorplanNode) {
    contributions.push({
      id: floorplanNode.id,
      type: "floorplan",
      label: "2D Floor Plan Blocking",
      summary: floorplanBlocking ? floorplanBlocking.slice(0, 50) : `${floorplanCam || "35mm"} Camera Staging`,
      badgeColor: "border-blue-500/40 bg-blue-500/10 text-blue-300",
    });
  }

  // 5. Tension Curve Node Context (Audience EKG & Pacing)
  const tensionNode = connectedNodes.find((n) => n.type === "tensionCurve");
  const peakTension = tensionNode?.data?.peakTension as number | undefined;
  const pacingPrompt = (tensionNode?.data?.pacingPrompt as string) || "";
  if (tensionNode) {
    contributions.push({
      id: tensionNode.id,
      type: "tensionCurve",
      label: "Tension & Pacing Curve",
      summary: pacingPrompt ? pacingPrompt.slice(0, 50) : (peakTension ? `Peak Tension: ${peakTension}%` : "Audience EKG"),
      badgeColor: "border-rose-500/40 bg-rose-500/10 text-rose-300",
    });
  }

  // 6. Chemistry Node Context
  const chemistryNode = connectedNodes.find((n) => n.type === "chemistry");
  const chemistryScenario = chemistryNode?.data?.scenario as string | undefined;
  if (chemistryNode && chemistryScenario) {
    contributions.push({
      id: chemistryNode.id,
      type: "chemistry",
      label: "Chemistry Bench",
      summary: chemistryScenario.slice(0, 45),
      badgeColor: "border-pink-500/40 bg-pink-500/10 text-pink-300",
    });
  }

  // 7. Screenplay Draft Node Context
  const scriptNode = connectedNodes.find((n) => n.type === "script");
  const scriptBeat = extractScreenplayBeat(screenplayText, focusCharacterName || undefined);
  if (scriptBeat) {
    contributions.push({
      id: scriptNode?.id || "node-script-beat",
      type: "script",
      label: "Screenplay Beat",
      summary: scriptBeat.slice(0, 50),
      badgeColor: "border-cyan-500/40 bg-cyan-500/10 text-cyan-300",
    });
  }

  // 8. Table Read / Voice Rehearsal Context
  const tableReadNode = connectedNodes.find((n) => n.type === "tableRead");
  if (tableReadNode) {
    const voiceCount = (tableReadNode.data?.voiceCount as number) || characters.length || 2;
    contributions.push({
      id: tableReadNode.id,
      type: "tableRead",
      label: "Speech & Table Read",
      summary: `${voiceCount} voices calibrated · Rehearsal ready`,
      badgeColor: "border-cyan-500/40 bg-cyan-500/10 text-cyan-300",
    });
  }

  // 9. Actor Legacy Comp Routing (Dream Casting Likeness)
  const actorNodes = connectedNodes.filter((n) => n.type === "actor");
  const wiredActorMap = new Map<string, { actorName: string; roleReference: string; vocalWeight: string }>();

  for (const actorNode of actorNodes) {
    const actorData = actorNode.data as { actorName?: string; roleReference?: string; vocalWeight?: string };
    if (!actorData?.actorName) continue;

    // Check which node this actor node is wired into
    const outgoingEdges = edges.filter((e) => e.source === actorNode.id || e.target === actorNode.id);
    for (const edge of outgoingEdges) {
      const otherId = edge.source === actorNode.id ? edge.target : edge.source;
      wiredActorMap.set(otherId, {
        actorName: actorData.actorName,
        roleReference: actorData.roleReference || "",
        vocalWeight: actorData.vocalWeight || "",
      });
    }

    contributions.push({
      id: actorNode.id,
      type: "actor",
      label: `Casting Comp: ${actorData.actorName}`,
      summary: `${actorData.roleReference || "Benchmark"} · ${actorData.vocalWeight || "Tone"}`,
      badgeColor: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
    });
  }

  // 10. Character Dossier & Image Conditioning
  const activeCharacter = focusCharacterName
    ? characters.find((c) => c.name.toLowerCase() === focusCharacterName.toLowerCase()) || null
    : null;

  let conditioningImageUrl: string | null = null;
  let conditioningImageType: "face" | "body" | "scene" | null = null;

  if (activeCharacter) {
    if (imagePreference === "body" && activeCharacter.fullBodyImageUrl) {
      conditioningImageUrl = activeCharacter.fullBodyImageUrl;
      conditioningImageType = "body";
    } else if (imagePreference === "face" && activeCharacter.imageUrl) {
      conditioningImageUrl = activeCharacter.imageUrl;
      conditioningImageType = "face";
    } else if (activeCharacter.imageUrl) {
      conditioningImageUrl = activeCharacter.imageUrl;
      conditioningImageType = "face";
    } else if (activeCharacter.fullBodyImageUrl) {
      conditioningImageUrl = activeCharacter.fullBodyImageUrl;
      conditioningImageType = "body";
    }

    // Resolve effective actor likeness comp from wired Actor node if present
    const charNodeId = `node-core-${activeCharacter.name.toLowerCase()}`;
    const wiredComp =
      wiredActorMap.get(charNodeId) ||
      (actorNodes.length > 0
        ? (actorNodes[0].data as { actorName?: string; roleReference?: string; vocalWeight?: string })
        : null);

    const effectiveComp = wiredComp?.actorName
      ? `${wiredComp.actorName} (in the style of ${wiredComp.roleReference || "signature role"}, ${wiredComp.vocalWeight || "intense"} vocal delivery)`
      : activeCharacter.actorComp;

    // Add character node contribution
    contributions.push({
      id: charNodeId,
      type: "characterCore",
      label: `Cast: ${activeCharacter.name}`,
      summary: `${effectiveComp ? `Comp: ${effectiveComp} · ` : ""}${activeCharacter.role || activeCharacter.archetype}`,
      badgeColor: "border-purple-500/40 bg-purple-500/10 text-purple-300",
    });

    // Check for actor comp or quirks node
    const quirkNode = connectedNodes.find((n) => n.id === `node-quirks-${activeCharacter.name.toLowerCase()}`);
    if (quirkNode) {
      contributions.push({
        id: quirkNode.id,
        type: "quirks",
        label: `${activeCharacter.name} Quirks`,
        summary: ((quirkNode.data?.tics as string[]) || []).join(", ").slice(0, 45) || "Micro-behaviors",
        badgeColor: "border-indigo-500/40 bg-indigo-500/10 text-indigo-300",
      });
    }
  } else if (characters.length > 0) {
    // Master scene includes main characters with wired actor comps
    characters.slice(0, 3).forEach((c) => {
      const cNodeId = `node-core-${c.name.toLowerCase()}`;
      const cWiredComp = wiredActorMap.get(cNodeId);
      const cComp = cWiredComp?.actorName
        ? `${cWiredComp.actorName} (${cWiredComp.roleReference})`
        : c.actorComp;

      contributions.push({
        id: cNodeId,
        type: "characterCore",
        label: `Ensemble: ${c.name}`,
        summary: cComp ? `Like ${cComp}` : c.archetype,
        badgeColor: "border-purple-500/40 bg-purple-500/10 text-purple-300",
      });
    });
  }

  // BUILD THE MASTER PROMPT
  let promptBody = "";

  if (activeCharacter) {
    // ------------------- CHARACTER-FOCUSED TAKE -------------------
    const charNodeId = `node-core-${activeCharacter.name.toLowerCase()}`;
    const wiredComp =
      wiredActorMap.get(charNodeId) ||
      (actorNodes.length > 0
        ? (actorNodes[0].data as { actorName?: string; roleReference?: string; vocalWeight?: string })
        : null);

    // For video/Imagen prompts, do NOT inject real actor names directly as they trip Responsible-AI
    // filters on real-person generation. Instead, synthesize dramatic facial presence and tone.
    const likenessComp = activeCharacter.archetype
      ? `facial presence embodying a ${activeCharacter.archetype.toLowerCase()}, sharp cinematic bone structure, intense focused gaze`
      : "sharp cinematic facial features, intense focused gaze";
    const wardrobeDetail = activeCharacter.wardrobe
      ? `wearing ${activeCharacter.wardrobe}`
      : "in costume consistent with their role";
    const visualDesc = activeCharacter.visualDescription
      ? activeCharacter.visualDescription.trim()
      : `${activeCharacter.archetype}, intense and dramatically lit facial presence`;
    const tics = activeCharacter.quirks && activeCharacter.quirks.length > 0
      ? `Distinctive physical mannerisms: ${activeCharacter.quirks.slice(0, 2).join("; ")}.`
      : "";
    const objective = activeCharacter.objective
      ? `Their expression and body language should read as: ${activeCharacter.objective}.`
      : "";

    promptBody = [
      `Cinematic 16:9 film still, ${slugline}.`,
      `Single subject in frame: ${activeCharacter.name} (${likenessComp}), ${wardrobeDetail}.`,
      visualDesc,
      tics,
      objective,
      floorplanBlocking ? `Camera blocking & staging: ${floorplanBlocking}.` : "",
      scriptBeat ? `Captured mid-beat: ${scriptBeat}.` : "",
      `Lighting: ${lightingStudy}. Color grade: ${colorPalette.slice(0, 3).join(", ")}.`,
      pacingPrompt ? `Dramatic pacing: ${pacingPrompt}.` : (peakTension ? `Dramatic intensity: ${peakTension}/100.` : ""),
      `Shot: ${storyboardFraming}, ${cameraMotion}.`,
      `Style: ${stylePreset}, shallow depth of field, photoreal skin and fabric detail, no text or watermarks.`,
    ].filter(Boolean).join(" ");
  } else {
    // ------------------- MASTER ENSEMBLE SCENE TAKE -------------------
    const castDescriptions = characters.slice(0, 2).map((c) => {
      const clothes = c.wardrobe ? `, in ${c.wardrobe}` : "";
      const persona = c.archetype ? ` (${c.archetype})` : "";
      return `${c.name}${persona}${clothes}`;
    }).join(" and ");

    const conflict = chemistryScenario || sceneStakes || "high tension standoff";

    promptBody = [
      `Master cinematic 16:9 widescreen film still, ${slugline}.`,
      `${sceneTitle}, a ${genre} scene.`,
      castDescriptions ? `In frame: ${castDescriptions}, positioned in physical confrontation with each other.` : "",
      `Central conflict driving the moment: ${conflict}.`,
      floorplanBlocking ? `Spatial blocking & camera setup: ${floorplanBlocking}.` : "",
      scriptBeat ? `Action beat being depicted: ${scriptBeat}.` : "",
      storyboardPrompt ? `Framing direction: ${storyboardPrompt}.` : "",
      `Lighting: ${lightingStudy}. Pacing/mood: ${pacingStyle}. Color grade: ${colorPalette.slice(0, 4).join(", ")}.`,
      pacingPrompt ? `Dramatic pacing: ${pacingPrompt}.` : (peakTension ? `Dramatic intensity: ${peakTension}/100, reflected in blocking and expressions.` : ""),
      `Shot: ${storyboardFraming}, ${cameraMotion}.`,
      `Style: ${stylePreset}, photoreal depth, volumetric atmosphere, no text or watermarks.`,
    ].filter(Boolean).join(" ");
  }

  const cleanPrompt = promptBody.replace(/\s+/g, " ").trim();

  return {
    fullPrompt: cleanPrompt,
    summary: activeCharacter
      ? `Character take: ${activeCharacter.name} (${activeCharacter.actorComp || activeCharacter.archetype})`
      : `Master Scene Take: ${slugline} (${characters.length} characters in collision)`,
    conditioningImageUrl,
    conditioningImageType,
    activeCharacter,
    contributions,
  };
}
