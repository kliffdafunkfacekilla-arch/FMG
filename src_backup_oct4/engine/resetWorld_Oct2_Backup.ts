/**
 * resetWorld.ts
 * ─────────────────────────────────────────────────────────────────────────
 * Wipes all simulation state tables and re-seeds them from the canonical
 * SQLite source file (aetheria.sqlite).  This is designed to be called
 * frequently — from the /api/observer/reset endpoint or from the CLI.
 *
 * Rules:
 *  - Never touches non-sim tables (characters, game_sessions, etc.)
 *  - Always Math.floor() float→integer coercions before Postgres insertion
 *  - Cells arrive in 500-row chunks to avoid parameter-limit issues
 *  - The fringe factions are hard-coded lore; they are always re-inserted fresh
 */

import BetterSqlite3 from "better-sqlite3";
import pool from "../db/pool";
import path from "path";

const SQLITE_PATH = path.join(__dirname, "../../aetheria.sqlite");

const DDL = `
-- Drop and recreate the public schema to guarantee a clean slate
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

DROP TABLE IF EXISTS sim_active_projects CASCADE;

CREATE TABLE IF NOT EXISTS sim_active_projects (
    id SERIAL PRIMARY KEY,
    burg_id INT,
    project_type VARCHAR(50),
    target_tier INT DEFAULT 0,
    ticks_remaining INT
);

CREATE TABLE sim_factions (
  id   SERIAL PRIMARY KEY,
  name TEXT, color TEXT, lore_text TEXT,
  trait_aggression REAL DEFAULT 0,
  trait_magic      REAL DEFAULT 0,
  trait_economy    REAL DEFAULT 0,
  wealth INT DEFAULT 1000
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
  architecture_type VARCHAR(20) DEFAULT 'MIXED',
  occupier_faction_id INT,
  occupation_ticks INT DEFAULT 0,
  resistance_strength INT DEFAULT 0
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
  id         SERIAL PRIMARY KEY,
  tick       INT,
  year       INT,
  month      INT,
  moon_phase TEXT,
  season     TEXT
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
  z_layer    INT  DEFAULT 0
);

CREATE TABLE sim_fringe_factions (
  id     SERIAL PRIMARY KEY,
  name   TEXT,
  type   TEXT,
  wealth INT DEFAULT 1000
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
  type      TEXT
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
    inventory JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE sim_paragons (
  id               SERIAL PRIMARY KEY,
  burg_id          INT,
  outlaw_id        INT,
  title            TEXT,
  name             TEXT,
  traits           TEXT DEFAULT '[]',
  corruption_score INT  DEFAULT 0
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
  level   INT  DEFAULT 1
);

CREATE TABLE sim_agents (
  id               SERIAL PRIMARY KEY,
  name             TEXT,
  faction_id       INT,
  location_cell_id INT,
  role             TEXT,
  active_plot      TEXT
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
`;

const fi = (v: any, def = 0) => Math.floor(Number(v) || def);
const fs_ = (v: any, def = "") => (v == null ? def : String(v));

