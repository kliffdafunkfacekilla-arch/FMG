import assert from "node:assert/strict";
import pool from "../db/pool.js";
import { isolateTest } from "./testIsolation.js";
import { applySchemaPatches } from "../db/schemaPatches.js";
import { runFactionPlanningAgent } from "../engine/agents/factionPlanningAgent.js";
import { runSeeded, tickSeed } from "../engine/rng.js";

async function main() {
  console.log("=== Testing Faction Finances, Troop Upkeep & Corruption Unrest (B6.2) ===");
  await applySchemaPatches(pool);

  // Pick a quiet tick where monthly grand-strategy (tick + f*7 % 48) and weekly war clashes (tick % 7) do not run
  let probeTick = 2;
  while (
    probeTick % 7 === 0 ||
    (probeTick + 29 * 7) % 48 === 0 ||
    (probeTick + 30 * 7) % 48 === 0
  ) {
    probeTick++;
  }

  // ---------------------------------------------------------------------------
  // 1. Treasury insolvency causes unpaid `sim_faction_units` desertion & disbandment
  // ---------------------------------------------------------------------------
  await pool.query("SAVEPOINT finance_insolvency");
  const initialTroops = Number(
    (await pool.query(`SELECT COALESCE(SUM(count), 0)::int AS s FROM sim_faction_units WHERE faction_id = 29 AND status != 'DISBANDED'`)).rows[0].s
  );
  assert.ok(initialTroops > 100, "Expected Avian Empire (29) to hold active military units");

  const tinyUnitRes = await pool.query(
    `INSERT INTO sim_faction_units (faction_id, unit_type, count, status, location_cell_id, experience)
     VALUES (29, 'INFANTRY', 12, 'ACTIVE', 30627, 0) RETURNING id`
  );
  const tinyUnitId = Number(tinyUnitRes.rows[0].id);

  await pool.query(
    `UPDATE sim_factions
     SET treasury = 0,
         fiscal_economy = jsonb_set(
           jsonb_set(
             jsonb_set(COALESCE(fiscal_economy, '{}'::jsonb), '{pollTax}', '0'::jsonb),
             '{salesTax}', '0'::jsonb
           ),
           '{collected}', '0'::jsonb
         )
     WHERE id = 29`
  );

  await runSeeded(tickSeed(probeTick), () => runFactionPlanningAgent(pool, probeTick, "Insolvency Probe"));

  const afterTroops = Number(
    (await pool.query(`SELECT COALESCE(SUM(count), 0)::int AS s FROM sim_faction_units WHERE faction_id = 29 AND status != 'DISBANDED'`)).rows[0].s
  );
  assert.ok(afterTroops < initialTroops, `Expected troop desertion on insolvency (${afterTroops} vs ${initialTroops})`);
  const tinyStatus = (await pool.query(`SELECT count, status FROM sim_faction_units WHERE id = $1`, [tinyUnitId])).rows[0];
  assert.equal(tinyStatus.status, "DISBANDED", `Expected understrength 12-man unit to disband, got ${JSON.stringify(tinyStatus)}`);
  const desertEv = (
    await pool.query(`SELECT COUNT(*)::int AS c FROM sim_events WHERE tick = $1 AND faction_id = 29 AND type = 'FACTION_TROOP_DESERTION'`, [probeTick])
  ).rows[0].c;
  assert.equal(Number(desertEv), 1, "Expected FACTION_TROOP_DESERTION event on insolvency");
  await pool.query("ROLLBACK TO SAVEPOINT finance_insolvency");

  // Contrast: wealthy solvent treasury keeps troops intact with zero desertions
  await pool.query("SAVEPOINT finance_solvent");
  await pool.query(`UPDATE sim_factions SET treasury = 50000 WHERE id = 29`);
  await runSeeded(tickSeed(probeTick), () => runFactionPlanningAgent(pool, probeTick, "Solvency Probe"));
  const solventTroops = Number(
    (await pool.query(`SELECT COALESCE(SUM(count), 0)::int AS s FROM sim_faction_units WHERE faction_id = 29 AND status != 'DISBANDED'`)).rows[0].s
  );
  assert.equal(solventTroops, initialTroops, "Solvent treasury should keep active military headcount intact");
  await pool.query("ROLLBACK TO SAVEPOINT finance_solvent");
  console.log(`1. Insolvency caused troop desertion (${initialTroops + 12} -> ${afterTroops}) & disbandment while solvent treasury held... PASSED`);

  // ---------------------------------------------------------------------------
  // 2. High fiscal corruption feeds burg unrest & crime while skimming revenue
  // ---------------------------------------------------------------------------
  await pool.query("SAVEPOINT finance_corruption");
  await pool.query(`UPDATE sim_paragons SET corruption_score = 0 WHERE faction_id IN (29, 30)`);
  await pool.query(
    `UPDATE sim_factions
     SET treasury = 20000,
         fiscal_economy = jsonb_set(COALESCE(fiscal_economy, '{}'::jsonb), '{budget,corruption}', '55'::jsonb)
     WHERE id = 29`
  );
  await pool.query(
    `UPDATE sim_factions
     SET treasury = 20000,
         fiscal_economy = jsonb_set(COALESCE(fiscal_economy, '{}'::jsonb), '{budget,corruption}', '10'::jsonb)
     WHERE id = 30`
  );

  const b29Before = (
    await pool.query(
      `SELECT b.burg_id, b.unrest, COALESCE(b.crime_rate, 0)::real AS crime_rate
       FROM sim_burg_economy b JOIN sim_cells c ON b.cell_id = c.id
       WHERE c.faction_id = 29 ORDER BY b.burg_id ASC LIMIT 1`
    )
  ).rows[0];
  const b30Before = (
    await pool.query(
      `SELECT b.burg_id, b.unrest, COALESCE(b.crime_rate, 0)::real AS crime_rate
       FROM sim_burg_economy b JOIN sim_cells c ON b.cell_id = c.id
       WHERE c.faction_id = 30 ORDER BY b.burg_id ASC LIMIT 1`
    )
  ).rows[0];

  await runSeeded(tickSeed(probeTick), () => runFactionPlanningAgent(pool, probeTick, "Corruption Probe"));

  const b29After = (
    await pool.query(`SELECT unrest, COALESCE(crime_rate, 0)::real AS crime_rate FROM sim_burg_economy WHERE burg_id = $1`, [b29Before.burg_id])
  ).rows[0];
  const b30After = (
    await pool.query(`SELECT unrest, COALESCE(crime_rate, 0)::real AS crime_rate FROM sim_burg_economy WHERE burg_id = $1`, [b30Before.burg_id])
  ).rows[0];

  assert.ok(Number(b29After.unrest) > Number(b29Before.unrest), "High corruption faction should raise burg unrest");
  assert.ok(Number(b29After.crime_rate) > Number(b29Before.crime_rate), "High corruption faction should raise burg crime_rate");
  assert.equal(Number(b30After.unrest), Number(b30Before.unrest), "Low corruption faction should not suffer graft unrest");
  assert.equal(Number(b30After.crime_rate), Number(b30Before.crime_rate), "Low corruption faction should not suffer graft crime");

  const pocket29 = Number((await pool.query(`SELECT (fiscal_economy->>'pocketed')::numeric AS p FROM sim_factions WHERE id = 29`)).rows[0].p);
  const pocket30 = Number((await pool.query(`SELECT (fiscal_economy->>'pocketed')::numeric AS p FROM sim_factions WHERE id = 30`)).rows[0].p);
  assert.ok(pocket29 > pocket30, `Expected high-corruption pocketed revenue (${pocket29}) > low-corruption (${pocket30})`);

  await pool.query("ROLLBACK TO SAVEPOINT finance_corruption");
  console.log("2. High corruption skimmed treasury and raised burg unrest & crime... PASSED");

  console.log("\nALL FACTION FINANCE TESTS PASSED");
}

isolateTest()
  .then((done) => main().then(done, async (e: unknown) => { await done(); throw e; }))
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("FACTION FINANCE TEST FAILED - COMMIT BLOCKED:", err.message || err);
    process.exit(1);
  });
