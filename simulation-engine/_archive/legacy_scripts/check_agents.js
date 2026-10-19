const { Client } = require('pg');
async function checkAgents() {
  const c = new Client(process.env.DATABASE_URL);
  await c.connect();
  const res = await c.query("SELECT role, COUNT(*) FROM sim_agents GROUP BY role");
  console.log(res.rows);
  await c.end();
}
checkAgents();
