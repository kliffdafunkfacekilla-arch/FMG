const { Client } = require('pg');
async function run() {
  const c = new Client(process.env.DATABASE_URL);
  await c.connect();
  const res = await c.query("SELECT role, COUNT(*) FROM sim_agents GROUP BY role");
  console.log("AGENTS:", res.rows);
  await c.end();
}
run();
