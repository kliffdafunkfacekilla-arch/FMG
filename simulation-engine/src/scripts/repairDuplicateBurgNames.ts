/**
 * One-off repair: gives every burg a unique name.
 *
 * Before 2026-11-11 the expansion agent named Timberlands and Sentinel Redoubts from the parent's first
 * word only, so several burgs share a name ("Ha Timberlands" x3). Map burgs and the oldest expansion
 * burg keep the name; later expansion burgs are renamed with the rule the agent now uses
 * (engine/agents/burgExpansionAgent.ts uniqueBurgName). Map burgs are never renamed, even where the
 * Holgaland map repeats a name. sim_events keeps the old names: it is a history log.
 *
 * Dry run by default. Pass --apply to write in one transaction.
 *   node dist/scripts/repairDuplicateBurgNames.js
 *   node dist/scripts/repairDuplicateBurgNames.js --apply
 */
import pool from "../db/pool.js";
import { uniqueBurgName } from "../engine/agents/burgExpansionAgent.js";

async function main() {
  const apply = process.argv.includes("--apply");
  const client = await pool.connect();
  try {
    // Map burgs (no parent) keep their names even when the Holgaland map repeats one: renaming them would
    // invent names for map data (rule 7). Only burgs the expansion agent founded are renamed.
    const res = await client.query("SELECT burg_id, name, parent_burg_id FROM sim_burg_economy ORDER BY (parent_burg_id IS NOT NULL), burg_id");
    const taken = new Set<string>();
    const renames: { id: number; from: string; to: string }[] = [];
    const mapDuplicates: string[] = [];
    for (const r of res.rows) {
      const name = String(r.name);
      if (!taken.has(name)) { taken.add(name); continue; }
      if (!r.parent_burg_id) { mapDuplicates.push(`burg ${r.burg_id} "${name}"`); continue; }
      const to = uniqueBurgName(name, taken);
      taken.add(to);
      renames.push({ id: r.burg_id, from: name, to });
    }
    console.log(`${renames.length} expansion burgs share a name with another burg.`);
    for (const r of renames) console.log(`  burg ${r.id}: "${r.from}" -> "${r.to}"`);
    if (mapDuplicates.length) {
      console.log(`Left alone (the Holgaland map itself repeats these names): ${mapDuplicates.join(", ")}`);
    }

    if (!apply) {
      console.log("\nDry run: nothing written. Re-run with --apply to write.");
      return;
    }
    await client.query("BEGIN");
    for (const r of renames) await client.query("UPDATE sim_burg_economy SET name = $1 WHERE burg_id = $2", [r.to, r.id]);
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
