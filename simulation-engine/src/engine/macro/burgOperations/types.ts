import type { CommodityCategory } from "../../economy/factionSpecialties.js";
import type { Delta } from "../../deltas/types.js";
import type { CohortKey } from "../../entities/population.js";

export const ADULT_TRADE_MAP: Record<string, string> = {
  "Forge Apprentice": "Blacksmith",
  "Weaver Youth": "Weaver",
  "Temple Ward": "Temple Acolyte",
  "Farm Hand": "Farmer",
  "Herbalist Gatherer": "Hedge Herbalist",
  "Scribe Runner": "Town Scribe",
  "Potter Apprentice": "Potter",
  "Dock Urchin": "Fisherman",
  "Stable Hand": "Caravan Drover",
  "Tinker Apprentice": "Clockmaker",
  "Kitchen Scullion": "Baker",
  "Fisher Boy": "Fisherman",
};

export const ADULT_PROFESSIONS = [
  "Blacksmith",
  "Weaver",
  "Miller",
  "Baker",
  "Carpenter",
  "Cobbler",
  "Stonemason",
  "Tanner",
  "Fisherman",
  "Farmer",
  "City Watchman",
  "Gate Sentry",
  "Town Scribe",
  "Hedge Herbalist",
  "Apothecary Apprentice",
  "Temple Acolyte",
  "Clockmaker",
  "Disenfranchised Laborer",
  "Merchant Trader",
  "Caravan Drover",
  "Potter",
  "Cooper",
  "Brewmaster",
  "Foundry Worker",
  "Armorer",
  "Bowyer",
];

export interface RecordLedger {
  unit: number;
  attunedShare: number;
}

export interface BurgGoodSnap {
  id: number;
  name: string;
  key: string;
  value: number;
  recipes: Array<Record<string, number>>;
}

export interface BurgActiveProjectSnap {
  id: number;
  burgId: number;
  projectType: string;
  targetTier: number;
  ticksRemaining: number;
}

export interface BurgOutlawSnap {
  id: number;
  manpower: number;
}

export interface BurgOpSnap {
  burgId: number;
  name: string;
  cellId: number;
  factionId: number;
  occupierFactionId: number | null;
  occupationTicks: number;
  resistanceStrength: number;
  parentBurgId: number | null;
  upstreamBurgId: number | null;
  food: number;
  wealth: number;
  health: number;
  unrest: number;
  crimeRate: number;
  urbanTier: number;
  biome: number | null;
  architectureType: string | null;
  popNull: number;
  popAttuned: number;
  recordUnit: number | null;
  popGrowthPool: number;
  popDeparturePool: number;
  speciesDemographics: string;
  militaryForces: unknown;
  resourceProfile: unknown;
  production: unknown;
  currentTemp: number;
  baseTemp: number;
  cellFlux: number;
  riverId: number;
  riverDischarge: number;
  cellEcoHealth: number;
  cellEcoMax: number;
  workforce: Record<string, { records: number; people: number }>;
  inventory: Record<string, number>;
}

export interface BurgOperationsSnapshot {
  tick: number;
  loreDate: string;
  currentSeason: string;
  burgs: BurgOpSnap[];
  goods: BurgGoodSnap[];
  chaosIntensityEntries: Array<[number, number]>;
  blockadedCellIds: number[];
  floodedCellIds: number[];
  droughtCellIds: number[];
  infrastructure: Array<{ burgId: number; type: string; level: number }>;
  activeProjects: BurgActiveProjectSnap[];
  outlaws: BurgOutlawSnap[];
  occupierTraitsByFactionEntries: Array<[number, unknown]>;
}

export interface WorkingBurg {
  burgId: number;
  name: string;
  cellId: number;
  factionId: number;
  occupierFactionId: number | null;
  occupationTicks: number;
  resistanceStrength: number;
  parentBurgId: number | null;
  upstreamBurgId: number | null;
  food: number;
  origFood: number;
  wealth: number;
  health: number;
  unrest: number;
  crimeRate: number;
  urbanTier: number;
  origUrbanTier: number;
  biome: number | null;
  architectureType: string | null;
  popNull: number;
  origPopNull: number;
  popAttuned: number;
  recordUnit: number | null;
  popGrowthPool: number;
  popDeparturePool: number;
  speciesDemographics: string;
  militaryForces: unknown;
  resourceProfile: unknown;
  production: unknown;
  currentTemp: number;
  baseTemp: number;
  cellFlux: number;
  riverId: number;
  riverDischarge: number;
  cellEcoHealth: number;
  workforce: Map<string, { records: number; people: number }>;
  inventory: Record<string, number>;
  occupationTouched: boolean;
  nameChangedToRuin: boolean;
}

export interface WorkingOutlaw {
  id: number;
  manpower: number;
}

export interface BurgEventSpec {
  tick: number;
  type: string;
  message: string;
  tier: "MINOR" | "MAJOR" | "CRITICAL";
  burgId?: number | undefined;
  cellId?: number | undefined;
}

export interface BurgTagSpec {
  burgId: number;
  tags: string[];
  temper: string | null;
  motivation: string | null;
  professionFilter: string | null;
  limit: number;
  randomSeed: number;
}

export interface InfraBuildSpec {
  burgId: number;
  cellId: number;
  type: string;
  inc: number;
}

export interface ActiveProjectCreateSpec {
  burgId: number;
  projectType: string;
  targetTier: number;
  ticksRemaining: number;
}

export interface BurgUpdateRecord {
  burgId: number;
  food: number;
  wealth: number;
  health: number;
  unrest: number;
  crimeRate: number;
  urbanTier: number;
  architectureType: string;
  popNull: number;
  popAttuned: number;
  popGrowthPool: number;
  popDeparturePool: number;
  demographics: string;
  occupierFactionId?: number | null | undefined;
  occupationTicks?: number | undefined;
  resistanceStrength?: number | undefined;
  includeOccupation: boolean;
  name?: string | undefined;
  clearWorkforce: boolean;
}

export interface StepBurgOperationsOptions {
  random?: (() => number) | undefined;
}

export interface BurgOperationsStepOutput {
  deltas: Delta[];
  cohortGrowthOps: Array<CohortKey & { delta: number }>;
  cohortRetireReqs: Array<{ burgId: number; people: number }>;
  emptiedFamineBurgs: number[];
  emptiedRuinedBurgs: number[];
}

export type UpgradeCategoryChecker = (cat: CommodityCategory, minRequired: number) => string | null;
