const fs = require('fs');
let orch = fs.readFileSync('src/engine/masterOrchestrator.ts', 'utf8');

const targetChaos = `      // The Convergence (Center Void Drain)`;
const replacementChaos = `      // --- PURE CHAOS INJECTION ---
      // Chaos has no logic. It picks a random variable in the world and mutates it wildly, good or bad, every single tick.
      const chaosRoll = Math.floor(Math.random() * 8);
      let chaosMsg = '';
      
      switch(chaosRoll) {
          case 0: {
              const cBurg = await client.query("SELECT burg_id FROM sim_burg_economy ORDER BY RANDOM() LIMIT 1");
              if (cBurg.rows.length > 0) {
                  const amt = Math.floor(Math.random() * 20000) - 10000;
                  await client.query("UPDATE sim_burg_economy SET wealth = GREATEST(0, COALESCE(wealth, 0) + $1) WHERE burg_id = $2", [amt, cBurg.rows[0].burg_id]);
                  chaosMsg = \`Reality warped. The treasury of Burg \${cBurg.rows[0].burg_id} spontaneously shifted by \${amt} wealth.\`;
              }
              break;
          }
          case 1: {
              const cCell = await client.query("SELECT id, eco_max FROM sim_cells ORDER BY RANDOM() LIMIT 1");
              if (cCell.rows.length > 0) {
                  const amt = Math.floor(Math.random() * 100) - 50;
                  await client.query("UPDATE sim_cells SET eco_health = GREATEST(0, LEAST(COALESCE(eco_max, 100), COALESCE(eco_health, 50) + $1)) WHERE id = $2", [amt, cCell.rows[0].id]);
                  chaosMsg = \`A wave of chaotic energy washed over cell \${cCell.rows[0].id}, randomly altering its ecological health by \${amt}.\`;
              }
              break;
          }
          case 2: {
              const cBurg = await client.query("SELECT burg_id FROM sim_burg_economy ORDER BY RANDOM() LIMIT 1");
              if (cBurg.rows.length > 0) {
                  const amt = Math.floor(Math.random() * 100) - 50;
                  await client.query("UPDATE sim_burg_economy SET crime_rate = LEAST(100, GREATEST(0, COALESCE(crime_rate, 0) + $1)) WHERE burg_id = $2", [amt, cBurg.rows[0].burg_id]);
                  chaosMsg = \`A mental anomaly struck Burg \${cBurg.rows[0].burg_id}, causing crime to inexplicably shift by \${amt}%.\`;
              }
              break;
          }
          case 3: {
              const cGrove = await client.query("SELECT id FROM sim_sacred_groves ORDER BY RANDOM() LIMIT 1");
              if (cGrove.rows.length > 0) {
                  const amt = Math.floor(Math.random() * 40) - 20;
                  await client.query("UPDATE sim_sacred_groves SET seal_strength = GREATEST(0, seal_strength + $1) WHERE id = $2", [amt, cGrove.rows[0].id]);
                  chaosMsg = \`A temporal distortion hit a Sacred Grove, violently warping its seal strength by \${amt}.\`;
              }
              break;
          }
          case 4: {
              const cPrice = await client.query("SELECT commodity FROM sim_commodity_prices ORDER BY RANDOM() LIMIT 1");
              if (cPrice.rows.length > 0) {
                  const mult = (Math.random() * 4) + 0.1; 
                  await client.query("UPDATE sim_commodity_prices SET current_price = current_price * $1 WHERE commodity = $2", [mult, cPrice.rows[0].commodity]);
                  chaosMsg = \`Chaos infected the abstract concept of value. The global market price of \${cPrice.rows[0].commodity} violently multiplied by \${mult.toFixed(2)}x.\`;
              }
              break;
          }
          case 5: {
              const cBurg = await client.query("SELECT burg_id, military_forces FROM sim_burg_economy ORDER BY RANDOM() LIMIT 1");
              if (cBurg.rows.length > 0) {
                  let forces = {};
                  try { forces = JSON.parse(cBurg.rows[0].military_forces || '{}'); } catch(e){}
                  const units = ['footmen', 'archers', 'cavalry', 'skymen', 'shadowpaws'];
                  const rUnit = units[Math.floor(Math.random() * units.length)];
                  const rAmt = Math.floor(Math.random() * 2000) - 1000;
                  forces[rUnit] = Math.max(0, (forces[rUnit] || 0) + rAmt);
                  await client.query("UPDATE sim_burg_economy SET military_forces = $1 WHERE burg_id = $2", [JSON.stringify(forces), cBurg.rows[0].burg_id]);
                  chaosMsg = \`A chaotic warp manifested \${rAmt} \${rUnit} into (or out of) thin air in Burg \${cBurg.rows[0].burg_id}.\`;
              }
              break;
          }
          case 6: {
              const cAgent = await client.query("SELECT id, role FROM sim_agents ORDER BY RANDOM() LIMIT 1");
              if (cAgent.rows.length > 0) {
                  const roles = ['Warden', 'Cultist', 'Dragonspawn'];
                  const nRole = roles[Math.floor(Math.random() * roles.length)];
                  await client.query("UPDATE sim_agents SET role = $1 WHERE id = $2", [nRole, cAgent.rows[0].id]);
                  chaosMsg = \`A localized chaos anomaly randomly transformed a \${cAgent.rows[0].role} into a \${nRole}!\`;
              }
              break;
          }
          case 7: {
              const cBurg = await client.query("SELECT burg_id FROM sim_burg_economy ORDER BY RANDOM() LIMIT 1");
              if (cBurg.rows.length > 0) {
                  const amt = Math.floor(Math.random() * 5000) - 2500;
                  await client.query("UPDATE sim_burg_economy SET pop_null = GREATEST(0, COALESCE(pop_null, 0) + $1) WHERE burg_id = $2", [amt, cBurg.rows[0].burg_id]);
                  chaosMsg = \`Pure chaos: \${Math.abs(amt)} citizens \${amt > 0 ? 'spontaneously generated' : 'were instantly erased from existence'} in Burg \${cBurg.rows[0].burg_id}.\`;
              }
              break;
          }
      }
      
      if (chaosMsg) {
          await client.query("INSERT INTO sim_events (tick, type, message, tier, lore_date) VALUES ($1, 'CHAOS_ANOMALY', $2, 'MINOR', $3)", [tick, chaosMsg, loreDate]);
      }

      // The Convergence (Center Void Drain)`;

orch = orch.replace(targetChaos, replacementChaos);
fs.writeFileSync('src/engine/masterOrchestrator.ts', orch);
console.log("Patched Pure Chaos");
