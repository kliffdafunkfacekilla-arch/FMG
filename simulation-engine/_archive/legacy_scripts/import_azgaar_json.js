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

    console.log("Emptying tables...");
    await client.query("TRUNCATE sim_events, sim_infrastructure, sim_industrial_stockpiles, sim_burg_economy, sim_diplomacy, sim_cells, sim_factions, sim_outlaw_factions, sim_paragons, sim_agents, sim_trade_routes CASCADE");

    console.log("1. Importing Factions...");
    const states = p.states || [];
    for (const st of states) {
        if (!st.i) continue;
        await client.query(
            "INSERT INTO sim_factions (id, name, color, wealth) VALUES ($1, $2, $3, $4)",
            [st.i, st.name || "Unknown", st.color || "#000000", 5000]
        );
    }
    await client.query("INSERT INTO sim_factions (id, name, color, wealth) VALUES (0, 'Neutrals', '#ffffff', 0) ON CONFLICT DO NOTHING");

    console.log("2. Importing Cells & Geometry...");
    const cellsArr = p.cells;
    const vertsArr = p.vertices;
    let cellBatch = [];
    
    for (let i = 0; i < cellsArr.length; i++) {
        const cObj = cellsArr[i];
        if (cObj.i === undefined || cObj.i === 0) continue;
        
        const id = cObj.i;
        const stateId = cObj.state || 0;
        const biome = cObj.biome || 0;
        const elev = cObj.h || 0;
        
        const cellVerts = cObj.v;
        let poly = [];
        if (cellVerts && cellVerts.length > 0) {
            poly = cellVerts.map(vi => vertsArr[vi].p);
            poly.push(vertsArr[cellVerts[0]].p);
        } else {
            poly = [[0,0],[0,1],[1,1],[1,0],[0,0]];
        }
        
        const geoJSON = {
            type: "Polygon",
            coordinates: [poly]
        };
        
        cellBatch.push({
            id,
            faction_id: stateId,
            biome,
            elevation: elev,
            geometry: JSON.stringify(geoJSON)
        });
        
        if (cellBatch.length === 500 || i === cellsArr.length - 1) {
            let query = "INSERT INTO sim_cells (id, faction_id, biome, elevation, z_layer, geometry) VALUES ";
            let values = [];
            let c = 1;
            for (const cb of cellBatch) {
                query += `($${c++}, $${c++}, $${c++}, $${c++}, 0, $${c++}),`;
                values.push(cb.id, cb.faction_id, cb.biome, cb.elevation, cb.geometry);
            }
            query = query.slice(0, -1);
            await client.query(query, values);
            cellBatch = [];
        }
    }

    console.log("3. Importing Burgs...");
    const burgs = p.burgs || [];
    let burgBatch = [];
    for (const b of burgs) {
        if (!b.i || !b.cell) continue;
        const pop = Math.floor((b.population || 10) * 1000);
        burgBatch.push({
            id: b.i,
            cell: b.cell,
            name: b.name || "Town",
            pop: pop,
            wealth: 1000
        });
    }
    for (const b of burgBatch) {
        await client.query(
            "INSERT INTO sim_burg_economy (burg_id, cell_id, pop_null, wealth, food, unrest, health, crime_rate, military_forces, demographics, species_demographics) VALUES ($1, $2, $3, $4, $5, 0, 100, 0, '{}', '{}', '{}')",
            [b.id, b.cell, b.pop, b.wealth, 1000]
        );
        await client.query("INSERT INTO sim_industrial_stockpiles (burg_id, complex_inventory) VALUES ($1, '{}')", [b.id]);
    }
    
    console.log("Done importing map into PostgreSQL!");
    await client.end();
}

importAzgaar('C:/Users/krazy/Desktop/FMG/Okasha.json').catch(console.error);
