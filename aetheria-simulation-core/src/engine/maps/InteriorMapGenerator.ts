import zlib from "zlib";
import { generateUniqueOutlawOperative, getLairPropDetails } from "../agents/outlawSyndicates";

export type InteriorType =
  | "CELLAR"
  | "DUNGEON_PRISON"
  | "UNDERWORLD_LAIR"
  | "ANCIENT_CRYPT"
  | "WIZARD_LAB"
  | "CHASM_DEPTHS";

export interface PointOfEntryConfig {
  poiId?: string | undefined;
  parentCellId: number;
  parentRx: number;
  parentRy: number;
  entryPropId: string;
  entryPropName?: string | undefined;
  entryPropTags?: string[] | undefined;
  subMapType?: InteriorType | undefined;
  parameters?: {
    depthLevels?: number | undefined;
    architecturalStyle?: string | undefined;
    dangerRating?: number | undefined;
    elementalAffinity?: string | undefined;
    factionOwnerId?: number | undefined;
    factionName?: string | undefined;
    trophicFaunaType?: string | undefined;
  } | undefined;
}

export interface InteriorMapResult {
  subMapId?: number;
  parentCellId: number;
  parentRx: number;
  parentRy: number;
  parentPropId: string;
  name: string;
  interiorType: InteriorType;
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
  playerSpawn: [number, number];
  exitProp: {
    id: string;
    name: string;
    pos: [number, number];
    tags: string[];
  };
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

const SIZE = 256;
const CENTER = 128;

/**
 * Detect the archetype of interior based on prop attributes
 */
export function detectInteriorType(propId: string, propName: string = "", propTags: string[] = []): InteriorType {
  const lowerName = propName.toLowerCase();
  const lowerId = propId.toLowerCase();
  const tags = propTags.map(t => t.toLowerCase());

  if (tags.some(t => ["cellar", "hatch", "basement", "pantry", "storehouse"].includes(t)) ||
      lowerName.includes("cellar") || lowerName.includes("hatch") || lowerName.includes("basement")) {
    return "CELLAR";
  }

  if (tags.some(t => ["chasm", "canyon", "mine", "shaft"].includes(t)) ||
      lowerName.includes("chasm") || lowerName.includes("canyon") || lowerName.includes("winch") || lowerName.includes("shaft")) {
    return "CHASM_DEPTHS";
  }

  if (tags.some(t => ["vault", "obsidian", "foundry", "casino", "cartel", "underworld"].includes(t)) ||
      lowerName.includes("vault") || lowerName.includes("underworld") || lowerName.includes("obsidian") || lowerName.includes("casino") || lowerId.includes("lair")) {
    return "UNDERWORLD_LAIR";
  }

  if (tags.some(t => ["prison", "jail", "gaol", "portcullis", "oubliette", "cellblock"].includes(t)) ||
      lowerName.includes("prison") || lowerName.includes("jail") || lowerName.includes("gaol") || lowerName.includes("portcullis") || lowerName.includes("dungeon") || lowerName.includes("oubliette") || lowerName.includes("cellblock")) {
    return "DUNGEON_PRISON";
  }

  if (tags.some(t => ["crypt", "tomb", "catacomb", "sarcophagus", "mausoleum"].includes(t)) ||
      lowerName.includes("crypt") || lowerName.includes("tomb") || lowerName.includes("sarcophagus") || lowerName.includes("catacomb")) {
    return "ANCIENT_CRYPT";
  }

  if (tags.some(t => ["wizard", "laboratory", "sanctum", "alchemy", "alchemist", "arcane"].includes(t)) ||
      lowerName.includes("lab") || lowerName.includes("sanctum") || lowerName.includes("alchem") || lowerName.includes("wizard")) {
    return "WIZARD_LAB";
  }

  return "CELLAR";
}

/**
 * Generates an authentic 256x256 interior or dungeon sub-map
 */
export function generateInteriorSubMap(
  parentCellId: number,
  parentRx: number,
  parentRy: number,
  parentPropId: string,
  parentPropName: string = "Sub-Surface Chamber",
  parentPropTags: string[] = [],
  forcedType?: InteriorType
): InteriorMapResult {
  const interiorType = forcedType || detectInteriorType(parentPropId, parentPropName, parentPropTags);
  const seedStr = `interior_${parentCellId}_${parentRx}_${parentRy}_${parentPropId}_${interiorType}`;
  const rng = hashSeed(seedStr);

  const grid = new Uint8Array(SIZE * SIZE);
  // Default: Solid impenetrable bedrock wall (Tile 5)
  grid.fill(5);

  const props: InteriorMapResult["props"] = [];
  const npcs: InteriorMapResult["npcs"] = [];

  // Helper to carve rooms and hallways
  const carveRect = (x0: number, y0: number, x1: number, y1: number, tile: number = 4) => {
    for (let y = Math.max(0, y0); y <= Math.min(SIZE - 1, y1); y++) {
      for (let x = Math.max(0, x0); x <= Math.min(SIZE - 1, x1); x++) {
        grid[y * SIZE + x] = tile;
      }
    }
  };

  const carveCircle = (cx: number, cy: number, r: number, tile: number = 4) => {
    const r2 = r * r;
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        if (x >= 0 && x < SIZE && y >= 0 && y < SIZE) {
          if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r2) {
            grid[y * SIZE + x] = tile;
          }
        }
      }
    }
  };

  let subMapName = "Subterranean Interior";
  const playerSpawn: [number, number] = [CENTER, 226];
  const exitPos: [number, number] = [CENTER, 228];
  let exitName = "Ascending Stairs to Surface";
  let exitTags = ["door", "exit", "stairs_up", "wood", "surface"];

  // Generate specific interior layouts based on archetype
  switch (interiorType) {
    case "CELLAR": {
      subMapName = `${parentPropName.replace("Padlocked ", "").replace("Prop ", "")} (Underground Cellar)`;
      exitName = "Ascending Cellar Trapdoor & Ladder";
      exitTags = ["door", "exit", "hatch", "wood", "ladder", "surface"];

      // Main Storage Hallway & Chamber
      carveRect(116, 170, 140, 228, 4); // Main Hallway (Cobblestone)
      carveRect(102, 180, 115, 205, 4); // West Pantry / Cold Storage
      carveRect(141, 180, 154, 205, 4); // East Smuggler's Recess
      carveRect(120, 145, 136, 169, 4); // North Old Sump & Drain Vault

      // Props
      props.push(
        {
          id: "prop_interior_exit",
          name: exitName,
          pos: exitPos,
          tags: exitTags,
          hp: 80,
          maxHp: 80,
          description: "Heavy timber ladder and spring-counterweighted cellar trapdoor leading up to the surface."
        },
        {
          id: "prop_cellar_wine_racks",
          name: "Dusty Vintage Wine Racks",
          pos: [120, 215],
          tags: ["wood", "container", "flammable", "valuable"],
          hp: 35,
          maxHp: 35,
          description: "Cobweb-strewn oak lattices holding bottles of spiced elderberry vintage and aged malt."
        },
        {
          id: "prop_cellar_ale_tuns",
          name: "Massive Iron-Hooped Ale Casks",
          pos: [136, 215],
          tags: ["wood", "metal", "container", "heavy"],
          hp: 75,
          maxHp: 75,
          description: "Row of heavy cedar brewing casks smelling of fermented malt, yeast, and cellar damp."
        },
        {
          id: "prop_cellar_hanging_meat",
          name: "Cold Storage Brine Troughs & Meat Hooks",
          pos: [106, 192],
          tags: ["metal", "organic", "food", "forageable"],
          hp: 40,
          maxHp: 40,
          description: "Cured sides of salted venison and root baskets of parsnips hung from heavy iron beams."
        },
        {
          id: "prop_cellar_smuggler_stash",
          name: "Concealed Smuggler False-Wall Cache",
          pos: [150, 192],
          tags: ["wood", "locked", "container", "secret", "valuable"],
          hp: 45,
          maxHp: 45,
          description: "Reinforced wooden chest hidden behind dry walling, stamped with unofficial customs seals."
        },
        {
          id: "prop_cellar_hearth_lamp",
          name: "Hanging Iron Oil Lamp",
          pos: [CENTER, 198],
          tags: ["fire", "hearth", "metal", "light"],
          hp: 20,
          maxHp: 20,
          description: "Guttering brass oil lantern casting dancing amber shadows across the cellar flagstones."
        },
        {
          id: "prop_cellar_sewer_grate",
          name: "Rusted Subterranean Sump Grate",
          pos: [CENTER, 148],
          tags: ["metal", "iron", "water", "hazard"],
          hp: 120,
          maxHp: 120,
          description: "Iron drainage bars through which dark, gurgling groundwater flows into municipal culverts."
        }
      );

      // NPCs
      npcs.push({
        id: `npc_cellar_keeper_${parentCellId}`,
        name: "Old Toby the Cellar Master",
        role: "Cellar Master & Provisioner",
        pos: [126, 195],
        tags: ["human", "merchant", "civilian"],
        faction: "Commoners",
        hp: 30,
        maxHp: 30,
        disposition: 1,
        alive: true,
        equippedWeapon: "Heavy Copper Tapping Mallet",
        equippedArmor: "Stout Leather Apron",
        statAffinity: "endurance",
        memoryNotes: ["Maintains the burg's winter provisions and turns a blind eye to quiet deliveries."],
        stats: { might: 12, endurance: 14, finesse: 10, reflex: 10, vitality: 13, fortitude: 12, knowledge: 10, logic: 11, awareness: 12, intuition: 13, charm: 11, willpower: 12 }
      });
      break;
    }

    case "DUNGEON_PRISON": {
      subMapName = `${parentPropName.replace("Prop ", "")} (Dungeon Gaol)`;
      exitName = "Reinforced Gaol Portcullis & Upper Keep Stairs";
      exitTags = ["door", "exit", "gate", "metal", "iron", "stairs_up", "surface"];

      // Central Corridor
      carveRect(124, 150, 132, 228, 4);

      // Guard Station
      carveRect(118, 205, 138, 225, 4);

      // West Cells
      carveRect(106, 185, 122, 200, 4); // Cell 1
      carveRect(106, 160, 122, 178, 4); // Cell 2

      // East Cells & Interrogation Room
      carveRect(134, 185, 150, 200, 4); // Cell 3
      carveRect(134, 155, 152, 178, 4); // Torture / Interrogation Chamber

      // North Deep Oubliette Pit
      carveRect(122, 130, 134, 149, 12); // Deep Abyss pit (Tile 12)

      // Props
      props.push(
        {
          id: "prop_interior_exit",
          name: exitName,
          pos: exitPos,
          tags: exitTags,
          hp: 200,
          maxHp: 200,
          description: "Heavy counterweighted iron portcullis leading up into the citadel guardhouse."
        },
        {
          id: "prop_dungeon_brazier",
          name: "Blazing Gaol Coal Brazier",
          pos: [128, 212],
          tags: ["fire", "hearth", "metal", "light"],
          hp: 90,
          maxHp: 90,
          description: "Massive iron tripod brazier radiating harsh heat and red embers into the stone corridor."
        },
        {
          id: "prop_dungeon_key_pegboard",
          name: "Turnkey's Heavy Brass Key Pegboard",
          pos: [136, 212],
          tags: ["metal", "brass", "valuable", "openable"],
          hp: 25,
          maxHp: 25,
          description: "Heavy ring of notched brass and iron keys capable of unlocking the cellblock doors."
        },
        {
          id: "prop_dungeon_cell1_bars",
          name: "Cell 1 Heavy Iron Bar Gate",
          pos: [123, 192],
          tags: ["metal", "iron", "locked", "door", "heavy"],
          hp: 150,
          maxHp: 150,
          description: "Reinforced black iron bars with a hefty double-tumbler latch."
        },
        {
          id: "prop_dungeon_cell2_bars",
          name: "Cell 2 Heavy Iron Bar Gate",
          pos: [123, 170],
          tags: ["metal", "iron", "locked", "door", "heavy"],
          hp: 150,
          maxHp: 150,
          description: "Reinforced iron bar grating enclosing a dark straw-strewn cell."
        },
        {
          id: "prop_dungeon_rack",
          name: "Interrogation Rack & Shackles",
          pos: [144, 168],
          tags: ["wood", "metal", "iron", "heavy"],
          hp: 95,
          maxHp: 95,
          description: "Grim oak stretching table fitted with iron hand-ratchets and rusted bloodstains."
        },
        {
          id: "prop_dungeon_armory_chest",
          name: "Confiscated Contraband Strongbox",
          pos: [120, 212],
          tags: ["metal", "locked", "container", "valuable"],
          hp: 60,
          maxHp: 60,
          description: "Ironbound chest containing weapons and valuables seized from inmates upon booking."
        }
      );

      // NPCs
      npcs.push(
        {
          id: `npc_turnkey_${parentCellId}`,
          name: "Brant the Iron Gaoler",
          role: "Senior Gaoler & Turnkey",
          pos: [126, 210],
          tags: ["human", "guard", "enforcer"],
          faction: "City Watch",
          hp: 42,
          maxHp: 42,
          disposition: -1,
          alive: true,
          equippedWeapon: "Notched Gaol Halberd & Cestus",
          equippedArmor: "Chainmail Hauberk & Leather Mantle",
          statAffinity: "might",
          memoryNotes: ["Has held custody over political dissidents and dangerous raiders for twelve years."],
          stats: { might: 16, endurance: 15, finesse: 12, reflex: 11, vitality: 15, fortitude: 14, knowledge: 9, logic: 10, awareness: 14, intuition: 11, charm: 8, willpower: 13 }
        },
        {
          id: `npc_captive_${parentCellId}`,
          name: "Valen the Unbroken",
          role: "Imprisoned Free-Sky Deserter",
          pos: [112, 192],
          tags: ["human", "outlaw", "captive"],
          faction: "The Free Sky-Barons",
          hp: 20,
          maxHp: 20,
          disposition: 1,
          alive: true,
          statAffinity: "willpower",
          memoryNotes: ["Awaiting execution at dawn; knows the secret password to the Sky-Baron supply depot."],
          stats: { might: 11, endurance: 13, finesse: 14, reflex: 13, vitality: 10, fortitude: 12, knowledge: 12, logic: 13, awareness: 15, intuition: 14, charm: 12, willpower: 16 }
        }
      );
      break;
    }

    case "UNDERWORLD_LAIR": {
      subMapName = `${parentPropName} (Subterranean Syndicate Vault)`;
      exitName = "Concealed Basalt Pivot Doorway";
      exitTags = ["door", "exit", "stone", "secret", "stairs_up", "surface"];

      // Basalt chamber
      carveCircle(CENTER, 190, 24, 4); // Main Vault Chamber
      carveRect(124, 214, 132, 228, 4); // Entrance Hallway
      carveRect(100, 175, 115, 205, 4); // West Counting Alcove
      carveRect(141, 175, 156, 205, 4); // East Forgery / Weapon Stash

      // Arcane syndicate sigil in center floor
      carveCircle(CENTER, 190, 3, 6);

      props.push(
        {
          id: "prop_interior_exit",
          name: exitName,
          pos: exitPos,
          tags: exitTags,
          hp: 150,
          maxHp: 150,
          description: "Pivoting basalt wall panel disguised as masonry, providing clandestine egress to the alley above."
        },
        {
          id: "prop_vault_loot_chest",
          name: "Obsidian-Lined Syllabic Vault Coffer",
          pos: [CENTER, 176],
          tags: ["metal", "obsidian", "locked", "container", "valuable"],
          hp: 120,
          maxHp: 120,
          description: "Massive rune-inscribed chest containing unrefined chaos shards, forged letters of marque, and royal coin."
        },
        {
          id: "prop_vault_dice_table",
          name: "Baize-Covered High-Stakes Hazard Table",
          pos: [118, 195],
          tags: ["wood", "cloth", "furniture", "valuable"],
          hp: 30,
          maxHp: 30,
          description: "Green felt gambling table littered with weighted bone dice, ivory counters, and silver talers."
        },
        {
          id: "prop_vault_forge",
          name: "Scorched Black-Glass Bellows & Anvil",
          pos: [148, 192],
          tags: ["stone", "metal", "fire", "forge", "crafting"],
          hp: 160,
          maxHp: 160,
          description: "Heat-tempered anvil and crucible used to cold-forge dragon-slag into untraceable edged weapons."
        },
        {
          id: "prop_vault_brazier",
          name: "Scented Cinnabar Hearth Brazier",
          pos: [136, 185],
          tags: ["fire", "hearth", "metal", "light"],
          hp: 50,
          maxHp: 50,
          description: "Brass brazier burning dried cinnabar and resin to mask the subterranean stench of damp earth."
        }
      );

      // Station Syndicate Operatives
      const lairObj = {
        id: parentCellId,
        cartel_name: parentPropName.split("(")[1]?.replace(")", "").trim() || "Obsidian Cartel",
        cartel_id: 6,
        lair_type: "OBSIDIAN_VAULT"
      };

      const boss = generateUniqueOutlawOperative(lairObj, 0);
      const muscle = generateUniqueOutlawOperative(lairObj, 1);

      npcs.push(
        {
          id: boss.id,
          name: boss.name,
          role: boss.role,
          pos: [126, 186],
          tags: boss.tags,
          faction: boss.faction,
          hp: boss.hp,
          maxHp: boss.maxHp,
          disposition: boss.disposition,
          alive: true,
          equippedWeapon: boss.equippedWeapon,
          equippedArmor: boss.equippedArmor,
          statAffinity: boss.statAffinity,
          memoryNotes: boss.memoryNotes,
          stats: { might: 14, endurance: 13, finesse: 16, reflex: 15, vitality: 13, fortitude: 12, knowledge: 14, logic: 15, awareness: 16, intuition: 15, charm: 14, willpower: 15 }
        },
        {
          id: muscle.id,
          name: muscle.name,
          role: muscle.role,
          pos: [132, 195],
          tags: muscle.tags,
          faction: muscle.faction,
          hp: muscle.hp,
          maxHp: muscle.maxHp,
          disposition: muscle.disposition,
          alive: true,
          equippedWeapon: muscle.equippedWeapon,
          equippedArmor: muscle.equippedArmor,
          statAffinity: muscle.statAffinity,
          memoryNotes: muscle.memoryNotes,
          stats: { might: 17, endurance: 16, finesse: 12, reflex: 13, vitality: 16, fortitude: 15, knowledge: 8, logic: 9, awareness: 13, intuition: 11, charm: 9, willpower: 14 }
        }
      );
      break;
    }

    case "ANCIENT_CRYPT": {
      subMapName = `${parentPropName.replace("Prop ", "")} (Ancient Catacombs)`;
      exitName = "Ascending Mossy Tomb Stairs";
      exitTags = ["door", "exit", "stone", "stairs_up", "surface"];

      // Long solemn crypt hallway
      carveRect(125, 145, 131, 228, 4);

      // Crypt Chambers
      carveRect(110, 160, 124, 180, 4); // West Sarcophagus Bay
      carveRect(132, 160, 146, 180, 4); // East Sarcophagus Bay
      carveCircle(CENTER, 145, 15, 4); // High Patriarch Sanctum

      // Rubble piles (Tile 7)
      grid[175 * SIZE + 126] = 7;
      grid[176 * SIZE + 126] = 7;
      grid[162 * SIZE + 130] = 7;

      props.push(
        {
          id: "prop_interior_exit",
          name: exitName,
          pos: exitPos,
          tags: exitTags,
          hp: 120,
          maxHp: 120,
          description: "Ascending flight of worn limestone stairs rising back into daylight."
        },
        {
          id: "prop_crypt_prime_sarcophagus",
          name: "High Patriarch Carved Stone Sarcophagus",
          pos: [CENTER, 142],
          tags: ["stone", "ancient", "locked", "container", "valuable"],
          hp: 200,
          maxHp: 200,
          description: "Massive fluted marble tomb lid relief-sculpted in the likeness of a crowned pre-calamity archon."
        },
        {
          id: "prop_crypt_urn_niche_west",
          name: "Dynastic Relic Urn Columbarium",
          pos: [114, 170],
          tags: ["stone", "ceramic", "ancient", "container"],
          hp: 40,
          maxHp: 40,
          description: "Wall niches holding sealed terracotta funerary urns dusted with dry frankincense."
        },
        {
          id: "prop_crypt_spectral_brazier",
          name: "Pale Spectral Soul-Flame Brazier",
          pos: [128, 155],
          tags: ["fire", "magic", "sacred", "light"],
          hp: 70,
          maxHp: 70,
          description: "Ancient copper basin emitting heatless azure flame that bathes the crypt in ethereal radiance."
        }
      );

      npcs.push({
        id: `npc_crypt_sentry_${parentCellId}`,
        name: "Awakened Tomb Sentry",
        role: "Undead Crypt Guardian",
        pos: [CENTER, 148],
        tags: ["undead", "ancient", "guardian"],
        faction: "Ancient Wardens",
        hp: 38,
        maxHp: 38,
        disposition: -1,
        alive: true,
        equippedWeapon: "Verdigris Bronze Broadsword",
        equippedArmor: "Corroded Scale Lamellar",
        statAffinity: "fortitude",
        memoryNotes: ["Eternal sentinel bound to slumber within the tomb until the seal is breached."],
        stats: { might: 15, endurance: 17, finesse: 10, reflex: 11, vitality: 14, fortitude: 16, knowledge: 8, logic: 8, awareness: 15, intuition: 12, charm: 4, willpower: 16 }
      });
      break;
    }

    case "WIZARD_LAB": {
      subMapName = `${parentPropName.replace("Prop ", "")} (Sanctum Laboratory)`;
      exitName = "Threshold Archway to Upper Tower";
      exitTags = ["door", "exit", "magic", "stairs_up", "surface"];

      // Hexagonal / Circular arcane sanctum
      carveCircle(CENTER, 190, 26, 4);
      carveRect(124, 216, 132, 228, 4); // Entryway

      // Runic circle inscribed in floor
      carveCircle(CENTER, 190, 8, 6);

      props.push(
        {
          id: "prop_interior_exit",
          name: exitName,
          pos: exitPos,
          tags: exitTags,
          hp: 100,
          maxHp: 100,
          description: "Arched portal wrapped in lingering abjuration runes, stepping out to the upper grounds."
        },
        {
          id: "prop_lab_grimoire_lectern",
          name: "Floating Eldritch Grimoire Lectern",
          pos: [CENTER, 180],
          tags: ["wood", "magic", "ancient", "valuable"],
          hp: 45,
          maxHp: 45,
          description: "Carved walnut lectern holding a leather-bound codex written in shifting illuminated ink."
        },
        {
          id: "prop_lab_alembic",
          name: "Bubbling Vitriol Alembic & Condenser",
          pos: [116, 190],
          tags: ["glass", "fire", "magic", "alchemy", "fragile"],
          hp: 25,
          maxHp: 25,
          description: "Coiled glass distillation pipes churning steaming violet precipitate over an arcane burner."
        },
        {
          id: "prop_lab_specimen_cabinet",
          name: "Formalin Specimen Cabinet & Herbs",
          pos: [140, 190],
          tags: ["wood", "glass", "container", "medicine"],
          hp: 35,
          maxHp: 35,
          description: "Tall glass-fronted walnut cupboard holding chimera organs, dragon scales, and desiccated roots."
        }
      );

      npcs.push({
        id: `npc_wizard_${parentCellId}`,
        name: "Master Corvin the Spark-Touched",
        role: "Rogue Alchemist & Transmuter",
        pos: [CENTER, 185],
        tags: ["human", "mage", "alchemist"],
        faction: "The Hedge Wizards",
        hp: 28,
        maxHp: 28,
        disposition: 0,
        alive: true,
        equippedWeapon: "Carved Hazelwood Wand & Stave",
        equippedArmor: "Quilted Silk Robes of Ward",
        statAffinity: "knowledge",
        memoryNotes: ["Studies the unstable elemental frequencies leaking from Cruorbus lunar conjunctions."],
        stats: { might: 9, endurance: 11, finesse: 13, reflex: 14, vitality: 11, fortitude: 10, knowledge: 18, logic: 17, awareness: 15, intuition: 16, charm: 12, willpower: 17 }
      });
      break;
    }

    case "CHASM_DEPTHS": {
      subMapName = `${parentPropName.replace("Prop ", "")} (Chasm Floor & Cavern)`;
      exitName = "Miners' Cable Winch & Hoist Platform";
      exitTags = ["door", "exit", "wood", "rope", "stairs_up", "surface"];

      // Organic winding cavern path
      carveCircle(CENTER, 195, 20, 4);
      carveRect(122, 160, 134, 195, 4);
      carveCircle(115, 150, 16, 4);
      carveCircle(141, 150, 16, 4);

      // Deep abyss chasms splitting the floor (Tile 12)
      carveRect(90, 130, 110, 170, 12);
      carveRect(146, 130, 166, 170, 12);

      props.push(
        {
          id: "prop_interior_exit",
          name: exitName,
          pos: exitPos,
          tags: exitTags,
          hp: 180,
          maxHp: 180,
          description: "Heavy timber crane platform rigged with thick hemp cable hauling back to the surface ledge."
        },
        {
          id: "prop_chasm_dragonstone_geode",
          name: "Pulsing Dragonstone Geode Formation",
          pos: [CENTER, 165],
          tags: ["crystal", "magic", "dragonstone", "valuable"],
          hp: 150,
          maxHp: 150,
          description: "Massive volcanic geode cluster glowing with raw crimson elemental power from the planet's mantle."
        },
        {
          id: "prop_chasm_blasting_powder",
          name: "Mine Blasting Powder Cask",
          pos: [118, 185],
          tags: ["wood", "fire", "explosive", "hazard"],
          hp: 20,
          maxHp: 20,
          description: "Pitch-sealed keg of volatile saltpeter and sulfur powder with a ready fuse cord."
        },
        {
          id: "prop_chasm_scaffolding",
          name: "Rotary Drill Rig & Miner Toolrack",
          pos: [138, 185],
          tags: ["wood", "metal", "machinery", "crafting"],
          hp: 90,
          maxHp: 90,
          description: "Hydraulic drill scaffolding and carbide pickaxes driven into the mineral-rich basalt."
        }
      );

      npcs.push({
        id: `npc_canyon_miner_${parentCellId}`,
        name: "Harlan Iron-Spur",
        role: "Veteran Chasm Dive Miner",
        pos: [126, 180],
        tags: ["dwarf", "miner", "scavenger"],
        faction: "The Grind Canyon Corps",
        hp: 36,
        maxHp: 36,
        disposition: 1,
        alive: true,
        equippedWeapon: "Reinforced Mattock & Slag Pick",
        equippedArmor: "Riveted Boarhide Vest & Steel Kettle-Helm",
        statAffinity: "endurance",
        memoryNotes: ["Has survived four chasm collapses and knows how to read seismic shudder warnings."],
        stats: { might: 16, endurance: 17, finesse: 11, reflex: 12, vitality: 15, fortitude: 16, knowledge: 10, logic: 12, awareness: 14, intuition: 13, charm: 10, willpower: 14 }
      });
      break;
    }
  }

  const compressed = zlib.deflateSync(Buffer.from(grid.buffer));

  return {
    parentCellId,
    parentRx,
    parentRy,
    parentPropId,
    name: subMapName,
    interiorType,
    grid,
    compressed,
    props,
    npcs,
    playerSpawn,
    exitProp: {
      id: "prop_interior_exit",
      name: exitName,
      pos: exitPos,
      tags: exitTags
    }
  };
}

