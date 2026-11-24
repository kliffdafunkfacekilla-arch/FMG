import type { Db, Delta, RejectedDelta } from "./types.js";

/** High-volume delta kinds skipped from permanent audit storage in world_deltas. */
export const UNLOGGED_DELTA_KINDS = new Set<Delta["kind"]>(["cell.adjust", "cell.set"]);

/**
 * Records applied deltas into world_deltas in a single batched insert, skipping unlogged high-volume kinds.
 */
export async function logDeltas(
  deltas: Delta[],
  source: string,
  tick: number,
  db: Db,
  minute: number = 0
): Promise<number> {
  const logged = deltas.filter((d) => !UNLOGGED_DELTA_KINDS.has(d.kind));
  if (logged.length === 0) return 0;

  const res = await db.query(
    `INSERT INTO world_deltas (tick, minute, source, kind, payload)
     SELECT unnest($1::int[]), unnest($2::int[]), unnest($3::text[]), unnest($4::text[]), unnest($5::jsonb[])`,
    [
      logged.map(() => tick),
      logged.map(() => minute),
      logged.map(() => source),
      logged.map((d) => d.kind),
      logged.map((d) => JSON.stringify(d)),
    ]
  );
  return res.rowCount || logged.length;
}

/**
 * Records Rule-7 / validation-rejected deltas into world_deltas in a single batched insert.
 */
export async function logRejectedDeltas(
  rejected: RejectedDelta[],
  source: string,
  tick: number,
  db: Db,
  minute: number = 0
): Promise<number> {
  if (rejected.length === 0) return 0;

  const res = await db.query(
    `INSERT INTO world_deltas (tick, minute, source, kind, payload)
     SELECT unnest($1::int[]), unnest($2::int[]), unnest($3::text[]), unnest($4::text[]), unnest($5::jsonb[])`,
    [
      rejected.map(() => tick),
      rejected.map(() => minute),
      rejected.map(() => source),
      rejected.map(() => "delta.rejected"),
      rejected.map((r) => JSON.stringify({ reason: r.reason, delta: r.delta })),
    ]
  );
  return res.rowCount || rejected.length;
}
