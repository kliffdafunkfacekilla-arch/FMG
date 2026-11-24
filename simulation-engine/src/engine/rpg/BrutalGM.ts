import { SHADOWFALL_MONTH, isChaosPeak } from "../canon/calendar.js";
/**
 * B.R.U.T.A.L. v5.0 GAME MASTER (ENTITY-COMPONENT GM)
 * ==========================================================
 * Architecture follows the Entity-Component Game Master pattern from Google DeepMind's
 * Concordia paper (arXiv:2507.08892). That is an LLM-agent design reference only; the
 * game rules are B.R.U.T.A.L. (see AGENT_RULES.md rule 4).
 * Split along the Rule-6 boundary (Phase 12.3):
 * - gm/intent.ts: intent & grounded target parsing
 * - gm/resolve.ts: pure deterministic B.R.U.T.A.L. v5.0 rules math
 * - gm/narrate.ts: tactical sight, NPC dialogue & budgeted narration
 * - gm/consequences.ts: write-backs, action ledger, backfeed & episodic memory
 */

import { ollamaGenerate, ollamaGenerateStrict } from "../llm.js";
import { Pool } from "pg";
import { TagMatrixEngine, TaggedObject } from "./TagMatrixEngine.js";
import { WhatElseStoryEngine, SectorContext, InjectedNPC, InjectedWorldState } from "./WhatElseStoryEngine.js";
import {
  resolveContestedAttack,
  resolveReadyReaction,
  AttackRollParams,
  DefenseParams,
  ContestedCombatResult,
  ReadyDeclaration,
  ReadyReactionResult,
  ClashStance,
  BrutalInjuryTier
} from "../combatResolutionEngine.js";
import {
  payAtComeDown,
  EntityInjuryState
} from "../injuryEngine.js";
import {
  createFoeStack,
  migrateFoeToStack,
  applyHitToFoe,
  applyFoeResolveLoss,
  resolveAimedAttackOnFoe,
  FoeStackState,
  FoeResolveLossReason
} from "./foeStack.js";
import { StatKey } from "./EquipmentRegistry.js";
import { ProceduralNPCGenerator, SeededPRNG } from "./ProceduralNPCGenerator.js";
import { getActiveChaosFlows, evaluatePointChaosFlowProximity, applyPlayerChaosMutation } from "../agents/chaosFlowAgent.js";
import { generateChaosSurge } from "./chaosSurgeEngine.js";
import { recruitCultistPersona, recruitWardenPersona, recruitMandatePersona } from "../agents/citizenPersonaHelper.js";
import { getOpenThreads } from "../threads/threadEngine.js";
import { parsePlayerIntent } from "./gm/intent.js";
import { resolveTurnMechanics } from "./gm/resolve.js";
import { generateTacticalVisualSight, synthesizeNpcDialogue, synthesizeTurnNarration } from "./gm/narrate.js";
import { applyTurnConsequences, recordTurnMemory } from "./gm/consequences.js";
import type { ActionCategory, ActionInput, GMResolutionOutput, ParsedIntent } from "./gm/types.js";

export type { ActionCategory, ActionInput, GMResolutionOutput, ParsedIntent };

export class BrutalGameMaster {
  private pool: Pool;
  private storyEngine: WhatElseStoryEngine;
  private memoryStream: Array<{ timestamp: number; summary: string; tags: string[] }> = [];
  private playerInjuryStates: Map<number, EntityInjuryState> = new Map();

  // Grounded World Entities currently active in sector
  public activeProps: Map<string, TaggedObject> = new Map();
  public activeNPCs: Map<string, InjectedNPC> = new Map();
  private activeContext: SectorContext | null = null;


  /** The second argument used to be a Gemini API key; the GM now uses local Ollama only (engine/llm.ts). */
  constructor(pool: Pool, _unused?: string) {
    this.pool = pool;
    this.storyEngine = new WhatElseStoryEngine();
  }

