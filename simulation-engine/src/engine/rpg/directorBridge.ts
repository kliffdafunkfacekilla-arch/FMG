import { GoogleGenAI } from '@google/genai';
import pool from '../../db/pool';
import { Entity, processSectorNarrativeLayer } from './narrativeTagEngine';

// =========================================================================
// 1. DATA CONTRACTS (JSON-to-JSON Pipeline)
// =========================================================================

export interface EconomicIndicators {
    active_tags: string[];
    grain_reserve_percentage: number;
    local_inflation_index: number;
}

export interface FactionDynamics {
    active_tags: string[];
    controlling_faction: string;
    garrison_strength: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    unrest_index: number;
}

export interface SimulationStatePayload {
    cell_id: number;
    sector_coords: { rx: number; ry: number };
    economic_indicators: EconomicIndicators;
    faction_dynamics: FactionDynamics;
}

export interface PlayerProfileContext {
    legal_name: string;
    backstory_hooks: string[];
    inventory_notable: string[];
}

export interface EligibleNPCAsset {
    id: string;
    name: string;
    role?: string;
    profession?: string;
    tags: string[];
}

export interface EligiblePropAsset {
    id: string;
    type: string;
    lx: number;
    ly: number;
    tags: string[];
}

export interface AvailableSectorAssets {
    eligible_npcs: EligibleNPCAsset[];
    eligible_props: EligiblePropAsset[];
}

export interface DirectorInputPayload {
    simulation_state: SimulationStatePayload;
    player_profile_context: PlayerProfileContext;
    available_sector_assets: AvailableSectorAssets;
}

export interface StoryBeatContract {
    phase: number;
    objective: string;
    discovery_method: string;
}

export interface StoryArcFramework {
    arc_id: string;
    inciting_incident: string;
    active_phase: number;
    beats: StoryBeatContract[];
}

export interface NpcAlteration {
    target_id: string;
    append_tags: string[];
    metadata_overrides?: {
        temporary_dialogue_node?: string;
        [key: string]: any;
    };
}

export interface PropAlteration {
    target_id: string;
    append_tags: string[];
    metadata_overrides?: {
        injected_loot_item_id?: string;
        tile_sprite_override_id?: string;
        target_destination_scene_id?: string;
        [key: string]: any;
    };
}

export interface DatabaseMutationsBlueprint {
    npc_alterations: NpcAlteration[];
    prop_alterations: PropAlteration[];
}

export interface DirectorOutputBlueprint {
    story_arc_framework: StoryArcFramework;
    database_mutations: DatabaseMutationsBlueprint;
}

// =========================================================================
// 2. VALIDATION MIDDLEWARE / GUARD
// =========================================================================

export interface ValidationResult {
    valid: boolean;
    sanitizedBlueprint: DirectorOutputBlueprint;
    rejectedNpcIds: string[];
    rejectedPropIds: string[];
    warningCount: number;
}

/**
 * Validates that every target_id emitted by the AI actually exists in the current sector assets.
 * Drops any hallucinated tokens to protect the database layer.
 */
