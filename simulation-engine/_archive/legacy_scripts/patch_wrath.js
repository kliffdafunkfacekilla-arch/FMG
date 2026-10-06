const fs = require('fs');
let orch = fs.readFileSync('src/engine/masterOrchestrator.ts', 'utf8');

// We need to inject Nature's Wrath inside the Burg loop, right around where we calculate food.
const wrathTarget = `              const myFoodProd = Math.floor(baseInventoryFood * farmBonus * (1.0 + traitModifier));`;

const wrathReplace = `              // --- NATURE'S WRATH (Ecological Blowback) ---
              let ecoMultiplier = 1.0;
              let localEcoHealth = 100;
              try { localEcoHealth = burg.eco_health !== undefined ? burg.eco_health : 100; } catch (e) {}

              if (localEcoHealth < 5) {
                  ecoMultiplier = 0.0; // Total localized famine
                  unrestChange += 5; // Panic
              } else if (localEcoHealth < 20) {
                  ecoMultiplier = 0.5; // Severe drought/blight
                  if (Math.random() < 0.1) {
                      // Spawn displaced fauna
                      await client.query("INSERT INTO sim_agents (role, location_cell_id) VALUES ('Beasts', $1)", [burg.cell_id]);
                      await client.query("INSERT INTO sim_events (tick, type, message, tier, burg_id, lore_date) VALUES ($1, 'BEAST_ATTACK', 'Displaced predators, driven mad by the barren ecology, attacked the settlements.', 'MINOR', $2, $3)", [tick, burg.burg_id, loreDate]);
                  }
              }

              const myFoodProd = Math.floor(baseInventoryFood * farmBonus * (1.0 + traitModifier) * ecoMultiplier);`;

orch = orch.replace(wrathTarget, wrathReplace);

// We also need to add agent logic for 'Beasts'
const beastTarget = `      const dragonspawnRes = await client.query("SELECT location_cell_id FROM sim_agents WHERE role = 'Dragonspawn'");`;
const beastReplace = `      const beastsRes = await client.query("SELECT id, location_cell_id FROM sim_agents WHERE role = 'Beasts'");
      if (beastsRes.rows.length > 0) {
          for (const beast of beastsRes.rows) {
              // Beasts wander randomly
              const moveRes = await client.query(\`
                  SELECT id FROM sim_cells 
                  WHERE ABS(center_x - (SELECT center_x FROM sim_cells WHERE id = $1)) < 50
                  ORDER BY RANDOM() LIMIT 1
              \`, [beast.location_cell_id]);
              if (moveRes.rows.length > 0) {
                  await client.query("UPDATE sim_agents SET location_cell_id = $1 WHERE id = $2", [moveRes.rows[0].id, beast.id]);
                  // Attack local burg
                  await client.query("UPDATE sim_burg_economy SET health = GREATEST(0, health - 5), pop_null = GREATEST(0, pop_null - 10) WHERE cell_id = $1", [moveRes.rows[0].id]);
              }
              // Beasts naturally die off if the ecology heals or just over time
              if (Math.random() < 0.1) {
                  await client.query("DELETE FROM sim_agents WHERE id = $1", [beast.id]);
              }
          }
      }

      const dragonspawnRes = await client.query("SELECT location_cell_id FROM sim_agents WHERE role = 'Dragonspawn'");`;

orch = orch.replace(beastTarget, beastReplace);

fs.writeFileSync('src/engine/masterOrchestrator.ts', orch);
console.log("Patched Nature's Wrath");
