# Ostraka System Overview

Welcome to the **Ostraka Living Simulation & B.R.U.T.A.L. TTRPG** system. This document outlines the architecture, database models, and operational pipelines that bring the Shatterlands to life.

---

## 1. Canon & Rules Precedence

Per **Rule 3** of `GEMINI.md`:
- **Canon and rules live in the Shatterlands folder and are read-only:**
  - **Lore**: `C:\Users\krazy\Desktop\Shatterlands\Canon\`, starting at `00_Index_and_Precedence.md`.
  - **Rules**: `C:\Users\krazy\Desktop\Shatterlands\Rules\BRUTAL_Rulebook_v3.md` (Draft v4.9). For the digest, read `Rules\Table_Test_Pack\players\Rules_Digest.md`.
  - If the code disagrees with them, the code is wrong.
- **The World is Ostraka, in the Shatterlands** ("Aetheria" is a retired working name).
- **The Game System is B.R.U.T.A.L.** (opposed 1d12 + Stat against Guard/DC).
- **Database Authority**: PostgreSQL is the single authoritative database. Any historical `.sqlite` files are retired.

---

## 2. The Core Operational Loop

> **tick → trouble (a thread) → hook reaches the party → players act → B.R.U.T.A.L. resolves → consequences written back → tick**

```
+-----------------------------------------------------------------------------------+
|                            THE 4-PILLAR ARCHITECTURE                              |
+-----------------------------------------------------------------------------------+
|  PILLAR 1: SIMULATION ENGINE    <==[REST/WS]==>    PILLAR 2: OBSERVER DASHBOARD   |
|  - Autonomous Macro/Meso Engine                    - Tactical 256x256 WebGL/2D    |
|  - PostgreSQL Source of Truth                      - Read-Only Projection of State|
|  - Daily Master Tick (1 Day = 1 Tick)              - Sector Survey & Telemetry    |
|  - 714 Paragons & 207k Demographics                - Sub-Map Layer Navigation     |
|  - Cartels, Lairs, Military Squads                 - Live 4-Player AI Session HUD |
+-----------------------------------------------------------------------------------+
|                                         |                                         |
|                                         v                                         |
|  PILLAR 3: B.R.U.T.A.L. GM ENGINE                  PILLAR 4: AI STORY DIRECTOR    |
|  - BrutalGM.ts & RulesEngine.ts                    - directorBridge.ts            |
|  - 12 Attributes, 4 Pools, 4 Senses                - Simulation State to Story Arc|
|  - Opposed 1d12 Net Margin Resolution             - Free-Speech Intent Parser    |
|  - Declarative Tag Reaction Matrix (17 Rules)      - Zero Invented Entities       |
|  - Pure Mechanical Execution (Code does math)      - Feeds Events to `sim_events`  |
+-----------------------------------------------------------------------------------+
```

---

## 3. The Nested Fractal Map Hierarchy

The world of Ostraka is organized into a strictly nested 3-tier fractal hierarchy, sandwiching the local layer vertically:

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

1. **Global Layer (Macro Continental LOD)**:
   - ~16,000 Voronoi polygonal cells (`sim_cells`).
   - Runs continually across the entire world: 589-day calendar (12 Dragon Months + 13-day Shadowfall), continental weather, sovereign geopolitics, macro burg supply chains, 12 flowing Chaos Leys, and 12 Sacred Groves / Dragon Prisons.

2. **Regional Layer (Meso LOD - 10,000 Cells per Global Cell)**:
   - Every Global Cell breaks down into an overland map of **exactly 10,000 regional cells** ($100 \times 100$ grid: `rx: 0..99, ry: 0..99`, centered at `(50, 50)`).
   - Generates elevation, vegetation density, chaos radiation, infrastructure/roads, and landmarks.
   - **Focused LOD Simulation**: Individual agent movements at this 10,000-cell level are only simulated when the regional map contains the player's location or an active focus.

3. **Local Layer (Micro LOD - Tactical Experience)**:
   - The active tactical grid where players act, with terrain tiles, interactive props, authentic NPCs from `population_demographics`, structures, and environmental hazards.
   - **Vertical Sandwich**:
     - **Upper Local ($Z = +1$)**: Fortified ramparts, parapets, watchtowers, 2nd-story lofts, tree canopies.
     - **Local Surface ($Z = 0$)**: Ground level streets, plazas, workshops, water docks, wild clearings.
     - **Lower Local ($Z = -1$)**: Subterranean dungeons, storage cellars, municipal sewers, catacombs.

---

## 4. The 4 Pillars Explained

### Pillar 1: The Simulation Engine (`simulation-engine/`)
The simulation engine runs in the background, pure state-in, state-out:
- **Time & Calendar**: 589-day year with 12 Dragon Months (48 days each) and a 13-day intercalary eclipse ("Shadowfall") outside the months.
- **Economy**: 352 burgs gather raw materials, refine them into goods, feed populations, and trade via inter-faction routes.
- **Demographics**: 207,000+ named citizens in `population_demographics` (12:1 ratio) with individual trades and motivations.
- **Paragons**: 714 unique civic leaders, watch captains, and underworld bosses.

### Pillar 2: The Observer Dashboard (`simulation-engine/src/observer/`)
- Embedded React & Vite dashboard on `http://localhost:5174/` (and port 3000).
- Pure visualizer: reads data from `GET /api/dm/sector_layer`.
- 256x256 Tactical Grid with live party member tokens, health bars, and real-time turn step execution.

