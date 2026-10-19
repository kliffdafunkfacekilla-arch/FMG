const { Client } = require('pg');
async function fix() {
  const c = new Client(process.env.DATABASE_URL);
  await c.connect();
  await c.query(`
    CREATE TABLE IF NOT EXISTS sim_fringe_factions (
        id SERIAL PRIMARY KEY,
        name TEXT,
        type VARCHAR(20),
        aggression INT,
        wealth INT
    )
  `);
  console.log('Fixed');
  await c.end();
}
fix();
