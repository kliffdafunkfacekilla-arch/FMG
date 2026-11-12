import { llmDisabled, ollamaJson } from '../llm.js';
import pool from '../../db/pool';
import { Entity, processSectorNarrativeLayer } from './narrativeTagEngine';
import type { SimThread, ThreadStateEvaluation } from '../threads/threadEngine';

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
    /** Which director wrote it (stored on the managed arc). */
    source?: 'ollama' | 'procedural';
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
        ...(blueprint.source ? { source: blueprint.source } : {}),
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
    // No hard-coded person: without a player character row the arc addresses "the party".
    const legalName = player.name || "the party";
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

/**
 * Offline story director: builds an arc from what is actually going on in the sector, without an LLM.
 * Picks an archetype that fits the local simulation state, aims it at a fitting NPC and container on
 * the map, and leaves tags the reaction rules respond to (e.g. a crackdown marks a craftsperson as
 * #RebelInformant, which the garrison-raid rule picks up under martial law).
 */
interface ArcArchetype {
    key: string;
    fits: (econ: string[], faction: string[], npcs: EligibleNPCAsset[]) => boolean;
    pickNpc: (npcs: EligibleNPCAsset[]) => EligibleNPCAsset | undefined;
    incident: (faction: string, npc: EligibleNPCAsset, party: string) => string;
    beats: (npc: EligibleNPCAsset, cache: EligiblePropAsset | undefined) => Array<{ objective: string; discovery_method: string }>;
    npcTags: string[];
    cacheTags: string[];
    dialogue: (npc: EligibleNPCAsset, faction: string) => string;
}

const roleText = (n: EligibleNPCAsset) => `${n.role || ''} ${n.profession || ''} ${n.name} ${(n.tags || []).join(' ')}`.toLowerCase();
const isCivilian = (n: EligibleNPCAsset) => !n.tags.includes('paragon') && !n.tags.includes('leader') && !n.tags.includes('beast');
const byRole = (re: RegExp) => (npcs: EligibleNPCAsset[]) => npcs.find(n => isCivilian(n) && re.test(roleText(n)));

