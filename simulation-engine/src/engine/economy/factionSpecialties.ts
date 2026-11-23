/**
 * FACTION ECONOMIC SPECIALTIES & CANONICAL SIGNATURE COMMODITIES
 *
 * Source of Truth:
 *  - C:\Users\krazy\Desktop\Shatterlands\Canon\08_Peoples_and_Kingdoms.md
 *  - C:\Users\krazy\Desktop\Shatterlands\Canon\10_Dragonstone_Aether-tech_and_Economy.md
 *  - C:\Users\krazy\Desktop\Shatterlands\Canon\12_Factions_and_Organisations.md
 *  - C:\Users\krazy\Desktop\Shatterlands\Canon\14_Bestiary_and_Flora.md
 *  - C:\Users\krazy\Desktop\Shatterlands\Canon\World_Overview.md
 *  - C:\Users\krazy\Desktop\Shatterlands\Ostraka_full.map (states 29..54 & goods 1..71)
 */

import { goodKeyFromName } from "./goodCatalog.js";

export type CommodityCategory =
  | "STRUCTURAL"     // Heavy structural materials (Sheet Metal, Stone-Root Timber, Coral-Chitin, Arms, Leather)
  | "FOUNDATION"     // Base stone, clay, ceramics, bricks
  | "PRESERVATION"   // Grain, salt, preserved food, barrels
  | "ADVANCED"       // Piezo Quartz, Jitter-Rigs, Aether Coils, Pearls
  | "HEALTH"         // Sump-Kin pharmaceuticals, Viper-Haze, Grave-Berries
  | "ENERGY"         // Dragonstone, Coal, Oil
  | "METAPHYSICAL"   // Reliance Aether-Clear, Incense, Lunar Ghost-Blooms
  | "LOGISTICS";     // Aether-Skiffs, Aethercoin, Boats, Sails, Perfume

export interface FactionSpecialty {
  factionId: number;
  factionName: string;
  goodId: number;
  goodName: string;
  uniqueGoodKey: string;
  uniqueGood: string;
  uniqueGoodName: string;
  category: CommodityCategory;
  specialtyName: string;
  harvestMethod: string;
  description: string;
  unit: string;
  recipeInputs: Array<{ goodId: number; name: string; count: number }>;
  requiredRawInputs: Array<{ resource: string; count: number }>;
  outputPerBatch: number;
  baseExportPrice: number;
  artisanRole: string;
  artisanPersonaTag: string;
  progressRoleDescription: string;
  loreSecret?: string;
}

