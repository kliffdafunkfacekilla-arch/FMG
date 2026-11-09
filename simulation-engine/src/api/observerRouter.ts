import { Router } from "express";
import pool from "../db/pool";
import { executeMasterTick } from "../engine/masterOrchestrator";
import { resetWorld } from "../engine/resetWorld";
import { FACTION_SPECIALTIES } from "../engine/economy/factionSpecialties";

const observerRouter = Router();

observerRouter.get("/economy/specialties", async (req, res) => {
    try {
        const embargoesRes = await pool.query(`
            SELECT d.id, d.faction_a_id, d.faction_b_id, d.status, d.tension,
                   f1.name AS faction1_name, f2.name AS faction2_name
            FROM sim_diplomacy d
            JOIN sim_factions f1 ON d.faction_a_id = f1.id
            JOIN sim_factions f2 ON d.faction_b_id = f2.id
            WHERE d.status = 'WAR'
            ORDER BY d.id DESC
        `);

        const tradeEventsRes = await pool.query(`
            SELECT id, tick, type, message, tier, lore_date, burg_id, faction_id
            FROM sim_events
            WHERE type IN ('CARAVAN_DISPATCH', 'TRADE_EMBARGO_CHOKEPOINT')
            ORDER BY id DESC LIMIT 25
        `);

        res.json({
            status: "ok",
            specialties: Object.values(FACTION_SPECIALTIES),
            activeEmbargoes: embargoesRes.rows,
            recentTradeEvents: tradeEventsRes.rows
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});
let autoplayTimer: any = null;
observerRouter.post("/autoplay", (req, res) => {
    const { enabled } = req.body;
    if (enabled && !autoplayTimer) {
        autoplayTimer = setInterval(async () => {
            if (!tickInProgress && !resetInProgress) {
                tickInProgress = true;
                try { await executeMasterTick(); } catch(e) { console.error("Autoplay tick err", e); }
                tickInProgress = false;
            }
        }, 1500);
    } else if (!enabled && autoplayTimer) {
        clearInterval(autoplayTimer);
        autoplayTimer = null;
    }
    res.json({ autoplay: !!autoplayTimer });
});
observerRouter.get("/autoplay", (req, res) => {
    res.json({ autoplay: !!autoplayTimer });
});


let tickInProgress = false;
let resetInProgress = false;

observerRouter.get("/map", async (req, res) => {
  try {
    const z = parseInt(req.query.z as string) || 0;
    const cells = await pool.query(`SELECT id, faction_id, biome, center_x, center_y, geometry, eco_plants, eco_prey, eco_predators, eco_resources, elevation, z_layer FROM sim_cells WHERE z_layer = $1`, [z]);
    res.json({ cells: cells.rows.map(c => ({ ...c, geometry: typeof c.geometry === "string" ? (function(){ try { return JSON.parse(c.geometry); } catch(e) { return null; } })() : c.geometry })) });
  } catch(e: any) {
    res.status(500).json({error: e.message});
  }
});

observerRouter.get("/state", async (req, res) => {
  try {
    const factions = await pool.query("SELECT * FROM sim_factions");
    const events = await pool.query("SELECT * FROM sim_events ORDER BY tick DESC, id DESC LIMIT 100");
    const chaosZones = await pool.query("SELECT * FROM sim_chaos_zones");
    const economy = await pool.query("SELECT b.burg_id, b.name, b.food, b.wealth, b.unrest, b.health, b.pop_null, b.crime_rate, b.military_forces, b.demographics, b.species_demographics, b.cell_id, c.faction_id FROM sim_burg_economy b JOIN sim_cells c ON b.cell_id = c.id");
    const agents = await pool.query("SELECT * FROM sim_agents");
    const sacredGroves = await pool.query("SELECT * FROM sim_sacred_groves");
    const calendar = await pool.query("SELECT * FROM sim_calendar ORDER BY id DESC LIMIT 1");
    const outlaws = await pool.query(`
      SELECT o.*,
             COALESCE(SUM(l.manpower), 0)::int AS lair_manpower,
             (COALESCE(o.manpower, 0) + COALESCE(SUM(l.manpower), 0))::int AS total_manpower
      FROM sim_outlaw_factions o
      LEFT JOIN sim_fringe_lairs l ON l.faction_id = o.id
      GROUP BY o.id, o.name, o.type, o.origin_cell_id, o.manpower, o.worker_groups, o.wealth, o.heat, o.description, o.contraband_types
      ORDER BY o.name ASC
    `);
    const prices = await pool.query("SELECT * FROM sim_commodity_prices ORDER BY commodity");

    res.json({
      factions: factions.rows,
      fringeFactions: outlaws.rows,
      cells: [],
      events: events.rows,
      chaosZones: chaosZones.rows,
      economy: economy.rows.map((e) => ({
        ...e,
        demographics: e.demographics ? (typeof e.demographics === "string" ? (function(){ try { return JSON.parse(e.demographics); } catch(e) { return {}; } })() : e.demographics) : {},
        military_forces: e.military_forces ? (typeof e.military_forces === "string" ? (function(){ try { return JSON.parse(e.military_forces); } catch(e) { return {}; } })() : e.military_forces) : {},
      })),
      agents: agents.rows,
      sacredGroves: sacredGroves.rows,
      calendar: calendar.rows[0] || null,
      outlaws: outlaws.rows,
      prices: prices.rows,
      tickInProgress,
      resetInProgress,
    });
  } catch (error: any) {
    console.error("Observer state error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

observerRouter.post("/tick", async (req, res) => {
  if (tickInProgress) {
    return res.status(429).json({ error: "Tick already in progress. Please wait." });
  }
  if (resetInProgress) {
    return res.status(429).json({ error: "World reset in progress. Please wait." });
  }

  tickInProgress = true;
  try {
    const result = await executeMasterTick();
    res.json(result);
  } catch (error: any) {
    console.error("Tick error:", error.stack);
    res.status(500).json({ error: error.message || "Tick failed" });
  } finally {
    tickInProgress = false;
  }
});

// Run batch ticks at will (1, 5, 10)
observerRouter.post("/batch_ticks", async (req, res) => {
  if (tickInProgress) {
    return res.status(429).json({ error: "Tick already in progress. Please wait." });
  }
  if (resetInProgress) {
    return res.status(429).json({ error: "World reset in progress. Please wait." });
  }

  const count = Math.min(Math.max(Number(req.body.count || 1), 1), 25);
  tickInProgress = true;
  try {
    const results = [];
    for (let i = 0; i < count; i++) {
      const r = await executeMasterTick();
      results.push(r);
    }
    res.json({
      success: true,
      countRun: results.length,
      finalTick: results[results.length - 1]?.currentTick,
      ticks: results
    });
  } catch (error: any) {
    console.error("Batch tick error:", error.stack);
    res.status(500).json({ error: error.message || "Batch tick failed" });
  } finally {
    tickInProgress = false;
  }
});

// Get comprehensive sector data: all 352 Burgs, 12 Dragon Prisons, and Convergence Nexus
observerRouter.get("/sectors", async (req, res) => {
  try {
    const burgsRes = await pool.query(`
      SELECT b.burg_id, b.name, b.cell_id, b.food, b.wealth, b.unrest, b.urban_tier, b.pop_null, b.crime_rate, b.occupier_faction_id,
             c.faction_id, f.name as faction_name, f.color as faction_color
      FROM sim_burg_economy b
      LEFT JOIN sim_cells c ON b.cell_id = c.id
      LEFT JOIN sim_factions f ON COALESCE(b.occupier_faction_id, c.faction_id) = f.id
      ORDER BY b.name ASC
    `);

    const paragonsRes = await pool.query(`
      SELECT id, burg_id, name, title, traits, corruption_score
      FROM sim_paragons
      WHERE burg_id IS NOT NULL
      ORDER BY id ASC
    `);

    const layersRes = await pool.query(`
      SELECT cell_id, features
      FROM sim_sector_layers
      WHERE z_layer = 0
    `);

    const grovesRes = await pool.query(`
      SELECT id, cell_id, dragon_name, power_domain, seal_strength
      FROM sim_sacred_groves
      ORDER BY id ASC
    `);

    const convergenceRes = await pool.query(`
      SELECT cell_id, intensity, type
      FROM sim_chaos_zones
      WHERE type = 'NEXUS_CHAOS_LEYS'
      ORDER BY intensity DESC LIMIT 10
    `);

    res.json({
      burgs: burgsRes.rows,
      paragons: paragonsRes.rows,
      sectorFeatures: layersRes.rows,
      prisons: grovesRes.rows,
      convergence: {
        name: "The Cruorbus Convergence Nexus",
        cell_id: 11429,
        description: "The planetary nexus where Cruorbus eclipse leylines align, channeling ambient primordial chaos through continental fault lines.",
        zones: convergenceRes.rows
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get fringe factions detail with their established subterranean lairs
observerRouter.get("/fringe_detail", async (req, res) => {
  try {
    const factionsRes = await pool.query(`
      SELECT o.*,
             COALESCE(SUM(l.manpower), 0)::int AS lair_manpower,
             (COALESCE(o.manpower, 0) + COALESCE(SUM(l.manpower), 0))::int AS total_manpower
      FROM sim_outlaw_factions o
      LEFT JOIN sim_fringe_lairs l ON l.faction_id = o.id
      GROUP BY o.id, o.name, o.type, o.origin_cell_id, o.manpower, o.worker_groups, o.wealth, o.heat, o.description, o.contraband_types
      ORDER BY o.name ASC
    `);
    const lairsRes = await pool.query(`
      SELECT l.*, b.name as burg_name
      FROM sim_fringe_lairs l
      LEFT JOIN sim_burg_economy b ON l.burg_id = b.burg_id
      ORDER BY l.id ASC
    `);
    res.json({
      factions: factionsRes.rows,
      lairs: lairsRes.rows
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Filtered event log API for specific sectors, burgs, or fringe factions
observerRouter.get("/filtered_events", async (req, res) => {
  try {
    const { burg_id, burg_name, faction_id, cell_id, keyword, tier, limit = 150 } = req.query;
    let query = "SELECT * FROM sim_events WHERE 1=1";
    const params: any[] = [];

    if (burg_id) {
      if (burg_name) {
        params.push(Number(burg_id));
        params.push(`%${burg_name}%`);
        query += ` AND (burg_id = $${params.length - 1} OR message ILIKE $${params.length})`;
      } else {
        params.push(Number(burg_id));
        query += ` AND burg_id = $${params.length}`;
      }
    }
    if (faction_id && keyword) {
      params.push(Number(faction_id));
      params.push(`%${keyword}%`);
      query += ` AND (faction_id = $${params.length - 1} OR message ILIKE $${params.length})`;
    } else if (faction_id) {
      params.push(Number(faction_id));
      query += ` AND faction_id = $${params.length}`;
    } else if (keyword) {
      const kw = String(keyword).trim();
      if (kw.toLowerCase() === 'convergence') {
        query += ` AND (message ILIKE '%Convergence%' OR message ILIKE '%Cruorbus%' OR message ILIKE '%Chaos Flow%' OR type IN ('CHAOS_SURGE', 'CONVERGENCE_ECLIPSE', 'SHADOW_WEEK_ECLIPSE', 'AURA_RIVER'))`;
      } else {
        params.push(`%${kw}%`);
        query += ` AND (message ILIKE $${params.length} OR type ILIKE $${params.length})`;
      }
    }
    if (tier && tier !== 'ALL') {
      params.push(tier);
      query += ` AND tier = $${params.length}`;
    }

    query += ` ORDER BY id DESC LIMIT ${Math.min(Number(limit), 300)}`;

    const eventsRes = await pool.query(query, params);
    res.json({ events: eventsRes.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Comprehensive Trophic Ecology telemetry: flora, fauna, predator-prey balance, and active anomalies
observerRouter.get("/ecology", async (req, res) => {
  try {
    const statsRes = await pool.query(`
      SELECT 
        ROUND(AVG(eco_plants)::numeric, 1) as avg_plants,
        ROUND(AVG(eco_prey)::numeric, 1) as avg_prey,
        ROUND(AVG(eco_predators)::numeric, 1) as avg_predators,
        ROUND(AVG(COALESCE(eco_apex, 5.0))::numeric, 1) as avg_apex,
        ROUND(AVG(COALESCE(eco_blight, 0.0))::numeric, 1) as avg_blight
      FROM sim_cells
    `);

    const predatorHotspots = await pool.query(`
      SELECT c.id as cell_id, c.eco_predators, c.eco_prey, b.name as nearby_burg
      FROM sim_cells c
      LEFT JOIN sim_burg_economy b ON ABS(b.cell_id - c.id) <= 6
      WHERE c.eco_predators > (c.eco_prey * 1.2) AND c.eco_predators >= 15
      ORDER BY c.eco_predators DESC
      LIMIT 5
    `);

    const chaosFloraHotspots = await pool.query(`
      SELECT c.id as cell_id, c.eco_plants, z.intensity, z.type as chaos_type, b.name as nearby_burg
      FROM sim_cells c
      JOIN sim_chaos_zones z ON c.id = z.cell_id
      LEFT JOIN sim_burg_economy b ON ABS(b.cell_id - c.id) <= 6
      WHERE z.intensity >= 30
      ORDER BY z.intensity DESC
      LIMIT 5
    `);

    const eventsRes = await pool.query(`
      SELECT * FROM sim_events
      WHERE type IN ('FLORA_MUTAGENESIS', 'HERBIVORE_CROP_RAID', 'STARVING_PREDATOR_MIGRATION', 'CHAOS_BEAST_MUTATION', 'TROPHIC_DISRUPTION')
      ORDER BY id DESC
      LIMIT 20
    `);

    res.json({
      averages: statsRes.rows[0],
      predatorHotspots: predatorHotspots.rows,
      chaosFloraHotspots: chaosFloraHotspots.rows,
      recentEvents: eventsRes.rows
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// The 12 Primordial Chaos Flows & Narrow Crossings
observerRouter.get("/chaos_flows", async (req, res) => {
  try {
    const flowsRes = await pool.query(`SELECT * FROM sim_chaos_flows ORDER BY flow_id ASC`);
    const calRes = await pool.query(`SELECT * FROM sim_calendar ORDER BY id DESC LIMIT 1`);
    const zonesSummary = await pool.query(`SELECT COUNT(*) as total_zones, ROUND(AVG(intensity)::numeric, 1) as avg_intensity FROM sim_chaos_zones`);

    const flows = flowsRes.rows.map(f => ({
      ...f,
      waypoints: typeof f.waypoints === "string" ? JSON.parse(f.waypoints) : f.waypoints,
      narrow_spots: typeof f.narrow_spots === "string" ? JSON.parse(f.narrow_spots) : f.narrow_spots,
      is_surging: Number(f.current_surge) >= 1.8,
      is_flooding: Number(f.current_surge) >= 2.4
    }));

    res.json({
      flows,
      calendar: calRes.rows[0] || null,
      zonesSummary: zonesSummary.rows[0]
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get notable citizens in a burg, highlighting their active narrative tags and emotional states
observerRouter.get("/burg_citizens", async (req, res) => {
  try {
    const { burg_id, limit = 20 } = req.query;
    if (!burg_id) {
      return res.status(400).json({ error: "burg_id is required" });
    }
    const citizensRes = await pool.query(`
      SELECT citizen_id, name, profession, species, spark_tier, temper, instinct, motivation, traits, life_stage, age
      FROM population_demographics
      WHERE settlement_id = $1 AND allegiance_status = 'CIVILIAN'
      ORDER BY 
        CASE WHEN traits::text LIKE '%#%' THEN 0 ELSE 1 END,
        citizen_id ASC
      LIMIT $2
    `, [Number(burg_id), Math.min(Number(limit), 50)]);

    const paragonsRes = await pool.query(`
      SELECT id, name, title, traits, corruption_score
      FROM sim_paragons
      WHERE burg_id = $1
    `, [Number(burg_id)]);

    res.json({
      burg_id: Number(burg_id),
      citizens: citizensRes.rows,
      paragons: paragonsRes.rows
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Comprehensive Metaphysics & Cosmic Telemetry: Dragon Prisons, Grey Wardens, Eyeless Elders, Ancient Wards & Cults
observerRouter.get("/metaphysics", async (req, res) => {
  try {
    const grovesRes = await pool.query(`
      SELECT id, cell_id, dragon_name, power_domain, seal_strength
      FROM sim_sacred_groves
      ORDER BY seal_strength ASC
    `);

    const wardsRes = await pool.query(`
      SELECT 
        COUNT(*) as total_wards,
        COUNT(*) FILTER (WHERE is_charged = true) as charged_wards,
        COUNT(*) FILTER (WHERE is_charged = false) as recharging_wards
      FROM sim_ancient_path_wards
    `);

    const wardensRes = await pool.query(`
      SELECT sub_role, state, COUNT(*) as count, ROUND(AVG(corruption)::numeric, 1) as avg_corruption, ROUND(AVG(age_ticks)::numeric, 1) as avg_age
      FROM sim_agents
      WHERE role = 'Warden'
      GROUP BY sub_role, state
    `);

    const cultistsRes = await pool.query(`
      SELECT state, sub_role, COUNT(*) as count, ROUND(AVG(corruption)::numeric, 1) as avg_corruption
      FROM sim_agents
      WHERE role = 'Cultist'
      GROUP BY state, sub_role
    `);

    const hermitsRes = await pool.query(`
      SELECT COUNT(*) as mad_hermits FROM sim_agents WHERE role = 'Mad_Hermit'
    `);

    const recentEventsRes = await pool.query(`
      SELECT tick, type, message, tier, cell_id, lore_date
      FROM sim_events
      WHERE type IN (
        'WARDEN_FINAL_SACRIFICE',
        'WARDEN_ANCIENT_WARD_AWAKENING',
        'SPARKBORN_DRIVEN_MAD',
        'WARDEN_VOW_TAKEN',
        'WARDEN_BECOMES_EYELESS_ELDER',
        'EYELESS_ELDER_CRYPT_VIGIL',
        'WORLD_ENDING_APOCALYPSE',
        'CULT_PRIEST_ASCENSION',
        'WARDEN_CLASH'
      )
      ORDER BY id DESC
      LIMIT 25
    `);

    res.json({
      dragon_groves: grovesRes.rows,
      ancient_wards: wardsRes.rows[0],
      wardens: wardensRes.rows,
      cultists: cultistsRes.rows,
      mad_hermits: parseInt(hermitsRes.rows[0]?.mad_hermits || '0'),
      recent_events: recentEventsRes.rows
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Trigger Controlled Instability Crises (Famine & Bandits, Chaos Surge & Abandonment, Hard Winter, Corrupt Leader Embargo, Border War)
observerRouter.post("/trigger_crisis", async (req, res) => {
  try {
    const { type, cellId: rawCellId, burgId: rawBurgId, intensity = 85 } = req.body;
    let cellId = Number(rawCellId) || 0;
    let burgId = Number(rawBurgId) || 0;

    // Resolve cell/burg if only one provided
    if (burgId && !cellId) {
      const bRes = await pool.query("SELECT cell_id FROM sim_burg_economy WHERE burg_id = $1", [burgId]);
      if (bRes.rows.length > 0) cellId = Number(bRes.rows[0].cell_id);
    } else if (cellId && !burgId) {
      const bRes = await pool.query("SELECT burg_id FROM sim_burg_economy WHERE cell_id = $1", [cellId]);
      if (bRes.rows.length > 0) burgId = Number(bRes.rows[0].burg_id);
    }

    if (!cellId) cellId = 11081; // Default Holgaland core cell

    const calRes = await pool.query("SELECT tick, year, month_name, day_of_month FROM sim_calendar ORDER BY id DESC LIMIT 1");
    const row = calRes.rows[0];
    const tick = Number(row?.tick || 1);
    const loreDate = row ? `Year ${row.year}, ${row.month_name} Day ${row.day_of_month}` : `Year 31, Month 12, Day 40`;

    let eventMessage = "";
    let eventType = type;
    let eventTier = "MAJOR";

    switch (type) {
      case "CHAOS_SURGE": {
        eventType = "CHAOS_SURGE";
        eventTier = "CRITICAL";
        // 1. Spike chaos zone intensity to 95
        await pool.query(`
          INSERT INTO sim_chaos_zones (cell_id, intensity, type)
          VALUES ($1, $2, 'PRIMORDIAL_CHAOS_SURGE')
          ON CONFLICT (cell_id, type) DO UPDATE SET intensity = EXCLUDED.intensity
        `, [cellId, Math.max(85, intensity)]);

        // 2. Infect burg with unrest & blight
        if (burgId) {
          await pool.query(`
            UPDATE sim_burg_economy
            SET unrest = LEAST(100, unrest + 35),
                health = GREATEST(10, health - 30),
                food = GREATEST(0, food - 500)
            WHERE burg_id = $1
          `, [burgId]);
        }

        eventMessage = `⚡ PRIMORDIAL CHAOS SURGE: An unpredictable aether rupture tore through Cell #${cellId}! Reality warped at ${intensity}% intensity, withering local crops and driving citizens into chaos panic!`;
        break;
      }

      case "DEEP_COLD_FREEZE": {
        eventType = "HARSH_WINTER_FREEZE";
        eventTier = "MAJOR";
        // 1. Shift calendar to The Deep Cold
        await pool.query(`
          UPDATE sim_calendar
          SET season = 'The Deep Cold', month_name = 'Lophex'
          WHERE id = (SELECT id FROM sim_calendar ORDER BY id DESC LIMIT 1)
        `);

        // 2. Drop cell temperature to sub-zero
        await pool.query(`UPDATE sim_cells SET current_temp = -18 WHERE id = $1`, [cellId]);

        // 3. Freeze burg granaries and food stores
        if (burgId) {
          await pool.query(`
            UPDATE sim_burg_economy
            SET food = GREATEST(0, (food * 0.4)::int),
                unrest = LEAST(100, unrest + 20)
            WHERE burg_id = $1
          `, [burgId]);
        }

        eventMessage = `❄️ DEEP COLD BLIZZARD: A catastrophic arctic freeze gripped Cell #${cellId} (-18°C)! Farmlands froze solid, granary reserves rotted in uninsulated silos, and severe food rationing commenced!`;
        break;
      }

      case "FAMINE_BANDIT_REVOLT": {
        eventType = "BANDIT_RAIDERS_EMERGE";
        eventTier = "CRITICAL";
        // 1. Empty burg food
        if (burgId) {
          await pool.query(`
            UPDATE sim_burg_economy
            SET food = 0,
                unrest = LEAST(100, unrest + 40),
                pop_null = GREATEST(12, pop_null - 60)
            WHERE burg_id = $1
          `, [burgId]);
        }

        // 2. Siphon 60 defectors into outlaw cartels
        await pool.query(`
          UPDATE sim_outlaw_factions
          SET manpower = manpower + 60
          WHERE id = (SELECT id FROM sim_outlaw_factions ORDER BY RANDOM() LIMIT 1)
        `);

        eventMessage = `🍞 FAMINE & BANDIT REBELLION: Total grain exhaustion in Cell #${cellId} drove 60 starving laborers and garrison deserters into the surrounding hills as roving highway bandits, cutting off supply lines!`;
        break;
      }

      case "CORRUPT_EMBEZZLE_EMBARGO": {
        eventType = "COMPASS_TRADE_EMBARGO";
        eventTier = "MAJOR";
        // 1. Corrupt the local mayor
        if (burgId) {
          await pool.query(`
            UPDATE sim_paragons
            SET corruption_score = 95
            WHERE burg_id = $1 AND title ILIKE '%Mayor%'
          `, [burgId]);

          // 2. Empty municipal treasury
          await pool.query(`
            UPDATE sim_burg_economy
            SET wealth = GREATEST(0, wealth - 400),
                unrest = LEAST(100, unrest + 25)
            WHERE burg_id = $1
          `, [burgId]);
        }

        // 3. Inject CompassEmbargo tag into sector features
        await pool.query(`
          UPDATE sim_sector_layers
          SET features = jsonb_set(
            COALESCE(features, '{}'::jsonb),
            '{environmental_tags}',
            COALESCE(features->'environmental_tags', '[]'::jsonb) || '["#CompassEmbargo", "#TradeBlockaded"]'::jsonb
          )
          WHERE cell_id = $1
        `, [cellId]);

        eventMessage = `⚖️ GILDED COMPASS TRADE EMBARGO: Local authorities in Cell #${cellId} were caught embezzling municipal treasury funds and defaulting on mercantile credit! The Gilded Compass has declared an immediate trade blockade, freezing commercial shipping!`;
        break;
      }

      case "BORDER_WAR": {
        eventType = "DECLARE_WAR";
        eventTier = "CRITICAL";
        // 1. Find cell faction and adjacent rival faction
        const cellRes = await pool.query("SELECT faction_id FROM sim_cells WHERE id = $1", [cellId]);
        const myFactionId = Number(cellRes.rows[0]?.faction_id || 1);

        const borderRes = await pool.query(`
          SELECT CASE WHEN faction_a = $1 THEN faction_b ELSE faction_a END AS enemy_id
          FROM sim_faction_borders
          WHERE faction_a = $1 OR faction_b = $1
          LIMIT 1
        `, [myFactionId]);

        const enemyFactionId = Number(borderRes.rows[0]?.enemy_id || (myFactionId === 1 ? 2 : 1));
        const fA = Math.min(myFactionId, enemyFactionId);
        const fB = Math.max(myFactionId, enemyFactionId);

        // 2. Set diplomacy to WAR with max tension
        await pool.query(`
          INSERT INTO sim_diplomacy (faction_a_id, faction_b_id, status, tension)
          VALUES ($1, $2, 'WAR', 100)
          ON CONFLICT (faction_a_id, faction_b_id) DO UPDATE SET status = 'WAR', tension = 100
        `, [fA, fB]);

        const [fName1, fName2] = await Promise.all([
          pool.query("SELECT name FROM sim_factions WHERE id = $1", [myFactionId]),
          pool.query("SELECT name FROM sim_factions WHERE id = $1", [enemyFactionId])
        ]);

        const n1 = fName1.rows[0]?.name || `Faction ${myFactionId}`;
        const n2 = fName2.rows[0]?.name || `Faction ${enemyFactionId}`;

        eventMessage = `⚔️ BORDER WAR ERUPTION: Geopolitical tensions along the frontier of Cell #${cellId} have ignited! ${n1} and ${n2} have entered open WAR, deploying legion detachments to the front!`;
        break;
      }

      default:
        return res.status(400).json({ error: `Unknown crisis type: ${type}` });
    }

    // Insert logged event
    await pool.query(
      `INSERT INTO sim_events (tick, type, message, tier, cell_id, burg_id, lore_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [tick, eventType, eventMessage, eventTier, cellId, burgId || null, loreDate]
    );

    res.json({
      success: true,
      crisis: type,
      cellId,
      burgId,
      event: {
        tick,
        type: eventType,
        tier: eventTier,
        message: eventMessage,
        loreDate
      }
    });
  } catch (err: any) {
    console.error("Crisis trigger error:", err);
    res.status(500).json({ error: err.message });
  }
});

observerRouter.post("/reset", async (req, res) => {
  if (tickInProgress) {
    return res.status(429).json({ error: "Cannot reset while a tick is in progress." });
  }
  if (resetInProgress) {
    return res.status(429).json({ error: "Reset already in progress." });
  }

  // Halt background autoplay during world reset to prevent race conditions
  if (autoplayTimer) {
    clearInterval(autoplayTimer);
    autoplayTimer = null;
  }

  resetInProgress = true;
  try {
    console.log("[API] World reset requested...");
    const result = await resetWorld();
    console.log("[API] World reset complete:", result.stats);
    res.json(result);
  } catch (error: any) {
    console.error("Reset error:", error.message);
    res.status(500).json({ error: error.message || "Reset failed" });
  } finally {
    resetInProgress = false;
  }
});

export default observerRouter;
