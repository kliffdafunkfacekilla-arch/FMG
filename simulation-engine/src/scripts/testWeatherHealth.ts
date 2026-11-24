import assert from "node:assert/strict";
import pool from "../db/pool.js";
import { isolateTest } from "./testIsolation.js";
import { applySchemaPatches } from "../db/schemaPatches.js";
import { runWeatherAgent } from "../engine/agents/weatherAgent.js";
import { runSeeded } from "../engine/rng.js";

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

  // 3. B1 Geographic front targeting: a front over a known burg hits it and leaves a far-away burg untouched
  await pool.query("SAVEPOINT weather_geo_front");
  const boundsRow = (await pool.query(
    `SELECT MIN(center_x) AS min_x, MAX(center_x) AS max_x, MIN(center_y) AS min_y, MAX(center_y) AS max_y FROM sim_cells`
  )).rows[0];
  const minX = Number(boundsRow.min_x) || 0;
  const maxX = Number(boundsRow.max_x) || 6120;
  const minY = Number(boundsRow.min_y) || 0;
  const maxY = Number(boundsRow.max_y) || 2496;

  const westBurg = (await pool.query(`
    SELECT b.burg_id, b.name, c.center_x, c.center_y
    FROM sim_burg_economy b JOIN sim_cells c ON b.cell_id = c.id
    WHERE b.pop_null > 20
    ORDER BY c.center_x ASC, b.burg_id ASC LIMIT 1
  `)).rows[0];
  const eastBurg = (await pool.query(`
    SELECT b.burg_id, b.name, c.center_x, c.center_y
    FROM sim_burg_economy b JOIN sim_cells c ON b.cell_id = c.id
    WHERE b.pop_null > 20
    ORDER BY c.center_x DESC, b.burg_id DESC LIMIT 1
  `)).rows[0];
  assert.ok(westBurg && eastBurg && Number(westBurg.burg_id) !== Number(eastBurg.burg_id), "Need two separated burgs");

  await pool.query(`UPDATE sim_burg_economy SET food = 5000, unrest = 20, health = 80 WHERE burg_id = ANY($1::int[])`, [
    [Number(westBurg.burg_id), Number(eastBurg.burg_id)],
  ]);
  await pool.query(`DELETE FROM sim_weather_fronts`);
  const xPct = ((Number(westBurg.center_x) - minX) / Math.max(1, maxX - minX)) * 100;
  const yPct = ((Number(westBurg.center_y) - minY) / Math.max(1, maxY - minY)) * 100;
  await pool.query(
    `INSERT INTO sim_weather_fronts (type, x, y, dx, dy, radius, lifetime) VALUES ('DROUGHT', $1, $2, 0, 0, 4, 5)`,
    [xPct, yPct]
  );

  await runSeeded(42, () => runWeatherAgent(pool, 3, "Frostin", 3, "Geo Front Test", false));

  const afterRes = await pool.query(`SELECT burg_id, food, unrest FROM sim_burg_economy WHERE burg_id = ANY($1::int[])`, [
    [Number(westBurg.burg_id), Number(eastBurg.burg_id)],
  ]);
  const byId = new Map<number, any>(afterRes.rows.map((r: any) => [Number(r.burg_id), r]));
  const westAfter = byId.get(Number(westBurg.burg_id));
  const eastAfter = byId.get(Number(eastBurg.burg_id));
  assert.ok(Number(westAfter.food) < 5000 && Number(westAfter.unrest) > 20, `Front over ${westBurg.name} did not hit it: ${JSON.stringify(westAfter)}`);
  assert.equal(Number(eastAfter.food), 5000, `Distant burg ${eastBurg.name} should be untouched (food)`);
  assert.equal(Number(eastAfter.unrest), 20, `Distant burg ${eastBurg.name} should be untouched (unrest)`);
  await pool.query("ROLLBACK TO SAVEPOINT weather_geo_front");
  console.log(`3. Front over ${westBurg.name} hit it (${westAfter.food} food, ${westAfter.unrest} unrest) and left ${eastBurg.name} untouched... PASSED`);

  console.log("\nALL WEATHER HEALTH TESTS PASSED");
}

isolateTest()
  .then((done) => main().then(done, async (e: unknown) => { await done(); throw e; }))
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("WEATHER HEALTH TEST FAILED - COMMIT BLOCKED:", err.message || err);
    process.exit(1);
  });
