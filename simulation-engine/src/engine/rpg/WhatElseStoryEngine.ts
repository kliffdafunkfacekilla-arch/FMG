/**
 * AETHERIA SIMULATION-DRIVEN SECTOR SYNTHESIZER
 * ============================================
 * Completely eliminates canned, hardcoded quest checklists and fixed encounters.
 * Procedurally synthesizes tactical entities and landmarks directly from:
 * 1. Live Regional Instance agents (roaming predators, prey, merchants, patrols, smugglers)
 * 2. Biome-specific trophic ecology (fauna, flora, geological formations)
 * 3. Real infrastructure masks (highways, smuggler routes, ancient ruins, battlefields, camps)
 * 4. Ground-truth simulation variables (famine, warfare, unrest, chaos radiation)
 */

import { TaggedObject, TagMatrixEngine } from "./TagMatrixEngine.js";
import {
  getRandomWeaponForStat,
  getRandomArmorForStat,
  StatKey
} from "./EquipmentRegistry.js";

export interface QuestObjective {
  id: string;
  type: "DESTROY_PROP" | "DEFEAT_NPC" | "INTERACT_PROP" | "CONVINCE_NPC" | "EXPLORE_POI";
  description: string;
  targetId: string;
  requiredCount: number;
  currentCount: number;
  completed: boolean;
}

export type StoryBeatCategory =
  | "WILDERNESS_SCOUT"
  | "ECOLOGICAL_EXPEDITION"
  | "HIGHWAY_ENCOUNTER"
  | "ANCIENT_EXPEDITION"
  | "WARZONE_ASSAULT"
  | "FOOD_CRISIS"
  | "CRIME_SYNDICATE"
  | "CHAOS_CORRUPTION";

export interface StoryBeat {
  beatId: string;
  category: StoryBeatCategory;
  title: string;
  hook: string;
  questGiver: { name: string; role: string; faction?: string | undefined };
  opposingFaction?: string | undefined;
  objectives: QuestObjective[];
  rewards: { xp: number; gold: number; item?: string };
  reputationChanges: Record<string, number>;
  pivotDecision: string;
  variants: Array<{
    name: string;
    description: string;
    preferredStat: string;
  }>;
}

export interface InjectedNPC {
  id: string;
  name: string;
  role: string;
  pos: [number, number];
  tags: string[];
  faction: string;
  hp: number;
  maxHp: number;
  disposition: number; // -2 Hostile, -1 Territorial/Wary, 0 Neutral, +1 Friendly, +2 Allied
  alive: boolean;
  equippedWeapon?: string;
  equippedArmor?: string;
  statAffinity?: StatKey;
  stats?: Partial<Record<StatKey, number>>;
}

export interface InjectedWorldState {
  props: TaggedObject[];
  npcs: InjectedNPC[];
  activeBeat: StoryBeat;
}

export interface SectorContext {
  cellId: number;
  rx?: number;
  ry?: number;
  biomeName: string;
  isWarzone: boolean;
  isFamine: boolean;
  chaosRadiation: number;
  infrastructureMask: number;
  factionOwner?: string;
  crimeRate?: number | string;
  entitiesPresent?: Array<{ type: string; state: string; story_hook: string }>;
}

class SeededPRNG {
  private s: number;
  constructor(seed: number) {
    this.s = Math.abs(seed) || 1234567;
  }
  public next(): number {
    this.s = (this.s * 1664525 + 1013904223) % 4294967296;
    return this.s / 4294967296;
  }
  public range(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
  public pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)]!;
  }
}

interface BiomeEcology {
  predators: Array<{ name: string; affinity: StatKey; weapon: string; armor: string; hp: number }>;
  prey: Array<{ name: string; affinity: StatKey; armor: string; hp: number }>;
  flora: Array<{ name: string; tags: string[]; hp: number }>;
  geology: Array<{ name: string; tags: string[]; hp: number }>;
}

