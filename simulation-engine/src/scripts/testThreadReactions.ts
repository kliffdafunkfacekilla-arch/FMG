import pool from "../db/pool.js";
import { isolateTest } from "./testIsolation.js";
import { evaluateSectorReactions, SectorContext } from "../engine/rpg/narrativeReactionEngine.js";
import { Entity } from "../engine/rpg/narrativeTagEngine.js";
import { ensureThreadTable, getOpenThreads, createThread } from "../engine/threads/threadEngine.js";

async function testThreadReactions() {
  console.log("================================================================");
  console.log("       STORY_AUDIT STEP 2: REACTION RULES & STABLE ECONOMY       ");
  console.log("   Open threads only on reaction rules; stable economy = 0      ");
  console.log("================================================================\n");

  await ensureThreadTable(pool);
  // Clear test threads
  await pool.query(`DELETE FROM sim_threads WHERE origin = 'reaction'`);

  // -------------------------------------------------------------
  // TEST 1: STABLE ECONOMY PRODUCES ZERO THREADS
  // -------------------------------------------------------------
  process.stdout.write("1. Testing stable economy (unrest 0, food 5000, ordinary citizens)... ");
  
  const stableEntities: Entity[] = [
    {
      id: "citizen_01",
      name: "Taran the Miller",
      type: "NPC",
      role: "Miller",
      tags: ["civilian", "miller", "peaceful"],
      coords: { x: 10, y: 10 }
    },
    {
      id: "prop_grain_mill",
      name: "Windmill Wheel",
      type: "PROP",
      tags: ["mill", "wood", "operational"],
      coords: { x: 12, y: 12 }
    }
  ];

  const stableContext: SectorContext = {
    cellId: 13408,
    burgId: 81,
    burgName: "Roromijima",
    unrest: 0,
    food: 5000,
    wealth: 2000,
    tick: 100,
    rx: 50,
    ry: 50
  };

  const stableGlobalTags: string[] = ["#StableEconomy"];

  const stableResult = evaluateSectorReactions(stableEntities, stableGlobalTags, stableContext);

  if (stableResult.rulesTriggered.length > 0) {
    throw new Error(`Stable economy triggered unexpected rules: ${stableResult.rulesTriggered.join(", ")}`);
  }
  if (stableResult.threadsToOpen.length > 0) {
    throw new Error(`Stable economy produced ${stableResult.threadsToOpen.length} threads! Expected 0.`);
  }
  console.log("✅ PASSED (0 reaction rules fired, 0 threads created)");

  // -------------------------------------------------------------
  // TEST 2: REACTION RULE FIRES AND FORMULATES THREAD
  // -------------------------------------------------------------
  process.stdout.write("2. Testing collision trigger (#RebelInformant under #MartialLaw)... ");

  // Fetch real agent from DB to use as valid actor_id
  const realAgentRes = await pool.query(`SELECT id, name FROM sim_agents LIMIT 1`);
  const realAgentId = String(realAgentRes.rows[0]?.id || "real_agent_1");

  const seditiousEntities: Entity[] = [
    {
      id: realAgentId,
      name: "Doran Iron-Bender",
      type: "NPC",
      role: "Blacksmith",
      tags: ["artisan", "#RebelInformant", "craftsman"],
      coords: { x: 20, y: 20 }
    },
    {
      id: "prop_forge_01",
      name: "Artisan Smithy Forge",
      type: "PROP",
      tags: ["forge", "anvil", "workstation"],
      coords: { x: 22, y: 22 }
    }
  ];

  const martialLawContext: SectorContext = {
    cellId: 13408,
    burgId: 81,
    burgName: "Roromijima",
    unrest: 45, // Martial law unrest threshold
    food: 800,  // Resource scarcity
    wealth: 500,
    tick: 101,
    rx: 50,
    ry: 50
  };

  const martialLawTags: string[] = ["#MartialLaw", "#ResourceScarcity"];

  const reactionResult = evaluateSectorReactions(seditiousEntities, martialLawTags, martialLawContext);

  if (!reactionResult.rulesTriggered.includes("sedition_garrison_raid")) {
    throw new Error(`Expected 'sedition_garrison_raid' to trigger! Got: ${reactionResult.rulesTriggered.join(", ")}`);
  }
  if (reactionResult.threadsToOpen.length !== 1 || !reactionResult.threadsToOpen[0]) {
    throw new Error(`Expected exactly 1 thread to open, got ${reactionResult.threadsToOpen.length}`);
  }

  const threadCand = reactionResult.threadsToOpen[0];
  if (!threadCand.question.includes("ignite an open riot")) {
    throw new Error(`Unexpected question formulation: ${threadCand.question}`);
  }
  if (!threadCand.actor_ids.includes(realAgentId)) {
    throw new Error(`Thread candidate missing actor ID ${realAgentId}: ${threadCand.actor_ids.join(", ")}`);
  }
  console.log(`✅ PASSED (Rule fired: 'sedition_garrison_raid', formulated thread: "${threadCand.question}")`);

  // -------------------------------------------------------------
  // TEST 3: THREAD PERSISTED TO SIM_THREADS WITH REAL ACTOR ID
  // -------------------------------------------------------------
  process.stdout.write("3. Testing thread persistence in PostgreSQL sim_threads... ");
  const persistedThread = await createThread(pool, {
    question: threadCand.question,
    stakes: threadCand.stakes,
    actor_ids: threadCand.actor_ids,
    cell_id: threadCand.cell_id,
    rx: threadCand.rx,
    ry: threadCand.ry,
    clock_max: threadCand.clock_max,
    origin: threadCand.origin,
    created_tick: 101
  });

  if (!persistedThread.id || persistedThread.state !== "open" || persistedThread.clock !== 0) {
    throw new Error(`Thread failed to persist properly: ${JSON.stringify(persistedThread)}`);
  }

  const openInCell = await getOpenThreads(pool, 13408);
  if (!openInCell.some(t => t.id === persistedThread.id)) {
    throw new Error(`Persisted thread ID ${persistedThread.id} not found in getOpenThreads!`);
  }
  console.log(`✅ PASSED (Thread #${persistedThread.id} open in cell 13408)`);

  // Clean up
  await pool.query(`DELETE FROM sim_threads WHERE id = $1`, [persistedThread.id]);

  console.log("\n================================================================");
  console.log("       ALL STORY_AUDIT STEP 2 REACTION TESTS PASSED!            ");
  console.log("================================================================\n");

  await pool.end();
}

// Rule 9 tests must not change the live world: run inside a rolled-back transaction, LLMs off.
isolateTest().then(done => testThreadReactions().then(done, async (e: unknown) => { await done(); throw e; })).catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
