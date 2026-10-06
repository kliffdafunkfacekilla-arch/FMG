const { Client } = require('pg');
const c = new Client('postgres://postgres:krazy@127.0.0.1:5432/postgres');
c.connect().then(async () => {
    // Check total unrest, military forces, crime rates, infrastructure levels
    const stats = await c.query(`
        SELECT 
            AVG(unrest) as avg_unrest,
            AVG(crime_rate) as avg_crime,
            AVG(health) as avg_health,
            SUM(pop_null) as total_pop
        FROM sim_burg_economy
    `);
    
    // Total Footmen from military forces
    const mil = await c.query(`SELECT military_forces FROM sim_burg_economy`);
    let totalGuards = 0;
    mil.rows.forEach(r => {
        try {
            const f = JSON.parse(r.military_forces || '{}');
            totalGuards += (f.footmen || 0);
        } catch(e){}
    });
    
    console.log("--- GLOBAL SIMULATION STATUS (NEW ECONOMY) ---");
    console.log(`Total World Population: ${Math.floor(stats.rows[0].total_pop)}`);
    console.log(`Total Worker Units: ${Math.floor(stats.rows[0].total_pop / 10)}`);
    console.log(`Average Unrest: ${parseFloat(stats.rows[0].avg_unrest).toFixed(1)}`);
    console.log(`Average Crime: ${parseFloat(stats.rows[0].avg_crime).toFixed(1)}`);
    console.log(`Average Health: ${parseFloat(stats.rows[0].avg_health).toFixed(1)}`);
    console.log(`Total Active City Guards (Footmen): ${totalGuards}`);
    
    process.exit(0);
});
