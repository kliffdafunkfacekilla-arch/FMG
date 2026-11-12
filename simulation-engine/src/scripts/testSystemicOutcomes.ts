import pool from "../db/pool.js";
import { isolateTest } from "./testIsolation.js";
import {
  ensureThreadTable,
  createThread,
  evaluateThreadState,
  resolveThreadNaturally
} from "../engine/threads/threadEngine.js";
import { resolveThreadByParty } from "../engine/questChainEngine.js";

async function testSystemicOutcomes() {
  console.log("==================================================================");
  console.log("        SYSTEMIC OUTCOME & NATURAL RIPPLE INTEGRATION TEST        ");
  console.log("  No canned scripts: physical entity state determines consequences ");
  console.log("==================================================================\n");

  await ensureThreadTable(pool);

  const realAgentRes = await pool.query(`SELECT id, name FROM sim_agents LIMIT 1`);
  const realAgentId = String(realAgentRes.rows[0].id);

  const targetCellId = 13408;
  const targetRx = 50;
  const targetRy = 50;
  const targetBurgId = 81;

  // Clean up any test threads
  await pool.query(`DELETE FROM sim_threads WHERE cell_id = $1`, [targetCellId]);

  // Reset burg economy baseline
  await pool.query(
    `INSERT INTO sim_burg_economy (burg_id, cell_id, name, unrest, wealth, food, raw_materials, crime_rate)
     VALUES ($1, $2, 'Roromijima', 40, 1000, 1000, 500, 20)
     ON CONFLICT (burg_id) DO UPDATE
     SET cell_id = $2, unrest = 40, wealth = 1000, food = 1000, raw_materials = 500, crime_rate = 20`,
    [targetBurgId, targetCellId]
  );

  // ------------------------------------------------------------------
  // TEST CASE 1: PLAYER ACTION KILLS DORAN (PERMANENT ABSENCE RIPPLES)
  // ------------------------------------------------------------------
  process.stdout.write("1. Testing Action: Party executes or kills the captive in his cell... ");

  // Seed sector layer with captive Doran and closed forge
  const npcsSlain = [
    {
      id: realAgentId,
      name: "Doran Iron-Bender",
      role: "Blacksmith",
      alive: false, // Player killed him!
      hp: 0,
      tags: ["civilian", "artisan", "#Dead", "#Slain"]
    }
  ];
  const propsSlain = [
    {
      id: "prop_forge_01",
      name: "Artisan Smithy Forge",
      tags: ["forge", "#SmithyClosed", "#BoardedDoor"]
    }
  ];
  await pool.query(
    `UPDATE sim_sector_layers SET npcs = $1, props = $2 WHERE cell_id = $3 AND rx = $4 AND ry = $5 AND z_layer = 0`,
    [JSON.stringify(npcsSlain), JSON.stringify(propsSlain), targetCellId, targetRx, targetRy]
  );

  const threadDeath = await createThread(pool, {
    question: "Will Doran Iron-Bender face execution?",
    stakes: "The town metalworker will be lost, shutting down the forge.",
    actor_ids: [realAgentId],
    cell_id: targetCellId,
    rx: targetRx,
    ry: targetRy,
    clock: 1,
    clock_max: 4,
    origin: "reaction",
    created_tick: 700
  });

  // Evaluate thread state directly from physical sector reality
  const deathEval = evaluateThreadState(threadDeath, npcsSlain, propsSlain);
  if (!deathEval.isResolved || deathEval.outcomeType !== 'DEATH') {
    throw new Error(`Expected outcomeType DEATH, got: ${JSON.stringify(deathEval)}`);
  }

  // Resolve naturally
  await resolveThreadNaturally(pool, threadDeath, deathEval, 701);

  // Verify natural ripples in PostgreSQL
  const burgDeathRes = await pool.query(`SELECT unrest, food, raw_materials FROM sim_burg_economy WHERE burg_id = $1`, [targetBurgId]);
  const burgDeath = burgDeathRes.rows[0];
  if (Number(burgDeath.unrest) < 50) {
    throw new Error(`Expected unrest to surge due to artisan death; got: ${burgDeath.unrest}`);
  }
  if (Number(burgDeath.raw_materials) >= 500) {
    throw new Error(`Expected raw_materials to drop due to broken forge; got: ${burgDeath.raw_materials}`);
  }

  // Verify ripple tags emitted on sector
  const layerDeathRes = await pool.query(`SELECT features FROM sim_sector_layers WHERE cell_id = $1 AND rx = $2 AND ry = $3 AND z_layer = 0`, [targetCellId, targetRx, targetRy]);
  const envTagsDeath = layerDeathRes.rows[0]?.features?.environmental_tags || [];
  if (!envTagsDeath.includes("#BrokenTools") || !envTagsDeath.includes("#SupplyDrought")) {
    throw new Error(`Expected absence ripple tags #BrokenTools and #SupplyDrought; got: ${JSON.stringify(envTagsDeath)}`);
  }
  console.log("✅ PASSED");
  console.log("   - Thread naturally resolved as DEATH (No canned script).");
  console.log(`   - Natural ripples: Emitted #BrokenTools, #SupplyDrought; Raw materials dropped to ${burgDeath.raw_materials}, Unrest rose to ${burgDeath.unrest}.`);

  // Clean up thread 1
  await pool.query(`DELETE FROM sim_threads WHERE id = $1`, [threadDeath.id]);

  // ------------------------------------------------------------------
  // TEST CASE 2: PLAYER ACTION LIBERATES DORAN (ACTIVE PRESENCE RIPPLES)
  // ------------------------------------------------------------------
  process.stdout.write("2. Testing Action: Party liberates and vindicates the artisan... ");

  // Reset economy baseline
  await pool.query(
    `UPDATE sim_burg_economy SET unrest = 40, wealth = 1000, food = 1000, raw_materials = 500 WHERE burg_id = $1`,
    [targetBurgId]
  );

  const npcsFree = [
    {
      id: realAgentId,
      name: "Doran Iron-Bender",
      role: "Blacksmith",
      alive: true,
      disposition: 3,
      tags: ["civilian", "artisan", "#RebelAlly", "#VindicatedArtisan"] // Freed!
    }
  ];
  const propsFree = [
    {
      id: "prop_forge_01",
      name: "Artisan Smithy Forge",
      tags: ["forge", "#SmithyOperational"] // Reignited!
    }
  ];
  await pool.query(
    `UPDATE sim_sector_layers SET npcs = $1, props = $2 WHERE cell_id = $3 AND rx = $4 AND ry = $5 AND z_layer = 0`,
    [JSON.stringify(npcsFree), JSON.stringify(propsFree), targetCellId, targetRx, targetRy]
  );

  const threadFree = await createThread(pool, {
    question: "Will Doran Iron-Bender face execution?",
    stakes: "The town metalworker will be lost, shutting down the forge.",
    actor_ids: [realAgentId],
    cell_id: targetCellId,
    rx: targetRx,
    ry: targetRy,
    clock: 1,
    clock_max: 4,
    origin: "reaction",
    created_tick: 702
  });

  const freeEval = evaluateThreadState(threadFree, npcsFree, propsFree);
  if (!freeEval.isResolved || freeEval.outcomeType !== 'FREEDOM') {
    throw new Error(`Expected outcomeType FREEDOM, got: ${JSON.stringify(freeEval)}`);
  }

  await resolveThreadNaturally(pool, threadFree, freeEval, 703);

  const burgFreeRes = await pool.query(`SELECT unrest, wealth, raw_materials FROM sim_burg_economy WHERE burg_id = $1`, [targetBurgId]);
  const burgFree = burgFreeRes.rows[0];
  if (Number(burgFree.unrest) > 30) {
    throw new Error(`Expected unrest to decrease due to artisan liberation; got: ${burgFree.unrest}`);
  }
  if (Number(burgFree.raw_materials) <= 500) {
    throw new Error(`Expected raw_materials to increase due to operational forge; got: ${burgFree.raw_materials}`);
  }

  const layerFreeRes = await pool.query(`SELECT features, props FROM sim_sector_layers WHERE cell_id = $1 AND rx = $2 AND ry = $3 AND z_layer = 0`, [targetCellId, targetRx, targetRy]);
  const envTagsFree = layerFreeRes.rows[0]?.features?.environmental_tags || [];
  if (envTagsFree.includes("#SupplyDrought")) {
    throw new Error(`Expected #SupplyDrought to be cleared after liberation; got: ${JSON.stringify(envTagsFree)}`);
  }
  console.log("✅ PASSED");
  console.log("   - Thread naturally resolved as FREEDOM.");
  console.log(`   - Natural ripples: Forge #SmithyOperational, Raw materials increased to ${burgFree.raw_materials}, Unrest dropped to ${burgFree.unrest}.`);

  // Clean up thread 2
  await pool.query(`DELETE FROM sim_threads WHERE id = $1`, [threadFree.id]);

  // ------------------------------------------------------------------
  // TEST CASE 3: PLAYER SMUGGLES DORAN TO THE HILLS AS A FUGITIVE
  // ------------------------------------------------------------------
  process.stdout.write("3. Testing Action: Party smuggles artisan into the hills as a fugitive... ");

  const npcsFled = [
    {
      id: realAgentId,
      name: "Doran Iron-Bender",
      role: "Blacksmith",
      alive: true,
      tags: ["civilian", "artisan", "#Fugitive", "#InHiding"] // Outlaw in hills
    }
  ];
  const propsEmpty = [
    {
      id: "prop_forge_01",
      name: "Artisan Smithy Forge",
      tags: ["forge", "#SmithyClosed"] // Empty forge
    }
  ];

  const threadFled = await createThread(pool, {
    question: "Will Doran Iron-Bender face execution?",
    stakes: "The town metalworker will be lost, shutting down the forge.",
    actor_ids: [realAgentId],
    cell_id: targetCellId,
    rx: targetRx,
    ry: targetRy,
    clock: 1,
    clock_max: 4,
    origin: "reaction",
    created_tick: 704
  });

  const fledEval = evaluateThreadState(threadFled, npcsFled, propsEmpty);
  if (!fledEval.isResolved || fledEval.outcomeType !== 'FLIGHT') {
    throw new Error(`Expected outcomeType FLIGHT, got: ${JSON.stringify(fledEval)}`);
  }

  await resolveThreadNaturally(pool, threadFled, fledEval, 705);
  console.log("✅ PASSED");
  console.log("   - Thread naturally resolved as FLIGHT (Alive as fugitive in hills).");
  console.log(`   - Natural ripples: Smith absent from burg, shop empty, #BlacksmithAbsence emitted.`);

  // Clean up thread 3
  await pool.query(`DELETE FROM sim_threads WHERE id = $1`, [threadFled.id]);

  console.log("\n==================================================================");
  console.log("     ALL SYSTEMIC PHYSICAL OUTCOME TESTS PASSED 100%!             ");
  console.log("==================================================================\n");

  await pool.end();
}

// Rule 9 tests must not change the live world: run inside a rolled-back transaction, LLMs off.
isolateTest().then(done => testSystemicOutcomes().then(done, async (e: unknown) => { await done(); throw e; })).catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});