### Pillar 3: B.R.U.T.A.L. Game Master Engine (`BrutalGM.ts` & `RulesEngine.ts`)
- **12 Attributes**: Might, Endurance, Finesse, Reflex, Vitality, Fortitude, Knowledge, Logic, Awareness, Intuition, Charm, Willpower.
- **4 Derived Resource Pools**: Health, Composure, Stamina, Focus.
- **4 Derived Senses & Static Guards**: Perception, Speed (Dodge Guard), Stealth, Balance (Footing Guard).
- **Contested 1d12 Net Margin Resolution**:
  $$\text{Net Margin} = (\text{Attacker } 1d12 + \text{Stat}) - (\text{Defender } 1d12 + \text{Stat / Guard})$$
  - $\text{Margin} < 0$: Defender parries/dodges.
  - $\text{Margin} = 0$: **The Clash** (resolved via the 6 combat stances: Press, Hold, Maneuver, Trick, Feint, Disengage).
  - $\text{Margin} \ge 1$: Attacker lands hit with capacity loss and energy shredding.
- **Declarative Tag Matrix Engine**: 17 multi-target rules (fire ignition, water dousing, electrical arcs, cold thermal shock, structural collapses, lockpicking, bribery, intimidation, acoustic lures).

### Pillar 4: The AI Story Director (`directorBridge.ts`)
- **Zero Invented Entities**: The AI director never hallucinates fake map elements. It reads live simulation trouble (`sim_burg_economy`) and real sector assets, creating emergent story threads that anchor to existing citizens and containers.
- **Total Player Agency**: AI players receive complete freedom to act (no rails or multiple-choice restrictions).
- **Event Chronicle**: Turn milestones and world impacts write back to `sim_events`.

---

## 5. Database Authority (PostgreSQL)

| Table Name | Purpose |
|---|---|
| `sim_burg_economy` | Economic metrics, wealth, food, unrest, and urbanization tier for 352 burgs. |
| `population_demographics` | 207,000+ individual citizens with names, species, professions, and traits (12:1 ratio). |
| `sim_paragons` | 714 unique civic leaders, military commanders, and underworld crime lords. |
| `sim_fringe_lairs` | Active vice dens, black markets, and smuggler hideouts. |
| `sim_sector_layers` | Cached 256x256 tactical maps for layers -1, 0, and +1 per cell. |
| `sim_events` | Chronicler table logging all world history, war declarations, and player deeds. |
| `sim_factions` | Grand geopolitical factions, sovereign borders, and alliances. |
| `sim_cells` | Hexagonal map cells with biomes, elevation, moisture, and road masks. |
| `sim_calendar` | Master cosmological calendar, dragon months, moon phase, and season. |
| `sim_sacred_groves` | The 12 dragon prisons anchoring the chaos flows. |
| `sim_player_character` | Persistent party character stats, stance, inventory, and health pools. |

---

## 6. How to Run the System

1. **Start PostgreSQL**:
   ```pwsh
   postgres.exe -D "$env:USERPROFILE\scoop\persist\postgresql\data"
   ```
2. **Start the Ollama Server**:
   ```pwsh
   ollama serve
   ```
3. **Start the Simulation Server**:
   ```pwsh
   cd simulation-engine
   npm run build:server
   node dist/server.js
   ```
4. **Start the Observer Dashboard**:
   ```pwsh
   cd simulation-engine
   npm run observer
   # Dashboard opens at http://localhost:5174/
   ```
