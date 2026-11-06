---
name: concordia-dm-engine
description: >-
  Governs the Concordia Game Master (DM) engine connecting the live simulation state to tactical player sessions.
  Use when developing, debugging, or auditing sector state loading, player action arbitration (/act),
  NPC diurnal routines, interior sub-map transitions, or environmental interaction cascades.
---

# Concordia Game Master (DM Layer) Skill

This skill governs the operational Game Master layer: the mechanical arbiter that sits between the live PostgreSQL simulation state, the tactical client, and player interactions.

## 1. Architectural Scope & Responsibilities
- **Singleton Game Master**: `ConcordiaGM.ts` acts as the master coordinator for all player sessions.
- **Sector Loading & Context Injection (`POST /api/dm/sector_load`)**:
  - Gathers live global and regional indicators (cell ID, rx, ry, biome, famine, warzone, chaos radiation, infrastructure).
  - Updates NPC diurnal routines (`npcRoutineAgent.ts`) according to cycle (Morning, Midday, Evening, Night).
  - Injects authentic Paragons and citizens into tactical grid plots.
  - Queries `sim_sector_layers` (Layer 0) first, falling back to `sim_world_vault_sectors` or on-demand generation.
- **Vertical Layer Transitions (`GET /api/dm/sector_layer`)**:
  - Serves synchronized tactical slices for $Z = -1$ (Subterranean), $Z = 0$ (Surface), and $Z = +1$ (Elevated).
  - Automatically synthesizes and persists 3-layer stacks for burg settlements when unvaulted.
- **Action Arbitration (`POST /api/dm/act`)**:
  - Receives natural language or structured player intents (e.g. "Pick the lock on the warehouse cellar", "Attack the cultist sentinel").
  - Translates free-speech action into Concordia opposed checks via `RulesEngine.ts`.
  - Evaluates Tag Matrix physical cascades (e.g. kicking an oil brazier onto dry timber).
  - Updates character derived pools (HP, Stamina, Composure, Focus).
- **Interior & Sub-Map Dungeons (`POST /api/dm/interior/enter`)**:
  - Handles transitions into persistent 256x256 interiors (crypts, taverns, vaults, dungeons, Grind Canyons).
  - Records parent sector coordinates `(cell_id, rx, ry, prop_id)` for seamless exits.

## 2. Key Codebase Anchors
- Concordia Game Master: `simulation-engine/src/engine/rpg/ConcordiaGM.ts`
- DM API Router: `simulation-engine/src/api/dmRouter.ts`
- DM Toolkit Router: `simulation-engine/src/api/dmToolkitRouter.ts`
- Director Bridge: `simulation-engine/src/engine/rpg/directorBridge.ts`
- NPC Routines & Minds: `simulation-engine/src/engine/agents/npcRoutineAgent.ts`, `npcMindPure.ts`
- Universal Interaction Engine: `simulation-engine/src/engine/universalInteraction.ts`
- Database Tables: `sim_sector_layers`, `interior_sub_maps`, `sim_player_character`, `sim_game_saves`

## 3. Mandatory Invariants
1. **Never Invent Map Data**: The DM engine must never invent imaginary NPCs or props not backed by `population_demographics`, `sim_paragons`, or the sector layer database.
2. **Deterministic Mechanics First**: Dice rolls and pool deductions are calculated by Concordia rules before any descriptive text is generated.
3. **Accurate Coordinates**: Default coordinates must always resolve to `rx: 50, ry: 50` on the $100 \times 100$ grid. Never allow legacy 112 values.
4. **State Persistence**: Any destruction of props, death of named citizens, or lock picking must persist back to the database.

## 4. Verification Workflow
When modifying the DM layer:
1. Verify sector load response:
   `curl -X POST http://localhost:3000/api/dm/sector_load -H "Content-Type: application/json" -d '{"cellId": 13408, "rx": 50, "ry": 50}'`
2. Test player action arbitration:
   `curl -X POST http://localhost:3000/api/dm/act -H "Content-Type: application/json" -d '{"cellId": 13408, "actionText": "Examine the central well", "targetId": "prop_fountain_73"}'`
3. Verify `tsc` clean build across `simulation-engine`.
