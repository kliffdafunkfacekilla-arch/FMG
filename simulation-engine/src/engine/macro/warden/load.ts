import type { Db } from "../../deltas/types.js";
import { VERGE_COORD } from "../../canon/dragonPrisons.js";
import { promoteFromCohort } from "../../lod/promote.js";
import { sqlShuffle } from "../../rng.js";
import { findNearestCell, getCellCoords, initSpatialCache } from "../../agents/agentMovementHelper.js";
import type { CellPoint, GroveCoord } from "../shared/agentNav.js";
import {
  planWardenAwakening,
  type CultistTargetSnap,
  type HermitAgentSnapshot,
  type WardenAgentSnapshot,
  type WardenAwakeningCitizen,
  type WardenAwakeningSnapshot,
  type WardenAwakeningWard,
  type WardensSnapshot,
} from "./step.js";

/**
 * Loads rechargeable ward flag + warden count, runs the pure trigger probability, and ONLY when
 * awakening triggers fetches a charged ward & resolves a Sparkborn civilian candidate.
 */
export async function loadWardenAwakening(
  client: Db,
  tick: number,
  loreDate: string,
  opts: { random?: () => number } = {}
): Promise<WardenAwakeningSnapshot> {
  const preRes = await client.query(
    `SELECT
       COUNT(*) FILTER (WHERE role = 'Warden')::int AS current_wardens,
       EXISTS(
         SELECT 1 FROM sim_ancient_path_wards
         WHERE is_charged = false AND ($1 - last_triggered_tick) >= recharge_ticks
       ) AS should_recharge
     FROM sim_agents`,
    [tick]
  );
  const currentWardens = Number(preRes.rows[0]?.current_wardens) || 0;
  const shouldRecharge = Boolean(preRes.rows[0]?.should_recharge);

  const triggered = planWardenAwakening(currentWardens, opts);
  if (!triggered) {
    return { tick, loreDate, shouldRecharge, ward: null, dbCitizen: null };
  }

  const wardRes = await client.query(`
    SELECT w.id, w.cell_id, w.flow_id, w.path_name
    FROM sim_ancient_path_wards w
    WHERE w.is_charged = true
    ORDER BY ${sqlShuffle("w.id")}
    LIMIT 1
  `);
  if (wardRes.rows.length === 0) {
    return { tick, loreDate, shouldRecharge, ward: null, dbCitizen: null };
  }
  const wr = wardRes.rows[0];
  const ward: WardenAwakeningWard = {
    id: Number(wr.id),
    cellId: Number(wr.cell_id),
    flowId: wr.flow_id !== null && wr.flow_id !== undefined ? Number(wr.flow_id) : null,
    pathName: String(wr.path_name),
  };

  let candidateRes = await client.query(
    `SELECT citizen_id, name, profession, species, spark_tier, temper, instinct, motivation
     FROM population_demographics
     WHERE spark_tier IN ('CHANNELER', 'ADEPT', 'SENSITIVE', 'DORMANT_SPARK')
       AND allegiance_status = 'CIVILIAN'
       AND settlement_id IN (
         SELECT burg_id FROM sim_burg_economy
         ORDER BY cell_dist2(cell_id, $1) ASC
         LIMIT 10
       )
     ORDER BY
       CASE WHEN spark_tier = 'ADEPT' THEN 1 WHEN spark_tier = 'CHANNELER' THEN 2 ELSE 3 END,
       ${sqlShuffle("citizen_id")}
     LIMIT 1`,
    [ward.cellId]
  );

  if (candidateRes.rows.length === 0) {
    candidateRes = await client.query(`
      SELECT citizen_id, name, profession, species, spark_tier, temper, instinct, motivation
      FROM population_demographics
      WHERE spark_tier IN ('CHANNELER', 'ADEPT', 'SENSITIVE', 'DORMANT_SPARK')
        AND allegiance_status = 'CIVILIAN'
      ORDER BY ${sqlShuffle("citizen_id")}
      LIMIT 1
    `);
  }

  if (candidateRes.rows.length === 0) {
    const cohPick = await client.query(
      `SELECT c.burg_id
       FROM population_cohorts c
       JOIN sim_burg_economy b ON b.burg_id = c.burg_id
       WHERE c.is_null = false AND c.age_band = 'ADULT' AND c.allegiance = 'CIVILIAN' AND c.count > 0
       ORDER BY cell_dist2(b.cell_id, $1) ASC, c.count DESC, c.burg_id ASC
       LIMIT 1`,
      [ward.cellId]
    );
    if (cohPick.rows.length > 0) {
      const prom = await promoteFromCohort(
        client as any,
        Number(cohPick.rows[0].burg_id),
        { ageBand: "ADULT", allegiance: "CIVILIAN", isNull: false },
        `warden:${tick}:${ward.id}`,
        tick
      );
      if (prom) {
        candidateRes = await client.query(
          `SELECT citizen_id, name, profession, species, spark_tier, temper, instinct, motivation
           FROM population_demographics WHERE citizen_id = $1`,
          [prom.citizenId]
        );
        await client.query(`DELETE FROM promoted_slots WHERE citizen_id = $1`, [prom.citizenId]);
      }
    }
  }

  const r = candidateRes.rows[0];
  const dbCitizen: WardenAwakeningCitizen | null = r
    ? {
        id: Number(r.citizen_id),
        name: String(r.name),
        profession: String(r.profession),
        species: String(r.species),
        sparkTier: String(r.spark_tier || "SENSITIVE"),
        temper: String(r.temper || "STOIC"),
        instinct: String(r.instinct || "WARY"),
        motivation: String(r.motivation || "Seeking purpose"),
      }
    : null;

  return { tick, loreDate, shouldRecharge, ward, dbCitizen };
}

