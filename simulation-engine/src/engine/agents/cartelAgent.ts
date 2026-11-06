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
            await client.query("UPDATE sim_outlaw_factions SET worker_groups = 3 WHERE id = $1", [cartel.id]);
            cartel.worker_groups = 3;
        }

        const paragonRes = await client.query("SELECT * FROM sim_paragons WHERE outlaw_id = $1 LIMIT 1", [cartel.id]);
        let paragon = paragonRes.rows[0];
        if (!paragon) {
            const originBurgRes = await client.query("SELECT burg_id FROM sim_burg_economy WHERE cell_id = $1 LIMIT 1", [cartel.origin_cell_id]);
            const originBurgId = originBurgRes.rows[0]?.burg_id || 1;
            const traits = JSON.stringify([{ name: "Ruthless", modifier: 0.2 }]);
            const newP = await client.query(
                `INSERT INTO sim_paragons (outlaw_id, burg_id, title, name, traits) VALUES ($1, $2, 'Syndicate Boss', $3, $4) RETURNING *`,
                [cartel.id, originBurgId, `${cartel.name} Boss`, traits]
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
        // 4. THE GHOSTWIND RAIDERS (ID 5): 1 Ship, 1 Hidden Lair, Real Dead Drops
        //    Supplied Twice a Year by Top 4 Factions, Randomized Strikes & Rumors
        // =========================================================================
        else if (cartelId === 5 || cartelName.includes("Ghostwind")) {
            // Ensure strictly 1 single hidden lair in existence (anchored in Guerrilla Clan territory)
            const lairCountRes = await client.query("SELECT COUNT(*) as total FROM sim_fringe_lairs WHERE faction_id = $1", [cartel.id]);
            if (parseInt(lairCountRes.rows[0].total) === 0) {
                const clanCell = cartel.origin_cell_id || 24364;
                await client.query(`
                    INSERT INTO sim_fringe_lairs (faction_id, cell_id, burg_id, lair_type, manpower, heat)
                    VALUES ($1, $2, $3, 'CLAN_COVERT_COVE', 45, 10)
                `, [cartel.id, clanCell, cartel.origin_burg_id || 115]);
            }

            // Ensure dead drops table exists
            await client.query(`
                CREATE TABLE IF NOT EXISTS sim_ghostwind_dead_drops (
                    id SERIAL PRIMARY KEY,
                    created_tick INT,
                    client_faction_id INT,
                    target_faction_id INT,
                    target_burg_id INT,
                    bounty_gold INT,
                    status VARCHAR(20) DEFAULT 'PENDING',
                    executed_tick INT
                );
            `);

            // A. Real Dead Drops Supplied Twice a Year by the Top 4 Sovereign Power Leaders
            // In a 541-day calendar: twice a year at Tick 135 (mid High Sun) and Tick 405 (mid Thaw)
            if (tick === 135 || tick === 405) {
                const topPowersRes = await client.query(`
                    SELECT f.id, f.name, f.treasury
                    FROM sim_factions f
                    WHERE f.id NOT IN (1, 21) AND f.treasury >= 250
                    ORDER BY f.treasury DESC
                    LIMIT 4
                `);

                const powers = topPowersRes.rows;
                if (powers.length >= 4) {
                    for (let i = 0; i < powers.length; i++) {
                        const clientFaction = powers[i];
                        const targetFaction = powers[(i + 1) % powers.length];

                        // Find a wealthy supply target burg belonging to the target power
                        const targetBurgRes = await client.query(`
                            SELECT b.burg_id, b.name, b.wealth
                            FROM sim_burg_economy b
                            JOIN sim_cells c ON b.cell_id = c.id
                            WHERE c.faction_id = $1 AND b.wealth >= 60
                            ORDER BY b.wealth DESC
                            LIMIT 1
                        `, [targetFaction.id]);

                        const targetBurg = targetBurgRes.rows[0] || burgs[0];
                        if (targetBurg) {
                            const bounty = 350;
                            // Deduct bounty gold from client faction treasury
                            await client.query("UPDATE sim_factions SET treasury = GREATEST(50, treasury - $1) WHERE id = $2", [bounty, clientFaction.id]);

                            // Insert real dead drop contract into sim_ghostwind_dead_drops
                            await client.query(`
                                INSERT INTO sim_ghostwind_dead_drops (created_tick, client_faction_id, target_faction_id, target_burg_id, bounty_gold, status)
                                VALUES ($1, $2, $3, $4, $5, 'PENDING')
                            `, [tick, clientFaction.id, targetFaction.id, targetBurg.burg_id, bounty]);

                            await client.query(`
                                INSERT INTO sim_events (tick, type, message, tier, faction_id, burg_id, lore_date)
                                VALUES ($1, 'GHOSTWIND_DEAD_DROP_PLACED', $2, 'MAJOR', $3, $4, $5)
                            `, [
                                tick,
                                `📜 REAL DEAD DROP SUPPLIED: Sovereign ministers of ${clientFaction.name} deposited a secret dead drop containing ${bounty} gold and convoy routing ciphers inside a hollow border cairn, commissioning a phantom strike on ${targetFaction.name}'s supply routes near ${targetBurg.name}! Unwittingly, all four supreme courts are supplying dead drops targeting each other in a circle.`,
                                cartel.id, targetBurg.burg_id, loreDate
                            ]);
                        }
                    }
                }
            }

            // B. Randomized Timing of Phantom Strikes
            // Check for pending dead drops
            const pendingDropsRes = await client.query(`
                SELECT d.id, d.created_tick, d.client_faction_id, d.target_faction_id, d.target_burg_id, d.bounty_gold,
                       cf.name as client_name, tf.name as target_name, b.name as target_burg_name, b.wealth, b.food
                FROM sim_ghostwind_dead_drops d
                JOIN sim_factions cf ON cf.id = d.client_faction_id
                JOIN sim_factions tf ON tf.id = d.target_faction_id
                JOIN sim_burg_economy b ON b.burg_id = d.target_burg_id
                WHERE d.status = 'PENDING'
                ORDER BY d.id ASC
            `);

            if (pendingDropsRes.rows.length > 0) {
                // Check last executed strike tick to randomize timing with natural variance
                const lastStrikeRes = await client.query(`
                    SELECT MAX(executed_tick) as last_tick FROM sim_ghostwind_dead_drops WHERE status = 'EXECUTED'
                `);
                const lastTick = Number(lastStrikeRes.rows[0]?.last_tick || 0);
                const ticksSinceLast = tick - lastTick;

                // Randomized timing: at least 32 ticks cooldown between strikes, with a 18% stochastic chance per tick
                const shouldStrike = (lastTick === 0 && tick >= 45) || (ticksSinceLast >= 32 && Math.random() < 0.18) || (ticksSinceLast >= 70);

                if (shouldStrike) {
                    const contract = pendingDropsRes.rows[0];
                    const plunderWealth = Math.min(Number(contract.wealth || 200), 400);
                    const plunderFood = Math.min(Number(contract.food || 150), 250);

                    // 1. Plunder target down to its bare hull
                    await client.query(`
                        UPDATE sim_burg_economy
                        SET wealth = GREATEST(20, wealth - $1),
                            food = GREATEST(50, food - $2),
                            unrest = LEAST(100, unrest + 12)
                        WHERE burg_id = $3
                    `, [plunderWealth, plunderFood, contract.target_burg_id]);

                    // Mark dead drop contract as EXECUTED
                    await client.query(`
                        UPDATE sim_ghostwind_dead_drops
                        SET status = 'EXECUTED', executed_tick = $1
                        WHERE id = $2
                    `, [tick, contract.id]);

                    // Add bounty gold to Ghostwind wealth
                    await client.query("UPDATE sim_outlaw_factions SET wealth = COALESCE(wealth, 0) + $1 WHERE id = $2", [contract.bounty_gold, cartel.id]);

                    // 2. Cut to Guerrilla Clans (Faction ID 1): 35%
                    const clanCut = Math.floor(plunderWealth * 0.35);
                    await client.query("UPDATE sim_factions SET treasury = treasury + $1 WHERE id = 1", [clanCut]);

                    // 3. Cut to outer rural burgs: 65% via local smugglers
                    const ruralCut = plunderWealth - clanCut;
                    const outerBurgsRes = await client.query(`
                        SELECT b.burg_id, b.name
                        FROM sim_burg_economy b
                        WHERE b.is_capital = false AND b.burg_id != $1
                        ORDER BY b.wealth ASC
                        LIMIT 2
                    `, [contract.target_burg_id]);

                    const outerBurgs = outerBurgsRes.rows;
                    const sharePerBurg = outerBurgs.length > 0 ? Math.floor(ruralCut / outerBurgs.length) : 0;
                    for (const ob of outerBurgs) {
                        await client.query(`
                            UPDATE sim_burg_economy
                            SET wealth = wealth + $1,
                                food = food + 100,
                                unrest = GREATEST(0, unrest - 4)
                            WHERE burg_id = $2
                        `, [sharePerBurg, ob.burg_id]);

                        await client.query(`
                            INSERT INTO sim_events (tick, type, message, tier, faction_id, burg_id, lore_date)
                            VALUES ($1, 'GHOSTWIND_DEAD_DROP_DISTRIBUTION', $2, 'MINOR', $3, $4, $5)
                        `, [
                            tick,
                            `📦 DEAD DROP SMUGGLING: Outlying smugglers near ${ob.name} recovered an untraceable dead drop left by The Ghostwind! Siphoning off their cut, contraband coin (${sharePerBurg} gold) was quietly circulated into the hands of struggling rural commoners.`,
                            cartel.id, ob.burg_id, loreDate
                        ]);
                    }

                    // 4. Spawn Rumor Tags to Spread Rumors of Who Did It
                    await tagBurgCitizens(
                        client,
                        contract.target_burg_id,
                        ['#GhostwindRumor', '#BlameRivalFaction', '#SpectralAirshipSighting', '#LockedRoomMystery'],
                        'WARY',
                        `Debating conflicting rumors: some blame ${contract.client_name} privateers, while terrified sailors swear a phantom airship vanished into thin air after tying the crew in slipknots.`,
                        '%sailor%',
                        3
                    );

                    // Also tag citizens in client faction capital
                    const clientCapRes = await client.query(`
                        SELECT burg_id FROM sim_burg_economy b
                        JOIN sim_cells c ON b.cell_id = c.id
                        WHERE c.faction_id = $1 AND b.is_capital = true
                        LIMIT 1
                    `, [contract.client_faction_id]);
                    if (clientCapRes.rows.length > 0) {
                        await tagBurgCitizens(
                            client,
                            clientCapRes.rows[0].burg_id,
                            ['#DeadDropSuccess', '#WhisperedTriumph'],
                            'TRIUMPHANT',
                            `Court nobles quietly celebrate the destruction of rival convoys in ${contract.target_name}, toast-drinking their anonymous mercenary contractor.`,
                            '%noble%',
                            2
                        );
                    }

                    // 5. Log the signature phantom strike event
                    await client.query(`
                        INSERT INTO sim_events (tick, type, message, tier, faction_id, burg_id, lore_date)
                        VALUES ($1, 'GHOSTWIND_PHANTOM_RAID', $2, 'MAJOR', $3, $4, $5)
                    `, [
                        tick,
                        `⚔️ THE GHOSTWIND PHANTOM RAID: Emerging silently out of storm clouds, The Ghostwind ambushed the flagship supply convoy of ${contract.target_name} near ${contract.target_burg_name}! Carrying out the secret dead-drop contract placed by ${contract.client_name}, the phantom corsairs subdued the entire crew with ruthless finesse and stripped the vessel down to its bare hull. In their signature locked-room mystery style, the raiders left exactly one captive tied in a loose knot that could be worked free after four hours—by which time The Ghostwind had vanished into the cloudbanks! Faction leaders in ${contract.target_name} suspect espionage, while commoners and sailors spread wild rumors: some point fingers at ${contract.client_name}, while others swear an actual ghost ship struck them!`,
                        cartel.id, contract.target_burg_id, loreDate
                    ]);
                }
            }

            // Strictly 1 single covert airship with 1 hidden lair — NO additional lairs!
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
        // 6. THE HEDGE WIZARDS (ID 10): Solitary Nomads, Entertainers & Peddled Charms
        // =========================================================================
        else if (cartelId === 10 || cartelName.includes("Hedge Wizards") || cartelName.includes("Hedge Wizard")) {
            // A. Solitary Spark Awakening: Impoverished wanderer learning on the road (NO recruitment/teams)
            if (tick % 4 === 0) {
                const ruralBurg = burgs.find(b => b.health < 80 || b.unrest > 8);
                if (ruralBurg) {
                    await client.query(`
                        INSERT INTO sim_events (tick, type, message, tier, faction_id, burg_id, lore_date)
                        VALUES ($1, 'HEDGE_SPARK_AWAKENING', $2, 'MINOR', $3, $4, $5)
                    `, [
                        tick,
                        `✨ SPARK AWAKENING: Starving on the rural roads outside ${ruralBurg.name}, an impoverished wanderer discovered an innate magical spark—learning through solitary survival to scrape by as an independent hedge wizard.`,
                        cartel.id, ruralBurg.burg_id, loreDate
                    ]);
                }
            }

            // B. Wandering Bards & Entertainers: Ballads, sleight of hand, puppet shows
            if (tick % 3 === 0) {
                const bardBurg = burgs.find(b => b.wealth > 80);
                if (bardBurg) {
                    await client.query(`
                        UPDATE sim_burg_economy
                        SET unrest = GREATEST(0, unrest - 2)
                        WHERE burg_id = $1
                    `, [bardBurg.burg_id]);
                    await client.query("UPDATE sim_outlaw_factions SET wealth = COALESCE(wealth, 0) + 20 WHERE id = $1", [cartel.id]);

                    await tagBurgCitizens(
                        client,
                        bardBurg.burg_id,
                        ['#BardicCheer'],
                        'CONVIVIAL',
                        `Enchanted by the roadside songs and whimsical lute-ballads of a traveling hedge wizard.`,
                        '%commoner%',
                        1
                    );

                    await client.query(`
                        INSERT INTO sim_events (tick, type, message, tier, faction_id, burg_id, lore_date)
                        VALUES ($1, 'HEDGE_BARD_PERFORMANCE', $2, 'MINOR', $3, $4, $5)
                    `, [
                        tick,
                        `🪕 BARDIC ENTERTAINER: A wandering hedge wizard busked on the street corners of ${bardBurg.name}, singing ancient folk ballads and weaving dancing colored sparks to ease commoner hearts for tossed coppers.`,
                        cartel.id, bardBurg.burg_id, loreDate
                    ]);
                }
            }

            // C. Practical Tinkering Services: Pot mending, knife sharpening, brazier repair
            if (tick % 3 === 1) {
                const tinkerBurg = burgs.find(b => b.wealth > 100);
                if (tinkerBurg) {
                    await client.query(`
                        UPDATE sim_burg_economy
                        SET raw_materials = raw_materials + 15,
                            unrest = GREATEST(0, unrest - 1)
                        WHERE burg_id = $1
                    `, [tinkerBurg.burg_id]);
                    await client.query("UPDATE sim_outlaw_factions SET wealth = COALESCE(wealth, 0) + 25 WHERE id = $1", [cartel.id]);

                    await client.query(`
                        INSERT INTO sim_events (tick, type, message, tier, faction_id, burg_id, lore_date)
                        VALUES ($1, 'HEDGE_PRACTICAL_TINKERING', $2, 'MINOR', $3, $4, $5)
                    `, [
                        tick,
                        `🔨 PRACTICAL HEDGE TINKERING: Setting up a whetstone and solder-pot outside the cookhouses of ${tinkerBurg.name}, a solitary hedge wizard mended copper pots and honed butchering blades with subtle heat charms.`,
                        cartel.id, tinkerBurg.burg_id, loreDate
                    ]);
                }
            }

            // D. Solitary Nomads Peddling Charms across 4 distinct outcome tiers
            const charmBurg = burgs.find(b => b.wealth > 60);
            if (charmBurg && tick % 2 === 0) {
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

            // E. The Sole Exception: "The Wonder-Wander Troupe" Traveling Circus (Moves every ~45 ticks to visit each faction)
            if (tick % 45 === 15) {
                // Find next faction to visit
                const factionListRes = await client.query(`
                    SELECT f.id, f.name, b.burg_id, b.name as burg_name, b.cell_id
                    FROM sim_factions f
                    JOIN sim_burg_economy b ON b.cell_id IN (SELECT id FROM sim_cells WHERE faction_id = f.id)
                    WHERE f.id > 0 AND b.wealth > 100
                    ORDER BY RANDOM()
                    LIMIT 1
                `);

                if (factionListRes.rows.length > 0) {
                    const stop = factionListRes.rows[0];

                    // Check or update the single traveling circus lair
                    const existingCircus = await client.query(
                        `SELECT id FROM sim_fringe_lairs WHERE faction_id = $1 AND lair_type = 'TRAVELING_CIRCUS_CARAVAN' LIMIT 1`,
                        [cartel.id]
                    );

                    if (existingCircus.rows.length === 0) {
                        await client.query(`
                            INSERT INTO sim_fringe_lairs (faction_id, cell_id, burg_id, lair_type, manpower, heat)
                            VALUES ($1, $2, $3, 'TRAVELING_CIRCUS_CARAVAN', 24, 0)
                        `, [cartel.id, stop.cell_id, stop.burg_id]);
                    } else {
                        await client.query(`
                            UPDATE sim_fringe_lairs
                            SET cell_id = $1, burg_id = $2
                            WHERE id = $3
                        `, [stop.cell_id, stop.burg_id, existingCircus.rows[0].id]);
                    }

                    // Festival arrival benefits
                    await client.query(`
                        UPDATE sim_burg_economy
                        SET unrest = GREATEST(0, unrest - 8),
                            wealth = wealth + 30
                        WHERE burg_id = $1
                    `, [stop.burg_id]);
                    await client.query("UPDATE sim_outlaw_factions SET wealth = COALESCE(wealth, 0) + 120 WHERE id = $1", [cartel.id]);

                    await tagBurgCitizens(
                        client,
                        stop.burg_id,
                        ['#CircusSpectator', '#EnchantedAudience'],
                        'JOYFUL',
                        `Spectating breathtaking pyrotechnics and aerial acrobatics performed by The Wonder-Wander Troupe.`,
                        null,
                        3
                    );

                    await client.query(`
                        INSERT INTO sim_events (tick, type, message, tier, faction_id, burg_id, lore_date)
                        VALUES ($1, 'WONDER_WANDER_CIRCUS_ARRIVES', $2, 'CRITICAL', $3, $4, $5)
                    `, [
                        tick,
                        `🎪 THE WONDER-WANDER CIRCUS ARRIVES: The flamboyant wagons of The Wonder-Wander Troupe rolled into ${stop.burg_name} of ${stop.name}! Acrobats, fire-eating hedge mages, and chimera-puppeteers raised their starry pavilions, bringing seasonal revelry, festive joy, and whimsical wonder to the entire realm!`,
                        cartel.id, stop.burg_id, loreDate
                    ]);
                }
            }

            // Strictly NO static burg lairs or municipal infiltrations for Hedge Wizards!
        }

        // =========================================================================
        // 7. THE OTTER MAFIA (ID 7): River Taverns, Waterway Intel & Submerged Operations
        // =========================================================================
        else if (cartelId === 7 || cartelName.includes("Otter Mafia")) {
            // A. River Taverns & Saloons: Serving drink, gathering rich gossip & sovereign intel
            if (tick % 2 === 0) {
                const riverBurg = burgs.find(b => b.wealth > 120);
                if (riverBurg) {
                    await client.query(`
                        UPDATE sim_burg_economy
                        SET wealth = GREATEST(0, wealth - 20)
                        WHERE burg_id = $1
                    `, [riverBurg.burg_id]);
                    await client.query("UPDATE sim_outlaw_factions SET wealth = COALESCE(wealth, 0) + 75 WHERE id = $1", [cartel.id]);

                    await tagBurgCitizens(
                        client,
                        riverBurg.burg_id,
                        ['#OtterTavernPatron', '#LooseLippedBargeman'],
                        'CONVIVIAL',
                        `Sipping fermented eel-wine in an Otter Mafia dockside saloon, inadvertently sharing river trade secrets.`,
                        '%laborer%',
                        2
                    );

                    await client.query(`
                        INSERT INTO sim_events (tick, type, message, tier, faction_id, burg_id, lore_date)
                        VALUES ($1, 'OTTER_TAVERN_INTEL', $2, 'MINOR', $3, $4, $5)
                    `, [
                        tick,
                        `🦦 RIVER TAVERN INTEL: Over draughts of frosted marsh-ale and fermented eel-wine at a dockside tavern near ${riverBurg.name}, Otter Mafia salooneers extracted vital sovereign trade schedules and patrol routes from loose-lipped barge crews.`,
                        cartel.id, riverBurg.burg_id, loreDate
                    ]);
                }
            }

            // B. Underwater Escape & Extraction: Smuggling fugitives through flumes
            if (tick % 4 === 1) {
                const escapeBurg = burgs.find(b => b.unrest >= 8 || b.wealth > 200);
                if (escapeBurg) {
                    await client.query("UPDATE sim_outlaw_factions SET wealth = COALESCE(wealth, 0) + 110 WHERE id = $1", [cartel.id]);
                    await client.query(`
                        UPDATE sim_burg_economy
                        SET unrest = LEAST(100, unrest + 2)
                        WHERE burg_id = $1
                    `, [escapeBurg.burg_id]);

                    await client.query(`
                        INSERT INTO sim_events (tick, type, message, tier, faction_id, burg_id, lore_date)
                        VALUES ($1, 'OTTER_UNDERWATER_EXTRACTION', $2, 'MAJOR', $3, $4, $5)
                    `, [
                        tick,
                        `🏊 UNDERWATER EXTRACTION: Specialised Otter Mafia flume-divers extracted a high-profile fugitive out of ${escapeBurg.name}! Equipped with reed respirators, they swam beneath municipal harbor cordons and submerged sewer grates, vanishing into the river currents!`,
                        cartel.id, escapeBurg.burg_id, loreDate
                    ]);
                }
            }

            // C. Submerged Cargo Retrieval & Deep Salvage
            if (tick % 4 === 3) {
                const salvageBurg = burgs.find(b => b.wealth > 150);
                if (salvageBurg) {
                    await client.query("UPDATE sim_outlaw_factions SET wealth = COALESCE(wealth, 0) + 130 WHERE id = $1", [cartel.id]);
                    await client.query(`
                        UPDATE sim_burg_economy
                        SET raw_materials = raw_materials + 40
                        WHERE burg_id = $1
                    `, [salvageBurg.burg_id]);

                    await client.query(`
                        INSERT INTO sim_events (tick, type, message, tier, faction_id, burg_id, lore_date)
                        VALUES ($1, 'OTTER_UNDERWATER_RETRIEVAL', $2, 'MAJOR', $3, $4, $5)
                    `, [
                        tick,
                        `🌊 SUBMERGED RETRIEVAL MISSION: Otter Mafia salvage teams dove into dangerous river flues and flooded ruins near ${salvageBurg.name}, retrieving sunken bullion chests and lost cargo crates from riverbed shipwrecks.`,
                        cartel.id, salvageBurg.burg_id, loreDate
                    ]);
                }
            }

            // Establish authentic River Taverns along waterways (unhidden)
            await handleLairEstablishment(client, cartel, burgs, tick, loreDate, "RIVER_TAVERN", false);
        }

        // =========================================================================
        // 8. THE GRIND CANYON CORPS (ID 9): Nomadic Chasm Divers & Caravan Community
        // =========================================================================
        else if (cartelId === 9 || cartelName.includes("Grind Canyon")) {
            // Check active canyons currently worked by the Grind Core community
            const activeCanyonsRes = await client.query(`
                SELECT id, name, cell_id, miner_crew_name, dragonstone_richness
                FROM sim_grind_canyons
                WHERE status IN ('OPEN', 'COLLAPSING')
            `);

            if (activeCanyonsRes.rows.length > 0) {
                // If canyons are active, the gypsy caravan community is stationed near them
                if (tick % 2 === 0) {
                    for (const canyon of activeCanyonsRes.rows) {
                        // Find the nearest burg to the canyon dive site
                        const nearestBurgRes = await client.query(`
                            SELECT burg_id, name, wealth, unrest
                            FROM sim_burg_economy
                            ORDER BY ABS(cell_id - $1) ASC
                            LIMIT 1
                        `, [canyon.cell_id]);

                        const nearestBurg = nearestBurgRes.rows[0];
                        if (nearestBurg) {
                            // Caravan divers inject raw dragonstone cash, but cause wild brawls and corruption
                            await client.query(`
                                UPDATE sim_burg_economy
                                SET wealth = wealth + 50,
                                    raw_materials = raw_materials + 60,
                                    unrest = LEAST(100, unrest + 4),
                                    crime_rate = LEAST(100, COALESCE(crime_rate, 0) + 5)
                                WHERE burg_id = $1
                            `, [nearestBurg.burg_id]);

                            await tagBurgCitizens(
                                client,
                                nearestBurg.burg_id,
                                ['#ChasmBrawler', '#DragonstoneGambler'],
                                'ROWDY',
                                `Gambling raw dragonstone nuggets in tavern brawls hosted by the Grind Canyon Corps caravan.`,
                                '%laborer%',
                                2
                            );

                            await client.query(`
                                INSERT INTO sim_events (tick, type, message, tier, faction_id, burg_id, lore_date)
                                VALUES ($1, 'GRIND_CORE_CARAVAN_INFLUX', $2, 'MAJOR', $3, $4, $5)
                            `, [
                                tick,
                                `⛏️ GRIND CORE CARAVAN INFLUX: Off-shift chasm divers from ${canyon.name} flooded the taverns and back-alleys of ${nearestBurg.name}! Paying for drinks in raw dragonstone nuggets, the nomadic crews sparked high-stakes dice brawls, spreading wealth, wild crime, and municipal corruption while the canyon remains open!`,
                                cartel.id, nearestBurg.burg_id, loreDate
                            ]);
                        }
                    }
                }

                // Self-populating caravan community: apprentice training on the road
                if (tick % 5 === 0) {
                    await client.query("UPDATE sim_outlaw_factions SET manpower = LEAST(120, manpower + 2) WHERE id = $1", [cartel.id]);
                }
            }

            // Grind Core NEVER establishes permanent burg lairs! They exist strictly as temporary dive camps at active canyons.
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
        // 10. THE GHOSTSPRING SUBTERRANE (ID 8): Outcast Riverfolk in Mountain Caves
        //     Connecting Hot Springs on Both Sides, Pale Skin Ghost Legend & Smugglers
        // =========================================================================
        else if (cartelId === 8 || cartelName.includes("Ghostspring")) {
            // Strictly 1 single headquarters lair in the central mountain range
            const lairCountRes = await client.query("SELECT COUNT(*) as total FROM sim_fringe_lairs WHERE faction_id = $1", [cartel.id]);
            if (parseInt(lairCountRes.rows[0].total) === 0) {
                const peakCell = cartel.origin_cell_id || 13408;
                const originBurgRes = await client.query("SELECT burg_id FROM sim_burg_economy WHERE cell_id = $1 LIMIT 1", [peakCell]);
                const originBurgId = originBurgRes.rows[0]?.burg_id || 73;
                await client.query(`
                    INSERT INTO sim_fringe_lairs (faction_id, cell_id, burg_id, lair_type, manpower, heat)
                    VALUES ($1, $2, $3, 'CENTRAL_PEAK_SPRING_CAVERN', 40, 5)
                `, [cartel.id, peakCell, originBurgId]);
            }

            // Find mountain burgs on either side of the mountain divide
            const mountainBurgsRes = await client.query(`
                SELECT b.burg_id, b.name, b.cell_id, c.elevation
                FROM sim_burg_economy b
                JOIN sim_cells c ON b.cell_id = c.id
                WHERE c.elevation >= 55
                ORDER BY RANDOM()
                LIMIT 2
            `);
            const mountainBurgs = mountainBurgsRes.rows;

            // A. Subterranean Swimming Across the Mountain Divide (Eastern to Western Springs)
            if (tick % 3 === 0 && mountainBurgs.length >= 2) {
                const [eastBurg, westBurg] = mountainBurgs;
                await client.query("UPDATE sim_outlaw_factions SET wealth = COALESCE(wealth, 0) + 85 WHERE id = $1", [cartel.id]);
                await client.query(`
                    UPDATE sim_burg_economy SET wealth = wealth + 20, raw_materials = raw_materials + 25 WHERE burg_id = $1
                `, [westBurg.burg_id]);

                await client.query(`
                    INSERT INTO sim_events (tick, type, message, tier, faction_id, burg_id, lore_date)
                    VALUES ($1, 'GHOSTSPRING_MOUNTAIN_SWIM', $2, 'MINOR', $3, $4, $5)
                `, [
                    tick,
                    `🏊 TRANS-MOUNTAIN SUBTERRANEAN SWIM: Ghostspring pale-skin divers plunged into steaming geothermal pools outside ${eastBurg.name} and navigated miles of pitch-black flooded cavern flues beneath the central mountain range, surfacing with sealed cargo casks in the hot springs of ${westBurg.name}!`,
                    cartel.id, eastBurg.burg_id, loreDate
                ]);
            }

            // B. Ghost Stories & Haunted Springs Folklore (Superstitious Commoners)
            if (tick % 4 === 1 && mountainBurgs.length > 0) {
                const springBurg = mountainBurgs[0];
                await tagBurgCitizens(
                    client,
                    springBurg.burg_id,
                    ['#HauntedSpringsLegend', '#PaleGhostSighting'],
                    'WARY',
                    `Terrified by sightings of chalk-white figures vanishing beneath boiling sulfur pools, believing the mountain springs are haunted by water-wraiths.`,
                    '%peasant%',
                    2
                );

                await client.query(`
                    INSERT INTO sim_events (tick, type, message, tier, faction_id, burg_id, lore_date)
                    VALUES ($1, 'GHOSTSPRING_HAUNTED_LEGEND', $2, 'MINOR', $3, $4, $5)
                `, [
                    tick,
                    `👻 HAUNTED SPRINGS FOLKLORE: Travelers near the steaming geothermal springs above ${springBurg.name} caught glimpses of chalk-pale, spectral figures vanishing silently beneath boiling sulfur waters. Wild ghost stories spread through mountain inns that the springs are cursed and haunted!`,
                    cartel.id, springBurg.burg_id, loreDate
                ]);
            }

            // C. Obsidian Cartel Bypass Smuggling (Cartel Knows They Are NOT Ghosts)
            if (tick % 4 === 2) {
                const cartelRes = await client.query("SELECT id, wealth FROM sim_outlaw_factions WHERE id = 6");
                if (cartelRes.rows.length > 0 && Number(cartelRes.rows[0].wealth) >= 200) {
                    await client.query("UPDATE sim_outlaw_factions SET wealth = GREATEST(0, wealth - 90) WHERE id = 6");
                    await client.query("UPDATE sim_outlaw_factions SET wealth = wealth + 90 WHERE id = $1", [cartel.id]);

                    await client.query(`
                        INSERT INTO sim_events (tick, type, message, tier, faction_id, burg_id, lore_date)
                        VALUES ($1, 'GHOSTSPRING_CARTEL_BYPASS_RUN', $2, 'MAJOR', $3, $4, $5)
                    `, [
                        tick,
                        `🏔️ CARTEL UNDER-MOUNTAIN BYPASS: Disregarding peasant ghost stories, the Obsidian Cartel contracted Ghostspring pale-skin divers to swim waterproof crates of void-lotus powder through flooded cavern flues beneath the central mountain range, completely bypassing high mountain toll gates and sovereign checkpoints!`,
                        cartel.id, null, loreDate
                    ]);
                }
            }

            // D. Free Sky-Baron Aerie Drop & River Retrieval (Barons Know They Are NOT Ghosts)
            if (tick % 4 === 0) {
                const baronRes = await client.query("SELECT id, wealth FROM sim_outlaw_factions WHERE id = 2");
                if (baronRes.rows.length > 0 && Number(baronRes.rows[0].wealth) >= 200) {
                    await client.query("UPDATE sim_outlaw_factions SET wealth = GREATEST(0, wealth - 80) WHERE id = 2");
                    await client.query("UPDATE sim_outlaw_factions SET wealth = wealth + 80 WHERE id = $1", [cartel.id]);

                    await client.query(`
                        INSERT INTO sim_events (tick, type, message, tier, faction_id, burg_id, lore_date)
                        VALUES ($1, 'GHOSTSPRING_BARON_CARGO_TRANSFER', $2, 'MAJOR', $3, $4, $5)
                    `, [
                        tick,
                        `📦 SKY-BARON SPRING DROP: Knowing the 'haunted springs' are actually subterranean Riverfolk outcasts, Free Sky-Baron cloud-skiffs dropped tethered cargo crates into steaming geothermal pools above the pass, where Ghostspring divers retrieved the contraband underwater to transport beneath the peaks.`,
                        cartel.id, null, loreDate
                    ]);
                }
            }

            // Strictly 1 single central mountain cave network — NO additional lairs!
        }
    }
}

/**
 * Handles authentic lair establishment for each faction type with strict territorial caps
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
    // Only check every 10 ticks
    if (tick % 10 !== 0) return;

    // Strict Syndicate Territorial Cap: Maximum 8 active lairs per syndicate
    const countRes = await client.query("SELECT COUNT(*) FROM sim_fringe_lairs WHERE faction_id = $1", [cartel.id]);
    const currentLairs = parseInt(countRes.rows[0].count) || 0;
    if (currentLairs >= 8) return;

    // Significant capital and manpower deployment required to found a provincial lair
    const wealth = Number(cartel.wealth || 0);
    const manpower = Number(cartel.manpower || 0);

    if (wealth >= 2000 && manpower >= 24 && Math.random() < 0.35) {
        const lairBurg = burgs.find((b: any) => (b.wealth || 0) >= 150 && (b.unrest || 0) >= 10);
        if (!lairBurg) return;

        const existingLair = await client.query(
            `SELECT id, faction_id, manpower FROM sim_fringe_lairs WHERE burg_id = $1 AND faction_id = $2`,
            [lairBurg.burg_id, cartel.id]
        );

        if (existingLair.rows.length === 0) {
            // Deduct investment from central cartel pool
            await client.query(`
                UPDATE sim_outlaw_factions
                SET wealth = GREATEST(0, wealth - 1200),
                    manpower = GREATEST(0, manpower - 24)
                WHERE id = $1
            `, [cartel.id]);

            const inserted = await client.query(
                `INSERT INTO sim_fringe_lairs (faction_id, cell_id, burg_id, lair_type, manpower, heat)
                 VALUES ($1, $2, $3, $4, 24, 15) RETURNING *`,
                [cartel.id, lairBurg.cell_id, lairBurg.burg_id, preferredLairType]
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
