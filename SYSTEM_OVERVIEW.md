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
     3. **The Independent GM Engine** (12 Concordia attributes, tag matrices, 1d20 mechanics).
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
|  - Opposed 1d20 Resolution                         - Narrative Drama & Organic Lore|
|  - Physical Tag Matrix Cascades                    - Connects Any Two Entities    |
|  - Pure Mechanical Execution (No Hallucinations)  - Feeds Events to `sim_events`  |
+-----------------------------------------------------------------------------------+
```

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

### Pillar 2: The Player Tactical Interface (`player-client/`)
The player interface is what the player sees on screen:
- **Port 5173 Client**: Built in React, Vite, and HTML5 Canvas.
- **Pure Visualizer**: It reads data from the simulation engine API (`GET /api/dm/sector_layer`). It **never** invents fake buildings, fake citizens, or fake terrain.
- **256x256 Tactical Grid**: High-resolution tactical space with seamless Zelda-style boundary crossing between adjacent hex cells.
- **3-Layer Vertical Sub-Maps**:
  - `Layer -1 (Subterranean)`: Wine cellars, storm drains, smuggler flues, cartel dens.
  - `Layer 0 (Surface)`: Streets, plazas, guildhouses, bakeries, forges, docks.
  - `Layer +1 (Upper)`: Ramparts, towers, second-floor lofts, catwalks, airship gantries.
- **Procedural Points of Entry (POEs)**: Doors, trapdoors, ladders, and cave mouths allow moving between layers and entering dungeons, crypts, and Grind Canyons.
- **Web Audio Synthesizer**: Procedural ambient audio, footsteps, combat cues, and wind soundscapes generated directly through the Web Audio API.

### Pillar 3: The Independent GM Engine (`ConcordiaGM.ts`)
The Game Master (GM) engine is a strict, mathematical referee:
- **12 Concordia Attributes**:
  - Physical: *Might, Endurance, Finesse, Reflex, Vitality, Fortitude*.
  - Mental: *Knowledge, Logic, Awareness, Intuition, Charm, Willpower*.
- **4 Derived Resource Pools**:
  - `Health` (Fortitude + Vitality): Physical body integrity.
  - `Stamina` (Endurance + Might): Athletic exertion and sprint endurance.
  - `Composure` (Willpower + Fortitude): Mental resilience under dread or intimidation.
  - `Focus` (Logic + Awareness): Concentration for complex skill checks or magic.
- **Contested 1d20 Mechanics**: Actions are resolved via `1d20 + Attribute + Modifiers` versus the defender's roll or a target difficulty. Margin of success determines exact injury or progress.
- **The Physical Tag Matrix**: Objects and environments have physical tags (`stone`, `wood`, `metal`, `fire`, `flammable`, `locked`, `container`). Actions cascade logically: applying `fire` to `flammable wood` generates `smoke` and damages structural integrity without the GM having to make up rules on the fly.

### Pillar 4: The AI Story Generator (Narrative Director)
Powered by the Gemini API, this layer adds human-level soul to the math:
- **Reads Real State**: The AI inspects the player's sector, current weather, burg unrest, active cartels, and nearby citizens.
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
3. **Start the Player Tactical Client**:
   ```pwsh
   cd player-client
   npm run dev
   # Tactical client opens on http://localhost:5173
   ```
4. **Access the Observer Dashboard**:
   - Open `http://127.0.0.1:3000` in any browser to watch the live simulation tick and world map.
