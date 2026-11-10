import { Entity, getEntityCoords, propagateToNearby, PropThesaurus, SemanticThesaurus } from "./narrativeTagEngine";
import { ThreadWorldDelta } from "../threads/threadEngine.js";

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
    rx?: number;
    ry?: number;
}

export interface ThreadCandidate {
    question: string;
    stakes: string;
    actor_ids: string[];
    cell_id: number;
    rx: number;
    ry: number;
    clock_max: number;
    origin: 'reaction';
    rule_id?: string;
    on_expire?: ThreadWorldDelta;
    on_resolved_by_party?: ThreadWorldDelta;
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

    // Optional persistent thread formulation for major drama collisions (STORY_AUDIT Step 2 & Step 5)
    threadTemplate?: {
        questionTemplate: (actor: Entity, context: SectorContext) => string;
        stakesTemplate: (actor: Entity, context: SectorContext) => string;
        clockMax?: number;
        on_expire: (actor: Entity, context: SectorContext) => ThreadWorldDelta;
        on_resolved_by_party: (actor: Entity, context: SectorContext) => ThreadWorldDelta;
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
    threadsToOpen: ThreadCandidate[];
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
        },
        threadTemplate: {
            questionTemplate: (actor, ctx) =>
                `Will the crackdown on ${actor.name || 'the blacksmith'} ignite an open riot against the garrison?`,
            stakesTemplate: (actor, ctx) =>
                `The blacksmith will face execution and the smithy will be permanently demolished unless intervened.`,
            clockMax: 4,
            on_expire: (actor, ctx) => ({
                unrestDelta: 25,
                wealthDelta: -300,
                rawMaterialsDelta: -150,
                actorTagsAdd: ['#Executed', '#MartyrOfRebellion'],
                actorTagsRemove: ['#InCustody', '#Imprisoned'],
                actorAlive: false,
                propTagsAdd: ['#ForgeDismantled', '#RubbleChoked'],
                propNameMatch: 'forge',
                sectorTagsAdd: ['#MartialTerror'],
                narrativeSummary: `Garrison publicly executed ${actor.name || 'the blacksmith'}; the smithy was dismantled, sparking seething fury and weapon shortages across ${ctx.burgName || 'the settlement'}.`
            }),
            on_resolved_by_party: (actor, ctx) => ({
                unrestDelta: -15,
                wealthDelta: 150,
                rawMaterialsDelta: 100,
                actorTagsAdd: ['#RebelAlly', '#VindicatedArtisan'],
                actorTagsRemove: ['#InCustody', '#Imprisoned', '#SupplyDrought'],
                actorDispositionDelta: 3,
                propTagsAdd: ['#SmithyOperational'],
                propTagsRemove: ['#SmithyClosed', '#BoardedDoor'],
                propNameMatch: 'forge',
                sectorTagsRemove: ['#WatchPatrolsActive'],
                narrativeSummary: `The party uncovered evidence exonerating ${actor.name || 'the blacksmith'} and dismantled garrison extortion, reopening the forge and restoring hope to ${ctx.burgName || 'the settlement'}.`
            })
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
        },
        threadTemplate: {
            questionTemplate: (actor, ctx) =>
                `Will the deposed official ${actor.name || 'the magistrate'} escape into exile with the municipal treasury?`,
            stakesTemplate: (actor, ctx) =>
                `${actor.name || 'The official'} will abscond with civic gold, leaving public institutions bankrupt and crime unchecked.`,
            clockMax: 5,
            on_expire: (actor, ctx) => ({
                unrestDelta: 15,
                wealthDelta: -450,
                crimeRateDelta: 12,
                actorTagsAdd: ['#ExiledInShadows'],
                actorTagsRemove: ['#Fugitive'],
                actorDispositionDelta: -2,
                propTagsAdd: ['#VaultEmptied'],
                propNameMatch: 'chest',
                sectorTagsAdd: ['#TreasuryBankrupt'],
                narrativeSummary: `${actor.name || 'The corrupt official'} successfully fled into exile with the treasury; civic services collapsed in bankruptcy.`
            }),
            on_resolved_by_party: (actor, ctx) => ({
                unrestDelta: -10,
                wealthDelta: 400,
                crimeRateDelta: -10,
                actorTagsAdd: ['#AwaitingTrial', '#InChains'],
                actorTagsRemove: ['#Fugitive', '#WarrantActive'],
                actorDispositionDelta: -3,
                propTagsAdd: ['#TreasurySecured'],
                propNameMatch: 'chest',
                sectorTagsRemove: ['#PublicScandal'],
                narrativeSummary: `The party tracked down and captured ${actor.name || 'the official'}, recovering the stolen civic treasury for ${ctx.burgName || 'the citizens'}.`
            })
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
        },
        threadTemplate: {
            questionTemplate: (actor, ctx) =>
                `Will the occult rite led by ${actor.name || 'the cultist'} tear open an eldritch rift beneath the sector?`,
            stakesTemplate: (actor, ctx) =>
                `An abyssal breach will taint water supplies, rot granaries, and summon madness into the streets.`,
            clockMax: 4,
            on_expire: (actor, ctx) => ({
                unrestDelta: 30,
                crimeRateDelta: 15,
                foodDelta: -120,
                actorTagsAdd: ['#DaemonVessel', '#AscendedHorror'],
                actorDispositionDelta: -5,
                sectorTagsAdd: ['#ChaosNexusBreached', '#EldritchTaint'],
                narrativeSummary: `The cult finished the unholy blood rite; abyssal miasma tore through ${ctx.burgName || 'the district'}, blighting provisions and corrupting minds.`
            }),
            on_resolved_by_party: (actor, ctx) => ({
                unrestDelta: -10,
                crimeRateDelta: -8,
                wealthDelta: 75,
                actorTagsAdd: ['#RitualBroken', '#CultShattered'],
                actorTagsRemove: ['#PossessedZealot', '#ChaosAura'],
                actorAlive: false,
                sectorTagsAdd: ['#SanctumPurified'],
                sectorTagsRemove: ['#CultPresence', '#EldritchTaint', '#DragonSealCracked'],
                narrativeSummary: `The party assaulted the desecrated sanctum and sundered the ritual focus, banishing the abyssal shadows from ${ctx.burgName || 'the district'}.`
            })
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
    },

