import { getRandomWeaponForStat, getRandomArmorForStat, StatKey } from "./EquipmentRegistry.js";
import {
  KINGDOMS,
  LINEAGES,
  INSTITUTIONS,
  calcDerivedStats,
  getUnlockedPerks,
  SKILL_DB,
  V12Matrix,
  MAIN_TYPES,
  SUB_TYPES,
  FINAL_TYPES,
  POWER_NULL_TRACKS,
  OFFENSE_SKILLS,
  DEFENSE_SKILLS,
  BODY_STAT_TO_KINGDOM,
  KINGDOM_LORE,
  SUB_TYPE_LORE
} from "./CharacterData.js";

import {
  OFFENSIVE_SKILL_TRACKS,
  DEFENSIVE_SKILL_TRACKS,
  REALITY_POWER_TREES,
  REALITY_NULL_TREES
} from "./MasterSkillProgression.js";

export interface CharacterStats {
  might: number;
  endurance: number;
  finesse: number;
  reflex: number;
  vitality: number;
  fortitude: number;
  knowledge: number;
  logic: number;
  awareness: number;
  intuition: number;
  charm: number;
  willpower: number;
  kingdom: string;
  lineage: string;
  species: string;
  institution: string;
  mainType?: string;
  subType?: string;
  finalType?: string;
  powerNullTrack: string;
  trackId: string;
  offenseSkill: string;
  offenseSkillId: string;
  defenseSkill: string;
  defenseSkillId: string;
  skillRanks: Record<string, number>;
  skillPoints: number;
  body7: StatKey;
  body4: StatKey;
  body6: StatKey;
  body3: StatKey;
  body5: StatKey;
  body2: StatKey;
  mind7: StatKey;
  mind4: StatKey;
  mind6: StatKey;
  mind3: StatKey;
  mind5: StatKey;
  mind2: StatKey;
  passiveTraits: Array<{ name: string; desc: string }>;
  skills: Array<{ id: string; name: string; cost: string; desc: string }>;
  masteryPerks: Array<{ name: string; stat: string; level: number; desc: string }>;
  maxHp: number;
  maxComposure: number;
  maxStamina: number;
  maxFocus: number;
  physDefense: number;
  speed: number;
  perception: number;
  mentalDefense: number;
  equippedWeapon: string;
  weaponStat: StatKey;
  weaponMod: number;
  equippedArmor: string;
  armorStat: StatKey;
  armorMod: number;
}

export interface OstrakaBuildParams {
  name?: string | undefined;
  kingdom?: string | undefined;
  lineage?: string | undefined;
  species?: string | undefined;
  institution?: string | undefined;
  body7?: StatKey | undefined;
  body4?: StatKey | undefined;
  body6?: StatKey | undefined;
  body3?: StatKey | undefined;
  body5?: StatKey | undefined;
  body2?: StatKey | undefined;
  mind7?: StatKey | undefined;
  mind4?: StatKey | undefined;
  mind6?: StatKey | undefined;
  mind3?: StatKey | undefined;
  mind5?: StatKey | undefined;
  mind2?: StatKey | undefined;
  dualTrackMode?: boolean | undefined;
  trackId?: string | undefined;
  trackId2?: string | undefined;
  offenseSkillId?: string | undefined;
  defenseSkillId?: string | undefined;
  offenseBranchChoice?: 'SPECIALIZATION' | 'PASSIVE' | 'ACTIVE' | undefined;
  defenseBranchChoice?: 'SPECIALIZATION' | 'PASSIVE' | 'ACTIVE' | undefined;
  powerBranchChoice?: 'OFFENSE' | 'DEFENSE' | 'UTILITY' | undefined;
  powerBranchChoice2?: 'OFFENSE' | 'DEFENSE' | 'UTILITY' | undefined;
  skillRanks?: Record<string, number> | undefined;
  equippedWeapon?: string | undefined;
  equippedArmor?: string | undefined;
}

const BODY_STATS: StatKey[] = ['might', 'endurance', 'finesse', 'reflex', 'vitality', 'fortitude'];
const MIND_STATS: StatKey[] = ['knowledge', 'logic', 'awareness', 'intuition', 'charm', 'willpower'];

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = temp;
  }
  return copy;
}

