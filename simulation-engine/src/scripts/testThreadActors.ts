import pool from "../db/pool.js";
import {
  ensureThreadTable,
  createThread,
  validateActorIds,
  getOpenThreads
} from "../engine/threads/threadEngine.js";

async function testThreadActors() {
  console.log("================================================================");
  console.log("       STORY_AUDIT STEP 1: SIM_THREADS & ACTOR_ID TEST          ");
  console.log("================================================================\n");

  // 1. Ensure table exists
  process.stdout.write("1. Ensuring sim_threads table exists in PostgreSQL... ");
  await ensureThreadTable(pool);
  
  // Verify columns in information_schema
  const colRes = await pool.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'sim_threads'
  `);
  const columns = colRes.rows.map(r => r.column_name);
  const requiredCols = [
    'id', 'question', 'stakes', 'actor_ids', 'cell_id', 'rx', 'ry',
    'clock', 'clock_max', 'state', 'origin', 'created_tick', 'resolved_tick', 'resolution'
  ];
  for (const col of requiredCols) {
    if (!columns.includes(col)) {
      throw new Error(`Missing required column '${col}' in sim_threads!`);
    }
  }
  console.log("✅ PASSED");

  // 2. Fetch a real actor from database
  process.stdout.write("2. Locating real actor in database for ground truth validation... ");
  const agentRes = await pool.query(`SELECT id, name FROM sim_agents LIMIT 1`);
  const realAgent = agentRes.rows[0];
  if (!realAgent) {
    throw new Error("No agent found in sim_agents to test valid actor ID!");
  }
  console.log(`✅ Found: ID ${realAgent.id} (${realAgent.name})`);

  // 3. Test validateActorIds with real actor ID
  process.stdout.write("3. Testing validateActorIds with real actor ID... ");
  const validCheck = await validateActorIds(pool, [String(realAgent.id)]);
  if (!validCheck.valid || validCheck.invalidIds.length > 0) {
    throw new Error(`Real agent ID ${realAgent.id} failed validation!`);
  }
  console.log("✅ PASSED");

  // 4. Test validateActorIds with fake/invented actor ID
  process.stdout.write("4. Testing validateActorIds rejects hallucinated actor ID... ");
  const fakeId = "invented_fake_actor_999999";
  const invalidCheck = await validateActorIds(pool, [fakeId]);
  if (invalidCheck.valid || !invalidCheck.invalidIds.includes(fakeId)) {
    throw new Error(`Validation failed to reject fake actor ID ${fakeId}!`);
  }
  console.log("✅ PASSED (Rejected invented ID)");

  // 5. Test createThread with real actor ID
  process.stdout.write("5. Testing createThread creates open thread with real actor... ");
  const testThread = await createThread(pool, {
    question: "Will the grain tax trigger an open dock strike?",
    stakes: "Dockworkers refuse to load granary barges, driving local unrest above 40.",
    actor_ids: [String(realAgent.id)],
    cell_id: 13408,
    rx: 50,
    ry: 50,
    clock: 0,
    clock_max: 6,
    origin: "reaction",
    created_tick: 3095
  });

  if (!testThread.id || testThread.state !== "open" || testThread.clock !== 0) {
    throw new Error(`Thread creation returned unexpected payload: ${JSON.stringify(testThread)}`);
  }
  console.log(`✅ PASSED (Thread ID: ${testThread.id})`);

  // 6. Test createThread rejects invented actor ID
  process.stdout.write("6. Testing createThread throws error when given invented actor ID... ");
  let caughtError = false;
  try {
    await createThread(pool, {
      question: "Will the ghost conspirator strike?",
      stakes: "Fictional chaos.",
      actor_ids: ["hallucinated_actor_xyz"],
      cell_id: 13408,
      rx: 50,
      ry: 50,
      created_tick: 3095
    });
  } catch (err: any) {
    caughtError = true;
    if (!err.message.includes("Unknown/invented actor IDs")) {
      throw new Error(`Error message did not identify invented actor ID: ${err.message}`);
    }
  }
  if (!caughtError) {
    throw new Error("createThread permitted thread creation with hallucinated actor ID!");
  }
  console.log("✅ PASSED (Enforced Rule 7)");

  // 7. Verify all actors in sim_threads exist in database
  process.stdout.write("7. Verifying all stored actor_ids in sim_threads are valid... ");
  const allThreads = await pool.query(`SELECT id, actor_ids FROM sim_threads`);
  for (const t of allThreads.rows) {
    const check = await validateActorIds(pool, t.actor_ids);
    if (!check.valid) {
      throw new Error(`Thread ID ${t.id} has invalid actors in DB: ${check.invalidIds.join(", ")}`);
    }
  }
  console.log(`✅ PASSED (Checked ${allThreads.rows.length} threads)`);

  // Clean up test thread
  await pool.query(`DELETE FROM sim_threads WHERE id = $1`, [testThread.id]);

  console.log("\n================================================================");
  console.log("    ALL STORY_AUDIT STEP 1 SIM_THREADS & ACTOR TESTS PASSED!    ");
  console.log("================================================================\n");

  await pool.end();
}

testThreadActors().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
