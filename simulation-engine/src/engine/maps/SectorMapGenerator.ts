import zlib from "zlib";
import { getLairPropDetails, generateUniqueOutlawOperative } from "../agents/outlawSyndicates";

export interface SectorMapResult {
  grid: Uint8Array;
  compressed: Buffer;
  props: Array<{
    id: string;
    name: string;
    pos: [number, number];
    tags: string[];
    hp: number;
    maxHp: number;
    description: string;
  }>;
  npcs: Array<{
    id: string;
    name: string;
    role: string;
    pos: [number, number];
    tags: string[];
    faction: string;
    hp: number;
    maxHp: number;
    disposition: number;
    alive: boolean;
    equippedWeapon?: string;
    equippedArmor?: string;
    statAffinity?: string;
    memoryNotes?: string[];
    stats?: Record<string, number>;
  }>;
  poiType: string;
  name: string;
  features: Record<string, any>;
}

// PRNG helper
function sfc32(a: number, b: number, c: number, d: number) {
  return function () {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

function hashSeed(seedStr: string): () => number {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return sfc32(h, h ^ 0xdeadbeef, h ^ 0xcafebabe, h ^ 0x12345678);
}

// Tile IDs:
// 0: Base / Open Ground
// 1: Trees / Forest / Dense Vegetation
// 2: Water (River, Moat, Harbor, Lake)
// 3: Dirt Path / Flagstone / Rural Lane
// 4: Cobblestone Road / Royal Way / Plaza
// 5: Stone Wall / Bastion / Citadel Wall / Megalith
// 6: Chaos Core / Dragon Seal / Runic Conduit
// 7: Wooden Cottage / Tent / Timber Barn
// 8: Hearth / Forge / Campfire / Signal Beacon
// 9: Blood / Blight / Scorched Ash
// 10: Ward Stone / Monolith / Monument
// 11: Mud / Marsh
// 12: Slag / Crater / Scorched Rock

const SIZE = 256;
const CENTER = 128;

export interface BurgSectorLayersResult {
  layerMinus1: SectorMapResult; // Subterranean: Basements, Sewers, Tunnels
  layer0: SectorMapResult;      // Surface: Ground Level Streets, Plazas, Buildings
  layerPlus1: SectorMapResult;  // Elevated: Upper Floors, Ramparts, Sky-Bridges
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. BURG URBAN CORE GENERATOR (3 Synchronized Vertical Layers)
// ─────────────────────────────────────────────────────────────────────────────
interface ConcordiaStats {
  [key: string]: number;
  might: number;
  endurance: number;
  finesse: number;
  reflex: number;
  vitality: number;
  fortitude: number;
  knowledge: number;
  logic: number;
  awareness: number;
  intuition: number;
  charm: number;
  willpower: number;
}

// Helper to calculate 12 Concordia attributes deterministically from citizen traits and profession
function computeCitizenConcordiaStats(c: any, rand: () => number): ConcordiaStats {
  const base = 10;
  const stats: ConcordiaStats = {
    might: base + Math.floor(rand() * 4),
    endurance: base + Math.floor(rand() * 4),
    finesse: base + Math.floor(rand() * 4),
    reflex: base + Math.floor(rand() * 4),
    vitality: base + Math.floor(rand() * 4),
    fortitude: base + Math.floor(rand() * 4),
    knowledge: base + Math.floor(rand() * 4),
    logic: base + Math.floor(rand() * 4),
    awareness: base + Math.floor(rand() * 4),
    intuition: base + Math.floor(rand() * 4),
    charm: base + Math.floor(rand() * 4),
    willpower: base + Math.floor(rand() * 4)
  };

  const prof = (c.profession || "").toLowerCase();
  if (prof.includes("smith") || prof.includes("armorer") || prof.includes("foundry") || prof.includes("miner")) {
    stats.might += 4;
    stats.endurance += 3;
    stats.fortitude += 3;
  } else if (prof.includes("guard") || prof.includes("sentry") || prof.includes("soldier") || prof.includes("watchman") || prof.includes("commander")) {
    stats.might += 3;
    stats.fortitude += 3;
    stats.reflex += 2;
  } else if (prof.includes("scribe") || prof.includes("scholar") || prof.includes("clerk")) {
    stats.knowledge += 5;
    stats.logic += 4;
  } else if (prof.includes("apothecary") || prof.includes("herbalist") || prof.includes("healer")) {
    stats.knowledge += 4;
    stats.intuition += 4;
  } else if (prof.includes("merchant") || prof.includes("trader") || prof.includes("governor") || prof.includes("mayor")) {
    stats.charm += 5;
    stats.logic += 3;
  } else if (prof.includes("weaver") || prof.includes("tailor") || prof.includes("clockmaker")) {
    stats.finesse += 5;
    stats.awareness += 3;
  } else if (prof.includes("baker") || prof.includes("brewer") || prof.includes("farmer") || prof.includes("miller")) {
    stats.endurance += 4;
    stats.vitality += 3;
  }

  return stats;
}

interface WorkplaceSpec {
  type: string;
  title: string;
  floorTile: number;
  hasCellar: boolean;
  hasUpper: boolean;
  hasOven?: boolean;
  hasAltar?: boolean;
  propTag: string[];
  propDesc: string;
}

const WORKPLACE_SPECS: Record<string, WorkplaceSpec> = {
  BAKERY: { type: "BAKERY", title: "Communal Hearth Bakery", floorTile: 3, hasCellar: false, hasUpper: false, hasOven: true, propTag: ["bakery", "food", "fire", "crafting"], propDesc: "Blazing brick bread ovens, flour barrels, and cooling racks." },
  FORGE: { type: "FORGE", title: "Armory & Blacksmith Forge", floorTile: 4, hasCellar: false, hasUpper: false, hasOven: true, propTag: ["forge", "metal", "fire", "crafting"], propDesc: "Heavy iron anvil, dual bellows, and a blazing coal furnace." },
  BREWERY: { type: "BREWERY", title: "Cask & Fermentation Brewhouse", floorTile: 3, hasCellar: true, hasUpper: false, propTag: ["brewhouse", "food", "container", "crafting"], propDesc: "Copper mash tuns, fermentation vats, and aged oak kegs." },
  CARPENTRY: { type: "CARPENTRY", title: "Timber Framing Workshop", floorTile: 3, hasCellar: false, hasUpper: false, propTag: ["carpentry", "wood", "crafting"], propDesc: "Adzes, broadaxes, sawhorses, and timber framing joints." },
  TANNERY: { type: "TANNERY", title: "Leather Currying Tannery", floorTile: 3, hasCellar: false, hasUpper: false, propTag: ["tannery", "leather", "crafting"], propDesc: "Scraping frames, tanning vats, and cured leather hides." },
  WEAVERY: { type: "WEAVERY", title: "Draper Loom Guildhouse", floorTile: 3, hasCellar: false, hasUpper: false, propTag: ["weaving", "cloth", "crafting"], propDesc: "Vertical timber looms, spinning distaffs, and wool bolts." },
  POTTERY: { type: "POTTERY", title: "Clay Pottery & Brick Kiln", floorTile: 3, hasCellar: false, hasUpper: false, hasOven: true, propTag: ["pottery", "fire", "stone"], propDesc: "Domed brick kiln, turning wheels, and drying storage jars." },
  BARRACKS: { type: "BARRACKS", title: "Sovereign Guard Barracks", floorTile: 4, hasCellar: false, hasUpper: true, propTag: ["barracks", "military", "weapon", "defense"], propDesc: "Weapon racks, iron footlockers, and muster yard equipment." },
  FARMSTEAD: { type: "FARMSTEAD", title: "Agrarian Granary & Farmstead", floorTile: 3, hasCellar: true, hasUpper: false, propTag: ["farming", "food", "granary"], propDesc: "Threshed grain bins, seed sacks, and winnowing sieves." },
  FISHERY: { type: "FISHERY", title: "Harbor Fishery & Smokehouse", floorTile: 3, hasCellar: false, hasUpper: false, propTag: ["fishery", "food", "water"], propDesc: "Salted herring casks, smoke racks, and drying seine nets." },
  APOTHECARY: { type: "APOTHECARY", title: "Apothecary Herbarium & Dispensary", floorTile: 3, hasCellar: true, hasUpper: false, propTag: ["medical", "alchemy", "herbalism"], propDesc: "Drying healing mosses, glass alembics, and tincture flasks." },
  TEMPLE: { type: "TEMPLE", title: "Sanctuary of the Dragon Seals", floorTile: 4, hasCellar: true, hasUpper: true, hasAltar: true, propTag: ["sacred", "holy", "altar", "relic"], propDesc: "Polished stone altar, runic leylines, and incense burners." },
  REGISTRY: { type: "REGISTRY", title: "Municipal Registry & Town Hall", floorTile: 4, hasCellar: true, hasUpper: true, propTag: ["civic", "paper", "registry"], propDesc: "Magistrate desks, official provincial wax seals, and tax rolls." },
  PRECISION_ATELIER: { type: "PRECISION_ATELIER", title: "Horological Atelier & Clocksmith", floorTile: 4, hasCellar: false, hasUpper: false, propTag: ["machinery", "clockwork", "crafting"], propDesc: "Brass gears, escapement wheels, and fine engraving loupes." },
  MASONRY: { type: "MASONRY", title: "Stonemason Cutting Yard", floorTile: 4, hasCellar: false, hasUpper: false, propTag: ["stone", "masonry", "crafting"], propDesc: "Granite ashlar blocks, stone chisels, and plumb lines." },
  MARKET_STALL: { type: "MARKET_STALL", title: "Central Trade Exchange Stalls", floorTile: 3, hasCellar: false, hasUpper: false, propTag: ["market", "commerce", "container"], propDesc: "Canopied market stalls heaped with regional produce and goods." }
};

export function generateBurgSectorLayers(
  burg: any,
  factionName: string,
  cellId: number,
  citizens: any[] = [],
  lairs: any[] = [],
  paragons: any[] = []
): BurgSectorLayersResult {
  const rand = hashSeed(`burg_${burg.burg_id}_${cellId}`);
  const burgName = burg.name || `Burg #${burg.burg_id}`;
  const tier = Number(burg.urban_tier) || (Number(burg.pop_null) > 12000 ? 3 : Number(burg.pop_null) > 1200 ? 2 : 1);
  const isPort = Boolean(burg.port);
  const hasWalls = tier >= 2;

  const WALL_LEFT = tier >= 3 ? 24 : 44;
  const WALL_RIGHT = tier >= 3 ? 232 : 212;
  const WALL_TOP = tier >= 3 ? 24 : 44;
  const WALL_BOTTOM = tier >= 3 ? 232 : 212;
  const CENTER = 128;

  // -------------------------------------------------------------------------
  // LAYER 0: SURFACE GROUND LEVEL
  // -------------------------------------------------------------------------
  const grid0 = new Uint8Array(SIZE * SIZE);
  grid0.fill(0); // Natural ground

  // 1. Fortified Walls (Only for Towns Tier 2, Cities Tier 3, and Capitals)
  if (hasWalls) {
    for (let x = WALL_LEFT; x <= WALL_RIGHT; x++) {
      grid0[WALL_TOP * SIZE + x] = 5;
      grid0[(WALL_TOP + 1) * SIZE + x] = 5;
      if (!isPort) {
        grid0[WALL_BOTTOM * SIZE + x] = 5;
        grid0[(WALL_BOTTOM - 1) * SIZE + x] = 5;
      }
    }
    for (let y = WALL_TOP; y <= (isPort ? WALL_BOTTOM - 20 : WALL_BOTTOM); y++) {
      grid0[y * SIZE + WALL_LEFT] = 5;
      grid0[y * SIZE + WALL_LEFT + 1] = 5;
      grid0[y * SIZE + WALL_RIGHT] = 5;
      grid0[y * SIZE + WALL_RIGHT - 1] = 5;
    }

    // Corner Bastions (Tier 3/4 Cities only)
    if (tier >= 3) {
      const drawBastion = (cx: number, cy: number) => {
        for (let dy = -4; dy <= 4; dy++) {
          for (let dx = -4; dx <= 4; dx++) {
            const tx = cx + dx, ty = cy + dy;
            if (tx >= 0 && tx < SIZE && ty >= 0 && ty < SIZE) grid0[ty * SIZE + tx] = 5;
          }
        }
      };
      drawBastion(WALL_LEFT, WALL_TOP);
      drawBastion(WALL_RIGHT, WALL_TOP);
      if (!isPort) {
        drawBastion(WALL_LEFT, WALL_BOTTOM);
        drawBastion(WALL_RIGHT, WALL_BOTTOM);
      }
    }
  }

  // 2. Cardinal Thoroughfares & Roads
  const mainRoadWidth = tier >= 3 ? 3 : 2;
  const roadTile = tier >= 2 ? 4 : 3;

  for (let y = 0; y < SIZE; y++) {
    for (let dx = -mainRoadWidth; dx <= mainRoadWidth; dx++) {
      const x = CENTER + dx;
      if (x >= 0 && x < SIZE) grid0[y * SIZE + x] = roadTile;
    }
  }
  for (let x = 0; x < SIZE; x++) {
    for (let dy = -mainRoadWidth; dy <= mainRoadWidth; dy++) {
      const y = CENTER + dy;
      if (y >= 0 && y < SIZE) grid0[y * SIZE + x] = roadTile;
    }
  }

  // 3. Central Marketplace / Common Green
  const plazaRadius = tier >= 3 ? 16 : tier === 2 ? 10 : 7;
  const plazaTile = tier >= 2 ? 4 : 3;
  for (let dy = -plazaRadius; dy <= plazaRadius; dy++) {
    for (let dx = -plazaRadius; dx <= plazaRadius; dx++) {
      const px = CENTER + dx, py = CENTER + dy;
      if (px >= 0 && px < SIZE && py >= 0 && py < SIZE) {
        grid0[py * SIZE + px] = plazaTile;
      }
    }
  }

  // 4. Harbor Basin / Coastal Waterfront (If Port)
  if (isPort) {
    for (let y = WALL_BOTTOM - 14; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) grid0[y * SIZE + x] = 2; // Water
    }
    const pierXs = [CENTER - 30, CENTER, CENTER + 30];
    for (const px of pierXs) {
      for (let y = WALL_BOTTOM - 18; y < SIZE - 8; y++) {
        for (let w = -2; w <= 2; w++) {
          if (px + w >= 0 && px + w < SIZE) grid0[y * SIZE + (px + w)] = 3;
        }
      }
    }
  }

  // 5. Dynamic Workplaces Derived from Actual Citizen Demographics
  const citizensByWorkplace = new Map<string, any[]>();
  for (const c of citizens) {
    const wt = c.workplace_type || "FARMSTEAD";
    if (!citizensByWorkplace.has(wt)) citizensByWorkplace.set(wt, []);
    citizensByWorkplace.get(wt)!.push(c);
  }

  let activeWorkplaceTypes = Array.from(citizensByWorkplace.keys());
  if (activeWorkplaceTypes.length === 0) {
    activeWorkplaceTypes = tier >= 2
      ? ["FARMSTEAD", "BAKERY", "BARRACKS", "CARPENTRY", "MARKET_STALL"]
      : ["FARMSTEAD", "BAKERY", "CARPENTRY"];
  }

  const candidatePlots: Array<{ cx: number; cy: number; w: number; h: number }> = [
    { cx: CENTER - 26, cy: CENTER - 26, w: 7, h: 6 }, // NW Inner (Often Barracks)
    { cx: CENTER + 26, cy: CENTER - 26, w: 7, h: 6 }, // NE Inner (Often Town Hall/Registry)
    { cx: CENTER - 26, cy: CENTER + 26, w: 7, h: 6 }, // SW Inner
    { cx: CENTER + 26, cy: CENTER + 26, w: 7, h: 6 }, // SE Inner
    { cx: CENTER - 48, cy: CENTER - 24, w: 7, h: 6 }, // NW Outer
    { cx: CENTER + 48, cy: CENTER - 24, w: 7, h: 6 }, // NE Outer
    { cx: CENTER - 48, cy: CENTER + 24, w: 7, h: 6 }, // SW Outer
    { cx: CENTER + 48, cy: CENTER + 24, w: 7, h: 6 }, // SE Outer
    { cx: CENTER - 24, cy: CENTER - 48, w: 6, h: 6 }, // North-West Far
    { cx: CENTER + 24, cy: CENTER - 48, w: 6, h: 6 }, // North-East Far
    { cx: CENTER - 24, cy: CENTER + 48, w: 6, h: 6 }, // South-West Far
    { cx: CENTER + 24, cy: CENTER + 48, w: 6, h: 6 }  // South-East Far
  ];

  interface PlacedBuilding {
    spec: WorkplaceSpec;
    cx: number;
    cy: number;
    w: number;
    h: number;
    citizens: any[];
  }
  const placedBuildings: PlacedBuilding[] = [];

  if (tier >= 2 && !activeWorkplaceTypes.includes("REGISTRY")) {
    activeWorkplaceTypes.unshift("REGISTRY");
  }

  for (let i = 0; i < activeWorkplaceTypes.length && i < candidatePlots.length; i++) {
    const wt = activeWorkplaceTypes[i]!;
    const spec = WORKPLACE_SPECS[wt] || WORKPLACE_SPECS.FARMSTEAD!;
    const plot = candidatePlots[i]!;
    const assignedCitizens = citizensByWorkplace.get(wt) || [];

    placedBuildings.push({
      spec,
      cx: plot.cx,
      cy: plot.cy,
      w: plot.w,
      h: plot.h,
      citizens: assignedCitizens
    });
  }

  const props0: SectorMapResult["props"] = [
    {
      id: `prop_fountain_${burg.burg_id}`,
      name: tier >= 3 ? `Grand Public Fountain of ${burgName}` : `Central Well of ${burgName}`,
      pos: [CENTER, CENTER],
      tags: ["stone", "water", "civic", "container", "fountain"],
      hp: 150,
      maxHp: 150,
      description: `A communal stone water well providing clear drinking water to the citizens of ${burgName}.`
    }
  ];

  const npcs0: SectorMapResult["npcs"] = [];
  const npcsPlus1: SectorMapResult["npcs"] = [];

  // A. STATION CIVIC PARAGON (Mayor / Reeve) in Registry / Town Hall
  const civicParagon = paragons.find(p => !p.outlaw_id && (p.title.includes("Mayor") || p.title.includes("Reeve") || p.title.includes("Headman") || p.title.includes("Burgomaster")));
  const registryBuilding = placedBuildings.find(b => b.spec.type === "REGISTRY") || placedBuildings[0];

  if (civicParagon) {
    const pPos: [number, number] = registryBuilding ? [registryBuilding.cx, registryBuilding.cy] : [CENTER + 4, CENTER - 4];
    npcs0.push({
      id: `npc_paragon_${civicParagon.id}`,
      name: `${civicParagon.name} (${civicParagon.title})`,
      role: civicParagon.title,
      pos: pPos,
      tags: ["leader", "civilian", "paragon", "authority"],
      faction: factionName,
      hp: 35,
      maxHp: 35,
      disposition: 1,
      alive: true,
      equippedWeapon: "Gilded Ceremonial Rapier",
      equippedArmor: "Velvet Robes & Gold Seal Chain",
      statAffinity: "charm",
      memoryNotes: [
        `Sovereign Civic Leader of ${burgName}.`,
        `Title: ${civicParagon.title}. Corruption Score: ${civicParagon.corruption_score || 0}.`
      ],
      stats: { might: 11, endurance: 12, finesse: 13, reflex: 12, vitality: 12, fortitude: 11, knowledge: 16, logic: 16, awareness: 14, intuition: 15, charm: 17, willpower: 15 }
    });
  }

  // B. STATION SECURITY PARAGON (Watch Commander) in Barracks
  const securityParagon = paragons.find(p => !p.outlaw_id && (p.title.includes("Commander") || p.title.includes("Marshal") || p.title.includes("Captain") || p.title.includes("Warden")));
  const barracksBuilding = placedBuildings.find(b => b.spec.type === "BARRACKS") || placedBuildings[1];

  if (securityParagon) {
    const bPos: [number, number] = barracksBuilding ? [barracksBuilding.cx, barracksBuilding.cy] : [CENTER - 4, CENTER - 4];
    npcs0.push({
      id: `npc_paragon_${securityParagon.id}`,
      name: `${securityParagon.name} (${securityParagon.title})`,
      role: securityParagon.title,
      pos: bPos,
      tags: ["military", "soldier", "paragon", "commander"],
      faction: factionName,
      hp: 42,
      maxHp: 42,
      disposition: 0,
      alive: true,
      equippedWeapon: "Masterwork Steel Greatsword & Heavy Crossbow",
      equippedArmor: "Full Steel Plate & Plumed Sallet",
      statAffinity: "might",
      memoryNotes: [
        `Supreme Military Garrison Commander of ${burgName}.`,
        `Title: ${securityParagon.title}.`
      ],
      stats: { might: 17, endurance: 16, finesse: 14, reflex: 14, vitality: 15, fortitude: 16, knowledge: 12, logic: 13, awareness: 15, intuition: 14, charm: 13, willpower: 15 }
    });
  }

  // C. MILITARY UNITS IN GROUPS OF 12 (from burg.military_forces)
  let militaryUnits: any = {};
  try {
    if (burg.military_forces) {
      militaryUnits = typeof burg.military_forces === 'string' ? JSON.parse(burg.military_forces) : burg.military_forces;
    }
  } catch (e) {}

  if (!militaryUnits || Object.keys(militaryUnits).length === 0) {
    militaryUnits = { militia: 12 };
  }

  for (const [unitType, count] of Object.entries(militaryUnits)) {
    const totalCount = Number(count) || 0;
    if (totalCount > 0) {
      const squadCount = Math.max(1, Math.floor(totalCount / 12));
      const uTypeLower = unitType.toLowerCase();
      const isArcher = uTypeLower.includes("archer") || uTypeLower.includes("ranged");
      const isCavalry = uTypeLower.includes("cavalry") || uTypeLower.includes("mounted");
      const isAirship = uTypeLower.includes("airship");

      for (let sq = 0; sq < squadCount && sq < 3; sq++) {
        const squadPos: [number, number] = isArcher && hasWalls
          ? [WALL_LEFT + 25 + sq * 35, WALL_TOP + 1]
          : [CENTER - 28 + sq * 4, CENTER - 20 + sq * 3];

        const squadNpc = {
          id: `npc_mil_squad_${burg.burg_id}_${unitType}_${sq}`,
          name: `${burgName} ${unitType.toUpperCase()} Squad #${sq + 1} (Unit of 12)`,
          role: `${unitType} Detachment`,
          pos: squadPos,
          tags: ["military", "soldier", uTypeLower, "patrol"],
          faction: factionName,
          hp: 36,
          maxHp: 36,
          disposition: 0,
          alive: true,
          equippedWeapon: isArcher ? "Composite Recurve Bow & Bodkin Quiver" : isCavalry ? "Cavalry Lance & Broadsword" : isAirship ? "Dragonstone Harpoon Cannon" : "Steel Halberd & Tower Shield",
          equippedArmor: isCavalry || !isArcher ? "Chainmail Hauberk & Steel Kettle Helm" : "Boiled Leather Gambeson & Archer Coif",
          statAffinity: isArcher ? "awareness" : isCavalry ? "reflex" : "fortitude",
          memoryNotes: [
            `Active ${unitType} military detachment defending ${burgName}.`,
            `Operational strength: 12 sworn combatants under sovereign banner of ${factionName}.`
          ],
          stats: { might: 14, endurance: 14, finesse: 13, reflex: 14, vitality: 14, fortitude: 14, knowledge: 10, logic: 11, awareness: 14, intuition: 13, charm: 10, willpower: 13 }
        };

        if (isArcher && hasWalls) {
          npcsPlus1.push(squadNpc);
        } else {
          npcs0.push(squadNpc);
        }
      }
    }
  }

  // D. STATION LIVING CITIZENS FROM POPULATION_DEMOGRAPHICS IN WORKPLACES
  for (const b of placedBuildings) {
    const wallTile = tier === 1 ? 7 : 5;
    const floorTile = b.spec.floorTile;

    for (let dy = -b.h; dy <= b.h; dy++) {
      for (let dx = -b.w; dx <= b.w; dx++) {
        const px = b.cx + dx, py = b.cy + dy;
        if (px >= 0 && px < SIZE && py >= 0 && py < SIZE) {
          if (Math.abs(dx) === b.w || Math.abs(dy) === b.h) {
            grid0[py * SIZE + px] = wallTile;
          } else {
            grid0[py * SIZE + px] = floorTile;
          }
        }
      }
    }
    const doorX = b.cx + (b.cx < CENTER ? b.w : -b.w);
    const doorY = b.cy;
    grid0[doorY * SIZE + doorX] = floorTile;

    if (b.spec.hasOven) {
      grid0[(b.cy - b.h + 2) * SIZE + (b.cx - b.w + 2)] = 8;
    }
    if (b.spec.hasAltar) {
      grid0[b.cy * SIZE + b.cx] = 10;
    }

    props0.push({
      id: `prop_${b.spec.type.toLowerCase()}_${burg.burg_id}`,
      name: `${b.spec.title} of ${burgName}`,
      pos: [b.cx, b.cy],
      tags: [...b.spec.propTag, "interactive"],
      hp: 120,
      maxHp: 120,
      description: b.spec.propDesc
    });

    if (b.spec.hasCellar) {
      props0.push({
        id: `prop_cellar_hatch_${b.spec.type.toLowerCase()}_${burg.burg_id}`,
        name: `${b.spec.title} Cellar Trapdoor`,
        pos: [b.cx + 2, b.cy + 1],
        tags: ["wood", "hatch", "down", "stairs_down", "cellar", "subterranean"],
        hp: 60,
        maxHp: 60,
        description: `Iron-strapped oak trapdoor opening down into the ${b.spec.title.toLowerCase()} basement.`
      });
    }

    if (b.spec.hasUpper) {
      props0.push({
        id: `prop_stairs_up_${b.spec.type.toLowerCase()}_${burg.burg_id}`,
        name: `${b.spec.title} Upper Flight Stairs`,
        pos: [b.cx - 2, b.cy - 1],
        tags: ["wood", "stairs_up", "up", "elevated"],
        hp: 80,
        maxHp: 80,
        description: `Stair flight ascending to the second floor of the ${b.spec.title.toLowerCase()}.`
      });
    }

    for (let ci = 0; ci < b.citizens.length && ci < 2; ci++) {
      const c = b.citizens[ci]!;
      const stats = computeCitizenConcordiaStats(c, rand);

      npcs0.push({
        id: `npc_citizen_${c.citizen_id}`,
        name: `${c.name} (${c.profession})`,
        role: c.profession,
        pos: [b.cx + (ci === 0 ? 0 : 1), b.cy + (ci === 0 ? 0 : -1)],
        tags: [c.species ? c.species.toLowerCase() : "human", "civilian", c.workplace_type ? c.workplace_type.toLowerCase() : "trade"],
        faction: factionName,
        hp: 25,
        maxHp: 25,
        disposition: 1,
        alive: true,
        equippedWeapon: c.profession.includes("Smith") ? "Heavy Blacksmith Hammer" : c.profession.includes("Guard") ? "City Watch Spear" : "Carved Wooden Cudgel",
        equippedArmor: c.profession.includes("Guard") ? "Studded Leather Cuirass" : "Woven Wool Tunic & Apron",
        statAffinity: c.temper ? c.temper.toLowerCase() : "vitality",
        memoryNotes: [
          c.childhood_background || "Raised locally among the workshops of the province.",
          c.motivation || "Devoted to their daily labor and community.",
          `Employed at ${c.workplace_name || b.spec.title}.`
        ],
        stats
      });
    }
  }

  if (hasWalls) {
    props0.push(
      {
        id: `prop_wall_stairs_north_${burg.burg_id}`,
        name: "North Curtain Wall Stairs Up",
        pos: [WALL_LEFT + 4, WALL_TOP + 3],
        tags: ["stone", "stairs_up", "up", "ramparts", "elevated"],
        hp: 180,
        maxHp: 180,
        description: "Stone staircase rising to the north wall parapet walkway."
      },
      {
        id: `prop_wall_stairs_south_${burg.burg_id}`,
        name: "South Curtain Wall Stairs Up",
        pos: [WALL_RIGHT - 4, WALL_BOTTOM - 3],
        tags: ["stone", "stairs_up", "up", "ramparts", "elevated"],
        hp: 180,
        maxHp: 180,
        description: "Stone staircase rising to the south wall parapet walkway."
      }
    );
  }

  if (tier >= 3) {
    props0.push({
      id: `prop_sewer_grate_${burg.burg_id}`,
      name: "Municipal Plaza Sewer Grate",
      pos: [CENTER + 3, CENTER + 3],
      tags: ["metal", "iron", "grate", "down", "stairs_down", "sewer", "subterranean"],
      hp: 180,
      maxHp: 180,
      description: "Heavy forged iron grating offering descent into the city stormwater culvert system."
    });
  }

  const layer0: SectorMapResult = {
    grid: grid0,
    compressed: zlib.gzipSync(Buffer.from(grid0)),
    props: props0,
    npcs: npcs0,
    poiType: "BURG_CORE",
    name: `${burgName} (Surface Ground Level)`,
    features: {
      burgId: burg.burg_id,
      urbanTier: tier,
      isPort,
      wealth: burg.wealth,
      unrest: burg.unrest,
      factionName,
      zLayer: 0
    }
  };

  // -------------------------------------------------------------------------
  // LAYER -1: SUBTERRANEAN BASEMENTS & UNDERWORLD
  // -------------------------------------------------------------------------
  const gridMinus1 = new Uint8Array(SIZE * SIZE);
  gridMinus1.fill(5);

  const propsMinus1: SectorMapResult["props"] = [];
  const npcsMinus1: SectorMapResult["npcs"] = [];

  // A. Municipal Sewer Canal (Only in Tier 3+ Cities)
  if (tier >= 3) {
    for (let x = WALL_LEFT; x <= WALL_RIGHT; x++) {
      gridMinus1[(CENTER - 1) * SIZE + x] = 4;
      gridMinus1[CENTER * SIZE + x] = 2;
      gridMinus1[(CENTER + 1) * SIZE + x] = 4;
    }
    for (let y = WALL_TOP; y <= WALL_BOTTOM; y++) {
      gridMinus1[y * SIZE + (CENTER - 1)] = 4;
      gridMinus1[y * SIZE + CENTER] = 2;
      gridMinus1[y * SIZE + (CENTER + 1)] = 4;
    }
    propsMinus1.push({
      id: `prop_sewer_ladder_up_${burg.burg_id}`,
      name: "Municipal Sewer Ladder Up to Plaza",
      pos: [CENTER + 3, CENTER + 3],
      tags: ["metal", "iron", "ladder", "up", "surface"],
      hp: 120,
      maxHp: 120,
      description: "Vertical iron climbing rungs ascending to the street plaza grating."
    });

    npcsMinus1.push({
      id: `npc_burg_sewer_beast_${burg.burg_id}`,
      name: "Culvert Dire Rat",
      role: "Trophic Sewer Scavenger",
      pos: [CENTER + 5, CENTER + 2],
      tags: ["beast", "rodent", "trophic_scavenger"],
      faction: "Wild Fauna",
      hp: 16,
      maxHp: 16,
      disposition: -1,
      alive: true,
      equippedWeapon: "Infectious Disease Bite",
      statAffinity: "reflex",
      memoryNotes: ["Nests in the municipal drainage culverts, scavenging discarded food scraps."],
      stats: { might: 8, endurance: 11, finesse: 15, reflex: 16, vitality: 10, fortitude: 9, knowledge: 3, logic: 4, awareness: 15, intuition: 14, charm: 3, willpower: 10 }
    });
  }

  // B. Basements Aligned Directly Beneath Surface Buildings That Have Cellars
  for (const b of placedBuildings) {
    if (!b.spec.hasCellar) continue;

    for (let dy = -b.h + 1; dy <= b.h - 1; dy++) {
      for (let dx = -b.w + 1; dx <= b.w - 1; dx++) {
        const px = b.cx + dx, py = b.cy + dy;
        if (px >= 0 && px < SIZE && py >= 0 && py < SIZE) {
          gridMinus1[py * SIZE + px] = 4;
        }
      }
    }

    propsMinus1.push({
      id: `prop_cellar_ladder_up_${b.spec.type.toLowerCase()}_${burg.burg_id}`,
      name: `${b.spec.title} Cellar Ladder Up`,
      pos: [b.cx + 2, b.cy + 1],
      tags: ["wood", "ladder", "up", "surface"],
      hp: 80,
      maxHp: 80,
      description: `Vertical wooden ladder climbing up to the ground-floor trapdoor.`
    });

    propsMinus1.push({
      id: `prop_sub_storage_${b.spec.type.toLowerCase()}_${burg.burg_id}`,
      name: `${b.spec.title} Storage Vault`,
      pos: [b.cx - 1, b.cy - 1],
      tags: ["wood", "container", "valuable"],
      hp: 90,
      maxHp: 90,
      description: `Cool underground vault storing bulk casks, root crops, or sacramental archives.`
    });
  }

  // C. Dynamic Underworld & Cartel Features (Driven EXCLUSIVELY by active sim_fringe_lairs)
  if (lairs && lairs.length > 0) {
    for (let li = 0; li < lairs.length; li++) {
      const lair = lairs[li]!;
      const cartelName = lair.cartel_name || "Underworld Syndicate";
      const lairType = lair.lair_type || "VICE_DEN";

      const lx = CENTER + (li % 2 === 0 ? -40 : 40);
      const ly = CENTER + (li < 2 ? 40 : -40);

      for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -5; dx <= 5; dx++) {
          const px = lx + dx, py = ly + dy;
          if (px >= 0 && px < SIZE && py >= 0 && py < SIZE) gridMinus1[py * SIZE + px] = 3;
        }
      }

      if (hasWalls && (lairType.includes("SMUGGLER") || lairType.includes("VAULT") || lairType.includes("CONTRABAND"))) {
        const exitX = WALL_LEFT - 8;
        for (let x = Math.min(lx - 5, exitX); x <= Math.max(lx - 5, exitX); x++) {
          gridMinus1[ly * SIZE + x] = 3;
        }
        propsMinus1.push({
          id: `prop_smuggler_escape_hatch_${burg.burg_id}_${lair.id}`,
          name: `${cartelName} Wilderness Escape Flue`,
          pos: [exitX, ly],
          tags: ["wood", "hatch", "secret", "ladder", "up", "surface"],
          hp: 100,
          maxHp: 100,
          description: "Camouflaged trapdoor burrowed under the outer wall opening into the wilderness brush."
        });
        props0.push({
          id: `prop_surface_secret_hatch_${burg.burg_id}_${lair.id}`,
          name: "Camouflaged Brush Trapdoor",
          pos: [exitX, ly],
          tags: ["wood", "hatch", "secret", "down", "stairs_down", "subterranean"],
          hp: 80,
          maxHp: 80,
          description: "Concealed iron-ringed trapdoor overgrown with brambles outside the town wall."
        });
      }

      propsMinus1.push({
        id: `prop_cartel_cache_${burg.burg_id}_${lair.id}`,
        name: `${cartelName} Contraband Cache (${lairType})`,
        pos: [lx, ly],
        tags: ["wood", "contraband", "valuable", "locked", "container"],
        hp: 150,
        maxHp: 150,
        description: `Sealed lockboxes containing illicit contraband and ledger notes of ${cartelName}.`
      });

      // Link directly to Outlaw Paragon if active in this syndicate
      const outlawParagon = paragons.find(p => p.outlaw_id === lair.faction_id);
      const opName = outlawParagon ? `${outlawParagon.name} (${outlawParagon.title})` : `${cartelName} Lair Overseer`;
      const opRole = outlawParagon ? outlawParagon.title : "Syndicate Lair Master";

      npcsMinus1.push({
        id: `npc_cartel_agent_${lair.id}`,
        name: opName,
        role: opRole,
        pos: [lx + 1, ly],
        tags: ["humanoid", "outlaw", "criminal", "smuggler", "paragon"],
        faction: cartelName,
        hp: 38,
        maxHp: 38,
        disposition: -1,
        alive: true,
        equippedWeapon: "Blackened Steel Kris & Hand Crossbow",
        equippedArmor: "Darkened Muffled Leather Cuirass",
        statAffinity: "finesse",
        memoryNotes: [
          `Oversees the ${lairType} for ${cartelName}.`,
          `Manpower: ${lair.manpower || 50}, Heat: ${lair.heat || 0}.`
        ],
        stats: { might: 14, endurance: 13, finesse: 16, reflex: 15, vitality: 13, fortitude: 12, knowledge: 12, logic: 14, awareness: 16, intuition: 15, charm: 13, willpower: 14 }
      });
    }
  }

  const layerMinus1: SectorMapResult = {
    grid: gridMinus1,
    compressed: zlib.gzipSync(Buffer.from(gridMinus1)),
    props: propsMinus1,
    npcs: npcsMinus1,
    poiType: "SUBTERRANEAN_SECTOR",
    name: `${burgName} (Subterranean Basements & Underworld)`,
    features: {
      burgId: burg.burg_id,
      urbanTier: tier,
      isPort,
      wealth: burg.wealth,
      unrest: burg.unrest,
      factionName,
      zLayer: -1
    }
  };

  // -------------------------------------------------------------------------
  // LAYER +1: ELEVATED RAMPARTS & UPPER FLOORS
  // -------------------------------------------------------------------------
  const gridPlus1 = new Uint8Array(SIZE * SIZE);
  gridPlus1.fill(0); // Default open air

  const propsPlus1: SectorMapResult["props"] = [];

  // A. Curtain Wall Ramparts (Only if town has walls)
  if (hasWalls) {
    for (let x = WALL_LEFT; x <= WALL_RIGHT; x++) {
      gridPlus1[WALL_TOP * SIZE + x] = 5;
      gridPlus1[(WALL_TOP + 1) * SIZE + x] = 4;
      if (!isPort) {
        gridPlus1[(WALL_BOTTOM - 1) * SIZE + x] = 4;
        gridPlus1[WALL_BOTTOM * SIZE + x] = 5;
      }
    }
    for (let y = WALL_TOP; y <= (isPort ? WALL_BOTTOM - 20 : WALL_BOTTOM); y++) {
      gridPlus1[y * SIZE + WALL_LEFT] = 5;
      gridPlus1[y * SIZE + WALL_LEFT + 1] = 4;
      gridPlus1[y * SIZE + WALL_RIGHT] = 5;
      gridPlus1[y * SIZE + WALL_RIGHT - 1] = 4;
    }

    propsPlus1.push(
      {
        id: `prop_wall_stairs_north_down_${burg.burg_id}`,
        name: "North Curtain Wall Steps Down",
        pos: [WALL_LEFT + 4, WALL_TOP + 3],
        tags: ["stone", "stairs_down", "down", "surface"],
        hp: 180,
        maxHp: 180,
        description: "Stone staircase descending from the parapet walkway to street level."
      },
      {
        id: `prop_wall_stairs_south_down_${burg.burg_id}`,
        name: "South Curtain Wall Steps Down",
        pos: [WALL_RIGHT - 4, WALL_BOTTOM - 3],
        tags: ["stone", "stairs_down", "down", "surface"],
        hp: 180,
        maxHp: 180,
        description: "Stone staircase descending from the battlements to street level."
      }
    );

    npcsPlus1.push({
      id: `npc_rampart_sentry_${burg.burg_id}`,
      name: `${burgName} Rampart Sentry`,
      role: "Wall Watchman",
      pos: [WALL_LEFT + 12, WALL_TOP + 1],
      tags: ["human", "guard", "military"],
      faction: factionName,
      hp: 34,
      maxHp: 34,
      disposition: 1,
      alive: true,
      equippedWeapon: "Reinforced Yew Longbow & Quiver",
      equippedArmor: "Hardened Leather & Iron Sallet",
      statAffinity: "awareness",
      memoryNotes: [`Scans the surrounding horizon from the battlements of ${burgName}.`],
      stats: { might: 13, endurance: 14, finesse: 16, reflex: 15, vitality: 13, fortitude: 13, knowledge: 10, logic: 11, awareness: 17, intuition: 14, charm: 10, willpower: 13 }
    });
  }

  // B. Upper Floors Aligned Directly Above Surface Buildings With hasUpper
  for (const b of placedBuildings) {
    if (!b.spec.hasUpper) continue;

    for (let dy = -b.h + 1; dy <= b.h - 1; dy++) {
      for (let dx = -b.w + 1; dx <= b.w - 1; dx++) {
        const px = b.cx + dx, py = b.cy + dy;
        if (px >= 0 && px < SIZE && py >= 0 && py < SIZE) {
          gridPlus1[py * SIZE + px] = 4;
        }
      }
    }

    propsPlus1.push({
      id: `prop_upper_stairs_down_${b.spec.type.toLowerCase()}_${burg.burg_id}`,
      name: `${b.spec.title} Flight Stairs Down`,
      pos: [b.cx - 2, b.cy - 1],
      tags: ["wood", "stairs_down", "down", "surface"],
      hp: 80,
      maxHp: 80,
      description: `Wooden staircase descending to the ground floor.`
    });

    if (b.spec.type === "REGISTRY") {
      propsPlus1.push({
        id: `prop_council_chamber_${burg.burg_id}`,
        name: `${burgName} High Council Chamber Table`,
        pos: [b.cx, b.cy],
        tags: ["wood", "civic", "paper", "furniture"],
        hp: 70,
        maxHp: 70,
        description: "Walnut round table draped with official maps, sovereign charters, and provincial tax rolls."
      });
    } else if (b.spec.type === "TEMPLE") {
      propsPlus1.push({
        id: `prop_temple_bell_${burg.burg_id}`,
        name: "Great Sanctuary Tolling Bell",
        pos: [b.cx, b.cy],
        tags: ["metal", "bronze", "sacred", "alarm", "heavy"],
        hp: 250,
        maxHp: 250,
        description: "Enormous inscribed bronze bell tolling liturgical hours and martial alarms."
      });
    }
  }

  // C. Free Sky-Baron Contraband Rooftop Gantry (If Sky-Barons operate in this burg)
  if (lairs && lairs.some(l => (l.cartel_name || "").includes("Sky-Baron") || l.lair_type === "CONTRABAND_DOCK")) {
    const gx = WALL_LEFT + 20, gy = WALL_TOP + 10;
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        gridPlus1[(gy + dy) * SIZE + (gx + dx)] = 3;
      }
    }
    propsPlus1.push({
      id: `prop_skybaron_gantry_${burg.burg_id}`,
      name: "Concealed Sky-Baron Rooftop Winch Crane",
      pos: [gx, gy],
      tags: ["wood", "aviation", "contraband", "crane", "mechanism"],
      hp: 140,
      maxHp: 140,
      description: "Counterweighted timber crane and concealed landing platform for high-altitude contraband drops."
    });
  }

  const layerPlus1: SectorMapResult = {
    grid: gridPlus1,
    compressed: zlib.gzipSync(Buffer.from(gridPlus1)),
    props: propsPlus1,
    npcs: npcsPlus1,
    poiType: "ELEVATED_SECTOR",
    name: `${burgName} (Upper Floors, Ramparts & Sky-Bridges)`,
    features: {
      burgId: burg.burg_id,
      urbanTier: tier,
      isPort,
      wealth: burg.wealth,
      unrest: burg.unrest,
      factionName,
      zLayer: 1
    }
  };

  return {
    layerMinus1,
    layer0,
    layerPlus1
  };
}

