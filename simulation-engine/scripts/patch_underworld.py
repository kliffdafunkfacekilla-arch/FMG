import re

with open('src/engine/masterOrchestrator.ts', 'r', encoding='utf-8') as f:
    c = f.read()

# Pattern to capture everything from outlawFactionsRes to the call to processFringeFactions
# Note: we also want to keep Cosmic War (wardens vs cultists) if possible, but it's mixed in.
# Let's just do a string replacement on the exact blocks.

start_marker = "const outlawFactionsRes = await client.query('SELECT * FROM sim_outlaw_factions');"
end_marker = "await processFringeFactions(client, tick, loreDate, paragonsArr, allBurgs);"

if start_marker in c and end_marker in c:
    start_idx = c.index(start_marker)
    end_idx = c.index(end_marker) + len(end_marker)
    
    # We need to preserve the Cosmic War block which is inside this range.
    cosmic_war_start = c.index("// Cosmic War")
    cosmic_war_end = c.index("// Fringe faction raids")
    cosmic_war_code = c[cosmic_war_start:cosmic_war_end]
    
    underworld_logic = """
    // 5. THE UNDERWORLD LOOP (Fringe Lairs & Cartels)
    const fringeRes = await client.query('SELECT * FROM sim_fringe_factions');
    const fringes = fringeRes.rows;
    const lairsRes = await client.query('SELECT * FROM sim_fringe_lairs');
    const lairs = lairsRes.rows;

    for (const fringe of fringes) {
        // A. Recruitment & Upkeep
        const recruitBurgs = allBurgs.filter((b: any) => (b.unrest || 0) > 40 || (b.crime_rate || 0) > 30);
        let recruits = 0;
        for (const rb of recruitBurgs) {
            if (Math.random() > 0.5 && rb.pop_null > 10) {
                const draft = 10;
                rb.pop_null -= draft;
                recruits += draft;
                await client.query(`UPDATE sim_burg_economy SET pop_null = $1 WHERE burg_id = $2`, [rb.pop_null, rb.burg_id]);
            }
        }
        
        let newManpower = (fringe.manpower || 0) + recruits;
        let newWealth = fringe.wealth || 0;
        
        // Upkeep (1 wealth per 10 manpower)
        const upkeep = Math.floor(newManpower / 10);
        if (newWealth >= upkeep) {
            newWealth -= upkeep;
        } else {
            newManpower = Math.floor(newManpower * 0.8); // 20% desertion if broke
        }
        
        // B. Establish Footprint
        // If they have excess manpower (>200) and wealth (>200), establish a new Lair
        if (newManpower > 200 && newWealth > 200) {
            const target = allBurgs[Math.floor(Math.random() * allBurgs.length)];
            const lType = Math.random() > 0.5 ? 'VICE_DEN' : 'BLACK_MARKET';
            newManpower -= 100;
            newWealth -= 200;
            await client.query(`INSERT INTO sim_fringe_lairs (fringe_id, cell_id, burg_id, lair_type, manpower, heat) VALUES ($1, $2, $3, $4, $5, 0)`, [fringe.id, target.cell_id, target.burg_id, lType, 100]);
        }
        
        await client.query(`UPDATE sim_fringe_factions SET manpower = $1, wealth = $2 WHERE id = $3`, [newManpower, newWealth, fringe.id]);
    }

    // Process Lairs (Operations, Turf Wars, Busts)
    const lairsByBurg = new Map<number, any[]>();
    for (const lair of lairs) {
        if (!lair.burg_id) continue;
        if (!lairsByBurg.has(lair.burg_id)) lairsByBurg.set(lair.burg_id, []);
        lairsByBurg.get(lair.burg_id)!.push(lair);
    }

    for (const [burgId, localLairs] of lairsByBurg.entries()) {
        const burg = allBurgs.find((b: any) => b.burg_id === burgId);
        if (!burg) continue;
        
        let military: any = {};
        try { military = JSON.parse(burg.military_forces || '{}'); } catch(e){}
        const milPower = (military['footmen'] || 0) + ((military['marksmen'] || 0) * 1.5);
        
        for (const lair of localLairs) {
            // C. Operations
            lair.heat = (lair.heat || 0) + 5;
            let profit = 0;
            if (lair.lair_type === 'VICE_DEN') {
                const inv = burgInventories.get(burgId) || {};
                if ((inv['narcotic'] || 0) >= 5) {
                    inv['narcotic'] -= 5;
                    profit = 50;
                    burg.unrest = Math.max(0, (burg.unrest || 0) - 10); // Drugs placate the masses
                    burg.crime_rate = (burg.crime_rate || 0) + 5;
                    await client.query(`UPDATE sim_industrial_stockpiles SET complex_inventory = $1 WHERE burg_id = $2`, [JSON.stringify(inv), burgId]);
                }
            } else if (lair.lair_type === 'BLACK_MARKET') {
                profit = 30;
                burg.crime_rate = (burg.crime_rate || 0) + 10;
            }
            
            if (profit > 0) {
                await client.query(`UPDATE sim_fringe_factions SET wealth = wealth + $1 WHERE id = $2`, [profit, lair.fringe_id]);
                await client.query(`UPDATE sim_burg_economy SET crime_rate = $1, unrest = $2 WHERE burg_id = $3`, [burg.crime_rate, burg.unrest, burgId]);
            }
            
            // D. Turf Wars
            const rivals = localLairs.filter((l: any) => l.id !== lair.id && l.lair_type === lair.lair_type);
            if (rivals.length > 0) {
                const rival = rivals[0];
                lair.heat += 20; rival.heat += 20; // Bloody gang war raises heat!
                if (Math.random() > 0.5) {
                    lair.manpower -= 20;
                    rival.manpower -= 40;
                } else {
                    lair.manpower -= 40;
                    rival.manpower -= 20;
                }
            }

            // E. The Bust
            if (lair.heat > milPower) {
                // Military launches raid
                if (milPower > lair.manpower) {
                    await client.query(`DELETE FROM sim_fringe_lairs WHERE id = $1`, [lair.id]);
                    await client.query(`INSERT INTO sim_events (tick, type, message, tier, burg_id, lore_date) VALUES ($1, 'LAIR_BUSTED', 'City militia successfully raided and destroyed a major underworld lair.', 'MINOR', $2, $3)`, [tick, burgId, loreDate]);
                    continue; 
                } else {
                    // Militia beaten back
                    lair.heat = 0; // Go into hiding
                    await client.query(`INSERT INTO sim_events (tick, type, message, tier, burg_id, lore_date) VALUES ($1, 'MILITIA_DEFEATED', 'Underworld syndicates violently repelled a city militia raid.', 'MINOR', $2, $3)`, [tick, burgId, loreDate]);
                }
            }

            // F. Lair Upkeep/Save
            if (lair.manpower <= 0) {
                await client.query(`DELETE FROM sim_fringe_lairs WHERE id = $1`, [lair.id]);
            } else {
                await client.query(`UPDATE sim_fringe_lairs SET manpower = $1, heat = $2 WHERE id = $3`, [lair.manpower, lair.heat, lair.id]);
            }
        }
    }
"""

    # We need to keep some of the declarations at the top of the block before deleting
    top_declarations = """
    // Agents / Grooves
    const agentsRes = await client.query(`
        SELECT a.*, c.center_x AS loc_x, c.center_y AS loc_y
        FROM sim_agents a
        LEFT JOIN sim_cells c ON a.location_cell_id = c.id
        WHERE a.role IN ('Warden', 'Cultist')
    `);
    const wardens = agentsRes.rows.filter((a: any) => a.role === "Warden");
    const cultists = agentsRes.rows.filter((a: any) => a.role === "Cultist");
"""
    
    new_c = c[:start_idx] + top_declarations + underworld_logic + "\n" + cosmic_war_code + c[end_idx:]
    
    with open('src/engine/masterOrchestrator.ts', 'w', encoding='utf-8') as f:
        f.write(new_c)
    print("Underworld Loop patched successfully.")
else:
    print("Markers not found!")
