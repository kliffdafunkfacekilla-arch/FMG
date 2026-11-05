import pool from "../db/pool";
import { resetWorld } from "../engine/resetWorld";
import { executeMasterTick } from "../engine/masterOrchestrator";

interface TelemetrySnapshot {
  tick: number;
  season: string;
  totalPop: number;
  totalWealth: number;
  totalFood: number;
  avgUnrest: number;
  avgHealth: number;
  avgCrime: number;
  wardenCount: number;
  eyelessElders: number;
  cultistCount: number;
  cultInfiltrators: number;
  cultBesiegers: number;
  minSeal: number;
  avgSeal: number;
  kamikazeCount: number;
  totalLairs: number;
  totalEvents: number;
}

async function captureSnapshot(client: any, tick: number, season: string): Promise<TelemetrySnapshot> {
  const econRes = await client.query(`
    SELECT COALESCE(SUM(pop_null), 0) as total_pop,
           COALESCE(SUM(wealth), 0) as total_wealth,
           COALESCE(SUM(food), 0) as total_food,
           COALESCE(AVG(unrest), 0) as avg_unrest,
           COALESCE(AVG(health), 0) as avg_health,
           COALESCE(AVG(crime_rate), 0) as avg_crime
    FROM sim_burg_economy
  `);

  const agentsRes = await client.query(`
    SELECT role, sub_role, state, COUNT(*) as cnt
    FROM sim_agents
    GROUP BY role, sub_role, state
  `);
  let wardens = 0, elders = 0, cultists = 0, cultInfiltrators = 0, cultBesiegers = 0;
  for (const r of agentsRes.rows) {
    const c = parseInt(r.cnt);
    if (r.role === 'Warden') {
      wardens += c;
      if (r.sub_role === 'Eyeless_Elder') elders += c;
    }
    if (r.role === 'Cultist') {
      cultists += c;
      if (r.state === 'INFILTRATING') cultInfiltrators += c;
      if (r.state === 'BESIEGING_SEAL' || r.state === 'TRAVELING_TO_SEAL') cultBesiegers += c;
    }
  }

  const sealRes = await client.query(`
    SELECT MIN(seal_strength) as min_s, AVG(seal_strength) as avg_s
    FROM sim_sacred_groves
  `);

  const kamikazeRes = await client.query(
    "SELECT COUNT(*) as total FROM sim_events WHERE type = 'WARDEN_FINAL_SACRIFICE'"
  );

  const lairRes = await client.query(`SELECT COUNT(*) as total FROM sim_fringe_lairs`);
  const eventRes = await client.query(`SELECT COUNT(*) as total FROM sim_events`);

  const e = econRes.rows[0];
  const s = sealRes.rows[0];

  return {
    tick,
    season,
    totalPop: parseInt(e.total_pop) || 0,
    totalWealth: parseInt(e.total_wealth) || 0,
    totalFood: parseInt(e.total_food) || 0,
    avgUnrest: Math.round((parseFloat(e.avg_unrest) || 0) * 10) / 10,
    avgHealth: Math.round((parseFloat(e.avg_health) || 0) * 10) / 10,
    avgCrime: Math.round((parseFloat(e.avg_crime) || 0) * 10) / 10,
    wardenCount: wardens,
    eyelessElders: elders,
    cultistCount: cultists,
    cultInfiltrators,
    cultBesiegers,
    minSeal: Math.round(parseFloat(s.min_s) || 100),
    avgSeal: Math.round((parseFloat(s.avg_s) || 100) * 10) / 10,
    kamikazeCount: parseInt(kamikazeRes.rows[0]?.total) || 0,
    totalLairs: parseInt(lairRes.rows[0]?.total) || 0,
    totalEvents: parseInt(eventRes.rows[0]?.total) || 0
  };
}

