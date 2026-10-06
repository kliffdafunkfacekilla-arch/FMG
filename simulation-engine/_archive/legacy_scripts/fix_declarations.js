const fs = require('fs');
let orch = fs.readFileSync('src/engine/masterOrchestrator.ts', 'utf8');

orch = orch.replace(
  "// --- HARVESTING (Flora/Fauna & Quantitative Ecology) ---",
  "// --- HARVESTING (Flora/Fauna & Quantitative Ecology) ---\n            let laborHealthDrain = 0;\n            let laborUnrestSpike = 0;"
);

// Also need to make sure the inside loop assignment was correct:
// I had `laborHealthDrain += ...` in my previous patch_labor.js. Let's make sure it's there.

fs.writeFileSync('src/engine/masterOrchestrator.ts', orch);
console.log("Injected declarations");
