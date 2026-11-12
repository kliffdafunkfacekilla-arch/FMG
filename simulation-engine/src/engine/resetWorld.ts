import pool from "../db/pool";
import { ingestHolgalandMap } from "../db/ingestHolgalandMap";

const DDL = `
-- Drop only simulation tables, strictly preserving player character sheets, game saves, and memorials
DROP TABLE IF EXISTS sim_active_projects CASCADE;
DROP TABLE IF EXISTS sim_faction_units CASCADE;
DROP TABLE IF EXISTS sim_faction_borders CASCADE;
DROP TABLE IF EXISTS sim_weather_fronts CASCADE;
DROP TABLE IF EXISTS sim_industrial_stockpiles CASCADE;
DROP TABLE IF EXISTS sim_burg_economy CASCADE;
DROP TABLE IF EXISTS sim_cells CASCADE;
DROP TABLE IF EXISTS sim_factions CASCADE;
DROP TABLE IF EXISTS sim_calendar CASCADE;
DROP TABLE IF EXISTS sim_events CASCADE;
DROP TABLE IF EXISTS sim_outlaw_factions CASCADE;
DROP TABLE IF EXISTS sim_trade_routes CASCADE;
DROP TABLE IF EXISTS sim_chaos_zones CASCADE;
DROP TABLE IF EXISTS sim_sacred_groves CASCADE;
DROP TABLE IF EXISTS sim_fringe_lairs CASCADE;
DROP TABLE IF EXISTS sim_ghostwind_dead_drops CASCADE;
DROP TABLE IF EXISTS sim_paragons CASCADE;
DROP TABLE IF EXISTS sim_diplomacy CASCADE;
DROP TABLE IF EXISTS sim_infrastructure CASCADE;
DROP TABLE IF EXISTS sim_ancient_path_wards CASCADE;
DROP TABLE IF EXISTS sim_agents CASCADE;
DROP TABLE IF EXISTS sim_commodity_prices CASCADE;
DROP TABLE IF EXISTS sim_roads CASCADE;
DROP TABLE IF EXISTS sim_faction_wars CASCADE;
DROP TABLE IF EXISTS sim_global_events CASCADE;
DROP TABLE IF EXISTS sim_chaos_flows CASCADE;
DROP TABLE IF EXISTS sim_world_vault_sectors CASCADE;
DROP TABLE IF EXISTS sim_world_landmarks CASCADE;
DROP TABLE IF EXISTS sim_grind_canyons CASCADE;
DROP TABLE IF EXISTS sim_sector_layers CASCADE;
DROP TABLE IF EXISTS sim_cell_tags CASCADE;
-- Stories belong to the world they happened in
DROP TABLE IF EXISTS sim_threads CASCADE;
DROP TABLE IF EXISTS sim_story_arcs CASCADE;

DROP TABLE IF EXISTS sim_active_projects CASCADE;

CREATE TABLE IF NOT EXISTS sim_active_projects (
    id SERIAL PRIMARY KEY,
    burg_id INT,
    project_type VARCHAR(50),
    target_tier INT DEFAULT 0,
    ticks_remaining INT
);

CREATE TABLE IF NOT EXISTS sim_faction_units (
    id SERIAL PRIMARY KEY,
    faction_id INT,
    unit_type VARCHAR(50),
    count INT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    location_cell_id INT,
    experience INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sim_faction_borders (
    id SERIAL PRIMARY KEY,
    faction_id INT,
    cell_id INT,
    is_border BOOLEAN,
    faction_a INT,
    faction_b INT
);

CREATE TABLE sim_factions (
  id   SERIAL PRIMARY KEY,
  name TEXT, color TEXT, lore_text TEXT,
  trait_aggression REAL DEFAULT 0,
  trait_magic      REAL DEFAULT 0,
  trait_economy    REAL DEFAULT 0,
  wealth INT DEFAULT 1000,
  treasury BIGINT DEFAULT 1000
);

CREATE TABLE sim_cells (
    id          INT  PRIMARY KEY,
    faction_id  INT  REFERENCES sim_factions(id) ON DELETE SET NULL,
    biome       TEXT,
    population  INT  DEFAULT 0,
    geometry    TEXT,
    center_x    REAL DEFAULT 0,
    center_y    REAL DEFAULT 0,
    base_temp   REAL DEFAULT 15,
    current_temp REAL DEFAULT 15,
    eco_plants    REAL DEFAULT 0,
    eco_prey      REAL DEFAULT 0,
    eco_predators REAL DEFAULT 0,
    eco_resources REAL DEFAULT 0,
    eco_apex      REAL DEFAULT 0,
    eco_blight    REAL DEFAULT 0,
    eco_disease   REAL DEFAULT 0,
    eco_health  FLOAT DEFAULT 100.0,
    eco_max     FLOAT DEFAULT 100.0,
    elevation   INT  DEFAULT 0,
    z_layer     INT  DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS sim_weather_fronts (
    id          SERIAL PRIMARY KEY,
    type        TEXT,
    x           REAL,
    y           REAL,
    dx          REAL,
    dy          REAL,
    radius      REAL,
    lifetime    INT
  );



CREATE TABLE IF NOT EXISTS sim_burg_economy (
  burg_id          INT  PRIMARY KEY,
  name             TEXT,
  culture_id       INT,
  is_capital       BOOLEAN DEFAULT FALSE,
  food             INT  DEFAULT 1000,
  raw_materials    INT  DEFAULT 1000,
  refined_goods    INT  DEFAULT 1000,
  wealth           INT  DEFAULT 100,
  unrest           INT  DEFAULT 0,
  pop_attuned      INT  DEFAULT 0,
  pop_null         INT  DEFAULT 100,
  dominant_domain  TEXT DEFAULT 'MATERIAL',
  cell_id          INT  REFERENCES sim_cells(id) ON DELETE CASCADE,
  crime_rate       REAL DEFAULT 0,
  species_demographics TEXT DEFAULT '{}',
  health           INT  DEFAULT 90,
  military_forces  TEXT DEFAULT '{}',
  demographics     TEXT DEFAULT '{}',
  ring_level       INT  DEFAULT 0,
  tier             TEXT DEFAULT 'HAMLET',
  z_layer          INT  DEFAULT 0,
  resource_profile TEXT DEFAULT NULL,
  urban_tier       INT  DEFAULT 1,
  hierarchy_tier   SMALLINT DEFAULT 1,
  port             BOOLEAN DEFAULT FALSE,
  pop_growth_pool  FLOAT DEFAULT 0.0,
  architecture_type VARCHAR(20) DEFAULT 'MIXED',
  settlement_type   VARCHAR(32) DEFAULT 'BURG',
  occupier_faction_id INT,
  occupation_ticks INT DEFAULT 0,
  resistance_strength INT DEFAULT 0,
  parent_burg_id   INT DEFAULT NULL,
  upstream_burg_id INT DEFAULT NULL,
  dedicated_civic_ratio REAL DEFAULT NULL,
  current_inventory JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE sim_industrial_stockpiles (
  burg_id           INT PRIMARY KEY REFERENCES sim_burg_economy(burg_id) ON DELETE CASCADE,
  raw_wood          INT DEFAULT 0,
  raw_ore           INT DEFAULT 0,
  raw_herbs         INT DEFAULT 0,
  raw_fiber         INT DEFAULT 0,
  refined_lumber    INT DEFAULT 0,
  forged_steel      INT DEFAULT 0,
  alchemical_potions INT DEFAULT 0,
  textiles          INT DEFAULT 0,
  complex_inventory TEXT DEFAULT '{}'
);

CREATE TABLE sim_calendar (
  id            SERIAL PRIMARY KEY,
  tick          INT,
  year          INT,
  month         INT,
  month_name    TEXT,
  day_of_month  INT,
  day_of_year   INT,
  moon_phase    TEXT,
  season        TEXT,
  active_flow   TEXT,
  dragon_domain TEXT,
  is_shadow_week BOOLEAN DEFAULT false
);

CREATE TABLE sim_events (
  id         SERIAL PRIMARY KEY,
  tick       INT,
  type       TEXT,
  message    TEXT,
  tier       TEXT DEFAULT 'MINOR',
  lore_date  TEXT,
  burg_id    INT,
  faction_id INT,
  outlaw_id  INT,
  cell_id    INT,
  z_layer    INT  DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sim_threads (
  id             SERIAL PRIMARY KEY,
  question       TEXT NOT NULL,
  stakes         TEXT NOT NULL,
  actor_ids      TEXT[] NOT NULL DEFAULT '{}',
  cell_id        INT NOT NULL,
  rx             INT NOT NULL,
  ry             INT NOT NULL,
  clock          INT NOT NULL DEFAULT 0,
  clock_max      INT NOT NULL DEFAULT 6,
  state          VARCHAR(32) NOT NULL DEFAULT 'open',
  origin         VARCHAR(32) NOT NULL DEFAULT 'reaction',
  created_tick   INT NOT NULL DEFAULT 0,
  resolved_tick  INT DEFAULT NULL,
  resolution     TEXT DEFAULT NULL,
  rule_id        VARCHAR(64) DEFAULT NULL,
  on_expire      JSONB DEFAULT '{}'::jsonb,
  on_resolved_by_party JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_sim_threads_state ON sim_threads(state);
CREATE INDEX IF NOT EXISTS idx_sim_threads_loc ON sim_threads(cell_id, rx, ry);

-- Managed story arcs (engine/threads/storyArcs.ts keeps the same definition for live databases)
CREATE TABLE IF NOT EXISTS sim_story_arcs (
    id                SERIAL PRIMARY KEY,
    arc_key           VARCHAR(160) NOT NULL,
    cell_id           INT NOT NULL,
    rx                INT NOT NULL,
    ry                INT NOT NULL,
    z                 INT NOT NULL DEFAULT 0,
    inciting_incident TEXT NOT NULL,
    beats             JSONB NOT NULL DEFAULT '[]'::jsonb,
    active_phase      INT NOT NULL DEFAULT 1,
    state             VARCHAR(16) NOT NULL DEFAULT 'active',
    thread_ids        INT[] NOT NULL DEFAULT '{}',
    actor_id          TEXT,
    source            VARCHAR(16) NOT NULL DEFAULT 'procedural',
    created_tick      INT NOT NULL DEFAULT 0,
    resolved_tick     INT
);
CREATE INDEX IF NOT EXISTS idx_story_arcs_loc ON sim_story_arcs(cell_id, rx, ry);

CREATE TABLE sim_outlaw_factions (
  id SERIAL PRIMARY KEY,
  name TEXT,
  type TEXT,
  origin_cell_id INT,
  manpower INT DEFAULT 100,
  worker_groups INT DEFAULT 2,
  wealth INT DEFAULT 1000,
  heat INT DEFAULT 0,
  description TEXT,
  contraband_types TEXT[]
);

CREATE TABLE sim_trade_routes (
  id             SERIAL PRIMARY KEY,
  source_burg_id INT,
  dest_burg_id   INT,
  volume         INT  DEFAULT 100,
  throughput     INT  DEFAULT 100,
  risk_level     INT  DEFAULT 1,
  status         TEXT DEFAULT 'ACTIVE'
);

CREATE TABLE sim_chaos_zones (
  id        SERIAL PRIMARY KEY,
  cell_id   INT REFERENCES sim_cells(id) ON DELETE CASCADE,
  intensity REAL DEFAULT 0,
  type      TEXT,
  UNIQUE(cell_id, type)
);

CREATE TABLE sim_sacred_groves (
  id           SERIAL PRIMARY KEY,
  cell_id      INT REFERENCES sim_cells(id) ON DELETE CASCADE,
  dragon_name  TEXT,
  power_domain TEXT,
  seal_strength INT DEFAULT 100
);

CREATE TABLE IF NOT EXISTS sim_fringe_lairs (
    id SERIAL PRIMARY KEY,
    faction_id INT,
    cell_id INT,
    burg_id INT,
    lair_type VARCHAR(50),
    manpower INT DEFAULT 0,
    heat INT DEFAULT 0,
    inventory JSONB DEFAULT '{}'::jsonb,
    resident_npc_ids TEXT[] DEFAULT '{}'::text[]
);

CREATE TABLE IF NOT EXISTS sim_ghostwind_dead_drops (
    id SERIAL PRIMARY KEY,
    created_tick INT,
    client_faction_id INT,
    target_faction_id INT,
    target_burg_id INT,
    bounty_gold INT,
    status VARCHAR(20) DEFAULT 'PENDING',
    executed_tick INT
);

CREATE TABLE sim_paragons (
  id               SERIAL PRIMARY KEY,
  burg_id          INT,
  outlaw_id        INT,
  title            TEXT,
  name             TEXT,
  traits           TEXT DEFAULT '[]',
  corruption_score INT DEFAULT 0,
    faction_id INT,
    is_counselor BOOLEAN DEFAULT false
  );

CREATE TABLE sim_diplomacy (
  id           SERIAL PRIMARY KEY,
  faction_a_id INT,
  faction_b_id INT,
  status       TEXT DEFAULT 'NEUTRAL',
  tension      INT  DEFAULT 0,
  UNIQUE (faction_a_id, faction_b_id)
);

CREATE TABLE sim_infrastructure (
  id      SERIAL PRIMARY KEY,
  burg_id INT,
  cell_id INT,
  type    TEXT,
  status  TEXT DEFAULT 'ACTIVE',
  level   INT  DEFAULT 1,
  UNIQUE(burg_id, type)
);

CREATE TABLE IF NOT EXISTS sim_ancient_path_wards (
  id                  SERIAL PRIMARY KEY,
  cell_id             INT,
  flow_id             INT,
  path_name           TEXT,
  is_charged          BOOLEAN DEFAULT true,
  last_triggered_tick INT DEFAULT 0,
  recharge_ticks      INT DEFAULT 120
);

CREATE TABLE sim_agents (
  id                   SERIAL PRIMARY KEY,
  name                 TEXT,
  citizen_name         TEXT,
  profession           TEXT,
  species              TEXT,
  spark_tier           TEXT,
  personality_temper   TEXT,
  personality_instinct TEXT,
  motivation           TEXT,
  faction_id           INT,
  home_burg_id         INT,
  location_cell_id     INT,
  target_cell_id       INT,
  target_grove_id      INT,
  role                 TEXT,
  sub_role             TEXT,
  state                TEXT,
  corruption           INT DEFAULT 0,
  age_ticks            INT DEFAULT 0,
  drained_power        REAL DEFAULT 0,
  active_plot          TEXT
);

CREATE TABLE IF NOT EXISTS sim_commodity_prices (
    id SERIAL PRIMARY KEY,
    commodity TEXT NOT NULL UNIQUE,
    base_price FLOAT DEFAULT 1.0,
    current_price FLOAT DEFAULT 1.0,
    global_supply INT DEFAULT 0,
    global_demand INT DEFAULT 0,
    last_updated_tick INT DEFAULT 0
);

INSERT INTO sim_commodity_prices (commodity, base_price, current_price)
VALUES 
    ('grain', 1.0, 1.0), ('wood', 0.8, 0.8), ('stone', 0.5, 0.5),
    ('iron', 2.0, 2.0), ('copper', 1.5, 1.5), ('gold', 10.0, 10.0),
    ('silver', 5.0, 5.0), ('crystals', 8.0, 8.0), ('dragon_stone_shard', 20.0, 20.0),
    ('exotic', 6.0, 6.0), ('spice', 4.0, 4.0), ('aromatics', 3.0, 3.0),
    ('medicine', 3.5, 3.5), ('narcotic', 5.0, 5.0), ('pitch', 1.2, 1.2),
    ('clay', 0.6, 0.6), ('fibre', 0.7, 0.7), ('textile', 1.8, 1.8),
    ('organs', 7.0, 7.0)
ON CONFLICT (commodity) DO NOTHING;

CREATE TABLE IF NOT EXISTS sim_player_character (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50),
    kingdom VARCHAR(50) DEFAULT 'Mammal',
    lineage VARCHAR(50) DEFAULT 'Ursine',
    institution VARCHAR(50) DEFAULT 'Mass',
    species VARCHAR(50) DEFAULT 'Bear',
    might INT DEFAULT 1,
    endurance INT DEFAULT 1,
    finesse INT DEFAULT 1,
    reflex INT DEFAULT 1,
    vitality INT DEFAULT 1,
    fortitude INT DEFAULT 1,
    knowledge INT DEFAULT 1,
    logic INT DEFAULT 1,
    awareness INT DEFAULT 1,
    intuition INT DEFAULT 1,
    charm INT DEFAULT 1,
    willpower INT DEFAULT 1,
    current_hp INT,
    max_hp INT,
    composure INT,
    stamina_max INT DEFAULT 10,
    focus_max INT DEFAULT 10,
    phys_defense INT DEFAULT 0,
    speed INT DEFAULT 0,
    gear_tax_total INT DEFAULT 0,
    passive_traits JSONB DEFAULT '[]'::jsonb,
    skills JSONB DEFAULT '[]'::jsonb,
    mastery_perks JSONB DEFAULT '[]'::jsonb,
    main_type VARCHAR(50),
    sub_type VARCHAR(50),
    final_type VARCHAR(50),
    power_null_track VARCHAR(50),
    offense_skill VARCHAR(50),
    defense_skill VARCHAR(50),
    equipped_armor VARCHAR(50),
    equipped_weapon VARCHAR(50),
    equipped_social_weapon VARCHAR(50) DEFAULT 'Iron Warmaster Baton',
    equipped_social_armor VARCHAR(50) DEFAULT 'Keepsake Locket of the Hearth',
    max_composure INT DEFAULT 20,
    current_quest_beat INT DEFAULT 0,
    gold INT DEFAULT 50,
    inventory JSONB DEFAULT '[]'::jsonb,
    xp INT DEFAULT 0,
    level INT DEFAULT 1,
    skill_points INT DEFAULT 0,
    skill_ranks JSONB DEFAULT '{}'::jsonb,
    difficulty VARCHAR(20) DEFAULT 'survivor',
    faction_reputations JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS sim_game_saves (
    id SERIAL PRIMARY KEY,
    slot_name VARCHAR(100) NOT NULL,
    player_id INT,
    character_data JSONB NOT NULL,
    world_pos JSONB NOT NULL,
    story_state JSONB NOT NULL,
    difficulty VARCHAR(20) DEFAULT 'survivor',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sim_character_memorials (
    id SERIAL PRIMARY KEY,
    player_name VARCHAR(100) NOT NULL,
    kingdom VARCHAR(50),
    species VARCHAR(50),
    lineage VARCHAR(50),
    level INT DEFAULT 1,
    gold INT DEFAULT 0,
    equipped_weapon VARCHAR(100),
    equipped_armor VARCHAR(100),
    sector_x INT DEFAULT 0,
    sector_y INT DEFAULT 0,
    difficulty VARCHAR(20) DEFAULT 'hardcore',
    cause_of_death TEXT DEFAULT 'Fell in combat',
    fallen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sim_npc_instances (
    id VARCHAR(100) PRIMARY KEY,
    cell_id INT NOT NULL,
    current_rx INT NOT NULL,
    current_ry INT NOT NULL,
    local_pos INT[] NOT NULL,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(120) NOT NULL,
    kingdom VARCHAR(50),
    species VARCHAR(50),
    lineage VARCHAR(50),
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    faction VARCHAR(100),
    hp INT NOT NULL,
    max_hp INT NOT NULL,
    disposition INT NOT NULL DEFAULT 0,
    alive BOOLEAN NOT NULL DEFAULT true,
    equipped_weapon VARCHAR(100),
    equipped_armor VARCHAR(100),
    stat_affinity VARCHAR(20),
    stats JSONB NOT NULL DEFAULT '{}'::jsonb,
    inventory JSONB DEFAULT '[]'::jsonb,
    memory_notes JSONB DEFAULT '[]'::jsonb,
    wander_anchor INT[] DEFAULT ARRAY[128, 128],
    home_pos INT[] DEFAULT ARRAY[128, 128],
    work_pos INT[] DEFAULT ARRAY[128, 128],
    current_task VARCHAR(50) DEFAULT 'IDLE',
    target_destination INT[],
    schedule_state VARCHAR(50) DEFAULT 'WORK',
    instinct VARCHAR(30) DEFAULT 'WARY',
    temper VARCHAR(30) DEFAULT 'STOIC',
    needs JSONB DEFAULT '{"food":0.8,"rest":0.8,"coin":0.5,"safety":0.8,"company":0.5}'::jsonb,
    mood JSONB DEFAULT '{"fear":0.1,"anger":0.1,"joy":0.2}'::jsonb,
    beliefs JSONB DEFAULT '[]'::jsonb,
    social_links JSONB DEFAULT '[]'::jsonb,
    trade_price_mult FLOAT DEFAULT 1.0,
    processed_for_economy BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sim_npc_instances_loc ON sim_npc_instances(cell_id, current_rx, current_ry);

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

CREATE TABLE IF NOT EXISTS sim_grind_canyons (
    id SERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    cell_id INT NOT NULL,
    sector_x INT NOT NULL DEFAULT 50,
    sector_y INT NOT NULL DEFAULT 50,
    dragon_name VARCHAR(50) NOT NULL,
    dragon_domain VARCHAR(50) NOT NULL,
    depth_meters INT NOT NULL DEFAULT 250,
    dragonstone_richness INT NOT NULL DEFAULT 120,
    artifacts_remaining INT NOT NULL DEFAULT 3,
    stability_ticks_remaining INT NOT NULL DEFAULT 8,
    total_duration_ticks INT NOT NULL DEFAULT 8,
    status VARCHAR(30) NOT NULL DEFAULT 'OPEN',
    miner_crew_name VARCHAR(120) NOT NULL,
    active_miners INT NOT NULL DEFAULT 12,
    opened_tick INT NOT NULL DEFAULT 1,
    closed_tick INT,
    inventory JSONB DEFAULT '[]'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_grind_canyons_cell_status ON sim_grind_canyons(cell_id, status);

CREATE TABLE IF NOT EXISTS sim_global_events (
    id SERIAL PRIMARY KEY,
    layer VARCHAR(50),
    type VARCHAR(50),
    message TEXT,
    regional_x INT,
    regional_y INT,
    radius INT,
    intensity FLOAT,
    velocity_x INT,
    velocity_y INT,
    duration INT
);

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

CREATE TABLE IF NOT EXISTS sim_roads (
    id SERIAL PRIMARY KEY,
    name TEXT,
    road_group TEXT,
    length REAL,
    points JSONB,
    source_cell_id INT,
    dest_cell_id INT
);

CREATE TABLE IF NOT EXISTS sim_faction_wars (
    id SERIAL PRIMARY KEY,
    attacker_faction_id INT,
    defender_faction_id INT,
    is_active BOOLEAN DEFAULT TRUE,
    started_tick INT DEFAULT 1
);

CREATE TABLE IF NOT EXISTS population_demographics (
    citizen_id SERIAL PRIMARY KEY,
    settlement_id INT,
    home_cell_id INT,
    name TEXT NOT NULL,
    profession TEXT,
    species TEXT,
    is_null BOOLEAN NOT NULL DEFAULT TRUE,
    spark_tier VARCHAR(30) DEFAULT 'NONE',
    attunement_level FLOAT DEFAULT 0.0,
    chaos_attraction_index FLOAT DEFAULT 0.0,
    temper VARCHAR(30) DEFAULT 'STOIC',
    instinct VARCHAR(30) DEFAULT 'WARY',
    motivation TEXT DEFAULT 'Survive and provide',
    traits JSONB DEFAULT '[]'::jsonb,
    social_links JSONB DEFAULT '[]'::jsonb,
    allegiance_status VARCHAR(50) DEFAULT 'CIVILIAN',
    unit_size INT DEFAULT 12,
    life_stage VARCHAR(20) DEFAULT 'ADULT',
    age INT DEFAULT 25,
    childhood_background TEXT,
    is_immigrant BOOLEAN DEFAULT FALSE,
    cause_of_death TEXT,
    workplace_type TEXT,
    workplace_name TEXT,
    birthplace TEXT
);
CREATE INDEX IF NOT EXISTS idx_pop_settlement ON population_demographics(settlement_id);
CREATE INDEX IF NOT EXISTS idx_pop_spark ON population_demographics(spark_tier);
CREATE INDEX IF NOT EXISTS idx_pop_allegiance ON population_demographics(allegiance_status);
CREATE INDEX IF NOT EXISTS idx_pop_stage ON population_demographics(settlement_id, life_stage);
CREATE INDEX IF NOT EXISTS idx_pop_demo_workplace ON population_demographics(workplace_type);

CREATE TABLE IF NOT EXISTS sim_sector_layers (
    cell_id INT NOT NULL,
    rx INT NOT NULL,
    ry INT NOT NULL,
    z_layer INT NOT NULL,
    layer_name VARCHAR(128) NOT NULL,
    compressed_terrain BYTEA NOT NULL,
    props JSONB DEFAULT '[]'::jsonb,
    npcs JSONB DEFAULT '[]'::jsonb,
    features JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (cell_id, rx, ry, z_layer)
);
CREATE INDEX IF NOT EXISTS idx_sector_layers_lookup ON sim_sector_layers(cell_id, rx, ry, z_layer);

-- Environmental tags per cell (engine/cellTags.ts keeps the same definition for live databases)
CREATE TABLE IF NOT EXISTS sim_cell_tags (
    cell_id INT NOT NULL,
    z_layer INT NOT NULL DEFAULT 0,
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    PRIMARY KEY (cell_id, z_layer)
);

`;

