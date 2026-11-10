import pool from "../db/pool.js";
import {
  ensureThreadTable,
  createThread,
  advanceThreadClocks
} from "../engine/threads/threadEngine.js";

async function testFullLoopLiveSession() {
  console.log("==================================================================");
  console.log("           LIVE LOOP INTEGRATION TEST (CANON VERTICAL SLICE)      ");
  console.log(" tick -> trouble (thread) -> hook reaches party -> players act -> ");
  console.log("     B.R.U.T.A.L. resolves -> consequences written back -> tick   ");
  console.log("==================================================================\n");

  await ensureThreadTable(pool);

  const targetCellId = 13408;
  const targetRx = 50;
  const targetRy = 50;
  const targetBurgId = 81; // Roromijima

  // 0. Locate a real agent from sim_agents to represent Doran Iron-Bender
  const realAgentRes = await pool.query(`SELECT id, name FROM sim_agents LIMIT 1`);
  if (realAgentRes.rows.length === 0) throw new Error("No agent found in sim_agents!");
  const realAgentId = String(realAgentRes.rows[0].id);

  // Clean up any stale threads for this cell
  await pool.query(`DELETE FROM sim_threads WHERE cell_id = $1`, [targetCellId]);

  // Set baseline economy in sim_burg_economy
  await pool.query(
    `INSERT INTO sim_burg_economy (burg_id, cell_id, name, unrest, wealth, food, raw_materials, crime_rate)
     VALUES ($1, $2, 'Roromijima', 45, 1200, 1000, 300, 20)
     ON CONFLICT (burg_id) DO UPDATE
     SET cell_id = $2, unrest = 45, wealth = 1200, food = 1000, raw_materials = 300, crime_rate = 20`,
    [targetBurgId, targetCellId]
  );

  // Seed sector layer with Doran and closed forge prop
  const existingLayerRes = await pool.query(
    `SELECT compressed_terrain, features FROM sim_sector_layers WHERE cell_id = $1 AND rx = $2 AND ry = $3 AND z_layer = 0 LIMIT 1`,
    [targetCellId, targetRx, targetRy]
  );

  const npcs = [
    {
      id: realAgentId,
      name: "Doran Iron-Bender",
      role: "Blacksmith",
      disposition: 0,
      alive: true,
      pos: [126, 128],
      equippedWeapon: "Smithing Hammer",
      equippedArmor: "Heavy Leather Apron",
      tags: ["civilian", "artisan", "#InCustody", "#Imprisoned"]
    }
  ];

  const props = [
    {
      id: "prop_forge_01",
      name: "Artisan Smithy Forge",
      pos: [128, 128],
      tags: ["forge", "anvil", "#SmithyClosed", "#BoardedDoor"],
      hp: 50,
      maxHp: 50
    }
  ];

  const features = {
    environmental_tags: ["#MartialLaw", "#ResourceScarcity"]
  };

  if (existingLayerRes.rows.length > 0) {
    await pool.query(
      `UPDATE sim_sector_layers SET npcs = $1, props = $2, features = $3 WHERE cell_id = $4 AND rx = $5 AND ry = $6 AND z_layer = 0`,
      [JSON.stringify(npcs), JSON.stringify(props), JSON.stringify(features), targetCellId, targetRx, targetRy]
    );
  } else {
    await pool.query(
      `INSERT INTO sim_sector_layers (cell_id, rx, ry, z_layer, npcs, props, features, compressed_terrain)
       VALUES ($1, $2, $3, 0, $4, $5, $6, $7)`,
      [targetCellId, targetRx, targetRy, JSON.stringify(npcs), JSON.stringify(props), JSON.stringify(features), Buffer.alloc(10)]
    );
  }

  // ------------------------------------------------------------------
  // 1. TICK -> TROUBLE (A Thread)
  // ------------------------------------------------------------------
  process.stdout.write("1. Seed thread: Seditious blacksmith under martial law... ");
  const seededThread = await createThread(pool, {
    question: "Will the crackdown on Doran Iron-Bender ignite an open riot against the garrison?",
    stakes: "The blacksmith will face execution and the smithy will be permanently demolished unless intervened.",
    actor_ids: [realAgentId],
    cell_id: targetCellId,
    rx: targetRx,
    ry: targetRy,
    clock: 1,
    clock_max: 4,
    origin: "reaction",
    created_tick: 600,
    rule_id: "sedition_garrison_raid",
    on_expire: {
      unrestDelta: 25,
      wealthDelta: -300,
      rawMaterialsDelta: -150,
      actorTagsAdd: ["#Executed", "#MartyrOfRebellion"],
      actorTagsRemove: ["#InCustody", "#Imprisoned"],
      actorAlive: false,
      propTagsAdd: ["#ForgeDismantled", "#RubbleChoked"],
      propNameMatch: "forge",
      sectorTagsAdd: ["#MartialTerror"],
      narrativeSummary: "Garrison publicly executed Doran Iron-Bender; smithy was demolished as unrest boiled."
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
      sectorTagsRemove: ["#WatchPatrolsActive"],
      narrativeSummary: "The party dismantled the garrison false charges; Doran Iron-Bender was liberated and the forge reignited!"
    }
  });
  console.log(`✅ PASSED (Thread #${seededThread.id} active in Roromijima)`);

  // ------------------------------------------------------------------
  // 2. HOOK REACHES THE PARTY (/api/dm/party_session/init)
  // ------------------------------------------------------------------
  process.stdout.write("2. Hook reaches party: Initializing party session in cell 13408... ");
  const initRes = await fetch("http://127.0.0.1:3000/api/dm/party_session/init", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cellId: targetCellId, rx: targetRx, ry: targetRy, z: 0 })
  });

  if (!initRes.ok) {
    throw new Error(`Init failed: ${initRes.status} ${await initRes.text()}`);
  }

  const initData: any = await initRes.json();
  if (!initData.success) throw new Error("Init returned unsuccessful!");

  const sessionState = initData.sessionState;
  if (!sessionState.active) throw new Error("Session is not active!");
  if (sessionState.activeStoryArc?.thread_id !== seededThread.id) {
    throw new Error(`Expected active story arc to hold thread #${seededThread.id}, got: ${sessionState.activeStoryArc?.thread_id}`);
  }
  if (!sessionState.activeStoryArc?.inciting_incident?.includes("blacksmith will face execution")) {
    throw new Error(`Expected inciting incident to reflect thread stakes; got: ${sessionState.activeStoryArc?.inciting_incident}`);
  }
  if (!sessionState.activeStoryArc?.beats?.[0]?.objective?.includes("ignite an open riot")) {
    throw new Error(`Expected beat objective to reflect thread question; got: ${sessionState.activeStoryArc?.beats?.[0]?.objective}`);
  }
  if (initData.npcsLoaded === 0) throw new Error("No NPCs loaded into tactical session!");
  console.log(`✅ PASSED (Hook received: "${sessionState.activeStoryArc.beats[0].objective}")`);

  // ------------------------------------------------------------------
  // 3. PLAYERS ACT & B.R.U.T.A.L. RESOLVES (/api/dm/party_session/step)
  // ------------------------------------------------------------------
  process.stdout.write("3. Players act: Party member uses lockpicks to free Doran Iron-Bender... ");
  const stepRes = await fetch("http://127.0.0.1:3000/api/dm/party_session/step", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      actionOverride: "I carefully pick the rusted padlock on Doran Iron-Bender's shackles, hand him a file to break the forge chains, and present the forged release order to the watch.",
      dialogueOverride: "Quiet now, Doran. We have the orders from the high council; you are free.",
      forceSuccess: true
    })
  });

  if (!stepRes.ok) {
    throw new Error(`Step failed: ${stepRes.status} ${await stepRes.text()}`);
  }

  const stepData: any = await stepRes.json();
  if (!stepData.success) throw new Error("Step returned unsuccessful!");
  if (!stepData.turnResult?.success) throw new Error("Turn action failed!");
  if (!stepData.threadResolution) {
    throw new Error("Action did not resolve active thread! Expected threadResolution in response.");
  }
  console.log(`✅ PASSED (Action resolved: "${stepData.turnResult.narrative.slice(0, 70)}...")`);

  // ------------------------------------------------------------------
  // 4. CONSEQUENCES WRITTEN BACK TO DATABASE
  // ------------------------------------------------------------------
  process.stdout.write("4. Verifying consequences written back to PostgreSQL... ");

  // 4a. sim_threads
  const threadDbRes = await pool.query(`SELECT state, resolved_tick, resolution FROM sim_threads WHERE id = $1`, [seededThread.id]);
  const finalThread = threadDbRes.rows[0];
  if (finalThread.state !== "resolved") {
    throw new Error(`Expected thread state to be 'resolved', got: ${finalThread.state}`);
  }
  if (!finalThread.resolution) {
    throw new Error("Thread resolution text is missing!");
  }

  // 4b. sim_burg_economy
  const burgDbRes = await pool.query(`SELECT unrest, wealth, raw_materials FROM sim_burg_economy WHERE burg_id = $1`, [targetBurgId]);
  const finalBurg = burgDbRes.rows[0];
  const unrestDelta = Number(finalBurg.unrest) - 45;
  const wealthDelta = Number(finalBurg.wealth) - 1200;
  const rawMaterialsDelta = Number(finalBurg.raw_materials) - 300;

  if (unrestDelta !== -15) {
    throw new Error(`Expected unrest delta of -15; actual delta: ${unrestDelta} (current: ${finalBurg.unrest})`);
  }
  if (wealthDelta !== 150) {
    throw new Error(`Expected wealth delta of +150; actual delta: ${wealthDelta} (current: ${finalBurg.wealth})`);
  }
  if (rawMaterialsDelta !== 100) {
    throw new Error(`Expected raw_materials delta of +100; actual delta: ${rawMaterialsDelta} (current: ${finalBurg.raw_materials})`);
  }

  // 4c. sim_sector_layers
  const layerDbRes = await pool.query(
    `SELECT npcs, props FROM sim_sector_layers WHERE cell_id = $1 AND rx = $2 AND ry = $3 AND z_layer = 0`,
    [targetCellId, targetRx, targetRy]
  );
  const finalNpcs = layerDbRes.rows[0].npcs || [];
  const doranNpc = finalNpcs.find((n: any) => String(n.id) === realAgentId);
  if (!doranNpc) throw new Error("Doran Iron-Bender missing from sector layer after resolution!");

  if (!doranNpc.tags.includes("#RebelAlly") || !doranNpc.tags.includes("#VindicatedArtisan")) {
    throw new Error(`Doran missing consequence tags! Tags: ${JSON.stringify(doranNpc.tags)}`);
  }
  if (doranNpc.tags.includes("#InCustody") || doranNpc.tags.includes("#Imprisoned")) {
    throw new Error(`Doran still carries captive tags! Tags: ${JSON.stringify(doranNpc.tags)}`);
  }
  if (doranNpc.disposition < 3) {
    throw new Error(`Expected disposition >= 3, got: ${doranNpc.disposition}`);
  }

  const finalProps = layerDbRes.rows[0].props || [];
  const forgeProp = finalProps.find((p: any) => p.name?.toLowerCase().includes("forge"));
  if (!forgeProp?.tags.includes("#SmithyOperational") || forgeProp?.tags.includes("#SmithyClosed")) {
    throw new Error(`Forge prop tags invalid! Tags: ${JSON.stringify(forgeProp?.tags)}`);
  }

  // 4d. sim_events
  const eventDbRes = await pool.query(
    `SELECT type, message, tier FROM sim_events WHERE type = 'PARTY_RESOLVED_THREAD' ORDER BY id DESC LIMIT 1`
  );
  if (!eventDbRes.rows[0]?.message.includes("HEROIC INTERVENTION")) {
    throw new Error(`Missing HEROIC INTERVENTION in sim_events! Got: ${JSON.stringify(eventDbRes.rows[0])}`);
  }

  console.log("✅ PASSED");
  console.log(`   - sim_threads: Thread #${seededThread.id} state='resolved', resolution logged.`);
  console.log(`   - sim_burg_economy: Unrest ${unrestDelta} (45 -> 30), Wealth +${wealthDelta} (1200 -> 1350), Raw Materials +${rawMaterialsDelta} (300 -> 400).`);
  console.log(`   - sim_sector_layers: Doran freed [#RebelAlly, #VindicatedArtisan], Forge [#SmithyOperational].`);
  console.log(`   - sim_events: Rumor logged [HEROIC INTERVENTION].`);

  // ------------------------------------------------------------------
  // 5. TICK (WORLD PROGRESSION)
  // ------------------------------------------------------------------
  process.stdout.write("5. Tick: Advance world clock (tick 601)... ");
  const clockSummary = await advanceThreadClocks(pool, 601);
  // Thread was already resolved by party, so advanceThreadClocks does not re-resolve it
  const postTickRes = await pool.query(`SELECT state FROM sim_threads WHERE id = $1`, [seededThread.id]);
  if (postTickRes.rows[0].state !== "resolved") {
    throw new Error(`Thread changed state after tick! Got: ${postTickRes.rows[0].state}`);
  }
  console.log("✅ PASSED (World ticked forward with resolved thread stable)\n");

  // Clean up test thread
  await pool.query(`DELETE FROM sim_threads WHERE id = $1`, [seededThread.id]);

  console.log("==================================================================");
  console.log("         FULL LIVE LOOP VERTICAL SLICE COMPLETED 100%!            ");
  console.log("==================================================================\n");

  await pool.end();
}

testFullLoopLiveSession().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});

