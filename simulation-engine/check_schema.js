const { Client } = require('pg');
const c = new Client('postgres://postgres:krazy@127.0.0.1:5432/postgres');
c.connect().then(()=>c.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'sim_burg_economy'")).then(r=>{console.log(r.rows); c.end()});
