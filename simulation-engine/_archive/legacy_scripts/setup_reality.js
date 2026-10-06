const { Client } = require('pg');
async function setupReality() {
  const c = new Client('postgres://postgres:krazy@127.0.0.1:5432/postgres');
  await c.connect();

  await c.query(`
    CREATE TABLE IF NOT EXISTS sim_reality_constants (
        name VARCHAR(50) PRIMARY KEY,
        value FLOAT
    )
  `);

  const defaults = {
      'FOOD_CONSUMPTION_RATE': 1.5,
      'TAX_YIELD_RATE': 0.5,
      'BASE_HEALTH_DEGRADE': 2.0,
      'MONTH_LENGTH': 48.0,
      'DAYS_IN_YEAR': 589.0,
      'UNREST_BLEED': 5.0,
      'COMBAT_LETHALITY': 0.1,
      'ECO_REGEN_SPRING': 1.5,
      'ECO_DRAIN_RATE': 3000.0,
      'WARDEN_SPEED': 30.0,
      'GRAVITY_CONSTANT': 9.8,
      'MAGIC_EFFICIENCY': 1.0
  };

  for (const [k, v] of Object.entries(defaults)) {
      await c.query("INSERT INTO sim_reality_constants (name, value) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING", [k, v]);
  }

  console.log("Reality constants seeded.");
  await c.end();
}
setupReality();
