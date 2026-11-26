import { econPop, type WorkingBurg } from "./types.js";

/** Food bought per unit of wealth on the grain market (and from abroad). */
export const GRAIN_PER_WEALTH = 25;
/** Rations a day any town can scrape from its own land once hungry, before farms are counted. */
export const SUBSISTENCE_BASE = 4000;
/** Extra subsistence rations a day per level of FARM infrastructure. */
export const SUBSISTENCE_PER_FARM = 150;

/** Food a granary can spare: anything above eight days of its own needs. */
function granaryExcess(b: WorkingBurg): number {
  return Math.max(0, (b.food || 0) - (econPop(b) || 100) * 8);
}

/**
 * Computes food balance with faction breadbasket grain relief, trade blockade penalty,
 * commercial grain imports, upstream/downstream tributary shipments, and garrison ration upkeep.
 */
export function applyFoodAndTributeFlows(opts: {
  burg: WorkingBurg;
  workingBurgs: WorkingBurg[];
  factionId: number;
  isTradeBlockaded: boolean;
  incomingTributes: Map<number, { food: number; wealth: number }>;
  foodProduced: number;
  wealthDelta: number;
  military: Record<string, number>;
  /** FARM infrastructure level, which raises subsistence capacity. */
  farmLevel?: number;
}): {
  foodDelta: number;
  wealthDelta: number;
  receivedTribute: { food: number; wealth: number } | undefined;
  marketBought: number;
  subsistence: number;
} {
  const {
    burg,
    workingBurgs,
    factionId,
    isTradeBlockaded,
    incomingTributes,
    foodProduced,
    military,
  } = opts;
  let wealthDelta = opts.wealthDelta;
  let marketBought = 0;
  let subsistence = 0;
  const pop = econPop(burg);

  // The garrison eats too. Rations used to be subtracted after the relief check below, so relief only
  // covered civilians and garrisoned towns slid into famine every day.
  const milInfantry = military.infantry || military.footmen || military.militia || 0;
  const milRanged = military.ranged || military.archers || 0;
  const milMounted = military.mounted || military.cavalry || 0;
  const milAirship = military.airship || 0;
  const milMage = military.mage || 0;
  const milRationUpkeep = Math.round(
    milInfantry * 1.2 +
      milRanged * 1.2 +
      milMounted * 2.0 +
      milAirship * 2.5 +
      milMage * 2.0
  );
  let foodDelta = foodProduced - pop - milRationUpkeep;

  if ((burg.food || 0) + foodDelta < pop * 2) {
    let deficit = Math.round(pop * 2 - ((burg.food || 0) + foodDelta));
    if (isTradeBlockaded) {
      wealthDelta = Math.min(0, wealthDelta - 4);
    } else {
      // Relief comes from the faction's fullest granary (any granary for an unaligned town). It used to
      // take the first match only, often already drained, so towns starved beside full stores.
      const hasSurplus = (b: WorkingBurg) =>
        b.burgId !== burg.burgId && (b.food || 0) > (econPop(b) || 100) * 8;
      const sameFaction = (b: WorkingBurg) =>
        factionId ? (b.occupierFactionId || b.factionId) === factionId : true;
      const fullest = (pred: (b: WorkingBurg) => boolean) =>
        workingBurgs.reduce<WorkingBurg | undefined>(
          (best, b) => (pred(b) && hasSurplus(b) && (!best || (b.food || 0) > (best.food || 0)) ? b : best),
          undefined
        );
      const breadbasket = fullest(sameFaction);
      if (breadbasket) {
        const grainRelief = Math.min(
          deficit,
          Math.floor(((breadbasket.food || 0) - (econPop(breadbasket) || 100) * 4) * 0.15)
        );
        if (grainRelief > 0) {
          foodDelta += grainRelief;
          deficit -= grainRelief;
          breadbasket.food = Math.max(0, (breadbasket.food || 0) - grainRelief);
        }
      }
      // Grain market: whatever relief did not cover, the town buys from the fullest surplus granary of
      // any faction, and the seller is paid. Only when no granary anywhere has surplus does grain come
      // "from abroad" (created), as all purchases used to.
      if (deficit > 0 && (burg.wealth || 0) > 25) {
        let budget = Math.min(deficit, ((burg.wealth || 0) - 25) * GRAIN_PER_WEALTH);
        const seller = workingBurgs.reduce<WorkingBurg | undefined>(
          (best, b) =>
            b.burgId !== burg.burgId && granaryExcess(b) > 0 && (!best || (b.food || 0) > (best.food || 0)) ? b : best,
          undefined
        );
        if (seller && budget > 0) {
          const bought = Math.min(budget, Math.floor(granaryExcess(seller) * 0.25));
          if (bought > 0) {
            const price = Math.ceil(bought / GRAIN_PER_WEALTH);
            foodDelta += bought;
            deficit -= bought;
            budget -= bought;
            marketBought += bought;
            wealthDelta -= price;
            seller.food = Math.max(0, (seller.food || 0) - bought);
            seller.wealth = (seller.wealth || 0) + price;
          }
        } else if (budget > 0) {
          foodDelta += budget;
          deficit -= budget;
          marketBought += budget;
          wealthDelta -= Math.ceil(budget / GRAIN_PER_WEALTH);
        }
      }
    }
  }

  // Farm hiring: if the town still cannot cover what it eats today, idle hands work the land. Any town
  // can raise SUBSISTENCE_BASE rations a day, more with farms. Big cities with little farmland used to
  // starve outright; now they shrink toward what their land, faction and the market can feed.
  const shortToday = -((burg.food || 0) + foodDelta);
  if (shortToday > 0) {
    const capacity = SUBSISTENCE_BASE + Math.max(0, opts.farmLevel || 0) * SUBSISTENCE_PER_FARM;
    subsistence = Math.min(shortToday, capacity);
    foodDelta += subsistence;
  }

  if (burg.upstreamBurgId) {
    const shipRate = burg.parentBurgId
      ? 0.25
      : burg.urbanTier === 1
        ? 0.2
        : burg.urbanTier === 2
          ? 0.15
          : 0.1;
    const foodShipment = foodDelta > 0 ? Math.floor(foodDelta * shipRate) : 0;
    const wealthShipment = wealthDelta > 0 ? Math.floor(wealthDelta * shipRate) : 0;

    if (foodShipment > 0 || wealthShipment > 0) {
      foodDelta -= foodShipment;
      wealthDelta -= wealthShipment;
      const existing = incomingTributes.get(burg.upstreamBurgId) || { food: 0, wealth: 0 };
      existing.food += foodShipment;
      existing.wealth += wealthShipment;
      incomingTributes.set(burg.upstreamBurgId, existing);
    }
  }

  const receivedTribute = incomingTributes.get(burg.burgId);
  if (receivedTribute) {
    foodDelta += receivedTribute.food;
    wealthDelta += receivedTribute.wealth;
  }

  return { foodDelta, wealthDelta, receivedTribute, marketBought, subsistence };
}