const BIOME_ECOLOGY_MATRIX: Record<string, BiomeEcology> = {
  "Wetland": {
    predators: [
      { name: "Mire Crocodile", affinity: "might", weapon: "Crushing Jaws", armor: "Rubberized Scaled Hide", hp: 32 },
      { name: "Bog Stalker", affinity: "finesse", weapon: "Venomous Mandibles", armor: "Mud-Caked Carapace", hp: 24 },
      { name: "Marsh Leech-Hound", affinity: "reflex", weapon: "Barbed Proboscis", armor: "Slimy Pelt", hp: 20 }
    ],
    prey: [
      { name: "Crested Marsh Elk", affinity: "vitality", armor: "Waterproof Pelt", hp: 18 },
      { name: "Giant Wetland Hare", affinity: "reflex", armor: "Soft Fluff", hp: 10 },
      { name: "Reed Heron", affinity: "awareness", armor: "Hollow Quills", hp: 8 }
    ],
    flora: [
      { name: "Fluorescent Bog Lichen", tags: ["organic", "forageable", "fragile", "glowing", "herbs"], hp: 10 },
      { name: "Sweet-Water Reed Cluster", tags: ["organic", "forageable", "flammable", "fiber"], hp: 15 }
    ],
    geology: [
      { name: "Sunken Peat Mound", tags: ["earth", "cover_light", "flammable"], hp: 25 },
      { name: "Hollow Cypress Snag", tags: ["wood", "shelter", "flammable", "container"], hp: 30 }
    ]
  },
  "Temperate Forest": {
    predators: [
      { name: "Shadow Timber-Wolf", affinity: "finesse", weapon: "Serrated Fangs", armor: "Dense Grey Pelt", hp: 26 },
      { name: "Grizzled Briar Bear", affinity: "might", weapon: "Heavy Claws", armor: "Thick Layered Fat", hp: 40 },
      { name: "Forest Lynx", affinity: "reflex", weapon: "Razor Talons", armor: "Camouflage Fur", hp: 20 }
    ],
    prey: [
      { name: "Great Antler Stag", affinity: "reflex", armor: "Tough Leather Hide", hp: 22 },
      { name: "Spotted Forest Doe", affinity: "awareness", armor: "Supple Hide", hp: 14 },
      { name: "Bristle Pine Badger", affinity: "endurance", armor: "Coarse Bristles", hp: 12 }
    ],
    flora: [
      { name: "Silverleaf Medicinal Fern", tags: ["organic", "forageable", "medicine", "fragile"], hp: 10 },
      { name: "Ironwood Nut Thicket", tags: ["organic", "forageable", "edible", "wood"], hp: 15 }
    ],
    geology: [
      { name: "Mossy Granite Boulder", tags: ["stone", "cover_heavy", "impassable"], hp: 80 },
      { name: "Fallen Hollow Oak", tags: ["wood", "shelter", "flammable", "container"], hp: 35 }
    ]
  },
  "Boreal Forest": {
    predators: [
      { name: "Ice-Mane Worg", affinity: "might", weapon: "Frost-Crusted Fangs", armor: "Dense Double Pelt", hp: 30 },
      { name: "Serrated Frost Lynx", affinity: "finesse", weapon: "Glass Claws", armor: "White Fur", hp: 22 }
    ],
    prey: [
      { name: "Northern Elk", affinity: "vitality", armor: "Thick Fur Pelt", hp: 24 },
      { name: "Snowshoe Hare", affinity: "reflex", armor: "Winter Pelt", hp: 8 }
    ],
    flora: [
      { name: "Pine-Sap Lichen Clump", tags: ["organic", "forageable", "adhesive", "flammable"], hp: 12 }
    ],
    geology: [
      { name: "Frost-Heaved Slate Ledge", tags: ["stone", "cover_light"], hp: 60 }
    ]
  },
  "Grassland": {
    predators: [
      { name: "Plains Stalker Hyena", affinity: "might", weapon: "Bone-Snapping Jaws", armor: "Scrub Pelt", hp: 26 },
      { name: "Steppe Hawk", affinity: "awareness", weapon: "Hooked Beak", armor: "Plumage", hp: 16 }
    ],
    prey: [
      { name: "Horned Steppe Buffalo", affinity: "endurance", armor: "Adamantine Horns & Hide", hp: 36 },
      { name: "Savanna Antelope", affinity: "reflex", armor: "Tawny Hide", hp: 16 }
    ],
    flora: [
      { name: "Golden Oat Grass Tussock", tags: ["organic", "forageable", "grain", "flammable"], hp: 8 }
    ],
    geology: [
      { name: "Sun-Baked Termite Mound", tags: ["earth", "cover_heavy"], hp: 45 }
    ]
  },
  "Savanna": {
    predators: [
      { name: "Scythe-Mane Lion", affinity: "might", weapon: "Crushing Claws", armor: "Golden Coat", hp: 36 },
      { name: "Coiled Rock Python", affinity: "finesse", weapon: "Constricting Rings", armor: "Scaled Sheath", hp: 24 }
    ],
    prey: [
      { name: "Striped Plains Equine", affinity: "reflex", armor: "Enduring Hide", hp: 22 },
      { name: "Basking Rock Hyrax", affinity: "awareness", armor: "Furry Hide", hp: 10 }
    ],
    flora: [
      { name: "Acacia Thorn Pod Bush", tags: ["organic", "forageable", "sharp", "medicine"], hp: 14 }
    ],
    geology: [
      { name: "Granite Kopje Spire", tags: ["stone", "cover_heavy", "impassable"], hp: 90 }
    ]
  },
  "Hot Desert": {
    predators: [
      { name: "Dune Scythe-Beetle", affinity: "might", weapon: "Mandible Shears", armor: "Chitinous Carapace", hp: 28 },
      { name: "Sun-Basking Viper", affinity: "finesse", weapon: "Neurotoxic Fangs", armor: "Dry Scales", hp: 18 }
    ],
    prey: [
      { name: "Two-Humped Desert Camelid", affinity: "endurance", armor: "Woolly Leather", hp: 28 },
      { name: "Spiny Sand Monitor", affinity: "reflex", armor: "Beaded Scales", hp: 12 }
    ],
    flora: [
      { name: "Water-Stashing Barrel Cactus", tags: ["organic", "forageable", "water", "sharp"], hp: 20 }
    ],
    geology: [
      { name: "Wind-Carved Sandstone Arch", tags: ["stone", "cover_heavy"], hp: 70 },
      { name: "Sun-Bleached Aurochs Skull", tags: ["bone", "ancient", "fragile"], hp: 15 }
    ]
  },
  "Cold Desert": {
    predators: [
      { name: "Gravel-Pelt Jackal", affinity: "reflex", weapon: "Snapping Teeth", armor: "Wiry Coat", hp: 22 }
    ],
    prey: [
      { name: "Plateau Wild Ass", affinity: "endurance", armor: "Tough Hide", hp: 22 }
    ],
    flora: [
      { name: "Bitter Saltbush Shrub", tags: ["organic", "forageable", "salt"], hp: 10 }
    ],
    geology: [
      { name: "Cracked Salt Pan Crust", tags: ["earth", "fragile"], hp: 30 }
    ]
  },
  "Tundra": {
    predators: [
      { name: "Polar Crag-Beast", affinity: "might", weapon: "Glacial Claws", armor: "Subcutaneous Blubber", hp: 42 },
      { name: "Frost-Wolf Stalker", affinity: "finesse", weapon: "Chilled Fangs", armor: "White Fur", hp: 24 }
    ],
    prey: [
      { name: "Woolly Musk-Ox", affinity: "endurance", armor: "Dense Wool & Horns", hp: 34 },
      { name: "Tundra Caribou", affinity: "reflex", armor: "Velvet Pelt", hp: 20 }
    ],
    flora: [
      { name: "Reindeer Moss Clump", tags: ["organic", "forageable", "edible"], hp: 8 }
    ],
    geology: [
      { name: "Permafrost Rime Mound", tags: ["earth", "frozen", "cover_light"], hp: 50 }
    ]
  },
  "Glacier": {
    predators: [
      { name: "Crevasse Prowler", affinity: "reflex", weapon: "Ice-Hook Claws", armor: "Frozen Carapace", hp: 36 }
    ],
    prey: [
      { name: "Blubber Seal", affinity: "vitality", armor: "Thick Blubber", hp: 26 }
    ],
    flora: [
      { name: "Crimson Snow Algae", tags: ["organic", "forageable", "reagent"], hp: 6 }
    ],
    geology: [
      { name: "Towering Blue Serac", tags: ["frozen", "ice", "cover_heavy", "impassable"], hp: 120 }
    ]
  },
  "Chaparral": {
    predators: [
      { name: "Crag Puma", affinity: "reflex", weapon: "Pouncing Claws", armor: "Tawny Coat", hp: 28 },
      { name: "Bristle Razorback Boar", affinity: "might", weapon: "Curved Tusks", armor: "Grizzled Hide", hp: 32 }
    ],
    prey: [
      { name: "Wild Scrub Ram", affinity: "endurance", armor: "Spiral Horns", hp: 22 },
      { name: "Brush Cottontail", affinity: "reflex", armor: "Light Fur", hp: 8 }
    ],
    flora: [
      { name: "Aromatic Sage Thicket", tags: ["organic", "forageable", "aromatics", "flammable"], hp: 12 }
    ],
    geology: [
      { name: "Limestone Escarpment", tags: ["stone", "cover_heavy"], hp: 75 }
    ]
  },
  "Woodland": {
    predators: [
      { name: "Red Fox Hunter", affinity: "finesse", weapon: "Quick Bite", armor: "Red Coat", hp: 18 },
      { name: "Wild Boar", affinity: "might", weapon: "Iron Tusks", armor: "Mud-Thick Pelt", hp: 28 }
    ],
    prey: [
      { name: "Roe Deer", affinity: "reflex", armor: "Dappled Hide", hp: 16 }
    ],
    flora: [
      { name: "Wild Blackberry Bramble", tags: ["organic", "forageable", "edible", "sharp"], hp: 14 }
    ],
    geology: [
      { name: "Moss-Covered Fieldstone", tags: ["stone", "cover_light"], hp: 50 }
    ]
  },
  "Tropical Forest": {
    predators: [
      { name: "Canopy Shadow-Panther", affinity: "finesse", weapon: "Razor Talons", armor: "Sleek Black Pelt", hp: 30 },
      { name: "River Dart-Serpent", affinity: "reflex", weapon: "Neurotoxic Bite", armor: "Vibrant Scales", hp: 18 }
    ],
    prey: [
      { name: "Emerald Tree-Stag", affinity: "reflex", armor: "Lichen-Covered Hide", hp: 20 },
      { name: "Crested Toucanet", affinity: "awareness", armor: "Feathers", hp: 8 }
    ],
    flora: [
      { name: "Orchid of Vitality", tags: ["organic", "forageable", "valuable", "reagent", "medicine"], hp: 10 }
    ],
    geology: [
      { name: "Overgrown Banyan Stilt-Roots", tags: ["wood", "shelter", "cover_heavy"], hp: 60 }
    ]
  },
  "Marine": {
    predators: [
      { name: "Tidal Reef-Shark", affinity: "might", weapon: "Rowed Serrations", armor: "Denticle Scales", hp: 34 }
    ],
    prey: [
      { name: "Giant Sea Turtle", affinity: "endurance", armor: "Heavy Scuted Shell", hp: 30 }
    ],
    flora: [
      { name: "Ribbon Kelp Canopy", tags: ["organic", "forageable", "edible", "fiber"], hp: 12 }
    ],
    geology: [
      { name: "Barnacle-Encrusted Reef Rock", tags: ["stone", "cover_heavy", "sharp"], hp: 85 }
    ]
  }
};

