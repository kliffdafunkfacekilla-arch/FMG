import type { Db } from "../../deltas/types.js";

export interface GrindCanyonRowSnapshot {
  id: number;
  name: string;
  cellId: number;
  dragonName: string;
  dragonDomain: string;
  dragonstoneRichness: number;
  stabilityTicksRemaining: number;
  status: "OPEN" | "COLLAPSING";
  minerCrewName: string;
  localBurgId: number | null;
}

export interface GrindWildCell {
  id: number;
  x: number;
  y: number;
}

export interface GrindBurgCoord {
  burgId: number;
  name: string;
  cellId: number;
  x: number;
  y: number;
}

export interface GrindCanyonSnapshot {
  tick: number;
  loreDate: string;
  activeCanyons: GrindCanyonRowSnapshot[];
  hasCorpoOutlaw: boolean;
  wildCells: GrindWildCell[];
  burgs: GrindBurgCoord[];
}

/** Loads open/collapsing grind canyons plus candidate spawn cells/burgs if under the active cap of 3. */
export async function loadGrindCanyon(db: Db, tick: number, loreDate: string): Promise<GrindCanyonSnapshot> {
  const activeRes = await db.query(`
    SELECT g.id, g.name, g.cell_id, g.dragon_name, g.dragon_domain,
           g.dragonstone_richness, g.stability_ticks_remaining, g.status, g.miner_crew_name,
           b.burg_id AS local_burg_id,
           EXISTS(SELECT 1 FROM sim_outlaw_factions WHERE id = 9) AS has_corpo
    FROM sim_grind_canyons g
    LEFT JOIN sim_burg_economy b ON b.cell_id = g.cell_id
    WHERE g.status IN ('OPEN', 'COLLAPSING')
    ORDER BY g.id ASC
  `);

  const activeCanyons: GrindCanyonRowSnapshot[] = activeRes.rows.map((r: any) => ({
    id: Number(r.id),
    name: String(r.name),
    cellId: Number(r.cell_id),
    dragonName: String(r.dragon_name),
    dragonDomain: String(r.dragon_domain),
    dragonstoneRichness: Number(r.dragonstone_richness) || 0,
    stabilityTicksRemaining: Number(r.stability_ticks_remaining) || 0,
    status: String(r.status) === "COLLAPSING" ? "COLLAPSING" : "OPEN",
    minerCrewName: String(r.miner_crew_name),
    localBurgId: r.local_burg_id !== null && r.local_burg_id !== undefined ? Number(r.local_burg_id) : null,
  }));

  let hasCorpoOutlaw = activeRes.rows.length > 0 ? Boolean(activeRes.rows[0].has_corpo) : false;
  const openCount = activeCanyons.filter((c) => c.status === "OPEN").length;

  const wildCells: GrindWildCell[] = [];
  const burgs: GrindBurgCoord[] = [];

  if (openCount < 3) {
    const cellRes = await db.query(`
      SELECT c.id, c.center_x, c.center_y, b.burg_id, b.name,
             EXISTS(SELECT 1 FROM sim_outlaw_factions WHERE id = 9) AS has_corpo
      FROM sim_cells c
      LEFT JOIN sim_burg_economy b ON b.cell_id = c.id
      WHERE b.burg_id IS NOT NULL
         OR (c.biome NOT IN ('Marine') AND c.elevation >= 40)
      ORDER BY c.id ASC
    `);
    for (const r of cellRes.rows) {
      if (r.has_corpo) hasCorpoOutlaw = true;
      if (r.burg_id !== null && r.burg_id !== undefined) {
        burgs.push({
          burgId: Number(r.burg_id),
          name: String(r.name),
          cellId: Number(r.id),
          x: Number(r.center_x) || 0,
          y: Number(r.center_y) || 0,
        });
      } else {
        wildCells.push({
          id: Number(r.id),
          x: Number(r.center_x) || 0,
          y: Number(r.center_y) || 0,
        });
      }
    }
    burgs.sort((a, b) => a.burgId - b.burgId);
  }

  return { tick, loreDate, activeCanyons, hasCorpoOutlaw, wildCells, burgs };
}
