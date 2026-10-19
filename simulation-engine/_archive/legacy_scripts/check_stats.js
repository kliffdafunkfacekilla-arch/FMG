const { Client } = require('pg');
async function checkStats() {
  const c = new Client(process.env.DATABASE_URL);
  await c.connect();
  const res = await c.query("SELECT MIN(health), MAX(health), AVG(health), AVG(unrest) FROM sim_burg_economy");
  console.log(res.rows);
  const agentRes = await c.query("SELECT role, COUNT(*) FROM sim_agents GROUP BY role");
  console.log("AGENTS:", agentRes.rows);
  await c.end();
}
checkStats();
