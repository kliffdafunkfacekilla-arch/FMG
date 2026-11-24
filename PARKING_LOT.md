# PARKING LOT

This document tracks ideas, feature requests, or candidate refactors that do **not** serve the current vertical slice loop:
> **tick → trouble (a thread) → hook reaches the party → players act → B.R.U.T.A.L. resolves → consequences written back → tick**

Per **Rule 1** of `GEMINI.md`:
*"If you can't say which step of the loop a change serves, don't build it. Add it to `PARKING_LOT.md` instead."*

---

## Parked Items

The vertical slice is certified (2026-11-24), so these are no longer blocked by it. They stay parked until the user picks one; see "Current focus" in `AGENT_RULES.md`.

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


## Phase B: Ostraka_full.map Rich Datasets (Completed 2026-11-24)

Ingested and stored in PostgreSQL from `Ostraka_full.map` and now wired into the simulation and tests (after `testVerticalSlice` certified the vertical slice):
- ~~`sim_route_graph` / `sim_roads`:~~ **DONE (`5eb737a`, `B6.1`)** — physical convoy routing, blockade edge closures, bypass rerouting, and destination stalls (`testCitizenLogistics`).
- ~~`sim_markets` & `sim_goods` (31 markets, 71 goods):~~ **DONE (`98ac644`)** — citizen-backed gathering, recipes, specialties, and 31-market regional pricing (`testCitizenEconomy`).
- ~~`sim_factions` fiscal fields (`treasury`, `gdp`, `budget`, `corruption`, `total_pop`):~~ **DONE (`B6.2`)** — tax revenue vs `sim_faction_units` troop upkeep, bankruptcy desertion, and corruption-fed unrest/crime (`testFactionFinances`).
- ~~`sim_burg_economy` civic flags (`port`, `citadel`, `walls`, `plaza`, `temple`, `shanty`, `is_capital`):~~ **DONE (`B6.3`)** — wired into `SectorMapGenerator` / `WardDistrict` structures/props and siege defense (`testCivicFlags`).
- ~~`sim_rivers` & cell `flux` / `current_temp`:~~ **DONE (`B6.4`)** — river floods, drought irrigation buffering, agricultural harvest variance, and river crossing tolls (`testRiversAndClimate`).
- ~~`sim_cells` `culture_id` & `religion_id` + `sim_cultures` / `sim_religions`:~~ **DONE (`B6.5`)** — cell-to-cell cultural assimilation, heresy diffusion, and temple reconversion (`testCultureReligion`).
