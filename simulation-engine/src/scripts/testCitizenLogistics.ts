import assert from "node:assert/strict";
import pool from "../db/pool.js";
import { isolateTest } from "./testIsolation.js";
import { migrate } from "../db/migrate.js";
import {
  findTradeRoute,
  advanceAlongPath,
  distBetweenCells,
  MAX_CONVOY_STEP_UNITS,
  TransportMode,
} from "../engine/economy/routeGraphRouter.js";
import { runInterFactionTradeEngine } from "../engine/economy/interFactionTradeEngine.js";
import { openWorldEventThreads } from "../engine/threads/worldThreads.js";
import { validateActorIds } from "../engine/threads/threadEngine.js";
import { runSeeded, tickSeed } from "../engine/rng.js";
import { addCellTags } from "../engine/cellTags.js";

async function getInv(burgId: number): Promise<Record<string, number>> {
  const r = await pool.query(`SELECT complex_inventory FROM sim_industrial_stockpiles WHERE burg_id = $1`, [burgId]);
  const raw = r.rows[0]?.complex_inventory;
  if (!raw) return {};
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

async function pickCrew(burgId: number, modeProf: "Caravan Drover" | "Sailor" | "Aether-Crew") {
  const m = await pool.query(
    `SELECT citizen_id FROM population_demographics
     WHERE settlement_id = $1 AND life_stage = 'ADULT' AND allegiance_status = 'CIVILIAN'
       AND profession IN ('Merchant Factor', 'Merchant Trader')
     ORDER BY citizen_id ASC LIMIT 1`,
    [burgId]
  );
  const c = await pool.query(
    `SELECT citizen_id FROM population_demographics
     WHERE settlement_id = $1 AND life_stage = 'ADULT' AND allegiance_status = 'CIVILIAN'
       AND profession = $2
     ORDER BY citizen_id ASC LIMIT 1`,
    [burgId, modeProf]
  );
  if (!m.rows[0] || !c.rows[0]) return null;
  return { merchantId: Number(m.rows[0].citizen_id), crewId: Number(c.rows[0].citizen_id) };
}

async function main() {
  console.log("=== Testing Citizen-Crewed Physical Logistics & Route Graph Trade ===");
  await migrate(pool);

  const calRes = await pool.query(`SELECT COALESCE(MAX(tick), 1)::int AS tick FROM sim_calendar`);
  const baseTick = Number(calRes.rows[0].tick) || 1;

  // ---------------------------------------------------------------------------
  // 1. Route-graph LAND, SEA, AIR paths + discrete single-tick step <= 65 units
  // ---------------------------------------------------------------------------
  const landPlan = await findTradeRoute(pool, {
    fromCellId: 30627, // Excelsis Citadel
    toCellId: 28002,   // Peculiurus Spire
    allowedModes: ["LAND"],
  });
  assert.ok(landPlan && landPlan.pathCells.length > 5, "Expected LAND route from Excelsis to Peculiurus Spire");

  const airPlan = await findTradeRoute(pool, {
    fromCellId: 30627, // Excelsis Citadel
    toCellId: 1192,    // The Flotilla (sky hub off sim_route_graph)
    allowedModes: ["AIR"],
  });
  assert.ok(airPlan && airPlan.mode === "AIR" && airPlan.pathCells.length > 5, "Expected AIR route to The Flotilla");

  // Find a genuine SEA route connecting two ports
  const portRes = await pool.query(
    `SELECT burg_id, cell_id FROM sim_burg_economy WHERE port = true ORDER BY burg_id LIMIT 12`
  );
  let seaPlan: Awaited<ReturnType<typeof findTradeRoute>> = null;
  for (let i = 0; i < portRes.rows.length && !seaPlan; i++) {
    for (let j = i + 1; j < portRes.rows.length && !seaPlan; j++) {
      const candidate = await findTradeRoute(pool, {
        fromCellId: Number(portRes.rows[i].cell_id),
        toCellId: Number(portRes.rows[j].cell_id),
        allowedModes: ["SEA"],
      });
      if (candidate && candidate.usesSea && candidate.pathCells.length >= 4) {
        seaPlan = candidate;
      }
    }
  }
  assert.ok(seaPlan && seaPlan.usesSea, "Expected a valid SEA route between coastal ports");

  for (const plan of [landPlan, airPlan, seaPlan]) {
    let idx = 0;
    let ticks = 0;
    while (idx < plan.pathCells.length - 1) {
      const step = advanceAlongPath(plan.pathCells, idx, plan.mode);
      assert.ok(step.nextIndex > idx, `${plan.mode} convoy stalled at index ${idx}`);
      const disp = distBetweenCells(plan.pathCells[idx]!, step.nextCellId);
      // Bounded multi-hop step must never exceed Rule 9 MAX_CONVOY_STEP_UNITS (65) unless forced over a single long graph link
      if (step.visitedCells.length > 1) {
        assert.ok(
          disp <= MAX_CONVOY_STEP_UNITS + 0.01,
          `${plan.mode} multi-hop step moved ${disp.toFixed(2)} > ${MAX_CONVOY_STEP_UNITS}`
        );
      }
      idx = step.nextIndex;
      ticks++;
      assert.ok(ticks < 500, `${plan.mode} convoy exceeded max test ticks`);
    }
    assert.ok(Math.abs(ticks - plan.etaTicks) <= Math.max(3, Math.ceil(plan.etaTicks * 0.45)), "ETA out of range");
  }
  console.log("1. LAND / SEA / AIR routing & discrete single-tick step bounds (<= 65 units)... PASSED");

  // ---------------------------------------------------------------------------
  // 2. Zero instant teleport on dispatch + crew status transition (CIVILIAN -> ON_CARAVAN)
  // ---------------------------------------------------------------------------
  await pool.query("SAVEPOINT logistics_dispatch");
  await pool.query(`DELETE FROM sim_trade_shipments`);
  const preInvRes = await pool.query(`SELECT burg_id, complex_inventory FROM sim_industrial_stockpiles`);
  const preInvMap = new Map<number, Record<string, number>>();
  for (const r of preInvRes.rows) {
    const parsed = typeof r.complex_inventory === "string" ? JSON.parse(r.complex_inventory) : (r.complex_inventory || {});
    preInvMap.set(Number(r.burg_id), parsed);
  }
  const beforeShipRes = await runSeeded(tickSeed(baseTick + 1), () =>
    runInterFactionTradeEngine(pool, baseTick + 1, "Dispatch Check")
  );
  assert.ok(beforeShipRes.shipmentsDispatched > 0, "Expected at least 1 convoy dispatched");

  const activeShips = await pool.query(`SELECT * FROM sim_trade_shipments WHERE status = 'IN_TRANSIT' ORDER BY id ASC`);
  assert.ok(activeShips.rows.length > 0, "Expected IN_TRANSIT rows in sim_trade_shipments");

  // Verify cargo was deducted from source into caravan escrow and NOT teleported to destination
  const firstShip = activeShips.rows[0];
  const sKey = String(firstShip.good_key);
  const srcId = Number(firstShip.source_burg_id);
  const dstId = Number(firstShip.dest_burg_id);
  const qty = Number(firstShip.quantity);
  const srcInvAfter = await getInv(srcId);
  const dstInvAfter = await getInv(dstId);
  assert.ok(
    (srcInvAfter[sKey] || 0) <= (preInvMap.get(srcId)?.[sKey] || 0) - qty,
    `Source burg ${srcId} failed to escrow ${qty} ${sKey} onto departing caravan`
  );
  assert.equal(
    dstInvAfter[sKey] || 0,
    preInvMap.get(dstId)?.[sKey] || 0,
    `Teleport bug: destination burg ${dstId} received ${sKey} while shipment is still IN_TRANSIT`
  );
  assert.equal(Number(firstShip.current_cell_id), Number(firstShip.path_cells[0]), "Dispatched shipment should start at origin cell");
  const crewIds = [Number(firstShip.merchant_citizen_id), ...(Array.isArray(firstShip.crew_citizen_ids) ? firstShip.crew_citizen_ids.map(Number) : [])];
  assert.ok(crewIds.length >= 2, "Expected merchant + at least 1 crew citizen assigned to shipment");
  const crewCheck = await pool.query(
    `SELECT citizen_id, allegiance_status FROM population_demographics WHERE citizen_id = ANY($1::int[])`,
    [crewIds]
  );
  assert.equal(crewCheck.rows.length, crewIds.length, "Rule 7 violation: non-existent citizen assigned to caravan");
  assert.ok(
    crewCheck.rows.every((r: any) => r.allegiance_status === "ON_CARAVAN"),
    "Assigned caravan crew must transition from CIVILIAN to ON_CARAVAN"
  );
  await pool.query("ROLLBACK TO SAVEPOINT logistics_dispatch");
  console.log("2. Zero instant teleport on dispatch & real crew marked ON_CARAVAN... PASSED");

  // ---------------------------------------------------------------------------
  // 3. Strict living-crew gating (no Merchant/Drover/Aether/Sailor -> zero dispatch)
  // ---------------------------------------------------------------------------
  await pool.query("SAVEPOINT logistics_no_crew");
  await pool.query(`DELETE FROM sim_trade_shipments`);
  // Isolate a single surplus seller of 'coal' (Hidden Lagoon #24) and strip Excelsis (#1) coal to 0
  await pool.query(`UPDATE sim_industrial_stockpiles SET complex_inventory = '{"wood": 500, "coal": 0, "iron": 0, "leather": 0}' WHERE burg_id != 24`);
  await pool.query(`UPDATE sim_industrial_stockpiles SET complex_inventory = '{"coal": 900}' WHERE burg_id = 24`);
  await pool.query(
    `UPDATE population_demographics SET allegiance_status = 'DEPARTED'
     WHERE settlement_id = 24 AND profession IN ('Merchant Factor', 'Merchant Trader', 'Caravan Drover', 'Sailor', 'Aether-Crew')`
  );
  await runSeeded(tickSeed(baseTick + 2), () => runInterFactionTradeEngine(pool, baseTick + 2, "NoCrewCheck"));
  const noCrewShips = await pool.query(`SELECT COUNT(*)::int AS c FROM sim_trade_shipments WHERE source_burg_id = 24`);
  assert.equal(Number(noCrewShips.rows[0].c), 0, "Burg 24 dispatched cargo without any living logistics crew!");
  await pool.query("ROLLBACK TO SAVEPOINT logistics_no_crew");
  console.log("3. Strict living-crew gating (zero logistics crew = zero dispatch)... PASSED");

  // ---------------------------------------------------------------------------
  // 4. Physical arrival delivers cargo, settles wealth & faction tariffs, releases crew
  // ---------------------------------------------------------------------------
  await pool.query("SAVEPOINT logistics_arrival");
  await pool.query(`DELETE FROM sim_trade_shipments`);
  const foreignRes = await pool.query(
    `SELECT b.burg_id, b.cell_id, b.wealth, COALESCE(c.faction_id, 0)::int AS faction_id
     FROM sim_burg_economy b
     JOIN sim_cells c ON c.id = b.cell_id
     WHERE b.burg_id != 1 AND COALESCE(c.faction_id, 0) > 0 AND c.faction_id != 29
     ORDER BY b.burg_id ASC LIMIT 10`
  );
  let arrivalSource: any = null;
  let arrivalRoute: Awaited<ReturnType<typeof findTradeRoute>> = null;
  let arrivalCrew: { merchantId: number; crewId: number } | null = null;
  for (const cand of foreignRes.rows) {
    const r = await findTradeRoute(pool, { fromCellId: Number(cand.cell_id), toCellId: 30627, allowedModes: ["LAND", "SEA", "AIR"] });
    const prof = r?.mode === "SEA" ? "Sailor" : r?.mode === "AIR" ? "Aether-Crew" : "Caravan Drover";
    const cr = r ? await pickCrew(Number(cand.burg_id), prof) : null;
    if (r && r.pathCells.length >= 2 && cr) {
      arrivalSource = cand;
      arrivalRoute = r;
      arrivalCrew = cr;
      break;
    }
  }
  assert.ok(arrivalSource && arrivalRoute && arrivalCrew, "Failed to find foreign supplier & crew for arrival test");

  await pool.query(`UPDATE sim_burg_economy SET wealth = 500 WHERE burg_id = 1`);
  await pool.query(`UPDATE population_demographics SET allegiance_status = 'ON_CARAVAN' WHERE citizen_id IN ($1, $2)`, [arrivalCrew.merchantId, arrivalCrew.crewId]);
  const excInvBefore = await getInv(1);
  const srcWealthBefore = Number((await pool.query(`SELECT wealth FROM sim_burg_economy WHERE burg_id = $1`, [arrivalSource.burg_id])).rows[0].wealth);
  const treasuryBefore = Number((await pool.query(`SELECT treasury FROM sim_factions WHERE id = 29`)).rows[0].treasury);
  const oneHopIdx = arrivalRoute.pathCells.length - 2;
  const shipIns = await pool.query(
    `INSERT INTO sim_trade_shipments (
       source_burg_id, dest_burg_id, source_faction_id, dest_faction_id,
       transport_mode, good_id, good_key, good_name, quantity, unit_price,
       total_gold, tariff_gold, carriage_weight, merchant_citizen_id,
       crew_citizen_ids, guard_count, path_cells, path_index, current_cell_id,
       status, dispatched_tick, eta_ticks
     ) VALUES ($1, 1, $2, 29, $3, 34, 'coal', 'Coal', 12, 8, 100, 12, 7.2, $4, $5::jsonb, 1, $6::jsonb, $7, $8, 'IN_TRANSIT', $9, 1)
     RETURNING id`,
    [
      arrivalSource.burg_id,
      arrivalSource.faction_id,
      arrivalRoute.mode,
      arrivalCrew.merchantId,
      JSON.stringify([arrivalCrew.crewId]),
      JSON.stringify(arrivalRoute.pathCells),
      oneHopIdx,
      arrivalRoute.pathCells[oneHopIdx],
      baseTick,
    ]
  );
  const arrivalShipId = Number(shipIns.rows[0].id);

  await runSeeded(tickSeed(baseTick + 1), () => runInterFactionTradeEngine(pool, baseTick + 1, "Arrival Check"));

  const deliveredRow = (await pool.query(`SELECT status, resolved_tick FROM sim_trade_shipments WHERE id = $1`, [arrivalShipId])).rows[0];
  assert.equal(deliveredRow.status, "DELIVERED", `Expected DELIVERED status, got ${deliveredRow.status}`);
  const excInvAfter = await getInv(1);
  assert.equal((excInvAfter.coal || 0) - (excInvBefore.coal || 0), 12, "Excelsis stockpile did not receive exact delivered coal");
  const srcWealthAfter = Number((await pool.query(`SELECT wealth FROM sim_burg_economy WHERE burg_id = $1`, [arrivalSource.burg_id])).rows[0].wealth);
  const treasuryAfter = Number((await pool.query(`SELECT treasury FROM sim_factions WHERE id = 29`)).rows[0].treasury);
  assert.ok(srcWealthAfter - srcWealthBefore >= 88, "Seller did not receive net gold proceeds on delivery");
  assert.ok(treasuryAfter - treasuryBefore >= 12, "Avian Empire treasury did not receive customs tariff on arrival");
  const relCrew = await pool.query(`SELECT allegiance_status FROM population_demographics WHERE citizen_id IN ($1, $2)`, [arrivalCrew.merchantId, arrivalCrew.crewId]);
  assert.ok(relCrew.rows.every((r: any) => r.allegiance_status === "CIVILIAN"), "Delivered crew did not return to CIVILIAN");
  await pool.query("ROLLBACK TO SAVEPOINT logistics_arrival");
  console.log("4. Physical arrival credits cargo, settles gold & tariffs, and frees crew... PASSED");

  // ---------------------------------------------------------------------------
  // 5. Wartime embargo aborts transit & opens valid WORLD_TRADE_CHOKEPOINT thread
  // ---------------------------------------------------------------------------
  await pool.query("SAVEPOINT logistics_war");
  await pool.query(`DELETE FROM sim_trade_shipments`);
  await pool.query(`DELETE FROM sim_threads`);
  await pool.query(`DELETE FROM sim_events WHERE tick = $1`, [baseTick + 1]);
  await pool.query(`UPDATE population_demographics SET allegiance_status = 'ON_CARAVAN' WHERE citizen_id IN ($1, $2)`, [arrivalCrew.merchantId, arrivalCrew.crewId]);

  const fMin = Math.min(29, arrivalSource.faction_id);
  const fMax = Math.max(29, arrivalSource.faction_id);
  await pool.query(
    `DELETE FROM sim_diplomacy WHERE (faction_a_id = $1 AND faction_b_id = $2) OR (faction_a_id = $2 AND faction_b_id = $1)`,
    [fMin, fMax]
  );
  await pool.query(`INSERT INTO sim_diplomacy (faction_a_id, faction_b_id, status, tension) VALUES ($1, $2, 'WAR', 100)`, [fMin, fMax]);

  const warShip = await pool.query(
    `INSERT INTO sim_trade_shipments (
       source_burg_id, dest_burg_id, source_faction_id, dest_faction_id,
       transport_mode, good_id, good_key, good_name, quantity, unit_price,
       total_gold, tariff_gold, carriage_weight, merchant_citizen_id,
       crew_citizen_ids, guard_count, path_cells, path_index, current_cell_id,
       status, dispatched_tick, eta_ticks
     ) VALUES ($1, 1, $2, 29, $3, 34, 'coal', 'Coal', 10, 8, 80, 4, 6.0, $4, $5::jsonb, 0, $6::jsonb, 0, $7, 'IN_TRANSIT', $8, $9)
     RETURNING id`,
    [
      arrivalSource.burg_id,
      arrivalSource.faction_id,
      arrivalRoute.mode,
      arrivalCrew.merchantId,
      JSON.stringify([arrivalCrew.crewId]),
      JSON.stringify(arrivalRoute.pathCells),
      arrivalRoute.pathCells[0],
      baseTick,
      arrivalRoute.etaTicks,
    ]
  );
  const warShipId = Number(warShip.rows[0].id);

  await runSeeded(tickSeed(baseTick + 1), () => runInterFactionTradeEngine(pool, baseTick + 1, "War Embargo Check"));

  const abortedRow = (await pool.query(`SELECT status FROM sim_trade_shipments WHERE id = $1`, [warShipId])).rows[0];
  assert.equal(abortedRow.status, "ABORTED", `Expected WAR to ABORT shipment, got ${abortedRow.status}`);
  await openWorldEventThreads(pool, baseTick + 1);
  const chokeThread = await pool.query(
    `SELECT rule_id, actor_ids FROM sim_threads WHERE cell_id = 30627 AND rule_id = 'WORLD_TRADE_CHOKEPOINT'`
  );
  assert.equal(chokeThread.rows.length, 1, "Expected WORLD_TRADE_CHOKEPOINT thread after wartime embargo");
  const chokeCheck = await validateActorIds(pool, chokeThread.rows[0].actor_ids);
  assert.ok(chokeCheck.valid, `WORLD_TRADE_CHOKEPOINT failed Rule 7 actor check: ${JSON.stringify(chokeCheck)}`);
  await pool.query("ROLLBACK TO SAVEPOINT logistics_war");
  console.log("5. Wartime embargo aborts transit & opens Rule 7 WORLD_TRADE_CHOKEPOINT thread... PASSED");

  // ---------------------------------------------------------------------------
  // 6. Syndicate lair interception raids convoy & opens WORLD_CARAVAN_RAID thread
  // ---------------------------------------------------------------------------
  await pool.query("SAVEPOINT logistics_raid");
  await pool.query(`DELETE FROM sim_trade_shipments`);
  await pool.query(`DELETE FROM sim_threads`);
  await pool.query(`DELETE FROM sim_events WHERE tick = $1`, [baseTick + 1]);
  await pool.query(`UPDATE population_demographics SET allegiance_status = 'ON_CARAVAN' WHERE citizen_id IN ($1, $2)`, [arrivalCrew.merchantId, arrivalCrew.crewId]);

  const ambushCell = Number(arrivalRoute.pathCells[1] || arrivalRoute.pathCells[0]);
  const lairIns = await pool.query(
    `INSERT INTO sim_fringe_lairs (faction_id, cell_id, burg_id, lair_type, manpower, heat, inventory)
     VALUES (1, $1, $2, 'TOLL_BLOCKADE', 500, 10, '{}'::jsonb) RETURNING id`,
    [ambushCell, arrivalSource.burg_id]
  );
  const lairId = Number(lairIns.rows[0].id);

  const raidShip = await pool.query(
    `INSERT INTO sim_trade_shipments (
       source_burg_id, dest_burg_id, source_faction_id, dest_faction_id,
       transport_mode, good_id, good_key, good_name, quantity, unit_price,
       total_gold, tariff_gold, carriage_weight, merchant_citizen_id,
       crew_citizen_ids, guard_count, path_cells, path_index, current_cell_id,
       status, dispatched_tick, eta_ticks
     ) VALUES ($1, 1, $2, 29, $3, 4, 'iron', 'Iron', 14, 5, 70, 4, 9.8, $4, $5::jsonb, 0, $6::jsonb, 0, $7, 'IN_TRANSIT', $8, $9)
     RETURNING id`,
    [
      arrivalSource.burg_id,
      arrivalSource.faction_id,
      arrivalRoute.mode,
      arrivalCrew.merchantId,
      JSON.stringify([arrivalCrew.crewId]),
      JSON.stringify(arrivalRoute.pathCells),
      arrivalRoute.pathCells[0],
      baseTick,
      arrivalRoute.etaTicks,
    ]
  );
  const raidShipId = Number(raidShip.rows[0].id);

  await runSeeded(tickSeed(baseTick + 1), () => runInterFactionTradeEngine(pool, baseTick + 1, "Syndicate Raid Check"));

  const raidedRow = (await pool.query(`SELECT status FROM sim_trade_shipments WHERE id = $1`, [raidShipId])).rows[0];
  assert.equal(raidedRow.status, "INTERCEPTED", `Expected INTERCEPTED status after ambush, got ${raidedRow.status}`);
  const lairInvRow = (await pool.query(`SELECT inventory FROM sim_fringe_lairs WHERE id = $1`, [lairId])).rows[0];
  const lairInv = typeof lairInvRow.inventory === "string" ? JSON.parse(lairInvRow.inventory) : lairInvRow.inventory;
  assert.equal(Number(lairInv.iron || 0), 14, "Syndicate lair did not receive plundered Iron");

  await openWorldEventThreads(pool, baseTick + 1);
  const raidThread = await pool.query(
    `SELECT rule_id, actor_ids FROM sim_threads WHERE cell_id = 30627 AND rule_id = 'WORLD_CARAVAN_RAID'`
  );
  assert.equal(raidThread.rows.length, 1, "Expected WORLD_CARAVAN_RAID thread after convoy interception");
  const raidActorCheck = await validateActorIds(pool, raidThread.rows[0].actor_ids);
  assert.ok(raidActorCheck.valid, `WORLD_CARAVAN_RAID failed Rule 7 actor check: ${JSON.stringify(raidActorCheck)}`);
  await pool.query("ROLLBACK TO SAVEPOINT logistics_raid");
  console.log("6. Syndicate lair interception seizes cargo & opens Rule 7 WORLD_CARAVAN_RAID thread... PASSED");

  // ---------------------------------------------------------------------------
  // 7. Intermediate blockade closes graph edge & reroutes convoy along bypass
  // ---------------------------------------------------------------------------
  await pool.query("SAVEPOINT logistics_reroute");
  await pool.query(`DELETE FROM sim_trade_shipments`);
  await pool.query(`DELETE FROM sim_fringe_lairs`);
  await pool.query(`DELETE FROM sim_events WHERE tick = $1`, [baseTick + 1]);

  let rerouteSrc: any = null;
  let rerouteBase: Awaited<ReturnType<typeof findTradeRoute>> = null;
  let blockCellId = 0;
  let blockCellIdx = -1;
  let rerouteCrew: { merchantId: number; crewId: number } | null = null;

  const rerouteCands = await pool.query(
    `SELECT b.burg_id, b.cell_id, COALESCE(c.faction_id, 0)::int AS faction_id
     FROM sim_burg_economy b
     JOIN sim_cells c ON c.id = b.cell_id
     WHERE b.burg_id != 1 AND COALESCE(c.faction_id, 0) > 0 AND c.faction_id != 29
     ORDER BY b.burg_id ASC LIMIT 25`
  );
  for (const cand of rerouteCands.rows) {
    const cr = await pickCrew(Number(cand.burg_id), "Caravan Drover");
    if (!cr) continue;
    const base = await findTradeRoute(pool, { fromCellId: Number(cand.cell_id), toCellId: 30627, allowedModes: ["LAND"] });
    if (!base || base.pathCells.length < 5) continue;
    for (let bi = 1; bi < base.pathCells.length - 1; bi++) {
      const candidateBlock = base.pathCells[bi]!;
      const curCell = base.pathCells[bi - 1]!;
      const alt = await findTradeRoute(pool, {
        fromCellId: curCell,
        toCellId: 30627,
        allowedModes: ["LAND"],
        blockedCells: new Set([candidateBlock]),
      });
      if (alt && alt.pathCells.length > 1 && !alt.pathCells.includes(candidateBlock)) {
        rerouteSrc = cand;
        rerouteBase = base;
        blockCellId = candidateBlock;
        blockCellIdx = bi;
        rerouteCrew = cr;
        break;
      }
    }
    if (rerouteSrc) break;
  }
  assert.ok(rerouteSrc && rerouteBase && blockCellId > 0 && rerouteCrew, "Failed to find a LAND corridor with a clean bypass edge");

  await addCellTags(pool, blockCellId, ["#TradeBlockade"]);
  await pool.query(`UPDATE population_demographics SET allegiance_status = 'ON_CARAVAN' WHERE citizen_id IN ($1, $2)`, [rerouteCrew.merchantId, rerouteCrew.crewId]);
  const preIdx = blockCellIdx - 1;
  const rerouteIns = await pool.query(
    `INSERT INTO sim_trade_shipments (
       source_burg_id, dest_burg_id, source_faction_id, dest_faction_id,
       transport_mode, good_id, good_key, good_name, quantity, unit_price,
       total_gold, tariff_gold, carriage_weight, merchant_citizen_id,
       crew_citizen_ids, guard_count, path_cells, path_index, current_cell_id,
       status, dispatched_tick, eta_ticks
     ) VALUES ($1, 1, $2, 29, 'LAND', 34, 'coal', 'Coal', 8, 8, 68, 4, 4.8, $3, $4::jsonb, 1, $5::jsonb, $6, $7, 'IN_TRANSIT', $8, $9)
     RETURNING id`,
    [
      rerouteSrc.burg_id,
      rerouteSrc.faction_id,
      rerouteCrew.merchantId,
      JSON.stringify([rerouteCrew.crewId]),
      JSON.stringify(rerouteBase.pathCells),
      preIdx,
      rerouteBase.pathCells[preIdx],
      baseTick,
      rerouteBase.etaTicks,
    ]
  );
  const rerouteShipId = Number(rerouteIns.rows[0].id);

  await runSeeded(tickSeed(baseTick + 1), () => runInterFactionTradeEngine(pool, baseTick + 1, "Blockade Reroute"));

  const reroutedRow = (await pool.query(`SELECT status, path_cells, current_cell_id FROM sim_trade_shipments WHERE id = $1`, [rerouteShipId])).rows[0];
  assert.ok(
    reroutedRow.status === "IN_TRANSIT" || reroutedRow.status === "DELIVERED",
    `Expected convoy to reroute around blockaded cell ${blockCellId}, got status ${reroutedRow.status}`
  );
  const storedPath: number[] = Array.isArray(reroutedRow.path_cells) ? reroutedRow.path_cells.map(Number) : [];
  assert.ok(!storedPath.includes(blockCellId), `Rerouted path still includes blockaded cell ${blockCellId}`);
  const rerouteEv = await pool.query(
    `SELECT COUNT(*)::int AS c FROM sim_events WHERE tick = $1 AND type = 'TRADE_ROUTE_REROUTED' AND burg_id = 1`,
    [baseTick + 1]
  );
  assert.ok(Number(rerouteEv.rows[0].c) >= 1, "Expected TRADE_ROUTE_REROUTED event on blockade bypass");
  await pool.query("ROLLBACK TO SAVEPOINT logistics_reroute");
  console.log(`7. Intermediate #TradeBlockade closes edge #${blockCellId} & reroutes convoy along bypass... PASSED`);

  // ---------------------------------------------------------------------------
  // 8. Destination blockade closes routes, blocks new dispatches, and aborts inbound
  // ---------------------------------------------------------------------------
  await pool.query("SAVEPOINT logistics_dest_blockade");
  await pool.query(`DELETE FROM sim_trade_shipments`);
  await pool.query(`DELETE FROM sim_events WHERE tick = $1`, [baseTick + 1]);
  await addCellTags(pool, 30627, ["#CompassEmbargo"]);

  const closedRoute = await findTradeRoute(pool, {
    fromCellId: Number(rerouteSrc.cell_id),
    toCellId: 30627,
    allowedModes: ["LAND", "SEA"],
    blockedCells: new Set([30627]),
  });
  assert.equal(closedRoute, null, "Expected destination blockade on 30627 to close LAND/SEA route graph");

  await pool.query(`UPDATE population_demographics SET allegiance_status = 'ON_CARAVAN' WHERE citizen_id IN ($1, $2)`, [rerouteCrew.merchantId, rerouteCrew.crewId]);
  const inboundBlocked = await pool.query(
    `INSERT INTO sim_trade_shipments (
       source_burg_id, dest_burg_id, source_faction_id, dest_faction_id,
       transport_mode, good_id, good_key, good_name, quantity, unit_price,
       total_gold, tariff_gold, carriage_weight, merchant_citizen_id,
       crew_citizen_ids, guard_count, path_cells, path_index, current_cell_id,
       status, dispatched_tick, eta_ticks
     ) VALUES ($1, 1, $2, 29, 'LAND', 34, 'coal', 'Coal', 8, 8, 68, 4, 4.8, $3, $4::jsonb, 0, $5::jsonb, 0, $6, 'IN_TRANSIT', $7, $8)
     RETURNING id`,
    [
      rerouteSrc.burg_id,
      rerouteSrc.faction_id,
      rerouteCrew.merchantId,
      JSON.stringify([rerouteCrew.crewId]),
      JSON.stringify(rerouteBase.pathCells),
      rerouteBase.pathCells[0],
      baseTick,
      rerouteBase.etaTicks,
    ]
  );
  const blockedShipId = Number(inboundBlocked.rows[0].id);

  await runSeeded(tickSeed(baseTick + 1), () => runInterFactionTradeEngine(pool, baseTick + 1, "Dest Blockade"));

  const blockedStatus = (await pool.query(`SELECT status FROM sim_trade_shipments WHERE id = $1`, [blockedShipId])).rows[0].status;
  assert.equal(blockedStatus, "ABORTED", `Expected destination #CompassEmbargo to ABORT inbound convoy, got ${blockedStatus}`);
  const dispatchedToExcelsis = (await pool.query(
    `SELECT COUNT(*)::int AS c FROM sim_trade_shipments WHERE dest_burg_id = 1 AND status = 'IN_TRANSIT'`
  )).rows[0].c;
  assert.equal(Number(dispatchedToExcelsis), 0, "Expected zero new convoys dispatched into blockaded Excelsis");
  const embargoEv = await pool.query(
    `SELECT COUNT(*)::int AS c FROM sim_events WHERE tick = $1 AND type = 'TRADE_EMBARGO_CHOKEPOINT' AND burg_id = 1`,
    [baseTick + 1]
  );
  assert.ok(Number(embargoEv.rows[0].c) >= 1, "Expected TRADE_EMBARGO_CHOKEPOINT event on closed destination");
  await pool.query("ROLLBACK TO SAVEPOINT logistics_dest_blockade");
  console.log("8. Destination blockade closes routes, blocks new dispatches & aborts inbound convoy... PASSED");

  console.log("\nALL CITIZEN LOGISTICS TESTS PASSED");
}

isolateTest()
  .then((done) => main().then(done, async (e: unknown) => { await done(); throw e; }))
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("CITIZEN LOGISTICS TEST FAILED - COMMIT BLOCKED:", err.message || err);
    process.exit(1);
  });
