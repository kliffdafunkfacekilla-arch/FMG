const fs = require('fs');
let content = fs.readFileSync('src/engine/agents/burgOperationsAgent.ts', 'utf8');

content = content.replace("unnest($7::int[]) as urban_tier", "unnest($7::int[]) as urban_tier, unnest($8::int[]) as pop_null, unnest($9::text[]) as military_forces");
content = content.replace("burgUpdates.map(u => u.urban_tier)", "burgUpdates.map(u => u.urban_tier), burgUpdates.map(u => u.pop_null || 0), burgUpdates.map(u => JSON.stringify(u.military_forces || {}))");

fs.writeFileSync('src/engine/agents/burgOperationsAgent.ts', content);
