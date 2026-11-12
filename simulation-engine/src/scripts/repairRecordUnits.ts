/**
 * One-off repair: makes every living citizen record's unit_size say how many people it stands for.
 *
 * Every record was created with unit_size 12, but burgs hold about 8.5 people per record (their counters
 * divided by their living records), and tactical maps use unit_size as a site's worker count. From
 * 2026-11-12 the burg operations agent creates records at each burg's own density (recordLedger in
 * engine/agents/burgOperationsAgent.ts); this sets existing living records to their burg's density.
 * Dead and departed records keep the value they had.
 *
 * Dry run by default (runs in a transaction and rolls back). Pass --apply to commit.
 *   node dist/scripts/repairRecordUnits.js
 *   node dist/scripts/repairRecordUnits.js --apply
 */
import pool from "../db/pool.js";
import { recordLedger } from "../engine/agents/burgOperationsAgent.js";

async function main() {
  const apply = process.argv.includes("--apply");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const burgs = await client.query(`
      SELECT b.burg_id, b.name, b.pop_null, COALESCE(b.pop_attuned, 0) AS pop_attuned, COUNT(d.citizen_id)::int AS records
      FROM sim_burg_economy b
      JOIN population_demographics d ON d.settlement_id = b.burg_id AND d.allegiance_status NOT IN ('DECEASED', 'DEPARTED')
      GROUP BY b.burg_id ORDER BY b.burg_id`);
    const ids: number[] = [], units: number[] = [];
    const histogram = new Map<number, number>();
    for (const b of burgs.rows) {
      const { unit } = recordLedger(Number(b.pop_null), Number(b.pop_attuned), Number(b.records));
      ids.push(Number(b.burg_id)); units.push(unit);
      histogram.set(unit, (histogram.get(unit) || 0) + 1);
    }
    const res = await client.query(`
      UPDATE population_demographics d SET unit_size = v.unit
      FROM (SELECT unnest($1::int[]) AS burg_id, unnest($2::int[]) AS unit) v
      WHERE d.settlement_id = v.burg_id AND d.allegiance_status NOT IN ('DECEASED', 'DEPARTED') AND d.unit_size IS DISTINCT FROM v.unit`,
      [ids, units]);
    console.log(`${burgs.rows.length} burgs with living records; ${res.rowCount} records get a new unit_size.`);
    console.log("People per record (burgs):", [...histogram.entries()].sort((a, b) => a[0] - b[0]).map(([u, n]) => `${u}: ${n}`).join(", "));

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

main().catch(err => {
  console.error("Repair failed:", err);
  process.exit(1);
});
