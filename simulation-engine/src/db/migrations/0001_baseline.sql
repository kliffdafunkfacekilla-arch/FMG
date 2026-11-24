-- 0001_baseline.sql: Idempotent baseline bringing existing & freshly reset worlds to parity.
-- Replaces legacy schemaPatches.ts (Phase 1.1).

ALTER TABLE sim_events ADD COLUMN IF NOT EXISTS outlaw_id INT;
CREATE INDEX IF NOT EXISTS idx_sim_events_outlaw ON sim_events(outlaw_id) WHERE outlaw_id IS NOT NULL;

CREATE OR REPLACE FUNCTION cell_dist2(a INT, b INT) RETURNS DOUBLE PRECISION
LANGUAGE sql STABLE AS $$
  SELECT (cb.center_x - ca.center_x) ^ 2 + (cb.center_y - ca.center_y) ^ 2
  FROM sim_cells ca, sim_cells cb WHERE ca.id = a AND cb.id = b LIMIT 1
$$;

ALTER TABLE sim_burg_economy ADD COLUMN IF NOT EXISTS pop_departure_pool FLOAT DEFAULT 0;
ALTER TABLE sim_burg_economy ADD COLUMN IF NOT EXISTS record_unit INT;
ALTER TABLE sim_burg_economy ADD COLUMN IF NOT EXISTS workforce JSONB DEFAULT NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM sim_burg_economy)
     AND NOT EXISTS (SELECT 1 FROM sim_burg_economy WHERE workforce IS NOT NULL) THEN
    WITH per_prof AS (
      SELECT settlement_id, COALESCE(profession, '') AS profession, COUNT(*)::int AS records, COALESCE(SUM(unit_size), 0)::int AS people
      FROM population_demographics
      WHERE life_stage = 'ADULT' AND allegiance_status = 'CIVILIAN'
      GROUP BY settlement_id, COALESCE(profession, '')
    ),
    agg AS (
      SELECT settlement_id,
             jsonb_object_agg(profession, jsonb_build_object('records', records, 'people', people) ORDER BY profession) AS wf
      FROM per_prof
      GROUP BY settlement_id
    )
    UPDATE sim_burg_economy b
    SET workforce = COALESCE(a.wf, '{}'::jsonb)
    FROM (SELECT burg_id FROM sim_burg_economy) all_b
    LEFT JOIN agg a ON a.settlement_id = all_b.burg_id
    WHERE b.burg_id = all_b.burg_id;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sim_agents_role_cell ON sim_agents(role, location_cell_id);
CREATE INDEX IF NOT EXISTS idx_sim_agents_role_home ON sim_agents(role, home_burg_id);
CREATE INDEX IF NOT EXISTS idx_sim_events_tick ON sim_events(tick);
CREATE INDEX IF NOT EXISTS idx_sim_events_type ON sim_events(type);
CREATE INDEX IF NOT EXISTS idx_sim_cells_coords ON sim_cells(center_x, center_y);
CREATE INDEX IF NOT EXISTS idx_sim_cells_pt ON sim_cells USING GIST (point(center_x, center_y));
CREATE INDEX IF NOT EXISTS idx_pop_civilians_by_burg ON population_demographics(settlement_id, citizen_id) WHERE allegiance_status = 'CIVILIAN';
CREATE INDEX IF NOT EXISTS idx_pop_logistics_civilians
  ON population_demographics(settlement_id, profession, citizen_id)
  WHERE allegiance_status = 'CIVILIAN' AND life_stage = 'ADULT'
    AND profession IN ('Merchant Factor', 'Merchant Trader', 'Caravan Drover', 'Caravan Guard', 'Sailor', 'Aether-Crew');

CREATE TABLE IF NOT EXISTS sim_weather_fronts (
  id       SERIAL PRIMARY KEY,
  type     TEXT,
  x        REAL,
  y        REAL,
  dx       REAL,
  dy       REAL,
  radius   REAL,
  lifetime INT
);

ALTER TABLE sim_cells ADD COLUMN IF NOT EXISTS culture_id INT DEFAULT 0;
ALTER TABLE sim_cells ADD COLUMN IF NOT EXISTS religion_id INT DEFAULT 0;
ALTER TABLE sim_cells ADD COLUMN IF NOT EXISTS market_id INT DEFAULT 0;
ALTER TABLE sim_cells ADD COLUMN IF NOT EXISTS river_id INT DEFAULT 0;
ALTER TABLE sim_cells ADD COLUMN IF NOT EXISTS suitability INT DEFAULT 0;
ALTER TABLE sim_cells ADD COLUMN IF NOT EXISTS flux INT DEFAULT 0;
ALTER TABLE sim_cells ADD COLUMN IF NOT EXISTS feature_id INT DEFAULT 0;
ALTER TABLE sim_cells ADD COLUMN IF NOT EXISTS cell_type SMALLINT DEFAULT 0;