const RAW_SPECIALTIES: Record<number, Omit<FactionSpecialty, "uniqueGood" | "uniqueGoodName" | "requiredRawInputs">> = {
  // 29. Avian Empire (Fulcrum Bank capital, windowless white granite spires)
  29: {
    factionId: 29,
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
      { goodId: 4, name: "Iron", count: 1 }
    ],
    outputPerBatch: 1,
    baseExportPrice: 120,
    artisanRole: "Avian Aerowright",
    artisanPersonaTag: "#AetherSkiffwright",
    progressRoleDescription: "Mandatory for establishing continental high-altitude cargo lines and sky patrols.",
    loreSecret: "The Avian Empire secretly owns the majority of the Gilded Compass through Fulcrum shell companies."
  },

  // 30. Heartland Alliance (The Continental Breadbasket)
  30: {
    factionId: 30,
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

  // 31. Flower Valley (Diplomatic Intelligence Swapped via Luxury Commerce)
  31: {
    factionId: 31,
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

  // 32. Free Sky-Baronies (Union Haulers & Outlaw Chapters)
  32: {
    factionId: 32,
    factionName: "Free Sky-Baronies",
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

  // 33. River Folk (Freshwater Fish-Folk & Traditional Shipwrights)
  33: {
    factionId: 33,
    factionName: "River Folk",
    goodId: 53,
    goodName: "Boats",
    uniqueGoodKey: "boats",
    category: "LOGISTICS",
    specialtyName: "Traditional Riverine Craftsmanship",
    harvestMethod: "Steaming river-oak timber and tarring joints with hemp cordage for shallow-draft river vessels",
    description: "Sturdy, shallow-draft riverboats, freight barges, and skiffs capable of traversing inland rapids and locks without grounding.",
    unit: "vessel",
    recipeInputs: [
      { goodId: 1, name: "Wood", count: 4 },
      { goodId: 32, name: "Tar", count: 2 },
      { goodId: 48, name: "Ropes", count: 2 }
    ],
    outputPerBatch: 1,
    baseExportPrice: 50,
    artisanRole: "River Folk Master Shipwright",
    artisanPersonaTag: "#RiverShipwright",
    progressRoleDescription: "Mandatory for establishing inland waterway freight routes and river ferry networks."
  },

  // 34. Iron Caldera (Master Smiths & Volcanic Smelters)
  34: {
    factionId: 34,
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

  // 35. Sump-Kin (Marshland Chemists & Bio-Alchemists)
  35: {
    factionId: 35,
    factionName: "Sump-Kin",
    goodId: 114,
    goodName: "Viper-Haze",
    uniqueGoodKey: "viper_haze",
    category: "HEALTH",
    specialtyName: "Marsh Alkaloid Distillation",
    harvestMethod: "Blending marsh botanicals and venomous extracts by purity grade in swamp distilleries",
    description: "Potent narcotic and pain-numbing compound; dramatically pacifies civil unrest in crisis burgs at the cost of gradual citizen vitality.",
    unit: "pouch",
    recipeInputs: [],
    outputPerBatch: 3,
    baseExportPrice: 16,
    artisanRole: "Sump-Kin Venom Brewer",
    artisanPersonaTag: "#SumpApothecary",
    progressRoleDescription: "High-value illicit and clinical narcotic; suppresses civil unrest while causing public health dependency."
  },

  // 36. Hive Commonwealth (Insectoid High-Altitude Architects)
  36: {
    factionId: 36,
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

  // 37. Grey Wardens (Patrollers of the 12 Dragon Flows and Ancient Prisons)
  37: {
    factionId: 37,
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

  // 38. Guerrilla Clans (Alpine Mountain Fighters)
  38: {
    factionId: 38,
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

  // 39. Vaneer Concord (Coastal Canals & Tidal Salt Works)
  39: {
    factionId: 39,
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

  // 40. Gilded Compass (The Cartel That Owns the Sky & Fulcrum Branch Network)
  40: {
    factionId: 40,
    factionName: "Gilded Compass",
    goodId: 62,
    goodName: "Aethercoin",
    uniqueGoodKey: "aetherium_coins",
    category: "LOGISTICS",
    specialtyName: "Shadowfall Twelve-Prime Minting",
    harvestMethod: "Striking gold bullion alloys with spent D-Dust during the dark silence of Shadowfall so coins lock and ring true",
    description: "Standardized Aetherium Coins backed by the Fulcrum Bank, minted in Shadowfall with locked twelve-prime resonance.",
    unit: "bag",
    recipeInputs: [
      { goodId: 8, name: "Gold", count: 0.5 },
      { goodId: 34, name: "Coal", count: 1 }
    ],
    outputPerBatch: 4,
    baseExportPrice: 30,
    artisanRole: "Hippo Master of Coin",
    artisanPersonaTag: "#MeridianAssayer",
    progressRoleDescription: "Mandatory for settling high-tonnage inter-faction treaties, charter loans, and customs clearance."
  },

  // 41. Coastal Theocracy (Deep Monastic Orders & Incense Chapels)
  41: {
    factionId: 41,
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

  // 42. Meridian Chain (Triton & Merfolk Reef Bridge-Towns)
  42: {
    factionId: 42,
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

  // 43. Sylvan Empire (The Great Northern Forest & Old-Growth Canopies)
  43: {
    factionId: 43,
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

  // 44. The Reliance (Quiet Mushroom-Folk Scholars of Generational Wisdom)
  44: {
    factionId: 44,
    factionName: "The Reliance",
    goodId: 108,
    goodName: "Aether-Clear",
    uniqueGoodKey: "aether_clear",
    category: "METAPHYSICAL",
    specialtyName: "Chaos-Resistant Compound Distillation",
    harvestMethod: "Slow biochemical extraction blending fermented ozone-milk with cave fungal enzymes",
    description: "Legendary translucent serum developed at the University of Reliance that insulates living tissue and stone against ambient chaos mutation.",
    unit: "vial",
    recipeInputs: [],
    outputPerBatch: 3,
    baseExportPrice: 25,
    artisanRole: "Mushroom-Folk Alchemist",
    artisanPersonaTag: "#RelianceCompounder",
    progressRoleDescription: "Mandatory for dampening chaos bleed in dense settlements and shielding workers near open leylines."
  },

  // 45. Devil's Island (Penal Colony of Exiled Soldiers & Forges)
  45: {
    factionId: 45,
    factionName: "Devil's Island",
    goodId: 34,
    goodName: "Coal",
    uniqueGoodKey: "coal",
    category: "ENERGY",
    specialtyName: "Volcanic Seam Excavation",
    harvestMethod: "Extracting anthracite coal deposits from volcanic caldera crevices with heavy penal convict crews",
    description: "High-grade coking coal with intense burn heat, vital for smelting weapons and firing aether-core furnaces and heavy foundries.",
    unit: "wain",
    recipeInputs: [],
    outputPerBatch: 8,
    baseExportPrice: 3,
    artisanRole: "Penal Pit Boss",
    artisanPersonaTag: "#VolcanicMiner",
    progressRoleDescription: "Mandatory fuel for smelting bronze, forging iron tools, and firing foundry crucibles."
  },

  // 46. Prism-Scale Collective (Crystal Resonators & Light Smiths)
  46: {
    factionId: 46,
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

  // 47. Opal-Wallow (Coastal Proxy-Bank Harbor & Aether-Coil Trade Workshops)
  47: {
    factionId: 47,
    factionName: "Opal-Wallow",
    goodId: 102,
    goodName: "Aether Coils",
    uniqueGoodKey: "aether_coils",
    category: "ADVANCED",
    specialtyName: "Twelve-Prime Induction Wire Spooling",
    harvestMethod: "Winding ultra-fine copper wire around twelve-prime inductors calibrated with dragonstone chips",
    description: "Precision induction coils that channel chaotic energy into shaped prime effects for drives, lamps, and civic wards.",
    unit: "coil",
    recipeInputs: [
      { goodId: 5, name: "Copper", count: 0.5 },
      { goodId: 72, name: "Dragonstone", count: 0.25 }
    ],
    outputPerBatch: 3,
    baseExportPrice: 14,
    artisanRole: "Opal-Wallow Core-Wright",
    artisanPersonaTag: "#AetherCoilWright",
    progressRoleDescription: "Mandatory component for assembling ship drives, Aether-Skiffs, and resonant ward coils."
  },

  // 48. Scute Confederacy (Reptilian Island Constructors & Cloud-Cutter Riders)
  48: {
    factionId: 48,
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

  // 49. Canopy Clans (The Verdant Tangle: Foxes, Monkeys, Pangolins, Tarsiers)
  49: {
    factionId: 49,
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

  // 50. Fuvuiku Legions (The Canyon Toll Authority & Mercenary Armada at Ivory Pass)
  50: {
    factionId: 50,
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
  },

  // 51. Port Sunder (Pelagic Fishermen & Oil Renderers)
  51: {
    factionId: 51,
    factionName: "Port Sunder",
    goodId: 35,
    goodName: "Oil",
    uniqueGoodKey: "oil",
    category: "ENERGY",
    specialtyName: "Pelagic Blubber & Oil Rendering",
    harvestMethod: "Boiling pelagic blubber in quayside iron caldrons to extract high-temperature lamp and machinery oil",
    description: "Refined pelagic animal oil essential for lubricating industrial machinery, fueling harbor lanterns, and firing incendiary siphons.",
    unit: "barrel",
    recipeInputs: [
      { goodId: 37, name: "Blubber", count: 1 }
    ],
    outputPerBatch: 4,
    baseExportPrice: 3,
    artisanRole: "Port Sunder Oil Renderer",
    artisanPersonaTag: "#WhaleOilBoiler",
    progressRoleDescription: "Mandatory fuel for machinery lubrication, flame projectors, and long-burning municipal street lamps."
  },

  // 52. Eastern Hounds (Barrow Keepers & Beast Breeders)
  52: {
    factionId: 52,
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

  // 53. Dust-Husk Riders (Chasm Nomads: Beetles, Moths, Spiders, Scorpions)
  53: {
    factionId: 53,
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

  // 54. Ursine Hegemony (Bear-Folk Mountain Colleges & Precision Workshops)
  54: {
    factionId: 54,
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
  }
};

export const FACTION_SPECIALTIES: Record<number, FactionSpecialty> = (() => {
  const result: Record<number, FactionSpecialty> = {};
  for (const [id, s] of Object.entries(RAW_SPECIALTIES)) {
    result[Number(id)] = {
      ...s,
      uniqueGood: s.uniqueGoodKey,
      uniqueGoodName: s.goodName,
      requiredRawInputs: s.recipeInputs && s.recipeInputs.length > 0
        ? s.recipeInputs.map((r) => ({ resource: goodKeyFromName(r.name), count: r.count }))
        : []
    };
  }
  return result;
})();

/** Returns all unique good keys belonging to a specific category. */
export function getGoodsByCategory(category: CommodityCategory): string[] {
  return Object.values(FACTION_SPECIALTIES)
    .filter((f) => f.category === category)
    .map((f) => f.uniqueGoodKey);
}

/** Fetch a specialty by Ostraka faction ID or case-insensitive faction name. */
export function getFactionSpecialty(factionIdOrName: number | string): FactionSpecialty {
  const fallback = FACTION_SPECIALTIES[30]!;
  if (typeof factionIdOrName === "number") {
    return FACTION_SPECIALTIES[factionIdOrName] || fallback;
  }

  const query = String(factionIdOrName || "").trim().toLowerCase();
  if (!query) return fallback;
  const matched = Object.values(FACTION_SPECIALTIES).find(
    (f) =>
      f.factionName.toLowerCase() === query ||
      f.factionName.toLowerCase().includes(query) ||
      query.includes(f.factionName.toLowerCase())
  );

  return matched || fallback;
}
