import { SHADOWFALL, seasonKind } from "../../canon/calendar.js";
import { getFactionSpecialty } from "../../economy/factionSpecialties.js";
import {
  CIVIC_PROFESSIONS,
  GOOD_ROLE_BY_ID,
  SECURITY_PROFESSIONS,
  SOCIAL_SPIRITUAL_PROFESSIONS,
  getProfessionForGood,
  goodKeyFromName,
} from "../../economy/goodCatalog.js";
import type {
  BurgEventSpec,
  BurgGoodSnap,
  BurgTagSpec,
  WorkingBurg,
} from "./types.js";

const CRAFTER_REVENUE_PROFESSIONS = new Set([
  "Armorer",
  "Blacksmith",
  "Tanner",
  "Weaver",
  "Potter",
  "Foundry Worker",
  "Alchemist",
  "Goldsmith",
  "Brewmaster",
  "Baker",
]);

/**
 * Computes seasonal & hydrological crop modifier from cell climate, river discharge, and flood/drought tags.
 */
export function computeClimateHarvestModifier(opts: {
  currentTemp: number;
  cellFlux: number;
  riverId: number;
  riverDischarge: number;
  isFlooded: boolean;
  isDrought: boolean;
}): number {
  const tempFactor =
    opts.currentTemp < 0
      ? 0.55
      : opts.currentTemp < 10
        ? 0.85
        : opts.currentTemp > 34
          ? 0.65
          : opts.currentTemp > 26
            ? 0.88
            : 1.0;

  let hydroDelta = 0;
  if (opts.isFlooded) {
    hydroDelta = -0.3;
  } else if (opts.riverId > 0 || opts.riverDischarge > 0) {
    hydroDelta = opts.riverDischarge >= 400 ? 0.25 : 0.18;
  } else if (opts.cellFlux >= 15) {
    hydroDelta = 0.08;
  } else if (opts.cellFlux <= 1) {
    hydroDelta = opts.isDrought ? -0.25 : -0.12;
  }

  return Math.max(0.3, Math.min(1.4, tempFactor + hydroDelta));
}

export function computeWorkforceSummary(
  profMap: Map<string, { records: number; people: number }>
): {
  wCivil: number;
  wSec: number;
  wSoc: number;
  craftedCount: number;
  totalActiveRecords: number;
  fullBlocks: number;
} {
  let wCivil = 0;
  let wSec = 0;
  let wSoc = 0;
  let craftedCount = 0;
  let totalActiveRecords = 0;

  for (const [prof, counts] of profMap.entries()) {
    totalActiveRecords += counts.records;
    if (CIVIC_PROFESSIONS.has(prof)) wCivil += counts.records;
    else if (SECURITY_PROFESSIONS.has(prof)) wSec += counts.records;
    else if (SOCIAL_SPIRITUAL_PROFESSIONS.has(prof)) wSoc += counts.records;
    else if (CRAFTER_REVENUE_PROFESSIONS.has(prof)) craftedCount += counts.records;
  }

  return {
    wCivil,
    wSec,
    wSoc,
    craftedCount,
    totalActiveRecords,
    fullBlocks: Math.max(0, Math.floor(totalActiveRecords / 12)),
  };
}

export function computeWorkEfficiency(burg: WorkingBurg, chaosIntensity: number): number {
  let workEfficiency = 1.0;
  if (burg.occupierFactionId) workEfficiency *= 0.5;
  if (burg.unrest >= 80) workEfficiency *= 0.25;
  else if (burg.unrest >= 60) workEfficiency *= 0.6;
  if (burg.health < 40) workEfficiency *= 0.5;
  else if (burg.health < 65) workEfficiency *= 0.8;
  if (chaosIntensity >= 70) workEfficiency *= Math.max(0.25, 1 - (chaosIntensity / 100) * 0.5);
  return Math.max(0.1, Math.min(1.0, workEfficiency));
}

