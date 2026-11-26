import type { Delta } from "../../deltas/types.js";
import { GOOD_ROLE_BY_ID, goodKeyFromName } from "../../economy/goodCatalog.js";
import { evaluateBurgInventoryEffects } from "../../economy/itemSystemicMatrix.js";
import type { CohortKey } from "../../entities/population.js";
import { applyFoodAndTributeFlows, applyGranaryAndCirculationCaps, resolveStarvation } from "./food.js";
import {
  applyChaosAndSpecialtyRemedies,
  applyMaintenanceAndNeeds,
  evaluateCivicAndCrisisEvents,
  evaluateCivilEquilibrium,
  resolveOccupationAndResistance,
} from "./health.js";
import {
  advanceActiveProjects,
  evaluateUrbanTierUpgrade,
  planAutoInfrastructureBuilds,
} from "./infrastructure.js";
import { ledgerForBurg, stepBurgPopulationLedger } from "./populationLedger.js";
import {
  computeWorkEfficiency,
  computeWorkforceSummary,
  parseResourceProfile,
  runPrimaryProduction,
  runWorkshopAndSpecialtyCrafting,
} from "./production.js";
import { econPop } from "./types.js";
import type {
  ActiveProjectCreateSpec,
  BurgEventSpec,
  BurgGoodSnap,
  BurgOperationsSnapshot,
  BurgOperationsStepOutput,
  BurgTagSpec,
  BurgUpdateRecord,
  InfraBuildSpec,
  StepBurgOperationsOptions,
  WorkingBurg,
  WorkingOutlaw,
} from "./types.js";

/**
 * Pure inter-burg daily operations step function (zero DB, zero UI, zero async_hooks).
 * Executes production -> food -> health -> infrastructure -> population ledger across all
 * living burgs cleanly and emits validated deltas + batched cohort operations.
 */
