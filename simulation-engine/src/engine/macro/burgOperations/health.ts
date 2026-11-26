import type { SystemicItemEffect } from "../../economy/itemSystemicMatrix.js";
import { econPop } from "./types.js";
import type {
  BurgEventSpec,
  BurgTagSpec,
  WorkingBurg,
  WorkingOutlaw,
} from "./types.js";

function fnv1a32(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function pickShuffledOutlawAndSiphon(
  workingOutlaws: WorkingOutlaw[],
  outlawManpowerDeltas: Map<number, number>,
  delta: number,
  random: () => number
): void {
  if (delta <= 0) return;
  const salt = Math.floor(random() * 2147483647);
  const eligible = workingOutlaws.filter((o) => o.manpower < 2500);
  if (eligible.length === 0) return;
  eligible.sort((a, b) => {
    const ha = fnv1a32(`${a.id}:${salt}`);
    const hb = fnv1a32(`${b.id}:${salt}`);
    return ha - hb || a.id - b.id;
  });
  const picked = eligible[0]!;
  const before = picked.manpower;
  picked.manpower = Math.min(2500, picked.manpower + delta);
  const actual = picked.manpower - before;
  if (actual > 0) {
    outlawManpowerDeltas.set(picked.id, (outlawManpowerDeltas.get(picked.id) || 0) + actual);
  }
}

export function consumeSpecific(
  inventory: Record<string, number>,
  targetSet: Set<string>,
  amount: number
): number {
  let remaining = amount;
  const keys = Object.keys(inventory)
    .filter((k) => targetSet.has(k) && (inventory[k] || 0) > 0)
    .sort((a, b) => (inventory[b] || 0) - (inventory[a] || 0) || a.localeCompare(b));
  for (const k of keys) {
    if (remaining <= 0) break;
    const take = Math.min(inventory[k] || 0, remaining);
    inventory[k] = (inventory[k] || 0) - take;
    remaining -= take;
  }
  return remaining;
}

export function tryConsume(
  inventory: Record<string, number>,
  acceptableKeys: string[],
  amount: number
): number {
  let remaining = amount;
  for (const key of acceptableKeys) {
    if (remaining <= 0) break;
    if (inventory[key] && inventory[key]! > 0) {
      const take = Math.min(inventory[key]!, remaining);
      inventory[key]! -= take;
      remaining -= take;
    }
  }
  return remaining;
}

export function evaluateCivilEquilibrium(opts: {
  burg: WorkingBurg;
  foodDelta: number;
  wCivil: number;
  wSec: number;
  wSoc: number;
  systemicEffects: Pick<SystemicItemEffect, "healthDelta" | "unrestDelta" | "crimeDelta">;
}): { healthDelta: number; unrestDelta: number; crimeDelta: number } {
  const { burg, foodDelta, wCivil, wSec, wSoc, systemicEffects } = opts;
  const pop = econPop(burg);
  const currentUnrest = burg.unrest;
  const currentCrime = burg.crimeRate;
  const currentHealth = burg.health;

  const healthDelta = Math.min(
    4,
    Math.max(
      -4,
      Math.floor(wCivil * 0.08) -
        ((burg.health || 100) > 80 ? 0 : 1) +
        (systemicEffects.healthDelta || 0)
    )
  );

  let baseUnrestDelta = 0;
  const isWellFed = (burg.food || 0) + foodDelta >= pop * 1.1;
  const isHealthy = currentHealth >= 50;
  const isLowCrime = currentCrime < 45;

  if (isWellFed && isHealthy && isLowCrime) {
    baseUnrestDelta = -Math.max(1, Math.floor(wSoc * 0.05));
    if (currentUnrest > 50) baseUnrestDelta -= 2;
    else if (currentUnrest > 35) baseUnrestDelta -= 1;
  } else if ((burg.food || 0) + foodDelta < pop * 0.5) {
    baseUnrestDelta = 2;
  }

  if (currentCrime >= 60) {
    baseUnrestDelta += 1;
  }

  if (currentUnrest > 60) {
    baseUnrestDelta -= 2;
  } else if (currentUnrest > 50) {
    baseUnrestDelta -= 1;
  }

  const unrestDelta = Math.min(6, Math.max(-6, baseUnrestDelta + (systemicEffects.unrestDelta || 0)));
  const crimeDelta = Math.min(
    4,
    Math.max(
      -4,
      // Calm towns cool off by themselves; before, crime only fell where there were security workers,
      // so small settlements ratcheted up to 100 and stayed there.
      -Math.floor(wSec * 0.08) + (currentUnrest > 70 ? 1 : 0) - (currentUnrest < 50 ? 1 : 0) + (systemicEffects.crimeDelta || 0)
    )
  );

  return { healthDelta, unrestDelta, crimeDelta };
}

export function applyChaosAndSpecialtyRemedies(opts: {
  burg: WorkingBurg;
  chaosIntensity: number;
  healthDelta: number;
  unrestDelta: number;
  crimeDelta: number;
  inventory: Record<string, number>;
}): { healthDelta: number; unrestDelta: number; crimeDelta: number } {
  const { burg, chaosIntensity, inventory } = opts;
  let { healthDelta, unrestDelta, crimeDelta } = opts;

  if (chaosIntensity >= 70) {
    healthDelta -= Math.floor((chaosIntensity - 55) * 0.12);
    unrestDelta += Math.floor((chaosIntensity - 55) * 0.15);
  }

  if (
    chaosIntensity >= 70 &&
    ((inventory.aether_clear || 0) >= 1 || (inventory.chaos_resistant_compound || 0) >= 1)
  ) {
    if (inventory.aether_clear) inventory.aether_clear -= 1;
    else {
      inventory.chaos_resistant_compound = Math.max(
        0,
        (inventory.chaos_resistant_compound || 0) - 1
      );
    }
    healthDelta += 2;
    unrestDelta = Math.max(-2, unrestDelta - 2);
  }

  if (
    (burg.health || 100) < 55 &&
    ((inventory.grave_berries || 0) >= 1 || (inventory.sumpkin_pharmaceutical_chems || 0) >= 1)
  ) {
    if (inventory.grave_berries) inventory.grave_berries -= 1;
    else {
      inventory.sumpkin_pharmaceutical_chems = Math.max(
        0,
        (inventory.sumpkin_pharmaceutical_chems || 0) - 1
      );
    }
    healthDelta += 3;
    unrestDelta -= 1;
  }

  if ((inventory.perfume || 0) >= 2) {
    crimeDelta = Math.max(-3, crimeDelta - 1);
    if (burg.unrest > 45) unrestDelta -= 1;
  }

  return { healthDelta, unrestDelta, crimeDelta };
}

export function applyMaintenanceAndNeeds(opts: {
  burg: WorkingBurg;
  tick: number;
  fullBlocks: number;
  military: Record<string, number>;
  rawKeys: Set<string>;
  refinedKeys: Set<string>;
  advancedKeys: Set<string>;
  inventory: Record<string, number>;
  workingOutlaws: WorkingOutlaw[];
  outlawManpowerDeltas: Map<number, number>;
  random: () => number;
  healthDelta: number;
  unrestDelta: number;
}): { healthDelta: number; unrestDelta: number } {
  const {
    burg,
    tick,
    fullBlocks,
    military,
    rawKeys,
    refinedKeys,
    advancedKeys,
    inventory,
    workingOutlaws,
    outlawManpowerDeltas,
    random,
  } = opts;
  let { healthDelta, unrestDelta } = opts;
  const pop = econPop(burg);
  const urbanTier = burg.urbanTier;

  let failedMaint = 0;
  if (urbanTier === 2) failedMaint = consumeSpecific(inventory, rawKeys, fullBlocks);
  else if (urbanTier === 3) failedMaint = consumeSpecific(inventory, refinedKeys, fullBlocks);
  else if (urbanTier >= 4) failedMaint = consumeSpecific(inventory, advancedKeys, fullBlocks);

  if (failedMaint > 0) {
    healthDelta -= 1;
    if (failedMaint > 5) unrestDelta += 1;
  }

  let supplyDeficit = 0;
  supplyDeficit += tryConsume(inventory, ["arms", "leather", "tools", "iron"], military.infantry || 0);
  supplyDeficit += tryConsume(inventory, ["arms", "wood", "leather", "ropes"], military.ranged || 0);
  supplyDeficit += tryConsume(inventory, ["horses", "camels", "tack", "leather"], military.mounted || 0);
  supplyDeficit += tryConsume(
    inventory,
    ["aether_skiffs", "sails", "ropes", "tar", "dragonstone"],
    military.airship || 0
  );
  supplyDeficit += tryConsume(inventory, ["aether_clear", "incense", "wine", "candles"], military.mage || 0);

  if (supplyDeficit > 0) {
    if (supplyDeficit > 10) unrestDelta += 1;
    if (supplyDeficit >= 15 && (tick + burg.burgId) % 15 === 0) {
      const deserters = Math.min(4, Math.floor(supplyDeficit * 0.05));
      if (deserters > 0) {
        pickShuffledOutlawAndSiphon(workingOutlaws, outlawManpowerDeltas, deserters, random);
      }
    }
  }

  if (pop > 5000) {
    const neededComfort = Math.ceil((pop - 5000) / 1000);
    const comfortDeficit = tryConsume(
      inventory,
      ["garments", "cloth", "boots", "soap", "aether_clear", "grave_berries"],
      neededComfort
    );
    if (comfortDeficit > 5) {
      healthDelta -= 1;
      if (comfortDeficit > 15) unrestDelta += 1;
    }
  }
  if (pop > 20000) {
    const neededLuxury = Math.ceil((pop - 20000) / 2000);
    const luxuryDeficit = tryConsume(
      inventory,
      ["wine", "beer", "liquor", "jewelry", "ceramics", "perfume", "candles", "tea"],
      neededLuxury
    );
    if (luxuryDeficit > 10 && burg.unrest < 35) {
      unrestDelta += 1;
    }
  }

  return { healthDelta, unrestDelta };
}

export function resolveOccupationAndResistance(opts: {
  burg: WorkingBurg;
  tick: number;
  military: Record<string, number>;
  inventory: Record<string, number>;
  occTraits: unknown;
  events: BurgEventSpec[];
  cellFactionSets: Map<number, number | null>;
  random: () => number;
}): { popNullDeltaInc: number; departedDeadInc: number } {
  const { burg, tick, military, inventory, occTraits, events, cellFactionSets, random } = opts;
  if (!burg.occupierFactionId) return { popNullDeltaInc: 0, departedDeadInc: 0 };

  let popNullDeltaInc = 0;
  let departedDeadInc = 0;
  const occTicks = (burg.occupationTicks || 0) + 1;
  let resPwr = burg.resistanceStrength || 50;

  if ((burg.crimeRate || 0) > 20 && ((inventory.narcotic || 0) >= 5 || (inventory.poison || 0) >= 5)) {
    if (inventory.narcotic) inventory.narcotic = Math.max(0, inventory.narcotic - 5);
    resPwr += 15;
  }

  const isBrutal =
    Array.isArray(occTraits) &&
    (occTraits.includes("Bloodthirsty") ||
      occTraits.includes("Paranoid") ||
      occTraits.includes("Ruthless"));

  if (isBrutal) {
    popNullDeltaInc -= 25;
    departedDeadInc += 25;
    resPwr = Math.max(0, resPwr - 15);
    if (random() < 0.15) {
      events.push({
        tick,
        type: "MASS_EXECUTION",
        message: `Occupying garrison executed suspected resistance sympathizers in ${burg.name} in a brutal curfew raid.`,
        tier: "MINOR",
        burgId: burg.burgId,
      });
    }
  } else {
    if ((inventory.grain || 0) >= 40) {
      inventory.grain = Math.max(0, (inventory.grain || 0) - 40);
      resPwr = Math.max(0, resPwr - 20);
    } else {
      resPwr += 10;
    }
  }

  let curFootmen = military.infantry || military.footmen || 0;
  const riotDeaths = Math.floor(resPwr * 0.05);
  popNullDeltaInc -= riotDeaths;
  departedDeadInc += riotDeaths;
  curFootmen = Math.max(0, curFootmen - Math.floor(resPwr * 0.15));
  if (military.infantry !== undefined) military.infantry = curFootmen;
  else military.footmen = curFootmen;

  burg.occupationTouched = true;
  if (curFootmen <= 0) {
    if (burg.cellId) cellFactionSets.set(burg.cellId, null);
    burg.occupierFactionId = null;
    burg.occupationTicks = 0;
    burg.resistanceStrength = 0;
    if (military.infantry !== undefined) military.infantry = 100;
    else military.footmen = 100;
    events.push({
      tick,
      type: "LIBERATION",
      message: `Citizens of ${burg.name} successfully overwhelmed the occupying garrison and proclaimed self-liberation!`,
      tier: "MAJOR",
      burgId: burg.burgId,
    });
  } else if (occTicks >= 28) {
    const conqueror = burg.occupierFactionId;
    if (burg.cellId) cellFactionSets.set(burg.cellId, conqueror);
    events.push({
      tick,
      type: "CONQUEST",
      message: `Occupying forces pacified all resistance in ${burg.name}. The settlement was officially annexed into Faction ${conqueror}.`,
      tier: "MAJOR",
      burgId: burg.burgId,
    });
    burg.occupierFactionId = null;
    burg.occupationTicks = 0;
    burg.resistanceStrength = 0;
  } else {
    burg.occupationTicks = occTicks;
    burg.resistanceStrength = resPwr;
  }

  return { popNullDeltaInc, departedDeadInc };
}

export function evaluateCivicAndCrisisEvents(opts: {
  burg: WorkingBurg;
  tick: number;
  chaosIntensity: number;
  foodDelta: number;
  newFood: number;
  newHealth: number;
  newUnrest: number;
  starvationDeaths: number;
  banditDefectors: number;
  receivedTribute: { food: number; wealth: number } | undefined;
  popNullDelta: number;
  departedLeft: number;
  workingOutlaws: WorkingOutlaw[];
  outlawManpowerDeltas: Map<number, number>;
  events: BurgEventSpec[];
  tags: BurgTagSpec[];
  random: () => number;
}): { newFood: number; popNullDelta: number; departedLeft: number } {
  const {
    burg,
    tick,
    chaosIntensity,
    foodDelta,
    newHealth,
    newUnrest,
    starvationDeaths,
    banditDefectors,
    receivedTribute,
    workingOutlaws,
    outlawManpowerDeltas,
    events,
    tags,
    random,
  } = opts;
  let { newFood, popNullDelta, departedLeft } = opts;

  if (starvationDeaths > 0) {
    events.push({
      tick,
      type: "BURG_FAMINE",
      message: `Severe famine strikes ${burg.name}: food supplies collapsed with a ${Math.abs(foodDelta)} bushel deficit. ${starvationDeaths} citizens died of starvation!`,
      tier: "MAJOR",
      burgId: burg.burgId,
    });
    if (tick % 5 === 0) {
      tags.push({
        burgId: burg.burgId,
        tags: ["#FamineStricken", "#DesperateRationing"],
        temper: "DESPERATE",
        motivation: `Desperately searching for grain in ${burg.name} after severe famine struck.`,
        professionFilter: null,
        limit: 6,
        randomSeed: random(),
      });
    }
  } else if (newFood === 0 && (burg.food || 0) > 0) {
    events.push({
      tick,
      type: "BURG_FAMINE",
      message: `Granaries run completely dry in ${burg.name}! Food deficit reaches ${Math.abs(foodDelta)}. Citizens face imminent starvation.`,
      tier: "MAJOR",
      burgId: burg.burgId,
    });
    if (tick % 5 === 0) {
      tags.push({
        burgId: burg.burgId,
        tags: ["#FamineStricken", "#BreadRioter"],
        temper: "ANGRY",
        motivation: `Threatening to storm the municipal granaries of ${burg.name} as bread supplies ran out.`,
        professionFilter: "%laborer%",
        limit: 4,
        randomSeed: random(),
      });
    }
  }

  if (burg.urbanTier > (burg.origUrbanTier || 1)) {
    const tierName =
      burg.urbanTier === 2
        ? "Village"
        : burg.urbanTier === 3
          ? "Town"
          : burg.urbanTier === 4
            ? "City"
            : "Metropolis";
    events.push({
      tick,
      type: "BURG_URBAN_GROWTH",
      message: `Settlement boom in ${burg.name}: population and trade advanced the settlement to Tier ${burg.urbanTier} (${tierName})! New artisan workshops and civil infrastructure erected.`,
      tier: "MAJOR",
      burgId: burg.burgId,
    });
    tags.push({
      burgId: burg.burgId,
      tags: ["#BoomtownCitizen", "#MasterArtisan"],
      temper: "INSPIRED",
      motivation: `Expanding craft workshops to meet the boom of ${burg.name}'s new urban charter.`,
      professionFilter: null,
      limit: 4,
      randomSeed: random(),
    });
  }

  if (newUnrest >= 45 && (burg.unrest || 0) < 45) {
    events.push({
      tick,
      type: "MARTIAL_LAW_DECLARED",
      message: `Martial law declared in ${burg.name}: civil unrest spiked to ${newUnrest}%. City Watch patrols double to suppress insurrection.`,
      tier: "MAJOR",
      burgId: burg.burgId,
    });
    tags.push({
      burgId: burg.burgId,
      tags: ["#CurfewDefier", "#AgitatedCitizen"],
      temper: "REBELLIOUS",
      motivation: `Joining secret assemblies in ${burg.name} to resist marshal patrols.`,
      professionFilter: "%laborer%",
      limit: 4,
      randomSeed: random(),
    });
    tags.push({
      burgId: burg.burgId,
      tags: ["#CurfewEnforcer", "#VigilantGuard"],
      temper: "WARY",
      motivation: `Patrolling the avenues of ${burg.name} under martial law curfews.`,
      professionFilter: "%watch%",
      limit: 4,
      randomSeed: random(),
    });
  }

  if (banditDefectors > 0) {
    popNullDelta -= banditDefectors;
    departedLeft += banditDefectors;
    const siphonedBandits = Math.min(10, banditDefectors);
    pickShuffledOutlawAndSiphon(workingOutlaws, outlawManpowerDeltas, siphonedBandits, random);

    const supplyLooted = Math.min(newFood, Math.floor(banditDefectors * 8));
    newFood = Math.max(0, newFood - supplyLooted);

    if ((tick + burg.burgId) % 3 === 0) {
      events.push({
        tick,
        burgId: burg.burgId,
        type: "BANDIT_RAIDERS_EMERGE",
        tier: "MAJOR",
        message: `⚔️ HIGHWAY ROBBERY: ${banditDefectors} starving laborers and military deserters from ${burg.name} formed an outlaw raiding party, siphoning ${supplyLooted} food from regional supply lines!`,
      });
      tags.push({
        burgId: burg.burgId,
        tags: ["#WildernessBandit", "#DeserterOutlaw"],
        temper: "DESPERATE",
        motivation: `Fled the famine and watch oppression in ${burg.name} to survive as a highwayman in the hills.`,
        professionFilter: "%laborer%",
        limit: 3,
        randomSeed: random(),
      });
    }
  } else if (starvationDeaths > 3 || (newFood === 0 && foodDelta < -150) || newUnrest >= 60) {
    // Announce when trouble starts, then about monthly while it lasts (was every 5 days per burg).
    if (((burg.unrest || 0) < 60 && newUnrest >= 60) || (tick + burg.burgId) % 30 === 0) {
      events.push({
        tick,
        type: "BANDIT_RAIDERS_EMERGE",
        message: `Exiled outlaws and starving refugees driven out of ${burg.name} have formed a desperate highwayman band in the surrounding wilderness!`,
        tier: "MINOR",
        burgId: burg.burgId,
      });
      tags.push({
        burgId: burg.burgId,
        tags: ["#WildernessBandit", "#DeserterOutlaw"],
        temper: "DESPERATE",
        motivation: `Fled the famine and watch oppression in ${burg.name} to survive as a highwayman in the hills.`,
        professionFilter: "%laborer%",
        limit: 3,
        randomSeed: random(),
      });
    }
  } else if (newFood > 15000 && newUnrest < 25 && (burg.unrest || 0) >= 35 && (tick + burg.burgId) % 8 === 0) {
    events.push({
      tick,
      type: "BANDIT_AMNESTY",
      message: `Order restored in ${burg.name}: abundant granary reserves persuaded starving wilderness outlaws to surrender their arms in exchange for food rations.`,
      tier: "MINOR",
      burgId: burg.burgId,
    });
  }

  if (
    chaosIntensity >= 80 &&
    newUnrest >= 85 &&
    newHealth <= 25 &&
    newFood === 0 &&
    !burg.name.startsWith("[Ruin]")
  ) {
    const origName = burg.name;
    const refugees = Math.floor((econPop({ popNull: burg.origPopNull, popAttuned: burg.popAttuned }) || 100) * 0.85);
    popNullDelta -= refugees;
    departedLeft += refugees;
    burg.name = `[Ruin] ${origName}`;
    burg.urbanTier = 0;
    burg.nameChangedToRuin = true;
    events.push({
      tick,
      burgId: burg.burgId,
      type: "BURG_ABANDONED_TO_CHAOS",
      tier: "CRITICAL",
      message: `⚡ ABANDONED RUIN: The screaming primordial chaos flood (intensity ${chaosIntensity}%) has overwhelmed the municipal wards of ${origName}! ${refugees.toLocaleString()} citizens fled into the wilderness as refugees, leaving behind an abandoned eldritch ruin overrun by void abominations.`,
    });
    tags.push({
      burgId: burg.burgId,
      tags: ["#VoidRefugee", "#FleeingChaos"],
      temper: "TERRIFIED",
      motivation: `Fleeing the collapsing chaos-ruin of ${origName}.`,
      professionFilter: null,
      limit: 5,
      randomSeed: random(),
    });
  }

  if (
    receivedTribute &&
    (receivedTribute.food > 50 || receivedTribute.wealth > 20) &&
    (tick + burg.burgId) % 7 === 0
  ) {
    events.push({
      tick,
      type: "TRADE_CARAVAN_DELIVERY",
      message: `Trade caravan arrived in ${burg.name}: received tribute of ${receivedTribute.food} food and ${receivedTribute.wealth} trade goods from regional vassals.`,
      tier: "MINOR",
      burgId: burg.burgId,
    });
    tags.push({
      burgId: burg.burgId,
      tags: ["#ProsperousMerchant", "#CaravanPartner"],
      temper: "CONTENT",
      motivation: `Brokering lucrative distribution agreements as tributary trade arrived in ${burg.name}.`,
      professionFilter: "%trader%",
      limit: 3,
      randomSeed: random(),
    });
  }

  if (foodDelta >= 800 && newFood > 15000 && (tick + burg.burgId) % 17 === 0) {
    events.push({
      tick,
      type: "HARVEST_SURPLUS",
      message: `Bountiful harvest recorded in ${burg.name}: agricultural yield produced +${foodDelta} surplus provisions.`,
      tier: "MINOR",
      burgId: burg.burgId,
    });
    tags.push({
      burgId: burg.burgId,
      tags: ["#BountifulHarvest", "#GrainSurplusProducer"],
      temper: "CONTENT",
      motivation: `Rejoicing as agricultural harvests filled the granary towers of ${burg.name}.`,
      professionFilter: "%farmer%",
      limit: 3,
      randomSeed: random(),
    });
  }

  return { newFood, popNullDelta, departedLeft };
}
