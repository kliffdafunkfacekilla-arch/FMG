const fs = require('fs');
let code = fs.readFileSync('src/engine/ai/factionActions.ts', 'utf8');

// Fix DECLARE_GOLDEN_AGE — make it cost more and require much higher bar
code = code.replace(
    "evaluate: (s) => { return s.treasury > 5000 && s.avgUnrest < 10 && s.avgHealth > 80 ? 95 : 0; },",
    "evaluate: (s) => { if (s.treasury < 20000 || s.avgUnrest > 5 || s.avgHealth < 90) return 0; return 50; },"
);
code = code.replace(
    `execute: async (s, client) => { await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 3000) WHERE id = $1", [s.id]); await client.query("UPDATE sim_burg_economy SET wealth = wealth + 100, food = food + 100 WHERE burg_id = ANY($1::int[])", [s.myBurgs.map(b=>b.burg_id)]); return \`A flourishing renaissance of art and culture has begun! \${s.name} has entered a spectacular Golden Age!\`; }`,
    `execute: async (s, client) => { await client.query("UPDATE sim_factions SET treasury = GREATEST(0, treasury - 15000) WHERE id = $1", [s.id]); await client.query("UPDATE sim_burg_economy SET wealth = wealth + 100, food = food + 100 WHERE burg_id = ANY($1::int[])", [s.myBurgs.map(b=>b.burg_id)]); return \`A flourishing renaissance of art and culture has begun! \${s.name} has entered a spectacular Golden Age!\`; }`
);

fs.writeFileSync('src/engine/ai/factionActions.ts', code);
console.log('Golden Age nerfed');
