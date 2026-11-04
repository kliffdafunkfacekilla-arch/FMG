import { StatKey } from './CharacterData.js';

export interface RankLevelDef {
  rank: 1 | 2 | 3 | 4;
  title: string;
  description: string;
  cost?: string;
  range?: string;
  aoe?: string;
  addedEffect?: string;
}

export interface SkillBranchDef {
  id: string;
  branchType: 'SPECIALIZATION' | 'PASSIVE' | 'ACTIVE';
  name: string;
  tagline: string;
  ranks: [RankLevelDef, RankLevelDef, RankLevelDef, RankLevelDef];
}

export interface SkillTrackDef {
  stat: StatKey;
  trackName: string;
  flavor: string;
  specialization: SkillBranchDef;
  passive: SkillBranchDef;
  active: SkillBranchDef;
}

export interface PowerNullBranchDef {
  id: string;
  branchRole: 'OFFENSE' | 'DEFENSE' | 'UTILITY';
  name: string;
  tagline: string;
  ranks: [RankLevelDef, RankLevelDef, RankLevelDef, RankLevelDef];
}

export interface PowerNullTreeDef {
  stat: StatKey;
  constantName: string;
  mode: 'POWER' | 'NULL';
  treeName: string;
  philosophicalCore: string;
  offense: PowerNullBranchDef;
  defense: PowerNullBranchDef;
  utility: PowerNullBranchDef;
}

// =========================================================================
// UNIVERSAL SPECIALIZATION RANKS (AS DESIGNED BY USER)
// =========================================================================

export function createWeaponSpecializationBranch(stat: StatKey, weaponCategory: string): SkillBranchDef {
  return {
    id: `spec_weapon_${stat}`,
    branchType: 'SPECIALIZATION',
    name: `${weaponCategory} Weapon Specialization`,
    tagline: 'Combat stance eliminating defensive penalties and sharpening edge severity.',
    ranks: [
      {
        rank: 1,
        title: 'Rank 1: Fluid Guard Recovery',
        description: 'Attacking with your weapon does not impose disadvantage on your defense rolls this round.'
      },
      {
        rank: 2,
        title: 'Rank 2: Multi-Engagement Mastery',
        description: 'You do not suffer disadvantage when attacking or defending a second time in the same round.'
      },
      {
        rank: 3,
        title: 'Rank 3: Weightless Balance',
        description: 'Reduces equipment loadout reservation cost by 2 points against your Stamina pool.'
      },
      {
        rank: 4,
        title: 'Rank 4: Lethal Edge Alignment',
        description: 'Mastery Strike: Your Graze results on attack rolls automatically count as Minor Injuries.',
        addedEffect: 'Grazes upgraded to Minor Injuries'
      }
    ]
  };
}

export function createArmorSpecializationBranch(stat: StatKey, armorCategory: string): SkillBranchDef {
  return {
    id: `spec_armor_${stat}`,
    branchType: 'SPECIALIZATION',
    name: `${armorCategory} Armor Specialization`,
    tagline: 'Protective deflection negating offensive penalties and turning grazes into misses.',
    ranks: [
      {
        rank: 1,
        title: 'Rank 1: Unburdened Reflex',
        description: 'Defending with your armor does not impose disadvantage on your offensive attack rolls this round.'
      },
      {
        rank: 2,
        title: 'Rank 2: Resilient Recoil',
        description: 'You do not suffer disadvantage when defending against a second incoming attack in the same round.'
      },
      {
        rank: 3,
        title: 'Rank 3: Ergonomic Articulation',
        description: 'Reduces armor loadout reservation cost by 2 points against your Stamina pool.'
      },
      {
        rank: 4,
        title: 'Rank 4: Complete Glancing Deflection',
        description: 'Impenetrable Deflection: Enemy Graze results against your defense rolls count as complete Misses.',
        addedEffect: 'Enemy Grazes downgraded to Misses'
      }
    ]
  };
}

// =========================================================================
// 12 OFFENSIVE SKILL TRACKS (WEAPON SPEC + PASSIVE + ACTIVE MANEUVER)
// =========================================================================

export const OFFENSIVE_SKILL_TRACKS: Record<StatKey, SkillTrackDef> = {
  might: {
    stat: 'might',
    trackName: 'Heavy Brawler & Cleaver Track',
    flavor: 'Colossal momentum, crushing bone density, and armor-cracking leverage.',
    specialization: createWeaponSpecializationBranch('might', 'Heavy Bludgeon & Greatsword'),
    passive: {
      id: 'pass_might',
      branchType: 'PASSIVE',
      name: 'Kinetic Heavy Heave',
      tagline: 'Raw physical leverage that steadily scales brute damage and carrying mass.',
      ranks: [
        { rank: 1, title: 'Rank 1: Dense Mass', description: '+1 flat bonus to carrying capacity and contested push checks.' },
        { rank: 2, title: 'Rank 2: Crushing Force', description: '+1 physical damage bonus on all melee strikes using Might weapons.' },
        { rank: 3, title: 'Rank 3: Structural Rupture', description: 'Attacks deal +2 extra structural degradation against wooden and stone obstacles.' },
        { rank: 4, title: 'Rank 4: Colossal Leverage', description: '+2 physical damage bonus; can wield colossal weapons without two-handed penalty.', addedEffect: 'Titan Grip' }
      ]
    },
    active: {
      id: 'act_off_might',
      branchType: 'ACTIVE',
      name: 'Shattering Strike (Armor-Crack Cleave)',
      tagline: 'Overhead crushing blow aimed at shattering shields and brittle bones.',
      ranks: [
        { rank: 1, title: 'Rank 1: Shattering Strike', cost: '3 Stamina', range: 'Melee', aoe: 'Single Target', description: 'Deliver a crushing blow dealing Might damage; ignores 1 point of armor DR.' },
        { rank: 2, title: 'Rank 2: Focused Cleave', cost: '2 Stamina', range: 'Melee', aoe: 'Single Target', description: 'Reduced Stamina cost; ignores 2 points of defender armor DR.' },
        { rank: 3, title: 'Rank 3: Shockwave Cleave', cost: '2 Stamina', range: 'Melee (5 ft)', aoe: 'Adjacent Foes', description: 'Cleaves adjacent enemies in the zone for half damage.' },
        { rank: 4, title: 'Rank 4: Armor-Shattering Impact', cost: '2 Stamina', range: 'Melee (10 ft)', aoe: 'Cone Zone', description: 'Overwhelming shockwave knocks defender Prone and permanently breaks 1 point of their Armor DR.', addedEffect: 'Knocks target Prone & fractures Armor DR' }
      ]
    }
  },

  endurance: {
    stat: 'endurance',
    trackName: 'Phalanx & Trench Vanguard Track',
    flavor: 'Sustained grinding pressure, marching grit, and relentless stamina attrition.',
    specialization: createWeaponSpecializationBranch('endurance', 'Polearm & Spear'),
    passive: {
      id: 'pass_endurance',
      branchType: 'PASSIVE',
      name: 'Relentless March',
      tagline: 'Metabolic reserve preventing muscle burn and combat fatigue.',
      ranks: [
        { rank: 1, title: 'Rank 1: Deep Reserves', description: 'Recover 1 bonus Stamina when taking the Rest action in combat.' },
        { rank: 2, title: 'Rank 2: Marching Grit', description: 'Ignore penalties from environmental exhaustion, forced marches, and dehydration.' },
        { rank: 3, title: 'Rank 3: Second Wind', description: 'When Stamina hits 0, instantly restore 3 Stamina once per combat encounter.' },
        { rank: 4, title: 'Rank 4: Unfaltering Engine', description: 'Double all natural Stamina regeneration rates in and out of combat.', addedEffect: 'Permanent 2x Stamina Regen' }
      ]
    },
    active: {
      id: 'act_off_endurance',
      branchType: 'ACTIVE',
      name: 'Attrition Press (Grinding Advance)',
      tagline: 'Relentless grinding advance that exhausts the defender and pushes them back.',
      ranks: [
        { rank: 1, title: 'Rank 1: Attrition Press', cost: '2 Stamina', range: 'Melee', aoe: 'Single Target', description: 'Advance relentlessly; deals weapon damage and drains 1 target Stamina.' },
        { rank: 2, title: 'Rank 2: Heavy Push', cost: '2 Stamina', range: 'Melee (Reach)', aoe: 'Single Target', description: 'Forces the enemy back 5 feet and drains 2 target Stamina.' },
        { rank: 3, title: 'Rank 3: Line Breaker', cost: '1 Stamina', range: 'Melee (Reach)', aoe: 'Single Target', description: 'Stamina cost reduced to 1; deals bonus damage equal to target missing Stamina.' },
        { rank: 4, title: 'Rank 4: Crushing Siege Advance', cost: '1 Stamina', range: 'Melee (Reach 10 ft)', aoe: '2 Targets in Line', description: 'Drives back both targets; if target has 0 Stamina, inflicts instant Minor Injury.', addedEffect: 'Forces 10 ft retreat & inflicts Minor Injury if target Stamina empty' }
      ]
    }
  },

  finesse: {
    stat: 'finesse',
    trackName: 'Rapier & Anatomical Duelist Track',
    flavor: 'Surgical edge trajectory, weakpoint targeting, and vital artery punctures.',
    specialization: createWeaponSpecializationBranch('finesse', 'Rapier, Dagger & Scalpel'),
    passive: {
      id: 'pass_finesse',
      branchType: 'PASSIVE',
      name: 'Weakpoint Intuition',
      tagline: 'Heightened ocular dexterity to perceive micro-fissures in enemy armor.',
      ranks: [
        { rank: 1, title: 'Rank 1: Edge Alignment', description: '+1 bonus to precision strike checks with Finesse weapons.' },
        { rank: 2, title: 'Rank 2: Arterial Knowledge', description: 'Critical hit threshold lowered by 1 on contested attack rolls.' },
        { rank: 3, title: 'Rank 3: Tendon Severing', description: 'All successful hits reduce target movement speed by 5 feet for 1 round.' },
        { rank: 4, title: 'Rank 4: Master Anatomist', description: 'Attacks ignore defender physical damage reduction from shields and cuirasses.', addedEffect: 'Bypasses non-magical DR' }
      ]
    },
    active: {
      id: 'act_off_finesse',
      branchType: 'ACTIVE',
      name: 'Vitals Stitch (Gap-Seeking Lunge)',
      tagline: 'Lightning-fast surgical thrust threading through armpit or neck joints.',
      ranks: [
        { rank: 1, title: 'Rank 1: Vitals Stitch', cost: '2 Stamina', range: 'Melee', aoe: 'Single Target', description: 'Surgical strike targeting armor gaps; guaranteed at least Minor Injury on hit.' },
        { rank: 2, title: 'Rank 2: Extended Reach', cost: '2 Stamina', range: 'Melee (8 ft)', aoe: 'Single Target', description: 'Lunge distance increased; inflicts 1 Bleed point.' },
        { rank: 3, title: 'Rank 3: Rapid Thrust', cost: '1 Stamina', range: 'Melee (8 ft)', aoe: 'Single Target', description: 'Cost reduced to 1 Stamina; Bleed increases to 2 points per round.' },
        { rank: 4, title: 'Rank 4: Lethal Heart Seeker', cost: '1 Stamina', range: 'Melee (10 ft)', aoe: 'Single Target', description: 'If target is bleeding, this strike bypasses Composure directly into Health pool.', addedEffect: 'Direct Health damage bypassing Composure' }
      ]
    }
  },

  reflex: {
    stat: 'reflex',
    trackName: 'Swashbuckler & Tempest Dervish Track',
    flavor: 'Supersonic synaptic reaction speed, lightning thrusts, and blinding speed.',
    specialization: createWeaponSpecializationBranch('reflex', 'Dual Blades & Shortbow'),
    passive: {
      id: 'pass_reflex',
      branchType: 'PASSIVE',
      name: 'Twitch Velocity',
      tagline: 'Neuro-muscular reflex bypassing conscious deliberation.',
      ranks: [
        { rank: 1, title: 'Rank 1: Quick Draw', description: 'Drawing or stowing weapons costs zero action beats.' },
        { rank: 2, title: 'Rank 2: Initiative Surge', description: '+3 flat bonus to combat initiative order rolls.' },
        { rank: 3, title: 'Rank 3: Sprint Cadence', description: 'Move actions grant +10 feet of additional traversal distance.' },
        { rank: 4, title: 'Rank 4: Lightning Reflexes', description: 'Gain 1 extra reaction beat per combat round.', addedEffect: '+1 Reaction Beat per round' }
      ]
    },
    active: {
      id: 'act_off_reflex',
      branchType: 'ACTIVE',
      name: 'Lightning Lunge (Hair-Trigger Strike)',
      tagline: 'Explosive forward dart delivering an attack before slower enemies can react.',
      ranks: [
        { rank: 1, title: 'Rank 1: Lightning Lunge', cost: '2 Stamina', range: 'Melee (10 ft dash)', aoe: 'Single Target', description: 'Dart forward and strike; resolve attack before opponent move completes.' },
        { rank: 2, title: 'Rank 2: Sweeping Dash', cost: '2 Stamina', range: 'Melee (15 ft dash)', aoe: 'Single Target', description: 'Dash distance increased to 15 feet; leaves no opportunity for counter-attack.' },
        { rank: 3, title: 'Rank 3: Flurry Stride', cost: '1 Stamina', range: 'Melee (20 ft dash)', aoe: '2 Targets in Path', description: 'Cost reduced to 1 Stamina; strikes two separate targets along the dash path.' },
        { rank: 4, title: 'Rank 4: Supersonic Tempest', cost: '1 Stamina', range: 'Melee (25 ft dash)', aoe: 'All Enemies in Path', description: 'Slices through all enemies in path; inflicts Disorient condition on all struck.', addedEffect: 'Multi-target dash with AoE Disorient' }
      ]
    }
  },

  vitality: {
    stat: 'vitality',
    trackName: 'Blood-Knight & Berserker Reaver Track',
    flavor: 'Visceral vigor, blood-surging momentum, and combat ferocity rising with wounds.',
    specialization: createWeaponSpecializationBranch('vitality', 'War Axe & Flail'),
    passive: {
      id: 'pass_vitality',
      branchType: 'PASSIVE',
      name: 'Visceral Resilience',
      tagline: 'Cellular recovery that accelerates when your body is strained.',
      ranks: [
        { rank: 1, title: 'Rank 1: Thick Blood', description: 'Stabilize automatically when suffering bleeding or toxin damage.' },
        { rank: 2, title: 'Rank 2: Wounded Ferocity', description: '+1 attack roll bonus while below 50% maximum Health.' },
        { rank: 3, title: 'Rank 3: Pain Surge', description: '+2 physical damage bonus on all melee strikes while wounded.' },
        { rank: 4, title: 'Rank 4: Undying Bloodline', description: 'When reduced to 0 HP, survive at 1 HP once per day and enter Blood Frenzy.', addedEffect: 'Death Defiance at 1 HP' }
      ]
    },
    active: {
      id: 'act_off_vitality',
      branchType: 'ACTIVE',
      name: 'Crushing Momentum (Unstoppable Charge)',
      tagline: 'Converts forward body weight into a battering ram, ignoring enemy defense.',
      ranks: [
        { rank: 1, title: 'Rank 1: Crushing Momentum', cost: '3 Stamina', range: 'Charge (15 ft)', aoe: 'Single Target', description: 'Charge target; deals weapon damage and barrels through enemy counters.' },
        { rank: 2, title: 'Rank 2: Berserk Impact', cost: '2 Stamina', range: 'Charge (20 ft)', aoe: 'Single Target', description: 'Reduced Stamina cost; knocks target backward 10 feet.' },
        { rank: 3, title: 'Rank 3: Blood Ram', cost: '2 Stamina', range: 'Charge (25 ft)', aoe: 'Target + Zone', description: 'Deals damage to primary target and staggers all adjacent foes.' },
        { rank: 4, title: 'Rank 4: Juggernaut Avalanche', cost: '1 Stamina', range: 'Charge (30 ft)', aoe: 'All in Path', description: 'Tears through enemy lines; shatters enemy shields and pins primary target.', addedEffect: 'Pins target & shatters shields' }
      ]
    }
  },

  fortitude: {
    stat: 'fortitude',
    trackName: 'Bastion & Shield-Breaker Track',
    flavor: 'Bedrock structural mass, heavy shield smashes, and concussive shock.',
    specialization: createWeaponSpecializationBranch('fortitude', 'Tower Shield & Warhammer'),
    passive: {
      id: 'pass_fortitude',
      branchType: 'PASSIVE',
      name: 'Adamantine Bone Matrix',
      tagline: 'Dense skeletal mineralization resisting fracture and concussive shock.',
      ranks: [
        { rank: 1, title: 'Rank 1: Solid Mass', description: 'Gain +2 bonus to physical contested rolls against being pushed or tripped.' },
        { rank: 2, title: 'Rank 2: Concussive Damping', description: 'Reduce all incoming bludgeoning damage by 1 point.' },
        { rank: 3, title: 'Rank 3: Unshakeable Frame', description: 'Immune to forced displacement and knockdown from standard enemies.' },
        { rank: 4, title: 'Rank 4: Living Bedrock', description: 'Gain flat +2 permanent physical Armor DR from sheer dermal bone density.', addedEffect: '+2 Permanent Natural Armor DR' }
      ]
    },
    active: {
      id: 'act_off_fortitude',
      branchType: 'ACTIVE',
      name: 'Bulwark Smash (Shield-Barge Slam)',
      tagline: 'Massive concussive bash using heavy plate or shield mass to flatten opponents.',
      ranks: [
        { rank: 1, title: 'Rank 1: Bulwark Smash', cost: '2 Stamina', range: 'Melee', aoe: 'Single Target', description: 'Heavy concussive bash; knocks target prone on contested Might check.' },
        { rank: 2, title: 'Rank 2: Concussive Daze', cost: '2 Stamina', range: 'Melee', aoe: 'Single Target', description: 'Knocks target prone and inflicts Dazed (loss of 1 action next turn).' },
        { rank: 3, title: 'Rank 3: Wide Arc Barge', cost: '1 Stamina', range: 'Melee (5 ft cone)', aoe: 'Up to 3 Targets', description: 'Stamina cost reduced to 1; smashes up to 3 targets in a frontal arc.' },
        { rank: 4, title: 'Rank 4: Earth-Shaking Quake', cost: '1 Stamina', range: 'Melee (10 ft radius)', aoe: 'All in Radius', description: 'Slams earth, knocking all foes in 10 ft radius prone and dealing bludgeoning trauma.', addedEffect: '10 ft AoE knockdown and concussive trauma' }
      ]
    }
  },

  knowledge: {
    stat: 'knowledge',
    trackName: 'Arcane Scholar & Anatomical Inquisitor Track',
    flavor: 'Calculated tactical manuscript recall, weakpoint deduction, and runic disruption.',
    specialization: createWeaponSpecializationBranch('knowledge', 'Stave, Wand & Runic Blade'),
    passive: {
      id: 'pass_knowledge',
      branchType: 'PASSIVE',
      name: 'Manuscript Analysis',
      tagline: 'Instantaneous mental indexing of historical weaknesses and bestiary vulnerabilities.',
      ranks: [
        { rank: 1, title: 'Rank 1: Beast Lore', description: '+2 to knowledge checks identifying monster vulnerabilities.' },
        { rank: 2, title: 'Rank 2: Armor Flaw Spotting', description: 'First attack each round against a known creature gains +1 to hit.' },
        { rank: 3, title: 'Rank 3: Runic Deciphering', description: 'Attacks deal +2 damage against magical constructs, summoned entities, and wards.' },
        { rank: 4, title: 'Rank 4: Perfect Counter-Strategy', description: 'Targeting a creature you analyzed reveals its exact stat bonuses to your party.', addedEffect: 'Reveals full enemy stat sheet' }
      ]
    },
    active: {
      id: 'act_off_knowledge',
      branchType: 'ACTIVE',
      name: 'Exploit Weakness (Anatomical Analysis)',
      tagline: 'Deconstructs the target structural flaw to bypass their physical defenses.',
      ranks: [
        { rank: 1, title: 'Rank 1: Exploit Weakness', cost: '2 Focus', range: '30 ft', aoe: 'Single Target', description: 'Study foe; your next attack against target completely ignores their armor DR.' },
        { rank: 2, title: 'Rank 2: Transmitted Insight', cost: '2 Focus', range: '45 ft', aoe: 'Target & Ally', description: 'Shares the calculated flaw with 1 ally, giving them advantage on their next strike.' },
        { rank: 3, title: 'Rank 3: Rapid Deduction', cost: '1 Focus', range: '60 ft', aoe: 'Single Target', description: 'Cost reduced to 1 Focus; can be executed as a minor reaction beat.' },
        { rank: 4, title: 'Rank 4: Total Structural Disassembly', cost: '1 Focus', range: '60 ft', aoe: 'All Allies in Zone', description: 'Exposes structural flaw to all allies in zone; all party attacks against target crit on 18+.', addedEffect: 'Zone-wide party crit threshold lowered to 18+' }
      ]
    }
  },

  logic: {
    stat: 'logic',
    trackName: 'Tactician & Geometric Trajectory Track',
    flavor: 'Vector angles, ricochet geometry, and ruthless psychological dismantling.',
    specialization: createWeaponSpecializationBranch('logic', 'Crossbow & Geometric Firearms'),
    passive: {
      id: 'pass_logic',
      branchType: 'PASSIVE',
      name: 'Trajectory Geometry',
      tagline: 'Subconscious mental trigonometry calculating exact ricochet angles.',
      ranks: [
        { rank: 1, title: 'Rank 1: Parallax Correction', description: 'Ranged attacks suffer no penalty against targets in light cover.' },
        { rank: 2, title: 'Rank 2: Ricochet Vectors', description: 'Can bounce projectiles off stone/metal surfaces to strike behind cover.' },
        { rank: 3, title: 'Rank 3: Optimal Rangefinding', description: 'Maximum effective range of all ranged weapons increased by 50%.' },
        { rank: 4, title: 'Rank 4: Geometric Perfection', description: 'Ranged attacks ignore all cover penalties and windy environmental hazards.', addedEffect: 'Ignores full cover and wind' }
      ]
    },
    active: {
      id: 'act_off_logic',
      branchType: 'ACTIVE',
      name: 'Socratic Demolition (Logical Debunk)',
      tagline: 'Ruthlessly dismantles an enemy combat posture, dealing direct Composure trauma.',
      ranks: [
        { rank: 1, title: 'Rank 1: Socratic Demolition', cost: '2 Focus', range: '30 ft', aoe: 'Single Target', description: 'Shatter opponent composure with tactical deconstruction; deals 2 Composure trauma.' },
        { rank: 2, title: 'Rank 2: Flaw Exposure', cost: '2 Focus', range: '45 ft', aoe: 'Single Target', description: 'Deals 3 Composure trauma and causes target to hesitate (-2 to their next roll).' },
        { rank: 3, title: 'Rank 3: Syllogistic Strike', cost: '1 Focus', range: '60 ft', aoe: 'Single Target', description: 'Cost reduced to 1 Focus; if target Composure drops to 0, they surrender or flee.' },
        { rank: 4, title: 'Rank 4: Intellectual Breakdown', cost: '1 Focus', range: '60 ft', aoe: 'Zone (3 Targets)', description: 'Demolishes morale of up to 3 enemies; inflicts Panic condition on all failed checks.', addedEffect: '3-target AoE Panic & severe Composure shatter' }
      ]
    }
  },

  awareness: {
    stat: 'awareness',
    trackName: 'Shadow Scout & Ambush Sniper Track',
    flavor: 'Concealed vantage, atmospheric shadow-reading, and lethal sniper ambushes.',
    specialization: createWeaponSpecializationBranch('awareness', 'Composite Bow & Hunting Rifle'),
    passive: {
      id: 'pass_awareness',
      branchType: 'PASSIVE',
      name: 'Keen Sight & Micro-Tracking',
      tagline: 'Perception trained to notice dust disturbances and thermal ripples.',
      ranks: [
        { rank: 1, title: 'Rank 1: Far Sight', description: 'Double maximum visual spotting distance; spot concealed traps automatically.' },
        { rank: 2, title: 'Rank 2: Low-Light Acuity', description: 'Operate in low light and fog without visual penalties.' },
        { rank: 3, title: 'Rank 3: Stealth Penetration', description: 'Invisible or stealthed creatures within 30 ft are outlined in your sight.' },
        { rank: 4, title: 'Rank 4: True Apex Perception', description: 'Immune to all visual illusions, mirages, and magical blinding effects.', addedEffect: 'True sight through illusions and darkness' }
      ]
    },
    active: {
      id: 'act_off_awareness',
      branchType: 'ACTIVE',
      name: 'Ambush Strike (Shadow Strike)',
      tagline: 'Devastating high-velocity strike launched from stealth or concealed vantage.',
      ranks: [
        { rank: 1, title: 'Rank 1: Ambush Strike', cost: '2 Focus', range: '60 ft', aoe: 'Single Target', description: 'Strike from concealment; gain automatic advantage on attack roll.' },
        { rank: 2, title: 'Rank 2: Vital Sniping', cost: '2 Focus', range: '90 ft', aoe: 'Single Target', description: 'Range extended to 90 ft; upgrades a hit into a Critical Hit automatically from stealth.' },
        { rank: 3, title: 'Rank 3: Ghost Volley', cost: '1 Focus', range: '120 ft', aoe: 'Single Target', description: 'Cost reduced to 1 Focus; executing this strike does not break your stealth.' },
        { rank: 4, title: 'Rank 4: Assassins Apex Mark', cost: '1 Focus', range: '150 ft', aoe: 'Single Target', description: 'Deals double maximum damage; if target survives, they are permanently Marked.', addedEffect: 'Double max damage from stealth & auto-mark' }
      ]
    }
  },

  intuition: {
    stat: 'intuition',
    trackName: 'Mystic Blade-Dancer & Premonition Track',
    flavor: 'Hair-trigger muscle twitches, premonitory reading, and deceptive feints.',
    specialization: createWeaponSpecializationBranch('intuition', 'Scimitar & Curved Saber'),
    passive: {
      id: 'pass_intuition',
      branchType: 'PASSIVE',
      name: 'Sixth Sense Rhythm',
      tagline: 'Somatic muscle empathy anticipating the kinetic intent of foes.',
      ranks: [
        { rank: 1, title: 'Rank 1: Somatic Tell', description: 'Sense enemy hostility 1 combat beat before weapon is drawn.' },
        { rank: 2, title: 'Rank 2: Omen Stride', description: 'Ignore hidden hazards and caltrops while traversing the battlefield.' },
        { rank: 3, title: 'Rank 3: Clash Advantage', description: 'Always roll with advantage during tactical Clash tie-breaker phases.' },
        { rank: 4, title: 'Rank 4: Temporal Ripple Foresight', description: 'Once per encounter, reroll any failed attack or defense roll with triple dice.', addedEffect: 'Triple advantage on 1 reroll per combat' }
      ]
    },
    active: {
      id: 'act_off_intuition',
      branchType: 'ACTIVE',
      name: 'Feinting Ripple (Deceptive Tell)',
      tagline: 'Misdirects enemy weapon guard, creating an inevitable opening.',
      ranks: [
        { rank: 1, title: 'Rank 1: Feinting Ripple', cost: '2 Focus', range: 'Melee', aoe: 'Single Target', description: 'Deceptive feint forcing defender to misjudge strike; target cannot react.' },
        { rank: 2, title: 'Rank 2: Phantom Arc', cost: '2 Focus', range: 'Melee (Reach)', aoe: 'Single Target', description: 'Strikes unexpected flank; target loses their next defensive reaction beat.' },
        { rank: 3, title: 'Rank 3: Mirrored Flow', cost: '1 Focus', range: 'Melee (Reach)', aoe: 'Single Target', description: 'Cost reduced to 1 Focus; bypasses opponent parry modifiers entirely.' },
        { rank: 4, title: 'Rank 4: Fatal Disillusion Strike', cost: '1 Focus', range: 'Melee (Reach 10 ft)', aoe: 'Single Target', description: 'Completely strips defender of all armor and parry modifiers for the full turn.', addedEffect: 'Strips 100% of defender guard/parry for 1 turn' }
      ]
    }
  },

  charm: {
    stat: 'charm',
    trackName: 'Orator & Psychological Commander Track',
    flavor: 'Vocal dominance, commanding shouts, morale manipulation, and disarming presence.',
    specialization: createWeaponSpecializationBranch('charm', 'Baton, Whip & Ceremonial Blade'),
    passive: {
      id: 'pass_charm',
      branchType: 'PASSIVE',
      name: 'Commanding Aura',
      tagline: 'Magnetic gravitational authority compelling deference and hesitation.',
      ranks: [
        { rank: 1, title: 'Rank 1: Noble Posture', description: 'Neutral NPCs treat you with automatic respect; advantage on social opening checks.' },
        { rank: 2, title: 'Rank 2: Morale Radiance', description: 'Adjacent allies gain +1 bonus to Composure defense rolls.' },
        { rank: 3, title: 'Rank 3: Dread Presence', description: 'Foes must succeed on a Willpower check or suffer -1 attack penalty against you.' },
        { rank: 4, title: 'Rank 4: Imperious Sovereignty', description: 'Hostile foes of lower level cannot target you with attacks on round 1.', addedEffect: 'Immunity to enemy attacks on round 1' }
      ]
    },
    active: {
      id: 'act_off_charm',
      branchType: 'ACTIVE',
      name: 'Disarming Oration (Commanding Rebuke)',
      tagline: 'Vocal thunder striking the psyche of opponents and shattering resolve.',
      ranks: [
        { rank: 1, title: 'Rank 1: Disarming Oration', cost: '2 Focus', range: '30 ft voice', aoe: 'Single Target', description: 'Scathing rebuke reduces target attack modifier by 2 for 1 turn.' },
        { rank: 2, title: 'Rank 2: Royal Decree', cost: '2 Focus', range: '45 ft voice', aoe: 'Single Target', description: 'Forces target to drop their weapon or shield on failed Willpower check.' },
        { rank: 3, title: 'Rank 3: Resonant Command', cost: '1 Focus', range: '60 ft voice', aoe: 'Single Target', description: 'Cost reduced to 1 Focus; can command target to flee or drop to knees.' },
        { rank: 4, title: 'Rank 4: Overwhelming Ceasefire', cost: '1 Focus', range: '60 ft voice', aoe: 'All Enemies in Zone', description: 'Commands all hostile entities in zone to halt combat for 1 full round.', addedEffect: 'Zone-wide 1-round enemy combat freeze' }
      ]
    }
  },

  willpower: {
    stat: 'willpower',
    trackName: 'Zealot & Psychic Overlord Track',
    flavor: 'Soul fortress, relentless mental intimidation, and crushing psionic force.',
    specialization: createWeaponSpecializationBranch('willpower', 'Executioner Greatsword & Spire Mace'),
    passive: {
      id: 'pass_willpower',
      branchType: 'PASSIVE',
      name: 'Indomitable Soul Fortification',
      tagline: 'Unbreakable mental adamantine refusing to bend to trauma or pain.',
      ranks: [
        { rank: 1, title: 'Rank 1: Mind Bastion', description: '+2 bonus on checks against magical fear, charm, or psychic compulsion.' },
        { rank: 2, title: 'Rank 2: Pain Transcendence', description: 'Ignore all physical and mental debuffs while Health is below 25%.' },
        { rank: 3, title: 'Rank 3: Iron Sanity', description: 'Immune to madness, cosmic panic, and confusion conditions.' },
        { rank: 4, title: 'Rank 4: Sovereign Will', description: 'Can spend Composure points in place of Stamina points at a 1:1 ratio.', addedEffect: 'Composure substitutes for Stamina at 1:1' }
      ]
    },
    active: {
      id: 'act_off_willpower',
      branchType: 'ACTIVE',
      name: 'Overbearing Aura (Psychological Weight)',
      tagline: 'Crushing telepathic pressure that inflicts mental hesitation and despair.',
      ranks: [
        { rank: 1, title: 'Rank 1: Overbearing Aura', cost: '2 Focus', range: '30 ft aura', aoe: 'Single Target', description: 'Exert psychic weight; inflicts 2 Composure trauma and causes hesitation.' },
        { rank: 2, title: 'Rank 2: Psychic Hammer', cost: '2 Focus', range: '45 ft aura', aoe: 'Single Target', description: 'Deals 4 Composure trauma; stuns target on failed Willpower check.' },
        { rank: 3, title: 'Rank 3: Crushing Mandate', cost: '1 Focus', range: '60 ft aura', aoe: 'Single Target', description: 'Cost reduced to 1 Focus; stuns target and deals direct Health trauma.' },
        { rank: 4, title: 'Rank 4: Soul-Cracking Dominion', cost: '1 Focus', range: '60 ft aura', aoe: 'All Foes in Zone', description: 'Unleashes psychic shockwave; all foes suffer 5 Composure trauma and kneel.', addedEffect: 'Zone-wide psychic trauma & forced kneeling' }
      ]
    }
  }
};

