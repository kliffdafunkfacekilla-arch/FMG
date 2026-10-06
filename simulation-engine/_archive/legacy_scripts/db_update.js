const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgres://postgres:krazy@127.0.0.1:5432/postgres',
});

async function run() {
  try {
    await client.connect();
    
    try {
      await client.query('ALTER TABLE sim_burg_economy ADD COLUMN urban_tier INT DEFAULT 1;');
      console.log('Added urban_tier column.');
    } catch (e) {
      console.log('urban_tier might already exist: ', e.message);
    }

    try {
      await client.query('ALTER TABLE sim_burg_economy ADD COLUMN architecture_type VARCHAR(20) DEFAULT \'MIXED\';');
      console.log('Added architecture_type column.');
    } catch (e) {
      console.log('architecture_type might already exist: ', e.message);
    }
  } catch (err) {
    console.error('Error connecting or executing: ', err);
  } finally {
    await client.end();
  }
}

run();
