import { FACTION_SPECIALTIES, type CommodityCategory, getGoodsByCategory } from "../../economy/factionSpecialties.js";
import { AIR_CAPABLE_FACTION_IDS } from "../../economy/goodCatalog.js";
import type { RoutePlan, TransportMode } from "../../economy/routeGraphRouter.js";
import type { PromoteBatchSpec } from "../../lod/promote.js";
import type {
  PendingTradeDispatch,
  TradeCohortPromotion,
  TradeCrewQueues,
  TradeFactionSnap,
  TradeGoodSnap,
  TradeMutableState,
  TradeRouter,
  TradeSnapshot,
  TradeWorldContext,
  WorkingBurg,
} from "./types.js";

const MAX_ACTIVE_SHIPMENTS = 120;
const MAX_DISPATCH_PER_TICK = 24;
const MAX_SELLER_CANDIDATES = 6;
const MAX_DISPATCH_EVENTS_PER_TICK = 5;

const LOGISTICS_PROFESSIONS = new Set([
  "Merchant Factor",
  "Merchant Trader",
  "Caravan Drover",
  "Caravan Guard",
  "Sailor",
  "Aether-Crew",
]);

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

function getTariffRate(
  destFaction: TradeFactionSnap | undefined,
  sourceFactionId: number,
  goodId: number
): number {
  if (!destFaction || Number(destFaction.id) === sourceFactionId || sourceFactionId <= 0) return 0;
  const fiscal = parseJson<any>(destFaction.fiscalEconomy, {});
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
  goodInfo: TradeGoodSnap | undefined,
  marketGoods: Record<string, any> | undefined,
  specialtyPrice: number
): number {
  const mPrice = Number(marketGoods?.[String(goodId)]?.price);
  if (Number.isFinite(mPrice) && mPrice > 0) return mPrice;
  if (goodInfo && Number.isFinite(goodInfo.value) && goodInfo.value > 0) return goodInfo.value;
  return specialtyPrice > 0 ? specialtyPrice : 8;
}

