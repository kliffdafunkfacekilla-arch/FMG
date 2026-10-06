const {Client} = require('pg');
const c = new Client('postgres://postgres:krazy@127.0.0.1:5432/postgres');
c.connect().then(async () => {
    const res = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name='sim_factions'");
    console.table(res.rows);
    try {
        await c.query(`ALTER TABLE sim_factions ADD COLUMN IF NOT EXISTS treasury INT DEFAULT 1000`);
        console.log("Added treasury to sim_factions.");
    } catch(e) { console.error(e.message); }
    c.end();
});
