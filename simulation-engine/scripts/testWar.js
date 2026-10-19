require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { Client } = require('pg');
const c = new Client(process.env.DATABASE_URL);
c.connect().then(()=>c.query("INSERT INTO sim_diplomacy (faction_a_id, faction_b_id, status, tension) VALUES (1, 2, 'WAR', 100) ON CONFLICT DO NOTHING"))
.then(()=>console.log('Forced war'))
.then(()=>c.end());
