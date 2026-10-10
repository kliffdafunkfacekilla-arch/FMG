/**
 * WHATELSE STORY & DYNAMIC QUEST BEAT ENGINE
 * ===========================================
 * Implements the WhatELSE (CHI 2025) Narrative Spaces framework:
 * - 5-Act Global Campaign Arc progression
 * - Dynamic Procedural Story Beat Synthesis from Macro Simulation States
 * - Procedural Micro-Location & Entity Injection across the 256x256 Tactical Grid
 * - Branching 3-Variant Narrative Pivots
 * - Ground-Truth Objective Tracking with Universal Tags
 */

import { TaggedObject, TagMatrixEngine } from "./TagMatrixEngine.js";
import {
  getRandomWeapon,
  getRandomArmor,
  getRandomWeaponForStat,
  getRandomArmorForStat,
  StatKey
} from "./EquipmentRegistry.js";

export interface QuestObjective {
  id: string;
  type: "DESTROY_PROP" | "DEFEAT_NPC" | "INTERACT_PROP" | "CONVINCE_NPC" | "EXPLORE_POI";
  description: string;
  targetId: string;
  requiredCount: number;
  currentCount: number;
  completed: boolean;
}

export type StoryBeatCategory =
  | "FOOD_CRISIS"
  | "WARZONE_ASSAULT"
  | "CHAOS_CORRUPTION"
  | "CRIME_SYNDICATE"
  | "BEAST_INCURSION"
  | "TRADE_AMBUSH"
  | "ANCIENT_EXPEDITION"
  | "WILDERNESS_SCOUT";

export interface StoryBeat {
  beatId: string;
  category: StoryBeatCategory;
  title: string;
  hook: string;
  questGiver: { name: string; role: string; faction?: string | undefined };
  opposingFaction?: string | undefined;
  objectives: QuestObjective[];
  rewards: { xp: number; gold: number; item?: string };
  reputationChanges: Record<string, number>;
  pivotDecision: string;
  variants: Array<{
    name: string;
    description: string;
    preferredStat: string;
  }>;
}

export interface InjectedNPC {
  id: string;
  name: string;
  role: string;
  pos: [number, number];
  tags: string[];
  faction: string;
  hp: number;
  maxHp: number;
  disposition: number; // -2 Hostile to +2 Allied
  alive: boolean;
  equippedWeapon?: string;
  equippedArmor?: string;
  statAffinity?: StatKey;
  stats?: Partial<Record<StatKey, number>>;
}

export interface InjectedWorldState {
  props: TaggedObject[];
  npcs: InjectedNPC[];
  activeBeat: StoryBeat;
}

export interface SectorContext {
  cellId: number;
  rx?: number;
  ry?: number;
  biomeName: string;
  isWarzone: boolean;
  isFamine: boolean;
  chaosRadiation: number;
  infrastructureMask: number;
  factionOwner?: string;
  crimeRate?: number | string;
  entitiesPresent?: Array<{ type: string; state: string; story_hook: string }>;
}

class SeededPRNG {
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

export class WhatElseStoryEngine {
  private currentActIndex = 0;
  private readonly ACTS = [
    { act: 1, title: "The Gathering Storm", theme: "Crisis of Survival & Local Vulnerability" },
    { act: 2, title: "Shadows of the Fulcrum", theme: "Uncovering Fringe Cartels & Cult Infiltrations" },
    { act: 3, title: "The Midpoint Cataclysm", theme: "Continental Warfare & Metaphysical Rupture" },
    { act: 4, title: "The Darkest Hour", theme: "Besieged Strongholds & Desperate Alliances" },
    { act: 5, title: "The Final Reckoning", theme: "Aetherian Hegemony or Cosmic Catastrophe" }
  ];

  private activeBeat: StoryBeat | null = null;
  private completedBeats: StoryBeat[] = [];

  private readonly FIRST_NAMES = [
    "Valeria", "Garrick", "Morwen", "Kaelen", "Bran", "Thorgar", "Lysandra",
    "Doran", "Varek", "Selene", "Torvold", "Elian", "Jareth", "Maren", "Orla",
    "Corvin", "Vane", "Malakor", "Harlen", "Rowan", "Kira", "Fenrik", "Aldous",
    "Brynna", "Gareth", "Zephyr", "Cedric", "Kallista", "Theron", "Mira", "Brant"
  ];

  private readonly EPITHETS = [
    "Iron-Biter", "the Red", "the Defiant", "of the Ash", "the Starving",
    "the Swift", "the Bleeding", "the Pious", "the Shadow-Bound", "Bone-Breaker",
    "the Cautious", "the Silent", "the Grim", "the Raven", "Stone-Foot",
    "the Unbroken", "Hollow-Eye", "the Exiled", "Blood-Seeker", "Ghost-Strider"
  ];

  public getCampaignState() {
    return {
      currentAct: this.ACTS[this.currentActIndex] || this.ACTS[0],
      actIndex: this.currentActIndex + 1,
      totalActs: this.ACTS.length,
      activeBeat: this.activeBeat,
      completedBeatsCount: this.completedBeats.length
    };
  }

  public restoreCampaignState(state: any) {
    if (state?.actIndex !== undefined) {
      this.currentActIndex = Math.max(0, Math.min(this.ACTS.length - 1, (state.actIndex || 1) - 1));
    }
    if (state?.activeBeat) {
      this.activeBeat = state.activeBeat;
    }
    if (Array.isArray(state?.completedBeats)) {
      this.completedBeats = state.completedBeats;
    }
  }

