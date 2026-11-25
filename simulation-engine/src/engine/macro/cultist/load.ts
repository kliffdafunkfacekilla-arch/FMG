import { dateForTick } from "../../canon/calendar.js";
import type { Db } from "../../deltas/types.js";
import { promoteFromCohort } from "../../lod/promote.js";
import { sqlShuffle } from "../../rng.js";
import { findNearestCell, getCellCoords, initSpatialCache } from "../../agents/agentMovementHelper.js";
import type { CellPoint, OpposingAgentSnap } from "../shared/agentNav.js";
import type {
  CultistAgentSnapshot,
  CultistGroveSnapshot,
  CultistRecruitCandidate,
  CultistRecruitCitizen,
  CultistRecruitSnapshot,
  CultistsSnapshot,
} from "./step.js";

const TARGET_TOTAL_CULTISTS = 288;
const TARGET_INFILTRATOR_COUNT = 144;

/**
 * Loads Stage 1 recruitment candidates when infiltrator/total counts are below cap, batch-filtering
 * burgs with < 3 existing infiltrators and resolving notable/cohort citizens cleanly.
 */
export async function loadCultistRecruitCandidates(
  client: Db,
  tick: number,
  loreDate: string
): Promise<CultistRecruitSnapshot> {
  const countsRes = await client.query(`
    SELECT
      COUNT(*) FILTER (WHERE role = 'Cultist')::int AS total_cultists,
      COUNT(*) FILTER (WHERE role = 'Cultist' AND state = 'INFILTRATING')::int AS current_infiltrators
    FROM sim_agents
  `);
  const totalCultists = Number(countsRes.rows[0]?.total_cultists) || 0;
  const currentInfiltrators = Number(countsRes.rows[0]?.current_infiltrators) || 0;

  if (currentInfiltrators >= TARGET_INFILTRATOR_COUNT || totalCultists >= TARGET_TOTAL_CULTISTS) {
    return { tick, loreDate, candidates: [] };
  }

  const recruitBatch = Math.min(10, TARGET_INFILTRATOR_COUNT - currentInfiltrators);
  const unrestBurgsRes = await client.query(
    `SELECT b.burg_id, b.cell_id, b.wealth, b.unrest, b.name,
            COALESCE((
              SELECT COUNT(*)::int FROM sim_agents a
              WHERE a.role = 'Cultist' AND a.home_burg_id = b.burg_id AND a.state = 'INFILTRATING'
            ), 0) AS inf_cnt
     FROM sim_burg_economy b
     WHERE b.unrest >= 15
     ORDER BY b.unrest DESC, ${sqlShuffle("b.burg_id")}
     LIMIT $1`,
    [recruitBatch * 2]
  );

  const candidates: CultistRecruitCandidate[] = [];
  for (const burg of unrestBurgsRes.rows) {
    if (Number(burg.inf_cnt) >= 3) continue;
    const burgId = Number(burg.burg_id);
    const burgName = String(burg.name);

    const recruitRes = await client.query(
      `SELECT citizen_id, name, profession, species, spark_tier, temper, instinct, motivation
       FROM population_demographics
       WHERE settlement_id = $1 AND allegiance_status = 'CIVILIAN'
       ORDER BY
         CASE WHEN temper = 'FANATICAL' THEN 1 WHEN temper = 'DESPERATE' THEN 2 WHEN temper = 'GREEDY' THEN 3 ELSE 4 END,
         ${sqlShuffle("citizen_id")}
       LIMIT 1`,
      [burgId]
    );

    let citizen: CultistRecruitCitizen | null = recruitRes.rows[0]
      ? {
          dbCitizenId: Number(recruitRes.rows[0].citizen_id),
          citizenName: String(recruitRes.rows[0].name),
          profession: String(recruitRes.rows[0].profession),
          species: String(recruitRes.rows[0].species),
          sparkTier: String(recruitRes.rows[0].spark_tier || "DORMANT_SPARK"),
          temper: String(recruitRes.rows[0].temper || "DESPERATE"),
          instinct: String(recruitRes.rows[0].instinct || "WARY"),
          motivation: String(recruitRes.rows[0].motivation || ""),
        }
      : null;

    if (!citizen) {
      const promoted = await promoteFromCohort(
        client as any,
        burgId,
        { ageBand: "ADULT", allegiance: "CIVILIAN" },
        `cultist:${tick}:${burgId}`,
        tick
      );
      if (promoted) {
        const pr = await client.query(
          `SELECT name, profession, species, spark_tier, temper, instinct, motivation
           FROM population_demographics WHERE citizen_id = $1`,
          [promoted.citizenId]
        );
        const row = pr.rows[0];
        citizen = {
          dbCitizenId: promoted.citizenId,
          citizenName: String(row?.name || promoted.name),
          profession: String(row?.profession || promoted.profession),
          species: String(row?.species || promoted.species),
          sparkTier: String(row?.spark_tier || promoted.sparkTier),
          temper: String(row?.temper || "DESPERATE"),
          instinct: String(row?.instinct || "WARY"),
          motivation: String(row?.motivation || `Drawn into shadow inside ${burgName}`),
        };
        await client.query(`DELETE FROM promoted_slots WHERE citizen_id = $1`, [promoted.citizenId]);
      }
    }

    candidates.push({
      burgId,
      cellId: Number(burg.cell_id),
      wealth: Number(burg.wealth) || 0,
      unrest: Number(burg.unrest) || 0,
      burgName,
      citizen,
    });
  }

  return { tick, loreDate, candidates };
}