export async function resetWorld(): Promise<{ message: string; stats: Record<string, number> }> {
  const sqlite = new BetterSqlite3(SQLITE_PATH, { readonly: true });
  const client = await pool.connect();

  try {
    console.log("[resetWorld] Rebuilding schema...");
    await client.query(DDL);

    // ── 1. Factions ───────────────────────────────────────────────────────
    const factions = sqlite.prepare("SELECT * FROM sim_factions").all() as any[];
    for (const r of factions) {
      await client.query(
        `INSERT INTO sim_factions (id,name,color,lore_text,trait_aggression,trait_magic,trait_economy,wealth)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [r.id, r.name, r.color, r.lore_text || "", r.trait_aggression || 0,
         r.trait_magic || 0, r.trait_economy || 0, fi(r.wealth, 1000)]
      );
    }
    await client.query(`SELECT setval('sim_factions_id_seq', (SELECT MAX(id) FROM sim_factions))`);

    // ── 2. Cells (chunked) ────────────────────────────────────────────────
    const cells = sqlite.prepare("SELECT * FROM sim_cells").all() as any[];
    const validCellIds = new Set(cells.map((c: any) => c.id));
    const CHUNK = 500;
      for (let i = 0; i < cells.length; i += CHUNK) {
        const chunk = cells.slice(i, i + CHUNK);
        const ph = chunk.map((_, j) => {
          const b = j * 15;
          return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},$${b+8},$${b+9},$${b+10},$${b+11},$${b+12},$${b+13},$${b+14},$${b+15})`;
        }).join(",");
        
        const params = chunk.flatMap((r) => {
          let cx = 0, cy = 0;
          try {
             const geo = typeof r.geometry === "string" ? JSON.parse(r.geometry) : r.geometry;
             if (geo && geo.coordinates && geo.coordinates[0]) {
                 const coords = geo.coordinates[0];
                 for (const pt of coords) { cx += pt[0]; cy += pt[1]; }
                 cx /= coords.length; cy /= coords.length;
             }
          } catch(e) {}
          
          let btemp = 15;
          const biome = parseInt(r.biome);
          if (biome === 11 || biome === 12) btemp = -10;
          else if (biome === 10 || biome === 3) btemp = 0;
          else if (biome === 2 || biome === 4) btemp = 35;
          else if (biome === 8 || biome === 6) btemp = 25;
          else btemp = 15;

          return [
            r.id, r.faction_id,
            r.biome || "0",
            r.population || 0,
            typeof r.geometry === "string" ? r.geometry : JSON.stringify(r.geometry || {}),
            cx, cy, btemp, btemp,
            r.eco_plants || 0, r.eco_prey || 0, r.eco_predators || 0,
            r.eco_resources || 0, r.eco_apex || 0, r.elevation || 0
          ];
        });

        await client.query(
          `INSERT INTO sim_cells (id,faction_id,biome,population,geometry,center_x,center_y,base_temp,current_temp,eco_plants,eco_prey,eco_predators,eco_resources,eco_apex,elevation) VALUES ${ph}`,
          params
        );
      }

    // ── 3. Burgs ──────────────────────────────────────────────────────────
    const burgs = sqlite.prepare("SELECT * FROM sim_burg_economy").all() as any[];
    for (const r of burgs) {
      await client.query(
        `INSERT INTO sim_burg_economy
           (burg_id,food,raw_materials,refined_goods,wealth,unrest,pop_attuned,pop_null,
            dominant_domain,cell_id,crime_rate,species_demographics,health,military_forces,demographics)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [r.burg_id, fi(r.food, 1000), fi(r.raw_materials, 1000), fi(r.refined_goods, 1000),
         fi(r.wealth, 100), fi(r.unrest), fi(r.pop_attuned), fi(r.pop_null, 100),
         r.dominant_domain || "MATERIAL", r.cell_id, r.crime_rate || 0,
         r.species_demographics || "{}", fi(r.health, 90),
         r.military_forces || "{}", r.demographics || "{}"]
      );
    }

    // ── 4. Stockpiles ─────────────────────────────────────────────────────
    const stocks = sqlite.prepare("SELECT * FROM sim_industrial_stockpiles").all() as any[];
    for (const r of stocks) {
      await client.query(
        `INSERT INTO sim_industrial_stockpiles
           (burg_id,raw_wood,raw_ore,raw_herbs,raw_fiber,refined_lumber,forged_steel,alchemical_potions,textiles,complex_inventory)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [r.burg_id, fi(r.raw_wood), fi(r.raw_ore), fi(r.raw_herbs), fi(r.raw_fiber),
         fi(r.refined_lumber), fi(r.forged_steel), fi(r.alchemical_potions), fi(r.textiles),
         r.complex_inventory || "{}"]
      );
    }

    // ── 5. Calendar ───────────────────────────────────────────────────────
    await client.query(
      `INSERT INTO sim_calendar (tick,year,month,moon_phase,season) VALUES (1,1,1,'The Mercy Alignment','The Bloom')`
    );

    // ── 6. Fringe factions (always fresh lore) ────────────────────────────
    await client.query(`
      INSERT INTO sim_fringe_factions (name,type,wealth) VALUES
        ('The Gilded Compass','BANK',5000),
        ('The Free Sky-Barons','SMUGGLER',2000),
        ('The Devil''s Choice','MERCENARY',3000),
        ('The Ivory-Gate Syndicate','TOLL_AUTHORITY',4000),
        ('The Ghostwind Raiders','RAIDER',1500)
    `);

    // ── 7. Seed event ─────────────────────────────────────────────────────
    await client.query(
      `INSERT INTO sim_events (tick,type,message,tier,lore_date)
       VALUES (1,'WORLD_RESET','A new age dawns. The old world has been reborn from ash. Let the chronicles begin.','MAJOR','The Bloom, Year 1')`
    );

    // ── 8. Outlaw factions removed ────────────────────────────────────────
    // ── 9. Outlaw enterprises removed ─────────────────────────────────────

    // ── 10. Paragons ──────────────────────────────────────────────────────
    const paragons = sqlite.prepare("SELECT * FROM sim_paragons").all() as any[];
    for (const r of paragons) {
      await client.query(
        `INSERT INTO sim_paragons (id,burg_id,outlaw_id,title,name,traits,corruption_score)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [r.id, r.burg_id, r.outlaw_id, r.title, r.name,
         typeof r.traits === "string" ? r.traits : JSON.stringify(r.traits || []),
         fi(r.corruption_score)]
      );
    }
    if (paragons.length) await client.query(`SELECT setval('sim_paragons_id_seq',(SELECT MAX(id) FROM sim_paragons))`);

    // ── 11. Sacred groves ─────────────────────────────────────────────────
    const groves = sqlite.prepare("SELECT * FROM sim_sacred_groves").all() as any[];
    for (const r of groves) {
      if (!validCellIds.has(r.cell_id)) continue;
      await client.query(
        `INSERT INTO sim_sacred_groves (id,cell_id,dragon_name,power_domain,seal_strength)
         VALUES ($1,$2,$3,$4,$5)`,
        [r.id, r.cell_id, r.dragon_name, r.power_domain, fi(r.seal_strength, 100)]
      );
    }

    // ── 12. Infrastructure ────────────────────────────────────────────────
    const infra = sqlite.prepare("SELECT * FROM sim_infrastructure").all() as any[];
    for (const r of infra) {
      await client.query(
        `INSERT INTO sim_infrastructure (id,burg_id,cell_id,type,status)
         VALUES ($1,$2,$3,$4,$5)`,
        [r.id, r.burg_id, r.cell_id, r.type, r.status || "ACTIVE"]
      );
    }

    // ── 13. Agents ────────────────────────────────────────────────────────
    const agents = sqlite.prepare("SELECT * FROM sim_agents").all() as any[];
    for (const r of agents) {
      await client.query(
        `INSERT INTO sim_agents (id,name,faction_id,location_cell_id,role,active_plot)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [r.id, r.name, r.faction_id, r.location_cell_id, r.role, r.active_plot || null]
      );
    }

    const tablesToResetSeq = ['sim_infrastructure', 'sim_agents', 'sim_sacred_groves', 'sim_fringe_lairs', 'sim_events', 'sim_trade_routes', 'sim_chaos_zones', 'sim_fringe_factions', 'sim_calendar', 'sim_diplomacy'];
    for (const t of tablesToResetSeq) {
      await client.query(`SELECT setval('${t}_id_seq', (SELECT COALESCE(MAX(id), 1) FROM ${t}))`).catch(() => {});
    }

    const stats = {
      factions: factions.length,
      cells: cells.length,
      burgs: burgs.length,
      paragons: paragons.length,
      infrastructure: infra.length,
      agents: agents.length,
    };

    console.log("[resetWorld] Done:", stats);
    return { message: "World reset to Tick 1, Year 1, The Bloom.", stats };

  } finally {
    client.release();
    sqlite.close();
  }
}
