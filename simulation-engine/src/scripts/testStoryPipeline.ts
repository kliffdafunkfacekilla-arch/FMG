/**
 * Story pipeline tests (rule 9). Runs inside a rolled-back transaction with LLMs off (testIsolation.ts):
 * the live world is unchanged afterwards.
 *
 * 1. Narrative seeds tag NPCs from simulation facts (corrupt paragon, cultist, racket victims, informant).
 * 2. Typed actor ids (paragon:<id>) validate only for real records, and match their map NPCs.
 * 3. World events open threads with real actors, without duplicates and within the per-tick limit.
 * 4. A party resolving a world thread with no map applies the thread's declared outcome.
 * 5. Managed arcs: beat 1 opens a thread; a party success opens beat 2; an expiry fails the arc.
 * 6. The procedural director picks an arc that fits the local situation.
 * 7. The cult rite rule fires under the canon Bleed tag.
 */
import pool from "../db/pool.js";
import { isolateTest } from "./testIsolation.js";
import { seedNarrativeTags, loadNarrativeFacts, NarrativeFacts } from "../engine/rpg/narrativeSeeds.js";
import { validateActorIds, npcIsActor, getOpenThreads } from "../engine/threads/threadEngine.js";
import { openWorldEventThreads } from "../engine/threads/worldThreads.js";
import { resolveThreadByParty } from "../engine/questChainEngine.js";
import { createManagedArc, advanceArcForThread } from "../engine/threads/storyArcs.js";
import { synthesizeProceduralStoryArc, DirectorInputPayload } from "../engine/rpg/directorBridge.js";
import { evaluateSectorReactions } from "../engine/rpg/narrativeReactionEngine.js";
import { BLEED_TAG } from "../engine/agents/backgroundDirector.js";

