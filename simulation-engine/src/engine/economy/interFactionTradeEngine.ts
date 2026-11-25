/**
 * Autonomous Citizen-Crewed Inter-Faction Logistics & Trade Engine:
 *
 * Replaces instant-teleport inventory swaps with physical shipments that:
 * 1. Are driven by real burg crafting-input shortages, food deficits, canonical `sim_trade_deals`
 *    corridors, and Ostraka faction specialty demand.
 * 2. Require living logistics citizens in `population_demographics` (`Merchant Factor`/`Trader` plus
 *    `Caravan Drover`, `Sailor`, or `Aether-Crew`, and optional `Caravan Guard` escorts), marking
 *    assigned crew `ON_CARAVAN` while in transit and returning them to `CIVILIAN` upon resolution.
 * 3. Move discretely once per tick (<= 65 map units/tick) along `sim_route_graph` (`roads`, `trails`,
 *    `searoutes`) or bounded air corridors for air-capable factions/sky hubs.
 * 4. Respect wartime borders (`sim_diplomacy.status = 'WAR'`), `#TradeBlockade` tags, sovereign border
 *    tariffs (`sim_factions.fiscal_economy.tariffs`), and syndicate interception (`sim_fringe_lairs`).
 */
import {
  FACTION_SPECIALTIES,
  CommodityCategory,
  getGoodsByCategory,
} from "./factionSpecialties.js";
import {
  AIR_CAPABLE_FACTION_IDS,
  GOOD_ROLE_BY_ID,
  goodKeyFromName,
} from "./goodCatalog.js";
import {
  TransportMode,
  RoutePlan,
  ensureRouteGraphCache,
  createRouteSearchMemo,
  findTradeRoute,
  advanceAlongPath,
  distBetweenCells,
  getCachedCellCoords,
  computeRiverTollForPath,
} from "./routeGraphRouter.js";
import { loadCellTagMap } from "../cellTags.js";
import { promoteBatchFromCohorts, type PromoteBatchSpec } from "../lod/promote.js";

type Db = { query: (text: string, params?: any[]) => Promise<any> };

export interface TradeCaravanLog {
  sourceBurgId: number;
  sourceBurgName: string;
  sourceFactionId: number;
  destBurgId: number;
  destBurgName: string;
  destFactionId: number;
  transportMode: TransportMode;
  goodKey: string;
  goodName: string;
  amount: number;
  totalGold: number;
  tariffGold: number;
  tick: number;
}

export interface TradeEmbargoStall {
  burgId: number;
  burgName: string;
  factionId: number;
  neededGoodKey: string;
  neededGoodName: string;
  category: CommodityCategory | "CRAFTING";
  stalledProject: string;
}

export interface TradeEngineResult {
  tradesExecuted: number;
  shipmentsStepped: number;
  shipmentsDispatched: number;
  shipmentsDelivered: number;
  shipmentsIntercepted: number;
  shipmentsAborted: number;
  embargoStalls: TradeEmbargoStall[];
}

interface GoodInfo {
  id: number;
  name: string;
  key: string;
  value: number;
  carriage: number;
  recipes: Array<Record<string, number>>;
}

interface CrewQueues {
  merchants: number[];
  drovers: number[];
  sailors: number[];
  skycrew: number[];
  guards: number[];
}

interface PendingEvent {
  tick: number;
  type: string;
  message: string;
  tier: "MINOR" | "MAJOR";
  factionId: number | null;
  outlawId: number | null;
  burgId: number | null;
  cellId: number | null;
}

interface LairEntry {
  id: number;
  factionId: number;
  cellId: number;
  burgId: number;
  lairType: string;
  manpower: number;
  heat: number;
  syndicateName: string;
  inventory: Record<string, number>;
}

const MAX_ACTIVE_SHIPMENTS = 120;
const MAX_DISPATCH_PER_TICK = 24;
const MAX_SELLER_CANDIDATES = 6;
const MAX_DISPATCH_EVENTS_PER_TICK = 5;
const MAX_ARRIVAL_EVENTS_PER_TICK = 4;
const LAIR_AMBUSH_RADIUS = 18;
const AERIAL_LAIR_TYPES = new Set(["SECRET_AERIE_YARD", "VERGE_SKY_DOCK", "CLAN_COVERT_COVE"]);

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

function getTariffRate(destFaction: any, sourceFactionId: number, goodId: number): number {
  if (!destFaction || Number(destFaction.id) === sourceFactionId || sourceFactionId <= 0) return 0;
  const fiscal = parseJson<any>(destFaction.fiscal_economy, {});
  const tariffs: any[] = Array.isArray(fiscal?.tariffs) ? fiscal.tariffs : [];
  for (const rule of tariffs) {
    const matchesGood =
      rule?.goods === "all" ||
      (Array.isArray(rule?.goods) && rule.goods.map(Number).includes(goodId));
    const matchesState =
      rule?.states === "all" ||
      (Array.isArray(rule?.states) && rule.states.map(Number).includes(sourceFactionId));
    if (matchesGood && matchesState) {
      const rate = Number(rule.rate);
      if (Number.isFinite(rate)) return Math.max(0, Math.min(0.4, rate));
    }
  }
  return 0.05;
}

function resolveUnitPrice(
  goodId: number,
  goodInfo: GoodInfo | undefined,
  marketGoods: Record<string, any> | undefined,
  specialtyPrice: number
): number {
  const mPrice = Number(marketGoods?.[String(goodId)]?.price);
  if (Number.isFinite(mPrice) && mPrice > 0) return mPrice;
  if (goodInfo && Number.isFinite(goodInfo.value) && goodInfo.value > 0) return goodInfo.value;
  return specialtyPrice > 0 ? specialtyPrice : 8;
}

function hasModeCrew(q: CrewQueues | undefined, mode: TransportMode): boolean {
  if (!q || q.merchants.length === 0) return false;
  switch (mode) {
    case "LAND":
      return q.drovers.length > 0;
    case "SEA":
      return q.sailors.length > 0;
    case "AIR":
      return q.skycrew.length > 0;
  }
}

function allocateCrew(
  q: CrewQueues,
  mode: TransportMode,
  quantity: number,
  totalGold: number
): { merchantId: number; crewIds: number[]; guardCount: number } | null {
  if (!hasModeCrew(q, mode)) return null;
  const merchantId = q.merchants.shift();
  if (merchantId === undefined) return null;

  const modePool =
    mode === "LAND" ? q.drovers : mode === "SEA" ? q.sailors : q.skycrew;
  const desired = quantity >= 12 && modePool.length >= 2 ? 2 : 1;
  const crewIds: number[] = [];
  for (let i = 0; i < desired; i++) {
    const cid = modePool.shift();
    if (cid !== undefined) crewIds.push(cid);
  }
  if (crewIds.length === 0) {
    q.merchants.unshift(merchantId);
    return null;
  }

  let guardCount = 0;
  const wantGuards = totalGold >= 60 ? 2 : totalGold >= 20 ? 1 : 0;
  for (let i = 0; i < wantGuards && q.guards.length > 0; i++) {
    const gid = q.guards.shift();
    if (gid !== undefined) {
      crewIds.push(gid);
      guardCount++;
    }
  }

  return { merchantId, crewIds, guardCount };
}

