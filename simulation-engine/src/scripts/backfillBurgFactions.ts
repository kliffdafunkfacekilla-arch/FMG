import fs from 'fs';
import pool from '../db/pool';

async function run() {
  const mapPath = 'simulation-engine/data/Holgaland.json';
  const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
  let count = 0;
  for (const b of map.pack.burgs) {
    if (b && b.name && b.cell) {
      await pool.query('UPDATE sim_cells SET faction_id = $1 WHERE id = $2', [b.state, b.cell]);
      count++;
    }
  }
  console.log(`Successfully updated ${count} burg cells with authentic faction IDs!`);
  await pool.end();
}

run().catch(console.error);