const ARC_ARCHETYPES: ArcArchetype[] = [
    {
        key: 'grain',
        fits: econ => econ.some(t => /Famine|GrainShortage|ResourceScarcity/.test(t)),
        pickNpc: byRole(/miller|baker|farm|granary|merchant|trader/),
        incident: (f) => `${f} has seized the grain stores, and a black market now feeds whoever can pay.`,
        beats: (npc, cache) => [
            { objective: `Learn from ${npc.name} who is selling the seized grain`, discovery_method: 'Questioning, a favour, or coin.' },
            { objective: cache ? `Find the smugglers' tally hidden in ${cache.type}` : `Find where the smugglers keep their tally`, discovery_method: 'Search or force the cache.' },
            { objective: `Expose the grain ring or strike a bargain with it`, discovery_method: 'Confront the ring, or deal.' },
        ],
        npcTags: ['#NarrativeTarget', '#UndergroundContact', '#ExtortionVictim'],
        cacheTags: ['#PlotClueCarrier', '#ContrabandSource'],
        dialogue: (_n, f) => `Keep your voice down. ${f}'s men count every sack that leaves this street.`,
    },
    {
        key: 'ledgers',
        fits: econ => econ.some(t => /CommercialBoom|HarvestAbundance/.test(t)),
        pickNpc: byRole(/clerk|scribe|merchant|trader|banker|factor/),
        incident: (f) => `Prices are being fixed in ${f}'s markets, and someone is keeping two sets of ledgers.`,
        beats: (npc, cache) => [
            { objective: `Persuade ${npc.name} to say who pays for the rigged prices`, discovery_method: 'Social pressure, or proof of their own part in it.' },
            { objective: cache ? `Recover the second ledger from ${cache.type}` : `Recover the second ledger`, discovery_method: 'Theft, search or bribery.' },
        ],
        npcTags: ['#NarrativeTarget', '#UndergroundContact'],
        cacheTags: ['#PlotClueCarrier', '#Ledger'],
        dialogue: () => `Two books, two sets of numbers. Only one of them goes to the tax-house.`,
    },
    {
        key: 'crackdown',
        fits: (_e, faction) => faction.some(t => /MartialLaw|UndergroundUnrest/.test(t)),
        pickNpc: byRole(/smith|forge|mason|carpenter|cooper|tanner|weaver|wright|artisan/),
        incident: (f, npc) => `${f}'s watch is hunting informants, and ${npc.name}'s name is on their list.`,
        beats: (npc, cache) => [
            { objective: `Reach ${npc.name} before the watch does`, discovery_method: 'Move fast, or create a distraction.' },
            { objective: cache ? `Get rid of the evidence hidden in ${cache.type}` : `Get rid of the evidence`, discovery_method: 'Burn it, hide it, or plant it on someone else.' },
            { objective: `Get ${npc.name} clear of the crackdown`, discovery_method: 'Hide them, smuggle them out, or bargain with the watch.' },
        ],
        npcTags: ['#NarrativeTarget', '#RebelInformant', '#AnxiousBehavior'],
        cacheTags: ['#PlotClueCarrier', '#EvidenceSeized'],
        dialogue: (_n, f) => `They know. ${f}'s patrols came by twice last night.`,
    },
    {
        key: 'cult',
        fits: (_e, _f, npcs) => npcs.some(n => n.tags.includes('#CultistInfiltrator')),
        pickNpc: npcs => npcs.find(n => n.tags.includes('#CultistInfiltrator')),
        incident: (_f, npc) => `Strange rites have been heard at night, and ${npc.name} is never home when they are.`,
        beats: (npc, cache) => [
            { objective: `Follow ${npc.name} after dark`, discovery_method: 'Stealth and patience.' },
            { objective: cache ? `Find what is hidden in ${cache.type}` : `Find where the rites are held`, discovery_method: 'Search, or watch the place.' },
            { objective: `Stop the rite before the seal weakens`, discovery_method: 'Disrupt it, or turn the cultist.' },
        ],
        npcTags: ['#NarrativeTarget', '#AnxiousBehavior'],
        cacheTags: ['#PlotClueCarrier', '#ForbiddenTome'],
        dialogue: () => `You hear it too? Chanting, under the floor, every night the moon bleeds.`,
    },
    {
        key: 'courier',
        fits: () => true,
        pickNpc: npcs => npcs.find(isCivilian),
        incident: (f, npc) => `A courier carrying ${f}'s sealed letters never arrived, and ${npc.name} was the last to see them.`,
        beats: (npc, cache) => [
            { objective: `Find out what ${npc.name} saw of the missing courier`, discovery_method: 'Questioning or a favour.' },
            { objective: cache ? `Search ${cache.type} for the courier's satchel` : `Find the courier's satchel`, discovery_method: 'Search the area.' },
        ],
        npcTags: ['#NarrativeTarget', '#UndergroundContact'],
        cacheTags: ['#PlotClueCarrier'],
        dialogue: () => `The rider went past at dusk, and the horse came back alone at dawn.`,
    },
];

export function synthesizeProceduralStoryArc(inputPayload: DirectorInputPayload): DirectorOutputBlueprint {
    const sim = inputPayload.simulation_state;
    const party = inputPayload.player_profile_context.legal_name;
    const npcs = inputPayload.available_sector_assets.eligible_npcs;
    const props = inputPayload.available_sector_assets.eligible_props;
    const econ = sim.economic_indicators.active_tags;
    const faction = sim.faction_dynamics.active_tags;
    const controller = sim.faction_dynamics.controlling_faction;

    // Every archetype that fits and has someone to aim at; vary between them over time
    const options = ARC_ARCHETYPES
        .filter(a => a.fits(econ, faction, npcs))
        .map(a => ({ a, npc: a.pickNpc(npcs) || npcs.find(isCivilian) || npcs[0] }))
        .filter(o => o.npc);
    const roll = Math.abs((sim.cell_id * 31 + sim.sector_coords.rx * 7 + sim.sector_coords.ry * 13 + Math.floor(Date.now() / 60000)) % 997);
    const chosen = options.length ? options[roll % options.length]! : null;
    const npc = chosen?.npc || { id: '', name: 'a local', tags: [] };
    const archetype = chosen?.a || ARC_ARCHETYPES[ARC_ARCHETYPES.length - 1]!;
    const cache = props.find(p => p.tags.some(t => ['container', 'chest', 'crate', 'storage', 'searchable'].includes(t.toLowerCase())));
    const beats = archetype.beats(npc as EligibleNPCAsset, cache).map((b, i) => ({ phase: i + 1, ...b }));

    return {
        source: 'procedural',
        story_arc_framework: {
            arc_id: `arc_${archetype.key}_${sim.cell_id}_${sim.sector_coords.rx}_${sim.sector_coords.ry}_${Date.now()}`,
            inciting_incident: archetype.incident(controller, npc as EligibleNPCAsset, party),
            active_phase: 1,
            beats
        },
        database_mutations: {
            npc_alterations: npc.id ? [{
                target_id: npc.id,
                append_tags: archetype.npcTags,
                metadata_overrides: { temporary_dialogue_node: archetype.dialogue(npc as EligibleNPCAsset, controller) }
            }] : [],
            prop_alterations: cache ? [{ target_id: cache.id, append_tags: archetype.cacheTags }] : []
        }
    };
}

