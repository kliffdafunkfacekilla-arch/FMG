const { Client } = require('pg');
async function fix() {
    const client = new Client('postgres://postgres:krazy@127.0.0.1:5432/postgres');
    await client.connect();
    await client.query("UPDATE sim_burg_economy SET military_forces = '{\"footmen\":50}'::jsonb");
    console.log("Fixed lengths");
    await client.end();
}
fix().catch(console.error);
