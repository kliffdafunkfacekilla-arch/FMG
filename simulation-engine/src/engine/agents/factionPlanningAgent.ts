import { resolveCombat } from '../combatEngine';
import { FACTION_ACTIONS, FactionState, FactionAction } from '../ai/factionActions';
import { tagBurgCitizens } from "./citizenPersonaHelper";
import { DAYS_PER_MONTH } from "../canon/calendar.js";
import { loadCellTagMap } from "../cellTags.js";
import { extractBurgCivicFlags, computeSiegeDefenseMultiplier } from "../maps/civicFlags.js";

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
    } catch (e) { }
    return list;
}

function parseJsonObj(raw: any, fallback: Record<string, any> = {}): Record<string, any> {
    if (!raw) return fallback;
    if (typeof raw === 'string') {
        try { return JSON.parse(raw) || fallback; } catch { return fallback; }
    }
    return typeof raw === 'object' ? { ...raw } : fallback;
}

export interface FactionFinanceResult {
    grossIncome: number;
    pocketedGold: number;
    netRevenue: number;
    militaryUpkeep: number;
    totalUpkeep: number;
    newTreasury: number;
    effectiveCorruption: number;
    insolvent: boolean;
    deficit: number;
    totalPop: number;
    gdp: number;
    updatedFiscal: Record<string, any>;
}

/**
 * Pure deterministic fiscal evaluation from `sim_factions.fiscal_economy` + real burg pop/wealth + active regiments.
 */
export function evaluateFactionFinances(params: {
    treasury: number;
    fiscalRaw: any;
    myBurgs: any[];
    activeUnits: any[];
    activeWarCount: number;
    leaderCorruption: number;
}): FactionFinanceResult {
    const fiscal = parseJsonObj(params.fiscalRaw, {});
    const budget = parseJsonObj(fiscal.budget, {});
    const pollTax = Math.max(0, Number(fiscal.pollTax ?? 0.05) || 0);
    const salesTax = Math.max(0, Number(fiscal.salesTax ?? 0.08) || 0);
    const baseCollected = Math.max(0, Number(fiscal.collected ?? 0) || 0);
    const budgetCorr = Math.max(0, Number(budget.corruption ?? 15) || 0);
    const milBudget = Math.max(5, Number(budget.military ?? 30) || 0);
    const adminBudget = Math.max(10, (Number(budget.court ?? 30) || 0) + (Number(budget.administration ?? 25) || 0));

    let totalPop = 0;
    let burgWealthSum = 0;
    for (const b of params.myBurgs) {
        totalPop += (Number(b.pop_null) || 0) + (Number(b.pop_attuned) || 0);
        burgWealthSum += Math.max(0, Number(b.wealth) || 0);
    }
    const gdp = Math.round(totalPop * 0.1 + burgWealthSum);

    const taxDisabled = pollTax === 0 && salesTax === 0 && baseCollected === 0;
    const grossIncome = params.myBurgs.length === 0 || taxDisabled
        ? 0
        : Math.max(
            12,
            Math.round(
                params.myBurgs.length * 10 +
                totalPop * pollTax * 0.008 +
                burgWealthSum * salesTax * 0.06 +
                baseCollected * 0.12
            )
        );

    const effectiveCorruption = Math.max(0, Math.min(0.75, (budgetCorr + Math.max(0, params.leaderCorruption) * 0.25) / 100));
    const pocketedGold = Math.round(grossIncome * effectiveCorruption);
    const netRevenue = Math.max(0, grossIncome - pocketedGold);

    const milScale = Math.max(0.6, Math.min(1.6, milBudget / 30));
    let militaryUpkeep = 0;
    for (const u of params.activeUnits) {
        const cnt = Math.max(0, Number(u.count) || 0);
        if (cnt <= 0) continue;
        militaryUpkeep += Math.round(Math.max(4, Math.min(80, Math.ceil(cnt / 25))) * milScale);
    }
    const courtAdminUpkeep = Math.round(params.myBurgs.length * 5 * (adminBudget / 55));
    const warCampaignCost = params.activeWarCount * (35 + Math.min(60, params.myBurgs.length * 2));
    const totalUpkeep = militaryUpkeep + courtAdminUpkeep + warCampaignCost;

    const preBalance = Math.max(0, Number(params.treasury) || 0) + netRevenue;
    const insolvent = preBalance < totalUpkeep;
    const deficit = insolvent ? totalUpkeep - preBalance : 0;
    let newTreasury = Math.max(0, preBalance - totalUpkeep);
    if (newTreasury > 15000) {
        newTreasury -= Math.floor((newTreasury - 15000) * 0.02);
    }

    const prevSpent = parseJsonObj(fiscal.spent, {});
    const updatedFiscal: Record<string, any> = {
        ...fiscal,
        budget,
        total_pop: totalPop,
        gdp,
        collected: grossIncome,
        pocketed: pocketedGold,
        treasury: newTreasury,
        spent: {
            ...prevSpent,
            military: militaryUpkeep,
        },
    };

    return {
        grossIncome,
        pocketedGold,
        netRevenue,
        militaryUpkeep,
        totalUpkeep,
        newTreasury,
        effectiveCorruption,
        insolvent,
        deficit,
        totalPop,
        gdp,
        updatedFiscal,
    };
}

