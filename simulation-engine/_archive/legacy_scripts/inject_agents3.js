const fs = require('fs');
let orch = fs.readFileSync('src/engine/masterOrchestrator.ts', 'utf8');

const anchor = `      const burgEconRes = await client.query('SELECT b.*, c.faction_id, c.current_temp, c.center_x, c.center_y, c.biome FROM sim_burg_economy b JOIN sim_cells c ON b.cell_id = c.id');`;

const replacement = `      // --- DYNAMIC AGENT SPAWNING, MIGRATION, AND OPPORTUNISTS ---
      if (Math.random() < 0.3) {
          const mBurg = await client.query("SELECT cell_id FROM sim_burg_economy WHERE wealth > 50 ORDER BY RANDOM() LIMIT 1");
          if (mBurg.rows.length > 0) {
              await client.query("INSERT INTO sim_agents (role, location_cell_id) VALUES ('Merchant', $1)", [mBurg.rows[0].cell_id]);
          }
      }
      if (Math.random() < 0.3) {
          const cBurg = await client.query("SELECT cell_id FROM sim_burg_economy WHERE unrest > 50 ORDER BY RANDOM() LIMIT 1");
          if (cBurg.rows.length > 0) {
              await client.query("INSERT INTO sim_agents (role, location_cell_id) VALUES ('Criminal', $1)", [cBurg.rows[0].cell_id]);
          }
      }

      const allAgentsRes = await client.query("SELECT id, role, location_cell_id FROM sim_agents");
      for (const agent of allAgentsRes.rows) {
          if (agent.role === 'Merchant') {
              const moveRes = await client.query("SELECT b.cell_id FROM sim_burg_economy b JOIN sim_cells c ON b.cell_id = c.id WHERE b.wealth >= 5 ORDER BY RANDOM() LIMIT 1");
              if (moveRes.rows.length > 0) {
                  const targetCell = moveRes.rows[0].cell_id;
                  await client.query("UPDATE sim_agents SET location_cell_id = $1 WHERE id = $2", [targetCell, agent.id]);
                  await client.query("UPDATE sim_burg_economy SET wealth = GREATEST(0, wealth - 10), unrest = GREATEST(0, unrest - 10), health = LEAST(100, health + 10) WHERE cell_id = $1 AND wealth >= 10", [targetCell]);
              }
          } else if (agent.role === 'Criminal') {
              const moveRes = await client.query("SELECT b.cell_id FROM sim_burg_economy b JOIN sim_cells c ON b.cell_id = c.id ORDER BY RANDOM() LIMIT 1");
              if (moveRes.rows.length > 0) {
                  const targetCell = moveRes.rows[0].cell_id;
                  await client.query("UPDATE sim_agents SET location_cell_id = $1 WHERE id = $2", [targetCell, agent.id]);
                  await client.query("UPDATE sim_burg_economy SET wealth = GREATEST(0, wealth - 10), crime_rate = LEAST(100, crime_rate + 2) WHERE cell_id = $1 AND wealth >= 10", [targetCell]);
              }
          } else if (agent.role === 'Beasts') {
              const moveRes = await client.query("SELECT id FROM sim_cells WHERE ABS(center_x - (SELECT center_x FROM sim_cells WHERE id = $1)) < 50 ORDER BY RANDOM() LIMIT 1", [agent.location_cell_id]);
              if (moveRes.rows.length > 0) {
                  await client.query("UPDATE sim_agents SET location_cell_id = $1 WHERE id = $2", [moveRes.rows[0].id, agent.id]);
                  await client.query("UPDATE sim_burg_economy SET health = GREATEST(0, health - 5), pop_null = GREATEST(0, pop_null - 10) WHERE cell_id = $1", [moveRes.rows[0].id]);
              }
              if (Math.random() < 0.1) await client.query("DELETE FROM sim_agents WHERE id = $1", [agent.id]);
          }
      }

` + anchor;

if (orch.includes(anchor)) {
    orch = orch.replace(anchor, replacement);
    fs.writeFileSync('src/engine/masterOrchestrator.ts', orch);
    console.log("Successfully injected agents!");
} else {
    console.error("Still no anchor found!");
}
