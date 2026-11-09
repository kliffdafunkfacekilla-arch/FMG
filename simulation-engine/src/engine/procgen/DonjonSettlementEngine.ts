/**
 * DonjonSettlementEngine.ts
 * 
 * Implements Donjon's Medieval Demographics & Fantasy Town Generator
 * (based on S. John Ross's "Medieval Demographics Made Easy" and donjon.bin.sh).
 * 
 * Provides:
 * 1. Demographic Business Census by Support Values (SV)
 * 2. Evocative Donjon-style Tavern, Shop, and Landmark Naming
 * 3. Functional Ward / District Distribution (Citadel, Market, Artisans, Temples, Waterfront, Residential)
 * 4. 1:1 Authentic Demographic Citizen Linking (12:1 worker baseline)
 */

import { getFactionSpecialty } from "../economy/factionSpecialties.js";

export interface DonjonBusiness {
  id: string;
  type: string;
  category: "hospitality" | "food" | "industrial" | "artisan" | "commercial" | "services" | "luxury" | "civic" | "sacred";
  name: string;
  ward: "CITADEL" | "MARKET" | "ARTISAN" | "TEMPLE" | "WATERFRONT" | "RESIDENTIAL";
  proprietorCitizenId?: number;
  proprietorName?: string;
  proprietorProfession?: string;
  proprietorSpecies?: string;
  proprietorTemper?: string;
  atmosphere: string;
  specialty: string;
  quality: "poor" | "modest" | "fine" | "masterwork";
  buildingWidth: number;
  buildingHeight: number;
  hasCellar: boolean;
  hasUpper: boolean;
  hasOven?: boolean;
  hasForgeHearth?: boolean;
  hasAltar?: boolean;
}

export interface DonjonWard {
  id: "CITADEL" | "MARKET" | "ARTISAN" | "TEMPLE" | "WATERFRONT" | "RESIDENTIAL";
  name: string;
  description: string;
  dominantTile: number;
  businesses: DonjonBusiness[];
}

export interface DonjonSettlementCensus {
  burgId: number;
  burgName: string;
  population: number;
  urbanTier: number;
  isPort: boolean;
  architectureType: string;
  wards: Record<string, DonjonWard>;
  businesses: DonjonBusiness[];
  tavernList: DonjonBusiness[];
  artisanList: DonjonBusiness[];
  civicList: DonjonBusiness[];
  notableLocations: Array<{ name: string; ward: string; description: string }>;
}

// S. John Ross Support Values (SV): People per single business
export const SV_TABLE: Record<string, { sv: number; category: DonjonBusiness["category"]; ward: DonjonBusiness["ward"]; defaultTitle: string }> = {
  TAVERN: { sv: 400, category: "hospitality", ward: "MARKET", defaultTitle: "Tavern & Inn" },
  BAKERY: { sv: 800, category: "food", ward: "MARKET", defaultTitle: "Bakery & Bread Ovens" },
  BLACKSMITH: { sv: 750, category: "industrial", ward: "ARTISAN", defaultTitle: "Smithy & Iron Forge" },
  BUTCHER: { sv: 1200, category: "food", ward: "MARKET", defaultTitle: "Butcher & Shambles" },
  CARPENTER: { sv: 550, category: "industrial", ward: "ARTISAN", defaultTitle: "Carpentry & Sawpit" },
  WEAVER: { sv: 600, category: "artisan", ward: "ARTISAN", defaultTitle: "Weaver & Draper Loom" },
  SHOEMAKER: { sv: 250, category: "artisan", ward: "RESIDENTIAL", defaultTitle: "Cobbler & Bootmaker" },
  MASON: { sv: 500, category: "industrial", ward: "ARTISAN", defaultTitle: "Stonemason Cutting Yard" },
  POTTER: { sv: 1500, category: "industrial", ward: "ARTISAN", defaultTitle: "Pottery & Clay Kiln" },
  TANNER: { sv: 1200, category: "industrial", ward: "WATERFRONT", defaultTitle: "Leather Tannery & Currier" },
  BREWER: { sv: 1400, category: "food", ward: "MARKET", defaultTitle: "Brewhouse & Malt Kiln" },
  APOTHECARY: { sv: 1500, category: "services", ward: "TEMPLE", defaultTitle: "Apothecary & Herbarium" },
  CHANDLER: { sv: 700, category: "artisan", ward: "RESIDENTIAL", defaultTitle: "Chandler & Wax Works" },
  COOPER: { sv: 700, category: "artisan", ward: "ARTISAN", defaultTitle: "Cooperage & Barrel Works" },
  FISHERY: { sv: 800, category: "food", ward: "WATERFRONT", defaultTitle: "Fishery & Salt Smokehouse" },
  JEWELER: { sv: 2500, category: "luxury", ward: "CITADEL", defaultTitle: "Goldsmith & Jewel Atelier" }
};

