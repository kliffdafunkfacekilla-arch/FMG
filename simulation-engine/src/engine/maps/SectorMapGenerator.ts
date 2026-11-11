import zlib from "zlib";
import { getLairPropDetails, generateUniqueOutlawOperative } from "../agents/outlawSyndicates";
import { SimplexNoise } from "../../regional/SimplexNoise";
import { getFactionSpecialty } from "../economy/factionSpecialties.js";
import { computeDonjonSettlementCensus, DonjonBusiness, DonjonSettlementCensus } from "../procgen/DonjonSettlementEngine.js";
import {
  generateProceduralLoggingSurface,
  generateProceduralLoggingSubterranean,
  generateProceduralLoggingUpper,
  generateProceduralMiningSurface,
  generateProceduralMiningSubterranean,
  generateProceduralMiningUpper,
  generateProceduralWatchtowerSurface,
  generateProceduralWatchtowerSubterranean,
  generateProceduralWatchtowerUpper
} from "./FacilitySectorGenerators.js";

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
interface BrutalStats {
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

// Helper to calculate 12 B.R.U.T.A.L. attributes deterministically from citizen traits and profession
function computeCitizenBrutalStats(c: any, rand: () => number): BrutalStats {
  const base = 10;
  const stats: BrutalStats = {
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
  BAKERY: { type: "BAKERY", title: "Communal Hearth Bakery", floorTile: 3, hasCellar: false, hasUpper: false, hasOven: true, propTag: ["type:workstation", "material:brick", "material:wood", "bakery", "food", "fire", "crafting", "flammable", "oven"], propDesc: "Blazing brick bread ovens, flour barrels, and cooling racks." },
  FORGE: { type: "FORGE", title: "Armory & Blacksmith Forge", floorTile: 4, hasCellar: false, hasUpper: false, hasOven: true, propTag: ["type:workstation", "material:iron", "material:stone", "forge", "metal", "fire", "crafting", "heat", "heavy"], propDesc: "Heavy iron anvil, dual bellows, and a blazing coal furnace." },
  BREWERY: { type: "BREWERY", title: "Cask & Fermentation Brewhouse", floorTile: 3, hasCellar: true, hasUpper: false, propTag: ["type:workstation", "type:container", "material:copper", "material:wood_oak", "brewhouse", "food", "container", "crafting", "liquid"], propDesc: "Copper mash tuns, fermentation vats, and aged oak kegs." },
  CARPENTRY: { type: "CARPENTRY", title: "Timber Framing Workshop", floorTile: 3, hasCellar: false, hasUpper: false, propTag: ["type:workstation", "material:wood_oak", "carpentry", "wood", "crafting", "flammable"], propDesc: "Adzes, broadaxes, sawhorses, and timber framing joints." },
  TANNERY: { type: "TANNERY", title: "Leather Currying Tannery", floorTile: 3, hasCellar: false, hasUpper: false, propTag: ["type:workstation", "material:wood", "material:leather", "tannery", "leather", "crafting", "liquid"], propDesc: "Scraping frames, tanning vats, and cured leather hides." },
  WEAVERY: { type: "WEAVERY", title: "Draper Loom Guildhouse", floorTile: 3, hasCellar: false, hasUpper: false, propTag: ["type:workstation", "material:wood", "material:cloth", "weaving", "cloth", "crafting", "flammable"], propDesc: "Vertical timber looms, spinning distaffs, and wool bolts." },
  POTTERY: { type: "POTTERY", title: "Clay Pottery & Brick Kiln", floorTile: 3, hasCellar: false, hasUpper: false, hasOven: true, propTag: ["type:workstation", "material:clay", "material:brick", "pottery", "fire", "stone", "heat"], propDesc: "Domed brick kiln, turning wheels, and drying storage jars." },
  BARRACKS: { type: "BARRACKS", title: "Sovereign Guard Barracks", floorTile: 4, hasCellar: false, hasUpper: true, propTag: ["type:structure", "material:stone", "material:iron", "barracks", "military", "weapon", "defense", "secure"], propDesc: "Weapon racks, iron footlockers, and muster yard equipment." },
  FARMSTEAD: { type: "FARMSTEAD", title: "Agrarian Granary & Farmstead", floorTile: 3, hasCellar: true, hasUpper: false, propTag: ["type:structure", "type:container", "material:wood_pine", "farming", "food", "granary", "flammable", "container"], propDesc: "Threshed grain bins, seed sacks, and winnowing sieves." },
  FISHERY: { type: "FISHERY", title: "Harbor Fishery & Smokehouse", floorTile: 3, hasCellar: false, hasUpper: false, propTag: ["type:workstation", "material:wood", "fishery", "food", "water", "crafting"], propDesc: "Salted herring casks, smoke racks, and drying seine nets." },
  APOTHECARY: { type: "APOTHECARY", title: "Apothecary Herbarium & Dispensary", floorTile: 3, hasCellar: true, hasUpper: false, propTag: ["type:workstation", "type:container", "material:glass", "material:wood", "medical", "alchemy", "herbalism", "fragile"], propDesc: "Drying healing mosses, glass alembics, and tincture flasks." },
  TEMPLE: { type: "TEMPLE", title: "Sanctuary of the Dragon Seals", floorTile: 4, hasCellar: true, hasUpper: true, hasAltar: true, propTag: ["type:altar", "type:structure", "material:stone", "sacred", "holy", "altar", "relic", "hallowed"], propDesc: "Polished stone altar, runic leylines, and incense burners." },
  REGISTRY: { type: "REGISTRY", title: "Municipal Registry & Town Hall", floorTile: 4, hasCellar: true, hasUpper: true, propTag: ["type:workstation", "type:structure", "material:wood", "material:paper", "civic", "paper", "registry", "flammable"], propDesc: "Magistrate desks, official provincial wax seals, and tax rolls." },
  PRECISION_ATELIER: { type: "PRECISION_ATELIER", title: "Horological Atelier & Clocksmith", floorTile: 4, hasCellar: false, hasUpper: false, propTag: ["type:workstation", "material:brass", "material:steel", "machinery", "clockwork", "crafting", "fragile"], propDesc: "Brass gears, escapement wheels, and fine engraving loupes." },
  MASONRY: { type: "MASONRY", title: "Stonemason Cutting Yard", floorTile: 4, hasCellar: false, hasUpper: false, propTag: ["type:workstation", "material:granite", "material:stone", "stone", "masonry", "crafting", "heavy"], propDesc: "Granite ashlar blocks, stone chisels, and plumb lines." },
  MARKET_STALL: { type: "MARKET_STALL", title: "Central Trade Exchange Stalls", floorTile: 3, hasCellar: false, hasUpper: false, propTag: ["type:furniture", "type:container", "material:wood", "material:cloth", "market", "commerce", "container", "flammable"], propDesc: "Canopied market stalls heaped with regional produce and goods." }
};

export interface BurgContextConfig {
  stockpile?: any;
  events?: any[];
  cellData?: any;
  biomeId?: number;
  rx?: number;
  ry?: number;
  wardFocus?: string;
}

export function generateBurgSectorLayers(
  burg: any,
  factionName: string,
  cellId: number,
  citizens: any[] = [],
  lairs: any[] = [],
  paragons: any[] = [],
  contextConfig?: BurgContextConfig
): BurgSectorLayersResult {
  const rand = hashSeed(`burg_${burg.burg_id}_${cellId}`);
  const burgNoise = new SimplexNoise(burg.burg_id * 1000 + cellId);
  const burgName = burg.name || `Burg #${burg.burg_id}`;
  const tier = Number(burg.urban_tier) || (Number(burg.pop_null) > 12000 ? 3 : Number(burg.pop_null) > 1200 ? 2 : 1);
  const isPort = Boolean(burg.port);
  const hasWalls = tier >= 2;
  const CENTER = 128;

  // 0. Resolve Biome, Culture, and Architecture Materials
  const archType = burg.architecture_type || "HALF_TIMBERED";
  const speciesDemo = String(burg.species_demographics || "");
  const biomeId = contextConfig?.biomeId ?? Number(contextConfig?.cellData?.biome) ?? 4;
  const recentEvents = contextConfig?.events || [];

  const isRadial = archType === "RADIAL_SPIRE" || speciesDemo.includes("Avian");
  const isOrganicMaze = archType === "ADOBE_BRICK" || biomeId === 1 || biomeId === 2;
  const isGrove = archType === "GROVE_CLUSTER" || archType === "STEPPE_YURT" || speciesDemo.includes("Plant");
  const isRiverine = isPort || archType === "REED_STILT";
  const isStone = archType === "ASHLAR_STONE" || archType === "DRYSTONE_CRAG";
  const isTimber = archType === "TIMBER_FRAMED" || archType === "REED_STILT" || isGrove;

  // Material Palette
  const wallTile = isTimber ? 7 : 5; // 7: Heavy timber log palisade, 5: Masonry stone / adobe
  const roadTile = isRiverine ? 8 : (isOrganicMaze ? 3 : (tier >= 2 ? 4 : 3)); // 8: Boardwalk, 4: Cobble, 3: Packed clay/dirt
  const plazaTile = isRiverine ? 8 : (isOrganicMaze ? 3 : (isGrove ? 0 : (tier >= 2 ? 4 : 3)));
  const houseWallTile = isTimber ? 7 : 5;
  const houseFloorTile = isTimber ? 8 : (isOrganicMaze ? 3 : (tier >= 2 ? 4 : 3));

  // Past Event Scans
  const hasRaidOrWar = recentEvents.some(e =>
    e.type?.includes("BANDIT") || e.type?.includes("RAID") || e.type?.includes("SIEGE") ||
    e.type?.includes("WAR") || e.type?.includes("RIOT") || e.type?.includes("ATTACK") || e.type?.includes("HIGHWAY_ROBBERY")
  );
  const hasFamine = recentEvents.some(e =>
    e.type?.includes("FAMINE") || e.type?.includes("STARVATION")
  );
  const hasWitchHunt = recentEvents.some(e =>
    e.type?.includes("WITCH_HUNT") || e.type?.includes("CHAIN_PILGRIMAGE") || e.type?.includes("PURGE")
  );
  const hasChaosSurge = recentEvents.some(e =>
    e.type?.includes("CHAOS") || e.type?.includes("VOID_CULT") || e.type?.includes("BLIGHT")
  );
  const hasBoom = recentEvents.some(e =>
    e.type?.includes("HARVEST_SURPLUS") || e.type?.includes("BOOMTOWN") || e.type?.includes("EXPANSION")
  );
  const hasCartel = recentEvents.some(e =>
    e.type?.includes("CARTEL") || e.type?.includes("NARCOTICS") || e.type?.includes("OTTER") || e.type?.includes("VICE")
  );

  const WALL_LEFT = tier >= 3 ? 24 : 44;
  const WALL_RIGHT = tier >= 3 ? 232 : 212;
  const WALL_TOP = tier >= 3 ? 24 : 44;
  const WALL_BOTTOM = tier >= 3 ? 232 : 212;

  // -------------------------------------------------------------------------
  // LAYER 0: SURFACE GROUND LEVEL
  // -------------------------------------------------------------------------
  const grid0 = new Uint8Array(SIZE * SIZE);
  grid0.fill(0); // Natural ground

  // 1. Natural Watercourse / River Anchor (If Port or River Basin)
  const hasRiver = isPort || isRiverine || Boolean(contextConfig?.cellData?.river);
  const riverCoords: Set<number> = new Set();
  const riverBridges: Array<{ cx: number; cy: number }> = [];

  if (hasRiver) {
    const riverYBase = Math.floor(SIZE * 0.72) + Math.floor(burgNoise.noise2D(cellId, 1) * 18);
    const riverWidth = 10 + (tier >= 3 ? 4 : 0);
    for (let x = 0; x < SIZE; x++) {
      const meander = Math.round(burgNoise.noise2D(x * 0.022, cellId * 0.1) * 15 + Math.sin(x * 0.03) * 8);
      const ry = Math.max(riverWidth + 4, Math.min(SIZE - riverWidth - 4, riverYBase + meander));
      for (let w = -Math.floor(riverWidth / 2); w <= Math.floor(riverWidth / 2); w++) {
        const py = ry + w;
        if (py >= 0 && py < SIZE) {
          const idx = py * SIZE + x;
          grid0[idx] = 2; // Water
          riverCoords.add(idx);
        }
      }
      // Stone quayside embankment & boardwalk along northern riverbank
      const quayY = ry - Math.floor(riverWidth / 2) - 1;
      if (quayY >= 0 && quayY < SIZE) {
        grid0[quayY * SIZE + x] = isTimber ? 8 : 4; // Boardwalk or stone quay
      }
    }
  }

  // 2. Market Square Focal Point (Anchored at Main Crossroads / Waterfront)
  const marketCX = CENTER + Math.floor(burgNoise.noise2D(cellId * 2, 0) * 12);
  const marketCY = hasRiver ? Math.floor(CENTER * 0.82) : CENTER + Math.floor(burgNoise.noise2D(0, cellId * 2) * 12);
  const marketRad = tier >= 3 ? 16 : tier === 2 ? 12 : 9;

  // 3. Fortified Gates & Organic Wall Envelope
  const wallRadius = tier >= 3 ? 92 : tier === 2 ? 74 : 54;
  const gates: Array<{ x: number; y: number; name: string; angle: number }> = [];
  const gateAngles = hasWalls
    ? (isRadial ? [0.25, 1.82, 3.39, 4.96] : [Math.PI * 0.5, Math.PI * 1.5, 0.05, Math.PI * 0.95])
    : [];

  for (let i = 0; i < gateAngles.length; i++) {
    const ang = gateAngles[i]!;
    const gx = Math.max(8, Math.min(SIZE - 8, Math.round(marketCX + Math.cos(ang) * (wallRadius + 2))));
    const gy = Math.max(8, Math.min(SIZE - 8, Math.round(marketCY + Math.sin(ang) * (wallRadius + 2))));
    const dirName = ang > Math.PI * 1.25 && ang < Math.PI * 1.75 ? "North"
      : ang >= Math.PI * 0.25 && ang <= Math.PI * 0.75 ? (hasRiver ? "River" : "South")
      : (gx > marketCX ? "East" : "West");
    gates.push({ x: gx, y: gy, name: `${dirName} Gate`, angle: ang });
  }

  // Draw organic streets connecting Gates to Market Square
  const roadCoords: Set<number> = new Set();
  const drawOrganicStreet = (startX: number, startY: number, endX: number, endY: number, width: number = 2) => {
    let curX = startX, curY = startY;
    const dist = Math.hypot(endX - startX, endY - startY);
    const steps = Math.ceil(dist * 2.2);
    for (let s = 0; s <= steps; s++) {
      const ndx = (endX - curX) / (Math.hypot(endX - curX, endY - curY) || 1);
      const ndy = (endY - curY) / (Math.hypot(endX - curX, endY - curY) || 1);
      const meander = burgNoise.noise2D(curX * 0.045, curY * 0.045) * 3;
      curX += ndx + (-ndy) * meander * 0.22;
      curY += ndy + (ndx) * meander * 0.22;
      const ix = Math.round(curX), iy = Math.round(curY);
      const halfW = Math.floor(width / 2);
      for (let dy = -halfW; dy <= halfW; dy++) {
        for (let dx = -halfW; dx <= halfW; dx++) {
          const px = ix + dx, py = iy + dy;
          if (px >= 0 && px < SIZE && py >= 0 && py < SIZE) {
            const idx = py * SIZE + px;
            if (riverCoords.has(idx)) {
              grid0[idx] = 4; // Stone Bridge
              riverBridges.push({ cx: px, cy: py });
            } else {
              grid0[idx] = roadTile;
            }
            roadCoords.add(idx);
          }
        }
      }
      if (Math.hypot(curX - endX, curY - endY) < 1.4) break;
    }
  };

  for (const g of gates) {
    drawOrganicStreet(g.x, g.y, marketCX, marketCY, tier >= 3 ? 3 : 2);
  }

  // Secondary ring street connecting wards
  if (tier >= 2) {
    const ringRad = Math.round(wallRadius * 0.62);
    for (let deg = 0; deg < 360; deg += 3) {
      const rad = (deg * Math.PI) / 180;
      const rxPos = Math.round(marketCX + Math.cos(rad) * (ringRad + burgNoise.noise2D(Math.cos(rad) * 2, Math.sin(rad) * 2) * 4));
      const ryPos = Math.round(marketCY + Math.sin(rad) * (ringRad + burgNoise.noise2D(Math.cos(rad) * 2, Math.sin(rad) * 2) * 4));
      if (rxPos >= 0 && rxPos < SIZE && ryPos >= 0 && ryPos < SIZE) {
        const idx = ryPos * SIZE + rxPos;
        if (!riverCoords.has(idx)) {
          grid0[idx] = roadTile;
          roadCoords.add(idx);
        }
      }
    }
  }

  // Draw Paved Market Square
  for (let dy = -marketRad; dy <= marketRad; dy++) {
    for (let dx = -marketRad; dx <= marketRad; dx++) {
      const d = Math.hypot(dx, dy) + burgNoise.noise2D((marketCX + dx) * 0.1, (marketCY + dy) * 0.1) * 2.5;
      if (d <= marketRad) {
        const px = marketCX + dx, py = marketCY + dy;
        if (px >= 0 && px < SIZE && py >= 0 && py < SIZE) {
          const idx = py * SIZE + px;
          if (!riverCoords.has(idx)) {
            grid0[idx] = plazaTile;
            roadCoords.add(idx);
          }
        }
      }
    }
  }

  // Pier Boardwalks into River
  if (hasRiver) {
    const pierXs = [marketCX - 28, marketCX, marketCX + 28];
    for (const px of pierXs) {
      for (let y = Math.floor(SIZE * 0.68); y < Math.floor(SIZE * 0.78); y++) {
        for (let w = -1; w <= 1; w++) {
          const ppx = px + w;
          if (ppx >= 0 && ppx < SIZE && y >= 0 && y < SIZE) {
            grid0[y * SIZE + ppx] = 8; // Boardwalk
          }
        }
      }
    }
  }

  // 4. Defensive Walls & Bastions (Contour-Hugging Organic Envelope)
  if (hasWalls) {
    for (let deg = 0; deg < 360; deg += 1) {
      const rad = (deg * Math.PI) / 180;
      const nearGate = gates.some(g => {
        let diff = Math.abs(rad - g.angle);
        if (diff > Math.PI) diff = Math.PI * 2 - diff;
        return diff < 0.12;
      });
      if (nearGate) continue; // Gate portal gap

      const noiseMod = burgNoise.noise2D(Math.cos(rad) * 2.5, Math.sin(rad) * 2.5) * 11;
      const r = wallRadius + noiseMod;
      const wx = Math.round(marketCX + Math.cos(rad) * r);
      const wy = Math.round(marketCY + Math.sin(rad) * r);
      if (wx >= 4 && wx < SIZE - 4 && wy >= 4 && wy < SIZE - 4) {
        const idx = wy * SIZE + wx;
        if (!riverCoords.has(idx)) {
          grid0[idx] = wallTile;
          if (tier >= 3) {
            const inX = Math.round(marketCX + Math.cos(rad) * (r - 1));
            const inY = Math.round(marketCY + Math.sin(rad) * (r - 1));
            if (inX >= 0 && inX < SIZE && inY >= 0 && inY < SIZE && !riverCoords.has(inY * SIZE + inX)) {
              grid0[inY * SIZE + inX] = 4; // Parapet walkway
            }
          }
        }
      }
    }

    // Gatehouse flanking watchtowers
    for (const g of gates) {
      const pNormX = -Math.sin(g.angle);
      const pNormY = Math.cos(g.angle);
      for (const side of [-3, 3]) {
        const twX = Math.round(g.x + pNormX * side);
        const twY = Math.round(g.y + pNormY * side);
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const px = twX + dx, py = twY + dy;
            if (px >= 0 && px < SIZE && py >= 0 && py < SIZE && !riverCoords.has(py * SIZE + px)) {
              grid0[py * SIZE + px] = wallTile;
            }
          }
        }
      }
    }

    // Wall Bastions at corner intervals
    for (let deg = 30; deg < 360; deg += 60) {
      const rad = (deg * Math.PI) / 180;
      const nearGate = gates.some(g => {
        let diff = Math.abs(rad - g.angle);
        if (diff > Math.PI) diff = Math.PI * 2 - diff;
        return diff < 0.25;
      });
      if (!nearGate) {
        const r = wallRadius + burgNoise.noise2D(Math.cos(rad) * 2.5, Math.sin(rad) * 2.5) * 11;
        const bx = Math.round(marketCX + Math.cos(rad) * r);
        const by = Math.round(marketCY + Math.sin(rad) * r);
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const px = bx + dx, py = by + dy;
            if (px >= 0 && px < SIZE && py >= 0 && py < SIZE && !riverCoords.has(py * SIZE + px)) {
              grid0[py * SIZE + px] = wallTile;
            }
          }
        }
      }
    }

    // Historical Raid Breach (Wall Damaged by Past Conflict)
    if (hasRaidOrWar) {
      const breachAng = 0.45;
      const bDist = wallRadius;
      const bcx = Math.round(marketCX + Math.cos(breachAng) * bDist);
      const bcy = Math.round(marketCY + Math.sin(breachAng) * bDist);
      for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
          const px = bcx + dx, py = bcy + dy;
          if (px >= 0 && px < SIZE && py >= 0 && py < SIZE) {
            if (grid0[py * SIZE + px] === wallTile) {
              grid0[py * SIZE + px] = 3; // Collapsed rubble
            }
          }
        }
      }
    }
  }

  // 5. Donjon Demographic Census & Purposeful Ward Zoning
  const censusConfig = {
    ...contextConfig,
    factionOwner: factionName,
    factionId: burg.faction_id || (contextConfig as any)?.cellData?.faction_id
  };
  const donjonCensus = computeDonjonSettlementCensus(burg, citizens, censusConfig);

  const mapBizToSpec = (bizType: string): WorkplaceSpec => {
    if (bizType === "TAVERN") return WORKPLACE_SPECS.BREWERY || WORKPLACE_SPECS.FARMSTEAD!;
    if (bizType === "BLACKSMITH") return WORKPLACE_SPECS.FORGE!;
    if (bizType === "BAKERY") return WORKPLACE_SPECS.BAKERY!;
    if (bizType === "CARPENTER") return WORKPLACE_SPECS.CARPENTRY!;
    if (bizType === "WEAVER") return WORKPLACE_SPECS.WEAVERY!;
    if (bizType === "MASON") return WORKPLACE_SPECS.MASONRY!;
    if (bizType === "POTTER") return WORKPLACE_SPECS.POTTERY!;
    if (bizType === "TANNER") return WORKPLACE_SPECS.TANNERY!;
    if (bizType === "APOTHECARY") return WORKPLACE_SPECS.APOTHECARY!;
    if (bizType === "TEMPLE") return WORKPLACE_SPECS.TEMPLE!;
    if (bizType === "REGISTRY") return WORKPLACE_SPECS.REGISTRY!;
    if (bizType === "BARRACKS") return WORKPLACE_SPECS.BARRACKS!;
    if (bizType === "FISHERY") return WORKPLACE_SPECS.FISHERY!;
    if (bizType === "MARKET_STALL") return WORKPLACE_SPECS.MARKET_STALL!;
    if (bizType === "SPECIALTY_GUILD") {
      const fSpec = getFactionSpecialty(burg.faction_id || (contextConfig as any)?.factionId || (contextConfig as any)?.factionOwner || 0);
      if (fSpec.category === "STRUCTURAL" || fSpec.category === "ENERGY") return WORKPLACE_SPECS.FORGE!;
      if (fSpec.category === "FOUNDATION") return WORKPLACE_SPECS.MASONRY || WORKPLACE_SPECS.CARPENTRY!;
      if (fSpec.category === "PRESERVATION") return WORKPLACE_SPECS.BAKERY || WORKPLACE_SPECS.BREWERY!;
      if (fSpec.category === "HEALTH") return WORKPLACE_SPECS.APOTHECARY!;
      if (fSpec.category === "ADVANCED" || fSpec.category === "METAPHYSICAL" || fSpec.category === "LOGISTICS") return WORKPLACE_SPECS.REGISTRY || WORKPLACE_SPECS.WEAVERY!;
      return WORKPLACE_SPECS.FORGE!;
    }
    return WORKPLACE_SPECS.FARMSTEAD!;
  };

  interface PlacedBuilding {
    spec: WorkplaceSpec;
    cx: number;
    cy: number;
    w: number;
    h: number;
    citizens: any[];
    biz: DonjonBusiness;
  }
  const placedBuildings: PlacedBuilding[] = [];

  // Assign buildings to specific functional wards
  // A. Citadel / Keep Ward (Northwest High Ground)
  const citadelCX = marketCX - Math.round(wallRadius * 0.45);
  const citadelCY = marketCY - Math.round(wallRadius * 0.45);

  // B. Temple Precinct Ward (Northeast)
  const templeCX = marketCX + Math.round(wallRadius * 0.45);
  const templeCY = marketCY - Math.round(wallRadius * 0.42);

  // C. Craftsmen & Artisan Wynd (Southeast)
  const artisanCX = marketCX + Math.round(wallRadius * 0.38);
  const artisanCY = marketCY + Math.round(wallRadius * 0.35);

  // D. Waterfront / Harbor Ward (Southwest)
  const waterfrontCX = marketCX - Math.round(wallRadius * 0.35);
  const waterfrontCY = marketCY + Math.round(wallRadius * 0.38);

  const placedPositions: Array<{ x: number; y: number; w: number; h: number }> = [];
  const checkOverlap = (x: number, y: number, w: number, h: number) => {
    return placedPositions.some(p => Math.abs(p.x - x) < (p.w + w + 3) && Math.abs(p.y - y) < (p.h + h + 3));
  };

  const donjonBusinesses = donjonCensus.businesses.slice(0, 24);
  for (let i = 0; i < donjonBusinesses.length; i++) {
    const biz = donjonBusinesses[i]!;
    const spec = mapBizToSpec(biz.type);
    const assignedCitizens = biz.proprietorCitizenId
      ? citizens.filter(c => c.citizen_id === biz.proprietorCitizenId)
      : [];

    const bW = biz.buildingWidth;
    const bH = biz.buildingHeight;

    let targetBaseX = marketCX;
    let targetBaseY = marketCY;

    if (biz.ward === "CITADEL") {
      const offset = (i % 3) * 12 - 12;
      targetBaseX = citadelCX + (biz.type === "REGISTRY" ? -6 : biz.type === "BARRACKS" ? 8 : offset);
      targetBaseY = citadelCY + (biz.type === "REGISTRY" ? -4 : biz.type === "BARRACKS" ? 6 : offset);
    } else if (biz.ward === "TEMPLE") {
      targetBaseX = templeCX + (biz.type === "TEMPLE" ? 0 : 8);
      targetBaseY = templeCY + (biz.type === "TEMPLE" ? -6 : 8);
    } else if (biz.ward === "ARTISAN") {
      const craftOffset = (i % 6) * 11 - 25;
      targetBaseX = artisanCX + craftOffset;
      targetBaseY = artisanCY + Math.floor((i % 3) * 9);
    } else if (biz.ward === "WATERFRONT") {
      targetBaseX = waterfrontCX + Math.floor((rand() - 0.5) * 18);
      targetBaseY = waterfrontCY + (hasRiver ? 6 : -6);
    } else if (biz.ward === "MARKET") {
      const ang = (i % 6) * (Math.PI / 3) + 0.3;
      targetBaseX = Math.round(marketCX + Math.cos(ang) * (marketRad + 6));
      targetBaseY = Math.round(marketCY + Math.sin(ang) * (marketRad + 6));
    } else {
      // Residential street frontage along roads
      const ang = (i * 0.75) + rand() * 0.3;
      const dist = 20 + Math.floor(rand() * (wallRadius * 0.5));
      targetBaseX = Math.round(marketCX + Math.cos(ang) * dist);
      targetBaseY = Math.round(marketCY + Math.sin(ang) * dist);
    }

    // Clamp inside walls and avoid river
    const bcx = Math.max(bW + 8, Math.min(SIZE - bW - 8, targetBaseX));
    let bcy = Math.max(bH + 8, Math.min(SIZE - bH - 8, targetBaseY));
    if (riverCoords.has(bcy * SIZE + bcx)) {
      bcy = Math.max(12, bcy - 16);
    }

    if (!checkOverlap(bcx, bcy, bW, bH)) {
      placedPositions.push({ x: bcx, y: bcy, w: bW, h: bH });
      placedBuildings.push({ spec, cx: bcx, cy: bcy, w: bW, h: bH, citizens: assignedCitizens, biz });
    }
  }

  // Connect Citadel, Temple, and Artisan districts to Market Square with dedicated paved lanes
  drawOrganicStreet(citadelCX, citadelCY, marketCX, marketCY, 2);
  drawOrganicStreet(templeCX, templeCY, marketCX, marketCY, 2);
  drawOrganicStreet(artisanCX, artisanCY, marketCX, marketCY, 2);
  if (hasRiver) drawOrganicStreet(waterfrontCX, waterfrontCY, marketCX, marketCY, 2);

  const props0: SectorMapResult["props"] = [];

  // 6. Context-Aware Water & Civic Centerpiece (NOT a well on every map!)
  if (isGrove) {
    props0.push({
      id: `prop_heart_tree_${burg.burg_id}`,
      name: `Ancient Sacred Heart-Tree of ${burgName}`,
      pos: [marketCX, marketCY],
      tags: ["type:structure", "material:wood", "sacred", "hallowed", "interactive"],
      hp: 1000,
      maxHp: 1000,
      description: "An immense thousand-year-old elder tree whose roots pulse with tranquil vegetative spark."
    });
  } else if (isRadial) {
    props0.push({
      id: `prop_celestial_sundial_${burg.burg_id}`,
      name: `Celestial Dragon-Hour Sundial & Spire of ${burgName}`,
      pos: [marketCX, marketCY],
      tags: ["type:mechanism", "material:stone", "material:bronze", "astronomy", "civic"],
      hp: 500,
      maxHp: 500,
      description: "A monumental brass gnomon projecting shadows across 44 carved dragon-month astronomical glyphs."
    });
  } else if (hasRiver) {
    props0.push({
      id: `prop_quayside_steps_${burg.burg_id}`,
      name: `Stone River Quayside Steps & Mooring Slip`,
      pos: [marketCX, hasRiver ? Math.floor(SIZE * 0.68) : marketCY],
      tags: ["type:waterway", "material:stone", "water", "quayside", "interactive"],
      hp: 350,
      maxHp: 350,
      description: `Broad granite water steps descending into the flowing river with heavy iron mooring rings where barges and water-carriers dock.`
    });
    props0.push({
      id: `prop_market_cross_${burg.burg_id}`,
      name: `Carved Guild Market Cross of ${burgName}`,
      pos: [marketCX, marketCY],
      tags: ["type:structure", "material:stone", "civic", "market"],
      hp: 200,
      maxHp: 200,
      description: "A tall carved limestone market cross where provincial decrees and price tariffs are read."
    });
  } else if (isStone) {
    props0.push({
      id: `prop_lion_fountain_${burg.burg_id}`,
      name: `Carved Lion-Headed Stone Basin Fountain of ${burgName}`,
      pos: [marketCX, marketCY],
      tags: ["type:waterway", "material:stone", "water", "civic", "drinkable"],
      hp: 250,
      maxHp: 250,
      description: `A monumental granite basin fed by hillside mountain aqueducts, pouring crystal spring water from twin sculpted lion heads.`
    });
  } else if (isOrganicMaze) {
    props0.push({
      id: `prop_bazaar_cistern_${burg.burg_id}`,
      name: `Shaded Sun-Baked Aljibe Cistern of ${burgName}`,
      pos: [marketCX, marketCY],
      tags: ["type:waterway", "material:stone", "material:clay", "water", "drinkable"],
      hp: 300,
      maxHp: 300,
      description: "A cool shaded domed brick cistern catching mountain runoff to supply the sun-baked bazaar."
    });
  } else {
    props0.push({
      id: `prop_fountain_${burg.burg_id}`,
      name: tier >= 3 ? `Grand Public Fountain of ${burgName}` : `Central Well of ${burgName}`,
      pos: [marketCX, marketCY],
      tags: ["type:waterway", "type:container", "material:stone", "stone", "water", "civic", "container", "fountain", "drinkable"],
      hp: 150,
      maxHp: 150,
      description: `A communal stone water well providing clear drinking water to the citizens of ${burgName}.`
    });
  }

  // --- PAST EVENT SCARS & LIVING WORLD MANIFESTATIONS ---
  if (hasRaidOrWar) {
    const breachAng = 0;
    const bDist = tier >= 3 ? 92 : 72;
    props0.push({
      id: `prop_breach_rubble_${burg.burg_id}`,
      name: "Breached Rampart & Shattered Masonry Rubble",
      pos: [Math.round(CENTER + bDist), CENTER],
      tags: ["type:structure", "material:stone", "rubble", "damaged", "climbable"],
      hp: 300,
      maxHp: 300,
      description: "A jagged breach torn through the defenses during recent hostile raids, littered with broken stones."
    });
    props0.push({
      id: `prop_street_barricade_${burg.burg_id}`,
      name: "Makeshift Defense Barricade & Spikes",
      pos: [Math.round(CENTER + bDist - 12), CENTER],
      tags: ["type:structure", "material:wood", "material:stone", "defensive", "cover"],
      hp: 180,
      maxHp: 180,
      description: "Heavy timber beams, stone blocks, and sharpened stakes hastily thrown together to halt invaders."
    });
  }

  if (hasFamine) {
    props0.push({
      id: `prop_famine_cauldron_${burg.burg_id}`,
      name: "Communal Famine Relief Soup Cauldron & Benches",
      pos: [CENTER + 5, CENTER - 4],
      tags: ["type:container", "material:iron", "food", "communal"],
      hp: 80,
      maxHp: 80,
      description: "A bubbling cast-iron kettle boiling turnip broth and parched grain for hungry citizens amidst recent food shortages."
    });
  }

  if (hasWitchHunt) {
    props0.push({
      id: `prop_witch_gibbet_${burg.burg_id}`,
      name: "Inquisitorial Charred Stake & Iron Gibbet",
      pos: [CENTER - 5, CENTER + 4],
      tags: ["type:structure", "material:iron", "material:wood", "intimidating", "sacred"],
      hp: 120,
      maxHp: 120,
      description: "An iron hanging cage and soot-blackened stake bearing the sovereign inquisitor's sigil, following recent witch hunts."
    });
  }

  if (hasChaosSurge) {
    const fy = CENTER + 18;
    for (let fx = CENTER - 12; fx <= CENTER + 12; fx++) {
      grid0[fy * SIZE + fx] = 6; // Chaos Conduit
    }
    props0.push({
      id: `prop_chaos_crystals_${burg.burg_id}`,
      name: "Crystalline Void Conduits & Aether Spores",
      pos: [CENTER, fy],
      tags: ["type:hazard", "material:crystal", "chaos", "illuminating"],
      hp: 150,
      maxHp: 150,
      description: "Luminescent violet crystal needles protruding from fractured paving stones, humming with residual chaos."
    });
  }

  if (hasBoom) {
    props0.push({
      id: `prop_festival_canopy_${burg.burg_id}`,
      name: "Bountiful Trade Festival Pennants & Produce Wagons",
      pos: [CENTER + 8, CENTER + 6],
      tags: ["type:furniture", "material:cloth", "material:wood", "festive"],
      hp: 60,
      maxHp: 60,
      description: "Banners of dyed silk and harvest sheaves celebrating recent trade expansion and economic surplus."
    });
  }

  if (hasCartel) {
    props0.push({
      id: `prop_cartel_drop_${burg.burg_id}`,
      name: "Clandestine Syndicate Contraband Drop Barrel",
      pos: [CENTER - 16, CENTER + 18],
      tags: ["type:container", "material:wood", "contraband", "hidden"],
      hp: 60,
      maxHp: 60,
      description: "A weathered rain-barrel marked with chalk thieves' cant concealing uninspected contraband spirits."
    });
  }

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
    const bWallTile = houseWallTile;
    const bFloorTile = isTimber ? 8 : (isOrganicMaze ? 3 : b.spec.floorTile);

    for (let dy = -b.h; dy <= b.h; dy++) {
      for (let dx = -b.w; dx <= b.w; dx++) {
        const px = b.cx + dx, py = b.cy + dy;
        if (px >= 0 && px < SIZE && py >= 0 && py < SIZE) {
          if (Math.abs(dx) === b.w || Math.abs(dy) === b.h) {
            grid0[py * SIZE + px] = bWallTile;
          } else {
            grid0[py * SIZE + px] = bFloorTile;
          }
        }
      }
    }
    const doorX = b.cx + (b.cx < CENTER ? b.w : -b.w);
    const doorY = b.cy;
    grid0[doorY * SIZE + doorX] = bFloorTile;

    // Connect door towards plaza center via walkway
    const pAng = Math.atan2(CENTER - b.cy, CENTER - b.cx);
    for (let step = 1; step <= 6; step++) {
      const stepX = Math.round(doorX + Math.cos(pAng) * step);
      const stepY = Math.round(doorY + Math.sin(pAng) * step);
      if (stepX >= 0 && stepX < SIZE && stepY >= 0 && stepY < SIZE) {
        if (grid0[stepY * SIZE + stepX] === 0) grid0[stepY * SIZE + stepX] = roadTile;
      }
    }

    if (b.spec.hasOven || b.biz?.hasOven) {
      grid0[(b.cy - b.h + 2) * SIZE + (b.cx - b.w + 2)] = 8;
    }
    if (b.spec.hasAltar || b.biz?.hasAltar) {
      grid0[b.cy * SIZE + b.cx] = 10;
    }

    const buildingTitle = b.biz ? b.biz.name : `${b.spec.title} of ${burgName}`;
    const buildingDesc = b.biz
      ? `${b.biz.atmosphere} Specialties: ${b.biz.specialty} Master ${b.biz.proprietorProfession}: ${b.biz.proprietorName || 'Local Guild Artisan'}.`
      : b.spec.propDesc;

    props0.push({
      id: `prop_${b.biz?.id || b.spec.type.toLowerCase()}_${burg.burg_id}`,
      name: buildingTitle,
      pos: [b.cx, b.cy],
      tags: [...b.spec.propTag, "interactive", ...(b.biz ? [`ward:${b.biz.ward.toLowerCase()}`, `quality:${b.biz.quality}`] : [])],
      hp: 140,
      maxHp: 140,
      description: buildingDesc
    });

    if (b.spec.hasCellar || b.biz?.hasCellar) {
      props0.push({
        id: `prop_cellar_hatch_${b.biz?.id || b.spec.type.toLowerCase()}_${burg.burg_id}`,
        name: `${buildingTitle} Cellar Trapdoor`,
        pos: [b.cx + 2, b.cy + 1],
        tags: ["type:portal", "material:wood_oak", "material:iron", "wood", "hatch", "down", "stairs_down", "cellar", "subterranean", "openable", "lockable", "flammable"],
        hp: 60,
        maxHp: 60,
        description: `Iron-strapped oak trapdoor opening down into the ${buildingTitle} basement storage vaults.`
      });
    }

    if (b.spec.hasUpper || b.biz?.hasUpper) {
      props0.push({
        id: `prop_stairs_up_${b.biz?.id || b.spec.type.toLowerCase()}_${burg.burg_id}`,
        name: `${buildingTitle} Upper Floor Stairs`,
        pos: [b.cx - 2, b.cy - 1],
        tags: ["type:portal", "material:wood_oak", "wood", "stairs_up", "up", "elevated", "climbable", "flammable"],
        hp: 80,
        maxHp: 80,
        description: `Stair flight ascending to the second floor of ${buildingTitle}.`
      });
    }

    // Station Master Proprietor & Apprentice / Staff
    const staffCitizens = b.citizens.length > 0 ? b.citizens : (b.biz?.proprietorName ? [{
      citizen_id: b.biz.proprietorCitizenId || 999000 + placedBuildings.indexOf(b),
      name: b.biz.proprietorName,
      profession: b.biz.proprietorProfession,
      species: b.biz.proprietorSpecies || "Human",
      temper: b.biz.proprietorTemper || "Sanguine",
      instinct: "Self-Preservation",
      motivation: "Craftsmanship & Commerce",
      allegiance_status: "LOYAL",
      spark_tier: "NONE"
    }] : []);

    for (let ci = 0; ci < staffCitizens.length && ci < 2; ci++) {
      const c = staffCitizens[ci]!;
      const stats = computeCitizenBrutalStats(c, rand);

      // Determine emotional & physiological status from burg indicators
      const statusTags: string[] = [];
      const burgUnrest = Number(burg.unrest) || 0;
      const burgFood = Number(burg.stockpile_food ?? burg.food ?? 5000);
      if (burgFood < 1000) statusTags.push("starving");
      if (burgUnrest > 40) statusTags.push("anxious");
      if (burgUnrest > 70) statusTags.push("panicked");
      if (burgUnrest > 85) statusTags.push("rebellious");

      const isSpecialtyMaster = b.biz?.type === "SPECIALTY_GUILD";
      const fSpec = isSpecialtyMaster ? getFactionSpecialty(burg.faction_id || (contextConfig as any)?.factionId || (contextConfig as any)?.factionOwner || 0) : null;

      const citizenTags = [
        c.species ? c.species.toLowerCase() : "human",
        "civilian",
        c.workplace_type ? c.workplace_type.toLowerCase() : (b.biz?.category || "trade"),
        c.temper ? c.temper.toLowerCase() : "sanguine",
        c.instinct ? c.instinct.toLowerCase() : "fight",
        c.motivation ? `motivation:${c.motivation.toLowerCase().replace(/\s+/g, '_')}` : "motivation:duty",
        c.allegiance_status ? c.allegiance_status.toLowerCase() : "loyalist",
        c.spark_tier && c.spark_tier !== 'NONE' ? `spark:${c.spark_tier.toLowerCase()}` : "spark:null",
        ...(b.biz ? [`ward:${b.biz.ward.toLowerCase()}`, "proprietor"] : []),
        ...(fSpec ? ["specialty_master", fSpec.artisanPersonaTag.replace('#', ''), fSpec.category.toLowerCase()] : []),
        ...statusTags
      ];

      npcs0.push({
        id: `npc_citizen_${c.citizen_id}`,
        name: `${c.name} (${c.profession})`,
        role: c.profession,
        pos: [b.cx + (ci === 0 ? 0 : 1), b.cy + (ci === 0 ? 0 : -1)],
        tags: citizenTags,
        faction: factionName,
        hp: 25,
        maxHp: 25,
        disposition: statusTags.includes("rebellious") ? -1 : 1,
        alive: true,
        equippedWeapon: fSpec
          ? (fSpec.category === "STRUCTURAL" ? "Master Blacksmith Forge Hammer" : fSpec.category === "ADVANCED" ? "Precision Calibrated Transit" : "Fine Carved Artisan Mallet")
          : (c.profession.includes("Smith") ? "Heavy Blacksmith Hammer" : c.profession.includes("Guard") ? "City Watch Spear" : b.biz?.type === "TAVERN" ? "Oak Rolling Pin & Dagger" : "Carved Wooden Cudgel"),
        equippedArmor: c.profession.includes("Guard") ? "Studded Leather Cuirass" : "Woven Wool Tunic & Apron",
        statAffinity: c.temper ? c.temper.toLowerCase() : "vitality",
        memoryNotes: [
          b.biz ? `Master proprietor of ${buildingTitle} in ${donjonCensus.wards[b.biz.ward]?.name || 'the town'}.` : `Employed at ${c.workplace_name || b.spec.title}.`,
          fSpec ? `Master artisan of ${fSpec.specialtyName}. Production method: ${fSpec.harvestMethod}. Producing ${fSpec.uniqueGoodName} (${fSpec.progressRoleDescription}).` : (b.biz?.atmosphere || c.childhood_background || "Raised locally among the workshops of the province."),
          b.biz?.specialty ? `Specialties: ${b.biz.specialty}` : c.motivation || "Devoted to their daily labor and community.",
          `Temper: ${c.temper || 'Sanguine'} | Instinct: ${c.instinct || 'Self-Preservation'}`
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
        tags: ["type:portal", "material:stone", "stone", "stairs_up", "up", "ramparts", "elevated", "climbable"],
        hp: 180,
        maxHp: 180,
        description: "Stone staircase rising to the north wall parapet walkway."
      },
      {
        id: `prop_wall_stairs_south_${burg.burg_id}`,
        name: "South Curtain Wall Stairs Up",
        pos: [WALL_RIGHT - 4, WALL_BOTTOM - 3],
        tags: ["type:portal", "material:stone", "stone", "stairs_up", "up", "ramparts", "elevated", "climbable"],
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
      tags: ["type:portal", "material:iron", "metal", "iron", "grate", "down", "stairs_down", "sewer", "subterranean", "openable", "heavy"],
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
    name: contextConfig?.wardFocus
      ? `${burgName} - ${contextConfig.wardFocus.charAt(0) + contextConfig.wardFocus.slice(1).toLowerCase()} Ward (Surface r[${contextConfig.rx ?? 50}, ${contextConfig.ry ?? 50}])`
      : `${burgName} (Surface Ground Level)`,
    features: {
      burgId: burg.burg_id,
      urbanTier: tier,
      isPort,
      wealth: burg.wealth,
      unrest: burg.unrest,
      factionName,
      zLayer: 0,
      donjonCensus: {
        wards: donjonCensus.wards,
        businesses: donjonCensus.businesses,
        tavernList: donjonCensus.tavernList,
        artisanList: donjonCensus.artisanList,
        notableLocations: donjonCensus.notableLocations
      }
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
      tags: ["type:portal", "material:iron", "metal", "iron", "ladder", "up", "surface", "climbable"],
      hp: 120,
      maxHp: 120,
      description: "Vertical iron climbing rungs ascending to the street plaza grating."
    });

    npcsMinus1.push({
      id: `npc_burg_sewer_beast_${burg.burg_id}`,
      name: "Culvert Dire Rat",
      role: "Trophic Sewer Scavenger",
      pos: [CENTER + 5, CENTER + 2],
      tags: ["type:creature", "material:flesh", "beast", "rodent", "trophic_scavenger", "instinct:scavenge", "hostile", "fast"],
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
      tags: ["type:portal", "material:wood_oak", "wood", "ladder", "up", "surface", "climbable", "flammable"],
      hp: 80,
      maxHp: 80,
      description: `Vertical wooden ladder climbing up to the ground-floor trapdoor.`
    });

    propsMinus1.push({
      id: `prop_sub_storage_${b.spec.type.toLowerCase()}_${burg.burg_id}`,
      name: `${b.spec.title} Storage Vault`,
      pos: [b.cx - 1, b.cy - 1],
      tags: ["type:container", "material:wood_oak", "wood", "container", "valuable", "openable", "lockable", "flammable"],
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
          tags: ["type:portal", "material:wood_oak", "wood", "hatch", "secret", "ladder", "up", "surface", "climbable", "hidden"],
          hp: 100,
          maxHp: 100,
          description: "Camouflaged trapdoor burrowed under the outer wall opening into the wilderness brush."
        });
        props0.push({
          id: `prop_surface_secret_hatch_${burg.burg_id}_${lair.id}`,
          name: "Camouflaged Brush Trapdoor",
          pos: [exitX, ly],
          tags: ["type:portal", "material:wood_oak", "wood", "hatch", "secret", "down", "stairs_down", "subterranean", "openable", "hidden"],
          hp: 80,
          maxHp: 80,
          description: "Concealed iron-ringed trapdoor overgrown with brambles outside the town wall."
        });
      }

      propsMinus1.push({
        id: `prop_cartel_cache_${burg.burg_id}_${lair.id}`,
        name: `${cartelName} Contraband Cache (${lairType})`,
        pos: [lx, ly],
        tags: ["type:container", "material:wood_oak", "wood", "contraband", "valuable", "locked", "container", "openable", "lockable", "flammable"],
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
    name: contextConfig?.wardFocus
      ? `${burgName} - ${contextConfig.wardFocus.charAt(0) + contextConfig.wardFocus.slice(1).toLowerCase()} Under-Vaults (Subterranean Z=-1)`
      : `${burgName} (Subterranean Basements & Underworld)`,
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
    name: contextConfig?.wardFocus
      ? `${burgName} - ${contextConfig.wardFocus.charAt(0) + contextConfig.wardFocus.slice(1).toLowerCase()} Ramparts & Sky-Bridges (Upper Z=+1)`
      : `${burgName} (Upper Floors, Ramparts & Sky-Bridges)`,
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
  lairs: any[] = [],
  contextConfig?: BurgContextConfig
): SectorMapResult {
  const layers = generateBurgSectorLayers(burg, factionName, cellId, citizens, lairs, [], contextConfig);
  return layers.layer0;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. OUTLYING REGION GENERATORS (Hamlets, Farmlands, Logging, Watchtowers)
// ─────────────────────────────────────────────────────────────────────────────

export interface TacticalRegionalSectorConfig {
  cellId: number;
  rx: number;
  ry: number;
  z?: number | undefined;
  biomeId?: number | undefined;
  biomeName?: string | undefined;
  terrainType?: number | undefined;
  infraMask?: number | undefined;
  elevation?: number | undefined;
  vegetation?: number | undefined;
  chaos?: number | undefined;
  parentBurg?: any;
  factionName?: string | undefined;
  facility?: any;
  nearbyAgents?: any[] | undefined;
  citizens?: any[] | undefined;
  paragons?: any[] | undefined;
  lairs?: any[] | undefined;
  events?: any[] | undefined;
  stockpile?: any | undefined;
}

interface FarmlandSurfaceConfig {
  grid: Uint8Array;
  poiCX: number;
  poiCY: number;
  cellId: number;
  rx: number;
  ry: number;
  rand: () => number;
  biomeId: number;
  biomeName: string;
  parentName: string;
  facility: any;
  facilityMasterCitizen: any;
  props: SectorMapResult["props"];
  npcs: SectorMapResult["npcs"];
  pickCitizen: (prefProfessions?: string[]) => any;
  makeDemographicNpc: (citizen: any, pos: [number, number], overrideRole?: string, weapon?: string) => any;
}

function generateProceduralFarmlandSurface(cfg: FarmlandSurfaceConfig): string {
  const {
    grid, poiCX, poiCY, cellId, rx, ry, rand, biomeId, biomeName, parentName,
    facility, facilityMasterCitizen, props, npcs, pickCitizen, makeDemographicNpc
  } = cfg;

  const farmNoise = new SimplexNoise(cellId * 1000 + rx * 53 + ry * 31);
  const professionStr = (facilityMasterCitizen?.profession || facility?.citizenProfession || "").toLowerCase();
  const facilityNameStr = (facility?.name || "").toLowerCase();

  // 1. Determine authentic farm archetype & architectural typology
  let specType: "CEREAL" | "ORCHARD" | "PASTORAL" | "MARKET_GARDEN" | "VINEYARD";
  if (professionStr.includes("orchard") || professionStr.includes("fruit") || professionStr.includes("pomona") || facilityNameStr.includes("orchard")) {
    specType = "ORCHARD";
  } else if (professionStr.includes("herd") || professionStr.includes("shepherd") || professionStr.includes("cattle") || professionStr.includes("dairy") || professionStr.includes("pasture") || facilityNameStr.includes("ranch") || facilityNameStr.includes("pasture")) {
    specType = "PASTORAL";
  } else if (professionStr.includes("vine") || professionStr.includes("wine") || professionStr.includes("vintner") || professionStr.includes("brew") || facilityNameStr.includes("vineyard")) {
    specType = "VINEYARD";
  } else if (professionStr.includes("herb") || professionStr.includes("vegetable") || professionStr.includes("garden") || professionStr.includes("apothecary") || facilityNameStr.includes("garden")) {
    specType = "MARKET_GARDEN";
  } else {
    const roll = rand();
    if (roll < 0.45) specType = "CEREAL";
    else if (roll < 0.65) specType = "ORCHARD";
    else if (roll < 0.80) specType = "PASTORAL";
    else if (roll < 0.92) specType = "MARKET_GARDEN";
    else specType = "VINEYARD";
  }

  // Choose 1 of 4 fundamentally distinct architectural typologies:
  // 1. STRASSENDORF: Ribbon / Roadside Farm (strung along winding country highway with strip fields)
  // 2. VIERKANTHOF: Fortified Quadrangle Courtyard Farm (enclosed 4-wing courtyard steading)
  // 3. MILL_FARM: Watermill / Windmill Farm (mill race, flume, waterwheel, gristmill)
  // 4. CLACHAN: Clustered Crofting Hamlet (3-4 small detached cottages scattered around common pasture)
  type AgrarianTypology = "STRASSENDORF" | "VIERKANTHOF" | "MILL_FARM" | "CLACHAN";
  let typology: AgrarianTypology;

  if (professionStr.includes("mill") || professionStr.includes("miller") || facilityNameStr.includes("mill") || facilityNameStr.includes("sluice")) {
    typology = "MILL_FARM";
  } else if (professionStr.includes("herd") || professionStr.includes("shepherd") || facilityNameStr.includes("croft") || facilityNameStr.includes("clachan")) {
    typology = "CLACHAN";
  } else if (specType === "VINEYARD" || specType === "ORCHARD" || facilityNameStr.includes("steading") || facilityNameStr.includes("estate")) {
    typology = "VIERKANTHOF";
  } else {
    const typeRoll = Math.abs(cellId * 19 + rx * 37 + ry * 43) % 4;
    typology = typeRoll === 0 ? "STRASSENDORF" : typeRoll === 1 ? "VIERKANTHOF" : typeRoll === 2 ? "MILL_FARM" : "CLACHAN";
  }

  let barnX = poiCX, barnY = poiCY;

  // =========================================================================
  // TYPOLOGY 1: STRASSENDORF (Ribbon / Roadside Farm with Strip Fields)
  // =========================================================================
  if (typology === "STRASSENDORF") {
    // A. Winding diagonal country lane traversing the sector
    for (let t = 0; t <= 1; t += 0.004) {
      const lx = 20 + t * 215;
      const meander = farmNoise.noise2D(t * 3, 0) * 16;
      const ly = Math.round(poiCY - 30 + t * 65 + meander);
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const px = Math.round(lx) + dx, py = ly + dy;
          if (px >= 0 && px < SIZE && py >= 0 && py < SIZE) grid[py * SIZE + px] = 3; // Dirt lane
        }
      }
    }

    // B. Long parallel strip fields (rig-and-furrow) extending north and south of the lane
    const stripStartX = Math.max(15, poiCX - 65);
    const stripEndX = Math.min(240, poiCX + 65);
    for (let x = stripStartX; x < stripEndX; x += 12) {
      const isCropA = ((x / 12) | 0) % 2 === 0;
      for (let y = Math.max(10, poiCY - 80); y < poiCY - 35; y++) {
        if (grid[y * SIZE + x] === 0) {
          for (let w = 0; w < 10; w++) {
            const px = x + w;
            if (px < stripEndX) grid[y * SIZE + px] = isCropA ? 9 : 3; // 9: ripe crop, 3: plowed furrow
          }
        }
      }
      for (let y = poiCY + 35; y < Math.min(245, poiCY + 80); y++) {
        if (grid[y * SIZE + x] === 0) {
          for (let w = 0; w < 10; w++) {
            const px = x + w;
            if (px < stripEndX) grid[y * SIZE + px] = isCropA ? 3 : 9;
          }
        }
      }
    }

    // C. Farmhouse Longhouse on North side of road
    const houseW = 16, houseH = 8;
    const houseX = poiCX - 18, houseY = poiCY - 28;
    for (let by = 0; by < houseH; by++) {
      for (let bx = 0; bx < houseW; bx++) {
        const px = houseX + bx, py = houseY + by;
        grid[py * SIZE + px] = (bx === 0 || bx === houseW - 1 || by === 0 || by === houseH - 1) ? 5 : 7;
      }
    }
    grid[(houseY + houseH - 1) * SIZE + (houseX + 8)] = 3; // Door onto road
    grid[(houseY + 1) * SIZE + (houseX + 1)] = 8; // Stone hearth

    // D. Heavy Timber Threshing Barn on South side of road
    barnX = poiCX + 4;
    barnY = poiCY + 14;
    const barnW = 18, barnH = 10;
    for (let by = 0; by < barnH; by++) {
      for (let bx = 0; bx < barnW; bx++) {
        const px = barnX + bx, py = barnY + by;
        grid[py * SIZE + px] = (bx === 0 || bx === barnW - 1 || by === 0 || by === barnH - 1) ? 7 : 7;
      }
    }
    grid[barnY * SIZE + (barnX + 9)] = 3; // Barn double doors

    // E. Raised Granary on Staddle Stones
    const granaryX = poiCX - 32, granaryY = poiCY + 16;
    for (let by = 0; by < 6; by++) {
      for (let bx = 0; bx < 8; bx++) {
        grid[(granaryY + by) * SIZE + (granaryX + bx)] = 7;
      }
    }

    // F. Props (Roadside flume water trough - NOT a stone well!)
    props.push({
      id: `prop_roadside_trough_${cellId}_${rx}_${ry}`,
      name: "Roadside Timber Water Trough & Hillside Flume",
      pos: [poiCX, poiCY - 12],
      tags: ["type:waterway", "material:wood", "water", "livestock", "drinkable"],
      hp: 120,
      maxHp: 120,
      description: "A hollowed cedar log trough fed by a hillside wooden flume, providing sweet mountain water for cart horses and drovers."
    });

    props.push({
      id: `prop_farmhouse_${cellId}_${rx}_${ry}`,
      name: facilityMasterCitizen ? `${facilityMasterCitizen.name}'s Thatched Longhouse Dwelling` : "Thatched Stone-and-Timber Longhouse",
      pos: [houseX + 8, houseY + 4],
      tags: ["type:structure", "material:stone", "material:wood", "shelter", "enterable"],
      hp: 220,
      maxHp: 220,
      description: `Two-room stone longhouse of ${facilityMasterCitizen?.name || 'the farmer'} and their 12-worker agricultural household.`
    });

    props.push({
      id: `prop_barn_${cellId}_${rx}_${ry}`,
      name: facilityMasterCitizen ? `${facilityMasterCitizen.name}'s Timber Threshing Barn` : "Timber Post-and-Beam Barn",
      pos: [barnX + 9, barnY + 5],
      tags: ["type:structure", "material:wood", "agricultural", "enterable"],
      hp: 200,
      maxHp: 200,
      description: "Massive timber post-and-beam barn with a central wooden threshing floor."
    });

    props.push({
      id: `prop_cellar_poe_${cellId}_${rx}_${ry}`,
      name: "North Yard Root Cellar Trapdoor (Subterranean Entry)",
      pos: [houseX + 2, houseY - 2],
      tags: ["type:portal", "material:iron", "material:wood", "affordances:openable", "stairs_down"],
      hp: 150,
      maxHp: 150,
      description: "Iron-banded hatch leading down into the cool root vegetable storage vaults."
    });

  // =========================================================================
  // TYPOLOGY 2: VIERKANTHOF (Fortified Quadrangle Courtyard Steading)
  // =========================================================================
  } else if (typology === "VIERKANTHOF") {
    const quadW = 38, quadH = 34;
    const qX = poiCX - Math.floor(quadW / 2);
    const qY = poiCY - Math.floor(quadH / 2);

    // Enclosed cobbled courtyard inside
    for (let dy = 4; dy < quadH - 4; dy++) {
      for (let dx = 4; dx < quadW - 4; dx++) {
        grid[(qY + dy) * SIZE + (qX + dx)] = 4; // Cobblestone court
      }
    }

    // North Wing: Two-story living farmhouse (depth 5)
    for (let dy = 0; dy < 5; dy++) {
      for (let dx = 0; dx < quadW; dx++) {
        const px = qX + dx, py = qY + dy;
        grid[py * SIZE + px] = (dx === 0 || dx === quadW - 1 || dy === 0 || dy === 4) ? 5 : 7;
      }
    }
    grid[(qY + 1) * SIZE + (qX + 4)] = 8; // Hearth
    grid[(qY + 4) * SIZE + (qX + Math.floor(quadW / 2))] = 4; // Door to court

    // East Wing: Cow Byre & Horse Stables (depth 5)
    for (let dy = 4; dy < quadH; dy++) {
      for (let dx = quadW - 5; dx < quadW; dx++) {
        const px = qX + dx, py = qY + dy;
        grid[py * SIZE + px] = (dx === quadW - 5 || dx === quadW - 1 || dy === quadH - 1) ? 5 : 7;
      }
    }

    // West Wing: Grain Threshing Barn & Mow (depth 5)
    barnX = qX + 2;
    barnY = qY + 14;
    for (let dy = 4; dy < quadH; dy++) {
      for (let dx = 0; dx < 5; dx++) {
        const px = qX + dx, py = qY + dy;
        grid[py * SIZE + px] = (dx === 0 || dx === 4 || dy === quadH - 1) ? 5 : 7;
      }
    }

    // South Wing: Gatehouse & Equipment Shed (depth 5 with central arched carriage portal)
    for (let dy = quadH - 5; dy < quadH; dy++) {
      for (let dx = 0; dx < quadW; dx++) {
        const px = qX + dx, py = qY + dy;
        // Central carriage archway (4 cells wide)
        if (Math.abs(dx - Math.floor(quadW / 2)) <= 2) {
          grid[py * SIZE + px] = 4; // Road through gate
        } else {
          grid[py * SIZE + px] = (dy === quadH - 5 || dy === quadH - 1) ? 5 : 7;
        }
      }
    }

    // Surrounding outer orchard trees and pastures
    for (let deg = 0; deg < 360; deg += 18) {
      const rad = (deg * Math.PI) / 180;
      const ox = Math.round(poiCX + Math.cos(rad) * 44);
      const oy = Math.round(poiCY + Math.sin(rad) * 44);
      if (ox >= 6 && ox < SIZE - 6 && oy >= 6 && oy < SIZE - 6 && grid[oy * SIZE + ox] === 0) {
        grid[oy * SIZE + ox] = (deg % 36 === 0) ? 1 : 0; // Fruit tree or pasture
      }
    }

    // Props (Central courtyard rainwater cistern & dungstead - NOT a bored well!)
    props.push({
      id: `prop_quad_cistern_${cellId}_${rx}_${ry}`,
      name: "Courtyard Copper-Lined Rainwater Catchment Cistern",
      pos: [poiCX - 4, poiCY],
      tags: ["type:waterway", "material:stone", "water", "interactive"],
      hp: 250,
      maxHp: 250,
      description: "A deep stone cistern fed by roof gutters from all four wings of the quadrangle steading."
    });

    props.push({
      id: `prop_manure_pit_${cellId}_${rx}_${ry}`,
      name: "Steading Straw & Manure Compost Pit",
      pos: [poiCX + 6, poiCY + 2],
      tags: ["type:hazard", "material:straw", "fertilizer", "flammable"],
      hp: 80,
      maxHp: 80,
      description: "Walled dungstead composting stable straw and manure for spring soil enrichment."
    });

    props.push({
      id: `prop_quad_gate_${cellId}_${rx}_${ry}`,
      name: "Iron-Banded Timber Carriage Portal Gates",
      pos: [poiCX, qY + quadH - 2],
      tags: ["type:portal", "material:wood_oak", "material:iron", "affordances:openable", "defensive"],
      hp: 300,
      maxHp: 300,
      description: "Heavy double-leaf oak carriage gates securing the enclosed steading courtyard."
    });

    props.push({
      id: `prop_cellar_poe_${cellId}_${rx}_${ry}`,
      name: "North Wing Stone Cellar Trapdoor (Subterranean Entry)",
      pos: [qX + 8, qY + 4],
      tags: ["type:portal", "material:iron", "material:stone", "affordances:openable", "stairs_down"],
      hp: 200,
      maxHp: 200,
      description: "Heavy granite flight descending beneath the living quarters into the vaulted root pantry."
    });

  // =========================================================================
  // TYPOLOGY 3: MILL_FARM (Watermill on Mill Race or Hilltop Windmill)
  // =========================================================================
  } else if (typology === "MILL_FARM") {
    const isWatermill = (biomeId !== 1 && biomeId !== 2);

    if (isWatermill) {
      // Mill Race: Stone-banked canal cutting diagonally across the sector
      for (let t = 0; t <= 1; t += 0.005) {
        const mx = 20 + t * 215;
        const my = Math.round(poiCY - 40 + t * 80 + Math.sin(t * Math.PI * 2) * 8);
        for (let w = -3; w <= 3; w++) {
          const px = Math.round(mx), py = my + w;
          if (px >= 0 && px < SIZE && py >= 0 && py < SIZE) {
            grid[py * SIZE + px] = Math.abs(w) === 3 ? 5 : 2; // 5: Stone mill race wall, 2: Water
          }
        }
      }

      // Two-story Granite Gristmill directly spanning the mill race
      const millW = 16, millH = 14;
      const millX = poiCX - 6, millY = poiCY - 10;
      for (let dy = 0; dy < millH; dy++) {
        for (let dx = 0; dx < millW; dx++) {
          const px = millX + dx, py = millY + dy;
          grid[py * SIZE + px] = (dx === 0 || dx === millW - 1 || dy === 0 || dy === millH - 1) ? 5 : 4;
        }
      }
      grid[(millY + 6) * SIZE + (millX + millW - 1)] = 3; // Entrance door

      // Miller's Cottage beside the mill
      const cottageW = 12, cottageH = 8;
      const cotX = poiCX - 28, cotY = poiCY - 8;
      for (let dy = 0; dy < cottageH; dy++) {
        for (let dx = 0; dx < cottageW; dx++) {
          const px = cotX + dx, py = cotY + dy;
          grid[py * SIZE + px] = (dx === 0 || dx === cottageW - 1 || dy === 0 || dy === cottageH - 1) ? 5 : 7;
        }
      }
      grid[(cotY + 1) * SIZE + (cotX + 1)] = 8; // Hearth

      // Props (Waterwheel, Sluice Gate, Dipping Steps - NO well!)
      props.push({
        id: `prop_waterwheel_${cellId}_${rx}_${ry}`,
        name: "Massive Iron-Braced Oak Mill Waterwheel",
        pos: [millX + 8, millY - 2],
        tags: ["type:mechanism", "material:wood_oak", "material:iron", "industrial", "water"],
        hp: 350,
        maxHp: 350,
        description: "A gigantic churning wooden wheel turned by the surging flume, driving the heavy granite millstones inside."
      });

      props.push({
        id: `prop_mill_steps_${cellId}_${rx}_${ry}`,
        name: "Stone Mill Race Dipping Steps",
        pos: [cotX + 8, cotY + cottageH + 2],
        tags: ["type:waterway", "material:stone", "water", "interactive"],
        hp: 200,
        maxHp: 200,
        description: "Granite steps descending directly into the clear flowing mill race where buckets are filled with cold river water."
      });

      props.push({
        id: `prop_flour_wagon_${cellId}_${rx}_${ry}`,
        name: "Four-Wheeled Flour Sack Wagon",
        pos: [millX + millW + 4, millY + 4],
        tags: ["type:container", "material:wood", "food", "flour"],
        hp: 80,
        maxHp: 80,
        description: "Heavy timber freight wagon loaded with linen sacks of freshly ground white flour."
      });

      props.push({
        id: `prop_cellar_poe_${cellId}_${rx}_${ry}`,
        name: "Mill Gear Pit & Sluice Trapdoor (Subterranean Entry)",
        pos: [millX + 4, millY + 4],
        tags: ["type:portal", "material:iron", "stairs_down"],
        hp: 250,
        maxHp: 250,
        description: "Iron grate descending into the churning underwater gear vaults."
      });

    } else {
      // Hilltop Windmill
      const millRad = 8;
      for (let dy = -millRad; dy <= millRad; dy++) {
        for (let dx = -millRad; dx <= millRad; dx++) {
          const d = Math.hypot(dx, dy);
          const px = poiCX + dx, py = poiCY + dy;
          if (d <= millRad) {
            grid[py * SIZE + px] = d >= millRad - 1.5 ? 5 : 4; // Stone tower wall
          }
        }
      }
      grid[(poiCY + millRad - 1) * SIZE + poiCX] = 3; // Entrance door

      props.push({
        id: `prop_windmill_${cellId}_${rx}_${ry}`,
        name: "Four-Sailed Crest Windmill & Grist Tower",
        pos: [poiCX, poiCY],
        tags: ["type:structure", "material:stone", "material:wood", "industrial"],
        hp: 400,
        maxHp: 400,
        description: "A towering circular limestone mill with four turning canvas-covered sails catching the ridge winds."
      });

      props.push({
        id: `prop_grain_cribs_${cellId}_${rx}_${ry}`,
        name: "Slatted Elevated Grain Cribs",
        pos: [poiCX + 14, poiCY],
        tags: ["type:container", "material:wood", "food"],
        hp: 140,
        maxHp: 140,
        description: "Slatted wooden drying cribs filled with freshly harvested sheaf bundles."
      });

      props.push({
        id: `prop_cellar_poe_${cellId}_${rx}_${ry}`,
        name: "Windmill Foundation Cellar Trapdoor (Subterranean Entry)",
        pos: [poiCX - 2, poiCY - 2],
        tags: ["type:portal", "material:wood_oak", "stairs_down"],
        hp: 200,
        maxHp: 200,
        description: "Heavy oak trapdoor descending into the bedrock grain storage vaults."
      });
    }

  // =========================================================================
  // TYPOLOGY 4: CLACHAN (Clustered Crofting Hamlet on Open Common)
  // =========================================================================
  } else {
    // Open common green pasture in center
    const greenRad = 24;
    for (let dy = -greenRad; dy <= greenRad; dy++) {
      for (let dx = -greenRad; dx <= greenRad; dx++) {
        if (Math.hypot(dx, dy) <= greenRad) {
          const px = poiCX + dx, py = poiCY + dy;
          if (px >= 0 && px < SIZE && py >= 0 && py < SIZE) grid[py * SIZE + px] = 0; // Grassy common
        }
      }
    }

    // 3 to 4 distinct drystone thatched cottages scattered organically around green
    const cottageConfigs = [
      { ox: -24, oy: -18, w: 10, h: 7, name: "North Croft Cottage" },
      { ox: 22, oy: -14, w: 11, h: 7, name: "East Croft Cottage" },
      { ox: -18, oy: 20, w: 9, h: 6, name: "South Byre Croft" },
      { ox: 20, oy: 22, w: 10, h: 7, name: "Weaver's Croft" }
    ];

    for (const cc of cottageConfigs) {
      const cx = poiCX + cc.ox, cy = poiCY + cc.oy;
      for (let dy = 0; dy < cc.h; dy++) {
        for (let dx = 0; dx < cc.w; dx++) {
          const px = cx + dx, py = cy + dy;
          grid[py * SIZE + px] = (dx === 0 || dx === cc.w - 1 || dy === 0 || dy === cc.h - 1) ? 5 : 7;
        }
      }
      grid[(cy + cc.h - 1) * SIZE + (cx + Math.floor(cc.w / 2))] = 3; // Door
      grid[(cy + 1) * SIZE + (cx + 1)] = 8; // Hearth
    }

    // Drystone sheep fold
    const foldX = poiCX - 36, foldY = poiCY;
    for (let dy = -8; dy <= 8; dy++) {
      for (let dx = -8; dx <= 8; dx++) {
        if (Math.abs(dx) === 8 || Math.abs(dy) === 8) {
          if (!(dx === 8 && Math.abs(dy) <= 1)) { // Gate gap
            grid[(foldY + dy) * SIZE + (foldX + dx)] = 5; // Drystone wall
          }
        }
      }
    }

    // Props (Freshwater Spring Pool, Communal Bread Oven, Grain Kiln - NO bored well!)
    props.push({
      id: `prop_spring_pool_${cellId}_${rx}_${ry}`,
      name: "Natural Rock-Carved Spring Pool",
      pos: [poiCX + 2, poiCY - 2],
      tags: ["type:waterway", "material:stone", "water", "drinkable", "interactive"],
      hp: 300,
      maxHp: 300,
      description: "A crystal-clear freshwater spring bubbling up among limestone boulders, surrounded by flagstone dipping shelves."
    });

    props.push({
      id: `prop_bread_oven_${cellId}_${rx}_${ry}`,
      name: "Communal Stone Domed Bread Oven",
      pos: [poiCX - 6, poiCY + 4],
      tags: ["type:workstation", "material:stone", "material:clay", "food", "fire"],
      hp: 180,
      maxHp: 180,
      description: "A shared clay-and-stone beehive oven heated with gorse brush for baking the clachan's barley bannocks."
    });

    props.push({
      id: `prop_grain_kiln_${cellId}_${rx}_${ry}`,
      name: "Drystone Corn-Drying Kiln",
      pos: [poiCX + 14, poiCY + 12],
      tags: ["type:workstation", "material:stone", "agricultural", "heat"],
      hp: 150,
      maxHp: 150,
      description: "A circular stone kiln bowl where damp harvested grain is gently dried over peat embers."
    });

    props.push({
      id: `prop_cellar_poe_${cellId}_${rx}_${ry}`,
      name: "Earthen Root Dugout Hatch (Subterranean Entry)",
      pos: [poiCX - 22, poiCY - 16],
      tags: ["type:portal", "material:wood", "stairs_down"],
      hp: 120,
      maxHp: 120,
      description: "Turf-covered timber hatch opening down into the clachan's shared winter root cellar."
    });
  }

  // Spawn 2 Authentic Demographically Assigned Citizens
  const leadCitizen = facilityMasterCitizen || pickCitizen(["Farmer", "Farm Hand", "Agriculture", "Laborer", "Herder", "Orchardist"]);
  if (leadCitizen) {
    const roleName = facilityMasterCitizen ? (facility?.citizenProfession || "Master Farmer") : "Master Farmer";
    npcs.push(makeDemographicNpc(leadCitizen, [poiCX, poiCY], roleName, "Iron Pitchfork"));
  }

  const cit2 = pickCitizen(["Laborer", "Farm Hand", "Herder", "Peasant"]);
  if (cit2) {
    npcs.push(makeDemographicNpc(cit2, [barnX + 4, barnY + 4], "Farm Laborer", "Wooden Flail"));
  }

  // Dynamic Sector Title reflecting authentic typology
  const typoTitle = typology === "STRASSENDORF" ? "Ribbon Roadside Steading"
    : typology === "VIERKANTHOF" ? "Enclosed Quadrangle Steading"
    : typology === "MILL_FARM" ? "River Flume Gristmill"
    : "Clachan Crofting Steading";

  return facility?.name
    ? `${facility.name} (r[${rx}, ${ry}])`
    : `${parentName} ${typoTitle} (r[${rx}, ${ry}])`;
}

function generateProceduralFarmlandSubterranean(
  grid: Uint8Array,
  cavernCX: number,
  cavernCY: number,
  cellId: number,
  rx: number,
  ry: number,
  rand: () => number,
  parentName: string,
  facilityMasterCitizen: any,
  props: SectorMapResult["props"],
  npcs: SectorMapResult["npcs"],
  pickCitizen: (prefProfessions?: string[]) => any,
  makeDemographicNpc: (citizen: any, pos: [number, number], overrideRole?: string, weapon?: string) => any
): string {
  grid.fill(6); // Solid bedrock

  // Procedural main vault dimensions
  const mainW = 16 + Math.floor(rand() * 8);
  const mainH = 14 + Math.floor(rand() * 6);
  const halfW = Math.floor(mainW / 2);
  const halfH = Math.floor(mainH / 2);

  for (let dy = -halfH; dy <= halfH; dy++) {
    for (let dx = -halfW; dx <= halfW; dx++) {
      grid[(cavernCY + dy) * SIZE + (cavernCX + dx)] = 1; // Flagstone floor
    }
  }

  // Secondary arched alcove extending North or East
  const alcoveEast = rand() < 0.5;
  const alcoveW = 10 + Math.floor(rand() * 6);
  const alcoveH = 8 + Math.floor(rand() * 4);
  const alcoveCX = alcoveEast ? cavernCX + halfW + Math.floor(alcoveW / 2) - 1 : cavernCX;
  const alcoveCY = !alcoveEast ? cavernCY - halfH - Math.floor(alcoveH / 2) + 1 : cavernCY;

  for (let dy = -Math.floor(alcoveH / 2); dy <= Math.floor(alcoveH / 2); dy++) {
    for (let dx = -Math.floor(alcoveW / 2); dx <= Math.floor(alcoveW / 2); dx++) {
      const px = alcoveCX + dx, py = alcoveCY + dy;
      if (px >= 2 && px < 254 && py >= 2 && py < 254) {
        grid[py * SIZE + px] = 1;
      }
    }
  }

  // Masonry support pillars spaced symmetrically
  const pillarX = Math.floor(halfW * 0.55);
  const pillarY = Math.floor(halfH * 0.55);
  const pillarOffsets: Array<[number, number]> = [
    [-pillarX, -pillarY], [pillarX, -pillarY],
    [-pillarX, pillarY], [pillarX, pillarY]
  ];
  for (const [px, py] of pillarOffsets) {
    grid[(cavernCY + py) * SIZE + (cavernCX + px)] = 5; // Stone pillar
  }

  // Natural cold-spring basin in corner
  const springX = cavernCX - halfW + 3;
  const springY = cavernCY + halfH - 3;
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      if (dx * dx + dy * dy <= 4) grid[(springY + dy) * SIZE + (springX + dx)] = 2; // Water
    }
  }

  // Props
  props.push({
    id: `prop_sub_stairs_${cellId}_${rx}_${ry}`,
    name: "Stone Stairs Ascending to Surface Farmstead",
    pos: [cavernCX - halfW + 2, cavernCY - halfH + 2],
    tags: ["stone", "portal", "climbable", "stairs_up"],
    hp: 500,
    maxHp: 500,
    description: "Heavy granite flight of stairs worn smooth by work boots, leading up to the surface farmstead trapdoor."
  });

  props.push({
    id: `prop_sub_bins_${cellId}_${rx}_${ry}`,
    name: "Slatted Root Vegetable & Grain Storage Cribs",
    pos: [cavernCX + Math.floor(halfW * 0.5), cavernCY - 4],
    tags: ["type:container", "material:wood", "food", "lootable"],
    hp: 120,
    maxHp: 120,
    description: "Dry timber bins stacked with winter grain, barley sacks, parsnips, and turnips buried in dry sand."
  });

  props.push({
    id: `prop_sub_casks_${cellId}_${rx}_${ry}`,
    name: "Oak Cider & Pickling Brine Casks",
    pos: [alcoveCX, alcoveCY],
    tags: ["type:container", "material:wood_oak", "liquid", "food"],
    hp: 90,
    maxHp: 90,
    description: "Row of iron-hooped oak barrels on chocked timbers filled with cider, ale, and brine preserves."
  });

  props.push({
    id: `prop_sub_cistern_${cellId}_${rx}_${ry}`,
    name: "Cold-Spring Aquifer Fresh Basin",
    pos: [springX, springY],
    tags: ["type:container", "material:stone", "water"],
    hp: 300,
    maxHp: 300,
    description: "Deep stone catchment basin capturing cold sweet seepage from an underground limestone spring."
  });

  const cit = facilityMasterCitizen || pickCitizen(["Miller", "Farm", "Laborer"]);
  if (cit) {
    npcs.push(makeDemographicNpc(cit, [cavernCX + 2, cavernCY], facilityMasterCitizen ? "Homestead Cellar Keeper" : "Cellar Granary Keeper"));
  }

  return facilityMasterCitizen
    ? `${facilityMasterCitizen.name}'s Granary Vaults & Root Cellar (r[${rx}, ${ry}] Z=-1)`
    : `${parentName} Agrarian Root Cellars & Granary Vaults (r[${rx}, ${ry}] Z=-1)`;
}

