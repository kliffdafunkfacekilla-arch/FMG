# PROJECT AETHERIA: MASTER AGENT ORCHESTRATION DESIGN SHEET
## Blueprint for Autonomous Multi-Agent Development

---

### 1. EXECUTIVE DIRECTIVE & ORCHESTRATION OVERVIEW

**Target System**: Project Aetheria — 4-Tier Fractal World Simulation & TTRPG Game Engine  
**Primary Objective**: Enable a Lead Master Orchestrator AI Agent to coordinate six specialized sub-agents in building the entire full-stack software system from scratch without logical drift or human intervention.

This Master Design Sheet acts as the immutable system contract, specifying architectural boundaries, database DDLs, mathematical formulas, API endpoints, file structures, and task dependencies for the autonomous development team.

---

### 2. AGENT TEAM ROLES & DIVISION OF LABOR

```
                      ┌─────────────────────────────────────────┐
                      │    LEAD MASTER ORCHESTRATOR AGENT       │
                      │  (System Architecture & Task Scheduler) │
                      └────────────────────┬────────────────────┘
                                           │
         ┌───────────────────┬─────────────┴───────┬───────────────────┐
         │                   │                     │                   │
┌────────┴─────────┐ ┌───────┴──────────┐ ┌────────┴─────────┐ ┌────────┴─────────┐
│   AGENT ALPHA    │ │    AGENT BETA    │ │   AGENT GAMMA    │ │   AGENT DELTA    │
│  (Database & DB) │ │ (World Sim & Zoom)│ │ (Civ, Econ & Par)│ │(Rules & Character)│
└──────────────────┘ └──────────────────┘ └──────────────────┘ └──────────────────┘
         │                   │                     │                   │
         └───────────────────┼─────────────────────┴───────────────────┘
                             │
                  ┌──────────┴──────────┐ ┌────────────────────┐
                  │    AGENT EPSILON    │ │     AGENT ZETA     │
                  │ (AI DM & Tag Matrix)│ │ (Frontend VTT & UI)│
                  └─────────────────────┘ └────────────────────┘
```

#### 2.1 Lead Master Orchestrator Agent
* **Scope**: Dependency graph management, inter-agent integration testing, and file system synchronization.
* **Deliverable**: Automated build pipeline validation and error resolution.

#### 2.2 Agent Alpha — Database & Persistence Infrastructure
* **Scope**: PostgreSQL connection pool (`pool.ts`), DDL migrations across all 4 tiers, JSONB schemas, indexing, and temporal delta state tracking (`world_deltas`).
* **Core Modules**: `src/db/pool.ts`, `src/db/migrate.ts`, `src/db/seed.ts`.

#### 2.3 Agent Beta — World Simulation & Fractal Zoom Engine
* **Scope**: 20-face Icosahedral d20 global mesh generation, 12-to-1 chaos leyline topological network, 3x3 parent-child bicubic interpolation (Simplex noise/FBM), planetary solar/seasonal climate loops, and 4-part Lotka-Volterra trophic ecology.
* **Core Modules**: `src/engine/climateEngine.ts`, `src/engine/ecologyEngine.ts`, `src/engine/mathUtils.ts`, `src/api/streamingRouter.ts`.

#### 2.4 Agent Gamma — Civilization, Economics & Paragon Engine
* **Scope**: Concentric ring settlement expansion, carrying capacity calculations, industrial manufacturing conversion chains (raw materials to forged steel, refined lumber, potions), pairwise faction diplomacy matrices, and Paragon trait-skewing math clamping.
* **Core Modules**: `src/engine/economicEngine.ts`, `src/engine/cosmicEngine.ts`.

