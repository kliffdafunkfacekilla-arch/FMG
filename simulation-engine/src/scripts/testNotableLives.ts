/**
 * Notable lives (engine/macro/lives): named people die of what happens to their town, form ties, marry,
 * have children, come of age and mourn each other, and the population ledger stays balanced.
 * Runs inside a rolled-back transaction (testIsolation.ts): the test world is unchanged afterwards.
 */
import assert from "node:assert/strict";
import pool from "../db/pool.js";
import { migrate } from "../db/migrate.js";
import { checkCohortConservation } from "../engine/entities/population.js";
import { getEntityByRef } from "../engine/entities/registry.js";
import { attachLivesToNpcs, citizenIdOfNpc, getLifeStories } from "../engine/entities/lifeStory.js";
import { applyLives } from "../engine/macro/lives/apply.js";
import { loadLives } from "../engine/macro/lives/load.js";
import { stepLives, type LifeNotable, type LivesPlan, type LivesSnapshot } from "../engine/macro/lives/step.js";
import { isolateTest } from "./testIsolation.js";

function person(id: number, over: Partial<LifeNotable> = {}): LifeNotable {
  return {
    citizenId: id, burgId: 1, homeCellId: 100, name: `Test${id} Stone`, profession: "Miller", species: "Human",
    isNull: true, sparkTier: "NONE", unitSize: 1, lifeStage: "ADULT", age: 30, temper: "STOIC", status: "CIVILIAN",
    links: [], legacyLinks: [], ...over,
  };
}

function snapshot(notables: LifeNotable[], over: Partial<LivesSnapshot> = {}): LivesSnapshot {
  return {
    tick: 50, notables, burgNames: new Map([[1, "Testford"]]), famineBurgs: new Set(), battleBurgs: new Set(),
    murderBurgs: new Set(), witchHuntBurgs: new Set(), stormBurgs: new Set(), raids: [],
    childCohorts: new Map([["1:Human", { burgId: 1, species: "Human", profession: "Farm Hand", sparkTier: "NONE", isNull: true, count: 5 }]]),
    firstNames: { Human: ["Mara"] }, ...over,
  };
}

/** A random stream that replays fixed values, then repeats the last one. */
function seq(...vals: number[]): () => number {
  let i = 0;
  return () => vals[Math.min(i++, vals.length - 1)]!;
}