export function buildOstrakaCustomCharacter(params: OstrakaBuildParams = {}): CharacterStats {
  // Resolve Body splits with strict mutual exclusion
  const shuffledBody = shuffle(BODY_STATS);
  const b7 = params.body7 || shuffledBody[0]!;
  const remB1 = BODY_STATS.filter(s => s !== b7);
  const b4 = (params.body4 && remB1.includes(params.body4)) ? params.body4 : remB1[0]!;
  const remB2 = remB1.filter(s => s !== b4);
  const b6 = (params.body6 && remB2.includes(params.body6)) ? params.body6 : remB2[0]!;
  const remB3 = remB2.filter(s => s !== b6);
  const b3 = (params.body3 && remB3.includes(params.body3)) ? params.body3 : remB3[0]!;
  const remB4 = remB3.filter(s => s !== b3);
  const b5 = (params.body5 && remB4.includes(params.body5)) ? params.body5 : remB4[0]!;
  const remB5 = remB4.filter(s => s !== b5);
  const b2 = (params.body2 && remB5.includes(params.body2)) ? params.body2 : remB5[0]!;

  // Body +7 sets Species Kingdom
  const kingdom = (params.kingdom && KINGDOMS[params.kingdom])
    ? params.kingdom
    : (BODY_STAT_TO_KINGDOM[b7] || 'Mammal');

  // Resolve Mind splits with strict mutual exclusion
  const shuffledMind = shuffle(MIND_STATS);
  const m7 = params.mind7 || shuffledMind[0]!;
  const remM1 = MIND_STATS.filter(s => s !== m7);
  const m4 = (params.mind4 && remM1.includes(params.mind4)) ? params.mind4 : remM1[0]!;
  const remM2 = remM1.filter(s => s !== m4);
  const m6 = (params.mind6 && remM2.includes(params.mind6)) ? params.mind6 : remM2[0]!;
  const remM3 = remM2.filter(s => s !== m6);
  const m3 = (params.mind3 && remM3.includes(params.mind3)) ? params.mind3 : remM3[0]!;
  const remM4 = remM3.filter(s => s !== m3);
  const m5 = (params.mind5 && remM4.includes(params.mind5)) ? params.mind5 : remM4[0]!;
  const remM5 = remM4.filter(s => s !== m5);
  const m2 = (params.mind2 && remM5.includes(params.mind2)) ? params.mind2 : remM5[0]!;

  // Initialize all 12 stats to exactly 0 (Total 60 points)
  const baseMatrix: V12Matrix = {
    might: 0, endurance: 0, finesse: 0, reflex: 0, vitality: 0, fortitude: 0,
    knowledge: 0, logic: 0, awareness: 0, intuition: 0, charm: 0, willpower: 0
  };

  // 1-3. Body splits: 7 + 4 + 6 + 3 + 5 + 2 = 27 points
  baseMatrix[b7] += 7;
  baseMatrix[b4] += 4;
  baseMatrix[b6] += 6;
  baseMatrix[b3] += 3;
  baseMatrix[b5] += 5;
  baseMatrix[b2] += 2;

  // 4-6. Mind splits: 7 + 4 + 6 + 3 + 5 + 2 = 27 points
  baseMatrix[m7] += 7;
  baseMatrix[m4] += 4;
  baseMatrix[m6] += 6;
  baseMatrix[m3] += 3;
  baseMatrix[m5] += 5;
  baseMatrix[m2] += 2;

  // 7. Track (Power or Null Choice: +2 total)
  let trackDescName = 'Mass Track';
  let primaryTrackId = 'track_might';
  const trackTraits: Array<{ name: string; desc: string }> = [];

  if (params.dualTrackMode) {
    const t1 = (params.trackId && POWER_NULL_TRACKS.find(t => t.id === params.trackId))
      || POWER_NULL_TRACKS[0]!;
    const t2 = (params.trackId2 && POWER_NULL_TRACKS.find(t => t.id === params.trackId2 && t.id !== t1.id))
      || POWER_NULL_TRACKS.find(t => t.id !== t1.id)!;
    baseMatrix[t1.stat] += 1;
    baseMatrix[t2.stat] += 1;
    trackDescName = `${t1.name} / ${t2.name}`;
    primaryTrackId = t1.id;
    trackTraits.push(
      { name: `Dual Track: ${t1.powerName}`, desc: `${t1.powerDesc} (+1 ${t1.stat.toUpperCase()})` },
      { name: `Dual Track: ${t2.nullName}`, desc: `${t2.nullDesc} (+1 ${t2.stat.toUpperCase()})` }
    );
  } else {
    const track = (params.trackId && POWER_NULL_TRACKS.find(t => t.id === params.trackId))
      || POWER_NULL_TRACKS[Math.floor(Math.random() * POWER_NULL_TRACKS.length)]!;
    baseMatrix[track.stat] += track.bonus;
    trackDescName = track.name;
    primaryTrackId = track.id;
    trackTraits.push(
      { name: `Track: ${track.powerName}`, desc: `${track.powerDesc} / Null: ${track.nullDesc} (+2 ${track.stat.toUpperCase()})` }
    );
  }

  // 8. Offensive Training Choice (+2 to stat, unlocks active combat attack)
  const offSkill = (params.offenseSkillId && OFFENSE_SKILLS.find(s => s.id === params.offenseSkillId))
    || OFFENSE_SKILLS[Math.floor(Math.random() * OFFENSE_SKILLS.length)]!;
  baseMatrix[offSkill.stat] += offSkill.bonus;

  // 9. Defensive Training Choice (+2 to stat, unlocks active combat defense)
  const defSkill = (params.defenseSkillId && DEFENSE_SKILLS.find(s => s.id === params.defenseSkillId))
    || DEFENSE_SKILLS[Math.floor(Math.random() * DEFENSE_SKILLS.length)]!;
  baseMatrix[defSkill.stat] += defSkill.bonus;

  // Total stat points: 27 Body + 27 Mind + 2 Track + 2 Offense + 2 Defense = 60!

  // Lineage / Animal determination
  const lineages = LINEAGES[kingdom] || LINEAGES.Mammal!;
  const lineage = (params.lineage && lineages.find(l => l.name === params.lineage))
    || lineages.find(l => l.plus === b6)
    || lineages[0]!;

  const instName = params.institution || 'Mass';
  const institution = INSTITUTIONS.find(i => i.name === instName) || INSTITUTIONS[0]!;

  // Canonical 3-Branch x 4-Rank Skill Progression Initialization
  const skillRanks: Record<string, number> = params.skillRanks ? { ...params.skillRanks } : {};

  // Offense Track branch choice (default to Specialization or Active)
  const offStat = offSkill.stat;
  const offBranchType = params.offenseBranchChoice || 'SPECIALIZATION';
  const offBranchId = offBranchType === 'SPECIALIZATION'
    ? `spec_weapon_${offStat}`
    : offBranchType === 'PASSIVE'
    ? `pass_${offStat}`
    : `act_off_${offStat}`;
  if (!skillRanks[offBranchId]) skillRanks[offBranchId] = 1;

  // Defense Track branch choice (default to Specialization or Active)
  const defStat = defSkill.stat;
  const defBranchType = params.defenseBranchChoice || 'SPECIALIZATION';
  const defBranchId = defBranchType === 'SPECIALIZATION'
    ? `spec_armor_${defStat}`
    : defBranchType === 'PASSIVE'
    ? `pass_def_${defStat}`
    : `act_def_${defStat}`;
  if (!skillRanks[defBranchId]) skillRanks[defBranchId] = 1;

  // Power / Null branch choice
  if (params.dualTrackMode) {
    const t1 = (params.trackId && POWER_NULL_TRACKS.find(t => t.id === params.trackId)) || POWER_NULL_TRACKS[0]!;
    const t2 = (params.trackId2 && POWER_NULL_TRACKS.find(t => t.id === params.trackId2 && t.id !== t1.id)) || POWER_NULL_TRACKS.find(t => t.id !== t1.id)!;
    const bChoice1 = (params.powerBranchChoice || 'OFFENSE').toLowerCase();
    const bChoice2 = (params.powerBranchChoice2 || 'DEFENSE').toLowerCase();
    const pId1 = `pow_${bChoice1 === 'offense' ? 'off' : bChoice1 === 'defense' ? 'def' : 'util'}_${t1.stat}`;
    const pId2 = `null_${bChoice2 === 'offense' ? 'off' : bChoice2 === 'defense' ? 'def' : 'util'}_${t2.stat}`;
    if (!skillRanks[pId1]) skillRanks[pId1] = 1;
    if (!skillRanks[pId2]) skillRanks[pId2] = 1;
  } else {
    const track = (params.trackId && POWER_NULL_TRACKS.find(t => t.id === params.trackId))
      || POWER_NULL_TRACKS[0]!;
    const bChoice = (params.powerBranchChoice || 'OFFENSE').toLowerCase();
    const pId = `pow_${bChoice === 'offense' ? 'off' : bChoice === 'defense' ? 'def' : 'util'}_${track.stat}`;
    if (!skillRanks[pId]) skillRanks[pId] = 1;
  }

  const passiveTraits = [
    { name: lineage.traitName, desc: lineage.traitDesc },
    ...trackTraits,
    { name: `Brand of ${institution.name}`, desc: institution.descriptor }
  ];

  const skills = [
    { id: offSkill.id, name: offSkill.name, cost: offSkill.cost, desc: `${offSkill.desc} (+2 ${offSkill.stat.toUpperCase()})` },
    { id: defSkill.id, name: defSkill.name, cost: defSkill.cost, desc: `${defSkill.desc} (+2 ${defSkill.stat.toUpperCase()})` }
  ];

  const derived = calcDerivedStats(baseMatrix);
  const perks = getUnlockedPerks(baseMatrix);

  // Equip weapons/armors attuned to character stats
  const weapon = params.equippedWeapon
    ? { name: params.equippedWeapon, stat: b7, mod: 2 }
    : getRandomWeaponForStat(b7);

  const armor = params.equippedArmor
    ? { name: params.equippedArmor, stat: b4, mod: 2 }
    : getRandomArmorForStat(b4);

  return {
    ...baseMatrix,
    kingdom,
    lineage: lineage.name,
    species: lineage.speciesType,
    institution: institution.name,
    powerNullTrack: trackDescName,
    trackId: primaryTrackId,
    offenseSkill: offSkill.name,
    offenseSkillId: offSkill.id,
    defenseSkill: defSkill.name,
    defenseSkillId: defSkill.id,
    skillRanks,
    skillPoints: 0,
    body7: b7,
    body4: b4,
    body6: b6,
    body3: b3,
    body5: b5,
    body2: b2,
    mind7: m7,
    mind4: m4,
    mind6: m6,
    mind3: m3,
    mind5: m5,
    mind2: m2,
    passiveTraits,
    skills,
    masteryPerks: perks.map(p => ({ name: p.name, stat: p.stat, level: p.level, desc: p.desc })),
    maxHp: derived.maxHp,
    maxComposure: derived.maxComposure,
    maxStamina: derived.maxStamina,
    maxFocus: derived.maxFocus,
    physDefense: derived.physDefense,
    speed: derived.speed,
    perception: derived.perception,
    mentalDefense: derived.mentalDefense,
    equippedWeapon: weapon.name,
    weaponStat: weapon.stat,
    weaponMod: weapon.mod,
    equippedArmor: armor.name,
    armorStat: armor.stat,
    armorMod: armor.mod
  };
}

export function generateCharacterFromSpecies(
  reqKingdom?: string,
  reqLineage?: string,
  reqInstitution?: string
): CharacterStats {
  return buildOstrakaCustomCharacter({
    kingdom: reqKingdom,
    lineage: reqLineage,
    institution: reqInstitution
  });
}

export function generateCharacter(): CharacterStats {
  return buildOstrakaCustomCharacter();
}

