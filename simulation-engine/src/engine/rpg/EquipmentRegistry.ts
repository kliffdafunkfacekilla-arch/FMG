/**
 * 12-STAT WEAPON & ARMOR GROUP REGISTRY
 * =====================================
 * In the Ostraka RPG system, every weapon and armor piece is attuned to one of
 * the 12 primary stats (6 Body, 6 Mind). Combat checks roll the weapon's stat
 * on offense against the defender's armor stat on defense.
 */

export type StatKey =
  | 'might'
  | 'endurance'
  | 'finesse'
  | 'reflex'
  | 'vitality'
  | 'fortitude'
  | 'knowledge'
  | 'logic'
  | 'awareness'
  | 'intuition'
  | 'charm'
  | 'willpower';

export interface WeaponDef {
  id: string;
  name: string;
  stat: StatKey;
  mod: number; // Attack roll modifier (+1, +2, +3)
  damageBonus: number;
  conductorMetal: string;
  tags: string[];
  description: string;
}

export interface ArmorDef {
  id: string;
  name: string;
  stat: StatKey;
  mod: number; // Defense roll modifier (+1, +2, +3)
  damageReduction: number;
  conductorMetal: string;
  tags: string[];
  description: string;
}

export const STAT_WEAPON_GROUPS: Record<StatKey, WeaponDef[]> = {
  might: [
    {
      id: "w_might_greatsword",
      name: "Osmium Greatsword",
      stat: "might",
      mod: 2,
      damageBonus: 2,
      conductorMetal: "Osmium",
      tags: ["metal", "cut", "slashing", "heavy", "cleaving"],
      description: "A colossal blade forged of dense bluish Osmium. Delivers devastating cleaving blows using pure mass."
    },
    {
      id: "w_might_warhammer",
      name: "Flanged Warhammer",
      stat: "might",
      mod: 2,
      damageBonus: 2,
      conductorMetal: "Osmium",
      tags: ["metal", "bludgeon", "heavy", "crushing"],
      description: "A heavy impact hammer designed to buckle plate armor and shatter bone."
    },
    {
      id: "w_might_greataxe",
      name: "Greataxe of Mass",
      stat: "might",
      mod: 2,
      damageBonus: 3,
      conductorMetal: "Osmium",
      tags: ["metal", "cut", "heavy", "severing"],
      description: "A wide-bearded two-handed battle axe with an over-weighted wedge."
    },
    {
      id: "w_might_maul",
      name: "Colossal Maul",
      stat: "might",
      mod: 3,
      damageBonus: 3,
      conductorMetal: "Osmium",
      tags: ["metal", "bludgeon", "heavy", "crushing", "slow"],
      description: "A siege-grade iron maul capable of shattering barricades and splintering shields."
    }
  ],

  endurance: [
    {
      id: "w_endurance_spear",
      name: "Titanium Bastion Spear",
      stat: "endurance",
      mod: 2,
      damageBonus: 1,
      conductorMetal: "Titanium",
      tags: ["metal", "pierce", "reach", "rigid"],
      description: "An unyielding spear tipped with cold Titanium, favored by phalanx wardens."
    },
    {
      id: "w_endurance_shield",
      name: "Spiked Tower Shield",
      stat: "endurance",
      mod: 1,
      damageBonus: 1,
      conductorMetal: "Titanium",
      tags: ["metal", "wood", "bludgeon", "cover_heavy"],
      description: "A massive shield that doubles as an offensive bashing implement."
    },
    {
      id: "w_endurance_halberd",
      name: "Heavy Field Halberd",
      stat: "endurance",
      mod: 2,
      damageBonus: 2,
      conductorMetal: "Titanium",
      tags: ["metal", "wood", "cut", "pierce", "reach"],
      description: "A stalwart polearm built for long-duration skirmishing and holding ground."
    },
    {
      id: "w_endurance_flail",
      name: "Glacial Iron Flail",
      stat: "endurance",
      mod: 2,
      damageBonus: 2,
      conductorMetal: "Titanium",
      tags: ["metal", "bludgeon", "cold", "chain"],
      description: "A heavy chained flail coated in chilled alloy that drains stamina on impact."
    }
  ],

  finesse: [
    {
      id: "w_finesse_rapier",
      name: "Gilded Duelist Rapier",
      stat: "finesse",
      mod: 2,
      damageBonus: 1,
      conductorMetal: "Gold",
      tags: ["metal", "pierce", "parrying", "finesse"],
      description: "A flexible, acid-etched rapier crafted for surgical thrusts through armor gaps."
    },
    {
      id: "w_finesse_stiletto",
      name: "Stiletto Dagger",
      stat: "finesse",
      mod: 2,
      damageBonus: 1,
      conductorMetal: "Gold",
      tags: ["metal", "pierce", "pointed", "light"],
      description: "A razor-slender blade designed for piercing vital organs with millimeter precision."
    },
    {
      id: "w_finesse_saber",
      name: "Dueling Saber",
      stat: "finesse",
      mod: 2,
      damageBonus: 2,
      conductorMetal: "Gold",
      tags: ["metal", "cut", "slashing", "fast"],
      description: "A single-edged curved blade with exquisite balance for lightning counter-attacks."
    },
    {
      id: "w_finesse_main_gauche",
      name: "Main-Gauche Parrying Blade",
      stat: "finesse",
      mod: 1,
      damageBonus: 1,
      conductorMetal: "Gold",
      tags: ["metal", "pierce", "parrying", "light"],
      description: "A quilled dagger with heavy protective ring guards to deflect enemy strikes."
    }
  ],

  reflex: [
    {
      id: "w_reflex_shortbow",
      name: "Recurve Shortbow",
      stat: "reflex",
      mod: 2,
      damageBonus: 2,
      conductorMetal: "Lead",
      tags: ["wood", "pierce", "ranged", "fast"],
      description: "A high-tension composite shortbow built for rapid firing on the run."
    },
    {
      id: "w_reflex_throwing_daggers",
      name: "Balanced Throwing Knives",
      stat: "reflex",
      mod: 1,
      damageBonus: 1,
      conductorMetal: "Lead",
      tags: ["metal", "pierce", "ranged", "light"],
      description: "A set of aerodynamic knives weighted with lead for quick snapshot throws."
    },
    {
      id: "w_reflex_falchion",
      name: "Quick-Draw Shortsword",
      stat: "reflex",
      mod: 2,
      damageBonus: 1,
      conductorMetal: "Lead",
      tags: ["metal", "cut", "slashing", "fast"],
      description: "A broad, compact cutting sword designed to be drawn and struck in a single heartbeat."
    },
    {
      id: "w_reflex_sling",
      name: "Lead-Shot Resonator Sling",
      stat: "reflex",
      mod: 1,
      damageBonus: 1,
      conductorMetal: "Lead",
      tags: ["leather", "bludgeon", "ranged", "sonic"],
      description: "A reinforced sling hurling vibrating lead bullets that emit concussive sound on impact."
    }
  ],

  vitality: [
    {
      id: "w_vitality_cleaver",
      name: "Silver Butcher Cleaver",
      stat: "vitality",
      mod: 2,
      damageBonus: 2,
      conductorMetal: "Silver",
      tags: ["metal", "cut", "slashing", "meat"],
      description: "A heavy, silver-lined cleaver built for rendering flesh and harvesting organic conduits."
    },
    {
      id: "w_vitality_cestus",
      name: "Spiked Blood-Cestus",
      stat: "vitality",
      mod: 1,
      damageBonus: 1,
      conductorMetal: "Silver",
      tags: ["metal", "leather", "bludgeon", "sharp"],
      description: "Reinforced knuckle wraps studded with silver quills that channel bodily vigor."
    },
    {
      id: "w_vitality_scythe",
      name: "Reaping Bone Scythe",
      stat: "vitality",
      mod: 2,
      damageBonus: 2,
      conductorMetal: "Silver",
      tags: ["bone", "cut", "organic", "reach"],
      description: "A curved harvesting blade fashioned from calcified beast ribs and moon-silver."
    },
    {
      id: "w_vitality_blood_hook",
      name: "Silvered Blood-Hook",
      stat: "vitality",
      mod: 2,
      damageBonus: 1,
      conductorMetal: "Silver",
      tags: ["metal", "pierce", "curved", "hook"],
      description: "A vicious barbed hook that tears tissue and siphons vitality during close combat."
    }
  ],

  fortitude: [
    {
      id: "w_fortitude_cudgel",
      name: "Tungsten Weighted Cudgel",
      stat: "fortitude",
      mod: 2,
      damageBonus: 2,
      conductorMetal: "Tungsten",
      tags: ["metal", "bludgeon", "heavy", "thermal"],
      description: "An unbendable tungsten cudgel that can absorb extreme thermal and kinetic shock."
    },
    {
      id: "w_fortitude_spade",
      name: "Entrenching Trench Spade",
      stat: "fortitude",
      mod: 1,
      damageBonus: 1,
      conductorMetal: "Tungsten",
      tags: ["metal", "wood", "cut", "bludgeon"],
      description: "A heavy, sharpened field spade built for digging defensive earthworks and smashing skulls."
    },
    {
      id: "w_fortitude_pike",
      name: "Barricade Heavy Pike",
      stat: "fortitude",
      mod: 2,
      damageBonus: 2,
      conductorMetal: "Tungsten",
      tags: ["wood", "metal", "pierce", "brace"],
      description: "A reinforced spear designed to brace against charging monstrosities without snapping."
    },
    {
      id: "w_fortitude_mace",
      name: "Fire-Hardened Iron Mace",
      stat: "fortitude",
      mod: 2,
      damageBonus: 2,
      conductorMetal: "Tungsten",
      tags: ["metal", "bludgeon", "burning", "igniting"],
      description: "A glowing, heat-tempered mace that sears wounds shut upon brutal impact."
    }
  ],

  knowledge: [
    {
      id: "w_knowledge_acid_flask",
      name: "Alchemical Acid Flasks",
      stat: "knowledge",
      mod: 2,
      damageBonus: 2,
      conductorMetal: "Bismuth",
      tags: ["glass", "acid", "ranged", "corrosive"],
      description: "Volatile glass ampoules of caustic reagent, thrown with calculated anatomical aim."
    },
    {
      id: "w_knowledge_scalpel",
      name: "Anatomical Scalpel Set",
      stat: "knowledge",
      mod: 2,
      damageBonus: 1,
      conductorMetal: "Bismuth",
      tags: ["metal", "pierce", "pointed", "precision"],
      description: "Surgical steel instruments balanced for striking major arteries identified through study."
    },
    {
      id: "w_knowledge_staff",
      name: "Bismuth Runic Focus Staff",
      stat: "knowledge",
      mod: 2,
      damageBonus: 2,
      conductorMetal: "Bismuth",
      tags: ["metal", "magic_focus", "arcane", "reach"],
      description: "An iridescent staff tipped with crystalline bismuth that focuses theoretical equations into force."
    },
    {
      id: "w_knowledge_crossbow",
      name: "Calibrated Clockwork Crossbow",
      stat: "knowledge",
      mod: 2,
      damageBonus: 2,
      conductorMetal: "Bismuth",
      tags: ["metal", "brass", "ranged", "precision"],
      description: "A mechanical crossbow fitted with dial verniers to calculate windage and trajectory."
    }
  ],

  logic: [
    {
      id: "w_logic_shock_lance",
      name: "Silicon Shock-Lance",
      stat: "logic",
      mod: 2,
      damageBonus: 2,
      conductorMetal: "Silicon",
      tags: ["metal", "electric", "conductive_arc", "reach"],
      description: "A semiconductor polearm that discharges calibrated electrical surges into weak points."
    },
    {
      id: "w_logic_arbalest",
      name: "Repeating Mechanism Arbalest",
      stat: "logic",
      mod: 2,
      damageBonus: 2,
      conductorMetal: "Silicon",
      tags: ["metal", "brass", "ranged", "repeating"],
      description: "A geared repeating arbalest cycling bolts with clockwork predictability."
    },
    {
      id: "w_logic_stiletto",
      name: "Spring-Blade Geometry Stiletto",
      stat: "logic",
      mod: 2,
      damageBonus: 1,
      conductorMetal: "Silicon",
      tags: ["metal", "pierce", "mechanical", "fast"],
      description: "A mechanical dagger that snaps forward upon release to strike mathematically optimal angles."
    },
    {
      id: "w_logic_flail",
      name: "Calibrated Pendulum Flail",
      stat: "logic",
      mod: 2,
      damageBonus: 2,
      conductorMetal: "Silicon",
      tags: ["metal", "bludgeon", "shock", "precision"],
      description: "A counterbalance flail whose swing velocity is calculated to maximize rotational momentum."
    }
  ],

  awareness: [
    {
      id: "w_awareness_longbow",
      name: "Chromium Composite Longbow",
      stat: "awareness",
      mod: 2,
      damageBonus: 2,
      conductorMetal: "Chromium",
      tags: ["wood", "metal", "pierce", "ranged", "sniper"],
      description: "A mirrored longbow that leverages acute vision to pick off distant targets before they see you."
    },
    {
      id: "w_awareness_heavy_crossbow",
      name: "Sniper Heavy Crossbow",
      stat: "awareness",
      mod: 3,
      damageBonus: 3,
      conductorMetal: "Chromium",
      tags: ["wood", "metal", "pierce", "ranged", "armor_pierce"],
      description: "A heavy winch crossbow designed to exploit distant cover vulnerabilities spotted across the field."
    },
    {
      id: "w_awareness_javelin",
      name: "Hunting Barbed Javelin",
      stat: "awareness",
      mod: 2,
      damageBonus: 2,
      conductorMetal: "Chromium",
      tags: ["wood", "metal", "pierce", "ranged", "thrown"],
      description: "A balanced throwing spear with radiant flukes that track quarry through dim wilderness."
    },
    {
      id: "w_awareness_harpoon",
      name: "Barbed Scout Harpoon",
      stat: "awareness",
      mod: 2,
      damageBonus: 1,
      conductorMetal: "Chromium",
      tags: ["metal", "pierce", "sharp", "reach"],
      description: "A tethered steel harpoon designed to pin moving targets tracked through brush."
    }
  ],

  intuition: [
    {
      id: "w_intuition_dowsing_rod",
      name: "Iridium Shamanic Dowsing Rod",
      stat: "intuition",
      mod: 2,
      damageBonus: 1,
      conductorMetal: "Iridium",
      tags: ["metal", "magic_focus", "temporal", "mystic"],
      description: "A violet-glowing rod that twitches toward imminent threats and weaves instinctual strikes."
    },
    {
      id: "w_intuition_kris",
      name: "Spirit-Warped Kris",
      stat: "intuition",
      mod: 2,
      damageBonus: 2,
      conductorMetal: "Iridium",
      tags: ["metal", "pierce", "curved", "phase_shifted"],
      description: "A wavy serpentine blade that seems to strike a fraction of a second before it lands."
    },
    {
      id: "w_intuition_staff",
      name: "Mystic Divination Quarterstaff",
      stat: "intuition",
      mod: 1,
      damageBonus: 1,
      conductorMetal: "Iridium",
      tags: ["wood", "bludgeon", "magic_focus", "reach"],
      description: "A gnarled hardwood staff that guides the wielder's arm through gut premonitions."
    },
    {
      id: "w_intuition_sickle",
      name: "Omen Sickle",
      stat: "intuition",
      mod: 2,
      damageBonus: 2,
      conductorMetal: "Iridium",
      tags: ["metal", "cut", "slashing", "temporal"],
      description: "A ceremonial crescent blade that severs threads of fate during instinctual clashes."
    }
  ],

  charm: [
    {
      id: "w_charm_foil",
      name: "Ornate Courtier Foil",
      stat: "charm",
      mod: 2,
      damageBonus: 1,
      conductorMetal: "Phosphorus",
      tags: ["metal", "pierce", "ornate", "finesse"],
      description: "A sparkling, phosphorus-inlaid fencing blade that entrances onlookers while slipping past guards."
    },
    {
      id: "w_charm_fan_blade",
      name: "Concealed Fan Blades",
      stat: "charm",
      mod: 1,
      damageBonus: 1,
      conductorMetal: "Phosphorus",
      tags: ["metal", "cut", "concealed", "light"],
      description: "A decorative courtly folding fan hiding razor-sharp steel ribs behind painted silk."
    },
    {
      id: "w_charm_silver_tongue",
      name: "Silver-Tongue Stiletto",
      stat: "charm",
      mod: 2,
      damageBonus: 2,
      conductorMetal: "Phosphorus",
      tags: ["metal", "silver", "pierce", "fast"],
      description: "A weapon carried by master diplomats, designed to strike while smiling."
    },
    {
      id: "w_charm_whip",
      name: "Thorned Rose Whip",
      stat: "charm",
      mod: 1,
      damageBonus: 1,
      conductorMetal: "Phosphorus",
      tags: ["leather", "organic", "slashing", "reach"],
      description: "A supple braided whip studded with perfume-scented barbs that disarm opponents."
    }
  ],

  willpower: [
    {
      id: "w_willpower_flail",
      name: "Lithium Inquisitor Flail",
      stat: "willpower",
      mod: 2,
      damageBonus: 2,
      conductorMetal: "Lithium",
      tags: ["metal", "bludgeon", "chain", "psychic"],
      description: "A punishing chained weapon forged of ultra-light reactive Lithium that breaks minds and wills."
    },
    {
      id: "w_willpower_censer_mace",
      name: "Holy Censer Mace",
      stat: "willpower",
      mod: 2,
      damageBonus: 2,
      conductorMetal: "Lithium",
      tags: ["metal", "bludgeon", "smoke", "fire", "holy"],
      description: "A perforated mace smoking with sacred resins that burns with the wielder's righteous resolve."
    },
    {
      id: "w_willpower_executioner_blade",
      name: "Zealot Executioner Blade",
      stat: "willpower",
      mod: 3,
      damageBonus: 3,
      conductorMetal: "Lithium",
      tags: ["metal", "cut", "slashing", "heavy", "cleaving"],
      description: "A flat-tipped greatsword inscribed with sacred litanies, swinging with fanatical certainty."
    },
    {
      id: "w_willpower_brand",
      name: "Penitent Iron Brand",
      stat: "willpower",
      mod: 1,
      damageBonus: 1,
      conductorMetal: "Lithium",
      tags: ["metal", "fire", "igniting", "branded"],
      description: "A searing brand used to imprint mental dominance and scorch heretics in close quarters."
    }
  ]
};

