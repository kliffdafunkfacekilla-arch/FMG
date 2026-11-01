/**
 * TROPHIC WILDLIFE ECOLOGY & HERD BEHAVIOR UTILITY
 * ===================================================
 * Implements living trophic wildlife simulations across Ostraka's 13 biomes:
 * - Herbivore herd cohesion, water seeking, and grazing routines.
 * - Apex predator stalking, scent detection, and ambush lunges.
 * - Coordinated herd panic flight upon detecting predators or unstealthed players.
 * - Opposed natural predation contests producing harvestable carcass props.
 */

import type { InjectedNPC, InjectedProp } from "../types";

export interface TrophicSpeciesDef {
  name: string;
  leaderTitle: string;
  youngTitle: string;
  statAffinity: string;
  baseHp: number;
  armor: string;
  harvestLoot: string[];
}

export interface TrophicPredatorDef {
  name: string;
  statAffinity: string;
  baseHp: number;
  weapon: string;
  armor: string;
  harvestLoot: string[];
}

export interface BiomeTrophicProfile {
  biomeName: string;
  prey: TrophicSpeciesDef;
  predator: TrophicPredatorDef;
}

export const BIOME_TROPHIC_PROFILES: Record<number, BiomeTrophicProfile> = {
  1: { // Desert
    biomeName: "Sun-Scorched Dune Desert",
    prey: {
      name: "Sand Gazelle",
      leaderTitle: "Horned Alpha Gazelle",
      youngTitle: "Young Gazelle Fawn",
      statAffinity: "reflex",
      baseHp: 14,
      armor: "Sun-Bleached Hide",
      harvestLoot: ["Gazelle Horn", "Supple Desert Hide", "Lean Game Meat"]
    },
    predator: {
      name: "Dune Scythe-Beetle",
      statAffinity: "might",
      baseHp: 28,
      weapon: "Chitinous Scythe-Claws",
      armor: "Armored Sand Carapace",
      harvestLoot: ["Scythe Chitin Blade", "Beetle Carapace Plate", "Insect Nectar"]
    }
  },
  2: { // Badlands
    biomeName: "Arid Badlands",
    prey: {
      name: "Scree Marmot",
      leaderTitle: "Elder Scree Marmot",
      youngTitle: "Marmot Pup",
      statAffinity: "finesse",
      baseHp: 12,
      armor: "Gravel-Caked Pelt",
      harvestLoot: ["Marmot Pelt", "Small Game Fat", "Tender Roast"]
    },
    predator: {
      name: "Frost-Fang Jackal",
      statAffinity: "finesse",
      baseHp: 24,
      weapon: "Serrated Bone Jaws",
      armor: "Wire-Hair Hide",
      harvestLoot: ["Jackal Pelt", "Jackal Canine Fang", "Sinew Cord"]
    }
  },
  3: { // Savanna
    biomeName: "Golden Savanna",
    prey: {
      name: "Savanna Zebra",
      leaderTitle: "Stallion Herd Leader",
      youngTitle: "Striped Zebra Foal",
      statAffinity: "endurance",
      baseHp: 18,
      armor: "Striped Tough Hide",
      harvestLoot: ["Striped Zebra Hide", "Prime Equine Flank", "Bone Shank"]
    },
    predator: {
      name: "Prideland Lion",
      statAffinity: "might",
      baseHp: 34,
      weapon: "Crushing Maw",
      armor: "Muscular Golden Coat",
      harvestLoot: ["Lion Mane Rug", "Apex Lion Claws", "Predator Heart"]
    }
  },
  4: { // Steppe / Grassland
    biomeName: "Windswept Prairie Steppe",
    prey: {
      name: "Great Prairie Elk",
      leaderTitle: "Thundering Elk Sovereign",
      youngTitle: "Prairie Elk Calf",
      statAffinity: "vitality",
      baseHp: 20,
      armor: "Dense Felted Hide",
      harvestLoot: ["Prairie Elk Antler", "Heavy Winter Pelt", "Prime Game Meat"]
    },
    predator: {
      name: "Steppe Wolf",
      statAffinity: "finesse",
      baseHp: 26,
      weapon: "Tearing Fangs",
      armor: "Thick Grey Pelt",
      harvestLoot: ["Steppe Wolf Pelt", "Wolf Fang Necklace", "Tough Sinew"]
    }
  },
  5: { // Tropical Rainforest
    biomeName: "Primeval Rain Canopy",
    prey: {
      name: "Tree Glider Lemur",
      leaderTitle: "Canopy Chieftain Lemur",
      youngTitle: "Glider Lemur Kit",
      statAffinity: "reflex",
      baseHp: 10,
      armor: "Silky Fluff",
      harvestLoot: ["Silken Pelt", "Lemur Claws", "Sweet Foraged Fruit"]
    },
    predator: {
      name: "Emerald Viper",
      statAffinity: "reflex",
      baseHp: 22,
      weapon: "Venom-Dripping Fangs",
      armor: "Iridescent Scaled Skin",
      harvestLoot: ["Viper Venom Sac", "Emerald Scales", "Reagent Gland"]
    }
  },
  6: { // Temperate Forest (Default)
    biomeName: "Verdant Sylvan Woodlands",
    prey: {
      name: "Great Antler Stag",
      leaderTitle: "Monarch Antler Stag",
      youngTitle: "Spotted Forest Fawn",
      statAffinity: "reflex",
      baseHp: 18,
      armor: "Supple Buckskin Hide",
      harvestLoot: ["Carved Stag Antlers", "Buckskin Leather", "Tender Venison Flank"]
    },
    predator: {
      name: "Grizzled Briar Bear",
      statAffinity: "might",
      baseHp: 38,
      weapon: "Heavy Raking Claws",
      armor: "Dense Layered Fat & Fur",
      harvestLoot: ["Briar Bear Pelt", "Crushing Bear Paw", "Rich Animal Fat"]
    }
  },
  7: { // Taiga / Boreal Forest
    biomeName: "Boreal Pine Taiga",
    prey: {
      name: "Northern Caribou",
      leaderTitle: "White-Horn Caribou Alpha",
      youngTitle: "Taiga Caribou Calf",
      statAffinity: "endurance",
      baseHp: 20,
      armor: "Heavy Frost Wool",
      harvestLoot: ["Caribou Velvet Antler", "Thick Frost Fur", "Salted Caribou Meat"]
    },
    predator: {
      name: "Ice-Mane Worg",
      statAffinity: "finesse",
      baseHp: 30,
      weapon: "Glacial Fang Strike",
      armor: "Shaggy Frost Fur",
      harvestLoot: ["Ice-Mane Pelt", "Worg Dire Fang", "Hardened Sinew"]
    }
  },
  8: { // Tundra
    biomeName: "Permafrost Tundra",
    prey: {
      name: "Tundra Reindeer",
      leaderTitle: "Permafrost Herd Matriarch",
      youngTitle: "Tundra Calf",
      statAffinity: "vitality",
      baseHp: 18,
      armor: "Insulated Wool Coat",
      harvestLoot: ["Tundra Reindeer Hide", "Reindeer Antler", "Arctic Marrow Bone"]
    },
    predator: {
      name: "Glacial Bear",
      statAffinity: "might",
      baseHp: 42,
      weapon: "Massive Cleaving Paws",
      armor: "Iron-Dense Arctic Fur",
      harvestLoot: ["Glacial Bear Fur", "Massive Claws", "Rendered Arctic Fat"]
    }
  },
  9: { // Glacial / High Alpine
    biomeName: "Glacial Crags & Spire",
    prey: {
      name: "Crag Ibex",
      leaderTitle: "Elder Mountain Ibex",
      youngTitle: "Ibex Kid",
      statAffinity: "reflex",
      baseHp: 16,
      armor: "Coarse Alpine Fleece",
      harvestLoot: ["Curved Ibex Horn", "Mountain Fleece", "Lean Mountain Meat"]
    },
    predator: {
      name: "Frost Wyrmling",
      statAffinity: "willpower",
      baseHp: 36,
      weapon: "Biting Frost-Breath",
      armor: "Crystalline Ice Scales",
      harvestLoot: ["Frost Scales", "Wyrmling Heart", "Cryo-Gland"]
    }
  },
  10: { // Wetland / Mire Swamp
    biomeName: "Wetland Reed Swamp",
    prey: {
      name: "Crested Marsh Elk",
      leaderTitle: "Crested Marsh Patriarch",
      youngTitle: "Marsh Elk Calf",
      statAffinity: "vitality",
      baseHp: 20,
      armor: "Waterproof Mud Pelt",
      harvestLoot: ["Crested Elk Antler", "Waterproof Mire Pelt", "Fresh Game Flank"]
    },
    predator: {
      name: "Bog Stalker",
      statAffinity: "finesse",
      baseHp: 28,
      weapon: "Venomous Mud Mandibles",
      armor: "Mud-Caked Hardened Carapace",
      harvestLoot: ["Bog Stalker Mandibles", "Bog Carapace Shell", "Paralytic Toxin"]
    }
  },
  11: { // Scrubland / Highlands
    biomeName: "Arid Thorn Scrub",
    prey: {
      name: "Brush Hare",
      leaderTitle: "Fleet-Footed Alpha Hare",
      youngTitle: "Hare Leveret",
      statAffinity: "reflex",
      baseHp: 10,
      armor: "Dusty Camouflage Fur",
      harvestLoot: ["Soft Brush Fur", "Lucky Hare Foot", "Game Tenderloin"]
    },
    predator: {
      name: "Scrub Coyote",
      statAffinity: "reflex",
      baseHp: 22,
      weapon: "Snapping Jaws",
      armor: "Scrub-Tangled Fur",
      harvestLoot: ["Coyote Pelt", "Coyote Teeth", "Tallow"]
    }
  },
  12: { // Mangrove / Coastal Bog
    biomeName: "Saltwater Mangrove Fens",
    prey: {
      name: "Mud Tortoise",
      leaderTitle: "Grand Shell Matriarch",
      youngTitle: "Hatchling Tortoise",
      statAffinity: "fortitude",
      baseHp: 24,
      armor: "Heavy Calcified Shell",
      harvestLoot: ["Calcified Tortoise Shell", "Tough Turtle Meat", "Oil Bladder"]
    },
    predator: {
      name: "Mire Crocodile",
      statAffinity: "might",
      baseHp: 38,
      weapon: "Crushing Death-Roll Jaws",
      armor: "Reptilian Horned Scutes",
      harvestLoot: ["Crocodile Scaled Armor", "Crocodile Teeth", "Musk Gland"]
    }
  }
};

