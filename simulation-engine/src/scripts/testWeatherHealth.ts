import assert from "node:assert/strict";
import pool from "../db/pool.js";
import { isolateTest } from "./testIsolation.js";
import { applySchemaPatches } from "../db/schemaPatches.js";
import { runWeatherAgent } from "../engine/agents/weatherAgent.js";

async function main() {
  console.log("=== Testing Weather Health Update Filter (A1) ===");
  await applySchemaPatches(pool);

  const cellsRes = await pool.query(`SELECT id FROM sim_cells ORDER BY id ASC LIMIT 2`);
  assert.equal(cellsRes.rows.length, 2, "Need at least 2 cells in sim_cells");
  const fullCellId = Number(cellsRes.rows[0].id);
  const damagedCellId = Number(cellsRes.rows[1].id);

  // 1. MERCY phase: skips full-health cell (xmin unchanged) and heals damaged cell by +3
  await pool.query("SAVEPOINT weather_mercy");
  await pool.query(`UPDATE sim_cells SET eco_health = 100, eco_max = 100 WHERE id = $1`, [fullCellId]);
  await pool.query(`UPDATE sim_cells SET eco_health = 70, eco_max = 100 WHERE id = $1`, [damagedCellId]);
  const fullBefore = await pool.query(`SELECT xmin::text AS xmin, eco_health FROM sim_cells WHERE id = $1`, [fullCellId]);
  const fullXminBefore = String(fullBefore.rows[0].xmin);

  await runWeatherAgent(pool, 2, "Shadowburn", 2, "Mercy Test", false);

  const fullAfter = await pool.query(`SELECT xmin::text AS xmin, eco_health FROM sim_cells WHERE id = $1`, [fullCellId]);
  const damagedAfter = await pool.query(`SELECT eco_health FROM sim_cells WHERE id = $1`, [damagedCellId]);
  assert.equal(String(fullAfter.rows[0].xmin), fullXminBefore, "MERCY rewrote full-health cell row (xmin changed)");
  assert.equal(Number(fullAfter.rows[0].eco_health), 100);
  assert.equal(Number(damagedAfter.rows[0].eco_health), 73, "MERCY did not heal damaged cell by +3");
  await pool.query("ROLLBACK TO SAVEPOINT weather_mercy");
  console.log("1. MERCY phase skips full-health cells (xmin unchanged) and heals damaged cell (+3)... PASSED");

  // 2. VOID_DRAIN phase (Dryspell, dayOfMonth % 12 === 5): skips full-health cell and heals damaged cell by +2
  await pool.query("SAVEPOINT weather_void_drain");
  await pool.query(`UPDATE sim_cells SET eco_health = 100, eco_max = 100 WHERE id = $1`, [fullCellId]);
  await pool.query(`UPDATE sim_cells SET eco_health = 70, eco_max = 100 WHERE id = $1`, [damagedCellId]);
  const fullVoidBefore = await pool.query(`SELECT xmin::text AS xmin FROM sim_cells WHERE id = $1`, [fullCellId]);
  const fullVoidXminBefore = String(fullVoidBefore.rows[0].xmin);

  await runWeatherAgent(pool, 5, "Dryspell", 5, "VoidDrain Test", false);

  const fullVoidAfter = await pool.query(`SELECT xmin::text AS xmin, eco_health FROM sim_cells WHERE id = $1`, [fullCellId]);
  const damagedVoidAfter = await pool.query(`SELECT eco_health FROM sim_cells WHERE id = $1`, [damagedCellId]);
  assert.equal(String(fullVoidAfter.rows[0].xmin), fullVoidXminBefore, "VOID_DRAIN rewrote full-health cell row (xmin changed)");
  assert.equal(Number(fullVoidAfter.rows[0].eco_health), 100);
  assert.equal(Number(damagedVoidAfter.rows[0].eco_health), 72, "VOID_DRAIN did not heal damaged cell by +2");
  await pool.query("ROLLBACK TO SAVEPOINT weather_void_drain");
  console.log("2. VOID_DRAIN phase skips full-health cells (xmin unchanged) and heals damaged cell (+2)... PASSED");

  console.log("\nALL WEATHER HEALTH TESTS PASSED");
}

isolateTest()
  .then((done) => main().then(done, async (e: unknown) => { await done(); throw e; }))
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("WEATHER HEALTH TEST FAILED - COMMIT BLOCKED:", err.message || err);
    process.exit(1);
  });
