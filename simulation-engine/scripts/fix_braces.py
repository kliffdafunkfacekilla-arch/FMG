import re

with open('src/engine/masterOrchestrator.ts', 'r', encoding='utf-8') as f:
    c = f.read()

pattern = r"if \(!profile\) \{\s*// Profile missing.*?\s*if \(!profile\) \{ profile = \{ slots: \[\] \}; \}"
replacement = "if (!profile) { profile = { slots: [] }; }"

c = re.sub(pattern, replacement, c, flags=re.DOTALL)

with open('src/engine/masterOrchestrator.ts', 'w', encoding='utf-8') as f:
    f.write(c)
