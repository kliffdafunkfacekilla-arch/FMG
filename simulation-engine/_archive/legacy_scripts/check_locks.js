const { Client } = require('pg');
async function check() {
  const c = new Client('postgres://postgres:krazy@127.0.0.1:5432/postgres');
  await c.connect();
  const res = await c.query("SELECT pid, wait_event_type, wait_event, state, query FROM pg_stat_activity WHERE state = 'active'");
  console.log(res.rows);
  await c.end();
}
check();
