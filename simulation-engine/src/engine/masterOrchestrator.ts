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
import { runSeeded, seedSql, tickSeed } from "./rng.js";

let schemaPatched = false;

export interface TickResult {
    status: "success" | "partial";
    currentTick: number;
    /** Agents whose work this tick was rolled back because a query in them failed; the rest committed. */
    failedAgents: { agent: string; error: string }[];
    /** Milliseconds per step, in run order. */
    timings: Record<string, number>;
    /** Database round trips per step. */
    queries: Record<string, number>;
    /** With TICK_PROFILE=1: the slowest statement shapes per step (total ms, calls). */
    profile?: Record<string, { sql: string; ms: number; calls: number }[]>;
    totalMs: number;
}

/**
 * One simulated day. Every agent runs in its own savepoint inside one transaction: a failed query rolls
 * back that agent's work only, and the rest of the day commits (it used to abort the whole tick). The
 * calendar is the exception: without it there is no day, so its failure fails the tick.
 *
 * Randomness is seeded from the tick (rng.ts), for Math.random and SQL random() alike, so the same world
 * state and tick always produce the same day.
 */
export function executeMasterTick(): Promise<TickResult> {
    return runTick();
}

async function runTick(): Promise<TickResult> {
    const client = await pool.connect();
    const started = performance.now();
    // Agents swallow many query errors; record every failure so none is silent.
    const failedQueries: string[] = [];
    const rawQuery = client.query.bind(client) as (...args: any[]) => Promise<any>;
    let queryCount = 0;
    const profiling = process.env.TICK_PROFILE === '1';
    let currentStep = 'start';
    const shapes = new Map<string, { step: string; sql: string; ms: number; calls: number }>();
    (client as any).query = (...args: any[]) => {
        queryCount++;
        const startedQ = profiling ? performance.now() : 0;
        const p = rawQuery(...args);
        if (profiling && p && typeof p.then === 'function') {
            const sql = String(typeof args[0] === 'string' ? args[0] : args[0]?.text || '').replace(/\s+/g, ' ').trim().slice(0, 120);
            const key = currentStep + '|' + sql;
            const done = () => { const s = shapes.get(key) || { step: currentStep, sql, ms: 0, calls: 0 }; s.ms += performance.now() - startedQ; s.calls++; shapes.set(key, s); };
            p.then(done, done);
        }
        if (p && typeof p.catch === 'function') {
            p.catch((err: any) => {
                const sql = typeof args[0] === 'string' ? args[0] : args[0]?.text || '';
                failedQueries.push(`${err?.message} :: ${String(sql).replace(/\s+/g, ' ').trim().slice(0, 160)}`);
            });
        }
        return p;
    };
    const failedAgents: TickResult["failedAgents"] = [];
    const timings: Record<string, number> = {};
    const queries: Record<string, number> = {};
    let stepNo = 0;

    /** Runs one agent in a savepoint; on failure rolls back just that agent and carries on. */
    const step = async (name: string, fn: () => Promise<unknown>, required = false) => {
        const sp = `agent_${++stepNo}`;
        const t0 = performance.now();
        const failuresBefore = failedQueries.length;
        const queriesBefore = queryCount;
        currentStep = name;
        await rawQuery(`SAVEPOINT ${sp}`);
        let thrown: any = null;
        try { await fn(); } catch (e) { thrown = e; }
        // A failed query the agent swallowed leaves the transaction aborted: RELEASE then fails too.
        let aborted = !!thrown;
        if (!aborted) {
            try { await rawQuery(`RELEASE SAVEPOINT ${sp}`); } catch { aborted = true; }
        }
        if (aborted) {
            await rawQuery(`ROLLBACK TO SAVEPOINT ${sp}`);
            const error = thrown?.message || failedQueries[failuresBefore] || 'transaction aborted';
            failedAgents.push({ agent: name, error });
            console.warn(`[tick] ${name} failed and was rolled back; the rest of the day goes on: ${error}`);
            if (required) throw new Error(`${name} failed: ${error}`);
        }
        timings[name] = Math.round(performance.now() - t0);
        queries[name] = queryCount - queriesBefore;
    };

    try {
        // Scripts tick without the server, so make sure added columns exist (once per process)
        if (!schemaPatched) { await applySchemaPatches(client); schemaPatched = true; }
        await client.query('BEGIN');

        // The calendar is the only clock (an event stamped in the future used to make the world jump ahead)
        const calTickRes = await client.query('SELECT COALESCE(MAX(tick), 0) as t FROM sim_calendar');
        const tick = Number(calTickRes.rows[0]?.t || 0) + 1;
        const seed = tickSeed(tick);
        await client.query('SELECT setseed($1)', [seedSql(seed)]);

        return await runSeeded(seed, async () => {
            await step('setup', async () => {
                await initSpatialCache(client);       // in-memory spatial cache for agent navigation
                await backfillBlankPersonas(client);  // every active sim_agent keeps a living persona
            });

            // 1. Calendar
            let cal: any;
            await step('calendar', async () => { cal = await runCalendarAgent(client, tick); }, true);
            const loreDate = cal.loreDate;

            // 2. Weather, ecology and the twelve chaos flows
            await step('weather', () => runWeatherAgent(client, tick, cal.season, cal.dayOfMonth, loreDate, cal.isShadowWeek));
            await step('ecology', () => runTrophicEcologyAgent(client, tick, cal.season, loreDate, {
                month: cal.month,
                monthName: cal.monthName,
                activeDragon: cal.activeFlow?.dragon,
                activeDomain: cal.activeFlow?.domain,
                cruorbusPhase: cal.cruorbusPhase,
                isShadowWeek: cal.isShadowWeek
            }));
            await step('chaosFlows', () => runChaosFlowAgent(client, tick, {
                active_flow: cal.activeFlow.domain,
                dragon_domain: cal.activeFlow.dragon,
                moon_phase: cal.cruorbusPhase
            }));

            // 3. Burgs: production, food, health, births and deaths
            await step('burgOperations', () => runBurgOperationsAgent(client, tick, loreDate));

            // 4-5. Paragons, factions, expansion, trade, market
            await step('paragons', () => runLocalParagonAgent(client, tick, loreDate));
            await step('factionCollapse', () => runFactionCollapse(client, tick, loreDate));
            await step('factionPlanning', () => runFactionPlanningAgent(client, tick, loreDate));
            await step('burgExpansion', () => runBurgExpansionAgent(client, tick, loreDate));
            await step('trade', () => runInterFactionTradeEngine(client, tick, loreDate));
            await step('market', () => runMarketAgent(client, tick));

            // 6-8. Wardens, cultists, the Mandate, cartels, Grind Canyon
            await step('wardens', () => runWardenAgent(client, tick, loreDate));
            await step('cultists', () => runCultistAgent(client, tick, loreDate));
            await step('mandate', () => runMandateAgent(client, tick, loreDate));
            await step('cartels', async () => {
                // The cartel agent writes its outlaw faction ids into sim_events.faction_id (sovereign ids);
                // move them to outlaw_id so faction 1 is never both the Avian Empire and the Gilded Compass.
                const before = Number((await client.query('SELECT COALESCE(MAX(id), 0) AS m FROM sim_events')).rows[0]?.m) || 0;
                await runCartelAgent(client, tick, loreDate);
                await client.query('UPDATE sim_events SET outlaw_id = faction_id, faction_id = NULL WHERE id > $1 AND faction_id IS NOT NULL', [before]);
            });
            await step('grindCanyon', () => runGrindCanyonAgent(client, tick, loreDate));

            // 9. Encounters, NPC routines, the background story director
            await step('encounters', () => runEncounterAgent(client, tick));
            await step('npcRoutines', () => runNPCRoutineAgent(client, tick, loreDate));
            await step('backgroundDirector', () => runBackgroundDirectorAgent(client, tick, loreDate));

            // 10. Chronicler
            await step('chronicler', () => runChroniclerAgent(client, tick, loreDate));

            // 11. The Reaper: a burg with nobody left stays as a ruin, stripped of its agents and assets
            await step('reaper', async () => {
                const ghosts = await client.query("SELECT burg_id FROM sim_burg_economy WHERE pop_null <= 0 AND COALESCE(pop_attuned, 0) <= 0");
                const ids = ghosts.rows.map((r: any) => r.burg_id);
                if (ids.length === 0) return;
                for (const table of ["sim_paragons", "sim_infrastructure", "sim_fringe_lairs", "sim_industrial_stockpiles"]) {
                    await client.query(`DELETE FROM ${table} WHERE burg_id = ANY($1)`, [ids]);
                }
                // Ruins revert to neutral territory
                await client.query("UPDATE sim_burg_economy SET occupier_faction_id = NULL WHERE burg_id = ANY($1) AND occupier_faction_id IS NOT NULL", [ids]);
            });

            // 12. Once a month keep a rolling buffer of ~25,000 MINOR events; CRITICAL and MAJOR lore stay forever
            if (tick % DAYS_PER_MONTH === 0) {
                await step('eventRetention', () => client.query(`
                    DELETE FROM sim_events
                    WHERE tier = 'MINOR' AND id < COALESCE((
                        SELECT id FROM sim_events WHERE tier = 'MINOR' ORDER BY id DESC OFFSET 25000 LIMIT 1
                    ), 0)
                `));
            }

            const commit = await client.query('COMMIT');
            if (commit?.command === 'ROLLBACK') {
                throw new Error(`Tick ${tick} was rolled back: ${failedQueries[0] || 'unknown'}`);
            }
            // In-memory regional simulations step only once the day is committed, so a failed tick can never
            // leave them a day ahead of the database.
            stepActiveRegions(tick);

            const totalMs = Math.round(performance.now() - started);
            if (failedQueries.length) {
                console.warn(`[tick ${tick}] ${failedQueries.length} quer${failedQueries.length === 1 ? 'y' : 'ies'} failed:\n  ` + failedQueries.slice(0, 12).join('\n  '));
            }
            return { status: failedAgents.length ? "partial" : "success", currentTick: tick, failedAgents, timings, queries, totalMs,
                profile: profiling ? [...shapes.values()].reduce((acc: any, s) => { (acc[s.step] ||= []).push({ sql: s.sql, ms: Math.round(s.ms), calls: s.calls }); acc[s.step].sort((a: any, b: any) => b.ms - a.ms); acc[s.step].splice(5); return acc; }, {}) : undefined } as TickResult;
        });
    } catch (e) {
        await rawQuery('ROLLBACK').catch(() => {});
        console.error("Master tick failed:", e);
        throw e;
    } finally {
        (client as any).query = rawQuery;
        client.release();
    }
}
