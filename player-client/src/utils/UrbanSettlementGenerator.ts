import type { InjectedProp, InjectedNPC } from '../types';

export interface UrbanLayoutResult {
  grid: Uint8Array;
  props: InjectedProp[];
  npcs: InjectedNPC[];
}

/**
 * Generates a full 256x256 procedural Urban Burg Settlement
 * complete with fortified stone curtain walls, cardinal gatehouses,
 * central market plaza, 4 urban districts, functional civic props, and stationed citizens.
 */
export function generateUrbanSettlement(
  burgName: string,
  factionName: string,
  _urbanTier: number = 2,
  unrest: number = 10,
  _biomeId: number = 6
): UrbanLayoutResult {
  const SIZE = 256;
  const grid = new Uint8Array(SIZE * SIZE);

  // Initialize base terrain (Lush ground 0 or cobblestone)
  grid.fill(0);

  const WALL_LEFT = 32;
  const WALL_RIGHT = 224;
  const WALL_TOP = 32;
  const WALL_BOTTOM = 224;
  const CENTER = 128;

  // --- 1. OUTER CURTAIN WALLS & CARDINAL GATEHOUSES ---
  // Tile 5 = Structure Stone Wall, Tile 4 = Cobblestone Road
  for (let x = WALL_LEFT; x <= WALL_RIGHT; x++) {
    // Top wall
    grid[WALL_TOP * SIZE + x] = 5;
    grid[(WALL_TOP + 1) * SIZE + x] = 5;
    // Bottom wall
    grid[WALL_BOTTOM * SIZE + x] = 5;
    grid[(WALL_BOTTOM - 1) * SIZE + x] = 5;
  }
  for (let y = WALL_TOP; y <= WALL_BOTTOM; y++) {
    // Left wall
    grid[y * SIZE + WALL_LEFT] = 5;
    grid[y * SIZE + WALL_LEFT + 1] = 5;
    // Right wall
    grid[y * SIZE + WALL_RIGHT] = 5;
    grid[y * SIZE + WALL_RIGHT - 1] = 5;
  }

  // Corner Bastion Towers (6x6 solid stone)
  const drawTower = (cx: number, cy: number) => {
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const tx = cx + dx;
        const ty = cy + dy;
        if (tx >= 0 && tx < SIZE && ty >= 0 && ty < SIZE) {
          grid[ty * SIZE + tx] = 5;
        }
      }
    }
  };
  drawTower(WALL_LEFT, WALL_TOP);
  drawTower(WALL_RIGHT, WALL_TOP);
  drawTower(WALL_LEFT, WALL_BOTTOM);
  drawTower(WALL_RIGHT, WALL_BOTTOM);

  // --- 2. CARDINAL COBBLESTONE THOROUGHFARES ---
  const ROAD_HALF_WIDTH = 3; // 6-tile wide grand avenues

  // North-South King's Way
  for (let y = 0; y < SIZE; y++) {
    for (let dx = -ROAD_HALF_WIDTH; dx <= ROAD_HALF_WIDTH; dx++) {
      const x = CENTER + dx;
      if (x >= 0 && x < SIZE) {
        grid[y * SIZE + x] = 4; // Cobblestone road
      }
    }
  }

  // East-West Silk Avenue
  for (let x = 0; x < SIZE; x++) {
    for (let dy = -ROAD_HALF_WIDTH; dy <= ROAD_HALF_WIDTH; dy++) {
      const y = CENTER + dy;
      if (y >= 0 && y < SIZE) {
        grid[y * SIZE + x] = 4; // Cobblestone road
      }
    }
  }

  // Inner Ring Road inside walls
  for (let x = WALL_LEFT + 4; x <= WALL_RIGHT - 4; x++) {
    for (let d = 0; d < 3; d++) {
      grid[(WALL_TOP + 4 + d) * SIZE + x] = 4;
      grid[(WALL_BOTTOM - 6 + d) * SIZE + x] = 4;
    }
  }
  for (let y = WALL_TOP + 4; y <= WALL_BOTTOM - 4; y++) {
    for (let d = 0; d < 3; d++) {
      grid[y * SIZE + (WALL_LEFT + 4 + d)] = 4;
      grid[y * SIZE + (WALL_RIGHT - 6 + d)] = 4;
    }
  }

  // --- 3. GRAND MARKET PLAZA (CENTER) ---
  const PLAZA_RADIUS = 22;
  for (let y = CENTER - PLAZA_RADIUS; y <= CENTER + PLAZA_RADIUS; y++) {
    for (let x = CENTER - PLAZA_RADIUS; x <= CENTER + PLAZA_RADIUS; x++) {
      if (x >= 0 && x < SIZE && y >= 0 && y < SIZE) {
        grid[y * SIZE + x] = 4; // Paved stone plaza
      }
    }
  }

  // Helper to construct a furnished building block
  const buildStructure = (
    bx: number,
    by: number,
    w: number,
    h: number,
    doorSide: 'N' | 'S' | 'E' | 'W'
  ) => {
    for (let y = by; y < by + h; y++) {
      for (let x = bx; x < bx + w; x++) {
        if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) continue;
        const isWall = x === bx || x === bx + w - 1 || y === by || y === by + h - 1;
        if (isWall) {
          grid[y * SIZE + x] = 5; // Stone wall
        } else {
          grid[y * SIZE + x] = 4; // Stone floor interior
        }
      }
    }
    // Punch doorway
    if (doorSide === 'S') {
      const mid = bx + Math.floor(w / 2);
      grid[(by + h - 1) * SIZE + mid] = 4;
      grid[(by + h - 1) * SIZE + mid + 1] = 4;
    } else if (doorSide === 'N') {
      const mid = bx + Math.floor(w / 2);
      grid[by * SIZE + mid] = 4;
      grid[by * SIZE + mid + 1] = 4;
    } else if (doorSide === 'E') {
      const mid = by + Math.floor(h / 2);
      grid[mid * SIZE + (bx + w - 1)] = 4;
      grid[(mid + 1) * SIZE + (bx + w - 1)] = 4;
    } else if (doorSide === 'W') {
      const mid = by + Math.floor(h / 2);
      grid[mid * SIZE + bx] = 4;
      grid[(mid + 1) * SIZE + bx] = 4;
    }
  };

  // --- 4. FOUR URBAN DISTRICTS ---
  // District 1: North-West (Civic & Military Garrison)
  buildStructure(WALL_LEFT + 12, WALL_TOP + 12, 28, 22, 'S'); // Barracks
  buildStructure(WALL_LEFT + 46, WALL_TOP + 12, 32, 26, 'E'); // City Watch Hall
  buildStructure(WALL_LEFT + 16, WALL_TOP + 42, 22, 20, 'E'); // Armory
  buildStructure(WALL_LEFT + 46, WALL_TOP + 46, 26, 22, 'S'); // Court of Justice

  // District 2: North-East (Temple & High Sanctum)
  buildStructure(CENTER + 18, WALL_TOP + 12, 36, 30, 'S'); // Grand Sun Cathedral
  buildStructure(CENTER + 60, WALL_TOP + 16, 24, 20, 'W'); // Priory / Scriptorium
  buildStructure(CENTER + 24, WALL_TOP + 48, 28, 22, 'S'); // Reliquary Chamber
  buildStructure(CENTER + 58, WALL_TOP + 46, 26, 24, 'W'); // Healing Ward

  // District 3: South-West (Artisan & Blacksmith Ward)
  buildStructure(WALL_LEFT + 14, CENTER + 16, 26, 22, 'N'); // Master Smithy & Forge
  buildStructure(WALL_LEFT + 48, CENTER + 16, 28, 22, 'N'); // Leather Tannery
  buildStructure(WALL_LEFT + 18, CENTER + 46, 24, 24, 'E'); // Carpentry Mill
  buildStructure(WALL_LEFT + 48, CENTER + 46, 28, 24, 'N'); // Alchemy Laboratory

  // District 4: South-East (Tavern & Residential Quarter)
  buildStructure(CENTER + 16, CENTER + 16, 32, 26, 'N'); // "The Blood-Moon Tankard" Tavern & Inn
  buildStructure(CENTER + 56, CENTER + 16, 26, 22, 'W'); // General Merchant Exchange
  buildStructure(CENTER + 20, CENTER + 48, 28, 24, 'N'); // Residential Rowhouse
  buildStructure(CENTER + 56, CENTER + 46, 28, 26, 'W'); // Baker & Provisions Store

  // --- 5. FUNCTIONAL URBAN PROPS ---
  const props: InjectedProp[] = [
    // Central Plaza Landmarks
    {
      id: 'prop_town_fountain',
      name: `${burgName} Municipal Fountain`,
      pos: [CENTER, CENTER],
      tags: ['stone', 'water_source', 'drinkable', 'sacred'],
      hp: 100,
      maxHp: 100,
      isDestroyed: false,
      inventory: ['Flask of Pure Spring Water']
    },
    {
      id: 'prop_town_notice_board',
      name: `${burgName} Reeve Bounties & Notices`,
      pos: [CENTER - 6, CENTER - 6],
      tags: ['wood', 'notice_board', 'board'],
      hp: 35,
      maxHp: 35,
      isDestroyed: false
    },
    {
      id: 'prop_market_stall_1',
      name: 'Spices & Dried Provisions Stall',
      pos: [CENTER + 8, CENTER - 6],
      tags: ['wood', 'container', 'merchant', 'lootable'],
      hp: 30,
      maxHp: 30,
      isDestroyed: false,
      inventory: ['Dried Dates', 'Salted Meat', 'Aromatic Cinnamon']
    },
    {
      id: 'prop_market_stall_2',
      name: 'Textiles & Leather Crafts Stall',
      pos: [CENTER + 8, CENTER + 6],
      tags: ['wood', 'container', 'merchant', 'lootable'],
      hp: 30,
      maxHp: 30,
      isDestroyed: false,
      inventory: ['Bolt of Silk', 'Supple Leather Straps']
    },
    {
      id: 'prop_market_stall_3',
      name: 'Apothecary Herb Cart',
      pos: [CENTER - 8, CENTER + 6],
      tags: ['wood', 'container', 'flora', 'herbs', 'crafting'],
      hp: 25,
      maxHp: 25,
      isDestroyed: false,
      inventory: ['Medicinal Wild Sage', 'Sun-Dried Dragonmoss', 'Phial of Spring Water']
    },

    // Blacksmith Forge & Anvil (South-West)
    {
      id: 'prop_master_anvil',
      name: 'Blacksmith Iron Anvil',
      pos: [WALL_LEFT + 26, CENTER + 26],
      tags: ['crafting', 'forge', 'metal', 'stone', 'heavy'],
      hp: 120,
      maxHp: 120,
      isDestroyed: false
    },
    {
      id: 'prop_forge_hearth',
      name: 'Blazing Smelting Hearth',
      pos: [WALL_LEFT + 22, CENTER + 22],
      tags: ['fire', 'heat', 'stone', 'burning'],
      hp: 80,
      maxHp: 80,
      isDestroyed: false
    },

    // Tavern Barrels & Hearth (South-East)
    {
      id: 'prop_tavern_keg',
      name: 'Cask of Spiced Dwarven Ale',
      pos: [CENTER + 28, CENTER + 26],
      tags: ['wood', 'barrel', 'container', 'drinkable'],
      hp: 30,
      maxHp: 30,
      isDestroyed: false,
      inventory: ['Spiced Ale Mug']
    },
    {
      id: 'prop_tavern_hearth',
      name: 'Tavern Hearthfire',
      pos: [CENTER + 32, CENTER + 22],
      tags: ['fire', 'heat', 'stone', 'burning'],
      hp: 60,
      maxHp: 60,
      isDestroyed: false
    },

    // North Gatehouse Portcullis & Watchtowers
    {
      id: 'prop_north_gate',
      name: 'Northern Fortress Portcullis',
      pos: [CENTER, WALL_TOP],
      tags: ['door', 'gate', 'metal', 'cover_heavy'],
      hp: 150,
      maxHp: 150,
      isDestroyed: false
    },
    {
      id: 'prop_south_gate',
      name: 'Southern Highway Gate',
      pos: [CENTER, WALL_BOTTOM],
      tags: ['door', 'gate', 'metal', 'cover_heavy'],
      hp: 150,
      maxHp: 150,
      isDestroyed: false
    }
  ];

  // --- 6. PROCEDURAL RESIDENT URBAN POPULATION SYNTHESIS ---
  // Synthesizes authentic citizens dynamically based on Burg Urban Tier, Unrest, and Faction Sovereignty.
  const npcs: InjectedNPC[] = generateProceduralUrbanPopulation({
    burgName,
    factionName,
    urbanTier: _urbanTier,
    unrest,
    biomeId: _biomeId,
    center: CENTER,
    wallTop: WALL_TOP,
    wallBottom: WALL_BOTTOM,
    wallLeft: WALL_LEFT,
    wallRight: WALL_RIGHT
  });

  return { grid, props, npcs };
}

