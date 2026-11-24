/**
 * B.R.U.T.A.L. TTRPG Draft v5.0 Canonical Rules & Worked Example Test Suite
 * =========================================================================
 * Exercises Steps 1-12 of RULES_TARGET_v5.0.md against Rulebook v3 Draft v5.0 (§5.0)
 * and fails non-zero (Rule 9) if any assertion breaks.
 */

import {
  calculateDerivedPools,
  calculateDerivedSenses,
  calculateCompleteDerivedStats,
  calculateDoublingFee,
  getTechniqueEnergyCost,
  Attributes
} from '../engine/customRulesEngine.js';
import {
  resolveContestedAttack,
  resolveClashTie,
  doesStanceBeat,
  getBestStatFromMap,
  resolveReadyReaction,
  rollD12,
  ClashStance
} from '../engine/combatResolutionEngine.js';
import {
  applyBrutalInjury,
  reduceInjuryTier,
  payAtComeDown,
  checkSpentState,
  spendPoolTokens,
  getSpentRollPenalty,
  advanceDyingRound,
  stabilizeDowned,
  groundBroken,
  getLockedTagPenalties,
  resolveHeroShock,
  tickOngoingBleed,
  EntityInjuryState
} from '../engine/injuryEngine.js';
import {
  createFoeStack,
  migrateFoeToStack,
  shredFoeCards,
  applyFoeResolveLoss,
  applyHitToFoe,
  resolveAimedAttackOnFoe,
  getTotalFoeCards
} from '../engine/rpg/foeStack.js';
import {
  resolvePersuasion,
  resolveOpposedSocialContest,
  SocialCombatant
} from '../engine/socialCombat.js';
import { buildOstrakaCustomCharacter } from '../engine/rpg/CharacterGenerator.js';
import { BrutalGameMaster } from '../engine/rpg/BrutalGM.js';
import pool from '../db/pool.js';

let checksPassed = 0;

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
  checksPassed++;
}

function assertEq<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`ASSERTION FAILED: ${message} (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`);
  }
  checksPassed++;
}

console.log('================================================================');
console.log('      B.R.U.T.A.L. TTRPG v5.0 RULES & DICE SYSTEM VERIFIER      ');
console.log('================================================================\n');

// 0. DERIVED POOLS & SENSES (HARROW GRIST CANONICAL EXAMPLE)
const harrowAttr: Attributes = {
  might: 7, endurance: 3, fortitude: 5, vitality: 4, reflex: 4, finesse: 3,
  intuition: 4, awareness: 3, willpower: 4, charm: 3, knowledge: 6, logic: 2
};
const derived = calculateCompleteDerivedStats(harrowAttr);
assertEq(derived.pools.health, 13, 'Harrow Health = 4+5+4 = 13');
assertEq(derived.pools.composure, 10, 'Harrow Composure = 4+3+3 = 10');
assertEq(derived.pools.stamina, 14, 'Harrow Stamina = 7+4+3 = 14');
assertEq(derived.pools.focus, 11, 'Harrow Focus = 2+6+3 = 11');
assertEq(derived.senses.perception, 10, 'Harrow Perception = 10');
assertEq(derived.senses.speed, 10, 'Harrow Speed = 10');
assertEq(derived.senses.dodge, 10, 'Harrow Dodge = 10');
assertEq(derived.senses.stealth, 12, 'Harrow Stealth = 12');
assertEq(derived.senses.balance, 16, 'Harrow Balance = 16');
assertEq(derived.senses.footing, 13, 'Harrow Footing = 13');
console.log('✓ Baseline Derived Pools & Senses verified');

// STEP 1. THE CLASH
{
  const fighterAStats: Record<string, number> = { might: 7, finesse: 3, endurance: 3, logic: 2 };
  const fighterBStats: Record<string, number> = { knowledge: 6, endurance: 3, might: 4, willpower: 5 };

  // Best stat picked automatically, stances don't pick stats
  assertEq(getBestStatFromMap(fighterAStats).key, 'might', 'Best stat for A is might');
  assertEq(getBestStatFromMap(fighterBStats).key, 'knowledge', 'Best stat for B is knowledge');

  // PRESS vs TRICK: Press beats Trick -> Press has Advantage
  assert(doesStanceBeat('PRESS', 'TRICK'), 'PRESS beats TRICK');
  assert(!doesStanceBeat('TRICK', 'PRESS'), 'TRICK does not beat PRESS');
  const pressVsTrick = resolveClashTie('PRESS', 'might', 7, 'TRICK', 'finesse', 3, {
    attackerStats: fighterAStats,
    defenderStats: fighterBStats,
    attackerFixedRoll: [2, 10], // keeps 10 via Advantage -> 10+7 = 17
    defenderFixedRoll: [9, 9]   // 9+6 = 15
  });
  assertEq(pressVsTrick.attackerHasAdvantage, true, 'PRESS vs TRICK gives PRESS Advantage');
  assertEq(pressVsTrick.defenderHasAdvantage, false, 'PRESS vs TRICK gives TRICK no Advantage');
  assertEq(pressVsTrick.attackerStatKey, 'might', 'PRESS uses best stat (might)');
  assertEq(pressVsTrick.defenderStatKey, 'knowledge', 'TRICK uses best stat (knowledge), not stance stat');
  assertEq(pressVsTrick.attackerTotal, 17, 'PRESS total uses higher Advantage die 10 + best stat 7');
  assertEq(pressVsTrick.result, 'ATTACKER_WINS_CLASH', 'PRESS wins Clash');

  // PRESS vs HOLD: straight (i vs i+3)
  assert(!doesStanceBeat('PRESS', 'HOLD'), 'PRESS does not beat HOLD');
  assert(!doesStanceBeat('HOLD', 'PRESS'), 'HOLD does not beat PRESS');
  const pressVsHold = resolveClashTie('PRESS', 'might', 7, 'HOLD', 'endurance', 3, {
    attackerStats: fighterAStats,
    defenderStats: fighterBStats,
    attackerFixedRoll: 5,
    defenderFixedRoll: 6
  });
  assertEq(pressVsHold.attackerHasAdvantage, false, 'PRESS vs HOLD is straight for A');
  assertEq(pressVsHold.defenderHasAdvantage, false, 'PRESS vs HOLD is straight for B');
  assertEq(pressVsHold.attackerTotal, 12, 'A total = 5 + 7 = 12');
  assertEq(pressVsHold.defenderTotal, 12, 'B total = 6 + 6 = 12');
  assertEq(pressVsHold.result, 'MUTUAL_STALEMATE', 'Equal Clash totals tie');
  assertEq(pressVsHold.continuesNextRound, true, 'Tie continues next round');
  assertEq(pressVsHold.staminaCostEach, 1, 'Tie costs 1 Stamina each');
  assertEq(pressVsHold.focusCostEach, 1, 'Tie costs 1 Focus each');

  // PRESS vs FEINT: Feint beats Press -> Feint has Advantage
  assert(doesStanceBeat('FEINT', 'PRESS'), 'FEINT beats PRESS');
  const pressVsFeint = resolveClashTie('PRESS', 'might', 7, 'FEINT', 'fortitude', 5, {
    attackerStats: fighterAStats,
    defenderStats: fighterBStats,
    attackerFixedRoll: 6,
    defenderFixedRoll: [2, 11]
  });
  assertEq(pressVsFeint.attackerHasAdvantage, false, 'PRESS vs FEINT gives PRESS no Advantage');
  assertEq(pressVsFeint.defenderHasAdvantage, true, 'PRESS vs FEINT gives FEINT Advantage');
  assertEq(pressVsFeint.defenderTotal, 17, 'FEINT uses Advantage die 11 + best stat 6 = 17');
  assertEq(pressVsFeint.result, 'DEFENDER_WINS_CLASH', 'FEINT wins Clash');

  // TRICK vs TRICK: straight
  const trickVsTrick = resolveClashTie('TRICK', 'might', 7, 'TRICK', 'knowledge', 6, {
    attackerFixedRoll: 8,
    defenderFixedRoll: 4
  });
  assertEq(trickVsTrick.attackerHasAdvantage, false, 'TRICK vs TRICK is straight for attacker');
  assertEq(trickVsTrick.defenderHasAdvantage, false, 'TRICK vs TRICK is straight for defender');

  // Margin of 0 when out of reach -> Graze (NOT Clash)
  const rangedTie = resolveContestedAttack(
    { attackerStat: 5, weaponValue: 2, withinReach: false, fixedRoll: 3 }, // Total 10
    { defenseStat: 8, armorValue: 2, useGuard: true }                      // Guard 10
  );
  assertEq(rangedTie.margin, 0, 'Ranged tie has margin 0');
  assertEq(rangedTie.outcome, 'ATTACKER_SUCCESS', 'Ranged tie becomes ATTACKER_SUCCESS');
  assertEq(rangedTie.tier, 'GRAZE', 'Ranged tie becomes a GRAZE');
}
console.log('✓ Step 1 (The Clash wheel, best stat, tie cost, ranged tie -> Graze) verified');

