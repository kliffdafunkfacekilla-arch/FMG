import pool from "../db/pool";
import { resetWorld } from "../engine/resetWorld";
import { executeMasterTick } from "../engine/masterOrchestrator";
import fs from "fs";
import path from "path";

export interface DecadeTelemetrySnapshot {
  tick: number;
  year: number;
  dayOfYear: number;
  season: string;
  loreDate: string;
  
  // Demographics
  totalPopulation: number;
  popNull: number;
  popAttuned: number;
  activeBurgs: number;
  ruinedBurgs: number;
  famineBurgs: number;
  
  // Economy
  totalFood: number;
  totalWealth: number;
  totalRawMaterials: number;
  totalRefinedGoods: number;
  avgUnrest: number;
  avgHealth: number;
  avgCrime: number;
  
  // Factions & Sovereignty
  activeWars: number;
  topFactionName: string;
  topFactionTreasury: number;
  
  // Cosmic Balance: 12 Dragon Seals
  minSealStrength: number;
  avgSealStrength: number;
  lowestSealDragon: string;
  apocalypseTriggered: boolean;
  
  // Wardens & Cultists
  activeWardens: number;
  eyelessElders: number;
  voidCultists: number;
  cultInfiltrators: number;
  cultBesiegers: number;
  kamikazeCount: number;
  newWardenVows: number;
  madHermits: number;
  
  // Underworld Cartels
  totalCartelLairs: number;
  totalCartelManpower: number;
  topCartelName: string;
  
  // Total Events Logged
  totalEvents: number;
}

export interface AnomalyReport {
  tick: number;
  year: number;
  loreDate: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  category: "ECONOMY" | "DEMOGRAPHICS" | "DRAGON_SEALS" | "WARDENS" | "CARTELS" | "GEOPOLITICS";
  message: string;
  metrics: Record<string, any>;
}