    // 11. CASCADE WAVE 2: Shuttered Smithy & Broken Tools -> Agricultural Stagnation
    {
        id: 'agricultural_tool_shortage',
        name: 'Tool Shortage Stalls Regional Agriculture',
        description: 'With the local smith imprisoned and forge boarded, laborers cannot repair plows, halting planting and harvest.',
        priority: 5,
        entityConditions: {
            type: 'NPC',
            requiredTags: ['#BrokenTools'],
            forbiddenTags: ['#FarmsStalled', '#PlowRepaired'],
            roleMatch: ['farmer', 'husbandman', 'laborer', 'peasant', 'harvester', 'field hand']
        },
        resultantMutations: {
            addTags: ['#FarmsStalled', '#GrainDeficit'],
            nearbyCascades: [
                {
                    targetType: 'PROP',
                    radius: 35,
                    filter: p => p.tags.some(t => ['field', 'granary', 'wagon', 'cart', 'stall'].includes(t.toLowerCase())),
                    addTags: ['#OvergrownFields', '#UnworkedSoil']
                }
            ],
            sectorTagsToAdd: ['#AgriculturalCrisis', '#ResourceScarcity'],
            logEvent: {
                type: 'ECONOMIC_RIPPLE',
                tier: 'MINOR',
                title: 'Forge Closure Halts Regional Agriculture',
                summaryTemplate: (actor, ctx) =>
                    `With forges padlocked under garrison decree, agricultural laborers in ${ctx.burgName || 'the district'} suffer severe tool shortages, leaving fields unworked.`
            }
        }
    },