// STEP 2. STARS AND PAINFUL LESSONS
{
  // rollD12 uses isPainfulLesson (not isScar)
  const sampleRoll = rollD12(false, false, 1);
  assertEq(sampleRoll.isPainfulLesson, true, 'rollD12 exposes isPainfulLesson on nat 1');
  assertEq('isScar' in sampleRoll, false, 'rollD12 no longer has isScar property');

  // Natural 1 that STILL HITS gives no Painful Lesson pip
  const nat1Hits = resolveContestedAttack(
    { attackerStat: 8, weaponValue: 3, fixedRoll: 1 }, // Total 12
    { defenseStat: 6, armorValue: 2, useGuard: true }  // Guard 8 -> margin +4 MINOR
  );
  assertEq(nat1Hits.outcome, 'ATTACKER_SUCCESS', 'Nat 1 with high stats still hits');
  assertEq(nat1Hits.attackerPainfulLesson, false, 'Nat 1 that hits gives no Painful Lesson');

  // Natural 12 that MISSES gives no Star
  const nat12Misses = resolveContestedAttack(
    { attackerStat: 3, weaponValue: 1, fixedRoll: 12 }, // Total 16
    { defenseStat: 8, armorValue: 2, useGuard: false, fixedRoll: 10 } // Active total 20 -> miss
  );
  assertEq(nat12Misses.outcome, 'DEFENDER_SUCCESS', 'Nat 12 vs higher total misses');
  assertEq(nat12Misses.attackerStar, false, 'Nat 12 that misses gives no Star');
  assertEq(nat12Misses.starGained, false, 'Overall starGained false when nat 12 misses');

  // Natural 12 that HITS gives Star; Natural 1 on failed active defense gives Painful Lesson
  const nat12HitsDefNat1 = resolveContestedAttack(
    { attackerStat: 5, weaponValue: 2, fixedRoll: 12 }, // Total 19
    { defenseStat: 4, armorValue: 2, fixedRoll: 1 }   // Total 7
  );
  assertEq(nat12HitsDefNat1.attackerStar, true, 'Nat 12 on hit grants Star');
  assertEq(nat12HitsDefNat1.defenderPainfulLesson, true, 'Nat 1 on failed defense grants Painful Lesson');
}
console.log('✓ Step 2 (Stars & Painful Lessons only on success/fail) verified');

// STEP 3. REDUCTIONS
{
  const red1 = reduceInjuryTier('MAJOR', {
    ownReductions: ['Hide Trait'],
    allyReductions: ['Mend the Blow'],
    isMendFromAlly: true
  });
  assertEq(red1.finalTier, 'GRAZE', 'Major + own trait + ally Mend = Graze');
  assertEq(red1.ownApplied, 1, '1 own reduction applied');
  assertEq(red1.allyApplied, 1, '1 ally reduction applied');
  assertEq(red1.patientStaminaCost, 0, 'Ally Mend as reduction costs patient 0 Stamina');

  const red2 = reduceInjuryTier('MAJOR', {
    ownReductions: ['Hide Trait', 'Roll With It']
  });
  assertEq(red2.finalTier, 'MINOR', 'Major + two of target own traits = Minor (only one counts)');
  assertEq(red2.ownApplied, 1, 'At most 1 own reduction counts');
}
console.log('✓ Step 3 (Reductions: max 1 own + 1 ally, free Mend) verified');

// STEP 4. THE BILL AT THE COME-DOWN
{
  const fighterA: EntityInjuryState = {
    name: 'Tesh',
    health: 12,
    maxHealth: 12,
    composure: 10,
    maxComposure: 10,
    stamina: 7,
    focus: 8,
    activeWounds: []
  };

  // Minor at S 7 leaves S 7 during the fight, owed 2 -> S 5 after Come-Down
  const afterMinor = applyBrutalInjury(fighterA, 'MINOR', 'HEALTH', 'Knife cut', { location: 'Left Arm' });
  assertEq(afterMinor.updatedState.stamina, 7, 'In fight: Minor leaves Stamina at 7');
  assertEq(afterMinor.updatedState.owed?.stamina, 2, 'In fight: Minor adds 2 Stamina owed');
  assertEq(afterMinor.updatedState.maxHealth, 8, 'Capacity drops immediately (12 -> 8)');
  assertEq(afterMinor.updatedState.disadvantageNextRoll, true, 'Minor gives Disadvantage next roll immediately');
  assertEq(afterMinor.updatedState.activeWounds[0]?.faceUp, false, 'Minor card starts face-down');

  const comeDownA = payAtComeDown(afterMinor.updatedState);
  assertEq(comeDownA.stamina, 5, 'Come-Down subtracts 2 owed from S 7 -> S 5');
  assertEq(comeDownA.composure, 8, 'Come-Down applies shakes (-2 Composure)');
  assertEq(comeDownA.activeWounds[0]?.faceUp, true, 'Come-Down flips Minor card face-up');
  assert(comeDownA.lockedTags?.includes('1-ARM'), 'Flipped Left Arm card locks [1-ARM]');

  // Owing 9 at S 3 ends at S 0 and sets Spent (rest is lost, no debt)
  const fighterB: EntityInjuryState = {
    name: 'Owed Nine',
    health: 12,
    maxHealth: 12,
    composure: 2,
    maxComposure: 10,
    stamina: 3,
    focus: 6,
    owed: { stamina: 9, focus: 0 },
    tookComposureInjury: true,
    activeWounds: []
  };
  const comeDownB = payAtComeDown(fighterB);
  assertEq(comeDownB.stamina, 0, 'Owing 9 at S 3 clamps Stamina to 0');
  assertEq(comeDownB.owed?.stamina, 0, 'Owed cleared after Come-Down');
  assertEq(comeDownB.spent?.stamina, true, 'Pool at 0 sets Stamina Spent');
  assertEq(comeDownB.composure, 1, 'Shakes never drop Composure below 1');
}
console.log('✓ Step 4 (Come-Down bill, in-fight S preservation, shakes floor 1) verified');

