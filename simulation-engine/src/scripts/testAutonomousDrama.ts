import assert from "node:assert/strict";
import pool from "../db/pool.js";
import { evaluateThreadState, validateActorIds, SimThread } from "../engine/threads/threadEngine.js";
import { runAutonomousDramaAgent } from "../engine/agents/autonomousDramaAgent.js";

async function main() {
  console.log("=== Testing Autonomous Drama & Non-Custody Thread Evaluation ===");

  // 1. Non-custody threads must NOT auto-resolve as FREEDOM when actor lacks #InCustody
  const frictionThread: SimThread = {
    id: 9999,
    question: "Will Theron Ironwood prevail in Anvil Roosts?",
    stakes: "Theron Ironwood is pushing to preserve civic ledgers.",
    actor_ids: ["paragon:1"],
    cell_id: 1,
    rx: 50,
    ry: 50,
    clock: 0,
    clock_max: 6,
    state: "open",
    origin: "reaction",
    created_tick: 1,
    resolved_tick: null,
    resolution: null,
    rule_id: "LOCAL_PARAGON_FRICTION"
  };

  const mockNpc = {
    id: "npc_theron",
    name: "Theron Ironwood",
    role: "Garrison Commander",
    alive: true,
    hp: 30,
    tags: ["paragon:1", "#Garrison"]
  };

  const evalFriction = evaluateThreadState(frictionThread, [mockNpc], []);
  assert.equal(evalFriction.isResolved, false, "LOCAL_PARAGON_FRICTION must not auto-resolve as FREEDOM on turn 1");
  assert.equal(evalFriction.outcomeType, "UNRESOLVED");

  const clashThread: SimThread = { ...frictionThread, rule_id: "AUTONOMOUS_CLASH", actor_ids: ["paragon:1", "citizen:1"] };
  const evalClash = evaluateThreadState(clashThread, [mockNpc], []);
  assert.equal(evalClash.isResolved, false, "AUTONOMOUS_CLASH must not auto-resolve as FREEDOM on turn 1");
  console.log("1. Non-custody threads stay UNRESOLVED instead of falsely freeing actors... PASSED");

  // 2. Autonomous Drama Agent opens a multi-actor clash in a pressured burg (inside rolled-back txn)
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const bRes = await client.query(
      `SELECT b.burg_id, b.cell_id
       FROM sim_burg_economy b
       JOIN sim_paragons p ON p.burg_id = b.burg_id AND p.outlaw_id IS NULL
       GROUP BY b.burg_id, b.cell_id
       LIMIT 1`
    );
    assert.ok(bRes.rows.length > 0, "Expected at least one burg with a paragon in DB");
    const { burg_id, cell_id } = bRes.rows[0];

    await client.query(`UPDATE sim_burg_economy SET unrest = 45, crime_rate = 30 WHERE burg_id = $1`, [burg_id]);
    await client.query(`DELETE FROM sim_threads WHERE cell_id = $1 AND rule_id = 'AUTONOMOUS_CLASH'`, [cell_id]);

    const opened = await runAutonomousDramaAgent(client, 10, "10th Day");
    assert.ok(opened >= 1, `Expected runAutonomousDramaAgent to open at least 1 clash thread, got ${opened}`);

    const tRes = await client.query(
      `SELECT actor_ids, rule_id FROM sim_threads WHERE cell_id = $1 AND rule_id = 'AUTONOMOUS_CLASH' ORDER BY id DESC LIMIT 1`,
      [cell_id]
    );
    assert.ok(tRes.rows.length === 1, "Expected AUTONOMOUS_CLASH thread row in sim_threads");
    const actorIds: string[] = tRes.rows[0].actor_ids;
    assert.equal(actorIds.length, 2, `Expected 2 actors (instigator + target), got ${JSON.stringify(actorIds)}`);

    const validation = await validateActorIds(client, actorIds);
    assert.equal(validation.valid, true, `Invalid actor IDs in autonomous clash: ${validation.invalidIds.join(", ")}`);
    console.log(`2. AutonomousDramaAgent opened multi-actor clash (${actorIds.join(" vs ")}) with valid Rule 7 IDs... PASSED`);

    await client.query("ROLLBACK");
  } finally {
    client.release();
    await pool.end();
  }

  console.log("ALL AUTONOMOUS DRAMA TESTS PASSED");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
