const { Client } = require('pg');
const Database = require('better-sqlite3');

async function syncToSqlite() {
    const pg = new Client('postgres://postgres:krazy@127.0.0.1:5432/postgres');
    await pg.connect();
    
    const sqlite = new Database('aetheria.sqlite');
    
    // Factions
    sqlite.exec("DELETE FROM sim_factions");
    const factions = await pg.query("SELECT * FROM sim_factions");
    const fStmt = sqlite.prepare("INSERT INTO sim_factions (id, name, color, wealth) VALUES (?, ?, ?, ?)");
    sqlite.exec("BEGIN");
    for (const r of factions.rows) fStmt.run(r.id, r.name, r.color, r.wealth);
    sqlite.exec("COMMIT");
    
    // Cells
    sqlite.exec("DELETE FROM sim_cells");
    const cells = await pg.query("SELECT * FROM sim_cells");
    const cStmt = sqlite.prepare("INSERT INTO sim_cells (id, geometry, faction_id, elevation, biome) VALUES (?, ?, ?, ?, ?)");
    sqlite.exec("BEGIN");
    for (const r of cells.rows) cStmt.run(r.id, r.geometry, r.faction_id, r.elevation, r.biome);
    sqlite.exec("COMMIT");
    
    // Burgs
    sqlite.exec("DELETE FROM sim_burg_economy");
    const burgs = await pg.query("SELECT * FROM sim_burg_economy");
    const bStmt = sqlite.prepare("INSERT INTO sim_burg_economy (burg_id, cell_id, pop_null, wealth, food, unrest, health, crime_rate, military_forces, demographics, species_demographics) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    sqlite.exec("BEGIN");
    for (const r of burgs.rows) bStmt.run(r.burg_id, r.cell_id, r.pop_null, r.wealth, r.food, r.unrest, r.health, r.crime_rate, typeof r.military_forces === 'string' ? r.military_forces : JSON.stringify(r.military_forces), typeof r.demographics === 'string' ? r.demographics : JSON.stringify(r.demographics), typeof r.species_demographics === 'string' ? r.species_demographics : JSON.stringify(r.species_demographics));
    sqlite.exec("COMMIT");
    
    console.log("Synced Postgres to aetheria.sqlite successfully.");
    sqlite.close();
    await pg.end();
}

syncToSqlite().catch(console.error);
