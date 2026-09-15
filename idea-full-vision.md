# Agentic Cinema: Complete Architecture & System Specification

> Original full-vision spec, written before the build was scoped down. The actively-built
> subset is in `idea.md`; this document is kept for reference on features that didn't make the
> initial cut and could be picked back up later.

---

## Part 1: Unified Platform Architecture

### 1. Executive Platform Vision: "The Virtual Backlot"

The platform unites fragmented pre-production tools into an **Agentic Writers' Room & Studio Operating System**. Creators aggregate raw creative inputs—YouTube video essay links, reference films, genre parameters, unformatted voice memos, modular character profiles, and scene concepts—onto an interactive node graph.

Autonomous agents built with **Gemini** and the **Google Cloud Agent Development Kit (ADK)** synthesize these inputs into production-ready cinematic deliverables: full master scripts, character-specific timeline scripts, Imagen 3 storyboards, multi-speaker Gemini TTS table reads, 2D director blocking diagrams, time-gated character interrogations, and regional box-office viability models.

```
 [Inspirations & Ingest]             [Modular Character Lab]
  - YouTube URLs & Timestamps         - Core Identity & Motivations
  - Visual Reference Pinboard         - Actor Persona & Energy
  - Audio Voice Recordings            - Quirks, Flaws & Voice Dials
           \                                     /
            \                                   /
             v                                 v
    +-------------------------------------------------------+
    |               INTERACTIVE REACT FLOW GRAPH            |
    |                                                       |
    |   [Inspiration Node] ----> [Scene Node] <----+        |
    |                                 |            |        |
    |  [Perspective Sharder] <--------+            |        |
    |  (Per-Character Scripts)        v            |        |
    |                          [Master Script]     |        |
    |                          /      |      \     |        |
    +-------------------------/-------|-------\----|--------+
                             /        |        \   |
                            v         v         v  |
    [Imagen 3 Storyboards]  [Gemini TTS Audio]  [Director's Plan]
                            \         |         /
                             v        v        v
                   +------------------------------------+
                   | TIME-GATED CHRONOLOGY & AUDIENCE   |
                   | - Scrubbable Timeline Q&A Engine   |
                   | - ClickHouse Global Heatmap Node   |
                   +------------------------------------+

```

---

### 2. Node-Based Execution Framework

The visual canvas models creative production as an Unreal Engine / Niagara-style Directed Acyclic Graph (DAG):

* **Inspiration & Media Nodes:** Extract color palettes, contrast ratios, and editing pace from timestamped YouTube video links.
* **Modular Character Nodes:** Decouple character identity from swappable traits, psychological dials, and actor performance references.
* **Reasoning & Synthesis Nodes:** Ingest connected character nodes, generate master screenplay scenes, audit genre pacing, and check dramatic tension.
* **Interactive Dialogue & Rehearsal Nodes:** Allow real-time conversational grilling of characters in-browser via text chat or live voice, strictly scoped to a selected timestamp on the production timeline.
* **Generative & Staging Nodes:** Dispatch prompts to Imagen 3 for 16:9 cinematic frames, assign distinct voices (`Puck`, `Fenrir`, `Aoede`, `Zephyr`) for Gemini TTS table reads, and draft 2D multi-cam blocking setups.
* **Reactive Dirty-State Management:** Disconnecting or modifying an upstream node flags dependent downstream nodes as stale, displaying visual diffs before regenerating.

---

### 3. Chronological Perspective Sharding & Time-Gated Memory

* **Multi-Perspective Screenplay Generation:**
* In addition to generating the unified Master Script, the agent shards the story into **Individual Character Scripts**.
* Each character script tracks:
* *Spatial Location:* Where the character is physically located at each timestamp (e.g., *00:42:15 - In the service tunnel beneath the bank*).
* *Knowledge State (Epistemic Horizon):* What the character knows, what they falsely believe, and what they have not yet discovered.
* *Off-Screen Actions:* What the character is actively doing while other scenes occur on-screen.




