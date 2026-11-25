import type { Delta } from "../../deltas/types.js";
import { isYearEnd } from "../../canon/calendar.js";
import { ADULT_TRADE_MAP } from "../burgOperations/types.js";
import { stepAutonomousDrama } from "../autonomousDrama/step.js";
import { stepBackgroundDirector } from "../backgroundDirector/step.js";
import { stepBurgExpansion } from "../burgExpansion/step.js";
import { stepBurgOperations } from "../burgOperations/step.js";
import { stepCalendar } from "../calendar/step.js";
import { stepCartels } from "../cartels/step.js";
import { stepChaosFlow } from "../chaosFlow/step.js";
import { stepChronicler } from "../chronicler/step.js";
import { stepCultistRecruitment, stepCultists } from "../cultist/step.js";
import { stepCultureReligion } from "../cultureReligion/step.js";
import { stepEcology } from "../ecology/step.js";
import { stepEncounter } from "../encounter/step.js";
import { stepFactionCollapse } from "../factionCollapse/step.js";
import { stepFactionPlanning } from "../factions/step.js";
import { stepGrindCanyon } from "../grindCanyon/step.js";
import { buildMandateRecruitDeltas, planMandateRecruits, stepMandateWarbands } from "../mandate/step.js";
import { stepMarket } from "../market/step.js";
import { stepNpcRoutines } from "../npcRoutines/step.js";
import { stepParagons } from "../paragons/step.js";
import { stepReaper } from "../reaper/step.js";
import { materializeTradeDispatchDeltas, stepTrade } from "../trade/step.js";
import type { TradeRouter } from "../trade/types.js";
import { planWardenAwakening, stepWardenAwakening, stepWardens } from "../warden/step.js";
import { stepWeather } from "../weather/step.js";
import {
  applyCohortOpsInMemory,
  applyDeltasInMemory,
  promoteFromCohortInMemory,
  retireCohortsInMemory,
  zeroBurgsCohortsInMemory,
} from "./applyMemory.js";
import { cloneWorldSnapshot } from "./cloneWorld.js";
import {
  getCoordStatic,
  prepareAndProjectBurgOperations,
  projectAndFireScheduledEvents,
  projectAutonomousDramaSnapshot,
  projectBackgroundDirectorSnapshot,
  projectBurgExpansionSnapshot,
  projectCalendarSnapshot,
  projectCartelsSnapshot,
  projectChaosFlowSnapshot,
  projectChroniclerSnapshot,
  projectCultistRecruitSnapshot,
  projectCultistsSnapshot,
  projectCultureReligionSnapshot,
  projectEcologySnapshot,
  projectEncounterSnapshot,
  projectFactionCollapseSnapshot,
  projectFactionPlanningSnapshot,
  projectGrindCanyonSnapshot,
  projectMandateCandidates,
  projectMandateWarbandsSnapshot,
  projectMarketSnapshot,
  projectNpcRoutinesSnapshot,
  projectParagonsSnapshot,
  projectReaperSnapshot,
  projectTradeSnapshot,
  projectWardenAwakeningSnapshot,
  projectWardensSnapshot,
  projectWeatherSnapshot,
  resolveMandateRecruitsInMemory,
} from "./projectors.js";
import type { InMemoryDayOptions, InMemoryDayResult, InMemoryDaySideEffects, WorldSnapshot, WorldStatic } from "./types.js";

/** Pure coordinate-only fallback router for DB-free synthetic worlds when no LIVE_TRADE_ROUTER is supplied. */
function makeOfflineTradeRouter(s: WorldStatic): TradeRouter {
  return {
    getCellCoords: (cid) => getCoordStatic(s, cid),
    distBetweenCells: (a, b) => {
      const ca = getCoordStatic(s, a);
      const cb = getCoordStatic(s, b);
      return ca && cb ? Math.hypot(cb.x - ca.x, cb.y - ca.y) : 0;
    },
    advanceAlongPath: (pathCells, currentIndex) => {
      const nextIndex = Math.min(pathCells.length - 1, currentIndex + 1);
      return {
        nextIndex,
        nextCellId: pathCells[nextIndex] || pathCells[currentIndex] || 0,
        visitedCells: [pathCells[nextIndex] || 0],
        arrived: nextIndex >= pathCells.length - 1,
        stepDist: 0,
      };
    },
    findTradeRoute: ({ fromCellId, toCellId, allowedModes }) => {
      const ca = getCoordStatic(s, fromCellId);
      const cb = getCoordStatic(s, toCellId);
      if (!ca || !cb || allowedModes.length === 0) return null;
      return {
        mode: allowedModes[0]!,
        pathCells: [fromCellId, toCellId],
        totalDist: Math.hypot(cb.x - ca.x, cb.y - ca.y),
        etaTicks: 1,
        usesSea: allowedModes[0] === "SEA",
        usesRoad: allowedModes[0] === "LAND",
      };
    },
    computeRiverTollForPath: () => ({ crossings: 0, riverTollGold: 0 }),
    createRouteSearchMemo: () => ({ goalReach: new Map(), dynamicPaths: new Map() }),
  };
}

