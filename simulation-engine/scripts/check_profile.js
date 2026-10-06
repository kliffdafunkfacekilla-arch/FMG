const { Client } = require("pg");
const c = new Client("postgres://postgres:krazy@127.0.0.1:5432/postgres");

c.connect().then(async () => {
    // Find a biome-5 burg and check its profile
    const r = await c.query(`
        SELECT b.burg_id, b.resource_profile, c.biome
        FROM sim_burg_economy b
        JOIN sim_cells c ON c.id = b.cell_id
        WHERE c.biome = '5'
        LIMIT 3
    `);
    
    r.rows.forEach(row => {
        const profile = row.resource_profile ? JSON.parse(row.resource_profile) : null;
        console.log(`Burg ${row.burg_id} (biome ${row.biome}) profile slots:`);
        if (profile) {
            const resources = profile.slots.map(s => s.res);
            const unique = [...new Set(resources)];
            console.log("  Resources:", unique);
            console.log("  Slot count:", profile.slots.length);
            console.log("  Neighbor biomes:", profile.neighborBiomes);
        } else {
            console.log("  NO PROFILE");
        }
    });
    
    process.exit(0);
}).catch(e => { console.error("ERROR:", e.message); process.exit(1); });
