export async function runCultistAgent(client: any, tick: number, loreDate: string) {
    // 1. Recruit Cultists from Unrest
    const unrestRes = await client.query("SELECT SUM(unrest) as total FROM sim_burg_economy");
    const unrest = parseInt(unrestRes.rows[0].total) || 0;
    if (unrest > 200 && Math.random() < 0.25) {
        await client.query("INSERT INTO sim_agents (role, location_cell_id) VALUES ('Cultist', (SELECT id FROM sim_cells WHERE id >= (SELECT RANDOM() * (SELECT MAX(id) FROM sim_cells)) LIMIT 1))");
    }

    // 2. Move to Seals or attack
    const cultists = await client.query("SELECT * FROM sim_agents WHERE role = 'Cultist'");
    for (const c of cultists.rows) {
        if (Math.random() < 0.5) {
            // Move to a random cell (simulating moving to a seal)
            await client.query("UPDATE sim_agents SET location_cell_id = (SELECT id FROM sim_cells WHERE id >= (SELECT RANDOM() * (SELECT MAX(id) FROM sim_cells)) LIMIT 1) WHERE id = $1", [c.id]);
        } else {
            // Attack local burg if present
            const burg = await client.query("SELECT burg_id FROM sim_burg_economy WHERE cell_id = $1", [c.location_cell_id]);
            if (burg.rows.length > 0) {
                await client.query("UPDATE sim_burg_economy SET unrest = LEAST(100, unrest + 10) WHERE burg_id = $1", [burg.rows[0].burg_id]);
                if (Math.random() < 0.1) {
                    await client.query("INSERT INTO sim_events (tick, type, message, tier) VALUES ($1, 'CULT_SABOTAGE', 'Cultists performed a dark ritual, destabilizing the local populace.', 'MINOR')", [tick]);
                }
            }
        }
    }
}