export function stepBurgOperations(
  snap: BurgOperationsSnapshot,
  opts: StepBurgOperationsOptions = {}
): BurgOperationsStepOutput {
  const random = opts.random ?? Math.random;
  const { tick, loreDate, currentSeason } = snap;

  // Clone working state so caller snapshots stay 100% immutable
  const workingBurgs: WorkingBurg[] = snap.burgs.map((b) => {
    const wfMap = new Map<string, { records: number; people: number }>();
    for (const [prof, counts] of Object.entries(b.workforce || {})) {
      wfMap.set(prof, {
        records: Number(counts?.records) || 0,
        people: Number(counts?.people) || 0,
      });
    }
    return {
      burgId: b.burgId,
      name: b.name,
      cellId: b.cellId,
      factionId: b.factionId,
      occupierFactionId: b.occupierFactionId,
      occupationTicks: b.occupationTicks,
      resistanceStrength: b.resistanceStrength,
      parentBurgId: b.parentBurgId,
      upstreamBurgId: b.upstreamBurgId,
      food: b.food,
      origFood: b.food,
      wealth: b.wealth,
      health: b.health,
      unrest: b.unrest,
      crimeRate: b.crimeRate,
      urbanTier: b.urbanTier,
      origUrbanTier: b.urbanTier,
      isCapital: Boolean(b.isCapital),
      biome: b.biome,
      architectureType: b.architectureType,
      popNull: b.popNull,
      origPopNull: b.popNull,
      popAttuned: b.popAttuned,
      recordUnit: b.recordUnit,
      popGrowthPool: b.popGrowthPool,
      popDeparturePool: b.popDeparturePool,
      speciesDemographics: b.speciesDemographics,
      militaryForces: b.militaryForces,
      resourceProfile: b.resourceProfile,
      production: b.production,
      currentTemp: b.currentTemp,
      baseTemp: b.baseTemp,
      cellFlux: b.cellFlux,
      riverId: b.riverId,
      riverDischarge: b.riverDischarge,
      cellEcoHealth: b.cellEcoHealth,
      workforce: wfMap,
      inventory: { ...b.inventory },
      occupationTouched: false,
      nameChangedToRuin: false,
    };
  });
  const burgById = new Map<number, WorkingBurg>(workingBurgs.map((b) => [b.burgId, b]));
  const cellEcoHealthByCell = new Map<number, number>();
  for (const b of workingBurgs) {
    if (b.cellId > 0) cellEcoHealthByCell.set(b.cellId, b.cellEcoHealth);
  }

  const workingOutlaws: WorkingOutlaw[] = snap.outlaws.map((o) => ({ ...o }));
  const outlawManpowerDeltas = new Map<number, number>();

  const goodsById = new Map<number, BurgGoodSnap>();
  const goodKeyById = new Map<number, string>();
  const rawMaterialKeys = new Set<string>();
  const refinedGoodKeys = new Set<string>();
  const advancedGoodKeys = new Set<string>();
  for (const g of snap.goods) {
    const key =
      g.key || goodKeyFromName(g.name || "") || GOOD_ROLE_BY_ID[g.id]?.goodKey || `good_${g.id}`;
    goodsById.set(g.id, { ...g, key });
    goodKeyById.set(g.id, key);
    const role = GOOD_ROLE_BY_ID[g.id];
    if (!g.recipes || g.recipes.length === 0) {
      if (!role?.isFood) rawMaterialKeys.add(key);
    } else if (g.value >= 12) {
      advancedGoodKeys.add(key);
    } else {
      refinedGoodKeys.add(key);
    }
  }

  const chaosIntensityMap = new Map<number, number>();
  for (const [cid, intensity] of snap.chaosIntensityEntries) {
    chaosIntensityMap.set(cid, Math.max(chaosIntensityMap.get(cid) || 0, intensity));
  }
  const blockadedCellSet = new Set<number>(snap.blockadedCellIds);
  const floodedCellSet = new Set<number>(snap.floodedCellIds);
  const droughtCellSet = new Set<number>(snap.droughtCellIds);
  const occTraitsByFactionId = new Map<number, unknown>(snap.occupierTraitsByFactionEntries);

  const burgInfraMap = new Map<number, Map<string, number>>();
  for (const inf of snap.infrastructure) {
    let m = burgInfraMap.get(inf.burgId);
    if (!m) {
      m = new Map();
      burgInfraMap.set(inf.burgId, m);
    }
    m.set(inf.type, inf.level);
  }

  const incomingTributes = new Map<number, { food: number; wealth: number }>();
  const burgUpdates: BurgUpdateRecord[] = [];
  // Food each burg had when its own update was computed; grain relief drawn from it afterwards by a
  // later burg is subtracted below, so relief moves food instead of creating it.
  const foodWhenProcessed = new Map<number, number>();
  // Same for wealth: grain sold on the market pays the seller, possibly after the seller was processed.
  const wealthWhenProcessed = new Map<number, number>();
  const stockpileUpdates: Array<{ burgId: number; inventory: Record<string, number> }> = [];
  const events: BurgEventSpec[] = [];
  const tags: BurgTagSpec[] = [];
  const workforceDirtyBurgs = new Set<number>();
  const infraBuilds = new Map<string, InfraBuildSpec>();
  const ecoMaxReductions = new Map<number, number>();
  const cellEcoDeltas = new Map<number, number>();
  const cellFactionSets = new Map<number, number | null>();
  const newActiveProjects: ActiveProjectCreateSpec[] = [];
  const cohortGrowthOps: Array<CohortKey & { delta: number }> = [];
  const cohortRetireReqs: Array<{ burgId: number; people: number }> = [];
  const emptiedFamineBurgs: number[] = [];
  const emptiedRuinedBurgs: number[] = [];

  const { shouldAdvanceAll, activeProjectsSet } = advanceActiveProjects({
    activeProjects: snap.activeProjects,
    burgById,
    tick,
    events,
  });

  for (const burg of workingBurgs) {
    const totalPop = (Number(burg.origPopNull) || 0) + (Number(burg.popAttuned) || 0);
    if (totalPop <= 0) continue;

    const ledger = ledgerForBurg(burg);
    let departedDead = 0;
    let departedLeft = 0;
    const profMap = burg.workforce;
    const { wCivil, wSec, wSoc, craftedCount, totalActiveRecords, fullBlocks } =
      computeWorkforceSummary(profMap);

    const inventory: Record<string, number> = { ...burg.inventory };
    const systemicEffects = evaluateBurgInventoryEffects(inventory);
    const chaosIntensity = chaosIntensityMap.get(burg.cellId) || 0;
    const workEfficiency = computeWorkEfficiency(burg, chaosIntensity);
    const { primarySlots, craftedSlots } = parseResourceProfile(burg, goodKeyById);
    const bInfra = burgInfraMap.get(burg.burgId) || new Map<string, number>();

    const primaryRes = runPrimaryProduction({
      burg,
      profMap,
      bInfra,
      primarySlots,
      workEfficiency,
      currentSeason,
      winterResilience: systemicEffects.winterResilience,
      isFlooded: floodedCellSet.has(burg.cellId),
      isDrought: droughtCellSet.has(burg.cellId),
      wCivil,
      wSec,
      craftedCount,
      inventory,
    });
    if (primaryRes.cellEcoDamage > 0 && burg.cellId) {
      cellEcoDeltas.set(
        burg.cellId,
        (cellEcoDeltas.get(burg.cellId) || 0) + primaryRes.cellEcoDamage
      );
    }

    const isTradeBlockaded = blockadedCellSet.has(burg.cellId);
    const factionId = burg.occupierFactionId || burg.factionId;

    const military: Record<string, number> = {};
    try {
      if (burg.militaryForces) {
        const parsedMil =
          typeof burg.militaryForces === "string"
            ? JSON.parse(burg.militaryForces)
            : burg.militaryForces;
        if (parsedMil && typeof parsedMil === "object") {
          for (const k of Object.keys(parsedMil as Record<string, unknown>)) {
            military[k.toLowerCase()] = Number((parsedMil as Record<string, unknown>)[k]) || 0;
          }
        }
      }
    } catch {
      // keep empty military
    }

    const foodFlowRes = applyFoodAndTributeFlows({
      burg,
      workingBurgs,
      factionId,
      isTradeBlockaded,
      incomingTributes,
      foodProduced: primaryRes.foodProduced,
      wealthDelta: primaryRes.wealthDelta,
      military,
      farmLevel: bInfra.get("FARM") || 0,
    });

    let popNullDelta = 0;
    const popAttunedDelta = 0;

    const civilEq = evaluateCivilEquilibrium({
      burg,
      foodDelta: foodFlowRes.foodDelta,
      wCivil,
      wSec,
      wSoc,
      systemicEffects,
    });

    const starveRes = resolveStarvation({
      burg,
      foodDelta: foodFlowRes.foodDelta,
      totalPop,
      military,
      healthDelta: civilEq.healthDelta,
      unrestDelta: civilEq.unrestDelta,
      crimeDelta: civilEq.crimeDelta,
    });

    const remedyRes = applyChaosAndSpecialtyRemedies({
      burg,
      chaosIntensity,
      healthDelta: starveRes.healthDelta,
      unrestDelta: starveRes.unrestDelta,
      crimeDelta: starveRes.crimeDelta,
      inventory,
    });

    planAutoInfrastructureBuilds({
      burg,
      requiredInfraBuilds: primaryRes.requiredInfraBuilds,
      inventory,
      infraBuilds,
      ecoMaxReductions,
    });

    runWorkshopAndSpecialtyCrafting({
      burg,
      tick,
      factionId,
      profMap,
      craftedSlots,
      workEfficiency,
      totalActiveRecords,
      goodsById,
      goodKeyById,
      inventory,
      events,
      tags,
      random,
    });

    const maintRes = applyMaintenanceAndNeeds({
      burg,
      tick,
      fullBlocks,
      military,
      rawKeys: rawMaterialKeys,
      refinedKeys: refinedGoodKeys,
      advancedKeys: advancedGoodKeys,
      inventory,
      workingOutlaws,
      outlawManpowerDeltas,
      random,
      healthDelta: remedyRes.healthDelta,
      unrestDelta: remedyRes.unrestDelta,
    });

    const occTraits = burg.occupierFactionId
      ? occTraitsByFactionId.get(burg.occupierFactionId)
      : undefined;
    const occRes = resolveOccupationAndResistance({
      burg,
      tick,
      military,
      inventory,
      occTraits,
      events,
      cellFactionSets,
      random,
    });
    popNullDelta += occRes.popNullDeltaInc;
    departedDead += occRes.departedDeadInc;

    wealthWhenProcessed.set(burg.burgId, burg.wealth || 0);
    const rawNewWealth = Math.floor(Math.max(0, (burg.wealth || 0) + foodFlowRes.wealthDelta));
    const upgradeRes = evaluateUrbanTierUpgrade({
      burg,
      newWealth: rawNewWealth,
      tick,
      activeProjectsSet,
      inventory,
      newActiveProjects,
      events,
    });

    foodWhenProcessed.set(burg.burgId, burg.food || 0);
    const capped = applyGranaryAndCirculationCaps(
      (burg.food || 0) + foodFlowRes.foodDelta,
      upgradeRes.newWealth,
      econPop({ popNull: burg.origPopNull, popAttuned: burg.popAttuned })
    );
    let newFood = capped.newFood;
    const newWealth = capped.newWealth;
    const newHealth = Math.floor(Math.min(100, Math.max(0, (burg.health || 100) + maintRes.healthDelta)));
    const newUnrest = Math.floor(Math.min(100, Math.max(0, (burg.unrest || 0) + maintRes.unrestDelta)));
    const newCrime = Math.floor(Math.min(100, Math.max(0, (burg.crimeRate || 0) + remedyRes.crimeDelta)));

    const crisisRes = evaluateCivicAndCrisisEvents({
      burg,
      tick,
      chaosIntensity,
      foodDelta: foodFlowRes.foodDelta,
      newFood,
      newHealth,
      newUnrest,
      starvationDeaths: starveRes.starvationDeaths,
      banditDefectors: starveRes.banditDefectors,
      receivedTribute: foodFlowRes.receivedTribute,
      popNullDelta,
      departedLeft,
      workingOutlaws,
      outlawManpowerDeltas,
      events,
      tags,
      random,
    });
    newFood = crisisRes.newFood;
    popNullDelta = crisisRes.popNullDelta;
    departedLeft = crisisRes.departedLeft;

    const popRes = stepBurgPopulationLedger({
      burg,
      ledger,
      totalPop,
      newFood,
      newHealth,
      newUnrest,
      starvationDeaths: starveRes.starvationDeaths,
      popNullDelta,
      popAttunedDelta,
      departedDead,
      departedLeft,
      cohortGrowthOps,
      cohortRetireReqs,
      emptiedFamineBurgs,
      emptiedRuinedBurgs,
      workforceDirtyBurgs,
      random,
    });

    for (const key in inventory) {
      if ((inventory[key] || 0) > 100000) inventory[key] = 100000;
    }

    burgUpdates.push({
      burgId: burg.burgId,
      food: newFood,
      wealth: newWealth,
      health: newHealth,
      unrest: newUnrest,
      crimeRate: newCrime,
      urbanTier: burg.urbanTier,
      architectureType: upgradeRes.archType,
      popNull: popRes.newPopNull,
      popAttuned: popRes.newPopAttuned,
      popGrowthPool: popRes.growthPool,
      popDeparturePool: popRes.departurePool,
      demographics: popRes.demographics,
      ...(burg.occupationTouched
        ? {
            occupierFactionId: burg.occupierFactionId,
            occupationTicks: burg.occupationTicks,
            resistanceStrength: burg.resistanceStrength,
          }
        : {}),
      includeOccupation: burg.occupationTouched,
      ...(burg.nameChangedToRuin ? { name: burg.name } : {}),
      clearWorkforce: workforceDirtyBurgs.has(burg.burgId),
    });

    stockpileUpdates.push({
      burgId: burg.burgId,
      inventory,
    });
  }

  const deltas: Delta[] = [];

  if (shouldAdvanceAll) {
    deltas.push({ kind: "activeProject.advanceAll" });
  }
  for (const proj of newActiveProjects) {
    deltas.push({
      kind: "activeProject.create",
      burgId: proj.burgId,
      projectType: proj.projectType,
      targetTier: proj.targetTier,
      ticksRemaining: proj.ticksRemaining,
    });
  }

  for (const cid of Array.from(cellFactionSets.keys()).sort((a, b) => a - b)) {
    deltas.push({ kind: "cell.setFaction", cellId: cid, factionId: cellFactionSets.get(cid) ?? null });
  }

  for (const u of burgUpdates) {
    const drawnLater = (foodWhenProcessed.get(u.burgId) ?? 0) - (burgById.get(u.burgId)?.food ?? 0);
    if (drawnLater > 0) u.food = Math.max(0, u.food - drawnLater);
    const earnedLater = (burgById.get(u.burgId)?.wealth ?? 0) - (wealthWhenProcessed.get(u.burgId) ?? 0);
    if (earnedLater > 0) u.wealth = Math.max(0, u.wealth + earnedLater);
  }

  for (const u of burgUpdates) {
    deltas.push({
      kind: "burg.set",
      burgId: u.burgId,
      fields: {
        food: u.food,
        wealth: u.wealth,
        health: u.health,
        unrest: u.unrest,
        crime_rate: u.crimeRate,
        urban_tier: u.urbanTier,
        architecture_type: u.architectureType,
        pop_null: u.popNull,
        pop_attuned: u.popAttuned,
        pop_growth_pool: u.popGrowthPool,
        pop_departure_pool: u.popDeparturePool,
        demographics: u.demographics,
        ...(u.includeOccupation
          ? {
              occupier_faction_id: u.occupierFactionId ?? null,
              occupation_ticks: u.occupationTicks ?? 0,
              resistance_strength: u.resistanceStrength ?? 0,
            }
          : {}),
        ...(u.name !== undefined ? { name: u.name } : {}),
        ...(u.clearWorkforce ? { clear_workforce: true } : {}),
      },
    });
  }

  for (const s of stockpileUpdates) {
    deltas.push({ kind: "burgStockpile.setInventory", burgId: s.burgId, inventory: s.inventory });
  }

  for (const oId of Array.from(outlawManpowerDeltas.keys()).sort((a, b) => a - b)) {
    const mpDelta = outlawManpowerDeltas.get(oId) || 0;
    if (mpDelta > 0) {
      deltas.push({ kind: "outlawFaction.adjust", outlawId: oId, manpowerDelta: mpDelta });
    }
  }

  const infraList = Array.from(infraBuilds.values()).sort(
    (a, b) => a.burgId - b.burgId || a.type.localeCompare(b.type)
  );
  for (const item of infraList) {
    deltas.push({
      kind: "infrastructure.adjust",
      burgId: item.burgId,
      cellId: item.cellId,
      infraType: item.type,
      levelDelta: item.inc,
      upsert: true,
    });
  }

  const touchedCells = Array.from(
    new Set([...ecoMaxReductions.keys(), ...cellEcoDeltas.keys()])
  ).sort((a, b) => a - b);
  for (const cid of touchedCells) {
    const dec = ecoMaxReductions.get(cid) || 0;
    const dmg = cellEcoDeltas.get(cid) || 0;
    if (dec > 0 || dmg > 0) {
      deltas.push({
        kind: "cell.adjust",
        cellId: cid,
        ...(dec > 0 ? { ecoMax: -dec } : {}),
        ...(dmg > 0 ? { ecoHealth: -dmg } : {}),
      });
    }
  }

  for (const t of tags) {
    deltas.push({
      kind: "citizen.tagBurg",
      burgId: t.burgId,
      tags: t.tags,
      temper: t.temper,
      motivation: t.motivation,
      professionFilter: t.professionFilter,
      limit: t.limit,
      randomSeed: t.randomSeed,
    });
  }

  for (const e of events) {
    deltas.push({
      kind: "event.log",
      tick: e.tick,
      type: e.type,
      message: e.message,
      tier: e.tier,
      loreDate,
      ...(e.burgId !== undefined && e.burgId > 0 ? { burgId: e.burgId } : {}),
      ...(e.cellId !== undefined && e.cellId > 0 ? { cellId: e.cellId } : {}),
    });
  }

  const ecoCollapseCells = Array.from(cellEcoDeltas.entries()).sort((a, b) => a[0] - b[0]);
  for (const [cid, dmg] of ecoCollapseCells) {
    const curHealth = cellEcoHealthByCell.get(cid) ?? 100;
    const nextHealth = Math.max(0, curHealth - dmg);
    // Report the collapse once, when the cell first falls below 30, not on every tick it stays there.
    if (nextHealth < 30 && curHealth >= 30) {
      deltas.push({
        kind: "event.log",
        tick,
        type: "ECOLOGICAL_COLLAPSE",
        message: `⚠️ ECOLOGICAL COLLAPSE: Cell ${cid} suffering from severe deforestation and resource depletion (Eco-Health ${nextHealth})! Flora and wildlife populations decimated.`,
        tier: "MAJOR",
        loreDate,
        cellId: cid,
      });
    }
  }

  return {
    deltas,
    cohortGrowthOps,
    cohortRetireReqs,
    emptiedFamineBurgs,
    emptiedRuinedBurgs,
  };
}
