const { Client } = require("pg");
const c = new Client("postgres://postgres:krazy@127.0.0.1:5432/postgres");

c.connect().then(async () => {
    // Check if price index has run at all
    const prices = await c.query("SELECT commodity, current_price, global_supply, last_updated_tick FROM sim_commodity_prices ORDER BY last_updated_tick DESC, commodity LIMIT 5");
    console.log("PRICES:", JSON.stringify(prices.rows, null, 2));

    // Check a stockpile to see if complex_inventory has data
    const sp = await c.query("SELECT burg_id, LEFT(complex_inventory, 200) AS inv_sample FROM sim_industrial_stockpiles WHERE complex_inventory != '{}' LIMIT 3");
    console.log("STOCKPILE SAMPLES:", JSON.stringify(sp.rows, null, 2));

    // Check if tick 880 is divisible by 5 (to see when prices should update)
    const cal = await c.query("SELECT tick FROM sim_calendar ORDER BY id DESC LIMIT 1");
    console.log("CURRENT TICK:", cal.rows[0]);
    console.log("Should price update next tick:", (cal.rows[0].tick + 1) % 5 === 0);

    // Check if sim_commodity_prices table even exists
    const tbl = await c.query("SELECT COUNT(*) as cnt FROM sim_commodity_prices");
    console.log("PRICE ROWS COUNT:", tbl.rows[0]);

    process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });
