export interface TerrainPalette {
  base: string; // e.g. 'sand', 'grass', 'snow'
  features: Array<{ type: string, probability: number }>; // e.g. { type: 'pine_tree', probability: 0.1 }
  colors: {
    base: string;     // Hex color for the vast majority of the biome
    feature: string;  // Hex color for primary features (trees, rocks)
    accent: string;   // Hex color for rare features (flowers, oasis)
  };
  wildlife: Array<{ species: string, probability: number }>; // For those random tribal/animal clusters
  poi: string[]; // Potential Points of Interest (ruins, caves)
}

export const BIOME_MAPPING: Record<string, TerrainPalette> = {
  // 0 is often Marine or unspecified in some Azgaar exports, assuming Ocean/Water
  "0": {
    base: "water",
    features: [{ type: "reef", probability: 0.05 }],
    colors: { base: "#1e3a8a", feature: "#0369a1", accent: "#0ea5e9" },
    wildlife: [{ species: "Sirens", probability: 0.02 }, { species: "Sea Serpents", probability: 0.01 }],
    poi: ["Sunken Ruins", "Coral Labyrinth"]
  },
  "1": { // Hot Desert
    base: "sand",
    features: [{ type: "cactus", probability: 0.02 }, { type: "dune", probability: 0.1 }],
    colors: { base: "#fcd34d", feature: "#fbbf24", accent: "#34d399" }, // Accent for Oasis
    wildlife: [{ species: "Sand Wyrms", probability: 0.03 }, { species: "Scorpion Tribe", probability: 0.01 }],
    poi: ["Buried Temple", "Oasis Springs"]
  },
  "2": { // Cold Desert
    base: "permafrost",
    features: [{ type: "rock", probability: 0.15 }],
    colors: { base: "#d6d3d1", feature: "#a8a29e", accent: "#78716c" },
    wildlife: [{ species: "Frost Scavengers", probability: 0.04 }],
    poi: ["Ancient Monolith", "Frozen Carcass"]
  },
  "3": { // Savanna
    base: "dry_grass",
    features: [{ type: "acacia_tree", probability: 0.05 }, { type: "shrub", probability: 0.1 }],
    colors: { base: "#fde047", feature: "#ca8a04", accent: "#84cc16" },
    wildlife: [{ species: "Lionfolk Prides", probability: 0.05 }, { species: "Elephants", probability: 0.05 }],
    poi: ["Watering Hole", "Beast Graveyard"]
  },
  "4": { // Grassland
    base: "grass",
    features: [{ type: "flower_patch", probability: 0.05 }, { type: "oak_tree", probability: 0.02 }],
    colors: { base: "#a3e635", feature: "#65a30d", accent: "#d9f99d" },
    wildlife: [{ species: "Wild Horses", probability: 0.05 }, { species: "Centaur Nomads", probability: 0.02 }],
    poi: ["Fairy Ring", "Standing Stones"]
  },
  "5": { // Tropical Seasonal Forest
    base: "grass",
    features: [{ type: "jungle_tree", probability: 0.3 }],
    colors: { base: "#84cc16", feature: "#4d7c0f", accent: "#fbbf24" },
    wildlife: [{ species: "Ape Tribes", probability: 0.04 }, { species: "Panthers", probability: 0.03 }],
    poi: ["Overgrown Ziggurat", "Hidden Waterfall"]
  },
  "6": { // Temperate Deciduous Forest
    base: "dirt",
    features: [{ type: "deciduous_tree", probability: 0.5 }],
    colors: { base: "#4d7c0f", feature: "#15803d", accent: "#b45309" }, // autumn colors accent
    wildlife: [{ species: "Dire Wolves", probability: 0.03 }, { species: "Wood Elves", probability: 0.01 }],
    poi: ["Druid Grove", "Abandoned Lumber Camp"]
  },
  "7": { // Tropical Rainforest
    base: "mud",
    features: [{ type: "canopy_tree", probability: 0.7 }, { type: "vine", probability: 0.2 }],
    colors: { base: "#166534", feature: "#14532d", accent: "#ec4899" }, // pink flowers
    wildlife: [{ species: "Lizardfolk", probability: 0.04 }, { species: "Giant Spiders", probability: 0.05 }],
    poi: ["Serpent Shrine", "Poison Bog"]
  },
  "8": { // Temperate Rainforest
    base: "moss",
    features: [{ type: "tall_pine", probability: 0.6 }],
    colors: { base: "#0f766e", feature: "#065f46", accent: "#10b981" },
    wildlife: [{ species: "Bear Clan", probability: 0.03 }, { species: "Ents", probability: 0.01 }],
    poi: ["Mystic Hollow", "Ranger Outpost"]
  },
  "9": { // Taiga / Boreal Forest
    base: "snow_grass",
    features: [{ type: "pine_tree", probability: 0.4 }, { type: "rock", probability: 0.1 }],
    colors: { base: "#334155", feature: "#0f172a", accent: "#cbd5e1" },
    wildlife: [{ species: "Frost Giants", probability: 0.01 }, { species: "Snow Leopards", probability: 0.04 }],
    poi: ["Ice Cavern", "Hunter's Cabin"]
  },
  "10": { // Tundra
    base: "frost_dirt",
    features: [{ type: "rock", probability: 0.05 }, { type: "dead_bush", probability: 0.05 }],
    colors: { base: "#94a3b8", feature: "#475569", accent: "#e2e8f0" },
    wildlife: [{ species: "Mammoth Herd", probability: 0.02 }, { species: "Yeti", probability: 0.01 }],
    poi: ["Geothermal Vent", "Meteor Crater"]
  },
  "11": { // Glacier
    base: "ice",
    features: [{ type: "ice_spire", probability: 0.1 }],
    colors: { base: "#f8fafc", feature: "#e2e8f0", accent: "#38bdf8" }, // light blue accents
    wildlife: [{ species: "Ice Elementals", probability: 0.02 }, { species: "Walrus Kin", probability: 0.03 }],
    poi: ["Frozen Shipwreck", "Ice Castle"]
  },
  "12": { // Wetland
    base: "shallow_water",
    features: [{ type: "lilypad", probability: 0.1 }, { type: "willow_tree", probability: 0.2 }],
    colors: { base: "#3f6212", feature: "#1e3a8a", accent: "#a3e635" },
    wildlife: [{ species: "Crocodile Brood", probability: 0.05 }, { species: "Swamp Hags", probability: 0.01 }],
    poi: ["Witch Hut", "Sunken Catacombs"]
  }
};
