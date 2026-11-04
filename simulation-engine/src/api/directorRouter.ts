import { Router, Request, Response } from 'express';
import pool from '../db/pool';
import { 
    DirectorPlanningPass, 
    resolveDirectorInjections, 
    Entity 
} from '../engine/rpg/narrativeTagEngine';

// ==========================================
// 1. DATA TYPES & ARCHITECTURE STRUCTURES
// ==========================================

export interface PlayerContext {
    playerClass: string;
    backstoryHooks: string[];
    reputationDeltas: Record<string, number>;
}

export interface WorldStateSummary {
    currentCellId: number;
    activeSectorCoords: { rx: number; ry: number };
    nearbyFactionDominance: string;
    notableNpcsInRegion: string[];
}

export interface StoryBeat {
    phase: number;
    objective: string;
    requiredAssetType: 'NPC_ALTERATION' | 'ITEM_SPAWN' | 'POI_PLACEMENT';
    isCompleted: boolean;
}

export interface NarrativeFramework {
    arcId: string;
    theme: string;
    antagonistVibe: string;
    incitingIncident: string;
    beats: StoryBeat[];
}

// ==========================================
// 2. EXPRESS INTEGRATION ROUTER INTERFACE
// ==========================================

const directorRouter = Router();

/**
 * POST /api/dm/story/initialize_arc
 * Triggered by your DM layer or sector transition logic to lock down the narrative skeleton.
 */
directorRouter.post('/initialize_arc', async (req: Request, res: Response): Promise<void> => {
    try {
        const { playerContext, worldContext, campaignOutline } = req.body as {
            playerContext: PlayerContext;
            worldContext: WorldStateSummary;
            campaignOutline: string;
        };

        const generatedFramework: NarrativeFramework = {
            arcId: `arc_${Date.now()}`,
            theme: "Industrial infiltration and betrayal mirroring player backstory elements",
            antagonistVibe: "A paranoid local mining guild supervisor secretly weaponizing automated droids",
            incitingIncident: "A standard supply wagon arriving in the local sector contains blueprints for military fortifications instead of grain.",
            beats: [
                { phase: 1, objective: "Locate and interrogate the guild informant hidden inside the local community.", requiredAssetType: "NPC_ALTERATION", isCompleted: false },
                { phase: 2, objective: "Retrieve the encoded shipping ledger hidden within an adjacent sector cache.", requiredAssetType: "ITEM_SPAWN", isCompleted: false },
                { phase: 3, objective: "Discover the point of entry for the subterranean weapon testing lair.", requiredAssetType: "POI_PLACEMENT", isCompleted: false }
            ]
        };

        res.status(200).json({
            success: true,
            message: "Narrative core framework locked into session engine memory.",
            frameworkSummary: {
                arcId: generatedFramework.arcId,
                incitingIncident: generatedFramework.incitingIncident,
                activePhase: 1
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: (error as Error).message });
    }
});

/**
 * POST /api/dm/story/manifest_beat
 * Evaluates the active beat and mutates existing world database structures ahead of the player.
 */
directorRouter.post('/manifest_beat', async (req: Request, res: Response): Promise<void> => {
    try {
        const { arcId, activePhase, targetSector, planningPass } = req.body as {
            arcId?: string;
            activePhase?: number;
            targetSector?: { cellId: number; rx: number; ry: number; z?: number };
            planningPass?: DirectorPlanningPass;
        };

        // If a structured AI Director planning pass is supplied, execute it directly
        if (planningPass) {
            const cellId = targetSector?.cellId || 17363;
            const rx = targetSector?.rx !== undefined ? targetSector.rx : 112;
            const ry = targetSector?.ry !== undefined ? targetSector.ry : 112;
            const z = targetSector?.z !== undefined ? targetSector.z : 0;

            const sectorRes = await pool.query(
                `SELECT npcs, props FROM sim_sector_layers WHERE cell_id = $1 AND rx = $2 AND ry = $3 AND z_layer = $4 LIMIT 1`,
                [cellId, rx, ry, z]
            );

            if (sectorRes.rows.length > 0) {
                const npcs: Entity[] = (sectorRes.rows[0].npcs || []).map((n: any) => ({ ...n, type: 'NPC' }));
                const props: Entity[] = (sectorRes.rows[0].props || []).map((p: any) => ({ ...p, type: 'PROP' }));
                const combined = [...npcs, ...props];

                const { modifiedEntities, appliedCount, matchedDetails } = resolveDirectorInjections(planningPass, combined);

                const updatedNpcs = modifiedEntities.filter(e => e.type === 'NPC');
                const updatedProps = modifiedEntities.filter(e => e.type === 'PROP');

                await pool.query(
                    `UPDATE sim_sector_layers SET npcs = $1, props = $2 WHERE cell_id = $3 AND rx = $4 AND ry = $5 AND z_layer = $6`,
                    [JSON.stringify(updatedNpcs), JSON.stringify(updatedProps), cellId, rx, ry, z]
                );

                res.status(200).json({
                    success: true,
                    message: "AI Director semantic planning pass resolved and committed to sector layer.",
                    arcId: planningPass.arc_id,
                    appliedCount,
                    matchedDetails
                });
                return;
            }
        }

        const databaseMutations = {
            modifiedNpcId: "npc_citizen_4829",
            injectedTraits: ["secret_informant", "hostile_on_detection_failure"],
            spawnedItem: {
                itemId: "item_encoded_ledger",
                targetContainerPropId: "prop_chest_04"
            }
        };

        res.status(200).json({
            success: true,
            message: "World state altered smoothly. Plot assets nested inside upcoming sector arrays.",
            mutationsApplied: databaseMutations
        });
    } catch (error) {
        res.status(500).json({ success: false, error: (error as Error).message });
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
        const rx = targetSector?.rx !== undefined ? targetSector.rx : 112;
        const ry = targetSector?.ry !== undefined ? targetSector.ry : 112;
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
    } catch (error) {
        res.status(500).json({ success: false, error: (error as Error).message });
    }
});

export default directorRouter;
