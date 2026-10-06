const { Client } = require('pg');

async function buildBorders() {
    const client = new Client('postgres://postgres:krazy@127.0.0.1:5432/postgres');
    await client.connect();
    
    console.log("Creating sim_faction_borders...");
    await client.query(`
        CREATE TABLE IF NOT EXISTS sim_faction_borders (
            faction_a INT,
            faction_b INT,
            PRIMARY KEY (faction_a, faction_b)
        )
    `);
    await client.query("TRUNCATE sim_faction_borders");

    console.log("Fetching cells for proximity calculation...");
    const cellsRes = await client.query("SELECT id, faction_id, geometry FROM sim_cells WHERE faction_id != 0");
    
    const factionCenters = {}; // fid -> array of {x,y}
    for (const c of cellsRes.rows) {
        if (!factionCenters[c.faction_id]) factionCenters[c.faction_id] = [];
        try {
            const geo = JSON.parse(c.geometry);
            const ring = geo.coordinates[0];
            let cx = 0, cy = 0;
            for (const p of ring) { cx += p[0]; cy += p[1]; }
            cx /= ring.length; cy /= ring.length;
            factionCenters[c.faction_id].push({x: cx, y: cy});
        } catch(e){}
    }

    // A fast way to check distance between factions:
    // If the minimum distance between ANY cell of A and ANY cell of B is < 100, they border each other.
    const fids = Object.keys(factionCenters);
    let borderCount = 0;

    for (let i = 0; i < fids.length; i++) {
        for (let j = i + 1; j < fids.length; j++) {
            const fA = fids[i];
            const fB = fids[j];
            let minD = Infinity;
            
            // Randomly sample up to 50 cells per faction to speed up N^2 check
            const cellsA = factionCenters[fA].sort(()=>Math.random()-0.5).slice(0, 50);
            const cellsB = factionCenters[fB].sort(()=>Math.random()-0.5).slice(0, 50);
            
            for (const cA of cellsA) {
                for (const cB of cellsB) {
                    const d = Math.sqrt((cA.x - cB.x)**2 + (cA.y - cB.y)**2);
                    if (d < minD) minD = d;
                }
            }

            if (minD < 150) { // Threshold for "neighbors" (roughly 150 distance units)
                await client.query("INSERT INTO sim_faction_borders (faction_a, faction_b) VALUES ($1, $2), ($2, $1) ON CONFLICT DO NOTHING", [fA, fB]);
                borderCount++;
            }
        }
    }
    
    console.log(`Created ${borderCount} bilateral border relationships.`);
    await client.end();
}
buildBorders().catch(console.error);