// =========================================================================
// 12 DEFENSIVE SKILL TRACKS (ARMOR SPEC + PASSIVE + ACTIVE REACTION)
// =========================================================================

export const DEFENSIVE_SKILL_TRACKS: Record<StatKey, SkillTrackDef> = {
  might: {
    stat: 'might',
    trackName: 'Immovable Root & Heavy Plate Track',
    flavor: 'Brute mass anchoring footing against incoming shock and heavy kinetic blows.',
    specialization: createArmorSpecializationBranch('might', 'Segmented Heavy Plate'),
    passive: {
      id: 'pass_def_might',
      branchType: 'PASSIVE',
      name: 'Kinetic Anchoring',
      tagline: 'Lowered center of gravity converting incoming blows into grounded earth tremors.',
      ranks: [
        { rank: 1, title: 'Rank 1: Solid Footing', description: 'Cannot be pushed backward more than 5 feet by any physical strike.' },
        { rank: 2, title: 'Rank 2: Heavy Inertia', description: 'Reduce incoming physical knockback and forced displacement by 100%.' },
        { rank: 3, title: 'Rank 3: Impact Grounding', description: 'Gain +1 physical Armor DR when standing still on solid earth or stone.' },
        { rank: 4, title: 'Rank 4: Immovable Mountain', description: 'Completely immune to being tripped, launched, or knocked prone.', addedEffect: 'Immunity to knockdown and launch' }
      ]
    },
    active: {
      id: 'act_def_might',
      branchType: 'ACTIVE',
      name: 'Bracing Wall (Immovable Root)',
      tagline: 'Lock skeletal mass and brawn to absorb heavy kinetic impact, turning strikes into grazes.',
      ranks: [
        { rank: 1, title: 'Rank 1: Bracing Wall', cost: '2 Stamina', range: 'Self', aoe: 'Self', description: 'Reaction: Lock footing to reduce incoming physical strike damage by 50%.' },
        { rank: 2, title: 'Rank 2: Iron Anchor', cost: '2 Stamina', range: 'Self', aoe: 'Self + 1 Ally', description: 'Can brace an adjacent ally, extending the 50% damage reduction to them.' },
        { rank: 3, title: 'Rank 3: Resilient Wall', cost: '1 Stamina', range: 'Self', aoe: 'Self + 1 Ally', description: 'Cost reduced to 1 Stamina; completely negates incoming Graze damage.' },
        { rank: 4, title: 'Rank 4: Colossal Bastion', cost: '1 Stamina', range: 'Self (10 ft aura)', aoe: 'All Adjacent Allies', description: 'Negates all critical damage upgrades in a 10 ft aura and reflects 50% impact to attacker.', addedEffect: 'Negates crits in 10 ft aura & reflects 50% damage' }
      ]
    }
  },

  endurance: {
    stat: 'endurance',
    trackName: 'Trench Shield & Iron Lung Track',
    flavor: 'Unbreakable stamina sponge, wound recovery, and oxygen regulation.',
    specialization: createArmorSpecializationBranch('endurance', 'Reinforced Scale-Mail'),
    passive: {
      id: 'pass_def_endurance',
      branchType: 'PASSIVE',
      name: 'Metabolic Endurance',
      tagline: 'Cellular endurance shrugging off cold, scalding steam, and exhaustion.',
      ranks: [
        { rank: 1, title: 'Rank 1: Cold Adaptation', description: 'Immune to cold and sub-zero weather movement penalties.' },
        { rank: 2, title: 'Rank 2: Toxin Filtration', description: 'Halve all poison and disease damage taken.' },
        { rank: 3, title: 'Rank 3: Second Wind Reserve', description: 'Regenerate 1 Stamina whenever you suffer a physical wound.' },
        { rank: 4, title: 'Rank 4: Perpetual Resilience', description: 'Cannot suffer cardiac failure or suffocation; immune to drowning.', addedEffect: 'Immunity to suffocation and drowning' }
      ]
    },
    active: {
      id: 'act_def_endurance',
      branchType: 'ACTIVE',
      name: 'Iron Lungs (Second Wind Regulation)',
      tagline: 'Emergency oxygenation shrugging off combat exhaustion and restoring vitality.',
      ranks: [
        { rank: 1, title: 'Rank 1: Iron Lungs', cost: '1 Stamina', range: 'Self', aoe: 'Self', description: 'Reaction: Clear all combat exhaustion debuffs and gain +2 defense for the turn.' },
        { rank: 2, title: 'Rank 2: Pulmonary Surge', cost: '1 Stamina', range: 'Self', aoe: 'Self', description: 'Restore 2 Stamina points immediately when hit by an attack.' },
        { rank: 3, title: 'Rank 3: Deep Oxygenation', cost: '1 Stamina', range: 'Self', aoe: 'Self', description: 'Restores 1 Health point in addition to Stamina recovery.' },
        { rank: 4, title: 'Rank 4: Unbreakable Vital Surge', cost: '0 Stamina', range: 'Self', aoe: 'Self', description: 'Free reaction: Instantly restores 4 Stamina and 2 Health; clears all status debuffs.', addedEffect: 'Free reaction restoring 4 Stamina & 2 HP' }
      ]
    }
  },

  finesse: {
    stat: 'finesse',
    trackName: 'Parry & Blade Deflection Track',
    flavor: 'Minimalist blade deflection, redirection of kinetic momentum, and disarming counters.',
    specialization: createArmorSpecializationBranch('finesse', 'Hardened Leather Cuirass'),
    passive: {
      id: 'pass_def_finesse',
      branchType: 'PASSIVE',
      name: 'Edge Deflection Sense',
      tagline: 'Micro-movements tilting armor plates to glance blades away from vital organs.',
      ranks: [
        { rank: 1, title: 'Rank 1: Angled Plates', description: '+1 defense bonus against piercing weapons.' },
        { rank: 2, title: 'Rank 2: Glancing Scute', description: '+1 defense bonus against slashing weapons.' },
        { rank: 3, title: 'Rank 3: Kinetic Slide', description: 'When hit by a melee attack, slide 5 feet away freely without provoking reactions.' },
        { rank: 4, title: 'Rank 4: Untouchable Edge', description: 'Enemy critical hits against you are downgraded to standard Major Injuries.', addedEffect: 'Downgrades incoming Crits to Major Injuries' }
      ]
    },
    active: {
      id: 'act_def_finesse',
      branchType: 'ACTIVE',
      name: 'Parry Riposte (Minimalist Deflection)',
      tagline: 'Deft weapon deflection that turns aside the strike and counter-attacks.',
      ranks: [
        { rank: 1, title: 'Rank 1: Parry Riposte', cost: '1 Stamina', range: 'Melee', aoe: 'Self', description: 'Reaction: Parry incoming melee strike; add Finesse to defense total.' },
        { rank: 2, title: 'Rank 2: Riposte Strike', cost: '1 Stamina', range: 'Melee', aoe: 'Attacker', description: 'If parry succeeds, immediately execute a free basic counter-attack.' },
        { rank: 3, title: 'Rank 3: Disarming Parry', cost: '1 Stamina', range: 'Melee', aoe: 'Attacker', description: 'Successful parry knocks attacker weapon 10 feet away from their hands.' },
        { rank: 4, title: 'Rank 4: Flawless Redirection', cost: '1 Stamina', range: 'Melee (10 ft)', aoe: 'Adjacent Foe', description: 'Redirects the incoming attack completely into another enemy in melee range.', addedEffect: 'Redirects 100% of attack to another foe' }
      ]
    }
  },

  reflex: {
    stat: 'reflex',
    trackName: 'Evasive Scuttle & Flash-Step Track',
    flavor: 'Instantaneous evasion bursts, sliding out of harm vectors, and dodging AoEs.',
    specialization: createArmorSpecializationBranch('reflex', 'Acrobatic Silk & Quilted Gambeson'),
    passive: {
      id: 'pass_def_reflex',
      branchType: 'PASSIVE',
      name: 'Kine-Sense Dodging',
      tagline: 'Subconscious twitch responses evading danger before conscious realization.',
      ranks: [
        { rank: 1, title: 'Rank 1: Duck & Roll', description: 'Take half damage from area of effect explosions and breath attacks on success.' },
        { rank: 2, title: 'Rank 2: Hair-Trigger Shift', description: '+2 bonus to defense rolls against ranged projectile attacks.' },
        { rank: 3, title: 'Rank 3: Evasive Weave', description: 'Moving through enemy zones does not provoke attacks of opportunity.' },
        { rank: 4, title: 'Rank 4: Total Evasion', description: 'Take zero damage (instead of half) when successfully saving against AoE attacks.', addedEffect: 'Zero damage on successful AoE saves' }
      ]
    },
    active: {
      id: 'act_def_reflex',
      branchType: 'ACTIVE',
      name: 'Evasive Scuttle (Flash-Step Dodge)',
      tagline: 'Instantly bursts out of threat vectors and AoE zones.',
      ranks: [
        { rank: 1, title: 'Rank 1: Evasive Scuttle', cost: '1 Stamina', range: 'Self (5 ft shift)', aoe: 'Self', description: 'Reaction: Flash-step 5 feet away; attack misses automatically if outside range.' },
        { rank: 2, title: 'Rank 2: Extended Dodge', cost: '1 Stamina', range: 'Self (10 ft shift)', aoe: 'Self', description: 'Flash-step distance increased to 10 feet; escape grapple or pin automatically.' },
        { rank: 3, title: 'Rank 3: Shadow Slip', cost: '1 Stamina', range: 'Self (15 ft shift)', aoe: 'Self', description: 'Shift 15 feet; leaves a smoke shadow giving attacker disadvantage next round.' },
        { rank: 4, title: 'Rank 4: Vanishing Phantom Step', cost: '0 Stamina', range: 'Self (20 ft shift)', aoe: 'Self', description: 'Free reaction: Shift 20 feet, enter stealth instantly, and negate attack completely.', addedEffect: 'Free 20 ft shift + instant stealth entry' }
      ]
    }
  },

  vitality: {
    stat: 'vitality',
    trackName: 'Somatic Shield & Organ Shift Track',
    flavor: 'Subcutaneous adipose shock absorption, cellular healing, and vital organ shifts.',
    specialization: createArmorSpecializationBranch('vitality', 'Treated Hide & Bone Mail'),
    passive: {
      id: 'pass_def_vitality',
      branchType: 'PASSIVE',
      name: 'Dense Cellular Clotting',
      tagline: 'Hyper-accelerated platelets sealing arteries and preventing blood loss.',
      ranks: [
        { rank: 1, title: 'Rank 1: Rapid Clotting', description: 'Bleed effects expire in half the normal duration.' },
        { rank: 2, title: 'Rank 2: Visceral Insulation', description: 'Subcutaneous fat absorbs 1 point of damage from all incoming melee attacks.' },
        { rank: 3, title: 'Rank 3: Rapid Flesh Regeneration', description: 'Regenerate 1 Health point at the end of every combat encounter.' },
        { rank: 4, title: 'Rank 4: Apex Hyper-Metabolism', description: 'Immune to all poison, disease, necrosis, and bleed conditions permanently.', addedEffect: 'Total immunity to poison, disease & bleed' }
      ]
    },
    active: {
      id: 'act_def_vitality',
      branchType: 'ACTIVE',
      name: 'Somatic Shield (Organ Shift)',
      tagline: 'Absorbs severe trauma into thick non-vital muscle tissue, protecting organs.',
      ranks: [
        { rank: 1, title: 'Rank 1: Somatic Shield', cost: '2 Stamina', range: 'Self', aoe: 'Self', description: 'Reaction: Shift vital organs; downgrade incoming Critical Injury to Major Injury.' },
        { rank: 2, title: 'Rank 2: Tissue Hardening', cost: '2 Stamina', range: 'Self', aoe: 'Self', description: 'Downgrades Major Injuries to Minor Injuries.' },
        { rank: 3, title: 'Rank 3: Cellular Absorption', cost: '1 Stamina', range: 'Self', aoe: 'Self', description: 'Cost reduced to 1 Stamina; converts 50% of incoming damage into temporary HP.' },
        { rank: 4, title: 'Rank 4: Total Organ Armor', cost: '1 Stamina', range: 'Self', aoe: 'Self', description: 'Downgrades any incoming injury by 2 full tiers (Critical ➔ Minor, Major ➔ Graze).', addedEffect: 'Downgrades all incoming injury tiers by 2 levels' }
      ]
    }
  },

  fortitude: {
    stat: 'fortitude',
    trackName: 'Anvil Posture & Adamantine Bastion Track',
    flavor: 'Bedrock stone fortitude, concussive resistance, and critical injury negation.',
    specialization: createArmorSpecializationBranch('fortitude', 'Full Osmium Juggernaut Plate'),
    passive: {
      id: 'pass_def_fortitude',
      branchType: 'PASSIVE',
      name: 'Bedrock Bone Density',
      tagline: 'Extreme skeletal mass that shrugs off bone-crushing concussive shock.',
      ranks: [
        { rank: 1, title: 'Rank 1: Dense Skeletal Frame', description: 'Reduce fall damage and concussive shock by 50%.' },
        { rank: 2, title: 'Rank 2: Granite Tendons', description: 'Immune to crippled limb and broken bone injury conditions.' },
        { rank: 3, title: 'Rank 3: Heavy Deflection', description: 'Gain +1 physical Armor DR against all weapons.' },
        { rank: 4, title: 'Rank 4: Adamantine Titan Form', description: 'Gain flat +3 permanent physical Armor DR; cannot be pierced by ordinary weapons.', addedEffect: '+3 Flat Permanent Armor DR' }
      ]
    },
    active: {
      id: 'act_def_fortitude',
      branchType: 'ACTIVE',
      name: 'Impenetrable Stance (Anvil Posture)',
      tagline: 'Completely negates critical severity upgrades during contested defense rolls.',
      ranks: [
        { rank: 1, title: 'Rank 1: Impenetrable Stance', cost: '1 Stamina', range: 'Self', aoe: 'Self', description: 'Reaction: Lock posture into an anvil; attacker cannot score Critical Hits this turn.' },
        { rank: 2, title: 'Rank 2: Armor Lock', cost: '1 Stamina', range: 'Self', aoe: 'Self', description: 'Grants +2 bonus Armor DR for the remainder of the round.' },
        { rank: 3, title: 'Rank 3: Unyielding Pillar', cost: '1 Stamina', range: 'Self', aoe: 'Self', description: 'Grants +3 bonus Armor DR; immune to all forced displacement.' },
        { rank: 4, title: 'Rank 4: Unbreakable Fortress Wall', cost: '1 Stamina', range: 'Self (10 ft aura)', aoe: 'Self & Adjacent Allies', description: 'You and all adjacent allies gain +4 Armor DR and total immunity to critical injuries.', addedEffect: '+4 Armor DR and Crit Immunity for adjacent party' }
      ]
    }
  },

  knowledge: {
    stat: 'knowledge',
    trackName: 'Predictive Evasion & Spellward Track',
    flavor: 'Runic formula calculation, trajectory deduction, and anti-spell wards.',
    specialization: createArmorSpecializationBranch('knowledge', 'Inscribed Aetheric Robes'),
    passive: {
      id: 'pass_def_knowledge',
      branchType: 'PASSIVE',
      name: 'Aetheric Ward Attunement',
      tagline: 'Internalized knowledge of spell matrices granting innate arcane defense.',
      ranks: [
        { rank: 1, title: 'Rank 1: Arcane Dampener', description: 'Take 2 less damage from incoming magical spells.' },
        { rank: 2, title: 'Rank 2: Counter-Spell Foresight', description: '+2 bonus to defense rolls against spellcasters.' },
        { rank: 3, title: 'Rank 3: Leyline Grounding', description: 'Immune to curse conditions and chaotic backfires.' },
        { rank: 4, title: 'Rank 4: Spell Absorption Matrix', description: 'Whenever you successfully defend against a spell, absorb its Focus cost into your pool.', addedEffect: 'Absorb spell Focus cost into your pool on defense' }
      ]
    },
    active: {
      id: 'act_def_knowledge',
      branchType: 'ACTIVE',
      name: 'Predictive Evasion (Vector Calculation)',
      tagline: 'Computes attack trajectories instantly to step out of harm before impact.',
      ranks: [
        { rank: 1, title: 'Rank 1: Predictive Evasion', cost: '1 Focus', range: 'Self', aoe: 'Self', description: 'Reaction: Calculate vector; add Knowledge to defense total against 1 attack.' },
        { rank: 2, title: 'Rank 2: Multi-Vector Read', cost: '1 Focus', range: 'Self', aoe: 'Self', description: 'Applies Knowledge bonus to all incoming attacks until your next turn.' },
        { rank: 3, title: 'Rank 3: Pre-Emptive Step', cost: '1 Focus', range: 'Self (5 ft shift)', aoe: 'Self', description: 'Step 5 feet away as part of reaction; attack fails automatically if out of range.' },
        { rank: 4, title: 'Rank 4: Master Tactical Negation', cost: '0 Focus', range: 'Self (10 ft shift)', aoe: 'Self & 1 Ally', description: 'Free reaction: Shift yourself and 1 ally 10 feet, causing all incoming attacks to miss.', addedEffect: 'Free reaction shifting self & ally out of attack' }
      ]
    }
  },

  logic: {
    stat: 'logic',
    trackName: 'Fallacy Firewall & Rational Guard Track',
    flavor: 'Cold mathematical reason neutralizing panic, fear, and psychological pressure.',
    specialization: createArmorSpecializationBranch('logic', 'Calculated Segmented Mail'),
    passive: {
      id: 'pass_def_logic',
      branchType: 'PASSIVE',
      name: 'Emotional Detachment',
      tagline: 'Psychological insulation shielding the mind from cognitive bias and terror.',
      ranks: [
        { rank: 1, title: 'Rank 1: Cold Composure', description: '+2 bonus to Composure defense rolls against fear and panic.' },
        { rank: 2, title: 'Rank 2: Rational Shield', description: 'Take 1 less Composure damage from all psychological attacks.' },
        { rank: 3, title: 'Rank 3: Logic Anchor', description: 'Cannot be provoked or taunted into hostile action against your will.' },
        { rank: 4, title: 'Rank 4: Total Mental Firewall', description: 'Immune to all mind control, psionic possession, and illusion manipulation.', addedEffect: 'Complete immunity to mind control and illusions' }
      ]
    },
    active: {
      id: 'act_def_logic',
      branchType: 'ACTIVE',
      name: 'Fallacy Firewall (Rational Rebuttal)',
      tagline: 'Neutralizes incoming social manipulation and psychological pressure.',
      ranks: [
        { rank: 1, title: 'Rank 1: Fallacy Firewall', cost: '1 Focus', range: 'Self', aoe: 'Self', description: 'Reaction: Neutralize incoming social or psychic attack; reduce Composure damage by 50%.' },
        { rank: 2, title: 'Rank 2: Cold Rebuttal', cost: '1 Focus', range: '30 ft', aoe: 'Attacker', description: 'Completely negates Composure damage and deals 2 Composure damage back to attacker.' },
        { rank: 3, title: 'Rank 3: Cognitive Armor', cost: '1 Focus', range: '45 ft', aoe: 'Party in Zone', description: 'Protects entire party in zone from psychic shock and demoralization.' },
        { rank: 4, title: 'Rank 4: Absolute Intellectual Reversal', cost: '0 Focus', range: '60 ft', aoe: 'Attacker', description: 'Free reaction: Reverses psychological attack completely, stunning the attacking caster.', addedEffect: 'Free reaction reversing psychic attack into Stun' }
      ]
    }
  },

  awareness: {
    stat: 'awareness',
    trackName: 'Danger Sense & Pre-emptive Alert Track',
    flavor: 'Sensory acoustic radar, air-shift detection, and zero surprise rounds.',
    specialization: createArmorSpecializationBranch('awareness', 'Scout Camouflage Cloak'),
    passive: {
      id: 'pass_def_awareness',
      branchType: 'PASSIVE',
      name: 'Omni-Directional Alert',
      tagline: 'Passive spatial detection scanning micro-shifts in sound and temperature.',
      ranks: [
        { rank: 1, title: 'Rank 1: Sentry Watch', description: 'Cannot be ambushed or surprised during resting camp phases.' },
        { rank: 2, title: 'Rank 2: Peripheral Vision', description: 'Flanking foes do not gain combat advantage against you.' },
        { rank: 3, title: 'Rank 3: Acoustic Listening', description: 'Pinpoint invisible creatures within 30 feet by sound alone.' },
        { rank: 4, title: 'Rank 4: Omniscient Vigilance', description: 'Never suffer surprise rounds; party always acts first in ambush encounters.', addedEffect: 'Party always acts first in ambush rounds' }
      ]
    },
    active: {
      id: 'act_def_awareness',
      branchType: 'ACTIVE',
      name: 'Danger Sense (Pre-emptive Alert)',
      tagline: 'Shout advance warning, preventing surprise rounds and ambush penalties.',
      ranks: [
        { rank: 1, title: 'Rank 1: Danger Sense', cost: '1 Focus', range: 'Self', aoe: 'Self', description: 'Reaction: Spot incoming stealth strike; negates attacker advantage.' },
        { rank: 2, title: 'Rank 2: Warning Cry', cost: '1 Focus', range: '30 ft voice', aoe: 'Self & 1 Ally', description: 'Alert an ally, giving them +2 defense against an unseen attacker.' },
        { rank: 3, title: 'Rank 3: Zone Alert', cost: '1 Focus', range: '45 ft voice', aoe: 'Entire Party', description: 'Negates surprise attacks against your entire party for the round.' },
        { rank: 4, title: 'Rank 4: Instant Pre-Emptive Retaliation', cost: '0 Focus', range: '60 ft', aoe: 'Attacker', description: 'Free reaction: Reveals stealthed foe and grants party a free attack round against them.', addedEffect: 'Free reaction granting free party volley against ambushers' }
      ]
    }
  },

  intuition: {
    stat: 'intuition',
    trackName: 'Instinctive Duck & Somatic Sway Track',
    flavor: 'Subconscious bodily reflex dodging strikes a split-second before impact.',
    specialization: createArmorSpecializationBranch('intuition', 'Silk Weave Mantle'),
    passive: {
      id: 'pass_def_intuition',
      branchType: 'PASSIVE',
      name: 'Gut Intuition Defense',
      tagline: 'Spinal reflex responding to hostile intent before conscious thought.',
      ranks: [
        { rank: 1, title: 'Rank 1: Premonition Twitch', description: '+1 bonus to defense rolls during opening round of combat.' },
        { rank: 2, title: 'Rank 2: Hazard Foresight', description: 'Take half damage from triggered mechanical and magical traps.' },
        { rank: 3, title: 'Rank 3: Somatic Dodging', description: 'Dodging attacks costs zero movement points.' },
        { rank: 4, title: 'Rank 4: Inevitable Evasion', description: 'Once per combat encounter, force any successful attack against you to be a Miss.', addedEffect: 'Force 1 hit per encounter to become a Miss' }
      ]
    },
    active: {
      id: 'act_def_intuition',
      branchType: 'ACTIVE',
      name: 'Instinctive Duck (Subconscious Sway)',
      tagline: 'Dodges attacks based purely on somatic reading a split-second before impact.',
      ranks: [
        { rank: 1, title: 'Rank 1: Instinctive Duck', cost: '1 Focus', range: 'Self', aoe: 'Self', description: 'Reaction: Duck under incoming strike; add Intuition to defense roll.' },
        { rank: 2, title: 'Rank 2: Fluid Slip', cost: '1 Focus', range: 'Self (5 ft roll)', aoe: 'Self', description: 'Duck and slip 5 feet away; attacker loses balance and suffers -2 next turn.' },
        { rank: 3, title: 'Rank 3: Prophetic Flow', cost: '1 Focus', range: 'Self (10 ft roll)', aoe: 'Self', description: 'Applies Intuition bonus to all defense rolls for the rest of the round.' },
        { rank: 4, title: 'Rank 4: Master Somatic Reflex', cost: '0 Focus', range: 'Self', aoe: 'Self', description: 'Free reaction: Completely negates incoming attack and grants you 1 free action beat.', addedEffect: 'Free reaction negating attack + grants 1 action beat' }
      ]
    }
  },

  charm: {
    stat: 'charm',
    trackName: 'Social Redirection & Attention Siphon Track',
    flavor: 'Diplomatic posture and psychological misdirection redirecting hostile aggression.',
    specialization: createArmorSpecializationBranch('charm', 'Ceremonial Silk & Gilded Mail'),
    passive: {
      id: 'pass_def_charm',
      branchType: 'PASSIVE',
      name: 'Disarming Aura',
      tagline: 'Pheromonal charisma making enemies reluctant to strike first.',
      ranks: [
        { rank: 1, title: 'Rank 1: Diplomatic Grace', description: 'Hostile foes prefer targeting your armed allies over you on round 1.' },
        { rank: 2, title: 'Rank 2: Disarming Glance', description: 'Attacking you forces enemy to pass Charm check or suffer -2 attack penalty.' },
        { rank: 3, title: 'Rank 3: Pacifying Presence', description: 'Clear Demoralized and Panicked conditions from all party members within 15 ft.' },
        { rank: 4, title: 'Rank 4: Sanctuary Aura', description: 'Non-sapient wild beasts will not attack you unless damaged first.', addedEffect: 'Wild beast aggression immunity' }
      ]
    },
    active: {
      id: 'act_def_charm',
      branchType: 'ACTIVE',
      name: 'Social Redirection (Attention Siphon)',
      tagline: 'Redirects hostile intent away from self toward alternate zones or armored allies.',
      ranks: [
        { rank: 1, title: 'Rank 1: Social Redirection', cost: '1 Focus', range: '30 ft voice', aoe: 'Attacker', description: 'Reaction: Misdirect attacker; force them to choose a different valid target.' },
        { rank: 2, title: 'Rank 2: Armored Siphon', cost: '1 Focus', range: '30 ft voice', aoe: 'Attacker & Tank', description: 'Redirects attack cleanly into an armored ally who has their guard up.' },
        { rank: 3, title: 'Rank 3: Hesitation Command', cost: '1 Focus', range: '45 ft voice', aoe: 'Attacker', description: 'Attacker cancels attack completely and loses their action beat for the turn.' },
        { rank: 4, title: 'Rank 4: Complete Pacification Mandate', cost: '0 Focus', range: '60 ft voice', aoe: 'Attacker', description: 'Free reaction: Attacker drops weapons and refuses to fight for 2 combat rounds.', addedEffect: 'Free reaction forcing attacker pacification for 2 rounds' }
      ]
    }
  },

  willpower: {
    stat: 'willpower',
    trackName: 'Mental Fortitude & Mind Bastion Track',
    flavor: 'Soul fortress absorbing psychic rupture, trauma, and sanity attacks.',
    specialization: createArmorSpecializationBranch('willpower', 'Indomitable Warded Plate'),
    passive: {
      id: 'pass_def_willpower',
      branchType: 'PASSIVE',
      name: 'Unyielding Sanity',
      tagline: 'Adamantine willpower holding the ego intact against cosmic delirium.',
      ranks: [
        { rank: 1, title: 'Rank 1: Soul Anchor', description: '+2 bonus to Composure defense rolls against mind-breaking horrors.' },
        { rank: 2, title: 'Rank 2: Death Defiance', description: 'Advantage on death saving throws when reduced to 0 HP.' },
        { rank: 3, title: 'Rank 3: Trauma Immunity', description: 'Immune to Despair, Dread, and Demoralized conditions permanently.' },
        { rank: 4, title: 'Rank 4: Invulnerable Ego', description: 'Composure pool cannot be reduced below 1 by any spell or psychic attack.', addedEffect: 'Composure pool cannot drop below 1' }
      ]
    },
    active: {
      id: 'act_def_willpower',
      branchType: 'ACTIVE',
      name: 'Mental Fortitude (Mind Bastion)',
      tagline: 'Absorbs Composure damage and resists panic conditions through sheer decree.',
      ranks: [
        { rank: 1, title: 'Rank 1: Mental Fortitude', cost: '1 Focus', range: 'Self', aoe: 'Self', description: 'Reaction: Fortify mind; reduce incoming psychic/Composure damage by 50%.' },
        { rank: 2, title: 'Rank 2: Soul Wall', cost: '1 Focus', range: 'Self', aoe: 'Self', description: 'Negate 100% of incoming Composure damage from 1 attack.' },
        { rank: 3, title: 'Rank 3: Shared Bastion', cost: '1 Focus', range: '30 ft', aoe: 'Self & Adjacent Allies', description: 'Extend 100% Composure protection to all adjacent allies in zone.' },
        { rank: 4, title: 'Rank 4: Psychic Nova Barrier', cost: '0 Focus', range: 'Self (20 ft aura)', aoe: 'All Enemies in Aura', description: 'Free reaction: Negates attack and reflects 100% of damage back into attacker psyche.', addedEffect: 'Free reaction reflecting 100% psychic damage back to foe' }
      ]
    }
  }
};