    // 12. CASCADE WAVE 2: Looted Granary + Food Crisis -> Syndicate Black Market Exploitation
    {
        id: 'syndicate_black_market_grain',
        name: 'Cartels Monopolize Black Market Grain',
        description: 'Following granary ransackings or farm failures, underworld syndicates establish illicit grain dens, extorting starvation rations.',
        priority: 5,
        entityConditions: {
            type: 'PROP',
            requiredTags: ['#RansackedAftermath'],
            forbiddenTags: ['#BlackMarketGrainDepot', '#GuardedByCartel']
        },
        environmentConditions: {
            requiredGlobalTags: ['#ResourceScarcity']
        },
        resultantMutations: {
            addTags: ['#BlackMarketGrainDepot', '#GuardedByCartel'],
            nearbyCascades: [
                {
                    targetType: 'NPC',
                    radius: 30,
                    filter: n => n.tags.includes('civilian'),
                    addTags: ['#SmugglerPriceGouging', '#ExtortionDebt']
                }
            ],
            sectorTagsToAdd: ['#CartelMonopoly', '#UndergroundDominance'],
            logEvent: {
                type: 'UNDERWORLD_EXPLOITATION',
                tier: 'MAJOR',
                title: 'Cartel Seizes Illicit Grain Monopoly',
                summaryTemplate: (actor, ctx) =>
                    `Underworld syndicates established illicit rations depots at ${actor.name || 'a ransacked granary'} in ${ctx.burgName || 'the burg'}, reselling stolen grain at extortionate prices.`
            }
        }
    },

    // 13. CASCADE WAVE 3: Paranoia + Suspect -> Vigilante Mob Justice
    {
        id: 'mob_justice_paranoia',
        name: 'Vigilante Mob Corners Suspect',
        description: 'Unresolved crime scene paranoia boils over into torches and pitchforks as frantic citizens corner prime suspects.',
        priority: 4,
        entityConditions: {
            type: 'NPC',
            requiredTags: ['#ParanoidWhispers'],
            forbiddenTags: ['#VigilanteMobActive']
        },
        coPresenceConditions: {
            type: 'NPC',
            hasTags: ['#PrimeSuspect'],
            maxDistance: 35
        },
        resultantMutations: {
            addTags: ['#VigilanteMobActive', '#ArmedWithTorches'],
            nearbyCascades: [
                {
                    targetType: 'NPC',
                    radius: 35,
                    filter: n => n.tags.includes('#PrimeSuspect'),
                    addTags: ['#CorneredByMob', '#InMortalDanger']
                }
            ],
            sectorTagsToAdd: ['#VigilanteChaos'],
            logEvent: {
                type: 'CIVIL_PANIC',
                tier: 'MAJOR',
                title: 'Vigilante Mob Forms in Streets',
                summaryTemplate: (actor, ctx) =>
                    `Paranoid whispers in ${ctx.burgName || 'the quarter'} erupted into vigilante fury as citizens armed with clubs and torches cornered murder suspects.`
            }
        },
        threadTemplate: {
            questionTemplate: (actor, ctx) =>
                `Will the vigilante mob lynch the cornered suspect in ${ctx.burgName || 'the streets'} before the watch arrives?`,
            stakesTemplate: (actor, ctx) =>
                `An innocent civilian will be murdered and mob rule will usurp the town magistrates.`,
            clockMax: 3,
            on_expire: (actor, ctx) => ({
                unrestDelta: 20,
                crimeRateDelta: 15,
                wealthDelta: -50,
                sectorTagsAdd: ['#LynchMobHorror', '#MobRule'],
                sectorTagsRemove: ['#VigilanteChaos'],
                narrativeSummary: `The vigilante mob lynched their suspect in ${ctx.burgName || 'the street'}; gruesome mob violence shattered civic peace and sent tremors of terror across the populace.`
            }),
            on_resolved_by_party: (actor, ctx) => ({
                unrestDelta: -10,
                crimeRateDelta: -10,
                wealthDelta: 40,
                actorTagsAdd: ['#DispersedMob', '#PacifiedCitizens'],
                actorTagsRemove: ['#VigilanteMobActive', '#ArmedWithTorches', '#ParanoidWhispers'],
                sectorTagsRemove: ['#VigilanteChaos'],
                sectorTagsAdd: ['#OrderRestored'],
                narrativeSummary: `The party confronted the mob, exposed the true perpetrators, and pacified the crowd, restoring lawful order in ${ctx.burgName || 'the quarter'}.`
            })
        }
    },

