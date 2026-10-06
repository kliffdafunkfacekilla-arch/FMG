const fs = require('fs');
['src/engine/agents/cultistAgent.ts', 'src/engine/agents/wardenAgent.ts', 'src/engine/agents/encounterAgent.ts'].forEach(f => {
  let code = fs.readFileSync(f, 'utf8');
  code = code.replace(/\(SELECT id FROM sim_cells ORDER BY RANDOM\(\) LIMIT 1\)/g, "(SELECT id FROM sim_cells WHERE id >= (SELECT RANDOM() * (SELECT MAX(id) FROM sim_cells)) LIMIT 1)");
  fs.writeFileSync(f, code);
});
