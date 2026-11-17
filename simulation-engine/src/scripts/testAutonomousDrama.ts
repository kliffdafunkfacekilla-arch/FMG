import assert from "node:assert/strict";
import pool from "../db/pool.js";
import { evaluateThreadState, validateActorIds, advanceThreadClocks, SimThread } from "../engine/threads/threadEngine.js";
import { runAutonomousDramaAgent } from "../engine/agents/autonomousDramaAgent.js";
import { runChroniclerAgent } from "../engine/agents/chroniclerAgent.js";

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

    // 3. Test cross-tick memory tags & arc promotion via advanceThreadClocks
    await client.query(`UPDATE sim_threads SET clock = 2, clock_max = 5, state = 'open' WHERE cell_id = $1 AND rule_id = 'AUTONOMOUS_CLASH'`, [cell_id]);
    await client.query(`DELETE FROM sim_story_arcs WHERE cell_id = $1 AND state = 'active'`, [cell_id]);
    // Run advanceThreadClocks for a few ticks until either escalation or resolution occurs
    for (let t = 11; t <= 16; t++) {
      await advanceThreadClocks(client, t, `Tick ${t}`);
    }
    const afterRes = await client.query(
      `SELECT state FROM sim_threads WHERE cell_id = $1 AND rule_id = 'AUTONOMOUS_CLASH' ORDER BY id DESC LIMIT 1`,
      [cell_id]
    );
    const arcCheck = await client.query(`SELECT source FROM sim_story_arcs WHERE cell_id = $1 LIMIT 1`, [cell_id]);
    const instParts = String(actorIds[0] || "").match(/^(paragon|citizen):(\d+)$/);
    let hasTraitUpdate = false;
    if (instParts) {
      const trRes = instParts[1] === "paragon"
        ? await client.query(`SELECT traits FROM sim_paragons WHERE id = $1`, [Number(instParts[2])])
        : await client.query(`SELECT traits FROM population_demographics WHERE citizen_id = $1`, [Number(instParts[2])]);
      const trStr = JSON.stringify(trRes.rows[0]?.traits || "");
      hasTraitUpdate = trStr.includes("#ThwartedBy:") || trStr.includes("#PrevailedOver:");
    }
    assert.ok(
      afterRes.rows[0].state === "escalated" || afterRes.rows[0].state === "resolved",
      `Expected clash thread to escalate or resolve, got ${afterRes.rows[0].state}`
    );
    assert.ok(
      (arcCheck.rowCount || 0) > 0 || hasTraitUpdate,
      "Expected either arc promotion on escalation or cross-tick memory tag on resolution"
    );
    console.log(`3. Thread-to-arc escalation & cross-tick memory verified (state=${afterRes.rows[0].state})... PASSED`);

    // 4. Test Chronicler clustering 2+ AUTONOMOUS_CLASH events into REGIONAL_RUMOR
    await client.query(`DELETE FROM sim_events WHERE type = 'REGIONAL_RUMOR'`);
    await client.query(
      `INSERT INTO sim_events (tick, lore_date, type, tier, burg_id, cell_id, message)
       VALUES (16, 'Tick 16', 'AUTONOMOUS_CLASH', 'MINOR', $1, $2, '[CLASH] Rival stewards disputed grain tariffs.')`,
      [burg_id, cell_id]
    );
    await runChroniclerAgent(client, 16, "Tick 16");
    const rumorRes = await client.query(`SELECT message FROM sim_events WHERE type = 'REGIONAL_RUMOR' AND tick = 16`);
    assert.ok((rumorRes.rowCount || 0) === 1, "Expected runChroniclerAgent to cluster recent clashes into a REGIONAL_RUMOR");
    console.log("4. Chronicler clustered recent clashes into REGIONAL_RUMOR... PASSED");

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

