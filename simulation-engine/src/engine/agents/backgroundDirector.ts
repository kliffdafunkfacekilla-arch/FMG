import { isChaosPeak } from "../canon/calendar.js";
import { PoolClient, Pool } from "pg";
import { Entity } from "../rpg/narrativeTagEngine";
import { evaluateSectorReactions, SectorContext } from "../rpg/narrativeReactionEngine";
import { createThread, advanceThreadClocks } from "../threads/threadEngine.js";
import { openWorldEventThreads } from "../threads/worldThreads.js";
import { advanceArcForThread } from "../threads/storyArcs.js";

// =============================================================
// HEADLESS BACKGROUND DIRECTOR AGENT
// =============================================================
// Simulates the organic progression of distant sectors while the player is away.
// Evaluates tag collisions between living sector assets and dynamic macro
// environmental conditions, updating sector props/NPCs (closed shops,
// ransacked markets, cordoned crime scenes) and propagating major aftermath
// events to sim_events for tavern rumors and news. Also opens world threads straight
// from this tick's major events (threads/worldThreads.ts), so stories start where no
// tactical map has been opened yet.

/** Sector tag for Cruorbus's chaos peak (Canon/04 §2: the Bleed). Replaces a tag named after a retired moon phase. */
export const BLEED_TAG = '#TheBleed';

export interface BackgroundDirectorSummary {
    sectorsEvaluated: number;
    sectorsMutated: number;
    reactionsFired: number;
    eventsLogged: number;
    threadsOpened: number;
    worldThreadsOpened?: number;
    sectorsFailed?: number;
    threadsTicked?: number;
    threadsResolved?: number;
}

/**
 * Runs `fn` inside a savepoint when the client is in a transaction (the tick), so one bad sector rolls
 * back alone instead of aborting the whole tick. Without a transaction it just runs `fn`.
 */
async function isolated<T>(client: PoolClient | Pool, name: string, fn: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false; error: any }> {
    let savepoint = true;
    try { await client.query(`SAVEPOINT ${name}`); } catch { savepoint = false; }
    try {
        const value = await fn();
        if (savepoint) await client.query(`RELEASE SAVEPOINT ${name}`);
        return { ok: true, value };
    } catch (error) {
        if (savepoint) await client.query(`ROLLBACK TO SAVEPOINT ${name}`).catch(() => {});
        return { ok: false, error };
    }
}

export async function runBackgroundDirectorAgent(
    client: PoolClient | Pool,
    currentTick: number,
    loreDate?: string
): Promise<BackgroundDirectorSummary> {
    const summary: BackgroundDirectorSummary = {
        sectorsEvaluated: 0,
        sectorsMutated: 0,
        reactionsFired: 0,
        eventsLogged: 0,
        threadsOpened: 0,
        sectorsFailed: 0
    };

    // 0. Advance existing open thread clocks (STORY_AUDIT Step 3)
    const clockSummary = await advanceThreadClocks(client, currentTick, loreDate);
    summary.threadsTicked = clockSummary.threadsTicked;
    summary.threadsResolved = clockSummary.threadsResolved;
    // A beat thread that ran out fails its story arc
    for (const expired of clockSummary.worldDeltasApplied) {
        await advanceArcForThread(client, expired.threadId, 'expired');
    }

    // 1. Fetch current cosmology / lunar phase from sim_calendar
    const calRes = await client.query(
        `SELECT moon_phase, is_shadow_week, season, dragon_domain
         FROM sim_calendar
         ORDER BY tick DESC LIMIT 1`
    );
    const cal = calRes.rows[0] || {};
    const moonPhase = cal.moon_phase || 'The Halo';
    const isShadowWeek = Boolean(cal.is_shadow_week);

    // 2. Fetch every cached surface sector layer
    const sectorsRes = await client.query(
        `SELECT cell_id, rx, ry, z_layer, props, npcs, features, layer_name
         FROM sim_sector_layers`
    );

    // 3. Process each sector in its own savepoint: one failure no longer aborts the tick
    for (const row of sectorsRes.rows) {
        summary.sectorsEvaluated++;
        const result = await isolated(client, 'bd_sector', () => processSector(client, row, currentTick, loreDate, moonPhase, isShadowWeek, summary));
        if (!result.ok) {
            summary.sectorsFailed!++;
            console.warn(`[Background Director] Sector ${row.cell_id} r[${row.rx},${row.ry}] z${row.z_layer} skipped: ${result.error?.message || result.error}`);
        }
    }

    // 4. Stories from this tick's world events, wherever they happened
    const world = await isolated(client, 'bd_world', () => openWorldEventThreads(client, currentTick));
    if (world.ok) summary.worldThreadsOpened = world.value;
    else console.warn(`[Background Director] World threads skipped: ${world.error?.message || world.error}`);

    return summary;
}

