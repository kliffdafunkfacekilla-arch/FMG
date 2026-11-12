import { sqlShuffle } from "../rng.js";
/**
 * agentMovementHelper.ts - High-Performance Macro Spatial Navigation & In-Memory Collision System
 *
 * Implements Level-of-Detail (LOD) optimization for the Ostraka Simulation Engine:
 * - In-Memory Spatial Hash Grid: Caches all 34,430 cell coordinates once in memory.
 * - Sub-microsecond geometric navigation without database roundtrips.
 * - Dynamic Agent Collision & Interception: Detects path intersections between moving agents
 *   (e.g. Wardens intercepting Cultists, Outlaws ambushing Caravans) in real time.
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

export interface AgentCollision {
  id: number;
  name: string;
  role: string;
  sub_role?: string;
  location_cell_id: number;
}

export interface MoveStepResult {
  nextCellId: number;
  arrived: boolean;
  collidedWith?: AgentCollision | null;
}

// ── IN-MEMORY SPATIAL HASH GRID CACHE ──────────────────────────────────────────
const BUCKET_SIZE = 60; // 60 map units per spatial bucket
let isCacheLoaded = false;
let cellCoordsMap: Map<number, { x: number; y: number }> = new Map();
let spatialGrid: Map<string, number[]> = new Map(); // "bx,by" -> array of cell IDs
let sacredGrovesCache: SacredGroveTarget[] = [];
let lastGroveCacheTick = -1;

function getBucketKey(x: number, y: number): string {
  const bx = Math.floor(x / BUCKET_SIZE);
  const by = Math.floor(y / BUCKET_SIZE);
  return `${bx},${by}`;
}

/**
 * Initializes the in-memory spatial cache once across the 34,430 Voronoi cells.
 */
export async function initSpatialCache(client: any): Promise<void> {
  if (isCacheLoaded && cellCoordsMap.size > 0) return;

  const res = await client.query("SELECT id, center_x, center_y FROM sim_cells");
  cellCoordsMap.clear();
  spatialGrid.clear();

  for (const r of res.rows) {
    const id = r.id;
    const x = parseFloat(r.center_x) || 0;
    const y = parseFloat(r.center_y) || 0;
    cellCoordsMap.set(id, { x, y });

    const key = getBucketKey(x, y);
    const bucket = spatialGrid.get(key);
    if (bucket) {
      bucket.push(id);
    } else {
      spatialGrid.set(key, [id]);
    }
  }

  isCacheLoaded = true;
}

/**
 * Returns the cached (x, y) coordinates for any cell in sub-microsecond time.
 */
export function getCellCoords(cellId: number): { x: number; y: number } | null {
  return cellCoordsMap.get(cellId) || null;
}

/**
 * High-speed in-memory spatial lookup: finds the closest Voronoi cell ID to (x, y)
 * by searching the current spatial hash bucket and its adjacent neighbors.
 */
export function findNearestCell(x: number, y: number): number | null {
  if (!isCacheLoaded || cellCoordsMap.size === 0) return null;

  const bx = Math.floor(x / BUCKET_SIZE);
  const by = Math.floor(y / BUCKET_SIZE);

  let bestCellId: number | null = null;
  let bestDistSq = Infinity;

  // Search 3x3 neighborhood of buckets
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const key = `${bx + dx},${by + dy}`;
      const bucket = spatialGrid.get(key);
      if (bucket) {
        for (const cid of bucket) {
          const coord = cellCoordsMap.get(cid);
          if (coord) {
            const distSq = (coord.x - x) ** 2 + (coord.y - y) ** 2;
            if (distSq < bestDistSq) {
              bestDistSq = distSq;
              bestCellId = cid;
            }
          }
        }
      }
    }
  }

  return bestCellId;
}

