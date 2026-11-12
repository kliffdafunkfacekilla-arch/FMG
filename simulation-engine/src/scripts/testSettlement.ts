/**
 * Settlement tests (rule 9). Runs inside a rolled-back transaction (testIsolation.ts): the live world is
 * unchanged afterwards.
 *
 * A satellite founded by expansion gets real people: living adult civilians of its parent, preferring the
 * trades it needs, with children of their families, rehomed and re-employed in the new settlement.
 */
import pool from "../db/pool.js";
import { isolateTest } from "./testIsolation.js";
import { settleSatellite } from "../engine/agents/burgExpansionAgent.js";

function check(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const WATCH_TRADES = ["City Watchman", "Gate Sentry", "Armorer", "Bowyer", "Blacksmith"];

async function main() {
  // A parent with enough living people, and an empty cell to found on
  const parentRes = await pool.query(`
    SELECT b.burg_id, b.name FROM sim_burg_economy b
    WHERE b.parent_burg_id IS NULL
      AND (SELECT count(*) FROM population_demographics d WHERE d.settlement_id = b.burg_id AND d.allegiance_status = 'CIVILIAN' AND d.life_stage = 'ADULT') >= 40
    ORDER BY b.burg_id LIMIT 1`);
  const parent = parentRes.rows[0];
  check(parent, "no burg with 40 living adults to test with");
  const cellRes = await pool.query(`SELECT id FROM sim_cells WHERE id NOT IN (SELECT cell_id FROM sim_burg_economy) ORDER BY id LIMIT 1`);
  const cellId = Number(cellRes.rows[0].id);
  const newId = Number((await pool.query(`SELECT MAX(burg_id) + 1 AS id FROM sim_burg_economy`)).rows[0].id);
  const name = "Test Sentinel Redoubt";
  await pool.query(
    `INSERT INTO sim_burg_economy (burg_id, cell_id, name, parent_burg_id, settlement_type, pop_null, pop_attuned)
     VALUES ($1, $2, $3, $4, 'WATCHTOWER', 48, 12)`, [newId, cellId, name, parent.burg_id]);
  const before = Number((await pool.query(`SELECT count(*) c FROM population_demographics WHERE settlement_id = $1`, [parent.burg_id])).rows[0].c);
  const parentHasWatch = Number((await pool.query(
    `SELECT count(*) c FROM population_demographics WHERE settlement_id = $1 AND allegiance_status = 'CIVILIAN' AND life_stage = 'ADULT' AND profession = ANY($2)`,
    [parent.burg_id, WATCH_TRADES])).rows[0].c);

  const moved = await settleSatellite(pool, parent, { burg_id: newId, cell_id: cellId, name, type: "WATCHTOWER", pioneers: 60 });
  console.log(`1. Settling a watchtower of 60 pioneers from ${parent.name}... ${moved} citizen records moved`);
  check(moved >= 3 && moved <= 16, `expected 3-16 settler records, got ${moved}`);

  const settlers = (await pool.query(
    `SELECT name, profession, life_stage, allegiance_status, home_cell_id, workplace_name, motivation FROM population_demographics WHERE settlement_id = $1`,
    [newId])).rows;
  check(settlers.length === moved, `${settlers.length} records live in the satellite, ${moved} reported`);
  check(settlers.every(s => s.allegiance_status === "CIVILIAN"), "a non-civilian (dead, cultist, zealot) was moved");
  check(settlers.every(s => Number(s.home_cell_id) === cellId), "a settler's home cell is not the satellite's cell");
  const adults = settlers.filter(s => s.life_stage === "ADULT");
  check(adults.length >= 2, "fewer than two adult founders");
  check(adults.every(s => String(s.workplace_name).startsWith(name) && String(s.motivation).includes(name)), "a founder still works in or wants the old town");
  console.log("2. Settlers are living civilians, rehomed and re-employed in the satellite... PASSED");

  if (parentHasWatch > 0) check(adults.some(s => WATCH_TRADES.includes(s.profession)), "no watch trade among founders though the parent has some");
  const children = settlers.filter(s => s.life_stage === "CHILD");
  const families = new Set(adults.map(s => String(s.name).split(" ")[1]));
  if (children.length) console.log(`   children: ${children.length}, sharing a founder's family name: ${children.filter(c => families.has(String(c.name).split(" ")[1])).length}`);
  console.log(`3. Founders prefer the watchtower's trades (${adults.filter(s => WATCH_TRADES.includes(s.profession)).length}/${adults.length})... PASSED`);

  const after = Number((await pool.query(`SELECT count(*) c FROM population_demographics WHERE settlement_id = $1`, [parent.burg_id])).rows[0].c);
  check(before - after === moved, `parent lost ${before - after} records, ${moved} moved`);
  console.log("4. The parent lost exactly the records that moved (nobody duplicated or invented)... PASSED");

  console.log("\nALL SETTLEMENT TESTS PASSED");
}

isolateTest()
  .then(done => main().then(done, async (e: unknown) => { await done(); throw e; }))
  .then(() => process.exit(0))
  .catch(err => {
    console.error("SETTLEMENT TEST FAILED - COMMIT BLOCKED:", err.message || err);
    process.exit(1);
  });