// Donjon Tavern Name Components
const TAVERN_ADJECTIVES = [
  "Broken", "Gilded", "Whispering", "Boar's", "Silver", "Drowned", "Merry", "Blind",
  "Prancing", "Rusty", "Black", "Golden", "Laughing", "Dancing", "Red", "Staggering",
  "Sleeping", "Bawdy", "Weary", "Sullen", "Crooked", "Jolly", "Roaring", "Silent"
];

const TAVERN_NOUNS = [
  "Flagon", "Tankard", "Anchor", "Horseshoe", "Hammer", "Dragon", "Griffin", "Stag",
  "Bear", "Maiden", "Badger", "Crow", "Barrel", "Anvil", "Mug", "Compass",
  "Pike", "Otter", "Hound", "Blade", "Goblet", "Kettle", "Mast", "Lantern"
];

const TAVERN_SPECIALTIES = [
  "Oak-aged spiced pear cider and honey-roasted boar shank.",
  "Dark malt stout and smoked eel pies with horseradish cream.",
  "Mulled berry wine and dried venison sausage rissoles.",
  "Crisp highland barley ale and baked mutton pasties with leeks.",
  "Cloudy apple pomace brandy and sharp sheep's curd cheese.",
  "Amber wheat lager and salted herring with rye crusts."
];

const TAVERN_ATMOSPHERES = [
  "Rowdy hearthfire with lute music, carters, and heavy oak drinking trestles.",
  "Dimly lit taproom thick with pipe-smoke, dice games, and quiet whispers in corners.",
  "Cozy timber loft with dried hops hanging from beams and a roaring stone fireplace.",
  "Drafty quayside tavern frequented by salt-crusted sailors, smugglers, and dockhands.",
  "Clean merchant drovers' lodge with warm straw pallets and brass oil lanterns."
];

// Seeded PRNG helper
function hashSeed(seedStr: string): () => number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 16777619);
  }
  return function () {
    h += h << 13;
    h ^= h >>> 7;
    h += h << 3;
    h ^= h >>> 17;
    return ((h += h << 5) >>> 0) / 4294967296;
  };
}

/**
 * Computes Donjon's full settlement census for a burg based on authentic medieval demographics.
 */