export const STAT_ARMOR_GROUPS: Record<StatKey, ArmorDef[]> = {
  might: [
    {
      id: "a_might_juggernaut",
      name: "Juggernaut Osmium Plate",
      stat: "might",
      mod: 3,
      damageReduction: 3,
      conductorMetal: "Osmium",
      tags: ["metal", "heavy_plate", "protective", "dense"],
      description: "Tremendous interlocking plates of Osmium. Requires immense brute strength to bear, turning aside siege blows."
    },
    {
      id: "a_might_carapace",
      name: "Spiked Iron Carapace",
      stat: "might",
      mod: 2,
      damageReduction: 2,
      conductorMetal: "Osmium",
      tags: ["metal", "heavy_plate", "sharp", "deflective"],
      description: "Barbed heavy armor that punishes any attacker foolish enough to close in."
    },
    {
      id: "a_might_stone_mail",
      name: "Brawler Stone-Mail",
      stat: "might",
      mod: 2,
      damageReduction: 1,
      conductorMetal: "Osmium",
      tags: ["stone", "heavy", "protective"],
      description: "Heavy granite scales riveted onto thick leather, absorbing crushing momentum."
    }
  ],

  endurance: [
    {
      id: "a_endurance_bulwark",
      name: "Titanium Bulwark Plate",
      stat: "endurance",
      mod: 3,
      damageReduction: 3,
      conductorMetal: "Titanium",
      tags: ["metal", "heavy_plate", "unyielding", "cold_resistant"],
      description: "Rigid full plate forged with cold Titanium alloy, allowing the wearer to outlast any siege."
    },
    {
      id: "a_endurance_field_harness",
      name: "Reinforced Field Harness",
      stat: "endurance",
      mod: 2,
      damageReduction: 2,
      conductorMetal: "Titanium",
      tags: ["metal", "leather", "rigid", "protective"],
      description: "A solid field harness designed for days of continuous marching without fatigue."
    },
    {
      id: "a_endurance_tortoise",
      name: "Tortoise Shell Hauberk",
      stat: "endurance",
      mod: 2,
      damageReduction: 1,
      conductorMetal: "Titanium",
      tags: ["organic", "dense", "protective", "heavy"],
      description: "Layered natural bone plates capable of deflecting missile barrages indefinitely."
    }
  ],

  finesse: [
    {
      id: "a_finesse_gambeson",
      name: "Duelist Quilted Gambeson",
      stat: "finesse",
      mod: 2,
      damageReduction: 1,
      conductorMetal: "Gold",
      tags: ["cloth", "flexible", "light", "finesse"],
      description: "High-thread linen and silk quilted in geometric lines, allowing complete fencing agility."
    },
    {
      id: "a_finesse_doublet",
      name: "Gilded Leather Doublet",
      stat: "finesse",
      mod: 2,
      damageReduction: 2,
      conductorMetal: "Gold",
      tags: ["leather", "flexible", "conductive", "light"],
      description: "Supple tanned calfskin overlaid with gold foil to slip aside slashing edges."
    },
    {
      id: "a_finesse_shadow_tunic",
      name: "Shadow-Silk Tunic",
      stat: "finesse",
      mod: 1,
      damageReduction: 1,
      conductorMetal: "Gold",
      tags: ["cloth", "silent", "flexible", "light"],
      description: "Ultralight dark silk that produces zero rustle while maneuvering through tight melee."
    }
  ],

  reflex: [
    {
      id: "a_reflex_jerkin",
      name: "Wind-Runner Leather Jerkin",
      stat: "reflex",
      mod: 2,
      damageReduction: 1,
      conductorMetal: "Lead",
      tags: ["leather", "flexible", "light", "fast"],
      description: "A snug scout jerkin shaped to facilitate acrobatics, diving rolls, and rapid ducking."
    },
    {
      id: "a_reflex_bracers",
      name: "Acrobatic Shin-Guards & Bracers",
      stat: "reflex",
      mod: 1,
      damageReduction: 1,
      conductorMetal: "Lead",
      tags: ["leather", "metal", "light", "nimble"],
      description: "Segmented limb armor that guards the extremities without encumbering reaction speed."
    },
    {
      id: "a_reflex_motus",
      name: "Motus Feathered Vest",
      stat: "reflex",
      mod: 1,
      damageReduction: 1,
      conductorMetal: "Lead",
      tags: ["organic", "light", "sonic_dampening"],
      description: "A vest lined with leaden acoustic feathers that dampens vibrations and enhances dodges."
    }
  ],

  vitality: [
    {
      id: "a_vitality_tallow",
      name: "Living Tallow Vest",
      stat: "vitality",
      mod: 2,
      damageReduction: 2,
      conductorMetal: "Silver",
      tags: ["organic", "regenerating", "pliable"],
      description: "An organic tallow vest that congeals over lacerations and bolsters bodily recovery."
    },
    {
      id: "a_vitality_beast_hide",
      name: "Tanned Beast-Hide Cuirass",
      stat: "vitality",
      mod: 2,
      damageReduction: 2,
      conductorMetal: "Silver",
      tags: ["leather", "organic", "tough"],
      description: "Tough hide stripped from an alpha predator, pulsing with residual life-force."
    },
    {
      id: "a_vitality_silver_chitin",
      name: "Silver-Weave Chitin Mail",
      stat: "vitality",
      mod: 2,
      damageReduction: 1,
      conductorMetal: "Silver",
      tags: ["organic", "metal", "purifying"],
      description: "Interlocking chitin plates infused with silver thread that sterilizes incoming wounds."
    }
  ],

  fortitude: [
    {
      id: "a_fortitude_brigandine",
      name: "Tungsten Dwarven Brigandine",
      stat: "fortitude",
      mod: 3,
      damageReduction: 3,
      conductorMetal: "Tungsten",
      tags: ["metal", "leather", "heat_resistant", "dense"],
      description: "Heavy overlapping tungsten plates sandwiched inside hardened canvas, absorbing brutal concussions."
    },
    {
      id: "a_fortitude_smock",
      name: "Stonemason Heavy Smock",
      stat: "fortitude",
      mod: 2,
      damageReduction: 2,
      conductorMetal: "Tungsten",
      tags: ["leather", "stone", "rigid", "impact_resistant"],
      description: "A thick leather apron armored with stone chips that shrugs off shrapnel and crushing impacts."
    },
    {
      id: "a_fortitude_hauberk",
      name: "Unyielding Nexus Hauberk",
      stat: "fortitude",
      mod: 2,
      damageReduction: 2,
      conductorMetal: "Tungsten",
      tags: ["metal", "interlocking", "protective"],
      description: "A dense chainmail hauberk forged over volcanic vents, resistant to thermal burns and shock."
    }
  ],

  knowledge: [
    {
      id: "a_knowledge_alchemist_coat",
      name: "Lead-Lined Alchemist Coat",
      stat: "knowledge",
      mod: 2,
      damageReduction: 2,
      conductorMetal: "Bismuth",
      tags: ["leather", "metal", "acid_resistant", "insulating"],
      description: "A heavy scholar coat impregnated with lead and bismuth to neutralize caustic chemicals and aether leaks."
    },
    {
      id: "a_knowledge_robes",
      name: "Runed Scholar Robes",
      stat: "knowledge",
      mod: 1,
      damageReduction: 1,
      conductorMetal: "Bismuth",
      tags: ["cloth", "magic_attuned", "arcane_ward"],
      description: "Robes embroidered with protective geometric syllabaries that mathematically deflect spells."
    },
    {
      id: "a_knowledge_vambraces",
      name: "Armored Scribe Vambraces",
      stat: "knowledge",
      mod: 1,
      damageReduction: 1,
      conductorMetal: "Bismuth",
      tags: ["leather", "metal", "rigid", "light"],
      description: "Reinforced arm guards housing miniature ink vials and parchment slots for instant battlefield calculations."
    }
  ],

  logic: [
    {
      id: "a_logic_artificer_mail",
      name: "Artificer Mechanism Mail",
      stat: "logic",
      mod: 2,
      damageReduction: 2,
      conductorMetal: "Silicon",
      tags: ["metal", "brass", "conductive", "interlocking"],
      description: "An intricate mail coat woven with silicon circuits that ground out electrical arcs."
    },
    {
      id: "a_logic_cog_plate",
      name: "Interlocking Cog-Plate",
      stat: "logic",
      mod: 3,
      damageReduction: 3,
      conductorMetal: "Silicon",
      tags: ["metal", "brass", "rigid", "shock_resistant"],
      description: "A heavy plate suit featuring counter-rotating cogs that redistribute incoming impact forces."
    },
    {
      id: "a_logic_exoskeleton",
      name: "Clockwork Exoskeleton Harness",
      stat: "logic",
      mod: 2,
      damageReduction: 2,
      conductorMetal: "Silicon",
      tags: ["metal", "mechanical", "assist", "heavy"],
      description: "A motorized brass frame that braces the skeleton against sudden catastrophic loads."
    }
  ],

  awareness: [
    {
      id: "a_awareness_camo_cloak",
      name: "Chameleon Camouflage Cloak",
      stat: "awareness",
      mod: 1,
      damageReduction: 1,
      conductorMetal: "Chromium",
      tags: ["cloth", "stealth", "light", "camo"],
      description: "A cloak woven with light-shifting chromium fibers that blend into the immediate biome."
    },
    {
      id: "a_awareness_tracker_leather",
      name: "Tracker Supple Leather",
      stat: "awareness",
      mod: 2,
      damageReduction: 2,
      conductorMetal: "Chromium",
      tags: ["leather", "flexible", "silent", "light"],
      description: "Oiled deerhide crafted to keep sensory awareness peak by preventing muffled hearing."
    },
    {
      id: "a_awareness_scout_cuirass",
      name: "Owl-Eye Scout Cuirass",
      stat: "awareness",
      mod: 2,
      damageReduction: 2,
      conductorMetal: "Chromium",
      tags: ["leather", "metal", "reflective", "alert"],
      description: "A fitted chestpiece featuring high-polished gorgets that reveal peripheral reflections."
    }
  ],

  intuition: [
    {
      id: "a_intuition_witch_cloak",
      name: "Witch-Weave Ward Cloak",
      stat: "intuition",
      mod: 2,
      damageReduction: 2,
      conductorMetal: "Iridium",
      tags: ["cloth", "magic_attuned", "spirit_ward"],
      description: "A twilight-colored cloak that billows to intercept incoming projectiles on pure psychic instinct."
    },
    {
      id: "a_intuition_bone_mantle",
      name: "Shamanic Bone Mantle",
      stat: "intuition",
      mod: 1,
      damageReduction: 1,
      conductorMetal: "Iridium",
      tags: ["bone", "organic", "mystic", "light"],
      description: "A shoulder harness of blessed animal skulls that chitters softly when danger approaches."
    },
    {
      id: "a_intuition_dreamer_robes",
      name: "Feathered Dreamer Robes",
      stat: "intuition",
      mod: 1,
      damageReduction: 1,
      conductorMetal: "Iridium",
      tags: ["cloth", "organic", "precognitive", "light"],
      description: "Robes sewn with raven feathers that warn the wearer of ambushes a heartbeat before they occur."
    }
  ],

  charm: [
    {
      id: "a_charm_velvet_doublet",
      name: "Gilded Noble Velvet Doublet",
      stat: "charm",
      mod: 2,
      damageReduction: 1,
      conductorMetal: "Phosphorus",
      tags: ["cloth", "gilded", "prestigious", "light"],
      description: "An opulent courtly doublet that dazzles adversaries and discourages lethal strikes through sheer social status."
    },
    {
      id: "a_charm_parade_cuirass",
      name: "Emblazoned Parade Cuirass",
      stat: "charm",
      mod: 2,
      damageReduction: 2,
      conductorMetal: "Phosphorus",
      tags: ["metal", "polished", "commanding", "protective"],
      description: "A mirror-bright ceremonial breastplate bearing heraldry that commands hesitation from common foes."
    },
    {
      id: "a_charm_diplomat_mantle",
      name: "Silk Diplomat Mantle",
      stat: "charm",
      mod: 1,
      damageReduction: 1,
      conductorMetal: "Phosphorus",
      tags: ["cloth", "silk", "prestigious", "beguiling"],
      description: "A flowing mantle emitting a subtle euphoric phosphorus scent that disarms aggressive intent."
    }
  ],

  willpower: [
    {
      id: "a_willpower_cassock",
      name: "Inquisitor Heavy Cassock",
      stat: "willpower",
      mod: 2,
      damageReduction: 2,
      conductorMetal: "Lithium",
      tags: ["cloth", "leather", "psi_resistant", "rigid"],
      description: "A stiffened clerical robe reinforced with lithium wire, insulating the soul against mental anguish."
    },
    {
      id: "a_willpower_reliquary",
      name: "Reliquary Iron Vestments",
      stat: "willpower",
      mod: 2,
      damageReduction: 2,
      conductorMetal: "Lithium",
      tags: ["cloth", "metal", "holy_ward", "heavy"],
      description: "Vestments sewn with blessed saintly relics that steel the bearer's nerve against agony."
    },
    {
      id: "a_willpower_hairshirt",
      name: "Spiked Penitent Hairshirt",
      stat: "willpower",
      mod: 1,
      damageReduction: 1,
      conductorMetal: "Lithium",
      tags: ["cloth", "metal", "unyielding", "pain_tolerant"],
      description: "A rough garment lined with mild iron studs that trains the mind to ignore physical pain entirely."
    }
  ]
};

