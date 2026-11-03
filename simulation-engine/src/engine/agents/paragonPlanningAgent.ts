export async function runLocalParagonAgent(client: any, tick: number) {
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
            baseSurvival = 100 - ( (Math.max(0, burg.food) / pop) * 100 ); 
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

        // 4. Action Execution (Each Paragon takes their turn)
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

            if (domain === 'Civil') {
                if (effSurvival > 80) {
                    foodDelta += Math.floor(pop * 0.1); 
                } else if (effProtection > 80) {
                    crimeDelta -= 5;
                    wealthDelta -= 10; 
                } else {
                    wealthDelta += 20; 
                }
            } 
            else if (domain === 'Security') {
                if (effSurvival > 90) {
                    foodDelta += Math.floor(pop * 0.15);
                    unrestDelta += 5; 
                    if (tick % 10 === 0) events.push({ burg_id: burg.burg_id, type: "MARTIAL_LAW", msg: `${p.name} enacted martial law rationing to prevent starvation.`});
                } else {
                    crimeDelta -= 10;
                }
            }
            else if (domain === 'Social') {
                if (effSurvival > 90) {
                    foodDelta += Math.floor(pop * 0.05);
                    healthDelta += 2;
                } else if (effProtection > 90) {
                    healthDelta += 5;
                } else {
                    unrestDelta -= 10;
                    healthDelta += 5;
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

    // Bulk Update
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
            await client.query("INSERT INTO sim_events (tick, type, message, tier, burg_id) VALUES ($1, $2, $3, 'MINOR', $4)", 
                [tick, ev.type, ev.msg, ev.burg_id]);
        }
    }
}
