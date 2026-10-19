const { Client } = require('pg');
async function run() {
  const c = new Client(process.env.DATABASE_URL);
  await c.connect();
  const res = await c.query("SELECT * FROM sim_diplomacy WHERE status = 'WAR'");
  console.log("BLOCKADES:", res.rows);
  await c.end();
}
run();
