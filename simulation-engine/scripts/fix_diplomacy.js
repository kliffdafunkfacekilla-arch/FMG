const { Client } = require("pg");
const c = new Client("postgres://postgres:krazy@127.0.0.1:5432/postgres");

c.connect().then(async () => {
    // Check if unique constraint exists on sim_diplomacy
    const r = await c.query("SELECT constraint_name FROM information_schema.table_constraints WHERE table_name='sim_diplomacy' AND constraint_type='UNIQUE'");
    console.log("Diplomacy constraints:", r.rows);
    
    // Try to add it if missing
    try {
        await c.query("ALTER TABLE sim_diplomacy ADD CONSTRAINT sim_diplomacy_pair_unique UNIQUE (faction_a_id, faction_b_id)");
        console.log("Constraint added!");
    } catch(e) { console.log("Constraint error:", e.message); }
    
    // Now manually insert a war to test
    const factions = await c.query("SELECT id FROM sim_factions ORDER BY id LIMIT 2");
    if (factions.rows.length >= 2) {
        const [a, b] = factions.rows;
        await c.query(
            "INSERT INTO sim_diplomacy (faction_a_id, faction_b_id, status, tension) VALUES ($1, $2, 'WAR', 100) ON CONFLICT (faction_a_id, faction_b_id) DO UPDATE SET status = 'WAR', tension = 100",
            [a.id, b.id]
        );
        console.log("Test war inserted/updated between factions", a.id, "and", b.id);
    }
    
    const wars = await c.query("SELECT * FROM sim_diplomacy");
    console.log("Diplomacy rows:", wars.rows);

    process.exit(0);
}).catch(e => { console.error("ERROR:", e.message); process.exit(1); });