async function processSector(
    client: PoolClient | Pool,
    row: any,
    currentTick: number,
    loreDate: string | undefined,
    moonPhase: string,
    isShadowWeek: boolean,
    summary: BackgroundDirectorSummary
): Promise<void> {
    const cellId = Number(row.cell_id);
    const zLayer = Number(row.z_layer);
    const rx = Number(row.rx);
    const ry = Number(row.ry);

    const npcs: Entity[] = Array.isArray(row.npcs) ? row.npcs : [];
    const props: Entity[] = Array.isArray(row.props) ? row.props : [];

    if (npcs.length === 0 && props.length === 0) return;

    // Fetch burg economics for macro tags
    const burgRes = await client.query(
        `SELECT burg_id, name, unrest, food, wealth, crime_rate, occupier_faction_id
         FROM sim_burg_economy
         WHERE cell_id = $1 LIMIT 1`,
        [cellId]
    );
    const burg = burgRes.rows[0] || null;

    // Build dynamic macro environmental tags
    const globalTags: string[] = [];

    if (burg) {
        if (Number(burg.food || 0) < 1000) {
            globalTags.push('#Famine', '#ResourceScarcity');
        } else if (Number(burg.food || 0) > 100000) {
            globalTags.push('#HarvestAbundance');
        }

        if (Number(burg.unrest || 0) >= 40) {
            globalTags.push('#MartialLaw', '#HighUnrest');
        }

        if (Number(burg.wealth || 0) > 10000) {
            globalTags.push('#CommercialBoom');
        }

        if (Number(burg.crime_rate || 0) > 30) {
            globalTags.push('#UndergroundUnrest', '#SyndicatePresence');
        }
    }

    if (isChaosPeak(moonPhase)) {
        globalTags.push(BLEED_TAG);
    }
    if (isShadowWeek) {
        globalTags.push('#ShadowWeek');
    }

    // Combine sector entities for collision evaluation
    const sectorEntities: Entity[] = [...npcs, ...props];

    const context: SectorContext = {
        burgId: burg ? Number(burg.burg_id) : null,
        burgName: burg ? burg.name : undefined,
        cellId,
        unrest: burg ? Number(burg.unrest) : 0,
        food: burg ? Number(burg.food) : 0,
        wealth: burg ? Number(burg.wealth) : 0,
        tick: currentTick,
        cruorbusPhase: moonPhase,
        isShadowWeek,
        rx,
        ry
    };

    // Evaluate data collisions through NarrativeReactionTable
    const result = evaluateSectorReactions(sectorEntities, globalTags, context);
    if (!result.mutated) return;

    summary.sectorsMutated++;
    summary.reactionsFired += result.rulesTriggered.length;

    // Split back into npcs and props
    const updatedNpcs = sectorEntities.filter(e => e.type === 'NPC');
    const updatedProps = sectorEntities.filter(e => e.type === 'PROP');
    const existingFeatures = row.features && typeof row.features === 'object' ? row.features : {};
    const updatedFeatures = {
        ...existingFeatures,
        environmental_tags: result.newSectorTags,
        last_background_director_tick: currentTick
    };

    await client.query(
        `UPDATE sim_sector_layers
         SET npcs = $1, props = $2, features = $3
         WHERE cell_id = $4 AND z_layer = $5 AND rx = $6 AND ry = $7`,
        [JSON.stringify(updatedNpcs), JSON.stringify(updatedProps), JSON.stringify(updatedFeatures), cellId, zLayer, rx, ry]
    );

    // Open persistent narrative threads in sim_threads (STORY_AUDIT Step 2)
    for (const th of result.threadsToOpen || []) {
        const opened = await isolated(client, 'bd_thread', () => createThread(client, { ...th, created_tick: currentTick }));
        if (opened.ok) summary.threadsOpened++;
        else console.warn(`[Background Director] Could not open thread: ${opened.error?.message}`);
    }

    // Log major aftermath events into sim_events for tavern rumors & news
    for (const ev of result.events) {
        summary.eventsLogged++;
        await client.query(
            `INSERT INTO sim_events
             (tick, burg_id, z_layer, lore_date, type, message, tier)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [currentTick, ev.burgId || null, zLayer, loreDate || `Tick ${currentTick}`, ev.type, ev.message, ev.tier]
        );
    }
}
