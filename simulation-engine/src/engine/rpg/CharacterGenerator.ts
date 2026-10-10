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
  DEFENSE_SKILLS
} from "./CharacterData.js";

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
  mainType: string;
  subType: string;
  finalType: string;
  powerNullTrack: string;
  trackId: string;
  offenseSkill: string;
  offenseSkillId: string;
  defenseSkill: string;
  defenseSkillId: string;
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
  trackId?: string | undefined;
  offenseSkillId?: string | undefined;
  defenseSkillId?: string | undefined;
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
  const kingdomKeys = Object.keys(KINGDOMS);
  const kingdom = (params.kingdom && KINGDOMS[params.kingdom])
    ? params.kingdom
    : kingdomKeys[Math.floor(Math.random() * kingdomKeys.length)]!;

  const baseMatrix: V12Matrix = { ...KINGDOMS[kingdom]! };

  const lineages = LINEAGES[kingdom] || LINEAGES.Mammal!;
  const lineage = (params.lineage && lineages.find(l => l.name === params.lineage))
    || lineages[Math.floor(Math.random() * lineages.length)]!;

  // Apply lineage modifier (+1 / -1)
  baseMatrix[lineage.plus] = (baseMatrix[lineage.plus] || 1) + 1;
  baseMatrix[lineage.minus] = Math.max(1, (baseMatrix[lineage.minus] || 1) - 1);

  const instName = params.institution || 'Mass';
  const institution = INSTITUTIONS.find(i => i.name === instName) || INSTITUTIONS[0]!;
  baseMatrix[institution.stat] = (baseMatrix[institution.stat] || 1) + 1;

  // Resolve Body splits
  const shuffledBody = shuffle(BODY_STATS);
  const b7 = params.body7 || shuffledBody[0]!;
  const remainingB1 = shuffledBody.filter(s => s !== b7);
  const b4 = params.body4 || remainingB1[0]!;
  const remainingB2 = remainingB1.filter(s => s !== b4);
  const b6 = params.body6 || remainingB2[0]!;
  const remainingB3 = remainingB2.filter(s => s !== b6);
  const b3 = params.body3 || remainingB3[0]!;
  const remainingB4 = remainingB3.filter(s => s !== b3);
  const b5 = params.body5 || remainingB4[0]!;
  const remainingB5 = remainingB4.filter(s => s !== b5);
  const b2 = params.body2 || remainingB5[0]!;

  // Apply Body split bonuses
  baseMatrix[b7] += 7;
  baseMatrix[b4] += 4;
  baseMatrix[b6] += 6;
  baseMatrix[b3] += 3;
  baseMatrix[b5] += 5;
  baseMatrix[b2] += 2;

  // Resolve Mind splits
  const shuffledMind = shuffle(MIND_STATS);
  const m7 = params.mind7 || shuffledMind[0]!;
  const remainingM1 = shuffledMind.filter(s => s !== m7);
  const m4 = params.mind4 || remainingM1[0]!;
  const remainingM2 = remainingM1.filter(s => s !== m4);
  const m6 = params.mind6 || remainingM2[0]!;
  const remainingM3 = remainingM2.filter(s => s !== m6);
  const m3 = params.mind3 || remainingM3[0]!;
  const remainingM4 = remainingM3.filter(s => s !== m3);
  const m5 = params.mind5 || remainingM4[0]!;
  const remainingM5 = remainingM4.filter(s => s !== m5);
  const m2 = params.mind2 || remainingM5[0]!;

  // Apply Mind split bonuses
  baseMatrix[m7] += 7;
  baseMatrix[m4] += 4;
  baseMatrix[m6] += 6;
  baseMatrix[m3] += 3;
  baseMatrix[m5] += 5;
  baseMatrix[m2] += 2;

  // Track (1 of 12, gives +2)
  const track = (params.trackId && POWER_NULL_TRACKS.find(t => t.id === params.trackId))
    || POWER_NULL_TRACKS[Math.floor(Math.random() * POWER_NULL_TRACKS.length)]!;
  baseMatrix[track.stat] += track.bonus;

  // Offense Skill (1 of 12, gives +2)
  const offSkill = (params.offenseSkillId && OFFENSE_SKILLS.find(s => s.id === params.offenseSkillId))
    || OFFENSE_SKILLS[Math.floor(Math.random() * OFFENSE_SKILLS.length)]!;
  baseMatrix[offSkill.stat] += offSkill.bonus;

  // Defense Skill (1 of 12, gives +2)
  const defSkill = (params.defenseSkillId && DEFENSE_SKILLS.find(s => s.id === params.defenseSkillId))
    || DEFENSE_SKILLS[Math.floor(Math.random() * DEFENSE_SKILLS.length)]!;
  baseMatrix[defSkill.stat] += defSkill.bonus;

  // Classifications:
  // 7/4 Body Choice sets Main Type (driven by dominant b7)
  const mainType = MAIN_TYPES[b7]?.name || 'Titan';
  // 7/4 Mind Choice sets Sub-Type (driven by dominant m7)
  const subType = SUB_TYPES[m7]?.name || 'Arcanist';
  // 6/3 Body Choice sets Final Type (driven by dominant b6)
  const finalType = FINAL_TYPES[b6]?.name || 'Vanguard';

  const passiveTraits = [
    { name: lineage.traitName, desc: lineage.traitDesc },
    { name: `Track: ${track.powerName}`, desc: `${track.powerDesc} / Null: ${track.nullDesc}` },
    { name: `Brand of ${institution.name}`, desc: institution.descriptor }
  ];

  const skills = [
    { id: offSkill.id, name: offSkill.name, cost: offSkill.cost, desc: offSkill.desc },
    { id: defSkill.id, name: defSkill.name, cost: defSkill.cost, desc: defSkill.desc }
  ];

  const derived = calcDerivedStats(baseMatrix);
  const perks = getUnlockedPerks(baseMatrix);

  // Equip weapons/armors
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
    mainType,
    subType,
    finalType,
    powerNullTrack: track.name,
    trackId: track.id,
    offenseSkill: offSkill.name,
    offenseSkillId: offSkill.id,
    defenseSkill: defSkill.name,
    defenseSkillId: defSkill.id,
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

