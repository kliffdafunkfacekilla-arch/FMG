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
}