// =========================================================================
// 6. AI DIRECTOR (local Ollama, procedural fallback)
// =========================================================================

/** True when model calls are switched off (STORY_LLM=off: tests, or playing offline). */
export { llmDisabled };

/**
 * Writes an arc for the sector with the local model (engine/llm.ts), validated against the real
 * assets afterwards by validateDirectorMutations. Falls back to the procedural director when the model
 * is off, unreachable, or returns something unusable.
 */
export async function generateStoryArc(inputPayload: DirectorInputPayload): Promise<DirectorOutputBlueprint> {
    // With nobody real on the map a model invents a cast (rule 7); the procedural arc does not.
    if (llmDisabled() || inputPayload.available_sector_assets.eligible_npcs.length === 0) return synthesizeProceduralStoryArc(inputPayload);
    const system = `You are the story director for a tabletop simulation. Read the simulation state, the party, and the
sector's real NPCs and props. Write one local story arc that grows out of the economy, the faction situation and those
assets. Rules: never invent people, places or items; to involve a character, use the exact "id" of one of
eligible_npcs; to plant a clue or entrance, use the exact "id" of one of eligible_props. In every sentence
(inciting_incident, objective, discovery_method, dialogue) refer to people and things by their plain names: never
write an id, a tag (words starting with #) or a field name in prose. npc_alterations may only target ids listed in
eligible_npcs and prop_alterations only ids in eligible_props; leave a list empty if none fit. Reply with JSON only.`;
    const prompt = `Simulation state:
${JSON.stringify(inputPayload, null, 2)}

Reply with JSON of exactly this shape:
{
  "story_arc_framework": {
    "arc_id": "short_snake_case_id",
    "inciting_incident": "one vivid sentence describing the crisis",
    "active_phase": 1,
    "beats": [
      { "phase": 1, "objective": "a concrete goal naming one eligible NPC or prop", "discovery_method": "how the party can achieve it" },
      { "phase": 2, "objective": "...", "discovery_method": "..." }
    ]
  },
  "database_mutations": {
    "npc_alterations": [ { "target_id": "exact npc id", "append_tags": ["#NarrativeTarget"], "metadata_overrides": { "temporary_dialogue_node": "a line they say" } } ],
    "prop_alterations": [ { "target_id": "exact prop id", "append_tags": ["#PlotClueCarrier"] } ]
  }
}`;
    const parsed = await ollamaJson<DirectorOutputBlueprint>(prompt, { system, temperature: 0.7, maxTokens: 700, timeoutMs: 120000 });
    const fw = parsed?.story_arc_framework;
    if (!fw?.inciting_incident || !Array.isArray(fw.beats) || fw.beats.length === 0) {
        return synthesizeProceduralStoryArc(inputPayload);
    }
    // Small local models still echo tags into prose ("#GuildDominance's ..."): turn them back into words.
    const prose = (s: any) => String(s || '').replace(/#([A-Za-z]+)/g, (_m, w: string) => w.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()).trim();
    return {
        source: 'ollama',
        story_arc_framework: {
            arc_id: String(fw.arc_id || `arc_${inputPayload.simulation_state.cell_id}_${Date.now()}`).slice(0, 120),
            inciting_incident: prose(fw.inciting_incident),
            active_phase: 1,
            beats: fw.beats.filter(b => b && b.objective).map((b, i) => ({ phase: i + 1, objective: prose(b.objective), discovery_method: prose(b.discovery_method) })),
        },
        database_mutations: {
            npc_alterations: Array.isArray(parsed?.database_mutations?.npc_alterations) ? parsed!.database_mutations.npc_alterations : [],
            prop_alterations: Array.isArray(parsed?.database_mutations?.prop_alterations) ? parsed!.database_mutations.prop_alterations : [],
        },
    };
}

// =========================================================================
// 7. STORY RESOLUTION AFTERMATH SYNTHESIZER
// =========================================================================

export interface ThreadAftermathSynthesis {
    narrativeSummary: string;
    forensicTags: string[];
    lootRewards: Array<{ name: string; tag: string; quantity: number }>;
    burgShiftNarrative: string;
    followUpThread?: {
        question: string;
        stakes: string;
        clock_max: number;
        actor_id: string; // Guaranteed to exist in DB (Rule 7)
        rule_id?: string;
    };
}

/**
 * Procedurally reasons out the direct physical, forensic, and narrative consequences
 * of a resolved thread, including scene loot, forensic evidence tags, and an emergent follow-up thread.
 * Enforces Rule 7: Every actor_id referenced in a follow-up thread MUST exist in eligibleNpcs.
 */
export function synthesizeProceduralAftermath(
    thread: SimThread,
    evaluation: ThreadStateEvaluation,
    eligibleNpcs: EligibleNPCAsset[],
    eligibleProps: EligiblePropAsset[],
    burgName: string = "the district"
): ThreadAftermathSynthesis {
    const actorState = evaluation.actorState || (evaluation.outcomeType === 'EXPIRED' ? 'dead' : 'free');
    const validActor = eligibleNpcs.find(n => !n.tags.includes('paragon')) || eligibleNpcs[0] || { id: thread.actor_ids[0] || '1', name: 'Citizen' };

    if (actorState === 'dead') {
        return {
            narrativeSummary: evaluation.resolutionNarrative || `Martial authorities extinguished all resistance regarding ${thread.stakes}.`,
            forensicTags: ['#Bloodstain', '#ExecutionMark', '#ShatteredBonds', '#GarrisonTerror'],
            lootRewards: [
                { name: 'Blacksmith Chisel', tag: '#ArtisanTool', quantity: 1 },
                { name: 'Iron Shavings', tag: '#MetalOre', quantity: 5 }
            ],
            burgShiftNarrative: `The artisan's demise inflames resentment across ${burgName}; guild workers whisper of a general strike.`,
            followUpThread: {
                question: `Will the guild workers in ${burgName} declare an illegal strike against martial confiscation?`,
                stakes: `Garrison commander intends to arrest apprentice delegates unless the iron quota is met.`,
                clock_max: 5,
                actor_id: String(validActor.id),
                rule_id: 'RULE_PROLETARIAT_STRIKE'
            }
        };
    } else if (actorState === 'fugitive') {
        return {
            narrativeSummary: evaluation.resolutionNarrative || `The artisan slipped through the perimeter, seeking shelter in the outer rugged passes.`,
            forensicTags: ['#DiscreetTracks', '#SmuggledCaravan', '#FalseManifest', '#ShadowTrail'],
            lootRewards: [
                { name: 'Mountain Smuggler Map', tag: '#ForensicDocument', quantity: 1 },
                { name: 'Highland Dried Rations', tag: '#ForageRations', quantity: 4 }
            ],
            burgShiftNarrative: `Clandestine supply corridors establish a foothold between ${burgName} and the hills.`,
            followUpThread: {
                question: `Can the fugitive artisan evade border wardens and link up with the mountain smuggler cells?`,
                stakes: `If intercepted on the high trail, the artisan will be executed as a deserter.`,
                clock_max: 6,
                actor_id: String(validActor.id),
                rule_id: 'RULE_SMUGGLER_TRAIL'
            }
        };
    } else {
        // Free / working / liberated
        return {
            narrativeSummary: evaluation.resolutionNarrative || `The artisan was liberated and restored to productive freedom.`,
            forensicTags: ['#BrokenChains', '#BreachedLock', '#SmuggledEscape', '#ScatteredLedgers'],
            lootRewards: [
                { name: 'Clandestine Guild Token', tag: '#ContrabandGuild', quantity: 1 },
                { name: 'Pouch of Imperial Crowns', tag: '#CurrencyCoin', quantity: 35 }
            ],
            burgShiftNarrative: `The artisan's release breaks the garrison's stranglehold on local production; clandestine work resumes.`,
            followUpThread: {
                question: `Will the suspicious garrison inspect the reopened workshop looking for illegal arms caches?`,
                stakes: `An unannounced midnight search will confiscate all hidden masterwork stock.`,
                clock_max: 4,
                actor_id: String(validActor.id),
                rule_id: 'RULE_GARRISON_INSPECTION'
            }
        };
    }
}

/**
 * AI-driven or procedural synthesizer that reasons about aftermath consequences.
 * Returns forensic tags, loot rewards, burg shifts, and an emergent follow-up thread.
 */
export async function generateThreadResolutionAftermath(
    thread: SimThread,
    evaluation: ThreadStateEvaluation,
    eligibleNpcs: EligibleNPCAsset[],
    eligibleProps: EligiblePropAsset[],
    burgName: string = "the district",
    playerActionText?: string
): Promise<ThreadAftermathSynthesis> {
    const fallback = () => synthesizeProceduralAftermath(thread, evaluation, eligibleNpcs, eligibleProps, burgName);
    if (llmDisabled()) return fallback();
    const validNpcIds = new Set(eligibleNpcs.map(n => String(n.id)));
    const prompt = `A story thread in ${burgName} has just been resolved.
Question: "${thread.question}"
Stakes: "${thread.stakes}"
Outcome: ${evaluation.outcomeType} (actor: ${evaluation.actorState || 'resolved'})
What the party did: "${playerActionText || 'direct intervention'}"
What happened: "${evaluation.resolutionNarrative}"

People present (you may ONLY use these ids):
${JSON.stringify(eligibleNpcs.map(n => ({ id: n.id, name: n.name, role: n.role })), null, 2)}

Reply with JSON only:
{
  "narrativeSummary": "two or three sentences on the aftermath",
  "forensicTags": ["#Tag1", "#Tag2"],
  "lootRewards": [{ "name": "item", "tag": "#Tag", "quantity": 1 }],
  "burgShiftNarrative": "one sentence on how the town changes",
  "followUpThread": { "question": "a new open question", "stakes": "what is at risk", "clock_max": 4, "actor_id": "EXACT id from the list", "rule_id": "RULE_SNAKE_CASE" }
}`;
    const parsed = await ollamaJson<ThreadAftermathSynthesis>(prompt, {
        system: 'You are the story director for a tabletop RPG. Reason out the physical and social aftermath of a resolved thread. Never invent people. Reply with JSON only.',
        temperature: 0.7, maxTokens: 500, timeoutMs: 120000,
    });
    if (!parsed?.narrativeSummary) return fallback();
    if (parsed.followUpThread) {
        // Rule 7: a follow-up thread may only name someone who is really there
        if (!validNpcIds.has(String(parsed.followUpThread.actor_id))) {
            const fallbackActor = eligibleNpcs[0]?.id || thread.actor_ids[0];
            if (fallbackActor) parsed.followUpThread.actor_id = String(fallbackActor);
            else delete (parsed as any).followUpThread;
        }
        if (parsed.followUpThread) parsed.followUpThread.clock_max = Math.max(2, Math.min(8, Number(parsed.followUpThread.clock_max) || 4));
    }
    parsed.forensicTags = Array.isArray(parsed.forensicTags) ? parsed.forensicTags.filter(t => typeof t === 'string' && t.startsWith('#')).slice(0, 6) : [];
    parsed.lootRewards = Array.isArray(parsed.lootRewards) ? parsed.lootRewards.slice(0, 4) : [];
    return parsed;
}
