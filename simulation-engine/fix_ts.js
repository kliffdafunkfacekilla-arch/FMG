const fs = require('fs');
let b = fs.readFileSync('src/engine/agents/factionPlanningAgent.ts', 'utf8');
b = b.replace("['DECLARE_WAR', 'PURGE_DISSIDENTS', 'INFRASTRUCTURE_INVESTMENT'].includes(chosenAction?.id)", "['DECLARE_WAR', 'PURGE_DISSIDENTS', 'INFRASTRUCTURE_INVESTMENT'].includes(chosenAction?.id || '')");
fs.writeFileSync('src/engine/agents/factionPlanningAgent.ts', b);
