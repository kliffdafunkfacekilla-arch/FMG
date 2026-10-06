import re

with open('src/engine/masterOrchestrator.ts', 'r', encoding='utf-8') as f:
    c = f.read()

# 1. Inject Faction Threat Calculation
threat_pattern = re.compile(r"""(const fStance = factionStances\.get\(faction\.id\) \|\| \{ stance: "BALANCED", aggression: 5, economy: 5, magic: 5 \};)""")

threat_replacement = r"""\1

        // Calculate Geopolitical Threat (0-100)
        let factionThreat = 10; // Base standing reserve
        let traitMult = 1.0;
        const leader = paragonsArr.find(p => p.faction_id === faction.id && p.type === 'LEADER');
        if (leader && leader.traits) {
            if (leader.traits.includes('Paranoid')) traitMult = 1.5;
            if (leader.traits.includes('Naive') || leader.traits.includes('Pacifist')) traitMult = 0.5;
            if (leader.traits.includes('Bloodthirsty') || leader.traits.includes('Tactician')) factionThreat += 20;
        }
        
        let maxTension = 0;
        for (const d of diploMap.values()) {
            if (d.faction_a_id === faction.id || d.faction_b_id === faction.id) {
                if (d.tension > maxTension) maxTension = d.tension;
            }
        }
        factionThreat += (maxTension * 0.5); // Hostile borders increase threat
        if (fStance.stance === 'EXPANSIONIST') factionThreat += 20;
        
        factionThreat = Math.min(100, factionThreat * traitMult);
"""

if threat_pattern.search(c):
    c = threat_pattern.sub(threat_replacement, c, 1)
    print("Threat Calc patch applied.")
else:
    print("Threat Calc patch NOT FOUND.")


# 2. Replace Priority 3: Military block
mil_pattern = re.compile(r"""(\/\/ Priority 3: Military\s*const militaryWorkers = Math\.floor\(urbanWorkers \* 0\.5\);\s*urbanWorkers -= militaryWorkers;.*?)(?=\/\/ Priority 4: Crafting)""", re.DOTALL)

mil_replacement = r"""// Priority 3: Military & Security Baseline
            const requiredGuards = Math.ceil(popSize / 100);
            const currentFootmen = military_forces['footmen'] || 0;
            const isInsecure = burg.unrest > 20 || (burg.crime_rate || 0) > 20;
            const localDeficit = requiredGuards - currentFootmen;

            let draftRatio = (factionThreat / 100) * 0.8; // Draft up to 80% of remaining urban workforce
            if (localDeficit > 0 || isInsecure) draftRatio = Math.max(draftRatio, 0.5); // Panic draft if insecure
            
            const militaryWorkers = Math.floor(urbanWorkers * draftRatio);
            urbanWorkers -= militaryWorkers;
            
            if (militaryWorkers > 0) {
                let fed = false;
                if ((inv['rations'] || 0) >= militaryWorkers) {
                    inv['rations'] -= militaryWorkers; fed = true;
                } else {
                    const foodCost = militaryWorkers * 2;
                    if (burg.food >= foodCost) { burg.food -= foodCost; fed = true; }
                }
                
                if (!fed) {
                    burg.unrest += 5; // Unpaid/starving soldiers
                } else {
                    let capacity = militaryWorkers * 5;
                    
                    // Local Security First
                    if (localDeficit > 0 || isInsecure) {
                        const recruits = Math.min(capacity, Math.max(0, localDeficit));
                        military_forces['footmen'] = (military_forces['footmen'] || 0) + recruits;
                        capacity -= recruits;
                    }
                    
                    // Advanced Army if Threat is High
                    if (capacity > 0 && factionThreat >= 30 && (inv['munitions'] || 0) >= capacity) {
                        inv['munitions'] -= capacity;
                        military_forces['marksmen'] = (military_forces['marksmen'] || 0) + capacity;
                        capacity = 0;
                    } else if (capacity > 0) {
                        // Standing reserve militia
                        military_forces['footmen'] = (military_forces['footmen'] || 0) + capacity;
                    }
                }
            }

            """

if mil_pattern.search(c):
    c = mil_pattern.sub(mil_replacement, c, 1)
    print("Military Logic patch applied.")
else:
    print("Military Logic patch NOT FOUND.")

with open('src/engine/masterOrchestrator.ts', 'w', encoding='utf-8') as f:
    f.write(c)
