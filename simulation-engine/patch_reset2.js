const fs = require('fs');
let code = fs.readFileSync('src/engine/resetWorld.ts', 'utf8');

const tensionCode = `
    // --- LORE BASELINE TENSION & WEATHER SEEDING ---
    const borders = await pgClient.query("SELECT DISTINCT faction_a, faction_b FROM sim_faction_borders WHERE faction_a IS NOT NULL AND faction_b IS NOT NULL");
    for (const p of borders.rows) {
        const roll = Math.random();
        if (roll < 0.10) {
            await pgClient.query("INSERT INTO sim_diplomacy (faction_a_id, faction_b_id, status, tension) VALUES ($1, $2, 'WAR', 100) ON CONFLICT (faction_a_id, faction_b_id) DO UPDATE SET status='WAR', tension=100", [p.faction_a, p.faction_b]);
        } else if (roll < 0.35) {
            const tension = 40 + Math.floor(Math.random() * 50);
            await pgClient.query("INSERT INTO sim_diplomacy (faction_a_id, faction_b_id, status, tension) VALUES ($1, $2, 'COLD_WAR', $3) ON CONFLICT (faction_a_id, faction_b_id) DO UPDATE SET status='COLD_WAR', tension=$3", [p.faction_a, p.faction_b, tension]);
        }
    }

    const stormTypes = ['STORM', 'STORM', 'BLIZZARD', 'DROUGHT', 'CHAOS_STORM'];
    for (let i = 0; i < 4; i++) {
        const type = stormTypes[Math.floor(Math.random() * stormTypes.length)];
        await pgClient.query("INSERT INTO sim_weather_fronts (type, x, y, dx, dy, radius, lifetime) VALUES ($1, $2, $3, $4, $5, $6, $7)", [type, Math.random()*120-10, Math.random()*120-10, (Math.random()-0.5)*2, (Math.random()-0.5)*2, 15+Math.random()*20, 12+Math.floor(Math.random()*10)]);
    }
    console.log("Seeded initial tension and weather.");
`;

code = code.replace("console.log('Reset complete!');", tensionCode + "\n    console.log('Reset complete!');");
fs.writeFileSync('src/engine/resetWorld.ts', code);
