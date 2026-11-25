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
import { DAYS_PER_WEEK } from "../engine/canon/calendar.js";
import { stepCalendar } from "../engine/macro/calendar/step.js";
import { computeChaosFlowState, stepChaosFlow } from "../engine/macro/chaosFlow/step.js";
import { stepAutonomousDrama } from "../engine/macro/autonomousDrama/step.js";
import { seededFraction, stepCultureReligion } from "../engine/macro/cultureReligion/step.js";
import { stepNpcRoutines } from "../engine/macro/npcRoutines/step.js";
import { BLEED_TAG, stepBackgroundDirector } from "../engine/macro/backgroundDirector/step.js";
import { buildMandateRecruitDeltas, planMandateRecruits, stepMandateWarbands } from "../engine/macro/mandate/step.js";

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

function testChaosFlowUnit() {
  const empty = stepChaosFlow({
    tick: 1,
    ctx: { activeFlow: "Mass", dragonDomain: "Tiraton", lunarSurgeMod: 0 },
    anchors: [],
    liveFlows: [],
    pruneCandidates: [],
    shoreCells: [],
    sampleCellsByPoint: [],
    agentCounts: { cultist: 0, warden: 0, chainZealot: 0 },
  });
  assert.equal(empty.deltas.length, 0);
  assert.equal(empty.liveFlows.length, 0);

  const anchor = {
    flowId: 12,
    name: "The Iron Gravity",
    dragonName: "Tiraton",
    elementalPower: "Mass",
    source: { x: 100, y: 100 },
    sink: { x: 900, y: 100 },
  };
  const ctx = { activeFlow: "Mass", dragonDomain: "Tiraton", lunarSurgeMod: 1.2 };
  const testTick = DAYS_PER_WEEK * 14;
  const live = computeChaosFlowState(anchor, testTick, ctx);
  assert.ok(live.currentSurge >= 2.4);
  const bankPt = live.waypoints[2]!;

  let call = 0;
  const seq = [0.05, 0.2, 0.05, 0.6]; // first spawn < 0.10 & < 0.50 (Cultist), second < 0.10 & < 0.80 (Warden)
  const rng = () => seq[call++] ?? 0.99;

  const snap = {
    tick: testTick, // divisible by DAYS_PER_WEEK, 7, and 2
    ctx,
    anchors: [anchor],
    liveFlows: [live],
    pruneCandidates: [
      { flowId: 12, cellId: 50, centerX: bankPt.x, centerY: bankPt.y }, // kept inside corridor
      { flowId: 12, cellId: 51, centerX: 5000, centerY: 5000 }, // drifted outside corridor
    ],
    shoreCells: [
      { cellId: 51, leyTags: ["#DragonLeys_Tiraton"] },
      { cellId: 50, leyTags: ["#DragonLeys_Tiraton"] },
    ],
    sampleCellsByPoint: [
      [
        { id: 101, centerX: bankPt.x, centerY: bankPt.y, ecoBlight: 5 },
        { id: 102, centerX: bankPt.x + 2, centerY: bankPt.y + 2, ecoBlight: 5 },
      ],
      [],
      [],
    ],
    agentCounts: { cultist: 287, warden: 71, chainZealot: 20 },
  };

  const out = stepChaosFlow(snap, { random: rng });
  type D = (typeof out.deltas)[number];

  const flowUpd = out.deltas.find((d): d is Extract<D, { kind: "chaosFlow.update" }> => d.kind === "chaosFlow.update");
  assert.ok(flowUpd && flowUpd.flowId === 12);

  const surgeEvt = out.deltas.find((d): d is Extract<D, { kind: "event.log" }> => d.kind === "event.log");
  assert.ok(surgeEvt && surgeEvt.type === "CHAOS_SURGE" && surgeEvt.tier === "CRITICAL");

  const tagsRm = out.deltas.filter((d): d is Extract<D, { kind: "tags.remove" }> => d.kind === "tags.remove");
  assert.ok(tagsRm.some((t) => t.target.kind === "cell" && t.target.cellId === 51 && t.tags.includes("#DragonLeys_Tiraton")));
  assert.ok(tagsRm.some((t) => t.target.kind === "cell" && t.target.cellId === 51 && t.tags.includes("#ChaosFlowShores")));
  assert.ok(!tagsRm.some((t) => t.target.kind === "cell" && t.target.cellId === 50));

  const zoneRm = out.deltas.find((d): d is Extract<D, { kind: "chaosZone.remove" }> => d.kind === "chaosZone.remove");
  assert.ok(zoneRm && zoneRm.cellId === 51 && zoneRm.type === "MASS_CHAOS_LEYS");

  const zoneUp = out.deltas.filter((d): d is Extract<D, { kind: "chaosZone.upsert" }> => d.kind === "chaosZone.upsert");
  assert.equal(zoneUp.length, 2);
  assert.equal(zoneUp[0]?.updateOnConflict, true);

  const created = out.deltas.filter((d): d is Extract<D, { kind: "agent.create" }> => d.kind === "agent.create");
  assert.equal(created.length, 2);
  assert.equal(created[0]?.role, "Cultist");
  assert.equal(created[1]?.role, "Warden");

  // Determinism check
  const replayA = stepChaosFlow(snap, { random: mulberry32(77) });
  const replayB = stepChaosFlow(snap, { random: mulberry32(77) });
  assert.equal(JSON.stringify(replayA.deltas), JSON.stringify(replayB.deltas));
  console.log("8. stepChaosFlow (no DB) meander, prune, bank blight & agent spawns... PASSED");
}

