import { KINGDOMS, LINEAGES, INSTITUTIONS } from './data';
import type { V12Matrix, StatKey } from './data';
import { OUROBOROS_PATH, MASTERY_PERKS } from './expansion-data';
import type { GearDef, SkillDef } from './expansion-data';

export interface DerivedStats {
  hp: { current: number; max: number };
  composure: { current: number; max: number };
  stamina: { max: number; active_battery: number; reserve_pool: number };
  focus: { max: number; active_battery: number; reserve_pool: number };
  phys_defense: number;
  speed: number;
  perception: number;
  mental_defense: number;
}

export interface TrackData {
  level: number;
  marks: string[];
  potency_tokens: number;
  function_tokens: number;
  attribute_tokens: number;
}

export interface CharacterChassis {
  chassis_id: string;
  metadata: { kingdom: string; lineage: string; institution: string; subtype: string; experience: { progression_tracks: Record<string, TrackData> } };
  attributes: { body: Record<string, number>; mind: Record<string, number> };
  derived_stats: DerivedStats;
  mechanics: { chaos_gauge: number; adrenaline_deck: string[]; gear_tax_total: number; tax_threshold_met: boolean };
  loadout_slots: { physical: GearDef[]; mental: GearDef[] };
  passive_traits: string[];
  active_powers: SkillDef[];
  mastery_perks: string[];
  injury_log: { minor: string[]; major: string[]; critical: string[] };
  inventory: string[];
}

function getBaseMatrix(): V12Matrix {
  return { might: 0, endurance: 0, reflex: 0, finesse: 0, vitality: 0, fortitude: 0, knowledge: 0, logic: 0, awareness: 0, intuition: 0, charm: 0, willpower: 0 };
}

export function applyDerivedStats(chassis: CharacterChassis) {
  const getStat = (k: StatKey) => chassis.attributes.body[k] ?? chassis.attributes.mind[k] ?? 0;
  
  const ratioBodyMind = (b1: StatKey, b2: StatKey, m1: StatKey) => getStat(b1) + getStat(b2) + Math.round(getStat(m1) / 2);
  const ratioMindBody = (m1: StatKey, m2: StatKey, b1: StatKey) => getStat(m1) + getStat(m2) + Math.round(getStat(b1) / 2);

  chassis.derived_stats.hp.max = 10 + ratioBodyMind('vitality', 'endurance', 'willpower');
  chassis.derived_stats.stamina.max = ratioBodyMind('might', 'finesse', 'intuition');
  chassis.derived_stats.focus.max = ratioMindBody('logic', 'charm', 'reflex');
  chassis.derived_stats.composure.max = 10 + ratioMindBody('knowledge', 'awareness', 'fortitude');
  
  chassis.derived_stats.phys_defense = ratioBodyMind('might', 'fortitude', 'logic');
  chassis.derived_stats.speed = ratioBodyMind('vitality', 'reflex', 'charm');
  chassis.derived_stats.perception = ratioMindBody('awareness', 'knowledge', 'finesse');
  chassis.derived_stats.mental_defense = ratioMindBody('willpower', 'intuition', 'endurance');

  // Recalculate Threshold Rule
  chassis.mechanics.gear_tax_total = 0;
  [...chassis.loadout_slots.physical, ...chassis.loadout_slots.mental].forEach(g => { if(g && g.tax) chassis.mechanics.gear_tax_total += g.tax; });
  
  const cap = Math.max(chassis.derived_stats.stamina.max, chassis.derived_stats.focus.max);
  chassis.mechanics.tax_threshold_met = chassis.mechanics.gear_tax_total > (cap / 2);
}

export function updateMasteryPerks(chassis: CharacterChassis) {
  const perks: string[] = [];
  const getStat = (k: StatKey) => chassis.attributes.body[k] ?? chassis.attributes.mind[k] ?? 0;
  
  MASTERY_PERKS.forEach(p => {
    if (getStat(p.stat) >= p.level) {
      perks.push(`${p.name} (${p.stat} ${p.level}): ${p.desc}`);
    }
  });
  chassis.mastery_perks = perks;
}

