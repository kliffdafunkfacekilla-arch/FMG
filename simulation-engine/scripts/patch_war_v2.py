import re

with open('src/engine/masterOrchestrator.ts', 'r', encoding='utf-8') as f:
    c = f.read()

commit_pattern = re.compile(r"""(\s+// 6\. COMMIT\s+await client\.query\('COMMIT'\);\s+return \{ status: 'success', currentTick: tick \};\s+\} catch \(e\))""", re.DOTALL)

war_logic = r"""
    // 6. WAR & CONQUEST (The Clash)
    const warPairs = Array.from(diploMap.values()).filter(d => d.status === 'WAR');
    if (warPairs.length > 0) {
        // Fetch all military forces to process global battles
        const milRes = await client.query('SELECT burg_id, faction_id, military_forces FROM sim_burg_economy');
        const factionForces = new Map<number, {burgs: any[], totalPower: number, troops: Record<string, number>}>();
        
        // Aggregate forces and calculate combat power
        for (const row of milRes.rows) {
            if (!row.faction_id) continue;
            let forces: Record<string, number> = {};
            try { forces = JSON.parse(row.military_forces || '{}'); } catch(e){}
            
            if (!factionForces.has(row.faction_id)) {
                factionForces.set(row.faction_id, { burgs: [], totalPower: 0, troops: {} });
            }
            const fData = factionForces.get(row.faction_id)!;
            fData.burgs.push(row);
            
            for (const [unit, count] of Object.entries(forces)) {
                fData.troops[unit] = (fData.troops[unit] || 0) + count;
                let pwr = count;
                // Advanced Unit Modifiers
                if (unit === 'marksmen' || unit === 'thorn_men') pwr *= 1.5;
                if (unit === 'cavalry' || unit === 'shadowpaws') pwr *= 2;
                if (unit === 'sparksquads') pwr *= 5;
                if (unit === 'skymen') pwr *= 10;
                fData.totalPower += pwr;
            }
        }

        // Resolve border clashes
        for (const war of warPairs) {
            if (Math.random() > 0.2) continue; // 20% chance per tick for a major battle to erupt

            const fA = factionForces.get(war.faction_a_id);
            const fB = factionForces.get(war.faction_b_id);
            if (!fA || !fB || fA.totalPower < 100 || fB.totalPower < 100) continue; // Skirmishes too small to log

            const factionAObj = factions.find((f: any) => f.id === war.faction_a_id);
            const factionBObj = factions.find((f: any) => f.id === war.faction_b_id);
            const nameA = factionAObj ? factionAObj.name : 'Unknown Faction';
            const nameB = factionBObj ? factionBObj.name : 'Unknown Faction';

            let pA = fA.totalPower; 
            let pB = fB.totalPower;

            // Battle Roll (Power * RNG)
            const rollA = pA * (0.5 + Math.random());
            const rollB = pB * (0.5 + Math.random());

            const winnerId = rollA > rollB ? war.faction_a_id : war.faction_b_id;
            const loserId  = rollA > rollB ? war.faction_b_id : war.faction_a_id;
            const wName    = rollA > rollB ? nameA : nameB;
            const lName    = rollA > rollB ? nameB : nameA;
            
            const winnerData = rollA > rollB ? fA : fB;
            const loserData  = rollA > rollB ? fB : fA;

            const winCas = 0.05; // Winner takes 5% casualties
            const loseCas = 0.20; // Loser takes 20% casualties

            // Apply casualties across the faction's territory
            const applyCasualties = async (fData: any, casRate: number) => {
                for (const burg of fData.burgs) {
                    let forces: Record<string, number> = {};
                    try { forces = JSON.parse(burg.military_forces || '{}'); } catch(e){}
                    let changed = false;
                    for (const unit of Object.keys(forces)) {
                        const lost = Math.floor(forces[unit] * casRate);
                        if (lost > 0) {
                            forces[unit] -= lost;
                            changed = true;
                        }
                    }
                    if (changed) {
                        await client.query('UPDATE sim_burg_economy SET military_forces = $1 WHERE burg_id = $2', [JSON.stringify(forces), burg.burg_id]);
                    }
                }
            };

            await applyCasualties(winnerData, winCas);
            await applyCasualties(loserData, loseCas);

            // Global Event Broadcast
            const msg = `Major Border Clash! The ${wName} decisively routed the ${lName} forces. The losers suffered heavy casualties.`;
            await client.query(`INSERT INTO sim_events (tick, type, message, tier, faction_id, lore_date) VALUES ($1, 'BATTLE_REPORT', $2, 'MAJOR', $3, $4)`, [tick, msg, winnerId, loreDate]);
            
            // Add unrest to the loser's burgs
            await client.query(`UPDATE sim_burg_economy SET unrest = LEAST(100, COALESCE(unrest,0) + 10) WHERE faction_id = $1`, [loserId]);
        }
    }
\1"""

if commit_pattern.search(c):
    c = commit_pattern.sub(war_logic, c, 1)
    print("War logic patch applied.")
else:
    print("War logic patch NOT FOUND.")

with open('src/engine/masterOrchestrator.ts', 'w', encoding='utf-8') as f:
    f.write(c)
