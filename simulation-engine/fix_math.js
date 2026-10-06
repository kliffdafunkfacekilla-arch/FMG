const fs = require('fs');
let code = fs.readFileSync('src/engine/agents/factionPlanningAgent.ts', 'utf8');

const oldLine = "grossIncome += 200 * Math.pow(3, size - 1);";
const newLine = "grossIncome += 200 * Math.pow(2, Math.min(size - 1, 6)) + (b.pop_null > 20000 ? Math.floor(b.pop_null / 10) : 0);";

code = code.replace(oldLine, newLine);
fs.writeFileSync('src/engine/agents/factionPlanningAgent.ts', code);
console.log("Fixed hyperinflation math");
