import type { Db, Delta } from "../deltas/types.js";

export interface ScheduleEventOptions {
  dueTick: number;
  dueMinute?: number | undefined;
  kind: string;
  payload?: Record<string, any> | undefined;
  createdTick: number;
}

export async function scheduleEvent(db: Db, opts: ScheduleEventOptions): Promise<number> {
  const res = await db.query(
    `INSERT INTO scheduled_events (due_tick, due_minute, kind, payload, created_tick)
     VALUES ($1, $2, $3, $4::jsonb, $5)
     RETURNING id`,
    [opts.dueTick, opts.dueMinute ?? 0, opts.kind, JSON.stringify(opts.payload ?? {}), opts.createdTick]
  );
  return Number(res.rows[0].id);
}

/**
 * Loads all unfired scheduled events due on or before (tick, minuteOfDay), marks them fired in this
 * tick's savepoint so they fire at most once, and converts them to deltas for the unified writer.
 */
export async function fireDueScheduledEvents(
  db: Db,
  tick: number,
  minuteOfDay: number = 1440
): Promise<{ firedIds: number[]; deltas: Delta[] }> {
  const dueRes = await db.query(
    `SELECT id, due_tick, due_minute, kind, payload
     FROM scheduled_events
     WHERE fired_tick IS NULL
       AND (due_tick < $1 OR (due_tick = $1 AND due_minute <= $2))
     ORDER BY due_tick ASC, due_minute ASC, id ASC`,
    [tick, minuteOfDay]
  );
  if (dueRes.rows.length === 0) {
    return { firedIds: [], deltas: [] };
  }

  const firedIds: number[] = [];
  const deltas: Delta[] = [];

  for (const row of dueRes.rows) {
    firedIds.push(Number(row.id));
    const kind = String(row.kind || "SCHEDULED_EVENT");
    const payload = row.payload && typeof row.payload === "object" ? row.payload : {};

    if (Array.isArray(payload.deltas)) {
      for (const d of payload.deltas) {
        if (d && typeof d === "object" && d.kind) {
          deltas.push(d.kind === "event.log" && d.tick === undefined ? { ...d, tick } : d);
        }
      }
    } else if (kind === "delta" && payload.kind) {
      deltas.push(payload.kind === "event.log" && payload.tick === undefined ? { ...payload, tick } : payload);
    } else {
      const ev: Extract<Delta, { kind: "event.log" }> = {
        kind: "event.log",
        tick,
        type: kind,
        message: String(payload.message || `Scheduled event ${kind} resolved.`),
        tier: payload.tier === "MAJOR" || payload.tier === "CRITICAL" ? payload.tier : "MINOR",
      };
      if (payload.burgId !== undefined) ev.burgId = Number(payload.burgId);
      if (payload.cellId !== undefined) ev.cellId = Number(payload.cellId);
      if (payload.factionId !== undefined) ev.factionId = Number(payload.factionId);
      if (payload.outlawId !== undefined) ev.outlawId = Number(payload.outlawId);
      deltas.push(ev);
    }
  }

  await db.query(
    `UPDATE scheduled_events SET fired_tick = $1 WHERE id = ANY($2::bigint[])`,
    [tick, firedIds]
  );

  return { firedIds, deltas };
}