  public getStoryEngine(): WhatElseStoryEngine {
    return this.storyEngine;
  }

  /**
   * Resolves an opposed attack roll or Guard contest under B.R.U.T.A.L. v5.0 rules.
   */
  public resolveContestedAttack(
    attacker: AttackRollParams,
    defender: DefenseParams
  ): ContestedCombatResult {
    return resolveContestedAttack(attacker, defender);
  }

  /**
   * Resolves a Readied Body beat trigger, Intercept, or Shooter vs Charger reaction (v5.0 Step 10).
   */
  public resolveReadyReaction(
    ready: ReadyDeclaration,
    readiedAttack: AttackRollParams,
    triggerTargetDefense: DefenseParams,
    triggeringAttack?: { attackerParams: AttackRollParams; interceptorDefense: DefenseParams }
  ): ReadyReactionResult {
    return resolveReadyReaction(ready, readiedAttack, triggerTargetDefense, triggeringAttack);
  }

  /**
   * Migrates a legacy v4.9 foe into a v5.0 card + resolve stack (bosses keep HP & Composure).
   */
  public buildFoeStack = createFoeStack;
  public migrateFoeToStack = migrateFoeToStack;

  /**
   * Applies a hit or Resolve event to a v5.0 foe stack without rolling Shocks.
   */
  public applyHitToFoe(foe: FoeStackState, tier: BrutalInjuryTier, aimedCardName?: string) {
    return applyHitToFoe(foe, tier, aimedCardName ? { aimedCardName } : {});
  }

  public resolveAimedAttackOnFoe(
    attacker: AttackRollParams,
    defender: DefenseParams,
    foe: FoeStackState,
    aimedCardName: string
  ) {
    return resolveAimedAttackOnFoe(attacker, defender, foe, aimedCardName);
  }

  public applyFoeResolveLoss(
    foe: FoeStackState,
    reason: FoeResolveLossReason,
    options?: { composureTier?: BrutalInjuryTier | undefined; squad?: FoeStackState[] | undefined }
  ) {
    return applyFoeResolveLoss(foe, reason, options);
  }

  /** Returns or initializes a player's v5.0 injury, capacity, and owed-energy state. */
  public getPlayerInjuryState(
    playerId: number,
    playerRow?: any,
    overrides?: ActionInput["playerStats"]
  ): EntityInjuryState {
    const existing = this.playerInjuryStates.get(playerId);
    if (existing) {
      if (overrides?.stamina !== undefined) existing.stamina = overrides.stamina;
      if (overrides?.focus !== undefined) existing.focus = overrides.focus;
      if (overrides?.composure !== undefined) existing.composure = overrides.composure;
      if (overrides?.owed) existing.owed = { ...overrides.owed };
      return existing;
    }

    const maxHealth = Number(playerRow?.max_hp) || 14;
    const health = playerRow?.current_hp !== undefined ? Number(playerRow.current_hp) : maxHealth;
    const maxComposure = Number(playerRow?.max_composure) || 14;
    const composure = overrides?.composure ?? (playerRow?.composure !== undefined ? Number(playerRow.composure) : maxComposure);
    const stamina = overrides?.stamina ?? (Number(playerRow?.stamina_max) || 10);
    const focus = overrides?.focus ?? (Number(playerRow?.focus_max) || 10);

    const created: EntityInjuryState = {
      name: playerRow?.name || "Hero",
      health,
      maxHealth,
      composure,
      maxComposure,
      stamina,
      focus,
      owed: overrides?.owed ? { ...overrides.owed } : { stamina: 0, focus: 0 },
      spent: { stamina: stamina <= 0, focus: focus <= 0 },
      activeWounds: []
    };
    this.playerInjuryStates.set(playerId, created);
    return created;
  }

