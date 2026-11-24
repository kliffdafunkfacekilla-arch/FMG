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

  console.log("\nALL DELTA TESTS PASSED");
}

isolateTest()
  .then((done) => main().then(done, async (e: unknown) => { await done(); throw e; }))
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("DELTA TEST FAILED - COMMIT BLOCKED:", err.message || err);
    process.exit(1);
  });
