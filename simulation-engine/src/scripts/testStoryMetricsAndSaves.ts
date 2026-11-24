/**
 * Story health metrics (Phase 13.1), Rule-7 rejection logging, and external save/branch
 * verification (Phase 13.2) test.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Client } from "pg";
import pool from "../db/pool.js";
import { isolateTest } from "./testIsolation.js";
import { migrate } from "../db/migrate.js";
import { ensureEntity } from "../engine/entities/registry.js";
import { flushStepDeltas } from "../engine/deltas/index.js";
import { recordAction } from "../engine/story/actions.js";
import { computeStoryHealthMetrics } from "../engine/story/metrics.js";
import { createStoryline, decideProposal } from "../engine/story/storylines.js";

async function runMetricsTest(): Promise<void> {
  const done = await isolateTest();
  try {
    await migrate(pool);

    const tickRes = await pool.query(`SELECT COALESCE(MAX(tick), 1)::int AS t FROM sim_calendar`);
    const tick = Number(tickRes.rows[0]?.t || 1);

    const burgRes = await pool.query(
      `SELECT b.burg_id, b.cell_id
       FROM sim_burg_economy b
       ORDER BY (
         SELECT COUNT(*) FROM storylines s
         WHERE (s.cell_id = b.cell_id OR b.cell_id = ANY(s.scope_cells))
           AND s.state IN ('open', 'escalated', 'proposed')
       ) ASC, b.burg_id ASC
       LIMIT 1`
    );
    assert.ok(burgRes.rows.length > 0, "Expected at least one burg in DB");
    const testBurgId = Number(burgRes.rows[0].burg_id);
    const testCellId = Number(burgRes.rows[0].cell_id);
    await pool.query(`DELETE FROM storylines WHERE cell_id = $1`, [testCellId]);

    const actorsRes = await pool.query(
      `SELECT e.ref
       FROM entities e
       WHERE e.kind = 'person'
         AND e.alive = true
         AND e.ref LIKE 'paragon:%'
         AND NOT EXISTS (
           SELECT 1
           FROM storylines s
           JOIN storyline_actors sa ON sa.storyline_id = s.id
           WHERE sa.entity_ref = e.ref
             AND s.state = 'rejected'
             AND s.cooldown_until_tick IS NOT NULL
             AND s.cooldown_until_tick > $1
         )
       ORDER BY e.id ASC
       LIMIT 3`,
      [tick + 2]
    );
    assert.ok(actorsRes.rows.length >= 3, "Expected at least 3 living paragon entities not on cooldown");
    const [p1, p2, p3] = actorsRes.rows.map((r: any) => String(r.ref));

    const placeRef = `burg:${testBurgId}`;
    await ensureEntity(pool, placeRef, { name: `Burg #${testBurgId}`, kind: "place", lod: "macro", cellId: testCellId, createdTick: tick });

    const playerRes = await pool.query(`SELECT id, name FROM sim_player_character ORDER BY id ASC LIMIT 1`);
    const playerId = Number(playerRes.rows[0]?.id || 1);
    const partyRef = `player:${playerId}`;
    await ensureEntity(pool, partyRef, { name: String(playerRes.rows[0]?.name || "Adventurer"), kind: "person", lod: "micro", cellId: testCellId, createdTick: tick });

    const before = await computeStoryHealthMetrics(pool);

    // 1. Accepted Story Desk proposal
    const propAccept = await createStoryline(pool, {
      scale: "thread",
      scope_cells: [testCellId],
      cell_id: testCellId,
      rx: 50,
      ry: 50,
      question: "Will the excise collector reveal the sealed manifest?",
      stakes: "Unchecked levies risk a harbor strike.",
      actor_ids: [p1!],
      source: "drama",
      rule_id: "TEST_P13_ACCEPT",
      why: "Phase 13 metrics test (accept)",
      facts: [{ kind: "entity", id: p1!, summary: "Lead figure" }],
      createdTick: tick,
      state: "proposed",
    });
    assert.ok(propAccept, "Expected proposal 1 to be created");
    await decideProposal(pool, propAccept.id, { decision: "accept", tick });

    // 2. Rejected Story Desk proposal
    const propReject = await createStoryline(pool, {
      scale: "thread",
      scope_cells: [testCellId],
      cell_id: testCellId,
      rx: 50,
      ry: 50,
      question: "Should patrols seize the salt warehouse tonight?",
      stakes: "Merchants threaten to shut stalls.",
      actor_ids: [p2!],
      source: "drama",
      rule_id: "TEST_P13_REJECT",
      why: "Phase 13 metrics test (reject)",
      facts: [{ kind: "entity", id: p2!, summary: "Secondary actor" }],
      createdTick: tick,
      state: "proposed",
    });
    assert.ok(propReject, "Expected proposal 2 to be created");
    await decideProposal(pool, propReject.id, { decision: "reject", tick });

    // 3. Auto-opened thread with place + person actors, resolved by party action
    const stResolved = await createStoryline(pool, {
      scale: "thread",
      scope_cells: [testCellId],
      cell_id: testCellId,
      rx: 50,
      ry: 50,
      question: "Who sabotaged the canal floodgate?",
      stakes: "Lowlands flood before harvest.",
      actor_ids: [p1!, placeRef],
      source: "reaction",
      rule_id: "TEST_P13_AUTO_RESOLVED",
      why: "Phase 13 metrics test (auto-open & party resolution)",
      facts: [{ kind: "entity", id: placeRef, summary: "Burg locale" }],
      createdTick: tick,
      state: "open",
    });
    assert.ok(stResolved, "Expected auto-opened thread 3 to be created");
    await recordAction(pool, {
      tick,
      minute: 60,
      actorRef: partyRef,
      verb: "persuade",
      targetRef: p1!,
      location: { cellId: testCellId, rx: 50, ry: 50, z: 0 },
      method: "charm",
      result: "success:margin=3",
      storylineId: stResolved.id,
      witnesses: [],
    });
    await pool.query(
      `UPDATE storylines SET state = 'resolved', resolved_tick = $1, resolution = '{"resolvedBy":"party"}'::jsonb WHERE id = $2`,
      [tick, stResolved.id]
    );

    // 4. Auto-opened thread that expires unanswered
    const stExpired = await createStoryline(pool, {
      scale: "thread",
      scope_cells: [testCellId],
      cell_id: testCellId,
      rx: 50,
      ry: 50,
      question: "Will the caravan guard hold the north road?",
      stakes: "Raiders cut supply wagons.",
      actor_ids: [p3!],
      source: "world",
      rule_id: "TEST_P13_AUTO_EXPIRED",
      why: "Phase 13 metrics test (auto-open & expire)",
      facts: [{ kind: "entity", id: p3!, summary: "Caravan captain" }],
      createdTick: tick,
      state: "open",
    });
    assert.ok(stExpired, "Expected auto-opened thread 4 to be created");
    await pool.query(`UPDATE storylines SET state = 'expired', resolved_tick = $1 WHERE id = $2`, [tick, stExpired.id]);

    // 5. Rule-7 rejections via delta validator and Storyline Guard
    const deltaRejectRes = await flushStepDeltas(pool, "test_p13_r7", tick, [
      { kind: "burg.adjust", burgId: 99999999, food: 5 },
    ]);
    assert.equal(deltaRejectRes.rejected.length, 1, "Expected invalid burgId delta to be rejected");

    await assert.rejects(
      () =>
        createStoryline(pool, {
          scale: "thread",
          scope_cells: [testCellId],
          cell_id: testCellId,
          rx: 50,
          ry: 50,
          question: "Will the phantom citizen speak?",
          stakes: "Phantom actor check.",
          actor_ids: ["citizen:999999999"],
          source: "drama",
          rule_id: "TEST_P13_R7_GUARD",
          why: "Rule-7 test",
          facts: [],
          createdTick: tick,
        }),
      /Rule 7/
    );

    const after = await computeStoryHealthMetrics(pool);
    assert.equal(after.byScale.thread.accepted - before.byScale.thread.accepted, 1, "Expected +1 accepted thread");
    assert.equal(after.byScale.thread.rejected - before.byScale.thread.rejected, 1, "Expected +1 rejected thread");
    assert.equal(after.byScale.thread.autoOpened - before.byScale.thread.autoOpened, 2, "Expected +2 auto-opened threads");
    assert.equal(after.outcomes.resolved - before.outcomes.resolved, 1, "Expected +1 resolved storyline");
    assert.equal(after.outcomes.expired - before.outcomes.expired, 1, "Expected +1 expired storyline");
    assert.ok(after.actorOriginShare.peopleCount - before.actorOriginShare.peopleCount >= 4, "Expected peopleCount increment");
    assert.ok(after.actorOriginShare.placesCount - before.actorOriginShare.placesCount >= 1, "Expected placesCount increment");
    assert.ok(after.rule7.rejectedCount - before.rule7.rejectedCount >= 2, "Expected >= 2 Rule-7 rejections logged");
    assert.ok(after.rule7.rejectionRate > 0, "Expected non-zero Rule-7 rejection rate");
    assert.ok(after.partyEngagement.engagedStorylines - before.partyEngagement.engagedStorylines >= 1, "Expected engaged storyline");
    assert.ok(after.partyEngagement.actionsLinkedToStoryline - before.partyEngagement.actionsLinkedToStoryline >= 1, "Expected linked action");

    console.log(
      `1. Story health metrics verified (accepted=${after.byScale.thread.accepted}, auto=${after.byScale.thread.autoOpened}, resolvedRatio=${after.outcomes.resolvedRatio}, rule7=${after.rule7.rejectedCount}/${after.rule7.totalChecked})... PASSED`
    );
  } finally {
    await done();
  }
}

async function runSaveAndBranchTest(): Promise<void> {
  const simRoot = path.resolve(__dirname, "../..");
  const repoRoot = path.resolve(simRoot, "..");
  const connStr = process.env.DATABASE_URL || "postgres://postgres@localhost:5432/postgres";
  const branchName = "ostraka_test_branch_p13";
  const branchUrlObj = new URL(connStr);
  branchUrlObj.pathname = `/${branchName}`;
  const branchUrl = branchUrlObj.toString();

  const tempSavesDir = fs.mkdtempSync(path.join(os.tmpdir(), "ostraka-p13-saves-"));
  const resolvedSaves = path.resolve(tempSavesDir);
  assert.ok(
    resolvedSaves !== repoRoot && !resolvedSaves.startsWith(repoRoot + path.sep),
    `Expected external save directory outside ${repoRoot}, got ${resolvedSaves}`
  );

  const env = { ...process.env, OSTRAKA_SAVES_DIR: tempSavesDir };
  let primaryClient: Client | null = null;
  let branchClient: Client | null = null;

  try {
    const saveRes = spawnSync("node", ["scripts/saveWorld.cjs", "phase13_verify"], {
      cwd: simRoot,
      env,
      encoding: "utf8",
    });
    assert.equal(saveRes.status, 0, `saveWorld.cjs failed: ${saveRes.stderr || saveRes.stdout}`);

    const dumpPath = path.join(tempSavesDir, "phase13_verify.dump");
    const metaPath = path.join(tempSavesDir, "phase13_verify.meta.json");
    assert.ok(fs.existsSync(dumpPath), "Expected phase13_verify.dump to exist");
    assert.ok(fs.existsSync(metaPath), "Expected phase13_verify.meta.json to exist");

    const hdrBuf = Buffer.alloc(5);
    const fd = fs.openSync(dumpPath, "r");
    try {
      fs.readSync(fd, hdrBuf, 0, 5, 0);
    } finally {
      fs.closeSync(fd);
    }
    assert.equal(hdrBuf.toString("ascii"), "PGDMP", "Expected PostgreSQL custom dump (PGDMP) header");

    const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
    primaryClient = new Client({ connectionString: connStr });
    await primaryClient.connect();
    const liveCal = await primaryClient.query(`SELECT COALESCE(MAX(tick), 0)::int AS tick FROM sim_calendar`);
    const liveClk = await primaryClient.query(`SELECT tick, mode FROM world_clock WHERE id = 1 LIMIT 1`);
    const liveVer = await primaryClient.query(`SELECT COALESCE(MAX(version), 0)::int AS v FROM schema_version`);
    const liveStories = await primaryClient.query(`SELECT COUNT(*)::int AS c FROM storylines`);

    assert.equal(Number(meta.calendarTick), Number(liveCal.rows[0].tick));
    assert.equal(Number(meta.schemaVersion), Number(liveVer.rows[0].v));

    const listRes = spawnSync("node", ["scripts/saveWorld.cjs", "--list"], {
      cwd: simRoot,
      env,
      encoding: "utf8",
    });
    assert.equal(listRes.status, 0, `saveWorld.cjs --list failed: ${listRes.stderr}`);
    const listJson = JSON.parse(listRes.stdout);
    assert.ok(listJson.saves.some((s: any) => s.name === "phase13_verify"), "Expected save in --list output");

    const branchRes = spawnSync("node", ["scripts/branchWorld.cjs", "phase13_verify", branchName, "--force"], {
      cwd: simRoot,
      env,
      encoding: "utf8",
    });
    assert.equal(branchRes.status, 0, `branchWorld.cjs restore failed: ${branchRes.stderr || branchRes.stdout}`);

    branchClient = new Client({ connectionString: branchUrl });
    await branchClient.connect();
    const brCal = await branchClient.query(`SELECT COALESCE(MAX(tick), 0)::int AS tick FROM sim_calendar`);
    const brClk = await branchClient.query(`SELECT tick, mode FROM world_clock WHERE id = 1 LIMIT 1`);
    const brStories = await branchClient.query(`SELECT COUNT(*)::int AS c FROM storylines`);

    assert.equal(Number(brCal.rows[0].tick), Number(liveCal.rows[0].tick), "Branch sim_calendar tick mismatch");
    assert.equal(Number(brClk.rows[0].tick), Number(liveClk.rows[0].tick), "Branch world_clock tick mismatch");
    assert.equal(String(brClk.rows[0].mode), String(liveClk.rows[0].mode), "Branch world_clock mode mismatch");
    assert.equal(Number(brStories.rows[0].c), Number(liveStories.rows[0].c), "Branch storylines count mismatch");

    console.log(
      `2. External custom-format save & branch DB restore verified (outsideRepo=true, tick=${brCal.rows[0].tick}, size=${(fs.statSync(dumpPath).size / (1024 * 1024)).toFixed(2)} MB)... PASSED`
    );
  } finally {
    if (branchClient) await branchClient.end().catch(() => {});
    spawnSync("node", ["scripts/branchWorld.cjs", "--drop", branchName], {
      cwd: simRoot,
      env,
      encoding: "utf8",
    });
    if (primaryClient) {
      const dbCheck = await primaryClient
        .query(`SELECT 1 FROM pg_database WHERE datname = $1`, [branchName])
        .catch(() => ({ rows: [] }));
      assert.equal(dbCheck.rows.length, 0, "Expected temporary branch database to be dropped");
      await primaryClient.end().catch(() => {});
    }
    fs.rmSync(tempSavesDir, { recursive: true, force: true });
  }
}

async function main() {
  console.log("=== Testing Story Health Metrics & External Save/Branch (Phase 13.1-13.2) ===");
  await runMetricsTest();
  await runSaveAndBranchTest();
  console.log("\nALL STORY METRICS & SAVE/BRANCH TESTS PASSED");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("STORY METRICS & SAVE/BRANCH TEST FAILED - COMMIT BLOCKED:", err?.message || err);
    process.exit(1);
  });
