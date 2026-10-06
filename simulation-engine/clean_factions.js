const { Client } = require('pg');
const Database = require('better-sqlite3');

async function clean() {
    // 1. Clean SQLite
    const sqlite = new Database('C:/Users/krazy/Desktop/FMG/simulation-engine/aetheria.sqlite');
    sqlite.prepare("DELETE FROM sim_factions WHERE id NOT IN (SELECT DISTINCT c.faction_id FROM sim_burg_economy b JOIN sim_cells c ON b.cell_id = c.id)").run();

    // 2. Clean Postgres
    const client = new Client('postgres://postgres:krazy@127.0.0.1:5432/postgres');
    await client.connect();
    await client.query("DELETE FROM sim_factions WHERE id NOT IN (SELECT DISTINCT c.faction_id FROM sim_burg_economy b JOIN sim_cells c ON b.cell_id = c.id)");
    await client.end();
    
    console.log("Deleted unused factions");
}
clean().catch(console.error);
