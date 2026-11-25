import { type CommodityCategory, getGoodsByCategory } from "../../economy/factionSpecialties.js";
import { tryConsume } from "./health.js";
import type {
  ActiveProjectCreateSpec,
  BurgActiveProjectSnap,
  BurgEventSpec,
  InfraBuildSpec,
  WorkingBurg,
} from "./types.js";

/**
 * Pure active-project tick advancement: decrements timers, promotes completed URBAN_TIER projects,
 * and returns remaining active project keys plus whether `sim_active_projects` needs advancing.
 */
export function advanceActiveProjects(opts: {
  activeProjects: BurgActiveProjectSnap[];
  burgById: Map<number, WorkingBurg>;
  tick: number;
  events: BurgEventSpec[];
}): { shouldAdvanceAll: boolean; activeProjectsSet: Set<string> } {
  const { activeProjects, burgById, tick, events } = opts;
  const activeProjectsSet = new Set<string>();
  const shouldAdvanceAll = activeProjects.length > 0;

  for (const proj of activeProjects) {
    const remaining = proj.ticksRemaining - 1;
    if (remaining <= 0) {
      if (proj.projectType === "URBAN_TIER") {
        const b = burgById.get(proj.burgId);
        if (b) {
          b.urbanTier = proj.targetTier;
          b.origUrbanTier = proj.targetTier;
        }
        const tierName =
          proj.targetTier === 2
            ? "Village"
            : proj.targetTier === 3
              ? "Town"
              : proj.targetTier === 4
                ? "City"
                : "Metropolis";
        events.push({
          tick,
          type: "BURG_URBAN_GROWTH",
          message: `Construction completed in burg ${proj.burgId}: officially elevated to Tier ${proj.targetTier} (${tierName})! New artisan workshops and civil infrastructure erected.`,
          tier: "MAJOR",
          burgId: proj.burgId,
        });
      }
    } else {
      activeProjectsSet.add(`${proj.burgId}_${proj.projectType}`);
    }
  }

  return { shouldAdvanceAll, activeProjectsSet };
}

/**
 * Auto-builds extraction infrastructure to halt ecological pressure when timber & wealth permit.
 */
export function planAutoInfrastructureBuilds(opts: {
  burg: WorkingBurg;
  requiredInfraBuilds: Map<string, number>;
  inventory: Record<string, number>;
  infraBuilds: Map<string, InfraBuildSpec>;
  ecoMaxReductions: Map<number, number>;
}): void {
  const { burg, requiredInfraBuilds, inventory, infraBuilds, ecoMaxReductions } = opts;
  for (const [infraType, deficit] of requiredInfraBuilds.entries()) {
    if (deficit >= 10 && (inventory.wood || 0) >= 20 && (burg.wealth || 0) >= 20) {
      inventory.wood = Math.max(0, (inventory.wood || 0) - 20);
      const k = `${burg.burgId}:${infraType}`;
      const existing = infraBuilds.get(k);
      if (existing) existing.inc += 1;
      else {
        infraBuilds.set(k, {
          burgId: burg.burgId,
          cellId: burg.cellId,
          type: infraType,
          inc: 1,
        });
      }
      if (burg.cellId) {
        ecoMaxReductions.set(burg.cellId, (ecoMaxReductions.get(burg.cellId) || 0) + 1);
      }
    }
  }
}

/**
 * Resolves biome architecture type fallback and initiates queued URBAN_TIER charter upgrades
 * when population, wealth, materials, and specialty commodities are met.
 */
