export async function runChroniclerAgent(client: any, tick: number, loreDate: string) {
    // Only log the macro Chronos turn marker at month and season boundaries to prevent event log bloat
    if (tick % 44 === 1) {
        await client.query(
            "INSERT INTO sim_events (tick, type, message, tier, lore_date) VALUES ($1, 'TURN_LOG', $2, 'MINOR', $3)",
            [tick, `The Chronos wheel turns. A new Dragon Month dawns across Ostraka: ${loreDate}.`, loreDate]
        );
    }
}
