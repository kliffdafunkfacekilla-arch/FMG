/**
 * Columns added after a world was created. Live databases are never reset just to add one, so the
 * server applies these at start (idempotent); resetWorld.ts creates them for new worlds.
 */
type Db = { query: (text: string, params?: any[]) => Promise<any> };

export async function applySchemaPatches(db: Db): Promise<void> {
  // sim_events.faction_id held sovereign faction ids for most events but outlaw faction ids for
  // cartel events, so faction 1 meant both the Avian Empire and the Gilded Compass.
  await db.query(`ALTER TABLE sim_events ADD COLUMN IF NOT EXISTS outlaw_id INT`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_sim_events_outlaw ON sim_events(outlaw_id) WHERE outlaw_id IS NOT NULL`);

  // Squared map distance between two cells' centres. "Nearest burg" used ORDER BY ABS(cell_id - x):
  // Voronoi cell ids are not laid out geographically, so that picked effectively random burgs.
  await db.query(`
    CREATE OR REPLACE FUNCTION cell_dist2(a INT, b INT) RETURNS DOUBLE PRECISION
    LANGUAGE sql STABLE AS $$
      SELECT (cb.center_x - ca.center_x) ^ 2 + (cb.center_y - ca.center_y) ^ 2
      FROM sim_cells ca, sim_cells cb WHERE ca.id = a AND cb.id = b LIMIT 1
    $$`);

  // People who left a burg's counters outside births and deaths (executions, riots, bandits, refugees),
  // not yet matched by citizen records retired: a record goes once a full unit has left.
  await db.query(`ALTER TABLE sim_burg_economy ADD COLUMN IF NOT EXISTS pop_departure_pool FLOAT DEFAULT 0`);
  // People per citizen record in this burg, recounted weekly by the burg operations agent
  await db.query(`ALTER TABLE sim_burg_economy ADD COLUMN IF NOT EXISTS record_unit INT`);

  // Lookups every tick makes (TICK_PROFILE=1 showed them as sequential scans): agents by role and cell or
  // home burg (cultists, wardens, the Mandate), events by tick and by type (director, NPC routines, the
  // apocalypse check, which scanned all ~190k events with LIKE)
  await db.query(`CREATE INDEX IF NOT EXISTS idx_sim_agents_role_cell ON sim_agents(role, location_cell_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_sim_agents_role_home ON sim_agents(role, home_burg_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_sim_events_tick ON sim_events(tick)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_sim_events_type ON sim_events(type)`);
  // A burg's living civilians in id order: tagBurgCitizens picks from a seeded point in this range
  await db.query(`CREATE INDEX IF NOT EXISTS idx_pop_civilians_by_burg ON population_demographics(settlement_id, citizen_id) WHERE allegiance_status = 'CIVILIAN'`);

  // Weather fronts table was missing in live databases where schemaPatches ran instead of resetWorld
  await db.query(`
    CREATE TABLE IF NOT EXISTS sim_weather_fronts (
      id       SERIAL PRIMARY KEY,
      type     TEXT,
      x        REAL,
      y        REAL,
      dx       REAL,
      dy       REAL,
      radius   REAL,
      lifetime INT
    )
  `);

  // Ostraka_full.map metadata columns & reference tables (additive, non-breaking)
  await db.query(`
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

    DO $$ BEGIN
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
  `);
}
