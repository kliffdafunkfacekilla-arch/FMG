const { Client } = require('pg');
async function check() {
  const c = new Client(process.env.DATABASE_URL);
  await c.connect();
  const res = await c.query("SELECT pid, wait_event_type, wait_event, state, query FROM pg_stat_activity WHERE state = 'active'");
  console.log(res.rows);
  await c.end();
}
check();