* **Scrubbable Timeline Controller:**
* A master timeline slider lets the user scrub to any exact scene or minute in the movie (e.g., *Minute 34*).
* Scrubbing dynamically gates the agent's memory window.


* **Time-Gated Hot-Seat Q&A:**
* When interviewing Character A at *Minute 34*, the agent possesses zero knowledge of events occurring at *Minute 35* and beyond.
* *Example User Prompt:* "Do you know who took the keys?"
* *Agent (at Min 34):* "Marcus has them. He showed them to me before we split up." (Even though the audience knows Marcus lost them at Min 28).
* *Agent (at Min 52):* "Marcus betrayed us. The vault was empty when I arrived."



---

### 4. Decoupled Character Lab, Fusion & Live Interrogation

* **Modular Sub-Nodes:** Decouple a character's core identity from behavioral tics, cadence constraints, and specific actor performances (e.g., *Edward Norton in Fight Club* vs. *Primal Fear*).
* **Archetype Fusion:** Blend archetypes with relative weighting (e.g., *70% Hans Landa's polite tension + 30% Kendall Roy's corporate insecurity*).
* **Interactive "Hot Seat" In-Character Chat:**
* Open a direct chat window with any created character.
* The agent adopts their exact personality traits, subtext ratios, vocabulary limits, and moral blind spots.
* Interrogate motives (e.g., *"Why did you hide the gun instead of calling the police?"*), test dialogue authenticity, or explore unscripted backstories.


* **Hot-Swapping:** Swap an upstream trait node or dream actor without discarding locked action beats in downstream scenes.

---

### 5. Location Scouting, Precedents & Visual Concepting

* **Cinematic Precedents Engine:** Identifies classic and modern film precedents sharing identical scene tensions, analyzing historical camera blocking, lens focal lengths, and lighting ratios.
* **Automated Location Manager:** Translates dramatic tone into physical scouting criteria (e.g., industrial shipping terminal, brutalist interiors), assessing natural lighting angles and sound challenges.
* **Visual Concept Keyframes:** Uses Imagen 3 to paint 16:9 photoreal establishing shots and multi-angle camera variations matching the scene's spatial requirements.

---

### 6. Runtime Platform Constraints (superseded — see idea.md Section 2)

* **Core Models & Logic:** Multi-agent workflows orchestrated using Gemini and Google Cloud ADK.
* **Data Plane — ClickHouse:** Connect the official `mcp-clickhouse` server at runtime to run fast analytical SQL queries over historical box office, streaming retention, and regional census data.
* **Web Grounding — Parallel:** Call the Parallel Search API / MCP tool at runtime to ground agent decisions with live web data covering screenplay scripts, equipment rental prices, and film trivia.

---

## Part 2: Feature & Node Catalog

### Category A: Interactive Node Network & Timeline Mechanics

#### 1. Chronological Timeline Scrubber & State-Gater Node

* **Function:** Serves as the master temporal clock for the entire project canvas.
* **Behavior:** Moving the timeline slider broadcasts a `current_timestamp` event across the graph. All connected Character nodes immediately prune their accessible memory vector store to `timestamp <= current_timestamp`, locking out future narrative events.

#### 2. Character Perspective Sharder Node

* **Function:** Ingests the master screenplay and decomposes it into parallel, per-character chronologies.
* **Output:** Generates a dedicated script track for each character containing their internal monologue, physical coordinates, and immediate motivations for every scene they inhabit or influence off-screen.

#### 3. Pacing & Tension Graph Node

* **Function:** Analyzes generated scenes line-by-line to plot a real-time dramatic tension curve.
* **Behavior:** Flags flatlining tension across 40% or more of the scene runtime, prompting specific narrative interventions (e.g., reveal hidden leverage or introduce a physical disruption).

#### 4. Multiverse / Alternate Takes Node

* **Function:** Branches a single Scene Node into three parallel narrative paths on the canvas without overwriting the master draft.
* **Behavior:** Generates three distinct stylistic cuts (e.g., grounded psychological drama, snappy neo-noir, or direct physical confrontation) for side-by-side review.

#### 5. Continuity & World Lore Sentry Node

