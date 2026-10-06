const fs = require('fs');
let code = fs.readFileSync('src/engine/agents/cultistAgent.ts', 'utf8');

// Lower spawn threshold from 5000 to 200 unrest
code = code.replace('if (unrest > 5000 && Math.random() < 0.3)', 'if (unrest > 200 && Math.random() < 0.25)');

fs.writeFileSync('src/engine/agents/cultistAgent.ts', code);

// Same for wardenAgent
let wcode = fs.readFileSync('src/engine/agents/wardenAgent.ts', 'utf8');
wcode = wcode.replace('if (sparkborn > 1000 && Math.random() < 0.2)', 'if (sparkborn > 100 && Math.random() < 0.15)');
fs.writeFileSync('src/engine/agents/wardenAgent.ts', wcode);

console.log('Cultist/Warden thresholds lowered');
