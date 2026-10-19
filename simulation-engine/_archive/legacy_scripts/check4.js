const { Client } = require('pg');
async function run() {
  const c = new Client(process.env.DATABASE_URL);
  await c.connect();
  const res = await c.query("SELECT tick, type, message FROM sim_events ORDER BY id DESC LIMIT 15");
  console.log("EVENTS:", res.rows);
  await c.end();
}
run();
