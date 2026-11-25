/**
 * Pure no-database unit tests for ported Phase 2.3 macro step() functions.
 */
import assert from "node:assert/strict";
import { mulberry32 } from "../engine/rng.js";
import { stepEncounter } from "../engine/macro/encounter/step.js";
import { stepWeather } from "../engine/macro/weather/step.js";
import type { WeatherBurgRow, WeatherSnapshot } from "../engine/macro/weather/load.js";
import { stepEcology } from "../engine/macro/ecology/step.js";
import type { EcologySnapshot } from "../engine/macro/ecology/load.js";
import { stepCalendar } from "../engine/macro/calendar/step.js";

function testEncounterUnit() {
  const emptyDeltas = stepEncounter({ agents: [], cellIds: [10, 20, 30] }, { tick: 2, random: mulberry32(42) });
  assert.equal(emptyDeltas.length, 0);

  const deltas = stepEncounter(
    {
      agents: [
        { id: 1, location_cell_id: 999 },
        { id: 2, location_cell_id: 999 },
      ],
      cellIds: [10, 20, 30, 40, 50],
    },
    { tick: 2, random: mulberry32(42) }
  );
  assert.equal(deltas.length, 2, "Expected one agent.update per wandering agent");
  for (const d of deltas) {
    assert.equal(d.kind, "agent.update");
    assert.ok([10, 20, 30, 40, 50].includes(d.fields.location_cell_id!), "Chosen cell must come from snapshot");
  }
  const replay = stepEncounter(
    {
      agents: [
        { id: 1, location_cell_id: 999 },
        { id: 2, location_cell_id: 999 },
      ],
      cellIds: [10, 20, 30, 40, 50],
    },
    { tick: 2, random: mulberry32(42) }
  );
  assert.deepEqual(deltas, replay, "stepEncounter must be deterministic for a fixed snapshot & seed");
  console.log("1. stepEncounter (no DB) deterministic wandering movement... PASSED");
}

function makeWeatherBurg(overrides: Partial<WeatherBurgRow>): WeatherBurgRow {
  return {
    burg_id: 1,
    name: "Testburg",
    cell_id: 100,
    food: 5000,
    unrest: 10,
    health: 90,
    pop_null: 100,
    pop_attuned: 0,
    architecture_type: "WOOD",
    center_x: 500,
    center_y: 500,
    river_id: 0,
    cell_flux: 0,
    current_temp: 15,
    river_discharge: 0,
    river_width: 0,
    river_name: null,
    ...overrides,
  };
}