function testAutonomousDramaUnit() {
  const empty = stepAutonomousDrama({ tick: 1, loreDate: "Day 1", burgs: [] });
  assert.equal(empty.clashesOpened, 0);
  assert.equal(empty.deltas.length, 0);

  const out = stepAutonomousDrama({
    tick: 10,
    loreDate: "10th Day",
    burgs: [
      {
        burgId: 4, // (10 + 4) % 2 === 0 -> rival paragon branch
        name: "Ashenford",
        cellId: 200,
        unrest: 60, // > 55 -> oathBroken
        crimeRate: 25,
        food: 300,
        wealth: 500,
        paragons: [
          {
            id: 11,
            name: "Veylan",
            title: "Magistrate",
            want: "seize the grain ledgers.",
            flaw: "pride.",
            lineWontCross: "burning granaries.",
            corruptionScore: 50,
          },
          {
            id: 12,
            name: "Talia",
            title: "Captain",
            want: "hold the square",
            flaw: "rigidity",
            lineWontCross: "bribery",
            corruptionScore: 20,
          },
        ],
        citizens: [],
        cellTags: ["#GrainShortage", "#MartialPatrol"],
      },
      {
        burgId: 5, // (10 + 5) % 2 === 1 -> citizen branch
        name: "Millbrook",
        cellId: 201,
        unrest: 30,
        crimeRate: 10,
        food: 500,
        wealth: 200,
        paragons: [
          {
            id: 21,
            name: "Kael",
            title: null,
            want: null,
            flaw: null,
            lineWontCross: null,
            corruptionScore: 0,
          },
        ],
        citizens: [{ targetTypedId: "citizen:77", name: "Bram", profession: "Miller" }],
        cellTags: [],
      },
    ],
  });

  assert.equal(out.clashesOpened, 2);
  type D = (typeof out.deltas)[number];
  const threads = out.deltas.filter((d): d is Extract<D, { kind: "thread.open" }> => d.kind === "thread.open");
  assert.equal(threads.length, 2);
  assert.deepEqual(threads[0]?.spec.actor_ids, ["paragon:11", "paragon:12"]);
  assert.equal(threads[0]?.spec.rule_id, "AUTONOMOUS_CLASH");
  assert.ok(threads[0]?.spec.stakes.includes("[#GrainShortage, #MartialPatrol]"));
  assert.ok(threads[0]?.spec.stakes.includes("Pressure pushed past their line"));
  assert.deepEqual(threads[1]?.spec.actor_ids, ["paragon:21", "citizen:77"]);

  const adj = out.deltas.filter((d): d is Extract<D, { kind: "burg.adjust" }> => d.kind === "burg.adjust");
  assert.equal(adj.length, 2);

  const evts = out.deltas.filter((d): d is Extract<D, { kind: "event.log" }> => d.kind === "event.log");
  assert.equal(evts.length, 2);
  assert.equal(evts[0]?.type, "AUTONOMOUS_CLASH");

  const replayA = stepAutonomousDrama({ tick: 10, loreDate: "10th Day", burgs: [] });
  const replayB = stepAutonomousDrama({ tick: 10, loreDate: "10th Day", burgs: [] });
  assert.equal(JSON.stringify(replayA), JSON.stringify(replayB));
  console.log("9. stepAutonomousDrama (no DB) paragon/citizen pairing, dice & clash threads... PASSED");
}

