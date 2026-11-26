/**
 * One-off repair: makes population_cohorts agree with each burg's own headcount.
 *
 * A burg's people live in two ledgers: sim_burg_economy (pop_null + pop_attuned) and the cohort table
 * plus a few notable citizen records. They drifted apart for two reasons, both fixed in code on
 * 2026-11-26: the cohort cutover built cohorts from citizen records (about 135k more people than the
 * burgs held), and losses applied with a burg.adjust (weather deaths, cartel recruits) never retired
 * anyone from the cohorts. On the 6,794-tick world the cohorts held 3.23M people against 1.58M.
 *
 * For each burg this scales its CIVILIAN cohort buckets so that cohorts + living notable records equal
 * the burg's headcount, keeping each bucket's share (largest-remainder rounding, deterministic). Burg
 * headcounts are not changed: they are what the macro simulation runs on. Pending departure pools are
 * cleared, since the people they were waiting to retire are accounted for by the rescale.
 *
 * Dry run by default: it runs inside a transaction and rolls back. Pass --apply to commit.
 *   node dist/scripts/reconcileCohorts.js
 *   node dist/scripts/reconcileCohorts.js --apply
 */
import pool from "../db/pool.js";
import { migrate } from "../db/migrate.js";

interface Bucket {
  id: number;
  count: number;
}

/** Scales bucket counts to sum to `target`, keeping proportions, using largest-remainder rounding. */
export function scaleBuckets(buckets: Bucket[], target: number): Map<number, number> {
  const out = new Map<number, number>();
  const current = buckets.reduce((s, b) => s + b.count, 0);
  if (current <= 0 || target < 0) return out;
  const exact = buckets.map((b) => ({ id: b.id, v: (b.count * target) / current }));
  let assigned = 0;
  for (const e of exact) {
    const f = Math.floor(e.v);
    out.set(e.id, f);
    assigned += f;
  }
  const order = exact
    .map((e) => ({ id: e.id, rem: e.v - Math.floor(e.v) }))
    .sort((a, b) => b.rem - a.rem || a.id - b.id);
  for (let i = 0; i < target - assigned && i < order.length; i++) {
    out.set(order[i]!.id, (out.get(order[i]!.id) || 0) + 1);
  }
  return out;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const client = await pool.connect();
  try {
    await migrate(client);
    await client.query("BEGIN");

    const burgs = await client.query(`
      SELECT b.burg_id, b.name,
             GREATEST(0, b.pop_null) + GREATEST(0, COALESCE(b.pop_attuned, 0)) AS people,
             COALESCE((SELECT SUM(COALESCE(d.unit_size, 1)) FROM population_demographics d
                       WHERE d.settlement_id = b.burg_id AND d.allegiance_status NOT IN ('DECEASED', 'DEPARTED')), 0)::int AS notables,
             COALESCE((SELECT SUM(c.count) FROM population_cohorts c WHERE c.burg_id = b.burg_id), 0)::int AS cohorts
      FROM sim_burg_economy b
      ORDER BY b.burg_id`);

    let changed = 0, before = 0, after = 0, noBuckets = 0;
    const samples: string[] = [];
    for (const b of burgs.rows) {
      const people = Number(b.people), notables = Number(b.notables), cohorts = Number(b.cohorts);
      before += cohorts;
      const target = Math.max(0, people - notables);
      if (target === cohorts) { after += cohorts; continue; }

      const rows = await client.query(
        `SELECT ctid::text AS tid, count FROM population_cohorts
         WHERE burg_id = $1 AND allegiance = 'CIVILIAN' AND count > 0
         ORDER BY species, profession, age_band, spark_tier, is_null`,
        [b.burg_id]);
      const civilian = rows.rows.reduce((s: number, r: any) => s + Number(r.count), 0);
      const nonCivilian = cohorts - civilian;
      const civTarget = Math.max(0, target - nonCivilian);
      if (rows.rows.length === 0) {
        if (civTarget > 0) noBuckets++;
        after += cohorts;
        continue;
      }
      // Buckets are addressed by row position (ctid), stable inside this transaction; the table's key is
      // the full bucket description, and the index here is only used for deterministic rounding.
      const scaled = scaleBuckets(rows.rows.map((r: any, i: number) => ({ id: i, count: Number(r.count) })), civTarget);
      const idx = Array.from(scaled.keys());
      await client.query(
        `UPDATE population_cohorts c SET count = v.count
         FROM (SELECT unnest($1::text[])::tid AS tid, unnest($2::int[]) AS count) v
         WHERE c.ctid = v.tid`,
        [idx.map((i) => rows.rows[i].tid), idx.map((i) => scaled.get(i)!)]);
      await client.query(`UPDATE sim_burg_economy SET pop_departure_pool = 0 WHERE burg_id = $1`, [b.burg_id]);
      changed++;
      after += nonCivilian + civTarget;
      if (samples.length < 8) samples.push(`  burg ${b.burg_id} "${b.name}": cohorts ${cohorts} -> ${nonCivilian + civTarget} (headcount ${people}, notables ${notables})`);
    }

    console.log(samples.join("\n"));
    console.log(`\n${changed} burgs rescaled. Cohort people: ${before} -> ${after}.`);
    if (noBuckets) console.log(`${noBuckets} burgs have people but no civilian cohort buckets to scale (left as is).`);

    if (!apply) {
      await client.query("ROLLBACK");
      console.log("\nDry run: rolled back, nothing written. Re-run with --apply to write.");
      return;
    }
    await client.query("COMMIT");
    console.log("\nApplied in one transaction.");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

if (process.argv[1] && /reconcileCohorts\.(js|ts)$/.test(process.argv[1])) {
  main().catch((err) => {
    console.error("Reconcile failed:", err);
    process.exit(1);
  });
}
