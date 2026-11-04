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
                const actionSeed = (tick + p.id + burg.burg_id) % 12;

                if (burg.food < pop * 4) {
                    // Emergency Grain Silos & Subsidies
                    foodDelta += Math.floor(pop * 0.15) + 300;
                    wealthDelta -= 20;
                    events.push({
                        burg_id: burg.burg_id,
                        type: "MAYOR_EXPAND_GRANARY",
                        tier: "MINOR",
                        msg: `Mayor ${p.name} commissioned massive reinforced timber grain silos in ${burg.name}, expanding municipal reserves to protect against famine.`
                    });
                    await tagBurgCitizens(client, burg.burg_id, ['#GranaryCarpenter', '#GrainSubsidyRecipient'], 'RELIEVED', `Receiving municipal grain rations and constructing emergency silos under Mayor ${p.name}.`, '%laborer%', 3);
                } else if (burg.unrest > 20 && (tick + p.id) % 4 === 0) {
                    // Civic Market Festival
                    unrestDelta -= 16;
                    wealthDelta -= 40;
                    events.push({
                        burg_id: burg.burg_id,
                        type: "MAYOR_CIVIC_FESTIVAL",
                        tier: "MINOR",
                        msg: `Mayor ${p.name} funded a grand market festival in ${burg.name}, distributing spiced ale, roast meats, and cider to soothe civil unrest.`
                    });
                    await tagBurgCitizens(client, burg.burg_id, ['#FestivalReveler', '#CivicPride'], 'JOVIAL', `Drinking and dancing at the municipal festival hosted by Mayor ${p.name}.`, null, 4);
                } else if (burg.health < 80 && (tick + p.id) % 5 === 0) {
                    // Aqueduct & Stone Cisterns
                    healthDelta += 8;
                    wealthDelta -= 60;
                    events.push({
                        burg_id: burg.burg_id,
                        type: "MAYOR_AQUEDUCT_CISTERN",
                        tier: "MINOR",
                        msg: `Mayor ${p.name} funded the construction of mountain aqueducts and stone cisterns in ${burg.name}, delivering clean spring water to common districts.`
                    });
                    await tagBurgCitizens(client, burg.burg_id, ['#AqueductMason'], 'INDUSTRIOUS', `Dressing stone channels and laying clean water conduits for Mayor ${p.name}'s aqueduct project.`, '%mason%', 3);
                } else if (burg.port > 0 && actionSeed === 0) {
                    // Harbor & Deepwater Quays
                    wealthDelta += 80;
                    events.push({
                        burg_id: burg.burg_id,
                        type: "MAYOR_HARBOR_EXPANSION",
                        tier: "MINOR",
                        msg: `Mayor ${p.name} dredged the harbor basin and constructed deepwater timber quays in ${burg.name}, welcoming heavy merchant galleons.`
                    });
                    await tagBurgCitizens(client, burg.burg_id, ['#DockBuilder'], 'INDUSTRIOUS', `Framing timber docks and driving pilings for the new harbor quays in ${burg.name}.`, '%carpenter%', 3);
                } else if (actionSeed === 1) {
                    // Artisan Master Guildhall
                    wealthDelta += 50;
                    healthDelta += 2;
                    events.push({
                        burg_id: burg.burg_id,
                        type: "MAYOR_ARTISAN_GUILDHALL",
                        tier: "MINOR",
                        msg: `Mayor ${p.name} chartered a grand Artisan Guildhall in ${burg.name}, uniting master blacksmiths, glassblowers, and weavers.`
                    });
                    await tagBurgCitizens(client, burg.burg_id, ['#GuildCraftsman'], 'PROSPEROUS', `Forging fine masterworks under the charter of Mayor ${p.name}'s new Artisan Guildhall.`, '%smith%', 3);
                } else if (actionSeed === 2) {
                    // Scribe Academy & Civic Archive
                    crimeDelta -= 10;
                    wealthDelta -= 30;
                    events.push({
                        burg_id: burg.burg_id,
                        type: "MAYOR_ACADEMY_SCRIBES",
                        tier: "MINOR",
                        msg: `Mayor ${p.name} founded a municipal Scribe Academy and Archive in ${burg.name}, recording commercial ledgers and land titles.`
                    });
                    await tagBurgCitizens(client, burg.burg_id, ['#AcademyScholar'], 'SCHOLARLY', `Transcribing legal deeds and guild charters in the municipal scribe hall of ${burg.name}.`, '%scribe%', 2);
                } else if (actionSeed === 3) {
                    // Fortified Citadel Ramparts
                    unrestDelta -= 5;
                    wealthDelta -= 80;
                    events.push({
                        burg_id: burg.burg_id,
                        type: "MAYOR_CITADEL_RAMPARTS",
                        tier: "MINOR",
                        msg: `Mayor ${p.name} reinforced the perimeter ramparts, moat drawbridges, and wall bastions around ${burg.name}.`
                    });
                    await tagBurgCitizens(client, burg.burg_id, ['#RampartSentry'], 'WARY', `Standing watch on the newly reinforced stone ramparts of ${burg.name}.`, '%watch%', 3);
                } else if (actionSeed === 4) {
                    // Seasonal Merchant Tariff Holiday
                    wealthDelta += 100;
                    events.push({
                        burg_id: burg.burg_id,
                        type: "MAYOR_TAX_HOLIDAY",
                        tier: "MINOR",
                        msg: `Mayor ${p.name} declared a seasonal merchant tariff holiday in ${burg.name}, opening duty-free pavilions for visiting trade caravans.`
                    });
                    await tagBurgCitizens(client, burg.burg_id, ['#CaravanTrader'], 'PROSPEROUS', `Selling imported fabrics and spices at the duty-free market pavilions in ${burg.name}.`, '%trader%', 3);
                } else if (actionSeed === 5) {
                    // City Watch Barracks Commission
                    crimeDelta -= 12;
                    wealthDelta -= 50;
                    events.push({
                        burg_id: burg.burg_id,
                        type: "MAYOR_BARRACKS_COMMISSION",
                        tier: "MINOR",
                        msg: `Mayor ${p.name} commissioned new city watch barracks in ${burg.name}, equipping two additional squads of armored halberdiers.`
                    });
                    await tagBurgCitizens(client, burg.burg_id, ['#BarracksGuard'], 'DEVOUT', `Drilling with halberds at the newly commissioned city watch barracks in ${burg.name}.`, '%watch%', 3);
                } else if (actionSeed === 6) {
                    // Public Health & Sanitation
                    healthDelta += 8;
                    wealthDelta -= 40;
                    events.push({
                        burg_id: burg.burg_id,
                        type: "MAYOR_PUBLIC_SANITATION",
                        tier: "MINOR",
                        msg: `Mayor ${p.name} directed street-cleansing brigades and apothecary subsidies across ${burg.name}, eradicating disease from the lower quarters.`
                    });
                    await tagBurgCitizens(client, burg.burg_id, ['#SanitationWorker'], 'INDUSTRIOUS', `Clearing canal drains and lime-washing streets under Mayor ${p.name}'s sanitation edict.`, '%laborer%', 3);
                } else if (actionSeed === 7) {
                    // Terraced Agricultural Outskirts
                    foodDelta += 450;
                    wealthDelta -= 50;
                    events.push({
                        burg_id: burg.burg_id,
                        type: "MAYOR_TERRACED_FARMLAND",
                        tier: "MINOR",
                        msg: `Mayor ${p.name} cleared surrounding foothills for terraced olive groves, vineyards, and barley fields around ${burg.name}.`
                    });
                    await tagBurgCitizens(client, burg.burg_id, ['#TerraceFarmer'], 'INDUSTRIOUS', `Cultivating terraced barley fields on the foothills of ${burg.name}.`, '%farmer%', 3);
                } else {
                    // Municipal Mint & Stamped Currency
                    wealthDelta += 80;
                    events.push({
                        burg_id: burg.burg_id,
                        type: "MAYOR_MUNICIPAL_MINT",
                        tier: "MINOR",
                        msg: `Mayor ${p.name} struck new municipal stamped silver coinage in ${burg.name}, standardizing currency and driving civic commerce.`
                    });
                    await tagBurgCitizens(client, burg.burg_id, ['#MintAssayer'], 'SCHOLARLY', `Assaying bullion and striking stamped trade coins at the municipal mint of ${burg.name}.`, '%smith%', 2);
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