export function evaluateUrbanTierUpgrade(opts: {
  burg: WorkingBurg;
  newWealth: number;
  tick: number;
  activeProjectsSet: Set<string>;
  inventory: Record<string, number>;
  newActiveProjects: ActiveProjectCreateSpec[];
  events: BurgEventSpec[];
}): { newWealth: number; archType: string } {
  const { burg, tick, activeProjectsSet, inventory, newActiveProjects, events } = opts;
  let newWealth = opts.newWealth;
  const pop = burg.popNull;
  const urbanTier = burg.urbanTier;
  const popThreshold =
    urbanTier === 1 ? 1200 : urbanTier === 2 ? 4500 : urbanTier === 3 ? 12000 : 999999;

  let archType = burg.architectureType || "";
  if (!archType || archType === "MIXED") {
    const bId = Number(burg.biome ?? 4);
    if ([1, 2, 12].includes(bId)) archType = "CLAY";
    else if ([0, 10, 11].includes(bId)) archType = "STONE";
    else archType = "WOOD";
  }

  if (pop >= popThreshold) {
    const getBest = (mats: string[], req: number): string | null => {
      let best: string | null = null;
      let max = -1;
      for (const m of mats) {
        const amt = inventory[m] || 0;
        if (amt >= req && amt > max) {
          best = m;
          max = amt;
        }
      }
      return best;
    };

    const deductMat = (m: string, amt: number) => {
      if ((inventory[m] || 0) >= amt) {
        inventory[m] = Math.max(0, (inventory[m] || 0) - amt);
      }
    };

    const t1 = ["wood", "stone", "clay"];
    const t2 = ["coal", "leather", "cloth", "bronze", "tools", "ceramics", "glass", "tar"];
    const t3 = [
      "mahogany",
      "marble",
      "garments",
      "jewelry",
      "artillery",
      "sheet_metal",
      "stone_root_timber",
      "books",
    ];

    const checkCategoryCommodity = (cat: CommodityCategory, minRequired: number): string | null => {
      const candidates = getGoodsByCategory(cat);
      for (const goodKey of candidates) {
        if ((inventory[goodKey] || 0) >= minRequired) return goodKey;
      }
      return null;
    };

    if (urbanTier === 1 && newWealth >= 100 && !activeProjectsSet.has(`${burg.burgId}_URBAN_TIER`)) {
      const b1 = getBest(t1, 100);
      const b2 = getBest(t2, 50);
      const presGood =
        checkCategoryCommodity("PRESERVATION", 15) || checkCategoryCommodity("LOGISTICS", 15);

      if (b1 && b2 && presGood) {
        deductMat(b1, 100);
        deductMat(b2, 50);
        deductMat(presGood, 15);
        newWealth -= 100;
        archType = b1.toUpperCase();
        newActiveProjects.push({
          burgId: burg.burgId,
          projectType: "URBAN_TIER",
          targetTier: 2,
          ticksRemaining: 20,
        });
        activeProjectsSet.add(`${burg.burgId}_URBAN_TIER`);
        events.push({
          tick,
          type: "PROJECT_COMMENCED",
          message: `Municipal expansion begun in ${burg.name}: construction crews commenced Village fortification and masonry works utilizing ${presGood.replace(/_/g, " ")} (20 days).`,
          tier: "MINOR",
          burgId: burg.burgId,
        });
      } else if (b1 && b2 && !presGood && (tick + burg.burgId) % 25 === 0) {
        events.push({
          tick,
          type: "COMMODITY_SHORTAGE_STALL",
          message: `📦 TRADE REQUISITION: Town charter in ${burg.name} stalled! Builders require preservation/logistics imports (Salt, Pitch, or Amber-Grain) from regional trading partners.`,
          tier: "MINOR",
          burgId: burg.burgId,
        });
      }
    } else if (
      urbanTier === 2 &&
      newWealth >= 200 &&
      !activeProjectsSet.has(`${burg.burgId}_URBAN_TIER`)
    ) {
      const b2 = getBest(t2, 200);
      const b3 = getBest(t3, 50);
      const structGood = checkCategoryCommodity("STRUCTURAL", 20);
      const foundGood = checkCategoryCommodity("FOUNDATION", 20);

      if (b2 && b3 && structGood && foundGood) {
        deductMat(b2, 200);
        deductMat(b3, 50);
        deductMat(structGood, 20);
        deductMat(foundGood, 20);
        newWealth -= 200;
        archType = ["tar", "leather", "cloth"].includes(b2)
          ? "WOOD"
          : ["glass", "tools", "bronze"].includes(b2)
            ? "STONE"
            : "CLAY";
        newActiveProjects.push({
          burgId: burg.burgId,
          projectType: "URBAN_TIER",
          targetTier: 3,
          ticksRemaining: 20,
        });
        activeProjectsSet.add(`${burg.burgId}_URBAN_TIER`);
        events.push({
          tick,
          type: "PROJECT_COMMENCED",
          message: `Urban charter expansion begun in ${burg.name}: master builders commenced Town guildhalls and stone ramparts utilizing ${structGood.replace(/_/g, " ")} and ${foundGood.replace(/_/g, " ")} (20 days).`,
          tier: "MINOR",
          burgId: burg.burgId,
        });
      } else if (b2 && b3 && (!structGood || !foundGood) && (tick + burg.burgId) % 25 === 0) {
        const missing =
          !structGood && !foundGood
            ? "structural alloy and foundation mortar"
            : !structGood
              ? "structural alloy/ironwood"
              : "hydraulic foundation mortar";
        events.push({
          tick,
          type: "COMMODITY_SHORTAGE_STALL",
          message: `🏛️ ARCHITECTURAL IMPASSE: City wall construction in ${burg.name} halted! Master masons lack required ${missing} from foreign trade partners.`,
          tier: "MINOR",
          burgId: burg.burgId,
        });
      }
    } else if (
      urbanTier === 3 &&
      newWealth >= 500 &&
      !activeProjectsSet.has(`${burg.burgId}_URBAN_TIER`)
    ) {
      const b3 = getBest(t3, 300);
      const lux =
        (inventory.jewelry || 0) +
        (inventory.perfume || 0) +
        (inventory.wine || 0) +
        (inventory.candles || 0) +
        (inventory.tea || 0);
      const advGood = checkCategoryCommodity("ADVANCED", 25);
      const metaGood =
        checkCategoryCommodity("METAPHYSICAL", 20) ||
        checkCategoryCommodity("HEALTH", 20) ||
        checkCategoryCommodity("ENERGY", 20);

      if (b3 && lux >= 100 && advGood && metaGood) {
        deductMat(b3, 300);
        tryConsume(inventory, ["jewelry", "perfume", "wine", "candles", "tea"], 100);
        deductMat(advGood, 25);
        deductMat(metaGood, 20);
        newWealth -= 500;
        newActiveProjects.push({
          burgId: burg.burgId,
          projectType: "URBAN_TIER",
          targetTier: 4,
          ticksRemaining: 20,
        });
        activeProjectsSet.add(`${burg.burgId}_URBAN_TIER`);
        events.push({
          tick,
          type: "PROJECT_COMMENCED",
          message: `Metropolitan charter expansion begun in ${burg.name}: grand architects commenced City high ramparts, cathedral spires, and grand avenues reinforced with ${advGood.replace(/_/g, " ")} and ${metaGood.replace(/_/g, " ")} (20 days).`,
          tier: "MAJOR",
          burgId: burg.burgId,
        });
      } else if (b3 && lux >= 100 && (!advGood || !metaGood) && (tick + burg.burgId) % 25 === 0) {
        events.push({
          tick,
          type: "COMMODITY_SHORTAGE_STALL",
          message: `👑 METROPOLITAN IMPASSE: High cathedral and observatory spire construction in ${burg.name} stalled awaiting advanced optical glass or celestial ward crystals!`,
          tier: "MINOR",
          burgId: burg.burgId,
        });
      }
    }
  }

  return { newWealth, archType };
}
