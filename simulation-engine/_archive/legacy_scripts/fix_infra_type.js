const fs = require('fs');
let orch = fs.readFileSync('src/engine/masterOrchestrator.ts', 'utf8');

orch = orch.replace(/i\.project_type IN \('FARM', 'MINE', 'LUMBER_MILL'\)/g, "i.type IN ('FARM', 'MINE', 'LUMBER_MILL')");
orch = orch.replace(/WHERE project_type IN \('FARM', 'MINE', 'LUMBER_MILL'\)/g, "WHERE type IN ('FARM', 'MINE', 'LUMBER_MILL')");

fs.writeFileSync('src/engine/masterOrchestrator.ts', orch);
console.log("Fixed project_type to type");
