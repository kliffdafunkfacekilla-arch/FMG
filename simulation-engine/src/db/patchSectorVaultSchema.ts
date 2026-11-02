import pool from "./pool";

export async function patchSectorVaultSchema() {
  await pool.query(`
    ALTER TABLE sim_world_vault_sectors
      ADD COLUMN IF NOT EXISTS name VARCHAR(128),
      ADD COLUMN IF NOT EXISTS props JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS npcs JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

    ALTER TABLE sim_burg_economy
      ADD COLUMN IF NOT EXISTS parent_burg_id INT REFERENCES sim_burg_economy(burg_id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS settlement_type VARCHAR(32) DEFAULT 'BURG';
  `);
  console.log("Sector vault and burg economy schema columns ensured.");
}

if (process.argv[1] && process.argv[1].includes("patchSectorVaultSchema")) {
  patchSectorVaultSchema()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Schema patch failed:", err);
      process.exit(1);
    });
}
