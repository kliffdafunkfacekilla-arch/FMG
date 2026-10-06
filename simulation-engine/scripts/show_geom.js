const { Client } = require("pg");
async function showGeom() {
    const client = new Client("postgres://postgres:krazy@127.0.0.1:5432/postgres");
    await client.connect();
    const res = await client.query("SELECT geometry FROM sim_cells LIMIT 1");
    console.log(JSON.stringify(res.rows[0].geometry).slice(0, 500));
    await client.end();
}
showGeom();
