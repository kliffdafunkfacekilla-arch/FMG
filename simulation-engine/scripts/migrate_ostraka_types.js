const { Pool } = require("pg");

const pool = new Pool({
  connectionString: "postgres://postgres:YOUR_PASSWORD@127.0.0.1:5432/postgres"
});

async function main() {
  try {
    await pool.query(`
      ALTER TABLE sim_player_character ADD COLUMN IF NOT EXISTS main_type VARCHAR(50);
      ALTER TABLE sim_player_character ADD COLUMN IF NOT EXISTS sub_type VARCHAR(50);
      ALTER TABLE sim_player_character ADD COLUMN IF NOT EXISTS final_type VARCHAR(50);
      ALTER TABLE sim_player_character ADD COLUMN IF NOT EXISTS power_null_track VARCHAR(50);
      ALTER TABLE sim_player_character ADD COLUMN IF NOT EXISTS offense_skill VARCHAR(50);
      ALTER TABLE sim_player_character ADD COLUMN IF NOT EXISTS defense_skill VARCHAR(50);
    `);
    console.log("sim_player_character columns verified successfully!");
  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    await pool.end();
  }
}

main();