    // 14. CASCADE WAVE 3: Deposed Leader in Wilds Recruits Mercenary Counter-Coup
    {
        id: 'deposed_leader_mercenary_counterattack',
        name: 'Deposed Official Assembles Mercenary Retinue',
        description: 'Exiled magistrates hire ruthless frontier mercenaries, scheming a bloody military coup to retake civic power.',
        priority: 4,
        entityConditions: {
            type: 'NPC',
            requiredTags: ['#Deposed', '#Fugitive'],
            forbiddenTags: ['#MercenaryRetinueRecruited', '#Dead', '#Imprisoned']
        },
        environmentConditions: {
            minUnrest: 40
        },
        resultantMutations: {
            addTags: ['#MercenaryRetinueRecruited', '#PlottingCounterCoup'],
            stateOverrides: {
                disposition: -3,
                role: 'Warlord in Exile'
            },
            nearbyCascades: [
                {
                    targetType: 'PROP',
                    radius: 20,
                    filter: p => true,
                    addTags: ['#WarCampDebris', '#SellswordArms']
                }
            ],
            sectorTagsToAdd: ['#PendingCivilWar'],
            logEvent: {
                type: 'POLITICAL_CONSPIRACY',
                tier: 'MAJOR',
                title: 'Exiled Magistrate Enlists Frontier Mercenaries',
                summaryTemplate: (actor, ctx) =>
                    `From exile in the fringes, deposed magistrate ${actor.name || 'the fallen leader'} has assembled a vicious company of mercenaries, plotting a counter-coup against ${ctx.burgName || 'their former seat'}.`
            }
        },
        threadTemplate: {
            questionTemplate: (actor, ctx) =>
                `Will ${actor.name || 'the deposed leader'} sack the lower ward with hired sellswords to reclaim power?`,
            stakesTemplate: (actor, ctx) =>
                `Mercenary brigades will pillage mercantile stores, slaughtering militia and setting the ward ablaze.`,
            clockMax: 4,
            on_expire: (actor, ctx) => ({
                unrestDelta: 30,
                wealthDelta: -500,
                crimeRateDelta: 15,
                sectorTagsAdd: ['#MercenarySack', '#SmolderingDistrict'],
                sectorTagsRemove: ['#PendingCivilWar'],
                narrativeSummary: `Hired sellswords stormed the lower gatehouse, pillaging warehouses and leaving ${ctx.burgName || 'the ward'} in smoldering ruin.`
            }),
            on_resolved_by_party: (actor, ctx) => ({
                unrestDelta: -15,
                wealthDelta: 120,
                crimeRateDelta: -10,
                actorTagsAdd: ['#SellswordsDispersed', '#LeaderCaptured'],
                actorTagsRemove: ['#MercenaryRetinueRecruited', '#PlottingCounterCoup'],
                actorAlive: false,
                sectorTagsAdd: ['#DistrictSecured'],
                sectorTagsRemove: ['#PendingCivilWar'],
                narrativeSummary: `The party broke the mercenary leadership and neutralized ${actor.name || 'the warlord'}, preserving ${ctx.burgName || 'the ward'} from devastation.`
            })
        }
    },

    // 15. CASCADE WAVE 3: Prolonged Chaos Nexus Exposure -> Eldritch Mutation
    {
        id: 'chaos_nexus_mutation',
        name: 'Exposure to Cracked Seal Induces Eldritch Mutation',
        description: 'Prolonged nightmares around an active chaos nexus twist mortal minds and bodies into dragon-touched frenzy.',
        priority: 4,
        entityConditions: {
            type: 'NPC',
            requiredTags: ['#NightmareAfflicted'],
            forbiddenTags: ['#EldritchMutated', '#DragonTouched']
        },
        coPresenceConditions: {
            type: 'PROP',
            hasTags: ['#ActiveChaosNexus'],
            maxDistance: 35
        },
        resultantMutations: {
            addTags: ['#EldritchMutated', '#DragonTouched', '#Frenzied'],
            stateOverrides: {
                disposition: -4,
                namePrefix: '[Dragon-Touched] '
            },
            nearbyCascades: [
                {
                    targetType: 'PROP',
                    radius: 20,
                    filter: p => true,
                    addTags: ['#CrystallineResidue', '#ArcaneScorching']
                }
            ],
            sectorTagsToAdd: ['#ActiveChaosOutbreak'],
            logEvent: {
                type: 'CHAOS_CORRUPTION',
                tier: 'CRITICAL',
                title: 'Miasma Induces Eldritch Mutations',
                summaryTemplate: (actor, ctx) =>
                    `Prolonged exposure to the breached chaos nexus in ${ctx.burgName || 'the sector'} warped ${actor.name || 'a citizen'} into a frenzied, dragon-touched mutant!`
            }
        }
    }
];

