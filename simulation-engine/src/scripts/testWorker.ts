import assert from "node:assert/strict";
import { Client } from "pg";
import pool from "../db/pool.js";
import { migrate } from "../db/migrate.js";
import { readWorldClock } from "../engine/clock/clock.js";
import { enqueueCommand, processPendingCommands } from "../worker/commands.js";
import { acquireWorkerLock, releaseWorkerLock, runTrackedWorkerTick } from "../worker/simWorker.js";
import { isolateTest } from "./testIsolation.js";

async function testAdvisoryLockExclusion() {
  const connStr = process.env.DATABASE_URL || "postgres://postgres@localhost:5432/postgres";
  const c1 = new Client({ connectionString: connStr });
  const c2 = new Client({ connectionString: connStr });
  await c1.connect();
  await c2.connect();
  try {
    const first = await acquireWorkerLock(c1);
    assert.equal(first, true, "First worker should acquire advisory lock 424242");
    const second = await acquireWorkerLock(c2);
    assert.equal(second, false, "Second worker must be refused while first holds lock");
    await releaseWorkerLock(c1);
    const afterRelease = await acquireWorkerLock(c2);
    assert.equal(afterRelease, true, "Second worker must acquire lock once first releases it");
    await releaseWorkerLock(c2);
    console.log("1. PostgreSQL advisory lock (424242) blocks second worker... PASSED");
  } finally {
    await c1.end().catch(() => {});
    await c2.end().catch(() => {});
  }
}

async function testWorkerInIsolation() {
  const done = await isolateTest();
  try {
    await migrate(pool);

    // 2. Start & stop commands update persistent world_clock.running
    await pool.query("SAVEPOINT w_start_stop");
    await enqueueCommand(pool, "start");
    await processPendingCommands(pool, () => runTrackedWorkerTick(pool));
    let clock = await readWorldClock(pool);
    assert.equal(clock.running, true, "start command should set world_clock.running = true");

    await enqueueCommand(pool, "stop");
    await processPendingCommands(pool, () => runTrackedWorkerTick(pool));
    clock = await readWorldClock(pool);
    assert.equal(clock.running, false, "stop command should set world_clock.running = false");
    await pool.query("ROLLBACK TO SAVEPOINT w_start_stop");
    console.log("2. start/stop commands persist world_clock.running... PASSED");

    // 3. fast_forward 3 advances exactly 3 days and records result
    await pool.query("SAVEPOINT w_ff");
    const beforeTick = (await readWorldClock(pool)).tick;
    const ffCmdId = await enqueueCommand(pool, "fast_forward", { days: 3 });
    await processPendingCommands(pool, () => runTrackedWorkerTick(pool));
    const afterFfTick = (await readWorldClock(pool)).tick;
    assert.equal(afterFfTick, beforeTick + 3, `Expected tick ${beforeTick + 3}, got ${afterFfTick}`);
    const cmdRes = (await pool.query(`SELECT done_at, result FROM sim_commands WHERE id = $1`, [ffCmdId])).rows[0];
    assert.ok(cmdRes?.done_at, "fast_forward command should be marked done_at");
    assert.equal(Number(cmdRes.result?.daysRun), 3);
    await pool.query("ROLLBACK TO SAVEPOINT w_ff");
    console.log(`3. fast_forward 3 advanced tick ${beforeTick} -> ${afterFfTick}... PASSED`);

    // 4. Scheduled event fires once on due_tick and never twice
    await pool.query("SAVEPOINT w_sched");
    const bRes = await pool.query(`SELECT burg_id, food FROM sim_burg_economy ORDER BY burg_id ASC LIMIT 1`);
    const burgId = Number(bRes.rows[0].burg_id);
    const startFood = Number(bRes.rows[0].food);
    const nextTick = (await readWorldClock(pool)).tick + 1;

    await pool.query(`DELETE FROM sim_weather_fronts`); // keep noise off this check
    await pool.query(
      `INSERT INTO scheduled_events (due_tick, due_minute, kind, payload, created_tick)
       VALUES ($1, 0, 'delta', $2::jsonb, $3)`,
      [nextTick, JSON.stringify({ kind: "burg.adjust", burgId, food: 77 }), nextTick - 1]
    );
    await runTrackedWorkerTick(pool);
    const foodAfterDue = Number((await pool.query(`SELECT food FROM sim_burg_economy WHERE burg_id = $1`, [burgId])).rows[0].food);
    const schedRow = (await pool.query(`SELECT fired_tick FROM scheduled_events WHERE due_tick = $1 AND kind = 'delta' ORDER BY id DESC LIMIT 1`, [nextTick])).rows[0];
    assert.equal(Number(schedRow?.fired_tick), nextTick, "scheduled event should stamp fired_tick");
    assert.ok(foodAfterDue >= startFood + 50, `Expected scheduled +77 food effect on due day (${startFood} -> ${foodAfterDue})`);

    await runTrackedWorkerTick(pool);
    const stillUnfiredDuplicate = await pool.query(`SELECT COUNT(*)::int AS c FROM world_deltas WHERE tick = $1 AND kind = 'burg.adjust' AND source = 'agent:scheduledEvents'`, [nextTick + 1]);
    assert.equal(Number(stillUnfiredDuplicate.rows[0].c), 0, "Scheduled event must fire only once");
    await pool.query("ROLLBACK TO SAVEPOINT w_sched");
    console.log("4. scheduled_events due delta fires exact once... PASSED");

    // 5. Session time policy: 8h (480m) holds day; +16h (960m) triggers exact 1 macro day
    await pool.query("SAVEPOINT w_session");
    const t0 = (await readWorldClock(pool)).tick;
    await enqueueCommand(pool, "session_open");
    await processPendingCommands(pool, () => runTrackedWorkerTick(pool));
    assert.equal((await readWorldClock(pool)).mode, "session");

    await enqueueCommand(pool, "advance_time", { minutes: 480 });
    await processPendingCommands(pool, () => runTrackedWorkerTick(pool));
    let cSession = await readWorldClock(pool);
    assert.equal(cSession.minute_of_day, 480);
    assert.equal(cSession.tick, t0, "8h session should not run macro day");

    await enqueueCommand(pool, "advance_time", { minutes: 960 });
    await processPendingCommands(pool, () => runTrackedWorkerTick(pool));
    cSession = await readWorldClock(pool);
    assert.equal(cSession.minute_of_day, 0);
    assert.equal(cSession.tick, t0 + 1, "24th session hour must trigger exact 1 macro day");

    await enqueueCommand(pool, "session_close");
    await processPendingCommands(pool, () => runTrackedWorkerTick(pool));
    assert.equal((await readWorldClock(pool)).mode, "live");
    await pool.query("ROLLBACK TO SAVEPOINT w_session");
    console.log("5. Session time policy (8h + 16h -> 1 macro tick) verified... PASSED");

    console.log("\nALL WORKER & CLOCK TESTS PASSED");
  } catch (err) {
    await done();
    throw err;
  }
  await done();
}

async function main() {
  console.log("=== Testing World Clock Worker, Lock & Scheduler (Phase 3) ===");
  await testAdvisoryLockExclusion();
  await testWorkerInIsolation();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("WORKER TEST FAILED - COMMIT BLOCKED:", err.message || err);
    process.exit(1);
  });
