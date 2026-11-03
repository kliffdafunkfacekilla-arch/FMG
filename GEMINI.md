# AI Agent & Gemini Development Guidelines: FMG Rebuild & Aetheria Simulation

Welcome! You are working on the high-performance full-stack rebuild of the Fantasy Map Generator (FMG), currently executing the "Aetheria" 8-Layer Agentic Fractal Simulation. Your primary goal is to ensure exact feature replication, high performance, and extreme modularity across all four architectural pillars.

---

# THE 4-PILLAR ARCHITECTURE

The entire system is strictly partitioned into four autonomous, collaborating pillars:

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

### Pillar 1: The Simulation Engine (Independent Macro & Meso State)
* Runs independently as a backend process (`simulation-engine/`).
* Central source of truth is PostgreSQL (`sim_burg_economy`, `population_demographics`, `sim_paragons`, `sim_fringe_lairs`, `sim_sector_layers`, `sim_events`).
* Advanced by a master tick (`1 Tick = 1 Day`).
* Population is organized into a strict **12-to-1 ratio** (`unit_size = 12`) in `population_demographics` (expanded Paragon system).
* Military units (`military_forces`) are structured strictly into units of 12 combatants with rendering data.
* Underworld syndicates (Obsidian Cartel, Otter Mafia, Ghostwind Raiders, Sky-Barons, Grind Canyon Corps, Hedge Wizards) siphon unrest and build subterranean lairs.

### Pillar 2: The Player Interface (Tactical 256x256 View)
* Runs in the browser on port 5173 (`player-client/`).
* A **pure read-only visual projection** of the live simulation state. It must **NEVER** hallucinate or invent fake map elements unbacked by the simulation or database.
* Features a 256x256 tactical tile grid with seamless border crossing into adjacent hexagonal cells (Zelda-style regional border transitions).
* Supports 3-layer vertical navigation:
  - `Layer -1`: Subterranean (cellars, sewer networks, underworld vice dens, smuggler flues).
  - `Layer 0`: Surface ground level (streets, market stalls, guildhalls, docks, gates).
  - `Layer +1`: Upper level (ramparts, catwalks, second-story lofts, watchtowers, sky-bridges).
* Procedural Points of Entry (POEs) open sub-maps for crypts, dungeons, ruins, and Grind Canyons based on simulation seeds.

### Pillar 3: The Independent GM Engine (Mechanical Arbiter)
* Deterministic rules engine (`ConcordiaGM.ts`, `TagMatrixEngine.ts`, `RulesEngine.ts`).
* 12 Attributes: Might, Endurance, Finesse, Reflex, Vitality, Fortitude, Knowledge, Logic, Awareness, Intuition, Charm, Willpower.
* 4 Derived Pools: Health, Stamina, Composure, Focus.
* Opposed 1d20 resolution: `Attacker 1d20 + Stat + Mod` vs `Defender 1d20 + Stat + Mod`.
* Tag Matrix: Environmental and physical interactions cascade deterministically through physical tags (`stone`, `wood`, `metal`, `fire`, `flammable`, `container`, `locked`, `beast`, `organic`).
* Pure mechanical calculation with zero AI hallucination.

### Pillar 4: The AI Story Generator (Narrative Weaver)
* Gemini-powered narrative engine that reads simulation state and player history to weave emergent drama and natural dialogue.
* Translates free-speech natural language actions into structured GM commands.
* Adapts dynamically to connect any two world entities into organic lore (e.g. connecting a displaced weaver to an Otter Mafia smuggler).
* Logs major player impacts back into `sim_events`.

---

# CORE ARCHITECTURAL RULES

1. **Strict Separation of Simulation & View:**
   * **Simulation Modules** MUST be pure functions. They take states/inputs and return computed data. They must NEVER manipulate the DOM, SVG, canvas, or import any UI-related state.
   * **The Renderer** (WebGL/Canvas) is a read-only visualizer of the current State. It must NEVER mutate map data directly.
2. **Centralized Data Store:**
   * All shared states live in a single centralized PostgreSQL database.
   * UI components and the renderer subscribe to specific state slices to avoid unnecessary re-renders.
3. **Lineage & Backwards Compatibility:**
   * The project originated as a lean Python/FastAPI rebuild of Azgaar's Fantasy Map Generator (`fmg-rebuild`), generating `Okasha.map` (12.7 MB) and `Okasha.json` (35.2 MB).
   * Any change to data structures must maintain compatibility with existing FMG `.map` / `.json` imports and DB seeds.
4. **Performance Targets:**
   * Re-rendering should maintain 60 FPS during zoom/pan operations.
   * Large compute pipelines must run asynchronously to prevent UI thread blocking.
   * Database loops must use Bulk Queries and Accumulators, avoiding O(n) sequential row writes.
5. **Zero Generic Spawns:**
   * Generic placeholder NPCs are strictly forbidden.
   * Every spawned humanoid must be an authentic citizen from `population_demographics`, a military detachment of 12 from `military_forces`, or an authentic Paragon from `sim_paragons` (714 active paragons: Mayors, Commanders, Syndicate Bosses).
   * Monsters and beasts are synthesized strictly from live biome trophic ecology.
