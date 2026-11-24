import assert from "node:assert/strict";
import pool from "../db/pool.js";
import { getEntityByRef } from "../engine/entities/registry.js";
import { buildDirectorInputPayload } from "../engine/rpg/directorBridge.js";
import { buildStoryContext, estimateTokens, renderStoryContext } from "../engine/story/context.js";
import { createThread } from "../engine/threads/threadEngine.js";
import { isolateTest } from "./testIsolation.js";

async function main() {
  console.log("=== Testing Ranked Token-Budgeted StoryContext Builder (Phase 7) ===");

  // 1. Find a neighboring burg near Excelsis (cell 30627)
  const nearRes = await pool.query(
    `SELECT burg_id, cell_id, name
     FROM sim_burg_economy
     WHERE cell_id <> 30627
     ORDER BY cell_dist2(cell_id, 30627) ASC, burg_id ASC
     LIMIT 1`
  );
  const neighborBurg = nearRes.rows[0];
  assert.ok(neighborBurg, "Need a neighboring burg near Excelsis");
  const neighborCellId = Number(neighborBurg.cell_id);

  // Pick a real actor for an open thread on the neighboring burg
  const paragonRes = await pool.query(
    `SELECT id, name FROM sim_paragons ORDER BY id ASC LIMIT 1`
  );
  assert.ok(paragonRes.rows[0], "Need a real paragon actor");
  const actorRef = `paragon:${paragonRes.rows[0].id}`;

  const createdThread = await createThread(pool, {
    question: `Will ${neighborBurg.name}'s grain convoy clear the highway before curfew?`,
    stakes: "A stalled convoy leaves both burgs short on winter grain.",
    actor_ids: [actorRef],
    cell_id: neighborCellId,
    rx: 50,
    ry: 50,
    clock_max: 6,
    origin: "world",
    rule_id: "TEST_NEIGHBOR_THREAD",
    created_tick: 1,
  });
  const threadId = createdThread.id;

  // Seed an active war between two real factions
  const facRes = await pool.query(`SELECT id FROM sim_factions ORDER BY id ASC LIMIT 2`);
  assert.equal(facRes.rows.length, 2, "Need at least 2 factions");
  await pool.query(
    `DELETE FROM sim_diplomacy WHERE (faction_a_id = $1 AND faction_b_id = $2) OR (faction_a_id = $2 AND faction_b_id = $1)`,
    [facRes.rows[0].id, facRes.rows[1].id]
  );
  await pool.query(
    `INSERT INTO sim_diplomacy (faction_a_id, faction_b_id, status, tension) VALUES ($1, $2, 'WAR', 95)`,
    [facRes.rows[0].id, facRes.rows[1].id]
  );

  // Pick a real player character & seed a recent GM memory trace
  const pcRes = await pool.query(`SELECT id, name FROM sim_player_character ORDER BY id ASC LIMIT 1`);
  assert.ok(pcRes.rows[0], "Need at least 1 real player character");
  const playerId = Number(pcRes.rows[0].id);

  const markerMem = "Uncovered smuggler tally ledger beneath Excelsis quay";
  await pool.query(
    `INSERT INTO sim_gm_memories (player_id, timestamp, summary, tags) VALUES ($1, $2, $3, '["INSPECT","quay","success"]'::jsonb)`,
    [playerId, Date.now(), markerMem]
  );

  // 2. Build StoryContext within 3000-token budget
  const ctx = await buildStoryContext(
    pool,
    { cellId: 30627, rx: 50, ry: 50, z: 0 },
    { playerId },
    { tokenBudget: 3000 }
  );

  assert.equal(ctx.focus.tile.cellId, 30627);
  assert.ok(ctx.focus.entities.length > 0, "Focus entities must populate on Excelsis");
  assert.ok(ctx.focus.entities.some((e) => Boolean(e.want && e.want.length > 5)), "Focus NPC must carry a grounded want");
  assert.ok(ctx.region.burgs.some((b) => b.cellId === neighborCellId), "Neighboring burg must appear in region");
  assert.ok(ctx.region.openStorylines.some((t) => t.id === threadId), "Neighboring open thread must appear in region");
  assert.ok(ctx.world.wars.length > 0, "Seeded war must appear in world");
  assert.ok(ctx.party.characters.length > 0, "Player character must appear in party");
  assert.ok(ctx.party.gmMemories.some((m) => m.includes(markerMem)), "Recent GM memory must appear in party");
  assert.ok(ctx.meta.tokenEstimate <= 3000, `Token estimate ${ctx.meta.tokenEstimate} exceeds 3000`);

  // Every ID in the context pack resolves in the entities registry (W5)
  for (const e of ctx.focus.entities) {
    const row = await getEntityByRef(pool, e.ref);
    assert.ok(row, `Focus entity ${e.ref} missing from entities registry`);
  }
  for (const c of ctx.party.characters) {
    const row = await getEntityByRef(pool, c.ref);
    assert.ok(row, `Party character ${c.ref} missing from entities registry`);
  }

  const rendered = renderStoryContext(ctx);
  assert.ok(rendered.includes("[FOCUS]") && rendered.includes("[PARTY]") && rendered.includes("[REGION]") && rendered.includes("[WORLD]"));
  assert.ok(rendered.includes(`[thread:${threadId}]`), "Rendered prompt text must cite thread ID");
  assert.ok(!rendered.includes('{"'), "Rendered StoryContext must use labelled lines, not raw JSON dumps");
  assert.equal(estimateTokens(rendered), ctx.meta.tokenEstimate);
  console.log(`1. Full StoryContext pack built (${ctx.meta.tokenEstimate} tokens, 0 unregistered IDs)... PASSED`);

  // 3. Budget enforcement drops lowest-priority sections while preserving focus tile
  const tight = await buildStoryContext(
    pool,
    { cellId: 30627, rx: 50, ry: 50, z: 0 },
    { playerId: 1 },
    { tokenBudget: 350 }
  );
  assert.ok(tight.meta.tokenEstimate <= 350, `Tight token estimate ${tight.meta.tokenEstimate} exceeded 350`);
  assert.ok(tight.meta.dropped.length > 0, "Tight budget must record dropped items in meta.dropped");
  assert.equal(tight.focus.tile.cellId, 30627, "Focus tile must survive budget trimming");
  console.log(`2. Tight budget trimming respected (${tight.meta.tokenEstimate}/350 tokens, dropped=${tight.meta.dropped.length} groups)... PASSED`);

  // 4. directorBridge uses clean default grid center (rx=50, ry=50) & attaches StoryContext
  const dirPayload = await buildDirectorInputPayload(30627);
  assert.equal(dirPayload.simulation_state.sector_coords.rx, 50);
  assert.equal(dirPayload.simulation_state.sector_coords.ry, 50);
  assert.ok(dirPayload.storyContext && dirPayload.renderedContext);
  console.log("3. directorBridge default coords (50,50) & StoryContext integration... PASSED");

  console.log("\nALL STORY CONTEXT BUILDER TESTS PASSED");
}

isolateTest()
  .then((done) => main().then(done, async (e: unknown) => { await done(); throw e; }))
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("STORY CONTEXT TEST FAILED - COMMIT BLOCKED:", err.message || err);
    process.exit(1);
  });
