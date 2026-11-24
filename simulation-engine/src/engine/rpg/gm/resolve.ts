/**
 * Component 2 (Rule 6): Pure deterministic B.R.U.T.A.L. v5.0 turn resolution across Social,
 * Subterfuge, Survival, Exploration, Magic, Creative Check, and Combat categories.
 */
import {
  rollD12,
  resolveClashTie,
  AttackRollParams,
  DefenseParams,
  ContestedCombatResult,
  ClashStance,
  BrutalInjuryTier
} from "../../combatResolutionEngine.js";
import { applyBrutalInjury, EntityInjuryState } from "../../injuryEngine.js";
import { applyHitToFoe, getTotalFoeCards, FoeStackState, FoeResolveLossReason } from "../foeStack.js";
import { getWeapon, getArmor, StatKey } from "../EquipmentRegistry.js";
import { resolvePersuasion, resolveOpposedSocialContest, SocialCombatant } from "../../socialCombat.js";
import { computeActionDC, ATOMIC_TAG_ACTIONS } from "../TagRegistry.js";
import { TagMatrixEngine, TaggedObject, TagInteractionResult } from "../TagMatrixEngine.js";
import { InjectedNPC, SectorContext } from "../WhatElseStoryEngine.js";
import {
  ActionInput,
  ensureNpcFoeStack,
  extractStatsMap,
  GmMechanicsResult,
  ParsedIntent,
  SocialDialogueRequest
} from "./types.js";

export interface ResolveMechanicsOps {
  resolveContestedAttack: (attacker: AttackRollParams, defender: DefenseParams) => ContestedCombatResult;
  applyHitToFoe: (foe: FoeStackState, tier: BrutalInjuryTier, aimedCardName?: string) => ReturnType<typeof applyHitToFoe>;
  applyFoeResolveLoss: (
    foe: FoeStackState,
    reason: FoeResolveLossReason,
    options?: { composureTier?: BrutalInjuryTier | undefined; squad?: FoeStackState[] | undefined }
  ) => any;
  getPlayerInjuryState: (playerId: number, playerRow?: any, overrides?: ActionInput["playerStats"]) => EntityInjuryState;
  setPlayerInjuryState: (playerId: number, state: EntityInjuryState) => void;
  getActiveBeat: () => any;
  applyPlayerChaosMutation: (elementalPower: string, cause: string) => Promise<{ name: string; description: string; statModifiers: any }>;
}

