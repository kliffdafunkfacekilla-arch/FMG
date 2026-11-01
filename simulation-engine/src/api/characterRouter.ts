import { Router } from 'express';
import pool from '../db/pool';

const router = Router();

// Create Character
router.post('/create', async (req, res) => {
  try {
    const body = req.body || {};
    const { sessionId, name, type, creature_type, attributes } = body;
    const attrs = (attributes && typeof attributes === 'object') ? attributes : {};

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required to create a session character' });
    }

    const charName = String(name || 'Hero').trim().slice(0, 50);
    const charType = String(type || 'Standard').trim().slice(0, 50);
    const charCreature = String(creature_type || 'Humanoid').trim().slice(0, 50);

    const might = Math.max(1, Math.min(30, Number(attrs.might) || 10));
    const endurance = Math.max(1, Math.min(30, Number(attrs.endurance) || 10));
    const finesse = Math.max(1, Math.min(30, Number(attrs.finesse) || 10));
    const reflex = Math.max(1, Math.min(30, Number(attrs.reflex) || 10));
    const vitality = Math.max(1, Math.min(30, Number(attrs.vitality) || 10));
    const fortitude = Math.max(1, Math.min(30, Number(attrs.fortitude) || 10));
    const knowledge = Math.max(1, Math.min(30, Number(attrs.knowledge) || 10));
    const logic = Math.max(1, Math.min(30, Number(attrs.logic) || 10));
    const awareness = Math.max(1, Math.min(30, Number(attrs.awareness) || 10));
    const intuition = Math.max(1, Math.min(30, Number(attrs.intuition) || 10));
    const charm = Math.max(1, Math.min(30, Number(attrs.charm) || 10));
    const willpower = Math.max(1, Math.min(30, Number(attrs.willpower) || 10));

    // Default pools based on derived math
    const health = vitality * 10;
    const stamina = endurance * 5;
    const composure = willpower * 3 + charm;
    const focus = logic * 4 + knowledge;

    // Initial position on grid
    const grid_x = Math.floor(Math.random() * 5) + 2;
    const grid_y = Math.floor(Math.random() * 5) + 2;

    const result = await pool.query(
      `INSERT INTO player_characters (
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
      ) RETURNING character_id;`,
      [
        sessionId, charName, charType, charCreature,
        might, endurance, finesse, reflex, vitality, fortitude,
        knowledge, logic, awareness, intuition, charm, willpower,
        health, health, stamina, stamina,
        composure, composure, focus, focus,
        grid_x, grid_y
      ]
    );

    res.json({ success: true, characterId: result.rows[0].character_id });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
