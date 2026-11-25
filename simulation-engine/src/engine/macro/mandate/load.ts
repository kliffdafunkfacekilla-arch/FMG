import type { Db } from "../../deltas/types.js";
import { promoteFromCohort } from "../../lod/promote.js";
import { sqlShuffle } from "../../rng.js";
import { findNearestCell, getCellCoords, initSpatialCache } from "../../agents/agentMovementHelper.js";
import type { CellPoint, GroveCoord } from "../shared/agentNav.js";
import type {
  MandateRecruitCitizen,
  MandateRecruitEntry,
  MandateUnrestBurg,
  MandateWarbandSnapshot,
  MandateWarbandsSnapshot,
} from "./step.js";

/** Loads unrestful burgs eligible for new Mandate warbands in 1 query. */
export async function loadMandateRecruitCandidates(client: Db): Promise<{
  burgs: MandateUnrestBurg[];
  existingWarbandBurgIds: Set<number>;
}> {
  const res = await client.query(`
    SELECT b.burg_id, b.cell_id, b.unrest, b.name, b.pop_null,
           EXISTS(
             SELECT 1 FROM sim_agents a
             WHERE a.role = 'Chain_Zealot' AND a.home_burg_id = b.burg_id
           ) AS has_warband
    FROM sim_burg_economy b
    WHERE b.unrest >= 28 AND b.pop_null >= 100
    ORDER BY b.unrest DESC
  `);
  const existingWarbandBurgIds = new Set<number>();
  const burgs: MandateUnrestBurg[] = [];
  for (const r of res.rows) {
    const hasWarband = Boolean(r.has_warband);
    const burgId = Number(r.burg_id);
    if (hasWarband) existingWarbandBurgIds.add(burgId);
    burgs.push({
      burgId,
      cellId: Number(r.cell_id),
      unrest: Number(r.unrest) || 0,
      name: String(r.name),
      popNull: Number(r.pop_null) || 0,
      hasWarband,
    });
  }
  return { burgs, existingWarbandBurgIds };
}

/**
 * Resolves real Null civilian candidates (or cohort promotions) only for burgs chosen by Stage 1.
 */
export async function resolveMandateRecruits(
  client: Db,
  tick: number,
  chosenBurgs: MandateUnrestBurg[]
): Promise<MandateRecruitEntry[]> {
  const out: MandateRecruitEntry[] = [];
  for (const burg of chosenBurgs) {
    const recruitRes = await client.query(
      `SELECT citizen_id, name, profession, species, spark_tier, temper, instinct, motivation
       FROM population_demographics
       WHERE settlement_id = $1
         AND is_null = true
         AND allegiance_status = 'CIVILIAN'
       ORDER BY
         CASE WHEN temper = 'VENGEFUL' THEN 1 WHEN temper = 'BITTER' THEN 2 WHEN temper = 'FANATICAL' THEN 3 ELSE 4 END,
         ${sqlShuffle("citizen_id")}
       LIMIT 1`,
      [burg.burgId]
    );

    let citizen: MandateRecruitCitizen | null = recruitRes.rows[0]
      ? {
          dbCitizenId: Number(recruitRes.rows[0].citizen_id),
          citizenName: String(recruitRes.rows[0].name),
          profession: String(recruitRes.rows[0].profession),
          species: String(recruitRes.rows[0].species),
          sparkTier: String(recruitRes.rows[0].spark_tier || "NULL"),
          temper: String(recruitRes.rows[0].temper || "VENGEFUL"),
          instinct: String(recruitRes.rows[0].instinct || "WARY"),
          motivation: String(recruitRes.rows[0].motivation || ""),
        }
      : null;

    if (!citizen) {
      const promoted = await promoteFromCohort(
        client as any,
        burg.burgId,
        { ageBand: "ADULT", allegiance: "CIVILIAN", isNull: true },
        `mandate:${tick}:${burg.burgId}`,
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
          temper: String(row?.temper || "VENGEFUL"),
          instinct: String(row?.instinct || "WARY"),
          motivation: String(row?.motivation || `Bitter Null laborer of ${burg.name}`),
        };
        await client.query(`DELETE FROM promoted_slots WHERE citizen_id = $1`, [promoted.citizenId]);
      }
    }

    out.push({ burg, citizen });
  }
  return out;
}

/**
 * Loads all active Chain_Zealot warbands, plus sacred groves and home burg cells when any exist.
 */
export async function loadMandateWarbands(
  client: Db,
  tick: number,
  loreDate: string
): Promise<MandateWarbandsSnapshot> {
  const warbandsRes = await client.query(`
    SELECT id, name, citizen_name, profession, personality_temper,
           sub_role, home_burg_id, location_cell_id, target_cell_id,
           target_grove_id, state, drained_power, age_ticks
    FROM sim_agents
    WHERE role = 'Chain_Zealot' ORDER BY id
  `);

  const warbands: MandateWarbandSnapshot[] = warbandsRes.rows.map((wb: any) => ({
    id: Number(wb.id),
    name: String(wb.name),
    citizenName: wb.citizen_name ? String(wb.citizen_name) : null,
    profession: wb.profession ? String(wb.profession) : null,
    temper: wb.personality_temper ? String(wb.personality_temper) : null,
    subRole: wb.sub_role ? String(wb.sub_role) : null,
    homeBurgId: wb.home_burg_id !== null && wb.home_burg_id !== undefined ? Number(wb.home_burg_id) : null,
    locationCellId: Number(wb.location_cell_id),
    targetCellId: wb.target_cell_id !== null && wb.target_cell_id !== undefined ? Number(wb.target_cell_id) : null,
    targetGroveId: wb.target_grove_id !== null && wb.target_grove_id !== undefined ? Number(wb.target_grove_id) : null,
    state: String(wb.state || "WITCH_HUNTING"),
    drainedPower: Number(wb.drained_power) || 0,
    ageTicks: Number(wb.age_ticks) || 0,
  }));

  if (warbands.length === 0) {
    return { tick, loreDate, warbands: [], groves: [], homeCellByBurg: {}, cellCoords: {} };
  }

  await initSpatialCache(client);

  const grovesRes = await client.query(`
    SELECT g.id, g.cell_id, g.dragon_name, g.power_domain, g.seal_strength, c.center_x, c.center_y
    FROM sim_sacred_groves g
    JOIN sim_cells c ON g.cell_id = c.id ORDER BY g.id
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

  const homeBurgIds = Array.from(
    new Set(warbands.map((w) => w.homeBurgId).filter((b): b is number => b !== null && b > 0))
  ).sort((a, b) => a - b);

  const homeCellByBurg: Record<number, number> = {};
  if (homeBurgIds.length > 0) {
    const hcRes = await client.query(
      `SELECT burg_id, cell_id FROM sim_burg_economy WHERE burg_id = ANY($1::int[])`,
      [homeBurgIds]
    );
    for (const r of hcRes.rows) {
      homeCellByBurg[Number(r.burg_id)] = Number(r.cell_id);
    }
  }

  const cellCoords: Record<number, CellPoint> = {};
  const addCoord = (cid: number | null) => {
    if (!cid || cellCoords[cid]) return;
    const pt = getCellCoords(cid);
    if (pt) cellCoords[cid] = pt;
  };
  for (const g of groves) addCoord(g.cellId);
  for (const w of warbands) {
    addCoord(w.locationCellId);
    addCoord(w.targetCellId);
  }

  return {
    tick,
    loreDate,
    warbands,
    groves,
    homeCellByBurg,
    cellCoords,
    findNearestCell,
  };
}
