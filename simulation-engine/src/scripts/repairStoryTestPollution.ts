/**
 * One-off repair: removes what the story test scripts wrote into the live world before they were
 * isolated (2026-11-11, src/scripts/testIsolation.ts).
 *
 * 1. Cached tactical maps (sim_sector_layers, every level) holding test-fixture NPCs or props
 *    (Doran Iron-Bender, Taran the Miller, Artisan Smithy Forge, ...). They are deleted: a cached map
 *    rebuilds the same way the next time it is viewed.
 * 2. Threads stamped with the tests' fake ticks (500-510, 700-710).
 * 3. Thread-resolution events (THREAD_RESOLVED, PARTY_RESOLVED_THREAD) stamped with a tick below 1000
 *    but written after the world passed tick 1000: the tests logged them with hard-coded ticks.
 *    PLAYER_ACTION and SEAL_STRAINED events are left alone: the GM stamped every one of those with
 *    tick 1 (fixed separately), so test runs cannot be told apart from real play.
 *
 * Not reverted: the small economy changes the tests applied to a few burgs (they cannot be told apart
 * from later simulation changes, and ticks have moved those numbers since).
 *
 * Dry run by default. Pass --apply to write everything in one transaction.
 *   node dist/scripts/repairStoryTestPollution.js
 *   node dist/scripts/repairStoryTestPollution.js --apply
 */
import pool from "../db/pool.js";

const TEST_EVENT_TYPES = ["THREAD_RESOLVED", "PARTY_RESOLVED_THREAD"];
const FIXTURE_NAMES =["Doran Iron-Bender", "Taran the Miller", "Artisan Smithy Forge", "Heavy Iron Forge", "Windmill Wheel", "Holding Cell Cage"];

async function main() {
  const apply = process.argv.includes("--apply");
  const client = await pool.connect();
  try {
    const maps = await client.query(
      `SELECT cell_id, rx, ry, z_layer, layer_name FROM sim_sector_layers
       WHERE npcs::text ILIKE ANY($1) OR props::text ILIKE ANY($1)
       ORDER BY cell_id, rx, ry, z_layer`,
      [FIXTURE_NAMES.map(n => `%${n}%`)]
    );
    console.log(`1. Cached maps holding test fixtures: ${maps.rows.length}`);
    for (const m of maps.rows) console.log(`     cell ${m.cell_id} r[${m.rx},${m.ry}] z${m.z_layer}  ${m.layer_name}`);

    const threads = await client.query(
      `SELECT id, state, created_tick, left(question, 80) AS q FROM sim_threads
       WHERE created_tick BETWEEN 500 AND 510 OR created_tick BETWEEN 700 AND 710 ORDER BY id`
    );
    console.log(`2. Threads with the tests' fake ticks: ${threads.rows.length}`);
    for (const t of threads.rows) console.log(`     #${t.id} (${t.state}, tick ${t.created_tick}) ${t.q}`);

    const firstLate = await client.query(`SELECT min(id) AS id FROM sim_events WHERE tick >= 1000`);
    const cutoff = Number(firstLate.rows[0]?.id) || Number.MAX_SAFE_INTEGER;
    const events = await client.query(
      `SELECT type, count(*)::int AS n FROM sim_events WHERE tick < 1000 AND id > $1 AND type = ANY($2) GROUP BY type ORDER BY n DESC`,
      [cutoff, TEST_EVENT_TYPES]
    );
    const eventTotal = events.rows.reduce((s: number, r: any) => s + r.n, 0);
    console.log(`3. Out-of-order test events: ${eventTotal}`);
    for (const e of events.rows) console.log(`     ${e.type}: ${e.n}`);

    if (!apply) {
      console.log("\nDry run: nothing written. Re-run with --apply to write.");
      return;
    }
    await client.query("BEGIN");
    for (const m of maps.rows) {
      await client.query(`DELETE FROM sim_sector_layers WHERE cell_id = $1 AND rx = $2 AND ry = $3 AND z_layer = $4`, [m.cell_id, m.rx, m.ry, m.z_layer]);
    }
    if (threads.rows.length) await client.query(`DELETE FROM sim_threads WHERE id = ANY($1::int[])`, [threads.rows.map((t: any) => t.id)]);
    await client.query(`DELETE FROM sim_events WHERE tick < 1000 AND id > $1 AND type = ANY($2)`, [cutoff, TEST_EVENT_TYPES]);
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
