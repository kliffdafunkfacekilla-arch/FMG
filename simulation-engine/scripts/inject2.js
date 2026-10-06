const { Client } = require('pg');
const c = new Client('postgres://postgres:krazy@127.0.0.1:5432/postgres');
c.connect().then(async () => {
    const bId = 917;
    await c.query(`UPDATE sim_industrial_stockpiles SET complex_inventory = '{"treated_lumber":500, "luxury":500, "wood": 500, "refined_lumber": 500}'::jsonb WHERE burg_id = $1`, [bId]);
    console.log('Injected JSON');
    process.exit(0);
});