function testWeatherUnit() {
  const baseBounds = { minX: 0, maxX: 1000, minY: 0, maxY: 1000 };

  // (a) Wildfire burns wooden burg heavily vs stone burg lightly
  const wildSnap: WeatherSnapshot = {
    tick: 3,
    season: "Frostin",
    dayOfMonth: 12,
    loreDate: "Test",
    isShadowWeek: false,
    phase: "HALO",
    bounds: baseBounds,
    fronts: [{ id: 1, type: "WILDFIRE", x: 50, y: 50, dx: 0, dy: 0, radius: 10, lifetime: 3 }],
    burgs: [
      makeWeatherBurg({ burg_id: 1, name: "Timberstead", cell_id: 10, architecture_type: "WOOD", center_x: 500, center_y: 500 }),
      makeWeatherBurg({ burg_id: 2, name: "Stonehold", cell_id: 11, architecture_type: "STONE", center_x: 520, center_y: 500 }),
      makeWeatherBurg({ burg_id: 3, name: "Faraway", cell_id: 12, architecture_type: "WOOD", center_x: 950, center_y: 950 }),
    ],
    bleedGroves: [],
    damagedCells: [],
    climateCells: [],
  };
  const wildDeltas = stepWeather(wildSnap, { random: () => 0.99 });
  const woodAdj = wildDeltas.find((d) => d.kind === "burg.adjust" && d.burgId === 1) as any;
  const stoneAdj = wildDeltas.find((d) => d.kind === "burg.adjust" && d.burgId === 2) as any;
  const farAdj = wildDeltas.find((d) => d.kind === "burg.adjust" && d.burgId === 3);
  assert.ok(woodAdj && stoneAdj && !farAdj, "Wildfire must hit wood & stone inside circle and skip faraway");
  assert.ok(woodAdj.food! < stoneAdj.food!, "Wood burg must suffer heavier food loss in wildfire than stone");

  // (b) Drought: river-irrigated halves food penalty vs arid cell
  const droughtSnap: WeatherSnapshot = {
    ...wildSnap,
    fronts: [{ id: 2, type: "DROUGHT", x: 50, y: 50, dx: 0, dy: 0, radius: 15, lifetime: 4 }],
    burgs: [
      makeWeatherBurg({ burg_id: 10, name: "RiverTown", cell_id: 20, river_id: 4, river_discharge: 300, cell_flux: 40, center_x: 500, center_y: 500 }),
      makeWeatherBurg({ burg_id: 11, name: "DustTown", cell_id: 21, river_id: 0, river_discharge: 0, cell_flux: 1, center_x: 510, center_y: 500 }),
    ],
  };
  const dDeltas = stepWeather(droughtSnap, { random: () => 0.99 });
  const riverAdj = dDeltas.find((d) => d.kind === "burg.adjust" && d.burgId === 10) as any;
  const dustAdj = dDeltas.find((d) => d.kind === "burg.adjust" && d.burgId === 11) as any;
  assert.ok(Math.abs(riverAdj.food!) < Math.abs(dustAdj.food!), "River-irrigated burg must lose less food in drought than arid burg");

  // (c) Hurricane over major river triggers #RiverFlooding
  const hurrSnap: WeatherSnapshot = {
    ...wildSnap,
    fronts: [{ id: 3, type: "HURRICANE", x: 50, y: 50, dx: 0, dy: 0, radius: 10, lifetime: 3 }],
    burgs: [makeWeatherBurg({ burg_id: 20, name: "FloodQuay", cell_id: 30, river_id: 2, river_discharge: 200, river_name: "Great Wash" })],
  };
  const hDeltas = stepWeather(hurrSnap, { random: () => 0.99 });
  const floodTags = hDeltas.find((d) => d.kind === "tags.add" && d.target.kind === "cell" && d.target.cellId === 30) as any;
  assert.ok(floodTags?.tags.includes("#RiverFlooding"), "Hurricane over major river should emit #RiverFlooding tag");

  // (d) MERCY skips full-health cells and heals damaged cell by +3
  const mercySnap: WeatherSnapshot = {
    ...wildSnap,
    phase: "MERCY",
    fronts: [],
    burgs: [],
    damagedCells: [
      { id: 1, eco_health: 100, eco_max: 100 },
      { id: 2, eco_health: 70, eco_max: 100 },
    ],
  };
  const mDeltas = stepWeather(mercySnap, { random: () => 0.99 });
  const healed = mDeltas.filter((d) => d.kind === "cell.adjust");
  assert.equal(healed.length, 1);
  assert.equal((healed[0] as any).cellId, 2);
  assert.equal((healed[0] as any).ecoHealth, 3);
  console.log("2. stepWeather (no DB) wildfire, drought irrigation, river flood, MERCY... PASSED");
}

