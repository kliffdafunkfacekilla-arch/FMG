/**
 * Meso replay & multi-focus shared-border deduplication test (Phase 10.3 & 13.3).
 */
import assert from "node:assert/strict";
import pool from "../db/pool.js";
import { isolateTest } from "./testIsolation.js";
import { migrate } from "../db/migrate.js";
import { executeMasterTick } from "../engine/masterOrchestrator.js";
import { focusRegion, getFocusedCellIds, unfocusRegion } from "../engine/meso/region.js";
import { runFocusedMesoDay } from "../engine/meso/runMesoDay.js";
import type { Delta } from "../engine/deltas/types.js";
import { worldFingerprint } from "./tickFingerprint.js";

async function main() {
  console.log("=== Testing Focused Meso Replay & Multi-Focus Shared Borders (Phase 10 & 13.3) ===");
  await migrate(pool);

  // Pick two nearby land cells whose rings overlap cleanly
  const pairRes = await pool.query(
    `SELECT a.id AS a_id, b.id AS b_id
     FROM sim_cells a
     JOIN sim_cells b ON b.id > a.id
     WHERE a.elevation >= 20 AND b.elevation >= 20
       AND ((a.center_x - b.center_x)^2 + (a.center_y - b.center_y)^2) BETWEEN 10 AND 900
     ORDER BY a.id ASC, b.id ASC
     LIMIT 1`
  );
  assert.ok(pairRes.rows.length > 0, "Expected two nearby land cells for overlapping multi-focus test");
  const cellA = Number(pairRes.rows[0].a_id);
  const cellB = Number(pairRes.rows[0].b_id);

  const baseCit = Number((await pool.query(`SELECT COALESCE(MAX(citizen_id), 0)::int AS m FROM population_demographics`)).rows[0].m);
  const baseAg = Number((await pool.query(`SELECT COALESCE(MAX(id), 0)::int AS m FROM sim_agents`)).rows[0].m);

  // 1. Single-region focus replay determinism
  const focusA = await focusRegion(pool, cellA);
  const fpA: Record<string, string>[] = [];
  let runTickA = 0;

  for (let i = 0; i < 2; i++) {
    await pool.query("SAVEPOINT meso_replay_single");
    const r = await executeMasterTick();
    runTickA = r.currentTick;
    assert.equal(r.status, "success");
    fpA.push(await worldFingerprint(runTickA, baseCit, baseAg));
    await pool.query("ROLLBACK TO SAVEPOINT meso_replay_single");
  }
  const diffsA = Object.keys(fpA[0]!).filter((k) => fpA[0]![k] !== fpA[1]![k]);
  assert.equal(diffsA.length, 0, `Single focused meso replay differed in: ${diffsA.join(", ")}`);
  console.log(`1. Single focused region (cell ${cellA}, ${focusA.record.cell_ids.length} ring cells) replayed 7/7 identically... PASSED`);

  // 2. Concurrent multi-focus (Phase 13.3) with overlapping shared borders
  const focusB = await focusRegion(pool, cellB);
  const shared = focusA.record.cell_ids.filter((id) => focusB.record.cell_ids.includes(id));
  assert.ok(shared.length >= 1, "Expected overlapping border cells between adjacent focused rings");
  const sharedCellId = shared[0]!;
  const unionCount = new Set([...focusA.record.cell_ids, ...focusB.record.cell_ids]).size;

  const emittedMulti: Delta[] = [];
  const multiSummary = await runFocusedMesoDay(pool, 99, "Greenspan", "Year 1", (d) => emittedMulti.push(d));
  assert.equal(multiSummary.regionsRun, 2, "Expected 2 active focused regions");
  assert.equal(multiSummary.cellsStepped, unionCount, `Expected union=${unionCount} deduplicated cells, got ${multiSummary.cellsStepped}`);
  const sharedCellSets = emittedMulti.filter((d) => d.kind === "cell.set" && d.cellId === sharedCellId);
  assert.equal(sharedCellSets.length, 1, `Shared border cell ${sharedCellId} must step once, got ${sharedCellSets.length} cell.set deltas`);

  const fpM: Record<string, string>[] = [];
  let runTickM = 0;
  for (let i = 0; i < 2; i++) {
    await pool.query("SAVEPOINT meso_replay_multi");
    const r = await executeMasterTick();
    runTickM = r.currentTick;
    assert.equal(r.status, "success");
    fpM.push(await worldFingerprint(runTickM, baseCit, baseAg));
    await pool.query("ROLLBACK TO SAVEPOINT meso_replay_multi");
  }
  const diffsM = Object.keys(fpM[0]!).filter((k) => fpM[0]![k] !== fpM[1]![k]);
  assert.equal(diffsM.length, 0, `Multi-focus replay differed in: ${diffsM.join(", ")}`);

  // Unfocusing A must keep shared border cell focused for B
  await unfocusRegion(pool, cellA);
  const remaining = await getFocusedCellIds(pool);
  assert.equal(remaining.has(sharedCellId), true, "Shared border cell must stay focused while region B remains active");
  await unfocusRegion(pool, cellB);
  assert.equal((await getFocusedCellIds(pool)).size, 0, "All focused cells cleared after unfocusing both regions");
  console.log(`2. Multi-focus (cells ${cellA} & ${cellB}, ${shared.length} shared border cells) deduplicated & 7/7 identical... PASSED`);

  console.log("\nALL MESO REPLAY & MULTI-FOCUS TESTS PASSED");
}

isolateTest()
  .then((done) => main().then(done, async (e: unknown) => { await done(); throw e; }))
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("MESO REPLAY TEST FAILED - COMMIT BLOCKED:", err.message || err);
    process.exit(1);
  });
