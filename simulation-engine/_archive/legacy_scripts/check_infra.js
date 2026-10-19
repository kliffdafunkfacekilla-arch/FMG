const { Client } = require('pg');
async function check() {
  const c = new Client(process.env.DATABASE_URL);
  await c.connect();
  const res = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'sim_infrastructure'");
  console.log(res.rows);
  await c.end();
}
check();
