const fs = require('fs');
let content = fs.readFileSync('src/engine/agents/cartelAgent.ts', 'utf8');

content = content.replace("outlaw_id = $1", "fringe_id = $1");
content = content.replace("INSERT INTO sim_paragons (outlaw_id, burg_id, title, name, traits, domain)", "INSERT INTO sim_paragons (fringe_id, burg_id, title, name, trait_name, domain)");
content = content.replace("cartel.id, cartel.capital_burg_id, `${cartel.name} Capo`, traits", "cartel.id, cartel.capital_burg_id, `${cartel.name} Capo`");

fs.writeFileSync('src/engine/agents/cartelAgent.ts', content);
