export async function runChroniclerAgent(client: any, tick: number, loreDate: string) {
    // Log the turn
    await client.query("INSERT INTO sim_events (tick, type, message, tier, lore_date) VALUES ($1, 'TURN_LOG', 'The Chronos wheel turns. The agents have executed their plans.', 'MINOR', $2)", [tick, loreDate]);
}
