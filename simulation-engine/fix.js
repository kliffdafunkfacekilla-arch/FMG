const fs = require('fs');
let b = fs.readFileSync('src/engine/agents/factionPlanningAgent.ts', 'utf8');
b = b.replace('const chosenAction = scoredActions[0].action;', 'const chosenAction = scoredActions[0]?.action;');
b = b.replace('const msg = await chosenAction.execute(state, client);', 'const msg = chosenAction ? await chosenAction.execute(state, client) : null;');
fs.writeFileSync('src/engine/agents/factionPlanningAgent.ts', b);
