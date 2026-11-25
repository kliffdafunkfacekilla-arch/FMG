import type { Delta } from "../../deltas/types.js";

export type SatelliteType = "HAMLET" | "FARMLAND" | "LOGGING" | "WATCHTOWER";

export const SETTLEMENT_HAMLET_PREFIXES = [
  "Upper", "Lower", "Little", "Old", "South", "North", "West", "East",
  "High", "Green", "River", "Stone", "Briar", "Pine",
] as const;

export const SETTLEMENT_HAMLET_ROOTS = [
  "croft", "stead", "wick", "holm", "ford", "dell", "gate",
  "ridge", "vale", "mill", "cross", "hollow", "brook", "copse",
] as const;

export interface ExpansionCellCandidate {
  id: number;
  biome: number;
  elevation: number;
}

export interface ExpansionParentSnapshot {
  burgId: number;
  name: string;
  cellId: number;
  wealth: number;
  food: number;
  unrest: number;
  popNull: number;
  popAttuned: number;
  factionId: number | null;
  existingSatellites: number;
  neighborCandidates: ExpansionCellCandidate[];
}

export interface BurgExpansionSnapshot {
  tick: number;
  loreDate: string;
  maxBurgId: number;
  takenNames: string[];
  candidates: ExpansionParentSnapshot[];
}

export interface FoundedSatellite {
  parentBurgId: number;
  parentName: string;
  burgId: number;
  cellId: number;
  name: string;
  type: SatelliteType;
  pioneers: number;
}

export interface BurgExpansionStepResult {
  deltas: Delta[];
  founded: FoundedSatellite[];
}

export function genHamletName(
  parentName: string,
  type: SatelliteType,
  random: () => number = Math.random
): string {
  const pBase = parentName.split(" ")[0] || parentName;
  const prefix = SETTLEMENT_HAMLET_PREFIXES[Math.floor(random() * SETTLEMENT_HAMLET_PREFIXES.length)] || "Little";
  const root = SETTLEMENT_HAMLET_ROOTS[Math.floor(random() * SETTLEMENT_HAMLET_ROOTS.length)] || "stead";

  if (type === "FARMLAND") return `${prefix} ${pBase} Grange`;
  if (type === "LOGGING") return `${pBase} Timberlands`;
  if (type === "WATCHTOWER") return `${pBase} Sentinel Redoubt`;
  return `${prefix}-${pBase}${root}`;
}

/**
 * Makes a satellite name unique among existing burgs. Timberlands and Sentinel Redoubts are named from
 * the parent's first word only, so a second camp (or two parents sharing a first word) used to collide.
 * Tries the name as is, then with each hamlet prefix ("Upper Ha Timberlands"), then a numeral.
 */
export function uniqueBurgName(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  for (const prefix of SETTLEMENT_HAMLET_PREFIXES) {
    if (base.startsWith(`${prefix} `) || base.startsWith(`${prefix}-`)) continue;
    const candidate = `${prefix} ${base}`;
    if (!taken.has(candidate)) return candidate;
  }
  for (let n = 2; ; n++) {
    const candidate = `${base} ${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/**
 * Pure Phase 2.3 expansion step: every 10th tick, prosperous root burgs (< 3 existing satellites)
 * claim an unclaimed neighboring cell to found a biome-appropriate satellite, deduping cell claims
 * and burg names within the same tick.
 */
export function stepBurgExpansion(
  snap: BurgExpansionSnapshot,
  opts: { random?: () => number } = {}
): BurgExpansionStepResult {
  if (snap.tick % 10 !== 0) {
    return { deltas: [], founded: [] };
  }

  const random = opts.random ?? Math.random;
  const deltas: Delta[] = [];
  const founded: FoundedSatellite[] = [];
  const takenNames = new Set<string>(snap.takenNames);
  const claimedCellIds = new Set<number>();
  let nextBurgId = Math.max(1300, Math.round(snap.maxBurgId)) + 1;

  for (const parent of snap.candidates) {
    if (random() > 0.25) continue;
    if (parent.existingSatellites >= 3) continue;

    const targetCell = parent.neighborCandidates.find((c) => !claimedCellIds.has(c.id));
    if (!targetCell) continue;
    claimedCellIds.add(targetCell.id);

    const biome = Number(targetCell.biome) || 6;
    let satType: SatelliteType = "HAMLET";
    if (biome === 3 || biome === 4) satType = "FARMLAND";
    else if (biome >= 5 && biome <= 9) satType = random() < 0.5 ? "LOGGING" : "HAMLET";
    else if (random() < 0.25) satType = "WATCHTOWER";

    const hamletName = uniqueBurgName(genHamletName(parent.name, satType, random), takenNames);
    takenNames.add(hamletName);

    const migratePop = Math.min(120, Math.max(24, Math.floor(parent.popNull * 0.05)));
    const migrateAttuned = Math.floor(migratePop * 0.2);
    const migrateNull = migratePop - migrateAttuned;
    const startWealth = Math.min(300, Math.floor(parent.wealth * 0.1));
    const startFood = migratePop * 12;
    const newBurgId = nextBurgId++;

    if (parent.factionId && parent.factionId > 0) {
      deltas.push({
        kind: "cell.setFaction",
        cellId: targetCell.id,
        factionId: parent.factionId,
      });
    }

    deltas.push({
      kind: "burg.createSatellite",
      burgId: newBurgId,
      cellId: targetCell.id,
      name: hamletName,
      parentBurgId: parent.burgId,
      parentCellId: parent.cellId,
      settlementType: satType,
      popNull: migrateNull,
      popAttuned: migrateAttuned,
      wealth: startWealth,
      food: startFood,
      roadName: `${parent.name}-${hamletName} Country Lane`,
    });

    deltas.push({
      kind: "burg.set",
      burgId: parent.burgId,
      fields: {
        pop_null: Math.max(200, parent.popNull - migrateNull),
        pop_attuned: Math.max(0, parent.popAttuned - migrateAttuned),
        wealth: Math.max(100, parent.wealth - startWealth),
        food: Math.max(200, parent.food - startFood),
      },
    });

    deltas.push({
      kind: "event.log",
      tick: snap.tick,
      type: "OUTLYING_HAMLET_FOUNDED",
      message: `[Regional Expansion] ${parent.name} has expanded into the surrounding hinterlands! ${hamletName} (${satType.toLowerCase()}) founded in Cell ${targetCell.id} with ${migratePop} pioneers.`,
      tier: "MAJOR",
      factionId: parent.factionId && parent.factionId > 0 ? parent.factionId : undefined,
      loreDate: snap.loreDate,
    });

    founded.push({
      parentBurgId: parent.burgId,
      parentName: parent.name,
      burgId: newBurgId,
      cellId: targetCell.id,
      name: hamletName,
      type: satType,
      pioneers: migratePop,
    });
  }

  return { deltas, founded };
}
