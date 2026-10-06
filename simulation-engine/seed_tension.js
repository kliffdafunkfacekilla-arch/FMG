const { Client } = require('pg');

async function seedTension() {
    const client = new Client('postgres://postgres:krazy@127.0.0.1:5432/postgres');
    await client.connect();

    // Get all border pairs
    const borders = await client.query("SELECT DISTINCT faction_a, faction_b FROM sim_faction_borders WHERE faction_a IS NOT NULL AND faction_b IS NOT NULL");
    const pairs = borders.rows;
    
    // Seed ~30% of border pairs with COLD_WAR, ~10% with actual WAR
    const startingWars = [];
    for (const p of pairs) {
        const roll = Math.random();
        if (roll < 0.10) {
            // Hot war
            await client.query(
                `INSERT INTO sim_diplomacy (faction_a_id, faction_b_id, status, tension)
                 VALUES ($1, $2, 'WAR', 100) ON CONFLICT (faction_a_id, faction_b_id) DO UPDATE SET status='WAR', tension=100`,
                [p.faction_a, p.faction_b]
            );
            startingWars.push(`${p.faction_a} vs ${p.faction_b}`);
        } else if (roll < 0.35) {
            // Cold war / tension
            const tension = 40 + Math.floor(Math.random() * 50);
            await client.query(
                `INSERT INTO sim_diplomacy (faction_a_id, faction_b_id, status, tension)
                 VALUES ($1, $2, 'COLD_WAR', $3) ON CONFLICT (faction_a_id, faction_b_id) DO UPDATE SET status='COLD_WAR', tension=$3`,
                [p.faction_a, p.faction_b, tension]
            );
        }
        // else: neutral (no row)
    }
    console.log('Starting wars seeded:', startingWars.join(', '));

    // Also seed a few weather fronts to start with so it's not empty
    await client.query("DELETE FROM sim_weather_fronts");
    const stormTypes = ['STORM', 'STORM', 'BLIZZARD', 'DROUGHT', 'CHAOS_STORM'];
    for (let i = 0; i < 4; i++) {
        const type = stormTypes[Math.floor(Math.random() * stormTypes.length)];
        await client.query(
            `INSERT INTO sim_weather_fronts (type, x, y, dx, dy, radius, lifetime) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [type, Math.random()*120-10, Math.random()*120-10, (Math.random()-0.5)*2, (Math.random()-0.5)*2, 15+Math.random()*20, 12+Math.floor(Math.random()*10)]
        );
    }
    console.log('Seeded 4 starting weather fronts');

    await client.end();
}
seedTension().catch(console.error);
