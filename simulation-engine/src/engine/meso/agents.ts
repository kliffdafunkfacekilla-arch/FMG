/**
 * Entity-backed meso agents loader (Phase 10.2): convoys, roaming sim_agents,
 * cohort-promoted workers, and cell ecology wildlife groups.
 */
import type { Db } from "../deltas/types.js";
import { upsertEntitiesBatch, type UpsertEntityInput } from "../entities/registry.js";
import { promoteFromCohort } from "../lod/promote.js";
import { hashSeed } from "../rng.js";
import type { MesoAgent } from "./mesoStep.js";

function coordFromSeed(seedKey: string, min: number = 12, max: number = 88): number {
  const h = hashSeed(seedKey);
  return min + (h % Math.max(1, max - min + 1));
}

export async function loadMesoAgents(
  db: Db,
  cellIds: number[],
  tick: number
): Promise<MesoAgent[]> {
  if (cellIds.length === 0) return [];
  const agents: MesoAgent[] = [];
  const entitiesToUpsert: UpsertEntityInput[] = [];

  const burgsRes = await db.query(
    `SELECT burg_id, cell_id, name FROM sim_burg_economy WHERE cell_id = ANY($1::int[]) ORDER BY burg_id ASC`,
    [cellIds]
  );
  const burgIds = burgsRes.rows.map((r: any) => Number(r.burg_id));
  const burgCellMap = new Map<number, number>();
  for (const r of burgsRes.rows) burgCellMap.set(Number(r.burg_id), Number(r.cell_id));

  // 1. Convoys from sim_trade_shipments
  const shipRes = await db.query(
    `SELECT id, good_name, good_key, quantity, source_burg_id, dest_burg_id, current_cell_id, merchant_citizen_id
     FROM sim_trade_shipments
     WHERE status = 'IN_TRANSIT'
       AND (current_cell_id = ANY($1::int[]) OR ($2::int[] <> '{}' AND (source_burg_id = ANY($2::int[]) OR dest_burg_id = ANY($2::int[]))))
     ORDER BY id ASC
     LIMIT 12`,
    [cellIds, burgIds]
  );
  for (const s of shipRes.rows) {
    const cid = Number(s.current_cell_id || burgCellMap.get(Number(s.source_burg_id)) || cellIds[0]);
    if (!cellIds.includes(cid)) continue;
    const ref = `convoy:${s.id}`;
    const rx = coordFromSeed(`convoy:rx:${s.id}`, 18, 82);
    const ry = coordFromSeed(`convoy:ry:${s.id}`, 18, 82);
    const name = `${s.good_name || s.good_key || "Trade"} Convoy #${s.id}`;
    entitiesToUpsert.push({
      ref,
      kind: "group",
      name,
      alive: true,
      lod: "meso",
      cellId: cid,
      rx,
      ry,
      sourceTable: "sim_trade_shipments",
      sourceId: String(s.id),
      createdTick: tick,
    });
    agents.push({
      entityRef: ref,
      kind: "convoy",
      name,
      role: "Merchant Convoy",
      cellId: cid,
      rx,
      ry,
      targetRx: 50,
      targetRy: 50,
      count: Math.max(1, Number(s.quantity || 1)),
      speed: 3,
      burgId: Number(s.dest_burg_id || s.source_burg_id || 0) || null,
      shipmentId: Number(s.id),
      state: "IN_TRANSIT",
      alive: true,
    });
  }

  // 2. Roaming sim_agents in region
  const agRes = await db.query(
    `SELECT id, name, role, sub_role, state, faction_id, home_burg_id, location_cell_id
     FROM sim_agents
     WHERE location_cell_id = ANY($1::int[])
     ORDER BY id ASC
     LIMIT 24`,
    [cellIds]
  );
  for (const a of agRes.rows) {
    const cid = Number(a.location_cell_id);
    const ref = `agent:${a.id}`;
    const rx = coordFromSeed(`agent:rx:${a.id}`, 14, 86);
    const ry = coordFromSeed(`agent:ry:${a.id}`, 14, 86);
    entitiesToUpsert.push({
      ref,
      kind: "person",
      name: String(a.name || `Agent #${a.id}`),
      alive: true,
      lod: "meso",
      cellId: cid,
      rx,
      ry,
      sourceTable: "sim_agents",
      sourceId: String(a.id),
      createdTick: tick,
    });
    agents.push({
      entityRef: ref,
      kind: "roaming",
      name: String(a.name || `Agent #${a.id}`),
      role: String(a.sub_role || a.role || "Agent"),
      cellId: cid,
      rx,
      ry,
      targetRx: coordFromSeed(`agent:tx:${a.id}:${tick}`, 10, 90),
      targetRy: coordFromSeed(`agent:ty:${a.id}:${tick}`, 10, 90),
      count: 1,
      speed: 2,
      factionId: a.faction_id !== null ? Number(a.faction_id) : null,
      burgId: a.home_burg_id !== null ? Number(a.home_burg_id) : null,
      agentId: Number(a.id),
      state: String(a.state || "ACTIVE"),
      alive: true,
    });
  }

  // 3. Facility workers promoted from cohorts (up to 2 per focused burg)
  for (const b of burgsRes.rows.slice(0, 3)) {
    const burgId = Number(b.burg_id);
    const cid = Number(b.cell_id);
    const worker = await promoteFromCohort(
      db,
      burgId,
      { ageBand: "ADULT", allegiance: "CIVILIAN" },
      `meso:worker:${burgId}:0`,
      tick
    ).catch(() => null);
    if (worker) {
      const rx = coordFromSeed(`worker:rx:${worker.citizenId}`, 35, 65);
      const ry = coordFromSeed(`worker:ry:${worker.citizenId}`, 35, 65);
      agents.push({
        entityRef: worker.entityRef,
        kind: "worker",
        name: worker.name,
        role: worker.profession,
        cellId: cid,
        rx,
        ry,
        targetRx: rx,
        targetRy: ry,
        count: 1,
        speed: 1,
        burgId,
        citizenId: worker.citizenId,
        state: "WORKING",
        alive: true,
      });
    }
  }

  // 4. Wildlife groups sized by eco_prey / eco_predators
  const cellsRes = await db.query(
    `SELECT id, COALESCE(eco_prey, 0)::float8 AS eco_prey, COALESCE(eco_predators, 0)::float8 AS eco_predators
     FROM sim_cells
     WHERE id = ANY($1::int[])
     ORDER BY id ASC`,
    [cellIds]
  );
  for (const c of cellsRes.rows) {
    const cid = Number(c.id);
    const preyCount = Math.round(Number(c.eco_prey || 0));
    if (preyCount >= 5) {
      const ref = `wildlife:prey:${cid}`;
      const rx = coordFromSeed(`wprey:rx:${cid}`, 10, 90);
      const ry = coordFromSeed(`wprey:ry:${cid}`, 10, 90);
      entitiesToUpsert.push({
        ref,
        kind: "group",
        name: `Grazing Herd (Cell #${cid})`,
        alive: true,
        lod: "meso",
        cellId: cid,
        rx,
        ry,
        sourceTable: "sim_cells",
        sourceId: String(cid),
        createdTick: tick,
      });
      agents.push({
        entityRef: ref,
        kind: "wildlife_prey",
        name: `Grazing Herd (Cell #${cid})`,
        role: "Prey Herd",
        cellId: cid,
        rx,
        ry,
        targetRx: coordFromSeed(`wprey:tx:${cid}:${tick}`, 8, 92),
        targetRy: coordFromSeed(`wprey:ty:${cid}:${tick}`, 8, 92),
        count: preyCount,
        speed: 1,
        state: "GRAZING",
        alive: true,
      });
    }

    const predCount = Math.round(Number(c.eco_predators || 0));
    if (predCount >= 5) {
      const ref = `wildlife:pred:${cid}`;
      const rx = coordFromSeed(`wpred:rx:${cid}`, 10, 90);
      const ry = coordFromSeed(`wpred:ry:${cid}`, 10, 90);
      entitiesToUpsert.push({
        ref,
        kind: "group",
        name: `Predator Pack (Cell #${cid})`,
        alive: true,
        lod: "meso",
        cellId: cid,
        rx,
        ry,
        sourceTable: "sim_cells",
        sourceId: String(cid),
        createdTick: tick,
      });
      agents.push({
        entityRef: ref,
        kind: "wildlife_predator",
        name: `Predator Pack (Cell #${cid})`,
        role: "Predator Pack",
        cellId: cid,
        rx,
        ry,
        targetRx: coordFromSeed(`wpred:tx:${cid}:${tick}`, 8, 92),
        targetRy: coordFromSeed(`wpred:ty:${cid}:${tick}`, 8, 92),
        count: predCount,
        speed: 2,
        state: "HUNTING",
        alive: true,
      });
    }
  }

  await upsertEntitiesBatch(db, entitiesToUpsert);
  return agents;
}
