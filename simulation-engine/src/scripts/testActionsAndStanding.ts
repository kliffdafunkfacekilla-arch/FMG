/**
 * Action ledger, standing deltas, computed consequences, and "what-if" previews test (Phase 11).
 */
import assert from "node:assert/strict";
import pool from "../db/pool.js";
import { isolateTest } from "./testIsolation.js";
import { migrate } from "../db/migrate.js";
import { flushStepDeltas, validateDeltas } from "../engine/deltas/index.js";
import {
  listActionsForStoryline,
  listRecentActionsForParty,
  listStandingForParty,
  recordAction,
} from "../engine/story/actions.js";
import { createStoryline } from "../engine/story/storylines.js";
import { resolveStorylineFromActions } from "../engine/story/resolve.js";
import { buildStoryContext, renderStoryContext } from "../engine/story/context.js";
import { MAX_PREVIEW_OPTIONS, previewStoryOptions } from "../engine/story/preview.js";
import { ensureEntity } from "../engine/entities/registry.js";
import { worldFingerprint } from "./tickFingerprint.js";

async function main() {
  console.log("=== Testing Action Ledger, Standing, Computed Consequences & Previews (Phase 11) ===");
  await migrate(pool);

  const tickRes = await pool.query(`SELECT COALESCE(MAX(tick), 1)::int AS t FROM sim_calendar`);
  const tick = Number(tickRes.rows[0]?.t || 1);

  const playerRes = await pool.query(`SELECT id, name FROM sim_player_character ORDER BY id ASC LIMIT 1`);
  const playerId = playerRes.rows[0] ? Number(playerRes.rows[0].id) : 1;
  const partyRef = `player:${playerId}`;
  await ensureEntity(pool, partyRef, { name: playerRes.rows[0]?.name || "Adventurer", kind: "person", lod: "micro", createdTick: tick });

  // Pick a cached burg tile with a real paragon + adult citizen
  const targetRes = await pool.query(
    `SELECT b.burg_id, b.name AS burg_name, b.cell_id, b.unrest, b.wealth, c.faction_id,
            p.id AS paragon_id, p.name AS paragon_name,
            d.citizen_id, d.name AS citizen_name
     FROM sim_burg_economy b
     JOIN sim_cells c ON c.id = b.cell_id
     JOIN sim_paragons p ON p.burg_id = b.burg_id AND p.outlaw_id IS NULL
     JOIN population_demographics d ON d.settlement_id = b.burg_id AND d.life_stage = 'ADULT' AND d.allegiance_status = 'CIVILIAN'
     WHERE c.faction_id IS NOT NULL AND c.faction_id > 0
     ORDER BY b.burg_id ASC, p.id ASC, d.citizen_id ASC
     LIMIT 1`
  );
  assert.ok(targetRes.rows.length > 0, "Expected burg with faction, paragon, and adult citizen");
  const target = targetRes.rows[0];
  const cellId = Number(target.cell_id);
  const burgId = Number(target.burg_id);
  const factionId = Number(target.faction_id);
  const paragonRef = `paragon:${target.paragon_id}`;
  const witnessCitizenId = Number(target.citizen_id);
  const witnessRef = `citizen:${witnessCitizenId}`;

  await ensureEntity(pool, paragonRef, { name: String(target.paragon_name), kind: "person", lod: "micro", cellId, createdTick: tick });
  await ensureEntity(pool, witnessRef, { name: String(target.citizen_name), kind: "person", lod: "micro", cellId, createdTick: tick });

  // Ensure baseline burg unrest >= 20 so diplomatic -12 and violent +18 are clearly separable
  await pool.query(`UPDATE sim_burg_economy SET unrest = 30, wealth = 5000 WHERE burg_id = $1`, [burgId]);
  await pool.query(`DELETE FROM storylines WHERE cell_id = $1`, [cellId]);

  // 1. Validate standing.adjust deltas (Rule 7) & accumulation/clamping
  const valCheck = await validateDeltas(
    [
      { kind: "standing.adjust", subjectRef: `faction:${factionId}`, partyRef, delta: 15, reason: "Valid faction test", tick },
      { kind: "standing.adjust", subjectRef: "faction:99999999", partyRef, delta: 10, reason: "Invented faction", tick },
      { kind: "standing.adjust", subjectRef: "paragon:99999999", partyRef, delta: 10, reason: "Invented entity", tick },
    ],
    pool
  );
  assert.equal(valCheck.ok.length, 1, "Expected valid faction standing delta to pass");
  assert.equal(valCheck.rejected.length, 2, "Expected invented faction & entity standing deltas to be rejected (Rule 7)");

  await flushStepDeltas(
    pool,
    "test_standing",
    tick,
    [
      { kind: "standing.adjust", subjectRef: `faction:${factionId}`, partyRef, delta: 85, reason: "Saved convoy", tick },
      { kind: "standing.adjust", subjectRef: `faction:${factionId}`, partyRef, delta: 40, reason: "Pushed past cap", tick },
    ],
    0
  );
  const stAfter = await listStandingForParty(pool, [partyRef]);
  const facRow = stAfter.find((s) => s.subject_ref === `faction:${factionId}`);
  assert.ok(facRow && facRow.value === 100 && facRow.reasons.length === 2, "Expected standing clamped to 100 with both reasons recorded");
  await pool.query(`DELETE FROM standing WHERE party_ref = $1`, [partyRef]);
  console.log("1. standing.adjust validation (Rule 7), summation & [-100,100] clamping... PASSED");

  // 2. Fixture storyline: compare diplomatic vs violent resolution from the SAME initial state
  const fixture = await createStoryline(pool, {
    scale: "thread",
    scope_cells: [cellId],
    cell_id: cellId,
    rx: 50,
    ry: 50,
    question: `Will ${target.paragon_name} surrender the contraband tax ledger?`,
    stakes: `Tension over the tax ledger threatens markets in ${target.burg_name}.`,
    actor_ids: [paragonRef, witnessRef],
    source: "drama",
    rule_id: "FIXTURE_PHASE11_RESOLUTION",
    why: "Phase 11 fixture comparison",
    facts: [{ kind: "entity", id: paragonRef, summary: String(target.paragon_name) }],
    createdTick: tick,
    state: "open",
  });
  assert.ok(fixture, "Failed to create fixture storyline");

  // Branch A: Diplomatic resolution
  await pool.query("SAVEPOINT branch_diplomatic");
  await recordAction(pool, {
    tick,
    minute: 120,
    actorRef: partyRef,
    verb: "persuade",
    targetRef: paragonRef,
    location: { cellId, rx: 50, ry: 50, z: 0 },
    method: "charm",
    result: "success:margin=4",
    storylineId: fixture.id,
    witnesses: [witnessRef],
  });
  const dipActs = await listActionsForStoryline(pool, fixture.id);
  assert.equal(dipActs.length, 1, "Expected recorded action linked to storyline");

  const dipOutcome = await resolveStorylineFromActions(pool, { storylineId: fixture.id, partyRef, tick });
  assert.equal(dipOutcome.resolved, true);
  assert.equal(dipOutcome.mode, "diplomatic");
  assert.equal(dipOutcome.followUpId, null);

  const dipBurg = (await pool.query(`SELECT unrest, wealth FROM sim_burg_economy WHERE burg_id = $1`, [burgId])).rows[0];
  const dipStanding = await listStandingForParty(pool, [partyRef]);
  const dipFactionVal = dipStanding.find((s) => s.subject_ref === `faction:${factionId}`)?.value ?? 0;
  const dipWitnessVal = dipStanding.find((s) => s.subject_ref === witnessRef)?.value ?? 0;
  await pool.query("ROLLBACK TO SAVEPOINT branch_diplomatic");

  // Branch B: Violent resolution on the EXACT SAME storyline
  await pool.query("SAVEPOINT branch_violent");
  await recordAction(pool, {
    tick,
    minute: 120,
    actorRef: partyRef,
    verb: "attack",
    targetRef: paragonRef,
    location: { cellId, rx: 50, ry: 50, z: 0 },
    method: "might",
    result: "success:margin=6",
    storylineId: fixture.id,
    witnesses: [witnessRef],
  });
  const vioOutcome = await resolveStorylineFromActions(pool, { storylineId: fixture.id, partyRef, tick });
  assert.equal(vioOutcome.resolved, true);
  assert.equal(vioOutcome.mode, "violent");
  assert.ok(vioOutcome.followUpId && vioOutcome.followUpId > 0, "Violent resolution with witnesses should create follow-up reprisal proposal");

  const vioBurg = (await pool.query(`SELECT unrest, wealth FROM sim_burg_economy WHERE burg_id = $1`, [burgId])).rows[0];
  const vioStanding = await listStandingForParty(pool, [partyRef]);
  const vioFactionVal = vioStanding.find((s) => s.subject_ref === `faction:${factionId}`)?.value ?? 0;
  const vioWitnessVal = vioStanding.find((s) => s.subject_ref === witnessRef)?.value ?? 0;
  const witnessTraitsRes = await pool.query(`SELECT traits FROM population_demographics WHERE citizen_id = $1`, [witnessCitizenId]);
  const witnessTraits = Array.isArray(witnessTraitsRes.rows[0]?.traits) ? witnessTraitsRes.rows[0].traits : [];
  assert.ok(witnessTraits.includes(`#Grudge:player_${playerId}`), `Expected #Grudge:player_${playerId} tag on citizen witness, got ${JSON.stringify(witnessTraits)}`);

  assert.ok(Number(dipBurg.unrest) < 30 && Number(vioBurg.unrest) > 30, "Diplomatic lowers unrest; violent raises unrest");
  assert.ok(Number(dipBurg.wealth) > 5000 && Number(vioBurg.wealth) < 5000, "Diplomatic grows wealth; violent lowers wealth");
  assert.ok(dipFactionVal > 0 && vioFactionVal < 0, "Faction standing must diverge between diplomacy and violence");
  assert.ok(dipWitnessVal > 0 && vioWitnessVal < 0, "Witness standing must diverge between diplomacy and violence");
  console.log(
    `2. Computed consequences pinned: diplomatic(unrest=${dipBurg.unrest}, fac=${dipFactionVal}, wit=${dipWitnessVal}) vs violent(unrest=${vioBurg.unrest}, fac=${vioFactionVal}, wit=${vioWitnessVal}, followUp=${vioOutcome.followUpId})... PASSED`
  );

  // 3. Action ledger & standing flow into buildStoryContext & renderStoryContext
  const recentActs = await listRecentActionsForParty(pool, [partyRef], 5);
  assert.ok(recentActs.length >= 1, "listRecentActionsForParty must return logged actions");
  const ctx = await buildStoryContext(pool, { cellId, rx: 50, ry: 50, z: 0 }, { playerId }, { tokenBudget: 4000 });
  assert.ok(ctx.party.recentActions.length >= 1, "StoryContext must include party recentActions");
  assert.ok(ctx.party.standing.length >= 1, "StoryContext must include party standing");
  const rendered = renderStoryContext(ctx);
  assert.ok(rendered.includes("Action (tick"), "Rendered StoryContext missing action line");
  assert.ok(rendered.includes("Standing ["), "Rendered StoryContext missing standing line");
  await pool.query("ROLLBACK TO SAVEPOINT branch_violent");
  console.log("3. buildStoryContext & renderStoryContext incorporate actions and standing... PASSED");

  // 4. "What-if" Previews: deterministic diffs & zero database mutations
  const startTick = Number((await pool.query(`SELECT COALESCE(MAX(tick), 0)::int AS t FROM sim_calendar`)).rows[0].t);
  const baseCit = Number((await pool.query(`SELECT COALESCE(MAX(citizen_id), 0)::int AS m FROM population_demographics`)).rows[0].m);
  const baseAg = Number((await pool.query(`SELECT COALESCE(MAX(id), 0)::int AS m FROM sim_agents`)).rows[0].m);
  const fpBefore = await worldFingerprint(startTick, baseCit, baseAg);

  const previewRes = await previewStoryOptions({
    days: 2,
    resolutionOptions: [
      { label: "Diplomatic", action: "resolve_diplomatic", storylineId: fixture.id, partyRef },
      { label: "Violent", action: "resolve_violent", storylineId: fixture.id, partyRef },
      { label: "Baseline", action: "do_nothing" },
      { label: "Extra4thShouldBeCapped", action: "do_nothing" },
    ],
  });

  assert.equal(previewRes.days, 2);
  assert.equal(previewRes.options.length, MAX_PREVIEW_OPTIONS, "Options must be capped at MAX_PREVIEW_OPTIONS (3)");
  const optDip = previewRes.options[0]!;
  const optVio = previewRes.options[1]!;
  assert.notEqual(optDip.fingerprintHash, optVio.fingerprintHash, "Diplomatic vs Violent preview hashes must differ");

  const fpAfter = await worldFingerprint(startTick, baseCit, baseAg);
  assert.deepEqual(fpAfter, fpBefore, "previewStoryOptions must not leave any persisted database mutation");
  const stStillOpen = await pool.query(`SELECT state FROM storylines WHERE id = $1`, [fixture.id]);
  assert.equal(stStillOpen.rows[0]?.state, "open", "Fixture storyline state must remain untouched after preview");
  console.log(`4. Preview engine simulated ${previewRes.options.length} capped options over ${previewRes.days}d with zero DB leakage... PASSED`);

  console.log("\nALL PHASE 11 ACTIONS, STANDING, CONSEQUENCES & PREVIEW TESTS PASSED");
}

isolateTest()
  .then((done) => main().then(done, async (e: unknown) => { await done(); throw e; }))
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("ACTIONS & STANDING TEST FAILED - COMMIT BLOCKED:", err.message || err);
    process.exit(1);
  });