function testEcologyUnit() {
  const skipped = stepEcology(
    {
      active: false,
      tick: 2,
      season: "Shadowburn",
      loreDate: "Day 2",
      dragonDomain: "Flux",
      dragonName: "Ulex",
      moonPhase: "The Mercy Alignment",
      isPeakChaos: false,
      cells: [],
      burgs: [],
      chaosZones: [],
      groves: [],
    },
    { random: mulberry32(7) }
  );
  assert.equal(skipped.length, 0);

  // Active weekly tick (tick 12, % 4 === 0, % 6 === 0): lush growth, starving predators, weak/strong grove blight, lush & ruined burgs
  const ecoSnap: EcologySnapshot = {
    active: true,
    tick: 12,
    season: "Greenspan",
    loreDate: "Day 12",
    dragonDomain: "Vita",
    dragonName: "Gavusrix",
    moonPhase: "The Leering",
    isPeakChaos: false,
    cells: [
      { id: 1, center_x: 100, center_y: 100, eco_plants: 70, eco_prey: 50, eco_predators: 10, eco_apex: 5, eco_blight: 0, eco_max: 100 },
      { id: 2, center_x: 120, center_y: 100, eco_plants: 20, eco_prey: 10, eco_predators: 20, eco_apex: 5, eco_blight: 55, eco_max: 100 },
    ],
    burgs: [
      { burg_id: 1, name: "Greenshore", cell_id: 1, pop_null: 100, food: 500, unrest: 10, wealth: 100 },
      { burg_id: 2, name: "Blightwatch", cell_id: 2, pop_null: 80, food: 200, unrest: 20, wealth: 50 },
    ],
    chaosZones: [{ id: 1, cell_id: 2, intensity: 60, type: "VOID_RIFT" }],
    groves: [{ id: 1, cell_id: 2, seal_strength: 20 }],
  };
  const deltas = stepEcology(ecoSnap, { random: mulberry32(99) });
  const cell1 = deltas.find((d) => d.kind === "cell.set" && d.cellId === 1) as any;
  const cell2 = deltas.find((d) => d.kind === "cell.set" && d.cellId === 2) as any;
  assert.ok(cell1?.fields.eco_plants > 70, "Greenspan should boost plants on healthy cell 1");
  assert.ok(cell2?.fields.eco_blight > 55, "Weak grove seal (< 30) must increase blight on cell 2");
  assert.ok(cell2?.fields.eco_predators < 20, "Starving predators must lose population on prey-poor cell 2");
  const lushFood = deltas.filter((d) => d.kind === "burg.adjust" && d.burgId === 1 && (d.food ?? 0) > 0);
  const starveFood = deltas.filter((d) => d.kind === "burg.adjust" && d.burgId === 2 && (d.food ?? 0) < 0);
  assert.ok(lushFood.length >= 1, "Lush flora cell 1 must award +25 food to burg 1");
  assert.ok(starveFood.length >= 1, "Blighted cell 2 must drain food from burg 2");
  console.log("3. stepEcology (no DB) growth, predators, grove blight & foraging feedback... PASSED");
}

function testCalendarUnit() {
  const day1 = stepCalendar({ tick: 1, calendarRowId: 1, chaosBurgIds: [], unrestBurgIds: [] });
  assert.equal(day1.calendar.month, 1);
  assert.equal(day1.calendar.monthName, "Nexar");
  assert.equal(day1.calendar.isShadowWeek, false);
  assert.equal(day1.deltas.length, 1);
  assert.equal(day1.deltas[0]!.kind, "calendar.set");

  const day48 = stepCalendar({ tick: 48, calendarRowId: 1, chaosBurgIds: [1, 2], unrestBurgIds: [1, 3] });
  assert.equal(day48.calendar.dayOfMonth, 48);
  assert.equal(day48.deltas.filter((d) => d.kind === "burg.adjust").length, 4);

  const shadowfall = stepCalendar({ tick: 577, calendarRowId: 1, chaosBurgIds: [1], unrestBurgIds: [1] });
  assert.equal(shadowfall.calendar.isShadowWeek, true);
  assert.equal(shadowfall.calendar.monthName, "Shadowfall");
  assert.equal(shadowfall.deltas.filter((d) => d.kind === "burg.adjust").length, 0, "Shadowfall Day 577 must not fire month-end hemorrhage");
  console.log("4. stepCalendar (no DB) Day 1, Day 48 hemorrhage & Shadowfall... PASSED");
}

import { stepFactionCollapse } from "../engine/macro/factionCollapse/step.js";
import { stepMarket } from "../engine/macro/market/step.js";

