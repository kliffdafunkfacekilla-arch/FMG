import { DAYS_PER_WEEK, isYearEnd } from "../../canon/calendar.js";
import { loadCellTagMap } from "../../cellTags.js";
import type { Db } from "../../deltas/types.js";
import { goodKeyFromName, GOOD_ROLE_BY_ID } from "../../economy/goodCatalog.js";
import {
  ageCohortsYearly,
  getBurgCohortWorkforce,
  getBurgLivingTotals,
} from "../../entities/population.js";
import { recordLedger } from "./populationLedger.js";
import {
  ADULT_TRADE_MAP,
  type BurgActiveProjectSnap,
  type BurgGoodSnap,
  type BurgOperationsSnapshot,
  type BurgOpSnap,
  type BurgOutlawSnap,
} from "./types.js";

function parseJson<T>(raw: any, fallback: T): T {
  if (raw === null || raw === undefined) return fallback;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return (parsed ?? fallback) as T;
    } catch {
      return fallback;
    }
  }
  return raw as T;
}

/**
 * Prepares yearly maturation, missing `record_unit` calibrations, and weekly/missing
 * `workforce` caches, then loads immutable burg operations world context into `BurgOperationsSnapshot`.
 */
export async function prepareAndLoadBurgOperations(
  client: Db,
  tick: number,
  loreDate: string = ""
): Promise<BurgOperationsSnapshot> {
  if (isYearEnd(tick)) {
    await ageCohortsYearly(client, ADULT_TRADE_MAP);
  }

  const burgRes = await client.query(`
    SELECT b.*, c.faction_id, c.current_temp, c.base_temp,
           COALESCE(c.flux, 0)::int AS cell_flux,
           COALESCE(c.river_id, 0)::int AS river_id,
           COALESCE(c.eco_health, 100)::float8 AS cell_eco_health,
           COALESCE(c.eco_max, 100)::float8 AS cell_eco_max,
           COALESCE(r.discharge, 0)::real AS river_discharge,
           s.complex_inventory AS current_inventory
    FROM sim_burg_economy b
    LEFT JOIN sim_cells c ON b.cell_id = c.id
    LEFT JOIN sim_rivers r ON r.id = c.river_id
    LEFT JOIN sim_industrial_stockpiles s ON b.burg_id = s.burg_id
    ORDER BY b.burg_id
  `);

  // Backfill record_unit only when a burg lacks one yet
  if (burgRes.rows.some((b: any) => b.record_unit == null)) {
    const totals = await getBurgLivingTotals(client);
    const needsUnit = burgRes.rows.filter((b: any) => b.record_unit == null);
    for (const b of needsUnit) {
      const t = totals.get(Number(b.burg_id));
      const approxRecords = t ? t.notableRecords + Math.round(t.cohortPeople / 12) : 0;
      b.record_unit = recordLedger(
        Number(b.pop_null) || 0,
        Number(b.pop_attuned) || 0,
        approxRecords
      ).unit;
    }
    await client.query(
      `UPDATE sim_burg_economy b SET record_unit = v.unit
       FROM (SELECT unnest($1::int[]) AS burg_id, unnest($2::int[]) AS unit) v
       WHERE b.burg_id = v.burg_id`,
      [
        needsUnit.map((b: any) => b.burg_id),
        needsUnit.map((b: any) => b.record_unit),
      ]
    );
  }

  // Recount workforce weekly or when null
  const isWeeklyWorkforce = tick % DAYS_PER_WEEK === 0;
  const missingWorkforceIds = isWeeklyWorkforce
    ? []
    : burgRes.rows.filter((b: any) => b.workforce == null).map((b: any) => Number(b.burg_id));

  if (isWeeklyWorkforce || missingWorkforceIds.length > 0) {
    const wfMap = await getBurgCohortWorkforce(
      client,
      isWeeklyWorkforce ? undefined : missingWorkforceIds
    );
    const targetRows = isWeeklyWorkforce
      ? burgRes.rows
      : burgRes.rows.filter((b: any) => b.workforce == null);
    for (const b of targetRows) {
      b.workforce = wfMap.get(Number(b.burg_id)) || {};
    }
    if (targetRows.length > 0) {
      await client.query(
        `UPDATE sim_burg_economy b SET workforce = v.wf
         FROM (SELECT unnest($1::int[]) AS burg_id, unnest($2::jsonb[]) AS wf) v
         WHERE b.burg_id = v.burg_id`,
        [
          targetRows.map((b: any) => Number(b.burg_id)),
          targetRows.map((b: any) => JSON.stringify(b.workforce || {})),
        ]
      );
    }
  }

  const goodsRes = await client.query(`SELECT id, name, value, tags, recipes FROM sim_goods ORDER BY id`);
  const goods: BurgGoodSnap[] = goodsRes.rows.map((g: any) => {
    const gId = Number(g.id);
    const key =
      goodKeyFromName(String(g.name || "")) || GOOD_ROLE_BY_ID[gId]?.goodKey || `good_${gId}`;
    return {
      id: gId,
      name: String(g.name || ""),
      key,
      value: Number(g.value) || 1,
      recipes: parseJson<Array<Record<string, number>>>(g.recipes, []),
    };
  });

  const calRes = await client.query(
    `SELECT season, month_name, active_flow FROM sim_calendar ORDER BY id DESC LIMIT 1`
  );
  const currentSeason = String(calRes.rows[0]?.season || "Greenspan");

  const chaosRes = await client.query(
    `SELECT cell_id, intensity FROM sim_chaos_zones WHERE intensity >= 60`
  );
  const chaosIntensityEntries: Array<[number, number]> = chaosRes.rows.map((r: any) => [
    Number(r.cell_id),
    Number(r.intensity) || 0,
  ]);

  const blockadedCellIds: number[] = [];
  const floodedCellIds: number[] = [];
  const droughtCellIds: number[] = [];
  for (const [cellId, tags] of await loadCellTagMap(client)) {
    if (tags.some((t: string) => t.includes("Blockade") || t.includes("Embargo"))) {
      blockadedCellIds.push(cellId);
    }
    if (tags.some((t: string) => t.includes("RiverFlooding"))) {
      floodedCellIds.push(cellId);
    }
    if (tags.some((t: string) => t.includes("DroughtStricken"))) {
      droughtCellIds.push(cellId);
    }
  }
  blockadedCellIds.sort((a, b) => a - b);
  floodedCellIds.sort((a, b) => a - b);
  droughtCellIds.sort((a, b) => a - b);

  const infraRes = await client.query(
    `SELECT burg_id, type, level FROM sim_infrastructure ORDER BY burg_id ASC, type ASC`
  );
  const infrastructure = infraRes.rows.map((row: any) => ({
    burgId: Number(row.burg_id),
    type: String(row.type || ""),
    level: Number(row.level) || 1,
  }));

  const activeProjectsRes = await client
    .query(`SELECT id, burg_id, project_type, target_tier, ticks_remaining FROM sim_active_projects ORDER BY id ASC`)
    .catch(() => ({ rows: [] as any[] }));
  const activeProjects: BurgActiveProjectSnap[] = activeProjectsRes.rows.map((p: any) => ({
    id: Number(p.id),
    burgId: Number(p.burg_id),
    projectType: String(p.project_type || ""),
    targetTier: Number(p.target_tier) || 0,
    ticksRemaining: Number(p.ticks_remaining) || 0,
  }));

  const outlawsRes = await client.query(
    `SELECT id, COALESCE(manpower, 0)::int AS manpower FROM sim_outlaw_factions ORDER BY id ASC`
  );
  const outlaws: BurgOutlawSnap[] = outlawsRes.rows.map((r: any) => ({
    id: Number(r.id),
    manpower: Number(r.manpower) || 0,
  }));

  const occupiedFactions = Array.from(
    new Set<number>(
      burgRes.rows
        .map((b: any) => (b.occupier_faction_id ? Number(b.occupier_faction_id) : 0))
        .filter((fid: number) => fid > 0)
    )
  ).sort((a, b) => a - b);
  const occupierTraitsByFactionEntries: Array<[number, unknown]> = [];
  if (occupiedFactions.length > 0) {
    const occLeaderRes = await client
      .query(
        `SELECT DISTINCT ON (faction_id) faction_id, traits
         FROM sim_paragons
         WHERE faction_id = ANY($1::int[]) AND title IN ('Mayor', 'Marshal', 'Commander', 'Baron')
         ORDER BY faction_id ASC, id ASC`,
        [occupiedFactions]
      )
      .catch(() => ({ rows: [] as any[] }));
    for (const r of occLeaderRes.rows) {
      occupierTraitsByFactionEntries.push([Number(r.faction_id), r.traits || []]);
    }
  }

  const burgs: BurgOpSnap[] = burgRes.rows.map((b: any) => {
    const rawWf = parseJson<Record<string, any>>(b.workforce, {});
    const workforce: Record<string, { records: number; people: number }> = {};
    for (const [prof, counts] of Object.entries(rawWf)) {
      workforce[prof] = {
        records: Number(counts?.records) || 0,
        people: Number(counts?.people) || 0,
      };
    }
    return {
      burgId: Number(b.burg_id),
      name: String(b.name || `Burg #${b.burg_id}`),
      cellId: Number(b.cell_id) || 0,
      factionId: Number(b.faction_id) || 0,
      occupierFactionId:
        b.occupier_faction_id !== null && b.occupier_faction_id !== undefined
          ? Number(b.occupier_faction_id)
          : null,
      occupationTicks: Number(b.occupation_ticks) || 0,
      resistanceStrength: Number(b.resistance_strength) || 0,
      parentBurgId:
        b.parent_burg_id !== null && b.parent_burg_id !== undefined
          ? Number(b.parent_burg_id)
          : null,
      upstreamBurgId:
        b.upstream_burg_id !== null && b.upstream_burg_id !== undefined
          ? Number(b.upstream_burg_id)
          : null,
      food: Number(b.food) || 0,
      wealth: Number(b.wealth) || 0,
      health: b.health !== null && b.health !== undefined ? Number(b.health) : 100,
      unrest: Number(b.unrest) || 0,
      crimeRate: Number(b.crime_rate) || 0,
      urbanTier: Number(b.urban_tier) || 1,
      biome: b.biome !== null && b.biome !== undefined ? Number(b.biome) : null,
      architectureType: b.architecture_type ? String(b.architecture_type) : null,
      popNull: Number(b.pop_null) || 0,
      popAttuned: Number(b.pop_attuned) || 0,
      recordUnit:
        b.record_unit !== null && b.record_unit !== undefined ? Number(b.record_unit) : null,
      popGrowthPool: Number(b.pop_growth_pool) || 0,
      popDeparturePool: Number(b.pop_departure_pool) || 0,
      speciesDemographics: String(b.species_demographics || "{}"),
      militaryForces: b.military_forces,
      resourceProfile: b.resource_profile,
      production: b.production,
      currentTemp: Number(b.current_temp ?? b.base_temp ?? 15),
      baseTemp: Number(b.base_temp ?? 15),
      cellFlux: Number(b.cell_flux) || 0,
      riverId: Number(b.river_id) || 0,
      riverDischarge: Number(b.river_discharge) || 0,
      cellEcoHealth: Number(b.cell_eco_health ?? 100),
      cellEcoMax: Number(b.cell_eco_max ?? 100),
      workforce,
      inventory: parseJson<Record<string, number>>(b.current_inventory, {}),
    };
  });

  return {
    tick,
    loreDate,
    currentSeason,
    burgs,
    goods,
    chaosIntensityEntries,
    blockadedCellIds,
    floodedCellIds,
    droughtCellIds,
    infrastructure,
    activeProjects,
    outlaws,
    occupierTraitsByFactionEntries,
  };
}
