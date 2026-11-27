/**
 * Builds the frozen test world: a separate database, freshly reset to tick 1, that `npm test` and the
 * pre-commit hook run against instead of the live world. Playing, opening the dashboard (which promotes
 * citizens into focused regions) or running the clock on the live world can then never block a commit.
 *
 *   npm run test:world          (drops and rebuilds it; takes a few minutes)
 *
 * The database is TEST_DATABASE_URL, or the live DATABASE_URL with the database name `fmg_test`.
 * A world reset is not bit-for-bit repeatable, so after rebuilding, re-record the golden day on it:
 *   npm run test:golden -- --note="rebuilt test world"
 */
import path from "node:path";
import dotenv from "dotenv";
import { Client } from "pg";

dotenv.config({ path: path.resolve(__dirname, "..", "..", ".env") });

const LIVE_DEFAULT = "postgres://postgres@localhost:5432/postgres";

export function testDatabaseUrl(): string {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  const u = new URL(process.env.DATABASE_URL || LIVE_DEFAULT);
  u.pathname = "/fmg_test";
  return u.toString();
}

async function main() {
  const liveUrl = process.env.DATABASE_URL || LIVE_DEFAULT;
  const testUrl = testDatabaseUrl();
  const liveName = new URL(liveUrl).pathname.slice(1);
  const testName = new URL(testUrl).pathname.slice(1);
  if (!/^[a-z_][a-z0-9_]*$/i.test(testName)) throw new Error(`Unsafe test database name "${testName}"`);
  if (testName === liveName) throw new Error(`The test database must not be the live one ("${liveName}").`);

  // Drop and create it from a connection to the live server (a database cannot drop itself).
  const admin = new Client({ connectionString: liveUrl });
  await admin.connect();
  console.log(`[testWorld] Recreating database "${testName}"...`);
  await admin.query(`DROP DATABASE IF EXISTS "${testName}" WITH (FORCE)`);
  await admin.query(`CREATE DATABASE "${testName}"`);
  await admin.end();

  // Everything below must use the test database: set it before the pool module is first loaded
  // (dotenv never overrides a variable that is already set).
  process.env.DATABASE_URL = testUrl;
  process.env.STORY_LLM = "off";
  const { resetWorld } = require("../engine/resetWorld.js") as typeof import("../engine/resetWorld.js");
  const pool = (require("../db/pool.js") as typeof import("../db/pool.js")).default;
  const db = (await pool.query(`SELECT current_database() AS d`)).rows[0].d;
  if (db !== testName) throw new Error(`Connected to "${db}", expected "${testName}"; refusing to reset.`);

  const t0 = Date.now();
  const out = await resetWorld();
  console.log(`[testWorld] ${out.message} (${Math.round((Date.now() - t0) / 1000)} s)`);
  // Same shape as the live world: ordinary citizens live in population_cohorts, only notables keep a row
  // (what scripts/prunePopulationDemographics does after a live reset).
  const { pruneNonNotableDemographics } = require("../engine/entities/population.js") as typeof import("../engine/entities/population.js");
  const pruned = await pruneNonNotableDemographics(pool, { tick: 1 });
  await pool.query(`VACUUM (FULL, ANALYZE) population_demographics`);
  console.log(`[testWorld] Folded ${pruned.deletedRows} ordinary citizens into cohorts; ${pruned.keptNotables} notables keep a record.`);

  // A reset keeps player character sheets, so the live world has them and some suites need one.
  // Copy the sheets (only those: GM memories and actions are play history, not world setup).
  const live = new Client({ connectionString: liveUrl });
  await live.connect();
  const pcs = (await live.query(`SELECT * FROM sim_player_character ORDER BY id`)).rows;
  await live.end();
  if (pcs.length > 0) {
    await pool.query(`DELETE FROM sim_player_character`);
    await pool.query(
      `INSERT INTO sim_player_character SELECT * FROM json_populate_recordset(NULL::sim_player_character, $1::json)`,
      [JSON.stringify(pcs)]
    );
    await pool.query(
      `SELECT setval(pg_get_serial_sequence('sim_player_character', 'id'), (SELECT MAX(id) FROM sim_player_character))
       WHERE pg_get_serial_sequence('sim_player_character', 'id') IS NOT NULL`
    );
  }
  console.log(`[testWorld] Copied ${pcs.length} player character sheet${pcs.length === 1 ? "" : "s"} from the live world.`);
  await pool.end();
  console.log(`[testWorld] Done. Now re-record the golden day: npm run test:golden -- --note="rebuilt test world"`);
}

/** `--check`: the test world exists and is a reset world (used by run-tests.cjs before any suite runs). */
async function check() {
  const testUrl = testDatabaseUrl();
  const c = new Client({ connectionString: testUrl });
  try {
    await c.connect();
    const t = (await c.query(`SELECT COALESCE(MAX(tick), 0)::int AS t FROM sim_calendar`)).rows[0].t;
    console.log(`Test world: database "${new URL(testUrl).pathname.slice(1)}" at tick ${t}.`);
  } catch (e: any) {
    console.error(`\nNo usable test world at ${new URL(testUrl).pathname.slice(1)} (${e?.message || e}).`);
    console.error(`Build it once with:  npm run test:world   then:  npm run test:golden -- --note="rebuilt test world"`);
    process.exitCode = 1;
  } finally {
    await c.end().catch(() => {});
  }
}

if (require.main === module) {
  (process.argv.includes("--check") ? check() : main()).then(() => process.exit(process.exitCode ?? 0)).catch((e) => {
    console.error("[testWorld] failed:", e?.message || e);
    process.exit(1);
  });
}
