/**
 * 12-STAT SOCIAL & SANITY SKILL PROGRESSION TREES
 * ===============================================
 * Parallels the physical offensive and defensive skill progression for Composure,
 * Social Combat, and Sanity.
 *
 * Each of the 12 attributes possesses:
 * 1. An Offensive Social Track (Weapon Specialization, 1 Passive, 1 Active with 4 ranks)
 * 2. A Defensive Sanity Track (Armor Specialization, 1 Passive, 1 Active with 4 ranks)
 */

import { StatKey } from './CharacterData.js';
import { SkillBranchDef, SkillTrackDef } from './MasterSkillProgression.js';

export function createSocialWeaponSpecializationBranch(stat: StatKey, weaponCategory: string): SkillBranchDef {
  return {
    id: `spec_soc_weapon_${stat}`,
    branchType: 'SPECIALIZATION',
    name: `${weaponCategory} Rhetorical Specialization`,
    tagline: 'Refined rhetorical stance eliminating social penalties and sharpening psychological edge.',
    ranks: [
      {
        rank: 1,
        title: 'Rank 1: Unflinching Presence',
        description: 'Executing a social attack does not impose disadvantage on your Composure defense rolls this turn.'
      },
      {
        rank: 2,
        title: 'Rank 2: Dialectic Flow',
        description: 'You do not suffer disadvantage when pressing a debate or intimidation against multiple adversaries in succession.'
      },
      {
        rank: 3,
        title: 'Rank 3: Effortless Authority',
        description: 'Reduces Focus reservation cost by 1 point across all active social techniques.'
      },
      {
        rank: 4,
        title: 'Rank 4: Devastating Insinuation',
        description: 'Mastery Strike: Minor social successes automatically deal +2 bonus Composure trauma.',
        addedEffect: 'Bonus Composure trauma on social checks'
      }
    ]
  };
}

export function createSocialArmorSpecializationBranch(stat: StatKey, armorCategory: string): SkillBranchDef {
  return {
    id: `spec_san_armor_${stat}`,
    branchType: 'SPECIALIZATION',
    name: `${armorCategory} Psychological Specialization`,
    tagline: 'Deep mental anchoring that deflects demoralization and turns psychic dread into clarity.',
    ranks: [
      {
        rank: 1,
        title: 'Rank 1: Emotional Equilibrium',
        description: 'Defending against a social attack or dread check does not impose disadvantage on your next action.'
      },
      {
        rank: 2,
        title: 'Rank 2: Iron Poise',
        description: 'You do not suffer disadvantage when defending your Composure against back-to-back psychological assaults.'
      },
      {
        rank: 3,
        title: 'Rank 3: Lightened Mental Load',
        description: 'Regain 1 point of Composure immediately whenever you successfully resist an intimidation or horror check.'
      },
      {
        rank: 4,
        title: 'Rank 4: Unbreakable Ego',
        description: 'Mastery Ward: Suffer 1 less Composure trauma (CDR +1) from all verbal, psychic, and cosmic dread sources.',
        addedEffect: '+1 Universal Composure DR'
      }
    ]
  };
}

