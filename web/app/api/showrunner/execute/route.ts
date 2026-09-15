import { NextRequest, NextResponse } from "next/server";
import type { CitedPrecedent, CommanderExecutionResponse, StudioAction } from "@/lib/studio-actions";
import { getPrecedents, executeShowrunnerDirective } from "@/lib/agent-service";

/**
 * Studio Commander entry point.
 *
 * The Showrunner's system prompt and action catalog live in exactly one place:
 * `agent-service/app/routers/showrunner.py`. This route used to carry a second,
 * hand-maintained copy of that prompt plus a direct Gemini call, and the two
 * drifted — the copy here had four actions the Python prompt never described,
 * so the model could not emit them and their executor code was dead. Do not
 * reintroduce a prompt copy here; the contract is enforced by
 * `agent-service/tests/test_action_catalog_contract.py`.
 *
 * What remains here is the deterministic offline engine used when the sidecar
 * is unreachable or reports a structured-output fallback. It does no language
 * generation — it only pattern-matches explicit directives.
 */

// The query the sidecar actually runs to ground the response (real
// `cinematic_precedents` rows). Surfaced to the UI's ClickHouse inspector.
const CLICKHOUSE_PRECEDENTS_SQL =
  "SELECT genre, trope, historical_reference, tension_level, commercial_territory, audience_retention_pct, precedent_example " +
  "FROM cinematic_precedents ORDER BY audience_retention_pct DESC LIMIT 3";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userPrompt = typeof body?.userPrompt === "string"
      ? body.userPrompt.trim()
      : typeof body?.instruction === "string"
      ? body.instruction.trim()
      : typeof body?.message === "string"
      ? body.message.trim()
      : "";
    const project = body?.project || body?.projectContext || {};
    const history = Array.isArray(body?.history) ? body.history : [];

    if (!userPrompt) {
      return NextResponse.json({ error: "userPrompt or instruction is required" }, { status: 400 });
    }

    // 1. Canonical path: Python agent-service owns the Showrunner prompt and the
    //    Gemini/ADK invocation.
    try {
      const pythonRes = await executeShowrunnerDirective({
        userPrompt,
        projectTitle: project.title,
        logline: project.premise,
        genre: project.genre,
        directorStyle: project.directorStyle,
        screenplayText: project.screenplayText,
        characters: project.characters,
        nodes: project.nodes,
        edges: project.edges,
        history,
        scenes: project.scenes,
        activeSceneId: project.activeSceneId,
        events: project.events,
      });

      // `_fallback: true` means the sidecar could not parse the model's JSON and
      // is returning a canned acknowledgement. Previously that was passed
      // straight through, so a parse failure looked to the Director like a
      // successful no-op. Fall through to the deterministic engine instead.
      if (pythonRes && !pythonRes._fallback && (pythonRes.actions || pythonRes.assistant_message)) {
        return NextResponse.json(pythonRes);
      }
      if (pythonRes?._fallback) {
        console.warn("Showrunner agent reported a structured-output fallback; using local deterministic engine.");
      }
    } catch (agentErr) {
      console.warn("Python agent-service showrunner directive unavailable, using local deterministic engine:", agentErr);
    }

    // 2. Precedent grounding — these are real rows from the sidecar's
    //    ClickHouse `cinematic_precedents` table (hand-authored demo benchmark
    //    rows; see the note in agent-service/app/services/clickhouse_store.py).
    let precedentsCited: CitedPrecedent[] = [];
    try {
      const allPrecedents = await getPrecedents(project.genre || "");
      precedentsCited = allPrecedents.slice(0, 3);
    } catch (precedentErr) {
      console.warn("Commander precedent grounding unavailable:", precedentErr);
    }

    // 3. Deterministic local engine — explicit directive patterns only.
    const localActions: StudioAction[] = [];
    const promptLower = userPrompt.toLowerCase();

    let thought = `Analyzed director intent: "${userPrompt}". `;
    const isGreeting = /^(hi|hello|hey|greetings|howdy|what'?s up|sup)\b/i.test(userPrompt.trim());
    let reply = isGreeting
      ? `Good to have you in the writers' room. We've got the slate for "${project.title || "our film"}" open and ready. How would you like to build out the sequence reel, sharpen the character arcs, or calibrate dramatic tension today?`
      : `I have reviewed your note regarding "${userPrompt}". We have our sequence reel grounded on the current slate—what specific scenes or character beats would you like to explore next?`;

    // Character addition
    const addCharMatch = userPrompt.match(/(?:add|create|introduce)\s+(?:a\s+)?(?:character\s+)?(?:named\s+)?([A-Z][a-zA-Z0-9_-]+)/i);
    if (addCharMatch) {
      const name = addCharMatch[1];
      const role = promptLower.includes("rival") ? "Rival Antagonist" : promptLower.includes("ally") ? "Key Ally" : "Dynamic Specialist";
      const archetype = promptLower.includes("hacker") ? "Cyber Infiltrator" : promptLower.includes("rival") ? "Ruthless Competitor" : "Strategic Operator";

      localActions.push({
        type: "create_character",
        name,
        role,
        archetype,
        confidence: 85,
        verbalPacing: 75,
        subtextRatio: "high",
        objective: `Challenge existing power dynamics as ${role}`,
      });

      // If prompt also mentions wiring/linking
      if (promptLower.includes("wire") || promptLower.includes("connect") || promptLower.includes("link")) {
        const existingChar = project.characters?.[0]?.name || "Elena";
        localActions.push({
          type: "connect_nodes",
          source: `node-actor-${name.toLowerCase()}`,
          target: `node-actor-${existingChar.toLowerCase()}`,
          relationship: promptLower.includes("rival") ? "Rivalry" : "Friction",
        });
      }
      thought += `Created character ${name} with ${archetype} archetype and linked to scene dynamics. `;
      reply = `I have introduced **${name}** as a ${role}, spawned his actor and dial nodes on the canvas, and established his psychological stakes.`;
    }

    // Dial adjustment
    const dialMatch = userPrompt.match(/(?:set|crank|adjust|change)\s+([a-zA-Z]+)(?:'s)?\s+(confidence|pacing|subtext)\s+(?:to\s+)?(\d+)/i);
    if (dialMatch) {
      const charName = dialMatch[1];
      const val = parseInt(dialMatch[3], 10);
      const patch: any = {};
      if (dialMatch[2].toLowerCase().includes("confid")) patch.confidence = val;
      if (dialMatch[2].toLowerCase().includes("pacing")) patch.verbalPacing = val;
      if (dialMatch[2].toLowerCase().includes("subtext")) patch.subtextRatio = val > 75 ? "very high" : "high";

      localActions.push({
        type: "update_character",
        name: charName,
        patch,
      });
      thought += `Adjusted ${charName}'s ${dialMatch[2]} dial to ${val}%. `;
      reply = `Adjusted **${charName}'s** performance dials to ${val}%.`;
    }

    // Tidy backlot
    if (promptLower.includes("tidy") || promptLower.includes("align") || promptLower.includes("organize") || promptLower.includes("clean")) {
      localActions.push({ type: "auto_tidy_backlot" });
      thought += `Realigned canvas nodes into production workflow lanes. `;
      if (localActions.length === 1) {
        reply = `Reorganized the backlot canvas into aligned Hollywood production workflow columns.`;
      }
    }

    // Unlinking / Severing
    const unlinkMatch = userPrompt.match(/(?:unlink|sever|disconnect)\s+(?:between\s+)?([A-Za-z0-9_-]+)\s+(?:and|to|from)\s+([A-Za-z0-9_-]+)/i);
    if (unlinkMatch) {
      localActions.push({
        type: "sever_wire",
        source: unlinkMatch[1],
        target: unlinkMatch[2],
      });
      thought += `Severed wire between ${unlinkMatch[1]} and ${unlinkMatch[2]}. `;
      reply = `Severed the connection between **${unlinkMatch[1]}** and **${unlinkMatch[2]}**.`;
    }

    // Direct screenplay rewrite or beat injection
    if (promptLower.includes("rewrite") || promptLower.includes("add twist") || promptLower.includes("script")) {
      const currentText = project.screenplayText || "";
      const injectedBeat = `\n\nEXT. SERVICE SHAFT - SUDDEN BLACKOUT\n\nThe power cuts out abruptly. Volumetric red emergency strobes pulse against the steel grates.\n\nELENA\n(whispering with sharp subtext)\nSomeone just cut the main grid. We have sixty seconds.\n`;
      localActions.push({
        type: "update_screenplay",
        screenplayText: currentText + injectedBeat,
        summary: "Injected sudden power failure crisis beat into master draft",
      });
      thought += `Injected high-tension narrative beat into master screenplay draft. `;
      reply = `Rewrote the climax of the current scene to incorporate a high-stakes blackout twist.`;
    }

    // Replace scene
    const replaceSceneMatch = userPrompt.match(/(?:replace)\s+(?:scene\s+)?(\d+|[a-zA-Z0-9_-]+)\s+(?:with\s+)?(.+)/i);
    if (replaceSceneMatch) {
      const sceneId = replaceSceneMatch[1];
      const desc = replaceSceneMatch[2].trim();
      localActions.push({
        type: "replace_scene",
        sceneIdentifier: !isNaN(parseInt(sceneId, 10)) ? parseInt(sceneId, 10) : sceneId,
        replacement: {
          title: desc.length > 30 ? desc.slice(0, 30) + "..." : desc,
          summary: desc,
          slugline: `INT/EXT. ${desc.toUpperCase().slice(0, 20)} - NIGHT`,
          screenplayText: `INT/EXT. LOCATION - NIGHT\n\n[Action: ${desc}]\n\nCHARACTER\n(determined)\nWe move now.`,
        },
      });
      thought += `Replaced scene ${sceneId} with "${desc}". `;
      reply = `Replaced Scene ${sceneId} with the new dramatic beat: "${desc}".`;
    }

    // Delete scene
    const deleteSceneMatch = userPrompt.match(/(?:delete|remove)\s+scene\s+(\d+|[a-zA-Z0-9_-]+)/i);
    if (deleteSceneMatch && !replaceSceneMatch) {
      const sceneId = deleteSceneMatch[1];
      localActions.push({
        type: "delete_scene",
        sceneIdentifier: !isNaN(parseInt(sceneId, 10)) ? parseInt(sceneId, 10) : sceneId,
      });
      thought += `Deleted scene ${sceneId}. `;
      reply = `Deleted Scene ${sceneId} from the sequence reel.`;
    }

    // Replace character
    const replaceCharMatch = userPrompt.match(/(?:replace)\s+(?:character\s+)?([A-Za-z0-9_-]+)\s+with\s+([A-Za-z0-9_-]+)/i);
    if (replaceCharMatch) {
      const oldName = replaceCharMatch[1];
      const newName = replaceCharMatch[2];
      localActions.push({
        type: "replace_character",
        name: oldName,
        replacement: {
          name: newName,
          role: "Dynamic Specialist",
          archetype: "Strategic Operator",
          confidence: 80,
          verbalPacing: 70,
        },
      });
      thought += `Replaced character "${oldName}" with "${newName}". `;
      reply = `Replaced character **${oldName}** with **${newName}** and updated backlot nodes.`;
    }

    // Delete character
    const deleteCharMatch = userPrompt.match(/(?:delete|remove)\s+(?:character\s+)?([A-Za-z0-9_-]+)/i);
    if (deleteCharMatch && !promptLower.includes("scene") && !replaceCharMatch) {
      const charName = deleteCharMatch[1];
      localActions.push({
        type: "delete_character",
        name: charName,
      });
      thought += `Removed character "${charName}". `;
      reply = `Removed character **${charName}** and cleared associated backlot nodes.`;
    }

    // Project metadata changes
    const titleMatch = userPrompt.match(/(?:change|set|update)\s+(?:project\s+|film\s+|movie\s+)?title\s+to\s+["']?([^"'\n.]+)["']?/i);
    const genreMatch = userPrompt.match(/(?:change|set|update)\s+(?:project\s+|film\s+|movie\s+)?genre\s+to\s+["']?([^"'\n.]+)["']?/i);
    if (titleMatch || genreMatch) {
      const metaPatch: any = {};
      if (titleMatch) metaPatch.title = titleMatch[1].trim();
      if (genreMatch) metaPatch.genre = genreMatch[1].trim();
      localActions.push({
        type: "update_project_meta",
        patch: metaPatch,
      });
      thought += `Updated project metadata. `;
      reply = `Updated project configuration${metaPatch.title ? ` (Title: "${metaPatch.title}")` : ""}${metaPatch.genre ? ` (Genre: "${metaPatch.genre}")` : ""}.`;
    }

    // Lyria 3 score take command
    if (promptLower.includes("score") || promptLower.includes("music") || promptLower.includes("soundtrack") || promptLower.includes("lyria")) {
      const sceneNumMatch = userPrompt.match(/(?:scene\s+)(\d+)/i);
      const sceneNum = sceneNumMatch ? parseInt(sceneNumMatch[1], 10) : undefined;
      const isPro = promptLower.includes("pro") || promptLower.includes("60") || promptLower.includes("full");
      localActions.push({
        type: "create_score_take",
        sceneIdentifier: sceneNum,
        title: `Lyria 3 Cinematic Score Cue`,
        prompt: `High-tension orchestral strings and sub-bass pulse tailored for dramatic cinema`,
        durationSec: isPro ? 60 : 30,
        model: isPro ? "Lyria 3 Pro" : "Lyria 3 Clip",
        scoreType: promptLower.includes("vocal") ? "vocal" : promptLower.includes("source") ? "source" : "score",
        dynamicArc: "Slow-burn escalation to peak climax",
        instruments: ["Cinematic Strings", "Synthesizer", "Sub-Bass"],
      });
      thought += `Generated Lyria 3 score cue take${sceneNum ? ` for Scene ${sceneNum}` : ""}. `;
      reply = `Composed and attached a new **${isPro ? "Lyria 3 Pro (60s)" : "Lyria 3 Clip (30s)"}** cinematic score take with dynamic arc and orchestral instruments.`;
    }

    // Timeline image generation command
    if (promptLower.includes("timeline") || (promptLower.includes("frame") && promptLower.includes("at")) || promptLower.includes("still")) {
      const timeMatch = userPrompt.match(/(\d+)\s*(?:s|sec|seconds)?/i);
      const timeSec = timeMatch ? parseInt(timeMatch[1], 10) : 30;
      const sceneNumMatch = userPrompt.match(/(?:scene\s+)(\d+)/i);
      const sceneNum = sceneNumMatch ? parseInt(sceneNumMatch[1], 10) : undefined;
      localActions.push({
        type: "generate_timeline_moment",
        sceneIdentifier: sceneNum || 1,
        timestampSec: timeSec,
        prompt: `Cinematic anamorphic widescreen film still captured at ${timeSec}s: high atmospheric tension, volumetric lighting`,
        stylePreset: "anamorphic_35mm",
        cameraFraming: "wide_master",
      });
      thought += `Staged timeline keyframe moment at ${timeSec}s. `;
      reply = `Generated and staged a 35mm anamorphic timeline still at **${timeSec}s** on the sequence reel.`;
    }

    // Asset attachment command
    if (promptLower.includes("attach") || promptLower.includes("link asset") || promptLower.includes("use asset")) {
      const isChar = promptLower.includes("character") || promptLower.includes("marcus") || promptLower.includes("elena");
      localActions.push({
        type: "attach_asset",
        assetName: promptLower.includes("vault") ? "Sub-Level Concrete Vault" : promptLower.includes("pier") ? "Rain-Slicked Pier Docks" : "Marcus — Chiaroscuro",
        targetType: isChar ? "character" : "scene",
        targetIdentifier: isChar ? (promptLower.includes("elena") ? "Elena" : "Marcus") : 1,
        role: isChar ? "face" : "plate",
      });
      thought += `Linked asset to ${isChar ? "character" : "scene"}. `;
      reply = `Attached reference plate asset from Asset Hub to ${isChar ? "character profile" : "Scene 1 visual board"}.`;
    }

    // View switching command
    if (promptLower.includes("open") || promptLower.includes("switch") || promptLower.includes("go to") || promptLower.includes("show")) {
      if (promptLower.includes("score") || promptLower.includes("music") || promptLower.includes("audio")) {
        localActions.push({ type: "switch_view", tab: "simulation", subview: "score" });
        thought += `Navigated to score studio. `;
        reply = `Switched workspace to the **Lyria 3 Music Score Studio**.`;
      } else if (promptLower.includes("timeline")) {
        localActions.push({ type: "switch_view", tab: "generation", subview: "timeline" });
        thought += `Navigated to timeline canvas. `;
        reply = `Switched workspace to the **Scene Timeline Canvas**.`;
      } else if (promptLower.includes("asset")) {
        localActions.push({ type: "switch_view", tab: "planning", subview: "assets" });
        thought += `Navigated to asset hub. `;
        reply = `Switched workspace to the **Studio Asset Hub**.`;
      }
    }

    const fallbackResponse: CommanderExecutionResponse = {
      thought_process: thought,
      assistant_message: reply,
      actions: localActions,
      precedents_cited: precedentsCited,
      clickhouse_query_sql: precedentsCited.length ? CLICKHOUSE_PRECEDENTS_SQL : undefined,
      _fallback: true,
    };

    return NextResponse.json(fallbackResponse);
  } catch (err) {
    console.error("Studio Commander execution error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Commander execution failed" },
      { status: 500 }
    );
  }
}