ALTER TABLE sim_burg_economy ADD COLUMN IF NOT EXISTS x REAL DEFAULT 0;
ALTER TABLE sim_burg_economy ADD COLUMN IF NOT EXISTS y REAL DEFAULT 0;
ALTER TABLE sim_burg_economy ADD COLUMN IF NOT EXISTS citadel BOOLEAN DEFAULT FALSE;
ALTER TABLE sim_burg_economy ADD COLUMN IF NOT EXISTS walls BOOLEAN DEFAULT FALSE;
ALTER TABLE sim_burg_economy ADD COLUMN IF NOT EXISTS shanty BOOLEAN DEFAULT FALSE;
ALTER TABLE sim_burg_economy ADD COLUMN IF NOT EXISTS temple BOOLEAN DEFAULT FALSE;
ALTER TABLE sim_burg_economy ADD COLUMN IF NOT EXISTS plaza BOOLEAN DEFAULT FALSE;
ALTER TABLE sim_burg_economy ADD COLUMN IF NOT EXISTS product_value REAL DEFAULT 0;
ALTER TABLE sim_burg_economy ADD COLUMN IF NOT EXISTS production JSONB DEFAULT '[]'::jsonb;
ALTER TABLE sim_burg_economy ADD COLUMN IF NOT EXISTS coa JSONB DEFAULT '{}'::jsonb;

