const {Client} = require('pg');
const c = new Client('postgres://postgres:krazy@127.0.0.1:5432/postgres');
c.connect().then(async () => {
    try {
        await c.query("ALTER TABLE sim_fringe_factions ADD COLUMN worker_groups INT DEFAULT 2");
        console.log("Added worker_groups");
    } catch(e) {}
    try {
        const res = await c.query("SELECT * FROM sim_paragons WHERE domain = 'Underworld' LIMIT 1");
        if (res.rows.length === 0) {
            console.log("No Underworld paragons found. We should create them.");
        } else {
            console.log("Underworld paragons exist.");
        }
    } catch(e) { console.error(e); }
    c.end();
});
