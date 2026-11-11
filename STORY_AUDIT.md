# Story audit: how story is handled now, and the plan

**Date:** 2026-11-09 · **Read with:** `AGENT_RULES.md` (the loop: tick → thread → hook → players act → B.R.U.T.A.L. resolves → consequences → tick)

## What exists today: four separate systems

| # | System | Files | Status | Trigger |
|---|---|---|---|---|
| 1 | **Background reactions** | `engine/agents/backgroundDirector.ts`, `engine/rpg/narrativeReactionEngine.ts`, `engine/rpg/narrativeTagEngine.ts` | **Running** | Every tick, from `masterOrchestrator.ts` |
| 2 | **Sector story beats** | `engine/rpg/WhatElseStoryEngine.ts`, `engine/rpg/BrutalGM.ts` (ported from ConcordiaGM) | **Running** | Whenever the GM loads a sector |
| 3 | **Director arcs** | `engine/rpg/directorBridge.ts`, `api/directorRouter.ts` (`/api/dm/story/*`) | **Built, barely used** | Only a button in `observer/TacticalSandboxModal.tsx` |
| 4 | **Unconnected code** | `engine/questChainEngine.ts` (now wired, step 5); `eventDirector`, `eventGenerator`, `loreEngine`, `loreFusion` deleted 2026-11-11 | ~~Dead~~ | — |

(All paths are under `simulation-engine/src/`.)

### 1. Background reactions
- Each tick, every cached sector in `sim_sector_layers` is checked against `NarrativeReactionTable`. When an NPC's tags meet a world condition, the rule fires. For example, a smith tagged `#RebelInformant` under `#MartialLaw` is imprisoned, and the forge nearby is chained shut.
- MAJOR results go to `sim_events`, which are served as tavern rumors by `/teller/rumors`.
- **Problem:** there are only **5 rules**, so the world has very few ways to react.

### 2. Sector story beats
- `ConcordiaGM.loadSector()` calls `generateBeatFromSector()`, a beat built from the biome, the burg, chaos and road masks. An LLM ("Master Story Director" prompt; Gemini, with Ollama llama3.2 as fallback) then adds props and NPCs.
- Campaign state is a fixed `ACTS` list, plus the act index, the active beat and the completed beats.
- **Problems:**
  - The beat is seeded from map coordinates (`cellId`, `rx`, `ry`), so the same place produces the same story on every visit.
  - The campaign state persists only if the client sends `storyState` back (`dmRouter.ts`, around line 546).

### 3. Director arcs
- `POST /api/dm/story/generate_arc`:
  1. builds a payload from real sector state;
  2. has Gemini return a JSON arc (with a procedural fallback: famine, boom or default template, two beats);
  3. checks every target ID against the real sector assets, dropping invented ones;
  4. writes tags and dialogue onto those NPCs and props;
  5. logs to `sim_events`.
- **Problems:**
  - The arc itself is never stored. `manifest_beat` needs the caller to send the blueprint back.
  - It defaults to `cellId 17363` and player 1.
  - It knows nothing about the campaign in system 2.
- **Keep:** the validation guard (`validateDirectorMutations`) is exactly right. It's rule 7 in code.

### 4. Unconnected code
- `questChainEngine.resolveQuestAndMutateWorld()` is the piece that writes a quest's outcome back into the world. That's the last step of the loop, and it isn't connected.
- The others (`eventDirector`, `eventGenerator`, `loreEngine`, `loreFusion`) were imported nowhere. **Deleted 2026-11-11** (rule 10).

## The gaps, against the loop

| Loop step | Today |
|---|---|
| tick | ✅ runs |
| **thread** | ❌ **There are no lasting threads.** Nothing holds an open story that ticks forward and resolves whether or not players engage. |
| hook reaches the party | ⚠️ There are two competing hook makers (beats and arcs), and neither knows about the other. |
| players act → B.R.U.T.A.L. resolves | ⚠️ That's the GM engine (Concordia stats; it's being ported to B.R.U.T.A.L.). |
| **consequences written back** | ❌ Only as `sim_events` log lines. `questChainEngine` isn't connected. |

**Underlying issue:** stories come from **places**, not **people**. The 714 paragons carry tags but no wants, so nobody drives events.

## The plan (do in order, one task per session)

1. **Add one `sim_threads` table.** Every story is a row with:
   - `id`;
   - `question` (e.g. "Will the bread riot topple the reeve?");
   - `stakes`;
   - `actor_ids` (real IDs only);
   - `cell_id`, `rx`, `ry`;
   - `clock` and `clock_max`;
   - `state` (open, escalated or resolved);
   - `origin` (reaction, beat or arc);
   - `created_tick` and `resolved_tick`.
   
   Add a test that every `actor_id` exists.
2. **Open threads from collisions.** When a reaction rule fires above a drama threshold, open a thread instead of only logging an event.
3. **Tick the threads.** Each tick, advance every open thread's clock. At `clock_max` it resolves on its own, with the outcome written to the world and to `sim_events` as a rumor.
4. **Merge systems 2 and 3 into threads.** Sector beats and director arcs become ways to *present* a thread as a hook, not separate stories. Keep the validation guard. Retire the fixed `ACTS` list and coordinate seeding.
5. **Connect `questChainEngine`.** When players resolve a thread, it writes the consequences back. That closes the loop.
6. **Give paragons wants.** Each gets a want, a flaw and a line they won't cross. Reaction rules check wants, so collisions create choices, not just reactions.
7. **Grow the reaction table** beyond 5 rules. Each new rule gets a test.

**Vertical slice first:** do steps 1–5 for **one burg and one thread**, and play it with the Ollama player agents before scaling.

## Out of scope for now (parking lot)
- Rumor drift, the pacing director, paragon wants (in full) and agent-player measurement: designs in `STORY_IDEAS.md`.
