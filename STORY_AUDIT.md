# Story audit: how story is handled, and completed milestones

**Original audit:** 2026-11-09 · **Updated:** 2026-11-24 · **Read with:** `AGENT_RULES.md` (the loop: tick → thread → hook → players act → B.R.U.T.A.L. resolves → consequences → tick)

## Current architecture (unified thread loop)

All paths are under `simulation-engine/src/`:

| # | System | Files | Status | Trigger |
|---|---|---|---|---|
| 1 | **Background reactions & autonomous drama** | `engine/agents/backgroundDirector.ts`, `engine/agents/autonomousDramaAgent.ts`, `engine/rpg/narrativeReactionEngine.ts` (17 rules), `engine/rpg/narrativeTagEngine.ts` | **Running** | Every tick, from `masterOrchestrator.ts` |
| 2 | **Thread engine & sector hooks** | `engine/threads/threadEngine.ts`, `engine/rpg/WhatElseStoryEngine.ts`, `engine/rpg/BrutalGM.ts` (B.R.U.T.A.L. Draft v5.0) | **Running** | Ticked daily (`advanceThreadClocks`); hooks generated/persisted in `sim_threads` & `getActiveBeat`/`setActiveBeat` |
| 3 | **Director arcs & Rule 7 guard** | `engine/rpg/directorBridge.ts`, `api/directorRouter.ts` (`/api/dm/story/*`), `engine/llm.ts` (local Ollama only) | **Running** | `POST /api/dm/story/generate_arc` & tactical sector loads; persisted into `sim_threads` |
| 4 | **Consequence write-back** | `engine/questChainEngine.ts` (`resolveThreadByParty`), `engine/rpg/BrutalGM.ts`, `api/dmRouter.ts` | **Running** | Whenever party action, dialogue, or tick clock resolves a thread |

*Historical removals (Rule 10):* unimported story modules (`eventDirector`, `eventGenerator`, `loreEngine`, `loreFusion`) deleted `803fcdb` (2026-11-11); fixed 5-act `ACTS` list deleted `81fcab3`; legacy compatibility stubs (`getCampaignState`, `restoreCampaignState`, `updateObjective`) deleted `d153824`.

### How the pieces work together now

1. **Background reactions & autonomous drama**: Each tick, cached sectors run against the **17-rule** `NarrativeReactionTable` (up from the original 5) plus `autonomousDramaAgent.ts`, which resolves citizen/paragon collisions against their wants, flaws, and lines they won't cross, with cross-tick grudge memory and multi-actor clashes (`fe4c294`, `e2b6962`). Major collisions open persistent rows in `sim_threads` anchored strictly to verified database actors (`actor_ids`).
2. **Unified threads & hooks (`WhatElseStoryEngine.ts`, `directorBridge.ts`)**: `BrutalGM.loadSector()` and `directorBridge` read live `sim_threads` (`getOpenThreads`) and active beats (`getActiveBeat` / `setActiveBeat`) instead of fixed acts or map-coordinate seeds. Local Ollama (`engine/llm.ts`) supplies sensory prose and structured JSON intent parsing; `validateDirectorMutations` (Rule 7 guard) rejects any invented IDs not present in the sector/database.
3. **B.R.U.T.A.L. Draft v5.0 resolution (`BrutalGM.ts`, `RulesEngine.ts`, `combatResolutionEngine.ts`)**: Player intent is resolved deterministically with opposed `1d12 + Stat` vs Guard/Active Defense, Clash stances, foe cards/Resolve, owed energy, and persuasion rules per `RULES_TARGET_v5.0.md` (verified against rulebook §5.0 in `5dc5e3c`).
4. **Consequence write-back (`questChainEngine.ts`)**: Resolving or expiring a thread applies concrete world deltas (`on_resolved_by_party` / `on_expire` across food, unrest, wealth, custody, and actor tags) and logs historical outcomes to `sim_events`.

## Loop scorecard

| Loop step | Original (2026-11-09) | Current (2026-11-24) |
|---|---|---|
| tick | ✅ runs | ✅ runs (`masterOrchestrator.ts`, deterministic seeded replay via `rng.ts`) |
| **thread** | ❌ no lasting threads | ✅ `sim_threads` persists open/escalated/resolved/expired threads, clocks, and verified actors |
| **hook reaches the party** | ⚠️ split beats & arcs | ✅ beats and director arcs present live `sim_threads` hooks with Rule 7 entity validation |
| **players act → B.R.U.T.A.L. resolves** | ⚠️ porting mechanics | ✅ B.R.U.T.A.L. Draft v5.0 (`BrutalGM.ts`, `foeStack.ts`, `combatResolutionEngine.ts`, local Ollama narration/parsing) |
| **consequences written back** | ❌ logs only | ✅ `questChainEngine.resolveThreadByParty` + `advanceThreadClocks` mutate DB world state & `sim_events` |

## The plan (Steps 1–7 status)

1. ~~**Add one `sim_threads` table**~~ with real `actor_ids`, `clock`/`clock_max`, `state`, and actor existence test (`testThreadActors`). — **DONE (`8339947`)**
2. ~~**Open threads from collisions**~~ when reaction rules fire (`testThreadReactions`, rule-specific world deltas). — **DONE (`4a10aa3`, `780393f`)**
3. ~~**Tick the threads**~~ daily in `masterOrchestrator.ts` and resolve expired clocks into world deltas & rumors (`testThreadClocks`). — **DONE (`22973e3`, `fe4c294`)**
4. ~~**Merge systems 2 and 3 into threads**~~ (`WhatElseStoryEngine.ts`, `directorBridge.ts`, `directorRouter.ts`), keep Rule 7 validation, and retire fixed `ACTS`, coordinate seeding, and legacy stubs (`testStoryPipeline`). — **DONE (`6a9bbc5`, `2f74b99`, `81fcab3`, `d153824`)**
5. ~~**Connect `questChainEngine`**~~ so party thread resolution writes consequences back and passes end-to-end (`testQuestChainResolution`, `testVerticalSlice`). — **DONE (`8e5b150`, `a0a7207`, `d9a5d23`)**
6. ~~**Give paragons (and citizens) wants**~~ — deterministic want, flaw, and line checked during collisions (`testAutonomousDrama`). — **DONE (`4498fd7`, `40a50b1`)**
7. ~~**Grow the reaction table**~~ beyond 5 rules — expanded to **17 reaction rules** plus cascading aftermaths and multi-actor drama (`911560a`, `fe4c294`, `e2b6962`).

## Still open / where the rest lives

- **B.R.U.T.A.L. Draft v5.0 engine parity:** Completed — see `RULES_TARGET_v5.0.md` (marked done in `5dc5e3c`).
- **Remaining parked story designs:** Multi-hop rumor drift (`sim_rumors`), pacing director tension governor, and automated multi-session story measurement remain parked designs in `STORY_IDEAS.md`.
- **System-wide backlog & Phase B datasets:** See `PARKING_LOT.md` for global-sim datasets (route closures, faction finances, civic flags, rivers/climate, culture/religion) and parked UI/audio items.
