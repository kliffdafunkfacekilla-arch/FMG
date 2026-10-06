const { Client } = require('pg');
async function del() {
  const c = new Client('postgres://postgres:krazy@127.0.0.1:5432/postgres');
  await c.connect();
  await c.query("DELETE FROM sim_factions WHERE name = 'Unknown'");
  console.log('Deleted');
  await c.end();
}
del();
