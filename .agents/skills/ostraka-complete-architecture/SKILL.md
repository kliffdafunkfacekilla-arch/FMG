---
name: ostraka-complete-architecture
description: Master architectural roadmap, file-by-file dependency graph, database schema reference, and operational rules governing Pillars 1, 3, and 4 (Simulation Engine, B.R.U.T.A.L. GM Mechanics, and AI Story/Narration Director). Use on EVERY task involving simulation logic, rule arbitration, data flows, or event narrations.
---

# OSTRAKA COMPLETE ARCHITECTURE & MASTER SYSTEM ROADMAP

This skill serves as the permanent architectural roadmap and file-by-file connection map across all subsystems of the Ostraka Simulation Engine, B.R.U.T.A.L. GM Rules Engine, and AI Story Generator.

Refer to the master document: [OSTRAKA_SYSTEM_ROADMAP.md](file:///c:/Users/krazy/Desktop/FMG/OSTRAKA_SYSTEM_ROADMAP.md)

---

## 1. THE 4 PILLARS & ARCHITECTURAL BOUNDARIES

1. **Pillar 1: The Simulation Engine (`simulation-engine/`)**:
   - Master Tick: **1 Tick = 1 In-Game Day** executed sequentially by `masterOrchestrator.ts`.
   - Single Centralized Source of Truth: PostgreSQL (`postgres://postgres@localhost:5432/postgres`).
   - 352 Burg Economies, 207k Living Demographics in strict 12:1 ratio (`unit_size = 12`).
   - 10 Criminal Syndicates & Outlaw Cartels, Subterranean Vice Dens (`sim_fringe_lairs`).
   - 12 Primordial Chaos Flows (`sim_chaos_flows`) and 12 Self-Sustaining Dragon Prisons (`sim_sacred_groves`).
   - 72 Grey Wardens (including 12 Eyeless Crypt Elders in the under-spire tomb) and 288 Void Cultists.

2. **Pillar 2: The Player Interface (Observer Dashboard, `simulation-engine/src/observer/`)**: the standalone `player-client/` is parked (see PARKING_LOT.md).
   - Port 5173. Pure read-only visual projection. Never hallucinate fake map data unbacked by simulation ground-truth.

3. **Pillar 3: Independent B.R.U.T.A.L. GM Rules Engine (`simulation-engine/src/engine/rpg/`)**:
   - Deterministic mechanical engine: `BrutalGM.ts`, `RulesEngine.ts`, `TagMatrixEngine.ts`, `combatEngine.ts`.
   - 12 Attributes: Might, Endurance, Finesse, Reflex, Vitality, Fortitude, Knowledge, Logic, Awareness, Intuition, Charm, Willpower.
   - 4 Derived Pools: Health, Stamina, Composure, Focus.
   - Opposed 1d20 resolution: `Attacker (1d20 + Stat + Mod) vs Defender (1d20 + Stat + Mod)`.
   - Universal Tag Matrix: Physical Triad (Type, Material, Affordances), Citizen Persona/Status Tags, Event Collision Cascades.
   - Zero LLM Hallucinations: All numbers, damages, DC checks, and item degradations are pure TypeScript functions.

4. **Pillar 4: AI Story Generator & Event Narration (`simulation-engine/src/api/directorRouter.ts`)**:
   - Gemini LLM translation: Reads mechanical GM outputs and renders immersive sensory prose.
   - Free-Speech Intent Parser: Translates natural language player intent into structured B.R.U.T.A.L. actions.
   - Emergent Narrative Weaving: Dynamically connects any two entities in the database through simulation history.
   - Chronicler: Logs historical milestones to `sim_events` (CRITICAL, MAJOR, MINOR, BACKGROUND).

---

## 2. THE 3-TIER NESTED FRACTAL HIERARCHY

```
                                      [UPPER LOCAL: Z = +1]
                                      (Ramparts, Parapets, 2nd-Story Lofts, Canopies)
                                             │
[GLOBAL: Macro] ──────► [REGIONAL: Meso] ────► [LOCAL: Surface Z = 0]
 (Continental Realm)     (10,000 Cells)        (Player's Tactical Grid: Objects, NPCs, Props)
                                             │
                                      [LOWER LOCAL: Z = -1]
                                      (Subterranean Cellars, Sewers, Crypts, Vice Dens)
```

1. **Global Layer (Macro LOD)**: ~16,000 Voronoi polygonal cells (`sim_cells`). Simulated continually worldwide in background.
2. **Regional Layer (Meso LOD)**: Overland map of **exactly 10,000 regional cells** ($100 \times 100$ grid: `rx: 0..99, ry: 0..99`, centered at `rx: 50, ry: 50`).
   - **FOCUSED LOD SIMULATION RULE**: Individual agent movements, tactical squad paths, and fine-grained meso updates are **ONLY simulated when the regional map contains the player's location (or an explicitly focused cell)**.
3. **Local Layer (Micro LOD - Tactical Battle Map)**: 256x256 tactical tile grid at the player's regional cell `(rx, ry)`.
4. **Vertical 3-Layer Sandwich**:
   - Upper Local ($Z = +1$): Ramparts, second-story lofts, watchtowers, tree canopies.
   - Surface Local ($Z = 0$): Ground streets, workshops, plazas, docks, clearings.
   - Lower Local ($Z = -1$): Subterranean cellars, sewers, cartel vice dens, crypts.
   - Transitions via interactive stairs, ladders, hatches (`GET /api/dm/sector_layer`).
5. **Border Crossing**:
   - Edge of Local cell $\to$ Adjacent Regional cell `(rx ± 1, ry ± 1)`.
   - Edge of 100x100 Regional map (`rx = 0` or `99`, `ry = 0` or `99`) $\to$ Adjacent Global Cell.

---

## 3. MASTER ORCHESTRATOR 11-STEP TICK FLOW

Every master tick (`executeMasterTick()` in `masterOrchestrator.ts`) wraps an atomic database transaction:
1. `calendarAgent.ts`: Increments tick, computes 541-day cosmic calendar (12 Dragon Months of 44 days + 13-day Shadow Week).
2. `weatherAgent.ts` & `trophicEcologyAgent.ts`: Updates planetary temperature, storms, flora, prey, predator, and blight balances.
3. `chaosFlowAgent.ts`: Updates 12 meandering Chaos Leys, tidal surge cycles, and leyway crossing points.
4. `burgOperationsAgent.ts`: 12:1 worker ratio harvesting raw materials, refining goods, consuming food, and updating unrest.
5. `paragonPlanningAgent.ts`: 714 unique civic, military, and underworld paragons executing trait-based decisions.
6. `factionPlanningAgent.ts`: 19 nations evaluating geopolitical utility AI on monthly bureaucratic turns (`(tick + id*7) % 44 === 0`).
7. `burgExpansionAgent.ts`: Prosperous burgs founding agricultural and mining outposts.
8. `wardenAgent.ts`: 72 Grey Wardens patrolling flow corridors, charging ancient path wards, and flow-seers hunting cults.
9. `cultistAgent.ts`: 288 Shlaar cultists infiltrating burgs and besieging dragon seals. Triggers `WORLD_ENDING_APOCALYPSE` if seal reaches 0%.
10. `mandateAgent.ts`: Chain zealots hunting sparkborn and draining arcana to reinforce containment.
11. `cartelAgent.ts`: 10 criminal syndicates establishing vice dens, drug networks, and Ghostwind phantom airship strikes.
12. `grindCanyonAgent.ts`: Opens and closes dynamic eldritch wilderness chasms with dragonstone digs.
13. `encounterAgent.ts` & `npcRoutineAgent.ts`: Tactical random encounters and diurnal schedules for active NPCs.
14. `backgroundDirector.ts`: Simulates unobserved sector tag collisions and propagates regional aftermaths.
15. `chroniclerAgent.ts`: Records world events to `sim_events`.
16. `The Reaper`: Strips depopulated burgs into ruins, purging empty infrastructure and stockpiles.

---

## 4. UNIVERSAL TAG MATRIX COLLISION ARCHITECTURE

All entities and events interact deterministically via three tag layers:
1. **Physical Entity Triad**:
   - `type:*`: `container`, `portal`, `furniture`, `workstation`, `mechanism`, `structure`, `hazard`, `waterway`, `weapon`, `armor`.
   - `material:*`: `stone`, `iron`, `steel`, `osmium`, `wood_oak`, `wood_pine`, `obsidian`, `dragonstone`, `leather`, `cloth`, `glass`, `flesh`, `water`, `oil`.
   - Affordances/States: `climbable`, `openable`, `lockable`, `locked`, `flammable`, `fragile`, `conductive`, `buoyant`, `sharp`, `blunt`, `piercing`, `corrosive`, `illuminating`, `toxic`, `burning`, `wet`, `frozen`, `corroded`, `void_tainted`, `hallowed`.
2. **Citizen Persona & Status Tags**:
   - Temper: `STOIC`, `GREEDY`, `FANATICAL`, `DESPERATE`, `SCHOLARLY`, `BITTER`, `VENGEFUL`, `COMPASSIONATE`, `DISCIPLINED`, `REBELLIOUS`.
   - Instinct: `WARY`, `CURIOUS`, `AGGRESSIVE`, `FEARFUL`, `DEVOUT`, `STEALTHY`.
   - Dynamic Conditions: `starving`, `exhausted`, `injured`, `panicked`, `drunk`, `corrupted_by_void`, `mourning`, `celebrating`, `sheltered`, `alert`, `imprisoned`, `fugitive`.
3. **Simulated Event Collision Cascades**:
   - World and regional events emit tags (`#MartialLawCurfew`, `#FamineCrisis`, `#FullBloodStorm`, `#CultistWhisper`, `#DragonSurge`).
   - `narrativeReactionEngine.ts` collides event tags with citizen tags deterministically to trigger emergent behavioral cascades (rioting, hiding, praying, price-gouging, reporting heresy) without LLM lag or hallucinations.

---

## 5. REPOSITORY CODE MAP & CORE DEPENDENCIES

| Directory / File | Core Responsibility | Key Exports & Functions |
|---|---|---|
| `src/server.ts` | Express entrypoint (port 3001) | Registers all API routers, CORS, and JSON middleware |
| `src/api/dmRouter.ts` | Player action & sector API | `/sector`, `/act`, `/chat`, `/inventory`, `/sub_map`, `/camp` |
| `src/api/observerRouter.ts` | Live telemetry & simulation API | `/state`, `/sectors`, `/ecology`, `/chaos_flows`, `/autoplay`, `/tick`, `/reset` |
| `src/api/directorRouter.ts` | AI Story Director API | `/blueprint`, `/objectives`, `/emergent_dialogue` |
| `src/engine/masterOrchestrator.ts` | Master simulation tick runner | `executeMasterTick()` |
| `src/engine/rpg/BrutalGM.ts` | Independent mechanical GM | `handlePlayerAction()`, `resolveOpposedCombat()` |
| `src/engine/rpg/RulesEngine.ts` | 12-stat B.R.U.T.A.L. rules | `resolveMeleeAttack()`, `resolveOpposedCombat()` |
| `src/engine/rpg/TagMatrixEngine.ts` | Physical tag cascades | `resolveInteraction()`, `applyEnvironmentalDamage()` |
| `src/engine/rpg/narrativeReactionEngine.ts` | Event collision engine | `processDataCollisions()`, `evaluateSectorReactions()` |
| `src/engine/maps/SectorMapGenerator.ts` | Micro LOD tilemaps | `generateSectorMap()`, `build3TierVerticalStack()` |
| `src/engine/agents/citizenPersonaHelper.ts` | Citizen generator & tagging | `tagBurgCitizens()`, `recruitInsideMan()`, `tagSectorEnvironment()` |
| `src/engine/agents/agentMovementHelper.ts` | Spatial cache & navigation | `initSpatialCache()`, `stepTowardCell()`, `findNearestCell()` |
| `src/db/pool.ts` | PostgreSQL connection pool | `pool.query()` |

---

## 6. CRITICAL BUG CHECKLIST & AUDIT REMINDERS

When inspecting or extending simulation and GM code, always verify:
1. **Never drop player tables during world reset**: `resetWorld.ts` must truncate simulation tables only; never wipe `sim_player_character`, `sim_game_saves`, or `sim_character_memorials`.
2. **Never execute DDL (`ALTER TABLE`) inside daily tick loops**: Table enhancements belong in migration scripts, not inside per-tick agent loops (e.g., `cartelAgent.ts`).
3. **Always match column names exactly**:
   - `sim_outlaw_factions`: `origin_cell_id` (not `origin_burg_id`).
   - `population_demographics`: `settlement_id` for burgs, `home_cell_id` for cells.
4. **Spatial Locality for Recruitments**: When an event or ancient ward awakens a citizen, scope the query to nearby burgs rather than querying worldwide with `RANDOM() LIMIT 1`.
5. **Bidirectional Collision Handling**: When agents move via `stepTowardCell()`, handle collisions on both sides (Wardens and Cultists alike).

