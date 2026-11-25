import type { Db } from "../../deltas/types.js";
import type { BurgExpansionSnapshot, ExpansionCellCandidate, ExpansionParentSnapshot } from "./step.js";

/**
 * Loads burg expansion state once per 10th tick (0 SQL queries on non-10th ticks) and batches
 * all candidate parent neighbor lookups into a single LATERAL Voronoi bbox query.
 */
export async function loadBurgExpansion(
  client: Db,
  tick: number,
  loreDate: string
): Promise<BurgExpansionSnapshot> {
  if (tick % 10 !== 0) {
    return { tick, loreDate, maxBurgId: 1300, takenNames: [], candidates: [] };
  }

  const allBurgsRes = await client.query(
    `SELECT burg_id, name, parent_burg_id, cell_id FROM sim_burg_economy`
  );
  let maxBurgId = 1300;
  const takenNames: string[] = [];
  const occupiedCellIds = new Set<number>();
  const satCountByParent = new Map<number, number>();

  for (const r of allBurgsRes.rows) {
    const bid = Number(r.burg_id);
    if (bid > maxBurgId) maxBurgId = bid;
    if (r.name) takenNames.push(String(r.name));
    if (r.cell_id !== null && r.cell_id !== undefined) occupiedCellIds.add(Number(r.cell_id));
    if (r.parent_burg_id !== null && r.parent_burg_id !== undefined && Number(r.parent_burg_id) > 0) {
      const pid = Number(r.parent_burg_id);
      satCountByParent.set(pid, (satCountByParent.get(pid) || 0) + 1);
    }
  }

  const candidateBurgsRes = await client.query(`
    SELECT b.burg_id, b.name, b.cell_id, b.wealth, b.food, b.unrest, b.pop_null, b.pop_attuned,
           c.faction_id, c.center_x, c.center_y
    FROM sim_burg_economy b
    JOIN sim_cells c ON b.cell_id = c.id
    WHERE (b.pop_null + COALESCE(b.pop_attuned, 0)) >= 600
      AND b.wealth >= 800
      AND b.food >= 600
      AND b.unrest <= 35
      AND (b.parent_burg_id IS NULL OR b.parent_burg_id = 0)
    ORDER BY b.wealth DESC, b.burg_id ASC
    LIMIT 12
  `);

  const candidates: ExpansionParentSnapshot[] = [];
  const searchRows: Array<{ burgId: number; cellId: number; factionId: number | null; cx: number; cy: number }> = [];

  for (const r of candidateBurgsRes.rows) {
    const burgId = Number(r.burg_id);
    const cellId = Number(r.cell_id);
    const factionId = r.faction_id !== null && r.faction_id !== undefined ? Number(r.faction_id) : null;
    const existingSatellites = satCountByParent.get(burgId) || 0;

    candidates.push({
      burgId,
      name: String(r.name),
      cellId,
      wealth: Number(r.wealth) || 0,
      food: Number(r.food) || 0,
      unrest: Number(r.unrest) || 0,
      popNull: Number(r.pop_null) || 0,
      popAttuned: Number(r.pop_attuned) || 0,
      factionId,
      existingSatellites,
      neighborCandidates: [],
    });

    if (existingSatellites < 3) {
      searchRows.push({
        burgId,
        cellId,
        factionId,
        cx: parseFloat(r.center_x) || 0,
        cy: parseFloat(r.center_y) || 0,
      });
    }
  }

  if (searchRows.length > 0) {
    const occupiedArr = Array.from(occupiedCellIds);
    const nbRes = await client.query(
      `SELECT p.burg_id AS parent_burg_id, nb.id, nb.biome, nb.elevation
       FROM unnest(
         $1::int[],
         $2::int[],
         $3::int[],
         $4::float8[],
         $5::float8[]
       ) AS p(burg_id, cell_id, faction_id, cx, cy)
       CROSS JOIN LATERAL (
         SELECT c.id, c.biome, c.elevation
         FROM sim_cells c
         WHERE c.id <> p.cell_id
           AND (c.faction_id = p.faction_id OR c.faction_id IS NULL)
           AND NOT (c.id = ANY($6::int[]))
           AND c.elevation < 85
           AND c.biome NOT IN ('0', '11')
           AND c.center_x BETWEEN (p.cx - 200) AND (p.cx + 200)
           AND c.center_y BETWEEN (p.cy - 200) AND (p.cy + 200)
           AND ((c.center_x - p.cx)^2 + (c.center_y - p.cy)^2) < 40000
         ORDER BY ((c.center_x - p.cx)^2 + (c.center_y - p.cy)^2) ASC, c.id ASC
         LIMIT 12
       ) AS nb`,
      [
        searchRows.map((p) => p.burgId),
        searchRows.map((p) => p.cellId),
        searchRows.map((p) => p.factionId),
        searchRows.map((p) => p.cx),
        searchRows.map((p) => p.cy),
        occupiedArr,
      ]
    );

    const byParent = new Map<number, ExpansionCellCandidate[]>();
    for (const r of nbRes.rows) {
      const pid = Number(r.parent_burg_id);
      let list = byParent.get(pid);
      if (!list) {
        list = [];
        byParent.set(pid, list);
      }
      list.push({
        id: Number(r.id),
        biome: Number(r.biome) || 6,
        elevation: Number(r.elevation) || 0,
      });
    }

    for (const cand of candidates) {
      cand.neighborCandidates = byParent.get(cand.burgId) || [];
    }
  }

  return { tick, loreDate, maxBurgId, takenNames, candidates };
}
