import { flushStepDeltas } from "../../deltas/index.js";
import type { Db, Delta, RejectedDelta } from "../../deltas/types.js";
import { goodKeyFromName, GOOD_ROLE_BY_ID } from "../../economy/goodCatalog.js";
import { ensureRouteGraphCache, type TransportMode } from "../../economy/routeGraphRouter.js";
import { adjustCohortsBatch, ageCohortsYearly, retireFromCohortsBatch, zeroBurgsCohorts } from "../../entities/population.js";
import { promoteBatchFromCohorts } from "../../lod/promote.js";
import { computeChaosFlowState, lunarSurgeModifier, parseChaosFlowAnchor, type ChaosFlowAnchor, type LiveChaosFlowState } from "../chaosFlow/step.js";
import { cohortKeyStr } from "./applyMemory.js";
import {
  SPATIAL_BUCKET_SIZE,
  type InMemoryAgent,
  type InMemoryAncientWard,
  type InMemoryBurg,
  type InMemoryCalendarState,
  type InMemoryChaosZone,
  type InMemoryCitizen,
  type InMemoryCohort,
  type InMemoryCommodityPrice,
  type InMemoryDiplomacy,
  type InMemoryEvent,
  type InMemoryFaction,
  type InMemoryFactionUnit,
  type InMemoryFringeLair,
  type InMemoryGhostwindDrop,
  type InMemoryGrindCanyon,
  type InMemoryGrove,
  type InMemoryInfrastructure,
  type InMemoryMarket,
  type InMemoryNpcInstance,
  type InMemoryOutlawFaction,
  type InMemoryParagon,
  type InMemoryScheduledEvent,
  type InMemoryStanding,
  type InMemoryStoryline,
  type InMemoryTradeShipment,
  type InMemoryDayResult,
  type StepCreatedSyntheticIds,
  type StaticRiverMeta,
  type WorldMutable,
  type WorldSnapshot,
  type WorldStatic,
} from "./types.js";

function parseJson<T>(raw: unknown, fallback: T): T {
  if (raw === null || raw === undefined) return fallback;
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw);
      return (p ?? fallback) as T;
    } catch {
      return fallback;
    }
  }
  return raw as T;
}

/**
 * Loads one complete continental snapshot from PostgreSQL using strictly read-only SELECT queries
 * (never opens a transaction or writes any row) so multi-day branches can execute purely in memory.
 */
