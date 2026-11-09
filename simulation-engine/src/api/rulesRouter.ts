import { Router, Request, Response } from 'express';
import {
  calculateDerivedPools,
  calculateDerivedSenses,
  calculateCompleteDerivedStats,
  Attributes
} from '../engine/customRulesEngine';
import {
  resolveContestedAttack,
  resolveClashTie,
  rollD12,
  ClashStance,
  CLASH_STANCE_STATS
} from '../engine/combatResolutionEngine';
import {
  applyBrutalInjury,
  applyMagicalHealing,
  applyPunishment,
  EntityInjuryState
} from '../engine/injuryEngine';
import { equipGear, calculateTurnRegeneration } from '../engine/loadoutEngine';
import { resolveOpposedSocialContest, resolveCosmicDreadCheck, SocialCombatant } from '../engine/socialCombat';
import { executeRest } from '../engine/restingSystem';
import { EXPANDED_GEAR_CATALOG } from '../engine/gearCatalogExpanded';

export const rulesRouter = Router();

// =========================================================================
// 1. D12 DICE ROLLER API (B.R.U.T.A.L. CORE)
// =========================================================================
/**
 * POST /api/rules/roll
 * Standard B.R.U.T.A.L. roll: d12 + modifier with Advantage/Disadvantage and Star/Scar detection.
 */
