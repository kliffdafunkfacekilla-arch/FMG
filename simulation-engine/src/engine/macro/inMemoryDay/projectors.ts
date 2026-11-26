import { dateForTick, DAYS_PER_WEEK, isChaosPeak, isYearEnd } from "../../canon/calendar.js";
import { STORY_REOPEN_COOLDOWN_TICKS } from "../../threads/storyCooldowns.js";
import type { Delta } from "../../deltas/types.js";
import { GOOD_ROLE_BY_ID, goodKeyFromName } from "../../economy/goodCatalog.js";
import type { OpposingAgentSnap } from "../shared/agentNav.js";
import type { AutonomousDramaSnapshot, DramaBurgSnapshot, DramaCitizenSnapshot, DramaParagonSnapshot } from "../autonomousDrama/step.js";
import type { BackgroundDirectorSnapshot, DirectorBurgSnapshot, DirectorSectorSnapshot } from "../backgroundDirector/step.js";
import type { BurgExpansionSnapshot, ExpansionCellCandidate, ExpansionParentSnapshot } from "../burgExpansion/step.js";
import { ADULT_TRADE_MAP, type BurgActiveProjectSnap, type BurgOperationsSnapshot, type BurgOpSnap } from "../burgOperations/types.js";
import type { CalendarSnapshot } from "../calendar/load.js";
import type {
  CartelBurgSnap,
  CartelCanyonSnap,
  CartelLairSnap,
  CartelRowSnap,
  CartelsSnapshot,
  CircusStopSnap,
  CommanderSnap,
  FactionTreasurySnap,
  GhostwindDropSnap,
  MountainBurgSnap,
  OuterBurgSnap,
} from "../cartels/types.js";
import { computeChaosFlowState, lunarSurgeModifier, type ChaosFlowSnapshot, type ChaosPruneCandidate, type ChaosSampleCell, type ChaosShoreCell, type LiveChaosFlowState } from "../chaosFlow/step.js";
import type { ChroniclerDramaEvent, ChroniclerSnapshot } from "../chronicler/step.js";
import type { CultistAgentSnapshot, CultistGroveSnapshot, CultistRecruitCandidate, CultistRecruitCitizen, CultistRecruitSnapshot, CultistsSnapshot } from "../cultist/step.js";
import type { CultureFrontierCandidate, CultureReligionSnapshot, HeresyCandidate, TempleCleanseCandidate } from "../cultureReligion/step.js";
import type { EcologyBurgRow, EcologyCellRow, EcologySnapshot } from "../ecology/load.js";
import type { EncounterSnapshot } from "../encounter/load.js";
import type { FactionDiplomacySnap, FactionPlanningSnapshot } from "../factions/step.js";
import type { GrindBurgCoord, GrindCanyonRowSnapshot, GrindCanyonSnapshot, GrindWildCell } from "../grindCanyon/load.js";
import type { MandateRecruitCitizen, MandateRecruitEntry, MandateUnrestBurg, MandateWarbandSnapshot, MandateWarbandsSnapshot } from "../mandate/step.js";
import type { MarketBurgStock, MarketSnapshot } from "../market/load.js";
import type { ActiveTradeRouteSnapshot, DeceasedNpcSnapshot, LivingNpcRoutineSnapshot, NpcRoutinesSnapshot } from "../npcRoutines/step.js";
import type { ParagonBurgSnap, ParagonRowSnap, ParagonsSnapshot } from "../paragons/step.js";
import type { ReaperGhostBurg, ReaperGhostShipment, ReaperSnapshot } from "../reaper/step.js";
import type {
  TradeBurgSnap,
  TradeDiplomacySnap,
  TradeFactionSnap,
  TradeInTransitCrewSnap,
  TradeLairSnap,
  TradeLivingCrewSnap,
  TradeMarketSnap,
  TradeShipmentSnap,
  TradeSnapshot,
} from "../trade/types.js";
import type {
  CultistTargetSnap,
  HermitAgentSnapshot,
  WardenAgentSnapshot,
  WardenAwakeningCitizen,
  WardenAwakeningSnapshot,
  WardenAwakeningWard,
  WardensSnapshot,
} from "../warden/step.js";
import { getCruorbusPhase, type WeatherBurgRow, type WeatherClimateCell, type WeatherDamagedCell, type WeatherGroveRow, type WeatherSnapshot } from "../weather/load.js";
import { ageCohortsYearlyInMemory, computeWorkforceForBurgInMemory, promoteFromCohortInMemory } from "./applyMemory.js";
import { SPATIAL_BUCKET_SIZE, type InMemoryAgent, type InMemoryBurg, type InMemoryCitizen, type WorldSnapshot, type WorldStatic } from "./types.js";

