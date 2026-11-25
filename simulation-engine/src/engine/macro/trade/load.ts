import type { Db } from "../../deltas/types.js";
import { loadCellTagMap } from "../../cellTags.js";
import { GOOD_ROLE_BY_ID, goodKeyFromName } from "../../economy/goodCatalog.js";
import {
  advanceAlongPath,
  computeRiverTollForPath,
  createRouteSearchMemo,
  distBetweenCells,
  findTradeRouteSync,
  getCachedCellCoords,
  type TransportMode,
} from "../../economy/routeGraphRouter.js";
import type {
  TradeBurgSnap,
  TradeCohortCrewSnap,
  TradeDealSnap,
  TradeDiplomacySnap,
  TradeFactionSnap,
  TradeGoodSnap,
  TradeInTransitCrewSnap,
  TradeLairSnap,
  TradeLivingCrewSnap,
  TradeMarketSnap,
  TradeRouter,
  TradeShipmentSnap,
  TradeSnapshot,
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

function collectCrewIdsFromRow(row: any): number[] {
  const out: number[] = [];
  const mid = Number(row.merchant_citizen_id);
  if (Number.isInteger(mid) && mid > 0) out.push(mid);
  const arr = parseJson<any[]>(row.crew_citizen_ids, []);
  if (Array.isArray(arr)) {
    for (const raw of arr) {
      const cid = Number(raw);
      if (Number.isInteger(cid) && cid > 0) out.push(cid);
    }
  }
  return out;
}

/** Live route-graph adapter wrapping synchronous cached routing helpers from routeGraphRouter. */
export const LIVE_TRADE_ROUTER: TradeRouter = {
  getCellCoords: getCachedCellCoords,
  distBetweenCells,
  advanceAlongPath,
  findTradeRoute: findTradeRouteSync,
  computeRiverTollForPath,
  createRouteSearchMemo,
};

/**
 * Loads diplomacy, factions, blockades, lairs, goods, markets, burgs, active shipments,
 * logistics crew pools, and trade deals into an immutable `TradeSnapshot`.
 */
export async function loadTrade(
  client: Db,
  tick: number,
  loreDate: string
): Promise<TradeSnapshot> {
  const diploRes = await client.query(`
    SELECT faction_a_id, faction_b_id, status
    FROM sim_diplomacy ORDER BY faction_a_id, faction_b_id
  `);
  const diplomacy: TradeDiplomacySnap[] = [];
  let hasWar = false;
  for (const d of diploRes.rows) {
    const status = String(d.status || "");
    if (status === "WAR") hasWar = true;
    diplomacy.push({
      factionAId: Number(d.faction_a_id),
      factionBId: Number(d.faction_b_id),
      status,
    });
  }

  const factionsRes = await client.query(`
    SELECT id, name, fiscal_economy FROM sim_factions ORDER BY id
  `);
  const factionNameMap = new Map<number, string>();
  const factions: TradeFactionSnap[] = factionsRes.rows.map((f: any) => {
    const id = Number(f.id);
    const name = String(f.name || "");
    factionNameMap.set(id, name);
    return { id, name, fiscalEconomy: f.fiscal_economy };
  });

  const cellFactionMap = new Map<number, number>();
  if (hasWar) {
    const cellFactionRes = await client.query(`
      SELECT c.id, c.faction_id
      FROM sim_cells c
      JOIN sim_route_graph rg ON rg.cell_id = c.id
      WHERE c.faction_id IS NOT NULL AND c.faction_id > 0
    `);
    for (const c of cellFactionRes.rows) {
      cellFactionMap.set(Number(c.id), Number(c.faction_id) || 0);
    }
  }

  const tagMap = await loadCellTagMap(client, 0);
  const blockedCellIds: number[] = [];
  for (const [cid, tags] of tagMap.entries()) {
    if (
      tags.some(
        (t) =>
          t.includes("TradeBlockade") ||
          t.includes("CompassBlockaded") ||
          t.includes("CompassEmbargo")
      )
    ) {
      blockedCellIds.push(cid);
    }
  }
  blockedCellIds.sort((a, b) => a - b);

  const lairsRes = await client.query(`
    SELECT l.id, l.faction_id, l.cell_id, l.burg_id, l.lair_type, l.manpower, l.heat, l.inventory,
           f.name AS syndicate_name
    FROM sim_fringe_lairs l
    LEFT JOIN sim_outlaw_factions f ON f.id = l.faction_id
    WHERE COALESCE(l.manpower, 0) > 0
    ORDER BY l.id
  `);
  const lairs: TradeLairSnap[] = lairsRes.rows.map((l: any): TradeLairSnap => ({
    id: Number(l.id),
    factionId: Number(l.faction_id) || 0,
    cellId: Number(l.cell_id) || 0,
    burgId: Number(l.burg_id) || 0,
    lairType: String(l.lair_type || ""),
    manpower: Number(l.manpower) || 0,
    heat: Number(l.heat) || 0,
    syndicateName: String(l.syndicate_name || "Underworld Syndicate"),
    inventory: parseJson<Record<string, number>>(l.inventory, {}),
  }));

  const goodsRes = await client.query(
    `SELECT id, name, value, carriage, recipes FROM sim_goods ORDER BY id`
  );
  const goods: TradeGoodSnap[] = goodsRes.rows.map((g: any) => {
    const id = Number(g.id);
    const key =
      goodKeyFromName(String(g.name || "")) || GOOD_ROLE_BY_ID[id]?.goodKey || `good_${id}`;
    return {
      id,
      name: String(g.name || key),
      key,
      value: Number(g.value) || 1,
      carriage: Number(g.carriage) || 1,
      recipes: parseJson<Array<Record<string, number>>>(g.recipes, []),
    };
  });

  const marketsRes = await client.query(`SELECT id, center_burg_id, goods FROM sim_markets ORDER BY id`);
  const markets: TradeMarketSnap[] = marketsRes.rows.map((m: any) => ({
    id: Number(m.id),
    centerBurgId: Number(m.center_burg_id) || 0,
    goods: parseJson<Record<string, any>>(m.goods, {}),
  }));

  const burgRes = await client.query(`
    SELECT b.burg_id, b.name, b.cell_id, b.wealth, b.food, b.urban_tier, b.unrest, b.port,
           b.resource_profile,
           COALESCE(c.market_id, 0) AS market_id,
           COALESCE(b.occupier_faction_id, c.faction_id, 0) AS faction_id,
           s.complex_inventory
    FROM sim_burg_economy b
    JOIN sim_cells c ON b.cell_id = c.id
    LEFT JOIN sim_industrial_stockpiles s ON b.burg_id = s.burg_id
    WHERE b.pop_null > 0 OR COALESCE(b.pop_attuned, 0) > 0
    ORDER BY b.burg_id
  `);
  const candidateSurplusBurgSet = new Set<number>();
  const burgs: TradeBurgSnap[] = burgRes.rows.map((row: any) => {
    const burgId = Number(row.burg_id);
    const factionId = Number(row.faction_id) || 0;
    const inventory = parseJson<Record<string, number>>(row.complex_inventory, {});
    for (const qtyRaw of Object.values(inventory)) {
      if ((Number(qtyRaw) || 0) >= 16) {
        candidateSurplusBurgSet.add(burgId);
        break;
      }
    }
    return {
      burgId,
      name: String(row.name || `Burg #${burgId}`),
      cellId: Number(row.cell_id),
      factionId,
      factionName: factionNameMap.get(factionId) || "Independent",
      marketId: Number(row.market_id) || 0,
      wealth: Number(row.wealth) || 0,
      food: Number(row.food) || 0,
      urbanTier: Number(row.urban_tier) || 1,
      unrest: Number(row.unrest) || 0,
      port: Boolean(row.port),
      inventory,
      profile: parseJson(row.resource_profile, {}),
    };
  });

  const inTransitRes = await client.query(`
    SELECT * FROM sim_trade_shipments WHERE status = 'IN_TRANSIT' ORDER BY id ASC
  `);
  const allTransitCrewSet = new Set<number>();
  const missingAirCells = new Set<number>();
  const inTransitShipments: TradeShipmentSnap[] = inTransitRes.rows.map((s: any) => {
    const sourceBurgId = Number(s.source_burg_id);
    const destBurgId = Number(s.dest_burg_id);
    candidateSurplusBurgSet.add(sourceBurgId);
    candidateSurplusBurgSet.add(destBurgId);

    const pathCells = parseJson<number[]>(s.path_cells, [])
      .map(Number)
      .filter((n) => Number.isInteger(n) && n > 0);
    const mode = String(s.transport_mode || "LAND") as TransportMode;
    if (hasWar && mode === "AIR") {
      for (const cid of pathCells) {
        if (!cellFactionMap.has(cid)) missingAirCells.add(cid);
      }
    }
    const crewIds = collectCrewIdsFromRow(s);
    for (const cid of crewIds) allTransitCrewSet.add(cid);

    return {
      id: Number(s.id),
      sourceBurgId,
      destBurgId,
      sourceFactionId: Number(s.source_faction_id) || 0,
      destFactionId: Number(s.dest_faction_id) || 0,
      transportMode: mode,
      goodId: Number(s.good_id) || 0,
      goodKey: String(s.good_key || ""),
      goodName: String(s.good_name || String(s.good_key || "")),
      quantity: Math.max(0, Number(s.quantity) || 0),
      totalGold: Math.max(0, Number(s.total_gold) || 0),
      tariffGold: Math.max(0, Number(s.tariff_gold) || 0),
      guardCount: Math.max(0, Number(s.guard_count) || 0),
      pathCells,
      pathIndex: Number(s.path_index) || 0,
      currentCellId: Number(s.current_cell_id) || 0,
      etaTicks: Number(s.eta_ticks || 1),
      crewIds,
    };
  });

  if (hasWar && missingAirCells.size > 0) {
    const extraRes = await client.query(
      `SELECT id, faction_id FROM sim_cells WHERE id = ANY($1::int[]) AND faction_id IS NOT NULL AND faction_id > 0`,
      [Array.from(missingAirCells).sort((a, b) => a - b)]
    );
    for (const r of extraRes.rows) {
      cellFactionMap.set(Number(r.id), Number(r.faction_id) || 0);
    }
  }

  let inTransitCrewMeta: TradeInTransitCrewSnap[] = [];
  if (allTransitCrewSet.size > 0) {
    const crewMetaRes = await client.query(
      `SELECT citizen_id, settlement_id, profession, life_stage, allegiance_status
       FROM population_demographics
       WHERE citizen_id = ANY($1::int[])
       ORDER BY citizen_id ASC`,
      [Array.from(allTransitCrewSet).sort((a, b) => a - b)]
    );
    inTransitCrewMeta = crewMetaRes.rows.map((r: any) => ({
      citizenId: Number(r.citizen_id),
      settlementId: Number(r.settlement_id) || 0,
      profession: String(r.profession || ""),
      lifeStage: String(r.life_stage || ""),
      allegianceStatus: String(r.allegiance_status || ""),
    }));
  }

  const livingCrew: TradeLivingCrewSnap[] = [];
  const cohortCrewCounts: TradeCohortCrewSnap[] = [];
  if (candidateSurplusBurgSet.size > 0) {
    const candidateIds = Array.from(candidateSurplusBurgSet).sort((a, b) => a - b);
    const crewRes = await client.query(
      `SELECT c.citizen_id, c.settlement_id, c.profession
       FROM unnest($1::int[]) AS b(settlement_id)
       CROSS JOIN unnest(ARRAY['Merchant Factor', 'Merchant Trader', 'Caravan Drover', 'Caravan Guard', 'Sailor', 'Aether-Crew']) AS p(profession)
       CROSS JOIN LATERAL (
         SELECT pd.citizen_id, pd.settlement_id, pd.profession
         FROM population_demographics pd
         WHERE pd.settlement_id = b.settlement_id
           AND pd.profession = p.profession
           AND pd.allegiance_status = 'CIVILIAN'
           AND pd.life_stage = 'ADULT'
           AND pd.profession IN ('Merchant Factor', 'Merchant Trader', 'Caravan Drover', 'Caravan Guard', 'Sailor', 'Aether-Crew')
         ORDER BY pd.citizen_id ASC
         LIMIT 8
       ) c
       ORDER BY c.settlement_id ASC,
                CASE WHEN c.profession = 'Merchant Factor' THEN 0 ELSE 1 END ASC,
                c.citizen_id ASC`,
      [candidateIds]
    );
    for (const c of crewRes.rows) {
      livingCrew.push({
        citizenId: Number(c.citizen_id),
        settlementId: Number(c.settlement_id),
        profession: String(c.profession || ""),
      });
    }

    const cohCrewRes = await client.query(
      `SELECT burg_id, profession, COALESCE(SUM(count), 0)::int AS cnt
       FROM population_cohorts
       WHERE burg_id = ANY($1::int[])
         AND profession IN ('Merchant Factor', 'Merchant Trader', 'Caravan Drover', 'Caravan Guard', 'Sailor', 'Aether-Crew')
         AND age_band = 'ADULT'
         AND allegiance = 'CIVILIAN'
         AND count > 0
       GROUP BY burg_id, profession
       ORDER BY burg_id ASC,
                CASE WHEN profession = 'Merchant Factor' THEN 0 ELSE 1 END ASC,
                profession ASC`,
      [candidateIds]
    );
    for (const row of cohCrewRes.rows) {
      cohortCrewCounts.push({
        burgId: Number(row.burg_id),
        profession: String(row.profession),
        count: Number(row.cnt || 0),
      });
    }
  }

  const dealsRes = await client.query(`
    SELECT from_burg_id, to_market_id, good_id, COALESCE(transport_cost, 0)::real AS transport_cost
    FROM sim_trade_deals
    ORDER BY id ASC
  `);
  const tradeDeals: TradeDealSnap[] = dealsRes.rows.map((d: any) => ({
    fromBurgId: Number(d.from_burg_id),
    toMarketId: Number(d.to_market_id),
    goodId: Number(d.good_id),
    transportCost: Number(d.transport_cost || 0),
  }));

  return {
    tick,
    loreDate,
    diplomacy,
    factions,
    cellFactionEntries: Array.from(cellFactionMap.entries()).sort((a, b) => a[0] - b[0]),
    blockedCellIds,
    lairs,
    goods,
    markets,
    burgs,
    inTransitShipments,
    inTransitCrewMeta,
    livingCrew,
    cohortCrewCounts,
    tradeDeals,
  };
}
