/**
 * Story feedback-loop rules (rule 9). Runs inside a rolled-back transaction (testIsolation.ts).
 *
 * A 300-tick run reopened the same famine thread 50 times, every 6 ticks, and each expiry hit the town
 * again (+18 unrest, -200 food). These pin the fixes:
 *  1. In autonomous play a world crisis thread that runs out is told, not applied.
 *  2. The same crisis does not reopen for the same town within STORY_REOPEN_COOLDOWN_TICKS.
 *  3. An arc nothing is moving ends 'resolved' in a calm town and 'failed' in a troubled one.
 */
import assert from "node:assert/strict";
import pool from "../db/pool.js";
import { isolateTest } from "./testIsolation.js";
import { createThread, advanceThreadClocks } from "../engine/threads/threadEngine.js";
import { openWorldEventThreads } from "../engine/threads/worldThreads.js";
import { sweepStaleStorylines, ORPHAN_ARC_GRACE_TICKS } from "../engine/story/storylines.js";
import { STORY_REOPEN_COOLDOWN_TICKS } from "../engine/threads/storyCooldowns.js";

async function main() {
  await pool.query(`UPDATE world_clock SET mode = 'live' WHERE id = 1`);
  const tick = Number((await pool.query(`SELECT COALESCE(MAX(tick), 1) AS t FROM sim_calendar`)).rows[0].t);

  // Two burgs with paragons: one we keep calm, one troubled.
  const burgs = (await pool.query(`
    SELECT b.burg_id, b.cell_id, b.name, (SELECT p.id FROM sim_paragons p WHERE p.burg_id = b.burg_id AND p.outlaw_id IS NULL ORDER BY p.id LIMIT 1) AS paragon_id
    FROM sim_burg_economy b
    WHERE EXISTS (SELECT 1 FROM sim_paragons p WHERE p.burg_id = b.burg_id AND p.outlaw_id IS NULL)
    ORDER BY b.burg_id LIMIT 2`)).rows;
  assert.equal(burgs.length, 2, "Need two burgs with paragons");
  const [calm, troubled] = burgs;
  await pool.query(`UPDATE sim_burg_economy SET unrest = 20, food = 5000, wealth = 1000 WHERE burg_id = $1`, [calm.burg_id]);
  await pool.query(`UPDATE sim_burg_economy SET unrest = 80 WHERE burg_id = $1`, [troubled.burg_id]);
  // Keep other open threads out of the way.
  await pool.query(`UPDATE storylines SET state = 'expired', resolved_tick = $1 WHERE state IN ('open', 'escalated', 'proposed')`, [tick - 100]);

  // 1. Narrative-only expiry
  const famine = await createThread(pool, {
    question: `Will ${calm.name} get grain before its people starve?`,
    stakes: "Test famine.",
    actor_ids: [`paragon:${calm.paragon_id}`],
    cell_id: Number(calm.cell_id), rx: 50, ry: 50,
    clock: 0, clock_max: 1,
    origin: "world", rule_id: "WORLD_FAMINE", created_tick: tick,
    on_expire: { unrestDelta: 18, foodDelta: -200, crimeRateDelta: 6, narrativeSummary: "No relief reached the town." },
    on_resolved_by_party: { unrestDelta: -12, narrativeSummary: "Relief arrived." },
  });
  await advanceThreadClocks(pool, tick, "Test");
  const after = (await pool.query(`SELECT unrest, food FROM sim_burg_economy WHERE burg_id = $1`, [calm.burg_id])).rows[0];
  const row = (await pool.query(`SELECT state, resolution_text FROM storylines WHERE id = $1`, [famine.id])).rows[0];
  assert.equal(row.state, "resolved", "The famine thread should have run out");
  assert.equal(Number(after.unrest), 20, `Autonomous expiry must not add unrest (got ${after.unrest})`);
  assert.equal(Number(after.food), 5000, `Autonomous expiry must not take food (got ${after.food})`);
  assert.ok(String(row.resolution_text || "").includes("No relief reached"), "The outcome is still told");
  console.log("1. A world crisis that runs out in autonomous play is told, not applied... PASSED");

  // 2. Reopen cooldown
  await pool.query(`UPDATE storylines SET resolved_tick = $1 WHERE id = $2`, [tick, famine.id]);
  await pool.query(
    `INSERT INTO sim_events (tick, burg_id, cell_id, lore_date, type, message, tier) VALUES ($1, $2, $3, 'Test', 'BURG_FAMINE', 'Test famine again', 'MAJOR')`,
    [tick, calm.burg_id, calm.cell_id]
  );
  await openWorldEventThreads(pool, tick);
  const reopened = Number((await pool.query(
    `SELECT COUNT(*)::int c FROM storylines WHERE cell_id = $1 AND rule_id = 'WORLD_FAMINE' AND state IN ('open', 'escalated')`,
    [calm.cell_id])).rows[0].c);
  assert.equal(reopened, 0, "The same famine must not reopen right after the last one ended");
  const later = tick + STORY_REOPEN_COOLDOWN_TICKS + 1;
  await pool.query(
    `INSERT INTO sim_events (tick, burg_id, cell_id, lore_date, type, message, tier) VALUES ($1, $2, $3, 'Test', 'BURG_FAMINE', 'Famine returns', 'MAJOR')`,
    [later, calm.burg_id, calm.cell_id]
  );
  await openWorldEventThreads(pool, later);
  const reopenedLater = Number((await pool.query(
    `SELECT COUNT(*)::int c FROM storylines WHERE cell_id = $1 AND rule_id = 'WORLD_FAMINE' AND state = 'open'`,
    [calm.cell_id])).rows[0].c);
  assert.equal(reopenedLater, 1, "After the cooldown a new famine may open");
  console.log(`2. A town's crisis waits ${STORY_REOPEN_COOLDOWN_TICKS} ticks before it can reopen... PASSED`);

  // 3. Orphaned arcs end by the town's state
  const old = tick - ORPHAN_ARC_GRACE_TICKS - 5;
  const mkArc = async (cellId: number) =>
    Number((await pool.query(
      `INSERT INTO storylines (scale, scope_cells, cell_id, rx, ry, z, question, stakes, actor_ids, clock, clock_max, state, origin, source, created_tick)
       VALUES ('arc', $1, $2, 50, 50, 0, 'Test arc', 'Test stakes', '{}', 0, 8, 'open', 'arc', 'escalation', $3) RETURNING id`,
      [[cellId], cellId, old])).rows[0].id);
  const calmArc = await mkArc(Number(calm.cell_id));
  const troubledArc = await mkArc(Number(troubled.cell_id));
  await sweepStaleStorylines(pool, tick);
  const states = (await pool.query(`SELECT id, state FROM storylines WHERE id = ANY($1::bigint[])`, [[calmArc, troubledArc]])).rows;
  const stateOf = (id: number) => states.find((s: any) => Number(s.id) === id)?.state;
  assert.equal(stateOf(calmArc), "resolved", "A calm town contains a stalled arc itself");
  assert.equal(stateOf(troubledArc), "failed", "A troubled town lets a stalled arc fail");
  console.log("3. Stalled arcs resolve in calm towns and fail in troubled ones... PASSED");

  console.log("\nALL STORY COOLDOWN TESTS PASSED");
}

isolateTest()
  .then((done) => main().then(done, async (e: unknown) => { await done(); throw e; }))
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("STORY COOLDOWN TEST FAILED - COMMIT BLOCKED:", err.message || err);
    process.exit(1);
  });
