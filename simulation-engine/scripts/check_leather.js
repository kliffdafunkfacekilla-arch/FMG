const { Client } = require("pg");
const c = new Client("postgres://postgres:krazy@127.0.0.1:5432/postgres");

c.connect().then(async () => {
    const r = await c.query(`
        SELECT 
            SUM(CASE WHEN complex_inventory::jsonb ? 'leather' THEN (complex_inventory::jsonb->>'leather')::float ELSE 0 END) as total_leather,
            COUNT(*) FILTER(WHERE complex_inventory::jsonb ? 'leather' AND (complex_inventory::jsonb->>'leather')::float > 0) as burgs_with_leather
        FROM sim_industrial_stockpiles
    `);
    console.log("Leather after rebake + 1 tick:", r.rows[0]);
    
    // Check a biome-4 or biome-5 burg directly
    const bio = await c.query(`
        SELECT s.burg_id, s.complex_inventory 
        FROM sim_industrial_stockpiles s 
        JOIN sim_burg_economy b ON b.burg_id = s.burg_id 
        JOIN sim_cells c ON c.id = b.cell_id 
        WHERE c.biome IN ('4','5') AND s.complex_inventory::jsonb ? 'leather'
        LIMIT 3
    `);
    bio.rows.forEach(row => {
        const inv = JSON.parse(row.complex_inventory);
        console.log(`Burg ${row.burg_id}: grain=${inv.grain}, leather=${inv.leather}, fibre=${inv.fibre}`);
    });
    
    process.exit(0);
}).catch(e => { console.error("ERROR:", e.message); process.exit(1); });
