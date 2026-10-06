const fs = require('fs');
let code = fs.readFileSync('src/engine/agents/factionPlanningAgent.ts', 'utf8');

code = code.replace(
    'let newTreasury = Math.max(0, (f.treasury || 0) + netIncome);',
    'let newTreasury = Math.max(0, (Number(f.treasury) || 0) + netIncome);'
);

fs.writeFileSync('src/engine/agents/factionPlanningAgent.ts', code);
console.log('Fixed BigInt string concatenation bug.');
