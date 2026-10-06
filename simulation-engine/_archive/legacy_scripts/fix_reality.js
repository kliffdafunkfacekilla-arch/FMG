const fs = require('fs');
let orch = fs.readFileSync('src/engine/masterOrchestrator.ts', 'utf8');

orch = orch.replace("const R = {};", "const R: Record<string, number> = {};");

fs.writeFileSync('src/engine/masterOrchestrator.ts', orch);
console.log("Fixed TS");