function check(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  let allPassed = true;
  const run = async (label: string, fn: () => Promise<void> | void) => {
    try { await fn(); console.log(`✅ ${label}`); } catch (err: any) { console.log(`❌ ${label}: ${err.message}`); allPassed = false; }
  };

  const tickRes = await pool.query(`SELECT tick FROM sim_calendar ORDER BY id DESC LIMIT 1`);
  const tick = Number(tickRes.rows[0]?.tick) || 1;

  await run("Narrative seeds tag NPCs from simulation facts", () => {
    const facts: NarrativeFacts = {
      burgId: 7, unrest: 55,
      paragons: new Map([[11, { corruption: 72, outlaw: false }], [12, { corruption: 5, outlaw: false }], [13, { corruption: 10, outlaw: true }]]),
      cultistCitizens: new Set([501]),
      lairs: [{ id: 3, heat: 80, type: "VICE_AND_PROTECTION_ARM", name: "The Silk-Sovereign Syndicate", residents: ["npc_outlaw_3_1"] }],
      recentEventTypes: new Set(), chaosIntensity: 0.7,
    };
    const npcs: any[] = [
      { id: "npc_paragon_11", name: "Mayor A", tags: [] },
      { id: "npc_paragon_12", name: "Mayor B", tags: [] },
      { id: "npc_paragon_13", name: "Boss C", tags: [] },
      { id: "npc_ward_501", name: "Quiet Neighbour", tags: [] },
      { id: "npc_ward_502", name: "Ada", role: "Merchant", tags: [] },
      { id: "npc_ward_503", name: "Bram", role: "Blacksmith", tags: [] },
      { id: "npc_ward_504", name: "Cel", role: "Weaver", tags: ["spark:sensitive"] },
      { id: "npc_outlaw_3_1", name: "Enforcer", tags: [] },
    ];
    seedNarrativeTags(npcs, facts);
    const tags = (id: string) => npcs.find(n => n.id === id).tags as string[];
    check(tags("npc_paragon_11").includes("#CorruptOfficial"), "corrupt paragon not tagged");
    check(!tags("npc_paragon_12").includes("#CorruptOfficial"), "honest paragon tagged corrupt");
    check(tags("npc_paragon_13").includes("#BountyTarget"), "outlaw paragon not a bounty target");
    check(tags("npc_ward_501").includes("#CultistInfiltrator"), "cultist citizen not tagged");
    check(tags("npc_ward_502").includes("#ExtortionVictim"), "merchant under a protection racket not tagged");
    check(npcs.some(n => n.tags.includes("#RebelInformant")), "no craftsperson marked as informant under high unrest");
    check(tags("npc_ward_504").includes("#NightmareAfflicted"), "chaos-sensitive citizen not afflicted");
    check(tags("npc_outlaw_3_1").includes("#SyndicatePresence") && tags("npc_outlaw_3_1").includes("#BountyTarget"), "hot lair operative not tagged");
  });

  // A real burg with a civic paragon, for the database-backed tests
  const burgRes = await pool.query(
    `SELECT b.burg_id, b.cell_id, b.name, b.food, p.id AS paragon_id, p.name AS paragon_name
     FROM sim_burg_economy b JOIN sim_paragons p ON p.burg_id = b.burg_id AND p.outlaw_id IS NULL
     WHERE p.title !~* '(commander|marshal|warden|captain|sheriff|constable|watch)'
       AND NOT EXISTS (SELECT 1 FROM sim_threads t WHERE t.cell_id = b.cell_id AND t.state IN ('open','escalated'))
     ORDER BY b.burg_id LIMIT 1`
  );
  const burg = burgRes.rows[0];

  await run("Facts load for a real burg", async () => {
    check(burg, "no burg with a civic paragon found");
    const facts = await loadNarrativeFacts(pool, Number(burg.cell_id));
    check(facts.burgId === Number(burg.burg_id), "burg not resolved from cell");
    check(facts.paragons.has(Number(burg.paragon_id)), "burg's paragon not loaded");
  });

  await run("Typed actor ids validate only real records and match their NPCs", async () => {
    check((await validateActorIds(pool, [`paragon:${burg.paragon_id}`])).valid, "real paragon rejected");
    check(!(await validateActorIds(pool, ["paragon:999999999"])).valid, "invented paragon accepted");
    check(npcIsActor({ id: `npc_paragon_${burg.paragon_id}` }, [`paragon:${burg.paragon_id}`]), "paragon NPC not matched to paragon:<id>");
    check(npcIsActor({ id: "npc_ward_42" }, ["citizen:42"]) && !npcIsActor({ id: "npc_ward_42" }, ["paragon:42"]), "citizen/paragon ids confused");
  });

  let worldThreadId = 0;
  await run("A famine event opens a world thread with a real actor, once", async () => {
    // A tick of its own, so only this famine event is "this tick's". Failing seals take the first slots
    // (at most 2 a tick), so call until they are open and the famine gets its turn.
    const testTick = tick + 100000;
    await pool.query(`INSERT INTO sim_events (tick, burg_id, type, message, tier, lore_date) VALUES ($1, $2, 'BURG_FAMINE', 'test famine', 'MAJOR', 'test')`, [testTick, burg.burg_id]);
    for (let i = 0; i < 8; i++) {
      const opened = await openWorldEventThreads(pool, testTick);
      check(opened <= 2, `opened ${opened} threads in one tick (limit is 2)`);
      if ((await getOpenThreads(pool, Number(burg.cell_id))).some(t => t.rule_id === "WORLD_FAMINE")) break;
    }
    const threads = await getOpenThreads(pool, Number(burg.cell_id));
    const famine = threads.find(t => t.rule_id === "WORLD_FAMINE");
    check(famine, "no famine thread in the burg's cell");
    check(famine.actor_ids[0] === `paragon:${burg.paragon_id}`, `actor ${famine.actor_ids[0]} is not the civic paragon`);
    worldThreadId = famine.id;
    await openWorldEventThreads(pool, testTick);
    const again = (await getOpenThreads(pool, Number(burg.cell_id))).filter(t => t.rule_id === "WORLD_FAMINE");
    check(again.length === 1, `duplicate famine threads: ${again.length}`);
  });

  await run("A party resolving a world thread with no map applies its declared outcome", async () => {
    const before = await pool.query(`SELECT food FROM sim_burg_economy WHERE burg_id = $1`, [burg.burg_id]);
    await resolveThreadByParty(pool, { threadId: worldThreadId, playerOutcome: "SUCCESS", currentTick: tick });
    const after = await pool.query(`SELECT food FROM sim_burg_economy WHERE burg_id = $1`, [burg.burg_id]);
    const state = await pool.query(`SELECT state FROM sim_threads WHERE id = $1`, [worldThreadId]);
    check(state.rows[0].state === "resolved", "thread not resolved");
    check(Number(after.rows[0].food) - Number(before.rows[0].food) === 400, `food changed by ${Number(after.rows[0].food) - Number(before.rows[0].food)}, declared +400`);
  });

  await run("Managed arc: beat 1 opens a thread, a party success opens beat 2, an expiry fails it", async () => {
    // Any cached surface map with a living NPC
    const layer = await pool.query(
      `SELECT cell_id, rx, ry, npcs FROM sim_sector_layers WHERE z_layer = 0 AND jsonb_array_length(npcs) > 0 LIMIT 1`
    );
    check(layer.rows[0], "no cached surface map with NPCs to host an arc");
    const { cell_id, rx, ry } = layer.rows[0];
    const focus = String(layer.rows[0].npcs[0].id);
    const { arc, threadId } = await createManagedArc(pool, {
      cellId: cell_id, rx, ry, arcKey: "test_arc", incitingIncident: "A test crisis.", source: "procedural", focusNpcId: focus,
      beats: [{ phase: 1, objective: "Find the first clue" }, { phase: 2, objective: "Confront the culprit" }],
    });
    check(threadId, "no thread opened for beat 1");
    const t1 = await pool.query(`SELECT question, actor_ids, origin FROM sim_threads WHERE id = $1`, [threadId]);
    check(t1.rows[0].origin === "arc" && t1.rows[0].actor_ids[0] === focus, "beat thread has the wrong origin or actor");
    check(/^Will the party find the first clue\?$/.test(t1.rows[0].question), `question reads "${t1.rows[0].question}"`);

    const progress = await advanceArcForThread(pool, threadId!, "party");
    check(progress && progress.phase === 2 && progress.nextThreadId, "arc did not advance to beat 2");
    const failed = await advanceArcForThread(pool, progress.nextThreadId!, "expired");
    check(failed?.state === "failed", "expired beat did not fail the arc");
    const row = await pool.query(`SELECT state, active_phase, thread_ids FROM sim_story_arcs WHERE id = $1`, [arc.id]);
    check(row.rows[0].state === "failed" && row.rows[0].thread_ids.length === 2, "arc row not updated");
  });

  await run("The procedural director picks an arc that fits the situation", () => {
    const base = (econ: string[], faction: string[], npcs: any[]): DirectorInputPayload => ({
      simulation_state: {
        cell_id: 1, sector_coords: { rx: 1, ry: 1 },
        economic_indicators: { active_tags: econ, grain_reserve_percentage: 50, local_inflation_index: 1 },
        faction_dynamics: { active_tags: faction, controlling_faction: "The Crown", garrison_strength: "LOW", unrest_index: 10 },
      },
      player_profile_context: { legal_name: "the party", backstory_hooks: [], inventory_notable: [] },
      available_sector_assets: { eligible_npcs: npcs, eligible_props: [{ id: "p1", type: "Crate", lx: 1, ly: 1, tags: ["container"] }] },
    });
    const smith = { id: "n1", name: "Bram", role: "Blacksmith", tags: [] };
    const cultist = { id: "n2", name: "Quiet One", role: "Weaver", tags: ["#CultistInfiltrator"] };
    const crackdown = synthesizeProceduralStoryArc(base(["#StableEconomy"], ["#MartialLaw"], [smith]));
    check(/arc_(crackdown|courier)_/.test(crackdown.story_arc_framework.arc_id), `martial law produced ${crackdown.story_arc_framework.arc_id}`);
    const cult = synthesizeProceduralStoryArc(base(["#StableEconomy"], [], [cultist]));
    check(/arc_(cult|courier)_/.test(cult.story_arc_framework.arc_id), `cultist produced ${cult.story_arc_framework.arc_id}`);
    check(crackdown.source === "procedural", "source not recorded");
    check(!/Patrick/.test(JSON.stringify(crackdown)), "a hard-coded person still appears in arcs");
    const grain = synthesizeProceduralStoryArc(base(["#Famine"], [], [{ id: "n3", name: "Mira", role: "Miller", tags: [] }]));
    check(/arc_(grain|courier)_/.test(grain.story_arc_framework.arc_id) && grain.story_arc_framework.beats.length >= 2, "famine arc wrong or too short");
  });

  await run("The cult rite fires under the canon Bleed tag", () => {
    const entities: any[] = [{ id: "c1", type: "NPC", name: "Veiled One", tags: ["#CultistInfiltrator"], pos: [10, 10] }];
    const result = evaluateSectorReactions(entities, [BLEED_TAG], { burgId: 1, cellId: 1, unrest: 0, food: 5000, wealth: 0, tick, rx: 1, ry: 1 } as any);
    check(result.rulesTriggered.includes("cult_blood_moon_ritual"), `rules fired: ${result.rulesTriggered.join(", ") || "none"}`);
  });

  console.log(allPassed ? "\nALL STORY PIPELINE TESTS PASSED" : "\nSTORY PIPELINE TESTS FAILED - COMMIT BLOCKED");
  if (!allPassed) process.exitCode = 1;
}

isolateTest()
  .then(done => main().then(done, async (e: unknown) => { await done(); throw e; }))
  .then(() => process.exit(process.exitCode ?? 0))
  .catch(err => {
    console.error("Test runner crashed:", err);
    process.exit(1);
  });
