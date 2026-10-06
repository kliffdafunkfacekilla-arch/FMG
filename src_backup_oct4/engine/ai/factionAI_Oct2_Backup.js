"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeFactionStances = computeFactionStances;
exports.processFactionGeopolitics = processFactionGeopolitics;
exports.processFringeFactions = processFringeFactions;
function computeFactionStances(factions, paragons, factionBurgs) {
    const stances = new Map();
    for (const faction of factions) {
        const myBurgs = factionBurgs.get(faction.id) || [];
        const factionParagons = paragons.filter((p) => myBurgs.some((b) => b.burg_id === p.burg_id));
        const leader = factionParagons.find((p) => ["EMPEROR", "EMPRESS", "HIGH_MATRIARCH", "SYNDICATE_BOSS", "PRESIDENT"].includes(p.title)) || factionParagons[0];
        let aggression = faction.trait_aggression || 5;
        let economy = faction.trait_economy || 5;
        let magic = faction.trait_magic || 5;
        if (leader && leader.traits) {
            if (leader.traits.includes("Bloodthirsty"))
                aggression += 3;
            if (leader.traits.includes("Pacifist"))
                aggression -= 3;
            if (leader.traits.includes("Greedy"))
                economy += 3;
            if (leader.traits.includes("Superstitious"))
                magic += 3;
        }
        let stance = "BALANCED";
        if (aggression > economy && aggression > magic) {
            stance = "EXPANSIONIST";
        }
        else if (economy > aggression && economy > magic) {
            stance = "INDUSTRIAL";
        }
        else if (magic > aggression && magic > economy) {
            stance = "MYSTIC";
        }
        stances.set(faction.id, { stance, aggression, economy, magic });
    }
    return stances;
}
async function processFactionGeopolitics(client, tick, loreDate, factions, factionStances, factionBurgs, diploMap) {
    for (const faction of factions) {
        const stanceData = factionStances.get(faction.id);
        if (!stanceData || stanceData.stance !== "EXPANSIONIST")
            continue;
        if (Math.random() < (stanceData.aggression * 0.005)) {
            const isAvian = faction.name && faction.name.toLowerCase().includes("avian");
            if (!isAvian && Math.random() < 0.5) {
                await client.query("INSERT INTO sim_events (tick, type, message, tier, lore_date, faction_id) VALUES ($1, 'FULCRUM_BLOCKADE', $2, 'MAJOR', $3, $4)", [tick, `FULCRUM SANCTION: The Gilded Compass grounded all airships in ${faction.name}. A global trade embargo has been enacted.`, loreDate, faction.id]);
            }
            else {
                await client.query("INSERT INTO sim_events (tick, type, message, tier, lore_date, faction_id) VALUES ($1, 'WAR_DECLARED', $2, 'MAJOR', $3, $4)", [tick, `${faction.name} declared an expansionist campaign.`, loreDate, faction.id]);
                const enemies = factions.filter((f) => f.id !== faction.id);
                if (enemies.length > 0) {
                    const enemy = enemies[Math.floor(Math.random() * enemies.length)];
                    await client.query("INSERT INTO sim_diplomacy (faction_a_id, faction_b_id, status, tension) VALUES ($1, $2, 'WAR', 100) ON CONFLICT (faction_a_id, faction_b_id) DO UPDATE SET status = 'WAR', tension = 100", [faction.id, enemy.id]);
                }
            }
        }
    }
}
async function processFringeFactions(client, tick, loreDate, paragons, burgs) {
    const fringeRes = await client.query("SELECT * FROM sim_fringe_factions");
    const fringes = fringeRes.rows;
    const poolRes = await client.query("SELECT burg_id FROM sim_burg_economy ORDER BY RANDOM() LIMIT 20");
    const pool = poolRes.rows;
    for (const fringe of fringes) {
        const fringeParagons = paragons.filter((p) => p.outlaw_id === fringe.id);
        const leader = fringeParagons[0];
        let agg = 5;
        if (leader && leader.traits && leader.traits.includes("Bloodthirsty"))
            agg += 5;
        if (fringe.type === "RAIDER" && Math.random() < (agg * 0.005)) {
            if (pool.length > 0) {
                const target = pool[Math.floor(Math.random() * pool.length)];
                await client.query("UPDATE sim_burg_economy SET wealth = wealth - 5 WHERE burg_id = $1", [target.burg_id]);
                const leaderName = leader ? leader.name : "Unknown";
                const message = `${fringe.name} (led by ${leaderName}) raided Burg ${target.burg_id}!`;
                await client.query("INSERT INTO sim_events (tick, type, message, tier, lore_date, burg_id) VALUES ($1, 'RAIDER_ATTACK', $2, 'MINOR', $3, $4)", [tick, message, loreDate, target.burg_id]);
            }
        }
    }
}
//# sourceMappingURL=factionAI_Oct2_Backup.js.map