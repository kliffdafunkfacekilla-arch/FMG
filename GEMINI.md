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

The backend simulation is driven by an 8-Layer Agentic architecture executed sequentially by `masterOrchestrator.ts`. The simulation runs on a master "Tick" equivalent to roughly one in-game week.

## 1. Cosmology & Weather (The Base Layer)
*   **Calendar Agent**: Tracks Years, Months, Days, Seasons, and the Lunar/Cosmic cycle (e.g., the phases of the blood moon Cruorbus).
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
