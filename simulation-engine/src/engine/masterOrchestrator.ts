import pool from "../db/pool";
import { runCalendarAgent } from "./agents/calendarAgent";
import { runWeatherAgent } from "./agents/weatherAgent";
import { runBurgOperationsAgent } from "./agents/burgOperationsAgent";
import { runLocalParagonAgent } from "./agents/paragonPlanningAgent";
import { runFactionPlanningAgent } from "./agents/factionPlanningAgent";
import { runWardenAgent } from "./agents/wardenAgent";
import { runCultistAgent } from "./agents/cultistAgent";
import { runMandateAgent } from "./agents/mandateAgent";
import { runEncounterAgent } from "./agents/encounterAgent";
import { runChroniclerAgent } from "./agents/chroniclerAgent";
import { runCartelAgent } from "./agents/cartelAgent";
import { runGrindCanyonAgent } from "./agents/grindCanyonAgent";
import { runBurgExpansionAgent } from "./agents/burgExpansionAgent";
import { runInterFactionTradeEngine } from "./economy/interFactionTradeEngine";
import { runTrophicEcologyAgent } from "./agents/trophicEcologyAgent";
import { runNPCRoutineAgent } from "./agents/npcRoutineAgent";
import { runChaosFlowAgent } from "./agents/chaosFlowAgent";
import { runBackgroundDirectorAgent } from "./agents/backgroundDirector";
import { backfillBlankPersonas } from "./agents/citizenPersonaHelper";
import { initSpatialCache } from "./agents/agentMovementHelper";
import { stepActiveRegions } from "../api/regionalRouter";

export async function executeMasterTick(): Promise<{status: string, currentTick: number}> {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Ensure in-memory spatial cache is initialized once for sub-microsecond agent navigation
        await initSpatialCache(client);
        
        // Ensure all active sim_agents retain living citizen personas
        await backfillBlankPersonas(client);
        
        // Fetch current tick
        const calTickRes = await client.query('SELECT COALESCE(MAX(tick), 0) as t FROM sim_calendar');
        const eventTickRes = await client.query('SELECT COALESCE(MAX(tick), 0) as t FROM sim_events');
        const maxTick = Math.max(Number(calTickRes.rows[0]?.t || 0), Number(eventTickRes.rows[0]?.t || 0));
        const tick = maxTick + 1;

        // 1. Calendar
        const cal = await runCalendarAgent(client, tick);
        const loreDate = cal.loreDate;

        // 2. Weather & Trophic Ecology
        await runWeatherAgent(client, tick, cal.season, cal.dayOfMonth, loreDate, cal.isShadowWeek);
        await runTrophicEcologyAgent(client, tick, cal.season, loreDate, {
            month: cal.month,
            monthName: cal.monthName,
            activeDragon: cal.activeFlow?.dragon,
            activeDomain: cal.activeFlow?.domain,
            cruorbusPhase: cal.cruorbusPhase,
            isShadowWeek: cal.isShadowWeek
        });

        // 2b. Primordial Chaos Flows (12 Meandering Ebb/Flow Rivers)
        await runChaosFlowAgent(client, tick, {
            active_flow: cal.activeFlow.domain,
            dragon_domain: cal.activeFlow.dragon,
            moon_phase: cal.cruorbusPhase
        });

        // 3. Burg Operations
        await runBurgOperationsAgent(client, tick, loreDate);

        // 4. Local Paragon AI
        await runLocalParagonAgent(client, tick, loreDate);

        // 5. Faction Planning (Geopolitics)
        await runFactionPlanningAgent(client, tick, loreDate);

        // 5b. Burg Expansion (found new settlements when rich & stable)
        await runBurgExpansionAgent(client, tick, loreDate);

        // 5c. Inter-Faction Commodity Trade & Embargo Engine
        await runInterFactionTradeEngine(client, tick, loreDate);

        // 6. Wardens
        await runWardenAgent(client, tick, loreDate);

        // 7. Cultists
        await runCultistAgent(client, tick, loreDate);

        // 7b. Mandate of the Chain (The Null Zealots)
        await runMandateAgent(client, tick, loreDate);

        // 8. Underworld Cartels & Autonomous Syndicates
        await runCartelAgent(client, tick, loreDate);

        // 8b. Grind Canyon Dynamic Chasms (Pre-Cruor Ruins & Dragonstone Diving)
        await runGrindCanyonAgent(client, tick, loreDate);

        // 9. Encounters & NPC Routines
        await runEncounterAgent(client, tick);
        await runNPCRoutineAgent(client, tick, loreDate);

        // 9b. Headless Background Director (Simulates unobserved sector tag collisions and cascades aftermaths)
        await runBackgroundDirectorAgent(client, tick, loreDate);

        // 9c. Focused Regional Meso Simulation Step (Discrete cell-by-cell movement on tick)
        stepActiveRegions(tick);

        // 10. Chronicler
        await runChroniclerAgent(client, tick, loreDate);

        // 11. The Reaper (Purge Ghost Burgs but leave Ruins)
        // We do NOT delete the burg itself, so it remains as a geographical ruin.
        // But we purge all active agents, infrastructure, and resources.
        await client.query("DELETE FROM sim_paragons WHERE burg_id IN (SELECT burg_id FROM sim_burg_economy WHERE pop_null <= 0 AND pop_attuned <= 0)");
        await client.query("DELETE FROM sim_infrastructure WHERE burg_id IN (SELECT burg_id FROM sim_burg_economy WHERE pop_null <= 0 AND pop_attuned <= 0)");
        await client.query("DELETE FROM sim_fringe_lairs WHERE burg_id IN (SELECT burg_id FROM sim_burg_economy WHERE pop_null <= 0 AND pop_attuned <= 0)");
        await client.query("DELETE FROM sim_industrial_stockpiles WHERE burg_id IN (SELECT burg_id FROM sim_burg_economy WHERE pop_null <= 0 AND pop_attuned <= 0)");
        // Strip the faction ownership from ruins so they revert to neutral territory
        await client.query("UPDATE sim_burg_economy SET occupier_faction_id = NULL WHERE pop_null <= 0 AND pop_attuned <= 0");

        // 12. Event Retention & Storage Maintenance
        // Every Dragon Month (44 ticks), maintain a rolling buffer of routine minor events (~25,000 recent logs)
        // Keeps all CRITICAL and MAJOR historical lore forever, preventing multi-million row table bloat
        if (tick % 44 === 0) {
            await client.query(`
                DELETE FROM sim_events
                WHERE tier = 'MINOR' AND id < COALESCE((
                    SELECT id FROM sim_events WHERE tier = 'MINOR' ORDER BY id DESC OFFSET 25000 LIMIT 1
                ), 0)
            `);
        }

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
