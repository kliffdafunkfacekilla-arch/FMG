const fs = require('fs');
const Database = require('better-sqlite3');
const { Client } = require('pg');

async function fix() {
    const data = JSON.parse(fs.readFileSync('C:/Users/krazy/Desktop/FMG/Okasha.json', 'utf8'));
    const removedBurgIds = data.pack.burgs.filter(b => b.i && b.removed).map(b => b.i);
    console.log("Removing", removedBurgIds.length, "deleted burgs...");

    // 1. Fix SQLite
    const sqlite = new Database('C:/Users/krazy/Desktop/FMG/simulation-engine/aetheria.sqlite');
    const stmt = sqlite.prepare(`DELETE FROM sim_burg_economy WHERE burg_id IN (${removedBurgIds.join(',')})`);
    const info = stmt.run();
    console.log("Deleted from SQLite:", info.changes);

    // 2. Fix Postgres
    const client = new Client('postgres://postgres:krazy@127.0.0.1:5432/postgres');
    await client.connect();
    const res = await client.query(`DELETE FROM sim_burg_economy WHERE burg_id = ANY($1::int[])`, [removedBurgIds]);
    console.log("Deleted from Postgres:", res.rowCount);
    await client.end();
}
fix().catch(console.error);
