/**
 * FACTION ECONOMIC SPECIALTIES & CANONICAL SIGNATURE COMMODITIES
 * 
 * Source of Truth:
 *  - C:\Users\krazy\Desktop\Shatterlands\Canon\08_Peoples_and_Kingdoms.md
 *  - C:\Users\krazy\Desktop\Shatterlands\Canon\10_Dragonstone_Aether-tech_and_Economy.md
 *  - C:\Users\krazy\Desktop\Shatterlands\Canon\12_Factions_and_Organisations.md
 *  - C:\Users\krazy\Desktop\Shatterlands\Canon\14_Bestiary_and_Flora.md
 *  - C:\Users\krazy\Desktop\Shatterlands\Canon\World_Overview.md
 *  - simulation-engine\data\Holgaland.json (Goods 1-120 and 54 recipes)
 */

export type CommodityCategory = 
  | "STRUCTURAL"     // Heavy structural materials (Iron, Wood, Stone-Root Timber, Sheet Metal, Coral-Chitin)
  | "FOUNDATION"     // Base stone, white sand, clay, ceramics, bricks
  | "PRESERVATION"   // Grain, salt, preserved food, barrels
  | "ADVANCED"       // Precision optical glass, Jitter-Rigs (3-axis resonance gimbals), Aether Coils, Tools
  | "HEALTH"         // Sump-Kin pharmaceuticals, Viper-Haze, Grave-Berries, Sun-Melons, Silver Needle Tea
  | "ENERGY"         // Dragonstone, D-Dust, Chaos-Boilers, Coal, Oil
  | "METAPHYSICAL"   // Reliance Aether-Clear (chaos-resistant compound), Charms, Dusted Ink
  | "LOGISTICS";     // Mounts (Ash-Bison, Horses), Ships, Aether-Skiffs, Intelligence/Perfume

export interface FactionSpecialty {
  factionId: number;
  factionName: string;
  goodId: number;                  // Exact ID from Holgaland.json (1-120)
  goodName: string;                // Canonical good name from Holgaland.json
  uniqueGoodKey: string;           // Canonical key for complex inventory tracking
  uniqueGood: string;              // Compatibility alias for uniqueGoodKey
  uniqueGoodName: string;          // Compatibility alias for goodName
  category: CommodityCategory;
  specialtyName: string;
  harvestMethod: string;
  description: string;
  unit: string;                    // Canonical unit (wain, pile, rig, vial, etc.)
  recipeInputs: Array<{ goodId: number; name: string; count: number }>;
  requiredRawInputs: Array<{ resource: string; count: number }>; // Compatibility alias
  outputPerBatch: number;
  baseExportPrice: number;         // Base economic value from map data
  artisanRole: string;
  artisanPersonaTag: string;
  progressRoleDescription: string;
  loreSecret?: string;             // Canonical insider secret (e.g. Flower Valley intel swap, Avian bank)
}

