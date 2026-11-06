import { resolveCombat } from '../combatEngine';
import { FACTION_ACTIONS, FactionState, FactionAction } from '../ai/factionActions';
import { tagBurgCitizens } from "./citizenPersonaHelper";

/**
 * Extracts uppercase trait strings from a paragon's traits column
 */
function getTraitsList(p: any): string[] {
    const list: string[] = [];
    if (!p || !p.traits) return list;
    try {
        const parsed = typeof p.traits === 'string' ? JSON.parse(p.traits) : p.traits;
        if (Array.isArray(parsed)) {
            for (const item of parsed) {
                if (typeof item === 'string') list.push(item.toUpperCase());
                else if (item && item.name) list.push(String(item.name).toUpperCase());
            }
        }
    } catch (e) {}
    return list;
}

export async function runFactionPlanningAgent(client: any, tick: number, loreDate: string) {
    const factionRes = await client.query("SELECT * FROM sim_factions");
    const burgRes = await client.query(`
        SELECT b.burg_id, b.pop_null, c.faction_id, b.unrest, b.crime_rate, b.food, b.health, 
               b.military_forces, b.wealth, c.id as cell_id 
        FROM sim_burg_economy b 
        JOIN sim_cells c ON b.cell_id = c.id 
        WHERE c.faction_id IS NOT NULL
    `);
    const unitRes = await client.query("SELECT * FROM sim_faction_units");
    const paragonRes = await client.query("SELECT * FROM sim_paragons WHERE faction_id IS NOT NULL");
    const diploRes = await client.query("SELECT * FROM sim_diplomacy");
    const bordersRes = await client.query("SELECT * FROM sim_faction_borders");

    // Fetch environmental / sector tags across cells
    const sectorTagsRes = await client.query(`
        SELECT cell_id, features->'environmental_tags' as env_tags 
        FROM sim_sector_layers 
        WHERE z_layer = 0 AND features->'environmental_tags' IS NOT NULL
    `);
    const sectorTagsMap = new Map<number, string[]>();
    for (const r of sectorTagsRes.rows) {
        if (Array.isArray(r.env_tags)) {
            sectorTagsMap.set(Number(r.cell_id), r.env_tags);
        }
    }

    const factions = factionRes.rows;
    const burgs = burgRes.rows;
    const units = unitRes.rows;
    const paragons = paragonRes.rows;
    const borders = bordersRes.rows;
    const diplomacy = diploRes.rows;

    const events: any[] = [];
    const WAGES: any = { 'INFANTRY': 100, 'RANGED': 200, 'MOUNTED': 300, 'AIRSHIP': 400, 'MAGE': 1500 };
    const factionStates = new Map<number, FactionState>();

    // --- PHASE 1: BUILD FACTION STATES ---
    for (const f of factions) {
        const myBurgs = burgs.filter((b: any) => b.faction_id === f.id);
        const myUnits = units.filter((u: any) => u.faction_id === f.id);
        
        let grossIncome = 0;
        let totalUpkeep = 0;
        let avgUnrest = 0;
        let avgHealth = 0;
        let avgCrime = 0;

        // Collect all active macro tags across the faction's territories
        const macroTagsSet = new Set<string>();
        for (const b of myBurgs) {
            // Balanced provincial taxation: 10-60 gold per burg based on population & urban tier
            grossIncome += Math.floor(12 + Math.min(80, (b.pop_null || 0) * 0.015));
            avgUnrest += b.unrest || 0;
            avgHealth += b.health || 100;
            avgCrime += b.crime_rate || 0;

            const tags = sectorTagsMap.get(Number(b.cell_id)) || [];
            tags.forEach(t => macroTagsSet.add(t));
        }

        if (myBurgs.length > 0) {
            avgUnrest /= myBurgs.length;
            avgHealth /= myBurgs.length;
            avgCrime /= myBurgs.length;
        }

        for (const u of myUnits) {
            totalUpkeep += Math.min(50, WAGES[u.unit_type] ? Math.floor(WAGES[u.unit_type] / 4) : 25);
        }

        // Court & administrative bureaucracy overhead (scales with empire size)
        totalUpkeep += myBurgs.length * 6;

        const netIncome = grossIncome - totalUpkeep;
        let newTreasury = Math.max(0, (Number(f.treasury) || 0) + netIncome);

        // Empire administrative decay (prevents runaway treasury inflation beyond 50k)
        if (newTreasury > 15000) {
            const adminDecay = Math.floor((newTreasury - 15000) * 0.02);
            newTreasury -= adminDecay;
        }

        const myCounselors = paragons.filter((p: any) => p.faction_id === f.id && p.is_counselor);
        let avgSurv = 1.0, avgProt = 1.0;
        if (myCounselors.length > 0) {
            avgSurv = myCounselors.reduce((sum: number, c: any) => sum + (c.survival_mult || 1.0), 0) / myCounselors.length;
            avgProt = myCounselors.reduce((sum: number, c: any) => sum + (c.protection_mult || 1.0), 0) / myCounselors.length;
        }

        // Calculate authentic military combat squads across all garrisons in the faction
        let totalCombatSquads = 0;
        for (const b of myBurgs) {
            let forces: any = {};
            try {
                if (typeof b.military_forces === 'string') forces = JSON.parse(b.military_forces || '{}');
                else if (b.military_forces) forces = b.military_forces;
            } catch(e){}
            for (const count of Object.values(forces)) {
                totalCombatSquads += (Number(count) || 0);
            }
            totalCombatSquads += Math.max(2, Math.floor((b.pop_null || 1000) / 1000));
        }

        let perceivedEconomy = netIncome * avgSurv; 
        let perceivedDefense = Math.max(15, Math.floor(totalCombatSquads * avgProt)); 

        // Identify sovereign ruler
        const leader = paragons.find((p: any) => p.faction_id === f.id && [
            "EMPEROR", "EMPRESS", "HIGH_MATRIARCH", "ARCH-DUKE", "GRAND_CHIEFTAIN", "LORD_PROTECTOR", "HIGH_CHANCELLOR", "WARLORD"
        ].includes(String(p.title || "").toUpperCase())) || paragons.find((p: any) => p.faction_id === f.id && !p.is_counselor);

        const leaderTraits = getTraitsList(leader);
        const leaderName = leader ? leader.name : `Sovereign of ${f.name}`;
        const leaderTitle = leader ? leader.title : "High Sovereign";
        const leaderCorruption = Number(leader?.corruption_score || 0);

        let aggression = f.trait_aggression || 5;
        let economy = f.trait_economy || 5;
        let magic = f.trait_magic || 5;
        
        if (leaderTraits.some(t => t.includes("BLOODTHIRSTY") || t.includes("CONQUEROR") || t.includes("AGGRESSIVE"))) aggression += 4;
        if (leaderTraits.some(t => t.includes("PACIFIST") || t.includes("DIPLOMAT"))) aggression -= 4;
        if (leaderTraits.some(t => t.includes("GREEDY") || t.includes("USURIOUS"))) economy += 4;
        if (leaderTraits.some(t => t.includes("SUPERSTITIOUS") || t.includes("ALCHEMIST"))) magic += 4;
        if (leaderTraits.some(t => t.includes("PARANOID"))) aggression += 2;

        // Valid diplomatic neighbors
        const validNeighbors: number[] = Array.from(new Set<number>(
            borders.filter((b: any) => b.faction_a === f.id || b.faction_b === f.id)
                   .map((b: any) => Number(b.faction_a === f.id ? b.faction_b : b.faction_a))
                   .filter((id: number) => id !== f.id && id > 0)
        ));
        const activeWars = diplomacy.filter((d:any) => d.status === 'WAR' && (d.faction_a_id === f.id || d.faction_b_id === f.id)).map((d:any) => d.faction_a_id === f.id ? d.faction_b_id : d.faction_a_id);

        factionStates.set(f.id, { 
            id: f.id, name: f.name, treasury: newTreasury,
            avgUnrest, avgHealth, avgCrime, aggression, economy, magic, perceivedEconomy, perceivedDefense,
            myBurgs, myUnits, validNeighbors, activeWars,
            leaderName, leaderTitle, leaderTraits, leaderCorruption,
            macroTags: Array.from(macroTagsSet),
            tick, loreDate
        });

        // Update sovereign treasury
        await client.query("UPDATE sim_factions SET treasury = $1 WHERE id = $2", [newTreasury, f.id]);
    }

    // --- PHASE 2: UTILITY AI ACTION EVALUATION WITH PERSONALITY & TAG WEIGHTING ---
    // Staggered Bureaucracy: Each sovereign faction evaluates grand strategy ONCE per month
    // on their own designated day of the 44-day Dragon Month, preventing constant diplomatic flip-flopping.
    for (const f of factions) {
        if ((tick + f.id * 7) % 44 !== 0) continue;

        const state = factionStates.get(f.id);
        if (!state || state.myBurgs.length === 0) continue;

        // Evaluate all sovereign actions
        const scoredActions: { action: FactionAction; score: number; reasoning: string }[] = [];
        for (const action of FACTION_ACTIONS) {
            const evalResult = action.evaluate(state);
            if (evalResult.score > 0) {
                scoredActions.push({ 
                    action, 
                    score: evalResult.score + (Math.random() * 8), // minor dynamic jitter
                    reasoning: evalResult.reasoning 
                });
            }
        }

        if (scoredActions.length > 0) {
            scoredActions.sort((a, b) => b.score - a.score);
            const chosen = scoredActions[0]!;
            
            // Execute the highest scoring action
            const msg = await chosen.action.execute(state, client, chosen.reasoning);
            if (msg) {
                let tier = 'MINOR';
                if (['DECLARE_WAR', 'BORDER_SKIRMISH', 'MUSTER_MILITARY_FORCES', 'FORM_ALLIANCE', 'TRADE_EMBARGO', 'COVERT_SABOTAGE', 'COMMISSION_WORLD_WONDER'].includes(chosen.action.id)) {
                    tier = 'MAJOR';
                }
                events.push({ 
                    tick, 
                    type: chosen.action.id, 
                    message: msg, 
                    tier, 
                    faction_id: f.id, 
                    burg_id: state.myBurgs[0]?.burg_id || null, 
                    lore_date: loreDate 
                });
            }
        }
    }

    // --- PHASE 3: ACTIVE WAR RESOLUTION (Combat Engine) ---
    // Military campaign clashes resolve during periodic tactical maneuvers (weekly cycles)
    if (tick % 7 === 0) {
        const activeWars = diplomacy.filter((d:any) => d.status === 'WAR');
        for (const war of activeWars) {
            if (Math.random() > 0.4) continue; 

            const aggressorId = Math.random() > 0.5 ? war.faction_a_id : war.faction_b_id;
            const defenderId = aggressorId === war.faction_a_id ? war.faction_b_id : war.faction_a_id;

            const aggState = factionStates.get(aggressorId);
            const defState = factionStates.get(defenderId);
            if (!aggState || !defState || aggState.myBurgs.length === 0 || defState.myBurgs.length === 0) continue;

            const launchBurg = aggState.myBurgs[Math.floor(Math.random() * aggState.myBurgs.length)];
            const targetBurg = defState.myBurgs[Math.floor(Math.random() * defState.myBurgs.length)];

            let attackerForces: any = {};
            let defenderForces: any = {};
            try { if (launchBurg.military_forces) attackerForces = JSON.parse(launchBurg.military_forces); } catch(e){}
            try { if (targetBurg.military_forces) defenderForces = JSON.parse(targetBurg.military_forces); } catch(e){}

            let strikeForce: any = {};
            let launchRemaining: any = {};
            for (const type of Object.keys(attackerForces)) {
                const count = attackerForces[type as keyof typeof attackerForces] as number;
                strikeForce[type] = count * 0.5;
                launchRemaining[type] = count - strikeForce[type];
            }

            const result = resolveCombat(strikeForce, defenderForces);

            for (const type of Object.keys(result.attackerForces)) {
                launchRemaining[type] = (launchRemaining[type] || 0) + result.attackerForces[type];
            }

            await client.query("UPDATE sim_burg_economy SET military_forces = $1 WHERE burg_id = $2", [JSON.stringify(launchRemaining), launchBurg.burg_id]);
            await client.query("UPDATE sim_burg_economy SET military_forces = $1 WHERE burg_id = $2", [JSON.stringify(result.defenderForces), targetBurg.burg_id]);

            let defRemaining = 0;
            for (const count of Object.values(result.defenderForces)) defRemaining += Number(count) || 0;

            if (defRemaining <= 0) {
                await client.query("UPDATE sim_cells SET faction_id = $1 WHERE id = $2", [aggressorId, targetBurg.cell_id]);
                events.push({ 
                    tick, 
                    type: 'SIEGE_WON', 
                    message: `🚩 CONQUEST: The vanguard of ${aggState.name} stormed and conquered ${targetBurg.name || `Burg #${targetBurg.burg_id}`} from ${defState.name}!`, 
                    tier: 'CRITICAL', 
                    faction_id: aggressorId, 
                    burg_id: targetBurg.burg_id, 
                    lore_date: loreDate 
                });
            } else {
                events.push({ 
                    tick, 
                    type: 'BATTLE', 
                    message: `⚔️ FRONTIER CLASH: Forces of ${aggState.name} attacked ${targetBurg.name || `Burg #${targetBurg.burg_id}`} (${defState.name}). Result: ${result.winner} victory (Combat roll: ${result.attackerTotal} vs ${result.defenderTotal}, diff: ${result.difference.toFixed(0)}).`, 
                    tier: 'MAJOR', 
                    faction_id: aggressorId, 
                    burg_id: targetBurg.burg_id, 
                    lore_date: loreDate 
                });
            }
        }
    }

    // Insert logged events
    if (events.length > 0) {
        for (const ev of events) {
            await client.query(
                "INSERT INTO sim_events (tick, type, message, tier, faction_id, burg_id, lore_date) VALUES ($1, $2, $3, $4, $5, $6, $7)",
                [ev.tick, ev.type, ev.message, ev.tier, ev.faction_id, ev.burg_id, ev.lore_date]
            );
        }
    }
}
