const { Client } = require('pg');
const Database = require('better-sqlite3');

async function syncPop() {
    const pg = new Client('postgres://postgres:krazy@127.0.0.1:5432/postgres');
    await pg.connect();
    
    const burgsRes = await pg.query('SELECT burg_id, pop_null, wealth, food, crime_rate, military_forces FROM sim_burg_economy');
    
    const sqlite = new Database('aetheria.sqlite');
    const stmt = sqlite.prepare(`UPDATE sim_burg_economy SET pop_null = @pop_null, wealth = @wealth, food = @food, crime_rate = @crime_rate, military_forces = @military_forces WHERE burg_id = @burg_id`);
    
    let updated = 0;
    for (const r of burgsRes.rows) {
        stmt.run({
            pop_null: r.pop_null,
            wealth: r.wealth,
            food: r.food,
            crime_rate: r.crime_rate,
            military_forces: typeof r.military_forces === 'string' ? r.military_forces : JSON.stringify(r.military_forces),
            burg_id: r.burg_id
        });
        updated++;
    }
    console.log(`Synced stats for ${updated} burgs into aetheria.sqlite.`);
    
    sqlite.close();
    await pg.end();
}

syncPop().catch(console.error);
