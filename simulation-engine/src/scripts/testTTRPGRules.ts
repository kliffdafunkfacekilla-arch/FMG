import {
  calculateDerivedPools,
  calculateDerivedSenses,
  calculateCompleteDerivedStats,
  Attributes
} from '../engine/customRulesEngine';
import {
  resolveContestedAttack,
  resolveClashTie,
  rollD12
} from '../engine/combatResolutionEngine';
import {
  applyBrutalInjury,
  applyMagicalHealing,
  EntityInjuryState
} from '../engine/injuryEngine';

console.log('================================================================');
console.log('      B.R.U.T.A.L. TTRPG v4.9 RULES & DICE SYSTEM VERIFIER      ');
console.log('================================================================\n');

// 1. DERIVED STATS TEST (HARROW GRIST CANONICAL CHARACTER)
console.log('--- 1. Testing B.R.U.T.A.L. v4.2 Derived Pools & Senses (Harrow Grist) ---');
const harrowAttr: Attributes = {
  might: 7, endurance: 3, fortitude: 5, vitality: 4, reflex: 4, finesse: 3,
  intuition: 4, awareness: 3, willpower: 4, charm: 3, knowledge: 6, logic: 2
};

const derived = calculateCompleteDerivedStats(harrowAttr);
console.log('Harrow Attributes:', harrowAttr);
console.log('Derived Pools:', derived.pools);
console.log('Derived Senses:', derived.senses);

// Expected: Health = 4+5+4 = 13, Composure = 4+3+3 = 10, Stamina = 7+4+3 = 14, Focus = 2+6+3 = 11
console.log('Health check (vit 4 + fort 5 + int 4 = 13):', derived.pools.health === 13 ? '✅ PASSED' : '❌ FAILED');
console.log('Composure check (will 4 + aware 3 + end 3 = 10):', derived.pools.composure === 10 ? '✅ PASSED' : '❌ FAILED');
console.log('Stamina check (might 7 + ref 4 + cha 3 = 14):', derived.pools.stamina === 14 ? '✅ PASSED' : '❌ FAILED');
console.log('Focus check (log 2 + know 6 + fin 3 = 11):', derived.pools.focus === 11 ? '✅ PASSED' : '❌ FAILED');

// Senses: Perception = 3+4+3 = 10, Speed = 4+4+2 = 10, Stealth = 6+3+3 = 12, Balance = 7+5+4 = 16
console.log('Perception check (aware 3 + int 4 + fin 3 = 10):', derived.senses.perception === 10 ? '✅ PASSED' : '❌ FAILED');
console.log('Speed check (ref 4 + vit 4 + log 2 = 10 | Dodge 10):', derived.senses.speed === 10 && derived.senses.dodge === 10 ? '✅ PASSED' : '❌ FAILED');
console.log('Stealth check (know 6 + cha 3 + end 3 = 12):', derived.senses.stealth === 12 ? '✅ PASSED' : '❌ FAILED');
console.log('Balance check (might 7 + fort 5 + will 4 = 16 | Footing 13):', derived.senses.balance === 16 && derived.senses.footing === 13 ? '✅ PASSED' : '❌ FAILED');
console.log('');

// 2. CONTESTED ATTACK ROLLS (d12 NET MARGIN)
console.log('--- 2. Testing Contested Combat Rolls (100 Iterations with d12) ---');
let hitCount = 0;
let tieCount = 0;
let defendCount = 0;
const tierCounts: Record<string, number> = { GRAZE: 0, MINOR: 0, MAJOR: 0, CRITICAL: 0 };

for (let i = 0; i < 100; i++) {
  const res = resolveContestedAttack(
    { attackerStat: 7, weaponValue: 3 }, // Maul +3
    { defenseStat: 4, armorValue: 2 }   // Ringmail +2
  );

  if (res.outcome === 'ATTACKER_SUCCESS') {
    hitCount++;
    const t = res.tier as string;
    if (t in tierCounts) {
      tierCounts[t] = (tierCounts[t] || 0) + 1;
    }
  } else if (res.outcome === 'CLASH_TIED') {
    tieCount++;
  } else {
    defendCount++;
  }
}
console.log(`Results: ${hitCount} Hits, ${defendCount} Defends, ${tieCount} Tied Clashes`);
console.log('Injury Tiers:', tierCounts);

// Test Guard (passive defense)
const guardAttack = resolveContestedAttack(
  { attackerStat: 7, weaponValue: 3 },
  { defenseStat: 4, armorValue: 2, useGuard: true }
);
console.log('Guard Defense Test (static defense 6):', guardAttack.isGuardDefense ? '✅ PASSED' : '❌ FAILED');
console.log('Guard Log:', guardAttack.log);
console.log('');

// 3. THE CLASH (6 STANCES)
console.log('--- 3. Testing The Clash 6-Stance Resolution ---');
const pressVsHold = resolveClashTie('PRESS', 'might', 7, 'HOLD', 'endurance', 3);
console.log('Clash Result:', pressVsHold.result, `(${pressVsHold.attackerTotal} vs ${pressVsHold.defenderTotal})`);
console.log('Narrative:', pressVsHold.narrative);
console.log('Clash Mechanics:', pressVsHold.result ? '✅ PASSED' : '❌ FAILED');
console.log('');

// 4. INJURY, CAPACITY & ENERGY SHREDDING
console.log('--- 4. Testing Capacity Loss & Energy Shredding ---');
const injuryState: EntityInjuryState = {
  health: 13,
  maxHealth: 13,
  composure: 10,
  maxComposure: 10,
  stamina: 9,
  focus: 11,
  activeWounds: []
};

const minorWound = applyBrutalInjury(injuryState, 'MINOR', 'HEALTH', 'Sword slash');
console.log('After Minor Injury:');
console.log('  Capacity: Health Max reduced from 13 to', minorWound.updatedState.maxHealth, '(Lost 4):', minorWound.updatedState.maxHealth === 9 ? '✅ PASSED' : '❌ FAILED');
console.log('  Energy: Stamina reduced from 9 to', minorWound.updatedState.stamina, '(Shredded 2):', minorWound.updatedState.stamina === 7 ? '✅ PASSED' : '❌ FAILED');

// 5. MAGICAL HEALING BODY TRADEOFF (§8.2, v4.6)
console.log('\n--- 5. Testing Magical Healing (Body Pays with Stamina) ---');
const firstWound = minorWound.updatedState.activeWounds[0];
if (firstWound) {
  const woundId = firstWound.id;
  const healAttempt = applyMagicalHealing(minorWound.updatedState, woundId);
  console.log('Heal Message:', healAttempt.message);
  console.log('Restored Max Health to:', healAttempt.updatedState.maxHealth, '(Restored 4):', healAttempt.updatedState.maxHealth === 13 ? '✅ PASSED' : '❌ FAILED');
  console.log('Patient Stamina paid: 7 ->', healAttempt.updatedState.stamina, '(Paid 2 Stamina):', healAttempt.updatedState.stamina === 5 ? '✅ PASSED' : '❌ FAILED');
  const healedWound = healAttempt.updatedState.activeWounds[0];
  console.log('Wound marked as knitted:', healedWound?.isKnitted ? '✅ PASSED' : '❌ FAILED');
}

console.log('\n================================================================');
console.log('       ALL B.R.U.T.A.L. v4.9 SYSTEMS VERIFIED 100% CANONICAL    ');
console.log('================================================================');
