import { Router, Request, Response, NextFunction } from 'express';
import pool from '../db/pool';
import { createManagedArc, listArcs } from '../engine/threads/storyArcs.js';
import { 
    DirectorPlanningPass, 
    resolveDirectorInjections, 
    Entity 
} from '../engine/rpg/narrativeTagEngine';
import {
    DirectorInputPayload,
    DirectorOutputBlueprint,
    buildDirectorInputPayload,
    validateDirectorMutations,
    commitDirectorMutations,
    generateStoryArc
} from '../engine/rpg/directorBridge';

const directorRouter = Router();

// =========================================================================
// 1. EXPRESS VALIDATION MIDDLEWARE
// =========================================================================

/**
 * Middleware ensuring incoming AI Director blueprints do not attempt to mutate non-existent IDs.
 */
export async function validateBlueprintMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { targetSector, blueprint, inputPayload } = req.body as {
            targetSector?: { cellId: number; rx: number; ry: number; z?: number };
            blueprint?: DirectorOutputBlueprint;
            inputPayload?: DirectorInputPayload;
        };

        if (!blueprint) {
            next();
            return;
        }

        const cellId = targetSector?.cellId || 17363;
        const rx = targetSector?.rx !== undefined ? targetSector.rx : 50;
        const ry = targetSector?.ry !== undefined ? targetSector.ry : 50;
        const z = targetSector?.z !== undefined ? targetSector.z : 0;

        const effectivePayload = inputPayload || await buildDirectorInputPayload(cellId, rx, ry, z);
        const validation = validateDirectorMutations(effectivePayload, blueprint);

        // Attach sanitized blueprint and validation report to request object
        (req as any).validatedBlueprint = validation.sanitizedBlueprint;
        (req as any).validationReport = {
            valid: validation.valid,
            rejectedNpcIds: validation.rejectedNpcIds,
            rejectedPropIds: validation.rejectedPropIds,
            warningCount: validation.warningCount
        };

        next();
    } catch (err: any) {
        res.status(500).json({ success: false, error: `Validation middleware error: ${err.message}` });
    }
}

// =========================================================================
// 2. ROUTE CONTROLLERS
// =========================================================================

/**
 * GET /api/dm/story/context_payload
 * Gathers living simulation indicators (economic, faction, player, sector assets)
 * into the strict Input Payload contract ready for the AI Director.
 */
