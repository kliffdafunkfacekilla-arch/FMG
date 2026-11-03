# Player Tactical Client (`player-client`)

The **Player Tactical Client** is the tactical exploration and TTRPG interface for Ostraka / Aetheria. It is built with React, TypeScript, Vite, and HTML5 Canvas, running on port 5173.

---

## 1. Core Principles

1. **Pure Visual Projection**:
   - The player client is a read-only visual projection of the live simulation state.
   - It **never** invents fake buildings, fake citizens, or arbitrary quest checklists.
   - All rendered entities are queried directly from the backend simulation database (`sim_sector_layers`, `sim_burg_economy`, `population_demographics`, `sim_paragons`, `sim_fringe_lairs`).
2. **256x256 Tactical Grid**:
   - Every macro hexagonal cell contains a 256x256 tile coordinate plane.
   - Walking past cell boundaries triggers seamless border transitions into adjacent sectors (Zelda-style regional traversal).
3. **3-Layer Vertical Sub-Maps**:
   - **Layer -1 (Subterranean)**: Wine cellars, sewers, smuggler tunnels, and underworld vice dens.
   - **Layer 0 (Surface)**: Town gates, cobble thoroughfares, market squares, guildhalls, and harbor piers.
   - **Layer +1 (Upper Level)**: Ramparts, defensive battlements, second-story lofts, and elevated catwalks.
   - **Points of Entry (POEs)**: Trapdoors, stairwells, and ladders allow players to navigate between layers seamlessly.

---

## 2. Interface Features

- **Tactical Battlegrid & Renderer**:
  - Smooth 60 FPS canvas rendering with dynamic viewport culling and field of view.
  - Interactive click-to-target inspection of any NPC, building, or landmark.
- **Sector Survey & Telemetry HUD**:
  - Displays macro coordinates, regional biome, sovereignty, active weather, and lunar phase.
  - Lists detected nearby life (citizens, military detachments, syndicate operatives, wildlife).
- **Concordia Character Sheet**:
  - Displays the 12 Concordia attributes (Might, Endurance, Finesse, Reflex, Vitality, Fortitude, Knowledge, Logic, Awareness, Intuition, Charm, Willpower).
  - Tracks the 4 derived resource pools: Health, Stamina, Composure, and Focus.
- **Synthesized Web Audio Engine (`AudioManager.ts`)**:
  - 100% procedural sound design using the native Web Audio API (no heavy MP3 assets).
  - Ambient environmental drone, biome wind, rhythmic footsteps, combat impacts, and subterranean reverbs.

---

## 3. Running the Client

```bash
cd player-client
npm install
npm run dev
```

The application will start on `http://localhost:5173`. Make sure the `simulation-engine` is running on `http://127.0.0.1:3000` so that sector maps and simulation data can be retrieved.