function getOrCreateQueues(map: Map<number, CrewQueues>, burgId: number): CrewQueues {
  let q = map.get(burgId);
  if (!q) {
    q = { merchants: [], drovers: [], sailors: [], skycrew: [], guards: [] };
    map.set(burgId, q);
  }
  return q;
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

export async function runInterFactionTradeEngine(
  client: Db,
  tick: number,
  loreDate: string
): Promise<TradeEngineResult> {
  await ensureRouteGraphCache(client);

  // ── PHASE A: LOAD LIVE WORLD CONTEXT ────────────────────────────────────────
  const diploRes = await client.query(`
    SELECT faction_a_id, faction_b_id, status
    FROM sim_diplomacy ORDER BY faction_a_id, faction_b_id
  `);
  const warMap = new Set<string>();
  const warEnemiesByFaction = new Map<number, Set<number>>();
  for (const d of diploRes.rows) {
    if (d.status === "WAR") {
      const a = Number(d.faction_a_id);
      const b = Number(d.faction_b_id);
      warMap.add(`${a}_${b}`);
      warMap.add(`${b}_${a}`);
      if (!warEnemiesByFaction.has(a)) warEnemiesByFaction.set(a, new Set());
      if (!warEnemiesByFaction.has(b)) warEnemiesByFaction.set(b, new Set());
      warEnemiesByFaction.get(a)!.add(b);
      warEnemiesByFaction.get(b)!.add(a);
    }
  }

  const factionsRes = await client.query(`
    SELECT id, name, treasury, fiscal_economy FROM sim_factions ORDER BY id
  `);
  const factionMap = new Map<number, any>();
  const factionTreasuryDelta = new Map<number, number>();
  for (const f of factionsRes.rows) {
    factionMap.set(Number(f.id), f);
  }

  const cellFactionMap = new Map<number, number>();
  if (warMap.size > 0) {
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
  const blockedCells = new Set<number>();
  for (const [cid, tags] of tagMap.entries()) {
    if (tags.some((t) => t.includes("TradeBlockade") || t.includes("CompassBlockaded") || t.includes("CompassEmbargo"))) {
      blockedCells.add(cid);
    }
  }

  const lairsRes = await client.query(`
    SELECT l.id, l.faction_id, l.cell_id, l.burg_id, l.lair_type, l.manpower, l.heat, l.inventory,
           f.name AS syndicate_name
    FROM sim_fringe_lairs l
    LEFT JOIN sim_outlaw_factions f ON f.id = l.faction_id
    WHERE COALESCE(l.manpower, 0) > 0
    ORDER BY l.id
  `);
  const lairs: LairEntry[] = lairsRes.rows.map((l: any): LairEntry => ({
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
  const lairsByCell = new Map<number, LairEntry[]>();
  for (const l of lairs) {
    const list = lairsByCell.get(l.cellId) || [];
    list.push(l);
    lairsByCell.set(l.cellId, list);
  }

  const goodsRes = await client.query(`SELECT id, name, value, carriage, recipes FROM sim_goods ORDER BY id`);
  const goodById = new Map<number, GoodInfo>();
  const goodByKey = new Map<string, GoodInfo>();
  for (const g of goodsRes.rows) {
    const id = Number(g.id);
    const key = goodKeyFromName(String(g.name || "")) || GOOD_ROLE_BY_ID[id]?.goodKey || `good_${id}`;
    const info: GoodInfo = {
      id,
      name: String(g.name || key),
      key,
      value: Number(g.value) || 1,
      carriage: Number(g.carriage) || 1,
      recipes: parseJson<Array<Record<string, number>>>(g.recipes, []),
    };
    goodById.set(id, info);
    goodByKey.set(key, info);
  }

  const marketsRes = await client.query(`SELECT id, center_burg_id, goods FROM sim_markets ORDER BY id`);
  const marketGoodsById = new Map<number, Record<string, any>>();
  const marketCenterBurgById = new Map<number, number>();
  for (const m of marketsRes.rows) {
    const mId = Number(m.id);
    marketGoodsById.set(mId, parseJson<Record<string, any>>(m.goods, {}));
    marketCenterBurgById.set(mId, Number(m.center_burg_id) || 0);
  }

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
  const burgMap = new Map<number, any>();
  for (const row of burgRes.rows) {
    row.burg_id = Number(row.burg_id);
    row.cell_id = Number(row.cell_id);
    row.faction_id = Number(row.faction_id) || 0;
    row.faction_name = factionMap.get(row.faction_id)?.name || "Independent";
    row.market_id = Number(row.market_id) || 0;
    row.wealth = Number(row.wealth) || 0;
    row.food = Number(row.food) || 0;
    row.urban_tier = Number(row.urban_tier) || 1;
    row.unrest = Number(row.unrest) || 0;
    row.port = Boolean(row.port);
    row.inventory = parseJson<Record<string, number>>(row.complex_inventory, {});
    row.profile = parseJson<{
      marketId?: number;
      primary?: Array<{ goodId: number; key: string; share: number }>;
      crafted?: Array<{ goodId: number; key: string; targetOutput: number }>;
    }>(row.resource_profile, {});
    burgMap.set(row.burg_id, row);
  }

  const modifiedBurgInventory = new Set<number>();
  const modifiedBurgStats = new Set<number>();
  const modifiedLairIds = new Set<number>();
  const outlawWealthDelta = new Map<number, number>();
  const crewReleaseIds: number[] = [];
  const crewAssignIds: number[] = [];
  const pendingEvents: PendingEvent[] = [];
  const embargoStalls: TradeEmbargoStall[] = [];

  let tradesExecuted = 0;
  let shipmentsStepped = 0;
  let shipmentsDelivered = 0;
  let shipmentsIntercepted = 0;
  let shipmentsAborted = 0;
  let shipmentsDispatched = 0;
  let arrivalEventsEmitted = 0;

  // ── PHASE B: STEP ALL IN-TRANSIT SHIPMENTS ALONG ROUTE PATHS ────────────────
  const inTransitRes = await client.query(`
    SELECT * FROM sim_trade_shipments WHERE status = 'IN_TRANSIT' ORDER BY id ASC
  `);

  if (warMap.size > 0 && inTransitRes.rows.length > 0) {
    const missingAirCells = new Set<number>();
    for (const s of inTransitRes.rows) {
      if (String(s.transport_mode || "") !== "AIR") continue;
      const pCells = parseJson<number[]>(s.path_cells, []);
      for (const rawCid of pCells) {
        const cid = Number(rawCid);
        if (Number.isInteger(cid) && cid > 0 && !cellFactionMap.has(cid)) {
          missingAirCells.add(cid);
        }
      }
    }
    if (missingAirCells.size > 0) {
      const extraRes = await client.query(
        `SELECT id, faction_id FROM sim_cells WHERE id = ANY($1::int[]) AND faction_id IS NOT NULL AND faction_id > 0`,
        [Array.from(missingAirCells).sort((a, b) => a - b)]
      );
      for (const r of extraRes.rows) {
        cellFactionMap.set(Number(r.id), Number(r.faction_id) || 0);
      }
    }
  }

  const routeMemo = createRouteSearchMemo();
  const activeLaneKeys = new Set<string>();
  const shipmentUpdates: Array<{ id: number; status: string; pathIndex: number; currentCellId: number; etaTicks: number; resolvedTick: number | null; pathCellsJson?: string | null }> = [];

  for (const s of inTransitRes.rows) {
    shipmentsStepped++;
    const shipmentId = Number(s.id);
    const sourceBurgId = Number(s.source_burg_id);
    const destBurgId = Number(s.dest_burg_id);
    const sourceFactionId = Number(s.source_faction_id) || 0;
    const destFactionId = Number(s.dest_faction_id) || 0;
    const mode = (String(s.transport_mode || "LAND") as TransportMode);
    const goodId = Number(s.good_id) || 0;
    const goodKey = String(s.good_key || "");
    const goodName = String(s.good_name || goodKey);
    const quantity = Math.max(0, Number(s.quantity) || 0);
    const totalGold = Math.max(0, Number(s.total_gold) || 0);
    const tariffGold = Math.max(0, Number(s.tariff_gold) || 0);
    const guardCount = Math.max(0, Number(s.guard_count) || 0);
    let pathCells = parseJson<number[]>(s.path_cells, []).map(Number).filter((n) => Number.isInteger(n) && n > 0);
    const curIdx = Number(s.path_index) || 0;
    const allCrew = collectCrewIdsFromRow(s);

    const seller = burgMap.get(sourceBurgId);
    const importer = burgMap.get(destBurgId);
    if (!seller || !importer || pathCells.length === 0) {
      shipmentUpdates.push({ id: shipmentId, status: "ABORTED", pathIndex: curIdx, currentCellId: Number(s.current_cell_id) || 0, etaTicks: 0, resolvedTick: tick });
      crewReleaseIds.push(...allCrew);
      shipmentsAborted++;
      continue;
    }

    let step = advanceAlongPath(pathCells, curIdx, mode);
    let reroutedPathJson: string | null = null;
    let reroutedEtaTicks: number | null = null;

    // 1. Check active war, hostile border traversal, or #TradeBlockade on visited cells
    const directWar = warMap.has(`${sourceFactionId}_${destFactionId}`);
    const hardClosed = directWar || blockedCells.has(importer.cell_id) || blockedCells.has(seller.cell_id);
    let disruptedCell: number | null = directWar
      ? step.nextCellId
      : blockedCells.has(importer.cell_id)
        ? importer.cell_id
        : null;

    if (!disruptedCell) {
      for (let i = 0; i < step.visitedCells.length; i++) {
        const cid = step.visitedCells[i]!;
        if (blockedCells.has(cid)) {
          disruptedCell = cid;
          break;
        }
        const isEndpoint = cid === pathCells[pathCells.length - 1];
        if (!isEndpoint) {
          const cf = cellFactionMap.get(cid) || 0;
          if (
            cf > 0 &&
            cf !== sourceFactionId &&
            cf !== destFactionId &&
            (warMap.has(`${sourceFactionId}_${cf}`) || warMap.has(`${destFactionId}_${cf}`))
          ) {
            disruptedCell = cid;
            break;
          }
        }
      }
    }

    if (disruptedCell !== null && !hardClosed && mode !== "AIR") {
      const curCellId = Number(pathCells[curIdx] || s.current_cell_id || seller.cell_id);
      const convoyAvoid = new Set<number>();
      const sEnemies = warEnemiesByFaction.get(sourceFactionId);
      if (sEnemies) for (const eid of sEnemies) convoyAvoid.add(eid);
      const dEnemies = warEnemiesByFaction.get(destFactionId);
      if (dEnemies) for (const eid of dEnemies) convoyAvoid.add(eid);

      if (!blockedCells.has(curCellId)) {
        const reroute = await findTradeRoute(client, {
          fromCellId: curCellId,
          toCellId: importer.cell_id,
          allowedModes: [mode],
          blockedCells,
          avoidFactionIds: convoyAvoid,
          cellFactionMap,
          memo: routeMemo,
        });
        const interiorClean =
          reroute &&
          reroute.pathCells.length > 1 &&
          reroute.pathCells.slice(1, -1).every((cid) => !blockedCells.has(cid));
        if (reroute && interiorClean) {
          pathCells = reroute.pathCells;
          step = advanceAlongPath(pathCells, 0, mode);
          reroutedPathJson = JSON.stringify(pathCells);
          reroutedEtaTicks = Math.max(1, reroute.etaTicks - 1);
          disruptedCell = null;
          pendingEvents.push({
            tick,
            type: "TRADE_ROUTE_REROUTED",
            message: `🧭 CONVOY REROUTED: ${mode} convoy from ${seller.name} bypassed blockaded sector #${curCellId} on alternate corridor toward ${importer.name} (${pathCells.length} hops, ETA ${reroutedEtaTicks} days).`,
            tier: "MINOR",
            factionId: destFactionId || null,
            outlawId: null,
            burgId: importer.burg_id,
            cellId: step.nextCellId,
          });
        }
      }
    }

    if (disruptedCell !== null) {
      const salvageRatio = step.nextIndex <= Math.floor(pathCells.length / 2) ? 1.0 : 0.5;
      const returnedQty = Math.max(1, Math.round(quantity * salvageRatio));
      seller.inventory[goodKey] = (seller.inventory[goodKey] || 0) + returnedQty;
      modifiedBurgInventory.add(seller.burg_id);

      importer.unrest = Math.min(100, importer.unrest + 1);
      modifiedBurgStats.add(importer.burg_id);

      crewReleaseIds.push(...allCrew);
      shipmentUpdates.push({
        id: shipmentId,
        status: "ABORTED",
        pathIndex: step.nextIndex,
        currentCellId: disruptedCell,
        etaTicks: 0,
        resolvedTick: tick,
      });
      shipmentsAborted++;
      embargoStalls.push({
        burgId: importer.burg_id,
        burgName: importer.name,
        factionId: destFactionId,
        neededGoodKey: goodKey,
        neededGoodName: goodName,
        category: "CRAFTING",
        stalledProject: "Supply Corridor",
      });
      pendingEvents.push({
        tick,
        type: "TRADE_EMBARGO_CHOKEPOINT",
        message: `⚠️ TRADE EMBARGO CHOKEPOINT: Convoy from ${seller.name} carrying ${quantity} ${goodName} to ${importer.name} was turned back by blockade/hostilities (${returnedQty} units salvaged back to origin).`,
        tier: "MAJOR",
        factionId: destFactionId || null,
        outlawId: null,
        burgId: importer.burg_id,
        cellId: disruptedCell,
      });
      continue;
    }

    // 2. Check active syndicate lairs (`sim_fringe_lairs`) along visited cells
    let interceptMatch: { lair: (typeof lairs)[number]; hitCell: number; hitIndex: number } | null = null;
    for (let vi = 0; vi < step.visitedCells.length; vi++) {
      const cid = step.visitedCells[vi]!;
      const exactList = lairsByCell.get(cid);
      if (exactList) {
        const hit = exactList.find(
          (l) => l.burgId !== seller.burg_id || l.lairType === "TOLL_BLOCKADE"
        );
        if (hit) {
          interceptMatch = { lair: hit, hitCell: cid, hitIndex: curIdx + 1 + vi };
          break;
        }
      }
      // Proximity ambush within road/sea corridor radius
      for (const l of lairs) {
        if (l.burgId === seller.burg_id || l.burgId === importer.burg_id) continue;
        if (mode === "AIR" && !AERIAL_LAIR_TYPES.has(l.lairType)) continue;
        if (distBetweenCells(cid, l.cellId) <= LAIR_AMBUSH_RADIUS) {
          interceptMatch = { lair: l, hitCell: cid, hitIndex: curIdx + 1 + vi };
          break;
        }
      }
      if (interceptMatch) break;
    }

    if (interceptMatch) {
      const { lair, hitCell, hitIndex } = interceptMatch;
      const raidChance =
        lair.lairType === "TOLL_BLOCKADE" && guardCount === 0 && lair.manpower >= 100
          ? 1.0
          : Math.min(0.9, Math.max(0.15, lair.manpower / (lair.manpower + 18 + guardCount * 28)));
      const roll = Math.random();

      if (guardCount >= 2 && roll >= raidChance) {
        // Escort guards negotiate/fight through with extortion toll
        const toll = Math.max(2, Math.min(importer.wealth, Math.round(totalGold * 0.15)));
        if (toll > 0) {
          importer.wealth = Math.max(0, importer.wealth - toll);
          modifiedBurgStats.add(importer.burg_id);
          outlawWealthDelta.set(lair.factionId, (outlawWealthDelta.get(lair.factionId) || 0) + toll);
        }
      } else if (roll < raidChance) {
        lair.inventory[goodKey] = (lair.inventory[goodKey] || 0) + quantity;
        lair.heat = Math.min(100, lair.heat + 8);
        modifiedLairIds.add(lair.id);

        const plunderGold = Math.max(5, Math.round(totalGold * 0.5));
        outlawWealthDelta.set(lair.factionId, (outlawWealthDelta.get(lair.factionId) || 0) + plunderGold);

        importer.unrest = Math.min(100, importer.unrest + 2);
        modifiedBurgStats.add(importer.burg_id);

        crewReleaseIds.push(...allCrew);
        shipmentUpdates.push({
          id: shipmentId,
          status: "INTERCEPTED",
          pathIndex: hitIndex,
          currentCellId: hitCell,
          etaTicks: 0,
          resolvedTick: tick,
          pathCellsJson: reroutedPathJson,
        });
        shipmentsIntercepted++;
        pendingEvents.push({
          tick,
          type: "CARAVAN_RAIDED",
          message: `🏴‍☠️ CARAVAN INTERCEPTED: ${lair.syndicateName} (${lair.lairType.replace(/_/g, " ")}) raided a ${mode.toLowerCase()} convoy from ${seller.name} bound for ${importer.name}, seizing ${quantity} ${goodName}!`,
          tier: "MAJOR",
          factionId: destFactionId || null,
          outlawId: lair.factionId || null,
          burgId: importer.burg_id,
          cellId: hitCell,
        });
        continue;
      }
    }

    // 3. Physical Arrival at destination burg
    if (step.arrived) {
      importer.inventory[goodKey] = (importer.inventory[goodKey] || 0) + quantity;
      modifiedBurgInventory.add(importer.burg_id);

      const goodRole = GOOD_ROLE_BY_ID[goodId];
      if (goodRole?.isFood && goodRole.foodNutrition > 0) {
        importer.food = (Number(importer.food) || 0) + quantity * goodRole.foodNutrition;
      }

      const paid = Math.min(Math.max(0, importer.wealth), totalGold);
      const tariff = Math.min(paid, tariffGold);
      const sellerProceeds = Math.max(0, paid - tariff);
      importer.wealth = Math.max(0, importer.wealth - paid);
      seller.wealth = (seller.wealth || 0) + sellerProceeds;
      modifiedBurgStats.add(importer.burg_id);
      modifiedBurgStats.add(seller.burg_id);

      if (tariff > 0 && destFactionId > 0) {
        factionTreasuryDelta.set(destFactionId, (factionTreasuryDelta.get(destFactionId) || 0) + tariff);
      }

      crewReleaseIds.push(...allCrew);
      shipmentUpdates.push({
        id: shipmentId,
        status: "DELIVERED",
        pathIndex: pathCells.length - 1,
        currentCellId: pathCells[pathCells.length - 1]!,
        etaTicks: 0,
        resolvedTick: tick,
        pathCellsJson: reroutedPathJson,
      });

      tradesExecuted++;
      shipmentsDelivered++;

      if (importer.burg_id === 1 || arrivalEventsEmitted < MAX_ARRIVAL_EVENTS_PER_TICK) {
        arrivalEventsEmitted++;
        pendingEvents.push({
          tick,
          type: "INTER_FACTION_TRADE",
          message: buildDeliveryMessage(mode, seller.name, importer.name, quantity, goodName, goodKey, paid, tariff),
          tier: "MINOR",
          factionId: destFactionId || null,
          outlawId: null,
          burgId: importer.burg_id,
          cellId: importer.cell_id,
        });
      }
      continue;
    }

    // 4. Still in transit — advance position & preserve lane deduplication lock
    activeLaneKeys.add(`${sourceBurgId}:${destBurgId}:${goodKey}`);
    shipmentUpdates.push({
      id: shipmentId,
      status: "IN_TRANSIT",
      pathIndex: step.nextIndex,
      currentCellId: step.nextCellId,
      etaTicks: reroutedEtaTicks ?? Math.max(1, Number(s.eta_ticks || 1) - 1),
      resolvedTick: null,
      pathCellsJson: reroutedPathJson,
    });
  }

  // Persist shipment steps & resolutions immediately in bulk
  if (shipmentUpdates.length > 0) {
    await client.query(
      `UPDATE sim_trade_shipments AS sh SET
         status = v.status,
         path_index = v.path_index,
         current_cell_id = v.current_cell_id,
         eta_ticks = v.eta_ticks,
         resolved_tick = v.resolved_tick,
         path_cells = COALESCE(v.path_cells, sh.path_cells)
       FROM (
         SELECT unnest($1::int[]) AS id,
                unnest($2::text[]) AS status,
                unnest($3::int[]) AS path_index,
                unnest($4::int[]) AS current_cell_id,
                unnest($5::int[]) AS eta_ticks,
                unnest($6::int[]) AS resolved_tick,
                unnest($7::jsonb[]) AS path_cells
       ) AS v
       WHERE sh.id = v.id`,
      [
        shipmentUpdates.map((u) => u.id),
        shipmentUpdates.map((u) => u.status),
        shipmentUpdates.map((u) => u.pathIndex),
        shipmentUpdates.map((u) => u.currentCellId),
        shipmentUpdates.map((u) => u.etaTicks),
        shipmentUpdates.map((u) => u.resolvedTick),
        shipmentUpdates.map((u) => u.pathCellsJson ?? null),
      ]
    );
  }

  if (crewReleaseIds.length > 0) {
    const uniqueRelease = Array.from(new Set(crewReleaseIds)).sort((a, b) => a - b);
    await client.query(
      `UPDATE population_demographics
       SET allegiance_status = 'CIVILIAN'
       WHERE citizen_id = ANY($1::int[]) AND allegiance_status = 'ON_CARAVAN'`,
      [uniqueRelease]
    );
  }

  // ── PHASE C: DISPATCH NEW CITIZEN-CREWED CONVOYS ───────────────────────────
  const activeRemainingCount = activeLaneKeys.size;
  if (activeRemainingCount < MAX_ACTIVE_SHIPMENTS) {
    // 1. Index current surplus holders per good key deterministically first so crew query targets only surplus burgs
    const surplusByGood = new Map<string, any[]>();
    const surplusBurgSet = new Set<number>();
    for (const b of burgRes.rows) {
      let hasSurplus = false;
      for (const [gKey, qtyRaw] of Object.entries(b.inventory as Record<string, number>)) {
        const qty = Number(qtyRaw) || 0;
        if (qty >= 16) {
          hasSurplus = true;
          let list = surplusByGood.get(gKey);
          if (!list) {
            list = [];
            surplusByGood.set(gKey, list);
          }
          list.push(b);
        }
      }
      if (hasSurplus) surplusBurgSet.add(Number(b.burg_id));
    }

    // 2. Load available living logistics crew from `population_demographics` + backfill slots from `population_cohorts`
    const crewQueuesByBurg = new Map<number, CrewQueues>();
    const cohortCrewSpecsByToken = new Map<number, PromoteBatchSpec>();
    let nextCohortToken = -1;
    if (surplusBurgSet.size > 0) {
      const surplusBurgIds = Array.from(surplusBurgSet).sort((a, b) => a - b);
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
        [surplusBurgIds]
      );
      for (const c of crewRes.rows) {
        const q = getOrCreateQueues(crewQueuesByBurg, Number(c.settlement_id));
        const cid = Number(c.citizen_id);
        const prof = String(c.profession || "");
        if (prof === "Merchant Factor" || prof === "Merchant Trader") q.merchants.push(cid);
        else if (prof === "Caravan Drover") q.drovers.push(cid);
        else if (prof === "Sailor") q.sailors.push(cid);
        else if (prof === "Aether-Crew") q.skycrew.push(cid);
        else if (prof === "Caravan Guard") q.guards.push(cid);
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
        [surplusBurgIds]
      );
      for (const row of cohCrewRes.rows) {
        const bid = Number(row.burg_id);
        const prof = String(row.profession);
        const q = getOrCreateQueues(crewQueuesByBurg, bid);
        const slots = Math.min(6, Number(row.cnt || 0));
        for (let k = 0; k < slots; k++) {
          const tok = nextCohortToken--;
          cohortCrewSpecsByToken.set(tok, {
            burgId: bid,
            filter: { profession: prof, ageBand: "ADULT", allegiance: "CIVILIAN" },
            slotKey: `logistics:${tick}:${bid}:${prof}:${k}`,
            permanent: true,
          });
          if (prof === "Merchant Factor" || prof === "Merchant Trader") q.merchants.push(tok);
          else if (prof === "Caravan Drover") q.drovers.push(tok);
          else if (prof === "Sailor") q.sailors.push(tok);
          else if (prof === "Aether-Crew") q.skycrew.push(tok);
          else if (prof === "Caravan Guard") q.guards.push(tok);
        }
      }
    }

    // 3. Load canonical Azgaar trade deal corridors (sim_trade_deals)
    const dealsRes = await client.query(`
      SELECT from_burg_id, to_market_id, good_id, COALESCE(transport_cost, 0)::real AS transport_cost
      FROM sim_trade_deals
      ORDER BY id ASC
    `);
    const dealSuppliersByKey = new Map<string, Set<number>>();
    for (const d of dealsRes.rows) {
      const gInfo = goodById.get(Number(d.good_id));
      if (!gInfo) continue;
      const fromBurgId = Number(d.from_burg_id);
      const toCenterBurg = marketCenterBurgById.get(Number(d.to_market_id)) || 0;
      if (toCenterBurg > 0) {
        const k1 = `${toCenterBurg}:${gInfo.key}`;
        if (!dealSuppliersByKey.has(k1)) dealSuppliersByKey.set(k1, new Set());
        dealSuppliersByKey.get(k1)!.add(fromBurgId);
      }
    }

    // 4. Prioritize importers (Excelsis vertical-slice hub first, then deterministic burg_id ASC)
    const prioritizedBurgs = [...burgRes.rows].sort((a, b) => {
      if (a.burg_id === 1 && b.burg_id !== 1) return -1;
      if (b.burg_id === 1 && a.burg_id !== 1) return 1;
      return a.burg_id - b.burg_id;
    });

    const newShipments: Array<{
      sourceBurgId: number;
      destBurgId: number;
      sourceFactionId: number;
      destFactionId: number;
      mode: TransportMode;
      goodId: number;
      goodKey: string;
      goodName: string;
      quantity: number;
      unitPrice: number;
      totalGold: number;
      tariffGold: number;
      carriageWeight: number;
      merchantId: number;
      crewIds: number[];
      guardCount: number;
      pathCells: number[];
      startCellId: number;
      etaTicks: number;
    }> = [];

    const embargoedBurgsThisTick = new Set<number>();
    let dispatchEventsEmitted = 0;

    for (const importer of prioritizedBurgs) {
      if (activeRemainingCount + shipmentsDispatched >= MAX_ACTIVE_SHIPMENTS) break;
      if (shipmentsDispatched >= MAX_DISPATCH_PER_TICK) break;
      if (importer.wealth < 15) continue;

      const impFactionId = importer.faction_id;
      const impTier = importer.urban_tier;
      const impCoord = getCachedCellCoords(importer.cell_id);

      // Build ordered demand list: (1) missing crafting inputs, (2) low food, (3) tier specialties
      const demands: Array<{ goodId: number; goodKey: string; goodName: string; target: number; category: CommodityCategory | "CRAFTING"; critical: boolean }> = [];
      const seenDemands = new Set<string>();

      const craftedList = Array.isArray(importer.profile?.crafted) ? importer.profile.crafted : [];
      for (const cr of craftedList) {
        const craftedInfo = goodById.get(Number(cr.goodId));
        const recipe = craftedInfo?.recipes?.[0];
        if (!recipe) continue;
        for (const [inpIdStr] of Object.entries(recipe)) {
          const inpId = Number(inpIdStr);
          const inpInfo = goodById.get(inpId);
          if (!inpInfo || seenDemands.has(inpInfo.key)) continue;
          const have = Number(importer.inventory[inpInfo.key]) || 0;
          if (have < 25) {
            seenDemands.add(inpInfo.key);
            demands.push({
              goodId: inpInfo.id,
              goodKey: inpInfo.key,
              goodName: inpInfo.name,
              target: 25,
              category: "CRAFTING",
              critical: have < 10,
            });
          }
        }
      }

      if (importer.food < 600 && !seenDemands.has("grain")) {
        seenDemands.add("grain");
        demands.push({ goodId: 9, goodKey: "grain", goodName: "Grain", target: 40, category: "PRESERVATION", critical: true });
      }

      // Rotate non-critical tier specialty imports cleanly across burgs
      if (importer.burg_id === 1 || (importer.burg_id + tick) % 3 === 0) {
        const desiredCats: CommodityCategory[] =
          impTier === 1
            ? ["PRESERVATION", "FOUNDATION"]
            : impTier === 2
              ? ["STRUCTURAL", "FOUNDATION", "PRESERVATION"]
              : ["ADVANCED", "STRUCTURAL", "METAPHYSICAL", "HEALTH"];
        const targetBuffer = impTier === 1 ? 20 : impTier === 2 ? 35 : 50;

        for (const cat of desiredCats) {
          const catKeys = getGoodsByCategory(cat);
          const catStock = catKeys.reduce((sum, k) => sum + (Number(importer.inventory[k]) || 0), 0);
          if (catStock < targetBuffer) {
            for (const gk of catKeys) {
              if (seenDemands.has(gk)) continue;
              const info = goodByKey.get(gk);
              const spec = Object.values(FACTION_SPECIALTIES).find((sp) => sp.uniqueGoodKey === gk);
              seenDemands.add(gk);
              demands.push({
                goodId: info?.id || spec?.goodId || 0,
                goodKey: gk,
                goodName: info?.name || spec?.goodName || gk,
                target: targetBuffer,
                category: cat,
                critical: catStock < 10,
              });
            }
          }
        }
      }

      if (demands.length === 0) continue;

      if (blockedCells.has(importer.cell_id)) {
        const crit = demands.find((d) => d.critical) || demands[0]!;
        if (!embargoedBurgsThisTick.has(importer.burg_id)) {
          embargoedBurgsThisTick.add(importer.burg_id);
          embargoStalls.push({
            burgId: importer.burg_id,
            burgName: importer.name,
            factionId: impFactionId,
            neededGoodKey: crit.goodKey,
            neededGoodName: crit.goodName,
            category: crit.category,
            stalledProject: impTier === 1 ? "Town Charter" : impTier === 2 ? "City Walls" : "Workshops",
          });
          if (tick % 3 === 0) {
            importer.unrest = Math.min(100, importer.unrest + 1);
            modifiedBurgStats.add(importer.burg_id);
            pendingEvents.push({
              tick,
              type: "TRADE_EMBARGO_CHOKEPOINT",
              message: `⚠️ TRADE EMBARGO CHOKEPOINT: Workshops in ${importer.name} stalled! Harbor & road approaches blockaded, halting ${crit.goodName} imports.`,
              tier: "MAJOR",
              factionId: impFactionId || null,
              outlawId: null,
              burgId: importer.burg_id,
              cellId: importer.cell_id,
            });
          }
        }
        continue;
      }

      const impEnemies = warEnemiesByFaction.get(impFactionId);
      const impMarketGoods = marketGoodsById.get(importer.market_id);

      let dispatchedForImporter = 0;
      for (const demand of demands) {
        if (dispatchedForImporter >= 2) break;
        if (shipmentsDispatched >= MAX_DISPATCH_PER_TICK) break;
        if (activeRemainingCount + shipmentsDispatched >= MAX_ACTIVE_SHIPMENTS) break;

        const surplusList = surplusByGood.get(demand.goodKey);
        if (!surplusList || surplusList.length === 0) continue;

        const preferredIds = dealSuppliersByKey.get(`${importer.burg_id}:${demand.goodKey}`);
        let embargoEncountered = false;
        let embargoingFactionName = "";
        let foundDispatch = false;

        // Score & deterministically sort candidate sellers
        const peacefulCandidates: any[] = [];
        for (const cand of surplusList) {
          if (cand.burg_id === importer.burg_id) continue;
          const sq = Number(cand.inventory[demand.goodKey]) || 0;
          if (sq < 16) continue;
          if (activeLaneKeys.has(`${cand.burg_id}:${importer.burg_id}:${demand.goodKey}`)) continue;

          if (blockedCells.has(cand.cell_id)) {
            embargoEncountered = true;
            embargoingFactionName = cand.faction_name || "Blockaded Origin";
            continue;
          }
          if (warMap.has(`${impFactionId}_${cand.faction_id}`)) {
            embargoEncountered = true;
            embargoingFactionName = cand.faction_name || "Hostile Faction";
            continue;
          }
          peacefulCandidates.push(cand);
        }

        peacefulCandidates.sort((a, b) => {
          const aPref = preferredIds?.has(a.burg_id) ? 0 : 1;
          const bPref = preferredIds?.has(b.burg_id) ? 0 : 1;
          if (aPref !== bPref) return aPref - bPref;
          if (impCoord) {
            const ac = getCachedCellCoords(a.cell_id);
            const bc = getCachedCellCoords(b.cell_id);
            const ad = ac ? Math.hypot(ac.x - impCoord.x, ac.y - impCoord.y) : 99999;
            const bd = bc ? Math.hypot(bc.x - impCoord.x, bc.y - impCoord.y) : 99999;
            if (Math.abs(ad - bd) > 1e-6) return ad - bd;
          }
          return a.burg_id - b.burg_id;
        });

        for (const seller of peacefulCandidates.slice(0, MAX_SELLER_CANDIDATES)) {
          const sellerQueues = crewQueuesByBurg.get(seller.burg_id);
          if (!sellerQueues || sellerQueues.merchants.length === 0) continue;

          const sellerQty = Number(seller.inventory[demand.goodKey]) || 0;
          if (sellerQty < 16) continue;

          const spec = Object.values(FACTION_SPECIALTIES).find((sp) => sp.uniqueGoodKey === demand.goodKey);
          const gInfo = goodById.get(demand.goodId) || goodByKey.get(demand.goodKey);
          const unitPrice = resolveUnitPrice(demand.goodId, gInfo, impMarketGoods, spec?.baseExportPrice || 8);

          const tradeQty = Math.min(
            20,
            Math.max(0, sellerQty - 5),
            Math.max(0, Math.floor(sellerQty * 0.4)),
            Math.floor(importer.wealth / Math.max(1, unitPrice * 0.6))
          );
          if (tradeQty < 3) continue;

          let grossGold = Math.max(3, Math.round(tradeQty * unitPrice));
          const tariffRate = getTariffRate(factionMap.get(impFactionId), seller.faction_id, demand.goodId);
          let tariffGold = tariffRate > 0 ? Math.max(1, Math.round(grossGold * tariffRate)) : 0;
          let totalGold = grossGold + tariffGold;
          if (importer.wealth < totalGold) continue;

          // Determine legal transport modes backed by living crew at seller
          const sellerCoord = getCachedCellCoords(seller.cell_id);
          const straightDist = sellerCoord && impCoord
            ? Math.hypot(impCoord.x - sellerCoord.x, impCoord.y - sellerCoord.y)
            : 0;

          const terrestrialModes: TransportMode[] = [];
          if (hasModeCrew(sellerQueues, "LAND")) terrestrialModes.push("LAND");
          if (hasModeCrew(sellerQueues, "SEA")) terrestrialModes.push("SEA");

          const canFly =
            hasModeCrew(sellerQueues, "AIR") &&
            (AIR_CAPABLE_FACTION_IDS.has(seller.faction_id) || AIR_CAPABLE_FACTION_IDS.has(impFactionId));

          const avoidFactions = new Set<number>();
          if (impEnemies) for (const eid of impEnemies) avoidFactions.add(eid);
          const sellerEnemies = warEnemiesByFaction.get(seller.faction_id);
          if (sellerEnemies) for (const eid of sellerEnemies) avoidFactions.add(eid);

          let route: RoutePlan | null = null;
          if (terrestrialModes.length > 0) {
            route = await findTradeRoute(client, {
              fromCellId: seller.cell_id,
              toCellId: importer.cell_id,
              allowedModes: terrestrialModes,
              blockedCells,
              avoidFactionIds: avoidFactions,
              cellFactionMap,
              memo: routeMemo,
            });
          }

          if (
            canFly &&
            (!route || (straightDist > 400 && (unitPrice >= 10 || demand.critical) && route.etaTicks > Math.ceil(straightDist / 60) + 4))
          ) {
            const airRoute = await findTradeRoute(client, {
              fromCellId: seller.cell_id,
              toCellId: importer.cell_id,
              allowedModes: ["AIR"],
            });
            if (airRoute) route = airRoute;
          }

          if (!route || route.pathCells.length === 0) continue;

          if (route.mode !== "AIR" && (blockedCells.size > 0 || avoidFactions.size > 0) && straightDist > 0 && route.totalDist > straightDist * 1.35) {
            const surcharge = Math.min(0.35, (route.totalDist / straightDist - 1.35) * 0.25);
            grossGold = Math.round(grossGold * (1 + surcharge));
            totalGold = grossGold + tariffGold;
            if (importer.wealth < totalGold) continue;
          }

          const riverToll = computeRiverTollForPath(route.pathCells, route.mode);
          if (riverToll.riverTollGold > 0) {
            tariffGold += riverToll.riverTollGold;
            totalGold = grossGold + tariffGold;
            if (importer.wealth < totalGold) continue;
          }

          const crewAlloc = allocateCrew(sellerQueues, route.mode, tradeQty, totalGold);
          if (!crewAlloc) continue;

          // Escrow cargo off source stockpile immediately; credit happens on delivery
          seller.inventory[demand.goodKey] = Math.max(0, sellerQty - tradeQty);
          modifiedBurgInventory.add(seller.burg_id);

          const carriageWeight = Math.round(tradeQty * (gInfo?.carriage || 1) * 100) / 100;
          crewAssignIds.push(crewAlloc.merchantId, ...crewAlloc.crewIds);
          activeLaneKeys.add(`${seller.burg_id}:${importer.burg_id}:${demand.goodKey}`);

          newShipments.push({
            sourceBurgId: seller.burg_id,
            destBurgId: importer.burg_id,
            sourceFactionId: seller.faction_id,
            destFactionId: impFactionId,
            mode: route.mode,
            goodId: gInfo?.id || demand.goodId,
            goodKey: demand.goodKey,
            goodName: demand.goodName,
            quantity: tradeQty,
            unitPrice,
            totalGold,
            tariffGold,
            carriageWeight,
            merchantId: crewAlloc.merchantId,
            crewIds: crewAlloc.crewIds,
            guardCount: crewAlloc.guardCount,
            pathCells: route.pathCells,
            startCellId: route.pathCells[0]!,
            etaTicks: route.etaTicks,
          });

          shipmentsDispatched++;
          dispatchedForImporter++;
          foundDispatch = true;

          if (seller.burg_id === 1 || importer.burg_id === 1 || dispatchEventsEmitted < MAX_DISPATCH_EVENTS_PER_TICK) {
            dispatchEventsEmitted++;
            pendingEvents.push({
              tick,
              type: "CARAVAN_DISPATCH",
              message: `🚚 ${route.mode} CONVOY DISPATCHED: Living citizens of ${seller.name} set out along the trade routes toward ${importer.name} with ${tradeQty} ${demand.goodName} (ETA ${route.etaTicks} days, tariff ${tariffGold} gold).`,
              tier: "MINOR",
              factionId: seller.faction_id || null,
              outlawId: null,
              burgId: seller.burg_id,
              cellId: seller.cell_id,
            });
          }
          break;
        }

        if (!foundDispatch && embargoEncountered && demand.critical && !embargoedBurgsThisTick.has(importer.burg_id)) {
          embargoedBurgsThisTick.add(importer.burg_id);
          embargoStalls.push({
            burgId: importer.burg_id,
            burgName: importer.name,
            factionId: impFactionId,
            neededGoodKey: demand.goodKey,
            neededGoodName: demand.goodName,
            category: demand.category,
            stalledProject: impTier === 1 ? "Town Charter" : impTier === 2 ? "City Walls" : "Workshops",
          });

          if (tick % 3 === 0) {
            importer.unrest = Math.min(100, importer.unrest + 1);
            modifiedBurgStats.add(importer.burg_id);
            pendingEvents.push({
              tick,
              type: "TRADE_EMBARGO_CHOKEPOINT",
              message: `⚠️ TRADE EMBARGO CHOKEPOINT: Workshops in ${importer.name} stalled! Vital ${demand.goodName} shipments blocked by wartime embargo with ${embargoingFactionName}.`,
              tier: "MAJOR",
              factionId: impFactionId || null,
              outlawId: null,
              burgId: importer.burg_id,
              cellId: importer.cell_id,
            });
          }
        }
      }
    }

    // Resolve any cohort-backed placeholder crew tokens in one batched promotion call
    const usedTokens: number[] = [];
    const seenTok = new Set<number>();
    for (const s of newShipments) {
      if (s.merchantId < 0 && !seenTok.has(s.merchantId)) {
        seenTok.add(s.merchantId);
        usedTokens.push(s.merchantId);
      }
      for (const cid of s.crewIds) {
        if (cid < 0 && !seenTok.has(cid)) {
          seenTok.add(cid);
          usedTokens.push(cid);
        }
      }
    }
    if (usedTokens.length > 0) {
      const specs = usedTokens.map((t) => cohortCrewSpecsByToken.get(t)!);
      const promoted = await promoteBatchFromCohorts(client, specs, tick);
      const tokToId = new Map<number, number>();
      for (let i = 0; i < usedTokens.length; i++) {
        const p = promoted[i];
        if (p) tokToId.set(usedTokens[i]!, p.citizenId);
      }
      for (const s of newShipments) {
        if (s.merchantId < 0) s.merchantId = tokToId.get(s.merchantId) || s.merchantId;
        s.crewIds = s.crewIds.map((c) => (c < 0 ? (tokToId.get(c) || c) : c)).filter((c) => c > 0);
      }
      for (let i = 0; i < crewAssignIds.length; i++) {
        const id = crewAssignIds[i]!;
        if (id < 0) crewAssignIds[i] = tokToId.get(id) || id;
      }
    }

    if (newShipments.length > 0) {
      await client.query(
        `INSERT INTO sim_trade_shipments (
           source_burg_id, dest_burg_id, source_faction_id, dest_faction_id,
           transport_mode, good_id, good_key, good_name, quantity, unit_price,
           total_gold, tariff_gold, carriage_weight, merchant_citizen_id,
           crew_citizen_ids, guard_count, path_cells, path_index,
           current_cell_id, status, dispatched_tick, eta_ticks
         )
         SELECT unnest($1::int[]), unnest($2::int[]), unnest($3::int[]), unnest($4::int[]),
                unnest($5::text[]), unnest($6::int[]), unnest($7::text[]), unnest($8::text[]),
                unnest($9::int[]), unnest($10::real[]), unnest($11::int[]), unnest($12::int[]),
                unnest($13::real[]), unnest($14::int[]), unnest($15::jsonb[]), unnest($16::int[]),
                unnest($17::jsonb[]), 0, unnest($18::int[]), 'IN_TRANSIT', $19, unnest($20::int[])`,
        [
          newShipments.map((n) => n.sourceBurgId),
          newShipments.map((n) => n.destBurgId),
          newShipments.map((n) => n.sourceFactionId),
          newShipments.map((n) => n.destFactionId),
          newShipments.map((n) => n.mode),
          newShipments.map((n) => n.goodId),
          newShipments.map((n) => n.goodKey),
          newShipments.map((n) => n.goodName),
          newShipments.map((n) => n.quantity),
          newShipments.map((n) => n.unitPrice),
          newShipments.map((n) => n.totalGold),
          newShipments.map((n) => n.tariffGold),
          newShipments.map((n) => n.carriageWeight),
          newShipments.map((n) => n.merchantId),
          newShipments.map((n) => JSON.stringify(n.crewIds)),
          newShipments.map((n) => n.guardCount),
          newShipments.map((n) => JSON.stringify(n.pathCells)),
          newShipments.map((n) => n.startCellId),
          tick,
          newShipments.map((n) => n.etaTicks),
        ]
      );
    }

    if (crewAssignIds.length > 0) {
      const uniqueAssign = Array.from(new Set(crewAssignIds)).sort((a, b) => a - b);
      await client.query(
        `UPDATE population_demographics
         SET allegiance_status = 'ON_CARAVAN'
         WHERE citizen_id = ANY($1::int[]) AND allegiance_status = 'CIVILIAN'`,
        [uniqueAssign]
      );
    }
  }

  // ── BULK PERSIST MUTATIONS DETERMINISTICALLY ─────────────────────────────────
  if (modifiedBurgInventory.size > 0) {
    const ids = Array.from(modifiedBurgInventory).sort((a, b) => a - b);
    await client.query(
      `INSERT INTO sim_industrial_stockpiles (burg_id, complex_inventory)
       SELECT unnest($1::int[]), unnest($2::text[])
       ON CONFLICT (burg_id) DO UPDATE SET
         complex_inventory = EXCLUDED.complex_inventory`,
      [ids, ids.map((id) => JSON.stringify(burgMap.get(id)!.inventory))]
    );
  }

  if (modifiedBurgStats.size > 0) {
    const ids = Array.from(modifiedBurgStats).sort((a, b) => a - b);
    await client.query(
      `UPDATE sim_burg_economy AS b SET
         wealth = v.wealth,
         food = v.food,
         unrest = v.unrest
       FROM (
         SELECT unnest($1::int[]) AS burg_id,
                unnest($2::int[]) AS wealth,
                unnest($3::int[]) AS food,
                unnest($4::int[]) AS unrest
       ) AS v
       WHERE b.burg_id = v.burg_id`,
      [
        ids,
        ids.map((id) => Math.max(0, Math.round(burgMap.get(id)!.wealth))),
        ids.map((id) => Math.max(0, Math.round(burgMap.get(id)!.food))),
        ids.map((id) => Math.max(0, Math.min(100, Math.round(burgMap.get(id)!.unrest)))),
      ]
    );
  }

  if (factionTreasuryDelta.size > 0) {
    const fIds = Array.from(factionTreasuryDelta.keys()).sort((a, b) => a - b);
    await client.query(
      `UPDATE sim_factions AS f SET treasury = COALESCE(f.treasury, 0) + v.delta
       FROM (SELECT unnest($1::int[]) AS id, unnest($2::bigint[]) AS delta) AS v
       WHERE f.id = v.id`,
      [fIds, fIds.map((id) => Math.round(factionTreasuryDelta.get(id) || 0))]
    );
  }

  if (modifiedLairIds.size > 0) {
    const lIds = Array.from(modifiedLairIds).sort((a, b) => a - b);
    const lairById = new Map<number, LairEntry>(lairs.map((l: LairEntry) => [l.id, l]));
    await client.query(
      `UPDATE sim_fringe_lairs AS l SET inventory = v.inv, heat = v.heat
       FROM (SELECT unnest($1::int[]) AS id, unnest($2::jsonb[]) AS inv, unnest($3::int[]) AS heat) AS v
       WHERE l.id = v.id`,
      [
        lIds,
        lIds.map((id) => JSON.stringify(lairById.get(id)!.inventory)),
        lIds.map((id) => Math.round(lairById.get(id)!.heat)),
      ]
    );
  }

  if (outlawWealthDelta.size > 0) {
    const oIds = Array.from(outlawWealthDelta.keys()).sort((a, b) => a - b);
    await client.query(
      `UPDATE sim_outlaw_factions AS f SET wealth = COALESCE(f.wealth, 0) + v.delta
       FROM (SELECT unnest($1::int[]) AS id, unnest($2::int[]) AS delta) AS v
       WHERE f.id = v.id`,
      [oIds, oIds.map((id) => Math.round(outlawWealthDelta.get(id) || 0))]
    );
  }

  if (pendingEvents.length > 0) {
    await client.query(
      `INSERT INTO sim_events (tick, type, message, tier, faction_id, outlaw_id, burg_id, cell_id, lore_date)
       SELECT $1, unnest($2::text[]), unnest($3::text[]), unnest($4::text[]),
              unnest($5::int[]), unnest($6::int[]), unnest($7::int[]), unnest($8::int[]), $9`,
      [
        tick,
        pendingEvents.map((e) => e.type),
        pendingEvents.map((e) => e.message),
        pendingEvents.map((e) => e.tier),
        pendingEvents.map((e) => e.factionId),
        pendingEvents.map((e) => e.outlawId),
        pendingEvents.map((e) => e.burgId),
        pendingEvents.map((e) => e.cellId),
        loreDate,
      ]
    );
  }

  return {
    tradesExecuted,
    shipmentsStepped,
    shipmentsDispatched,
    shipmentsDelivered,
    shipmentsIntercepted,
    shipmentsAborted,
    embargoStalls,
  };
}

function buildDeliveryMessage(
  mode: TransportMode,
  sourceBurgName: string,
  destBurgName: string,
  amount: number,
  goodName: string,
  goodKey: string,
  totalGold: number,
  tariffGold: number
): string {
  const modeTag = mode === "SEA" ? "merchant vessel" : mode === "AIR" ? "aether-skiff" : "trade caravan";
  if (goodKey === "perfume") {
    return `📜 COVERT INTEL EXCHANGE: A ${modeTag} from ${sourceBurgName} docked in ${destBurgName} with crates invoiced as ${goodName}, clearing ${tariffGold} gold customs duty.`;
  }
  if (goodKey === "aether_clear") {
    return `🍄 MYCELIAL RELIEF SHIPMENT: Reliance scholars' ${modeTag} from ${sourceBurgName} delivered ${amount} vials of ${goodName} into ${destBurgName} (${totalGold} gold settled).`;
  }
  if (goodKey === "jitter_rigs") {
    return `🐻 URSINE PRECISION CONVOY: A ${modeTag} from ${sourceBurgName} delivered ${amount} ${goodName} to ${destBurgName}'s builders (${totalGold} gold settled, ${tariffGold} tariff).`;
  }
  return `📦 INTER-FACTION TRADE: A ${modeTag} from ${sourceBurgName} reached ${destBurgName}, delivering ${amount} ${goodName} for ${totalGold} gold (${tariffGold} gold tariff).`;
}
