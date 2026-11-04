import { PoolClient } from "pg";
import { getCartelLairType, ensureLairResidents } from "./outlawSyndicates";
import { recruitInsideMan, tagBurgCitizens, tagSectorEnvironment } from "./citizenPersonaHelper";

export { getCartelLairType };

/**
 * Autonomous Fringe Factions & Underworld Syndicates Agent:
 * Faithfully executes each faction according to authentic lore & user specifications:
 *
 * 1. The Gilded Compass:
 *    - Never recruits the desperate; recruits skilled and trained personnel (shipwrights, navigators, marines).
 *    - Ships/captains are ALWAYS Hippo-Kin.
 *    - Establishes public, unhidden trade yards in foreign regions near major trade routes.
 *    - Offers commercial freight and passenger transport, buys/sells/trades directly.
 *    - Acts as naval police stopping and waylaying rival ships.
 *    - Places calculated blockades on trade corridors to choke supplies and manipulate market flow.
 *
 * 2. The Free Sky-Barons:
 *    - Independent airship captains originating from independent shippers.
 *    - Maintains secret aerie yards hidden in anyone's region.
 *    - Runs pirate raids on rival ships when holding tactical advantage.
 *    - Offers stealth transport for goods and passengers beneath cloud ceilings without being spotted.
 *    - Recruits independent captains: prospected and branded on their core drive at the Verge Sky Dock.
 *
 * 3. The Legion (Devil's Choice):
 *    - Elite mercenary and armed trade corporation headquartered on two coastal mountain peaks.
 *    - Open recruitment: accepts anyone willing and rigorously drills them into disciplined fighting machines.
 *    - Establishes forward trade bastions anywhere they are not accepted.
 *    - Strong-arms markets to enforce favorable pricing, and sells pure loyal martial muscle.
 *
 * 4. The Ghostwind Raiders:
 *    - Secret airship fleet operating under mercenary sellsword cover.
 *    - Covertly serves as the clandestine aerial arm of the Guerrilla Clans (Faction 21).
 *    - Executes precision strikes for coin while secretly routing arms and spoils to Clan territory.
 *
 * 5. The Obsidian Cartel:
 *    - Drug pushers, illegal weapons dealers, and contract assassination brokerages.
 *    - Operates through legitimate business fronts in burgs (apothecaries, gem exchanges).
 *    - Spends resources excavating subterranean smuggling tunnels and bribing city gates open.
 *    - Distributes contraband narcotics: temporarily holds/boosts happiness while degrading public health.
 *    - Arms rioters for profit during civil unrest and food shortages.
 *    - Cultivates respect and open ears among municipal magistrates and oligarchs.
 *    - Probationary recruitment: members earn full status only after proving loyalty.
 *
 * 6. The Hedge Wizards:
 *    - Solitary nomadic wanderers moving burg to burg across rural territories peddling charms.
 *    - Never recruit or group up in covens; new wizards emerge when starving sparkborn learn survival on the road.
 *    - Peddles charms across 4 tiers: useless junk, useful remedies, powerful unintentional surges, and oops disasters.
 *
 * 7-10. Otter Mafia, Grind Canyon Corps, Ivory-Gate Syndicate, Ghostspring Operation Network.
 */