// -------------------------------------------------------------
// CORE EVALUATION PIPELINE: Multi-Pass Cascading Reaction Loop
// -------------------------------------------------------------
export function evaluateSectorReactions(
    sectorEntities: Entity[],
    globalTags: string[],
    context: SectorContext,
    maxPasses: number = 3
): SectorReactionResult {
    const activeSectorTags = new Set<string>(globalTags);
    const triggeredRules: string[] = [];
    const generatedEvents: EvaluatedEvent[] = [];
    const threadsToOpen: ThreadCandidate[] = [];
    const executedRuleIds = new Set<string>();
    let mutatedCount = 0;

    // Sort rules by priority descending
    const sortedRules = [...NarrativeReactionTable].sort((a, b) => (b.priority || 0) - (a.priority || 0));

    // Multi-pass reaction cascade loop:
    // When Pass 1 generates new tags (e.g. #BrokenTools, #RansackedAftermath),
    // Pass 2 immediately allows those newly spawned tags to react with neighboring entities!
    for (let pass = 0; pass < maxPasses; pass++) {
        let passMutated = false;

        for (const rule of sortedRules) {
            // Avoid firing the exact same rule twice within the same tick evaluation
            if (executedRuleIds.has(rule.id)) continue;

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
                executedRuleIds.add(rule.id);
                triggeredRules.push(rule.id);
                mutatedCount++;
                passMutated = true;

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

                // Persistent thread formulation if drama threshold met (MAJOR or CRITICAL, or explicit threadTemplate)
                // Threads are driven by human/character actors (NPCs), not props
                const isDramaHigh = rule.threadTemplate || (rule.resultantMutations.logEvent && ['MAJOR', 'CRITICAL'].includes(rule.resultantMutations.logEvent.tier));
                if (isDramaHigh && entity.id && entity.type === 'NPC') {
                    const question = rule.threadTemplate
                        ? rule.threadTemplate.questionTemplate(entity, context)
                        : `Will the fallout from "${rule.resultantMutations.logEvent?.title || rule.name}" in ${context.burgName || 'the settlement'} escalate out of hand?`;
                    const stakes = rule.threadTemplate
                        ? rule.threadTemplate.stakesTemplate(entity, context)
                        : (rule.resultantMutations.logEvent ? rule.resultantMutations.logEvent.summaryTemplate(entity, context) : rule.description);
                    const clockMax = rule.threadTemplate?.clockMax ?? 6;

                    const on_expire: ThreadWorldDelta = rule.threadTemplate?.on_expire
                        ? rule.threadTemplate.on_expire(entity, context)
                        : {
                            unrestDelta: 10,
                            wealthDelta: -100,
                            narrativeSummary: `The unchecked fallout of ${rule.name} destabilized ${context.burgName || 'the sector'}.`
                        };

                    const on_resolved_by_party: ThreadWorldDelta = rule.threadTemplate?.on_resolved_by_party
                        ? rule.threadTemplate.on_resolved_by_party(entity, context)
                        : {
                            unrestDelta: -5,
                            wealthDelta: 50,
                            narrativeSummary: `The party intervened in the fallout of ${rule.name}, restoring stability to ${context.burgName || 'the sector'}.`
                        };

                    threadsToOpen.push({
                        question,
                        stakes,
                        actor_ids: [String(entity.id)],
                        cell_id: context.cellId,
                        rx: context.rx ?? 50,
                        ry: context.ry ?? 50,
                        clock_max: clockMax,
                        origin: 'reaction',
                        rule_id: rule.id,
                        on_expire,
                        on_resolved_by_party
                    });
                }

                // Once rule fires for an entity in this pass, advance to next rule
                break;
            }
        }

        // If no new reactions fired in this pass, the cascade has settled
        if (!passMutated) break;
    }

    return {
        mutated: mutatedCount > 0,
        mutatedEntityCount: mutatedCount,
        rulesTriggered: triggeredRules,
        events: generatedEvents,
        newSectorTags: Array.from(activeSectorTags),
        threadsToOpen
    };
}