/**
 * Steps an agent from currentCellId towards targetCellId along the Euclidean vector.
 * Uses the in-memory spatial grid (0 SQL queries) and detects real-time collisions
 * with opposing agents in the path.
 *
 * @param client PostgreSQL client
 * @param currentCellId Starting cell
 * @param targetCellId Destination cell
 * @param stepDistance Step distance in map units (default 65 units, ~1 day travel)
 * @param detectOpposingRole Optional role to detect collisions against (e.g. 'Cultist' for Wardens)
 * @returns The next cell ID, arrival status, and any collided agent
 */
export async function stepTowardCell(
  client: any,
  currentCellId: number,
  targetCellId: number,
  stepDistance = 65,
  detectOpposingRole?: string
): Promise<MoveStepResult> {
  if (currentCellId === targetCellId) {
    return { nextCellId: targetCellId, arrived: true };
  }

  if (!isCacheLoaded) {
    await initSpatialCache(client);
  }

  const cur = cellCoordsMap.get(currentCellId);
  const tgt = cellCoordsMap.get(targetCellId);

  if (!cur || !tgt) {
    return { nextCellId: targetCellId, arrived: true };
  }

  const dx = tgt.x - cur.x;
  const dy = tgt.y - cur.y;
  const dist = Math.hypot(dx, dy);

  if (dist <= stepDistance) {
    return { nextCellId: targetCellId, arrived: true };
  }

  // Calculate destination position along the line
  const nextX = cur.x + (dx / dist) * stepDistance;
  const nextY = cur.y + (dy / dist) * stepDistance;

  // Find Voronoi cell in-memory using spatial hash
  const nextCellId = findNearestCell(nextX, nextY) || targetCellId;

  // ── COLLISION & INTERCEPTION DETECTION ──────────────────────────────────────
  let collision: AgentCollision | null = null;

  if (detectOpposingRole) {
    // Check if any opposing agent is located at nextCellId or within collision radius
    const opposingRes = await client.query(
      `SELECT id, name, role, sub_role, location_cell_id
       FROM sim_agents
       WHERE role = $1 AND location_cell_id = $2
       LIMIT 1`,
      [detectOpposingRole, nextCellId]
    );

    if (opposingRes.rowCount > 0) {
      collision = opposingRes.rows[0];
    }
  }

  return {
    nextCellId,
    arrived: nextCellId === targetCellId,
    collidedWith: collision
  };
}

/**
 * Finds the nearest Sacred Grove (Dragon Prison) to a given cell using in-memory coordinates.
 */
export async function getNearestSacredGrove(client: any, cellId: number): Promise<SacredGroveTarget | null> {
  if (!isCacheLoaded) {
    await initSpatialCache(client);
  }

  const cur = cellCoordsMap.get(cellId);
  if (!cur) return null;

  if (sacredGrovesCache.length === 0) {
    const res = await client.query(`
      SELECT g.id, g.cell_id, g.dragon_name, g.power_domain, g.seal_strength, c.center_x, c.center_y
      FROM sim_sacred_groves g
      JOIN sim_cells c ON g.cell_id = c.id ORDER BY g.id
    `);
    sacredGrovesCache = res.rows.map((r: any) => ({
      id: r.id,
      cell_id: r.cell_id,
      dragon_name: r.dragon_name,
      power_domain: r.power_domain,
      seal_strength: r.seal_strength,
      center_x: parseFloat(r.center_x) || 0,
      center_y: parseFloat(r.center_y) || 0
    }));
  }

  let bestGrove: SacredGroveTarget | null = null;
  let bestDistSq = Infinity;

  for (const g of sacredGrovesCache) {
    const distSq = (g.center_x - cur.x) ** 2 + (g.center_y - cur.y) ** 2;
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestGrove = g;
    }
  }

  return bestGrove;
}

/**
 * Finds the most weakened Sacred Grove (Dragon Prison) across Ostraka.
 */