// STEP 5. SPENT
{
  const spentFighter: EntityInjuryState = {
    name: 'Drained Veteran',
    health: 12,
    maxHealth: 12,
    composure: 10,
    maxComposure: 10,
    stamina: 1,
    focus: 5,
    activeWounds: []
  };
  const spentOne = spendPoolTokens(spentFighter, 'STAMINA', 1, 'TECHNIQUE');
  assertEq(spentOne.allowed, true, 'Spending last Stamina succeeds');
  assertEq(spentOne.updatedState.stamina, 0, 'Stamina now 0');
  assertEq(checkSpentState(spentOne.updatedState).stamina, true, 'Pool at 0 marks Spent');

  const blockedTech = spendPoolTokens(spentOne.updatedState, 'STAMINA', 1, 'TECHNIQUE');
  assertEq(blockedTech.allowed, false, 'Spent blocks Stamina Techniques');
  const blockedReaction = spendPoolTokens(spentOne.updatedState, 'STAMINA', 1, 'REACTION');
  assertEq(blockedReaction.allowed, false, 'Spent blocks Stamina Reactions');

  assertEq(getSpentRollPenalty(spentOne.updatedState, 'BODY_ATTACK').hasDisadvantage, true, 'Spent Stamina -> Body attack at Disadvantage');
  assertEq(getSpentRollPenalty(spentOne.updatedState, 'BODY_CHECK').hasDisadvantage, true, 'Spent Stamina -> Body check at Disadvantage');
  assertEq(getSpentRollPenalty(spentOne.updatedState, 'BODY_DEFENSE').hasDisadvantage, false, 'Spent Stamina -> Active defense rolls normally');

  // Verify combatResolutionEngine applies attackerSpent Disadvantage but NOT defenderSpent
  const spentAttackVsNormalDef = resolveContestedAttack(
    { attackerStat: 6, weaponValue: 3, attackerSpent: true, fixedRolls: [2, 11] }, // Disadv keeps 2 -> 11
    { defenseStat: 5, armorValue: 2, defenderSpent: true, fixedRolls: [1, 11] }   // Not Disadv -> keeps 1 -> wait standard uses first roll [1], or fixedRoll 6 -> 13
  );
  assertEq(spentAttackVsNormalDef.attackerRoll.type, 'DISADVANTAGE', 'Spent maul attack rolls with Disadvantage');
  assertEq(spentAttackVsNormalDef.attackerRoll.final, 2, 'Spent maul attack kept lower die');
  assertEq(spentAttackVsNormalDef.defenderRoll?.type, 'STANDARD', 'Spent defender rolls active defense normally');
}
console.log('✓ Step 5 (Spent blocks Techniques/Reactions, Disadv on attack/check, normal defense) verified');

// STEP 6. DOWN AND DYING
{
  let hero: EntityInjuryState = {
    name: 'Kael',
    health: 8,
    maxHealth: 8,
    composure: 6,
    maxComposure: 6,
    stamina: 8,
    focus: 8,
    activeWounds: []
  };

  hero = applyBrutalInjury(hero, 'MAJOR', 'HEALTH', 'Lance').updatedState; // maxHealth 8 -> 0 -> DOWN
  assertEq(hero.isDown, true, '0 Health puts hero down');
  assertEq(hero.dyingRounds, 6, 'Downed starts at 6 dying rounds');

  const tick1 = advanceDyingRound(hero);
  hero = tick1.updatedState;
  assertEq(hero.dyingRounds, 5, 'Dying count drops by 1 at end of round');
  assert(tick1.narration?.includes('Kael is down: 5 rounds'), 'Emits "X is down: N rounds" narration');

  // Minor on downed costs 1 round
  hero = applyBrutalInjury(hero, 'MINOR', 'HEALTH', 'Kick while down').updatedState;
  assertEq(hero.dyingRounds, 4, 'Minor on downed costs 1 round (5 -> 4)');

  // Major on downed costs 2 rounds
  hero = applyBrutalInjury(hero, 'MAJOR', 'HEALTH', 'Heavy cleave while down').updatedState;
  assertEq(hero.dyingRounds, 2, 'Major on downed costs 2 rounds (4 -> 2)');

  // Stabilize with field kit (1 token) stops the count
  const stab = stabilizeDowned(hero, { stamina: 2, focus: 0, hasFieldKit: true, kitPool: 'STAMINA' });
  assertEq(stab.success, true, 'Stabilize with field kit succeeds with 1 token');
  assertEq(stab.updatedHelper.stamina, 1, 'Field kit stabilize costs 1 token');
  assertEq(stab.updatedPatient.isStabilized, true, 'Patient is stabilized');
  assertEq(stab.updatedPatient.dyingRounds, null, 'Dying countdown stopped while stabilized');

  // Hit on someone already stabilized restarts at 6 minus hit cost
  const hitStabilized = applyBrutalInjury(stab.updatedPatient, 'MAJOR', 'HEALTH', 'Stray bolt').updatedState;
  assertEq(hitStabilized.isStabilized, false, 'Hit breaks stabilized status');
  assertEq(hitStabilized.dyingRounds, 4, 'Hit on stabilized restarts at 6 - 2 (Major) = 4');

  // Critical on downed kills
  const critDowned = applyBrutalInjury(hitStabilized, 'CRITICAL', 'HEALTH', 'Coup de grace').updatedState;
  assertEq(critDowned.isDead, true, 'Critical on downed kills immediately');

  // 0 Composure Psychic Break works the same way, stopped by Grounding or Rally
  let mindBreak: EntityInjuryState = {
    name: 'Mirek',
    health: 10,
    maxHealth: 10,
    composure: 8,
    maxComposure: 8,
    stamina: 8,
    focus: 8,
    activeWounds: []
  };
  mindBreak = applyBrutalInjury(mindBreak, 'MAJOR', 'COMPOSURE', 'Horrific vision').updatedState;
  assertEq(mindBreak.isPsychicBreak, true, '0 Composure triggers Psychic Break');
  assertEq(mindBreak.psychicBreakRounds, 6, 'Psychic Break starts at 6 rounds');
  mindBreak = advanceDyingRound(mindBreak).updatedState;
  assertEq(mindBreak.psychicBreakRounds, 5, 'Psychic Break ticks down 1 per round');
  const grounded = groundBroken(mindBreak, { stamina: 1, focus: 1 });
  assertEq(grounded.success, true, 'Grounding with 1 S + 1 F stops Psychic Break');
  assertEq(grounded.updatedPatient.isGrounded, true, 'Patient grounded');
}
console.log('✓ Step 6 (Down & dying 6-round count, hits on downed, stabilize & Psychic Break) verified');