export function shiftOuroboros(chassis: CharacterChassis, statToIncrease: StatKey): boolean {
  const getStat = (k: StatKey) => chassis.attributes.body[k] !== undefined ? chassis.attributes.body[k] : chassis.attributes.mind[k];
  const setStat = (k: StatKey, val: number) => {
    if (chassis.attributes.body[k] !== undefined) chassis.attributes.body[k] = val;
    else chassis.attributes.mind[k] = val;
  };

  if (getStat(statToIncrease) >= 8) return false;

  const idx = OUROBOROS_PATH.indexOf(statToIncrease);
  const upstreamBreakerIdx = (idx - 1 + OUROBOROS_PATH.length) % OUROBOROS_PATH.length;
  const statToDecrease = OUROBOROS_PATH[upstreamBreakerIdx];

  if (getStat(statToDecrease) <= 0) return false;

  setStat(statToIncrease, getStat(statToIncrease) + 1);
  setStat(statToDecrease, getStat(statToDecrease) - 1);

  applyDerivedStats(chassis);
  updateMasteryPerks(chassis);
  return true;
}

export function generateCharacter(kingdom: string, lineageName: string, instName: string): CharacterChassis {
  const matrix = getBaseMatrix();
  const passives: string[] = [];

  const kingdomBase = KINGDOMS[kingdom];
  if (kingdomBase) Object.keys(kingdomBase).forEach(k => matrix[k as StatKey] = kingdomBase[k as StatKey]);

  const lineageLists = LINEAGES[kingdom] || [];
  const lineage = lineageLists.find(l => l.name === lineageName);
  if (lineage) {
    matrix[lineage.plus] += 1;
    matrix[lineage.minus] -= 1;
    passives.push(`${lineage.traitName}: ${lineage.traitDesc}`);
  }

  const inst = INSTITUTIONS.find(i => i.name === instName);
  if (inst) {
    matrix[inst.stat] += 1;
    passives.push(`Brand: ${inst.descriptor}`);
  }

  const BODY_KEYS: StatKey[] = ['might', 'endurance', 'reflex', 'finesse', 'vitality', 'fortitude'];
  const MIND_KEYS: StatKey[] = ['knowledge', 'logic', 'awareness', 'intuition', 'charm', 'willpower'];

  const enforceCeiling = (keys: StatKey[]) => {
    let overflow = 0;
    for (const key of keys) {
      if (matrix[key] > 8) { overflow += matrix[key] - 8; matrix[key] = 8; }
    }
    while (overflow > 0) {
      const sorted = [...keys].sort((a, b) => matrix[a] - matrix[b]);
      if (matrix[sorted[0]] < 8) matrix[sorted[0]] += 1;
      overflow--;
    }
  };
  enforceCeiling(BODY_KEYS);
  enforceCeiling(MIND_KEYS);

  const chassis: CharacterChassis = {
    chassis_id: crypto.randomUUID(),
    metadata: { kingdom, lineage: lineageName, institution: instName, subtype: "Standard", experience: { progression_tracks: {} } },
    attributes: {
      body: { might: matrix.might, endurance: matrix.endurance, reflex: matrix.reflex, finesse: matrix.finesse, vitality: matrix.vitality, fortitude: matrix.fortitude },
      mind: { knowledge: matrix.knowledge, logic: matrix.logic, awareness: matrix.awareness, intuition: matrix.intuition, charm: matrix.charm, willpower: matrix.willpower }
    },
    derived_stats: { hp: {current:0, max:0}, composure: {current:0,max:0}, stamina: {max:0,active_battery:10,reserve_pool:0}, focus: {max:0,active_battery:10,reserve_pool:0}, phys_defense: 0, speed: 0, perception: 0, mental_defense: 0 },
    mechanics: { chaos_gauge: 0, adrenaline_deck: [], gear_tax_total: 0, tax_threshold_met: false },
    loadout_slots: { physical: [], mental: [] },
    passive_traits: passives,
    active_powers: [],
    mastery_perks: [],
    injury_log: { minor: [], major: [], critical: [] },
    inventory: []
  };

  applyDerivedStats(chassis);
  updateMasteryPerks(chassis);
  return chassis;
}