  /** Settles a player's Come-Down energy bill and shakes at the end of a fight/scene (v5.0 §10.1). */
  public settlePlayerComeDown(playerId: number): EntityInjuryState | null {
    const existing = this.playerInjuryStates.get(playerId);
    if (!existing) return null;
    const settled = payAtComeDown(existing);
    this.playerInjuryStates.set(playerId, settled);
    return settled;
  }

  public setTileContext(cellId: number, rx: number, ry: number, z: number = 0): void {
    if (this.activeContext) {
      this.activeContext.cellId = cellId;
      this.activeContext.rx = rx;
      this.activeContext.ry = ry;
      this.activeContext.z = z;
    } else {
      this.activeContext = {
        cellId,
        rx,
        ry,
        z,
        biomeName: "Wilderness",
        isWarzone: false,
        isFamine: false,
        chaosRadiation: 0,
        infrastructureMask: 0,
      };
    }
  }

  public clearPlayerInjuryStates(): void {
    this.playerInjuryStates.clear();
  }

  /**
   * Loads or switches sector state with WhatELSE world injection and PostgreSQL persistence.
   */
  public async loadSector(context: SectorContext, worldTick?: number): Promise<InjectedWorldState> {
    this.activeContext = context;
    const rx = context.rx ?? 105;
    const ry = context.ry ?? 112;
    const cellId = context.cellId ?? 30627;

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
        if (cal.month === SHADOWFALL_MONTH || cal.is_eclipse || isChaosPeak(cal.moon_phase)) {
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
         ORDER BY cell_dist2(b.cell_id, $1) ASC LIMIT 1`,
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

        // Real Citizen Persona Encounter: Cultists, Wardens, or Mandate of the Chain
        if (Math.random() < 0.55 && !persistedNPCs.some(n => n.role.includes("Cultist") || n.role.includes("Warden") || n.role.includes("Mandate"))) {
          // Check if an actual tracked sim_agent is at this cell
          const liveAgentRes = await this.pool.query(
            `SELECT id, name, citizen_name, profession, species, spark_tier,
                    personality_temper, personality_instinct, motivation, role, sub_role
             FROM sim_agents
             WHERE location_cell_id = $1
             LIMIT 1`,
            [cellId]
          );

          let agentData: any = null;
          let roleType: "Cultist" | "Warden" | "Chain_Zealot";

          if ((liveAgentRes.rowCount ?? 0) > 0) {
            agentData = liveAgentRes.rows[0];
            roleType = agentData.role;
          } else {
            // Query persistent pre-rendered citizen from population_demographics
            const popRes = await this.pool.query(
              "SELECT * FROM population_demographics WHERE home_cell_id = $1 ORDER BY RANDOM() LIMIT 1",
              [cellId]
            );
            if (popRes.rows.length > 0) {
              const row = popRes.rows[0];
              agentData = {
                citizen_name: row.name,
                profession: row.profession,
                species: row.species,
                spark_tier: row.spark_tier,
                personality_temper: row.temper,
                personality_instinct: row.instinct,
                motivation: row.motivation
              };
            }

            const roll = Math.random();
            roleType = roll < 0.45 ? "Cultist" : roll < 0.75 ? "Warden" : "Chain_Zealot";
          }

          let encounterNPC: InjectedNPC;

          if (roleType === "Cultist") {
            const persona = agentData || recruitCultistPersona(`Sector (${rx}, ${ry})`);
            const isPriest = agentData?.sub_role === "Cult_Priest" || Math.random() < 0.3;
            const citizenName = persona.citizen_name || persona.citizenName || "Vaelen Thorne";
            const profession = persona.profession || "Weaver";
            const temper = persona.personality_temper || persona.temper || "DESPERATE";
            const species = persona.species || "Human";
            const motivation = persona.motivation || "Seeking salvation in the primordial dark";

            encounterNPC = {
              id: `npc_cultist_${agentData?.id || Date.now()}`,
              name: `${citizenName} the ${profession} (${isPriest ? "Cult High Priest" : "Cult Infiltrator"})`,
              role: isPriest ? "Cult High Priest" : "Chaos Cultist",
              pos: [126, 126],
              tags: ["cultist", profession.toLowerCase(), species.toLowerCase(), temper.toLowerCase(), "humanoid", "armed", isPriest ? "priest" : "infiltrator"],
              faction: "Chaos Cultist Covenant",
              hp: isPriest ? 28 : 20,
              maxHp: isPriest ? 28 : 20,
              disposition: -2,
              alive: true,
              equippedWeapon: isPriest ? "Occult Chaos Scepter" : "Void Runic Dagger",
              equippedArmor: isPriest ? "Hierophant Obsidian Robes" : "Silk Cultist Vestments",
              statAffinity: "willpower",
              kingdom: "Mammal",
              species: species,
              lineage: "Humanoid",
              memoryNotes: [
                `Citizen Identity: Former ${profession} (${species})`,
                `Temperament: ${temper}`,
                `Motivation: ${motivation}`,
                `Spark Status: ${persona.spark_tier || persona.sparkTier || "DORMANT_SPARK"}`
              ],
              inventory: isPriest ? ["Forbidden Dragon Effigy", "Blackstone Shard", "Phial of Dragon Blood"] : ["Forbidden Dragon Effigy", "Pouch of Siphoned Gold"]
            };
          } else if (roleType === "Warden") {
            const persona = agentData || recruitWardenPersona();
            const isCorrupted = agentData?.sub_role === "Warden_Martyr" || Math.random() < 0.25;
            const citizenName = persona.citizen_name || persona.citizenName || "Cassian Stone";
            const profession = persona.profession || "Apothecary";
            const temper = persona.personality_temper || persona.temper || "STOIC";
            const species = persona.species || "Human";
            const motivation = persona.motivation || "Swore an oath at the Spire to hold the dragon seals";

            encounterNPC = {
              id: `npc_warden_${agentData?.id || Date.now()}`,
              name: `${citizenName} the ${profession} (${isCorrupted ? "Corrupted Warden Martyr" : "Grey Warden Sentinel"})`,
              role: isCorrupted ? "Warden Martyr" : "Grey Warden Sentinel",
              pos: [126, 126],
              tags: ["warden", profession.toLowerCase(), species.toLowerCase(), temper.toLowerCase(), "humanoid", "armed", isCorrupted ? "kamikaze" : "sentinel"],
              faction: "The Grey Wardens",
              hp: isCorrupted ? 32 : 26,
              maxHp: isCorrupted ? 32 : 26,
              disposition: isCorrupted ? -1 : 1,
              alive: true,
              equippedWeapon: isCorrupted ? "Overcharged Unstable Sigil" : "Sun-Forged Halberd",
              equippedArmor: "Steel Plated Cuirass",
              statAffinity: isCorrupted ? "fortitude" : "might",
              kingdom: "Mammal",
              species: species,
              lineage: "Humanoid",
              memoryNotes: [
                `Citizen Identity: Former ${profession} (${species})`,
                `Temperament: ${temper}`,
                `Motivation: ${motivation}`,
                `Spark Status: ${persona.spark_tier || persona.sparkTier || "SENSITIVE"}`
              ],
              inventory: isCorrupted ? ["Volatile Sigil Core", "Purifying Draught"] : ["Warden Binding Ward", "Healing Draught"]
            };
          } else {
            const persona = agentData || recruitMandatePersona(`Hinterlands (${rx}, ${ry})`);
            const citizenName = persona.citizen_name || persona.citizenName || "Lucian Cooper";
            const profession = persona.profession || "Stonemason";
            const temper = persona.personality_temper || persona.temper || "VENGEFUL";
            const species = persona.species || "Human";
            const motivation = persona.motivation || "Believes sparks are an unholy plague destroying mortal peace";

            encounterNPC = {
              id: `npc_mandate_${agentData?.id || Date.now()}`,
              name: `${citizenName} the ${profession} (Mandate Chain-Inquisitor)`,
              role: "Mandate Inquisitor",
              pos: [126, 126],
              tags: ["mandate", "null", profession.toLowerCase(), species.toLowerCase(), temper.toLowerCase(), "inquisitor", "zealot", "armed"],
              faction: "The Mandate of the Chain",
              hp: 24,
              maxHp: 24,
              disposition: -1,
              alive: true,
              equippedWeapon: "Elemental Binding Shackles",
              equippedArmor: "Dampening Lead-Studded Gambeson",
              statAffinity: "endurance",
              kingdom: "Mammal",
              species: species,
              lineage: "Humanoid",
              memoryNotes: [
                `Citizen Identity: Former ${profession} (${species})`,
                `Temperament: ${temper}`,
                `Motivation: ${motivation}`,
                "Spark Status: TRUE NULL"
              ],
              inventory: ["Elemental Siphon Chain", "Vial of Extracted Spark", "Witch-Hunter Null Brand"]
            };
          }
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

    // Synthesize real-time emergent situation using the local model (with deterministic fallback)
    let parsedEmergentProps: any[] = [];
    let parsedEmergentNPCs: any[] = [];
    try {
      const activeLife = (context.entitiesPresent || []).map(e => `${e.type} (${e.state})`).join(", ");
      const prompt = `LIVE SIMULATION CONTEXT:
Sector Coordinates: (${rx}, ${ry}) in Cell ${cellId}
Biome: ${context.biomeName || "Wilderness"}
Active Cosmic Chaos Flow: ${context.activeFlow || "Ordo"} (Cruorbus Phase: ${context.moonPhase || "The Halo"})
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

      const aiJson = await this.callModel(
        [{ role: "user", parts: [{ text: prompt }] }],
        "You are the B.R.U.T.A.L. Game Master for a living simulation sandbox RPG. Output valid JSON only, no markdown formatting.",
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
        const persona = recruitCultistPersona(`Sector (${rx}, ${ry})`);
        injected.npcs.push({
          id: `npc_blood_cultist_${cellId}_${rx}_${ry}`,
          name: `${persona.citizenName} the ${persona.profession} (Cruorbus Blood-Cultist)`,
          role: "Chaos Zealot",
          pos: [129, 122],
          tags: ["cultist", persona.profession.toLowerCase(), persona.species.toLowerCase(), persona.temper.toLowerCase(), "magic", "chaos"],
          faction: "Order of the Bleeding Eye",
          hp: 20,
          maxHp: 20,
          disposition: -2,
          alive: true,
          equippedWeapon: "Cursed Bone Wand",
          equippedArmor: "Padded Gambeson",
          statAffinity: "willpower",
          stats: { might: 4, finesse: 5, reflex: 5, endurance: 5, vitality: 5, fortitude: 4, knowledge: 7, logic: 6, awareness: 6, intuition: 7, charm: 4, willpower: 8 },
          kingdom: "Mammal",
          species: persona.species,
          lineage: "Humanoid",
          memoryNotes: [
            `Citizen Identity: Former ${persona.profession} (${persona.species})`,
            `Temperament: ${persona.temper} [${persona.instinct}]`,
            `Motivation: ${persona.motivation}`,
            `Spark Status: ${persona.sparkTier}`
          ],
          inventory: ["Phial of Dragon Blood", "Occult Talisman", "Pouch of Siphoned Gold"]
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
      this.storyEngine.setActiveBeat(storyState?.activeBeat || null);
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
      activeBeat: this.storyEngine.getActiveBeat()
    };
  }

  /**
   * GM narration, NPC dialogue and intent parsing through the local model (engine/llm.ts). Returns null
   * when Ollama is off or fails; every caller has a procedural fallback.
   */
  public async callModel(
    contents: any,
    systemInstruction: string,
    maxOutputTokens = 250,
    temperature = 0.7
  ): Promise<string | null> {
    let payload = contents;
    if (Array.isArray(contents) && contents.length === 1 && contents[0]?.parts?.[0]?.text) {
      payload = contents[0].parts[0].text;
    }
    const prompt = typeof payload === "string" ? payload : JSON.stringify(payload);
    const json = /json/i.test(systemInstruction || "") || /json/i.test(prompt);
    return ollamaGenerate(prompt, { system: systemInstruction, json, maxTokens: maxOutputTokens, temperature });
  }

  /**
   * Strict variant of callModel: throws LlmError with the exact stage and failure reason.
   */
  public async callModelStrict(
    stage: string,
    contents: any,
    systemInstruction: string,
    maxOutputTokens = 250,
    temperature = 0.7
  ): Promise<string> {
    let payload = contents;
    if (Array.isArray(contents) && contents.length === 1 && contents[0]?.parts?.[0]?.text) {
      payload = contents[0].parts[0].text;
    }
    const prompt = typeof payload === "string" ? payload : JSON.stringify(payload);
    const json = /json/i.test(systemInstruction || "") || /json/i.test(prompt);
    return ollamaGenerateStrict(prompt, { stage, system: systemInstruction, json, maxTokens: maxOutputTokens, temperature });
  }

  /**
   * COMPONENT 1: INTENT & TARGET PARSER
   * Translates natural language into structured category, verb, target, and 12-stat key.
   */
  public async parseIntent(actionText: string, strictLlm = false): Promise<ParsedIntent> {
    return parsePlayerIntent({
      actionText,
      strictLlm,
      activeProps: this.activeProps,
      activeNPCs: this.activeNPCs,
      callModel: this.callModel.bind(this),
      callModelStrict: this.callModelStrict.bind(this),
    });
  }

  /**
   * Generates a concrete spatial/visual description of the surrounding environment,
   * line-of-sight to props and NPCs, and tactical cover for the Game Master.
   */
  public generateTacticalVisualContext(
    playerPos: [number, number],
    grid?: number[] | Uint8Array,
    zLayer: number = 0
  ): string {
    return generateTacticalVisualSight(playerPos, this.activeProps, this.activeNPCs, grid, zLayer);
  }

  /**
   * Executes one full player turn along the Rule-6 pipeline:
   * 1) intent -> 2) pure rules resolve -> 3) consequences -> 4) narrate.
   */
  public async executeTurn(input: ActionInput): Promise<GMResolutionOutput> {
    const { actionText, playerId } = input;
    const strictLlm = Boolean(input.strictLlm);

    // 1. Parse Intent & Action Mode
    const intent = await this.parseIntent(actionText, strictLlm);

    // 2. Fetch Player Character from PostgreSQL
    const playerRes = await this.pool.query("SELECT * FROM sim_player_character WHERE id = $1", [playerId]);
    const player = playerRes.rows[0] || {
      id: playerId,
      name: input.playerName || "Hero",
      species: input.playerSpecies || "Humanoid",
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
        activeBeat: this.storyEngine.getActiveBeat(),
        openThreads: [],
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

    // 4. Deterministic B.R.U.T.A.L. v5.0 Rules Resolution
    const mech = await resolveTurnMechanics({
      input,
      intent,
      player,
      playerId,
      playerStatVal,
      initialPlayerComposure: playerComposure,
      playerMaxComposure,
      playerReputations,
      targetProp,
      targetNPC,
      targetObj,
      activeProps: this.activeProps,
      activeContext: this.activeContext,
      ops: {
        resolveContestedAttack: this.resolveContestedAttack.bind(this),
        applyHitToFoe: this.applyHitToFoe.bind(this),
        applyFoeResolveLoss: this.applyFoeResolveLoss.bind(this),
        getPlayerInjuryState: this.getPlayerInjuryState.bind(this),
        setPlayerInjuryState: (pid, state) => { this.playerInjuryStates.set(pid, state); },
        getActiveBeat: () => this.storyEngine.getActiveBeat(),
        applyPlayerChaosMutation: (elementalPower, cause) =>
          applyPlayerChaosMutation(
            this.pool,
            playerId,
            elementalPower,
            (this.activeContext as any)?.tick || 1,
            cause
          ),
      },
    });
    if (mech.earlyReturn) {
      return mech.earlyReturn;
    }

    playerComposure = mech.playerComposure;
    let inCharacterDialogue: string | undefined;
    if (mech.socialDialogueRequest) {
      inCharacterDialogue = await synthesizeNpcDialogue({
        pool: this.pool,
        activeContext: this.activeContext,
        req: mech.socialDialogueRequest,
        strictLlm,
        callModel: this.callModel.bind(this),
        callModelStrict: this.callModelStrict.bind(this),
      });
    }

    // 5. Physical Write-backs, Action Ledger, Simulation Backfeed & Progression
    const consequences = await applyTurnConsequences({
      pool: this.pool,
      input,
      intent,
      player,
      playerId,
      initialPlayerComposure: playerComposure,
      playerMaxComposure,
      playerReputations,
      targetProp,
      targetNPC,
      activeProps: this.activeProps,
      activeNPCs: this.activeNPCs,
      activeContext: this.activeContext,
      hit: mech.hit,
      difference: mech.difference,
      propLooted: mech.propLooted,
      lootAwarded: mech.lootAwarded,
      xpGained: mech.xpGained,
      initialSystemLog: mech.systemLog,
    });
    playerComposure = consequences.playerComposure;
    const systemLog = consequences.systemLog;

    // 6. Grounded Sensory Narrative Synthesis via StoryContext Pack
    const narrativeResponse = await synthesizeTurnNarration({
      pool: this.pool,
      activeContext: this.activeContext,
      activeProps: this.activeProps,
      activeNPCs: this.activeNPCs,
      input,
      player,
      playerId,
      intent,
      playerRoll: mech.playerRoll,
      playerStatVal,
      dcOrDefenderRoll: mech.dcOrDefenderRoll,
      difference: mech.difference,
      hit: mech.hit,
      injuryPoints: mech.injuryPoints,
      detailedRollOutcome: mech.detailedRollOutcome,
      lootAwarded: mech.lootAwarded,
      inCharacterDialogue,
      systemLog,
      customNarrative: mech.customNarrative,
      strictLlm,
      callModel: this.callModel.bind(this),
      callModelStrict: this.callModelStrict.bind(this),
    });

    // 7. Record Associative Memory Trace
    await recordTurnMemory({
      pool: this.pool,
      memoryStream: this.memoryStream,
      playerId,
      intent,
      hit: mech.hit,
    });

    const openThreads = this.activeContext?.cellId
      ? await getOpenThreads(this.pool, this.activeContext.cellId).catch(() => [])
      : [];

    return {
      success: mech.hit,
      intent,
      rollOutcome: {
        playerRoll: mech.playerRoll,
        playerStatVal,
        dcOrDefenderRoll: mech.dcOrDefenderRoll,
        difference: mech.difference,
        injuryPoints: mech.injuryPoints,
        hit: mech.hit,
        ...(mech.detailedRollOutcome || {})
      },
      tagResult: mech.tagResult,
      systemLog,
      narrativeResponse,
      dialogue: inCharacterDialogue,
      lootAwarded: mech.lootAwarded,
      playerInjuryState: this.playerInjuryStates.get(playerId),
      foeStackState: targetNPC?.foeStack,
      activeBeat: this.storyEngine.getActiveBeat(),
      openThreads,
      worldDelta: {
        propsDestroyed: consequences.propsDestroyed,
        npcsDefeated: consequences.npcsDefeated
      }
    };
  }
}

// Backward-compatibility alias for legacy imports
