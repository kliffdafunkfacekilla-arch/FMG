/**
 * End-to-End Vertical Slice Certification (Rule 9 / GEMINI.md Current Focus)
 * =========================================================================
 * Exercises one burg (Burg 81, Roromijima, Cell 13408), one thread, and one
 * play session through the entire loop inside an isolated rolled-back
 * transaction (`isolateTest()`):
 *
 *   tick -> trouble (a thread) -> hook reaches party -> players act ->
 *   B.R.U.T.A.L. v5.0 resolves -> consequences written back -> tick
 */
import pool from "../db/pool.js";
import { isolateTest, ensureFixtureLayer } from "./testIsolation.js";
import { BrutalGameMaster } from "../engine/rpg/BrutalGM.js";
import { applyBrutalInjury } from "../engine/injuryEngine.js";
import { ensureParagonMotivesPopulated, deriveParagonMotives, ensureCitizenMotivesPopulated, deriveCitizenMotives } from "../engine/rpg/paragonMotives.js";
import { loadNarrativeFacts, seedNarrativeTags } from "../engine/rpg/narrativeSeeds.js";
import { evaluateSectorReactions } from "../engine/rpg/narrativeReactionEngine.js";
import {
  ensureThreadTable,
  createThread,
  getOpenThreads,
  advanceThreadClocks,
  validateActorIds
} from "../engine/threads/threadEngine.js";
import { resolveThreadByParty } from "../engine/questChainEngine.js";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function runVerticalSliceTest() {
  console.log("==================================================================");
  console.log("      VERTICAL SLICE CERTIFICATION: ROROMIJIMA (BURG 81)          ");
  console.log("  tick -> thread -> hook -> v5.0 resolution -> writeback -> tick  ");
  console.log("==================================================================\n");

  const burgId = 81; // Roromijima
  const rx = 50;
  const ry = 50;

  const burgMetaRes = await pool.query(`SELECT cell_id FROM sim_burg_economy WHERE burg_id = $1 LIMIT 1`, [burgId]);
  assert(burgMetaRes.rows.length > 0, `Expected Burg ${burgId} in sim_burg_economy`);
  const cellId = Number(burgMetaRes.rows[0].cell_id);

  const secParagonRes = await pool.query(
    `SELECT id, name, title, traits, corruption_score FROM sim_paragons
     WHERE burg_id = $1 AND outlaw_id IS NULL
     ORDER BY (title ~* 'captain|commander|marshal|warden') DESC, id ASC LIMIT 1`,
    [burgId]
  );
  assert(secParagonRes.rows.length > 0, `Expected a paragon in Burg ${burgId}`);
  const secParagon = secParagonRes.rows[0];
  const captainId = Number(secParagon.id);

  await ensureThreadTable(pool);

  // ------------------------------------------------------------------
  // 1. PARAGON MOTIVES & NARRATIVE SEEDS (STORY_AUDIT Step 6)
  // ------------------------------------------------------------------
  process.stdout.write("1. Verifying paragon wants, flaws, and lines won't cross... ");
  await ensureParagonMotivesPopulated(pool);

  const nullMotivesRes = await pool.query(
    `SELECT COUNT(*)::int AS c FROM sim_paragons WHERE want IS NULL OR flaw IS NULL OR line_wont_cross IS NULL`
  );
  assert(
    Number(nullMotivesRes.rows[0]?.c) === 0,
    `Expected all sim_paragons rows to have motives, found ${nullMotivesRes.rows[0]?.c} NULL`
  );

  const facts = await loadNarrativeFacts(pool, cellId);
  assert(facts.burgId === burgId, `Expected Burg 81 for cell ${cellId}, got ${facts.burgId}`);
  const captainFact = facts.paragons.get(captainId);
  assert(Boolean(captainFact?.want && captainFact?.flaw && captainFact?.lineWontCross), `Paragon #${captainId} missing loaded motives`);

  const captainMotive = deriveParagonMotives(secParagon);
  assert(Boolean(captainMotive.wantTag && captainMotive.flawTag && captainMotive.lineTag), `Expected derived motives for paragon #${captainId}`);

  const captainNpc: any = {
    id: `npc_paragon_${captainId}`,
    name: secParagon.name,
    role: secParagon.title || "Watch Captain",
    pos: [128, 126] as [number, number],
    tags: ["Paragon", "military", "#Want_IronOrder", "#Line_NeverAbandonWalls"],
    faction: "Roromijima Municipal Guard",
    hp: 14,
    maxHp: 14,
    composure: 12,
    maxComposure: 12,
    disposition: 0,
    alive: true,
    equippedWeapon: "Titanium Bastion Spear",
    equippedArmor: "Glacial Iron Hauberk",
    stats: { might: 5, endurance: 5, finesse: 5, reflex: 4, vitality: 5, fortitude: 5, knowledge: 4, logic: 4, awareness: 6, intuition: 5, charm: 4, willpower: 5 }
  };

  seedNarrativeTags([captainNpc], facts);
  assert(captainNpc.tags.includes(captainMotive.wantTag), "Paragon NPC missing #Want tag after seeding");
  assert(captainNpc.tags.includes(captainMotive.flawTag), "Paragon NPC missing #Flaw tag after seeding");
  assert(captainNpc.tags.includes(captainMotive.lineTag), "Paragon NPC missing #Line tag after seeding");

  // Also verify every citizen in population_demographics has want, flaw, line_wont_cross
  await ensureCitizenMotivesPopulated(pool);
  const nullCitizenRes = await pool.query(
    `SELECT COUNT(*)::int AS c FROM population_demographics WHERE want IS NULL OR flaw IS NULL OR line_wont_cross IS NULL`
  );
  assert(
    Number(nullCitizenRes.rows[0]?.c) === 0,
    `Expected all population_demographics rows to have motives, found ${nullCitizenRes.rows[0]?.c} NULL`
  );

  const citizenRowRes = await pool.query(
    `SELECT citizen_id, name, profession, temper, instinct, allegiance_status, want, flaw, line_wont_cross
     FROM population_demographics
     WHERE settlement_id = $1 AND life_stage = 'ADULT' AND allegiance_status = 'CIVILIAN'
     ORDER BY citizen_id LIMIT 1`,
    [burgId]
  );
  assert(citizenRowRes.rows.length > 0, "Expected at least one adult civilian in Burg 81");
  const citRow = citizenRowRes.rows[0];
  assert(Boolean(citRow.want && citRow.flaw && citRow.line_wont_cross), "Burg 81 citizen missing DB motives");
  const citNpc: any = {
    id: `npc_ward_${citRow.citizen_id}`,
    name: citRow.name,
    role: citRow.profession || "Blacksmith",
    pos: [126, 128] as [number, number],
    tags: ["civilian", "temper:bitter", "#Line_NeverInformOnNeighbors", "#Want_OverturnLevy", "#Flaw_Vindictive"],
    faction: "Roromijima",
    hp: 12,
    maxHp: 12,
    composure: 10,
    maxComposure: 10,
    disposition: 0,
    alive: true,
    want: citRow.want,
    flaw: citRow.flaw,
    lineWontCross: citRow.line_wont_cross
  };
  const seededCit: any = {
    id: `npc_ward_${citRow.citizen_id}`,
    name: citRow.name,
    role: citRow.profession || "Citizen",
    tags: [`temper:${String(citRow.temper || "curious").toLowerCase()}`]
  };
  seedNarrativeTags([seededCit], facts);
  const derivedCit = deriveCitizenMotives(citRow);
  assert(seededCit.tags.includes(derivedCit.wantTag) && seededCit.want && seededCit.flaw && seededCit.lineWontCross, "Seeded citizen NPC missing motive tags/fields");
  console.log("✅ PASSED");

  // ------------------------------------------------------------------
  // 2. TICK -> TROUBLE (Paragon Motive Collision opens a DB Thread)
  // ------------------------------------------------------------------
  process.stdout.write("2. Tick collision opens paragon-driven thread in sim_threads... ");
  await pool.query(`DELETE FROM sim_threads WHERE cell_id = $1`, [cellId]);
  await ensureFixtureLayer(cellId, rx, ry);

  const reactionRes = evaluateSectorReactions(
    [{ ...captainNpc, type: "NPC", coords: { x: 128, y: 126 } }],
    ["#MartialLaw"],
    { burgId, burgName: "Roromijima", cellId, unrest: 48, food: 900, wealth: 1000, tick: 1200, rx, ry }
  );

  assert(reactionRes.rulesTriggered.includes("paragon_iron_order_crackdown"), `Expected paragon_iron_order_crackdown rule to fire, got: ${reactionRes.rulesTriggered.join(", ")}`);
  const cand = reactionRes.threadsToOpen.find(t => t.rule_id === "paragon_iron_order_crackdown");
  assert(cand, "Missing ThreadCandidate for paragon_iron_order_crackdown");
  assert(cand.actor_ids.includes(`paragon:${captainId}`), `Expected canonical actor paragon:${captainId}, got ${cand.actor_ids.join(", ")}`);

  const actorCheck = await validateActorIds(pool, cand.actor_ids);
  assert(actorCheck.valid, `Thread actor validation failed: ${actorCheck.invalidIds.join(", ")}`);

  await pool.query(
    `UPDATE sim_sector_layers SET npcs = $1, props = $2 WHERE cell_id = $3 AND rx = $4 AND ry = $5 AND z_layer = 0`,
    [
      JSON.stringify([captainNpc]),
      JSON.stringify([{ id: "prop_south_gate_81", name: "Roromijima South Gate", pos: [126, 130], tags: ["gate", "wood", "iron", "locked"], hp: 40, maxHp: 40 }]),
      cellId,
      rx,
      ry
    ]
  );

  const thread = await createThread(pool, { ...cand, created_tick: 1200 });
  assert(thread.id > 0 && thread.state === "open", "Thread did not persist as open in sim_threads");
  console.log(`✅ PASSED (Thread #${thread.id} for paragon:${captainId})`);

  // ------------------------------------------------------------------
  // 3. HOOK REACHES THE PARTY & LEGACY ACTS RETIRED
  // ------------------------------------------------------------------
  process.stdout.write("3. Hook reaches party session; legacy campaign acts retired... ");
  const hooks = await getOpenThreads(pool, cellId);
  assert(hooks.some(t => t.id === thread.id), `Open thread #${thread.id} did not reach cell ${cellId} hooks`);

  const gm = new BrutalGameMaster(pool);
  const campState: any = gm.getStoryEngine().getCampaignState();
  assert(campState.currentAct === undefined && campState.totalActs === undefined, "Legacy 5-act ACTS still exposed in getCampaignState()");

  gm.activeNPCs.set(captainNpc.id, captainNpc);
  gm.activeNPCs.set(citNpc.id, citNpc);
  const enforcerId = "npc_curfew_enforcer_81";
  gm.activeNPCs.set(enforcerId, {
    id: enforcerId,
    name: "Corrupt Gate Enforcer",
    role: "Hiring Thug",
    pos: [130, 128],
    tags: ["human", "military", "#Hostile"],
    faction: "Garrison Syndicate",
    hp: 10,
    maxHp: 10,
    composure: 8,
    maxComposure: 8,
    disposition: -2,
    alive: true,
    equippedWeapon: "Workday Blade",
    equippedArmor: "Padded Gambeson",
    stats: { might: 3, endurance: 2, finesse: 2, reflex: 2, vitality: 2, fortitude: 2, knowledge: 2, logic: 2, awareness: 2, intuition: 2, charm: 2, willpower: 2 }
  });
  console.log("✅ PASSED");

  // ------------------------------------------------------------------
  // 4. PLAYERS ACT -> B.R.U.T.A.L. v5.0 PERSUASION (0 Wounds & Orders)
  // ------------------------------------------------------------------
  process.stdout.write("4. Players act: v5.0 Persuasion deals 0 wounds & enforces orders block... ");
  const talkRes = await gm.executeTurn({
    actionText: `I talk with ${secParagon.name} to negotiate keeping grain carts moving smoothly`,
    playerId: 104,
    playerPos: [128, 128]
  });
  assert(talkRes.systemLog.includes("v5.0 Persuasion"), `Expected v5.0 Persuasion log, got: ${talkRes.systemLog}`);
  assert(talkRes.rollOutcome.injuryPoints === 0, `Expected 0 Composure wounds on Persuasion, got ${talkRes.rollOutcome.injuryPoints}`);

  const ordersRes = await gm.executeTurn({
    actionText: `I talk with ${secParagon.name} and ask him to abandon post and unlock the prison`,
    playerId: 104,
    playerPos: [128, 128]
  });
  assert(!ordersRes.success && ordersRes.systemLog.includes("REJECTED_AGAINST_ORDERS"), `Expected REJECTED_AGAINST_ORDERS, got: ${ordersRes.systemLog}`);

  const citizenLineRes = await gm.executeTurn({
    actionText: `I talk with ${citNpc.name} to convince them to inform on your neighbor`,
    playerId: 104,
    playerPos: [126, 128]
  });
  assert(!citizenLineRes.success && citizenLineRes.systemLog.includes("REJECTED_AGAINST_ORDERS"), `Expected citizen hard line REJECTED_AGAINST_ORDERS, got: ${citizenLineRes.systemLog}`);

  const inFightTalk = await gm.executeTurn({
    actionText: "I talk to Corrupt Gate Enforcer and yell at him mid-duel to drop his weapon",
    playerId: 101,
    playerPos: [129, 128]
  });
  assert(inFightTalk.rollOutcome.injuryPoints === 0, `In-fight talk must deal 0 Composure wounds, got ${inFightTalk.rollOutcome.injuryPoints}`);
  console.log("✅ PASSED");

  // ------------------------------------------------------------------
  // 5. PLAYERS ACT -> B.R.U.T.A.L. v5.0 COMBAT (Foe Stack, Owed, Come-Down)
  // ------------------------------------------------------------------
  process.stdout.write("5. Players act: v5.0 Combat shreds foe cards/Resolve, tracks owed & Come-Down... ");
  let sawHit = false;
  let foeStoppedFighting = false;
  let lastCombatOut: any = null;

  for (let round = 0; round < 20; round++) {
    const out = await gm.executeTurn({
      actionText: "I strike Corrupt Gate Enforcer with my heavy blade",
      playerId: 101,
      playerPos: [129, 128],
      isStealthed: true // Advantage ensures decisive hit convergence in bounded rounds
    });
    lastCombatOut = out;
    if (out.success) sawHit = true;
    const foe = gm.activeNPCs.get(enforcerId);
    const foeStack = out.foeStackState || foe?.foeStack;
    assert(foeStack, "Expected FoeStackState attached to non-boss NPC during combat");
    if (!foe || !foe.alive || foe.hp <= 0 || foeStack.status === "down" || foeStack.status === "seeking_exit" || foeStack.status === "broken") {
      foeStoppedFighting = true;
      break;
    }
  }

  assert(sawHit, `Expected at least one landed attack across rounds; last log: ${lastCombatOut?.systemLog}`);
  assert(foeStoppedFighting, `Expected foe stack to reach down or seeking_exit/broken within 20 rounds; status=${lastCombatOut?.foeStackState?.status}`);

  // Verify injury owed energy + Come-Down settlement
  const pState = gm.getPlayerInjuryState(101);
  const injBeforeComeDown = applyBrutalInjury(pState, "MINOR", "HEALTH", "Gate skirmish wound");
  assert((injBeforeComeDown.updatedState.owed?.stamina ?? 0) >= 2, "Minor injury must record >= 2 Stamina owed");
  assert(injBeforeComeDown.updatedState.stamina === pState.stamina, "Mid-fight injury must not subtract Stamina before Come-Down");
  // Persist injured state into GM map via apply + settle check
  pState.owed = injBeforeComeDown.updatedState.owed;
  pState.maxHealth = injBeforeComeDown.updatedState.maxHealth;
  pState.health = injBeforeComeDown.updatedState.health;
  pState.tookMinorOrWorse = true;
  pState.activeWounds = injBeforeComeDown.updatedState.activeWounds;

  const afterComeDown = gm.settlePlayerComeDown(101)!;
  assert(afterComeDown.owed?.stamina === 0 && afterComeDown.owed?.focus === 0, "Come-Down must zero out owed energy");
  assert(afterComeDown.stamina < injBeforeComeDown.updatedState.stamina, "Come-Down must subtract owed Stamina from pool");
  assert(afterComeDown.composure >= 1, "The shakes at Come-Down must never drop Composure below 1");
  console.log("✅ PASSED");

  // ------------------------------------------------------------------
  // 6. CONSEQUENCES WRITTEN BACK & SURVIVE NEXT TICK
  // ------------------------------------------------------------------
  process.stdout.write("6. Consequences written back to PostgreSQL and survive next tick... ");
  const beforeEcon = await pool.query(`SELECT unrest, wealth FROM sim_burg_economy WHERE burg_id = $1`, [burgId]);
  const resolution = await resolveThreadByParty(pool, {
    threadId: thread.id,
    playerOutcome: "SUCCESS",
    currentTick: 1201,
    resolutionNarrative: "The party neutralised the corrupt curfew enforcers and struck a gatehouse accord with Watch Captain Fletcher."
  });
  assert(resolution.state === "resolved", `Expected resolved state, got ${resolution.state}`);

  const threadDb = await pool.query(`SELECT state, resolved_tick FROM sim_threads WHERE id = $1`, [thread.id]);
  assert(threadDb.rows[0]?.state === "resolved" && Number(threadDb.rows[0]?.resolved_tick) === 1201, "sim_threads row did not record resolved state/tick");

  const afterEcon = await pool.query(`SELECT unrest, wealth FROM sim_burg_economy WHERE burg_id = $1`, [burgId]);
  assert(
    Number(afterEcon.rows[0].unrest) !== Number(beforeEcon.rows[0].unrest) ||
    Number(afterEcon.rows[0].wealth) !== Number(beforeEcon.rows[0].wealth),
    "Expected sim_burg_economy consequences written back"
  );

  await advanceThreadClocks(pool, 1202);
  const postTick = await pool.query(`SELECT state FROM sim_threads WHERE id = $1`, [thread.id]);
  assert(postTick.rows[0]?.state === "resolved", "Resolved thread changed state on next tick!");
  console.log("✅ PASSED");

  console.log("\n==================================================================");
  console.log("      ALL VERTICAL SLICE CERTIFICATION ASSERTIONS PASSED!         ");
  console.log("==================================================================\n");
}

isolateTest()
  .then(done => runVerticalSliceTest().then(done, async (e: unknown) => { await done(); throw e; }))
  .then(() => process.exit(0))
  .catch(err => {
    console.error("Vertical slice test failed:", err);
    process.exit(1);
  });

