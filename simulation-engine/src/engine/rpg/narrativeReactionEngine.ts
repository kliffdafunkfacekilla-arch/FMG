import { Entity, getEntityCoords, propagateToNearby, PropThesaurus, SemanticThesaurus } from "./narrativeTagEngine";

// =============================================================
// NARRATIVE DATA COLLISION REACTION ENGINE
// =============================================================
// Pure deterministic systemic reactions: Traits + Environments = Plot Points.
// Story beats emerge dynamically from raw data collisions without LLM lag,
// token costs, or hallucination.

export interface SectorContext {
    burgId?: number | null;
    burgName?: string;
    cellId: number;
    unrest?: number;
    food?: number;
    wealth?: number;
    tick?: number;
    isNight?: boolean;
    cruorbusPhase?: string;
    isShadowWeek?: boolean;
    activePlayerLocation?: { cellId: number; z_layer: number } | null;
}

export interface ReactionRule {
    id: string;
    name: string;
    description: string;
    priority?: number;

    // Entity matching criteria
    entityConditions?: {
        type?: 'NPC' | 'PROP' | 'ITEM';
        requiredTags?: string[];
        forbiddenTags?: string[];
        roleMatch?: string[];
    };

    // Environmental / Macro state matching
    environmentConditions?: {
        requiredGlobalTags?: string[];
        forbiddenGlobalTags?: string[];
        minUnrest?: number;
        maxUnrest?: number;
        minFood?: number;
        maxFood?: number;
    };

    // Spatial co-presence requirement (e.g., must be near a certain prop or NPC)
    coPresenceConditions?: {
        type?: 'NPC' | 'PROP';
        hasTags: string[];
        maxDistance?: number;
    };

    // Consequence mutations
    resultantMutations: {
        addTags?: string[];
        removeTags?: string[];
        stateOverrides?: {
            alive?: boolean;
            hp?: number;
            disposition?: number;
            role?: string;
            namePrefix?: string;
        };
        nearbyCascades?: Array<{
            targetType: 'NPC' | 'PROP';
            radius: number;
            filter?: (e: Entity) => boolean;
            addTags: string[];
            removeTags?: string[];
        }>;
        sectorTagsToAdd?: string[];
        logEvent?: {
            type: string;
            tier: 'BACKGROUND' | 'MINOR' | 'MAJOR' | 'CRITICAL';
            title: string;
            summaryTemplate: (actor: Entity, context: SectorContext) => string;
        };
    };
}

export interface EvaluatedEvent {
    type: string;
    tier: 'BACKGROUND' | 'MINOR' | 'MAJOR' | 'CRITICAL';
    message: string;
    burgId?: number | null | undefined;
    cellId: number;
    tick?: number | undefined;
}

export interface SectorReactionResult {
    mutated: boolean;
    mutatedEntityCount: number;
    rulesTriggered: string[];
    events: EvaluatedEvent[];
    newSectorTags: string[];
}

