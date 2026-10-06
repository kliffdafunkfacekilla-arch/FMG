const fs = require('fs');
let code = fs.readFileSync('src/engine/resetWorld.ts', 'utf8');

code = code.replace("treasury           INT  DEFAULT 1000", "treasury           BIGINT  DEFAULT 1000");
fs.writeFileSync('src/engine/resetWorld.ts', code);
console.log("Updated schema in resetWorld.ts");