export const SOCIAL_OFFENSIVE_SKILL_TRACKS: Record<StatKey, SkillTrackDef> = {
  might: {
    stat: 'might',
    trackName: 'Overbearing Command & Terror Track',
    flavor: 'Sheer imposing physical mass and booming vocal dominance that terrifies opposition into obedience.',
    specialization: createSocialWeaponSpecializationBranch('might', 'Baton & Warhorn'),
    passive: {
      id: 'pass_soc_might',
      branchType: 'PASSIVE',
      name: 'Menacing Stature',
      tagline: 'Raw bodily scale that radiates unspoken violence and silences dissent.',
      ranks: [
        { rank: 1, title: 'Rank 1: Looming Shadow', description: '+1 flat bonus to Intimidation checks against smaller or outnumbered foes.' },
        { rank: 2, title: 'Rank 2: Heavy Cadence', description: '+1 Composure damage bonus when intimidating or commanding.' },
        { rank: 3, title: 'Rank 3: Crushing Gaze', description: 'Meeting an opponent\'s eyes imposes -1 penalty to their initial Composure defense.' },
        { rank: 4, title: 'Rank 4: Warlord\'s Tremor', description: '+2 Composure damage; enemies shaken by your presence suffer disadvantage on their next check.', addedEffect: 'Inflicts Shaken condition on target' }
      ]
    },
    active: {
      id: 'act_soc_might',
      branchType: 'ACTIVE',
      name: 'Thunderous Demoralization Shout',
      tagline: 'A deafening, primal roar that shatters enemy nerve and forces immediate capitulation.',
      ranks: [
        { rank: 1, title: 'Rank 1: Intimidating Bark', cost: '2 Focus', range: '30 ft', aoe: 'Single Target', description: 'Deliver a terrifying roar dealing Might Composure damage; ignores 1 point of social CDR.' },
        { rank: 2, title: 'Rank 2: Roar of Submission', cost: '2 Focus', range: '30 ft', aoe: 'Single Target', description: 'Deals +2 bonus Composure damage and causes target to back away 5 feet.' },
        { rank: 3, title: 'Rank 3: Zone Shockwave', cost: '1 Focus', range: '30 ft', aoe: 'Zone (3 Targets)', description: 'Cost reduced to 1 Focus; shouts down up to 3 targets simultaneously.' },
        { rank: 4, title: 'Rank 4: Soul-Breaking Command', cost: '1 Focus', range: '45 ft', aoe: 'All Foes in Zone', description: 'Overwhelming bellow forces all enemies with under 5 Composure to immediately surrender or drop weapons.', addedEffect: 'Forces surrender on weakened foes' }
      ]
    }
  },

  endurance: {
    stat: 'endurance',
    trackName: 'Inexorable Filibuster & Grinding Will Track',
    flavor: 'Endless rhetorical stamina, weathering verbal storms through stubborn refusal to yield.',
    specialization: createSocialWeaponSpecializationBranch('endurance', 'Rosary & Stave'),
    passive: {
      id: 'pass_soc_endurance',
      branchType: 'PASSIVE',
      name: 'Tireless Demeanor',
      tagline: 'Wearing down debate opponents through endless stamina and obstinacy.',
      ranks: [
        { rank: 1, title: 'Rank 1: Long Wind', description: 'Gain +1 bonus on social checks in debates lasting longer than 2 rounds.' },
        { rank: 2, title: 'Rank 2: Stubborn Demeanor', description: 'Opponents lose 1 Composure whenever they fail a social check against you.' },
        { rank: 3, title: 'Rank 3: Grinding Attrition', description: 'Social attacks deal +1 Composure damage for each consecutive turn pressed.' },
        { rank: 4, title: 'Rank 4: Inevitable Monolith', description: 'Cannot be shouted down; your arguments gain inevitable momentum, dealing guaranteed minimum 2 Composure damage.', addedEffect: 'Guaranteed minimum Composure damage' }
      ]
    },
    active: {
      id: 'act_soc_endurance',
      branchType: 'ACTIVE',
      name: 'Exhaustive Cross-Examination',
      tagline: 'A relentless barrage of repetitive inquiries that exhausts opponent mental stamina.',
      ranks: [
        { rank: 1, title: 'Rank 1: Incessant Questioning', cost: '2 Focus', range: '30 ft', aoe: 'Single Target', description: 'Pepper opponent with grueling inquiries, dealing Endurance Composure damage.' },
        { rank: 2, title: 'Rank 2: Mental Grind', cost: '2 Focus', range: '30 ft', aoe: 'Single Target', description: 'Target suffers -2 to their next active roll from mental exhaustion.' },
        { rank: 3, title: 'Rank 3: Filibuster Siege', cost: '1 Focus', range: '30 ft', aoe: 'Single Target', description: 'Cost reduced to 1 Focus; target cannot take reaction skills until next turn.' },
        { rank: 4, title: 'Rank 4: Total Exhaustion Breakdown', cost: '1 Focus', range: '45 ft', aoe: 'Single Target', description: 'Target collapses in utter mental fatigue, forfeiting their next turn and confessing the truth.', addedEffect: 'Target skips turn and confesses' }
      ]
    }
  },

  finesse: {
    stat: 'finesse',
    trackName: 'Scandal, Innuendo & Silver Needle Track',
    flavor: 'Surgical courtier venom, exploiting private insecurities with devastating subtlety.',
    specialization: createSocialWeaponSpecializationBranch('finesse', 'Fan & Needle Quill'),
    passive: {
      id: 'pass_soc_finesse',
      branchType: 'PASSIVE',
      name: 'Vicious Subtlety',
      tagline: 'Delivering catastrophic reputational wounds masked beneath courteous flattery.',
      ranks: [
        { rank: 1, title: 'Rank 1: Polite Mockery', description: 'Bystanders do not recognize your verbal jabs as aggressive hostile actions.' },
        { rank: 2, title: 'Rank 2: Punctured Vanity', description: '+1 Composure damage bonus against aristocrats, officers, and pompous targets.' },
        { rank: 3, title: 'Rank 3: Razor Wit', description: 'Ignores 2 points of target social Composure Damage Reduction (CDR).' },
        { rank: 4, title: 'Rank 4: Fatal Reputation Wound', description: 'A critical social success permanently shames the target in the public chronicle.', addedEffect: 'Inflicts permanent public shame' }
      ]
    },
    active: {
      id: 'act_soc_finesse',
      branchType: 'ACTIVE',
      name: 'Cutting Innuendo (Reputational Flay)',
      tagline: 'A whispered double entendre that exposes target hypocrisy and destroys their social standing.',
      ranks: [
        { rank: 1, title: 'Rank 1: Piercing Jab', cost: '2 Focus', range: '30 ft', aoe: 'Single Target', description: 'Strike at an opponent\'s hidden insecurity, dealing Finesse Composure damage.' },
        { rank: 2, title: 'Rank 2: Exposed Hypocrisy', cost: '2 Focus', range: '30 ft', aoe: 'Single Target', description: 'Target is flustered and suffers -2 to all Charm and Logic rolls for 2 rounds.' },
        { rank: 3, title: 'Rank 3: Whispered Echo', cost: '1 Focus', range: '45 ft', aoe: 'Target & Adjacent Bystanders', description: 'Causes nearby witnesses to laugh or sneer at the target, dealing +3 bonus Composure trauma.' },
        { rank: 4, title: 'Rank 4: Aristocratic Ruin', cost: '1 Focus', range: '60 ft', aoe: 'Single Target', description: 'Completely shatters opponent composure; target flees the room in tears or humiliation.', addedEffect: 'Forces target to flee in humiliation' }
      ]
    }
  },

  reflex: {
    stat: 'reflex',
    trackName: 'Repartee & Quick-Wit Duelist Track',
    flavor: 'Lightning-fast comebacks that turn hostile arguments back into the attacker\'s face.',
    specialization: createSocialWeaponSpecializationBranch('reflex', 'Mirror & Castanets'),
    passive: {
      id: 'pass_soc_reflex',
      branchType: 'PASSIVE',
      name: 'Sharp Tongue',
      tagline: 'Instinctive verbal reflexes that intercept verbal attacks mid-sentence.',
      ranks: [
        { rank: 1, title: 'Rank 1: Quick Quip', description: 'Gain +1 bonus to Initiative in social encounters and verbal standoffs.' },
        { rank: 2, title: 'Rank 2: Mirror Deflection', description: 'Successfully parrying a social attack reflects 1 Composure damage back to attacker.' },
        { rank: 3, title: 'Rank 3: Derailing Feint', description: 'Opponents who miss a social attack against you suffer disadvantage on their next check.' },
        { rank: 4, title: 'Rank 4: Master Jester\'s Retort', description: 'Can interrupt an enemy\'s action to deliver an immediate free verbal counter-strike.', addedEffect: 'Free reaction verbal counter-strike' }
      ]
    },
    active: {
      id: 'act_soc_reflex',
      branchType: 'ACTIVE',
      name: 'Scathing Retort (Verbal Riposte)',
      tagline: 'A lightning-fast insult snapped before the adversary can finish drawing breath.',
      ranks: [
        { rank: 1, title: 'Rank 1: Snapping Comeback', cost: '2 Focus', range: '30 ft', aoe: 'Single Target', description: 'Deliver a reflexive comeback dealing Reflex Composure damage.' },
        { rank: 2, title: 'Rank 2: Stung Pride', cost: '2 Focus', range: '30 ft', aoe: 'Single Target', description: 'Deals +2 bonus Composure damage and provokes target into making a reckless attack.' },
        { rank: 3, title: 'Rank 3: Rapid Fire Feint', cost: '1 Focus', range: '30 ft', aoe: 'Single Target', description: 'Cost reduced to 1 Focus; bypasses defender\'s reaction abilities.' },
        { rank: 4, title: 'Rank 4: Crowd-Roaring Riposte', cost: '1 Focus', range: '45 ft', aoe: 'Single Target', description: 'Delivers a devastating retort that disorients target, reducing their Composure to 0 if under 6.', addedEffect: 'Executes targets under 6 Composure' }
      ]
    }
  },

  vitality: {
    stat: 'vitality',
    trackName: 'Primal Bravado & Boisterous Heart Track',
    flavor: 'Infectious bodily joy, unquenchable lust for life, and raw physical presence.',
    specialization: createSocialWeaponSpecializationBranch('vitality', 'Horn & Fetish'),
    passive: {
      id: 'pass_soc_vitality',
      branchType: 'PASSIVE',
      name: 'Infectious Mirth',
      tagline: 'Boisterous laughter and animal vitality that sweeps away cowardly hesitation.',
      ranks: [
        { rank: 1, title: 'Rank 1: Hearty Laugh', description: '+1 bonus to social rolls when carousing, feasting, or sharing drinks.' },
        { rank: 2, title: 'Rank 2: Unfiltered Presence', description: '+1 Composure damage bonus when mocking pretense or cowardice.' },
        { rank: 3, title: 'Rank 3: Vitality Spark', description: 'Restores 1 Composure to all adjacent allies whenever you deal Composure damage.' },
        { rank: 4, title: 'Rank 4: Primal Apex Radiance', description: 'Your boisterous courage renders adjacent allies completely immune to fear.', addedEffect: 'Aura of fear immunity for allies' }
      ]
    },
    active: {
      id: 'act_soc_vitality',
      branchType: 'ACTIVE',
      name: 'Boisterous Carouse (Bravado Roar)',
      tagline: 'A chest-thumping display of untamed joy that disarms tension and mocks dour threats.',
      ranks: [
        { rank: 1, title: 'Rank 1: Boisterous Toast', cost: '2 Focus', range: '30 ft', aoe: 'Single Target', description: 'Challenge an opponent with primal laughter, dealing Vitality Composure damage.' },
        { rank: 2, title: 'Rank 2: Disarming Cheer', cost: '2 Focus', range: '30 ft', aoe: 'Single Target', description: 'Breaks target aggression; reduces target disposition penalty by 1.' },
        { rank: 3, title: 'Rank 3: Reveler\'s Surge', cost: '1 Focus', range: '30 ft', aoe: 'Zone', description: 'Cost reduced to 1 Focus; all allies in zone recover 2 Composure.' },
        { rank: 4, title: 'Rank 4: Hearth-God Revelry', cost: '1 Focus', range: '45 ft', aoe: 'All in Zone', description: 'Forces hostile foes to abandon their battle rage and join in drink or retreat.', addedEffect: 'Disbands hostility into carousal' }
      ]
    }
  },

  fortitude: {
    stat: 'fortitude',
    trackName: 'Immovable Silence & Stone Wall Track',
    flavor: 'Cold, unblinking stillness that lets opponent fury break harmlessly like waves on granite.',
    specialization: createSocialWeaponSpecializationBranch('fortitude', 'Seal & Anvil'),
    passive: {
      id: 'pass_soc_fortitude',
      branchType: 'PASSIVE',
      name: 'Silent Contempt',
      tagline: 'An absolute refusal to react that makes hostile blowhards doubt their own sanity.',
      ranks: [
        { rank: 1, title: 'Rank 1: Blank Stare', description: 'Enemies gain no advantage from Intimidation or threats against you.' },
        { rank: 2, title: 'Rank 2: Stone Bearing', description: 'Dealing zero damage on a social attack still inflicts 1 Composure damage from sheer awkwardness.' },
        { rank: 3, title: 'Rank 3: Unyielding Presence', description: 'Gain +2 bonus on contested rolls against psychological coercion.' },
        { rank: 4, title: 'Rank 4: The Granite Wall', description: 'Your silent immobility forces enemies who fail attacks against you to suffer 3 Composure trauma.', addedEffect: 'Reflects 3 Composure damage on missed attacks' }
      ]
    },
    active: {
      id: 'act_soc_fortitude',
      branchType: 'ACTIVE',
      name: 'Withering Silence (Unblinking Stare)',
      tagline: 'Saying absolutely nothing with such heavy gravity that the opponent unravels their own lies.',
      ranks: [
        { rank: 1, title: 'Rank 1: Heavy Stillness', cost: '2 Focus', range: '30 ft', aoe: 'Single Target', description: 'Hold unblinking eye contact, dealing Fortitude Composure damage.' },
        { rank: 2, title: 'Rank 2: Awkward Void', cost: '2 Focus', range: '30 ft', aoe: 'Single Target', description: 'Forces target to stumble over their words, suffering -2 on their next roll.' },
        { rank: 3, title: 'Rank 3: Unbroken Glare', cost: '1 Focus', range: '30 ft', aoe: 'Single Target', description: 'Target begins sweating and doubts their own assertions, losing 2 extra Composure.' },
        { rank: 4, title: 'Rank 4: Soul-Crushing Void', cost: '1 Focus', range: '45 ft', aoe: 'Single Target', description: 'Target breaks into nervous panic, babbling secrets to fill the terrifying silence.', addedEffect: 'Target unburdens secrets in panic' }
      ]
    }
  },

  knowledge: {
    stat: 'knowledge',
    trackName: 'Jurisprudence & Precedent Track',
    flavor: 'Citing treaties, historical precedents, and arcane charters to dismantle illegal authority.',
    specialization: createSocialWeaponSpecializationBranch('knowledge', 'Lexicon & Astrolabe'),
    passive: {
      id: 'pass_soc_knowledge',
      branchType: 'PASSIVE',
      name: 'Scholarly Superiority',
      tagline: 'Authoritative encyclopedic recall that leaves uneducated bullies paralyzed.',
      ranks: [
        { rank: 1, title: 'Rank 1: Cited Authority', description: '+1 bonus on social rolls when quoting regional laws, charters, or treaties.' },
        { rank: 2, title: 'Rank 2: Historical Context', description: '+1 Composure damage bonus when correcting an opponent\'s factual errors.' },
        { rank: 3, title: 'Rank 3: Ancient Precedent', description: 'Bypasses 2 points of target social CDR through irrefutable textual evidence.' },
        { rank: 4, title: 'Rank 4: Archival Domination', description: 'Opponents cannot question your jurisdiction; deals +3 bonus Composure trauma.', addedEffect: '+3 Composure damage on all legal/scholarly checks' }
      ]
    },
    active: {
      id: 'act_soc_knowledge',
      branchType: 'ACTIVE',
      name: 'Imperial Clause Injunction',
      tagline: 'Reciting an obscure imperial decree that voids an officer\'s legal right to impede you.',
      ranks: [
        { rank: 1, title: 'Rank 1: Legal Injunction', cost: '2 Focus', range: '30 ft', aoe: 'Single Target', description: 'Cite legal statutes, dealing Knowledge Composure damage.' },
        { rank: 2, title: 'Rank 2: Bureaucratic Paralysis', cost: '2 Focus', range: '30 ft', aoe: 'Single Target', description: 'Target authority figure hesitates, fearing administrative reprimand (-2 to rolls).' },
        { rank: 3, title: 'Rank 3: Arcane Decree', cost: '1 Focus', range: '45 ft', aoe: 'All Faction Guards in Zone', description: 'Cost reduced to 1 Focus; causes entire squad to stand down temporarily.' },
        { rank: 4, title: 'Rank 4: Absolute Constitutional Decree', cost: '1 Focus', range: '60 ft', aoe: 'Zone', description: 'Shuts down all hostile legal proceedings; target signs permit or steps aside.', addedEffect: 'Guards stand down and authorize passage' }
      ]
    }
  },

  logic: {
    stat: 'logic',
    trackName: 'Socratic Dissection & Syllogism Track',
    flavor: 'Ruthlessly dismantling bad arguments, exposing cognitive fallacies, and forcing intellectual surrender.',
    specialization: createSocialWeaponSpecializationBranch('logic', 'Abacus & Scalpel'),
    passive: {
      id: 'pass_soc_logic',
      branchType: 'PASSIVE',
      name: 'Cognitive Dissector',
      tagline: 'Spotting formal rhetorical fallacies like a hawk spotting field mice.',
      ranks: [
        { rank: 1, title: 'Rank 1: Fallacy Detection', description: 'Instantly detect when an opponent uses a false dilemma or straw man argument.' },
        { rank: 2, title: 'Rank 2: Analytical Precision', description: '+1 Composure damage bonus when answering emotionally manipulative rhetoric.' },
        { rank: 3, title: 'Rank 3: Reductio Ad Absurdum', description: 'Exposing a contradiction deals 2 automatic Composure trauma to all hostile debaters.' },
        { rank: 4, title: 'Rank 4: Pure Axiomatic Certainty', description: 'Your logical conclusions are incontrovertible; critical successes deal double Composure trauma.', addedEffect: 'Doubles Composure trauma on critical success' }
      ]
    },
    active: {
      id: 'act_soc_logic',
      branchType: 'ACTIVE',
      name: 'Socratic Demolition',
      tagline: 'Leading the opponent into trapping themselves in their own contradictory premise.',
      ranks: [
        { rank: 1, title: 'Rank 1: Socratic Trap', cost: '2 Focus', range: '30 ft', aoe: 'Single Target', description: 'Trap opponent in their own premises, dealing Logic Composure damage.' },
        { rank: 2, title: 'Rank 2: Flaw Exposure', cost: '2 Focus', range: '30 ft', aoe: 'Single Target', description: 'Deals +2 bonus Composure damage and causes target to stammer and hesitate.' },
        { rank: 3, title: 'Rank 3: Syllogistic Strike', cost: '1 Focus', range: '45 ft', aoe: 'Single Target', description: 'Cost reduced to 1 Focus; if target Composure drops to 0, they formally concede.' },
        { rank: 4, title: 'Rank 4: Intellectual Breakdown', cost: '1 Focus', range: '60 ft', aoe: 'Zone (3 Targets)', description: 'Demolishes morale of up to 3 enemies; inflicts Panic on all failed checks.', addedEffect: '3-target AoE Panic & severe Composure shatter' }
      ]
    }
  },

  awareness: {
    stat: 'awareness',
    trackName: 'Lie Detection & Psychological Scrutiny Track',
    flavor: 'Catching every bead of sweat, twitching eye, and defensive posture to read minds like open books.',
    specialization: createSocialWeaponSpecializationBranch('awareness', 'Monocle & Tuning Fork'),
    passive: {
      id: 'pass_soc_awareness',
      branchType: 'PASSIVE',
      name: 'Micro-Expression Reader',
      tagline: 'Perceiving involuntary physiological giveaways that reveal inner turmoil.',
      ranks: [
        { rank: 1, title: 'Rank 1: Tell Spotter', description: 'Advantage on Insight rolls to detect lies, nervousness, or concealed weapons.' },
        { rank: 2, title: 'Rank 2: Targeted Pressure', description: '+1 Composure damage bonus against nervous or guilt-ridden targets.' },
        { rank: 3, title: 'Rank 3: Unmasking Gaze', description: 'Reveals the target\'s primary emotional vulnerability (Greed, Fear, Pride, or Guilt).' },
        { rank: 4, title: 'Rank 4: Predictive Reading', description: 'Anticipate social attacks before they are spoken, gaining +2 defense against them.', addedEffect: '+2 defense against all incoming social checks' }
      ]
    },
    active: {
      id: 'act_soc_awareness',
      branchType: 'ACTIVE',
      name: 'Vocal Lie-Callout (Bluff Shatter)',
      tagline: 'Calling out an adversary\'s tell in front of everyone, instantly popping their facade.',
      ranks: [
        { rank: 1, title: 'Rank 1: Call Out Deceit', cost: '2 Focus', range: '30 ft', aoe: 'Single Target', description: 'Call out a physical tell, dealing Awareness Composure damage.' },
        { rank: 2, title: 'Rank 2: Exposed Bluff', cost: '2 Focus', range: '30 ft', aoe: 'Single Target', description: 'Negates target\'s active bluff and deals +2 bonus Composure damage.' },
        { rank: 3, title: 'Rank 3: Public Unmasking', cost: '1 Focus', range: '45 ft', aoe: 'Single Target', description: 'All surrounding NPCs recognize target as a liar, turning their disposition downward.' },
        { rank: 4, title: 'Rank 4: Total Facade Collapse', cost: '1 Focus', range: '60 ft', aoe: 'Single Target', description: 'Shatters target composure completely; target drops their disguise or reveals true motives.', addedEffect: 'Forces target to reveal true motives' }
      ]
    }
  },

  intuition: {
    stat: 'intuition',
    trackName: 'Empathic Omen & Soul Mirror Track',
    flavor: 'Channeling visceral psychic empathy and planetary omens to speak directly to the target\'s soul.',
    specialization: createSocialWeaponSpecializationBranch('intuition', 'Runes & Phial'),
    passive: {
      id: 'pass_soc_intuition',
      branchType: 'PASSIVE',
      name: 'Cruorbus Resonance',
      tagline: 'Attuning your voice to the subconscious terrors whispered by the blood moon.',
      ranks: [
        { rank: 1, title: 'Rank 1: Soul Echo', description: 'Sense the underlying mood and secret desires of a room upon entering.' },
        { rank: 2, title: 'Rank 2: Uncanny Premonition', description: '+1 Composure damage bonus when speaking of prophetic doom or celestial omens.' },
        { rank: 3, title: 'Rank 3: Subconscious Resonance', description: 'Ignores 2 points of target social CDR by tapping into their repressed guilt.' },
        { rank: 4, title: 'Rank 4: Dream-Strider\'s Whisper', description: 'Your words haunt the target\'s dreams, causing them to wake with -3 Composure.', addedEffect: 'Inflicts persistent psychological haunting' }
      ]
    },
    active: {
      id: 'act_soc_intuition',
      branchType: 'ACTIVE',
      name: 'Omen of Inevitable Ruin',
      tagline: 'Whispering an eerie, uncannily accurate prophecy that strikes fear into the hardened soul.',
      ranks: [
        { rank: 1, title: 'Rank 1: Foreboding Whisper', cost: '2 Focus', range: '30 ft', aoe: 'Single Target', description: 'Whisper an eerie omen, dealing Intuition Composure damage.' },
        { rank: 2, title: 'Rank 2: Chilling Vision', cost: '2 Focus', range: '30 ft', aoe: 'Single Target', description: 'Target suffers hallucinations of their own demise (-2 to all checks).' },
        { rank: 3, title: 'Rank 3: Cosmic Dread Call', cost: '1 Focus', range: '45 ft', aoe: 'Zone', description: 'Cost reduced to 1 Focus; inflicts Composure trauma across all hostile cultists and outlaws.' },
        { rank: 4, title: 'Rank 4: Apocalyptic Awakening', cost: '1 Focus', range: '60 ft', aoe: 'Zone', description: 'Forces target into existential terror; targets with under 6 Composure flee or fall prostrate.', addedEffect: 'Forces targets to fall prostrate or flee' }
      ]
    }
  },

  charm: {
    stat: 'charm',
    trackName: 'Charisma, Seduction & Silver Tongue Track',
    flavor: 'Irresistible magnetism, honeyed promises, and theatrical storytelling that captures hearts.',
    specialization: createSocialWeaponSpecializationBranch('charm', 'Signet & Goblet'),
    passive: {
      id: 'pass_soc_charm',
      branchType: 'PASSIVE',
      name: 'Silver Cadence',
      tagline: 'A melodic, hypnotic timbre that disarms suspicion and makes treachery seem like kindness.',
      ranks: [
        { rank: 1, title: 'Rank 1: Flattering Cadence', description: '+1 bonus on all Persuasion and Barter rolls.' },
        { rank: 2, title: 'Rank 2: Honeyed Venom', description: '+1 Composure damage bonus when manipulating or seducing targets.' },
        { rank: 3, title: 'Rank 3: Mesmerizing Presence', description: 'Target cannot take hostile action against you on the first turn of social interaction.' },
        { rank: 4, title: 'Rank 4: Cult of Personality', description: 'Target regards you as an esteemed friend even after suffering Composure defeat.', addedEffect: 'Target remains friendly after defeat' }
      ]
    },
    active: {
      id: 'act_soc_charm',
      branchType: 'ACTIVE',
      name: 'Captivating Appeal (Silver Tongue)',
      tagline: 'A dazzling emotional appeal that wraps the listener around your little finger.',
      ranks: [
        { rank: 1, title: 'Rank 1: Honeyed Appeal', cost: '2 Focus', range: '30 ft', aoe: 'Single Target', description: 'Deliver a captivating speech, dealing Charm Composure damage.' },
        { rank: 2, title: 'Rank 2: Beguiling Glance', cost: '2 Focus', range: '30 ft', aoe: 'Single Target', description: 'Increases target disposition by +1 temporarily for the duration of the scene.' },
        { rank: 3, title: 'Rank 3: Theatrical Monologue', cost: '1 Focus', range: '45 ft', aoe: 'All Witnesses in Zone', description: 'Cost reduced to 1 Focus; charms all surrounding bystanders into siding with you.' },
        { rank: 4, title: 'Rank 4: Sovereign Enchantment', cost: '1 Focus', range: '60 ft', aoe: 'Single Target', description: 'Target completely succumbs to your charisma, agreeing to whatever request you make.', addedEffect: 'Target agrees to player request' }
      ]
    }
  },

  willpower: {
    stat: 'willpower',
    trackName: 'Psychic Dominion & Indomitable Decree Track',
    flavor: 'Projecting absolute spiritual dominance and psychic weight that forces lesser egos to bend.',
    specialization: createSocialWeaponSpecializationBranch('willpower', 'Brand & Diadem'),
    passive: {
      id: 'pass_soc_willpower',
      branchType: 'PASSIVE',
      name: 'Unyielding Sovereign Ego',
      tagline: 'An aura of unbendable certainty that crushes cowardice and defies terror.',
      ranks: [
        { rank: 1, title: 'Rank 1: Adamant Mind', description: '+1 bonus to resist mental manipulation and psychic commands.' },
        { rank: 2, title: 'Rank 2: Crushing Conviction', description: '+1 Composure damage bonus on all Willpower commands and decrees.' },
        { rank: 3, title: 'Rank 3: Psychic Shock', description: 'Dealing Composure damage to a target causes them to lose 1 Focus point.' },
        { rank: 4, title: 'Rank 4: Dominion of the Ascended', description: 'Your psychic presence is so absolute that all enemies suffer -1 Composure DR.', addedEffect: 'Shreds 1 Composure DR across all enemies' }
      ]
    },
    active: {
      id: 'act_soc_willpower',
      branchType: 'ACTIVE',
      name: 'Overbearing Aura (Soul-Hammer Decree)',
      tagline: 'Unleashing pure spiritual weight that forces adversaries to their knees in awe.',
      ranks: [
        { rank: 1, title: 'Rank 1: Psychic Shockwave', cost: '2 Focus', range: '30 ft', aoe: 'Single Target', description: 'Project psychic force, dealing Willpower Composure damage.' },
        { rank: 2, title: 'Rank 2: Psychic Hammer', cost: '2 Focus', range: '45 ft', aoe: 'Single Target', description: 'Deals 4 Composure damage; stuns target on failed Willpower check.' },
        { rank: 3, title: 'Rank 3: Sovereign Edict', cost: '1 Focus', range: '60 ft', aoe: 'Zone', description: 'Cost reduced to 1 Focus; deals Composure trauma to all foes in radius.' },
        { rank: 4, title: 'Rank 4: Soul-Cracking Dominion', cost: '1 Focus', range: '60 ft', aoe: 'All Foes in Zone', description: 'Unleashes psychic shockwave; all foes suffer 5 Composure trauma and kneel.', addedEffect: 'Zone-wide psychic trauma & forced kneeling' }
      ]
    }
  }
};

