const { Client } = require('pg');
async function checkStats() {
  const c = new Client('postgres://postgres:krazy@127.0.0.1:5432/postgres');
  await c.connect();
  const res = await c.query("SELECT MAX(unrest), AVG(unrest), MIN(health), AVG(health) FROM sim_burg_economy");
  console.log(res.rows);
  await c.end();
}
checkStats();
