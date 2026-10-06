"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const pool_1 = __importDefault(require("../db/pool"));
const loreCodex_1 = require("./loreCodex");
const tellerRouter = (0, express_1.Router)();
// GET /burg/:id
tellerRouter.get("/burg/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const burgRes = await pool_1.default.query(`SELECT * FROM sim_burg_economy WHERE burg_id = $1`, [id]);
        const burg = burgRes.rows[0];
        if (!burg) {
            return res.status(404).json({ error: "Burg not found" });
        }
        const inventoryRes = await pool_1.default.query(`SELECT complex_inventory FROM sim_industrial_stockpiles WHERE burg_id = $1`, [id]);
        const complex_inventory = inventoryRes.rows[0]?.complex_inventory || null;
        const historyRes = await pool_1.default.query(`SELECT tick, tier, lore_date, burg_id, faction_id, type, message FROM sim_events WHERE burg_id = $1 ORDER BY id DESC`, [id]);
        const history = historyRes.rows;
        let species_demographics = {};
        let military_forces = {};
        let parsed_inventory = {};
        try {
            if (burg.species_demographics)
                species_demographics = typeof burg.species_demographics === "string" ? JSON.parse(burg.species_demographics) : burg.species_demographics;
            if (burg.military_forces)
                military_forces = typeof burg.military_forces === "string" ? JSON.parse(burg.military_forces) : burg.military_forces;
            if (complex_inventory)
                parsed_inventory = typeof complex_inventory === "string" ? JSON.parse(complex_inventory) : complex_inventory;
        }
        catch (e) {
            console.warn(`Failed to parse JSON for burg ${id}`);
        }
        const enriched = {
            ...burg,
            species_demographics,
            military_forces,
            complex_inventory: parsed_inventory,
            history,
            lore: loreCodex_1.LoreCodex
        };
        res.json(enriched);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// GET /map/ground/:cell_id
tellerRouter.get("/map/ground/:cell_id", async (req, res) => {
    const { cell_id } = req.params;
    try {
        const [terrainRes, burgRes, infraRes, agentsRes, outlawsRes] = await Promise.all([
            pool_1.default.query(`SELECT * FROM sim_cells WHERE id = $1`, [cell_id]),
            pool_1.default.query(`SELECT * FROM sim_burg_economy WHERE cell_id = $1`, [cell_id]),
            pool_1.default.query(`SELECT * FROM sim_infrastructure WHERE cell_id = $1`, [cell_id]),
            pool_1.default.query(`SELECT * FROM sim_agents WHERE location_cell_id = $1`, [cell_id]),
            pool_1.default.query(`SELECT * FROM sim_outlaw_factions WHERE origin_cell_id = $1`, [cell_id])
        ]);
        const terrain = terrainRes.rows[0] || null;
        const burg = burgRes.rows[0] || null;
        const infrastructure = infraRes.rows;
        const agents = agentsRes.rows;
        const outlaws = outlawsRes.rows;
        let paragons = [];
        if (burg && burg.burg_id) {
            const paragonsRes = await pool_1.default.query(`SELECT * FROM sim_paragons WHERE burg_id = $1`, [burg.burg_id]);
            paragons = paragonsRes.rows;
        }
        res.json({
            terrain,
            burg,
            infrastructure,
            agents,
            outlaws,
            paragons
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// GET /history
tellerRouter.get("/history", async (req, res) => {
    try {
        const eventsRes = await pool_1.default.query(`SELECT tick, tier, lore_date, burg_id, faction_id, type, message FROM sim_events WHERE tier = 'MAJOR' ORDER BY id DESC`);
        res.json(eventsRes.rows);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// GET /rumors
tellerRouter.get("/rumors", async (req, res) => {
    try {
        const eventsRes = await pool_1.default.query(`SELECT tick, tier, lore_date, burg_id, faction_id, type, message FROM sim_events WHERE tier = 'MINOR' ORDER BY id DESC`);
        res.json(eventsRes.rows);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = tellerRouter;
//# sourceMappingURL=tellerRouter.js.map