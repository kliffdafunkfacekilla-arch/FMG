import { Router } from "express";
import pool from "../db/pool";
import { executeMasterTick } from "../engine/masterOrchestrator";
import { resetWorld } from "../engine/resetWorld";

const observerRouter = Router();

// Concurrency guard - prevents tick spam from stacking up
let tickInProgress = false;
let resetInProgress = false;

// GET /state
observerRouter.get("/state", async (req, res) => {
  try {
    const factions = await pool.query("SELECT * FROM sim_factions");
    const fringeFactions = await pool.query("SELECT * FROM sim_fringe_factions");
    const cells = await pool.query(
      `SELECT id, faction_id, biome, geometry, eco_plants, eco_prey, eco_predators, eco_resources, elevation, z_layer FROM sim_cells WHERE z_layer = ${req.query.z || 0}`
    );
    const events = await pool.query(
      "SELECT * FROM sim_events ORDER BY tick DESC, id DESC LIMIT 100"
    );
    const chaosZones = await pool.query("SELECT * FROM sim_chaos_zones");
    const economy = await pool.query("SELECT * FROM sim_burg_economy");
    const agents = await pool.query("SELECT * FROM sim_agents");
    const sacredGroves = await pool.query("SELECT * FROM sim_sacred_groves");
    const calendar = await pool.query("SELECT * FROM sim_calendar ORDER BY id DESC LIMIT 1");
    const outlaws = await pool.query("SELECT * FROM sim_outlaw_factions");

    res.json({
      factions: factions.rows,
      fringeFactions: fringeFactions.rows,
      cells: cells.rows.map((c) => ({
        ...c,
        geometry: typeof c.geometry === "string" ? JSON.parse(c.geometry) : c.geometry,
      })),
      events: events.rows,
      chaosZones: chaosZones.rows,
      economy: economy.rows.map((e) => ({
        ...e,
        demographics: e.demographics ? (typeof e.demographics === "string" ? JSON.parse(e.demographics) : e.demographics) : {},
        military_forces: e.military_forces ? (typeof e.military_forces === "string" ? JSON.parse(e.military_forces) : e.military_forces) : {},
      })),
      agents: agents.rows,
      sacredGroves: sacredGroves.rows,
      calendar: calendar.rows[0] || null,
      outlaws: outlaws.rows,
      tickInProgress,
      resetInProgress,
    });
  } catch (error: any) {
    console.error("Observer state error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /tick - guarded against concurrent requests
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
    console.error("Tick error:", error.message);
    res.status(500).json({ error: error.message || "Tick failed" });
  } finally {
    tickInProgress = false;
  }
});

// POST /reset - wipe and reseed the entire world from aetheria.sqlite
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
