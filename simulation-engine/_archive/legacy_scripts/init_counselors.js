const { Client } = require('pg');

async function run() {
    const c = new Client('postgres://postgres:krazy@127.0.0.1:5432/postgres');
    await c.connect();
    
    const burgs = await c.query("SELECT b.burg_id, b.pop_null, c.faction_id FROM sim_burg_economy b JOIN sim_cells c ON b.cell_id = c.id WHERE c.faction_id IS NOT NULL");
    
    let unitCount = 0;
    for (const b of burgs.rows) {
        // 1 Counselor per burg (Fixed the missing 'true' value for is_counselor)
        await c.query(`INSERT INTO sim_paragons (burg_id, faction_id, name, domain, title, is_counselor, survival_mult, protection_mult, pleasure_mult) 
                       VALUES ($1, $2, 'Counselor', 'Social', 'Burg Counselor', true, 1.0, 1.0, 1.0)`, [b.burg_id, b.faction_id]);

        // Army Generation (S, S-1, S-2, S-3)
        let pop = b.pop_null || 0;
        let s = Math.floor(pop / 120);
        if (s < 1) s = 1;

        const inf = s;
        const rng = Math.max(0, s - 1);
        const mnt = Math.max(0, s - 2);
        const air = Math.max(0, s - 3);

        const insertUnit = async (type, count) => {
            for(let i=0; i<count; i++) {
                await c.query(`INSERT INTO sim_faction_units (faction_id, home_burg_id, unit_type) VALUES ($1, $2, $3)`, [b.faction_id, b.burg_id, type]);
                unitCount++;
            }
        };

        await insertUnit('INFANTRY', inf);
        await insertUnit('RANGED', rng);
        await insertUnit('MOUNTED', mnt);
        await insertUnit('AIRSHIP', air);
    }

    console.log(`Successfully generated ${unitCount} standing army units across all Factions!`);
    await c.end();
}
run().catch(console.error);