function testCultureReligionUnit() {
  // Find deterministic cellIds that satisfy seededFraction < 0.55 (culture) and < 0.35 / 0.80 (heresy)
  const tick = 10;
  let cultCid = 1;
  while (seededFraction(cultCid, tick, 0x51a1) >= 0.55) cultCid++;
  let heresyCid = 100;
  while (seededFraction(heresyCid, tick, 0x73e2) >= 0.35) heresyCid++;
  let chaosHeresyCid = 200;
  while (seededFraction(chaosHeresyCid, tick, 0x73e2) >= 0.80) chaosHeresyCid++;

  const snap = {
    tick,
    loreDate: "10th Day",
    cultures: [
      { id: 1, name: "Highlander" },
      { id: 2, name: "Imperial" },
    ],
    religions: [
      { id: 0, name: "Unaffiliated", type: "Folk" },
      { id: 1, name: "Eternal Dawn", type: "Organized" },
      { id: 2, name: "Cult of the Crushed", type: "Cult" },
    ],
    templeProtectedCenters: [{ cx: 500, cy: 500 }],
    chaosByCell: [{ cellId: 902, intensity: 80 }],
    cultFrontierRows: [
      { cellId: cultCid, oldCultureId: 1, targetCultureId: 2, factionName: "Avian Empire", burgId: 10, burgName: "Redwatch" },
    ],
    cleanseRows: [
      {
        burgId: 1,
        burgName: "Excelsis",
        orthoReligionId: 1,
        orthoReligionName: "Eternal Dawn",
        targetCellId: 300,
        oldReligionId: 2,
      },
    ],
    heresyRows: [
      // Protected by temple center (dist^2 = 100 <= 400): skipped
      { srcId: 901, srcReligionId: 2, targetCellId: 301, oldReligionId: 1, tx: 510, ty: 500, burgId: null, burgName: null },
      // Normal adjacent heresy spread
      { srcId: 901, srcReligionId: 2, targetCellId: heresyCid, oldReligionId: 1, tx: 100, ty: 100, burgId: 11, burgName: "Fenwick" },
      // Chaos-boosted spread (fallback cult assignment since srcReligionId is non-cult)
      { srcId: 902, srcReligionId: 0, targetCellId: chaosHeresyCid, oldReligionId: 0, tx: 150, ty: 150, burgId: null, burgName: null },
    ],
  };

  const out = stepCultureReligion(snap);
  assert.equal(out.result.cultureConversions, 1);
  assert.equal(out.result.templeReconversions, 1);
  assert.equal(out.result.heresyConversions, 2);

  type D = (typeof out.deltas)[number];
  const cellSets = out.deltas.filter((d): d is Extract<D, { kind: "cell.set" }> => d.kind === "cell.set");
  assert.ok(cellSets.some((d) => d.cellId === cultCid && d.fields.culture_id === 2));
  assert.ok(cellSets.some((d) => d.cellId === 300 && d.fields.religion_id === 1));
  assert.ok(!cellSets.some((d) => d.cellId === 301), "Temple shield within 20 units must block heresy");
  assert.ok(cellSets.some((d) => d.cellId === heresyCid && d.fields.religion_id === 2));
  assert.ok(cellSets.some((d) => d.cellId === chaosHeresyCid && d.fields.religion_id === 2));

  const cAdj = out.deltas.filter((d): d is Extract<D, { kind: "culture.adjustCells" }> => d.kind === "culture.adjustCells");
  assert.ok(cAdj.some((c) => c.cultureId === 1 && c.delta === -1));
  assert.ok(cAdj.some((c) => c.cultureId === 2 && c.delta === 1));

  const rAdj = out.deltas.filter((d): d is Extract<D, { kind: "religion.adjustCells" }> => d.kind === "religion.adjustCells");
  assert.ok(rAdj.some((r) => r.religionId === 0 && r.delta === -1));
  assert.ok(rAdj.some((r) => r.religionId === 1 && r.delta === 0) === false, "Net zero delta must be omitted");

  const bAdj = out.deltas.filter((d): d is Extract<D, { kind: "burg.adjust" }> => d.kind === "burg.adjust");
  assert.ok(bAdj.some((b) => b.burgId === 1 && b.unrest === -1));
  assert.ok(bAdj.some((b) => b.burgId === 11 && b.unrest === 2));

  assert.equal(JSON.stringify(out), JSON.stringify(stepCultureReligion(snap)));
  console.log("10. stepCultureReligion (no DB) assimilation, temple pushback & heresy spread... PASSED");
}

