const fs = require('fs');
let code = fs.readFileSync('src/engine/agents/burgOperationsAgent.ts', 'utf8');

const replacement = `
        let military: any = {};
        try {
            if (burg.military_forces) {
                const parsed = typeof burg.military_forces === 'string' ? JSON.parse(burg.military_forces) : burg.military_forces;
                for (const k in parsed) military[k.toLowerCase()] = parsed[k];
            }
        } catch (e) {}
`;

code = code.replace(/let military: any = \{\};\s*try \{\s*if \(burg\.military_forces\) \{\s*const parsed = JSON\.parse\(burg\.military_forces\);\s*for \(const k in parsed\) military\[k\.toLowerCase\(\)\] = parsed\[k\];\s*\}\s*\} catch \(e\) \{\}/, replacement);

fs.writeFileSync('src/engine/agents/burgOperationsAgent.ts', code);
console.log("Fixed military parsing");
