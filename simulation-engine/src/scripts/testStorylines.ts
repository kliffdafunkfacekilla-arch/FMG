/**
 * Unified storylines, escalation, caps, and Story Desk test (Phase 9).
 */
import assert from "node:assert/strict";
import pool from "../db/pool.js";
import { isolateTest } from "./testIsolation.js";
import { migrate } from "../db/migrate.js";
import { createThread, getOpenThreads } from "../engine/threads/threadEngine.js";
import {
  STORYLINE_CAPS,
  checkStoryEscalations,
  createStoryline,
  decideProposal,
  listDeskProposals,
} from "../engine/story/storylines.js";
import { applyMapOverlays, loadTileOverlays } from "../engine/micro/overlays.js";

async function main() {
  console.log("=== Testing Unified Storylines, Escalation Caps & Story Desk (Phase 9) ===");
  await migrate(pool);

  const layerRes = await pool.query(
    `SELECT l.cell_id, l.rx, l.ry, l.props, l.npcs
     FROM sim_sector_layers l
     JOIN sim_burg_economy b ON b.cell_id = l.cell_id
     WHERE l.z_layer = 0 AND jsonb_array_length(l.npcs) > 0
     ORDER BY l.cell_id ASC
     LIMIT 1`
  );
  assert.ok(layerRes.rows.length > 0, "Expected at least one cached burg surface layer");
  const { cell_id: cellId, rx, ry, props: rawProps } = layerRes.rows[0];

  const actorRes = await pool.query(
    `SELECT p.id, p.name, b.cell_id
     FROM sim_paragons p
     JOIN sim_burg_economy b ON b.burg_id = p.burg_id
     WHERE p.burg_id = (SELECT burg_id FROM sim_burg_economy WHERE cell_id = $1 LIMIT 1)
       AND p.outlaw_id IS NULL
     ORDER BY p.id ASC
     LIMIT 1`,
    [cellId]
  );
  assert.ok(actorRes.rows.length > 0, "Expected at least one paragon actor in focus cell");
  const actorRef = `paragon:${actorRes.rows[0].id}`;

  // 1. Verify unified schema + sim_threads compatibility view
  const tickRes = await pool.query(`SELECT COALESCE(MAX(tick), 1) AS t FROM sim_calendar`);
  const tick = Number(tickRes.rows[0]?.t || 1);

  const viaCreate = await createThread(pool, {
    question: "Will the grain ledger surface before nightfall?",
    stakes: "Missing shipments leave the garrison unpaid.",
    actor_ids: [actorRef],
    cell_id: cellId,
    rx,
    ry,
    clock_max: 5,
    created_tick: tick,
    rule_id: "TEST_VIEW_COMPAT",
  });
  const viewRow = await pool.query(`SELECT id, state FROM sim_threads WHERE id = $1`, [viaCreate.id]);
  assert.equal(viewRow.rows[0]?.state, "open", "sim_threads view should expose newly opened thread");
  const openThreads = await getOpenThreads(pool, cellId);
  assert.ok(openThreads.some((t) => t.id === viaCreate.id), "getOpenThreads missing newly created thread");
  await pool.query(`DELETE FROM sim_threads WHERE id = $1`, [viaCreate.id]);
  const deletedCheck = await pool.query(`SELECT 1 FROM storylines WHERE id = $1`, [viaCreate.id]);
  assert.equal(deletedCheck.rows.length, 0, "INSTEAD OF DELETE trigger on sim_threads should delete from storylines");
  console.log("1. Unified storylines table + sim_threads compatibility view... PASSED");

  // 2. Story Desk returns grounded proposals with sources & why
  await pool.query(`DELETE FROM storylines WHERE cell_id = $1`, [cellId]);
  const desk = await listDeskProposals(pool, { cellId, rx, ry, z: 0, tick });
  assert.ok(desk.proposals.length >= 2, `Expected >= 2 grounded desk proposals, got ${desk.proposals.length}`);
  for (const p of desk.proposals) {
    assert.ok(p.actor_ids.length > 0, `Proposal #${p.id} missing grounded actor_ids`);
    assert.ok(p.facts.length > 0, `Proposal #${p.id} missing cited facts`);
    assert.ok(p.why && p.why.length > 5, `Proposal #${p.id} missing why rationale`);
  }
  console.log(`2. Story Desk surfaced ${desk.proposals.length} grounded proposals with facts and rationale... PASSED`);

  // 3. Accepting a proposal opens it and places a clue overlay + rumor visible on the battle map
  const acceptTarget = desk.proposals[0]!;
  const accepted = await decideProposal(pool, acceptTarget.id, { decision: "accept", tick });
  assert.equal(accepted.storyline.state, "open");
  assert.ok(accepted.hooksPlaced.overlayCount >= 1, "Accepting proposal must place overlay delta");
  assert.equal(accepted.hooksPlaced.eventLogged, true, "Accepting proposal must log rumor via event.log delta");

  const tileOverlays = await loadTileOverlays(pool, cellId, rx, ry, 0);
  const mapPropsWithHooks = applyMapOverlays(Array.isArray(rawProps) ? rawProps : [], tileOverlays);
  const clueProp = mapPropsWithHooks.find((p: any) => String(p.id) === `prop_story_clue_${acceptTarget.id}`);
  assert.ok(clueProp, `Placed story hook prop prop_story_clue_${acceptTarget.id} should be discoverable on the battle map`);
  console.log("3. Accepting proposal opens storyline and places discoverable map overlay hook... PASSED");

  // 4. Rejecting a proposal puts its actor on cooldown and blocks immediate re-proposal
  const rejectTarget = desk.proposals[1]!;
  const rejected = await decideProposal(pool, rejectTarget.id, { decision: "reject", tick });
  assert.equal(rejected.storyline.state, "rejected");
  assert.equal(rejected.storyline.cooldown_until_tick, tick + STORYLINE_CAPS.actorRejectionCooldownTicks);

  const blockedDuringCooldown = await createStoryline(pool, {
    scale: "thread",
    scope_cells: [cellId],
    cell_id: cellId,
    rx,
    ry,
    question: "Repeated rejected crisis?",
    stakes: "Should be suppressed during actor cooldown.",
    actor_ids: rejectTarget.actor_ids,
    source: "drama",
    rule_id: "REPEATED_AFTER_REJECT",
    why: "Testing cooldown guard",
    facts: [{ kind: "entity", id: rejectTarget.actor_ids[0]!, summary: "Cooldown test" }],
    createdTick: tick + 1,
    state: "proposed",
  });
  assert.equal(blockedDuringCooldown, null, "Rejected actor must stay suppressed during cooldown window");
  console.log("4. Rejecting proposal enforces actor cooldown and suppresses re-proposal... PASSED");

  // 5. Expired thread with living actor escalates to exactly ONE parent arc
  const otherParagonRes = await pool.query(
    `SELECT ref FROM entities WHERE kind = 'person' AND alive = true AND ref LIKE 'paragon:%' ORDER BY id DESC LIMIT 1`
  );
  assert.ok(otherParagonRes.rows.length > 0, "Expected a living paragon in entities registry for escalation test");
  const escalActor = String(otherParagonRes.rows[0].ref);
  await pool.query(`DELETE FROM storylines WHERE cell_id = $1`, [cellId]);

  const expiredThread = await createStoryline(pool, {
    scale: "thread",
    scope_cells: [cellId],
    cell_id: cellId,
    rx,
    ry,
    question: "Will the levee breach before dawn?",
    stakes: "Unchecked storm pressure threatens the lower wards.",
    actor_ids: [escalActor],
    source: "world",
    rule_id: "TEST_EXPIRED_ESCALATION",
    why: "Expired thread escalation test",
    facts: [{ kind: "entity", id: escalActor, summary: "Living principal" }],
    createdTick: tick - 5,
    state: "open",
  });
  assert.ok(expiredThread, "Expected expired test thread to be created");
  await pool.query(`UPDATE storylines SET state = 'expired', resolved_tick = $1 WHERE id = $2`, [tick, expiredThread.id]);

  const esc1 = await checkStoryEscalations(pool, tick);
  assert.equal(esc1.parentArcsCreated, 1, "Expired thread with living actor must create 1 parent arc");
  const childAfter = await pool.query(`SELECT parent_id FROM storylines WHERE id = $1`, [expiredThread.id]);
  const parentArcId = Number(childAfter.rows[0]?.parent_id || 0);
  assert.ok(parentArcId > 0, "Expired child thread must link to parent arc via parent_id");
  const parentRow = await pool.query(`SELECT scale, scope_cells, state FROM storylines WHERE id = $1`, [parentArcId]);
  assert.equal(parentRow.rows[0]?.scale, "arc");
  assert.equal(parentRow.rows[0]?.state, "open");
  assert.ok(parentRow.rows[0]?.scope_cells.length >= 1, "Parent arc should carry regional scope_cells");

  const esc2 = await checkStoryEscalations(pool, tick);
  assert.equal(esc2.parentArcsCreated, 0, "Re-running checkStoryEscalations must not duplicate parent arc");
  console.log("5. Expired thread with living actor escalates to exactly one parent arc... PASSED");

  // 6. Scale caps enforce maxOpenPerRegionPerScale.thread (= 3)
  await pool.query(`DELETE FROM storylines WHERE cell_id = $1`, [cellId]);
  let createdCount = 0;
  for (let i = 1; i <= 4; i++) {
    const r = await createStoryline(pool, {
      scale: "thread",
      scope_cells: [cellId],
      cell_id: cellId,
      rx,
      ry,
      question: `Cap test thread #${i}?`,
      stakes: `Testing open cap slot #${i}.`,
      actor_ids: [escalActor],
      source: "reaction",
      rule_id: `CAP_TEST_${i}`,
      why: "Cap verification",
      facts: [{ kind: "entity", id: escalActor, summary: "Cap actor" }],
      createdTick: tick,
      state: "open",
    });
    if (r) createdCount++;
  }
  assert.equal(
    createdCount,
    STORYLINE_CAPS.maxOpenPerRegionPerScale.thread,
    `Expected open thread cap=${STORYLINE_CAPS.maxOpenPerRegionPerScale.thread}, got ${createdCount}`
  );
  console.log(`6. Region scale cap stopped excess open threads at ${createdCount}... PASSED`);

  console.log("\nALL STORYLINE & STORY DESK TESTS PASSED");
}

isolateTest()
  .then((done) => main().then(done, async (e: unknown) => { await done(); throw e; }))
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("STORYLINES TEST FAILED - COMMIT BLOCKED:", err.message || err);
    process.exit(1);
  });