directorRouter.get('/context_payload', async (req: Request, res: Response): Promise<void> => {
    try {
        const cellId = Number(req.query.cellId) || 17363;
        const rx = req.query.rx !== undefined ? Number(req.query.rx) : 50;
        const ry = req.query.ry !== undefined ? Number(req.query.ry) : 50;
        const z = req.query.z !== undefined ? Number(req.query.z) : 0;
        const playerId = Number(req.query.playerId) || 1;

        const payload = await buildDirectorInputPayload(cellId, rx, ry, z, playerId);
        res.status(200).json(payload);
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/dm/story/validate_mutations
 * Validates any candidate mutation blueprint against the live database cell assets.
 */
directorRouter.post('/validate_mutations', validateBlueprintMiddleware, async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({
        success: true,
        validationReport: (req as any).validationReport,
        sanitizedBlueprint: (req as any).validatedBlueprint
    });
});

/**
 * POST /api/dm/story/generate_arc
 * Autonomous Closed-Loop:
 * 1. Reads live economic and faction simulation state from PostgreSQL.
 * 2. Feeds the structured JSON prompt to the local model (Ollama), procedural fallback.
 * 3. Enforces the output schema contract.
 * 4. Runs validation middleware to drop any hallucinated tokens.
 * 5. Commits sanitized mutations to sim_sector_layers and sim_events.
 */
directorRouter.post('/generate_arc', async (req: Request, res: Response): Promise<void> => {
    try {
        const { targetSector, playerId } = req.body as {
            targetSector?: { cellId: number; rx: number; ry: number; z?: number };
            playerId?: number;
        };

        const cellId = targetSector?.cellId || 17363;
        const rx = targetSector?.rx !== undefined ? targetSector.rx : 50;
        const ry = targetSector?.ry !== undefined ? targetSector.ry : 50;
        const z = targetSector?.z !== undefined ? targetSector.z : 0;
        const pId = playerId || 1;

        // 1. Synthesize input payload from living simulation state
        const inputPayload = await buildDirectorInputPayload(cellId, rx, ry, z, pId);

        // 2. Generate blueprint with the local model (Ollama), procedural fallback
        const rawBlueprint = await generateStoryArc(inputPayload);

        // 3. Validate against real sector assets
        const validation = validateDirectorMutations(inputPayload, rawBlueprint);

        // 4. Commit mutations to persistent database
        const commitResult = await commitDirectorMutations(cellId, rx, ry, z, validation.sanitizedBlueprint);

        // 5. Store it as a managed arc and open a thread for its first beat
        const framework = validation.sanitizedBlueprint.story_arc_framework;
        const managed = framework?.inciting_incident ? await createManagedArc(pool, {
            cellId, rx, ry, z,
            arcKey: framework.arc_id || `arc_${cellId}_${rx}_${ry}`,
            incitingIncident: framework.inciting_incident,
            beats: framework.beats || [],
            focusNpcId: validation.sanitizedBlueprint.database_mutations.npc_alterations[0]?.target_id ?? null,
            source: validation.sanitizedBlueprint.source || 'procedural'
        }) : null;

        res.status(200).json({
            success: true,
            message: "Simulation-driven narrative arc generated, validated, and committed to world state.",
            arcId: managed?.arc.id ?? null,
            threadId: managed?.threadId ?? null,
            source: validation.sanitizedBlueprint.source || 'procedural',
            validationReport: {
                valid: validation.valid,
                rejectedNpcIds: validation.rejectedNpcIds,
                rejectedPropIds: validation.rejectedPropIds,
                warningCount: validation.warningCount
            },
            commitResult,
            activeStoryArc: validation.sanitizedBlueprint.story_arc_framework,
            appliedMutations: validation.sanitizedBlueprint.database_mutations
        });
    } catch (error: any) {
        console.error('Error generating narrative arc:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/dm/story/arcs?cellId=  -  managed arcs (newest first) with their phase, state and beat threads
 */
directorRouter.get('/arcs', async (req: Request, res: Response): Promise<void> => {
    try {
        const cellId = req.query.cellId !== undefined ? Number(req.query.cellId) : undefined;
        const arcs = await listArcs(pool, cellId);
        const threadIds = arcs.flatMap(a => a.thread_ids || []);
        const threads = threadIds.length
            ? (await pool.query(`SELECT id, question, state, clock, clock_max, resolution FROM sim_threads WHERE id = ANY($1::int[])`, [threadIds])).rows
            : [];
        const byId = new Map(threads.map((t: any) => [t.id, t]));
        res.json({ arcs: arcs.map(a => ({ ...a, threads: (a.thread_ids || []).map(id => byId.get(id) || { id, state: 'deleted' }) })) });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/dm/story/manifest_beat
 * Evaluates the active beat and mutates existing world database structures ahead of the player.
 */
directorRouter.post('/manifest_beat', validateBlueprintMiddleware, async (req: Request, res: Response): Promise<void> => {
    try {
        const { targetSector, blueprint } = req.body as {
            targetSector?: { cellId: number; rx: number; ry: number; z?: number };
            blueprint?: DirectorOutputBlueprint;
        };

        const cellId = targetSector?.cellId || 17363;
        const rx = targetSector?.rx !== undefined ? targetSector.rx : 50;
        const ry = targetSector?.ry !== undefined ? targetSector.ry : 50;
        const z = targetSector?.z !== undefined ? targetSector.z : 0;

        const effectiveBlueprint = (req as any).validatedBlueprint || blueprint;

        if (effectiveBlueprint) {
            const commitResult = await commitDirectorMutations(cellId, rx, ry, z, effectiveBlueprint);
            res.status(200).json({
                success: true,
                message: "World state altered smoothly. Plot assets nested inside upcoming sector arrays.",
                commitResult,
                validationReport: (req as any).validationReport,
                mutationsApplied: effectiveBlueprint.database_mutations
            });
            return;
        }

        res.status(400).json({ success: false, error: "Missing blueprint in request body." });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/dm/story/inject_pass
 * Directly resolves and commits an AI Director semantic planning pass to the database.
 */
directorRouter.post('/inject_pass', async (req: Request, res: Response): Promise<void> => {
    try {
        const { arc_id, injections, targetSector } = req.body as {
            arc_id: string;
            injections: any[];
            targetSector?: { cellId: number; rx: number; ry: number; z?: number };
        };

        const cellId = targetSector?.cellId || 17363;
        const rx = targetSector?.rx !== undefined ? targetSector.rx : 50;
        const ry = targetSector?.ry !== undefined ? targetSector.ry : 50;
        const z = targetSector?.z !== undefined ? targetSector.z : 0;

        const sectorRes = await pool.query(
            `SELECT npcs, props FROM sim_sector_layers WHERE cell_id = $1 AND rx = $2 AND ry = $3 AND z_layer = $4 LIMIT 1`,
            [cellId, rx, ry, z]
        );

        if (sectorRes.rows.length === 0) {
            res.status(404).json({ error: "Sector layer not cached in database. Generate or visit sector first." });
            return;
        }

        const npcs: Entity[] = (sectorRes.rows[0].npcs || []).map((n: any) => ({ ...n, type: 'NPC' }));
        const props: Entity[] = (sectorRes.rows[0].props || []).map((p: any) => ({ ...p, type: 'PROP' }));
        const combined = [...npcs, ...props];

        const { modifiedEntities, appliedCount, matchedDetails } = resolveDirectorInjections({ arc_id, injections }, combined);

        const updatedNpcs = modifiedEntities.filter(e => e.type === 'NPC');
        const updatedProps = modifiedEntities.filter(e => e.type === 'PROP');

        await pool.query(
            `UPDATE sim_sector_layers SET npcs = $1, props = $2 WHERE cell_id = $3 AND rx = $4 AND ry = $5 AND z_layer = $6`,
            [JSON.stringify(updatedNpcs), JSON.stringify(updatedProps), cellId, rx, ry, z]
        );

        res.status(200).json({
            success: true,
            arc_id,
            appliedCount,
            matchedDetails,
            sectorUpdated: { cellId, rx, ry, z }
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

export default directorRouter;