export async function captureDecadeSnapshot(client: any, tick: number): Promise<DecadeTelemetrySnapshot> {
  // 1. Calendar
  const calRes = await client.query("SELECT * FROM sim_calendar ORDER BY id DESC LIMIT 1");
  const cal = calRes.rows[0] || {};
  const year = Number(cal.year) || Math.floor((tick - 1) / 541) + 1;
  const dayOfYear = Number(cal.day_of_year) || ((tick - 1) % 541) + 1;
  const season = cal.season || "The Bloom";
  const loreDate = cal.is_shadow_week 
    ? `Year ${year}, Shadow Week, Day ${cal.day_of_month || 1}`
    : `Year ${year}, Month ${cal.month || 1} (${cal.month_name || 'Nexar'}), Day ${cal.day_of_month || 1} (${season})`;

  // 2. Burg Economy & Demographics
  const econRes = await client.query(`
    SELECT 
      COALESCE(SUM(pop_null + pop_attuned), 0)::bigint as total_pop,
      COALESCE(SUM(pop_null), 0)::bigint as pop_null,
      COALESCE(SUM(pop_attuned), 0)::bigint as pop_attuned,
      COALESCE(SUM(food), 0)::bigint as total_food,
      COALESCE(SUM(wealth), 0)::bigint as total_wealth,
      COALESCE(SUM(raw_materials), 0)::bigint as total_raw,
      COALESCE(SUM(refined_goods), 0)::bigint as total_refined,
      COALESCE(AVG(unrest), 0)::float as avg_unrest,
      COALESCE(AVG(health), 0)::float as avg_health,
      COALESCE(AVG(crime_rate), 0)::float as avg_crime,
      COUNT(CASE WHEN pop_null > 0 OR pop_attuned > 0 THEN 1 END) as active_burgs,
      COUNT(CASE WHEN pop_null <= 0 AND pop_attuned <= 0 THEN 1 END) as ruined_burgs,
      COUNT(CASE WHEN food <= 0 AND (pop_null > 0 OR pop_attuned > 0) THEN 1 END) as famine_burgs
    FROM sim_burg_economy
  `);
  const e = econRes.rows[0];

  // 3. Factions & Geopolitics
  const factionRes = await client.query(`
    SELECT name, treasury 
    FROM sim_factions 
    ORDER BY treasury DESC 
    LIMIT 1
  `);
  const topF = factionRes.rows[0] || { name: "None", treasury: 0 };

  const warsRes = await client.query(`
    SELECT COUNT(*) as count 
    FROM sim_diplomacy 
    WHERE status = 'WAR'
  `).catch(() => ({ rows: [{ count: 0 }] }));
  const activeWars = Number(warsRes.rows[0]?.count || 0);

  // 4. Dragon Seals
  const sealRes = await client.query(`
    SELECT 
      MIN(seal_strength) as min_s, 
      AVG(seal_strength) as avg_s
    FROM sim_sacred_groves
  `);
  const lowestSealRes = await client.query(`
    SELECT dragon_name, seal_strength 
    FROM sim_sacred_groves 
    ORDER BY seal_strength ASC 
    LIMIT 1
  `);
  const s = sealRes.rows[0];
  const lowestDragon = lowestSealRes.rows[0]?.dragon_name || "Unknown";

  const lowestSeal = Number(s?.min_s || 100);
  const apocalypseTriggered = lowestSeal <= 0;

  // 5. Cosmic Agents (Wardens, Cultists, Hermits)
  const agentRes = await client.query(`
    SELECT role, sub_role, state, COUNT(*) as cnt
    FROM sim_agents
    GROUP BY role, sub_role, state
  `);
  let wardens = 0, elders = 0, cultists = 0, cultInfil = 0, cultBesiege = 0, hermits = 0;
  for (const r of agentRes.rows) {
    const c = parseInt(r.cnt, 10);
    if (r.role === 'Warden') {
      wardens += c;
      if (r.sub_role === 'Eyeless_Elder') elders += c;
    } else if (r.role === 'Cultist') {
      cultists += c;
      if (r.state === 'INFILTRATING') cultInfil += c;
      if (r.state === 'BESIEGING_SEAL' || r.state === 'TRAVELING_TO_SEAL') cultBesiege += c;
    } else if (r.role === 'Mad_Hermit') {
      hermits += c;
    }
  }

  const kamikazeRes = await client.query("SELECT COUNT(*) as cnt FROM sim_events WHERE type = 'WARDEN_FINAL_SACRIFICE'");
  const vowRes = await client.query("SELECT COUNT(*) as cnt FROM sim_events WHERE type = 'WARDEN_VOW_TAKEN'");

  // 6. Underworld Cartels
  const cartelRes = await client.query(`
    SELECT 
      COUNT(l.id) as total_lairs,
      COALESCE(SUM(l.manpower), 0) + COALESCE((SELECT SUM(manpower) FROM sim_outlaw_factions), 0) as total_manpower
    FROM sim_fringe_lairs l
  `);
  const topCartelRes = await client.query(`
    SELECT o.name, (COALESCE(o.manpower, 0) + COALESCE(SUM(l.manpower), 0)) as total_m
    FROM sim_outlaw_factions o
    LEFT JOIN sim_fringe_lairs l ON l.faction_id = o.id
    GROUP BY o.id, o.name, o.manpower
    ORDER BY total_m DESC
    LIMIT 1
  `);
  const cData = cartelRes.rows[0] || {};
  const topCartel = topCartelRes.rows[0] || { name: "None", total_m: 0 };

  // 7. Event Count
  const eventRes = await client.query("SELECT COUNT(*) as cnt FROM sim_events");

  return {
    tick,
    year,
    dayOfYear,
    season,
    loreDate,
    totalPopulation: Number(e.total_pop || 0),
    popNull: Number(e.pop_null || 0),
    popAttuned: Number(e.pop_attuned || 0),
    activeBurgs: Number(e.active_burgs || 0),
    ruinedBurgs: Number(e.ruined_burgs || 0),
    famineBurgs: Number(e.famine_burgs || 0),
    totalFood: Number(e.total_food || 0),
    totalWealth: Number(e.total_wealth || 0),
    totalRawMaterials: Number(e.total_raw || 0),
    totalRefinedGoods: Number(e.total_refined || 0),
    avgUnrest: Math.round(Number(e.avg_unrest || 0) * 10) / 10,
    avgHealth: Math.round(Number(e.avg_health || 0) * 10) / 10,
    avgCrime: Math.round(Number(e.avg_crime || 0) * 10) / 10,
    activeWars,
    topFactionName: topF.name,
    topFactionTreasury: Number(topF.treasury || 0),
    minSealStrength: Math.round(Number(s.min_s ?? 100)),
    avgSealStrength: Math.round(Number(s.avg_s ?? 100) * 10) / 10,
    lowestSealDragon: lowestDragon,
    apocalypseTriggered,
    activeWardens: wardens,
    eyelessElders: elders,
    voidCultists: cultists,
    cultInfiltrators: cultInfil,
    cultBesiegers: cultBesiege,
    kamikazeCount: Number(kamikazeRes.rows[0]?.cnt || 0),
    newWardenVows: Number(vowRes.rows[0]?.cnt || 0),
    madHermits: hermits,
    totalCartelLairs: Number(cData.total_lairs || 0),
    totalCartelManpower: Number(cData.total_manpower || 0),
    topCartelName: topCartel.name,
    totalEvents: Number(eventRes.rows[0]?.cnt || 0)
  };
}