// STEP 7. LOCKED TAGS
{
  const legHurt: EntityInjuryState = {
    name: 'Scout',
    health: 10,
    maxHealth: 10,
    composure: 10,
    maxComposure: 10,
    stamina: 8,
    focus: 8,
    baseMoveSpaces: 4,
    activeWounds: []
  };
  const woundedLeg = applyBrutalInjury(legHurt, 'MAJOR', 'HEALTH', 'Hamstring slash', { location: 'Left Leg' }).updatedState;
  const penalties = getLockedTagPenalties(woundedLeg, ['BIPED']);
  assertEq(penalties.hasDisadvantage, true, 'Locked tag gives Disadvantage on rolls needing it');
  assertEq(penalties.zoneMoveMultiplier, 0.5, 'Locked [BIPED] halves Zone Move');
  assertEq(penalties.effectiveMoveSpaces, 2, 'Locked [BIPED] halves space Move (4 -> 2)');
  assertEq(woundedLeg.stamina, 8, 'Locked tag no longer doubles action energy costs');
}
console.log('✓ Step 7 (Locked tags Disadvantage & halved Move, no doubled energy cost) verified');

// STEP 8. FOES AS CARDS
{
  // Test 8a: 7-card cutthroat (core x3, knife x2, quick x2) takes Major -> all knife and quick go, core x3 remains
  let onLostFired = false;
  const cutthroat = createFoeStack({
    id: 'foe_cutthroat_1',
    name: 'Guild Cutthroat',
    stake: 'rank-and-file',
    cards: [
      { name: 'Core', kind: 'core', copies: 3 },
      { name: 'Knife', kind: 'ability', copies: 2, grants: ['knife_strike'], onLost: () => { onLostFired = true; } },
      { name: 'Quick', kind: 'trait', copies: 2, grants: ['quick_step'] }
    ]
  });
  const shredRes = shredFoeCards(cutthroat, 'MAJOR'); // Major shreds 4 cards; only 4 non-core exist!
  const remainingCore = shredRes.foe.cards.find(c => c.name === 'Core')?.copies;
  const remainingKnife = shredRes.foe.cards.find(c => c.name === 'Knife')?.copies;
  const remainingQuick = shredRes.foe.cards.find(c => c.name === 'Quick')?.copies;
  assertEq(remainingKnife, 0, 'Cutthroat Knife copies all shredded on Major');
  assertEq(remainingQuick, 0, 'Cutthroat Quick copies all shredded on Major');
  assertEq(remainingCore, 3, 'Cutthroat Core x3 untouched while non-core existed');
  assertEq(onLostFired, true, 'onLost fires when last copy of card goes');
  assert(!shredRes.foe.activeGrants.includes('knife_strike'), 'Lost card grants removed');

  // Test 8b: Rank-and-file takes Major (-2) + adjacent ally drops (-2): Resolve 4 -> 0, seeking_exit, NO dice rolled
  let guard = createFoeStack({
    id: 'foe_guard_1',
    name: 'Watchman',
    stake: 'rank-and-file',
    v49Health: 10
  });
  assertEq(guard.resolve, 4, 'Rank-and-file starts at Resolve 4');
  const hitGuard = applyFoeResolveLoss(guard, 'MAJOR_HIT');
  guard = hitGuard.foe;
  assertEq(guard.resolve, 2, 'Major hit drops Resolve 4 -> 2');
  assert(guard.narrationLog.some(l => l.includes('wavering')), 'At half Resolve (2/4), emits wavering narration');
  const allyDrop = applyFoeResolveLoss(guard, 'ADJACENT_ALLY_DROPPED');
  guard = allyDrop.foe;
  assertEq(guard.resolve, 0, 'Adjacent ally drop takes Resolve 2 -> 0');
  assertEq(guard.status, 'seeking_exit', 'At 0 Resolve, rank-and-file is seeking_exit');
  assertEq(guard.acceptsQuarter, true, 'At 0 Resolve, accepts any offer of quarter');

  // Test 8c: Killing leader puts every hireling (and rank-and-file) to 0
  const leader = createFoeStack({
    id: 'foe_leader_1',
    name: 'Bandit Captain',
    stake: 'leader',
    cards: [
      { name: 'Core', kind: 'core', copies: 3 },
      { name: 'Command', kind: 'ability', copies: 1, visible: false } // Command forced visible!
    ]
  });
  assertEq(leader.cards.find(c => c.name === 'Command')?.visible, true, 'Command card is always visible even if visible:false passed');
  const hirelingA = createFoeStack({ id: 'foe_h1', name: 'Hireling A', stake: 'hireling', v49Health: 6 });
  const hirelingB = createFoeStack({ id: 'foe_h2', name: 'Hireling B', stake: 'hireling', v49Health: 6 });
  const fanatic = createFoeStack({ id: 'foe_fan_1', name: 'Zealot', stake: 'fanatic', v49Health: 8 });
  const leaderDown = applyFoeResolveLoss(leader, 'LEADER_DOWN', { squad: [hirelingA, hirelingB, fanatic] });
  assertEq(leaderDown.squad[0]?.resolve, 0, 'Killing leader puts hireling A at 0 Resolve');
  assertEq(leaderDown.squad[1]?.resolve, 0, 'Killing leader puts hireling B at 0 Resolve');
  assertEq(leaderDown.squad[2]?.resolve, 8, 'Fanatic does not break on leader drop');

  // Test 8d: Aimed attack & hidden card & boss migration
  const trickster = createFoeStack({
    id: 'foe_trick_1',
    name: 'Poisoner',
    stake: 'veteran',
    cards: [
      { name: 'Core', kind: 'core', copies: 3 },
      { name: 'Viper Poison', kind: 'ability', copies: 2, visible: false },
      { name: 'Twin Dagger', kind: 'ability', copies: 2, visible: true }
    ]
  });
  const badAim = resolveAimedAttackOnFoe({ attackerStat: 7, weaponValue: 2, fixedRolls: [9, 9] }, { defenseStat: 3, armorValue: 1, useGuard: true }, trickster, 'Viper Poison');
  assertEq(badAim.validAimedTarget, false, 'Cannot aim at hidden card');
  const goodAim = resolveAimedAttackOnFoe(
    { attackerStat: 7, weaponValue: 2, fixedRolls: [2, 11] }, // Disadv picks 2 -> total 11 vs Guard 4 -> +7 MAJOR (4 cards: 2 Twin Dagger first!)
    { defenseStat: 3, armorValue: 1, useGuard: true },
    trickster,
    'Twin Dagger'
  );
  assertEq(goodAim.validAimedTarget, true, 'Can aim at visible Twin Dagger card');
  assertEq(goodAim.combat?.attackerRoll.type, 'DISADVANTAGE', 'Aimed attack rolls at Disadvantage');
  assertEq(goodAim.foe.cards.find(c => c.name === 'Twin Dagger')?.copies, 0, 'Aimed card Twin Dagger shredded first');

  const migrated = migrateFoeToStack({ id: 'old_1', name: 'Brigand', health: 13 });
  assertEq(getTotalFoeCards(migrated), 7, 'Stack size = ceil(13 / 2) = 7');
  const boss = migrateFoeToStack({ id: 'boss_1', name: 'Drake Matriarch', health: 40, composure: 22, isBoss: true });
  assertEq(boss.isBoss, true, 'Boss keeps boss flag');
  assertEq(boss.health, 40, 'Boss keeps Health pool');
  assertEq(boss.composure, 22, 'Boss keeps Composure pool');
}
console.log('✓ Step 8 (Foes as cards, Resolve, Command visibility, aimed attacks, leader fall, Boss HP) verified');

