const fs = require('fs');
let orch = fs.readFileSync('src/engine/masterOrchestrator.ts', 'utf8');

orch = orch.replace(
    "// The Warden/Cosmic system responds to the chaos index", 
    "const totalCrime = parseInt(globalUnrestRes.rows[0].total_crime) || 0; const chaosIndex = totalUnrest + totalCrime; // The Warden/Cosmic system responds to the chaos index"
);

fs.writeFileSync('src/engine/masterOrchestrator.ts', orch);
console.log("Fixed chaosIndex");
