import assert from "node:assert/strict";
import pool from "../db/pool.js";
import { migrate } from "../db/migrate.js";
import { isolateTest } from "./testIsolation.js";
import { applyDeltas, flushStepDeltas, logDeltas, validateDeltas, type Delta } from "../engine/deltas/index.js";

async function main() {
  console.log("=== Testing Delta Layer (Phase 2.1) ===");
  await migrate(pool);

  const burgRes = await pool.query(`SELECT burg_id, food, unrest, health FROM sim_burg_economy ORDER BY burg_id ASC LIMIT 1`);
  const burgId = Number(burgRes.rows[0].burg_id);
  const cellRes = await pool.query(`SELECT id FROM sim_cells ORDER BY id ASC LIMIT 20`);
  const cellIds: number[] = cellRes.rows.map((r: any) => Number(r.id));
  const fullCellId = cellIds[0]!;
  const damagedCellId = cellIds[1]!;

  // 1. Multiple adjusts add up; set overrides earlier adjust; later adjust adds on top of set
  await pool.query("SAVEPOINT delta_merge");
  await pool.query(`UPDATE sim_burg_economy SET food = 100, unrest = 10, health = 80 WHERE burg_id = $1`, [burgId]);
  const mergeDeltas: Delta[] = [
    { kind: "burg.adjust", burgId, food: 15, unrest: 5 },
    { kind: "burg.adjust", burgId, food: 25, unrest: 10 }, // +40 food, +15 unrest -> 140, 25
    { kind: "burg.set", burgId, fields: { unrest: 50 } },  // set after adjust wins -> unrest = 50
    { kind: "burg.adjust", burgId, unrest: 7 },            // adjust after set -> 57
  ];
  const v1 = await validateDeltas(mergeDeltas, pool);
  assert.equal(v1.rejected.length, 0);
  await applyDeltas(v1.ok, pool);
  const after1 = (await pool.query(`SELECT food, unrest, health FROM sim_burg_economy WHERE burg_id = $1`, [burgId])).rows[0];
  assert.equal(Number(after1.food), 140, "Expected accumulated food 100+15+25=140");
  assert.equal(Number(after1.unrest), 57, "Expected set-after-adjust (50) + adjust (7) = 57");
  assert.equal(Number(after1.health), 80, "Untouched column should stay unchanged");
  await pool.query("ROLLBACK TO SAVEPOINT delta_merge");
  console.log("1. Merge semantics (adjust sum, set wins, adjust-after-set adds)... PASSED");

  // 2. Invalid IDs rejected; valid values clamped
  await pool.query("SAVEPOINT delta_validate");
  const badAndClamp: Delta[] = [
    { kind: "burg.adjust", burgId: 99999999, food: 10 },
    { kind: "burg.set", burgId, fields: { unrest: 250, health: -20, food: -5 } },
  ];
  const v2 = await validateDeltas(badAndClamp, pool);
  assert.equal(v2.rejected.length, 1, "Invalid burgId should be rejected");
  assert.equal(v2.ok.length, 1);
  await applyDeltas(v2.ok, pool);
  const after2 = (await pool.query(`SELECT food, unrest, health FROM sim_burg_economy WHERE burg_id = $1`, [burgId])).rows[0];
  assert.equal(Number(after2.unrest), 100, "Unrest should clamp to 100");
  assert.equal(Number(after2.health), 0, "Health should clamp to 0");
  assert.equal(Number(after2.food), 0, "Food should clamp to 0");
  await pool.query("ROLLBACK TO SAVEPOINT delta_validate");
  console.log("2. Invalid ID rejection and numeric clamping... PASSED");

  // 3. Batch of 1,000 mixed deltas costs < 10 queries
  await pool.query("SAVEPOINT delta_batch");
  const bigBatch: Delta[] = [];
  for (let i = 0; i < 400; i++) {
    bigBatch.push({ kind: "burg.adjust", burgId, food: 1 });
    bigBatch.push({ kind: "cell.adjust", cellId: cellIds[i % cellIds.length]!, ecoHealth: 0.1 });
  }
  for (let i = 0; i < 200; i++) {
    bigBatch.push({ kind: "event.log", tick: 1, type: "DELTA_BATCH_TEST", message: `Event ${i}`, tier: "MINOR", burgId });
  }
  assert.equal(bigBatch.length, 1000);

  let qCount = 0;
  const countedDb = {
    query: (text: string, params?: any[]) => {
      qCount++;
      return pool.query(text, params);
    },
  };
  const v3 = await validateDeltas(bigBatch, countedDb);
  assert.equal(v3.ok.length, 1000);
  await applyDeltas(v3.ok, countedDb);
  await logDeltas(v3.ok, "test:batch", 1, countedDb);
  assert.ok(qCount < 10, `Expected < 10 queries for 1,000 mixed deltas, used ${qCount}`);
  await pool.query("ROLLBACK TO SAVEPOINT delta_batch");
  console.log(`3. 1,000 mixed deltas validated, applied & logged in ${qCount} queries (< 10)... PASSED`);

  // 4. Full-health cell keeps xmin untouched; audit log skips unlogged cell.adjust
  await pool.query("SAVEPOINT delta_xmin_log");
  await pool.query(`UPDATE sim_cells SET eco_health = 100, eco_max = 100 WHERE id = $1`, [fullCellId]);
  await pool.query(`UPDATE sim_cells SET eco_health = 70, eco_max = 100 WHERE id = $1`, [damagedCellId]);
  const xminBefore = String((await pool.query(`SELECT xmin::text AS xmin FROM sim_cells WHERE id = $1`, [fullCellId])).rows[0].xmin);

  const res4 = await flushStepDeltas(pool, "test:step", 99, [
    { kind: "cell.adjust", cellId: fullCellId, ecoHealth: 3 },
    { kind: "cell.adjust", cellId: damagedCellId, ecoHealth: 3 },
    { kind: "burg.adjust", burgId, food: 5 },
  ]);
  assert.equal(res4.rejected.length, 0);
  const xminAfter = String((await pool.query(`SELECT xmin::text AS xmin FROM sim_cells WHERE id = $1`, [fullCellId])).rows[0].xmin);
  const damagedHealth = Number((await pool.query(`SELECT eco_health FROM sim_cells WHERE id = $1`, [damagedCellId])).rows[0].eco_health);
  assert.equal(xminAfter, xminBefore, "No-op clamped cell.adjust should not rewrite heap tuple (xmin unchanged)");
  assert.equal(damagedHealth, 73);

  const loggedRows = await pool.query(`SELECT kind, source FROM world_deltas WHERE tick = 99`);
  assert.equal(loggedRows.rows.length, 1, "Only non-cell audit delta should be logged");
  assert.equal(loggedRows.rows[0].kind, "burg.adjust");
  await pool.query("ROLLBACK TO SAVEPOINT delta_xmin_log");
  console.log("4. Full-health xmin preservation & world_deltas logging verified... PASSED");

  // 5. Per-step flush visibility & savepoint rollback atomicity
  await pool.query("SAVEPOINT step_order");
  await pool.query(`UPDATE sim_burg_economy SET food = 200 WHERE burg_id = $1`, [burgId]);
  await pool.query("SAVEPOINT step_1");
  await flushStepDeltas(pool, "agent:step1", 120, [{ kind: "burg.adjust", burgId, food: 35 }]);
  await pool.query("RELEASE SAVEPOINT step_1");
  const seenByStep2 = (await pool.query(`SELECT food FROM sim_burg_economy WHERE burg_id = $1`, [burgId])).rows[0];
  assert.equal(Number(seenByStep2.food), 235, "Next step must immediately see earlier step's flushed delta");

  await pool.query("SAVEPOINT step_2_fail");
  await flushStepDeltas(pool, "agent:step2", 120, [{ kind: "burg.adjust", burgId, food: 99 }]);
  await pool.query("ROLLBACK TO SAVEPOINT step_2_fail");
  const afterRollback = (await pool.query(`SELECT food FROM sim_burg_economy WHERE burg_id = $1`, [burgId])).rows[0];
  assert.equal(Number(afterRollback.food), 235, "Savepoint rollback must revert failed step's deltas");
  const logCountAfter = Number((await pool.query(`SELECT COUNT(*)::int AS c FROM world_deltas WHERE tick = 120`)).rows[0].c);
  assert.equal(logCountAfter, 1, "Savepoint rollback must also revert world_deltas row from failed step");
  await pool.query("ROLLBACK TO SAVEPOINT step_order");
  console.log("5. Per-step visibility and savepoint rollback atomicity verified... PASSED");

  // 6. Trade & Stockpile & Lair inventory deltas + Rule 7 rejection
  const twoBurgs = await pool.query(`SELECT burg_id, cell_id FROM sim_burg_economy ORDER BY burg_id ASC LIMIT 2`);
  const b1 = Number(twoBurgs.rows[0].burg_id);
  const c1 = Number(twoBurgs.rows[0].cell_id);
  const b2 = Number(twoBurgs.rows[1].burg_id);
  const c2 = Number(twoBurgs.rows[1].cell_id);
  const citRes = await pool.query(`SELECT citizen_id FROM population_demographics ORDER BY citizen_id ASC LIMIT 2`);
  const cit1 = Number(citRes.rows[0].citizen_id);
  const cit2 = Number(citRes.rows[1].citizen_id);
  const facRes = await pool.query(`SELECT id FROM sim_factions ORDER BY id ASC LIMIT 2`);
  const fac1 = Number(facRes.rows[0].id);
  const fac2 = Number(facRes.rows[1].id);
  const outRes = await pool.query(`SELECT id FROM sim_outlaw_factions ORDER BY id ASC LIMIT 1`);
  const outId = Number(outRes.rows[0].id);

  await pool.query("SAVEPOINT delta_trade");
  const lairIns = await pool.query(
    `INSERT INTO sim_fringe_lairs (faction_id, cell_id, burg_id, lair_type, manpower, heat, inventory)
     VALUES ($1, $2, $3, 'SMUGGLER_COVE', 50, 10, '{}'::jsonb) RETURNING id`,
    [outId, c1, b1]
  );
  const testLairId = Number(lairIns.rows[0].id);

  const tradeCreateV = await validateDeltas(
    [
      { kind: "burgStockpile.setInventory", burgId: b1, inventory: { grain: 42, coal: 17 } },
      { kind: "fringeLair.update", lairId: testLairId, heat: 18, inventory: { coal: 12 } },
      {
        kind: "tradeShipment.create",
        sourceBurgId: b1,
        destBurgId: b2,
        sourceFactionId: fac1,
        destFactionId: fac2,
        transportMode: "LAND",
        goodId: 34,
        goodKey: "coal",
        goodName: "Coal",
        quantity: 12,
        unitPrice: 8,
        totalGold: 100,
        tariffGold: 4,
        carriageWeight: 7.2,
        merchantCitizenId: cit1,
        crewCitizenIds: [cit2],
        guardCount: 0,
        pathCells: [c1, c2],
        startCellId: c1,
        dispatchedTick: 125,
        etaTicks: 1,
      },
      { kind: "tradeShipment.update", shipmentId: 99999999, status: "DELIVERED", pathIndex: 1, currentCellId: c2, etaTicks: 0, resolvedTick: 126 },
      { kind: "burgStockpile.setInventory", burgId: 99999999, inventory: { grain: 1 } },
      {
        kind: "tradeShipment.create",
        sourceBurgId: b1,
        destBurgId: b2,
        sourceFactionId: fac1,
        destFactionId: fac2,
        transportMode: "LAND",
        goodId: 34,
        goodKey: "coal",
        goodName: "Coal",
        quantity: 5,
        unitPrice: 5,
        totalGold: 25,
        tariffGold: 0,
        carriageWeight: 3,
        merchantCitizenId: 99999999,
        crewCitizenIds: [],
        guardCount: 0,
        pathCells: [c1, c2],
        startCellId: c1,
        dispatchedTick: 125,
        etaTicks: 1,
      },
    ],
    pool
  );
  assert.equal(tradeCreateV.ok.length, 3, `Expected 3 valid trade deltas, got ${tradeCreateV.ok.length}`);
  assert.equal(tradeCreateV.rejected.length, 3, "Expected 3 invalid trade deltas rejected by Rule 7");
  await applyDeltas(tradeCreateV.ok, pool);

  const stockRow = (await pool.query(`SELECT complex_inventory FROM sim_industrial_stockpiles WHERE burg_id = $1`, [b1])).rows[0];
  assert.equal(stockRow.complex_inventory, JSON.stringify({ grain: 42, coal: 17 }));

  const lairRow = (await pool.query(`SELECT heat, inventory FROM sim_fringe_lairs WHERE id = $1`, [testLairId])).rows[0];
  assert.equal(Number(lairRow.heat), 18);
  assert.equal(Number(lairRow.inventory.coal), 12);

  const shipRow = (
    await pool.query(
      `SELECT id, status, current_cell_id, resolved_tick FROM sim_trade_shipments WHERE dispatched_tick = 125 ORDER BY id DESC LIMIT 1`
    )
  ).rows[0];
  assert.ok(shipRow && shipRow.status === "IN_TRANSIT" && Number(shipRow.current_cell_id) === c1);

  const shipUpdV = await validateDeltas(
    [
      {
        kind: "tradeShipment.update",
        shipmentId: Number(shipRow.id),
        status: "DELIVERED",
        pathIndex: 1,
        currentCellId: c2,
        etaTicks: 0,
        resolvedTick: 126,
      },
    ],
    pool
  );
  assert.equal(shipUpdV.rejected.length, 0);
  await applyDeltas(shipUpdV.ok, pool);

  const deliveredRow = (await pool.query(`SELECT status, current_cell_id, resolved_tick FROM sim_trade_shipments WHERE id = $1`, [shipRow.id])).rows[0];
  assert.equal(deliveredRow.status, "DELIVERED");
  assert.equal(Number(deliveredRow.current_cell_id), c2);
  assert.equal(Number(deliveredRow.resolved_tick), 126);
  await pool.query("ROLLBACK TO SAVEPOINT delta_trade");
  console.log("6. Trade shipment, stockpile & lair inventory deltas + Rule 7 rejection... PASSED");

  // 7. Extended burg.set (architecture, demographics, float pools, clear_workforce), infrastructure upsert & active projects
  await pool.query("SAVEPOINT delta_burg_ops");
  const prevInfra = await pool.query(
    `SELECT level FROM sim_infrastructure WHERE burg_id = $1 AND type = 'TEST_MILL'`,
    [b1]
  );
  const baseLevel = Number(prevInfra.rows[0]?.level || 0);
  const demoStr = '{"nulls":50,"sparkborn_total":50,"dormant_sparks":25,"sensitives":24,"adepts":1}';
  const v7 = await validateDeltas(
    [
      {
        kind: "burg.set",
        burgId: b1,
        fields: {
          architecture_type: "STONE",
          demographics: demoStr,
          pop_growth_pool: 1.75,
          pop_departure_pool: 2.25,
          clear_workforce: true,
        },
      },
      { kind: "infrastructure.adjust", burgId: b1, cellId: c1, infraType: "TEST_MILL", levelDelta: 2, upsert: true },
      { kind: "infrastructure.adjust", burgId: b1, cellId: c1, infraType: "TEST_MILL", levelDelta: 1, upsert: true },
      { kind: "activeProject.create", burgId: b1, projectType: "TEST_TIER", targetTier: 3, ticksRemaining: 2 },
      { kind: "activeProject.create", burgId: 99999999, projectType: "URBAN_TIER", targetTier: 2, ticksRemaining: 20 },
      { kind: "infrastructure.adjust", burgId: b1, cellId: 99999999, infraType: "FARM", levelDelta: 1, upsert: true },
    ],
    pool
  );
  assert.equal(v7.ok.length, 4, `Expected 4 valid burg-ops deltas, got ${v7.ok.length}`);
  assert.equal(v7.rejected.length, 2, "Expected 2 invalid burg-ops deltas rejected by Rule 7");
  await applyDeltas(v7.ok, pool);

  const bAfter7 = (
    await pool.query(
      `SELECT architecture_type, demographics, pop_growth_pool, pop_departure_pool, workforce FROM sim_burg_economy WHERE burg_id = $1`,
      [b1]
    )
  ).rows[0];
  assert.equal(bAfter7.architecture_type, "STONE");
  assert.equal(bAfter7.demographics, demoStr);
  assert.equal(Number(bAfter7.pop_growth_pool), 1.75);
  assert.equal(Number(bAfter7.pop_departure_pool), 2.25);
  assert.equal(bAfter7.workforce, null);

  const infAfter = (
    await pool.query(`SELECT level FROM sim_infrastructure WHERE burg_id = $1 AND type = 'TEST_MILL'`, [b1])
  ).rows[0];
  assert.equal(Number(infAfter.level), baseLevel + 3);

  await applyDeltas([{ kind: "activeProject.advanceAll" }], pool);
  const pMid = (
    await pool.query(`SELECT ticks_remaining FROM sim_active_projects WHERE burg_id = $1 AND project_type = 'TEST_TIER'`, [b1])
  ).rows[0];
  assert.equal(Number(pMid.ticks_remaining), 1);

  await applyDeltas([{ kind: "activeProject.advanceAll" }], pool);
  const pEnd = await pool.query(`SELECT ticks_remaining FROM sim_active_projects WHERE burg_id = $1 AND project_type = 'TEST_TIER'`, [b1]);
  assert.equal(pEnd.rows.length, 0, "Completed project should be pruned after ticks_remaining <= 0");
  await pool.query("ROLLBACK TO SAVEPOINT delta_burg_ops");
  console.log("7. Extended burg.set, infra upsert & activeProject deltas + Rule 7 rejection... PASSED");

  // 8. Reaper / cleanup extensions (record_unit, workforce_empty, agent persona fields, burg.stripRuin)
  await pool.query("SAVEPOINT delta_reaper_ext");
  await pool.query(
    `UPDATE sim_burg_economy SET workforce = '{"Farmer":{"records":1,"people":10}}'::jsonb WHERE burg_id = $1`,
    [b1]
  );
  await pool.query(
    `INSERT INTO sim_infrastructure (burg_id, cell_id, type, level) VALUES ($1, $2, 'RUIN_TEST_MILL', 1) ON CONFLICT DO NOTHING`,
    [b1, c1]
  );
  const agRes = await pool.query(`SELECT id FROM sim_agents ORDER BY id ASC LIMIT 1`);
  const agId = Number(agRes.rows[0].id);

  const v8 = await validateDeltas(
    [
      { kind: "burg.set", burgId: b1, fields: { record_unit: 99, workforce_empty: true } },
      {
        kind: "agent.update",
        agentId: agId,
        fields: {
          name: "Renamed Seer",
          citizen_name: "Elara",
          profession: "Scribe",
          species: "Human",
          personality_temper: "STOIC",
          personality_instinct: "WARY",
          motivation: "Keep watch",
        },
      },
      { kind: "burg.stripRuin", burgId: b1 },
      { kind: "burg.stripRuin", burgId: 99999999 },
    ],
    pool
  );
  assert.equal(v8.ok.length, 3);
  assert.equal(v8.rejected.length, 1, "Unknown burg.stripRuin burgId must be rejected by Rule 7");
  await applyDeltas(v8.ok, pool);

  const bAfter8 = (await pool.query(`SELECT record_unit, workforce FROM sim_burg_economy WHERE burg_id = $1`, [b1])).rows[0];
  assert.equal(Number(bAfter8.record_unit), 40, "record_unit should clamp to 40");
  assert.deepEqual(bAfter8.workforce, {}, "workforce_empty must set {} jsonb");

  const agAfter8 = (
    await pool.query(
      `SELECT name, citizen_name, profession, species, personality_temper, personality_instinct, motivation FROM sim_agents WHERE id = $1`,
      [agId]
    )
  ).rows[0];
  assert.equal(agAfter8.name, "Renamed Seer");
  assert.equal(agAfter8.citizen_name, "Elara");
  assert.equal(agAfter8.profession, "Scribe");

  const infAfter8 = await pool.query(`SELECT COUNT(*)::int AS c FROM sim_infrastructure WHERE burg_id = $1`, [b1]);
  assert.equal(Number(infAfter8.rows[0].c), 0, "burg.stripRuin must remove burg infrastructure");
  const stockAfter8 = await pool.query(`SELECT COUNT(*)::int AS c FROM sim_industrial_stockpiles WHERE burg_id = $1`, [b1]);
  assert.equal(Number(stockAfter8.rows[0].c), 0, "burg.stripRuin must remove burg stockpiles");
  await pool.query("ROLLBACK TO SAVEPOINT delta_reaper_ext");
  console.log("8. Reaper / persona delta extensions & Rule 7 rejection... PASSED");

  console.log("\nALL DELTA TESTS PASSED");
}

isolateTest()
  .then((done) => main().then(done, async (e: unknown) => { await done(); throw e; }))
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("DELTA TEST FAILED - COMMIT BLOCKED:", err.message || err);
    process.exit(1);
  });
