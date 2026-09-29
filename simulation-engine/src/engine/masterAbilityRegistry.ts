export interface MasterAbilityEntry {
  attribute: string;
  archetypeFlavor: string;
  magicPower: {
    name: string;
    description: string;
    resourceCost: number; // Focus
  };
  nullAlternative: {
    name: string;
    description: string;
    resourceCost: number; // Stamina or Focus
  };
  offensiveSkill: {
    name: string;
    basicAbilityName: string;
    mechanic: string;
  };
  defensiveSkill: {
    name: string;
    basicAbilityName: string;
    mechanic: string;
  };
}

export const MASTER_ABILITY_REGISTRY: Record<string, MasterAbilityEntry> = {
  might: {
    attribute: 'Might',
    archetypeFlavor: 'The Berserker / Juggernaut',
    magicPower: {
      name: 'Mass Acceleration',
      description: 'Channels raw gravitational weight into a target, crushing structural integrity or hurl-launching opponents.',
      resourceCost: 10
    },
    nullAlternative: {
      name: 'Kinetically Optimized Leverage',
      description: 'Momentarily exempts the body from standard resistance thresholds, allowing supernatural lifting and striking force without aether.',
      resourceCost: 8
    },
    offensiveSkill: {
      name: 'Shattering Strike',
      basicAbilityName: 'Armor-Crack Cleave',
      mechanic: 'Deals heavy structural degradation or bypasses flat armor reduction on a successful contested might check.'
    },
    defensiveSkill: {
      name: 'Bracing Wall',
      basicAbilityName: 'Immovable Root',
      mechanic: 'Drops center of gravity and locks skeletal mass to absorb heavy kinetic impact, reducing graze damage.'
    }
  },
  endurance: {
    attribute: 'Endurance',
    archetypeFlavor: 'The Vanguard / Survivalist',
    magicPower: {
      name: 'Flux Resilience',
      description: 'Infuses cellular structure with a steady aetheric current to shrug off environmental decay and fatigue.',
      resourceCost: 10
    },
    nullAlternative: {
      name: 'Metabolic Lockdown',
      description: 'Briefly exempts the nervous system from pain and oxygen fatigue, sustaining maximum output past natural limits.',
      resourceCost: 8
    },
    offensiveSkill: {
      name: 'Attrition Press',
      basicAbilityName: 'Grinding Advance',
      mechanic: 'Sustains relentless pressure over multiple turns to drain target stamina reserves.'
    },
    defensiveSkill: {
      name: 'Iron Lungs',
      basicAbilityName: 'Second Wind Regulation',
      mechanic: 'Shrugs off oxygen deprivation and combat exhaustion penalties.'
    }
  },
  finesse: {
    attribute: 'Finesse',
    archetypeFlavor: 'The Duelist / Rogue',
    magicPower: {
      name: 'Motus Blur',
      description: 'Bends light and micro-currents around limbs to warp strike trajectories into impossible angles.',
      resourceCost: 10
    },
    nullAlternative: {
      name: 'Vascular Precision',
      description: 'Exempts specific muscle groups from drag and friction equations to execute instantaneous microscopic adjustments.',
      resourceCost: 8
    },
    offensiveSkill: {
      name: 'Vitals Stitch',
      basicAbilityName: 'Gap-Seeking Lunge',
      mechanic: 'Targets micro-gaps in armor to guarantee at least minor injury severity on a hit.'
    },
    defensiveSkill: {
      name: 'Parry Riposte',
      basicAbilityName: 'Minimalist Deflection',
      mechanic: 'Uses absolute blade control to redirect incoming kinetic energy away from the body.'
    }
  },
  reflex: {
    attribute: 'Reflex',
    archetypeFlavor: 'The Swashbuckler / Tempest',
    magicPower: {
      name: 'Temporal Flash',
      description: 'Compresses local time vectors around the body to dodge incoming disasters with supernatural speed.',
      resourceCost: 12
    },
    nullAlternative: {
      name: 'Predatory Twitch',
      description: 'Temporarily drops neurological latency, allowing the body to react before conscious thought processes the signal.',
      resourceCost: 8
    },
    offensiveSkill: {
      name: 'Lightning Lunge',
      basicAbilityName: 'Hair-Trigger Strike',
      mechanic: 'Snaps forward to execute attacks before slower opponents complete their move actions.'
    },
    defensiveSkill: {
      name: 'Evasive Scuttle',
      basicAbilityName: 'Flash-Step Dodge',
      mechanic: 'Instantly bursts out of immediate threat vectors and AoE zones.'
    }
  },
  vitality: {
    attribute: 'Vitality',
    archetypeFlavor: 'The Bruiser / Blood-Knight',
    magicPower: {
      name: 'Vita Infusion',
      description: 'Draws ambient life-force to knit torn flesh and seal bleeding wounds mid-combat.',
      resourceCost: 14
    },
    nullAlternative: {
      name: 'Cellular Hardiness',
      description: 'Exempts biological tissue from shock trauma, instantly hardening scar matrix and sealing capillaries.',
      resourceCost: 10
    },
    offensiveSkill: {
      name: 'Crushing Momentum',
      basicAbilityName: 'Unstoppable Charge',
      mechanic: 'Barrels through counter-attacks by converting forward body weight into a battering ram.'
    },
    defensiveSkill: {
      name: 'Somatic Shield',
      basicAbilityName: 'Organ Shift',
      mechanic: 'Absorbs severe trauma into thick non-vital muscle tissue.'
    }
  },
  fortitude: {
    attribute: 'Fortitude',
    archetypeFlavor: 'The Bastion / Tank',
    magicPower: {
      name: 'Lex Bastion',
      description: 'Hardens the physical form into an absolute, unyielding physical law that resists displacement.',
      resourceCost: 12
    },
    nullAlternative: {
      name: 'Unshakable Frame',
      description: 'Temporarily exempts skeletal structure from knockback and destabilization physics.',
      resourceCost: 9
    },
    offensiveSkill: {
      name: 'Bulwark Smash',
      basicAbilityName: 'Shield-Barge Slam',
      mechanic: 'Uses heavy physical mass to knock an opposing combatant prone or backward.'
    },
    defensiveSkill: {
      name: 'Impenetrable Stance',
      basicAbilityName: 'Anvil Posture',
      mechanic: 'Completely negates critical severity upgrades during contested defense rolls.'
    }
  },
  knowledge: {
    attribute: 'Knowledge',
    archetypeFlavor: 'The Tactician / Strategist',
    magicPower: {
      name: 'Anuminus Calculation',
      description: 'Computes cosmic leyline equations in real-time to expose structural flaws in targets.',
      resourceCost: 10
    },
    nullAlternative: {
      name: 'Tactical Encyclopedia',
      description: 'Instantly matches combat patterns against historical databases to predict enemy weak points.',
      resourceCost: 8
    },
    offensiveSkill: {
      name: 'Exploit Weakness',
      basicAbilityName: 'Anatomical Analysis',
      mechanic: 'Bypasses specific defense thresholds on the next strike by studying enemy armor construction.'
    },
    defensiveSkill: {
      name: 'Predictive Evasion',
      basicAbilityName: 'Vector Calculation',
      mechanic: 'Computes attack trajectories instantly to step out of harm\'s way before impact.'
    }
  },
  logic: {
    attribute: 'Logic',
    archetypeFlavor: 'The Inquisitor / Sage',
    magicPower: {
      name: 'Ratio Lattice',
      description: 'Weaves pure mathematical constructs to counter and dismantle chaotic aetheric disruptions.',
      resourceCost: 10
    },
    nullAlternative: {
      name: 'Cold Rationalization',
      description: 'Exempts the mind from emotional bias, panic, and social manipulation vectors.',
      resourceCost: 8
    },
    offensiveSkill: {
      name: 'Socratic Demolition',
      basicAbilityName: 'Logical Debunk',
      mechanic: 'Deals direct Composure damage by dismantling an opponent\'s combat strategy.'
    },
    defensiveSkill: {
      name: 'Fallacy Firewall',
      basicAbilityName: 'Rational Rebuttal',
      mechanic: 'Neutralizes incoming social manipulation and psychological pressure.'
    }
  },
  awareness: {
    attribute: 'Awareness',
    archetypeFlavor: 'The Ranger / Scout',
    magicPower: {
      name: 'Omen Sight',
      description: 'Peers slightly into alternate probabilities to detect hidden traps and incoming ambushes.',
      resourceCost: 10
    },
    nullAlternative: {
      name: 'Hyper-Vigilance',
      description: 'Exempts sensory processing limits, scanning micro-environmental air shifts and shadows instantly.',
      resourceCost: 8
    },
    offensiveSkill: {
      name: 'Ambush Strike',
      basicAbilityName: 'Shadow Strike',
      mechanic: 'Gains automatic advantage on attack rolls against unalerted targets.'
    },
    defensiveSkill: {
      name: 'Danger Sense',
      basicAbilityName: 'Pre-emptive Alert',
      mechanic: 'Completely prevents surprise rounds and ambush modifiers.'
    }
  },
  intuition: {
    attribute: 'Intuition',
    archetypeFlavor: 'The Mystic / Blade-Dancer',
    magicPower: {
      name: 'Aura Resonance',
      description: 'Senses the emotional currents and hidden motivations of living beings in the vicinity.',
      resourceCost: 10
    },
    nullAlternative: {
      name: 'Gut Read',
      description: 'Instinctively reads muscle micro-twitches and intent before physical execution occurs.',
      resourceCost: 8
    },
    offensiveSkill: {
      name: 'Feinting Ripple',
      basicAbilityName: 'Deceptive Tell',
      mechanic: 'Forces defender to commit to the wrong tactical prediction during a clash tie.'
    },
    defensiveSkill: {
      name: 'Instinctive Duck',
      basicAbilityName: 'Subconscious Sway',
      mechanic: 'Dodges attacks based purely on somatic reading a split-second before impact.'
    }
  },
  charm: {
    attribute: 'Charm',
    archetypeFlavor: 'The Bard / Diplomat',
    magicPower: {
      name: 'Lux Fascination',
      description: 'Emits a captivating aetheric glow that softens hostility and commands attention.',
      resourceCost: 10
    },
    nullAlternative: {
      name: 'Magnetic Presence',
      description: 'Raw social dominance and posture that compels psychological deference.',
      resourceCost: 8
    },
    offensiveSkill: {
      name: 'Disarming Oration',
      basicAbilityName: 'Commanding Rebuke',
      mechanic: 'Temporarily reduces target offensive modifier through social dominance.'
    },
    defensiveSkill: {
      name: 'Social Redirection',
      basicAbilityName: 'Attention Shift',
      mechanic: 'Smoothly diverts hostile focus onto alternative targets in the encounter.'
    }
  },
  willpower: {
    attribute: 'Willpower',
    archetypeFlavor: 'The Zealot / Iron-Will',
    magicPower: {
      name: 'Nexes Absolute',
      description: 'Bends reality through sheer unyielding mental fortitude and absolute decree.',
      resourceCost: 12
    },
    nullAlternative: {
      name: 'Iron Resolve',
      description: 'Completely exempts the psyche from fear, psychological breaking points, and trauma.',
      resourceCost: 9
    },
    offensiveSkill: {
      name: 'Overbearing Aura',
      basicAbilityName: 'Psychological Weight',
      mechanic: 'Inflicts hesitation and mental strain on opposing targets.'
    },
    defensiveSkill: {
      name: 'Mental Fortitude',
      basicAbilityName: 'Mind Bastion',
      mechanic: 'Absorbs Composure damage and resists panic conditions.'
    }
  }
};

