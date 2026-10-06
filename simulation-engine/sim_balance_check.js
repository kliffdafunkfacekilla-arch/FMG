const {Client} = require('pg');
const c = new Client('postgres://postgres:krazy@127.0.0.1:5432/postgres');

async function runAudit() {
    await c.connect();
    console.log("=== SIMULATION BALANCE REPORT ===");

    // 1. Zombie Burgs (Population math breaks)
    let res = await c.query(`SELECT count(*) as count FROM sim_burg_economy WHERE pop_null < 0`);
    console.log("Burgs with negative pop_null:", res.rows[0].count);

    // 2. Runaway Economy (Wealth Inflation / Deflation)
    res = await c.query(`SELECT MAX(wealth) as max_w, MIN(wealth) as min_w, AVG(wealth) as avg_w FROM sim_burg_economy`);
    console.log("Burg Wealth -> Max:", res.rows[0].max_w, "| Min:", res.rows[0].min_w, "| Avg:", parseFloat(res.rows[0].avg_w).toFixed(2));

    res = await c.query(`SELECT MAX(food) as max_f, MIN(food) as min_f, AVG(food) as avg_f FROM sim_burg_economy`);
    console.log("Burg Food   -> Max:", res.rows[0].max_f, "| Min:", res.rows[0].min_f, "| Avg:", parseFloat(res.rows[0].avg_f).toFixed(2));

    // 3. Constant Starvation (Food = 0)
    res = await c.query(`SELECT count(*) as count FROM sim_burg_economy WHERE food = 0`);
    console.log("Starving Burgs (0 Food):", res.rows[0].count);

    // 4. Cartel Runaway 
    res = await c.query(`SELECT MAX(manpower) as max_m, MIN(manpower) as min_m FROM sim_fringe_factions`);
    console.log("Cartel Manpower -> Max:", res.rows[0].max_m, "| Min:", res.rows[0].min_m);

    // 5. Unrest bounds
    res = await c.query(`SELECT MAX(unrest) as max_u, MIN(unrest) as min_u FROM sim_burg_economy`);
    console.log("Burg Unrest -> Max:", res.rows[0].max_u, "| Min:", res.rows[0].min_u);

    // 6. Faction Wealth bounds
    res = await c.query(`SELECT MAX(wealth) as max_fw, MIN(wealth) as min_fw FROM sim_factions`);
    console.log("Faction Wealth -> Max:", res.rows[0].max_fw, "| Min:", res.rows[0].min_fw);

    await c.end();
}
runAudit();