export async function resetWorld(): Promise<{ message: string; stats: Record<string, number> }> {
  const client = await pool.connect();

  try {
    console.log("[resetWorld] Ensuring database schema and tables exist...");
    await client.query(DDL);
    client.release();

    console.log("[resetWorld] Ingesting authentic Holgaland atlas & world geography...");
    await ingestHolgalandMap();

    const [factionsRes, cellsRes, burgsRes, paragonsRes, citizensRes] = await Promise.all([
      pool.query("SELECT COUNT(*) as c FROM sim_factions"),
      pool.query("SELECT COUNT(*) as c FROM sim_cells"),
      pool.query("SELECT COUNT(*) as c FROM sim_burg_economy"),
      pool.query("SELECT COUNT(*) as c FROM sim_paragons"),
      pool.query("SELECT COUNT(*) as c FROM population_demographics")
    ]);

    const stats = {
      factions: parseInt(factionsRes.rows[0].c, 10),
      cells: parseInt(cellsRes.rows[0].c, 10),
      burgs: parseInt(burgsRes.rows[0].c, 10),
      paragons: parseInt(paragonsRes.rows[0].c, 10),
      citizens: parseInt(citizensRes.rows[0].c, 10),
      agents: 24,
    };

    console.log("[resetWorld] Done:", stats);
    return { message: "Holgaland world reset successfully completed.", stats };
  } catch (err: any) {
    console.error("[resetWorld] Error during world reset:", err);
    throw err;
  }
}