function testFactionCollapseUnit() {
  const deltas = stepFactionCollapse({
    tick: 12,
    loreDate: "Day 12 of Frost",
    candidates: [
      { id: 10, name: "Kragmere", treasury: 0, cellIds: [101, 102], wars: 2 },
      { id: 11, name: "Ashen Pact", treasury: 500, cellIds: [], wars: 1 },
      { id: 12, name: "Iron Horde", treasury: 250, cellIds: [201], wars: 1 },
      { id: 13, name: "Quiet Remnant", treasury: 100, cellIds: [], wars: 0 },
    ],
  });

  type D = (typeof deltas)[number];
  const endWars = deltas.filter((d): d is Extract<D, { kind: "diplomacy.endWars" }> => d.kind === "diplomacy.endWars");
  assert.deepEqual(endWars.map((d) => d.factionId), [10, 11]);

  const wildCells = deltas.filter((d): d is Extract<D, { kind: "cell.setFaction" }> => d.kind === "cell.setFaction");
  assert.deepEqual(
    wildCells.map((d) => [d.cellId, d.factionId]),
    [[101, null], [102, null]]
  );

  const events = deltas.filter((d): d is Extract<D, { kind: "event.log" }> => d.kind === "event.log");
  assert.deepEqual(
    events.map((d) => [d.type, d.factionId]),
    [["FACTION_COLLAPSED", 10], ["FACTION_WARS_ENDED", 11]]
  );
  console.log("5. stepFactionCollapse (no DB) bankrupt collapse, landless peace & funded nomad skip... PASSED");
}

function testMarketUnit() {
  const skipped = stepMarket({ tick: 2, due: false, goods: [], burgs: [], markets: [], prices: [] });
  assert.equal(skipped.deltas.length, 0, "Non-weekly due:false tick must emit zero market deltas");

  const res = stepMarket({
    tick: 7,
    due: true,
    goods: [
      { id: 1, key: "grain", value: 10 },
      { id: 2, key: "wine", value: 20 },
    ],
    burgs: [
      { burgId: 10, marketId: 1, food: 2500, complexInventory: { wine: 4, spices: 5 } },
      { burgId: 11, marketId: 0, food: 500, complexInventory: { spices: 2 } },
    ],
    markets: [
      { id: 1, centerBurgId: 10, goods: { "1": { price: 10, stock: 20, refStock: 25 } } },
    ],
    prices: [
      { commodity: "grain", basePrice: 10, currentPrice: 10, globalDemand: 30 },
      { commodity: "aromatics", basePrice: 25, currentPrice: 20, globalDemand: 0 },
    ],
  });

  assert.equal(res.marketsUpdated, 1);
  assert.equal(res.commoditiesUpdated, 2);
  type D = (typeof res.deltas)[number];
  const mkt = res.deltas.find((d): d is Extract<D, { kind: "market.setGoods" }> => d.kind === "market.setGoods");
  assert.ok(mkt);
  assert.equal(mkt.marketId, 1);
  // Market 1 grain = 25 (from burg 10; burg 11 has marketId 0 so skipped locally), wine = 4
  assert.equal(mkt.goods["1"]?.stock, 25);
  assert.equal(mkt.goods["1"]?.refStock, 25);
  assert.equal(mkt.goods["1"]?.price, 10);
  assert.equal(mkt.goods["2"]?.stock, 4);

  const comms = res.deltas.filter((d): d is Extract<D, { kind: "commodity.set" }> => d.kind === "commodity.set");
  const grain = comms.find((c) => c.commodity === "grain");
  const aromatics = comms.find((c) => c.commodity === "aromatics");
  assert.ok(grain && aromatics);
  // World grain = 25 + 5 = 30 == globalDemand -> price stays 10
  assert.equal(grain.globalSupply, 30);
  assert.equal(grain.currentPrice, 10);
  // Aromatics aliases spices (5 + 2 = 7), globalDemand seeded from supply = 7 -> target 25, next = 20 + 5*0.25 = 21.25
  assert.equal(aromatics.globalSupply, 7);
  assert.equal(aromatics.globalDemand, 7);
  assert.equal(aromatics.currentPrice, 21.25);
  console.log("6. stepMarket (no DB) skip on non-weekly tick, regional goods, aliasSupply & step math... PASSED");
}

