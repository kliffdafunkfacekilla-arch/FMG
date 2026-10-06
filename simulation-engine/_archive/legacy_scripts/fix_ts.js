const fs = require('fs');
let code = fs.readFileSync('src/engine/ai/factionAI.ts', 'utf8');
code = code.replace(`const options: {action: string, score: number}[] = [];`, `const options: {action: string, score: number, target?: any}[] = [];`);
fs.writeFileSync('src/engine/ai/factionAI.ts', code);
console.log("Fixed TS error");
