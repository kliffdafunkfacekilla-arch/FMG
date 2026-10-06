const fs = require('fs');
let code = fs.readFileSync('src/engine/agents/burgExpansionAgent.ts', 'utf8');

code = code.replace("c.biome NOT IN (11, 2)", "c.biome NOT IN ('11', '2')");
fs.writeFileSync('src/engine/agents/burgExpansionAgent.ts', code);