  /**
   * Deterministically generates a procedurally rich StoryBeat from the sector's environmental context.
   */
  public generateBeatFromSector(context: SectorContext): StoryBeat {
    const rx = context.rx ?? 112;
    const ry = context.ry ?? 112;
    const seedVal = (context.cellId * 73856093) ^ (rx * 19349663) ^ (ry * 83492791);
    const rng = new SeededPRNG(seedVal);

    // Determine Emergent Category based on macroscopic simulation deltas
    let category: StoryBeatCategory = "WILDERNESS_SCOUT";
    if (context.isFamine) {
      category = "FOOD_CRISIS";
    } else if (context.isWarzone) {
      category = "WARZONE_ASSAULT";
    } else if (context.chaosRadiation > 0.3 || (context.infrastructureMask & 8)) {
      category = "CHAOS_CORRUPTION";
    } else if (Number(context.crimeRate) > 40 || context.entitiesPresent?.some(e => e.type === "Smuggler" || e.type === "Bandit")) {
      category = "CRIME_SYNDICATE";
    } else if (context.entitiesPresent?.some(e => e.type === "Predator")) {
      category = "BEAST_INCURSION";
    } else if ((context.infrastructureMask & 2) || context.entitiesPresent?.some(e => e.type === "Merchant")) {
      category = "TRADE_AMBUSH";
    } else if ((context.infrastructureMask & 16) || rng.next() < 0.35) {
      category = "ANCIENT_EXPEDITION";
    }

    const factionName = context.factionOwner && context.factionOwner !== "Unclaimed" ? context.factionOwner : "Frontier Guild";
    const giverName = `${rng.pick(this.FIRST_NAMES)} ${rng.pick(this.EPITHETS)}`;

    switch (category) {
      case "FOOD_CRISIS": {
        const opposingFaction = "Rot-Tooth Cannibals";
        const beatId = `beat_famine_${context.cellId}_${rx}_${ry}`;
        return {
          beatId,
          category: "FOOD_CRISIS",
          title: `Bones in the Granary of Sector (${rx}, ${ry})`,
          hook: `Famine grips the region. Starving marauders led by ${rng.pick(this.FIRST_NAMES)} the Butcher have entrenched themselves around the local grain reserves.`,
          questGiver: { name: giverName, role: "Burg Reeve", faction: factionName },
          opposingFaction,
          objectives: [
            {
              id: `obj_clear_barricade_${beatId}`,
              type: "DESTROY_PROP",
              description: "Breach the reinforced bone barricade blocking the grain silo",
              targetId: "prop_cannibal_barricade",
              requiredCount: 1,
              currentCount: 0,
              completed: false
            },
            {
              id: `obj_slay_warlord_${beatId}`,
              type: "DEFEAT_NPC",
              description: "Defeat or pacify the marauder war chief guarding the butchering pit",
              targetId: "npc_cannibal_warlord",
              requiredCount: 1,
              currentCount: 0,
              completed: false
            }
          ],
          rewards: { xp: 150 + rng.range(0, 50), gold: 35 + rng.range(0, 20), item: getRandomWeaponForStat("might").name },
          reputationChanges: { [factionName]: 20, [opposingFaction]: -30 },
          pivotDecision: "The grain stores are liberated, but starving refugees demand an immediate feast while guards urge stockpiling for winter.",
          variants: [
            { name: "Enforce Winter Rationing", description: "Use iron discipline to lock the silos for the long freeze", preferredStat: "willpower" },
            { name: "Distribute the Feast", description: "Feed the starving folk immediately to earn their eternal loyalty", preferredStat: "charm" },
            { name: "Seize the Surplus", description: "Skim the finest provisions for your personal company", preferredStat: "finesse" }
          ]
        };
      }

      case "WARZONE_ASSAULT": {
        const opposingFaction = "Ghostwind Raiders";
        const beatId = `beat_war_${context.cellId}_${rx}_${ry}`;
        const commanderName = `Commander ${rng.pick(this.FIRST_NAMES)}`;
        return {
          beatId,
          category: "WARZONE_ASSAULT",
          title: `Blood Along the Redoubt (${rx}, ${ry})`,
          hook: `A vanguard war camp under ${commanderName} has seized the highway, executing messengers and entrenching a perimeter.`,
          questGiver: { name: giverName, role: "Vanguard Scout", faction: factionName },
          opposingFaction,
          objectives: [
            {
              id: `obj_burn_munitions_${beatId}`,
              type: "INTERACT_PROP",
              description: "Ignite or sabotage the vanguard munitions cache",
              targetId: "prop_weapons_cache",
              requiredCount: 1,
              currentCount: 0,
              completed: false
            },
            {
              id: `obj_defeat_captain_${beatId}`,
              type: "DEFEAT_NPC",
              description: `Break the vanguard line and overcome ${commanderName}`,
              targetId: "npc_war_commander",
              requiredCount: 1,
              currentCount: 0,
              completed: false
            }
          ],
          rewards: { xp: 200 + rng.range(0, 50), gold: 60 + rng.range(0, 25), item: getRandomArmorForStat("fortitude").name },
          reputationChanges: { [factionName]: 25, [opposingFaction]: -40 },
          pivotDecision: "The raider commander yields, offering tactical maps of enemy supply lines in exchange for safe passage.",
          variants: [
            { name: "Execute the Raider", description: "Refuse quarter and strike off the commander's head as a warning", preferredStat: "might" },
            { name: "Accept the Intelligence", description: "Bargain for their battle maps and spare their life", preferredStat: "logic" },
            { name: "Exort Double Bounty", description: "Demand their concealed coin pouch and hostage exchange", preferredStat: "charm" }
          ]
        };
      }

      case "CHAOS_CORRUPTION": {
        const opposingFaction = "Cruorbus Blood Cult";
        const beatId = `beat_chaos_${context.cellId}_${rx}_${ry}`;
        return {
          beatId,
          category: "CHAOS_CORRUPTION",
          title: `The Crimson Incursion of Sector (${rx}, ${ry})`,
          hook: "An eldritch pulse bleeds from an ancient obsidian altar. Hooded zealots chant in blasphemous tongues, channeling the blood moon.",
          questGiver: { name: giverName, role: "Warden Templar", faction: "Order of the Grove" },
          opposingFaction,
          objectives: [
            {
              id: `obj_shatter_altar_${beatId}`,
              type: "DESTROY_PROP",
              description: "Shatter the pulsating obsidian blood altar",
              targetId: "prop_blood_altar",
              requiredCount: 1,
              currentCount: 0,
              completed: false
            },
            {
              id: `obj_dispel_ritualist_${beatId}`,
              type: "DEFEAT_NPC",
              description: "Interrupt and defeat the High Ritualist before the blood invocation concludes",
              targetId: "npc_high_ritualist",
              requiredCount: 1,
              currentCount: 0,
              completed: false
            }
          ],
          rewards: { xp: 250 + rng.range(0, 60), gold: 80 + rng.range(0, 30), item: getRandomWeaponForStat("willpower").name },
          reputationChanges: { "Order of the Grove": 30, [opposingFaction]: -50 },
          pivotDecision: "The altar fractures, releasing a swirling vortex of raw concentrated aetheric mana.",
          variants: [
            { name: "Purge the Core", description: "Channel pure willpower to safely banish the void radiation", preferredStat: "willpower" },
            { name: "Absorb the Aether", description: "Bind the primordial power into your weapon matrix", preferredStat: "knowledge" },
            { name: "Sanctify the Ruins", description: "Recite ancient ancestral wards to permanently bless the soil", preferredStat: "intuition" }
          ]
        };
      }

      case "CRIME_SYNDICATE": {
        const opposingFaction = "Fulcrum Smuggler Ring";
        const beatId = `beat_cartel_${context.cellId}_${rx}_${ry}`;
        return {
          beatId,
          category: "CRIME_SYNDICATE",
          title: `The Underworld Den at Sector (${rx}, ${ry})`,
          hook: "A black-market vice den has set up camp, siphoning stolen burg wealth and extorting trade caravans with armed muscle.",
          questGiver: { name: giverName, role: "Burg Magistrate", faction: factionName },
          opposingFaction,
          objectives: [
            {
              id: `obj_unlock_strongbox_${beatId}`,
              type: "INTERACT_PROP",
              description: "Locate and crack the syndicate lockbox containing stolen ledgers and gold",
              targetId: "prop_syndicate_lockbox",
              requiredCount: 1,
              currentCount: 0,
              completed: false
            },
            {
              id: `obj_subdue_enforcer_${beatId}`,
              type: "DEFEAT_NPC",
              description: "Subdue or confront the syndicate boss running the extortion ring",
              targetId: "npc_syndicate_enforcer",
              requiredCount: 1,
              currentCount: 0,
              completed: false
            }
          ],
          rewards: { xp: 180 + rng.range(0, 40), gold: 90 + rng.range(0, 30), item: getRandomWeaponForStat("finesse").name },
          reputationChanges: { [factionName]: 20, [opposingFaction]: -35 },
          pivotDecision: "You corner the syndicate boss clutching a ledger containing names of corrupt burg magistrates.",
          variants: [
            { name: "Expose the Council", description: "Hand the incriminating ledger to the public heralds", preferredStat: "logic" },
            { name: "Demand Hush Money", description: "Blackmail the cartel into paying you a recurring dividend", preferredStat: "charm" },
            { name: "Burn the Evidence", description: "Destroy the records to avoid a bloody civil feud", preferredStat: "finesse" }
          ]
        };
      }

      case "BEAST_INCURSION": {
        const opposingFaction = "Wild Dire Beasts";
        const beatId = `beat_beast_${context.cellId}_${rx}_${ry}`;
        return {
          beatId,
          category: "BEAST_INCURSION",
          title: `The Apex Hunt in the ${context.biomeName}`,
          hook: "An unnatural frenzy has driven predatory dire beasts into the sector, stalking travelers and nesting among ancient bone cairns.",
          questGiver: { name: giverName, role: "Master Trapper", faction: "Frontier Guild" },
          opposingFaction,
          objectives: [
            {
              id: `obj_destroy_nest_${beatId}`,
              type: "DESTROY_PROP",
              description: "Destroy the gore-spattered bone totem anchoring the predator lair",
              targetId: "prop_bone_totem",
              requiredCount: 1,
              currentCount: 0,
              completed: false
            },
            {
              id: `obj_slay_alpha_${beatId}`,
              type: "DEFEAT_NPC",
              description: "Slay the apex dire beast terrorizing the wilderness",
              targetId: "npc_apex_beast",
              requiredCount: 1,
              currentCount: 0,
              completed: false
            }
          ],
          rewards: { xp: 170 + rng.range(0, 40), gold: 45 + rng.range(0, 20), item: getRandomArmorForStat("vitality").name },
          reputationChanges: { "Frontier Guild": 25 },
          pivotDecision: "The beast collapses, revealing a clutch of abandoned, uncorrupted cubs shivering in the cave depths.",
          variants: [
            { name: "Tame the Brood", description: "Use gentle patience and food to bond with the wild cubs", preferredStat: "intuition" },
            { name: "Harvest the Trophies", description: "Skin the pelts and teeth for master crafting reagents", preferredStat: "finesse" },
            { name: "Deliver to Menagerie", description: "Transport the young to a burg collector for a hefty bounty", preferredStat: "logic" }
          ]
        };
      }

      case "TRADE_AMBUSH": {
        const opposingFaction = "Highway Outlaws";
        const beatId = `beat_trade_${context.cellId}_${rx}_${ry}`;
        return {
          beatId,
          category: "TRADE_AMBUSH",
          title: `Caravan Broken at Sector (${rx}, ${ry})`,
          hook: "A merchant convoy lies splintered along the thoroughfare. Outlaws have looted the cargo and cornered surviving teamsters.",
          questGiver: { name: giverName, role: "Caravan Factor", faction: factionName },
          opposingFaction,
          objectives: [
            {
              id: `obj_salvage_cargo_${beatId}`,
              type: "INTERACT_PROP",
              description: "Salvage and secure the overturned trade wagon",
              targetId: "prop_trade_wagon",
              requiredCount: 1,
              currentCount: 0,
              completed: false
            },
            {
              id: `obj_scatter_cutthroats_${beatId}`,
              type: "DEFEAT_NPC",
              description: "Defeat or scatter the outlaw cutthroats besieging the survivors",
              targetId: "npc_outlaw_chief",
              requiredCount: 1,
              currentCount: 0,
              completed: false
            }
          ],
          rewards: { xp: 160 + rng.range(0, 40), gold: 75 + rng.range(0, 30), item: getRandomWeaponForStat("charm").name },
          reputationChanges: { [factionName]: 20, [opposingFaction]: -30 },
          pivotDecision: "With the road cleared, the grateful merchant offers you first pick of the salvaged luxury cargo.",
          variants: [
            { name: "Take the Coin Bounty", description: "Demand immediate payment in gold coin", preferredStat: "charm" },
            { name: "Secure Trade Shares", description: "Negotiate a permanent 15% dividend on future caravans", preferredStat: "logic" },
            { name: "Accept Rare Weapon", description: "Claim an exotic imported blade from the cargo manifest", preferredStat: "might" }
          ]
        };
      }

      case "ANCIENT_EXPEDITION": {
        const opposingFaction = "Tomb Guardians";
        const beatId = `beat_ancient_${context.cellId}_${rx}_${ry}`;
        return {
          beatId,
          category: "ANCIENT_EXPEDITION",
          title: `Relics of the Sunken Crypt (${rx}, ${ry})`,
          hook: "Earth tremors have unearthed a cyclopean crypt from the First Era, exposing runic monoliths and forgotten reliquaries.",
          questGiver: { name: giverName, role: "Antiquarian", faction: "Scholars of the Spire" },
          opposingFaction,
          objectives: [
            {
              id: `obj_unseal_crypt_${beatId}`,
              type: "INTERACT_PROP",
              description: "Decipher and unseal the ancient stone sarcophagus",
              targetId: "prop_ancient_sarcophagus",
              requiredCount: 1,
              currentCount: 0,
              completed: false
            },
            {
              id: `obj_defeat_golem_${beatId}`,
              type: "DEFEAT_NPC",
              description: "Neutralize the stone guardian automaton standing vigil",
              targetId: "npc_tomb_guardian",
              requiredCount: 1,
              currentCount: 0,
              completed: false
            }
          ],
          rewards: { xp: 220 + rng.range(0, 50), gold: 60 + rng.range(0, 25), item: getRandomWeaponForStat("knowledge").name },
          reputationChanges: { "Scholars of the Spire": 25 },
          pivotDecision: "Inside the tomb lies a preserved star-chart detailing ancient Aetherian leyline nodes across the continent.",
          variants: [
            { name: "Decipher the Constellations", description: "Study the celestial equations to expand your arcane mastery", preferredStat: "knowledge" },
            { name: "Sell to the Archmage", description: "Auction the intact stone tablet to the highest imperial bidder", preferredStat: "charm" },
            { name: "Pencil Tactical Map", description: "Extract hidden military shortcuts through the mountain passes", preferredStat: "awareness" }
          ]
        };
      }

      default: {
        const beatId = `beat_wild_${context.cellId}_${rx}_${ry}`;
        return {
          beatId,
          category: "WILDERNESS_SCOUT",
          title: `Echoes in the Untamed ${context.biomeName}`,
          hook: "Frontier guides speak of strange disturbances in the sector. Uncharted scout trails, abandoned camps, and hidden caches await discovery.",
          questGiver: { name: giverName, role: "Frontier Ranger", faction: "Frontier Guild" },
          opposingFaction: "Wild Scavengers",
          objectives: [
            {
              id: `obj_scout_monolith_${beatId}`,
              type: "EXPLORE_POI",
              description: "Survey the landmark stone monolith at sector center",
              targetId: "prop_runic_monolith",
              requiredCount: 1,
              currentCount: 0,
              completed: false
            },
            {
              id: `obj_unlock_cache_${beatId}`,
              type: "INTERACT_PROP",
              description: "Locate and unlock the smuggler strongbox hidden in the brush",
              targetId: "prop_smuggler_cache",
              requiredCount: 1,
              currentCount: 0,
              completed: false
            }
          ],
          rewards: { xp: 120 + rng.range(0, 30), gold: 30 + rng.range(0, 15), item: getRandomArmorForStat("reflex").name },
          reputationChanges: { "Frontier Guild": 15 },
          pivotDecision: "Within the cache lies a regional scout report revealing rival faction troop movements.",
          variants: [
            { name: "Deliver to Burg Magistrate", description: "Warn the local settlement of impending skirmishes", preferredStat: "logic" },
            { name: "Sell to the Raiders", description: "Peddle the troop routes to outlaws for a lucrative purse", preferredStat: "charm" },
            { name: "Ambush the Vanguard", description: "Use the coordinates to set up a devastating surprise ambush", preferredStat: "reflex" }
          ]
        };
      }
    }
  }

