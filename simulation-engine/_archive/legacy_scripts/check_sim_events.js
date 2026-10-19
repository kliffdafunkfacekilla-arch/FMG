const { Client } = require('pg');
async function checkEvents() {
  const c = new Client(process.env.DATABASE_URL);
  await c.connect();
  const res = await c.query("SELECT tick, type, message FROM sim_events ORDER BY id DESC LIMIT 30");
  console.log(res.rows);
  await c.end();
}
checkEvents();
