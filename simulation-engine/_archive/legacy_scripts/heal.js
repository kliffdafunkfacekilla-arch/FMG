const { Client } = require('pg');
async function heal() {
  const c = new Client('postgres://postgres:krazy@127.0.0.1:5432/postgres');
  await c.connect();
  await c.query("UPDATE sim_cells SET eco_health = 100");
  await c.query("UPDATE sim_burg_economy SET food = 5000, wealth = 1000, unrest = 0, health = 100");
  console.log("Healed the world.");
  await c.end();
}
heal();
