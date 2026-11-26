import { DAYS_PER_YEAR } from "../../canon/calendar.js";
import type { CohortKey } from "../../entities/population.js";
import {
  ADULT_PROFESSIONS,
  ADULT_TRADE_MAP,
  type RecordLedger,
  type WorkingBurg,
} from "./types.js";

/** Calibrates people per citizen record and attuned share for a burg. */
export function recordLedger(
  popNull: number,
  popAttuned: number,
  livingRecords: number
): RecordLedger {
  const total = Math.max(0, popNull) + Math.max(0, popAttuned);
  const unit = livingRecords > 0 ? Math.min(40, Math.max(3, Math.round(total / livingRecords))) : 12;
  const attunedShare = total > 0 ? Math.max(0, popAttuned) / total : 0.5;
  return { unit, attunedShare };
}

/** Computes a burg's ledger from its stored `record_unit` and current null/attuned mix. */
export function ledgerForBurg(burg: WorkingBurg): RecordLedger {
  const popNull = Math.max(0, Number(burg.popNull) || 0);
  const popAttuned = Math.max(0, Number(burg.popAttuned) || 0);
  const total = popNull + popAttuned;
  return {
    unit: Math.min(40, Math.max(3, Number(burg.recordUnit) || 12)),
    attunedShare: total > 0 ? popAttuned / total : 0.5,
  };
}

/** Splits `people` into null and attuned counts matching `attunedShare`. */
export function splitByShare(
  people: number,
  attunedShare: number
): { nulls: number; attuned: number } {
  const attuned = Math.round(people * attunedShare);
  return { nulls: people - attuned, attuned };
}

function pickRandom<T>(arr: readonly T[], fallback: T, random: () => number): T {
  if (!arr || arr.length === 0) return fallback;
  return arr[Math.floor(random() * arr.length)] ?? fallback;
}

function resolveSpecies(demographicsStr: string, random: () => number): string {
  try {
    const demo = JSON.parse(demographicsStr || "{}");
    const entries = Object.entries(demo);
    if (entries.length === 0) return "Human";
    const roll = random();
    let cumulative = 0;
    for (const [sp, weight] of entries) {
      cumulative += Number(weight);
      if (roll <= cumulative) {
        if (sp.includes("Avian") || sp.includes("Eagle") || sp.includes("Hawk")) return "Avian";
        if (sp.includes("Bear") || sp.includes("Ursine")) return "Bear-Folk";
        if (sp.includes("Wolf") || sp.includes("Hound")) return "Wolf-Kin";
        if (sp.includes("Felid") || sp.includes("Cat") || sp.includes("Red Panda")) return "Felid";
        if (sp.includes("Lizard") || sp.includes("Reptile") || sp.includes("Saurian")) return "Saurian";
        if (sp.includes("Plant") || sp.includes("Mushroom") || sp.includes("Fae")) return "Plant-Folk";
        return sp;
      }
    }
  } catch {
    return "Human";
  }
  return "Human";
}

/**
 * Pure daily births, starvation/departure cohort pooling, zero-pop ruin transitions, and
 * demographics JSON formatting for a single burg.
 */
