import {
  advanceSessionMinutes,
  readWorldClock,
  setClockMode,
  setClockRunning,
  setClockSpeed,
} from "../engine/clock/clock.js";
import { focusRegion, unfocusRegion } from "../engine/meso/region.js";
import type { Db } from "../engine/deltas/types.js";

export const WORKER_LOCK_KEY = 424242;
export const MAX_FAST_FORWARD_DAYS = 589;

export type SimCommandKind =
  | "start"
  | "stop"
  | "speed"
  | "tick"
  | "fast_forward"
  | "session_open"
  | "session_close"
  | "advance_time"
  | "focus"
  | "unfocus";

export interface SimCommandRow {
  id: number;
  kind: SimCommandKind;
  payload: Record<string, any>;
}

export async function enqueueCommand(
  db: Db,
  kind: SimCommandKind,
  payload: Record<string, any> = {}
): Promise<number> {
  const res = await db.query(
    `INSERT INTO sim_commands (kind, payload) VALUES ($1, $2::jsonb) RETURNING id`,
    [kind, JSON.stringify(payload)]
  );
  return Number(res.rows[0].id);
}

export async function waitForCommand(
  db: Db,
  commandId: number,
  timeoutMs: number = 120000
): Promise<any> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await db.query(`SELECT done_at, result FROM sim_commands WHERE id = $1`, [commandId]);
    const row = res.rows[0];
    if (row && row.done_at !== null) {
      if (row.result?.error) {
        throw new Error(String(row.result.error));
      }
      return row.result;
    }
    await new Promise((r) => setTimeout(r, 40));
  }
  throw new Error(`Timed out waiting for worker command #${commandId}`);
}

export async function isWorkerActive(db: Db): Promise<boolean> {
  const res = await db.query(
    `SELECT EXISTS(SELECT 1 FROM pg_locks WHERE locktype = 'advisory' AND objid = $1) AS active`,
    [WORKER_LOCK_KEY]
  );
  return Boolean(res.rows[0]?.active);
}

/**
 * Drains queued sim_commands in FIFO order and marks each done_at + result.
 */
export async function processPendingCommands(
  db: Db,
  runTickFn: () => Promise<any>
): Promise<number> {
  const pendingRes = await db.query(
    `SELECT id, kind, payload FROM sim_commands WHERE done_at IS NULL ORDER BY id ASC LIMIT 50`
  );
  let processed = 0;

  for (const row of pendingRes.rows) {
    const id = Number(row.id);
    const kind = String(row.kind) as SimCommandKind;
    const payload = row.payload && typeof row.payload === "object" ? row.payload : {};
    let result: Record<string, any> = { ok: true };

    try {
      switch (kind) {
        case "start": {
          const clock = await setClockRunning(db, true);
          result = { ok: true, running: clock.running };
          break;
        }
        case "stop": {
          const clock = await setClockRunning(db, false);
          result = { ok: true, running: clock.running };
          break;
        }
        case "speed": {
          const clock = await setClockSpeed(db, Number(payload.speedMs ?? payload.speed_ms ?? 1500));
          result = { ok: true, speed_ms: clock.speed_ms };
          break;
        }
        case "tick": {
          const tickRes = await runTickFn();
          result = { ok: true, ...tickRes };
          break;
        }
        case "fast_forward": {
          const requested = Math.floor(Number(payload.days ?? payload.count ?? 1));
          const days = Math.max(1, Math.min(MAX_FAST_FORWARD_DAYS, Number.isFinite(requested) ? requested : 1));
          const ticks: any[] = [];
          let stoppedEarly = false;

          for (let i = 0; i < days; i++) {
            const stopCheck = await db.query(
              `SELECT 1 FROM sim_commands WHERE done_at IS NULL AND kind = 'stop' AND id > $1 LIMIT 1`,
              [id]
            );
            if (stopCheck.rows.length > 0) {
              stoppedEarly = true;
              break;
            }
            const r = await runTickFn();
            ticks.push(r);
          }

          result = {
            success: true,
            ok: true,
            daysRun: ticks.length,
            countRun: ticks.length,
            stoppedEarly,
            finalTick: ticks[ticks.length - 1]?.currentTick ?? (await readWorldClock(db)).tick,
            ticks,
          };
          break;
        }
        case "session_open": {
          const clock = await setClockMode(db, "session");
          result = { ok: true, mode: clock.mode };
          break;
        }
        case "session_close": {
          const clock = await setClockMode(db, "live");
          result = { ok: true, mode: clock.mode };
          break;
        }
        case "advance_time": {
          const mins = Number(payload.minutes ?? 0);
          const out = await advanceSessionMinutes(db, mins, runTickFn);
          result = { ok: true, ...out };
          break;
        }
        case "focus": {
          const cid = Number(payload.cellId ?? payload.focusCellId ?? 0);
          if (cid > 0) {
            const focused = await focusRegion(db, cid, { seed: payload.seed, maxCells: payload.maxCells });
            result = { ok: true, command: "focus", focusCellId: cid, cellIds: focused.record.cell_ids, agentsCount: focused.agentsCount };
          } else {
            result = { ok: true, command: kind, payload };
          }
          break;
        }
        case "unfocus": {
          const cid = Number(payload.cellId ?? payload.focusCellId ?? 0);
          if (cid > 0) {
            const unfocused = await unfocusRegion(db, cid);
            result = { ok: true, command: "unfocus", focusCellId: cid, ...unfocused };
          } else {
            result = { ok: true, command: kind, payload };
          }
          break;
        }
        default: {
          result = { ok: false, error: `Unknown command kind: ${kind}` };
          break;
        }
      }
    } catch (err: any) {
      result = { ok: false, error: err?.message || String(err) };
    }

    await db.query(
      `UPDATE sim_commands SET done_at = now(), result = $2::jsonb WHERE id = $1`,
      [id, JSON.stringify(result)]
    );
    processed++;
  }

  return processed;
}