/**
 * Loads all Wardens, Cultists, Mad Hermits, Sacred Groves, ancient path waypoints, and optional
 * hermit wander candidates in 3-4 flat SQL queries.
 */
export async function loadWardens(
  client: Db,
  tick: number,
  loreDate: string
): Promise<WardensSnapshot> {
  await initSpatialCache(client);

  const agentsRes = await client.query(`
    SELECT id, name, citizen_name, profession, personality_temper,
           spark_tier, sub_role, role, location_cell_id, target_cell_id,
           target_grove_id, state, corruption, age_ticks
    FROM sim_agents
    WHERE role IN ('Warden', 'Cultist', 'Mad_Hermit')
    ORDER BY id ASC
  `);

  const wardens: WardenAgentSnapshot[] = [];
  const cultists: CultistTargetSnap[] = [];
  const hermits: HermitAgentSnapshot[] = [];

  for (const r of agentsRes.rows) {
    if (r.role === "Warden") {
      wardens.push({
        id: Number(r.id),
        name: String(r.name),
        citizenName: r.citizen_name ? String(r.citizen_name) : null,
        profession: r.profession ? String(r.profession) : null,
        temper: r.personality_temper ? String(r.personality_temper) : null,
        sparkTier: r.spark_tier ? String(r.spark_tier) : null,
        subRole: r.sub_role ? String(r.sub_role) : null,
        locationCellId: r.location_cell_id !== null && r.location_cell_id !== undefined ? Number(r.location_cell_id) : null,
        targetCellId: r.target_cell_id !== null && r.target_cell_id !== undefined ? Number(r.target_cell_id) : null,
        targetGroveId: r.target_grove_id !== null && r.target_grove_id !== undefined ? Number(r.target_grove_id) : null,
        state: String(r.state || "PATROLLING_FLOW"),
        corruption: Number(r.corruption) || 0,
        ageTicks: Number(r.age_ticks) || 0,
      });
    } else if (r.role === "Cultist") {
      const cid = Number(r.location_cell_id);
      const pt = getCellCoords(cid) || { x: 0, y: 0 };
      cultists.push({
        id: Number(r.id),
        name: String(r.name),
        role: "Cultist",
        subRole: r.sub_role ? String(r.sub_role) : null,
        locationCellId: cid,
        cellId: cid,
        state: String(r.state || "INFILTRATING"),
        targetGroveId: r.target_grove_id !== null && r.target_grove_id !== undefined ? Number(r.target_grove_id) : null,
        x: pt.x,
        y: pt.y,
      });
    } else if (r.role === "Mad_Hermit") {
      hermits.push({
        id: Number(r.id),
        name: String(r.name),
        locationCellId: Number(r.location_cell_id),
        ageTicks: Number(r.age_ticks) || 0,
      });
    }
  }

  const grovesRes = await client.query(`
    SELECT g.id, g.cell_id, g.dragon_name, g.power_domain, g.seal_strength, c.center_x, c.center_y
    FROM sim_sacred_groves g
    JOIN sim_cells c ON g.cell_id = c.id
    ORDER BY g.id ASC
  `);
  const groves: GroveCoord[] = grovesRes.rows.map((r: any) => ({
    id: Number(r.id),
    cellId: Number(r.cell_id),
    dragonName: String(r.dragon_name),
    powerDomain: String(r.power_domain),
    sealStrength: Number(r.seal_strength) || 0,
    x: parseFloat(r.center_x) || 0,
    y: parseFloat(r.center_y) || 0,
  }));

  const flowWaypoints: Record<number, number[]> = {};
  const wardsRes = await client.query(
    `SELECT flow_id, cell_id FROM sim_ancient_path_wards WHERE flow_id IS NOT NULL ORDER BY flow_id ASC, cell_id ASC`
  );
  for (const r of wardsRes.rows) {
    const fid = Number(r.flow_id);
    if (!flowWaypoints[fid]) flowWaypoints[fid] = [];
    flowWaypoints[fid]!.push(Number(r.cell_id));
  }

  const hermitCandidatesByMod: Record<number, number[]> = {};
  if (hermits.length > 0) {
    const mods = Array.from(new Set(hermits.map((h) => h.locationCellId % 50)));
    const hcRes = await client.query(
      `SELECT (id % 50) AS mod_bucket, id FROM sim_cells WHERE (id % 50) = ANY($1::int[]) ORDER BY id ASC`,
      [mods]
    );
    for (const r of hcRes.rows) {
      const m = Number(r.mod_bucket);
      if (!hermitCandidatesByMod[m]) hermitCandidatesByMod[m] = [];
      hermitCandidatesByMod[m]!.push(Number(r.id));
    }
  }

  const cellCoords: Record<number, CellPoint> = {};
  const addCoord = (cid: number | null) => {
    if (!cid || cellCoords[cid]) return;
    const pt = getCellCoords(cid);
    if (pt) cellCoords[cid] = pt;
  };
  for (const g of groves) addCoord(g.cellId);
  addCoord(VERGE_COORD.cell);
  for (const w of wardens) {
    addCoord(w.locationCellId);
    addCoord(w.targetCellId);
  }
  for (const fid of Object.keys(flowWaypoints)) {
    for (const cid of flowWaypoints[Number(fid)]!) addCoord(cid);
  }

  return {
    tick,
    loreDate,
    wardens,
    cultists,
    groves,
    flowWaypoints,
    hermits,
    hermitCandidatesByMod,
    cellCoords,
    getCoord: getCellCoords,
    findNearestCell,
  };
}
