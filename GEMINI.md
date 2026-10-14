# AI Agent & Gemini Development Guidelines: FMG Rebuild & Aetheria Simulation

Welcome! You are working on the high-performance full-stack rebuild of the Fantasy Map Generator (FMG), currently executing the "Aetheria" 8-Layer Agentic Fractal Simulation. Your primary goal is to ensure exact feature replication, high performance, and extreme modularity.

## Core Architectural Rules

1. **Strict Separation of Simulation & View:**
   * **Simulation Modules** MUST be pure functions. They take states/inputs and return computed data. They must NEVER manipulate the DOM, SVG, canvas, or import any UI-related state.
   * **The Renderer** (WebGL/Canvas) is a read-only visualizer of the current State. It must NEVER mutate map data.
2. **Centralized Data Store:**
   * All shared states live in a single centralized store or PostgreSQL database.
   * UI components and the renderer subscribe to specific state slices to avoid unnecessary re-renders.
3. **Backwards Compatibility:**
   * Any change to data structures must maintain support for serialization/deserialization of existing FMG `.map` files.
4. **Performance Targets:**
   * Re-rendering should maintain 60 FPS during zoom/pan operations.
   * Large compute pipelines must run asynchronously (in Web Workers or on the backend) to prevent UI thread blocking.
   * Database loops must use Bulk Queries and Accumulators, avoiding O(n) sequential row writes.

## Guardrails for Code Changes
* Do not introduce heavy runtime dependencies unless approved.
* Always prioritize array-based data layouts (Structure of Arrays) over object-oriented graphs for coordinate simulation logic to optimize CPU caches.
* Double quotes and semicolons are required in TS/JS files.

---

# AETHERIA SIMULATION MECHANICS & DESIGN

The backend simulation is driven by an 8-Layer Agentic architecture executed sequentially by `masterOrchestrator.ts`. The simulation runs on a master "Tick" equivalent to **exactly one in-game day (1 Tick = 1 Day)**.

## 1. Cosmology & Weather (The Base Layer)
*   **Calendar Agent**: Tracks Years, Months, Days, Seasons, and the Lunar/Cosmic cycle across Ostraka's **541-Day Year**:
    *   **12 Dragon Months (44 Days each = 528 Days)**: Each month is aligned with one of the 12 Chaos Dragons and Elemental Powers: Tiraton (Mass), Carulkem (Nexus), Stagus (Ordo), Tyrustis (Lex), Vecelo (Motus), Aurgenas (Flux), Gavusrix (Vita), Metrion (Ratio), Opecten (Lux), Termhill (Omen), Virantor (Aura), and Lophex (Anumis).
    *   **Month 13: "Shadow Week" (13-Day Intercalary Eclipse, Days 529–541)**: Cruorbus passes into perfect alignment with the sun, causing a total solar eclipse for thirteen days. Ambient chaos calms while the 12 Dragon Seals weaken, spiking cult activity.
    *   **8 Seasons (66 Days each)**: The Bloom, The High Sun, The Harvest, The Withering, The Deep Cold, The Thaw, The Awakening, The Roaring.
    *   **5 Lunar Phases of Cruorbus (44-day cycle)**: The Empty Eye (Days 1–9), The Waxing Blood (Days 10–18), The Full Blood (Days 19–27), The Mercy Alignment (Days 28–36), and The Nightmare Alignment (Days 37–44).
*   **Weather Agent**: Processes planetary temperature and precipitation mapped across a hexagonal coordinate grid. This influences biome growth and ecological health.

## 2. Burg Operations (Economy, Logistics, & Population)
*   **Population Scaling**: 
    *   Populations are organized strictly into "Groups of 12" workers.
    *   Burgs scale through Urbanization Tiers: Village (< 1,200 pop), Town (< 12,000 pop), City (> 12,000 pop).
