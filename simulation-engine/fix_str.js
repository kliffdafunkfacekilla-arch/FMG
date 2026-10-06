const fs = require('fs');
let code = fs.readFileSync('src/engine/agents/burgOperationsAgent.ts', 'utf8');

code = code.replace("burgUpdates.map(u => JSON.stringify(u.military_forces || {}))", "burgUpdates.map(u => typeof u.military_forces === 'string' ? u.military_forces : JSON.stringify(u.military_forces || {}))");
fs.writeFileSync('src/engine/agents/burgOperationsAgent.ts', code);
console.log("Fixed stringify");
