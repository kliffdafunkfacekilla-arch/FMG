/**
 * GOOGLE DEEPMIND CONCORDIA-INSPIRED GAME MASTER (ECGM)
 * =====================================================
 * Implements the Entity-Component Game Master loop from Concordia (arXiv:2507.08892):
 * - Observation Component: Grounded sensory filter
 * - Intent & Plausibility Component: Anti-hallucination tag & 12-stat validation
 * - Social & Dialogue Component: In-character roleplay & disposition tracking
 * - Physical & Elemental Component: Tag cascades and structural damage
 * - Subterfuge & Exploration Component: Lockpicking, resting, and loot discovery
 * - State Mutation Component: Physical/social updates + PostgreSQL backfeed
 * - Associative Memory Component: Episodic logging and disposition shifts
 * - Narrative Observation Component: Grounded sensory outcome generation
 */

import { GoogleGenAI } from "@google/genai";
import { Pool } from "pg";
import { TagMatrixEngine, TaggedObject, TagInteractionResult } from "./TagMatrixEngine.js";
import { WhatElseStoryEngine, StoryBeat, SectorContext, InjectedNPC, InjectedWorldState } from "./WhatElseStoryEngine.js";
import { resolveMeleeAttack, resolveOpposedCombat } from "./RulesEngine.js";
import { getWeapon, getArmor, StatKey, WeaponDef, ArmorDef } from "./EquipmentRegistry.js";
import { getSocialWeapon, getSocialArmor, SocialWeaponDef, SocialArmorDef } from "./SocialEquipmentRegistry.js";
import { resolveOpposedSocialContest, resolveCosmicDreadCheck, SocialCombatant } from "../socialCombat.js";
import { computeActionDC, ATOMIC_TAG_ACTIONS } from "./TagRegistry.js";
import { ProceduralNPCGenerator, SeededPRNG } from "./ProceduralNPCGenerator.js";
import { getActiveChaosFlows, evaluatePointChaosFlowProximity, applyPlayerChaosMutation } from "../agents/chaosFlowAgent.js";
import { generateChaosSurge } from "./chaosSurgeEngine.js";

export interface ActionInput {
  actionText: string;
  playerId: number;
  playerPos: [number, number];
  coverBonus?: number | undefined;
  coverLevel?: ("NONE" | "HALF" | "FULL") | undefined;
  combatType?: ("melee" | "ranged") | undefined;
  isStealthed?: boolean | undefined;
  sneakAttack?: boolean | undefined;
}

export type ActionCategory = "COMBAT" | "MAGIC" | "SOCIAL" | "SUBTERFUGE" | "EXPLORATION" | "SURVIVAL" | "CREATIVE_CHECK";

export interface ParsedIntent {
  category: ActionCategory;
  verb: string;
  targetId: string;
  targetName: string;
  statUsed: string;
  isCombat: boolean;
}

export interface GMResolutionOutput {
  success: boolean;
  intent: ParsedIntent;
  rollOutcome: {
    playerRoll: number;
    playerStatVal: number;
    dcOrDefenderRoll: number;
    difference: number;
    injuryPoints: number;
    hit: boolean;
    attackerRoll?: number;
    attackerStatKey?: string;
    attackerStatVal?: number;
    attackerMod?: number;
    attackerTotal?: number;
    defenderRoll?: number;
    defenderStatKey?: string;
    defenderStatVal?: number;
    defenderMod?: number;
    defenderTotal?: number;
    coverBonus?: number;
    coverLevel?: string;
    weaponName?: string;
    armorName?: string;
  };
  tagResult?: TagInteractionResult | undefined;
  systemLog: string;
  narrativeResponse: string;
  dialogue?: string | undefined;
  lootAwarded?: {
    gold: number;
    item?: string | undefined;
  } | undefined;
  objectiveProgress?: {
    beatCompleted: boolean;
    description?: string | undefined;
  };
  campaignState: any;
  worldDelta: {
    propsDestroyed: string[];
    npcsDefeated: string[];
  };
}

export class ConcordiaGameMaster {
  private pool: Pool;
  private ai: GoogleGenAI;
  private storyEngine: WhatElseStoryEngine;
  private memoryStream: Array<{ timestamp: number; summary: string; tags: string[] }> = [];

  // Grounded World Entities currently active in sector
  private activeProps: Map<string, TaggedObject> = new Map();
  private activeNPCs: Map<string, InjectedNPC> = new Map();
  private activeContext: SectorContext | null = null;

  // Tried in order. Gemini 1.5/2.0 are shut down and 2.5 is being retired, so
  // "gemini-flash-latest" stays last as an alias Google keeps pointed at a live model.
  private readonly CANDIDATE_MODELS = [
    "gemini-3.5-flash",
    "gemini-3.1-flash-lite",
    "gemini-flash-latest"
  ];
  private warnedInvalidKey = false;

  constructor(pool: Pool, apiKey: string) {
    this.pool = pool;
    this.ai = new GoogleGenAI({ apiKey: apiKey || "" });
    this.storyEngine = new WhatElseStoryEngine();
  }

  public getStoryEngine(): WhatElseStoryEngine {
    return this.storyEngine;
  }