interface UrbanPopulationParams {
  burgName: string;
  factionName: string;
  urbanTier: number;
  unrest: number;
  biomeId: number;
  center: number;
  wallTop: number;
  wallBottom: number;
  wallLeft: number;
  wallRight: number;
}

/**
 * Procedural name generator for urban citizens:
 * Combines cultural syllables, titles, and epithets without hardcoded static personas.
 */
function generateCitizenName(role: string, _faction: string, burgName: string, index: number): string {
  const FIRST_PREFIXES = ['Al', 'Bran', 'Cor', 'Drak', 'Eld', 'Farr', 'Gar', 'Hald', 'Kael', 'Lor', 'Marn', 'Nym', 'Oren', 'Row', 'Syl', 'Ther', 'Vael', 'Wren', 'Beld', 'Tor'];
  const FIRST_SUFFIXES = ['an', 'en', 'ic', 'or', 'us', 'ia', 'wen', 'a', 'in', 'on', 'mar', 'is', 'dan', 'lyn', 'var'];

  const pIdx = (index * 7 + role.length * 3) % FIRST_PREFIXES.length;
  const sIdx = (index * 13 + burgName.length * 5) % FIRST_SUFFIXES.length;
  const firstName = FIRST_PREFIXES[pIdx] + FIRST_SUFFIXES[sIdx];

  const EPITHETS_MARTIAL = ['the Vigilant', 'Shield-Bearer', 'Iron-Sworn', 'the Stern', 'of the Burg Guard', 'Gate-Ward', 'Tall-Spear', 'the Unyielding'];
  const EPITHETS_TRADE = ['the Provisioner', 'Swift-Coin', 'the Ledger-Keeper', 'the Factor', 'Gold-Hand', 'of the Trade League', 'Fair-Scale'];
  const EPITHETS_CRAFT = ['Iron-Bane', 'Forge-Master', 'Steel-Bender', 'Anvil-Striker', 'Flame-Tender', 'the Smith', 'Hammer-Hand'];
  const EPITHETS_HOSPITALITY = ['the Hearth-Keeper', 'the Host', 'Sweet-Draft', 'Cask-Tender', 'of the Tankard', 'the Welcoming'];
  const EPITHETS_COMMON = ['the Tanner', 'Miller', 'Weaver', 'Cooper', 'Wood-Carver', 'the Apprentice', 'Stonemason'];

  let epithet = '';
  const r = role.toLowerCase();
  if (r.includes('captain') || r.includes('officer')) {
    const e = EPITHETS_MARTIAL[(index * 5) % EPITHETS_MARTIAL.length];
    return `Captain ${firstName} ${e}`;
  } else if (r.includes('guard') || r.includes('sentry')) {
    const e = EPITHETS_MARTIAL[(index * 3) % EPITHETS_MARTIAL.length];
    return `Watchman ${firstName} ${e}`;
  } else if (r.includes('merchant') || r.includes('trader') || r.includes('provisioner')) {
    const e = EPITHETS_TRADE[(index * 4) % EPITHETS_TRADE.length];
    return `Merchant ${firstName} ${e}`;
  } else if (r.includes('smith') || r.includes('armorer')) {
    const e = EPITHETS_CRAFT[(index * 6) % EPITHETS_CRAFT.length];
    return `Master ${firstName} ${e}`;
  } else if (r.includes('innkeeper') || r.includes('tavern')) {
    const e = EPITHETS_HOSPITALITY[(index * 2) % EPITHETS_HOSPITALITY.length];
    return `Innkeeper ${firstName} ${e}`;
  } else {
    epithet = EPITHETS_COMMON[(index * 3) % EPITHETS_COMMON.length];
    return `${firstName} ${epithet}`;
  }
}

