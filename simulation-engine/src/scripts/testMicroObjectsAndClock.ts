/**
 * Notable object entities (Phase 12.1) & Encounter Round Clock (Phase 12.2) verification suite.
 */
import assert from "node:assert/strict";
import pool from "../db/pool.js";
import { isolateTest } from "./testIsolation.js";
import { migrate } from "../db/migrate.js";
import { advanceEncounterRound, ALARM_ROUND_INTERVAL, REINFORCEMENT_ROUND_INTERVAL } from "../engine/clock/encounterClock.js";
import { readWorldClock } from "../engine/clock/clock.js";
import { fireDueScheduledEvents } from "../engine/clock/scheduler.js";
import { flushStepDeltas } from "../engine/deltas/index.js";
import { resyncMapCast } from "../engine/micro/mapCast.js";
import { isNotableEconomicProp, makeObjectEntityRef } from "../engine/micro/propEconomy.js";
import { writeBackPropChange } from "../engine/micro/writeBack.js";

async function main() {
  console.log("=== Testing Notable Object Entities & Encounter Round Clock (Phase 12.1-12.2) ===");
  await migrate(pool);

  // 1. Notable vs decorative classification
  assert.equal(isNotableEconomicProp("Royal Granary", ["storage"]), true);
  assert.equal(isNotableEconomicProp("City Treasury Vault", ["locked"]), true);
  assert.equal(isNotableEconomicProp("North Iron Gate", ["gate"]), true);
  assert.equal(isNotableEconomicProp("Blood Altar", ["altar"]), true);
  assert.equal(isNotableEconomicProp("Iron Prisoner Cage", ["cage"]), true);
  assert.equal(isNotableEconomicProp("Wooden Bench", ["wood", "furniture"]), false);
  assert.equal(isNotableEconomicProp("Cobblestone Pavement", ["stone", "floor"]), false);
  console.log("1. Notable economic/story objects separated from decorative props... PASSED");

  const bRes = await pool.query(`SELECT burg_id, cell_id, food FROM sim_burg_economy ORDER BY burg_id ASC LIMIT 1`);
  assert.ok(bRes.rows.length > 0);
  const burgId = Number(bRes.rows[0].burg_id);
  const cellId = Number(bRes.rows[0].cell_id);
  const rx = 51;
  const ry = 51;
  const z = 0;

  await pool.query(`UPDATE sim_burg_economy SET food = GREATEST(food, 1000) WHERE burg_id = $1`, [burgId]);
  const baseFood = Number((await pool.query(`SELECT food FROM sim_burg_economy WHERE burg_id = $1`, [burgId])).rows[0].food);

  // 2. resyncMapCast upserts notable objects into entities (kind='object') and leaves decorative props out
  const granaryId = "prop_test_notable_granary";
  const benchId = "prop_test_decorative_bench";
  const granaryRef = makeObjectEntityRef(cellId, rx, ry, z, granaryId);
  const benchRef = makeObjectEntityRef(cellId, rx, ry, z, benchId);

  const synced = await resyncMapCast(pool, {
    cellId,
    rx,
    ry,
    z,
    burgId,
    npcs: [],
    props: [
      { id: granaryId, name: "Town Granary Store", pos: [110, 120], tags: ["granary", "wood", "flammable"], hp: 80 },
      { id: benchId, name: "Oak Park Bench", pos: [90, 95], tags: ["wood", "furniture"], hp: 20 },
    ],
  });
  const granaryEnt = await pool.query(`SELECT kind, alive FROM entities WHERE ref = $1`, [granaryRef]);
  const benchEnt = await pool.query(`SELECT 1 FROM entities WHERE ref = $1`, [benchRef]);
  assert.equal(granaryEnt.rows[0]?.kind, "object");
  assert.equal(granaryEnt.rows[0]?.alive, true);
  assert.equal(benchEnt.rows.length, 0, "Decorative prop must NOT pollute entities table");
  assert.equal(synced.props[0].entity_ref, granaryRef);
  console.log("2. resyncMapCast registers notable objects in entities while keeping decor procedural... PASSED");

  // 3. writeBackPropChange on notable granary marks entity dead, writes overlay, and docks burg food once
  const burn1 = await writeBackPropChange(pool, {
    prop: { id: granaryId, entity_ref: granaryRef, name: "Town Granary Store", pos: [110, 120], tags: ["granary", "flammable"] },
    change: "burnt",
    cellId,
    rx,
    ry,
    z,
    burgId,
    tick: 5,
    minute: 600,
  });
  assert.equal(burn1.applied, true);
  const burn2 = await writeBackPropChange(pool, {
    prop: { id: granaryId, entity_ref: granaryRef, name: "Town Granary Store", pos: [110, 120], tags: ["granary", "flammable"] },
    change: "burnt",
    cellId,
    rx,
    ry,
    z,
    burgId,
    tick: 5,
    minute: 606,
  });
  assert.equal(burn2.applied, false, "Duplicate burn overlay must be idempotent");

  const granaryDead = await pool.query(`SELECT alive FROM entities WHERE ref = $1`, [granaryRef]);
  const foodAfter = Number((await pool.query(`SELECT food FROM sim_burg_economy WHERE burg_id = $1`, [burgId])).rows[0].food);
  assert.equal(granaryDead.rows[0]?.alive, false, "Burnt notable object entity must be marked alive=false");
  assert.equal(baseFood - foodAfter, 250, "Burnt granary must reduce burg food by 250 once");
  console.log("3. Burnt notable object sets entities.alive=false & adjusts burg food once... PASSED");

  // 4. Encounter round clock (6s/round) advances world_clock.minute_of_day and schedules alarm & reinforcements
  await pool.query(
    `INSERT INTO sim_agents (name, role, sub_role, faction_id, home_burg_id, location_cell_id, state)
     VALUES ('Watch Patrol #99', 'Patrol', 'Town Watch', 1, $1, $2, 'ACTIVE')`,
    [burgId, cellId]
  );

  const startClock = await readWorldClock(pool);
  const startMin = startClock.minute_of_day;
  let sec = 0;
  let sawAlarm = false;
  let sawReinforce = false;

  for (let round = 1; round <= 10; round++) {
    const step = await advanceEncounterRound(pool, {
      round,
      accumulatedSeconds: sec,
      cellId,
      rx,
      ry,
      z,
      combatLoud: true,
    });
    sec = step.accumulatedSeconds;
    if (round % ALARM_ROUND_INTERVAL === 0 && step.scheduledCount > 0) sawAlarm = true;
    if (round % REINFORCEMENT_ROUND_INTERVAL === 0 && step.scheduledCount > 0) sawReinforce = true;
  }

  assert.equal(sawAlarm, true, `Expected ENCOUNTER_ALARM scheduled on round ${ALARM_ROUND_INTERVAL}`);
  assert.equal(sawReinforce, true, `Expected MESO_REINFORCEMENTS scheduled on round ${REINFORCEMENT_ROUND_INTERVAL}`);
  assert.equal(sec, 0, "10 rounds x 6s = 60s exact minute remainder");

  const endClock = await readWorldClock(pool);
  assert.equal(
    endClock.minute_of_day,
    (startMin + 1) % 1440,
    `Expected minute_of_day=${(startMin + 1) % 1440} after 10 rounds (60s), got ${endClock.minute_of_day}`
  );

  const due = await fireDueScheduledEvents(pool, endClock.tick, 1440);
  assert.ok(
    due.deltas.some((d) => d.kind === "event.log" && d.type === "ENCOUNTER_ALARM"),
    "Scheduled ENCOUNTER_ALARM must convert to event.log delta when due"
  );
  assert.ok(
    due.deltas.some((d) => d.kind === "event.log" && d.type === "MESO_REINFORCEMENTS"),
    "Scheduled MESO_REINFORCEMENTS must convert to event.log delta when due"
  );
  await flushStepDeltas(pool, "test_encounter_clock", endClock.tick, due.deltas, endClock.minute_of_day);
  console.log("4. Encounter clock (10 x 6s rounds -> +1m, alarm & reinforcement scheduled/fired)... PASSED");

  console.log("\nALL PHASE 12 NOTABLE OBJECT & ENCOUNTER CLOCK TESTS PASSED");
}

isolateTest()
  .then((done) => main().then(done, async (e: unknown) => { await done(); throw e; }))
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("MICRO OBJECTS & CLOCK TEST FAILED - COMMIT BLOCKED:", err.message || err);
    process.exit(1);
  });