export async function resolveTurnMechanics(params: {
  input: ActionInput;
  intent: ParsedIntent;
  player: any;
  playerId: number;
  playerStatVal: number;
  initialPlayerComposure: number;
  playerMaxComposure: number;
  playerReputations: Record<string, number>;
  targetProp: TaggedObject | undefined;
  targetNPC: InjectedNPC | undefined;
  targetObj: TaggedObject | null;
  activeProps: Map<string, TaggedObject>;
  activeContext: SectorContext | null;
  ops: ResolveMechanicsOps;
}): Promise<GmMechanicsResult> {
  const {
    input,
    intent,
    player,
    playerId,
    playerStatVal,
    initialPlayerComposure,
    playerMaxComposure,
    playerReputations,
    targetProp,
    targetNPC,
    targetObj,
    activeProps,
    activeContext,
    ops,
  } = params;

  const { actionText } = input;
  const playerComposure = initialPlayerComposure;
  const playerRoll = rollD12().final;
  let dcOrDefenderRoll = 7;
  let difference = 0;
  let hit = false;
  let injuryPoints = 0;
  let detailedRollOutcome: any = null;
  let tagResult: TagInteractionResult | undefined;
  let lootAwarded: { gold: number; item?: string } | undefined;
  let propLooted = false;
  let xpGained = 0;
  let systemLog = "";
  let customNarrative: string | undefined;
  let socialDialogueRequest: SocialDialogueRequest | undefined;

  const targetTagsList: string[] = targetProp
    ? (Array.isArray(targetProp.tags) ? targetProp.tags : Array.from(targetProp.tags))
    : (targetNPC ? targetNPC.tags : []);

  const playerInv: string[] = Array.isArray(player.inventory) ? player.inventory : [];

  const matchedActionDef = ATOMIC_TAG_ACTIONS.find((a) => a.verb === intent.verb) ||
    ATOMIC_TAG_ACTIONS.find((a) => a.stat === intent.statUsed && targetTagsList.some((t) => t.toLowerCase() === a.tagRequired.toLowerCase()));

  const calculatedDCInfo = matchedActionDef
    ? computeActionDC(matchedActionDef, targetTagsList, playerInv)
    : { dc: 11, breakdown: { base: 11, materialMod: 0, toolBonus: 0 } };

  const dynamicDC = calculatedDCInfo.dc;
  const dynamicToolBonus = calculatedDCInfo.breakdown.toolBonus;
  const toolBonusNotice = dynamicToolBonus > 0 ? ` (+${dynamicToolBonus} Tool)` : "";

  if (intent.category === "SOCIAL") {
    if (targetProp && !targetNPC) {
      return {
        earlyReturn: {
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
          activeBeat: ops.getActiveBeat(),
          openThreads: [],
          worldDelta: { propsDestroyed: [], npcsDefeated: [] }
        },
        playerRoll,
        dcOrDefenderRoll: 10,
        difference: -10,
        hit: false,
        injuryPoints: 0,
        detailedRollOutcome: null,
        propLooted: false,
        xpGained: 0,
        playerComposure,
        systemLog: "",
      };
    }

    if (targetNPC && targetNPC.tags && (targetNPC.tags.includes("beast") || targetNPC.tags.includes("prey") || targetNPC.tags.includes("predator"))) {
      const animalDC = 12;
      const animalStatVal = Number(player.intuition) || 5;
      const animalRoll = playerRoll + animalStatVal;
      const animalDiff = animalRoll - animalDC;
      const animalHit = animalDiff >= 0;
      return {
        earlyReturn: {
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
          activeBeat: ops.getActiveBeat(),
          openThreads: [],
          worldDelta: { propsDestroyed: [], npcsDefeated: [] }
        },
        playerRoll,
        dcOrDefenderRoll: animalDC,
        difference: animalDiff,
        hit: animalHit,
        injuryPoints: 0,
        detailedRollOutcome: null,
        propLooted: false,
        xpGained: 0,
        playerComposure,
        systemLog: "",
      };
    }

    // --- SOCIAL RESOLUTION (v5.0 Persuasion vs Composure Combat) ---
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

    const verbUpper = (intent.verb || "TALK").toUpperCase();
    const nonHostileSocialVerbs = new Set([
      "TALK", "ASK", "QUESTION", "CONVINCE", "BARGAIN", "BRIBE", "NEGOTIATE", "PERSUADE", "GREET", "PLEAD"
    ]);
    const isNonHostilePersuasion = nonHostileSocialVerbs.has(verbUpper);
    const inFight = Boolean(
      targetNPC &&
      targetNPC.alive !== false &&
      targetNPC.hp > 0 &&
      (targetNPC.disposition <= -2 || targetNPC.tags?.includes("#Hostile") || targetNPC.tags?.includes("hostile_combat"))
    );
    const currentTargetComposure = targetNPC?.composure ?? 12;
    const maxTargetComposure = targetNPC?.maxComposure ?? 12;

    let remainingTargetComposure = currentTargetComposure;
    let isMoraleBroken = false;
    let socialOutcomeNote = "";

    if (isNonHostilePersuasion) {
      const lowerAct = actionText.toLowerCase();
      const isDutyGuard = /\b(guard|warden|watch|sentinel|commander|captain)\b/i.test(npcRole);
      const targetTags = targetNPC?.tags || [];
      const crossesHardLine =
        (targetTags.includes("#Line_NeverInformOnNeighbors") && /\b(inform on|rat out|turn in|snitch|betray)\b.*\b(neighbor|worker|guildmate|friend|ally)\b/.test(lowerAct)) ||
        (targetTags.includes("#Line_NeverBetrayTheCabal") && /\b(betray|reveal|name|expose)\b.*\b(cabal|cult|cultist|altar)\b/.test(lowerAct)) ||
        (targetTags.includes("#Line_NeverForgeCharters") && /\b(forge|falsify|alter)\b.*\b(charter|ledger|tally|tallies)\b/.test(lowerAct)) ||
        (targetTags.includes("#Line_NeverEndangerFamily") && /\b(endanger|sacrifice|hand over)\b.*\b(family|child|children|household)\b/.test(lowerAct));
      const againstOrders = Boolean(
        verbUpper !== "BRIBE" &&
        (crossesHardLine ||
          (isDutyGuard && /\b(abandon post|desert|betray|treason|unlock the prison|open the vault)\b/.test(lowerAct)))
      );
      const propBonus = (intent.verb === "BRIBE" && player.gold >= 0 ? 2 : 0) + (targetFactionRep >= 25 ? 2 : 0);
      const persRes = resolvePersuasion({
        speakerStatVal: playerStatVal,
        propValue: propBonus,
        targetComposure: currentTargetComposure,
        againstOrders,
        otherSpeakersCount: input.otherSpeakersCount,
        alreadySpokenToTargetThisRound: input.alreadySpokenToTargetThisRound,
        hasAdvantage: advantageMod >= 2,
        hasDisadvantage: advantageMod <= -2
      });

      hit = persRes.succeeded;
      difference = persRes.margin;
      dcOrDefenderRoll = persRes.difficulty;
      injuryPoints = 0;

      if (targetNPC && hit) {
        targetNPC.disposition = Math.min(2, (targetNPC.disposition || 0) + 1);
        xpGained += persRes.outcome === "YES_AND_MORE" ? 30 : 20;
      } else if (hit) {
        xpGained += 20;
      }

      detailedRollOutcome = {
        attackerRoll: persRes.roll?.final ?? 0,
        attackerStatKey: intent.statUsed,
        attackerStatVal: playerStatVal,
        attackerMod: propBonus,
        attackerTotal: persRes.total,
        defenderRoll: 0,
        defenderStatKey: "composure",
        defenderStatVal: currentTargetComposure,
        defenderMod: 0,
        defenderTotal: persRes.difficulty
      };

      socialOutcomeNote = `v5.0 Persuasion (${persRes.outcome}, 0 wounds)`;
      systemLog = `[Social Check (v5.0 Persuasion): Roll ${persRes.roll?.final ?? 0} + ${playerStatVal}${propBonus ? ` + ${propBonus}` : ""} = ${persRes.total} vs Composure ${persRes.difficulty} -> Margin ${persRes.margin >= 0 ? "+" : ""}${persRes.margin} (${persRes.outcome}) | 0 wounds]`;
      if (inFight) {
        systemLog += " | [In-Fight Talk (v5.0): Free speech, 0 Composure wounds]";
      }
    } else {
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
        composure: currentTargetComposure,
        maxComposure: maxTargetComposure
      };

      const contestRes = resolveOpposedSocialContest(
        playerSocialCombatant,
        npcSocialCombatant,
        intent.statUsed as StatKey,
        { advantageMod, inFight }
      );

      hit = contestRes.hit;
      difference = contestRes.difference;
      dcOrDefenderRoll = contestRes.defenderTotal;
      injuryPoints = contestRes.composureDamage;
      remainingTargetComposure = contestRes.defenderComposureRemaining;
      isMoraleBroken = contestRes.isBroken;

      if (targetNPC) {
        targetNPC.composure = remainingTargetComposure;

        if (!inFight && contestRes.composureDamage > 0) {
          const npcStack = ensureNpcFoeStack(targetNPC);
          if (!npcStack.isBoss) {
            const tier: BrutalInjuryTier = contestRes.composureDamage >= 6 ? "CRITICAL" : contestRes.composureDamage >= 4 ? "MAJOR" : "MINOR";
            const rLoss = ops.applyFoeResolveLoss(npcStack, "COMPOSURE_ATTACK", { composureTier: tier });
            targetNPC.foeStack = rLoss.foe;
            if (rLoss.foe.status === "seeking_exit" || rLoss.foe.status === "broken") {
              targetNPC.disposition = Math.max(1, targetNPC.disposition || 0);
              if (!targetNPC.tags.includes("#Yielded")) targetNPC.tags.push("#Yielded");
            }
          }
        }

        if (hit) {
          targetNPC.disposition = Math.min(2, targetNPC.disposition + 1);
          xpGained += 25;
        } else if (intent.verb === "INTIMIDATE") {
          targetNPC.disposition = Math.max(-2, targetNPC.disposition - 1);
        }

        if (contestRes.isBroken) {
          targetNPC.disposition = Math.max(1, targetNPC.disposition);
          xpGained += 50;
        }
      } else {
        if (hit) xpGained += 25;
        if (contestRes.isBroken) xpGained += 50;
      }

      socialOutcomeNote = `${contestRes.composureDamage} Composure trauma dealt. Remaining Composure: ${remainingTargetComposure}/${maxTargetComposure}`;
      systemLog = contestRes.log;
    }

    socialDialogueRequest = {
      npcName,
      npcRole,
      npcFaction,
      targetNPC,
      targetFactionRep,
      actionText,
      hit,
      socialOutcomeNote,
      isMoraleBroken,
    };

  } else if (intent.category === "SUBTERFUGE") {
    dcOrDefenderRoll = dynamicDC;
    const totalSubterfugeRoll = playerRoll + playerStatVal + dynamicToolBonus;
    difference = totalSubterfugeRoll - dcOrDefenderRoll;
    hit = difference >= 0;

    if (hit && targetProp && targetProp.tags.has("locked")) {
      targetProp.tags.delete("locked");
      targetProp.tags.add("unlocked");
      const foundGold = Math.floor(Math.random() * 30) + 15;
      let foundItem = "Smuggled Aetheric Draught";
      if (activeContext?.activeFlow) {
        foundItem = `${activeContext.activeFlow} Resonant Charm`;
      } else if (activeContext?.infrastructureMask && (activeContext.infrastructureMask & 4)) {
        foundItem = "Cartel Skeleton Key";
      } else if (activeContext?.infrastructureMask && (activeContext.infrastructureMask & 8)) {
        foundItem = "Ancient Inscribed Relic";
      }
      player.gold = (player.gold || 0) + foundGold;
      const inv = Array.isArray(player.inventory) ? player.inventory : [];
      inv.push(foundItem);
      player.inventory = inv;
      lootAwarded = { gold: foundGold, item: foundItem };
      propLooted = true;
      xpGained += 35;
      systemLog = `[${intent.statUsed.toUpperCase()} CHECK${toolBonusNotice}: ${totalSubterfugeRoll} vs DC ${dynamicDC} | SUCCESS: Lock bypassed! Found ${foundGold} Gold & ${foundItem}]`;
    } else if (hit) {
      xpGained += 15;
      systemLog = `[${intent.statUsed.toUpperCase()} CHECK${toolBonusNotice}: ${totalSubterfugeRoll} vs DC ${dynamicDC} | SUCCESS: Subterfuge bypass successful]`;
    } else {
      systemLog = `[${intent.statUsed.toUpperCase()} CHECK${toolBonusNotice}: ${totalSubterfugeRoll} vs DC ${dynamicDC} | FAILED: Lock mechanism resists or alert triggered]`;
    }

  } else if (intent.category === "SURVIVAL") {
    if (intent.verb === "USE_ITEM") {
      dcOrDefenderRoll = 6;
      difference = (playerRoll + playerStatVal) - dcOrDefenderRoll;
      hit = true;
      const inv = Array.isArray(player.inventory) ? player.inventory : [];
      let itemIndex = inv.findIndex((it: string) => actionText.toLowerCase().includes(it.toLowerCase()) || it.toLowerCase().includes(intent.targetName.toLowerCase()));
      if (itemIndex === -1 && inv.length > 0) itemIndex = 0;
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
      const restoredComposure = playerMaxComposure;
      systemLog = `[${intent.statUsed.toUpperCase()} REST: ${totalRoll} vs DC ${dynamicDC} | RECOVERED: Camped by fire; restored full HP (${player.current_hp}/${player.max_hp}) and anchored mental Composure (${restoredComposure}/${playerMaxComposure})!]`;
      return {
        playerRoll,
        dcOrDefenderRoll,
        difference,
        hit,
        injuryPoints,
        detailedRollOutcome,
        tagResult,
        lootAwarded,
        propLooted,
        xpGained,
        playerComposure: restoredComposure,
        systemLog,
        customNarrative,
      };

    } else {
      dcOrDefenderRoll = dynamicDC;
      const totalRoll = playerRoll + playerStatVal + dynamicToolBonus;
      difference = totalRoll - dcOrDefenderRoll;
      hit = difference >= 0;
      systemLog = `[${intent.statUsed.toUpperCase()} SURVIVAL${toolBonusNotice}: ${totalRoll} vs DC ${dynamicDC} | ${hit ? "SUCCESS: Action executed" : "FAILED: Obstacle resisted"}]`;
    }

  } else if (intent.category === "EXPLORATION") {
    const isChaosFlowCrossing = intent.verb === "CROSS_CHAOS_FLOW" ||
      Boolean(targetProp && (targetProp.tags.has("chaos_flow") || targetProp.tags.has("narrow_ford"))) ||
      (/\b(cross|ford|traverse|leap across|jump across|fly across|swim across|wade|brave the ford)\b/i.test(actionText) && Boolean(activeContext?.chaosFlow?.intersected || activeContext?.chaosFlow?.nearNarrowSpot));

    if (isChaosFlowCrossing) {
      const airshipItem = playerInv.find(it => /airship|skyship|sky vessel|cloud cruiser|aetheric craft|aether glider/i.test(it));
      const flowInfo = activeContext?.chaosFlow?.nearestFlow || {
        name: "Primordial Chaos Torrent",
        dragonName: "Chaos Dragon",
        elementalPower: activeContext?.activeFlow || "Flux",
        currentSurge: 1.5,
        currentWidth: 32
      };
      const isAtNarrow = Boolean(
        activeContext?.chaosFlow?.nearNarrowSpot ||
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
        const narrowDC = activeContext?.chaosFlow?.narrowSpot?.crossingDC || Math.min(23, Math.max(12, Math.round(13 + (flowInfo.currentSurge || 1.0) * 3.2)));
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
          const mutation = await ops.applyPlayerChaosMutation(
            flowInfo.elementalPower,
            `Narrow Ford Hazard (${flowInfo.name})`
          );
          systemLog = `[NARROW FORD SPRINT | FAILED: Rolled ${totalRoll} vs DC ${narrowDC} | Washed by ${flowInfo.name}! Sustained ${chaosDmg} unmitigated chaos damage and contracted MUTATION: ${mutation.name} (${JSON.stringify(mutation.statModifiers)})!]`;
          customNarrative = `Halfway across the narrow ford, an unexpected gravitic surge knocks you off balance! Your foot slips on the glassy crystal shelf, and a cataract of raw ${flowInfo.elementalPower} aether engulfs your body. Catastrophic energy burns through your nervous system as reality distorts around you. You drag yourself claw-over-claw to the far shore, coughing up luminescent bile. As the burning subsides, you realize with horror that your body has warped: you have contracted ${mutation.name}! (${mutation.description})`;
        }
      } else {
        const hazardDC = 24;
        dcOrDefenderRoll = hazardDC;
        const totalRoll = playerRoll + (Number(player.endurance) || 5) + dynamicToolBonus;
        difference = totalRoll - dcOrDefenderRoll;
        hit = false;
        const massiveDmg = Math.floor(22 * Math.max(1.0, flowInfo.currentSurge || 1.2));
        player.current_hp = Math.max(0, (Number(player.current_hp) || 14) - massiveDmg);
        const mutation = await ops.applyPlayerChaosMutation(
          flowInfo.elementalPower,
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
          propLooted = true;
          targetProp.inventory = [];
          targetProp.tags.delete("lootable");
          systemLog = `[${intent.statUsed.toUpperCase()} SEARCH${toolBonusNotice}: ${totalRoll} vs DC ${dynamicDC} | SUCCESS: Looted ${targetProp.name}! Found ${foundGold} Gold & [${corpseInv.join(", ")}]]`;
        } else {
          lootAwarded = { gold: foundGold };
          propLooted = true;
          targetProp.tags.delete("lootable");
          systemLog = `[${intent.statUsed.toUpperCase()} SEARCH${toolBonusNotice}: ${totalRoll} vs DC ${dynamicDC} | SUCCESS: Searched ${targetProp.name}, found ${foundGold} Gold]`;
        }
      } else if (hit && isContainer) {
        const foundGold = Math.floor(Math.random() * 25) + 12;
        player.gold = (player.gold || 0) + foundGold;
        player.inventory = Array.isArray(player.inventory) ? player.inventory : [];

        let dynamicItem = targetProp.inventory?.[0];
        if (!dynamicItem) {
          if (activeContext?.activeFlow) {
            dynamicItem = `${activeContext.activeFlow} Resonant Shard`;
          } else if (activeContext?.infrastructureMask && (activeContext.infrastructureMask & 8)) {
            dynamicItem = "Ancient Inscribed Tablet";
          } else if (activeContext?.infrastructureMask && (activeContext.infrastructureMask & 4)) {
            dynamicItem = "Smuggled Contraband Phial";
          } else {
            dynamicItem = "Preserved Field Rations";
          }
        }
        player.inventory.push(dynamicItem);
        lootAwarded = { gold: foundGold, item: dynamicItem };
        propLooted = true;
        targetProp.tags.delete("container");
        targetProp.tags.add("opened");
        systemLog = `[${intent.statUsed.toUpperCase()} INSPECT${toolBonusNotice}: ${totalRoll} vs DC ${dynamicDC} | SUCCESS: Discovered cache inside ${targetProp.name}! Found ${foundGold} Gold & ${dynamicItem}]`;
      } else {
        systemLog = `[${intent.statUsed.toUpperCase()} INSPECT${toolBonusNotice}: ${totalRoll} vs DC ${dynamicDC} | ${hit ? "SUCCESS: Area scouted; no further caches detected" : "NOTHING FOUND"}]`;
      }
    }

  } else if (intent.category === "MAGIC") {
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
        Array.from(activeProps.values())
      );

      if (targetNPC && hit) {
        targetNPC.hp = Math.max(0, targetNPC.hp - (injuryPoints * 4));
        if (targetNPC.hp === 0) targetNPC.alive = false;
      }
    }
    systemLog = `[${intent.statUsed.toUpperCase()} MAGIC: ${totalRoll} vs DC ${dynamicDC} | ${hit ? "SUCCESS: Spell manifested" : "DISPELLED"} | ${injuryPoints} Magic Damage]`;

  } else if (intent.category === "CREATIVE_CHECK" || intent.verb === "CUSTOM_CHECK") {
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
        Array.from(activeProps.values())
      );
    }

    xpGained += hit ? 20 : 5;
    systemLog = `[${intent.statUsed.toUpperCase()} CREATIVE CHECK${toolBonusNotice}: ${totalRoll} vs DC ${dcOrDefenderRoll} | ${hit ? "SUCCESS: Creative action achieved" : "CHALLENGED: Unsuccessful effort"}] ${tagResult?.logs?.slice(1).join(" ") || ""}`.trim();

  } else {
    const playerWeapon = getWeapon(player.equipped_weapon || "Osmium Greatsword");
    const playerArmor = getArmor(player.equipped_armor || "Juggernaut Osmium Plate");

    const attackStatKey: StatKey = playerWeapon.stat;
    const attackMod: number = playerWeapon.mod;
    const playerAttackStatVal: number = Number(player[attackStatKey]) || 5;

    if (targetNPC) {
      const npcFoeStack = ensureNpcFoeStack(targetNPC);
      let playerInjury = ops.getPlayerInjuryState(playerId, player, input.playerStats);

      const defArmor = getArmor(targetNPC.equippedArmor || "Glacial Iron Hauberk");
      const defWeapon = getWeapon(targetNPC.equippedWeapon || "Titanium Bastion Spear");

      const defStatKey: StatKey = defArmor.stat;
      const defStatVal: number = targetNPC.stats?.[defStatKey] ?? 5;
      const defMod: number = defArmor.mod;

      const playerSkillRanks: Record<string, number> = (typeof player.skill_ranks === "object" && player.skill_ranks)
        ? player.skill_ranks
        : (typeof player.skill_ranks === "string" ? JSON.parse(player.skill_ranks || "{}") : {});

      const playerWeaponSpecRank = playerSkillRanks[`spec_weapon_${attackStatKey}`] || 0;
      const playerArmorSpecRank = playerSkillRanks[`spec_armor_${playerArmor.stat}`] || 0;
      const targetCoverBonus = input.coverBonus || 0;

      const playerSpentStamina = playerInjury.stamina <= 0 || Boolean(playerInjury.spent?.stamina);
      const hasAdvantage = Boolean(
        input.isStealthed ||
        input.sneakAttack ||
        player.difficulty === "casual" ||
        targetNPC.tags?.some(t => /vulnerable|off-balance|off_balance|prone|staggered|burning/i.test(t))
      );
      const hasDisadvantage = Boolean(
        targetCoverBonus >= 2 ||
        targetNPC.tags?.some(t => /cover_heavy|unyielding/i.test(t)) ||
        playerSpentStamina ||
        playerInjury.disadvantageNextRoll
      );
      playerInjury.disadvantageNextRoll = false;

      const combatRes = ops.resolveContestedAttack(
        {
          attackerStat: playerAttackStatVal,
          weaponValue: attackMod + (playerWeaponSpecRank >= 2 ? 1 : 0),
          hasAdvantage,
          hasDisadvantage,
          attackerSpent: playerSpentStamina,
          withinReach: input.combatType !== "ranged"
        },
        {
          defenseStat: defStatVal,
          armorValue: defMod + targetCoverBonus,
          useGuard: true
        }
      );

      let effectiveTier: BrutalInjuryTier = combatRes.tier;
      let clashNote = "";
      let nextComposure = playerComposure;

      if (combatRes.outcome === "CLASH_TIED") {
        const pStance: ClashStance = input.stance || "PRESS";
        const npcStance: ClashStance = "HOLD";
        const clashRes = resolveClashTie(
          pStance,
          attackStatKey,
          playerAttackStatVal,
          npcStance,
          defStatKey,
          defStatVal,
          { attackerStats: extractStatsMap(player), defenderStats: targetNPC.stats }
        );
        if (clashRes.result === "ATTACKER_WINS_CLASH") {
          hit = true;
          effectiveTier = "MINOR";
          clashNote = ` | [CLASH WON: ${clashRes.narrative}]`;
        } else if (clashRes.result === "DEFENDER_WINS_CLASH") {
          hit = false;
          effectiveTier = "NONE";
          const clashInj = applyBrutalInjury(playerInjury, "GRAZE", "HEALTH", `${targetNPC.name} Clash counter`);
          playerInjury = clashInj.updatedState;
          ops.setPlayerInjuryState(playerId, playerInjury);
          player.current_hp = playerInjury.health;
          nextComposure = playerInjury.composure;
          clashNote = ` | [CLASH LOST: ${clashRes.narrative}]`;
        } else {
          hit = false;
          effectiveTier = "NONE";
          playerInjury.stamina = Math.max(0, playerInjury.stamina - clashRes.staminaCostEach);
          playerInjury.focus = Math.max(0, playerInjury.focus - clashRes.focusCostEach);
          ops.setPlayerInjuryState(playerId, playerInjury);
          clashNote = ` | [CLASH STALEMATE: ${clashRes.narrative}]`;
        }
        detailedRollOutcome = {
          attackerRoll: combatRes.attackerRoll.final,
          attackerStatKey: attackStatKey,
          attackerStatVal: playerAttackStatVal,
          attackerMod: attackMod,
          attackerTotal: combatRes.attackerTotal,
          defenderRoll: combatRes.defenderRoll?.final ?? 0,
          defenderStatKey: defStatKey,
          defenderStatVal: defStatVal,
          defenderMod: defMod + targetCoverBonus,
          defenderTotal: combatRes.defenderTotal,
          coverBonus: targetCoverBonus,
          coverLevel: input.coverLevel || (targetCoverBonus >= 4 ? "FULL" : targetCoverBonus > 0 ? "HALF" : "NONE"),
          weaponName: playerWeapon.name,
          armorName: defArmor.name,
          clashResult: clashRes
        };
      } else {
        hit = combatRes.outcome === "ATTACKER_SUCCESS";
        detailedRollOutcome = {
          attackerRoll: combatRes.attackerRoll.final,
          attackerStatKey: attackStatKey,
          attackerStatVal: playerAttackStatVal,
          attackerMod: attackMod,
          attackerTotal: combatRes.attackerTotal,
          defenderRoll: combatRes.defenderRoll?.final ?? 0,
          defenderStatKey: defStatKey,
          defenderStatVal: defStatVal,
          defenderMod: defMod + targetCoverBonus,
          defenderTotal: combatRes.defenderTotal,
          coverBonus: targetCoverBonus,
          coverLevel: input.coverLevel || (targetCoverBonus >= 4 ? "FULL" : targetCoverBonus > 0 ? "HALF" : "NONE"),
          weaponName: playerWeapon.name,
          armorName: defArmor.name
        };
      }

      difference = combatRes.margin;
      dcOrDefenderRoll = combatRes.defenderTotal;

      let foeStatusNote = "";
      if (hit && effectiveTier !== "NONE") {
        if (!npcFoeStack.isBoss) {
          const hitOut = ops.applyHitToFoe(npcFoeStack, effectiveTier);
          targetNPC.foeStack = hitOut.foe;
          const remainingCards = getTotalFoeCards(hitOut.foe);
          targetNPC.hp = hitOut.foe.status === "down" ? 0 : Math.max(1, remainingCards * 2);
          injuryPoints = hitOut.shred.shreddedCount || (effectiveTier === "GRAZE" ? 1 : 0);

          if (hitOut.foe.status === "down") {
            targetNPC.alive = false;
            targetNPC.hp = 0;
            if (!targetNPC.tags.includes("#Dead")) targetNPC.tags.push("#Dead");
            const lootGold = Math.floor(Math.random() * 25) + 15;
            player.gold = (player.gold || 0) + lootGold;
            const droppedItem = Math.random() < 0.5 ? defWeapon.name : defArmor.name;
            lootAwarded = { gold: lootGold, item: droppedItem };
            const isApex = (targetNPC.role && targetNPC.role.includes("Apex")) || (targetNPC.tags && targetNPC.tags.includes("predator"));
            const isPrey = targetNPC.tags && (targetNPC.tags.includes("prey") || targetNPC.tags.includes("game"));
            xpGained += isApex ? 120 : (isPrey ? 35 : 60);
          } else if (hitOut.foe.status === "seeking_exit" || hitOut.foe.status === "broken") {
            targetNPC.disposition = Math.max(1, targetNPC.disposition || 0);
            if (!targetNPC.tags.includes("#Yielded")) targetNPC.tags.push("#Yielded");
            const statusTag = hitOut.foe.status === "broken" ? "#Broken" : "#SeekingExit";
            if (!targetNPC.tags.includes(statusTag)) targetNPC.tags.push(statusTag);
            xpGained += 50;
          }

          foeStatusNote = `${effectiveTier} | Shredded ${hitOut.shred.shreddedCount} cards (${remainingCards} left) | Resolve ${hitOut.foe.resolve}/${hitOut.foe.maxResolve} (${hitOut.foe.status})`;
        } else {
          const bossDmg = Math.max(1, combatRes.capacityLost || 2);
          injuryPoints = bossDmg;
          targetNPC.hp = Math.max(0, targetNPC.hp - bossDmg);
          targetNPC.foeStack = { ...npcFoeStack, health: targetNPC.hp };
          if (targetNPC.hp === 0) {
            targetNPC.alive = false;
            if (!targetNPC.tags.includes("#Dead")) targetNPC.tags.push("#Dead");
            const lootGold = Math.floor(Math.random() * 40) + 30;
            player.gold = (player.gold || 0) + lootGold;
            lootAwarded = { gold: lootGold, item: defWeapon.name };
            xpGained += 150;
          }
          foeStatusNote = `${effectiveTier} | Boss Health ${targetNPC.hp}/${targetNPC.maxHp}`;
        }
      } else {
        injuryPoints = 0;
      }

      tagResult = TagMatrixEngine.resolveInteraction(
        player.name || "Hero",
        intent.verb,
        targetObj!,
        playerWeapon.tags,
        Array.from(activeProps.values())
      );

      systemLog = `[ATTACK (v5.0 ${attackStatKey.toUpperCase()} - ${playerWeapon.name}${playerWeaponSpecRank > 0 ? ` [Spec R${playerWeaponSpecRank}]` : ""}): ${combatRes.attackerTotal} vs GUARD (${defStatKey.toUpperCase()} - ${defArmor.name}): ${combatRes.defenderTotal} | ${hit ? `HIT: ${foeStatusNote}` : "DEFLECTED"}]${clashNote} ${tagResult?.logs?.slice(1).join(" ") || ""}`.trim();

      const foeStillFighting = targetNPC.foeStack
        ? (targetNPC.foeStack.isBoss ? targetNPC.hp > 0 : targetNPC.foeStack.status === "active" || targetNPC.foeStack.status === "wavering")
        : true;
      if (targetNPC.alive && targetNPC.hp > 0 && targetNPC.disposition <= -1 && foeStillFighting) {
        const npcAtkStatVal = targetNPC.stats?.[defWeapon.stat] ?? 5;
        const playerDefStatVal = Number(player[playerArmor.stat]) || 5;
        const retaliationRes = ops.resolveContestedAttack(
          { attackerStat: npcAtkStatVal, weaponValue: defWeapon.mod, withinReach: true },
          { defenseStat: playerDefStatVal, armorValue: playerArmor.mod + (playerArmorSpecRank >= 2 ? 1 : 0), useGuard: true }
        );

        if (retaliationRes.outcome === "ATTACKER_SUCCESS") {
          const retInj = applyBrutalInjury(
            playerInjury,
            retaliationRes.tier,
            "HEALTH",
            `${targetNPC.name}'s ${defWeapon.name}`,
            player.difficulty === "casual" ? { reductions: { ownReductions: 1 } } : {}
          );
          playerInjury = retInj.updatedState;
          ops.setPlayerInjuryState(playerId, playerInjury);
          player.current_hp = playerInjury.health;
          player.max_hp = playerInjury.maxHealth;
          nextComposure = playerInjury.composure;
          systemLog += ` | [RETALIATION (v5.0 ${defWeapon.stat.toUpperCase()} - ${defWeapon.name}): ${retaliationRes.attackerTotal} vs Guard ${retaliationRes.defenderTotal} -> ${retInj.finalTier} (-${retInj.capacityLost} Cap, +${retInj.energyOwed} Owed; HP ${playerInjury.health}/${playerInjury.maxHealth}, Owed ${playerInjury.owed?.stamina ?? 0} Sta/${playerInjury.owed?.focus ?? 0} Foc)]`;
        } else if (retaliationRes.outcome === "CLASH_TIED") {
          systemLog += ` | [RETALIATION: ${targetNPC.name} and ${player.name} lock blades in a standstill!]`;
        } else {
          systemLog += ` | [RETALIATION: ${targetNPC.name}'s strike deflected by ${playerArmor.name}!]`;
        }
      }

      return {
        playerRoll,
        dcOrDefenderRoll,
        difference,
        hit,
        injuryPoints,
        detailedRollOutcome,
        tagResult,
        lootAwarded,
        propLooted,
        xpGained,
        playerComposure: nextComposure,
        systemLog,
        customNarrative,
      };
    } else if (targetProp) {
      let advantageMod = 0;
      if (targetProp.tags.has("vulnerable") || targetProp.tags.has("burning") || targetProp.tags.has("fragile")) advantageMod += 2;
      if (targetProp.tags.has("unyielding") || targetProp.tags.has("heavy")) advantageMod -= 2;

      const propDC = 7 + (targetProp.hp > 25 ? 2 : 1);
      const atkRoll = rollD12().final;
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
        Array.from(activeProps.values())
      );

      systemLog = `[ATTACK (${attackStatKey.toUpperCase()} - ${playerWeapon.name}): ${atkTotal} vs Object DC ${propDC} | ${hit ? "CRUSHED" : "DEFLECTED"} | ${propDmg} Structural Damage] ${tagResult?.logs?.slice(1).join(" ") || ""}`.trim();
    } else {
      const roll = rollD12().final;
      dcOrDefenderRoll = 7;
      difference = (roll + playerAttackStatVal + attackMod) - dcOrDefenderRoll;
      hit = difference >= 0;
      injuryPoints = hit ? 1 : 0;
      systemLog = `[${attackStatKey.toUpperCase()} STRIKE (${playerWeapon.name}): ${roll + playerAttackStatVal + attackMod} vs DC 7 | ${hit ? "CLEAVED AIR" : "STUMBLED"}]`;
    }
  }

  return {
    playerRoll,
    dcOrDefenderRoll,
    difference,
    hit,
    injuryPoints,
    detailedRollOutcome,
    tagResult,
    lootAwarded,
    propLooted,
    xpGained,
    playerComposure,
    systemLog,
    customNarrative,
    socialDialogueRequest,
  };
}
