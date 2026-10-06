const {Client} = require('pg');
const c = new Client('postgres://postgres:krazy@127.0.0.1:5432/postgres');
c.connect().then(async () => {
    try {
        await c.query("ALTER TABLE sim_fringe_factions ADD COLUMN manpower INT DEFAULT 0");
        await c.query("ALTER TABLE sim_fringe_factions ADD COLUMN wealth INT DEFAULT 0");
        console.log("Added manpower and wealth to sim_fringe_factions");
    } catch (e) {
        console.log("Columns might already exist:", e.message);
    }
    c.end();
});
