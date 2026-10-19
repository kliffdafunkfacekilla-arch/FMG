require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { Client } = require('pg');
const c = new Client(process.env.DATABASE_URL);
c.connect().then(async () => {
    const bId = 917;
    await c.query(`UPDATE sim_industrial_stockpiles SET complex_inventory = '{"treated_lumber":500, "luxury":500, "wood": 500, "refined_lumber": 500}'::jsonb WHERE burg_id = $1`, [bId]);
    console.log('Injected JSON');
    process.exit(0);
});
