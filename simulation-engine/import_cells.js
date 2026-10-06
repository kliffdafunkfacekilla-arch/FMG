const fs = require('fs');
const BetterSqlite3 = require('better-sqlite3');

async function importMap() {
    console.log("Loading Okasha.map...");
    const lines = fs.readFileSync('../Okasha.map', 'utf8').split(/\r?\n/);
    
    const elevations = lines[7].split(',').map(Number);
    const biomes = lines[8].split(',').map(Number);
    const factions = lines[16].split(',').map(Number);
    
    console.log(`Parsed ${elevations.length} cells from Okasha.map`);
    
    const sqlite = new BetterSqlite3('aetheria.sqlite');
    
    // Update sim_cells
    console.log("Updating sim_cells in aetheria.sqlite...");
    const stmt = sqlite.prepare("UPDATE sim_cells SET elevation = ?, biome = ?, faction_id = ? WHERE id = ?");
    sqlite.exec("BEGIN");
    for(let i=0; i<elevations.length; i++) {
        stmt.run(elevations[i], biomes[i], factions[i], i);
    }
    sqlite.exec("COMMIT");
    
    console.log("Updated cells successfully.");
    sqlite.close();
}

importMap().catch(console.error);