export const SANITY_DEFENSIVE_SKILL_TRACKS: Record<StatKey, SkillTrackDef> = {
  might: {
    stat: 'might',
    trackName: 'Primal Bravado & Muscle Armor Track',
    flavor: 'Anchoring sanity in raw flesh, kinetic momentum, and refusing to feel fear.',
    specialization: createSocialArmorSpecializationBranch('might', 'War Mantle & Pauldrons'),
    passive: {
      id: 'pass_san_might',
      branchType: 'PASSIVE',
      name: 'Brute Courage',
      tagline: 'Physical size and muscle mass that shrugs off intimidation as harmless wind.',
      ranks: [
        { rank: 1, title: 'Rank 1: Physical Pride', description: '+1 flat bonus to Composure defense against smaller adversaries.' },
        { rank: 2, title: 'Rank 2: Adrenaline Surge', description: 'Take 1 less Composure damage from shouts and loud threats.' },
        { rank: 3, title: 'Rank 3: Thick Skin', description: 'Gain +1 Composure DR when at maximum physical HP.' },
        { rank: 4, title: 'Rank 4: Unintimidatable Colossus', description: 'Immune to all fear conditions and demoralization shouts.', addedEffect: 'Immune to Fear conditions' }
      ]
    },
    active: {
      id: 'act_san_might',
      branchType: 'ACTIVE',
      name: 'Savage Roar of Defiance',
      tagline: 'Roaring right back into the face of horror, regaining mental control through fury.',
      ranks: [
        { rank: 1, title: 'Rank 1: Defiant Roar', cost: '1 Stamina', range: 'Self', aoe: 'Self', description: 'Reaction: Roar in defiance to negate 2 points of incoming Composure trauma.' },
        { rank: 2, title: 'Rank 2: Blood Surge', cost: '1 Stamina', range: 'Self', aoe: 'Self', description: 'Recover 3 Composure immediately and clear the Shaken condition.' },
        { rank: 3, title: 'Rank 3: Counter-Intimidation', cost: '1 Stamina', range: '30 ft', aoe: 'Attacker', description: 'Reflects 50% of incoming Composure damage right back at the attacker.' },
        { rank: 4, title: 'Rank 4: Apex Defiance', cost: '1 Stamina', range: 'Self (15 ft aura)', aoe: 'Allies in Aura', description: 'Restores 5 Composure to yourself and all allies in aura, rallying them instantly.', addedEffect: 'AoE Composure rally (+5 Composure to all allies)' }
      ]
    }
  },

  endurance: {
    stat: 'endurance',
    trackName: 'Trench Stoicism & Numbness Track',
    flavor: 'Enduring mental agony through hard-bitten grit, treating psychological trauma like blistered feet.',
    specialization: createSocialArmorSpecializationBranch('endurance', 'Greatcoat & Hairshirt'),
    passive: {
      id: 'pass_san_endurance',
      branchType: 'PASSIVE',
      name: 'Weathered Mind',
      tagline: 'Calloused nerve endings that treat insult and terror as everyday weather.',
      ranks: [
        { rank: 1, title: 'Rank 1: Gritty Patience', description: '+1 bonus to resist prolonged psychological torture or endless debate.' },
        { rank: 2, title: 'Rank 2: Numbed Pride', description: 'Insults and mockery deal 1 less Composure damage to you.' },
        { rank: 3, title: 'Rank 3: Second Wind Resolve', description: 'Whenever Composure drops below 5, instantly regain 3 Composure (once per encounter).' },
        { rank: 4, title: 'Rank 4: Eternal Trench Veteran', description: 'Your Composure cannot be reduced to 0 by non-magical social attacks.', addedEffect: 'Cannot be broken by mundane social attacks' }
      ]
    },
    active: {
      id: 'act_san_endurance',
      branchType: 'ACTIVE',
      name: 'Iron Grit Recovery',
      tagline: 'Tightening the belt, spitting out the blood, and refusing to give up ground.',
      ranks: [
        { rank: 1, title: 'Rank 1: Grit Recovery', cost: '1 Stamina', range: 'Self', aoe: 'Self', description: 'Reaction: Reduce incoming Composure damage by 50%.' },
        { rank: 2, title: 'Rank 2: Deep Breath', cost: '1 Stamina', range: 'Self', aoe: 'Self', description: 'Steadies the breath to regain 3 Composure.' },
        { rank: 3, title: 'Rank 3: Fortress of Patience', cost: '1 Stamina', range: 'Self', aoe: 'Self', description: 'Negates all Composure damage for 1 entire round of debate.' },
        { rank: 4, title: 'Rank 4: The Unyielding Trench', cost: '1 Stamina', range: 'Self', aoe: 'Self', description: 'Completely restores your Composure to 50% if currently at 0.', addedEffect: 'Instantly restores 50% Composure from 0' }
      ]
    }
  },

  finesse: {
    stat: 'finesse',
    trackName: 'Social Poise & Teflon Mask Track',
    flavor: 'Letting verbal venom slide off without touching your ego, smiling through malice.',
    specialization: createSocialArmorSpecializationBranch('finesse', 'Doublet & Mask'),
    passive: {
      id: 'pass_san_finesse',
      branchType: 'PASSIVE',
      name: 'Porcelain Composure',
      tagline: 'An impassive court mask that deflects social shame into polite amusement.',
      ranks: [
        { rank: 1, title: 'Rank 1: Unruffled Smile', description: 'Attacking your reputation in public grants you +1 Composure DR.' },
        { rank: 2, title: 'Rank 2: Teflon Poise', description: 'Scandalous accusations deal 1 less Composure trauma.' },
        { rank: 3, title: 'Rank 3: Grace Under Fire', description: 'Gain +2 bonus on all Finesse Composure defense rolls.' },
        { rank: 4, title: 'Rank 4: Total Social Inertness', description: 'Take 0 Composure damage from all verbal taunts, insults, and gossip.', addedEffect: 'Immune to insults and taunts' }
      ]
    },
    active: {
      id: 'act_san_finesse',
      branchType: 'ACTIVE',
      name: 'Dismissive Chuckle',
      tagline: 'A polite, amused chuckle that makes the attacker\'s vicious remarks look childish.',
      ranks: [
        { rank: 1, title: 'Rank 1: Amused Chuckle', cost: '1 Focus', range: 'Self', aoe: 'Self', description: 'Reaction: Laugh off an insult, reducing Composure damage by 50%.' },
        { rank: 2, title: 'Rank 2: Polite Shrug', cost: '1 Focus', range: 'Self', aoe: 'Self', description: 'Completely negates incoming Composure damage from a social attack.' },
        { rank: 3, title: 'Rank 3: Turning the Tables', cost: '1 Focus', range: '30 ft', aoe: 'Attacker', description: 'Negates damage and turns the room\'s amusement onto the attacker.' },
        { rank: 4, title: 'Rank 4: Absolute Aristocratic Dismissal', cost: '1 Focus', range: '30 ft', aoe: 'Attacker', description: 'Negates all damage and deals 4 Composure damage back to the attacker.', addedEffect: 'Negates attack & deals 4 Composure backlash' }
      ]
    }
  },

  reflex: {
    stat: 'reflex',
    trackName: 'Cognitive Agility & Quick Dodge Track',
    flavor: 'Mental gymnastics ducking rhetorical punches and pivoting before guilt can land.',
    specialization: createSocialArmorSpecializationBranch('reflex', 'Ribbon & Pendant'),
    passive: {
      id: 'pass_san_reflex',
      branchType: 'PASSIVE',
      name: 'Mental Agility',
      tagline: 'Shifting topics and changing emotional gears so quickly that accusations miss.',
      ranks: [
        { rank: 1, title: 'Rank 1: Nimble Deflection', description: '+1 bonus to avoid surprise accusations or verbal traps.' },
        { rank: 2, title: 'Rank 2: Pivot Instinct', description: 'Taking Composure damage grants +2 to your next offensive roll.' },
        { rank: 3, title: 'Rank 3: Fluid Ego', description: 'Reduce incoming psychic and mental shock damage by 1.' },
        { rank: 4, title: 'Rank 4: Untouchable Wit', description: 'Can roll Reflex to completely dodge incoming social attacks instead of taking damage.', addedEffect: 'Can dodge social attacks with Reflex' }
      ]
    },
    active: {
      id: 'act_san_reflex',
      branchType: 'ACTIVE',
      name: 'Rhetorical Side-Step',
      tagline: 'Changing the subject with such blinding speed that the accuser trips over their own feet.',
      ranks: [
        { rank: 1, title: 'Rank 1: Subject Change', cost: '1 Focus', range: 'Self', aoe: 'Self', description: 'Reaction: Side-step verbal attack, reducing Composure damage by 50%.' },
        { rank: 2, title: 'Rank 2: Kinetic Pivot', cost: '1 Focus', range: 'Self', aoe: 'Self', description: 'Completely dodge the attack and regain 2 Composure.' },
        { rank: 3, title: 'Rank 3: Confusion Cloud', cost: '1 Focus', range: '30 ft', aoe: 'Attacker', description: 'Dodge attack and leave the attacker confused (-2 to their next action).' },
        { rank: 4, title: 'Rank 4: Acrobatic Retraction', cost: '1 Focus', range: '30 ft', aoe: 'Attacker', description: 'Dodges incoming attack and forces attacker to publicly retract their statement.', addedEffect: 'Forces attacker to retract statement' }
      ]
    }
  },

  vitality: {
    stat: 'vitality',
    trackName: 'Hearth Keepsake & Bodily Warmth Track',
    flavor: 'Finding solace in cherished memories of home, good food, and the warmth of life.',
    specialization: createSocialArmorSpecializationBranch('vitality', 'Locket & Hearth Shawl'),
    passive: {
      id: 'pass_san_vitality',
      branchType: 'PASSIVE',
      name: 'Anchored in Love',
      tagline: 'A warm heart shielded by memories of home that cosmic void cannot extinguish.',
      ranks: [
        { rank: 1, title: 'Rank 1: Warm Hearth', description: '+1 bonus to Composure defense against loneliness and cold despair.' },
        { rank: 2, title: 'Rank 2: Cherished Memories', description: 'Composure recovers 50% faster while resting at a campfire or inn.' },
        { rank: 3, title: 'Rank 3: Blood-Bound Will', description: 'Gain +1 Composure DR when carrying a personal keepsake or family heirloom.' },
        { rank: 4, title: 'Rank 4: Eternal Sunlit Memory', description: 'Your Composure cannot be reduced below 1 by cosmic horror or eldritch dread.', addedEffect: 'Composure cannot drop below 1 from cosmic horror' }
      ]
    },
    active: {
      id: 'act_san_vitality',
      branchType: 'ACTIVE',
      name: 'Clasp Keepsake (Hearth Solace)',
      tagline: 'Touching a cherished locket or keepsake, bathing the soul in reassuring home warmth.',
      ranks: [
        { rank: 1, title: 'Rank 1: Touch Locket', cost: '1 Focus', range: 'Self', aoe: 'Self', description: 'Reaction: Clasp keepsake to negate 2 points of Composure trauma.' },
        { rank: 2, title: 'Rank 2: Memory of Home', cost: '1 Focus', range: 'Self', aoe: 'Self', description: 'Recovers 4 Composure immediately and soothes fear.' },
        { rank: 3, title: 'Rank 3: Shared Warmth', cost: '1 Focus', range: '15 ft aura', aoe: 'Allies in Aura', description: 'Restores 3 Composure to all adjacent companions.' },
        { rank: 4, title: 'Rank 4: Indomitable Hearthlight', cost: '1 Focus', range: '30 ft aura', aoe: 'Allies in Aura', description: 'Dispels all Panic, Terror, and Hallucinations from yourself and all allies in aura.', addedEffect: 'Cleanses all Panic and Terror in aura' }
      ]
    }
  },

  fortitude: {
    stat: 'fortitude',
    trackName: 'Granite Mind & Monastery Habit Track',
    flavor: 'Insulating thoughts behind leaden monastic stillness, treating madness like passing rain.',
    specialization: createSocialArmorSpecializationBranch('fortitude', 'Habit & Mind Torc'),
    passive: {
      id: 'pass_san_fortitude',
      branchType: 'PASSIVE',
      name: 'Cognitive Anchor',
      tagline: 'Turning your skull into a subterranean vault where eldritch echoes find no purchase.',
      ranks: [
        { rank: 1, title: 'Rank 1: Dense Thought', description: '+1 flat bonus to Composure defense against mind-breaking horrors.' },
        { rank: 2, title: 'Rank 2: Leaden Insulation', description: 'Take 1 less Composure damage from all psychic and magical scream attacks.' },
        { rank: 3, title: 'Rank 3: The Subterranean Vault', description: 'Immune to telepathic eavesdropping and psychic memory probing.' },
        { rank: 4, title: 'Rank 4: Absolute Mental Iron', description: 'Immune to all mind control, charm spells, and panic conditions.', addedEffect: 'Immune to Mind Control, Charm, and Panic' }
      ]
    },
    active: {
      id: 'act_san_fortitude',
      branchType: 'ACTIVE',
      name: 'Mental Bastion (Iron Vault)',
      tagline: 'Locking down cognitive faculties behind an impenetrable wall of granite resolve.',
      ranks: [
        { rank: 1, title: 'Rank 1: Vault Door Clang', cost: '1 Focus', range: 'Self', aoe: 'Self', description: 'Reaction: Reduce incoming psychic/Composure damage by 50%.' },
        { rank: 2, title: 'Rank 2: Stone Wall', cost: '1 Focus', range: 'Self', aoe: 'Self', description: 'Negate 100% of incoming Composure damage from 1 attack.' },
        { rank: 3, title: 'Rank 3: Heavy Inertia', cost: '1 Focus', range: 'Self', aoe: 'Self', description: 'Negates all Composure damage and restores 2 Composure to your pool.' },
        { rank: 4, title: 'Rank 4: Indomitable Monolith Bastion', cost: '1 Focus', range: 'Self (15 ft aura)', aoe: 'Self & Allies', description: 'Makes yourself and all allies completely immune to Composure damage for 1 round.', addedEffect: 'Aura of 100% Composure invulnerability for 1 round' }
      ]
    }
  },

  knowledge: {
    stat: 'knowledge',
    trackName: 'Empirical Demystification & Star-Weave Track',
    flavor: 'Analyzing monsters through taxonomies and physics, stripping terrors of their mystique.',
    specialization: createSocialArmorSpecializationBranch('knowledge', 'Magister Stole & Robe'),
    passive: {
      id: 'pass_san_knowledge',
      branchType: 'PASSIVE',
      name: 'Rational Shield',
      tagline: 'Understanding that monsters are merely biological specimens with predictable anatomies.',
      ranks: [
        { rank: 1, title: 'Rank 1: Taxonomy Defense', description: '+1 bonus to Sanity defense when identifying a beast\'s biological species.' },
        { rank: 2, title: 'Rank 2: Demystified Horror', description: 'Cosmic radiation and dragon omens deal 1 less Composure damage to you.' },
        { rank: 3, title: 'Rank 3: Empirical Stability', description: 'Gain +1 Composure DR when fighting or debating against documented enemies.' },
        { rank: 4, title: 'Rank 4: Master Archivist\'s Calm', description: 'Cannot suffer panic or confusion from reading eldritch tomes or unholy runes.', addedEffect: 'Immune to madness from eldritch tomes' }
      ]
    },
    active: {
      id: 'act_san_knowledge',
      branchType: 'ACTIVE',
      name: 'Clinical Demystification',
      tagline: 'Loudly reciting a beast\'s Latin anatomy and physical weaknesses, calming everyone down.',
      ranks: [
        { rank: 1, title: 'Rank 1: Anatomical Fact', cost: '1 Focus', range: 'Self', aoe: 'Self', description: 'Reaction: Recite facts to reduce incoming fear damage by 50%.' },
        { rank: 2, title: 'Rank 2: Lecture of Calm', cost: '1 Focus', range: 'Self', aoe: 'Self + 1 Ally', description: 'Calms yourself and an ally, restoring 3 Composure.' },
        { rank: 3, title: 'Rank 3: Deconstruct Superstition', cost: '1 Focus', range: '30 ft', aoe: 'Zone', description: 'Dispels superstition, restoring 3 Composure to all allies in zone.' },
        { rank: 4, title: 'Rank 4: Empirical Enlightenment', cost: '1 Focus', range: '45 ft', aoe: 'Zone', description: 'Reveals all enemy weaknesses, granting allies advantage on both attack and Composure defense.', addedEffect: 'Allies gain advantage on attacks and composure defense' }
      ]
    }
  },

  logic: {
    stat: 'logic',
    trackName: 'Fallacy Firewall & Socratic Stoic Track',
    flavor: 'Filtering emotional manipulation through cold, unyielding mathematical logic.',
    specialization: createSocialArmorSpecializationBranch('logic', 'Stoic Toga & Ear-Dampeners'),
    passive: {
      id: 'pass_san_logic',
      branchType: 'PASSIVE',
      name: 'Fallacy Firewall',
      tagline: 'Emotional appeals and guilt trips crash against your cognitive firewall like foam.',
      ranks: [
        { rank: 1, title: 'Rank 1: Cold Composure', description: '+2 bonus to Composure defense rolls against fear and panic.' },
        { rank: 2, title: 'Rank 2: Rational Shield', description: 'Take 1 less Composure damage from all psychological and social attacks.' },
        { rank: 3, title: 'Rank 3: Dispassionate Core', description: 'Gain +2 bonus on Composure defense against seduction, bribes, and charm.' },
        { rank: 4, title: 'Rank 4: Total Psychological Inertness', description: 'Take 0 Composure damage from all psychological and social attacks.', addedEffect: 'Immune to all mundane psychological damage' }
      ]
    },
    active: {
      id: 'act_san_logic',
      branchType: 'ACTIVE',
      name: 'Rational De-escalation (Cold Rebuttal)',
      tagline: 'Explaining dispassionately why the adversary\'s attack is mathematically pointless.',
      ranks: [
        { rank: 1, title: 'Rank 1: Point Out Fallacy', cost: '1 Focus', range: 'Self', aoe: 'Self', description: 'Reaction: Neutralize incoming social attack; reduce Composure damage by 50%.' },
        { rank: 2, title: 'Rank 2: Cold Rebuttal', cost: '1 Focus', range: '30 ft', aoe: 'Attacker', description: 'Completely negates Composure damage and deals 2 Composure damage back to attacker.' },
        { rank: 3, title: 'Rank 3: Deductive Reset', cost: '1 Focus', range: 'Self', aoe: 'Self', description: 'Restores 4 Composure and resets your tactical focus.' },
        { rank: 4, title: 'Rank 4: Absolute Rational Axiom', cost: '1 Focus', range: '45 ft', aoe: 'Attacker', description: 'Negates attack, deals 4 Composure damage, and stuns attacker for 1 turn.', addedEffect: 'Negates attack, deals 4 Composure damage & stuns' }
      ]
    }
  },

  awareness: {
    stat: 'awareness',
    trackName: 'Zen Vigilance & Sensory Filtering Track',
    flavor: 'Grounded sensory stillness that filters out psychic noise, panic, and disorienting light.',
    specialization: createSocialArmorSpecializationBranch('awareness', 'Veil & Scented Hood'),
    passive: {
      id: 'pass_san_awareness',
      branchType: 'PASSIVE',
      name: 'Sensory Filter',
      tagline: 'Filtering out the chaos and terrifying illusions of the blood moon Cruorbus.',
      ranks: [
        { rank: 1, title: 'Rank 1: Grounded Senses', description: '+1 bonus to Sanity defense against illusions, mirages, and phantom voices.' },
        { rank: 2, title: 'Rank 2: Unshakable Focus', description: 'Cannot be distracted or surprised in social conversations.' },
        { rank: 3, title: 'Rank 3: Calm Center', description: 'Gain +1 Composure DR in chaotic environments or during active combat.' },
        { rank: 4, title: 'Rank 4: True Perception', description: 'Completely immune to visual and auditory hallucinations.', addedEffect: 'Immune to hallucinations' }
      ]
    },
    active: {
      id: 'act_san_awareness',
      branchType: 'ACTIVE',
      name: 'Sensory Grounding (Breath of Stillness)',
      tagline: 'Focusing intensely on the texture of stone or the smell of pine, breaking the grip of terror.',
      ranks: [
        { rank: 1, title: 'Rank 1: Deep Inhale', cost: '1 Focus', range: 'Self', aoe: 'Self', description: 'Reaction: Ground senses to reduce fear/panic damage by 50%.' },
        { rank: 2, title: 'Rank 2: Sensory Stillness', cost: '1 Focus', range: 'Self', aoe: 'Self', description: 'Restores 3 Composure and clears mental disorientation.' },
        { rank: 3, title: 'Rank 3: Guided Calming', cost: '1 Focus', range: '15 ft', aoe: 'Self + 1 Ally', description: 'Grounds yourself and an ally, restoring 3 Composure to both.' },
        { rank: 4, title: 'Rank 4: Zone of Absolute Clarity', cost: '1 Focus', range: '30 ft aura', aoe: 'Allies in Aura', description: 'Creates an aura of absolute stillness; clears all confusion and fear for all allies.', addedEffect: 'Cleanses all fear and disorientation in aura' }
      ]
    }
  },

  intuition: {
    stat: 'intuition',
    trackName: 'Astral Anchor & Omen Transmutation Track',
    flavor: 'Surrendering to the cosmic river, turning eldritch dread into mystical insight.',
    specialization: createSocialArmorSpecializationBranch('intuition', 'Silver Cowl & Circlet'),
    passive: {
      id: 'pass_san_intuition',
      branchType: 'PASSIVE',
      name: 'Soul Anchor',
      tagline: 'Anchoring your soul to the leylines of Ostraka so cosmic rifts cannot rip it away.',
      ranks: [
        { rank: 1, title: 'Rank 1: Soul Anchor', description: '+2 bonus to Composure defense rolls against mind-breaking horrors.' },
        { rank: 2, title: 'Rank 2: Omen Transmutation', description: 'Suffering cosmic dread restores 1 Focus point.' },
        { rank: 3, title: 'Rank 3: Astral Bastion', description: 'Gain +1 Composure DR in areas with active Chaos radiation or Dragon Seals.' },
        { rank: 4, title: 'Rank 4: Transcendent Peace', description: 'Composure pool cannot be reduced below 1 by any spell or psychic attack.', addedEffect: 'Composure pool cannot drop below 1' }
      ]
    },
    active: {
      id: 'act_san_intuition',
      branchType: 'ACTIVE',
      name: 'Cruorbus Attunement (Sanity Transmutation)',
      tagline: 'Accepting the red moonlight of Cruorbus, transmuting cosmic terror into serene gnosis.',
      ranks: [
        { rank: 1, title: 'Rank 1: Attunement Ward', cost: '1 Focus', range: 'Self', aoe: 'Self', description: 'Reaction: Transmute incoming horror damage by 50%.' },
        { rank: 2, title: 'Rank 2: Gnostic Calm', cost: '1 Focus', range: 'Self', aoe: 'Self', description: 'Restores 4 Composure and grants insight into the source of the anomaly.' },
        { rank: 3, title: 'Rank 3: Cosmic Shield', cost: '1 Focus', range: '15 ft', aoe: 'Self + 1 Ally', description: 'Shields yourself and an ally from all sanity loss for 1 round.' },
        { rank: 4, title: 'Rank 4: Eclipse Serenity', cost: '1 Focus', range: '30 ft aura', aoe: 'Allies in Aura', description: 'Transmutes cosmic dread into raw focus; all allies regain 5 Composure and 2 Focus.', addedEffect: 'AoE +5 Composure & +2 Focus restoration' }
      ]
    }
  },

  charm: {
    stat: 'charm',
    trackName: 'Magnetic Poise & Disarming Grace Track',
    flavor: 'Disarming hostility with such overwhelming charm that attackers feel ashamed to speak harshly.',
    specialization: createSocialArmorSpecializationBranch('charm', 'Diplomatic Sash & Mask'),
    passive: {
      id: 'pass_san_charm',
      branchType: 'PASSIVE',
      name: 'Disarming Radiance',
      tagline: 'A warm, radiant grace that induces instinctive guilt in anyone seeking to humiliate you.',
      ranks: [
        { rank: 1, title: 'Rank 1: Gracious Bearing', description: '+1 bonus on Composure defense against insults and mockery.' },
        { rank: 2, title: 'Rank 2: Inspiring Aura', description: 'Allies within 15 ft gain +1 bonus on their Composure defense rolls.' },
        { rank: 3, title: 'Rank 3: Magnetic Shield', description: 'Gain +1 Composure DR when dressed in noble, courtier, or diplomatic attire.' },
        { rank: 4, title: 'Rank 4: Universal Beloved', description: 'Enemies who deal Composure damage to you suffer -1 disposition penalty from guilt.', addedEffect: 'Inflicts guilt and disposition loss on attacker' }
      ]
    },
    active: {
      id: 'act_san_charm',
      branchType: 'ACTIVE',
      name: 'Disarming Poise (The Gracious Smile)',
      tagline: 'Responding to raw hostility with genuine warmth, making the attacker look crude and foolish.',
      ranks: [
        { rank: 1, title: 'Rank 1: Gracious Smile', cost: '1 Focus', range: 'Self', aoe: 'Self', description: 'Reaction: Disarm hostile verbal attack; reduce Composure damage by 50%.' },
        { rank: 2, title: 'Rank 2: Reassuring Radiance', cost: '1 Focus', range: 'Self', aoe: 'Self', description: 'Restores 3 Composure and raises spectator opinion of you.' },
        { rank: 3, title: 'Rank 3: Disarming Warmth', cost: '1 Focus', range: '30 ft', aoe: 'Attacker', description: 'Negates attack and makes attacker apologize or backtrack on their words.' },
        { rank: 4, title: 'Rank 4: Overwhelming Empathy', cost: '1 Focus', range: '30 ft aura', aoe: 'All Foes in Aura', description: 'Completely disarms hostility; hostile foes drop their arguments and offer gifts/help.', addedEffect: 'Converts hostility into goodwill and concessions' }
      ]
    }
  },

  willpower: {
    stat: 'willpower',
    trackName: 'Iron Soul Ego & Martyr Shroud Track',
    flavor: 'A transcendent, fanatical certainty that regards physical and mental torture as utterly beneath notice.',
    specialization: createSocialArmorSpecializationBranch('willpower', 'Crown & Gorget'),
    passive: {
      id: 'pass_san_willpower',
      branchType: 'PASSIVE',
      name: 'Invulnerable Ego',
      tagline: 'Believing in your cause with such apocalyptic certainty that despair cannot enter.',
      ranks: [
        { rank: 1, title: 'Rank 1: Fanatical Conviction', description: '+1 flat bonus to all Composure defense rolls.' },
        { rank: 2, title: 'Rank 2: Martyr\'s Spite', description: 'Taking Composure damage grants +1 bonus damage on your next action.' },
        { rank: 3, title: 'Rank 3: Unbroken Soul', description: 'Gain +1 Composure DR against all magical, psychic, and occult trauma.' },
        { rank: 4, title: 'Rank 4: Sovereign Invulnerability', description: 'Cannot drop below 1 Composure for 2 combat rounds once per encounter.', addedEffect: 'Cannot drop below 1 Composure for 2 rounds' }
      ]
    },
    active: {
      id: 'act_san_willpower',
      branchType: 'ACTIVE',
      name: 'Soul Wall (Martyr Decree)',
      tagline: 'Planting your feet and declaring an absolute refusal to break, no matter what horrors appear.',
      ranks: [
        { rank: 1, title: 'Rank 1: Soul Wall', cost: '1 Focus', range: 'Self', aoe: 'Self', description: 'Reaction: Fortify mind; reduce incoming psychic/Composure damage by 50%.' },
        { rank: 2, title: 'Rank 2: Unbending Decree', cost: '1 Focus', range: 'Self', aoe: 'Self', description: 'Negate 100% of incoming Composure damage from 1 attack.' },
        { rank: 3, title: 'Rank 3: Shared Bastion', cost: '1 Focus', range: '30 ft', aoe: 'Self & Adjacent Allies', description: 'Extend 100% Composure protection to all adjacent allies in zone.' },
        { rank: 4, title: 'Rank 4: Indomitable Soul Decree', cost: '1 Focus', range: 'Self', aoe: 'Self', description: 'Instantly restores full Composure and grants total immunity to mental trauma for 2 turns.', addedEffect: 'Restores full Composure and grants 2 turns of invulnerability' }
      ]
    }
  }
};
