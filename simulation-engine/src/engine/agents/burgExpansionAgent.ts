// ─────────────────────────────────────────────────────────────────────────────
//  Burg Expansion Agent
//  When a faction is rich, peaceful, and their capital is populous enough,
//  they can found a new burg in an adjacent unclaimed cell.
// ─────────────────────────────────────────────────────────────────────────────

const EXPANSION_TREASURY_THRESHOLD = 8000;
const EXPANSION_POP_THRESHOLD      = 1200;  // capital needs at least 1200 people
const EXPANSION_UNREST_MAX         = 25;    // can't colonize if too unstable
const EXPANSION_COST               = 5000;

// Names drawn from a procedural pool
const SETTLEMENT_PREFIXES = ["New", "Fort", "Old", "South", "North", "West", "East", "High", "Low", "Little", "Great"];
const SETTLEMENT_ROOTS    = ["haven", "march", "wick", "holm", "ford", "stead", "croft", "gate", "worth", "moor", "cliff", "ridge", "hollow", "crossing", "end"];

function genSettlementName(factionName: string): string {
    const fPrefix = (factionName.split(" ")[0] ?? factionName).substring(0, 4);
    const prefix  = SETTLEMENT_PREFIXES[Math.floor(Math.random() * SETTLEMENT_PREFIXES.length)] ?? "New";
    const root    = SETTLEMENT_ROOTS[Math.floor(Math.random() * SETTLEMENT_ROOTS.length)] ?? "haven";
    return `${prefix}${fPrefix}${root.charAt(0).toUpperCase() + root.slice(1)}`;
}

export async function runBurgExpansionAgent(client: any, tick: number, loreDate: string) {
    const factionRes = await client.query("SELECT * FROM sim_factions");
    const burgRes    = await client.query(
        `SELECT b.burg_id, b.pop_null, b.unrest, b.wealth, b.cell_id, c.faction_id
         FROM sim_burg_economy b
         JOIN sim_cells c ON b.cell_id = c.id`
    );

    for (const faction of factionRes.rows) {
        const treasury = Number(faction.treasury) || 0;
        if (treasury < EXPANSION_TREASURY_THRESHOLD) continue;

        const myBurgs = burgRes.rows.filter((b: any) => b.faction_id === faction.id);
        if (myBurgs.length === 0) continue;

        const capital = myBurgs.sort((a: any, b: any) => b.pop_null - a.pop_null)[0];
        if ((capital.pop_null || 0) < EXPANSION_POP_THRESHOLD) continue;
        if ((capital.unrest  || 0) > EXPANSION_UNREST_MAX)    continue;

        // Only evaluate expansion every 30 ticks per faction (bureaucracy)
        if (tick % 30 !== faction.id % 30) continue;

        // Probability scales with wealth above threshold
        const wealthRatio = Math.min(1.0, (treasury - EXPANSION_TREASURY_THRESHOLD) / 30000);
        const chance = 0.15 + wealthRatio * 0.35;
        if (Math.random() > chance) continue;

        // Find an unclaimed cell adjacent to any of this faction's cells
        const myCellIds = myBurgs.map((b: any) => b.cell_id);
        const candidateRes = await client.query(
            `SELECT c.id, c.biome, c.elevation FROM sim_cells c
             WHERE c.faction_id IS NULL
               AND c.id NOT IN (SELECT cell_id FROM sim_burg_economy)
               AND c.elevation < 80
               AND c.biome NOT IN ('11', '2')
             ORDER BY RANDOM() LIMIT 10`
        );

        if (candidateRes.rows.length === 0) continue;

        const cell = candidateRes.rows[0];
        const newPop = Math.floor(capital.pop_null * 0.05); // 5% of capital migrates
        const newWealth = Math.floor(treasury * 0.05);       // 5% of treasury
        const newFood   = Math.max(1000, newPop * 14);       // 2-week buffer
        const name = genSettlementName(faction.name);

        // Claim the cell for this faction
        await client.query("UPDATE sim_cells SET faction_id = $1 WHERE id = $2", [faction.id, cell.id]);

        // Determine new burg_id
        const maxIdRes = await client.query("SELECT COALESCE(MAX(burg_id), 1300) as m FROM sim_burg_economy");
        const newBurgId = maxIdRes.rows[0].m + 1;

        await client.query(
            `INSERT INTO sim_burg_economy
               (burg_id, cell_id, pop_null, wealth, food, unrest, health, crime_rate, military_forces, demographics, species_demographics)
             VALUES ($1, $2, $3, $4, $5, 0, 80, 0, '{"footmen":20}'::jsonb, '{}', '{}')`,
            [newBurgId, cell.id, newPop, newWealth, newFood]
        );

        // Insert into industrial stockpiles
        await client.query(
            `INSERT INTO sim_industrial_stockpiles (burg_id, complex_inventory) VALUES ($1, '{}') ON CONFLICT DO NOTHING`,
            [newBurgId]
        );

        // Drain from capital
        await client.query(
            `UPDATE sim_burg_economy SET pop_null = GREATEST(100, pop_null - $1) WHERE burg_id = $2`,
            [newPop, capital.burg_id]
        );
        await client.query(
            `UPDATE sim_factions SET treasury = GREATEST(0, treasury - $1) WHERE id = $2`,
            [EXPANSION_COST, faction.id]
        );

        await client.query(
            `INSERT INTO sim_events (tick, type, message, tier, faction_id, lore_date)
             VALUES ($1, 'BURG_FOUNDED', $2, 'MAJOR', $3, $4)`,
            [tick, `${faction.name} has founded a new settlement called "${name}"! ${newPop.toLocaleString()} pioneers depart the capital to carve a new life in the wilderness.`, faction.id, loreDate]
        );
    }
}