/**
 * Procedurally generates a cohesive wildlife herd (3-4 animals) centered at basePos.
 */
export function generateWildlifeHerd(
  biomeId: number,
  basePos: [number, number],
  herdSize: number = 3
): InjectedNPC[] {
  const profile = BIOME_TROPHIC_PROFILES[biomeId] || BIOME_TROPHIC_PROFILES[6]!;
  const herdId = `herd_${biomeId}_${basePos[0]}_${basePos[1]}`;
  const npcs: InjectedNPC[] = [];

  for (let i = 0; i < herdSize; i++) {
    const isLeader = (i === 0);
    const isYoung = (i === herdSize - 1 && herdSize > 2);
    const name = isLeader
      ? profile.prey.leaderTitle
      : isYoung
      ? profile.prey.youngTitle
      : `${profile.prey.name} Herd-Mate`;

    const hp = isLeader
      ? profile.prey.baseHp + 6
      : isYoung
      ? Math.max(8, Math.round(profile.prey.baseHp * 0.6))
      : profile.prey.baseHp;

    // Scatter within 2-4 tiles around base pos
    const offsetX = (i === 0 ? 0 : i === 1 ? -2 : i === 2 ? 3 : -1) + Math.round((Math.random() - 0.5) * 2);
    const offsetY = (i === 0 ? 0 : i === 1 ? 2 : i === 2 ? -2 : 3) + Math.round((Math.random() - 0.5) * 2);
    const pos: [number, number] = [
      Math.max(10, Math.min(245, basePos[0] + offsetX)),
      Math.max(10, Math.min(245, basePos[1] + offsetY))
    ];

    npcs.push({
      id: `${herdId}_member_${i}`,
      name,
      role: "Wild Fauna",
      pos,
      tags: ["beast", "prey", "neutral", "organic", "edible_meat", "skittish"],
      faction: "Wild Fauna",
      hp,
      maxHp: hp,
      disposition: 0,
      alive: true,
      equippedWeapon: "Hoof & Antler Thrust",
      equippedArmor: profile.prey.armor,
      statAffinity: profile.prey.statAffinity,
      kingdom: "Animalia",
      species: profile.prey.name,
      herdId,
      aiState: "GRAZING",
      inventory: [...profile.prey.harvestLoot],
      stats: {
        might: isLeader ? 7 : 5,
        finesse: 6,
        reflex: 8,
        endurance: isLeader ? 8 : 6,
        vitality: isLeader ? 8 : 6,
        fortitude: 5,
        knowledge: 2,
        logic: 2,
        awareness: 8,
        intuition: 7,
        charm: 3,
        willpower: 5
      }
    });
  }

  return npcs;
}

