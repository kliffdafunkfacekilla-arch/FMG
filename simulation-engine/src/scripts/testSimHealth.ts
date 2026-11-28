/**
 * Long-run health rules (rule 9), added after a 6,794-tick run in which the Nulls died out, births
 * stopped and the two population ledgers drifted apart. Pure tests: no database.
 *
 *  1. Losses gathered in burgOperations fall on Nulls and attuned by headcount, not on Nulls alone.
 *  2. A town with no Nulls left still has births (they used to be computed from Nulls only).
 *  3. Natural deaths exist, so a sick town with no births shrinks instead of holding steady forever.
 *  4. The economy's headcount (who eats, how big the granary is) counts everyone.
 *  5. Cohort reconciliation rescales buckets to an exact total, keeping their shares.
 *  6. Cartel recruits are split across both groups.
 *  7. The grain market moves food from another faction's surplus granary and pays the seller.
 *  8. Farm hiring: a town that still cannot cover what it eats raises subsistence rations, up to a cap.
 *  9. Capitals are not abandoned to chaos in one stroke.
 */
import assert from "node:assert/strict";
import { stepBurgPopulationLedger, ledgerForBurg } from "../engine/macro/burgOperations/populationLedger.js";
import { econPop } from "../engine/macro/burgOperations/types.js";
import { scaleBuckets } from "./reconcileCohorts.js";
import { recruitSplit } from "../engine/macro/cartels/types.js";
import { applyFoodAndTributeFlows, GRAIN_PER_WEALTH, SUBSISTENCE_BASE, SUBSISTENCE_PER_FARM } from "../engine/macro/burgOperations/food.js";
import { evaluateCivicAndCrisisEvents } from "../engine/macro/burgOperations/health.js";

function burg(popNull: number, popAttuned: number, extra: Record<string, unknown> = {}): any {
  return {
    burgId: 1,
    name: "Testford",
    popNull,
    origPopNull: popNull,
    popAttuned,
    popGrowthPool: 0,
    popDeparturePool: 0,
    speciesDemographics: '{"Wolf-Kin":1}',
    recordUnit: 10,
    ...extra,
  };
}

function runLedger(b: any, o: { popNullDelta?: number; health?: number; unrest?: number; food?: number }) {
  const ledger = ledgerForBurg(b);
  const cohortGrowthOps: any[] = [];
  const cohortRetireReqs: any[] = [];
  const res = stepBurgPopulationLedger({
    burg: b,
    ledger,
    totalPop: b.origPopNull + b.popAttuned,
    newFood: o.food ?? 100000,
    newHealth: o.health ?? 90,
    newUnrest: o.unrest ?? 10,
    starvationDeaths: 0,
    popNullDelta: o.popNullDelta ?? 0,
    popAttunedDelta: 0,
    departedDead: 0,
    departedLeft: 0,
    cohortGrowthOps,
    cohortRetireReqs,
    emptiedFamineBurgs: [],
    emptiedRuinedBurgs: [],
    workforceDirtyBurgs: new Set<number>(),
    random: () => 0.5,
  });
  return { res, cohortGrowthOps, cohortRetireReqs };
}

// 1. Shared losses
{
  const { res } = runLedger(burg(1000, 3000), { popNullDelta: -400 });
  assert.equal(res.newPopNull, 900, `Nulls should lose a quarter of 400, got ${1000 - res.newPopNull}`);
  assert.equal(res.newPopAttuned, 2700, `Attuned should lose three quarters of 400, got ${3000 - res.newPopAttuned}`);
  console.log("1. Losses are shared by headcount (400 lost: 100 Nulls, 300 attuned)... PASSED");
}

// 2. Births without Nulls
{
  const { res } = runLedger(burg(0, 36000), {});
  assert.ok(res.growthPool > 0, `A healthy, calm town of 36,000 attuned should grow, pool ${res.growthPool}`);
  console.log(`2. A town with no Nulls still has births (growth pool +${res.growthPool.toFixed(2)} per day)... PASSED`);
}

// 3. Natural deaths
{
  const { res } = runLedger(burg(5000, 5000), { health: 30, unrest: 90 });
  assert.ok(res.growthPool < 0, `A sick, rioting town (no births) should lose people to natural deaths, pool ${res.growthPool}`);
  const healthy = runLedger(burg(5000, 5000), { health: 90, unrest: 10 }).res;
  assert.ok(healthy.growthPool > 0, "A healthy town should still grow overall");
  console.log("3. Natural deaths shrink a town that cannot have births; healthy towns still grow... PASSED");
}

// 4. Economic headcount
{
  assert.equal(econPop({ popNull: 36000, popAttuned: 36000 }), 36000, "Matches pop_null at world start");
  assert.equal(econPop({ popNull: 0, popAttuned: 36000 }), 18000, "A town without Nulls still eats");
  assert.equal(econPop({ popNull: -5, popAttuned: null }), 0);
  console.log("4. Economy headcount counts everyone (36,000 attuned, no Nulls -> 18,000)... PASSED");
}

