/**
 * agentMovementHelper.ts - Spatial navigation & POI targeting for Aetheria autonomous agents
 *
 * Provides high-performance sub-millisecond bounding-box spatial steps across 34,000+ cells.
 */

export interface CellCoord {
  id: number;
  center_x: number;
  center_y: number;
}

export interface SacredGroveTarget {
  id: number;
  cell_id: number;
  dragon_name: string;
  power_domain: string;
  seal_strength: number;
  center_x: number;
  center_y: number;
}

/**
 * Steps an agent from currentCellId towards targetCellId along the Euclidean vector
 * @param client PostgreSQL client
 * @param currentCellId Starting cell
 * @param targetCellId Destination cell
 * @param stepDistance Step distance in map units (default 65 units, ~1 day travel)
 * @returns The next cell ID along the path
 */
export async function stepTowardCell(
  client: any,
  currentCellId: number,
  targetCellId: number,
  stepDistance = 65
): Promise<{ nextCellId: number; arrived: boolean }> {
  if (currentCellId === targetCellId) {
    return { nextCellId: targetCellId, arrived: true };
  }

  const coordsRes = await client.query(
    "SELECT id, center_x, center_y FROM sim_cells WHERE id IN ($1, $2)",
    [currentCellId, targetCellId]
  );

  const cur = coordsRes.rows.find((r: any) => r.id === currentCellId);
  const tgt = coordsRes.rows.find((r: any) => r.id === targetCellId);

  if (!cur || !tgt) {
    return { nextCellId: targetCellId, arrived: true };
  }

  const dx = tgt.center_x - cur.center_x;
  const dy = tgt.center_y - cur.center_y;
  const dist = Math.hypot(dx, dy);

  if (dist <= stepDistance) {
    return { nextCellId: targetCellId, arrived: true };
  }

  const nextX = cur.center_x + (dx / dist) * stepDistance;
  const nextY = cur.center_y + (dy / dist) * stepDistance;
  const PAD = 150;

  const nextCellRes = await client.query(
    `SELECT id FROM sim_cells
     WHERE center_x BETWEEN $1 AND $2 AND center_y BETWEEN $3 AND $4
     ORDER BY ((center_x - $5)^2 + (center_y - $6)^2) ASC
     LIMIT 1`,
    [nextX - PAD, nextX + PAD, nextY - PAD, nextY + PAD, nextX, nextY]
  );

  if (nextCellRes.rowCount > 0) {
    return { nextCellId: nextCellRes.rows[0].id, arrived: false };
  }

  return { nextCellId: targetCellId, arrived: true };
}

/**
 * Finds the nearest Sacred Grove (Dragon Prison) to a given cell
 */
export async function getNearestSacredGrove(client: any, cellId: number): Promise<SacredGroveTarget | null> {
  const curCellRes = await client.query("SELECT center_x, center_y FROM sim_cells WHERE id = $1", [cellId]);
  if (curCellRes.rowCount === 0) return null;
  const { center_x, center_y } = curCellRes.rows[0];

  const grovesRes = await client.query(`
    SELECT g.id, g.cell_id, g.dragon_name, g.power_domain, g.seal_strength, c.center_x, c.center_y,
           ((c.center_x - $1)^2 + (c.center_y - $2)^2) as dist_sq
    FROM sim_sacred_groves g
    JOIN sim_cells c ON g.cell_id = c.id
    ORDER BY dist_sq ASC
    LIMIT 1
  `, [center_x, center_y]);

  if (grovesRes.rowCount === 0) return null;
  return grovesRes.rows[0];
}

/**
 * Finds the most weakened Sacred Grove (Dragon Prison) across Ostraka
 */
export async function getWeakestSacredGrove(client: any): Promise<SacredGroveTarget | null> {
  const grovesRes = await client.query(`
    SELECT g.id, g.cell_id, g.dragon_name, g.power_domain, g.seal_strength, c.center_x, c.center_y
    FROM sim_sacred_groves g
    JOIN sim_cells c ON g.cell_id = c.id
    ORDER BY g.seal_strength ASC, RANDOM()
    LIMIT 1
  `);

  if (grovesRes.rowCount === 0) return null;
  return grovesRes.rows[0];
}

/**
 * Finds the nearest active Cultist hideout or cultist cell
 */
export async function getNearestCultistCell(client: any, cellId: number): Promise<{ cell_id: number; cultist_id: number; burg_id?: number } | null> {
  const curCellRes = await client.query("SELECT center_x, center_y FROM sim_cells WHERE id = $1", [cellId]);
  if (curCellRes.rowCount === 0) return null;
  const { center_x, center_y } = curCellRes.rows[0];

  const cultistRes = await client.query(`
    SELECT a.id as cultist_id, a.location_cell_id as cell_id, a.home_burg_id as burg_id,
           ((c.center_x - $1)^2 + (c.center_y - $2)^2) as dist_sq
    FROM sim_agents a
    JOIN sim_cells c ON a.location_cell_id = c.id
    WHERE a.role = 'Cultist'
    ORDER BY dist_sq ASC
    LIMIT 1
  `, [center_x, center_y]);

  if (cultistRes.rowCount === 0) return null;
  return cultistRes.rows[0];
}
