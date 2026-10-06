const fs = require('fs');
let orch = fs.readFileSync('src/engine/masterOrchestrator.ts', 'utf8');
orch = "import { processAgents } from './agents';\n" + orch;
const anchor = "await processFringeFactions(client, tick, loreDate, paragonsArr, allBurgs);";
if (orch.includes(anchor)) {
    orch = orch.replace(anchor, anchor + "\n    await processAgents(client, tick);");
    fs.writeFileSync('src/engine/masterOrchestrator.ts', orch);
    console.log("Done");
} else {
    console.log("Not found");
}
