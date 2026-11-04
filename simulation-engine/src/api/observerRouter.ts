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
    const economy = await pool.query("SELECT b.burg_id, b.food, b.wealth, b.unrest, b.health, b.pop_null, b.crime_rate, b.military_forces, b.demographics, b.species_demographics, b.cell_id, c.faction_id FROM sim_burg_economy b JOIN sim_cells c ON b.cell_id = c.id");
    const agents = await pool.query("SELECT * FROM sim_agents");
    const sacredGroves = await pool.query("SELECT * FROM sim_sacred_groves");
    const calendar = await pool.query("SELECT * FROM sim_calendar ORDER BY id DESC LIMIT 1");
    const outlaws = await pool.query("SELECT * FROM sim_outlaw_factions");
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
      SELECT * FROM sim_outlaw_factions ORDER BY name ASC
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
    const { burg_id, cell_id, keyword, tier, limit = 150 } = req.query;
    let query = "SELECT * FROM sim_events WHERE 1=1";
    const params: any[] = [];

    if (burg_id) {
      params.push(Number(burg_id));
      query += ` AND burg_id = $${params.length}`;
    }
    if (cell_id) {
      params.push(`%${cell_id}%`);
      query += ` AND message ILIKE $${params.length}`;
    }
    if (keyword) {
      params.push(`%${keyword}%`);
      query += ` AND message ILIKE $${params.length}`;
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

observerRouter.post("/reset", async (req, res) => {
  if (tickInProgress) {
    return res.status(429).json({ error: "Cannot reset while a tick is in progress." });
  }
  if (resetInProgress) {
    return res.status(429).json({ error: "Reset already in progress." });
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
