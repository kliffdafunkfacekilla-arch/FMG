const { Client } = require('pg');
async function run() {
  const c = new Client('postgres://postgres:krazy@127.0.0.1:5432/postgres');
  await c.connect();
  const res = await c.query("SELECT tick, type, message FROM sim_events ORDER BY id DESC LIMIT 15");
  console.log("EVENTS:", res.rows);
  await c.end();
}
run();
