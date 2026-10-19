const { Client } = require('pg');
const c = new Client(process.env.DATABASE_URL);
c.connect().then(() => c.query("SELECT query, state FROM pg_stat_activity WHERE state != 'idle'"))
  .then(r => console.log(r.rows))
  .then(() => process.exit(0));
