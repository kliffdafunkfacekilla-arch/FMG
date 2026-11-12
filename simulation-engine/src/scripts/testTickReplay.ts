/**
 * Tick tests (rule 9). Runs real simulation days inside a rolled-back transaction (testIsolation.ts): the
 * live world is unchanged afterwards.
 *
 * 1. A day commits, and reports a timing for every step.
 * 2. The same day replayed from the same state is identical: burgs, cells, agents, people and events
 *    (randomness is seeded per tick; SQL picks do not depend on how rows are stored).
 * 3. A failing agent is rolled back alone: the rest of the day still commits.
 */
import pool from "../db/pool.js";
import { isolateTest } from "./testIsolation.js";
import { applySchemaPatches } from "../db/schemaPatches.js";
import { executeMasterTick } from "../engine/masterOrchestrator.js";
import { worldFingerprint } from "./tickFingerprint.js";

function check(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  // Before the first savepoint: a patch applied inside a run would be rolled back with it
  await applySchemaPatches(pool);
  const baseCitizenId = Number((await pool.query(`SELECT COALESCE(MAX(citizen_id), 0) m FROM population_demographics`)).rows[0].m);
  const prints: Record<string, string>[] = [];
  let tick = 0;
  // Run 1 warms per-process caches; runs 2 and 3 are compared
  for (let i = 0; i < 3; i++) {
    await pool.query("SAVEPOINT replay_run");
    const r = await executeMasterTick();
    tick = r.currentTick;
    if (i === 0) {
      check(r.status === "success", `day ${tick} did not fully commit: ${JSON.stringify(r.failedAgents)}`);
      check(["calendar", "burgOperations", "cartels", "reaper"].every(k => typeof r.timings[k] === "number"), "a step has no timing");
      console.log(`1. Day ${tick} committed in ${r.totalMs} ms with a timing for every step... PASSED`);
    }
    prints.push(await worldFingerprint(tick, baseCitizenId));
    await pool.query("ROLLBACK TO SAVEPOINT replay_run");
  }
  const differing = Object.keys(prints[1]!).filter(k => prints[1]![k] !== prints[2]![k]);
  check(differing.length === 0, `a replay of day ${tick} differs in: ${differing.join(", ")}`);
  console.log(`2. Replaying day ${tick} from the same state gives the same world (${Object.keys(prints[1]!).join(", ")})... PASSED`);

  // A table an agent needs is missing for this one day: only that agent should be rolled back
  await pool.query("SAVEPOINT broken_run");
  await pool.query("ALTER TABLE sim_weather_fronts RENAME TO sim_weather_fronts_hidden");
  const broken = await executeMasterTick();
  check(broken.status === "partial", `expected a partial day, got ${broken.status}`);
  check(broken.failedAgents.some(f => f.agent === "weather"), `weather was not reported: ${JSON.stringify(broken.failedAgents)}`);
  const cal = await pool.query(`SELECT MAX(tick) t FROM sim_calendar`);
  check(Number(cal.rows[0].t) === broken.currentTick, "the day did not commit after the weather agent failed");
  await pool.query("ROLLBACK TO SAVEPOINT broken_run");
  console.log(`3. With the weather agent broken, day ${broken.currentTick} still committed and only ${broken.failedAgents.map(f => f.agent).join(", ")} rolled back... PASSED`);

  console.log("\nALL TICK TESTS PASSED");
}

isolateTest()
  .then(done => main().then(done, async (e: unknown) => { await done(); throw e; }))
  .then(() => process.exit(0))
  .catch(err => {
    console.error("TICK TEST FAILED - COMMIT BLOCKED:", err.message || err);
    process.exit(1);
  });