// STEP 9. HEROES' SHOCKS
{
  let hero: EntityInjuryState = {
    name: 'Alden',
    health: 12,
    maxHealth: 12,
    composure: 10,
    maxComposure: 10,
    stamina: 10,
    focus: 10,
    activeWounds: []
  };
  // ALLY_DROPS -> Grief (pair: vitality 4, charm 3 -> best 4) + anchor 1 + roll 3 = 8 < 10 -> Composure Minor!
  const shock1 = resolveHeroShock(hero, harrowAttr, 'ALLY_DROPS', { anchorValue: 1, fixedRoll: 3 });
  assertEq(shock1.triggered, true, 'First Shock in round triggers');
  assertEq(shock1.passed, false, 'Roll 3 + best(vit 4, charm 3) + anchor 1 = 8 < 10 fails');
  assertEq(shock1.composureType, 'Grief', 'ALLY_DROPS deals Grief');
  assertEq(shock1.updatedState.maxComposure, 6, 'Failed Shock inflicts Composure Minor (-4 maxComposure)');

  // Second Shock in same round skipped (max 1 Shock per creature per round)
  const shock2 = resolveHeroShock(shock1.updatedState, harrowAttr, 'ALLY_DIES', { fixedRoll: 1 });
  assertEq(shock2.skippedDueToRoundLimit, true, 'Second Shock in same round is skipped');
  assertEq(shock2.updatedState.maxComposure, 6, 'No extra Composure loss from skipped second Shock');
}
console.log('✓ Step 9 (Heroes Shocks: pair best stat + Anchor vs 10, 1/round cap) verified');

// STEP 10. READY, INTERCEPT, SHOOTING A CHARGER
{
  // Shooter Readies against charger -> hits Minor -> stops charger Move
  const shooterReady = resolveReadyReaction(
    { actorId: 'kestrel', trigger: 'CHARGER', isShooter: true, hasReactionRemaining: true },
    { attackerStat: 6, weaponValue: 2, fixedRoll: 7 }, // 15
    { defenseStat: 7, armorValue: 3, useGuard: true }  // Guard 10 -> +5 MINOR
  );
  assertEq(shooterReady.fired, true, 'Shooter Ready fires');
  assertEq(shooterReady.reactionSpent, true, 'Shooter Ready spends Reaction');
  assertEq(shooterReady.chargerMoveStopped, true, 'Minor hit from shooter Ready stops charger Move');

  // Intercept trigger: foe attacks ally next to guardian -> attack hits guardian instead
  const interceptReady = resolveReadyReaction(
    { actorId: 'harrow', trigger: 'INTERCEPT_ALLY', stepIntoReach: true, hasMoveRemaining: true },
    { attackerStat: 6, weaponValue: 3 },
    { defenseStat: 4, armorValue: 2, useGuard: true },
    {
      attackerParams: { attackerStat: 5, weaponValue: 2, fixedRoll: 4 }, // Total 11
      interceptorDefense: { defenseStat: 5, armorValue: 3, fixedRoll: 7 } // Guard/Def 15 -> deflected!
    }
  );
  assertEq(interceptReady.intercepted, true, 'Intercept redirects attack onto interceptor');
  assertEq(interceptReady.moveSpent, true, '1-space step spends Move');
  assertEq(interceptReady.interceptedAttackResult?.outcome, 'DEFENDER_SUCCESS', 'Redirected attack resolved against interceptor');
}
console.log('✓ Step 10 (Ready, Intercept, Shooter vs Charger) verified');

// STEP 11. TALK
{
  // Persuasion vs target's current Composure
  assertEq(resolvePersuasion({ speakerStatVal: 5, targetComposure: 10, fixedRoll: 12 }).outcome, 'YES_AND_MORE', 'Margin +7 -> YES_AND_MORE');
  assertEq(resolvePersuasion({ speakerStatVal: 5, targetComposure: 10, fixedRoll: 9 }).outcome, 'YES', 'Margin +4 -> YES');
  assertEq(resolvePersuasion({ speakerStatVal: 5, targetComposure: 10, fixedRoll: 6 }).outcome, 'YES_FOR_A_PRICE', 'Margin +1 -> YES_FOR_A_PRICE');
  assertEq(resolvePersuasion({ speakerStatVal: 5, targetComposure: 10, fixedRoll: 3 }).outcome, 'NO', 'Margin -2 -> NO');
  assertEq(resolvePersuasion({ speakerStatVal: 12, targetComposure: 5, againstOrders: true, fixedRoll: 12 }).outcome, 'REJECTED_AGAINST_ORDERS', 'Cannot persuade against orders');

  // One voice: other speakers grant Advantage, second speaker in same round rejected
  const teamPersuasion = resolvePersuasion({
    speakerStatVal: 5,
    targetComposure: 10,
    otherSpeakersCount: 2,
    fixedRolls: [2, 10] // Adv keeps 10 -> 15 vs 10 -> YES (+5)
  });
  assertEq(teamPersuasion.usedAdvantage, true, 'Other speakers grant Advantage');
  assertEq(teamPersuasion.outcome, 'YES', 'Helped persuasion uses Advantage');
  assertEq(teamPersuasion.woundsDealt, 0, 'Persuasion wounds nobody');

  const secondVoice = resolvePersuasion({
    speakerStatVal: 6,
    targetComposure: 10,
    alreadySpokenToTargetThisRound: true
  });
  assertEq(secondVoice.outcome, 'REJECTED_ONE_VOICE', 'One speaker per target per round');

  // Talk in a fight wounds nobody; hostile social attack out of a fight deals Composure injury
  const speakerA: SocialCombatant = { name: 'Orator', stats: { charm: 7 }, composure: 10, maxComposure: 10 };
  const listenerB: SocialCombatant = { name: 'Captain', stats: { willpower: 3 }, composure: 10, maxComposure: 10 };
  const inFightTalk = resolveOpposedSocialContest(speakerA, listenerB, 'charm', { inFight: true });
  assertEq(inFightTalk.composureDamage, 0, 'Talk in a fight deals 0 Composure damage');
}
console.log('✓ Step 11 (Talk: Persuasion Difficulty=Composure, One Voice, free in fight) verified');

