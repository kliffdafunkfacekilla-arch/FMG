/**
 * PROCEDURAL NPC & LIVING ACTOR SYNTHESIZER
 * =========================================
 * Replaces hardcoded NPC generation with dynamic procedural synthesis dictated by:
 * 1. World state & demographics (burg culture, species distribution, unrest, wealth, garrison)
 * 2. Biome ecology & trophic levels (native predators, wild game, apex fauna)
 * 3. RegionalInstance simulated roaming agents (merchants, patrols, outlaws, cannibals)
 * 4. Deterministic spatiotemporal seed movement (roaming entities cross paths across ticks without melting CPU)
 */

import {
  StatKey,
  getRandomWeaponForStat,
  getRandomArmorForStat
} from "./EquipmentRegistry.js";
import { InjectedNPC, SectorContext, BIOME_ECOLOGY_MATRIX, DRAGON_PRISONS } from "./WhatElseStoryEngine.js";

export class SeededPRNG {
  private s: number;
  constructor(seed: number) {
    this.s = Math.abs(seed) || 1234567;
  }
  public next(): number {
    this.s = (this.s * 1664525 + 1013904223) % 4294967296;
    return this.s / 4294967296;
  }
  public range(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
  public pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)]!;
  }
}

export const KINGDOM_FIRST_NAMES: Record<string, string[]> = {
  Mammal: ["Morvath", "Garrick", "Valeria", "Torvold", "Lysandra", "Kaelen", "Bran", "Brynna", "Morwen", "Orin", "Aldous", "Vaelen", "Thorne"],
  Reptile: ["Karkash", "Ssilas", "Varn", "Zulkor", "Ssaryx", "Korith", "Vasha", "Skesh", "Xoltan", "Drax", "Sszeth", "Chazak"],
  Avian: ["Aves", "Aquila", "Corvus", "Vael", "Zephyr", "Talon", "Phaeron", "Skystride", "Peregrine", "Kestrel", "Lyra", "Falco"],
  Aquatic: ["Nereus", "Maris", "Thalor", "Kedge", "Drakon", "Pelagius", "Undine", "Vellor", "Tiber", "Coral", "Jax", "Marina"],
  Insect: ["Chitin", "Vespis", "Khepri", "Myrmex", "Mantor", "Scythe", "Zorath", "Skitter", "Anopheles", "Vespa", "Mantis", "Coleus"],
  Plant: ["Sylvan", "Bramble", "Verdant", "Oakhaven", "Yggdra", "Cortex", "Spore", "Liana", "Rowan", "Floran", "Moss", "Thistle"]
};

export const KINGDOM_SPECIES_TYPES: Record<string, Array<{ lineage: string; species: string; affinity: StatKey }>> = {
  Mammal: [
    { lineage: "Ursine", species: "Bear-Folk", affinity: "might" },
    { lineage: "Canid", species: "Wolf-Kin", affinity: "vitality" },
    { lineage: "Feline", species: "Cat-Kin", affinity: "reflex" },
    { lineage: "Small-Paw", species: "Hare-Kin", affinity: "endurance" },
    { lineage: "Cervid", species: "Stag-Folk", affinity: "awareness" }
  ],
  Reptile: [
    { lineage: "Viper", species: "Serpent-Folk", affinity: "finesse" },
    { lineage: "Saurian", species: "Lizard-Kin", affinity: "endurance" },
    { lineage: "Crocodilian", species: "Gator-Folk", affinity: "might" },
    { lineage: "Chelonian", species: "Tortoise-Kin", affinity: "fortitude" }
  ],
  Avian: [
    { lineage: "Raptor", species: "Falcon-Folk", affinity: "reflex" },
    { lineage: "Corvid", species: "Crow-Kin", affinity: "logic" },
    { lineage: "Strigid", species: "Owl-Kin", affinity: "knowledge" },
    { lineage: "Passerine", species: "Songbird-Kin", affinity: "charm" }
  ],
  Aquatic: [
    { lineage: "Mariner", species: "Catfish-Mariner", affinity: "endurance" },
    { lineage: "Current", species: "Salmon-Kin", affinity: "finesse" },
    { lineage: "Abyssal", species: "Crab-Kin", affinity: "fortitude" },
    { lineage: "Cephalopod", species: "Octopus-Kin", affinity: "intuition" }
  ],
  Insect: [
    { lineage: "Formicid", species: "Ant-Kin", affinity: "logic" },
    { lineage: "Mantid", species: "Mantis-Folk", affinity: "finesse" },
    { lineage: "Coleopteran", species: "Beetle-Kin", affinity: "might" },
    { lineage: "Vespid", species: "Wasp-Kin", affinity: "reflex" }
  ],
  Plant: [
    { lineage: "Briar", species: "Bramble-Folk", affinity: "fortitude" },
    { lineage: "Arboreal", species: "Tree-Kin", affinity: "willpower" },
    { lineage: "Spore", species: "Fungal-Kin", affinity: "intuition" },
    { lineage: "Flora", species: "Blossom-Kin", affinity: "charm" }
  ]
};

