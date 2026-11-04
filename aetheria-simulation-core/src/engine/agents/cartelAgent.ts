import { PoolClient } from "pg";
import { getCartelLairType, ensureLairResidents } from "./outlawSyndicates";
import { recruitInsideMan } from "./citizenPersonaHelper";

export { getCartelLairType };

export async function runCartelAgent(client: PoolClient, tick: number, loreDate: string) {
    // 1. Fetch Cartels (All 10 Autonomous Outlaw Syndicates)
    const cartelsRes = await client.query("SELECT * FROM sim_outlaw_factions ORDER BY id ASC");
    
    // Self-healing: Ensure every cartel has worker_groups initialized and an Underworld Paragon
    for (const cartel of cartelsRes.rows) {
        if (cartel.worker_groups === undefined || cartel.worker_groups === null) {
            await client.query("ALTER TABLE sim_outlaw_factions ADD COLUMN IF NOT EXISTS worker_groups INT DEFAULT 2");
            await client.query("UPDATE sim_outlaw_factions SET worker_groups = 2 WHERE id = $1", [cartel.id]);
            cartel.worker_groups = 2;
        }

        const paragonRes = await client.query("SELECT * FROM sim_paragons WHERE outlaw_id = $1 LIMIT 1", [cartel.id]);
        let paragon = paragonRes.rows[0];
        if (!paragon) {
            // Spawn a Capo if they don't have one
            const traits = JSON.stringify([{ name: "Ruthless", modifier: 0.2 }]);
            const newP = await client.query(
                `INSERT INTO sim_paragons (outlaw_id, burg_id, title, name, traits) VALUES ($1, $2, 'Syndicate Boss', $3, $4) RETURNING *`, 
                [cartel.id, cartel.capital_burg_id || 0, `${cartel.name} Capo`, traits]
            );
            paragon = newP.rows[0];
        }
        cartel.paragon = paragon;
    }

    // 2. Hustle, Drain & Recruit Logic (Operating Independently Across All Factions)
    const targetBurgsRes = await client.query(`
        SELECT b.burg_id, b.cell_id, b.name, b.unrest, b.pop_null, b.wealth, b.health,
               b.food, b.raw_materials, b.refined_goods, c.faction_id
        FROM sim_burg_economy b
        JOIN sim_cells c ON c.id = b.cell_id
        ORDER BY RANDOM() LIMIT 50
    `);
    const burgs = targetBurgsRes.rows;

    for (const cartel of cartelsRes.rows) {
        if (cartel.worker_groups <= 0) continue;

        let availableWorkers = cartel.worker_groups;
        let successfulRecruits = 0;
        let hustleWealth = 0;

        // Deploy workers: 30% recruiting, 70% draining resources & distributing contraband
        let recruiters = Math.floor(availableWorkers * 0.3) + 1;
        let hustlers = availableWorkers - recruiters;

        // --- RECRUITING PHASE (Targeting Vulnerable, Impoverished or High-Unrest Burgs) ---
        for (let i = 0; i < recruiters; i++) {
            // Desperate, impoverished or hungry citizens seek outlaw coin and contraband shelter
            const target = burgs.find(b => (b.unrest >= 5 || b.wealth < 1200 || b.health < 80 || b.food < (b.pop_null || 100) * 5) && (b.pop_null || 0) >= 12);
            if (target) {
                const baseChance = target.unrest > 0 ? (target.unrest / 100) : 0.25;
                const pTraitsStr = typeof cartel.paragon?.traits === 'string' ? cartel.paragon.traits : JSON.stringify(cartel.paragon?.traits || []);
                const hasRuthless = pTraitsStr.includes("Ruthless") || pTraitsStr.includes("Intimidating");
                const successChance = baseChance + (hasRuthless ? 0.25 : 0.15);
                if (Math.random() < successChance) {
                    successfulRecruits++;
                    target.pop_null -= 12; // Absorb a unit of 12 starving laborers into the syndicate
                    await client.query(`UPDATE sim_burg_economy SET pop_null = pop_null - 12 WHERE burg_id = $1`, [target.burg_id]);

                    // Turn an authentic receptive citizen in this burg into a Syndicate Inside Man
                    const insideMan = await recruitInsideMan(client, target.burg_id, cartel.name, target.name || 'the province');
                    if (insideMan) {
                        await client.query(`
                            INSERT INTO sim_events (tick, type, message, tier, faction_id, burg_id, lore_date)
                            VALUES ($1, 'CARTEL_INSIDE_MAN_RECRUITED', $2, 'MINOR', $3, $4, $5)
                        `, [
                            tick,
                            `${cartel.name} established a covert foothold in ${target.name}: turned ${insideMan.name} (${insideMan.profession}) into an inside man!`,
                            cartel.id,
                            target.burg_id,
                            loreDate
                        ]);
                    }
                }
            }
        }

        // --- HUSTLING PHASE (Draining Faction Resources & Supplying Contraband to Citizens) ---
        for (let i = 0; i < hustlers; i++) {
            const target = burgs.find(b => b.wealth > 60);
            if (target) {
                const goldHaul = 35 + Math.floor(Math.random() * 45);
                const foodHaul = 20 + Math.floor(Math.random() * 30);
                const rawHaul = 15 + Math.floor(Math.random() * 25);
                const refinedHaul = 10 + Math.floor(Math.random() * 20);

                hustleWealth += goldHaul;
                target.wealth = Math.max(0, target.wealth - goldHaul);
                target.food = Math.max(0, (target.food || 1000) - foodHaul);
                target.raw_materials = Math.max(0, (target.raw_materials || 1000) - rawHaul);
                target.refined_goods = Math.max(0, (target.refined_goods || 1000) - refinedHaul);
                target.health = Math.max(0, target.health - 1);

                // Distinct contraband effects on the local populace:
                let unrestDelta = 0;
                let heatDelta = 3;

                if (cartel.id === 10) {
                    // Hedge Wizards: Supply unsanctioned magic charms, healing poultices & wards
                    // Citizens gain relief from disease and dragon omens, lowering unrest
                    unrestDelta = -3;
                    heatDelta = 5; // Inquisitors and Mandate zealots are furious at visible heresy
                } else if (cartel.id === 7) {
                    // Otter Mafia: Distribute smuggled eel-wine & gambling dice
                    unrestDelta = 1;
                    heatDelta = 3;
                } else if (cartel.id === 6) {
                    // Obsidian Cartel: Sells black-glass daggers & chaos shards to dissidents
                    unrestDelta = 2;
                    heatDelta = 4;
                } else if (cartel.id === 9) {
                    // Grind Canyon Corps: Trades raw dragonstone chips and ancient relics
                    unrestDelta = 0;
                    heatDelta = 3;
                }

                await client.query(`
                    UPDATE sim_burg_economy
                    SET wealth = GREATEST(0, wealth - $1),
                        food = GREATEST(0, food - $2),
                        raw_materials = GREATEST(0, raw_materials - $3),
                        refined_goods = GREATEST(0, refined_goods - $4),
                        unrest = LEAST(100, GREATEST(0, unrest + $5)),
                        health = GREATEST(0, health - 1),
                        crime_rate = LEAST(1.0, crime_rate + 0.02)
                    WHERE burg_id = $6
                `, [goldHaul, foodHaul, rawHaul, refinedHaul, unrestDelta, target.burg_id]);

                // Hustling in a burg where this cartel holds a lair increases local heat
                await client.query(
                    `UPDATE sim_fringe_lairs SET heat = LEAST(100, heat + $1) WHERE burg_id = $2 AND faction_id = $3`,
                    [heatDelta, target.burg_id, cartel.id]
                );
            }
        }

        // --- RESOLVE DEPLOYMENT ---
        if (successfulRecruits > 0 || hustleWealth > 0) {
            await client.query(
                `UPDATE sim_outlaw_factions SET worker_groups = worker_groups + $1, wealth = COALESCE(wealth, 0) + $2 WHERE id = $3`,
                [successfulRecruits, hustleWealth, cartel.id]
            );
            
            if (successfulRecruits >= 5) {
                await client.query(
                    `INSERT INTO sim_events (tick, type, message, tier, faction_id, lore_date) VALUES ($1, 'CARTEL_EXPANSION', $2, 'MINOR', $3, $4)`, 
                    [tick, `${cartel.paragon.name} deployed underworld recruiters into impoverished rioting slums, absorbing ${successfulRecruits * 12} desperate laborers into ${cartel.name}!`, cartel.id, loreDate]
                );
            }
        }

        // --- LAIR ESTABLISHMENT & TURF WARS ---
        if (Number(cartel.wealth || 0) >= 500 && (Number(cartel.manpower || 0) >= 100 || Number(cartel.worker_groups || 0) >= 2)) {
            const lairBurg = burgs.find((b: any) => (b.wealth || 0) >= 180);
            if (lairBurg && Math.random() < 0.2) {
                const lairType = getCartelLairType(cartel);
                const existingLair = await client.query(
                    `SELECT id, faction_id, manpower FROM sim_fringe_lairs WHERE burg_id = $1 AND lair_type = $2`,
                    [lairBurg.burg_id, lairType]
                );
                
                if (existingLair.rows.length === 0) {
                    const inserted = await client.query(
                        `INSERT INTO sim_fringe_lairs (faction_id, cell_id, burg_id, lair_type, manpower, heat)
                         VALUES ($1, $2, $3, $4, $5, 10) RETURNING *`,
                        [cartel.id, lairBurg.cell_id, lairBurg.burg_id, lairType, 50]
                    );
                    const newLair = inserted.rows[0];
                    await ensureLairResidents(client, { ...newLair, cartel_name: cartel.name, cartel_type: cartel.type });

                    const insideManRes = await client.query(
                        `SELECT name, profession FROM population_demographics WHERE settlement_id = $1 AND traits::text LIKE '%#InsideMan%' LIMIT 1`,
                        [lairBurg.burg_id]
                    );
                    const insideText = insideManRes.rows.length > 0 
                        ? ` aided by inside operative ${insideManRes.rows[0].name} (${insideManRes.rows[0].profession}) who unlocked the cellar flues,`
                        : '';

                    await client.query(
                        `INSERT INTO sim_events (tick, type, message, tier, faction_id, burg_id, lore_date)
                         VALUES ($1, 'LAIR_ESTABLISHED', $2, 'MINOR', $3, $4, $5)`,
                        [tick, `${cartel.name} established an independent ${lairType} in Burg ${lairBurg.name || lairBurg.burg_id}${insideText} to siphon resources and traffic contraband!`, cartel.id, lairBurg.burg_id, loreDate]
                    );
                } else if (existingLair.rows[0].faction_id !== cartel.id) {
                    const defender = existingLair.rows[0];
                    const attackerPower = Number(cartel.manpower || 100);
                    const defenderPower = Number(defender.manpower || 50);
                    if (attackerPower >= defenderPower) {
                        // Mark defender resident NPCs as displaced
                        await client.query(
                            `UPDATE sim_npc_instances SET alive = false, role = 'Displaced ' || role, updated_at = NOW() WHERE id LIKE 'npc_outlaw_' || $1 || '_%'`,
                            [defender.id]
                        );
                        await client.query(`DELETE FROM sim_fringe_lairs WHERE id = $1`, [defender.id]);

                        const inserted = await client.query(
                            `INSERT INTO sim_fringe_lairs (faction_id, cell_id, burg_id, lair_type, manpower, heat)
                             VALUES ($1, $2, $3, $4, $5, 30) RETURNING *`,
                            [cartel.id, lairBurg.cell_id, lairBurg.burg_id, lairType, Math.floor(attackerPower * 0.7)]
                        );
                        const newLair = inserted.rows[0];
                        await ensureLairResidents(client, { ...newLair, cartel_name: cartel.name, cartel_type: cartel.type });

                        await client.query(
                            `INSERT INTO sim_events (tick, type, message, tier, faction_id, burg_id, lore_date)
                             VALUES ($1, 'TURF_WAR', $2, 'MAJOR', $3, $4, $5)`,
                            [tick, `Turf War erupted in Burg ${lairBurg.name || lairBurg.burg_id}! ${cartel.name} violently seized control of the ${lairType} from a rival syndicate!`, cartel.id, lairBurg.burg_id, loreDate]
                        );
                    }
                }
            }
        }
    }

    // 3. Unofficial Mercenary Sabotage Contracts (Factions Covertly Disrupting Rivals)
    if (tick % 2 === 0) {
        const hiringFactionsRes = await client.query(`
            SELECT id, name, treasury FROM sim_factions
            WHERE id > 0 AND treasury > 6000 AND trait_aggression >= 4
            ORDER BY RANDOM() LIMIT 2
        `);

        for (const hiringFaction of hiringFactionsRes.rows) {
            // Find an enemy target faction
            const targetFactionRes = await client.query(`
                SELECT id, name FROM sim_factions
                WHERE id > 0 AND id != $1
                ORDER BY RANDOM() LIMIT 1
            `, [hiringFaction.id]);

            if (targetFactionRes.rows.length > 0) {
                const targetFaction = targetFactionRes.rows[0];
                const victimBurgRes = await client.query(`
                    SELECT b.burg_id, b.name, b.wealth, b.food
                    FROM sim_burg_economy b
                    JOIN sim_cells c ON c.id = b.cell_id
                    WHERE c.faction_id = $1 AND b.wealth > 100
                    ORDER BY RANDOM() LIMIT 1
                `, [targetFaction.id]);

                if (victimBurgRes.rows.length > 0) {
                    const victimBurg = victimBurgRes.rows[0];
                    // Pick an independent mercenary syndicate (Devil's Choice, Ivory-Gate, or Ghostwind Raiders)
                    const mercId = [3, 4, 5][Math.floor(Math.random() * 3)]!;
                    const mercRes = await client.query(`SELECT id, name FROM sim_outlaw_factions WHERE id = $1`, [mercId]);
                    const merc = mercRes.rows[0];

                    if (merc) {
                        const fee = 400;
                        await client.query(`UPDATE sim_factions SET treasury = treasury - $1 WHERE id = $2`, [fee, hiringFaction.id]);
                        await client.query(`UPDATE sim_outlaw_factions SET wealth = wealth + $1 WHERE id = $2`, [fee, merc.id]);

                        // Inflict covert sabotage on the rival burg
                        await client.query(`
                            UPDATE sim_burg_economy
                            SET wealth = GREATEST(0, wealth - 160),
                                food = GREATEST(0, food - 120),
                                unrest = LEAST(100, unrest + 16),
                                crime_rate = LEAST(1.0, crime_rate + 0.05)
                            WHERE burg_id = $1
                        `, [victimBurg.burg_id]);

                        await client.query(`
                            INSERT INTO sim_events (tick, type, message, tier, faction_id, burg_id, lore_date)
                            VALUES ($1, 'COVERT_MERCENARY_SABOTAGE', $2, 'MAJOR', $3, $4, $5)
                        `, [
                            tick,
                            `🕵️ COVERT SABOTAGE: Contracted under the table by a rival court, ${merc.name} operatives ambushed food shipments and burned granaries in Burg ${victimBurg.name} (${targetFaction.name}), sowing civil panic!`,
                            merc.id,
                            victimBurg.burg_id,
                            loreDate
                        ]);
                    }
                }
            }
        }
    }

    // 4. Heat Resolution, Bribery & City Watch Raids
    const allLairsRes = await client.query(`
        SELECT l.id, l.faction_id, l.cell_id, l.burg_id, l.lair_type, l.manpower, l.heat,
               o.name AS cartel_name, o.wealth AS cartel_wealth,
               b.name AS burg_name, b.unrest AS burg_unrest
        FROM sim_fringe_lairs l
        JOIN sim_outlaw_factions o ON o.id = l.faction_id
        LEFT JOIN sim_burg_economy b ON b.burg_id = l.burg_id
    `);

    for (const lair of allLairsRes.rows) {
        let currentHeat = Number(lair.heat || 0);

        // A. Natural Heat Decay
        currentHeat = Math.max(0, currentHeat - 2);

        // B. Bribery Resolution (Heat >= 60)
        const cartelWealth = Number(lair.cartel_wealth || 0);
        if (currentHeat >= 60 && cartelWealth >= 150) {
            // 75% chance corrupt magistrate takes the bribe
            if (Math.random() < 0.75) {
                currentHeat = Math.max(0, currentHeat - 25);
                await client.query(
                    `UPDATE sim_outlaw_factions SET wealth = GREATEST(0, wealth - 150) WHERE id = $1`,
                    [lair.faction_id]
                );
                await client.query(
                    `INSERT INTO sim_events (tick, type, message, tier, faction_id, burg_id, lore_date)
                     VALUES ($1, 'CORRUPTION_BRIBE', $2, 'MINOR', $3, $4, $5)`,
                    [
                        tick,
                        `${lair.cartel_name} bribed the magistrate of Burg ${lair.burg_name || lair.burg_id} for 150 gold, concealing their ${lair.lair_type} and reducing Heat to ${currentHeat}.`,
                        lair.faction_id,
                        lair.burg_id,
                        loreDate
                    ]
                );
            }
        }

        // C. Municipal City Watch Raid Resolution (Heat >= 75)
        if (currentHeat >= 75) {
            const raidSuccess = Math.random() < 0.5;
            if (raidSuccess) {
                // City Watch raids and dismantles the lair: arrest resident operatives
                await client.query(
                    `UPDATE sim_npc_instances SET alive = false, role = 'Arrested ' || role, updated_at = NOW() WHERE id LIKE 'npc_outlaw_' || $1 || '_%'`,
                    [lair.id]
                );
                await client.query(`DELETE FROM sim_fringe_lairs WHERE id = $1`, [lair.id]);
                await client.query(
                    `UPDATE sim_outlaw_factions SET manpower = GREATEST(0, manpower - 20) WHERE id = $1`,
                    [lair.faction_id]
                );
                await client.query(
                    `INSERT INTO sim_events (tick, type, message, tier, faction_id, burg_id, lore_date)
                     VALUES ($1, 'CITY_WATCH_RAID', $2, 'MAJOR', $3, $4, $5)`,
                    [
                        tick,
                        `The City Watch of Burg ${lair.burg_name || lair.burg_id} stormed and dismantled the hidden ${lair.lair_type} operated by ${lair.cartel_name}, arresting their syndicate operatives!`,
                        lair.faction_id,
                        lair.burg_id,
                        loreDate
                    ]
                );
                continue; // Lair dismantled
            } else {
                // Street skirmish: Lair survives, heat resets to 45, unrest spikes
                currentHeat = 45;
                await client.query(
                    `UPDATE sim_burg_economy SET unrest = LEAST(100, unrest + 15) WHERE burg_id = $1`,
                    [lair.burg_id]
                );
                await client.query(
                    `UPDATE sim_outlaw_factions SET manpower = GREATEST(0, manpower - 10) WHERE id = $1`,
                    [lair.faction_id]
                );
                await client.query(
                    `INSERT INTO sim_events (tick, type, message, tier, faction_id, burg_id, lore_date)
                     VALUES ($1, 'STREET_SKIRMISH', $2, 'MAJOR', $3, $4, $5)`,
                    [
                        tick,
                        `Violent skirmish in Burg ${lair.burg_name || lair.burg_id}! Armed enforcers of ${lair.cartel_name} repelled a City Watch raid on their ${lair.lair_type}, spiking civil unrest!`,
                        lair.faction_id,
                        lair.burg_id,
                        loreDate
                    ]
                );
            }
        }

        // D. Update final heat for active lair
        await client.query(`UPDATE sim_fringe_lairs SET heat = $1 WHERE id = $2`, [currentHeat, lair.id]);
    }
}
