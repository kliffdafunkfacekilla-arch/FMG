export * from "./types.js";
export { validateDeltas } from "./validate.js";
export { applyDeltas } from "./apply.js";
export { logDeltas, logRejectedDeltas, UNLOGGED_DELTA_KINDS } from "./log.js";

import type { Db, Delta, RejectedDelta } from "./types.js";
import { validateDeltas } from "./validate.js";
import { applyDeltas } from "./apply.js";
import { logDeltas, logRejectedDeltas } from "./log.js";

export async function flushStepDeltas(
  db: Db,
  source: string,
  tick: number,
  deltas: Delta[],
  minute: number = 0
): Promise<{ counts: Record<string, number>; rejected: RejectedDelta[] }> {
  if (deltas.length === 0) return { counts: {}, rejected: [] };
  const { ok, rejected } = await validateDeltas(deltas, db);
  if (rejected.length > 0) {
    console.warn(`[deltas:${source}] Rejected ${rejected.length} delta(s): ${rejected.slice(0, 3).map((r) => r.reason).join("; ")}`);
    await logRejectedDeltas(rejected, source, tick, db, minute).catch(() => 0);
  }
  if (ok.length === 0) return { counts: {}, rejected };
  const counts = await applyDeltas(ok, db);
  await logDeltas(ok, source, tick, db, minute);
  return { counts, rejected };
}