export const CULTURAL_EPITHETS = [
  "Iron-Biter", "the Red", "the Swift", "Stone-Foot", "the Silent",
  "the Grim", "the Defiant", "Blood-Seeker", "of the Ash", "Void-Walker",
  "the Unyielding", "Shadow-Stalker", "Deep-Warden", "Frost-Scarred",
  "the Patient", "Whisper-Wind", "Bramble-Shield", "Silver-Tongue",
  "the Shrewd", "Garrison-Watcher", "Hearth-Keeper", "Trail-Blazer"
];

export class ProceduralNPCGenerator {
  public static getKingdomSpecies(kingdom: string): Array<{ lineage: string; species: string; affinity: StatKey }> {
    return KINGDOM_SPECIES_TYPES[kingdom] || KINGDOM_SPECIES_TYPES.Mammal || [];
  }

  public static getKingdomFirstNames(kingdom: string): string[] {
    return KINGDOM_FIRST_NAMES[kingdom] || KINGDOM_FIRST_NAMES.Mammal || ["Traveler"];
  }

  /**
   * Universal procedural generator synthesizing authentic NPCs from live world context.
   */
  public static generateNPCsForSector(
    context: SectorContext,
    persistedMap: Map<string, InjectedNPC> = new Map(),
    worldTick: number = 0
  ): InjectedNPC[] {
    const npcs: InjectedNPC[] = [];
    const rx = context.rx ?? 105;
    const ry = context.ry ?? 112;
    const cellId = context.cellId ?? 13408;

    const baseSeed = (cellId * 73856093) ^ (rx * 19349663) ^ (ry * 83492791);
    const rng = new SeededPRNG(baseSeed);

    const isUrban = !!(context.burg || context.baseTerrain === 4 || (context.infrastructureMask & 64));

    if (isUrban) {
      // -------------------------------------------------------------
      // 1. PROCEDURAL SETTLEMENT / BURG NPCS
      // -------------------------------------------------------------
      const burgName = context.burg?.name || "Provincial Settlement";
      const faction = context.factionOwner || "The Realm";
      const unrest = Number(context.burg?.unrest) || 0;
      const crimeRate = Number(context.crimeRate || context.burg?.crime_rate) || 0;
      const centerPoint: [number, number] = [rng.range(122, 134), rng.range(122, 134)];

      // A. Extract species demographic weights
      const demographics = this.resolveBurgDemographics(context, rng);

      // Define standard municipal roles based on burg institutions
      const municipalRoles = [
        {
          slotKey: "provisioner",
          roleTitle: "Market Provisioner",
          primaryStat: "charm" as StatKey,
          offset: [centerPoint[0] + 5, centerPoint[1] - 2] as [number, number],
          tags: ["civilian", "merchant", "vendor", "talkative", "tradeable", "organic"],
          weaponStat: "finesse" as StatKey,
          armorStat: "charm" as StatKey,
          disposition: 1
        },
        {
          slotKey: "innkeeper",
          roleTitle: "Tavern Keeper",
          primaryStat: "vitality" as StatKey,
          offset: [centerPoint[0] - 4, centerPoint[1] + 5] as [number, number],
          tags: ["civilian", "innkeeper", "talkative", "rumors", "organic"],
          weaponStat: "might" as StatKey,
          armorStat: "vitality" as StatKey,
          disposition: 1
        },
        {
          slotKey: "smith",
          roleTitle: "Weaponsmith",
          primaryStat: "might" as StatKey,
          offset: [centerPoint[0] - 5, centerPoint[1] - 3] as [number, number],
          tags: ["artisan", "blacksmith", "crafting", "metal", "organic"],
          weaponStat: "might" as StatKey,
          armorStat: "fortitude" as StatKey,
          disposition: 0
        },
        {
          slotKey: "reeve",
          roleTitle: "Municipal Reeve",
          primaryStat: "logic" as StatKey,
          offset: [centerPoint[0] + 2, centerPoint[1] - 4] as [number, number],
          tags: ["authority", "official", "bounties", "disciplined", "organic"],
          weaponStat: "logic" as StatKey,
          armorStat: "willpower" as StatKey,
          disposition: 0
        },
        {
          slotKey: "sentry",
          roleTitle: "Town Watchman",
          primaryStat: "might" as StatKey,
          offset: [centerPoint[0] + 15, centerPoint[1] + 1] as [number, number],
          tags: ["authority", "sentry", "patrol", "disciplined", "organic"],
          weaponStat: "might" as StatKey,
          armorStat: "endurance" as StatKey,
          disposition: 0
        },
        {
          slotKey: "courier",
          roleTitle: "Traveling Messenger",
          primaryStat: "reflex" as StatKey,
          offset: [centerPoint[0] + 7, centerPoint[1] - 6] as [number, number],
          tags: ["civilian", "wayfarer", "talkative", "rumors", "organic"],
          weaponStat: "reflex" as StatKey,
          armorStat: "endurance" as StatKey,
          disposition: 1
        }
      ];

      // Add emergency role if unrest is elevated
      if (unrest > 35) {
        municipalRoles.push({
          slotKey: "agitator",
          roleTitle: "Bread Rioter",
          primaryStat: "might" as StatKey,
          offset: [centerPoint[0] - 8, centerPoint[1] + 6] as [number, number],
          tags: ["civilian", "striker", "desperate", "talkative", "organic"],
          weaponStat: "might" as StatKey,
          armorStat: "vitality" as StatKey,
          disposition: -1
        });
      }

      // Add crime fence if high crime rate or smuggler mask
      if (crimeRate > 25 || (context.infrastructureMask & 4)) {
        municipalRoles.push({
          slotKey: "fence",
          roleTitle: "Black Market Fence",
          primaryStat: "finesse" as StatKey,
          offset: [centerPoint[0] + 9, centerPoint[1] + 7] as [number, number],
          tags: ["outlaw", "fence", "subterfuge", "bribeable", "tradeable", "organic"],
          weaponStat: "finesse" as StatKey,
          armorStat: "charm" as StatKey,
          disposition: 0
        });
      }

      // Procedurally generate each role
      municipalRoles.forEach((roleDef, idx) => {
        const npcId = `npc_${cellId}_${rx}_${ry}_${roleDef.slotKey}`;

        // Check if already persisted
        if (persistedMap.has(npcId)) {
          npcs.push(persistedMap.get(npcId)!);
          return;
        }

        // Generate species from demographics
        const defaultDemo = {
          kingdom: "Mammal",
          lineageInfo: { lineage: "Ursine", species: "Bear-Folk", affinity: "might" as StatKey }
        };
        const demo = (demographics && demographics.length > 0)
          ? (demographics[idx % demographics.length] || demographics[0] || defaultDemo)
          : defaultDemo;
        const kingdom = demo.kingdom;
        const lineageInfo = demo.lineageInfo;

        const firstName = rng.pick(this.getKingdomFirstNames(kingdom));
        const epithet = rng.pick(CULTURAL_EPITHETS);
        const fullName = `${firstName} ${epithet}`;

        const weapon = getRandomWeaponForStat(roleDef.weaponStat);
        const armor = getRandomArmorForStat(roleDef.armorStat);

        const stats = this.generateStatsForProfile(roleDef.primaryStat, lineageInfo.affinity, rng);
        const maxHp = 10 + (stats.vitality || 5) + (stats.endurance || 5) + Math.round((stats.willpower || 5) / 2);

        npcs.push({
          id: npcId,
          name: fullName,
          role: roleDef.roleTitle,
          pos: roleDef.offset,
          tags: [...roleDef.tags],
          faction,
          hp: maxHp,
          maxHp,
          disposition: roleDef.disposition,
          alive: true,
          equippedWeapon: weapon.name,
          equippedArmor: armor.name,
          statAffinity: roleDef.primaryStat,
          stats,
          kingdom,
          species: lineageInfo.species,
          lineage: lineageInfo.lineage,
          inventory: (function() {
            const map: Record<string, string[]> = {
              provisioner: [weapon.name, "Trail Provisions", "Dried Fruit & Salt", "Merchant Ledger"],
              innkeeper: [weapon.name, "Spiced Hearth Ale", "Roasted Shank", "Tavern Key"],
              smith: [weapon.name, "Sharpening Whetstone", "Iron Rivets", "Forge Hammer"],
              sentry: [weapon.name, "Watch Horn", "Ration Bread", "Iron Manacles"],
              courier: [weapon.name, "Sealed Courier Satchel", "Trail Provisions", "Wayfarer Cloak"],
              agitator: [weapon.name, "Stale Crust", "Flint Spark", "Crude Seditious Broadsheet"],
              fence: [weapon.name, "Lockpick Set", "Pouch of 25 Gold", "Smuggled Aetheric Draught"]
            };
            return map[roleDef.slotKey] || [weapon.name, "Trail Provisions"];
          })()
        });
      });

    } else {
      // -------------------------------------------------------------
      // 2. PROCEDURAL WILDERNESS NPCS & ROAMING AGENTS
      // -------------------------------------------------------------
      const bName = context.biomeName || "Temperate Forest";
      const ecology = BIOME_ECOLOGY_MATRIX[bName] || BIOME_ECOLOGY_MATRIX["Temperate Forest"]!;

      const centerPoint: [number, number] = [rng.range(120, 136), rng.range(120, 136)];
      const northGlade: [number, number] = [rng.range(50, 80), rng.range(45, 75)];
      const southMeadow: [number, number] = [rng.range(175, 205), rng.range(170, 200)];
      const eastRidge: [number, number] = [rng.range(170, 205), rng.range(50, 80)];

      const rawAgents = context.entitiesPresent || [];
      const agentTypes = new Set(rawAgents.map(a => a.type));
      const isAmbush = agentTypes.has("Merchant") && (agentTypes.has("Bandit") || agentTypes.has("Smuggler"));
      const isHunt = agentTypes.has("Predator") && agentTypes.has("Prey");

      if (rawAgents.length > 0) {
        rawAgents.forEach((agent, i) => {
          const npcId = `agent_${agent.type}_${cellId}_${rx}_${ry}_${i}`;

          // Check if already persisted
          if (persistedMap.has(npcId)) {
            npcs.push(persistedMap.get(npcId)!);
            return;
          }

          // Spatiotemporal deterministic roaming vector
          const roamOffsetX = Math.floor(Math.sin((baseSeed + i * 37 + worldTick * 0.05)) * 12);
          const roamOffsetY = Math.floor(Math.cos((baseSeed + i * 43 + worldTick * 0.04)) * 12);

          let spawnPos: [number, number] = [
            Math.min(240, Math.max(15, centerPoint[0] + (i * 20 - 30) + roamOffsetX)),
            Math.min(240, Math.max(15, centerPoint[1] + (i * 15 - 25) + roamOffsetY))
          ];

          // Dynamic Spatial Co-location for Tension Scenarios
          if (isAmbush) {
            if (agent.type === "Merchant") {
              spawnPos = [Math.max(15, centerPoint[0] - 2), Math.max(15, centerPoint[1])];
            } else if (agent.type === "Bandit" || agent.type === "Smuggler") {
              spawnPos = [Math.min(240, centerPoint[0] + 4 + i * 2), Math.min(240, centerPoint[1] + 1)];
            }
          } else if (isHunt) {
            if (agent.type === "Prey") {
              spawnPos = [Math.max(15, southMeadow[0] + 3), Math.max(15, southMeadow[1] + 2)];
            } else if (agent.type === "Predator") {
              spawnPos = [Math.max(15, southMeadow[0] - 8), Math.max(15, southMeadow[1] - 5)];
            }
          }

          if (agent.type === "Predator") {
            const pDef = rng.pick(ecology.predators);
            const stats = this.generateStatsForProfile("might", pDef.affinity, rng);
            const maxHp = pDef.hp;

            npcs.push({
              id: npcId,
              name: pDef.name,
              role: "Apex Predator",
              pos: spawnPos,
              tags: ["beast", "predator", "hostile", "organic", "leather_hide", "sharp"],
              faction: "Wilderness",
              hp: maxHp,
              maxHp,
              disposition: -2,
              alive: true,
              equippedWeapon: pDef.weapon,
              equippedArmor: pDef.armor,
              statAffinity: pDef.affinity,
              stats,
              kingdom: "Mammal",
              species: pDef.name,
              inventory: [`${pDef.name} Hide`, `Sharp ${pDef.name} Fang`, `Fresh ${pDef.name} Meat`]
            });
          } else if (agent.type === "Prey") {
            const pDef = rng.pick(ecology.prey);
            const stats = this.generateStatsForProfile("reflex", pDef.affinity, rng);
            const maxHp = pDef.hp;

            npcs.push({
              id: npcId,
              name: pDef.name,
              role: "Wild Fauna",
              pos: spawnPos,
              tags: ["beast", "prey", "neutral", "organic", "edible_meat", "leather_hide", "skittish"],
              faction: "Wilderness",
              hp: maxHp,
              maxHp,
              disposition: 0,
              alive: true,
              equippedWeapon: "Natural Flurry",
              equippedArmor: pDef.armor,
              statAffinity: pDef.affinity,
              stats,
              kingdom: "Mammal",
              species: pDef.name,
              inventory: [`${pDef.name} Pelt`, `Fresh ${pDef.name} Haunch`, `${pDef.name} Sinew`]
            });
          } else if (agent.type === "Merchant") {
            const kingdom = rng.pick(["Mammal", "Avian", "Aquatic", "Reptile"]);
            const chosenSpecies = rng.pick(this.getKingdomSpecies(kingdom));
            const firstName = rng.pick(this.getKingdomFirstNames(kingdom));
            const fullName = `${firstName} the Caravaner`;

            const stats = this.generateStatsForProfile("charm", "logic", rng);
            const weapon = getRandomWeaponForStat("finesse");
            const armor = getRandomArmorForStat("charm");

            npcs.push({
              id: npcId,
              name: fullName,
              role: "Traveling Peddler",
              pos: spawnPos,
              tags: ["civilian", "merchant", "talkative", "bribeable", "tradeable", "organic"],
              faction: context.factionOwner || "Free Traders Guild",
              hp: 18,
              maxHp: 18,
              disposition: 1,
              alive: true,
              equippedWeapon: weapon.name,
              equippedArmor: armor.name,
              statAffinity: "charm",
              stats,
              kingdom,
              species: chosenSpecies.species,
              lineage: chosenSpecies.lineage,
              inventory: [weapon.name, "Trail Provisions", "Herbal Healing Salve", "Bolt of Fine Silk", "Pouch of 35 Gold"]
            });
          } else if (agent.type === "Patrol") {
            const kingdom = rng.pick(["Mammal", "Avian", "Reptile"]);
            const chosenSpecies = rng.pick(this.getKingdomSpecies(kingdom));
            const firstName = rng.pick(this.getKingdomFirstNames(kingdom));
            const fullName = `${firstName} the Scout`;

            const stats = this.generateStatsForProfile("might", "awareness", rng);
            const weapon = getRandomWeaponForStat("might");
            const armor = getRandomArmorForStat("fortitude");

            npcs.push({
              id: npcId,
              name: fullName,
              role: "Border Sentry",
              pos: spawnPos,
              tags: ["soldier", "patrol", "disciplined", "alert", "organic"],
              faction: context.factionOwner || "Frontier Guard",
              hp: 24,
              maxHp: 24,
              disposition: 0,
              alive: true,
              equippedWeapon: weapon.name,
              equippedArmor: armor.name,
              statAffinity: "might",
              stats,
              kingdom,
              species: chosenSpecies.species,
              lineage: chosenSpecies.lineage,
              inventory: [weapon.name, "Field Rations", "Scout Whistle", "Bandage Dressing"]
            });
          } else if (agent.type === "Smuggler" || agent.type === "Bandit") {
            const kingdom = rng.pick(["Mammal", "Insect", "Reptile"]);
            const chosenSpecies = rng.pick(this.getKingdomSpecies(kingdom));
            const firstName = rng.pick(this.getKingdomFirstNames(kingdom));
            const fullName = `${firstName} Shadow-Foot`;

            const stats = this.generateStatsForProfile("finesse", "reflex", rng);
            const weapon = getRandomWeaponForStat("finesse");
            const armor = getRandomArmorForStat("finesse");

            npcs.push({
              id: npcId,
              name: fullName,
              role: "Highway Skirmisher",
              pos: spawnPos,
              tags: ["outlaw", "hostile", "subterfuge", "bribeable", "organic"],
              faction: "Fulcrum Smuggler Ring",
              hp: 20,
              maxHp: 20,
              disposition: -1,
              alive: true,
              equippedWeapon: weapon.name,
              equippedArmor: armor.name,
              statAffinity: "finesse",
              stats,
              kingdom,
              species: chosenSpecies.species,
              lineage: chosenSpecies.lineage,
              inventory: [weapon.name, "Lockpick Set", "Smuggled Contraband Phial", "Pouch of 20 Gold"]
            });
          } else if (agent.type === "Cannibal") {
            const stats = this.generateStatsForProfile("might", "vitality", rng);
            const weapon = getRandomWeaponForStat("might");
            const armor = getRandomArmorForStat("vitality");

            npcs.push({
              id: npcId,
              name: "Starving Marauder",
              role: "Famine Outlaw",
              pos: spawnPos,
              tags: ["cannibal", "hostile", "desperate", "feral", "organic"],
              faction: "Rot-Tooth Cannibals",
              hp: 18,
              maxHp: 18,
              disposition: -2,
              alive: true,
              equippedWeapon: weapon.name,
              equippedArmor: armor.name,
              statAffinity: "might",
              stats,
              kingdom: "Mammal",
              species: "Feral Scavenger",
              inventory: [weapon.name, "Bone Scraping Shiv", "Charred Jerky", "Twisted Effigy"]
            });
          } else if (agent.type === "Cultist") {
            const stats = this.generateStatsForProfile("intuition", "finesse", rng);
            const cultistKingdom = rng.pick(["Reptile", "Insect", "Avian"]);
            const cultistSpecies = rng.pick(this.getKingdomSpecies(cultistKingdom));
            const cultistFirstName = rng.pick(this.getKingdomFirstNames(cultistKingdom));
            const dragonName = context.dragonDomain || "the Broken Seal";
            const cultistTitle = rng.pick(["Blood-Zealot", "Void-Chanter", "Acolyte", "Pyre-Watcher", "Disciple"]);
            const cultistName = `${cultistTitle} ${cultistFirstName}`;
            const cultistRole = `Cultist of ${dragonName}`;

            npcs.push({
              id: npcId,
              name: cultistName,
              role: cultistRole,
              pos: spawnPos,
              tags: ["cultist", "hostile", "fanatical", "blood_magic", "dragon_worshipper", "organic"],
              faction: `Cult of ${dragonName}`,
              hp: 22,
              maxHp: 22,
              disposition: -2,
              alive: true,
              equippedWeapon: "Obsidian Ritual Kris",
              equippedArmor: "Cruor Rags",
              statAffinity: "intuition",
              stats,
              kingdom: cultistKingdom,
              species: cultistSpecies.species,
              lineage: cultistSpecies.lineage,
              inventory: [
                "Obsidian Ritual Kris",
                `${dragonName} Cult Idol`,
                `${dragonName} Blood Phial`,
                `${context.activeFlow || "Cruor"} Chaos Talisman`
              ]
            });
          } else if (agent.type === "Warden") {
            const stats = this.generateStatsForProfile("might", "willpower", rng);
            const wardenKingdom = "Mammal";
            const wardenFirstName = rng.pick(["Alistair", "Morwen", "Donald", "Garrick", "Theron", "Lysandra", "Vaelen"]);
            const wardenTitle = rng.pick(["Grey Warden Vigil", "Warden Decurion", "Warden Sentinel", "Spear-Vigil"]);
            const wardenName = `Warden ${wardenFirstName}`;

            npcs.push({
              id: npcId,
              name: wardenName,
              role: wardenTitle,
              pos: spawnPos,
              tags: ["warden", "guardian", "grey_cloak", "titanium_spear", "disciplined", "allied", "organic"],
              faction: "Wardens of the Core",
              hp: 35,
              maxHp: 35,
              disposition: 1,
              alive: true,
              equippedWeapon: "Cold Titanium Spear",
              equippedArmor: "Slate Wool Cloak & Mail",
              statAffinity: "willpower",
              stats,
              kingdom: wardenKingdom,
              species: "Human Warden",
              inventory: [
                "Cold Titanium Spear",
                "Warden Field Bandages",
                `${context.dragonDomain || "Astral"} Ward Seal`
              ]
            });
          }
        });
      }

      // Default ambient ecology herd if no raw agents present
      if (npcs.length === 0) {
        const prey1 = ecology.prey[0] || { name: "Wild Game", affinity: "reflex" as StatKey, armor: "Pelt", hp: 16 };
        const prey2 = ecology.prey[1] || ecology.prey[0] || { name: "Wild Hare", affinity: "reflex" as StatKey, armor: "Soft Fluff", hp: 10 };
        const predator1 = ecology.predators[0] || { name: "Prowling Beast", affinity: "might" as StatKey, weapon: "Fangs", armor: "Hide", hp: 28 };

        // Ambient Grazing Herd in South Meadow
        const herd1Id = `npc_${cellId}_${rx}_${ry}_prey_herd_1`;
        if (persistedMap.has(herd1Id)) {
          npcs.push(persistedMap.get(herd1Id)!);
        } else {
          npcs.push({
            id: herd1Id,
            name: prey1.name,
            role: "Wild Game",
            pos: [southMeadow[0] + 6, southMeadow[1] - 6],
            tags: ["beast", "prey", "neutral", "organic", "edible_meat", "leather_hide", "skittish"],
            faction: "Wilderness",
            hp: prey1.hp,
            maxHp: prey1.hp,
            disposition: 0,
            alive: true,
            equippedWeapon: "Natural Flurry",
            equippedArmor: prey1.armor,
            statAffinity: prey1.affinity,
            stats: this.generateStatsForProfile("reflex", prey1.affinity, rng),
            kingdom: "Mammal",
            species: prey1.name,
            inventory: [`${prey1.name} Pelt`, `Fresh ${prey1.name} Haunch`]
          });
        }

        // Ambient Skittish Fauna in North Glade
        const herd2Id = `npc_${cellId}_${rx}_${ry}_prey_herd_2`;
        if (persistedMap.has(herd2Id)) {
          npcs.push(persistedMap.get(herd2Id)!);
        } else {
          npcs.push({
            id: herd2Id,
            name: prey2.name,
            role: "Wild Fauna",
            pos: [northGlade[0] + 8, northGlade[1] + 6],
            tags: ["beast", "prey", "neutral", "organic", "edible_meat", "leather_hide", "skittish"],
            faction: "Wilderness",
            hp: prey2.hp,
            maxHp: prey2.hp,
            disposition: 0,
            alive: true,
            equippedWeapon: "Natural Flurry",
            equippedArmor: prey2.armor,
            statAffinity: prey2.affinity,
            stats: this.generateStatsForProfile("reflex", prey2.affinity, rng),
            kingdom: "Mammal",
            species: prey2.name,
            inventory: [`${prey2.name} Pelt`, `Fresh ${prey2.name} Meat`]
          });
        }

        // Stalking Apex Predator on East Ridge
        const predatorId = `npc_${cellId}_${rx}_${ry}_predator_ridge`;
        if (persistedMap.has(predatorId)) {
          npcs.push(persistedMap.get(predatorId)!);
        } else {
          npcs.push({
            id: predatorId,
            name: predator1.name,
            role: "Apex Predator",
            pos: [eastRidge[0] + 4, eastRidge[1] + 5],
            tags: ["beast", "predator", "hostile", "organic", "leather_hide", "sharp"],
            faction: "Wilderness",
            hp: predator1.hp,
            maxHp: predator1.hp,
            disposition: -2,
            alive: true,
            equippedWeapon: predator1.weapon,
            equippedArmor: predator1.armor,
            statAffinity: predator1.affinity,
            stats: this.generateStatsForProfile("might", predator1.affinity, rng),
            kingdom: "Mammal",
            species: predator1.name,
            inventory: [`${predator1.name} Hide`, `Sharp ${predator1.name} Fang`, `Fresh ${predator1.name} Meat`]
          });
        }

        // Frontier Wayfarer crossing central crossroads
        const wayfarerId = `npc_${cellId}_${rx}_${ry}_wayfarer`;
        if (persistedMap.has(wayfarerId)) {
          npcs.push(persistedMap.get(wayfarerId)!);
        } else {
          const kingdom = rng.pick(["Mammal", "Avian", "Plant"]);
          const chosenSpecies = rng.pick(this.getKingdomSpecies(kingdom));
          const firstName = rng.pick(this.getKingdomFirstNames(kingdom));
          const fullName = `${firstName} ${rng.pick(CULTURAL_EPITHETS)}`;

          const stats = this.generateStatsForProfile("endurance", "awareness", rng);
          const weapon = getRandomWeaponForStat("endurance");
          const armor = getRandomArmorForStat("endurance");

          npcs.push({
            id: wayfarerId,
            name: fullName,
            role: "Frontier Wayfarer",
            pos: [centerPoint[0] + 8, centerPoint[1] + 8],
            tags: ["civilian", "wayfarer", "talkative", "rumors", "organic"],
            faction: "Independent Travelers",
            hp: 20,
            maxHp: 20,
            disposition: 1,
            alive: true,
            equippedWeapon: weapon.name,
            equippedArmor: armor.name,
            statAffinity: "endurance",
            stats,
            kingdom,
            species: chosenSpecies.species,
            lineage: chosenSpecies.lineage,
            inventory: [weapon.name, "Trail Provisions", "Wayfarer Keepsake", "Pouch of 15 Gold"]
          });
        }
      }
    }

    // DRAGON PRISONS: Injected Grey Wardens and Crazed Cultists
    const dragonPrison = DRAGON_PRISONS[cellId];
    if (dragonPrison) {
      const centerPoint: [number, number] = [rng.range(120, 136), rng.range(120, 136)];
      const wardenId = `npc_${cellId}_${rx}_${ry}_grey_warden`;
      if (persistedMap.has(wardenId)) {
        npcs.push(persistedMap.get(wardenId)!);
      } else {
        const wardenFirstName = rng.pick(["Alistair", "Morwen", "Donald", "Garrick", "Theron", "Lysandra", "Vaelen"]);
        const wardenName = `Warden ${wardenFirstName}`;
        const wardenRole = `Vigil of ${dragonPrison.domain}`;

        npcs.push({
          id: wardenId,
          name: wardenName,
          role: wardenRole,
          pos: [centerPoint[0] - 3, centerPoint[1] - 2],
          tags: ["warden", "guardian", "grey_cloak", "titanium_spear", "disciplined", "allied", "organic"],
          faction: "Wardens of the Core",
          hp: 35,
          maxHp: 35,
          disposition: 1,
          alive: true,
          equippedWeapon: "Cold Titanium Spear",
          equippedArmor: "Slate Wool Cloak & Mail",
          statAffinity: "willpower",
          stats: this.generateStatsForProfile("might", "willpower", rng),
          kingdom: "Mammal",
          species: "Human Warden",
          inventory: ["Cold Titanium Spear", "Warden Field Bandages", `${dragonPrison.domain} Ward Seal`]
        });
      }

      const cultistId = `npc_${cellId}_${rx}_${ry}_chaos_cultist`;
      if (persistedMap.has(cultistId)) {
        npcs.push(persistedMap.get(cultistId)!);
      } else {
        const cultistKingdom = rng.pick(["Reptile", "Insect", "Avian"]);
        const cultistSpecies = rng.pick(this.getKingdomSpecies(cultistKingdom));
        const cultistFirstName = rng.pick(this.getKingdomFirstNames(cultistKingdom));
        const cultistTitle = rng.pick(["Dragon-Zealot", "Blood-Chanter", "Acolyte", "Pyre-Disciple"]);
        const cultistName = `${cultistTitle} ${cultistFirstName}`;
        const cultistRole = `Cultist of ${dragonPrison.dragon}`;

        npcs.push({
          id: cultistId,
          name: cultistName,
          role: cultistRole,
          pos: [centerPoint[0] + 4, centerPoint[1] + 3],
          tags: ["cultist", "hostile", "fanatical", "blood_magic", "dragon_worshipper", "organic"],
          faction: `Cult of ${dragonPrison.dragon}`,
          hp: 24,
          maxHp: 24,
          disposition: -2,
          alive: true,
          equippedWeapon: "Obsidian Ritual Kris",
          equippedArmor: "Cruor Rags",
          statAffinity: "intuition",
          stats: this.generateStatsForProfile("intuition", "finesse", rng),
          kingdom: cultistKingdom,
          species: cultistSpecies.species,
          inventory: ["Obsidian Ritual Kris", `${dragonPrison.dragon} Cult Idol`, `${dragonPrison.domain} Blood Phial`]
        });
      }
    }

    return npcs;
  }