// STEP 12. BUILDING CHARACTERS (DOUBLING FEE & TECHNIQUE COSTS)
{
  // Harrow example from rulebook: 3 jobs on Might (weapon, armor, Wrangler) -> fee 2 from Stamina
  const harrowJobs = calculateDoublingFee({
    weapons: ['might'],
    armor: 'might',
    paths: ['might', 'vitality']
  });
  assertEq(harrowJobs.staminaFee, 2, '3 jobs on Might cost +1 + +1 = 2 Stamina');
  assertEq(harrowJobs.focusFee, 0, 'No Mind doubling fee for Harrow');

  // Kestrel example: 3 jobs on Awareness (bow, leathers, Lux) -> fee 2 from Focus
  const kestrelJobs = calculateDoublingFee({
    weapons: ['awareness'],
    armor: 'awareness',
    paths: ['awareness', 'logic']
  });
  assertEq(kestrelJobs.focusFee, 2, '3 jobs on Awareness cost 2 Focus');
  assertEq(kestrelJobs.staminaFee, 0, 'No Stamina doubling fee for Kestrel');

  // 5 jobs curve: +1, +1, +2, +2 = 6 total (4th = 4, 2nd = 1)
  assertEq(calculateDoublingFee({ jobCountsByStat: { might: 2 } }).staminaFee, 1, '2 jobs = +1');
  assertEq(calculateDoublingFee({ jobCountsByStat: { might: 3 } }).staminaFee, 2, '3 jobs = +2 total');
  assertEq(calculateDoublingFee({ jobCountsByStat: { might: 4 } }).staminaFee, 4, '4 jobs = +4 total');
  assertEq(calculateDoublingFee({ jobCountsByStat: { might: 5 } }).staminaFee, 6, '5 jobs = +6 total');

  // Techniques paid by what they do
  assertEq(getTechniqueEnergyCost('STRIKE', 1).pool, 'STAMINA', 'Strikes cost Stamina');
  assertEq(getTechniqueEnergyCost('SHOT', 1).pool, 'STAMINA', 'Shots cost Stamina');
  assertEq(getTechniqueEnergyCost('PHYSICAL_DEFENSE', 1).pool, 'STAMINA', 'Physical defenses cost Stamina');
  assertEq(getTechniqueEnergyCost('MOVE', 1).pool, 'STAMINA', 'Moves cost Stamina');
  assertEq(getTechniqueEnergyCost('SOCIAL_ATTACK', 1).pool, 'FOCUS', 'Social attacks cost Focus');
  assertEq(getTechniqueEnergyCost('MIND_DEFENSE', 1).pool, 'FOCUS', 'Mind defenses cost Focus');

  const built = buildOstrakaCustomCharacter({ kingdom: 'Mammal', body7: 'might', trackId: 'track_might' });
  assertEq(built.doublingFee.staminaFee, 1, 'Character builder applies Doubling Fee (+1 for 2 jobs on Might) to Stamina');
  const builtDualSame = buildOstrakaCustomCharacter({ kingdom: 'Mammal', body7: 'might', dualTrackMode: true, trackId: 'track_might', trackId2: 'track_vitality' });
  assertEq(builtDualSame.doublingFee.staminaFee, 1, 'Dual track still applies Doubling Fee for shared stat');
}
console.log('✓ Step 12 (Doubling Fee curve + Technique pools by action nature) verified');