  /**
   * Loads or switches sector state with WhatELSE world injection and PostgreSQL persistence.
   */
  public async loadSector(context: SectorContext, worldTick?: number): Promise<InjectedWorldState> {
    this.activeContext = context;
    const rx = context.rx ?? 105;
    const ry = context.ry ?? 112;
    const cellId = context.cellId ?? 13408;

    // Resolve current world tick if not provided
    let tick = worldTick ?? 0;
    if (worldTick === undefined) {
      try {
        const tickRes = await this.pool.query("SELECT MAX(tick) AS max_tick FROM sim_events");
        if (tickRes.rows.length > 0 && tickRes.rows[0].max_tick != null) {
          tick = Number(tickRes.rows[0].max_tick);
        }
      } catch (err) {
        // Fallback to 0 if table empty or query fails
      }
    }

    // Populate cosmological data from sim_calendar if not provided in context
    try {
      const calRes = await this.pool.query(
        "SELECT month, moon_phase, active_flow, dragon_domain, is_eclipse FROM sim_calendar ORDER BY id DESC LIMIT 1"
      );
      if (calRes.rows.length > 0) {
        const cal = calRes.rows[0];
        context.activeFlow = context.activeFlow || cal.active_flow;
        context.dragonDomain = context.dragonDomain || cal.dragon_domain;
        context.moonPhase = context.moonPhase || cal.moon_phase;
        if (cal.month === 13 || cal.is_eclipse || cal.moon_phase?.includes("Nightmare") || cal.moon_phase?.includes("Full Blood")) {
          context.chaosRadiation = Math.max(context.chaosRadiation || 0, 0.85);
          (context as any).isEclipse = true;
        }
      }
    } catch (err) {}

    // Option 4: Query Live Burg Economy (Famine, Food Stockpile & Unrest Telemetry)
    try {
      const burgRes = await this.pool.query(
        `SELECT b.burg_id, b.name, b.food, b.wealth, b.unrest, b.crime_rate 
         FROM sim_burg_economy b
         ORDER BY ABS(b.cell_id - $1) ASC LIMIT 1`,
        [cellId]
      );
      if (burgRes.rows.length > 0) {
        const nearestBurg = burgRes.rows[0];
        (context as any).nearestBurg = nearestBurg.name;
        context.crimeRate = Number(nearestBurg.crime_rate) || context.crimeRate || 0;
        if (Number(nearestBurg.food) < 60 || Number(nearestBurg.unrest) > 40) {
          context.isFamine = true;
        }
      }
    } catch (err) {}

    // Option 4: Query Live Faction Geopolitics (Active Warzone Frontline Telemetry)
    try {
      const warRes = await this.pool.query(
        `SELECT fw.attacker_faction_id, fw.defender_faction_id, f1.name as f1_name, f2.name as f2_name
         FROM sim_faction_wars fw
         JOIN sim_factions f1 ON fw.attacker_faction_id = f1.id
         JOIN sim_factions f2 ON fw.defender_faction_id = f2.id
         WHERE fw.is_active = true
         LIMIT 1`
      );
      if (warRes.rows.length > 0) {
        context.isWarzone = true;
        (context as any).warringFactions = `${warRes.rows[0].f1_name} vs ${warRes.rows[0].f2_name}`;
      }
    } catch (err) {}



    // 1. Fetch persisted NPCs from sim_npc_instances for this sector
    let persistedNPCs: InjectedNPC[] = [];
    try {
      const rows = await this.pool.query(
        `SELECT * FROM sim_npc_instances WHERE cell_id = $1 AND current_rx = $2 AND current_ry = $3`,
        [cellId, rx, ry]
      );
      if (rows.rows.length > 0) {
        persistedNPCs = rows.rows.map((r: any) => ({
          id: r.id,
          name: r.name,
          role: r.role,
          pos: [r.local_pos[0], r.local_pos[1]] as [number, number],
          tags: Array.isArray(r.tags) ? r.tags : (typeof r.tags === "string" ? JSON.parse(r.tags) : []),
          hp: r.hp,
          maxHp: r.max_hp,
          disposition: r.disposition,
          faction: r.faction,
          alive: r.alive,
          equippedWeapon: r.equipped_weapon || undefined,
          equippedArmor: r.equipped_armor || undefined,
          statAffinity: r.stat_affinity || undefined,
          stats: typeof r.stats === "string" ? JSON.parse(r.stats) : r.stats,
          kingdom: r.kingdom || undefined,
          species: r.species || undefined,
          lineage: r.lineage || undefined,
          inventory: Array.isArray(r.inventory) ? r.inventory : (typeof r.inventory === "string" ? JSON.parse(r.inventory) : []),
          memoryNotes: Array.isArray(r.memory_notes) ? r.memory_notes : (typeof r.memory_notes === "string" ? JSON.parse(r.memory_notes) : []),
          homePos: r.home_pos ? [r.home_pos[0], r.home_pos[1]] : undefined,
          workPos: r.work_pos ? [r.work_pos[0], r.work_pos[1]] : undefined,
          currentTask: r.current_task || undefined,
          targetDestination: r.target_destination ? [r.target_destination[0], r.target_destination[1]] : undefined,
          scheduleState: r.schedule_state || "WORK"
        }));
      }
    } catch (err) {
      console.error("Error querying persisted NPCs:", err);
    }

    // Query Live Primordial Chaos Flow Proximity & Ambient Chaos Surges
    try {
      const cellCoordRes = await this.pool.query(
        "SELECT center_x, center_y FROM sim_cells WHERE id = $1",
        [cellId]
      );
      const cx = Number(cellCoordRes.rows[0]?.center_x) || 1409;
      const cy = Number(cellCoordRes.rows[0]?.center_y) || 740;
      const flows = await getActiveChaosFlows(this.pool);
      const flowProximity = evaluatePointChaosFlowProximity(cx, cy, flows);
      context.chaosFlow = flowProximity;

      if (flowProximity.intersected || flowProximity.isAdjacent) {
        context.chaosRadiation = Math.max(context.chaosRadiation || 0, flowProximity.ambientChaos);

        // Generate dynamic wild chaos surge & environmental ripples
        const surge = generateChaosSurge(
          flowProximity.nearestFlow?.elementalPower || "Flux",
          flowProximity.ambientChaos,
          Array.from(this.activeProps.values()).map(p => ({ id: p.id, name: p.name })),
          persistedNPCs.map(n => ({ id: n.id, name: n.name }))
        );
        (context as any).activeSurge = surge;

        // Inject the Surge Anomaly Prop
        const anomalyProp: TaggedObject = {
          id: `prop_chaos_anomaly_${cellId}`,
          name: surge.activeSurge.name,
          type: "PROP",
          pos: [134, 128],
          tags: new Set<string>(["chaos_surge", "aether", "hazard", surge.activeSurge.tier.toLowerCase()]),
          hp: 50,
          maxHp: 50,
          isDestroyed: false,
          description: `${surge.activeSurge.headline} ${surge.activeSurge.description}`
        };
        this.activeProps.set(anomalyProp.id, anomalyProp);

        // High likelihood of Cultist or Grey Warden encounter in adjacent / flow cells
        if (Math.random() < 0.45 && !persistedNPCs.some(n => n.role.includes("Cultist") || n.role.includes("Warden"))) {
          const isCultist = Math.random() < 0.55;
          const factionName = isCultist ? "Chaos Cultist Covenant" : "The Grey Wardens";
          const encounterNPC: InjectedNPC = {
            id: `npc_ley_${isCultist ? "cultist" : "warden"}_${Date.now()}`,
            name: isCultist ? `Cultist Zealot of ${flowProximity.nearestFlow?.dragonName || "Chaos"}` : "Grey Warden Ley-Vigilant",
            role: isCultist ? "Chaos Cultist" : "Grey Warden Sentinel",
            pos: [126, 126],
            tags: [isCultist ? "cultist" : "warden", "humanoid", "magic", "armed"],
            faction: factionName,
            hp: isCultist ? 18 : 26,
            maxHp: isCultist ? 18 : 26,
            disposition: isCultist ? -2 : 1,
            alive: true,
            equippedWeapon: isCultist ? "Void Runic Dagger" : "Sun-Forged Halberd",
            equippedArmor: isCultist ? "Silk Cultist Vestments" : "Steel Plated Cuirass",
            statAffinity: isCultist ? "willpower" : "might",
            inventory: isCultist ? ["Forbidden Dragon Effigy", "Blackstone Shard"] : ["Warden Binding Ward", "Healing Draught"]
          };
          persistedNPCs.push(encounterNPC);
        }

        // Inject Ford Prop if at narrow constriction
        if (flowProximity.nearNarrowSpot && flowProximity.narrowSpot) {
          const fordProp: TaggedObject = {
            id: `prop_chaos_ford_${cellId}`,
            name: `The Narrow Ford of ${flowProximity.nearestFlow?.dragonName || "Chaos"}`,
            type: "PROP",
            pos: [128, 128],
            tags: new Set<string>(["stone", "chasm", "narrow_ford", "chaos_crossing", "stepping_stones"]),
            hp: 200,
            maxHp: 200,
            isDestroyed: false,
            description: flowProximity.narrowSpot.description
          };
          this.activeProps.set(fordProp.id, fordProp);
        }

        // Inject Roaring Flow Prop
        const currentFlow = flowProximity.nearestFlow;
        const flowProp: TaggedObject = {
          id: `prop_chaos_flow_${cellId}`,
          name: `Roaring Cataract of ${currentFlow?.name || "Primordial Chaos"}`,
          type: "PROP",
          pos: [142, 128],
          tags: new Set<string>(["chaos_flow", "hazard", "deadly", "aether", "primordial"]),
          hp: 99999,
          maxHp: 99999,
          isDestroyed: false,
          description: `A churning channel of raw ${currentFlow?.elementalPower || "Chaos"} aether (${currentFlow?.currentWidth || 30}m wide, Surge x${currentFlow?.currentSurge || 1.0}). Ground crossing is deadly unless braving the narrow ford; safe by airship.`
        };
        this.activeProps.set(flowProp.id, flowProp);
      }
    } catch (err) {
      console.warn("Could not query chaos flows in loadSector:", err);
    }

    const seedVal = (cellId * 73856093) ^ (rx * 19349663) ^ (ry * 83492791);
    const beat = this.storyEngine.generateBeatFromSector(context);

    // Synthesize real-time emergent situation using Gemini AI (with deterministic fallback)
    let parsedEmergentProps: any[] = [];
    let parsedEmergentNPCs: any[] = [];
    try {
      const activeLife = (context.entitiesPresent || []).map(e => `${e.type} (${e.state})`).join(", ");
      const prompt = `LIVE SIMULATION CONTEXT:
Sector Coordinates: (${rx}, ${ry}) in Cell ${cellId}
Biome: ${context.biomeName || "Wilderness"}
Active Cosmic Chaos Flow: ${context.activeFlow || "Ordo"} (Cruorbus Phase: ${context.moonPhase || "Gibbous"})
Dragon Domain: ${context.dragonDomain || "Stagus"}
Sovereignty: ${context.factionOwner || "Frontier Wilds"}
Warzone Status: ${context.isWarzone ? "Active Warzone Frontline" : "Peacetime Border"}
Famine Status: ${context.isFamine ? "Severe Famine / Starvation" : "Stable Agriculture"}
Provincial Crime Rate: ${context.crimeRate || 0}%
Infrastructure Mask: ${context.infrastructureMask || 0}
Roaming Life in Sector: ${activeLife || "Indigenous beasts & wayfarers"}

You are the Master Story Director for a completely unscripted, dynamic dark-fantasy sandbox simulation.
The player has just stepped into this sector. DO NOT use cliché tropes or predetermined scripts.
Synthesize an authentic, unexpected, living emergent moment occurring right now that organically erupts from the collision of these live simulation pressures (cosmic chaos flow + dragon seal resonance + provincial famine + roaming factions/creatures).

Return ONLY valid JSON matching this schema:
{
  "title": "<3 to 6 word situational title>",
  "hook": "<2 to 3 vivid sentences describing what is happening right now in sensory detail>",
  "pivotDecision": "<1 sentence presenting the immediate tactical, moral, or survival dilemma>",
  "emergentProps": [
    {
      "name": "<name of interactive physical object/landmark>",
      "tags": ["<tag1>", "<tag2>", "<tag3>"],
      "hp": 25,
      "description": "<short physical description>"
    }
  ],
  "emergentNPCs": [
    {
      "name": "<name and epithet>",
      "role": "<situational role>",
      "tags": ["<tag1>", "<tag2>", "<tag3>"],
      "disposition": -1,
      "primaryStat": "might|finesse|reflex|endurance|willpower|charm",
      "equippedWeapon": "<weapon>",
      "equippedArmor": "<armor>",
      "inventory": ["<item1>", "<item2>"]
    }
  ],
  "leads": [
    "<immediate tactical/discovery opportunity 1>",
    "<immediate tactical/discovery opportunity 2>"
  ]
}`;

      const aiJson = await this.callGeminiWithFallback(
        [{ role: "user", parts: [{ text: prompt }] }],
        "You are the Concordia Game Master for a living simulation sandbox RPG. Output valid JSON only, no markdown formatting.",
        500,
        0.8
      );

      if (aiJson) {
        const clean = aiJson.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(clean);
        if (parsed.title && typeof parsed.title === "string") {
          beat.title = parsed.title;
        }
        if (parsed.hook && typeof parsed.hook === "string") {
          beat.hook = parsed.hook;
        }
        if (parsed.pivotDecision && typeof parsed.pivotDecision === "string") {
          beat.pivotDecision = parsed.pivotDecision;
        }
        if (Array.isArray(parsed.leads) && parsed.leads.length > 0) {
          beat.objectives = parsed.leads.map((lead: string, idx: number) => ({
            id: `lead_${rx}_${ry}_${idx}`,
            type: "EXPLORE_POI",
            description: lead,
            targetId: `target_lead_${idx}`,
            requiredCount: 1,
            currentCount: 0,
            completed: false
          }));
        }
        if (Array.isArray(parsed.emergentProps)) {
          parsedEmergentProps = parsed.emergentProps;
        }
        if (Array.isArray(parsed.emergentNPCs)) {
          parsedEmergentNPCs = parsed.emergentNPCs;
        }
      }
    } catch (aiErr) {
      // Deterministic algorithmic beat serves as seamless fallback
    }

    const injected = this.storyEngine.injectWorldStateForBeat(beat, context, persistedNPCs, tick);

    // Inject AI-synthesized emergent props onto the 256x256 grid
    if (parsedEmergentProps.length > 0) {
      parsedEmergentProps.forEach((ep: any, idx: number) => {
        if (!ep.name || !Array.isArray(ep.tags)) return;
        const pId = `prop_emergent_${rx}_${ry}_${idx}`;
        const pPos: [number, number] = [
          Math.min(240, Math.max(15, 128 + ((idx % 2 === 0 ? 1 : -1) * (18 + idx * 14)))),
          Math.min(240, Math.max(15, 128 + ((idx % 3 === 0 ? 1 : -1) * (15 + idx * 12))))
        ];
        const prop = TagMatrixEngine.createProp(
          pId,
          ep.name,
          pPos,
          ep.tags,
          ep.hp || 25
        );
        injected.props.push(prop);
      });
    }

    // Inject AI-synthesized emergent NPCs onto the grid if not already populated with persisted NPCs
    if (persistedNPCs.length === 0 && parsedEmergentNPCs.length > 0) {
      parsedEmergentNPCs.forEach((en: any, idx: number) => {
        if (!en.name || !en.role) return;
        const nId = `npc_emergent_${cellId}_${rx}_${ry}_${idx}`;
        const nPos: [number, number] = [
          Math.min(240, Math.max(15, 132 + ((idx % 2 === 0 ? 1 : -1) * (14 + idx * 10)))),
          Math.min(240, Math.max(15, 132 + ((idx % 3 === 0 ? 1 : -1) * (12 + idx * 12))))
        ];
        const statKey: StatKey = (en.primaryStat || "might") as StatKey;
        const subRng = new SeededPRNG(seedVal + idx * 83);
        const stats = ProceduralNPCGenerator.generateStatsForProfile(statKey, "endurance", subRng);
        const maxHp = 16 + (stats.vitality || 5) + (stats.endurance || 5);
        const npcObj: InjectedNPC = {
          id: nId,
          name: en.name,
          role: en.role,
          pos: nPos,
          tags: Array.isArray(en.tags) ? en.tags : ["human", "organic"],
          faction: context.factionOwner || "Frontier",
          hp: maxHp,
          maxHp,
          disposition: typeof en.disposition === "number" ? en.disposition : -1,
          alive: true,
          equippedWeapon: en.equippedWeapon || "Workday Blade",
          equippedArmor: en.equippedArmor || "Padded Gambeson",
          statAffinity: statKey,
          stats,
          kingdom: "Mammal",
          species: "Human",
          inventory: Array.isArray(en.inventory) ? en.inventory : ["Trail Provisions"]
        };
        injected.npcs.push(npcObj);
      });
    }

    // Option 4: Living Planetary Simulation Backfeed Injections
    if (context.isWarzone) {
      // Frontline barricade & vanguard soldier
      injected.props.push(TagMatrixEngine.createProp(
        `prop_warzone_barricade_${rx}_${ry}`,
        "Frontline Spiked Barricade",
        [135, 126],
        ["wood", "spikes", "cover_heavy", "barrier", "flammable"],
        30
      ));
      if (!injected.npcs.some(n => n.role?.includes("Vanguard") || n.role?.includes("Soldier"))) {
        injected.npcs.push({
          id: `npc_vanguard_${cellId}_${rx}_${ry}`,
          name: "Vanguard Line Outrider",
          role: "Faction Skirmisher",
          pos: [136, 128],
          tags: ["human", "soldier", "vanguard", "armed"],
          faction: (context as any).warringFactions?.split(" vs ")?.[0] || "Border Guard",
          hp: 22,
          maxHp: 22,
          disposition: -2,
          alive: true,
          equippedWeapon: "Titanium Bastion Spear",
          equippedArmor: "Glacial Iron Hauberk",
          statAffinity: "finesse",
          stats: { might: 7, finesse: 8, reflex: 6, endurance: 6, vitality: 6, fortitude: 5, knowledge: 4, logic: 4, awareness: 7, intuition: 5, charm: 4, willpower: 5 },
          kingdom: "Mammal",
          species: "Human",
          inventory: ["Frontline Rations", "Iron Dagger"]
        });
      }
    }

    if (context.isFamine) {
      // Pillaged grain cart & starving bread rioter
      injected.props.push(TagMatrixEngine.createProp(
        `prop_famine_cart_${rx}_${ry}`,
        "Pillaged Grain Wagon",
        [122, 132],
        ["wood", "container", "ruined", "flammable"],
        20
      ));
      if (!injected.npcs.some(n => n.tags?.includes("raider") || n.tags?.includes("starving"))) {
        injected.npcs.push({
          id: `npc_famine_raider_${cellId}_${rx}_${ry}`,
          name: "Starving Bread-Rioter",
          role: "Desperate Outlaw",
          pos: [120, 134],
          tags: ["human", "raider", "starving", "desperate"],
          faction: "Disenfranchised Peasants",
          hp: 14,
          maxHp: 14,
          disposition: -1,
          alive: true,
          equippedWeapon: "Workday Blade",
          equippedArmor: "Padded Gambeson",
          statAffinity: "might",
          stats: { might: 6, finesse: 5, reflex: 5, endurance: 4, vitality: 4, fortitude: 4, knowledge: 4, logic: 4, awareness: 5, intuition: 5, charm: 3, willpower: 6 },
          kingdom: "Mammal",
          species: "Human",
          inventory: ["Moldy Crusts", "Crude Shank"]
        });
      }
    }

    if ((context.chaosRadiation || 0) >= 0.7) {
      // Cruorbus Blood-Altar & Dark Cultist
      injected.props.push(TagMatrixEngine.createProp(
        `prop_blood_altar_${rx}_${ry}`,
        "Blood-Altar of Lophex",
        [128, 120],
        ["stone", "altar", "magic", "runes", "unholy"],
        45
      ));
      if (!injected.npcs.some(n => n.tags?.includes("cultist"))) {
        injected.npcs.push({
          id: `npc_blood_cultist_${cellId}_${rx}_${ry}`,
          name: "Cruorbus Blood-Cultist",
          role: "Chaos Zealot",
          pos: [129, 122],
          tags: ["human", "cultist", "magic", "chaos", "fanatical"],
          faction: "Order of the Bleeding Eye",
          hp: 18,
          maxHp: 18,
          disposition: -2,
          alive: true,
          equippedWeapon: "Cursed Bone Wand",
          equippedArmor: "Padded Gambeson",
          statAffinity: "willpower",
          stats: { might: 4, finesse: 5, reflex: 5, endurance: 5, vitality: 5, fortitude: 4, knowledge: 7, logic: 6, awareness: 6, intuition: 7, charm: 4, willpower: 8 },
          kingdom: "Mammal",
          species: "Human",
          inventory: ["Phial of Dragon Blood", "Occult Talisman"]
        });
      }
    }

    this.activeProps.clear();
    this.activeNPCs.clear();

    injected.props.forEach(p => this.activeProps.set(p.id, p));

    // Handle dead NPCs: convert deceased NPCs into lootable corpse props so they render as remains instead of living entities
    const activeAliveNPCs: InjectedNPC[] = [];
    for (const n of injected.npcs) {
      if (!n.alive || n.hp <= 0) {
        // Create corpse prop if not already created
        const corpsePropId = `prop_corpse_${n.id}`;
        if (!this.activeProps.has(corpsePropId)) {
          const corpseProp = TagMatrixEngine.createProp(
            corpsePropId,
            `${n.name}'s Remains`,
            n.pos,
            ["corpse", "carcass", "remains", "organic", "lootable"],
            10
          );
          this.activeProps.set(corpsePropId, corpseProp);
          injected.props.push(corpseProp);
        }
      } else {
        activeAliveNPCs.push(n);
        this.activeNPCs.set(n.id, n);
      }
    }
    injected.npcs = activeAliveNPCs;

    // 2. Upsert newly generated or updated NPCs into sim_npc_instances so they become persistent
    try {
      for (const n of activeAliveNPCs) {
        await this.pool.query(
          `INSERT INTO sim_npc_instances (
            id, cell_id, current_rx, current_ry, local_pos, name, role, kingdom, species, lineage,
            tags, faction, hp, max_hp, disposition, alive, equipped_weapon, equipped_armor,
            stat_affinity, stats, inventory, memory_notes, wander_anchor, home_pos, work_pos,
            current_task, target_destination, schedule_state, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, $18,
            $19, $20, $21, $22, $23, $24, $25,
            $26, $27, $28, NOW()
          ) ON CONFLICT (id) DO UPDATE SET
            local_pos = EXCLUDED.local_pos,
            current_rx = EXCLUDED.current_rx,
            current_ry = EXCLUDED.current_ry,
            current_task = COALESCE(EXCLUDED.current_task, sim_npc_instances.current_task),
            schedule_state = COALESCE(EXCLUDED.schedule_state, sim_npc_instances.schedule_state),
            updated_at = NOW()`,
          [
            n.id,
            cellId,
            rx,
            ry,
            [n.pos[0], n.pos[1]],
            n.name,
            n.role,
            n.kingdom || null,
            n.species || null,
            n.lineage || null,
            JSON.stringify(n.tags),
            n.faction,
            n.hp,
            n.maxHp,
            n.disposition,
            n.alive ?? true,
            n.equippedWeapon || null,
            n.equippedArmor || null,
            n.statAffinity || null,
            JSON.stringify(n.stats || {}),
            JSON.stringify(n.inventory || []),
            JSON.stringify(n.memoryNotes || []),
            [n.pos[0], n.pos[1]],
            n.homePos ? [n.homePos[0], n.homePos[1]] : [n.pos[0], n.pos[1]],
            n.workPos ? [n.workPos[0], n.workPos[1]] : [n.pos[0], n.pos[1]],
            n.currentTask || "IDLE",
            n.targetDestination ? [n.targetDestination[0], n.targetDestination[1]] : null,
            n.scheduleState || "WORK"
          ]
        );
      }
    } catch (err) {
      console.error("Error upserting generated NPCs into sim_npc_instances:", err);
    }

    return injected;
  }

