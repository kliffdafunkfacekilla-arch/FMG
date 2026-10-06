const { Client } = require('pg');
const c = new Client('postgres://postgres:YOUR_PASSWORD@127.0.0.1:5432/postgres');
c.connect().then(() => c.query("SELECT query, state FROM pg_stat_activity WHERE state != 'idle'"))
  .then(r => console.log(r.rows))
  .then(() => process.exit(0));
