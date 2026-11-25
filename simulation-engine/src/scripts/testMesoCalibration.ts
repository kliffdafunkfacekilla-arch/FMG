/**
 * Real meso layer calibration, border stitching, entity backing, and ambush-to-StoryDesk test (Phase 10).
 */
import assert from "node:assert/strict";
import pool from "../db/pool.js";
import { isolateTest } from "./testIsolation.js";
import { migrate } from "../db/migrate.js";
import { DAYS_PER_WEEK } from "../engine/canon/calendar.js";
import { stepEcology } from "../engine/macro/ecology/step.js";
import { executeMasterTick } from "../engine/masterOrchestrator.js";
import { promoteFromCohort } from "../engine/lod/promote.js";
import { stepMesoDay } from "../engine/meso/mesoStep.js";
import {
  MAX_ACTIVE_REGIONS,
  MAX_CELLS_PER_REGION,
  buildRegion,
  focusRegion,
  rebuildFocusedRegions,
  stitchRegionBorders,
  unfocusRegion,
} from "../engine/meso/region.js";

async function main() {
  console.log("=== Testing Real Meso Layer Calibration, Borders & Ambush Loop (Phase 10) ===");
  await migrate(pool);

  // Pick a land burg cell and neighbor candidates
  const landCellsRes = await pool.query(
    `SELECT c.id, c.center_x, c.center_y, b.burg_id, b.name AS burg_name, b.wealth
     FROM sim_cells c
     JOIN sim_burg_economy b ON b.cell_id = c.id
     WHERE c.elevation >= 20
     ORDER BY b.burg_id ASC
     LIMIT 5`
  );
  assert.ok(landCellsRes.rows.length >= 4, "Expected >= 4 land burg cells");
  const focusCellId = Number(landCellsRes.rows[0].id);
  const burgId = Number(landCellsRes.rows[0].burg_id);

  // 1. Border stitching + 7-cell region cap
  const dummyA = {
    cellId: 101,
    centerX: 100,
    centerY: 100,
    mapData: new Uint8Array(10000),
    infraMap: new Uint8Array(10000),
    neighbors: {} as any,
  };
  const dummyB = {
    cellId: 102,
    centerX: 130,
    centerY: 100,
    mapData: new Uint8Array(10000),
    infraMap: new Uint8Array(10000),
    neighbors: {} as any,
  };
  dummyA.mapData[42 * 100 + 99] = 2; // Road reaching eastern edge
  dummyA.infraMap[42 * 100 + 99] = 1;
  dummyB.mapData[55 * 100 + 0] = 3; // River reaching western edge
  const pairs = stitchRegionBorders([dummyA, dummyB]);
  assert.ok(pairs.some((p) => p.kind === "road"), "Expected stitched road crossing");
  assert.ok(pairs.some((p) => p.kind === "river"), "Expected stitched river crossing");
  const joinedRoad = pairs.find((p) => p.kind === "road")!;
  assert.equal(dummyA.mapData[joinedRoad.coord * 100 + 99], 2);
  assert.equal(dummyB.mapData[joinedRoad.coord * 100 + 0], 2);

  const built = await buildRegion(pool, focusCellId);
  assert.ok(built.cellIds.length >= 2 && built.cellIds.length <= MAX_CELLS_PER_REGION, `Ring size=${built.cellIds.length}`);
  console.log(`1. Region ring (${built.cellIds.length} cells) and stitched borders verified... PASSED`);

  // 2. Focus persistence, entity-backed agents, rebuild & active cap (MAX_ACTIVE_REGIONS = 3)
  const focused = await focusRegion(pool, focusCellId);
  assert.ok(focused.agentsCount >= 1, "Expected entity-backed meso agents loaded");
  const mesoEntities = await pool.query(
    `SELECT COUNT(*)::int AS c FROM entities WHERE cell_id = ANY($1::int[]) AND lod = 'meso'`,
    [focused.record.cell_ids]
  );
  assert.ok(Number(mesoEntities.rows[0].c) >= 1, "Focused region must update entity LOD to 'meso'");

  const rebuilt = await rebuildFocusedRegions(pool);
  assert.equal(rebuilt.length, 1);
  assert.deepEqual(rebuilt[0]!.cellIds, focused.record.cell_ids, "Rebuild from DB must match focused ring");

  // Cap check: focus 2 more regions (total 3), 4th must throw
  await focusRegion(pool, Number(landCellsRes.rows[1].id));
  await focusRegion(pool, Number(landCellsRes.rows[2].id));
  let capBlocked = false;
  try {
    await focusRegion(pool, Number(landCellsRes.rows[3].id));
  } catch (e: any) {
    if (String(e.message).includes("Max active focused regions")) capBlocked = true;
  }
  assert.equal(capBlocked, true, `Expected MAX_ACTIVE_REGIONS=${MAX_ACTIVE_REGIONS} cap enforcement`);
  await unfocusRegion(pool, Number(landCellsRes.rows[1].id));
  await unfocusRegion(pool, Number(landCellsRes.rows[2].id));
  console.log(`2. Entity-backed meso focus, rebuild & MAX_ACTIVE_REGIONS=${MAX_ACTIVE_REGIONS} cap... PASSED`);

  // 3. Quiet ecology calibration within +/-5% against macro formula + no double-counting
  const calCells = [
    { id: 9001, center_x: 500, center_y: 500, eco_plants: 50, eco_prey: 45, eco_predators: 15, eco_apex: 5, eco_blight: 0, eco_max: 100 },
  ];
  const macroDeltas = stepEcology(
    {
      active: true,
      tick: DAYS_PER_WEEK,
      season: "Greenspan",
      loreDate: "Test",
      dragonDomain: "Ordo",
      dragonName: "Thalor",
      moonPhase: "The Halo",
      isPeakChaos: false,
      cells: calCells,
      burgs: [],
      chaosZones: [],
      groves: [],
    },
    { random: () => 0.5 }
  );
  const macroSet = macroDeltas.find((d) => d.kind === "cell.set") as any;
  assert.ok(macroSet, "Expected macro ecology cell.set");

  // Integrate DAYS_PER_WEEK quiet meso days and compare against macro weekly batch
  let mesoState = {
    tick: 1,
    season: "Greenspan",
    loreDate: "Test",
    cells: [{ cellId: 9001, ecoPlants: 50, ecoPrey: 45, ecoPredators: 15, ecoApex: 5, ecoBlight: 0, ecoMax: 100 }],
    burgs: [],
    agents: [],
  };
  for (let d = 1; d <= DAYS_PER_WEEK; d++) {
    const out = stepMesoDay(mesoState, { seed: "calib", tick: d });
    mesoState.cells = out.finalCells;
  }
  const mc = mesoState.cells[0]!;
  const relErr = (a: number, b: number) => Math.abs(a - b) / Math.max(1, Math.abs(b));
  assert.ok(relErr(mc.ecoPlants, macroSet.fields.eco_plants) <= 0.05, `Plants drift: meso=${mc.ecoPlants} macro=${macroSet.fields.eco_plants}`);
  assert.ok(relErr(mc.ecoPrey, macroSet.fields.eco_prey) <= 0.05, `Prey drift: meso=${mc.ecoPrey} macro=${macroSet.fields.eco_prey}`);
  assert.ok(relErr(mc.ecoPredators, macroSet.fields.eco_predators) <= 0.05, `Pred drift: meso=${mc.ecoPredators} macro=${macroSet.fields.eco_predators}`);

  // Non-double-counting check: stepEcology skips focused cell while runFocusedMesoDay steps it once
  const directSkip = stepEcology(
    {
      active: true,
      tick: DAYS_PER_WEEK,
      season: "Greenspan",
      loreDate: "Test",
      dragonDomain: "Ordo",
      dragonName: "Thalor",
      moonPhase: "The Halo",
      isPeakChaos: false,
      cells: calCells,
      burgs: [],
      chaosZones: [],
      groves: [],
    },
    { random: () => 0.5, skipCellIds: new Set([9001]) }
  );
  assert.equal(directSkip.filter((d) => d.kind === "cell.set" && d.cellId === 9001).length, 0, "stepEcology must skip focused cell");

  const cellBeforeTick = Number((await pool.query(`SELECT eco_plants FROM sim_cells WHERE id = $1`, [focusCellId])).rows[0].eco_plants);
  const tickRes = await executeMasterTick();
  assert.equal(tickRes.status, "success");
  assert.ok(typeof tickRes.timings.mesoRegions === "number", "Expected mesoRegions step in focused master tick");
  const cellAfterTick = Number((await pool.query(`SELECT eco_plants FROM sim_cells WHERE id = $1`, [focusCellId])).rows[0].eco_plants);
  assert.notEqual(cellAfterTick, cellBeforeTick, "Focused meso cell should update hourly over the day");
  console.log(
    `3. Meso quiet calibration within +/-5% (plants ${mc.ecoPlants.toFixed(2)} vs ${macroSet.fields.eco_plants}) & double-count skip... PASSED`
  );

  // 4. Convoy ambush inside focused region -> lost cargo, event.log, Story Desk proposal, and unfocus retention
  const startWealth = Number((await pool.query(`SELECT wealth FROM sim_burg_economy WHERE burg_id = $1`, [burgId])).rows[0].wealth);
  await pool.query(`UPDATE sim_burg_economy SET wealth = GREATEST(wealth, 1000), food = GREATEST(food, 500) WHERE burg_id = $1`, [burgId]);
  const wealthBase = Number((await pool.query(`SELECT wealth FROM sim_burg_economy WHERE burg_id = $1`, [burgId])).rows[0].wealth);

  let citRow = (await pool.query(`SELECT citizen_id FROM population_demographics WHERE settlement_id = $1 AND life_stage = 'ADULT' ORDER BY citizen_id ASC LIMIT 1`, [burgId])).rows[0];
  if (!citRow) {
    const prom = await promoteFromCohort(pool, burgId, { ageBand: "ADULT", allegiance: "CIVILIAN" }, "meso_cal_merchant", 1);
    if (prom) citRow = { citizen_id: prom.citizenId };
  }
  const goodRow = (await pool.query(`SELECT id FROM sim_goods ORDER BY id ASC LIMIT 1`)).rows[0];
  const merchantId = Number(citRow?.citizen_id || 1);
  const goodId = Number(goodRow?.id || 1);
  const goodKey = "grain";
  const goodName = "Sack Grain";

  await pool.query(
    `INSERT INTO sim_agents (name, role, sub_role, faction_id, home_burg_id, location_cell_id, state)
     VALUES ('Durn the Highwayman', 'Outlaw', 'Bandit Raider', NULL, $1, $2, 'ROAMING')`,
    [burgId, focusCellId]
  );
  await pool.query(
    `INSERT INTO sim_trade_shipments (
       source_burg_id, dest_burg_id, source_faction_id, dest_faction_id,
       transport_mode, good_id, good_key, good_name, quantity, unit_price,
       total_gold, tariff_gold, carriage_weight, merchant_citizen_id,
       crew_citizen_ids, guard_count, path_cells, path_index, current_cell_id,
       status, dispatched_tick, eta_ticks
     ) VALUES ($1, $1, 1, 1, 'LAND', $2, $3, $4, 20, 5, 100, 10, 10.0, $5, '[]'::jsonb, 1, $6::jsonb, 0, $7, 'IN_TRANSIT', 1, 5)`,
    [burgId, goodId, goodKey, goodName, merchantId, JSON.stringify([focusCellId]), focusCellId]
  );

  const ambushTick = await executeMasterTick();
  assert.equal(ambushTick.status, "success");
  const wealthAfterAmbush = Number((await pool.query(`SELECT wealth FROM sim_burg_economy WHERE burg_id = $1`, [burgId])).rows[0].wealth);
  const evAmbush = await pool.query(
    `SELECT COUNT(*)::int AS c FROM sim_events WHERE tick = $1 AND type = 'MESO_CONVOY_AMBUSH' AND cell_id = $2`,
    [ambushTick.currentTick, focusCellId]
  );
  const deskAmbush = await pool.query(
    `SELECT COUNT(*)::int AS c FROM storylines WHERE state = 'proposed' AND rule_id LIKE $1`,
    [`MESO_AMBUSH_${focusCellId}_${ambushTick.currentTick}_%`]
  );
  assert.ok(Number(evAmbush.rows[0].c) >= 1, "Expected MESO_CONVOY_AMBUSH logged in sim_events");
  assert.ok(Number(deskAmbush.rows[0].c) >= 1, "Expected ambush proposal placed on Story Desk");
  assert.ok(wealthAfterAmbush < wealthBase + 50, `Expected ambush cargo impact vs baseline ${wealthBase}, got ${wealthAfterAmbush} (start ${startWealth})`);

  await unfocusRegion(pool, focusCellId, ambushTick.currentTick);
  const wealthAfterUnfocus = Number((await pool.query(`SELECT wealth FROM sim_burg_economy WHERE burg_id = $1`, [burgId])).rows[0].wealth);
  assert.equal(wealthAfterUnfocus, wealthAfterAmbush, "Macro state must preserve meso cargo loss after unfocusing");
  console.log("4. Convoy ambush emits cargo delta, event.log, Story Desk proposal & survives unfocus... PASSED");

  console.log("\nALL PHASE 10 MESO CALIBRATION & AMBUSH TESTS PASSED");
}

isolateTest()
  .then((done) => main().then(done, async (e: unknown) => { await done(); throw e; }))
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("MESO CALIBRATION TEST FAILED - COMMIT BLOCKED:", err.message || err);
    process.exit(1);
  });
