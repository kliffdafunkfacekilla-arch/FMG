import { Router, Request, Response } from 'express';
import { processPlayerActionWithDM, DMContextPayload } from '../engine/aiGameMaster';
import pool from '../db/pool';

const router = Router();

router.post('/interact', async (req: Request, res: Response) => {
    try {
        const { sessionId, characterId, playerInput } = req.body;
        
        // 1. Fetch real character state from DB
        const charRes = await pool.query('SELECT * FROM player_characters WHERE character_id = $1 AND session_id = $2', [characterId, sessionId]);
        if (charRes.rows.length === 0) {
            return res.status(404).json({ error: "Character not found in this session" });
        }
        const character = charRes.rows[0];

        // 2. Fetch session and map context
        const sessionRes = await pool.query('SELECT * FROM game_sessions WHERE session_id = $1', [sessionId]);
        const session = sessionRes.rows[0];

        const payload: DMContextPayload = {
            worldName: session.name,
            biome: 'Crypt / Dungeon',
            chaosLevel: session.chaos_level,
            characterName: character.name,
            creatureType: character.creature_type,
            currentAttributes: character,
            playerInput: playerInput
        };

        // 3. AI parsing
        const dmResult = await processPlayerActionWithDM(payload);
        const actionResult = dmResult.parsedCommand;

        let narrativeContext = dmResult.narrativeResponse;
        
        // 4. Mutate State in Database
        if (actionResult.actionType === 'MOVEMENT') {
            let dx = 0;
            let dy = 0;
            
            switch (actionResult.direction) {
                case 'N': dy = -1; break;
                case 'S': dy = 1; break;
                case 'E': dx = 1; break;
                case 'W': dx = -1; break;
                case 'NE': dx = 1; dy = -1; break;
                case 'NW': dx = -1; dy = -1; break;
                case 'SE': dx = 1; dy = 1; break;
                case 'SW': dx = -1; dy = 1; break;
                default: 
                    // If no direction inferred, just don't move or pick random? Let's just default to not moving.
                    break;
            }
            
            let newX = character.grid_x + dx;
            let newY = character.grid_y + dy;
            
            const mapWidth = 20;
            const mapHeight = 15;
            let transitioned = false;
            let collision = false;
            let collisionMsg = '';

            // 4a. Check Local Collision before transitioning
            if (newX >= 0 && newX < mapWidth && newY >= 0 && newY < mapHeight) {
                // Check Map Walls
                const mapRes = await pool.query('SELECT layout_data FROM interior_sub_maps WHERE sub_map_id = $1', [session.current_sub_map_id]);
                if (mapRes.rows.length > 0) {
                    const layout = typeof mapRes.rows[0].layout_data === 'string' ? JSON.parse(mapRes.rows[0].layout_data) : mapRes.rows[0].layout_data;
                    const targetCell = layout.find((c: any) => c.x === newX && c.y === newY);
                    if (targetCell && targetCell.terrain === 'WALL') {
                        collision = true;
                        collisionMsg = 'A solid barrier blocks your path.';
                    }
                }
                
                // Check NPCs
                if (!collision) {
                    const npcRes = await pool.query('SELECT name FROM npc_entities WHERE sub_map_id = $1 AND grid_x = $2 AND grid_y = $3 AND hp_current > 0', [session.current_sub_map_id, newX, newY]);
                    if (npcRes.rows.length > 0) {
                        collision = true;
                        collisionMsg = `You bump into a ${npcRes.rows[0].name}.`;
                    }
                }
            }
            
            if (collision) {
                narrativeContext += `\n[Mechanics: Movement to (${newX}, ${newY}) failed. ${collisionMsg}]`;
                // Revert to original position
                newX = character.grid_x;
                newY = character.grid_y;
            } else if (newX < 0 || newX >= mapWidth || newY < 0 || newY >= mapHeight) {
                transitioned = true;
                
                // Get current local cell coordinates (default to 50, 50 if missing)
                let localX = 50, localY = 50;
                const mapRes = await pool.query('SELECT local_id FROM interior_sub_maps WHERE sub_map_id = $1', [session.current_sub_map_id]);
                if (mapRes.rows.length > 0 && mapRes.rows[0].local_id) {
                    const localRes = await pool.query('SELECT local_x, local_y FROM local_cells WHERE local_id = $1', [mapRes.rows[0].local_id]);
                    if (localRes.rows.length > 0) {
                        localX = localRes.rows[0].local_x;
                        localY = localRes.rows[0].local_y;
                    }
                }

                // Adjust Local Grid Coordinates and Wrap Ground Level
                if (newX < 0) { localX -= 1; newX = mapWidth - 1; }
                if (newX >= mapWidth) { localX += 1; newX = 0; }
                if (newY < 0) { localY -= 1; newY = mapHeight - 1; }
                if (newY >= mapHeight) { localY += 1; newY = 0; }

                // Upsert new local cell
                let newLocalId = null;
                const existingLocal = await pool.query('SELECT local_id FROM local_cells WHERE local_x = $1 AND local_y = $2', [localX, localY]);
                
                if (existingLocal.rows.length > 0) {
                    newLocalId = existingLocal.rows[0].local_id;
                } else {
                    const insertLocal = await pool.query(
                        "INSERT INTO local_cells (regional_id, local_x, local_y, elevation, ecological_vector) VALUES (1, $1, $2, 0.0, '{}') RETURNING local_id", 
                        [localX, localY]
                    );
                    newLocalId = insertLocal.rows[0].local_id;
                }

                // Get or Generate Sub Map
                let newMapId = null;
                const existingMap = await pool.query('SELECT sub_map_id FROM interior_sub_maps WHERE local_id = $1', [newLocalId]);
                if (existingMap.rows.length > 0) {
                    newMapId = existingMap.rows[0].sub_map_id;
                } else {
                    const { generateSubMapInterior } = require('../engine/subMapEngine');
                    newMapId = await generateSubMapInterior({
                        localId: newLocalId,
                        width: mapWidth,
                        height: mapHeight
                    });
                }

                // Update session to new map
                await pool.query('UPDATE game_sessions SET current_sub_map_id = $1 WHERE session_id = $2', [newMapId, sessionId]);
                narrativeContext += `\n[Simulation: Transitioned to Local Cell (${localX}, ${localY})]`;
            }

            // Update player coordinates
            await pool.query(
                'UPDATE player_characters SET grid_x = $1, grid_y = $2 WHERE character_id = $3',
                [newX, newY, characterId]
            );
            
            if (!transitioned) {
                narrativeContext += `\n[Mechanics: Moved to position (${newX}, ${newY})]`;
            } else {
                narrativeContext += `\n[Mechanics: You walked off the edge of the current map and entered a new area!]`;
            }
        } 
        else if (actionResult.actionType === 'ATTACK') {
            const targetName = actionResult.targetName;
            if (targetName) {
                const npcRes = await pool.query('SELECT * FROM npc_entities WHERE name = $1 AND sub_map_id = $2', [targetName, session.current_sub_map_id]);
                if (npcRes.rows.length > 0) {
                    const npc = npcRes.rows[0];
                    const might = character.might || 0;
                    const roll = Math.floor(Math.random() * 20) + 1 + might;
                    
                    if (roll > 10) {
                        const damage = might * 2;
                        const newHp = npc.hp_current - damage;
                        
                        if (newHp <= 0) {
                            await pool.query('DELETE FROM npc_entities WHERE name = $1 AND sub_map_id = $2', [npc.name, session.current_sub_map_id]);
                            narrativeContext += `\n[Mechanics: Rolled ${roll}. Hit ${npc.name} for ${damage} damage! ${npc.name} defeated!]`;
                        } else {
                            await pool.query('UPDATE npc_entities SET hp_current = $1 WHERE name = $2 AND sub_map_id = $3', [newHp, npc.name, session.current_sub_map_id]);
                            narrativeContext += `\n[Mechanics: Rolled ${roll}. Hit ${npc.name} for ${damage} damage!]`;
                        }
                    } else {
                        narrativeContext += `\n[Mechanics: Rolled ${roll}. Missed ${npc.name}!]`;
                    }
                } else {
                    narrativeContext += `\n[Mechanics: Target ${targetName} not found.]`;
                }
            } else {
                narrativeContext += `\n[Mechanics: No attack target specified.]`;
            }
        }
        else if (actionResult.actionType === 'SKILL_CHECK' || actionResult.actionType === 'CAST_POWER') {
            const statUsed = actionResult.targetAttribute?.toLowerCase() || 'might';
            const statValue = character[statUsed] || 10;
            const roll = Math.floor(Math.random() * 20) + 1;
            const success = (roll + statValue) >= 15;
            
            // Deduct stamina or focus
            const resource = character.type === 'Attuned' ? 'focus_current' : 'stamina_current';
            const cost = 5;
            const currentRes = character[resource] || 50;
            const newRes = Math.max(0, currentRes - cost);
            
            await pool.query(`UPDATE player_characters SET ${resource} = $1 WHERE character_id = $2`, [newRes, characterId]);
            narrativeContext += `\n[Mechanics: Rolled a ${roll} + ${statValue} ${statUsed}. ${success ? "Success!" : "Failure."} Cost ${cost} ${resource}]`;
        }

        // 5. Return response
        res.json({
            success: true,
            message: "Action processed successfully",
            response: {
                parsedAction: actionResult,
                narrativeResponse: narrativeContext,
                mechanicalContext: narrativeContext
            }
        });
    } catch (error: any) {
        console.error("AI DM Interaction Error:", error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