function fnv32(text: string, seed = 0): number {
  let h = (0x811c9dc5 ^ seed) >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function sqlChanceEval(key: string | number, p: number, salt: number): boolean {
  const h = fnv32(String(key), salt) & 2147483647;
  return h / 2147483648.0 < p;
}

function sqlShuffleRank(key: string | number, salt: number): number {
  return fnv32(String(key), salt);
}

export function getCoordStatic(s: WorldStatic, cellId: number): { x: number; y: number } | null {
  const idx = s.cellIndexById.get(cellId);
  if (idx === undefined) return null;
  return { x: s.cellCenterX[idx]!, y: s.cellCenterY[idx]! };
}

export function queryBoxCellIndices(
  s: WorldStatic,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number
): number[] {
  const bx0 = Math.floor(minX / SPATIAL_BUCKET_SIZE);
  const bx1 = Math.floor(maxX / SPATIAL_BUCKET_SIZE);
  const by0 = Math.floor(minY / SPATIAL_BUCKET_SIZE);
  const by1 = Math.floor(maxY / SPATIAL_BUCKET_SIZE);
  const out: number[] = [];
  for (let bx = bx0; bx <= bx1; bx++) {
    for (let by = by0; by <= by1; by++) {
      const list = s.spatialBuckets.get(`${bx},${by}`);
      if (!list) continue;
      for (const idx of list) {
        const cx = s.cellCenterX[idx]!;
        const cy = s.cellCenterY[idx]!;
        if (cx >= minX && cx <= maxX && cy >= minY && cy <= maxY) {
          out.push(idx);
        }
      }
    }
  }
  return out;
}

export function findNearestCellStatic(s: WorldStatic, x: number, y: number): number | null {
  const bx = Math.floor(x / SPATIAL_BUCKET_SIZE);
  const by = Math.floor(y / SPATIAL_BUCKET_SIZE);
  let bestId: number | null = null;
  let bestDist2 = Infinity;
  for (let ring = 0; ring <= 4; ring++) {
    for (let dx = -ring; dx <= ring; dx++) {
      for (let dy = -ring; dy <= ring; dy++) {
        if (ring > 0 && Math.abs(dx) !== ring && Math.abs(dy) !== ring) continue;
        const list = s.spatialBuckets.get(`${bx + dx},${by + dy}`);
        if (!list) continue;
        for (const idx of list) {
          const ddx = s.cellCenterX[idx]! - x;
          const ddy = s.cellCenterY[idx]! - y;
          const d2 = ddx * ddx + ddy * ddy;
          const cid = s.cellIds[idx]!;
          if (d2 < bestDist2 || (d2 === bestDist2 && bestId !== null && cid < bestId)) {
            bestDist2 = d2;
            bestId = cid;
          }
        }
      }
    }
    if (bestId !== null) return bestId;
  }
  for (let idx = 0; idx < s.cellIds.length; idx++) {
    const ddx = s.cellCenterX[idx]! - x;
    const ddy = s.cellCenterY[idx]! - y;
    const d2 = ddx * ddx + ddy * ddy;
    const cid = s.cellIds[idx]!;
    if (d2 < bestDist2 || (d2 === bestDist2 && bestId !== null && cid < bestId)) {
      bestDist2 = d2;
      bestId = cid;
    }
  }
  return bestId;
}

function sortedBurgs(world: WorldSnapshot): InMemoryBurg[] {
  return Array.from(world.mutable.burgs.values()).sort((a, b) => a.burgId - b.burgId);
}

function getEffectiveFaction(world: WorldSnapshot, b: InMemoryBurg): number {
  if (b.occupierFactionId && b.occupierFactionId > 0) return b.occupierFactionId;
  const idx = world.static.cellIndexById.get(b.cellId);
  return idx !== undefined ? world.mutable.factionId[idx]! : 0;
}

function cellFactionNullable(world: WorldSnapshot, cellId: number): number | null {
  const idx = world.static.cellIndexById.get(cellId);
  if (idx === undefined) return null;
  const fid = world.mutable.factionId[idx]!;
  return fid > 0 ? fid : null;
}

export function projectCalendarSnapshot(world: WorldSnapshot, tick: number): CalendarSnapshot {
  const date = dateForTick(tick);
  let chaosBurgIds: number[] = [];
  let unrestBurgIds: number[] = [];
  if (date.dayOfMonth === 48 && !date.isShadowfall) {
    const chaosZoneCells = new Set<number>();
    for (const z of world.mutable.chaosZones.values()) {
      if (z.intensity > 40) chaosZoneCells.add(z.cellId);
    }
    const burgs = sortedBurgs(world);
    chaosBurgIds = burgs.filter((b) => chaosZoneCells.has(b.cellId)).map((b) => b.burgId);
    unrestBurgIds = burgs.filter((b) => b.unrest < 90).map((b) => b.burgId);
  }
  return {
    tick,
    calendarRowId: world.mutable.calendar.id,
    chaosBurgIds,
    unrestBurgIds,
  };
}

export function projectAndFireScheduledEvents(
  world: WorldSnapshot,
  tick: number,
  minuteOfDay: number = 1440
): Delta[] {
  const due = world.mutable.scheduledEvents
    .filter((e) => e.firedTick === null && (e.dueTick < tick || (e.dueTick === tick && e.dueMinute <= minuteOfDay)))
    .sort((a, b) => a.dueTick - b.dueTick || a.dueMinute - b.dueMinute || a.id - b.id);
  if (due.length === 0) return [];

  const deltas: Delta[] = [];
  for (const row of due) {
    row.firedTick = tick;
    const payload = row.payload || {};
    if (Array.isArray(payload.deltas)) {
      for (const d of payload.deltas) {
        if (d && typeof d === "object" && d.kind) {
          deltas.push(d.kind === "event.log" && d.tick === undefined ? { ...d, tick } : d);
        }
      }
    } else if (row.kind === "delta" && payload.kind) {
      deltas.push(payload.kind === "event.log" && payload.tick === undefined ? { ...payload, tick } : (payload as any));
    } else {
      deltas.push({
        kind: "event.log",
        tick,
        type: row.kind || "SCHEDULED_EVENT",
        message: String(payload.message || `Scheduled event ${row.kind} resolved.`),
        tier: payload.tier === "MAJOR" || payload.tier === "CRITICAL" ? payload.tier : "MINOR",
        ...(payload.burgId !== undefined ? { burgId: Number(payload.burgId) } : {}),
        ...(payload.cellId !== undefined ? { cellId: Number(payload.cellId) } : {}),
        ...(payload.factionId !== undefined ? { factionId: Number(payload.factionId) } : {}),
        ...(payload.outlawId !== undefined ? { outlawId: Number(payload.outlawId) } : {}),
      });
    }
  }
  return deltas;
}

export function projectWeatherSnapshot(
  world: WorldSnapshot,
  tick: number,
  season: string,
  dayOfMonth: number,
  loreDate: string,
  isShadowWeek: boolean
): WeatherSnapshot {
  const s = world.static;
  const m = world.mutable;
  const phase = getCruorbusPhase(season, dayOfMonth, isShadowWeek);

  const fronts = Array.from(m.weatherFronts.values())
    .sort((a, b) => a.id - b.id)
    .map((f) => ({ ...f }));

  const burgs: WeatherBurgRow[] = sortedBurgs(world).map((b) => {
    const idx = s.cellIndexById.get(b.cellId);
    const riverId = idx !== undefined ? s.cellRiverId[idx]! : 0;
    const river = riverId > 0 ? s.rivers.get(riverId) : undefined;
    return {
      burg_id: b.burgId,
      name: b.name,
      cell_id: b.cellId,
      food: b.food,
      unrest: b.unrest,
      health: b.health,
      pop_null: b.popNull,
      pop_attuned: b.popAttuned,
      architecture_type: String(b.architectureType || "WOOD"),
      center_x: idx !== undefined ? s.cellCenterX[idx]! : 0,
      center_y: idx !== undefined ? s.cellCenterY[idx]! : 0,
      river_id: riverId,
      cell_flux: idx !== undefined ? s.cellFlux[idx]! : 0,
      current_temp: idx !== undefined ? m.currentTemp[idx]! : 15,
      river_discharge: river ? river.discharge : 0,
      river_width: river ? river.width : 0,
      river_name: river ? river.name : null,
    };
  });

  const bleedGroves: WeatherGroveRow[] =
    phase === "BLEED"
      ? Array.from(m.groves.values())
          .filter((g) => g.sealStrength < 40)
          .sort((a, b) => a.id - b.id)
          .map((g) => ({ id: g.id, cell_id: g.cellId, seal_strength: g.sealStrength }))
      : [];

  const damagedCells: WeatherDamagedCell[] = [];
  if (phase === "MERCY" || (phase === "VOID_DRAIN" && dayOfMonth % 12 === 5)) {
    for (let i = 0; i < s.cellIds.length; i++) {
      if (m.ecoHealth[i]! < m.ecoMax[i]!) {
        damagedCells.push({
          id: s.cellIds[i]!,
          eco_health: m.ecoHealth[i]!,
          eco_max: m.ecoMax[i]!,
        });
      }
    }
  }

  const climateCells: WeatherClimateCell[] = [];
  if (tick % 5 === 0) {
    for (let i = 0; i < s.cellIds.length; i++) {
      climateCells.push({
        id: s.cellIds[i]!,
        center_x: s.cellCenterX[i]!,
        center_y: s.cellCenterY[i]!,
        elevation: s.cellElevation[i]!,
        current_temp: m.currentTemp[i]!,
      });
    }
  }

  return {
    tick,
    season,
    dayOfMonth,
    loreDate,
    isShadowWeek,
    phase,
    bounds: s.bounds,
    fronts,
    burgs,
    bleedGroves,
    damagedCells,
    climateCells,
  };
}

export function projectEcologySnapshot(
  world: WorldSnapshot,
  tick: number,
  season: string,
  loreDate: string,
  calCtx: { activeDragon: string; activeDomain: string; cruorbusPhase: string }
): EcologySnapshot {
  const isPeakChaos = isChaosPeak(calCtx.cruorbusPhase);
  if (tick % DAYS_PER_WEEK !== 0 && !isPeakChaos) {
    return {
      active: false,
      tick,
      season,
      loreDate,
      dragonDomain: calCtx.activeDomain,
      dragonName: calCtx.activeDragon,
      moonPhase: calCtx.cruorbusPhase,
      isPeakChaos,
      cells: [],
      burgs: [],
      chaosZones: [],
      groves: [],
    };
  }

  const s = world.static;
  const m = world.mutable;
  const cells: EcologyCellRow[] = new Array(s.cellIds.length);
  for (let i = 0; i < s.cellIds.length; i++) {
    cells[i] = {
      id: s.cellIds[i]!,
      center_x: s.cellCenterX[i]!,
      center_y: s.cellCenterY[i]!,
      eco_plants: m.ecoPlants[i]!,
      eco_prey: m.ecoPrey[i]!,
      eco_predators: m.ecoPredators[i]!,
      eco_apex: m.ecoApex[i]!,
      eco_blight: m.ecoBlight[i]!,
      eco_max: m.ecoMax[i]!,
    };
  }
  const burgs: EcologyBurgRow[] = sortedBurgs(world).map((b) => ({
    burg_id: b.burgId,
    name: b.name,
    cell_id: b.cellId,
    pop_null: b.popNull,
    food: b.food,
    unrest: b.unrest,
    wealth: b.wealth,
  }));
  const chaosZones = Array.from(m.chaosZones.values())
    .sort((a, b) => a.id - b.id)
    .map((z) => ({ id: z.id, cell_id: z.cellId, intensity: z.intensity, type: z.type }));
  const groves = Array.from(m.groves.values())
    .sort((a, b) => a.id - b.id)
    .map((g) => ({ id: g.id, cell_id: g.cellId, seal_strength: g.sealStrength }));

  return {
    active: true,
    tick,
    season,
    loreDate,
    dragonDomain: calCtx.activeDomain,
    dragonName: calCtx.activeDragon,
    moonPhase: calCtx.cruorbusPhase,
    isPeakChaos,
    cells,
    burgs,
    chaosZones,
    groves,
  };
}

export function projectChaosFlowSnapshot(
  world: WorldSnapshot,
  tick: number,
  calCtx: { activeFlow: string; dragonDomain: string; moonPhase: string }
): ChaosFlowSnapshot {
  const s = world.static;
  const m = world.mutable;
  const ctx = {
    activeFlow: calCtx.activeFlow,
    dragonDomain: calCtx.dragonDomain,
    lunarSurgeMod: lunarSurgeModifier(calCtx.moonPhase),
  };
  const liveFlows: LiveChaosFlowState[] = s.chaosFlowAnchors.map((a) => computeChaosFlowState(a, tick, ctx));

  const pruneCandidates: ChaosPruneCandidate[] = [];
  const shoreCells: ChaosShoreCell[] = [];
  if (tick % DAYS_PER_WEEK === 0) {
    for (const flow of liveFlows) {
      if (!flow.waypoints.length) continue;
      const leyTag = "#DragonLeys_" + flow.dragonName;
      const zoneType = `${flow.elementalPower.toUpperCase()}_CHAOS_LEYS`;
      const matched = new Set<number>();
      for (const [cid, tags] of m.cellTags) {
        if (tags.has(leyTag)) matched.add(cid);
      }
      for (const z of m.chaosZones.values()) {
        if (z.type === zoneType) matched.add(z.cellId);
      }
      for (const cid of Array.from(matched).sort((a, b) => a - b)) {
        const pt = getCoordStatic(s, cid);
        if (!pt) continue;
        pruneCandidates.push({ flowId: flow.flowId, cellId: cid, centerX: pt.x, centerY: pt.y });
      }
    }
    for (const [cid, tags] of Array.from(m.cellTags.entries()).sort((a, b) => a[0] - b[0])) {
      if (tags.has("#ChaosFlowShores")) {
        const leyTags = Array.from(tags).filter((t) => t.startsWith("#DragonLeys_"));
        shoreCells.push({ cellId: cid, leyTags });
      }
    }
  }

  const sampleCellsByPoint: ChaosSampleCell[][] = [];
  const agentCounts = { cultist: 0, warden: 0, chainZealot: 0 };
  if (tick % 2 === 0) {
    for (const flow of liveFlows) {
      const samplePts = [flow.waypoints[2], flow.waypoints[5], flow.waypoints[8]].filter(Boolean);
      for (const pt of samplePts) {
        if (!pt) continue;
        const idxs = queryBoxCellIndices(s, pt.x - 70, pt.y - 70, pt.x + 70, pt.y + 70);
        idxs.sort((a, b) => s.cellIds[a]! - s.cellIds[b]!);
        const picks: ChaosSampleCell[] = [];
        for (let k = 0; k < Math.min(4, idxs.length); k++) {
          const i = idxs[k]!;
          picks.push({
            id: s.cellIds[i]!,
            centerX: s.cellCenterX[i]!,
            centerY: s.cellCenterY[i]!,
            ecoBlight: m.ecoBlight[i]!,
          });
        }
        sampleCellsByPoint.push(picks);
      }
    }
    for (const a of m.agents.values()) {
      if (a.role === "Cultist") agentCounts.cultist++;
      else if (a.role === "Warden") agentCounts.warden++;
      else if (a.role === "Chain_Zealot") agentCounts.chainZealot++;
    }
  }

  return {
    tick,
    ctx,
    anchors: s.chaosFlowAnchors,
    liveFlows,
    pruneCandidates,
    shoreCells,
    sampleCellsByPoint,
    agentCounts,
  };
}

export function prepareAndProjectBurgOperations(
  world: WorldSnapshot,
  tick: number,
  loreDate: string
): BurgOperationsSnapshot {
  if (isYearEnd(tick)) {
    ageCohortsYearlyInMemory(world, ADULT_TRADE_MAP);
  }
  const s = world.static;
  const m = world.mutable;
  const isWeekly = tick % DAYS_PER_WEEK === 0;

  const sorted = sortedBurgs(world);
  for (const b of sorted) {
    if (b.recordUnit === null) b.recordUnit = 12;
    if (isWeekly || b.workforce === null) {
      b.workforce = computeWorkforceForBurgInMemory(world, b.burgId);
    }
  }

  const blockadedCellIds: number[] = [];
  const floodedCellIds: number[] = [];
  const droughtCellIds: number[] = [];
  for (const [cid, tagSet] of Array.from(m.cellTags.entries()).sort((a, b) => a[0] - b[0])) {
    const tags = Array.from(tagSet);
    if (tags.some((t) => t.includes("Blockade") || t.includes("Embargo"))) blockadedCellIds.push(cid);
    if (tags.some((t) => t.includes("RiverFlooding"))) floodedCellIds.push(cid);
    if (tags.some((t) => t.includes("DroughtStricken"))) droughtCellIds.push(cid);
  }

  const chaosIntensityEntries: Array<[number, number]> = [];
  for (const z of m.chaosZones.values()) {
    if (z.intensity >= 60) chaosIntensityEntries.push([z.cellId, z.intensity]);
  }

  const occupiedFactions = new Set<number>();
  for (const b of sorted) {
    if (b.occupierFactionId && b.occupierFactionId > 0) occupiedFactions.add(b.occupierFactionId);
  }
  const occupierTraitsByFactionEntries: Array<[number, unknown]> = [];
  const sortedOcc = Array.from(occupiedFactions).sort((a, b) => a - b);
  const allParagons = Array.from(m.paragons.values()).sort((a, b) => a.id - b.id);
  for (const fid of sortedOcc) {
    const p = allParagons.find(
      (x) => x.factionId === fid && ["Mayor", "Marshal", "Commander", "Baron"].includes(x.title)
    );
    if (p) occupierTraitsByFactionEntries.push([fid, p.traits || []]);
  }

  const burgs: BurgOpSnap[] = sorted.map((b) => {
    const idx = s.cellIndexById.get(b.cellId);
    const riverId = idx !== undefined ? s.cellRiverId[idx]! : 0;
    const river = riverId > 0 ? s.rivers.get(riverId) : undefined;
    const baseTemp = idx !== undefined ? s.cellBaseTemp[idx]! : 15;
    return {
      burgId: b.burgId,
      name: b.name,
      cellId: b.cellId,
      factionId: idx !== undefined ? m.factionId[idx]! : 0,
      occupierFactionId: b.occupierFactionId,
      occupationTicks: b.occupationTicks,
      resistanceStrength: b.resistanceStrength,
      parentBurgId: b.parentBurgId,
      upstreamBurgId: b.upstreamBurgId,
      food: b.food,
      wealth: b.wealth,
      health: b.health,
      unrest: b.unrest,
      crimeRate: b.crimeRate,
      urbanTier: b.urbanTier,
      isCapital: b.isCapital,
      biome: b.biome,
      architectureType: b.architectureType,
      popNull: b.popNull,
      popAttuned: b.popAttuned,
      recordUnit: b.recordUnit,
      popGrowthPool: b.popGrowthPool,
      popDeparturePool: b.popDeparturePool,
      speciesDemographics: b.speciesDemographics,
      militaryForces: b.militaryForces,
      resourceProfile: b.resourceProfile,
      production: b.production,
      currentTemp: idx !== undefined ? m.currentTemp[idx]! : baseTemp,
      baseTemp,
      cellFlux: idx !== undefined ? s.cellFlux[idx]! : 0,
      riverId,
      riverDischarge: river ? river.discharge : 0,
      cellEcoHealth: idx !== undefined ? m.ecoHealth[idx]! : 100,
      cellEcoMax: idx !== undefined ? m.ecoMax[idx]! : 100,
      workforce: b.workforce || {},
      inventory: { ...(m.stockpiles.get(b.burgId) || {}) },
    };
  });

  const infrastructure = Array.from(m.infrastructure.values())
    .sort((a, b) => a.burgId - b.burgId || a.type.localeCompare(b.type))
    .map((inf) => ({ burgId: inf.burgId, type: inf.type, level: inf.level }));

  const activeProjects: BurgActiveProjectSnap[] = [...m.activeProjects]
    .sort((a, b) => a.id - b.id)
    .map((p) => ({ ...p }));

  const outlaws = Array.from(m.outlaws.values())
    .sort((a, b) => a.id - b.id)
    .map((o) => ({ id: o.id, manpower: o.manpower }));

  return {
    tick,
    loreDate,
    currentSeason: m.calendar.season || "Greenspan",
    burgs,
    goods: s.goods.map((g) => ({ id: g.id, name: g.name, key: g.key, value: g.value, recipes: g.recipes })),
    chaosIntensityEntries,
    blockadedCellIds,
    floodedCellIds,
    droughtCellIds,
    infrastructure,
    activeProjects,
    outlaws,
    occupierTraitsByFactionEntries,
  };
}

export function projectParagonsSnapshot(world: WorldSnapshot, tick: number, loreDate: string): ParagonsSnapshot {
  const burgs: ParagonBurgSnap[] = sortedBurgs(world).map((b) => ({
    burgId: b.burgId,
    name: b.name,
    cellId: b.cellId,
    popNull: b.popNull,
    popAttuned: b.popAttuned,
    food: b.food,
    health: b.health,
    unrest: b.unrest,
    wealth: b.wealth,
    crimeRate: b.crimeRate,
    port: b.port,
  }));
  const paragons: ParagonRowSnap[] = Array.from(world.mutable.paragons.values())
    .sort((a, b) => a.id - b.id)
    .map((p) => ({
      id: p.id,
      burgId: p.burgId,
      outlawId: p.outlawId,
      domain: p.domain,
      title: p.title,
      name: p.name,
      traits: p.traits,
      corruptionScore: p.corruptionScore,
    }));
  const cellTagsByCell: Record<number, string[]> = {};
  for (const [cid, set] of world.mutable.cellTags) {
    cellTagsByCell[cid] = Array.from(set);
  }
  return { tick, loreDate, burgs, paragons, cellTagsByCell };
}

export function projectFactionCollapseSnapshot(
  world: WorldSnapshot,
  tick: number,
  loreDate: string
): import("../factionCollapse/load.js").FactionCollapseSnapshot {
  const aliveFactions = new Set<number>();
  for (const b of world.mutable.burgs.values()) {
    if (b.popNull + b.popAttuned > 0) {
      const fid = getEffectiveFaction(world, b);
      if (fid > 0) aliveFactions.add(fid);
    }
  }
  const factions = Array.from(world.mutable.factions.values())
    .filter((f) => f.id !== 0 && !aliveFactions.has(f.id))
    .sort((a, b) => a.id - b.id);
  if (factions.length === 0) return { tick, loreDate, candidates: [] };

  const deadSet = new Set(factions.map((f) => f.id));
  const cellsByFaction = new Map<number, number[]>();
  const s = world.static;
  const fidArr = world.mutable.factionId;
  for (let i = 0; i < s.cellIds.length; i++) {
    const fid = fidArr[i]!;
    if (fid > 0 && deadSet.has(fid)) {
      let arr = cellsByFaction.get(fid);
      if (!arr) { arr = []; cellsByFaction.set(fid, arr); }
      arr.push(s.cellIds[i]!);
    }
  }

  return {
    tick,
    loreDate,
    candidates: factions.map((f) => {
      let wars = 0;
      for (const d of world.mutable.diplomacy.values()) {
        if (d.status === "WAR" && (d.factionAId === f.id || d.factionBId === f.id)) wars++;
      }
      return {
        id: f.id,
        name: f.name,
        treasury: f.treasury,
        cellIds: cellsByFaction.get(f.id) || [],
        wars,
      };
    }),
  };
}

export function projectFactionPlanningSnapshot(
  world: WorldSnapshot,
  tick: number,
  loreDate: string
): FactionPlanningSnapshot {
  const m = world.mutable;
  const s = world.static;
  const factions = Array.from(m.factions.values())
    .sort((a, b) => a.id - b.id)
    .map((f) => ({
      ...(f.extra || {}),
      id: f.id,
      name: f.name,
      culture_id: f.cultureId,
      treasury: f.treasury,
      trait_aggression: f.traitAggression ?? f.extra?.trait_aggression,
      trait_economy: f.traitEconomy ?? f.extra?.trait_economy,
      trait_magic: f.traitMagic ?? f.extra?.trait_magic,
      fiscal_economy: f.fiscalEconomy,
    }));

  const burgs = sortedBurgs(world)
    .filter((b) => cellFactionNullable(world, b.cellId) !== null)
    .map((b) => ({
      burg_id: b.burgId,
      pop_null: b.popNull,
      pop_attuned: b.popAttuned,
      faction_id: cellFactionNullable(world, b.cellId),
      unrest: b.unrest,
      crime_rate: b.crimeRate,
      food: b.food,
      health: b.health,
      military_forces: b.militaryForces,
      wealth: b.wealth,
      port: b.port,
      citadel: b.citadel,
      walls: b.walls,
      plaza: b.plaza,
      temple: b.temple,
      shanty: b.shanty,
      is_capital: b.isCapital,
      cell_id: b.cellId,
    }));

  const units = Array.from(m.factionUnits.values())
    .sort((a, b) => a.id - b.id)
    .map((u) => ({
      ...(u.extra || {}),
      id: u.id,
      faction_id: u.factionId,
      count: u.count,
      status: u.status,
    }));

  const paragons = Array.from(m.paragons.values())
    .filter((p) => p.factionId !== null)
    .sort((a, b) => a.id - b.id)
    .map((p) => ({
      id: p.id,
      burg_id: p.burgId,
      faction_id: p.factionId,
      outlaw_id: p.outlawId,
      domain: p.domain,
      title: p.title,
      name: p.name,
      traits: p.traits,
      corruption_score: p.corruptionScore,
    }));

  const diplomacy: FactionDiplomacySnap[] = Array.from(m.diplomacy.values())
    .sort((a, b) => a.factionAId - b.factionAId || a.factionBId - b.factionBId)
    .map((d) => ({ ...d }));

  const cellTagsByCell: Record<number, string[]> = {};
  for (const [cid, set] of m.cellTags) cellTagsByCell[cid] = Array.from(set);

  return {
    tick,
    loreDate,
    factions,
    burgs,
    units,
    paragons,
    diplomacy,
    borders: s.factionBorders,
    cellTagsByCell,
  };
}

export function projectBurgExpansionSnapshot(
  world: WorldSnapshot,
  tick: number,
  loreDate: string
): BurgExpansionSnapshot {
  if (tick % 10 !== 0) {
    return { tick, loreDate, maxBurgId: 1300, takenNames: [], candidates: [] };
  }
  const s = world.static;
  let maxBurgId = 1300;
  const takenNames: string[] = [];
  const occupiedCellIds = new Set<number>();
  const satCountByParent = new Map<number, number>();
  const allBurgs = sortedBurgs(world);
  for (const b of allBurgs) {
    if (b.burgId > maxBurgId) maxBurgId = b.burgId;
    if (b.name) takenNames.push(b.name);
    if (b.cellId > 0) occupiedCellIds.add(b.cellId);
    if (b.parentBurgId && b.parentBurgId > 0) {
      satCountByParent.set(b.parentBurgId, (satCountByParent.get(b.parentBurgId) || 0) + 1);
    }
  }

  const candidateParents = allBurgs
    .filter(
      (b) =>
        b.popNull + b.popAttuned >= 600 &&
        b.wealth >= 800 &&
        b.food >= 600 &&
        b.unrest <= 35 &&
        (!b.parentBurgId || b.parentBurgId === 0)
    )
    .sort((a, b) => b.wealth - a.wealth || a.burgId - b.burgId)
    .slice(0, 12);

  const candidates: ExpansionParentSnapshot[] = candidateParents.map((b) => {
    const existingSatellites = satCountByParent.get(b.burgId) || 0;
    const fId = cellFactionNullable(world, b.cellId);
    const neighborCandidates: ExpansionCellCandidate[] = [];
    const pt = getCoordStatic(s, b.cellId);
    if (existingSatellites < 3 && pt) {
      const boxIdxs = queryBoxCellIndices(s, pt.x - 200, pt.y - 200, pt.x + 200, pt.y + 200);
      const ranked: Array<{ id: number; biome: number; elevation: number; d2: number }> = [];
      for (const idx of boxIdxs) {
        const cid = s.cellIds[idx]!;
        if (cid === b.cellId || occupiedCellIds.has(cid)) continue;
        const cfid = cellFactionNullable(world, cid);
        if (cfid !== fId && cfid !== null) continue;
        const elev = s.cellElevation[idx]!;
        const biome = s.cellBiome[idx]!;
        if (elev >= 85 || biome === 0 || biome === 11) continue;
        const dx = s.cellCenterX[idx]! - pt.x;
        const dy = s.cellCenterY[idx]! - pt.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 40000) ranked.push({ id: cid, biome, elevation: elev, d2 });
      }
      ranked.sort((x, y) => x.d2 - y.d2 || x.id - y.id);
      for (const nb of ranked.slice(0, 12)) {
        neighborCandidates.push({ id: nb.id, biome: nb.biome, elevation: nb.elevation });
      }
    }
    return {
      burgId: b.burgId,
      name: b.name,
      cellId: b.cellId,
      wealth: b.wealth,
      food: b.food,
      unrest: b.unrest,
      popNull: b.popNull,
      popAttuned: b.popAttuned,
      factionId: fId,
      existingSatellites,
      neighborCandidates,
    };
  });

  return { tick, loreDate, maxBurgId, takenNames, candidates };
}