function testNpcRoutinesUnit() {
  let rollIdx = 0;
  const rolls = [0.05, 0.9]; // Route 1 ambushed (5 < 30), Route 2 delivered (90 >= 15)
  const rng = () => rolls[rollIdx++] ?? 0.99;

  const snap = {
    tick: 12,
    loreDate: "Day 12",
    livingNpcs: [
      {
        id: "npc_1",
        cellId: 10,
        role: "Blacksmith",
        instinct: "WARY" as const,
        temper: "STOIC" as const,
        needs: { food: 0.8, rest: 0.8, coin: 0.5, safety: 0.8, company: 0.5 },
        mood: { fear: 0.1, anger: 0.1, joy: 0.2 },
        beliefs: [],
        socialLinks: [],
        scheduleState: "ROUTINE_WORK" as const,
        burgFood: 250,
        burgWealth: 400,
        burgUnrest: 25,
        burgCrime: 10,
      },
    ],
    recentEvents: [],
    activeRoutes: [
      { sourceBurgId: 1, destBurgId: 2, volume: 100, riskLevel: 2, srcFood: 500, dstFood: 100 }, // 40 food, risk cutoff 30
      { sourceBurgId: 3, destBurgId: 4, volume: 200, riskLevel: 1, srcFood: 600, dstFood: 150 }, // 60 food (capped), risk cutoff 15
    ],
    deceasedNpcs: [
      { id: "dead_smith", cellId: 10, burgId: 5, role: "Master Smith", recent: true },
      { id: "dead_farmer", cellId: 11, burgId: 6, role: "Village Farmer", recent: true },
      { id: "old_dead", cellId: 12, burgId: 7, role: "Artisan", recent: false },
    ],
  };

  const deltas = stepNpcRoutines(snap, { random: rng });
  type D = (typeof deltas)[number];

  const npcUpd = deltas.filter((d): d is Extract<D, { kind: "npcInstance.update" }> => d.kind === "npcInstance.update");
  assert.ok(npcUpd.some((u) => u.npcId === "npc_1" && u.needs !== undefined && u.disposition !== undefined));
  assert.ok(npcUpd.some((u) => u.npcId === "dead_smith" && u.processedForEconomy === true));
  assert.ok(npcUpd.some((u) => u.npcId === "old_dead" && u.processedForEconomy === true));

  const lairRations = deltas.find((d): d is Extract<D, { kind: "fringeLair.addRations" }> => d.kind === "fringeLair.addRations");
  assert.ok(lairRations && lairRations.burgId === 2 && lairRations.rations === 40);

  const ambushEv = deltas.find((d): d is Extract<D, { kind: "event.log" }> => d.kind === "event.log");
  assert.ok(ambushEv && ambushEv.type === "CARAVAN_AMBUSH" && ambushEv.burgId === 2);

  const bAdj = deltas.filter((d): d is Extract<D, { kind: "burg.adjust" }> => d.kind === "burg.adjust");
  assert.ok(bAdj.some((b) => b.burgId === 4 && b.food === 60 && b.unrest === -2));
  assert.ok(bAdj.some((b) => b.burgId === 5 && b.refinedGoods === -15));
  assert.ok(bAdj.some((b) => b.burgId === 6 && b.food === -10));
  assert.ok(!bAdj.some((b) => b.burgId === 7), "Stale deceased NPC (> 1 day) must not penalize economy");

  assert.equal(
    JSON.stringify(stepNpcRoutines(snap, { random: mulberry32(31) })),
    JSON.stringify(stepNpcRoutines(snap, { random: mulberry32(31) }))
  );
  console.log("11. stepNpcRoutines (no DB) mind eval, caravan ambush/delivery & casualty penalties... PASSED");
}

