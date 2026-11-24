/**
 * Golden day regression test (Phase 0.2).
 *
 * Runs the next simulated day in isolation (after a warm-up run so per-process caches match) and compares
 * the world fingerprint against src/scripts/goldenDay.json. Unlike testTickReplay (which proves two runs
 * match each other), this proves refactors and agent ports did not alter outcomes.
 *
 * Re-record ONLY when a change is intentionally meant to alter simulation behaviour:
 *   node dist/scripts/testGoldenDay.js --record --note="reason"
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import pool from "../db/pool.js";
import { isolateTest } from "./testIsolation.js";
import { migrate } from "../db/migrate.js";
import { executeMasterTick } from "../engine/masterOrchestrator.js";
import { worldFingerprint } from "./tickFingerprint.js";

interface GoldenDayRecord {
  seed: string;
  startTick: number;
  targetTick: number;
  recordedAt: string;
  note: string;
  fingerprint: Record<string, string>;
}

const GOLDEN_PATH = path.resolve(__dirname, "../../src/scripts/goldenDay.json");

async function main() {
  const recordMode = process.argv.includes("--record");
  const noteArg = process.argv.find((a) => a.startsWith("--note="));
  const note = noteArg ? noteArg.slice("--note=".length) : "baseline";

  await migrate(pool);

  const startTick = Number((await pool.query(`SELECT COALESCE(MAX(tick), 0) AS t FROM sim_calendar`)).rows[0]?.t ?? 0);
  const seed = process.env.SIM_SEED || "ostraka";
  const baseCitizenId = Number((await pool.query(`SELECT COALESCE(MAX(citizen_id), 0) AS m FROM population_demographics`)).rows[0].m);
  const baseAgentId = Number((await pool.query(`SELECT COALESCE(MAX(id), 0) AS m FROM sim_agents`)).rows[0].m);

  // Warm up in-process caches identically to testTickReplay before measuring the golden run.
  await pool.query("SAVEPOINT golden_warm");
  const warm = await executeMasterTick();
  assert.equal(warm.status, "success", `warmup tick failed: ${JSON.stringify(warm.failedAgents)}`);
  await pool.query("ROLLBACK TO SAVEPOINT golden_warm");

  await pool.query("SAVEPOINT golden_run");
  const r = await executeMasterTick();
  assert.equal(r.status, "success", `day ${r.currentTick} did not fully commit: ${JSON.stringify(r.failedAgents)}`);
  const fingerprint = await worldFingerprint(r.currentTick, baseCitizenId, baseAgentId);
  await pool.query("ROLLBACK TO SAVEPOINT golden_run");

  if (recordMode) {
    const payload: GoldenDayRecord = {
      seed,
      startTick,
      targetTick: r.currentTick,
      recordedAt: new Date().toISOString(),
      note,
      fingerprint,
    };
    fs.writeFileSync(GOLDEN_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    console.log(`Recorded golden day (${seed}, tick ${startTick} -> ${r.currentTick}, note="${note}") at ${GOLDEN_PATH}`);
    return;
  }

  assert.ok(fs.existsSync(GOLDEN_PATH), `Missing ${GOLDEN_PATH}. Run with --record first.`);
  const golden = JSON.parse(fs.readFileSync(GOLDEN_PATH, "utf8")) as GoldenDayRecord;

  assert.equal(seed, golden.seed, `SIM_SEED mismatch: expected "${golden.seed}", got "${seed}"`);
  assert.equal(startTick, golden.startTick, `World startTick drifted: expected ${golden.startTick}, got ${startTick}`);
  assert.equal(r.currentTick, golden.targetTick, `Target tick mismatch: expected ${golden.targetTick}, got ${r.currentTick}`);

  const allKeys = Array.from(new Set([...Object.keys(golden.fingerprint), ...Object.keys(fingerprint)]));
  const diffs: string[] = [];
  for (const k of allKeys) {
    if (golden.fingerprint[k] !== fingerprint[k]) {
      diffs.push(`${k} (expected ${golden.fingerprint[k]}, got ${fingerprint[k]})`);
    }
  }
  assert.equal(diffs.length, 0, `Golden day ${r.currentTick} drifted in: ${diffs.join("; ")}`);

  console.log(`Golden day ${r.currentTick} matches baseline "${golden.note}" (${allKeys.join(", ")})... PASSED`);
}

isolateTest()
  .then((done) => main().then(done, async (e: unknown) => { await done(); throw e; }))
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("GOLDEN DAY TEST FAILED - COMMIT BLOCKED:", err.message || err);
    process.exit(1);
  });
