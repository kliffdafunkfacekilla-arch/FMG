import pool from "./pool";

const DDL = `
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
    parent_cell_id INT,
    parent_rx INT DEFAULT 112,
    parent_ry INT DEFAULT 112,
    parent_prop_id VARCHAR(150),
    interior_type VARCHAR(64),
    name VARCHAR(150),
    grid_width INT NOT NULL DEFAULT 256,
    grid_height INT NOT NULL DEFAULT 256,
    grid_data BYTEA,
    props JSONB DEFAULT '[]'::jsonb,
    npcs JSONB DEFAULT '[]'::jsonb,
    map_type TEXT NULL,
    layout_data JSONB NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_interior_sub_maps_parent ON interior_sub_maps(parent_cell_id, parent_prop_id);

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

-- =========================================================================
-- 8. GAME SESSIONS & PLAYER CHARACTERS
-- =========================================================================
CREATE TABLE IF NOT EXISTS game_sessions (
    session_id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    current_sub_map_id INT NULL REFERENCES interior_sub_maps(sub_map_id),
    chaos_level TEXT DEFAULT 'Stable',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS player_characters (
    character_id SERIAL PRIMARY KEY,
    session_id INT REFERENCES game_sessions(session_id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'Attuned' or 'Null'
    creature_type TEXT NOT NULL,
    
    -- 12 Constants
    might INT NOT NULL DEFAULT 10,
    endurance INT NOT NULL DEFAULT 10,
    finesse INT NOT NULL DEFAULT 10,
    reflex INT NOT NULL DEFAULT 10,
    vitality INT NOT NULL DEFAULT 10,
    fortitude INT NOT NULL DEFAULT 10,
    knowledge INT NOT NULL DEFAULT 10,
    logic INT NOT NULL DEFAULT 10,
    awareness INT NOT NULL DEFAULT 10,
    intuition INT NOT NULL DEFAULT 10,
    charm INT NOT NULL DEFAULT 10,
    willpower INT NOT NULL DEFAULT 10,

    -- Derived Pools (Current / Max)
    health_current INT NOT NULL DEFAULT 100,
    health_max INT NOT NULL DEFAULT 100,
    stamina_current INT NOT NULL DEFAULT 50,
    stamina_max INT NOT NULL DEFAULT 50,
    composure_current INT NOT NULL DEFAULT 40,
    composure_max INT NOT NULL DEFAULT 40,
    focus_current INT NOT NULL DEFAULT 60,
    focus_max INT NOT NULL DEFAULT 60,

    -- Map Positioning
    grid_x INT NOT NULL DEFAULT 0,
    grid_y INT NOT NULL DEFAULT 0
);

-- =========================================================================
-- 9. INVENTORY & TIME
-- =========================================================================
CREATE TABLE IF NOT EXISTS items (
    item_id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    damage TEXT,
    description TEXT
);

CREATE TABLE IF NOT EXISTS character_inventory (
    inventory_id SERIAL PRIMARY KEY,
    character_id INT REFERENCES player_characters(character_id) ON DELETE CASCADE,
    item_id INT REFERENCES items(item_id) ON DELETE CASCADE,
    quantity INT NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS world_time (
    tick_id SERIAL PRIMARY KEY,
    current_day INT NOT NULL DEFAULT 1,
    current_year INT NOT NULL DEFAULT 1
);

-- =========================================================================
-- 10. SIMULATION PIPELINE TABLES
-- =========================================================================
CREATE TABLE IF NOT EXISTS sim_factions (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    lore_text TEXT,
    trait_aggression INT,
    trait_magic INT,
    trait_economy INT
);

CREATE TABLE IF NOT EXISTS sim_cells (
    id INT PRIMARY KEY,
    faction_id INT REFERENCES sim_factions(id) ON DELETE SET NULL,
    biome TEXT,
    population INT,
    geometry JSONB,
    eco_plants FLOAT DEFAULT 100,
    eco_prey FLOAT DEFAULT 50,
    eco_predators FLOAT DEFAULT 10,
    eco_resources FLOAT DEFAULT 100
);

CREATE TABLE IF NOT EXISTS sim_events (
    id SERIAL PRIMARY KEY,
    tick INT,
    type TEXT,
    message TEXT,
    burg_id INT,
    faction_id INT,
    tier TEXT DEFAULT 'MINOR',
    lore_date TEXT
);

CREATE TABLE IF NOT EXISTS sim_calendar (
    id SERIAL PRIMARY KEY,
    tick INT,
    year INT,
    month INT,
    moon_phase TEXT,
    season TEXT
);

CREATE TABLE IF NOT EXISTS sim_burg_economy (
    burg_id INT PRIMARY KEY,
    food INT,
    raw_materials INT,
    refined_goods INT,
    wealth INT,
    unrest INT CHECK (unrest >= 0 AND unrest <= 100),
    crime_rate INT DEFAULT 0,
    pop_attuned INT DEFAULT 0,
    pop_null INT DEFAULT 0,
    dominant_domain TEXT,
    species_demographics TEXT DEFAULT '{}',
    health FLOAT DEFAULT 100,
    military_forces TEXT DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS sim_trade_routes (
    id SERIAL PRIMARY KEY,
    source_burg_id INT,
    dest_burg_id INT,
    throughput INT,
    risk_level INT
);

CREATE TABLE IF NOT EXISTS sim_chaos_zones (
    id SERIAL PRIMARY KEY,
    cell_id INT REFERENCES sim_cells(id) ON DELETE CASCADE,
    radius FLOAT,
    intensity INT CHECK (intensity >= 1 AND intensity <= 10),
    effect_type TEXT
);

CREATE TABLE IF NOT EXISTS sim_agents (
    id SERIAL PRIMARY KEY,
    name TEXT,
    faction_id INT REFERENCES sim_factions(id) ON DELETE CASCADE,
    location_cell_id INT REFERENCES sim_cells(id) ON DELETE CASCADE,
    role TEXT,
    active_plot TEXT
);

CREATE TABLE IF NOT EXISTS sim_diplomacy (
    faction_a_id INT REFERENCES sim_factions(id) ON DELETE CASCADE,
    faction_b_id INT REFERENCES sim_factions(id) ON DELETE CASCADE,
    status TEXT,
    tension INT CHECK (tension >= 0 AND tension <= 100),
    PRIMARY KEY (faction_a_id, faction_b_id)
);

CREATE TABLE IF NOT EXISTS sim_sacred_groves (
    id SERIAL PRIMARY KEY,
    cell_id INT REFERENCES sim_cells(id) ON DELETE CASCADE,
    dragon_name TEXT,
    power_domain TEXT,
    seal_strength FLOAT CHECK (seal_strength >= 0 AND seal_strength <= 100)
);

CREATE TABLE IF NOT EXISTS sim_infrastructure (
    id SERIAL PRIMARY KEY,
    burg_id INT,
    cell_id INT,
    type TEXT,
    status TEXT
);

CREATE TABLE IF NOT EXISTS sim_roads (
    id SERIAL PRIMARY KEY,
    source_cell_id INT,
    dest_cell_id INT
);

CREATE TABLE IF NOT EXISTS sim_outlaw_factions (
    id SERIAL PRIMARY KEY,
    name TEXT,
    type TEXT,
    origin_cell_id INT,
    manpower INT,
    wealth INT,
    heat INT
);

CREATE TABLE IF NOT EXISTS sim_outlaw_enterprises (
    id SERIAL PRIMARY KEY,
    faction_id INT,
    enterprise_type TEXT,
    target_id INT,
    profitability INT,
    heat_generated INT
);

CREATE TABLE IF NOT EXISTS sim_paragons (
    id SERIAL PRIMARY KEY,
    burg_id INT NULL,
    outlaw_id INT NULL,
    title TEXT NOT NULL,
    name TEXT NOT NULL,
    traits TEXT NOT NULL,
    corruption_score FLOAT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sim_industrial_stockpiles (
    burg_id INT PRIMARY KEY,
    raw_wood INT DEFAULT 0,
    raw_ore INT DEFAULT 0,
    raw_herbs INT DEFAULT 0,
    raw_fiber INT DEFAULT 0,
    refined_lumber INT DEFAULT 0,
    forged_steel INT DEFAULT 0,
    alchemical_potions INT DEFAULT 0,
    textiles INT DEFAULT 0,
    complex_inventory TEXT DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS sim_fringe_factions (id SERIAL PRIMARY KEY, name TEXT, type TEXT, wealth INT DEFAULT 1000);

INSERT INTO sim_fringe_factions (name, type, wealth)
SELECT 'The Gilded Compass', 'BANK', 1000
WHERE NOT EXISTS (SELECT 1 FROM sim_fringe_factions WHERE name = 'The Gilded Compass');

INSERT INTO sim_fringe_factions (name, type, wealth)
SELECT 'The Free Sky-Barons', 'SMUGGLER', 1000
WHERE NOT EXISTS (SELECT 1 FROM sim_fringe_factions WHERE name = 'The Free Sky-Barons');

INSERT INTO sim_fringe_factions (name, type, wealth)
SELECT 'The Devil''s Choice', 'MERCENARY', 1000
WHERE NOT EXISTS (SELECT 1 FROM sim_fringe_factions WHERE name = 'The Devil''s Choice');

INSERT INTO sim_fringe_factions (name, type, wealth)
SELECT 'The Ivory-Gate Syndicate', 'TOLL_AUTHORITY', 1000
WHERE NOT EXISTS (SELECT 1 FROM sim_fringe_factions WHERE name = 'The Ivory-Gate Syndicate');

INSERT INTO sim_fringe_factions (name, type, wealth)
SELECT 'The Ghostwind Raiders', 'RAIDER', 1000
WHERE NOT EXISTS (SELECT 1 FROM sim_fringe_factions WHERE name = 'The Ghostwind Raiders');

CREATE TABLE IF NOT EXISTS sim_gm_memories (
    id SERIAL PRIMARY KEY,
    player_id INT DEFAULT 1,
    sector_key VARCHAR(50),
    timestamp BIGINT NOT NULL,
    summary TEXT NOT NULL,
    tags JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_gm_memories_player ON sim_gm_memories(player_id);

CREATE TABLE IF NOT EXISTS sim_world_vault_sectors (
    cell_id INT NOT NULL,
    rx INT NOT NULL,
    ry INT NOT NULL,
    biome_id SMALLINT NOT NULL,
    elevation SMALLINT NOT NULL DEFAULT 500,
    moisture SMALLINT NOT NULL DEFAULT 500,
    chaos_radiation SMALLINT NOT NULL DEFAULT 0,
    infrastructure_mask INT NOT NULL DEFAULT 0,
    poi_type VARCHAR(64) NULL,
    compressed_terrain BYTEA NULL,
    name VARCHAR(128) NULL,
    props JSONB DEFAULT '[]'::jsonb,
    npcs JSONB DEFAULT '[]'::jsonb,
    features JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (cell_id, rx, ry)
);
CREATE INDEX IF NOT EXISTS idx_vault_coords ON sim_world_vault_sectors(cell_id, rx, ry);

CREATE TABLE IF NOT EXISTS sim_world_landmarks (
    id SERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    cell_id INT NOT NULL,
    sector_x INT NOT NULL,
    sector_y INT NOT NULL,
    landmark_type VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50) NULL,
    resource_richness INT DEFAULT 100,
    faction_owner_id INT,
    historical_origin TEXT NOT NULL,
    current_status VARCHAR(50) DEFAULT 'ACTIVE'
);
CREATE INDEX IF NOT EXISTS idx_landmarks_resource ON sim_world_landmarks(resource_type);
CREATE INDEX IF NOT EXISTS idx_landmarks_cell ON sim_world_landmarks(cell_id);

ALTER TABLE sim_npc_instances ADD COLUMN IF NOT EXISTS home_pos INT[] DEFAULT ARRAY[128, 128];
ALTER TABLE sim_npc_instances ADD COLUMN IF NOT EXISTS work_pos INT[] DEFAULT ARRAY[128, 128];
ALTER TABLE sim_npc_instances ADD COLUMN IF NOT EXISTS current_task VARCHAR(50) DEFAULT 'IDLE';
ALTER TABLE sim_npc_instances ADD COLUMN IF NOT EXISTS target_destination INT[];
ALTER TABLE sim_npc_instances ADD COLUMN IF NOT EXISTS schedule_state VARCHAR(50) DEFAULT 'WORK';
ALTER TABLE sim_npc_instances ADD COLUMN IF NOT EXISTS instinct VARCHAR(30) DEFAULT 'WARY';
ALTER TABLE sim_npc_instances ADD COLUMN IF NOT EXISTS temper VARCHAR(30) DEFAULT 'STOIC';
ALTER TABLE sim_npc_instances ADD COLUMN IF NOT EXISTS needs JSONB DEFAULT '{"food":0.8,"rest":0.8,"coin":0.5,"safety":0.8,"company":0.5}'::jsonb;
ALTER TABLE sim_npc_instances ADD COLUMN IF NOT EXISTS mood JSONB DEFAULT '{"fear":0.1,"anger":0.1,"joy":0.2}'::jsonb;
ALTER TABLE sim_npc_instances ADD COLUMN IF NOT EXISTS beliefs JSONB DEFAULT '[]'::jsonb;
ALTER TABLE sim_npc_instances ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '[]'::jsonb;
ALTER TABLE sim_npc_instances ADD COLUMN IF NOT EXISTS trade_price_mult NUMERIC(4,2) DEFAULT 1.00;

CREATE TABLE IF NOT EXISTS sim_chaos_flows (
    flow_id INT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    dragon_name VARCHAR(100) NOT NULL,
    elemental_power VARCHAR(50) NOT NULL,
    source_angle FLOAT NOT NULL,
    source_coord JSONB NOT NULL,
    sink_coord JSONB NOT NULL,
    current_surge FLOAT NOT NULL DEFAULT 1.0,
    current_width FLOAT NOT NULL DEFAULT 2.5,
    meander_offset FLOAT NOT NULL DEFAULT 0.0,
    waypoints JSONB NOT NULL DEFAULT '[]'::jsonb,
    narrow_spots JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sim_player_mutations (
    id SERIAL PRIMARY KEY,
    player_id INT NOT NULL,
    mutation_key VARCHAR(100) NOT NULL,
    mutation_name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    stat_modifiers JSONB DEFAULT '{}'::jsonb,
    acquired_at_tick INT DEFAULT 1,
    acquired_source VARCHAR(100) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_player_mutations_pid ON sim_player_mutations(player_id);

ALTER TABLE interior_sub_maps ADD COLUMN IF NOT EXISTS parent_cell_id INT;
ALTER TABLE interior_sub_maps ADD COLUMN IF NOT EXISTS parent_rx INT DEFAULT 112;
ALTER TABLE interior_sub_maps ADD COLUMN IF NOT EXISTS parent_ry INT DEFAULT 112;
ALTER TABLE interior_sub_maps ADD COLUMN IF NOT EXISTS parent_prop_id VARCHAR(150);
ALTER TABLE interior_sub_maps ADD COLUMN IF NOT EXISTS interior_type VARCHAR(64);
ALTER TABLE interior_sub_maps ADD COLUMN IF NOT EXISTS name VARCHAR(150);
ALTER TABLE interior_sub_maps ADD COLUMN IF NOT EXISTS grid_data BYTEA;
ALTER TABLE interior_sub_maps ADD COLUMN IF NOT EXISTS props JSONB DEFAULT '[]'::jsonb;
ALTER TABLE interior_sub_maps ADD COLUMN IF NOT EXISTS npcs JSONB DEFAULT '[]'::jsonb;
ALTER TABLE interior_sub_maps ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX IF NOT EXISTS idx_interior_sub_maps_parent ON interior_sub_maps(parent_cell_id, parent_prop_id);
`;

async function migrate() {
  try {
    console.log("Starting database migration...");
    await pool.query(DDL);
    console.log("Migration completed successfully.");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    pool.end();
  }
}

migrate();