/**
 * Procedurally generates a standalone Point of Entry (POI) sub-map encoded with simulation/story parameters.
 */
export function generatePOISubMap(config: PointOfEntryConfig): InteriorMapResult {
  const chosenType = config.subMapType || detectInteriorType(config.entryPropId, config.entryPropName, config.entryPropTags);
  const result = generateInteriorSubMap(
    config.parentCellId,
    config.parentRx,
    config.parentRy,
    config.entryPropId,
    config.entryPropName || "Wilderness Point of Entry",
    config.entryPropTags || ["door", "poi"],
    chosenType
  );

  // Apply encoded parameters:
  if (config.parameters?.elementalAffinity) {
    const elem = config.parameters.elementalAffinity;
    result.name += ` [${elem} Resonance]`;
    result.props.push({
      id: `prop_poi_elemental_seal_${config.parentCellId}`,
      name: `Elemental Seal of ${elem}`,
      pos: [CENTER, 172],
      tags: ["stone", "magic", "elemental", "dragon_seal", elem.toLowerCase()],
      hp: 250,
      maxHp: 250,
      description: `Ancient consecrated monolith pulsing with raw ${elem} energy.`
    });
  }

  if (config.parameters?.trophicFaunaType) {
    const faunaName = config.parameters.trophicFaunaType;
    result.npcs.push({
      id: `npc_poi_trophic_${config.parentCellId}`,
      name: faunaName,
      role: "Native Subterranean Predator",
      pos: [CENTER + 3, 175],
      tags: ["beast", "trophic_predator"],
      faction: "Wild Fauna",
      hp: 35,
      maxHp: 35,
      disposition: -1,
      alive: true,
      equippedWeapon: "Predatory Claws & Fangs",
      statAffinity: "might",
      memoryNotes: [`Dominant subterranean predator adapted to this sector.`],
      stats: { might: 16, endurance: 15, finesse: 13, reflex: 14, vitality: 15, fortitude: 14, knowledge: 4, logic: 5, awareness: 16, intuition: 15, charm: 4, willpower: 13 }
    });
  }

  return result;
}
