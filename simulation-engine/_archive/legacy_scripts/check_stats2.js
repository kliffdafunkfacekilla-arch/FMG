const { Client } = require('pg');
async function checkStats() {
  const c = new Client(process.env.DATABASE_URL);
  await c.connect();
  const res = await c.query("SELECT MAX(pop_null), AVG(pop_null), MIN(pop_null) FROM sim_burg_economy");
  console.log(res.rows);
  await c.end();
}
checkStats();