/**
 * Procedurally generates a stalking apex predator.
 */
export function generateApexPredator(
  biomeId: number,
  pos: [number, number]
): InjectedNPC {
  const profile = BIOME_TROPHIC_PROFILES[biomeId] || BIOME_TROPHIC_PROFILES[6]!;
  const id = `predator_${biomeId}_${pos[0]}_${pos[1]}`;

  return {
    id,
    name: profile.predator.name,
    role: "Apex Predator",
    pos,
    tags: ["beast", "predator", "hostile", "organic", "sharp", "leather_hide"],
    faction: "Apex Predator",
    hp: profile.predator.baseHp,
    maxHp: profile.predator.baseHp,
    disposition: -2,
    alive: true,
    equippedWeapon: profile.predator.weapon,
    equippedArmor: profile.predator.armor,
    statAffinity: profile.predator.statAffinity,
    kingdom: "Animalia",
    species: profile.predator.name,
    aiState: "STALKING",
    inventory: [...profile.predator.harvestLoot],
    stats: {
      might: 8,
      finesse: 7,
      reflex: 7,
      endurance: 8,
      vitality: 8,
      fortitude: 6,
      knowledge: 3,
      logic: 3,
      awareness: 9,
      intuition: 8,
      charm: 2,
      willpower: 7
    }
  };
}

