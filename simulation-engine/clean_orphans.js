const { Client } = require('pg');
const Database = require('better-sqlite3');

async function clean() {
    const sqlite = new Database('C:/Users/krazy/Desktop/FMG/simulation-engine/aetheria.sqlite');
    sqlite.prepare("DELETE FROM sim_infrastructure WHERE burg_id IS NOT NULL AND burg_id NOT IN (SELECT burg_id FROM sim_burg_economy)").run();
    sqlite.prepare("DELETE FROM sim_industrial_stockpiles WHERE burg_id NOT IN (SELECT burg_id FROM sim_burg_economy)").run();
    sqlite.prepare("DELETE FROM sim_paragons WHERE burg_id NOT IN (SELECT burg_id FROM sim_burg_economy)").run();

    const client = new Client('postgres://postgres:krazy@127.0.0.1:5432/postgres');
    await client.connect();
    await client.query("DELETE FROM sim_infrastructure WHERE burg_id IS NOT NULL AND burg_id NOT IN (SELECT burg_id FROM sim_burg_economy)");
    await client.query("DELETE FROM sim_industrial_stockpiles WHERE burg_id NOT IN (SELECT burg_id FROM sim_burg_economy)");
    await client.query("DELETE FROM sim_paragons WHERE burg_id NOT IN (SELECT burg_id FROM sim_burg_economy)");
    await client.end();
    console.log("Cleanup done.");
}
clean().catch(console.error);