export function projectCultureReligionSnapshot(
  world: WorldSnapshot,
  tick: number,
  loreDate: string
): CultureReligionSnapshot {
  const s = world.static;
  const m = world.mutable;
  const cursor = ((Math.max(1, tick) * 1973) % 42000) + 1;

  const relMap = new Map(s.religions.map((r) => [r.id, r]));
  const cultRelIdSet = new Set(s.religions.filter((r) => r.type === "Cult").map((r) => r.id));

  const burgByCellId = new Map<number, InMemoryBurg>();
  for (const b of sortedBurgs(world)) {
    if (!burgByCellId.has(b.cellId)) burgByCellId.set(b.cellId, b);
  }

  const templeProtectedCenters: Array<{ cx: number; cy: number }> = [];
  const orthoTemples: Array<{ burgId: number; burgName: string; religionId: number; religionName: string; cx: number; cy: number }> = [];
  for (const b of sortedBurgs(world)) {
    if (!b.temple || (b.popNull <= 0 && b.popAttuned <= 0)) continue;
    const idx = s.cellIndexById.get(b.cellId);
    if (idx === undefined) continue;
    const cx = s.cellCenterX[idx]!;
    const cy = s.cellCenterY[idx]!;
    const rid = m.religionId[idx]!;
    templeProtectedCenters.push({ cx, cy });
    if (rid > 0 && !cultRelIdSet.has(rid)) {
      const rMeta = relMap.get(rid);
      orthoTemples.push({
        burgId: b.burgId,
        burgName: b.name,
        religionId: rid,
        religionName: rMeta?.name || `Faith #${rid}`,
        cx,
        cy,
      });
    }
  }

  const chaosByCellMap = new Map<number, number>();
  for (const z of m.chaosZones.values()) {
    if (z.intensity >= 35) {
      chaosByCellMap.set(z.cellId, Math.max(chaosByCellMap.get(z.cellId) || 0, z.intensity));
    }
  }
  const chaosByCell = Array.from(chaosByCellMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([cellId, intensity]) => ({ cellId, intensity }));

  // Wrap-around scan for culture frontier candidates
  const scanCultRange = (startIdx: number, endIdx: number, need: number): CultureFrontierCandidate[] => {
    const out: CultureFrontierCandidate[] = [];
    for (let i = startIdx; i < endIdx && out.length < need; i++) {
      if (s.cellElevation[i]! < 20) continue;
      const fid = m.factionId[i]!;
      if (fid <= 0) continue;
      const fac = m.factions.get(fid);
      if (!fac || !fac.cultureId || fac.cultureId <= 0) continue;
      const curC = m.cultureId[i]!;
      if (curC === fac.cultureId) continue;
      const cid = s.cellIds[i]!;
      const cx = s.cellCenterX[i]!;
      const cy = s.cellCenterY[i]!;
      const box = queryBoxCellIndices(s, cx - 25, cy - 25, cx + 25, cy + 25);
      const hasNeighbor = box.some(
        (ni) => s.cellIds[ni] !== cid && s.cellElevation[ni]! >= 20 && m.cultureId[ni] === fac.cultureId
      );
      if (hasNeighbor) {
        const b = burgByCellId.get(cid);
        out.push({
          cellId: cid,
          oldCultureId: curC,
          targetCultureId: fac.cultureId,
          factionName: fac.name,
          burgId: b ? b.burgId : null,
          burgName: b ? b.name : null,
        });
      }
    }
    return out;
  };
  let curIdx = 0;
  while (curIdx < s.cellIds.length && s.cellIds[curIdx]! < cursor) curIdx++;
  const cultFrontierRows = scanCultRange(curIdx, s.cellIds.length, 16);
  if (cultFrontierRows.length < 16) {
    cultFrontierRows.push(...scanCultRange(0, curIdx, 16 - cultFrontierRows.length));
  }

  const cleanseRows: TempleCleanseCandidate[] = [];
  if (orthoTemples.length > 0 && cultRelIdSet.size > 0) {
    for (const t of orthoTemples) {
      if (cleanseRows.length >= 6) break;
      const box = queryBoxCellIndices(s, t.cx - 35, t.cy - 35, t.cx + 35, t.cy + 35);
      box.sort((a, b) => s.cellIds[a]! - s.cellIds[b]!);
      for (const ni of box) {
        if (s.cellElevation[ni]! < 20) continue;
        const nRel = m.religionId[ni]!;
        if (!cultRelIdSet.has(nRel)) continue;
        const d2 = (s.cellCenterX[ni]! - t.cx) ** 2 + (s.cellCenterY[ni]! - t.cy) ** 2;
        if (d2 <= 1225) {
          cleanseRows.push({
            burgId: t.burgId,
            burgName: t.burgName,
            orthoReligionId: t.religionId,
            orthoReligionName: t.religionName,
            targetCellId: s.cellIds[ni]!,
            oldReligionId: nRel,
          });
          break;
        }
      }
    }
  }

  const heresyRows: HeresyCandidate[] = [];
  if (cultRelIdSet.size > 0) {
    const scanHeresyRange = (startIdx: number, endIdx: number, need: number): HeresyCandidate[] => {
      const out: HeresyCandidate[] = [];
      for (let i = startIdx; i < endIdx && out.length < need; i++) {
        if (s.cellElevation[i]! < 20) continue;
        const srcCid = s.cellIds[i]!;
        const srcRel = m.religionId[i]!;
        if (!cultRelIdSet.has(srcRel) && !chaosByCellMap.has(srcCid)) continue;
        const sx = s.cellCenterX[i]!;
        const sy = s.cellCenterY[i]!;
        const box = queryBoxCellIndices(s, sx - 25, sy - 25, sx + 25, sy + 25);
        let bestNi = -1;
        let bestD2 = Infinity;
        for (const ni of box) {
          if (s.cellIds[ni] === srcCid || s.cellElevation[ni]! < 20 || cultRelIdSet.has(m.religionId[ni]!)) continue;
          const d2 = (s.cellCenterX[ni]! - sx) ** 2 + (s.cellCenterY[ni]! - sy) ** 2;
          if (d2 < bestD2 || (d2 === bestD2 && bestNi >= 0 && s.cellIds[ni]! < s.cellIds[bestNi]!)) {
            bestD2 = d2;
            bestNi = ni;
          }
        }
        if (bestNi >= 0) {
          const targetCid = s.cellIds[bestNi]!;
          const b = burgByCellId.get(targetCid);
          out.push({
            srcId: srcCid,
            srcReligionId: srcRel,
            targetCellId: targetCid,
            oldReligionId: m.religionId[bestNi]!,
            tx: s.cellCenterX[bestNi]!,
            ty: s.cellCenterY[bestNi]!,
            burgId: b ? b.burgId : null,
            burgName: b ? b.name : null,
          });
        }
      }
      return out;
    };
    heresyRows.push(...scanHeresyRange(curIdx, s.cellIds.length, 16));
    if (heresyRows.length < 16) {
      heresyRows.push(...scanHeresyRange(0, curIdx, 16 - heresyRows.length));
    }
  }

  return {
    tick,
    loreDate,
    cultures: s.cultures,
    religions: s.religions,
    templeProtectedCenters,
    chaosByCell,
    cultFrontierRows,
    cleanseRows,
    heresyRows,
  };
}