export function detectAnomalies(curr: DecadeTelemetrySnapshot, prev: DecadeTelemetrySnapshot | null): AnomalyReport[] {
  const anomalies: AnomalyReport[] = [];

  // 1. Apocalypse
  if (curr.apocalypseTriggered) {
    anomalies.push({
      tick: curr.tick,
      year: curr.year,
      loreDate: curr.loreDate,
      severity: "CRITICAL",
      category: "DRAGON_SEALS",
      message: `WORLD_ENDING_APOCALYPSE triggered! Dragon Seal collapsed to 0% (${curr.lowestSealDragon})`,
      metrics: { minSealStrength: curr.minSealStrength, dragon: curr.lowestSealDragon }
    });
  }

  // 2. Dangerous Seal Erosion
  if (curr.minSealStrength <= 25 && curr.minSealStrength > 0) {
    anomalies.push({
      tick: curr.tick,
      year: curr.year,
      loreDate: curr.loreDate,
      severity: "HIGH",
      category: "DRAGON_SEALS",
      message: `Dragon Prison for ${curr.lowestSealDragon} critically degraded to ${curr.minSealStrength}%!`,
      metrics: { minSealStrength: curr.minSealStrength, avgSealStrength: curr.avgSealStrength }
    });
  }

  // 3. Famine Cascade
  if (curr.famineBurgs > 50) {
    anomalies.push({
      tick: curr.tick,
      year: curr.year,
      loreDate: curr.loreDate,
      severity: curr.famineBurgs > 120 ? "CRITICAL" : "HIGH",
      category: "ECONOMY",
      message: `Continental Famine Epidemic: ${curr.famineBurgs} burgs are at 0 food!`,
      metrics: { famineBurgs: curr.famineBurgs, totalFood: curr.totalFood }
    });
  }

  // 4. Population Collapse
  if (prev && prev.totalPopulation > 0) {
    const popDeltaPct = ((curr.totalPopulation - prev.totalPopulation) / prev.totalPopulation) * 100;
    if (popDeltaPct < -15.0) {
      anomalies.push({
        tick: curr.tick,
        year: curr.year,
        loreDate: curr.loreDate,
        severity: "CRITICAL",
        category: "DEMOGRAPHICS",
        message: `Catastrophic Population Collapse: Continental population plunged by ${popDeltaPct.toFixed(1)}% (Lost ${(prev.totalPopulation - curr.totalPopulation).toLocaleString()} souls)`,
        metrics: { popDeltaPct, previousPop: prev.totalPopulation, currentPop: curr.totalPopulation }
      });
    }
  }

  // 5. Unrest Rebellion Lock
  if (curr.avgUnrest >= 60.0) {
    anomalies.push({
      tick: curr.tick,
      year: curr.year,
      loreDate: curr.loreDate,
      severity: "HIGH",
      category: "ECONOMY",
      message: `Widespread Continental Rebellion: Average municipal unrest reached ${curr.avgUnrest}%!`,
      metrics: { avgUnrest: curr.avgUnrest, avgCrime: curr.avgCrime }
    });
  }

  // 6. Warden Extinction
  if (curr.activeWardens <= 15) {
    anomalies.push({
      tick: curr.tick,
      year: curr.year,
      loreDate: curr.loreDate,
      severity: curr.activeWardens === 0 ? "CRITICAL" : "HIGH",
      category: "WARDENS",
      message: `Warden Order Extinction Threat: Active Wardens dropped to ${curr.activeWardens} (Elders: ${curr.eyelessElders})`,
      metrics: { activeWardens: curr.activeWardens, eyelessElders: curr.eyelessElders, kamikazeCount: curr.kamikazeCount }
    });
  }

  // 7. Cartel Hegemony / Lair Sprawl
  if (curr.totalCartelLairs >= 80 || curr.totalCartelManpower >= 12000) {
    anomalies.push({
      tick: curr.tick,
      year: curr.year,
      loreDate: curr.loreDate,
      severity: "MEDIUM",
      category: "CARTELS",
      message: `Underworld Cartel Dominance: ${curr.totalCartelLairs} lairs active worldwide, ${curr.totalCartelManpower.toLocaleString()} total manpower. Top: ${curr.topCartelName}`,
      metrics: { totalLairs: curr.totalCartelLairs, totalManpower: curr.totalCartelManpower }
    });
  }

  // 8. Faction Treasury Overflow
  if (curr.topFactionTreasury >= 2000000) {
    anomalies.push({
      tick: curr.tick,
      year: curr.year,
      loreDate: curr.loreDate,
      severity: "MEDIUM",
      category: "GEOPOLITICS",
      message: `Runaway Treasury Hyper-Accumulation: ${curr.topFactionName} has accumulated ${curr.topFactionTreasury.toLocaleString()} gold!`,
      metrics: { faction: curr.topFactionName, treasury: curr.topFactionTreasury }
    });
  }

  return anomalies;
}