export function parseResourceProfile(
  burg: WorkingBurg,
  goodKeyById: Map<number, string>
): {
  primarySlots: Array<{ goodId: number; key: string; share: number }>;
  craftedSlots: Array<{ goodId: number; key: string; targetOutput: number }>;
} {
  let profile: {
    primary?: Array<{ goodId: number; key: string; share: number }>;
    crafted?: Array<{ goodId: number; key: string; targetOutput: number }>;
  } = {};
  try {
    if (burg.resourceProfile) {
      profile =
        typeof burg.resourceProfile === "string"
          ? JSON.parse(burg.resourceProfile)
          : (burg.resourceProfile as typeof profile);
    }
  } catch {
    profile = {};
  }

  const primarySlots =
    Array.isArray(profile.primary) && profile.primary.length > 0
      ? profile.primary
      : [
          { goodId: 9, key: "grain", share: 0.6 },
          { goodId: 1, key: "wood", share: 0.4 },
        ];

  const craftedSlots =
    Array.isArray(profile.crafted) && profile.crafted.length > 0
      ? profile.crafted
      : (Array.isArray(burg.production) ? burg.production : [])
          .map(([gid, out]: [number, number]) => ({
            goodId: Number(gid),
            key:
              goodKeyById.get(Number(gid)) ||
              goodKeyFromName(GOOD_ROLE_BY_ID[Number(gid)]?.goodKey || ""),
            targetOutput: Number(out) || 1,
          }))
          .filter((c) => c.goodId > 0 && c.key);

  return { primarySlots, craftedSlots };
}

/**
 * Pure primary resource gathering, baker/miller food bonus, artisanal luxRevenue & municipalCosts,
 * plus ecological pressure and missing infrastructure deficits.
 */
