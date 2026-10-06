const { Client } = require('pg');
async function fixSeals() {
  const client = new Client('postgres://postgres:krazy@127.0.0.1:5432/postgres');
  await client.connect();
  
  // Get map dimensions or center
  const cellRes = await client.query("SELECT MAX(center_x) as max_x, MAX(center_y) as max_y FROM sim_cells");
  const maxX = cellRes.rows[0].max_x || 1000;
  const maxY = cellRes.rows[0].max_y || 1000;
  const cx = maxX / 2;
  const cy = maxY / 2;
  const radius = Math.min(cx, cy) * 0.8; // 80% of the way to the edge

  const groves = await client.query("SELECT id FROM sim_sacred_groves ORDER BY id ASC");
  
  for (let i = 0; i < groves.rows.length; i++) {
    const angle = (i / groves.rows.length) * Math.PI * 2;
    const targetX = cx + Math.cos(angle) * radius;
    const targetY = cy + Math.sin(angle) * radius;
    
    const nearestCell = await client.query("SELECT id FROM sim_cells ORDER BY (POWER(center_x - $1, 2) + POWER(center_y - $2, 2)) ASC LIMIT 1", [targetX, targetY]);
    
    if (nearestCell.rows.length > 0) {
      await client.query("UPDATE sim_sacred_groves SET cell_id = $1 WHERE id = $2", [nearestCell.rows[0].id, groves.rows[i].id]);
    }
  }
  console.log("Seals spread evenly.");
  await client.end();
}
fixSeals();