const RAW_SPECIALTIES: Record<number, any> = {
  // 1. Avian Empire (Fulcrum Bank capital, windowless white granite spires)
  1: {
    factionId: 1,
    factionName: "Avian Empire",
    goodId: 106,
    goodName: "Aether-Skiffs",
    uniqueGoodKey: "aether_skiffs",
    category: "LOGISTICS",
    specialtyName: "High-Altitude Solar Aerowrights",
    harvestMethod: "Assembling pressurized closed-loop hulls with aether-coils and chaos-boilers",
    description: "High-altitude aether-skiffs engineered to navigate the upper cloud ceilings under Avian flight charts.",
    unit: "skiff",
    recipeInputs: [
      { goodId: 1, name: "Wood", count: 2 },
      { goodId: 52, name: "Sails", count: 1 },
      { goodId: 102, name: "Aether Coils", count: 2 },
      { goodId: 103, name: "Chaos-Boilers", count: 1 },
      { goodId: 105, name: "Sheet Metal", count: 4 }
    ],
    outputPerBatch: 1,
    baseExportPrice: 120,
    artisanRole: "Avian Aerowright",
    artisanPersonaTag: "#AetherSkiffwright",
    progressRoleDescription: "Mandatory for establishing continental high-altitude cargo lines and sky patrols.",
    loreSecret: "The Avian Empire secretly owns the majority of the Gilded Compass through Fulcrum shell companies."
  },

  // 2. Grey Wardens (Patrollers of the 12 Dragon Flows and Ancient Prisons)
  2: {
    factionId: 2,
    factionName: "Grey Wardens",
    goodId: 72,
    goodName: "Dragonstone",
    uniqueGoodKey: "dragonstone",
    category: "ENERGY",
    specialtyName: "Leyline Resonance Sifting",
    harvestMethod: "Cleansing and harmonizing dragonstone shards along the banks of the 12 Chaos Flows",
    description: "Crystalline dragonstone shards resonant with ancient primordial wyrm-sleep, essential for stabilizing wards and powering aether-tech drives.",
    unit: "shard",
    recipeInputs: [],
    outputPerBatch: 2,
    baseExportPrice: 20,
    artisanRole: "Flow Warden Sifter",
    artisanPersonaTag: "#FlowSeerArtisan",
    progressRoleDescription: "Mandatory for charging aetheric engine cores and anchoring civic chaos wardstones."
  },

  // 3. The Gilded Compass (The Cartel That Owns the Sky)
  3: {
    factionId: 3,
    factionName: "Gilded Compass",
    goodId: 62,
    goodName: "Aetherium Coins",
    uniqueGoodKey: "aetherium_coins",
    category: "LOGISTICS",
    specialtyName: "Meridian Bullion & Licenced Ledger Minting",
    harvestMethod: "Assaying gold and silver bullion with D-Dust stabilizer seals under Fulcrum Bank authority",
    description: "Standardized currency and credit tokens backed by the Fulcrum Bank, stamped with tamper-proof shadow-set seals.",
    unit: "bag",
    recipeInputs: [
      { goodId: 8, name: "Gold", count: 0.5 },
      { goodId: 99, name: "D-Dust", count: 0.25 }
    ],
    outputPerBatch: 4,
    baseExportPrice: 30,
    artisanRole: "Hippo Master of Coin",
    artisanPersonaTag: "#MeridianAssayer",
    progressRoleDescription: "Mandatory for settling high-tonnage inter-faction treaties, charter loans, and customs clearance."
  },

  // 4. Ursine Hegemony (Bear-Folk Mountain Colleges & Precision Workshops)
  4: {
    factionId: 4,
    factionName: "Ursine Hegemony",
    goodId: 104,
    goodName: "Jitter-Rigs",
    uniqueGoodKey: "jitter_rigs",
    category: "ADVANCED",
    specialtyName: "Chaos-Resonance Navigational Gimbals",
    harvestMethod: "Mounting raw dragonstone chips inside three-axis gimbals ringed by prime-pitch acoustic tuning forks",
    description: "Sophisticated navigational instruments that sing acoustically before a Chaos Flow shifts, essential for airship navigators working the noise plates.",
    unit: "rig",
    recipeInputs: [
      { goodId: 4, name: "Iron", count: 0.5 },
      { goodId: 72, name: "Dragonstone", count: 0.5 },
      { goodId: 97, name: "Piezo Quartz", count: 0.5 }
    ],
    outputPerBatch: 2,
    baseExportPrice: 30,
    artisanRole: "Ursine Mechanician",
    artisanPersonaTag: "#JitterRigMaker",
    progressRoleDescription: "Mandatory for safe trans-continental sky navigation and early detection of chaos weather surges."
  },

  // 5. The Reliance (Quiet Mushroom-Folk Scholars of Generational Wisdom)
  5: {
    factionId: 5,
    factionName: "The Reliance",
    goodId: 108,
    goodName: "Aether-Clear",
    uniqueGoodKey: "aether_clear",
    category: "METAPHYSICAL",
    specialtyName: "Chaos-Resistant Compound Distillation",
    harvestMethod: "Slow biochemical extraction blending Lunar Ghost-Blooms with ozone-milk and cave fungal enzymes",
    description: "Legendary translucent serum developed at the University of Reliance that insulates living tissue and stone against ambient chaos mutation.",
    unit: "vial",
    recipeInputs: [
      { goodId: 85, name: "Lunar Ghost-Blooms", count: 1 },
      { goodId: 89, name: "Ozone-Milk", count: 0.5 }
    ],
    outputPerBatch: 3,
    baseExportPrice: 25,
    artisanRole: "Mushroom-Folk Alchemist",
    artisanPersonaTag: "#RelianceCompounder",
    progressRoleDescription: "Mandatory for dampening chaos bleed in dense settlements and shielding workers near open leylines."
  },

  // 6. Sylvan Empire (The Great Northern Forest & Old-Growth Canopies)
  6: {
    factionId: 6,
    factionName: "Sylvan Empire",
    goodId: 36,
    goodName: "Mahogany",
    uniqueGoodKey: "mahogany",
    category: "STRUCTURAL",
    specialtyName: "Ancient Heartwood Forestry",
    harvestMethod: "Selective sustainable felling of deep forest mahogany and ironwood using singing fae-wedges",
    description: "Dense, resonant hardwood with natural rot-resistance, essential for heavy ship keels, structural arches, and fine municipal halls.",
    unit: "pile",
    recipeInputs: [{ goodId: 1, name: "Wood", count: 2 }],
    outputPerBatch: 3,
    baseExportPrice: 7,
    artisanRole: "Sylvan Master Forester",
    artisanPersonaTag: "#HeartwoodArtisan",
    progressRoleDescription: "Mandatory for building fortified dock gantries, airship hulls, and long-span municipal roofs."
  },

  // 7. Iron Caldera (Master Smiths & Volcanic Smelters)
  7: {
    factionId: 7,
    factionName: "Iron Caldera",
    goodId: 105,
    goodName: "Sheet Metal",
    uniqueGoodKey: "sheet_metal",
    category: "STRUCTURAL",
    specialtyName: "Geothermal Blast-Furnace Rolling",
    harvestMethod: "Refining ore through basalt crucible blast furnaces powered by subterranean magma vents",
    description: "Uniform, heat-treated structural sheet metal and masterwork iron fittings required for fortress plating and airship armor.",
    unit: "sheet",
    recipeInputs: [
      { goodId: 4, name: "Iron", count: 1 },
      { goodId: 34, name: "Coal", count: 1 }
    ],
    outputPerBatch: 4,
    baseExportPrice: 8,
    artisanRole: "Caldera Master Smith",
    artisanPersonaTag: "#CalderaSmith",
    progressRoleDescription: "Mandatory for structural fortification upgrades, gate armor, and heavy artillery chassis."
  },

  // 8. Heartland Alliance (The Continental Breadbasket)
  8: {
    factionId: 8,
    factionName: "Heartland Alliance",
    goodId: 9,
    goodName: "Grain",
    uniqueGoodKey: "grain",
    category: "PRESERVATION",
    specialtyName: "Golden Amber-Grain Granaries",
    harvestMethod: "Large-scale cyclical field harvesting across the vast fertile central plains",
    description: "Nutrient-dense cereal staples harvested by deer and beaver farmers, feeding the continent's major urban populations.",
    unit: "wain",
    recipeInputs: [],
    outputPerBatch: 12,
    baseExportPrice: 1,
    artisanRole: "Heartland Granary Factor",
    artisanPersonaTag: "#HeartlandHusbandman",
    progressRoleDescription: "Mandatory for sustaining urban demographic growth and preventing famine riots in non-agricultural burgs."
  },

  // 9. Vaneer Concord (Coastal Canals & Tidal Salt Works)
  9: {
    factionId: 9,
    factionName: "Vaneer Concord",
    goodId: 16,
    goodName: "Salt",
    uniqueGoodKey: "salt",
    category: "PRESERVATION",
    specialtyName: "Tidal Pan Solar Evaporation",
    harvestMethod: "Channelling high-tide seawater into stepped basalt evaporation pans along coastal flats",
    description: "Pure mineral sea salt crystals required for large-scale meat and fish curing, preventing food spoilage across trade routes.",
    unit: "bag",
    recipeInputs: [],
    outputPerBatch: 8,
    baseExportPrice: 2,
    artisanRole: "Vaneer Salt Master",
    artisanPersonaTag: "#SaltSalter",
    progressRoleDescription: "Mandatory for curing winter rations and manufacturing preserved sea rations."
  },

  // 10. Sump-Kin (Marshland Chemists & Bio-Alchemists)
  10: {
    factionId: 10,
    factionName: "Sump-Kin",
    goodId: 114,
    goodName: "Viper-Haze",
    uniqueGoodKey: "viper_haze",
    category: "HEALTH",
    specialtyName: "Marsh Alkaloid Distillation",
    harvestMethod: "Combining mutated swamp biomass with venom glands from deep marsh titan-boas",
    description: "Potent narcotic and pain-numbing compound; dramatically pacifies civil unrest in crisis burgs at the cost of gradual citizen vitality.",
    unit: "pouch",
    recipeInputs: [
      { goodId: 92, name: "Titan-Boas", count: 0.5 },
      { goodId: 93, name: "Mutated Biomass", count: 0.5 }
    ],
    outputPerBatch: 3,
    baseExportPrice: 16,
    artisanRole: "Sump-Kin Venom Brewer",
    artisanPersonaTag: "#SumpApothecary",
    progressRoleDescription: "High-value illicit and clinical narcotic; suppresses civil unrest while causing public health dependency."
  },

  // 11. River Folk (Freshwater Fish-Folk & Traditional Shipwrights)
  11: {
    factionId: 11,
    factionName: "River Folk",
    goodId: 53,
    goodName: "Ships",
    uniqueGoodKey: "ships",
    category: "LOGISTICS",
    specialtyName: "Traditional Riverine Craftsmanship",
    harvestMethod: "Steaming river-oak timber and tarring joints with hemp cordage for shallow-draft river vessels",
    description: "Sturdy, shallow-draft riverboats, freight barges, and skiffs capable of traversing inland rapids and locks without grounding.",
    unit: "ship",
    recipeInputs: [
      { goodId: 1, name: "Wood", count: 4 },
      { goodId: 32, name: "Tar", count: 2 },
      { goodId: 48, name: "Ropes", count: 4 },
      { goodId: 52, name: "Sails", count: 4 }
    ],
    outputPerBatch: 1,
    baseExportPrice: 50,
    artisanRole: "River Folk Master Shipwright",
    artisanPersonaTag: "#RiverShipwright",
    progressRoleDescription: "Mandatory for establishing inland waterway freight routes and river ferry networks."
  },

  // 12. Flower Valley (Diplomatic Intelligence Swapped via Luxury Commerce)
  12: {
    factionId: 12,
    factionName: "Flower Valley",
    goodId: 71,
    goodName: "Perfume",
    uniqueGoodKey: "perfume",
    category: "LOGISTICS",
    specialtyName: "Aromatic Essential Oils & Ciphered Dossiers",
    harvestMethod: "Pressing rare mountain blossom petals into luxury scents while embedding diplomatic intelligence in ciphered manifests",
    description: "Exquisite floral essences and rare cosmetic perfumes traded to foreign nobles—carrying coded diplomatic intelligence.",
    unit: "bottle",
    recipeInputs: [
      { goodId: 14, name: "Olives", count: 1 },
      { goodId: 25, name: "Incense", count: 0.5 },
      { goodId: 47, name: "Glass", count: 0.5 }
    ],
    outputPerBatch: 3,
    baseExportPrice: 17,
    artisanRole: "Floral Parfumeur & Courier",
    artisanPersonaTag: "#DiplomaticParfumeur",
    progressRoleDescription: "Used to sway foreign courts, reduce sovereign diplomatic tension, and covertly extract strategic rumors.",
    loreSecret: "Flower Valley's luxury cosmetic trade is primarily a front for continental intelligence and diplomatic dossier exchange."
  },

  // 13. Eastern Hounds (Barrow Keepers & Beast Breeders)
  13: {
    factionId: 13,
    factionName: "Eastern Hounds",
    goodId: 86,
    goodName: "Grave-Berries",
    uniqueGoodKey: "grave_berries",
    category: "HEALTH",
    specialtyName: "Barrow Cairn Harvesting",
    harvestMethod: "Gathering deep crimson berries cultivated around ancestral burial cairns and barrow mounds",
    description: "Eerie, nutrient-dense berries steeped into restorative elixirs and Mnemosyne-Wine, granting intense sensory invigoration.",
    unit: "basket",
    recipeInputs: [],
    outputPerBatch: 6,
    baseExportPrice: 4,
    artisanRole: "Barrow Groundskeeper",
    artisanPersonaTag: "#BarrowKeeper",
    progressRoleDescription: "Essential for brewing Mnemosyne-Wine and field rations for long wilderness campaigns."
  },

  // 14. Canopy Clans (The Verdant Tangle: Foxes, Monkeys, Pangolins, Tarsiers)
  14: {
    factionId: 14,
    factionName: "Canopy Clans",
    goodId: 91,
    goodName: "Stone-Root Timber",
    uniqueGoodKey: "stone_root_timber",
    category: "STRUCTURAL",
    specialtyName: "Ancestor-Tree Stone-Root Quarrying",
    harvestMethod: "Pangolin miner teams excavating fossilized ancestor roots from deep tunnels beneath the canopy",
    description: "Fossilized heartwood combining the workability of timber with the fireproof density of stone; unburnable in foundries and powder mills.",
    unit: "pile",
    recipeInputs: [],
    outputPerBatch: 4,
    baseExportPrice: 6,
    artisanRole: "Pangolin Root Sapper",
    artisanPersonaTag: "#StoneRootQuarrier",
    progressRoleDescription: "The only timber safe for Caldera blast foundries, powder works, and non-warping precision gunstocks."
  },

  // 15. Dust-Husk Riders (Chasm Nomads: Beetles, Moths, Spiders, Scorpions)
  15: {
    factionId: 15,
    factionName: "Dust-Husk Riders",
    goodId: 85,
    goodName: "Lunar Ghost-Blooms",
    uniqueGoodKey: "lunar_ghost_blooms",
    category: "METAPHYSICAL",
    specialtyName: "Nocturnal Desert Sifting",
    harvestMethod: "Harvesting luminescent moonflowers that bloom only during the dark hours across barren chasm ridges",
    description: "Bioluminescent blossoms holding faint aetheric charges, crucial for brewing Aether-Clear and preparing alchemical catalysts.",
    unit: "bundle",
    recipeInputs: [],
    outputPerBatch: 5,
    baseExportPrice: 8,
    artisanRole: "Nocturnal Blossom Stalker",
    artisanPersonaTag: "#GhostBloomGatherer",
    progressRoleDescription: "Mandatory raw botanical input for distilling chaos-resistant compounds and celestial ink."
  },

  // 16. Hive Commonwealth (Insectoid High-Altitude Architects)
  16: {
    factionId: 16,
    factionName: "Hive Commonwealth",
    goodId: 96,
    goodName: "Coral-Chitin",
    uniqueGoodKey: "coral_chitin",
    category: "STRUCTURAL",
    specialtyName: "Bio-Structural Chitin Lamination",
    harvestMethod: "Moulding secreted insectoid chitin plates with refractory mineral clay into ultra-lightweight armour",
    description: "Extremely resilient, lightweight chitin plates used for building agile airship carapaces and infantry scale cuirasses.",
    unit: "plate",
    recipeInputs: [],
    outputPerBatch: 4,
    baseExportPrice: 10,
    artisanRole: "Hive Chitin Shaper",
    artisanPersonaTag: "#ChitinSmith",
    progressRoleDescription: "Essential for crafting Chitin Skiffs and lightweight military armor with zero magnetic signature."
  },

  // 17. Prism-Scale Collective (Crystal Resonators & Light Smiths)
  17: {
    factionId: 17,
    factionName: "Prism-Scale Collective",
    goodId: 97,
    goodName: "Piezo Quartz",
    uniqueGoodKey: "piezo_quartz",
    category: "ADVANCED",
    specialtyName: "Harmonic Crystal Cleaving",
    harvestMethod: "Cleaving resonant quartz clusters from geothermal geode caverns along crystal fault lines",
    description: "Electrically and acoustically responsive quartz crystals required for assembling Jitter-Rigs and acoustic signalers.",
    unit: "crystal",
    recipeInputs: [],
    outputPerBatch: 3,
    baseExportPrice: 10,
    artisanRole: "Crystal Cleaver",
    artisanPersonaTag: "#PiezoHarmonizer",
    progressRoleDescription: "Mandatory resonance component for building Jitter-Rigs and aether-tech frequency modulators."
  },

  // 18. Port Sunder (Pelagic Fishermen & Oil Renderers)
  18: {
    factionId: 18,
    factionName: "Port Sunder",
    goodId: 35,
    goodName: "Oil",
    uniqueGoodKey: "oil",
    category: "ENERGY",
    specialtyName: "Pelagic Whale & Squid Oil Rendering",
    harvestMethod: "Boiling pelagic blubber in quayside iron caldrons to extract high-temperature lamp and machinery oil",
    description: "Refined pelagic animal oil essential for lubricating industrial machinery, fueling harbor lanterns, and firing incendiary siphons.",
    unit: "barrel",
    recipeInputs: [
      { goodId: 37, name: "Ice-Squid", count: 1 }
    ],
    outputPerBatch: 4,
    baseExportPrice: 3,
    artisanRole: "Port Sunder Oil Renderer",
    artisanPersonaTag: "#WhaleOilBoiler",
    progressRoleDescription: "Mandatory fuel for machinery lubrication, flame projectors, and long-burning municipal street lamps."
  },

  // 19. Meridian Chain (Triton & Merfolk Reef Bridge-Towns)
  19: {
    factionId: 19,
    factionName: "Meridian Chain",
    goodId: 22,
    goodName: "Pearls",
    uniqueGoodKey: "pearls",
    category: "ADVANCED",
    specialtyName: "Deep Reef Pearl Cultivation",
    harvestMethod: "Diving tidal reef trenches to gather luminous deep-water pearls from cultured giant molluscs",
    description: "Flawless ocean pearls prized as high-value currency reserves, diplomatic tributes, and optical focusing prisms.",
    unit: "pearl",
    recipeInputs: [],
    outputPerBatch: 2,
    baseExportPrice: 13,
    artisanRole: "Meridian Pearl Diver",
    artisanPersonaTag: "#ReefPearlHarvester",
    progressRoleDescription: "High-value trade luxury used for sovereign banking collateral and crafting precision optics."
  },

  // 20. Scute Confederacy (Reptilian Island Constructors & Cloud-Cutter Riders)
  20: {
    factionId: 20,
    factionName: "Scute Confederacy",
    goodId: 46,
    goodName: "Ceramics",
    uniqueGoodKey: "ceramics",
    category: "FOUNDATION",
    specialtyName: "Refractory Kiln Baking",
    harvestMethod: "Firing alluvial river clay in high-temperature wood kilns to create vitrified waterproof storage amphorae",
    description: "Durable vitrified ceramics and shell tiles, crucial for food storage vessels, drainage piping, and fireproof roof tiles.",
    unit: "wain",
    recipeInputs: [
      { goodId: 41, name: "Clay", count: 1 }
    ],
    outputPerBatch: 6,
    baseExportPrice: 6,
    artisanRole: "Scute Master Potter",
    artisanPersonaTag: "#ScuteCeramicist",
    progressRoleDescription: "Mandatory for urban sanitation culverts, chemical containers, and weatherproof roof construction."
  },

  // 21. Guerrilla Clans (Alpine Mountain Fighters)
  21: {
    factionId: 21,
    factionName: "Guerrilla Clans",
    goodId: 43,
    goodName: "Leather",
    uniqueGoodKey: "leather",
    category: "STRUCTURAL",
    specialtyName: "Highland Hide Tanning",
    harvestMethod: "Tanning highland beast hides with mountain ash bark and mineral salts for supple, weather-proof armor",
    description: "Hardened yet flexible boiled leather, used by scouts, mountain rangers, and covert airship crews for silent, durable equipment.",
    unit: "roll",
    recipeInputs: [
      { goodId: 12, name: "Game", count: 1 }
    ],
    outputPerBatch: 4,
    baseExportPrice: 4,
    artisanRole: "Clan Tanner",
    artisanPersonaTag: "#GuerrillaTanner",
    progressRoleDescription: "Mandatory for lightweight soldier armor, horse harnesses, and weatherproof gear packs."
  },

  // 22. Coastal Theocracy (Deep Monastic Orders & Incense Chapels)
  22: {
    factionId: 22,
    factionName: "Coastal Theocracy",
    goodId: 25,
    goodName: "Incense",
    uniqueGoodKey: "incense",
    category: "METAPHYSICAL",
    specialtyName: "Liturgical Resin Compounding",
    harvestMethod: "Blending consecrated sea balsams, dried aromatic kelp, and sacred gums in monastic scriptoriums",
    description: "Heavy aromatic resin burned during cathedral services, pacifying public fervor and warding off malevolent psychic corruption.",
    unit: "chest",
    recipeInputs: [],
    outputPerBatch: 3,
    baseExportPrice: 10,
    artisanRole: "Theocratic Thurifer",
    artisanPersonaTag: "#ConsecratedApothecary",
    progressRoleDescription: "Reduces religious dissent and calms unrest in holy cities, preventing cultist infiltrations."
  },

  // 23. Devil's Island (Penal Colony of Exiled Soldiers & Forges)
  23: {
    factionId: 23,
    factionName: "Devil's Island",
    goodId: 34,
    goodName: "Coal",
    uniqueGoodKey: "coal",
    category: "ENERGY",
    specialtyName: "Volcanic Seam Excavation",
    harvestMethod: "Extracting anthracite coal deposits from volcanic caldera crevices with heavy penal convict crews",
    description: "High-grade coking coal with intense burn heat, vital for smelting weapons and firing heavy industrial boiler engines.",
    unit: "wain",
    recipeInputs: [],
    outputPerBatch: 8,
    baseExportPrice: 3,
    artisanRole: "Penal Pit Boss",
    artisanPersonaTag: "#VolcanicMiner",
    progressRoleDescription: "Mandatory energy fuel for smelting masterwork bronze, iron tools, and powering steam boilers."
  },

  // 24. Skyroost Academy (Elite Aerotime Navigators & Aether-Wrights)
  24: {
    factionId: 24,
    factionName: "Skyroost Academy",
    goodId: 102,
    goodName: "Aether Coils",
    uniqueGoodKey: "aether_coils",
    category: "ADVANCED",
    specialtyName: "Harmonic Induction Wire Spooling",
    harvestMethod: "Winding ultra-fine copper wire with osmium and bismuth inductors to channel raw chaos into shaped power",
    description: "Precision induction coils that shape chaotic energy into usable propulsion and ward power, required for all aether engines.",
    unit: "coil",
    recipeInputs: [
      { goodId: 5, name: "Copper", count: 0.5 },
      { goodId: 75, name: "Osmium", count: 0.25 }
    ],
    outputPerBatch: 3,
    baseExportPrice: 14,
    artisanRole: "Academy Core-Wright",
    artisanPersonaTag: "#AetherCoilWright",
    progressRoleDescription: "Mandatory component for assembling Chaos-Boilers, Aether-Skiffs, and navigational telemetry."
  },

  // 25. Free Sky Baronies (Union Haulers & Outlaw Chapters)
  25: {
    factionId: 25,
    factionName: "Free Sky Baronies",
    goodId: 52,
    goodName: "Sails",
    uniqueGoodKey: "sails",
    category: "LOGISTICS",
    specialtyName: "Heavy Wind-Catcher Lofting",
    harvestMethod: "Stitching treated wind-silk cloth into heavy reinforced aerotime sails that withstand chaos turbulence",
    description: "Durable, high-tensile canvas sails dyed to the core-brand colors of the outlaw chapters, resisting severe storm shearing.",
    unit: "set",
    recipeInputs: [
      { goodId: 44, name: "Cloth", count: 1 }
    ],
    outputPerBatch: 4,
    baseExportPrice: 7,
    artisanRole: "Sky-Baron Sailmaker",
    artisanPersonaTag: "#WindCatcherLofter",
    progressRoleDescription: "Essential for refitting damaged airship wings and outfitting blockade-running cargo skiffs."
  },

  // 26. Fuvuiku Legions (The Canyon Toll Authority & Mercenary Armada at Ivory Pass)
  26: {
    factionId: 26,
    factionName: "Fuvuiku Legions",
    goodId: 59,
    goodName: "Arms",
    uniqueGoodKey: "arms",
    category: "STRUCTURAL",
    specialtyName: "Heavy Canyon Arsenal Forging",
    harvestMethod: "Casting heavy pikes, ballistas, and siege crossbows in fortified mountain armouries at Ivory Pass",
    description: "Standardized, heavy martial armaments and iron siege equipment used by legion shock troops and sold under strict mercenary contracts.",
    unit: "set",
    recipeInputs: [
      { goodId: 4, name: "Iron", count: 0.5 },
      { goodId: 34, name: "Coal", count: 1 },
      { goodId: 43, name: "Leather", count: 0.5 }
    ],
    outputPerBatch: 4,
    baseExportPrice: 25,
    artisanRole: "Legion Armourer Centurion",
    artisanPersonaTag: "#LegionArmourer",
    progressRoleDescription: "Mandatory for equipping military combat squads, garrisoning mountain forts, and fulfilling privateer contracts."
  }
};

