---
name: brutal-dm-engine
description: >-
  Governs the B.R.U.T.A.L. Game Master (DM) engine connecting the live simulation state to tactical player sessions.
  Use when developing, debugging, or auditing sector state loading, player action arbitration (/act),
  NPC diurnal routines, interior sub-map transitions, or environmental interaction cascades.
---

# B.R.U.T.A.L. Game Master (DM Layer) Skill

This skill governs the operational Game Master layer: the mechanical arbiter that sits between the live PostgreSQL simulation state, the tactical client, and player interactions.

## 1. Architectural Scope & Responsibilities
- **Singleton Game Master**: `BrutalGM.ts` acts as the master coordinator for all player sessions.
- **Sector Loading & Context Injection (`POST /api/dm/sector_load`)**:
  - Gathers live global and regional indicators (cell ID, rx, ry, biome, famine, warzone, chaos radiation, infrastructure).
  - Updates NPC diurnal routines (`npcRoutineAgent.ts`) according to cycle (Morning, Midday, Evening, Night).
  - Injects authentic Paragons and citizens into tactical grid plots.
  - Queries `sim_sector_layers` (Layer 0) first, falling back to `sim_world_vault_sectors` or on-demand generation.
- **Vertical Layer Transitions (`GET /api/dm/sector_layer`)**:
  - Serves synchronized tactical slices for $Z = -1$ (Subterranean), $Z = 0$ (Surface), and $Z = +1$ (Elevated).
  - Automatically synthesizes and persists 3-layer stacks for burg settlements when unvaulted.
- **Action Arbitration (`POST /api/dm/action`)**:
  - Receives natural language or structured player intents (e.g. "Pick the lock on the warehouse cellar", "Attack the cultist sentinel").
  - Translates free-speech action into B.R.U.T.A.L. opposed checks via `RulesEngine.ts` and `customRulesEngine.ts` (1d12 + Stat vs Guard).
  - Evaluates Tag Matrix physical cascades (e.g. kicking an oil brazier onto dry timber).
  - Updates character derived pools (HP, Stamina, Composure, Focus).
- **Interior & Sub-Map Dungeons (`POST /api/dm/interior/enter`)**:
  - Handles transitions into persistent 256x256 interiors (crypts, taverns, vaults, dungeons, Grind Canyons).
  - Records parent sector coordinates `(cell_id, rx, ry, prop_id)` for seamless exits.
