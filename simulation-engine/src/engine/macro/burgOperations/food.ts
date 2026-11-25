import type { WorkingBurg } from "./types.js";

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
}): { foodDelta: number; wealthDelta: number; receivedTribute: { food: number; wealth: number } | undefined } {
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
  const pop = burg.popNull;
  let foodDelta = foodProduced - pop;

  if ((burg.food || 0) + foodDelta < pop * 2) {
    const deficit = Math.round(pop * 2 - ((burg.food || 0) + foodDelta));
    const breadbasket = workingBurgs.find(
      (b) =>
        b.burgId !== burg.burgId &&
        (factionId ? (b.occupierFactionId || b.factionId) === factionId : true) &&
        (b.food || 0) > (b.popNull || 100) * 8
    );
    if (breadbasket && !isTradeBlockaded) {
      const grainRelief = Math.min(
        deficit,
        Math.floor(((breadbasket.food || 0) - (breadbasket.popNull || 100) * 4) * 0.15)
      );
      if (grainRelief > 0) {
        foodDelta += grainRelief;
        breadbasket.food = Math.max(0, (breadbasket.food || 0) - grainRelief);
      }
    } else if (isTradeBlockaded) {
      wealthDelta = Math.min(0, wealthDelta - 4);
    } else if ((burg.wealth || 0) > 25) {
      const affordableGrain = Math.min(deficit, ((burg.wealth || 0) - 25) * 25);
      if (affordableGrain > 0) {
        foodDelta += affordableGrain;
        wealthDelta -= Math.ceil(affordableGrain / 25);
      }
    }
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

  foodDelta -= milRationUpkeep;

  return { foodDelta, wealthDelta, receivedTribute };
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
        Math.floor((burg.popNull || 0) * 0.04),
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
