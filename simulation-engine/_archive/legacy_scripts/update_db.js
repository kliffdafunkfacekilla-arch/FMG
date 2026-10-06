const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: 'postgres://postgres:krazy@127.0.0.1:5432/postgres'
  });
  await client.connect();

  try {
    await client.query(`ALTER TABLE sim_cells ADD COLUMN eco_health FLOAT DEFAULT 100.0`);
    console.log("Added eco_health");
  } catch (e) {
    console.log(e.message);
  }

  try {
    await client.query(`ALTER TABLE sim_cells ADD COLUMN eco_max FLOAT DEFAULT 100.0`);
    console.log("Added eco_max");
  } catch (e) {
    console.log(e.message);
  }

  try {
    await client.query(`ALTER TABLE sim_infrastructure ADD COLUMN level INT DEFAULT 1`);
    console.log("Added level");
  } catch (e) {
    console.log(e.message);
  }

  await client.end();
}

run();
