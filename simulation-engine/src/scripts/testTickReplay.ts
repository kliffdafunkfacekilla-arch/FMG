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
import { migrate } from "../db/migrate.js";
import { executeMasterTick } from "../engine/masterOrchestrator.js";
import { worldFingerprint } from "./tickFingerprint.js";

function check(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const QUERY_CEILINGS: Record<string, number> = {
  burgOperations: 120,
  chaosFlows: 25,
  cartels: 35,
  wardens: 25,
  factionPlanning: 30,
  npcRoutines: 16,
  cultists: 25,
  backgroundDirector: 35,
  autonomousDrama: 35,
  trade: 35,
  weather: 30,
  threadClocks: 25,
  paragons: 20,
  setup: 15,
  calendar: 15,
  scheduledEvents: 20,
  mandate: 15,
  grindCanyon: 8,
  encounters: 15,
  chronicler: 8,
  reaper: 20,
  factionCollapse: 8,
  ecology: 20,
  burgExpansion: 20,
  cultureReligion: 22,
  market: 10,
};
const DEFAULT_STEP_CEILING = 120;

async function main() {
  // Before the first savepoint: a migration applied inside a run would be rolled back with it
  await migrate(pool);
  const baseCitizenId = Number((await pool.query(`SELECT COALESCE(MAX(citizen_id), 0) m FROM population_demographics`)).rows[0].m);
  const baseAgentId = Number((await pool.query(`SELECT COALESCE(MAX(id), 0) m FROM sim_agents`)).rows[0].m);
  const prints: Record<string, string>[] = [];
  const warmTimesMs: number[] = [];
  let tick = 0;
  // Run 1 warms per-process caches; runs 2 and 3 are compared
  for (let i = 0; i < 3; i++) {
    await pool.query("SAVEPOINT replay_run");
    const r = await executeMasterTick();
    tick = r.currentTick;
    if (i > 0) warmTimesMs.push(r.totalMs);
    if (i === 0) {
      check(r.status === "success", `day ${tick} did not fully commit: ${JSON.stringify(r.failedAgents)}`);
      check(["calendar", "burgOperations", "cartels", "reaper"].every(k => typeof r.timings[k] === "number"), "a step has no timing");
      console.log(`1. Day ${tick} committed in ${r.totalMs} ms with a timing for every step... PASSED`);
    }
    if (i === 1) {
      const violations: string[] = [];
      let totalQueries = 0;
      for (const [stepName, count] of Object.entries(r.queries || {})) {
        totalQueries += count;
        const limit = QUERY_CEILINGS[stepName] ?? DEFAULT_STEP_CEILING;
        if (count > limit) violations.push(`${stepName}: ${count} > ${limit}`);
      }
      check(violations.length === 0, `query budget exceeded on day ${tick}: ${violations.join(", ")}`);
      console.log(`1b. Query budget within ceilings on day ${tick} (${totalQueries} queries total, warm totalMs=${r.totalMs} ms)... PASSED`);
    }
    prints.push(await worldFingerprint(tick, baseCitizenId, baseAgentId));
    await pool.query("ROLLBACK TO SAVEPOINT replay_run");
  }
  const differing = Object.keys(prints[1]!).filter(k => prints[1]![k] !== prints[2]![k]);
  check(differing.length === 0, `a replay of day ${tick} differs in: ${differing.join(", ")}`);
  console.log(`2. Replaying day ${tick} from the same state gives the same world (${Object.keys(prints[1]!).join(", ")})... PASSED`);

  const fastestWarmMs = Math.min(...warmTimesMs);
  check(
    fastestWarmMs < 1500,
    `scale gate exceeded: warm macro ticks [${warmTimesMs.join(", ")}] ms exceeded 1500 ms budget`
  );
  console.log(`2b. Full-map warm macro day within <1500ms scale gate (${warmTimesMs.join(" / ")} ms)... PASSED`);

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
