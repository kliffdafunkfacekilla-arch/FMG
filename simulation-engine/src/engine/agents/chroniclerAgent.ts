import { dateForTick } from "../canon/calendar.js";

export async function runChroniclerAgent(client: any, tick: number, loreDate: string) {
    // Only log the macro Chronos turn marker on the first day of each month (and of Shadowfall) to prevent event log bloat
    if (dateForTick(tick).dayOfMonth === 1) {
        await client.query(
            "INSERT INTO sim_events (tick, type, message, tier, lore_date) VALUES ($1, 'TURN_LOG', $2, 'MINOR', $3)",
            [tick, `The Chronos wheel turns. A new Dragon Month dawns across Ostraka: ${loreDate}.`, loreDate]
        );
    }
}
