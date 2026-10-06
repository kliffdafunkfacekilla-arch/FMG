"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runFactionPlanningAgent = runFactionPlanningAgent;
const combatEngine_1 = require("../combatEngine");
const factionActions_1 = require("../ai/factionActions");
async function runFactionPlanningAgent(client, tick, loreDate) {
    const factionRes = await client.query("SELECT * FROM sim_factions");
    const burgRes = await client.query("SELECT b.burg_id, b.pop_null, c.faction_id, b.unrest, b.crime_rate, b.food, b.health, b.military_forces, c.id as cell_id FROM sim_burg_economy b JOIN sim_cells c ON b.cell_id = c.id WHERE c.faction_id IS NOT NULL");
    const unitRes = await client.query("SELECT * FROM sim_faction_units");
    const paragonRes = await client.query("SELECT * FROM sim_paragons WHERE faction_id IS NOT NULL");
    const diploRes = await client.query("SELECT * FROM sim_diplomacy");
    const bordersRes = await client.query("SELECT * FROM sim_faction_borders");
    const factions = factionRes.rows;
    const burgs = burgRes.rows;
    const units = unitRes.rows;
    const paragons = paragonRes.rows;
    const borders = bordersRes.rows;
    const diplomacy = diploRes.rows;
    const events = [];
    const WAGES = { 'INFANTRY': 100, 'RANGED': 200, 'MOUNTED': 300, 'AIRSHIP': 400, 'MAGE': 1500 };
    const factionStates = new Map();
    // --- PHASE 1: BUILD FACTION STATES ---
    for (const f of factions) {
        const myBurgs = burgs.filter((b) => b.faction_id === f.id);
        const myUnits = units.filter((u) => u.faction_id === f.id);
        let grossIncome = 0;
        let totalUpkeep = 0;
        let avgUnrest = 0;
        let avgHealth = 0;
        let avgCrime = 0;
        for (const b of myBurgs) {
            let size = 1;
            if (b.pop_null > 500)
                size = 2;
            if (b.pop_null > 2000)
                size = 3;
            if (b.pop_null >= 5000)
                size = 4 + Math.floor((b.pop_null - 5000) / 5000);
            grossIncome += 200 * Math.pow(3, size - 1);
            avgUnrest += b.unrest || 0;
            avgHealth += b.health || 100;
            avgCrime += b.crime_rate || 0;
        }
        if (myBurgs.length > 0) {
            avgUnrest /= myBurgs.length;
            avgHealth /= myBurgs.length;
            avgCrime /= myBurgs.length;
        }
        for (const u of myUnits) {
            totalUpkeep += WAGES[u.unit_type] || 100;
        }
        const netIncome = grossIncome - totalUpkeep;
        let newTreasury = Math.max(0, (f.treasury || 0) + netIncome);
        const myCounselors = paragons.filter((p) => p.faction_id === f.id && p.is_counselor);
        let avgSurv = 1.0, avgProt = 1.0;
        if (myCounselors.length > 0) {
            avgSurv = myCounselors.reduce((sum, c) => sum + c.survival_mult, 0) / myCounselors.length;
            avgProt = myCounselors.reduce((sum, c) => sum + c.protection_mult, 0) / myCounselors.length;
        }
        let perceivedEconomy = netIncome * avgSurv;
        let perceivedDefense = myUnits.length * avgProt;
        const leader = paragons.find((p) => p.faction_id === f.id && ["EMPEROR", "EMPRESS", "HIGH_MATRIARCH", "SYNDICATE_BOSS", "PRESIDENT", "CHIEFTAIN"].includes(p.title)) || paragons.find((p) => p.faction_id === f.id && !p.is_counselor);
        let aggression = f.trait_aggression || 5;
        let economy = f.trait_economy || 5;
        let magic = f.trait_magic || 5;
        if (leader && leader.traits) {
            if (leader.traits.includes("Bloodthirsty"))
                aggression += 5;
            if (leader.traits.includes("Pacifist"))
                aggression -= 4;
            if (leader.traits.includes("Greedy"))
                economy += 4;
            if (leader.traits.includes("Superstitious"))
                magic += 5;
            if (leader.traits.includes("Paranoid"))
                aggression += 2;
        }
        const validNeighbors = borders.filter((b) => b.faction_a === f.id).map((b) => b.faction_b);
        const activeWars = diplomacy.filter((d) => d.status === 'WAR' && (d.faction_a_id === f.id || d.faction_b_id === f.id)).map((d) => d.faction_a_id === f.id ? d.faction_b_id : d.faction_a_id);
        factionStates.set(f.id, {
            id: f.id, name: f.name, treasury: newTreasury,
            avgUnrest, avgHealth, avgCrime, aggression, economy, magic, perceivedEconomy, perceivedDefense,
            myBurgs, myUnits, validNeighbors, activeWars, leaderName: leader ? leader.name : 'The Ruler',
            tick, loreDate
        });
        // Ensure treasury updates every tick due to macro economy
        await client.query("UPDATE sim_factions SET treasury = $1 WHERE id = $2", [newTreasury, f.id]);
    }
    // --- PHASE 2: UTILITY AI ACTION EVALUATION ---
    for (const f of factions) {
        const state = factionStates.get(f.id);
        if (!state || state.myBurgs.length === 0)
            continue;
        // Bureaucratic Delay (Only evaluate full Action Pool periodically)
        if (tick % 10 !== f.id % 10)
            continue;
        // Evaluate all actions
        const scoredActions = [];
        for (const action of factionActions_1.FACTION_ACTIONS) {
            const score = action.evaluate(state);
            if (score > 0) {
                scoredActions.push({ action, score });
            }
        }
        if (scoredActions.length > 0) {
            scoredActions.sort((a, b) => b.score - a.score);
            const chosenAction = scoredActions[0]?.action;
            // Execute
            const msg = chosenAction ? await chosenAction.execute(state, client) : null;
            if (msg) {
                // Tier is major if it's a war or huge investment
                let tier = 'MINOR';
                if (['DECLARE_WAR', 'PURGE_DISSIDENTS', 'INFRASTRUCTURE_INVESTMENT'].includes(chosenAction?.id || ''))
                    tier = 'MAJOR';
                events.push({ tick, type: chosenAction?.id, message: msg, tier, faction_id: f.id });
            }
        }
    }
    // --- PHASE 3: ACTIVE WAR RESOLUTION (Combat Engine) ---
    const activeWars = diplomacy.filter((d) => d.status === 'WAR');
    for (const war of activeWars) {
        if (Math.random() > 0.3)
            continue;
        const aggressorId = Math.random() > 0.5 ? war.faction_a_id : war.faction_b_id;
        const defenderId = aggressorId === war.faction_a_id ? war.faction_b_id : war.faction_a_id;
        const aggState = factionStates.get(aggressorId);
        const defState = factionStates.get(defenderId);
        if (!aggState || !defState || aggState.myBurgs.length === 0 || defState.myBurgs.length === 0)
            continue;
        const launchBurg = aggState.myBurgs[Math.floor(Math.random() * aggState.myBurgs.length)];
        const targetBurg = defState.myBurgs[Math.floor(Math.random() * defState.myBurgs.length)];
        let attackerForces = {};
        let defenderForces = {};
        try {
            if (launchBurg.military_forces)
                attackerForces = JSON.parse(launchBurg.military_forces);
        }
        catch (e) { }
        try {
            if (targetBurg.military_forces)
                defenderForces = JSON.parse(targetBurg.military_forces);
        }
        catch (e) { }
        let strikeForce = {};
        let launchRemaining = {};
        for (const type of Object.keys(attackerForces)) {
            const count = attackerForces[type];
            strikeForce[type] = count * 0.5;
            launchRemaining[type] = count - strikeForce[type];
        }
        const result = (0, combatEngine_1.resolveCombat)(strikeForce, defenderForces);
        for (const type of Object.keys(result.attackerForces)) {
            launchRemaining[type] = (launchRemaining[type] || 0) + result.attackerForces[type];
        }
        await client.query("UPDATE sim_burg_economy SET military_forces = $1 WHERE burg_id = $2", [JSON.stringify(launchRemaining), launchBurg.burg_id]);
        await client.query("UPDATE sim_burg_economy SET military_forces = $1 WHERE burg_id = $2", [JSON.stringify(result.defenderForces), targetBurg.burg_id]);
        let defRemaining = 0;
        for (const val of Object.values(result.defenderForces))
            defRemaining += val || 0;
        let aggRemaining = 0;
        for (const val of Object.values(result.attackerForces))
            aggRemaining += val || 0;
        const aggFaction = factions.find((f) => f.id === aggressorId);
        if (defRemaining < 1 && aggRemaining > 0) {
            await client.query("UPDATE sim_cells SET faction_id = $1 WHERE id = $2", [aggressorId, targetBurg.cell_id]);
            events.push({ tick, type: 'SIEGE_WON', message: `The forces of ${aggFaction?.name || 'Faction ' + aggressorId} crushed the defenders at Burg ${targetBurg.burg_id} and OCCUPIED the city!`, tier: 'MAJOR', faction_id: aggressorId });
        }
        else {
            const atkLosses = (result.difference > 0 && result.winner === 'DEFENDER') ? Math.floor(result.difference / 100) : 0;
            const defLosses = (result.difference > 0 && result.winner === 'ATTACKER') ? Math.floor(result.difference / 100) : 0;
            if (atkLosses > 0 || defLosses > 0) {
                events.push({ tick, type: 'BATTLE', message: `A fierce battle erupted at Burg ${targetBurg.burg_id}. Attacker sustained ${atkLosses} losses, Defender sustained ${defLosses} losses.`, tier: 'MINOR', faction_id: aggressorId });
            }
        }
    }
    if (events.length > 0) {
        for (const ev of events) {
            await client.query("INSERT INTO sim_events (tick, type, message, tier, faction_id) VALUES ($1, $2, $3, $4, $5)", [ev.tick, ev.type, ev.message, ev.tier, ev.faction_id]);
        }
    }
}
//# sourceMappingURL=factionPlanningAgent.js.map