function parseProfileObj(raw: unknown): any {
  if (!raw) return {};
  if (typeof raw === "string") {
    try { return JSON.parse(raw) || {}; } catch { return {}; }
  }
  return raw;
}

export function projectTradeSnapshot(world: WorldSnapshot, tick: number, loreDate: string): TradeSnapshot {
  const s = world.static;
  const m = world.mutable;

  const diplomacy: TradeDiplomacySnap[] = [];
  let hasWar = false;
  for (const d of Array.from(m.diplomacy.values()).sort((a, b) => a.factionAId - b.factionAId || a.factionBId - b.factionBId)) {
    if (d.status === "WAR") hasWar = true;
    diplomacy.push({ factionAId: d.factionAId, factionBId: d.factionBId, status: d.status });
  }

  const factionNameMap = new Map<number, string>();
  const factions: TradeFactionSnap[] = Array.from(m.factions.values())
    .sort((a, b) => a.id - b.id)
    .map((f) => {
      factionNameMap.set(f.id, f.name);
      return { id: f.id, name: f.name, fiscalEconomy: f.fiscalEconomy };
    });

  const cellFactionEntries: Array<[number, number]> = [];
  if (hasWar) {
    for (const cid of s.routeGraphCellIds) {
      const idx = s.cellIndexById.get(cid);
      if (idx !== undefined && m.factionId[idx]! > 0) {
        cellFactionEntries.push([cid, m.factionId[idx]!]);
      }
    }
  }

  const blockedCellIds: number[] = [];
  for (const [cid, tags] of m.cellTags) {
    for (const t of tags) {
      if (t.includes("TradeBlockade") || t.includes("CompassBlockaded") || t.includes("CompassEmbargo")) {
        blockedCellIds.push(cid);
        break;
      }
    }
  }
  blockedCellIds.sort((a, b) => a - b);

  const lairs: TradeLairSnap[] = Array.from(m.lairs.values())
    .filter((l) => l.manpower > 0)
    .sort((a, b) => a.id - b.id)
    .map((l) => ({
      id: l.id,
      factionId: l.factionId,
      cellId: l.cellId,
      burgId: l.burgId || 0,
      lairType: l.lairType,
      manpower: l.manpower,
      heat: l.heat,
      syndicateName: m.outlaws.get(l.factionId)?.name || "Underworld Syndicate",
      inventory: { ...l.inventory },
    }));

  const candidateSurplusBurgSet = new Set<number>();
  const burgs: TradeBurgSnap[] = sortedBurgs(world)
    .filter((b) => b.popNull > 0 || b.popAttuned > 0)
    .map((b) => {
      const idx = s.cellIndexById.get(b.cellId);
      const cellFid = idx !== undefined ? m.factionId[idx]! : 0;
      const effFid = b.occupierFactionId || cellFid || 0;
      const marketId = idx !== undefined ? s.cellMarketId[idx]! : 0;
      const inv = { ...(m.stockpiles.get(b.burgId) || {}) };
      for (const q of Object.values(inv)) {
        if ((Number(q) || 0) >= 16) {
          candidateSurplusBurgSet.add(b.burgId);
          break;
        }
      }
      return {
        burgId: b.burgId,
        name: b.name,
        cellId: b.cellId,
        factionId: effFid,
        factionName: factionNameMap.get(effFid) || "Independent",
        marketId,
        wealth: b.wealth,
        food: b.food,
        urbanTier: b.urbanTier,
        unrest: b.unrest,
        port: b.port,
        inventory: inv,
        profile: parseProfileObj(b.resourceProfile),
      };
    });

  const allTransitCrewSet = new Set<number>();
  const inTransitShipments: TradeShipmentSnap[] = Array.from(m.tradeShipments.values())
    .filter((sh) => sh.status === "IN_TRANSIT")
    .sort((a, b) => a.id - b.id)
    .map((sh) => {
      candidateSurplusBurgSet.add(sh.sourceBurgId);
      candidateSurplusBurgSet.add(sh.destBurgId);
      const crewIds: number[] = [];
      if (sh.merchantCitizenId > 0) {
        crewIds.push(sh.merchantCitizenId);
        allTransitCrewSet.add(sh.merchantCitizenId);
      }
      for (const cid of sh.crewCitizenIds) {
        if (cid > 0) {
          crewIds.push(cid);
          allTransitCrewSet.add(cid);
        }
      }
      if (hasWar && sh.transportMode === "AIR") {
        for (const cid of sh.pathCells) {
          if (!s.routeGraphCellIds.has(cid)) {
            const idx = s.cellIndexById.get(cid);
            if (idx !== undefined && m.factionId[idx]! > 0) {
              cellFactionEntries.push([cid, m.factionId[idx]!]);
            }
          }
        }
      }
      return {
        id: sh.id,
        sourceBurgId: sh.sourceBurgId,
        destBurgId: sh.destBurgId,
        sourceFactionId: sh.sourceFactionId,
        destFactionId: sh.destFactionId,
        transportMode: sh.transportMode,
        goodId: sh.goodId,
        goodKey: sh.goodKey,
        goodName: sh.goodName,
        quantity: sh.quantity,
        totalGold: sh.totalGold,
        tariffGold: sh.tariffGold,
        guardCount: sh.guardCount,
        pathCells: [...sh.pathCells],
        pathIndex: sh.pathIndex,
        currentCellId: sh.currentCellId,
        etaTicks: sh.etaTicks,
        crewIds,
      };
    });

  const inTransitCrewMeta: TradeInTransitCrewSnap[] = [];
  for (const cid of Array.from(allTransitCrewSet).sort((a, b) => a - b)) {
    const c = m.citizens.get(cid);
    if (c) {
      inTransitCrewMeta.push({
        citizenId: c.citizenId,
        settlementId: c.settlementId,
        profession: c.profession,
        lifeStage: c.lifeStage,
        allegianceStatus: c.allegianceStatus,
      });
    }
  }

  const logisticsProfs = new Set([
    "Merchant Factor",
    "Merchant Trader",
    "Caravan Drover",
    "Caravan Guard",
    "Sailor",
    "Aether-Crew",
  ]);
  const livingCrew: TradeLivingCrewSnap[] = [];
  if (candidateSurplusBurgSet.size > 0) {
    const bucket = new Map<string, InMemoryCitizen[]>();
    for (const c of m.citizens.values()) {
      if (
        candidateSurplusBurgSet.has(c.settlementId) &&
        c.allegianceStatus === "CIVILIAN" &&
        c.lifeStage === "ADULT" &&
        logisticsProfs.has(c.profession)
      ) {
        const k = `${c.settlementId}\0${c.profession}`;
        let arr = bucket.get(k);
        if (!arr) { arr = []; bucket.set(k, arr); }
        arr.push(c);
      }
    }
    for (const arr of bucket.values()) {
      arr.sort((a, b) => a.citizenId - b.citizenId);
      for (const c of arr.slice(0, 8)) {
        livingCrew.push({ citizenId: c.citizenId, settlementId: c.settlementId, profession: c.profession });
      }
    }
    livingCrew.sort(
      (a, b) =>
        a.settlementId - b.settlementId ||
        (a.profession === "Merchant Factor" ? 0 : 1) - (b.profession === "Merchant Factor" ? 0 : 1) ||
        a.citizenId - b.citizenId
    );
  }

  return {
    tick,
    loreDate,
    diplomacy,
    factions,
    cellFactionEntries,
    blockedCellIds,
    lairs,
    goods: s.goods.map((g) => ({
      id: g.id,
      name: g.name,
      key: g.key,
      value: g.value,
      carriage: g.carriage,
      recipes: g.recipes,
    })),
    markets: Array.from(m.markets.values())
      .sort((a, b) => a.id - b.id)
      .map((mk) => ({ id: mk.id, centerBurgId: mk.centerBurgId, goods: JSON.parse(JSON.stringify(mk.goods)) })),
    burgs,
    inTransitShipments,
    inTransitCrewMeta,
    livingCrew,
    cohortCrewCounts: m.cohortCrewCounts.filter((c) => candidateSurplusBurgSet.has(c.burgId)),
    tradeDeals: s.tradeDeals,
  };
}

