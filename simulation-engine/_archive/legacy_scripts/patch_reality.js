const fs = require('fs');
let orch = fs.readFileSync('src/engine/masterOrchestrator.ts', 'utf8');

// 1. Fetch reality constants at the top of executeMasterTick
const topTarget = `    try {
      await client.query('BEGIN');`;
const topReplace = `    try {
      await client.query('BEGIN');
      const physicsRes = await client.query('SELECT name, value FROM sim_reality_constants');
      const R = {};
      for (const row of physicsRes.rows) { R[row.name] = parseFloat(row.value); }
`;
orch = orch.replace(topTarget, topReplace);

// 2. Replace hardcoded rules with reality variables
orch = orch.replace("const DAYS_IN_YEAR = 589;", "const DAYS_IN_YEAR = R['DAYS_IN_YEAR'] || 589;");
orch = orch.replace("const MONTH_LENGTH = 48;", "const MONTH_LENGTH = R['MONTH_LENGTH'] || 48;");
orch = orch.replace("const consumedFood = Math.floor(popSize * 1.5);", "const consumedFood = Math.floor(popSize * (R['FOOD_CONSUMPTION_RATE'] || 1.5));");
orch = orch.replace("const taxIncome = Math.floor(lawfulWorkers * 0.5 * popScale);", "const taxIncome = Math.floor(lawfulWorkers * (R['TAX_YIELD_RATE'] || 0.5) * popScale);");
orch = orch.replace("let currentHealth = (burg.health || 100) - 2;", "let currentHealth = (burg.health || 100) - (R['BASE_HEALTH_DEGRADE'] || 2);");
orch = orch.replace("if (m <= 2) regenRate = 1.5; // Spring", "if (m <= 2) regenRate = (R['ECO_REGEN_SPRING'] || 1.5); // Spring");
orch = orch.replace("(b.pop_null - COALESCE(i.cap, 0)) / 1000.0", "(b.pop_null - COALESCE(i.cap, 0)) / (R['ECO_DRAIN_RATE'] || 1000.0)");
orch = orch.replace("const casRate = Math.min(1.0, (100 - tension) * 0.1);", "const casRate = Math.min(1.0, (100 - tension) * (R['COMBAT_LETHALITY'] || 0.1));");
orch = orch.replace("ABS(c.center_x - c2.center_x) < 30 AND ABS(c.center_y - c2.center_y) < 30", "ABS(c.center_x - c2.center_x) < (R['WARDEN_SPEED'] || 30) AND ABS(c.center_y - c2.center_y) < (R['WARDEN_SPEED'] || 30)");

// 3. Update the Pure Chaos Injection to alter Reality directly!
const oldChaosTarget = `      // --- PURE CHAOS INJECTION ---
      // Chaos has no logic. It picks a random variable in the world and mutates it wildly, good or bad, every single tick.
      const chaosRoll = Math.floor(Math.random() * 8);`;

const newChaos = `      // --- REALITY-BENDING PURE CHAOS INJECTION ---
      // Chaos literally bends the mathematical constants and rules of the simulation engine itself.
      const chaosRoll = Math.floor(Math.random() * 9);`;

orch = orch.replace(oldChaosTarget, newChaos);

// Add the reality bending case
const case7Target = `          case 7: {
              const cBurg = await client.query("SELECT burg_id FROM sim_burg_economy ORDER BY RANDOM() LIMIT 1");
              if (cBurg.rows.length > 0) {
                  const amt = Math.floor(Math.random() * 5000) - 2500;
                  await client.query("UPDATE sim_burg_economy SET pop_null = GREATEST(0, COALESCE(pop_null, 0) + $1) WHERE burg_id = $2", [amt, cBurg.rows[0].burg_id]);
                  chaosMsg = \`Pure chaos: \${Math.abs(amt)} citizens \${amt > 0 ? 'spontaneously generated' : 'were instantly erased from existence'} in Burg \${cBurg.rows[0].burg_id}.\`;
              }
              break;
          }`;

const case8 = `          case 8: {
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

orch = orch.replace(case7Target, case7Target + "\n" + case8);

fs.writeFileSync('src/engine/masterOrchestrator.ts', orch);
console.log("Patched Reality Bending");