export function runPrimaryProduction(opts: {
  burg: WorkingBurg;
  profMap: Map<string, { records: number; people: number }>;
  bInfra: Map<string, number>;
  primarySlots: Array<{ goodId: number; key: string; share: number }>;
  workEfficiency: number;
  currentSeason: string;
  winterResilience: number;
  isFlooded: boolean;
  isDrought: boolean;
  wCivil: number;
  wSec: number;
  craftedCount: number;
  inventory: Record<string, number>;
}): {
  foodProduced: number;
  wealthDelta: number;
  cellEcoDamage: number;
  requiredInfraBuilds: Map<string, number>;
} {
  const {
    burg,
    profMap,
    bInfra,
    primarySlots,
    workEfficiency,
    currentSeason,
    winterResilience,
    isFlooded,
    isDrought,
    wCivil,
    wSec,
    craftedCount,
    inventory,
  } = opts;

  const isWinterFreeze =
    seasonKind(currentSeason) === "Winter" ||
    currentSeason === SHADOWFALL ||
    burg.currentTemp < 0;
  const winterFloor = Math.min(0.85, 0.35 + winterResilience * 0.05);
  const seasonMod = isWinterFreeze
    ? winterFloor
    : currentSeason === "Dryspell"
      ? 1.45
      : seasonKind(currentSeason) === "Spring"
        ? 1.2
        : currentSeason === "Cropfade"
          ? 0.8
          : 1.0;

  const climateHarvestMod = computeClimateHarvestModifier({
    currentTemp: burg.currentTemp,
    cellFlux: burg.cellFlux,
    riverId: burg.riverId,
    riverDischarge: burg.riverDischarge,
    isFlooded,
    isDrought,
  });

  let foodProduced = 0;
  let cellEcoDamage = 0;
  const requiredInfraBuilds = new Map<string, number>();
  const primaryByProfession = new Map<
    string,
    Array<{ goodId: number; key: string; share: number }>
  >();

  for (const slot of primarySlots) {
    const role = getProfessionForGood(Number(slot.goodId));
    const list = primaryByProfession.get(role.profession) || [];
    list.push({
      goodId: Number(slot.goodId),
      key: slot.key || role.goodKey,
      share: Math.max(0.01, Number(slot.share) || 0.1),
    });
    primaryByProfession.set(role.profession, list);
  }

  for (const [profName, slotsForProf] of primaryByProfession.entries()) {
    const profRecords = profMap.get(profName)?.records || 0;
    if (profRecords <= 0) continue;

    const sortedSlots = slotsForProf.slice().sort((a, b) => a.goodId - b.goodId);
    const totalShare = sortedSlots.reduce((s, x) => s + x.share, 0) || 1;
    const allocs = sortedSlots.map((s) => {
      const exact = profRecords * (s.share / totalShare);
      const base = Math.floor(exact);
      return { slot: s, count: base, frac: exact - base };
    });
    const rem = profRecords - allocs.reduce((s, a) => s + a.count, 0);
    const byFrac = allocs
      .slice()
      .sort((a, b) => b.frac - a.frac || a.slot.goodId - b.slot.goodId);
    for (let k = 0; k < rem && byFrac.length > 0; k++) {
      byFrac[k % byFrac.length]!.count++;
    }

    for (const { slot, count } of allocs) {
      if (count <= 0) continue;
      const role = getProfessionForGood(slot.goodId);
      const reqInfra = role.infraType === "WORKSHOP" ? "CAMP" : role.infraType;
      const infraLevel = bInfra.get(reqInfra) || 0;
      const infraCap = infraLevel * 10;
      const covered = Math.min(count, infraCap);
      const uncovered = Math.max(0, count - infraCap);

      const seasonFactor =
        role.infraType === "FARM" || role.isFood ? seasonMod * climateHarvestMod : 1.0;
      const basePerRecord = 1.0 + burg.urbanTier * 0.5;
      const yieldAmt = Math.floor(
        (covered * 2 + uncovered) * workEfficiency * seasonFactor * basePerRecord
      );
      if (yieldAmt > 0) {
        inventory[slot.key] = (inventory[slot.key] || 0) + yieldAmt;
        if (role.isFood) {
          foodProduced += Math.round(yieldAmt * Math.max(8, role.foodNutrition) * 1.6);
        }
      }
      if (uncovered > 0 && burg.cellId) {
        cellEcoDamage += uncovered;
        requiredInfraBuilds.set(reqInfra, (requiredInfraBuilds.get(reqInfra) || 0) + uncovered);
      }
    }
  }

  if (foodProduced > 0) {
    const foodProcessors =
      (profMap.get("Baker")?.records || 0) + (profMap.get("Grain Miller")?.records || 0);
    foodProduced += Math.floor(foodProcessors * 12 * workEfficiency * seasonMod * climateHarvestMod);
  }

  const luxRevenue = Math.floor(craftedCount * workEfficiency * 0.12 * (1 + burg.urbanTier * 0.2));
  const municipalCosts = Math.floor(wCivil * 0.04 + wSec * 0.04 + burg.urbanTier * 2);
  const wealthDelta = Math.max(-8, Math.min(25, luxRevenue - municipalCosts));

  return { foodProduced, wealthDelta, cellEcoDamage, requiredInfraBuilds };
}

/**
 * Pure secondary workshop recipe crafting (inputs + living crafters) and faction signature commodity
 * production. Appends shortage events and artisan citizen-tag specs cleanly.
 */
