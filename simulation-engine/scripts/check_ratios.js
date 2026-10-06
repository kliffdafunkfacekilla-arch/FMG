const { Client } = require('pg');
const c = new Client('postgres://postgres:krazy@127.0.0.1:5432/postgres');
c.connect().then(async () => {
    // 1. Get Population Stats
    const popStats = await c.query('SELECT MIN(pop_null) as min_pop, MAX(pop_null) as max_pop, AVG(pop_null) as avg_pop FROM sim_burg_economy');
    console.log('Population Stats:', popStats.rows[0]);

    // 2. Sample 5 random burgs to see their worker ratios
    const sample = await c.query('SELECT burg_id, pop_null, resource_profile FROM sim_burg_economy ORDER BY RANDOM() LIMIT 5');
    console.log('\n--- SAMPLE BURGS ---');
    sample.rows.forEach(r => {
        let profile = null;
        try { profile = JSON.parse(r.resource_profile); } catch(e) { profile = { slots: [] }; }
        if (!profile || !profile.slots) profile = { slots: [] };
        
        let baseWorkers = profile.slots.reduce((sum, slot) => sum + slot.workers, 0);
        let popSize = parseFloat(r.pop_null) || 1000;
        let popScale = popSize / 1000;
        let effectiveWorkers = Math.floor(baseWorkers * popScale);
        let percentage = ((effectiveWorkers / popSize) * 100).toFixed(1);
        
        console.log(`Burg ${r.burg_id}: Pop ${Math.floor(popSize)} | Base Workers: ${baseWorkers} | Effective Gatherers: ${effectiveWorkers} (${percentage}% of pop)`);
    });
    process.exit(0);
});
