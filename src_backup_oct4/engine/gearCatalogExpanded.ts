export interface DetailedGearDefinition {
  gearId: string;
  name: string;
  category: 'MELEE_WEAPON' | 'RANGED_WEAPON' | 'SOCIAL_WEAPON' | 'BODY_ARMOR' | 'MIND_ARMOR';
  primaryStat: string;   // Main Body or Mind stat
  secondaryStat: string; // Complementary Body or Mind stat
  baseModifier: number;  // Gear rating bonus (+2 to +4)
  loadoutCost: number;   // Deducted from Stamina (Body) or Focus (Mind)
  resourcePool: 'STAMINA' | 'FOCUS';
}

export const EXPANDED_GEAR_CATALOG: DetailedGearDefinition[] = [
  // ==========================================
  // 1. MELEE WEAPONS (Strictly Mapped to Body Stats)
  // ==========================================
  {
    gearId: 'mw_1_greatsword',
    name: 'Executioner Greatsword',
    category: 'MELEE_WEAPON',
    primaryStat: 'might',
    secondaryStat: 'endurance',
    baseModifier: 3,
    loadoutCost: 15,
    resourcePool: 'STAMINA'
  },
  {
    gearId: 'mw_2_rapier',
    name: 'Duelling Rapier',
    category: 'MELEE_WEAPON',
    primaryStat: 'finesse',
    secondaryStat: 'reflex',
    baseModifier: 2,
    loadoutCost: 8,
    resourcePool: 'STAMINA'
  },
  {
    gearId: 'mw_3_warhammer',
    name: 'Crushing Warhammer',
    category: 'MELEE_WEAPON',
    primaryStat: 'might',
    secondaryStat: 'fortitude',
    baseModifier: 3,
    loadoutCost: 14,
    resourcePool: 'STAMINA'
  },
  {
    gearId: 'mw_4_quarterstaff',
    name: 'Balanced Bo Staff',
    category: 'MELEE_WEAPON',
    primaryStat: 'reflex',
    secondaryStat: 'finesse',
    baseModifier: 2,
    loadoutCost: 7,
    resourcePool: 'STAMINA'
  },
  {
    gearId: 'mw_5_brawling_cestus',
    name: 'Spiked Gauntlets / Cestus',
    category: 'MELEE_WEAPON',
    primaryStat: 'vitality',
    secondaryStat: 'might',
    baseModifier: 2,
    loadoutCost: 10,
    resourcePool: 'STAMINA'
  },
  {
    gearId: 'mw_6_heavy_halberd',
    name: 'Pike-Halberd',
    category: 'MELEE_WEAPON',
    primaryStat: 'endurance',
    secondaryStat: 'fortitude',
    baseModifier: 3,
    loadoutCost: 16,
    resourcePool: 'STAMINA'
  },

  // ==========================================
  // 2. RANGED WEAPONS (Mapped to Body + Mind Stats)
  // ==========================================
  {
    gearId: 'rw_1_composite_bow',
    name: 'Composite Warbow',
    category: 'RANGED_WEAPON',
    primaryStat: 'finesse',     // Body Stat
    secondaryStat: 'awareness',  // Mind Stat
    baseModifier: 3,
    loadoutCost: 12,
    resourcePool: 'STAMINA'
  },
  {
    gearId: 'rw_2_heavy_arbalest',
    name: 'Windlass Arbalest',
    category: 'RANGED_WEAPON',
    primaryStat: 'might',       // Body Stat
    secondaryStat: 'logic',      // Mind Stat
    baseModifier: 3,
    loadoutCost: 14,
    resourcePool: 'STAMINA'
  },
  {
    gearId: 'rw_3_thrown_chakram',
    name: 'Precision Chakram',
    category: 'RANGED_WEAPON',
    primaryStat: 'reflex',      // Body Stat
    secondaryStat: 'intuition',  // Mind Stat
    baseModifier: 2,
    loadoutCost: 9,
    resourcePool: 'STAMINA'
  },
  {
    gearId: 'rw_4_sling_staff',
    name: 'Sling Staff of Calculations',
    category: 'RANGED_WEAPON',
    primaryStat: 'endurance',   // Body Stat
    secondaryStat: 'knowledge',  // Mind Stat
    baseModifier: 2,
    loadoutCost: 8,
    resourcePool: 'STAMINA'
  },
  {
    gearId: 'rw_5_blowgun_venom',
    name: 'Calculated Blowgun',
    category: 'RANGED_WEAPON',
    primaryStat: 'finesse',     // Body Stat
    secondaryStat: 'willpower',  // Mind Stat
    baseModifier: 2,
    loadoutCost: 7,
    resourcePool: 'STAMINA'
  },
  {
    gearId: 'rw_6_javelin_command',
    name: 'Commanding Javelin',
    category: 'RANGED_WEAPON',
    primaryStat: 'might',       // Body Stat
    secondaryStat: 'charm',      // Mind Stat
    baseModifier: 3,
    loadoutCost: 11,
    resourcePool: 'STAMINA'
  },

  // ==========================================
  // 3. SOCIAL WEAPONS (Strictly Mapped to Mind Stats)
  // ==========================================
  {
    gearId: 'sw_1_socratic_blade',
    name: 'Socratic Dissection (Logical Debate)',
    category: 'SOCIAL_WEAPON',
    primaryStat: 'logic',
    secondaryStat: 'knowledge',
    baseModifier: 3,
    loadoutCost: 10,
    resourcePool: 'FOCUS'
  },
  {
    gearId: 'sw_2_pathos_oration',
    name: 'Inspirational Pathos Oration',
    category: 'SOCIAL_WEAPON',
    primaryStat: 'charm',
    secondaryStat: 'intuition',
    baseModifier: 3,
    loadoutCost: 10,
    resourcePool: 'FOCUS'
  },
  {
    gearId: 'sw_3_coercive_will',
    name: 'Overbearing Willpower / Intimidation',
    category: 'SOCIAL_WEAPON',
    primaryStat: 'willpower',
    secondaryStat: 'awareness',
    baseModifier: 3,
    loadoutCost: 12,
    resourcePool: 'FOCUS'
  },
  {
    gearId: 'sw_4_subtle_gaslight',
    name: 'Subversive Whispers & Gaslighting',
    category: 'SOCIAL_WEAPON',
    primaryStat: 'awareness',
    secondaryStat: 'logic',
    baseModifier: 2,
    loadoutCost: 8,
    resourcePool: 'FOCUS'
  },
  {
    gearId: 'sw_5_dogmatic_mandate',
    name: 'Inquisitorial Dogma',
    category: 'SOCIAL_WEAPON',
    primaryStat: 'knowledge',
    secondaryStat: 'willpower',
    baseModifier: 3,
    loadoutCost: 13,
    resourcePool: 'FOCUS'
  },
  {
    gearId: 'sw_6_satirical_wit',
    name: 'Piercing Satire & Wit',
    category: 'SOCIAL_WEAPON',
    primaryStat: 'intuition',
    secondaryStat: 'charm',
    baseModifier: 2,
    loadoutCost: 8,
    resourcePool: 'FOCUS'
  },

  // ==========================================
  // 4. BODY ARMORS (Mapped to Body Stats)
  // ==========================================
  {
    gearId: 'ba_1_full_plate',
    name: 'Gothic Full Plate',
    category: 'BODY_ARMOR',
    primaryStat: 'fortitude',
    secondaryStat: 'might',
    baseModifier: 4,
    loadoutCost: 20,
    resourcePool: 'STAMINA'
  },
  {
    gearId: 'ba_2_chainmail',
    name: 'Riveted Chainmail Hauberk',
    category: 'BODY_ARMOR',
    primaryStat: 'endurance',
    secondaryStat: 'fortitude',
    baseModifier: 3,
    loadoutCost: 14,
    resourcePool: 'STAMINA'
  },
  {
    gearId: 'ba_3_studded_leather',
    name: 'Studded Leather Jerkin',
    category: 'BODY_ARMOR',
    primaryStat: 'reflex',
    secondaryStat: 'finesse',
    baseModifier: 2,
    loadoutCost: 8,
    resourcePool: 'STAMINA'
  },
  {
    gearId: 'ba_4_tower_shield',
    name: 'Bulwark Tower Shield',
    category: 'BODY_ARMOR',
    primaryStat: 'fortitude',
    secondaryStat: 'endurance',
    baseModifier: 3,
    loadoutCost: 16,
    resourcePool: 'STAMINA'
  },
  {
    gearId: 'ba_5_lamellar',
    name: 'Silk-Steel Lamellar',
    category: 'BODY_ARMOR',
    primaryStat: 'finesse',
    secondaryStat: 'reflex',
    baseModifier: 2,
    loadoutCost: 10,
    resourcePool: 'STAMINA'
  },
  {
    gearId: 'ba_6_vital_talisman',
    name: 'Vitality Fortification Ward',
    category: 'BODY_ARMOR',
    primaryStat: 'vitality',
    secondaryStat: 'fortitude',
    baseModifier: 2,
    loadoutCost: 6,
    resourcePool: 'STAMINA'
  },

  // ==========================================
  // 5. MIND ARMORS (Mapped to Mind Stats)
  // ==========================================
  {
    gearId: 'ma_1_stoic_bastion',
    name: 'Stoic Mental Bastion',
    category: 'MIND_ARMOR',
    primaryStat: 'willpower',
    secondaryStat: 'logic',
    baseModifier: 3,
    loadoutCost: 12,
    resourcePool: 'FOCUS'
  },
  {
    gearId: 'ma_2_rational_firewall',
    name: 'Cold Rationalization Firewall',
    category: 'MIND_ARMOR',
    primaryStat: 'logic',
    secondaryStat: 'awareness',
    baseModifier: 3,
    loadoutCost: 10,
    resourcePool: 'FOCUS'
  },
  {
    gearId: 'ma_3_charming_persona',
    name: 'Charismatic Social Shield',
    category: 'MIND_ARMOR',
    primaryStat: 'charm',
    secondaryStat: 'intuition',
    baseModifier: 2,
    loadoutCost: 8,
    resourcePool: 'FOCUS'
  },
  {
    gearId: 'ma_4_aetheric_ward',
    name: 'Aetheric Knowledge Ward',
    category: 'MIND_ARMOR',
    primaryStat: 'knowledge',
    secondaryStat: 'willpower',
    baseModifier: 3,
    loadoutCost: 14,
    resourcePool: 'FOCUS'
  },
  {
    gearId: 'ma_5_paranoid_vigilance',
    name: 'Vigilant Awareness Circlet',
    category: 'MIND_ARMOR',
    primaryStat: 'awareness',
    secondaryStat: 'charm',
    baseModifier: 2,
    loadoutCost: 8,
    resourcePool: 'FOCUS'
  },
  {
    gearId: 'ma_6_empathic_buffer',
    name: 'Empathic Grounding Crown',
    category: 'MIND_ARMOR',
    primaryStat: 'intuition',
    secondaryStat: 'knowledge',
    baseModifier: 2,
    loadoutCost: 8,
    resourcePool: 'FOCUS'
  }
];

