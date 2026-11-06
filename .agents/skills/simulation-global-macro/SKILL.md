---
name: simulation-global-macro
description: >-
  Governs the Global Continental (Macro LOD) simulation layer across Ostraka's ~16,000 Voronoi cells.
  Use when developing, debugging, or running the world calendar, sovereign geopolitics, burg macro-economies,
  the 12 Dragon Prisons, Chaos Leys, continental weather, or trophic ecology.
---

# Global Layer (Macro Continental LOD) Simulation Skill

This skill governs the top tier of Ostraka's fractal hierarchy: the realm-wide macro simulation executing in the background.

## 1. Architectural Scope & Responsibilities
- **Geographic Scale**: ~16,000 Voronoi cells (`sim_cells`).
- **Tick Scale**: 1 Master Tick = 1 In-Game Day (`masterOrchestrator.ts`).
- **Calendar & Cosmology**:
  - **541-Day Year**: 12 Dragon Months (44 days each = 528 days) + 13-Day "Shadow Week" (Days 529–541 intercalary eclipse).
  - **8 Seasons** (66 days each): The Bloom, The High Sun, The Harvest, The Withering, The Deep Cold, The Thaw, The Awakening, The Roaring.
  - **Cruorbus Moon**: 44-day cycle with 5 lunar phases (Empty Eye, Waxing Blood, Full Blood, Mercy Alignment, Nightmare Alignment).
- **Macro Economies (352 Burgs)**:
  - 3-tier production: Raw resources -> Refined goods -> Complex trade inventories.
  - Population tracking: Groups of 12 (`unit_size = 12`). Pre-industrial birth rate (~3.5% annually, ~0.000065 daily in `pop_growth_pool`). Child maturation is 15 in-game years (`tick % 541 === 0`).
  - Military food upkeep & logistics.
- **Geopolitics & Sovereign Diplomacy**:
  - 19 sovereign nations running Utility AI evaluations.
  - Bureaucratic turns evaluate monthly (`(tick + f.id * 7) % 44 === 0`) to prevent decision spam.
  - Military campaign maneuvers resolve weekly (`tick % 7 === 0`).
- **Cosmic Entities**:
  - 12 self-sustaining Dragon Prisons powered by 12 flowing Chaos Leys.
  - 72 Grey Wardens patrolling flows and cleansing blight.
  - 288 Shlaar Void Cultists whispering to the Sparkborn.
  - 714 active Paragons (Civic Leaders, Security Marshals, Syndicate Bosses).

## 2. Key Codebase Anchors
- Master Pipeline: `simulation-engine/src/engine/masterOrchestrator.ts`
- Calendar & Weather: `simulation-engine/src/engine/agents/calendarAgent.ts`, `weatherAgent.ts`
- Burg Economy & Demographics: `simulation-engine/src/engine/agents/burgOperationsAgent.ts`, `burgExpansionAgent.ts`
- Faction Geopolitics: `simulation-engine/src/engine/agents/factionPlanningAgent.ts`, `factionActions.ts`
- Cosmic & Wardens: `simulation-engine/src/engine/agents/wardenAgent.ts`, `cultistAgent.ts`, `chaosFlowAgent.ts`
- Database Truth: `sim_cells`, `sim_burg_economy`, `sim_calendar`, `population_demographics`, `sim_factions`

## 3. Mandatory Invariants
1. **Performance Target**: Macro tick must complete in ~180ms - 260ms. Never run fine-grained A* pathfinding or individual tactical agent routines at the global layer.
2. **Zero Generic Spawns**: All casualties, recruits, and leaders must trace to authentic citizens or Paragons in PostgreSQL.
3. **Purity of Simulation**: Macro modules must be pure calculation functions—never touch UI, canvas, or WebGL.
4. **Time Scale Integrity**: Never treat days as years. Aging, crop yields, and treaties must adhere to the 541-day calendar.

## 4. Verification Workflow
When making changes to the Macro Layer:
1. Run a 44-tick test (1 Dragon Month):
   `npx --prefix simulation-engine tsx simulation-engine/src/scripts/runYearCalibration.ts`
2. Check tick duration and demographics:
   - Population change should remain within natural bounds (< 0.1% monthly delta).
   - Treaty counts must remain stable without spamming peace declarations daily.
3. Update `GEMINI.md` and `SYSTEM_OVERVIEW.md` if any constants or state schemas change.
