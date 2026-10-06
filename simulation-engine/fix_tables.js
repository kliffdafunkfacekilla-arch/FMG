const {Client} = require('pg');
const c = new Client('postgres://postgres:krazy@127.0.0.1:5432/postgres');
c.connect().then(async () => {
    await c.query(`CREATE TABLE IF NOT EXISTS sim_faction_units (
       id SERIAL PRIMARY KEY,
       faction_id INT,
       unit_type VARCHAR(50),
       count INT DEFAULT 0,
       status VARCHAR(20) DEFAULT 'ACTIVE',
       location_cell_id INT,
       experience INT DEFAULT 0
    )`);
    await c.query(`CREATE TABLE IF NOT EXISTS sim_fringe_lairs (
       id SERIAL PRIMARY KEY,
       fringe_id INT,
       cell_id INT,
       burg_id INT,
       lair_type VARCHAR(50),
       manpower INT DEFAULT 0,
       heat INT DEFAULT 0,
       inventory JSONB DEFAULT '{}'::jsonb
    )`);
    await c.query(`CREATE TABLE IF NOT EXISTS sim_active_projects (
       id SERIAL PRIMARY KEY,
       burg_id INT,
       project_type VARCHAR(50),
       target_tier INT DEFAULT 0,
       ticks_remaining INT
    )`);
    await c.query(`CREATE TABLE IF NOT EXISTS sim_commodity_prices (
        id SERIAL PRIMARY KEY,
        commodity TEXT NOT NULL UNIQUE,
        base_price FLOAT DEFAULT 1.0,
        current_price FLOAT DEFAULT 1.0,
        global_supply INT DEFAULT 0,
        global_demand INT DEFAULT 0,
        last_updated_tick INT DEFAULT 0
    )`);
    console.log("Missing tables recreated.");
    c.end();
});
