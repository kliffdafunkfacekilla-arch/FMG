import re

with open('src/engine/masterOrchestrator.ts', 'r', encoding='utf-8') as f:
    c = f.read()

# 1. Weather Logic Patch
weather_pattern = re.compile(r"""(for \(const front of activeFronts\) \{.*?)(if \(foodDmg \+ unrestDmg \+ healthDmg === 0\) continue;)""", re.DOTALL)
weather_replacement = """for (const front of activeFronts) {
            let foodDmg = 0, unrestDmg = 0, healthDmg = 0;
            if (front.type === "HURRICANE")  { foodDmg = 30; unrestDmg = 15; healthDmg = 5; }
            if (front.type === "BLIZZARD")   { foodDmg = 20; unrestDmg = 10; healthDmg = 3; }
            if (front.type === "DROUGHT")    { foodDmg = 40; unrestDmg = 20; healthDmg = 0; }
            if (front.type === "AETHER_FOG") { foodDmg = 0;  unrestDmg = 25; healthDmg = 8; }
            if (front.type === "WILDFIRE")   { foodDmg = 50; unrestDmg = 25; healthDmg = 10; }
            if (front.type === "EARTHQUAKE") { foodDmg = 10; unrestDmg = 40; healthDmg = 20; }
            
            if (foodDmg + unrestDmg + healthDmg === 0) continue;
            
            // Damage burgs whose cell center falls within the front radius, with architecture modifiers
            await client.query(`
                UPDATE sim_burg_economy be
                SET
                    food   = GREATEST(0, COALESCE(food,0)     - ($1 * CASE WHEN be.architecture_type = 'WOOD' AND $7 = 'WILDFIRE' THEN 2.0 WHEN be.architecture_type = 'CLAY' AND $7 = 'HURRICANE' THEN 2.0 ELSE 1.0 END)),
                    unrest = LEAST(100, COALESCE(unrest,0)    + ($2 * CASE WHEN be.architecture_type = 'WOOD' AND $7 = 'WILDFIRE' THEN 2.0 WHEN be.architecture_type = 'STONE' AND $7 = 'EARTHQUAKE' THEN 2.0 ELSE 1.0 END)),
                    health = GREATEST(0, COALESCE(health,100) - ($3 * CASE WHEN be.architecture_type = 'STONE' AND $7 = 'EARTHQUAKE' THEN 2.0 WHEN be.architecture_type = 'WOOD' AND $7 = 'WILDFIRE' THEN 2.0 ELSE 1.0 END))
                FROM sim_cells c
                WHERE be.cell_id = c.id
                  AND SQRT(POWER(c.center_x - $4, 2) + POWER(c.center_y - $5, 2)) < $6
            `, [foodDmg, unrestDmg, healthDmg, front.x, front.y, front.radius, front.type]);
            
            continue; // Skip the old query below
"""

if weather_pattern.search(c):
    c = weather_pattern.sub(weather_replacement, c, 1)
    print("Weather patch applied.")
else:
    print("Weather patch NOT FOUND.")

# 2. Demographics & Urbanization Loop
# Replace from `let harvestWorkers = Math.floor(lawfulWorkers * 0.8);`
# down to `if (capacity > 0) {` inside crafting
demographics_pattern = re.compile(r"""let harvestWorkers = Math\.floor\(lawfulWorkers \* 0\.8\);\s*let urbanWorkers = lawfulWorkers - harvestWorkers;.*?(?=\/\/ T2 Refining)""", re.DOTALL)
if not demographics_pattern.search(c):
    # Oh wait, my last replacement had // Priority 4: Crafting but didn't have // T2 Refining.
    # Let me just replace the entire logic from 80/20 to Priority 4
    demographics_pattern = re.compile(r"""let harvestWorkers = Math\.floor\(lawfulWorkers \* 0\.8\);\s*let urbanWorkers = lawfulWorkers - harvestWorkers;.*?(?=\/\/ Priority 4: Crafting)""", re.DOTALL)