function testBackgroundDirectorUnit() {
  const inputSnap = {
    tick: 15,
    loreDate: "Day 15",
    moonPhase: "The Open Eye", // isChaosPeak -> BLEED_TAG
    isShadowWeek: false,
    burgsByCell: {
      30627: {
        burgId: 81,
        cellId: 30627,
        name: "Excelsis Citadel",
        unrest: 45, // #MartialLaw, #HighUnrest
        food: 800, // #Famine, #ResourceScarcity
        wealth: 500,
        crimeRate: 10,
      },
    },
    sectors: [
      {
        cellId: 30627,
        rx: 50,
        ry: 50,
        zLayer: 0,
        npcs: [
          {
            id: "1",
            name: "Doran Iron-Bender",
            type: "NPC" as const,
            role: "Blacksmith",
            tags: ["artisan", "#RebelInformant", "craftsman"],
            coords: { x: 20, y: 20 },
          },
        ],
        props: [
          {
            id: "prop_forge_01",
            name: "Artisan Smithy Forge",
            type: "PROP" as const,
            tags: ["forge", "anvil", "workstation"],
            coords: { x: 22, y: 22 },
          },
        ],
        features: { terrain: "urban" },
      },
    ],
  };

  const originalTagsCopy = JSON.stringify(inputSnap.sectors[0]!.npcs[0]!.tags);
  const out = stepBackgroundDirector(inputSnap);

  assert.equal(out.sectorsEvaluated, 1);
  assert.equal(out.sectorsFailed, 0);
  assert.ok(out.sectorsMutated === 1 && out.reactionsFired >= 1, "Expected sector reaction to mutate");
  assert.equal(
    JSON.stringify(inputSnap.sectors[0]!.npcs[0]!.tags),
    originalTagsCopy,
    "stepBackgroundDirector must not mutate caller snapshot entities"
  );

  type D = (typeof out.deltas)[number];
  const layerUpd = out.deltas.find((d): d is Extract<D, { kind: "sectorLayer.update" }> => d.kind === "sectorLayer.update");
  assert.ok(layerUpd && layerUpd.cellId === 30627 && layerUpd.zLayer === 0);
  assert.ok(Array.isArray(layerUpd.features.environmental_tags) && layerUpd.features.environmental_tags.includes(BLEED_TAG));

  const thOpen = out.deltas.find((d): d is Extract<D, { kind: "thread.open" }> => d.kind === "thread.open");
  assert.ok(thOpen && thOpen.bestEffort === true && thOpen.spec.created_tick === 15);

  const evLog = out.deltas.find((d): d is Extract<D, { kind: "event.log" }> => d.kind === "event.log");
  assert.ok(evLog && evLog.zLayer === 0);

  assert.equal(JSON.stringify(out), JSON.stringify(stepBackgroundDirector(inputSnap)));
  console.log("12. stepBackgroundDirector (no DB) immutable reactions, bestEffort threads & layer deltas... PASSED");
}