export async function runDecadeSimulation(totalTicks: number = 5410, shouldReset: boolean = true) {
  console.log("================================================================================");
  console.log(`  OSTRAKA DECADE SIMULATION HARNESS: ${totalTicks.toLocaleString()} TICKS (~${(totalTicks / 541).toFixed(1)} YEARS)`);
  console.log("================================================================================");

  if (shouldReset) {
    console.log("\n[1/3] Resetting world to authentic Holgaland baseline (Year 1, Day 1)...");
    await resetWorld();
    console.log("World reset complete.");
  } else {
    console.log("\n[1/3] Continuing simulation from live database state...");
  }

  const client = await pool.connect();
  const snapshots: DecadeTelemetrySnapshot[] = [];
  const anomalyLog: AnomalyReport[] = [];

  const outDir = path.resolve(process.cwd(), "simulation-engine/data/calibration");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const jsonOutPath = path.join(outDir, `decade_simulation_telemetry_${Date.now()}.json`);

  try {
    console.log("\n[2/3] Capturing Initial Baseline Snapshot (Day 1)...");
    const baseline = await captureDecadeSnapshot(client, 1);
    snapshots.push(baseline);
    console.table([{
      Year: baseline.year,
      Day: baseline.dayOfYear,
      Season: baseline.season,
      Population: baseline.totalPopulation.toLocaleString(),
      Burgs: `${baseline.activeBurgs} active (${baseline.ruinedBurgs} ruins)`,
      Food: baseline.totalFood.toLocaleString(),
      Wealth: baseline.totalWealth.toLocaleString(),
      Unrest: `${baseline.avgUnrest}%`,
      MinSeal: `${baseline.minSealStrength}% (${baseline.lowestSealDragon})`,
      Wardens: `${baseline.activeWardens} (${baseline.eyelessElders} Elders)`,
      Cultists: baseline.voidCultists,
      Lairs: baseline.totalCartelLairs
    }]);

    console.log(`\n[3/3] Commencing autonomous simulation run: ${totalTicks} days in progress...`);
    const startMs = Date.now();
    let prevSnapshot = baseline;

    const sampleInterval = 66; // Capture telemetry at every season change (66 days)
    const reportYearInterval = 541; // Comprehensive yearly report

    for (let t = 1; t <= totalTicks; t++) {
      const tickStart = Date.now();
      const tickRes = await executeMasterTick();
      const tickMs = Date.now() - tickStart;
      const currentDbTick = tickRes.currentTick;

      // Seasonal checkpoint or final tick
      if (t % sampleInterval === 0 || t === totalTicks) {
        const snap = await captureDecadeSnapshot(client, currentDbTick);
        snapshots.push(snap);

        // Detect balancing anomalies
        const anomalies = detectAnomalies(snap, prevSnapshot);
        if (anomalies.length > 0) {
          anomalyLog.push(...anomalies);
          for (const a of anomalies) {
            console.log(`\n  [!ALERT ${a.severity}] [${a.category}] Tick ${a.tick} (${a.loreDate}): ${a.message}`);
          }
        }

        const elapsedSec = ((Date.now() - startMs) / 1000).toFixed(1);
        const rate = (t / Number(elapsedSec || 1)).toFixed(1);
        const estRemainingSec = (((totalTicks - t) / Number(rate || 1))).toFixed(0);

        if (t % reportYearInterval === 0 || t === totalTicks) {
          console.log(`\n================================================================================`);
          console.log(`  YEAR END CHECKPOINT: Year ${snap.year} Completed (Tick ${t}) [Elapsed: ${elapsedSec}s, ~${rate} t/s, Est Rem: ${estRemainingSec}s]`);
          console.log(`================================================================================`);
          console.table([{
            Year: snap.year,
            LoreDate: snap.loreDate,
            Pop: snap.totalPopulation.toLocaleString(),
            Food: snap.totalFood.toLocaleString(),
            Wealth: snap.totalWealth.toLocaleString(),
            AvgUnrest: `${snap.avgUnrest}%`,
            FamineBurgs: snap.famineBurgs,
            MinSeal: `${snap.minSealStrength}% (${snap.lowestSealDragon})`,
            AvgSeal: `${snap.avgSealStrength}%`,
            Wardens: snap.activeWardens,
            Kamikazes: snap.kamikazeCount,
            Cultists: snap.voidCultists,
            CartelLairs: snap.totalCartelLairs,
            CartelManpower: snap.totalCartelManpower.toLocaleString(),
            Events: snap.totalEvents.toLocaleString()
          }]);
        } else {
          process.stdout.write(`[Y${snap.year} ${snap.season.slice(0, 4)}: P:${Math.round(snap.totalPopulation/1000)}k F:${Math.round(snap.totalFood/1000)}k S:${snap.minSealStrength}% W:${snap.activeWardens}] `);
        }

        prevSnapshot = snap;

        // Periodically dump partial telemetry JSON to disk
        fs.writeFileSync(jsonOutPath, JSON.stringify({ snapshots, anomalyLog }, null, 2), "utf8");
      }
    }

    const totalElapsedSec = ((Date.now() - startMs) / 1000).toFixed(1);
    console.log("\n\n================================================================================");
    console.log(`  DECADE SIMULATION COMPLETED IN ${totalElapsedSec}s (${(Number(totalElapsedSec) / 60).toFixed(1)} mins)`);
    console.log(`  Total Ticks Executed: ${totalTicks.toLocaleString()}`);
    console.log(`  Total Snapshots Recorded: ${snapshots.length}`);
    console.log(`  Total Balancing Anomalies Flagged: ${anomalyLog.length}`);
    console.log(`  Telemetry Persisted to: ${jsonOutPath}`);
    console.log("================================================================================");

    // Final Anomaly Breakdown
    if (anomalyLog.length > 0) {
      console.log("\n--- Balancing Anomalies & Feedback Loops Detected ---");
      console.table(anomalyLog.map(a => ({
        Year: a.year,
        Severity: a.severity,
        Category: a.category,
        Message: a.message.slice(0, 85)
      })));
    } else {
      console.log("\nPERFECT EQUILIBRIUM: Zero catastrophic feedback loops detected throughout the decade!");
    }

    return { snapshots, anomalyLog, jsonOutPath };
  } finally {
    client.release();
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  let ticks = 5410; // Default 10 years
  let reset = true;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--ticks" && args[i + 1]) ticks = parseInt(args[i + 1]!, 10);
    if (args[i] === "--years" && args[i + 1]) ticks = parseInt(args[i + 1]!, 10) * 541;
    if (args[i] === "--no-reset") reset = false;
  }

  runDecadeSimulation(ticks, reset)
    .then(() => {
      console.log("\nDecade simulation runner finished.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("\nDecade simulation runner failed:", err);
      process.exit(1);
    });
}