export function projectMarketSnapshot(world: WorldSnapshot, tick: number): MarketSnapshot {
  if (tick % DAYS_PER_WEEK !== 0) {
    return { tick, due: false, goods: [], burgs: [], markets: [], prices: [] };
  }
  const s = world.static;
  const m = world.mutable;
  const burgs: MarketBurgStock[] = sortedBurgs(world).map((b) => {
    const idx = s.cellIndexById.get(b.cellId);
    return {
      burgId: b.burgId,
      marketId: idx !== undefined ? s.cellMarketId[idx]! : 0,
      food: b.food,
      complexInventory: { ...(m.stockpiles.get(b.burgId) || {}) },
    };
  });
  return {
    tick,
    due: true,
    goods: s.goods.map((g) => ({ id: g.id, key: goodKeyFromName(g.name) || g.key, value: g.value })),
    markets: Array.from(m.markets.values())
      .sort((a, b) => a.id - b.id)
      .map((mk) => ({ id: mk.id, centerBurgId: mk.centerBurgId, goods: JSON.parse(JSON.stringify(mk.goods)) })),
    burgs,
    prices: Array.from(m.commodityPrices.values())
      .sort((a, b) => a.commodity.localeCompare(b.commodity))
      .map((p) => ({ basePrice: p.basePrice, commodity: p.commodity, currentPrice: p.currentPrice, globalDemand: p.globalDemand })),
  };
}

export function projectWardenAwakeningSnapshot(
  world: WorldSnapshot,
  tick: number,
  loreDate: string,
  triggered: boolean,
  random: () => number
): WardenAwakeningSnapshot {
  const m = world.mutable;
  const s = world.static;
  let shouldRecharge = false;
  for (const w of m.ancientWards.values()) {
    if (!w.isCharged && tick - w.lastTriggeredTick >= w.rechargeTicks) {
      shouldRecharge = true;
      break;
    }
  }
  if (!triggered) return { tick, loreDate, shouldRecharge, ward: null, dbCitizen: null };

  const chargedWards = Array.from(m.ancientWards.values()).filter((w) => w.isCharged);
  if (chargedWards.length === 0) {
    return { tick, loreDate, shouldRecharge, ward: null, dbCitizen: null };
  }
  const saltW = Math.floor(random() * 2147483647);
  chargedWards.sort((a, b) => sqlShuffleRank(a.id, saltW) - sqlShuffleRank(b.id, saltW));
  const wr = chargedWards[0]!;
  const ward: WardenAwakeningWard = { id: wr.id, cellId: wr.cellId, flowId: wr.flowId, pathName: wr.pathName };

  const sparkOrder = (st: string) => (st === "ADEPT" ? 1 : st === "CHANNELER" ? 2 : 3);
  const wPt = getCoordStatic(s, ward.cellId);
  const nearestBurgs = new Set(
    sortedBurgs(world)
      .map((b) => {
        const bp = getCoordStatic(s, b.cellId);
        const d2 = wPt && bp ? (bp.x - wPt.x) ** 2 + (bp.y - wPt.y) ** 2 : Infinity;
        return { id: b.burgId, d2 };
      })
      .sort((a, b) => a.d2 - b.d2)
      .slice(0, 10)
      .map((x) => x.id)
  );
  const elig = Array.from(m.citizens.values()).filter(
    (c) =>
      c.allegianceStatus === "CIVILIAN" &&
      ["CHANNELER", "ADEPT", "SENSITIVE", "DORMANT_SPARK"].includes(c.sparkTier)
  );
  const saltC = Math.floor(random() * 2147483647);
  let near = elig.filter((c) => nearestBurgs.has(c.settlementId));
  near.sort((a, b) => sparkOrder(a.sparkTier) - sparkOrder(b.sparkTier) || sqlShuffleRank(a.citizenId, saltC) - sqlShuffleRank(b.citizenId, saltC));
  let pick = near[0] || null;
  if (!pick && elig.length > 0) {
    const saltG = Math.floor(random() * 2147483647);
    const sortedG = [...elig].sort((a, b) => sqlShuffleRank(a.citizenId, saltG) - sqlShuffleRank(b.citizenId, saltG));
    pick = sortedG[0]!;
  }
  if (!pick) {
    const cohBurgs = sortedBurgs(world)
      .filter((b) => Array.from(m.cohorts.values()).some((c) => c.burgId === b.burgId && !c.isNull && c.ageBand === "ADULT" && c.allegiance === "CIVILIAN" && c.count > 0))
      .map((b) => {
        const bp = getCoordStatic(s, b.cellId);
        return { bid: b.burgId, d2: wPt && bp ? (bp.x - wPt.x) ** 2 + (bp.y - wPt.y) ** 2 : Infinity };
      })
      .sort((a, b) => a.d2 - b.d2 || a.bid - b.bid);
    if (cohBurgs.length > 0) {
      const cid = promoteFromCohortInMemory(world, {
        burgId: cohBurgs[0]!.bid,
        filter: { ageBand: "ADULT", allegiance: "CIVILIAN", isNull: false },
        slotKey: `warden:${tick}:${ward.id}`,
      });
      if (cid) pick = m.citizens.get(cid) || null;
    }
  }

  const dbCitizen: WardenAwakeningCitizen | null = pick
    ? {
        id: pick.citizenId,
        name: pick.name,
        profession: pick.profession,
        species: pick.species,
        sparkTier: pick.sparkTier,
        temper: pick.temper,
        instinct: pick.instinct,
        motivation: pick.motivation,
      }
    : null;

  return { tick, loreDate, shouldRecharge, ward, dbCitizen };
}