  /**
   * Spawns physical tagged props and NPCs distributed across the 256x256 tactical sector.
   * Eliminates hardcoded clustered spawns by spreading landmarks and secondary encounters.
   */
  public injectWorldStateForBeat(beat: StoryBeat, context?: SectorContext): InjectedWorldState {
    this.activeBeat = beat;
    const props: TaggedObject[] = [];
    const npcs: InjectedNPC[] = [];

    const rx = context?.rx ?? 112;
    const ry = context?.ry ?? 112;
    const seedVal = ((context?.cellId ?? 1) * 73856093) ^ (rx * 19349663) ^ (ry * 83492791);
    const rng = new SeededPRNG(seedVal);

    // Coordinate distribution anchors on 256x256 grid
    const centerPOI: [number, number] = [rng.range(124, 134), rng.range(124, 134)];
    const northWestCamp: [number, number] = [rng.range(65, 85), rng.range(70, 90)];
    const southEastStash: [number, number] = [rng.range(170, 195), rng.range(165, 190)];
    const southWestWaypoint: [number, number] = [rng.range(75, 95), rng.range(170, 195)];

    switch (beat.category) {
      case "FOOD_CRISIS": {
        // Site 1: Center Cannibal Granary & Barricade
        props.push(
          TagMatrixEngine.createProp("prop_cannibal_barricade", "Spiked Bone Barricade", centerPOI, ["wood", "bone", "flammable", "cover_heavy", "destructible", "sharp"], 30),
          TagMatrixEngine.createProp("prop_grain_silo", "Ransacked Grain Silo", [centerPOI[0] + 3, centerPOI[1] + 2], ["wood", "heavy", "container", "openable"], 45),
          TagMatrixEngine.createProp("prop_roasting_pit", "Smoldering Roasting Spit", [centerPOI[0] - 2, centerPOI[1] + 3], ["fire", "burning", "metal", "hazard", "hot"], 15)
        );

        npcs.push(
          {
            id: "npc_cannibal_warlord",
            name: `${rng.pick(this.FIRST_NAMES)} Gristle-Jaw`,
            role: "Marauder War Chief",
            pos: [centerPOI[0] + 1, centerPOI[1] - 1],
            tags: ["hostile", "cannibal", "aggressive", "heavy_bludgeon", "organic", "intimidatable", "provokable"],
            faction: "Rot-Tooth Cannibals",
            hp: 35,
            maxHp: 35,
            disposition: -2,
            alive: true
          },
          {
            id: "npc_starving_refugee",
            name: `${rng.pick(this.FIRST_NAMES)} the Captive`,
            role: "Desperate Villager",
            pos: [centerPOI[0] + 4, centerPOI[1] + 3],
            tags: ["captive", "friendly", "frail", "organic", "fearful"],
            faction: "Neutral Folk",
            hp: 10,
            maxHp: 10,
            disposition: 1,
            alive: true
          }
        );

        // Site 2: Northwest Perimeter Guard Post
        props.push(
          TagMatrixEngine.createProp("prop_bone_totem", "Warning Skull Totem", northWestCamp, ["bone", "wood", "fragile"], 12)
        );
        npcs.push({
          id: "npc_perimeter_scavenger",
          name: "Starving Sentry",
          role: "Camp Sentry",
          pos: [northWestCamp[0] + 1, northWestCamp[1]],
          tags: ["hostile", "fearful", "ranged", "leather_armor", "bribeable"],
          faction: "Rot-Tooth Cannibals",
          hp: 16,
          maxHp: 16,
          disposition: -1,
          alive: true
        });

        // Site 3: Southeast Stashed Provisions
        props.push(
          TagMatrixEngine.createProp("prop_hidden_grain_barrel", "Hidden Grain Barrel", southEastStash, ["wood", "container", "openable", "valuable"], 20)
        );
        break;
      }

      case "WARZONE_ASSAULT": {
        // Site 1: Center Command Pavilion
        props.push(
          TagMatrixEngine.createProp("prop_weapons_cache", "Reinforced Munitions Cache", centerPOI, ["wood", "metal", "flammable", "explosive", "container"], 35),
          TagMatrixEngine.createProp("prop_war_tent", "Commander War Pavilion", [centerPOI[0] + 3, centerPOI[1] - 2], ["cloth", "flammable", "cover_light"], 20),
          TagMatrixEngine.createProp("prop_caltrops_line", "Iron Caltrops Barricade", [centerPOI[0] - 2, centerPOI[1] + 2], ["metal", "hazard", "sharp"], 15)
        );

        npcs.push(
          {
            id: "npc_war_commander",
            name: `Commander ${rng.pick(this.FIRST_NAMES)} Vane`,
            role: "Raider Commander",
            pos: [centerPOI[0] + 1, centerPOI[1] - 1],
            tags: ["hostile", "raider", "veteran", "dueling_blades", "metal_plate", "organic", "proud"],
            faction: "Ghostwind Raiders",
            hp: 40,
            maxHp: 40,
            disposition: -2,
            alive: true
          },
          {
            id: "npc_vanguard_crossbow",
            name: "Vanguard Crossbowman",
            role: "Sentry",
            pos: [centerPOI[0] - 3, centerPOI[1]],
            tags: ["hostile", "sentry", "ranged", "leather_armor", "organic"],
            faction: "Ghostwind Raiders",
            hp: 20,
            maxHp: 20,
            disposition: -2,
            alive: true
          }
        );

        // Site 2: Northwest Forward Watchtower
        props.push(
          TagMatrixEngine.createProp("prop_signal_brazier", "Signal Fire Brazier", northWestCamp, ["metal", "burning", "hot", "flammable_fuel"], 20)
        );
        npcs.push({
          id: "npc_forward_sentry",
          name: "Raider Lookout",
          role: "Lookout",
          pos: [northWestCamp[0], northWestCamp[1] + 1],
          tags: ["hostile", "sentry", "alert", "fast"],
          faction: "Ghostwind Raiders",
          hp: 18,
          maxHp: 18,
          disposition: -2,
          alive: true
        });

        // Site 3: Southeast Wounded Courier
        npcs.push({
          id: "npc_wounded_courier",
          name: `${rng.pick(this.FIRST_NAMES)} the Courier`,
          role: "Wounded Scout",
          pos: southEastStash,
          tags: ["friendly", "wounded", "frail", "desperate"],
          faction: "Neutral Folk",
          hp: 8,
          maxHp: 8,
          disposition: 2,
          alive: true
        });
        props.push(
          TagMatrixEngine.createProp("prop_courier_satchel", "Sealed Dispatch Satchel", [southEastStash[0] + 1, southEastStash[1]], ["leather", "locked", "container", "valuable"], 10)
        );
        break;
      }

      case "CHAOS_CORRUPTION": {
        // Site 1: Center Eldritch Blood Altar
        props.push(
          TagMatrixEngine.createProp("prop_blood_altar", "Corrupted Obsidian Altar", centerPOI, ["stone", "burning", "magic_focus", "indestructible", "dark"], 60),
          TagMatrixEngine.createProp("prop_blood_brazier_w", "Cruorbus Flame Brazier (W)", [centerPOI[0] - 3, centerPOI[1]], ["metal", "burning", "hot", "flammable_fuel"], 20),
          TagMatrixEngine.createProp("prop_blood_brazier_e", "Cruorbus Flame Brazier (E)", [centerPOI[0] + 3, centerPOI[1]], ["metal", "burning", "hot", "flammable_fuel"], 20)
        );

        npcs.push(
          {
            id: "npc_high_ritualist",
            name: `Heresiarch ${rng.pick(this.FIRST_NAMES)}`,
            role: "Occult Invocator",
            pos: [centerPOI[0], centerPOI[1] - 2],
            tags: ["hostile", "cultist", "fanatical", "blood_magic", "unyielding", "organic"],
            faction: "Cruorbus Blood Cult",
            hp: 36,
            maxHp: 36,
            disposition: -2,
            alive: true
          },
          {
            id: "npc_cult_acolyte",
            name: "Bleeding Acolyte",
            role: "Fanatic",
            pos: [centerPOI[0] - 2, centerPOI[1] + 1],
            tags: ["hostile", "cultist", "fanatical", "dagger", "organic", "fearful"],
            faction: "Cruorbus Blood Cult",
            hp: 18,
            maxHp: 18,
            disposition: -2,
            alive: true
          }
        );

        // Site 2: Northwest Cleansed Warden Monolith
        props.push(
          TagMatrixEngine.createProp("prop_warden_monolith", "Ancient Runic Wardstone", northWestCamp, ["stone", "magic", "sacred", "heavy"], 80)
        );

        // Site 3: Southeast Void Reliquary
        props.push(
          TagMatrixEngine.createProp("prop_void_reliquary", "Chained Void Reliquary", southEastStash, ["metal", "locked", "valuable", "dark", "container"], 25)
        );
        break;
      }

      case "CRIME_SYNDICATE": {
        // Site 1: Center Vice Den & Lockbox
        props.push(
          TagMatrixEngine.createProp("prop_syndicate_lockbox", "Iron Syndicate Strongbox", centerPOI, ["metal", "locked", "valuable", "container", "openable"], 30),
          TagMatrixEngine.createProp("prop_gambling_table", "Dice & Ledger Table", [centerPOI[0] + 2, centerPOI[1] - 1], ["wood", "movable", "flammable"], 15),
          TagMatrixEngine.createProp("prop_moonshine_cask", "Distilled Narcotic Barrel", [centerPOI[0] - 2, centerPOI[1] + 1], ["wood", "flammable", "explosive", "container"], 20)
        );

        npcs.push(
          {
            id: "npc_syndicate_enforcer",
            name: `${rng.pick(this.FIRST_NAMES)} the Skinner`,
            role: "Cartel Underboss",
            pos: [centerPOI[0], centerPOI[1] + 1],
            tags: ["hostile", "greedy", "bribeable", "intimidatable", "bludgeon", "organic"],
            faction: "Fulcrum Smuggler Ring",
            hp: 32,
            maxHp: 32,
            disposition: -1,
            alive: true
          },
          {
            id: "npc_syndicate_fence",
            name: `${rng.pick(this.FIRST_NAMES)} the Broker`,
            role: "Black Market Merchant",
            pos: [centerPOI[0] + 2, centerPOI[1]],
            tags: ["neutral", "merchant", "greedy", "bribeable", "frail"],
            faction: "Fulcrum Smuggler Ring",
            hp: 14,
            maxHp: 14,
            disposition: 0,
            alive: true
          }
        );

        // Site 2: Northwest Lookout Post
        npcs.push({
          id: "npc_cartel_lookout",
          name: "Rooftop Sentry",
          role: "Lookout",
          pos: northWestCamp,
          tags: ["hostile", "alert", "ranged", "sentry"],
          faction: "Fulcrum Smuggler Ring",
          hp: 16,
          maxHp: 16,
          disposition: -1,
          alive: true
        });
        break;
      }

      case "BEAST_INCURSION": {
        // Site 1: Apex Beast Lair
        props.push(
          TagMatrixEngine.createProp("prop_bone_totem", "Gnawed Beast Den Cairn", centerPOI, ["bone", "stone", "destructible", "hazard"], 35),
          TagMatrixEngine.createProp("prop_prey_carcass", "Freshly Slain Elk Carcass", [centerPOI[0] + 2, centerPOI[1]], ["organic", "frail", "meat", "flammable"], 15)
        );

        npcs.push(
          {
            id: "npc_apex_beast",
            name: `Gore-Tusk Dire ${context?.biomeName.includes("Forest") ? "Boar" : "Stalker"}`,
            role: "Apex Predator",
            pos: [centerPOI[0] - 1, centerPOI[1] - 1],
            tags: ["hostile", "beast", "aggressive", "sharp_claws", "unyielding", "organic"],
            faction: "Wild Dire Beasts",
            hp: 42,
            maxHp: 42,
            disposition: -2,
            alive: true
          },
          {
            id: "npc_stalker_packmate",
            name: "Dire Stalker Packmate",
            role: "Pack Beast",
            pos: [centerPOI[0] + 2, centerPOI[1] + 2],
            tags: ["hostile", "beast", "fast", "pack_tactics", "organic"],
            faction: "Wild Dire Beasts",
            hp: 20,
            maxHp: 20,
            disposition: -2,
            alive: true
          }
        );

        // Site 2: Northwest Trapper Hide
        props.push(
          TagMatrixEngine.createProp("prop_bear_trap", "Concealed Steel Snare", northWestCamp, ["metal", "sharp", "hazard", "fragile"], 10)
        );
        break;
      }

      case "TRADE_AMBUSH": {
        // Site 1: Overturned Wagon
        props.push(
          TagMatrixEngine.createProp("prop_trade_wagon", "Overturned Merchant Freight Wagon", centerPOI, ["wood", "metal", "heavy", "container", "openable", "flammable"], 45),
          TagMatrixEngine.createProp("prop_scattered_crates", "Shattered Trade Crates", [centerPOI[0] + 2, centerPOI[1] + 1], ["wood", "fragile", "container", "openable"], 15)
        );

        npcs.push(
          {
            id: "npc_outlaw_chief",
            name: `${rng.pick(this.FIRST_NAMES)} Highway-Bane`,
            role: "Outlaw Highwayman",
            pos: [centerPOI[0] - 1, centerPOI[1]],
            tags: ["hostile", "outlaw", "greedy", "bribeable", "dueling_blades"],
            faction: "Highway Outlaws",
            hp: 30,
            maxHp: 30,
            disposition: -2,
            alive: true
          },
          {
            id: "npc_stranded_merchant",
            name: `Factor ${rng.pick(this.FIRST_NAMES)}`,
            role: "Caravan Factor",
            pos: [centerPOI[0] + 3, centerPOI[1] - 1],
            tags: ["friendly", "merchant", "fearful", "wealthy"],
            faction: "Neutral Folk",
            hp: 12,
            maxHp: 12,
            disposition: 2,
            alive: true
          }
        );

        // Site 2: Northwest Ambush Picket
        npcs.push({
          id: "npc_highway_archer",
          name: "Tree-Line Archer",
          role: "Sentry",
          pos: northWestCamp,
          tags: ["hostile", "ranged", "sentry"],
          faction: "Highway Outlaws",
          hp: 18,
          maxHp: 18,
          disposition: -2,
          alive: true
        });
        break;
      }

      case "ANCIENT_EXPEDITION": {
        // Site 1: Sunken Crypt & Sarcophagus
        props.push(
          TagMatrixEngine.createProp("prop_ancient_sarcophagus", "Sealed First Era Sarcophagus", centerPOI, ["stone", "heavy", "locked", "ancient", "container", "openable"], 50),
          TagMatrixEngine.createProp("prop_runic_monolith", "Weathered Leyline Monolith", [centerPOI[0] - 3, centerPOI[1]], ["stone", "magic", "mystic", "indestructible"], 100),
          TagMatrixEngine.createProp("prop_crypt_brazier", "Cold-Fire Crypt Brazier", [centerPOI[0] + 3, centerPOI[1]], ["metal", "cold", "magic", "light"], 25)
        );

        npcs.push(
          {
            id: "npc_tomb_guardian",
            name: "Automaton Sentry",
            role: "Construct Guardian",
            pos: [centerPOI[0], centerPOI[1] - 2],
            tags: ["hostile", "construct", "metal_armor", "unyielding", "magic_conductive"],
            faction: "Tomb Guardians",
            hp: 45,
            maxHp: 45,
            disposition: -2,
            alive: true
          },
          {
            id: "npc_antiquarian_scout",
            name: `${rng.pick(this.FIRST_NAMES)} the Scribe`,
            role: "Scholar",
            pos: [centerPOI[0] + 4, centerPOI[1] + 2],
            tags: ["friendly", "scholar", "knowledge", "frail"],
            faction: "Scholars of the Spire",
            hp: 10,
            maxHp: 10,
            disposition: 1,
            alive: true
          }
        );

        // Site 3: Southeast Forgotten Reliquary
        props.push(
          TagMatrixEngine.createProp("prop_sunken_chest", "Verdigris Bronze Chest", southEastStash, ["metal", "locked", "valuable", "ancient", "container", "openable"], 30)
        );
        break;
      }

      default: {
        // Standard Wilderness Scout
        props.push(
          TagMatrixEngine.createProp("prop_runic_monolith", "Runic Standing Monolith", centerPOI, ["stone", "ancient", "mystic", "impassable"], 100),
          TagMatrixEngine.createProp("prop_smuggler_cache", "Hidden Mossy Strongbox", [centerPOI[0] + 3, centerPOI[1] - 1], ["metal", "locked", "valuable", "container", "openable"], 25),
          TagMatrixEngine.createProp("prop_hunter_fire", "Stone Fire Hearth", [centerPOI[0] - 2, centerPOI[1] + 2], ["fire", "burning", "heat", "light"], 15)
        );

        npcs.push(
          {
            id: "npc_solitary_hunter",
            name: `${rng.pick(this.FIRST_NAMES)} the Trapper`,
            role: "Frontier Guide",
            pos: [centerPOI[0] - 1, centerPOI[1] + 1],
            tags: ["neutral", "hunter", "leather_armor", "bow", "organic", "bribeable", "talkative"],
            faction: "Frontier Guild",
            hp: 22,
            maxHp: 22,
            disposition: 1,
            alive: true
          }
        );

        // Site 2: Northwest Abandoned Lean-To
        props.push(
          TagMatrixEngine.createProp("prop_scout_lean_to", "Weathered Pine Lean-To", northWestCamp, ["wood", "cloth", "flammable", "cover_light"], 20)
        );

        // Site 4: Southwest Wild Game Roost
        props.push(
          TagMatrixEngine.createProp("prop_wild_snare", "Iron Spring Snare", southWestWaypoint, ["metal", "hazard", "sharp"], 10)
        );
        break;
      }
    }

    // Dynamic 12-stat weapon & armor equipment assignment for every spawned NPC
    npcs.forEach(npc => {
      let affinity: StatKey = "might";
      const tags = npc.tags;
      if (tags.includes("ranged") || tags.includes("alert")) affinity = "awareness";
      else if (tags.includes("cultist") || tags.includes("magic_focus") || tags.includes("occult")) affinity = "willpower";
      else if (tags.includes("fast") || tags.includes("dueling_blades") || tags.includes("dagger")) affinity = "finesse";
      else if (tags.includes("heavy_bludgeon") || tags.includes("cannibal") || tags.includes("marauder")) affinity = "might";
      else if (tags.includes("metal_plate") || tags.includes("phalanx") || tags.includes("guardian")) affinity = "fortitude";
      else if (tags.includes("bribeable") || tags.includes("merchant") || tags.includes("syndicate")) affinity = "charm";
      else if (tags.includes("automaton") || tags.includes("golem")) affinity = "logic";
      else if (tags.includes("beast") || tags.includes("predator")) affinity = "reflex";
      else if (tags.includes("frail") || tags.includes("scout") || tags.includes("courier")) affinity = "vitality";

      let defAffinity: StatKey = "endurance";
      if (tags.includes("metal_plate") || tags.includes("guardian")) defAffinity = "fortitude";
      else if (tags.includes("leather_armor") || tags.includes("fast")) defAffinity = "reflex";
      else if (tags.includes("unyielding") || tags.includes("fanatical") || tags.includes("cultist")) defAffinity = "willpower";
      else if (tags.includes("frail")) defAffinity = "vitality";

      npc.statAffinity = affinity;
      npc.equippedWeapon = getRandomWeaponForStat(affinity).name;
      npc.equippedArmor = getRandomArmorForStat(defAffinity).name;
      npc.stats = {
        might: 4, endurance: 4, finesse: 4, reflex: 4, vitality: 4, fortitude: 4,
        knowledge: 4, logic: 4, awareness: 4, intuition: 4, charm: 4, willpower: 4
      };
      (npc.stats as any)[affinity] = 6;
      (npc.stats as any)[defAffinity] = 5;
    });

    return { props, npcs, activeBeat: beat };
  }

  /**
   * Updates objective progress and checks if a StoryBeat is completed.
   */
  public updateObjective(targetId: string, amount: number = 1): { beatCompleted: boolean; updatedObjective?: QuestObjective | undefined } {
    if (!this.activeBeat) return { beatCompleted: false };

    let updatedObjective: QuestObjective | undefined;

    for (const obj of this.activeBeat.objectives) {
      if (obj.targetId === targetId && !obj.completed) {
        obj.currentCount += amount;
        if (obj.currentCount >= obj.requiredCount) {
          obj.completed = true;
        }
        updatedObjective = obj;
        break;
      }
    }

    const allDone = this.activeBeat.objectives.every(o => o.completed);
    if (allDone) {
      this.completedBeats.push(this.activeBeat);
      // Advance Act every 2 completed beats
      if (this.completedBeats.length % 2 === 0 && this.currentActIndex < this.ACTS.length - 1) {
        this.currentActIndex++;
      }
      return { beatCompleted: true, updatedObjective };
    }

    return { beatCompleted: false, updatedObjective };
  }
}
