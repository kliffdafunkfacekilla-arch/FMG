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
import { DAYS_PER_MONTH } from "./canon/calendar.js";
import { runMarketAgent } from "./economy/marketAgent.js";
import { runFactionCollapse } from "./agents/factionCollapse.js";
import { applySchemaPatches } from "../db/schemaPatches.js";

let schemaPatched = false;

export async function executeMasterTick(): Promise<{status: string, currentTick: number}> {
    const client = await pool.connect();
    // Agents swallow many query errors. In a transaction the first failed query aborts everything after
    // it, and COMMIT then silently becomes ROLLBACK. Record every failure so a lost tick is never silent.
    const failedQueries: string[] = [];
    const rawQuery = client.query.bind(client) as (...args: any[]) => Promise<any>;
    (client as any).query = (...args: any[]) => {
        const p = rawQuery(...args);
        if (p && typeof p.catch === 'function') {
            p.catch((err: any) => {
                const sql = typeof args[0] === 'string' ? args[0] : args[0]?.text || '';
                failedQueries.push(`${err?.message} :: ${String(sql).replace(/\s+/g, ' ').trim().slice(0, 160)}`);
            });
        }
        return p;
    };
    try {
        // Scripts tick without the server, so make sure added columns exist (once per process)
        if (!schemaPatched) { await applySchemaPatches(client); schemaPatched = true; }
        await client.query('BEGIN');
        
        // Ensure in-memory spatial cache is initialized once for sub-microsecond agent navigation
        await initSpatialCache(client);
        
        // Ensure all active sim_agents retain living citizen personas
        await backfillBlankPersonas(client);
        
        // Fetch current tick: the calendar is the only clock (an event stamped in the future used to make
        // the whole world jump ahead, because the highest event tick counted too)
        const calTickRes = await client.query('SELECT COALESCE(MAX(tick), 0) as t FROM sim_calendar');
        const tick = Number(calTickRes.rows[0]?.t || 0) + 1;

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

        // 5. Faction Planning (Geopolitics): factions with nothing left collapse first
        await runFactionCollapse(client, tick, loreDate);
        await runFactionPlanningAgent(client, tick, loreDate);

        // 5b. Burg Expansion (found new settlements when rich & stable)
        await runBurgExpansionAgent(client, tick, loreDate);

        // 5c. Inter-Faction Commodity Trade & Embargo Engine
        await runInterFactionTradeEngine(client, tick, loreDate);

        // 5d. World market: prices follow world stock levels (weekly)
        await runMarketAgent(client, tick);

        // 6. Wardens
        await runWardenAgent(client, tick, loreDate);

        // 7. Cultists
        await runCultistAgent(client, tick, loreDate);

        // 7b. Mandate of the Chain (The Null Zealots)
        await runMandateAgent(client, tick, loreDate);

        // 8. Underworld Cartels & Autonomous Syndicates
        // The cartel agent writes its outlaw faction ids into sim_events.faction_id (sovereign ids);
        // move them to outlaw_id so faction 1 is never both the Avian Empire and the Gilded Compass.
        const lastEventBeforeCartels = Number((await client.query('SELECT COALESCE(MAX(id), 0) AS m FROM sim_events')).rows[0]?.m) || 0;
        await runCartelAgent(client, tick, loreDate);
        await client.query(
            'UPDATE sim_events SET outlaw_id = faction_id, faction_id = NULL WHERE id > $1 AND faction_id IS NOT NULL',
            [lastEventBeforeCartels]
        );

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
        // Once a month (DAYS_PER_MONTH ticks), maintain a rolling buffer of routine minor events (~25,000 recent logs)
        // Keeps all CRITICAL and MAJOR historical lore forever, preventing multi-million row table bloat
        if (tick % DAYS_PER_MONTH === 0) {
            await client.query(`
                DELETE FROM sim_events
                WHERE tier = 'MINOR' AND id < COALESCE((
                    SELECT id FROM sim_events WHERE tier = 'MINOR' ORDER BY id DESC OFFSET 25000 LIMIT 1
                ), 0)
            `);
        }

        const commit = await client.query('COMMIT');
        if (failedQueries.length) {
            console.warn(`[tick ${tick}] ${failedQueries.length} quer${failedQueries.length === 1 ? 'y' : 'ies'} failed and were swallowed by agents:\n  ` + failedQueries.slice(0, 12).join('\n  '));
        }
        if (commit?.command === 'ROLLBACK') {
            throw new Error(`Tick ${tick} was rolled back: a query failed inside the transaction (${failedQueries[0] || 'unknown'})`);
        }
        return { status: "success", currentTick: tick };
    } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        console.error("Master tick failed:", e);
        throw e;
    } finally {
        (client as any).query = rawQuery;
        client.release();
    }
}
