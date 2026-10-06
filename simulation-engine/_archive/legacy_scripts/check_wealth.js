const { Client } = require('pg');
async function checkWealth() {
  const c = new Client('postgres://postgres:krazy@127.0.0.1:5432/postgres');
  await c.connect();
  const res = await c.query("SELECT MAX(wealth) as max_w, AVG(wealth) as avg_w, MAX(unrest) as max_u, AVG(unrest) as avg_u FROM sim_burg_economy");
  console.log(res.rows);
  await c.end();
}
checkWealth();
