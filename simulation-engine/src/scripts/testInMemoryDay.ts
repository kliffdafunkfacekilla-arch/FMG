/**
 * Phase 2.4 & 11.4 Test Suite: Verifies the pure snapshot-wide in-memory day runner,
 * read-only continental snapshot loading, deterministic multi-day branching, DB commit round-trip,
 * and zero-write in-memory story previews.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import pool from "../db/pool.js";
import type { Db } from "../engine/deltas/types.js";
import { applyDeltasInMemory } from "../engine/macro/inMemoryDay/applyMemory.js";
import { cloneWorldSnapshot } from "../engine/macro/inMemoryDay/cloneWorld.js";
import { commitInMemoryDay, loadWorldSnapshot } from "../engine/macro/inMemoryDay/loadWorld.js";
import { runInMemoryDay, runInMemoryDays } from "../engine/macro/inMemoryDay/runDay.js";
import { SPATIAL_BUCKET_SIZE, type InMemoryBurg, type WorldSnapshot } from "../engine/macro/inMemoryDay/types.js";
import { LIVE_TRADE_ROUTER } from "../engine/macro/trade/load.js";
import { mulberry32, tickSeed } from "../engine/rng.js";
import { previewStoryOptions } from "../engine/story/preview.js";
import { isolateTest } from "./testIsolation.js";

function makeSyntheticBurg(burgId: number, name: string, cellId: number): InMemoryBurg {
  return {
    burgId,
    name,
    cellId,
    parentBurgId: null,
    upstreamBurgId: null,
    settlementType: "Town",
    isCapital: true,
    port: false,
    citadel: false,
    walls: false,
    plaza: true,
    temple: false,
    shanty: false,
    occupierFactionId: null,
    occupationTicks: 0,
    resistanceStrength: 0,
    food: 80,
    wealth: 4000,
    health: 90,
    unrest: 15,
    crimeRate: 10,
    rawMaterials: 40,
    refinedGoods: 20,
    urbanTier: 2,
    biome: 5,
    architectureType: "Stone",
    popNull: 120,
    popAttuned: 40,
    recordUnit: 12,
    popGrowthPool: 0,
    popDeparturePool: 0,
    speciesDemographics: "{}",
    demographics: "{}",
    militaryForces: {},
    resourceProfile: {},
    production: {},
    workforce: null,
  };
}

function buildSyntheticWorld(): WorldSnapshot {
  const b0 = `0:0`;
  const b1 = `${Math.floor(150 / SPATIAL_BUCKET_SIZE)}:${Math.floor(150 / SPATIAL_BUCKET_SIZE)}`;
  const spatialBuckets = new Map<string, number[]>();
  spatialBuckets.set(b0, [0]);
  const arr1 = spatialBuckets.get(b1) || [];
  arr1.push(1);
  spatialBuckets.set(b1, arr1);

  return {
    static: {
      bounds: { minX: 0, maxX: 200, minY: 0, maxY: 200 },
      cellIds: [101, 102],
      cellIndexById: new Map([
        [101, 0],
        [102, 1],
      ]),
      cellCenterX: new Float64Array([50, 150]),
      cellCenterY: new Float64Array([50, 150]),
      cellElevation: new Int16Array([30, 35]),
      cellBiome: new Int16Array([5, 6]),
      cellBaseTemp: new Float32Array([15, 16]),
      cellRiverId: new Int32Array([0, 0]),
      cellFlux: new Int32Array([0, 0]),
      cellMarketId: new Int32Array([1, 1]),
      spatialBuckets,
      rivers: new Map(),
      goods: [],
      chaosFlowAnchors: [],
      factionBorders: [],
      cultures: [{ id: 1, name: "Hearthfolk" }],
      religions: [{ id: 1, name: "Dawn", type: "Organized" }],
      tradeDeals: [],
      tradeRoutes: [],
      routeGraphCellIds: new Set(),
    },
    mutable: {
      calendar: {
        id: 1,
        tick: 10,
        year: 1,
        month: 1,
        monthName: "Firstbloom",
        dayOfMonth: 10,
        dayOfYear: 10,
        season: "Greenspan",
        moonPhase: "The Halo",
        activeFlow: "Mass",
        dragonDomain: "Tiraton",
        isShadowWeek: false,
      },
      ecoHealth: new Float32Array([95, 95]),
      ecoMax: new Float32Array([100, 100]),
      ecoPlants: new Float32Array([60, 60]),
      ecoPrey: new Float32Array([50, 50]),
      ecoPredators: new Float32Array([10, 10]),
      ecoApex: new Float32Array([5, 5]),
      ecoBlight: new Float32Array([0, 0]),
      currentTemp: new Float32Array([15, 16]),
      factionId: new Int32Array([1, 2]),
      cultureId: new Int32Array([1, 1]),
      religionId: new Int32Array([1, 1]),
      burgs: new Map([
        [1, makeSyntheticBurg(1, "Alpha", 101)],
        [2, makeSyntheticBurg(2, "Beta", 102)],
      ]),
      stockpiles: new Map(),
      infrastructure: new Map(),
      activeProjects: [],
      nextProjectId: 1,
      weatherFronts: new Map(),
      nextFrontId: 1,
      chaosZones: new Map(),
      nextChaosZoneId: 1,
      chaosFlows: new Map(),
      factions: new Map([
        [1, { id: 1, name: "Iron Pact", cultureId: 1, treasury: 500, fiscalEconomy: {} }],
        [2, { id: 2, name: "Silk Compact", cultureId: 1, treasury: 500, fiscalEconomy: {} }],
      ]),
      factionUnits: new Map(),
      diplomacy: new Map([["1:2", { factionAId: 1, factionBId: 2, status: "NEUTRAL", tension: 15 }]]),
      paragons: new Map(),
      outlaws: new Map(),
      lairs: new Map(),
      nextLairId: 1,
      grindCanyons: new Map(),
      nextCanyonId: 1,
      ghostwindDrops: new Map(),
      nextDropId: 1,
      markets: new Map([[1, { id: 1, centerBurgId: 1, goods: {} }]]),
      commodityPrices: new Map(),
      agents: new Map(),
      nextAgentId: 1,
      groves: new Map(),
      ancientWards: new Map(),
      tradeShipments: new Map(),
      nextShipmentId: 1,
      citizens: new Map(),
      nextCitizenId: 1,
      cohorts: new Map(),
      cohortCrewCounts: [],
      cellTags: new Map(),
      npcInstances: new Map(),
      sectorLayers: new Map(),
      events: [],
      nextEventId: 1,
      storylines: new Map(),
      nextStorylineId: 1,
      scheduledEvents: [],
      nextScheduledId: 1,
      overlays: [],
      standing: new Map(),
      cultureCellCounts: new Map([[1, 2]]),
      religionCellCounts: new Map([[1, 2]]),
    },
  };
}

function assertPureInMemoryModules(): void {
  const dir = fs.existsSync(path.resolve(process.cwd(), "src/engine/macro/inMemoryDay"))
    ? path.resolve(process.cwd(), "src/engine/macro/inMemoryDay")
    : path.resolve(process.cwd(), "simulation-engine/src/engine/macro/inMemoryDay");

  const pureFiles = ["types.ts", "cloneWorld.ts", "applyMemory.ts", "projectors.ts", "runDay.ts"];
  for (const file of pureFiles) {
    const src = fs.readFileSync(path.join(dir, file), "utf8");
    const importLines = src.split(/\r?\n/).filter((l) => /^\s*(?:import|export)\b.*from\s+["']/.test(l));
    for (const line of importLines) {
      assert.ok(
        !/["'](?:pg|node:async_hooks|async_hooks)["']|(?:db\/pool|\/rng\.js|observer)/.test(line),
        `Pure module ${file} must not import DB/async_hooks/rng.js/observer: ${line}`
      );
    }
  }
}

async function main() {
  console.log("=== Testing Snapshot-Wide In-Memory Day & Pure Story Previews (Phase 2.4 & 11.4) ===");

  // 1. Purity & Offline Synthetic World
  assertPureInMemoryModules();
  const base = buildSyntheticWorld();
  const synA = runInMemoryDays(base, 3, { seedFn: (t) => mulberry32(1000 + t) });
  const synB = runInMemoryDays(base, 3, { seedFn: (t) => mulberry32(1000 + t) });

  assert.equal(synA.startTick, 10);
  assert.equal(synA.endTick, 13);
  assert.deepEqual(
    synA.dayResults.map((d) => d.allDeltas),
    synB.dayResults.map((d) => d.allDeltas),
    "Repeated offline 3-day runs with the same seed must produce identical deltas"
  );
  assert.deepEqual(
    Array.from(synA.endWorld.mutable.burgs.values()),
    Array.from(synB.endWorld.mutable.burgs.values()),
    "Repeated offline 3-day runs must produce identical ending burg state"
  );
  assert.equal(base.mutable.calendar.tick, 10, "Base synthetic calendar must remain untouched");
  assert.equal(base.mutable.burgs.get(1)!.unrest, 15, "Base synthetic burg unrest must remain untouched");
  assert.equal(base.mutable.burgs.get(1)!.wealth, 4000, "Base synthetic burg wealth must remain untouched");

  const divergent = cloneWorldSnapshot(base);
  applyDeltasInMemory(divergent, [{ kind: "burg.adjust", burgId: 1, unrest: 25, wealth: -500 }]);
  let divTick = divergent.mutable.calendar.tick;
  for (let d = 0; d < 3; d++) {
    divTick += 1;
    runInMemoryDay(divergent, divTick, { random: mulberry32(1000 + divTick) });
  }
  const divBurg1 = divergent.mutable.burgs.get(1)!;
  const baseRunBurg1 = synA.endWorld.mutable.burgs.get(1)!;
  assert.ok(
    divBurg1.unrest !== baseRunBurg1.unrest || divBurg1.wealth !== baseRunBurg1.wealth,
    "Perturbed cloned branch must diverge from baseline"
  );
  assert.equal(base.mutable.burgs.get(1)!.unrest, 15, "Base snapshot must stay untouched after divergent branch");
  assert.equal(base.mutable.burgs.get(1)!.wealth, 4000, "Base snapshot wealth must stay untouched after divergent branch");
  console.log("1. Pure import boundary, offline 3-day determinism & branch isolation... PASSED");

  // 2. Live 58k-cell Read-Only Snapshot, Replay Determinism & Speed Gate
  const roDb: Db = {
    query: (text: string, params?: any[]) => {
      const upper = String(text).trim().toUpperCase();
      if (!upper.startsWith("SELECT") && !upper.startsWith("WITH")) {
        throw new Error(`loadWorldSnapshot attempted non-read query: ${String(text).slice(0, 120)}`);
      }
      return pool.query(text, params);
    },
  };

  const tLoad0 = Date.now();
  const liveSnap = await loadWorldSnapshot(roDb);
  const loadMs = Date.now() - tLoad0;
  const liveStartTick = liveSnap.mutable.calendar.tick;
  assert.ok(liveSnap.static.cellIds.length > 10000, `Expected full live map, got ${liveSnap.static.cellIds.length} cells`);
  assert.ok(liveSnap.mutable.burgs.size > 0, "Expected burgs in live snapshot");

  const liveRun1 = runInMemoryDays(liveSnap, 2, {
    seedFn: (t) => mulberry32(tickSeed(t)),
    tradeRouter: LIVE_TRADE_ROUTER,
  });
  const liveRun2 = runInMemoryDays(liveSnap, 2, {
    seedFn: (t) => mulberry32(tickSeed(t)),
    tradeRouter: LIVE_TRADE_ROUTER,
  });

  assert.equal(liveRun1.endTick, liveStartTick + 2);
  assert.ok(liveRun1.dayResults[0]!.allDeltas.length > 0, "Live Day 1 must emit deltas");
  assert.ok(
    liveRun1.dayResults[0]!.totalMs < 1500 && liveRun1.dayResults[1]!.totalMs < 1500,
    `Each in-memory day must stay under 1500 ms (got ${liveRun1.dayResults.map((d) => d.totalMs).join(", ")} ms)`
  );
  assert.deepEqual(
    liveRun1.dayResults.map((d) => d.allDeltas),
    liveRun2.dayResults.map((d) => d.allDeltas),
    "Two 2-day in-memory replays on the live map must be 100% identical"
  );
  assert.equal(liveSnap.mutable.calendar.tick, liveStartTick, "Base live snapshot tick must remain untouched");
  console.log(
    `2. Live 58k-cell read-only load (${loadMs}ms) + deterministic 2-day replay (${liveRun1.dayResults.map((d) => d.totalMs).join("ms, ")}ms)... PASSED`
  );

  // 4 (run before isolateTest ends pool). Pure In-Memory previewStoryOptions Spy
  const firstBurgId = Number(liveSnap.mutable.burgs.keys().next().value);
  const p = pool as any;
  const origQuery = p.query;
  const origConnect = p.connect;
  let explicitConnectCalls = 0;
  let writeOrTxQueries = 0;
  let inPoolQueryDepth = 0;
  const badSqls: string[] = [];

  const checkSql = (text: any) => {
    const upper = String(typeof text === "string" ? text : text?.text ?? "")
      .trim()
      .toUpperCase();
    if (!upper.startsWith("SELECT") && !upper.startsWith("WITH")) {
      writeOrTxQueries++;
      badSqls.push(upper.slice(0, 120));
    }
  };

  p.connect = (...args: any[]) => {
    if (inPoolQueryDepth === 0) {
      explicitConnectCalls++;
    }
    return origConnect.apply(pool, args);
  };
  p.query = (text: any, params?: any) => {
    checkSql(text);
    inPoolQueryDepth++;
    try {
      return origQuery.call(pool, text, params);
    } finally {
      inPoolQueryDepth--;
    }
  };

  let prevRes1;
  let prevRes2;
  try {
    const previewReq = {
      days: 2,
      resolutionOptions: [
        { label: "Baseline", action: "do_nothing" as const },
        {
          label: "Stimulus",
          action: "do_nothing" as const,
          deltas: [{ kind: "burg.adjust" as const, burgId: firstBurgId, unrest: 20, wealth: -400 }],
        },
      ],
    };
    prevRes1 = await previewStoryOptions(previewReq);
    prevRes2 = await previewStoryOptions(previewReq);
  } finally {
    p.query = origQuery;
    p.connect = origConnect;
  }

  assert.equal(explicitConnectCalls, 0, `previewStoryOptions must not explicitly call pool.connect(), got ${explicitConnectCalls}`);
  assert.equal(writeOrTxQueries, 0, `previewStoryOptions must execute zero write/tx queries, got: ${badSqls.join(" | ")}`);
  assert.notEqual(
    prevRes1.options[0]!.fingerprintHash,
    prevRes1.options[1]!.fingerprintHash,
    "Baseline vs Stimulus in-memory preview hashes must differ"
  );
  assert.deepEqual(
    prevRes1.options.map((o) => o.fingerprintHash),
    prevRes2.options.map((o) => o.fingerprintHash),
    "Repeated in-memory previewStoryOptions calls must be deterministic"
  );
  console.log("3. previewStoryOptions executed with zero pool.connect()/write/tx queries and deterministic hashes... PASSED");

  // 3. Commit Round-Trip inside isolateTest() (rolls back and cleanly closes pool in done())
  const done = await isolateTest();
  try {
    const isoSnap = await loadWorldSnapshot(pool);
    const branch = cloneWorldSnapshot(isoSnap);
    const nextTick = isoSnap.mutable.calendar.tick + 1;
    const dayRes = runInMemoryDay(branch, nextTick, {
      random: mulberry32(tickSeed(nextTick)),
      tradeRouter: LIVE_TRADE_ROUTER,
    });
    const flushRes = await commitInMemoryDay(pool, dayRes.tick, dayRes);
    const totalApplied = Object.values(flushRes.counts).reduce((s, n) => s + Number(n || 0), 0);
    const calCheck = await pool.query(`SELECT COALESCE(MAX(tick), 0)::int AS t FROM sim_calendar`);
    assert.equal(Number(calCheck.rows[0]?.t), dayRes.tick, "commitInMemoryDay must advance sim_calendar to dayRes.tick");
    assert.ok(totalApplied > 0, `commitInMemoryDay must apply deltas (applied=${totalApplied})`);
    assert.equal(
      flushRes.rejected.length,
      0,
      `commitInMemoryDay must have zero rejected deltas (got: ${flushRes.rejected.slice(0, 5).map((r) => r.reason).join("; ")})`
    );
    console.log(
      `4. commitInMemoryDay round-trip (tick=${dayRes.tick}, applied=${totalApplied}, promoted=${flushRes.promotedCount}, rejected=${flushRes.rejected.length}) inside isolateTest()... PASSED`
    );
  } finally {
    await done();
  }

  console.log("\nALL PHASE 2.4 IN-MEMORY DAY & PHASE 11.4 PURE PREVIEW TESTS PASSED");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("IN-MEMORY DAY TEST FAILED - COMMIT BLOCKED:", err?.message || err);
    if (err?.stack) console.error(err.stack);
    process.exit(1);
  });