export function stepBurgPopulationLedger(opts: {
  burg: WorkingBurg;
  ledger: RecordLedger;
  totalPop: number;
  newFood: number;
  newHealth: number;
  newUnrest: number;
  starvationDeaths: number;
  popNullDelta: number;
  popAttunedDelta: number;
  departedDead: number;
  departedLeft: number;
  cohortGrowthOps: Array<CohortKey & { delta: number }>;
  cohortRetireReqs: Array<{ burgId: number; people: number }>;
  emptiedFamineBurgs: number[];
  emptiedRuinedBurgs: number[];
  workforceDirtyBurgs: Set<number>;
  random: () => number;
}): {
  newPopNull: number;
  newPopAttuned: number;
  growthPool: number;
  departurePool: number;
  demographics: string;
} {
  const {
    burg,
    ledger,
    totalPop,
    newFood,
    newHealth,
    newUnrest,
    starvationDeaths,
    departedDead,
    departedLeft,
    cohortGrowthOps,
    cohortRetireReqs,
    emptiedFamineBurgs,
    emptiedRuinedBurgs,
    workforceDirtyBurgs,
    random,
  } = opts;
  let { popNullDelta, popAttunedDelta } = opts;
  const nullsNow = Math.max(0, Number(burg.origPopNull) || 0);
  const pop = nullsNow + Math.max(0, Number(burg.popAttuned) || 0);

  // Losses gathered earlier in the step (bandits, refugees, occupation, riots) arrive as a single
  // pop_null figure; spread them over Nulls and attuned by headcount so neither group is singled out.
  if (popNullDelta < 0 && pop > 0) {
    const loss = Math.min(pop, -popNullDelta);
    const nullLoss = Math.round((loss * nullsNow) / pop);
    popNullDelta = -nullLoss;
    popAttunedDelta -= loss - nullLoss;
  }

  let births = 0;
  if (newFood > 0 && newHealth >= 40 && newUnrest < 70) {
    const annualBirthRate = 0.035 * (newHealth / 100) * (1 - newUnrest / 150);
    const dailyBirthRate = annualBirthRate / DAYS_PER_YEAR;
    births = pop * dailyBirthRate;
    if (pop < 100 && newFood > pop * 2 && random() < 0.05) {
      births = Math.max(0.1, births);
    }
  }

  // Natural deaths (age, illness): about 2% a year at full health, up to 3.2% when health is poor.
  // Without them births were the only flow and only disasters ever removed people.
  const naturalDeaths = (pop * 0.02 * (1.6 - Math.min(100, Math.max(0, newHealth)) / 100)) / DAYS_PER_YEAR;

  let growthPool = (Number(burg.popGrowthPool) || 0) + (births - (starvationDeaths || 0) - naturalDeaths);
  const grown = splitByShare(ledger.unit, ledger.attunedShare);

  while (growthPool >= ledger.unit) {
    growthPool -= ledger.unit;
    popNullDelta += grown.nulls;
    popAttunedDelta += grown.attuned;

    const isMaturation = random() < 0.5;
    const species = resolveSpecies(burg.speciesDemographics, random);
    const isNull = random() >= ledger.attunedShare;
    const sparkTier = isNull
      ? "NULL"
      : random() < 0.5
        ? "DORMANT_SPARK"
        : random() < 0.7
          ? "SENSITIVE"
          : "CHANNELER";
    const prof = isMaturation
      ? ADULT_TRADE_MAP[pickRandom(Object.keys(ADULT_TRADE_MAP), "Farm Hand", random)] || "Laborer"
      : pickRandom(ADULT_PROFESSIONS, "Merchant Trader", random);

    cohortGrowthOps.push({
      burgId: burg.burgId,
      species,
      profession: prof,
      ageBand: "ADULT",
      sparkTier,
      isNull,
      allegiance: "CIVILIAN",
      delta: ledger.unit,
    });
    workforceDirtyBurgs.add(burg.burgId);
  }

  let starveRetirePeople = 0;
  while (growthPool <= -ledger.unit) {
    growthPool += ledger.unit;
    popNullDelta -= grown.nulls;
    popAttunedDelta -= grown.attuned;
    starveRetirePeople += ledger.unit;
  }
  if (starveRetirePeople > 0) {
    cohortRetireReqs.push({ burgId: burg.burgId, people: starveRetirePeople });
    workforceDirtyBurgs.add(burg.burgId);
  }

  if (totalPop > 0 && totalPop < ledger.unit && growthPool <= -totalPop) {
    popNullDelta = -(Number(burg.origPopNull) || 0);
    popAttunedDelta = -(Number(burg.popAttuned) || 0);
    growthPool = 0;
    emptiedFamineBurgs.push(burg.burgId);
    workforceDirtyBurgs.add(burg.burgId);
  }

  let departurePool = (Number(burg.popDeparturePool) || 0) + departedDead + departedLeft;
  const retiring = Math.floor(departurePool / ledger.unit);
  if (retiring > 0) {
    departurePool -= retiring * ledger.unit;
    cohortRetireReqs.push({ burgId: burg.burgId, people: retiring * ledger.unit });
    workforceDirtyBurgs.add(burg.burgId);
  }

  const newPopNull = Math.floor(Math.max(0, (burg.origPopNull || 0) + popNullDelta));
  const newPopAttuned = Math.floor(Math.max(0, (burg.popAttuned || 0) + popAttunedDelta));
  if (newPopNull <= 0 && newPopAttuned <= 0) {
    departurePool = 0;
    emptiedRuinedBurgs.push(burg.burgId);
    workforceDirtyBurgs.add(burg.burgId);
  }

  const sparkbornTotal = newPopAttuned;
  const dormantSparks = Math.round(sparkbornTotal * 0.5);
  const adepts = sparkbornTotal > 0 ? Math.max(1, Math.round(sparkbornTotal * 0.01)) : 0;
  const sensitives = Math.max(0, sparkbornTotal - dormantSparks - adepts);
  const demographics = JSON.stringify({
    nulls: newPopNull,
    sparkborn_total: sparkbornTotal,
    dormant_sparks: dormantSparks,
    sensitives,
    adepts,
  });

  return { newPopNull, newPopAttuned, growthPool, departurePool, demographics };
}
