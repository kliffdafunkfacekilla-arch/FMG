"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const pool_1 = __importDefault(require("../db/pool"));
const masterOrchestrator_1 = require("../engine/masterOrchestrator");
const resetWorld_1 = require("../engine/resetWorld");
const observerRouter = (0, express_1.Router)();
let tickInProgress = false;
let resetInProgress = false;
observerRouter.get("/map", async (req, res) => {
    try {
        const z = parseInt(req.query.z) || 0;
        const cells = await pool_1.default.query(`SELECT id, faction_id, biome, geometry, eco_plants, eco_prey, eco_predators, eco_resources, elevation, z_layer FROM sim_cells WHERE z_layer = $1`, [z]);
        res.json({ cells: cells.rows.map(c => ({ ...c, geometry: typeof c.geometry === "string" ? (function () { try {
                    return JSON.parse(c.geometry);
                }
                catch (e) {
                    return null;
                } })() : c.geometry })) });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
observerRouter.get("/state", async (req, res) => {
    try {
        const factions = await pool_1.default.query("SELECT * FROM sim_factions");
        const events = await pool_1.default.query("SELECT * FROM sim_events ORDER BY tick DESC, id DESC LIMIT 100");
        const chaosZones = await pool_1.default.query("SELECT * FROM sim_chaos_zones");
        const economy = await pool_1.default.query("SELECT burg_id, food, wealth, unrest, health, pop_null, crime_rate, military_forces, demographics, species_demographics, cell_id FROM sim_burg_economy");
        const agents = await pool_1.default.query("SELECT * FROM sim_agents");
        const sacredGroves = await pool_1.default.query("SELECT * FROM sim_sacred_groves");
        const calendar = await pool_1.default.query("SELECT * FROM sim_calendar ORDER BY id DESC LIMIT 1");
        const outlaws = await pool_1.default.query("SELECT * FROM sim_outlaw_factions");
        const prices = await pool_1.default.query("SELECT * FROM sim_commodity_prices ORDER BY commodity");
        res.json({
            factions: factions.rows,
            fringeFactions: outlaws.rows,
            cells: [],
            events: events.rows,
            chaosZones: chaosZones.rows,
            economy: economy.rows.map((e) => ({
                ...e,
                demographics: e.demographics ? (typeof e.demographics === "string" ? (function () { try {
                    return JSON.parse(e.demographics);
                }
                catch (e) {
                    return {};
                } })() : e.demographics) : {},
                military_forces: e.military_forces ? (typeof e.military_forces === "string" ? (function () { try {
                    return JSON.parse(e.military_forces);
                }
                catch (e) {
                    return {};
                } })() : e.military_forces) : {},
            })),
            agents: agents.rows,
            sacredGroves: sacredGroves.rows,
            calendar: calendar.rows[0] || null,
            outlaws: outlaws.rows,
            prices: prices.rows,
            tickInProgress,
            resetInProgress,
        });
    }
    catch (error) {
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
        const result = await (0, masterOrchestrator_1.executeMasterTick)();
        res.json(result);
    }
    catch (error) {
        console.error("Tick error:", error.stack);
        res.status(500).json({ error: error.message || "Tick failed" });
    }
    finally {
        tickInProgress = false;
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
        const result = await (0, resetWorld_1.resetWorld)();
        console.log("[API] World reset complete:", result.stats);
        res.json(result);
    }
    catch (error) {
        console.error("Reset error:", error.message);
        res.status(500).json({ error: error.message || "Reset failed" });
    }
    finally {
        resetInProgress = false;
    }
});
exports.default = observerRouter;
//# sourceMappingURL=observerRouter.js.map