function hasModeCrew(q: TradeCrewQueues | undefined, mode: TransportMode): boolean {
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
  q: TradeCrewQueues,
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

function getOrCreateQueues(map: Map<number, TradeCrewQueues>, burgId: number): TradeCrewQueues {
  let q = map.get(burgId);
  if (!q) {
    q = { merchants: [], drovers: [], sailors: [], skycrew: [], guards: [] };
    map.set(burgId, q);
  }
  return q;
}

function pushCrewMember(q: TradeCrewQueues, profession: string, id: number): void {
  if (profession === "Merchant Factor" || profession === "Merchant Trader") q.merchants.push(id);
  else if (profession === "Caravan Drover") q.drovers.push(id);
  else if (profession === "Sailor") q.sailors.push(id);
  else if (profession === "Aether-Crew") q.skycrew.push(id);
  else if (profession === "Caravan Guard") q.guards.push(id);
}

/**
 * Pure Phase C: plans new citizen-crewed trade convoys from surplus burgs to deficit/crafting
 * importers, emitting cargo escrows and placeholder cohort promotion specs when needed.
 */
export function planTradeDispatches(
  snap: TradeSnapshot,
  ctx: TradeWorldContext,
  state: TradeMutableState,
  router: TradeRouter
): { pendingDispatches: PendingTradeDispatch[]; cohortPromotions: TradeCohortPromotion[] } {
  const pendingDispatches: PendingTradeDispatch[] = [];
  const cohortPromotions: TradeCohortPromotion[] = [];
  const activeRemainingCount = state.activeLaneKeys.size;
  if (activeRemainingCount >= MAX_ACTIVE_SHIPMENTS) {
    return { pendingDispatches, cohortPromotions };
  }

  const { tick } = ctx;

  // 1. Index post-Phase-B surplus holders per good key deterministically (`burg_id ASC`)
  const surplusByGood = new Map<string, WorkingBurg[]>();
  const surplusBurgSet = new Set<number>();
  for (const b of ctx.burgsOrdered) {
    let hasSurplus = false;
    for (const [gKey, qtyRaw] of Object.entries(b.inventory)) {
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
    if (hasSurplus) surplusBurgSet.add(b.burgId);
  }

  // 2. Build living crew queues + cohort placeholder slots for surplus burgs (matching SQL LIMIT 8 per prof)
  const crewQueuesByBurg = new Map<number, TradeCrewQueues>();
  const cohortCrewSpecsByToken = new Map<number, PromoteBatchSpec>();
  let nextCohortToken = -1;

  if (surplusBurgSet.size > 0) {
    const byBurgProf = new Map<string, { burgId: number; profession: string; ids: number[] }>();
    const addLivingCandidate = (burgId: number, profession: string, citizenId: number) => {
      if (!surplusBurgSet.has(burgId) || !LOGISTICS_PROFESSIONS.has(profession)) return;
      const key = `${burgId}\0${profession}`;
      let entry = byBurgProf.get(key);
      if (!entry) {
        entry = { burgId, profession, ids: [] };
        byBurgProf.set(key, entry);
      }
      if (!entry.ids.includes(citizenId)) entry.ids.push(citizenId);
    };

    for (const c of snap.livingCrew) {
      addLivingCandidate(c.settlementId, c.profession, c.citizenId);
    }
    // Include ON_CARAVAN crew released in Phase B into the post-Phase-B pool before applying LIMIT 8
    for (const cid of state.crewReleaseIds) {
      const meta = ctx.inTransitCrewById.get(cid);
      if (meta && meta.lifeStage === "ADULT" && meta.allegianceStatus === "ON_CARAVAN") {
        addLivingCandidate(meta.settlementId, meta.profession, cid);
      }
    }

    const perBurgEntries: Array<{ settlementId: number; profession: string; citizenId: number }> = [];
    for (const entry of byBurgProf.values()) {
      entry.ids.sort((a, b) => a - b);
      for (const cid of entry.ids.slice(0, 8)) {
        perBurgEntries.push({
          settlementId: entry.burgId,
          profession: entry.profession,
          citizenId: cid,
        });
      }
    }
    perBurgEntries.sort((a, b) => {
      if (a.settlementId !== b.settlementId) return a.settlementId - b.settlementId;
      const aMer = a.profession === "Merchant Factor" ? 0 : 1;
      const bMer = b.profession === "Merchant Factor" ? 0 : 1;
      if (aMer !== bMer) return aMer - bMer;
      return a.citizenId - b.citizenId;
    });
    for (const c of perBurgEntries) {
      pushCrewMember(getOrCreateQueues(crewQueuesByBurg, c.settlementId), c.profession, c.citizenId);
    }

    const cohRows = snap.cohortCrewCounts
      .filter((r) => surplusBurgSet.has(r.burgId) && r.count > 0 && LOGISTICS_PROFESSIONS.has(r.profession))
      .sort((a, b) => {
        if (a.burgId !== b.burgId) return a.burgId - b.burgId;
        const aMer = a.profession === "Merchant Factor" ? 0 : 1;
        const bMer = b.profession === "Merchant Factor" ? 0 : 1;
        if (aMer !== bMer) return aMer - bMer;
        return a.profession.localeCompare(b.profession);
      });
    for (const row of cohRows) {
      const q = getOrCreateQueues(crewQueuesByBurg, row.burgId);
      const slots = Math.min(6, Number(row.count || 0));
      for (let k = 0; k < slots; k++) {
        const tok = nextCohortToken--;
        cohortCrewSpecsByToken.set(tok, {
          burgId: row.burgId,
          filter: { profession: row.profession, ageBand: "ADULT", allegiance: "CIVILIAN" },
          slotKey: `logistics:${tick}:${row.burgId}:${row.profession}:${k}`,
          permanent: true,
        });
        pushCrewMember(q, row.profession, tok);
      }
    }
  }

  // 3. Index canonical trade deal corridors (`sim_trade_deals`)
  const dealSuppliersByKey = new Map<string, Set<number>>();
  for (const d of snap.tradeDeals) {
    const gInfo = ctx.goodById.get(d.goodId);
    if (!gInfo) continue;
    const toCenterBurg = ctx.marketCenterBurgById.get(d.toMarketId) || 0;
    if (toCenterBurg > 0) {
      const k1 = `${toCenterBurg}:${gInfo.key}`;
      let set = dealSuppliersByKey.get(k1);
      if (!set) {
        set = new Set();
        dealSuppliersByKey.set(k1, set);
      }
      set.add(d.fromBurgId);
    }
  }

  // 4. Prioritize importers (Excelsis vertical-slice hub first, then deterministic burg_id ASC)
  const prioritizedBurgs = [...ctx.burgsOrdered].sort((a, b) => {
    if (a.burgId === 1 && b.burgId !== 1) return -1;
    if (b.burgId === 1 && a.burgId !== 1) return 1;
    return a.burgId - b.burgId;
  });

  const embargoedBurgsThisTick = new Set<number>();
  let dispatchEventsEmitted = 0;

  for (const importer of prioritizedBurgs) {
    if (activeRemainingCount + state.shipmentsDispatched >= MAX_ACTIVE_SHIPMENTS) break;
    if (state.shipmentsDispatched >= MAX_DISPATCH_PER_TICK) break;
    if (importer.wealth < 15) continue;

    const impFactionId = importer.factionId;
    const impTier = importer.urbanTier;
    const impCoord = router.getCellCoords(importer.cellId);

    const demands: Array<{
      goodId: number;
      goodKey: string;
      goodName: string;
      target: number;
      category: CommodityCategory | "CRAFTING";
      critical: boolean;
    }> = [];
    const seenDemands = new Set<string>();

    const craftedList = Array.isArray(importer.profile?.crafted) ? importer.profile.crafted : [];
    for (const cr of craftedList) {
      const craftedInfo = ctx.goodById.get(Number(cr.goodId));
      const recipe = craftedInfo?.recipes?.[0];
      if (!recipe) continue;
      for (const [inpIdStr] of Object.entries(recipe)) {
        const inpId = Number(inpIdStr);
        const inpInfo = ctx.goodById.get(inpId);
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
      demands.push({
        goodId: 9,
        goodKey: "grain",
        goodName: "Grain",
        target: 40,
        category: "PRESERVATION",
        critical: true,
      });
    }

    if (importer.burgId === 1 || (importer.burgId + tick) % 3 === 0) {
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
            const info = ctx.goodByKey.get(gk);
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

    if (ctx.blockedCells.has(importer.cellId)) {
      const crit = demands.find((d) => d.critical) || demands[0]!;
      if (!embargoedBurgsThisTick.has(importer.burgId)) {
        embargoedBurgsThisTick.add(importer.burgId);
        state.embargoStalls.push({
          burgId: importer.burgId,
          burgName: importer.name,
          factionId: impFactionId,
          neededGoodKey: crit.goodKey,
          neededGoodName: crit.goodName,
          category: crit.category,
          stalledProject: impTier === 1 ? "Town Charter" : impTier === 2 ? "City Walls" : "Workshops",
        });
        if (tick % 3 === 0) {
          importer.unrest = Math.min(100, importer.unrest + 1);
          state.modifiedBurgStats.add(importer.burgId);
          state.pendingEvents.push({
            tick,
            type: "TRADE_EMBARGO_CHOKEPOINT",
            message: `⚠️ TRADE EMBARGO CHOKEPOINT: Workshops in ${importer.name} stalled! Harbor & road approaches blockaded, halting ${crit.goodName} imports.`,
            tier: "MAJOR",
            factionId: impFactionId || null,
            outlawId: null,
            burgId: importer.burgId,
            cellId: importer.cellId,
          });
        }
      }
      continue;
    }

    const impEnemies = ctx.warEnemiesByFaction.get(impFactionId);
    const impMarketGoods = ctx.marketGoodsById.get(importer.marketId);

    let dispatchedForImporter = 0;
    for (const demand of demands) {
      if (dispatchedForImporter >= 2) break;
      if (state.shipmentsDispatched >= MAX_DISPATCH_PER_TICK) break;
      if (activeRemainingCount + state.shipmentsDispatched >= MAX_ACTIVE_SHIPMENTS) break;

      const surplusList = surplusByGood.get(demand.goodKey);
      if (!surplusList || surplusList.length === 0) continue;

      const preferredIds = dealSuppliersByKey.get(`${importer.burgId}:${demand.goodKey}`);
      let embargoEncountered = false;
      let embargoingFactionName = "";
      let foundDispatch = false;

      const peacefulCandidates: WorkingBurg[] = [];
      for (const cand of surplusList) {
        if (cand.burgId === importer.burgId) continue;
        const sq = Number(cand.inventory[demand.goodKey]) || 0;
        if (sq < 16) continue;
        if (state.activeLaneKeys.has(`${cand.burgId}:${importer.burgId}:${demand.goodKey}`)) continue;

        if (ctx.blockedCells.has(cand.cellId)) {
          embargoEncountered = true;
          embargoingFactionName = cand.factionName || "Blockaded Origin";
          continue;
        }
        if (ctx.warMap.has(`${impFactionId}_${cand.factionId}`)) {
          embargoEncountered = true;
          embargoingFactionName = cand.factionName || "Hostile Faction";
          continue;
        }
        peacefulCandidates.push(cand);
      }

      peacefulCandidates.sort((a, b) => {
        const aPref = preferredIds?.has(a.burgId) ? 0 : 1;
        const bPref = preferredIds?.has(b.burgId) ? 0 : 1;
        if (aPref !== bPref) return aPref - bPref;
        if (impCoord) {
          const ac = router.getCellCoords(a.cellId);
          const bc = router.getCellCoords(b.cellId);
          const ad = ac ? Math.hypot(ac.x - impCoord.x, ac.y - impCoord.y) : 99999;
          const bd = bc ? Math.hypot(bc.x - impCoord.x, bc.y - impCoord.y) : 99999;
          if (Math.abs(ad - bd) > 1e-6) return ad - bd;
        }
        return a.burgId - b.burgId;
      });

      for (const seller of peacefulCandidates.slice(0, MAX_SELLER_CANDIDATES)) {
        const sellerQueues = crewQueuesByBurg.get(seller.burgId);
        if (!sellerQueues || sellerQueues.merchants.length === 0) continue;

        const sellerQty = Number(seller.inventory[demand.goodKey]) || 0;
        if (sellerQty < 16) continue;

        const spec = Object.values(FACTION_SPECIALTIES).find((sp) => sp.uniqueGoodKey === demand.goodKey);
        const gInfo = ctx.goodById.get(demand.goodId) || ctx.goodByKey.get(demand.goodKey);
        const unitPrice = resolveUnitPrice(demand.goodId, gInfo, impMarketGoods, spec?.baseExportPrice || 8);

        const tradeQty = Math.min(
          20,
          Math.max(0, sellerQty - 5),
          Math.max(0, Math.floor(sellerQty * 0.4)),
          Math.floor(importer.wealth / Math.max(1, unitPrice * 0.6))
        );
        if (tradeQty < 3) continue;

        let grossGold = Math.max(3, Math.round(tradeQty * unitPrice));
        const tariffRate = getTariffRate(ctx.factionMap.get(impFactionId), seller.factionId, demand.goodId);
        let tariffGold = tariffRate > 0 ? Math.max(1, Math.round(grossGold * tariffRate)) : 0;
        let totalGold = grossGold + tariffGold;
        if (importer.wealth < totalGold) continue;

        const sellerCoord = router.getCellCoords(seller.cellId);
        const straightDist =
          sellerCoord && impCoord
            ? Math.hypot(impCoord.x - sellerCoord.x, impCoord.y - sellerCoord.y)
            : 0;

        const terrestrialModes: TransportMode[] = [];
        if (hasModeCrew(sellerQueues, "LAND")) terrestrialModes.push("LAND");
        if (hasModeCrew(sellerQueues, "SEA")) terrestrialModes.push("SEA");

        const canFly =
          hasModeCrew(sellerQueues, "AIR") &&
          (AIR_CAPABLE_FACTION_IDS.has(seller.factionId) || AIR_CAPABLE_FACTION_IDS.has(impFactionId));

        const avoidFactions = new Set<number>();
        if (impEnemies) for (const eid of impEnemies) avoidFactions.add(eid);
        const sellerEnemies = ctx.warEnemiesByFaction.get(seller.factionId);
        if (sellerEnemies) for (const eid of sellerEnemies) avoidFactions.add(eid);

        let route: RoutePlan | null = null;
        if (terrestrialModes.length > 0) {
          route = router.findTradeRoute({
            fromCellId: seller.cellId,
            toCellId: importer.cellId,
            allowedModes: terrestrialModes,
            blockedCells: ctx.blockedCells,
            avoidFactionIds: avoidFactions,
            cellFactionMap: ctx.cellFactionMap,
            memo: ctx.routeMemo,
          });
        }

        if (
          canFly &&
          (!route ||
            (straightDist > 400 &&
              (unitPrice >= 10 || demand.critical) &&
              route.etaTicks > Math.ceil(straightDist / 60) + 4))
        ) {
          const airRoute = router.findTradeRoute({
            fromCellId: seller.cellId,
            toCellId: importer.cellId,
            allowedModes: ["AIR"],
          });
          if (airRoute) route = airRoute;
        }

        if (!route || route.pathCells.length === 0) continue;

        if (
          route.mode !== "AIR" &&
          (ctx.blockedCells.size > 0 || avoidFactions.size > 0) &&
          straightDist > 0 &&
          route.totalDist > straightDist * 1.35
        ) {
          const surcharge = Math.min(0.35, (route.totalDist / straightDist - 1.35) * 0.25);
          grossGold = Math.round(grossGold * (1 + surcharge));
          totalGold = grossGold + tariffGold;
          if (importer.wealth < totalGold) continue;
        }

        const riverToll = router.computeRiverTollForPath(route.pathCells, route.mode);
        if (riverToll.riverTollGold > 0) {
          tariffGold += riverToll.riverTollGold;
          totalGold = grossGold + tariffGold;
          if (importer.wealth < totalGold) continue;
        }

        const crewAlloc = allocateCrew(sellerQueues, route.mode, tradeQty, totalGold);
        if (!crewAlloc) continue;

        // Escrow cargo off source stockpile immediately; credit happens on delivery
        seller.inventory[demand.goodKey] = Math.max(0, sellerQty - tradeQty);
        state.modifiedBurgInventory.add(seller.burgId);

        const carriageWeight = Math.round(tradeQty * (gInfo?.carriage || 1) * 100) / 100;
        state.crewAssignIds.push(crewAlloc.merchantId, ...crewAlloc.crewIds);
        state.activeLaneKeys.add(`${seller.burgId}:${importer.burgId}:${demand.goodKey}`);

        pendingDispatches.push({
          sourceBurgId: seller.burgId,
          destBurgId: importer.burgId,
          sourceFactionId: seller.factionId,
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

        state.shipmentsDispatched++;
        dispatchedForImporter++;
        foundDispatch = true;

        if (
          seller.burgId === 1 ||
          importer.burgId === 1 ||
          dispatchEventsEmitted < MAX_DISPATCH_EVENTS_PER_TICK
        ) {
          dispatchEventsEmitted++;
          state.pendingEvents.push({
            tick,
            type: "CARAVAN_DISPATCH",
            message: `🚚 ${route.mode} CONVOY DISPATCHED: Living citizens of ${seller.name} set out along the trade routes toward ${importer.name} with ${tradeQty} ${demand.goodName} (ETA ${route.etaTicks} days, tariff ${tariffGold} gold).`,
            tier: "MINOR",
            factionId: seller.factionId || null,
            outlawId: null,
            burgId: seller.burgId,
            cellId: seller.cellId,
          });
        }
        break;
      }

      if (
        !foundDispatch &&
        embargoEncountered &&
        demand.critical &&
        !embargoedBurgsThisTick.has(importer.burgId)
      ) {
        embargoedBurgsThisTick.add(importer.burgId);
        state.embargoStalls.push({
          burgId: importer.burgId,
          burgName: importer.name,
          factionId: impFactionId,
          neededGoodKey: demand.goodKey,
          neededGoodName: demand.goodName,
          category: demand.category,
          stalledProject: impTier === 1 ? "Town Charter" : impTier === 2 ? "City Walls" : "Workshops",
        });

        if (tick % 3 === 0) {
          importer.unrest = Math.min(100, importer.unrest + 1);
          state.modifiedBurgStats.add(importer.burgId);
          state.pendingEvents.push({
            tick,
            type: "TRADE_EMBARGO_CHOKEPOINT",
            message: `⚠️ TRADE EMBARGO CHOKEPOINT: Workshops in ${importer.name} stalled! Vital ${demand.goodName} shipments blocked by wartime embargo with ${embargoingFactionName}.`,
            tier: "MAJOR",
            factionId: impFactionId || null,
            outlawId: null,
            burgId: importer.burgId,
            cellId: importer.cellId,
          });
        }
      }
    }
  }

  // Collect placeholder cohort crew tokens in exact discovery order for batched promotion
  const seenTok = new Set<number>();
  for (const s of pendingDispatches) {
    if (s.merchantId < 0 && !seenTok.has(s.merchantId)) {
      seenTok.add(s.merchantId);
      const spec = cohortCrewSpecsByToken.get(s.merchantId);
      if (spec) cohortPromotions.push({ token: s.merchantId, spec });
    }
    for (const cid of s.crewIds) {
      if (cid < 0 && !seenTok.has(cid)) {
        seenTok.add(cid);
        const spec = cohortCrewSpecsByToken.get(cid);
        if (spec) cohortPromotions.push({ token: cid, spec });
      }
    }
  }

  return { pendingDispatches, cohortPromotions };
}