rulesRouter.post('/roll', (req: Request, res: Response) => {
  try {
    const { count = 1, sides = 12, modifier = 0, advantage = false, disadvantage = false, dc } = req.body;

    if (sides === 12 && count === 1) {
      const d12Res = rollD12(!!advantage, !!disadvantage);
      const total = d12Res.final + modifier;
      const passed = dc !== undefined ? total >= dc : undefined;
      const diff = dc !== undefined ? total - dc : undefined;

      return res.json({
        success: true,
        die: d12Res.final,
        rolls: d12Res.rolls,
        rollType: d12Res.type,
        modifier,
        total,
        dc,
        passed,
        difference: diff,
        isStar: d12Res.isStar, // Natural 12 (growth)
        isScar: d12Res.isScar, // Natural 1 (learning)
        log: `1d12 (${d12Res.rolls.join(', ')}) + ${modifier} = ${total}${dc !== undefined ? ` vs DC ${dc} -> ${passed ? 'PASSED' : 'FAILED'}` : ''}${d12Res.isStar ? ' ⭐ STAR (Growth)!' : ''}${d12Res.isScar ? ' ⚡ SCAR (Failure Learning)!' : ''}`
      });
    }

    // Generic multi-dice fallback
    const rolls: number[] = [];
    let sum = 0;
    for (let i = 0; i < Math.min(50, Math.max(1, count)); i++) {
      const r = Math.floor(Math.random() * sides) + 1;
      rolls.push(r);
      sum += r;
    }
    const total = sum + modifier;

    return res.json({
      success: true,
      count,
      sides,
      rolls,
      sum,
      modifier,
      total,
      dc,
      passed: dc !== undefined ? total >= dc : undefined,
      log: `${count}d${sides} [${rolls.join(', ')}] + ${modifier} = ${total}`
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// 2. 12-ATTRIBUTE POOLS & SENSES CALCULATOR (v4.2+ REBUILD)
// =========================================================================
/**
 * POST /api/rules/derived_pools
 * Computes all 4 Derived Pools and 4 Senses according to B.R.U.T.A.L. v4.2+ canonical formulas.
 */
rulesRouter.post('/derived_pools', (req: Request, res: Response) => {
  try {
    const attr: Attributes = {
      might: Number(req.body.might ?? 5),
      endurance: Number(req.body.endurance ?? 3),
      finesse: Number(req.body.finesse ?? 3),
      reflex: Number(req.body.reflex ?? 4),
      vitality: Number(req.body.vitality ?? 4),
      fortitude: Number(req.body.fortitude ?? 5),
      knowledge: Number(req.body.knowledge ?? 6),
      logic: Number(req.body.logic ?? 2),
      awareness: Number(req.body.awareness ?? 3),
      intuition: Number(req.body.intuition ?? 4),
      charm: Number(req.body.charm ?? 3),
      willpower: Number(req.body.willpower ?? 4)
    };

    const derived = calculateCompleteDerivedStats(attr);

    return res.json({
      success: true,
      attributes: attr,
      pools: derived.pools,
      senses: derived.senses,
      breakdown: {
        health: `vitality (${attr.vitality}) + fortitude (${attr.fortitude}) + intuition (${attr.intuition}) = ${derived.pools.health}`,
        composure: `willpower (${attr.willpower}) + awareness (${attr.awareness}) + endurance (${attr.endurance}) = ${derived.pools.composure}`,
        stamina: `might (${attr.might}) + reflex (${attr.reflex}) + charm (${attr.charm}) = ${derived.pools.stamina}`,
        focus: `logic (${attr.logic}) + knowledge (${attr.knowledge}) + finesse (${attr.finesse}) = ${derived.pools.focus}`,
        perception: `awareness (${attr.awareness}) + intuition (${attr.intuition}) + finesse (${attr.finesse}) = ${derived.senses.perception}`,
        speed: `reflex (${attr.reflex}) + vitality (${attr.vitality}) + logic (${attr.logic}) = ${derived.senses.speed} (Move: ${Math.floor(derived.senses.speed / 5)} spaces, Dodge: ${derived.senses.dodge})`,
        stealth: `knowledge (${attr.knowledge}) + charm (${attr.charm}) + endurance (${attr.endurance}) = ${derived.senses.stealth}`,
        balance: `might (${attr.might}) + fortitude (${attr.fortitude}) + willpower (${attr.willpower}) = ${derived.senses.balance} (Footing: ${derived.senses.footing})`
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// 3. CONTESTED ATTACK & CLASH RESOLUTION (d12 NET MARGIN)
// =========================================================================
/**
 * POST /api/rules/contested_combat
 * Resolves an opposed attack (Attacker d12 + Stat + Weapon vs Defender d12 + Stat + Armor or Guard).
 */
rulesRouter.post('/contested_combat', (req: Request, res: Response) => {
  try {
    const {
      attackerStat = 7,
      attackerWeaponValue = 3,       // Light +1, Medium +2, Heavy +3
      attackerHasAdvantage = false,
      attackerHasDisadvantage = false,
      defenderStat = 4,
      defenderArmorValue = 2,        // Light +1, Medium +2, Heavy +3
      defenderHasAdvantage = false,
      defenderHasDisadvantage = false,
      useGuard = false,              // Guard = static defense (no die)
      currentHealth = 13,
      currentMaxHealth = 13,
      currentComposure = 10,
      currentMaxComposure = 10,
      currentStamina = 9,
      currentFocus = 11
    } = req.body;

    const combatResult = resolveContestedAttack(
      {
        attackerStat,
        weaponValue: attackerWeaponValue,
        hasAdvantage: attackerHasAdvantage,
        hasDisadvantage: attackerHasDisadvantage
      },
      {
        defenseStat: defenderStat,
        armorValue: defenderArmorValue,
        hasAdvantage: defenderHasAdvantage,
        hasDisadvantage: defenderHasDisadvantage,
        useGuard
      }
    );

    // If attack landed, apply injury to state
    let injuryOutcome = null;
    let postState: EntityInjuryState = {
      health: currentHealth,
      maxHealth: currentMaxHealth,
      composure: currentComposure,
      maxComposure: currentMaxComposure,
      stamina: currentStamina,
      focus: currentFocus,
      activeWounds: []
    };

    if (combatResult.outcome === 'ATTACKER_SUCCESS' && combatResult.tier !== 'NONE') {
      injuryOutcome = applyBrutalInjury(postState, combatResult.tier, 'HEALTH', 'Melee strike');
      postState = injuryOutcome.updatedState;
    }

    return res.json({
      success: true,
      combat: combatResult,
      injuryApplied: injuryOutcome,
      poolsBefore: {
        health: currentHealth,
        maxHealth: currentMaxHealth,
        composure: currentComposure,
        maxComposure: currentMaxComposure,
        stamina: currentStamina,
        focus: currentFocus
      },
      poolsAfter: {
        health: postState.health,
        maxHealth: postState.maxHealth,
        composure: postState.composure,
        maxComposure: postState.maxComposure,
        stamina: postState.stamina,
        focus: postState.focus
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// 4. THE CLASH (6 CANONICAL STANCES, MARGIN = 0)
// =========================================================================
/**
 * POST /api/rules/clash
 * Resolves a locked weapon Clash under B.R.U.T.A.L. v4.9 using the 6 canonical stances.
 */
rulesRouter.post('/clash', (req: Request, res: Response) => {
  try {
    const {
      attackerStance = 'PRESS',
      attackerStatKey = 'might',
      attackerStatVal = 7,
      defenderStance = 'HOLD',
      defenderStatKey = 'endurance',
      defenderStatVal = 5
    } = req.body;

    const validStances: ClashStance[] = ['PRESS', 'HOLD', 'MANEUVER', 'TRICK', 'FEINT', 'DISENGAGE'];
    if (!validStances.includes(attackerStance) || !validStances.includes(defenderStance)) {
      return res.status(400).json({
        success: false,
        error: `Invalid stance. Valid stances: ${validStances.join(', ')}`
      });
    }

    const result = resolveClashTie(
      attackerStance as ClashStance,
      attackerStatKey,
      attackerStatVal,
      defenderStance as ClashStance,
      defenderStatKey,
      defenderStatVal
    );

    return res.json({
      success: true,
      clash: result
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// 5. UNCONTESTED CHECK VS DC (EASY 8, STD 11, HARD 14, EXTREME 17)
// =========================================================================
/**
 * POST /api/rules/check
 * Resolves an uncontested check: d12 + stat (+ tool) vs DC. Margin 1-2 = success at a cost.
 */
rulesRouter.post('/check', (req: Request, res: Response) => {
  try {
    const { attributeName = 'might', statVal = 5, toolValue = 0, dc = 11, advantage = false, disadvantage = false } = req.body;

    const rollRes = rollD12(!!advantage, !!disadvantage);
    const total = rollRes.final + statVal + toolValue;
    const margin = total - dc;
    const passed = margin >= 0;

    let degree = 'NORMAL_SUCCESS';
    if (!passed) {
      degree = margin <= -4 ? 'CATASTROPHIC_FAILURE' : 'FAILURE';
    } else {
      if (rollRes.isStar) degree = 'STAR_SUCCESS (Critical Growth!)';
      else if (margin === 1 || margin === 2) degree = 'SUCCESS_AT_A_COST';
      else if (margin >= 6) degree = 'EFFORTLESS_SUCCESS';
    }

    return res.json({
      success: true,
      attributeName,
      statVal,
      toolValue,
      dc,
      rollType: rollRes.type,
      die: rollRes.final,
      rolls: rollRes.rolls,
      total,
      margin,
      passed,
      degree,
      isStar: rollRes.isStar,
      isScar: rollRes.isScar,
      log: `${attributeName.toUpperCase()} CHECK: 1d12 (${rollRes.rolls.join(', ')}) + ${statVal} [stat] + ${toolValue} [tool] = ${total} vs DC ${dc} -> ${passed ? 'PASSED' : 'FAILED'} (${degree})`
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// 6. MAGICAL HEALING (STAMINA TRADEOFF, §8.2, v4.6)
// =========================================================================
/**
 * POST /api/rules/magical_heal
 * Healer knits patient wound: Patient must pay 2 Stamina (Minor) or 4 Stamina (Major).
 */
rulesRouter.post('/magical_heal', (req: Request, res: Response) => {
  try {
    const { patientState, woundId } = req.body;
    if (!patientState || !woundId) {
      return res.status(400).json({ success: false, error: 'patientState and woundId required.' });
    }

    const healResult = applyMagicalHealing(patientState, woundId);

    return res.json({
      success: healResult.success,
      message: healResult.message,
      patientStateAfter: healResult.updatedState
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// 7. SOCIAL COMBAT & COMPOSURE DUEL
// =========================================================================
rulesRouter.post('/social_contest', (req: Request, res: Response) => {
  try {
    const {
      attackerName = 'Hero',
      attackerStat = 'charm',
      attackerStatVal = 4,
      attackerWeapon = 'Iron Warmaster Baton',
      defenderName = 'Merchant Guildmaster',
      defenderStat = 'willpower',
      defenderStatVal = 4,
      defenderArmor = 'Keepsake Locket of the Hearth',
      defenderComposure = 10,
      advantageMod = 0
    } = req.body;

    const attacker: SocialCombatant = {
      name: attackerName,
      stats: { [attackerStat]: attackerStatVal },
      equippedSocialWeapon: attackerWeapon,
      composure: 12,
      maxComposure: 12
    };

    const defender: SocialCombatant = {
      name: defenderName,
      stats: { [defenderStat]: defenderStatVal },
      equippedSocialArmor: defenderArmor,
      composure: defenderComposure,
      maxComposure: 12
    };

    const contest = resolveOpposedSocialContest(attacker, defender, attackerStat as any, { advantageMod });

    return res.json({
      success: true,
      attacker: { name: attackerName, stat: attackerStat, total: contest.attackerTotal },
      defender: { name: defenderName, stat: defenderStat, total: contest.defenderTotal },
      difference: contest.difference,
      hit: contest.hit,
      composureDamage: contest.composureDamage,
      remainingComposure: contest.defenderComposureRemaining,
      defenderCompliesOrYields: contest.isBroken,
      log: contest.log
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// 8. COSMIC DREAD CHECK
// =========================================================================
rulesRouter.post('/dread_check', (req: Request, res: Response) => {
  try {
    const { characterName = 'Warden', willpower = 4, currentComposure = 10, horrorDC = 12, defenseStat = 'willpower', socialArmor = '' } = req.body;

    const combatant: SocialCombatant = {
      name: characterName,
      stats: { [defenseStat]: willpower },
      equippedSocialArmor: socialArmor,
      composure: currentComposure,
      maxComposure: 12
    };

    const dread = resolveCosmicDreadCheck(combatant, horrorDC, defenseStat as any);

    return res.json({
      success: true,
      characterName,
      horrorDC: dread.horrorDC,
      rollTotal: dread.totalRoll,
      passed: dread.passed,
      composureLost: dread.composureTrauma,
      remainingComposure: dread.remainingComposure,
      panicked: dread.isPanicked,
      log: dread.log
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// 9. GEAR LOADOUT & REGENERATION
// =========================================================================
rulesRouter.post('/loadout', (req: Request, res: Response) => {
  try {
    const { maxStamina = 14, maxFocus = 11, equippedGear = [] } = req.body;

    let staminaFees = 0;
    let focusFees = 0;

    for (const item of equippedGear) {
      if (item.resourcePool === 'STAMINA') staminaFees += item.holdingFee || item.loadoutCost || 0;
      else if (item.resourcePool === 'FOCUS') focusFees += item.holdingFee || item.loadoutCost || 0;
    }

    const staminaAvailable = Math.max(4, maxStamina - staminaFees);
    const focusAvailable = Math.max(4, maxFocus - focusFees);

    return res.json({
      success: true,
      stamina: { max: maxStamina, fees: staminaFees, availableEnergy: staminaAvailable },
      focus: { max: maxFocus, fees: focusFees, availableEnergy: focusAvailable },
      rules: 'Energy is daily supply. No refresh in a fight. 1 hour rest restores 1/4; night rest restores all.'
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// 10. GEAR CATALOG BROWSER
// =========================================================================
rulesRouter.get('/catalog', (req: Request, res: Response) => {
  try {
    return res.json({
      success: true,
      count: EXPANDED_GEAR_CATALOG.length,
      catalog: EXPANDED_GEAR_CATALOG
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
