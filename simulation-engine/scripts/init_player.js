const { generateCharacter } = require('../dist/engine/rpg/CharacterGenerator.js');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgres://postgres:YOUR_PASSWORD@127.0.0.1:5432/postgres' });

async function initPlayer() {
    const stats = generateCharacter();
    const composure = stats.willpower + stats.charm + stats.might;
    await pool.query(`
        INSERT INTO sim_player_character 
        (name, might, endurance, finesse, reflex, vitality, fortitude, knowledge, logic, awareness, intuition, charm, willpower, current_hp, max_hp, composure, equipped_armor, equipped_weapon)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
    `, [
        "Player", stats.might, stats.endurance, stats.finesse, stats.reflex, stats.vitality, stats.fortitude,
        stats.knowledge, stats.logic, stats.awareness, stats.intuition, stats.charm, stats.willpower,
        stats.maxHp, stats.maxHp, composure, "Chainmail", "Dueling Blades"
    ]);
    console.log("Player Generated and Inserted!");
    process.exit(0);
}
initPlayer();
