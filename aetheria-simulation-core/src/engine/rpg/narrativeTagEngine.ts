export type TagType = string;

export interface Entity {
    id: string;
    type: 'NPC' | 'PROP' | 'ITEM' | 'TILE';
    tags: TagType[];
    localPos?: { lx: number; ly: number };
    pos?: [number, number]; // Backwards-compatible tuple format
    name?: string;
    role?: string;
    profession?: string;
    faction?: string;
    species?: string;
    [key: string]: any;
}

// -------------------------------------------------------------
// 1. SEMANTIC THESAURUS (Resolves ANY narrative term to simulation data)
// -------------------------------------------------------------

export const SemanticThesaurus: Record<string, string[]> = {
    // Metalwork & Forging
    smith: ['blacksmith', 'armorer', 'weaponsmith', 'foundry worker', 'forge', 'smelter', 'metalworker', 'tinsmith'],
    metalworker: ['blacksmith', 'armorer', 'weaponsmith', 'foundry worker', 'smelter'],
    
    // Commerce & Trade
    merchant: ['merchant trader', 'trader', 'shopkeeper', 'innkeeper', 'barkeeper', 'grocer', 'vendor', 'market stall', 'clothier'],
    trader: ['merchant trader', 'trader', 'caravan master', 'purveyor', 'peddler'],
    
    // Law Enforcement, Military, & Security
    guard: ['city watchman', 'watch captain', 'wall watchman', 'sentry', 'soldier', 'constable', 'militia', 'patrol', 'rampart sentry', 'commander'],
    soldier: ['soldier', 'footman', 'archer', 'cavalry', 'militia', 'infantry', 'guard'],
    commander: ['watch captain', 'commander', 'marshal', 'warden', 'captain', 'constable'],

    // Civic Leadership & Administration
    leader: ['town reeve', 'mayor', 'headman', 'burgomaster', 'magistrate', 'counselor', 'chancellor', 'overseer'],
    official: ['town reeve', 'mayor', 'clerk', 'bureaucrat', 'tax collector', 'magistrate'],

    // Faith, Alchemy, Medicine, & Magic
    scholar: ['temple acolyte', 'priest', 'herbalist', 'apothecary', 'alchemist', 'scribe', 'monk', 'naturalist', 'astronomer'],
    priest: ['temple acolyte', 'priest', 'chaplain', 'curate', 'devotee', 'monk'],
    healer: ['apothecary apprentice', 'apothecary', 'herbalist', 'physician', 'leech'],
    mage: ['hedge wizard', 'arcane scholar', 'spellwright', 'sparkborn', 'alchemist'],

    // Craftspeople & Artisans
    artisan: ['carpenter', 'potter', 'weaver', 'tanner', 'clockmaker', 'cooper', 'mason', 'draper', 'cobbler', 'baker'],
    craftsman: ['carpenter', 'potter', 'weaver', 'tanner', 'clockmaker', 'cooper', 'baker'],

    // Agrarian & Manual Labor
    laborer: ['farmer', 'disenfranchised laborer', 'peasant', 'woodcutter', 'quarryman', 'dockworker', 'porter', 'field hand'],
    farmer: ['farmer', 'husbandman', 'harvester', 'granary hand', 'peasant'],

    // Criminal Underworld & Fringes
    criminal: ['smuggler', 'bandit', 'outlaw', 'thief', 'syndicate operative', 'cutpurse', 'raider', 'pirate', 'scoundrel'],
    outlaw: ['smuggler', 'bandit', 'outlaw', 'raider', 'cartel agent', 'fringe resident'],
    smuggler: ['shadow courier', 'smuggler', 'cloud-skiff runner', 'contraband runner', 'fence']
};