/**
 * Loads sacred groves (with optional sqlChance repair roll), all Cultist/Warden agents, spatial
 * coordinates, and (only when any seal is near collapse) apocalypse logs + burg IDs.
 */
export async function loadCultists(
  client: Db,
  tick: number,
  loreDate: string,
  rechargeClause: string
): Promise<CultistsSnapshot> {
  const isShadowWeek = dateForTick(tick).isShadowfall;

  await initSpatialCache(client);

  const grovesRes = await client.query(`
    SELECT g.id, g.cell_id, g.dragon_name, g.power_domain, g.seal_strength, c.center_x, c.center_y,
           (${rechargeClause})::boolean AS repair_roll
    FROM sim_sacred_groves g
    JOIN sim_cells c ON g.cell_id = c.id
    ORDER BY g.id
  `);
  const groves: CultistGroveSnapshot[] = grovesRes.rows.map((r: any) => ({
    id: Number(r.id),
    cellId: Number(r.cell_id),
    dragonName: String(r.dragon_name),
    powerDomain: String(r.power_domain),
    sealStrength: Number(r.seal_strength) || 0,
    x: parseFloat(r.center_x) || 0,
    y: parseFloat(r.center_y) || 0,
    repairRoll: Boolean(r.repair_roll),
  }));

  const agentsRes = await client.query(`
    SELECT id, name, citizen_name, profession, personality_temper,
           sub_role, home_burg_id, location_cell_id, target_cell_id,
           target_grove_id, role, state, corruption, age_ticks
    FROM sim_agents
    WHERE role IN ('Cultist', 'Warden')
    ORDER BY id ASC
  `);

  const cultists: CultistAgentSnapshot[] = [];
  const wardens: OpposingAgentSnap[] = [];
  for (const r of agentsRes.rows) {
    if (r.role === "Cultist") {
      cultists.push({
        id: Number(r.id),
        name: String(r.name),
        citizenName: r.citizen_name ? String(r.citizen_name) : null,
        profession: r.profession ? String(r.profession) : null,
        temper: r.personality_temper ? String(r.personality_temper) : null,
        subRole: r.sub_role ? String(r.sub_role) : null,
        homeBurgId: r.home_burg_id !== null && r.home_burg_id !== undefined ? Number(r.home_burg_id) : null,
        locationCellId: Number(r.location_cell_id),
        targetCellId: r.target_cell_id !== null && r.target_cell_id !== undefined ? Number(r.target_cell_id) : null,
        targetGroveId: r.target_grove_id !== null && r.target_grove_id !== undefined ? Number(r.target_grove_id) : null,
        state: String(r.state || "INFILTRATING"),
        corruption: Number(r.corruption) || 0,
        ageTicks: Number(r.age_ticks) || 0,
      });
    } else if (r.role === "Warden") {
      wardens.push({
        id: Number(r.id),
        name: String(r.name),
        role: "Warden",
        subRole: r.sub_role ? String(r.sub_role) : null,
        locationCellId: Number(r.location_cell_id),
      });
    }
  }

  const cellCoords: Record<number, CellPoint> = {};
  const addCoord = (cid: number | null) => {
    if (!cid || cellCoords[cid]) return;
    const pt = getCellCoords(cid);
    if (pt) cellCoords[cid] = pt;
  };
  for (const g of groves) addCoord(g.cellId);
  for (const c of cultists) {
    addCoord(c.locationCellId);
    addCoord(c.targetCellId);
  }

  let apocalypseLoggedMessages: string[] = [];
  let allBurgIds: number[] = [];
  const minSeal = groves.reduce((m, g) => Math.min(m, g.sealStrength), 100);
  if (minSeal <= 20) {
    const loggedRes = await client.query(`SELECT message FROM sim_events WHERE type = 'WORLD_ENDING_APOCALYPSE'`);
    apocalypseLoggedMessages = loggedRes.rows.map((r: any) => String(r.message || ""));
    const burgsRes = await client.query(`SELECT burg_id FROM sim_burg_economy ORDER BY burg_id ASC`);
    allBurgIds = burgsRes.rows.map((r: any) => Number(r.burg_id));
  }

  return {
    tick,
    loreDate,
    isShadowWeek,
    groves,
    cultists,
    wardens,
    cellCoords,
    getCoord: getCellCoords,
    findNearestCell,
    apocalypseLoggedMessages,
    allBurgIds,
  };
}
