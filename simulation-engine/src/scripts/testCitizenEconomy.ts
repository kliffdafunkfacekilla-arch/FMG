import assert from "node:assert/strict";
import pool from "../db/pool.js";
import { isolateTest } from "./testIsolation.js";
import { getFactionSpecialty } from "../engine/economy/factionSpecialties.js";
import { runBurgOperationsAgent } from "../engine/agents/burgOperationsAgent.js";
import { updateRegionalMarkets } from "../engine/economy/marketAgent.js";

async function getStockpile(burgId: number): Promise<Record<string, number>> {
  const res = await pool.query(`SELECT complex_inventory FROM sim_industrial_stockpiles WHERE burg_id = $1`, [burgId]);
  const raw = res.rows[0]?.complex_inventory;
  if (!raw) return {};
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

async function setExcelsisStockpile(inv: Record<string, number>) {
  await pool.query(
    `INSERT INTO sim_industrial_stockpiles (burg_id, complex_inventory)
     VALUES (1, $1::jsonb)
     ON CONFLICT (burg_id) DO UPDATE SET complex_inventory = EXCLUDED.complex_inventory`,
    [JSON.stringify(inv)]
  );
}

async function main() {
  console.log("=== Testing Citizen-Backed Economy, Recipes, Specialties & 31 Markets ===");

  const tickRes = await pool.query(`SELECT COALESCE(MAX(tick), 1)::int AS tick FROM sim_calendar`);
  const baseTick = Number(tickRes.rows[0].tick) || 1;

  // 1. All 26 active sovereign states resolve to their own Ostraka specialty
  const facRes = await pool.query(`SELECT id, name FROM sim_factions WHERE id > 0 ORDER BY id`);
  assert.equal(facRes.rows.length, 26, `Expected 26 sovereign factions, got ${facRes.rows.length}`);
  for (const f of facRes.rows) {
    const spec = getFactionSpecialty(Number(f.id));
    assert.equal(spec.factionId, Number(f.id), `Faction ${f.id} (${f.name}) fell back to specialty ${spec.factionId}`);
    assert.ok(spec.uniqueGoodKey.length > 0);
  }
  console.log("1. All 26 Ostraka sovereign factions resolve to unique specialties... PASSED");

  // 2. Excelsis Citadel has real profile, map-driven professions, logistics crew, 0 Fishermen, and no fake fallback goods
  const dealColCheck = await pool.query(`SELECT to_market_id FROM sim_trade_deals LIMIT 1`);
  assert.equal(dealColCheck.rows.length, 1, "sim_trade_deals.to_market_id missing or empty");

  const excBurgRes = await pool.query(`SELECT resource_profile FROM sim_burg_economy WHERE burg_id = 1`);
  const profile = typeof excBurgRes.rows[0].resource_profile === "string"
    ? JSON.parse(excBurgRes.rows[0].resource_profile)
    : excBurgRes.rows[0].resource_profile;
  assert.ok(Array.isArray(profile?.primary) && profile.primary.length > 0, "Excelsis missing primary resource_profile");
  assert.ok(
    Array.isArray(profile?.crafted) && profile.crafted.some((c: any) => Number(c.goodId) === 59 && c.key === "arms"),
    "Excelsis resource_profile missing crafted Arms (#59)"
  );

  const profCheckRes = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE profession = 'Fisherman' AND life_stage = 'ADULT')::int AS fishermen,
       COUNT(*) FILTER (WHERE profession = 'Armorer' AND life_stage = 'ADULT')::int AS armorers,
       COUNT(*) FILTER (WHERE profession = 'Tanner' AND life_stage = 'ADULT')::int AS tanners,
       COUNT(*) FILTER (WHERE profession = 'Woodcutter' AND life_stage = 'ADULT')::int AS woodcutters,
       COUNT(*) FILTER (WHERE profession = 'Merchant Factor' AND life_stage = 'ADULT')::int AS merchants,
       COUNT(*) FILTER (WHERE profession = 'Caravan Drover' AND life_stage = 'ADULT')::int AS drovers,
       COUNT(*) FILTER (WHERE profession = 'Aether-Crew' AND life_stage = 'ADULT')::int AS skycrew,
       COUNT(*) FILTER (WHERE life_stage = 'ADULT' AND workplace_type IS NULL)::int AS missing_wp
     FROM population_demographics
     WHERE settlement_id = 1 AND allegiance_status = 'CIVILIAN'`
  );
  const pc = profCheckRes.rows[0];
  assert.equal(Number(pc.fishermen), 0, `Landlocked Excelsis should have 0 Fishermen, got ${pc.fishermen}`);
  assert.ok(Number(pc.armorers) > 0, "Excelsis missing Armorer adults");
  assert.ok(Number(pc.tanners) > 0, "Excelsis missing Tanner adults");
  assert.ok(Number(pc.woodcutters) > 0, "Excelsis missing Woodcutter adults");
  assert.ok(Number(pc.merchants) > 0 && Number(pc.drovers) > 0 && Number(pc.skycrew) > 0, "Excelsis missing logistics crew");
  assert.equal(Number(pc.missing_wp), 0, "Excelsis adults missing workplace_type");

  await pool.query("SAVEPOINT eco_clean_check");
  await runBurgOperationsAgent(pool, baseTick + 1, "CitizenEco Check");
  const excAfterTick = await getStockpile(1);
  assert.ok(!("foraged_food" in excAfterTick), "foraged_food should not be produced");
  assert.ok(!("scrap" in excAfterTick), "scrap should not be produced");
  assert.ok(!("trinkets" in excAfterTick), "trinkets should not be produced");
  assert.ok((excAfterTick.wood || 0) > 0, "Excelsis should hold real wood stock");
  await pool.query("ROLLBACK TO SAVEPOINT eco_clean_check");
  console.log("2. Excelsis profile, professions, logistics crew & real goods (zero fake fallback)... PASSED");

  // 3. No worker = no resource (Woodcutters -> wood)
  await pool.query("SAVEPOINT eco_wood_base");
  await setExcelsisStockpile({ wood: 10, iron: 50, coal: 50, leather: 50, grain: 50 });
  await runBurgOperationsAgent(pool, baseTick + 1, "WoodBase");
  const woodBaseInv = await getStockpile(1);
  const woodBaseGain = (woodBaseInv.wood || 0) - 10;
  assert.ok(woodBaseGain > 0, `Expected positive wood gain with living Woodcutters, got ${woodBaseGain}`);
  await pool.query("ROLLBACK TO SAVEPOINT eco_wood_base");

  await pool.query("SAVEPOINT eco_no_woodcutters");
  await setExcelsisStockpile({ wood: 10, iron: 50, coal: 50, leather: 50, grain: 50 });
  await pool.query(
    `UPDATE population_demographics SET allegiance_status = 'DECEASED'
     WHERE settlement_id = 1 AND life_stage = 'ADULT' AND profession = 'Woodcutter'`
  );
  await runBurgOperationsAgent(pool, baseTick + 1, "NoWoodcutters");
  const noWoodInv = await getStockpile(1);
  assert.equal(noWoodInv.wood || 0, 10, `Expected 0 wood gain when Woodcutters absent, got ${(noWoodInv.wood || 0) - 10}`);
  await pool.query("ROLLBACK TO SAVEPOINT eco_no_woodcutters");
  console.log("3. No worker = no resource (Woodcutters control Wood output)... PASSED");

  // 4. Recipe crafting requires BOTH inputs and living crafters (Armorers -> Arms)
  await pool.query("SAVEPOINT eco_arms_ok");
  await setExcelsisStockpile({ wood: 20, iron: 50, coal: 50, leather: 50, arms: 0 });
  await runBurgOperationsAgent(pool, baseTick + 1, "ArmsOk");
  const armsOkInv = await getStockpile(1);
  assert.ok((armsOkInv.arms || 0) > 0, `Expected Arms crafted when inputs & Armorers present, got ${armsOkInv.arms}`);
  assert.ok((armsOkInv.iron || 0) < 50 && (armsOkInv.coal || 0) < 50, "Expected Iron & Coal consumed for Arms");
  await pool.query("ROLLBACK TO SAVEPOINT eco_arms_ok");

  await pool.query("SAVEPOINT eco_arms_no_iron");
  await setExcelsisStockpile({ wood: 20, iron: 0, bronze: 0, coal: 50, leather: 50, arms: 0 });
  await runBurgOperationsAgent(pool, baseTick + 1, "ArmsNoIron");
  const armsNoIronInv = await getStockpile(1);
  assert.equal(armsNoIronInv.arms || 0, 0, `Expected 0 Arms crafted with 0 Iron/Bronze, got ${armsNoIronInv.arms}`);
  await pool.query("ROLLBACK TO SAVEPOINT eco_arms_no_iron");

  await pool.query("SAVEPOINT eco_arms_no_crafters");
  await setExcelsisStockpile({ wood: 20, iron: 50, coal: 50, leather: 50, arms: 0 });
  await pool.query(
    `UPDATE population_demographics SET allegiance_status = 'DECEASED'
     WHERE settlement_id = 1 AND life_stage = 'ADULT' AND profession = 'Armorer'`
  );
  await runBurgOperationsAgent(pool, baseTick + 1, "ArmsNoCrafters");
  const armsNoCraftInv = await getStockpile(1);
  assert.equal(armsNoCraftInv.arms || 0, 0, `Expected 0 Arms crafted when all Armorers absent, got ${armsNoCraftInv.arms}`);
  await pool.query("ROLLBACK TO SAVEPOINT eco_arms_no_crafters");
  console.log("4. Strict recipe gate (inputs + living Armorers required for Arms)... PASSED");

  // 5. High unrest / hindrance reduces worker output proportionally
  await pool.query("SAVEPOINT eco_unrest");
  await pool.query(`UPDATE sim_burg_economy SET unrest = 85 WHERE burg_id = 1`);
  await setExcelsisStockpile({ wood: 10, iron: 50, coal: 50, leather: 50, grain: 50 });
  await runBurgOperationsAgent(pool, baseTick + 1, "RiotHindrance");
  const riotInv = await getStockpile(1);
  const riotWoodGain = (riotInv.wood || 0) - 10;
  assert.ok(riotWoodGain > 0 && riotWoodGain < woodBaseGain, `Expected hindered wood gain < ${woodBaseGain}, got ${riotWoodGain}`);
  await pool.query("ROLLBACK TO SAVEPOINT eco_unrest");
  console.log(`5. Civil unrest hindrance lowers output cleanly (${woodBaseGain} -> ${riotWoodGain} wood)... PASSED`);

  // 6. All 31 regional markets update prices from real stock + sync sim_commodity_prices
  await pool.query("SAVEPOINT eco_markets");
  const mktOut = await updateRegionalMarkets(pool, baseTick + 7);
  assert.equal(mktOut.marketsUpdated, 31, `Expected 31 markets updated, got ${mktOut.marketsUpdated}`);
  assert.ok(mktOut.commoditiesUpdated > 0, "Expected sim_commodity_prices updated");
  const m1Res = await pool.query(`SELECT goods FROM sim_markets WHERE id = 1`);
  const m1Goods = typeof m1Res.rows[0].goods === "string" ? JSON.parse(m1Res.rows[0].goods) : m1Res.rows[0].goods;
  assert.ok(Number(m1Goods["1"]?.stock) > 0 && Number(m1Goods["1"]?.price) > 0, "Market #1 Wood stock/price missing");
  const cpRes = await pool.query(`SELECT commodity, global_supply FROM sim_commodity_prices WHERE commodity IN ('wood', 'grain')`);
  for (const row of cpRes.rows) {
    assert.ok(Number(row.global_supply) > 0, `sim_commodity_prices global_supply=0 for ${row.commodity}`);
  }
  await pool.query("ROLLBACK TO SAVEPOINT eco_markets");
  console.log("6. All 31 regional markets & sim_commodity_prices updated from real stocks... PASSED");

  console.log("\nALL CITIZEN ECONOMY TESTS PASSED");
}

isolateTest()
  .then((done) => main().then(done, async (e: unknown) => { await done(); throw e; }))
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("CITIZEN ECONOMY TEST FAILED - COMMIT BLOCKED:", err.message || err);
    process.exit(1);
  });
