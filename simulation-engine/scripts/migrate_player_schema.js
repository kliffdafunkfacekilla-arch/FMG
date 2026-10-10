const pg = require('pg');
const { Pool } = pg;
const pool = new Pool({ connectionString: 'postgres://postgres:YOUR_PASSWORD@127.0.0.1:5432/postgres' });

async function migrate() {
  const sql = `
    ALTER TABLE sim_player_character ADD COLUMN IF NOT EXISTS kingdom VARCHAR(50) DEFAULT 'Mammal';
    ALTER TABLE sim_player_character ADD COLUMN IF NOT EXISTS lineage VARCHAR(50) DEFAULT 'Ursine';
    ALTER TABLE sim_player_character ADD COLUMN IF NOT EXISTS institution VARCHAR(50) DEFAULT 'Mass';
    ALTER TABLE sim_player_character ADD COLUMN IF NOT EXISTS species VARCHAR(50) DEFAULT 'Bear';
    ALTER TABLE sim_player_character ADD COLUMN IF NOT EXISTS passive_traits JSONB DEFAULT '[]'::jsonb;
    ALTER TABLE sim_player_character ADD COLUMN IF NOT EXISTS skills JSONB DEFAULT '[]'::jsonb;
    ALTER TABLE sim_player_character ADD COLUMN IF NOT EXISTS mastery_perks JSONB DEFAULT '[]'::jsonb;
    ALTER TABLE sim_player_character ADD COLUMN IF NOT EXISTS stamina_max INT DEFAULT 10;
    ALTER TABLE sim_player_character ADD COLUMN IF NOT EXISTS focus_max INT DEFAULT 10;
    ALTER TABLE sim_player_character ADD COLUMN IF NOT EXISTS phys_defense INT DEFAULT 0;
    ALTER TABLE sim_player_character ADD COLUMN IF NOT EXISTS speed INT DEFAULT 0;
    ALTER TABLE sim_player_character ADD COLUMN IF NOT EXISTS gear_tax_total INT DEFAULT 0;
  `;
  await pool.query(sql);
  console.log('ALTER TABLE sim_player_character successful');
  await pool.end();
}

migrate().catch(e => {
  console.error(e);
  process.exit(1);
});