async function main() {
  await migrate(pool);

  // 1. A quiet day with high rolls: nobody dies, nothing forms.
  const calm = stepLives(snapshot([person(1), person(2), person(3)]), () => 0.999);
  assert.equal(calm.deaths.length + calm.births.length + calm.lifeEvents.length, 0, "a calm day changed someone's life");
  console.log("1. A calm day leaves every life unchanged... PASSED");

  // 2. A raided caravan: its named crew die or survive, and the dead are mourned by their spouse.
  const spouseLink = (id: number, name: string) => ({ targetNpcId: `citizen:${id}`, citizenId: id, name, relation: "spouse", relationship: "spouse", trust: 0.9, since: 1 });
  const crew = person(10, { profession: "Caravan Guard", status: "ON_CARAVAN", links: [spouseLink(11, "Test11 Stone")] });
  const wife = person(11, { links: [spouseLink(10, "Test10 Stone")] });
  const survivor = person(12, { status: "ON_CARAVAN" });
  const raidPlan = stepLives(
    snapshot([crew, wife, survivor], { raids: [{ shipmentId: 7, citizenIds: [10, 12], destName: "Ashford" }] }),
    seq(0.05, 0.9, 0.999)
  );
  assert.equal(raidPlan.deaths.length, 1, "exactly the unlucky crewman should die");
  assert.match(raidPlan.deaths[0]!.cause, /bandits .*Ashford/, "cause should name the raid and destination");
  assert.ok(raidPlan.lifeEvents.some((e) => e.citizenId === 12 && e.kind === "survived_raid"), "survivor should remember the raid");
  assert.ok(raidPlan.lifeEvents.some((e) => e.citizenId === 11 && e.kind === "grief" && /Widowed/.test(e.text)), "spouse should be widowed");
  assert.ok(raidPlan.townEvents.some((e) => e.type === "NOTABLE_DEATH" && e.message.includes("Test10 Stone")), "the town should record the named death");
  console.log("2. Raided caravan: named crew die or survive, the widow mourns, the town records it... PASSED");

  // 3. Famine and old age, and nobody dies twice.
  const famine = stepLives(snapshot([person(20), person(21, { age: 80 })], { famineBurgs: new Set([1]) }), () => 0.001);
  assert.equal(famine.deaths.length, 2, "both should die on a roll of 0.001");
  assert.equal(new Set(famine.deaths.map((d) => d.notable.citizenId)).size, 2, "someone died twice");
  assert.ok(famine.deaths.every((d) => /starved/.test(d.cause)), "famine should be the cause");
  console.log("3. Famine kills named people (once each)... PASSED");

  // 4. Marriage, then children: spouse links on both sides, a wedding in town, a child drawn from the child cohort.
  const a = person(30, { age: 25 });
  const b = person(31, { age: 27 });
  // Rolls: a/b natural death (no, no) | a: tie (no), marriage (yes), partner pick | b: tie (no), marriage
  // skipped (now married) | couple: birth (yes), first name, surname coin
  const wed = stepLives(snapshot([a, b]), seq(0.9, 0.9, 0.9, 0.0001, 0.0, 0.9, 0.0, 0.0, 0.2));
  const aLinks = wed.links.get(30) as any[];
  const bLinks = wed.links.get(31) as any[];
  assert.ok(aLinks?.some((l) => l.relation === "spouse" && l.citizenId === 31), "a should be married to b");
  assert.ok(bLinks?.some((l) => l.relation === "spouse" && l.citizenId === 30), "b should be married to a");
  assert.ok(wed.townEvents.some((e) => e.type === "NOTABLE_WEDDING"), "the town should record the wedding");
  assert.equal(wed.births.length, 1, "the new couple should have a child on a low roll");
  assert.deepEqual(wed.births[0]!.parentIds, [30, 31]);
  assert.match(wed.births[0]!.name, /^Mara /, "the child takes a species first name");
  console.log("4. Two townsfolk marry, the town records it, and they have a child... PASSED");

  // 5. Coming of age at 16.
  const kid = stepLives(snapshot([person(40, { lifeStage: "CHILD", age: 16 }), person(41, { lifeStage: "CHILD", age: 12 })]), () => 0.999);
  assert.deepEqual(kid.comingOfAge, [40], "only the 16-year-old comes of age");
  console.log("5. A child comes of age at 16... PASSED");

  // 6. Database round trip on a real town: a death and a birth keep the population ledger balanced.
  const snap = await loadLives(pool, 2);
  assert.ok(snap.notables.length > 50, `expected the test world's notables, got ${snap.notables.length}`);
  const byBurg = new Map<number, LifeNotable[]>();
  for (const n of snap.notables) if (n.lifeStage === "ADULT") (byBurg.get(n.burgId) || byBurg.set(n.burgId, []).get(n.burgId)!).push(n);
  const [burgId, people] = Array.from(byBurg.entries()).find(([bid, list]) =>
    list.length >= 3 && snap.childCohorts.has(`${bid}:${list[1]!.species}`))!;
  assert.ok(people, "need a town with three adult notables and a child cohort");
  const [victim, p1, p2] = people as [LifeNotable, LifeNotable, LifeNotable];
  const before = await checkCohortConservation(pool, [burgId]);
  const popBefore = Number((await pool.query(`SELECT pop_null + COALESCE(pop_attuned, 0) AS p FROM sim_burg_economy WHERE burg_id = $1`, [burgId])).rows[0].p);
  const cohort = snap.childCohorts.get(`${burgId}:${p1.species}`)!;
  const plan: LivesPlan = {
    deaths: [{ notable: victim, cause: "test: died in the round trip." }],
    births: [{ burgId, homeCellId: p1.homeCellId, name: "Roundtrip Child", species: p1.species, cohort: { ...cohort }, parentIds: [p1.citizenId, p2.citizenId] }],
    comingOfAge: [],
    links: new Map(),
    lifeEvents: [{ citizenId: victim.citizenId, kind: "death", text: "test death", otherCitizenId: null, burgId }],
    townEvents: [{ burgId, cellId: victim.homeCellId, type: "NOTABLE_DEATH", message: "test" }],
  };
  await applyLives(pool, plan, 2, "test date", () => 0.5);

  const v = (await pool.query(`SELECT allegiance_status, cause_of_death FROM population_demographics WHERE citizen_id = $1`, [victim.citizenId])).rows[0];
  assert.equal(v.allegiance_status, "DECEASED");
  assert.equal(v.cause_of_death, "test: died in the round trip.");
  const ent = await getEntityByRef(pool, `citizen:${victim.citizenId}`);
  assert.ok(ent && !ent.alive && ent.died_tick === 2, "the victim's entity should be dead at tick 2");
  const child = (await pool.query(`SELECT citizen_id, life_stage, age, social_links FROM population_demographics WHERE name = 'Roundtrip Child' AND settlement_id = $1`, [burgId])).rows[0];
  assert.ok(child && child.life_stage === "CHILD" && Number(child.age) === 0, "the newborn should be a 0-year-old CHILD record");
  assert.deepEqual(child.social_links.map((l: any) => l.citizenId).sort(), [p1.citizenId, p2.citizenId].sort(), "the newborn should link to both parents");
  const parentLinks = (await pool.query(`SELECT social_links FROM population_demographics WHERE citizen_id = $1`, [p1.citizenId])).rows[0].social_links;
  assert.ok(parentLinks.some((l: any) => l.relation === "child" && l.citizenId === Number(child.citizen_id)), "the parent should link to the child");
  assert.ok((await getEntityByRef(pool, `citizen:${child.citizen_id}`))?.alive, "the newborn should be registered alive");
  const logged = Number((await pool.query(`SELECT COUNT(*)::int n FROM sim_life_events WHERE citizen_id = ANY($1::int[]) AND tick = 2`, [[victim.citizenId, Number(child.citizen_id)]])).rows[0].n);
  assert.equal(logged, 2, "the death and the birth should both be in the life log");
  const popAfter = Number((await pool.query(`SELECT pop_null + COALESCE(pop_attuned, 0) AS p FROM sim_burg_economy WHERE burg_id = $1`, [burgId])).rows[0].p);
  assert.equal(popAfter, popBefore - 1, "one death takes exactly one person off the town's counter; a birth from the child cohort adds none");
  const after = await checkCohortConservation(pool, [burgId]);
  assert.equal(after.mismatches.length, before.mismatches.length, `ledger balance changed: ${JSON.stringify(after.mismatches)}`);
  console.log(`6. Database round trip in burg ${burgId}: death, entity, newborn, both-way family links, life log, ledger balanced... PASSED`);

  // 7. What the player sees: the parent's story names the child; the dead leave the map; others pass through.
  const stories = await getLifeStories(pool, [p1.citizenId, victim.citizenId]);
  const p1Story = stories.get(p1.citizenId)!;
  assert.ok(p1Story.alive && p1Story.summary.some((l) => l.includes("Roundtrip Child")), `parent summary should name the child: ${JSON.stringify(p1Story.summary)}`);
  assert.ok(!stories.get(victim.citizenId)!.alive && stories.get(victim.citizenId)!.summary[0]!.startsWith("Dead:"), "the victim's story should open with their death");
  assert.equal(citizenIdOfNpc({ id: `npc_citizen_${p1.citizenId}` }), p1.citizenId);
  assert.equal(citizenIdOfNpc({ id: "npc_wild_beast_7" }), null, "a beast has no life");
  const shown = await attachLivesToNpcs(pool, [
    { id: `npc_citizen_${victim.citizenId}` },
    { id: `npc_citizen_${p1.citizenId}` },
    { id: "npc_wild_beast_7" },
  ] as Array<{ id: string; citizenId?: number; lifeStory?: string[] }>);
  assert.deepEqual(shown.map((n) => n.id), [`npc_citizen_${p1.citizenId}`, "npc_wild_beast_7"], "the dead should leave the map, others stay");
  assert.equal(shown[0]!.citizenId, p1.citizenId);
  assert.ok(shown[0]!.lifeStory?.some((l) => l.includes("Roundtrip Child")), "the NPC should carry its life into the scene");
  console.log("7. The player's view: life summaries, the dead leave the map, beasts pass through... PASSED");

  console.log("\nALL NOTABLE LIFE TESTS PASSED");
}

isolateTest()
  .then((done) => main().then(done, async (e: unknown) => { await done(); throw e; }))
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("NOTABLE LIFE TEST FAILED - COMMIT BLOCKED:", err.message || err);
    process.exit(1);
  });