demographics_replacement = """const uTier = burg.urban_tier || 1;
            let harvestRatio = 0.90;
            if (uTier === 2) harvestRatio = 0.80;
            else if (uTier === 3) harvestRatio = 0.70;
            else if (uTier >= 4) harvestRatio = 0.60;
            
            let harvestWorkers = Math.floor(lawfulWorkers * harvestRatio);
            let urbanWorkers = lawfulWorkers - harvestWorkers;

            // --- FRINGE OPERATORS (Shadow Economy) ---
            if (fringeWorkers > 0) {
                addItem('narcotic', Math.floor(fringeWorkers * 0.5));
                addItem('poison', Math.floor(fringeWorkers * 0.2));
                currentWealth = Math.max(0, currentWealth - fringeWorkers); // stolen taxes
            }

            // --- HARVESTING (Flora/Fauna & Quantitative Ecology) ---
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

            // --- URBAN CORE ---
            
            // Priority 0: Urbanization Upgrade
            // Thresholds: T1->T2 (1800 pop), T2->T3 (4500 pop), T3->T4 (9000 pop)
            const popThreshold = uTier === 1 ? 1800 : uTier === 2 ? 4500 : uTier === 3 ? 9000 : 999999;
            if (popSize >= popThreshold) {
                const getBest = (mats: string[], req: number) => {
                    let best: string | null = null; let max = -1;
                    for (const m of mats) {
                        let amt = 0;
                        if (['wood', 'stone', 'clay'].includes(m)) amt = m === 'wood' ? stockpile.raw_wood : m === 'stone' ? stockpile.raw_ore : stockpile.raw_fiber; // fallback check
                        amt = Math.max(amt, inv[m] || 0); // use complex inv
                        if (amt >= req && amt > max) { best = m; max = amt; }
                    }
                    return best;
                };

                const deductMat = (m: string, amt: number) => {
                    if (inv[m] >= amt) { inv[m] -= amt; return; }
                    if (m === 'wood') stockpile.raw_wood -= amt;
                    if (m === 'stone') stockpile.raw_ore -= amt;
                };

                const t1 = ['wood', 'stone', 'clay'];
                const t2 = ['refined_lumber', 'cut_stone', 'bricks'];
                const t3 = ['treated_lumber', 'masonry', 'ceramics'];

                if (uTier === 1 && currentWealth >= 100) {
                    const b1 = getBest(t1, 100); const b2 = getBest(t2, 50);
                    if (b1 && b2) {
                        deductMat(b1, 100); deductMat(b2, 50); currentWealth -= 100;
                        burg.urban_tier = 2; burg.architecture_type = b1.toUpperCase();
                    }
                } else if (uTier === 2 && currentWealth >= 200) {
                    const b2 = getBest(t2, 200); const b3 = getBest(t3, 50);
                    if (b2 && b3) {
                        deductMat(b2, 200); deductMat(b3, 50); currentWealth -= 200;
                        burg.urban_tier = 3; burg.architecture_type = b2 === 'refined_lumber' ? 'WOOD' : b2 === 'cut_stone' ? 'STONE' : 'CLAY';
                    }
                } else if (uTier === 3 && currentWealth >= 500) {
                    const b3 = getBest(t3, 300); const lux = inv['luxury'] || 0;
                    if (b3 && lux >= 100) {
                        deductMat(b3, 300); inv['luxury'] -= 100; currentWealth -= 500;
                        burg.urban_tier = 4;
                    }
                }
            }

            // Priority 1: Maintenance
            let totalInfraLevels = 0;
            for (const lvl of bInfraLevels.values()) totalInfraLevels += lvl;
            const requiredMaint = Math.ceil(totalInfraLevels / 10);
            
            const maintWorkers = Math.min(urbanWorkers, requiredMaint);
            urbanWorkers -= maintWorkers;
            
            if (maintWorkers < requiredMaint && totalInfraLevels > 0) {
                const builtTypes = Array.from(bInfraLevels.keys()).filter(k => bInfraLevels.get(k)! > 0);
                if (builtTypes.length > 0) {
                    const decayType = builtTypes[Math.floor(Math.random() * builtTypes.length)] as string;
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
            if ((inv['luxury'] || 0) > 0) { inv['luxury']--; civicBonus += 2; currentWealth += 10; }
            
            burg.unrest = Math.max(0, burg.unrest - (civicWorkers * civicBonus));
            burg.crime_rate = Math.max(0, (burg.crime_rate || 0) - Math.floor(civicWorkers * 0.2));

            // Priority 3: Military
            const militaryWorkers = Math.floor(urbanWorkers * 0.5);
            urbanWorkers -= militaryWorkers;
            
            military_forces['footmen'] = (military_forces['footmen'] || 0) + (militaryWorkers * 10);
            if (militaryWorkers > 0) {
                let fed = false;
                if ((inv['rations'] || 0) >= militaryWorkers) {
                    inv['rations'] -= militaryWorkers; fed = true;
                } else {
                    const foodCost = militaryWorkers * 2;
                    if (burg.food >= foodCost) { burg.food -= foodCost; fed = true; }
                }
                if (!fed) burg.unrest += 5;
            }

            """

