const fs = require('fs');
let code = fs.readFileSync('src/engine/agents/burgOperationsAgent.ts', 'utf8');
code = code.replace(/urbanTier: urbanTier\n\s+\}\);/, 'urbanTier: urbanTier,\n            pop_null: newPopNull,\n            military_forces: burg.military_forces\n        });');
fs.writeFileSync('src/engine/agents/burgOperationsAgent.ts', code);