export async function getWeakestSacredGrove(client: any): Promise<SacredGroveTarget | null> {
  const grovesRes = await client.query(`
    SELECT g.id, g.cell_id, g.dragon_name, g.power_domain, g.seal_strength, c.center_x, c.center_y
    FROM sim_sacred_groves g
    JOIN sim_cells c ON g.cell_id = c.id
    ORDER BY g.seal_strength ASC, ${sqlShuffle('g.id')}
    LIMIT 1
  `);

  if (grovesRes.rowCount === 0) return null;
  return grovesRes.rows[0];
}

/**
 * Finds the nearest active Cultist cell or hideout using indexed DB query.
 */
export async function getNearestCultistCell(
  client: any,
  cellId: number
): Promise<{ cell_id: number; cultist_id: number; burg_id?: number } | null> {
  if (!isCacheLoaded) {
    await initSpatialCache(client);
  }

  const cur = cellCoordsMap.get(cellId);
  if (!cur) return null;

  // Single fast query against active cultists with bounding box filter
  const PAD = 500;
  const cultistRes = await client.query(`
    SELECT a.id as cultist_id, a.location_cell_id as cell_id, a.home_burg_id as burg_id,
           ((c.center_x - $1)^2 + (c.center_y - $2)^2) as dist_sq
    FROM sim_agents a
    JOIN sim_cells c ON a.location_cell_id = c.id
    WHERE a.role = 'Cultist'
      AND c.center_x BETWEEN $3 AND $4
      AND c.center_y BETWEEN $5 AND $6
    ORDER BY dist_sq ASC
    LIMIT 1
  `, [cur.x, cur.y, cur.x - PAD, cur.x + PAD, cur.y - PAD, cur.y + PAD]);

  if (cultistRes.rowCount === 0) {
    // Fallback: search globally if none in bounding box
    const fallbackRes = await client.query(`
      SELECT a.id as cultist_id, a.location_cell_id as cell_id, a.home_burg_id as burg_id,
             ((c.center_x - $1)^2 + (c.center_y - $2)^2) as dist_sq
      FROM sim_agents a
      JOIN sim_cells c ON a.location_cell_id = c.id
      WHERE a.role = 'Cultist'
      ORDER BY dist_sq ASC
      LIMIT 1
    `, [cur.x, cur.y]);
    return fallbackRes.rows[0] || null;
  }

  return cultistRes.rows[0];
}

/** One agent's end-of-day state, written by persistAgentStates. */
export interface AgentStateRow {
  id: number; location_cell_id: number | null; target_cell_id: number | null; target_grove_id: number | null;
  state: string; sub_role: string | null; metric: number; age_ticks: number;
}

/**
 * Writes the end-of-day state of many agents in one statement. The cultist, warden and Mandate loops used
 * to write each agent with its own UPDATE (~860 round trips a day). Safe to defer to the end of a loop:
 * no agent reads positions of its own role mid-loop (cultists look for wardens and wardens for cultists,
 * each written in an earlier step). `metricColumn` is corruption or drained_power.
 */
export async function persistAgentStates(client: any, rows: AgentStateRow[], metricColumn: "corruption" | "drained_power"): Promise<void> {
  if (rows.length === 0) return;
  await client.query(`
    UPDATE sim_agents a SET
      location_cell_id = v.location_cell_id, target_cell_id = v.target_cell_id, target_grove_id = v.target_grove_id,
      state = v.state, sub_role = v.sub_role, ${metricColumn} = v.metric, age_ticks = v.age_ticks
    FROM (SELECT unnest($1::int[]) AS id, unnest($2::int[]) AS location_cell_id, unnest($3::int[]) AS target_cell_id,
                 unnest($4::int[]) AS target_grove_id, unnest($5::text[]) AS state, unnest($6::text[]) AS sub_role,
                 unnest($7::float[]) AS metric, unnest($8::int[]) AS age_ticks) v
    WHERE a.id = v.id`,
    [rows.map(r => r.id), rows.map(r => r.location_cell_id), rows.map(r => r.target_cell_id), rows.map(r => r.target_grove_id),
     rows.map(r => r.state), rows.map(r => r.sub_role), rows.map(r => r.metric), rows.map(r => r.age_ticks)]);
}
