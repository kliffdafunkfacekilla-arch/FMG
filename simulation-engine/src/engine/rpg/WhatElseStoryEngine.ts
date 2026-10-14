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
import { ProceduralNPCGenerator } from "./ProceduralNPCGenerator.js";

export interface QuestObjective {
  id: string;
  type: "DESTROY_PROP" | "DEFEAT_NPC" | "INTERACT_PROP" | "CONVINCE_NPC" | "EXPLORE_POI" | "TALK_NPC";
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
  | "CHAOS_CORRUPTION"
  | "URBAN_CIVIC";

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
  kingdom?: string;
  species?: string;
  lineage?: string;
  inventory?: string[];
  memoryNotes?: string[];
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
  elevation?: number;
  vegetationDensity?: number;
  factionOwner?: string;
  crimeRate?: number | string;
  baseTerrain?: number;
  burg?: {
    burg_id: number;
    name: string;
    urban_tier?: number;
    food?: number;
    wealth?: number;
    unrest?: number;
    crime_rate?: number;
  } | null;
  entitiesPresent?: Array<{ type: string; state: string; story_hook: string }>;
  activeFlow?: string;
  dragonDomain?: string;
  moonPhase?: string;
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

export interface BiomeEcology {
  predators: Array<{ name: string; affinity: StatKey; weapon: string; armor: string; hp: number }>;
  prey: Array<{ name: string; affinity: StatKey; armor: string; hp: number }>;
  flora: Array<{ name: string; tags: string[]; hp: number }>;
  geology: Array<{ name: string; tags: string[]; hp: number }>;
}

export const BIOME_ECOLOGY_MATRIX: Record<string, BiomeEcology> = {
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

export interface DragonPrisonInfo {
  cellId: number;
  dragon: string;
  domain: string;
  omen: string;
  title: string;
}

export const DRAGON_PRISONS: Record<number, DragonPrisonInfo> = {
  15220: { cellId: 15220, dragon: "Tiraton", domain: "Mass", omen: "Crushing gravity and tectonic basalt tremors", title: "Obsidian Barrow of Tiraton" },
  7841: { cellId: 7841, dragon: "Carulkem", domain: "Nexus", omen: "Spatial rifts and shimmering mirror mirages", title: "Void Vault of Carulkem" },
  2813: { cellId: 2813, dragon: "Stagus", domain: "Ordo", omen: "Glacial stasis frost and unyielding crystalline wards", title: "Stasis Barrow of Stagus" },
  24725: { cellId: 24725, dragon: "Tyrustis", domain: "Lex", omen: "Blood runes and unbreakable iron oaths", title: "Iron Sepulcher of Tyrustis" },
  18789: { cellId: 18789, dragon: "Vecelo", domain: "Motus", omen: "Howling kinetic squalls and atmospheric tremors", title: "Gale Spires of Vecelo" },
  3517: { cellId: 3517, dragon: "Aurgenas", domain: "Flux", omen: "Volatile alchemical fumes and chimeric mutations", title: "Chimeric Crucible of Aurgenas" },
  8171: { cellId: 8171, dragon: "Gavusrix", domain: "Vita", omen: "Carnivorous roots and primeval blood-surges", title: "Primeval Glade of Gavusrix" },
  29867: { cellId: 29867, dragon: "Metrion", domain: "Ratio", omen: "Clockwork grinding and rhythmic geometric hums", title: "Brass Labyrinth of Metrion" },
  3442: { cellId: 3442, dragon: "Opecten", domain: "Lux", omen: "Blinding phosphor embers and celestial scorch marks", title: "Solar Spire of Opecten" },
  32850: { cellId: 32850, dragon: "Termhill", domain: "Omen", omen: "Astral eclipse shadows and creeping augury whispers", title: "Eclipse Crypt of Termhill" },
  24460: { cellId: 24460, dragon: "Virantor", domain: "Aura", omen: "Phantasmagoric violet mists and psychic hallucinations", title: "Mirage Sanctum of Virantor" },
  22336: { cellId: 22336, dragon: "Lophex", domain: "Anumis", omen: "Necrotic soul ash and cold whispers of the restless dead", title: "Necrotic Barrow of Lophex" }
};

export interface EmergentRelicDef {
  name: string;
  propId: string;
  tags: string[];
  hp: number;
  description: string;
  archetype: string;
  material: string;
  flowAffliction: string;
}

export type PostApocalypticRuinDef = EmergentRelicDef;

export const RELIC_ARCHETYPES = [
  {
    key: "vault_bunker",
    name: "Vault Bunker",
    baseTags: ["metal", "container", "locked", "shelter", "openable", "ancient"],
    baseHp: 180,
    desc: "A reinforced blast-vault hatch stamped with pre-Cruor imperial ciphers"
  },
  {
    key: "sky_galleon",
    name: "Sky-Galleon Hull",
    baseTags: ["wood", "metal", "container", "valuable", "openable", "ancient", "shelter"],
    baseHp: 140,
    desc: "The shattered keel of an aether-clipper with rusted brass propellers"
  },
  {
    key: "colossus_sentinel",
    name: "Colossus Sentinel",
    baseTags: ["metal", "heavy", "container", "crafting", "ancient"],
    baseHp: 200,
    desc: "A twenty-foot clockwork automaton chassis slumped against the bedrock"
  },
  {
    key: "aether_aqueduct",
    name: "Aether-Aqueduct Span",
    baseTags: ["stone", "ancient", "climbable", "cover_heavy", "aether"],
    baseHp: 150,
    desc: "Cyclopean masonry arches that once channeled airborne ley-streams"
  },
  {
    key: "titan_ribcage",
    name: "Titan Ribcage Arch",
    baseTags: ["bone", "ancient", "cover_heavy", "shelter", "heavy"],
    baseHp: 160,
    desc: "Petrified fossilized rib bones of an elder celestial beast arching like cathedral vaults"
  },
  {
    key: "leyline_obelisk",
    name: "Leyline Obelisk",
    baseTags: ["stone", "magic", "runic", "ancient", "wardstone"],
    baseHp: 120,
    desc: "A toppled crystalline needle still humming with residual planetary harmonics"
  },
  {
    key: "fulgurite_crater",
    name: "Fulgurite Glass Crater",
    baseTags: ["glass", "earth", "magic", "hazard", "crystal"],
    baseHp: 100,
    desc: "A vitreous emerald basin fused by celestial lightning during the Fall"
  },
  {
    key: "subterranean_cistern",
    name: "Subterranean Cistern",
    baseTags: ["stone", "water", "container", "shelter", "openable"],
    baseHp: 140,
    desc: "A deep sunken reservoir lined with waterproof elder tiles"
  },
  {
    key: "megalithic_sarcophagus",
    name: "Megalithic Sarcophagus",
    baseTags: ["stone", "ancient", "container", "locked", "heavy"],
    baseHp: 170,
    desc: "A colossal sealed burial cist bearing the funerary seals of the First Age"
  },
  {
    key: "subterranean_depot",
    name: "Root Depot",
    baseTags: ["wood", "metal", "container", "secret", "lootable", "openable"],
    baseHp: 110,
    desc: "A concealed subterranean bunker cached beneath hollow roots"
  }
];

export const RELIC_MATERIALS = [
  {
    key: "adamantine",
    name: "Adamantine",
    tags: ["adamantine", "metal", "unyielding"],
    hpMod: 50,
    desc: "forged from star-forged black adamantine impervious to common rust"
  },
  {
    key: "cold_titanium",
    name: "Cold Titanium",
    tags: ["titanium", "metal"],
    hpMod: 30,
    desc: "sheathed in pale, frost-resistant imperial titanium plates"
  },
  {
    key: "osmium",
    name: "Osmium-Plated",
    tags: ["osmium", "metal", "heavy"],
    hpMod: 40,
    desc: "weighted with dense, bluish-grey osmium ballast plates"
  },
  {
    key: "basalt",
    name: "Fluted Basalt",
    tags: ["stone", "basalt"],
    hpMod: 20,
    desc: "carved from volcanic basalt pillars bearing fine geometric fluting"
  },
  {
    key: "granite",
    name: "Granite",
    tags: ["stone", "granite"],
    hpMod: 10,
    desc: "hewn from coarse-grained granite furrowed by centuries of storm"
  },
  {
    key: "bog_oak",
    name: "Iron-Banded Bog Oak",
    tags: ["wood", "dense_wood", "flammable"],
    hpMod: -10,
    desc: "timbered with petrified dark oak banded in rusted iron straps"
  },
  {
    key: "ivory",
    name: "Fossilized Ivory",
    tags: ["bone", "ivory", "ancient"],
    hpMod: 15,
    desc: "sculpted from gleaming petrified tusk-stone and elder marrow"
  }
];

export const RELIC_FLOW_AFFLICTIONS: Record<string, { prefix: string; tags: string[]; desc: string }> = {
  Mass: { prefix: "Tectonic-Crushed", tags: ["mass", "tectonic", "crushed"], desc: "buckled and compressed under unnatural gravitational torque" },
  Nexus: { prefix: "Spatial-Phased", tags: ["nexus", "spatial", "ethereal"], desc: "flickering between spatial dimensions with shimmering refraction" },
  Ordo: { prefix: "Stasis-Frosted", tags: ["ordo", "stasis", "crystalline"], desc: "encrusted with unmelting geometric frost and rigid crystalline wards" },
  Lex: { prefix: "Blood-Bound", tags: ["lex", "blood_magic", "sealed"], desc: "inscribed with crimson iron runes that pulse with ancestral blood oaths" },
  Motus: { prefix: "Gale-Battered", tags: ["motus", "wind", "weathered"], desc: "singing with eerie wind-whistles under ceaseless kinetic eddies" },
  Flux: { prefix: "Biomantic-Mutated", tags: ["flux", "mutated", "alchemical"], desc: "fused with pulsating alchemical growths and iridescent chimeric lichen" },
  Vita: { prefix: "Vine-Strangled", tags: ["vita", "verdant", "organic"], desc: "choked in grasping carnivorous vines and primeval root tendrils" },
  Ratio: { prefix: "Clockwork-Resonant", tags: ["ratio", "clockwork", "mechanical"], desc: "clicking with subterranean escapements and brass gear resonance" },
  Lux: { prefix: "Phosphor-Scorched", tags: ["lux", "radiant", "scorched"], desc: "glowing with residual celestial embers and blinding heat ripples" },
  Omen: { prefix: "Eclipse-Veiled", tags: ["omen", "shadow", "occult"], desc: "shrouded in creeping penumbral shadows that drink all lantern light" },
  Aura: { prefix: "Mirage-Hazed", tags: ["aura", "psychic", "illusion"], desc: "swathed in psychic lavender haze that triggers sensory echoes" },
  Anumis: { prefix: "Necrotic-Encrusted", tags: ["anumis", "necrotic", "spirit"], desc: "dusted with cold soul-ash and whispering with echoes of the fallen" }
};

export function synthesizeEmergentRelic(
  rng: SeededPRNG,
  biome: string,
  activeFlow?: string,
  elevation: number = 0.5,
  mask: number = 0
): EmergentRelicDef {
  let archetypeIndex = rng.range(0, RELIC_ARCHETYPES.length - 1);
  if (mask & 8 || mask & 16) {
    archetypeIndex = rng.pick([0, 3, 5, 8]);
  } else if (elevation > 0.65) {
    archetypeIndex = rng.pick([1, 2, 4, 5]);
  } else if (elevation < 0.28) {
    archetypeIndex = rng.pick([6, 7, 9]);
  }
  const arch = RELIC_ARCHETYPES[archetypeIndex]!;
  const mat = rng.pick(RELIC_MATERIALS);

  const flowKey = activeFlow && RELIC_FLOW_AFFLICTIONS[activeFlow] ? activeFlow : rng.pick(Object.keys(RELIC_FLOW_AFFLICTIONS));
  const affliction = RELIC_FLOW_AFFLICTIONS[flowKey] || RELIC_FLOW_AFFLICTIONS["Ordo"]!;

  const name = `${affliction.prefix} ${mat.name} ${arch.name}`;
  const propId = `prop_relic_${arch.key}_${mat.key}_${flowKey.toLowerCase()}`;
  const allTags = Array.from(new Set([...arch.baseTags, ...mat.tags, ...affliction.tags]));
  const hp = Math.max(40, arch.baseHp + mat.hpMod);
  const description = `${arch.desc}, ${mat.desc}, and ${affliction.desc}.`;

  return {
    name,
    propId,
    tags: allTags,
    hp,
    description,
    archetype: arch.name,
    material: mat.name,
    flowAffliction: affliction.prefix
  };
}

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
    const beatId = `sector_beat_${context.cellId}_${rx}_${ry}`;
    const faction = context.factionOwner && context.factionOwner !== "Unclaimed" ? context.factionOwner : "Frontier Wilds";

    const isUrban = !!(context.burg || context.baseTerrain === 4 || (context.infrastructureMask & 64));
    const burgName = context.burg?.name || "Provincial Settlement";

    const elevation = context.elevation ?? 0.5;
    const vegDensity = context.vegetationDensity ?? 0.5;
    const chaos = context.chaosRadiation ?? 0;
    const mask = context.infrastructureMask ?? 0;
    const crime = typeof context.crimeRate === "number" ? context.crimeRate : Number(context.crimeRate) || 0;
    const rawAgents = context.entitiesPresent || [];
    const agentTypes = new Set(rawAgents.map(a => a.type));

    const activeFlow = context.activeFlow || "Ordo";
    const moonPhase = context.moonPhase || "Gibbous";
    const dragonDomain = context.dragonDomain || "Stagus";

    // Dynamic Emergent Relic for the sector (840+ dynamic architectural combinations)
    const emergentRelic = synthesizeEmergentRelic(rng, bName, activeFlow, elevation, mask);

    let title = `${bName} Sector (${rx}, ${ry})`;
    let hook = `You step into the open expanse of ${bName}. The terrain stretches out beneath shifting winds and the pale light of Cruorbus (${activeFlow} alignment).`;
    let questCategory: StoryBeatCategory = "WILDERNESS_SCOUT";
    let questGiver = {
      name: `${rng.pick(this.HUMAN_NAMES)} ${rng.pick(this.TITLE_EPITHETS)}`,
      role: "Regional Scout",
      faction
    };

    let pivotDecision = "Having assessed the immediate terrain, do you secure a bivouac, harvest local resources, or press outward into adjacent sectors?";
    let variants = [
      { name: "Establish Bivouac", description: "Rest and fortify a campsite to replenish stamina and focus", preferredStat: "vitality" },
      { name: "Harvest & Forage", description: "Scour flora and game trails for provisions and crafting stock", preferredStat: "awareness" },
      { name: "Press the Frontier", description: "Map out the fastest path across regional boundaries", preferredStat: "endurance" }
    ];

    // 0. DRAGON PRISON & COSMIC CHAOS VIGIL
    const dragonPrison = DRAGON_PRISONS[context.cellId];
    if (dragonPrison) {
      title = `${dragonPrison.title} (${rx}, ${ry})`;
      hook = `Beneath the baleful crimson light of Cruorbus rises the ${dragonPrison.title}. The sealed barrow of the Chaos Dragon ${dragonPrison.dragon} throbs with the Flow of ${dragonPrison.domain} (${dragonPrison.omen}). Secretive Grey Wardens in slate wool cloaks stand vigil with cold titanium spears, battling crazed cultists seeking to shatter the seals with blood sacrifice!`;
      questCategory = "CHAOS_CORRUPTION";
      questGiver = {
        name: "Warden Alistair",
        role: "Grey Warden Vigil",
        faction: "Wardens of the Core"
      };
      pivotDecision = `The seal of ${dragonPrison.dragon} trembles under cosmic tension. Do you aid the Grey Wardens to hold the line, purge the blood-cultists, or inspect the ancient titanium wards?`;
      variants = [
        { name: "Stand Vigil with Grey Wardens", description: "Form a spear wall alongside the Grey Wardens to repel the fanatical cultists", preferredStat: "might" },
        { name: "Stabilize Dragon Wards", description: "Realign the cold titanium ward-anchors to dampen the dragon's psychic emanations", preferredStat: "knowledge" },
        { name: "Disrupt Blood Sacrifice", description: "Intervene to sever the obsidian ritual daggers before sacrificial blood touches the altar", preferredStat: "finesse" },
        { name: "Attune to the Flow", description: `Attune your senses to the Flow of ${dragonPrison.domain} to predict where the seal will buckle`, preferredStat: "intuition" }
      ];

    // 1. URBAN CIVIC BEAT
    } else if (isUrban) {
      title = `${burgName} Town Center (${rx}, ${ry})`;
      hook = `Cobblestone thoroughfares, timber-framed facades, and the rhythmic clang of the smith's anvil mark ${burgName}. Townsfolk and caravaners mingle around the square and public notice boards.`;
      questCategory = "URBAN_CIVIC";
      questGiver = {
        name: "Reeve Thorne",
        role: "Municipal Reeve",
        faction: context.factionOwner && context.factionOwner !== "Unclaimed" ? context.factionOwner : "The Realm"
      };
      pivotDecision = `Within the gates of ${burgName}, do you rest at the tavern hearth, contract for civic bounties, or trade your forage with the guild?`;
      variants = [
        { name: "Patronize the Tavern", description: "Drink, rest by the hearthfire, and gather travelers' rumors", preferredStat: "vitality" },
        { name: "Take Up Municipal Bounties", description: "Accept civic contracts from the Reeve's Notice Board", preferredStat: "logic" },
        { name: "Barter with the Guild", description: "Trade wild herbs and pelts for refined tools and rations", preferredStat: "charm" }
      ];

    // 2. DYNAMIC MULTI-VECTOR PRESSURE COLLISION MATRIX (PURE EMERGENT SIMULATION)
    } else {
      const famineScore = (context.isFamine ? 50 : 0) + ((mask & 32) ? 30 : 0) + (agentTypes.has("Cannibal") ? 40 : 0) + (((context.burg?.food || 200) < 100) ? 35 : 0);
      const warzoneScore = (context.isWarzone ? 55 : 0) + ((mask & 128) ? 40 : 0) + ((agentTypes.has("Patrol") && (agentTypes.has("Bandit") || agentTypes.has("Smuggler"))) ? 35 : 0) + (((context.burg?.unrest || 0) > 50) ? 25 : 0);
      const crimeScore = (crime > 25 ? 45 : 0) + ((mask & 4) ? 35 : 0) + (agentTypes.has("Smuggler") ? 30 : 0) + (agentTypes.has("Bandit") ? 30 : 0);
      const chaosScore = Math.floor(chaos * 100) + (agentTypes.has("Cultist") ? 45 : 0) + (activeFlow !== "Ordo" ? 15 : 0);
      const trophicScore = (agentTypes.has("Predator") && agentTypes.has("Prey")) ? 65 : (agentTypes.has("Predator") ? 35 : 0);
      const tradeScore = ((mask & 2) ? 45 : 0) + (agentTypes.has("Merchant") ? 40 : 0);
      const ruinScore = ((mask & 8 || mask & 16) ? 55 : 25);
      const altitudeScore = elevation > 0.65 ? 50 : (elevation < 0.28 ? 45 : 0);

      const vectors = [
        { type: "WARZONE", score: warzoneScore },
        { type: "FAMINE", score: famineScore },
        { type: "CRIME", score: crimeScore },
        { type: "CHAOS", score: chaosScore },
        { type: "TROPHIC", score: trophicScore },
        { type: "TRADE", score: tradeScore },
        { type: "ALTITUDE", score: altitudeScore },
        { type: "RUIN", score: ruinScore }
      ].sort((a, b) => b.score - a.score);

      const primary = vectors[0]!;
      const secondary = vectors[1] || { type: "NONE", score: 0 };

      if (primary.type === "WARZONE" && primary.score >= 35) {
        questCategory = "WARZONE_ASSAULT";
        questGiver = { name: "Vanguard Veteran", role: "Frontline Skirmisher", faction: context.factionOwner || "Frontline Legion" };
        if (secondary.type === "FAMINE" && secondary.score >= 25) {
          title = `Besieged Vanguard Trenches (${rx}, ${ry})`;
          hook = `Shattered faction palisades and smoking supply wagons sit half-buried in mud. Starving skirmishers and deserters search the battlefield near the ${emergentRelic.name} for grain and military salvage under circling carrion kites.`;
          pivotDecision = `The battlefield is on the verge of starvation riot. Do you share rations to broker calm, breach the barricaded ammunition wagon, or scavenge arms?`;
          variants = [
            { name: "Distribute Field Rations", description: "Soothe military desperation by sharing rations to gain skirmisher trust", preferredStat: "vitality" },
            { name: "Breach Ammunition Wagon", description: "Force open a reinforced supply lockbox using brute strength", preferredStat: "might" },
            { name: "Scavenge Battlefield Steel", description: "Search shattered redoubts for usable blades and intact military plates", preferredStat: "awareness" },
            { name: "Negotiate Ceasefire", description: "Use diplomatic rhetoric to convince starving deserters to lower their weapons", preferredStat: "charm" }
          ];
        } else if (secondary.type === "CRIME" && secondary.score >= 25) {
          title = `Contested Vanguard Standoff (${rx}, ${ry})`;
          hook = `Armed border sentries have encircled a concealed ravine, trading crossbow bolts with bold cartel looters raiding fallen vanguard supply caches near the ${emergentRelic.name}.`;
          pivotDecision = `The confrontation hangs on a knife's edge. Do you assault the looters, parley with the outlaws, or slip through the cordon?`;
          variants = [
            { name: "Support Frontline Sentries", description: "Charge alongside the border patrol to overwhelm the outlaw line", preferredStat: "might" },
            { name: "Bribe Outlaw Enforcers", description: "Exploit the cartel's greed with silver to buy safe passage and stolen intel", preferredStat: "charm" },
            { name: "Infiltrate the Crossfire", description: "Use terrain shadows and brush to slip past the combatants unnoticed", preferredStat: "finesse" },
            { name: "Deduce Weak Points", description: "Analyze the skirmish formations to pinpoint where the defenses will collapse", preferredStat: "logic" }
          ];
        } else {
          title = `Scorched Vanguard Marches (${rx}, ${ry})`;
          hook = `Charred breastworks, iron caltrops, and vigilant forward sentries mark an active faction frontline. Blood-stained earth and the looming ${emergentRelic.name} warn of immediate hostility.`;
          pivotDecision = `Active warfare surrounds you. Do you fortify defensive barricades, scout enemy vanguard redoubts, or scavenge military munitions?`;
          variants = [
            { name: "Fortify Barricades", description: "Hew timber and heave stone to reinforce defensive earthworks", preferredStat: "might" },
            { name: "Decipher Troop Dispatches", description: "Analyze discarded faction marching orders to deduce strategic intent", preferredStat: "logic" },
            { name: "Scout Forward Redoubts", description: "Survey trench networks and perimeter lookouts from concealment", preferredStat: "awareness" },
            { name: "Mend Wounded Skirmishers", description: "Apply emergency field dressings to injured frontline infantry", preferredStat: "vitality" }
          ];
        }

      } else if (primary.type === "FAMINE" && primary.score >= 30) {
        questCategory = "FOOD_CRISIS";
        questGiver = { name: "Lean Wayfarer", role: "Famine Forager", faction: "Frontier Wilds" };
        if (secondary.type === "CRIME" && secondary.score >= 25) {
          title = `Outlaw-Prowled Desolation (${rx}, ${ry})`;
          hook = `Severe famine has scoured this province. Desperate outlaws and raiders scour the scrub, clashing with starving refugees near the ${emergentRelic.name} over stripped tubers and dried bone.`;
          pivotDecision = `Hunger breeds brutal violence. Do you protect the foragers, intimidate the bandits, or track resilient edible roots?`;
          variants = [
            { name: "Shield the Foragers", description: "Draw steel and place yourself between desperate bandits and starving wanderers", preferredStat: "might" },
            { name: "Excavate Deep Roots", description: "Search rock clefts for drought-resistant tubers and hidden caches", preferredStat: "awareness" },
            { name: "Intimidate the Desperate", description: "Display martial authority and stern resolve to disperse raiders without bloodshed", preferredStat: "charm" },
            { name: "Brew Sustaining Broth", description: "Prepare hot medicinal broth from foraged bark to soothe dying wanderers", preferredStat: "vitality" }
          ];
        } else {
          title = `Blighted Verge of Desperation (${rx}, ${ry})`;
          hook = `Crippling food shortages have scoured this reach. Stripped bark, cold hearths, and circles of carrion vultures mark a desperate struggle for survival beneath Cruorbus (${activeFlow} alignment).`;
          pivotDecision = `Starvation stalks the sector. Do you share dried provisions, dig for drought-resistant tubers, or hunt enduring wild beasts?`;
          variants = [
            { name: "Distribute Provisions", description: "Share your own rations to restore stamina and morale to dying wayfarers", preferredStat: "vitality" },
            { name: "Harvest Wild Roots", description: "Dredge hidden water seepages to harvest edible roots and wild herbs", preferredStat: "awareness" },
            { name: "Track Enduring Game", description: "Follow sparse animal spoor across barren terrain to secure fresh protein", preferredStat: "endurance" },
            { name: "Commune with the Wilds", description: "Sense where the vitality flow still lingers amidst ecological blight", preferredStat: "intuition" }
          ];
        }

      } else if (primary.type === "CRIME" && primary.score >= 30) {
        questCategory = "CRIME_SYNDICATE";
        questGiver = { name: "Veiled Wayfarer", role: "Smuggler Lookout", faction: "Underworld Enclave" };
        if (secondary.type === "TRADE" && secondary.score >= 25) {
          title = `Ambushed Meridian Crossing (${rx}, ${ry})`;
          hook = `A merchant trade cart sits halted amidst splintered lockboxes! Highway outlaws and syndicate footpads have cornered a travel merchant near the ${emergentRelic.name} with drawn steel.`;
          pivotDecision = `An ambush unfolds before you. Do you charge the bandits, negotiate safe passage, or loot the confusion?`;
          variants = [
            { name: "Intervene with Steel", description: "Charge into the fray to drive off highway robbers and defend the caravan", preferredStat: "might" },
            { name: "Parley with the Gang", description: "Use silver-tongued rhetoric or a modest bribe to de-escalate the standoff", preferredStat: "charm" },
            { name: "Pick Dispersed Lockboxes", description: "Use the commotion to pick open thrown containers and pocket luxury goods", preferredStat: "finesse" },
            { name: "Assess Trade Value", description: "Appraise scattered goods to determine what is worth defending", preferredStat: "logic" }
          ];
        } else {
          title = `Smuggler's Scrub of Sector (${rx}, ${ry})`;
          hook = `Disguised trail blazes, masked turf traps, and hidden dead-drops reveal an active syndicate conduit near the ${emergentRelic.name}. Fresh boot prints suggest contraband was moved through here recently.`;
          pivotDecision = `Illicit contraband leaves valuable traces. Do you unearth hidden root caches, neutralize wire spring-traps, or stake out the crossroads?`;
          variants = [
            { name: "Unearth Hidden Contraband", description: "Search beneath hollow tree roots and turf mounds for cached lockboxes", preferredStat: "awareness" },
            { name: "Disarm Spring Trap", description: "Carefully defuse a hidden wire caltrop mechanism guarding the path", preferredStat: "finesse" },
            { name: "Deduce Cartel Markings", description: "Analyze chalk sigils and wax seals to identify which syndicate runs this route", preferredStat: "logic" },
            { name: "Stake Out the Trail", description: "Remain motionless in thick brush to monitor cartel runners on the march", preferredStat: "endurance" }
          ];
        }

      } else if (primary.type === "CHAOS" && primary.score >= 25) {
        questCategory = "CHAOS_CORRUPTION";
        questGiver = { name: "Hermit Augur", role: "Astral Watcher", faction: "Wardens of the Core" };
        title = `The Resonant Astral Verge (${rx}, ${ry})`;
        hook = `Violet distortion warps the air with static chill under the Cruorbus moon (${moonPhase}). The Flow of ${activeFlow} radiates intensely around the ${emergentRelic.name}. ${emergentRelic.description} Occult hums vibrate in the earth.`;
        pivotDecision = `Cosmic distortion warps reality itself. Do you commune with the energetic flow, excavate resonant crystals, or anchor an iron ward?`;
        variants = [
          { name: "Attune to the Flow", description: `Open your mind to the Flow of ${activeFlow} to perceive hidden cosmic leylines`, preferredStat: "intuition" },
          { name: "Anchor Iron Ward", description: "Drive an unyielding iron spike into the soil to silence occult vibrations", preferredStat: "willpower" },
          { name: "Chisel Resonant Shards", description: "Carefully extract humming astral crystals without triggering an explosion", preferredStat: "logic" },
          { name: "Endure Void Static", description: "Steel your physical body against the icy radiation of the anomaly", preferredStat: "fortitude" }
        ];

      } else if (primary.type === "TROPHIC" && primary.score >= 35) {
        questCategory = "ECOLOGICAL_EXPEDITION";
        questGiver = { name: "Wilderness Tracker", role: "Frontier Hunter", faction: "Frontier Wilds" };
        title = `The Stalked Verge of Sector (${rx}, ${ry})`;
        hook = `Tense stillness hangs over the brush. A native apex predator crouches in the tall grass near the ${emergentRelic.name}, coiled to spring as grazing wild game drinks from a water seep unaware.`;
        pivotDecision = `The hunt is poised to strike. Do you ambush the distracted predator, scare off the game herd, or track the confrontation to scavenge?`;
        variants = [
          { name: "Ambush the Hunter", description: "Leap from cover to strike the apex predator while its attention is fixed on prey", preferredStat: "reflex" },
          { name: "Study Wildlife Instincts", description: "Observe predatory stalking patterns to expand ecological understanding", preferredStat: "knowledge" },
          { name: "Track & Field-Dress", description: "Wait downwind for the kill, then track the carcass to harvest meat and pelts", preferredStat: "awareness" },
          { name: "Stalk from Downwind", description: "Crawl through tall brush without snapping dry branches or alerting the beasts", preferredStat: "finesse" }
        ];

      } else if (primary.type === "TRADE" && primary.score >= 30) {
        questCategory = "HIGHWAY_ENCOUNTER";
        questGiver = { name: "Imperial Surveyor", role: "Road Warden", faction: context.factionOwner || "The Realm" };
        title = `The Sovereign Highway of Sector (${rx}, ${ry})`;
        hook = `A broad, stone-packed imperial highway cuts straight through the wilds. Iron-banded milestone pillars mark distances, while the ${emergentRelic.name} stands as an ancient roadside monument.`;
        pivotDecision = `The highway channels civilization through the wilderness. Do you decipher old milestone proclamations, rest at a roadside firepit, or scan for incoming caravans?`;
        variants = [
          { name: "Read Milestone Inscription", description: "Translate weathered royal decrees and trade tariffs carved into the stone", preferredStat: "knowledge" },
          { name: "Rest at Hearth Post", description: "Warm yourself by the stone firepit maintained by road wardens to regain vigor", preferredStat: "vitality" },
          { name: "Watch for Caravans", description: "Keep watch along the horizon for approaching merchants or official heralds", preferredStat: "awareness" },
          { name: "Barter with Road Wardens", description: "Trade wild provisions with passing guards for forged nails and steel wire", preferredStat: "charm" }
        ];

      } else if (primary.type === "ALTITUDE" && primary.score >= 35) {
        if (elevation > 0.65) {
          questCategory = "WILDERNESS_SCOUT";
          title = `The Wind-Ravaged Precipice (${rx}, ${ry})`;
          hook = `Bitter alpine gusts roar across sheer granite drops. Dizzying chasms split the mountain stone where the ${emergentRelic.name} clings to the high crag overlooking vast horizons.`;
          pivotDecision = `The sheer precipice offers strategic panoramic views and mortal peril. Do you scale the sheer rock face, cross a sway bridge, or survey passes?`;
          variants = [
            { name: "Scale the Sheer Crag", description: "Climb vertical rock faces with steady finger-holds to reach the high aerie", preferredStat: "might" },
            { name: "Traverse Abyss Ledge", description: "Carefully navigate narrow, crumbling rock shelves without losing footing", preferredStat: "reflex" },
            { name: "Survey Highland Panoramas", description: "Chart trade roads and faction troop movements visible across the plains", preferredStat: "awareness" },
            { name: "Endure Alpine Gale", description: "Steel your body against sub-zero mountain winds to maintain your position", preferredStat: "endurance" }
          ];
        } else {
          questCategory = "ECOLOGICAL_EXPEDITION";
          title = `The Sunken Mineral Basin (${rx}, ${ry})`;
          hook = `Dense ground-mist pools over saturated peat turf in this low depression. Bubbling mineral springs and peat bogs surround the ${emergentRelic.name}, releasing sulfurous steam into the damp stillness.`;
          pivotDecision = `The wet basin teems with rare bog life. Do you sample the mineral spring, dredge peat for fuel, or navigate the treacherous mire?`;
          variants = [
            { name: "Sample Mineral Springs", description: "Test and drink from bubbling sulfur springs to replenish stamina and vital fluids", preferredStat: "vitality" },
            { name: "Dredge Peat & Silt", description: "Extract dense combustible peat blocks and waterlogged antiquities from the mire", preferredStat: "endurance" },
            { name: "Sound the Mud Quagmire", description: "Probe the turf with a walking staff to avoid sinking into bottomless peat holes", preferredStat: "awareness" },
            { name: "Classify Rare Mosses", description: "Identify luminescent bog bryophytes with potent alchemical healing properties", preferredStat: "knowledge" }
          ];
        }

      } else {
        // Pure Emergent Relic & Wilderness Expedition
        questCategory = "ANCIENT_EXPEDITION";
        questGiver = { name: `${rng.pick(this.HUMAN_NAMES)} the Relic-Seeker`, role: "Ruin Scavenger", faction: "Independent Seekers" };
        title = `The ${emergentRelic.name} (${rx}, ${ry})`;
        hook = `Among the untamed expanse of ${bName} stands the ${emergentRelic.name}. ${emergentRelic.description} Planetary winds carry echoes of the world that was.`;
        pivotDecision = `The ancient relic beckons. Do you excavate salvage from the structure, decipher its ancient engineering, or study the surrounding terrain?`;
        variants = [
          { name: "Excavate Lost Salvage", description: "Pry into ancient compartments to salvage pre-Cruor metals and relics", preferredStat: "finesse" },
          { name: "Decipher Ancient Engineering", description: "Study construction ciphers to deduce how this marvel operated before the Fall", preferredStat: "logic" },
          { name: "Survey Ruin Perimeter", description: "Inspect surrounding blast marks and tracks for scavengers or lurking beasts", preferredStat: "awareness" },
          { name: "Force Rusted Hatch", description: "Use raw physical leverage to force open a jammed inspection bulkhead", preferredStat: "might" }
        ];
      }
    }

    // Emergent objectives: open exploration opportunities rather than mandatory linear checklists!
    const objectives: QuestObjective[] = [];

    if (isUrban) {
      objectives.push({
        id: `obj_notice_${beatId}`,
        type: "INTERACT_PROP",
        description: `Examine the Reeve's Notice Board for active civic bounties and trade requisitions`,
        targetId: "prop_notice_board",
        requiredCount: 1,
        currentCount: 0,
        completed: false
      });
      objectives.push({
        id: `obj_trade_${beatId}`,
        type: "TALK_NPC",
        description: `Barter provisions or trade goods with the local merchant stall`,
        targetId: "npc_urban_merchant",
        requiredCount: 1,
        currentCount: 0,
        completed: false
      });
      if (context.burg && (context.burg.unrest || 0) > 40) {
        objectives.push({
          id: `obj_unrest_${beatId}`,
          type: "EXPLORE_POI",
          description: `Investigate rumors of cartel agitation and civil unrest among the lower alleys`,
          targetId: "poi_burg_unrest",
          requiredCount: 1,
          currentCount: 0,
          completed: false
        });
      }
    } else {
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

      // Objective 2: Dynamic Emergent Relic interaction
      objectives.push({
        id: `obj_relic_${beatId}`,
        type: "INTERACT_PROP",
        description: `Inspect, decipher, or salvage the ${emergentRelic.name}`,
        targetId: emergentRelic.propId,
        requiredCount: 1,
        currentCount: 0,
        completed: false
      });

      // Objective 3: Ecology interaction (Hunting or Wildlife tracking)
      objectives.push({
        id: `obj_ecology_${beatId}`,
        type: "DEFEAT_NPC",
        description: `Track, hunt, or study wild fauna roaming the local habitat`,
        targetId: "npc_roaming_fauna",
        requiredCount: 1,
        currentCount: 0,
        completed: false
      });
    }

    return {
      beatId,
      category: questCategory,
      title,
      hook,
      questGiver,
      objectives,
      rewards: { xp: 120 + rng.range(0, 40), gold: 25 + rng.range(0, 20), item: getRandomWeaponForStat("might").name },
      reputationChanges: { [faction]: 10 },
      pivotDecision,
      variants
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
  public injectWorldStateForBeat(
    beat: StoryBeat,
    context?: SectorContext,
    persistedNPCs?: InjectedNPC[],
    worldTick: number = 0
  ): InjectedWorldState {
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
    const isUrban = !!(context?.burg || context?.baseTerrain === 4 || (mask & 64));

    if (isUrban) {
      const burgName = context?.burg?.name || "Provincial Settlement";
      props.push(
        TagMatrixEngine.createProp("prop_notice_board", `${burgName} Notice Board`, centerPoint, ["wood", "notice_board", "board", "bounties", "container"], 40),
        TagMatrixEngine.createProp("prop_town_fountain", "Cobblestone Town Fountain", [centerPoint[0] + 3, centerPoint[1] + 2], ["stone", "water", "water_source", "landmark"], 120),
        TagMatrixEngine.createProp("prop_blacksmith_anvil", "Great Forge Anvil", [centerPoint[0] - 4, centerPoint[1] - 3], ["metal", "iron", "crafting", "forge", "heavy"], 150),
        TagMatrixEngine.createProp("prop_tavern_hearth", "Tavern Hearthfire", [centerPoint[0] - 3, centerPoint[1] + 4], ["fire", "hearth", "rest", "warmth"], 30),
        TagMatrixEngine.createProp("prop_merchant_stall", "Market Provisioner Stall", [centerPoint[0] + 4, centerPoint[1] - 2], ["wood", "container", "openable", "valuable"], 50),
        TagMatrixEngine.createProp("prop_town_portcullis", "Iron-Reinforced Town Gate", [centerPoint[0] + 16, centerPoint[1]], ["metal", "iron", "locked", "door", "heavy"], 180),
        TagMatrixEngine.createProp("prop_guard_rack", "Armory Weapons Rack", [centerPoint[0] + 14, centerPoint[1] - 2], ["wood", "metal", "container", "crafting"], 45),
        TagMatrixEngine.createProp("prop_apothecary_chest", "Apothecary Herb Chest", [centerPoint[0] - 6, centerPoint[1] - 5], ["wood", "locked", "container", "forageable", "medicine"], 35),
        TagMatrixEngine.createProp("prop_cellar_hatch", "Padlocked Cellar Hatch", [centerPoint[0] + 8, centerPoint[1] + 8], ["wood", "iron", "locked", "container", "secret"], 40),
        TagMatrixEngine.createProp("prop_relic_shrine", "Municipal Martyr Shrine", [centerPoint[0] - 10, centerPoint[1] + 6], ["stone", "altar", "sacred", "magic", "ancient"], 110)
      );
    } else {

      // =============================================================
      // DISTRIBUTED 256x256 WILDERNESS SECTOR CONSTELLATIONS
      // =============================================================

      // 1. Central Crossroads / Spawn Glade (around ~[128, 128])
      props.push(
        TagMatrixEngine.createProp("prop_milestone", "Imperial Highway Milestone", centerPoint, ["stone", "ancient", "heavy", "milestone"], 80),
        TagMatrixEngine.createProp("prop_wayfarer_hearth", "Roadside Hearthfire", [centerPoint[0] + 3, centerPoint[1] - 2], ["fire", "hearth", "warmth", "rest"], 20),
        TagMatrixEngine.createProp("prop_abandoned_cart", "Weathered Trade Wagon", [centerPoint[0] - 4, centerPoint[1] + 3], ["wood", "container", "flammable", "openable"], 40)
      );

      // 2. North-West Wild Glade (~[60, 60])
      const nwFlora1 = ecology.flora[0] || { name: "Wild Herbs", tags: ["organic", "forageable", "herbs"], hp: 10 };
      const nwFlora2 = ecology.flora[1] || { name: "Medicinal Roots", tags: ["organic", "forageable", "medicine"], hp: 10 };
      props.push(
        TagMatrixEngine.createProp("prop_nw_flora_main", nwFlora1.name, northGlade, [...nwFlora1.tags, "flora", "forageable"], nwFlora1.hp),
        TagMatrixEngine.createProp("prop_nw_flora_med", nwFlora2.name, [northGlade[0] + 4, northGlade[1] + 3], [...nwFlora2.tags, "flora", "forageable"], nwFlora2.hp),
        TagMatrixEngine.createProp("prop_hollow_trunk", "Hollow Ancient Tree Snag", [northGlade[0] - 3, northGlade[1] - 2], ["wood", "shelter", "container", "flammable"], 35),
        TagMatrixEngine.createProp("prop_nw_boulder", "Mossy Granite Boulder", [northGlade[0] + 5, northGlade[1] - 4], ["stone", "cover_heavy", "climbable"], 75)
      );

      // 3. North-East Heights & Crags (~[190, 65])
      props.push(
        TagMatrixEngine.createProp("prop_mineral_vein", "Exposed Ore Vein", eastRidge, ["stone", "metal", "iron", "crafting"], 90),
        TagMatrixEngine.createProp("prop_ruin_monolith", "Weathered Ancient Monolith", [eastRidge[0] + 3, eastRidge[1] + 2], ["stone", "ancient", "runes", "magic"], 100),
        TagMatrixEngine.createProp("prop_cliff_ledge", "Sheer Rock Precipice", [eastRidge[0] - 4, eastRidge[1] - 3], ["stone", "climbable", "cliff", "elevation"], 110)
      );

      // 4. South-West Waterway & Basin (~[60, 185])
      props.push(
        TagMatrixEngine.createProp("prop_water_spring", "Natural Freshwater Spring", westWaterway, ["water", "water_source", "drinkable", "pure"], 100),
        TagMatrixEngine.createProp("prop_sw_reeds", "Dense Water Reed Cluster", [westWaterway[0] + 3, westWaterway[1] + 2], ["organic", "forageable", "fiber", "flora"], 15),
        TagMatrixEngine.createProp("prop_smuggler_cache", "Concealed Hollowed Root Cache", [westWaterway[0] - 4, westWaterway[1] - 2], ["wood", "locked", "valuable", "container", "hidden"], 30),
        TagMatrixEngine.createProp("prop_peat_mound", "Sunken Peat Mound", [westWaterway[0] + 2, westWaterway[1] - 5], ["earth", "cover_light", "flammable"], 25)
      );

      // 5. South-East Verge & Ruins (~[190, 190])
      props.push(
        TagMatrixEngine.createProp("prop_stone_sarcophagus", "Weathered Stone Sarcophagus", southMeadow, ["stone", "container", "locked", "ancient", "openable"], 65),
        TagMatrixEngine.createProp("prop_fallen_pillar", "Moss-Covered Fluted Column", [southMeadow[0] - 3, southMeadow[1] + 3], ["stone", "cover_heavy", "rubble", "impassable"], 80),
        TagMatrixEngine.createProp("prop_charred_spit", "Charred Campfire Spit", [southMeadow[0] + 4, southMeadow[1] - 2], ["fire", "bone", "remains", "rest"], 20),
        TagMatrixEngine.createProp("prop_berry_bramble", "Wild Blackberry Bramble", [southMeadow[0] - 5, southMeadow[1] - 4], ["organic", "forageable", "edible", "flora", "sharp"], 15)
      );

      // -----------------------------------------------------------
      // INFRASTRUCTURE ENHANCEMENTS (BASED ON WORLD MASKS)
      // -----------------------------------------------------------

      // Imperial Highway (mask & 2)
      if (mask & 2) {
        props.push(
          TagMatrixEngine.createProp("prop_highway_post", "Carved Guild Signpost", [centerPoint[0] + 8, centerPoint[1] - 5], ["wood", "notice_board", "board"], 30),
          TagMatrixEngine.createProp("prop_merchant_footlocker", "Bandit-Raided Footlocker", [centerPoint[0] - 8, centerPoint[1] + 6], ["metal", "locked", "container", "valuable"], 35)
        );
      }

      // Smuggler Route (mask & 4)
      if (mask & 4) {
        props.push(
          TagMatrixEngine.createProp("prop_cairn_marker", "Discreet Stone Marker Cairn", [westWaterway[0] + 6, westWaterway[1] + 4], ["stone", "hidden", "cover_light"], 20),
          TagMatrixEngine.createProp("prop_tripwire_trap", "Concealed Tripwire Rig", [westWaterway[0] - 2, westWaterway[1] + 6], ["trap", "mechanism", "fragile"], 10)
        );
      }

      // Ancient Ruins or Temple Megaliths (mask & 8 or 16)
      if (mask & 8 || mask & 16) {
        props.push(
          TagMatrixEngine.createProp("prop_arcane_wardstone", "Pulsing Arcane Wardstone", [northGlade[0] + 8, northGlade[1] - 6], ["stone", "magic", "ancient", "wardstone"], 120),
          TagMatrixEngine.createProp("prop_sacred_altar", "Ancient Consecrated Relic Altar", [northGlade[0] - 7, northGlade[1] + 6], ["stone", "altar", "sacred", "magic"], 85)
        );
      }

      // Warzone Remnants (mask & 128 or isWarzone)
      if ((mask & 128) || context?.isWarzone) {
        props.push(
          TagMatrixEngine.createProp("prop_war_barricade", "Reinforced Timber Barricade", [centerPoint[0] + 12, centerPoint[1] + 10], ["wood", "cover_heavy", "destructible", "flammable"], 55),
          TagMatrixEngine.createProp("prop_munitions_crate", "Scavenged Munitions Footlocker", [centerPoint[0] + 15, centerPoint[1] + 8], ["metal", "locked", "valuable", "container"], 35)
        );
      }

      // High Elevation: Chasm bridge, cairn, and raptor aerie
      const elevationVal = context?.elevation ?? 0.5;
      if (elevationVal > 0.65) {
        props.push(
          TagMatrixEngine.createProp("prop_chasm_bridge", "Rickety Chasm Suspension Bridge", [centerPoint[0] + 10, centerPoint[1] + 12], ["wood", "rope", "fragile", "bridge", "elevation"], 35),
          TagMatrixEngine.createProp("prop_highland_cairn", "Wind-Beaten Wayfarer Cairn", [eastRidge[0] + 5, eastRidge[1] - 4], ["stone", "cover_heavy", "climbable", "ancient"], 90),
          TagMatrixEngine.createProp("prop_aerie_nest", "Cliffside Raptor Eyrie", [eastRidge[0] - 6, eastRidge[1] + 5], ["organic", "nest", "container", "lootable"], 25)
        );
      }

      // Low Elevation: Sunken cistern, sulfur geyser, and peat beds
      if (elevationVal < 0.28) {
        props.push(
          TagMatrixEngine.createProp("prop_sunken_cistern", "Partially Submerged Stone Cistern", [westWaterway[0] + 6, westWaterway[1] - 4], ["stone", "water", "ancient", "locked", "container"], 80),
          TagMatrixEngine.createProp("prop_sulfur_vent", "Steaming Sulfur Geyser Vent", [westWaterway[0] - 5, westWaterway[1] + 5], ["earth", "fire", "water", "hazard", "smoke"], 120)
        );
      }

      // High Chaos: Void crystal spires and fractured leyline fissures
      const chaosVal = context?.chaosRadiation ?? 0;
      if (chaosVal > 0.35) {
        props.push(
          TagMatrixEngine.createProp("prop_void_crystal", "Resonating Void Crystal Spire", [northGlade[0] + 6, northGlade[1] + 6], ["crystal", "magic", "fragile", "valuable", "resonant"], 30),
          TagMatrixEngine.createProp("prop_rift_fissure", "Fractured Leyline Fissure", [northGlade[0] - 6, northGlade[1] - 5], ["magic", "ancient", "hazard", "fissure"], 150)
        );
      }

      // Dense Primeval Canopy
      const vegVal = context?.vegetationDensity ?? 0.5;
      if (vegVal > 0.65) {
        props.push(
          TagMatrixEngine.createProp("prop_elder_tree", "Hollowed Thousand-Year Elder Tree", [northGlade[0] - 8, northGlade[1] + 4], ["wood", "shelter", "container", "climbable", "ancient"], 120),
          TagMatrixEngine.createProp("prop_druid_stones", "Overgrown Menhir Ring", [southMeadow[0] + 8, southMeadow[1] - 6], ["stone", "ancient", "sacred", "runes", "magic"], 100)
        );
      }

      // Tension Situation: Merchant Ambush
      const rawAgentTypes = new Set((context?.entitiesPresent || []).map((a: any) => a.type));
      if (rawAgentTypes.has("Merchant") && (rawAgentTypes.has("Bandit") || rawAgentTypes.has("Smuggler"))) {
        props.push(
          TagMatrixEngine.createProp("prop_ambush_wagon", "Battered Merchant Freight Wagon", [centerPoint[0] - 2, centerPoint[1]], ["wood", "container", "cover_heavy", "openable", "valuable"], 60),
          TagMatrixEngine.createProp("prop_spilled_crates", "Spilled Burlap Cargo Crates", [centerPoint[0] + 3, centerPoint[1] + 2], ["wood", "container", "openable", "lootable"], 20)
        );
      }

      // -----------------------------------------------------------
      // DRAGON PRISONS & POST-APOCALYPTIC WORLD RELICS
      // -----------------------------------------------------------
      const dragonPrison = DRAGON_PRISONS[cellId];
      if (dragonPrison) {
        props.push(
          TagMatrixEngine.createProp("prop_dragon_prison", `${dragonPrison.title} Monolith Seal`, [centerPoint[0] + 2, centerPoint[1] - 3], ["stone", "ancient", "prison", "wardstone", "dragon_seal", "magic", "heavy"], 250),
          TagMatrixEngine.createProp("prop_blood_altar", "Shattered Cruor Sacrificial Altar", [centerPoint[0] + 5, centerPoint[1] + 4], ["stone", "altar", "sacred", "blood_magic", "cultist", "flammable"], 80),
          TagMatrixEngine.createProp("prop_warden_spear_rack", "Grey Warden Spear Stash", [centerPoint[0] - 6, centerPoint[1] + 3], ["metal", "weapon_rack", "container", "titanium", "openable"], 50),
          TagMatrixEngine.createProp("prop_dragon_breath_fissure", `Abyssal ${dragonPrison.domain} Fissure`, [centerPoint[0] + 7, centerPoint[1] - 6], ["earth", "hazard", "magic", "fissure", "resonant"], 120)
        );
      }

      // Seed a dynamic emergent relic composed from live simulation variables
      const activeFlow = context?.activeFlow || "Ordo";
      const elevation = context?.elevation ?? 0.5;
      const emergentRelic = synthesizeEmergentRelic(rng, bName, activeFlow, elevation, mask);
      const relicPos: [number, number] = [rng.range(135, 160), rng.range(90, 115)];
      props.push(
        TagMatrixEngine.createProp(emergentRelic.propId, emergentRelic.name, relicPos, emergentRelic.tags, emergentRelic.hp)
      );
    }

    // -------------------------------------------------------------
    // PROCEDURAL LIVING ENTITIES (NO HARDCODED DATA)
    // -------------------------------------------------------------
    const persistedMap = new Map<string, InjectedNPC>();
    if (persistedNPCs && persistedNPCs.length > 0) {
      persistedNPCs.forEach((n) => persistedMap.set(n.id, n));
    }

    const synthesizedNPCs = ProceduralNPCGenerator.generateNPCsForSector(
      context || {
        cellId: 13408,
        biomeName: "Temperate Forest",
        isWarzone: false,
        isFamine: false,
        chaosRadiation: 0,
        infrastructureMask: 0
      },
      persistedMap,
      worldTick
    );
    npcs.push(...synthesizedNPCs);

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
