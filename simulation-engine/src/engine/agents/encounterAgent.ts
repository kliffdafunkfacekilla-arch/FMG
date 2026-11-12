/**
 * Moves wandering beasts and criminals to a random cell each day, each one to its own cell. The old
 * statement drew one random number for the whole UPDATE, so every such agent in the world landed on the
 * same cell, and `id >= x LIMIT 1` without ORDER BY returned whatever row Postgres read first.
 */
export async function runEncounterAgent(client: any, tick: number) {
    const salt = Math.floor(Math.random() * 2147483647);
    await client.query(`
        UPDATE sim_agents a
        SET location_cell_id = (
            SELECT c.id FROM sim_cells c
            WHERE c.id >= floor((SELECT MAX(id) FROM sim_cells) *
                  ((hashtextextended(a.id::text, $1) & 2147483647) / 2147483648.0))
            ORDER BY c.id LIMIT 1
        )
        WHERE a.role IN ('Beasts', 'Criminal')`, [salt]);
}
