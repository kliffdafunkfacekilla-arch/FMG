const fs = require('fs');
let content = fs.readFileSync('src/engine/agents/burgOperationsAgent.ts', 'utf8');

content = content.replace("burgUpdates.map(u => u.urbanTier)", "burgUpdates.map(u => u.urbanTier), burgUpdates.map(u => u.pop_null || 0), burgUpdates.map(u => JSON.stringify(u.military_forces || {}))");

fs.writeFileSync('src/engine/agents/burgOperationsAgent.ts', content);
