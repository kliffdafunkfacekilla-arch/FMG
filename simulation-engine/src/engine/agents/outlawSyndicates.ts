import { Pool, PoolClient } from "pg";

export interface OutlawSyndicateDef {
  id: number;
  name: string;
  type: string;
  originBurgId: number;
  originCellId: number;
  originFactionId: number;
  bossName: string;
  bossTitle: string;
  bossTraits: Array<{ name: string; modifier: number }>;
  description: string;
  contrabandTypes: string[];
  lairTypes: string[];
  speciesDistribution: Array<{ species: string; weight: number }>;
  uniqueRoles: Array<{
    role: string;
    weapon: string;
    armor: string;
    affinity: string;
    inventory: string[];
    instinct: string;
    temper: string;
  }>;
}

export const OUTLAW_SYNDICATES: OutlawSyndicateDef[] = [
  {
    id: 1,
    name: "The Gilded Compass",
    type: "MERCHANT_PRIVATEER_FLEET",
    originBurgId: 338, // Peculiurus Spire
    originCellId: 21143,
    originFactionId: 3,
    bossName: "High Factor Cassian Midas",
    bossTitle: "Archon of the Meridian Ledger",
    bossTraits: [
      { name: "Calculated", modifier: 0.3 },
      { name: "Hippo_Admiral", modifier: 0.5 },
      { name: "Bribery_Master", modifier: 0.4 },
      { name: "Market_Manipulator", modifier: 0.4 }
    ],
    description: "Formidable armed merchant fleet and naval privateers always captained by Hippo-Kin. Establishes public, unhidden trade yards in foreign territories near major trade routes, offers commercial freight and passenger transport, enforces naval policing and customs inspections, and blockades trade routes to manipulate market flow.",
    contrabandTypes: ["Impounded Foreign Cargo", "Forged Sovereign Letters of Marque", "Clipped Meridian Bullion", "Price-Fixed Grain Manifests"],
    lairTypes: ["PUBLIC_TRADE_YARD", "SHIPPING_DEPOT"],
    speciesDistribution: [{ species: "Hippo", weight: 0.8 }, { species: "Walrus", weight: 0.1 }, { species: "Human", weight: 0.1 }],
    uniqueRoles: [
      {
        role: "Hippo Fleet Captain",
        weapon: "Heavy Gold-Embossed Broadsword & Marine Flintlock",
        armor: "Gilded Naval Scale-Cuirass",
        affinity: "might",
        inventory: ["Letter of Reprisal", "Brass Meridian Sextant", "Pouch of 120 Gold Sovereign Coins"],
        instinct: "AUTHORITATIVE",
        temper: "CALCULATED"
      },
      {
        role: "Meridian Trade Factor",
        weapon: "Concealed Bodkin & Weighted Steel Abacus",
        armor: "Velvet Doublet with Hidden Mail",
        affinity: "logic",
        inventory: ["Shipping Manifest Ledger", "Price-Fixing Writs", "Pouch of 75 Silver"],
        instinct: "METICULOUS",
        temper: "COLD"
      }
    ]
  },
  {
    id: 2,
    name: "The Free Sky-Barons",
    type: "AERIAL_SMUGGLER_PRIVATEER",
    originBurgId: 330, // Zeveed
    originCellId: 2179,
    originFactionId: 25,
    bossName: "Commodore Vaelis Skystrider",
    bossTitle: "Master of the Cloud Fleet",
    bossTraits: [
      { name: "Daring", modifier: 0.4 },
      { name: "Smuggler", modifier: 0.5 },
      { name: "Airship_Ace", modifier: 0.4 },
      { name: "Cloud_Stalker", modifier: 0.4 }
    ],
    description: "High-altitude corsairs and independent airship captains operating from secret aeries. Offers stealth transport for goods and passengers beneath cloud ceilings, ambushes rival airships when holding tactical advantage, and brands prospected recruits on their core drive at the Verge Sky Dock.",
    contrabandTypes: ["Branded Core-Drive Cells", "Smuggled Aerolith Charges", "Barred Flight Charts", "Clandestine Passenger Manifests"],
    lairTypes: ["SECRET_AERIE_YARD", "VERGE_SKY_DOCK"],
    speciesDistribution: [{ species: "Human", weight: 0.4 }, { species: "Avian", weight: 0.4 }, { species: "Felid", weight: 0.2 }],
    uniqueRoles: [
      {
        role: "Prospected Sky Captain (Branded Core)",
        weapon: "Pneumatic Harpoon Rifle & Cutlass",
        armor: "Branded Cloud-Leather Coat",
        affinity: "reflex",
        inventory: ["Branded Core-Drive Key", "High-Altitude Goggles", "Pouch of 65 Sky-Marks"],
        instinct: "DARING",
        temper: "RECKLESS"
      },
      {
        role: "Stealth Cloud-Skiff Helmsman",
        weapon: "Twin Repeating Hand-Crossbows",
        armor: "Muffled Wind-Silk Jerkin",
        affinity: "finesse",
        inventory: ["Cloud-Compass", "Muffled Aether Dampener", "Pouch of 45 Silver"],
        instinct: "ELUSIVE",
        temper: "VIGILANT"
      }
    ]
  },
  {
    id: 3,
    name: "The Fuvuiku Legions",
    type: "MERCENARY_ARMADA_AND_TOLL",
    originBurgId: 344, // Ivory Pass
    originCellId: 27068,
    originFactionId: 26,
    bossName: "High Commander Malakor Dread",
    bossTitle: "Warlord of the Ivory Pass",
    bossTraits: [
      { name: "Mercenary_Master", modifier: 0.5 },
      { name: "Drillmaster", modifier: 0.5 },
      { name: "Toll_Enforcer", modifier: 0.4 },
      { name: "Iron_Discipline", modifier: 0.4 }
    ],
    description: "Formed by the Goats and Rhinos of the Ivory Pass who ambushed a trade wing in the canyon, forced captured engineers to teach them flight, and absorbed the Crimson Corsairs under Captain Valerius. Holding the three tall peaks in the southern channel—the only pass ships can cross below the Avian peaks—they operate a mercenary armada and canyon toll blockade with flat fees and iron escorts: 'The Sky Belongs to No Bank'.",
    contrabandTypes: ["Seized Merchant Tithes", "Unregistered Legion Pikes", "Heavy Catapult Munitions", "Blood Contract Seals", "Forged Ivory Pass Writs"],
    lairTypes: ["TOLL_BLOCKADE", "MERC_TRADE_BASTION", "IVORY_PASS_CITADEL"],
    speciesDistribution: [{ species: "Goat", weight: 0.4 }, { species: "Rhino", weight: 0.4 }, { species: "Human", weight: 0.2 }],
    uniqueRoles: [
      {
        role: "Legion Drill Centurion",
        weapon: "Barbed Halberd & Heavy Iron Pavise",
        armor: "Reinforced Full Steel Plate",
        affinity: "might",
        inventory: ["Legion Drill Whistle", "Drill Training Manual", "Pouch of 90 Heavy Denarii"],
        instinct: "UNFLINCHING",
        temper: "DISCIPLINED"
      },
      {
        role: "Ivory Pass Toll Enforcer",
        weapon: "Heavy Spiked Pilum & Tower Shield",
        armor: "Corroded Legionary Lorica",
        affinity: "fortitude",
        inventory: ["Confiscated Caravanserai Toll Passes", "Brass Weighing Scale", "Pouch of 70 Imperial Denarii"],
        instinct: "EXACTING",
        temper: "INFLEXIBLE"
      }
    ]
  },
  {
    id: 4,
    name: "The Silk-Sovereign Syndicate",
    type: "VICE_AND_PROTECTION_ARM",
    originBurgId: 340, // Forgespire
    originCellId: 13802,
    originFactionId: 7, // Part of the Obsidian Syndicate Network
    bossName: "Madam Sylvira Night-Loom",
    bossTitle: "Matron of the Silk-Sovereign",
    bossTraits: [
      { name: "Vice_Matron", modifier: 0.5 },
      { name: "Ruthless", modifier: 0.5 },
      { name: "Protection_Broker", modifier: 0.4 },
      { name: "Street_Justice", modifier: 0.4 }
    ],
    description: "The women-led vice, extortion, and street protection wing of the Obsidian Syndicate Network. While the parent Obsidian Cartel handles clean municipal fronts, relic fencing, and high-level oligarch politics, the Silk-Sovereign Syndicate operates the vice dens, underground gambling halls, pleasure houses, and narcotics distribution (Viper-Haze), enforcing brutal public 'justice' to keep the Deep Hall Engine insulated from street blowback.",
    contrabandTypes: ["Euphoric Viper-Haze Narcotics", "Loaded Bone Dice & Marked Decks", "Vice Ledger Blackmail", "Protection Warrants"],
    lairTypes: ["VICE_DEN", "GAMBLING_HALL", "PLEASURE_HOUSE", "NARCOTIC_PARLOR"],
    speciesDistribution: [{ species: "Human", weight: 0.4 }, { species: "Saurian", weight: 0.3 }, { species: "Armadillo", weight: 0.3 }],
    uniqueRoles: [
      {
        role: "Silk-Sovereign Vice Mistress",
        weapon: "Concealed Bodkin & Poisoned Hairpin",
        armor: "Embroidered Shrouded Silk Gown",
        affinity: "charm",
        inventory: ["Black Book of Municipal Secrets", "Phial of Viper-Haze", "Pouch of 85 Silver & Gold"],
        instinct: "ENTICING",
        temper: "COLD"
      },
      {
        role: "Street Justice Enforcer",
        weapon: "Weighted Lead Sledge & Spiked Cestus",
        armor: "Reinforced Quilted Gambeson",
        affinity: "might",
        inventory: ["Protection Debt Ledger", "Iron Knuckledusters", "Pouch of 50 Silver"],
        instinct: "INTIMIDATING",
        temper: "RUTHLESS"
      }
    ]
  },
  {
    id: 5,
    name: "The Ghostwind Raiders",
    type: "PHANTOM_PRIVATEER",
    originBurgId: 115, // Port Sunder
    originCellId: 24364,
    originFactionId: 1, // Guerrilla Clans
    bossName: "Corsair Queen Lyra Ghostwind",
    bossTitle: "Captain of The Ghostwind",
    bossTraits: [
      { name: "Guerrilla_Loyalist", modifier: 0.5 },
      { name: "Phantom_Aeronaut", modifier: 0.5 },
      { name: "Dead_Drop_Broker", modifier: 0.4 },
      { name: "Elusive", modifier: 0.5 }
    ],
    description: "A single legendary ghost airship, The Ghostwind, operating from one covert hidden cove in Guerrilla Clan lands. Contracts via dead drops from 4 major sovereign powers—none of whom realize they are all hiring the same vessel to raid each other in a circle, nor that it's hitting them too! Once a season, executes a phantom strike where least expected, subdues the crew, loots the ship down to its bare hull, and leaves a single captive capable of freeing themselves after hours. Seized gold is routed back to the Guerrilla Clans, while the larger portion is dead-dropped to outer rural burgs where local smugglers distribute it.",
    contrabandTypes: ["Phantom Muffled Sails", "Dead-Drop Seal Cylinders", "Stripped Convoy Cargo", "Smuggled Arms for Guerrilla Clans"],
    lairTypes: ["CLAN_COVERT_COVE"],
    speciesDistribution: [{ species: "Human", weight: 0.4 }, { species: "Seal", weight: 0.3 }, { species: "Otter", weight: 0.3 }],
    uniqueRoles: [
      {
        role: "Ghostwind Rigging-Phantom",
        weapon: "Dual Serrated Boarding Sabres & Silk Choke-Cord",
        armor: "Muffled Oilcloth & Shrouded Chain Jerkin",
        affinity: "reflex",
        inventory: ["Concealed Guerrilla Clan Sigil", "Boarding Grapple", "Pouch of 60 Plundered Gold"],
        instinct: "FEROCIOUS",
        temper: "DEVOUT"
      },
      {
        role: "Dead-Drop Shadow Courier",
        weapon: "Silent Repeating Crossbow & Flint Dagger",
        armor: "Camouflaged Travel Leathers",
        affinity: "awareness",
        inventory: ["Wax-Sealed Dead Drop Cylinder", "Ciphered Quad-Court Manifest", "Pouch of 40 Silver"],
        instinct: "TACTICAL",
        temper: "STOIC"
      }
    ]
  },
  {
    id: 6,
    name: "The Obsidian Cartel",
    type: "UNDERWORLD_ENGINE",
    originBurgId: 340, // Forgespire
    originCellId: 13802,
    originFactionId: 7, // Iron Caldera (Deep Hall Engine)
    bossName: "Baroness Vespera Blackglass",
    bossTitle: "Regional Guide of the Deep Hall",
    bossTraits: [
      { name: "Deep_Hall_Factor", modifier: 0.5 },
      { name: "Oligarch_Allied", modifier: 0.5 },
      { name: "Relic_Fence", modifier: 0.4 },
      { name: "Calculating", modifier: 0.4 }
    ],
    description: "The elite relic-fencing, black-market arms, and sabotage arm of the Obsidian Syndicate Network, operating from the Deep Hall. Maintaining strict municipal respectability, the Cartel interfaces with magistrates and oligarchs through diverse, legitimate business fronts (licensed apothecaries, gem exchanges, counting houses, spice emporiums), delegating all street vice and narcotics down to the Silk-Sovereign Syndicate.",
    contrabandTypes: ["Pre-Cruor Titan Relics", "Unregistered Black-Glass Arms", "Magistrate Bribe Bonds", "Sabotage Blueprints"],
    lairTypes: ["LICENSED_APOTHECARY_FRONT", "GEM_EXCHANGE_FRONT", "COUNTING_HOUSE_FRONT", "SUBTERRANEAN_TUNNEL_FLUE"],
    speciesDistribution: [{ species: "Human", weight: 0.4 }, { species: "Saurian", weight: 0.3 }, { species: "Armadillo", weight: 0.3 }],
    uniqueRoles: [
      {
        role: "Cartel Front Merchant (Magistrate's Confidant)",
        weapon: "Concealed Obsidian Stiletto & Ring-Blade",
        armor: "Tailored Silk Robe with Secret Pockets",
        affinity: "charm",
        inventory: ["Licensed Apothecary Deed", "Bribed Magistrate Letter", "Pouch of 110 Caldera Gold"],
        instinct: "CALCULATED",
        temper: "SUAVE"
      },
      {
        role: "Deep Hall Tunnel Sapper",
        weapon: "Serrated Trench Pick & Heavy Mattock",
        armor: "Heavy Basalt Miner's Apron",
        affinity: "might",
        inventory: ["Smuggling Tunnel Map", "Gatehouse Skeleton Key", "Pouch of 45 Silver"],
        instinct: "STEALTHY",
        temper: "STOIC"
      }
    ]
  },
  {
    id: 7,
    name: "The Otters (Canal Krewes)",
    type: "CANAL_KREWE_MOB",
    originBurgId: 170, // Lake City
    originCellId: 31865,
    originFactionId: 8, // Heartlands fringe
    bossName: "Don Finnegan 'Slick-Whiskers' Sliptide",
    bossTitle: "Grand Godfather of the Canal Krewes",
    bossTraits: [
      { name: "Cunning", modifier: 0.5 },
      { name: "Lutrine_Boss", modifier: 0.5 },
      { name: "Underwater_Extraction", modifier: 0.5 },
      { name: "Tavern_Intelligence", modifier: 0.4 }
    ],
    description: "A separate fringe people living along Heartland and waterway margins—they are NOT River Folk! Smiling barge pilots and dockworkers by day, their Canal Krewes do wet-work (smuggling, extraction, surveillance) and serve as the Heartlands' unofficial intelligence agency. Operating ghost barges and lantern-lit dens on stilts over water thick with Marsh-Weed smoke, they live by the creed: 'The River always takes its cut'.",
    contrabandTypes: ["Smuggler's Plates", "Ghost-Barge Contraband", "Canal Krewe Dossiers", "Vintage Eel-Wine"],
    lairTypes: ["WATER_STILT_DEN", "GHOST_BARGE_MOORING", "SMUGGLERS_FLUME"],
    speciesDistribution: [{ species: "Otter", weight: 0.9 }, { species: "Frog", weight: 0.1 }],
    uniqueRoles: [
      {
        role: "Canal Krewe Informant",
        weapon: "Concealed Brass Spigot & Fish-Gutting Dirk",
        armor: "Waterproof Long Trench Coat with River-Bird Feather",
        affinity: "charm",
        inventory: ["Smuggler's Plate", "Jug of Marsh-Weed Liquor", "Pouch of 60 Polished River Coins"],
        instinct: "SLICK",
        temper: "CONVIVIAL"
      },
      {
        role: "Ghost Barge Flume Diver",
        weapon: "Pneumatic Harpoon & Heavy Net",
        armor: "Waterproof Treated Otter-Hide Diving Suit",
        affinity: "endurance",
        inventory: ["Reed Breathing Tube", "Submerged Salvage Hook", "Pouch of 45 Silver"],
        instinct: "AMPHIBIOUS",
        temper: "STOIC"
      }
    ]
  },
  {
    id: 8,
    name: "The Ghostspring Subterrane",
    type: "OUTCAST_RIVERFOLK_SMUGGLERS",
    originBurgId: 73, // Flute (Central Mountain Range)
    originCellId: 13408,
    originFactionId: 26, // River Folk lineage
    bossName: "Mother Nilura Pale-Skin",
    bossTitle: "Matriarch of the Under-Springs",
    bossTraits: [
      { name: "Subterranean_Amphibian", modifier: 0.5 },
      { name: "Mountain_Smuggler", modifier: 0.5 },
      { name: "Haunted_Legend", modifier: 0.4 },
      { name: "Pale_Skin", modifier: 0.4 }
    ],
    description: "A single close-knit tribe of outcast Riverfolk dwelling in deep subterranean caves beneath the mainland's central mountain range. Flooded cavern flues connect geothermal hot springs on both sides of the continental mountain barrier, allowing them to swim beneath the peaks to retrieve and drop cargo. Their chalk-pale white skin from lifelong underground isolation started local ghost stories and legends of the misty springs being haunted. But the Obsidian Cartel and the Free Sky-Barons know they are not ghosts, contracting them as mountain bypass smugglers.",
    contrabandTypes: ["Trans-Mountain Smuggled Goods", "Hot-Spring Mineral Salts", "Waterproof Pitch-Casks", "Subterranean Flue Maps"],
    lairTypes: ["CENTRAL_PEAK_SPRING_CAVERN"],
    speciesDistribution: [{ species: "Riverfolk", weight: 0.8 }, { species: "Human", weight: 0.1 }, { species: "Otter", weight: 0.1 }],
    uniqueRoles: [
      {
        role: "Pale-Skin Flue Swimmer",
        weapon: "Bone Harpoon & Flint Dive Knife",
        armor: "Treated Waterproof Eel-Skin Mantle",
        affinity: "endurance",
        inventory: ["Pitch-Sealed Waterproof Cask", "Luminescent Cave Moss Phial", "Pouch of 50 Mountain-Smuggled Gold"],
        instinct: "ELUSIVE",
        temper: "SILENT"
      },
      {
        role: "Under-Spring Cargo Courier",
        weapon: "Submerged Speargun & Obsidian Choke-Hook",
        armor: "Subterranean Calcium-Stained Leathers",
        affinity: "reflex",
        inventory: ["Obsidian Cartel Smuggling Token", "Sky-Baron Freight Tag", "Pouch of 40 Silver"],
        instinct: "VIGILANT",
        temper: "STOIC"
      }
    ]
  },
  {
    id: 9,
    name: "The Grind Canyon Corps",
    type: "NOMADIC_CHASM_HUNTERS",
    originBurgId: 343, // Anvil Roosts
    originCellId: 23152,
    originFactionId: 15, // Dust-Husk Riders
    bossName: "Overman Torvald Gravel-Maw",
    bossTitle: "Foreman of the Caravan Trenches",
    bossTraits: [
      { name: "Chasm_Caravan_Master", modifier: 0.5 },
      { name: "Treasure_Hound", modifier: 0.5 },
      { name: "Relic_Excavator", modifier: 0.4 },
      { name: "Greedy", modifier: 0.4 }
    ],
    description: "A loose, self-populating gypsy-like caravan community of chasm divers and treasure hunters. They only pitch camp around an active grinding canyon while working it (never more than 3 active in the world at once). When stationed near a canyon, their wild crews flood the nearest burg with raw dragonstone cash, wild tavern brawls, and municipal corruption until the chasm slams shut.",
    contrabandTypes: ["Uncut Chasm Dragonstone", "Pre-Cruor Titan Relics", "Heavy Blasting Caps", "Unregistered Smelted Slag"],
    lairTypes: ["CHASM_DIVE_CAMP"],
    speciesDistribution: [{ species: "Wolf-Kin", weight: 0.4 }, { species: "Saurian", weight: 0.3 }, { species: "Human", weight: 0.3 }],
    uniqueRoles: [
      {
        role: "Caravan Chasm Diver",
        weapon: "Two-Handed Pneumatic Trench Sledge & Pick",
        armor: "Welded Scrap-Iron Harness & Heavy Rope",
        affinity: "might",
        inventory: ["Titan Relic Fragment", "Chasm Winch Harness", "Pouch of 75 Raw Dragonstone Nuggets"],
        instinct: "FEARLESS",
        temper: "BOISTEROUS"
      },
      {
        role: "Caravan Quartermaster & Fence",
        weapon: "Barbed Chain-Whip & Heavy Cleaver",
        armor: "Greasy Bull-Hide Apron & Brass Scales",
        affinity: "finesse",
        inventory: ["Caravan Cashbox Key", "Assayer's Streak-Plate", "Pouch of 90 Gold"],
        instinct: "SHREWD",
        temper: "ROWDY"
      }
    ]
  },
  {
    id: 10,
    name: "The Hedge Wizards",
    type: "NOMADIC_ENTERTAINERS_AND_CHARM_PEDDLERS",
    originBurgId: 241, // Vulpus-Prime
    originCellId: 14380,
    originFactionId: 14, // Canopy Clans
    bossName: "Malidore Thorn-Weaver",
    bossTitle: "Ringmaster of the Wonder-Wander Troupe",
    bossTraits: [
      { name: "Wild_Spark", modifier: 0.5 },
      { name: "Carnival_Showman", modifier: 0.5 },
      { name: "Charm_Peddler", modifier: 0.4 },
      { name: "Solitary_Nomad", modifier: 0.4 }
    ],
    description: "Solitary nomadic snake-oil salesmen, bards, entertainers, and tinkerers (mending pots, sharpening knives, and peddling luck pebbles and bramble charms). They never team up or form covens. The sole exception is 'The Wonder-Wander Troupe'—a traveling carnival of eccentric hedge mages, fire-eaters, and acrobats who frequent each sovereign faction once a year to perform, spread joy, and peddle wonders.",
    contrabandTypes: ["Unsealed Wild-Spark Charms", "Curative Bramble Poultices", "Faulty Luck-Pebbles", "Carnival Curios"],
    lairTypes: ["TRAVELING_CIRCUS_CARAVAN"],
    speciesDistribution: [{ species: "Human", weight: 0.5 }, { species: "Plant-Folk", weight: 0.3 }, { species: "Peacock", weight: 0.2 }],
    uniqueRoles: [
      {
        role: "Wandering Bard & Knife-Sharpener",
        weapon: "Worn Lute, Flint Wheel & Honing Stiletto",
        armor: "Patchwork Travel Cloak & Burlap Pack",
        affinity: "charm",
        inventory: ["Honing Stone", "Peddled Luck Pebbles", "Pouch of 25 Copper & Silver"],
        instinct: "ENTERTAINING",
        temper: "ECCENTRIC"
      },
      {
        role: "Wonder-Wander Acrobat-Mage",
        weapon: "Pyrotechnic Flash-Rod & Ribbon Daggers",
        armor: "Silk Harlequin Tunic & Spangled Boots",
        affinity: "reflex",
        inventory: ["Spun Glass Spark-Orb", "Circus Handbill", "Pouch of 35 Shiny Silver Coins"],
        instinct: "PLAYFUL",
        temper: "FLAMBOYANT"
      }
    ]
  }
];

