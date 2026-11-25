import type { Delta } from "../../deltas/types.js";
import type {
  PathStepResult,
  RoutePlan,
  RouteSearchMemo,
  TransportMode,
} from "../../economy/routeGraphRouter.js";
import type { CommodityCategory } from "../../economy/factionSpecialties.js";
import type { PromoteBatchSpec } from "../../lod/promote.js";

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

export interface TradeRouter {
  getCellCoords(cellId: number): { x: number; y: number } | null;
  distBetweenCells(a: number, b: number): number;
  advanceAlongPath(pathCells: number[], currentIndex: number, mode: TransportMode): PathStepResult;
  findTradeRoute(opts: {
    fromCellId: number;
    toCellId: number;
    allowedModes: TransportMode[];
    blockedCells?: Set<number>;
    avoidFactionIds?: Set<number>;
    cellFactionMap?: Map<number, number>;
    memo?: RouteSearchMemo;
  }): RoutePlan | null;
  computeRiverTollForPath(
    pathCells: number[],
    mode: TransportMode
  ): { crossings: number; riverTollGold: number };
  createRouteSearchMemo(): RouteSearchMemo;
}

export interface TradeDiplomacySnap {
  factionAId: number;
  factionBId: number;
  status: string;
}

export interface TradeFactionSnap {
  id: number;
  name: string;
  fiscalEconomy: unknown;
}

export interface TradeLairSnap {
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

export interface TradeGoodSnap {
  id: number;
  name: string;
  key: string;
  value: number;
  carriage: number;
  recipes: Array<Record<string, number>>;
}

export interface TradeMarketSnap {
  id: number;
  centerBurgId: number;
  goods: Record<string, any>;
}

export interface TradeBurgProfileSnap {
  marketId?: number | undefined;
  primary?: Array<{ goodId: number; key: string; share: number }> | undefined;
  crafted?: Array<{ goodId: number; key: string; targetOutput: number }> | undefined;
}

export interface TradeBurgSnap {
  burgId: number;
  name: string;
  cellId: number;
  factionId: number;
  factionName: string;
  marketId: number;
  wealth: number;
  food: number;
  urbanTier: number;
  unrest: number;
  port: boolean;
  inventory: Record<string, number>;
  profile: TradeBurgProfileSnap;
}

export interface TradeShipmentSnap {
  id: number;
  sourceBurgId: number;
  destBurgId: number;
  sourceFactionId: number;
  destFactionId: number;
  transportMode: TransportMode;
  goodId: number;
  goodKey: string;
  goodName: string;
  quantity: number;
  totalGold: number;
  tariffGold: number;
  guardCount: number;
  pathCells: number[];
  pathIndex: number;
  currentCellId: number;
  etaTicks: number;
  crewIds: number[];
}

export interface TradeInTransitCrewSnap {
  citizenId: number;
  settlementId: number;
  profession: string;
  lifeStage: string;
  allegianceStatus: string;
}

export interface TradeLivingCrewSnap {
  citizenId: number;
  settlementId: number;
  profession: string;
}

export interface TradeCohortCrewSnap {
  burgId: number;
  profession: string;
  count: number;
}

export interface TradeDealSnap {
  fromBurgId: number;
  toMarketId: number;
  goodId: number;
  transportCost: number;
}

export interface TradeSnapshot {
  tick: number;
  loreDate: string;
  diplomacy: TradeDiplomacySnap[];
  factions: TradeFactionSnap[];
  cellFactionEntries: Array<[number, number]>;
  blockedCellIds: number[];
  lairs: TradeLairSnap[];
  goods: TradeGoodSnap[];
  markets: TradeMarketSnap[];
  burgs: TradeBurgSnap[];
  inTransitShipments: TradeShipmentSnap[];
  inTransitCrewMeta: TradeInTransitCrewSnap[];
  livingCrew: TradeLivingCrewSnap[];
  cohortCrewCounts: TradeCohortCrewSnap[];
  tradeDeals: TradeDealSnap[];
}

export interface TradeCrewQueues {
  merchants: number[];
  drovers: number[];
  sailors: number[];
  skycrew: number[];
  guards: number[];
}

export interface TradePendingEvent {
  tick: number;
  type: string;
  message: string;
  tier: "MINOR" | "MAJOR";
  factionId: number | null;
  outlawId: number | null;
  burgId: number | null;
  cellId: number | null;
}

export interface TradeShipmentUpdateSpec {
  id: number;
  status: "IN_TRANSIT" | "DELIVERED" | "INTERCEPTED" | "ABORTED";
  pathIndex: number;
  currentCellId: number;
  etaTicks: number;
  resolvedTick: number | null;
  pathCells?: number[] | undefined;
}

export interface PendingTradeDispatch {
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
}

export interface TradeCohortPromotion {
  token: number;
  spec: PromoteBatchSpec;
}

export interface StepTradeOptions {
  random?: () => number;
  router: TradeRouter;
}

export interface TradeStepOutput {
  result: TradeEngineResult;
  deltas: Delta[];
  pendingDispatches: PendingTradeDispatch[];
  cohortPromotions: TradeCohortPromotion[];
  assignedCitizenIds: number[];
}

export interface WorkingBurg {
  burgId: number;
  name: string;
  cellId: number;
  factionId: number;
  factionName: string;
  marketId: number;
  wealth: number;
  food: number;
  urbanTier: number;
  unrest: number;
  port: boolean;
  inventory: Record<string, number>;
  profile: TradeBurgProfileSnap;
}

export interface WorkingLair {
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

export interface TradeWorldContext {
  tick: number;
  warMap: Set<string>;
  warEnemiesByFaction: Map<number, Set<number>>;
  factionMap: Map<number, TradeFactionSnap>;
  cellFactionMap: Map<number, number>;
  blockedCells: Set<number>;
  lairs: WorkingLair[];
  lairsByCell: Map<number, WorkingLair[]>;
  goodById: Map<number, TradeGoodSnap>;
  goodByKey: Map<string, TradeGoodSnap>;
  marketGoodsById: Map<number, Record<string, any>>;
  marketCenterBurgById: Map<number, number>;
  burgsOrdered: WorkingBurg[];
  burgMap: Map<number, WorkingBurg>;
  inTransitCrewById: Map<number, TradeInTransitCrewSnap>;
  routeMemo: RouteSearchMemo;
}

export interface TradeMutableState {
  modifiedBurgInventory: Set<number>;
  modifiedBurgStats: Set<number>;
  modifiedLairIds: Set<number>;
  factionTreasuryDelta: Map<number, number>;
  outlawWealthDelta: Map<number, number>;
  crewReleaseIds: number[];
  crewAssignIds: number[];
  pendingEvents: TradePendingEvent[];
  embargoStalls: TradeEmbargoStall[];
  activeLaneKeys: Set<string>;
  shipmentUpdates: TradeShipmentUpdateSpec[];
  tradesExecuted: number;
  shipmentsStepped: number;
  shipmentsDelivered: number;
  shipmentsIntercepted: number;
  shipmentsAborted: number;
  shipmentsDispatched: number;
  arrivalEventsEmitted: number;
}
