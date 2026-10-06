const { Client } = require('pg');
const c = new Client('postgres://postgres:krazy@127.0.0.1:5432/postgres');
c.connect().then(()=>c.query("ALTER TABLE sim_burg_economy DROP COLUMN IF EXISTS complex_inventory; ALTER TABLE sim_industrial_stockpiles ADD COLUMN IF NOT EXISTS complex_inventory JSONB DEFAULT '{}'::jsonb;")).then(()=>c.end());