export const PropThesaurus: Record<string, string[]> = {
    container: ['container', 'chest', 'crate', 'barrel', 'box', 'storage', 'footlocker', 'coffer', 'urn', 'cask', 'vault', 'hatch'],
    hidden: ['hidden', 'subterranean', 'nook', 'crevice', 'rubble', 'floorboard', 'vault', 'shadow', 'cellar'],
    workstation: ['anvil', 'forge', 'loom', 'workbench', 'counter', 'kiln', 'desk', 'altar', 'tanning vat', 'grindstone'],
    doorway: ['door', 'gate', 'hatch', 'trapdoor', 'ladder', 'entrance', 'portal', 'archway', 'flue']
};

// -------------------------------------------------------------
// 2. AI DIRECTOR INJECTION SPECIFICATION
// -------------------------------------------------------------

export interface TargetCriteria {
    occupation?: string;
    profession?: string;
    faction?: string;
    species?: string;
    temper?: string;
    tags?: string[];
    name?: string;
    [key: string]: any;
}

export interface TargetQuery {
    type: 'NPC' | 'PROP' | 'ITEM' | 'TILE';
    criteria: TargetCriteria;
}

export interface DirectorInjection {
    target_query: TargetQuery;
    apply_tags: string[];
}

export interface DirectorPlanningPass {
    arc_id: string;
    theme?: string;
    injections: DirectorInjection[];
}

// -------------------------------------------------------------
// 3. SPATIAL PROPAGATION HELPER
// -------------------------------------------------------------

export function getEntityCoords(e: Entity): { x: number; y: number } {
    if (e.localPos) return { x: e.localPos.lx, y: e.localPos.ly };
    if (e.pos) return { x: e.pos[0], y: e.pos[1] };
    return { x: 128, y: 128 };
}

export function propagateToNearby(
    source: Entity,
    sectorEntities: Entity[],
    targetType: 'NPC' | 'PROP',
    filterFn: (e: Entity) => boolean,
    tagToInject: string,
    maxDistance: number = 30
): Entity | null {
    const srcCoords = getEntityCoords(source);

    const candidates = sectorEntities
        .filter(e => e.type === targetType && filterFn(e))
        .map(e => {
            const coords = getEntityCoords(e);
            return { entity: e, dist: Math.hypot(coords.x - srcCoords.x, coords.y - srcCoords.y) };
        })
        .filter(item => item.dist <= maxDistance)
        .sort((a, b) => a.dist - b.dist);

    const match = candidates[0]?.entity || null;
    if (match && !match.tags.includes(tagToInject)) {
        match.tags.push(tagToInject);
    }
    return match;
}

// -------------------------------------------------------------
// 4. UNIVERSAL NARRATIVE PROPAGATION RULEBOOK
// -------------------------------------------------------------