export async function runCartelAgent(client: PoolClient, tick: number, loreDate: string) {
    const cartelsRes = await client.query("SELECT * FROM sim_outlaw_factions ORDER BY id ASC");
    
    // Ensure each cartel has an active Capo / Paragon
    for (const cartel of cartelsRes.rows) {
        if (cartel.worker_groups === undefined || cartel.worker_groups === null) {
            await client.query("ALTER TABLE sim_outlaw_factions ADD COLUMN IF NOT EXISTS worker_groups INT DEFAULT 3");
            await client.query("UPDATE sim_outlaw_factions SET worker_groups = 3 WHERE id = $1", [cartel.id]);
            cartel.worker_groups = 3;
        }

        const paragonRes = await client.query("SELECT * FROM sim_paragons WHERE outlaw_id = $1 LIMIT 1", [cartel.id]);
        let paragon = paragonRes.rows[0];
        if (!paragon) {
            const traits = JSON.stringify([{ name: "Ruthless", modifier: 0.2 }]);
            const newP = await client.query(
                `INSERT INTO sim_paragons (outlaw_id, burg_id, title, name, traits) VALUES ($1, $2, 'Syndicate Boss', $3, $4) RETURNING *`, 
                [cartel.id, cartel.origin_burg_id || 0, `${cartel.name} Boss`, traits]
            );
            paragon = newP.rows[0];
        }
        cartel.paragon = paragon;
    }

    const targetBurgsRes = await client.query(`
        SELECT b.burg_id, b.cell_id, b.name, b.unrest, b.pop_null, b.wealth, b.health,
               b.food, b.raw_materials, b.refined_goods, c.faction_id
        FROM sim_burg_economy b
        JOIN sim_cells c ON c.id = b.cell_id
        ORDER BY RANDOM() LIMIT 60
    `);
    const burgs = targetBurgsRes.rows;

    for (const cartel of cartelsRes.rows) {
        const cartelId = Number(cartel.id);
        const cartelName = cartel.name || "Outlaw Syndicate";

        // =========================================================================
        // 1. THE GILDED COMPASS (ID 1): Armed Privateers & Public Merchant Yards
        // =========================================================================
        if (cartelId === 1 || cartelName.includes("Compass")) {
            // A. Skilled Recruitment (Never desperate - selects navigators, shipwrights, marines)
            if (tick % 3 === 0) {
                const wealthyBurg = burgs.find(b => b.wealth > 250);
                if (wealthyBurg) {
                    await tagBurgCitizens(
                        client,
                        wealthyBurg.burg_id,
                        ['#CompassContractor', '#MeridianNavigator'],
                        'CALCULATED',
                        `Under contract with the Gilded Compass armed merchant fleet as a skilled navigator and logistics factor.`,
                        '%artisan%',
                        1
                    );

                    await client.query(`
                        INSERT INTO sim_events (tick, type, message, tier, faction_id, burg_id, lore_date)
                        VALUES ($1, 'COMPASS_SKILLED_RECRUITMENT', $2, 'MINOR', $3, $4, $5)
                    `, [
                        tick,
                        `⚓ GILDED COMPASS COMMISSION: Fleet Commodore Cassian Midas (Hippo-Kin) commissioned a master shipwright and two veteran navigators in ${wealthyBurg.name} to overhaul high-tonnage merchant galleasses.`,
                        cartel.id, wealthyBurg.burg_id, loreDate
                    ]);
                }
            }

            // B. Public, Unhidden Trade Yard Construction
            await handleLairEstablishment(client, cartel, burgs, tick, loreDate, "PUBLIC_TRADE_YARD", false);

            // C. Shipping & Commercial Transport Services
            if (tick % 2 === 0) {
                const clientBurg = burgs.find(b => b.wealth > 300);
                if (clientBurg) {
                    await client.query(`
                        UPDATE sim_burg_economy
                        SET refined_goods = refined_goods + 60,
                            wealth = wealth + 40
                        WHERE burg_id = $1
                    `, [clientBurg.burg_id]);
                    await client.query("UPDATE sim_outlaw_factions SET wealth = COALESCE(wealth, 0) + 160 WHERE id = $1", [cartel.id]);

                    await client.query(`
                        INSERT INTO sim_events (tick, type, message, tier, faction_id, burg_id, lore_date)
                        VALUES ($1, 'COMPASS_SHIPPING_CONTRACT', $2, 'MINOR', $3, $4, $5)
                    `, [
                        tick,
                        `🚢 COMMERCIAL FREIGHT: Hippo-captained merchant galleasses of the Gilded Compass fulfilled a scheduled commercial shipping contract into ${clientBurg.name}, delivering high-value cargo and collecting transport fees.`,
                        cartel.id, clientBurg.burg_id, loreDate
                    ]);
                }
            }

            // D. Direct Buy, Sell & Trade Arbitrage
            if (tick % 3 === 0) {
                const tradeBurg = burgs.find(b => b.raw_materials > 100);
                if (tradeBurg) {
                    await client.query(`
                        UPDATE sim_burg_economy SET raw_materials = GREATEST(0, raw_materials - 80), wealth = wealth + 50 WHERE burg_id = $1
                    `, [tradeBurg.burg_id]);
                    await client.query("UPDATE sim_outlaw_factions SET wealth = COALESCE(wealth, 0) + 130 WHERE id = $1", [cartel.id]);

                    await client.query(`
                        INSERT INTO sim_events (tick, type, message, tier, faction_id, burg_id, lore_date)
                        VALUES ($1, 'COMPASS_MARKET_ARBITRAGE', $2, 'MINOR', $3, $4, $5)
                    `, [
                        tick,
                        `⚖️ COMMERCE ARBITRAGE: Gilded Compass factors bought surplus raw commodities at bulk discount in ${tradeBurg.name} to resell at monopoly rates across overseas trade hubs.`,
                        cartel.id, tradeBurg.burg_id, loreDate
                    ]);
                }
            }

            // E. Naval Police & Waylaying Rival Ships
            if (tick % 4 === 0) {
                const coastalBurg = burgs.find(b => b.wealth > 350);
                if (coastalBurg) {
                    await client.query("UPDATE sim_outlaw_factions SET wealth = COALESCE(wealth, 0) + 180 WHERE id = $1", [cartel.id]);

                    await client.query(`
                        INSERT INTO sim_events (tick, type, message, tier, faction_id, burg_id, lore_date)
                        VALUES ($1, 'COMPASS_NAVAL_INSPECTION', $2, 'MAJOR', $3, $4, $5)
                    `, [
                        tick,
                        `⚓ NAVAL POLICING WAYLAY: An armed Gilded Compass war-sloop waylaid and boarded an unregistered foreign merchantman outside ${coastalBurg.name}. Heavy Hippo-Kin marines seized contraband cargo under armed inspection authority!`,
                        cartel.id, coastalBurg.burg_id, loreDate
                    ]);
                }
            }

            // F. Trade Route Blockades & Market Flow Manipulation
            if (tick % 5 === 0) {
                const targetBurg = burgs.find(b => b.wealth > 400 && b.food > 100);
                if (targetBurg) {
                    await client.query(`
                        UPDATE sim_burg_economy
                        SET food = GREATEST(0, food - 120),
                            unrest = LEAST(100, unrest + 6)
                        WHERE burg_id = $1
                    `, [targetBurg.burg_id]);
                    await client.query("UPDATE sim_outlaw_factions SET wealth = COALESCE(wealth, 0) + 240 WHERE id = $1", [cartel.id]);

                    await tagBurgCitizens(
                        client,
                        targetBurg.burg_id,
                        ['#CompassBlockaded', '#MarketShortage'],
                        'BITTER',
                        `Enduring severe commodity inflation and shortages caused by Gilded Compass naval trade blockades.`,
                        '%merchant%',
                        2
                    );

                    await client.query(`
                        INSERT INTO sim_events (tick, type, message, tier, faction_id, burg_id, lore_date)
                        VALUES ($1, 'COMPASS_TRADE_BLOCKADE', $2, 'MAJOR', $3, $4, $5)
                    `, [
                        tick,
                        `🚫 TRADE ROUTE BLOCKADE: Gilded Compass privateer squadrons imposed an iron blockade across maritime shipping lanes into ${targetBurg.name}, choking food provisions to artificially inflate market prices and force trade concessions!`,
                        cartel.id, targetBurg.burg_id, loreDate
                    ]);
                }
            }
        }

        // =========================================================================
        // 2. THE FREE SKY-BARONS (ID 2): Independent Airships & Secret Aeries
        // =========================================================================
        else if (cartelId === 2 || cartelName.includes("Sky-Barons") || cartelName.includes("Sky Baron")) {
            // A. Prospecting & Core Drive Branding at Verge Sky Dock
            if (tick % 3 === 0) {
                const recruitBurg = burgs.find(b => b.unrest >= 5 || b.wealth > 150);
                if (recruitBurg) {
                    await client.query(`UPDATE sim_outlaw_factions SET manpower = manpower + 1 WHERE id = $1`, [cartel.id]);

                    await client.query(`
                        INSERT INTO sim_events (tick, type, message, tier, faction_id, burg_id, lore_date)
                        VALUES ($1, 'SKY_BARON_CORE_BRANDING', $2, 'MAJOR', $3, $4, $5)
                    `, [
                        tick,
                        `🔥 CORE DRIVE BRANDING: Independent airship captain Dax Hawthorne of ${recruitBurg.name} was prospected by the Free Sky-Barons and brought to the capital dock near the Verge. Their airship core drive was branded with the brotherhood glyph before being assigned patrol territory!`,
                        cartel.id, recruitBurg.burg_id, loreDate
                    ]);
                }
            }

            // B. Build Secret Aerie Yards (Strictly Secret)
            await handleLairEstablishment(client, cartel, burgs, tick, loreDate, "SECRET_AERIE_YARD", true);

            // C. Stealth Transport (Goods & People undetected beneath clouds)
            if (tick % 2 === 0) {
                const destBurg = burgs.find(b => b.wealth > 200);
                if (destBurg) {
                    await client.query("UPDATE sim_outlaw_factions SET wealth = COALESCE(wealth, 0) + 120 WHERE id = $1", [cartel.id]);

                    await client.query(`
                        INSERT INTO sim_events (tick, type, message, tier, faction_id, burg_id, lore_date)
                        VALUES ($1, 'SKY_BARON_STEALTH_TRANSPORT', $2, 'MINOR', $3, $4, $5)
                    `, [
                        tick,
                        `🌫️ STEALTH AIRSHIP TRANSPORT: Slipped beneath cloud cover, a Free Sky-Baron cloud-skiff transported high-profile fugitives and unmanifested cargo into ${destBurg.name} without being detected by sovereign airship patrols.`,
                        cartel.id, destBurg.burg_id, loreDate
                    ]);
                }
            }

            // D. Pirate Raids on Rival Ships (When Holding Advantage)
            if (tick % 4 === 0) {
                const victimBurg = burgs.find(b => b.wealth > 350);
                if (victimBurg) {
                    const loot = 85;
                    await client.query(`
                        UPDATE sim_burg_economy
                        SET wealth = GREATEST(0, wealth - $1),
                            unrest = LEAST(100, unrest + 4)
                        WHERE burg_id = $2
                    `, [loot, victimBurg.burg_id]);
                    await client.query("UPDATE sim_outlaw_factions SET wealth = COALESCE(wealth, 0) + $1 WHERE id = $2", [loot, cartel.id]);

                    await client.query(`
                        INSERT INTO sim_events (tick, type, message, tier, faction_id, burg_id, lore_date)
                        VALUES ($1, 'SKY_BARON_PIRATE_AMBUSH', $2, 'MAJOR', $3, $4, $5)
                    `, [
                        tick,
                        `🏴‍☠️ AERIAL PIRATE AMBUSH: Catching a vulnerable merchant airship isolated in high winds near ${victimBurg.name}, Free Sky-Baron corsairs dropped from the sun, harpooned the rigging, and plundered ${loot} gold in cargo!`,
                        cartel.id, victimBurg.burg_id, loreDate
                    ]);
                }
            }
        }

        // =========================================================================
        // 3. THE LEGION / DEVIL'S CHOICE (ID 3): Mercenary & Trade Corporation
        // =========================================================================
        else if (cartelId === 3 || cartelName.includes("Legion") || cartelName.includes("Devil")) {
            // A. Open Recruitment & Extreme Martial Training
            if (tick % 3 === 0) {
                const recruitBurg = burgs.find(b => (b.pop_null || 0) >= 12 || b.unrest >= 8);
                if (recruitBurg) {
                    await client.query(`
                        UPDATE sim_burg_economy
                        SET pop_null = GREATEST(0, pop_null - 12)
                        WHERE burg_id = $1
                    `, [recruitBurg.burg_id]);
                    await client.query("UPDATE sim_outlaw_factions SET manpower = manpower + 12 WHERE id = $1", [cartel.id]);

                    await tagBurgCitizens(
                        client,
                        recruitBurg.burg_id,
                        ['#LegionTrained', '#DisciplinedSoldier'],
                        'STOIC',
                        `Inducted and drilled into a hardened fighting machine under Legion centurions.`,
                        null,
                        2
                    );

                    await client.query(`
                        INSERT INTO sim_events (tick, type, message, tier, faction_id, burg_id, lore_date)
                        VALUES ($1, 'LEGION_DRILL_TRAINING', $2, 'MAJOR', $3, $4, $5)
                    `, [
                        tick,
                        `🛡️ LEGION DRILL & TRAINING: The Legion opened recruitment in ${recruitBurg.name}, taking in 12 willing recruits and subjecting them to grueling martial conditioning, turning raw recruits into disciplined fighting machines!`,
                        cartel.id, recruitBurg.burg_id, loreDate
                    ]);
                }
            }

            // B. Forward Trade Bastions (Even Where Unaccepted)
            await handleLairEstablishment(client, cartel, burgs, tick, loreDate, "MERC_TRADE_BASTION", false);

            // C. Strong-Arming Markets & Monopoly Trade
            if (tick % 3 === 0) {
                const marketBurg = burgs.find(b => b.wealth > 250);
                if (marketBurg) {
                    await client.query(`
                        UPDATE sim_burg_economy SET wealth = GREATEST(0, wealth - 40) WHERE burg_id = $1
                    `, [marketBurg.burg_id]);
                    await client.query("UPDATE sim_outlaw_factions SET wealth = COALESCE(wealth, 0) + 110 WHERE id = $1", [cartel.id]);

                    await client.query(`
                        INSERT INTO sim_events (tick, type, message, tier, faction_id, burg_id, lore_date)
                        VALUES ($1, 'LEGION_MARKET_STRONGARM', $2, 'MINOR', $3, $4, $5)
                    `, [
                        tick,
                        `🔨 MARKET STRONG-ARM: Heavily armored Legion shock-troopers occupied the central trade plaza in ${marketBurg.name}, strong-arming merchants to enforce favorable price floors for Legion grain shipments.`,
                        cartel.id, marketBurg.burg_id, loreDate
                    ]);
                }
            }

            // D. Pure Loyal Mercenary Muscle for Hire
            if (tick % 4 === 0) {
                const hireFactionRes = await client.query(`
                    SELECT id, name, treasury FROM sim_factions WHERE id > 0 AND treasury >= 2000 ORDER BY RANDOM() LIMIT 1
                `);
                if (hireFactionRes.rows.length > 0) {
                    const clientFaction = hireFactionRes.rows[0];
                    await client.query("UPDATE sim_factions SET treasury = treasury - 400 WHERE id = $1", [clientFaction.id]);
                    await client.query("UPDATE sim_outlaw_factions SET wealth = COALESCE(wealth, 0) + 400 WHERE id = $1", [cartel.id]);

                    await client.query(`
                        INSERT INTO sim_events (tick, type, message, tier, faction_id, burg_id, lore_date)
                        VALUES ($1, 'LEGION_MERCENARY_CONTRACT', $2, 'MAJOR', $3, $4, $5)
                    `, [
                        tick,
                        `⚔️ MERCENARY CONTRACT RATIFIED: The Legion signed an unbreakable military contract with ${clientFaction.name}, deploying an elite cohort of heavy halberdiers to fortify contested borders!`,
                        cartel.id, null, loreDate
                    ]);
                }
            }
        }

        // =========================================================================
        // 4. THE GHOSTWIND RAIDERS (ID 5): Secret Airships for the Guerrilla Clans
        // =========================================================================
        else if (cartelId === 5 || cartelName.includes("Ghostwind")) {
            // Secret airship mercenaries, secretly serving the Guerrilla Clans (Faction 21)
            if (tick % 2 === 0) {
                const hiringFactionRes = await client.query(`
                    SELECT id, name, treasury FROM sim_factions WHERE id > 0 AND id != 21 AND treasury >= 2500 ORDER BY RANDOM() LIMIT 1
                `);
                if (hiringFactionRes.rows.length > 0) {
                    const clientFaction = hiringFactionRes.rows[0];
                    const targetBurg = burgs.find(b => b.wealth > 100);

                    if (targetBurg) {
                        await client.query("UPDATE sim_factions SET treasury = treasury - 500 WHERE id = $1", [clientFaction.id]);
                        await client.query("UPDATE sim_outlaw_factions SET wealth = COALESCE(wealth, 0) + 250 WHERE id = $1", [cartel.id]);
                        // Covertly funnel 250 gold directly to the Guerrilla Clans!
                        await client.query("UPDATE sim_factions SET treasury = treasury + 250 WHERE id = 21");

                        await client.query(`
                            UPDATE sim_burg_economy
                            SET food = GREATEST(0, food - 120),
                                wealth = GREATEST(0, wealth - 70),
                                unrest = LEAST(100, unrest + 10)
                            WHERE burg_id = $1
                        `, [targetBurg.burg_id]);

                        await client.query(`
                            INSERT INTO sim_events (tick, type, message, tier, faction_id, burg_id, lore_date)
                            VALUES ($1, 'GHOSTWIND_COVERT_AIRSHIP_STRIKE', $2, 'MAJOR', $3, $4, $5)
                        `, [
                            tick,
                            `⚔️ COVERT AIRSHIP STRIKE: Ghostwind Raiders executed a devastating midnight airship raid on supply depots near ${targetBurg.name}, masquerading as neutral mercenaries while secretly routing seized gold to the Guerrilla Clans!`,
                            cartel.id, targetBurg.burg_id, loreDate
                        ]);
                    }
                }
            }

            // Maintain covert airship hangars
            await handleLairEstablishment(client, cartel, burgs, tick, loreDate, "SECRET_AIRSHIP_HANGAR", true);
        }

        // =========================================================================
        // 5. THE OBSIDIAN CARTEL (ID 6): Drugs, Weapons, Tunnels, Fronts & Assassins
        // =========================================================================
        else if (cartelId === 6 || cartelName.includes("Obsidian")) {
            // A. Business Fronts & Oligarch Respect
            if (tick % 3 === 0) {
                const wealthyBurg = burgs.find(b => b.wealth > 300);
                if (wealthyBurg) {
                    await client.query(`
                        INSERT INTO sim_events (tick, type, message, tier, faction_id, burg_id, lore_date)
                        VALUES ($1, 'CARTEL_MAGISTRATE_AUDIENCE', $2, 'MINOR', $3, $4, $5)
                    `, [
                        tick,
                        `🍷 OLIGARCH BACKROOM DEAL: Front-factors of the Obsidian Cartel hosted a private banquet with magistrates in ${wealthyBurg.name}, commanding high municipal respect while securing customs exemptions.`,
                        cartel.id, wealthyBurg.burg_id, loreDate
                    ]);
                }
            }

            // B. Smuggling Infrastructure: Tunnels & Bribing City Gates
            if (tick % 3 === 0) {
                const gateBurg = burgs.find(b => b.wealth > 200);
                if (gateBurg) {
                    await client.query(`
                        INSERT INTO sim_events (tick, type, message, tier, faction_id, burg_id, lore_date)
                        VALUES ($1, 'CARTEL_BRIBED_GATE', $2, 'MINOR', $3, $4, $5)
                    `, [
                        tick,
                        `🗝️ BRIBED CITY GATE: The Obsidian Cartel paid off night-watch sergeants at the fortified gate of ${gateBurg.name}, allowing concealed carts of narcotics and black-glass blades to enter uninspected.`,
                        cartel.id, gateBurg.burg_id, loreDate
                    ]);
                }
            }

            // C. Contraband Narcotics Distribution (Holds happiness, drops health)
            if (tick % 2 === 0) {
                const narcBurg = burgs.find(b => b.unrest > 5 || b.health > 40);
                if (narcBurg) {
                    await client.query(`
                        UPDATE sim_burg_economy
                        SET unrest = GREATEST(0, unrest - 4),
                            health = GREATEST(0, health - 6)
                        WHERE burg_id = $1
                    `, [narcBurg.burg_id]);
                    await client.query("UPDATE sim_outlaw_factions SET wealth = COALESCE(wealth, 0) + 140 WHERE id = $1", [cartel.id]);

                    await tagBurgCitizens(
                        client,
                        narcBurg.burg_id,
                        ['#CartelNarcoticHabit', '#EuphoricDecline'],
                        'COMPLICIT',
                        `Dependent on Obsidian Cartel void-lotus powder; pacified in spirit while bodily health deteriorates.`,
                        '%laborer%',
                        2
                    );

                    await client.query(`
                        INSERT INTO sim_events (tick, type, message, tier, faction_id, burg_id, lore_date)
                        VALUES ($1, 'CARTEL_NARCOTICS_DISTRIBUTION', $2, 'MAJOR', $3, $4, $5)
                    `, [
                        tick,
                        `🧪 CONTRABAND NARCOTICS: The Obsidian Cartel flooded dockside taverns in ${narcBurg.name} with euphoric void-lotus powder—pacifying citizen unrest while steadily degrading municipal health!`,
                        cartel.id, narcBurg.burg_id, loreDate
                    ]);
                }
            }

            // D. Arming Rioters for Profit During Unrest
            const riotBurg = burgs.find(b => b.unrest >= 15 || b.food < 100);
            if (riotBurg && tick % 2 === 0) {
                await client.query(`
                    UPDATE sim_burg_economy
                    SET unrest = LEAST(100, unrest + 8),
                        wealth = GREATEST(0, wealth - 30)
                    WHERE burg_id = $1
                `, [riotBurg.burg_id]);
                await client.query("UPDATE sim_outlaw_factions SET wealth = COALESCE(wealth, 0) + 200 WHERE id = $1", [cartel.id]);

                await client.query(`
                    INSERT INTO sim_events (tick, type, message, tier, faction_id, burg_id, lore_date)
                    VALUES ($1, 'CARTEL_ARM_RIOTERS', $2, 'MAJOR', $3, $4, $5)
                `, [
                    tick,
                    `🗡️ CARTEL ARMS RIOTERS: Exploiting food shortages and civil unrest in ${riotBurg.name}, the Obsidian Cartel sold black-market blades and blast-powder to rioting mobs for massive gold, stoking chaos for profit!`,
                    cartel.id, riotBurg.burg_id, loreDate
                ]);
            }

            // E. Probationary Recruitment (Prove loyalty to earn membership)
            if (tick % 4 === 0) {
                const candBurg = burgs.find(b => (b.pop_null || 0) >= 12);
                if (candBurg) {
                    await client.query("UPDATE sim_burg_economy SET pop_null = pop_null - 12 WHERE burg_id = $1", [candBurg.burg_id]);
                    await client.query("UPDATE sim_outlaw_factions SET manpower = manpower + 1 WHERE id = $1", [cartel.id]);

                    await client.query(`
                        INSERT INTO sim_events (tick, type, message, tier, faction_id, burg_id, lore_date)
                        VALUES ($1, 'CARTEL_MEMBER_INDUCTION', $2, 'MINOR', $3, $4, $5)
                    `, [
                        tick,
                        `🗡️ CARTEL INDUCTION: After proving unwavering loyalty through extortion trials in ${candBurg.name}, recruit Silas Vance earned the syndicate's respect and was inducted as a made-member of the Obsidian Cartel.`,
                        cartel.id, candBurg.burg_id, loreDate
                    ]);
                }
            }

            // F. Contract Assassinations
            if (Number(cartel.wealth || 0) >= 400 && tick % 3 === 0) {
                const hitBurg = burgs.find(b => b.wealth > 300);
                if (hitBurg) {
                    await client.query(`
                        UPDATE sim_burg_economy
                        SET unrest = LEAST(100, unrest + 8),
                            health = GREATEST(0, health - 4)
                        WHERE burg_id = $1
                    `, [hitBurg.burg_id]);

                    await tagBurgCitizens(client, hitBurg.burg_id, ['#MurderInquiry', '#VigilantWatch'], 'WARY', `Investigating a lethal contract killing executed by Obsidian Cartel assassins.`, '%watch%', 2);

                    await client.query(`
                        INSERT INTO sim_events (tick, type, message, tier, faction_id, burg_id, lore_date)
                        VALUES ($1, 'CARTEL_CONTRACT_KILLING', $2, 'MAJOR', $3, $4, $5)
                    `, [
                        tick,
                        `🗡️ OBSIDIAN CARTEL HIT: An assassin from the Obsidian Cartel struck down a defiant magistrate in ${hitBurg.name}! The city watch discovered an etched black-glass blade left at the murder scene.`,
                        cartel.id, hitBurg.burg_id, loreDate
                    ]);
                }
            }

            // Establish legitimate business fronts and tunnels
            await handleLairEstablishment(client, cartel, burgs, tick, loreDate, "BUSINESS_FRONT", false);
        }

        // =========================================================================
        // 6. THE HEDGE WIZARDS (ID 10): Solitary Nomads & Peddled Wild Charms
        // =========================================================================
        else if (cartelId === 10 || cartelName.includes("Hedge Wizards") || cartelName.includes("Hedge Wizard")) {
            // A. No recruitment: starving sparkborn peasants awaken power on the road
            if (tick % 3 === 0) {
                const ruralBurg = burgs.find(b => b.health < 80 || b.unrest > 8);
                if (ruralBurg) {
                    await client.query(`
                        INSERT INTO sim_events (tick, type, message, tier, faction_id, burg_id, lore_date)
                        VALUES ($1, 'HEDGE_SPARK_AWAKENING', $2, 'MINOR', $3, $4, $5)
                    `, [
                        tick,
                        `✨ SPARK AWAKENING: Starving on the rural roads outside ${ruralBurg.name}, an impoverished wanderer discovered their innate magical spark, learning through survival to become an independent hedge wizard.`,
                        cartel.id, ruralBurg.burg_id, loreDate
                    ]);
                }
            }

            // B. Solitary Nomads Peddling Charms across 4 distinct outcome tiers
            const charmBurg = burgs.find(b => b.wealth > 60);
            if (charmBurg) {
                const roll = Math.random();

                // Tier 1: Useless Junk (Placebo, ~35%)
                if (roll < 0.35) {
                    await client.query("UPDATE sim_outlaw_factions SET wealth = COALESCE(wealth, 0) + 15 WHERE id = $1", [cartel.id]);
                    await client.query(`
                        INSERT INTO sim_events (tick, type, message, tier, faction_id, burg_id, lore_date)
                        VALUES ($1, 'HEDGE_CHARM_JUNK', $2, 'MINOR', $3, $4, $5)
                    `, [
                        tick,
                        `🪨 HEDGE CHARM (USELESS JUNK): A solitary hedge wizard in ${charmBurg.name} peddled painted river 'luck-pebbles' and salted bird feathers to gullible commoners for copper before packing up their roadside cart.`,
                        cartel.id, charmBurg.burg_id, loreDate
                    ]);
                }
                // Tier 2: Useful Remedy (~35%)
                else if (roll < 0.70) {
                    await client.query(`
                        UPDATE sim_burg_economy
                        SET health = LEAST(100, health + 6),
                            unrest = GREATEST(0, unrest - 3)
                        WHERE burg_id = $1
                    `, [charmBurg.burg_id]);
                    await client.query("UPDATE sim_outlaw_factions SET wealth = COALESCE(wealth, 0) + 40 WHERE id = $1", [cartel.id]);

                    await tagBurgCitizens(
                        client,
                        charmBurg.burg_id,
                        ['#HedgeCharmBearer'],
                        'DEVOUT',
                        `Carrying unsanctioned curative bramble charms gifted by a solitary nomadic hedge wizard.`,
                        '%peasant%',
                        2
                    );

                    await client.query(`
                        INSERT INTO sim_events (tick, type, message, tier, faction_id, burg_id, lore_date)
                        VALUES ($1, 'HEDGE_CHARM_USEFUL', $2, 'MINOR', $3, $4, $5)
                    `, [
                        tick,
                        `🌿 HEDGE CHARM (REMEDY): A wandering hedge wizard quietly sold bramble-fever tinctures and hearth-warmth amulets to sickly commoners in ${charmBurg.name}, curing chills where guild apothecaries refused charity.`,
                        cartel.id, charmBurg.burg_id, loreDate
                    ]);
                }
                // Tier 3: Powerful Unintended Wild Surge (~15%)
                else if (roll < 0.85) {
                    await client.query(`
                        UPDATE sim_burg_economy SET raw_materials = raw_materials + 60 WHERE burg_id = $1
                    `, [charmBurg.burg_id]);
                    await client.query("UPDATE sim_outlaw_factions SET wealth = COALESCE(wealth, 0) + 60 WHERE id = $1", [cartel.id]);

                    await client.query(`
                        INSERT INTO sim_events (tick, type, message, tier, faction_id, burg_id, lore_date)
                        VALUES ($1, 'HEDGE_CHARM_WILD_SURGE', $2, 'MAJOR', $3, $4, $5)
                    `, [
                        tick,
                        `⚡ HEDGE CHARM (UNINTENDED SURGE): A wild-spark talisman sold to a farmer in ${charmBurg.name} triggered a chaotic magical surge—instantly causing an entire orchard to fruit out of season and levitating two hay wagons!`,
                        cartel.id, charmBurg.burg_id, loreDate
                    ]);
                }
                // Tier 4: Oops / Disasters / Backfires (~15%)
                else {
                    await client.query(`
                        UPDATE sim_burg_economy SET unrest = LEAST(100, unrest + 4) WHERE burg_id = $1
                    `, [charmBurg.burg_id]);

                    await client.query(`
                        INSERT INTO sim_events (tick, type, message, tier, faction_id, burg_id, lore_date)
                        VALUES ($1, 'HEDGE_CHARM_DISASTER', $2, 'MAJOR', $3, $4, $5)
                    `, [
                        tick,
                        `💥 HEDGE CHARM (OOPS!): A faulty warding charm sold by a hedge wizard backfired in the market of ${charmBurg.name}! It turned a merchant's beard into crackling blue sparks and curdled dairy barrels, sending the wizard sprinting for the tree line!`,
                        cartel.id, charmBurg.burg_id, loreDate
                    ]);
                }
            }

            // Roadside nomadic camps
            await handleLairEstablishment(client, cartel, burgs, tick, loreDate, "ROADSIDE_HEDGE_WAGON", true);
        }

        // =========================================================================
        // 7. THE OTTER MAFIA (ID 7): River Mob, Canal Locks & Floating Speakeasies
        // =========================================================================
        else if (cartelId === 7 || cartelName.includes("Otter Mafia")) {
            if (tick % 2 === 0) {
                const canalBurg = burgs.find(b => b.wealth > 150);
                if (canalBurg) {
                    await client.query(`
                        UPDATE sim_burg_economy SET wealth = GREATEST(0, wealth - 35), unrest = LEAST(100, unrest + 2) WHERE burg_id = $1
                    `, [canalBurg.burg_id]);
                    await client.query("UPDATE sim_outlaw_factions SET wealth = COALESCE(wealth, 0) + 65 WHERE id = $1", [cartel.id]);

                    await tagBurgCitizens(client, canalBurg.burg_id, ['#OtterMobAssociate'], 'WARY', `Paying canal lock tolls and purchasing smuggled eel-wine from Otter Mafia runners.`, '%laborer%', 2);

                    await client.query(`
                        INSERT INTO sim_events (tick, type, message, tier, faction_id, burg_id, lore_date)
                        VALUES ($1, 'OTTER_MAFIA_CANAL_EXTORTION', $2, 'MINOR', $3, $4, $5)
                    `, [
                        tick,
                        `🦦 CANAL RACKET: Otter Mafia lock-bosses extorted barge tolls along the river flues near ${canalBurg.name}, trafficking smuggled fermented eel-wine to dockside speakeasies.`,
                        cartel.id, canalBurg.burg_id, loreDate
                    ]);
                }
            }

            await handleLairEstablishment(client, cartel, burgs, tick, loreDate, "RIVERBOAT_CASINO", false);
        }

        // =========================================================================
        // 8. THE GRIND CANYON CORPS (ID 9): Chasm Divers & Relic Excavators (NO SMUGGLING)
        // =========================================================================
        else if (cartelId === 9 || cartelName.includes("Grind Canyon")) {
            if (tick % 3 === 0) {
                const partnerBurg = burgs.find(b => b.wealth > 100);
                if (partnerBurg) {
                    await client.query("UPDATE sim_outlaw_factions SET wealth = COALESCE(wealth, 0) + 160 WHERE id = $1", [cartel.id]);
                    await client.query(`
                        UPDATE sim_burg_economy SET raw_materials = raw_materials + 150, wealth = wealth + 40 WHERE burg_id = $1
                    `, [partnerBurg.burg_id]);

                    await tagBurgCitizens(client, partnerBurg.burg_id, ['#DragonstoneSmith'], 'INDUSTRIOUS', `Smelting raw abyssal dragonstone hoisted by the Grind Canyon Corps.`, '%smith%', 2);

                    await client.query(`
                        INSERT INTO sim_events (tick, type, message, tier, faction_id, burg_id, lore_date)
                        VALUES ($1, 'CHASM_RELIC_EXTRACTION', $2, 'MAJOR', $3, $4, $5)
                    `, [
                        tick,
                        `⛏️ ABYSSAL EXCAVATION: Grind Canyon Corps dive teams rigged steel winches into a grinding wilderness trench, hoisting up an ancient Pre-Cruor titan relic and 50 lbs of raw dragonstone for the forges of ${partnerBurg.name}!`,
                        cartel.id, partnerBurg.burg_id, loreDate
                    ]);
                }
            }

            await handleLairEstablishment(client, cartel, burgs, tick, loreDate, "CANYON_STRIP_REDOUBT", false);
        }

        // =========================================================================
        // 9. THE IVORY-GATE SYNDICATE (ID 4): Toll Racketeers & Mountain Checkpoints
        // =========================================================================
        else if (cartelId === 4 || cartelName.includes("Ivory-Gate")) {
            // A. Recruitment of Disillusioned Fortress Guards & Highway Enforcers
            if (tick % 4 === 0) {
                const garrisonBurg = burgs.find(b => (b.unrest || 0) >= 3 || (b.pop_null || 0) >= 12);
                if (garrisonBurg) {
                    await client.query(`
                        UPDATE sim_burg_economy SET pop_null = GREATEST(0, COALESCE(pop_null, 0) - 12) WHERE burg_id = $1
                    `, [garrisonBurg.burg_id]);
                    await client.query("UPDATE sim_outlaw_factions SET manpower = COALESCE(manpower, 0) + 6 WHERE id = $1", [cartel.id]);

                    await tagBurgCitizens(
                        client,
                        garrisonBurg.burg_id,
                        ['#IvoryTollEnforcer', '#BribedTurnkey'],
                        'CORRUPT',
                        `Enforcing illicit mountain toll gates and diverting road tolls for Legate General Vorun Iron-Grip.`,
                        '%guard%',
                        1
                    );

                    await client.query(`
                        INSERT INTO sim_events (tick, type, message, tier, faction_id, burg_id, lore_date)
                        VALUES ($1, 'IVORY_GATE_RECRUITMENT', $2, 'MINOR', $3, $4, $5)
                    `, [
                        tick,
                        `⚔️ TOLL ENFORCERS RECRUITED: Warden Vorun Iron-Grip enlisted veteran gate-guards and mercenary highwaymen in ${garrisonBurg.name} into the Ivory-Gate road legion.`,
                        cartel.id, garrisonBurg.burg_id, loreDate
                    ]);
                }
            }

            // B. Roadway Extortion & Toll Checkpoints
            if (tick % 3 === 0) {
                const passBurg = burgs.find(b => b.wealth > 150);
                if (passBurg) {
                    await client.query(`
                        UPDATE sim_burg_economy SET wealth = GREATEST(0, wealth - 45) WHERE burg_id = $1
                    `, [passBurg.burg_id]);
                    await client.query("UPDATE sim_outlaw_factions SET wealth = COALESCE(wealth, 0) + 70 WHERE id = $1", [cartel.id]);

                    await client.query(`
                        INSERT INTO sim_events (tick, type, message, tier, faction_id, burg_id, lore_date)
                        VALUES ($1, 'IVORY_GATE_TOLL_EXTORTION', $2, 'MINOR', $3, $4, $5)
                    `, [
                        tick,
                        `🛑 TOLL BLOCKADE: Corrupt legionnaires of the Ivory-Gate Syndicate maintained an unsanctioned iron checkpoint on the mountain road to ${passBurg.name}, levying extortionate tariffs on merchant wagons.`,
                        cartel.id, passBurg.burg_id, loreDate
                    ]);
                }
            }

            await handleLairEstablishment(client, cartel, burgs, tick, loreDate, "TOLL_BLOCKADE", false);
        }

        // =========================================================================
        // 10. THE GHOSTSPRING NETWORK (ID 8): Poison Distillers & Bought Secrets
        // =========================================================================
        else if (cartelId === 8 || cartelName.includes("Ghostspring")) {
            if (tick % 3 === 0) {
                const spyBurg = burgs.find(b => b.wealth > 200);
                if (spyBurg) {
                    await client.query("UPDATE sim_outlaw_factions SET wealth = COALESCE(wealth, 0) + 90 WHERE id = $1", [cartel.id]);

                    await client.query(`
                        INSERT INTO sim_events (tick, type, message, tier, faction_id, burg_id, lore_date)
                        VALUES ($1, 'GHOSTSPRING_POISON_PLOT', $2, 'MINOR', $3, $4, $5)
                    `, [
                        tick,
                        `🍵 DISTILLED VENOMS: Operating from geothermal mist caves near ${spyBurg.name}, Ghostspring alchemists brewed batches of untraceable paralytic orchid extract for clandestine buyers.`,
                        cartel.id, spyBurg.burg_id, loreDate
                    ]);
                }
            }

            await handleLairEstablishment(client, cartel, burgs, tick, loreDate, "GHOSTSPRING_DISTILLERY", true);
        }
    }
}

