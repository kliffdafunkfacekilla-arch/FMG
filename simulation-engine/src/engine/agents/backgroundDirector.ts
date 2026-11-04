import { PoolClient, Pool } from "pg";
import { Entity } from "../rpg/narrativeTagEngine";
import { evaluateSectorReactions, SectorContext } from "../rpg/narrativeReactionEngine";

// =============================================================
// HEADLESS BACKGROUND DIRECTOR AGENT
// =============================================================
// Simulates the organic progression of distant sectors while the player is away.
// Evaluates tag collisions between living sector assets and dynamic macro
// environmental conditions, updating sector props/NPCs (closed shops,
// ransacked markets, cordoned crime scenes) and propagating major aftermath
// events to sim_events for tavern rumors and news.

export interface BackgroundDirectorSummary {
    sectorsEvaluated: number;
    sectorsMutated: number;
    reactionsFired: number;
    eventsLogged: number;
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
        eventsLogged: 0
    };

    try {
        // 1. Fetch current cosmology / lunar phase from sim_calendar
        const calRes = await client.query(
            `SELECT moon_phase, is_shadow_week, season, dragon_domain 
             FROM sim_calendar 
             ORDER BY tick DESC LIMIT 1`
        );
        const cal = calRes.rows[0] || {};
        const moonPhase = cal.moon_phase || 'The Full Blood';
        const isShadowWeek = Boolean(cal.is_shadow_week);

        // 2. Fetch all cached sector layers in the world
        const sectorsRes = await client.query(
            `SELECT cell_id, rx, ry, z_layer, props, npcs, features, layer_name 
             FROM sim_sector_layers`
        );

        if (sectorsRes.rows.length === 0) {
            return summary;
        }

        // 3. Process each sector
        for (const row of sectorsRes.rows) {
            summary.sectorsEvaluated++;
            const cellId = Number(row.cell_id);
            const zLayer = Number(row.z_layer);
            const rx = Number(row.rx);
            const ry = Number(row.ry);

            const npcs: Entity[] = Array.isArray(row.npcs) ? row.npcs : [];
            const props: Entity[] = Array.isArray(row.props) ? row.props : [];

            if (npcs.length === 0 && props.length === 0) continue;

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

            if (moonPhase.toLowerCase().includes('full blood')) {
                globalTags.push('#FullBlood');
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
                isShadowWeek
            };

            // Evaluate data collisions through NarrativeReactionTable
            const result = evaluateSectorReactions(sectorEntities, globalTags, context);

            if (result.mutated) {
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

                // Save back to sim_sector_layers
                await client.query(
                    `UPDATE sim_sector_layers 
                     SET npcs = $1, props = $2, features = $3 
                     WHERE cell_id = $4 AND z_layer = $5 AND rx = $6 AND ry = $7`,
                    [
                        JSON.stringify(updatedNpcs),
                        JSON.stringify(updatedProps),
                        JSON.stringify(updatedFeatures),
                        cellId,
                        zLayer,
                        rx,
                        ry
                    ]
                );

                // Log major aftermath events into sim_events for tavern rumors & news
                for (const ev of result.events) {
                    summary.eventsLogged++;
                    await client.query(
                        `INSERT INTO sim_events 
                         (tick, burg_id, z_layer, lore_date, type, message, tier) 
                         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                        [
                            currentTick,
                            ev.burgId || null,
                            zLayer,
                            loreDate || `Tick ${currentTick}`,
                            ev.type,
                            ev.message,
                            ev.tier
                        ]
                    );
                }
            }
        }

        return summary;
    } catch (err) {
        console.error("Headless Background Director error:", err);
        return summary;
    }
}

