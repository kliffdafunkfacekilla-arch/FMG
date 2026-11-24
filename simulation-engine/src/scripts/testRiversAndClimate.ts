import assert from "node:assert/strict";
import pool from "../db/pool.js";
import { isolateTest } from "./testIsolation.js";
import { applySchemaPatches } from "../db/schemaPatches.js";
import {
  computeClimateHarvestModifier,
  runBurgOperationsAgent,
} from "../engine/agents/burgOperationsAgent.js";
import { runWeatherAgent } from "../engine/agents/weatherAgent.js";
import { addCellTags } from "../engine/cellTags.js";
import {
  computeRiverTollForPath,
  ensureRouteGraphCache,
  findTradeRoute,
} from "../engine/economy/routeGraphRouter.js";
import { runSeeded, tickSeed } from "../engine/rng.js";

async function main() {
  console.log("=== Testing Rivers, Hydrology Flux & Climate Variance (B6.4) ===");
  await applySchemaPatches(pool);

  const calRes = await pool.query(`SELECT COALESCE(MAX(tick), 1)::int AS t FROM sim_calendar`);
  const baseTick = Number(calRes.rows[0].t) || 1;
  // Pick a non-weekly tick so workforce cache is deterministic and clean
  const probeTick = (baseTick % 7 === 6) ? baseTick + 2 : baseTick + 1;

  // ---------------------------------------------------------------------------
  // 1. Harvest variance from `current_temp`, `river_id`, `flux`, and #RiverFlooding
  // ---------------------------------------------------------------------------
  const alluvialMod = computeClimateHarvestModifier({ currentTemp: 18, cellFlux: 45, riverId: 10, riverDischarge: 600, isFlooded: false, isDrought: false });
  const temperateMod = computeClimateHarvestModifier({ currentTemp: 18, cellFlux: 8, riverId: 0, riverDischarge: 0, isFlooded: false, isDrought: false });
  const frozenAridMod = computeClimateHarvestModifier({ currentTemp: -10, cellFlux: 0, riverId: 0, riverDischarge: 0, isFlooded: false, isDrought: true });
  const floodedMod = computeClimateHarvestModifier({ currentTemp: 18, cellFlux: 50, riverId: 10, riverDischarge: 600, isFlooded: true, isDrought: false });
  assert.ok(alluvialMod > temperateMod && temperateMod > floodedMod && floodedMod > frozenAridMod, "Expected alluvial > temperate > flooded > frozenArid");

  // Locate a real burg with food producers
  const farmBurgRes = await pool.query(`
    SELECT b.burg_id, b.cell_id
    FROM sim_burg_economy b
    JOIN population_demographics pd ON pd.settlement_id = b.burg_id
    WHERE pd.life_stage = 'ADULT' AND pd.allegiance_status = 'CIVILIAN'
      AND pd.profession IN ('Grain Farmer', 'Livestock Herder', 'Fisherman', 'Fruit Grower')
      AND b.pop_null > 50
    GROUP BY b.burg_id, b.cell_id
    ORDER BY COUNT(*) DESC, b.burg_id ASC
    LIMIT 1
  `);
  const farmBurg = farmBurgRes.rows[0];
  assert.ok(farmBurg, "Expected a farming burg in live DB");
  const realRiver = (await pool.query(`SELECT id, name, discharge FROM sim_rivers WHERE discharge >= 500 ORDER BY id ASC LIMIT 1`)).rows[0];
  assert.ok(realRiver, "Expected a high-discharge river in sim_rivers");

  await pool.query("SAVEPOINT river_harvest_warm");
  await pool.query(`UPDATE sim_burg_economy SET food = 1000, unrest = 0, health = 100 WHERE burg_id = $1`, [farmBurg.burg_id]);
  await pool.query(`UPDATE sim_cells SET current_temp = 18, flux = 50, river_id = $2 WHERE id = $1`, [farmBurg.cell_id, realRiver.id]);
  await runSeeded(tickSeed(probeTick), () => runBurgOperationsAgent(pool, probeTick, "Warm Alluvial"));
  const warmFood = Number((await pool.query(`SELECT food FROM sim_burg_economy WHERE burg_id = $1`, [farmBurg.burg_id])).rows[0].food);
  await pool.query("ROLLBACK TO SAVEPOINT river_harvest_warm");

  await pool.query("SAVEPOINT river_harvest_cold");
  await pool.query(`UPDATE sim_burg_economy SET food = 1000, unrest = 0, health = 100 WHERE burg_id = $1`, [farmBurg.burg_id]);
  await pool.query(`UPDATE sim_cells SET current_temp = -12, flux = 0, river_id = 0 WHERE id = $1`, [farmBurg.cell_id]);
  await addCellTags(pool, Number(farmBurg.cell_id), ["#DroughtStricken"]);
  await runSeeded(tickSeed(probeTick), () => runBurgOperationsAgent(pool, probeTick, "Frozen Arid"));
  const coldFood = Number((await pool.query(`SELECT food FROM sim_burg_economy WHERE burg_id = $1`, [farmBurg.burg_id])).rows[0].food);
  await pool.query("ROLLBACK TO SAVEPOINT river_harvest_cold");

  await pool.query("SAVEPOINT river_harvest_flood");
  await pool.query(`UPDATE sim_burg_economy SET food = 1000, unrest = 0, health = 100 WHERE burg_id = $1`, [farmBurg.burg_id]);
  await pool.query(`UPDATE sim_cells SET current_temp = 18, flux = 50, river_id = $2 WHERE id = $1`, [farmBurg.cell_id, realRiver.id]);
  await addCellTags(pool, Number(farmBurg.cell_id), ["#RiverFlooding"]);
  await runSeeded(tickSeed(probeTick), () => runBurgOperationsAgent(pool, probeTick, "River Flooded"));
  const floodFood = Number((await pool.query(`SELECT food FROM sim_burg_economy WHERE burg_id = $1`, [farmBurg.burg_id])).rows[0].food);
  await pool.query("ROLLBACK TO SAVEPOINT river_harvest_flood");

  assert.ok(warmFood > floodFood && warmFood > coldFood, `Expected warm alluvial food (${warmFood}) > flooded (${floodFood}) and frozen arid (${coldFood})`);
  console.log(`1. Harvest variance: warm alluvial (${warmFood}) > flooded (${floodFood}) & frozen arid (${coldFood})... PASSED`);

  // ---------------------------------------------------------------------------
  // 2. River flooding under HURRICANE & drought buffering vs arid burg
  // ---------------------------------------------------------------------------
  const riverBurg = (await pool.query(`
    SELECT b.burg_id, b.name, c.id AS cell_id, c.center_x, c.center_y, r.name AS river_name
    FROM sim_burg_economy b
    JOIN sim_cells c ON b.cell_id = c.id
    JOIN sim_rivers r ON r.id = c.river_id
    WHERE (b.pop_null > 0 OR COALESCE(b.pop_attuned, 0) > 0) AND r.discharge >= 150
    ORDER BY r.discharge DESC, b.burg_id ASC LIMIT 1
  `)).rows[0];
  const aridBurg = (await pool.query(`
    SELECT b.burg_id, b.name, c.id AS cell_id, c.center_x, c.center_y
    FROM sim_burg_economy b
    JOIN sim_cells c ON b.cell_id = c.id
    WHERE (b.pop_null > 0 OR COALESCE(b.pop_attuned, 0) > 0) AND COALESCE(c.river_id, 0) = 0 AND COALESCE(c.flux, 0) <= 3
    ORDER BY b.burg_id ASC LIMIT 1
  `)).rows[0];
  assert.ok(riverBurg && aridBurg, "Expected both a high-discharge river burg and an arid burg");

  const bounds = (await pool.query(`
    SELECT MIN(center_x) min_x, MAX(center_x) max_x, MIN(center_y) min_y, MAX(center_y) max_y FROM sim_cells
  `)).rows[0];
  const toFrontXY = (cx: number, cy: number) => ({
    fx: ((cx - Number(bounds.min_x)) / Math.max(1, Number(bounds.max_x) - Number(bounds.min_x))) * 100,
    fy: ((cy - Number(bounds.min_y)) / Math.max(1, Number(bounds.max_y) - Number(bounds.min_y))) * 100,
  });

  await pool.query("SAVEPOINT river_flood_front");
  await pool.query(`DELETE FROM sim_weather_fronts`);
  await pool.query(`DELETE FROM sim_events WHERE tick = $1`, [probeTick]);
  const rCoord = toFrontXY(Number(riverBurg.center_x), Number(riverBurg.center_y));
  await pool.query(
    `INSERT INTO sim_weather_fronts (type, x, y, dx, dy, radius, lifetime) VALUES ('HURRICANE', $1, $2, 0, 0, 1.5, 5)`,
    [rCoord.fx, rCoord.fy]
  );
  await runSeeded(tickSeed(probeTick), () => runWeatherAgent(pool, probeTick, "Dimburn", 10, "Flood Probe", false));
  const floodEv = await pool.query(
    `SELECT message FROM sim_events WHERE tick = $1 AND burg_id = $2 AND type = 'HURRICANE' ORDER BY id DESC LIMIT 1`,
    [probeTick, riverBurg.burg_id]
  );
  assert.ok(floodEv.rows[0] && String(floodEv.rows[0].message).includes(String(riverBurg.river_name)), `Expected HURRICANE flood event naming ${riverBurg.river_name}`);
  await pool.query("ROLLBACK TO SAVEPOINT river_flood_front");

  await pool.query("SAVEPOINT river_drought_compare");
  await pool.query(`DELETE FROM sim_weather_fronts`);
  await pool.query(`UPDATE sim_burg_economy SET pop_null = 500, food = 2000, unrest = 0 WHERE burg_id IN ($1, $2)`, [riverBurg.burg_id, aridBurg.burg_id]);
  const aCoord = toFrontXY(Number(aridBurg.center_x), Number(aridBurg.center_y));
  await pool.query(
    `INSERT INTO sim_weather_fronts (type, x, y, dx, dy, radius, lifetime) VALUES ('DROUGHT', $1, $2, 0, 0, 1.5, 5), ('DROUGHT', $3, $4, 0, 0, 1.5, 5)`,
    [rCoord.fx, rCoord.fy, aCoord.fx, aCoord.fy]
  );
  await runSeeded(tickSeed(probeTick), () => runWeatherAgent(pool, probeTick, "Dryspell", 10, "Drought Probe", false));
  const riverFoodAfter = Number((await pool.query(`SELECT food FROM sim_burg_economy WHERE burg_id = $1`, [riverBurg.burg_id])).rows[0].food);
  const aridFoodAfter = Number((await pool.query(`SELECT food FROM sim_burg_economy WHERE burg_id = $1`, [aridBurg.burg_id])).rows[0].food);
  assert.ok(riverFoodAfter > aridFoodAfter, `Expected river-irrigated burg (${riverFoodAfter}) to lose less food to DROUGHT than arid (${aridFoodAfter})`);
  await pool.query("ROLLBACK TO SAVEPOINT river_drought_compare");
  console.log(`2. River flood (${riverBurg.river_name}) & drought irrigation (${riverFoodAfter} vs ${aridFoodAfter}) verified... PASSED`);

  // ---------------------------------------------------------------------------
  // 3. River crossing tolls on `sim_route_graph`
  // ---------------------------------------------------------------------------
  await ensureRouteGraphCache(pool);
  const burgCells = (await pool.query(`SELECT burg_id, cell_id FROM sim_burg_economy ORDER BY burg_id ASC LIMIT 25`)).rows;
  let tollSample: { crossings: number; riverTollGold: number } | null = null;
  let samplePath: number[] = [];
  for (let i = 0; i < burgCells.length && !tollSample; i++) {
    for (let j = i + 1; j < burgCells.length && !tollSample; j++) {
      const plan = await findTradeRoute(pool, {
        fromCellId: Number(burgCells[i].cell_id),
        toCellId: Number(burgCells[j].cell_id),
        allowedModes: ["LAND"],
      });
      if (!plan) continue;
      const toll = computeRiverTollForPath(plan.pathCells, "LAND");
      if (toll.crossings > 0) {
        tollSample = toll;
        samplePath = plan.pathCells;
      }
    }
  }
  assert.ok(tollSample && tollSample.riverTollGold > 0, "Expected at least one overland LAND route crossing a major river with positive toll");
  assert.equal(computeRiverTollForPath(samplePath, "AIR").riverTollGold, 0, "AIR convoys must pay 0 river crossing tolls");
  console.log(`3. Overland route river crossings (${tollSample.crossings} rivers -> ${tollSample.riverTollGold}g toll, 0g by AIR)... PASSED`);

  console.log("\nALL RIVER & CLIMATE TESTS PASSED");
}

isolateTest()
  .then((done) => main().then(done, async (e: unknown) => { await done(); throw e; }))
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("RIVER & CLIMATE TEST FAILED - COMMIT BLOCKED:", err.message || err);
    process.exit(1);
  });
