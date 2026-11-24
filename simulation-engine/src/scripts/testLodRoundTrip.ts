import assert from "node:assert/strict";
import pool from "../db/pool.js";
import { migrate } from "../db/migrate.js";
import { backfillPopulationCohorts, checkCohortConservation } from "../engine/entities/population.js";
import { getEntityByRef } from "../engine/entities/registry.js";
import { unfocusArea } from "../engine/lod/demote.js";
import { focusArea } from "../engine/lod/focus.js";
import { writeBackNpcDeath } from "../engine/micro/writeBack.js";
import { isolateTest } from "./testIsolation.js";
import { worldFingerprint } from "./tickFingerprint.js";

async function main() {
  console.log("=== Testing Focus -> Unfocus LOD Round Trip (Phase 8.3) ===");
  await migrate(pool);

  await backfillPopulationCohorts(pool, { force: true, tick: 1 });
  const maxCitBefore = Number((await pool.query(`SELECT COALESCE(MAX(citizen_id), 0)::int AS m FROM population_demographics`)).rows[0].m);
  const maxAgentBefore = Number((await pool.query(`SELECT COALESCE(MAX(id), 0)::int AS m FROM sim_agents`)).rows[0].m);
  const fpBefore = await worldFingerprint(1, maxCitBefore, maxAgentBefore);

  const cohBefore = Number((await pool.query(`SELECT COALESCE(SUM(count), 0)::int AS c FROM population_cohorts WHERE burg_id = 1`)).rows[0].c);

  // 1. Focus Excelsis (cell 30627, burg 1) -> promote 3 faces -> Unfocus with zero activity
  const foc1 = await focusArea(pool, { cellIds: [30627], burgId: 1, lod: "micro", desiredFaces: 3, tick: 1 });
  assert.equal(foc1.promoted.length, 3, "Focus must promote 3 faces out of Excelsis cohorts");
  const cohDuring = Number((await pool.query(`SELECT COALESCE(SUM(count), 0)::int AS c FROM population_cohorts WHERE burg_id = 1`)).rows[0].c);
  assert.equal(cohDuring, cohBefore - 3);

  const unfoc1 = await unfocusArea(pool, { cellIds: [30627], burgId: 1, sinceTick: 1 });
  assert.equal(unfoc1.demotedCount, 3, "Zero-activity unfocus must demote all 3 temporary faces back to cohorts");
  assert.equal(unfoc1.keptRefs.length, 0);
  const cohRestored = Number((await pool.query(`SELECT COALESCE(SUM(count), 0)::int AS c FROM population_cohorts WHERE burg_id = 1`)).rows[0].c);
  assert.equal(cohRestored, cohBefore, "Cohort count must return to exact pre-focus value");

  const fpAfter = await worldFingerprint(1, maxCitBefore, maxAgentBefore);
  for (const key of Object.keys(fpBefore)) {
    assert.equal(fpAfter[key], fpBefore[key], `worldFingerprint mismatch on "${key}" after zero-activity focus/unfocus round trip`);
  }
  console.log("1. Zero-activity focus -> unfocus round trip leaves worldFingerprint 7/7 identical... PASSED");

  // 2. Focus -> kill 1 promoted face -> Unfocus leaves 2 demoted, keeps victim deceased notable, lowers pop by 1
  const consBefore = await checkCohortConservation(pool, [1]);
  const livingBefore = Number((await pool.query(`SELECT COALESCE(SUM(count), 0)::int AS c FROM population_cohorts WHERE burg_id = 1`)).rows[0].c);

  const foc2 = await focusArea(pool, { cellIds: [30627], burgId: 1, lod: "micro", desiredFaces: 3, tick: 2 });
  assert.equal(foc2.promoted.length, 3);
  const victim = foc2.promoted[0]!;

  const killOut = await writeBackNpcDeath(pool, {
    npc: { id: `npc_citizen_${victim.citizenId}`, entity_ref: victim.entityRef, name: victim.name, pos: [128, 128] },
    cellId: 30627,
    rx: 50,
    ry: 50,
    z: 0,
    tick: 2,
    minute: 10,
    cause: "Slain during LOD test skirmish",
  });
  assert.equal(killOut.applied, true);

  const unfoc2 = await unfocusArea(pool, { cellIds: [30627], burgId: 1, sinceTick: 2 });
  assert.equal(unfoc2.demotedCount, 2, "Only the 2 untouched faces return to cohorts");
  assert.ok(unfoc2.keptRefs.includes(victim.entityRef), "Killed promoted citizen must remain a permanent notable");

  const victimEnt = await getEntityByRef(pool, victim.entityRef);
  assert.equal(victimEnt?.alive, false, "Killed face entity must remain alive=false");
  const victimCit = (await pool.query(`SELECT allegiance_status FROM population_demographics WHERE citizen_id = $1`, [victim.citizenId])).rows[0];
  assert.equal(victimCit?.allegiance_status, "DECEASED");

  const livingAfterCohorts = Number((await pool.query(`SELECT COALESCE(SUM(count), 0)::int AS c FROM population_cohorts WHERE burg_id = 1`)).rows[0].c);
  assert.equal(livingAfterCohorts, livingBefore - 1, `Cohort people must drop by 1 after killing 1 face (${consBefore.exactMatches}/1)`);
  console.log(`2. Focus -> kill 1 -> unfocus retains DECEASED notable (${victim.entityRef}) and drops living cohort by 1... PASSED`);

  console.log("\nALL LOD ROUND-TRIP TESTS PASSED");
}

isolateTest()
  .then((done) => main().then(done, async (e: unknown) => { await done(); throw e; }))
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("LOD ROUND-TRIP TEST FAILED - COMMIT BLOCKED:", err.message || err);
    process.exit(1);
  });