import { stepGrindCanyon } from "../engine/macro/grindCanyon/step.js";

function testGrindCanyonUnit() {
  // Deterministic random stream: 0.0 -> floor(0*8)=0 -> 12 extracted stone on OPEN; 0.9 -> >=0.25 no spawn
  const seq = [0.0, 0.9];
  let idx = 0;
  const rng = () => seq[idx++] ?? 0.9;

  const deltas = stepGrindCanyon(
    {
      tick: 20,
      loreDate: "Day 20 of Frost",
      hasCorpoOutlaw: true,
      activeCanyons: [
        {
          id: 1,
          name: "The Jagged Chasm of Ignis (Flux)",
          cellId: 500,
          dragonName: "Ignis",
          dragonDomain: "Flux",
          dragonstoneRichness: 80,
          stabilityTicksRemaining: 2,
          status: "OPEN",
          minerCrewName: "Crew #1",
          localBurgId: 10,
        },
        {
          id: 2,
          name: "Old Chasm",
          cellId: 501,
          dragonName: "Vespera",
          dragonDomain: "Omen",
          dragonstoneRichness: 10,
          stabilityTicksRemaining: 1,
          status: "COLLAPSING",
          minerCrewName: "Crew #2",
          localBurgId: null,
        },
      ],
      wildCells: [{ id: 900, x: 50, y: 50 }],
      burgs: [{ burgId: 10, name: "Excelsis", cellId: 500, x: 10, y: 10 }],
    },
    rng
  );

  type D = (typeof deltas)[number];
  const upd = deltas.filter((d): d is Extract<D, { kind: "grindCanyon.update" }> => d.kind === "grindCanyon.update");
  assert.equal(upd.length, 2);
  assert.equal(upd[0]?.status, "COLLAPSING");
  assert.equal(upd[0]?.richnessDelta, -12);
  assert.equal(upd[1]?.status, "SEALED");
  assert.equal(upd[1]?.closedTick, 20);

  const lairDel = deltas.find((d): d is Extract<D, { kind: "fringeLair.mutate" }> => d.kind === "fringeLair.mutate");
  assert.ok(lairDel && lairDel.action === "deleteByFactionCell" && lairDel.cellId === 501);

  const outlaw = deltas.find((d): d is Extract<D, { kind: "outlawFaction.adjust" }> => d.kind === "outlawFaction.adjust");
  // 12 * 25 = 300g -> overhead 150 -> net 150
  assert.equal(outlaw?.wealthDelta, 150);

  // Spawn branch when < 3 active and roll < 0.25
  const spawnDeltas = stepGrindCanyon(
    {
      tick: 21,
      loreDate: "Day 21 of Frost",
      hasCorpoOutlaw: true,
      activeCanyons: [],
      wildCells: [{ id: 900, x: 45, y: 45 }],
      burgs: [{ burgId: 10, name: "Excelsis", cellId: 500, x: 40, y: 40 }],
    },
    () => 0.1
  );
  const created = spawnDeltas.find((d): d is Extract<D, { kind: "grindCanyon.create" }> => d.kind === "grindCanyon.create");
  assert.ok(created && created.cellId === 900 && created.status === "OPEN");
  const lairAdd = spawnDeltas.find((d): d is Extract<D, { kind: "fringeLair.mutate" }> => d.kind === "fringeLair.mutate");
  assert.ok(lairAdd && lairAdd.action === "upsert" && lairAdd.burgId === 10);
  console.log("7. stepGrindCanyon (no DB) extraction, collapse, seal & highland spawn... PASSED");
}

function main() {
  console.log("=== Testing Pure Macro Agent step() Functions (No DB) ===");
  testEncounterUnit();
  testWeatherUnit();
  testEcologyUnit();
  testCalendarUnit();
  testFactionCollapseUnit();
  testMarketUnit();
  testGrindCanyonUnit();
  console.log("\nALL PURE MACRO AGENT UNIT TESTS PASSED");
}

main();