/**
 * Handles authentic lair establishment for each faction type
 */
async function handleLairEstablishment(
    client: PoolClient,
    cartel: any,
    burgs: any[],
    tick: number,
    loreDate: string,
    preferredLairType: string,
    isSecret: boolean = false
) {
    if (Number(cartel.wealth || 0) >= 300 && Math.random() < 0.25) {
        const lairBurg = burgs.find((b: any) => (b.wealth || 0) >= 120);
        if (!lairBurg) return;

        const existingLair = await client.query(
            `SELECT id, faction_id, manpower FROM sim_fringe_lairs WHERE burg_id = $1 AND faction_id = $2`,
            [lairBurg.burg_id, cartel.id]
        );

        if (existingLair.rows.length === 0) {
            const inserted = await client.query(
                `INSERT INTO sim_fringe_lairs (faction_id, cell_id, burg_id, lair_type, manpower, heat)
                 VALUES ($1, $2, $3, $4, $5, 10) RETURNING *`,
                [cartel.id, lairBurg.cell_id, lairBurg.burg_id, preferredLairType, 40]
            );
            const newLair = inserted.rows[0];
            await ensureLairResidents(client, { ...newLair, cartel_name: cartel.name, cartel_type: cartel.type });

            const visibilityText = isSecret ? "a covert, camouflaged" : "an unhidden, prominent";
            await client.query(`
                INSERT INTO sim_events (tick, type, message, tier, faction_id, burg_id, lore_date)
                VALUES ($1, 'LAIR_ESTABLISHED', $2, 'MINOR', $3, $4, $5)
            `, [
                tick,
                `${cartel.name} established ${visibilityText} ${preferredLairType.replace(/_/g, " ")} base in ${lairBurg.name} to expand their provincial operations!`,
                cartel.id, lairBurg.burg_id, loreDate
            ]);
        }
    }
}
