const { Client } = require("pg");
async function purge() {
    const client = new Client("postgres://postgres:krazy@127.0.0.1:5432/postgres");
    await client.connect();
    await client.query("DELETE FROM sim_burg_economy WHERE pop_null <= 0 AND pop_attuned <= 0");
    await client.query("DELETE FROM sim_paragons WHERE burg_id IS NOT NULL AND burg_id NOT IN (SELECT burg_id FROM sim_burg_economy)");
    await client.query("DELETE FROM sim_infrastructure WHERE burg_id IS NOT NULL AND burg_id NOT IN (SELECT burg_id FROM sim_burg_economy)");
    await client.query("DELETE FROM sim_fringe_lairs WHERE burg_id IS NOT NULL AND burg_id NOT IN (SELECT burg_id FROM sim_burg_economy)");
    await client.query("DELETE FROM sim_industrial_stockpiles WHERE burg_id NOT IN (SELECT burg_id FROM sim_burg_economy)");
    console.log("Purge complete!");
    await client.end();
}
purge();
