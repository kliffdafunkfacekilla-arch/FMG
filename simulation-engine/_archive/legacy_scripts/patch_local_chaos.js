const fs = require('fs');
let orch = fs.readFileSync('src/engine/masterOrchestrator.ts', 'utf8');

// 1. Fetch anomalies at the top
const rFetchTarget = `    const R: Record<string, number> = {};
    for (const row of physicsRes.rows) { R[row.name] = parseFloat(row.value); }`;
const rFetchReplace = `    const R: Record<string, number> = {};
    for (const row of physicsRes.rows) { R[row.name] = parseFloat(row.value); }

    const anomalyRes = await client.query("SELECT * FROM sim_chaos_anomalies");
    const anomaliesByBurg = new Map<number, Record<string, number>>();
    for (const row of anomalyRes.rows) {
        if (!anomaliesByBurg.has(row.burg_id)) anomaliesByBurg.set(row.burg_id, {});
        anomaliesByBurg.get(row.burg_id)![row.constant_name] = parseFloat(row.multiplier);
    }`;
orch = orch.replace(rFetchTarget, rFetchReplace);

// 2. Fetch local anomalies inside the Burg Loop
const burgLoopTarget = `          for (const burg of myBurgs) {
              const bId = burg.burg_id;`;
const burgLoopReplace = `          for (const burg of myBurgs) {
              const bId = burg.burg_id;
              const localAnomalies = anomaliesByBurg.get(bId) || {};`;
orch = orch.replace(burgLoopTarget, burgLoopReplace);

// 3. Replace the calculations with the local multiplier
orch = orch.replace(`const consumedFood = Math.floor(popSize * (R['FOOD_CONSUMPTION_RATE'] || 1.5));`, `const localFoodRate = (R['FOOD_CONSUMPTION_RATE'] || 1.5) * (localAnomalies['FOOD_CONSUMPTION_RATE'] !== undefined ? localAnomalies['FOOD_CONSUMPTION_RATE'] : 1.0);
              const consumedFood = Math.floor(popSize * localFoodRate);`);

orch = orch.replace(`let currentHealth = (burg.health || 100) - (R['BASE_HEALTH_DEGRADE'] || 2);`, `const localHealthDegrade = (R['BASE_HEALTH_DEGRADE'] || 2) * (localAnomalies['BASE_HEALTH_DEGRADE'] !== undefined ? localAnomalies['BASE_HEALTH_DEGRADE'] : 1.0);
              let currentHealth = (burg.health || 100) - localHealthDegrade;`);

orch = orch.replace(`const taxIncome = Math.floor(lawfulWorkers * (R['TAX_YIELD_RATE'] || 0.5) * popScale);`, `const localTaxRate = (R['TAX_YIELD_RATE'] || 0.5) * (localAnomalies['TAX_YIELD_RATE'] !== undefined ? localAnomalies['TAX_YIELD_RATE'] : 1.0);
              const taxIncome = Math.floor(lawfulWorkers * localTaxRate * popScale);`);

// 4. Update Case 8 to spawn a localized anomaly
const case8Target = `          case 8: {
              const rulesRes = await client.query("SELECT name, value FROM sim_reality_constants ORDER BY RANDOM() LIMIT 1");
              if (rulesRes.rows.length > 0) {
                  const rule = rulesRes.rows[0];
                  let newVal;
                  // Extremely wild reality bends
                  if (Math.random() < 0.2) newVal = rule.value * -1; // Invert reality (e.g. eating food generates food)
                  else if (Math.random() < 0.5) newVal = rule.value * (Math.random() * 10); // Multiply up to 10x
                  else newVal = rule.value * (Math.random()); // Shrink
                  
                  await client.query("UPDATE sim_reality_constants SET value = $1 WHERE name = $2", [newVal, rule.name]);
                  chaosMsg = \`THE LAWS OF PHYSICS HAVE ALTERED. The fundamental constant '\${rule.name}' violently shifted from \${rule.value.toFixed(2)} to \${newVal.toFixed(2)}.\`;
              }
              break;
          }`;
const case8Replace = `          case 8: {
              const cBurg = await client.query("SELECT burg_id FROM sim_burg_economy ORDER BY RANDOM() LIMIT 1");
              if (cBurg.rows.length > 0) {
                  const rules = ['FOOD_CONSUMPTION_RATE', 'BASE_HEALTH_DEGRADE', 'TAX_YIELD_RATE'];
                  const rule = rules[Math.floor(Math.random() * rules.length)];
                  let mult;
                  if (Math.random() < 0.2) mult = -1.0; 
                  else if (Math.random() < 0.5) mult = (Math.random() * 10);
                  else mult = Math.random(); 
                  
                  const dur = Math.floor(Math.random() * 10) + 2;
                  await client.query("INSERT INTO sim_chaos_anomalies (burg_id, constant_name, multiplier, duration_ticks) VALUES ($1, $2, $3, $4)", [cBurg.rows[0].burg_id, rule, mult, dur]);
                  chaosMsg = \`LOCALIZED REALITY WARP: In Burg \${cBurg.rows[0].burg_id}, the laws of physics shattered. \${rule} is multiplied by \${mult.toFixed(2)}x for the next \${dur} ticks.\`;
              }
              break;
          }`;
orch = orch.replace(case8Target, case8Replace);

// 5. Degrade anomalies at the very end of the tick
const cleanupTarget = `      // The Convergence (Center Void Drain)`;
const cleanupReplace = `      // Clean up localized chaos anomalies
      await client.query("UPDATE sim_chaos_anomalies SET duration_ticks = duration_ticks - 1");
      await client.query("DELETE FROM sim_chaos_anomalies WHERE duration_ticks <= 0");

      // The Convergence (Center Void Drain)`;
orch = orch.replace(cleanupTarget, cleanupReplace);

fs.writeFileSync('src/engine/masterOrchestrator.ts', orch);
console.log("Patched localized anomalies");
