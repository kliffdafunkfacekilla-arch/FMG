const {Client} = require('pg');
const c = new Client('postgres://postgres:krazy@127.0.0.1:5432/postgres');
c.connect().then(async () => {
    try {
        await c.query(`CREATE TABLE IF NOT EXISTS sim_faction_borders (
           id SERIAL PRIMARY KEY,
           faction_id INT,
           cell_id INT,
           is_border BOOLEAN
        )`);
        console.log("Added sim_faction_borders.");
    } catch(e) { console.error(e.message); }
    c.end();
});
