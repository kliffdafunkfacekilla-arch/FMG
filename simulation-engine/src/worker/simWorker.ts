import pool from "../db/pool.js";
import { migrate } from "../db/migrate.js";
import {
  ensureWorldClock,
  readWorldClock,
  recordClockTickHealth,
  setClockTickInProgress,
} from "../engine/clock/clock.js";
import type { Db } from "../engine/deltas/types.js";
import { executeMasterTick, type TickResult } from "../engine/masterOrchestrator.js";
import { processPendingCommands, WORKER_LOCK_KEY } from "./commands.js";

function summarizeHealth(result: TickResult) {
  const slowestSteps = Object.entries(result.timings || {})
    .map(([step, ms]) => ({
      step,
      ms: Math.round(Number(ms) || 0),
      queries: Number(result.queries?.[step] || 0),
    }))
    .sort((a, b) => b.ms - a.ms || a.step.localeCompare(b.step))
    .slice(0, 3);

  const failedAgents = Array.isArray(result.failedAgents)
    ? result.failedAgents.map((f) => ({
        agent: String(f.agent),
        error: String(f.error),
      }))
    : [];

  return {
    tick: Number(result.currentTick || 0),
    totalMs: Math.round(Number(result.totalMs) || 0),
    status: result.status === "partial" || failedAgents.length > 0 ? "partial" : "success",
    failedAgents,
    slowestSteps,
    at: new Date().toISOString(),
  };
}

export async function acquireWorkerLock(db: Db): Promise<boolean> {
  const res = await db.query(`SELECT pg_try_advisory_lock($1) AS ok`, [WORKER_LOCK_KEY]);
  return Boolean(res.rows[0]?.ok);
}

export async function releaseWorkerLock(db: Db): Promise<void> {
  await db.query(`SELECT pg_advisory_unlock($1)`, [WORKER_LOCK_KEY]).catch(() => {});
}

export async function runTrackedWorkerTick(db: Db): Promise<TickResult> {
  await setClockTickInProgress(db, true);
  try {
    const result = await executeMasterTick();
    const health = summarizeHealth(result);
    const err = result.failedAgents.length
      ? {
          tick: result.currentTick,
          message: `Agents rolled back: ${result.failedAgents.map((f) => `${f.agent} (${f.error})`).join("; ")}`,
          at: new Date().toISOString(),
        }
      : null;
    await recordClockTickHealth(db, result.currentTick, health, err);
    return result;
  } catch (e: any) {
    const clock = await readWorldClock(db).catch(() => null);
    await recordClockTickHealth(
      db,
      clock?.tick ?? 0,
      null,
      { tick: clock?.tick ?? null, message: e?.message || String(e), at: new Date().toISOString() }
    ).catch(() => {});
    throw e;
  } finally {
    await setClockTickInProgress(db, false).catch(() => {});
  }
}

/**
 * One worker iteration: drains pending commands, then advances one macro day if clock is running in live mode.
 */
export async function runWorkerIteration(db: Db): Promise<{
  commandsProcessed: number;
  ranLiveTick: boolean;
  tickDurationMs: number;
  speedMs: number;
  running: boolean;
}> {
  const commandsProcessed = await processPendingCommands(db, () => runTrackedWorkerTick(db));
  const clock = await readWorldClock(db);
  let ranLiveTick = false;
  let tickDurationMs = 0;

  if (clock.running && clock.mode === "live") {
    const t0 = performance.now();
    await runTrackedWorkerTick(db);
    tickDurationMs = Math.round(performance.now() - t0);
    ranLiveTick = true;
  }

  return {
    commandsProcessed,
    ranLiveTick,
    tickDurationMs,
    speedMs: clock.speed_ms,
    running: clock.running && clock.mode === "live",
  };
}

if (require.main === module) {
  (async () => {
    const lockClient = await pool.connect();
    const gotLock = await acquireWorkerLock(lockClient);
    if (!gotLock) {
      console.error(`[worker] Another simulation worker already holds advisory lock ${WORKER_LOCK_KEY}. Exiting.`);
      lockClient.release();
      await pool.end();
      process.exit(1);
    }

    await migrate(pool);
    await ensureWorldClock(pool);
    const initial = await readWorldClock(pool);
    console.log(`[worker] Ostraka simulation worker active (tick=${initial.tick}, mode=${initial.mode}, running=${initial.running}).`);

    let shuttingDown = false;
    const shutdown = async () => {
      if (shuttingDown) return;
      shuttingDown = true;
      console.log("[worker] Shutting down and releasing advisory lock...");
      await releaseWorkerLock(lockClient);
      lockClient.release();
      await pool.end().catch(() => {});
      process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

    while (!shuttingDown) {
      let waitMs = 250;
      try {
        const iter = await runWorkerIteration(pool);
        waitMs = iter.running ? Math.max(0, iter.speedMs - iter.tickDurationMs) : 250;
      } catch (err: any) {
        console.error(`[worker] Iteration error: ${err?.message || err}`);
        waitMs = 1000;
      }
      if (waitMs > 0 && !shuttingDown) {
        await new Promise((r) => setTimeout(r, waitMs));
      }
    }
  })().catch((err) => {
    console.error("[worker] Fatal startup error:", err);
    process.exit(1);
  });
}
