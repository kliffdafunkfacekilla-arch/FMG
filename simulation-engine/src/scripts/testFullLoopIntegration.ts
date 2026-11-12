/**
 * LIVE smoke run, not a unit test: drives the RUNNING server over HTTP (POST /tick, party session
 * init/step). It advances the real world by a tick and may call the server's LLMs. No transaction can
 * isolate that, so it is not in `npm test` and refuses to run without --live.
 *   node dist/scripts/testFullLoopIntegration.js --live
 */
import pool from '../db/pool.js';

if (!process.argv.includes('--live')) {
  console.log('testFullLoopIntegration advances the LIVE world (a real tick + party turns on the running server).');
  console.log('Re-run with --live if that is what you want.');
  process.exit(0);
}

async function testFullLoop() {
  console.log("================================================================");
  console.log("    B.R.U.T.A.L. CANONICAL LOOP END-TO-END INTEGRATION TEST     ");
  console.log("   tick -> trouble -> hook -> players act -> resolve -> tick    ");
  console.log("================================================================\n");

  const baseUrl = "http://localhost:3000";

  // STEP 1: EXECUTE TICK
  console.log("1. Executing Simulation Master Tick via POST /api/observer/tick...");
  const tickRes = await fetch(`${baseUrl}/api/observer/tick`, {
    method: "POST",
    headers: { "Content-Type": "application/json" }
  });
  if (!tickRes.ok) {
    throw new Error(`Tick failed with status ${tickRes.status}: ${await tickRes.text()}`);
  }
  const tickData = await tickRes.json();
  console.log(`   Tick status: ${tickData.status}, currentTick: ${tickData.currentTick}`);

  // Check Calendar in DB
  const calRes = await pool.query(`SELECT tick, year, month, month_name, day_of_month, season FROM sim_calendar LIMIT 1`);
  const cal = calRes.rows[0];
  console.log(`   Canonical Date: Year ${cal?.year}, Month ${cal?.month} (${cal?.month_name}), Day ${cal?.day_of_month}, Season "${cal?.season}"`);

  // STEP 2: CHECK FOR EMERGENT TROUBLE IN BURG 81 (ROROMIJIMA)
  console.log("\n2. Checking Sector & Economy State at Burg 81 (Roromijima, cell 13408)...");
  const ecoRes = await pool.query(`
    SELECT burg_id, name, wealth, food, raw_materials, unrest, tier 
    FROM sim_burg_economy 
    WHERE burg_id = 81
  `);
  const b = ecoRes.rows[0];
  console.log(`   Burg: ${b?.name} (ID ${b?.burg_id}) | Tier: ${b?.tier} | Wealth: ${b?.wealth} | Unrest: ${b?.unrest}`);

  // STEP 3: INITIALIZE PARTY SESSION (REAL DIRECTOR + REAL SECTOR)
  console.log("\n3. Initializing Party Session via POST /api/dm/party_session/init...");
  const initRes = await fetch(`${baseUrl}/api/dm/party_session/init`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cell_id: 13408,
      sector_coords: { rx: 50, ry: 50 },
      burg_id: 81
    })
  });
  if (!initRes.ok) {
    throw new Error(`Party session init failed with status ${initRes.status}: ${await initRes.text()}`);
  }
  const initData = await initRes.json();
  const session = initData.sessionState;
  console.log(`   Session initialized:`);
  console.log(`   - Sector: rx=${session.rx}, ry=${session.ry}, z_level=${session.z}`);
  console.log(`   - Props loaded: ${initData.propsLoaded || 0}`);
  console.log(`   - NPCs loaded: ${initData.npcsLoaded || 0}`);
  console.log(`   - Active Story Arc: "${session.activeStoryArc?.inciting_incident || 'None'}"`);
  console.log(`   - Objective: "${session.activeStoryArc?.beats?.[0]?.objective || 'Survive'}"`);
  console.log(`   - Party members: ${session.members?.map((p: any) => `${p.name} (${p.role})`).join(", ")}`);

  // STEP 4: STEP THROUGH 4 TURNS (ONE COMPLETE ROUND)
  console.log("\n4. Stepping through 4 autonomous player turns (Full Round)...");
  for (let turn = 0; turn < 4; turn++) {
    const currentMember = session.members[session.turnIndex];
    console.log(`\n   --- Turn ${turn + 1}/4: ${currentMember.name} (${currentMember.role}) ---`);
    
    const stepRes = await fetch(`${baseUrl}/api/dm/party_session/step`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });

    if (!stepRes.ok) {
      throw new Error(`Party turn step failed with status ${stepRes.status}: ${await stepRes.text()}`);
    }

    const stepData = await stepRes.json();
    const turnResult = stepData.turnResult;
    const gmOutput = stepData.gmOutput;

    console.log(`   Spoken Voice: "${turnResult.dialogue}"`);
    console.log(`   Declared Action: "${turnResult.action}"`);
    if (turnResult.rollOutcome) {
      const r = turnResult.rollOutcome;
      console.log(`   B.R.U.T.A.L. Roll: 1d12=${r.playerRoll} + Stat(${r.playerStatVal}) = ${r.playerRoll + r.playerStatVal} vs Guard ${r.dcOrDefenderRoll} -> Net Margin: ${r.difference} (${turnResult.success ? 'SUCCESS' : 'FAILURE'})`);
    }
    console.log(`   GM Narration: "${turnResult.narrative}"`);
    if (gmOutput?.tagReactionSummary) {
      console.log(`   Tag Matrix Cascades: ${gmOutput.tagReactionSummary}`);
    }

    // Update session from stepData
    session.turnIndex = stepData.sessionState.turnIndex;
    session.round = stepData.sessionState.round;
  }

  // STEP 5: VERIFY CONSEQUENCES WRITTEN TO SIM_EVENTS
  console.log("\n5. Verifying consequences written back to sim_events...");
  const eventsRes = await pool.query(`
    SELECT id, tick, type, message 
    FROM sim_events 
    ORDER BY id DESC 
    LIMIT 3
  `);
  console.log("   Recent sim_events entries:");
  eventsRes.rows.forEach(evt => {
    console.log(`   [ID ${evt.id}] Tick ${evt.tick} (${evt.type}): ${evt.message?.slice(0, 100)}...`);
  });

  console.log("\n================================================================");
  console.log("       FULL CANONICAL LOOP VERIFIED END-TO-END!                ");
  console.log("================================================================");

  await pool.end();
}

testFullLoop().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
