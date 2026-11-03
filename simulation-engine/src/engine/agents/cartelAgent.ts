import { PoolClient } from "pg";

export function getCartelLairType(cartel: any): string {
    const id = Number(cartel.id);
    const name = String(cartel.name || "");

    if (id === 1 || name.includes("Gilded Compass")) {
        return Math.random() < 0.5 ? "SHADOW_VAULT" : "USURY_HOUSE";
    }
    if (id === 2 || name.includes("Free Sky")) {
        return Math.random() < 0.5 ? "CONTRABAND_DOCK" : "SKY_CORSAIR_CACHE";
    }
    if (id === 3 || name.includes("Devil's Choice")) {
        return "MERCENARY_GARRISON";
    }
    if (id === 4 || name.includes("Ivory-Gate")) {
        return Math.random() < 0.5 ? "TOLL_BLOCKADE" : "ENFORCER_DEN";
    }
    if (id === 5 || name.includes("Ghostwind")) {
        return Math.random() < 0.5 ? "RAIDER_REDOUBT" : "SMUGGLER_COVE";
    }
    return cartel.type === "SMUGGLER" ? "BLACK_MARKET" : "VICE_DEN";
}

export async function runCartelAgent(client: PoolClient, tick: number, loreDate: string) {
    // 1. Fetch Cartels (Fringe Factions)
    const cartelsRes = await client.query("SELECT * FROM sim_outlaw_factions");
    
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

    // 2. Hustle & Recruit Logic (Paragon deploys workers)
    const targetBurgsRes = await client.query("SELECT burg_id, cell_id, name, unrest, pop_null, wealth, health FROM sim_burg_economy ORDER BY RANDOM() LIMIT 50");
    const burgs = targetBurgsRes.rows;

    for (const cartel of cartelsRes.rows) {
        if (cartel.worker_groups <= 0) continue;

        let availableWorkers = cartel.worker_groups;
        let successfulRecruits = 0;
        let hustleWealth = 0;

        // Deploy workers to specific tasks: 30% to recruiting, 70% to hustling
        let recruiters = Math.floor(availableWorkers * 0.3) + 1;
        let hustlers = availableWorkers - recruiters;

        // --- RECRUITING PHASE ---
        for (let i = 0; i < recruiters; i++) {
            const target = burgs.find(b => b.unrest > 40 && b.pop_null >= 12);
            if (target) {
                const successChance = (target.unrest / 100) + (cartel.paragon?.traits?.includes("Ruthless") ? 0.2 : 0);
                if (Math.random() < successChance) {
                    successfulRecruits++;
                    target.pop_null -= 12; // Siphon a group of 12 workers from the disenfranchised
                    await client.query(`UPDATE sim_burg_economy SET pop_null = pop_null - 12 WHERE burg_id = $1`, [target.burg_id]);
                }
            }
        }

        // --- HUSTLING PHASE (Specialized Illicit Operations) ---
        for (let i = 0; i < hustlers; i++) {
            const target = burgs.find(b => b.wealth > 100);
            if (target) {
                const haul = 50 + Math.floor(Math.random() * 50);
                hustleWealth += haul;
                target.wealth -= haul;
                target.health = Math.max(0, target.health - 1);
                
                await client.query(
                    `UPDATE sim_burg_economy SET wealth = CASE WHEN wealth - $1 < 0 THEN 0 ELSE wealth - $1 END, health = CASE WHEN health - 1 < 0 THEN 0 ELSE health - 1 END WHERE burg_id = $2`,
                    [haul, target.burg_id]
                );

                // Hustling in a burg where this cartel holds a lair increases local heat
                await client.query(
                    `UPDATE sim_fringe_lairs SET heat = LEAST(100, heat + 3) WHERE burg_id = $1 AND faction_id = $2`,
                    [target.burg_id, cartel.id]
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
                    [tick, `${cartel.paragon.name} deployed underworld recruiters to absorb ${successfulRecruits * 12} disenfranchised laborers into ${cartel.name}!`, cartel.id, loreDate]
                );
            }
        }

        // --- LAIR ESTABLISHMENT & TURF WARS ---
        if (Number(cartel.wealth || 0) >= 500 && (Number(cartel.manpower || 0) >= 100 || Number(cartel.worker_groups || 0) >= 2)) {
            const lairBurg = burgs.find((b: any) => (b.wealth || 0) >= 200);
            if (lairBurg && Math.random() < 0.2) {
                const lairType = getCartelLairType(cartel);
                const existingLair = await client.query(
                    `SELECT id, faction_id, manpower FROM sim_fringe_lairs WHERE burg_id = $1 AND lair_type = $2`,
                    [lairBurg.burg_id, lairType]
                );
                
                if (existingLair.rows.length === 0) {
                    await client.query(
                        `INSERT INTO sim_fringe_lairs (faction_id, cell_id, burg_id, lair_type, manpower, heat)
                         VALUES ($1, $2, $3, $4, $5, 10)`,
                        [cartel.id, lairBurg.cell_id, lairBurg.burg_id, lairType, 50]
                    );
                    await client.query(
                        `INSERT INTO sim_events (tick, type, message, tier, faction_id, burg_id, lore_date)
                         VALUES ($1, 'LAIR_ESTABLISHED', $2, 'MINOR', $3, $4, $5)`,
                        [tick, `${cartel.name} established a hidden ${lairType} in Burg ${lairBurg.name || lairBurg.burg_id} to expand illicit operations!`, cartel.id, lairBurg.burg_id, loreDate]
                    );
                } else if (existingLair.rows[0].faction_id !== cartel.id) {
                    const defender = existingLair.rows[0];
                    const attackerPower = Number(cartel.manpower || 100);
                    const defenderPower = Number(defender.manpower || 50);
                    if (attackerPower >= defenderPower) {
                        await client.query(`DELETE FROM sim_fringe_lairs WHERE id = $1`, [defender.id]);
                        await client.query(
                            `INSERT INTO sim_fringe_lairs (faction_id, cell_id, burg_id, lair_type, manpower, heat)
                             VALUES ($1, $2, $3, $4, $5, 30)`,
                            [cartel.id, lairBurg.cell_id, lairBurg.burg_id, lairType, Math.floor(attackerPower * 0.7)]
                        );
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

    // 3. Heat Resolution, Bribery & City Watch Raids
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
                // City Watch raids and dismantles the lair
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
                        `The City Watch of Burg ${lair.burg_name || lair.burg_id} stormed and dismantled the hidden ${lair.lair_type} operated by ${lair.cartel_name}, arresting 20 syndicate thugs!`,
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