export const NarrativePropagationRules: Record<TagType, (actor: Entity, sectorEntities: Entity[]) => void> = {

    // --- REBELLION & ESPIONAGE ---
    '#RebelInformant': (actor, sectorEntities) => {
        if (!actor.tags.includes('#AnxiousBehavior')) actor.tags.push('#AnxiousBehavior');
        if (!actor.tags.includes('#NightSchedule')) actor.tags.push('#NightSchedule');
        propagateToNearby(actor, sectorEntities, 'PROP', p => p.tags.some(t => PropThesaurus.container!.includes(t.toLowerCase())), '#ContrabandSource');
    },

    '#UndergroundContact': (actor, sectorEntities) => {
        if (!actor.tags.includes('#GuardedDialogue')) actor.tags.push('#GuardedDialogue');
        if (!actor.tags.includes('#CodedResponse')) actor.tags.push('#CodedResponse');
        propagateToNearby(actor, sectorEntities, 'PROP', p => p.tags.some(t => PropThesaurus.container!.includes(t.toLowerCase())), '#PlotClueCarrier');
    },

    '#SecretCourier': (actor) => {
        if (!actor.tags.includes('#FastMovement')) actor.tags.push('#FastMovement');
        if (!actor.tags.includes('#GuardedDialogue')) actor.tags.push('#GuardedDialogue');
    },

    // --- CRIME, EXTORTION & UNDERWORLD ---
    '#ExtortionVictim': (actor, sectorEntities) => {
        if (!actor.tags.includes('#DefensiveDialogue')) actor.tags.push('#DefensiveDialogue');
        if (!actor.tags.includes('#FurtiveGaze')) actor.tags.push('#FurtiveGaze');
        propagateToNearby(actor, sectorEntities, 'PROP', p => p.tags.some(t => PropThesaurus.hidden!.includes(t.toLowerCase()) || PropThesaurus.container!.includes(t.toLowerCase())), '#DocumentDrop');
    },

    '#SyndicateOperative': (actor) => {
        if (!actor.tags.includes('#GuardedDialogue')) actor.tags.push('#GuardedDialogue');
        if (!actor.tags.includes('#ContrabandTrader')) actor.tags.push('#ContrabandTrader');
    },

    '#CorruptOfficial': (actor, sectorEntities) => {
        if (!actor.tags.includes('#Bribable')) actor.tags.push('#Bribable');
        if (!actor.tags.includes('#StatelyDemeanor')) actor.tags.push('#StatelyDemeanor');
        propagateToNearby(actor, sectorEntities, 'PROP', p => p.tags.some(t => PropThesaurus.container!.includes(t.toLowerCase())), '#EmbezzledLedger');
    },

    '#SmugglerCache': (prop) => {
        if (!prop.tags.includes('#Locked')) prop.tags.push('#Locked');
        if (!prop.tags.includes('#TrapProtected')) prop.tags.push('#TrapProtected');
    },

    // --- MURDER & FORENSIC MYSTERY ---
    '#MurderVictim': (actor, sectorEntities) => {
        if (!actor.tags.includes('#Dead')) actor.tags.push('#Dead');
        if (!actor.tags.includes('#Corpse')) actor.tags.push('#Corpse');
        // A murder site creates a crime scene footprint and terrifies nearby witnesses
        propagateToNearby(actor, sectorEntities, 'PROP', () => true, '#BloodstainedMarker', 6);
        propagateToNearby(actor, sectorEntities, 'NPC', n => n.id !== actor.id, '#ShockedWitness', 15);
        propagateToNearby(actor, sectorEntities, 'PROP', p => p.tags.some(t => PropThesaurus.hidden!.includes(t.toLowerCase())), '#MurderWeapon', 20);
    },

    '#PrimeSuspect': (actor) => {
        if (!actor.tags.includes('#DefensiveDialogue')) actor.tags.push('#DefensiveDialogue');
        if (!actor.tags.includes('#FurtiveGaze')) actor.tags.push('#FurtiveGaze');
        if (!actor.tags.includes('#FlightRisk')) actor.tags.push('#FlightRisk');
    },

    '#ShockedWitness': (actor) => {
        if (!actor.tags.includes('#AgitatedSpeech')) actor.tags.push('#AgitatedSpeech');
        if (!actor.tags.includes('#ObservantMemory')) actor.tags.push('#ObservantMemory');
    },

    // --- OCCULT, COSMIC, & ANOMALIES ---
    '#CultistInfiltrator': (actor, sectorEntities) => {
        if (!actor.tags.includes('#ZealotMindset')) actor.tags.push('#ZealotMindset');
        if (!actor.tags.includes('#HiddenSigil')) actor.tags.push('#HiddenSigil');
        propagateToNearby(actor, sectorEntities, 'PROP', p => p.tags.some(t => PropThesaurus.hidden!.includes(t.toLowerCase())), '#OccultShrine');
    },

    '#ChaosCorrupted': (actor) => {
        if (!actor.tags.includes('#ErraticMovement')) actor.tags.push('#ErraticMovement');
        if (!actor.tags.includes('#AuraOfDread')) actor.tags.push('#AuraOfDread');
        if (!actor.tags.includes('#ViolentTendency')) actor.tags.push('#ViolentTendency');
    },

    '#EldritchRelic': (prop) => {
        if (!prop.tags.includes('#HarmonicHum')) prop.tags.push('#HarmonicHum');
        if (!prop.tags.includes('#ChaosRadiator')) prop.tags.push('#ChaosRadiator');
    },

    // --- BOUNTY, PURSUIT & HUNTING ---
    '#BountyTarget': (actor) => {
        if (!actor.tags.includes('#ArmedAndDangerous')) actor.tags.push('#ArmedAndDangerous');
        if (!actor.tags.includes('#GuardedDialogue')) actor.tags.push('#GuardedDialogue');
        if (!actor.tags.includes('#HostileOnConfrontation')) actor.tags.push('#HostileOnConfrontation');
    },

    '#Fugitive': (actor) => {
        if (!actor.tags.includes('#Disguised')) actor.tags.push('#Disguised');
        if (!actor.tags.includes('#FlightRisk')) actor.tags.push('#FlightRisk');
    },

    // --- BEHAVIORAL & VISUAL PRIMITIVES ---
    '#AnxiousBehavior': (actor) => {
        if (!actor.tags.includes('#FurtiveGaze')) actor.tags.push('#FurtiveGaze');
    },

    '#PlotClueCarrier': (prop) => {
        if (!prop.tags.includes('#Inspectable')) prop.tags.push('#Inspectable');
        if (!prop.tags.includes('#SubtleGlint')) prop.tags.push('#SubtleGlint');
    },

    '#ContrabandSource': (prop) => {
        if (!prop.tags.includes('#Inspectable')) prop.tags.push('#Inspectable');
    }
};