*   **3-Tiered Crafting Economy**: 
    *   *Raw Resources* (Wood, Ore, Herbs, Fiber) are gathered by base workers.
    *   *Refined Resources* (Lumber, Steel, Textiles, Potions) are processed.
    *   *Complex Inventories* are generated for trade.
*   **Military Upkeep**: 
    *   Military forces require base Food equal to their population equivalent (e.g., Infantry = 100 pop, Mages = 1200 pop).
    *   Units require specific material maintenance: Infantry (Leather/Metal), Ranged (Wood/Blackstone), Mounted (Mounts), Airships (Dragonstone), Mages (Reagents/Wine). Starvation forces Martial Law and unrest.

## 3. The Underworld (Cartels & Fringe Factions)
*   **Manpower Leeching**: Syndicates and Cartels actively siphon `pop_null` (disenfranchised peasants) from high-`unrest` burgs to grow their `manpower`.
*   **Establishing Lairs**: When a cartel exceeds 200 Manpower and 500 Wealth, it establishes a `VICE_DEN` or `BLACK_MARKET` in a burg to extract wealth and generate crime.
*   **Turf Wars**: If two cartels attempt to establish the same type of lair in the same burg, a Turf War erupts. The conflict is resolved by comparing cartel manpower; the loser suffers heavy casualties and their lair is deleted.

## 4. Faction Geopolitics (Utility AI Engine)
*   **Staggered Turns (Bureaucracy)**: Factions only evaluate grand strategy periodically (`tick % 10`) to prevent decision spam and allow the economy to breathe.
*   **Utility AI Matrix**: Replaced rigid `if/else` trees. Every valid geopolitical action (over 40 highly granular options like *Declare Golden Age, Trade Embargo, Arrange Royal Marriage, Fabricate Casus Belli*) is evaluated against the faction's current state (Wealth, Military, Traits). The highest scoring action (0-100) is executed.
*   **1d100 Combat Resolution**: Armies resolve conflicts via straightforward 1d100 dice rolls factoring in unit strengths, weaknesses, and structural limits. Losing units suffer specific casualty subtraction.

## 5. Cosmic & Metaphysical Actors
*   **Local Paragons**: Unique agents (heroes, villains, master merchants) operating in specific burgs, applying local trait modifiers (e.g., Corrupt, Pacifist).
*   **Wardens vs. Cultists**: Global metaphysical entities fighting a cosmic shadow war. Wardens attempt to stabilize the world and protect nature, while Cultists gather power, sacrifice resources, and invoke dark cosmic forces.

## 6. The Chronicler (Data & Output)
*   **Event Logging**: All major actions across the 8 layers are injected into `sim_events` (Major, Minor, Background tiers).
*   **Observer & Teller API**: The frontend React dashboard repeatedly polls the Observer API (`/api/observer/tick` and `/api/observer/state`), rendering the geopolitical, economic, and ecological map in real-time.
## 7. Current Project Architecture & Layout
The project is split into a PostgreSQL-backed Node.js backend (`simulation-engine`) and a React/Vite frontend.

### Backend (`simulation-engine/src/`)
*   **`server.ts`**: Express entry point. Hosts APIs, runs the background `setInterval` simulation loop.
*   **`db/pool.ts`**: PostgreSQL connection pool configuration.
*   **`engine/masterOrchestrator.ts`**: The heart of the simulation. Executes the master tick sequentially.
*   **`engine/resetWorld.ts`**: Hard reset script. Wipes the DB, recreates schemas, and syncs baseline data from Okasha.json/sqlite.
*   **`engine/agents/`**: Contains the modular 8-layer sub-systems:
    *   `weatherAgent.ts`: Drives weather fronts and lunar alignments.
    *   `burgOperationsAgent.ts`: Populates, feeds, and processes wealth/unrest loops for every burg using bulk DB queries.
    *   `burgExpansionAgent.ts`: Allows rich, stable factions to organically colonize the map.
    *   `factionPlanningAgent.ts`: Prepares macroscopic state variables (Aggression, Perceived Economy, etc.) for utility AI.
    *   `cartelAgent.ts` & `cultistAgent.ts` & `wardenAgent.ts`: Fringe faction background systems.
