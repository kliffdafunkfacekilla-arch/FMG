# Ostraka / Aetheria System Overview

Welcome to the **Aetheria Fractal Simulation & Concordia TTRPG** system. This document is written in plain, clear language so that any developer, game master, or player can understand what this project is, where it came from, and how every moving part connects.

---

## 1. Project Lineage & History

1. **Origins (Azgaar's Fantasy Map Generator)**:
   - The project started with the desire to transform Azgaar's procedural web map generator into a living, breathing simulated world.
   - We initially created a lean Python/FastAPI version (`fmg-rebuild`) that produced the master continental world file: `Okasha.map` (12.7 MB) and `Okasha.json` (35.2 MB).
   - This provided over 10,000 Voronoi cells, realistic coastlines, river networks, biomes, and 352 unique settlements ("burgs").

2. **Evolution to High-Performance TypeScript & PostgreSQL**:
   - To make the world truly alive, we migrated the simulation state into a robust PostgreSQL database and built an autonomous background simulation engine in Node.js (`simulation-engine`).
   - Every day in the game world is advanced by one "Tick" of the simulation.

3. **The 4-Pillar Architecture**:
   - The project is cleanly separated into 4 distinct, cooperating pillars:
     1. **The Simulation Engine** (Macro & Meso living world state).
     2. **The Player Tactical Interface** (256x256 exploration grid & visualizer).
     3. **The Independent GM Engine** (12 Concordia attributes, tag matrices, 1d12 Net Margin B.R.U.T.A.L. v4.9 mechanics).
     4. **The AI Story Generator** (Gemini narrative director connecting actors into emergent drama).

---

## 2. The 4 Pillars Explained in Plain Words

```
+-----------------------------------------------------------------------------------+
|                            THE 4-PILLAR ARCHITECTURE                              |
+-----------------------------------------------------------------------------------+
|  PILLAR 1: SIMULATION ENGINE    <==[REST/WS]==>    PILLAR 2: PLAYER INTERFACE     |
|  - Autonomous Macro/Meso Engine                    - Tactical 256x256 WebGL/2D    |
|  - PostgreSQL Source of Truth                      - Read-Only Projection of State|
|  - 8-Layer Agentic Tick (1 Day = 1 Tick)          - Sector Survey & Telemetry    |
|  - 714 Paragons & 207k Demographics                - Sub-Map Layer Navigation     |
|  - Cartels, Lairs, Military Squads                 - Web Audio Synthesizer        |
+-----------------------------------------------------------------------------------+
|                                         |                                         |
|                                         v                                         |
|  PILLAR 3: INDEPENDENT GM ENGINE                   PILLAR 4: AI STORY GENERATOR   |
|  - Concordia 12-Attribute Matrix                   - Gemini Natural Language Arbiter|
|  - 4 Derived Pools (HP, Stamina, Composure, Focus) - Free-Speech Intent Parser    |
|  - Opposed 1d12 Net Margin Resolution             - Narrative Drama & Organic Lore|
|  - Physical Tag Matrix Cascades                    - Connects Any Two Entities    |
|  - Pure Mechanical Execution (No Hallucinations)  - Feeds Events to `sim_events`  |
+-----------------------------------------------------------------------------------+
```

---

## 3. The Nested Fractal Map & Simulation Hierarchy

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
   - Runs continually across the entire world: 541-day calendar (12 Dragon Months + Shadow Week), continental weather, sovereign geopolitics, macro burg supply chains, 12 flowing Chaos Leys, and 12 Dragon Prisons.

2. **Regional Layer (Meso LOD - 10,000 Cells per Global Cell)**:
   - Every single Global Cell breaks down into an overland map of **exactly 10,000 regional cells** ($100 \times 100$ grid: `rx: 0..99, ry: 0..99`, centered at `(50, 50)`).
   - Generates elevation, vegetation density, chaos radiation, infrastructure/roads, and landmarks.
   - **FOCUSED LOD SIMULATION RULE**: Individual agent movements, tactical squad paths, and fine-grained meso updates at this 10,000-cell level are **ONLY simulated when the regional map contains the player's location (or an explicitly focused cell)**. When unfocused, global cells do not execute individual agent pathfinding, keeping macro ticks fast (~200ms).

3. **Local Layer (Micro LOD - The Tactical Experience)**:
   - The player's active position is situated on ONE specific cell `(rx, ry)` within that 10,000-cell Regional map.
   - This single regional cell expands into the **Local Layer** — the tactical grid where the player experiences the world, with terrain tiles, interactive props, authentic NPCs from `population_demographics`, structures, and environmental hazards.

4. **Upper Local & Lower Local Vertical Sandwich**:
   - **Upper Local ($Z = +1$)**: Fortified ramparts, parapet walkways, watchtowers, 2nd-story lofts, tree canopies, and sky-bridges.
   - **Local Surface ($Z = 0$)**: Ground level streets, plazas, cottages, workshops, water docks, and wild clearings.
   - **Lower Local ($Z = -1$)**: Subterranean dungeons, storage cellars, municipal drainage/sewer culverts, cartel contraband flues, and catacombs.
   - Players transition between levels via interactive ladders, stairs, trapdoors, and hatches (`GET /api/dm/sector_layer`).

5. **Seamless Border Crossing**:
   - Walking off the edge of a Local cell steps into the adjacent Regional cell `(rx ± 1, ry ± 1)`.
   - Walking off the edge of the 100x100 Regional map (`rx = 0` or `99`, `ry = 0` or `99`) seamlessly crosses into the adjacent Global Cell.

---

### Pillar 1: The Simulation Engine (`simulation-engine/`)
The simulation engine runs in the background. It does not know or care about DOM, canvas, or UI rendering. It only computes math, physics, economics, and agent behaviors:
- **Time & Calendar**: A 541-day cosmic year with 12 Dragon Months (44 days each) and a 13-day intercalary solar eclipse ("Shadow Week").
- **Economy**: 352 burgs gather raw materials (wood, ore, fiber), refine them into goods (lumber, steel, textiles), feed their population, and pay upkeep for their standing military.
- **Population & Demographics**: Citizens are tracked at a strict **12-to-1 ratio** (`unit_size = 12`). Over 207,000 named, distinct citizens exist in `population_demographics` with specific trades, species, and personal motivations.
- **714 Paragons**: Unique leading figures across all burgs:
  - 337 Civic Leaders (Mayors, Town Reeves, Headmen).
  - 337 Security Commanders (Watch Captains, Marshals, Wardens).
  - Autonomous Underworld Syndicate Bosses (e.g., Master of the Cloud Fleet, Corsair Queens).
- **The Underworld & Fringe Factions**: The Obsidian Cartel, Otter Mafia, Ghostwind Raiders, Free Sky-Barons, Gilded Compass, and Ivory Fleet siphon unrest from troubled towns and establish subterranean vice dens and black markets.
- **Grind Canyon Corps & Hedge Wizards**: Chaos chasms open in the wild where brave crews dive for dragonstone; unsanctioned hedge wizards sell unregistered charms.

### Pillar 2: The Observer Dashboard & Tactical Map Viewer (`simulation-engine/src/observer/`)
The observer interface monitors the living world in real-time:
- **Port 5174 / 3000 Dashboard**: Self-contained React & Vite dashboard embedded directly inside the simulation engine.
- **Pure Visualizer**: It reads data from the simulation engine API (`GET /api/dm/sector_layer`). It **never** invents fake buildings, fake citizens, or fake terrain.
- **256x256 Tactical Grid**: High-resolution tactical space with seamless Zelda-style boundary crossing between adjacent hex cells.
- **3-Layer Vertical Sub-Maps**:
  - `Layer -1 (Subterranean)`: Wine cellars, storm drains, smuggler flues, cartel dens.
  - `Layer 0 (Surface)`: Streets, plazas, guildhouses, bakeries, forges, docks.
  - `Layer +1 (Upper)`: Ramparts, towers, second-floor lofts, catwalks, airship gantries.
- **Procedural Points of Entry (POEs)**: Doors, trapdoors, ladders, and cave mouths allow moving between layers and entering dungeons, crypts, and Grind Canyons.
- **Web Audio Synthesizer**: Procedural ambient audio, footsteps, combat cues, and wind soundscapes generated directly through the Web Audio API.

### Pillar 3: The Independent GM & Narrative Reaction Engine (`ConcordiaGM.ts` & `narrativeReactionEngine.ts`)
The Game Master (GM) engine is a strict, mathematical referee and systemic consequence engine:
- **12 Concordia Attributes**:
  - Physical: *Might, Endurance, Finesse, Reflex, Vitality, Fortitude*.
  - Mental: *Knowledge, Logic, Awareness, Intuition, Charm, Willpower*.
- **4 Derived Resource Pools (v4.2 Canonical Architecture)**:
  - `Health` (Vitality + Fortitude + Intuition): Physical body integrity.
  - `Stamina` (Might + Reflex + Charm): Physical exertion, sprinting, and martial maneuvers.
  - `Composure` (Willpower + Awareness + Endurance): Mental resilience and morale.
  - `Focus` (Logic + Knowledge + Finesse): Tactical analysis and concentration.
- **4 Derived Senses & Static Guards**:
  - `Perception` (Awareness + Intuition + Finesse): Environmental alertness.
  - `Speed` (Reflex + Vitality + Logic): Tactical movement velocity (Dodge Guard = Math.floor(Speed/2) + 5).
  - `Stealth` (Knowledge + Charm + Endurance): Evasion and concealment.
  - `Balance` (Might + Fortitude + Willpower): Footing stability (Footing Guard = Math.floor(Balance/2) + 5).
- **Contested 1d12 Net Margin Mechanics (B.R.U.T.A.L. v4.9)**: Actions are resolved via `1d12 + Attribute + Modifiers` versus `Defender 1d12 + Stat + Mod` (or passive Guard). Net Margin determines injury tier: Graze (Margin 1), Minor (2-5: 2 capacity lost, 1 energy shredded), Major (6-9: 4 capacity lost, 2 energy shredded, bleed), Critical (10+: 6 capacity lost, 3 energy shredded, staggered). Nat 12 triggers Stars; Nat 1 triggers Scars. The Clash (Margin 0) resolves via the 6 combat stances (Press, Hold, Maneuver, Trick, Feint, Disengage). Magical healing requires bodily Stamina tradeoffs.
- **The Universal Tag Matrix (The Connective Tissue of Ostraka)**:
  - **The Physical Triad**: Every prop, obstacle, structure, and item carries three mandatory tag dimensions:
    - *Type*: `type:container`, `type:portal`, `type:furniture`, `type:workstation`, `type:mechanism`, `type:structure`, `type:hazard`, `type:waterway`, `type:weapon`, `type:armor`, `type:foliage`.
    - *Material*: `material:stone`, `material:iron`, `material:steel`, `material:osmium`, `material:wood_oak`, `material:wood_pine`, `material:obsidian`, `material:dragonstone`, `material:leather`, `material:cloth`, `material:glass`, `material:flesh`, `material:water`, `material:oil`.
    - *Affordances, Capabilities & States*: What it can do or have done to it (`climbable`, `openable`, `lockable`, `locked`, `flammable`, `fragile`, `conductive`, `buoyant`, `sharp`, `blunt`, `piercing`, `corrosive`, `illuminating`, `toxic`, `burning`, `wet`, `frozen`, `corroded`, `void_tainted`, `hallowed`).
  - **Citizen Persona & Status Tags**: Every NPC is tagged with authentic personality (`pious`, `greedy`, `cowardly`, `brave`, `cynical`, `loyal`, `rebellious`), temperament & instinct (`temper:*`, `instinct:*`, `motivation:*`), and dynamic condition (`starving`, `exhausted`, `injured`, `panicked`, `drunk`, `corrupted_by_void`, `mourning`, `celebrating`, `sheltered`, `alert`, `imprisoned`, `fugitive`).
  - **Simulated Event Tags & Data Collision Reactions (`narrativeReactionEngine.ts`)**: Macro and regional events emit tags (`#MartialLawCurfew`, `#FamineCrisis`, `#FullBloodStorm`, `#CultistWhisper`, `#DebtJubilee`, `#DragonSurge`) that collide directly with citizen tags in `narrativeReactionEngine.ts`, causing them to react naturally and systematically (rioting, hiding, praying, price-gouging, reporting heresy) without LLM hallucinations.
- **Headless Background Director (`backgroundDirector.ts`)**: Advances unobserved sectors during daily master simulation ticks, resolving pending tag collisions, mutating physical properties (e.g., boarded doors, closed smithies, ransacked grain exchanges), and injecting major aftermath milestones to `sim_events`.
- **Dynamic Rumor & Gossip Propagation**: Injected `sim_events` (`tier: 'MAJOR'`) automatically become the live gossip pool queried by barkeeps, caravan traders, and traveling bards across roadside taverns and adjacent burgs.

### Pillar 4: The AI Story Generator & Contextual Director (`directorBridge.ts`)
Powered by the Gemini API, this layer adds human-level soul to the math:
- **Contextual Assignment, Not Creation**: The AI never hallucinates fake map elements or generic NPCs. It receives real simulation data (famine, unrest, living paragons, and workplace facilities) and assigns dramatic narrative meaning to existing assets. For example, if `#Famine` and `#HighUnrest` collide, the AI does not spawn generic rioters—it identifies the real blacksmith and brewer in the sector to lead the bread riot against the real town reeve.
- **Connects Any Two Entities**: If a player talks to an impoverished baker who lives near an Otter Mafia hideout during a famine, the Story Generator connects those exact simulation variables into organic dialogue and emergent gossip.
- **Free-Speech Action Parser**: The player can type anything in natural plain English (e.g. *"I try to bribe the rampart sentry with 10 silver coins to let me sneak through the eastern gate"*), and the AI translates it into structured Concordia GM skill checks (`Roll: Opposed Charm vs Awareness, Cost: 10 Wealth`).
- **Event Chronicle**: When players defeat a cartel boss, smuggle grain to starving peasants, or trigger a magical anomaly, the story generator logs the result directly into `sim_events`, which alters the simulation tick.

---

## 3. Database Schema Overview (PostgreSQL)

| Table Name | Purpose |
|---|---|
| `sim_burg_economy` | Economic metrics, wealth, food, unrest, and urbanization tier for 352 burgs. |
| `population_demographics` | 207,000+ individual citizens with names, species, professions, and traits (12:1 ratio). |
| `sim_paragons` | 714 unique civic leaders, military commanders, and underworld crime lords. |
| `sim_fringe_lairs` | Active vice dens, black markets, and smuggler hideouts established by cartels. |
| `sim_sector_layers` | Cached 256x256 tactical maps for layers -1, 0, and +1 per cell. |
| `sim_events` | Chronicler table logging all world history, war declarations, and player exploits. |
| `sim_factions` | Grand geopolitical factions, sovereign borders, alliances, and utility AI states. |
| `sim_cells` | 10,000+ hexagonal map cells with biomes, elevation, moisture, and road masks. |

---

## 4. How to Run the Entire System

1. **Start the PostgreSQL Database**:
   ```pwsh
   postgres.exe -D "$env:USERPROFILE\scoop\persist\postgresql\data"
   ```
2. **Start the Simulation Server**:
   ```pwsh
   cd simulation-engine
   npm run build:server
   node dist/server.js
   # Server runs on http://127.0.0.1:3000
   ```
3. **Start the Observer Dashboard (Vite HMR)**:
   ```pwsh
   cd simulation-engine
   npm run observer
   # Observer opens on http://localhost:5174 (or http://localhost:3000/dashboard)
   ```
4. **Access the Observer Dashboard**:
   - Open `http://127.0.0.1:3000` in any browser to watch the live simulation tick and world map.