export function generateBurgSectorMap(
  burg: any,
  factionName: string,
  cellId: number,
  citizens: any[] = [],
  lairs: any[] = []
): SectorMapResult {
  const layers = generateBurgSectorLayers(burg, factionName, cellId, citizens, lairs);
  return layers.layer0;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. OUTLYING REGION GENERATORS (Hamlets, Farmlands, Logging, Watchtowers)
// ─────────────────────────────────────────────────────────────────────────────

export function generateOutlyingSectorMap(
  parentBurg: any,
  sectorType: "HAMLET" | "FARMLAND" | "LOGGING" | "WATCHTOWER",
  rx: number,
  ry: number,
  cellId: number,
  factionName: string
): SectorMapResult {
  const rand = hashSeed(`outlying_${cellId}_${rx}_${ry}_${sectorType}`);
  const grid = new Uint8Array(SIZE * SIZE);
  grid.fill(0);

  const CENTER = 128;
  const parentName = parentBurg?.name || `Burg #${parentBurg?.burg_id || 1}`;

  const props: SectorMapResult["props"] = [];
  const npcs: SectorMapResult["npcs"] = [];
  let sectorName = "";

  if (sectorType === "HAMLET") {
    sectorName = `${parentName} Outskirts: Hamlet of Oakhaven`;
    // Crossroad of dirt roads (tile 3)
    for (let i = 0; i < SIZE; i++) {
      for (let w = -2; w <= 2; w++) {
        if (CENTER + w >= 0 && CENTER + w < SIZE) {
          grid[i * SIZE + (CENTER + w)] = 3;
          grid[(CENTER + w) * SIZE + i] = 3;
        }
      }
    }
    // Small communal green in center (cobblestone around well)
    for (let dy = -6; dy <= 6; dy++) {
      for (let dx = -6; dx <= 6; dx++) {
        if (Math.hypot(dx, dy) <= 6) grid[(CENTER + dy) * SIZE + (CENTER + dx)] = 4;
      }
    }
    // 8-12 Rustic Cottages and barns along the crossroads
    const cottageOffsets: Array<[number, number]> = [
      [-25, -20], [-25, 20], [25, -20], [25, 20],
      [-45, -15], [45, 15], [-15, -45], [15, 45],
      [-35, 40], [35, -40]
    ];
    for (const [ox, oy] of cottageOffsets) {
      const cx = CENTER + ox, cy = CENTER + oy;
      for (let by = -4; by <= 4; by++) {
        for (let bx = -5; bx <= 5; bx++) {
          grid[(cy + by) * SIZE + (cx + bx)] = 7; // Cottage roof
        }
      }
    }
    // Trees scattered around village perimeter
    for (let i = 0; i < 400; i++) {
      const tx = Math.floor(rand() * SIZE);
      const ty = Math.floor(rand() * SIZE);
      if (Math.hypot(tx - CENTER, ty - CENTER) > 40 && grid[ty * SIZE + tx] === 0) {
        grid[ty * SIZE + tx] = 1;
      }
    }

    props.push(
      {
        id: `prop_hamlet_well_${cellId}_${rx}_${ry}`,
        name: "Communal Stone Well & Trough",
        pos: [CENTER, CENTER],
        tags: ["stone", "water", "container", "village_well"],
        hp: 100,
        maxHp: 100,
        description: "A moss-covered stone well drawing from an underground coldwater spring."
      },
      {
        id: `prop_hamlet_granary_${cellId}_${rx}_${ry}`,
        name: "Cooperative Timber Granary & Hay Barn",
        pos: [CENTER + 20, CENTER - 25],
        tags: ["wood", "food", "granary", "container"],
        hp: 120,
        maxHp: 120,
        description: "Elevated timber storehouse filled with grain sacks, dried barley, and farm implements."
      },
      {
        id: `prop_hamlet_shrine_${cellId}_${rx}_${ry}`,
        name: "Wayside Earth-Mother Shrine",
        pos: [CENTER - 18, CENTER + 18],
        tags: ["stone", "sacred", "shrine"],
        hp: 80,
        maxHp: 80,
        description: "Carved boundary stone hung with woven straw dolls and seasonal wildflowers."
      }
    );

    npcs.push(
      {
        id: `npc_hamlet_elder_${cellId}_${rx}_${ry}`,
        name: "Elder Theresa of the Green",
        role: "Hamlet Reeve",
        pos: [CENTER + 3, CENTER + 3],
        tags: ["leader", "villager", "farmer"],
        faction: factionName,
        hp: 20,
        maxHp: 20,
        disposition: 1,
        alive: true,
        statAffinity: "intuition",
        memoryNotes: [`Leads the hamlet attached to ${parentName}.`]
      },
      {
        id: `npc_hamlet_guard_${cellId}_${rx}_${ry}`,
        name: "Militia Yeoman Thomas",
        role: "Hamlet Warder",
        pos: [CENTER, CENTER - 12],
        tags: ["guard", "militia", "armed"],
        faction: factionName,
        hp: 25,
        maxHp: 25,
        disposition: 1,
        alive: true,
        equippedWeapon: "Shortbow & Hunting Spear",
        statAffinity: "finesse"
      }
    );
  } else if (sectorType === "FARMLAND") {
    sectorName = `${parentName} Agrarian Valley: Granary Fields`;
    // Gridded crop fields with furrows and stone hedgerows
    for (let y = 20; y < SIZE - 20; y++) {
      for (let x = 20; x < SIZE - 20; x++) {
        if (x % 32 === 0 || y % 32 === 0) {
          grid[y * SIZE + x] = 5; // Stone low wall / hedgerow
        } else if (x % 4 === 0) {
          grid[y * SIZE + x] = 3; // Furrow line
        }
      }
    }
    // Main wagon cart road cutting diagonally
    for (let i = 0; i < SIZE; i++) {
      for (let w = -2; w <= 2; w++) {
        const x = i + w;
        if (x >= 0 && x < SIZE) grid[i * SIZE + x] = 3;
      }
    }
    // Central Threshing Farmstead and Windmill
    for (let dy = -8; dy <= 8; dy++) {
      for (let dx = -10; dx <= 10; dx++) {
        grid[(CENTER + dy) * SIZE + (CENTER + dx)] = 7; // Granary building
      }
    }
    // Windmill round stone tower
    for (let dy = -5; dy <= 5; dy++) {
      for (let dx = -5; dx <= 5; dx++) {
        if (Math.hypot(dx, dy) <= 5) grid[(CENTER - 25 + dy) * SIZE + (CENTER + 25 + dx)] = 5;
      }
    }

    props.push(
      {
        id: `prop_farm_mill_${cellId}_${rx}_${ry}`,
        name: "High Windmill & Grain Grinder",
        pos: [CENTER + 25, CENTER - 25],
        tags: ["stone", "wood", "mill", "industrial"],
        hp: 200,
        maxHp: 200,
        description: "A towering windmill turning massive granite millstones to produce coarse flour."
      },
      {
        id: `prop_farm_hay_${cellId}_${rx}_${ry}`,
        name: "Heavy Farm Wagon & Hay Wains",
        pos: [CENTER + 5, CENTER + 12],
        tags: ["wood", "cargo", "flammable"],
        hp: 50,
        maxHp: 50,
        description: "Four-wheeled wooden farm wagons stacked with freshly reaped golden sheaves."
      }
    );

    npcs.push({
      id: `npc_miller_${cellId}_${rx}_${ry}`,
      name: "Miller Garret",
      role: "Head Grain-Master",
      pos: [CENTER + 22, CENTER - 20],
      tags: ["artisan", "farmer", "miller"],
      faction: factionName,
      hp: 24,
      maxHp: 24,
      disposition: 1,
      alive: true,
      statAffinity: "might"
    });
  } else if (sectorType === "LOGGING") {
    sectorName = `${parentName} Timberlands: Clearcut Sawmill`;
    // Dense surrounding forest
    for (let i = 0; i < SIZE * SIZE; i++) {
      if (rand() < 0.6) grid[i] = 1; // Dense woods
    }
    // Cleared central glade (30 radius)
    for (let dy = -40; dy <= 40; dy++) {
      for (let dx = -40; dx <= 40; dx++) {
        if (Math.hypot(dx, dy) <= 38) {
          const idx = (CENTER + dy) * SIZE + (CENTER + dx);
          grid[idx] = rand() < 0.2 ? 11 : 0; // Cleared ground / mud
        }
      }
    }
    // Dirt timber hauling trail
    for (let y = 0; y < SIZE; y++) {
      for (let w = -3; w <= 3; w++) {
        grid[y * SIZE + (CENTER + w)] = 3;
      }
    }
    // Sawmill structure
    for (let dy = -6; dy <= 6; dy++) {
      for (let dx = -12; dx <= 12; dx++) {
        grid[(CENTER + dy) * SIZE + (CENTER - 18 + dx)] = 7;
      }
    }

    props.push(
      {
        id: `prop_sawmill_${cellId}_${rx}_${ry}`,
        name: "Water-Powered Timber Saws & Log Flume",
        pos: [CENTER - 18, CENTER],
        tags: ["wood", "metal", "industrial", "sawmill"],
        hp: 180,
        maxHp: 180,
        description: "Heavy iron blades cutting giant hardwood trunks into standard lumber beams for city construction."
      },
      {
        id: `prop_log_pyre_${cellId}_${rx}_${ry}`,
        name: "Massive Stack of Seasoned Hardwood Logs",
        pos: [CENTER + 15, CENTER + 10],
        tags: ["wood", "flammable", "raw_material"],
        hp: 150,
        maxHp: 150,
        description: "Pyramids of seasoned oak and pine trunks branded with the official seal of the forestry guild."
      }
    );

    npcs.push({
      id: `npc_foreman_${cellId}_${rx}_${ry}`,
      name: "Timber Foreman Torren",
      role: "Logging Master",
      pos: [CENTER - 10, CENTER],
      tags: ["worker", "logger", "armed"],
      faction: factionName,
      hp: 30,
      maxHp: 30,
      disposition: 1,
      alive: true,
      equippedWeapon: "Two-Handed Felling Axe",
      statAffinity: "might"
    });
  } else {
    // WATCHTOWER
    sectorName = `${parentName} High Frontier: Outpost Watchtower`;
    // Mountain/rocky elevation around watchtower
    for (let i = 0; i < 300; i++) {
      const rx = Math.floor(rand() * SIZE), ry = Math.floor(rand() * SIZE);
      grid[ry * SIZE + rx] = 5; // Rubble
    }
    // Wooden palisade wall ring (radius 22)
    for (let deg = 0; deg < 360; deg += 3) {
      const rad = (deg * Math.PI) / 180;
      const wx = Math.round(CENTER + Math.cos(rad) * 24);
      const wy = Math.round(CENTER + Math.sin(rad) * 24);
      if (deg < 80 || deg > 100) { // Gap for southern gate
        grid[wy * SIZE + wx] = 5;
      }
    }
    // High central stone tower (10x10)
    for (let dy = -5; dy <= 5; dy++) {
      for (let dx = -5; dx <= 5; dx++) {
        grid[(CENTER + dy) * SIZE + (CENTER + dx)] = 5;
      }
    }
    // Top beacon brazier at tower center
    grid[CENTER * SIZE + CENTER] = 8; // Blazing beacon

    props.push(
      {
        id: `prop_beacon_${cellId}_${rx}_${ry}`,
        name: "High Signal Beacon Brazier",
        pos: [CENTER, CENTER],
        tags: ["metal", "fire", "beacon", "signal"],
        hp: 200,
        maxHp: 200,
        description: `An iron brazier charged with alchemical pitch to signal alerts across the frontier to ${parentName}.`
      },
      {
        id: `prop_ballista_${cellId}_${rx}_${ry}`,
        name: "Heavy Swivel Ballista Mount",
        pos: [CENTER, CENTER - 18],
        tags: ["wood", "metal", "weapon", "siege"],
        hp: 120,
        maxHp: 120,
        description: "A torsion siege engine capable of launching steel-tipped bolts against raiding warbands or beasts."
      }
    );

    npcs.push({
      id: `npc_watch_commander_${cellId}_${rx}_${ry}`,
      name: "Watch Commander Kael",
      role: "Frontier Sentry Commander",
      pos: [CENTER, CENTER + 10],
      tags: ["guard", "soldier", "officer", "armed"],
      faction: factionName,
      hp: 32,
      maxHp: 32,
      disposition: 0,
      alive: true,
      equippedWeapon: "Heavy Composite Longbow & Broadsword",
      statAffinity: "awareness"
    });
  }

  return {
    grid,
    compressed: zlib.gzipSync(Buffer.from(grid)),
    props,
    npcs,
    poiType: `OUTLYING_${sectorType}`,
    name: sectorName,
    features: {
      parentBurgId: parentBurg?.burg_id,
      parentBurgName: parentName,
      sectorType,
      rx,
      ry,
      factionName
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. THE VERGE (THE SACRED SPIRE, CELL 16166)
// ─────────────────────────────────────────────────────────────────────────────

export function generateTheVergeSectorMap(cellId: number = 16166): SectorMapResult {
  const grid = new Uint8Array(SIZE * SIZE);
  grid.fill(0);
  const CENTER = 128;

  // Mountain precipice & chasms on outer edges
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const d = Math.hypot(x - CENTER, y - CENTER);
      if (d > 115) grid[y * SIZE + x] = 12; // Scorched volcanic precipice / void drop
    }
  }

  // 12 Radiating Primordial Chaos Flow Channels converging to center
  for (let i = 0; i < 12; i++) {
    const angle = (i * 30 * Math.PI) / 180;
    for (let r = 24; r < 115; r++) {
      const cx = Math.round(CENTER + Math.cos(angle) * r);
      const cy = Math.round(CENTER + Math.sin(angle) * r);
      for (let w = -1; w <= 1; w++) {
        const nx = cx + Math.round(Math.sin(angle) * w);
        const ny = cy - Math.round(Math.cos(angle) * w);
        if (nx >= 0 && nx < SIZE && ny >= 0 && ny < SIZE) {
          grid[ny * SIZE + nx] = 6; // Raw Chaos Channel
        }
      }
    }
  }

  // Concentric Adamantine Warden Citadel Ramparts
  for (const radius of [40, 70, 95]) {
    for (let deg = 0; deg < 360; deg += 2) {
      const rad = (deg * Math.PI) / 180;
      const x = Math.round(CENTER + Math.cos(rad) * radius);
      const y = Math.round(CENTER + Math.sin(rad) * radius);
      grid[y * SIZE + x] = 5; // Adamantine Wall
    }
  }

  // Sacred Core Platform (24x24 polished white marble & ward runes)
  for (let dy = -12; dy <= 12; dy++) {
    for (let dx = -12; dx <= 12; dx++) {
      grid[(CENTER + dy) * SIZE + (CENTER + dx)] = 4;
    }
  }

  // The Grand Spire of Aetheria (10x10 celestial monolith at the dead center)
  for (let dy = -5; dy <= 5; dy++) {
    for (let dx = -5; dx <= 5; dx++) {
      grid[(CENTER + dy) * SIZE + (CENTER + dx)] = 10; // Ward Monolith
    }
  }
  grid[CENTER * SIZE + CENTER] = 6; // Pulsing Nexus Core

  // 12 Outer Ward Pylons along the 40-radius ring
  for (let i = 0; i < 12; i++) {
    const angle = (i * 30 * Math.PI) / 180;
    const px = Math.round(CENTER + Math.cos(angle) * 40);
    const py = Math.round(CENTER + Math.sin(angle) * 40);
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        grid[(py + dy) * SIZE + (px + dx)] = 10; // Pylon
      }
    }
  }

  const props = [
    {
      id: "prop_the_verge_sacred_spire",
      name: "The Sacred Spire of Aetheria (Adamantine Axis)",
      pos: [CENTER, CENTER] as [number, number],
      tags: ["spire", "ancient", "adamantine", "nexus", "celestial", "indestructible"],
      hp: 100000,
      maxHp: 100000,
      description: "A titanic pillar of luminous, impossible adamantine that pierces the clouds. Here, the 12 Primordial Chaos Flows converge and are focused into the planetary seal."
    },
    {
      id: "prop_warden_high_citadel",
      name: "High Citadel of the Grey Wardens",
      pos: [CENTER + 25, CENTER - 25] as [number, number],
      tags: ["fortress", "stone", "adamantine", "sanctuary", "warden"],
      hp: 5000,
      maxHp: 5000,
      description: "The supreme chapterhouse of the Order of Grey Wardens, guarding the Spire since the First Fracture."
    },
    {
      id: "prop_airship_sky_dock",
      name: "Celestial Skyship Mooring Pylon",
      pos: [CENTER - 50, CENTER] as [number, number],
      tags: ["dock", "airship", "metal", "sky"],
      hp: 800,
      maxHp: 800,
      description: "A high-altitude gantry where Warden airships tether against the shearing winds of the summit."
    },
    {
      id: "prop_convergence_altar",
      name: "Focal Altar of the Twelve Dragon Seals",
      pos: [CENTER, CENTER + 14] as [number, number],
      tags: ["altar", "sacred", "dragon_seal", "magic", "relic"],
      hp: 2000,
      maxHp: 2000,
      description: "An intricate planetary astrolabe carved from star-metal, vibrating in harmony with the twelve cosmic dragons."
    }
  ];

  const npcs = [
    {
      id: "npc_spire_archon",
      name: "Archon Malakor the Eternal",
      role: "Supreme Archon of the Grey Wardens",
      pos: [CENTER + 2, CENTER + 8] as [number, number],
      tags: ["warden", "leader", "adept", "archon", "armed"],
      faction: "The Grey Wardens",
      hp: 150,
      maxHp: 150,
      disposition: 1,
      alive: true,
      equippedWeapon: "Spear of the First Sun (Aether Artifact)",
      equippedArmor: "Radiant Adamantine Aegis",
      statAffinity: "willpower",
      memoryNotes: [
        "Has guarded the Sacred Spire for three centuries.",
        "Monitors the fluctuating surges of all twelve Dragon Seals."
      ]
    },
    {
      id: "npc_spire_channeler",
      name: "High Astromancer Lyra",
      role: "Keeper of the Astrolabe",
      pos: [CENTER - 2, CENTER + 8] as [number, number],
      tags: ["warden", "astromancer", "channeler", "scholar"],
      faction: "The Grey Wardens",
      hp: 80,
      maxHp: 80,
      disposition: 1,
      alive: true,
      equippedWeapon: "Starlight Runic Focus",
      statAffinity: "knowledge",
      memoryNotes: ["Deciphers the cosmic movements of Cruorbus."]
    },
    {
      id: "npc_warden_sentinel_1",
      name: "Warden Justiciar Brian",
      role: "Spire Gatekeeper",
      pos: [CENTER, CENTER + 38] as [number, number],
      tags: ["warden", "guard", "soldier", "armed"],
      faction: "The Grey Wardens",
      hp: 75,
      maxHp: 75,
      disposition: 0,
      alive: true,
      equippedWeapon: "Sun-Forged Greatsword",
      statAffinity: "might"
    }
  ];

  return {
    grid,
    compressed: zlib.gzipSync(Buffer.from(grid)),
    props,
    npcs,
    poiType: "THE_VERGE_SPIRE",
    name: "The Verge (The Sacred Spire)",
    features: {
      isSpire: true,
      elevation: 990,
      activeFlows: 12,
      factionOwner: "The Grey Wardens"
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. THE 12 DRAGON PRISONS
// ─────────────────────────────────────────────────────────────────────────────

export interface DragonPrisonConfig {
  cellId: number;
  dragonName: string;
  elementalPower: string;
  clockPosition: number; // 1 to 12
  description: string;
}

export function generateDragonPrisonSectorMap(config: DragonPrisonConfig): SectorMapResult {
  const rand = hashSeed(`prison_${config.dragonName}_${config.cellId}`);
  const grid = new Uint8Array(SIZE * SIZE);
  grid.fill(0);
  const CENTER = 128;

  // 1. Terrain corruption matching Dragon's elemental power
  for (let i = 0; i < SIZE * SIZE; i++) {
    const r = rand();
    if (r < 0.15) grid[i] = 12; // Scorched slag / cracked obsidian
    else if (r < 0.25) grid[i] = 9; // Dragon blood seepage / glowing aether
    else if (r < 0.35) grid[i] = 5; // Rubble / broken monolithic shards
  }

  // 2. Colossal Circular Prison Seal (diameter 40, tile 6 and 10)
  const SEAL_RADIUS = 22;
  for (let dy = -SEAL_RADIUS - 4; dy <= SEAL_RADIUS + 4; dy++) {
    for (let dx = -SEAL_RADIUS - 4; dx <= SEAL_RADIUS + 4; dx++) {
      const d = Math.hypot(dx, dy);
      if (d <= SEAL_RADIUS) {
        grid[(CENTER + dy) * SIZE + (CENTER + dx)] = 6; // Dragon Core Glyphs
      } else if (d <= SEAL_RADIUS + 4) {
        grid[(CENTER + dy) * SIZE + (CENTER + dx)] = 10; // Runic Ward Ring
      }
    }
  }

  // 3. Four Titan Adamantine Binding Chains anchored to Cardinal Pylons
  const PYLON_DIST = 60;
  const cardinalPylons: Array<[number, number]> = [
    [CENTER, CENTER - PYLON_DIST], // North
    [CENTER, CENTER + PYLON_DIST], // South
    [CENTER - PYLON_DIST, CENTER], // West
    [CENTER + PYLON_DIST, CENTER]  // East
  ];

  for (const [px, py] of cardinalPylons) {
    // Pylon structure (6x6 solid stone)
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        grid[(py + dy) * SIZE + (px + dx)] = 5;
      }
    }
    // Chain line from Pylon to Seal
    const steps = PYLON_DIST - SEAL_RADIUS;
    const dx = (CENTER - px) / steps;
    const dy = (CENTER - py) / steps;
    for (let s = 0; s < steps; s++) {
      const cx = Math.round(px + dx * s);
      const cy = Math.round(py + dy * s);
      grid[cy * SIZE + cx] = 5; // Heavy adamantine link
      grid[cy * SIZE + cx + 1] = 5;
    }
  }

  // 4. Warden Sentry Fortification (North-East Flank)
  const fx = CENTER + 45, fy = CENTER - 45;
  for (let dy = -10; dy <= 10; dy++) {
    for (let dx = -10; dx <= 10; dx++) {
      if (Math.abs(dx) === 10 || Math.abs(dy) === 10) {
        grid[(fy + dy) * SIZE + (fx + dx)] = 5;
      } else {
        grid[(fy + dy) * SIZE + (fx + dx)] = 4;
      }
    }
  }

  // 5. Infiltrating Cultist Encampment (South-West Flank)
  const cx = CENTER - 50, cy = CENTER + 50;
  for (let i = 0; i < 4; i++) {
    const tx = cx + Math.floor(rand() * 20 - 10);
    const ty = cy + Math.floor(rand() * 20 - 10);
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) grid[(ty + dy) * SIZE + (tx + dx)] = 7; // Tent
    }
    grid[ty * SIZE + tx] = 8; // Cultist dark brazier
  }

  const props = [
    {
      id: `prop_dragon_seal_${config.dragonName.toLowerCase()}`,
      name: `Colossal Dragon Seal of ${config.dragonName} (${config.elementalPower})`,
      pos: [CENTER, CENTER] as [number, number],
      tags: ["dragon_seal", "ancient", "binding", config.elementalPower.toLowerCase(), "indestructible"],
      hp: 50000,
      maxHp: 50000,
      description: `The primordial planetary seal holding ${config.dragonName}, Chaos Dragon of ${config.elementalPower}. The ground roars with suppressed cosmic vibration.`
    },
    {
      id: `prop_binding_chains_${config.dragonName.toLowerCase()}`,
      name: "Titan Adamantine Binding Chains",
      pos: [CENTER, CENTER - 35] as [number, number],
      tags: ["metal", "adamantine", "chain", "warden"],
      hp: 10000,
      maxHp: 10000,
      description: "Forged before the First Fracture, each link as thick as an ancient oak tree, anchoring the Dragon into the world's bedrock."
    },
    {
      id: `prop_warden_post_${config.dragonName.toLowerCase()}`,
      name: "Grey Warden Seal-Watch Bastion",
      pos: [fx, fy] as [number, number],
      tags: ["stone", "fortification", "warden"],
      hp: 2000,
      maxHp: 2000,
      description: "Fortified garrison manned by sworn Wardens tasked with executing any infiltrator attempting to tamper with the binding pylons."
    },
    {
      id: `prop_cultist_incursion_${config.dragonName.toLowerCase()}`,
      name: "Clandestine Cultist Void Resonator",
      pos: [cx, cy] as [number, number],
      tags: ["cultist", "hazard", "occult", "unstable"],
      hp: 120,
      maxHp: 120,
      description: "A forbidden contraption of bone needles and blackened quartz trying to bleed chaos power from the seal."
    }
  ];

  const npcs = [
    {
      id: `npc_warden_keeper_${config.dragonName.toLowerCase()}`,
      name: `Warden Keeper Katherine of ${config.dragonName}`,
      role: "Warden Seal-Keeper",
      pos: [fx, fy] as [number, number],
      tags: ["warden", "keeper", "officer", "armed"],
      faction: "The Grey Wardens",
      hp: 60,
      maxHp: 60,
      disposition: 0,
      alive: true,
      equippedWeapon: "Adamantine Halberd & Binding Runes",
      equippedArmor: "Lead-Studded Steel Cuirass",
      statAffinity: "fortitude",
      memoryNotes: [`Vowed her life to maintain the seal of ${config.dragonName}.`]
    },
    {
      id: `npc_cult_saboteur_${config.dragonName.toLowerCase()}`,
      name: `Void Priest Malich`,
      role: "Cult Saboteur",
      pos: [cx, cy] as [number, number],
      tags: ["cultist", "enemy", "priest", "armed"],
      faction: "Chaos Cultist Covenant",
      hp: 35,
      maxHp: 35,
      disposition: -2,
      alive: true,
      equippedWeapon: "Occult Sacrificial Kris",
      statAffinity: "willpower",
      memoryNotes: [`Attempting to fracture the seal of ${config.dragonName} in Cruorbus's name.`]
    }
  ];

  return {
    grid,
    compressed: zlib.gzipSync(Buffer.from(grid)),
    props,
    npcs,
    poiType: "DRAGON_PRISON",
    name: `Dragon Prison: ${config.dragonName} (${config.elementalPower})`,
    features: {
      dragonName: config.dragonName,
      elementalPower: config.elementalPower,
      clockPosition: config.clockPosition,
      cellId: config.cellId
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. THE EYE / CORAL CROWN (CELL 16777)
// ─────────────────────────────────────────────────────────────────────────────

export function generateCoralCrownSectorMap(cellId: number = 16777): SectorMapResult {
  const grid = new Uint8Array(SIZE * SIZE);
  grid.fill(2); // Deep Ocean Base
  const CENTER = 128;

  // Turquoise shallow reef atoll (radius 75)
  for (let dy = -75; dy <= 75; dy++) {
    for (let dx = -75; dx <= 75; dx++) {
      const d = Math.hypot(dx, dy);
      if (d <= 75) {
        // Living coral shelf (tile 0) with lagoon channels
        grid[(CENTER + dy) * SIZE + (CENTER + dx)] = d < 20 || (Math.sin(dx * 0.1) * Math.cos(dy * 0.1) > 0.2) ? 0 : 2;
      }
    }
  }

  // Central Sunken Megalith Ring & Pearl Throne
  for (let deg = 0; deg < 360; deg += 30) {
    const rad = (deg * Math.PI) / 180;
    const px = Math.round(CENTER + Math.cos(rad) * 22);
    const py = Math.round(CENTER + Math.sin(rad) * 22);
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        grid[(py + dy) * SIZE + (px + dx)] = 10; // Bioluminescent Coral Megalith
      }
    }
  }
  // Pearl Throne dais
  for (let dy = -6; dy <= 6; dy++) {
    for (let dx = -6; dx <= 6; dx++) {
      grid[(CENTER + dy) * SIZE + (CENTER + dx)] = 4;
    }
  }

  const props = [
    {
      id: "prop_coral_crown_throne",
      name: "The Pearl Throne of the Coral Crown",
      pos: [CENTER, CENTER] as [number, number],
      tags: ["throne", "pearl", "coral", "sacred", "ocean_warden"],
      hp: 10000,
      maxHp: 10000,
      description: "Carved from a single massive incandescent pearl, surrounded by flowering sea lilies and bioluminescent coral."
    },
    {
      id: "prop_tide_sanctuary",
      name: "Tide-Mother Luminous Megalith Shrine",
      pos: [CENTER + 20, CENTER - 20] as [number, number],
      tags: ["stone", "coral", "shrine", "ocean"],
      hp: 1500,
      maxHp: 1500,
      description: "Vibrates with oceanic currents, attuning the mind to deep-sea resonance."
    }
  ];

  const npcs = [
    {
      id: "npc_ocean_high_priestess",
      name: "High Tideweaver Nerida",
      role: "Matriarch of the Ocean Wardens",
      pos: [CENTER, CENTER + 5] as [number, number],
      tags: ["warden", "ocean", "leader", "caster"],
      faction: "The Ocean Wardens",
      hp: 95,
      maxHp: 95,
      disposition: 1,
      alive: true,
      equippedWeapon: "Trident of Pearl Currents",
      statAffinity: "willpower",
      memoryNotes: ["Rules the Coral Crown and commands the abyssal currents."]
    }
  ];

  return {
    grid,
    compressed: zlib.gzipSync(Buffer.from(grid)),
    props,
    npcs,
    poiType: "CORAL_CROWN",
    name: "The Eye / Coral Crown (Ocean Wardens Seat)",
    features: {
      isCoralCrown: true,
      factionOwner: "The Ocean Wardens",
      cellId
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. DYNAMIC GRIND CANYON CHASM GENERATOR
// ─────────────────────────────────────────────────────────────────────────────
export function generateGrindCanyonSectorMap(
  canyon: any,
  cellId: number
): SectorMapResult {
  const rand = hashSeed(`canyon_${canyon.id}_${cellId}`);
  const grid = new Uint8Array(SIZE * SIZE);
  grid.fill(0); // Natural rugged terrain

  const chasmName = canyon.name || `Grind Canyon #${canyon.id}`;
  const domain = canyon.dragon_domain || "Tectonic";
  const depth = canyon.depth_meters || 280;
  const crewName = canyon.miner_crew_name || "Grind Canyon Corps - Sledge Crew";

  // 1. Carve a colossal, jagged chasm down the center (void / cracked basalt slag)
  let chasmCenterX = CENTER;
  for (let y = 0; y < SIZE; y++) {
    // Meander the chasm center jaggedly
    if (y % 4 === 0) {
      chasmCenterX += Math.floor((rand() - 0.5) * 4);
      chasmCenterX = Math.max(80, Math.min(176, chasmCenterX));
    }
    const width = 12 + Math.floor(rand() * 8); // 12-20 tiles wide

    for (let x = chasmCenterX - width; x <= chasmCenterX + width; x++) {
      if (x >= 0 && x < SIZE) {
        // Deep abyss edge vs scorched slag bottom
        const distFromCenter = Math.abs(x - chasmCenterX);
        if (distFromCenter < width - 2) {
          grid[y * SIZE + x] = 12; // Scorched slag / deep abyss floor
        } else {
          grid[y * SIZE + x] = 5; // Jagged sheared basalt cliff ledge
        }
      }
    }
  }

  // 2. Pre-Cruor Ruin Vault exposed by the rift (West Cliff-Face)
  const rx = chasmCenterX - 18, ry = CENTER - 20;
  for (let dy = -6; dy <= 6; dy++) {
    for (let dx = -6; dx <= 6; dx++) {
      const px = rx + dx, py = ry + dy;
      if (px >= 0 && px < SIZE && py >= 0 && py < SIZE) {
        if (Math.abs(dx) === 6 || Math.abs(dy) === 6) {
          grid[py * SIZE + px] = 5; // Ancient ruin stone wall
        } else {
          grid[py * SIZE + px] = 4; // Ancient flagstone vault floor
        }
      }
    }
  }

  // 3. Delver Staging Encampment & Smelting Pit (East Cliff-Face)
  const ex = chasmCenterX + 22, ey = CENTER + 15;
  for (let dy = -8; dy <= 8; dy++) {
    for (let dx = -8; dx <= 8; dx++) {
      const px = ex + dx, py = ey + dy;
      if (px >= 0 && px < SIZE && py >= 0 && py < SIZE) {
        if (Math.abs(dx) === 8 || Math.abs(dy) === 8) {
          grid[py * SIZE + px] = 3; // Timber log palisade / decking
        } else if (dx === 0 && dy === 0) {
          grid[py * SIZE + px] = 8; // Roaring slag smelting fire
        }
      }
    }
  }

  const props = [
    {
      id: `prop_grind_chasm_${canyon.id}`,
      name: `The Yawning Grind Canyon Abyss (${chasmName})`,
      pos: [chasmCenterX, CENTER] as [number, number],
      tags: ["abyss", "chasm", "tectonic", "dragonstone", "dangerous", "unstable"],
      hp: 50000,
      maxHp: 50000,
      description: `A terrifying tectonic fissure plunging ${depth}m into the planetary mantle. Roaring steam and grinding rock echo from the depths. Stability: ${canyon.stability_ticks_remaining} days remaining before bedrock crushes it shut.`
    },
    {
      id: `prop_descent_winch_${canyon.id}`,
      name: `Steam Cable Winch & Iron Diving Cage (${crewName})`,
      pos: [chasmCenterX + 14, CENTER - 10] as [number, number],
      tags: ["metal", "machinery", "winch", "cage", "heavy"],
      hp: 350,
      maxHp: 350,
      description: "Counterweighted steel cable winches lowering iron cages of rugged delvers into the abyss to strip dragonstone before the rift seals."
    },
    {
      id: `prop_dragonstone_vein_${canyon.id}`,
      name: `Glistening Vein of ${domain} Dragonstone Crystals`,
      pos: [chasmCenterX - 10, CENTER + 12] as [number, number],
      tags: ["dragonstone", "mineral", "crystal", "valuable", "glowing"],
      hp: 400,
      maxHp: 400,
      description: `Iridescent, humming cluster of pure ${domain} Dragonstone exposed on the basalt cliff ledge. Richness: ${canyon.dragonstone_richness} units.`
    },
    {
      id: `prop_ancient_ruin_vault_${canyon.id}`,
      name: "Exposed Pre-Cruor Ruin Vault Archway",
      pos: [rx, ry] as [number, number],
      tags: ["stone", "ancient", "ruin", "vault", "relic", "pre_cruor"],
      hp: 800,
      maxHp: 800,
      description: `Shattered cyclopean masonry of a pre-Fall civilization sheared open by tectonic forces. Contains ${canyon.artifacts_remaining} intact ancient relics.`
    },
    {
      id: `prop_pneumatic_rock_drill_${canyon.id}`,
      name: "Pneumatic Core-Drill & Blasting Station",
      pos: [ex, ey - 12] as [number, number],
      tags: ["metal", "machinery", "explosive", "tools"],
      hp: 180,
      maxHp: 180,
      description: "Steam-pressurized rock core-drills and volatile blasting cords used by delver crews to break apart adamantine strata."
    }
  ];

  const npcs = [
    {
      id: `npc_canyon_winchmaster_${canyon.id}`,
      name: "Torvald's Head Winchman (Grind Canyon Corps)",
      role: "Lead Winch Engineer",
      pos: [chasmCenterX + 16, CENTER - 8] as [number, number],
      tags: ["outlaw", "miner", "engineer", "grind_canyon"],
      faction: "The Grind Canyon Corps",
      hp: 45,
      maxHp: 45,
      disposition: 0,
      alive: true,
      equippedWeapon: "Two-Handed Heavy Mining Sledge",
      equippedArmor: "Hardened Basalt Smelter Apron",
      statAffinity: "might",
      memoryNotes: [
        `Oversees the descent cables for ${chasmName}.`,
        `Warns that the rift has ${canyon.stability_ticks_remaining} days before the bedrock collapses.`
      ]
    },
    {
      id: `npc_canyon_delver_${canyon.id}`,
      name: "Veteran Chasm Diver (Grind Canyon Corps)",
      role: "Deep Abyssal Delver",
      pos: [chasmCenterX - 8, CENTER + 14] as [number, number],
      tags: ["outlaw", "miner", "delver", "grind_canyon"],
      faction: "The Grind Canyon Corps",
      hp: 40,
      maxHp: 40,
      disposition: 0,
      alive: true,
      equippedWeapon: "Serrated Blasting Pick & Lantern",
      equippedArmor: "Welded Scrap-Iron Cuirass",
      statAffinity: "endurance",
      inventory: ["Raw Dragonstone Chunks", "Pre-Cruor Bronze Gear Casing"],
      memoryNotes: [
        `Dives into ${depth}m depths to chip raw dragonstone from the cliff-face.`,
        `Fiercely guards unrefined mineral hauls from claim jumpers.`
      ]
    }
  ];

  return {
    grid,
    compressed: zlib.gzipSync(Buffer.from(grid)),
    props,
    npcs,
    poiType: "GRIND_CANYON_CHASM",
    name: chasmName,
    features: {
      isGrindCanyon: true,
      canyonId: canyon.id,
      depthMeters: depth,
      dragonDomain: domain,
      stabilityDays: canyon.stability_ticks_remaining,
      dragonstoneRichness: canyon.dragonstone_richness,
      minerCrew: crewName,
      cellId
    }
  };
}