export class WhatElseStoryEngine {
  private currentActIndex = 0;
  private readonly ACTS = [
    { act: 1, title: "The Gathering Storm", theme: "Frontier Exploration & Ecological Equilibrium" },
    { act: 2, title: "Shadows of the Fulcrum", theme: "Underworld Enclaves & Cartel Web" },
    { act: 3, title: "The Midpoint Cataclysm", theme: "Continental Clashes & Ruin Awakenings" },
    { act: 4, title: "The Darkest Hour", theme: "Besieged Citadels & Shifting Empires" },
    { act: 5, title: "The Final Reckoning", theme: "Planetary Fate & Cosmological Convergence" }
  ];

  private activeBeat: StoryBeat | null = null;
  private completedBeats: StoryBeat[] = [];

  private readonly HUMAN_NAMES = [
    "Valeria", "Garrick", "Morwen", "Kaelen", "Bran", "Lysandra", "Doran",
    "Selene", "Torvold", "Elian", "Jareth", "Maren", "Corvin", "Rowan", "Fenrik",
    "Kallista", "Theron", "Mira", "Aldous", "Cedric", "Zephyr"
  ];

  private readonly TITLE_EPITHETS = [
    "the Far-Strider", "Iron-Foot", "the Pathfinder", "the Quiet", "of the Wilds",
    "the Vigilant", "the Swift", "Leaf-Catcher", "the Stern", "Wind-Walker"
  ];

