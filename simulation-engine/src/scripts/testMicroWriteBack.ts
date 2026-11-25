import assert from "node:assert/strict";
import pool from "../db/pool.js";
import { migrate } from "../db/migrate.js";
import { advanceSessionMinutes, setClockMode } from "../engine/clock/clock.js";
import { ensureEntity, getEntityByRef } from "../engine/entities/registry.js";
import { executeMasterTick } from "../engine/masterOrchestrator.js";
import { resyncMapCast } from "../engine/micro/mapCast.js";
import { applyMapOverlays, loadTileOverlays } from "../engine/micro/overlays.js";
import { writeBackNpcDeath, writeBackPropChange } from "../engine/micro/writeBack.js";
import { promoteFromCohort } from "../engine/lod/promote.js";
import { isolateTest } from "./testIsolation.js";

async function main() {
  console.log("=== Testing Micro-to-Macro Loop Closure (Phase 5) ===");
  await migrate(pool);

  const calRes = await pool.query(`SELECT MAX(tick)::int AS t FROM sim_calendar`);
  const baseTick = Number(calRes.rows[0]?.t || 1);

  // Locate a living paragon with a valid burg & cohort capacity for at least 3 adult civilians
  const burgRes = await pool.query(
    `SELECT b.burg_id, b.cell_id, b.food, b.wealth, b.raw_materials, b.pop_null, b.pop_attuned
     FROM sim_burg_economy b
     WHERE EXISTS (SELECT 1 FROM sim_paragons p WHERE p.burg_id = b.burg_id)
       AND (
         (SELECT COUNT(*) FROM population_demographics c WHERE c.settlement_id = b.burg_id AND c.allegiance_status = 'CIVILIAN') >= 3
         OR (SELECT COALESCE(SUM(pc.count), 0) FROM population_cohorts pc WHERE pc.burg_id = b.burg_id AND pc.age_band = 'ADULT' AND pc.allegiance = 'CIVILIAN') >= 10
       )
     ORDER BY b.burg_id ASC
     LIMIT 1`
  );
  const burg = burgRes.rows[0];
  assert.ok(burg, "Need a burg with paragons and citizens for micro write-back test");
  const burgId = Number(burg.burg_id);
  const cellId = Number(burg.cell_id);

  let citRes = await pool.query(
    `SELECT citizen_id, name, profession, is_null, unit_size
     FROM population_demographics
     WHERE settlement_id = $1 AND allegiance_status = 'CIVILIAN'
     ORDER BY citizen_id ASC
     LIMIT 3`,
    [burgId]
  );
  for (let i = citRes.rows.length; i < 3; i++) {
    await promoteFromCohort(pool, burgId, { ageBand: "ADULT", allegiance: "CIVILIAN" }, `wb_test:${i}`, baseTick);
  }
  citRes = await pool.query(
    `SELECT citizen_id, name, profession, is_null, unit_size
     FROM population_demographics
     WHERE settlement_id = $1 AND allegiance_status = 'CIVILIAN'
     ORDER BY citizen_id ASC
     LIMIT 3`,
    [burgId]
  );
  assert.equal(citRes.rows.length, 3);
  const citMulti = citRes.rows[0];
  const citSingle = citRes.rows[1];
  const citFamine = citRes.rows[2];

  // Force deterministic unit sizes for both test cases + sufficient burg pop/stock
  await pool.query(`UPDATE population_demographics SET unit_size = 4 WHERE citizen_id = $1`, [citMulti.citizen_id]);
  await pool.query(`UPDATE population_demographics SET unit_size = 1 WHERE citizen_id = $1`, [citSingle.citizen_id]);
  await pool.query(
    `UPDATE sim_burg_economy
     SET food = 1000, wealth = 2000, pop_null = GREATEST(pop_null, 20), pop_attuned = GREATEST(pop_attuned, 20),
         military_forces = '{"INFANTRY": 3}'
     WHERE burg_id = $1`,
    [burgId]
  );
  const bBefore = (await pool.query(`SELECT food, wealth, pop_null, pop_attuned FROM sim_burg_economy WHERE burg_id = $1`, [burgId])).rows[0];

  // 1a. Killing a citizen with unit_size > 1 decrements unit_size & burg pop while record stays alive
  const multiKill = await writeBackNpcDeath(pool, {
    npc: { id: `npc_citizen_${citMulti.citizen_id}`, name: citMulti.name, pos: [120, 120] },
    cellId,
    rx: 50,
    ry: 50,
    z: 0,
    tick: baseTick,
    minute: 15,
    cause: "Test alley ambush",
  });
  assert.equal(multiKill.applied, true);
  const multiRow = (await pool.query(`SELECT unit_size, allegiance_status FROM population_demographics WHERE citizen_id = $1`, [citMulti.citizen_id])).rows[0];
  assert.equal(Number(multiRow.unit_size), 3);
  assert.equal(multiRow.allegiance_status, "CIVILIAN");

  const bAfterMulti = (await pool.query(`SELECT pop_null, pop_attuned FROM sim_burg_economy WHERE burg_id = $1`, [burgId])).rows[0];
  if (citMulti.is_null) {
    assert.equal(Number(bAfterMulti.pop_null), Number(bBefore.pop_null) - 1);
  } else {
    assert.equal(Number(bAfterMulti.pop_attuned), Number(bBefore.pop_attuned) - 1);
  }

  // Idempotency: retrying the same death on this tile does NOT decrement again
  const multiRetry = await writeBackNpcDeath(pool, {
    npc: { id: `npc_citizen_${citMulti.citizen_id}`, name: citMulti.name, pos: [120, 120] },
    cellId,
    rx: 50,
    ry: 50,
    z: 0,
    tick: baseTick,
    minute: 16,
  });
  assert.equal(multiRetry.applied, false);
  const multiRowRetry = (await pool.query(`SELECT unit_size FROM population_demographics WHERE citizen_id = $1`, [citMulti.citizen_id])).rows[0];
  assert.equal(Number(multiRowRetry.unit_size), 3);

  // 1b. Killing a citizen with unit_size = 1 marks the record DECEASED and registry dead
  const singleKill = await writeBackNpcDeath(pool, {
    npc: { id: `npc_citizen_${citSingle.citizen_id}`, name: citSingle.name, pos: [122, 122] },
    cellId,
    rx: 50,
    ry: 50,
    z: 0,
    tick: baseTick,
    minute: 20,
    cause: "Cut down in tavern brawl",
  });
  assert.equal(singleKill.applied, true);
  const singleRow = (await pool.query(`SELECT allegiance_status, cause_of_death FROM population_demographics WHERE citizen_id = $1`, [citSingle.citizen_id])).rows[0];
  assert.equal(singleRow.allegiance_status, "DECEASED");
  assert.equal(singleRow.cause_of_death, "Cut down in tavern brawl");
  const singleEnt = await getEntityByRef(pool, `citizen:${citSingle.citizen_id}`);
  assert.equal(singleEnt?.alive, false);
  console.log("1. Citizen killOne (unit_size > 1 & unit_size = 1 + idempotency)... PASSED");

  // 2. Killing a paragon removes from sim_paragons & marks registry dead
  const pRow = (await pool.query(`SELECT id, name FROM sim_paragons WHERE burg_id = $1 ORDER BY id ASC LIMIT 1`, [burgId])).rows[0];
  assert.ok(pRow);
  await ensureEntity(pool, `paragon:${pRow.id}`);
  const pKill = await writeBackNpcDeath(pool, {
    npc: { id: `npc_paragon_${pRow.id}`, name: pRow.name, pos: [128, 128] },
    cellId,
    rx: 50,
    ry: 50,
    z: 0,
    tick: baseTick,
    minute: 25,
  });
  assert.equal(pKill.applied, true);
  const pStill = await pool.query(`SELECT 1 FROM sim_paragons WHERE id = $1`, [pRow.id]);
  assert.equal(pStill.rows.length, 0);
  const pEnt = await getEntityByRef(pool, `paragon:${pRow.id}`);
  assert.equal(pEnt?.alive, false);
  assert.equal((await writeBackNpcDeath(pool, {
    npc: { id: `npc_paragon_${pRow.id}`, name: pRow.name, pos: [128, 128] },
    cellId,
    rx: 50,
    ry: 50,
    z: 0,
    tick: baseTick,
  })).applied, false);
  console.log("2. Paragon death removes sim_paragons & marks entity dead idempotently... PASSED");

  // 3. Killing a squad member decrements military_forces[unitType] by 1
  const sqKill = await writeBackNpcDeath(pool, {
    npc: { id: `npc_mil_squad_${burgId}_INFANTRY_0`, name: "Watch Infantry Squad #1", pos: [110, 110] },
    cellId,
    rx: 50,
    ry: 50,
    z: 0,
    tick: baseTick,
    minute: 30,
  });
  assert.equal(sqKill.applied, true);
  const mfAfter = JSON.parse((await pool.query(`SELECT military_forces FROM sim_burg_economy WHERE burg_id = $1`, [burgId])).rows[0].military_forces);
  assert.equal(Number(mfAfter.INFANTRY), 2);
  const sqEnt = await getEntityByRef(pool, `squad:${burgId}:INFANTRY:0`);
  assert.equal(sqEnt?.alive, false);
  console.log("3. Squad death decrements military_forces[INFANTRY] & marks entity dead... PASSED");

  // 4. Burning a granary & looting a treasury write overlays + economic deltas once, surviving tile regeneration
  const granary = { id: "prop_granary_main", name: "Burg Main Granary", pos: [90, 90] as [number, number], tags: ["wood", "granary", "structure"], hp: 40, maxHp: 40 };
  const treasury = { id: "prop_treasury_vault", name: "Guild Treasury Vault", pos: [95, 95] as [number, number], tags: ["stone", "treasury", "container", "lootable"], hp: 60, maxHp: 60, inventory: ["Gold Ledger"] };

  const burnOut = await writeBackPropChange(pool, { prop: granary, change: "burnt", cellId, rx: 50, ry: 50, z: 0, tick: baseTick, minute: 35 });
  assert.equal(burnOut.applied, true);
  const burnRetry = await writeBackPropChange(pool, { prop: granary, change: "burnt", cellId, rx: 50, ry: 50, z: 0, tick: baseTick, minute: 36 });
  assert.equal(burnRetry.applied, false);

  const lootOut = await writeBackPropChange(pool, { prop: treasury, change: "looted", cellId, rx: 50, ry: 50, z: 0, tick: baseTick, minute: 40 });
  assert.equal(lootOut.applied, true);

  const bAfterProps = (await pool.query(`SELECT food, wealth FROM sim_burg_economy WHERE burg_id = $1`, [burgId])).rows[0];
  assert.equal(Number(bAfterProps.food), Number(bBefore.food) - 250);
  assert.equal(Number(bAfterProps.wealth), Number(bBefore.wealth) - 500);

  const overlays = await loadTileOverlays(pool, cellId, 50, 50, 0);
  const regenerated = applyMapOverlays([granary, treasury], overlays);
  const regenGranary = regenerated.find((p) => p.id === granary.id);
  const regenTreasury = regenerated.find((p) => p.id === treasury.id);
  assert.equal(regenGranary?.isDestroyed, true);
  assert.ok(regenGranary?.tags.includes("burnt"));
  assert.ok(regenTreasury?.tags.includes("looted"));
  assert.ok(!regenTreasury?.tags.includes("lootable"));
  assert.ok(regenerated.some((p) => p.id === `prop_corpse_npc_paragon_${pRow.id}`), "Corpse overlay should be present");
  console.log("4. Prop burn/loot -> burg economy + overlay replay across tile regen... PASSED");

  // 5. Running a macro tick does NOT revive killed paragon or DECEASED citizen
  await executeMasterTick();
  const pRevived = await pool.query(`SELECT 1 FROM sim_paragons WHERE id = $1`, [pRow.id]);
  assert.equal(pRevived.rows.length, 0);
  const sRevived = await pool.query(`SELECT allegiance_status FROM population_demographics WHERE citizen_id = $1`, [citSingle.citizen_id]);
  assert.equal(sRevived.rows[0]?.allegiance_status, "DECEASED");
  assert.equal((await getEntityByRef(pool, `paragon:${pRow.id}`))?.alive, false);
  assert.equal((await getEntityByRef(pool, `citizen:${citSingle.citizen_id}`))?.alive, false);
  console.log("5. Macro tick preserves battle-map deaths (no zombie revivals)... PASSED");

  // 6. resyncMapCast removes citizen killed in macro (e.g. famine) while respecting encounterActive lock
  await pool.query(`UPDATE population_demographics SET allegiance_status = 'DECEASED', cause_of_death = 'Famine' WHERE citizen_id = $1`, [citFamine.citizen_id]);
  const cachedCast = [
    { id: `npc_citizen_${citFamine.citizen_id}`, entity_ref: `citizen:${citFamine.citizen_id}`, name: citFamine.name, alive: true, pos: [100, 100] },
    { id: `npc_citizen_${citMulti.citizen_id}`, entity_ref: `citizen:${citMulti.citizen_id}`, name: citMulti.name, alive: true, pos: [102, 102], memoryNotes: ["Helped party previously"] },
  ];
  const skipped = await resyncMapCast(pool, {
    cellId,
    rx: 50,
    ry: 50,
    z: 0,
    npcs: cachedCast,
    props: [granary],
    burgId,
    encounterActive: true,
  });
  assert.equal(skipped.changed, false);
  assert.equal(skipped.npcs.length, 2);

  const synced = await resyncMapCast(pool, {
    cellId,
    rx: 50,
    ry: 50,
    z: 0,
    npcs: cachedCast,
    props: [granary],
    burgId,
    encounterActive: false,
  });
  assert.ok(synced.removedRefs.includes(`citizen:${citFamine.citizen_id}`));
  assert.ok(synced.npcs.some((n) => n.entity_ref === `citizen:${citMulti.citizen_id}`), "Living NPC with party history stays in cast");
  assert.ok(!synced.npcs.some((n) => n.entity_ref === `citizen:${citFamine.citizen_id}`), "Deceased resident vanishes from reopened cast");
  assert.equal(synced.props[0]?.isDestroyed, true);
  console.log("6. resyncMapCast removes macro-deceased citizens & preserves active encounters... PASSED");

  // 7. Session time policy: 8 hours = 0 macro ticks, 24 hours = 1 macro tick
  await setClockMode(pool, "session");
  await pool.query(`UPDATE world_clock SET minute_of_day = 0 WHERE id = 1`);
  let tickCalls = 0;
  const clk8 = await advanceSessionMinutes(pool, 480, async () => { tickCalls++; });
  assert.equal(clk8.minute_of_day, 480);
  assert.equal(tickCalls, 0);

  const clk24 = await advanceSessionMinutes(pool, 960, async () => {
    tickCalls++;
    return { currentTick: clk8.tick + 1 };
  });
  assert.equal(clk24.minute_of_day, 0);
  assert.equal(clk24.ticksTriggered, 1);
  assert.equal(tickCalls, 1);
  console.log("7. Session time 8h (0 ticks) & 24h (1 macro tick)... PASSED");

  console.log("\nALL MICRO WRITE-BACK TESTS PASSED");
}

isolateTest()
  .then((done) => main().then(done, async (e: unknown) => { await done(); throw e; }))
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("MICRO WRITE-BACK TEST FAILED - COMMIT BLOCKED:", err.message || err);
    process.exit(1);
  });
