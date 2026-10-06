const fs = require('fs');
let code = fs.readFileSync('src/engine/resetWorld.ts', 'utf8');

// Remove pop = \d+; from switch cases
code = code.replace(/pop = \d+; /g, '');

// Remove Reliance consolidation block completely
const relianceBlockStart = code.indexOf('// Reliance (8) Consolidation: Move all pop into their largest burg');
const relianceBlockEnd = code.indexOf('// 4. Purge Ghost Burgs');
if (relianceBlockStart > -1 && relianceBlockEnd > -1) {
    code = code.substring(0, relianceBlockStart) + code.substring(relianceBlockEnd);
}

fs.writeFileSync('src/engine/resetWorld.ts', code);
console.log("Replaced successfully");
