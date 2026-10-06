import re

with open('src/engine/masterOrchestrator.ts', 'r', encoding='utf-8') as f:
    c = f.read()

# 1. Inject the War trigger
war_pattern = re.compile(r"""(await applyCasualties\(loserData, loseCas\);)""")
war_replacement = r"""\1

                // TRIGGER OCCUPATION
                if (loserData.burgs.length > 0) {
                    const targetBurg = loserData.burgs[Math.floor(Math.random() * loserData.burgs.length)];
                    let forces: Record<string, number> = {};
                    try { forces = JSON.parse(targetBurg.military_forces || '{}'); } catch(e){}
                    forces['footmen'] = 500; 
                    
                    await client.query(`
                        UPDATE sim_burg_economy 
                        SET occupier_faction_id = $1, occupation_ticks = 0, resistance_strength = 50, military_forces = $2 
                        WHERE burg_id = $3
                    `, [winnerId, JSON.stringify(forces), targetBurg.burg_id]);

                    const occMsg = `Following their victory, ${wName} forces have occupied a border city. The citizens are resisting.`;
                    await client.query(`INSERT INTO sim_events (tick, type, message, tier, faction_id, lore_date) VALUES ($1, 'OCCUPATION_STARTED', $2, 'MINOR', $3, $4)`, [tick, occMsg, winnerId, loreDate]);
                }
"""

if war_pattern.search(c):
    c = war_pattern.sub(war_replacement, c, 1)
    print("War trigger patch applied.")
else:
    print("War trigger patch NOT FOUND.")


# 2. Inject the Occupation Loop wrapper
urb_pattern = re.compile(r"""(\/\/ Priority 0: Urbanization Upgrade.*?if \(uTier >= 4\) \{.*?\}\s*\})""", re.DOTALL)

def urb_replacer(match):
    original_block = match.group(1)
    
    # We indent the original block and wrap it
    wrapped = """            if (!burg.occupier_faction_id) {
""" + "\n".join(["    " + line for line in original_block.split("\n")]) + """
            } else {
                // THE OCCUPATION LOOP
                burg.occupation_ticks = (burg.occupation_ticks || 0) + 1;
                
                // Smugglers Arming Citizens
                if ((burg.crime_rate || 0) > 20 && (inv['munitions'] || 0) >= 10) {
                    inv['munitions'] -= 10;
                    burg.resistance_strength = (burg.resistance_strength || 50) + 25;
                }

                // Suppression Tactic
                const occLeader = paragonsArr.find(p => p.faction_id === burg.occupier_faction_id && p.type === 'LEADER');
                const isBrutal = occLeader && occLeader.traits && (occLeader.traits.includes('Bloodthirsty') || occLeader.traits.includes('Paranoid'));
                
                if (isBrutal) {
                    // Mass Executions
                    burg.pop_null = Math.max(0, (burg.pop_null || 0) - 50);
                    burg.resistance_strength = Math.max(0, (burg.resistance_strength || 50) - 15);
                    if (Math.random() < 0.1) {
                        await client.query(`INSERT INTO sim_events (tick, type, message, tier, burg_id, lore_date) VALUES ($1, 'MASS_EXECUTION', 'Occupying forces executed dissidents in a brutal crackdown.', 'MINOR', $2, $3)`, [tick, burg.burg_id, loreDate]);
                    }
                } else {
                    // Hearts and Minds
                    if ((inv['rations'] || 0) >= 50) {
                        inv['rations'] -= 50;
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
                    await client.query(`UPDATE sim_cells SET faction_id = NULL WHERE id = $1`, [burg.cell_id]);
                    burg.occupier_faction_id = null;
                    burg.occupation_ticks = 0;
                    burg.resistance_strength = 0;
                    military_forces['footmen'] = 100; // Rebel militia
                    await client.query(`INSERT INTO sim_events (tick, type, message, tier, burg_id, lore_date) VALUES ($1, 'LIBERATION', 'Citizens successfully expelled the occupying forces and declared independence!', 'MINOR', $2, $3)`, [tick, burg.burg_id, loreDate]);
                } else if ((burg.occupation_ticks || 0) >= 28) {
                    // Conquest complete
                    await client.query(`UPDATE sim_cells SET faction_id = $1 WHERE id = $2`, [burg.occupier_faction_id, burg.cell_id]);
                    await client.query(`INSERT INTO sim_events (tick, type, message, tier, burg_id, lore_date) VALUES ($1, 'CONQUEST', 'Occupying forces have fully pacified the city. It has been annexed.', 'MINOR', $2, $3)`, [tick, burg.burg_id, loreDate]);
                    burg.occupier_faction_id = null;
                    burg.occupation_ticks = 0;
                    burg.resistance_strength = 0;
                }
                
                // Save immediately because the main loop doesn't save occupier columns
                if (burg.occupier_faction_id) {
                    await client.query(`UPDATE sim_burg_economy SET occupier_faction_id = $1, occupation_ticks = $2, resistance_strength = $3, pop_null = $4 WHERE burg_id = $5`, [burg.occupier_faction_id, burg.occupation_ticks, burg.resistance_strength, burg.pop_null, burg.burg_id]);
                } else {
                    await client.query(`UPDATE sim_burg_economy SET occupier_faction_id = NULL, occupation_ticks = 0, resistance_strength = 0, pop_null = $1 WHERE burg_id = $2`, [burg.pop_null, burg.burg_id]);
                }
            }"""
    return wrapped

if urb_pattern.search(c):
    c = urb_pattern.sub(urb_replacer, c, 1)
    print("Occupation loop patch applied.")
else:
    print("Occupation loop patch NOT FOUND.")

with open('src/engine/masterOrchestrator.ts', 'w', encoding='utf-8') as f:
    f.write(c)