  public getCampaignState() {
    return {
      currentAct: this.ACTS[this.currentActIndex] || this.ACTS[0],
      actIndex: this.currentActIndex + 1,
      totalActs: this.ACTS.length,
      activeBeat: this.activeBeat,
      completedBeatsCount: this.completedBeats.length
    };
  }

  public restoreCampaignState(state: any) {
    if (state?.actIndex !== undefined) {
      this.currentActIndex = Math.max(0, Math.min(this.ACTS.length - 1, (state.actIndex || 1) - 1));
    }
    if (state?.activeBeat) {
      this.activeBeat = state.activeBeat;
    }
    if (Array.isArray(state?.completedBeats)) {
      this.completedBeats = state.completedBeats;
    }
  }

  /**
   * Deterministically synthesizes an open, emergent StoryBeat based strictly on
   * real environmental conditions and living agents.
   */
  public generateBeatFromSector(context: SectorContext): StoryBeat {
    const rx = context.rx ?? 105;
    const ry = context.ry ?? 112;
    const seedVal = (context.cellId * 73856093) ^ (rx * 19349663) ^ (ry * 83492791);
    const rng = new SeededPRNG(seedVal);

    const bName = context.biomeName || "Temperate Forest";
    const ecology = BIOME_ECOLOGY_MATRIX[bName] || BIOME_ECOLOGY_MATRIX["Temperate Forest"]!;

    const beatId = `sector_beat_${context.cellId}_${rx}_${ry}`;
    const faction = context.factionOwner && context.factionOwner !== "Unclaimed" ? context.factionOwner : "Frontier Wilds";

    // Dynamic title based on actual terrain & sovereign status
    let title = `${bName} Sector (${rx}, ${ry})`;
    let hook = `You step into the open expanse of ${bName}. The terrain stretches out beneath shifting winds.`;

    if (context.isWarzone) {
      title = `Frontline Contested Reaches (${rx}, ${ry})`;
      hook = `Warzone borderlands. Signs of troop movements, scavenged provisions, and watchful eyes mark this contested boundary.`;
    } else if (context.isFamine) {
      title = `Lean Scrape of the Border (${rx}, ${ry})`;
      hook = `Famine has driven foragers and lean predators far from their typical haunts in search of scarce game.`;
    } else if (context.infrastructureMask & 2) {
      title = `The Imperial Reach (${rx}, ${ry})`;
      hook = `A well-trodden trade artery winds across this sector, periodically traversed by couriers, wayfarers, and armed caravans.`;
    } else if (context.infrastructureMask & 8 || context.infrastructureMask & 16) {
      title = `Forgotten Megaliths of Sector (${rx}, ${ry})`;
      hook = `Ancient weathered masonry and lichen-encrusted monoliths rise from the soil, remnants of an epoch preceding the current kingdoms.`;
    }

    // Emergent objectives: open exploration opportunities rather than mandatory linear checklists!
    const objectives: QuestObjective[] = [];

    // Objective 1: Environmental Survey / Exploration
    objectives.push({
      id: `obj_survey_${beatId}`,
      type: "EXPLORE_POI",
      description: `Survey Sector (${rx}, ${ry}) and uncover nearby landmarks or wildlife signs`,
      targetId: "poi_sector_expanse",
      requiredCount: 1,
      currentCount: 0,
      completed: false
    });

    // Objective 2: Interact with local landmark or resource if present
    if (context.infrastructureMask & (2 | 4 | 8 | 16)) {
      objectives.push({
        id: `obj_landmark_${beatId}`,
        type: "INTERACT_PROP",
        description: `Inspect or salvage the regional landmark identified in the sector`,
        targetId: "prop_regional_landmark",
        requiredCount: 1,
        currentCount: 0,
        completed: false
      });
    }

    // Objective 3: Ecology interaction (Hunting or Wildlife tracking)
    objectives.push({
      id: `obj_ecology_${beatId}`,
      type: "DEFEAT_NPC",
      description: `Track, hunt, or pacify wild fauna roaming the local habitat`,
      targetId: "npc_roaming_fauna",
      requiredCount: 1,
      currentCount: 0,
      completed: false
    });

    return {
      beatId,
      category: "WILDERNESS_SCOUT",
      title,
      hook,
      questGiver: {
        name: `${rng.pick(this.HUMAN_NAMES)} ${rng.pick(this.TITLE_EPITHETS)}`,
        role: "Regional Scout",
        faction
      },
      objectives,
      rewards: { xp: 120 + rng.range(0, 40), gold: 25 + rng.range(0, 20), item: getRandomWeaponForStat("might").name },
      reputationChanges: { [faction]: 10 },
      pivotDecision: "Having thoroughly explored the terrain, do you establish a secure bivouac, harvest local resources, or press outward into adjacent sectors?",
      variants: [
        { name: "Establish Bivouac", description: "Rest and fortify a campsite to replenish stamina and focus", preferredStat: "vitality" },
        { name: "Harvest & Forage", description: "Scour flora and game trails for provisions and crafting stock", preferredStat: "awareness" },
        { name: "Press the Frontier", description: "Map out the fastest path across regional boundaries", preferredStat: "endurance" }
      ]
    };
  }

