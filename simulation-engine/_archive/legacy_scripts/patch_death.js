const fs = require('fs');
let orch = fs.readFileSync('src/engine/masterOrchestrator.ts', 'utf8');

const target = `              if (currentHealth > 100) currentHealth = 100;
              if (currentHealth < 0) currentHealth = 0;
  
              let deaths = 0;
              let popGrowth = 0;
              if (currentHealth < 100) deaths = Math.floor((burg.pop_null || 0) * ((100 - currentHealth) * 0.01));
              else if (effectiveFood > consumedFood * 1.2) popGrowth = Math.floor((burg.pop_null || 0) * 0.005) + 1;`;

const replace = `              if (currentHealth > 100) currentHealth = 100;
              if (currentHealth < 0) currentHealth = 0;
  
              let deaths = 0;
              let popGrowth = 0;
              if (currentHealth < 20) deaths = Math.floor((burg.pop_null || 0) * ((20 - currentHealth) * 0.005));
              else if (effectiveFood > consumedFood * 1.2) popGrowth = Math.floor((burg.pop_null || 0) * 0.005) + 1;`;

if (orch.includes(target)) {
    orch = orch.replace(target, replace);
    fs.writeFileSync('src/engine/masterOrchestrator.ts', orch);
    console.log("Patched death rate");
} else {
    console.log("Could not find target!");
}
