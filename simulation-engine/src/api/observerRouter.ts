import { Router } from "express";
import pool from "../db/pool";
import { executeMasterTick } from "../engine/masterOrchestrator";
import { resetWorld } from "../engine/resetWorld";

const observerRouter = Router();
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
    const cells = await pool.query(`SELECT id, faction_id, biome, geometry, eco_plants, eco_prey, eco_predators, eco_resources, elevation, z_layer FROM sim_cells WHERE z_layer = $1`, [z]);
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