export function validateDirectorMutations(
    inputPayload: DirectorInputPayload,
    blueprint: DirectorOutputBlueprint
): ValidationResult {
    const validNpcIds = new Set(inputPayload.available_sector_assets.eligible_npcs.map(n => n.id));
    const validPropIds = new Set(inputPayload.available_sector_assets.eligible_props.map(p => p.id));

    const rejectedNpcIds: string[] = [];
    const rejectedPropIds: string[] = [];

    const sanitizedNpcAlterations: NpcAlteration[] = [];
    const sanitizedPropAlterations: PropAlteration[] = [];

    // 1. Verify NPC alterations
    for (const alteration of (blueprint.database_mutations?.npc_alterations || [])) {
        if (validNpcIds.has(alteration.target_id)) {
            sanitizedNpcAlterations.push(alteration);
        } else {
            rejectedNpcIds.push(alteration.target_id);
            console.warn(`[Director Validation Guard] Rejected hallucinated NPC ID: ${alteration.target_id}`);
        }
    }

    // 2. Verify Prop alterations
    for (const alteration of (blueprint.database_mutations?.prop_alterations || [])) {
        if (validPropIds.has(alteration.target_id)) {
            sanitizedPropAlterations.push(alteration);
        } else {
            rejectedPropIds.push(alteration.target_id);
            console.warn(`[Director Validation Guard] Rejected hallucinated Prop ID: ${alteration.target_id}`);
        }
    }

    const warningCount = rejectedNpcIds.length + rejectedPropIds.length;

    const sanitizedBlueprint: DirectorOutputBlueprint = {
        story_arc_framework: blueprint.story_arc_framework,
        database_mutations: {
            npc_alterations: sanitizedNpcAlterations,
            prop_alterations: sanitizedPropAlterations
        }
    };

    return {
        valid: warningCount === 0,
        sanitizedBlueprint,
        rejectedNpcIds,
        rejectedPropIds,
        warningCount
    };
}

// =========================================================================
// 3. AUTONOMOUS PAYLOAD SYNTHESIZER (From Living Simulation -> Payload)
// =========================================================================

export async function buildDirectorInputPayload(
    cellId: number,
    rx: number = 112,
    ry: number = 112,
    z: number = 0,
    playerId: number = 1
): Promise<DirectorInputPayload> {
    const burgRes = await pool.query(
        `SELECT b.*, f.name AS faction_name
         FROM sim_burg_economy b
         LEFT JOIN sim_cells c ON c.id = b.cell_id
         LEFT JOIN sim_factions f ON f.id = c.faction_id
         WHERE b.cell_id = $1 LIMIT 1`,
        [cellId]
    );

    const burg = burgRes.rows[0];
    const food = Number(burg?.food ?? 500);
    const unrest = Number(burg?.unrest ?? 20);
    const wealth = Number(burg?.wealth ?? 5000);
    const factionName = burg?.faction_name || "Provincial Sovereignty";

    const econTags: string[] = [];
    const grainReserve = Math.min(100, Math.max(0, (food / 1000) * 100));
    const inflation = Number((1.0 + Math.max(0, (unrest - 30) / 100)).toFixed(2));

    if (food < 150) econTags.push('#Famine', '#ResourceScarcity');
    else if (food < 350) econTags.push('#GrainShortage');
    else if (food > 800) econTags.push('#HarvestAbundance');

    if (unrest > 70) econTags.push('#TradeBlockade', '#MarketCollapse');
    else if (wealth > 8000) econTags.push('#CommercialBoom');

    const factionTags: string[] = [];
    if (unrest > 60) factionTags.push('#MartialLaw');
    if (unrest > 45) factionTags.push('#UndergroundUnrest');
    factionTags.push('#GuildDominance');

    const garrisonStrength: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 
        unrest > 75 ? 'CRITICAL' : unrest > 50 ? 'HIGH' : unrest > 25 ? 'MEDIUM' : 'LOW';

    const playerRes = await pool.query(
        `SELECT name, lineage, institution, species, inventory, passive_traits, main_type FROM sim_player_character WHERE id = $1 LIMIT 1`,
        [playerId]
    );
    const player = playerRes.rows[0] || {};
    const legalName = player.name || "Patrick Gordon Morris";
    const backstoryHooks = [
        `${player.species || 'Human'} from ${player.institution || 'Provincial Guild'}`,
        ...(player.passive_traits || [])
    ];
    const inventoryNotable: string[] = Array.isArray(player.inventory) ? player.inventory.slice(0, 3).map((i: any) => typeof i === 'string' ? i : i.name || '#Artifact') : ['#BrassInkwell', '#IronBadge'];

    const sectorRes = await pool.query(
        `SELECT npcs, props FROM sim_sector_layers WHERE cell_id = $1 AND rx = $2 AND ry = $3 AND z_layer = $4 LIMIT 1`,
        [cellId, rx, ry, z]
    );

    const rawNpcs = sectorRes.rows[0]?.npcs || [];
    const rawProps = sectorRes.rows[0]?.props || [];

    const eligibleNpcs: EligibleNPCAsset[] = rawNpcs.map((n: any) => ({
        id: String(n.id),
        name: String(n.name),
        role: n.role,
        profession: n.profession,
        tags: Array.isArray(n.tags) ? n.tags : []
    }));

    const eligibleProps: EligiblePropAsset[] = rawProps.map((p: any) => {
        const lx = p.pos ? p.pos[0] : p.localPos ? p.localPos.lx : 128;
        const ly = p.pos ? p.pos[1] : p.localPos ? p.localPos.ly : 128;
        return {
            id: String(p.id),
            type: p.name || 'Prop',
            lx,
            ly,
            tags: Array.isArray(p.tags) ? p.tags : []
        };
    });

    return {
        simulation_state: {
            cell_id: cellId,
            sector_coords: { rx, ry },
            economic_indicators: {
                active_tags: econTags.length > 0 ? econTags : ['#StableEconomy'],
                grain_reserve_percentage: Number(grainReserve.toFixed(1)),
                local_inflation_index: inflation
            },
            faction_dynamics: {
                active_tags: factionTags,
                controlling_faction: factionName,
                garrison_strength: garrisonStrength,
                unrest_index: unrest
            }
        },
        player_profile_context: {
            legal_name: legalName,
            backstory_hooks: backstoryHooks,
            inventory_notable: inventoryNotable
        },
        available_sector_assets: {
            eligible_npcs: eligibleNpcs,
            eligible_props: eligibleProps
        }
    };
}

