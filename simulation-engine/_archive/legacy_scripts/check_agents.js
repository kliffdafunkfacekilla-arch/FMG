const { Client } = require('pg');
async function checkAgents() {
  const c = new Client('postgres://postgres:krazy@127.0.0.1:5432/postgres');
  await c.connect();
  const res = await c.query("SELECT role, COUNT(*) FROM sim_agents GROUP BY role");
  console.log(res.rows);
  await c.end();
}
checkAgents();
