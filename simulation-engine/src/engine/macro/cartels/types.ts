import type { Delta } from "../../deltas/types.js";

export interface CartelRowSnap {
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

export interface CartelBurgSnap {
  burgId: number;
  cellId: number;
  name: string;
  unrest: number;
  popNull: number;
  popAttuned: number;
  wealth: number;
  health: number;
  food: number;
  rawMaterials: number;
  refinedGoods: number;
  factionId: number | null;
}

export interface CartelLairSnap {
  id: number;
  factionId: number;
  cellId: number;
  burgId: number | null;
  lairType: string;
  manpower: number;
  heat: number;
  burgName: string | null;
  militaryForces: unknown;
  cartelName: string | null;
}

export interface CommanderSnap {
  traits: unknown;
  corruptionScore: number;
}

export interface CartelCanyonSnap {
  id: number;
  name: string;
  cellId: number;
  nearestBurgId: number | null;
  nearestBurgName: string | null;
}

export interface GhostwindDropSnap {
  id: number;
  createdTick: number;
  clientFactionId: number;
  targetFactionId: number;
  targetBurgId: number;
  bountyGold: number;
  clientName: string;
  targetName: string;
  targetBurgName: string;
  targetBurgWealth: number;
  targetBurgFood: number;
}

export interface FactionTreasurySnap {
  id: number;
  name: string;
  treasury: number;
}

export interface MountainBurgSnap {
  burgId: number;
  name: string;
  cellId: number;
  elevation: number;
}

export interface CircusStopSnap {
  factionId: number;
  factionName: string;
  burgId: number;
  burgName: string;
  cellId: number;
}

export interface OuterBurgSnap {
  burgId: number;
  name: string;
}

export interface CartelsSnapshot {
  tick: number;
  loreDate: string;
  dayOfYear: number;
  cartels: CartelRowSnap[];
  targetBurgs: CartelBurgSnap[];
  lairs: CartelLairSnap[];
  commandersByBurg: Record<number, CommanderSnap>;
  activeCanyons: CartelCanyonSnap[];
  pendingGhostwindDrops: GhostwindDropSnap[];
  lastGhostwindStrikeTick: number;
  topPowers: FactionTreasurySnap[];
  richestBurgByFaction: Record<number, { burgId: number; name: string }>;
  outerBurgs: OuterBurgSnap[];
  capitalBurgByFaction: Record<number, number>;
  hireableFactions: FactionTreasurySnap[];
  mountainBurgs: MountainBurgSnap[];
  circusCandidates: CircusStopSnap[];
  crackdownCrowns: FactionTreasurySnap[];
  ghostspringOriginBurgId: number | null;
}

export interface WorkingCartel {
  id: number;
  name: string;
  type: string;
  originCellId: number | null;
  originBurgId: number | null;
  initialWealth: number;
  initialManpower: number;
  initialHeat: number;
  wealth: number;
  manpower: number;
  heat: number;
}

export interface NewLairResidentRequest {
  factionId: number;
  cellId: number;
  burgId: number | null;
  lairType: string;
  cartelName: string;
  cartelType: string;
}

export interface CartelRunContext {
  snap: CartelsSnapshot;
  random: () => number;
  deltas: Delta[];
  workingById: Map<number, WorkingCartel>;
  lairCountByFaction: Map<number, number>;
  lairKeys: Set<string>; // `${factionId}:${burgId}`
  newLairsNeedingResidents: NewLairResidentRequest[];
  emitTagBurg: (
    burgId: number,
    tags: string[],
    temper: string | null,
    motivation: string | null,
    professionFilter: string | null,
    limit: number
  ) => void;
}

export interface CartelStepResult {
  deltas: Delta[];
  newLairsNeedingResidents: NewLairResidentRequest[];
}

function fnv1aWithSalt(text: string, salt: number): number {
  let h = (0x811c9dc5 ^ salt) >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic DB-free keyed shuffle pick matching `sqlShuffle(key)` semantics. */
export function pickShuffled<T>(
  items: T[],
  keyFn: (item: T) => string,
  salt: number,
  limit: number
): T[] {
  if (items.length === 0 || limit <= 0) return [];
  const ranked = items.map((item) => ({
    item,
    key: keyFn(item),
    hash: fnv1aWithSalt(keyFn(item), salt),
  }));
  ranked.sort((a, b) => a.hash - b.hash || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return ranked.slice(0, limit).map((r) => r.item);
}

/** Splits a recruitment of `people` across a burg's Nulls and attuned by headcount. */
export function recruitSplit(b: { popNull: number; popAttuned: number }, people: number): { popNull?: number; popAttuned?: number } {
  const n = Math.max(0, b.popNull || 0);
  const a = Math.max(0, b.popAttuned || 0);
  const total = n + a;
  if (total <= 0) return {};
  const fromNull = Math.round((people * n) / total);
  const fromAttuned = people - fromNull;
  return { ...(fromNull ? { popNull: -fromNull } : {}), ...(fromAttuned ? { popAttuned: -fromAttuned } : {}) };
}
