import pool from "../db/pool.js";
import {
  ensureThreadTable,
  createThread,
  advanceThreadClocks
} from "../engine/threads/threadEngine.js";

async function testThreadClocks() {
  console.log("================================================================");
  console.log("       STORY_AUDIT STEP 3: THREAD CLOCKS & WORLD DELTAS         ");
  console.log("  Thread clocks advance, escalate, and resolve with world deltas");
  console.log("================================================================\n");

  await ensureThreadTable(pool);

  // 1. Fetch real agent and existing sector layer from PostgreSQL
  const realAgentRes = await pool.query(`SELECT id, name FROM sim_agents LIMIT 1`);
  const realAgent = realAgentRes.rows[0];
  if (!realAgent) throw new Error("No real agent found for test!");
  const realAgentId = String(realAgent.id);

  const layerRowRes = await pool.query(`SELECT cell_id, rx, ry, npcs FROM sim_sector_layers LIMIT 1`);
  if (layerRowRes.rows.length === 0) throw new Error("No sector layer found in sim_sector_layers!");
  const targetCellId = Number(layerRowRes.rows[0].cell_id);
  const targetRx = Number(layerRowRes.rows[0].rx);
  const targetRy = Number(layerRowRes.rows[0].ry);

  // Link or fetch burg for targetCellId
  let burgRes = await pool.query(
    `SELECT burg_id, cell_id, unrest, wealth FROM sim_burg_economy WHERE cell_id = $1 LIMIT 1`,
    [targetCellId]
  );
  if (burgRes.rows.length === 0) {
    const anyBurg = await pool.query(`SELECT burg_id FROM sim_burg_economy LIMIT 1`);
    await pool.query(`UPDATE sim_burg_economy SET cell_id = $1 WHERE burg_id = $2`, [targetCellId, anyBurg.rows[0].burg_id]);
    burgRes = await pool.query(`SELECT burg_id, cell_id, unrest, wealth FROM sim_burg_economy WHERE burg_id = $1`, [anyBurg.rows[0].burg_id]);
  }
  const realBurg = burgRes.rows[0];
  const targetBurgId = Number(realBurg.burg_id);
  // Reset baseline unrest & wealth so clamp at 100 is not hit
  await pool.query(
    `UPDATE sim_burg_economy SET unrest = 30, wealth = 1000 WHERE burg_id = $1`,
    [targetBurgId]
  );
  const initialUnrest = 30;
  const initialWealth = 1000;

  // Ensure sector layer has an NPC with realAgentId to verify sector layer mutation
  let npcs = Array.isArray(layerRowRes.rows[0].npcs) ? layerRowRes.rows[0].npcs : [];
  if (!npcs.some((n: any) => String(n.id) === realAgentId)) {
    npcs.push({
      id: realAgentId,
      name: realAgent.name,
      role: "TestActor",
      tags: ["civilian"]
    });
    await pool.query(
      `UPDATE sim_sector_layers SET npcs = $1 WHERE cell_id = $2 AND rx = $3 AND ry = $4`,
      [JSON.stringify(npcs), targetCellId, targetRx, targetRy]
    );
  }

  // 2. Create test thread with clock_max = 3 and specific on_expire outcome (no generic constants)
  process.stdout.write("1. Creating test thread with clock=0, clock_max=3 and specific on_expire... ");
  const testThread = await createThread(pool, {
    question: "Will the grain tax trigger an open dock strike?",
    stakes: "Dockworkers refuse to load granary barges, driving unrest and sabotaging trade.",
    actor_ids: [realAgentId],
    cell_id: targetCellId,
    rx: targetRx,
    ry: targetRy,
    clock: 0,
    clock_max: 3,
    origin: "reaction",
    created_tick: 500,
    rule_id: "test_dock_strike",
    on_expire: {
      unrestDelta: 22,
      wealthDelta: -350,
      actorTagsAdd: ["#DockStrikeFailed", "#UnionBlacklisted"],
      narrativeSummary: "Dock strike was brutally crushed by harbor mercenaries; trade collapsed and fury spread."
    }
  });
  console.log(`✅ PASSED (Thread ID: ${testThread.id})`);

  // 3. Tick 1: Advance clock 0 -> 1
  process.stdout.write("2. Ticking thread clock (0 -> 1)... ");
  await advanceThreadClocks(pool, 501);
  const tick1Res = await pool.query(`SELECT clock, state FROM sim_threads WHERE id = $1`, [testThread.id]);
  if (tick1Res.rows[0]?.clock !== 1 || tick1Res.rows[0]?.state !== "open") {
    throw new Error(`Expected clock=1, state=open; got: ${JSON.stringify(tick1Res.rows[0])}`);
  }
  console.log("✅ PASSED (clock: 1, state: open)");

  // 4. Tick 2: Advance clock 1 -> 2 (reaches half of clock_max 3 -> escalates)
  process.stdout.write("3. Ticking thread clock (1 -> 2: Escalation threshold)... ");
  await advanceThreadClocks(pool, 502);
  const tick2Res = await pool.query(`SELECT clock, state FROM sim_threads WHERE id = $1`, [testThread.id]);
  if (tick2Res.rows[0]?.clock !== 2 || tick2Res.rows[0]?.state !== "escalated") {
    throw new Error(`Expected clock=2, state=escalated; got: ${JSON.stringify(tick2Res.rows[0])}`);
  }
  console.log("✅ PASSED (clock: 2, state: escalated)");

  // 5. Tick 3: Advance clock 2 -> 3 (reaches clock_max -> resolves with world delta)
  process.stdout.write("4. Ticking thread clock (2 -> 3: Resolution & World Delta)... ");
  const resSummary = await advanceThreadClocks(pool, 503);
  const tick3Res = await pool.query(
    `SELECT clock, state, resolved_tick, resolution FROM sim_threads WHERE id = $1`,
    [testThread.id]
  );
  const resolved = tick3Res.rows[0];
  if (resolved?.state !== "resolved" || resolved?.resolved_tick !== 503 || !resolved?.resolution) {
    throw new Error(`Expected state=resolved, resolved_tick=503; got: ${JSON.stringify(resolved)}`);
  }
  console.log("✅ PASSED (state: resolved, resolved_tick: 503)");

  // 6. Verify real world delta in sim_burg_economy
  process.stdout.write("5. Verifying real world economy mutation (not just a log line)... ");
  const burgAfterRes = await pool.query(
    `SELECT unrest, wealth FROM sim_burg_economy WHERE burg_id = $1 LIMIT 1`,
    [targetBurgId]
  );
  const burgAfter = burgAfterRes.rows[0];
  if (!burgAfter) throw new Error("Burg not found after resolution!");
  const unrestDelta = Number(burgAfter.unrest) - initialUnrest;
  const wealthDelta = initialWealth - Number(burgAfter.wealth);

  if (unrestDelta !== 22) {
    throw new Error(`Expected specific unrest delta of +22; actual delta: ${unrestDelta}`);
  }
  if (wealthDelta !== 350) {
    throw new Error(`Expected specific wealth delta of -350; actual delta: ${wealthDelta}`);
  }
  console.log(`✅ PASSED (Exact specific delta verified: Unrest +${unrestDelta}, Wealth -${wealthDelta})`);

  // 7. Verify sector layer NPC consequence tags
  process.stdout.write("6. Verifying real world sector entity tag mutations... ");
  const layerAfterRes = await pool.query(
    `SELECT npcs FROM sim_sector_layers WHERE cell_id = $1 AND rx = $2 AND ry = $3 LIMIT 1`,
    [targetCellId, targetRx, targetRy]
  );
  const layerNpcs = Array.isArray(layerAfterRes.rows[0]?.npcs) ? layerAfterRes.rows[0].npcs : [];
  const testActor = layerNpcs.find((n: any) => String(n.id) === realAgentId);
  if (!testActor?.tags?.includes("#DockStrikeFailed")) {
    throw new Error(`Actor ${realAgentId} missing consequence tag #DockStrikeFailed! Tags: ${testActor?.tags}`);
  }
  console.log("✅ PASSED (Actor mutated with #DockStrikeFailed)");

  // 8. Verify sim_events rumor logged
  process.stdout.write("7. Verifying rumor logged to sim_events... ");
  const eventRes = await pool.query(
    `SELECT id, type, message FROM sim_events WHERE type = 'THREAD_RESOLVED' ORDER BY id DESC LIMIT 1`
  );
  if (!eventRes.rows[0]?.message.includes("Dock strike was brutally crushed") && !eventRes.rows[0]?.message.includes(testThread.stakes)) {
    throw new Error(`sim_events missing thread resolution stakes or narrative summary! Message: ${eventRes.rows[0]?.message}`);
  }
  console.log("✅ PASSED (sim_events rumor logged)");

  // Clean up test thread
  await pool.query(`DELETE FROM sim_threads WHERE id = $1`, [testThread.id]);

  console.log("\n================================================================");
  console.log("       ALL STORY_AUDIT STEP 3 CLOCK TESTS PASSED!               ");
  console.log("================================================================\n");

  await pool.end();
}

testThreadClocks().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