// =========================================================================
// 4. DATABASE MUTATION COMMITTER
// =========================================================================

export async function commitDirectorMutations(
    cellId: number,
    rx: number,
    ry: number,
    z: number,
    sanitizedBlueprint: DirectorOutputBlueprint
): Promise<{ success: boolean; appliedNpcCount: number; appliedPropCount: number }> {
    const sectorRes = await pool.query(
        `SELECT npcs, props FROM sim_sector_layers WHERE cell_id = $1 AND rx = $2 AND ry = $3 AND z_layer = $4 LIMIT 1`,
        [cellId, rx, ry, z]
    );

    if (sectorRes.rows.length === 0) {
        console.warn(`[Director] Sector layer not found in database for cell ${cellId} at (${rx}, ${ry}, ${z}) - skipping mutation commit.`);
        return { success: true, appliedNpcCount: 0, appliedPropCount: 0 };
    }

    const npcs: Entity[] = (sectorRes.rows[0].npcs || []).map((n: any) => ({ ...n, type: 'NPC' }));
    const props: Entity[] = (sectorRes.rows[0].props || []).map((p: any) => ({ ...p, type: 'PROP' }));

    let appliedNpcCount = 0;
    let appliedPropCount = 0;

    for (const alteration of sanitizedBlueprint.database_mutations.npc_alterations) {
        const target = npcs.find(n => n.id === alteration.target_id);
        if (target) {
            for (const tag of alteration.append_tags) {
                if (!target.tags.includes(tag)) target.tags.push(tag);
            }
            if (alteration.metadata_overrides) {
                target.metadata = { ...(target.metadata || {}), ...alteration.metadata_overrides };
            }
            appliedNpcCount++;
        }
    }

    for (const alteration of sanitizedBlueprint.database_mutations.prop_alterations) {
        const target = props.find(p => p.id === alteration.target_id);
        if (target) {
            for (const tag of alteration.append_tags) {
                if (!target.tags.includes(tag)) target.tags.push(tag);
            }
            if (alteration.metadata_overrides) {
                target.metadata = { ...(target.metadata || {}), ...alteration.metadata_overrides };
            }
            appliedPropCount++;
        }
    }

    const combined = [...npcs, ...props];
    processSectorNarrativeLayer(combined);

    const updatedNpcs = combined.filter(e => e.type === 'NPC');
    const updatedProps = combined.filter(e => e.type === 'PROP');

    await pool.query(
        `UPDATE sim_sector_layers SET npcs = $1, props = $2 WHERE cell_id = $3 AND rx = $4 AND ry = $5 AND z_layer = $6`,
        [JSON.stringify(updatedNpcs), JSON.stringify(updatedProps), cellId, rx, ry, z]
    );

    const framework = sanitizedBlueprint.story_arc_framework;
    if (framework) {
        await pool.query(
            `INSERT INTO sim_events (tick, tier, lore_date, type, message)
             VALUES (
                (SELECT COALESCE(MAX(tick), 1) FROM sim_events),
                'MAJOR',
                'Current Era',
                'NARRATIVE_ARC_INITIALIZED',
                $1
             )`,
            [`📜 [AI DIRECTOR ARC: ${framework.arc_id}]: ${framework.inciting_incident}`]
        );
    }

    return { success: true, appliedNpcCount, appliedPropCount };
}