// -------------------------------------------------------------
// 5. UNIVERSAL PROPAGATION CASCADE ENGINE
// -------------------------------------------------------------

export function processSectorNarrativeLayer(entities: Entity[]): Entity[] {
    const executedTagPairs = new Set<string>();
    let queue: Array<{ entity: Entity; tag: string }> = [];

    // Collect initial tags
    for (const entity of entities) {
        if (!entity.localPos && entity.pos) {
            entity.localPos = { lx: entity.pos[0], ly: entity.pos[1] };
        }
        for (const tag of entity.tags) {
            queue.push({ entity, tag });
        }
    }

    // Cascade up to 3 passes to allow secondary infections (e.g. MurderVictim -> ShockedWitness -> AgitatedSpeech)
    for (let pass = 0; pass < 3 && queue.length > 0; pass++) {
        const currentBatch = queue;
        queue = [];

        for (const { entity, tag } of currentBatch) {
            const pairKey = `${entity.id}:${tag}`;
            if (executedTagPairs.has(pairKey)) continue;
            executedTagPairs.add(pairKey);

            const rule = NarrativePropagationRules[tag];
            if (rule) {
                const prevTagCount = entity.tags.length;
                rule(entity, entities);

                // If new tags were cascaded onto entities during this rule execution, enqueue them
                for (const other of entities) {
                    for (const t of other.tags) {
                        const otherKey = `${other.id}:${t}`;
                        if (!executedTagPairs.has(otherKey)) {
                            queue.push({ entity: other, tag: t });
                        }
                    }
                }
            }
        }
    }

    return entities;
}

// -------------------------------------------------------------
// 6. GENERALIZED SEMANTIC INJECTION RESOLVER
// -------------------------------------------------------------