export function getCartelDef(idOrName: number | string): OutlawSyndicateDef | undefined {
  if (typeof idOrName === "number") {
    return OUTLAW_SYNDICATES.find(s => s.id === idOrName);
  }
  const query = idOrName.toLowerCase();
  return OUTLAW_SYNDICATES.find(s => s.name.toLowerCase().includes(query) || s.type.toLowerCase() === query);
}

export function getCartelLairType(cartel: any): string {
  const id = Number(cartel.id);
  const def = getCartelDef(id) || getCartelDef(String(cartel.name || ""));
  if (def && def.lairTypes.length > 0) {
    const pick = Math.floor(Math.random() * def.lairTypes.length);
    return def.lairTypes[pick] || "BLACK_MARKET";
  }
  return cartel.type === "SMUGGLER" ? "BLACK_MARKET" : "VICE_DEN";
}

export function getLairPropDetails(lair: any) {
  const cartelName = lair.cartel_name || "Underworld Syndicate";
  const lairType = lair.lair_type || "BLACK_MARKET";

  switch (lairType) {
    case "PUBLIC_TRADE_YARD":
      return {
        name: `Gilded Compass Public Trade Yard (${cartelName})`,
        tags: ["wood", "stone", "harbor", "trade_yard", "public", "gilded_compass"],
        hp: 240,
        maxHp: 240,
        description: "Sprawling open-air public trade yard and wharf equipped with merchant cranes, weigh-scales, and armed Hippo-Kin marines."
      };
    case "SHIPPING_DEPOT":
      return {
        name: `Meridian Freight Shipping Depot (${cartelName})`,
        tags: ["wood", "stone", "depot", "cargo", "public"],
        hp: 200,
        maxHp: 200,
        description: "Authorized commercial cargo transfer depot with weighing stations and public merchant offices."
      };
    case "SECRET_AERIE_YARD":
      return {
        name: `Secret Sky-Baron Aerie Yard (${cartelName})`,
        tags: ["wood", "airship", "secret", "smuggler", "underworld"],
        hp: 170,
        maxHp: 170,
        description: "Camouflaged cliffside airship mooring and cargo gantry hidden within cloud formations."
      };
    case "VERGE_SKY_DOCK":
      return {
        name: `The Verge Capital Sky Dock & Core Forge (${cartelName})`,
        tags: ["metal", "airship", "capital_dock", "core_drive", "sky_dock"],
        hp: 300,
        maxHp: 300,
        description: "A decommissioned dreadnought airship turned permanent sky dock near the Verge, featuring an aether branding forge for recruited captains."
      };
    case "COASTAL_PEAK_YARD":
      return {
        name: `Legion Twin-Peak Coastal Bastion & Capital Yard (${cartelName})`,
        tags: ["stone", "metal", "fortress", "coastal", "mountain", "legion"],
        hp: 350,
        maxHp: 350,
        description: "Imposing twin mountain-peak fortress overlooking coastal trade lanes, bristling with heavy ballistas, training grounds, and armed merchant docks."
      };
    case "MERC_TRADE_BASTION":
      return {
        name: `Legion Armed Forward Trade Bastion (${cartelName})`,
        tags: ["stone", "metal", "trade_yard", "bastion", "mercenary"],
        hp: 260,
        maxHp: 260,
        description: "Heavily fortified forward trade bastion established without municipal consent, defended by disciplined legion shock-troopers."
      };
    case "SECRET_AIRSHIP_HANGAR":
      return {
        name: `Covert Ghostwind Airship Hangar (${cartelName})`,
        tags: ["stone", "airship", "hangar", "secret", "guerrilla"],
        hp: 220,
        maxHp: 220,
        description: "Subterranean cliff hangar housing silent black-sailed airships secretly flying for the Guerrilla Clans."
      };
    case "CLAN_COVERT_REDOUBT":
      return {
        name: `Guerrilla Clan Hidden Redoubt (${cartelName})`,
        tags: ["wood", "stone", "guerrilla", "secret", "mercenary"],
        hp: 180,
        maxHp: 180,
        description: "Clandestine weapon depot and staging post routing mercenary spoils directly to Guerrilla Clan fighters."
      };
    case "BUSINESS_FRONT":
    case "LICENSED_APOTHECARY_FRONT":
      return {
        name: `Licensed Apothecary & Spice Front (${cartelName})`,
        tags: ["wood", "stone", "shop", "front", "legitimate", "apothecary"],
        hp: 190,
        maxHp: 190,
        description: "High-end, fully licensed herbal apothecary masking subterranean Deep Hall meeting rooms and magistrate backrooms."
      };
    case "GEM_EXCHANGE_FRONT":
      return {
        name: `Caldera Gem Exchange & Assayers (${cartelName})`,
        tags: ["stone", "metal", "shop", "front", "legitimate", "exchange"],
        hp: 220,
        maxHp: 220,
        description: "Prestigious gemstone cutting salon and gold assay desk facilitating high-level municipal money laundering."
      };
    case "COUNTING_HOUSE_FRONT":
      return {
        name: `Municipal Charter & Counting House (${cartelName})`,
        tags: ["stone", "books", "front", "legitimate", "bank"],
        hp: 210,
        maxHp: 210,
        description: "Authorised charter office where Deep Hall factors review sovereign municipal debt and negotiate magistrate favors."
      };
    case "VICE_DEN":
    case "NARCOTIC_PARLOR":
      return {
        name: `Silk-Sovereign Velvet Vice Den (${cartelName})`,
        tags: ["cloth", "wood", "vice_den", "narcotics", "underworld", "flammable"],
        hp: 140,
        maxHp: 140,
        description: "Heavily draped, dimly lit velvet parlor distributing Viper-Haze and illicit dream-draughts to high-paying patrons."
      };
    case "GAMBLING_HALL":
      return {
        name: `Silk-Sovereign Gilded Dice Hall (${cartelName})`,
        tags: ["wood", "table", "dice", "underworld", "gambling"],
        hp: 160,
        maxHp: 160,
        description: "Underground gaming hall with loaded bone dice, marked cards, and private loan rooms enforcing brutal street interest."
      };
    case "PLEASURE_HOUSE":
      return {
        name: `Silk-Sovereign Pleasure Pavilion (${cartelName})`,
        tags: ["cloth", "silk", "pleasure", "underworld", "vice"],
        hp: 150,
        maxHp: 150,
        description: "Opulent subterranean pleasure house insulated from city watch raids through layered bribes and magistrate protection."
      };
    case "IVORY_PASS_CITADEL":
    case "TOLL_BLOCKADE":
      return {
        name: `Fuvuiku Legion Mountain Toll Citadel (${cartelName})`,
        tags: ["stone", "metal", "fortress", "gate", "toll", "legion"],
        hp: 350,
        maxHp: 350,
        description: "Massive stone checkpoint straddling the canyon pass, guarded by armored Goat and Rhino legionaries enforcing sky tolls."
      };
    case "WATER_STILT_DEN":
      return {
        name: `Canal Krewe Stilt Den (${cartelName})`,
        tags: ["wood", "water", "stilt", "den", "smuggler", "otter"],
        hp: 170,
        maxHp: 170,
        description: "Lantern-lit wooden den built on stilts over murky canal waters, thick with Marsh-Weed smoke and harmonica music."
      };
    case "GHOST_BARGE_MOORING":
      return {
        name: `Covert Ghost-Barge Mooring (${cartelName})`,
        tags: ["wood", "water", "boat", "smuggler", "container"],
        hp: 180,
        maxHp: 180,
        description: "Concealed water slip hidden under weeping willows where dark-painted ghost barges transfer contraband without tariffs."
      };
    case "SUBTERRANEAN_TUNNEL_FLUE":
      return {
        name: `Subterranean Smuggling Tunnel & Gate Bypass (${cartelName})`,
        tags: ["stone", "tunnel", "subterranean", "smuggler", "locked"],
        hp: 180,
        maxHp: 180,
        description: "Reinforced underground flue burrowed beneath burg fortifications to smuggle weapons, narcotics, and assassins."
      };
    case "BRIBED_GATE_VAULT":
      return {
        name: `Bribed Municipal Gatehouse Safehouse (${cartelName})`,
        tags: ["metal", "gate", "bribe", "vault", "underworld"],
        hp: 200,
        maxHp: 200,
        description: "Hidden storehouse directly adjacent to the city gates, secured by paid-off watch sergeants."
      };
    case "ROADSIDE_HEDGE_WAGON":
      return {
        name: `Solitary Hedge Wizard Roadside Wagon (${cartelName})`,
        tags: ["wood", "cloth", "wagon", "nomad", "arcane", "peddler"],
        hp: 110,
        maxHp: 110,
        description: "Weather-worn gypsy wagon smelling of dried bramble and wild spark-smoke, peddling dubious charms to passing commoners."
      };
    case "WILD_BRAMBLE_CAMP":
      return {
        name: `Wandering Sparkborn Bramble Camp (${cartelName})`,
        tags: ["wood", "nature", "camp", "nomad", "solitary"],
        hp: 90,
        maxHp: 90,
        description: "A simple roadside lean-to where an unsanctioned hedge wizard rests between rural burgs."
      };
    case "OBSIDIAN_VAULT":
      return {
        name: `Obsidian Cartel Deep Vault & Shard Cache (${cartelName})`,
        tags: ["stone", "obsidian", "vault", "underworld", "locked", "fire"],
        hp: 200,
        maxHp: 200,
        description: "Fortified subterranean basalt chamber shielded with raw obsidian tiles, safeguarding illicit chaos crystals and void-glass blades."
      };
    case "BLACK_GLASS_FOUNDRY":
      return {
        name: `Clandestine Black-Glass Forge & Bellows (${cartelName})`,
        tags: ["stone", "fire", "forge", "obsidian", "metal", "crafting"],
        hp: 175,
        maxHp: 175,
        description: "Heat-shrouded illicit furnace smelting scorched dragon-slag into razor-sharp obsidian weaponry."
      };
    case "RIVERBOAT_CASINO":
      return {
        name: `The Whispering Otter Floating Casino & Speakeasy (${cartelName})`,
        tags: ["wood", "water", "tavern", "casino", "underworld", "flammable"],
        hp: 160,
        maxHp: 160,
        description: "Moored twin-hulled barge featuring high-stakes river dice, private loan parlors, and barrels of smuggled fermented eel-wine."
      };
    case "SMUGGLERS_FLUME":
      return {
        name: `Lutrine Submerged Flume & Canal Dead-Drop (${cartelName})`,
        tags: ["stone", "water", "flume", "smuggler", "underworld", "container"],
        hp: 150,
        maxHp: 150,
        description: "Concealed underwater grating and pulley system allowing Lutrine divers to transfer illicit cargo past harbour guards undetected."
      };
    case "CENTRAL_PEAK_SPRING_CAVERN":
      return {
        name: `Ghostspring Subterranean Cavern & Thermal Pool (${cartelName})`,
        tags: ["stone", "water", "cave", "hot_spring", "underworld", "subterranean"],
        hp: 280,
        maxHp: 280,
        description: "Steaming limestone cavern deep beneath the continental mountain divide, connecting flooded subterranean flues and hot springs on both sides of the peaks."
      };
    case "GHOSTSPRING_DISTILLERY":
      return {
        name: `Ghostspring Geothermal Alchemical Still (${cartelName})`,
        tags: ["stone", "water", "alchemy", "poison", "underworld", "fragile"],
        hp: 140,
        maxHp: 140,
        description: "Muffled copper condensery tapping geothermal steam vents to distill untraceable ghost-water draughts and paralytic vapors."
      };
    case "SHADOW_LISTENING_POST":
      return {
        name: `Clandestine Echo Chamber & Cipher Archive (${cartelName})`,
        tags: ["wood", "desk", "books", "espionage", "underworld", "secret"],
        hp: 130,
        maxHp: 130,
        description: "Sound-damped backroom filled with surveillance dossiers, forged noble seals, and acoustic listening cones."
      };
    case "CANYON_STRIP_REDOUBT":
      return {
        name: `Grind Canyon Heavy Scrap Redoubt & Winch (${cartelName})`,
        tags: ["metal", "stone", "redoubt", "weapons", "underworld", "heavy"],
        hp: 220,
        maxHp: 220,
        description: "Barricaded trench bunker reinforced with heavy iron scrap plates and mechanical cable winches hauling stolen slag."
      };
    case "ILLEGAL_CHAIN_GANG_QUARRY":
      return {
        name: `Outlaw Slag Quarry & Crushing Machine (${cartelName})`,
        tags: ["stone", "metal", "machinery", "mining", "underworld"],
        hp: 190,
        maxHp: 190,
        description: "Steam-hissing rotary stone crusher where indentured laborers are forced to pulverize mineral slag under armed guard."
      };
    case "UNBOUND_SANCTUM":
      return {
        name: `Circle of the Unbound Wild-Spark Sanctum (${cartelName})`,
        tags: ["wood", "arcane", "altar", "sanctum", "underworld", "heresy"],
        hp: 150,
        maxHp: 150,
        description: "Secluded forest hideout hung with unsealed runic scrolls, where wild sparkborn practice magic free from null-iron shackles."
      };
    case "WILD_SPARK_ALCHEMICAL_LAB":
      return {
        name: `Heretical Chaos Alembic & Poultice Bench (${cartelName})`,
        tags: ["wood", "glass", "alchemy", "fire", "underworld", "heresy"],
        hp: 120,
        maxHp: 120,
        description: "Bubbling retort stands and jars of unsealed luminescent moss producing anti-chain draughts and ward-breaker powders."
      };
    case "SHADOW_VAULT":
      return {
        name: `Gilded Shadow Vault & Safehouse (${cartelName})`,
        tags: ["metal", "stone", "vault", "underworld", "locked", "shadow_vault"],
        hp: 180,
        maxHp: 180,
        description: "Concealed heavy steel vault door behind an unassuming ledger archive, stashing illicit usury receipts and meridian gold."
      };
    case "USURY_HOUSE":
      return {
        name: `Back-Alley Usury House & Pawn Exchange (${cartelName})`,
        tags: ["wood", "underworld", "usury", "desk", "ledger"],
        hp: 140,
        maxHp: 140,
        description: "Dimly lit parlor where desperate debtors pledge collateral under exorbitant interest rates."
      };
    case "CONTRABAND_DOCK":
      return {
        name: `Hidden Contraband Slipway & Sky-Cache (${cartelName})`,
        tags: ["wood", "contraband", "crane", "cargo", "underworld"],
        hp: 150,
        maxHp: 150,
        description: "Camouflaged docking crane and smuggling crates marked with the Free Sky insignia, bypassing toll tariffs."
      };
    case "SKY_CORSAIR_CACHE":
      return {
        name: `Concealed Sky-Corsair Arms Cache (${cartelName})`,
        tags: ["metal", "wood", "cache", "weapons", "underworld"],
        hp: 150,
        maxHp: 150,
        description: "Reinforced lockboxes containing grappling tether guns, gliding cloaks, and aerolith charge canisters."
      };
    case "MERCENARY_GARRISON":
      return {
        name: `Fuvuiku Mercenary Strongpoint (${cartelName})`,
        tags: ["stone", "wood", "barricade", "garrison", "underworld", "weapons"],
        hp: 180,
        maxHp: 180,
        description: "Fortified cellar barricade smelling of pitch, iron, and stale wine where brutal mercenaries await contracts."
      };
    case "TOLL_BLOCKADE":
      return {
        name: `Fuvuiku Toll Redoubt & Iron Gate (${cartelName})`,
        tags: ["stone", "metal", "toll", "gate", "underworld"],
        hp: 190,
        maxHp: 190,
        description: "Illegal fortified toll checkpoint extorting passage tariffs from merchant wagons and travelers."
      };
    case "ENFORCER_DEN":
      return {
        name: `Silk-Sovereign Enforcer Den & Holding Cell (${cartelName})`,
        tags: ["stone", "iron", "cell", "enforcer", "underworld"],
        hp: 170,
        maxHp: 170,
        description: "Heavily fortified headquarters for debt collectors, extortionists, and street enforcers."
      };
    case "RAIDER_REDOUBT":
      return {
        name: `Ghostwind Raider Redoubt & Stash (${cartelName})`,
        tags: ["wood", "stone", "redoubt", "cache", "underworld"],
        hp: 160,
        maxHp: 160,
        description: "Hidden enclave fortified with driftwood barriers, caches of coastal plunder, and signal flares."
      };
    case "SMUGGLER_COVE":
      return {
        name: `Clandestine Smuggler Cove & Cache (${cartelName})`,
        tags: ["stone", "water", "cave", "smuggler", "underworld"],
        hp: 160,
        maxHp: 160,
        description: "Subterranean cavern tunnel connecting coastal channels directly to secret storehouses."
      };
    default:
      return {
        name: `Hidden Underworld Bazaar (${cartelName})`,
        tags: ["wood", "cloth", "underworld", "black_market"],
        hp: 140,
        maxHp: 140,
        description: "A shadowy den dealing in unlicensed commodities and illicit coin."
      };
  }
}