  /**
   * Resolves species demographics for a burg using live database data or biome affinities.
   */
  private static resolveBurgDemographics(
    context: SectorContext,
    rng: SeededPRNG
  ): Array<{ kingdom: string; lineageInfo: { lineage: string; species: string; affinity: StatKey } }> {
    const list: Array<{ kingdom: string; lineageInfo: { lineage: string; species: string; affinity: StatKey } }> = [];

    // Check if burg has species_demographics JSON string
    const rawDemo = (context.burg as any)?.species_demographics;
    if (rawDemo && typeof rawDemo === "object") {
      for (const [k, v] of Object.entries(rawDemo)) {
        const parts = k.split(":");
        const kingdom = parts[0] || "Mammal";
        list.push({ kingdom, lineageInfo: rng.pick(this.getKingdomSpecies(kingdom)) });
      }
    }

    if (list.length === 0) {
      // Natural biome distribution
      const b = (context.biomeName || "").toLowerCase();
      let k1 = "Mammal", k2 = "Plant";
      if (b.includes("wetland") || b.includes("marine") || b.includes("swamp")) {
        k1 = "Aquatic"; k2 = "Reptile";
      } else if (b.includes("desert") || b.includes("savanna")) {
        k1 = "Reptile"; k2 = "Insect";
      } else if (b.includes("mountain") || b.includes("chaparral")) {
        k1 = "Avian"; k2 = "Insect";
      } else if (b.includes("tundra") || b.includes("glacier")) {
        k1 = "Mammal"; k2 = "Avian";
      }

      const sp1 = rng.pick(this.getKingdomSpecies(k1));
      const sp2 = rng.pick(this.getKingdomSpecies(k2));
      list.push({ kingdom: k1, lineageInfo: sp1 }, { kingdom: k2, lineageInfo: sp2 });
    }

    return list;
  }