// =========================================================================
// 12 REALITY CONSTANTS: POWERS VS NULL ABILITIES (EACH WITH 3 BRANCHES X 4 RANKS)
// =========================================================================

export const REALITY_POWER_TREES: Record<StatKey, PowerNullTreeDef> = {
  might: {
    stat: 'might',
    constantName: 'Mass (Gravity)',
    mode: 'POWER',
    treeName: 'Graviton Power Tree',
    philosophicalCore: 'Channeling raw gravitational density into crushing waves, kinetic collapse, and orbital pull.',
    offense: {
      id: 'pow_off_mass',
      branchRole: 'OFFENSE',
      name: 'Gravitational Crush',
      tagline: 'Compresses air and matter around the target into an inescapable gravitational anvil.',
      ranks: [
        { rank: 1, title: 'Rank 1: Gravity Pulse', cost: '3 Focus', range: '30 ft', aoe: 'Single Target', description: 'Compress local gravity; deals 1d8 gravitational force trauma.' },
        { rank: 2, title: 'Rank 2: Graviton Well', cost: '4 Focus', range: '45 ft', aoe: '10 ft radius', description: 'Deals 2d8 damage in 10 ft radius; pulls enemies 5 feet toward center.' },
        { rank: 3, title: 'Rank 3: Event Horizon', cost: '5 Focus', range: '60 ft', aoe: '15 ft radius', description: 'Deals 3d8 damage; pins all enemies in well to the floor for 1 turn.' },
        { rank: 4, title: 'Rank 4: Singular Collapse', cost: '6 Focus', range: '90 ft', aoe: '20 ft radius', description: 'Deals 4d10 crushing trauma; shatters armor DR and crushes structural barriers.', addedEffect: 'Zone collapse shattering 2 Armor DR and crushing stone' }
      ]
    },
    defense: {
      id: 'pow_def_mass',
      branchRole: 'DEFENSE',
      name: 'Graviton Repulsor Field',
      tagline: 'Projects high-gravity repulsor density that deflects projectiles and charges.',
      ranks: [
        { rank: 1, title: 'Rank 1: Repulsor Barrier', cost: '2 Focus', range: 'Self', aoe: 'Self', description: 'Reaction: Gravitational sheath adds +2 Armor DR against physical attacks.' },
        { rank: 2, title: 'Rank 2: Projectile Collapse', cost: '3 Focus', range: 'Self (10 ft aura)', aoe: 'Aura', description: 'Incoming non-magical projectiles are crushed to the floor, dealing 0 damage.' },
        { rank: 3, title: 'Rank 3: Kinetic Rebound', cost: '4 Focus', range: 'Self', aoe: 'Attacker', description: 'Reflects 50% of incoming melee strike kinetic damage back to attacker.' },
        { rank: 4, title: 'Rank 4: Gravitational Singularity Ward', cost: '4 Focus', range: 'Self (15 ft aura)', aoe: 'All Allies in Aura', description: 'Projects impenetrable gravity well protecting all allies from ranged and melee strikes.', addedEffect: '15 ft aura granting full immunity to ranged weapons' }
      ]
    },
    utility: {
      id: 'pow_util_mass',
      branchRole: 'UTILITY',
      name: 'Mass Manipulation (Alter Density)',
      tagline: 'Lightens or multiplies the physical mass of objects, allies, or heavy equipment.',
      ranks: [
        { rank: 1, title: 'Rank 1: Feather Mass', cost: '2 Focus', range: 'Touch', aoe: '1 Object/Ally', description: 'Reduces object or ally weight by 90% for 1 hour; grants feather fall.' },
        { rank: 2, title: 'Rank 2: Anchor Field', cost: '3 Focus', range: '30 ft', aoe: '1 Target', description: 'Multiplies target mass ten-fold; reduces movement speed to 5 feet.' },
        { rank: 3, title: 'Rank 3: Weightless Arsenal', cost: '2 Focus', range: 'Party', aoe: 'Party Loadout', description: 'Reduces party equipment loadout reservation cost by 50% for 24 hours.' },
        { rank: 4, title: 'Rank 4: Anti-Gravity Levitation', cost: '4 Focus', range: '60 ft', aoe: 'Party or Colossal Object', description: 'Grants true 3D flight at running speed to party or lifts 50-ton objects into air.', addedEffect: 'Party-wide 3D flight and colossal object levitation' }
      ]
    }
  },

  endurance: {
    stat: 'endurance',
    constantName: 'Flux (Entropy & Decay)',
    mode: 'POWER',
    treeName: 'Cryo-Stasis & Flux Power Tree',
    philosophicalCore: 'Manipulating thermodynamic entropy to halt decay, freeze motion, and preserve energy.',
    offense: {
      id: 'pow_off_flux',
      branchRole: 'OFFENSE',
      name: 'Cryogenic Flash Freeze',
      tagline: 'Siphons heat out of the target zone, creating brittle ice fractures.',
      ranks: [
        { rank: 1, title: 'Rank 1: Frost Beam', cost: '3 Focus', range: '30 ft', aoe: 'Single Target', description: 'Deals 1d8 cold damage and slows target movement by 10 feet.' },
        { rank: 2, title: 'Rank 2: Glacial Spikes', cost: '4 Focus', range: '45 ft', aoe: '10 ft radius', description: 'Deals 2d8 cold damage in 10 ft radius and creates difficult frozen terrain.' },
        { rank: 3, title: 'Rank 3: Absolute Frost Burst', cost: '5 Focus', range: '60 ft', aoe: '15 ft radius', description: 'Deals 3d8 cold damage; freezes targets solid on failed Endurance check.' },
        { rank: 4, title: 'Rank 4: Zero Kelvin Shatter', cost: '6 Focus', range: '90 ft', aoe: '20 ft cone', description: 'Deals 4d10 cold trauma; frozen enemies shatter on subsequent physical hits.', addedEffect: 'Freezes zone solid; targets shatter for double damage' }
      ]
    },
    defense: {
      id: 'pow_def_flux',
      branchRole: 'DEFENSE',
      name: 'Stasis Cocoon',
      tagline: 'Halts molecular vibration around the body, rendering it impervious to outside harm.',
      ranks: [
        { rank: 1, title: 'Rank 1: Stasis Glaze', cost: '2 Focus', range: 'Self', aoe: 'Self', description: 'Reaction: Ice barrier absorbs up to 5 points of incoming damage.' },
        { rank: 2, title: 'Rank 2: Cryo-Armor', cost: '3 Focus', range: 'Self', aoe: 'Self', description: 'Grants +3 Armor DR and total immunity to fire and acid for 2 rounds.' },
        { rank: 3, title: 'Rank 3: Total Molecular Freeze', cost: '4 Focus', range: 'Self', aoe: 'Self', description: 'Encase in absolute stasis for 1 round; take 0 damage from all sources.' },
        { rank: 4, title: 'Rank 4: Glacial Citadel Ward', cost: '5 Focus', range: 'Self (15 ft aura)', aoe: 'All Allies in Aura', description: 'Envelops party in protective stasis ward, negating all AoE spell damage for 2 rounds.', addedEffect: '2-round party immunity to AoE magic and elements' }
      ]
    },
    utility: {
      id: 'pow_util_flux',
      branchRole: 'UTILITY',
      name: 'Thermal Preservation & Ice Shaping',
      tagline: 'Freezes bridges across rivers, preserves perishables forever, and quenches flames.',
      ranks: [
        { rank: 1, title: 'Rank 1: Ice Bridge', cost: '2 Focus', range: '30 ft', aoe: 'Path', description: 'Freezes surface water or mud into solid load-bearing ice bridge.' },
        { rank: 2, title: 'Rank 2: Cryo-Preservation', cost: '2 Focus', range: 'Touch', aoe: 'Supplies', description: 'Preserves rations, corpses, or reagents indefinitely with zero decay.' },
        { rank: 3, title: 'Rank 3: Heat Extinguisher', cost: '3 Focus', range: '60 ft', aoe: 'Zone', description: 'Instantly quenches massive forest fires, lava vents, and thermal hazards.' },
        { rank: 4, title: 'Rank 4: Permanent Permafrost', cost: '5 Focus', range: '120 ft', aoe: 'Sector', description: 'Creates permanent permafrost fortress, frozen ramparts, and defensive ice walls.', addedEffect: 'Permanent architectural ice generation' }
      ]
    }
  },

  reflex: {
    stat: 'reflex',
    constantName: 'Motus (Kinetic Velocity)',
    mode: 'POWER',
    treeName: 'Kinetic Acceleration Power Tree',
    philosophicalCore: 'Accelerating molecular velocity and kinetic vectors into hypersonic bursts.',
    offense: {
      id: 'pow_off_motus',
      branchRole: 'OFFENSE',
      name: 'Kinetic Rail Strike',
      tagline: 'Charges projectiles with hypersonic velocity, puncturing straight through walls.',
      ranks: [
        { rank: 1, title: 'Rank 1: Accelerated Shard', cost: '3 Focus', range: '60 ft', aoe: 'Single Target', description: 'Launch projectile at railgun speed dealing 1d10 kinetic piercing damage.' },
        { rank: 2, title: 'Rank 2: Supersonic Penetrator', cost: '4 Focus', range: '90 ft', aoe: 'Line (50 ft)', description: 'Pierces through the target and continues in a 50 ft line, hitting all behind it.' },
        { rank: 3, title: 'Rank 3: Wall-Breaker Slug', cost: '5 Focus', range: '120 ft', aoe: 'Line (80 ft)', description: 'Punches through 3 feet of solid stone or metal cover without losing momentum.' },
        { rank: 4, title: 'Rank 4: Hypersonic Shockwave', cost: '6 Focus', range: '150 ft', aoe: 'Line + 15 ft Cone', description: 'Deals 4d10 piercing trauma and creates sonic boom deafening and blowing back all in path.', addedEffect: 'Deafening sonic boom and multi-wall penetration' }
      ]
    },
    defense: {
      id: 'pow_def_motus',
      branchRole: 'DEFENSE',
      name: 'Kinetic Vector Deflection',
      tagline: 'Repels incoming kinetic vectors by creating opposing high-velocity air walls.',
      ranks: [
        { rank: 1, title: 'Rank 1: Kinetic Puff', cost: '2 Focus', range: 'Self', aoe: 'Self', description: 'Reaction: Diverts projectile trajectory; grants +3 defense against arrows and bullets.' },
        { rank: 2, title: 'Rank 2: Vector Deflection Wall', cost: '3 Focus', range: 'Self (10 ft wall)', aoe: 'Wall', description: 'Erects wind-vector wall deflecting all small arms and arrows for 1 round.' },
        { rank: 3, title: 'Rank 3: Kinetic Inversion', cost: '4 Focus', range: 'Self', aoe: 'Attacker', description: 'Reflects projectile straight back at the shooter using their own roll.' },
        { rank: 4, title: 'Rank 4: Sonic Barrier Citadel', cost: '5 Focus', range: 'Self (20 ft radius)', aoe: 'Party Zone', description: 'Creates hypersonic kinetic barrier deflecting all artillery and spells for 2 rounds.', addedEffect: 'Complete party immunity to ranged artillery & bullets' }
      ]
    },
    utility: {
      id: 'pow_util_motus',
      branchRole: 'UTILITY',
      name: 'Hypersonic Stride & Kinetic Transfer',
      tagline: 'Transfers kinetic velocity into leaps, supersonic sprints, and water-running.',
      ranks: [
        { rank: 1, title: 'Rank 1: Velocity Leap', cost: '2 Focus', range: 'Self', aoe: 'Self', description: 'Leap 40 feet horizontally or 20 feet vertically without running start.' },
        { rank: 2, title: 'Rank 2: Water Sprint', cost: '2 Focus', range: 'Self', aoe: 'Self', description: 'Run across water, quicksand, or thin ceilings at full sprint speed.' },
        { rank: 3, title: 'Rank 3: Hypersonic Burst', cost: '3 Focus', range: 'Self', aoe: 'Self', description: 'Triple movement speed for 2 rounds and gain advantage on all reflex saves.' },
        { rank: 4, title: 'Rank 4: Sub-Orbital Launch', cost: '5 Focus', range: 'Touch', aoe: 'Ally or Vehicle', description: 'Launches self or vehicle across 2 miles of overland terrain in 3 seconds.', addedEffect: 'Overland 2-mile instantaneous kinetic traversal' }
      ]
    }
  },

  finesse: {
    stat: 'finesse',
    constantName: 'Motus Blur (Light & Refraction)',
    mode: 'POWER',
    treeName: 'Mirage & Optical Warp Power Tree',
    philosophicalCore: 'Bending light and micro-currents around limbs to warp strike trajectories into impossible angles.',
    offense: {
      id: 'pow_off_finesse',
      branchRole: 'OFFENSE',
      name: 'Refraction Blade Strike',
      tagline: 'Bends the visual image of the weapon so the defender parries empty air.',
      ranks: [
        { rank: 1, title: 'Rank 1: Refraction Strike', cost: '2 Focus', range: 'Melee', aoe: 'Single Target', description: 'Attack appears 6 inches to the left; defender cannot use parry reaction.' },
        { rank: 2, title: 'Rank 2: Optical Split Strike', cost: '3 Focus', range: 'Melee', aoe: 'Single Target', description: 'Creates 3 phantom blades; roll with advantage and deal +1d6 psychic confusion damage.' },
        { rank: 3, title: 'Rank 3: Prism Flash', cost: '4 Focus', range: 'Melee (15 ft cone)', aoe: 'Cone', description: 'Blinds all targets in cone for 1 round and strikes primary target.' },
        { rank: 4, title: 'Rank 4: Thousand Needle Prism', cost: '5 Focus', range: 'Melee (20 ft)', aoe: 'All Enemies in Range', description: 'Splits blade into dozens of refracted light beams, striking all enemies simultaneously.', addedEffect: 'Multi-target 360-degree refracted blade storm' }
      ]
    },
    defense: {
      id: 'pow_def_finesse',
      branchRole: 'DEFENSE',
      name: 'Mirage Decoy (Optical Cloak)',
      tagline: 'Projects holographic optical mirages while stepping into invisible blind spots.',
      ranks: [
        { rank: 1, title: 'Rank 1: Mirror Decoy', cost: '2 Focus', range: 'Self', aoe: 'Self', description: 'Reaction: Create mirror image; first attack against you hits decoy instead.' },
        { rank: 2, title: 'Rank 2: Triple Mirage', cost: '3 Focus', range: 'Self', aoe: 'Self', description: 'Creates 3 mirror images; attacks have 75% chance of striking duplicates.' },
        { rank: 3, title: 'Rank 3: Invisibility Shift', cost: '3 Focus', range: 'Self', aoe: 'Self', description: 'Disappear into total optical cloaking for 2 rounds; enemies lose target lock.' },
        { rank: 4, title: 'Rank 4: Hall of Mirrors Ward', cost: '5 Focus', range: 'Self (20 ft radius)', aoe: 'Party Zone', description: 'Fills zone with dozens of illusions of your entire party; enemies attack each other.', addedEffect: 'Enemies confuse party for each other and infight' }
      ]
    },
    utility: {
      id: 'pow_util_finesse',
      branchRole: 'UTILITY',
      name: 'Chameleon Cloaking & Light Weaving',
      tagline: 'Bends ambient photon rays to disguise campfires, bypass guards, or forge holograms.',
      ranks: [
        { rank: 1, title: 'Rank 1: Chameleon Camouflage', cost: '2 Focus', range: 'Self', aoe: 'Self', description: 'Skin/gear matches terrain perfectly; +5 bonus to stealth checks while stationary.' },
        { rank: 2, title: 'Rank 2: Silent Light Cloak', cost: '3 Focus', range: 'Touch', aoe: 'Up to 4 Allies', description: 'Cloaks 4 allies in optical bend; light, shadows, and footprints vanish.' },
        { rank: 3, title: 'Rank 3: Runic Hologram Forge', cost: '3 Focus', range: '60 ft', aoe: 'Complex Hologram', description: 'Projects lifelike holographic creature or terrain feature that fools sight and sound.' },
        { rank: 4, title: 'Rank 4: Sector Invisibility Veil', cost: '5 Focus', range: '100 ft radius', aoe: 'Camp/Settlement', description: 'Veils entire camp or military encampment from aerial and overland sight for 24 hours.', addedEffect: '24-hour camp veil immune to visual detection' }
      ]
    }
  },

  vitality: {
    stat: 'vitality',
    constantName: 'Vita (Biotic Life Force)',
    mode: 'POWER',
    treeName: 'Biotic Surge & Regeneration Tree',
    philosophicalCore: 'Channeling the fecund primordial life current to knit flesh, mutate sinew, and cleanse blight.',
    offense: {
      id: 'pow_off_vita',
      branchRole: 'OFFENSE',
      name: 'Biotic Overgrowth & Spore Burst',
      tagline: 'Infuses target with hyper-accelerated bio-mass, causing bursting cellular tumors.',
      ranks: [
        { rank: 1, title: 'Rank 1: Spore Leech', cost: '3 Focus', range: '30 ft', aoe: 'Single Target', description: 'Inflicts parasitic spores dealing 1d6 necrotic/vital damage; heals you for half.' },
        { rank: 2, title: 'Rank 2: Thorny Overgrowth', cost: '4 Focus', range: '45 ft', aoe: '10 ft radius', description: 'Erupts thorny vines dealing 2d6 piercing damage and entangling all foes.' },
        { rank: 3, title: 'Rank 3: Cellular Bloom', cost: '5 Focus', range: '60 ft', aoe: 'Single Target', description: 'Causes target cellular mass to bloat painfully; deals 3d8 damage and blinds target.' },
        { rank: 4, title: 'Rank 4: Fecund Plague Cataclysm', cost: '6 Focus', range: '90 ft', aoe: '20 ft radius', description: 'Explodes into virulent spore cloud dealing 4d10 damage and draining all enemy Stamina.', addedEffect: 'Zone-wide bio-mass explosion & 100% Stamina drain' }
      ]
    },
    defense: {
      id: 'pow_def_vita',
      branchRole: 'DEFENSE',
      name: 'Vita Infusion & Cellular Knit',
      tagline: 'Draws ambient life-force to knit torn flesh and seal bleeding wounds mid-combat.',
      ranks: [
        { rank: 1, title: 'Rank 1: Vita Infusion', cost: '2 Focus', range: 'Touch', aoe: 'Self or Ally', description: 'Reaction or Action: Restore 3 Health points and seal bleeding wounds.' },
        { rank: 2, title: 'Rank 2: Cellular Surge', cost: '3 Focus', range: '30 ft', aoe: '1 Target', description: 'Restores 6 Health points and cures active poison or disease conditions.' },
        { rank: 3, title: 'Rank 3: Transfusive Shield', cost: '4 Focus', range: '30 ft', aoe: '1 Target', description: 'Restores 10 Health points and grants 5 temporary hit points for 3 rounds.' },
        { rank: 4, title: 'Rank 4: Phoenix Cellular Resurgence', cost: '6 Focus', range: '30 ft', aoe: '1 Target', description: 'Revives fallen ally from 0 HP with 50% max Health, clearing all trauma tiers.', addedEffect: 'Mid-combat resurrection with 50% HP' }
      ]
    },
    utility: {
      id: 'pow_util_vita',
      branchRole: 'UTILITY',
      name: 'Flora/Fauna Growth & Trophic Healing',
      tagline: 'Accelerates agricultural growth, purifies blighted water, and heals ecosystems.',
      ranks: [
        { rank: 1, title: 'Rank 1: Harvest Ripening', cost: '2 Focus', range: 'Touch', aoe: 'Crops/Plants', description: 'Causes crops, herbs, or vines to fully mature in seconds; yields 5 days rations.' },
        { rank: 2, title: 'Rank 2: Blight Purge', cost: '3 Focus', range: '30 ft radius', aoe: 'Water/Soil', description: 'Cleanses tainted soil, radioactive miasma, or diseased water springs completely.' },
        { rank: 3, title: 'Rank 3: Beast Communion', cost: '3 Focus', range: '60 ft', aoe: 'Wild Fauna', description: 'Pacifies and communicates fluently with apex predators and wild beasts.' },
        { rank: 4, title: 'Rank 4: Ecosystem Regeneration', cost: '6 Focus', range: '1 Mile', aoe: 'Sector', description: 'Permanently restores ruined ecological cell health to 100%, blooming verdant forest.', addedEffect: 'Restores regional eco-health to 100%' }
      ]
    }
  },

  fortitude: {
    stat: 'fortitude',
    constantName: 'Nexus (Adamantine & Matter)',
    mode: 'POWER',
    treeName: 'Lithic Bastion & Crystal Forge Tree',
    philosophicalCore: 'Commanding crystal lattices, tectonic density, and unyielding silica bedrock.',
    offense: {
      id: 'pow_off_nexus',
      branchRole: 'OFFENSE',
      name: 'Tectonic Spike & Crystal Shard',
      tagline: 'Erupts adamantine crystal pillars through the ground beneath enemy feet.',
      ranks: [
        { rank: 1, title: 'Rank 1: Earth Spike', cost: '3 Focus', range: '30 ft', aoe: 'Single Target', description: 'Erupt stone spike dealing 1d8 piercing damage and launching target 5 ft up.' },
        { rank: 2, title: 'Rank 2: Crystal Shrapnel', cost: '4 Focus', range: '45 ft', aoe: '10 ft radius', description: 'Shatters crystal pillar dealing 2d8 slashing trauma and creating razor rubble.' },
        { rank: 3, title: 'Rank 3: Fissure Eruption', cost: '5 Focus', range: '60 ft', aoe: 'Line (30 ft)', description: 'Opens ground fissure swallowing enemies; deals 3d8 bludgeoning damage.' },
        { rank: 4, title: 'Rank 4: Tectonic Obliteration', cost: '6 Focus', range: '90 ft', aoe: '25 ft radius', description: 'Violent seismic rupture dealing 4d10 trauma and collapsing enemy fortifications.', addedEffect: 'Seismic collapse destroying enemy structures' }
      ]
    },
    defense: {
      id: 'pow_def_nexus',
      branchRole: 'DEFENSE',
      name: 'Lex Bastion (Crystal Shell)',
      tagline: 'Hardens the physical form into absolute unyielding adamantine crystal law.',
      ranks: [
        { rank: 1, title: 'Rank 1: Silica Dermal Layer', cost: '2 Focus', range: 'Self', aoe: 'Self', description: 'Reaction: Encases skin in silica crystal; grants +2 Armor DR for 2 rounds.' },
        { rank: 2, title: 'Rank 2: Crystal Rampart', cost: '3 Focus', range: '15 ft', aoe: '10 ft Wall', description: 'Raises solid stone/crystal wall with 30 HP to block line of fire and melee charges.' },
        { rank: 3, title: 'Rank 3: Obsidian Aegis', cost: '4 Focus', range: 'Self', aoe: 'Self', description: 'Grants +4 Armor DR; completely immune to fire, lightning, and acid.' },
        { rank: 4, title: 'Rank 4: Adamant Fortress Sphere', cost: '5 Focus', range: 'Self (15 ft dome)', aoe: 'Party Dome', description: 'Forms impenetrable adamantine crystal dome around party absorbing 100 damage.', addedEffect: '100 HP adamantine dome shielding entire party' }
      ]
    },
    utility: {
      id: 'pow_util_nexus',
      branchRole: 'UTILITY',
      name: 'Lithic Shaping & Mineral Transmutation',
      tagline: 'Shapes bedrock tunnels, discovers underground ore veins, and repairs stonework.',
      ranks: [
        { rank: 1, title: 'Rank 1: Stone Meld', cost: '2 Focus', range: 'Touch', aoe: 'Stone Barrier', description: 'Pass through solid stone walls up to 5 feet thick without leaving a hole.' },
        { rank: 2, title: 'Rank 2: Mineral Prospecting', cost: '2 Focus', range: 'Self (100 ft)', aoe: 'Radius', description: 'Detects precious metals, Blackstone deposits, and hollow caverns within 100 ft.' },
        { rank: 3, title: 'Rank 3: Rapid Excavation', cost: '3 Focus', range: '30 ft', aoe: '10 ft Cube', description: 'Excavates 10-foot cube of solid bedrock per minute, creating tunnels or trenches.' },
        { rank: 4, title: 'Rank 4: Instant Castle Masons', cost: '6 Focus', range: '60 ft', aoe: 'Building', description: 'Raises fully functional stone keep, watchtower, or reinforced bridge in 5 minutes.', addedEffect: 'Instant stone fortification construction' }
      ]
    }
  },

  knowledge: {
    stat: 'knowledge',
    constantName: 'Anuminus (Arcane & Aether)',
    mode: 'POWER',
    treeName: 'Aetheric Sorcery & Rune Tree',
    philosophicalCore: 'Manipulating raw cosmic mana, celestial runes, and leyline energy.',
    offense: {
      id: 'pow_off_anuminus',
      branchRole: 'OFFENSE',
      name: 'Aetheric Arcane Bolt & Runic Lance',
      tagline: 'Fires pure condensed cosmic mana that bypasses physical armor plates.',
      ranks: [
        { rank: 1, title: 'Rank 1: Arcane Bolt', cost: '3 Focus', range: '45 ft', aoe: 'Single Target', description: 'Fires bolt of raw mana dealing 1d8 force damage; completely ignores physical armor DR.' },
        { rank: 2, title: 'Rank 2: Runic Lance', cost: '4 Focus', range: '60 ft', aoe: 'Single Target', description: 'Deals 2d8 force damage and unravels active enemy magical buffs.' },
        { rank: 3, title: 'Rank 3: Aetheric Barrage', cost: '5 Focus', range: '90 ft', aoe: 'Up to 3 Targets', description: 'Splits into 3 seeking bolts dealing 2d8 force damage each.' },
        { rank: 4, title: 'Rank 4: Celestial Supernova', cost: '6 Focus', range: '120 ft', aoe: '20 ft radius', description: 'Detonates aetheric sphere dealing 4d10 force trauma and silencing enemy casters.', addedEffect: 'Pure force damage bypassing all armor + 2-turn Silence' }
      ]
    },
    defense: {
      id: 'pow_def_anuminus',
      branchRole: 'DEFENSE',
      name: 'Runic Null Ward & Spell Eater',
      tagline: 'Weaves glowing runic sigils that absorb and unravel hostile spells.',
      ranks: [
        { rank: 1, title: 'Rank 1: Mana Shield', cost: '2 Focus', range: 'Self', aoe: 'Self', description: 'Reaction: Absorbs up to 8 points of incoming magical or elemental damage.' },
        { rank: 2, title: 'Rank 2: Counter-Spell Glyph', cost: '3 Focus', range: '60 ft', aoe: 'Enemy Caster', description: 'Counter incoming spell cast by an enemy on a successful contested Knowledge check.' },
        { rank: 3, title: 'Rank 3: Spell Eater Sigil', cost: '4 Focus', range: 'Self', aoe: 'Self', description: 'Absorbs hostile spell and converts its full damage into Focus points for you.' },
        { rank: 4, title: 'Rank 4: Antimagic Prism Dome', cost: '6 Focus', range: 'Self (20 ft aura)', aoe: 'Party Zone', description: 'Projects antimagic sanctuary dome; no hostile spells can penetrate for 3 rounds.', addedEffect: '3-round total immunity to magical spells' }
      ]
    },
    utility: {
      id: 'pow_util_anuminus',
      branchRole: 'UTILITY',
      name: 'Teleportation & Planar Scribing',
      tagline: 'Bends spatial leylines to blink across gaps, open portals, and identify artifacts.',
      ranks: [
        { rank: 1, title: 'Rank 1: Blink Step', cost: '2 Focus', range: '30 ft', aoe: 'Self', description: 'Teleport instantly up to 30 feet to an unoccupied space you can see.' },
        { rank: 2, title: 'Rank 2: Identify Matrix', cost: '2 Focus', range: 'Touch', aoe: 'Magic Item', description: 'Instantly identifies magical properties, curse risks, and charges of any relic.' },
        { rank: 3, title: 'Rank 3: Party Dimension Door', cost: '4 Focus', range: '100 ft', aoe: 'Self + 2 Allies', description: 'Teleports yourself and 2 allies across walls, chasms, and iron portcullises.' },
        { rank: 4, title: 'Rank 4: Leyline Gateway Portal', cost: '6 Focus', range: '50 Miles', aoe: 'Gateway Portal', description: 'Opens permanent two-way spatial rift connecting two burgs or dungeons.', addedEffect: 'Two-way overland 50-mile permanent teleport portal' }
      ]
    }
  },

  logic: {
    stat: 'logic',
    constantName: 'Ratio (Geometry & Probability)',
    mode: 'POWER',
    treeName: 'Ratio Lattice & Probability Tree',
    philosophicalCore: 'Weaving absolute mathematical geometry to control probability vectors and eliminate chaos.',
    offense: {
      id: 'pow_off_ratio',
      branchRole: 'OFFENSE',
      name: 'Probability Snip & Geometric Disruption',
      tagline: 'Manipulates mathematical variables to force critical failures upon the enemy.',
      ranks: [
        { rank: 1, title: 'Rank 1: Ratio Snip', cost: '2 Focus', range: '45 ft', aoe: 'Single Target', description: 'Alters trajectory math; target subtracts 1d4 from their next attack or defense roll.' },
        { rank: 2, title: 'Rank 2: Probability Inversion', cost: '3 Focus', range: '60 ft', aoe: 'Single Target', description: 'Forces enemy natural 20 to become a natural 1 fumble on contested roll.' },
        { rank: 3, title: 'Rank 3: Geometric Paradox', cost: '4 Focus', range: '60 ft', aoe: '10 ft radius', description: 'Deals 3d8 mental trauma; traps enemies in repeating non-Euclidean loop for 1 turn.' },
        { rank: 4, title: 'Rank 4: Deterministic Doom', cost: '6 Focus', range: '90 ft', aoe: 'Single Target', description: 'Calculates inevitable demise; target must roll 3 consecutive natural 20s or suffer instant defeat.', addedEffect: 'Deterministic execution check' }
      ]
    },
    defense: {
      id: 'pow_def_ratio',
      branchRole: 'DEFENSE',
      name: 'Ratio Lattice (Entropy Firewall)',
      tagline: 'Constructs geometric lattice neutralizing chaos radiation and wild magic surges.',
      ranks: [
        { rank: 1, title: 'Rank 1: Geometric Ward', cost: '2 Focus', range: 'Self', aoe: 'Self', description: 'Reaction: Fixes your defense roll to a guaranteed minimum of 12.' },
        { rank: 2, title: 'Rank 2: Chaos Negation', cost: '3 Focus', range: '30 ft aura', aoe: 'Aura', description: 'Completely eliminates all wild magic surges and probability fumbles in zone.' },
        { rank: 3, title: 'Rank 3: Symmetry Shield', cost: '4 Focus', range: 'Self', aoe: 'Self', description: 'Incoming attack damage is perfectly balanced and halved before mitigation.' },
        { rank: 4, title: 'Rank 4: Invariant Reality Matrix', cost: '5 Focus', range: 'Self (20 ft aura)', aoe: 'Party Zone', description: 'All party members roll with maximum possible numbers on all defense checks for 2 turns.', addedEffect: 'Party rolls maximum possible values on defense for 2 turns' }
      ]
    },
    utility: {
      id: 'pow_util_ratio',
      branchRole: 'UTILITY',
      name: 'Statistical Clairvoyance & Geometric Architecture',
      tagline: 'Predicts weather patterns, evaluates economic trade routes, and calculates optimal solutions.',
      ranks: [
        { rank: 1, title: 'Rank 1: Statistical Analysis', cost: '2 Focus', range: 'Self', aoe: 'Situation', description: 'GM reveals the exact numerical success chance of any course of action.' },
        { rank: 2, title: 'Rank 2: Optimal Pathfinding', cost: '2 Focus', range: 'Map', aoe: 'Travel Route', description: 'Calculates overland route with 0% chance of random encounters or ambushes.' },
        { rank: 3, title: 'Rank 3: Market Arbitrage Math', cost: '3 Focus', range: 'Burg Economy', aoe: 'Trading', description: 'Predicts commodity price shifts for the next 10 ticks; guarantees 2x profit.' },
        { rank: 4, title: 'Rank 4: Perfect Predictive Algorithm', cost: '5 Focus', range: 'Global', aoe: 'Cosmic Event', description: 'Accurately predicts cosmological disasters, lunar alignments, and faction moves.', addedEffect: 'Flawless global geopolitical and cosmic forecasting' }
      ]
    }
  },

  awareness: {
    stat: 'awareness',
    constantName: 'Lux (Photon & Illumination)',
    mode: 'POWER',
    treeName: 'Photon Radiance & True Sight Tree',
    philosophicalCore: 'Controlling blinding laser beams, true optical revelation, and banishing darkness.',
    offense: {
      id: 'pow_off_lux',
      branchRole: 'OFFENSE',
      name: 'Radiant Laser Beam & Solar Flare',
      tagline: 'Focuses blinding solar photon streams that incinerate shadow and flesh.',
      ranks: [
        { rank: 1, title: 'Rank 1: Searing Ray', cost: '3 Focus', range: '60 ft', aoe: 'Single Target', description: 'Fires concentrated light ray dealing 1d10 radiant fire damage.' },
        { rank: 2, title: 'Rank 2: Solar Flare', cost: '4 Focus', range: '60 ft', aoe: '15 ft radius', description: 'Deals 2d10 radiant damage and blinds all targets for 2 rounds.' },
        { rank: 3, title: 'Rank 3: Prismatic Lance', cost: '5 Focus', range: '90 ft', aoe: 'Line (60 ft)', description: 'Pierces through shadow creatures dealing double damage (4d10 radiant).' },
        { rank: 4, title: 'Rank 4: Dawn Wrath Cataclysm', cost: '6 Focus', range: '120 ft', aoe: '30 ft radius', description: 'Calls down miniature sun; deals 5d10 radiant damage and disintegrates undead/shadows.', addedEffect: 'Disintegrates undead and dark abominations' }
      ]
    },
    defense: {
      id: 'pow_def_lux',
      branchRole: 'DEFENSE',
      name: 'Photon Flare Ward & Blinding Mirror',
      tagline: 'Emits blinding burst when attacked, ruining enemy strike aim.',
      ranks: [
        { rank: 1, title: 'Rank 1: Blinding Flash', cost: '2 Focus', range: '10 ft', aoe: 'Attacker', description: 'Reaction: Flash of light imposes disadvantage on incoming attack roll.' },
        { rank: 2, title: 'Rank 2: Radiant Halo', cost: '3 Focus', range: 'Self', aoe: 'Self', description: 'Shrouds yourself in glowing halo; enemies suffer -2 to hit you for 3 rounds.' },
        { rank: 3, title: 'Rank 3: Sunburst Ward', cost: '4 Focus', range: 'Self (15 ft aura)', aoe: 'Aura', description: 'Any enemy entering melee range is instantly blinded for 1 round.' },
        { rank: 4, title: 'Rank 4: Aegis of the Morning Star', cost: '5 Focus', range: 'Self (20 ft aura)', aoe: 'Party Zone', description: 'Party is immune to darkness, stealth ambushes, blindness, and fear for 3 rounds.', addedEffect: 'Party immunity to darkness, stealth ambushes & fear' }
      ]
    },
    utility: {
      id: 'pow_util_lux',
      branchRole: 'UTILITY',
      name: 'True Sight & Illumination Sentry',
      tagline: 'Brings daylight into abyssal depths, dispels illusions, and reveals invisible foes.',
      ranks: [
        { rank: 1, title: 'Rank 1: Daylight Orb', cost: '1 Focus', range: '60 ft', aoe: '40 ft radius', description: 'Creates floating orb of true sunlight that lasts 8 hours.' },
        { rank: 2, title: 'Rank 2: Dispel Illusion', cost: '2 Focus', range: '60 ft', aoe: 'Illusion', description: 'Instantly shatters false magical walls, disguised entities, and phantoms.' },
        { rank: 3, title: 'Rank 3: True Sight Beacon', cost: '3 Focus', range: 'Self (60 ft radius)', aoe: 'Aura', description: 'Reveals all invisible creatures, hidden doors, and secret inscriptions in aura.' },
        { rank: 4, title: 'Rank 4: Cosmic Beacon of Truth', cost: '5 Focus', range: '1 Mile', aoe: 'Sector', description: 'Dispels all magical cloaks, darkness, and lies across an entire city sector.', addedEffect: 'Sector-wide dispelling of all illusions and stealth' }
      ]
    }
  },

  intuition: {
    stat: 'intuition',
    constantName: 'Omen (Temporal Streams)',
    mode: 'POWER',
    treeName: 'Temporal River & Echo Power Tree',
    philosophicalCore: 'Diverting timelines, reversing rounds, and glimpsing prophetic future beats.',
    offense: {
      id: 'pow_off_omen',
      branchRole: 'OFFENSE',
      name: 'Temporal Decay & Aging Strike',
      tagline: 'Accelerates local time on the target, turning armor into rust and muscles frail.',
      ranks: [
        { rank: 1, title: 'Rank 1: Wither Touch', cost: '3 Focus', range: 'Melee', aoe: 'Single Target', description: 'Ages target tissue; deals 1d8 temporal decay damage and inflicts Slow.' },
        { rank: 2, title: 'Rank 2: Rust Wave', cost: '4 Focus', range: '30 ft', aoe: '10 ft cone', description: 'Accelerates metallic rust, permanently reducing enemy Armor DR by 1.' },
        { rank: 3, title: 'Rank 3: Timeline Sever', cost: '5 Focus', range: '60 ft', aoe: 'Single Target', description: 'Severs target future; deals 3d8 damage and robs them of their next turn action.' },
        { rank: 4, title: 'Rank 4: Entropic Senescence', cost: '6 Focus', range: '60 ft', aoe: 'Single Target', description: 'Accelerates target age by 50 years; deals 4d10 trauma and halves all physical stats.', addedEffect: 'Halves all target physical stats through rapid aging' }
      ]
    },
    defense: {
      id: 'pow_def_omen',
      branchRole: 'DEFENSE',
      name: 'Temporal Rewind (Chronos Undo)',
      tagline: 'Rewinds your local timeline by a fraction of a second to undo a lethal wound.',
      ranks: [
        { rank: 1, title: 'Rank 1: Micro Rewind', cost: '3 Focus', range: 'Self', aoe: 'Self', description: 'Reaction: Undo up to 5 points of damage just received by resetting local time.' },
        { rank: 2, title: 'Rank 2: Tactical Rewind', cost: '4 Focus', range: 'Self or Ally', aoe: '1 Target', description: 'Undoes up to 10 points of damage received by yourself or an ally this round.' },
        { rank: 3, title: 'Rank 3: Position Snap', cost: '4 Focus', range: 'Self', aoe: 'Self', description: 'Teleport backward in space to where you stood at the beginning of the combat round.' },
        { rank: 4, title: 'Rank 4: Master Chrono Restoration', cost: '6 Focus', range: 'Self or Ally', aoe: '1 Target', description: 'Free reaction: Undoes the entire last enemy attack action as if it never occurred.', addedEffect: 'Completely erases enemy turn action from timeline' }
      ]
    },
    utility: {
      id: 'pow_util_omen',
      branchRole: 'UTILITY',
      name: 'Prophetic Clairvoyance & Haste',
      tagline: 'Glimpses future outcomes to pick winning choices and accelerates team actions.',
      ranks: [
        { rank: 1, title: 'Rank 1: Haste Surge', cost: '2 Focus', range: '30 ft', aoe: 'Self or Ally', description: 'Grants +1 additional action beat on target next turn.' },
        { rank: 2, title: 'Rank 2: Omen Glimpse', cost: '2 Focus', range: 'Self', aoe: 'Self', description: 'See 10 seconds into future; auto-succeed on any navigation or puzzle check.' },
        { rank: 3, title: 'Rank 3: Time Dilated March', cost: '3 Focus', range: 'Party', aoe: 'Party', description: 'Party covers 8 hours of overland travel in 1 hour without fatigue.' },
        { rank: 4, title: 'Rank 4: True Time Stop', cost: '7 Focus', range: 'Global (Local Zone)', aoe: 'All Outside Party', description: 'Freezes time completely for all entities except your party for 2 full combat rounds.', addedEffect: 'Party gets 2 full free rounds while world is frozen' }
      ]
    }
  },

  charm: {
    stat: 'charm',
    constantName: 'Aura (Pheromones & Pleroma)',
    mode: 'POWER',
    treeName: 'Pleroma Euphoria & Pheromone Tree',
    philosophicalCore: 'Manipulating biological pheromone signatures, euphoria waves, and empathic resonance.',
    offense: {
      id: 'pow_off_aura',
      branchRole: 'OFFENSE',
      name: 'Toxic Euphoria & Pheromone Burst',
      tagline: 'Overloads enemy sensory receptors with intoxicating pleasure, causing systemic paralysis.',
      ranks: [
        { rank: 1, title: 'Rank 1: Euphoria Dart', cost: '2 Focus', range: '30 ft', aoe: 'Single Target', description: 'Injects chemical euphoria; deals 1d6 Composure trauma and causes target to drop guard.' },
        { rank: 2, title: 'Rank 2: Pheromone Fog', cost: '3 Focus', range: '45 ft', aoe: '15 ft radius', description: 'Fills zone with scented mist; enemies cannot designate allies as targets.' },
        { rank: 3, title: 'Rank 3: Sensory Overload', cost: '4 Focus', range: '60 ft', aoe: 'Single Target', description: 'Deals 3d8 Composure trauma; target is incapacitated by ecstasy for 1 turn.' },
        { rank: 4, title: 'Rank 4: Thrall Conversion Surge', cost: '6 Focus', range: '60 ft', aoe: 'Single Target', description: 'Overwhelms brain chemistry; target fights for your party for the rest of combat.', addedEffect: 'Permanent combat charm converting foe into ally' }
      ]
    },
    defense: {
      id: 'pow_def_aura',
      branchRole: 'DEFENSE',
      name: 'Pacifying Pleroma Aura',
      tagline: 'Radiates soothing chemical aura that quenches anger and makes foes lower weapons.',
      ranks: [
        { rank: 1, title: 'Rank 1: Calming Wave', cost: '2 Focus', range: '15 ft aura', aoe: 'All Enemies', description: 'Reaction: Quenches enemy fury; reduces all incoming damage by 3 points.' },
        { rank: 2, title: 'Rank 2: Pheromone Shield', cost: '3 Focus', range: 'Self', aoe: 'Self', description: 'Enemies attacking you must pass Willpower check or lose their attack action.' },
        { rank: 3, title: 'Rank 3: Awe-Inspiring Glory', cost: '4 Focus', range: 'Self (20 ft aura)', aoe: 'Aura', description: 'All enemies in 20 ft radius must kneel and cannot take aggressive actions.' },
        { rank: 4, title: 'Rank 4: Permanent Sanctuary of Pleroma', cost: '5 Focus', range: 'Self (30 ft aura)', aoe: 'Party Zone', description: 'No creature can initiate violence in aura; combat halts completely for 3 turns.', addedEffect: 'Zone-wide absolute combat ceasefire for 3 rounds' }
      ]
    },
    utility: {
      id: 'pow_util_aura',
      branchRole: 'UTILITY',
      name: 'Empathic Sway & Pheromone Mask',
      tagline: 'Bypasses beast hostility, compels diplomatic honesty, and unites factions.',
      ranks: [
        { rank: 1, title: 'Rank 1: Pheromone Camouflage', cost: '2 Focus', range: 'Touch', aoe: 'Self', description: 'Masks scent completely; wild animals and bloodhounds cannot track you.' },
        { rank: 2, title: 'Rank 2: Empathic Truth Siphon', cost: '2 Focus', range: '30 ft', aoe: '1 Target', description: 'Reads biological tells; GM reveals if NPC is lying or concealing secrets.' },
        { rank: 3, title: 'Rank 3: Mass Pheromone Sway', cost: '4 Focus', range: '60 ft voice', aoe: 'Crowd/Mob', description: 'Calms an angry rioting mob or hostile burg council into friendly mood.' },
        { rank: 4, title: 'Rank 4: Faction Alliance Binding', cost: '6 Focus', range: 'Burg Council', aoe: 'Faction Leaders', description: 'Compels two warring factions to sign lasting peace treaty with 0% betrayal chance.', addedEffect: 'Forces warring factions into lasting peace treaty' }
      ]
    }
  },

  willpower: {
    stat: 'willpower',
    constantName: 'Lex (Sovereignty & Decrees)',
    mode: 'POWER',
    treeName: 'Nexes Absolute & Sovereign Decree Tree',
    philosophicalCore: 'Bending reality through sheer unyielding decree, mental pressure, and psychic force.',
    offense: {
      id: 'pow_off_nexes',
      branchRole: 'OFFENSE',
      name: 'Psychic Crush & Decree of Severance',
      tagline: 'Enforces mental sovereignty, dealing direct internal trauma that bypasses armor.',
      ranks: [
        { rank: 1, title: 'Rank 1: Mind Lash', cost: '3 Focus', range: '45 ft', aoe: 'Single Target', description: 'Strikes mind directly; deals 1d8 psychic damage bypassing all armor DR.' },
        { rank: 2, title: 'Rank 2: Psionic Rupture', cost: '4 Focus', range: '60 ft', aoe: 'Single Target', description: 'Deals 2d8 psychic damage and stuns target for 1 turn on failed Willpower check.' },
        { rank: 3, title: 'Rank 3: Sovereign Edict', cost: '5 Focus', range: '60 ft', aoe: '15 ft radius', description: 'Deals 3d8 psychic damage to all foes in radius and drops target Composure to 0.' },
        { rank: 4, title: 'Rank 4: Decree of Absolute Annihilation', cost: '7 Focus', range: '90 ft', aoe: 'Single Target', description: 'Crushes target soul; deals 5d10 psychic trauma; target is permanently mentally shattered.', addedEffect: '5d10 armor-ignoring damage & permanent brain shatter' }
      ]
    },
    defense: {
      id: 'pow_def_nexes',
      branchRole: 'DEFENSE',
      name: 'Nexes Absolute (Reality Anchor)',
      tagline: 'Anchors personal reality; decrees that damage and wounds are legally invalid.',
      ranks: [
        { rank: 1, title: 'Rank 1: Decree of Rejection', cost: '2 Focus', range: 'Self', aoe: 'Self', description: 'Reaction: Decrees strike invalid; subtracts 5 points from incoming damage.' },
        { rank: 2, title: 'Rank 2: Sovereign Ward', cost: '3 Focus', range: 'Self', aoe: 'Self', description: 'Completely immune to status conditions and debuffs for 2 rounds.' },
        { rank: 3, title: 'Rank 3: Invulnerable Soul Decree', cost: '4 Focus', range: 'Self', aoe: 'Self', description: 'Cannot drop below 1 HP or 1 Composure for 2 combat rounds.' },
        { rank: 4, title: 'Rank 4: Absolute Reality Nullification', cost: '6 Focus', range: 'Self (15 ft aura)', aoe: 'Party Zone', description: 'Nullifies all damage, conditions, and hostile magic in zone for 1 full combat round.', addedEffect: 'Party takes 0 damage from all sources for 1 round' }
      ]
    },
    utility: {
      id: 'pow_util_nexes',
      branchRole: 'UTILITY',
      name: 'Telekinetic Mastery & Sovereign Command',
      tagline: 'Moves objects with thought, flies through psychic force, and commands deference.',
      ranks: [
        { rank: 1, title: 'Rank 1: Telekinetic Hand', cost: '1 Focus', range: '30 ft', aoe: 'Object', description: 'Manipulate objects up to 50 lbs with mental focus; pick locks from distance.' },
        { rank: 2, title: 'Rank 2: Heavy Telekinesis', cost: '3 Focus', range: '60 ft', aoe: 'Target or Vehicle', description: 'Lift, hurl, or crush objects up to 1,000 lbs across 60 feet.' },
        { rank: 3, title: 'Rank 3: Psychic Flight', cost: '3 Focus', range: 'Self', aoe: 'Self', description: 'Fly through pure mental levitation at running speed for 1 hour.' },
        { rank: 4, title: 'Rank 4: Sovereign Decree of Creation', cost: '6 Focus', range: 'Sight', aoe: 'Environment', description: 'Remakes local terrain by mental decree: create chasms, bridges, or barriers.', addedEffect: 'Mental terraforming creating chasms or bridges' }
      ]
    }
  }
};