/**
 * Searches the registry for a weapon by name, or falls back to an exact stat group match.
 */
export function getWeapon(nameOrStat: string): WeaponDef {
  const clean = nameOrStat.toLowerCase().trim();

  // 1. Search by exact name or substring
  for (const group of Object.values(STAT_WEAPON_GROUPS)) {
    for (const w of group) {
      const wName = w.name.toLowerCase();
      if (wName === clean || clean.includes(wName) || wName.includes(clean)) {
        return w;
      }
    }
  }

  // 2. Token overlap match (e.g. "Dueling Blades" matches "Dueling Saber")
  const tokens = clean.split(/[\s\-_,]+/).filter(t => t.length >= 3);
  for (const group of Object.values(STAT_WEAPON_GROUPS)) {
    for (const w of group) {
      const wName = w.name.toLowerCase();
      for (const t of tokens) {
        if (wName.includes(t)) {
          return w;
        }
      }
    }
  }

  // 3. Search by stat key
  if (clean in STAT_WEAPON_GROUPS) {
    return STAT_WEAPON_GROUPS[clean as StatKey][0]!;
  }

  // Fallback default
  return STAT_WEAPON_GROUPS.might[0]!;
}

/**
 * Searches the registry for armor by name, or falls back to an exact stat group match.
 */