// -------------------------------------------------------------
// REACTION TABLE: The Universal Chemical Collision Manifest
// -------------------------------------------------------------
export const NarrativeReactionTable: ReactionRule[] = [

    // 1. REBELLION SEDITION: Blacksmith Infiltration + Martial Law = Midnight Garrison Crackdown
    {
        id: 'sedition_garrison_raid',
        name: 'Garrison Raid on Seditious Blacksmith',
        description: 'Under martial law, an anxious rebel smith is raided by the town watch; the forge is shuttered and chained.',
        priority: 10,
        entityConditions: {
            type: 'NPC',
            requiredTags: ['#RebelInformant'],
            forbiddenTags: ['#Imprisoned', '#Executed', '#Fugitive', '#Acquitted']
        },
        environmentConditions: {
            requiredGlobalTags: ['#MartialLaw']
        },
        resultantMutations: {
            addTags: ['#Imprisoned', '#InCustody'],
            removeTags: ['#AnxiousBehavior', '#NightSchedule'],
            stateOverrides: {
                disposition: -3,
                namePrefix: '[Imprisoned] '
            },
            nearbyCascades: [
                {
                    targetType: 'PROP',
                    radius: 25,
                    filter: p => p.tags.some(t => ['anvil', 'forge', 'workstation', 'door', 'counter'].includes(t.toLowerCase())),
                    addTags: ['#SmithyClosed', '#BoardedDoor', '#RansackedAftermath']
                },
                {
                    targetType: 'PROP',
                    radius: 20,
                    filter: p => p.tags.some(t => PropThesaurus.container!.includes(t.toLowerCase())),
                    addTags: ['#ConfiscatedCache', '#EvidenceSeized']
                },
                {
                    targetType: 'NPC',
                    radius: 35,
                    filter: n => !n.tags.includes('#Imprisoned') && !n.tags.includes('military'),
                    addTags: ['#BrokenTools', '#SupplyDrought', '#FearfulGossip']
                }
            ],
            sectorTagsToAdd: ['#HeightenedSecurity', '#WatchPatrolsActive'],
            logEvent: {
                type: 'MARTIAL_LAW_CRACKDOWN',
                tier: 'MAJOR',
                title: 'Garrison Shuts Seditious Forge',
                summaryTemplate: (actor, ctx) =>
                    `Town Watch enforced martial law in ${ctx.burgName || 'the settlement'}: raided the smithy of ${actor.name || 'the local artisan'}, seizing seditious contraband and padlocking the forge.`
            }
        }
    },

    // 2. CONTRABAND EXPOSURE: Player Discovers Stash + Martial Law = Quarter Lockdown & Curfew
    {
        id: 'contraband_discovery_lockdown',
        name: 'Watch Imposes Curfew Following Contraband Discovery',
        description: 'Discovered contraband prompts the garrison to post inspection notices and aggressively sweep streets.',
        priority: 8,
        entityConditions: {
            type: 'PROP',
            requiredTags: ['#PlayerDiscoveredContraband'],
            forbiddenTags: ['#InvestigatedByWatch', '#CleanedOut']
        },
        environmentConditions: {
            requiredGlobalTags: ['#MartialLaw']
        },
        resultantMutations: {
            addTags: ['#InvestigatedByWatch', '#CrimeSceneNotice'],
            sectorTagsToAdd: ['#CurfewActive', '#GarrisonHighAlert'],
            nearbyCascades: [
                {
                    targetType: 'NPC',
                    radius: 30,
                    filter: n => n.tags.includes('military') || n.tags.includes('soldier'),
                    addTags: ['#AggressivePatrol', '#StopAndSearch']
                },
                {
                    targetType: 'NPC',
                    radius: 30,
                    filter: n => n.tags.includes('civilian'),
                    addTags: ['#CurfewFrightened']
                }
            ],
            logEvent: {
                type: 'SECURITY_ALERT',
                tier: 'MINOR',
                title: 'Watch Declares Curfew Following Contraband Find',
                summaryTemplate: (actor, ctx) =>
                    `City watch marshals in ${ctx.burgName || 'the district'} declared strict night curfew after uncovering hidden contraband at ${actor.name || 'a public container'}.`
            }
        }
    },

    // 3. CORRUPTION SCANDAL: Corrupt Official + Embezzled Ledger = Ruin & Flight
    {
        id: 'corrupt_official_downfall',
        name: 'Downfall of Corrupt Official',
        description: 'Exposed accounting ledgers trigger civic outrage; the magistrate flees as auditors seize municipal estates.',
        priority: 9,
        entityConditions: {
            type: 'NPC',
            requiredTags: ['#CorruptOfficial'],
            forbiddenTags: ['#Deposed', '#Fugitive', '#Executed', '#Exonerated']
        },
        coPresenceConditions: {
            type: 'PROP',
            hasTags: ['#EmbezzledLedger'],
            maxDistance: 60
        },
        environmentConditions: {
            requiredGlobalTags: ['#PublicScandal']
        },
        resultantMutations: {
            addTags: ['#Deposed', '#Fugitive', '#WarrantActive'],
            removeTags: ['#StatelyDemeanor', 'authority', 'leader'],
            stateOverrides: {
                disposition: -4,
                namePrefix: '[Fugitive] '
            },
            nearbyCascades: [
                {
                    targetType: 'PROP',
                    radius: 30,
                    filter: p => p.tags.some(t => ['door', 'gate', 'desk', 'vault'].includes(t.toLowerCase())),
                    addTags: ['#SealedOff', '#AuditInProgress', '#AssetSeizure']
                },
                {
                    targetType: 'NPC',
                    radius: 40,
                    filter: n => n.tags.includes('civilian'),
                    addTags: ['#CelebratoryUnrest', '#Vindicated']
                }
            ],
            sectorTagsToAdd: ['#CivicPowerVacuum'],
            logEvent: {
                type: 'POLITICAL_CORRUPTION_SCANDAL',
                tier: 'MAJOR',
                title: 'Corrupt Magistrate Deposed',
                summaryTemplate: (actor, ctx) =>
                    `Damning ledgers were presented before the council in ${ctx.burgName || 'the burg'}: ${actor.name || 'the magistrate'} was stripped of office and fled into the wilds under active warrant.`
            }
        }
    },

    // 4. UNRESOLVED EXTORTION: Syndicate Squeezes Victim Into Ruin
    {
        id: 'extortion_syndicate_foreclosure',
        name: 'Syndicate Foreclosure and Bondage',
        description: 'Unresolved extortion cascades into total financial ruin and indentured servitude to underworld cartels.',
        priority: 6,
        entityConditions: {
            type: 'NPC',
            requiredTags: ['#ExtortionVictim'],
            forbiddenTags: ['#SavedByHero', '#SyndicateDefeated', '#ImpoverishedLaborer']
        },
        environmentConditions: {
            minUnrest: 20
        },
        resultantMutations: {
            addTags: ['#ImpoverishedLaborer', '#IndenturedServitude', '#Desperate'],
            removeTags: ['#DefensiveDialogue'],
            stateOverrides: {
                disposition: -1
            },
            nearbyCascades: [
                {
                    targetType: 'PROP',
                    radius: 20,
                    filter: p => p.tags.some(t => ['workshop', 'stall', 'counter', 'store'].includes(t.toLowerCase())),
                    addTags: ['#SyndicateTaxed', '#BlackMarketTithe']
                }
            ],
            logEvent: {
                type: 'SYNDICATE_FORECLOSURE',
                tier: 'MINOR',
                title: 'Cartel Seizes Artisan Assets',
                summaryTemplate: (actor, ctx) =>
                    `Underworld syndicates claimed full debt foreclosure on ${actor.name || 'a local artisan'} in ${ctx.burgName || 'the burg'}, forcing them into indentured service.`
            }
        }
    },

    // 5. FORENSICS MYSTERY: Murder Victim Left Cold -> Crime Scene Chalk & Paranoia
    {
        id: 'murder_scene_investigation',
        name: 'Garrison Quarantines Crime Scene',
        description: 'An unaddressed homicide site decays into an official chalk-marked murder cordon with fearful witness whispers.',
        priority: 7,
        entityConditions: {
            type: 'NPC',
            requiredTags: ['#MurderVictim', '#Dead'],
            forbiddenTags: ['#Buried', '#CaseSolved', '#ForensicSealed']
        },
        resultantMutations: {
            addTags: ['#ForensicSealed', '#CorpseRotting'],
            nearbyCascades: [
                {
                    targetType: 'PROP',
                    radius: 18,
                    filter: p => true,
                    addTags: ['#SealedCrimeScene', '#InvestigationChalk']
                },
                {
                    targetType: 'NPC',
                    radius: 25,
                    filter: n => !n.tags.includes('#Dead'),
                    addTags: ['#ParanoidWhispers', '#SuspiciousOfStrangers']
                }
            ],
            sectorTagsToAdd: ['#ActiveMurderInquiry'],
            logEvent: {
                type: 'FORENSIC_UPDATE',
                tier: 'MINOR',
                title: 'Murder Cordon Established',
                summaryTemplate: (actor, ctx) =>
                    `The unresolved slaying of ${actor.name || 'a prominent citizen'} in ${ctx.burgName || 'the quarter'} remains cordoned by watch investigators as paranoia spreads.`
            }
        }
    },

    // 6. OCCULT AWAKENING: Cultist Infiltrator + Cruorbus Full Blood Moon = Dragon Seal Weakens
    {
        id: 'cult_blood_moon_ritual',
        name: 'Blood Moon Cult Rites Breach Dragon Seal',
        description: 'Under the peak blood moon of Cruorbus, unhindered cult infiltrators perform forbidden rites, corrupting the land.',
        priority: 10,
        entityConditions: {
            type: 'NPC',
            requiredTags: ['#CultistInfiltrator'],
            forbiddenTags: ['#RitualDisrupted', '#Dead', '#Banished', '#ChaosAura']
        },
        environmentConditions: {
            requiredGlobalTags: ['#FullBlood']
        },
        resultantMutations: {
            addTags: ['#PossessedZealot', '#ChaosAura'],
            nearbyCascades: [
                {
                    targetType: 'PROP',
                    radius: 25,
                    filter: p => p.tags.some(t => ['altar', 'shrine', 'well', 'fountain', 'stone'].includes(t.toLowerCase())),
                    addTags: ['#ActiveChaosNexus', '#EldritchBlight', '#CursedZone']
                },
                {
                    targetType: 'NPC',
                    radius: 35,
                    filter: n => !n.tags.includes('#CultistInfiltrator'),
                    addTags: ['#NightmareAfflicted', '#Insomnia']
                }
            ],
            sectorTagsToAdd: ['#DragonSealCracked', '#MiasmaAura'],
            logEvent: {
                type: 'CHAOS_SEAL_WEAKENING',
                tier: 'CRITICAL',
                title: 'Cruorbus Blood Moon Cracks Regional Dragon Seal',
                summaryTemplate: (actor, ctx) =>
                    `Under the crimson glare of Cruorbus, occult rites conducted by ${actor.name || 'veiled conspirators'} in ${ctx.burgName || 'the sector'} compromised a chaos dragon seal, unleashing eldritch miasma!`
            }
        }
    },

    // 7. ECONOMIC COLLAPSE: Severe Famine + High Unrest = Grain Exchange Riot & Boarded Stalls
    {
        id: 'famine_granary_riot',
        name: 'Starvation Riot Sacks Municipal Market Stalls',
        description: 'Famine drives desperate peasants to overwhelm town guards, looting grain bins and leaving market stalls shattered.',
        priority: 8,
        entityConditions: {
            type: 'PROP',
            requiredTags: ['market'],
            forbiddenTags: ['#RansackedAftermath', '#Barricaded']
        },
        environmentConditions: {
            requiredGlobalTags: ['#Famine', '#ResourceScarcity'],
            minUnrest: 45
        },
        resultantMutations: {
            addTags: ['#RansackedAftermath', '#GrainLooted', '#BrokenStall'],
            nearbyCascades: [
                {
                    targetType: 'PROP',
                    radius: 20,
                    filter: p => p.tags.some(t => ['door', 'gate'].includes(t.toLowerCase())),
                    addTags: ['#Barricaded']
                },
                {
                    targetType: 'NPC',
                    radius: 35,
                    filter: n => n.tags.includes('civilian'),
                    addTags: ['#DesperateRioter', '#Starving']
                }
            ],
            sectorTagsToAdd: ['#CivilInsurrection', '#FoodRiots'],
            logEvent: {
                type: 'CIVIL_UNREST',
                tier: 'MAJOR',
                title: 'Starving Mobs Sack Municipal Granary',
                summaryTemplate: (actor, ctx) =>
                    `Starving mobs overwhelmed watch sentries and ransacked the grain exchange at ${actor.name || 'the town markets'} in ${ctx.burgName || 'the settlement'}.`
            }
        }
    },

    // 8. BOUNTY RESOLUTION: Hunted Fugitive Tracked by Mercenaries -> Skirmish Debris
    {
        id: 'bounty_skirmish_aftermath',
        name: 'Bounty Hunter Skirmish Corners Outlaw',
        description: 'Mercenaries locate an active bounty target, leaving spent quarrels, blood on cobbles, and a cornered fugitive.',
        priority: 7,
        entityConditions: {
            type: 'NPC',
            requiredTags: ['#BountyTarget'],
            forbiddenTags: ['#Captured', '#Dead', '#Cornered']
        },
        environmentConditions: {
            requiredGlobalTags: ['#BountyActive']
        },
        resultantMutations: {
            addTags: ['#WoundedFugitive', '#Cornered'],
            stateOverrides: {
                hp: 12,
                disposition: -3
            },
            nearbyCascades: [
                {
                    targetType: 'PROP',
                    radius: 15,
                    filter: p => true,
                    addTags: ['#SkirmishDebris', '#SpentArrows', '#BloodSplatters']
                }
            ],
            logEvent: {
                type: 'BOUNTY_SKIRMISH',
                tier: 'MINOR',
                title: 'Bounty Hunters Corner Target',
                summaryTemplate: (actor, ctx) =>
                    `Bounty hunters ambushed outlaw ${actor.name || 'the fugitive'} in ${ctx.burgName || 'the streets'}, leaving debris and blood trails across the quarter.`
            }
        }
    },

    // 9. HEDGE WIZARD INQUISITION: Unlicensed Alchemist Lab Seized by Sanctum
    {
        id: 'hedge_wizard_raid',
        name: 'Inquisition Seizes Contraband Alchemy Lab',
        description: 'Sanctioned patrols smash illicit alembics and drive rogue spellwrights into subterranean flues.',
        priority: 7,
        entityConditions: {
            type: 'NPC',
            requiredTags: ['#HedgeWizard'],
            forbiddenTags: ['#UndergroundFugitive', '#Dead', '#Imprisoned']
        },
        environmentConditions: {
            requiredGlobalTags: ['#MartialLaw']
        },
        resultantMutations: {
            addTags: ['#UndergroundFugitive', '#HiddenInCellar'],
            nearbyCascades: [
                {
                    targetType: 'PROP',
                    radius: 20,
                    filter: p => p.tags.some(t => ['workstation', 'altar', 'counter', 'kiln'].includes(t.toLowerCase())),
                    addTags: ['#AlchemicalLabSeized', '#SmolderingCrucible']
                }
            ],
            logEvent: {
                type: 'INQUISITION_RAID',
                tier: 'MINOR',
                title: 'Illicit Alchemical Lab Smashed',
                summaryTemplate: (actor, ctx) =>
                    `Patrols raided the clandestine workshop of hedge alchemist ${actor.name || 'a spellwright'} in ${ctx.burgName || 'the burg'}, smashing alembics and seizing forbidden philters.`
            }
        }
    },

    // 10. GRIND CANYON CHASM: Eldritch Chasm Opens -> Scavenger Diving Hoist Established
    {
        id: 'canyon_scavenger_rush',
        name: 'Salvagers Erect Diving Rig Over Eldritch Chasm',
        description: 'When a Grind Canyon fissure stabilizes, daring salvage crews erect hoisting platforms to dredge dragonstone.',
        priority: 6,
        entityConditions: {
            type: 'PROP',
            requiredTags: ['#DungeonEntrance'],
            forbiddenTags: ['#DivingCampEstablished', '#ChasmCollapsed']
        },
        resultantMutations: {
            addTags: ['#DivingCampEstablished', '#ActiveDivingRig'],
            nearbyCascades: [
                {
                    targetType: 'NPC',
                    radius: 30,
                    filter: n => n.tags.includes('civilian') || n.tags.includes('criminal'),
                    addTags: ['#TreasureSeeker', '#DragonstoneProspector']
                }
            ],
            logEvent: {
                type: 'CHASM_EXPEDITION',
                tier: 'MINOR',
                title: 'Salvage Hoist Erected Over Deep Chasm',
                summaryTemplate: (actor, ctx) =>
                    `Salvage prospectors erected heavy hoisting rigs over the chasm of ${actor.name || 'the chasm opening'} in ${ctx.burgName || 'the wilderness'} to dredge dragonstone.`
            }
        }
    }
];