export function projectWardensSnapshot(world: WorldSnapshot, tick: number, loreDate: string): WardensSnapshot {
  const s = world.static;
  const m = world.mutable;
  const wardens: WardenAgentSnapshot[] = [];
  const cultists: CultistTargetSnap[] = [];
  const hermits: HermitAgentSnapshot[] = [];

  for (const a of Array.from(m.agents.values()).sort((x, y) => x.id - y.id)) {
    if (a.role === "Warden") {
      wardens.push({
        id: a.id,
        name: a.name,
        citizenName: a.citizenName,
        profession: a.profession,
        temper: a.personalityTemper,
        sparkTier: a.sparkTier,
        subRole: a.subRole,
        locationCellId: a.locationCellId,
        targetCellId: a.targetCellId,
        targetGroveId: a.targetGroveId,
        state: a.state || "PATROLLING_FLOW",
        corruption: a.corruption,
        ageTicks: a.ageTicks,
      });
    } else if (a.role === "Cultist") {
      const pt = getCoordStatic(s, a.locationCellId) || { x: 0, y: 0 };
      cultists.push({
        id: a.id,
        name: a.name,
        role: "Cultist",
        subRole: a.subRole,
        locationCellId: a.locationCellId,
        cellId: a.locationCellId,
        state: a.state || "INFILTRATING",
        targetGroveId: a.targetGroveId,
        x: pt.x,
        y: pt.y,
      });
    } else if (a.role === "Mad_Hermit") {
      hermits.push({
        id: a.id,
        name: a.name,
        locationCellId: a.locationCellId,
        ageTicks: a.ageTicks,
      });
    }
  }

  const groves = Array.from(m.groves.values())
    .sort((a, b) => a.id - b.id)
    .map((g) => {
      const pt = getCoordStatic(s, g.cellId) || { x: 0, y: 0 };
      return { id: g.id, cellId: g.cellId, dragonName: g.dragonName, powerDomain: g.powerDomain, sealStrength: g.sealStrength, x: pt.x, y: pt.y };
    });

  const flowWaypoints: Record<number, number[]> = {};
  for (const w of Array.from(m.ancientWards.values()).sort((a, b) => (a.flowId || 0) - (b.flowId || 0) || a.cellId - b.cellId)) {
    if (w.flowId !== null) {
      if (!flowWaypoints[w.flowId]) flowWaypoints[w.flowId] = [];
      flowWaypoints[w.flowId]!.push(w.cellId);
    }
  }

  const hermitCandidatesByMod: Record<number, number[]> = {};
  if (hermits.length > 0) {
    const neededMods = new Set(hermits.map((h) => h.locationCellId % 50));
    for (const cid of s.cellIds) {
      const mod = cid % 50;
      if (neededMods.has(mod)) {
        if (!hermitCandidatesByMod[mod]) hermitCandidatesByMod[mod] = [];
        hermitCandidatesByMod[mod]!.push(cid);
      }
    }
  }

  return {
    tick,
    loreDate,
    wardens,
    cultists,
    groves,
    flowWaypoints,
    hermits,
    hermitCandidatesByMod,
    cellCoords: {},
    getCoord: (cid) => getCoordStatic(s, cid),
    findNearestCell: (x, y) => findNearestCellStatic(s, x, y),
  };
}

export function projectCultistRecruitSnapshot(
  world: WorldSnapshot,
  tick: number,
  loreDate: string,
  random: () => number
): CultistRecruitSnapshot {
  const m = world.mutable;
  let total = 0;
  let inf = 0;
  const infByBurg = new Map<number, number>();
  for (const a of m.agents.values()) {
    if (a.role === "Cultist") {
      total++;
      if (a.state === "INFILTRATING") {
        inf++;
        if (a.homeBurgId) infByBurg.set(a.homeBurgId, (infByBurg.get(a.homeBurgId) || 0) + 1);
      }
    }
  }
  if (inf >= 144 || total >= 288) return { tick, loreDate, candidates: [] };

  const batch = Math.min(10, 144 - inf);
  const saltB = Math.floor(random() * 2147483647);
  const burgs = sortedBurgs(world)
    .filter((b) => b.unrest >= 15)
    .sort((a, b) => b.unrest - a.unrest || sqlShuffleRank(a.burgId, saltB) - sqlShuffleRank(b.burgId, saltB))
    .slice(0, batch * 2);

  const temperRank = (t: string) => (t === "FANATICAL" ? 1 : t === "DESPERATE" ? 2 : t === "GREEDY" ? 3 : 4);
  const candidates: CultistRecruitCandidate[] = [];
  for (const b of burgs) {
    if ((infByBurg.get(b.burgId) || 0) >= 3) continue;
    const saltC = Math.floor(random() * 2147483647);
    const poolC = Array.from(m.citizens.values())
      .filter((c) => c.settlementId === b.burgId && c.allegianceStatus === "CIVILIAN")
      .sort((a, c2) => temperRank(a.temper) - temperRank(c2.temper) || sqlShuffleRank(a.citizenId, saltC) - sqlShuffleRank(c2.citizenId, saltC));
    let cit = poolC[0] || null;
    if (!cit) {
      const cid = promoteFromCohortInMemory(world, {
        burgId: b.burgId,
        filter: { ageBand: "ADULT", allegiance: "CIVILIAN" },
        slotKey: `cultist:${tick}:${b.burgId}`,
      });
      if (cid) cit = m.citizens.get(cid) || null;
    }
    const citizen: CultistRecruitCitizen | null = cit
      ? {
          dbCitizenId: cit.citizenId,
          citizenName: cit.name,
          profession: cit.profession,
          species: cit.species,
          sparkTier: cit.sparkTier || "DORMANT_SPARK",
          temper: cit.temper || "DESPERATE",
          instinct: cit.instinct || "WARY",
          motivation: cit.motivation || "",
        }
      : null;
    candidates.push({
      burgId: b.burgId,
      cellId: b.cellId,
      wealth: b.wealth,
      unrest: b.unrest,
      burgName: b.name,
      citizen,
    });
  }
  return { tick, loreDate, candidates };
}

export function projectCultistsSnapshot(
  world: WorldSnapshot,
  tick: number,
  loreDate: string,
  random: () => number
): CultistsSnapshot {
  const s = world.static;
  const m = world.mutable;
  const isShadowWeek = dateForTick(tick).isShadowfall;
  const repairSalt = Math.floor(random() * 2147483647);

  const groves: CultistGroveSnapshot[] = Array.from(m.groves.values())
    .sort((a, b) => a.id - b.id)
    .map((g) => {
      const pt = getCoordStatic(s, g.cellId) || { x: 0, y: 0 };
      return {
        id: g.id,
        cellId: g.cellId,
        dragonName: g.dragonName,
        powerDomain: g.powerDomain,
        sealStrength: g.sealStrength,
        x: pt.x,
        y: pt.y,
        repairRoll: !isShadowWeek ? sqlChanceEval(g.id, 0.15, repairSalt) : false,
      };
    });

  const cultists: CultistAgentSnapshot[] = [];
  const wardens: OpposingAgentSnap[] = [];
  for (const a of Array.from(m.agents.values()).sort((x, y) => x.id - y.id)) {
    if (a.role === "Cultist") {
      cultists.push({
        id: a.id,
        name: a.name,
        citizenName: a.citizenName,
        profession: a.profession,
        temper: a.personalityTemper,
        subRole: a.subRole,
        homeBurgId: a.homeBurgId,
        locationCellId: a.locationCellId,
        targetCellId: a.targetCellId,
        targetGroveId: a.targetGroveId,
        state: a.state || "INFILTRATING",
        corruption: a.corruption,
        ageTicks: a.ageTicks,
      });
    } else if (a.role === "Warden") {
      wardens.push({
        id: a.id,
        name: a.name,
        role: "Warden",
        subRole: a.subRole,
        locationCellId: a.locationCellId,
      });
    }
  }

  const minSeal = groves.reduce((min, g) => Math.min(min, g.sealStrength), 100);
  const apocalypseLoggedMessages =
    minSeal <= 20 ? m.events.filter((e) => e.type === "WORLD_ENDING_APOCALYPSE").map((e) => e.message) : [];
  const allBurgIds = minSeal <= 20 ? sortedBurgs(world).map((b) => b.burgId) : [];

  return {
    tick,
    loreDate,
    isShadowWeek,
    groves,
    cultists,
    wardens,
    cellCoords: {},
    getCoord: (cid) => getCoordStatic(s, cid),
    findNearestCell: (x, y) => findNearestCellStatic(s, x, y),
    apocalypseLoggedMessages,
    allBurgIds,
  };
}

export function projectMandateCandidates(world: WorldSnapshot): {
  burgs: MandateUnrestBurg[];
  existingWarbandBurgIds: Set<number>;
} {
  const existingWarbandBurgIds = new Set<number>();
  for (const a of world.mutable.agents.values()) {
    if (a.role === "Chain_Zealot" && a.homeBurgId) existingWarbandBurgIds.add(a.homeBurgId);
  }
  const burgs: MandateUnrestBurg[] = sortedBurgs(world)
    .filter((b) => b.unrest >= 28 && b.popNull >= 100)
    .sort((a, b) => b.unrest - a.unrest || a.burgId - b.burgId)
    .map((b) => ({
      burgId: b.burgId,
      cellId: b.cellId,
      unrest: b.unrest,
      name: b.name,
      popNull: b.popNull,
      hasWarband: existingWarbandBurgIds.has(b.burgId),
    }));
  return { burgs, existingWarbandBurgIds };
}

export function resolveMandateRecruitsInMemory(
  world: WorldSnapshot,
  tick: number,
  chosenBurgs: MandateUnrestBurg[],
  random: () => number
): MandateRecruitEntry[] {
  const temperRank = (t: string) => (t === "VENGEFUL" ? 1 : t === "BITTER" ? 2 : t === "FANATICAL" ? 3 : 4);
  const out: MandateRecruitEntry[] = [];
  for (const b of chosenBurgs) {
    const salt = Math.floor(random() * 2147483647);
    const cands = Array.from(world.mutable.citizens.values())
      .filter((c) => c.settlementId === b.burgId && c.isNull && c.allegianceStatus === "CIVILIAN")
      .sort((a, c2) => temperRank(a.temper) - temperRank(c2.temper) || sqlShuffleRank(a.citizenId, salt) - sqlShuffleRank(c2.citizenId, salt));
    let cit = cands[0] || null;
    if (!cit) {
      const cid = promoteFromCohortInMemory(world, {
        burgId: b.burgId,
        filter: { ageBand: "ADULT", allegiance: "CIVILIAN", isNull: true },
        slotKey: `mandate:${tick}:${b.burgId}`,
      });
      if (cid) cit = world.mutable.citizens.get(cid) || null;
    }
    const citizen: MandateRecruitCitizen | null = cit
      ? {
          dbCitizenId: cit.citizenId,
          citizenName: cit.name,
          profession: cit.profession,
          species: cit.species,
          sparkTier: cit.sparkTier || "NULL",
          temper: cit.temper || "VENGEFUL",
          instinct: cit.instinct || "WARY",
          motivation: cit.motivation || "",
        }
      : null;
    out.push({ burg: b, citizen });
  }
  return out;
}

export function projectMandateWarbandsSnapshot(
  world: WorldSnapshot,
  tick: number,
  loreDate: string
): MandateWarbandsSnapshot {
  const s = world.static;
  const m = world.mutable;
  const warbands: MandateWarbandSnapshot[] = Array.from(m.agents.values())
    .filter((a) => a.role === "Chain_Zealot")
    .sort((a, b) => a.id - b.id)
    .map((wb) => ({
      id: wb.id,
      name: wb.name,
      citizenName: wb.citizenName,
      profession: wb.profession,
      temper: wb.personalityTemper,
      subRole: wb.subRole,
      homeBurgId: wb.homeBurgId,
      locationCellId: wb.locationCellId,
      targetCellId: wb.targetCellId,
      targetGroveId: wb.targetGroveId,
      state: wb.state || "WITCH_HUNTING",
      drainedPower: wb.drainedPower,
      ageTicks: wb.ageTicks,
    }));

  if (warbands.length === 0) {
    return { tick, loreDate, warbands: [], groves: [], homeCellByBurg: {}, cellCoords: {} };
  }

  const groves = Array.from(m.groves.values())
    .sort((a, b) => a.id - b.id)
    .map((g) => {
      const pt = getCoordStatic(s, g.cellId) || { x: 0, y: 0 };
      return { id: g.id, cellId: g.cellId, dragonName: g.dragonName, powerDomain: g.powerDomain, sealStrength: g.sealStrength, x: pt.x, y: pt.y };
    });

  const homeCellByBurg: Record<number, number> = {};
  for (const w of warbands) {
    if (w.homeBurgId && m.burgs.has(w.homeBurgId)) {
      homeCellByBurg[w.homeBurgId] = m.burgs.get(w.homeBurgId)!.cellId;
    }
  }

  return {
    tick,
    loreDate,
    warbands,
    groves,
    homeCellByBurg,
    cellCoords: {},
    getCoord: (cid) => getCoordStatic(s, cid),
    findNearestCell: (x, y) => findNearestCellStatic(s, x, y),
  };
}

