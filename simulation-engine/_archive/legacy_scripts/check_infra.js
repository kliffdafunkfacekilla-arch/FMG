const { Client } = require('pg');
async function check() {
  const c = new Client('postgres://postgres:krazy@127.0.0.1:5432/postgres');
  await c.connect();
  const res = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'sim_infrastructure'");
  console.log(res.rows);
  await c.end();
}
check();
