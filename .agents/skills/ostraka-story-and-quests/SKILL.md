---
name: ostraka-story-and-quests
description: >-
  Governs Pillar 4 AI Story Generation, emergent quest arcs, WhatELSE narrative beats, and Gemini lore synthesis.
  Use when developing, debugging, or authoring AI Director blueprints, dynamic quest chains, NPC narrative dialogue,
  free-speech intent parsing, or chronicler event logging in sim_events.
---

# Ostraka Story & Quest Generation Skill

This skill governs Pillar 4 of the architecture: the Gemini-powered narrative engine that weaves live simulation state, player actions, and emergent drama into organic quests and dialogue.

## 1. Architectural Scope & Responsibilities
- **Gemini Narrative Arbiter**:
  - Translates free-speech natural language actions into structured B.R.U.T.A.L. GM commands.
  - Generates natural, context-aware NPC dialogue grounded in their authentic personality (`temper`, `instinct`, `motivation`, `childhood_background`).
- **Organic Lore Weaver**:
  - Dynamically synthesizes emergent lore connecting any two entities in Ostraka (e.g. connecting an honest baker's flour shortage to an Otter Mafia contraband cache in the lower sewers).
- **WhatELSE Story Engine**:
  - Contextual story beats based on active environmental tags (`#Warzone`, `#FamineRefugees`, `#CruorbusEclipse`, `#CultistInfiltration`).
  - Prepares narrative hooks waiting inside upcoming sectors ahead of player travel.
- **AI Director & Story Arc Framework (`directorRouter.ts`)**:
  - Endpoints:
    - `GET /api/dm/story/context_payload`: Assembles living simulation state into the AI Director input contract.
    - `POST /api/dm/story/generate_arc`: Generates structured multi-phase story arcs via Gemini with JSON schema validation.
    - `POST /api/dm/story/manifest_beat`: Commits validated narrative mutations to persistent sector arrays.
- **Quest Chain Engine**:
  - `questChainEngine.ts`: Manages multi-stage quest objectives (investigation, retrieval, infiltration, confrontation).
  - Binds quest rewards to authentic economic goods, gold, faction reputation, or rare dragonstone.
- **The Chronicler & Event Logging**:
  - Significant narrative beats, player deeds, and faction events are committed to `sim_events` across 3 tiers: Major, Minor, Background.

## 2. Key Codebase Anchors
- AI Director Router: `simulation-engine/src/api/directorRouter.ts`
- WhatELSE Story Engine: `simulation-engine/src/engine/rpg/WhatElseStoryEngine.ts`
- Quest Chain Engine: `simulation-engine/src/engine/questChainEngine.ts`
- Narrative Reaction: `simulation-engine/src/engine/rpg/narrativeReactionEngine.ts`
- Chronicler Event Logger: `simulation-engine/src/engine/agents/chroniclerAgent.ts`
- Dialogue Streaming API: `simulation-engine/src/api/tellerRouter.ts`
- Database Tables: `sim_events`, `sim_quest_chains`, `sim_lore_codex`

## 3. Mandatory Invariants
1. **Simulation Grounding**: Narrative elements must be backed by live database records. If an NPC mentions a war, famine, or cartel, that state must exist in `sim_burg_economy` or `sim_outlaw_factions`.
2. **Validation Middleware Enforcement**: Any mutation suggested by an AI story blueprint must pass `validateDirectorMutations()`. The AI Director cannot spawn ungrounded physical terrain or overwrite essential structural props.
3. **No Overriding Mechanical Rules**: The story engine provides color, dialogue, and dramatic framing; it does not dictate dice rolls or bypass B.R.U.T.A.L. damage calculations.
4. **Persistent Memory**: Major NPC interactions must append concise memory summaries to the NPC's `memoryNotes` array in the sector record.

## 4. Verification Workflow
When modifying the story or quest layer:
1. Verify context payload generation:
   `curl "http://localhost:3000/api/dm/story/context_payload?cellId=13408&rx=50&ry=50"`
2. Verify story arc blueprint validation using valid sector IDs:
   `curl -X POST http://localhost:3000/api/dm/story/manifest_beat -H "Content-Type: application/json" -d '{"targetSector":{"cellId":13408,"rx":50,"ry":50,"z":0}}'`
3. Check `sim_events` insertion to verify chronicler logging integrity.

