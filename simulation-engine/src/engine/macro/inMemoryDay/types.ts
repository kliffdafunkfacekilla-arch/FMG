import type { Delta } from "../../deltas/types.js";
import type { TransportMode } from "../../economy/routeGraphRouter.js";
import type { CohortKey } from "../../entities/population.js";
import type { PromoteBatchSpec } from "../../lod/promote.js";
import type { DirectorSectorSnapshot } from "../backgroundDirector/step.js";
import type { ChaosFlowAnchor, LiveChaosFlowState } from "../chaosFlow/step.js";
import type { TradeCohortCrewSnap, TradeDealSnap, TradeRouter } from "../trade/types.js";
import type { MapBounds, WeatherFrontRow } from "../weather/load.js";

export const SPATIAL_BUCKET_SIZE = 70;

export interface StaticRiverMeta {
  id: number;
  name: string | null;
  discharge: number;
  width: number;
}

export interface StaticGoodMeta {
  id: number;
  name: string;
  key: string;
  value: number;
  carriage: number;
  recipes: Array<Record<string, number>>;
}

export interface StaticTradeRoute {
  sourceBurgId: number;
  destBurgId: number;
  volume: number;
  riskLevel: number;
  status: string;
}

/** Immutable continental geography & catalog state shared by reference across cloned branches. */
export interface WorldStatic {
  bounds: MapBounds;
  cellIds: number[];
  cellIndexById: Map<number, number>;
  cellCenterX: Float64Array;
  cellCenterY: Float64Array;
  cellElevation: Int16Array;
  cellBiome: Int16Array;
  cellBaseTemp: Float32Array;
  cellRiverId: Int32Array;
  cellFlux: Int32Array;
  cellMarketId: Int32Array;
  spatialBuckets: Map<string, number[]>;
  rivers: Map<number, StaticRiverMeta>;
  goods: StaticGoodMeta[];
  chaosFlowAnchors: ChaosFlowAnchor[];
  factionBorders: Array<{ factionA: number; factionB: number }>;
  cultures: Array<{ id: number; name: string }>;
  religions: Array<{ id: number; name: string; type: string }>;
  tradeDeals: TradeDealSnap[];
  tradeRoutes: StaticTradeRoute[];
  routeGraphCellIds: Set<number>;
}

export interface InMemoryCalendarState {
  id: number | null;
  tick: number;
  year: number;
  month: number;
  monthName: string;
  dayOfMonth: number;
  dayOfYear: number;
  season: string;
  moonPhase: string;
  activeFlow: string;
  dragonDomain: string;
  isShadowWeek: boolean;
}

export interface InMemoryBurg {
  burgId: number;
  name: string;
  cellId: number;
  parentBurgId: number | null;
  upstreamBurgId: number | null;
  settlementType: string | null;
  isCapital: boolean;
  port: boolean;
  citadel: boolean;
  walls: boolean;
  plaza: boolean;
  temple: boolean;
  shanty: boolean;
  occupierFactionId: number | null;
  occupationTicks: number;
  resistanceStrength: number;
  food: number;
  wealth: number;
  health: number;
  unrest: number;
  crimeRate: number;
  rawMaterials: number;
  refinedGoods: number;
  urbanTier: number;
  biome: number | null;
  architectureType: string | null;
  popNull: number;
  popAttuned: number;
  recordUnit: number | null;
  popGrowthPool: number;
  popDeparturePool: number;
  speciesDemographics: string;
  demographics: string;
  militaryForces: unknown;
  resourceProfile: unknown;
  production: unknown;
  workforce: Record<string, { records: number; people: number }> | null;
}

export interface InMemoryInfrastructure {
  burgId: number;
  cellId: number;
  type: string;
  level: number;
  status: string;
}

export interface InMemoryActiveProject {
  id: number;
  burgId: number;
  projectType: string;
  targetTier: number;
  ticksRemaining: number;
}

export interface InMemoryChaosZone {
  id: number;
  cellId: number;
  intensity: number;
  type: string;
}

export interface InMemoryFaction {
  id: number;
  name: string;
  cultureId: number | null;
  treasury: number;
  fiscalEconomy: any;
  traitAggression?: number | undefined;
  traitEconomy?: number | undefined;
  traitMagic?: number | undefined;
  extra?: Record<string, any> | undefined;
}

export interface InMemoryFactionUnit {
  id: number;
  factionId: number;
  count: number;
  status: string;
  extra?: Record<string, any> | undefined;
}

export interface InMemoryDiplomacy {
  factionAId: number;
  factionBId: number;
  status: string;
  tension: number;
}

