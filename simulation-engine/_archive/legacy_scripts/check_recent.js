const { Client } = require('pg');
async function checkEvents() {
  const c = new Client('postgres://postgres:krazy@127.0.0.1:5432/postgres');
  await c.connect();
  const res = await c.query("SELECT tick, type, message FROM sim_events ORDER BY id DESC LIMIT 5");
  console.log(res.rows);
  await c.end();
}
checkEvents();
