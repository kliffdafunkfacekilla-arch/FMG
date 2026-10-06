const fs = require('fs');
let orch = fs.readFileSync('src/engine/masterOrchestrator.ts', 'utf8');

const target = `              burg.pop_null = Math.max(0, (burg.pop_null || 0) + popGrowth - deaths);`;

const replace = `              burg.pop_null = Math.max(0, (burg.pop_null || 0) + popGrowth - deaths);

              // --- COSMIC PIPELINE (Sparkborn -> Pilgrims -> Wardens) ---
              // Citizens awaken dynamically, driven by both birth and the despair of death
              let awakeningBase = popGrowth + (deaths * 0.5); 
              let sparkborn = Math.floor(awakeningBase * 0.5);
              let awoken = Math.floor(sparkborn * 0.15);
              let mad = Math.floor(awoken * 0.25);
              let wardenPilgrims = awoken - mad;

              if (mad > 0) unrestChange += Math.min(5, mad);
              if (wardenPilgrims > 0) {
                  if (Math.random() < (wardenPilgrims / 50.0)) { // 1 agent represents ~50 lore pilgrims
                      await client.query("INSERT INTO sim_agents (role, location_cell_id) VALUES ('Warden', $1)", [burg.cell_id]);
                  }
              }

              // --- COSMIC PIPELINE (Unhappy Citizens -> Cultists) ---
              let currentUnrest = Math.max(0, (burg.unrest || 0) + unrestChange);
              if (currentUnrest > 50) {
                  const hiddenRecruits = (burg.pop_null || 0) * 0.005 * (currentUnrest / 100.0);
                  if (Math.random() < (hiddenRecruits / 50.0)) {
                      await client.query("INSERT INTO sim_agents (role, location_cell_id) VALUES ('Cultist', $1)", [burg.cell_id]);
                  }
              }`;

orch = orch.replace(target, replace);
fs.writeFileSync('src/engine/masterOrchestrator.ts', orch);
console.log("Restored Cosmic Pipeline");
