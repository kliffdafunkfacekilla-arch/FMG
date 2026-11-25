import type { Delta } from "../../deltas/types.js";
import { planTradeDispatches } from "./dispatch.js";
import { stepInTransitShipments } from "./transit.js";
import type {
  PendingTradeDispatch,
  StepTradeOptions,
  TradeMutableState,
  TradeSnapshot,
  TradeStepOutput,
  TradeWorldContext,
  WorkingBurg,
  WorkingLair,
} from "./types.js";

function buildTradeWorldContext(
  snap: TradeSnapshot,
  opts: StepTradeOptions
): TradeWorldContext {
  const warMap = new Set<string>();
  const warEnemiesByFaction = new Map<number, Set<number>>();
  for (const d of snap.diplomacy) {
    if (d.status === "WAR") {
      warMap.add(`${d.factionAId}_${d.factionBId}`);
      warMap.add(`${d.factionBId}_${d.factionAId}`);
      if (!warEnemiesByFaction.has(d.factionAId)) {
        warEnemiesByFaction.set(d.factionAId, new Set());
      }
      if (!warEnemiesByFaction.has(d.factionBId)) {
        warEnemiesByFaction.set(d.factionBId, new Set());
      }
      warEnemiesByFaction.get(d.factionAId)!.add(d.factionBId);
      warEnemiesByFaction.get(d.factionBId)!.add(d.factionAId);
    }
  }

  const factionMap = new Map(snap.factions.map((f) => [f.id, f]));
  const cellFactionMap = new Map<number, number>(snap.cellFactionEntries);
  const blockedCells = new Set<number>(snap.blockedCellIds);

  const lairs: WorkingLair[] = snap.lairs.map((l) => ({
    ...l,
    inventory: { ...l.inventory },
  }));
  const lairsByCell = new Map<number, WorkingLair[]>();
  for (const l of lairs) {
    let list = lairsByCell.get(l.cellId);
    if (!list) {
      list = [];
      lairsByCell.set(l.cellId, list);
    }
    list.push(l);
  }

  const goodById = new Map(snap.goods.map((g) => [g.id, g]));
  const goodByKey = new Map(snap.goods.map((g) => [g.key, g]));
  const marketGoodsById = new Map<number, Record<string, any>>();
  const marketCenterBurgById = new Map<number, number>();
  for (const m of snap.markets) {
    marketGoodsById.set(m.id, m.goods);
    marketCenterBurgById.set(m.id, m.centerBurgId);
  }

  const burgsOrdered: WorkingBurg[] = snap.burgs.map((b) => ({
    ...b,
    inventory: { ...b.inventory },
  }));
  const burgMap = new Map<number, WorkingBurg>(burgsOrdered.map((b) => [b.burgId, b]));
  const inTransitCrewById = new Map(snap.inTransitCrewMeta.map((c) => [c.citizenId, c]));

  return {
    tick: snap.tick,
    warMap,
    warEnemiesByFaction,
    factionMap,
    cellFactionMap,
    blockedCells,
    lairs,
    lairsByCell,
    goodById,
    goodByKey,
    marketGoodsById,
    marketCenterBurgById,
    burgsOrdered,
    burgMap,
    inTransitCrewById,
    routeMemo: opts.router.createRouteSearchMemo(),
  };
}

/**
 * Resolves cohort promotion tokens on planned trade dispatches and emits `tradeShipment.create`
 * plus `citizen.status` (`ON_CARAVAN`) deltas in deterministic order.
 */
export function materializeTradeDispatchDeltas(
  pendingDispatches: PendingTradeDispatch[],
  tokenToCitizenId: Map<number, number>,
  tick: number
): Delta[] {
  const deltas: Delta[] = [];
  const assignIds: number[] = [];

  for (const raw of pendingDispatches) {
    const merchantId =
      raw.merchantId < 0 ? (tokenToCitizenId.get(raw.merchantId) || raw.merchantId) : raw.merchantId;
    const crewIds = raw.crewIds
      .map((c) => (c < 0 ? (tokenToCitizenId.get(c) || c) : c))
      .filter((c) => c > 0);

    if (merchantId > 0) assignIds.push(merchantId);
    for (const cid of crewIds) assignIds.push(cid);

    deltas.push({
      kind: "tradeShipment.create",
      sourceBurgId: raw.sourceBurgId,
      destBurgId: raw.destBurgId,
      sourceFactionId: raw.sourceFactionId,
      destFactionId: raw.destFactionId,
      transportMode: raw.mode,
      goodId: raw.goodId,
      goodKey: raw.goodKey,
      goodName: raw.goodName,
      quantity: raw.quantity,
      unitPrice: raw.unitPrice,
      totalGold: raw.totalGold,
      tariffGold: raw.tariffGold,
      carriageWeight: raw.carriageWeight,
      merchantCitizenId: merchantId,
      crewCitizenIds: crewIds,
      guardCount: raw.guardCount,
      pathCells: raw.pathCells,
      startCellId: raw.startCellId,
      dispatchedTick: tick,
      etaTicks: raw.etaTicks,
    });
  }

  const uniqueAssign = Array.from(new Set(assignIds)).sort((a, b) => a - b);
  for (const citizenId of uniqueAssign) {
    deltas.push({ kind: "citizen.status", citizenId, status: "ON_CARAVAN" });
  }

  return deltas;
}

