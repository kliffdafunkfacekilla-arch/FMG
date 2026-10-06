const { Client } = require('pg');
const c = new Client('postgres://postgres:krazy@127.0.0.1:5432/postgres');
c.connect().then(()=>c.query("SELECT resource_profile FROM sim_burg_economy LIMIT 1")).then(r=>{console.log(r.rows[0].resource_profile); c.end()});