export async function loadWorldSnapshot(db: Db): Promise<WorldSnapshot> {
  await ensureRouteGraphCache(db);

  const cellsRes = await db.query(`
    SELECT id, center_x, center_y, COALESCE(elevation, 50)::int AS elevation,
           biome, COALESCE(base_temp, 15)::real AS base_temp,
           COALESCE(river_id, 0)::int AS river_id, COALESCE(flux, 0)::int AS flux,
           COALESCE(market_id, 0)::int AS market_id,
           COALESCE(eco_health, 100)::real AS eco_health, COALESCE(eco_max, 100)::real AS eco_max,
           COALESCE(eco_plants, 50)::real AS eco_plants, COALESCE(eco_prey, 50)::real AS eco_prey,
           COALESCE(eco_predators, 10)::real AS eco_predators, COALESCE(eco_apex, 5)::real AS eco_apex,
           COALESCE(eco_blight, 0)::real AS eco_blight,
           COALESCE(current_temp, base_temp, 15)::real AS current_temp,
           COALESCE(faction_id, 0)::int AS faction_id,
           COALESCE(culture_id, 0)::int AS culture_id,
           COALESCE(religion_id, 0)::int AS religion_id
    FROM sim_cells
    ORDER BY id ASC
  `);

  const n = cellsRes.rows.length;
  const cellIds = new Array<number>(n);
  const cellIndexById = new Map<number, number>();
  const cellCenterX = new Float64Array(n);
  const cellCenterY = new Float64Array(n);
  const cellElevation = new Int16Array(n);
  const cellBiome = new Int16Array(n);
  const cellBaseTemp = new Float32Array(n);
  const cellRiverId = new Int32Array(n);
  const cellFlux = new Int32Array(n);
  const cellMarketId = new Int32Array(n);
  const ecoHealth = new Float32Array(n);
  const ecoMax = new Float32Array(n);
  const ecoPlants = new Float32Array(n);
  const ecoPrey = new Float32Array(n);
  const ecoPredators = new Float32Array(n);
  const ecoApex = new Float32Array(n);
  const ecoBlight = new Float32Array(n);
  const currentTemp = new Float32Array(n);
  const factionId = new Int32Array(n);
  const cultureId = new Int32Array(n);
  const religionId = new Int32Array(n);
  const spatialBuckets = new Map<string, number[]>();

  let minX = n > 0 ? Infinity : 0;
  let maxX = n > 0 ? -Infinity : 6120;
  let minY = n > 0 ? Infinity : 0;
  let maxY = n > 0 ? -Infinity : 2496;

  for (let i = 0; i < n; i++) {
    const r = cellsRes.rows[i];
    const id = Number(r.id);
    const cx = Number(r.center_x) || 0;
    const cy = Number(r.center_y) || 0;
    if (cx < minX) minX = cx;
    if (cx > maxX) maxX = cx;
    if (cy < minY) minY = cy;
    if (cy > maxY) maxY = cy;

    cellIds[i] = id;
    cellIndexById.set(id, i);
    cellCenterX[i] = cx;
    cellCenterY[i] = cy;
    cellElevation[i] = Number(r.elevation) || 0;
    cellBiome[i] = Number(r.biome) || 0;
    cellBaseTemp[i] = Number(r.base_temp) || 15;
    cellRiverId[i] = Number(r.river_id) || 0;
    cellFlux[i] = Number(r.flux) || 0;
    cellMarketId[i] = Number(r.market_id) || 0;

    ecoHealth[i] = Number(r.eco_health ?? 100);
    ecoMax[i] = Number(r.eco_max ?? 100);
    ecoPlants[i] = Number(r.eco_plants ?? 50);
    ecoPrey[i] = Number(r.eco_prey ?? 50);
    ecoPredators[i] = Number(r.eco_predators ?? 10);
    ecoApex[i] = Number(r.eco_apex ?? 5);
    ecoBlight[i] = Number(r.eco_blight ?? 0);
    currentTemp[i] = Number(r.current_temp ?? 15);
    factionId[i] = Number(r.faction_id) || 0;
    cultureId[i] = Number(r.culture_id) || 0;
    religionId[i] = Number(r.religion_id) || 0;

    const bk = `${Math.floor(cx / SPATIAL_BUCKET_SIZE)},${Math.floor(cy / SPATIAL_BUCKET_SIZE)}`;
    let list = spatialBuckets.get(bk);
    if (!list) {
      list = [];
      spatialBuckets.set(bk, list);
    }
    list.push(i);
  }
  maxX = Math.max(minX + 1, maxX);
  maxY = Math.max(minY + 1, maxY);

  const [
    riversRes,
    goodsRes,
    flowsRes,
    bordersRes,
    culturesRes,
    religionsRes,
    dealsRes,
    routesRes,
    routeGraphRes,
    calRes,
    burgsRes,
    stockRes,
    infraRes,
    projRes,
    frontsRes,
    zonesRes,
    factionsRes,
    unitsRes,
    diploRes,
    paragonsRes,
    outlawsRes,
    lairsRes,
    canyonsRes,
    dropsRes,
    marketsRes,
    pricesRes,
    agentsRes,
    grovesRes,
    wardsRes,
    shipmentsRes,
    citizensRes,
    cohortsRes,
    cohCrewRes,
    tagsRes,
    npcRes,
    layersRes,
    eventsRes,
    storylinesRes,
    schedRes,
    standingRes,
  ] = await Promise.all([
    db.query(`SELECT id, name, COALESCE(discharge, 0)::real AS discharge, COALESCE(width, 0)::real AS width FROM sim_rivers ORDER BY id ASC`),
    db.query(`SELECT id, name, value, carriage, recipes FROM sim_goods ORDER BY id ASC`),
    db.query(`SELECT * FROM sim_chaos_flows ORDER BY flow_id ASC`),
    db.query(`SELECT faction_a, faction_b FROM sim_faction_borders ORDER BY id ASC`),
    db.query(`SELECT id, name, COALESCE(cells, 0)::int AS cells FROM sim_cultures ORDER BY id ASC`),
    db.query(`SELECT id, name, type, COALESCE(cells, 0)::int AS cells FROM sim_religions ORDER BY id ASC`),
    db.query(`SELECT from_burg_id, to_market_id, good_id, COALESCE(transport_cost, 0)::real AS transport_cost FROM sim_trade_deals ORDER BY id ASC`),
    db.query(`SELECT source_burg_id, dest_burg_id, volume, risk_level, status FROM sim_trade_routes ORDER BY source_burg_id, dest_burg_id`),
    db.query(`SELECT cell_id FROM sim_route_graph`),
    db.query(`SELECT * FROM sim_calendar ORDER BY id DESC LIMIT 1`),
    db.query(`SELECT * FROM sim_burg_economy ORDER BY burg_id ASC`),
    db.query(`SELECT burg_id, complex_inventory FROM sim_industrial_stockpiles ORDER BY burg_id ASC`),
    db.query(`SELECT burg_id, cell_id, type, COALESCE(level, 1)::int AS level, COALESCE(status, 'ACTIVE') AS status FROM sim_infrastructure ORDER BY burg_id ASC, type ASC`),
    db.query(`SELECT id, burg_id, project_type, target_tier, ticks_remaining FROM sim_active_projects ORDER BY id ASC`),
    db.query(`SELECT id, type, x, y, dx, dy, radius, lifetime FROM sim_weather_fronts ORDER BY id ASC`),
    db.query(`SELECT id, cell_id, intensity, type FROM sim_chaos_zones ORDER BY id ASC`),
    db.query(`SELECT * FROM sim_factions ORDER BY id ASC`),
    db.query(`SELECT * FROM sim_faction_units ORDER BY id ASC`),
    db.query(`SELECT faction_a_id, faction_b_id, status, COALESCE(tension, 0)::int AS tension FROM sim_diplomacy ORDER BY faction_a_id, faction_b_id`),
    db.query(`SELECT * FROM sim_paragons ORDER BY id ASC`),
    db.query(`SELECT * FROM sim_outlaw_factions ORDER BY id ASC`),
    db.query(`SELECT * FROM sim_fringe_lairs ORDER BY id ASC`),
    db.query(`SELECT * FROM sim_grind_canyons ORDER BY id ASC`),
    db.query(`SELECT * FROM sim_ghostwind_dead_drops ORDER BY id ASC`),
    db.query(`SELECT id, center_burg_id, goods FROM sim_markets ORDER BY id ASC`),
    db.query(`SELECT commodity, base_price, current_price, global_supply, global_demand, last_updated_tick FROM sim_commodity_prices ORDER BY commodity ASC`),
    db.query(`SELECT * FROM sim_agents ORDER BY id ASC`),
    db.query(`SELECT id, cell_id, dragon_name, power_domain, COALESCE(seal_strength, 100)::int AS seal_strength FROM sim_sacred_groves ORDER BY id ASC`),
    db.query(`SELECT id, cell_id, flow_id, path_name, is_charged, COALESCE(last_triggered_tick, 0)::int AS last_triggered_tick, COALESCE(recharge_ticks, 30)::int AS recharge_ticks FROM sim_ancient_path_wards ORDER BY id ASC`),
    db.query(`SELECT * FROM sim_trade_shipments ORDER BY id ASC`),
    db.query(`SELECT * FROM population_demographics ORDER BY citizen_id ASC`),
    db.query(`SELECT burg_id, species, profession, age_band, spark_tier, is_null, allegiance, count FROM population_cohorts WHERE count > 0`),
    db.query(`SELECT burg_id, profession, COALESCE(SUM(count), 0)::int AS cnt FROM population_cohorts WHERE profession IN ('Merchant Factor','Merchant Trader','Caravan Drover','Caravan Guard','Sailor','Aether-Crew') AND age_band='ADULT' AND allegiance='CIVILIAN' AND count > 0 GROUP BY burg_id, profession ORDER BY burg_id ASC, profession ASC`),
    db.query(`SELECT cell_id, tags FROM sim_cell_tags WHERE z_layer = 0 ORDER BY cell_id ASC`),
    db.query(`SELECT *, (updated_at >= NOW() - INTERVAL '1 day') AS recent FROM sim_npc_instances ORDER BY id ASC`),
    db.query(`SELECT cell_id, rx, ry, z_layer, npcs, props, features FROM sim_sector_layers ORDER BY cell_id, rx, ry, z_layer`),
    db.query(`SELECT id, tick, type, message, tier, lore_date, burg_id, cell_id, faction_id, outlaw_id FROM sim_events ORDER BY id ASC`),
    db.query(`SELECT id, scale, state, cell_id, rx, ry, z, rule_id, question, stakes, actor_ids, hook, clock, clock_max FROM storylines ORDER BY id ASC`),
    db.query(`SELECT id, due_tick, due_minute, kind, payload, created_tick, fired_tick FROM scheduled_events ORDER BY id ASC`),
    db.query(`SELECT subject_ref, party_ref, value, reasons FROM standing`),
  ]);

  const rivers = new Map<number, StaticRiverMeta>();
  for (const r of riversRes.rows) {
    rivers.set(Number(r.id), {
      id: Number(r.id),
      name: r.name ? String(r.name) : null,
      discharge: Number(r.discharge) || 0,
      width: Number(r.width) || 0,
    });
  }

  const goods = goodsRes.rows.map((g: any) => {
    const id = Number(g.id);
    return {
      id,
      name: String(g.name || ""),
      key: goodKeyFromName(String(g.name || "")) || GOOD_ROLE_BY_ID[id]?.goodKey || `good_${id}`,
      value: Number(g.value) || 1,
      carriage: Number(g.carriage) || 1,
      recipes: parseJson<Array<Record<string, number>>>(g.recipes, []),
    };
  });

  const chaosFlowAnchors: ChaosFlowAnchor[] = [];
  const chaosFlows = new Map<number, LiveChaosFlowState>();
  const calRow = calRes.rows[0] || {};
  const initCal: InMemoryCalendarState = {
    id: calRow.id !== undefined ? Number(calRow.id) : null,
    tick: Number(calRow.tick) || 0,
    year: Number(calRow.year) || 1,
    month: Number(calRow.month) || 1,
    monthName: String(calRow.month_name || "Nexar"),
    dayOfMonth: Number(calRow.day_of_month) || 1,
    dayOfYear: Number(calRow.day_of_year) || 1,
    season: String(calRow.season || "Greenspan"),
    moonPhase: String(calRow.moon_phase || "The Halo"),
    activeFlow: String(calRow.active_flow || "Mass"),
    dragonDomain: String(calRow.dragon_domain || "Tiraton"),
    isShadowWeek: Boolean(calRow.is_shadow_week),
  };

  for (const r of flowsRes.rows) {
    const anchor = parseChaosFlowAnchor(r);
    if (anchor) {
      chaosFlowAnchors.push(anchor);
      chaosFlows.set(
        anchor.flowId,
        computeChaosFlowState(anchor, initCal.tick, {
          activeFlow: initCal.activeFlow,
          dragonDomain: initCal.dragonDomain,
          lunarSurgeMod: lunarSurgeModifier(initCal.moonPhase),
        })
      );
    }
  }

  const cultureCellCounts = new Map<number, number>();
  const cultures = culturesRes.rows.map((r: any) => {
    const id = Number(r.id);
    cultureCellCounts.set(id, Number(r.cells) || 0);
    return { id, name: String(r.name) };
  });
  const religionCellCounts = new Map<number, number>();
  const religions = religionsRes.rows.map((r: any) => {
    const id = Number(r.id);
    religionCellCounts.set(id, Number(r.cells) || 0);
    return { id, name: String(r.name), type: String(r.type || "") };
  });

  const staticWorld: WorldStatic = {
    bounds: { minX, maxX, minY, maxY },
    cellIds,
    cellIndexById,
    cellCenterX,
    cellCenterY,
    cellElevation,
    cellBiome,
    cellBaseTemp,
    cellRiverId,
    cellFlux,
    cellMarketId,
    spatialBuckets,
    rivers,
    goods,
    chaosFlowAnchors,
    factionBorders: bordersRes.rows.map((r: any) => ({ factionA: Number(r.faction_a), factionB: Number(r.faction_b) })),
    cultures,
    religions,
    tradeDeals: dealsRes.rows.map((d: any) => ({
      fromBurgId: Number(d.from_burg_id),
      toMarketId: Number(d.to_market_id),
      goodId: Number(d.good_id),
      transportCost: Number(d.transport_cost) || 0,
    })),
    tradeRoutes: routesRes.rows.map((r: any) => ({
      sourceBurgId: Number(r.source_burg_id),
      destBurgId: Number(r.dest_burg_id),
      volume: Number(r.volume) || 0,
      riskLevel: Number(r.risk_level) || 0,
      status: String(r.status || "ACTIVE"),
    })),
    routeGraphCellIds: new Set<number>(routeGraphRes.rows.map((r: any) => Number(r.cell_id))),
  };

  const burgs = new Map<number, InMemoryBurg>();
  for (const b of burgsRes.rows) {
    const bid = Number(b.burg_id);
    const rawWf = b.workforce !== null && b.workforce !== undefined ? parseJson<Record<string, any>>(b.workforce, {}) : null;
    let workforce: InMemoryBurg["workforce"] = null;
    if (rawWf !== null) {
      workforce = {};
      for (const [prof, cnt] of Object.entries(rawWf)) {
        workforce[prof] = { records: Number(cnt?.records) || 0, people: Number(cnt?.people) || 0 };
      }
    }
    burgs.set(bid, {
      burgId: bid,
      name: String(b.name || `Burg #${bid}`),
      cellId: Number(b.cell_id) || 0,
      parentBurgId: b.parent_burg_id !== null && b.parent_burg_id !== undefined ? Number(b.parent_burg_id) : null,
      upstreamBurgId: b.upstream_burg_id !== null && b.upstream_burg_id !== undefined ? Number(b.upstream_burg_id) : null,
      settlementType: b.settlement_type ? String(b.settlement_type) : null,
      isCapital: Boolean(b.is_capital),
      port: Boolean(b.port),
      citadel: Boolean(b.citadel),
      walls: Boolean(b.walls),
      plaza: Boolean(b.plaza),
      temple: Boolean(b.temple),
      shanty: Boolean(b.shanty),
      occupierFactionId: b.occupier_faction_id !== null && b.occupier_faction_id !== undefined ? Number(b.occupier_faction_id) : null,
      occupationTicks: Number(b.occupation_ticks) || 0,
      resistanceStrength: Number(b.resistance_strength) || 0,
      food: Number(b.food) || 0,
      wealth: Number(b.wealth) || 0,
      health: b.health !== null && b.health !== undefined ? Number(b.health) : 100,
      unrest: Number(b.unrest) || 0,
      crimeRate: Number(b.crime_rate) || 0,
      rawMaterials: Number(b.raw_materials) || 0,
      refinedGoods: Number(b.refined_goods) || 0,
      urbanTier: Number(b.urban_tier) || 0,
      biome: b.biome !== null && b.biome !== undefined ? Number(b.biome) : null,
      architectureType: b.architecture_type ? String(b.architecture_type) : null,
      popNull: Number(b.pop_null) || 0,
      popAttuned: Number(b.pop_attuned) || 0,
      recordUnit: b.record_unit !== null && b.record_unit !== undefined ? Number(b.record_unit) : null,
      popGrowthPool: Number(b.pop_growth_pool) || 0,
      popDeparturePool: Number(b.pop_departure_pool) || 0,
      speciesDemographics: String(b.species_demographics || "{}"),
      demographics: String(b.demographics || "{}"),
      militaryForces: b.military_forces,
      resourceProfile: b.resource_profile,
      production: b.production,
      workforce,
    });
  }

  const stockpiles = new Map<number, Record<string, number>>();
  for (const r of stockRes.rows) stockpiles.set(Number(r.burg_id), parseJson(r.complex_inventory, {}));

  const infrastructure = new Map<string, InMemoryInfrastructure>();
  for (const r of infraRes.rows) {
    const item = {
      burgId: Number(r.burg_id),
      cellId: Number(r.cell_id),
      type: String(r.type),
      level: Number(r.level) || 1,
      status: String(r.status || "ACTIVE"),
    };
    infrastructure.set(`${item.burgId}:${item.type}`, item);
  }

  let nextProjectId = 1;
  const activeProjects = projRes.rows.map((p: any) => {
    const id = Number(p.id);
    if (id >= nextProjectId) nextProjectId = id + 1;
    return {
      id,
      burgId: Number(p.burg_id),
      projectType: String(p.project_type),
      targetTier: Number(p.target_tier),
      ticksRemaining: Number(p.ticks_remaining),
    };
  });

  const weatherFronts = new Map<number, any>();
  let nextFrontId = 1;
  for (const r of frontsRes.rows) {
    const id = Number(r.id);
    if (id >= nextFrontId) nextFrontId = id + 1;
    weatherFronts.set(id, {
      id,
      type: String(r.type || "STORM"),
      x: Number(r.x || 0),
      y: Number(r.y || 0),
      dx: Number(r.dx || 0),
      dy: Number(r.dy || 0),
      radius: Number(r.radius || 15),
      lifetime: Number(r.lifetime || 0),
    });
  }

  const chaosZones = new Map<string, InMemoryChaosZone>();
  let nextChaosZoneId = 1;
  for (const r of zonesRes.rows) {
    const id = Number(r.id);
    if (id >= nextChaosZoneId) nextChaosZoneId = id + 1;
    const z: InMemoryChaosZone = { id, cellId: Number(r.cell_id), intensity: Number(r.intensity || 0), type: String(r.type) };
    chaosZones.set(`${z.cellId}|${z.type}`, z);
  }

  const factions = new Map<number, InMemoryFaction>();
  for (const r of factionsRes.rows) {
    const id = Number(r.id);
    factions.set(id, {
      id,
      name: String(r.name),
      cultureId: r.culture_id !== null && r.culture_id !== undefined ? Number(r.culture_id) : null,
      treasury: Number(r.treasury || 0),
      fiscalEconomy: r.fiscal_economy,
      traitAggression: r.trait_aggression !== undefined ? Number(r.trait_aggression) : undefined,
      traitEconomy: r.trait_economy !== undefined ? Number(r.trait_economy) : undefined,
      traitMagic: r.trait_magic !== undefined ? Number(r.trait_magic) : undefined,
      extra: { ...r },
    });
  }

  const factionUnits = new Map<number, InMemoryFactionUnit>();
  for (const r of unitsRes.rows) {
    const id = Number(r.id);
    factionUnits.set(id, { id, factionId: Number(r.faction_id), count: Number(r.count || 0), status: String(r.status || "ACTIVE"), extra: { ...r } });
  }

  const diplomacy = new Map<string, InMemoryDiplomacy>();
  for (const r of diploRes.rows) {
    diplomacy.set(`${r.faction_a_id}:${r.faction_b_id}`, {
      factionAId: Number(r.faction_a_id),
      factionBId: Number(r.faction_b_id),
      status: String(r.status),
      tension: Number(r.tension || 0),
    });
  }

  const paragons = new Map<number, InMemoryParagon>();
  for (const r of paragonsRes.rows) {
    const id = Number(r.id);
    paragons.set(id, {
      id,
      burgId: r.burg_id !== null && r.burg_id !== undefined ? Number(r.burg_id) : null,
      factionId: r.faction_id !== null && r.faction_id !== undefined ? Number(r.faction_id) : null,
      outlawId: r.outlaw_id !== null && r.outlaw_id !== undefined ? Number(r.outlaw_id) : null,
      domain: r.domain ? String(r.domain) : null,
      title: String(r.title || ""),
      name: String(r.name || ""),
      traits: r.traits,
      want: r.want ? String(r.want) : null,
      flaw: r.flaw ? String(r.flaw) : null,
      lineWontCross: r.line_wont_cross ? String(r.line_wont_cross) : null,
      corruptionScore: Number(r.corruption_score || 0),
    });
  }

  const outlaws = new Map<number, InMemoryOutlawFaction>();
  for (const r of outlawsRes.rows) {
    const id = Number(r.id);
    outlaws.set(id, {
      id,
      name: String(r.name),
      type: String(r.type || "CARTEL"),
      originCellId: r.origin_cell_id !== null && r.origin_cell_id !== undefined ? Number(r.origin_cell_id) : null,
      originBurgId: r.origin_burg_id !== null && r.origin_burg_id !== undefined ? Number(r.origin_burg_id) : null,
      manpower: Number(r.manpower || 0),
      wealth: Number(r.wealth || 0),
      heat: Number(r.heat || 0),
      workerGroups: Number(r.worker_groups ?? 3),
    });
  }

  const lairs = new Map<number, InMemoryFringeLair>();
  let nextLairId = 1;
  for (const r of lairsRes.rows) {
    const id = Number(r.id);
    if (id >= nextLairId) nextLairId = id + 1;
    lairs.set(id, {
      id,
      factionId: Number(r.faction_id),
      cellId: Number(r.cell_id),
      burgId: r.burg_id !== null && r.burg_id !== undefined ? Number(r.burg_id) : null,
      lairType: String(r.lair_type),
      manpower: Number(r.manpower || 0),
      heat: Number(r.heat || 0),
      inventory: parseJson(r.inventory, {}),
    });
  }

  const grindCanyons = new Map<number, InMemoryGrindCanyon>();
  let nextCanyonId = 1;
  for (const r of canyonsRes.rows) {
    const id = Number(r.id);
    if (id >= nextCanyonId) nextCanyonId = id + 1;
    grindCanyons.set(id, {
      id,
      name: String(r.name),
      cellId: Number(r.cell_id),
      dragonName: String(r.dragon_name),
      dragonDomain: String(r.dragon_domain),
      dragonstoneRichness: Number(r.dragonstone_richness || 0),
      stabilityTicksRemaining: Number(r.stability_ticks_remaining || 0),
      status: (r.status === "COLLAPSING" ? "COLLAPSING" : r.status === "SEALED" ? "SEALED" : "OPEN"),
      minerCrewName: String(r.miner_crew_name),
      closedTick: r.closed_tick !== null && r.closed_tick !== undefined ? Number(r.closed_tick) : null,
    });
  }

  const ghostwindDrops = new Map<number, InMemoryGhostwindDrop>();
  let nextDropId = 1;
  for (const r of dropsRes.rows) {
    const id = Number(r.id);
    if (id >= nextDropId) nextDropId = id + 1;
    ghostwindDrops.set(id, {
      id,
      createdTick: Number(r.created_tick || 0),
      executedTick: r.executed_tick !== null && r.executed_tick !== undefined ? Number(r.executed_tick) : null,
      status: r.status === "EXECUTED" ? "EXECUTED" : "PENDING",
      clientFactionId: Number(r.client_faction_id),
      targetFactionId: Number(r.target_faction_id),
      targetBurgId: Number(r.target_burg_id),
      bountyGold: Number(r.bounty_gold || 0),
    });
  }

  const markets = new Map<number, InMemoryMarket>();
  for (const r of marketsRes.rows) {
    markets.set(Number(r.id), { id: Number(r.id), centerBurgId: Number(r.center_burg_id || 0), goods: parseJson(r.goods, {}) });
  }
  const commodityPrices = new Map<string, InMemoryCommodityPrice>();
  for (const r of pricesRes.rows) {
    commodityPrices.set(String(r.commodity), {
      commodity: String(r.commodity),
      basePrice: Number(r.base_price || 1),
      currentPrice: Number(r.current_price || 1),
      globalSupply: Number(r.global_supply || 0),
      globalDemand: Number(r.global_demand || 0),
      lastUpdatedTick: Number(r.last_updated_tick || 0),
    });
  }

  const agents = new Map<number, InMemoryAgent>();
  let nextAgentId = 1;
  for (const r of agentsRes.rows) {
    const id = Number(r.id);
    if (id >= nextAgentId) nextAgentId = id + 1;
    agents.set(id, {
      id,
      name: String(r.name),
      role: String(r.role),
      subRole: r.sub_role ? String(r.sub_role) : null,
      citizenName: r.citizen_name ? String(r.citizen_name) : null,
      profession: r.profession ? String(r.profession) : null,
      species: r.species ? String(r.species) : null,
      sparkTier: r.spark_tier ? String(r.spark_tier) : null,
      personalityTemper: r.personality_temper ? String(r.personality_temper) : null,
      personalityInstinct: r.personality_instinct ? String(r.personality_instinct) : null,
      motivation: r.motivation ? String(r.motivation) : null,
      locationCellId: Number(r.location_cell_id || 0),
      targetCellId: r.target_cell_id !== null && r.target_cell_id !== undefined ? Number(r.target_cell_id) : null,
      targetGroveId: r.target_grove_id !== null && r.target_grove_id !== undefined ? Number(r.target_grove_id) : null,
      homeBurgId: r.home_burg_id !== null && r.home_burg_id !== undefined ? Number(r.home_burg_id) : null,
      factionId: r.faction_id !== null && r.faction_id !== undefined ? Number(r.faction_id) : null,
      state: String(r.state || ""),
      corruption: Number(r.corruption || 0),
      drainedPower: Number(r.drained_power || 0),
      ageTicks: Number(r.age_ticks || 0),
      activePlot: r.active_plot ? String(r.active_plot) : null,
    });
  }

  const groves = new Map<number, InMemoryGrove>();
  for (const r of grovesRes.rows) {
    groves.set(Number(r.id), {
      id: Number(r.id),
      cellId: Number(r.cell_id),
      dragonName: String(r.dragon_name),
      powerDomain: String(r.power_domain),
      sealStrength: Number(r.seal_strength || 0),
    });
  }

  const ancientWards = new Map<number, InMemoryAncientWard>();
  for (const r of wardsRes.rows) {
    ancientWards.set(Number(r.id), {
      id: Number(r.id),
      cellId: Number(r.cell_id),
      flowId: r.flow_id !== null && r.flow_id !== undefined ? Number(r.flow_id) : null,
      pathName: String(r.path_name || ""),
      isCharged: Boolean(r.is_charged),
      lastTriggeredTick: Number(r.last_triggered_tick || 0),
      rechargeTicks: Number(r.recharge_ticks || 30),
    });
  }

  const tradeShipments = new Map<number, InMemoryTradeShipment>();
  let nextShipmentId = 1;
  for (const r of shipmentsRes.rows) {
    const id = Number(r.id);
    if (id >= nextShipmentId) nextShipmentId = id + 1;
    tradeShipments.set(id, {
      id,
      sourceBurgId: Number(r.source_burg_id),
      destBurgId: Number(r.dest_burg_id),
      sourceFactionId: Number(r.source_faction_id || 0),
      destFactionId: Number(r.dest_faction_id || 0),
      transportMode: (r.transport_mode || "LAND") as TransportMode,
      goodId: Number(r.good_id || 0),
      goodKey: String(r.good_key || ""),
      goodName: String(r.good_name || ""),
      quantity: Number(r.quantity || 0),
      unitPrice: Number(r.unit_price || 0),
      totalGold: Number(r.total_gold || 0),
      tariffGold: Number(r.tariff_gold || 0),
      carriageWeight: Number(r.carriage_weight || 0),
      merchantCitizenId: Number(r.merchant_citizen_id || 0),
      crewCitizenIds: parseJson<number[]>(r.crew_citizen_ids, []).map(Number),
      guardCount: Number(r.guard_count || 0),
      pathCells: parseJson<number[]>(r.path_cells, []).map(Number),
      pathIndex: Number(r.path_index || 0),
      currentCellId: Number(r.current_cell_id || 0),
      status: String(r.status || "IN_TRANSIT"),
      dispatchedTick: Number(r.dispatched_tick || 0),
      etaTicks: Number(r.eta_ticks || 1),
      resolvedTick: r.resolved_tick !== null && r.resolved_tick !== undefined ? Number(r.resolved_tick) : null,
    });
  }

  const citizens = new Map<number, InMemoryCitizen>();
  let nextCitizenId = 1;
  for (const r of citizensRes.rows) {
    const cid = Number(r.citizen_id);
    if (cid >= nextCitizenId) nextCitizenId = cid + 1;
    citizens.set(cid, {
      citizenId: cid,
      settlementId: Number(r.settlement_id || 0),
      homeCellId: Number(r.home_cell_id || 0),
      name: String(r.name || ""),
      profession: String(r.profession || "Laborer"),
      species: String(r.species || "Human"),
      sparkTier: String(r.spark_tier || "NULL"),
      isNull: Boolean(r.is_null),
      lifeStage: String(r.life_stage || "ADULT"),
      age: Number(r.age || 25),
      temper: String(r.temper || "STOIC"),
      instinct: String(r.instinct || "WARY"),
      motivation: String(r.motivation || ""),
      allegianceStatus: String(r.allegiance_status || "CIVILIAN"),
      unitSize: Math.max(1, Number(r.unit_size || 1)),
      traits: Array.isArray(r.traits) ? r.traits.map(String) : [],
      causeOfDeath: r.cause_of_death ? String(r.cause_of_death) : null,
    });
  }

  const cohorts = new Map<string, InMemoryCohort>();
  for (const r of cohortsRes.rows) {
    const c: InMemoryCohort = {
      burgId: Number(r.burg_id),
      species: String(r.species),
      profession: String(r.profession),
      ageBand: String(r.age_band),
      sparkTier: String(r.spark_tier),
      isNull: Boolean(r.is_null),
      allegiance: String(r.allegiance),
      count: Number(r.count || 0),
    };
    cohorts.set(cohortKeyStr(c), c);
  }
  const cohortCrewCounts = cohCrewRes.rows.map((r: any) => ({
    burgId: Number(r.burg_id),
    profession: String(r.profession),
    count: Number(r.cnt || 0),
  }));

  const cellTags = new Map<number, Set<string>>();
  for (const r of tagsRes.rows) {
    cellTags.set(Number(r.cell_id), new Set(Array.isArray(r.tags) ? r.tags.map(String) : []));
  }

  const npcInstances = new Map<string, InMemoryNpcInstance>();
  for (const r of npcRes.rows) {
    const id = String(r.id);
    npcInstances.set(id, {
      id,
      cellId: Number(r.cell_id),
      role: String(r.role || "Citizen"),
      instinct: String(r.instinct || "WARY"),
      temper: String(r.temper || "STOIC"),
      needs: parseJson(r.needs, { food: 0.8, rest: 0.8, coin: 0.5, safety: 0.8, company: 0.5 }),
      mood: parseJson(r.mood, { fear: 0.1, anger: 0.1, joy: 0.2 }),
      beliefs: parseJson(r.beliefs, []),
      socialLinks: parseJson(r.social_links, []),
      scheduleState: String(r.schedule_state || "ROUTINE_WORK"),
      alive: Boolean(r.alive),
      processedForEconomy: Boolean(r.processed_for_economy),
      recentDeceased: Boolean(r.recent),
      disposition: Number(r.disposition || 0),
      tradePriceMult: Number(r.trade_price_mult || 1),
    });
  }

  const sectorLayers = new Map<string, any>();
  for (const r of layersRes.rows) {
    const key = `${r.cell_id}:${r.rx}:${r.ry}:${r.z_layer}`;
    sectorLayers.set(key, {
      cellId: Number(r.cell_id),
      rx: Number(r.rx),
      ry: Number(r.ry),
      zLayer: Number(r.z_layer),
      npcs: Array.isArray(r.npcs) ? r.npcs : [],
      props: Array.isArray(r.props) ? r.props : [],
      features: r.features && typeof r.features === "object" ? r.features : {},
    });
  }

  let nextEventId = 1;
  const events: InMemoryEvent[] = eventsRes.rows.map((e: any) => {
    const id = Number(e.id);
    if (id >= nextEventId) nextEventId = id + 1;
    return {
      id,
      tick: Number(e.tick),
      type: String(e.type),
      message: String(e.message),
      tier: String(e.tier),
      loreDate: e.lore_date ? String(e.lore_date) : null,
      burgId: e.burg_id !== null && e.burg_id !== undefined ? Number(e.burg_id) : null,
      cellId: e.cell_id !== null && e.cell_id !== undefined ? Number(e.cell_id) : null,
      factionId: e.faction_id !== null && e.faction_id !== undefined ? Number(e.faction_id) : null,
      outlawId: e.outlaw_id !== null && e.outlaw_id !== undefined ? Number(e.outlaw_id) : null,
    };
  });

  const storylines = new Map<number, InMemoryStoryline>();
  let nextStorylineId = 1;
  for (const s of storylinesRes.rows) {
    const id = Number(s.id);
    if (id >= nextStorylineId) nextStorylineId = id + 1;
    storylines.set(id, {
      id,
      scale: String(s.scale),
      state: String(s.state),
      cellId: Number(s.cell_id || 0),
      rx: Number(s.rx ?? 50),
      ry: Number(s.ry ?? 50),
      z: Number(s.z ?? 0),
      ruleId: s.rule_id ? String(s.rule_id) : null,
      question: String(s.question),
      stakes: String(s.stakes),
      actorIds: Array.isArray(s.actor_ids) ? s.actor_ids.map(String) : [],
      hook: parseJson(s.hook, {}),
      clock: Number(s.clock || 0),
      clockMax: Number(s.clock_max || 6),
    });
  }

  let nextScheduledId = 1;
  const scheduledEvents: InMemoryScheduledEvent[] = schedRes.rows.map((r: any) => {
    const id = Number(r.id);
    if (id >= nextScheduledId) nextScheduledId = id + 1;
    return {
      id,
      dueTick: Number(r.due_tick),
      dueMinute: Number(r.due_minute || 0),
      kind: String(r.kind),
      payload: parseJson(r.payload, {}),
      createdTick: Number(r.created_tick || 0),
      firedTick: r.fired_tick !== null && r.fired_tick !== undefined ? Number(r.fired_tick) : null,
    };
  });

  const standing = new Map<string, InMemoryStanding>();
  for (const r of standingRes.rows) {
    const k = `${r.subject_ref}\0${r.party_ref}`;
    standing.set(k, {
      subjectRef: String(r.subject_ref),
      partyRef: String(r.party_ref),
      value: Number(r.value || 0),
      reasons: parseJson(r.reasons, []),
    });
  }

  const mutable: WorldMutable = {
    calendar: initCal,
    ecoHealth,
    ecoMax,
    ecoPlants,
    ecoPrey,
    ecoPredators,
    ecoApex,
    ecoBlight,
    currentTemp,
    factionId,
    cultureId,
    religionId,
    burgs,
    stockpiles,
    infrastructure,
    activeProjects,
    nextProjectId,
    weatherFronts,
    nextFrontId,
    chaosZones,
    nextChaosZoneId,
    chaosFlows,
    factions,
    factionUnits,
    diplomacy,
    paragons,
    outlaws,
    lairs,
    nextLairId,
    grindCanyons,
    nextCanyonId,
    ghostwindDrops,
    nextDropId,
    markets,
    commodityPrices,
    agents,
    nextAgentId,
    groves,
    ancientWards,
    tradeShipments,
    nextShipmentId,
    citizens,
    nextCitizenId,
    cohorts,
    cohortCrewCounts,
    cellTags,
    npcInstances,
    sectorLayers,
    events,
    nextEventId,
    storylines,
    nextStorylineId,
    scheduledEvents,
    nextScheduledId,
    overlays: [],
    standing,
    cultureCellCounts,
    religionCellCounts,
  };

  return { static: staticWorld, mutable };
}