export function scoreEntityMatch(e: Entity, query: TargetQuery): number {
    if (e.type !== query.type) return -1;
    const c = query.criteria;
    let score = 0;

    const eRole = String(e.role || '').toLowerCase();
    const eProf = String(e.profession || '').toLowerCase();
    const eName = String(e.name || '').toLowerCase();
    const eFac = String(e.faction || '').toLowerCase();
    const eSp = String(e.species || '').toLowerCase();
    const eTags = (e.tags || []).map((t: string) => t.toLowerCase().replace('#', ''));

    // 1. Occupation / Role Matching
    if (c.occupation || c.profession) {
        const occReq = String(c.occupation || c.profession).toLowerCase().trim();
        const synonyms = SemanticThesaurus[occReq] || [occReq];

        if (eRole.includes(occReq) || eProf.includes(occReq) || eName.includes(occReq)) {
            score += 100; // Exact match
        } else if (synonyms.some(s => eRole.includes(s) || eProf.includes(s) || eName.includes(s))) {
            score += 70; // Semantic synonym match
        } else if (eTags.some(t => t.includes(occReq) || synonyms.some(s => t.includes(s)))) {
            score += 50; // Tag match
        } else {
            return -1; // Must match occupation if explicitly requested
        }
    }

    // 2. Faction Matching
    if (c.faction) {
        const facReq = c.faction.toLowerCase().trim();
        if (eFac.includes(facReq) || eTags.includes(facReq)) {
            score += 40;
        } else if (facReq === 'civilian' && (eTags.includes('civilian') || !eTags.includes('military') && !eTags.includes('outlaw'))) {
            score += 30; // Implicit civilian
        }
    }

    // 3. Species Matching
    if (c.species) {
        const spReq = c.species.toLowerCase().trim();
        if (eSp.includes(spReq) || eTags.includes(spReq)) {
            score += 40;
        }
    }

    // 4. Tag Matching (Container, Hidden, Workstation, etc.)
    if (Array.isArray(c.tags) && c.tags.length > 0) {
        for (const reqTag of c.tags) {
            const cleanReq = reqTag.toLowerCase().replace('#', '');
            const synonyms = PropThesaurus[cleanReq] || [cleanReq];

            if (eTags.some(t => t === cleanReq || t.includes(cleanReq))) {
                score += 30;
            } else if (synonyms.some(s => eTags.some(t => t.includes(s)))) {
                score += 25; // Synonym tag match
            } else if (eName.includes(cleanReq) || synonyms.some(s => eName.includes(s))) {
                score += 20; // Prop name match (e.g. "Storage Vault")
            } else {
                return -1; // Tag requirement missed
            }
        }
    }

    return score;
}

export function resolveDirectorInjections(
    plan: DirectorPlanningPass,
    entities: Entity[]
): { modifiedEntities: Entity[]; appliedCount: number; matchedDetails: any[] } {
    let appliedCount = 0;
    const matchedDetails: any[] = [];
    const claimedEntityIds = new Set<string>();

    for (const injection of plan.injections) {
        const { target_query, apply_tags } = injection;

        // Score every candidate in the sector
        const scoredCandidates = entities
            .filter(e => !claimedEntityIds.has(e.id))
            .map(e => ({ entity: e, score: scoreEntityMatch(e, target_query) }))
            .filter(item => item.score > 0)
            .sort((a, b) => b.score - a.score);

        // Fallback: If no candidate matched strict criteria, fallback gracefully
        let selectedCandidate: Entity | null = scoredCandidates[0]?.entity || null;

        if (!selectedCandidate) {
            // Intelligent Fallback: Pick best-fit entity of the same primary type
            const fallbacks = entities
                .filter(e => e.type === target_query.type && !claimedEntityIds.has(e.id))
                .filter(e => !e.tags.includes('paragon')); // Preserve mayor/marshal unless targeted
            selectedCandidate = fallbacks[0] || null;
        }

        if (selectedCandidate) {
            claimedEntityIds.add(selectedCandidate.id);
            for (const tag of apply_tags) {
                if (!selectedCandidate.tags.includes(tag)) {
                    selectedCandidate.tags.push(tag);
                    appliedCount++;
                }
            }
            matchedDetails.push({
                queryType: target_query.type,
                matchedEntityId: selectedCandidate.id,
                matchedName: selectedCandidate.name || selectedCandidate.role || selectedCandidate.id,
                role: selectedCandidate.role || selectedCandidate.profession || 'Entity',
                tagsAdded: apply_tags
            });
        }
    }

    // Cascade the narrative contagion throughout the entire sector
    processSectorNarrativeLayer(entities);

    return { modifiedEntities: entities, appliedCount, matchedDetails };
}
