import type { Db } from "../deltas/types.js";

export type WorldClockMode = "live" | "session" | "paused";

export interface WorldClockRow {
  id: number;
  tick: number;
  minute_of_day: number;
  running: boolean;
  speed_ms: number;
  mode: WorldClockMode;
  tick_in_progress: boolean;
  last_tick_health: any;
  last_tick_error: any;
  updated_at: string;
}

export async function ensureWorldClock(db: Db): Promise<void> {
  await db.query(
    `INSERT INTO world_clock (id, tick, minute_of_day, running, speed_ms, mode)
     VALUES (1, COALESCE((SELECT MAX(tick) FROM sim_calendar), 0), 0, false, 1500, 'live')
     ON CONFLICT (id) DO NOTHING`
  );
}

export async function readWorldClock(db: Db): Promise<WorldClockRow> {
  let res = await db.query(`SELECT * FROM world_clock WHERE id = 1`);
  if (res.rows.length === 0) {
    await ensureWorldClock(db);
    res = await db.query(`SELECT * FROM world_clock WHERE id = 1`);
  }
  const r = res.rows[0];
  return {
    id: Number(r.id),
    tick: Number(r.tick || 0),
    minute_of_day: Number(r.minute_of_day || 0),
    running: Boolean(r.running),
    speed_ms: Number(r.speed_ms || 1500),
    mode: (r.mode as WorldClockMode) || "live",
    tick_in_progress: Boolean(r.tick_in_progress),
    last_tick_health: r.last_tick_health ?? null,
    last_tick_error: r.last_tick_error ?? null,
    updated_at: String(r.updated_at || new Date().toISOString()),
  };
}

export async function setClockRunning(db: Db, running: boolean): Promise<WorldClockRow> {
  await ensureWorldClock(db);
  await db.query(`UPDATE world_clock SET running = $1, updated_at = now() WHERE id = 1`, [running]);
  return readWorldClock(db);
}

export async function setClockSpeed(db: Db, speedMs: number): Promise<WorldClockRow> {
  await ensureWorldClock(db);
  const clamped = Math.max(200, Math.min(60000, Math.round(speedMs)));
  await db.query(`UPDATE world_clock SET speed_ms = $1, updated_at = now() WHERE id = 1`, [clamped]);
  return readWorldClock(db);
}

export async function setClockMode(db: Db, mode: WorldClockMode): Promise<WorldClockRow> {
  await ensureWorldClock(db);
  await db.query(`UPDATE world_clock SET mode = $1, updated_at = now() WHERE id = 1`, [mode]);
  return readWorldClock(db);
}

export async function setClockTickInProgress(db: Db, inProgress: boolean): Promise<void> {
  await db.query(`UPDATE world_clock SET tick_in_progress = $1, updated_at = now() WHERE id = 1`, [inProgress]);
}

export async function recordClockTickHealth(
  db: Db,
  tick: number,
  health: any | null,
  error: any | null
): Promise<void> {
  await db.query(
    `UPDATE world_clock
     SET tick = GREATEST(tick, $1),
         last_tick_health = COALESCE($2::jsonb, last_tick_health),
         last_tick_error = $3::jsonb,
         updated_at = now()
     WHERE id = 1`,
    [tick, health ? JSON.stringify(health) : null, error ? JSON.stringify(error) : null]
  );
}

/**
 * Advances session time by deltaMinutes. Crossing each 1,440-minute day boundary runs one macro tick
 * so consequences accumulated during play fire deterministically on schedule.
 */
export async function advanceSessionMinutes(
  db: Db,
  deltaMinutes: number,
  runMacroTick: () => Promise<{ currentTick?: number } | void>
): Promise<{ tick: number; minute_of_day: number; ticksTriggered: number }> {
  if (!Number.isFinite(deltaMinutes) || deltaMinutes < 0) {
    throw new Error(`Invalid session deltaMinutes: ${deltaMinutes}`);
  }
  const clock = await readWorldClock(db);
  let nextMinute = clock.minute_of_day + Math.round(deltaMinutes);
  let currentTick = clock.tick;
  let ticksTriggered = 0;

  while (nextMinute >= 1440) {
    nextMinute -= 1440;
    const out = await runMacroTick();
    if (out && typeof out.currentTick === "number") {
      currentTick = out.currentTick;
    } else {
      currentTick += 1;
    }
    ticksTriggered++;
  }

  await db.query(
    `UPDATE world_clock SET tick = $1, minute_of_day = $2, updated_at = now() WHERE id = 1`,
    [currentTick, nextMinute]
  );
  return { tick: currentTick, minute_of_day: nextMinute, ticksTriggered };
}
