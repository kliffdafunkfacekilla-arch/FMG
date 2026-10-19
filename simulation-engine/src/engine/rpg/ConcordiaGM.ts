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

export interface ActionInput {
  actionText: string;
  playerId: number;
  playerPos: [number, number];
}

export type ActionCategory = "COMBAT" | "MAGIC" | "SOCIAL" | "SUBTERFUGE" | "EXPLORATION" | "SURVIVAL";

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
    if (!context.activeFlow || !context.dragonDomain || !context.moonPhase) {
      try {
        const calRes = await this.pool.query(
          "SELECT active_flow, dragon_domain, moon_phase FROM sim_calendar ORDER BY id DESC LIMIT 1"
        );
        if (calRes.rows.length > 0) {
          context.activeFlow = context.activeFlow || calRes.rows[0].active_flow;
          context.dragonDomain = context.dragonDomain || calRes.rows[0].dragon_domain;
          context.moonPhase = context.moonPhase || calRes.rows[0].moon_phase;
        }
      } catch (err) {
        // Fallback gracefully
      }
    }

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
          memoryNotes: Array.isArray(r.memory_notes) ? r.memory_notes : (typeof r.memory_notes === "string" ? JSON.parse(r.memory_notes) : [])
        }));
      }
    } catch (err) {
      console.error("Error querying persisted NPCs:", err);
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
            stat_affinity, stats, inventory, memory_notes, wander_anchor, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, $18,
            $19, $20, $21, $22, $23, NOW()
          ) ON CONFLICT (id) DO UPDATE SET
            local_pos = EXCLUDED.local_pos,
            current_rx = EXCLUDED.current_rx,
            current_ry = EXCLUDED.current_ry,
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
            [n.pos[0], n.pos[1]]
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
    for (const m of this.CANDIDATE_MODELS) {
      try {
        const res = await this.ai.models.generateContent({
          model: m,
          contents,
          config: {
            systemInstruction,
            temperature,
            maxOutputTokens
          }
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
        150,
        0.1
      );

      if (raw) {
        const clean = raw.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(clean);
        const category: ActionCategory = parsed.category || "COMBAT";
        const isCombat = category === "COMBAT";
        return {
          category,
          verb: (parsed.verb || "SMASH").toUpperCase(),
          targetId: parsed.targetId || (availableTargets[0]?.id || ""),
          targetName: parsed.targetName || (availableTargets[0]?.name || "Target"),
          statUsed: parsed.statUsed || "might",
          isCombat
        };
      }
    } catch (e) {
      console.warn("[ConcordiaGM] Intent parser fallback:", e);
    }

    // Heuristic Fallback
    const lower = actionText.toLowerCase();
    let category: ActionCategory = "COMBAT";
    let verb = "SLASH";
    let statUsed = "might";

    if (lower.includes("use") && (lower.includes("apply") || lower.includes("drink") || lower.includes("consume") || lower.includes("eat") || lower.includes("salve") || lower.includes("ration") || lower.includes("potion"))) {
      category = "SURVIVAL";
      verb = "USE_ITEM";
      statUsed = "vitality";
    } else if (lower.includes("forage") || lower.includes("harvest") || lower.includes("gather") || lower.includes("pick") || lower.includes("flora") || lower.includes("herb")) {
      category = "SURVIVAL";
      verb = "FORAGE";
      statUsed = "awareness";
    } else if (lower.includes("dress") || lower.includes("butcher") || lower.includes("skin") || lower.includes("pelt")) {
      category = "SURVIVAL";
      verb = "FIELD_DRESS";
      statUsed = "finesse";
    } else if (lower.includes("hunt") || lower.includes("track") || lower.includes("stalk")) {
      category = "SURVIVAL";
      verb = "HUNT";
      statUsed = "awareness";
    } else if (lower.includes("cook") || lower.includes("roast")) {
      category = "SURVIVAL";
      verb = "COOK";
      statUsed = "vitality";
    } else if (lower.includes("brew") || lower.includes("concoct")) {
      category = "SURVIVAL";
      verb = "BREW";
      statUsed = "knowledge";
    } else if (lower.includes("rest") || lower.includes("heal") || lower.includes("pause") || lower.includes("sleep") || lower.includes("bivouac")) {
      category = "SURVIVAL";
      verb = "REST";
      statUsed = "vitality";
    } else if (lower.includes("talk") || lower.includes("speak") || lower.includes("ask") || lower.includes("negotiate") || lower.includes("tell") || lower.includes("trade") || lower.includes("barter")) {
      category = "SOCIAL";
      verb = "TALK";
      statUsed = "charm";
    } else if (lower.includes("bribe") || lower.includes("pay") || lower.includes("coin") || lower.includes("gold")) {
      category = "SOCIAL";
      verb = "BRIBE";
      statUsed = "charm";
    } else if (lower.includes("intimidate") || lower.includes("threaten") || lower.includes("scare")) {
      category = "SOCIAL";
      verb = "INTIMIDATE";
      statUsed = "might";
    } else if (lower.includes("fire") || lower.includes("burn") || lower.includes("ignite")) {
      category = "MAGIC";
      verb = "IGNITE";
      statUsed = "intuition";
    } else if (lower.includes("lightning") || lower.includes("shock") || lower.includes("spell")) {
      category = "MAGIC";
      verb = "CAST_LIGHTNING";
      statUsed = "intuition";
    } else if (lower.includes("sneak") || lower.includes("shadow") || lower.includes("creep")) {
      category = "SUBTERFUGE";
      verb = "SNEAK";
      statUsed = "finesse";
    } else if (lower.includes("lock") || lower.includes("pick") || lower.includes("open")) {
      category = "SUBTERFUGE";
      verb = "PICK_LOCK";
      statUsed = "finesse";
    } else if (lower.includes("search") || lower.includes("inspect") || lower.includes("examine") || lower.includes("look")) {
      category = "EXPLORATION";
      verb = "SEARCH";
      statUsed = "awareness";
    }

    // Pick best matching target
    let matchedTarget = availableTargets[0];
    for (const t of availableTargets) {
      if (lower.includes(t.name.toLowerCase().split(" ")[0] || "")) {
        matchedTarget = t;
        break;
      }
    }

    return {
      category,
      verb,
      targetId: matchedTarget?.id || "",
      targetName: matchedTarget?.name || "Target",
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
    let tagResult: TagInteractionResult | undefined;
    let inCharacterDialogue: string | undefined;
    let lootAwarded: { gold: number; item?: string } | undefined;
    let xpGained = 0;
    let systemLog = "";

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

      // Query real simulation rumors from PostgreSQL
      let recentRumors = "";
      try {
        const eventsRes = await this.pool.query(
          `SELECT message FROM sim_events ORDER BY id DESC LIMIT 4`
        );
        if (eventsRes.rows.length > 0) {
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
      // --- EXPLORATION & SEARCH ---
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

        const combatRes = resolveOpposedCombat(
          playerAttackStatVal + advantageMod,
          attackMod,
          defStatVal,
          defMod,
          {
            attackerWeaponSpecRank: playerWeaponSpecRank,
            defenderArmorSpecRank: 0
          }
        );

        hit = combatRes.hit;
        difference = combatRes.difference;
        dcOrDefenderRoll = combatRes.defenderTotal;

        const netInjury = hit ? Math.max(1, combatRes.injuryPoints + playerWeapon.damageBonus + passiveDmgBonus - effectiveDefDR) : 0;
        injuryPoints = netInjury;

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

    // C2. Prey / Wild Game Slain or Butchered -> Decrement Eco-Prey & Replenish Provincial Food Reserves
    if ((targetNPC && !targetNPC.alive && (targetNPC.tags.includes("prey") || targetNPC.tags.includes("game"))) || (hit && (intent.verb === "FIELD_DRESS" || intent.verb === "BUTCHER"))) {
      try {
        await this.pool.query(
          `UPDATE sim_cells
           SET eco_prey = GREATEST(0.0, COALESCE(eco_prey, 10.0) - 1.0)
           WHERE id = $1`,
          [cellId]
        );
        await this.pool.query(
          `UPDATE sim_burg_economy
           SET food = COALESCE(food, 0) + 2
           WHERE cell_id = $1 OR burg_id = (SELECT burg_id FROM sim_burg_economy ORDER BY ABS(cell_id - $1) ASC LIMIT 1)`,
          [cellId]
        );
        simDeltaNotice += " | 🦌 SIMULATION: Eco-Prey -1.0, Granary Reserves +2";
      } catch (err) {
        console.error("Backfeed eco prey error:", err);
      }
    }

    // C3. Botanical Flora Foraged / Harvested -> Decrement Eco-Plants, Stockpile Herbs & Adjust Commodity Supply
    if (hit && (intent.verb === "FORAGE" || intent.verb === "HARVEST" || intent.verb === "EXAMINE_BOTANY")) {
      try {
        await this.pool.query(
          `UPDATE sim_cells
           SET eco_plants = GREATEST(0.0, COALESCE(eco_plants, 10.0) - 1.0)
           WHERE id = $1`,
          [cellId]
        );
        await this.pool.query(
          `UPDATE sim_industrial_stockpiles
           SET raw_herbs = COALESCE(raw_herbs, 0) + 1
           WHERE burg_id = (SELECT burg_id FROM sim_burg_economy ORDER BY ABS(cell_id - $1) ASC LIMIT 1)`,
          [cellId]
        );
        await this.pool.query(
          `UPDATE sim_commodity_prices
           SET global_supply = global_supply + 1,
               current_price = GREATEST(0.4, current_price * 0.99)
           WHERE commodity = 'medicine'`
        );
        simDeltaNotice += " | 🌿 SIMULATION: Eco-Flora -1.0, Apothecary Stock +1, Medicine Supply +1";
      } catch (err) {
        console.error("Backfeed flora error:", err);
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

    if (simDeltaNotice) {
      systemLog += simDeltaNotice;
    }

    // 7. Grounded Sensory Narrative Synthesis (Gemini)
    const narrativePrompt = `Event: Player performed ${intent.verb} (${intent.category}) on ${intent.targetName}. Outcome: ${hit ? "Success" : "Failure"}. Damage: ${injuryPoints}. Tags: ${tagResult?.appliedTags?.join(", ") || "None"}. Dialogue spoken: ${inCharacterDialogue || "None"}.`;

    const narrativeResponse = await this.callGeminiWithFallback(
      [{ role: "user", parts: [{ text: narrativePrompt }] }],
      "You are the Concordia Game Master for a gritty dark fantasy TTRPG. Write EXACTLY 1-2 evocative, sensory sentences describing the immediate physical aftermath of this action. Output only prose.",
      200,
      0.7
    ) || `${player.name} resolves the action against ${intent.targetName}. The environment settles in the wake of the attempt.`;

    // 8. Record Associative Memory Trace
    this.memoryStream.push({
      timestamp: Date.now(),
      summary: `${intent.verb} on ${intent.targetName}: ${hit ? "Success" : "Failed"}`,
      tags: [intent.verb, intent.targetName, hit ? "success" : "failed"]
    });

    return {
      success: hit,
      intent,
      rollOutcome: {
        playerRoll,
        playerStatVal,
        dcOrDefenderRoll,
        difference,
        injuryPoints,
        hit
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
