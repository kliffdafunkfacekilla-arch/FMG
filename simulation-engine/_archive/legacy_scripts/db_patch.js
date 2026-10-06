const { Client } = require('pg');
const c = new Client('postgres://postgres:krazy@127.0.0.1:5432/postgres');

async function run() {
  await c.connect();
  
  try {
    await c.query(`ALTER TABLE sim_diplomacy ADD CONSTRAINT sim_diplomacy_pair_unique UNIQUE (faction_a_id, faction_b_id);`);
  } catch(e) {
    console.log('Constraint error (expected if exists):', e.message);
  }

  await c.query(`CREATE TABLE IF NOT EXISTS sim_commodity_prices (
    id SERIAL PRIMARY KEY,
    commodity TEXT NOT NULL UNIQUE,
    base_price FLOAT DEFAULT 1.0,
    current_price FLOAT DEFAULT 1.0,
    global_supply INT DEFAULT 0,
    global_demand INT DEFAULT 0,
    last_updated_tick INT DEFAULT 0
  );`);

  await c.query(`INSERT INTO sim_commodity_prices (commodity, base_price, current_price)
  VALUES 
      ('grain', 1.0, 1.0), ('wood', 0.8, 0.8), ('stone', 0.5, 0.5),
      ('iron', 2.0, 2.0), ('copper', 1.5, 1.5), ('gold', 10.0, 10.0),
      ('silver', 5.0, 5.0), ('crystals', 8.0, 8.0), ('dragon_stone_shard', 20.0, 20.0),
      ('exotic', 6.0, 6.0), ('spice', 4.0, 4.0), ('aromatics', 3.0, 3.0),
      ('medicine', 3.5, 3.5), ('narcotic', 5.0, 5.0), ('pitch', 1.2, 1.2),
      ('clay', 0.6, 0.6), ('fibre', 0.7, 0.7), ('textile', 1.8, 1.8),
      ('organs', 7.0, 7.0)
  ON CONFLICT (commodity) DO NOTHING;`);

  console.log('DB updates applied');
  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