export function projectCartelsSnapshot(
  world: WorldSnapshot,
  tick: number,
  loreDate: string,
  random: () => number
): CartelsSnapshot {
  const s = world.static;
  const m = world.mutable;
  const dayOfYear = dateForTick(tick).dayOfYear;

  const cartels: CartelRowSnap[] = Array.from(m.outlaws.values())
    .sort((a, b) => a.id - b.id)
    .map((o) => ({ ...o }));

  const saltB = Math.floor(random() * 2147483647);
  const allBurgs = sortedBurgs(world);
  const targetBurgs: CartelBurgSnap[] = [...allBurgs]
    .sort((a, b) => sqlShuffleRank(a.burgId, saltB) - sqlShuffleRank(b.burgId, saltB))
    .slice(0, 60)
    .map((b) => ({
      burgId: b.burgId,
      cellId: b.cellId,
      name: b.name,
      unrest: b.unrest,
      popNull: b.popNull,
      popAttuned: b.popAttuned,
      wealth: b.wealth,
      health: b.health,
      food: b.food,
      rawMaterials: b.rawMaterials,
      refinedGoods: b.refinedGoods,
      factionId: cellFactionNullable(world, b.cellId),
    }));

  const burgById = m.burgs;
  const lairs: CartelLairSnap[] = Array.from(m.lairs.values())
    .sort((a, b) => a.id - b.id)
    .map((l) => {
      const b = l.burgId ? burgById.get(l.burgId) : undefined;
      const o = m.outlaws.get(l.factionId);
      return {
        id: l.id,
        factionId: l.factionId,
        cellId: l.cellId,
        burgId: l.burgId,
        lairType: l.lairType,
        manpower: l.manpower,
        heat: l.heat,
        burgName: b ? b.name : null,
        militaryForces: b ? b.militaryForces : null,
        cartelName: o ? o.name : null,
      };
    });

  const commandersByBurg: Record<number, CommanderSnap> = {};
  for (const p of Array.from(m.paragons.values()).sort((a, b) => a.id - b.id)) {
    if (p.burgId !== null && p.title.includes("Commander") && !commandersByBurg[p.burgId]) {
      commandersByBurg[p.burgId] = { traits: p.traits, corruptionScore: p.corruptionScore };
    }
  }

  const activeCanyons: CartelCanyonSnap[] = Array.from(m.grindCanyons.values())
    .filter((c) => c.status === "OPEN" || c.status === "COLLAPSING")
    .sort((a, b) => a.id - b.id)
    .map((c) => {
      const cp = getCoordStatic(s, c.cellId);
      let nearest: InMemoryBurg | null = null;
      let bestD2 = Infinity;
      for (const b of allBurgs) {
        const bp = getCoordStatic(s, b.cellId);
        const d2 = cp && bp ? (bp.x - cp.x) ** 2 + (bp.y - cp.y) ** 2 : Infinity;
        if (d2 < bestD2 || (d2 === bestD2 && nearest && b.burgId < nearest.burgId)) {
          bestD2 = d2;
          nearest = b;
        }
      }
      return {
        id: c.id,
        name: c.name,
        cellId: c.cellId,
        nearestBurgId: nearest ? nearest.burgId : null,
        nearestBurgName: nearest ? nearest.name : null,
      };
    });

  const pendingGhostwindDrops: GhostwindDropSnap[] = Array.from(m.ghostwindDrops.values())
    .filter((d) => d.status === "PENDING")
    .sort((a, b) => a.id - b.id)
    .map((d) => {
      const cf = m.factions.get(d.clientFactionId);
      const tf = m.factions.get(d.targetFactionId);
      const tb = burgById.get(d.targetBurgId);
      return {
        id: d.id,
        createdTick: d.createdTick,
        clientFactionId: d.clientFactionId,
        targetFactionId: d.targetFactionId,
        targetBurgId: d.targetBurgId,
        bountyGold: d.bountyGold,
        clientName: cf?.name || "",
        targetName: tf?.name || "",
        targetBurgName: tb?.name || "",
        targetBurgWealth: tb?.wealth || 0,
        targetBurgFood: tb?.food || 0,
      };
    });

  let lastGhostwindStrikeTick = 0;
  let outerBurgs: OuterBurgSnap[] = [];
  const capitalBurgByFaction: Record<number, number> = {};
  if (pendingGhostwindDrops.length > 0) {
    for (const d of m.ghostwindDrops.values()) {
      if (d.status === "EXECUTED" && (d.executedTick || 0) > lastGhostwindStrikeTick) {
        lastGhostwindStrikeTick = d.executedTick || 0;
      }
    }
    outerBurgs = allBurgs
      .filter((b) => !b.isCapital)
      .sort((a, b) => a.wealth - b.wealth || a.burgId - b.burgId)
      .slice(0, 3)
      .map((b) => ({ burgId: b.burgId, name: b.name }));
    const clientFids = new Set(pendingGhostwindDrops.map((d) => d.clientFactionId));
    for (const b of allBurgs) {
      const cfid = cellFactionNullable(world, b.cellId);
      if (cfid && clientFids.has(cfid) && b.isCapital && capitalBurgByFaction[cfid] === undefined) {
        capitalBurgByFaction[cfid] = b.burgId;
      }
    }
  }

  let topPowers: FactionTreasurySnap[] = [];
  const richestBurgByFaction: Record<number, { burgId: number; name: string }> = {};
  if (dayOfYear === 48 || dayOfYear === 313) {
    topPowers = Array.from(m.factions.values())
      .filter((f) => f.id !== 1 && f.id !== 21 && f.treasury >= 250)
      .sort((a, b) => b.treasury - a.treasury || a.id - b.id)
      .slice(0, 4)
      .map((f) => ({ id: f.id, name: f.name, treasury: f.treasury }));
    if (topPowers.length >= 4) {
      const ids = new Set(topPowers.map((p) => p.id));
      const bestByFac = [...allBurgs].sort((a, b) => b.wealth - a.wealth || a.burgId - b.burgId);
      for (const b of bestByFac) {
        const cfid = cellFactionNullable(world, b.cellId);
        if (cfid && ids.has(cfid) && b.wealth >= 60 && !richestBurgByFaction[cfid]) {
          richestBurgByFaction[cfid] = { burgId: b.burgId, name: b.name };
        }
      }
    }
  }

  const hireableFactions: FactionTreasurySnap[] =
    tick % 4 === 0
      ? Array.from(m.factions.values())
          .filter((f) => f.id > 0 && f.treasury >= 2000)
          .sort((a, b) => a.id - b.id)
          .map((f) => ({ id: f.id, name: f.name, treasury: f.treasury }))
      : [];

  const mountainBurgs: MountainBurgSnap[] =
    tick % 3 === 0 || tick % 4 === 1
      ? allBurgs
          .filter((b) => {
            const idx = s.cellIndexById.get(b.cellId);
            return idx !== undefined && s.cellElevation[idx]! >= 55;
          })
          .map((b) => ({
            burgId: b.burgId,
            name: b.name,
            cellId: b.cellId,
            elevation: s.cellElevation[s.cellIndexById.get(b.cellId)!]!,
          }))
      : [];

  let circusCandidates: CircusStopSnap[] = [];
  if (tick % 45 === 15) {
    const facs = Array.from(m.factions.values()).filter((f) => f.id > 0).sort((a, b) => a.id - b.id);
    for (const f of facs) {
      for (const b of allBurgs) {
        if (b.wealth > 100 && cellFactionNullable(world, b.cellId) === f.id) {
          circusCandidates.push({
            factionId: f.id,
            factionName: f.name,
            burgId: b.burgId,
            burgName: b.name,
            cellId: b.cellId,
          });
        }
      }
    }
  }

  const crackdownCrowns: FactionTreasurySnap[] =
    tick % 20 === 0
      ? Array.from(m.factions.values())
          .filter((f) => f.id > 0 && f.treasury >= 1000)
          .sort((a, b) => a.id - b.id)
          .map((f) => ({ id: f.id, name: f.name, treasury: f.treasury }))
      : [];

  let ghostspringOriginBurgId: number | null = null;
  const gs = cartels.find((c) => c.id === 8 || c.name.includes("Ghostspring"));
  if (gs && !lairs.some((l) => l.factionId === gs.id)) {
    const peakCell = gs.originCellId || 30627;
    const match = allBurgs.find((b) => b.cellId === peakCell);
    ghostspringOriginBurgId = match ? match.burgId : 1;
  }

  return {
    tick,
    loreDate,
    dayOfYear,
    cartels,
    targetBurgs,
    lairs,
    commandersByBurg,
    activeCanyons,
    pendingGhostwindDrops,
    lastGhostwindStrikeTick,
    topPowers,
    richestBurgByFaction,
    outerBurgs,
    capitalBurgByFaction,
    hireableFactions,
    mountainBurgs,
    circusCandidates,
    crackdownCrowns,
    ghostspringOriginBurgId,
  };
}

export function projectGrindCanyonSnapshot(
  world: WorldSnapshot,
  tick: number,
  loreDate: string
): GrindCanyonSnapshot {
  const s = world.static;
  const m = world.mutable;
  const burgByCell = new Map<number, InMemoryBurg>();
  for (const b of sortedBurgs(world)) {
    if (!burgByCell.has(b.cellId)) burgByCell.set(b.cellId, b);
  }
  const hasCorpoOutlaw = m.outlaws.has(9);
  const activeCanyons: GrindCanyonRowSnapshot[] = Array.from(m.grindCanyons.values())
    .filter((c) => c.status === "OPEN" || c.status === "COLLAPSING")
    .sort((a, b) => a.id - b.id)
    .map((c) => ({
      id: c.id,
      name: c.name,
      cellId: c.cellId,
      dragonName: c.dragonName,
      dragonDomain: c.dragonDomain,
      dragonstoneRichness: c.dragonstoneRichness,
      stabilityTicksRemaining: c.stabilityTicksRemaining,
      status: c.status === "COLLAPSING" ? "COLLAPSING" : "OPEN",
      minerCrewName: c.minerCrewName,
      localBurgId: burgByCell.get(c.cellId)?.burgId ?? null,
    }));

  const wildCells: GrindWildCell[] = [];
  const burgs: GrindBurgCoord[] = [];
  if (activeCanyons.filter((c) => c.status === "OPEN").length < 3) {
    for (let i = 0; i < s.cellIds.length; i++) {
      const cid = s.cellIds[i]!;
      const b = burgByCell.get(cid);
      if (b) {
        burgs.push({
          burgId: b.burgId,
          name: b.name,
          cellId: cid,
          x: s.cellCenterX[i]!,
          y: s.cellCenterY[i]!,
        });
      } else if (s.cellElevation[i]! >= 40) {
        wildCells.push({
          id: cid,
          x: s.cellCenterX[i]!,
          y: s.cellCenterY[i]!,
        });
      }
    }
    burgs.sort((a, b) => a.burgId - b.burgId);
  }
  return { tick, loreDate, activeCanyons, hasCorpoOutlaw, wildCells, burgs };
}

