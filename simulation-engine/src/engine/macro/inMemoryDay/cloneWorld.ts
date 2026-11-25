import type { WorldMutable, WorldSnapshot } from "./types.js";

function cloneRecord<T extends Record<string, any>>(obj: T): T {
  const out: Record<string, any> = {};
  for (const k of Object.keys(obj)) out[k] = obj[k];
  return out as T;
}

function deepCloneJson<T>(val: T): T {
  if (val === null || val === undefined || typeof val !== "object") return val;
  if (typeof structuredClone === "function") return structuredClone(val);
  return JSON.parse(JSON.stringify(val)) as T;
}

/**
 * Clones only the mutable world state while sharing the static geography/catalog arrays by reference,
 * so multi-option what-if branches cannot leak mutations across branches or into `baseWorld`.
 */
export function cloneWorldSnapshot(base: WorldSnapshot): WorldSnapshot {
  const m = base.mutable;

  const burgs = new Map<number, typeof m.burgs extends Map<number, infer V> ? V : never>();
  for (const [id, b] of m.burgs) {
    let workforce: typeof b.workforce = null;
    if (b.workforce) {
      workforce = {};
      for (const [prof, cnt] of Object.entries(b.workforce)) {
        workforce[prof] = { records: cnt.records, people: cnt.people };
      }
    }
    burgs.set(id, {
      ...b,
      militaryForces: deepCloneJson(b.militaryForces),
      resourceProfile: deepCloneJson(b.resourceProfile),
      production: deepCloneJson(b.production),
      workforce,
    });
  }

  const stockpiles = new Map<number, Record<string, number>>();
  for (const [bid, inv] of m.stockpiles) stockpiles.set(bid, cloneRecord(inv));

  const infrastructure = new Map<string, typeof m.infrastructure extends Map<string, infer V> ? V : never>();
  for (const [k, v] of m.infrastructure) infrastructure.set(k, { ...v });

  const weatherFronts = new Map<number, typeof m.weatherFronts extends Map<number, infer V> ? V : never>();
  for (const [k, v] of m.weatherFronts) weatherFronts.set(k, { ...v });

  const chaosZones = new Map<string, typeof m.chaosZones extends Map<string, infer V> ? V : never>();
  for (const [k, v] of m.chaosZones) chaosZones.set(k, { ...v });

  const chaosFlows = new Map<number, typeof m.chaosFlows extends Map<number, infer V> ? V : never>();
  for (const [k, v] of m.chaosFlows) {
    chaosFlows.set(k, {
      ...v,
      waypoints: v.waypoints.map((w) => ({ ...w })),
      narrowSpots: v.narrowSpots.map((s) => ({ ...s })),
    });
  }

  const factions = new Map<number, typeof m.factions extends Map<number, infer V> ? V : never>();
  for (const [k, v] of m.factions) {
    factions.set(k, {
      ...v,
      fiscalEconomy: deepCloneJson(v.fiscalEconomy),
      ...(v.extra ? { extra: deepCloneJson(v.extra) } : {}),
    });
  }

  const factionUnits = new Map<number, typeof m.factionUnits extends Map<number, infer V> ? V : never>();
  for (const [k, v] of m.factionUnits) {
    factionUnits.set(k, {
      ...v,
      ...(v.extra ? { extra: deepCloneJson(v.extra) } : {}),
    });
  }

  const diplomacy = new Map<string, typeof m.diplomacy extends Map<string, infer V> ? V : never>();
  for (const [k, v] of m.diplomacy) diplomacy.set(k, { ...v });

  const paragons = new Map<number, typeof m.paragons extends Map<number, infer V> ? V : never>();
  for (const [k, v] of m.paragons) {
    paragons.set(k, { ...v, traits: deepCloneJson(v.traits) });
  }

  const outlaws = new Map<number, typeof m.outlaws extends Map<number, infer V> ? V : never>();
  for (const [k, v] of m.outlaws) outlaws.set(k, { ...v });

  const lairs = new Map<number, typeof m.lairs extends Map<number, infer V> ? V : never>();
  for (const [k, v] of m.lairs) {
    lairs.set(k, { ...v, inventory: cloneRecord(v.inventory) });
  }

  const grindCanyons = new Map<number, typeof m.grindCanyons extends Map<number, infer V> ? V : never>();
  for (const [k, v] of m.grindCanyons) grindCanyons.set(k, { ...v });

  const ghostwindDrops = new Map<number, typeof m.ghostwindDrops extends Map<number, infer V> ? V : never>();
  for (const [k, v] of m.ghostwindDrops) ghostwindDrops.set(k, { ...v });

  const markets = new Map<number, typeof m.markets extends Map<number, infer V> ? V : never>();
  for (const [k, v] of m.markets) {
    markets.set(k, { ...v, goods: deepCloneJson(v.goods) });
  }

  const commodityPrices = new Map<string, typeof m.commodityPrices extends Map<string, infer V> ? V : never>();
  for (const [k, v] of m.commodityPrices) commodityPrices.set(k, { ...v });

  const agents = new Map<number, typeof m.agents extends Map<number, infer V> ? V : never>();
  for (const [k, v] of m.agents) agents.set(k, { ...v });

  const groves = new Map<number, typeof m.groves extends Map<number, infer V> ? V : never>();
  for (const [k, v] of m.groves) groves.set(k, { ...v });

  const ancientWards = new Map<number, typeof m.ancientWards extends Map<number, infer V> ? V : never>();
  for (const [k, v] of m.ancientWards) ancientWards.set(k, { ...v });

  const tradeShipments = new Map<number, typeof m.tradeShipments extends Map<number, infer V> ? V : never>();
  for (const [k, v] of m.tradeShipments) {
    tradeShipments.set(k, {
      ...v,
      crewCitizenIds: [...v.crewCitizenIds],
      pathCells: [...v.pathCells],
    });
  }

  const citizens = new Map<number, typeof m.citizens extends Map<number, infer V> ? V : never>();
  for (const [k, v] of m.citizens) {
    citizens.set(k, { ...v, traits: [...v.traits] });
  }

  const cohorts = new Map<string, typeof m.cohorts extends Map<string, infer V> ? V : never>();
  for (const [k, v] of m.cohorts) cohorts.set(k, { ...v });

  const cellTags = new Map<number, Set<string>>();
  for (const [cid, set] of m.cellTags) cellTags.set(cid, new Set(set));

  const npcInstances = new Map<string, typeof m.npcInstances extends Map<string, infer V> ? V : never>();
  for (const [k, v] of m.npcInstances) {
    npcInstances.set(k, {
      ...v,
      needs: deepCloneJson(v.needs),
      mood: deepCloneJson(v.mood),
      beliefs: deepCloneJson(v.beliefs),
      socialLinks: deepCloneJson(v.socialLinks),
    });
  }

  const sectorLayers = new Map<string, typeof m.sectorLayers extends Map<string, infer V> ? V : never>();
  for (const [k, v] of m.sectorLayers) {
    sectorLayers.set(k, {
      ...v,
      npcs: deepCloneJson(v.npcs),
      props: deepCloneJson(v.props),
      features: deepCloneJson(v.features),
    });
  }

  const storylines = new Map<number, typeof m.storylines extends Map<number, infer V> ? V : never>();
  for (const [k, v] of m.storylines) {
    storylines.set(k, {
      ...v,
      actorIds: [...v.actorIds],
      hook: deepCloneJson(v.hook),
    });
  }

  const standing = new Map<string, typeof m.standing extends Map<string, infer V> ? V : never>();
  for (const [k, v] of m.standing) {
    standing.set(k, {
      ...v,
      reasons: v.reasons.map((r) => ({ ...r })),
    });
  }

  const nextMutable: WorldMutable = {
    calendar: { ...m.calendar },
    ecoHealth: m.ecoHealth.slice(),
    ecoMax: m.ecoMax.slice(),
    ecoPlants: m.ecoPlants.slice(),
    ecoPrey: m.ecoPrey.slice(),
    ecoPredators: m.ecoPredators.slice(),
    ecoApex: m.ecoApex.slice(),
    ecoBlight: m.ecoBlight.slice(),
    currentTemp: m.currentTemp.slice(),
    factionId: m.factionId.slice(),
    cultureId: m.cultureId.slice(),
    religionId: m.religionId.slice(),

    burgs,
    stockpiles,
    infrastructure,
    activeProjects: m.activeProjects.map((p) => ({ ...p })),
    nextProjectId: m.nextProjectId,

    weatherFronts,
    nextFrontId: m.nextFrontId,
    chaosZones,
    nextChaosZoneId: m.nextChaosZoneId,
    chaosFlows,

    factions,
    factionUnits,
    diplomacy,
    paragons,

    outlaws,
    lairs,
    nextLairId: m.nextLairId,
    grindCanyons,
    nextCanyonId: m.nextCanyonId,
    ghostwindDrops,
    nextDropId: m.nextDropId,

    markets,
    commodityPrices,

    agents,
    nextAgentId: m.nextAgentId,
    groves,
    ancientWards,

    tradeShipments,
    nextShipmentId: m.nextShipmentId,

    citizens,
    nextCitizenId: m.nextCitizenId,
    cohorts,
    cohortCrewCounts: m.cohortCrewCounts.map((c) => ({ ...c })),

    cellTags,
    npcInstances,
    sectorLayers,

    events: m.events.map((e) => ({ ...e })),
    nextEventId: m.nextEventId,
    storylines,
    nextStorylineId: m.nextStorylineId,
    scheduledEvents: m.scheduledEvents.map((s) => ({ ...s, payload: deepCloneJson(s.payload) })),
    nextScheduledId: m.nextScheduledId,
    overlays: m.overlays.map((o) => deepCloneJson(o)),
    standing,
    cultureCellCounts: new Map(m.cultureCellCounts),
    religionCellCounts: new Map(m.religionCellCounts),
  };

  return {
    static: base.static,
    mutable: nextMutable,
  };
}
