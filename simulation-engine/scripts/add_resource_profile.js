require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { Client } = require("pg");
const c = new Client(process.env.DATABASE_URL);

async function run() {
    await c.connect();
    
    // Check columns
    const cols = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'sim_burg_economy' ORDER BY ordinal_position");
    console.log("sim_burg_economy columns:", cols.rows.map(x => x.column_name));
    
    // Add resource_profile column if not exists
    const hasCol = cols.rows.some(r => r.column_name === "resource_profile");
    if (!hasCol) {
        await c.query("ALTER TABLE sim_burg_economy ADD COLUMN resource_profile TEXT DEFAULT NULL");
        console.log("Added resource_profile column");
    } else {
        console.log("resource_profile column already exists");
    }
    
    process.exit(0);
}
run().catch(e => { console.error(e.message); process.exit(1); });
