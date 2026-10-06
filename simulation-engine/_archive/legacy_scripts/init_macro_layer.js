const { Client } = require('pg');

async function run() {
    const c = new Client('postgres://postgres:krazy@127.0.0.1:5432/postgres');
    await c.connect();

    console.log("Setting up DB Schema...");

    // 1. Update Factions with Treasury & Capitals
    await c.query(`ALTER TABLE sim_factions ADD COLUMN IF NOT EXISTS treasury INT DEFAULT 10000`);
    await c.query(`ALTER TABLE sim_factions ADD COLUMN IF NOT EXISTS capital_burg_id INT`);

    // 2. Faction Units Table
    await c.query(`DROP TABLE IF EXISTS sim_faction_units CASCADE`);
    await c.query(`
        CREATE TABLE sim_faction_units (
            id SERIAL PRIMARY KEY,
            faction_id INT,
            home_burg_id INT,
            unit_type VARCHAR(50),
            health_pct FLOAT DEFAULT 100.0,
            status VARCHAR(50) DEFAULT 'ACTIVE'
        )
    `);

    // 3. Fringe Factions Table
    await c.query(`DROP TABLE IF EXISTS sim_fringe_factions CASCADE`);
    await c.query(`
        CREATE TABLE sim_fringe_factions (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100),
            capital_burg_id INT,
            region VARCHAR(50)
        )
    `);

    // 4. Update Paragons for Underworld & Counselors
    await c.query(`ALTER TABLE sim_paragons ADD COLUMN IF NOT EXISTS faction_id INT`);
    await c.query(`ALTER TABLE sim_paragons ADD COLUMN IF NOT EXISTS fringe_id INT`);
    await c.query(`ALTER TABLE sim_paragons ADD COLUMN IF NOT EXISTS personal_wealth INT DEFAULT 0`);
    await c.query(`ALTER TABLE sim_paragons ADD COLUMN IF NOT EXISTS agents_civil INT DEFAULT 0`);
    await c.query(`ALTER TABLE sim_paragons ADD COLUMN IF NOT EXISTS agents_security INT DEFAULT 0`);
    await c.query(`ALTER TABLE sim_paragons ADD COLUMN IF NOT EXISTS agents_social INT DEFAULT 0`);
    await c.query(`ALTER TABLE sim_paragons ADD COLUMN IF NOT EXISTS is_counselor BOOLEAN DEFAULT false`);

    console.log("Locating Capitals and Fringe HQs...");

    const stateCapitalIds = [];

    // Find Capitals for State Factions (Biggest city in each faction)
    const factions = await c.query("SELECT id FROM sim_factions");
    for (const f of factions.rows) {
        const biggest = await c.query(`
            SELECT burg_id FROM sim_burg_economy b 
            JOIN sim_cells c ON b.cell_id = c.id 
            WHERE c.faction_id = $1 ORDER BY b.pop_null DESC LIMIT 1
        `, [f.id]);
        if (biggest.rows.length > 0) {
            const capId = biggest.rows[0].burg_id;
            stateCapitalIds.push(capId);
            await c.query("UPDATE sim_factions SET capital_burg_id = $1 WHERE id = $2", [capId, f.id]);
            
            // Generate 3 Ruling Paragons for the Capital
            for (const domain of ['Civil', 'Security', 'Social']) {
                await c.query(`INSERT INTO sim_paragons (burg_id, faction_id, name, domain, title, survival_mult, protection_mult, pleasure_mult) 
                               VALUES ($1, $2, $3, $4, $5, 1.0, 1.0, 1.0)`, 
                               [capId, f.id, `Lord ${domain}`, domain, `Faction ${domain} Ruler`]);
            }
        }
    }

    // Set up Fringe Factions (Assign to random burgs that aren't state capitals)
    const fringes = [
        { name: "The Gilded Compass", region: "CENTER" },
        { name: "The Sky Barons", region: "SOUTH_EAST" },
        { name: "Ghostwind Raiders", region: "NORTH_WEST" },
        { name: "Ivory Fleet", region: "NORTH_EAST" },
        { name: "The Syndicate", region: "SOUTH_WEST" }
    ];

    const allBurgs = await c.query("SELECT burg_id, pop_null FROM sim_burg_economy ORDER BY RANDOM()");
    let fringeIndex = 0;

    for (const burg of allBurgs.rows) {
        if (stateCapitalIds.includes(burg.burg_id)) continue;
        if (fringeIndex >= fringes.length) break;

        const fr = fringes[fringeIndex];
        fringeIndex++;

        const insFr = await c.query(`INSERT INTO sim_fringe_factions (name, capital_burg_id, region) VALUES ($1, $2, $3) RETURNING id`, [fr.name, burg.burg_id, fr.region]);
        const fringeId = insFr.rows[0].id;

        // Generate 12 Underworld Bosses
        const baseAgents = Math.floor((burg.pop_null || 1000) / 12);
        for (let i=0; i<4; i++) {
            for (const dom of ['Civil', 'Security', 'Social']) {
                await c.query(`
                    INSERT INTO sim_paragons (burg_id, fringe_id, name, domain, title, agents_civil, agents_security, agents_social, survival_mult, protection_mult, pleasure_mult)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1.0, 1.0, 1.0)
                `, [burg.burg_id, fringeId, `Capo ${dom} ${i+1}`, dom, `Underworld Boss`, Math.floor(baseAgents/3), Math.floor(baseAgents/3), Math.floor(baseAgents/3)]);
            }
        }
    }

    console.log("Generating Standing Armies & Counselors...");
    const burgs = await c.query("SELECT b.burg_id, b.pop_null, c.faction_id FROM sim_burg_economy b JOIN sim_cells c ON b.cell_id = c.id WHERE c.faction_id IS NOT NULL");
    
    let unitCount = 0;
    for (const b of burgs.rows) {
        // 1 Counselor per burg
        await c.query(`INSERT INTO sim_paragons (burg_id, faction_id, name, domain, title, is_counselor, survival_mult, protection_mult, pleasure_mult) 
                       VALUES ($1, $2, 'Counselor', 'Social', 'Burg Counselor', 1.0, 1.0, 1.0)`, [b.burg_id, b.faction_id]);

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