#### 2.5 Agent Delta — Rules Engine & Character Builder
* **Scope**: 12 core attributes (*Might, Endurance, Finesse, Reflex, Vitality, Fortitude, Knowledge, Logic, Awareness, Intuition, Charm, Willpower*), 4 derived pools (*Health, Stamina, Composure, Focus*), 6 creature types (*Mammal, Avian, Reptile, Insect, Aquatic, Plant*), size/ecological role classification, 30-piece gear catalog, 12 Magic Powers, 12 Null Alternatives, 24 class-flavored skill tracks, and social combat.
* **Core Modules**: `src/engine/rulesEngine.ts`, `src/engine/characterManager.ts`, `src/engine/creatureTaxonomy.ts`, `src/engine/gearCatalogExpanded.ts`, `src/engine/masterAbilityRegistry.ts`.

#### 2.6 Agent Epsilon — AI Dungeon Master, Story Engine & Universal Tag Architecture
* **Scope**: Integration with `@google/genai` (Gemini 2.5 Flash) for second-person narration and command parsing, Universal Tag Architecture (`tagRegistry.ts`, `universalInteraction.ts`), POI generation, emergent quest chaining, and sub-map interior generation.
* **Core Modules**: `src/engine/aiGameMaster.ts`, `src/engine/tagRegistry.ts`, `src/engine/universalInteraction.ts`, `src/engine/questChainEngine.ts`, `src/engine/subMapEngine.ts`, `src/api/dmRouter.ts`.

#### 2.7 Agent Zeta — Frontend VTT Client & Couch Co-Op UI
* **Scope**: React SPA (`App.tsx`), HTML5 Canvas battlemap renderer, 3-column HUD (Chat/Log ticker left, 5ft battlemap center, Character/Gear/Action stats right), Couch Co-Op local player turn switcher, Web Speech API (STT), and SpeechSynthesis (TTS).
* **Core Modules**: `src/client/App.tsx`, `src/client/VoiceCoOpWrapper.tsx`, `src/client/GameSessionHUD.tsx`, `public/index.html`.

---

### 3. PROJECT DIRECTORY STRUCTURE & REPOSITORY BLUEPRINT

```text
simulation-engine/
├── package.json
├── tsconfig.json
├── .env
├── public/
│   ├── index.html
│   └── dm_dashboard.html
└── src/
    ├── db/
    │   ├── pool.ts
    │   ├── migrate.ts
    │   └── seed.ts
    ├── engine/
    │   ├── mathUtils.ts
    │   ├── climateEngine.ts
    │   ├── ecologyEngine.ts
    │   ├── economicEngine.ts
    │   ├── cosmicEngine.ts
    │   ├── rulesEngine.ts
    │   ├── characterManager.ts
    │   ├── creatureTaxonomy.ts
    │   ├── gearCatalogExpanded.ts
    │   ├── powersAndSkillsRegistry.ts
    │   ├── masterAbilityRegistry.ts
    │   ├── tagRegistry.ts
    │   ├── universalInteraction.ts
    │   ├── poiGeneratorEngine.ts
    │   ├── questChainEngine.ts
    │   ├── aiGameMaster.ts
    │   └── subMapEngine.ts
    ├── api/
    │   ├── streamingRouter.ts
    │   ├── builderRouter.ts
    │   ├── dmToolkitRouter.ts
    │   └── dmRouter.ts
    ├── client/
    │   ├── App.tsx
    │   ├── VoiceCoOpWrapper.tsx
    │   └── GameSessionHUD.tsx
    └── server.ts
```

---

### 4. MASTER DATABASE SCHEMA (POSTGRESQL DDL)

Agent Alpha must execute the following DDL script verbatim:

