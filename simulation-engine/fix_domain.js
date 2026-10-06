const fs = require('fs');
let content = fs.readFileSync('src/engine/agents/cartelAgent.ts', 'utf8');
content = content.replace("domain = 'Underworld' AND burg_id", "title = 'Syndicate Boss' AND burg_id");
content = content.replace(", domain) VALUES ($1, $2, 'Syndicate Boss', $3, '[\"Ruthless\"]', 'Underworld')", ") VALUES ($1, $2, 'Syndicate Boss', $3, '[\"Ruthless\"]')");
content = content.replace("cartel.id, cartel.capital_burg_id, `${cartel.name} Capo`, '[\"Ruthless\"]'", "cartel.id, cartel.capital_burg_id, `${cartel.name} Capo`"); // wait the parameters might mismatch
fs.writeFileSync('src/engine/agents/cartelAgent.ts', content);