  public restoreState(storyState: any) {
    if (storyState) {
      this.storyEngine.restoreCampaignState(storyState);
    }
  }

  public getActiveEntities() {
    return {
      props: Array.from(this.activeProps.values()).map(p => ({
        id: p.id,
        name: p.name,
        type: p.type,
        pos: p.pos,
        tags: Array.isArray(p.tags) ? p.tags : Array.from(p.tags),
        hp: p.hp,
        maxHp: p.maxHp,
        isDestroyed: p.isDestroyed
      })),
      npcs: Array.from(this.activeNPCs.values()),
      campaignState: this.storyEngine.getCampaignState()
    };
  }

  /**
   * Resilient LLM helper with automatic model fallback.
   */
  public async callGeminiWithFallback(
    contents: any,
    systemInstruction: string,
    maxOutputTokens = 250,
    temperature = 0.7
  ): Promise<string | null> {
    const key = process.env.GEMINI_API_KEY?.trim();
    if (!key || this.warnedInvalidKey) {
      return null;
    }
    let payload = contents;
    if (Array.isArray(contents) && contents.length === 1 && contents[0]?.parts?.[0]?.text) {
      payload = contents[0].parts[0].text;
    }

    const isJsonRequested = systemInstruction?.toLowerCase().includes("json");

    for (const m of this.CANDIDATE_MODELS) {
      try {
        const config: any = {
          systemInstruction,
          temperature,
          maxOutputTokens
        };
        if (isJsonRequested) {
          config.responseMimeType = "application/json";
        }

        const res = await this.ai.models.generateContent({
          model: m,
          contents: payload,
          config
        });
        if (res.text && res.text.trim().length > 0) {
          return res.text.trim();
        }
      } catch (err: any) {
        // A bad key fails the same way for every model, so stop instead of retrying.
        // Other errors (unknown model, rate limit, bad prompt) fall through to the next model.
        const msg = String(err?.message || "");
        if (msg.includes("API key not valid") || msg.includes("API_KEY_INVALID") || err?.status === 401 || err?.status === 403) {
          if (!this.warnedInvalidKey) {
            console.warn("[ConcordiaGM] GEMINI_API_KEY was rejected by Google. AI narration is disabled until the key in simulation-engine/.env is fixed and the server restarts.");
            this.warnedInvalidKey = true;
          }
          return null;
        }
        console.warn(`[ConcordiaGM] Model ${m} error: ${err?.message || err}. Trying next...`);
      }
    }
    return null;
  }

  /**
   * COMPONENT 1: INTENT & TARGET PARSER
   * Translates natural language into structured category, verb, target, and 12-stat key.
   */
  public async parseIntent(actionText: string): Promise<ParsedIntent> {
    const availableTargets = [
      ...Array.from(this.activeProps.values()).map(p => ({ id: p.id, name: p.name, tags: Array.from(p.tags) })),
      ...Array.from(this.activeNPCs.values()).map(n => ({ id: n.id, name: n.name, tags: n.tags }))
    ];

    const prompt = `Available Sector Targets: ${JSON.stringify(availableTargets)}
Player Action: "${actionText}"
Parse the action into JSON. Output ONLY valid JSON with keys:
{
  "category": "COMBAT|MAGIC|SOCIAL|SUBTERFUGE|EXPLORATION|SURVIVAL",
  "verb": "SLASH|STAB|SMASH|CAST_FIRE|CAST_LIGHTNING|IGNITE|TALK|PERSUADE|INTIMIDATE|BRIBE|DECEIVE|SNEAK|PICK_LOCK|UNLOCK|INSPECT|SEARCH|REST|FORAGE|HARVEST|GATHER|HUNT|TRACK|FIELD_DRESS|BUTCHER|COOK|BREW|USE_ITEM",
  "targetId": "<matching target id or empty>",
  "targetName": "<target name>",
  "statUsed": "might|endurance|finesse|reflex|vitality|fortitude|knowledge|logic|awareness|intuition|charm|willpower"
}`;

    try {
      const raw = await this.callGeminiWithFallback(
        [{ role: "user", parts: [{ text: prompt }] }],
        "You are an exact intent parser for a dark fantasy RPG engine. Output only JSON.",
        400,
        0.1
      );

      if (raw) {
        const clean = raw.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(clean);
        const category: ActionCategory = parsed.category || "CREATIVE_CHECK";
        const isCombat = category === "COMBAT";
        const verb = (parsed.verb || "CUSTOM_CHECK").toUpperCase();
        return {
          category,
          verb,
          targetId: parsed.targetId || "",
          targetName: parsed.targetName || "Surroundings",
          statUsed: parsed.statUsed || "intuition",
          isCombat
        };
      }
    } catch (e) {
      console.warn("[ConcordiaGM] Intent parser fallback:", e);
    }

    // Heuristic Fallback
    const lower = actionText.toLowerCase();

    // Helper for boundary-safe keyword matching
    const hasWord = (...words: string[]) => words.some(w => new RegExp(`\\b${w}\\b`, "i").test(lower));

    // Explicit combat check to avoid attacking innocent bystanders
    const isExplicitAttack = hasWord("attack", "slash", "strike", "stab", "shoot", "smash", "kill", "thrust", "cleave", "behead");

    let category: ActionCategory = isExplicitAttack ? "COMBAT" : "CREATIVE_CHECK";
    let verb = isExplicitAttack ? "SLASH" : "CUSTOM_CHECK";
    let statUsed = isExplicitAttack ? "might" : "intuition";

    if (hasWord("play", "lute", "flute", "song", "sing", "dance", "perform", "poem", "recite", "ballad", "melody", "lullaby")) {
      category = "CREATIVE_CHECK";
      verb = "PERFORM";
      statUsed = "charm";
    } else if (hasWord("use", "apply", "drink", "consume", "eat", "swallow", "potion", "salve", "poultice", "draught") && (hasWord("ration", "salve", "potion", "draught", "meat", "herb") || hasWord("use", "drink", "eat"))) {
      category = "SURVIVAL";
      verb = "USE_ITEM";
      statUsed = "vitality";
    } else if (hasWord("forage", "harvest", "gather", "botany", "flora", "herbs", "herb", "mushrooms", "roots")) {
      category = "SURVIVAL";
      verb = "FORAGE";
      statUsed = "awareness";
    } else if (hasWord("butcher", "field dress", "dress", "skin", "carcass", "pelt", "flesh", "gut")) {
      category = "SURVIVAL";
      verb = "FIELD_DRESS";
      statUsed = "finesse";
    } else if (hasWord("hunt", "track", "stalk")) {
      category = "SURVIVAL";
      verb = "HUNT";
      statUsed = "awareness";
    } else if (hasWord("cook", "roast", "bake", "fry")) {
      category = "SURVIVAL";
      verb = "COOK";
      statUsed = "vitality";
    } else if (hasWord("brew", "concoct", "distill")) {
      category = "SURVIVAL";
      verb = "BREW";
      statUsed = "knowledge";
    } else if (hasWord("rest", "sleep", "camp", "bivouac", "nap") && !hasWord("wrestle", "forest", "crested", "arrest", "chest")) {
      category = "SURVIVAL";
      verb = "REST";
      statUsed = "vitality";
    } else if (hasWord("talk", "speak", "converse", "negotiate", "chat", "greet", "hail") || (hasWord("ask") && !hasWord("cask", "flask", "mask", "task"))) {
      category = "SOCIAL";
      verb = "TALK";
      statUsed = "charm";
    } else if (hasWord("bribe") || (hasWord("pay") && !hasWord("spray"))) {
      category = "SOCIAL";
      verb = "BRIBE";
      statUsed = "charm";
    } else if (hasWord("intimidate", "threaten", "scare", "bully", "interrogate")) {
      category = "SOCIAL";
      verb = "INTIMIDATE";
      statUsed = "might";
    } else if (hasWord("pray", "meditate", "commune", "channel", "invoke")) {
      category = "MAGIC";
      verb = "CHANNEL_CHAOS";
      statUsed = "willpower";
    } else if (hasWord("fire", "burn", "ignite", "torch", "fireball")) {
      category = "MAGIC";
      verb = "IGNITE";
      statUsed = "intuition";
    } else if (hasWord("lightning", "shock", "electric", "spark", "zap")) {
      category = "MAGIC";
      verb = "CAST_LIGHTNING";
      statUsed = "intuition";
    } else if (hasWord("freeze", "frost", "ice", "chill")) {
      category = "MAGIC";
      verb = "CAST_ICE";
      statUsed = "intuition";
    } else if (hasWord("sneak", "shadow", "creep", "skulk", "hide")) {
      category = "SUBTERFUGE";
      verb = "SNEAK";
      statUsed = "finesse";
    } else if (hasWord("lock", "lockpick", "pick") && !hasWord("pickpocket")) {
      category = "SUBTERFUGE";
      verb = "PICK_LOCK";
      statUsed = "finesse";
    } else if (hasWord("search", "inspect", "examine", "look", "study", "read", "scrutinize")) {
      category = "EXPLORATION";
      verb = "SEARCH";
      statUsed = "awareness";
    } else if (hasWord("cross", "ford", "traverse", "leap", "jump", "fly", "dash", "swim") && (hasWord("river", "flow", "torrent", "cataract", "chasm", "water", "ford", "current", "chaos", "vein", "strand", "ribbon", "stones", "airship", "skyship") || lower.includes("ford") || lower.includes("flow"))) {
      category = "EXPLORATION";
      verb = "CROSS_CHAOS_FLOW";
      statUsed = hasWord("fly", "airship", "skyship") ? "logic" : (hasWord("leap", "jump", "dash", "sprint") ? "reflex" : "endurance");
    }

    // Pick matching target ONLY if explicitly mentioned in action text (excluding stop-words)
    const stopWords = new Set(["the", "a", "an", "of", "in", "to", "for", "with", "on", "at", "from", "by", "about"]);
    let matchedTarget: any = null;
    for (const t of availableTargets) {
      const cleanName = t.name.toLowerCase().replace(/^(the|a|an)\s+/i, "").trim();
      const tokens = cleanName.split(/\s+/).filter((tok: string) => tok.length > 2 && !stopWords.has(tok));
      if (tokens.some((tok: string) => new RegExp(`\\b${tok}\\b`, "i").test(lower))) {
        matchedTarget = t;
        break;
      }
    }

    return {
      category,
      verb,
      targetId: matchedTarget ? matchedTarget.id : "",
      targetName: matchedTarget ? matchedTarget.name : "Surroundings",
      statUsed,
      isCombat: category === "COMBAT"
    };
  }

