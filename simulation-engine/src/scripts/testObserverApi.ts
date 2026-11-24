import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import pool from "../db/pool.js";
import { isolateTest } from "./testIsolation.js";
import { applySchemaPatches } from "../db/schemaPatches.js";
import { resolveBorderWarPair, summarizeTickHealth } from "../api/observerRouter.js";
import { runInterFactionTradeEngine } from "../engine/economy/interFactionTradeEngine.js";
import { runSeeded, tickSeed } from "../engine/rng.js";

async function main() {
  console.log("=== Testing Observer Dashboard API Parity & Hygiene ===");
  await applySchemaPatches(pool);

  // 1. Source hygiene: no retired Holgaland defaults, Sovereign Scute, or Osmium
  const observerDir = path.resolve(__dirname, "..", "..", "src", "observer");
  const dashSrc = fs.readFileSync(path.join(observerDir, "Dashboard.tsx"), "utf8");
  const modalSrc = fs.readFileSync(path.join(observerDir, "TacticalSandboxModal.tsx"), "utf8");

  assert.ok(!dashSrc.includes("useState<number | null>(19861)"), "Dashboard still defaults to ocean cell 19861");
  assert.ok(dashSrc.includes("useState<number | null>(30627)"), "Dashboard should default focus to Excelsis Citadel (30627)");
  assert.ok(!dashSrc.includes("Sovereign Scute"), "Dashboard still contains stale 'Sovereign Scute' fallback");
  assert.ok(dashSrc.includes("/api/observer/shipments") && dashSrc.includes("/api/observer/threads"), "Dashboard missing shipments or threads endpoint wiring");
  assert.ok(!modalSrc.includes("Osmium"), "TacticalSandboxModal still references retired 'Osmium'");
  console.log("1. Observer UI hygiene & Ostraka defaults verified... PASSED");

  // 2. BORDER_WAR crisis resolver uses authentic Ostraka sovereign factions (>= 29, never dead 1/2)
  const excPair = await resolveBorderWarPair(pool, 30627);
  assert.ok(excPair.myFactionId >= 29 && excPair.enemyFactionId >= 29, `Expected Ostraka faction IDs >= 29, got ${JSON.stringify(excPair)}`);
  assert.notEqual(excPair.myFactionId, excPair.enemyFactionId, "BORDER_WAR paired a faction against itself");

  const neutralCellRes = await pool.query(`SELECT id FROM sim_cells WHERE faction_id IS NULL ORDER BY id ASC LIMIT 1`);
  const neutralCellId = Number(neutralCellRes.rows[0]?.id || 1);
  const neutralPair = await resolveBorderWarPair(pool, neutralCellId);
  assert.ok(neutralPair.myFactionId >= 29 && neutralPair.enemyFactionId >= 29, `Neutral cell fell back outside Ostraka IDs: ${JSON.stringify(neutralPair)}`);
  assert.notEqual(neutralPair.myFactionId, neutralPair.enemyFactionId, "Neutral BORDER_WAR paired same faction");
  console.log(`2. BORDER_WAR resolves Ostraka sovereign pairs (${excPair.myFactionId} vs ${excPair.enemyFactionId})... PASSED`);

  // 3. Sectors parity: total_pop includes pop_attuned and Dragon Prisons carry live Warden/Cultist counts
  const excPopRes = await pool.query(`
    SELECT pop_null, COALESCE(pop_attuned, 0)::int AS pop_attuned,
           (COALESCE(pop_null, 0) + COALESCE(pop_attuned, 0))::int AS total_pop
    FROM sim_burg_economy WHERE burg_id = 1
  `);
  const ep = excPopRes.rows[0];
  assert.ok(ep && Number(ep.pop_attuned) > 0 && Number(ep.total_pop) > Number(ep.pop_null), "Excelsis total_pop must include pop_attuned");

  const grovesRes = await pool.query(`
    SELECT g.id, g.dragon_name,
           COALESCE((SELECT COUNT(*)::int FROM sim_agents a WHERE a.role = 'Warden' AND a.target_grove_id = g.id), 0) AS warden_count,
           COALESCE((SELECT COUNT(*)::int FROM sim_agents a WHERE a.role = 'Cultist' AND a.target_grove_id = g.id), 0) AS cultist_count
    FROM sim_sacred_groves g ORDER BY g.id ASC
  `);
  assert.equal(grovesRes.rows.length, 12, `Expected 12 Dragon Prisons, got ${grovesRes.rows.length}`);
  const totalWardens = grovesRes.rows.reduce((s: number, g: any) => s + Number(g.warden_count), 0);
  assert.ok(totalWardens > 0, "Expected at least some Wardens stationed across Dragon Prisons");
  console.log(`3. Sector total_pop (${ep.total_pop}) & 12 Prisons (${totalWardens} stationed wardens)... PASSED`);

  // 4. Burg stockpile, workforce & 31 regional markets parity
  const excWorkRes = await pool.query(`
    SELECT COALESCE(profession, 'Unassigned') AS profession,
           COUNT(*) FILTER (WHERE allegiance_status = 'CIVILIAN')::int AS active_records
    FROM population_demographics
    WHERE settlement_id = 1 AND life_stage = 'ADULT' AND allegiance_status IN ('CIVILIAN', 'ON_CARAVAN')
    GROUP BY profession
  `);
  const workProfs = new Set(excWorkRes.rows.map((r: any) => String(r.profession)));
  assert.ok(workProfs.has("Merchant Factor") && workProfs.has("Caravan Drover"), "Excelsis workforce missing logistics roles");

  const marketsRes = await pool.query(`SELECT id, center_burg_id, goods FROM sim_markets ORDER BY id`);
  assert.equal(marketsRes.rows.length, 31, `Expected 31 regional markets, got ${marketsRes.rows.length}`);
  console.log("4. Burg workforce & 31 regional markets queries verified... PASSED");

  // 5. Active convoys overlay & ON_CARAVAN workforce reflection inside a rolled-back savepoint
  const tickRes = await pool.query(`SELECT COALESCE(MAX(tick), 1)::int AS t FROM sim_calendar`);
  const baseTick = Number(tickRes.rows[0].t) || 1;
  await pool.query("SAVEPOINT observer_convoy_probe");
  await pool.query(`DELETE FROM sim_trade_shipments`);
  const tradeOut = await runSeeded(tickSeed(baseTick + 1), () =>
    runInterFactionTradeEngine(pool, baseTick + 1, "Observer Probe")
  );
  assert.ok(tradeOut.shipmentsDispatched > 0, "Expected at least 1 active convoy dispatched for overlay test");

  const overlayRes = await pool.query(`
    SELECT s.id, s.source_burg_id, s.transport_mode, s.good_name, s.quantity,
           s.current_cell_id, s.path_cells, p.name AS merchant_name
    FROM sim_trade_shipments s
    LEFT JOIN population_demographics p ON p.citizen_id = s.merchant_citizen_id
    WHERE s.status = 'IN_TRANSIT'
    ORDER BY s.id ASC
  `);
  assert.ok(overlayRes.rows.length > 0, "Shipments overlay query returned 0 IN_TRANSIT convoys");
  const sample = overlayRes.rows[0];
  assert.ok(typeof sample.merchant_name === "string" && sample.merchant_name.length > 0, "Overlay missing real merchant_name");
  assert.ok(Array.isArray(sample.path_cells) && sample.path_cells.length > 1, "Overlay missing route path_cells");

  const onCaravanRes = await pool.query(`
    SELECT COUNT(*) FILTER (WHERE allegiance_status = 'ON_CARAVAN')::int AS away
    FROM population_demographics
    WHERE settlement_id = $1 AND life_stage = 'ADULT'
  `, [sample.source_burg_id]);
  assert.ok(Number(onCaravanRes.rows[0].away) >= 2, "Source burg workforce failed to show ON_CARAVAN crew");
  await pool.query("ROLLBACK TO SAVEPOINT observer_convoy_probe");
  console.log("5. Live convoy overlay, merchant join & ON_CARAVAN workforce visibility... PASSED");

  // 6. Tick health summary (C4): top-3 slowest steps, partial-day detection, and Dashboard wiring
  const partialHealth = summarizeTickHealth(
    {
      status: "partial",
      currentTick: 12,
      failedAgents: [{ agent: "cartels", error: "deadlock detected" }],
      timings: { calendar: 2.1, weather: 14.4, burgOperations: 87.2, trade: 57.6, chaosFlows: 26.3 },
      queries: { calendar: 2, weather: 5, burgOperations: 46, trade: 29, chaosFlows: 72 },
      totalMs: 412.6,
    },
    "2026-11-24T00:00:00.000Z"
  );
  assert.equal(partialHealth.tick, 12);
  assert.equal(partialHealth.totalMs, 413);
  assert.equal(partialHealth.status, "partial");
  assert.equal(partialHealth.failedAgents.length, 1);
  assert.deepEqual(
    partialHealth.slowestSteps,
    [
      { step: "burgOperations", ms: 87, queries: 46 },
      { step: "trade", ms: 58, queries: 29 },
      { step: "chaosFlows", ms: 26, queries: 72 },
    ],
    "Expected top 3 slowest steps sorted descending with query counts"
  );

  const cleanHealth = summarizeTickHealth({
    status: "success",
    currentTick: 13,
    failedAgents: [],
    timings: { weather: 12, calendar: 1 },
    queries: { weather: 4, calendar: 2 },
    totalMs: 288.2,
  });
  assert.equal(cleanHealth.status, "success");
  assert.equal(cleanHealth.failedAgents.length, 0);
  assert.equal(cleanHealth.slowestSteps.length, 2);

  assert.ok(dashSrc.includes("lastTickHealth"), "Dashboard missing lastTickHealth state wiring");
  assert.ok(dashSrc.includes('status === "partial"'), "Dashboard missing amber partial-day indicator");
  console.log("6. Tick health /status summary & Dashboard partial-day badge... PASSED");

  console.log("\nALL OBSERVER API TESTS PASSED");
}

isolateTest()
  .then((done) => main().then(done, async (e: unknown) => { await done(); throw e; }))
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("OBSERVER API TEST FAILED - COMMIT BLOCKED:", err.message || err);
    process.exit(1);
  });
