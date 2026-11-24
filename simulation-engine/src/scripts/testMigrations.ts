import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import pool from "../db/pool.js";
import { migrate, migrateDown } from "../db/migrate.js";
import { isolateTest } from "./testIsolation.js";

async function main() {
  console.log("=== Testing Numbered SQL Migrations (Phase 1) ===");

  const migrationsDir = path.resolve(__dirname, "../../src/db/migrations");
  const expectedMax = fs
    .readdirSync(migrationsDir)
    .map((f) => /^(\d{4})_[a-zA-Z0-9_]+\.sql$/.exec(f))
    .filter((m): m is RegExpExecArray => Boolean(m))
    .reduce((mx, m) => Math.max(mx, Number(m[1])), 0);

  assert.ok(expectedMax >= 1, `Expected at least migration 0001 in ${migrationsDir}`);

  // 1. Running migrate() brings DB up to the highest file version and is idempotent
  const first = await migrate(pool);
  assert.equal(first.currentVersion, expectedMax, `Expected schema_version MAX=${expectedMax}, got ${first.currentVersion}`);

  const second = await migrate(pool);
  assert.equal(second.applied.length, 0, `Second migrate() should apply nothing, got ${JSON.stringify(second.applied)}`);
  assert.equal(second.currentVersion, expectedMax);
  console.log(`1. migrate() reached version ${expectedMax} and second run was idempotent... PASSED`);

  // 2. Temp migration + down-migration smoke test inside the rolled-back isolation transaction
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ostraka-mig-"));
  try {
    fs.writeFileSync(
      path.join(tmpDir, "9001_smoke.sql"),
      `CREATE TABLE _mig_smoke (id INT PRIMARY KEY, label TEXT NOT NULL);\nINSERT INTO _mig_smoke VALUES (1, 'ok');\n`,
      "utf8"
    );
    fs.writeFileSync(
      path.join(tmpDir, "9001_smoke.down.sql"),
      `DROP TABLE IF EXISTS _mig_smoke;\n`,
      "utf8"
    );

    const upRes = await migrate(pool, { migrationsDir: tmpDir });
    assert.deepEqual(upRes.applied, [9001], "Smoke migration 9001 did not apply");
    assert.equal(upRes.currentVersion, 9001);
    const checkRow = await pool.query(`SELECT label FROM _mig_smoke WHERE id = 1`);
    assert.equal(checkRow.rows[0]?.label, "ok", "Smoke migration table missing inserted row");

    const downRes = await migrateDown(pool, expectedMax, { migrationsDir: tmpDir });
    assert.deepEqual(downRes.reverted, [9001], "Down migration 9001 did not revert");
    assert.equal(downRes.currentVersion, expectedMax);
    const existsRes = await pool.query(`SELECT to_regclass('public._mig_smoke') AS reg`);
    assert.equal(existsRes.rows[0]?.reg, null, "Down migration failed to drop _mig_smoke");
    console.log("2. Temporary up & --down rollback verified cleanly... PASSED");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  console.log("\nALL MIGRATION TESTS PASSED");
}

isolateTest()
  .then((done) => main().then(done, async (e: unknown) => { await done(); throw e; }))
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("MIGRATION TEST FAILED - COMMIT BLOCKED:", err.message || err);
    process.exit(1);
  });