// First/Last Name matrices for unique individuals by syndicate lore
const NAMES_BY_SYNDICATE: Record<number, { first: string[]; last: string[]; nicknames: string[] }> = {
  1: { // Gilded Compass
    first: ["Alistair", "Lucien", "Bartholomew", "Vivienne", "Eldred", "Morrigan", "Corin"],
    last: ["Vance", "Midas", "Sterling", "Pendleton", "Rothschild", "Gold-Weaver", "Archon"],
    nicknames: ["The Ledger", "Gold-Tooth", "Silent Coin", "The Collector"]
  },
  2: { // Free Sky
    first: ["Vaelis", "Dax", "Cassia", "Zephyr", "Kaelen", "Orion", "Talon", "Lyra"],
    last: ["Skystrider", "Cloud-Rider", "Sun-Sailor", "Wind-Vane", "Aether-Grip", "Hawthorne"],
    nicknames: ["Quick-Trigger", "Gale-Eye", "Slip-Wing", "No-Tether"]
  },
  3: { // Fuvuiku Legions
    first: ["Malakor", "Valerius", "Garrison", "Vrena", "Brakkor", "Torsten", "Jorik"],
    last: ["Dread", "Iron-Biter", "Peak-Holder", "Grimm", "Black-Scar", "Ivory-Horn"],
    nicknames: ["The Ram", "Steel-Jaws", "No-Mercy", "Canyon-Hammer"]
  },
  4: { // Silk-Sovereign Syndicate
    first: ["Sylvira", "Salome", "Vivienne", "Kassandra", "Marchesa", "Drusilla", "Octavia"],
    last: ["Night-Loom", "Viper-Tongue", "Silk-Weaver", "Shadow-Gown", "Black-Rose", "Velvet"],
    nicknames: ["The Matron", "Poison-Kiss", "Velvet-Claw", "Lady Vice"]
  },
  5: { // Ghostwind
    first: ["Lyra", "Barnaby", "Bess", "Finn", "Reef", "Morwen", "Derrick", "Jonas"],
    last: ["Ghostwind", "Reef-Cutter", "Barnacle", "Black-Fin", "Salt-Marrow", "Wave-Torn"],
    nicknames: ["Dead-Water", "Shark-Bait", "The Reaver", "One-Eye"]
  },
  6: { // Obsidian Cartel
    first: ["Vespera", "Silas", "Kaelen", "Brand", "Khoran", "Theron", "Nyx"],
    last: ["Blackglass", "Cold-Chisel", "Deep-Vein", "Slag-Marrow", "Basalt-Bane", "Pyre-Grip"],
    nicknames: ["The Glass-Cutter", "Black-Lung", "Shatter-Hand", "Dark-Spark"]
  },
  7: { // The Otters (Canal Krewes)
    first: ["Finnegan", "Barnaby", "Sal", "Pip", "Winnie", "Cully", "Paddy", "Barty"],
    last: ["Sliptide", "Fast-Paws", "Riverson", "Mud-Whisper", "Fish-Tooth", "Canal-Drover"],
    nicknames: ["Slick-Whiskers", "Wet-Coin", "The Don", "Fast-Paws", "Quiet-Ripple"]
  },
  8: { // Ghostspring
    first: ["Selyse", "Eamon", "Kira", "Vane", "Morwenna", "Theron", "Llyr"],
    last: ["Night-Whisper", "Spring-Mist", "Phantom-Reed", "Shadow-Veil", "Pale-Drop", "Silent-Eye"],
    nicknames: ["The Ghost", "Spider-Silk", "Hush", "Pale-Step"]
  },
  9: { // Grind Canyon
    first: ["Torvald", "Kaelen", "Gorg", "Brant", "Hulda", "Draven", "Stig"],
    last: ["Gravel-Maw", "Rust-Grit", "Trench-Ripper", "Chasm-Render", "Sledge-Iron", "Dust-Gouger"],
    nicknames: ["The Crusher", "Grit-Eater", "Big Sledge", "Trench-Rat"]
  },
  10: { // Hedge Wizards
    first: ["Malidore", "Morwenna", "Kip", "Bramble", "Eldra", "Thorne", "Rowan"],
    last: ["Thorn-Weaver", "Wild-Root", "Spark-Runner", "Unshackled", "Hedge-Walker", "Briar-Burn"],
    nicknames: ["The Heretic", "Sparky", "Unchained", "Root-Witch", "Wild-Spark"]
  }
};

