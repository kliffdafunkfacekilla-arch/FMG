import re

with open('src/engine/masterOrchestrator.ts', 'r', encoding='utf-8') as f:
    c = f.read()

# 1. Remove the old declarations
c = re.sub(r'let currentWealth = \(burg\.wealth \|\| 0\) \+ wealthInc;', '', c)
c = re.sub(r"let military_forces: Record<string, number> = \{\};\s*try \{ military_forces = JSON\.parse\(burg\.military_forces \|\| '\{\}'\); \} catch \(e\) \{\}", "", c)

# 2. Inject them at the top of the burg loop
top_pattern = r"(const types = new Set\(Array\.from\(bInfraLevelsTop2\.keys\(\)\)\);\n)"
injection = """            let currentWealth = (burg.wealth || 0) + wealthInc;
            let military_forces: Record<string, number> = {};
            try { military_forces = JSON.parse(burg.military_forces || '{}'); } catch (e) {}
"""
# Wait, bInfraLevelsTop2 is for the second loop. The main loop is `const types = new Set(Array.from(bInfraLevelsTop.keys()));`
top_pattern_main = r"(const types = new Set\(Array\.from\(bInfraLevelsTop\.keys\(\)\)\);\n)"
c = re.sub(top_pattern_main, r"\1" + injection, c)

# 3. Fix the `string | undefined` issue
c = c.replace(
    "const decayType = builtTypes[Math.floor(Math.random() * builtTypes.length)];",
    "const decayType = builtTypes[Math.floor(Math.random() * builtTypes.length)] as string;"
)

with open('src/engine/masterOrchestrator.ts', 'w', encoding='utf-8') as f:
    f.write(c)

print("TS fixes applied.")