  /**
   * Generates a 12-stat distribution favoring the role and species affinities.
   */
  public static generateStatsForProfile(
    roleAffinity: StatKey,
    speciesAffinity: StatKey,
    rng: SeededPRNG
  ): Record<StatKey, number> {
    const allStats: StatKey[] = [
      "might", "endurance", "finesse", "reflex", "vitality", "fortitude",
      "knowledge", "logic", "awareness", "intuition", "charm", "willpower"
    ];

    const stats: Record<StatKey, number> = {
      might: 5, endurance: 5, finesse: 5, reflex: 5, vitality: 5, fortitude: 5,
      knowledge: 5, logic: 5, awareness: 5, intuition: 5, charm: 5, willpower: 5
    };

    // Role affinity gets primary boost (+2 to +3)
    stats[roleAffinity] = Math.min(10, (stats[roleAffinity] || 5) + rng.range(2, 3));
    // Species affinity gets secondary boost (+1 to +2)
    stats[speciesAffinity] = Math.min(10, (stats[speciesAffinity] || 5) + rng.range(1, 2));

    // Slight variance on others
    allStats.forEach(st => {
      if (st !== roleAffinity && st !== speciesAffinity) {
        stats[st] = Math.max(3, Math.min(8, (stats[st] || 5) + rng.range(-1, 1)));
      }
    });

    return stats;
  }
}