export async function runYearCalibration() {
  console.log("================================================================================");
  console.log("  AETHERIA SIMULATION CALIBRATION HARNESS: 1 FULL YEAR (541 IN-GAME TICKS)");
  console.log("================================================================================");

  console.log("\n[1/3] Resetting world to canonical baseline...");
  await resetWorld();
  console.log("World reset complete.");

  const client = await pool.connect();
  const snapshots: TelemetrySnapshot[] = [];

  try {
    console.log("\n[2/3] Capturing Initial Baseline (Tick 1)...");
    const baseline = await captureSnapshot(client, 1, "The Bloom (Start)");
    snapshots.push(baseline);
    console.table([baseline]);

    console.log("\n[3/3] Advancing Master Simulation for 541 Ticks (1 Full Year)...");
    const seasons = [
      { name: "The Bloom", endTick: 66 },
      { name: "The High Sun", endTick: 132 },
      { name: "The Harvest", endTick: 198 },
      { name: "The Withering", endTick: 264 },
      { name: "The Deep Cold", endTick: 330 },
      { name: "The Thaw", endTick: 396 },
      { name: "The Awakening", endTick: 462 },
      { name: "The Roaring", endTick: 528 },
      { name: "Shadow Week (Eclipse)", endTick: 541 }
    ];

    let seasonIdx = 0;
    const startMs = Date.now();

    for (let t = 2; t <= 541; t++) {
      await executeMasterTick();

      if (seasonIdx < seasons.length && t === seasons[seasonIdx]?.endTick) {
        const snap = await captureSnapshot(client, t, seasons[seasonIdx]!.name);
        snapshots.push(snap);
        const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
        console.log(`\n--- SEASON END: Tick ${t} (${seasons[seasonIdx]!.name}) [${elapsed}s] ---`);
        console.table([snap]);
        seasonIdx++;
      } else if (t % 25 === 0) {
        process.stdout.write(`.`);
      }
    }

    console.log("\n\n================================================================================");
    console.log("  FULL YEAR CALIBRATION RESULTS & DIAGNOSTICS");
    console.log("================================================================================");
    console.table(snapshots);

    // Deep Diagnostics
    console.log("\n--- Detailed Faction Events Breakdown ---");
    const eventBreakdown = await client.query(`
      SELECT type, tier, COUNT(*) as count
      FROM sim_events
      GROUP BY type, tier
      ORDER BY count DESC
      LIMIT 25
    `);
    console.table(eventBreakdown.rows);

    console.log("\n--- Dragon Seals Integrity (12 Sacred Groves) ---");
    const groves = await client.query(`
      SELECT id, dragon_name, power_domain, seal_strength
      FROM sim_sacred_groves
      ORDER BY seal_strength ASC
    `);
    console.table(groves.rows);

    console.log("\n--- Wardens & Eyeless Elders Roster ---");
    const wardensSummary = await client.query(`
      SELECT sub_role, spark_tier, COUNT(*) as count, AVG(age_ticks)::int as avg_age, AVG(corruption)::int as avg_corruption
      FROM sim_agents
      WHERE role = 'Warden'
      GROUP BY sub_role, spark_tier
    `);
    console.table(wardensSummary.rows);

    console.log("\n--- Cultist Distribution (Burg Infiltrators vs Seal Besiegers) ---");
    const cultistsSummary = await client.query(`
      SELECT state, sub_role, COUNT(*) as count, AVG(corruption)::int as avg_corruption
      FROM sim_agents
      WHERE role = 'Cultist'
      GROUP BY state, sub_role
      ORDER BY count DESC
    `);
    console.table(cultistsSummary.rows);

    console.log("\n--- Broken Seals / World Apocalypse Status ---");
    const apocalypseCheck = await client.query(`
      SELECT id, tick, type, message, tier, lore_date
      FROM sim_events
      WHERE type = 'WORLD_ENDING_APOCALYPSE'
    `);
    if (apocalypseCheck.rowCount === 0) {
      console.log("SUCCESS: No dragon seals broken. The world survives through Warden sacrifice and vigilance!");
    } else {
      console.table(apocalypseCheck.rows);
    }

    console.log("\n--- Heroic Kamikaze Sacrifices Logged ---");
    const kamikazeLog = await client.query(`
      SELECT id, tick, message, lore_date
      FROM sim_events
      WHERE type = 'WARDEN_FINAL_SACRIFICE'
      ORDER BY tick DESC
      LIMIT 10
    `);
    console.table(kamikazeLog.rows);

    console.log("\n--- Fringe Cartels & Lairs Status ---");
    const outlaws = await client.query(`
      SELECT o.id, o.name, o.manpower as central_reserve, o.wealth,
             COUNT(l.id) as lairs_count,
             COALESCE(SUM(l.manpower), 0) as lair_manpower,
             (COALESCE(o.manpower, 0) + COALESCE(SUM(l.manpower), 0)) as total_manpower
      FROM sim_outlaw_factions o
      LEFT JOIN sim_fringe_lairs l ON l.faction_id = o.id
      GROUP BY o.id, o.name, o.manpower, o.wealth
      ORDER BY o.id ASC
    `);
    console.table(outlaws.rows);

    console.log("\n--- Sovereign Factions Status (Top 10 by Wealth) ---");
    const sovereigns = await client.query(`
      SELECT f.id, f.name, f.wealth, f.treasury, f.trait_aggression, f.trait_economy,
             COUNT(b.burg_id) as burg_count,
             COALESCE(SUM(b.pop_null), 0) as total_pop
      FROM sim_factions f
      LEFT JOIN sim_cells c ON c.faction_id = f.id
      LEFT JOIN sim_burg_economy b ON b.cell_id = c.id
      GROUP BY f.id, f.name, f.wealth, f.treasury, f.trait_aggression, f.trait_economy
      ORDER BY f.treasury DESC
      LIMIT 10
    `);
    console.table(sovereigns.rows);

    console.log("\n--- The Ghostwind Real Dead Drops (Supplied Twice a Year by Top 4 Powers) ---");
    const deadDrops = await client.query(`
      SELECT d.id, d.created_tick, d.bounty_gold, d.status, d.executed_tick,
             cf.name as client_faction, tf.name as target_faction, b.name as target_burg
      FROM sim_ghostwind_dead_drops d
      JOIN sim_factions cf ON cf.id = d.client_faction_id
      JOIN sim_factions tf ON tf.id = d.target_faction_id
      JOIN sim_burg_economy b ON b.burg_id = d.target_burg_id
      ORDER BY d.id ASC
    `);
    console.table(deadDrops.rows);

    console.log("\n--- Active Citizen Rumor & Environmental Tags ---");
    const rumorTags = await client.query(`
      SELECT elem as tag, COUNT(*) as citizen_count
      FROM population_demographics,
           jsonb_array_elements_text(COALESCE(traits, '[]'::jsonb)) as elem
      WHERE elem = ANY($1::text[])
      GROUP BY elem
      ORDER BY citizen_count DESC
    `, [["#GhostwindRumor", "#BlameRivalFaction", "#SpectralAirshipSighting", "#LockedRoomMystery", "#DeadDropSuccess", "#HauntedSpringsLegend", "#PaleGhostSighting", "#GuidanceOfTheEyelessElder", "#EyelessSight", "#PropheticVigil", "#SacrificialAetherCrater", "#HallowedMartyrGround"]]);
    console.table(rumorTags.rows);

  } finally {
    client.release();
  }
}

if (require.main === module) {
  runYearCalibration()
    .then(() => {
      console.log("\nCalibration run complete.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("\nCalibration failed:", err);
      process.exit(1);
    });
}