*   **`engine/ai/factionActions.ts`**: The repository of all Faction AI behaviors (`SUE_FOR_PEACE`, `DECLARE_WAR`, `COMMISSION_WORLD_WONDER`).
*   **`api/observerRouter.ts`**: Frontend-facing endpoints (`/map` to get geometry, `/state` to poll live tick variables).

### Frontend (`simulation-engine/src/observer/`)
*   **`main.tsx`**: React DOM entry.
*   **`Dashboard.tsx`**: The main live observer dashboard. Handles live polling, the MapCanvas WebGL/2D renderer, and the Event Stream.

### Player Tactical Client (`player-client/src/`)
*   **`App.tsx`**: Tactical 256x256 battlegrid, overworld border crossing, Character HUD, and Sector Survey & Telemetry HUD.
*   **`audio/AudioManager.ts`**: Web Audio API synthesizer for ambient exploration, battle tracks, footsteps, and tactical SFX.

---

# TTRPG & TACTICAL RPG RULES: CONCORDIA & EMERGENCE

## 1. Anti-Railroading & Simulation-Driven Encounters
* **Never Hardcode Canned Quests or Encounters:** Encounters MUST NEVER be built using rigid switch-case quest chains (e.g., forcing a player to smash a blood altar, kill a specific cultist, or follow a 5-step checklist).
* **Pure Simulation Emergence:** All tactical entities (wildlife, wayfarers, patrols, outlaws) and landmarks MUST be synthesized directly from live simulation variables:
  * **Real Agents from `RegionalInstance`:** Roaming `Predator`, `Prey`, `Merchant`, `Patrol`, `Smuggler`, `Bandit`, and `Cannibal` agents dynamically instantiate into biome-specific fauna and NPCs with realistic 12-stat affinities and equipment.
  * **Trophic Ecology:** Each of the 13 biomes dictates native predators (e.g. Bog Stalker, Briar Bear, Dune Scythe-Beetle), grazing wild game (e.g. Marsh Elk, Tundra Caribou), and forageable flora.
  * **Real Infrastructure Masks:** Highways (`mask & 2`), Smuggler Routes (`mask & 4`), Ruins/Temples (`mask & 8/16`), Battlefields (`mask & 128`), and Refugee Camps (`mask & 32/64`) determine the presence of milestones, caches, sarcophagi, and barricades.
  * **Living World Modifiers:** Burg famine spawns starving raiders; active faction war manifests vanguard skirmishers; chaos radiation creates eldritch anomalies.

## 2. Sandbox Player Agency
* The player is an explorer in an open-world simulation, never constrained by mandatory chore checklists.
* Players are free to explore anywhere on the 256x256 grid, cross boundaries into adjacent sectors (Zelda-style regional border transitions), hunt wildlife, forage, trade with caravans, study ancient megaliths, or avoid combat completely.
* The sidebar is a **Sector Survey & Telemetry HUD** displaying coordinates, biome, sovereignty, detected roaming life (click to target), and discovered landmarks—NEVER a restrictive quest gate.

## 3. Concordia GM & 12-Stat Tag Matrix Engine
* **12 Attributes:** Might, Endurance, Finesse, Reflex, Vitality, Fortitude, Knowledge, Logic, Awareness, Intuition, Charm, Willpower.
* **Opposed 1d20 Resolution:** Rolls compare Attacker 1d20 + Stat + Mod vs. Defender 1d20 + Stat + Mod. Injury points scale dynamically based on the margin of success.
* **Tag Matrix:** Environmental and physical interactions are governed by physical tags (`stone`, `wood`, `metal`, `fire`, `flammable`, `container`, `locked`, `beast`, `organic`). Actions cascade naturally through the tag system without hallucinations.

