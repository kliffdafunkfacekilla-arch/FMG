import re

with open('src/engine/masterOrchestrator.ts', 'r', encoding='utf-8') as f:
    c = f.read()

# Pattern bounds: from // --- URBAN CORE --- down to // L-7: Stockpile decay
pattern = re.compile(r'(\/\/ --- URBAN CORE ---.*?)(?=\/\/ L-7: Stockpile decay)', re.DOTALL)

def replacer(match):
    original_block = match.group(1)
    
    # We indent the original block and wrap it
    wrapped = "            if (!burg.occupier_faction_id) {\n" + "\n".join(["    " + line for line in original_block.split("\n")]) + """
            } else {
                // THE OCCUPATION LOOP
                burg.occupation_ticks = (burg.occupation_ticks || 0) + 1;
                
                // Smugglers Arming Citizens
                if ((burg.crime_rate || 0) > 20 && (inv['narcotic'] || 0) >= 10) {
                    inv['narcotic'] -= 10;
                    burg.resistance_strength = (burg.resistance_strength || 50) + 25;
                }

                // Suppression Tactic
                const occLeader = localParagons.find((p: any) => p.faction_id === burg.occupier_faction_id && ["Mayor","Foreman","Baron"].includes(p.title));
                const isBrutal = occLeader && occLeader.traits && (occLeader.traits.includes('Bloodthirsty') || occLeader.traits.includes('Paranoid'));
                
                if (isBrutal) {
                    // Mass Executions
                    burg.pop_null = Math.max(0, (burg.pop_null || 0) - 50);
                    burg.resistance_strength = Math.max(0, (burg.resistance_strength || 50) - 15);
                    if (Math.random() < 0.1) {
                        await client.query(INSERT INTO sim_events (tick, type, message, tier, burg_id, lore_date) VALUES (, 'MASS_EXECUTION', 'Occupying forces executed dissidents in a brutal crackdown.', 'MINOR', , ), [tick, bId, loreDate]);
                    }
                } else {
                    // Hearts and Minds
                    if ((inv['grain'] || 0) >= 50) {
                        inv['grain'] -= 50;
                        burg.resistance_strength = Math.max(0, (burg.resistance_strength || 50) - 20);
                    } else {
                        burg.resistance_strength = (burg.resistance_strength || 50) + 10;
                    }
                }

                // The Daily Riot
                const resPwr = burg.resistance_strength || 50;
                let curForces = military_forces['footmen'] || 0;
                
                const riotRoll = Math.random() * resPwr;
                const milRoll = Math.random() * curForces;

                burg.pop_null = Math.max(0, (burg.pop_null || 0) - Math.floor(resPwr * 0.1));
                military_forces['footmen'] = Math.max(0, curForces - Math.floor(resPwr * 0.2));

                // Resolution
                if ((military_forces['footmen'] || 0) <= 0) {
                    // Independence / Liberation
                    await client.query(UPDATE sim_cells SET faction_id = NULL WHERE id = , [burg.cell_id]);
                    burg.occupier_faction_id = null;
                    burg.occupation_ticks = 0;
                    burg.resistance_strength = 0;
                    military_forces['footmen'] = 100; // Rebel militia
                    await client.query(INSERT INTO sim_events (tick, type, message, tier, burg_id, lore_date) VALUES (, 'LIBERATION', 'Citizens successfully expelled the occupying forces and declared independence!', 'MINOR', , ), [tick, bId, loreDate]);
                } else if ((burg.occupation_ticks || 0) >= 28) {
                    // Conquest complete
                    await client.query(UPDATE sim_cells SET faction_id =  WHERE id = , [burg.occupier_faction_id, burg.cell_id]);
                    await client.query(INSERT INTO sim_events (tick, type, message, tier, burg_id, lore_date) VALUES (, 'CONQUEST', 'Occupying forces have fully pacified the city. It has been annexed.', 'MINOR', , ), [tick, bId, loreDate]);
                    burg.occupier_faction_id = null;
                    burg.occupation_ticks = 0;
                    burg.resistance_strength = 0;
                }
            }
"""
    return wrapped

if pattern.search(c):
    c = pattern.sub(replacer, c, 1)
    print("Occupation loop patch applied.")
else:
    print("Occupation loop patch NOT FOUND.")

with open('src/engine/masterOrchestrator.ts', 'w', encoding='utf-8') as f:
    f.write(c)

