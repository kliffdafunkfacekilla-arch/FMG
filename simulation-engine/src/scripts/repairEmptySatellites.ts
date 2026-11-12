/**
 * One-off repair: gives settlers to every satellite burg that has none.
 *
 * Before 2026-11-12 the expansion agent moved a population number to each new hamlet, logging camp or
 * watchtower but no citizen records, so all of them had people on paper and nobody in
 * population_demographics: empty maps, no story actors, and no births (growth adds records only when a
 * burg's own pool fills a unit). This moves real living civilians from each satellite's parent, chosen
 * the way the agent now chooses founders (engine/agents/burgExpansionAgent.ts settleSatellite).
 * Population counts are not changed: they already moved when the satellite was founded.
 *
 * Dry run by default: it runs the moves in a transaction and rolls them back, to show what would happen.
 * Pass --apply to commit them.
 *   node dist/scripts/repairEmptySatellites.js
 *   node dist/scripts/repairEmptySatellites.js --apply
 */
import pool from "../db/pool.js";
import { settleSatellite } from "../engine/agents/burgExpansionAgent.js";

async function main() {
  const apply = process.argv.includes("--apply");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const res = await client.query(`
      SELECT s.burg_id, s.cell_id, s.name, s.settlement_type, s.pop_null + COALESCE(s.pop_attuned, 0) AS pop,
             p.burg_id AS parent_id, p.name AS parent_name
      FROM sim_burg_economy s
      JOIN sim_burg_economy p ON p.burg_id = s.parent_burg_id
      WHERE NOT EXISTS (SELECT 1 FROM population_demographics d WHERE d.settlement_id = s.burg_id AND d.allegiance_status <> 'DECEASED')
        AND s.pop_null + COALESCE(s.pop_attuned, 0) > 0
      ORDER BY s.burg_id`);
    let moved = 0, settled = 0;
    const unsettled: string[] = [];
    for (const s of res.rows) {
      const type = ["HAMLET", "FARMLAND", "LOGGING", "WATCHTOWER"].includes(s.settlement_type) ? s.settlement_type : "HAMLET";
      const n = await settleSatellite(client, { burg_id: s.parent_id, name: s.parent_name },
        { burg_id: s.burg_id, cell_id: s.cell_id, name: s.name, type, pioneers: Number(s.pop) });
      if (n > 0) { settled++; moved += n; } else unsettled.push(`burg ${s.burg_id} "${s.name}" (parent ${s.parent_name} has no living civilians)`);
      if (settled <= 8 && n > 0) console.log(`  burg ${s.burg_id} "${s.name}" (${type}, pop ${s.pop}): ${n} settlers from ${s.parent_name}`);
    }
    console.log(`${res.rows.length} satellites had no people; ${settled} settled with ${moved} citizen records in all.`);
    if (unsettled.length) console.log(`Left empty:\n  ${unsettled.join("\n  ")}`);

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
