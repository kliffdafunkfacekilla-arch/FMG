const { Client } = require('pg');
async function del() {
  const c = new Client(process.env.DATABASE_URL);
  await c.connect();
  await c.query("DELETE FROM sim_factions WHERE name = 'Unknown'");
  console.log('Deleted');
  await c.end();
}
del();