```sql
-- =========================================================================
-- 0. ROOT METADATA & GLOBAL ENGINE STATE
-- =========================================================================
CREATE TABLE IF NOT EXISTS world_metadata (
    seed TEXT PRIMARY KEY,
    current_tick BIGINT NOT NULL DEFAULT 0,
    hours_per_day FLOAT NOT NULL DEFAULT 24.0,
    days_per_year INT NOT NULL DEFAULT 365,
    axial_tilt FLOAT NOT NULL DEFAULT 23.5,
    solar_distance_multiplier FLOAT NOT NULL DEFAULT 1.0,
    map_resolution INT NOT NULL DEFAULT 10000
);

-- =========================================================================
-- 1. TIER 4: GLOBAL SCALE (ICOSAHEDRAL D20 MESH)
-- =========================================================================
CREATE TABLE IF NOT EXISTS global_cells (
    cell_id INT PRIMARY KEY,
    seed TEXT REFERENCES world_metadata(seed) ON DELETE CASCADE,
    face_index INT NOT NULL, -- 0 to 19
    lat_lon JSONB NOT NULL, -- [latitude, longitude]
    elevation FLOAT NOT NULL, -- -1.0 to 1.0
    base_moisture FLOAT NOT NULL, -- 0.0 to 1.0
    base_weekly_temp FLOAT NOT NULL,
    temp_weekly_slope FLOAT NOT NULL,
    chaos_intensity FLOAT NOT NULL DEFAULT 0.0,
    chaos_vector JSONB NOT NULL, -- [dx, dy]
    reality_warp_index FLOAT NOT NULL DEFAULT 0.0
);

CREATE TABLE IF NOT EXISTS chaos_nodes (
    node_id INT PRIMARY KEY, -- 1 to 13 (12 sources, 1 sink)
    seed TEXT REFERENCES world_metadata(seed) ON DELETE CASCADE,
    node_type TEXT NOT NULL, -- 'source' or 'sink'
    cell_id INT NOT NULL REFERENCES global_cells(cell_id),
    coordinate JSONB NOT NULL
);

-- =========================================================================
-- 2. TIER 3: REGIONAL SCALE (10,000 CELLS PER GLOBAL CELL)
-- =========================================================================
CREATE TABLE IF NOT EXISTS regional_cells (
    regional_id SERIAL PRIMARY KEY,
    global_cell_id INT REFERENCES global_cells(cell_id) ON DELETE CASCADE,
    local_x INT NOT NULL, -- 0 to 99
    local_y INT NOT NULL, -- 0 to 99
    elevation FLOAT NOT NULL,
    moisture FLOAT NOT NULL,
    temperature FLOAT NOT NULL,
    biome_id INT NOT NULL,
    chaos_intensity FLOAT NOT NULL DEFAULT 0.0
);

-- =========================================================================
-- 3. TIER 2: LOCAL SCALE (10,000 CELLS PER REGIONAL CELL)
-- =========================================================================
CREATE TABLE IF NOT EXISTS local_cells (
    local_id SERIAL PRIMARY KEY,
    regional_id INT REFERENCES regional_cells(regional_id) ON DELETE CASCADE,
    local_x INT NOT NULL, -- 0 to 99
    local_y INT NOT NULL, -- 0 to 99
    elevation FLOAT NOT NULL,
    ecological_vector JSONB NOT NULL, -- {plants, prey, predators, resources}
    settlement_id INT NULL,
    infrastructure_type TEXT NOT NULL DEFAULT 'NONE'
);

-- =========================================================================
-- 4. TIER 1: GROUND LEVEL (100x100 BATTLEMAP SPACES = 5FT SQUARES)
-- =========================================================================
CREATE TABLE IF NOT EXISTS ground_grid_squares (
    square_id SERIAL PRIMARY KEY,
    local_id INT REFERENCES local_cells(local_id) ON DELETE CASCADE,
    grid_x INT NOT NULL, -- 0 to 99 (5ft units)
    grid_y INT NOT NULL, -- 0 to 99 (5ft units)
    terrain_type TEXT NOT NULL DEFAULT 'OPEN',
    cover_value INT DEFAULT 0, -- 0: None, 1: Half, 2: Full
    occupant_entity_id INT NULL
);

-- =========================================================================
-- 5. CIVILIZATION, FACTIONS, AND PARAGONS
-- =========================================================================
CREATE TABLE IF NOT EXISTS factions (
    faction_id SERIAL PRIMARY KEY,
    seed TEXT REFERENCES world_metadata(seed) ON DELETE CASCADE,
    name TEXT NOT NULL,
    leader_name TEXT NOT NULL,
    color TEXT NOT NULL,
    treasury NUMERIC(12,2) DEFAULT 1000.00,
    stability FLOAT DEFAULT 100.0,
    expansionism FLOAT DEFAULT 1.0,
    military_strength INT DEFAULT 500
);

CREATE TABLE IF NOT EXISTS settlements (
    settlement_id INT PRIMARY KEY,
    seed TEXT REFERENCES world_metadata(seed) ON DELETE CASCADE,
    faction_id INT REFERENCES factions(faction_id),
    name TEXT NOT NULL,
    global_cell_id INT REFERENCES global_cells(cell_id),
    population INT NOT NULL,
    is_capital BOOLEAN DEFAULT FALSE,
    defense_rating INT DEFAULT 10,
    market_inventory JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS population_demographics (
    citizen_id SERIAL PRIMARY KEY,
    settlement_id INT REFERENCES settlements(settlement_id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    is_null BOOLEAN NOT NULL, -- TRUE: Null, FALSE: Attuned
    attunement_level FLOAT DEFAULT 0.0,
    chaos_attraction_index FLOAT DEFAULT 0.0
);

CREATE TABLE IF NOT EXISTS paragons (
    paragon_id SERIAL PRIMARY KEY,
    settlement_id INT REFERENCES settlements(settlement_id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    name TEXT NOT NULL,
    traits JSONB NOT NULL,
    corruption_score FLOAT DEFAULT 0.0
);

CREATE TABLE IF NOT EXISTS industrial_stockpiles (
    settlement_id INT PRIMARY KEY REFERENCES settlements(settlement_id) ON DELETE CASCADE,
    refined_lumber INT DEFAULT 0,
    forged_steel INT DEFAULT 0,
    alchemical_potions INT DEFAULT 0,
    textiles INT DEFAULT 0,
    food_reserves INT DEFAULT 0
);

-- =========================================================================
-- 6. NARRATIVE, LORE & INTERIOR SUB-MAPS
-- =========================================================================
CREATE TABLE IF NOT EXISTS world_lore (
    lore_id SERIAL PRIMARY KEY,
    seed TEXT REFERENCES world_metadata(seed) ON DELETE CASCADE,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    content TEXT NOT NULL,
    associated_cell_id INT NULL
);

CREATE TABLE IF NOT EXISTS campaign_event_logs (
    event_id SERIAL PRIMARY KEY,
    seed TEXT REFERENCES world_metadata(seed) ON DELETE CASCADE,
    tick INT NOT NULL,
    event_type TEXT NOT NULL,
    headline TEXT NOT NULL,
    description TEXT NOT NULL,
    target_settlement_id INT NULL
);

CREATE TABLE IF NOT EXISTS interior_sub_maps (
    sub_map_id SERIAL PRIMARY KEY,
    local_id INT REFERENCES local_cells(local_id) ON DELETE CASCADE,
    map_type TEXT NOT NULL,
    grid_width INT NOT NULL,
    grid_height INT NOT NULL,
    layout_data JSONB NOT NULL
);

-- =========================================================================
-- 7. DELTA-STATE TEMPORAL STORAGE
-- =========================================================================
CREATE TABLE IF NOT EXISTS world_deltas (
    delta_id SERIAL PRIMARY KEY,
    seed TEXT REFERENCES world_metadata(seed) ON DELETE CASCADE,
    tier_level INT NOT NULL,
    target_cell_id INT NOT NULL,
    local_coordinate JSONB NOT NULL,
    alteration_type TEXT NOT NULL,
    initial_timestamp BIGINT NOT NULL,
    payload JSONB NOT NULL
);
```

