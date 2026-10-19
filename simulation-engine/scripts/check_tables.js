require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { Client } = require('pg');
const c = new Client(process.env.DATABASE_URL);
c.connect().then(async () => {
    const res = await c.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
    const tables = res.rows.map(r => r.table_name);
    console.log(tables.filter(t => t.includes('outlaw') || t.includes('fringe')));
    process.exit(0);
});
