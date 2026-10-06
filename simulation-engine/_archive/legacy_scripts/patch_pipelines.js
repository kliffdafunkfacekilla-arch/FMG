const fs = require('fs');
let orch = fs.readFileSync('src/engine/masterOrchestrator.ts', 'utf8');

// 1. Demographic Pipeline (inside the Burg loop)
// Find the popGrowth logic
const popGrowthTarget = `            if (currentHealth < 100) deaths = Math.floor((burg.pop_null || 0) * ((100 - currentHealth) * 0.01));
            else if (effectiveFood > consumedFood * 1.2) popGrowth = Math.floor((burg.pop_null || 0) * 0.005) + 1;

            burg.food = Math.max(0, (burg.food || 0) + effectiveFood - consumedFood);
            burg.unrest = Math.max(0, (burg.unrest || 0) + unrestChange);
            burg.health = currentHealth;
            burg.pop_null = Math.max(0, (burg.pop_null || 0) + popGrowth - deaths);`;

const popGrowthReplacement = `            if (currentHealth < 100) deaths = Math.floor((burg.pop_null || 0) * ((100 - currentHealth) * 0.01));
            else if (effectiveFood > consumedFood * 1.2) popGrowth = Math.floor((burg.pop_null || 0) * 0.005) + 1;

            // COSMIC PIPELINE: Sparkborn -> Wardens
            if (popGrowth > 0) {
                const sparkborn = popGrowth * 0.50;
                const awoken = sparkborn * 0.15;
                const mad = awoken * 0.25;
                const wardenPilgrims = awoken * 0.75;
                
                // Represent probability to spawn a full Warden agent from the pilgrimmage
                if (Math.random() < (wardenPilgrims / 50.0)) { // 1 agent represents ~50 lore pilgrims
                    await client.query("INSERT INTO sim_agents (role, location_cell_id) VALUES ('Warden', $1)", [burg.cell_id]);
                }
                
                // Mad sparkborn increase local unrest slightly
                if (mad > 0) unrestChange += (mad * 0.1);
            }

            // COSMIC PIPELINE: Unhappy citizens -> Cultists
            if (burg.unrest > 50) {
                const hiddenRecruits = (burg.pop_null || 0) * 0.001 * (burg.unrest / 100.0);
                if (Math.random() < (hiddenRecruits / 50.0)) {
                    await client.query("INSERT INTO sim_agents (role, location_cell_id) VALUES ('Cultist', $1)", [burg.cell_id]);
                    await client.query("INSERT INTO sim_events (tick, type, message, tier, burg_id, lore_date) VALUES ($1, 'CULT_RECRUITMENT', 'A twisted Cultist cell has explicitly broken off from the unhappy populace.', 'MINOR', $2, $3)", [tick, burg.burg_id, loreDate]);
                }
            }

            burg.food = Math.max(0, (burg.food || 0) + effectiveFood - consumedFood);
            burg.unrest = Math.max(0, (burg.unrest || 0) + unrestChange);
            burg.health = currentHealth;
            burg.pop_null = Math.max(0, (burg.pop_null || 0) + popGrowth - deaths);`;

orch = orch.replace(popGrowthTarget, popGrowthReplacement);

// 2. Cultist -> Dragonspawn Mutation + Convergence Logic
const cosmicTarget = `// --- DYNAMIC WARDEN & CULTIST SPAWNING & MOVEMENT ---`;
const cosmicReplacement = `// --- DYNAMIC WARDEN & CULTIST SPAWNING & MOVEMENT ---

      // Cultist Mutation Pipeline -> Dragonspawn
      await client.query(\`
          UPDATE sim_agents 
          SET role = 'Dragonspawn' 
          WHERE role = 'Cultist' AND RANDOM() < 0.05
      \`);
      
      const dragonspawnRes = await client.query("SELECT location_cell_id FROM sim_agents WHERE role = 'Dragonspawn'");
      if (dragonspawnRes.rows.length > 0) {
          // Dragonspawn radiate chaos fields, spiking unrest and dropping eco_health in their cells
          for (const ds of dragonspawnRes.rows) {
              await client.query("UPDATE sim_burg_economy SET unrest = LEAST(100, unrest + 15) WHERE cell_id = $1", [ds.location_cell_id]);
              await client.query("UPDATE sim_cells SET eco_health = GREATEST(0, eco_health - 10) WHERE id = $1", [ds.location_cell_id]);
          }
      }

      // The Convergence (Center Void Drain)
      if (tick % 10 === 0) {
          const boundsRes = await client.query("SELECT MIN(center_x) as minx, MAX(center_x) as maxx, MIN(center_y) as miny, MAX(center_y) as maxy FROM sim_cells");
          if (boundsRes.rows.length > 0) {
              const { minx, maxx, miny, maxy } = boundsRes.rows[0];
              const cx = (maxx + minx) / 2;
              const cy = (maxy + miny) / 2;
              
              // Find the 12 groves and calculate flow
              const grovesRes = await client.query("SELECT seal_strength FROM sim_sacred_groves");
              const totalSeals = grovesRes.rows.reduce((sum: number, g: any) => sum + g.seal_strength, 0);
              
              if (totalSeals < 1200) {
                  // Seals are imperfect, chaos bleeds from the Convergence
                  await client.query("INSERT INTO sim_events (tick, type, message, tier, lore_date) VALUES ($1, 'CONVERGENCE_BLEED', 'The 12 Ley-Prisons shuddered. Chaos bled from the Convergence at the center of the world.', 'MAJOR', $2)", [tick, loreDate]);
              }
          }
      }
`;

orch = orch.replace(cosmicTarget, cosmicReplacement);

// Fix the movement query to include Dragonspawn
orch = orch.replace("WHERE role IN ('Warden', 'Cultist')", "WHERE role IN ('Warden', 'Cultist', 'Dragonspawn')");

// Also remove the old RNG spawning of Wardens/Cultists from chaosIndex since they spawn from populations now!
const oldRngSpawns = `      if (chaosIndex > 3000 && Math.random() < 0.2) {
          // High chaos spawns cultists
          await client.query("INSERT INTO sim_agents (role, location_cell_id) VALUES ('Cultist', (SELECT id FROM sim_cells ORDER BY RANDOM() LIMIT 1))");
      } else if (chaosIndex < 1000 && Math.random() < 0.2) {
          // Low chaos spawns wardens
          await client.query("INSERT INTO sim_agents (role, location_cell_id) VALUES ('Warden', (SELECT id FROM sim_cells ORDER BY RANDOM() LIMIT 1))");
      }`;

orch = orch.replace(oldRngSpawns, "");

fs.writeFileSync('src/engine/masterOrchestrator.ts', orch);
console.log("Patched cosmic pipelines");
