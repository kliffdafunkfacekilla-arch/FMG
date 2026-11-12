import pool from "../db/pool.js";
import { isolateTest, ensureFixtureLayer } from "./testIsolation.js";
import {
  ensureThreadTable,
  createThread
} from "../engine/threads/threadEngine.js";
import { resolveThreadByParty } from "../engine/questChainEngine.js";

async function testQuestChainResolution() {
  console.log("================================================================");
  console.log("       STORY_AUDIT STEP 5: QUEST CHAIN & PARTY RESOLUTION       ");
  console.log("  Party action resolves thread, applying on_resolved_by_party   ");
  console.log("================================================================\n");

  await ensureThreadTable(pool);

  // 1. Fetch real agent and sector layer from DB
  const realAgentRes = await pool.query(`SELECT id, name FROM sim_agents LIMIT 1`);
  const realAgent = realAgentRes.rows[0];
  if (!realAgent) throw new Error("No real agent found for test!");
  const realAgentId = String(realAgent.id);

  await ensureFixtureLayer(13408, 50, 50);
  const layerRowRes = await pool.query(`SELECT cell_id, rx, ry, npcs, props FROM sim_sector_layers WHERE cell_id = 13408 AND rx = 50 AND ry = 50 AND z_layer = 0`);
  if (layerRowRes.rows.length === 0) throw new Error("No sector layer found in sim_sector_layers!");
  const targetCellId = Number(layerRowRes.rows[0].cell_id);
  const targetRx = Number(layerRowRes.rows[0].rx);
  const targetRy = Number(layerRowRes.rows[0].ry);

  // Link or fetch burg for targetCellId
  let burgRes = await pool.query(
    `SELECT burg_id, cell_id, unrest, wealth, raw_materials FROM sim_burg_economy WHERE cell_id = $1 LIMIT 1`,
    [targetCellId]
  );
  if (burgRes.rows.length === 0) {
    const anyBurg = await pool.query(`SELECT burg_id FROM sim_burg_economy LIMIT 1`);
    await pool.query(`UPDATE sim_burg_economy SET cell_id = $1 WHERE burg_id = $2`, [targetCellId, anyBurg.rows[0].burg_id]);
    burgRes = await pool.query(`SELECT burg_id, cell_id, unrest, wealth, raw_materials FROM sim_burg_economy WHERE burg_id = $1`, [anyBurg.rows[0].burg_id]);
  }
  const realBurg = burgRes.rows[0];
  const targetBurgId = Number(realBurg.burg_id);
  const initialUnrest = Number(realBurg.unrest);
  const initialWealth = Number(realBurg.wealth);
  const initialRawMaterials = Number(realBurg.raw_materials || 0);

  // Seed actor into sector layer with captive tags
  let npcs = Array.isArray(layerRowRes.rows[0].npcs) ? layerRowRes.rows[0].npcs : [];
  npcs = npcs.filter((n: any) => String(n.id) !== realAgentId);
  npcs.push({
    id: realAgentId,
    name: realAgent.name,
    role: "Blacksmith",
    disposition: 0,
    tags: ["civilian", "#InCustody", "#Imprisoned"]
  });

  // Seed forge prop with closed tags
  let props = Array.isArray(layerRowRes.rows[0].props) ? layerRowRes.rows[0].props : [];
  props = props.filter((p: any) => !p.name?.toLowerCase().includes("forge"));
  props.push({
    id: "prop_smithy_forge_test",
    name: "Heavy Iron Forge",
    tags: ["forge", "#SmithyClosed", "#BoardedDoor"]
  });

  await pool.query(
    `UPDATE sim_sector_layers SET npcs = $1, props = $2 WHERE cell_id = $3 AND rx = $4 AND ry = $5 AND z_layer = 0`,
    [JSON.stringify(npcs), JSON.stringify(props), targetCellId, targetRx, targetRy]
  );

  // 2. Create active thread with explicit on_resolved_by_party delta
  process.stdout.write("1. Creating active narrative thread with on_resolved_by_party... ");
  const activeThread = await createThread(pool, {
    question: "Will the crackdown on the artisan ignite open riots against the garrison?",
    stakes: "The artisan will face execution and the forge will be demolished unless intervened.",
    actor_ids: [realAgentId],
    cell_id: targetCellId,
    rx: targetRx,
    ry: targetRy,
    clock: 1,
    clock_max: 4,
    origin: "reaction",
    created_tick: 504,
    rule_id: "sedition_garrison_raid",
    on_expire: {
      unrestDelta: 25,
      wealthDelta: -300,
      narrativeSummary: "Artisan executed by garrison."
    },
    on_resolved_by_party: {
      unrestDelta: -15,
      wealthDelta: 150,
      rawMaterialsDelta: 100,
      actorTagsAdd: ["#RebelAlly", "#VindicatedArtisan"],
      actorTagsRemove: ["#InCustody", "#Imprisoned"],
      actorDispositionDelta: 3,
      propTagsAdd: ["#SmithyOperational"],
      propTagsRemove: ["#SmithyClosed", "#BoardedDoor"],
      propNameMatch: "forge",
      narrativeSummary: "Party uncovered exonerating ledgers, liberating the artisan and reigniting the forge!"
    }
  });
  console.log(`✅ PASSED (Thread #${activeThread.id})`);

  // 3. Resolve thread via questChainEngine
  process.stdout.write("2. Resolving thread via questChainEngine.resolveThreadByParty... ");
  const resolutionResult = await resolveThreadByParty(pool, {
    threadId: activeThread.id,
    playerOutcome: "SUCCESS",
    resolutionNarrative: "The party dismantled the garrison extortions, freeing the artisan and securing local trade.",
    currentTick: 505
  });
  console.log(`✅ PASSED`);

  // 4. Verify thread state in sim_threads
  process.stdout.write("3. Verifying sim_threads state transition to 'resolved'... ");
  const threadCheck = await pool.query(`SELECT state, resolved_tick, resolution FROM sim_threads WHERE id = $1`, [activeThread.id]);
  const resolvedRow = threadCheck.rows[0];
  if (resolvedRow.state !== "resolved" || resolvedRow.resolved_tick !== 505) {
    throw new Error(`Expected state=resolved, resolved_tick=505; got: ${JSON.stringify(resolvedRow)}`);
  }
  console.log("✅ PASSED (state: resolved, resolved_tick: 505)");

  // 5. Verify economy world deltas in sim_burg_economy
  process.stdout.write("4. Verifying real world economy mutation (unrest -15, wealth +150, raw_materials +100)... ");
  const burgAfterRes = await pool.query(`SELECT unrest, wealth, raw_materials FROM sim_burg_economy WHERE burg_id = $1`, [targetBurgId]);
  const burgAfter = burgAfterRes.rows[0];
  const actualUnrestDelta = Number(burgAfter.unrest) - initialUnrest;
  const actualWealthDelta = Number(burgAfter.wealth) - initialWealth;
  const actualRawMaterialsDelta = Number(burgAfter.raw_materials || 0) - initialRawMaterials;

  if (actualUnrestDelta !== -15 && !(initialUnrest < 15 && Number(burgAfter.unrest) === 0)) {
    throw new Error(`Expected unrest delta of -15; actual delta: ${actualUnrestDelta}`);
  }
  if (actualWealthDelta !== 150) {
    throw new Error(`Expected wealth delta of +150; actual delta: ${actualWealthDelta}`);
  }
  if (actualRawMaterialsDelta !== 100) {
    throw new Error(`Expected raw_materials delta of +100; actual delta: ${actualRawMaterialsDelta}`);
  }
  console.log(`✅ PASSED (Unrest: ${actualUnrestDelta}, Wealth: +${actualWealthDelta}, Raw Materials: +${actualRawMaterialsDelta})`);

  // 6. Verify sector layer entity mutations
  process.stdout.write("5. Verifying sector entity consequence tags and disposition... ");
  const layerAfterRes = await pool.query(
    `SELECT npcs, props FROM sim_sector_layers WHERE cell_id = $1 AND rx = $2 AND ry = $3 AND z_layer = 0`,
    [targetCellId, targetRx, targetRy]
  );
  const afterNpcs = layerAfterRes.rows[0].npcs || [];
  const targetNpc = afterNpcs.find((n: any) => String(n.id) === realAgentId);
  if (!targetNpc) throw new Error("Target NPC not found after mutation!");

  if (!targetNpc.tags.includes("#RebelAlly") || !targetNpc.tags.includes("#VindicatedArtisan")) {
    throw new Error(`Target NPC missing added tags: ${JSON.stringify(targetNpc.tags)}`);
  }
  if (targetNpc.tags.includes("#InCustody") || targetNpc.tags.includes("#Imprisoned")) {
    throw new Error(`Target NPC still carries captive tags: ${JSON.stringify(targetNpc.tags)}`);
  }
  if (targetNpc.disposition !== 3) {
    throw new Error(`Expected disposition=3, got: ${targetNpc.disposition}`);
  }

  const afterProps = layerAfterRes.rows[0].props || [];
  const forgeProp = afterProps.find((p: any) => p.name?.toLowerCase().includes("forge"));
  if (!forgeProp?.tags.includes("#SmithyOperational") || forgeProp?.tags.includes("#SmithyClosed")) {
    throw new Error(`Forge prop tags invalid: ${JSON.stringify(forgeProp?.tags)}`);
  }
  console.log("✅ PASSED (NPC freed & allied, Forge reignited & operational)");

  // 7. Verify sim_events chronicle record
  process.stdout.write("6. Verifying HEROIC INTERVENTION event in sim_events... ");
  const eventRes = await pool.query(
    `SELECT type, message, tier FROM sim_events WHERE type = 'PARTY_RESOLVED_THREAD' ORDER BY id DESC LIMIT 1`
  );
  if (!eventRes.rows[0] || !eventRes.rows[0].message.includes("HEROIC INTERVENTION")) {
    throw new Error(`Event not logged properly: ${JSON.stringify(eventRes.rows[0])}`);
  }
  console.log("✅ PASSED (sim_events contains HEROIC INTERVENTION)");

  // Clean up test thread
  await pool.query(`DELETE FROM sim_threads WHERE id = $1`, [activeThread.id]);

  console.log("\n================================================================");
  console.log("       ALL STORY_AUDIT STEP 5 TESTS PASSED 100%!                ");
  console.log("================================================================\n");

  await pool.end();
}

// Rule 9 tests must not change the live world: run inside a rolled-back transaction, LLMs off.
isolateTest().then(done => testQuestChainResolution().then(done, async (e: unknown) => { await done(); throw e; })).catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});

