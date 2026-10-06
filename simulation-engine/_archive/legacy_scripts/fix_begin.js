const fs = require('fs');
let orch = fs.readFileSync('src/engine/masterOrchestrator.ts', 'utf8');

orch = orch.replace("await client.query('BEGIN');", `await client.query('BEGIN');
    const physicsRes = await client.query('SELECT name, value FROM sim_reality_constants');
    const R: Record<string, number> = {};
    for (const row of physicsRes.rows) { R[row.name] = parseFloat(row.value); }
`);

fs.writeFileSync('src/engine/masterOrchestrator.ts', orch);
console.log("Injected R");
