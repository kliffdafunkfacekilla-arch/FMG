/**
 * Focused meso layer day runner (Phase 10.3–10.4 & 13.3).
 * Deduplicates cells across multiple focused regions so shared border cells step once per day.
 */
import type { Db, DeltaEmitter } from "../deltas/types.js";
import { createStoryline } from "../story/storylines.js";
import { loadMesoAgents } from "./agents.js";
import { buildRegion, listFocusedRegions } from "./region.js";
import { stepMesoDay, type MesoBurgState, type MesoCellState } from "./mesoStep.js";

export interface FocusedMesoRunSummary {
  regionsRun: number;
  cellsStepped: number;
  ambushes: number;
  arrests: number;
  predations: number;
  proposalsCreated: number;
}

export async function runFocusedMesoDay(
  db: Db,
  tick: number,
  season: string,
  loreDate: string,
  emit: DeltaEmitter
): Promise<FocusedMesoRunSummary> {
  const regions = await listFocusedRegions(db);
  if (regions.length === 0) {
    return { regionsRun: 0, cellsStepped: 0, ambushes: 0, arrests: 0, predations: 0, proposalsCreated: 0 };
  }

  // Deduplicate cell IDs across up to MAX_ACTIVE_REGIONS focused rings
  const allCellIds = Array.from(new Set(regions.flatMap((r) => r.cell_ids))).sort((a, b) => a - b);
  const neighborLookup = new Map<number, Partial<Record<"N" | "S" | "E" | "W", number>>>();
  for (const r of regions) {
    const built = await buildRegion(db, r.focus_cell_id, { seed: r.seed, maxCells: r.cell_ids.length });
    for (const c of built.cells) {
      if (c.neighbors) neighborLookup.set(c.cellId, { ...neighborLookup.get(c.cellId), ...c.neighbors });
    }
  }

  const cellsRes = await db.query(
    `SELECT id,
            COALESCE(eco_plants, 50)::float8 AS eco_plants,
            COALESCE(eco_prey, 40)::float8 AS eco_prey,
            COALESCE(eco_predators, 10)::float8 AS eco_predators,
            COALESCE(eco_apex, 5)::float8 AS eco_apex,
            COALESCE(eco_blight, 0)::float8 AS eco_blight,
            COALESCE(eco_max, 100)::float8 AS eco_max
     FROM sim_cells
     WHERE id = ANY($1::int[])
     ORDER BY id ASC`,
    [allCellIds]
  );

  const cells: MesoCellState[] = cellsRes.rows.map((c: any) => ({
    cellId: Number(c.id),
    ecoPlants: Number(c.eco_plants),
    ecoPrey: Number(c.eco_prey),
    ecoPredators: Number(c.eco_predators),
    ecoApex: Number(c.eco_apex),
    ecoBlight: Number(c.eco_blight),
    ecoMax: Number(c.eco_max),
    neighbors: neighborLookup.get(Number(c.id)),
  }));

  const burgsRes = await db.query(
    `SELECT burg_id, cell_id, name, food, wealth, unrest, pop_null
     FROM sim_burg_economy
     WHERE cell_id = ANY($1::int[])
     ORDER BY burg_id ASC`,
    [allCellIds]
  );
  const burgs: MesoBurgState[] = burgsRes.rows.map((b: any) => ({
    burgId: Number(b.burg_id),
    cellId: Number(b.cell_id),
    name: String(b.name),
    food: Number(b.food || 0),
    wealth: Number(b.wealth || 0),
    unrest: Number(b.unrest || 0),
    popNull: Number(b.pop_null || 0),
  }));

  const agents = await loadMesoAgents(db, allCellIds, tick);
  const seed = regions[0]?.seed || process.env.SIM_SEED || "ostraka";
  const result = stepMesoDay(
    { tick, season, loreDate, cells, burgs, agents },
    { seed, tick }
  );

  for (const d of result.deltas) {
    emit(d);
  }

  let proposalsCreated = 0;
  for (const prop of result.proposals.slice(0, 3)) {
    const created = await createStoryline(db, { ...prop, state: "proposed", createdTick: tick }).catch(() => null);
    if (created) proposalsCreated++;
  }

  // Persist entity positions & focused_regions cursor without relying on volatile memory
  if (result.finalAgents.length > 0) {
    const refs: string[] = [];
    const cids: number[] = [];
    const rxs: number[] = [];
    const rys: number[] = [];
    for (const a of result.finalAgents) {
      refs.push(a.entityRef);
      cids.push(a.cellId);
      rxs.push(a.rx);
      rys.push(a.ry);
    }
    await db.query(
      `UPDATE entities e
       SET cell_id = v.cell_id, rx = v.rx, ry = v.ry
       FROM (
         SELECT unnest($1::text[]) AS ref,
                unnest($2::int[]) AS cell_id,
                unnest($3::int[]) AS rx,
                unnest($4::int[]) AS ry
       ) v
       WHERE e.ref = v.ref`,
      [refs, cids, rxs, rys]
    );
  }

  await db.query(
    `UPDATE focused_regions SET last_meso_tick = $1 WHERE focus_cell_id = ANY($2::int[])`,
    [tick, regions.map((r) => r.focus_cell_id)]
  );

  return {
    regionsRun: regions.length,
    cellsStepped: cells.length,
    ambushes: result.summary.ambushes,
    arrests: result.summary.arrests,
    predations: result.summary.predations,
    proposalsCreated,
  };
}
