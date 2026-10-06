const fs = require('fs');
let code = fs.readFileSync('src/engine/resetWorld.ts', 'utf8');

code = code.replace("let food = 500;", "let food = Math.max(500, pop * 14);");
code = code.replace("let wealth = 500;", "let wealth = Math.max(500, pop * 2);");

fs.writeFileSync('src/engine/resetWorld.ts', code);
console.log("Fixed resetWorld.ts food buffer");