export interface InMemoryParagon {
  id: number;
  burgId: number | null;
  factionId: number | null;
  outlawId: number | null;
  domain: string | null;
  title: string;
  name: string;
  traits: unknown;
  want: string | null;
  flaw: string | null;
  lineWontCross: string | null;
  corruptionScore: number;
}

export interface InMemoryOutlawFaction {
  id: number;
  name: string;
  type: string;
  originCellId: number | null;
  originBurgId: number | null;
  manpower: number;
  wealth: number;
  heat: number;
  workerGroups: number;
}

export interface InMemoryFringeLair {
  id: number;
  factionId: number;
  cellId: number;
  burgId: number | null;
  lairType: string;
  manpower: number;
  heat: number;
  inventory: Record<string, number>;
}

export interface InMemoryGrindCanyon {
  id: number;
  name: string;
  cellId: number;
  dragonName: string;
  dragonDomain: string;
  dragonstoneRichness: number;
  stabilityTicksRemaining: number;
  status: "OPEN" | "COLLAPSING" | "SEALED";
  minerCrewName: string;
  closedTick: number | null;
}

export interface InMemoryGhostwindDrop {
  id: number;
  createdTick: number;
  executedTick: number | null;
  status: "PENDING" | "EXECUTED";
  clientFactionId: number;
  targetFactionId: number;
  targetBurgId: number;
  bountyGold: number;
}

export interface InMemoryMarket {
  id: number;
  centerBurgId: number;
  goods: Record<string, any>;
}

export interface InMemoryCommodityPrice {
  commodity: string;
  basePrice: number;
  currentPrice: number;
  globalSupply: number;
  globalDemand: number;
  lastUpdatedTick: number;
}

export interface InMemoryAgent {
  id: number;
  name: string;
  role: string;
  subRole: string | null;
  citizenName: string | null;
  profession: string | null;
  species: string | null;
  sparkTier: string | null;
  personalityTemper: string | null;
  personalityInstinct: string | null;
  motivation: string | null;
  locationCellId: number;
  targetCellId: number | null;
  targetGroveId: number | null;
  homeBurgId: number | null;
  factionId: number | null;
  state: string;
  corruption: number;
  drainedPower: number;
  ageTicks: number;
  activePlot: string | null;
}

export interface InMemoryGrove {
  id: number;
  cellId: number;
  dragonName: string;
  powerDomain: string;
  sealStrength: number;
}

export interface InMemoryAncientWard {
  id: number;
  cellId: number;
  flowId: number | null;
  pathName: string;
  isCharged: boolean;
  lastTriggeredTick: number;
  rechargeTicks: number;
}

export interface InMemoryTradeShipment {
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
  unitPrice: number;
  totalGold: number;
  tariffGold: number;
  carriageWeight: number;
  merchantCitizenId: number;
  crewCitizenIds: number[];
  guardCount: number;
  pathCells: number[];
  pathIndex: number;
  currentCellId: number;
  status: string;
  dispatchedTick: number;
  etaTicks: number;
  resolvedTick: number | null;
}

export interface InMemoryCitizen {
  citizenId: number;
  settlementId: number;
  homeCellId: number;
  name: string;
  profession: string;
  species: string;
  sparkTier: string;
  isNull: boolean;
  lifeStage: string;
  age: number;
  temper: string;
  instinct: string;
  motivation: string;
  allegianceStatus: string;
  unitSize: number;
  traits: string[];
  causeOfDeath: string | null;
}

export interface InMemoryCohort extends CohortKey {
  count: number;
}

export interface InMemoryNpcInstance {
  id: string;
  cellId: number;
  role: string;
  instinct: string;
  temper: string;
  needs: any;
  mood: any;
  beliefs: any[];
  socialLinks: any[];
  scheduleState: string;
  alive: boolean;
  processedForEconomy: boolean;
  recentDeceased: boolean;
  disposition: number;
  tradePriceMult: number;
}

export interface InMemoryEvent {
  id: number;
  tick: number;
  type: string;
  message: string;
  tier: string;
  loreDate: string | null;
  burgId: number | null;
  cellId: number | null;
  factionId: number | null;
  outlawId: number | null;
}

export interface InMemoryStoryline {
  id: number;
  scale: string;
  state: string;
  cellId: number;
  rx: number;
  ry: number;
  z: number;
  ruleId: string | null;
  question: string;
  stakes: string;
  actorIds: string[];
  hook: Record<string, any>;
  clock: number;
  clockMax: number;
}

export interface InMemoryScheduledEvent {
  id: number;
  dueTick: number;
  dueMinute: number;
  kind: string;
  payload: Record<string, any>;
  createdTick: number;
  firedTick: number | null;
}

