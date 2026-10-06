const { Client } = require('pg');

async function generateReport() {
    const client = new Client('postgres://postgres:krazy@127.0.0.1:5432/postgres');
    await client.connect();

    console.log("=== AETHERIA SIMULATION REPORT ===");

    // 1. World Demographics & Economy
    const burgsRes = await client.query('SELECT COUNT(*) as c, SUM(pop_null) as pop, SUM(wealth) as wealth, SUM(food) as food FROM sim_burg_economy');
    const bStats = burgsRes.rows[0];
    console.log(`\nGLOBAL STATS:`);
    console.log(`Total Settlements: ${bStats.c}`);
    console.log(`Global Population: ${Math.floor(bStats.pop).toLocaleString()}`);
    console.log(`Global Wealth: ${Math.floor(bStats.wealth).toLocaleString()}`);
    console.log(`Global Food Reserves: ${Math.floor(bStats.food).toLocaleString()}`);

    // 2. Faction Leaderboard (Wealth)
    console.log(`\nTOP 5 WEALTHIEST FACTIONS:`);
    const wealthRes = await client.query('SELECT name, treasury FROM sim_factions ORDER BY treasury DESC LIMIT 5');
    wealthRes.rows.forEach(r => console.log(`- ${r.name}: ${Math.floor(r.treasury).toLocaleString()} gold`));

    // 3. Faction Leaderboard (Population)
    console.log(`\nTOP 5 MOST POPULOUS FACTIONS:`);
    const popRes = await client.query(`
        SELECT f.name, SUM(b.pop_null) as total_pop 
        FROM sim_factions f 
        JOIN sim_cells c ON c.faction_id = f.id 
        JOIN sim_burg_economy b ON b.cell_id = c.id 
        GROUP BY f.name ORDER BY total_pop DESC LIMIT 5
    `);
    popRes.rows.forEach(r => console.log(`- ${r.name}: ${Math.floor(r.total_pop).toLocaleString()} citizens`));

    // 4. Military Power
    console.log(`\nTOP 3 MILITARY SUPERPOWERS:`);
    const milRes = await client.query(`
        SELECT f.name, b.military_forces 
        FROM sim_factions f 
        JOIN sim_cells c ON c.faction_id = f.id 
        JOIN sim_burg_economy b ON b.cell_id = c.id
    `);
    
    let factionMil = {};
    milRes.rows.forEach(r => {
        if (!factionMil[r.name]) factionMil[r.name] = 0;
        if (r.military_forces && typeof r.military_forces === 'object') {
            for (const val of Object.values(r.military_forces)) {
                factionMil[r.name] += (val || 0);
            }
        }
    });
    Object.entries(factionMil)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .forEach(([name, count]) => console.log(`- ${name}: ${Math.floor(count).toLocaleString()} units`));

    // 5. Active Wars
    const warsRes = await client.query('SELECT faction_a_id, faction_b_id, tension FROM sim_diplomacy WHERE status = \'WAR\'');
    console.log(`\nACTIVE WARS: ${warsRes.rows.length}`);
    if (warsRes.rows.length > 0) {
        const facs = await client.query('SELECT id, name FROM sim_factions');
        const facMap = {}; facs.rows.forEach(f => facMap[f.id] = f.name);
        warsRes.rows.forEach(w => console.log(`- ${facMap[w.faction_a_id]} vs ${facMap[w.faction_b_id]} (Tension: ${w.tension})`));
    }

    // 6. Weather & Ecology
    const weatherRes = await client.query('SELECT type, COUNT(*) as c FROM sim_weather_fronts GROUP BY type');
    console.log(`\nACTIVE WEATHER FRONTS:`);
    weatherRes.rows.forEach(r => console.log(`- ${r.type}: ${r.c}`));

    // 7. Recent Major Events
    console.log(`\nRECENT MAJOR HISTORY:`);
    const evRes = await client.query('SELECT tick, type, message FROM sim_events WHERE tier = \'MAJOR\' ORDER BY id DESC LIMIT 5');
    evRes.rows.forEach(r => console.log(`[Tick ${r.tick}] ${r.type}: ${r.message.substring(0, 100)}...`));

    await client.end();
}

generateReport().catch(console.error);
