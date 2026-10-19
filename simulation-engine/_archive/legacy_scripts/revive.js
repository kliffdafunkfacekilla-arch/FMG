const { Client } = require('pg');
async function revive() {
  const c = new Client(process.env.DATABASE_URL);
  await c.connect();
  await c.query("UPDATE sim_burg_economy SET pop_null = 5000, health = 100, unrest = 0");
  console.log("Population Revived.");
  await c.end();
}
revive();
