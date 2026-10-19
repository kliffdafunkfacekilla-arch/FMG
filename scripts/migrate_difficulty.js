const { Pool } = require('../simulation-engine/node_modules/pg');
require('../simulation-engine/node_modules/dotenv').config({ path: require('path').join(__dirname, '../simulation-engine/.env') });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  await pool.query("ALTER TABLE sim_player_character ADD COLUMN IF NOT EXISTS difficulty VARCHAR(20) DEFAULT 'survivor';");
  await pool.query("ALTER TABLE sim_game_saves ADD COLUMN IF NOT EXISTS difficulty VARCHAR(20) DEFAULT 'survivor';");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sim_character_memorials (
      id SERIAL PRIMARY KEY,
      player_name VARCHAR(100),
      kingdom VARCHAR(50),
      species VARCHAR(50),
      lineage VARCHAR(50),
      level INT DEFAULT 1,
      gold INT DEFAULT 0,
      equipped_weapon VARCHAR(100),
      equipped_armor VARCHAR(100),
      sector_x INT,
      sector_y INT,
      difficulty VARCHAR(20) DEFAULT 'hardcore',
      cause_of_death TEXT,
      fallen_at TIMESTAMP DEFAULT NOW()
    );
  `);
  console.log('Migration successful: difficulty columns and sim_character_memorials created.');
  pool.end();
}

migrate().catch(e => {
  console.error(e);
  process.exit(1);
});