function generateProceduralFarmlandUpper(
  grid: Uint8Array,
  platCX: number,
  platCY: number,
  cellId: number,
  rx: number,
  ry: number,
  rand: () => number,
  parentName: string,
  facilityMasterCitizen: any,
  props: SectorMapResult["props"],
  npcs: SectorMapResult["npcs"],
  pickCitizen: (prefProfessions?: string[]) => any,
  makeDemographicNpc: (citizen: any, pos: [number, number], overrideRole?: string, weapon?: string) => any
): string {
  grid.fill(0); // Open sky
  const loftW = 14 + Math.floor(rand() * 8);
  const loftH = 12 + Math.floor(rand() * 6);
  const halfW = Math.floor(loftW / 2);
  const halfH = Math.floor(loftH / 2);

  // Timber floorboard
  for (let dy = -halfH; dy <= halfH; dy++) {
    for (let dx = -halfW; dx <= halfW; dx++) {
      grid[(platCY + dy) * SIZE + (platCX + dx)] = 8; // Timber floorboard
    }
  }
  // Rafter perimeter
  for (let dx = -halfW; dx <= halfW; dx++) {
    grid[(platCY - halfH) * SIZE + (platCX + dx)] = 7;
    grid[(platCY + halfH) * SIZE + (platCX + dx)] = 7;
  }
  for (let dy = -halfH; dy <= halfH; dy++) {
    grid[(platCY + dy) * SIZE + (platCX - halfW)] = 7;
    grid[(platCY + dy) * SIZE + (platCX + halfW)] = 7;
  }

  props.push({
    id: `prop_upper_ladder_${cellId}_${rx}_${ry}`,
    name: "Barn Loft Timber Ladder Descending to Floor",
    pos: [platCX - halfW + 3, platCY - halfH + 3],
    tags: ["wood", "portal", "climbable", "ladder_down"],
    hp: 250,
    maxHp: 250,
    description: "Knotted oak ladder descending down into the barn threshing floor."
  });

  props.push({
    id: `prop_upper_hay_bales_${cellId}_${rx}_${ry}`,
    name: "Dried Alfalfa Hay Bales & Herb Sheaves",
    pos: [platCX + 3, platCY + 2],
    tags: ["type:container", "material:straw", "flammable"],
    hp: 40,
    maxHp: 40,
    description: "Piles of fragrant summer hay and dried healing moss hanging from the rafters."
  });

  const cit = facilityMasterCitizen || pickCitizen(["Farm", "Laborer"]);
  if (cit) {
    npcs.push(makeDemographicNpc(cit, [platCX + 2, platCY - 2], "Hayloft Laborer", "Pitchfork"));
  }

  return facilityMasterCitizen
    ? `${facilityMasterCitizen.name}'s Thatched Granary Loft (r[${rx}, ${ry}] Z=+1)`
    : `${parentName} Farmstead: Hayloft (r[${rx}, ${ry}] Z=+1)`;
}

