const { Client } = require("pg");
const c = new Client("postgres://postgres:krazy@127.0.0.1:5432/postgres");

c.connect().then(async () => {
    console.log("=== AUDIT VERIFICATION ===\n");

    // C-1: Health is non-trivial and varying = double-write fixed
    const health = await c.query("SELECT AVG(health) as avg_health, MIN(health) as min_health, COUNT(*) FILTER (WHERE health < 50) as sick_burgs FROM sim_burg_economy");
    console.log("C-1 (double-write fixed - health now varies):", JSON.stringify(health.rows[0]));

    // H-2: Leather in inventory (biomes 4 and 5 produce it)
    const leather = await c.query(`SELECT COUNT(*) as burgs_with_leather FROM sim_industrial_stockpiles WHERE complex_inventory::jsonb ? 'leather' AND (complex_inventory::jsonb->>'leather')::float > 0`);
    console.log("H-2 (leather produced by biome burgs):", JSON.stringify(leather.rows[0]));

    // H-2: Check a biome-5 burg stockpile 
    const bio5 = await c.query(`SELECT s.burg_id, s.complex_inventory FROM sim_industrial_stockpiles s JOIN sim_burg_economy b ON b.burg_id = s.burg_id JOIN sim_cells c ON c.id = b.cell_id WHERE c.biome = '5' LIMIT 1`);
    if (bio5.rows.length > 0) {
        const inv = JSON.parse(bio5.rows[0].complex_inventory || "{}");
        console.log("H-2 (biome-5 sample inventory - grain/leather):", { grain: inv.grain, leather: inv.leather });
    }

    // L-1: Verify price index updated  
    const prices = await c.query("SELECT commodity, current_price, global_supply, last_updated_tick FROM sim_commodity_prices WHERE last_updated_tick > 0 ORDER BY global_supply DESC LIMIT 5");
    console.log("L-1 (price index live):", JSON.stringify(prices.rows));

    // L-7: Check stockpile decay is bounding values
    const maxStock = await c.query(`SELECT MAX((complex_inventory::jsonb->>'stone')::float) as max_stone, MAX((complex_inventory::jsonb->>'wood')::float) as max_wood FROM sim_industrial_stockpiles`);
    console.log("L-7 (stockpile caps): Max values:", JSON.stringify(maxStock.rows[0]));

    // M-4: War state in diplomacy 
    const wars = await c.query("SELECT COUNT(*) as total_rows, COUNT(*) FILTER (WHERE status = 'WAR') as wars FROM sim_diplomacy");
    console.log("M-4 (diplomacy):", JSON.stringify(wars.rows[0]));

    // M-6: Grain is in inventory
    const grain = await c.query(`SELECT SUM((complex_inventory::jsonb->>'grain')::float) as total_grain FROM sim_industrial_stockpiles WHERE complex_inventory::jsonb ? 'grain'`);
    console.log("M-6 (grain in inventory):", JSON.stringify(grain.rows[0]));

    // Recent events to verify war and blockades firing
    const events = await c.query("SELECT type, message FROM sim_events WHERE tick > 870 ORDER BY id DESC LIMIT 8");
    console.log("Recent events:", events.rows.map(e => e.type + ": " + e.message.substring(0, 60)));

    process.exit(0);
}).catch(e => { console.error("ERROR:", e.message); process.exit(1); });