export interface TrophicTickResult {
  updatedNPCs: InjectedNPC[];
  spawnedProps: InjectedProp[];
  combatFloaters: Array<{ text: string; x: number; y: number; color: string }>;
  logs: string[];
}

/**
 * Simulates one dynamic ecological tick for all wildlife in the sector.
 * Run on player move or turn pass outside combat, and once per round in combat.
 */
export function processTrophicWildlifeTick(
  npcs: InjectedNPC[],
  playerPos: { lx: number; ly: number },
  isPlayerStealthed: boolean,
  tilemap: { grid: Uint8Array; size: number } | null,
  _existingProps: InjectedProp[]
): TrophicTickResult {
  const updatedNPCs: InjectedNPC[] = npcs.map(n => ({ ...n, pos: [...n.pos] as [number, number] }));
  const spawnedProps: InjectedProp[] = [];
  const combatFloaters: Array<{ text: string; x: number; y: number; color: string }> = [];
  const logs: string[] = [];

  const isWalkable = (x: number, y: number): boolean => {
    if (!tilemap) return true;
    if (x < 2 || x >= tilemap.size - 2 || y < 2 || y >= tilemap.size - 2) return false;
    const tile = tilemap.grid[y * tilemap.size + x];
    // 2 = Water, 3 = Mountain Cliff, 5 = Wall, 12 = Abyss Trench
    if (tile === 2 || tile === 3 || tile === 5 || tile === 12) return false;
    return true;
  };

  const isWater = (x: number, y: number): boolean => {
    if (!tilemap) return false;
    if (x < 0 || x >= tilemap.size || y < 0 || y >= tilemap.size) return false;
    return tilemap.grid[y * tilemap.size + x] === 2;
  };

  const livingPredators = updatedNPCs.filter(n => n.alive && n.tags.includes("predator"));
  const livingPrey = updatedNPCs.filter(n => n.alive && n.tags.includes("prey"));

  // -----------------------------------------------------------------
  // 1. HERD COHESION & PANIC FLIGHT / GRAZING
  // -----------------------------------------------------------------
  const herds = new Map<string, InjectedNPC[]>();
  livingPrey.forEach(prey => {
    const hId = prey.herdId || "default_herd";
    if (!herds.has(hId)) herds.set(hId, []);
    herds.get(hId)!.push(prey);
  });

  herds.forEach((herdMembers, _hId) => {
    // Calculate Herd Centroid
    const sumX = herdMembers.reduce((acc, m) => acc + m.pos[0], 0);
    const sumY = herdMembers.reduce((acc, m) => acc + m.pos[1], 0);
    const centroidX = Math.round(sumX / herdMembers.length);
    const centroidY = Math.round(sumY / herdMembers.length);

    // Check if Herd is Threatened
    let threatX: number | null = null;
    let threatY: number | null = null;
    let threatSource = "";

    // Threat Check A: Nearby Predators
    for (const pred of livingPredators) {
      const distToCentroid = Math.hypot(pred.pos[0] - centroidX, pred.pos[1] - centroidY);
      if (distToCentroid <= 7) {
        threatX = pred.pos[0];
        threatY = pred.pos[1];
        threatSource = pred.name;
        break;
      }
    }

    // Threat Check B: Unstealthed Player Approaching (< 5 tiles)
    if (!threatX && !isPlayerStealthed) {
      const distToPlayer = Math.hypot(playerPos.lx - centroidX, playerPos.ly - centroidY);
      if (distToPlayer <= 5) {
        threatX = playerPos.lx;
        threatY = playerPos.ly;
        threatSource = "Approaching Wayfarer";
      }
    }

    // Process Each Member in the Herd
    herdMembers.forEach(member => {
      if (threatX !== null && threatY !== null) {
        // PANIC FLIGHT: Flee away from threat
        member.aiState = "FLEEING";
        const fdx = member.pos[0] - threatX;
        const fdy = member.pos[1] - threatY;
        const dist = Math.hypot(fdx, fdy) || 1;
        const stepX = Math.round((fdx / dist) * 2);
        const stepY = Math.round((fdy / dist) * 2);

        const targetX = member.pos[0] + stepX;
        const targetY = member.pos[1] + stepY;

        if (isWalkable(targetX, targetY)) {
          member.pos[0] = targetX;
          member.pos[1] = targetY;
        }

        if (Math.random() < 0.3) {
          combatFloaters.push({
            text: "💨 FLEEING!",
            x: member.pos[0],
            y: member.pos[1],
            color: "#facc15"
          });
        }
      } else {
        // PEACEFUL GRAZING & WATER SEEKING
        // Check if adjacent to water
        let nearWater = false;
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            if (isWater(member.pos[0] + dx, member.pos[1] + dy)) {
              nearWater = true;
              break;
            }
          }
          if (nearWater) break;
        }

        if (nearWater && Math.random() < 0.5) {
          member.aiState = "DRINKING";
          if (Math.random() < 0.25) {
            combatFloaters.push({
              text: "💧 DRINKING",
              x: member.pos[0],
              y: member.pos[1],
              color: "#38bdf8"
            });
          }
        } else {
          member.aiState = "GRAZING";
          // Gentle drift toward herd centroid (max 1 tile step)
          if (Math.random() < 0.35) {
            const cdx = centroidX - member.pos[0];
            const cdy = centroidY - member.pos[1];
            const dist = Math.hypot(cdx, cdy);

            let wanderDx = 0;
            let wanderDy = 0;

            if (dist > 4) {
              // Rejoin herd
              wanderDx = Math.sign(cdx);
              wanderDy = Math.sign(cdy);
            } else {
              // Meander locally
              wanderDx = Math.round((Math.random() - 0.5) * 2);
              wanderDy = Math.round((Math.random() - 0.5) * 2);
            }

            const nextX = member.pos[0] + wanderDx;
            const nextY = member.pos[1] + wanderDy;
            if (isWalkable(nextX, nextY)) {
              member.pos[0] = nextX;
              member.pos[1] = nextY;
            }

            if (Math.random() < 0.15) {
              combatFloaters.push({
                text: "🌿 GRAZING",
                x: member.pos[0],
                y: member.pos[1],
                color: "#4ade80"
              });
            }
          }
        }
      }
    });

    if (threatX !== null && Math.random() < 0.2) {
      logs.push(`🦌 [Wildlife Alert] The ${herdMembers[0]?.species || "wild herd"} startled by the ${threatSource} bolts in panic!`);
    }
  });

  // -----------------------------------------------------------------
  // 2. APEX PREDATOR STALKING & HUNT RESOLUTION
  // -----------------------------------------------------------------
  livingPredators.forEach(pred => {
    // Find Nearest Prey
    let closestPrey: InjectedNPC | null = null;
    let closestDist = 14; // Scent/Vision range = 14 tiles

    for (const prey of livingPrey) {
      if (!prey.alive) continue;
      const d = Math.hypot(prey.pos[0] - pred.pos[0], prey.pos[1] - pred.pos[1]);
      if (d < closestDist) {
        closestDist = d;
        closestPrey = prey;
      }
    }

    if (closestPrey) {
      pred.preyTargetId = closestPrey.id;

      if (closestDist > 3) {
        // STALKING: Advance 1 step quietly towards prey
        pred.aiState = "STALKING";
        const pdx = closestPrey.pos[0] - pred.pos[0];
        const pdy = closestPrey.pos[1] - pred.pos[1];
        const stepX = Math.sign(pdx);
        const stepY = Math.sign(pdy);

        const nextX = pred.pos[0] + stepX;
        const nextY = pred.pos[1] + stepY;
        if (isWalkable(nextX, nextY)) {
          pred.pos[0] = nextX;
          pred.pos[1] = nextY;
        }

        if (Math.random() < 0.2) {
          combatFloaters.push({
            text: "🐾 STALKING",
            x: pred.pos[0],
            y: pred.pos[1],
            color: "#f87171"
          });
        }
      } else if (closestDist > 1) {
        // HUNTING CHARGE: Lunge toward prey
        pred.aiState = "HUNTING";
        const pdx = closestPrey.pos[0] - pred.pos[0];
        const pdy = closestPrey.pos[1] - pred.pos[1];
        const stepX = Math.sign(pdx);
        const stepY = Math.sign(pdy);

        const nextX = pred.pos[0] + stepX;
        const nextY = pred.pos[1] + stepY;
        if (isWalkable(nextX, nextY)) {
          pred.pos[0] = nextX;
          pred.pos[1] = nextY;
        }

        combatFloaters.push({
          text: "⚡ LUNGING!",
          x: pred.pos[0],
          y: pred.pos[1],
          color: "#dc2626"
        });
      } else {
        // ADJACENT OPPOSE CONTEST: Predation Strike!
        const predRoll = Math.floor(Math.random() * 20) + 1 + (pred.stats?.might || 7);
        const preyRoll = Math.floor(Math.random() * 20) + 1 + (closestPrey.stats?.reflex || 6);

        if (predRoll >= preyRoll) {
          // Predator strikes quarry
          const damage = 10 + Math.max(2, predRoll - preyRoll);
          closestPrey.hp -= damage;

          combatFloaters.push({
            text: `💥 -${damage} HP`,
            x: closestPrey.pos[0],
            y: closestPrey.pos[1],
            color: "#ef4444"
          });

          if (closestPrey.hp <= 0) {
            closestPrey.alive = false;
            closestPrey.hp = 0;

            // Synthesize fresh harvestable Carcass Prop
            const carcassId = `prop_carcass_${closestPrey.id}`;
            const carcassProp: InjectedProp = {
              id: carcassId,
              name: `Fresh Remains of ${closestPrey.name}`,
              pos: [...closestPrey.pos],
              tags: ["corpse", "carcass", "meat", "hide", "organic", "lootable", "fresh"],
              hp: 15,
              maxHp: 15,
              isDestroyed: false,
              inventory: closestPrey.inventory && closestPrey.inventory.length > 0
                ? [...closestPrey.inventory]
                : ["Fresh Game Flank", "Animal Pelt", "Marrow Bone"]
            };
            spawnedProps.push(carcassProp);

            combatFloaters.push({
              text: "🩸 CARCASS!",
              x: closestPrey.pos[0],
              y: closestPrey.pos[1],
              color: "#991b1b"
            });

            logs.push(`🥩 [Trophic Predation] The ${pred.name} brings down the ${closestPrey.name}! A fresh carcass lies upon the soil.`);
          } else {
            logs.push(`⚔️ [Trophic Skirmish] The ${pred.name} slashes ${closestPrey.name} for ${damage} damage, but the quarry scrambles!`);
          }
        } else {
          // Quarry dodges / slips away
          combatFloaters.push({
            text: "💨 EVADED!",
            x: closestPrey.pos[0],
            y: closestPrey.pos[1],
            color: "#60a5fa"
          });
          logs.push(`🦌 [Trophic Escape] The ${closestPrey.name} narrowly evades the ${pred.name}'s lunge!`);
        }
      }
    }
  });

  return {
    updatedNPCs,
    spawnedProps,
    combatFloaters,
    logs
  };
}
