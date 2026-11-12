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
}
