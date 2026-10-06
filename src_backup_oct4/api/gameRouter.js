"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const pool_1 = __importDefault(require("../db/pool"));
const subMapEngine_1 = require("../engine/subMapEngine");
const router = (0, express_1.Router)();
// Create New Game
router.post('/new', async (req, res) => {
    try {
        const { name } = req.body;
        // Ensure a world exists to connect to
        let regionalId = 1;
        const existingRegions = await pool_1.default.query('SELECT regional_id FROM regional_cells LIMIT 1');
        if (existingRegions.rows.length === 0) {
            // Create absolute fallback Genesis hierarchy
            try {
                await pool_1.default.query('INSERT INTO world_metadata (seed, resolution, axial_tilt, days_per_year) VALUES ($1, 200, 23.5, 365) ON CONFLICT DO NOTHING', ['Genesis']);
                await pool_1.default.query('INSERT INTO global_cells (cell_id, seed, face_index, base_climate, tectonic_stress, node_type, coordinate) VALUES (1, $1, 1, 0, 0, $2, $3) ON CONFLICT DO NOTHING', ['Genesis', 'source', '{}']);
                await pool_1.default.query('INSERT INTO regional_cells (regional_id, global_cell_id, local_x, local_y, elevation, name, biome_id, temperature, moisture, population) VALUES (1, 1, 0, 0, 100, $1, 1, 25.0, 0.8, 0) ON CONFLICT DO NOTHING', ['Genesis Region']);
            }
            catch (e) {
                console.warn("Fallback genesis creation warn:", e);
            }
        }
        else {
            regionalId = existingRegions.rows[0].regional_id;
        }
        // Ensure a local cell exists for this region to host the map
        const localCheck = await pool_1.default.query('SELECT local_id FROM local_cells WHERE regional_id = $1 LIMIT 1', [regionalId]);
        let localId = 1;
        if (localCheck.rows.length === 0) {
            const insertLocal = await pool_1.default.query("INSERT INTO local_cells (regional_id, local_x, local_y, elevation, ecological_vector) VALUES ($1, 50, 50, 0.2, '{}') RETURNING local_id", [regionalId]);
            localId = insertLocal.rows[0].local_id;
        }
        else {
            localId = localCheck.rows[0].local_id;
        }
        // Now safely create the sub-map
        const mapId = await (0, subMapEngine_1.generateSubMapInterior)({
            localId: localId,
            width: 20,
            height: 15
        });
        const sessionRes = await pool_1.default.query(`INSERT INTO game_sessions (name, current_sub_map_id) VALUES ($1, $2) RETURNING session_id;`, [name || 'New Session', mapId]);
        res.json({ success: true, sessionId: sessionRes.rows[0].session_id, mapId });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// Load Game Sessions
router.get('/list', async (req, res) => {
    try {
        const sessions = await pool_1.default.query(`SELECT * FROM game_sessions ORDER BY last_saved_at DESC;`);
        res.json({ sessions: sessions.rows });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// Get Game State (Map + Characters)
router.get('/:id/state', async (req, res) => {
    try {
        const sessionId = req.params.id;
        const sessionRes = await pool_1.default.query(`SELECT * FROM game_sessions WHERE session_id = $1`, [sessionId]);
        if (sessionRes.rows.length === 0)
            return res.status(404).json({ error: "Not found" });
        const session = sessionRes.rows[0];
        let map = null;
        if (session.current_sub_map_id) {
            const mapRes = await pool_1.default.query(`SELECT * FROM interior_sub_maps WHERE sub_map_id = $1`, [session.current_sub_map_id]);
            if (mapRes.rows.length > 0) {
                map = mapRes.rows[0];
            }
        }
        const charRes = await pool_1.default.query(`SELECT * FROM player_characters WHERE session_id = $1`, [sessionId]);
        let npcs = [];
        if (session.current_sub_map_id) {
            const npcRes = await pool_1.default.query(`SELECT * FROM npc_entities WHERE sub_map_id = $1 AND hp_current > 0`, [session.current_sub_map_id]);
            npcs = npcRes.rows;
        }
        res.json({
            session,
            map,
            characters: charRes.rows,
            npcs
        });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
exports.default = router;
//# sourceMappingURL=gameRouter.js.map