// -------------------------------------------------------------
// CORE EVALUATION PIPELINE
// -------------------------------------------------------------
export function evaluateSectorReactions(
    sectorEntities: Entity[],
    globalTags: string[],
    context: SectorContext
): SectorReactionResult {
    const activeSectorTags = new Set<string>(globalTags);
    const triggeredRules: string[] = [];
    const generatedEvents: EvaluatedEvent[] = [];
    let mutatedCount = 0;

    // Sort rules by priority descending
    const sortedRules = [...NarrativeReactionTable].sort((a, b) => (b.priority || 0) - (a.priority || 0));

    for (const rule of sortedRules) {
        // 1. Verify environmental conditions
        if (rule.environmentConditions) {
            const { requiredGlobalTags, forbiddenGlobalTags, minUnrest, maxUnrest, minFood, maxFood } = rule.environmentConditions;

            if (requiredGlobalTags && !requiredGlobalTags.every(t => activeSectorTags.has(t))) {
                continue;
            }
            if (forbiddenGlobalTags && forbiddenGlobalTags.some(t => activeSectorTags.has(t))) {
                continue;
            }
            if (minUnrest !== undefined && (context.unrest || 0) < minUnrest) {
                continue;
            }
            if (maxUnrest !== undefined && (context.unrest || 0) > maxUnrest) {
                continue;
            }
            if (minFood !== undefined && (context.food || 0) < minFood) {
                continue;
            }
            if (maxFood !== undefined && (context.food || 0) > maxFood) {
                continue;
            }
        }

        // 2. Iterate candidates that match entityConditions
        for (const entity of sectorEntities) {
            if (rule.entityConditions) {
                const { type, requiredTags, forbiddenTags, roleMatch } = rule.entityConditions;

                if (type && entity.type !== type) continue;
                if (requiredTags && !requiredTags.every(rt => entity.tags.includes(rt))) continue;
                if (forbiddenTags && forbiddenTags.some(ft => entity.tags.includes(ft))) continue;
                if (roleMatch && (!entity.role || !roleMatch.some(rm => entity.role!.toLowerCase().includes(rm.toLowerCase())))) continue;
            }

            // 3. Verify spatial co-presence if specified
            if (rule.coPresenceConditions) {
                const { type: coType, hasTags: coTags, maxDistance = 40 } = rule.coPresenceConditions;
                const entCoords = getEntityCoords(entity);

                const hasCoPresence = sectorEntities.some(other => {
                    if (other.id === entity.id) return false;
                    if (coType && other.type !== coType) return false;
                    if (!coTags.every(ct => other.tags.includes(ct))) return false;
                    const otherCoords = getEntityCoords(other);
                    const dist = Math.hypot(otherCoords.x - entCoords.x, otherCoords.y - entCoords.y);
                    return dist <= maxDistance;
                });

                if (!hasCoPresence) continue;
            }

            // 4. APPLY MUTATIONS! Collision triggered!
            triggeredRules.push(rule.id);
            mutatedCount++;

            // Primary entity tag modifications
            if (rule.resultantMutations.addTags) {
                for (const tag of rule.resultantMutations.addTags) {
                    if (!entity.tags.includes(tag)) entity.tags.push(tag);
                }
            }
            if (rule.resultantMutations.removeTags) {
                entity.tags = entity.tags.filter(t => !rule.resultantMutations.removeTags!.includes(t));
            }

            // State overrides (e.g. hp, disposition, alive)
            if (rule.resultantMutations.stateOverrides) {
                const so = rule.resultantMutations.stateOverrides;
                if (so.alive !== undefined) entity.alive = so.alive;
                if (so.hp !== undefined) entity.hp = so.hp;
                if (so.disposition !== undefined) entity.disposition = (entity.disposition || 0) + so.disposition;
                if (so.role !== undefined) entity.role = so.role;
                if (so.namePrefix && entity.name && !entity.name.startsWith(so.namePrefix)) {
                    entity.name = `${so.namePrefix}${entity.name}`;
                }
            }

            // Spatial cascades onto neighboring entities
            if (rule.resultantMutations.nearbyCascades) {
                for (const cascade of rule.resultantMutations.nearbyCascades) {
                    for (const tag of cascade.addTags) {
                        propagateToNearby(
                            entity,
                            sectorEntities,
                            cascade.targetType,
                            cascade.filter || (() => true),
                            tag,
                            cascade.radius
                        );
                    }
                }
            }

            // Sector tags
            if (rule.resultantMutations.sectorTagsToAdd) {
                for (const st of rule.resultantMutations.sectorTagsToAdd) {
                    activeSectorTags.add(st);
                }
            }

            // Log event creation
            if (rule.resultantMutations.logEvent) {
                const evDef = rule.resultantMutations.logEvent;
                generatedEvents.push({
                    type: evDef.type,
                    tier: evDef.tier,
                    message: `📜 [${evDef.tier}] ${evDef.summaryTemplate(entity, context)}`,
                    burgId: context.burgId || null,
                    cellId: context.cellId,
                    tick: context.tick
                });
            }

            // Once rule fires for an entity, advance to next rule/entity
            break;
        }
    }

    return {
        mutated: mutatedCount > 0,
        mutatedEntityCount: mutatedCount,
        rulesTriggered: triggeredRules,
        events: generatedEvents,
        newSectorTags: Array.from(activeSectorTags)
    };
}
