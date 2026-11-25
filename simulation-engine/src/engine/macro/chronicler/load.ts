import type { Db } from "../../deltas/types.js";
import type { ChroniclerDramaEvent, ChroniclerSnapshot } from "./step.js";

/**
 * Loads recent rumor flag and (when due) up to 3 recent autonomous drama events in 1-2 queries.
 */
export async function loadChronicler(
  client: Db,
  tick: number,
  loreDate: string
): Promise<ChroniclerSnapshot> {
  const recentRes = await client.query(
    `SELECT EXISTS(SELECT 1 FROM sim_events WHERE type = 'REGIONAL_RUMOR' AND tick >= $1) AS has_recent`,
    [Math.max(0, tick - 2)]
  );
  const hasRecentRumor = Boolean(recentRes.rows[0]?.has_recent);
  if (hasRecentRumor) {
    return { tick, loreDate, hasRecentRumor: true, dramaEvents: [] };
  }

  const dramaRes = await client.query(
    `SELECT e.burg_id, e.cell_id, e.type, e.message
     FROM sim_events e
     WHERE e.tick >= $1
       AND e.type IN ('AUTONOMOUS_CLASH', 'THREAD_THWARTED_BY_LOCALS', 'THREAD_RESOLVED', 'BURG_FAMINE')
     ORDER BY e.tick DESC, e.id DESC
     LIMIT 3`,
    [Math.max(1, tick - 5)]
  );

  const dramaEvents: ChroniclerDramaEvent[] = dramaRes.rows.map((r: any) => ({
    burgId: r.burg_id !== null && r.burg_id !== undefined ? Number(r.burg_id) : null,
    cellId: r.cell_id !== null && r.cell_id !== undefined ? Number(r.cell_id) : null,
    type: String(r.type || ""),
    message: String(r.message || ""),
  }));

  return { tick, loreDate, hasRecentRumor: false, dramaEvents };
}