/**
 * Procedurally generates the resident urban population based on simulation parameters:
 * - Urban Tier dictates headcount and civic hierarchy
 * - Unrest alters disposition, guard vigilance, and civilian morale
 * - Roles, Concordia 12-stats, loadouts, and building assignments are dynamically calculated
 */
function generateProceduralUrbanPopulation(params: UrbanPopulationParams): InjectedNPC[] {
  const { burgName, factionName, urbanTier, unrest, center, wallTop, wallBottom, wallLeft } = params;
  const population: InjectedNPC[] = [];

  // Headcount scales dynamically with urban tier (Tier 1: 5 citizens, Tier 2: 7 citizens, Tier 3: 10 citizens)
  const citizenCount = Math.max(5, Math.min(12, 3 + urbanTier * 2 + Math.floor(unrest / 25)));

  interface RoleArchetype {
    role: string;
    affinity: 'might' | 'endurance' | 'finesse' | 'reflex' | 'vitality' | 'fortitude' | 'knowledge' | 'logic' | 'awareness' | 'intuition' | 'charm' | 'willpower';
    weapon: string;
    armor: string;
    tags: string[];
    workPos: [number, number];
    homePos: [number, number];
    task: string;
    baseHp: number;
    inventory: string[];
    disposition: number;
  }

  // Define dynamic role definitions anchored to the procedural district coordinates
  const archetypes: RoleArchetype[] = [
    // 1. Guard Commander / Watch Captain (North Gate Garrison)
    {
      role: 'City Watch Captain',
      affinity: 'endurance',
      weapon: 'Titanium Bastion Spear',
      armor: 'Glacial Iron Hauberk',
      tags: ['human', 'guard', 'disciplined', 'officer', 'authority'],
      workPos: [center - 2, wallTop + 4],
      homePos: [wallLeft + 22, wallTop + 20],
      task: 'Commanding Watch Patrols',
      baseHp: 32,
      inventory: ['City Watch Key', 'Fine Rations', 'Whistle of Alarm', 'Command Signet'],
      disposition: unrest > 40 ? -1 : 1
    },
    // 2. North Gate Sentry
    {
      role: 'Gate Sentry',
      affinity: 'reflex',
      weapon: 'Titanium Bastion Spear',
      armor: 'Glacial Iron Hauberk',
      tags: ['human', 'guard', 'disciplined', 'sentry'],
      workPos: [center + 2, wallTop + 4],
      homePos: [wallLeft + 24, wallTop + 24],
      task: 'Inspecting Incoming Wayfarers',
      baseHp: 24,
      inventory: ['Watch Patrol Token', 'Field Provisions'],
      disposition: unrest > 50 ? -1 : 1
    },
    // 3. South Gate Sentry
    {
      role: 'Gate Sentry',
      affinity: 'might',
      weapon: 'Osmium Greatsword',
      armor: 'Glacial Iron Hauberk',
      tags: ['human', 'guard', 'disciplined', 'sentry'],
      workPos: [center + 2, wallBottom - 4],
      homePos: [wallLeft + 24, wallTop + 26],
      task: 'Manning Southern Highway Gate',
      baseHp: 24,
      inventory: ['Gate Duty Token', 'Dry Rations'],
      disposition: 1
    },
    // 4. Grand Plaza Guild Merchant / Factor
    {
      role: 'Merchant Factor',
      affinity: 'charm',
      weapon: "Gilded Courtier's Fan",
      armor: 'Stalker Shadow Leathers',
      tags: ['human', 'merchant', 'trader', 'vendor', 'bribeable'],
      workPos: [center + 5, center - 4],
      homePos: [center + 28, center + 32],
      task: 'Trading Commodities & Ledger Audits',
      baseHp: 16,
      inventory: ['Merchant Ledger', 'Purse of 45 Gold', 'Spiced Tea Leaves', 'Trade Stamp'],
      disposition: 1
    },
    // 5. Artisan Weaponsmith & Armorer (Forge Ward)
    {
      role: 'Weaponsmith & Armorer',
      affinity: 'might',
      weapon: 'Flanged Warhammer',
      armor: 'Juggernaut Osmium Plate',
      tags: ['dwarf', 'artisan', 'crafting', 'smith', 'vendor'],
      workPos: [wallLeft + 24, center + 24],
      homePos: [wallLeft + 32, center + 28],
      task: 'Forging Tempered Steel & Repaying Orders',
      baseHp: 28,
      inventory: ['Tempered Steel Ingot', 'Blacksmith Apron', 'Refined Flux', 'Forged Nails'],
      disposition: 1
    },
    // 6. Common Tavern Innkeeper (Residential & Tavern Ward)
    {
      role: 'Tavern Innkeeper',
      affinity: 'charm',
      weapon: 'Venomous Needle Dart',
      armor: 'Padded Gambeson',
      tags: ['human', 'innkeeper', 'vendor', 'friendly', 'diplomat'],
      workPos: [center + 24, center + 22],
      homePos: [center + 32, center + 18],
      task: 'Tending Bar & Dispensing Local Rumors',
      baseHp: 18,
      inventory: ['Tavern Larder Key', 'Sweet Pastries', 'Cask Bung', 'Recipe Notes'],
      disposition: 1
    },
    // 7. Plaza Reagent Apothecary
    {
      role: 'Apothecary Provisioner',
      affinity: 'knowledge',
      weapon: 'Quarterstaff of Focus',
      armor: 'Padded Gambeson',
      tags: ['human', 'merchant', 'vendor', 'scholar', 'alchemy'],
      workPos: [center - 6, center + 6],
      homePos: [center + 26, center + 28],
      task: 'Brewing Restorative Salves & Sorting Herbs',
      baseHp: 15,
      inventory: ['Mortar & Pestle', 'Vial of Sweet-Water', 'Bundle of Dried Bitter-Berry'],
      disposition: 1
    },
    // 8. Temple Priest / High Sanctum Caretaker
    {
      role: 'Sanctum Priest',
      affinity: 'willpower',
      weapon: 'Radiant Sun Scepter',
      armor: 'Padded Gambeson',
      tags: ['human', 'priest', 'devotee', 'healer', 'sanctum'],
      workPos: [center + 24, wallTop + 24],
      homePos: [center + 28, wallTop + 18],
      task: 'Offering Prayers for Celestial Stability',
      baseHp: 20,
      inventory: ['Holy Water Flask', 'Incense Censer', 'Scripture Parchment'],
      disposition: 1
    },
    // 9. Civic Artisan Carpenter
    {
      role: 'Guild Carpenter',
      affinity: 'fortitude',
      weapon: 'Woodcutter Great-Axe',
      armor: 'Stalker Shadow Leathers',
      tags: ['human', 'artisan', 'crafting', 'laborer'],
      workPos: [wallLeft + 30, center + 18],
      homePos: [wallLeft + 36, center + 18],
      task: 'Hewing Timber for Municipal Repairs',
      baseHp: 22,
      inventory: ['Carpentry Chisel', 'Dry Timber Stave'],
      disposition: 1
    },
    // 10. Disenfranchised Citizen / Bread-Rioter (Manifests under high unrest)
    {
      role: 'Disenfranchised Laborer',
      affinity: 'reflex',
      weapon: 'Hunting Knife',
      armor: 'Rags',
      tags: ['human', 'peasant', 'unrest', 'desperate'],
      workPos: [center - 12, center - 12],
      homePos: [center - 18, center - 18],
      task: unrest > 40 ? 'Plotting Bread Strike' : 'Seeking Daily Wage Labor',
      baseHp: 14,
      inventory: ['Stale Crust of Bread', 'Copper Bit'],
      disposition: unrest > 45 ? -1 : 0
    }
  ];

  for (let i = 0; i < citizenCount && i < archetypes.length; i++) {
    const arch = archetypes[i];
    const name = generateCitizenName(arch.role, factionName, burgName, i);
    const id = `urban_${arch.role.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${i + 1}`;

    // Generate balanced 12-stat Concordia matrix centered around archetype affinity
    const stats: Record<string, number> = {
      might: 5, endurance: 5, finesse: 5, reflex: 5,
      vitality: 5, fortitude: 5, knowledge: 5, logic: 5,
      awareness: 5, intuition: 5, charm: 5, willpower: 5
    };

    // Boost primary stat and secondary attributes
    stats[arch.affinity] = 8 + (i % 2);
    if (arch.affinity === 'might' || arch.affinity === 'endurance') {
      stats.fortitude += 2;
      stats.vitality += 1;
    } else if (arch.affinity === 'charm') {
      stats.intuition += 2;
      stats.knowledge += 1;
    } else if (arch.affinity === 'reflex') {
      stats.awareness += 2;
      stats.finesse += 1;
    } else if (arch.affinity === 'knowledge') {
      stats.logic += 2;
      stats.willpower += 1;
    }

    const staminaPool = Math.max(4, Math.min(10, Math.floor((stats.might + stats.endurance + stats.vitality) / 2)));
    const focusPool = Math.max(4, Math.min(10, Math.floor((stats.knowledge + stats.logic + stats.willpower) / 2)));

    population.push({
      id,
      name,
      role: arch.role,
      pos: [...arch.workPos],
      tags: [...arch.tags],
      faction: arch.tags.includes('guard') ? factionName : (arch.tags.includes('merchant') ? 'Merchant League' : (arch.tags.includes('priest') ? 'High Sanctum' : 'Common Folk')),
      hp: arch.baseHp,
      maxHp: arch.baseHp,
      disposition: arch.disposition,
      alive: true,
      equippedWeapon: arch.weapon,
      equippedArmor: arch.armor,
      statAffinity: arch.affinity,
      stats: stats as any,
      kingdom: 'Mammal',
      species: arch.tags.includes('dwarf') ? 'Dwarf' : 'Human',
      inventory: [...arch.inventory],
      currentStamina: staminaPool,
      maxStaminaPool: staminaPool,
      currentFocus: focusPool,
      maxFocusPool: focusPool,
      moveRange: Math.max(3, Math.floor(stats.reflex / 2)),
      stealth: Math.max(3, stats.reflex),
      perception: Math.max(4, stats.awareness),
      workPos: [...arch.workPos],
      homePos: [...arch.homePos],
      scheduleState: 'WORK',
      currentTask: arch.task
    });
  }

  return population;
}
