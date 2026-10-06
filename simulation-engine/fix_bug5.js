const fs = require('fs');
let content = fs.readFileSync('src/engine/agents/cartelAgent.ts', 'utf8');

content = content.replace("fringe_id = $1", "outlaw_id = $1");
content = content.replace("INSERT INTO sim_paragons (fringe_id, burg_id, title, name, trait_name, domain)", "INSERT INTO sim_paragons (outlaw_id, burg_id, title, name, traits, domain)");
content = content.replace("cartel.id, cartel.capital_burg_id, `${cartel.name} Capo`", "cartel.id, cartel.capital_burg_id, `${cartel.name} Capo`, '[\"Ruthless\"]'");
content = content.replace(/sim_fringe_factions/g, "sim_outlaw_factions");

fs.writeFileSync('src/engine/agents/cartelAgent.ts', content);
