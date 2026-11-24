import { dateForTick } from "../../canon/calendar.js";
import type { Db } from "../../deltas/types.js";

export interface CalendarSnapshot {
  tick: number;
  calendarRowId: number | null;
  chaosBurgIds: number[];
  unrestBurgIds: number[];
}

export async function loadCalendar(db: Db, tick: number): Promise<CalendarSnapshot> {
  const calRes = await db.query(`SELECT id FROM sim_calendar ORDER BY id ASC LIMIT 1`);
  const calendarRowId = calRes.rows[0] ? Number(calRes.rows[0].id) : null;

  const date = dateForTick(tick);
  let chaosBurgIds: number[] = [];
  let unrestBurgIds: number[] = [];

  if (date.dayOfMonth === 48 && !date.isShadowfall) {
    const [chaosRes, unrestRes] = await Promise.all([
      db.query(
        `SELECT DISTINCT b.burg_id
         FROM sim_burg_economy b
         JOIN sim_chaos_zones z ON b.cell_id = z.cell_id
         WHERE z.intensity > 40
         ORDER BY b.burg_id ASC`
      ),
      db.query(`SELECT burg_id FROM sim_burg_economy WHERE COALESCE(unrest, 0) < 90 ORDER BY burg_id ASC`),
    ]);
    chaosBurgIds = chaosRes.rows.map((r: any) => Number(r.burg_id));
    unrestBurgIds = unrestRes.rows.map((r: any) => Number(r.burg_id));
  }

  return {
    tick,
    calendarRowId,
    chaosBurgIds,
    unrestBurgIds,
  };
}