---

### 5. SYSTEM MATHEMATICS & ALGORITHMIC FORMULAS

#### 5.1 Solar Declination & Insolation Math (Agent Beta)
$$\delta = -\text{axial\_tilt} \times \cos\left(\frac{2\pi \times (\text{DOY} + 10)}{\text{days\_per\_year}}\right)$$
$$I = \sin(\phi) \times \sin(\delta) + \cos(\phi) \times \cos(\delta)$$

#### 5.2 Population Carrying Capacity & Famine Attrition (Agent Gamma)
$$K = (\text{LocalFoodProduction} + \text{ImportedFood}) \times \text{HousingModifier}$$
$$\text{NetGrowthRate} = \text{BaseGrowthRate} + (\text{FoodSurplus} \times 0.02) - (\text{ChaosIntensity} \times 0.05)$$

#### 5.3 Paragon Trait-Skewing Multiplier (Agent Gamma)
$$\text{EffectiveOutput} = \text{BaseMathOutput} \times \left(1.0 + \sum \text{Paragon.traits.modifier}\right)$$

#### 5.4 Creature Archetype Stat Modifiers (Agent Delta)
Baseline = 2 across all 12 attributes (*Might, Endurance, Finesse, Reflex, Vitality, Fortitude, Knowledge, Logic, Awareness, Intuition, Charm, Willpower*).
* **Mammal**: Might +1, Endurance -1, Finesse +2, Reflex 0, Vitality 0, Fortitude -2
* **Avian**: Might -1, Endurance -2, Finesse 0, Reflex +2, Vitality 0, Fortitude +1
* **Reptile**: Might +2, Endurance +2, Finesse -2, Reflex -1, Vitality +1, Fortitude -1
* **Insect**: Might -2, Endurance +1, Finesse +1, Reflex +1, Vitality -2, Fortitude 0
* **Aquatic**: Might +1, Endurance 0, Finesse -1, Reflex -2, Vitality -1, Fortitude 0
* **Plant**: Might -2, Endurance +2, Finesse -1, Reflex -2, Vitality +2, Fortitude 0

