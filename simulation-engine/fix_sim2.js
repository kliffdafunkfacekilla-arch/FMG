const { Client } = require('pg');
const fs = require('fs');

async function fix() {
    const client = new Client('postgres://postgres:krazy@127.0.0.1:5432/postgres');
    await client.connect();

    // sim_faction_borders has (faction_id, cell_id, is_border) -- it's for border CELLS not neighbor pairs
    // The factionPlanningAgent reads validNeighbors from borders.filter(b => b.faction_a === f.id).map(b => b.faction_b)
    // So we need a DIFFERENT table or we need to add faction_a, faction_b columns.
    
    // Easiest fix: add faction_a, faction_b columns to sim_faction_borders
    await client.query("ALTER TABLE sim_faction_borders ADD COLUMN IF NOT EXISTS faction_a INT");
    await client.query("ALTER TABLE sim_faction_borders ADD COLUMN IF NOT EXISTS faction_b INT");
    console.log("Added faction_a, faction_b columns");

    // Now seed borders from Okasha.json
    const data = JSON.parse(fs.readFileSync('C:/Users/krazy/Desktop/FMG/Okasha.json', 'utf8'));
    const states = data.pack.states.filter(s => s.i && s.i > 0 && !s.removed);
    
    await client.query('DELETE FROM sim_faction_borders');
    
    let borderCount = 0;
    for (const s of states) {
        const neighbors = s.neighbors || [];
        for (const nId of neighbors) {
            if (nId === 0) continue;
            const existsA = await client.query('SELECT id FROM sim_factions WHERE id = $1', [s.i]);
            const existsB = await client.query('SELECT id FROM sim_factions WHERE id = $1', [nId]);
            if (existsA.rows.length > 0 && existsB.rows.length > 0) {
                await client.query(
                    `INSERT INTO sim_faction_borders (faction_a, faction_b, faction_id, cell_id, is_border) VALUES ($1, $2, $1, 0, true) ON CONFLICT DO NOTHING`,
                    [s.i, nId]
                );
                borderCount++;
            }
        }
    }
    console.log('Borders created:', borderCount);

    // Cap treasuries
    await client.query("UPDATE sim_factions SET treasury = LEAST(treasury, 12000)");
    console.log('Capped treasuries');

    // Seed unrest
    await client.query("UPDATE sim_burg_economy SET unrest = 15 + FLOOR(RANDOM() * 20)");
    console.log('Seeded unrest');

    // Fix zero-trait factions
    await client.query("UPDATE sim_factions SET trait_aggression = 5, trait_economy = 7, trait_magic = 9 WHERE id = 14");
    await client.query("UPDATE sim_factions SET trait_aggression = 3, trait_economy = 6, trait_magic = 8 WHERE id = 24");
    await client.query("UPDATE sim_factions SET trait_aggression = 4, trait_economy = 6, trait_magic = 5 WHERE id = 27");
    console.log('Fixed zero-trait factions');

    await client.end();
    console.log('Done');
}
fix().catch(console.error);