/**
 * Resolves garrison desertion, civilian starvation deaths, and bandit defectors when food goes negative.
 */
export function resolveStarvation(opts: {
  burg: WorkingBurg;
  foodDelta: number;
  totalPop: number;
  military: Record<string, number>;
  healthDelta: number;
  unrestDelta: number;
  crimeDelta: number;
}): {
  healthDelta: number;
  unrestDelta: number;
  crimeDelta: number;
  starvationDeaths: number;
  banditDefectors: number;
} {
  const { burg, foodDelta, totalPop, military } = opts;
  let { healthDelta, unrestDelta, crimeDelta } = opts;
  let starvationDeaths = 0;
  let banditDefectors = 0;

  if ((burg.food || 0) + foodDelta < 0) {
    healthDelta -= 3;
    unrestDelta += 4;
    crimeDelta += 3;

    let shortfall = Math.abs((burg.food || 0) + foodDelta);
    for (const type of Object.keys(military)) {
      if ((military[type] || 0) > 0 && shortfall > 0) {
        const desertion = Math.min(military[type]!, Math.ceil(shortfall / 200));
        military[type]! -= desertion;
        shortfall -= desertion * 200;
      }
    }

    if (shortfall > 0) {
      starvationDeaths = Math.min(totalPop, Math.max(1, Math.floor(shortfall * 0.001)));
      banditDefectors = Math.min(
        Math.floor(econPop(burg) * 0.04),
        Math.max(0, Math.floor(shortfall * 0.004))
      );
    }
  }

  return { healthDelta, unrestDelta, crimeDelta, starvationDeaths, banditDefectors };
}

/**
 * Applies 25-day granary spoilage (10% rot on excess) and 4% commercial wealth circulation caps.
 */
export function applyGranaryAndCirculationCaps(
  food: number,
  wealth: number,
  pop: number
): { newFood: number; newWealth: number } {
  let newFood = Math.floor(Math.max(0, food));
  let newWealth = Math.floor(Math.max(0, wealth));

  const maxGranary = Math.max(1200, pop * 25);
  if (newFood > maxGranary) {
    newFood -= Math.floor((newFood - maxGranary) * 0.1);
  }

  const maxCommercialReserves = Math.max(800, pop * 5);
  if (newWealth > maxCommercialReserves) {
    newWealth -= Math.floor((newWealth - maxCommercialReserves) * 0.04);
  }

  return { newFood, newWealth };
}