/**
 * Runs one full macro simulation day (`calendar` -> `reaper`) completely in memory over
 * `world`, mutating only `world.mutable` via `applyDeltasInMemory` and never touching PostgreSQL.
 */
export function runInMemoryDay(
  world: WorldSnapshot,
  tick: number,
  opts: InMemoryDayOptions
): InMemoryDayResult {
  const started = Date.now();
  const rnd = opts.random;
  const stepDeltas: Record<string, Delta[]> = {};
  const stepTimingsMs: Record<string, number> = {};
  const allDeltas: Delta[] = [];
  const allocRange = (start: number, end: number): number[] => {
    const out: number[] = [];
    for (let id = start; id < end; id++) out.push(id);
    return out;
  };

  const sideEffects: InMemoryDaySideEffects = {
    yearlyAgingAdultMap: isYearEnd(tick) ? ADULT_TRADE_MAP : null,
    cohortGrowthOps: [],
    cohortRetireReqs: [],
    zeroBurgsPrePromote: [],
    zeroBurgsPost: [],
    promotedCitizens: [],
    stepCreatedIds: {},
  };
  world.mutable.pendingPromotions = sideEffects.promotedCitizens;

  const runStep = (name: string, fn: () => Delta[]) => {
    const t0 = Date.now();
    const deltas = fn();
    if (deltas.length > 0) {
      const a0 = world.mutable.nextAgentId;
      const f0 = world.mutable.nextFrontId;
      const l0 = world.mutable.nextLairId;
      const c0 = world.mutable.nextCanyonId;
      const d0 = world.mutable.nextDropId;
      const s0 = world.mutable.nextShipmentId;
      applyDeltasInMemory(world, deltas);
      if (
        world.mutable.nextAgentId > a0 ||
        world.mutable.nextFrontId > f0 ||
        world.mutable.nextLairId > l0 ||
        world.mutable.nextCanyonId > c0 ||
        world.mutable.nextDropId > d0 ||
        world.mutable.nextShipmentId > s0
      ) {
        sideEffects.stepCreatedIds[name] = {
          agents: allocRange(a0, world.mutable.nextAgentId),
          fronts: allocRange(f0, world.mutable.nextFrontId),
          lairs: allocRange(l0, world.mutable.nextLairId),
          canyons: allocRange(c0, world.mutable.nextCanyonId),
          drops: allocRange(d0, world.mutable.nextDropId),
          shipments: allocRange(s0, world.mutable.nextShipmentId),
        };
      }
      allDeltas.push(...deltas);
    }
    stepDeltas[name] = deltas;
    stepTimingsMs[name] = Date.now() - t0;
  };

  let loreDate = `Tick ${tick}`;

  try {
    let calMeta = {
      season: world.mutable.calendar.season || "Greenspan",
      dayOfMonth: world.mutable.calendar.dayOfMonth || 1,
      loreDate: `Tick ${tick}`,
      isShadowWeek: Boolean(world.mutable.calendar.isShadowWeek),
      activeFlow: { domain: world.mutable.calendar.activeFlow || "Mass", dragon: world.mutable.calendar.dragonDomain || "Tiraton" },
      cruorbusPhase: world.mutable.calendar.moonPhase || "The Halo",
    };

    runStep("calendar", () => {
      const snap = projectCalendarSnapshot(world, tick);
      const out = stepCalendar(snap);
      calMeta = {
        season: out.calendar.season,
        dayOfMonth: out.calendar.dayOfMonth,
        loreDate: out.calendar.loreDate,
        isShadowWeek: out.calendar.isShadowWeek,
        activeFlow: { domain: out.calendar.activeFlow.domain, dragon: out.calendar.activeFlow.dragon },
        cruorbusPhase: out.calendar.cruorbusPhase,
      };
      return out.deltas;
    });
    loreDate = calMeta.loreDate;

    runStep("scheduledEvents", () => projectAndFireScheduledEvents(world, tick, 1440));

    runStep("weather", () =>
      stepWeather(
        projectWeatherSnapshot(world, tick, calMeta.season, calMeta.dayOfMonth, loreDate, calMeta.isShadowWeek),
        { random: rnd }
      )
    );

    runStep("ecology", () =>
      stepEcology(
        projectEcologySnapshot(world, tick, calMeta.season, loreDate, {
          activeDragon: calMeta.activeFlow.dragon,
          activeDomain: calMeta.activeFlow.domain,
          cruorbusPhase: calMeta.cruorbusPhase,
        }),
        { random: rnd, skipCellIds: opts.skipCellIds }
      )
    );

    runStep("chaosFlows", () =>
      stepChaosFlow(
        projectChaosFlowSnapshot(world, tick, {
          activeFlow: calMeta.activeFlow.domain,
          dragonDomain: calMeta.activeFlow.dragon,
          moonPhase: calMeta.cruorbusPhase,
        }),
        { random: rnd }
      ).deltas
    );

    runStep("burgOperations", () => {
      const snap = prepareAndProjectBurgOperations(world, tick, loreDate);
      const out = stepBurgOperations(snap, { random: rnd });
      if (out.cohortGrowthOps.length > 0) {
        applyCohortOpsInMemory(world, out.cohortGrowthOps);
        sideEffects.cohortGrowthOps.push(...out.cohortGrowthOps);
      }
      if (out.cohortRetireReqs.length > 0) {
        retireCohortsInMemory(world, out.cohortRetireReqs);
        sideEffects.cohortRetireReqs.push(...out.cohortRetireReqs);
      }
      if (out.emptiedFamineBurgs.length > 0) {
        zeroBurgsCohortsInMemory(world, out.emptiedFamineBurgs, "DECEASED", "Perished in famine.");
        sideEffects.zeroBurgsPrePromote.push({
          burgIds: [...out.emptiedFamineBurgs],
          status: "DECEASED",
          motivation: "Perished in famine.",
        });
      }
      if (out.emptiedRuinedBurgs.length > 0) {
        zeroBurgsCohortsInMemory(world, out.emptiedRuinedBurgs, "DEPARTED", "Abandoned a ruined settlement.");
        sideEffects.zeroBurgsPrePromote.push({
          burgIds: [...out.emptiedRuinedBurgs],
          status: "DEPARTED",
          motivation: "Abandoned a ruined settlement.",
        });
      }
      return out.deltas;
    });

  runStep("paragons", () => stepParagons(projectParagonsSnapshot(world, tick, loreDate), { random: rnd }));
  runStep("factionCollapse", () => stepFactionCollapse(projectFactionCollapseSnapshot(world, tick, loreDate)));
  runStep("factionPlanning", () => stepFactionPlanning(projectFactionPlanningSnapshot(world, tick, loreDate), { random: rnd }));

  runStep("burgExpansion", () => {
    if (tick % 10 !== 0) return [];
    const snap = projectBurgExpansionSnapshot(world, tick, loreDate);
    const out = stepBurgExpansion(snap, { random: rnd });
    return out.deltas;
  });

  runStep("cultureReligion", () => stepCultureReligion(projectCultureReligionSnapshot(world, tick, loreDate)).deltas);

  runStep("trade", () => {
    const router = opts.tradeRouter ?? makeOfflineTradeRouter(world.static);
    const snap = projectTradeSnapshot(world, tick, loreDate);
    const out = stepTrade(snap, { random: rnd, router });
    const tokenMap = new Map<number, number>();
    for (const p of out.cohortPromotions) {
      const cid = promoteFromCohortInMemory(world, p.spec);
      if (cid) tokenMap.set(p.token, cid);
    }
    const dispatchDeltas = materializeTradeDispatchDeltas(out.pendingDispatches, tokenMap, tick);
    return [...out.deltas, ...dispatchDeltas];
  });

  runStep("market", () => stepMarket(projectMarketSnapshot(world, tick)).deltas);

  runStep("wardens_awakening", () => {
    let curWardens = 0;
    for (const a of world.mutable.agents.values()) if (a.role === "Warden") curWardens++;
    const triggered = planWardenAwakening(curWardens, { random: rnd });
    const awakeSnap = projectWardenAwakeningSnapshot(world, tick, loreDate, triggered, rnd);
    return stepWardenAwakening(awakeSnap, { random: rnd });
  });

  runStep("wardens", () => stepWardens(projectWardensSnapshot(world, tick, loreDate), { random: rnd }));

  runStep("cultists_recruit", () => {
    const recSnap = projectCultistRecruitSnapshot(world, tick, loreDate, rnd);
    return recSnap.candidates.length > 0 ? stepCultistRecruitment(recSnap, { random: rnd }) : [];
  });

  runStep("cultists", () => stepCultists(projectCultistsSnapshot(world, tick, loreDate, rnd), { random: rnd }));

  runStep("mandate_recruit", () => {
    const { burgs, existingWarbandBurgIds } = projectMandateCandidates(world);
    const chosen = planMandateRecruits(burgs, existingWarbandBurgIds, { random: rnd });
    return chosen.length > 0
      ? buildMandateRecruitDeltas(tick, loreDate, resolveMandateRecruitsInMemory(world, tick, chosen, rnd), { random: rnd })
      : [];
  });

  runStep("mandate", () => stepMandateWarbands(projectMandateWarbandsSnapshot(world, tick, loreDate), { random: rnd }));

  runStep("cartels", () => stepCartels(projectCartelsSnapshot(world, tick, loreDate, rnd), { random: rnd }).deltas);
  runStep("grindCanyon", () => stepGrindCanyon(projectGrindCanyonSnapshot(world, tick, loreDate), rnd));
  runStep("encounters", () => stepEncounter(projectEncounterSnapshot(world), { tick, random: rnd }));
  runStep("npcRoutines", () => stepNpcRoutines(projectNpcRoutinesSnapshot(world, tick, loreDate, rnd), { random: rnd }));
  runStep("backgroundDirector", () => stepBackgroundDirector(projectBackgroundDirectorSnapshot(world, tick, loreDate)).deltas);
  runStep("autonomousDrama", () => stepAutonomousDrama(projectAutonomousDramaSnapshot(world, tick, loreDate)).deltas);
  runStep("chronicler", () => stepChronicler(projectChroniclerSnapshot(world, tick, loreDate)));

    runStep("reaper", () => {
      const snap = projectReaperSnapshot(world, tick);
      const out = stepReaper(snap);
      if (out.ruinedBurgIds.length > 0) {
        zeroBurgsCohortsInMemory(world, out.ruinedBurgIds, "DEPARTED", "Abandoned a ruined settlement.");
        sideEffects.zeroBurgsPost.push({
          burgIds: [...out.ruinedBurgIds],
          status: "DEPARTED",
          motivation: "Abandoned a ruined settlement.",
        });
      }
      return out.deltas;
    });
  } finally {
    world.mutable.pendingPromotions = undefined;
  }

  return {
    tick,
    loreDate,
    stepDeltas,
    allDeltas,
    stepTimingsMs,
    sideEffects,
    totalMs: Date.now() - started,
  };
}

