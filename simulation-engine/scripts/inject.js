require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { Client } = require('pg');
const c = new Client(process.env.DATABASE_URL);
c.connect().then(async () => {
    const big = await c.query('SELECT burg_id FROM sim_burg_economy WHERE pop_null > 5000 LIMIT 1');
    const bId = big.rows[0].burg_id;
    
    await c.query('UPDATE sim_burg_economy SET wealth = 5000 WHERE burg_id = $1', [bId]);
    await c.query(`UPDATE sim_industrial_stockpiles SET raw_wood = 500, refined_lumber = 500, complex_inventory = '{"treated_lumber":500, "luxury":500}'::jsonb WHERE burg_id = $1`, [bId]);
        
    console.log('Injected materials into burg', bId);
    process.exit(0);
});
