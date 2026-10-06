import pool from "../db/pool";
import { runCalendarAgent } from "./agents/calendarAgent";
import { runWeatherAgent } from "./agents/weatherAgent";
import { runBurgOperationsAgent } from "./agents/burgOperationsAgent";
import { runLocalParagonAgent } from "./agents/paragonPlanningAgent";
import { runFactionPlanningAgent } from "./agents/factionPlanningAgent";
import { runWardenAgent } from "./agents/wardenAgent";
import { runCultistAgent } from "./agents/cultistAgent";
import { runEncounterAgent } from "./agents/encounterAgent";
import { runChroniclerAgent } from "./agents/chroniclerAgent";
import { runCartelAgent } from "./agents/cartelAgent";

export async function executeMasterTick(): Promise<{status: string, currentTick: number}> {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Fetch current tick
        const tickRes = await client.query('SELECT MAX(tick) as t FROM sim_events');
        const tick = (tickRes.rows[0].t || 0) + 1;

        // 1. Calendar
        const cal = await runCalendarAgent(client, tick);
        const loreDate = `Year ${cal.year}, Month ${cal.month}, Day ${cal.dayOfMonth} (${cal.cruorbusPhase})`;

        // 2. Weather
        await runWeatherAgent(client, tick, cal.season, cal.dayOfMonth, loreDate);

        // 3. Burg Operations
        await runBurgOperationsAgent(client, tick);

        // 4. Local Paragon AI
        await runLocalParagonAgent(client, tick);

        // 5. Faction Planning (Geopolitics)
        await runFactionPlanningAgent(client, tick, loreDate);

        // 6. Wardens
        await runWardenAgent(client, tick, loreDate);

        // 7. Cultists
        await runCultistAgent(client, tick, loreDate);

        // 8. Underworld Cartels (Fringe Factions)
        await runCartelAgent(client, tick, loreDate);

        // 9. Encounters
        await runEncounterAgent(client, tick);

        // 10. Chronicler
        await runChroniclerAgent(client, tick, loreDate);

        await client.query('COMMIT');
        return { status: "success", currentTick: tick };
    } catch (e) {
        await client.query('ROLLBACK');
        console.error("Master tick failed:", e);
        throw e;
    } finally {
        client.release();
    }
}
