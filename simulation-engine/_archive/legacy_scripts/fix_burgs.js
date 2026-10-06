const fs = require('fs');
const { Client } = require('pg');

async function importAzgaar(jsonPath) {
    console.log(`Loading ${jsonPath}...`);
    const raw = fs.readFileSync(jsonPath, 'utf8');
    const data = JSON.parse(raw);
    const p = data.pack;
    
    console.log(`Connecting to Postgres...`);
    const client = new Client('postgres://postgres:krazy@127.0.0.1:5432/postgres');
    await client.connect();

    console.log("Emptying burg tables...");
    await client.query("TRUNCATE sim_events, sim_industrial_stockpiles, sim_burg_economy, sim_infrastructure CASCADE");

    console.log("3. Re-Importing Burgs (Ignoring removed ones)...");
    const burgs = p.burgs || [];
    let burgBatch = [];
    for (const b of burgs) {
        if (!b.i || !b.cell) continue;
        if (b.removed) continue; // FIX: Skip removed burgs
        
        const pop = Math.floor((b.population || 10) * 1000);
        burgBatch.push({
            id: b.i,
            cell: b.cell,
            name: b.name || "Town",
            pop: pop,
            wealth: 1000
        });
    }
    
    console.log(`Found ${burgBatch.length} valid burgs.`);
    for (const b of burgBatch) {
        await client.query(
            "INSERT INTO sim_burg_economy (burg_id, cell_id, pop_null, wealth, food, unrest, health, crime_rate, military_forces, demographics, species_demographics) VALUES ($1, $2, $3, $4, $5, 0, 100, 0, '{}', '{}', '{}')",
            [b.id, b.cell, b.pop, b.wealth, 1000]
        );
        await client.query("INSERT INTO sim_industrial_stockpiles (burg_id, complex_inventory) VALUES ($1, '{}')", [b.id]);
    }
    
    console.log("Done fixing burgs in PostgreSQL!");
    await client.end();
}

importAzgaar('C:/Users/krazy/Desktop/FMG/Okasha.json').catch(console.error);
