const fs = require('fs');
let code = fs.readFileSync('src/engine/agents/calendarAgent.ts', 'utf8');
code = code.replace("const season = SEASONS[(month - 1) % 8];", "const season = SEASONS[(month - 1) % 8] || 'The Bloom';");
fs.writeFileSync('src/engine/agents/calendarAgent.ts', code);
