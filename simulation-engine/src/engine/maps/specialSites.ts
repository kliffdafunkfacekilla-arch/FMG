/**
 * Pure special-site 256x256 tactical sector generators (The Verge, Dragon Prisons,
 * Coral Crown, Grind Canyon Chasms). Split out from SectorMapGenerator.ts (Phase 12.4, zero DB imports).
 */
import zlib from "zlib";
import { stampEntityRefsOnNpcs } from "../entities/refs.js";
import { CENTER, hashSeed, SectorMapResult, SIZE } from "./mapTypes.js";

// 3. THE VERGE (THE SACRED SPIRE, CELL 26707)
// ─────────────────────────────────────────────────────────────────────────────

export function generateTheVergeSectorMap(cellId: number = 26707): SectorMapResult {
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

  // The Grand Spire at the Verge (10x10 celestial monolith at the dead center)
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
      name: "The Sacred Spire of the Verge (Adamantine Axis)",
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

  stampEntityRefsOnNpcs(npcs, { cellId, rx: 50, ry: 50 });

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

  stampEntityRefsOnNpcs(npcs, { cellId: config.cellId, rx: 50, ry: 50 });

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

  stampEntityRefsOnNpcs(npcs, { cellId, rx: 50, ry: 50 });

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

  stampEntityRefsOnNpcs(npcs, { cellId, rx: 50, ry: 50 });

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
