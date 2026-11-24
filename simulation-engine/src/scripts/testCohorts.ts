import assert from "node:assert/strict";
import pool from "../db/pool.js";
import { migrate } from "../db/migrate.js";
import {
  backfillPopulationCohorts,
  checkCohortConservation,
  findNotableCitizenIds,
  getBurgCohortWorkforce,
} from "../engine/entities/population.js";
import { getEntityByRef } from "../engine/entities/registry.js";
import { promoteFromCohort } from "../engine/lod/promote.js";
import { isolateTest } from "./testIsolation.js";

async function main() {
  console.log("=== Testing Population Cohorts, Conservation & Deterministic Promotion (Phase 8.1-8.2) ===");
  await migrate(pool);

  // 1. Backfill cohorts inside isolated test transaction and verify exact conservation across EVERY burg
  const bf = await backfillPopulationCohorts(pool, { force: true, tick: 1 });
  assert.ok(bf.cohorts > 100 && bf.cohortPeople > 100000, `Unexpected cohort backfill summary: ${JSON.stringify(bf)}`);
  assert.ok(bf.notablesRegistered < 5000, `Unexpected notable homonym fanout: ${bf.notablesRegistered}`);
  const report = await checkCohortConservation(pool);
  assert.equal(report.mismatches.length, 0, `Conservation mismatches found: ${JSON.stringify(report.mismatches.slice(0, 5))}`);
  console.log(`1. Cohort backfill & conservation (${bf.cohorts} cohorts, ${bf.cohortPeople} cohort people, ${bf.notablePeople} notable people, ${report.exactMatches}/${report.burgsChecked} burgs exact)... PASSED`);

  // 2. Cohort workforce adapter matches total adult civilian headcount on Burg 1 (Excelsis)
  const rawWf = await pool.query(
    `SELECT COALESCE(profession, '') AS prof, COALESCE(SUM(unit_size), 0)::int AS people
     FROM population_demographics
     WHERE settlement_id = 1 AND life_stage = 'ADULT' AND allegiance_status = 'CIVILIAN'
     GROUP BY 1 ORDER BY 1`
  );
  const cohWfMap = await getBurgCohortWorkforce(pool, [1]);
  const cohWf = cohWfMap.get(1) || {};
  for (const r of rawWf.rows) {
    assert.equal(cohWf[String(r.prof)]?.people || 0, Number(r.people), `Workforce mismatch for profession "${r.prof}"`);
  }
  console.log(`2. getBurgCohortWorkforce exact headcount parity for Excelsis (${rawWf.rows.length} trades)... PASSED`);

  // 3. Deterministic promoteFromCohort (same slotKey -> same citizen, no double decrement; new slotKey -> new citizen)
  const sumBefore = Number((await pool.query(`SELECT COALESCE(SUM(count), 0)::int AS c FROM population_cohorts WHERE burg_id = 1`)).rows[0].c);
  const first = await promoteFromCohort(pool, 1, { ageBand: "ADULT", allegiance: "CIVILIAN" }, "guard_gate_a", 1);
  assert.ok(first && !first.alreadyExisted, "First promote must create a new promoted person");
  assert.ok(first.name.includes(" "), "Promoted person must receive a seeded First Last name");
  const ent1 = await getEntityByRef(pool, first.entityRef);
  assert.ok(ent1 && ent1.lod === "micro", "Promoted person must register in entities at micro LOD");
  const sumAfter1 = Number((await pool.query(`SELECT COALESCE(SUM(count), 0)::int AS c FROM population_cohorts WHERE burg_id = 1`)).rows[0].c);
  assert.equal(sumAfter1, sumBefore - 1, "Cohort count must decrement by 1 on first promote");

  const repeat = await promoteFromCohort(pool, 1, { ageBand: "ADULT", allegiance: "CIVILIAN" }, "guard_gate_a", 1);
  assert.ok(repeat && repeat.alreadyExisted && repeat.citizenId === first.citizenId, "Same slotKey must return the exact same citizen");
  const sumRepeat = Number((await pool.query(`SELECT COALESCE(SUM(count), 0)::int AS c FROM population_cohorts WHERE burg_id = 1`)).rows[0].c);
  assert.equal(sumRepeat, sumAfter1, "Repeating same slotKey must not decrement cohort count again");

  const second = await promoteFromCohort(pool, 1, { ageBand: "ADULT", allegiance: "CIVILIAN" }, "guard_gate_b", 1);
  assert.ok(second && !second.alreadyExisted && second.citizenId !== first.citizenId, "New slotKey must promote a different person");
  const sumAfter2 = Number((await pool.query(`SELECT COALESCE(SUM(count), 0)::int AS c FROM population_cohorts WHERE burg_id = 1`)).rows[0].c);
  assert.equal(sumAfter2, sumBefore - 2, "New slotKey must decrement cohort count by 1 more");

  const reportAfterPromote = await checkCohortConservation(pool, [1]);
  assert.equal(reportAfterPromote.mismatches.length, 0, "Conservation must still hold after promotion");
  console.log(`3. Deterministic promoteFromCohort & slot idempotency (${first.name} #${first.citizenId} / ${second.name} #${second.citizenId})... PASSED`);

  // 4. Citizens named in chronicle events are preserved as notables (scoped cleanly without homonym bloat)
  const citSample = (await pool.query(
    `SELECT citizen_id, settlement_id FROM population_demographics
     WHERE allegiance_status = 'CIVILIAN' AND settlement_id IS NOT NULL
     ORDER BY citizen_id DESC LIMIT 1`
  )).rows[0];
  const uniqueName = "Vaelor Floodgatekeeper";
  await pool.query(`UPDATE population_demographics SET name = $1 WHERE citizen_id = $2`, [uniqueName, citSample.citizen_id]);
  await pool.query(
    `INSERT INTO sim_events (tick, burg_id, type, message, tier) VALUES (99, $1, 'TEST_NAME_PRESERVE', $2, 'MINOR')`,
    [citSample.settlement_id, `Courier reported that ${uniqueName} unlocked the eastern floodgate.`]
  );
  const notables = await findNotableCitizenIds(pool);
  assert.ok(notables.has(Number(citSample.citizen_id)), `Citizen named in sim_events (${uniqueName}) must be kept as a notable`);
  console.log("4. Citizens named in sim_events / sim_gm_memories stay protected notables... PASSED");

  console.log("\nALL COHORT & PROMOTION TESTS PASSED");
}

isolateTest()
  .then((done) => main().then(done, async (e: unknown) => { await done(); throw e; }))
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("COHORT TEST FAILED - COMMIT BLOCKED:", err.message || err);
    process.exit(1);
  });