  /**
   * COMPONENT 2, 3, 4, 5: THE FULL CONCORDIA GM EXECUTION LOOP
   */
  public async executeTurn(input: ActionInput): Promise<GMResolutionOutput> {
    const { actionText, playerId, playerPos } = input;

    // 1. Parse Intent & Action Mode
    const intent = await this.parseIntent(actionText);

    // 2. Fetch Player Character from PostgreSQL
    const playerRes = await this.pool.query("SELECT * FROM sim_player_character WHERE id = $1", [playerId]);
    const player = playerRes.rows[0] || {
      id: playerId,
      name: "Hero",
      might: 7,
      endurance: 6,
      finesse: 8,
      reflex: 5,
      vitality: 6,
      fortitude: 5,
      knowledge: 5,
      logic: 5,
      awareness: 6,
      intuition: 6,
      charm: 5,
      willpower: 6,
      current_hp: 14,
      max_hp: 14,
      gold: 50,
      inventory: [],
      equipped_weapon: "Steel Arming Sword"
    };

    const playerStatVal: number = Number(player[intent.statUsed]) || 5;
    let playerComposure = Number(player.composure) || Number(player.max_composure) || 20;
    const playerMaxComposure = Number(player.max_composure) || 20;
    const playerReputations: Record<string, number> = typeof player.faction_reputations === "object" && player.faction_reputations
      ? { ...player.faction_reputations }
      : (typeof player.faction_reputations === "string" ? JSON.parse(player.faction_reputations || "{}") : {});

    if (player.current_hp !== undefined && Number(player.current_hp) <= 0) {
      return {
        success: false,
        intent,
        rollOutcome: {
          playerRoll: 0,
          playerStatVal: 0,
          dcOrDefenderRoll: 10,
          difference: -10,
          injuryPoints: 0,
          hit: false
        },
        systemLog: `[INCAPACITATED: You are unconscious at 0 HP. You cannot take action until revived.]`,
        narrativeResponse: `${player.name} lies motionless upon the cold earth, consciousness fading beneath the Cruorbus sky. You cannot act in this state.`,
        campaignState: this.storyEngine.getCampaignState(),
        worldDelta: { propsDestroyed: [], npcsDefeated: [] }
      };
    }

    // 3. Find Grounded Target
    const targetProp = this.activeProps.get(intent.targetId);
    const targetNPC = this.activeNPCs.get(intent.targetId);
    const targetObj: TaggedObject | null = targetProp || (targetNPC ? {
      id: targetNPC.id,
      name: targetNPC.name,
      type: "NPC",
      pos: targetNPC.pos,
      tags: new Set<string>(targetNPC.tags),
      hp: targetNPC.hp,
      maxHp: targetNPC.maxHp,
      isDestroyed: !targetNPC.alive
    } : null);

    const playerRoll = Math.floor(Math.random() * 20) + 1;
    let dcOrDefenderRoll = 10;
    let difference = 0;
    let hit = false;
    let injuryPoints = 0;
    let detailedRollOutcome: any = null;
    let tagResult: TagInteractionResult | undefined;
    let inCharacterDialogue: string | undefined;
    let lootAwarded: { gold: number; item?: string } | undefined;
    let xpGained = 0;
    let systemLog = "";
    let customNarrative: string | undefined;

    // 4. Multi-Faceted Concordia Resolution
    const targetTagsList: string[] = targetProp
      ? (Array.isArray(targetProp.tags) ? targetProp.tags : Array.from(targetProp.tags))
      : (targetNPC ? targetNPC.tags : []);

    const playerInv: string[] = Array.isArray(player.inventory) ? player.inventory : [];

    // Find matching action from the universal Tag-to-Stat Action Matrix
    const matchedActionDef = ATOMIC_TAG_ACTIONS.find((a) => a.verb === intent.verb) ||
      ATOMIC_TAG_ACTIONS.find((a) => a.stat === intent.statUsed && targetTagsList.some((t) => t.toLowerCase() === a.tagRequired.toLowerCase()));

    const calculatedDCInfo = matchedActionDef
      ? computeActionDC(matchedActionDef, targetTagsList, playerInv)
      : { dc: 11, breakdown: { base: 11, materialMod: 0, toolBonus: 0 } };

    const dynamicDC = calculatedDCInfo.dc;
    const dynamicToolBonus = calculatedDCInfo.breakdown.toolBonus;
    const toolBonusNotice = dynamicToolBonus > 0 ? ` (+${dynamicToolBonus} Tool)` : "";

    if (intent.category === "SOCIAL") {
      // Check if target is an inanimate physical prop
      if (targetProp && !targetNPC) {
        return {
          success: false,
          intent,
          rollOutcome: {
            playerRoll,
            playerStatVal,
            dcOrDefenderRoll: 10,
            difference: -10,
            injuryPoints: 0,
            hit: false
          },
          systemLog: `[SOCIAL: '${targetProp.name}' is an inanimate physical object. It does not respond to speech, bribes, or threats.]`,
          narrativeResponse: `${player.name} addresses ${targetProp.name}, but stone, iron, and silence offer no response.`,
          campaignState: this.storyEngine.getCampaignState(),
          worldDelta: { propsDestroyed: [], npcsDefeated: [] }
        };
      }

      // Check if target is a wild beast/animal (Animal Handling instead of courtier debate)
      if (targetNPC && targetNPC.tags && (targetNPC.tags.includes("beast") || targetNPC.tags.includes("prey") || targetNPC.tags.includes("predator"))) {
        const animalDC = 12;
        const animalStatVal = Number(player.intuition) || 5;
        const animalRoll = playerRoll + animalStatVal;
        const animalDiff = animalRoll - animalDC;
        const animalHit = animalDiff >= 0;
        return {
          success: animalHit,
          intent,
          rollOutcome: {
            playerRoll,
            playerStatVal: animalStatVal,
            dcOrDefenderRoll: animalDC,
            difference: animalDiff,
            injuryPoints: 0,
            hit: animalHit
          },
          systemLog: `[INTUITION ANIMAL EMPATHY: ${animalRoll} vs DC ${animalDC} | ${animalHit ? `SUCCESS: ${targetNPC.name} watches you cautiously, placated by your calm posture.` : `FAILED: ${targetNPC.name} bristles or bolts, startled by your approach.`}]`,
          narrativeResponse: animalHit
            ? `${player.name} lowers posture and projects stillness before ${targetNPC.name}. The creature watches with wary calm.`
            : `${targetNPC.name} tenses against ${player.name}, ready to fight or flee the unfamiliar intruder.`,
          campaignState: this.storyEngine.getCampaignState(),
          worldDelta: { propsDestroyed: [], npcsDefeated: [] }
        };
      }

      // --- SOCIAL RESOLUTION (Composure & Mental Contest) ---
      const npcName = targetNPC?.name || intent.targetName || "The Guard";
      const npcRole = targetNPC?.role || (npcName.toLowerCase().includes("guard") ? "Guard" : "Wayfarer");
      const npcFaction = targetNPC?.faction || "Local Province";
      const targetFactionRep = playerReputations[npcFaction] || 0;
      let advantageMod = 0;
      if (targetNPC) {
        if (targetNPC.disposition > 0) advantageMod += 2;
        if (targetNPC.disposition < -1) advantageMod -= 2;
      }
      if (targetFactionRep >= 25) advantageMod += 2;
      else if (targetFactionRep <= -25) advantageMod -= 2;

      if (intent.verb === "BRIBE") {
        if (targetNPC?.tags?.includes("bribeable") || targetNPC?.tags?.includes("greedy")) advantageMod += 3;
        if (player.gold >= 10) player.gold -= 10;
        else advantageMod -= 4;
      } else if (intent.verb === "INTIMIDATE") {
        if (targetNPC?.tags?.includes("fearful") || targetNPC?.tags?.includes("intimidatable")) advantageMod += 3;
        if (targetNPC?.tags?.includes("unyielding") || targetNPC?.tags?.includes("fanatical")) advantageMod -= 3;
      }

      const playerSocialCombatant: SocialCombatant = {
        id: player.id,
        name: player.name || "Hero",
        stats: player,
        equippedSocialWeapon: player.equipped_social_weapon || "Iron Warmaster Baton",
        equippedSocialArmor: player.equipped_social_armor || "Keepsake Locket of the Hearth",
        composure: playerComposure,
        maxComposure: playerMaxComposure,
        skillRanks: player.skill_ranks || {},
        difficulty: player.difficulty
      };

      const npcSocialCombatant: SocialCombatant = {
        id: targetNPC?.id || 999,
        name: npcName,
        stats: targetNPC?.stats || { might: 5, endurance: 5, finesse: 5, reflex: 5, vitality: 5, fortitude: 5, knowledge: 5, logic: 5, awareness: 5, intuition: 5, charm: 5, willpower: 5 },
        equippedSocialWeapon: npcRole.includes("Guard") ? "Iron Warmaster Baton" : "Gilded Courtier's Fan",
        equippedSocialArmor: npcRole.includes("Guard") ? "Champion's Lion Pauldrons" : "Keepsake Locket of the Hearth",
        composure: targetNPC ? ((targetNPC as any).composure ?? 12) : 12,
        maxComposure: targetNPC ? ((targetNPC as any).maxComposure ?? 12) : 12
      };

      const contestRes = resolveOpposedSocialContest(
        playerSocialCombatant,
        npcSocialCombatant,
        intent.statUsed as StatKey,
        { advantageMod }
      );

      hit = contestRes.hit;
      difference = contestRes.difference;
      dcOrDefenderRoll = contestRes.defenderTotal;
      injuryPoints = contestRes.composureDamage;
      if (targetNPC) {
        (targetNPC as any).composure = contestRes.defenderComposureRemaining;

        // Adjust disposition on success or failure
        if (hit) {
          targetNPC.disposition = Math.min(2, targetNPC.disposition + 1);
          xpGained += 25;
        } else if (intent.verb === "INTIMIDATE") {
          targetNPC.disposition = Math.max(-2, targetNPC.disposition - 1);
        }

        // If Composure reaches 0: Morale Breakdown!
        if (contestRes.isBroken) {
          targetNPC.disposition = Math.max(1, targetNPC.disposition);
          xpGained += 50;
        }
      } else {
        if (hit) xpGained += 25;
        if (contestRes.isBroken) xpGained += 50;
      }

      // Query geographically bounded & role-appropriate simulation rumors from PostgreSQL
      let recentRumors = "";
      try {
        const localBurgId = this.activeContext?.burg?.burg_id ?? null;
        const isTravelerOrTavern = targetNPC?.tags?.includes("merchant") || 
                                   targetNPC?.tags?.includes("wayfarer") || 
                                   targetNPC?.tags?.includes("innkeeper") || 
                                   targetNPC?.tags?.includes("courier") ||
                                   targetNPC?.tags?.includes("scholar") ||
                                   targetNPC?.role?.toLowerCase().includes("innkeeper") ||
                                   targetNPC?.role?.toLowerCase().includes("caravan") ||
                                   targetNPC?.role?.toLowerCase().includes("messenger") ||
                                   targetNPC?.role?.toLowerCase().includes("trader");

        let eventsRes;
        if (isTravelerOrTavern) {
          // Well-traveled merchants, scholars, couriers, and innkeepers hear both distant and local news
          eventsRes = await this.pool.query(
            `SELECT message, tier FROM sim_events 
             WHERE tier IN ('CRITICAL', 'MAJOR') 
                OR burg_id = $1 
                OR id IN (SELECT id FROM sim_events ORDER BY id DESC LIMIT 15)
             ORDER BY id DESC LIMIT 4`,
            [localBurgId]
          );
        } else if (localBurgId) {
          // Local burg residents only know local municipal events or massive continental events
          eventsRes = await this.pool.query(
            `SELECT message, tier FROM sim_events 
             WHERE tier IN ('CRITICAL', 'MAJOR') 
                OR burg_id = $1 
             ORDER BY id DESC LIMIT 3`,
            [localBurgId]
          );
        } else {
          // Frontier hermits/scouts only know massive cosmic events or wilderness occurrences
          eventsRes = await this.pool.query(
            `SELECT message, tier FROM sim_events 
             WHERE tier IN ('CRITICAL', 'MAJOR') 
                OR type IN ('ECOLOGICAL', 'TROPHIC_DISRUPTION', 'APEX_BEAST_SLAIN', 'CARTEL_EXPANSION')
             ORDER BY id DESC LIMIT 3`
          );
        }

        if (eventsRes && eventsRes.rows.length > 0) {
          recentRumors = eventsRes.rows.map((r: any) => `- ${r.message}`).join("\n");
        }
      } catch (err) {}

      // Generate In-Character Dialogue via Gemini GABM
      const repNote = targetFactionRep !== 0
        ? `The player has an underlying reputation of ${targetFactionRep} with your faction ('${npcFaction}'). Reflect this subtly in your tone, respect, suspicion, or hostility without mentioning numbers.`
        : "";
      const breakdownNote = contestRes.isBroken
        ? `Your Composure has been completely shattered! You are demoralized, conceding, surrendering, or breaking into a nervous confession.`
        : "";

      const npcTagsStr = targetNPC ? targetNPC.tags.join(", ") : "disciplined, armed, watchful";
      const dialoguePrompt = `You are ${npcName}, a ${npcRole} aligned with '${npcFaction}'. Your traits are: [${npcTagsStr}].
The player spoke: "${actionText}".
Social contest result: ${hit ? "SUCCESS" : "FAILURE"} (${contestRes.composureDamage} Composure trauma dealt. Remaining Composure: ${contestRes.defenderComposureRemaining}/${npcSocialCombatant.maxComposure}). Current disposition: ${targetNPC ? targetNPC.disposition : (hit ? 1 : -1)}.
${breakdownNote}
${repNote}
${recentRumors ? `Recent genuine rumors & occurrences across the realm:\n${recentRumors}\nIf appropriate to the player's query or disposition, weave one of these rumors into your dialogue.` : ""}
Speak 1-2 sentences of direct in-character spoken dialogue in quotation marks responding to the player. Mention your faction or secret motives.`;

      const dialogueRes = await this.callGeminiWithFallback(
        [{ role: "user", parts: [{ text: dialoguePrompt }] }],
        "You are an actor playing an authentic dark fantasy character. Output only spoken dialogue in quotation marks.",
        150,
        0.8
      );

      inCharacterDialogue = dialogueRes || (hit
        ? `"${npcName} relaxes their guard. 'Very well, traveler. If you seek what was taken, look to the old ruins.'"`
        : `"${npcName} sneers with contempt. 'Your hollow words carry no weight here. Begone or draw steel!'"`
      );

      systemLog = contestRes.log;

    } else if (intent.category === "SUBTERFUGE") {
      // --- SUBTERFUGE & THIEVERY ---
      dcOrDefenderRoll = dynamicDC;
      const totalSubterfugeRoll = playerRoll + playerStatVal + dynamicToolBonus;
      difference = totalSubterfugeRoll - dcOrDefenderRoll;
      hit = difference >= 0;

      if (hit && targetProp && targetProp.tags.has("locked")) {
        targetProp.tags.delete("locked");
        targetProp.tags.add("unlocked");
        const foundGold = Math.floor(Math.random() * 30) + 15;
        let foundItem = "Smuggled Aetheric Draught";
        if (this.activeContext?.activeFlow) {
          foundItem = `${this.activeContext.activeFlow} Resonant Charm`;
        } else if (this.activeContext?.infrastructureMask && (this.activeContext.infrastructureMask & 4)) {
          foundItem = "Cartel Skeleton Key";
        } else if (this.activeContext?.infrastructureMask && (this.activeContext.infrastructureMask & 8)) {
          foundItem = "Ancient Inscribed Relic";
        }
        player.gold = (player.gold || 0) + foundGold;
        const inv = Array.isArray(player.inventory) ? player.inventory : [];
        inv.push(foundItem);
        player.inventory = inv;
        lootAwarded = { gold: foundGold, item: foundItem };
        xpGained += 35;
        systemLog = `[${intent.statUsed.toUpperCase()} CHECK${toolBonusNotice}: ${totalSubterfugeRoll} vs DC ${dynamicDC} | SUCCESS: Lock bypassed! Found ${foundGold} Gold & ${foundItem}]`;
      } else if (hit) {
        xpGained += 15;
        systemLog = `[${intent.statUsed.toUpperCase()} CHECK${toolBonusNotice}: ${totalSubterfugeRoll} vs DC ${dynamicDC} | SUCCESS: Subterfuge bypass successful]`;
      } else {
        systemLog = `[${intent.statUsed.toUpperCase()} CHECK${toolBonusNotice}: ${totalSubterfugeRoll} vs DC ${dynamicDC} | FAILED: Lock mechanism resists or alert triggered]`;
      }

    } else if (intent.category === "SURVIVAL") {
      // --- SURVIVAL, BOTANY, FIELD DRESSING & CAMPING ---
      if (intent.verb === "USE_ITEM") {
        dcOrDefenderRoll = 6;
        difference = (playerRoll + playerStatVal) - dcOrDefenderRoll;
        hit = true;
        const inv = Array.isArray(player.inventory) ? player.inventory : [];
        let itemIndex = inv.findIndex((it: string) => actionText.toLowerCase().includes(it.toLowerCase()) || it.toLowerCase().includes(intent.targetName.toLowerCase()));
        if (itemIndex === -1 && inv.length > 0) itemIndex = 0; // fallback first item
        const itemUsed = itemIndex >= 0 ? inv[itemIndex] : "Trail Provisions";

        let healAmt = 5;
        if (itemUsed.toLowerCase().includes("salve") || itemUsed.toLowerCase().includes("poultice") || itemUsed.toLowerCase().includes("draught")) {
          healAmt = 10;
        } else if (itemUsed.toLowerCase().includes("ration") || itemUsed.toLowerCase().includes("steak") || itemUsed.toLowerCase().includes("venison") || itemUsed.toLowerCase().includes("meat")) {
          healAmt = 7;
        }

        player.current_hp = Math.min(Number(player.max_hp) || 22, (Number(player.current_hp) || 22) + healAmt);
        if (itemIndex >= 0) {
          inv.splice(itemIndex, 1);
          player.inventory = inv;
        }
        systemLog = `[VITALITY CONSUME: Applied ${itemUsed} | Restored +${healAmt} HP (${player.current_hp}/${player.max_hp})]`;

      } else if (intent.verb === "FORAGE" || intent.verb === "HARVEST" || intent.verb === "EXAMINE_BOTANY") {
        dcOrDefenderRoll = dynamicDC;
        const totalRoll = playerRoll + playerStatVal + dynamicToolBonus;
        difference = totalRoll - dcOrDefenderRoll;
        hit = difference >= 0;

        if (hit) {
          const foragedItem = targetProp ? targetProp.name : "Foraged Medicinal Herbs";
          if (targetProp) {
            targetProp.isDestroyed = true;
            targetProp.hp = 0;
          }
          lootAwarded = { gold: 0, item: foragedItem };
          systemLog = `[${intent.statUsed.toUpperCase()} FORAGE${toolBonusNotice}: ${totalRoll} vs DC ${dynamicDC} | SUCCESS: Harvested ${foragedItem}!]`;
        } else {
          systemLog = `[${intent.statUsed.toUpperCase()} FORAGE${toolBonusNotice}: ${totalRoll} vs DC ${dynamicDC} | FAILED: Disturbed botanical roots; yielded nothing viable]`;
        }

      } else if (intent.verb === "FIELD_DRESS" || intent.verb === "BUTCHER") {
        dcOrDefenderRoll = dynamicDC;
        const totalRoll = playerRoll + playerStatVal + dynamicToolBonus;
        difference = totalRoll - dcOrDefenderRoll;
        hit = difference >= 0;

        if (hit) {
          const rawTargetName = (targetNPC?.name || targetProp?.name || "Game Beast").replace(/'s Remains/i, "").trim();
          const cleanName = rawTargetName.replace(/The /i, "").trim();
          const meatItem = `Fresh ${cleanName} Meat`;
          const peltItem = `${cleanName} Pelt`;
          lootAwarded = { gold: 5, item: meatItem };
          player.inventory = Array.isArray(player.inventory) ? player.inventory : [];
          player.inventory.push(peltItem);
          player.inventory.push(meatItem);

          const targetInv = targetNPC?.inventory || targetProp?.inventory || [];
          if (Array.isArray(targetInv) && targetInv.length > 0) {
            targetInv.forEach((it: string) => player.inventory.push(it));
            if (targetProp) targetProp.inventory = [];
          }

          if (targetNPC) {
            targetNPC.hp = 0;
            targetNPC.alive = false;
          }
          if (targetProp) {
            targetProp.tags.delete("lootable");
            targetProp.tags.add("harvested");
          }
          systemLog = `[${intent.statUsed.toUpperCase()} FIELD-DRESS${toolBonusNotice}: ${totalRoll} vs DC ${dynamicDC} | SUCCESS: Harvested ${meatItem} & ${peltItem}!]`;
        } else {
          systemLog = `[${intent.statUsed.toUpperCase()} FIELD-DRESS${toolBonusNotice}: ${totalRoll} vs DC ${dynamicDC} | FAILED: Ruined hide during field dressing]`;
        }

      } else if (intent.verb === "COOK") {
        const inv = Array.isArray(player.inventory) ? player.inventory : [];
        const meatIdx = inv.findIndex((it: string) => it.toLowerCase().includes("venison") || it.toLowerCase().includes("meat") || it.toLowerCase().includes("steak"));
        if (meatIdx >= 0) {
          inv.splice(meatIdx, 1);
          const cookedMeal = "Savory Cooked Trail Rations";
          inv.push(cookedMeal);
          player.inventory = inv;
          hit = true;
          lootAwarded = { gold: 0, item: cookedMeal };
          systemLog = `[LOGIC COOK | SUCCESS: Roasted provisions over hearthfire, produced ${cookedMeal}!]`;
        } else {
          hit = false;
          systemLog = `[LOGIC COOK | FAILED: No raw game meat in pack to prepare]`;
        }

      } else if (intent.verb === "BREW") {
        const inv = Array.isArray(player.inventory) ? player.inventory : [];
        const herbIdx = inv.findIndex((it: string) => it.toLowerCase().includes("herb") || it.toLowerCase().includes("lichen") || it.toLowerCase().includes("fern") || it.toLowerCase().includes("flora") || it.toLowerCase().includes("reed"));
        if (herbIdx >= 0) {
          inv.splice(herbIdx, 1);
          const remedy = "Herbal Healing Salve";
          inv.push(remedy);
          player.inventory = inv;
          hit = true;
          lootAwarded = { gold: 0, item: remedy };
          systemLog = `[KNOWLEDGE BREW | SUCCESS: Distilled botanical stock into ${remedy} (+10 HP)!]`;
        } else {
          hit = false;
          systemLog = `[KNOWLEDGE BREW | FAILED: No foraged herbs or medicinal flora in pack to brew]`;
        }

      } else if (intent.verb === "REST") {
        dcOrDefenderRoll = dynamicDC;
        const totalRoll = playerRoll + playerStatVal + dynamicToolBonus;
        difference = totalRoll - dcOrDefenderRoll;
        hit = difference >= 0;
        player.current_hp = Number(player.max_hp) || 22;
        playerComposure = playerMaxComposure;
        systemLog = `[${intent.statUsed.toUpperCase()} REST: ${totalRoll} vs DC ${dynamicDC} | RECOVERED: Camped by fire; restored full HP (${player.current_hp}/${player.max_hp}) and anchored mental Composure (${playerComposure}/${playerMaxComposure})!]`;

      } else {
        // Default exploration hunting/tracking
        dcOrDefenderRoll = dynamicDC;
        const totalRoll = playerRoll + playerStatVal + dynamicToolBonus;
        difference = totalRoll - dcOrDefenderRoll;
        hit = difference >= 0;
        systemLog = `[${intent.statUsed.toUpperCase()} SURVIVAL${toolBonusNotice}: ${totalRoll} vs DC ${dynamicDC} | ${hit ? "SUCCESS: Action executed" : "FAILED: Obstacle resisted"}]`;
      }

    } else if (intent.category === "EXPLORATION") {
      // --- EXPLORATION, CROSSING & SEARCH ---
      const isChaosFlowCrossing = intent.verb === "CROSS_CHAOS_FLOW" ||
        Boolean(targetProp && (targetProp.tags.has("chaos_flow") || targetProp.tags.has("narrow_ford"))) ||
        (/\b(cross|ford|traverse|leap across|jump across|fly across|swim across|wade|brave the ford)\b/i.test(actionText) && Boolean(this.activeContext?.chaosFlow?.intersected || this.activeContext?.chaosFlow?.nearNarrowSpot));

      if (isChaosFlowCrossing) {
        const airshipItem = playerInv.find(it => /airship|skyship|sky vessel|cloud cruiser|aetheric craft|aether glider/i.test(it));
        const flowInfo = this.activeContext?.chaosFlow?.nearestFlow || {
          name: "Primordial Chaos Torrent",
          dragonName: "Chaos Dragon",
          elementalPower: this.activeContext?.activeFlow || "Flux",
          currentSurge: 1.5,
          currentWidth: 32
        };
        const isAtNarrow = Boolean(
          this.activeContext?.chaosFlow?.nearNarrowSpot ||
          (targetProp && targetProp.tags.has("narrow_ford")) ||
          /\b(ford|chokepoint|narrow|stepping stones|narrows)\b/i.test(actionText)
        );

        if (airshipItem) {
          hit = true;
          difference = 15;
          injuryPoints = 0;
          xpGained = 120;
          systemLog = `[AIRSHIP AETHER-TRANSIT | 100% SAFE: Boarded ${airshipItem} and soared safely above ${flowInfo.name}! Primordial radiation bypassed completely with 0 damage.]`;
          customNarrative = `Boarding your ${airshipItem}, the skycraft's resonant anti-grav keels hum with soothing azure light. You ascend smoothly into the atmosphere, gliding hundreds of meters above the reality-tearing chasm of ${flowInfo.name}. Far below, violent surges of ${flowInfo.elementalPower} aether roar and writhe against the earth, but the skyship's sealed envelope insulates your crew completely from chaotic radiation and temporal distortion. You touch down safely on the far embankment, unscathed.`;
        } else if (isAtNarrow) {
          const narrowDC = this.activeContext?.chaosFlow?.narrowSpot?.crossingDC || Math.min(23, Math.max(12, Math.round(13 + (flowInfo.currentSurge || 1.0) * 3.2)));
          dcOrDefenderRoll = narrowDC;
          const bestStat = Math.max(Number(player.reflex) || 5, Number(player.endurance) || 5);
          const totalRoll = playerRoll + bestStat + dynamicToolBonus;
          difference = totalRoll - dcOrDefenderRoll;
          hit = difference >= 0;

          if (hit) {
            const splashDmg = Math.max(0, Math.floor(Math.random() * 3));
            player.current_hp = Math.max(1, (Number(player.current_hp) || 14) - splashDmg);
            xpGained = 90;
            systemLog = `[NARROW FORD SPRINT | SUCCESS: Rolled ${totalRoll} vs DC ${narrowDC} | Braved the jagged chasm of ${flowInfo.name}! Sprinted across the narrow rock ford safely (took ${splashDmg} aether splash damage).]`;
            customNarrative = `You gauge the pulsating rhythm of ${flowInfo.name}, waiting for the chaotic flood to momentarily recede. With a desperate burst of speed, you sprint across the jagged stepping stones of the narrow ford! Roaring plumes of ${flowInfo.elementalPower} aether hiss around your boots and singe your cloak, but your footing holds true. You collapse onto the far bank, heart hammering in your chest, having successfully braved the primordial chokepoint!`;
          } else {
            const chaosDmg = Math.floor((Math.random() * 8 + 8) * Math.max(1.0, flowInfo.currentSurge || 1.0));
            player.current_hp = Math.max(0, (Number(player.current_hp) || 14) - chaosDmg);
            const mutation = await applyPlayerChaosMutation(
              this.pool,
              playerId,
              flowInfo.elementalPower,
              (this.activeContext as any)?.tick || 1,
              `Narrow Ford Hazard (${flowInfo.name})`
            );
            systemLog = `[NARROW FORD SPRINT | FAILED: Rolled ${totalRoll} vs DC ${narrowDC} | Washed by ${flowInfo.name}! Sustained ${chaosDmg} unmitigated chaos damage and contracted MUTATION: ${mutation.name} (${JSON.stringify(mutation.statModifiers)})!]`;
            customNarrative = `Halfway across the narrow ford, an unexpected gravitic surge knocks you off balance! Your foot slips on the glassy crystal shelf, and a cataract of raw ${flowInfo.elementalPower} aether engulfs your body. Catastrophic energy burns through your nervous system as reality distorts around you. You drag yourself claw-over-claw to the far shore, coughing up luminescent bile. As the burning subsides, you realize with horror that your body has warped: you have contracted ${mutation.name}! (${mutation.description})`;
          }
        } else {
          // Open river crossing on foot - deadly hazard!
          const hazardDC = 24;
          dcOrDefenderRoll = hazardDC;
          const totalRoll = playerRoll + (Number(player.endurance) || 5) + dynamicToolBonus;
          difference = totalRoll - dcOrDefenderRoll;
          hit = false;
          const massiveDmg = Math.floor(22 * Math.max(1.0, flowInfo.currentSurge || 1.2));
          player.current_hp = Math.max(0, (Number(player.current_hp) || 14) - massiveDmg);
          const mutation = await applyPlayerChaosMutation(
            this.pool,
            playerId,
            flowInfo.elementalPower,
            (this.activeContext as any)?.tick || 1,
            `Open Primordial River Immersion (${flowInfo.name})`
          );
          systemLog = `[CATASTROPHIC CROSSING HAZARD: Waded into open ${flowInfo.name} without an Airship! Sustained ${massiveDmg} primordial damage and contracted MUTATION: ${mutation.name} (${JSON.stringify(mutation.statModifiers)})!]`;
          customNarrative = `Wading directly into the churning primordial torrent of ${flowInfo.name} without an airship is utter madness! The full, unbridled fury of ${flowInfo.elementalPower} aether rips into your flesh and soul. Your bones creak under cosmic pressure and your veins boil with uncontainable power. You barely crawl to the opposing bank before collapsing in agonizing spasms. The raw primordial flood has permanently scarred your vessel with ${mutation.name}: ${mutation.description}!`;
        }
      } else {
        dcOrDefenderRoll = dynamicDC;
        const totalRoll = playerRoll + playerStatVal + dynamicToolBonus;
        difference = totalRoll - dcOrDefenderRoll;
        hit = difference >= 0;

        const isCorpse = targetProp && (targetProp.tags.has("corpse") || targetProp.tags.has("remains") || targetProp.tags.has("lootable"));
        const isContainer = targetProp && (targetProp.tags.has("container") || targetProp.tags.has("cache") || targetProp.tags.has("chest"));

        if (hit && isCorpse) {
          const foundGold = Math.floor(Math.random() * 15) + 5;
          player.gold = (player.gold || 0) + foundGold;
          const corpseInv = targetProp.inventory || [];
          player.inventory = Array.isArray(player.inventory) ? player.inventory : [];
          if (corpseInv.length > 0) {
            corpseInv.forEach((it: string) => player.inventory.push(it));
            lootAwarded = { gold: foundGold, item: corpseInv.join(", ") };
            targetProp.inventory = [];
            targetProp.tags.delete("lootable");
            systemLog = `[${intent.statUsed.toUpperCase()} SEARCH${toolBonusNotice}: ${totalRoll} vs DC ${dynamicDC} | SUCCESS: Looted ${targetProp.name}! Found ${foundGold} Gold & [${corpseInv.join(", ")}]]`;
          } else {
            lootAwarded = { gold: foundGold };
            targetProp.tags.delete("lootable");
            systemLog = `[${intent.statUsed.toUpperCase()} SEARCH${toolBonusNotice}: ${totalRoll} vs DC ${dynamicDC} | SUCCESS: Searched ${targetProp.name}, found ${foundGold} Gold]`;
          }
        } else if (hit && isContainer) {
          const foundGold = Math.floor(Math.random() * 25) + 12;
          player.gold = (player.gold || 0) + foundGold;
          player.inventory = Array.isArray(player.inventory) ? player.inventory : [];

          let dynamicItem = targetProp.inventory?.[0];
          if (!dynamicItem) {
            if (this.activeContext?.activeFlow) {
              dynamicItem = `${this.activeContext.activeFlow} Resonant Shard`;
            } else if (this.activeContext?.infrastructureMask && (this.activeContext.infrastructureMask & 8)) {
              dynamicItem = "Ancient Inscribed Tablet";
            } else if (this.activeContext?.infrastructureMask && (this.activeContext.infrastructureMask & 4)) {
              dynamicItem = "Smuggled Contraband Phial";
            } else {
              dynamicItem = "Preserved Field Rations";
            }
          }
          player.inventory.push(dynamicItem);
          lootAwarded = { gold: foundGold, item: dynamicItem };
          targetProp.tags.delete("container");
          targetProp.tags.add("opened");
          systemLog = `[${intent.statUsed.toUpperCase()} INSPECT${toolBonusNotice}: ${totalRoll} vs DC ${dynamicDC} | SUCCESS: Discovered cache inside ${targetProp.name}! Found ${foundGold} Gold & ${dynamicItem}]`;
        } else {
          systemLog = `[${intent.statUsed.toUpperCase()} INSPECT${toolBonusNotice}: ${totalRoll} vs DC ${dynamicDC} | ${hit ? "SUCCESS: Area scouted; no further caches detected" : "NOTHING FOUND"}]`;
        }
      }

    } else if (intent.category === "MAGIC") {
      // --- ELEMENTAL / OCCULT MAGIC ---
      dcOrDefenderRoll = dynamicDC;
      const totalRoll = playerRoll + playerStatVal + dynamicToolBonus;
      difference = totalRoll - dcOrDefenderRoll;
      hit = difference >= 0;
      injuryPoints = hit ? 3 : 0;

      if (targetObj) {
        tagResult = TagMatrixEngine.resolveInteraction(
          player.name || "Hero",
          intent.verb,
          targetObj,
          ["magic", intent.verb.toLowerCase()],
          Array.from(this.activeProps.values())
        );

        if (targetNPC && hit) {
          targetNPC.hp = Math.max(0, targetNPC.hp - (injuryPoints * 4));
          if (targetNPC.hp === 0) targetNPC.alive = false;
        }
      }
      systemLog = `[${intent.statUsed.toUpperCase()} MAGIC: ${totalRoll} vs DC ${dynamicDC} | ${hit ? "SUCCESS: Spell manifested" : "DISPELLED"} | ${injuryPoints} Magic Damage]`;

    } else if (intent.category === "CREATIVE_CHECK" || intent.verb === "CUSTOM_CHECK") {
      // --- CREATIVE CHECK (Non-violent skill / utility / custom player intent) ---
      dcOrDefenderRoll = dynamicDC > 0 ? dynamicDC : 11;
      const totalRoll = playerRoll + playerStatVal + dynamicToolBonus;
      difference = totalRoll - dcOrDefenderRoll;
      hit = difference >= 0;
      injuryPoints = 0;

      if (targetObj) {
        tagResult = TagMatrixEngine.resolveInteraction(
          player.name || "Hero",
          intent.verb,
          targetObj,
          ["creative", intent.verb.toLowerCase()],
          Array.from(this.activeProps.values())
        );
      }

      xpGained += hit ? 20 : 5;
      systemLog = `[${intent.statUsed.toUpperCase()} CREATIVE CHECK${toolBonusNotice}: ${totalRoll} vs DC ${dcOrDefenderRoll} | ${hit ? "SUCCESS: Creative action achieved" : "CHALLENGED: Unsuccessful effort"}] ${tagResult?.logs?.slice(1).join(" ") || ""}`.trim();

    } else {
      // --- COMBAT (Melee / Ranged Attack with 12-Stat Equipment Matrix) ---
      const playerWeapon = getWeapon(player.equipped_weapon || "Osmium Greatsword");
      const playerArmor = getArmor(player.equipped_armor || "Juggernaut Osmium Plate");

      const attackStatKey: StatKey = playerWeapon.stat;
      const attackMod: number = playerWeapon.mod;
      const playerAttackStatVal: number = Number(player[attackStatKey]) || 5;

      if (targetNPC) {
        const defArmor = getArmor(targetNPC.equippedArmor || "Glacial Iron Hauberk");
        const defWeapon = getWeapon(targetNPC.equippedWeapon || "Titanium Bastion Spear");

        const defStatKey: StatKey = defArmor.stat;
        const defStatVal: number = targetNPC.stats?.[defStatKey] ?? 5;
        const defMod: number = defArmor.mod;

        let advantageMod = 0;
        if (player.difficulty === "casual") advantageMod += 3;
        if (targetNPC.tags?.includes("vulnerable") || targetNPC.tags?.includes("burning")) advantageMod += 2;
        if (targetNPC.tags?.includes("cover_heavy") || targetNPC.tags?.includes("unyielding")) advantageMod -= 2;
        if (input.isStealthed || input.sneakAttack) advantageMod += 4; // Surprise Advantage / Sneak Attack Rating

        const playerSkillRanks: Record<string, number> = (typeof player.skill_ranks === 'object' && player.skill_ranks)
          ? player.skill_ranks
          : (typeof player.skill_ranks === 'string' ? JSON.parse(player.skill_ranks || '{}') : {});

        const playerWeaponSpecRank = playerSkillRanks[`spec_weapon_${attackStatKey}`] || 0;
        const playerArmorSpecRank = playerSkillRanks[`spec_armor_${playerArmor.stat}`] || 0;
        const passiveDmgBonus = (playerSkillRanks[`pow_off_${attackStatKey}`] || playerSkillRanks[`pass_${attackStatKey}`] || 0) >= 2
          ? ((playerSkillRanks[`pow_off_${attackStatKey}`] || playerSkillRanks[`pass_${attackStatKey}`] || 0) >= 4 ? 2 : 1)
          : 0;
        const activePierce = (playerSkillRanks[`act_off_${attackStatKey}`] || 0) >= 2
          ? ((playerSkillRanks[`act_off_${attackStatKey}`] || 0) >= 4 ? 3 : 1)
          : 0;
        const effectiveDefDR = Math.max(0, defArmor.damageReduction - activePierce);

        const targetCoverBonus = input.coverBonus || 0;
        const combatRes = resolveOpposedCombat(
          playerAttackStatVal + advantageMod,
          attackMod,
          defStatVal,
          defMod + targetCoverBonus,
          {
            attackerWeaponSpecRank: playerWeaponSpecRank,
            defenderArmorSpecRank: 0
          }
        );

        hit = combatRes.hit;
        difference = combatRes.difference;
        dcOrDefenderRoll = combatRes.defenderTotal;

        const sneakBonus = (input.isStealthed || input.sneakAttack) ? 4 : 0;
        const netInjury = hit ? Math.max(1, combatRes.injuryPoints + playerWeapon.damageBonus + passiveDmgBonus + sneakBonus - effectiveDefDR) : 0;
        injuryPoints = netInjury;

        detailedRollOutcome = {
          attackerRoll: combatRes.attackerRoll,
          attackerStatKey: attackStatKey,
          attackerStatVal: playerAttackStatVal + advantageMod,
          attackerMod: attackMod,
          attackerTotal: combatRes.attackerTotal,
          defenderRoll: combatRes.defenderRoll,
          defenderStatKey: defStatKey,
          defenderStatVal: defStatVal,
          defenderMod: defMod + targetCoverBonus,
          defenderTotal: combatRes.defenderTotal,
          coverBonus: targetCoverBonus,
          coverLevel: input.coverLevel || (targetCoverBonus >= 4 ? "FULL" : targetCoverBonus > 0 ? "HALF" : "NONE"),
          weaponName: playerWeapon.name,
          armorName: defArmor.name
        };

        if (hit) {
          targetNPC.hp = Math.max(0, targetNPC.hp - (netInjury * 4));
          if (targetNPC.hp === 0) {
            targetNPC.alive = false;
            const lootGold = Math.floor(Math.random() * 25) + 15;
            player.gold = (player.gold || 0) + lootGold;
            const droppedItem = Math.random() < 0.5 ? defWeapon.name : defArmor.name;
            lootAwarded = { gold: lootGold, item: droppedItem };
            const isApex = (targetNPC.role && targetNPC.role.includes("Apex")) || (targetNPC.tags && targetNPC.tags.includes("predator"));
            const isPrey = targetNPC.tags && (targetNPC.tags.includes("prey") || targetNPC.tags.includes("game"));
            xpGained += isApex ? 120 : (isPrey ? 35 : 60);
          }
        }

        tagResult = TagMatrixEngine.resolveInteraction(
          player.name || "Hero",
          intent.verb,
          targetObj!,
          playerWeapon.tags,
          Array.from(this.activeProps.values())
        );

        systemLog = `[ATTACK (${attackStatKey.toUpperCase()} - ${playerWeapon.name}${playerWeaponSpecRank > 0 ? ` [Spec R${playerWeaponSpecRank}]` : ''}): ${combatRes.attackerTotal} vs DEFENSE (${defStatKey.toUpperCase()} - ${defArmor.name}): ${combatRes.defenderTotal} | ${hit ? "HIT" : "DEFLECTED"} | ${netInjury} Injury Points dealt] ${tagResult?.logs?.slice(1).join(" ") || ""}`.trim();

        // NPC retaliation if still alive and hostile
        if (targetNPC.alive && targetNPC.disposition <= -1) {
          const npcAtkStatVal = targetNPC.stats?.[defWeapon.stat] ?? 5;
          const playerDefStatVal = Number(player[playerArmor.stat]) || 5;
          const retaliationRes = resolveOpposedCombat(
            npcAtkStatVal,
            defWeapon.mod,
            playerDefStatVal,
            playerArmor.mod,
            {
              attackerWeaponSpecRank: 0,
              defenderArmorSpecRank: playerArmorSpecRank
            }
          );

          const passiveDefDR = (playerSkillRanks[`pow_off_${playerArmor.stat}`] || playerSkillRanks[`pass_${playerArmor.stat}`] || 0) >= 2 ? 1 : 0;
          const effectivePlayerDR = playerArmor.damageReduction + passiveDefDR;
          if (retaliationRes.hit) {
            let retaliationDmg = Math.max(1, retaliationRes.injuryPoints + defWeapon.damageBonus - effectivePlayerDR);
            if (player.difficulty === "casual") {
              retaliationDmg = Math.max(1, Math.floor(retaliationDmg / 2));
            }
            player.current_hp = Math.max(0, (player.current_hp || 14) - retaliationDmg);
            systemLog += ` | [RETALIATION (${defWeapon.stat.toUpperCase()} - ${defWeapon.name}): ${retaliationRes.attackerTotal} vs ${playerArmor.name} (${playerArmor.stat.toUpperCase()} [DR ${effectivePlayerDR}]): ${retaliationRes.defenderTotal} -> -${retaliationDmg} HP (${player.current_hp}/${player.max_hp})]`;
          } else {
            systemLog += ` | [RETALIATION: ${targetNPC.name}'s strike deflected by ${playerArmor.name}!]`;
          }
        }

      } else if (targetProp) {
        let advantageMod = 0;
        if (targetProp.tags.has("vulnerable") || targetProp.tags.has("burning") || targetProp.tags.has("fragile")) advantageMod += 2;
        if (targetProp.tags.has("unyielding") || targetProp.tags.has("heavy")) advantageMod -= 2;

        const propDC = 10 + (targetProp.hp > 25 ? 3 : 1);
        const atkRoll = Math.floor(Math.random() * 20) + 1;
        const atkTotal = atkRoll + playerAttackStatVal + attackMod + advantageMod;
        hit = atkTotal >= propDC;
        difference = atkTotal - propDC;
        dcOrDefenderRoll = propDC;

        const propDmg = hit ? Math.max(4, (playerAttackStatVal + attackMod + playerWeapon.damageBonus) * 2) : 0;
        injuryPoints = hit ? 1 : 0;
        if (hit) {
          targetProp.hp = Math.max(0, targetProp.hp - propDmg);
          if (targetProp.hp === 0) targetProp.isDestroyed = true;
        }

        tagResult = TagMatrixEngine.resolveInteraction(
          player.name || "Hero",
          intent.verb,
          targetProp,
          playerWeapon.tags,
          Array.from(this.activeProps.values())
        );

        systemLog = `[ATTACK (${attackStatKey.toUpperCase()} - ${playerWeapon.name}): ${atkTotal} vs Object DC ${propDC} | ${hit ? "CRUSHED" : "DEFLECTED"} | ${propDmg} Structural Damage] ${tagResult?.logs?.slice(1).join(" ") || ""}`.trim();

      } else {
        const roll = Math.floor(Math.random() * 20) + 1;
        dcOrDefenderRoll = 10;
        difference = (roll + playerAttackStatVal + attackMod) - dcOrDefenderRoll;
        hit = difference >= 0;
        injuryPoints = hit ? 1 : 0;
        systemLog = `[${attackStatKey.toUpperCase()} STRIKE (${playerWeapon.name}): ${roll + playerAttackStatVal + attackMod} vs DC 10 | ${hit ? "CLEAVED AIR" : "STUMBLED"}]`;
      }
    }

    // 5. Objective Tracking & WhatELSE Progression
    const targetIdToCheck = intent.targetId;
    const objectiveUpdate = hit ? this.storyEngine.updateObjective(targetIdToCheck, 1) : { beatCompleted: false };

    // 6. State Mutation & PostgreSQL Backfeed
    const propsDestroyed: string[] = [];
    const npcsDefeated: string[] = [];

    if (targetProp && targetProp.isDestroyed) {
      propsDestroyed.push(targetProp.name);
      this.activeProps.delete(targetProp.id);
    }
    if (targetNPC && (!targetNPC.alive || targetNPC.hp <= 0)) {
      targetNPC.alive = false;
      targetNPC.hp = 0;
      npcsDefeated.push(targetNPC.name);
      this.activeNPCs.delete(targetNPC.id);

      // Spawn corpse prop so it renders as remains
      const corpsePropId = `prop_corpse_${targetNPC.id}`;
      if (!this.activeProps.has(corpsePropId)) {
        const corpseProp = TagMatrixEngine.createProp(
          corpsePropId,
          `${targetNPC.name}'s Remains`,
          targetNPC.pos,
          ["corpse", "carcass", "remains", "organic", "lootable"],
          10
        );
        corpseProp.inventory = Array.isArray(targetNPC.inventory) ? [...targetNPC.inventory] : [];
        this.activeProps.set(corpsePropId, corpseProp);
      }
    }

    // Persist targetNPC mutation (HP, alive, disposition, inventory) to sim_npc_instances
    if (targetNPC) {
      try {
        await this.pool.query(
          `UPDATE sim_npc_instances
           SET hp = $1, alive = $2, disposition = $3, inventory = $4, updated_at = NOW()
           WHERE id = $5`,
          [
            Math.max(0, targetNPC.hp),
            targetNPC.alive ?? (targetNPC.hp > 0),
            targetNPC.disposition,
            JSON.stringify(targetNPC.inventory || []),
            targetNPC.id
          ]
        );
      } catch (err) {
        console.error("Error persisting NPC mutation to sim_npc_instances:", err);
      }
    }

    // If story beat completed, reload sector with activeContext so new beat is injected with persistence
    if (objectiveUpdate.beatCompleted) {
      const activeBeat = this.storyEngine.getCampaignState().activeBeat;
      const beatXp = activeBeat?.rewards?.xp || 140;
      const beatGold = activeBeat?.rewards?.gold || 30;
      xpGained += beatXp;
      player.gold = (player.gold || 0) + beatGold;
      if (this.activeContext) {
        await this.loadSector(this.activeContext);
      }
    }

    // Persist player stat mutations (HP, Gold, Inventory, XP, Level, Skill Points)
    if (lootAwarded?.item) {
      player.inventory = Array.isArray(player.inventory) ? player.inventory : [];
      player.inventory.push(lootAwarded.item);
    }

    if (xpGained > 0) {
      let currentXp = (Number(player.xp) || 0) + xpGained;
      let currentLevel = Number(player.level) || 1;
      let currentSkillPoints = Number(player.skill_points) || 0;
      let leveledUp = false;

      let xpNeeded = currentLevel * 100;
      while (currentXp >= xpNeeded) {
        currentXp -= xpNeeded;
        currentLevel += 1;
        currentSkillPoints += 1;
        leveledUp = true;
        xpNeeded = currentLevel * 100;
      }

      player.xp = currentXp;
      player.level = currentLevel;
      player.skill_points = currentSkillPoints;

      systemLog += ` | [XP +${xpGained} (${currentXp}/${xpNeeded} XP)]`;
      if (leveledUp) {
        systemLog += ` | [🌟 LEVEL UP! You attained Level ${currentLevel}! +1 Skill Point gained! Total SP: ${currentSkillPoints}]`;
      }
    }

    // Environmental Horror & Cosmic Dread check (if in high chaos radiation or dragon seal)
    if (this.activeContext?.chaosRadiation && this.activeContext.chaosRadiation > 0.35 && playerComposure > 0) {
      const dreadDC = Math.round(11 + this.activeContext.chaosRadiation * 10);
      const dreadRes = resolveCosmicDreadCheck(
        {
          id: playerId,
          name: player.name || "Hero",
          stats: player,
          equippedSocialWeapon: player.equipped_social_weapon || "Iron Warmaster Baton",
          equippedSocialArmor: player.equipped_social_armor || "Keepsake Locket of the Hearth",
          composure: playerComposure,
          maxComposure: playerMaxComposure,
          skillRanks: player.skill_ranks || {}
        },
        dreadDC,
        "willpower"
      );
      playerComposure = dreadRes.remainingComposure;
      if (!dreadRes.passed) {
        systemLog += ` | ${dreadRes.log}`;
      }
    }

    await this.pool.query(
      `UPDATE sim_player_character
       SET current_hp = $1, gold = $2, inventory = $3, xp = $4, level = $5, skill_points = $6, composure = $7, faction_reputations = $8
       WHERE id = $9`,
      [player.current_hp, player.gold, JSON.stringify(player.inventory || []), player.xp || 0, player.level || 1, player.skill_points || 0, playerComposure, JSON.stringify(playerReputations), playerId]
    ).catch(() => {});

    // Two-Way PostgreSQL Simulation Backfeed (Phase 1)
    const cellId = this.activeContext?.cellId ?? 13408;
    const rx = this.activeContext?.rx ?? 105;
    const ry = this.activeContext?.ry ?? 112;
    let simDeltaNotice = "";

    // A. Outlaw / Raider Defeated -> Decrease Crime Rate & Unrest in Province + Sovereign Rep
    if (targetNPC && !targetNPC.alive && (targetNPC.tags.includes("outlaw") || targetNPC.tags.includes("bandit") || targetNPC.tags.includes("cannibal") || targetNPC.role.toLowerCase().includes("outlaw") || targetNPC.role.toLowerCase().includes("marauder"))) {
      try {
        if (this.activeContext?.factionOwner) {
          playerReputations[this.activeContext.factionOwner] = (playerReputations[this.activeContext.factionOwner] || 0) + 3;
        }
        await this.pool.query(
          `UPDATE sim_burg_economy
           SET crime_rate = GREATEST(0, COALESCE(crime_rate, 20) - 3),
               unrest = GREATEST(0, COALESCE(unrest, 10) - 2)
           WHERE cell_id = $1 OR burg_id = (SELECT burg_id FROM sim_burg_economy ORDER BY ABS(cell_id - $1) ASC LIMIT 1)`,
          [cellId]
        );
        await this.pool.query(
          `INSERT INTO sim_events (tick, tier, lore_date, burg_id, faction_id, type, message)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [1, "MINOR", "Cruorbus 1st Era", 1, 1, "HIGHWAY_PATROL_VICTORY", `Highway brigand ${targetNPC.name} was eliminated by ${player.name} in Sector (${rx}, ${ry}). Road safety improved.`]
        );
        simDeltaNotice += " | 🌍 SIMULATION: Crime Rate -3 & Unrest -2 in Regional Province";
      } catch (err) {
        console.error("Backfeed crime error:", err);
      }
    }

    // B. Underworld Cartel Enforcer Defeated or Cache Plundered -> Increase Cartel Heat & Drain Manpower
    if ((targetNPC && !targetNPC.alive && targetNPC.faction.includes("Smuggler")) || (targetProp && targetProp.tags.has("valuable") && hit && intent.category === "SUBTERFUGE")) {
      try {
        playerReputations["Smugglers Syndicate"] = (playerReputations["Smugglers Syndicate"] || 0) - 8;
        if (this.activeContext?.factionOwner) {
          playerReputations[this.activeContext.factionOwner] = (playerReputations[this.activeContext.factionOwner] || 0) + 4;
        }
        await this.pool.query(
          `UPDATE sim_fringe_lairs
           SET manpower = GREATEST(0, manpower - 4),
               heat = LEAST(100, heat + 8)
           WHERE id = (SELECT id FROM sim_fringe_lairs ORDER BY ABS(cell_id - $1) ASC LIMIT 1)`,
          [cellId]
        );
        await this.pool.query(
          `INSERT INTO sim_events (tick, tier, lore_date, burg_id, faction_id, type, message)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [1, "MINOR", "Cruorbus 1st Era", 1, 1, "CARTEL_INTERRUPTED", `Smuggler ring disrupted by ${player.name} in Sector (${rx}, ${ry}). Cartel manpower fractured.`]
        );
        simDeltaNotice += " | 🕵️ SIMULATION: Cartel Manpower -4, Heat +8 in Underworld";
      } catch (err) {
        console.error("Backfeed cartel error:", err);
      }
    }

    // C. Apex Beast / Predator Vanquished -> Decrement Eco-Predators, Improve Ecological Health
    if (targetNPC && !targetNPC.alive && (targetNPC.role.includes("Apex Predator") || targetNPC.tags.includes("predator"))) {
      try {
        await this.pool.query(
          `UPDATE sim_cells
           SET eco_health = LEAST(100.0, COALESCE(eco_health, 100.0) + 3.0),
               eco_predators = GREATEST(0.0, COALESCE(eco_predators, 5.0) - 1.0),
               eco_apex = GREATEST(0.0, COALESCE(eco_apex, 1.0) - 1.0)
           WHERE id = $1`,
          [cellId]
        );
        await this.pool.query(
          `INSERT INTO sim_events (tick, tier, lore_date, burg_id, faction_id, type, message)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [1, "MAJOR", "Cruorbus 1st Era", 1, 1, "APEX_BEAST_SLAIN", `The predator ${targetNPC.name} was vanquished by ${player.name} in Sector (${rx}, ${ry}). The wild balance shifts.`]
        );
        await this.pool.query(
          `INSERT INTO sim_global_events (layer, type, message, regional_x, regional_y, radius, intensity, velocity_x, velocity_y, duration)
           VALUES ('ECOLOGICAL', 'APEX_BEAST_SLAIN', $1, $2, $3, 10, 0.8, 0, 0, 5)`,
          [`Apex predator ${targetNPC.name} vanquished by ${player.name}`, rx, ry]
        );
        simDeltaNotice += " | 🦁 SIMULATION: Eco-Predators -1.0, Eco-Health +3.0";
      } catch (err) {
        console.error("Backfeed eco predator error:", err);
      }
    }

    // C2. Prey / Wild Game Slain or Butchered -> Decrement Eco-Prey & Harvest Directly into Player Inventory
    if ((targetNPC && !targetNPC.alive && (targetNPC.tags.includes("prey") || targetNPC.tags.includes("game"))) || (hit && (intent.verb === "FIELD_DRESS" || intent.verb === "BUTCHER"))) {
      try {
        await this.pool.query(
          `UPDATE sim_cells
           SET eco_prey = GREATEST(0.0, COALESCE(eco_prey, 10.0) - 1.0)
           WHERE id = $1`,
          [cellId]
        );
        
        // Grounded causality: animal meat/pelts drop into the traveler's inventory, NOT magically into a distant city granary!
        player.inventory = Array.isArray(player.inventory) ? player.inventory : [];
        const preyItem = targetNPC ? `Fresh ${targetNPC.name} Haunch` : "Fresh Wild Game Haunch";
        const hideItem = targetNPC ? `${targetNPC.name} Pelt` : "Cured Game Hide";
        player.inventory.push(preyItem);
        if (Math.random() < 0.6) player.inventory.push(hideItem);

        simDeltaNotice += ` | 🦌 ECOLOGY: Local Prey -1.0 | Harvested [${preyItem}] into traveler satchel`;
      } catch (err) {
        console.error("Backfeed eco prey error:", err);
      }
    }

    // C3. Botanical Flora Foraged / Harvested -> Decrement Eco-Plants & Harvest Directly into Satchel
    if (hit && (intent.verb === "FORAGE" || intent.verb === "HARVEST" || intent.verb === "EXAMINE_BOTANY" || intent.verb === "GATHER")) {
      try {
        await this.pool.query(
          `UPDATE sim_cells
           SET eco_plants = GREATEST(0.0, COALESCE(eco_plants, 10.0) - 1.0)
           WHERE id = $1`,
          [cellId]
        );

        // Grounded causality: foraged plants enter player's satchel
        player.inventory = Array.isArray(player.inventory) ? player.inventory : [];
        const herbNames = ["Wild Mountain Ginseng", "Silverleaf Stems", "Marsh Reed Fibre", "Earth-Root Tubers", "Bitter-Bark Lichen"];
        const foundHerb = herbNames[Math.floor(Math.random() * herbNames.length)];
        player.inventory.push(foundHerb);

        simDeltaNotice += ` | 🌿 ECOLOGY: Local Flora -1.0 | Harvested [${foundHerb}] into satchel`;
      } catch (err) {
        console.error("Backfeed flora error:", err);
      }
    }

    // C3b. Grounded Settlement Commerce: Selling Provisions or Materials to Local Merchants / Granaries
    const isTradingAction = intent.category === "SOCIAL" && (
      intent.verb === "TRADE" || intent.verb === "TALK" || intent.verb === "BRIBE" ||
      actionText.toLowerCase().includes("sell") || actionText.toLowerCase().includes("trade") ||
      actionText.toLowerCase().includes("provision") || actionText.toLowerCase().includes("deliver food")
    );
    const isMerchantTarget = targetNPC && (
      targetNPC.tags.includes("merchant") || targetNPC.tags.includes("vendor") ||
      targetNPC.tags.includes("provisioner") || targetNPC.tags.includes("innkeeper") ||
      targetNPC.tags.includes("reeve") || targetNPC.role.toLowerCase().includes("provisioner") ||
      targetNPC.role.toLowerCase().includes("merchant") || targetNPC.role.toLowerCase().includes("innkeeper")
    );

    if (hit && isTradingAction && isMerchantTarget) {
      try {
        player.inventory = Array.isArray(player.inventory) ? player.inventory : [];
        let foodSold = 0;
        let matsSold = 0;
        const remainingInv: string[] = [];

        for (const item of player.inventory) {
          const itemLower = item.toLowerCase();
          const isFood = itemLower.includes("haunch") || itemLower.includes("meat") || itemLower.includes("ration") ||
                         itemLower.includes("venison") || itemLower.includes("tuber") || itemLower.includes("bread") ||
                         itemLower.includes("fruit") || itemLower.includes("game");
          const isMat = itemLower.includes("ginseng") || itemLower.includes("silverleaf") || itemLower.includes("herb") ||
                        itemLower.includes("pelt") || itemLower.includes("hide") || itemLower.includes("fibre") ||
                        itemLower.includes("ore") || itemLower.includes("lichen");

          if (isFood && foodSold < 3) {
            foodSold++;
          } else if (isMat && matsSold < 3) {
            matsSold++;
          } else {
            remainingInv.push(item);
          }
        }

        if (foodSold > 0 || matsSold > 0) {
          player.inventory = remainingInv;
          const goldEarned = (foodSold * 12) + (matsSold * 16);
          player.gold = (Number(player.gold) || 0) + goldEarned;

          if (foodSold > 0) {
            const foodUnits = foodSold * 4;
            await this.pool.query(
              `UPDATE sim_burg_economy
               SET food = COALESCE(food, 0) + $1,
                   unrest = GREATEST(0, COALESCE(unrest, 0) - 1)
               WHERE cell_id = $2 OR burg_id = (SELECT burg_id FROM sim_burg_economy ORDER BY ABS(cell_id - $2) ASC LIMIT 1)`,
              [foodUnits, cellId]
            );
            if (this.activeContext?.factionOwner) {
              playerReputations[this.activeContext.factionOwner] = (playerReputations[this.activeContext.factionOwner] || 0) + 2;
            }
          }

          if (matsSold > 0) {
            await this.pool.query(
              `UPDATE sim_industrial_stockpiles
               SET raw_herbs = COALESCE(raw_herbs, 0) + $1
               WHERE burg_id = (SELECT burg_id FROM sim_burg_economy ORDER BY ABS(cell_id - $2) ASC LIMIT 1)`,
              [matsSold, cellId]
            );
            await this.pool.query(
              `UPDATE sim_commodity_prices
               SET global_supply = global_supply + $1,
                   current_price = GREATEST(0.4, current_price * 0.99)
               WHERE commodity = 'medicine'`,
              [matsSold]
            );
          }

          simDeltaNotice += ` | ⚖️ COMMERCE: Sold ${foodSold} food & ${matsSold} materials for +${goldEarned} Gold! Municipal Granary & Stockpiles replenished.`;
        }
      } catch (err) {
        console.error("Backfeed commerce error:", err);
      }
    }

    // C4. Cultist Threat Purged -> Restore Sacred Grove Dragon Seal & Cleanse Eco-Blight + Faction Rep
    if (targetNPC && !targetNPC.alive && (targetNPC.tags.includes("cultist") || targetNPC.role.toLowerCase().includes("cultist") || targetNPC.faction.toLowerCase().includes("cult"))) {
      try {
        playerReputations["Grey Wardens"] = (playerReputations["Grey Wardens"] || 0) + 5;
        playerReputations["Blood Cult"] = (playerReputations["Blood Cult"] || 0) - 10;
        await this.pool.query(
          `UPDATE sim_sacred_groves
           SET seal_strength = LEAST(100, seal_strength + 4)
           WHERE cell_id = $1 OR cell_id = (SELECT cell_id FROM sim_sacred_groves ORDER BY ABS(cell_id - $1) ASC LIMIT 1)`,
          [cellId]
        );
        await this.pool.query(
          `UPDATE sim_cells
           SET eco_blight = GREATEST(0.0, COALESCE(eco_blight, 0.0) - 0.5)
           WHERE id = $1`,
          [cellId]
        );
        simDeltaNotice += " | 🕊️ SIMULATION: Cultist Threat Purged! Dragon Seal Restored +4, Eco-Blight -0.5";
      } catch (err) {
        console.error("Backfeed cultist error:", err);
      }
    }

    // D. Metaphysical Reality Fracture / Dragon Seal Strained or Shattered
    const isDragonSeal = targetProp && (targetProp.id.includes("dragon_prison") || targetProp.tags.has("dragon_seal") || targetProp.tags.has("wardstone"));
    const isBloodAltar = targetProp && (targetProp.id.includes("blood_altar") || targetProp.tags.has("blood_magic") || targetProp.tags.has("altar"));
    const isChaosFissure = targetProp && (targetProp.id.includes("fissure") || targetProp.tags.has("fissure"));

    if (hit && (isDragonSeal || isBloodAltar || isChaosFissure)) {
      try {
        const isDestroyed = targetProp.isDestroyed || (targetProp.hp <= 0);
        const sealDmg = isDestroyed ? 50 : 25;

        // Drain seal strength in sacred groves
        const groveUpdate = await this.pool.query(
          `UPDATE sim_sacred_groves
           SET seal_strength = GREATEST(0, seal_strength - $1)
           WHERE cell_id = $2 OR cell_id = (SELECT cell_id FROM sim_sacred_groves ORDER BY ABS(cell_id - $2) ASC LIMIT 1)
           RETURNING dragon_name, power_domain, seal_strength`,
          [sealDmg, cellId]
        );

        const grove = groveUpdate.rows[0] || { dragon_name: "Ancient Dragon", power_domain: "Chaos", seal_strength: 50 };

        // Spike chaos zone intensity
        const chaosIntensity = isDestroyed ? 1.0 : Math.min(0.95, 0.4 + (100 - Number(grove.seal_strength)) / 100);
        await this.pool.query(
          `INSERT INTO sim_chaos_zones (cell_id, intensity, type)
           VALUES ($1, $2, $3)`,
          [cellId, chaosIntensity, `${grove.power_domain.toUpperCase()}_RUPTURE`]
        );

        // Global Event shockwave across the map
        const shockwaveRadius = isDestroyed ? 75 : 30;
        await this.pool.query(
          `INSERT INTO sim_global_events (layer, type, message, regional_x, regional_y, radius, intensity, velocity_x, velocity_y, duration)
           VALUES ('MAGICAL', $1, $2, $3, $4, $5, $6, 0, 0, $7)`,
          [
            isDestroyed ? 'APOCALYPTIC_SEAL_BREACH' : 'METAPHYSICAL_FRACTURE',
            `${player.name} fractured the ${grove.power_domain} containment seal of ${grove.dragon_name} in Sector (${rx}, ${ry})!`,
            rx, ry, shockwaveRadius, chaosIntensity, isDestroyed ? 40 : 15
          ]
        );

        // Major chronicle event
        await this.pool.query(
          `INSERT INTO sim_events (tick, tier, lore_date, burg_id, faction_id, type, message)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            1,
            isDestroyed ? "CRITICAL" : "MAJOR",
            "Cruorbus 1st Era",
            1, 1,
            isDestroyed ? "DRAGON_SEAL_SHATTERED" : "SEAL_STRAINED",
            isDestroyed
              ? `REALITY CATACLYSM: The prison of Dragon ${grove.dragon_name} has been BROKEN by ${player.name} in Sector (${rx}, ${ry})! Leylines convulse!`
              : `METAPHYSICAL ANOMALY: ${player.name} severely damaged the ${grove.power_domain} seal in Sector (${rx}, ${ry}) (Seal: ${grove.seal_strength}%).`
          ]
        );

        // If breached, cause widespread societal panic and unrest across nearby burgs
        if (isDestroyed) {
          await this.pool.query(
            `UPDATE sim_burg_economy
             SET unrest = LEAST(100, COALESCE(unrest, 0) + 25)
             WHERE cell_id = $1 OR burg_id IN (SELECT burg_id FROM sim_burg_economy ORDER BY ABS(cell_id - $1) ASC LIMIT 3)`,
            [cellId]
          );
        }

        simDeltaNotice += ` | ⚡ SIMULATION STRAIN: Dragon ${grove.dragon_name} Seal ${isDestroyed ? 'SHATTERED (0%)' : `Damaged (-${sealDmg}% -> ${grove.seal_strength}%)`}, Chaos Zone Radiation ${Math.round(chaosIntensity * 100)}%, Shockwave Radius ${shockwaveRadius} Sectors!`;
      } catch (err) {
        console.error("Backfeed dragon seal error:", err);
      }
    }

    // E. Write-back to DB events if significant event occurred
    if (hit || objectiveUpdate.beatCompleted) {
      await this.pool.query(
        `INSERT INTO sim_events (tick, tier, lore_date, burg_id, faction_id, type, message)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          1,
          objectiveUpdate.beatCompleted ? "MAJOR" : "MINOR",
          "Cruorbus 1st Era",
          1,
          1,
          "PLAYER_ACTION",
          `${player.name} executed ${intent.verb} on ${intent.targetName}: ${hit ? "SUCCESS" : "FAILED"}`
        ]
      ).catch(() => {});
    }

    // Ensure inventory and gold from harvesting or commerce are persisted
    await this.pool.query(
      `UPDATE sim_player_character
       SET gold = $1, inventory = $2, faction_reputations = $3
       WHERE id = $4`,
      [player.gold, JSON.stringify(player.inventory || []), JSON.stringify(playerReputations), playerId]
    ).catch(() => {});

    if (simDeltaNotice) {
      systemLog += simDeltaNotice;
    }

    // 7. Grounded Sensory Narrative Synthesis (Gemini) with Persistent Memory Retrieval
    let recentMemoriesContext = "";
    try {
      const memRes = await this.pool.query(
        `SELECT summary FROM sim_gm_memories WHERE player_id = $1 ORDER BY id DESC LIMIT 3`,
        [playerId]
      );
      if (memRes.rows.length > 0) {
        recentMemoriesContext = `Recent Historical Memory Traces:\n${memRes.rows.map((r: any) => `- ${r.summary}`).reverse().join("\n")}\n`;
      }
    } catch (err) {}

    const narrativePrompt = `${recentMemoriesContext}Current Event: Player performed ${intent.verb} (${intent.category}) on ${intent.targetName}. Outcome: ${hit ? "Success" : "Failure"}. Damage: ${injuryPoints}. Tags: ${tagResult?.appliedTags?.join(", ") || "None"}. Dialogue spoken: ${inCharacterDialogue || "None"}.`;

    const narrativeResponse = customNarrative || (await this.callGeminiWithFallback(
      [{ role: "user", parts: [{ text: narrativePrompt }] }],
      "You are the Concordia Game Master for a gritty dark fantasy TTRPG. Write EXACTLY 1-2 evocative, sensory sentences describing the immediate physical aftermath of this action. Output only prose.",
      200,
      0.7
    )) || `${player.name} resolves the action against ${intent.targetName}. The environment settles in the wake of the attempt.`;

    // 8. Record Associative Memory Trace (In-Memory + Persistent PostgreSQL Table)
    const memSummary = `${intent.verb} on ${intent.targetName}: ${hit ? "Success" : "Failed"}`;
    const memTags = [intent.verb, intent.targetName, hit ? "success" : "failed"];
    this.memoryStream.push({
      timestamp: Date.now(),
      summary: memSummary,
      tags: memTags
    });
    await this.pool.query(
      `INSERT INTO sim_gm_memories (player_id, summary, tags) VALUES ($1, $2, $3)`,
      [playerId, memSummary, memTags]
    ).catch(() => {});

    return {
      success: hit,
      intent,
      rollOutcome: {
        playerRoll,
        playerStatVal,
        dcOrDefenderRoll,
        difference,
        injuryPoints,
        hit,
        ...(detailedRollOutcome || {})
      },
      tagResult,
      systemLog,
      narrativeResponse,
      dialogue: inCharacterDialogue,
      lootAwarded,
      objectiveProgress: {
        beatCompleted: objectiveUpdate.beatCompleted,
        description: objectiveUpdate.updatedObjective?.description
      },
      campaignState: this.storyEngine.getCampaignState(),
      worldDelta: {
        propsDestroyed,
        npcsDefeated
      }
    };
  }
}
