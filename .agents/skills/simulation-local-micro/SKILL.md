---
name: simulation-local-micro
description: >-
  Governs the Local (Micro LOD) Tactical Battle Map layer and its 3-tier vertical sandwich (Upper Local, Surface, Lower Local).
  Use when developing, debugging, or rendering tactical 256x256 tilemaps, interactive props, authentic citizen placement,
  vertical layer transitions (Z = -1, 0, +1), or Zelda-style border crossing into adjacent regional cells.
---

# Local Layer (Micro LOD & Tactical Grid) Simulation Skill

This skill governs the bottom tier of Ostraka's fractal hierarchy: the tactical grid where the player experiences and interacts with the world.

## 1. Architectural Scope & Responsibilities
- **Geographic Scale**: Situated at one single regional cell `(rx, ry)` within the 10,000-cell regional overland map.
- **Grid Resolution**: Exact $256 \times 256$ tactical tile grid (65,536 tiles per sector).
- **The 3-Layer Vertical Local Stack**:
  Every local cell is vertically sandwiched by 3 synchronized layers:
  - **Upper Local ($Z = +1$)**: Fortified ramparts, parapet walkways, watchtowers, 2nd-story lofts, tree canopies, and sky-bridges.
  - **Local Surface ($Z = 0$)**: Ground level streets, plazas, cottages, workshops, water docks, and wild clearings.
  - **Lower Local ($Z = -1$)**: Subterranean dungeons, storage cellars, municipal drainage/sewer culverts, cartel contraband flues, and catacombs.
- **Physical Vertical Transitions**:
  - Transition occurs via physical interactive props (ladders, stairs, hatches, trapdoors) handled by `GET /api/dm/sector_layer?cellId=...&rx=...&ry=...&z=...`.
  - Layer state is stored in `sim_sector_layers` (or generated on-demand by `generateBurgSectorLayers`).
- **Seamless Horizontal Border Transitions**:
  - Walking off the edge of the tactical grid (`lx = 0` or `255`, `ly = 0` or `255`) steps into the adjacent Regional cell `(rx ± 1, ry ± 1)` within the 10,000-cell regional map.
- **Zero Generic Spawns**:
  - All spawned humanoids must originate from `population_demographics` (using authentic trade, species, and background) or `sim_paragons`.
  - Underworld lairs and contraband caches derive strictly from `sim_fringe_lairs`.

## 2. Key Codebase Anchors
- 3-Layer Generator: `simulation-engine/src/engine/maps/SectorMapGenerator.ts` (`generateBurgSectorLayers`)
- Sub-Map & Interior Engine: `simulation-engine/src/engine/subMapEngine.ts`
- Sector API Endpoints: `simulation-engine/src/api/dmRouter.ts` (`/sector_layer`, `/sector_load`, `/interior/enter`)
- Tactical Player View: `player-client/src/App.tsx` (`handleSwitchSectorLayer`, `fetchSectorState`)
- Client Grid Generator: `player-client/src/utils/Level3Generator.ts`, `UrbanSettlementGenerator.ts`
- Database Cache: `sim_sector_layers`, `sim_world_vault_sectors`, `interior_sub_maps`

## 3. Mandatory Invariants
1. **Vertical Alignment**: Surface props that descend (e.g. cellar hatches, sewer grates) must align with corresponding ascent props (ladders, stairs) in Layer -1.
2. **Read-Only Rendering**: The player client must render pure projections of simulation state—never fabricate unbacked NPCs or structures.
3. **Tile Enums**: Use standard tile IDs:
   `0: Open Ground | 1: Vegetation/Trees | 2: Water | 3: Dirt Path | 4: Cobblestone Road | 5: Stone Wall | 6: Chaos Core | 7: Wooden Structure | 8: Hearth/Forge | 9: Blight | 10: Ward Stone`.
4. **Coordinate Mapping**: Local tactical coordinates are `lx: 0..255, ly: 0..255`. Regional coordinates are `rx: 0..99, ry: 0..99`.

## 4. Verification Workflow
When making changes to local sectors:
1. Verify database layer generation:
   `SELECT cell_id, rx, ry, z_layer, layer_name FROM sim_sector_layers WHERE cell_id = 13408 AND rx = 50 AND ry = 50;`
2. Test vertical transition endpoint:
   `curl "http://localhost:3000/api/dm/sector_layer?cellId=13408&rx=50&ry=50&z=0"`
   `curl "http://localhost:3000/api/dm/sector_layer?cellId=13408&rx=50&ry=50&z=-1"`
   `curl "http://localhost:3000/api/dm/sector_layer?cellId=13408&rx=50&ry=50&z=1"`
3. Confirm `player-client` compiles without errors (`npm --prefix player-client run build`).
