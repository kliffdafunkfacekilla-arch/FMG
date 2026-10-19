require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { Client } = require("pg");
async function showSchema() {
    const client = new Client(process.env.DATABASE_URL);
    await client.connect();
    const res = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'sim_cells'");
    console.log(res.rows.map(r => r.column_name).join(", "));
    await client.end();
}
showSchema();
