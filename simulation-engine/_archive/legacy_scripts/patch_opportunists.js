const fs = require('fs');
let orch = fs.readFileSync('src/engine/masterOrchestrator.ts', 'utf8');

// Find the Agent loop
const agentTarget = `      // --- DYNAMIC WARDEN & CULTIST SPAWNING & MOVEMENT ---`;
const agentReplace = `      // --- DYNAMIC AGENT SPAWNING, MIGRATION, AND OPPORTUNISTS ---
      
      // Spawn Merchants organically if trade is good
      if (Math.random() < 0.2) {
          const mBurg = await client.query("SELECT cell_id FROM sim_burg_economy WHERE wealth > 50 ORDER BY RANDOM() LIMIT 1");
          if (mBurg.rows.length > 0) {
              await client.query("INSERT INTO sim_agents (role, location_cell_id) VALUES ('Merchant', $1)", [mBurg.rows[0].cell_id]);
          }
      }

      // Spawn Criminals organically if misery is high
      if (Math.random() < 0.2) {
          const cBurg = await client.query("SELECT cell_id FROM sim_burg_economy WHERE unrest > 50 ORDER BY RANDOM() LIMIT 1");
          if (cBurg.rows.length > 0) {
              await client.query("INSERT INTO sim_agents (role, location_cell_id) VALUES ('Criminal', $1)", [cBurg.rows[0].cell_id]);
          }
      }

      const allAgentsRes = await client.query("SELECT id, role, location_cell_id FROM sim_agents");
      for (const agent of allAgentsRes.rows) {
          if (agent.role === 'Merchant') {
              // Merchants migrate to high demand (high wealth + low luxury/medicine)
              const moveRes = await client.query(\`
                  SELECT b.cell_id, b.wealth 
                  FROM sim_burg_economy b 
                  JOIN sim_cells c ON b.cell_id = c.id
                  WHERE b.wealth >= 5
                  ORDER BY (b.wealth * RANDOM()) DESC 
                  LIMIT 1
              \`);
              if (moveRes.rows.length > 0) {
                  const targetCell = moveRes.rows[0].cell_id;
                  await client.query("UPDATE sim_agents SET location_cell_id = $1 WHERE id = $2", [targetCell, agent.id]);
                  
                  // Sell goods to the target burg to alleviate the Toll of Labor
                  const soldSpice = Math.floor(Math.random() * 3) + 1;
                  const soldMed = Math.floor(Math.random() * 3) + 1;
                  const cost = (soldSpice + soldMed) * 5;
                  
                  // Extract wealth, inject luxuries
                  await client.query(\`
                      UPDATE sim_burg_economy 
                      SET wealth = GREATEST(0, wealth - $1) 
                      WHERE cell_id = $2 AND wealth >= $1
                  \`, [cost, targetCell]);
                  
                  // We need to inject into complex_inventory. 
                  // It's a bit heavy to parse inside this loop, so let's do a fast JSONB update if we were on Postgres 12+
                  // But we can do it via a simple PLPGSQL or just skip for now and reduce unrest directly as a "Service".
                  await client.query(\`
                      UPDATE sim_burg_economy 
                      SET unrest = GREATEST(0, unrest - $1), health = LEAST(100, health + $2)
                      WHERE cell_id = $3
                  \`, [soldSpice * 2, soldMed * 2, targetCell]);
              }
          } else if (agent.role === 'Criminal') {
              // Criminals migrate to high wealth
              const moveRes = await client.query(\`
                  SELECT b.cell_id, b.wealth 
                  FROM sim_burg_economy b 
                  JOIN sim_cells c ON b.cell_id = c.id
                  ORDER BY (b.wealth * RANDOM()) DESC 
                  LIMIT 1
              \`);
              if (moveRes.rows.length > 0) {
                  const targetCell = moveRes.rows[0].cell_id;
                  await client.query("UPDATE sim_agents SET location_cell_id = $1 WHERE id = $2", [targetCell, agent.id]);
                  
                  // Criminals rob the burg, increasing crime and dropping wealth
                  await client.query(\`
                      UPDATE sim_burg_economy 
                      SET wealth = GREATEST(0, wealth - 10), crime_rate = LEAST(100, crime_rate + 2)
                      WHERE cell_id = $1 AND wealth >= 10
                  \`, [targetCell]);
              }
          }
      }

      // --- DYNAMIC WARDEN & CULTIST SPAWNING & MOVEMENT ---`;

orch = orch.replace(agentTarget, agentReplace);
fs.writeFileSync('src/engine/masterOrchestrator.ts', orch);
console.log("Patched Opportunists");
