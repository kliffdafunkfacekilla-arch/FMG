"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const pool_1 = __importDefault(require("../db/pool"));
const router = (0, express_1.Router)();
// Create Character
router.post('/create', async (req, res) => {
    try {
        const { sessionId, name, type, creature_type, attributes } = req.body;
        // Default pools based on derived math
        // Health = Vitality * 10
        // Stamina = Endurance * 5
        // Composure = Willpower * 3 + Charm
        // Focus = Logic * 4 + Knowledge
        const health = (attributes.vitality || 10) * 10;
        const stamina = (attributes.endurance || 10) * 5;
        const composure = (attributes.willpower || 10) * 3 + (attributes.charm || 10);
        const focus = (attributes.logic || 10) * 4 + (attributes.knowledge || 10);
        // Initial position on grid
        const grid_x = Math.floor(Math.random() * 5) + 2;
        const grid_y = Math.floor(Math.random() * 5) + 2;
        const result = await pool_1.default.query(`INSERT INTO player_characters (
        session_id, name, type, creature_type,
        might, endurance, finesse, reflex, vitality, fortitude,
        knowledge, logic, awareness, intuition, charm, willpower,
        health_current, health_max, stamina_current, stamina_max,
        composure_current, composure_max, focus_current, focus_max,
        grid_x, grid_y
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16,
        $17, $18, $19, $20,
        $21, $22, $23, $24,
        $25, $26
      ) RETURNING character_id;`, [
            sessionId, name, type, creature_type,
            attributes.might, attributes.endurance, attributes.finesse, attributes.reflex, attributes.vitality, attributes.fortitude,
            attributes.knowledge, attributes.logic, attributes.awareness, attributes.intuition, attributes.charm, attributes.willpower,
            health, health, stamina, stamina,
            composure, composure, focus, focus,
            grid_x, grid_y
        ]);
        res.json({ success: true, characterId: result.rows[0].character_id });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
exports.default = router;
//# sourceMappingURL=characterRouter.js.map