// =========================================================================
// 5. PROCEDURAL STORY ARC SYNTHESIZER (Guaranteed Offline Fallback)
// =========================================================================

export function synthesizeProceduralStoryArc(inputPayload: DirectorInputPayload): DirectorOutputBlueprint {
    const sim = inputPayload.simulation_state;
    const player = inputPayload.player_profile_context;
    const npcs = inputPayload.available_sector_assets.eligible_npcs;
    const props = inputPayload.available_sector_assets.eligible_props;

    const primaryEcon = sim.economic_indicators.active_tags[0] || '#ResourceScarcity';
    const primaryFaction = sim.faction_dynamics.controlling_faction;
    const arcId = `arc_${primaryEcon.replace('#', '').toLowerCase()}_${sim.cell_id}_${Date.now()}`;

    // Select primary candidate (prefer civilian artisan/merchant)
    const targetNpc = npcs.find(n => !n.tags.includes('paragon') && !n.tags.includes('leader')) || npcs[0] || { id: 'npc_citizen_default', name: 'Local Resident' };

    // Select container prop
    const targetContainer = props.find(p => p.tags.some(t => ['container', 'chest', 'crate', 'storage'].includes(t.toLowerCase()))) || props[0] || { id: 'prop_container_default' };

    // Select terrain/boulder prop for dungeon/POE
    const targetPoi = props.find(p => p.id !== targetContainer.id) || props[1];

    let incitingIncident = `${primaryFaction} has declared strict emergency regulations amid ${primaryEcon.replace('#', '')}, explicitly monitoring individuals associated with ${player.legal_name}.`;
    if (primaryEcon.includes('Famine')) {
        incitingIncident = `${primaryFaction} has seized emergency grain caches following a famine outbreak, forcing local workers to seek underground contraband.`;
    } else if (primaryEcon.includes('HarvestAbundance') || primaryEcon.includes('CommercialBoom')) {
        incitingIncident = `A sudden commercial boom under ${primaryFaction} has triggered cartel price-fixing and smuggled ledgers in the municipal markets.`;
    }

    return {
        story_arc_framework: {
            arc_id: arcId,
            inciting_incident: incitingIncident,
            active_phase: 1,
            beats: [
                {
                    phase: 1,
                    objective: `Establish contact with ${targetNpc.name} to uncover the source of the market disturbance.`,
                    discovery_method: 'Social questioning or reputation check with the civilian asset.'
                },
                {
                    phase: 2,
                    objective: 'Retrieve the hidden manifest concealed in the compromised storage cache.',
                    discovery_method: 'Environmental search of the secure container.'
                }
            ]
        },
        database_mutations: {
            npc_alterations: [
                {
                    target_id: targetNpc.id,
                    append_tags: ['#NarrativeTarget', '#UndergroundContact', '#AnxiousBehavior'],
                    metadata_overrides: {
                        temporary_dialogue_node: `Keep your voice down, ${player.legal_name.split(' ')[0]}. ${primaryFaction} patrols are inspecting the trade records. Look in the central cache before they seal it.`
                    }
                }
            ],
            prop_alterations: [
                {
                    target_id: targetContainer.id,
                    append_tags: ['#PlotClueCarrier', '#ContrabandSource'],
                    metadata_overrides: {
                        injected_loot_item_id: 'item_coded_trade_manifest'
                    }
                },
                ...(targetPoi ? [{
                    target_id: targetPoi.id,
                    append_tags: ['#PoiPlacement', '#DungeonEntrance'],
                    metadata_overrides: {
                        tile_sprite_override_id: 'tile_stairs_down_02',
                        target_destination_scene_id: 'sub_map_vault_01'
                    }
                }] : [])
            ]
        }
    };
}

