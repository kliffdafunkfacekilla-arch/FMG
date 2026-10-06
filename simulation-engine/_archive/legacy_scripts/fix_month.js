const fs = require('fs');
let orch = fs.readFileSync('src/engine/masterOrchestrator.ts', 'utf8');
orch = orch.replace('const m = (cal.month % 8) || 8;', 'const m = (month % 8) || 8;');
fs.writeFileSync('src/engine/masterOrchestrator.ts', orch);
console.log("Fixed month variable");