* **Function:** Operates in the background across all active canvas nodes.
* **Behavior:** Detects contradictions between character backstories and downstream scene actions (e.g., a character running despite an established physical injury).

---

### Category B: Actor, Character & Dialogue Engines

#### 6. Time-Gated "Hot Seat" Character Interrogation Node

* **Function:** Direct conversational interface with any character, strictly constrained by the active timeline timestamp.
* **Behavior:** The agent answers strictly within their character's psychological profile and current knowledge state. Writers use this to test dramatic irony, locate plot holes, and confirm that character decisions feel logical from their immediate perspective.
* **One-Click Script Insertion:** Highlighting any spontaneous line from the chat provides an **"Add to Scene as Dialogue"** button that writes directly into the connected script node.

#### 7. Dream Casting Chemistry Bench

* **Function:** Places two dream-cast actors or reference characters into an impromptu 1-page micro-scene.
* **Behavior:** Tests status dynamics, conversational tempo, and emotional friction in a neutral, high-stakes setting before committing to full scene drafts.

#### 8. Live Rehearsal & Table Read (Bidirectional Audio)

* **Function:** Leverages the Gemini Live API for real-time, spoken improvisation.
* **Behavior:** The writer speaks into their microphone as Character A, while the agent responds verbally in-character as Character B, transcribing spontaneous lines back onto the canvas as notes.

#### 9. Dialogue Subtext & Cadence Tuner

* **Function:** Rewrites dialogue to match distinct character speech profiles.
* **Behavior:** Adjusts vocabulary, sentence length, and irony ratios while preserving original narrative objectives.

---

### Category C: Production Logistics & Staging

#### 10. Top-Down Multi-Cam Director's Floor Plan Node

* **Function:** Converts scene blocking into a 2D architectural diagram.
* **Behavior:** Maps character sightlines, practical light sources, and a 3-camera setup (Wide Master, Over-the-Shoulder, Close-Up), passing lens focal lengths into downstream Imagen 3 calls.

#### 11. Line Producer Budget & Stripboard Node

* **Function:** Converts scene descriptions into production management sheets.
* **Behavior:** Parses extras, stunt requirements, vehicle rentals, and municipal permit costs, querying historical production datasets via ClickHouse or equipment rates via Parallel.

#### 12. Style & Lighting Extraction Node

* **Function:** Ingests YouTube references via multimodal video understanding.
* **Behavior:** Extracts color palettes, contrast ratios, and editing pace into a reusable "Aesthetic Style Bible" applied to visual generation prompts across the project.

---

### Category D: Global Audience Intelligence

#### 13. Territory Viability & World Heatmap Node

* **Function:** Evaluates screenplay appeal across international territories using an interactive choropleth world map.
* **ClickHouse Integration:** Queries millions of historical territory box-office rows, regional streaming retention rates, and genre demographics via ClickHouse MCP.
* **Cultural Sensibility Auditing:** Identifies cultural friction points (e.g., regional idioms, humor translation, censorship thresholds) and suggests actionable changes:
* *Pacing Adjustments:* Adding musical score interludes or heightening personal stakes for theatrical markets.
* *Dialogue Localization:* Replacing region-specific slang with visual action or preparing multilingual audio dubs using Gemini TTS.



---

## Part 3: Target Audience Segmentation

| Audience Segment | Primary Entry Node | Highest-Value Output |
| --- | --- | --- |
| **Indie Filmmakers** | Clip Node + Location Scout Node | Director Floor Plans & Imagen 3 Storyboard Decks |
| **Screenwriters** | Timeline Scrubber + Perspective Sharder | Multi-POV Character Scripts & Time-Gated Interrogation |
| **Commercial & Agency Teams** | YouTube Link Ingestion + Brainstorm Node | Client Pitch Decks & Aesthetic Style Bibles |
| **Film Producers & Distributors** | Script Node + Global Viability Node | ClickHouse Regional Box-Office Heatmap & Risk Audit |

---

## Part 4: Code Implementation — Time-Gated Character State (ADK)

(See `idea.md` Section 5 — this reference implementation carried forward unchanged into the
scoped build.)