// FULL ROUND §5.0 WORKED EXAMPLE
console.log('\n--- Running Full Round Worked Example (§5.0 On One Page) ---');
{
  // Participants & declaration order (lowest Perception first): Brute (Perc 6), Kestrel (Perc 12), Harrow (Perc 10)
  const initiatives = [
    { id: 'brute', perception: 6, speed: 9 },
    { id: 'harrow', perception: 10, speed: 10 },
    { id: 'kestrel', perception: 12, speed: 15 }
  ];
  const declareOrder = [...initiatives].sort((a, b) => a.perception - b.perception).map(c => c.id);
  const executeOrder = [...initiatives].sort((a, b) => b.speed - a.speed).map(c => c.id);
  assertEq(declareOrder.join(','), 'brute,harrow,kestrel', 'Declaration: lowest Perception first');
  assertEq(executeOrder.join(','), 'kestrel,harrow,brute', 'Execution: highest Speed first');

  let kestrelState: EntityInjuryState = { name: 'Kestrel', health: 10, maxHealth: 10, composure: 11, maxComposure: 11, stamina: 10, focus: 12, activeWounds: [] };
  let harrowState: EntityInjuryState = { name: 'Harrow', health: 14, maxHealth: 14, composure: 10, maxComposure: 10, stamina: 12, focus: 9, activeWounds: [] };

  let bossLeader = createFoeStack({
    id: 'captain', name: 'Redwall Captain', stake: 'leader',
    cards: [{ name: 'Core', kind: 'core', copies: 3 }, { name: 'War-Horn', kind: 'ability', copies: 2 }]
  });
  let charger = createFoeStack({
    id: 'charger', name: 'Billhook Charger', stake: 'rank-and-file',
    cards: [{ name: 'Core', kind: 'core', copies: 2 }, { name: 'Rush', kind: 'trait', copies: 2 }]
  });

  // 1. Kestrel goes first (Speed 15) and Readies a shot against a charger
  // 2. Charger acts: Kestrel's Ready fires BEFORE the charger arrives, hits MINOR -> stops charger's Move!
  const readyStop = resolveReadyReaction(
    { actorId: 'kestrel', trigger: 'CHARGER', isShooter: true, hasReactionRemaining: true },
    { attackerStat: 6, weaponValue: 2, fixedRoll: 4 }, // Total 12
    { defenseStat: 5, armorValue: 2, useGuard: true }  // Guard 7 -> Margin +5 MINOR
  );
  assertEq(readyStop.chargerMoveStopped, true, 'Worked Example: Kestrel Ready shot stops Charger Move');
  charger = applyHitToFoe(charger, readyStop.readyAttackResult!.tier).foe; // Shreds 2 trait cards
  assertEq(getTotalFoeCards(charger), 2, 'Worked Example: Charger lost Rush x2 cards');

  // 3. Captain strikes Harrow -> margin 0 Clash tie -> Harrow Feints vs Captain Presses -> Harrow wins with Advantage
  const captainStrike = resolveContestedAttack(
    { attackerStat: 6, weaponValue: 2, fixedRoll: 6 }, // 14
    { defenseStat: 5, armorValue: 2, fixedRoll: 7 }   // 14 -> CLASH_TIED!
  );
  assertEq(captainStrike.outcome, 'CLASH_TIED', 'Worked Example: Captain & Harrow lock in Clash');
  const clashOut = resolveClashTie('PRESS', 'might', 6, 'FEINT', 'might', 7, {
    attackerFixedRoll: 5,
    defenderFixedRoll: [2, 11] // FEINT beats PRESS -> Advantage 11 + 7 = 18 vs 11
  });
  assertEq(clashOut.result, 'DEFENDER_WINS_CLASH', 'Worked Example: Harrow FEINT beats PRESS with Advantage');

  // 4. Harrow answers Captain on his turn -> lands MAJOR -> Captain reduced to MINOR by Captain's own trait + ally Ward? Test reduction on Harrow's Major too!
  const harrowHit = resolveContestedAttack(
    { attackerStat: 7, weaponValue: 3, hasAdvantage: true, fixedRolls: [4, 11] }, // 11+10=21 vs Guard 9 -> +12 CRIT
    { defenseStat: 6, armorValue: 3, useGuard: true }
  );
  assertEq(harrowHit.tier, 'CRITICAL', 'Worked Example: Harrow lands Critical (+12)');
  const captainCrushed = applyHitToFoe(bossLeader, harrowHit.tier, { squad: [charger] });
  bossLeader = captainCrushed.foe;
  charger = captainCrushed.squad[0]!;
  assertEq(bossLeader.status, 'down', 'Worked Example: Captain out of cards -> down');
  assertEq(charger.resolve, 0, 'Worked Example: Charger Resolve drops to 0 when leader falls');
  assertEq(charger.status, 'seeking_exit', 'Worked Example: Charger seeks exit and takes quarter');

  // 5. Companion Alden sees an ally drop into 0 HP earlier and makes his 1/round Shock, then stabilizes the fallen ally
  let fallenAlly: EntityInjuryState = { name: 'Lyra', health: 8, maxHealth: 8, composure: 10, maxComposure: 10, stamina: 7, focus: 8, activeWounds: [] };
  fallenAlly = applyBrutalInjury(fallenAlly, 'MAJOR', 'HEALTH', 'Cutlass slash', {
    reductions: { ownReductions: ['Unbroken'], allyReductions: ['Mend the Blow'], isMendFromAlly: true }
  }).updatedState; // Reduced Major -> Graze! Still standing: maxHealth stays 8, owed 1 Stamina, -2 Composure
  assertEq(fallenAlly.maxHealth, 8, 'Worked Example: Own trait + ally Mend reduces Major to Graze');
  assertEq(fallenAlly.owed?.stamina, 1, 'Worked Example: Reduced Graze owes 1 Stamina at Come-Down');

  // Direct unreduced Major knocks Lyra to 0 HP (down: 6 rounds)
  fallenAlly = applyBrutalInjury(fallenAlly, 'MAJOR', 'HEALTH', 'Follow-up cleave').updatedState;
  assertEq(fallenAlly.isDown, true, 'Worked Example: Unreduced Major drops Lyra to 0 HP');
  assertEq(fallenAlly.dyingRounds, 6, 'Worked Example: Downed countdown starts at 6');

  // Kestrel takes 1 Shock in the round on seeing Lyra drop, fails (< 10) -> takes Composure Minor Grief
  const kestrelShock = resolveHeroShock(kestrelState, { ...harrowAttr, vitality: 3, charm: 3 }, 'ALLY_DROPS', { anchorValue: 1, fixedRoll: 4 });
  assertEq(kestrelShock.passed, false, 'Worked Example: Kestrel fails Grief Shock (4+3+1=8 < 10)');
  kestrelState = kestrelShock.updatedState;
  assertEq(kestrelState.maxComposure, 7, 'Worked Example: Failed Shock reduces Kestrel maxComposure 11 -> 7');

  // Round ends: dying countdown ticks (6 -> 5), then Harrow stabilizes Lyra (1 S + 1 F)
  const downTick = advanceDyingRound(fallenAlly);
  fallenAlly = downTick.updatedState;
  assertEq(fallenAlly.dyingRounds, 5, 'Worked Example: End of round dying countdown 6 -> 5');
  assert(downTick.narration?.includes('Lyra is down: 5 rounds'), 'Worked Example: Downed narration emitted');
  const stabilizeRes = stabilizeDowned(fallenAlly, { stamina: harrowState.stamina, focus: harrowState.focus });
  assertEq(stabilizeRes.success, true, 'Worked Example: Harrow stabilizes Lyra (1 S + 1 F)');
  harrowState.stamina = stabilizeRes.updatedHelper.stamina;
  harrowState.focus = stabilizeRes.updatedHelper.focus;

  // 6. Harrow took a Minor hit earlier and settled at Come-Down
  harrowState = applyBrutalInjury(harrowState, 'MINOR', 'HEALTH', 'Cutlass cut').updatedState;
  const bleedRes = tickOngoingBleed(harrowState);
  harrowState = payAtComeDown(bleedRes.updatedState);
  assertEq(harrowState.stamina, 9, 'Worked Example: Harrow spent 1 S stabilizing and Come-Down collects 2 owed Stamina (12 -> 11 -> 9)');
  assertEq(harrowState.composure, 8, 'Worked Example: Harrow takes shakes after fight (10 -> 8)');

  // Verify Kestrel pays her Shock Minor Focus bill (2 Focus) + shakes at Come-Down
  kestrelState = payAtComeDown(kestrelState);
  assertEq(kestrelState.focus, 10, 'Worked Example: Kestrel pays 2 Focus owed from Grief Shock (12 -> 10)');
  assertEq(kestrelState.composure, 5, 'Worked Example: Kestrel takes shakes after Shock injury (7 -> 5)');
}
console.log('✓ Full-round §5.0 Worked Example verified end-to-end');

