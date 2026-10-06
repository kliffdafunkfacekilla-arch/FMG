const {Client} = require('pg');
const c = new Client('postgres://postgres:krazy@127.0.0.1:5432/postgres');
c.connect().then(async () => {
    try {
        await c.query(`ALTER TABLE sim_paragons ADD COLUMN IF NOT EXISTS faction_id INT`);
        await c.query(`ALTER TABLE sim_paragons ADD COLUMN IF NOT EXISTS is_counselor BOOLEAN DEFAULT false`);
        console.log("Added columns to sim_paragons.");
    } catch(e) { console.error(e.message); }
    try {
        await c.query(`ALTER TABLE sim_events ADD COLUMN IF NOT EXISTS faction_id INT`);
        console.log("Added columns to sim_events.");
    } catch(e) { console.error(e.message); }
    c.end();
});