// =========================================================================
// 6. GEMINI AI DIRECTOR ENGINE (Strict JSON Schema Execution with Fallback)
// =========================================================================

export async function generateStoryArcWithGemini(
    inputPayload: DirectorInputPayload
): Promise<DirectorOutputBlueprint> {
    const apiKey = process.env.GEMINI_API_KEY;

    try {
        if (!apiKey || apiKey.startsWith('AQ.') || apiKey.length < 20) {
            console.log('[AI Director] Using procedural fallback generator (no valid external Gemini key).');
            return synthesizeProceduralStoryArc(inputPayload);
        }

        const ai = new GoogleGenAI({ apiKey });

        const systemInstruction = `You are the Stateless AI Director for a 1-to-1 scale tabletop simulation engine.
Your objective is to read the 'simulation_state', 'player_profile_context', and 'available_sector_assets'.
You must synthesize a local Story Arc Framework that logically bridges these inputs.

CRITICAL CONSTRAINTS:
1. You cannot invent physical space or materialize completely new tokens.
2. To introduce plot items, you must target and tag an existing item container inside 'eligible_props' using their exact 'id'.
3. To introduce character threads, you must target and tag an existing individual inside 'eligible_npcs' using their unique 'id'.
4. To create a dungeon entrance or Point of Interest, you must alter an existing asset inside 'eligible_props'.
5. You must output exclusively valid JSON matching the exact schema provided. No markdown text wrapper.`;

        const prompt = `Synthesize a narrative arc blueprint for the following simulation state:
${JSON.stringify(inputPayload, null, 2)}

Output strictly valid JSON with this exact structure:
{
  "story_arc_framework": {
    "arc_id": "string",
    "inciting_incident": "string",
    "active_phase": 1,
    "beats": [
      {
        "phase": 1,
        "objective": "string",
        "discovery_method": "string"
      }
    ]
  },
  "database_mutations": {
    "npc_alterations": [
      {
        "target_id": "string",
        "append_tags": ["string"],
        "metadata_overrides": {
          "temporary_dialogue_node": "string"
        }
      }
    ],
    "prop_alterations": [
      {
        "target_id": "string",
        "append_tags": ["string"],
        "metadata_overrides": {
          "injected_loot_item_id": "string",
          "tile_sprite_override_id": "string",
          "target_destination_scene_id": "string"
        }
      }
    ]
  }
}`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction,
                responseMimeType: 'application/json'
            }
        });

        const rawText = response.text || '{}';
        const parsed = JSON.parse(rawText) as DirectorOutputBlueprint;
        return parsed;
    } catch (err: any) {
        console.warn(`[AI Director] Remote Gemini call encountered error (${err.message}), seamlessly executing procedural fallback.`);
        return synthesizeProceduralStoryArc(inputPayload);
    }
}
