require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { Client } = require('pg');
const c = new Client(process.env.DATABASE_URL);
c.connect().then(async () => {
    const res = await c.query("SELECT * FROM sim_events WHERE type = 'BATTLE_REPORT' ORDER BY id DESC LIMIT 5");
    console.log(res.rows);
    process.exit(0);
});