6. **Documentation Mandate:**
   * Keep memory and plain-word documentation updated in every directory (`GEMINI.md`, `SYSTEM_OVERVIEW.md`, `simulation-engine/README.md`, `player-client/README.md`) after completing major tasks so any developer can understand the full architecture.

---

# AETHERIA SIMULATION MECHANICS & DESIGN

The backend simulation is driven by an 8-Layer Agentic architecture executed sequentially by `masterOrchestrator.ts`. The simulation runs on a master "Tick" equivalent to **exactly one in-game day (1 Tick = 1 Day)**.

## 1. Cosmology & Weather (The Base Layer)
*   **Calendar Agent**: Tracks Years, Months, Days, Seasons, and the Lunar/Cosmic cycle across Ostraka's **541-Day Year**:
    *   **12 Dragon Months (44 Days each = 528 Days)**: Aligned with the 12 Chaos Dragons: Tiraton (Mass), Carulkem (Nexus), Stagus (Ordo), Tyrustis (Lex), Vecelo (Motus), Aurgenas (Flux), Gavusrix (Vita), Metrion (Ratio), Opecten (Lux), Termhill (Omen), Virantor (Aura), and Lophex (Anumis).
    *   **Month 13: "Shadow Week" (13-Day Intercalary Eclipse, Days 529–541)**: Cruorbus passes into perfect solar alignment. Ambient chaos calms while the 12 Dragon Seals weaken, spiking cult activity.
    *   **8 Seasons (66 Days each)**: The Bloom, The High Sun, The Harvest, The Withering, The Deep Cold, The Thaw, The Awakening, The Roaring.
    *   **5 Lunar Phases of Cruorbus (44-day cycle)**: The Empty Eye (Days 1–9), The Waxing Blood (Days 10–18), The Full Blood (Days 19–27), The Mercy Alignment (Days 28–36), and The Nightmare Alignment (Days 37–44).
*   **Weather Agent**: Processes planetary temperature and precipitation mapped across a hexagonal coordinate grid. This influences biome growth and ecological health.

## 2. Burg Operations (Economy, Logistics, & Population)
*   **Population Scaling**: Populations are organized strictly into "Groups of 12" workers (12:1 ratio). Burgs scale through Urbanization Tiers: Village (< 1,200 pop), Town (< 12,000 pop), City (> 12,000 pop).
*   **3-Tiered Crafting Economy**: 
    *   *Raw Resources* (Wood, Ore, Herbs, Fiber) gathered by base workers.
    *   *Refined Resources* (Lumber, Steel, Textiles, Potions) processed.
    *   *Complex Inventories* generated for regional trade.
*   **Military Upkeep**: Military forces require base Food equal to their population equivalent (e.g. Infantry = 100 pop, Mages = 1200 pop). Units require specific maintenance: Infantry (Leather/Metal), Ranged (Wood/Blackstone), Mounted (Mounts), Airships (Dragonstone), Mages (Reagents/Wine). Starvation forces Martial Law and unrest.

## 3. The Underworld (Cartels & Fringe Factions)
*   **The 5 Fringes & Criminal Syndicates**: The Obsidian Cartel, The Otter Mafia, The Ghostwind Raiders, The Free Sky-Barons, The Gilded Compass, and the Ivory Fleet operate independent shadow economies.
*   **Manpower Leeching**: Cartels siphon `pop_null` (disenfranchised peasants) from high-`unrest` burgs to grow their `manpower`.
*   **Establishing Lairs**: When a cartel exceeds 200 Manpower and 500 Wealth, it establishes a `VICE_DEN` or `BLACK_MARKET` in a burg to extract wealth and generate crime.
*   **Grind Canyon Corps**: Deep chasms that open unpredictably in the wilderness containing eldritch ruins and dragonstone; adventurous crews dive for treasure before the chasms close.
*   **Hedge Wizards**: Unsanctioned magical practitioners supplying contraband charms and elixirs outside academic/guild authority.

## 4. Faction Geopolitics (Utility AI Engine)
*   **Staggered Turns (Bureaucracy)**: Factions evaluate grand strategy periodically (`tick % 10`) to prevent decision spam.
*   **Utility AI Matrix**: Every valid geopolitical action (over 40 options like *Declare Golden Age, Trade Embargo, Arrange Royal Marriage, Fabricate Casus Belli*) is evaluated against faction state (Wealth, Military, Traits).
*   **1d100 Combat Resolution**: Macro armies resolve conflicts via 1d100 rolls factoring in unit strengths, terrain, and supply lines.

## 5. Cosmic & Metaphysical Actors
*   **714 Local Paragons**: Unique individuals across all 352 burgs (Civic Mayors/Reeves, Security Commanders/Marshals, and Underworld Syndicate Bosses) applying localized trait multipliers.
*   **Wardens vs. Cultists**: Global metaphysical entities fighting a cosmic shadow war. Wardens stabilize the world and protect nature; Cultists sacrifice resources to weaken the 12 Dragon Seals.

## 6. The Chronicler (Data & Output)
*   **Event Logging**: All major actions across all layers are injected into `sim_events` (Major, Minor, Background tiers).
*   **Observer & Teller API**: Live endpoints (`/api/observer/tick`, `/api/observer/state`, `/api/dm/sector_layer`) serve the frontend.
