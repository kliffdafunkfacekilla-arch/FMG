/**
 * Diagnoses non-reproducible ticks: runs the next day three times (rolled back, world unchanged) and
 * prints which burg fields and which events differ between run 2 and run 3.
 *   node dist/scripts/diffTickReplay.js
 */
import pool from "../db/pool.js";
import { isolateTest } from "./testIsolation.js";
import { executeMasterTick } from "../engine/masterOrchestrator.js";

async function snapshot(tick: number) {
  const burgs = (await pool.query(`SELECT * FROM sim_burg_economy ORDER BY burg_id`)).rows;
  const events = (await pool.query(`SELECT type, burg_id, message FROM sim_events WHERE tick = $1 ORDER BY type, burg_id, message`, [tick])).rows
    .map(e => `${e.type}|${e.burg_id}|${e.message}`);
  const people = (await pool.query(`SELECT settlement_id, allegiance_status, life_stage, count(*)::int c FROM population_demographics GROUP BY 1,2,3 ORDER BY 1,2,3`)).rows
    .map(r => `${r.settlement_id}|${r.allegiance_status}|${r.life_stage}|${r.c}`);
  return { burgs, events, people };
}

async function main() {
  const snaps = [];
  for (let i = 0; i < 3; i++) {
    await pool.query("SAVEPOINT diff_run");
    const r = await executeMasterTick();
    snaps.push(await snapshot(r.currentTick));
    await pool.query("ROLLBACK TO SAVEPOINT diff_run");
  }
  const [, a, b] = snaps as any;
  const fieldDiffs = new Map<string, number>();
  const examples: string[] = [];
  a.burgs.forEach((row: any, i: number) => {
    for (const k of Object.keys(row)) {
      const x = JSON.stringify(row[k]), y = JSON.stringify(b.burgs[i][k]);
      if (x !== y) {
        fieldDiffs.set(k, (fieldDiffs.get(k) || 0) + 1);
        if (examples.length < 12) examples.push(`burg ${row.burg_id}.${k}: ${x?.slice(0, 80)} vs ${y?.slice(0, 80)}`);
      }
    }
  });
  console.log("Burg fields that differ (count of burgs):", Object.fromEntries(fieldDiffs));
  examples.forEach(e => console.log("  " + e));
  const ea = new Set<string>(a.events), eb = new Set<string>(b.events);
  const onlyA = a.events.filter((e: string) => !eb.has(e)), onlyB = b.events.filter((e: string) => !ea.has(e));
  console.log(`\nEvents: ${a.events.length} vs ${b.events.length}; only in run 2: ${onlyA.length}, only in run 3: ${onlyB.length}`);
  onlyA.slice(0, 6).forEach((e: string) => console.log("  2> " + e.slice(0, 160)));
  onlyB.slice(0, 6).forEach((e: string) => console.log("  3> " + e.slice(0, 160)));
  const pa = new Set<string>(a.people);
  const pd = b.people.filter((p: string) => !pa.has(p));
  console.log(`\nPeople groups differing: ${pd.length}`); pd.slice(0, 6).forEach((p: string) => console.log("  " + p));
}

isolateTest()
  .then(done => main().then(done, async (e: unknown) => { await done(); throw e; }))
  .then(() => process.exit(0))
  .catch(err => { console.error("Diff failed:", err); process.exit(1); });
