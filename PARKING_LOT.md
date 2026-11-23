# PARKING LOT

This document tracks ideas, feature requests, or candidate refactors that do **not** serve the current vertical slice loop:
> **tick → trouble (a thread) → hook reaches the party → players act → B.R.U.T.A.L. resolves → consequences written back → tick**

Per **Rule 1** of `GEMINI.md`:
*"If you can't say which step of the loop a change serves, don't build it. Add it to `PARKING_LOT.md` instead."*

---

## Parked Items (Frozen Until Vertical Slice is Complete)

1. **Standalone `player-client` React WebApp**:
   - The primary tactical interface and live party watcher are running natively inside the Observer Dashboard (`simulation-engine/src/observer/` on `http://localhost:5174`).
   - The `player-client/` folder is no longer in the working tree. Its last full version (153 files) is preserved in git history; restore it with `git checkout a796e0e^ -- player-client` when this item is unparked.

2. **Continental Airship Aerotime Flight Simulation**:
   - High-altitude airship physics, gimbals, and sky-piracy across distant macro cells (`Canon/11`).
   - Parked until the single-burg tactical play session loop is fully certified.

3. **Global Multi-Burg Faction War Expansion**:
   - Large-scale military siege maneuvers and multi-regiment logistics across 352 burgs.
   - Parked until Burg 1 (`Excelsis Citadel`) loop operations and local slice are finalized.

4. **Web Audio Synthesizer Procedural Orchestration**:
   - Procedural synth music generators for distinct biomes.
   - Parked until core rules, GM arbitration, and test suites are 100% verified.

5. **External Client Mobile Responsive Wrapper**:
   - Mobile touch optimizations for tactical canvas.
   - Parked.


## Phase B: Ostraka_full.map Rich Datasets (Seeded, Pending Global-Sim Integration)

Ingested and stored in PostgreSQL from `Ostraka_full.map` without altering current tick/agent logic yet:
- `sim_route_graph` / `sim_roads`: Wire route blockade/war closures to disrupt matching `sim_trade_deals` paths and freight costs.
- `sim_markets` & `sim_goods` (31 markets, 71 goods): Replace uniform global commodity scarcity with market-by-market regional supply, demand, and trade-deal fulfillment.
- `sim_factions` fiscal fields (`treasury`, `gdp`, `budget`, `corruption`, `total_pop`): Drive war chest solvency, troop upkeep (`sim_faction_units`), and corruption-fueled unrest/crime.
- `sim_burg_economy` civic flags (`has_port`, `has_citadel`, `has_walls`, `has_plaza`, `has_temple`, `has_shanty`, `capital`): Feed tactical `SectorMapGenerator` district/building placement and siege mechanics.
- `sim_cells` painted `culture_id` & `religion_id` + `sim_cultures` / `sim_religions`: Enable territory-wide heresy/cultural conversion/suppression diffusion.
- `sim_rivers` & cell `flux` / `temp_c` / `precip`: Drive drought, flooding, river navigation tolls, and seasonal harvest variance.
