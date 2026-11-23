/**
 * goodCatalog.ts
 * Pure mapping between Ostraka_full.map's 71 goods, citizen professions, workplaces,
 * infrastructure classes, and functional labor pools (zero DB/UI dependencies).
 */

export type InfraKind = "FARM" | "CAMP" | "QUARRY" | "MINE" | "WORKSHOP";

export interface GoodRoleSpec {
  goodId: number;
  goodKey: string;
  profession: string;
  workplaceType: string;
  workplaceName: string;
  kind: "primary" | "crafted";
  isFood: boolean;
  foodNutrition: number;
  isAquatic: boolean;
  infraType: InfraKind;
}

export function goodKeyFromName(name: string): string {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Factions capable of atmospheric skyship trade crews. */
export const AIR_CAPABLE_FACTION_IDS = new Set<number>([29, 32, 36, 39, 40, 41, 47, 50]);

export const GOOD_ROLE_BY_ID: Record<number, GoodRoleSpec> = {
  1:  { goodId: 1,  goodKey: "wood",           profession: "Woodcutter",              workplaceType: "LOGGING_CAMP",   workplaceName: "Timber Logging Camp",           kind: "primary", isFood: false, foodNutrition: 0,  isAquatic: false, infraType: "CAMP" },
  2:  { goodId: 2,  goodKey: "stone",          profession: "Quarryman",               workplaceType: "QUARRY",         workplaceName: "Municipal Stone Quarry",        kind: "primary", isFood: false, foodNutrition: 0,  isAquatic: false, infraType: "QUARRY" },
  3:  { goodId: 3,  goodKey: "marble",         profession: "Quarryman",               workplaceType: "QUARRY",         workplaceName: "Marble Quarry",                 kind: "primary", isFood: false, foodNutrition: 0,  isAquatic: false, infraType: "QUARRY" },
  4:  { goodId: 4,  goodKey: "iron",           profession: "Miner",                   workplaceType: "MINE",           workplaceName: "Deep Seam Iron Mine",           kind: "primary", isFood: false, foodNutrition: 0,  isAquatic: false, infraType: "MINE" },
  5:  { goodId: 5,  goodKey: "copper",         profession: "Miner",                   workplaceType: "MINE",           workplaceName: "Copper Vein Mine",              kind: "primary", isFood: false, foodNutrition: 0,  isAquatic: false, infraType: "MINE" },
  6:  { goodId: 6,  goodKey: "tin",            profession: "Miner",                   workplaceType: "MINE",           workplaceName: "Tin Mine",                      kind: "primary", isFood: false, foodNutrition: 0,  isAquatic: false, infraType: "MINE" },
  7:  { goodId: 7,  goodKey: "silver",         profession: "Miner",                   workplaceType: "MINE",           workplaceName: "Silver Vein Mine",              kind: "primary", isFood: false, foodNutrition: 0,  isAquatic: false, infraType: "MINE" },
  8:  { goodId: 8,  goodKey: "gold",           profession: "Miner",                   workplaceType: "MINE",           workplaceName: "Gold Seam Mine",                kind: "primary", isFood: false, foodNutrition: 0,  isAquatic: false, infraType: "MINE" },
  9:  { goodId: 9,  goodKey: "grain",          profession: "Farmer",                  workplaceType: "FARMSTEAD",      workplaceName: "Outlying Granary & Fields",     kind: "primary", isFood: true,  foodNutrition: 14, isAquatic: false, infraType: "FARM" },
  10: { goodId: 10, goodKey: "cattle",         profession: "Livestock Herder",        workplaceType: "PASTURE",        workplaceName: "Pasture & Stockyards",          kind: "primary", isFood: true,  foodNutrition: 14, isAquatic: false, infraType: "FARM" },
  11: { goodId: 11, goodKey: "fish",           profession: "Fisherman",               workplaceType: "FISHERY",        workplaceName: "Basin Fishery Quay",            kind: "primary", isFood: true,  foodNutrition: 13, isAquatic: true,  infraType: "CAMP" },
  12: { goodId: 12, goodKey: "game",           profession: "Hunter & Trapper",        workplaceType: "HUNTING_CAMP",   workplaceName: "Wilds Hunting & Fur Camp",      kind: "primary", isFood: true,  foodNutrition: 13, isAquatic: false, infraType: "CAMP" },
  13: { goodId: 13, goodKey: "wine",           profession: "Orchardist",              workplaceType: "ORCHARD_APIARY", workplaceName: "Orchard, Vineyard & Apiary",    kind: "primary", isFood: true,  foodNutrition: 8,  isAquatic: false, infraType: "FARM" },
  14: { goodId: 14, goodKey: "olives",         profession: "Farmer",                  workplaceType: "FARMSTEAD",      workplaceName: "Olive Groves & Fields",         kind: "primary", isFood: true,  foodNutrition: 10, isAquatic: false, infraType: "FARM" },
  15: { goodId: 15, goodKey: "honey",          profession: "Orchardist",              workplaceType: "ORCHARD_APIARY", workplaceName: "Apiary & Orchard",              kind: "primary", isFood: true,  foodNutrition: 10, isAquatic: false, infraType: "FARM" },
  16: { goodId: 16, goodKey: "salt",           profession: "Quarryman",               workplaceType: "QUARRY",         workplaceName: "Salt Works & Quarry",           kind: "primary", isFood: false, foodNutrition: 0,  isAquatic: false, infraType: "QUARRY" },
  17: { goodId: 17, goodKey: "dates",          profession: "Farmer",                  workplaceType: "FARMSTEAD",      workplaceName: "Oasis Palm Fields",             kind: "primary", isFood: true,  foodNutrition: 10, isAquatic: false, infraType: "FARM" },
  18: { goodId: 18, goodKey: "horses",         profession: "Livestock Herder",        workplaceType: "PASTURE",        workplaceName: "Equine Paddocks & Stables",     kind: "primary", isFood: false, foodNutrition: 0,  isAquatic: false, infraType: "FARM" },
  19: { goodId: 19, goodKey: "ivory",          profession: "Hunter & Trapper",        workplaceType: "HUNTING_CAMP",   workplaceName: "Outlying Hunting Camp",         kind: "primary", isFood: false, foodNutrition: 0,  isAquatic: false, infraType: "CAMP" },
  20: { goodId: 20, goodKey: "camels",         profession: "Livestock Herder",        workplaceType: "PASTURE",        workplaceName: "Pack-Beast Corrals",            kind: "primary", isFood: false, foodNutrition: 0,  isAquatic: false, infraType: "FARM" },
  21: { goodId: 21, goodKey: "hemp",           profession: "Farmer",                  workplaceType: "FARMSTEAD",      workplaceName: "Flax & Hemp Plots",             kind: "primary", isFood: false, foodNutrition: 0,  isAquatic: false, infraType: "FARM" },
  22: { goodId: 22, goodKey: "pearls",         profession: "Fisherman",               workplaceType: "FISHERY",        workplaceName: "Tidal Pearl Diving Quay",       kind: "primary", isFood: false, foodNutrition: 0,  isAquatic: true,  infraType: "CAMP" },
  23: { goodId: 23, goodKey: "gemstones",      profession: "Miner",                   workplaceType: "MINE",           workplaceName: "Gemstone Shaft Mine",           kind: "primary", isFood: false, foodNutrition: 0,  isAquatic: false, infraType: "MINE" },
  24: { goodId: 24, goodKey: "dyes",           profession: "Orchardist",              workplaceType: "ORCHARD_APIARY", workplaceName: "Dye-Plantation & Apiary",       kind: "primary", isFood: false, foodNutrition: 0,  isAquatic: false, infraType: "FARM" },
  25: { goodId: 25, goodKey: "incense",        profession: "Orchardist",              workplaceType: "ORCHARD_APIARY", workplaceName: "Resin Groves & Apiary",         kind: "primary", isFood: false, foodNutrition: 0,  isAquatic: false, infraType: "FARM" },
  26: { goodId: 26, goodKey: "silk",           profession: "Orchardist",              workplaceType: "ORCHARD_APIARY", workplaceName: "Mulberry Silk Groves",          kind: "primary", isFood: false, foodNutrition: 0,  isAquatic: false, infraType: "FARM" },
  27: { goodId: 27, goodKey: "spices",         profession: "Orchardist",              workplaceType: "ORCHARD_APIARY", workplaceName: "Spice Terraces & Gardens",      kind: "primary", isFood: false, foodNutrition: 0,  isAquatic: false, infraType: "FARM" },
  28: { goodId: 28, goodKey: "amber",          profession: "Miner",                   workplaceType: "MINE",           workplaceName: "Amber Pit & Quarry",            kind: "primary", isFood: false, foodNutrition: 0,  isAquatic: false, infraType: "MINE" },
  29: { goodId: 29, goodKey: "furs",           profession: "Hunter & Trapper",        workplaceType: "HUNTING_CAMP",   workplaceName: "Trapper Lodge & Fur Camp",      kind: "primary", isFood: false, foodNutrition: 0,  isAquatic: false, infraType: "CAMP" },
  30: { goodId: 30, goodKey: "wool",           profession: "Livestock Herder",        workplaceType: "PASTURE",        workplaceName: "Sheepfolds & Shearing Yards",   kind: "primary", isFood: false, foodNutrition: 0,  isAquatic: false, infraType: "FARM" },
  31: { goodId: 31, goodKey: "slaves",         profession: "Disenfranchised Laborer", workplaceType: "FARMSTEAD",      workplaceName: "Conscripted Labor Yards",       kind: "primary", isFood: false, foodNutrition: 0,  isAquatic: false, infraType: "CAMP" },
  32: { goodId: 32, goodKey: "tar",            profession: "Foundry Worker",          workplaceType: "FORGE",          workplaceName: "Pitch & Coking Kilns",          kind: "crafted", isFood: false, foodNutrition: 0,  isAquatic: false, infraType: "WORKSHOP" },
  33: { goodId: 33, goodKey: "saltpeter",      profession: "Miner",                   workplaceType: "MINE",           workplaceName: "Niter & Saltpeter Caverns",     kind: "primary", isFood: false, foodNutrition: 0,  isAquatic: false, infraType: "MINE" },
  34: { goodId: 34, goodKey: "coal",           profession: "Foundry Worker",          workplaceType: "FORGE",          workplaceName: "Charcoal & Smelting Kilns",     kind: "crafted", isFood: false, foodNutrition: 0,  isAquatic: false, infraType: "WORKSHOP" },
  35: { goodId: 35, goodKey: "oil",            profession: "Alchemist",               workplaceType: "APOTHECARY",     workplaceName: "Oil Press & Refinery",          kind: "crafted", isFood: false, foodNutrition: 0,  isAquatic: false, infraType: "WORKSHOP" },
  36: { goodId: 36, goodKey: "mahogany",       profession: "Woodcutter",              workplaceType: "LOGGING_CAMP",   workplaceName: "Heartwood Logging Camp",        kind: "primary", isFood: false, foodNutrition: 0,  isAquatic: false, infraType: "CAMP" },
  37: { goodId: 37, goodKey: "blubber",        profession: "Fisherman",               workplaceType: "FISHERY",        workplaceName: "Pelagic Whaling Quay",          kind: "primary", isFood: true,  foodNutrition: 8,  isAquatic: true,  infraType: "CAMP" },
  38: { goodId: 38, goodKey: "sugar",          profession: "Farmer",                  workplaceType: "FARMSTEAD",      workplaceName: "Cane Fields & Mill",            kind: "primary", isFood: true,  foodNutrition: 8,  isAquatic: false, infraType: "FARM" },
  39: { goodId: 39, goodKey: "tea",            profession: "Farmer",                  workplaceType: "FARMSTEAD",      workplaceName: "Hillside Tea Terraces",         kind: "primary", isFood: false, foodNutrition: 0,  isAquatic: false, infraType: "FARM" },
  40: { goodId: 40, goodKey: "tobacco",        profession: "Farmer",                  workplaceType: "FARMSTEAD",      workplaceName: "Curing Barns & Leaf Plots",     kind: "primary", isFood: false, foodNutrition: 0,  isAquatic: false, infraType: "FARM" },
  41: { goodId: 41, goodKey: "clay",           profession: "Quarryman",               workplaceType: "QUARRY",         workplaceName: "Alluvial Clay Pits",            kind: "primary", isFood: false, foodNutrition: 0,  isAquatic: false, infraType: "QUARRY" },
  42: { goodId: 42, goodKey: "white_sand",     profession: "Quarryman",               workplaceType: "QUARRY",         workplaceName: "Silica Sand Excavations",       kind: "primary", isFood: false, foodNutrition: 0,  isAquatic: false, infraType: "QUARRY" },
  43: { goodId: 43, goodKey: "leather",        profession: "Tanner",                  workplaceType: "TANNERY",        workplaceName: "Currier Tannery",               kind: "crafted", isFood: false, foodNutrition: 0,  isAquatic: false, infraType: "WORKSHOP" },
  44: { goodId: 44, goodKey: "cloth",          profession: "Weaver",                  workplaceType: "WEAVERY",        workplaceName: "Draper Loom Guild",             kind: "crafted", isFood: false, foodNutrition: 0,  isAquatic: false, infraType: "WORKSHOP" },
  45: { goodId: 45, goodKey: "garments",       profession: "Weaver",                  workplaceType: "WEAVERY",        workplaceName: "Tailors & Loom Guild",          kind: "crafted", isFood: false, foodNutrition: 0,  isAquatic: false, infraType: "WORKSHOP" },
  46: { goodId: 46, goodKey: "ceramics",       profession: "Potter",                  workplaceType: "POTTERY",        workplaceName: "Pottery Kiln Shed",             kind: "crafted", isFood: false, foodNutrition: 0,  isAquatic: false, infraType: "WORKSHOP" },
  47: { goodId: 47, goodKey: "glass",          profession: "Potter",                  workplaceType: "POTTERY",        workplaceName: "Glassblowing Kiln",             kind: "crafted", isFood: false, foodNutrition: 0,  isAquatic: false, infraType: "WORKSHOP" },
  48: { goodId: 48, goodKey: "ropes",          profession: "Weaver",                  workplaceType: "WEAVERY",        workplaceName: "Cordage & Rope Walk",           kind: "crafted", isFood: false, foodNutrition: 0,  isAquatic: false, infraType: "WORKSHOP" },
  49: { goodId: 49, goodKey: "paper",          profession: "Town Scribe",             workplaceType: "REGISTRY",       workplaceName: "Paper Mill & Scriptorium",      kind: "crafted", isFood: false, foodNutrition: 0,  isAquatic: false, infraType: "WORKSHOP" },
  50: { goodId: 50, goodKey: "ink",            profession: "Town Scribe",             workplaceType: "REGISTRY",       workplaceName: "Scriptorium & Inkworks",        kind: "crafted", isFood: false, foodNutrition: 0,  isAquatic: false, infraType: "WORKSHOP" },
  51: { goodId: 51, goodKey: "books",          profession: "Town Scribe",             workplaceType: "REGISTRY",       workplaceName: "Chancellery & Bindery",         kind: "crafted", isFood: false, foodNutrition: 0,  isAquatic: false, infraType: "WORKSHOP" },
  52: { goodId: 52, goodKey: "sails",          profession: "Weaver",                  workplaceType: "WEAVERY",        workplaceName: "Canvas Sail-Loft",              kind: "crafted", isFood: false, foodNutrition: 0,  isAquatic: false, infraType: "WORKSHOP" },
  53: { goodId: 53, goodKey: "boats",          profession: "Carpenter",               workplaceType: "CARPENTRY",      workplaceName: "Shipwright Slipways",           kind: "crafted", isFood: false, foodNutrition: 0,  isAquatic: false, infraType: "WORKSHOP" },
  54: { goodId: 54, goodKey: "boots",          profession: "Tanner",                  workplaceType: "TANNERY",        workplaceName: "Bootmaker & Tannery",           kind: "crafted", isFood: false, foodNutrition: 0,  isAquatic: false, infraType: "WORKSHOP" },
  55: { goodId: 55, goodKey: "tack",           profession: "Tanner",                  workplaceType: "TANNERY",        workplaceName: "Saddlery & Harness Shop",       kind: "crafted", isFood: false, foodNutrition: 0,  isAquatic: false, infraType: "WORKSHOP" },
  56: { goodId: 56, goodKey: "barrels",        profession: "Carpenter",               workplaceType: "CARPENTRY",      workplaceName: "Cooperage & Woodcraft",         kind: "crafted", isFood: false, foodNutrition: 0,  isAquatic: false, infraType: "WORKSHOP" },
  57: { goodId: 57, goodKey: "bronze",         profession: "Blacksmith",              workplaceType: "FORGE",          workplaceName: "Bronze Smeltery & Smithy",      kind: "crafted", isFood: false, foodNutrition: 0,  isAquatic: false, infraType: "WORKSHOP" },
  58: { goodId: 58, goodKey: "tools",          profession: "Blacksmith",              workplaceType: "FORGE",          workplaceName: "Ironworks & Tool Smithy",       kind: "crafted", isFood: false, foodNutrition: 0,  isAquatic: false, infraType: "WORKSHOP" },
  59: { goodId: 59, goodKey: "arms",           profession: "Armorer",                 workplaceType: "FORGE",          workplaceName: "Armory & Weapon Smithy",        kind: "crafted", isFood: false, foodNutrition: 0,  isAquatic: false, infraType: "WORKSHOP" },
  60: { goodId: 60, goodKey: "gunpowder",      profession: "Alchemist",               workplaceType: "APOTHECARY",     workplaceName: "Blackstone Powder Mill",        kind: "crafted", isFood: false, foodNutrition: 0,  isAquatic: false, infraType: "WORKSHOP" },
  61: { goodId: 61, goodKey: "artillery",      profession: "Blacksmith",              workplaceType: "FORGE",          workplaceName: "Ordnance Foundry",              kind: "crafted", isFood: false, foodNutrition: 0,  isAquatic: false, infraType: "WORKSHOP" },
  62: { goodId: 62, goodKey: "coins",          profession: "Goldsmith",               workplaceType: "MINT_JEWELRY",   workplaceName: "Bullion Mint & Assay Hall",     kind: "crafted", isFood: false, foodNutrition: 0,  isAquatic: false, infraType: "WORKSHOP" },
  63: { goodId: 63, goodKey: "jewelry",        profession: "Goldsmith",               workplaceType: "MINT_JEWELRY",   workplaceName: "Jewelers & Goldsmith Atelier",  kind: "crafted", isFood: false, foodNutrition: 0,  isAquatic: false, infraType: "WORKSHOP" },
  64: { goodId: 64, goodKey: "preserved_food", profession: "Baker",                   workplaceType: "BAKERY",         workplaceName: "Ration Curing & Bakehouse",     kind: "crafted", isFood: true,  foodNutrition: 15, isAquatic: false, infraType: "WORKSHOP" },
  65: { goodId: 65, goodKey: "vinegar",        profession: "Baker",                   workplaceType: "BAKERY",         workplaceName: "Vinegar Vat & Bakehouse",       kind: "crafted", isFood: false, foodNutrition: 0,  isAquatic: false, infraType: "WORKSHOP" },
  66: { goodId: 66, goodKey: "cheese",         profession: "Baker",                   workplaceType: "BAKERY",         workplaceName: "Creamery & Provision House",    kind: "crafted", isFood: true,  foodNutrition: 15, isAquatic: false, infraType: "WORKSHOP" },
  67: { goodId: 67, goodKey: "beer",           profession: "Brewmaster",              workplaceType: "BREWERY",        workplaceName: "Brewhouse & Tavern",            kind: "crafted", isFood: true,  foodNutrition: 8,  isAquatic: false, infraType: "WORKSHOP" },
  68: { goodId: 68, goodKey: "liquor",         profession: "Brewmaster",              workplaceType: "BREWERY",        workplaceName: "Distillery & Brewhouse",        kind: "crafted", isFood: false, foodNutrition: 0,  isAquatic: false, infraType: "WORKSHOP" },
  69: { goodId: 69, goodKey: "candles",        profession: "Alchemist",               workplaceType: "APOTHECARY",     workplaceName: "Chandlery & Dispensary",        kind: "crafted", isFood: false, foodNutrition: 0,  isAquatic: false, infraType: "WORKSHOP" },
  70: { goodId: 70, goodKey: "soap",           profession: "Alchemist",               workplaceType: "APOTHECARY",     workplaceName: "Tallow Boiler & Dispensary",    kind: "crafted", isFood: false, foodNutrition: 0,  isAquatic: false, infraType: "WORKSHOP" },
  71: { goodId: 71, goodKey: "perfume",        profession: "Alchemist",               workplaceType: "APOTHECARY",     workplaceName: "Perfumery & Alchemical Lab",    kind: "crafted", isFood: false, foodNutrition: 0,  isAquatic: false, infraType: "WORKSHOP" },
};

const DEFAULT_ROLE: GoodRoleSpec = GOOD_ROLE_BY_ID[9]!;

export function getProfessionForGood(goodId: number): GoodRoleSpec {
  return GOOD_ROLE_BY_ID[Number(goodId)] || DEFAULT_ROLE;
}

export const CIVIC_PROFESSIONS = new Set<string>([
  "Town Scribe",
  "Magistrate",
  "Stonemason",
  "Carpenter",
  "Cooper",
  "Clockmaker",
]);

export const SECURITY_PROFESSIONS = new Set<string>([
  "City Watchman",
  "Gate Sentry",
  "Town Investigator",
  "Militia Guard",
  "Garrison Scout",
  "Caravan Guard",
  "Guard",
]);

export const SOCIAL_SPIRITUAL_PROFESSIONS = new Set<string>([
  "Temple Acolyte",
  "Temple Priest",
  "Priest",
  "Hedge Herbalist",
  "Apothecary Apprentice",
  "Sanctuary Healer",
]);

export const LOGISTICS_PROFESSIONS = new Set<string>([
  "Merchant Factor",
  "Merchant Trader",
  "Caravan Drover",
  "Caravan Guard",
  "Sailor",
  "Aether-Crew",
]);

export function getWorkplaceForProfession(profession: string, burgName: string): { type: string; name: string } {
  const b = burgName || "Town";
  switch (profession) {
    case "Baker":
      return { type: "BAKERY", name: `${b} Communal Hearth Bakery` };
    case "Grain Miller":
      return { type: "MILL", name: `${b} Granary & Windmill` };
    case "Farmer":
    case "Disenfranchised Laborer":
    case "Laborer":
      return { type: "FARMSTEAD", name: `${b} Outlying Granary & Fields` };
    case "Livestock Herder":
      return { type: "PASTURE", name: `${b} Pasture & Stockyards` };
    case "Orchardist":
      return { type: "ORCHARD_APIARY", name: `${b} Orchards & Apiaries` };
    case "Hunter & Trapper":
      return { type: "HUNTING_CAMP", name: `${b} Wilds Hunting Lodge` };
    case "Fisherman":
      return { type: "FISHERY", name: `${b} Basin Fishery Quay` };
    case "Woodcutter":
    case "Lumberjack":
      return { type: "LOGGING_CAMP", name: `${b} Timber Logging Camp` };
    case "Quarryman":
      return { type: "QUARRY", name: `${b} Stone & Clay Quarry` };
    case "Miner":
      return { type: "MINE", name: `${b} Ore Seam Mines` };
    case "Blacksmith":
    case "Armorer":
    case "Foundry Worker":
      return { type: "FORGE", name: `${b} Armory & Smithy` };
    case "Brewmaster":
    case "Brewer":
      return { type: "BREWERY", name: `${b} Brewhouse & Tavern` };
    case "Carpenter":
    case "Cooper":
      return { type: "CARPENTRY", name: `${b} Woodcraft & Cooperage` };
    case "Tanner":
    case "Cobbler":
      return { type: "TANNERY", name: `${b} Currier Tannery` };
    case "Weaver":
      return { type: "WEAVERY", name: `${b} Draper Loom Guild` };
    case "Potter":
      return { type: "POTTERY", name: `${b} Pottery & Glass Kiln` };
    case "Goldsmith":
      return { type: "MINT_JEWELRY", name: `${b} Assay Mint & Goldsmiths` };
    case "City Watchman":
    case "Gate Sentry":
    case "Militia Guard":
    case "Garrison Scout":
    case "Town Investigator":
    case "Guard":
      return { type: "BARRACKS", name: `${b} City Watch Barracks` };
    case "Hedge Herbalist":
    case "Apothecary":
    case "Apothecary Apprentice":
    case "Sanctuary Healer":
    case "Alchemist":
      return { type: "APOTHECARY", name: `${b} Herbal Dispensary & Lab` };
    case "Temple Acolyte":
    case "Temple Priest":
    case "Priest":
      return { type: "TEMPLE", name: `${b} Sanctuary of the Seals` };
    case "Merchant Factor":
    case "Merchant Trader":
      return { type: "MARKET_STALL", name: `${b} Central Market Exchange` };
    case "Caravan Drover":
    case "Caravan Guard":
      return { type: "CARAVAN_YARD", name: `${b} Overland Caravan Yard` };
    case "Sailor":
      return { type: "HARBOR_QUAY", name: `${b} Harbor Wharf & Slipways` };
    case "Aether-Crew":
      return { type: "SKY_DOCK", name: `${b} High Sky-Dock Mooring` };
    case "Town Scribe":
    case "Magistrate":
      return { type: "REGISTRY", name: `${b} Chancellery & Registry` };
    case "Clockmaker":
      return { type: "PRECISION_ATELIER", name: `${b} Horologist Atelier` };
    case "Stonemason":
      return { type: "MASONRY", name: `${b} Stonecutting Yard` };
    default:
      return { type: "CIVIC_GUILD", name: `${b} Provincial Guild` };
  }
}
