import re

with open('src/engine/masterOrchestrator.ts', 'r', encoding='utf-8') as f:
    c = f.read()

# Pattern bounds: from `if (!profile) { profile = { slots: [] }; }` 
# down to `// L-7: Stockpile decay`

pattern = re.compile(
    r'if \(!profile\) \{ profile = \{ slots: \[\] \}; \}.*?(?=\/\/ L-7: Stockpile decay)', 
    re.DOTALL
)

replacement = """if (!profile) { profile = { slots: [] }; }

            const bInfraLevels = burgInfra.get(bId) || new Map<string, number>();
            const requiredInfraBuilds = new Map<string, number>();
            const decayQueue: string[] = [];

            // --- 10-PERSON RULE & LABOR ALLOCATION ---
            const totalWorkerUnits = Math.floor(popSize / 10);
            const crimeRate = Math.min(100, Math.max(0, burg.crime_rate || 0));
            const fringeWorkers = Math.floor(totalWorkerUnits * (crimeRate / 100));
            const lawfulWorkers = Math.max(0, totalWorkerUnits - fringeWorkers);
            
            let harvestWorkers = Math.floor(lawfulWorkers * 0.8);
            let urbanWorkers = lawfulWorkers - harvestWorkers;

            // --- FRINGE OPERATORS (Shadow Economy) ---
            if (fringeWorkers > 0) {
                addItem('narcotic', Math.floor(fringeWorkers * 0.5));
                addItem('poison', Math.floor(fringeWorkers * 0.2));
                currentWealth = Math.max(0, currentWealth - fringeWorkers); // stolen taxes
            }

            // --- HARVESTING (80% Pool) & QUANTITATIVE ECOLOGY ---
            let cellEcoDamage = 0;
            if (profile.slots && profile.slots.length > 0) {
                const totalBaseSlots = profile.slots.reduce((sum: number, s: any) => sum + s.workers, 0) || 1;
                for (const slot of profile.slots) {
                    const res = slot.res;
                    const effectiveWorkers = Math.floor(harvestWorkers * (slot.workers / totalBaseSlots));
                    if (effectiveWorkers <= 0) continue;
                    
                    const requiredInfra = INFRA_MAP[res] || 'CAMP';
                    const infraLevel = bInfraLevels.get(requiredInfra) || 0;
                    const infraCapacity = infraLevel * 10;
                    
                    const coveredWorkers = Math.min(effectiveWorkers, infraCapacity);
                    const uncoveredWorkers = Math.max(0, effectiveWorkers - infraCapacity);
                    
                    const finalAmt = (coveredWorkers * 2) + (uncoveredWorkers * 1);
                    if (finalAmt > 0) {
                        addItem(res, finalAmt);
                        if (res === "wood") stockpile.raw_wood += finalAmt;
                        if (["ore", "iron", "copper", "gold", "silver", "stone", "crystals", "dragon_stone_shard", "gems"].includes(res)) stockpile.raw_ore += finalAmt;
                        if (["medicine", "narcotic", "aromatics", "spice", "poison"].includes(res)) stockpile.raw_herbs += finalAmt;
                        if (["fibre", "wool"].includes(res)) stockpile.raw_fiber += finalAmt;
                    }
                    
                    if (uncoveredWorkers > 0) {
                        cellEcoDamage += uncoveredWorkers;
                        requiredInfraBuilds.set(requiredInfra, (requiredInfraBuilds.get(requiredInfra) || 0) + uncoveredWorkers);
                    }
                }
            }
            cellEcoDeltas.set(burg.cell_id, (cellEcoDeltas.get(burg.cell_id) || 0) + cellEcoDamage);

            // --- URBAN CORE (20% Pool) ---
            
            // Priority 1: Maintenance
            let totalInfraLevels = 0;
            for (const lvl of bInfraLevels.values()) totalInfraLevels += lvl;
            const requiredMaint = Math.ceil(totalInfraLevels / 10);
            
            const maintWorkers = Math.min(urbanWorkers, requiredMaint);
            urbanWorkers -= maintWorkers;
            
            if (maintWorkers < requiredMaint && totalInfraLevels > 0) {
                const builtTypes = Array.from(bInfraLevels.keys()).filter(k => bInfraLevels.get(k)! > 0);
                if (builtTypes.length > 0) {
                    const decayType = builtTypes[Math.floor(Math.random() * builtTypes.length)];
                    decayQueue.push(decayType);
                    bInfraLevels.set(decayType, bInfraLevels.get(decayType)! - 1);
                }
            }

            // Priority 2: Civic (Religion / Entertainment)
            const unrestRatio = Math.max(0.1, burg.unrest / 100);
            const civicWorkers = Math.floor(urbanWorkers * unrestRatio);
            urbanWorkers -= civicWorkers;
            
            let civicBonus = 1;
            if ((inv['aromatics'] || 0) > 0) { inv['aromatics']--; civicBonus += 1; }
            if ((inv['spice'] || 0) > 0) { inv['spice']--; civicBonus += 1; }
            if ((inv['pets'] || 0) > 0) { inv['pets']--; civicBonus += 1; }
            
            burg.unrest = Math.max(0, burg.unrest - (civicWorkers * civicBonus));
            burg.crime_rate = Math.max(0, (burg.crime_rate || 0) - Math.floor(civicWorkers * 0.2));

            // Priority 3: Military
            const militaryWorkers = Math.floor(urbanWorkers * 0.5);
            urbanWorkers -= militaryWorkers;
            
            military_forces['footmen'] = (military_forces['footmen'] || 0) + (militaryWorkers * 10);
            if (militaryWorkers > 0) {
                const foodCost = militaryWorkers * 2;
                if (burg.food >= foodCost) burg.food -= foodCost;
                else burg.unrest += 5; // Unpaid/starving soldiers
            }

            // Priority 4: Crafting
            const craftingWorkers = urbanWorkers;
            if (craftingWorkers > 0) {
                let capacity = craftingWorkers * 5;
                
                const woodToRefine = Math.min(stockpile.raw_wood, capacity);
                stockpile.refined_lumber += woodToRefine;
                stockpile.raw_wood -= woodToRefine;
                capacity -= woodToRefine;
                
                if (capacity > 0) {
                    const oreToRefine = Math.min(stockpile.raw_ore, capacity);
                    stockpile.forged_steel += oreToRefine;
                    stockpile.raw_ore -= oreToRefine;
                    capacity -= oreToRefine;
                }
                
                if (capacity > 0) {
                    const fibreToRefine = Math.min(stockpile.raw_fiber, capacity);
                    stockpile.textiles += fibreToRefine;
                    stockpile.raw_fiber -= fibreToRefine;
                    
                    const invFibreToRefine = Math.min(inv['fibre'] || 0, capacity);
                    inv['textile'] = (inv['textile'] || 0) + invFibreToRefine;
                    if (inv['fibre']) inv['fibre'] -= invFibreToRefine;
                    
                    const invWoolToRefine = Math.min(inv['wool'] || 0, capacity - invFibreToRefine);
                    inv['textile'] = (inv['textile'] || 0) + invWoolToRefine;
                    if (inv['wool']) inv['wool'] -= invWoolToRefine;
                }
            }
            
            """

if pattern.search(c):
    c = pattern.sub(replacement, c, 1)
    with open('src/engine/masterOrchestrator.ts', 'w', encoding='utf-8') as f:
        f.write(c)
    print("Patch 1 successful.")
else:
    print("ERROR: Patch 1 pattern not found.")

# Now we need to inject the `decayQueue` DB updates in the build loop
pattern2 = re.compile(r'(// Legacy advanced buildings)', re.DOTALL)
replacement2 = """for (const decay of decayQueue) {
                await client.query(`UPDATE sim_infrastructure SET level = GREATEST(0, level - 1) WHERE burg_id = $1 AND type = $2`, [bId, decay]);
                const cl = bInfraLevels.get(decay) || 0;
                if (cl <= 0) types.delete(decay);
            }
            
            // Legacy advanced buildings"""

if pattern2.search(c):
    c = pattern2.sub(replacement2, c, 1)
    with open('src/engine/masterOrchestrator.ts', 'w', encoding='utf-8') as f:
        f.write(c)
    print("Patch 2 successful.")
else:
    print("ERROR: Patch 2 pattern not found.")

