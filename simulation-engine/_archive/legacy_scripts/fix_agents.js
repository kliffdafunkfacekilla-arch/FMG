const fs = require('fs');
let orch = fs.readFileSync('src/engine/masterOrchestrator.ts', 'utf8');

orch = orch.replace(
    "INSERT INTO sim_agents (role, location_cell_id, state) VALUES ('Cultist', (SELECT id FROM sim_cells ORDER BY RANDOM() LIMIT 1), 'WANDERING')", 
    "INSERT INTO sim_agents (role, location_cell_id) VALUES ('Cultist', (SELECT id FROM sim_cells ORDER BY RANDOM() LIMIT 1))"
);
orch = orch.replace(
    "INSERT INTO sim_agents (role, location_cell_id, state) VALUES ('Warden', (SELECT id FROM sim_cells ORDER BY RANDOM() LIMIT 1), 'PATROLLING')", 
    "INSERT INTO sim_agents (role, location_cell_id) VALUES ('Warden', (SELECT id FROM sim_cells ORDER BY RANDOM() LIMIT 1))"
);

fs.writeFileSync('src/engine/masterOrchestrator.ts', orch);
console.log("Fixed sim_agents insert");
