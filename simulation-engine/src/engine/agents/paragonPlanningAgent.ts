import { tagBurgCitizens } from "./citizenPersonaHelper";

export async function runLocalParagonAgent(client: any, tick: number, loreDate: string = "") {
    const burgRes = await client.query("SELECT * FROM sim_burg_economy");
    const paragonRes = await client.query("SELECT * FROM sim_paragons");
    
    // Group paragons by burg
    const paragonsByBurg = new Map<number, any[]>();
    for (const p of paragonRes.rows) {
        if (!paragonsByBurg.has(p.burg_id)) paragonsByBurg.set(p.burg_id, []);
        paragonsByBurg.get(p.burg_id)!.push(p);
    }

    const burgUpdates: any[] = [];
    const events: any[] = [];

    for (const burg of burgRes.rows) {
        const pop = burg.pop_null || 0;
        if (pop <= 0) continue;

        // Baseline Needs Assessment (0 - 100)
        let baseSurvival = 0;
        if (burg.food < pop) {
            baseSurvival = 100 - ((Math.max(0, burg.food) / pop) * 100); 
        }
        let baseProtection = burg.crime_rate || 0;
        let basePleasure = (burg.unrest || 0) * 0.5 + ((100 - (burg.health || 100)) * 0.5);

        // Action Results Trackers
        let foodDelta = 0;
        let wealthDelta = 0;
        let crimeDelta = 0;
        let unrestDelta = 0;
        let healthDelta = 0;

        const myParagons = paragonsByBurg.get(burg.burg_id) || [];

        // Action Execution (Each Paragon takes their turn every tick)
        for (const p of myParagons) {
            const domain = p.domain || (p.title?.includes("Commander") || p.title?.includes("Marshal") || p.title?.includes("Captain") || p.title?.includes("Warden") ? 'Security' : 'Civil');
            let survMult = 1.0;
            let protMult = 1.0;
            let pleasMult = 1.0;
            try {
                const traits = typeof p.traits === 'string' ? JSON.parse(p.traits) : p.traits;
                if (Array.isArray(traits)) {
                    for (const t of traits) {
                        const name = (t.name || "").toLowerCase();
                        const mod = Math.abs(t.modifier || 0.2);
                        if (name.includes("paranoid") || name.includes("vigilant")) protMult += mod;
                        if (name.includes("greedy") || name.includes("harsh")) pleasMult -= mod;
                        if (name.includes("agrarian") || name.includes("stoic") || name.includes("generous")) survMult += mod;
                    }
                }
            } catch (e) {}

            // Apply their specific trait multipliers
            const effSurvival = baseSurvival * (p.survival_mult || survMult);
            const effProtection = baseProtection * (p.protection_mult || protMult);
            const effPleasure = basePleasure * (p.pleasure_mult || pleasMult);

            // ==========================================
            // 1. CIVIL PARAGONS (MAYORS, REEVES, MAGISTRATES)
            // ==========================================
            if (domain === 'Civil') {
                if (effSurvival > 60 || burg.food < pop * 3) {
                    foodDelta += Math.floor(pop * 0.12);
                    wealthDelta -= 25;
                    events.push({
                        burg_id: burg.burg_id,
                        type: "MAYOR_GRAIN_SUBSIDY",
                        tier: "MINOR",
                        msg: `Mayor ${p.name} of ${burg.name} released emergency municipal grain stockpiles to lower market bread prices.`
                    });
                    await tagBurgCitizens(client, burg.burg_id, ['#GrainSubsidyRecipient'], 'RELIEVED', `Receiving municipal grain rations from Mayor ${p.name}'s emergency relief.`, '%laborer%', 3);
                } else if (burg.unrest > 25 && burg.wealth > 150 && (tick + p.id) % 5 === 0) {
                    unrestDelta -= 15;
                    wealthDelta -= 60;
                    events.push({
                        burg_id: burg.burg_id,
                        type: "MAYOR_CIVIC_FESTIVAL",
                        tier: "MINOR",
                        msg: `Mayor ${p.name} funded a municipal market festival in ${burg.name}, distributing spiced ale and cider to soothe civil unrest.`
                    });
                    await tagBurgCitizens(client, burg.burg_id, ['#FestivalReveler', '#CivicPride'], 'JOVIAL', `Drinking and dancing at the municipal festival hosted by Mayor ${p.name}.`, null, 4);
                } else if (burg.wealth > 1500 && (tick + p.id) % 8 === 0) {
                    wealthDelta -= 120;
                    healthDelta += 4;
                    events.push({
                        burg_id: burg.burg_id,
                        type: "MAYOR_PUBLIC_WORKS",
                        tier: "MINOR",
                        msg: `Mayor ${p.name} launched public infrastructure works in ${burg.name}, contracting mason guilds to repair canal walls and repave markets.`
                    });
                    await tagBurgCitizens(client, burg.burg_id, ['#PublicWorksContractor'], 'INDUSTRIOUS', `Earning coin on city infrastructure projects funded by Mayor ${p.name}.`, '%mason%', 3);
                } else if (effProtection > 60 && (tick + p.id) % 6 === 0) {
                    crimeDelta -= 8;
                    wealthDelta -= 10;
                    events.push({
                        burg_id: burg.burg_id,
                        type: "MAYOR_TAX_AUDIT",
                        tier: "MINOR",
                        msg: `Mayor ${p.name} conducted surprise audits of guild accounts and trade warehouses across ${burg.name}.`
                    });
                    await tagBurgCitizens(client, burg.burg_id, ['#AuditedMerchant'], 'WARY', `Having their ledger books audited by Mayor ${p.name}'s clerks.`, '%trader%', 3);
                } else if ((tick + p.id) % 9 === 0) {
                    wealthDelta += 30;
                    events.push({
                        burg_id: burg.burg_id,
                        type: "MAYOR_COMMERCE_CHARTER",
                        tier: "MINOR",
                        msg: `Mayor ${p.name} issued new merchant licenses in ${burg.name}, opening prime market stalls along the high street.`
                    });
                } else {
                    wealthDelta += 15;
                }
            } 

            // ==========================================
            // 2. SECURITY PARAGONS (COMMANDERS, MARSHALS, CAPTAINS)
            // ==========================================
            else if (domain === 'Security') {
                if (burg.unrest >= 40) {
                    unrestDelta -= 8;
                    crimeDelta -= 12;
                    foodDelta += Math.floor(pop * 0.05);
                    if ((tick + p.id) % 4 === 0) {
                        events.push({
                            burg_id: burg.burg_id,
                            type: "COMMANDER_CURFEW_ENFORCEMENT",
                            tier: "MAJOR",
                            msg: `Commander ${p.name} declared mandatory nightfall curfews in ${burg.name}, deploying armored guards to lock all gates.`
                        });
                        await tagBurgCitizens(client, burg.burg_id, ['#CurfewDefier'], 'REBELLIOUS', `Evading Commander ${p.name}'s watch patrols in the shadowed alleys of ${burg.name}.`, '%laborer%', 3);
                        await tagBurgCitizens(client, burg.burg_id, ['#CurfewEnforcer'], 'WARY', `Enforcing Commander ${p.name}'s strict curfew orders.`, '%watch%', 3);
                    }
                } else if (burg.crime_rate > 25 && (tick + p.id) % 5 === 0) {
                    crimeDelta -= 15;
                    events.push({
                        burg_id: burg.burg_id,
                        type: "COMMANDER_CONTRABAND_RAID",
                        tier: "MINOR",
                        msg: `Commander ${p.name} led a city watch raid on an unlicensed dockside warehouse in ${burg.name}, seizing smuggled contraband.`
                    });
                    await tagBurgCitizens(client, burg.burg_id, ['#SmugglingSuspect'], 'FEARFUL', `Lying low after Commander ${p.name}'s watchmen raided a nearby warehouse.`, '%thief%', 3);
                } else if ((tick + p.id) % 7 === 0) {
                    unrestDelta -= 3;
                    events.push({
                        burg_id: burg.burg_id,
                        type: "COMMANDER_GARRISON_DRILL",
                        tier: "MINOR",
                        msg: `Commander ${p.name} conducted military drills for the garrison and wall archers in ${burg.name}.`
                    });
                    await tagBurgCitizens(client, burg.burg_id, ['#GarrisonDrilled'], 'DEVOUT', `Drilling with shields and spears on the ramparts under Commander ${p.name}.`, '%watch%', 3);
                } else {
                    crimeDelta -= 8;
                }
            }

            // ==========================================
            // 3. SOCIAL & SPIRITUAL PARAGONS (PRIESTS, GUILDMASTERS)
            // ==========================================
            else if (domain === 'Social') {
                if (burg.health < 70) {
                    healthDelta += 8;
                    if ((tick + p.id) % 5 === 0) {
                        events.push({
                            burg_id: burg.burg_id,
                            type: "TEMPLE_HEALING_ALMS",
                            tier: "MINOR",
                            msg: `Spiritual leader ${p.name} opened the temple sanctuary in ${burg.name}, providing free healing draughts and herbal broth to the sick.`
                        });
                        await tagBurgCitizens(client, burg.burg_id, ['#TemplePatient', '#AlmsRecipient'], 'GRATEFUL', `Receiving care and herbal draughts at the temple of ${burg.name}.`, null, 3);
                    }
                } else if (burg.unrest > 20 && (tick + p.id) % 6 === 0) {
                    unrestDelta -= 12;
                    events.push({
                        burg_id: burg.burg_id,
                        type: "FAITH_CONGREGATION",
                        tier: "MINOR",
                        msg: `Spiritual elder ${p.name} led a solemn vigil and prayer procession through the central plaza of ${burg.name}, calming the anxious populace.`
                    });
                    await tagBurgCitizens(client, burg.burg_id, ['#PiousWorshiper'], 'PEACEFUL', `Praying for civic peace and divine blessings in ${burg.name}.`, null, 3);
                } else if ((tick + p.id) % 8 === 0) {
                    wealthDelta += 30;
                    events.push({
                        burg_id: burg.burg_id,
                        type: "GUILD_PRICE_ACCORD",
                        tier: "MINOR",
                        msg: `Guildmaster ${p.name} convened an artisan council in ${burg.name}, fixing fair exchange rates on textiles, copper, and timber.`
                    });
                    await tagBurgCitizens(client, burg.burg_id, ['#GuildSignatory'], 'INDUSTRIOUS', `Adhering to Guildmaster ${p.name}'s newly ratified price charter.`, '%artisan%', 3);
                } else {
                    healthDelta += 3;
                    unrestDelta -= 3;
                }
            }

            // ==========================================
            // 4. UNDERWORLD PARAGONS (SYNDICATE BOSSES)
            // ==========================================
            else if (domain === 'Underworld') {
                if ((tick + p.id) % 6 === 0) {
                    crimeDelta += 6;
                    unrestDelta += 3;
                    events.push({
                        burg_id: burg.burg_id,
                        type: "UNDERWORLD_SHAKEDOWN",
                        tier: "MINOR",
                        msg: `Underworld boss ${p.name} mobilized street enforcers across ${burg.name}, collecting protection coin from taverns and stalls.`
                    });
                    await tagBurgCitizens(client, burg.burg_id, ['#ExtortedMerchant', '#ProtectionPayer'], 'FEARFUL', `Paying extortion coin to ${p.name}'s syndicate enforcers.`, '%trader%', 3);
                }
            }
        }

        // Apply Deltas
        const newFood = Math.max(0, (burg.food || 0) + foodDelta);
        const newWealth = Math.max(0, (burg.wealth || 0) + wealthDelta);
        const newCrime = Math.min(100, Math.max(0, (burg.crime_rate || 0) + crimeDelta));
        const newUnrest = Math.min(100, Math.max(0, (burg.unrest || 0) + unrestDelta));
        const newHealth = Math.min(100, Math.max(0, (burg.health || 100) + healthDelta));

        burgUpdates.push({
            id: burg.burg_id,
            food: newFood,
            wealth: newWealth,
            crime: newCrime,
            unrest: newUnrest,
            health: newHealth
        });
    }

    // Bulk Update burg stats
    if (burgUpdates.length > 0) {
        await client.query(`
            UPDATE sim_burg_economy AS b SET
              food = v.food,
              wealth = v.wealth,
              crime_rate = v.crime,
              unrest = v.unrest,
              health = v.health
            FROM (
              SELECT unnest($1::int[]) as id,
                     unnest($2::int[]) as food,
                     unnest($3::int[]) as wealth,
                     unnest($4::int[]) as crime,
                     unnest($5::int[]) as unrest,
                     unnest($6::int[]) as health
            ) AS v
            WHERE b.burg_id = v.id
        `, [
            burgUpdates.map(u => u.id),
            burgUpdates.map(u => u.food),
            burgUpdates.map(u => u.wealth),
            burgUpdates.map(u => u.crime),
            burgUpdates.map(u => u.unrest),
            burgUpdates.map(u => u.health)
        ]);
    }

    if (events.length > 0) {
        for (const ev of events) {
            await client.query("INSERT INTO sim_events (tick, type, message, tier, burg_id, lore_date) VALUES ($1, $2, $3, $4, $5, $6)", 
                [tick, ev.type, ev.msg, ev.tier || 'MINOR', ev.burg_id, loreDate]);
        }
    }
}
