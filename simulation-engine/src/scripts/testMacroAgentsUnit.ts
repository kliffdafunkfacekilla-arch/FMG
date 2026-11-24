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

function main() {
  console.log("=== Testing Pure Macro Agent step() Functions (No DB) ===");
  testEncounterUnit();
  testWeatherUnit();
  testEcologyUnit();
  console.log("\nALL PURE MACRO AGENT UNIT TESTS PASSED");
}

main();