ALTER TABLE sim_factions ADD COLUMN IF NOT EXISTS culture_id INT DEFAULT 0;
ALTER TABLE sim_factions ADD COLUMN IF NOT EXISTS capital_burg_id INT DEFAULT NULL;
ALTER TABLE sim_factions ADD COLUMN IF NOT EXISTS expansionism REAL DEFAULT 1.0;
ALTER TABLE sim_factions ADD COLUMN IF NOT EXISTS state_type TEXT DEFAULT 'Generic';
ALTER TABLE sim_factions ADD COLUMN IF NOT EXISTS fiscal_economy JSONB DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS sim_cultures (
  id      INT PRIMARY KEY,
  name    TEXT NOT NULL,
  type    TEXT,
  base    INT DEFAULT 0,
  origins JSONB DEFAULT '[]'::jsonb,
  urban   REAL DEFAULT 0,
  rural   REAL DEFAULT 0,
  area    REAL DEFAULT 0,
  cells   INT DEFAULT 0,
  tags    JSONB DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS sim_religions (
  id      INT PRIMARY KEY,
  name    TEXT NOT NULL,
  type    TEXT,
  origins JSONB DEFAULT '[]'::jsonb,
  urban   REAL DEFAULT 0,
  rural   REAL DEFAULT 0,
  area    REAL DEFAULT 0,
  cells   INT DEFAULT 0,
  tags    JSONB DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS sim_goods (
  id              INT PRIMARY KEY,
  name            TEXT NOT NULL,
  unit            TEXT,
  value           REAL DEFAULT 1,
  carriage        REAL DEFAULT 1,
  color           TEXT,
  tags            JSONB DEFAULT '[]'::jsonb,
  distribution    TEXT,
  demand_coverage JSONB DEFAULT '{}'::jsonb,
  biome_output    JSONB DEFAULT '{}'::jsonb,
  multipliers     JSONB DEFAULT '{}'::jsonb,
  recipes         JSONB DEFAULT '[]'::jsonb,
  development     INT DEFAULT 0
);

ALTER TABLE sim_goods ADD COLUMN IF NOT EXISTS recipes JSONB DEFAULT '[]'::jsonb;
ALTER TABLE sim_goods ADD COLUMN IF NOT EXISTS development INT DEFAULT 0;

CREATE TABLE IF NOT EXISTS sim_markets (
  id             INT PRIMARY KEY,
  center_burg_id INT,
  color          TEXT,
  fee_paid       REAL DEFAULT 0,
  rural          JSONB DEFAULT '{}'::jsonb,
  goods          JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS sim_trade_deals (
  id             SERIAL PRIMARY KEY,
  from_burg_id   INT NOT NULL,
  to_market_id   INT NOT NULL,
  good_id        INT NOT NULL,
  deal_type      INT DEFAULT 0,
  quantity       REAL DEFAULT 0,
  price          REAL DEFAULT 0,
  transport_cost REAL DEFAULT 0,
  tariff         REAL DEFAULT 0,
  margin         REAL DEFAULT 0
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sim_trade_deals' AND column_name = 'to_burg_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sim_trade_deals' AND column_name = 'to_market_id'
  ) THEN
    ALTER TABLE sim_trade_deals RENAME COLUMN to_burg_id TO to_market_id;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS sim_rivers (
  id          INT PRIMARY KEY,
  name        TEXT,
  type        TEXT,
  source_cell INT,
  mouth_cell  INT,
  basin       INT,
  parent      INT,
  discharge   REAL DEFAULT 0,
  length      REAL DEFAULT 0,
  width       REAL DEFAULT 0,
  cells       JSONB DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS sim_route_graph (
  cell_id INT PRIMARY KEY,
  links   JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS sim_trade_shipments (
  id                  SERIAL PRIMARY KEY,
  source_burg_id      INT NOT NULL,
  dest_burg_id        INT NOT NULL,
  source_faction_id   INT NOT NULL DEFAULT 0,
  dest_faction_id     INT NOT NULL DEFAULT 0,
  transport_mode      VARCHAR(16) NOT NULL DEFAULT 'LAND',
  good_id             INT NOT NULL DEFAULT 0,
  good_key            TEXT NOT NULL,
  good_name           TEXT NOT NULL,
  quantity            INT NOT NULL,
  unit_price          REAL NOT NULL DEFAULT 1,
  total_gold          INT NOT NULL DEFAULT 0,
  tariff_gold         INT NOT NULL DEFAULT 0,
  carriage_weight     REAL NOT NULL DEFAULT 1,
  merchant_citizen_id INT NOT NULL,
  crew_citizen_ids    JSONB NOT NULL DEFAULT '[]'::jsonb,
  guard_count         INT NOT NULL DEFAULT 0,
  path_cells          JSONB NOT NULL DEFAULT '[]'::jsonb,
  path_index          INT NOT NULL DEFAULT 0,
  current_cell_id     INT NOT NULL,
  status              VARCHAR(24) NOT NULL DEFAULT 'IN_TRANSIT',
  dispatched_tick     INT NOT NULL DEFAULT 0,
  eta_ticks           INT NOT NULL DEFAULT 1,
  resolved_tick       INT DEFAULT NULL
);
CREATE INDEX IF NOT EXISTS idx_trade_shipments_status ON sim_trade_shipments(status);
CREATE INDEX IF NOT EXISTS idx_trade_shipments_cell ON sim_trade_shipments(current_cell_id) WHERE status = 'IN_TRANSIT';

CREATE TABLE IF NOT EXISTS sim_cell_tags (
  cell_id INT NOT NULL,
  z_layer INT NOT NULL DEFAULT 0,
  tags    JSONB NOT NULL DEFAULT '[]'::jsonb,
  PRIMARY KEY (cell_id, z_layer)
);

CREATE TABLE IF NOT EXISTS sim_threads (
  id                   SERIAL PRIMARY KEY,
  question             TEXT NOT NULL,
  stakes               TEXT NOT NULL,
  actor_ids            TEXT[] NOT NULL DEFAULT '{}',
  cell_id              INT NOT NULL,
  rx                   INT NOT NULL,
  ry                   INT NOT NULL,
  clock                INT NOT NULL DEFAULT 0,
  clock_max            INT NOT NULL DEFAULT 6,
  state                VARCHAR(32) NOT NULL DEFAULT 'open',
  origin               VARCHAR(32) NOT NULL DEFAULT 'reaction',
  created_tick         INT NOT NULL DEFAULT 0,
  resolved_tick        INT DEFAULT NULL,
  resolution           TEXT DEFAULT NULL,
  rule_id              VARCHAR(64) DEFAULT NULL,
  on_expire            JSONB DEFAULT '{}'::jsonb,
  on_resolved_by_party JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_sim_threads_state ON sim_threads(state);
CREATE INDEX IF NOT EXISTS idx_sim_threads_loc ON sim_threads(cell_id, rx, ry);

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

DO $$
DECLARE
  opts_cells TEXT;
  opts_burgs TEXT;
  opts_pop   TEXT;
BEGIN
  SELECT COALESCE(array_to_string(reloptions, ','), '') INTO opts_cells FROM pg_class WHERE relname = 'sim_cells' AND relkind = 'r';
  IF opts_cells IS NOT NULL AND (position('fillfactor=85' IN opts_cells) = 0 OR position('autovacuum_vacuum_scale_factor=0.02' IN opts_cells) = 0) THEN
    ALTER TABLE sim_cells SET (fillfactor = 85, autovacuum_vacuum_scale_factor = 0.02);
  END IF;

  SELECT COALESCE(array_to_string(reloptions, ','), '') INTO opts_burgs FROM pg_class WHERE relname = 'sim_burg_economy' AND relkind = 'r';
  IF opts_burgs IS NOT NULL AND (position('fillfactor=85' IN opts_burgs) = 0 OR position('autovacuum_vacuum_scale_factor=0.02' IN opts_burgs) = 0) THEN
    ALTER TABLE sim_burg_economy SET (fillfactor = 85, autovacuum_vacuum_scale_factor = 0.02);
  END IF;

  SELECT COALESCE(array_to_string(reloptions, ','), '') INTO opts_pop FROM pg_class WHERE relname = 'population_demographics' AND relkind = 'r';
  IF opts_pop IS NOT NULL AND position('autovacuum_vacuum_scale_factor=0.02' IN opts_pop) = 0 THEN
    ALTER TABLE population_demographics SET (autovacuum_vacuum_scale_factor = 0.02);
  END IF;
END $$;