export function generateUniqueOutlawOperative(lair: any, slotIndex: number): any {
  const cartelId = Number(lair.faction_id || 1);
  const def = getCartelDef(cartelId) || OUTLAW_SYNDICATES[0]!;
  const names = NAMES_BY_SYNDICATE[cartelId] || NAMES_BY_SYNDICATE[1]!;

  const first = names.first[(lair.id * 7 + slotIndex * 13) % names.first.length] || "Outlaw";
  const last = names.last[(lair.id * 11 + slotIndex * 17) % names.last.length] || "Operative";
  const nickname = names.nicknames[(lair.id * 3 + slotIndex * 5) % names.nicknames.length] || "Shadow";
  const fullName = `${first} "${nickname}" ${last}`;

  // Species selection from syndicate distribution
  let species = "Human";
  if (cartelId === 1 && (slotIndex === 0 || lair.lair_type.includes("TRADE_YARD"))) {
    // The Gilded Compass is ALWAYS captained by a Hippo
    species = "Hippo";
  } else {
    const roll = Math.random();
    let cumulative = 0;
    for (const s of def.speciesDistribution) {
      cumulative += s.weight;
      if (roll <= cumulative) {
        species = s.species;
        break;
      }
    }
  }

  // Pick unique role archetype
  const roleDef = def.uniqueRoles[slotIndex % def.uniqueRoles.length] || def.uniqueRoles[0]!;

  // Base 12-attribute B.R.U.T.A.L. generation
  const baseStats: Record<string, number> = {
    might: 10,
    endurance: 10,
    finesse: 10,
    reflex: 10,
    vitality: 10,
    fortitude: 10,
    knowledge: 10,
    logic: 10,
    awareness: 10,
    intuition: 10,
    charm: 10,
    willpower: 10
  };

  // Boost primary stat and secondary stat
  const primary = roleDef.affinity;
  baseStats[primary] = 14 + Math.floor(Math.random() * 3);
  if (primary === "might") baseStats.endurance = 13;
  if (primary === "finesse") baseStats.reflex = 14;
  if (primary === "logic") baseStats.knowledge = 13;
  if (primary === "intuition") baseStats.awareness = 13;

  const npcId = `npc_outlaw_${lair.id}_${slotIndex + 1}`;
  const posX = 164 + (slotIndex * 4);
  const posY = 164 + (slotIndex * 3);

  return {
    id: npcId,
    cell_id: lair.cell_id,
    current_rx: 112,
    current_ry: 112,
    local_pos: [posX, posY],
    name: fullName,
    role: `${roleDef.role} (${lair.lair_type.replace(/_/g, " ")})`,
    kingdom: species === "Otter" || species === "Frog" || species === "Walrus" ? "Aquatic" : "Humanoid",
    species,
    lineage: `${species}-Born Outlaw`,
    tags: ["outlaw", "underworld", lair.lair_type.toLowerCase(), "unique_individual", species.toLowerCase()],
    faction: def.name,
    hp: 35 + Math.floor(Math.random() * 10),
    max_hp: 45,
    disposition: 0,
    alive: true,
    equipped_weapon: roleDef.weapon,
    equipped_armor: roleDef.armor,
    stat_affinity: roleDef.affinity,
    stats: baseStats,
    inventory: [...roleDef.inventory],
    memory_notes: [
      `Stationed at the ${lair.lair_type.replace(/_/g, " ")} in Burg #${lair.burg_id} for ${def.name}.`,
      `Personally answers to ${def.bossName} (${def.bossTitle}).`,
      `Temper: ${roleDef.temper}, Instinct: ${roleDef.instinct}. Current Lair Heat: ${lair.heat || 0}/100.`
    ],
    wander_anchor: [posX, posY],
    home_pos: [posX, posY],
    work_pos: [posX, posY],
    current_task: "GUARD_LAIR",
    schedule_state: "WORK",
    instinct: roleDef.instinct,
    temper: roleDef.temper,
    needs: { food: 0.8, rest: 0.8, coin: 0.9, safety: 0.7, company: 0.6 },
    mood: { fear: 0.1, anger: 0.2, joy: 0.3 }
  };
}

