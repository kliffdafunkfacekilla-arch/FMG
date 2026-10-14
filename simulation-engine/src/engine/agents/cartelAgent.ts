import { PoolClient } from "pg";

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
            // Spawn a Capo if they don't have one!
            const traits = JSON.stringify([{name: "Ruthless", modifier: 0.2}]);
            const newP = await client.query(`INSERT INTO sim_paragons (outlaw_id, burg_id, title, name, traits) VALUES ($1, $2, 'Syndicate Boss', $3, $4) RETURNING *`, 
                [cartel.id, cartel.capital_burg_id || 0, `${cartel.name} Capo`, traits]);
            paragon = newP.rows[0];
        }
        cartel.paragon = paragon;
    }

    // 2. Hustle & Recruit Logic (Paragon deploys workers)
    const targetBurgsRes = await client.query("SELECT burg_id, cell_id, unrest, pop_null, wealth, health FROM sim_burg_economy ORDER BY RANDOM() LIMIT 50");
    const burgs = targetBurgsRes.rows;

    for (const cartel of cartelsRes.rows) {
        if (cartel.worker_groups <= 0) continue;

        let availableWorkers = cartel.worker_groups;
        let successfulRecruits = 0;
        let hustleWealth = 0;

        // Deploy workers to specific tasks!
        // We dedicate 30% to recruiting, 70% to hustling (generating wealth/lairs)
        let recruiters = Math.floor(availableWorkers * 0.3) + 1;
        let hustlers = availableWorkers - recruiters;

        // --- RECRUITING PHASE ---
        // Cartels actively target populations with high unrest
        for (let i = 0; i < recruiters; i++) {
            // Find a high unrest burg
            const target = burgs.find(b => b.unrest > 40 && b.pop_null >= 12);
            if (target) {
                // Success chance scales with unrest
                const successChance = (target.unrest / 100) + (cartel.paragon?.traits?.includes("Ruthless") ? 0.2 : 0);
                if (Math.random() < successChance) {
                    successfulRecruits++;
                    target.pop_null -= 12; // Steal a full group of 12 workers from the peasants!
                    await client.query(`UPDATE sim_burg_economy SET pop_null = pop_null - 12 WHERE burg_id = $1`, [target.burg_id]);
                }
            }
        }

        // --- HUSTLING PHASE (Vice / Black Market) ---
        for (let i = 0; i < hustlers; i++) {
            const target = burgs.find(b => b.wealth > 100);
            if (target) {
                // Skim wealth
                const haul = 50 + Math.floor(Math.random() * 50);
                hustleWealth += haul;
                target.wealth -= haul;
                target.health = Math.max(0, target.health - 1); // Vice ruins health
                
                await client.query(`UPDATE sim_burg_economy SET wealth = CASE WHEN wealth - $1 < 0 THEN 0 ELSE wealth - $1 END, health = CASE WHEN health - 1 < 0 THEN 0 ELSE health - 1 END WHERE burg_id = $2`, [haul, target.burg_id]);
            }
        }

        // --- RESOLVE DEPLOYMENT ---
        if (successfulRecruits > 0 || hustleWealth > 0) {
            await client.query(`UPDATE sim_outlaw_factions SET worker_groups = worker_groups + $1, wealth = COALESCE(wealth, 0) + $2 WHERE id = $3`, [successfulRecruits, hustleWealth, cartel.id]);
            
            // Log major expansions
            if (successfulRecruits >= 5) {
                await client.query(`INSERT INTO sim_events (tick, type, message, tier, faction_id, lore_date) VALUES ($1, 'CARTEL_EXPANSION', $2, 'MINOR', $3, $4)`, 
                    [tick, `The ${cartel.paragon.name} successfully deployed workers to recruit ${successfulRecruits * 12} new thugs from unresting populations!`, cartel.id, loreDate]);
            }
        }

        // --- LAIR ESTABLISHMENT & TURF WARS ---
        if (Number(cartel.wealth || 0) >= 500 && (Number(cartel.manpower || 0) >= 100 || Number(cartel.worker_groups || 0) >= 2)) {
            const lairBurg = burgs.find((b: any) => (b.wealth || 0) >= 200);
            if (lairBurg && Math.random() < 0.2) {
                const lairType = cartel.type === "SMUGGLER" ? "BLACK_MARKET" : "VICE_DEN";
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
                        `INSERT INTO sim_events (tick, type, message, tier, faction_id, lore_date)
                         VALUES ($1, 'LAIR_ESTABLISHED', $2, 'MINOR', $3, $4)`,
                        [tick, `${cartel.name} established a hidden ${lairType} in Burg ${lairBurg.burg_id} to extract illicit wealth!`, cartel.id, loreDate]
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
                            `INSERT INTO sim_events (tick, type, message, tier, faction_id, lore_date)
                             VALUES ($1, 'TURF_WAR', $2, 'MAJOR', $3, $4)`,
                            [tick, `Turf War erupted in Burg ${lairBurg.burg_id}! ${cartel.name} violently seized the ${lairType} from a rival syndicate!`, cartel.id, loreDate]
                        );
                    }
                }
            }
        }
    }
}