interface SyntheticIdMaps {
  citizen: Map<number, number>;
  agent: Map<number, number>;
  front: Map<number, number>;
  lair: Map<number, number>;
  canyon: Map<number, number>;
  drop: Map<number, number>;
  shipment: Map<number, number>;
}

const SERIAL_TABLES: Array<[keyof StepCreatedSyntheticIds, string, keyof SyntheticIdMaps]> = [
  ["agents", "sim_agents", "agent"],
  ["fronts", "sim_weather_fronts", "front"],
  ["lairs", "sim_fringe_lairs", "lair"],
  ["canyons", "sim_grind_canyons", "canyon"],
  ["drops", "sim_ghostwind_dead_drops", "drop"],
  ["shipments", "sim_trade_shipments", "shipment"],
];

function remapEntityRef(ref: string, maps: SyntheticIdMaps): string {
  const cm = /^citizen:(\d+)$/.exec(ref);
  if (cm) {
    const mapped = maps.citizen.get(Number(cm[1]));
    return mapped !== undefined ? `citizen:${mapped}` : ref;
  }
  const am = /^agent:(\d+)$/.exec(ref);
  if (am) {
    const mapped = maps.agent.get(Number(am[1]));
    return mapped !== undefined ? `agent:${mapped}` : ref;
  }
  return ref;
}

