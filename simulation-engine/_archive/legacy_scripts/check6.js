const { Client } = require('pg');
async function run() {
  const c = new Client('postgres://postgres:krazy@127.0.0.1:5432/postgres');
  await c.connect();
  const res = await c.query("SELECT role, COUNT(*) FROM sim_agents GROUP BY role");
  console.log("AGENTS:", res.rows);
  await c.end();
}
run();
