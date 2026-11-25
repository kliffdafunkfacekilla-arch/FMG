import { GOOD_ROLE_BY_ID } from "../../economy/goodCatalog.js";
import type { TransportMode } from "../../economy/routeGraphRouter.js";
import type {
  TradeMutableState,
  TradeRouter,
  TradeShipmentSnap,
  TradeWorldContext,
  WorkingLair,
} from "./types.js";

const MAX_ARRIVAL_EVENTS_PER_TICK = 4;
const LAIR_AMBUSH_RADIUS = 18;
const AERIAL_LAIR_TYPES = new Set(["SECRET_AERIE_YARD", "VERGE_SKY_DOCK", "CLAN_COVERT_COVE"]);

export function buildDeliveryMessage(
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

/**
 * Pure Phase B: advances every IN_TRANSIT shipment along its route path, handling
 * war/blockade rerouting & aborts, syndicate lair ambushes, and physical arrivals.
 */
export function stepInTransitShipments(
  shipments: TradeShipmentSnap[],
  ctx: TradeWorldContext,
  state: TradeMutableState,
  router: TradeRouter,
  random: () => number
): void {
  const { tick } = ctx;

  for (const s of shipments) {
    state.shipmentsStepped++;
    const seller = ctx.burgMap.get(s.sourceBurgId);
    const importer = ctx.burgMap.get(s.destBurgId);

    if (!seller || !importer || s.pathCells.length === 0) {
      state.shipmentUpdates.push({
        id: s.id,
        status: "ABORTED",
        pathIndex: s.pathIndex,
        currentCellId: s.currentCellId,
        etaTicks: 0,
        resolvedTick: tick,
      });
      state.crewReleaseIds.push(...s.crewIds);
      state.shipmentsAborted++;
      continue;
    }

    let pathCells = s.pathCells;
    let step = router.advanceAlongPath(pathCells, s.pathIndex, s.transportMode);
    let reroutedPath: number[] | null = null;
    let reroutedEtaTicks: number | null = null;

    // 1. Check active war, hostile border traversal, or trade-blockaded visited cells
    const directWar = ctx.warMap.has(`${s.sourceFactionId}_${s.destFactionId}`);
    const hardClosed =
      directWar || ctx.blockedCells.has(importer.cellId) || ctx.blockedCells.has(seller.cellId);
    let disruptedCell: number | null = directWar
      ? step.nextCellId
      : ctx.blockedCells.has(importer.cellId)
        ? importer.cellId
        : null;

    if (!disruptedCell) {
      for (let i = 0; i < step.visitedCells.length; i++) {
        const cid = step.visitedCells[i]!;
        if (ctx.blockedCells.has(cid)) {
          disruptedCell = cid;
          break;
        }
        const isEndpoint = cid === pathCells[pathCells.length - 1];
        if (!isEndpoint) {
          const cf = ctx.cellFactionMap.get(cid) || 0;
          if (
            cf > 0 &&
            cf !== s.sourceFactionId &&
            cf !== s.destFactionId &&
            (ctx.warMap.has(`${s.sourceFactionId}_${cf}`) || ctx.warMap.has(`${s.destFactionId}_${cf}`))
          ) {
            disruptedCell = cid;
            break;
          }
        }
      }
    }

    if (disruptedCell !== null && !hardClosed && s.transportMode !== "AIR") {
      const curCellId = Number(pathCells[s.pathIndex] || s.currentCellId || seller.cellId);
      const convoyAvoid = new Set<number>();
      const sEnemies = ctx.warEnemiesByFaction.get(s.sourceFactionId);
      if (sEnemies) for (const eid of sEnemies) convoyAvoid.add(eid);
      const dEnemies = ctx.warEnemiesByFaction.get(s.destFactionId);
      if (dEnemies) for (const eid of dEnemies) convoyAvoid.add(eid);

      if (!ctx.blockedCells.has(curCellId)) {
        const reroute = router.findTradeRoute({
          fromCellId: curCellId,
          toCellId: importer.cellId,
          allowedModes: [s.transportMode],
          blockedCells: ctx.blockedCells,
          avoidFactionIds: convoyAvoid,
          cellFactionMap: ctx.cellFactionMap,
          memo: ctx.routeMemo,
        });
        const interiorClean =
          reroute &&
          reroute.pathCells.length > 1 &&
          reroute.pathCells.slice(1, -1).every((cid) => !ctx.blockedCells.has(cid));
        if (reroute && interiorClean) {
          pathCells = reroute.pathCells;
          step = router.advanceAlongPath(pathCells, 0, s.transportMode);
          reroutedPath = pathCells;
          reroutedEtaTicks = Math.max(1, reroute.etaTicks - 1);
          disruptedCell = null;
          state.pendingEvents.push({
            tick,
            type: "TRADE_ROUTE_REROUTED",
            message: `🧭 CONVOY REROUTED: ${s.transportMode} convoy from ${seller.name} bypassed blockaded sector #${curCellId} on alternate corridor toward ${importer.name} (${pathCells.length} hops, ETA ${reroutedEtaTicks} days).`,
            tier: "MINOR",
            factionId: s.destFactionId || null,
            outlawId: null,
            burgId: importer.burgId,
            cellId: step.nextCellId,
          });
        }
      }
    }

    if (disruptedCell !== null) {
      const salvageRatio = step.nextIndex <= Math.floor(pathCells.length / 2) ? 1.0 : 0.5;
      const returnedQty = Math.max(1, Math.round(s.quantity * salvageRatio));
      seller.inventory[s.goodKey] = (seller.inventory[s.goodKey] || 0) + returnedQty;
      state.modifiedBurgInventory.add(seller.burgId);

      importer.unrest = Math.min(100, importer.unrest + 1);
      state.modifiedBurgStats.add(importer.burgId);

      state.crewReleaseIds.push(...s.crewIds);
      state.shipmentUpdates.push({
        id: s.id,
        status: "ABORTED",
        pathIndex: step.nextIndex,
        currentCellId: disruptedCell,
        etaTicks: 0,
        resolvedTick: tick,
      });
      state.shipmentsAborted++;
      state.embargoStalls.push({
        burgId: importer.burgId,
        burgName: importer.name,
        factionId: s.destFactionId,
        neededGoodKey: s.goodKey,
        neededGoodName: s.goodName,
        category: "CRAFTING",
        stalledProject: "Supply Corridor",
      });
      state.pendingEvents.push({
        tick,
        type: "TRADE_EMBARGO_CHOKEPOINT",
        message: `⚠️ TRADE EMBARGO CHOKEPOINT: Convoy from ${seller.name} carrying ${s.quantity} ${s.goodName} to ${importer.name} was turned back by blockade/hostilities (${returnedQty} units salvaged back to origin).`,
        tier: "MAJOR",
        factionId: s.destFactionId || null,
        outlawId: null,
        burgId: importer.burgId,
        cellId: disruptedCell,
      });
      continue;
    }

    // 2. Check active syndicate lairs (`sim_fringe_lairs`) along visited cells
    let interceptMatch: { lair: WorkingLair; hitCell: number; hitIndex: number } | null = null;
    for (let vi = 0; vi < step.visitedCells.length; vi++) {
      const cid = step.visitedCells[vi]!;
      const exactList = ctx.lairsByCell.get(cid);
      if (exactList) {
        const hit = exactList.find(
          (l) => l.burgId !== seller.burgId || l.lairType === "TOLL_BLOCKADE"
        );
        if (hit) {
          interceptMatch = { lair: hit, hitCell: cid, hitIndex: s.pathIndex + 1 + vi };
          break;
        }
      }
      // Proximity ambush within road/sea corridor radius
      for (const l of ctx.lairs) {
        if (l.burgId === seller.burgId || l.burgId === importer.burgId) continue;
        if (s.transportMode === "AIR" && !AERIAL_LAIR_TYPES.has(l.lairType)) continue;
        if (router.distBetweenCells(cid, l.cellId) <= LAIR_AMBUSH_RADIUS) {
          interceptMatch = { lair: l, hitCell: cid, hitIndex: s.pathIndex + 1 + vi };
          break;
        }
      }
      if (interceptMatch) break;
    }

    if (interceptMatch) {
      const { lair, hitCell, hitIndex } = interceptMatch;
      const raidChance =
        lair.lairType === "TOLL_BLOCKADE" && s.guardCount === 0 && lair.manpower >= 100
          ? 1.0
          : Math.min(0.9, Math.max(0.15, lair.manpower / (lair.manpower + 18 + s.guardCount * 28)));
      const roll = random();

      if (s.guardCount >= 2 && roll >= raidChance) {
        // Escort guards negotiate/fight through with extortion toll
        const toll = Math.max(2, Math.min(importer.wealth, Math.round(s.totalGold * 0.15)));
        if (toll > 0) {
          importer.wealth = Math.max(0, importer.wealth - toll);
          state.modifiedBurgStats.add(importer.burgId);
          state.outlawWealthDelta.set(
            lair.factionId,
            (state.outlawWealthDelta.get(lair.factionId) || 0) + toll
          );
        }
      } else if (roll < raidChance) {
        lair.inventory[s.goodKey] = (lair.inventory[s.goodKey] || 0) + s.quantity;
        lair.heat = Math.min(100, lair.heat + 8);
        state.modifiedLairIds.add(lair.id);

        const plunderGold = Math.max(5, Math.round(s.totalGold * 0.5));
        state.outlawWealthDelta.set(
          lair.factionId,
          (state.outlawWealthDelta.get(lair.factionId) || 0) + plunderGold
        );

        importer.unrest = Math.min(100, importer.unrest + 2);
        state.modifiedBurgStats.add(importer.burgId);

        state.crewReleaseIds.push(...s.crewIds);
        state.shipmentUpdates.push({
          id: s.id,
          status: "INTERCEPTED",
          pathIndex: hitIndex,
          currentCellId: hitCell,
          etaTicks: 0,
          resolvedTick: tick,
          ...(reroutedPath ? { pathCells: reroutedPath } : {}),
        });
        state.shipmentsIntercepted++;
        state.pendingEvents.push({
          tick,
          type: "CARAVAN_RAIDED",
          message: `🏴‍☠️ CARAVAN INTERCEPTED: ${lair.syndicateName} (${lair.lairType.replace(/_/g, " ")}) raided a ${s.transportMode.toLowerCase()} convoy from ${seller.name} bound for ${importer.name}, seizing ${s.quantity} ${s.goodName}!`,
          tier: "MAJOR",
          factionId: s.destFactionId || null,
          outlawId: lair.factionId || null,
          burgId: importer.burgId,
          cellId: hitCell,
        });
        continue;
      }
    }

    // 3. Physical Arrival at destination burg
    if (step.arrived) {
      importer.inventory[s.goodKey] = (importer.inventory[s.goodKey] || 0) + s.quantity;
      state.modifiedBurgInventory.add(importer.burgId);

      const goodRole = GOOD_ROLE_BY_ID[s.goodId];
      if (goodRole?.isFood && goodRole.foodNutrition > 0) {
        importer.food = (Number(importer.food) || 0) + s.quantity * goodRole.foodNutrition;
      }

      const paid = Math.min(Math.max(0, importer.wealth), s.totalGold);
      const tariff = Math.min(paid, s.tariffGold);
      const sellerProceeds = Math.max(0, paid - tariff);
      importer.wealth = Math.max(0, importer.wealth - paid);
      seller.wealth = (seller.wealth || 0) + sellerProceeds;
      state.modifiedBurgStats.add(importer.burgId);
      state.modifiedBurgStats.add(seller.burgId);

      if (tariff > 0 && s.destFactionId > 0) {
        state.factionTreasuryDelta.set(
          s.destFactionId,
          (state.factionTreasuryDelta.get(s.destFactionId) || 0) + tariff
        );
      }

      state.crewReleaseIds.push(...s.crewIds);
      state.shipmentUpdates.push({
        id: s.id,
        status: "DELIVERED",
        pathIndex: pathCells.length - 1,
        currentCellId: pathCells[pathCells.length - 1]!,
        etaTicks: 0,
        resolvedTick: tick,
        ...(reroutedPath ? { pathCells: reroutedPath } : {}),
      });

      state.tradesExecuted++;
      state.shipmentsDelivered++;

      if (importer.burgId === 1 || state.arrivalEventsEmitted < MAX_ARRIVAL_EVENTS_PER_TICK) {
        state.arrivalEventsEmitted++;
        state.pendingEvents.push({
          tick,
          type: "INTER_FACTION_TRADE",
          message: buildDeliveryMessage(
            s.transportMode,
            seller.name,
            importer.name,
            s.quantity,
            s.goodName,
            s.goodKey,
            paid,
            tariff
          ),
          tier: "MINOR",
          factionId: s.destFactionId || null,
          outlawId: null,
          burgId: importer.burgId,
          cellId: importer.cellId,
        });
      }
      continue;
    }

    // 4. Still in transit — advance position & preserve lane deduplication lock
    state.activeLaneKeys.add(`${s.sourceBurgId}:${s.destBurgId}:${s.goodKey}`);
    state.shipmentUpdates.push({
      id: s.id,
      status: "IN_TRANSIT",
      pathIndex: step.nextIndex,
      currentCellId: step.nextCellId,
      etaTicks: reroutedEtaTicks ?? Math.max(1, s.etaTicks - 1),
      resolvedTick: null,
      ...(reroutedPath ? { pathCells: reroutedPath } : {}),
    });
  }
}
