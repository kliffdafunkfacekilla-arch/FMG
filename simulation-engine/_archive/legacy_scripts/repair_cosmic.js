const { Client } = require('pg');

async function repairCosmicSystem() {
  const c = new Client('postgres://postgres:krazy@127.0.0.1:5432/postgres');
  await c.connect();

  console.log("Wiping old Groves/Agents...");
  await c.query("DELETE FROM sim_sacred_groves");
  await c.query("DELETE FROM sim_agents WHERE role IN ('Warden', 'Cultist', 'Dragonspawn')");

  console.log("Generating the 12 Prisons (Sacred Groves)...");
  // Get map bounds roughly. Azgaar maps usually 0-1000 width, 0-1000 height. Or we just get max/min cells.
  const bounds = await c.query("SELECT MIN(center_x) as minx, MAX(center_x) as maxx, MIN(center_y) as miny, MAX(center_y) as maxy FROM sim_cells");
  const { minx, maxx, miny, maxy } = bounds.rows[0];
  const cx = (maxx + minx) / 2;
  const cy = (maxy + miny) / 2;
  const radius = Math.min((maxx - minx), (maxy - miny)) * 0.35; // 35% of map size

  for (let i = 0; i < 12; i++) {
      const angle = (i * Math.PI * 2) / 12;
      const tx = cx + Math.cos(angle) * radius;
      const ty = cy + Math.sin(angle) * radius;
      
      // Find closest cell
      const cell = await c.query("SELECT id FROM sim_cells ORDER BY ((center_x - $1)*(center_x - $1) + (center_y - $2)*(center_y - $2)) ASC LIMIT 1", [tx, ty]);
      if (cell.rows.length > 0) {
          await c.query("INSERT INTO sim_sacred_groves (cell_id, seal_strength) VALUES ($1, 100)", [cell.rows[0].id]);
      }
  }

  console.log("Cosmic topology restored.");
  await c.end();
}
repairCosmicSystem();
