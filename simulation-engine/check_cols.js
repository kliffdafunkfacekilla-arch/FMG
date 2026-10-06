const { Client } = require('pg');
async function check() {
  const client = new Client('postgres://postgres:krazy@127.0.0.1:5432/postgres');
  await client.connect();
  const res = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'sim_cells'");
  console.log(res.rows.map(r => r.column_name));
  await client.end();
}
check();