// 5. Cohort reconciliation
{
  const scaled = scaleBuckets([{ id: 0, count: 6000 }, { id: 1, count: 3000 }, { id: 2, count: 1001 }], 5000);
  const total = Array.from(scaled.values()).reduce((a, b) => a + b, 0);
  assert.equal(total, 5000, `Rescaled buckets must sum exactly to the target, got ${total}`);
  assert.equal(scaled.get(0), 3000);
  assert.equal(scaled.get(1), 1500);
  assert.equal(scaled.get(2), 500);
  console.log("5. Cohort buckets rescale to an exact total, keeping shares... PASSED");
}

// 6. Cartel recruits
{
  assert.deepEqual(recruitSplit({ popNull: 100, popAttuned: 300 }, 12), { popNull: -3, popAttuned: -9 });
  assert.deepEqual(recruitSplit({ popNull: 0, popAttuned: 300 }, 12), { popAttuned: -12 });
  assert.deepEqual(recruitSplit({ popNull: 0, popAttuned: 0 }, 12), {});
  console.log("6. Cartel recruits come from both groups... PASSED");
}

// 7. Grain market across factions
{
  const city = burg(5000, 5000, { burgId: 1, food: 0, wealth: 2000, factionId: 1 });
  const farmTown = burg(1000, 1000, { burgId: 2, food: 100000, wealth: 0, factionId: 2 });
  const r = applyFoodAndTributeFlows({
    burg: city, workingBurgs: [city, farmTown], factionId: 1, isTradeBlockaded: false,
    incomingTributes: new Map(), foodProduced: 0, wealthDelta: 0, military: {},
  });
  assert.ok(r.marketBought > 0, "The city should buy grain from the other faction's granary");
  assert.equal(farmTown.food, 100000 - r.marketBought, "Bought grain must leave the seller's granary");
  assert.equal(farmTown.wealth, Math.ceil(r.marketBought / GRAIN_PER_WEALTH), "The seller must be paid");
  assert.ok(r.wealthDelta < 0, "The buyer must pay");
  console.log(`7. Grain market: bought ${r.marketBought} food from another faction, seller paid ${farmTown.wealth}... PASSED`);
}

// 8. Subsistence farming
{
  const broke = burg(20000, 20000, { burgId: 3, food: 0, wealth: 0, factionId: 9 });
  const r = applyFoodAndTributeFlows({
    burg: broke, workingBurgs: [broke], factionId: 9, isTradeBlockaded: false,
    incomingTributes: new Map(), foodProduced: 0, wealthDelta: 0, military: {}, farmLevel: 10,
  });
  const cap = SUBSISTENCE_BASE + 10 * SUBSISTENCE_PER_FARM;
  assert.equal(r.subsistence, cap, `A broke town eating 20,000 should raise its full subsistence cap ${cap}`);
  assert.equal(r.foodDelta, cap - 20000, "Subsistence offsets part of what the town eats");
  const small = burg(1000, 1000, { burgId: 4, food: 0, wealth: 0, factionId: 9 });
  const rs = applyFoodAndTributeFlows({
    burg: small, workingBurgs: [small], factionId: 9, isTradeBlockaded: false,
    incomingTributes: new Map(), foodProduced: 0, wealthDelta: 0, military: {},
  });
  assert.equal(rs.foodDelta, 0, "A small town can feed itself entirely from subsistence");
  console.log(`8. Farm hiring covers up to ${cap} rations a day; small towns feed themselves... PASSED`);
}

// 9. Capitals are not abandoned to chaos in one stroke
{
  const crisis = (isCapital: boolean) => {
    const b = burg(30000, 30000, { burgId: 1, isCapital, urbanTier: 4 });
    const events: any[] = [];
    const r = evaluateCivicAndCrisisEvents({
      burg: b, tick: 33, chaosIntensity: 100, foodDelta: -20000, newFood: 0, newHealth: 20, newUnrest: 90,
      starvationDeaths: 0, banditDefectors: 0, receivedTribute: undefined, popNullDelta: 0, departedLeft: 0,
      workingOutlaws: [], outlawManpowerDeltas: new Map(), events, tags: [], random: () => 0.5,
    });
    return { r, ruined: events.some((e) => e.type === "BURG_ABANDONED_TO_CHAOS"), name: b.name };
  };
  const town = crisis(false);
  assert.ok(town.ruined && town.r.departedLeft > 0, "An ordinary town in chaos, famine and riot is abandoned");
  const capital = crisis(true);
  assert.ok(!capital.ruined && capital.r.departedLeft === 0 && !capital.name.startsWith("[Ruin]"), "A capital is not abandoned in one stroke");
  console.log("9. Chaos abandonment ruins an ordinary town but spares a capital... PASSED");
}

console.log("\nALL SIM HEALTH TESTS PASSED");