export function getArmor(nameOrStat: string): ArmorDef {
  const clean = nameOrStat.toLowerCase().trim();

  // 1. Search by exact name or substring
  for (const group of Object.values(STAT_ARMOR_GROUPS)) {
    for (const a of group) {
      const aName = a.name.toLowerCase();
      if (aName === clean || clean.includes(aName) || aName.includes(clean)) {
        return a;
      }
    }
  }

  // 2. Token overlap match (e.g. "Chainmail" / "Plate" / "Vest")
  const tokens = clean.split(/[\s\-_,]+/).filter(t => t.length >= 3);
  for (const group of Object.values(STAT_ARMOR_GROUPS)) {
    for (const a of group) {
      const aName = a.name.toLowerCase();
      // Check if user token is in armor name
      for (const t of tokens) {
        if (aName.includes(t)) {
          return a;
        }
      }
      // Check if armor word token is in user clean string (e.g. user typed "Chainmail" -> armor has "mail")
      const aTokens = aName.split(/[\s\-_,]+/).filter(t => t.length >= 4);
      for (const at of aTokens) {
        if (clean.includes(at)) {
          return a;
        }
      }
    }
  }

  // 3. Search by stat key
  if (clean in STAT_ARMOR_GROUPS) {
    return STAT_ARMOR_GROUPS[clean as StatKey][0]!;
  }

  // Fallback default
  return STAT_ARMOR_GROUPS.endurance[0]!;
}

/**
 * Returns a random weapon attuned to a specific stat.
 */
export function getRandomWeaponForStat(stat: StatKey): WeaponDef {
  const group = STAT_WEAPON_GROUPS[stat] || STAT_WEAPON_GROUPS.might;
  return group[Math.floor(Math.random() * group.length)]!;
}

/**
 * Returns a random armor attuned to a specific stat.
 */
export function getRandomArmorForStat(stat: StatKey): ArmorDef {
  const group = STAT_ARMOR_GROUPS[stat] || STAT_ARMOR_GROUPS.endurance;
  return group[Math.floor(Math.random() * group.length)]!;
}

/**
 * Returns a random weapon from any of the 12 stats.
 */
export function getRandomWeapon(): WeaponDef {
  const stats = Object.keys(STAT_WEAPON_GROUPS) as StatKey[];
  const stat = stats[Math.floor(Math.random() * stats.length)]!;
  return getRandomWeaponForStat(stat);
}

/**
 * Returns a random armor from any of the 12 stats.
 */
export function getRandomArmor(): ArmorDef {
  const stats = Object.keys(STAT_ARMOR_GROUPS) as StatKey[];
  const stat = stats[Math.floor(Math.random() * stats.length)]!;
  return getRandomArmorForStat(stat);
}
