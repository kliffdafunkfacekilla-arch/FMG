const fs = require('fs');
let c = fs.readFileSync('src/engine/resetWorld.ts', 'utf8');

c = c.replace('// Reliance (8) Consolidation: Move all pop into their largest burg', 
  'const c1 = (await client.query("SELECT COUNT(*) as c FROM sim_burg_economy")).rows[0].c; console.log("Before Reliance:", c1);\n      // Reliance (8) Consolidation: Move all pop into their largest burg');

c = c.replace('// 4. Purge Ghost Burgs',
  'const c2 = (await client.query("SELECT COUNT(*) as c FROM sim_burg_economy")).rows[0].c; console.log("Before Purge:", c2);\n      // 4. Purge Ghost Burgs');

fs.writeFileSync('src/engine/resetWorld.ts', c);
