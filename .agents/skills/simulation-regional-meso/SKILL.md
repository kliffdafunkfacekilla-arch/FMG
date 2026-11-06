---
name: simulation-regional-meso
description: >-
  Governs the Regional (Meso LOD) overland simulation layer representing the 10,000-cell map of an individual global cell.
  Use when developing, debugging, or running regional overland generation, terrain noise masks, regional agent movements,
  or focused LOD simulation gating.
---

# Regional Layer (Meso LOD) Simulation Skill

This skill governs the middle tier of Ostraka's fractal hierarchy: the overland regional map nested inside each individual global cell.

## 1. Architectural Scope & Responsibilities
- **Geographic Scale**: Exactly **10,000 regional cells** ($100 \times 100$ grid: `rx: 0..99, ry: 0..99`).
- **Standard Center**: Center point is strictly `(rx: 50, ry: 50)`. Never use legacy 112 coordinates.
- **Overland Maps**:
  - `elevationMap`: Continuous 2D elevation via seeded Simplex noise.
  - `vegetationMap`: Forest, brush, and agricultural fertility masks.
  - `chaosMap`: Ambient chaos radiation from leaking dragon seals and ley lines.
  - `infraMap`: Highway network masks, roads, trails, bridges, and city footprints.
- **The Focused LOD Simulation Rule**:
  - Individual agent movements, tactical squad paths, and fine-grained meso updates at this 10,000-cell level are **ONLY simulated when the regional map contains the player's location (or an explicitly focused cell)**.
  - When unfocused, global cells do not execute individual agent pathfinding, keeping macro ticks fast (~200ms).
- **Seamless Border Transitions**:
  - Walking off the boundary of the 100x100 Regional grid (`rx = 0` or `99`, `ry = 0` or `99`) seamlessly transitions the player into the adjacent Global Cell.

## 2. Key Codebase Anchors
- Regional Instance: `simulation-engine/src/regional/RegionalInstance.ts`
- Regional API Router: `simulation-engine/src/api/regionalRouter.ts`
- Simplex Noise Generator: `simulation-engine/src/regional/SimplexNoise.ts`
- Agent Overland Movement: `simulation-engine/src/engine/agents/agentMovementHelper.ts`
- Active Regional State: `activeRegions` map in `regionalRouter.ts`

## 3. Mandatory Invariants
1. **10,000 Cell Standard**: The grid must always be $100 \times 100$ (`w = 100, h = 100`). Coordinates must always be validated against `0..99`.
2. **Focus Gating**: Never activate background agent simulations across multiple unfocused regional maps simultaneously.
3. **No Phantom Tiles**: Overland terrain types must derive directly from the underlying global cell's biome, elevation, and waterway masks.
4. **Coordinate Consistency**: All endpoints accepting `rx, ry` must default to `(50, 50)` when coordinates are omitted.

## 4. Verification Workflow
When modifying regional generation or overland routing:
1. Verify endpoint response:
   `curl http://localhost:3000/api/regional/cell/13408`
   `curl "http://localhost:3000/api/regional/manifest/13408?x=50&y=50"`
2. Verify boundary checks: Coordinates `< 0` or `>= 100` must return HTTP 400.
3. Verify that running `runDualLODSimulation.ts` correctly processes the focused cell alongside macro ticks without performance degradation.