// RULEBOOK §5.0 + §13.2 STOAT CUTTHROAT WORKED ROUND VIA BrutalGameMaster
console.log('\n--- Running Rulebook §5.0 + §13.2 Stoat Cutthroat Round via BrutalGM ---');
{
  const gm = new BrutalGameMaster(pool, '');

  // §13.2 Stoat Cutthroat canonical stats & gear
  const stoatBody = { finesse: 6, reflex: 6, fortitude: 4, might: 4, vitality: 4 };
  const stoatNerve = { intuition: 5, willpower: 4, logic: 4 };
  const stoatSpeed = stoatBody.reflex + Math.min(stoatBody.finesse, stoatBody.vitality) + stoatNerve.logic;
  assertEq(stoatSpeed, 14, '§13.2 Stoat Cutthroat Speed = Reflex 6 + lowest Body 4 + lowest Nerve 4 = 14');
  const stoatGuard = stoatBody.fortitude + 2; // Forge Leathers +2
  const stoatMindGuard = stoatNerve.willpower + 1; // Light Anchor +1
  assertEq(stoatGuard, 6, '§13.2 Stoat Forge Leathers Guard = Fortitude 4 + 2 = 6');
  assertEq(stoatMindGuard, 5, '§13.2 Stoat Mind Guard = Willpower 4 + Light Anchor 1 = 5');

  const stoatCards = [
    { name: 'Finesse (hands)', kind: 'core' as const, copies: 2 },
    { name: 'Reflex (legs)', kind: 'core' as const, copies: 2 },
    { name: 'Intuition (Ambusher)', kind: 'trait' as const, copies: 2, visible: false },
    { name: 'Quick Blades', kind: 'ability' as const, copies: 1 },
  ];
  let stoat1 = createFoeStack({ id: 'stoat_1', name: 'Stoat Cutthroat #1', stake: 'rank-and-file', cards: stoatCards });
  let stoat2 = createFoeStack({ id: 'stoat_2', name: 'Stoat Cutthroat #2', stake: 'rank-and-file', cards: stoatCards });
  assertEq(getTotalFoeCards(stoat1), 7, '§13.2 Stoat stack size = 7 cards');
  assertEq(stoat1.resolve, 4, 'Rank-and-file Stoat Resolve = 4');

  // Round order: lowest Perception declares first, highest Speed (Stoat 14 > Harrow 10) executes first
  const harrowInRound = { name: 'Harrow Grist', health: 13, maxHealth: 13, composure: 10, maxComposure: 10, stamina: 14, focus: 11, activeWounds: [] } as EntityInjuryState;

  // 1. Stoat #1 strikes with Dueling Blade (d12 + 6 + 2) vs Harrow's 1/round Active Defense (d12 + 5 + 2)
  const attack1 = gm.resolveContestedAttack(
    { attackerStat: stoatBody.finesse, weaponValue: 2, fixedRoll: 5 }, // 5 + 6 + 2 = 13
    { defenseStat: 5, armorValue: 2, fixedRoll: 6, useGuard: false }     // 6 + 5 + 2 = 13 -> margin 0
  );
  assertEq(attack1.outcome, 'CLASH_TIED', '§5.0: Exact margin 0 in reach triggers Clash');
  const clash = resolveClashTie('PRESS', 'finesse', stoatBody.finesse, 'FEINT', 'might', harrowAttr.might, {
    attackerFixedRoll: 7,
    defenderFixedRoll: [3, 10], // FEINT beats PRESS -> Advantage keeps 10 + 7 = 17 vs 13
  });
  assertEq(clash.attackerHasAdvantage, false, '§5.8: PRESS does not get Advantage vs FEINT');
  assertEq(clash.defenderHasAdvantage, true, '§5.8: FEINT beats PRESS and rolls with Advantage');
  assertEq(clash.attackerTotal, 13, 'Stoat Clash total = 7 + best stat 6 = 13');
  assertEq(clash.defenderTotal, 17, 'Harrow Clash total = 10 + best stat 7 = 17');
  assertEq(clash.result, 'DEFENDER_WINS_CLASH', 'Harrow wins Clash');

  // 2. Stoat #2 attacks Harrow's Guard (Fortitude 5 + Armor 2 = Guard 7) with active defense already spent
  const attack2 = gm.resolveContestedAttack(
    { attackerStat: stoatBody.finesse, weaponValue: 2, fixedRoll: 5 }, // 13
    { defenseStat: harrowAttr.fortitude, armorValue: 2, useGuard: true } // Guard 7 -> margin +6 MAJOR
  );
  assertEq(attack2.margin, 6, '§5.4: 13 vs Guard 7 = Net Margin +6');
  assertEq(attack2.tier, 'MAJOR', '§5.4: Margin 6 is MAJOR');
  assertEq(attack2.capacityLost, 8, '§5.4: MAJOR loses 8 capacity');
  assertEq(attack2.energyShredded, 4, '§5.4: MAJOR owes 4 energy');

  // Harrow uses 1 own reduction (Hide Trait) + 1 ally Mend the Blow (free for patient) -> Major drops to Graze
  const reduced = reduceInjuryTier(attack2.tier, {
    ownReductions: ['Hide Trait'],
    allyReductions: ['Mend the Blow'],
    isMendFromAlly: true,
  });
  assertEq(reduced.finalTier, 'GRAZE', '§5.0 #3: 1 own + 1 ally drops Major -> Graze');
  assertEq(reduced.patientStaminaCost, 0, '§5.0 #3: Ally Mend costs patient 0 Stamina');
  let harrowAfterHit = applyBrutalInjury(harrowInRound, reduced.finalTier, 'HEALTH', 'Stoat Dueling Blade').updatedState;
  assertEq(harrowAfterHit.stamina, 14, '§5.0 #4: In-fight Stamina remains 14 (1 owed at Come-Down)');
  assertEq(harrowAfterHit.owed?.stamina, 1, '§5.4: Graze owes 1 Stamina');
  assertEq(harrowAfterHit.maxHealth, 13, '§5.4: Graze loses 0 Health capacity');
  assertEq(harrowAfterHit.composure, 8, '§5.4: Graze near miss drops Composure 10 -> 8');

  // 3. Harrow strikes Stoat #1 Guard (4 + 2 = 6): Might 7 + Heavy Weapon 3 + fixedRoll 2 = 12 -> +6 MAJOR
  const harrowStrike = gm.resolveContestedAttack(
    { attackerStat: harrowAttr.might, weaponValue: 3, fixedRoll: 2 },
    { defenseStat: stoatBody.fortitude, armorValue: 2, useGuard: true }
  );
  assertEq(harrowStrike.margin, 6, 'Harrow 12 vs Stoat Guard 6 = +6');
  assertEq(harrowStrike.tier, 'MAJOR', 'Harrow lands MAJOR on Stoat #1');
  const stoat1Hit = applyHitToFoe(stoat1, harrowStrike.tier, { squad: [stoat2] });
  stoat1 = stoat1Hit.foe;
  assertEq(getTotalFoeCards(stoat1), 3, 'Stoat #1 Major shreds 4 cards (7 -> 3)');
  assertEq(stoat1.resolve, 2, 'Stoat #1 Resolve drops 4 -> 2 (wavering)');

  // Harrow finishes Stoat #1 with a Major; adjacent ally Stoat #2 loses -2 Resolve when ally drops, then -2 on its own Major
  const stoat1Finish = applyHitToFoe(stoat1, 'MAJOR', { squad: [stoat2] });
  stoat1 = stoat1Finish.foe;
  stoat2 = stoat1Finish.squad[0]!;
  assertEq(stoat1.status, 'down', 'Stoat #1 out of cards -> down');
  stoat2 = applyFoeResolveLoss(stoat2, 'ADJACENT_ALLY_DROPPED').foe;
  assertEq(stoat2.resolve, 2, '§13.2: Adjacent Stoat #1 drop costs Stoat #2 -2 Resolve (4 -> 2)');
  const stoat2Major = applyHitToFoe(stoat2, 'MAJOR'); // Resolve drops 2 -> 0 after Major
  stoat2 = stoat2Major.foe;
  assertEq(stoat2.resolve, 0, '§13.2: Rank-and-file Stoat #2 drops from Resolve 2 -> 0 on Major');
  assertEq(stoat2.status, 'seeking_exit', 'Stoat #2 at 0 Resolve seeks exit and accepts quarter');

  // 4. Come-Down settles owed energy and shakes
  harrowAfterHit = payAtComeDown(harrowAfterHit);
  assertEq(harrowAfterHit.stamina, 13, '§5.0 #10: Come-Down collects 1 owed Stamina (14 -> 13)');
  assertEq(harrowAfterHit.composure, 6, '§5.0 #10: Come-Down shakes cost -2 Composure (8 -> 6)');
}
console.log('✓ Rulebook §5.0 + §13.2 Stoat Cutthroat full round via BrutalGM verified');

console.log(`\n================================================================`);
console.log(`   ALL ${checksPassed} B.R.U.T.A.L. v5.0 RULE ASSERTIONS PASSED 100%     `);
console.log(`================================================================`);
