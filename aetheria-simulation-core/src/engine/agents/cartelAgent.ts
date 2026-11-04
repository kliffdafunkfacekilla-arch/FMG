import { PoolClient } from "pg";
import { getCartelLairType, ensureLairResidents } from "./outlawSyndicates";
import { recruitInsideMan, tagBurgCitizens, tagSectorEnvironment } from "./citizenPersonaHelper";

export { getCartelLairType };

/**
 * Autonomous Fringe Factions & Underworld Syndicates Agent:
 * Faithfully executes each faction according to its authentic lore:
 * - Obsidian Cartel: Contraband, Vice Dens & Contract Killings (Assassinations)
 * - Ghostwind Raiders: Mercenaries (Sellsword contracts, raids & caravan escorts - NOT spies)
 * - Free Sky-Barons: Smugglers for the Cartel & Aerial Pirates / Privateers
 * - Gilded Compass: Naval Privateers & Armed Mercantile Trade Fleet
 * - Grind Canyon Corps: Chasm Divers & Titan Relic Excavators (NO smuggling)
 * - Otter Mafia: River mob, canal lock shakedowns & floating gambling speakeasies
 * - Hedge Wizards: Contraband curative poultices, spark charms & occult sanctuary
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
        ORDER BY RANDOM() LIMIT 50
    `);
    const burgs = targetBurgsRes.rows;

    for (const cartel of cartelsRes.rows) {
        const cartelId = Number(cartel.id);

        // =========================================================================
        // 1. THE OBSIDIAN CARTEL (ID 6): Contraband, Vice Dens & Contract Killings
        // =========================================================================
        if (cartelId === 6 || cartel.name.includes("Obsidian")) {
            // A. Contraband distribution & recruiting inside operatives
            const target = burgs.find(b => (b.unrest >= 5 || b.wealth < 1200) && (b.pop_null || 0) >= 12);
            if (target) {
                target.pop_null -= 12;
                await client.query(`UPDATE sim_burg_economy SET pop_null = pop_null - 12, unrest = LEAST(100, unrest + 2) WHERE burg_id = $1`, [target.burg_id]);
                const insideMan = await recruitInsideMan(client, target.burg_id, cartel.name, target.name);
                if (insideMan && Math.random() < 0.4) {
                    await client.query(`
                        INSERT INTO sim_events (tick, type, message, tier, faction_id, burg_id, lore_date)
                        VALUES ($1, 'CARTEL_INSIDE_MAN_RECRUITED', $2, 'MINOR', $3, $4, $5)
                    `, [
                        tick,
                        `${cartel.name} recruited ${insideMan.name} (${insideMan.profession}) in ${target.name} to smuggle void-shards and report city watch patrols.`,
                        cartel.id, target.burg_id, loreDate
                    ]);
                }
            }

            // B. Contract Killings / Assassinations (Brokered underworld hits)
            if (Number(cartel.wealth || 0) >= 300 && tick % 3 === 0) {
                const hitBurg = burgs.find(b => b.wealth > 300);
                if (hitBurg) {
                    await client.query(`
                        UPDATE sim_burg_economy
                        SET unrest = LEAST(100, unrest + 8),
                            health = GREATEST(0, health - 4)
                        WHERE burg_id = $1
                    `, [hitBurg.burg_id]);

                    await tagBurgCitizens(client, hitBurg.burg_id, ['#MurderInquiry', '#VigilantWatch'], 'WARY', `Investigating a lethal contract killing executed by Obsidian Cartel assassins.`, '%watch%', 2);
                    await tagBurgCitizens(client, hitBurg.burg_id, ['#CartelTerrorized'], 'FEARFUL', `Living in fear of underworld retribution after an assassination in ${hitBurg.name}.`, '%merchant%', 2);

                    await client.query(`
                        INSERT INTO sim_events (tick, type, message, tier, faction_id, burg_id, lore_date)
                        VALUES ($1, 'CARTEL_CONTRACT_KILLING', $2, 'MAJOR', $3, $4, $5)
                    `, [
                        tick,
                        `🗡️ OBSIDIAN CARTEL HIT: An assassin from the Obsidian Cartel struck down an influential magistrate in ${hitBurg.name}! City watch discovered an etched black-glass blade left at the murder scene.`,
                        cartel.id, hitBurg.burg_id, loreDate
                    ]);
                }
            }

            // C. Establish Subterranean Vice Dens & Black Markets
            await handleLairEstablishment(client, cartel, burgs, tick, loreDate, "VICE_DEN");
        }

        // =========================================================================
        // 2. THE GHOSTWIND RAIDERS (ID 5): Mercenaries NOT Spies
        // =========================================================================
        else if (cartelId === 5 || cartel.name.includes("Ghostwind")) {
            // Ghostwind Raiders take military sellsword contracts from sovereign factions
            if (tick % 2 === 0) {
                const hiringFactionRes = await client.query(`
                    SELECT id, name, treasury FROM sim_factions WHERE id > 0 AND treasury >= 3000 ORDER BY RANDOM() LIMIT 1
                `);
                if (hiringFactionRes.rows.length > 0) {
                    const clientFaction = hiringFactionRes.rows[0];
                    const rivalBurgRes = await client.query(`
                        SELECT b.burg_id, b.name, b.food, b.wealth FROM sim_burg_economy b
                        JOIN sim_cells c ON b.cell_id = c.id
                        WHERE c.faction_id IS NOT NULL AND c.faction_id != $1 AND b.wealth > 100
                        ORDER BY RANDOM() LIMIT 1
                    `, [clientFaction.id]);

                    if (rivalBurgRes.rows.length > 0) {
                        const targetBurg = rivalBurgRes.rows[0];
                        await client.query("UPDATE sim_factions SET treasury = treasury - 500 WHERE id = $1", [clientFaction.id]);
                        await client.query("UPDATE sim_outlaw_factions SET wealth = COALESCE(wealth, 0) + 500 WHERE id = $1", [cartel.id]);

                        await client.query(`
                            UPDATE sim_burg_economy
                            SET food = GREATEST(0, food - 150),
                                wealth = GREATEST(0, wealth - 80),
                                unrest = LEAST(100, unrest + 12)
                            WHERE burg_id = $1
                        `, [targetBurg.burg_id]);

                        await client.query(`
                            INSERT INTO sim_events (tick, type, message, tier, faction_id, burg_id, lore_date)
                            VALUES ($1, 'GHOSTWIND_MERCENARY_STRIKE', $2, 'MAJOR', $3, $4, $5)
                        `, [
                            tick,
                            `⚔️ MERCENARY RAID: Contracted by ${clientFaction.name}, heavy sellswords of the Ghostwind Raiders struck the supply granaries and horse corrals of Burg ${targetBurg.name}, seizing provisions before vanishing into the steppes!`,
                            cartel.id, targetBurg.burg_id, loreDate
                        ]);
                    }
                }
            }

            // Maintain fortified mercenary enclave
            await handleLairEstablishment(client, cartel, burgs, tick, loreDate, "MERCENARY_ENCLAVE");
        }

        // =========================================================================
        // 3. THE FREE SKY-BARONS (ID 2): Smugglers for the Cartel & Aerial Pirates
        // =========================================================================
        else if (cartelId === 2 || cartel.name.includes("Sky-Barons") || cartel.name.includes("Sky Baron")) {
            // A. Aerial Contraband Smuggling for the Obsidian Cartel
            if (tick % 3 === 0) {
                const destBurg = burgs.find(b => b.wealth > 200);
                if (destBurg) {
                    await client.query(`
                        UPDATE sim_outlaw_factions SET wealth = COALESCE(wealth, 0) + 120 WHERE id = $1
                    `, [cartel.id]);
                    await client.query(`UPDATE sim_outlaw_factions SET wealth = COALESCE(wealth, 0) + 80 WHERE id = 6`); // Share cut with Obsidian Cartel

                    await client.query(`
                        INSERT INTO sim_events (tick, type, message, tier, faction_id, burg_id, lore_date)
                        VALUES ($1, 'SKY_BARON_SMUGGLING_RUN', $2, 'MINOR', $3, $4, $5)
                    `, [
                        tick,
                        `☁️ AERIAL SMUGGLING: Free Sky-Baron cloud-skiffs slipped over the mountain peaks under cloud cover, airdropping contraband cargo to underworld contacts in ${destBurg.name}!`,
                        cartel.id, destBurg.burg_id, loreDate
                    ]);
                }
            }

            // B. Aerial Piracy & Interception
            if (tick % 4 === 0) {
                const victimBurg = burgs.find(b => b.wealth > 400);
                if (victimBurg) {
                    const loot = 75;
                    await client.query(`UPDATE sim_burg_economy SET wealth = GREATEST(0, wealth - $1), unrest = LEAST(100, unrest + 4) WHERE burg_id = $2`, [loot, victimBurg.burg_id]);
                    await client.query(`UPDATE sim_outlaw_factions SET wealth = COALESCE(wealth, 0) + $1 WHERE id = $2`, [loot, cartel.id]);

                    await client.query(`
                        INSERT INTO sim_events (tick, type, message, tier, faction_id, burg_id, lore_date)
                        VALUES ($1, 'AERIAL_PIRACY_INTERCEPTION', $2, 'MAJOR', $3, $4, $5)
                    `, [
                        tick,
                        `🏴‍☠️ AERIAL PIRACY: Free Sky-Baron raiders harpooned and boarded a luxury merchant airship above the high passes, plundering ${loot} gold in cargo bound for ${victimBurg.name}!`,
                        cartel.id, victimBurg.burg_id, loreDate
                    ]);
                }
            }

            await handleLairEstablishment(client, cartel, burgs, tick, loreDate, "SKY_DOCK_ROOST");
        }

        // =========================================================================
        // 4. THE GILDED COMPASS (ID 1): Privateers & Armed Trade Fleet
        // =========================================================================
        else if (cartelId === 1 || cartel.name.includes("Gilded Compass")) {
            // A. Privateer Fleet Action (Maritime Embargo & Hunting Outlaw Vessels)
            if (tick % 3 === 0) {
                const portBurg = burgs.find(b => b.wealth > 300);
                if (portBurg) {
                    await client.query(`
                        UPDATE sim_outlaw_factions SET wealth = COALESCE(wealth, 0) + 160 WHERE id = $1
                    `, [cartel.id]);

                    await client.query(`
                        INSERT INTO sim_events (tick, type, message, tier, faction_id, burg_id, lore_date)
                        VALUES ($1, 'GILDED_COMPASS_PRIVATEER_PATROL', $2, 'MINOR', $3, $4, $5)
                    `, [
                        tick,
                        `⚓ NAVAL PRIVATEERING: Heavily armed war-frigates of the Gilded Compass intercepted foreign smuggling vessels outside the harbor of ${portBurg.name}, seizing contraband as lawful prizes!`,
                        cartel.id, portBurg.burg_id, loreDate
                    ]);
                }
            }

            // B. Armed Trade Fleet Voyage
            if (tick % 5 === 0) {
                const destPort = burgs.find(b => b.wealth > 500);
                if (destPort) {
                    await client.query(`
                        UPDATE sim_burg_economy SET wealth = wealth + 120, food = food + 200 WHERE burg_id = $1
                    `, [destPort.burg_id]);
                    await client.query(`UPDATE sim_outlaw_factions SET wealth = COALESCE(wealth, 0) + 200 WHERE id = $1`, [cartel.id]);

                    await tagBurgCitizens(client, destPort.burg_id, ['#GildedCompassPartner'], 'PROSPEROUS', `Trading luxury spices and bullion with the Gilded Compass armed merchant fleet.`, '%trader%', 2);

                    await client.query(`
                        INSERT INTO sim_events (tick, type, message, tier, faction_id, burg_id, lore_date)
                        VALUES ($1, 'GILDED_COMPASS_TRADE_CONVOY', $2, 'MAJOR', $3, $4, $5)
                    `, [
                        tick,
                        `🚢 ARMED TRADE FLEET: The Gilded Compass merchant convoy docked at ${destPort.name}, unloading rare spices, silken textiles, and meridian bullion to eager merchant guilds!`,
                        cartel.id, destPort.burg_id, loreDate
                    ]);
                }
            }

            await handleLairEstablishment(client, cartel, burgs, tick, loreDate, "ADMIRALTY_VAULT");
        }

        // =========================================================================
        // 5. THE GRIND CANYON CORPS (ID 9): Chasm Divers & Relic Excavators (NO SMUGGLING)
        // =========================================================================
        else if (cartelId === 9 || cartel.name.includes("Grind Canyon")) {
            // The Grind Canyon Corps hoists raw dragonstone and pre-Cruor relics from bottomless chasms
            if (tick % 3 === 0) {
                const partnerBurg = burgs.find(b => b.wealth > 100);
                if (partnerBurg) {
                    await client.query(`
                        UPDATE sim_outlaw_factions SET wealth = COALESCE(wealth, 0) + 140 WHERE id = $1
                    `, [cartel.id]);
                    await client.query(`
                        UPDATE sim_burg_economy SET raw_materials = raw_materials + 150, wealth = wealth + 40 WHERE burg_id = $1
                    `, [partnerBurg.burg_id]);

                    await tagBurgCitizens(client, partnerBurg.burg_id, ['#DragonstoneSmith'], 'INDUSTRIOUS', `Smelting raw abyssal dragonstone hoisted by the Grind Canyon Corps.`, '%smith%', 2);

                    await client.query(`
                        INSERT INTO sim_events (tick, type, message, tier, faction_id, burg_id, lore_date)
                        VALUES ($1, 'CHASM_RELIC_EXTRACTION', $2, 'MAJOR', $3, $4, $5)
                    `, [
                        tick,
                        `⛏️ ABYSSAL EXCAVATION: Grind Canyon Corps dive teams rigged steel winch lines into a grinding wilderness chasm, hoisting up an ancient Pre-Cruor titan relic and 50 lbs of raw dragonstone for the forges of ${partnerBurg.name}!`,
                        cartel.id, partnerBurg.burg_id, loreDate
                    ]);
                }
            }

            await handleLairEstablishment(client, cartel, burgs, tick, loreDate, "CHASM_WINCH_HEAD");
        }

        // =========================================================================
        // 6. THE OTTER MAFIA (ID 7): River Mob, Canal Locks & Floating Speakeasies
        // =========================================================================
        else if (cartelId === 7 || cartel.name.includes("Otter Mafia")) {
            if (tick % 3 === 0) {
                const canalBurg = burgs.find(b => b.wealth > 150);
                if (canalBurg) {
                    await client.query(`
                        UPDATE sim_burg_economy SET wealth = GREATEST(0, wealth - 35), unrest = LEAST(100, unrest + 2) WHERE burg_id = $1
                    `, [canalBurg.burg_id]);
                    await client.query(`UPDATE sim_outlaw_factions SET wealth = COALESCE(wealth, 0) + 50 WHERE id = $1`, [cartel.id]);

                    await tagBurgCitizens(client, canalBurg.burg_id, ['#OtterMobAssociate'], 'WARY', `Paying canal lock tolls and purchasing smuggled eel-wine from Otter Mafia runners.`, '%laborer%', 2);

                    await client.query(`
                        INSERT INTO sim_events (tick, type, message, tier, faction_id, burg_id, lore_date)
                        VALUES ($1, 'OTTER_MAFIA_CANAL_EXTORTION', $2, 'MINOR', $3, $4, $5)
                    `, [
                        tick,
                        `🦦 CANAL RACKET: Otter Mafia lock-bosses established control over the river flues near ${canalBurg.name}, extorting barge tolls and trafficking smuggled eel-wine to dockside speakeasies.`,
                        cartel.id, canalBurg.burg_id, loreDate
                    ]);
                }
            }

            await handleLairEstablishment(client, cartel, burgs, tick, loreDate, "RIVERBOAT_CASINO");
        }

        // =========================================================================
        // 7. THE HEDGE WIZARDS (ID 10): Unbound Coven & Contraband Poultices
        // =========================================================================
        else if (cartelId === 10 || cartel.name.includes("Hedge Wizards")) {
            if (tick % 3 === 0) {
                const sickBurg = burgs.find(b => b.health < 80 || b.unrest > 10);
                if (sickBurg) {
                    await client.query(`
                        UPDATE sim_burg_economy SET health = LEAST(100, health + 6), unrest = GREATEST(0, unrest - 4) WHERE burg_id = $1
                    `, [sickBurg.burg_id]);
                    await client.query(`UPDATE sim_outlaw_factions SET wealth = COALESCE(wealth, 0) + 40 WHERE id = $1`, [cartel.id]);

                    await tagBurgCitizens(client, sickBurg.burg_id, ['#HedgeCharmBearer'], 'DEVOUT', `Carrying unsanctioned curative charms gifted by outlaw Hedge Wizards.`, '%peasant%', 2);

                    await client.query(`
                        INSERT INTO sim_events (tick, type, message, tier, faction_id, burg_id, lore_date)
                        VALUES ($1, 'HEDGE_MAGIC_ALMS', $2, 'MINOR', $3, $4, $5)
                    `, [
                        tick,
                        `✨ OCCULT CHARMS: Outlaw Hedge Wizards operating from the wilderness outskirts of ${sickBurg.name} dispensed curative poultices and warding amulets to commoners fleeing inquisition zealots.`,
                        cartel.id, sickBurg.burg_id, loreDate
                    ]);
                }
            }

            await handleLairEstablishment(client, cartel, burgs, tick, loreDate, "HEDGE_SANCTUARY");
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
    preferredLairType: string
) {
    if (Number(cartel.wealth || 0) >= 300 && Math.random() < 0.25) {
        const lairBurg = burgs.find((b: any) => (b.wealth || 0) >= 150);
        if (!lairBurg) return;

        const existingLair = await client.query(
            `SELECT id, faction_id, manpower FROM sim_fringe_lairs WHERE burg_id = $1 AND faction_id = $2`,
            [lairBurg.burg_id, cartel.id]
        );

        if (existingLair.rows.length === 0) {
            const inserted = await client.query(
                `INSERT INTO sim_fringe_lairs (faction_id, cell_id, burg_id, lair_type, manpower, heat)
                 VALUES ($1, $2, $3, $4, $5, 15) RETURNING *`,
                [cartel.id, lairBurg.cell_id, lairBurg.burg_id, preferredLairType, 50]
            );
            const newLair = inserted.rows[0];
            await ensureLairResidents(client, { ...newLair, cartel_name: cartel.name, cartel_type: cartel.type });

            await client.query(`
                INSERT INTO sim_events (tick, type, message, tier, faction_id, burg_id, lore_date)
                VALUES ($1, 'LAIR_ESTABLISHED', $2, 'MINOR', $3, $4, $5)
            `, [
                tick,
                `${cartel.name} established an independent ${preferredLairType} base in ${lairBurg.name} to expand their provincial operations!`,
                cartel.id, lairBurg.burg_id, loreDate
            ]);
        }
    }
}