---

### 6. SEQUENTIAL BUILD & EXECUTION PHASES

```
PHASE 1: DB Infrastructure (Agent Alpha) ──► Connection Pool & DDL Schema Migrations
                                                     │
PHASE 2: World Sim & Zoom (Agent Beta)    ──► D20 Mesh, Chaos Lines & Bicubic Sub-Grids
                                                     │
PHASE 3: Econ & Paragon (Agent Gamma)     ──► Resource Chains, Famines & Trait Math
                                                     │
PHASE 4: Rules & Character (Agent Delta)  ──► 12 Stats, Creature Types & 30 Gear Items
                                                     │
PHASE 5: AI DM & Tags (Agent Epsilon)     ──► Gemini 2.5 API, ECT Tags & Quest Chains
                                                     │
PHASE 6: Frontend VTT (Agent Zeta)        ──► React HUD, HTML5 Battlemap, STT/TTS
```

1. **Phase 1 (Agent Alpha)**: Run `ts-node src/db/migrate.ts` to instantiate PostgreSQL tables.
2. **Phase 2 (Agent Beta)**: Implement d20 mesh generator and 3x3 sliding window streaming API (`/api/world/stream`).
3. **Phase 3 (Agent Gamma)**: Build monthly economic ticks, manufacturing recipes, and Paragon math clamping.
4. **Phase 4 (Agent Delta)**: Build character creation REST API (`/api/builder/*`), creature taxonomy router, and social combat engine.
5. **Phase 5 (Agent Epsilon)**: Build AI DM middleware (`/api/dm/interact`), Universal Tag Architecture, and quest generator.
6. **Phase 6 (Agent Zeta)**: Compile React VTT SPA, connect HTML5 Canvas rendering loops, and enable Speech-to-Text and Text-to-Speech handlers.

---

### 7. VERIFICATION & ACCEPTANCE CRITERIA

* **Database Persistence**: Zero database bloat verified via `world_deltas` temporal decay checks.
* **Mathematical Continuity**: Smooth 3x3 boundary clamping across Tier 4 to Tier 1 sub-grids.
* **Rules Engine Accuracy**: All 30 gear items and 48 powers/skills calculate correct resource costs against Focus/Stamina pools.
* **AI DM Pipeline**: LLM produces valid JSON payloads containing second-person narration and structured rules engine commands.
* **UI Responsiveness**: 60fps HTML5 Canvas rendering with mouse panning, zooming, Couch Co-Op player switching, and STT microphone recording.