export function runWorkshopAndSpecialtyCrafting(opts: {
  burg: WorkingBurg;
  tick: number;
  factionId: number;
  profMap: Map<string, { records: number; people: number }>;
  craftedSlots: Array<{ goodId: number; key: string; targetOutput: number }>;
  workEfficiency: number;
  totalActiveRecords: number;
  goodsById: Map<number, BurgGoodSnap>;
  goodKeyById: Map<number, string>;
  inventory: Record<string, number>;
  events: BurgEventSpec[];
  tags: BurgTagSpec[];
  random: () => number;
}): { extraFoodProduced: number } {
  const {
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
  } = opts;

  let extraFoodProduced = 0;
  let workshopShortageLogged = false;

  for (const cSlot of craftedSlots) {
    const g = goodsById.get(Number(cSlot.goodId));
    const role = getProfessionForGood(Number(cSlot.goodId));
    const crafterRecords = profMap.get(role.profession)?.records || 0;
    if (crafterRecords <= 0 || !g || !Array.isArray(g.recipes) || g.recipes.length === 0) continue;

    const maxBatches = Math.max(
      1,
      Math.floor(crafterRecords * workEfficiency * (0.25 + burg.urbanTier * 0.15))
    );
    let remainingBatches = Math.min(
      maxBatches,
      Math.max(2, Math.ceil((Number(cSlot.targetOutput) || 2) * 3))
    );
    let craftedTotal = 0;

    for (const recipeObj of g.recipes) {
      if (remainingBatches <= 0 || !recipeObj || typeof recipeObj !== "object") break;
      const inputs = Object.entries(recipeObj)
        .map(([idStr, req]) => {
          const iId = Number(idStr);
          const iKey =
            goodKeyById.get(iId) || goodKeyFromName(GOOD_ROLE_BY_ID[iId]?.goodKey || "");
          return { id: iId, key: iKey, req: Number(req) || 0 };
        })
        .filter((x) => x.id > 0 && x.key && x.req > 0)
        .sort((a, b) => a.id - b.id);

      if (inputs.length === 0) continue;
      let canMake = remainingBatches;
      for (const inp of inputs) {
        canMake = Math.min(canMake, Math.floor((inventory[inp.key] || 0) / inp.req));
      }
      if (canMake > 0) {
        for (const inp of inputs) {
          const spent = Math.max(1, Math.round(canMake * inp.req));
          inventory[inp.key] = Math.max(0, (inventory[inp.key] || 0) - spent);
        }
        inventory[g.key] = (inventory[g.key] || 0) + canMake;
        craftedTotal += canMake;
        remainingBatches -= canMake;
      }
    }

    if (craftedTotal > 0 && role.isFood) {
      extraFoodProduced += craftedTotal * Math.max(8, role.foodNutrition);
    } else if (craftedTotal === 0 && !workshopShortageLogged && (tick + burg.burgId) % 30 === 0) {
      workshopShortageLogged = true;
      const neededNames = Object.keys(g.recipes[0] || {})
        .map((idStr) => goodsById.get(Number(idStr))?.name || idStr)
        .join(", ");
      events.push({
        tick,
        type: "WORKSHOP_INPUT_SHORTAGE",
        message: `${role.profession} workshops in ${burg.name} stalled on ${g.name}: awaiting inputs (${neededNames}).`,
        tier: "MINOR",
        burgId: burg.burgId,
      });
    }
  }

  const factionSpecialty = getFactionSpecialty(factionId);
  if (factionSpecialty && totalActiveRecords >= 5) {
    const inputs = factionSpecialty.requiredRawInputs || [];
    const maxBatches = Math.max(1, Math.floor((totalActiveRecords * workEfficiency) / 20));
    let possibleBatches = maxBatches;

    for (const input of inputs) {
      const stock = inventory[input.resource] || 0;
      const canMake = Math.floor(stock / Math.max(0.25, input.count));
      possibleBatches = Math.min(possibleBatches, canMake);
    }

    if (possibleBatches > 0) {
      const actualBatches = Math.min(maxBatches, possibleBatches);
      for (const input of inputs) {
        const spent = Math.max(1, Math.round(input.count * actualBatches));
        inventory[input.resource] = Math.max(0, (inventory[input.resource] || 0) - spent);
      }
      const producedSignatureGoods = actualBatches * factionSpecialty.outputPerBatch;
      inventory[factionSpecialty.uniqueGood] =
        (inventory[factionSpecialty.uniqueGood] || 0) + producedSignatureGoods;

      if ((tick + burg.burgId) % 30 === 0) {
        tags.push({
          burgId: burg.burgId,
          tags: [factionSpecialty.artisanPersonaTag],
          temper: "FOCUSED",
          motivation: `Practicing ${factionSpecialty.specialtyName} using traditional ${factionSpecialty.harvestMethod.toLowerCase()}.`,
          professionFilter: null,
          limit: 2,
          randomSeed: random(),
        });
      }
    }
  }

  return { extraFoodProduced };
}