function testMandateUnit() {
  const chosen = planMandateRecruits(
    [
      { burgId: 1, cellId: 100, unrest: 40, name: "Ironhold", popNull: 200, hasWarband: false },
      { burgId: 2, cellId: 101, unrest: 35, name: "Oakhaven", popNull: 200, hasWarband: true },
    ],
    new Set(),
    { random: () => 0.1 }
  );
  assert.equal(chosen.length, 1);
  assert.equal(chosen[0]?.burgId, 1);

  const recruitDeltas = buildMandateRecruitDeltas(
    10,
    "Day 10",
    [{ burg: chosen[0]!, citizen: null }],
    { random: () => 0.1 }
  );
  type D = (typeof recruitDeltas)[number];
  const created = recruitDeltas.find((d): d is Extract<D, { kind: "agent.create" }> => d.kind === "agent.create");
  assert.ok(created && created.role === "Chain_Zealot" && created.homeBurgId === 1 && created.citizenName);
  const forgedEvt = recruitDeltas.find((d): d is Extract<D, { kind: "event.log" }> => d.kind === "event.log");
  assert.ok(forgedEvt && forgedEvt.type === "CHAIN_WARBAND_FORGED");

  const wbDeltas = stepMandateWarbands(
    {
      tick: 15,
      loreDate: "Day 15",
      warbands: [
        // Hunting in home cell -> saturates -> enters PILGRIMAGE_TO_SEAL
        {
          id: 1,
          name: "Inquisitor A",
          citizenName: "Lucian",
          profession: "Mason",
          temper: "VENGEFUL",
          subRole: "Chain_Inquisitor",
          homeBurgId: 10,
          locationCellId: 200,
          targetCellId: 200,
          targetGroveId: null,
          state: "WITCH_HUNTING",
          drainedPower: 40,
          ageTicks: 1,
        },
        // Discharging at weak seal -> grove.adjust + reset + CHAIN_PURIFICATION_IRON event
        {
          id: 2,
          name: "Inquisitor B",
          citizenName: "Mara",
          profession: "Cobbler",
          temper: "BITTER",
          subRole: "Chain_Inquisitor",
          homeBurgId: 10,
          locationCellId: 500,
          targetCellId: 500,
          targetGroveId: 3,
          state: "DISCHARGING_CHAINS",
          drainedPower: 60,
          ageTicks: 5,
        },
      ],
      groves: [
        { id: 3, cellId: 500, dragonName: "Lophex", powerDomain: "Lux", sealStrength: 30, x: 50, y: 50 },
      ],
      homeCellByBurg: { 10: 200 },
      cellCoords: { 200: { x: 40, y: 40 }, 500: { x: 50, y: 50 } },
      findNearestCell: () => 500,
    },
    { random: () => 0.1 }
  );

  type W = (typeof wbDeltas)[number];
  const upd1 = wbDeltas.find((d): d is Extract<W, { kind: "agent.update" }> => d.kind === "agent.update" && d.agentId === 1);
  assert.ok(upd1 && upd1.fields.state === "PILGRIMAGE_TO_SEAL" && upd1.fields.target_grove_id === 3);

  const upd2 = wbDeltas.find((d): d is Extract<W, { kind: "agent.update" }> => d.kind === "agent.update" && d.agentId === 2);
  assert.ok(upd2 && upd2.fields.state === "WITCH_HUNTING" && upd2.fields.drained_power === 0 && upd2.fields.target_cell_id === 200);

  const gAdj = wbDeltas.find((d): d is Extract<W, { kind: "grove.adjust" }> => d.kind === "grove.adjust");
  assert.ok(gAdj && gAdj.groveId === 3 && gAdj.sealDelta === 5);

  const purEvt = wbDeltas.find((d): d is Extract<W, { kind: "event.log" }> => d.kind === "event.log" && d.type === "CHAIN_PURIFICATION_IRON");
  assert.ok(purEvt);
  console.log("13. stepMandateWarbands (no DB) recruit planner, witch hunt, pilgrimage & seal reinforce... PASSED");
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
  testChaosFlowUnit();
  testAutonomousDramaUnit();
  testCultureReligionUnit();
  testNpcRoutinesUnit();
  testBackgroundDirectorUnit();
  testMandateUnit();
  console.log("\nALL PURE MACRO AGENT UNIT TESTS PASSED");
}

main();