/**
 * Pure inter-faction logistics & trade step function (zero DB, zero UI, zero async_hooks).
 * Produces deterministic updates/events alongside pending new-convoy dispatches and any
 * placeholder cohort-crew promotion specs needed before `materializeTradeDispatchDeltas`.
 */
export function stepTrade(snap: TradeSnapshot, opts: StepTradeOptions): TradeStepOutput {
  const random = opts.random ?? Math.random;
  const ctx = buildTradeWorldContext(snap, opts);
  const state: TradeMutableState = {
    modifiedBurgInventory: new Set(),
    modifiedBurgStats: new Set(),
    modifiedLairIds: new Set(),
    factionTreasuryDelta: new Map(),
    outlawWealthDelta: new Map(),
    crewReleaseIds: [],
    crewAssignIds: [],
    pendingEvents: [],
    embargoStalls: [],
    activeLaneKeys: new Set(),
    shipmentUpdates: [],
    tradesExecuted: 0,
    shipmentsStepped: 0,
    shipmentsDelivered: 0,
    shipmentsIntercepted: 0,
    shipmentsAborted: 0,
    shipmentsDispatched: 0,
    arrivalEventsEmitted: 0,
  };

  stepInTransitShipments(snap.inTransitShipments, ctx, state, opts.router, random);
  const { pendingDispatches, cohortPromotions } = planTradeDispatches(
    snap,
    ctx,
    state,
    opts.router
  );

  const deltas: Delta[] = [];

  for (const u of state.shipmentUpdates) {
    deltas.push({
      kind: "tradeShipment.update",
      shipmentId: u.id,
      status: u.status,
      pathIndex: u.pathIndex,
      currentCellId: u.currentCellId,
      etaTicks: u.etaTicks,
      resolvedTick: u.resolvedTick,
      ...(u.pathCells !== undefined ? { pathCells: u.pathCells } : {}),
    });
  }

  const uniqueRelease = Array.from(new Set(state.crewReleaseIds)).sort((a, b) => a - b);
  for (const cid of uniqueRelease) {
    const meta = ctx.inTransitCrewById.get(cid);
    if (!meta || meta.allegianceStatus === "ON_CARAVAN") {
      deltas.push({ kind: "citizen.status", citizenId: cid, status: "CIVILIAN" });
    }
  }

  for (const id of Array.from(state.modifiedBurgInventory).sort((a, b) => a - b)) {
    deltas.push({
      kind: "burgStockpile.setInventory",
      burgId: id,
      inventory: ctx.burgMap.get(id)!.inventory,
    });
  }

  for (const id of Array.from(state.modifiedBurgStats).sort((a, b) => a - b)) {
    const b = ctx.burgMap.get(id)!;
    deltas.push({
      kind: "burg.set",
      burgId: id,
      fields: {
        wealth: Math.max(0, Math.round(b.wealth)),
        food: Math.max(0, Math.round(b.food)),
        unrest: Math.max(0, Math.min(100, Math.round(b.unrest))),
      },
    });
  }

  for (const fId of Array.from(state.factionTreasuryDelta.keys()).sort((a, b) => a - b)) {
    const delta = Math.round(state.factionTreasuryDelta.get(fId) || 0);
    if (fId > 0 && delta !== 0) {
      deltas.push({ kind: "faction.update", factionId: fId, treasuryDelta: delta });
    }
  }

  const lairById = new Map<number, WorkingLair>(ctx.lairs.map((l) => [l.id, l]));
  for (const lId of Array.from(state.modifiedLairIds).sort((a, b) => a - b)) {
    const lair = lairById.get(lId)!;
    deltas.push({
      kind: "fringeLair.update",
      lairId: lId,
      heat: Math.round(lair.heat),
      inventory: lair.inventory,
    });
  }

  for (const oId of Array.from(state.outlawWealthDelta.keys()).sort((a, b) => a - b)) {
    const delta = Math.round(state.outlawWealthDelta.get(oId) || 0);
    if (oId > 0 && delta !== 0) {
      deltas.push({ kind: "outlawFaction.adjust", outlawId: oId, wealthDelta: delta });
    }
  }

  for (const e of state.pendingEvents) {
    deltas.push({
      kind: "event.log",
      tick: e.tick,
      type: e.type,
      message: e.message,
      tier: e.tier,
      loreDate: snap.loreDate,
      ...(e.burgId !== null && e.burgId > 0 ? { burgId: e.burgId } : {}),
      ...(e.cellId !== null && e.cellId > 0 ? { cellId: e.cellId } : {}),
      ...(e.factionId !== null && e.factionId > 0 ? { factionId: e.factionId } : {}),
      ...(e.outlawId !== null && e.outlawId > 0 ? { outlawId: e.outlawId } : {}),
    });
  }

  return {
    result: {
      tradesExecuted: state.tradesExecuted,
      shipmentsStepped: state.shipmentsStepped,
      shipmentsDispatched: state.shipmentsDispatched,
      shipmentsDelivered: state.shipmentsDelivered,
      shipmentsIntercepted: state.shipmentsIntercepted,
      shipmentsAborted: state.shipmentsAborted,
      embargoStalls: state.embargoStalls,
    },
    deltas,
    pendingDispatches,
    cohortPromotions,
    assignedCitizenIds: Array.from(new Set(state.crewAssignIds)).sort((a, b) => a - b),
  };
}