// =========================================================================
// 12 NULL ABILITIES (STEPPING OUTSIDE THE RULES OF REALITY THROUGH INERTNESS)
// =========================================================================

export const REALITY_NULL_TREES: Record<StatKey, PowerNullTreeDef> = {
  might: {
    stat: 'might',
    constantName: 'Mass (Gravity)',
    mode: 'NULL',
    treeName: 'Mass Null Exemption Tree',
    philosophicalCore: 'Completely exempt from gravity and kinetic resistance equations; strikes have no drag, bodies have no weight.',
    offense: {
      id: 'null_off_might',
      branchRole: 'OFFENSE',
      name: 'Inertia Strike (Zero-Drag Impact)',
      tagline: 'Strikes with zero resistance friction, multiplying kinetic transfer upon impact.',
      ranks: [
        { rank: 1, title: 'Rank 1: Zero-Drag Punch', cost: '2 Stamina', range: 'Melee', aoe: 'Single Target', description: 'Bypasses air friction; deals +1d6 kinetic damage.' },
        { rank: 2, title: 'Rank 2: Frictionless Thrust', cost: '2 Stamina', range: 'Melee', aoe: 'Single Target', description: 'Ignores defender armor DR completely by transferring momentum directly into organs.' },
        { rank: 3, title: 'Rank 3: Kinetic Vacuum Strike', cost: '3 Stamina', range: 'Melee (10 ft)', aoe: 'Single Target', description: 'Vacuums air behind strike, dealing +2d8 bludgeoning damage and pulling foe.' },
        { rank: 4, title: 'Rank 4: Absolute Inertial Fracture', cost: '4 Stamina', range: 'Melee (15 ft)', aoe: 'Target + Barrier', description: 'Exempts strike from mass equations; obliterates solid gates, shields, and armor.', addedEffect: 'Obliterates non-magical shields and armor completely' }
      ]
    },
    defense: {
      id: 'null_def_might',
      branchRole: 'DEFENSE',
      name: 'Weightless Grounding (Kinetic Dissipation)',
      tagline: 'Body becomes completely inert to kinetic shock, rendering blows feather-light.',
      ranks: [
        { rank: 1, title: 'Rank 1: Mass Inertia', cost: '1 Stamina', range: 'Self', aoe: 'Self', description: 'Reaction: Dissipate impact; reduce bludgeoning damage by 50%.' },
        { rank: 2, title: 'Rank 2: Kinetic Dispersal', cost: '2 Stamina', range: 'Self', aoe: 'Self', description: 'Converts incoming kinetic energy into zero; take zero knockback.' },
        { rank: 3, title: 'Rank 3: Total Impact Neutralizer', cost: '2 Stamina', range: 'Self', aoe: 'Self', description: 'Incoming physical damage reduced by flat 5 points before armor calculation.' },
        { rank: 4, title: 'Rank 4: Gravitational Non-Entity', cost: '3 Stamina', range: 'Self', aoe: 'Self', description: 'Body ignores kinetic physics; attacks pass through or stop with zero trauma.', addedEffect: 'Total immunity to bludgeoning trauma & falling damage' }
      ]
    },
    utility: {
      id: 'null_util_might',
      branchRole: 'UTILITY',
      name: 'Gravity Exemption (Feather Mass)',
      tagline: 'Steps outside gravity; walk on walls, fall from miles high without a scratch.',
      ranks: [
        { rank: 1, title: 'Rank 1: Zero-G Walk', cost: '1 Stamina', range: 'Self', aoe: 'Self', description: 'Walk across vertical walls or ropes as if they were flat ground.' },
        { rank: 2, title: 'Rank 2: Terminal Velocity Exemption', cost: '1 Stamina', range: 'Self', aoe: 'Self', description: 'Fall from any height (even orbit) with zero damage or deceleration shock.' },
        { rank: 3, title: 'Rank 3: Loadout Weight Erasure', cost: '1 Stamina', range: 'Self', aoe: 'Equipped Gear', description: 'Equipped gear loadout reservation cost reduced to 0 Stamina permanently.' },
        { rank: 4, title: 'Rank 4: Complete Spatial Levitation', cost: '2 Stamina', range: 'Self', aoe: 'Self', description: 'Move in any 3D direction without surface contact at sprint speed.', addedEffect: '3D zero-gravity movement with 0 loadout cost' }
      ]
    }
  },

  endurance: {
    stat: 'endurance',
    constantName: 'Flux (Decay & Temperature)',
    mode: 'NULL',
    treeName: 'Thermodynamic Null Exemption Tree',
    philosophicalCore: 'Cells are completely inert to thermodynamic change, chemical breakdown, and rot.',
    offense: {
      id: 'null_off_endurance',
      branchRole: 'OFFENSE',
      name: 'Entropy Nullification Strike',
      tagline: 'Strikes through thermal equilibrium, freezing cellular motion in opponent.',
      ranks: [
        { rank: 1, title: 'Rank 1: Cold Touch', cost: '2 Stamina', range: 'Melee', aoe: 'Single Target', description: 'Stops heat transfer; deals 1d6 cold/null damage and drains 1 target Stamina.' },
        { rank: 2, title: 'Rank 2: Thermal Drain', cost: '2 Stamina', range: 'Melee', aoe: 'Single Target', description: 'Halts cellular metabolism; target suffers -2 to all attack rolls for 2 turns.' },
        { rank: 3, title: 'Rank 3: Absolute Stasis Strike', cost: '3 Stamina', range: 'Melee', aoe: 'Single Target', description: 'Deals 2d8 damage; target cannot take reaction beats for 2 rounds.' },
        { rank: 4, title: 'Rank 4: Permanent Metabolic Lock', cost: '4 Stamina', range: 'Melee', aoe: 'Single Target', description: 'Target metabolic functions freeze; paralyzed until healed by medical care.', addedEffect: 'Indefinite target metabolic paralysis' }
      ]
    },
    defense: {
      id: 'null_def_endurance',
      branchRole: 'DEFENSE',
      name: 'Thermal Equilibrium (Flame & Frost Immunity)',
      tagline: 'Body temperature cannot be altered; immune to burning, freezing, and scalds.',
      ranks: [
        { rank: 1, title: 'Rank 1: Flame/Frost Resist', cost: '1 Stamina', range: 'Self', aoe: 'Self', description: 'Take 50% less damage from fire, magma, and freezing temperatures.' },
        { rank: 2, title: 'Rank 2: Elemental Vacuum', cost: '1 Stamina', range: 'Self', aoe: 'Self', description: 'Completely immune to burning status and frostbite penalties.' },
        { rank: 3, title: 'Rank 3: Total Thermal Inertness', cost: '2 Stamina', range: 'Self', aoe: 'Self', description: 'Take 0 damage from all fire, magma, steam, and freezing attacks.' },
        { rank: 4, title: 'Rank 4: Thermodynamic Null Fortress', cost: '3 Stamina', range: 'Self (15 ft aura)', aoe: 'Party Zone', description: 'Entire party in aura takes zero damage from fire, ice, and environmental extremes.', addedEffect: 'Party immunity to all fire and ice damage' }
      ]
    },
    utility: {
      id: 'null_util_endurance',
      branchRole: 'UTILITY',
      name: 'Biological Non-Decay (Ever-Clean)',
      tagline: 'Tissues and gear step outside rot; food never spoils, wounds never fester.',
      ranks: [
        { rank: 1, title: 'Rank 1: Clean Cells', cost: '0 Stamina', range: 'Self', aoe: 'Self', description: 'Wounds never infect or fester; immune to sepsis and gangrene.' },
        { rank: 2, title: 'Rank 2: Starvation Exemption', cost: '0 Stamina', range: 'Self', aoe: 'Self', description: 'Require no food or water for up to 30 days with zero physical degradation.' },
        { rank: 3, title: 'Rank 3: Gear Preservation', cost: '0 Stamina', range: 'Touch', aoe: 'Supplies', description: 'Carried weapons, armors, and tools never rust, corrode, or degrade.' },
        { rank: 4, title: 'Rank 4: Biological Immortal Stride', cost: '0 Stamina', range: 'Self', aoe: 'Self', description: 'Cells do not age; completely immune to supernatural aging and biological death.', addedEffect: 'Immunity to aging and biological rot' }
      ]
    }
  },

  finesse: {
    stat: 'finesse',
    constantName: 'Velocity (Friction & Drag)',
    mode: 'NULL',
    treeName: 'Friction Null Exemption Tree',
    philosophicalCore: 'Surface friction ceases to exist; slips through grapples, slides across terrain effortlessly.',
    offense: {
      id: 'null_off_finesse',
      branchRole: 'OFFENSE',
      name: 'Frictionless Razor Strike',
      tagline: 'Blades have zero drag; slices through armor like butter with zero resistance.',
      ranks: [
        { rank: 1, title: 'Rank 1: Frictionless Edge', cost: '2 Stamina', range: 'Melee', aoe: 'Single Target', description: 'Blade glides with 0 friction; ignores 2 points of defender armor DR.' },
        { rank: 2, title: 'Rank 2: Micro-Slit Slice', cost: '2 Stamina', range: 'Melee', aoe: 'Single Target', description: 'Cuts so cleanly the target does not feel it; guaranteed Minor Injury on hit.' },
        { rank: 3, title: 'Rank 3: Molecular Parting', cost: '3 Stamina', range: 'Melee', aoe: 'Single Target', description: 'Bypasses 100% of armor DR and halves defender parry value.' },
        { rank: 4, title: 'Rank 4: Absolute Matter Dissever', cost: '4 Stamina', range: 'Melee', aoe: 'Single Target', description: 'Slices clean through enemy weapon or shield, permanently destroying it.', addedEffect: 'Destroys enemy weapon or shield on hit' }
      ]
    },
    defense: {
      id: 'null_def_finesse',
      branchRole: 'DEFENSE',
      name: 'Frictionless Slip (Grapple Immunity)',
      tagline: 'Surface skin and armor have zero friction coefficient; weapons and hands slide off.',
      ranks: [
        { rank: 1, title: 'Rank 1: Slip-Away', cost: '1 Stamina', range: 'Self', aoe: 'Self', description: 'Reaction: Automatically break free from any grapple, net, or pin.' },
        { rank: 2, title: 'Rank 2: Glancing Skin', cost: '1 Stamina', range: 'Self', aoe: 'Self', description: 'Incoming bludgeoning and piercing strikes slide off for 50% less damage.' },
        { rank: 3, title: 'Rank 3: Total Deflection Surface', cost: '2 Stamina', range: 'Self', aoe: 'Self', description: 'All melee attacks against you suffer disadvantage as weapons slide off.' },
        { rank: 4, title: 'Rank 4: Untouchable Frictionless Form', cost: '3 Stamina', range: 'Self', aoe: 'Self', description: 'Immune to grapples, nets, sticky traps, and all non-magical physical strikes for 2 turns.', addedEffect: '2-round total immunity to physical touch/grapple' }
      ]
    },
    utility: {
      id: 'null_util_finesse',
      branchRole: 'UTILITY',
      name: 'Frictionless Surf & Sleight of Physics',
      tagline: 'Surfs across mud, ice, water, and tightropes with zero surface resistance.',
      ranks: [
        { rank: 1, title: 'Rank 1: Ground Surfing', cost: '1 Stamina', range: 'Self', aoe: 'Self', description: 'Slide across flat surfaces at double normal movement speed.' },
        { rank: 2, title: 'Rank 2: Lock-Slide Dexterity', cost: '1 Stamina', range: 'Touch', aoe: 'Mechanism', description: 'Bypasses internal pin friction; picks mechanical locks in 1 second.' },
        { rank: 3, title: 'Rank 3: Soundless Movement', cost: '1 Stamina', range: 'Self', aoe: 'Self', description: 'Zero friction produces zero sound; footstep acoustic noise is 100% eliminated.' },
        { rank: 4, title: 'Rank 4: Hypersonic Frictionless Skim', cost: '2 Stamina', range: 'Self', aoe: 'Self', description: 'Skim across terrain, water, or obstacles at 100 MPH without friction burn.', addedEffect: '100 MPH silent traversal across all terrain' }
      ]
    }
  },

  reflex: {
    stat: 'reflex',
    constantName: 'Time (Temporal Latency)',
    mode: 'NULL',
    treeName: 'Neurological Latency Null Tree',
    philosophicalCore: 'Neurological latency drops to zero; acts outside the delay of nerve impulses and reaction time.',
    offense: {
      id: 'null_off_reflex',
      branchRole: 'OFFENSE',
      name: 'Zero-Latency Strike',
      tagline: 'Muscles fire instantaneously, landing strikes before the opponent can initiate defense.',
      ranks: [
        { rank: 1, title: 'Rank 1: Instant Twitch', cost: '2 Stamina', range: 'Melee', aoe: 'Single Target', description: 'Attack occurs with 0 latency; opponent cannot take defensive reactions.' },
        { rank: 2, title: 'Rank 2: Pre-Emptive Cut', cost: '2 Stamina', range: 'Melee', aoe: 'Single Target', description: 'Strikes before opponent can execute their attack, canceling their turn.' },
        { rank: 3, title: 'Rank 3: Double Impulse', cost: '3 Stamina', range: 'Melee', aoe: 'Single Target', description: 'Delivers two consecutive strikes in a single combat beat with zero penalty.' },
        { rank: 4, title: 'Rank 4: Synaptic Disconnection Strike', cost: '4 Stamina', range: 'Melee', aoe: 'Single Target', description: 'Punches through enemy motor nerves, rendering them unable to take actions for 2 rounds.', addedEffect: '2-round total target action paralysis' }
      ]
    },
    defense: {
      id: 'null_def_reflex',
      branchRole: 'DEFENSE',
      name: 'Zero-Latency Reaction (Reflex Null)',
      tagline: 'Dodges attacks outside conscious reaction time; body moves before eye registers threat.',
      ranks: [
        { rank: 1, title: 'Rank 1: Instant Dodge', cost: '1 Stamina', range: 'Self', aoe: 'Self', description: 'Reaction: Dodge incoming strike; add Reflex to defense total with 0 delay.' },
        { rank: 2, title: 'Rank 2: Sound Barrier Duck', cost: '1 Stamina', range: 'Self', aoe: 'Self', description: 'Dodges supersonic bullets and arrow volleys without disadvantage.' },
        { rank: 3, title: 'Rank 3: Microsecond Phase', cost: '2 Stamina', range: 'Self', aoe: 'Self', description: 'Gain 2 additional reaction beats per combat round.' },
        { rank: 4, title: 'Rank 4: Permanent Synaptic Singularity', cost: '3 Stamina', range: 'Self', aoe: 'Self', description: 'Never caught flat-footed; always react first before any action resolves.', addedEffect: 'Always acts before any enemy action can land' }
      ]
    },
    utility: {
      id: 'null_util_reflex',
      branchRole: 'UTILITY',
      name: 'Reflex Acceleration & Bullet Intercept',
      tagline: 'Catch arrows mid-air, defuse traps while triggering, and react in microseconds.',
      ranks: [
        { rank: 1, title: 'Rank 1: Arrow Catch', cost: '1 Stamina', range: 'Melee', aoe: 'Incoming Arrow', description: 'Catch incoming arrow or thrown dagger out of the air cleanly with one hand.' },
        { rank: 2, title: 'Rank 2: Trap Snip Mid-Trigger', cost: '1 Stamina', range: 'Touch', aoe: 'Trap', description: 'Disarm trap as it triggers; reaction prevents trap from releasing.' },
        { rank: 3, title: 'Rank 3: Rapid Reload & Swap', cost: '0 Stamina', range: 'Self', aoe: 'Weapons', description: 'Reload weapons and swap gear instantly as free non-action movements.' },
        { rank: 4, title: 'Rank 4: Bullet Intercept Stride', cost: '2 Stamina', range: '30 ft', aoe: 'Ally', description: 'Dash 30 ft and catch bullet or blade aimed at an ally, taking 0 damage.', addedEffect: 'Interception of lethal strikes directed at allies' }
      ]
    }
  },

  vitality: {
    stat: 'vitality',
    constantName: 'Shock (Physical Trauma & Pain)',
    mode: 'NULL',
    treeName: 'Biological Shock Null Exemption Tree',
    philosophicalCore: 'Completely exempt from biological shock trauma, pain receptors, and capillary leakage.',
    offense: {
      id: 'null_off_vitality',
      branchRole: 'OFFENSE',
      name: 'Shockless Brutal Advance',
      tagline: 'Marches straight through enemy counter-attacks without flinching or pausing.',
      ranks: [
        { rank: 1, title: 'Rank 1: Unflinching Strike', cost: '2 Stamina', range: 'Melee', aoe: 'Single Target', description: 'Attack cannot be interrupted or parried by counter-attacks.' },
        { rank: 2, title: 'Rank 2: Painless Berserk', cost: '2 Stamina', range: 'Melee', aoe: 'Single Target', description: 'Deal +2 bonus damage for every wound tier you currently suffer.' },
        { rank: 3, title: 'Rank 3: Capillary Lockdown Strike', cost: '3 Stamina', range: 'Melee', aoe: 'Single Target', description: 'Target suffers traumatic capillary collapse, taking 2d8 internal bleeding damage.' },
        { rank: 4, title: 'Rank 4: Undying Linebreaker Assault', cost: '4 Stamina', range: 'Melee (15 ft charge)', aoe: 'All Enemies in Path', description: 'Barrels through all enemy attacks; deals 3d10 damage and shatters frontlines.', addedEffect: 'Immune to all interrupts; multi-target line break' }
      ]
    },
    defense: {
      id: 'null_def_vitality',
      branchRole: 'DEFENSE',
      name: 'Cellular Hardiness (Shock Exemption)',
      tagline: 'Exempts biological tissue from shock trauma, instantly hardening scar matrix.',
      ranks: [
        { rank: 1, title: 'Rank 1: Pain Dissociation', cost: '1 Stamina', range: 'Self', aoe: 'Self', description: 'Reaction: Suffer zero wound penalties to attack, defense, or movement.' },
        { rank: 2, title: 'Rank 2: Capillary Hardening', cost: '1 Stamina', range: 'Self', aoe: 'Self', description: 'Instantly seals broken capillaries; completely immune to Bleed damage.' },
        { rank: 3, title: 'Rank 3: Trauma Immunity', cost: '2 Stamina', range: 'Self', aoe: 'Self', description: 'Cannot be stunned, staggered, or dazed by heavy concussive impacts.' },
        { rank: 4, title: 'Rank 4: Permanent Shock Exemption', cost: '3 Stamina', range: 'Self', aoe: 'Self', description: 'Cannot fall unconscious from pain or trauma; fight at 100% capacity until 0 HP.', addedEffect: 'Total immunity to stun, stagger, pain & unconsciousness' }
      ]
    },
    utility: {
      id: 'null_util_vitality',
      branchRole: 'UTILITY',
      name: 'Rapid Scar Matrix & Sleep Exemption',
      tagline: 'Scar tissue forms in seconds, requires only 1 hour of sleep, and regenerates limbs.',
      ranks: [
        { rank: 1, title: 'Rank 1: 1-Hour Camp Rest', cost: '0 Stamina', range: 'Self', aoe: 'Self', description: 'Full camp rest benefits achieved in just 1 hour of sleep.' },
        { rank: 2, title: 'Rank 2: Instant Scarring', cost: '0 Stamina', range: 'Self', aoe: 'Self', description: 'Lacerations seal into toughened leather-like scars in 10 seconds.' },
        { rank: 3, title: 'Rank 3: Limb Regrowth', cost: '0 Stamina', range: 'Self', aoe: 'Self', description: 'Severed fingers, ears, or eyes regenerate fully over 24 hours.' },
        { rank: 4, title: 'Rank 4: Full Organ & Limb Regeneration', cost: '0 Stamina', range: 'Self', aoe: 'Self', description: 'Severed limbs or destroyed internal organs regenerate completely in 48 hours.', addedEffect: 'Full regeneration of severed limbs and organs' }
      ]
    }
  },

  fortitude: {
    stat: 'fortitude',
    constantName: 'Displacement (Physical Displacement & Knockback)',
    mode: 'NULL',
    treeName: 'Displacement Null Exemption Tree',
    philosophicalCore: 'Completely exempt from physical knockback, displacement physics, and concussive shockwaves.',
    offense: {
      id: 'null_off_fortitude',
      branchRole: 'OFFENSE',
      name: 'Unshakable Frame Strike',
      tagline: 'Hits with the immovable weight of an anchored mountain, transferring 100% shock.',
      ranks: [
        { rank: 1, title: 'Rank 1: Anchored Blow', cost: '2 Stamina', range: 'Melee', aoe: 'Single Target', description: 'Strike cannot be parried or redirected by opponent guard.' },
        { rank: 2, title: 'Rank 2: Concussive Transfer', cost: '2 Stamina', range: 'Melee', aoe: 'Single Target', description: 'Transfers concussive shock through target shield, dealing full damage regardless.' },
        { rank: 3, title: 'Rank 3: Bedrock Sunder', cost: '3 Stamina', range: 'Melee', aoe: 'Single Target', description: 'Shatters target weapon if they attempt to parry this strike.' },
        { rank: 4, title: 'Rank 4: Absolute Mountain Hammer', cost: '4 Stamina', range: 'Melee', aoe: 'Single Target', description: 'Pounds target into earth; inflicts 4d10 trauma and buries them waist-deep.', addedEffect: 'Buries target in bedrock and shatters parrying weapons' }
      ]
    },
    defense: {
      id: 'null_def_fortitude',
      branchRole: 'DEFENSE',
      name: 'Unshakable Frame (Displacement Exemption)',
      tagline: 'Temporarily exempts skeletal structure from knockback and destabilization physics.',
      ranks: [
        { rank: 1, title: 'Rank 1: Zero Displacement', cost: '1 Stamina', range: 'Self', aoe: 'Self', description: 'Reaction: Take zero knockback or forced movement from any source.' },
        { rank: 2, title: 'Rank 2: Seismic Anchor', cost: '1 Stamina', range: 'Self', aoe: 'Self', description: 'Immune to earthquakes, tremors, and terrain collapse.' },
        { rank: 3, title: 'Rank 3: Structural Inertia', cost: '2 Stamina', range: 'Self', aoe: 'Self', description: 'Incoming concussive damage reduced by flat 5 points.' },
        { rank: 4, title: 'Rank 4: Absolute Physical Anchor', cost: '3 Stamina', range: 'Self (15 ft aura)', aoe: 'Party Zone', description: 'You and all allies in 15 ft cannot be pushed, tripped, or moved by outside forces.', addedEffect: 'Party immunity to all forced movement and knockback' }
      ]
    },
    utility: {
      id: 'null_util_fortitude',
      branchRole: 'UTILITY',
      name: 'Structural Load Anchor & Wall Pin',
      tagline: 'Anchor bridges, hold falling cave ceilings, and support 100-ton loads.',
      ranks: [
        { rank: 1, title: 'Rank 1: Structural Pillar', cost: '1 Stamina', range: 'Self', aoe: 'Self', description: 'Hold collapsing ceiling or bridge indefinitely with zero muscle fatigue.' },
        { rank: 2, title: 'Rank 2: Foundation Lock', cost: '1 Stamina', range: 'Touch', aoe: 'Building', description: 'Prevents building or watchtower from collapsing during earthquakes or sieges.' },
        { rank: 3, title: 'Rank 3: Wall Walk Anchor', cost: '2 Stamina', range: 'Self', aoe: 'Self', description: 'Stand completely horizontal on vertical walls without slipping or falling.' },
        { rank: 4, title: 'Rank 4: World Root Anchor', cost: '3 Stamina', range: 'Touch', aoe: 'Mega-Structure', description: 'Anchors an entire damaged dam, fortress wall, or bridge permanently.', addedEffect: 'Permanent stabilization of massive mega-structures' }
      ]
    }
  },

  knowledge: {
    stat: 'knowledge',
    constantName: 'Magic (Occult Radiation & Sorcery)',
    mode: 'NULL',
    treeName: 'Antimagic Null Exemption Tree',
    philosophicalCore: 'Completely inert to occult radiation and supernatural aether; spells simply do not exist to you.',
    offense: {
      id: 'null_off_knowledge',
      branchRole: 'OFFENSE',
      name: 'Spell-Shatter Strike',
      tagline: 'Strikes through magical shields and wards, unraveling active enchantments.',
      ranks: [
        { rank: 1, title: 'Rank 1: Ward Pierce', cost: '2 Focus', range: 'Melee/Ranged', aoe: 'Single Target', description: 'Strike passes straight through magical shields and aetheric armor.' },
        { rank: 2, title: 'Rank 2: Mana Unravel', cost: '3 Focus', range: 'Melee/Ranged', aoe: 'Single Target', description: 'Destroys 1 active spell buff on target and burns 2 points of their Focus.' },
        { rank: 3, title: 'Rank 3: Sorcerous Sever', cost: '4 Focus', range: 'Melee/Ranged', aoe: 'Single Target', description: 'Burns 4 target Focus points; deals extra damage equal to burned Focus.' },
        { rank: 4, title: 'Rank 4: Total Aetheric Severance', cost: '5 Focus', range: 'Melee/Ranged', aoe: 'Single Target', description: 'Permanently severs target from magic for the encounter; all their spells unravel.', addedEffect: 'Encounter-long total silence and dispelling of target' }
      ]
    },
    defense: {
      id: 'null_def_knowledge',
      branchRole: 'DEFENSE',
      name: 'Tactical Encyclopedia (Antimagic Null Shell)',
      tagline: 'Radiates a zone of complete antimagic inertness; spells dissolve upon contact.',
      ranks: [
        { rank: 1, title: 'Rank 1: Magic Disconnect', cost: '1 Focus', range: 'Self', aoe: 'Self', description: 'Reaction: Spells targeting you take -3 penalty to hit or DC.' },
        { rank: 2, title: 'Rank 2: Spell Nullification', cost: '2 Focus', range: 'Self', aoe: 'Self', description: 'Take zero damage from spells of 3rd level equivalent or lower.' },
        { rank: 3, title: 'Rank 3: Antimagic Void Skin', cost: '3 Focus', range: 'Self', aoe: 'Self', description: 'Complete immunity to all hostile spells, curses, hexes, and sorcerous hazards.' },
        { rank: 4, title: 'Rank 4: Permanent Antimagic Sanctuary', cost: '4 Focus', range: 'Self (15 ft aura)', aoe: 'Aura', description: 'Emits continuous 15 ft antimagic field; magic cannot function within your presence.', addedEffect: 'Permanent 15 ft antimagic field shutting down all magic' }
      ]
    },
    utility: {
      id: 'null_util_knowledge',
      branchRole: 'UTILITY',
      name: 'Curse Cleansing & Glyph Disarm',
      tagline: 'Disarms ancient cursed relics with bare hands; curses cannot find purchase.',
      ranks: [
        { rank: 1, title: 'Rank 1: Curse Immunity', cost: '0 Focus', range: 'Self', aoe: 'Self', description: 'Cursed items can be handled, wielded, or discarded without suffering curses.' },
        { rank: 2, title: 'Rank 2: Glyph Dissolution', cost: '1 Focus', range: 'Touch', aoe: 'Runic Trap', description: 'Touches magical rune trap; trap dissolves quietly with zero explosion.' },
        { rank: 3, title: 'Rank 3: Relic Purification', cost: '2 Focus', range: 'Touch', aoe: 'Magic Relic', description: 'Purges malevolent corrupting entities from ancient Blackstone relics.' },
        { rank: 4, title: 'Rank 4: Global Leyline Severance', cost: '4 Focus', range: '100 ft', aoe: 'Rift/Nexus', description: 'Permanently shuts down chaotic aetheric rifts, void portals, and chaos engines.', addedEffect: 'Permanent shutdown of cosmic aether rifts and void gates' }
      ]
    }
  },

  logic: {
    stat: 'logic',
    constantName: 'Emotion (Psychological Bias & Chaos)',
    mode: 'NULL',
    treeName: 'Cold Rationalization Null Tree',
    philosophicalCore: 'Mind is completely exempt from emotional bias, panic, fear, and cognitive distortion.',
    offense: {
      id: 'null_off_logic',
      branchRole: 'OFFENSE',
      name: 'Cold Calculation Strike',
      tagline: 'Executes strikes without hesitation, anger, or telegraphing intent.',
      ranks: [
        { rank: 1, title: 'Rank 1: Flat Strike', cost: '2 Focus', range: 'Melee/Ranged', aoe: 'Single Target', description: 'Target reads zero emotional tells; cannot use dodge reactions.' },
        { rank: 2, title: 'Rank 2: Analytical Flaw Strike', cost: '2 Focus', range: 'Melee/Ranged', aoe: 'Single Target', description: 'Calculates structural flaw; deals guaranteed maximum weapon damage roll.' },
        { rank: 3, title: 'Rank 3: Psychological Sever', cost: '3 Focus', range: 'Melee/Ranged', aoe: 'Single Target', description: 'Deals 3d8 damage; target loses morale and suffers disadvantage on all rolls.' },
        { rank: 4, title: 'Rank 4: Mathematical Execution', cost: '4 Focus', range: 'Melee/Ranged', aoe: 'Single Target', description: 'Hits with absolute precision; instant critical hit dealing maximum damage.', addedEffect: 'Guaranteed critical hit with maximized damage dice' }
      ]
    },
    defense: {
      id: 'null_def_logic',
      branchRole: 'DEFENSE',
      name: 'Cold Rationalization (Emotion Exemption)',
      tagline: 'Exempts the psyche from emotional bias, panic, delirium, and social manipulation.',
      ranks: [
        { rank: 1, title: 'Rank 1: Zero Panic', cost: '0 Focus', range: 'Self', aoe: 'Self', description: 'Immune to all fear, terror, and intimidation checks.' },
        { rank: 2, title: 'Rank 2: Deception Shield', cost: '0 Focus', range: 'Self', aoe: 'Self', description: 'Cannot be deceived or tricked by illusions, disguises, or lies.' },
        { rank: 3, title: 'Rank 3: Total Psychological Inertness', cost: '1 Focus', range: 'Self', aoe: 'Self', description: 'Take 0 Composure damage from all psychological and social attacks.' },
        { rank: 4, title: 'Rank 4: Unbreakable Rational Mind', cost: '2 Focus', range: 'Self', aoe: 'Self', description: 'Immune to all confusion, charm, madness, psionics, and delirium permanently.', addedEffect: 'Total permanent immunity to all mental/psychic debuffs' }
      ]
    },
    utility: {
      id: 'null_util_logic',
      branchRole: 'UTILITY',
      name: 'Flawless Deduction & Lie Detection',
      tagline: 'Perceives absolute objective reality without personal bias or emotional distortion.',
      ranks: [
        { rank: 1, title: 'Rank 1: Objective Eye', cost: '0 Focus', range: 'Self', aoe: 'Investigation', description: 'Spot all physical clues, footprints, and evidence at crime scenes instantly.' },
        { rank: 2, title: 'Rank 2: Lie Exemption', cost: '0 Focus', range: 'Conversation', aoe: 'Interlocutor', description: 'Know with 100% certainty whenever someone utters a factual untruth.' },
        { rank: 3, title: 'Rank 3: Cipher Mastery', cost: '1 Focus', range: 'Manuscript', aoe: 'Code', description: 'Deciphers complex military ciphers, encrypted manuscripts, and dead tongues.' },
        { rank: 4, title: 'Rank 4: Perfect Deductive Synthesis', cost: '2 Focus', range: 'Mind', aoe: 'Case/Mystery', description: 'GM reveals the exact identity, motive, and location of the hidden antagonist.', addedEffect: 'Instant GM revelation of antagonist identity and motives' }
      ]
    }
  },

  awareness: {
    stat: 'awareness',
    constantName: 'Sensory Limits (Blind Spots & Shadows)',
    mode: 'NULL',
    treeName: 'Hyper-Vigilance Null Tree',
    philosophicalCore: 'Sensory processing limits cease to exist; scans micro-environmental air shifts and shadows instantly.',
    offense: {
      id: 'null_off_awareness',
      branchRole: 'OFFENSE',
      name: 'Blind Spot Exploitation',
      tagline: 'Strikes through the absolute physical blind spot of the target.',
      ranks: [
        { rank: 1, title: 'Rank 1: Blind Spot Cut', cost: '2 Focus', range: 'Melee/Ranged', aoe: 'Single Target', description: 'Strikes target from their optic blind spot; target cannot defend.' },
        { rank: 2, title: 'Rank 2: Shadow Penetration', cost: '2 Focus', range: '60 ft', aoe: 'Single Target', description: 'Shoots through smoke, mist, and darkness with zero accuracy penalty.' },
        { rank: 3, title: 'Rank 3: Predictive Ambush', cost: '3 Focus', range: '90 ft', aoe: 'Single Target', description: 'Strikes target before they enter cover; deals +2d8 piercing damage.' },
        { rank: 4, title: 'Rank 4: Lethal Omnipresent Sniper', cost: '4 Focus', range: '150 ft', aoe: 'Single Target', description: 'Deals 4d10 damage; ignores 100% of armor DR, obstacles, and cover.', addedEffect: 'Ignores all cover, armor DR and obstacles up to 150 ft' }
      ]
    },
    defense: {
      id: 'null_def_awareness',
      branchRole: 'DEFENSE',
      name: 'Hyper-Vigilance (Zero Blind Spots)',
      tagline: 'Perception exists in a 360-degree sphere with zero sensory latency.',
      ranks: [
        { rank: 1, title: 'Rank 1: 360-Degree Vision', cost: '0 Focus', range: 'Self', aoe: 'Self', description: 'Cannot be flanked or caught from behind; treat all angles as front.' },
        { rank: 2, title: 'Rank 2: Trajectory Snapping', cost: '1 Focus', range: 'Self', aoe: 'Self', description: 'Reaction: Duck under unseen sniper shots with automatic advantage.' },
        { rank: 3, title: 'Rank 3: Total Spatial Shield', cost: '2 Focus', range: 'Self', aoe: 'Self', description: 'Stealth attacks and invisible attackers gain zero bonus against you.' },
        { rank: 4, title: 'Rank 4: Absolute Sentry State', cost: '2 Focus', range: 'Self (30 ft aura)', aoe: 'Party Zone', description: 'No hidden, stealthed, or invisible entity can approach within 30 ft unnoticed.', addedEffect: '30 ft total exclusion zone against stealth and invisibility' }
      ]
    },
    utility: {
      id: 'null_util_awareness',
      branchRole: 'UTILITY',
      name: 'Infrared & Barometric Perception',
      tagline: 'Perceives thermal heat signatures, atmospheric pressure drops, and underground tremors.',
      ranks: [
        { rank: 1, title: 'Rank 1: Thermal Sight', cost: '0 Focus', range: 'Self (60 ft)', aoe: 'Vision', description: 'Perceive infra-red body heat through smoke, darkness, and light walls.' },
        { rank: 2, title: 'Rank 2: Seismic Tracking', cost: '1 Focus', range: 'Self (120 ft)', aoe: 'Radius', description: 'Feel footsteps and underground movements through bedrock up to 120 ft away.' },
        { rank: 3, title: 'Rank 3: Micro-Barometric Sense', cost: '1 Focus', range: '1 Mile', aoe: 'Weather', description: 'Predicts approaching rainstorms, ash clouds, or temperature drops 12 hours early.' },
        { rank: 4, title: 'Rank 4: Planetary Telemetry Sentry', cost: '2 Focus', range: '10 Miles', aoe: 'Regional Cell', description: 'Detects approaching military armies, cartel caravans, or dragons miles away.', addedEffect: '10-mile advance warning of approaching armies and monsters' }
      ]
    }
  },

  intuition: {
    stat: 'intuition',
    constantName: 'Fate (Prophecy & Omens)',
    mode: 'NULL',
    treeName: 'Fate Null Exemption Tree',
    philosophicalCore: 'Completely exempt from destiny, prophetic scrying, and predetermined fate strings.',
    offense: {
      id: 'null_off_intuition',
      branchRole: 'OFFENSE',
      name: 'Gut Read (Unpredictable Strike)',
      tagline: 'Strikes with pure somatic instinct that cannot be predicted by seers or tacticians.',
      ranks: [
        { rank: 1, title: 'Rank 1: Unpredictable Strike', cost: '2 Focus', range: 'Melee', aoe: 'Single Target', description: 'Attack trajectory is completely irrational; bypasses predictive guards.' },
        { rank: 2, title: 'Rank 2: Chaos Feint', cost: '2 Focus', range: 'Melee', aoe: 'Single Target', description: 'Forces defender to commit to the wrong tactical prediction during clash ties.' },
        { rank: 3, title: 'Rank 3: Fate-Severing Slash', cost: '3 Focus', range: 'Melee', aoe: 'Single Target', description: 'Deals 2d8 damage; target cannot spend luck or reroll dice for the encounter.' },
        { rank: 4, title: 'Rank 4: Destiny-Cracking Execution', cost: '4 Focus', range: 'Melee', aoe: 'Single Target', description: 'Severs prophetic destiny; kills creatures that normally possess prophecy armor.', addedEffect: 'Bypasses prophecy invulnerability and fate armor' }
      ]
    },
    defense: {
      id: 'null_def_intuition',
      branchRole: 'DEFENSE',
      name: 'Fate Null (Scrying Immunity)',
      tagline: 'Cannot be perceived by oracles, clairvoyants, or temporal seers.',
      ranks: [
        { rank: 1, title: 'Rank 1: Blank Fate', cost: '0 Focus', range: 'Self', aoe: 'Self', description: 'Oracles and seers cannot scry on your location or actions.' },
        { rank: 2, title: 'Rank 2: Unseen Presence', cost: '1 Focus', range: 'Self', aoe: 'Self', description: 'Prophetic danger senses do not trigger when you approach enemies.' },
        { rank: 3, title: 'Rank 3: Curse of Fate Sever', cost: '2 Focus', range: 'Self', aoe: 'Self', description: 'Enemy advantage dice are canceled and converted to standard flat rolls.' },
        { rank: 4, title: 'Rank 4: Total Anomaly of Destiny', cost: '3 Focus', range: 'Self (15 ft aura)', aoe: 'Party Zone', description: 'Entire party is completely invisible to gods, wardens, cultists, and seers.', addedEffect: 'Party complete invisibility to cosmic gods and seers' }
      ]
    },
    utility: {
      id: 'null_util_intuition',
      branchRole: 'UTILITY',
      name: 'Somatic Gut Instinct & Luck Non-Entity',
      tagline: 'Chooses the correct door, tunnel, or decision through pure somatic muscle empathy.',
      ranks: [
        { rank: 1, title: 'Rank 1: Gut Decision', cost: '0 Focus', range: 'Self', aoe: 'Dilemma', description: 'When faced with two paths or doors, GM indicates which has lower danger.' },
        { rank: 2, title: 'Rank 2: Anomaly Navigation', cost: '1 Focus', range: 'Self', aoe: 'Labyrinth', description: 'Navigate shifting mazes and temporal dungeons without getting lost.' },
        { rank: 3, title: 'Rank 3: Dice Nullification', cost: '2 Focus', range: 'Zone', aoe: 'Encounter', description: 'Cancel all critical fumbles and critical successes in zone; purely flat skill rules.' },
        { rank: 4, title: 'Rank 4: The Unwritten Thread', cost: '3 Focus', range: 'Self', aoe: 'Narrative Arc', description: 'GM cannot force narrative doom on character; fate is strictly in your hands.', addedEffect: 'Immunity to GM narrative scripted death' }
      ]
    }
  },

  charm: {
    stat: 'charm',
    constantName: 'Social Dominance (Telepathic & Vocal Sway)',
    mode: 'NULL',
    treeName: 'Psychological Silence Null Tree',
    philosophicalCore: 'Exempt from psychological sway, intimidation shouts, morale panic, and charm spells.',
    offense: {
      id: 'null_off_charm',
      branchRole: 'OFFENSE',
      name: 'Social Dominance & Stripping Pretense',
      tagline: 'Cuts through aristocratic deception and magical glamours with cold presence.',
      ranks: [
        { rank: 1, title: 'Rank 1: Piercing Presence', cost: '2 Focus', range: '30 ft voice', aoe: 'Single Target', description: 'Cuts through pretense; target loses +2 from their social defense checks.' },
        { rank: 2, title: 'Rank 2: Glamour Shatter', cost: '2 Focus', range: '45 ft voice', aoe: 'Target', description: 'Instantly dispels target disguise, illusory makeup, or magical beauty glamours.' },
        { rank: 3, title: 'Rank 3: Stripping Authority', cost: '3 Focus', range: '60 ft voice', aoe: 'Commander', description: 'Strikes target commander; their subordinates lose all morale bonuses.' },
        { rank: 4, title: 'Rank 4: Absolute Psychological Neutralization', cost: '4 Focus', range: '60 ft voice', aoe: 'All Foes in Zone', description: 'Neutralizes all enemy commander shouts, war drums, and aura bonuses in zone.', addedEffect: 'Shuts down all enemy unit buffs and leader commands' }
      ]
    },
    defense: {
      id: 'null_def_charm',
      branchRole: 'DEFENSE',
      name: 'Psychological Silence (Phero Null)',
      tagline: 'Immune to seduction, intimidation shouts, social blackmail, and mind control.',
      ranks: [
        { rank: 1, title: 'Rank 1: Charm Immunity', cost: '0 Focus', range: 'Self', aoe: 'Self', description: 'Completely immune to magical charm and seduction spells.' },
        { rank: 2, title: 'Rank 2: Unshakable Demeanor', cost: '0 Focus', range: 'Self', aoe: 'Self', description: 'Intimidation shouts and demoralizing screams have zero effect on you.' },
        { rank: 3, title: 'Rank 3: Total Social Inertness', cost: '1 Focus', range: 'Self', aoe: 'Self', description: 'Take 0 Composure damage from all verbal taunts, insults, and psychic shouts.' },
        { rank: 4, title: 'Rank 4: Zone of Psychological Silence', cost: '2 Focus', range: 'Self (20 ft aura)', aoe: 'Party Zone', description: 'Party is immune to all psychological manipulation, fear, and mental dread.', addedEffect: 'Party immunity to all social and psychological manipulation' }
      ]
    },
    utility: {
      id: 'null_util_charm',
      branchRole: 'UTILITY',
      name: 'Unseen Diplomat & Anonymity',
      tagline: 'Blends into crowds seamlessly; leaves zero memory in the minds of strangers.',
      ranks: [
        { rank: 1, title: 'Rank 1: Forgettable Face', cost: '0 Focus', range: 'Self', aoe: 'Self', description: 'Strangers cannot recall your face, clothing, or description 10 minutes later.' },
        { rank: 2, title: 'Rank 2: Crowd Vanish', cost: '1 Focus', range: 'Self', aoe: 'Crowd', description: 'Step into any crowd of 3+ people; become untargetable and unfindable.' },
        { rank: 3, title: 'Rank 3: Clean Record', cost: '2 Focus', range: 'Self', aoe: 'Bounty/Guards', description: 'Local guards and cartels lose all bounty records and warrants on your name.' },
        { rank: 4, title: 'Rank 4: Ghost of Society', cost: '3 Focus', range: 'Self', aoe: 'Faction Records', description: 'You literally do not exist in the bureaucratic records of any faction or kingdom.', addedEffect: 'Permanent bureaucratic and historical anonymity' }
      ]
    }
  },

  willpower: {
    stat: 'willpower',
    constantName: 'Sovereignty (Psionic Compulsion & Madness)',
    mode: 'NULL',
    treeName: 'Iron Resolve Null Exemption Tree',
    philosophicalCore: 'The psyche is completely inert to madness, cosmic panic, and outside psychic decrees.',
    offense: {
      id: 'null_off_willpower',
      branchRole: 'OFFENSE',
      name: 'Psychic Severance Strike',
      tagline: 'Punches through psionic tethers, severing mind links and dominating casters.',
      ranks: [
        { rank: 1, title: 'Rank 1: Sever Tether', cost: '2 Focus', range: 'Melee/Ranged', aoe: 'Single Target', description: 'Cuts telepathic communication between target and their minions.' },
        { rank: 2, title: 'Rank 2: Psionic Feedback', cost: '2 Focus', range: 'Melee/Ranged', aoe: 'Single Target', description: 'Reflects mental attack back; deals 2d8 psychic trauma to the attacking telepath.' },
        { rank: 3, title: 'Rank 3: Mind Breaker Strike', cost: '3 Focus', range: 'Melee/Ranged', aoe: 'Single Target', description: 'Shatters target mental focus; burns 6 points of their Focus pool.' },
        { rank: 4, title: 'Rank 4: Total Psionic Severance', cost: '4 Focus', range: 'Melee/Ranged', aoe: 'Single Target', description: 'Sever target brain from reality; target falls into permanent comatose stasis.', addedEffect: 'Puts hostile psychic entity into comatose stasis' }
      ]
    },
    defense: {
      id: 'null_def_willpower',
      branchRole: 'DEFENSE',
      name: 'Iron Resolve (Madness Exemption)',
      tagline: 'Completely exempt from fear, psychological breaking points, and cosmic trauma.',
      ranks: [
        { rank: 1, title: 'Rank 1: Fearless Soul', cost: '0 Focus', range: 'Self', aoe: 'Self', description: 'Immune to all supernatural fear, panic, and cosmic awe.' },
        { rank: 2, title: 'Rank 2: Madness Inertia', cost: '0 Focus', range: 'Self', aoe: 'Self', description: 'Immune to eldritch insanity and delirium caused by the blood moon Cruorbus.' },
        { rank: 3, title: 'Rank 3: Unbreakable Psyche', cost: '1 Focus', range: 'Self', aoe: 'Self', description: 'Cannot be possessed, mentally dominated, or psychically scanned by any entity.' },
        { rank: 4, title: 'Rank 4: Sovereign Soul Fortress', cost: '2 Focus', range: 'Self (20 ft aura)', aoe: 'Party Zone', description: 'Entire party is completely immune to madness, fear, possession, and psychic damage.', addedEffect: 'Party total immunity to madness, possession & psychic trauma' }
      ]
    },
    utility: {
      id: 'null_util_willpower',
      branchRole: 'UTILITY',
      name: 'Sovereign Presence & Reality Grounding',
      tagline: 'Grounds reality against cosmic distortions, blood moon eclipses, and planar rot.',
      ranks: [
        { rank: 1, title: 'Rank 1: Sanity Beacon', cost: '0 Focus', range: '15 ft', aoe: 'Allies', description: 'Allies in presence gain advantage on all Willpower and Composure checks.' },
        { rank: 2, title: 'Rank 2: Delirium Purge', cost: '1 Focus', range: 'Touch', aoe: 'Target', description: 'Cures madness, confusion, or trauma conditions from an ally in 1 action.' },
        { rank: 3, title: 'Rank 3: Reality Grounding', cost: '2 Focus', range: '30 ft radius', aoe: 'Zone', description: 'Grounds local reality; prevents planar entities from summoning reinforcements.' },
        { rank: 4, title: 'Rank 4: The Unmovable Sovereign Entity', cost: '3 Focus', range: 'Sector', aoe: 'Regional Cell', description: 'Neutralizes cosmic corruption and planar chaos across an entire regional cell.', addedEffect: 'Cleanses cosmic and planar corruption from regional sector' }
      ]
    }
  }
};
