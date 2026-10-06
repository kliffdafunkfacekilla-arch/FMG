const {Client} = require('pg');
const c = new Client('postgres://postgres:krazy@127.0.0.1:5432/postgres');
c.connect().then(()=>c.query("SELECT * FROM sim_calendar LIMIT 1")).then(r=>{console.log(r.rows); c.end()});
