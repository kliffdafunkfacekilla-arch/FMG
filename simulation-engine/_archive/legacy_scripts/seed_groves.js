const { Client } = require('pg');
async function seedGroves() {
  const c = new Client('postgres://postgres:krazy@127.0.0.1:5432/postgres');
  await c.connect();
  const cells = await c.query("SELECT id FROM sim_cells ORDER BY RANDOM() LIMIT 15");
  for (const cell of cells.rows) {
      await c.query("INSERT INTO sim_sacred_groves (cell_id, seal_strength) VALUES ($1, 100)", [cell.id]);
  }
  await c.query("INSERT INTO sim_agents (role, location_cell_id) VALUES ('Warden', (SELECT id FROM sim_cells ORDER BY RANDOM() LIMIT 1))");
  await c.query("INSERT INTO sim_agents (role, location_cell_id) VALUES ('Cultist', (SELECT id FROM sim_cells ORDER BY RANDOM() LIMIT 1))");
  console.log("Seeded Groves and Agents");
  await c.end();
}
seedGroves();
