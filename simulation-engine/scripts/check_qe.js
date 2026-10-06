const { Client } = require("pg");
const c = new Client("postgres://postgres:krazy@127.0.0.1:5432/postgres");
c.connect().then(async()=>{
  const eco = await c.query("SELECT id, eco_health, eco_max FROM sim_cells WHERE eco_health < 100 ORDER BY eco_health ASC LIMIT 5");
  console.log("Cells with eco strain:", eco.rows);
  
  const infra = await c.query("SELECT type, SUM(level) as total_levels FROM sim_infrastructure GROUP BY type ORDER BY total_levels DESC");
  console.log("Total infrastructure built:", infra.rows);
  
  const inv = await c.query("SELECT SUM((complex_inventory::jsonb->>'pets')::float) as pets, SUM((complex_inventory::jsonb->>'ivory')::float) as ivory FROM sim_industrial_stockpiles WHERE complex_inventory::jsonb ? 'pets' OR complex_inventory::jsonb ? 'ivory'");
  console.log("New resources found:", inv.rows[0]);
  process.exit(0);
});
