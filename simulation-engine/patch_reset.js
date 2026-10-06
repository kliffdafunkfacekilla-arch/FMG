const fs = require('fs');
let code = fs.readFileSync('src/engine/resetWorld.ts', 'utf8');

code = code.replace('treasury INT DEFAULT 1000', 'treasury BIGINT DEFAULT 1000');
code = code.replace(
    'is_border BOOLEAN\n);',
    'is_border BOOLEAN,\n    faction_a INT,\n    faction_b INT\n);'
);
code = code.replace(
    'tension INT DEFAULT 50\n);',
    'tension INT DEFAULT 50,\n    UNIQUE(faction_a_id, faction_b_id)\n);'
);

fs.writeFileSync('src/engine/resetWorld.ts', code);