export async function ensureLairResidents(client: PoolClient | Pool, lair: any): Promise<any[]> {
  // Check if residents already exist in sim_npc_instances
  const res = await client.query(
    `SELECT * FROM sim_npc_instances WHERE id LIKE $1 AND alive = true`,
    [`npc_outlaw_${lair.id}_%`]
  );

  if (res.rows.length >= 2) {
    return res.rows;
  }

  const residents: any[] = [...res.rows];
  const existingSlots = new Set(residents.map(r => r.id));

  for (let slot = 0; slot < 2; slot++) {
    const expectedId = `npc_outlaw_${lair.id}_${slot + 1}`;
    if (!existingSlots.has(expectedId)) {
      const npc = generateUniqueOutlawOperative(lair, slot);
      await client.query(`
        INSERT INTO sim_npc_instances (
          id, cell_id, current_rx, current_ry, local_pos, name, role,
          kingdom, species, lineage, tags, faction, hp, max_hp, disposition, alive,
          equipped_weapon, equipped_armor, stat_affinity, stats, inventory, memory_notes,
          wander_anchor, home_pos, work_pos, current_task, schedule_state, instinct, temper, needs, mood
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11::jsonb, $12, $13, $14, $15, $16,
          $17, $18, $19, $20::jsonb, $21::jsonb, $22::jsonb,
          $23, $24, $25, $26, $27, $28, $29, $30::jsonb, $31::jsonb
        ) ON CONFLICT (id) DO UPDATE SET
          alive = EXCLUDED.alive,
          local_pos = EXCLUDED.local_pos
      `, [
        npc.id, npc.cell_id, npc.current_rx, npc.current_ry, npc.local_pos, npc.name, npc.role,
        npc.kingdom, npc.species, npc.lineage, JSON.stringify(npc.tags), npc.faction, npc.hp, npc.max_hp, npc.disposition, npc.alive,
        npc.equipped_weapon, npc.equipped_armor, npc.stat_affinity, JSON.stringify(npc.stats), JSON.stringify(npc.inventory), JSON.stringify(npc.memory_notes),
        npc.wander_anchor, npc.home_pos, npc.work_pos, npc.current_task, npc.schedule_state, npc.instinct, npc.temper, JSON.stringify(npc.needs), JSON.stringify(npc.mood)
      ]);

      residents.push(npc);
    }
  }

  return residents;
}
