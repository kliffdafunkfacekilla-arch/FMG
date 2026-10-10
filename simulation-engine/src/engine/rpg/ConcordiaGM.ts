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
import { WhatElseStoryEngine, StoryBeat, SectorContext, InjectedNPC } from "./WhatElseStoryEngine.js";
import { resolveMeleeAttack, resolveOpposedCombat } from "./RulesEngine.js";
import { getWeapon, getArmor, StatKey, WeaponDef, ArmorDef } from "./EquipmentRegistry.js";

export interface ActionInput {
  actionText: string;
  playerId: number;
  playerPos: [number, number];
}

export type ActionCategory = "COMBAT" | "MAGIC" | "SOCIAL" | "SUBTERFUGE" | "EXPLORATION";

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

  private readonly CANDIDATE_MODELS = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-flash-latest"];

  constructor(pool: Pool, apiKey: string) {
    this.pool = pool;
    this.ai = new GoogleGenAI({ apiKey: apiKey || "" });
    this.storyEngine = new WhatElseStoryEngine();
  }

  public getStoryEngine(): WhatElseStoryEngine {
    return this.storyEngine;
  }

  /**
   * Loads or switches sector state with WhatELSE world injection.
   */
  public loadSector(context: SectorContext) {
    const beat = this.storyEngine.generateBeatFromSector(context);
    const injected = this.storyEngine.injectWorldStateForBeat(beat, context);

    this.activeProps.clear();
    this.activeNPCs.clear();

    injected.props.forEach(p => this.activeProps.set(p.id, p));
    injected.npcs.forEach(n => this.activeNPCs.set(n.id, n));

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
  "category": "COMBAT|MAGIC|SOCIAL|SUBTERFUGE|EXPLORATION",
  "verb": "SLASH|STAB|SMASH|CAST_FIRE|CAST_LIGHTNING|IGNITE|TALK|PERSUADE|INTIMIDATE|BRIBE|DECEIVE|SNEAK|PICK_LOCK|UNLOCK|INSPECT|SEARCH|REST",
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

    if (lower.includes("talk") || lower.includes("speak") || lower.includes("ask") || lower.includes("negotiate") || lower.includes("tell")) {
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
    } else if (lower.includes("rest") || lower.includes("heal") || lower.includes("pause")) {
      category = "EXPLORATION";
      verb = "REST";
      statUsed = "vitality";
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
    let systemLog = "";

    // 4. Multi-Faceted Concordia Resolution
    if (intent.category === "SOCIAL" && targetNPC) {
      // --- SOCIAL RESOLUTION (Does not deal physical weapon damage) ---
      let socialDC = 11;
      if (targetNPC.disposition > 0) socialDC -= 3;
      if (targetNPC.disposition < -1) socialDC += 2;

      if (intent.verb === "BRIBE") {
        if (targetNPC.tags.includes("bribeable") || targetNPC.tags.includes("greedy")) {
          socialDC -= 4; // Advantage
        }
        if (player.gold >= 10) {
          player.gold -= 10;
        } else {
          socialDC += 5; // Insufficient coin
        }
      } else if (intent.verb === "INTIMIDATE") {
        if (targetNPC.tags.includes("fearful") || targetNPC.tags.includes("intimidatable")) {
          socialDC -= 4;
        }
        if (targetNPC.tags.includes("unyielding") || targetNPC.tags.includes("fanatical")) {
          socialDC += 5;
        }
      } else if (intent.verb === "PERSUADE") {
        if (targetNPC.tags.includes("fanatical")) socialDC += 5;
        if (targetNPC.tags.includes("talkative")) socialDC -= 3;
      }

      dcOrDefenderRoll = socialDC;
      difference = (playerRoll + playerStatVal) - socialDC;
      hit = difference >= 0;

      // Adjust disposition on success
      if (hit) {
        targetNPC.disposition = Math.min(2, targetNPC.disposition + 1);
      } else if (intent.verb === "INTIMIDATE") {
        targetNPC.disposition = Math.max(-2, targetNPC.disposition - 1);
      }

      // Generate In-Character Dialogue via Gemini GABM
      const dialoguePrompt = `You are ${targetNPC.name}, a ${targetNPC.role} aligned with '${targetNPC.faction}'. Your traits are: [${targetNPC.tags.join(", ")}].
The player spoke: "${actionText}".
Social check result: ${hit ? "SUCCESS" : "FAILURE"} (Roll: ${playerRoll + playerStatVal} vs DC ${socialDC}). Current disposition: ${targetNPC.disposition}.
Speak 1-2 sentences of direct in-character spoken dialogue in quotation marks responding to the player. Mention your faction or secret motives.`;

      const dialogueRes = await this.callGeminiWithFallback(
        [{ role: "user", parts: [{ text: dialoguePrompt }] }],
        "You are an actor playing an authentic dark fantasy character. Output only spoken dialogue in quotation marks.",
        150,
        0.8
      );

      inCharacterDialogue = dialogueRes || (hit
        ? `"${targetNPC.name} relaxes their guard. 'Very well, traveler. If you seek what was taken, look to the old ruins.'"`
        : `"${targetNPC.name} sneers with contempt. 'Your hollow words carry no weight here. Begone or draw steel!'"`
      );

      systemLog = `[${intent.statUsed.toUpperCase()} CHECK: ${playerRoll + playerStatVal} vs DC ${socialDC} | SOCIAL ${hit ? "SUCCESS" : "FAILURE"}]`;

    } else if (intent.category === "SUBTERFUGE") {
      // --- SUBTERFUGE & THIEVERY ---
      dcOrDefenderRoll = 12;
      difference = (playerRoll + playerStatVal) - dcOrDefenderRoll;
      hit = difference >= 0;

      if (hit && targetProp && targetProp.tags.has("locked")) {
        targetProp.tags.delete("locked");
        targetProp.tags.add("unlocked");
        const foundGold = Math.floor(Math.random() * 30) + 15;
        const foundItem = "Smuggled Aetheric Draught";
        player.gold = (player.gold || 0) + foundGold;
        lootAwarded = { gold: foundGold, item: foundItem };
        systemLog = `[FINESSE CHECK: ${playerRoll + playerStatVal} vs 12 | SUCCESS: Lock picked! Found ${foundGold} Gold & ${foundItem}]`;
      } else if (hit) {
        systemLog = `[FINESSE CHECK: ${playerRoll + playerStatVal} vs 12 | SUCCESS: Shadowed bypass successful]`;
      } else {
        systemLog = `[FINESSE CHECK: ${playerRoll + playerStatVal} vs 12 | FAILED: Lock mechanism resists or alert triggered]`;
      }

    } else if (intent.category === "EXPLORATION") {
      // --- EXPLORATION & REST ---
      if (intent.verb === "REST") {
        dcOrDefenderRoll = 8;
        difference = (playerRoll + playerStatVal) - dcOrDefenderRoll;
        hit = difference >= 0;
        const healAmt = hit ? 4 : 2;
        player.current_hp = Math.min(player.max_hp || 14, (player.current_hp || 14) + healAmt);
        systemLog = `[VITALITY REST: ${playerRoll + playerStatVal} vs 8 | SUCCESS: Bandaged wounds, recovered +${healAmt} HP]`;
      } else {
        dcOrDefenderRoll = 10;
        difference = (playerRoll + playerStatVal) - dcOrDefenderRoll;
        hit = difference >= 0;
        if (hit && targetProp && targetProp.tags.has("container")) {
          const foundGold = Math.floor(Math.random() * 20) + 10;
          player.gold = (player.gold || 0) + foundGold;
          lootAwarded = { gold: foundGold };
          systemLog = `[AWARENESS INSPECT: ${playerRoll + playerStatVal} vs 10 | SUCCESS: Discovered hidden cache of ${foundGold} Gold]`;
        } else {
          systemLog = `[AWARENESS INSPECT: ${playerRoll + playerStatVal} vs 10 | ${hit ? "SUCCESS: Uncovered structural flaws" : "NOTHING FOUND"}]`;
        }
      }

    } else if (intent.category === "MAGIC") {
      // --- ELEMENTAL / OCCULT MAGIC ---
      dcOrDefenderRoll = 11;
      difference = (playerRoll + playerStatVal) - dcOrDefenderRoll;
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
      systemLog = `[INTUITION MAGIC: ${playerRoll + playerStatVal} vs 11 | ${hit ? "SUCCESS: Spell manifested" : "DISPELLED"} | ${injuryPoints} Magic Damage]`;

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
        if (targetNPC.tags?.includes("vulnerable") || targetNPC.tags?.includes("burning")) advantageMod += 2;
        if (targetNPC.tags?.includes("cover_heavy") || targetNPC.tags?.includes("unyielding")) advantageMod -= 2;

        const combatRes = resolveOpposedCombat(
          playerAttackStatVal + advantageMod,
          attackMod,
          defStatVal,
          defMod
        );

        hit = combatRes.hit;
        difference = combatRes.difference;
        dcOrDefenderRoll = combatRes.defenderTotal;

        const netInjury = hit ? Math.max(1, combatRes.injuryPoints + playerWeapon.damageBonus - defArmor.damageReduction) : 0;
        injuryPoints = netInjury;

        if (hit) {
          targetNPC.hp = Math.max(0, targetNPC.hp - (netInjury * 4));
          if (targetNPC.hp === 0) {
            targetNPC.alive = false;
            const lootGold = Math.floor(Math.random() * 25) + 15;
            player.gold = (player.gold || 0) + lootGold;
            const droppedItem = Math.random() < 0.5 ? defWeapon.name : defArmor.name;
            lootAwarded = { gold: lootGold, item: droppedItem };
          }
        }

        tagResult = TagMatrixEngine.resolveInteraction(
          player.name || "Hero",
          intent.verb,
          targetObj!,
          playerWeapon.tags,
          Array.from(this.activeProps.values())
        );

        systemLog = `[ATTACK (${attackStatKey.toUpperCase()} - ${playerWeapon.name}): ${combatRes.attackerTotal} vs DEFENSE (${defStatKey.toUpperCase()} - ${defArmor.name}): ${combatRes.defenderTotal} | ${hit ? "HIT" : "DEFLECTED"} | ${netInjury} Injury Points dealt] ${tagResult?.logs?.slice(1).join(" ") || ""}`.trim();

        // NPC retaliation if still alive and hostile
        if (targetNPC.alive && targetNPC.disposition <= -1) {
          const npcAtkStatVal = targetNPC.stats?.[defWeapon.stat] ?? 5;
          const playerDefStatVal = Number(player[playerArmor.stat]) || 5;
          const retaliationRes = resolveOpposedCombat(
            npcAtkStatVal,
            defWeapon.mod,
            playerDefStatVal,
            playerArmor.mod
          );
          if (retaliationRes.hit) {
            const retaliationDmg = Math.max(1, retaliationRes.injuryPoints + defWeapon.damageBonus - playerArmor.damageReduction);
            player.current_hp = Math.max(0, (player.current_hp || 14) - retaliationDmg);
            systemLog += ` | [RETALIATION (${defWeapon.stat.toUpperCase()} - ${defWeapon.name}): ${retaliationRes.attackerTotal} vs ${playerArmor.name} (${playerArmor.stat.toUpperCase()}): ${retaliationRes.defenderTotal} -> -${retaliationDmg} HP (${player.current_hp}/${player.max_hp})]`;
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
    if (targetNPC && !targetNPC.alive) {
      npcsDefeated.push(targetNPC.name);
      this.activeNPCs.delete(targetNPC.id);
    }

    // Persist player stat mutations (HP, Gold, Inventory)
    if (lootAwarded?.item) {
      player.inventory = Array.isArray(player.inventory) ? player.inventory : [];
      player.inventory.push(lootAwarded.item);
    }
    await this.pool.query(
      `UPDATE sim_player_character
       SET current_hp = $1, gold = $2, inventory = $3
       WHERE id = $4`,
      [player.current_hp, player.gold, JSON.stringify(player.inventory || []), playerId]
    ).catch(() => {});

    // Write-back to DB events if significant event occurred
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
