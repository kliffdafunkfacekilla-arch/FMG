/**
 * Population ledger tests (rule 9). Runs inside a rolled-back transaction (testIsolation.ts): the live
 * world is unchanged afterwards.
 *
 * Burg counters (pop_null, pop_attuned) and citizen records move together:
 * 1. A record stands for the burg's own people-per-record density, not a fixed 12.
 * 2. Growth splits null and attuned by the burg's real mix and always adds a whole unit.
 * 3. People who left the counters outside births and deaths retire records once a full unit has left.
 */
import pool from "../db/pool.js";
import { isolateTest } from "./testIsolation.js";
import { recordLedger, splitByShare } from "../engine/agents/burgOperationsAgent.js";
import { executeMasterTick } from "../engine/masterOrchestrator.js";
import { applySchemaPatches } from "../db/schemaPatches.js";

function check(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  await applySchemaPatches(pool);
  const l = recordLedger(6786, 7774, 1594);
  check(l.unit === 9, `14,560 people over 1,594 records should be 9 per record, got ${l.unit}`);
  check(Math.abs(l.attunedShare - 7774 / 14560) < 1e-9, "attuned share is not the burg's real mix");
  check(recordLedger(90, 18, 0).unit === 12, "a burg without records should fall back to 12 per record");
  check(recordLedger(100000, 0, 10).unit === 40 && recordLedger(5, 0, 100).unit === 3, "unit not clamped to 3..40");
  console.log("1. A record stands for the burg's own density (14,560 people / 1,594 records = 9)... PASSED");

  for (const [unit, share] of [[9, 0.534], [12, 0.5], [3, 0.9], [40, 0.01]] as const) {
    const s = splitByShare(unit, share);
    check(s.nulls + s.attuned === unit && s.nulls >= 0 && s.attuned >= 0, `split of ${unit} at ${share} is ${JSON.stringify(s)}`);
  }
  check(splitByShare(9, 0.534).attuned === 5, "9 people at 53% attuned should give 5 attuned");
  console.log("2. Growth splits a whole unit by the burg's real null/attuned mix... PASSED");

  // A burg that has lost three units' worth of people outside births and deaths
  const burg = (await pool.query(`
    SELECT b.burg_id, b.pop_null, COALESCE(b.pop_attuned, 0) AS pop_attuned,
           (SELECT COUNT(*)::int FROM population_demographics d WHERE d.settlement_id = b.burg_id AND d.allegiance_status NOT IN ('DECEASED', 'DEPARTED')) AS records
    FROM sim_burg_economy b WHERE b.parent_burg_id IS NULL AND b.pop_null > 1000 ORDER BY b.burg_id LIMIT 1`)).rows[0];
  check(burg && burg.records > 50, "no burg with records to test with");
  const unit = recordLedger(Number(burg.pop_null), Number(burg.pop_attuned), Number(burg.records)).unit;
  await pool.query(`UPDATE sim_burg_economy SET pop_departure_pool = $1 WHERE burg_id = $2`, [unit * 3 + 1, burg.burg_id]);
  const departedBefore = Number((await pool.query(`SELECT COUNT(*)::int n FROM population_demographics WHERE settlement_id = $1 AND allegiance_status = 'DEPARTED'`, [burg.burg_id])).rows[0].n);
  const day = await executeMasterTick();
  check(day.status === "success", `the day did not fully commit: ${JSON.stringify(day.failedAgents)}`);
  const departedAfter = Number((await pool.query(`SELECT COUNT(*)::int n FROM population_demographics WHERE settlement_id = $1 AND allegiance_status = 'DEPARTED'`, [burg.burg_id])).rows[0].n);
  const pool2 = Number((await pool.query(`SELECT pop_departure_pool p FROM sim_burg_economy WHERE burg_id = $1`, [burg.burg_id])).rows[0].p);
  check(departedAfter - departedBefore >= 3, `expected at least 3 records to depart, ${departedAfter - departedBefore} did`);
  check(pool2 < unit, `the departure pool kept ${pool2}, a full unit (${unit}) or more`);
  console.log(`3. ${unit * 3 + 1} people gone at ${unit} per record retired ${departedAfter - departedBefore} records, ${pool2} left in the pool... PASSED`);

  console.log("\nALL POPULATION LEDGER TESTS PASSED");
}

isolateTest()
  .then(done => main().then(done, async (e: unknown) => { await done(); throw e; }))
  .then(() => process.exit(0))
  .catch(err => {
    console.error("POPULATION LEDGER TEST FAILED - COMMIT BLOCKED:", err.message || err);
    process.exit(1);
  });
