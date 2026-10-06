import re

with open('src/engine/masterOrchestrator.ts', 'r', encoding='utf-8') as f:
    c = f.read()

# Replace the block from `const myBiome = ` down to `for (const slot of profile.slots) { addRes(slot.res, slot.workers); }`

pattern = re.compile(
    r'const myBiome = String\(burg\.biome \|\| "5"\);.*?for \(const slot of profile\.slots\) \{\s*addRes\(slot\.res, slot\.workers\);\s*\}', 
    re.DOTALL
)

replacement = """if (!profile) { profile = { slots: [] }; }

            // QE: Quantitative Ecology Gathering Loop
            let cellEcoDamage = 0;
            const bInfraLevels = burgInfra.get(bId) || new Map<string, number>();
            const requiredInfraBuilds = new Map<string, number>(); // Track which infra types are deficient

            for (const slot of profile.slots) {
                const res = slot.res;
                const effectiveWorkers = Math.max(1, Math.floor(slot.workers * popScale));
                const requiredInfra = INFRA_MAP[res] || 'CAMP'; // Default to camp if unmapped
                
                const infraLevel = bInfraLevels.get(requiredInfra) || 0;
                const infraCapacity = infraLevel * 10; // 1 Level covers 10 effective workers
                
                const coveredWorkers = Math.min(effectiveWorkers, infraCapacity);
                const uncoveredWorkers = Math.max(0, effectiveWorkers - infraCapacity);
                
                // Yield calculation: covered = x2, uncovered = x1
                const finalAmt = (coveredWorkers * 2) + (uncoveredWorkers * 1);
                if (finalAmt > 0) {
                    addItem(res, finalAmt);
                    // Backwards compat for refineries
                    if (res === "wood") stockpile.raw_wood += finalAmt;
                    if (["ore", "iron", "copper", "gold", "silver", "stone"].includes(res)) stockpile.raw_ore += finalAmt;
                    if (["medicine", "narcotic", "aromatics", "spice"].includes(res)) stockpile.raw_herbs += finalAmt;
                    if (res === "fibre") stockpile.raw_fiber += finalAmt;
                }
                
                // Ecological damage
                if (uncoveredWorkers > 0) {
                    cellEcoDamage += uncoveredWorkers; // 1 damage per uncovered worker
                    requiredInfraBuilds.set(requiredInfra, (requiredInfraBuilds.get(requiredInfra) || 0) + uncoveredWorkers);
                }
            }

            // Cell damage tracking array (apply at end of tick)
            cellEcoDeltas.set(burg.cell_id, (cellEcoDeltas.get(burg.cell_id) || 0) + cellEcoDamage);"""

if pattern.search(c):
    c = pattern.sub(replacement, c, 1)
    with open('src/engine/masterOrchestrator.ts', 'w', encoding='utf-8') as f:
        f.write(c)
    print("Pattern matched and replaced.")
else:
    print("ERROR: Pattern not found.")