export function computeDonjonSettlementCensus(
  burg: any,
  citizens: any[] = [],
  contextConfig?: any
): DonjonSettlementCensus {
  const burgId = Number(burg.burg_id) || 1;
  const burgName = burg.name || `Burg #${burgId}`;
  const pop = Math.max(300, Number(burg.pop_null ?? burg.population ?? 2500));
  const urbanTier = Number(burg.urban_tier) || (pop > 12000 ? 3 : pop > 1200 ? 2 : 1);
  const isPort = Boolean(burg.port);
  const archType = burg.architecture_type || "HALF_TIMBERED";
  const rand = hashSeed(`donjon_census_${burgId}_${pop}`);

  type WardKey = "CITADEL" | "MARKET" | "ARTISAN" | "TEMPLE" | "WATERFRONT" | "RESIDENTIAL";
  const wards: Record<WardKey, DonjonWard> = {
    CITADEL: {
      id: "CITADEL",
      name: "The Castle Bailey & Citadel Ward",
      description: "Elevated high-ground precinct with the municipal town hall, garrison barracks, armory, and keep watchtower.",
      dominantTile: 4,
      businesses: []
    },
    MARKET: {
      id: "MARKET",
      name: "The Central Market Plaza & Exchange",
      description: "Paved commercial crossroads with timber trade stalls, merchant guildhall, weigh house, and central taverns.",
      dominantTile: 4,
      businesses: []
    },
    ARTISAN: {
      id: "ARTISAN",
      name: "The Craftsmen's Quarter & Artisan Wynd",
      description: "Dense industrial lanes filled with hammering iron forges, sawdust sawpits, stonecutting yards, and draper looms.",
      dominantTile: 3,
      businesses: []
    },
    TEMPLE: {
      id: "TEMPLE",
      name: "The Sacred Sanctuary Precinct",
      description: "Tranquil cloister gardens, the Sanctuary of the Dragon Seals, bell tower, and apothecary herbarium.",
      dominantTile: 4,
      businesses: []
    },
    WATERFRONT: {
      id: "WATERFRONT",
      name: isPort ? "The Harbor Quayside & Salt Docks" : "The Riverbank Basin & Watermill",
      description: "Timber boardwalks, stone quayside steps, fish smoking racks, and river transport warehouses.",
      dominantTile: 8,
      businesses: []
    },
    RESIDENTIAL: {
      id: "RESIDENTIAL",
      name: "The Low Quarters & Residential Faubourgs",
      description: "Gabled cottages, cobblestone wynds, walled vegetable gardens, cobblers, and candle chandlers.",
      dominantTile: 3,
      businesses: []
    }
  };

  const businesses: DonjonBusiness[] = [];
  const assignedCitizenIds = new Set<number>();

  const pickProprietor = (preferredProfessions: string[]): any => {
    let match = citizens.find(c =>
      !assignedCitizenIds.has(c.citizen_id) &&
      preferredProfessions.some(p => c.profession?.toLowerCase().includes(p.toLowerCase()))
    );
    if (!match) {
      match = citizens.find(c => !assignedCitizenIds.has(c.citizen_id));
    }
    if (match) {
      assignedCitizenIds.add(match.citizen_id);
      return match;
    }
    return null;
  };

  // 1. Mandatory Civic & Governance Core (Citadel Ward)
  const registryCitizen = pickProprietor(["Mayor", "Reeve", "Bailiff", "Magistrate", "Clerk"]);
  const registryBiz: DonjonBusiness = {
    id: `biz_registry_${burgId}`,
    type: "REGISTRY",
    category: "civic",
    name: `${burgName} Municipal Hall & Provincial Registry`,
    ward: "CITADEL",
    proprietorCitizenId: registryCitizen?.citizen_id,
    proprietorName: registryCitizen?.name,
    proprietorProfession: registryCitizen?.profession || "High Reeve",
    proprietorSpecies: registryCitizen?.species || "Human",
    proprietorTemper: registryCitizen?.temper || "Phlegmatic",
    atmosphere: "Polished oak magistrate benches, official wax tax rolls, and sovereignty seal scrolls.",
    specialty: "Provincial charter records, deed registrations, and judicial arbitrations.",
    quality: "fine",
    buildingWidth: 9,
    buildingHeight: 7,
    hasCellar: true,
    hasUpper: true
  };
  businesses.push(registryBiz);
  wards.CITADEL.businesses.push(registryBiz);

  const barracksCitizen = pickProprietor(["Commander", "Captain", "Marshal", "Sergeant", "Watchman"]);
  const barracksBiz: DonjonBusiness = {
    id: `biz_barracks_${burgId}`,
    type: "BARRACKS",
    category: "civic",
    name: `${burgName} City Watch Barracks & Armory`,
    ward: "CITADEL",
    proprietorCitizenId: barracksCitizen?.citizen_id,
    proprietorName: barracksCitizen?.name,
    proprietorProfession: barracksCitizen?.profession || "Watch Commander",
    proprietorSpecies: barracksCitizen?.species || "Human",
    proprietorTemper: barracksCitizen?.temper || "Choleric",
    atmosphere: "Crossbow bolt racks, heavy iron footlockers, weapon polishing oils, and muster whistles.",
    specialty: "Sovereign frontier patrol rosters, perimeter defense, and municipal order.",
    quality: "fine",
    buildingWidth: 10,
    buildingHeight: 7,
    hasCellar: true,
    hasUpper: true
  };
  businesses.push(barracksBiz);
  wards.CITADEL.businesses.push(barracksBiz);

  // 2. Temple & Sanctuary (Temple Precinct)
  const priestCitizen = pickProprietor(["Priest", "Acolyte", "Monk", "Herbalist", "Scholar"]);
  const templeBiz: DonjonBusiness = {
    id: `biz_temple_${burgId}`,
    type: "TEMPLE",
    category: "sacred",
    name: `Sanctuary of the Twelve Dragon Seals`,
    ward: "TEMPLE",
    proprietorCitizenId: priestCitizen?.citizen_id,
    proprietorName: priestCitizen?.name,
    proprietorProfession: priestCitizen?.profession || "High Seal-Ward Priest",
    proprietorSpecies: priestCitizen?.species || "Human",
    proprietorTemper: priestCitizen?.temper || "Melancholic",
    atmosphere: "Sandalwood incense, polished stone altar of the dragon constellations, and singing prayer bells.",
    specialty: "Cosmic seal observances, blessing of seasonal crops, and soothing of void dread.",
    quality: "masterwork",
    buildingWidth: 11,
    buildingHeight: 8,
    hasCellar: true,
    hasUpper: true,
    hasAltar: true
  };
  businesses.push(templeBiz);
  wards.TEMPLE.businesses.push(templeBiz);

  // 2b. Faction Signature Guildhall / Master Workshop (Artisan Ward)
  const factionIdOrName = burg.faction_id || contextConfig?.factionId || contextConfig?.factionOwner || 0;
  const factionSpec = getFactionSpecialty(factionIdOrName);
  if (factionSpec && factionSpec.factionId !== 0) {
    const specialtyCitizen = pickProprietor([
      factionSpec.artisanRole,
      "Artisan",
      "Craftsman",
      "Smith",
      "Guildmaster",
      "Scholar",
      "Alchemist"
    ]);
    const specialtyBiz: DonjonBusiness = {
      id: `biz_specialty_${burgId}`,
      type: "SPECIALTY_GUILD",
      category: "artisan",
      name: `${burgName} ${factionSpec.specialtyName}`,
      ward: "ARTISAN",
      proprietorCitizenId: specialtyCitizen?.citizen_id,
      proprietorName: specialtyCitizen?.name,
      proprietorProfession: specialtyCitizen?.profession || factionSpec.artisanRole,
      proprietorSpecies: specialtyCitizen?.species || "Human",
      proprietorTemper: specialtyCitizen?.temper || "Sanguine",
      atmosphere: `${factionSpec.description} Active work on ${factionSpec.harvestMethod}.`,
      specialty: `${factionSpec.uniqueGoodName} (${factionSpec.progressRoleDescription})`,
      quality: "masterwork",
      buildingWidth: 9,
      buildingHeight: 7,
      hasCellar: true,
      hasUpper: true
    };
    businesses.push(specialtyBiz);
    wards.ARTISAN.businesses.push(specialtyBiz);
  }

  // 3. Compute Business Quotas by Donjon Support Values
  let tavernIndex = 0;
  for (const [key, svData] of Object.entries(SV_TABLE)) {
    if (key === "FISHERY" && !isPort) continue;

    // Minimum 1 tavern, 1 blacksmith, 1 baker, 1 carpenter, 1 weaver for every settlement
    const minCount = ["TAVERN", "BLACKSMITH", "BAKERY", "CARPENTER", "WEAVER"].includes(key) ? 1 : 0;
    const computedCount = Math.max(minCount, Math.floor(pop / svData.sv));
    // Cap to reasonable number of placed physical shops (max 2-3 per trade in tactical view)
    const count = Math.min(computedCount, urbanTier >= 3 ? 3 : urbanTier === 2 ? 2 : 1);

    for (let c = 0; c < count; c++) {
      let bizName = svData.defaultTitle;
      let atmosphere = "A busy workshop smelling of hot labor and raw materials.";
      let specialty = "General provincial supply and trade repair.";
      let wardKey: DonjonBusiness["ward"] = svData.ward;

      let citizen: any = null;
      if (key === "TAVERN") {
        citizen = pickProprietor(["Innkeeper", "Tavern", "Brewer", "Host", "Merchant"]);
        const adj = TAVERN_ADJECTIVES[Math.floor(rand() * TAVERN_ADJECTIVES.length)];
        const noun = TAVERN_NOUNS[Math.floor(rand() * TAVERN_NOUNS.length)];
        bizName = `The ${adj} ${noun} ${tavernIndex === 0 ? "Inn" : "Tavern"}`;
        atmosphere = TAVERN_ATMOSPHERES[Math.floor(rand() * TAVERN_ATMOSPHERES.length)]!;
        specialty = TAVERN_SPECIALTIES[Math.floor(rand() * TAVERN_SPECIALTIES.length)]!;
        tavernIndex++;
      } else if (key === "BLACKSMITH") {
        citizen = pickProprietor(["Smith", "Blacksmith", "Armorer", "Forgemaster", "Farrier"]);
        bizName = citizen ? `${citizen.name}'s Anvil & Bellows` : `${burgName} Fine Ironworks`;
        atmosphere = "Roaring coke coals, rhythmic sledge strikes, quench water sizzle, and soot-streaked walls.";
        specialty = "Drover horse shoes, forged ploughshares, iron cooking spits, and tempered hand-axes.";
      } else if (key === "BAKERY") {
        citizen = pickProprietor(["Baker", "Pastry", "Miller", "Cook"]);
        bizName = citizen ? `${citizen.name}'s Hearth & Crust` : `${burgName} Guild Bakery`;
        atmosphere = "Flour dust in the air, sweet aroma of baking sourdough rye, and brick dome ovens glowing red.";
        specialty = "Crusty rye loaves, honey barley cakes, and dried sea biscuits.";
      } else if (key === "CARPENTER") {
        citizen = pickProprietor(["Carpenter", "Joiner", "Woodcutter", "Sawyer"]);
        bizName = citizen ? `${citizen.name}'s Joinery & Sawpit` : `${burgName} Timberworks`;
        atmosphere = "Curled pine shavings, fragrant cedar sawdust, mallet strikes, and glue pots.";
        specialty = "Wagon wheels, threshed oak grain bins, roof trusses, and dovetailed tool chests.";
      } else if (key === "WEAVER") {
        citizen = pickProprietor(["Weaver", "Draper", "Tailor", "Spinner"]);
        bizName = citizen ? `${citizen.name}'s Loom & Shuttle` : `Draper Guildhouse of ${burgName}`;
        atmosphere = "Click-clack of vertical warp frames, bundles of dyed flax, and spinning distaffs.";
        specialty = "Dense wool sailcloth, warm winter cloaks, and unbleached linen tunics.";
      } else if (key === "APOTHECARY") {
        citizen = pickProprietor(["Apothecary", "Herbalist", "Physician", "Healer"]);
        bizName = citizen ? `${citizen.name}'s Mortar & Pestle` : `${burgName} Herbarium & Dispensary`;
        atmosphere = "Drying bundles of marsh moss, glass alembics, ground sulfur, and stoppered tincture vials.";
        specialty = "Willow-bark pain elixirs, fever tonics, wound salves, and cleansing draughts.";
      } else if (key === "MASON") {
        citizen = pickProprietor(["Mason", "Stonecutter", "Quarryman"]);
        bizName = citizen ? `${citizen.name}'s Stone Cutting Yard` : `${burgName} Ashlar Masonry`;
        atmosphere = "Heavy granite ashlar blocks, chipping chisels, plumb lines, and powdered limestone mortar.";
        specialty = "Arch stones, well copings, chimney liners, and foundation footings.";
      } else if (key === "POTTER") {
        citizen = pickProprietor(["Potter", "Clay", "Ceramist"]);
        bizName = citizen ? `${citizen.name}'s Turning Wheel & Kiln` : `${burgName} Pottery`;
        atmosphere = "Wet red clay, wooden potter wheels, drying racks, and a domed brick kiln.";
        specialty = "Glazed cider jugs, butter crocks, roof tiles, and oil amphorae.";
      } else if (key === "TANNER") {
        citizen = pickProprietor(["Tanner", "Currier", "Skinner", "Leather"]);
        bizName = citizen ? `${citizen.name}'s Tanning Vats` : `${burgName} Tannery`;
        atmosphere = "Heavy odor of tanning liquor, scraping benches, stretching frames, and supple cowhides.";
        specialty = "Boiled leather cuirasses, saddlery straps, heavy work boots, and water flasks.";
      } else if (key === "FISHERY") {
        citizen = pickProprietor(["Fisherman", "Fishmonger", "Netmaker"]);
        bizName = citizen ? `${citizen.name}'s Quayside Smokehouse` : `${burgName} Fishery`;
        atmosphere = "Hanging drying seine nets, salt-crusted brine barrels, and alder wood smoke.";
        specialty = "Salt-cured salmon, smoked lake whitefish, and dried river herring.";
      } else {
        citizen = pickProprietor([key.toLowerCase()]);
        bizName = citizen ? `${citizen.name}'s ${svData.defaultTitle}` : `${burgName} ${svData.defaultTitle}`;
      }

      const biz: DonjonBusiness = {
        id: `biz_${key.toLowerCase()}_${burgId}_${c}`,
        type: key,
        category: svData.category,
        name: bizName,
        ward: wardKey,
        proprietorCitizenId: citizen?.citizen_id,
        proprietorName: citizen?.name,
        proprietorProfession: citizen?.profession || svData.defaultTitle,
        proprietorSpecies: citizen?.species || "Human",
        proprietorTemper: citizen?.temper || "Sanguine",
        atmosphere,
        specialty,
        quality: (rand() < 0.25 ? "fine" : rand() < 0.75 ? "modest" : "poor") as any,
        buildingWidth: 7 + Math.floor(rand() * 4),
        buildingHeight: 6 + Math.floor(rand() * 3),
        hasCellar: ["TAVERN", "BAKERY", "APOTHECARY", "BREWER"].includes(key),
        hasUpper: ["TAVERN", "REGISTRY", "BARRACKS"].includes(key),
        hasOven: ["BAKERY", "POTTER"].includes(key),
        hasForgeHearth: ["BLACKSMITH"].includes(key)
      };

      businesses.push(biz);
      if (wards[wardKey]) {
        wards[wardKey].businesses.push(biz);
      }
    }
  }

  // 4. Central Market Stalls
  const marketStallCitizen = pickProprietor(["Merchant", "Peddler", "Trader", "Grocer"]);
  const marketBiz: DonjonBusiness = {
    id: `biz_market_stalls_${burgId}`,
    type: "MARKET_STALL",
    category: "commercial",
    name: `${burgName} Central Produce & Cloth Exchange`,
    ward: "MARKET",
    proprietorCitizenId: marketStallCitizen?.citizen_id,
    proprietorName: marketStallCitizen?.name,
    proprietorProfession: marketStallCitizen?.profession || "Guild Factor",
    proprietorSpecies: marketStallCitizen?.species || "Human",
    proprietorTemper: marketStallCitizen?.temper || "Sanguine",
    atmosphere: "Colorful linen canopies, crying vendors, balance scales, and carts heaped with turnips and wool.",
    specialty: "Regional grain tariffs, bulk vegetable barter, and dyed cloth bolts.",
    quality: "modest",
    buildingWidth: 8,
    buildingHeight: 6,
    hasCellar: false,
    hasUpper: false
  };
  businesses.push(marketBiz);
  wards.MARKET.businesses.push(marketBiz);

  const tavernList = businesses.filter(b => b.type === "TAVERN");
  const artisanList = businesses.filter(b => b.category === "industrial" || b.category === "artisan");
  const civicList = businesses.filter(b => b.category === "civic" || b.category === "sacred");

  const notableLocations: Array<{ name: string; ward: string; description: string }> = [
    {
      name: wards.CITADEL.name,
      ward: "CITADEL",
      description: "Fortified administrative seat where the town reeve and garrison commander hold sovereign court."
    },
    {
      name: wards.MARKET.name,
      ward: "MARKET",
      description: "Vibrant trade hub where regional farmers, traveling carters, and artisans meet to trade."
    },
    {
      name: wards.ARTISAN.name,
      ward: "ARTISAN",
      description: "Noisy row of craft shops producing weapons, building timber, pottery, and woven cloth."
    },
    {
      name: wards.TEMPLE.name,
      ward: "TEMPLE",
      description: "Quiet sanctuary dedicated to preserving the Twelve Dragon Seals against cosmic madness."
    }
  ];

  if (isPort) {
    notableLocations.push({
      name: wards.WATERFRONT.name,
      ward: "WATERFRONT",
      description: "Waterfront slips where barges, fishing skiffs, and water-carriers dock along the river."
    });
  }

  return {
    burgId,
    burgName,
    population: pop,
    urbanTier,
    isPort,
    architectureType: archType,
    wards,
    businesses,
    tavernList,
    artisanList,
    civicList,
    notableLocations
  };
}
