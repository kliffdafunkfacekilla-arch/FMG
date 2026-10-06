const fs = require('fs');
let content = fs.readFileSync('src/observer/Dashboard.tsx', 'utf8');
content = content.replace('if (economy[cell.id]) {', 'if (economy[cell.id] && economy[cell.id].pop_null > 0) {');
fs.writeFileSync('src/observer/Dashboard.tsx', content);
