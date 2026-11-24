/**
 * Environmental tags on a map cell (#CompassEmbargo, #NightfallCurfewActive, #BrokenDragonSeal, ...).
 *
 * Tags live in sim_cell_tags, one row per cell and z-layer, so every cell can carry them. They used to
 * live only inside sim_sector_layers.features, a row that exists only once a tactical map has been
 * rendered for that cell (a handful of cells), so almost every tag an agent wrote was silently lost.
 *
 * Writes also mirror into any rendered tactical layers of the cell, so the tactical sandbox sees them.
 * Reads merge both sources, so tags written straight into a layer (thread engine, background director)
 * still count.
 */

type Db = { query: (text: string, params?: any[]) => Promise<any> };

const TABLE_SQL = `
CREATE TABLE IF NOT EXISTS sim_cell_tags (
    cell_id INT NOT NULL,
    z_layer INT NOT NULL DEFAULT 0,
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    PRIMARY KEY (cell_id, z_layer)
);`;

let ensured = false;

/** Creates sim_cell_tags if missing. Cheap after the first call in a process. */
export async function ensureCellTagsTable(db: Db): Promise<void> {
  if (ensured) return;
  await db.query(TABLE_SQL);
  ensured = true;
}

export const CELL_TAGS_TABLE_SQL = TABLE_SQL;

/** Adds tags to a cell (deduplicated). */
export async function addCellTags(db: Db, cellId: number, tags: string[], zLayer = 0): Promise<void> {
  if (!tags.length) return;
  await ensureCellTagsTable(db);
  const tagsJson = JSON.stringify(tags);
  await db.query(
    `INSERT INTO sim_cell_tags (cell_id, z_layer, tags) VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (cell_id, z_layer) DO UPDATE SET tags = (
       SELECT COALESCE(jsonb_agg(DISTINCT e), '[]'::jsonb) FROM (
         SELECT jsonb_array_elements_text(sim_cell_tags.tags) AS e
         UNION SELECT jsonb_array_elements_text(EXCLUDED.tags)
       ) t
     )`,
    [cellId, zLayer, tagsJson]
  );
  await db.query(
    `UPDATE sim_sector_layers SET features = jsonb_set(
       COALESCE(features, '{}'::jsonb), '{environmental_tags}',
       (SELECT COALESCE(jsonb_agg(DISTINCT e), '[]'::jsonb) FROM (
          SELECT jsonb_array_elements_text(COALESCE(features->'environmental_tags', '[]'::jsonb)) AS e
          UNION SELECT jsonb_array_elements_text($1::jsonb)
       ) t))
     WHERE cell_id = $2 AND z_layer = $3`,
    [tagsJson, cellId, zLayer]
  );
}

/** Adds tags to many cells in two bulk queries (deduplicated per cell). */
export async function addCellTagsBatch(
  db: Db,
  entries: Array<{ cellId: number; tags: string[] }>,
  zLayer = 0
): Promise<void> {
  if (!entries.length) return;
  await ensureCellTagsTable(db);
  const byCell = new Map<number, Set<string>>();
  for (const e of entries) {
    if (!e.tags.length) continue;
    let set = byCell.get(e.cellId);
    if (!set) {
      set = new Set<string>();
      byCell.set(e.cellId, set);
    }
    for (const t of e.tags) set.add(t);
  }
  if (byCell.size === 0) return;
  const cellIds = Array.from(byCell.keys()).sort((a, b) => a - b);
  const tagJsons = cellIds.map((cid) => JSON.stringify(Array.from(byCell.get(cid)!)));
  await db.query(
    `INSERT INTO sim_cell_tags (cell_id, z_layer, tags)
     SELECT v.cell_id, $2::int, v.tags
     FROM (SELECT unnest($1::int[]) AS cell_id, unnest($3::jsonb[]) AS tags) v
     ON CONFLICT (cell_id, z_layer) DO UPDATE SET tags = (
       SELECT COALESCE(jsonb_agg(DISTINCT e ORDER BY e), '[]'::jsonb) FROM (
         SELECT jsonb_array_elements_text(sim_cell_tags.tags) AS e
         UNION SELECT jsonb_array_elements_text(EXCLUDED.tags)
       ) t
     )`,
    [cellIds, zLayer, tagJsons]
  );
  await db.query(
    `UPDATE sim_sector_layers AS s SET features = jsonb_set(
       COALESCE(s.features, '{}'::jsonb), '{environmental_tags}',
       (SELECT COALESCE(jsonb_agg(DISTINCT e ORDER BY e), '[]'::jsonb) FROM (
          SELECT jsonb_array_elements_text(COALESCE(s.features->'environmental_tags', '[]'::jsonb)) AS e
          UNION SELECT jsonb_array_elements_text(v.tags)
       ) t))
     FROM (SELECT unnest($1::int[]) AS cell_id, unnest($3::jsonb[]) AS tags) v
     WHERE s.cell_id = v.cell_id AND s.z_layer = $2::int`,
    [cellIds, zLayer, tagJsons]
  );
}

/** Removes tags from a cell. */
export async function removeCellTags(db: Db, cellId: number, tags: string[], zLayer = 0): Promise<void> {
  if (!tags.length) return;
  await ensureCellTagsTable(db);
  const tagsJson = JSON.stringify(tags);
  await db.query(
    `UPDATE sim_cell_tags SET tags = COALESCE((
       SELECT jsonb_agg(e) FROM jsonb_array_elements_text(tags) e WHERE NOT ($1::jsonb ? e)
     ), '[]'::jsonb)
     WHERE cell_id = $2 AND z_layer = $3`,
    [tagsJson, cellId, zLayer]
  );
  await db.query(
    `UPDATE sim_sector_layers SET features = jsonb_set(
       COALESCE(features, '{}'::jsonb), '{environmental_tags}',
       COALESCE((SELECT jsonb_agg(e) FROM jsonb_array_elements_text(COALESCE(features->'environmental_tags', '[]'::jsonb)) e
                 WHERE NOT ($1::jsonb ? e)), '[]'::jsonb))
     WHERE cell_id = $2 AND z_layer = $3`,
    [tagsJson, cellId, zLayer]
  );
}

/** Every tagged cell on a z-layer: cell_id -> tags, merged from sim_cell_tags and rendered layers. */
export async function loadCellTagMap(db: Db, zLayer = 0): Promise<Map<number, string[]>> {
  await ensureCellTagsTable(db);
  const res = await db.query(
    `SELECT cell_id, jsonb_agg(DISTINCT e) AS tags FROM (
       SELECT cell_id, jsonb_array_elements_text(tags) AS e FROM sim_cell_tags WHERE z_layer = $1
       UNION
       SELECT cell_id, jsonb_array_elements_text(features->'environmental_tags') AS e
       FROM sim_sector_layers
       WHERE z_layer = $1 AND jsonb_typeof(features->'environmental_tags') = 'array'
     ) t GROUP BY cell_id`,
    [zLayer]
  );
  const map = new Map<number, string[]>();
  for (const r of res.rows) map.set(Number(r.cell_id), Array.isArray(r.tags) ? r.tags : []);
  return map;
}