export function generateTacticalRegionalSectorMap(config: TacticalRegionalSectorConfig): SectorMapResult {
  const {
    cellId,
    rx,
    ry,
    z = 0,
    biomeId = 4,
    biomeName = "Wilderness",
    terrainType = 0,
    infraMask = 0,
    elevation = 50,
    vegetation = 0.3,
    chaos = 0.0,
    parentBurg,
    factionName = "Provincial Sovereignty",
    facility,
    nearbyAgents = [],
    citizens = [],
    paragons = [],
    lairs = [],
    events = [],
    stockpile = {}
  } = config;

  const rand = hashSeed(`tactical_${cellId}_${rx}_${ry}_${z}`);
  const grid = new Uint8Array(SIZE * SIZE);
  const CENTER = 128;
  const parentName = parentBurg?.name || `Sector #${cellId}`;

  const props: SectorMapResult["props"] = [];
  const npcs: SectorMapResult["npcs"] = [];

  // 1. Determine authentic POI type matching RegionalInstance definitions
  let poiType: "HAMLET" | "FARMLAND" | "LOGGING" | "MINE" | "SHRINE" | "WATCHTOWER" | "SMUGGLER_DEN" | "WILDERNESS" = "WILDERNESS";
  if (facility && (facility.type === "MINE" || String(facility.type).includes("MINE"))) poiType = "MINE";
  else if (facility && (facility.type === "LOGGING_CAMP" || String(facility.type).includes("LOGGING"))) poiType = "LOGGING";
  else if (facility && (facility.type === "FARM" || String(facility.type).includes("FARM"))) poiType = "FARMLAND";
  else if (facility && (facility.type === "WATCHTOWER" || String(facility.type).includes("WATCH"))) poiType = "WATCHTOWER";
  else if (terrainType === 4 || (infraMask & 1)) poiType = "HAMLET";
  else if (terrainType === 9 || (infraMask & 48)) poiType = "FARMLAND";
  else if (terrainType === 10 || (infraMask & 24)) poiType = "LOGGING";
  else if (terrainType === 11 || (infraMask & 12)) poiType = "MINE";
  else if (terrainType === 12 || (infraMask & 6)) poiType = "WATCHTOWER";
  else if (terrainType === 7 || (infraMask & 8) || (infraMask & 16)) poiType = "SHRINE";
  else if (terrainType === 6 || (infraMask & 4)) poiType = "SMUGGLER_DEN";

  // 1b. Resolve authentic primary citizen master if facility is linked to a demographic worker unit
  const facilityMasterCitizen = facility?.citizenId
    ? (citizens.find(c => c.citizen_id === facility.citizenId) || {
        citizen_id: facility.citizenId,
        name: facility.citizenName,
        profession: facility.citizenProfession,
        unit_size: facility.workerCount || 12
      })
    : null;

  // Helper to pick authentic citizens from population_demographics deterministically rotated by (rx, ry, z)
  const offset = citizens.length > 0 ? Math.abs((cellId * 37 + rx * 19 + ry * 43 + (z + 2) * 11)) % citizens.length : 0;
  const availableCitizens = citizens.length > 0 ? [...citizens.slice(offset), ...citizens.slice(0, offset)] : [];
  if (facilityMasterCitizen && facilityMasterCitizen.citizen_id) {
    const fIdx = availableCitizens.findIndex(c => c.citizen_id === facilityMasterCitizen.citizen_id);
    if (fIdx !== -1) availableCitizens.splice(fIdx, 1);
  }

  let citCounter = 0;
  const pickCitizen = (prefProfessions: string[] = []): any | null => {
    if (availableCitizens.length === 0) return null;
    if (prefProfessions.length > 0) {
      const idx = availableCitizens.findIndex(c =>
        prefProfessions.some(p => c.profession?.toLowerCase().includes(p.toLowerCase()))
      );
      if (idx !== -1) {
        const match = availableCitizens[idx];
        availableCitizens.splice(idx, 1);
        return match;
      }
    }
    return availableCitizens.shift() || null;
  };

  const makeDemographicNpc = (
    citizen: any,
    pos: [number, number],
    overrideRole?: string,
    weapon?: string
  ): SectorMapResult["npcs"][0] => {
    const name = citizen?.name || `${factionName} Resident #${citCounter + 1}`;
    const role = overrideRole || citizen?.profession || "Provincial Citizen";
    const species = citizen?.species || "Human";
    const temper = citizen?.temper || "steady";
    const instinct = citizen?.instinct || "wary";
    const motivation = citizen?.motivation || "duty";
    const unitSize = citizen?.unit_size || 12;
    const tags = [
      `species:${species.toLowerCase()}`,
      `profession:${role.toLowerCase().replace(/[\s-]+/g, '_')}`,
      `temper:${temper.toLowerCase()}`,
      `instinct:${instinct.toLowerCase()}`,
      `motivation:${motivation.toLowerCase()}`,
      citizen?.spark_tier ? `spark:${citizen.spark_tier.toLowerCase()}` : "spark:null"
    ];

    const isGuard = role.includes("Guard") || role.includes("Watch") || role.includes("Sentry") || role.includes("Warder");
    const isFarmer = role.includes("Farm") || role.includes("Granary") || role.includes("Miller");
    const isWoodsman = role.includes("Wood") || role.includes("Lumber") || role.includes("Sawyer") || role.includes("Carpenter");
    const isMiner = role.includes("Mine") || role.includes("Quarry") || role.includes("Blacksmith") || role.includes("Delver");

    return {
      id: `npc_demographic_${citizen?.citizen_id || `${cellId}_${rx}_${ry}_${citCounter++}`}`,
      name,
      role,
      pos,
      tags,
      faction: factionName,
      hp: citizen?.spark_tier === "PARAGON" ? 45 : isGuard ? 30 : 24,
      maxHp: citizen?.spark_tier === "PARAGON" ? 45 : isGuard ? 30 : 24,
      disposition: temper.toLowerCase().includes("friendly") || temper.toLowerCase().includes("calm") ? 1 :
                   temper.toLowerCase().includes("hostile") || temper.toLowerCase().includes("suspicious") ? -1 : 0,
      alive: true,
      equippedWeapon: weapon || (isGuard ? "Broadsword & Shield" : isFarmer ? "Iron Pitchfork" : isWoodsman ? "Two-Handed Felling Axe" : isMiner ? "Heavy Mining Pick" : "Hunting Knife"),
      statAffinity: isGuard ? "awareness" : isFarmer || isWoodsman ? "might" : isMiner ? "endurance" : "finesse",
      stats: {
        childhood_background: citizen?.childhood_background,
        allegiance_status: citizen?.allegiance_status || "LOYAL",
        unit_size: unitSize
      },
      memoryNotes: [
        `Authentic demographic citizen of ${parentName}. Profession: ${role}.`,
        `Represents an authentic worker unit baseline of ${unitSize} people living and working here.`
      ]
    };
  };

  const poiCX = 90 + Math.floor(rand() * 76);
  const poiCY = 90 + Math.floor(rand() * 76);

  // =========================================================================
  // SUBTERRANEAN LAYER (Z = -1): Authentic Sub-Level Customized to Surface Facility
  // =========================================================================
  if (z === -1) {
    grid.fill(6); // Solid bedrock
    const cavernCX = poiCX;
    const cavernCY = poiCY;

    if (poiType === "FARMLAND") {
      const layerName = generateProceduralFarmlandSubterranean(
        grid, cavernCX, cavernCY, cellId, rx, ry, rand, parentName,
        facilityMasterCitizen, props, npcs, pickCitizen, makeDemographicNpc
      );

      return {
        grid,
        compressed: zlib.gzipSync(Buffer.from(grid)),
        props,
        npcs,
        poiType,
        name: layerName,
        features: { cellId, rx, ry, z: -1, biomeId, poiType }
      };

    } else if (poiType === "HAMLET") {
      // Masonry Root Cellar & Granary Storage Vaults
      for (let dy = -16; dy <= 16; dy++) {
        for (let dx = -20; dx <= 20; dx++) {
          grid[(cavernCY + dy) * SIZE + (cavernCX + dx)] = 1; // Flagstone floor
        }
      }
      // Vaulted support pillars
      const pillarOffsets: Array<[number, number]> = [[-10, -8], [10, -8], [-10, 8], [10, 8]];
      for (const [px, py] of pillarOffsets) {
        grid[(cavernCY + py) * SIZE + (cavernCX + px)] = 5; // Stone pillar
      }

      props.push({
        id: `prop_sub_stairs_${cellId}_${rx}_${ry}`,
        name: "Stone Stairs Ascending to Surface Farmstead",
        pos: [cavernCX - 16, cavernCY - 12],
        tags: ["stone", "portal", "climbable", "stairs_up"],
        hp: 500,
        maxHp: 500,
        description: "Heavy granite flight of stairs worn smooth by work boots, leading up to the surface farmstead trapdoor."
      });
      props.push({
        id: `prop_sub_grain_bins_${cellId}_${rx}_${ry}`,
        name: "Communal Threshed Grain Bins & Sacks",
        pos: [cavernCX + 10, cavernCY - 8],
        tags: ["type:container", "material:wood", "food", "granary", "lootable"],
        hp: 120,
        maxHp: 120,
        description: "Dry timber bins stacked with winter grain, barley seed sacks, and winnowing sieves."
      });
      props.push({
        id: `prop_sub_casks_${cellId}_${rx}_${ry}`,
        name: "Oak Cider & Pickling Brine Casks",
        pos: [cavernCX + 12, cavernCY + 8],
        tags: ["type:container", "material:wood_oak", "liquid", "food"],
        hp: 80,
        maxHp: 80,
        description: "Row of iron-hooped oak barrels filled with pressed cider and winter root preserves."
      });
      props.push({
        id: `prop_sub_cistern_${cellId}_${rx}_${ry}`,
        name: "Cold-Spring Aquifer Water Cistern",
        pos: [cavernCX - 8, cavernCY + 10],
        tags: ["type:container", "material:stone", "water"],
        hp: 300,
        maxHp: 300,
        description: "Deep stone catchment basin capturing seepage from an underground freshwater spring."
      });

      const cit = facilityMasterCitizen || pickCitizen(["Miller", "Farm", "Laborer"]);
      if (cit) {
        npcs.push(makeDemographicNpc(cit, [cavernCX + 2, cavernCY], facilityMasterCitizen ? "Homestead Cellar Keeper" : "Cellar Granary Keeper"));
      }

      const layerName = facilityMasterCitizen
        ? `${facilityMasterCitizen.name}'s Granary Vaults & Root Cellar (r[${rx}, ${ry}] Z=-1)`
        : `${parentName} Agrarian Root Cellars & Granary Vaults (r[${rx}, ${ry}] Z=-1)`;

      return {
        grid,
        compressed: zlib.gzipSync(Buffer.from(grid)),
        props,
        npcs,
        poiType,
        name: layerName,
        features: { cellId, rx, ry, z: -1, biomeId, poiType }
      };

    } else if (poiType === "LOGGING") {
      const layerName = generateProceduralLoggingSubterranean(
        grid, cavernCX, cavernCY, cellId, rx, ry, rand, parentName,
        facilityMasterCitizen, props, npcs, pickCitizen, makeDemographicNpc
      );

      return {
        grid,
        compressed: zlib.gzipSync(Buffer.from(grid)),
        props,
        npcs,
        poiType,
        name: layerName,
        features: { cellId, rx, ry, z: -1, biomeId, poiType }
      };

    } else if (poiType === "MINE") {
      const layerName = generateProceduralMiningSubterranean(
        grid, cavernCX, cavernCY, cellId, rx, ry, rand, parentName,
        facilityMasterCitizen, props, npcs, pickCitizen, makeDemographicNpc
      );

      return {
        grid,
        compressed: zlib.gzipSync(Buffer.from(grid)),
        props,
        npcs,
        poiType,
        name: layerName,
        features: { cellId, rx, ry, z: -1, biomeId, poiType }
      };

    } else if (poiType === "WATCHTOWER") {
      const layerName = generateProceduralWatchtowerSubterranean(
        grid, cavernCX, cavernCY, cellId, rx, ry, rand, parentName,
        facilityMasterCitizen, props, npcs, pickCitizen, makeDemographicNpc
      );

      return {
        grid,
        compressed: zlib.gzipSync(Buffer.from(grid)),
        props,
        npcs,
        poiType,
        name: layerName,
        features: { cellId, rx, ry, z: -1, biomeId, poiType }
      };

    } else if (poiType === "SMUGGLER_DEN") {
      // Underworld Cache & Contraband Cellar
      for (let dy = -12; dy <= 12; dy++) {
        for (let dx = -14; dx <= 14; dx++) {
          grid[(cavernCY + dy) * SIZE + (cavernCX + dx)] = 1;
        }
      }

      props.push({
        id: `prop_sub_trapdoor_${cellId}_${rx}_${ry}`,
        name: "Concealed Floor Hatch Ascending to Surface Brush",
        pos: [cavernCX - 8, cavernCY - 6],
        tags: ["wood", "portal", "climbable", "ladder_up", "hidden"],
        hp: 200,
        maxHp: 200,
        description: "A camouflaged trapdoor covered in lichen and soil leading up into dense brush."
      });
      props.push({
        id: `prop_sub_contraband_${cellId}_${rx}_${ry}`,
        name: "Sealed Contraband Cask Cache",
        pos: [cavernCX + 6, cavernCY + 4],
        tags: ["type:container", "material:wood", "contraband", "lootable"],
        hp: 90,
        maxHp: 90,
        description: "Unmarked barrels containing uncut crystal, unstamped trade goods, and contraband spirits."
      });

      const cit = pickCitizen(["Disenfranchised", "Outcast", "Laborer"]);
      if (cit) {
        npcs.push(makeDemographicNpc(cit, [cavernCX, cavernCY], "Covert Syndicate Courier", "Dagger & Hand Crossbow"));
      }

      return {
        grid,
        compressed: zlib.gzipSync(Buffer.from(grid)),
        props,
        npcs,
        poiType,
        name: `${parentName} Border Flue: Contraband Vault (r[${rx}, ${ry}] Z=-1)`,
        features: { cellId, rx, ry, z: -1, biomeId, poiType }
      };

    } else if (poiType === "SHRINE") {
      // Crypt of the Ancient Dragon Seals
      for (let dy = -18; dy <= 18; dy++) {
        for (let dx = -18; dx <= 18; dx++) {
          if (dx * dx + dy * dy <= 324) {
            grid[(cavernCY + dy) * SIZE + (cavernCX + dx)] = 4; // Temple stone floor
          }
        }
      }

      props.push({
        id: `prop_sub_crypt_stairs_${cellId}_${rx}_${ry}`,
        name: "Ancient Stone Steps Ascending to Megaliths",
        pos: [cavernCX, cavernCY - 12],
        tags: ["stone", "portal", "climbable", "stairs_up"],
        hp: 600,
        maxHp: 600,
        description: "Ancient basalt steps worn by centuries of pilgrims leading up to the megalith ring."
      });
      props.push({
        id: `prop_sub_sarcophagus_${cellId}_${rx}_${ry}`,
        name: "Carved Dragon-Stone Sarcophagus",
        pos: [cavernCX, cavernCY],
        tags: ["type:altar", "material:stone", "sacred", "relic"],
        hp: 800,
        maxHp: 800,
        description: "Monolithic stone tomb sealed with lead seals and carved with archaic celestial constellations."
      });

      const cit = pickCitizen(["Herbalist", "Acolyte", "Pious"]);
      if (cit) {
        npcs.push(makeDemographicNpc(cit, [cavernCX + 4, cavernCY + 4], "Ancient Crypt Keeper", "Sacred Quarterstaff"));
      }

      return {
        grid,
        compressed: zlib.gzipSync(Buffer.from(grid)),
        props,
        npcs,
        poiType,
        name: `Subterranean Crypt of the Ancient Seals (r[${rx}, ${ry}] Z=-1)`,
        features: { cellId, rx, ry, z: -1, biomeId, poiType }
      };

    } else {
      // WILDERNESS / NATURAL KARST CAVE SYSTEM
      for (let dy = -28; dy <= 28; dy++) {
        for (let dx = -32; dx <= 32; dx++) {
          const d = Math.hypot(dx, dy);
          const noise = Math.sin(dx * 0.15) * Math.cos(dy * 0.15) * 6;
          if (d <= 22 + noise) {
            grid[(cavernCY + dy) * SIZE + (cavernCX + dx)] = 1; // Cave floor
          }
        }
      }
      for (let dy = -6; dy <= 6; dy++) {
        for (let dx = -8; dx <= 8; dx++) {
          if (dx * dx + dy * dy <= 36) {
            grid[(cavernCY + 8 + dy) * SIZE + (cavernCX - 10 + dx)] = 5; // Water
          }
        }
      }

      props.push({
        id: `prop_sub_fissure_ledge_${cellId}_${rx}_${ry}`,
        name: "Natural Rock Ledges Ascending to Surface Fissure",
        pos: [cavernCX + 14, cavernCY - 10],
        tags: ["stone", "portal", "climbable", "stairs_up"],
        hp: 500,
        maxHp: 500,
        description: "Tiered natural limestone ledges offering natural climbing handholds up to the surface."
      });
      props.push({
        id: `prop_sub_grotto_lichen_${cellId}_${rx}_${ry}`,
        name: "Luminescent Grotto Moss Cluster",
        pos: [cavernCX - 12, cavernCY + 8],
        tags: ["type:hazard", "material:flora", "illuminating"],
        hp: 20,
        maxHp: 20,
        description: "Phosphorescent emerald moss glowing softly along the damp limestone water's edge."
      });

      const isHostile = rand() < 0.5;
      npcs.push({
        id: `npc_cave_beast_${cellId}_${rx}_${ry}`,
        name: isHostile ? "Grotto Cave Stalker" : "Subterranean Scree Marmot",
        role: isHostile ? "Apex Cave Predator" : "Subterranean Fauna",
        pos: [cavernCX + 2, cavernCY + 4],
        tags: ["beast", "wild", isHostile ? "hostile" : "fearful"],
        faction: "Wilderness",
        hp: isHostile ? 32 : 12,
        maxHp: isHostile ? 32 : 12,
        disposition: isHostile ? -2 : 0,
        alive: true,
        statAffinity: "vitality",
        memoryNotes: [`Roams the limestone grotto beneath Sector [${rx}, ${ry}].`]
      });

      return {
        grid,
        compressed: zlib.gzipSync(Buffer.from(grid)),
        props,
        npcs,
        poiType,
        name: `${biomeName} Subterranean Karst Caverns (r[${rx}, ${ry}] Z=-1)`,
        features: { cellId, rx, ry, z: -1, biomeId, poiType }
      };
    }
  }

  // =========================================================================
  // UPPER LAYER (Z = 1): Lofts, Lookouts, Canopy Platforms, Ramparts
  // =========================================================================
  if (z === 1) {
    grid.fill(0); // Open sky
    const platCX = poiCX;
    const platCY = poiCY;

    if (poiType === "WATCHTOWER") {
      const layerName = generateProceduralWatchtowerUpper(
        grid, platCX, platCY, cellId, rx, ry, rand, parentName,
        facilityMasterCitizen, props, npcs, pickCitizen, makeDemographicNpc
      );

      return {
        grid,
        compressed: zlib.gzipSync(Buffer.from(grid)),
        props,
        npcs,
        poiType,
        name: layerName,
        features: { cellId, rx, ry, z: 1, biomeId, poiType }
      };

    } else if (poiType === "LOGGING") {
      const layerName = generateProceduralLoggingUpper(
        grid, platCX, platCY, cellId, rx, ry, rand, parentName,
        facilityMasterCitizen, props, npcs, pickCitizen, makeDemographicNpc
      );

      return {
        grid,
        compressed: zlib.gzipSync(Buffer.from(grid)),
        props,
        npcs,
        poiType,
        name: layerName,
        features: { cellId, rx, ry, z: 1, biomeId, poiType }
      };

    } else if (poiType === "MINE") {
      const layerName = generateProceduralMiningUpper(
        grid, platCX, platCY, cellId, rx, ry, rand, parentName,
        facilityMasterCitizen, props, npcs, pickCitizen, makeDemographicNpc
      );

      return {
        grid,
        compressed: zlib.gzipSync(Buffer.from(grid)),
        props,
        npcs,
        poiType,
        name: layerName,
        features: { cellId, rx, ry, z: 1, biomeId, poiType }
      };

    } else if (poiType === "FARMLAND") {
      const layerName = generateProceduralFarmlandUpper(
        grid, platCX, platCY, cellId, rx, ry, rand, parentName,
        facilityMasterCitizen, props, npcs, pickCitizen, makeDemographicNpc
      );

      return {
        grid,
        compressed: zlib.gzipSync(Buffer.from(grid)),
        props,
        npcs,
        poiType,
        name: layerName,
        features: { cellId, rx, ry, z: 1, biomeId, poiType }
      };

    } else {
      // Tree Canopy Platform / Elevated Lookout
      for (let dy = -10; dy <= 10; dy++) {
        for (let dx = -10; dx <= 10; dx++) {
          if (Math.abs(dx) === 10 || Math.abs(dy) === 10) {
            grid[(platCY + dy) * SIZE + (platCX + dx)] = 7; // Timber rail
          } else {
            grid[(platCY + dy) * SIZE + (platCX + dx)] = 8; // Timber planking
          }
        }
      }

      props.push({
        id: `prop_upper_ladder_${cellId}_${rx}_${ry}`,
        name: "Knotted Rope Ladder Descending to Ground",
        pos: [platCX, platCY],
        tags: ["wood", "portal", "climbable", "ladder_down"],
        hp: 200,
        maxHp: 200,
        description: "Heavy woven hemp and hardwood ladder descending down into the forest."
      });

      const cit = pickCitizen(["Scout", "Hunter", "Woodcutter"]);
      if (cit) {
        npcs.push(makeDemographicNpc(cit, [platCX + 3, platCY - 3], "Canopy Scout", "Hunting Bow"));
      }

      return {
        grid,
        compressed: zlib.gzipSync(Buffer.from(grid)),
        props,
        npcs,
        poiType,
        name: `${biomeName} Canopy Platform (r[${rx}, ${ry}] Z=+1)`,
        features: { cellId, rx, ry, z: 1, biomeId, poiType }
      };
    }
  }

  // =========================================================================
  // SURFACE GROUND LAYER (Z = 0): Authentic Biome & Terrain Synthesis
  // =========================================================================
  // 1. Fill base ground
  if (biomeId === 0 || terrainType === 3) {
    grid.fill(2); // Water
  } else if (biomeId === 1 || biomeId === 2) {
    grid.fill(0); // Sand / arid
  } else if (biomeId === 10 || biomeId === 11) {
    grid.fill(0); // Tundra / snow
  } else {
    grid.fill(0); // Grassland / soil
  }

  // 2. SCATTER VEGETATION & TREES
  if (biomeId !== 0 && terrainType !== 3) {
    const vegFactor = Math.max(0.05, Math.min(0.85, vegetation));
    const treeTile = (biomeId === 9 || biomeId === 10) ? 1 : 1; // Trees
    for (let y = 0; y < SIZE; y += 2) {
      for (let x = 0; x < SIZE; x += 2) {
        if (hashSeed(`veg_${cellId}_${rx}_${ry}_${x}_${y}`)() < vegFactor * 0.45) {
          grid[y * SIZE + x] = treeTile;
          if (x + 1 < SIZE) grid[y * SIZE + (x + 1)] = treeTile;
          if (y + 1 < SIZE) grid[(y + 1) * SIZE + x] = treeTile;
        }
      }
    }
  }

  // 3. OVERLAND TRADE HIGHWAY / RUSTIC ROAD
  const hasRoad = terrainType === 5 || terrainType === 6 || (infraMask & 6) !== 0 || facility;
  if (hasRoad && biomeId !== 0 && terrainType !== 3) {
    const roadAngle = ((rx * 7 + ry * 13) % 180) * (Math.PI / 180);
    const roadTile = terrainType === 5 ? 4 : 3;
    const rStartX = CENTER - Math.round(Math.cos(roadAngle) * 128);
    const rStartY = CENTER - Math.round(Math.sin(roadAngle) * 128);
    const rEndX = CENTER + Math.round(Math.cos(roadAngle) * 128);
    const rEndY = CENTER + Math.round(Math.sin(roadAngle) * 128);

    for (let t = 0; t <= 1; t += 0.005) {
      const rxPos = Math.round(rStartX + (rEndX - rStartX) * t);
      const ryPos = Math.round(rStartY + (rEndY - rStartY) * t);
      const curve = Math.sin(t * Math.PI * 3 + rx) * 5;
      const fx = Math.round(rxPos + Math.cos(roadAngle + Math.PI / 2) * curve);
      const fy = Math.round(ryPos + Math.sin(roadAngle + Math.PI / 2) * curve);

      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const px = fx + dx, py = fy + dy;
          if (px >= 0 && px < SIZE && py >= 0 && py < SIZE) {
            grid[py * SIZE + px] = roadTile;
          }
        }
      }
    }
  }

  // 4. MOUNTAIN CRAGS & ROCKY RIDGES
  if ((elevation > 65 || terrainType === 8 || terrainType === 11) && biomeId !== 0) {
    const ridgeX = 70 + Math.floor(rand() * 110);
    for (let y = 0; y < SIZE; y++) {
      const cx = Math.floor(ridgeX + Math.sin(y * 0.03 + rx) * 25);
      for (let w = -6; w <= 6; w++) {
        const x = cx + w;
        if (x >= 0 && x < SIZE && grid[y * SIZE + x] !== 2 && grid[y * SIZE + x] !== 4) {
          grid[y * SIZE + x] = 5; // Stone Cliff Wall
        }
      }
    }
  }

  // 5. CHAOS CORRUPTION FISSURE
  if (chaos > 0.35 && biomeId !== 0) {
    const riftX = 60 + Math.floor(rand() * 130);
    for (let y = 20; y < SIZE - 20; y++) {
      const cx = Math.floor(riftX + Math.sin(y * 0.05 + ry) * 18);
      for (let w = -1; w <= 1; w++) {
        const x = cx + w;
        if (x >= 0 && x < SIZE) grid[y * SIZE + x] = 6; // Chaos Conduit
      }
    }
  }

  // 6. PROCEDURAL POINT OF INTEREST (POI) PLACEMENT ON SURFACE
  let sectorName = facility?.name ? `${facility.name} (r[${rx}, ${ry}])` : "";

  if (poiType === "HAMLET") {
    sectorName = `${parentName} Outskirts: Hamlet (r[${rx}, ${ry}])`;

    // 1. Organic curving country highway traversing through hamlet center
    for (let t = 0; t <= 1; t += 0.005) {
      const hx = 20 + t * 215;
      const meander = Math.sin(t * Math.PI * 2) * 14 + hashSeed(`h_meander_${cellId}_${rx}_${ry}`)() * 4;
      const hy = Math.round(poiCY - 20 + t * 45 + meander);
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const px = Math.round(hx) + dx, py = hy + dy;
          if (px >= 0 && px < SIZE && py >= 0 && py < SIZE) grid[py * SIZE + px] = 3; // Dirt lane
        }
      }
    }

    // 2. Wayside Hamlet Common / Meeting Green
    const greenRad = 15;
    for (let dy = -greenRad; dy <= greenRad; dy++) {
      for (let dx = -greenRad; dx <= greenRad; dx++) {
        const d = Math.hypot(dx, dy);
        if (d <= greenRad) {
          const px = poiCX + dx, py = poiCY + dy;
          if (px >= 0 && px < SIZE && py >= 0 && py < SIZE) {
            grid[py * SIZE + px] = d <= 6 ? 4 : 3; // Cobblestone center, dirt perimeter
          }
        }
      }
    }

    // 3. 4 to 6 uniquely sized cottages lining the country highway
    const hamletBuildings = [
      { ox: -26, oy: -18, w: 11, h: 7, name: "Wayside Tavern & Drover Inn", type: "tavern" },
      { ox: 22, oy: -16, w: 9, h: 6, name: "Village Blacksmith & Shoeing Forge", type: "forge" },
      { ox: -20, oy: 20, w: 10, h: 7, name: "Reeve's Homestead Cottage", type: "dwelling" },
      { ox: 24, oy: 18, w: 9, h: 6, name: "Weaver's Thatched Cottage", type: "dwelling" },
      { ox: -4, oy: -32, w: 12, h: 7, name: "Communal Timber Granary", type: "granary" }
    ];

    for (const b of hamletBuildings) {
      const cx = poiCX + b.ox, cy = poiCY + b.oy;
      for (let dy = 0; dy < b.h; dy++) {
        for (let dx = 0; dx < b.w; dx++) {
          const px = cx + dx, py = cy + dy;
          if (px >= 0 && px < SIZE && py >= 0 && py < SIZE) {
            grid[py * SIZE + px] = (dx === 0 || dx === b.w - 1 || dy === 0 || dy === b.h - 1) ? 5 : 7;
          }
        }
      }
      grid[(cy + b.h - 1) * SIZE + (cx + Math.floor(b.w / 2))] = 3; // Doorway
      if (b.type === "forge" || b.type === "tavern") {
        grid[(cy + 1) * SIZE + (cx + 1)] = 8; // Hearth / Forge fire
      }
    }

    // 4. Context-Aware Water Source (Not a generic well everywhere!)
    const hasStream = (biomeId === 6 || biomeId === 8 || biomeId === 12);
    if (hasStream) {
      props.push({
        id: `prop_brook_dock_${cellId}_${rx}_${ry}`,
        name: "Fresh Brook Timber Dipping Dock & Water Sluice",
        pos: [poiCX, poiCY],
        tags: ["type:waterway", "material:wood", "water", "interactive", "drinkable"],
        hp: 150,
        maxHp: 150,
        description: "A notched oak dipping platform extending over a clear spring-fed brook with wooden buckets."
      });
    } else if (biomeId === 1 || biomeId === 2) {
      props.push({
        id: `prop_hamlet_aljibe_${cellId}_${rx}_${ry}`,
        name: "Domed Brick Rainwater Aljibe Cistern",
        pos: [poiCX, poiCY],
        tags: ["type:waterway", "material:brick", "water", "drinkable"],
        hp: 200,
        maxHp: 200,
        description: "A cool underground brick cistern catching precious seasonal rainwater with iron dipping scoops."
      });
    } else {
      props.push({
        id: `prop_spring_trough_${cellId}_${rx}_${ry}`,
        name: "Limestone Spring Catchment Basin & Trough",
        pos: [poiCX, poiCY],
        tags: ["type:waterway", "material:stone", "water", "drinkable"],
        hp: 180,
        maxHp: 180,
        description: "A carved limestone basin catching water from an underground rock spring with a wooden horse trough."
      });
    }

    props.push({
      id: `prop_tavern_sign_${cellId}_${rx}_${ry}`,
      name: "The Weary Carter Drover Inn & Outdoor Benches",
      pos: [poiCX - 26 + 5, poiCY - 18 + 4],
      tags: ["type:structure", "material:wood", "tavern", "rest", "enterable"],
      hp: 180,
      maxHp: 180,
      description: "A rustic timber tavern with a painted wooden sign, hitching rail for draft oxen, and oak ale benches."
    });

    props.push({
      id: `prop_granary_${cellId}_${rx}_${ry}`,
      name: "Communal Stone-Pillared Grain Storehouse",
      pos: [poiCX - 4 + 6, poiCY - 32 + 3],
      tags: ["type:container", "material:stone", "material:wood", "food", "granary"],
      hp: 220,
      maxHp: 220,
      description: "Elevated timber storehouse on stone pillars stocked with communal seed grain, barley sacks, and scythes."
    });

    props.push({
      id: `prop_cellar_poe_${cellId}_${rx}_${ry}`,
      name: "Granary Foundation Cellar Trapdoor (Subterranean Entry)",
      pos: [poiCX - 4 + 2, poiCY - 32 - 1],
      tags: ["type:portal", "material:iron", "material:wood", "affordances:openable", "stairs_down"],
      hp: 150,
      maxHp: 150,
      description: "Heavy iron-strapped cellar hatch descending into the communal winter root vaults."
    });

    // Spawn 2 authentic citizens
    const cit1 = pickCitizen(["Elder", "Reeve", "Mayor", "Leader", "Merchant"]);
    if (cit1) npcs.push(makeDemographicNpc(cit1, [poiCX - 20 + 5, poiCY + 20 + 3], "Hamlet Reeve"));

    const cit2 = pickCitizen(["Guard", "Watch", "Sentry", "Militia", "Blacksmith"]);
    if (cit2) npcs.push(makeDemographicNpc(cit2, [poiCX + 22 + 4, poiCY - 16 + 3], "Hamlet Blacksmith & Watchman", "Heavy Blacksmith Hammer"));

  } else if (poiType === "FARMLAND") {
    sectorName = generateProceduralFarmlandSurface({
      grid,
      poiCX,
      poiCY,
      cellId,
      rx,
      ry,
      rand,
      biomeId,
      biomeName,
      parentName,
      facility,
      facilityMasterCitizen,
      props,
      npcs,
      pickCitizen,
      makeDemographicNpc
    });

  } else if (poiType === "LOGGING") {
    sectorName = generateProceduralLoggingSurface({
      grid, poiCX, poiCY, cellId, rx, ry, rand, biomeId, biomeName, parentName,
      facility, facilityMasterCitizen, props, npcs, pickCitizen, makeDemographicNpc
    });

  } else if (poiType === "MINE") {
    sectorName = generateProceduralMiningSurface({
      grid, poiCX, poiCY, cellId, rx, ry, rand, biomeId, biomeName, parentName,
      facility, facilityMasterCitizen, props, npcs, pickCitizen, makeDemographicNpc
    });

  } else if (poiType === "SHRINE") {
    sectorName = `Ancient Megalithic Ring of Power (r[${rx}, ${ry}])`;
    for (let deg = 0; deg < 360; deg += 30) {
      const rad = (deg * Math.PI) / 180;
      const sx = Math.round(poiCX + Math.cos(rad) * 18);
      const sy = Math.round(poiCY + Math.sin(rad) * 18);
      grid[sy * SIZE + sx] = 5;
    }

    props.push({
      id: `prop_altar_${cellId}_${rx}_${ry}`,
      name: "Runic Megalithic Offering Altar",
      pos: [poiCX, poiCY],
      tags: ["type:structure", "material:stone", "sacred", "hallowed"],
      hp: 500,
      maxHp: 500,
      description: "An immense block of dark granite carved with glowing celestial ley constellations."
    });

    props.push({
      id: `prop_crypt_stairs_${cellId}_${rx}_${ry}`,
      name: "Basalt Crypt Steps (Subterranean Entry)",
      pos: [poiCX - 8, poiCY - 8],
      tags: ["type:portal", "material:stone", "affordances:climbable", "stairs_down"],
      hp: 600,
      maxHp: 600,
      description: "Ancient basalt steps descending into the tomb beneath the stones."
    });

    const cit = pickCitizen(["Herbalist", "Acolyte", "Pious", "Monk"]);
    if (cit) npcs.push(makeDemographicNpc(cit, [poiCX + 4, poiCY + 4], "Shrine Acolyte", "Sacred Staff"));

  } else if (poiType === "WATCHTOWER") {
    sectorName = generateProceduralWatchtowerSurface({
      grid, poiCX, poiCY, cellId, rx, ry, rand, biomeId, biomeName, parentName,
      facility, facilityMasterCitizen, props, npcs, pickCitizen, makeDemographicNpc
    });

  } else if (poiType === "SMUGGLER_DEN") {
    sectorName = `${parentName} Border Outskirts: Covert Cache (r[${rx}, ${ry}])`;
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        grid[(poiCY + dy) * SIZE + (poiCX + dx)] = 7;
      }
    }

    props.push({
      id: `prop_smuggler_cache_${cellId}_${rx}_${ry}`,
      name: "Camouflaged Underworld Flue (Subterranean Entry)",
      pos: [poiCX + 6, poiCY],
      tags: ["type:portal", "material:wood", "affordances:openable", "affordances:climbable", "stairs_down", "hidden"],
      hp: 150,
      maxHp: 150,
      description: "A dirt-covered cellar hatch concealed beneath brambles and rough stones."
    });

    const cit = pickCitizen(["Disenfranchised", "Outcast", "Laborer"]);
    if (cit) npcs.push(makeDemographicNpc(cit, [poiCX, poiCY + 4], "Covert Syndicate Courier", "Dagger & Crossbow"));

  } else {
    // WILDERNESS / OPEN NATURAL LANDSCAPE
    sectorName = `${biomeName} Frontier Wilds (Sector #${cellId} r[${rx}, ${ry}])`;
    grid[poiCY * SIZE + poiCX] = 8;
    grid[(poiCY - 2) * SIZE + poiCX] = 3;

    props.push({
      id: `prop_campfire_${cellId}_${rx}_${ry}`,
      name: "Smoking Stone Campfire & Spit",
      pos: [poiCX, poiCY],
      tags: ["type:hazard", "material:stone", "fire", "illuminating"],
      hp: 40,
      maxHp: 40,
      description: "A ring of soot-stained river stones around glowing hardwood embers with a roasting spit."
    });

    props.push({
      id: `prop_natural_fissure_poe_${cellId}_${rx}_${ry}`,
      name: "Natural Limestone Fissure (Subterranean Entry)",
      pos: [poiCX + 14, poiCY - 10],
      tags: ["type:portal", "material:stone", "affordances:climbable", "stairs_down"],
      hp: 500,
      maxHp: 500,
      description: "A narrow rocky crevice descending into natural limestone caverns and underground pools."
    });

    if (nearbyAgents && nearbyAgents.length > 0) {
      for (let i = 0; i < Math.min(3, nearbyAgents.length); i++) {
        const ag = nearbyAgents[i];
        const offsetDist = 15 + i * 18;
        const offsetAngle = (i * 2.1) + rand();
        const ax = Math.max(10, Math.min(245, Math.round(poiCX + Math.cos(offsetAngle) * offsetDist)));
        const ay = Math.max(10, Math.min(245, Math.round(poiCY + Math.sin(offsetAngle) * offsetDist)));

        npcs.push({
          id: `npc_wild_${ag.id || `${cellId}_${rx}_${ry}_${i}`}`,
          name: ag.speciesName || ag.type || "Wild Predator",
          role: ag.category || ag.type || "Fauna",
          pos: [ax, ay],
          tags: ["beast", "wild", ag.type === "Predator" ? "hostile" : "fearful"],
          faction: "Wilderness",
          hp: ag.type === "Predator" ? 32 : 18,
          maxHp: ag.type === "Predator" ? 32 : 18,
          disposition: ag.type === "Predator" ? -1 : 0,
          alive: true,
          statAffinity: "vitality",
          memoryNotes: [`Roams the regional overland corridor of Sector [${rx}, ${ry}].`]
        });
      }
    } else {
      const isPredator = rand() < 0.4;
      const beastName = isPredator ? "Shadow Timber-Wolf" : "Wild Highland Elk";
      npcs.push({
        id: `npc_wild_beast_${cellId}_${rx}_${ry}`,
        name: beastName,
        role: isPredator ? "Apex Predator" : "Wild Game",
        pos: [poiCX + 12, poiCY + 12],
        tags: ["beast", "wild", isPredator ? "hostile" : "peaceful"],
        faction: "Wilderness",
        hp: isPredator ? 28 : 16,
        maxHp: isPredator ? 28 : 16,
        disposition: isPredator ? -1 : 0,
        alive: true,
        statAffinity: "vitality"
      });
    }
  }

  // Inject Past Event impacts onto regional tactical map
  if (events && events.length > 0) {
    const hasRaid = events.some((e: any) =>
      e.type?.includes("BANDIT") || e.type?.includes("RAID") || e.type?.includes("SIEGE") ||
      e.type?.includes("WAR") || e.type?.includes("CARAVAN_AMBUSH") || e.type?.includes("HIGHWAY_ROBBERY")
    );
    const hasPilgrimage = events.some((e: any) =>
      e.type?.includes("WITCH_HUNT") || e.type?.includes("CHAIN_PILGRIMAGE")
    );
    const hasChaosEvent = chaos > 0.4 || events.some((e: any) =>
      e.type?.includes("CHAOS") || e.type?.includes("VOID_CULT")
    );

    if (hasRaid) {
      props.push({
        id: `prop_skirmish_debris_${cellId}_${rx}_${ry}`,
        name: "Skirmish Debris & Overturned Cart",
        pos: [Math.max(10, poiCX - 15), Math.max(10, poiCY + 12)],
        tags: ["type:structure", "material:wood", "debris", "damaged"],
        hp: 75,
        maxHp: 75,
        description: "An overturned supply handcart and scattered gear left behind following recent highway raids."
      });
    }

    if (hasPilgrimage) {
      props.push({
        id: `prop_pilgrim_cairn_${cellId}_${rx}_${ry}`,
        name: "Inscribed Pilgrim Waymarker Cairn",
        pos: [Math.min(245, poiCX + 14), Math.max(10, poiCY - 14)],
        tags: ["type:structure", "material:stone", "sacred", "trail_marker"],
        hp: 150,
        maxHp: 150,
        description: "A stack of river stones bound with prayer rags and inscribed with ancient warden glyphs."
      });
    }

    if (hasChaosEvent) {
      props.push({
        id: `prop_void_outcrop_${cellId}_${rx}_${ry}`,
        name: "Glowing Aetherite Crystal Cluster",
        pos: [Math.min(245, poiCX + 16), Math.min(245, poiCY + 16)],
        tags: ["type:hazard", "material:crystal", "chaos", "illuminating"],
        hp: 120,
        maxHp: 120,
        description: "Luminescent violet crystal clusters humming with residual chaos energy along the ground."
      });
    }
  }

  return {
    grid,
    compressed: zlib.gzipSync(Buffer.from(grid)),
    props,
    npcs,
    poiType,
    name: sectorName,
    features: {
      cellId,
      rx,
      ry,
      z,
      biomeId,
      biomeName,
      terrainType,
      infraMask,
      elevation,
      vegetation,
      chaos,
      parentBurgName: parentBurg?.name,
      factionName
    }
  };
}

export function generateOutlyingSectorMap(
  parentBurg: any,
  sectorType: "HAMLET" | "FARMLAND" | "LOGGING" | "WATCHTOWER",
  rx: number,
  ry: number,
  cellId: number,
  factionName: string
): SectorMapResult {
  const terrainTypeMap = {
    "HAMLET": 4,
    "FARMLAND": 5,
    "LOGGING": 6,
    "WATCHTOWER": 0
  };
  return generateTacticalRegionalSectorMap({
    cellId,
    rx,
    ry,
    z: 0,
    terrainType: terrainTypeMap[sectorType] ?? 0,
    infraMask: sectorType === "HAMLET" ? 1 : sectorType === "FARMLAND" ? 2 : sectorType === "LOGGING" ? 4 : 0,
    parentBurg,
    factionName
  });
}


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
