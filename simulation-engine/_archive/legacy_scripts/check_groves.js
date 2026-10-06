const { Client } = require('pg');
async function checkGroves() {
  const c = new Client('postgres://postgres:krazy@127.0.0.1:5432/postgres');
  await c.connect();
  const res = await c.query("SELECT id, cell_id, seal_strength FROM sim_sacred_groves ORDER BY id ASC");
  console.log(res.rows);
  await c.end();
}
checkGroves();
