const { Client } = require('pg');
async function setupAnomalies() {
  const c = new Client('postgres://postgres:krazy@127.0.0.1:5432/postgres');
  await c.connect();
  await c.query(`
    CREATE TABLE IF NOT EXISTS sim_chaos_anomalies (
        id SERIAL PRIMARY KEY,
        burg_id INT,
        constant_name VARCHAR(50),
        multiplier FLOAT,
        duration_ticks INT
    )
  `);
  // Reset the global reality constants back to normal just in case they got scrambled
  await c.query("UPDATE sim_reality_constants SET value = 1.5 WHERE name = 'FOOD_CONSUMPTION_RATE'");
  await c.query("UPDATE sim_reality_constants SET value = 0.5 WHERE name = 'TAX_YIELD_RATE'");
  await c.query("UPDATE sim_reality_constants SET value = 2.0 WHERE name = 'BASE_HEALTH_DEGRADE'");
  console.log("Anomalies table created.");
  await c.end();
}
setupAnomalies();
