const { Client } = require('pg');
const c = new Client('postgres://postgres:krazy@127.0.0.1:5432/postgres');
c.connect().then(()=>c.query("INSERT INTO sim_diplomacy (faction_a_id, faction_b_id, status, tension) VALUES (1, 2, 'WAR', 100) ON CONFLICT DO NOTHING"))
.then(()=>console.log('Forced war'))
.then(()=>c.end());
