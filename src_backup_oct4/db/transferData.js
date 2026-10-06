"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const pg_1 = require("pg");
const path_1 = __importDefault(require("path"));
const dbPath = path_1.default.resolve(__dirname, "../../aetheria.sqlite");
const sqliteDb = new better_sqlite3_1.default(dbPath);
const pgClient = new pg_1.Client({
    connectionString: "postgres://postgres@localhost:5432/postgres",
});
async function migrate() {
    await pgClient.connect();
    console.log("Connected to PostgreSQL");
    // Create schema
    const schema = `
    CREATE TABLE IF NOT EXISTS sim_factions (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        color TEXT NOT NULL,
        lore_text TEXT,
        trait_aggression INT,
        trait_magic INT,
        trait_economy INT,
        wealth INT DEFAULT 1000
    );

    CREATE TABLE IF NOT EXISTS sim_cells (
        id INT PRIMARY KEY,
        faction_id INT REFERENCES sim_factions(id) ON DELETE SET NULL,
        biome TEXT,
        population INT,
        geometry TEXT,
        eco_plants FLOAT DEFAULT 100,
        eco_prey FLOAT DEFAULT 50,
        eco_predators FLOAT DEFAULT 10,
        eco_resources FLOAT DEFAULT 100
    );

    CREATE TABLE IF NOT EXISTS sim_events (
        id SERIAL PRIMARY KEY,
        tick INT,
        type TEXT,
        message TEXT,
        burg_id INT,
        faction_id INT,
        tier TEXT DEFAULT 'MINOR',
        lore_date TEXT
    );

    CREATE TABLE IF NOT EXISTS sim_calendar (
        id SERIAL PRIMARY KEY,
        tick INT,
        year INT,
        month INT,
        moon_phase TEXT,
        season TEXT
    );

    CREATE TABLE IF NOT EXISTS sim_burg_economy (
        burg_id INT PRIMARY KEY,
        food INT,
        raw_materials INT,
        refined_goods INT,
        wealth INT,
        unrest INT,
        pop_attuned INT DEFAULT 0,
        pop_null INT DEFAULT 0,
        dominant_domain TEXT,
        cell_id INT,
        crime_rate INT DEFAULT 0,
        species_demographics TEXT DEFAULT '{}',
        health FLOAT DEFAULT 100,
        military_forces TEXT DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS sim_trade_routes (
        id SERIAL PRIMARY KEY,
        source_burg_id INT,
        dest_burg_id INT,
        throughput INT,
        risk_level INT
    );

    CREATE TABLE IF NOT EXISTS sim_chaos_zones (
        id SERIAL PRIMARY KEY,
        cell_id INT REFERENCES sim_cells(id) ON DELETE CASCADE,
        radius REAL,
        intensity INT,
        effect_type TEXT
    );

    CREATE TABLE IF NOT EXISTS sim_agents (
        id SERIAL PRIMARY KEY,
        name TEXT,
        faction_id INT REFERENCES sim_factions(id) ON DELETE CASCADE,
        location_cell_id INT REFERENCES sim_cells(id) ON DELETE CASCADE,
        role TEXT,
        active_plot TEXT
    );

    CREATE TABLE IF NOT EXISTS sim_diplomacy (
        faction_a_id INT REFERENCES sim_factions(id) ON DELETE CASCADE,
        faction_b_id INT REFERENCES sim_factions(id) ON DELETE CASCADE,
        status TEXT,
        tension INT,
        PRIMARY KEY (faction_a_id, faction_b_id)
    );

    CREATE TABLE IF NOT EXISTS sim_sacred_groves (
        id SERIAL PRIMARY KEY,
        cell_id INT REFERENCES sim_cells(id) ON DELETE CASCADE,
        dragon_name TEXT,
        power_domain TEXT,
        seal_strength REAL
    );

    CREATE TABLE IF NOT EXISTS sim_infrastructure (
        id SERIAL PRIMARY KEY,
        burg_id INT,
        cell_id INT,
        type TEXT,
        status TEXT
    );

    CREATE TABLE IF NOT EXISTS sim_roads (
        id SERIAL PRIMARY KEY,
        source_cell_id INT,
        dest_cell_id INT
    );

    CREATE TABLE IF NOT EXISTS sim_outlaw_factions (
        id SERIAL PRIMARY KEY,
        name TEXT,
        type TEXT,
        origin_cell_id INT,
        manpower INT,
        wealth INT,
        heat INT
    );

    CREATE TABLE IF NOT EXISTS sim_outlaw_enterprises (
        id SERIAL PRIMARY KEY,
        faction_id INT,
        enterprise_type TEXT,
        target_id INT,
        profitability INT,
        heat_generated INT
    );

    CREATE TABLE IF NOT EXISTS sim_paragons (
        id SERIAL PRIMARY KEY,
        burg_id INT NULL,
        outlaw_id INT NULL,
        title TEXT NOT NULL,
        name TEXT NOT NULL,
        traits TEXT NOT NULL,
        corruption_score REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS sim_industrial_stockpiles (
        burg_id INT PRIMARY KEY,
        raw_wood INT DEFAULT 0,
        raw_ore INT DEFAULT 0,
        raw_herbs INT DEFAULT 0,
        raw_fiber INT DEFAULT 0,
        refined_lumber INT DEFAULT 0,
        forged_steel INT DEFAULT 0,
        alchemical_potions INT DEFAULT 0,
        textiles INT DEFAULT 0,
        complex_inventory TEXT DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS sim_fringe_factions (
        id SERIAL PRIMARY KEY,
        name TEXT,
        type TEXT,
        wealth INT DEFAULT 1000
    );
  `;
    await pgClient.query(schema);
    console.log("Schema created.");
    const tables = [
        "sim_factions", "sim_cells", "sim_events", "sim_calendar", "sim_burg_economy",
        "sim_trade_routes", "sim_chaos_zones", "sim_agents", "sim_diplomacy",
        "sim_sacred_groves", "sim_infrastructure", "sim_roads", "sim_outlaw_factions",
        "sim_outlaw_enterprises", "sim_paragons", "sim_industrial_stockpiles", "sim_fringe_factions"
    ];
    for (const table of tables) {
        try {
            const rows = sqliteDb.prepare(`SELECT * FROM ${table}`).all();
            if (rows.length === 0)
                continue;
            console.log(`Migrating ${rows.length} rows for ${table}...`);
            const cols = Object.keys(rows[0]);
            // Exclude auto-incrementing ID if necessary, but actually we want to preserve them for foreign keys
            // So we will insert them directly
            const colString = cols.map(c => `"${c}"`).join(", ");
            const valString = cols.map((_, i) => `$${i + 1}`).join(", ");
            for (const row of rows) {
                const values = cols.map(c => {
                    const val = row[c];
                    if (typeof val === 'number' && !c.includes('eco_') && !c.includes('health') && !c.includes('radius') && !c.includes('seal_strength') && !c.includes('corruption_score')) {
                        return Math.round(val);
                    }
                    return val;
                });
                await pgClient.query(`INSERT INTO ${table} (${colString}) VALUES (${valString}) ON CONFLICT DO NOTHING`, values);
            }
        }
        catch (e) {
            console.log(`Skipped ${table} due to error:`, e);
        }
    }
    // Update sequences for SERIAL columns based on MAX(id)
    for (const table of tables) {
        try {
            const res = await pgClient.query(`SELECT MAX(id) as max_id FROM ${table}`);
            if (res.rows[0].max_id) {
                await pgClient.query(`SELECT setval('${table}_id_seq', ${res.rows[0].max_id})`);
            }
        }
        catch (e) {
            // No id column or sequence
        }
    }
    console.log("Migration complete!");
    process.exit(0);
}
migrate().catch(console.error);
//# sourceMappingURL=transferData.js.map