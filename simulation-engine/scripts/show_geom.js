require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { Client } = require("pg");
async function showGeom() {
    const client = new Client(process.env.DATABASE_URL);
    await client.connect();
    const res = await client.query("SELECT geometry FROM sim_cells LIMIT 1");
    console.log(JSON.stringify(res.rows[0].geometry).slice(0, 500));
    await client.end();
}
showGeom();
