const fs = require('fs');
let orch = fs.readFileSync('src/engine/masterOrchestrator.ts', 'utf8');
orch = "import { processCosmic } from './cosmic';\n" + orch;
const anchor = "await processAgents(client, tick);";
if (orch.includes(anchor)) {
    orch = orch.replace(anchor, anchor + "\n    await processCosmic(client, tick);");
    fs.writeFileSync('src/engine/masterOrchestrator.ts', orch);
    console.log("Done");
} else {
    console.log("Not found");
}
