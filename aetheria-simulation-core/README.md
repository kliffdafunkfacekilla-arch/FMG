# Aetheria Simulation Engine (`simulation-engine`)

The **Aetheria Simulation Engine** is the independent backend macro- and meso-layer of the Aetheria / Ostraka world simulation. It runs as an autonomous Node.js service backed by PostgreSQL.

---

## 1. What the Engine Does

1. **Simulates 1 Day per Tick**:
   - The master orchestrator (`src/engine/masterOrchestrator.ts`) advances time by 1 in-game day per tick across the 541-day Ostraka cosmic year.
2. **Economic & Demographics Processing**:
   - Manages 352 unique burgs across 10,000+ hexagonal cells.
   - Populates and computes wealth, food, and unrest for over 207,000 citizens organized into a strict **12-to-1 worker ratio** (`unit_size = 12`) in `population_demographics`.
   - Tracks a 3-tiered crafting economy: raw materials (wood, ore, fiber), refined goods (lumber, steel, textiles), and regional trade inventories.
3. **The 714 Paragons**:
   - 337 Civic Paragons (Mayors, Town Reeves, Headmen).
   - 337 Security Paragons (Watch Commanders, Marshals, Wardens).
   - Autonomous Underworld Crime Lords (e.g. Master of the Cloud Fleet, Corsair Queen Lyra Ghostwind).
   - Paragons apply localized trait multipliers (Agrarian, Corrupt, Disciplined, Industrialist) that directly alter economic yields, unrest, and law enforcement.
4. **Underworld Cartels & Fringe Factions**:
   - Independent syndicates (The Obsidian Cartel, The Otter Mafia, The Ghostwind Raiders, The Free Sky-Barons, The Gilded Compass, and the Ivory Fleet) siphon unrest and manpower from failing burgs.
   - Cartels establish subterranean lairs (`sim_fringe_lairs`): Vice Dens, Smuggler Caches, and Black Markets.
   - Turf wars erupt when rival cartels contest the same burg, resolved by comparing cartel manpower.
   - Grind Canyon Corps and Hedge Wizards operate unsanctioned delves and illicit charm markets.
5. **Faction Utility AI**:
   - Macro factions evaluate 40+ strategic options (Declare War, Commission Wonders, Form Alliances, Trade Embargos) using dynamic utility scoring.
   - Grand strategy runs on staggered bureaucratic turns (`tick % 10`) to allow markets to settle.
6. **3-Layer Sector & Sub-Map Generator**:
   - Synthesizes 256x256 tactical maps on demand:
     - `Layer -1`: Underworld, cellars, storm drains, smuggler flues, cartel dens.
     - `Layer 0`: Surface ground level, streets, plaza, workshops, barracks, docks.
     - `Layer +1`: Upper level, ramparts, catwalks, second-story lofts, watchtowers.
   - All NPCs rendered in sectors are authentic individuals: zero generic spawns.

---

## 2. Pipeline Execution Sequence

Every execution of `/api/observer/tick` runs this exact agentic sequence:

1. **`calendarAgent.ts`**: Advances the 541-day calendar, 12 Dragon Months, and Cruorbus lunar phases.
2. **`weatherAgent.ts`**: Computes temperature, precipitation, and chaos radiation fronts across the hex grid.
3. **`burgOperationsAgent.ts`**: Computes production, food consumption, unrest, and wealth using bulk SQL operations.
4. **`paragonPlanningAgent.ts`**: Executes personality-driven trait modifiers for local burg leaders.
5. **`factionPlanningAgent.ts`**: Evaluates faction military, treasury, and geopolitical goals.
6. **`cartelAgent.ts`**: Grows criminal syndicates, establishes subterranean lairs, and triggers turf wars.
7. **`wardenAgent.ts` & `cultistAgent.ts`**: Metaphysical actors fighting over the 12 Dragon Seals.
8. **`encounterAgent.ts`**: Roaming predators, prey herds, wayfarer caravans, and anomaly migrations.
9. **`chroniclerAgent.ts`**: Commits historical milestones to `sim_events`.

---

## 3. Key Endpoints

- `GET /api/observer/state`: Returns the live global world state (tick, date, weather, faction metrics).
- `POST /api/observer/tick`: Triggers a 1-day simulation step.
- `GET /api/observer/map`: Returns the macro Voronoi cell geometry, biomes, and borders.
- `GET /api/dm/sector_layer?cellId=...&rx=...&ry=...&z=...`: Generates and retrieves the 256x256 tactical map layer with authentic citizens, military squads of 12, underworld lairs, and paragons.

---

## 4. Development & Build Scripts

```bash
# Compile TypeScript server
npm run build:server

# Start the simulation server (port 3000)
node dist/server.js

# Hard reset database and resync from Okasha.json
npm run reset-world
```