export const FACTION_SPECIALTIES: Record<number, FactionSpecialty> = (() => {
  const result: Record<number, FactionSpecialty> = {};
  for (const [id, s] of Object.entries(RAW_SPECIALTIES)) {
    result[Number(id)] = {
      ...(s as any),
      uniqueGood: s.uniqueGoodKey,
      uniqueGoodName: s.goodName,
      requiredRawInputs: s.recipeInputs && s.recipeInputs.length > 0
        ? s.recipeInputs.map((r: any) => ({ resource: r.name.toLowerCase().replace(/ /g, '_'), count: r.count }))
        : [{ resource: "raw_materials", count: 2 }]
    };
  }
  return result;
})();

/**
 * Returns all unique good keys belonging to a specific category
 */
export function getGoodsByCategory(category: CommodityCategory): string[] {
  return Object.values(FACTION_SPECIALTIES)
    .filter(f => f.category === category)
    .map(f => f.uniqueGoodKey);
}

/**
 * Helper to fetch a specialty by ID or case-insensitive faction name
 */
export function getFactionSpecialty(factionIdOrName: number | string): FactionSpecialty {
  const fallback = FACTION_SPECIALTIES[8]!;
  if (typeof factionIdOrName === "number") {
    return FACTION_SPECIALTIES[factionIdOrName] || fallback;
  }

  const query = String(factionIdOrName).trim().toLowerCase();
  const matched = Object.values(FACTION_SPECIALTIES).find(f => 
    f.factionName.toLowerCase() === query || 
    f.factionName.toLowerCase().includes(query) ||
    query.includes(f.factionName.toLowerCase())
  );

  return matched || fallback;
}
