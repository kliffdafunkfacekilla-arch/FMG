/**
 * One-off repair: restores each sim_chaos_flows row's canon identity and endpoints.
 *
 * Before 2026-11-11, chaosFlowAgent overwrote the ingested canon names/dragons/Powers every tick
 * with a stale list. This puts back what the Holgaland ingest writes, without a full world reset.
 * Per-tick fields (surge, width, waypoints) are left for the next tick to recompute.
 *
 * Dry run by default (prints the changes). Pass --apply to write them in one transaction.
 *   node dist/scripts/repairChaosFlowIdentity.js           # preview
 *   node dist/scripts/repairChaosFlowIdentity.js --apply   # write
 */
import pool from "../db/pool.js";
import { CANON_DRAGON_PRISONS, VERGE_COORD, canonFlowName } from "../engine/canon/dragonPrisons.js";

async function main() {
  const apply = process.argv.includes("--apply");
  const client = await pool.connect();
  try {
    const res = await client.query(`SELECT flow_id, name, dragon_name, elemental_power FROM sim_chaos_flows ORDER BY flow_id`);
    const changes = CANON_DRAGON_PRISONS.map(p => {
      const row = res.rows.find((r: any) => Number(r.flow_id) === p.clock);
      return { p, row, name: canonFlowName(p) };
    }).filter(c => !c.row || c.row.dragon_name !== c.p.dragon || c.row.elemental_power !== c.p.power || c.row.name !== c.name);

    if (changes.length === 0) {
      console.log("All 12 chaos flows already carry their canon identity. Nothing to do.");
      return;
    }
    for (const c of changes) {
      const before = c.row ? `${c.row.dragon_name}/${c.row.elemental_power} "${c.row.name}"` : "(missing row)";
      console.log(`flow ${c.p.clock}: ${before}  ->  ${c.p.dragon}/${c.p.power} "${c.name}"`);
    }
    if (!apply) {
      console.log(`\nDry run: ${changes.length} flow(s) would change. Re-run with --apply to write.`);
      return;
    }

    await client.query("BEGIN");
    for (const c of changes) {
      await client.query(
        `INSERT INTO sim_chaos_flows (flow_id, name, dragon_name, elemental_power, source_angle, source_coord, sink_coord, current_surge, current_width, waypoints, narrow_spots)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 1.0, 2.5, '[]', '[]')
         ON CONFLICT (flow_id) DO UPDATE SET
           name = EXCLUDED.name,
           dragon_name = EXCLUDED.dragon_name,
           elemental_power = EXCLUDED.elemental_power,
           source_angle = EXCLUDED.source_angle,
           source_coord = EXCLUDED.source_coord,
           sink_coord = EXCLUDED.sink_coord`,
        [
          c.p.clock, c.name, c.p.dragon, c.p.power, c.p.angleDeg,
          JSON.stringify({ x: c.p.x, y: c.p.y, cell: c.p.cell, cult: c.p.cult }),
          JSON.stringify(VERGE_COORD),
        ]
      );
    }
    await client.query("COMMIT");
    console.log(`\nApplied: ${changes.length} flow(s) restored. Waypoints update on the next tick.`);
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