  /**
   * PROCEDURALLY SYNTHESIZES GROUND-TRUTH PROPS & ENTITIES
   * ======================================================
   * Populates the 256x256 grid purely from:
   * 1. Simulated agents present (Predator, Prey, Patrol, Merchant, Smuggler)
   * 2. Biome ecology (native beasts, forageable herbs, geological features)
   * 3. Infrastructure mask (highways, smuggler routes, ruins, camps)
   */
  public injectWorldStateForBeat(beat: StoryBeat, context?: SectorContext): InjectedWorldState {
    this.activeBeat = beat;
    const props: TaggedObject[] = [];
    const npcs: InjectedNPC[] = [];

    const rx = context?.rx ?? 105;
    const ry = context?.ry ?? 112;
    const cellId = context?.cellId ?? 13408;
    const seedVal = (cellId * 73856093) ^ (rx * 19349663) ^ (ry * 83492791);
    const rng = new SeededPRNG(seedVal);

    const bName = context?.biomeName || "Temperate Forest";
    const ecology = BIOME_ECOLOGY_MATRIX[bName] || BIOME_ECOLOGY_MATRIX["Temperate Forest"]!;

    // Grid coordinates spread naturally across the 256x256 sector
    const centerPoint: [number, number] = [rng.range(120, 136), rng.range(120, 136)];
    const northGlade: [number, number] = [rng.range(50, 80), rng.range(45, 75)];
    const southMeadow: [number, number] = [rng.range(175, 205), rng.range(170, 200)];
    const westWaterway: [number, number] = [rng.range(45, 75), rng.range(160, 190)];
    const eastRidge: [number, number] = [rng.range(170, 205), rng.range(50, 80)];

    // -------------------------------------------------------------
    // 1. PROCEDURAL INFRASTRUCTURE & LANDMARK PROPS
    // -------------------------------------------------------------
    const mask = context?.infrastructureMask ?? 0;

    // Imperial Highway (mask & 2)
    if (mask & 2) {
      props.push(
        TagMatrixEngine.createProp("prop_milestone", "Imperial Highway Milestone", centerPoint, ["stone", "ancient", "heavy", "impassable"], 80),
        TagMatrixEngine.createProp("prop_wayfarer_hearth", "Roadside Stone Fire Hearth", [centerPoint[0] + 3, centerPoint[1] - 2], ["fire", "stone", "warmth", "rest"], 20),
        TagMatrixEngine.createProp("prop_abandoned_cart", "Weathered Trade Wagon", [centerPoint[0] - 4, centerPoint[1] + 3], ["wood", "container", "openable", "cover_heavy"], 40)
      );
    }

    // Smuggler Route (mask & 4)
    if (mask & 4) {
      props.push(
        TagMatrixEngine.createProp("prop_smuggler_cache", "Concealed Hollowed Root Cache", westWaterway, ["wood", "locked", "valuable", "container", "openable"], 25),
        TagMatrixEngine.createProp("prop_cairn_marker", "Discreet Stone Marker Cairn", [westWaterway[0] + 2, westWaterway[1] + 1], ["stone", "hidden", "cover_light"], 15)
      );
    }

    // Ancient Ruins or Temple Megaliths (mask & 8 or 16)
    if (mask & 8 || mask & 16) {
      props.push(
        TagMatrixEngine.createProp("prop_ruin_monolith", "Overgrown Runic Wardstone", northGlade, ["stone", "magic", "ancient", "heavy"], 100),
        TagMatrixEngine.createProp("prop_stone_sarcophagus", "Weathered Stone Sarcophagus", [northGlade[0] + 3, northGlade[1] + 2], ["stone", "container", "locked", "ancient", "openable"], 60),
        TagMatrixEngine.createProp("prop_fallen_pillar", "Moss-Covered Fluted Column", [northGlade[0] - 3, northGlade[1] - 1], ["stone", "cover_heavy", "impassable"], 75)
      );
    }

    // Warzone Remnants (mask & 128 or isWarzone)
    if ((mask & 128) || context?.isWarzone) {
      props.push(
        TagMatrixEngine.createProp("prop_war_barricade", "Reinforced Timber Barricade", eastRidge, ["wood", "cover_heavy", "destructible", "flammable"], 45),
        TagMatrixEngine.createProp("prop_munitions_crate", "Scavenged Munitions Footlocker", [eastRidge[0] + 2, eastRidge[1] - 2], ["metal", "locked", "valuable", "container", "openable"], 30)
      );
    }

    // Famine / Macabre Camp (mask & 32 or isFamine)
    if ((mask & 32) || context?.isFamine) {
      props.push(
        TagMatrixEngine.createProp("prop_ration_barrel", "Ransacked Provision Barrel", southMeadow, ["wood", "container", "openable", "fragile"], 15),
        TagMatrixEngine.createProp("prop_smoldering_spit", "Smoldering Camp Hearth", [southMeadow[0] - 2, southMeadow[1] + 2], ["fire", "hot", "hazard", "rest"], 20)
      );
    }

    // Natural Wilderness Flora & Geology (Always dynamically added based on biome)
    const floraDef = rng.pick(ecology.flora);
    if (floraDef) {
      props.push(
        TagMatrixEngine.createProp("prop_natural_flora", floraDef.name, [southMeadow[0] + 4, southMeadow[1] - 3], floraDef.tags, floraDef.hp)
      );
    }

    const geoDef = rng.pick(ecology.geology);
    if (geoDef) {
      props.push(
        TagMatrixEngine.createProp("prop_natural_formation", geoDef.name, [westWaterway[0] - 2, westWaterway[1] + 3], geoDef.tags, geoDef.hp)
      );
    }

    // -------------------------------------------------------------
    // 2. PROCEDURAL LIVING ENTITIES (FAUNA, TRAVELERS, UNDERWORLD)
    // -------------------------------------------------------------
    const rawAgents = context?.entitiesPresent || [];

    // Synthesize entities from live simulation agents
    if (rawAgents.length > 0) {
      rawAgents.forEach((agent, i) => {
        const offset: [number, number] = [
          Math.min(240, Math.max(15, centerPoint[0] + (i * 20 - 30))),
          Math.min(240, Math.max(15, centerPoint[1] + (i * 15 - 25)))
        ];

        if (agent.type === "Predator") {
          const pDef = rng.pick(ecology.predators);
          npcs.push({
            id: `npc_predator_${i}`,
            name: pDef.name,
            role: "Apex Predator",
            pos: offset,
            tags: ["beast", "predator", "hostile", "organic", "leather_hide", "sharp"],
            faction: "Wilderness",
            hp: pDef.hp,
            maxHp: pDef.hp,
            disposition: -2,
            alive: true,
            equippedWeapon: pDef.weapon,
            equippedArmor: pDef.armor,
            statAffinity: pDef.affinity,
            stats: { might: 7, reflex: 6, vitality: 6, endurance: 5, awareness: 5 }
          });
        } else if (agent.type === "Prey") {
          const pDef = rng.pick(ecology.prey);
          npcs.push({
            id: `npc_prey_${i}`,
            name: pDef.name,
            role: "Wild Fauna",
            pos: offset,
            tags: ["beast", "prey", "neutral", "organic", "edible_meat", "leather_hide", "skittish"],
            faction: "Wilderness",
            hp: pDef.hp,
            maxHp: pDef.hp,
            disposition: 0,
            alive: true,
            equippedWeapon: "Natural Flurry",
            equippedArmor: pDef.armor,
            statAffinity: pDef.affinity,
            stats: { reflex: 7, awareness: 7, vitality: 5, endurance: 4 }
          });
        } else if (agent.type === "Merchant") {
          npcs.push({
            id: `npc_merchant_${i}`,
            name: `${rng.pick(this.HUMAN_NAMES)} the Caravaner`,
            role: "Traveling Peddler",
            pos: offset,
            tags: ["civilian", "merchant", "talkative", "bribeable", "tradeable", "organic"],
            faction: context?.factionOwner || "Free Traders Guild",
            hp: 16,
            maxHp: 16,
            disposition: 1,
            alive: true,
            equippedWeapon: "Walking Quarterstaff",
            equippedArmor: "Padded Traveling Gambeson",
            statAffinity: "charm",
            stats: { charm: 7, logic: 6, knowledge: 5, intuition: 5, reflex: 4 }
          });
        } else if (agent.type === "Patrol") {
          npcs.push({
            id: `npc_patrol_${i}`,
            name: `${rng.pick(this.HUMAN_NAMES)} the Scout`,
            role: "Border Sentry",
            pos: offset,
            tags: ["soldier", "patrol", "disciplined", "alert", "organic"],
            faction: context?.factionOwner || "Frontier Guard",
            hp: 24,
            maxHp: 24,
            disposition: 0,
            alive: true,
            equippedWeapon: "Tempered Arming Sword",
            equippedArmor: "Riveted Chainmail",
            statAffinity: "might",
            stats: { might: 6, endurance: 6, reflex: 5, awareness: 6 }
          });
        } else if (agent.type === "Smuggler" || agent.type === "Bandit") {
          npcs.push({
            id: `npc_outlaw_${i}`,
            name: `${rng.pick(this.HUMAN_NAMES)} Shadow-Foot`,
            role: "Highway Skirmisher",
            pos: offset,
            tags: ["outlaw", "hostile", "subterfuge", "bribeable", "organic"],
            faction: "Fulcrum Smuggler Ring",
            hp: 20,
            maxHp: 20,
            disposition: -1,
            alive: true,
            equippedWeapon: "Notched Stiletto",
            equippedArmor: "Hardened Leather Jerkin",
            statAffinity: "finesse",
            stats: { finesse: 7, reflex: 6, awareness: 5, charm: 4 }
          });
        } else if (agent.type === "Cannibal") {
          npcs.push({
            id: `npc_cannibal_${i}`,
            name: "Starving Marauder",
            role: "Famine Outlaw",
            pos: offset,
            tags: ["cannibal", "hostile", "desperate", "feral", "organic"],
            faction: "Rot-Tooth Cannibals",
            hp: 18,
            maxHp: 18,
            disposition: -2,
            alive: true,
            equippedWeapon: "Bone Cleaver",
            equippedArmor: "Torn Hide Scraps",
            statAffinity: "might",
            stats: { might: 6, reflex: 5, vitality: 4 }
          });
        }
      });
    }

    // If no agents were present, organically seed 1-2 native creatures for a living environment
    if (npcs.length === 0) {
      const pPrey = rng.pick(ecology.prey);
      npcs.push({
        id: "npc_prey_wild",
        name: pPrey.name,
        role: "Wild Game",
        pos: southMeadow,
        tags: ["beast", "prey", "neutral", "organic", "edible_meat", "leather_hide", "skittish"],
        faction: "Wilderness",
        hp: pPrey.hp,
        maxHp: pPrey.hp,
        disposition: 0,
        alive: true,
        equippedWeapon: "Natural Flurry",
        equippedArmor: pPrey.armor,
        statAffinity: pPrey.affinity,
        stats: { reflex: 6, awareness: 6, vitality: 5 }
      });

      // 50% chance of a local predator in wilderness
      if (rng.next() < 0.5) {
        const pPred = rng.pick(ecology.predators);
        npcs.push({
          id: "npc_predator_wild",
          name: pPred.name,
          role: "Roaming Predator",
          pos: northGlade,
          tags: ["beast", "predator", "hostile", "organic", "leather_hide", "sharp"],
          faction: "Wilderness",
          hp: pPred.hp,
          maxHp: pPred.hp,
          disposition: -2,
          alive: true,
          equippedWeapon: pPred.weapon,
          equippedArmor: pPred.armor,
          statAffinity: pPred.affinity,
          stats: { might: 6, reflex: 6, vitality: 5 }
        });
      }
    }

    // Ensure all spawned NPCs have full 12 stats fallback
    npcs.forEach(npc => {
      const baseStats: Record<StatKey, number> = {
        might: 4, endurance: 4, finesse: 4, reflex: 4, vitality: 4, fortitude: 4,
        knowledge: 4, logic: 4, awareness: 4, intuition: 4, charm: 4, willpower: 4
      };
      if (npc.stats) {
        Object.assign(baseStats, npc.stats);
      }
      npc.stats = baseStats;
    });

    return { props, npcs, activeBeat: beat };
  }

  /**
   * Tracks objective completions without artificial railroading.
   */
  public updateObjective(targetId: string, amount: number = 1): { beatCompleted: boolean; updatedObjective?: QuestObjective | undefined } {
    if (!this.activeBeat) return { beatCompleted: false };

    let updatedObjective: QuestObjective | undefined;

    for (const obj of this.activeBeat.objectives) {
      if (!obj.completed && (obj.targetId === targetId || targetId.includes(obj.type.toLowerCase()))) {
        obj.currentCount += amount;
        if (obj.currentCount >= obj.requiredCount) {
          obj.completed = true;
        }
        updatedObjective = obj;
        break;
      }
    }

    const allDone = this.activeBeat.objectives.every(o => o.completed);
    if (allDone) {
      this.completedBeats.push(this.activeBeat);
      if (this.completedBeats.length % 3 === 0 && this.currentActIndex < this.ACTS.length - 1) {
        this.currentActIndex++;
      }
    }

    return {
      beatCompleted: allDone,
      updatedObjective
    };
  }
}
