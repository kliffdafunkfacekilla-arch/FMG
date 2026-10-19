const { Client } = require('pg');
async function checkGroves() {
  const c = new Client(process.env.DATABASE_URL);
  await c.connect();
  const res = await c.query("SELECT id, cell_id, seal_strength FROM sim_sacred_groves ORDER BY id ASC");
  console.log(res.rows);
  await c.end();
}
checkGroves();
