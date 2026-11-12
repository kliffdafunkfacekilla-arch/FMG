import pool from "../db/pool.js";
import { isolateTest } from "./testIsolation.js";
import { getAvailableActionsForTarget } from "../engine/rpg/TagRegistry.js";
import { TagMatrixEngine, TaggedObject } from "../engine/rpg/TagMatrixEngine.js";
import { resolveThreadByParty } from "../engine/questChainEngine.js";
import { ensureThreadTable, createThread } from "../engine/threads/threadEngine.js";

async function testTacticalInteractions() {
  console.log("==================================================================");
  console.log("     TACTICAL ENVIRONMENTAL AFFORDANCES & AFTERMATH REASONING     ");
  console.log("  Flip tables, swing chandeliers, roll hazards, snuff torches,   ");
  console.log("  and verify AI Director aftermath generation with Rule 7 checks. ");
  console.log("==================================================================\n");

  await ensureThreadTable(pool);

  // ------------------------------------------------------------------
  // TEST 1: TACTICAL AFFORDANCE DISCOVERY VIA SYNONYMS
  // ------------------------------------------------------------------
  process.stdout.write("1. Testing tactical affordance discovery on tagged props... ");

  const oakTable = { name: "Heavy Oak Dining Table", tags: ["table", "wood", "heavy"] };
  const chandelier = { name: "Iron Chandelier", tags: ["chandelier", "iron", "hanging"] };
  const beerBarrel = { name: "Stout Ale Barrel", tags: ["barrel", "wood", "heavy"] };
  const clayMug = { name: "Earthenware Tavern Mug", tags: ["mug", "ceramic", "fragile"] };
  const wallTorch = { name: "Pitch Wall Torch", tags: ["torch", "fire", "illuminated"] };
  const oakDoor = { name: "Reinforced Cell Door", tags: ["door", "wood", "iron"] };

  const tableActions = getAvailableActionsForTarget(oakTable);
  const chandelierActions = getAvailableActionsForTarget(chandelier);
  const barrelActions = getAvailableActionsForTarget(beerBarrel);
  const mugActions = getAvailableActionsForTarget(clayMug);
  const torchActions = getAvailableActionsForTarget(wallTorch);
  const doorActions = getAvailableActionsForTarget(oakDoor);

  if (!tableActions.some(a => a.verb === "FLIP_TABLE")) {
    throw new Error("Oak Table failed to yield FLIP_TABLE tactical action.");
  }
  if (!chandelierActions.some(a => a.verb === "SWING_CHANDELIER")) {
    throw new Error("Chandelier failed to yield SWING_CHANDELIER tactical action.");
  }
  if (!barrelActions.some(a => a.verb === "PUSH_OBJECT")) {
    throw new Error("Ale Barrel failed to yield PUSH_OBJECT tactical action.");
  }
  if (!mugActions.some(a => a.verb === "THROW_IMPROVISED")) {
    throw new Error("Tavern Mug failed to yield THROW_IMPROVISED tactical action.");
  }
  if (!torchActions.some(a => a.verb === "SNUFF_FLAME" || a.verb === "SNUFF")) {
    throw new Error("Wall Torch failed to yield SNUFF_FLAME tactical action.");
  }
  if (!doorActions.some(a => a.verb === "BARRICADE_WAY")) {
    throw new Error("Cell Door failed to yield BARRICADE_WAY tactical action.");
  }
  console.log("PASSED (All 6 tactical affordances discovered via semantic tags)");

  // ------------------------------------------------------------------
  // TEST 2: PHYSICAL CASCADE - FLIPPING TABLE FOR COVER
  // ------------------------------------------------------------------
  process.stdout.write("2. Testing TagMatrixEngine: Flip Table creates #CoverHalf & clears standing... ");

  const tableObj: TaggedObject = {
    id: "prop_table_01",
    name: "Tavern Table",
    type: "PROP",
    tags: new Set(["table", "flippable", "standing", "wood"]),
    pos: [10, 10],
    hp: 20,
    maxHp: 20,
    isDestroyed: false
  };

  const flipResult = TagMatrixEngine.resolveInteraction(
    "Patrick",
    "FLIP_TABLE",
    tableObj,
    ["might"]
  );

  if (flipResult.status !== "SUCCESS") {
    throw new Error(`Flip Table expected SUCCESS, got ${flipResult.status}`);
  }
  if (!tableObj.tags.has("cover_half") || !tableObj.tags.has("overturned") || tableObj.tags.has("standing")) {
    throw new Error(`Table tags incorrect after flip: ${Array.from(tableObj.tags).join(", ")}`);
  }
  console.log("PASSED (Table overturned into #cover_half)");

  // ------------------------------------------------------------------
  // TEST 3: PHYSICAL CASCADE - SWING CHANDELIER KNOCKS ENEMY PRONE
  // ------------------------------------------------------------------
  process.stdout.write("3. Testing TagMatrixEngine: Swing Chandelier deals damage & knocks nearby enemy prone... ");

  const chandelierObj: TaggedObject = {
    id: "prop_chandelier_01",
    name: "Grand Chandelier",
    type: "PROP",
    tags: new Set(["chandelier", "swingable", "iron"]),
    pos: [15, 15],
    hp: 15,
    maxHp: 15,
    isDestroyed: false
  };
  const enemyGuard: TaggedObject = {
    id: "npc_guard_01",
    name: "Garrison Sentry",
    type: "NPC",
    tags: new Set(["hostile", "standing"]),
    pos: [16, 15], // Within 3.5 distance
    hp: 12,
    maxHp: 12,
    isDestroyed: false
  };

  const swingResult = TagMatrixEngine.resolveInteraction(
    "Patrick",
    "SWING_CHANDELIER",
    chandelierObj,
    ["reflex", "acrobatics"],
    [enemyGuard]
  );

  if (swingResult.status !== "SUCCESS") {
    throw new Error(`Swing Chandelier expected SUCCESS, got ${swingResult.status}`);
  }
  if (!enemyGuard.tags.has("prone")) {
    throw new Error("Nearby enemy sentry was not knocked prone by swinging dropkick.");
  }
  if (!swingResult.cascades.some(c => c.targetId === "npc_guard_01" && (c.damage || 0) > 0)) {
    throw new Error("No momentum damage applied to enemy guard in cascade.");
  }
  console.log("PASSED (Swinging dropkick knocked enemy prone with cascade damage)");

  // ------------------------------------------------------------------
  // TEST 4: PHYSICAL CASCADE - PUSH ROLLING HAZARD CRUSHES TARGET
  // ------------------------------------------------------------------
  process.stdout.write("4. Testing TagMatrixEngine: Rolling barrel into enemy deals crushing damage & prone... ");

  const barrelObj: TaggedObject = {
    id: "prop_barrel_01",
    name: "Heavy Ironwood Barrel",
    type: "PROP",
    tags: new Set(["barrel", "pushable", "wood"]),
    pos: [20, 20],
    hp: 25,
    maxHp: 25,
    isDestroyed: false
  };
  const thug: TaggedObject = {
    id: "npc_thug_01",
    name: "Dockside Thug",
    type: "NPC",
    tags: new Set(["hostile", "standing"]),
    pos: [22, 20], // Within 4.0 distance
    hp: 10,
    maxHp: 10,
    isDestroyed: false
  };

  const pushResult = TagMatrixEngine.resolveInteraction(
    "Patrick",
    "PUSH_OBJECT",
    barrelObj,
    ["might", "force"],
    [thug]
  );

  if (pushResult.status !== "SUCCESS") {
    throw new Error(`Push Object expected SUCCESS, got ${pushResult.status}`);
  }
  if (!thug.tags.has("prone")) {
    throw new Error("Dockside thug was not knocked prone by rolling barrel.");
  }
  console.log("PASSED (Crushing momentum plowed into target)");

  // ------------------------------------------------------------------
  // TEST 5: PHYSICAL CASCADE - SNUFFING FLAME CREATES SHADOW CONCEALMENT
  // ------------------------------------------------------------------
  process.stdout.write("5. Testing TagMatrixEngine: Snuff torch extinguishes flame and conceals player in shadow... ");

  const torchObj: TaggedObject = {
    id: "prop_torch_01",
    name: "Iron Wall Torch",
    type: "PROP",
    tags: new Set(["torch", "snuffable", "burning", "illuminated"]),
    pos: [30, 30],
    hp: 5,
    maxHp: 5,
    isDestroyed: false
  };
  const playerInRoom: TaggedObject = {
    id: "player_patrick",
    name: "Patrick",
    type: "PLAYER",
    tags: new Set(["standing"]),
    pos: [32, 30], // Within 6.0 distance
    hp: 20,
    maxHp: 20,
    isDestroyed: false
  };

  const snuffResult = TagMatrixEngine.resolveInteraction(
    "Patrick",
    "SNUFF_FLAME",
    torchObj,
    ["snuff", "douse"],
    [playerInRoom]
  );

  if (snuffResult.status !== "SUCCESS") {
    throw new Error(`Snuff Flame expected SUCCESS, got ${snuffResult.status}`);
  }
  if (torchObj.tags.has("burning") || !torchObj.tags.has("snuffed")) {
    throw new Error("Torch tags incorrect after snuff.");
  }
  if (!playerInRoom.tags.has("concealed_in_shadow")) {
    throw new Error("Nearby actor was not concealed in shadow after torch snuffed.");
  }
  console.log("PASSED (Abrupt darkness granted #concealed_in_shadow)");

  // ------------------------------------------------------------------
  // TEST 6: AI STORY DIRECTOR AFTERMATH REASONING & EMERGENT THREAD (RULE 7)
  // ------------------------------------------------------------------
  process.stdout.write("6. Testing AI Director aftermath reasoning & follow-up thread creation... ");

  const realAgentRes = await pool.query(`SELECT id, name FROM sim_agents LIMIT 1`);
  const realAgentId = String(realAgentRes.rows[0].id);

  const testCellId = 13408;
  const testRx = 50;
  const testRy = 50;

  // Clean up previous test threads
  await pool.query(`DELETE FROM sim_threads WHERE cell_id = $1 AND rx = $2 AND ry = $3`, [testCellId, testRx, testRy]);

  // Seed sector layer with real NPC and prop
  await pool.query(
    `UPDATE sim_sector_layers
     SET npcs = $1, props = $2
     WHERE cell_id = $3 AND rx = $4 AND ry = $5 AND z_layer = 0`,
    [
      JSON.stringify([
        {
          id: realAgentId,
          name: "Doran Iron-Bender",
          role: "Blacksmith",
          alive: true,
          tags: ["civilian", "artisan", "#InCustody"]
        }
      ]),
      JSON.stringify([
        {
          id: realAgentId,
          name: "Holding Cell Cage",
          tags: ["iron", "cage"]
        }
      ]),
      testCellId,
      testRx,
      testRy
    ]
  );

  // Seed thread to resolve
  const seededThread = await createThread(pool, {
    question: "Will the captive blacksmith withstand martial interrogation?",
    stakes: "Under martial law, the artisan will be executed unless liberated.",
    actor_ids: [realAgentId],
    cell_id: testCellId,
    rx: testRx,
    ry: testRy,
    clock: 3,
    clock_max: 6,
    created_tick: 1,
    origin: "reaction"
  });

  // Resolve thread by party action (liberation)
  const resolutionResult = await resolveThreadByParty(pool, {
    threadId: seededThread.id,
    playerOutcome: "SUCCESS",
    resolutionNarrative: "The party breached the lock, disarmed the guards, and escorted Doran to safety.",
    currentTick: 2
  });

  if (!resolutionResult.aftermath) {
    throw new Error("Expected aftermath in resolution result, but received undefined.");
  }
  if (!resolutionResult.aftermath.forensicTags || resolutionResult.aftermath.forensicTags.length === 0) {
    throw new Error("No forensic tags generated in aftermath.");
  }
  if (!resolutionResult.aftermath.lootRewards || resolutionResult.aftermath.lootRewards.length === 0) {
    throw new Error("No loot/rewards generated in aftermath.");
  }

  // Verify that an emergent follow-up thread was opened in sim_threads
  const followUpThreadsRes = await pool.query(
    `SELECT * FROM sim_threads WHERE cell_id = $1 AND rx = $2 AND ry = $3 AND state = 'open' AND id != $4`,
    [testCellId, testRx, testRy, seededThread.id]
  );

  if (followUpThreadsRes.rows.length === 0) {
    throw new Error("Expected an emergent follow-up thread to be created in sim_threads.");
  }

  const followUpThread = followUpThreadsRes.rows[0];
  if (!followUpThread.actor_ids || followUpThread.actor_ids.length === 0) {
    throw new Error("Emergent thread has no actor_ids.");
  }
  if (followUpThread.actor_ids[0] !== realAgentId) {
    throw new Error(`Emergent thread actor_id ${followUpThread.actor_ids[0]} does not match real database ID ${realAgentId} (Rule 7 violation).`);
  }

  // Verify forensic tags were applied to the sector prop
  const updatedLayerRes = await pool.query(
    `SELECT props FROM sim_sector_layers WHERE cell_id = $1 AND rx = $2 AND ry = $3 AND z_layer = 0`,
    [testCellId, testRx, testRy]
  );
  const updatedProps = updatedLayerRes.rows[0]?.props || [];
  const primaryProp = updatedProps[0];
  const hasForensicTag = primaryProp?.tags?.some((t: string) => resolutionResult.aftermath?.forensicTags.includes(t));
  if (!hasForensicTag) {
    throw new Error("Forensic aftermath tags were not persisted to sector props.");
  }

  console.log("PASSED (Aftermath generated forensic tags, scene loot, and registered follow-up thread under Rule 7)");

  console.log("\n==================================================================");
  console.log("   ALL TACTICAL AFFORDANCES & AFTERMATH REASONING TESTS PASSED!   ");
  console.log("==================================================================");
}

// Rule 9 tests must not change the live world: run inside a rolled-back transaction, LLMs off.
isolateTest()
  .then(done => testTacticalInteractions().then(done, async (e: unknown) => { await done(); throw e; }))
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\nTEST FAILED:", err);
    process.exit(1);
  });