export async function runFactionPlanningAgent(client: any, tick: number, loreDate: string) {
    const factionRes = await client.query("SELECT * FROM sim_factions ORDER BY id");
    const burgRes = await client.query(`
        SELECT b.burg_id, b.pop_null, COALESCE(b.pop_attuned, 0)::int AS pop_attuned, c.faction_id, b.unrest, b.crime_rate, b.food, b.health, 
               b.military_forces, b.wealth, b.port, b.citadel, b.walls, b.plaza, b.temple, b.shanty, b.is_capital, c.id as cell_id 
        FROM sim_burg_economy b 
        JOIN sim_cells c ON b.cell_id = c.id 
        WHERE c.faction_id IS NOT NULL
        ORDER BY b.burg_id
    `);
    const unitRes = await client.query("SELECT * FROM sim_faction_units ORDER BY id");
    const paragonRes = await client.query("SELECT * FROM sim_paragons WHERE faction_id IS NOT NULL ORDER BY id");
    const diploRes = await client.query("SELECT * FROM sim_diplomacy ORDER BY faction_a_id, faction_b_id");
    const bordersRes = await client.query("SELECT * FROM sim_faction_borders ORDER BY id");

    // Fetch environmental / sector tags across cells
    const sectorTagsMap = await loadCellTagMap(client);

    const factions = factionRes.rows;
    const burgs = burgRes.rows;
    const units = unitRes.rows;
    const paragons = paragonRes.rows;
    const borders = bordersRes.rows;
    const diplomacy = diploRes.rows;

    const events: any[] = [];
    const factionStates = new Map<number, FactionState>();
    const factionBatchUpdates: Array<{ id: number; treasury: number; fiscal: string }> = [];
    const unitBatchUpdates: Array<{ id: number; count: number; status: string }> = [];
    const burgFiscalDeltas = new Map<number, { du: number; dc: number }>();

    // --- PHASE 1: BUILD FACTION STATES ---
    for (const f of factions) {
        const myBurgs = burgs.filter((b: any) => b.faction_id === f.id);
        const myUnits = units.filter((u: any) => u.faction_id === f.id && u.status !== 'DISBANDED' && Number(u.count) > 0);

        let avgUnrest = 0;
        let avgHealth = 0;
        let avgCrime = 0;

        // Collect all active macro tags across the faction's territories
        const macroTagsSet = new Set<string>();
        for (const b of myBurgs) {
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

        const myCounselors = paragons.filter((p: any) => p.faction_id === f.id && p.is_counselor);
        let avgSurv = 1.0, avgProt = 1.0;
        if (myCounselors.length > 0) {
            avgSurv = myCounselors.reduce((sum: number, c: any) => sum + (c.survival_mult || 1.0), 0) / myCounselors.length;
            avgProt = myCounselors.reduce((sum: number, c: any) => sum + (c.protection_mult || 1.0), 0) / myCounselors.length;
        }

        // Identify sovereign ruler before fiscal evaluation so ruler corruption affects embezzlement
        const leader = paragons.find((p: any) => p.faction_id === f.id && [
            "EMPEROR", "EMPRESS", "HIGH_MATRIARCH", "ARCH-DUKE", "GRAND_CHIEFTAIN", "LORD_PROTECTOR", "HIGH_CHANCELLOR", "WARLORD"
        ].includes(String(p.title || "").toUpperCase())) || paragons.find((p: any) => p.faction_id === f.id && !p.is_counselor);

        const leaderTraits = getTraitsList(leader);
        const leaderName = leader ? leader.name : `Sovereign of ${f.name}`;
        const leaderTitle = leader ? leader.title : "High Sovereign";
        const leaderCorruption = Number(leader?.corruption_score || 0);

        const activeWarsList = diplomacy.filter((d: any) => d.status === 'WAR' && (d.faction_a_id === f.id || d.faction_b_id === f.id));
        const finance = evaluateFactionFinances({
            treasury: Number(f.treasury) || 0,
            fiscalRaw: f.fiscal_economy,
            myBurgs,
            activeUnits: myUnits,
            activeWarCount: activeWarsList.length,
            leaderCorruption,
        });
        const newTreasury = finance.newTreasury;
        const netIncome = finance.netRevenue - finance.totalUpkeep;

        // Bankruptcy triggers unpaid regiment desertions in `sim_faction_units`
        if (finance.insolvent && myUnits.length > 0) {
            const desertRate = Math.min(0.5, 0.15 + finance.deficit / Math.max(100, finance.totalUpkeep * 2));
            let troopsDeserted = 0;
            let unitsDisbanded = 0;
            for (const u of myUnits) {
                const curCnt = Math.max(0, Number(u.count) || 0);
                const loss = Math.max(12, Math.ceil(curCnt * desertRate));
                const nextCnt = Math.max(0, curCnt - loss);
                const actualLoss = curCnt - nextCnt;
                const nextStatus = nextCnt <= 0 ? 'DISBANDED' : String(u.status || 'ACTIVE');
                troopsDeserted += actualLoss;
                if (nextStatus === 'DISBANDED') unitsDisbanded++;
                u.count = nextCnt;
                u.status = nextStatus;
                unitBatchUpdates.push({ id: Number(u.id), count: nextCnt, status: nextStatus });
            }
            if (troopsDeserted > 0) {
                events.push({
                    tick,
                    type: 'FACTION_TROOP_DESERTION',
                    message: `💸 PAYROLL COLLAPSE: ${f.name} defaulted on military upkeep (${finance.deficit} gold short). ${troopsDeserted} soldiers deserted (${unitsDisbanded} units disbanded)!`,
                    tier: 'MAJOR',
                    faction_id: f.id,
                    burg_id: myBurgs[0]?.burg_id || null,
                    lore_date: loreDate,
                });
            }
            for (const b of myBurgs) {
                const cur = burgFiscalDeltas.get(Number(b.burg_id)) || { du: 0, dc: 0 };
                cur.du += 3;
                burgFiscalDeltas.set(Number(b.burg_id), cur);
            }
        }

        // Systemic graft (corruption >= 30%) breeds provincial unrest and underworld crime
        if (finance.effectiveCorruption >= 0.30 && myBurgs.length > 0) {
            const excess = finance.effectiveCorruption - 0.25;
            const du = Math.max(1, Math.round(excess * 10));
            const dc = Math.round(excess * 8 * 10) / 10;
            for (const b of myBurgs) {
                const cur = burgFiscalDeltas.get(Number(b.burg_id)) || { du: 0, dc: 0 };
                cur.du += du;
                cur.dc += dc;
                burgFiscalDeltas.set(Number(b.burg_id), cur);
            }
            if (finance.effectiveCorruption >= 0.35) {
                events.push({
                    tick,
                    type: 'FACTION_CORRUPTION_UNREST',
                    message: `⚖️ TREASURY SKIMMING: Officials in ${f.name} pocketed ${finance.pocketedGold} gold (${Math.round(finance.effectiveCorruption * 100)}% graft), stoking provincial unrest and syndicate crime.`,
                    tier: 'MINOR',
                    faction_id: f.id,
                    burg_id: myBurgs[0]?.burg_id || null,
                    lore_date: loreDate,
                });
            }
        }

        // Calculate authentic military combat squads & fortifications across all garrisons in the faction
        let totalCombatSquads = 0;
        for (const b of myBurgs) {
            let forces: any = {};
            try {
                if (typeof b.military_forces === 'string') forces = JSON.parse(b.military_forces || '{}');
                else if (b.military_forces) forces = b.military_forces;
            } catch (e) { }
            let squads = 0;
            for (const count of Object.values(forces)) {
                squads += (Number(count) || 0);
            }
            squads += Math.max(2, Math.floor((b.pop_null || 1000) / 1000));
            const fortMult = computeSiegeDefenseMultiplier(extractBurgCivicFlags(b));
            totalCombatSquads += Math.round(squads * fortMult);
        }

        let perceivedEconomy = netIncome * avgSurv;
        let perceivedDefense = Math.max(15, Math.floor(totalCombatSquads * avgProt));

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
        const activeWars = diplomacy.filter((d: any) => d.status === 'WAR' && (d.faction_a_id === f.id || d.faction_b_id === f.id)).map((d: any) => d.faction_a_id === f.id ? d.faction_b_id : d.faction_a_id);

        factionStates.set(f.id, {
            id: f.id, name: f.name, treasury: newTreasury,
            avgUnrest, avgHealth, avgCrime, aggression, economy, magic, perceivedEconomy, perceivedDefense,
            myBurgs, myUnits, validNeighbors, activeWars,
            leaderName, leaderTitle, leaderTraits, leaderCorruption,
            macroTags: Array.from(macroTagsSet),
            tick, loreDate
        });

        factionBatchUpdates.push({
            id: Number(f.id),
            treasury: newTreasury,
            fiscal: JSON.stringify(finance.updatedFiscal),
        });
    }

    if (factionBatchUpdates.length > 0) {
        await client.query(
            `UPDATE sim_factions AS f SET treasury = v.treasury, fiscal_economy = v.fiscal
             FROM (SELECT unnest($1::int[]) AS id, unnest($2::bigint[]) AS treasury, unnest($3::jsonb[]) AS fiscal) AS v
             WHERE f.id = v.id`,
            [
                factionBatchUpdates.map(u => u.id),
                factionBatchUpdates.map(u => u.treasury),
                factionBatchUpdates.map(u => u.fiscal),
            ]
        );
    }

    if (unitBatchUpdates.length > 0) {
        await client.query(
            `UPDATE sim_faction_units AS u SET count = v.count, status = v.status
             FROM (SELECT unnest($1::int[]) AS id, unnest($2::int[]) AS count, unnest($3::text[]) AS status) AS v
             WHERE u.id = v.id`,
            [
                unitBatchUpdates.map(u => u.id),
                unitBatchUpdates.map(u => u.count),
                unitBatchUpdates.map(u => u.status),
            ]
        );
    }

    if (burgFiscalDeltas.size > 0) {
        const bIds = Array.from(burgFiscalDeltas.keys()).sort((a, b) => a - b);
        await client.query(
            `UPDATE sim_burg_economy AS b SET
                unrest = LEAST(100, GREATEST(0, b.unrest + v.du)),
                crime_rate = LEAST(100, GREATEST(0, COALESCE(b.crime_rate, 0) + v.dc))
             FROM (SELECT unnest($1::int[]) AS burg_id, unnest($2::int[]) AS du, unnest($3::real[]) AS dc) AS v
             WHERE b.burg_id = v.burg_id`,
            [
                bIds,
                bIds.map(id => burgFiscalDeltas.get(id)!.du),
                bIds.map(id => burgFiscalDeltas.get(id)!.dc),
            ]
        );
    }

    // --- PHASE 1B: ORGANIC BORDER FRICTION & NATURAL TENSION ESCALATION ---
    // Borders between sovereign nations naturally accumulate tension or ease based on leader traits,
    // active trade, and resource strain. Tension does NOT auto-declare war; it creates crises that the Ruler evaluates!
    if (tick % 7 === 0) {
        const uniqueBorderPairs = new Set<string>();
        for (const b of borders) {
            const fA = Math.min(b.faction_a, b.faction_b);
            const fB = Math.max(b.faction_a, b.faction_b);
            if (fA > 0 && fB > 0 && fA !== fB) {
                uniqueBorderPairs.add(`${fA}:${fB}`);
            }
        }

        for (const pair of uniqueBorderPairs) {
            const parts = pair.split(':').map(Number);
            const idA = parts[0];
            const idB = parts[1];
            if (!idA || !idB) continue;
            const stateA = factionStates.get(idA);
            const stateB = factionStates.get(idB);
            if (!stateA || !stateB) continue;

            const existingDiplo = diplomacy.find((d: any) =>
                (d.faction_a_id === idA && d.faction_b_id === idB) ||
                (d.faction_a_id === idB && d.faction_b_id === idA)
            );

            const curTension = existingDiplo?.tension ?? 10;
            const curStatus = existingDiplo?.status ?? 'PEACE';

            // Natural baseline: peaceful borders naturally cool down (-1 tension)
            let tensionDelta = curStatus === 'PEACE' ? -1 : 0;

            // Warlord / Conqueror / Aggressive ruler traits stoke border conflict IF they have the army and wealth to back it up
            const isAggA = stateA.leaderTraits.some(t => t.includes("CONQUEROR") || t.includes("WARLORD") || t.includes("BLOODTHIRSTY") || t.includes("AGGRESSIVE"));
            const isAggB = stateB.leaderTraits.some(t => t.includes("CONQUEROR") || t.includes("WARLORD") || t.includes("BLOODTHIRSTY") || t.includes("AGGRESSIVE"));
            if (isAggA && stateA.perceivedDefense > 30 && stateA.treasury > 2000) tensionDelta += 3;
            if (isAggB && stateB.perceivedDefense > 30 && stateB.treasury > 2000) tensionDelta += 3;

            // Famine or poverty breeds desperation raids across borders
            if (stateA.perceivedEconomy < 0 || stateB.perceivedEconomy < 0) tensionDelta += 3;

            // Pacifist / Diplomat / Compassionate rulers actively defuse tension
            const isPacA = stateA.leaderTraits.some(t => t.includes("PACIFIST") || t.includes("DIPLOMAT") || t.includes("COMPASSIONATE"));
            const isPacB = stateB.leaderTraits.some(t => t.includes("PACIFIST") || t.includes("DIPLOMAT") || t.includes("COMPASSIONATE"));
            if (isPacA) tensionDelta -= 3;
            if (isPacB) tensionDelta -= 3;

            const newTension = Math.max(0, Math.min(100, curTension + tensionDelta));

            // Tension naturally shifts state between PEACE and COLD_WAR
            let newStatus = curStatus;
            if (curStatus === 'PEACE' && newTension >= 65) {
                newStatus = 'COLD_WAR';
                events.push({
                    tick,
                    type: 'COLD_WAR_CHILL',
                    message: `❄️ BORDER CHILL: Frontier friction between ${stateA.name} and ${stateB.name} chilled into a Cold War as border posts tightened inspections and trade cooled.`,
                    tier: 'MINOR',
                    faction_id: idA,
                    lore_date: loreDate
                });
            } else if (curStatus === 'COLD_WAR' && newTension <= 25) {
                newStatus = 'PEACE';
                events.push({
                    tick,
                    type: 'BORDER_THAW',
                    message: `🌱 BORDER THAW: Peaceful relations and quiet borders between ${stateA.name} and ${stateB.name} dissolved old suspicions, restoring open peace.`,
                    tier: 'MINOR',
                    faction_id: idA,
                    lore_date: loreDate
                });
            } else if (newTension >= 95 && curStatus !== 'WAR') {
                // High boiling point crisis: creates border alerts, but RULER makes the conscious war/peace decision in Phase 2!
                if (Math.random() < 0.20) {
                    events.push({
                        tick,
                        type: 'BORDER_CRISIS',
                        message: `⚔️ FRONTIER BOILING POINT: Border friction between ${stateA.name} and ${stateB.name} reached maximum tension (95+)! Both royal courts face urgent decisions on mobilization or de-escalation.`,
                        tier: 'MINOR',
                        faction_id: idA,
                        lore_date: loreDate
                    });
                }
            }

            await client.query(`
                INSERT INTO sim_diplomacy (faction_a_id, faction_b_id, status, tension)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (faction_a_id, faction_b_id) DO UPDATE
                SET status = EXCLUDED.status, tension = EXCLUDED.tension
            `, [idA, idB, newStatus, newTension]);
        }
    }

    // --- PHASE 2: UTILITY AI ACTION EVALUATION WITH PERSONALITY & TAG WEIGHTING ---
    // Staggered Bureaucracy: Each sovereign faction evaluates grand strategy ONCE per month
    // on their own designated day of the month (DAYS_PER_MONTH), preventing constant diplomatic flip-flopping.
    for (const f of factions) {
        if ((tick + f.id * 7) % DAYS_PER_MONTH !== 0) continue;

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
        const activeWars = diplomacy.filter((d: any) => d.status === 'WAR');
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
            try { if (launchBurg.military_forces) attackerForces = JSON.parse(launchBurg.military_forces); } catch (e) { }
            try { if (targetBurg.military_forces) defenderForces = JSON.parse(targetBurg.military_forces); } catch (e) { }

            let strikeForce: any = {};
            let launchRemaining: any = {};
            let totalStrikeSquads = 0;
            for (const type of Object.keys(attackerForces)) {
                const count = attackerForces[type as keyof typeof attackerForces] as number;
                strikeForce[type] = count * 0.5;
                launchRemaining[type] = count - strikeForce[type];
                totalStrikeSquads += strikeForce[type];
            }

            // Cannot launch an offensive campaign without at least 6 combat squads able to march
            if (totalStrikeSquads < 6) continue;

            // Marching campaign consumes rations and provisions from the staging burg
            await client.query(`
                UPDATE sim_burg_economy 
                SET food = GREATEST(0, food - 25), wealth = GREATEST(0, wealth - 15), unrest = LEAST(100, unrest + 2)
                WHERE burg_id = $1
            `, [launchBurg.burg_id]);

            const result = resolveCombat(strikeForce, defenderForces, {
                attackerName: aggState.name,
                defenderName: defState.name,
                tick,
                defenderFortifications: extractBurgCivicFlags(targetBurg),
            });

            if ((result as any).evadedClash) {
                const siphonW = (result as any).siphonWealth || 100;
                const siphonF = (result as any).siphonFood || 100;
                await client.query("UPDATE sim_burg_economy SET wealth = GREATEST(0, wealth - $1), food = GREATEST(0, food - $2) WHERE burg_id = $3", [siphonW, siphonF, targetBurg.burg_id]);
                await client.query("UPDATE sim_burg_economy SET wealth = wealth + $1, food = food + $2 WHERE burg_id = $3", [siphonW, siphonF, launchBurg.burg_id]);
                events.push({
                    tick,
                    type: 'DESERT_SAND_AMBUSH',
                    message: `💨 SUPPLY AMBUSH: Outriders of ${aggState.name} slipped past border battle lines of ${defState.name}, siphoning ${siphonW} gold and ${siphonF} bushels from the supply trains of ${targetBurg.name}!`,
                    tier: 'MAJOR',
                    faction_id: aggressorId,
                    burg_id: targetBurg.burg_id,
                    lore_date: loreDate
                });
                continue;
            }

            if ((result as any).scorchedEarth) {
                await client.query("UPDATE sim_burg_economy SET food = GREATEST(0, food - 150) WHERE burg_id = $1", [targetBurg.burg_id]);
                events.push({
                    tick,
                    type: 'SCORCHED_EARTH',
                    message: `🔥 SCORCHED EARTH: Retiring forces of ${defState.name} put their granaries to the torch in ${targetBurg.name} to deny provisions to the conquerors!`,
                    tier: 'MAJOR',
                    burg_id: targetBurg.burg_id,
                    lore_date: loreDate
                });
            }

            if ((result as any).sumpKinTerror) {
                await client.query("UPDATE sim_burg_economy SET unrest = LEAST(100, unrest + 25) WHERE burg_id = $1", [targetBurg.burg_id]);
            }

            for (const type of Object.keys(result.attackerForces)) {
                launchRemaining[type] = (launchRemaining[type] || 0) + result.attackerForces[type];
            }

            await client.query("UPDATE sim_burg_economy SET military_forces = $1 WHERE burg_id = $2", [JSON.stringify(launchRemaining), launchBurg.burg_id]);
            await client.query("UPDATE sim_burg_economy SET military_forces = $1 WHERE burg_id = $2", [JSON.stringify(result.defenderForces), targetBurg.burg_id]);

            let defRemaining = 0;
            for (const count of Object.values(result.defenderForces)) defRemaining += Number(count) || 0;

            if (defRemaining <= 0) {
                const lootedGold = Math.floor((targetBurg.wealth || 0) * 0.50);
                const occForces = { infantry: Math.max(12, Math.floor((launchRemaining.infantry || 24) * 0.4)) };
                await client.query(
                    `UPDATE sim_cells SET faction_id = $1 WHERE id = $2`,
                    [aggressorId, targetBurg.cell_id]
                );
                await client.query(
                    `UPDATE sim_burg_economy 
                     SET occupier_faction_id = $1, 
                         occupation_ticks = 0,
                         resistance_strength = 50,
                         military_forces = $2,
                         wealth = GREATEST(0, wealth - $3),
                         unrest = LEAST(100, unrest + 40)
                     WHERE burg_id = $4`,
                    [aggressorId, JSON.stringify(occForces), lootedGold, targetBurg.burg_id]
                );
                await client.query(
                    `UPDATE sim_factions SET treasury = treasury + $1 WHERE id = $2`,
                    [lootedGold, aggressorId]
                );
                await tagBurgCitizens(client, targetBurg.burg_id, ['#ConqueredCitizen', '#WarRefugee'], 'FEARFUL', `Surviving the military conquest of ${ targetBurg.name || 'the settlement' } by ${ aggState.name }.`, '%laborer%', 4);

                events.push({ 
                    tick, 
                    type: 'SIEGE_WON', 
                    message: `🚩 CONQUEST: The vanguard of ${ aggState.name } stormed and conquered ${ targetBurg.name || `Burg #${targetBurg.burg_id}` } from ${ defState.name }! Plundered ${ lootedGold } gold into royal war coffers.`, 
                    tier: 'CRITICAL', 
                    faction_id: aggressorId, 
                    burg_id: targetBurg.burg_id, 
                    lore_date: loreDate 
                });

                const targetArch = String(targetBurg.architecture_type || 'WOOD').toUpperCase();
                if (targetArch === 'WOOD' || targetArch.includes('TIMBER') || targetArch === 'HALF_TIMBERED') {
                    events.push({
                        tick,
                        type: 'TOWN_BURNED',
                        message: `🔥 INFERNO: As ${ targetBurg.name || `Burg #${targetBurg.burg_id}` } fell, torch fire ignited the wooden ramparts and lofts! Because the settlement was built of wood, flames swept uncontrolled across the districts, burning workshops to ash!`,
                        tier: 'CRITICAL',
                        faction_id: aggressorId,
                        burg_id: targetBurg.burg_id,
                        lore_date: loreDate
                    });
                    await tagBurgCitizens(client, targetBurg.burg_id, ['#BurnedOutRefugee', '#AshRuinsSurvivor'], 'TERRIFIED', `Lost home and workshop to the blaze that incinerated wooden districts of ${ targetBurg.name }.`, null, 4);
                }
            } else {
                events.push({ 
                    tick, 
                    type: 'BATTLE', 
                    message: `⚔️ FRONTIER CLASH: Forces of ${ aggState.name } attacked ${ targetBurg.name || `Burg #${targetBurg.burg_id}` }(${ defState.name }).Result: ${ result.winner } victory(Combat roll: ${ result.attackerTotal } vs ${ result.defenderTotal }, diff: ${ result.difference.toFixed(0) }).`, 
                    tier: 'MAJOR', 
                    faction_id: aggressorId, 
                    burg_id: targetBurg.burg_id, 
                    lore_date: loreDate 
                });
            }

            // Natural Peace Treaty Resolution (Exhaustion from Debt or Mass Unrest)
            if ((aggState.treasury < 300 && aggState.avgUnrest > 50) || (defState.treasury < 300 && defState.avgUnrest > 50)) {
                const fA = Math.min(aggressorId, defenderId);
                const fB = Math.max(aggressorId, defenderId);
                await client.query(`
                    UPDATE sim_diplomacy 
                    SET status = 'PEACE', tension = 30 
                    WHERE faction_a_id = $1 AND faction_b_id = $2
                    `, [fA, fB]);
                events.push({
                    tick,
                    type: 'PEACE_TREATY',
                    message: `🕊️ ARMISTICE SIGNED: Devastated by military casualties, war debt, and civil unrest, diplomats of ${ aggState.name } and ${ defState.name } ratified an emergency peace treaty!`,
                    tier: 'MAJOR',
                    faction_id: aggressorId,
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