export interface InMemoryStanding {
  subjectRef: string;
  partyRef: string;
  value: number;
  reasons: Array<{ tick: number; delta: number; reason: string }>;
}

/** Mutable world state cloned cheaply per simulation branch without touching PostgreSQL. */
export interface WorldMutable {
  calendar: InMemoryCalendarState;
  ecoHealth: Float32Array;
  ecoMax: Float32Array;
  ecoPlants: Float32Array;
  ecoPrey: Float32Array;
  ecoPredators: Float32Array;
  ecoApex: Float32Array;
  ecoBlight: Float32Array;
  currentTemp: Float32Array;
  factionId: Int32Array;
  cultureId: Int32Array;
  religionId: Int32Array;

  burgs: Map<number, InMemoryBurg>;
  stockpiles: Map<number, Record<string, number>>;
  infrastructure: Map<string, InMemoryInfrastructure>;
  activeProjects: InMemoryActiveProject[];
  nextProjectId: number;

  weatherFronts: Map<number, WeatherFrontRow>;
  nextFrontId: number;
  chaosZones: Map<string, InMemoryChaosZone>;
  nextChaosZoneId: number;
  chaosFlows: Map<number, LiveChaosFlowState>;

  factions: Map<number, InMemoryFaction>;
  factionUnits: Map<number, InMemoryFactionUnit>;
  diplomacy: Map<string, InMemoryDiplomacy>;
  paragons: Map<number, InMemoryParagon>;

  outlaws: Map<number, InMemoryOutlawFaction>;
  lairs: Map<number, InMemoryFringeLair>;
  nextLairId: number;
  grindCanyons: Map<number, InMemoryGrindCanyon>;
  nextCanyonId: number;
  ghostwindDrops: Map<number, InMemoryGhostwindDrop>;
  nextDropId: number;

  markets: Map<number, InMemoryMarket>;
  commodityPrices: Map<string, InMemoryCommodityPrice>;

  agents: Map<number, InMemoryAgent>;
  nextAgentId: number;
  groves: Map<number, InMemoryGrove>;
  ancientWards: Map<number, InMemoryAncientWard>;

  tradeShipments: Map<number, InMemoryTradeShipment>;
  nextShipmentId: number;

  citizens: Map<number, InMemoryCitizen>;
  nextCitizenId: number;
  cohorts: Map<string, InMemoryCohort>;
  cohortCrewCounts: TradeCohortCrewSnap[];

  cellTags: Map<number, Set<string>>;
  npcInstances: Map<string, InMemoryNpcInstance>;
  sectorLayers: Map<string, DirectorSectorSnapshot>;

  events: InMemoryEvent[];
  nextEventId: number;
  storylines: Map<number, InMemoryStoryline>;
  nextStorylineId: number;
  scheduledEvents: InMemoryScheduledEvent[];
  nextScheduledId: number;
  overlays: Array<Extract<Delta, { kind: "overlay.add" }>>;
  standing: Map<string, InMemoryStanding>;
  cultureCellCounts: Map<number, number>;
  religionCellCounts: Map<number, number>;
  pendingPromotions?: PromotedCitizenSideEffect[] | undefined;
}

export interface PromotedCitizenSideEffect {
  syntheticCitizenId: number;
  spec: PromoteBatchSpec;
}

export interface ZeroBurgCohortsSideEffect {
  burgIds: number[];
  status: "DECEASED" | "DEPARTED";
  motivation?: string | undefined;
}

export interface StepCreatedSyntheticIds {
  agents: number[];
  fronts: number[];
  lairs: number[];
  canyons: number[];
  drops: number[];
  shipments: number[];
}

export interface InMemoryDaySideEffects {
  yearlyAgingAdultMap: Record<string, string> | null;
  cohortGrowthOps: Array<CohortKey & { delta: number }>;
  cohortRetireReqs: Array<{ burgId: number; people: number }>;
  zeroBurgsPrePromote: ZeroBurgCohortsSideEffect[];
  zeroBurgsPost: ZeroBurgCohortsSideEffect[];
  promotedCitizens: PromotedCitizenSideEffect[];
  stepCreatedIds: Record<string, StepCreatedSyntheticIds>;
}

export interface WorldSnapshot {
  static: WorldStatic;
  mutable: WorldMutable;
}

export interface InMemoryDayOptions {
  random: () => number;
  tradeRouter?: TradeRouter | undefined;
  skipCellIds?: ReadonlySet<number> | undefined;
}

export interface InMemoryDayResult {
  tick: number;
  loreDate: string;
  stepDeltas: Record<string, Delta[]>;
  allDeltas: Delta[];
  stepTimingsMs: Record<string, number>;
  sideEffects: InMemoryDaySideEffects;
  totalMs: number;
}