function remapSyntheticIdsInDelta(d: Delta, maps: SyntheticIdMaps): Delta {
  switch (d.kind) {
    case "citizen.status":
    case "citizen.move":
    case "citizen.killOne": {
      const mapped = maps.citizen.get(d.citizenId);
      return mapped !== undefined ? { ...d, citizenId: mapped } : d;
    }
    case "tags.add":
    case "tags.remove": {
      if (d.target.kind === "citizen") {
        const mapped = maps.citizen.get(d.target.citizenId);
        if (mapped !== undefined) {
          return { ...d, target: { ...d.target, citizenId: mapped } };
        }
      }
      return d;
    }
    case "agent.update":
    case "agent.remove": {
      const mapped = maps.agent.get(d.agentId);
      return mapped !== undefined ? { ...d, agentId: mapped } : d;
    }
    case "weatherFront.update":
    case "weatherFront.remove": {
      const mapped = maps.front.get(d.frontId);
      return mapped !== undefined ? { ...d, frontId: mapped } : d;
    }
    case "grindCanyon.update": {
      const mapped = maps.canyon.get(d.canyonId);
      return mapped !== undefined ? { ...d, canyonId: mapped } : d;
    }
    case "fringeLair.update":
    case "fringeLair.delete": {
      const mapped = maps.lair.get(d.lairId);
      return mapped !== undefined ? { ...d, lairId: mapped } : d;
    }
    case "ghostwindDrop.execute": {
      const mapped = maps.drop.get(d.dropId);
      return mapped !== undefined ? { ...d, dropId: mapped } : d;
    }
    case "tradeShipment.update": {
      const mapped = maps.shipment.get(d.shipmentId);
      return mapped !== undefined ? { ...d, shipmentId: mapped } : d;
    }
    case "standing.adjust": {
      const next = remapEntityRef(d.subjectRef, maps);
      return next !== d.subjectRef ? { ...d, subjectRef: next } : d;
    }
    case "entity.die": {
      const next = remapEntityRef(d.ref, maps);
      return next !== d.ref ? { ...d, ref: next } : d;
    }
    case "entity.create": {
      const nextRef = remapEntityRef(d.ref, maps);
      let nextSource = d.sourceId;
      if (d.sourceTable === "population_demographics") {
        const mapped = maps.citizen.get(Number(d.sourceId));
        if (mapped !== undefined) nextSource = String(mapped);
      } else if (d.sourceTable === "sim_agents") {
        const mapped = maps.agent.get(Number(d.sourceId));
        if (mapped !== undefined) nextSource = String(mapped);
      }
      return nextRef !== d.ref || nextSource !== d.sourceId
        ? { ...d, ref: nextRef, sourceId: nextSource }
        : d;
    }
    case "thread.open": {
      const actorIds = d.spec.actor_ids || [];
      let changed = false;
      const mappedActors = actorIds.map((aid) => {
        const next = remapEntityRef(aid, maps);
        if (next !== aid) changed = true;
        return next;
      });
      return changed ? { ...d, spec: { ...d.spec, actor_ids: mappedActors } } : d;
    }
    case "tradeShipment.create": {
      const merch = maps.citizen.get(d.merchantCitizenId) ?? d.merchantCitizenId;
      let crewChanged = merch !== d.merchantCitizenId;
      const crew = d.crewCitizenIds.map((cid) => {
        const next = maps.citizen.get(cid);
        if (next !== undefined) {
          crewChanged = true;
          return next;
        }
        return cid;
      });
      return crewChanged
        ? { ...d, merchantCitizenId: merch, crewCitizenIds: crew }
        : d;
    }
    default:
      return d;
  }
}

