const { Client } = require('pg');

async function fixWorld() {
    const client = new Client('postgres://postgres:krazy@127.0.0.1:5432/postgres');
    await client.connect();

    console.log("Fixing illegal wars...");
    // Delete diplomacy where they don't border
    await client.query(`
        DELETE FROM sim_diplomacy 
        WHERE (faction_a_id, faction_b_id) NOT IN (SELECT faction_a, faction_b FROM sim_faction_borders)
    `);

    console.log("Fixing illegal occupations...");
    // Reset occupier_faction_id if the occupier doesn't border the burg's original faction
    // The original faction of a burg is cell.faction_id!
    const badOccs = await client.query(`
        SELECT b.burg_id, b.occupier_faction_id, c.faction_id as original_faction
        FROM sim_burg_economy b
        JOIN sim_cells c ON b.cell_id = c.id
        WHERE b.occupier_faction_id IS NOT NULL
        AND NOT EXISTS (
            SELECT 1 FROM sim_faction_borders fb 
            WHERE fb.faction_a = b.occupier_faction_id AND fb.faction_b = c.faction_id
        )
    `);
    
    for (const occ of badOccs.rows) {
        await client.query("UPDATE sim_burg_economy SET occupier_faction_id = NULL, occupation_ticks = 0 WHERE burg_id = $1", [occ.burg_id]);
        console.log(`Liberated burg ${occ.burg_id} from illegal occupation.`);
    }

    // Also update resetWorld.ts schema to include sim_faction_borders so it isn't lost on wipe!
    console.log("Done fixing geopolitics!");
    await client.end();
}
fixWorld().catch(console.error);
