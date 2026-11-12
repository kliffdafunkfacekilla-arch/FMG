/**
 * Runs the next simulation day several times against the live database, rolling each run back, so the
 * world does not advance. Reports per-agent timings and whether runs of the same day are identical.
 *
 *   node dist/scripts/benchTick.js [runs=3]
 *
 * Run 1 warms caches; runs 2..n are compared. Inside testIsolation the tick's own transaction becomes a
 * savepoint and every run is undone with ROLLBACK TO SAVEPOINT.
 */
import pool from "../db/pool.js";
import { isolateTest } from "./testIsolation.js";
import { applySchemaPatches } from "../db/schemaPatches.js";
import { executeMasterTick, TickResult } from "../engine/masterOrchestrator.js";
import { worldFingerprint } from "./tickFingerprint.js";

async function main() {
  // Before the first savepoint: a patch applied inside a run would be rolled back with it
  await applySchemaPatches(pool);
  const runs = Math.max(2, Number(process.argv[2]) || 3);
  const baseCitizenId = Number((await pool.query(`SELECT COALESCE(MAX(citizen_id), 0) m FROM population_demographics`)).rows[0].m);
  const results: TickResult[] = [];
  const prints: Record<string, string>[] = [];
  for (let i = 0; i < runs; i++) {
    await pool.query("SAVEPOINT bench_run");
    const r = await executeMasterTick();
    results.push(r);
    prints.push(await worldFingerprint(r.currentTick, baseCitizenId).catch(e => ({ error: String(e.message) })));
    await pool.query("ROLLBACK TO SAVEPOINT bench_run");
    console.log(`run ${i + 1}: tick ${r.currentTick}, ${r.totalMs} ms, ${r.status}${r.failedAgents.length ? " " + JSON.stringify(r.failedAgents) : ""}`);
  }
  const timed = results.slice(1);
  const avg = (k: string) => Math.round(timed.reduce((s, r) => s + (r.timings[k] || 0), 0) / timed.length);
  console.log("\nAverage ms per step (runs 2..n):");
  for (const k of Object.keys(results[results.length - 1]!.timings).sort((a, b) => avg(b) - avg(a))) {
    const q = Math.round(timed.reduce((s, r) => s + (r.queries?.[k] || 0), 0) / timed.length);
    console.log(`  ${String(avg(k)).padStart(7)} ms ${String(q).padStart(6)} queries  ${k}`);
  }
  console.log(`  ${String(Math.round(timed.reduce((s, r) => s + r.totalMs, 0) / timed.length)).padStart(7)}  TOTAL`);

  const last = results[results.length - 1]!;
  if (last.profile) {
    console.log("\nSlowest statements (last run):");
    for (const k of Object.keys(last.timings).sort((x, y) => (last.timings[y] || 0) - (last.timings[x] || 0)).slice(0, 8)) {
      for (const s of (last.profile[k] || []).slice(0, 3)) console.log(`  ${k.padEnd(18)} ${String(s.ms).padStart(5)} ms ${String(s.calls).padStart(5)}x  ${s.sql}`);
    }
  }

  const base = prints[1]!;
  console.log("\nReplay of the same day (runs 2..n vs run 2):");
  for (const key of Object.keys(base)) {
    const same = prints.slice(2).every(p => p[key] === base[key]);
    console.log(`  ${same ? "identical" : "DIFFERS  "}  ${key}`);
  }
}

isolateTest()
  .then(done => main().then(done, async (e: unknown) => { await done(); throw e; }))
  .then(() => process.exit(0))
  .catch(err => { console.error("Bench failed:", err); process.exit(1); });