/**
 * Commits cohort side effects, promoted notables, and step-ordered deltas produced by a single
 * in-memory day to PostgreSQL via the unified delta writer, remapping same-day synthetic IDs.
 */
export async function commitInMemoryDay(
  db: Db,
  tick: number,
  result: InMemoryDayResult
): Promise<{ counts: Record<string, number>; rejected: RejectedDelta[]; promotedCount: number }> {
  const se = result.sideEffects;
  if (se.yearlyAgingAdultMap) {
    await ageCohortsYearly(db, se.yearlyAgingAdultMap);
  }
  if (se.cohortGrowthOps.length > 0) {
    await adjustCohortsBatch(db, se.cohortGrowthOps);
  }
  if (se.cohortRetireReqs.length > 0) {
    await retireFromCohortsBatch(db, se.cohortRetireReqs);
  }
  for (const z of se.zeroBurgsPrePromote) {
    await zeroBurgsCohorts(db, z.burgIds, z.status, z.motivation);
  }

  const maps: SyntheticIdMaps = {
    citizen: new Map<number, number>(),
    agent: new Map<number, number>(),
    front: new Map<number, number>(),
    lair: new Map<number, number>(),
    canyon: new Map<number, number>(),
    drop: new Map<number, number>(),
    shipment: new Map<number, number>(),
  };

  if (se.promotedCitizens.length > 0) {
    const promoted = await promoteBatchFromCohorts(
      db,
      se.promotedCitizens.map((p) => p.spec),
      tick
    );
    for (let i = 0; i < se.promotedCitizens.length; i++) {
      const dbRes = promoted[i];
      const rec = se.promotedCitizens[i]!;
      if (dbRes && dbRes.citizenId > 0) {
        maps.citizen.set(rec.syntheticCitizenId, dbRes.citizenId);
      }
    }
  }

  const counts: Record<string, number> = {};
  const rejected: RejectedDelta[] = [];

  for (const [stepName, rawDeltas] of Object.entries(result.stepDeltas)) {
    if (!rawDeltas || rawDeltas.length === 0) continue;

    const created = se.stepCreatedIds[stepName];
    const preMaxByKey = new Map<keyof StepCreatedSyntheticIds, number>();
    if (created) {
      for (const [key, tableName] of SERIAL_TABLES) {
        if (created[key].length > 0) {
          const mxRes = await db.query(`SELECT COALESCE(MAX(id), 0)::int AS m FROM ${tableName}`);
          preMaxByKey.set(key, Number(mxRes.rows[0]?.m || 0));
        }
      }
    }

    const mapped = rawDeltas.map((d) => remapSyntheticIdsInDelta(d, maps));
    const stepRes = await flushStepDeltas(db, `in_memory_${stepName}`, tick, mapped);
    for (const [k, v] of Object.entries(stepRes.counts)) {
      counts[k] = (counts[k] || 0) + Number(v || 0);
    }
    if (stepRes.rejected.length > 0) {
      rejected.push(...stepRes.rejected);
    }

    if (created) {
      for (const [key, tableName, mapKey] of SERIAL_TABLES) {
        const synIds = created[key];
        if (synIds.length === 0) continue;
        const prevMax = preMaxByKey.get(key) ?? 0;
        const rowsRes = await db.query(
          `SELECT id FROM ${tableName} WHERE id > $1 ORDER BY id ASC LIMIT $2`,
          [prevMax, synIds.length]
        );
        const count = Math.min(synIds.length, rowsRes.rows.length);
        for (let i = 0; i < count; i++) {
          maps[mapKey].set(synIds[i]!, Number(rowsRes.rows[i].id));
        }
      }
    }
  }

  for (const z of se.zeroBurgsPost) {
    await zeroBurgsCohorts(db, z.burgIds, z.status, z.motivation);
  }

  return { counts, rejected, promotedCount: maps.citizen.size };
}