/**
 * Clones `baseWorld` once and runs `days` consecutive macro days purely in memory, returning the
 * isolated branched world state plus every day's emitted delta trace. Never touches PostgreSQL.
 */
export function runInMemoryDays(
  baseWorld: WorldSnapshot,
  days: number,
  opts: {
    seedFn: (tick: number) => () => number;
    tradeRouter?: TradeRouter | undefined;
    skipCellIds?: ReadonlySet<number> | undefined;
  }
): {
  endWorld: WorldSnapshot;
  startTick: number;
  endTick: number;
  dayResults: InMemoryDayResult[];
  totalMs: number;
} {
  const started = Date.now();
  const branch = cloneWorldSnapshot(baseWorld);
  const startTick = branch.mutable.calendar.tick;
  const dayResults: InMemoryDayResult[] = [];
  let endTick = startTick;

  for (let d = 0; d < days; d++) {
    const nextTick = endTick + 1;
    const res = runInMemoryDay(branch, nextTick, {
      random: opts.seedFn(nextTick),
      tradeRouter: opts.tradeRouter,
      skipCellIds: opts.skipCellIds,
    });
    dayResults.push(res);
    endTick = nextTick;
  }

  return {
    endWorld: branch,
    startTick,
    endTick,
    dayResults,
    totalMs: Date.now() - started,
  };
}
