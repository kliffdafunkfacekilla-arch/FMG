import zlib from "zlib";

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

// ─────────────────────────────────────────────────────────────────────────────
// 1. BURG URBAN CORE GENERATOR
// ─────────────────────────────────────────────────────────────────────────────
export function generateBurgSectorMap(
  burg: any,
  factionName: string,
  cellId: number,
  citizens: any[] = [],
  lairs: any[] = []
): SectorMapResult {
  const rand = hashSeed(`burg_${burg.burg_id}_${cellId}`);
  const grid = new Uint8Array(SIZE * SIZE);
  grid.fill(0);

  const tier = burg.urban_tier || (burg.pop_null > 12000 ? 3 : burg.pop_null > 1200 ? 2 : 1);
  const isPort = Boolean(burg.port);
  const hasCitadel = tier >= 2 || burg.wealth > 3000;
  const burgName = burg.name || `Burg #${burg.burg_id}`;

  const WALL_LEFT = tier === 3 ? 20 : 36;
  const WALL_RIGHT = tier === 3 ? 236 : 220;
  const WALL_TOP = tier === 3 ? 20 : 36;
  const WALL_BOTTOM = tier === 3 ? 236 : 220;
  const CENTER = 128;

  // 1. Outer Fortified Curtain Walls
  for (let x = WALL_LEFT; x <= WALL_RIGHT; x++) {
    grid[WALL_TOP * SIZE + x] = 5;
    grid[(WALL_TOP + 1) * SIZE + x] = 5;
    if (!isPort) {
      grid[WALL_BOTTOM * SIZE + x] = 5;
      grid[(WALL_BOTTOM - 1) * SIZE + x] = 5;
    }
  }
  for (let y = WALL_TOP; y <= (isPort ? WALL_BOTTOM - 20 : WALL_BOTTOM); y++) {
    grid[y * SIZE + WALL_LEFT] = 5;
    grid[y * SIZE + WALL_LEFT + 1] = 5;
    grid[y * SIZE + WALL_RIGHT] = 5;
    grid[y * SIZE + WALL_RIGHT - 1] = 5;
  }

  // Corner Bastion Towers (8x8)
  const drawBastion = (cx: number, cy: number) => {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const tx = cx + dx, ty = cy + dy;
        if (tx >= 0 && tx < SIZE && ty >= 0 && ty < SIZE) grid[ty * SIZE + tx] = 5;
      }
    }
  };
  drawBastion(WALL_LEFT, WALL_TOP);
  drawBastion(WALL_RIGHT, WALL_TOP);
  if (!isPort) {
    drawBastion(WALL_LEFT, WALL_BOTTOM);
    drawBastion(WALL_RIGHT, WALL_BOTTOM);
  }

  // 2. Cardinal Cobblestone Thoroughfares
  const roadWidth = tier === 3 ? 4 : 3;
  for (let y = 0; y < SIZE; y++) {
    for (let dx = -roadWidth; dx <= roadWidth; dx++) {
      const x = CENTER + dx;
      if (x >= 0 && x < SIZE) grid[y * SIZE + x] = 4;
    }
  }
  for (let x = 0; x < SIZE; x++) {
    for (let dy = -roadWidth; dy <= roadWidth; dy++) {
      const y = CENTER + dy;
      if (y >= 0 && y < SIZE) grid[y * SIZE + x] = 4;
    }
  }

  // 3. Central Grand Market Plaza (30x30 cobblestone)
  const PLAZA_HALF = 18;
  for (let y = CENTER - PLAZA_HALF; y <= CENTER + PLAZA_HALF; y++) {
    for (let x = CENTER - PLAZA_HALF; x <= CENTER + PLAZA_HALF; x++) {
      grid[y * SIZE + x] = 4;
    }
  }

  // 4. Urban Districts & Residential Blocks
  const districtStep = 24;
  for (let y = WALL_TOP + 10; y < WALL_BOTTOM - 10; y += districtStep) {
    for (let x = WALL_LEFT + 10; x < WALL_RIGHT - 10; x += districtStep) {
      // Skip center plaza & main thoroughfares
      if (Math.abs(x - CENTER) < 28 && Math.abs(y - CENTER) < 28) continue;

      // Draw secondary street around block
      for (let s = 0; s < districtStep; s++) {
        if (y + s < SIZE && x < SIZE) grid[(y + s) * SIZE + x] = 3;
        if (y < SIZE && x + s < SIZE) grid[y * SIZE + (x + s)] = 3;
      }

      // Draw buildings inside block
      const bw = Math.min(14, districtStep - 6);
      const bh = Math.min(14, districtStep - 6);
      for (let by = 3; by < 3 + bh; by++) {
        for (let bx = 3; bx < 3 + bw; bx++) {
          const px = x + bx, py = y + by;
          if (px < WALL_RIGHT - 4 && py < WALL_BOTTOM - 4) {
            grid[py * SIZE + px] = 7; // Cottage/Building roof
          }
        }
      }
    }
  }

  // 5. Citadel Keep (North-East Quarter)
  if (hasCitadel) {
    const kx = CENTER + 45, ky = CENTER - 45;
    for (let y = ky - 18; y <= ky + 18; y++) {
      for (let x = kx - 18; x <= kx + 18; x++) {
        if (Math.abs(x - kx) === 18 || Math.abs(y - ky) === 18) {
          grid[y * SIZE + x] = 5; // Citadel Inner Wall
        } else {
          grid[y * SIZE + x] = 4; // Stone courtyard
        }
      }
    }
    // High Keep Tower
    for (let y = ky - 8; y <= ky + 8; y++) {
      for (let x = kx - 8; x <= kx + 8; x++) grid[y * SIZE + x] = 5;
    }
  }

  // 6. Coastal Port & Harbor Quays (if coastal/port)
  if (isPort) {
    for (let y = WALL_BOTTOM - 14; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) grid[y * SIZE + x] = 2; // Ocean water
    }
    // Wooden piers extending into the sea
    const pierXs = [WALL_LEFT + 30, CENTER - 35, CENTER + 35, WALL_RIGHT - 30];
    for (const px of pierXs) {
      for (let y = WALL_BOTTOM - 18; y < SIZE - 8; y++) {
        for (let w = -2; w <= 2; w++) grid[y * SIZE + (px + w)] = 3; // Pier decking
      }
    }
  }

  // 4b. Dedicated Workplace Zones carved directly onto the grid
  const drawWorkplaceBuilding = (cx: number, cy: number, w: number, h: number, floorTile: number = 3) => {
    for (let dy = -h; dy <= h; dy++) {
      for (let dx = -w; dx <= w; dx++) {
        const px = cx + dx, py = cy + dy;
        if (px >= 0 && px < SIZE && py >= 0 && py < SIZE) {
          if (Math.abs(dx) === w || Math.abs(dy) === h) {
            grid[py * SIZE + px] = 5; // Stone exterior wall
          } else {
            grid[py * SIZE + px] = floorTile; // Interior floor
          }
        }
      }
    }
  };

  // 1. Communal Hearth Bakery (South-East Quarter)
  drawWorkplaceBuilding(CENTER + 22, CENTER + 18, 6, 6, 3);
  grid[(CENTER + 18) * SIZE + (CENTER + 24)] = 8; // Brick bread oven

  // 2. Master Armorer's Forge & Smithy (South-West Quarter)
  drawWorkplaceBuilding(CENTER - 36, CENTER - 20, 7, 7, 4);
  grid[(CENTER - 20) * SIZE + (CENTER - 36)] = 8; // Roaring coal forge

  // 3. Sovereign Guard Barracks & Armory (North-West Quarter)
  drawWorkplaceBuilding(CENTER - 32, CENTER - 32, 8, 8, 4);

  // 4. Cask & Flagon Brewhouse (South-West Quarter)
  drawWorkplaceBuilding(CENTER - 20, CENTER + 20, 6, 6, 3);

  // 5. Draper Loom Guild Workshop (North-East Quarter)
  drawWorkplaceBuilding(CENTER + 24, CENTER - 36, 6, 6, 3);

  // 6. Leather Currier Tannery (South-West Fringe)
  drawWorkplaceBuilding(CENTER - 38, CENTER + 36, 6, 6, 3);

  // 7. Ceramics Pottery Kiln (North-West Fringe)
  drawWorkplaceBuilding(CENTER - 24, CENTER - 38, 5, 5, 3);
  grid[(CENTER - 38) * SIZE + (CENTER - 24)] = 8; // Pottery firing kiln

  // 8. Apothecary Herbarium & Clinic (South-East Fringe)
  drawWorkplaceBuilding(CENTER + 32, CENTER + 32, 6, 6, 3);

  // 9. Town Hall Chancellery & Registry (North-East Civic)
  drawWorkplaceBuilding(CENTER + 16, CENTER - 14, 7, 6, 4);

  // 10. Cathedral Sanctuary of the Dragon Seals
  drawWorkplaceBuilding(CENTER - 45, CENTER + 35, 9, 9, 4);
  grid[(CENTER + 35) * SIZE + (CENTER - 45)] = 10; // Runic altar

  // 7. Interactive Functional Props
  const props = [
    {
      id: `prop_well_${burg.burg_id}`,
      name: `The Grand Public Fountain of ${burgName}`,
      pos: [CENTER, CENTER] as [number, number],
      tags: ["stone", "water", "civic", "container", "fountain"],
      hp: 150,
      maxHp: 150,
      description: `A masterwork tiered stone fountain providing clear spring water to the citizens of ${burgName}.`
    },
    {
      id: `prop_market_${burg.burg_id}`,
      name: "Guild Trade Stalls & Weigh Station",
      pos: [CENTER - 8, CENTER + 6] as [number, number],
      tags: ["wood", "market", "container", "cloth", "commerce"],
      hp: 60,
      maxHp: 60,
      description: "Canopied market stalls heaped with regional produce, cured meats, iron ingots, and textiles."
    },
    {
      id: `prop_bakery_${burg.burg_id}`,
      name: `The Communal Hearth Bakery of ${burgName}`,
      pos: [CENTER + 22, CENTER + 18] as [number, number],
      tags: ["stone", "food", "fire", "bakery", "crafting"],
      hp: 120,
      maxHp: 120,
      description: `A bustling stone bakery with blazing brick bread ovens, flour barrels, and bread cooling racks supplying ${burgName}'s daily bread.`
    },
    {
      id: `prop_forge_${burg.burg_id}`,
      name: "Master Armorer's Forge & Bellows",
      pos: [CENTER - 36, CENTER - 20] as [number, number],
      tags: ["stone", "metal", "fire", "forge", "crafting"],
      hp: 200,
      maxHp: 200,
      description: "A blazing coal forge and dual-bellows furnace where provincial steel is beaten into armor and arms."
    },
    {
      id: `prop_barracks_${burg.burg_id}`,
      name: "Sovereign Guard Barracks & Muster Yard",
      pos: [CENTER - 32, CENTER - 32] as [number, number],
      tags: ["stone", "military", "barracks", "weapon", "defense"],
      hp: 300,
      maxHp: 300,
      description: "Heavy stone barracks housing the sworn town guard, armor lockers, training pell dummies, and armory racks."
    },
    {
      id: `prop_brewery_${burg.burg_id}`,
      name: `The Cask & Flagon Brewhouse of ${burgName}`,
      pos: [CENTER - 20, CENTER + 20] as [number, number],
      tags: ["wood", "food", "brewhouse", "container", "crafting"],
      hp: 140,
      maxHp: 140,
      description: "A fragrant brewhouse with copper mash tuns, fermentation barrels, and aged ale casks for the citizens."
    },
    {
      id: `prop_weavery_${burg.burg_id}`,
      name: "Draper Guild Loom Workshop",
      pos: [CENTER + 24, CENTER - 36] as [number, number],
      tags: ["wood", "cloth", "weaving", "crafting"],
      hp: 100,
      maxHp: 100,
      description: "Vertical spinning looms and cloth drying racks turning raw sheep's wool and flax into garments."
    },
    {
      id: `prop_tannery_${burg.burg_id}`,
      name: "Leather Currier Tannery",
      pos: [CENTER - 38, CENTER + 36] as [number, number],
      tags: ["stone", "leather", "tannery", "container", "crafting"],
      hp: 110,
      maxHp: 110,
      description: "Tanning vats and scraping frames where cured cattle and wolf hides are scraped and turned into boiled leather."
    },
    {
      id: `prop_pottery_${burg.burg_id}`,
      name: "Earthenware Pottery & Brick Kiln",
      pos: [CENTER - 24, CENTER - 38] as [number, number],
      tags: ["stone", "fire", "pottery", "crafting"],
      hp: 150,
      maxHp: 150,
      description: "Domed brick kiln firing storage amphoras, roof tiles, and glazed cooking vessels."
    },
    {
      id: `prop_apothecary_${burg.burg_id}`,
      name: "Apothecary Herbarium & Dispensary",
      pos: [CENTER + 32, CENTER + 32] as [number, number],
      tags: ["stone", "medical", "alchemy", "reagents"],
      hp: 100,
      maxHp: 100,
      description: "Bundles of dried nightshade, healing mosses, and glass alembics distilling tinctures for wounded citizens."
    },
    {
      id: `prop_registry_${burg.burg_id}`,
      name: "Town Hall Chancellery & Deed Registry",
      pos: [CENTER + 16, CENTER - 14] as [number, number],
      tags: ["stone", "civic", "paper", "registry"],
      hp: 250,
      maxHp: 250,
      description: "Where municipal magistrates record citizen rights, trade tariffs, grain manifests, and royal decrees."
    },
    {
      id: `prop_temple_${burg.burg_id}`,
      name: "Cathedral Altar of the Dragon Seals",
      pos: [CENTER - 45, CENTER + 35] as [number, number],
      tags: ["stone", "sacred", "altar", "holy", "relic"],
      hp: 300,
      maxHp: 300,
      description: "An ancient polished marble sanctuary dedicated to the Cosmic Order and the binding of Cruorbus."
    },
    {
      id: `prop_notice_${burg.burg_id}`,
      name: "Provincial Decree & Bounty Board",
      pos: [CENTER + 8, CENTER - 8] as [number, number],
      tags: ["wood", "paper", "civic", "interactive"],
      hp: 40,
      maxHp: 40,
      description: `Official parchment proclamations, harvest tariffs, and monster bounties bearing the seal of ${factionName}.`
    }
  ];

  if (isPort) {
    props.push(
      {
        id: `prop_harbor_${burg.burg_id}`,
        name: "Deep-Water Quay Cargo Cranes & Warehouses",
        pos: [CENTER, WALL_BOTTOM - 16] as [number, number],
        tags: ["wood", "metal", "harbor", "crane", "cargo"],
        hp: 180,
        maxHp: 180,
        description: "Massive counterweighted timber cranes unloading trade galleons and coastal skiffs."
      },
      {
        id: `prop_fishery_${burg.burg_id}`,
        name: "Basin Fishery Quay & Smokehouse",
        pos: [CENTER + 28, WALL_BOTTOM - 15] as [number, number],
        tags: ["wood", "food", "fishery", "smokehouse"],
        hp: 120,
        maxHp: 120,
        description: "Drying nets, salted herring barrels, and skiffs supplying fresh ocean catch to the city markets."
      }
    );
  }

  // 8. Purpose-Driven NPCs stationed at their authentic workplaces
  const npcs: SectorMapResult["npcs"] = [];
  const citizenByProf = new Map<string, any>();
  for (const c of citizens) {
    if (!citizenByProf.has(c.profession)) citizenByProf.set(c.profession, c);
  }

  // A. Governor / Magistrate at Grand Plaza
  const primaryCitizen = citizens[0] || { name: "Lord Elden Vance", profession: "Governor", species: "Human", temper: "RESOLUTE" };
  npcs.push({
    id: `npc_burg_governor_${burg.burg_id}`,
    name: `${primaryCitizen.name} (${primaryCitizen.profession})`,
    role: "Burg Governor / High Magistrate",
    pos: [CENTER + 4, CENTER + 4],
    tags: ["leader", "civilian", primaryCitizen.species.toLowerCase(), "magistrate"],
    faction: factionName,
    hp: 25,
    maxHp: 25,
    disposition: 1,
    alive: true,
    equippedWeapon: "Ornate Gilded Rapier",
    equippedArmor: "Fine Silk & Brocade Mantle",
    statAffinity: "charm",
    memoryNotes: [`Oversees ${burgName} for ${factionName}.`, `Temperament: ${primaryCitizen.temper}`]
  });

  // B. Town Baker at the Hearth Bakery
  const baker = citizenByProf.get("Baker") || { name: "Kaelen Thorne", species: "Human", temper: "WARM" };
  npcs.push({
    id: `npc_baker_${burg.burg_id}`,
    name: `${baker.name} (Town Baker)`,
    role: "Town Baker",
    pos: [CENTER + 22, CENTER + 17],
    tags: ["artisan", "baker", "food", baker.species.toLowerCase()],
    faction: factionName,
    hp: 22,
    maxHp: 22,
    disposition: 1,
    alive: true,
    equippedWeapon: "Hardwood Baker's Peel",
    equippedArmor: "Flour-Dusted Linen Apron",
    statAffinity: "endurance",
    memoryNotes: [`Bakes the daily bread rations for ${burgName} at the Communal Hearth Bakery.`]
  });

  // C. Master Smith at the Forge
  const smith = citizenByProf.get("Blacksmith") || citizenByProf.get("Armorer") || citizenByProf.get("Foundry Worker") || { name: "Brogren Ironhand", species: "Human", temper: "STOIC" };
  npcs.push({
    id: `npc_smith_${burg.burg_id}`,
    name: `${smith.name} (Master Armorer)`,
    role: "Master Blacksmith",
    pos: [CENTER - 34, CENTER - 18],
    tags: ["artisan", "smith", "metal", smith.species.toLowerCase()],
    faction: factionName,
    hp: 32,
    maxHp: 32,
    disposition: 1,
    alive: true,
    equippedWeapon: "Heavy Sledgehammer",
    equippedArmor: "Hardened Leather Apron",
    statAffinity: "might",
    memoryNotes: [`Runs the Armory & Smithy Forge of ${burgName}.`]
  });

  // D. Watch Captain at the Barracks
  const guard = citizenByProf.get("City Watchman") || { name: "Captain Vaelen", species: "Human", temper: "VIGILANT" };
  npcs.push({
    id: `npc_guard_captain_${burg.burg_id}`,
    name: `${guard.name} (Watch Captain)`,
    role: "Watch Captain",
    pos: [CENTER - 30, CENTER - 30],
    tags: ["guard", "soldier", "military", guard.species.toLowerCase()],
    faction: factionName,
    hp: 36,
    maxHp: 36,
    disposition: 0,
    alive: true,
    equippedWeapon: "Steel Halberd & Shortsword",
    equippedArmor: "Chainmail Hauberk & Steel Bascinet",
    statAffinity: "endurance",
    memoryNotes: [`Commands the city watch from the Sovereign Guard Barracks.`]
  });

  // E. Brewmaster at the Brewhouse
  const brewer = citizenByProf.get("Brewmaster") || { name: "Aldous Stout", species: "Human", temper: "JOVIAL" };
  npcs.push({
    id: `npc_brewer_${burg.burg_id}`,
    name: `${brewer.name} (Master Brewer)`,
    role: "Brewmaster",
    pos: [CENTER - 20, CENTER + 19],
    tags: ["artisan", "brewer", "food", brewer.species.toLowerCase()],
    faction: factionName,
    hp: 24,
    maxHp: 24,
    disposition: 1,
    alive: true,
    equippedWeapon: "Copper Mash Paddle",
    statAffinity: "vitality",
    memoryNotes: [`Brews regional ale at the Cask & Flagon Brewhouse.`]
  });

  // F. Apothecary at the Herbarium
  const herbalist = citizenByProf.get("Hedge Herbalist") || { name: "Alys Moss", species: "Human", temper: "COMPASSIONATE" };
  npcs.push({
    id: `npc_apothecary_${burg.burg_id}`,
    name: `${herbalist.name} (Apothecary)`,
    role: "Herbal Healer",
    pos: [CENTER + 32, CENTER + 31],
    tags: ["medical", "healer", "herbalist", herbalist.species.toLowerCase()],
    faction: factionName,
    hp: 20,
    maxHp: 20,
    disposition: 1,
    alive: true,
    equippedWeapon: "Bronze Mortar & Pestle",
    statAffinity: "knowledge",
    memoryNotes: [`Prepares healing draughts at the Apothecary Dispensary.`]
  });

  // G. Temple Priest at the Cathedral Altar
  const priest = citizenByProf.get("Temple Acolyte") || { name: "Father Orson", species: "Human", temper: "DEVOUT" };
  npcs.push({
    id: `npc_priest_${burg.burg_id}`,
    name: `${priest.name} (Temple Acolyte)`,
    role: "High Priest of the Seals",
    pos: [CENTER - 45, CENTER + 34],
    tags: ["priest", "holy", "sacred", priest.species.toLowerCase()],
    faction: factionName,
    hp: 26,
    maxHp: 26,
    disposition: 1,
    alive: true,
    equippedWeapon: "Ceremonial Dragon Sigil",
    statAffinity: "willpower",
    memoryNotes: [`Maintains the sacred wards at the Cathedral Altar.`]
  });

  // H. Station Underworld Lairs & Syndicate Enforcers if present
  if (Array.isArray(lairs) && lairs.length > 0) {
    for (let idx = 0; idx < lairs.length; idx++) {
      const lair = lairs[idx];
      const posX = 164 + (idx * 6);
      const posY = 164 + (idx * 6);
      const lairPropId = `prop_underworld_lair_${lair.id}`;

      let propName = `Hidden ${lair.lair_type.replace(/_/g, " ")} (${lair.cartel_name || "Syndicate"})`;
      let propDesc = `A concealed underworld den operated by ${lair.cartel_name || "a local syndicate"}.`;
      let propTags = ["underworld", "secret", "outlaw", lair.lair_type.toLowerCase()];

      switch (lair.lair_type) {
        case "SHADOW_VAULT":
          propName = `Gilded Shadow Vault & Safehouse (${lair.cartel_name || "Gilded Compass"})`;
          propDesc = "Concealed heavy steel vault door behind an unassuming ledger archive, stashing illicit usury receipts and meridian gold.";
          propTags = ["metal", "stone", "vault", "underworld", "locked", "shadow_vault"];
          break;
        case "USURY_HOUSE":
          propName = `Back-Alley Usury House & Pawn Exchange (${lair.cartel_name || "Gilded Compass"})`;
          propDesc = "Dimly lit parlor where desperate debtors pledge collateral under exorbitant interest rates.";
          propTags = ["wood", "underworld", "usury", "desk", "ledger"];
          break;
        case "CONTRABAND_DOCK":
          propName = `Hidden Contraband Slipway & Sky-Cache (${lair.cartel_name || "Free Sky"})`;
          propDesc = "Camouflaged docking crane and smuggling crates marked with the Free Sky insignia, bypassing toll tariffs.";
          propTags = ["wood", "contraband", "crane", "cargo", "underworld"];
          break;
        case "SKY_CORSAIR_CACHE":
          propName = `Concealed Sky-Corsair Arms Cache (${lair.cartel_name || "Free Sky"})`;
          propDesc = "Reinforced lockboxes containing grappling tether guns, gliding cloaks, and aerolith charge canisters.";
          propTags = ["metal", "wood", "cache", "weapons", "underworld"];
          break;
        case "MERCENARY_GARRISON":
          propName = `Devil's Choice Sellsword Strongpoint (${lair.cartel_name || "Devil's Choice"})`;
          propDesc = "Fortified cellar barricade smelling of pitch, iron, and stale wine where brutal mercenaries await contracts.";
          propTags = ["stone", "wood", "barricade", "garrison", "underworld", "weapons"];
          break;
        case "TOLL_BLOCKADE":
          propName = `Ivory-Gate Toll Redoubt & Iron Gate (${lair.cartel_name || "Ivory-Gate"})`;
          propDesc = "Illegal fortified toll checkpoint extorting passage tariffs from merchant wagons and travelers.";
          propTags = ["stone", "metal", "toll", "gate", "underworld"];
          break;
        case "ENFORCER_DEN":
          propName = `Ivory-Gate Enforcer Den & Holding Cell (${lair.cartel_name || "Ivory-Gate"})`;
          propDesc = "Heavily fortified headquarters for legion debt collectors and martial enforcers.";
          propTags = ["stone", "iron", "cell", "enforcer", "underworld"];
          break;
        case "RAIDER_REDOUBT":
          propName = `Ghostwind Raider Redoubt & Stash (${lair.cartel_name || "Ghostwind Raiders"})`;
          propDesc = "Hidden enclave fortified with driftwood barriers, caches of coastal plunder, and signal flares.";
          propTags = ["wood", "stone", "redoubt", "cache", "underworld"];
          break;
        case "SMUGGLER_COVE":
          propName = `Clandestine Smuggler Cove & Cache (${lair.cartel_name || "Ghostwind Raiders"})`;
          propDesc = "Subterranean cavern tunnel connecting coastal channels directly to secret storehouses.";
          propTags = ["stone", "water", "cave", "smuggler", "underworld"];
          break;
        case "BLACK_MARKET":
          propName = `Secret Black Market Bazaar (${lair.cartel_name || "Syndicate"})`;
          propDesc = "Shrouded bazaar of unlicensed goods, forged permits, and contraband potions.";
          propTags = ["wood", "cloth", "underworld", "black_market"];
          break;
        case "VICE_DEN":
          propName = `Illicit Vice Den & Speakeasy (${lair.cartel_name || "Syndicate"})`;
          propDesc = "Smoky basement den dealing in forbidden concoctions, high-stakes dice, and hush money.";
          propTags = ["wood", "underworld", "tavern", "vice"];
          break;
      }

      props.push({
        id: lairPropId,
        name: propName,
        pos: [posX, posY],
        tags: propTags,
        hp: 150,
        maxHp: 150,
        description: propDesc
      });

      const enforcerId = `npc_outlaw_enforcer_${lair.id}`;
      const cartelName = lair.cartel_name || "Syndicate";
      const weapon = cartelName.includes("Free Sky") ? "Repeater Crossbow" :
                     cartelName.includes("Devil's Choice") ? "Spiked Morningstar" :
                     cartelName.includes("Ivory-Gate") ? "Heavy Halberd" :
                     cartelName.includes("Ghostwind") ? "Serrated Cutlass" : "Gilded Dagger";
      const affinity = cartelName.includes("Free Sky") ? "reflex" :
                       cartelName.includes("Ivory-Gate") ? "endurance" : "might";

      npcs.push({
        id: enforcerId,
        name: `${cartelName} Veteran Enforcer`,
        role: `Underworld Enforcer (${lair.lair_type.replace(/_/g, " ")})`,
        pos: [posX + 2, posY + 1],
        tags: ["outlaw", "enforcer", "underworld", "hostile_to_guards"],
        faction: cartelName,
        hp: 35,
        maxHp: 35,
        disposition: 0,
        alive: true,
        equippedWeapon: weapon,
        equippedArmor: "Reinforced Boiled Leather",
        statAffinity: affinity,
        memoryNotes: [
          `Guards the ${propName}.`,
          `Local Heat: ${lair.heat || 0}/100. Manpower garrison: ${lair.manpower || 50}.`
        ]
      });
    }
  }

  return {
    grid,
    compressed: zlib.gzipSync(Buffer.from(grid)),
    props,
    npcs,
    poiType: tier === 3 ? "BURG_METROPOLIS" : tier === 2 ? "BURG_TOWN" : "BURG_VILLAGE",
    name: burgName,
    features: {
      burgId: burg.burg_id,
      urbanTier: tier,
      isPort,
      wealth: burg.wealth,
      food: burg.food,
      unrest: burg.unrest,
      factionName
    }
  };
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
