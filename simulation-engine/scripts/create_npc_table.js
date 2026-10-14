const pool = require('../dist/db/pool.js').default;

const sql = `
CREATE TABLE IF NOT EXISTS sim_npc_instances (
    id VARCHAR(100) PRIMARY KEY,
    cell_id INT NOT NULL,
    current_rx INT NOT NULL,
    current_ry INT NOT NULL,
    local_pos INT[] NOT NULL,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL,
    kingdom VARCHAR(50),
    species VARCHAR(50),
    lineage VARCHAR(50),
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    faction VARCHAR(100),
    hp INT NOT NULL,
    max_hp INT NOT NULL,
    disposition INT NOT NULL DEFAULT 0,
    alive BOOLEAN NOT NULL DEFAULT true,
    equipped_weapon VARCHAR(100),
    equipped_armor VARCHAR(100),
    stat_affinity VARCHAR(20),
    stats JSONB NOT NULL DEFAULT '{}'::jsonb,
    inventory JSONB DEFAULT '[]'::jsonb,
    memory_notes JSONB DEFAULT '[]'::jsonb,
    wander_anchor INT[] DEFAULT ARRAY[128, 128],
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sim_npc_instances_loc ON sim_npc_instances(cell_id, current_rx, current_ry);
`;

pool.query(sql)
  .then(() => {
    console.log('sim_npc_instances table created successfully!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error creating sim_npc_instances:', err);
    process.exit(1);
  });