export function projectEncounterSnapshot(world: WorldSnapshot): EncounterSnapshot {
  const agents = Array.from(world.mutable.agents.values())
    .filter((a) => a.role === "Beasts" || a.role === "Criminal")
    .sort((a, b) => a.id - b.id)
    .map((a) => ({ id: a.id, location_cell_id: a.locationCellId }));
  return {
    agents,
    cellIds: agents.length > 0 ? world.static.cellIds : [],
  };
}

export function projectNpcRoutinesSnapshot(
  world: WorldSnapshot,
  tick: number,
  loreDate: string,
  random: () => number
): NpcRoutinesSnapshot {
  const m = world.mutable;
  const s = world.static;
  const burgByCell = new Map<number, InMemoryBurg>();
  for (const b of sortedBurgs(world)) {
    if (!burgByCell.has(b.cellId)) burgByCell.set(b.cellId, b);
  }

  const allNpcs = Array.from(m.npcInstances.values()).sort((a, b) => a.id.localeCompare(b.id));
  const livingNpcs: LivingNpcRoutineSnapshot[] = allNpcs
    .filter((n) => n.alive)
    .slice(0, 200)
    .map((n) => {
      const b = burgByCell.get(n.cellId);
      return {
        id: n.id,
        cellId: n.cellId,
        role: n.role,
        instinct: n.instinct as any,
        temper: n.temper as any,
        needs: n.needs,
        mood: n.mood,
        beliefs: n.beliefs,
        socialLinks: n.socialLinks,
        scheduleState: n.scheduleState as any,
        burgFood: b?.food || 300,
        burgWealth: b?.wealth || 500,
        burgUnrest: b?.unrest || 10,
        burgCrime: b?.crimeRate || 15,
      };
    });

  const recentEvents =
    livingNpcs.length > 0
      ? m.events
          .filter((e) => e.tick >= tick - 1)
          .sort((a, b) => b.id - a.id)
          .slice(0, 100)
          .map((e) => ({
            burgId: e.burgId || 0,
            type: e.type,
            message: e.message,
            ...(e.tier ? { tier: e.tier } : {}),
          }))
      : [];

  const saltR = Math.floor(random() * 2147483647);
  const activeRoutes: ActiveTradeRouteSnapshot[] = s.tradeRoutes
    .filter((r) => r.status === "ACTIVE" && m.burgs.has(r.sourceBurgId) && m.burgs.has(r.destBurgId))
    .sort(
      (a, b) =>
        sqlShuffleRank(`${a.sourceBurgId}-${a.destBurgId}`, saltR) -
        sqlShuffleRank(`${b.sourceBurgId}-${b.destBurgId}`, saltR)
    )
    .slice(0, 10)
    .map((r) => ({
      sourceBurgId: r.sourceBurgId,
      destBurgId: r.destBurgId,
      volume: r.volume,
      riskLevel: r.riskLevel,
      srcFood: m.burgs.get(r.sourceBurgId)!.food,
      dstFood: m.burgs.get(r.destBurgId)!.food,
    }));

  const deceasedNpcs: DeceasedNpcSnapshot[] = allNpcs
    .filter((n) => !n.alive && !n.processedForEconomy)
    .map((n) => ({
      id: n.id,
      cellId: n.cellId,
      burgId: burgByCell.get(n.cellId)?.burgId ?? null,
      role: n.role,
      recent: n.recentDeceased,
    }));

  return { tick, loreDate, livingNpcs, recentEvents, activeRoutes, deceasedNpcs };
}

export function projectBackgroundDirectorSnapshot(
  world: WorldSnapshot,
  tick: number,
  loreDate: string
): BackgroundDirectorSnapshot {
  const m = world.mutable;
  const sectors: DirectorSectorSnapshot[] = Array.from(m.sectorLayers.values()).sort(
    (a, b) => a.cellId - b.cellId || a.rx - b.rx || a.ry - b.ry || a.zLayer - b.zLayer
  );
  const popCells = new Set(
    sectors.filter((sec) => sec.npcs.length > 0 || sec.props.length > 0).map((sec) => sec.cellId)
  );
  const burgsByCell: Record<number, DirectorBurgSnapshot> = {};
  for (const b of sortedBurgs(world)) {
    if (popCells.has(b.cellId) && !burgsByCell[b.cellId]) {
      burgsByCell[b.cellId] = {
        burgId: b.burgId,
        cellId: b.cellId,
        name: b.name,
        unrest: b.unrest,
        food: b.food,
        wealth: b.wealth,
        crimeRate: b.crimeRate,
      };
    }
  }
  return {
    tick,
    loreDate,
    moonPhase: m.calendar.moonPhase || "The Halo",
    isShadowWeek: Boolean(m.calendar.isShadowWeek),
    sectors,
    burgsByCell,
  };
}

export function projectAutonomousDramaSnapshot(
  world: WorldSnapshot,
  tick: number,
  loreDate: string
): AutonomousDramaSnapshot {
  const m = world.mutable;
  const openClashCells = new Set<number>();
  for (const st of m.storylines.values()) {
    if (
      st.ruleId === "AUTONOMOUS_CLASH" &&
      (st.state === "open" || st.state === "escalated" ||
        (st.resolvedTick != null && st.resolvedTick >= tick - STORY_REOPEN_COOLDOWN_TICKS))
    ) {
      openClashCells.add(st.cellId);
    }
  }
  const candBurgs = sortedBurgs(world)
    .filter((b) => (b.unrest > 15 || b.crimeRate > 15 || b.food < 400) && !openClashCells.has(b.cellId))
    .sort((a, b) => b.unrest + b.crimeRate - (a.unrest + a.crimeRate) || a.food - b.food || a.burgId - b.burgId)
    .slice(0, 3);

  if (candBurgs.length === 0) return { tick, loreDate, burgs: [] };

  const allParagons = Array.from(m.paragons.values()).filter((p) => p.outlawId === null);
  const burgs: DramaBurgSnapshot[] = [];
  for (const b of candBurgs) {
    const pList: DramaParagonSnapshot[] = allParagons
      .filter((p) => p.burgId === b.burgId)
      .sort((a, c) => c.corruptionScore - a.corruptionScore || a.id - c.id)
      .slice(0, 3)
      .map((p) => ({
        id: p.id,
        name: p.name,
        title: p.title,
        want: p.want,
        flaw: p.flaw,
        lineWontCross: p.lineWontCross,
        corruptionScore: p.corruptionScore,
      }));
    if (pList.length === 0) continue;

    const instigator = pList[(tick + b.burgId) % pList.length]!;
    const rivalParagon = pList.find((p) => p.id !== instigator.id);
    let cits: DramaCitizenSnapshot[] = [];
    if (!(rivalParagon && (tick + b.burgId) % 2 === 0)) {
      cits = Array.from(m.citizens.values())
        .filter((c) => c.settlementId === b.burgId && c.lifeStage === "ADULT" && c.allegianceStatus === "CIVILIAN")
        .sort((a, c) => a.citizenId - c.citizenId)
        .slice(0, 5)
        .map((c) => ({
          targetTypedId: `citizen:${c.citizenId}`,
          name: c.name,
          profession: c.profession,
        }));
      if (cits.length === 0) {
        const cid = promoteFromCohortInMemory(world, {
          burgId: b.burgId,
          filter: { ageBand: "ADULT", allegiance: "CIVILIAN" },
          slotKey: `drama:${tick}:${b.burgId}`,
        });
        if (cid) {
          const pc = m.citizens.get(cid);
          if (pc) {
            cits = [{ targetTypedId: `citizen:${pc.citizenId}`, name: pc.name, profession: pc.profession }];
          }
        }
      }
    }

    burgs.push({
      burgId: b.burgId,
      name: b.name,
      cellId: b.cellId,
      unrest: b.unrest,
      crimeRate: b.crimeRate,
      food: b.food,
      wealth: b.wealth,
      paragons: pList,
      citizens: cits,
      cellTags: Array.from(m.cellTags.get(b.cellId) || []),
    });
  }
  return { tick, loreDate, burgs };
}

export function projectChroniclerSnapshot(
  world: WorldSnapshot,
  tick: number,
  loreDate: string
): ChroniclerSnapshot {
  const events = world.mutable.events;
  const hasRecentRumor = events.some((e) => e.type === "REGIONAL_RUMOR" && e.tick >= Math.max(0, tick - 2));
  if (hasRecentRumor) return { tick, loreDate, hasRecentRumor: true, dramaEvents: [] };

  const dramaTypes = new Set(["AUTONOMOUS_CLASH", "THREAD_THWARTED_BY_LOCALS", "THREAD_RESOLVED", "BURG_FAMINE"]);
  const dramaEvents: ChroniclerDramaEvent[] = events
    .filter((e) => e.tick >= Math.max(1, tick - 5) && dramaTypes.has(e.type))
    .sort((a, b) => b.tick - a.tick || b.id - a.id)
    .slice(0, 3)
    .map((e) => ({ burgId: e.burgId, cellId: e.cellId, type: e.type, message: e.message }));

  return { tick, loreDate, hasRecentRumor: false, dramaEvents };
}

export function projectReaperSnapshot(world: WorldSnapshot, tick: number): ReaperSnapshot {
  const m = world.mutable;
  const ghostBurgs: ReaperGhostBurg[] = sortedBurgs(world)
    .filter((b) => b.popNull <= 0 && b.popAttuned <= 0)
    .map((b) => ({
      burgId: b.burgId,
      name: b.name,
      occupierFactionId: b.occupierFactionId,
      urbanTier: b.urbanTier,
    }));
  if (ghostBurgs.length === 0) {
    return { tick, ghostBurgs: [], ghostShipments: [], caravanCitizenIds: [], paragonIds: [] };
  }
  const ghostSet = new Set(ghostBurgs.map((b) => b.burgId));
  const crewCand = new Set<number>();
  const ghostShipments: ReaperGhostShipment[] = Array.from(m.tradeShipments.values())
    .filter((s) => s.status === "IN_TRANSIT" && (ghostSet.has(s.sourceBurgId) || ghostSet.has(s.destBurgId)))
    .sort((a, b) => a.id - b.id)
    .map((s) => {
      if (s.merchantCitizenId > 0) crewCand.add(s.merchantCitizenId);
      for (const cid of s.crewCitizenIds) if (cid > 0) crewCand.add(cid);
      return {
        id: s.id,
        merchantCitizenId: s.merchantCitizenId,
        crewCitizenIds: [...s.crewCitizenIds],
        pathIndex: s.pathIndex,
        currentCellId: s.currentCellId,
        etaTicks: s.etaTicks,
      };
    });
  const caravanCitizenIds = Array.from(crewCand)
    .filter((cid) => m.citizens.get(cid)?.allegianceStatus === "ON_CARAVAN")
    .sort((a, b) => a - b);
  const paragonIds = Array.from(m.paragons.values())
    .filter((p) => p.burgId !== null && ghostSet.has(p.burgId))
    .map((p) => p.id)
    .sort((a, b) => a - b);
  return { tick, ghostBurgs, ghostShipments, caravanCitizenIds, paragonIds };
}
