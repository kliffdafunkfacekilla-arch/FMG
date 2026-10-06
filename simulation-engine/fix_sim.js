const { Client } = require('pg');
const fs = require('fs');

async function fix() {
    const client = new Client('postgres://postgres:krazy@127.0.0.1:5432/postgres');
    await client.connect();

    // 1. Build faction borders from actual geographic adjacency (shared cell neighbors)
    // For now, derive from the Okasha.json state data - each faction borders the others that 
    // touch its territory. Simple approach: use the Azgaar state adjacency from the JSON.
    const data = JSON.parse(fs.readFileSync('C:/Users/krazy/Desktop/FMG/Okasha.json', 'utf8'));
    const states = data.pack.states.filter(s => s.i && s.i > 0 && !s.removed);
    
    await client.query('DELETE FROM sim_faction_borders');
    
    let borderCount = 0;
    for (const s of states) {
        const neighbors = s.neighbors || [];
        for (const nId of neighbors) {
            if (nId === 0) continue;
            // Check both factions exist in DB
            const exists = await client.query('SELECT id FROM sim_factions WHERE id = $1 OR id = $2', [s.i, nId]);
            if (exists.rows.length === 2) {
                await client.query(
                    `INSERT INTO sim_faction_borders (faction_a, faction_b) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                    [s.i, nId]
                );
                borderCount++;
            }
        }
    }
    console.log('Borders created:', borderCount);

    // 2. Set starting unrest so cultists/wardens can function — modest but not 0
    await client.query("UPDATE sim_burg_economy SET unrest = 15 + FLOOR(RANDOM() * 20)");
    console.log('Seeded starting unrest');

    // 3. Cap all faction treasuries to a sane starting amount — no faction should start with 800k+
    await client.query("UPDATE sim_factions SET treasury = LEAST(treasury, 12000)");
    console.log('Capped treasuries to 12000');
    
    // 4. Add trait_aggression/trait_economy to Theocracy, Prism, Flower Valley (currently 0 = boring)
    await client.query("UPDATE sim_factions SET trait_aggression = 5, trait_economy = 7, trait_magic = 9 WHERE id = 14"); // Theocracy
    await client.query("UPDATE sim_factions SET trait_aggression = 3, trait_economy = 6, trait_magic = 8 WHERE id = 24"); // Prism
    await client.query("UPDATE sim_factions SET trait_aggression = 4, trait_economy = 6, trait_magic = 5 WHERE id = 27"); // Flower Valley

    // 5. Seed 3 cartels (outlaw factions) if not enough
    const outlaws = await client.query('SELECT COUNT(*) FROM sim_outlaw_factions');
    console.log('Outlaws:', outlaws.rows[0].count);

    await client.end();
    console.log('All fixes applied');
}
fix().catch(console.error);
