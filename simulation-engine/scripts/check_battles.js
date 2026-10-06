const { Client } = require('pg');
const c = new Client('postgres://postgres:krazy@127.0.0.1:5432/postgres');
c.connect().then(async () => {
    const res = await c.query("SELECT * FROM sim_events WHERE type = 'BATTLE_REPORT' ORDER BY id DESC LIMIT 5");
    console.log(res.rows);
    process.exit(0);
});
