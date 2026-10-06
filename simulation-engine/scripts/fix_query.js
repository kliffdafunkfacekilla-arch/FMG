const fs = require('fs');
let c = fs.readFileSync('src/engine/masterOrchestrator.ts', 'utf-8');
c = c.replace(
  "const milRes = await client.query('SELECT burg_id, faction_id, military_forces FROM sim_burg_economy');",
  "const milRes = await client.query('SELECT b.burg_id, c.faction_id, b.military_forces FROM sim_burg_economy b JOIN sim_cells c ON b.cell_id = c.id');"
);
c = c.replace(
  "await client.query(`UPDATE sim_burg_economy SET unrest = LEAST(100, COALESCE(unrest,0) + 10) WHERE faction_id = $1`, [loserId]);",
  "await client.query(`UPDATE sim_burg_economy SET unrest = LEAST(100, COALESCE(unrest,0) + 10) FROM sim_cells c WHERE sim_burg_economy.cell_id = c.id AND c.faction_id = $1`, [loserId]);"
);
fs.writeFileSync('src/engine/masterOrchestrator.ts', c, 'utf-8');