if demographics_pattern.search(c):
    c = demographics_pattern.sub(demographics_replacement, c, 1)
    print("Demographics & Urbanization patch applied.")
else:
    print("Demographics & Urbanization patch NOT FOUND.")


# 3. Crafting Loop Update
crafting_pattern = re.compile(r"""\/\/ Priority 4: Crafting.*?(?=\/\/ L-7: Stockpile decay)""", re.DOTALL)

crafting_replacement = """// Priority 4: Crafting
            const craftingWorkers = urbanWorkers;
            if (craftingWorkers > 0) {
                let capacity = craftingWorkers * 5;
                
                const refine = (inputs: {res: string, amt: number}[], output: string, outAmt: number = 1) => {
                    if (capacity <= 0) return;
                    // check if we have enough inputs
                    let maxCrafts = capacity;
                    for (const inp of inputs) {
                        let avail = inv[inp.res] || 0;
                        if (['wood', 'stone', 'ore', 'fibre'].includes(inp.res)) {
                           if (inp.res === 'wood') avail = Math.max(avail, stockpile.raw_wood);
                           if (inp.res === 'stone' || inp.res === 'ore') avail = Math.max(avail, stockpile.raw_ore);
                        }
                        const possible = Math.floor(avail / inp.amt);
                        if (possible < maxCrafts) maxCrafts = possible;
                    }
                    if (maxCrafts > 0) {
                        for (const inp of inputs) {
                            let deduct = maxCrafts * inp.amt;
                            if (inv[inp.res] >= deduct) { inv[inp.res] -= deduct; }
                            else {
                                if (inp.res === 'wood') stockpile.raw_wood -= deduct;
                                if (inp.res === 'stone' || inp.res === 'ore') stockpile.raw_ore -= deduct;
                            }
                        }
                        inv[output] = (inv[output] || 0) + (maxCrafts * outAmt);
                        capacity -= maxCrafts;
                    }
                };

                // Tier 2 Refining (always available)
                refine([{res:'wood', amt:1}], 'refined_lumber');
                refine([{res:'stone', amt:1}], 'cut_stone');
                refine([{res:'clay', amt:1}], 'bricks');
                refine([{res:'fibre', amt:1}], 'textile');
                refine([{res:'wool', amt:1}], 'textile');
                refine([{res:'meat', amt:1}, {res:'lard', amt:1}], 'rations', 2);
                
                // Tier 3 Refining (uTier >= 3)
                if (uTier >= 3) {
                    refine([{res:'ore', amt:1}, {res:'wood', amt:1}], 'steel');
                    refine([{res:'refined_lumber', amt:1}, {res:'pitch', amt:1}], 'treated_lumber');
                    refine([{res:'cut_stone', amt:1}, {res:'adhesive', amt:1}], 'masonry');
                    refine([{res:'bricks', amt:1}, {res:'reagents', amt:1}], 'ceramics');
                    refine([{res:'steel', amt:1}, {res:'leather', amt:1}], 'munitions');
                }

                // Tier 4 Refining (uTier >= 4)
                if (uTier >= 4) {
                    refine([{res:'herbs', amt:1}, {res:'reagents', amt:1}], 'medicine');
                    refine([{res:'poison', amt:1}, {res:'reagents', amt:1}], 'medicine');
                    refine([{res:'gems', amt:1}, {res:'ivory', amt:1}], 'luxury');
                    refine([{res:'crystals', amt:1}, {res:'ivory', amt:1}], 'luxury');
                }
            }

            """

if crafting_pattern.search(c):
    c = crafting_pattern.sub(crafting_replacement, c, 1)
    print("Crafting patch applied.")
else:
    print("Crafting patch NOT FOUND.")


with open('src/engine/masterOrchestrator.ts', 'w', encoding='utf-8') as f:
    f.write(c)
