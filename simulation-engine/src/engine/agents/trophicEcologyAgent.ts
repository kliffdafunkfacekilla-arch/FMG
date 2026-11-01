import { PoolClient } from "pg";

/**
 * Trophic Ecology Agent:
 * Drives the biological carrying capacity, seasonal flora regrowth,
 * predator-prey balance, and starving predator migration across Ostraka.
 */
export async function runTrophicEcologyAgent(
    client: PoolClient,
    tick: number,
    season: string,
    loreDate: string
) {
    // 1. Seasonal Growth Multipliers
    let plantRegrowth = 0.3;
    let seasonalNotice: string | null = null;

    switch (season) {
        case "The Bloom":
        case "The Awakening":
            plantRegrowth = 0.7; // Rapid spring growth
            break;
        case "The High Sun":
        case "The Harvest":
            plantRegrowth = 0.4;
            break;
        case "The Withering":
            plantRegrowth = 0.05; // Late autumn decay
            break;
        case "The Deep Cold":
            plantRegrowth = -0.15; // Winter dormancy and freeze
            break;
        case "The Thaw":
            plantRegrowth = 0.5;
            break;
        case "The Roaring":
            plantRegrowth = 0.25;
            break;
        default:
            plantRegrowth = 0.3;
    }

    // 2. Botanical Carrying Capacity (Bulk Update)
    if (plantRegrowth > 0) {
        await client.query(`
            UPDATE sim_cells
            SET eco_plants = LEAST(COALESCE(eco_max, 10.0), GREATEST(0.0, COALESCE(eco_plants, 5.0) + $1))
            WHERE COALESCE(eco_blight, 0.0) < 1.0
        `, [plantRegrowth]);
    } else {
        await client.query(`
            UPDATE sim_cells
            SET eco_plants = GREATEST(0.5, COALESCE(eco_plants, 5.0) + $1)
            WHERE COALESCE(eco_blight, 0.0) < 1.0
        `, [plantRegrowth]);
    }

    // 3. Prey Population Dynamics
    // Cells with ample flora see prey populations reproduce
    await client.query(`
        UPDATE sim_cells
        SET eco_prey = LEAST(15.0, COALESCE(eco_prey, 5.0) + 0.25)
        WHERE eco_plants >= 4.0 AND COALESCE(eco_prey, 5.0) < 12.0
    `);

    // Cells with severely depleted flora see prey decline
    await client.query(`
        UPDATE sim_cells
        SET eco_prey = GREATEST(0.5, COALESCE(eco_prey, 5.0) - 0.2)
        WHERE eco_plants < 2.0
    `);

    // 4. Predator-Prey Balance & Starvation Cascade
    // When predators exceed prey (e.g. overhunting prey or natural cycles), predators starve
    const starvingEcosystems = await client.query(`
        SELECT id, eco_predators, eco_prey, cell_features
        FROM sim_cells
        WHERE eco_predators > (eco_prey * 1.4) AND eco_predators >= 2.0
        ORDER BY RANDOM()
        LIMIT 5
    `);

    for (const row of starvingEcosystems.rows) {
        // Predator natural mortality / dispersion
        await client.query(`
            UPDATE sim_cells
            SET eco_predators = GREATEST(0.5, eco_predators - 0.3)
            WHERE id = $1
        `, [row.id]);

        // Find if this cell is near a settlement or highway
        const nearbyBurg = await client.query(`
            SELECT burg_id, unrest FROM sim_burg_economy
            WHERE cell_id = $1 OR cell_id IN (
                SELECT id FROM sim_cells WHERE ABS(id - $1) <= 10
            )
            LIMIT 1
        `, [row.id]);

        if (nearbyBurg.rows.length > 0) {
            const b = nearbyBurg.rows[0];
            // Starving beasts raid livestock or harass outskirts -> slight unrest tick
            await client.query(`
                UPDATE sim_burg_economy
                SET unrest = LEAST(100, unrest + 1),
                    food = GREATEST(0, food - 5)
                WHERE burg_id = $1
            `, [b.burg_id]);
        }
    }

    // 5. Blight & Sacred Dragon Grove Stabilization
    // Broken dragon seals radiate blight to surrounding cells
    await client.query(`
        UPDATE sim_cells c
        SET eco_blight = LEAST(5.0, COALESCE(c.eco_blight, 0.0) + 0.1)
        FROM sim_sacred_groves g
        WHERE g.cell_id = c.id AND g.seal_strength < 30
    `);

    // Strong seals cleanse blight
    await client.query(`
        UPDATE sim_cells c
        SET eco_blight = GREATEST(0.0, COALESCE(c.eco_blight, 0.0) - 0.15)
        FROM sim_sacred_groves g
        WHERE g.cell_id = c.id AND g.seal_strength >= 75
    `);

    // Periodic chronicle event for ecological extremes
    if (tick % 25 === 0 && starvingEcosystems.rows.length >= 3) {
        await client.query(`
            INSERT INTO sim_events (tick, type, message, tier, lore_date)
            VALUES ($1, 'TROPHIC_DISRUPTION', 'Starving predators roam along trade routes and outskirts as wild game populations fluctuate.', 'MINOR', $2)
        `, [tick, loreDate]);
    }
}
