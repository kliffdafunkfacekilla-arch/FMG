/**
 * 12-STAT SOCIAL & SANITY EQUIPMENT REGISTRY
 * ==========================================
 * Parallels the physical weapon and armor system for psychological, social, and sanity combat.
 * Every Social Weapon (insignia, rhetoric implements, badges, relics) deals Composure Trauma.
 * Every Social Armor (mantles, keepsakes, wards, regalia) comforts the mind and provides
 * Composure Damage Reduction (CDR).
 */

import { StatKey } from './EquipmentRegistry.js';

export interface SocialWeaponDef {
  id: string;
  name: string;
  stat: StatKey;
  mod: number; // Attack / rhetorical roll modifier (+1, +2, +3)
  composureDamageBonus: number; // Extra composure trauma dealt on success (+1, +2, +3)
  tags: string[];
  description: string;
}

export interface SocialArmorDef {
  id: string;
  name: string;
  stat: StatKey;
  mod: number; // Mental defense roll modifier (+1, +2, +3)
  composureReduction: number; // Composure Damage Reduction (CDR 1, 2, 3)
  tags: string[];
  description: string;
}

export const STAT_SOCIAL_WEAPON_GROUPS: Record<StatKey, SocialWeaponDef[]> = {
  might: [
    {
      id: "sw_might_baton",
      name: "Iron Warmaster Baton",
      stat: "might",
      mod: 2,
      composureDamageBonus: 2,
      tags: ["badge", "authority", "intimidation", "heavy"],
      description: "A brutal iron commander's baton that reinforces terrifying presence and demands immediate submission."
    },
    {
      id: "sw_might_signet",
      name: "Executioner's Iron Signet",
      stat: "might",
      mod: 2,
      composureDamageBonus: 3,
      tags: ["ring", "dread", "terror", "menacing"],
      description: "Heavy signet ring stamped with a headsman's axe, breaking the resolve of weaker wills."
    },
    {
      id: "sw_might_horn",
      name: "Thunderous War Horn",
      stat: "might",
      mod: 3,
      composureDamageBonus: 2,
      tags: ["instrument", "command", "shockwave", "booming"],
      description: "A hollowed ox horn whose deafening blast rattles enemy courage and forces immediate hesitation."
    }
  ],

  endurance: [
    {
      id: "sw_endurance_anchor",
      name: "Trench Survivor's Rosary",
      stat: "endurance",
      mod: 2,
      composureDamageBonus: 1,
      tags: ["relic", "grit", "unyielding", "stoic"],
      description: "A string of mud-caked iron beads carved during a brutal siege, projecting relentless stubbornness."
    },
    {
      id: "sw_endurance_oathband",
      name: "Ironclad Oathband",
      stat: "endurance",
      mod: 2,
      composureDamageBonus: 2,
      tags: ["talisman", "vow", "unbreakable", "attrition"],
      description: "Branded forearm band worn by veteran trench wardens, slowly wearing down opposition through stubborn refusal to yield."
    },
    {
      id: "sw_endurance_stave",
      name: "Mountain Pilgrim's Stave",
      stat: "endurance",
      mod: 1,
      composureDamageBonus: 2,
      tags: ["implement", "weary", "journey", "inevitable"],
      description: "A notched ironwood staff that radiates the tireless momentum of an endless march."
    }
  ],

  finesse: [
    {
      id: "sw_finesse_fan",
      name: "Gilded Courtier's Fan",
      stat: "finesse",
      mod: 2,
      composureDamageBonus: 2,
      tags: ["courtier", "subtle", "sarcasm", "elegance"],
      description: "Silk-ribbed fan used to conceal venomous smirks and deliver cutting, socially fatal innuendos."
    },
    {
      id: "sw_finesse_cane",
      name: "Aristocrat's Silver Cane",
      stat: "finesse",
      mod: 2,
      composureDamageBonus: 2,
      tags: ["cane", "status", "mockery", "refined"],
      description: "A polished malacca cane tipped with a silver serpent, punctuating cruel remarks with disdainful taps."
    },
    {
      id: "sw_finesse_quill",
      name: "Blackmail Needle Quill",
      stat: "finesse",
      mod: 3,
      composureDamageBonus: 1,
      tags: ["implement", "scandal", "secret", "piercing"],
      description: "A sharp crow-feather stylus used to brandish damning secrets and expose public hypocrisy."
    }
  ],

  reflex: [
    {
      id: "sw_reflex_mirror",
      name: "Duelist's Quick-Mirror",
      stat: "reflex",
      mod: 2,
      composureDamageBonus: 2,
      tags: ["mirror", "repartee", "mockery", "rapid"],
      description: "Polished steel pocket mirror used to reflect insults right back at attackers with lightning repartee."
    },
    {
      id: "sw_reflex_castanets",
      name: "Snapping Duelist Castanets",
      stat: "reflex",
      mod: 2,
      composureDamageBonus: 2,
      tags: ["instrument", "taunt", "feint", "provocative"],
      description: "Rhythmic bone clickers that disrupt opponent focus, provoking reckless verbal overreach."
    },
    {
      id: "sw_reflex_bell",
      name: "Silver Parrying Bell",
      stat: "reflex",
      mod: 3,
      composureDamageBonus: 1,
      tags: ["bell", "clarity", "interrupt", "sharp"],
      description: "A high-pitched finger chime rung instantly to interrupt lies and derail hostile arguments."
    }
  ],

  vitality: [
    {
      id: "sw_vitality_horn",
      name: "Blood-Oath Drinking Horn",
      stat: "vitality",
      mod: 2,
      composureDamageBonus: 2,
      tags: ["horn", "bravado", "primal", "feral"],
      description: "An engraved aurochs horn overflowing with spirits, radiating boisterous, untamed bravado."
    },
    {
      id: "sw_vitality_fetish",
      name: "Primeval Predator Jaw",
      stat: "vitality",
      mod: 2,
      composureDamageBonus: 3,
      tags: ["totem", "beast", "primal", "ferocious"],
      description: "A bear-jaw necklace radiating visceral physical dominance that silences intellectual squeamishness."
    },
    {
      id: "sw_vitality_hearth",
      name: "Glowing Hearthstone Totem",
      stat: "vitality",
      mod: 1,
      composureDamageBonus: 2,
      tags: ["stone", "life", "warmth", "overpowering"],
      description: "A warm basalt pebble holding hearth embers, exuding unyielding vitality that suffocates despair."
    }
  ],

  fortitude: [
    {
      id: "sw_fortitude_seal",
      name: "Monolithic Bastion Seal",
      stat: "fortitude",
      mod: 2,
      composureDamageBonus: 2,
      tags: ["seal", "law", "unshakable", "stone"],
      description: "A slate medallion stamped with imperial masonry sigils, meeting emotional outbursts with cold indifference."
    },
    {
      id: "sw_fortitude_reliquary",
      name: "Lead-Lined Reliquary Box",
      stat: "fortitude",
      mod: 2,
      composureDamageBonus: 2,
      tags: ["relic", "dense", "inert", "grounding"],
      description: "Heavy lead casket holding saintly bone dust, snuffing out psychic hysteria with heavy stillness."
    },
    {
      id: "sw_fortitude_anvil",
      name: "Miniature Forge Anvil",
      stat: "fortitude",
      mod: 3,
      composureDamageBonus: 1,
      tags: ["implement", "temper", "iron", "unbending"],
      description: "A palm-sized cold iron anvil that visually anchors conversations against deception."
    }
  ],

  knowledge: [
    {
      id: "sw_knowledge_lexicon",
      name: "Master Sage's Lexicon",
      stat: "knowledge",
      mod: 2,
      composureDamageBonus: 2,
      tags: ["book", "scholar", "erudition", "irrefutable"],
      description: "A vellum tome filled with obscure regional histories, citing forgotten treaties to crush opposing claims."
    },
    {
      id: "sw_knowledge_astrolabe",
      name: "Brass Celestial Astrolabe",
      stat: "knowledge",
      mod: 2,
      composureDamageBonus: 2,
      tags: ["device", "cosmic", "calculation", "grand"],
      description: "Intricate spinning astronomical dial that reframes arguments through grand planetary inevitability."
    },
    {
      id: "sw_knowledge_inscribed_slab",
      name: "Ancient Proclamation Slab",
      stat: "knowledge",
      mod: 3,
      composureDamageBonus: 2,
      tags: ["slab", "ancient", "decree", "absolute"],
      description: "A fragment of 1st Era dragon law that paralyzes theological debate with undeniable antiquity."
    }
  ],

  logic: [
    {
      id: "sw_logic_abacus",
      name: "Brass Dialectic Abacus",
      stat: "logic",
      mod: 2,
      composureDamageBonus: 2,
      tags: ["abacus", "dialectic", "proof", "cold"],
      description: "Precision bead frame used to mathematically deconstruct an opponent's rhetoric step by step."
    },
    {
      id: "sw_logic_scalpel",
      name: "Inquisitor's Scalpel of Reason",
      stat: "logic",
      mod: 3,
      composureDamageBonus: 2,
      tags: ["implement", "incisive", "syllogism", "analytical"],
      description: "A slender silver probe brandished while dissecting logical fallacies, leaving adversaries tongue-tied."
    },
    {
      id: "sw_logic_codex",
      name: "Magistrate's Codex of Precedent",
      stat: "logic",
      mod: 2,
      composureDamageBonus: 3,
      tags: ["book", "law", "syllogism", "unforgiving"],
      description: "Bound court judgements leaving zero rhetorical escape routes for contradictory testimonies."
    }
  ],

  awareness: [
    {
      id: "sw_awareness_monocle",
      name: "All-Seeing Obsidian Monocle",
      stat: "awareness",
      mod: 2,
      composureDamageBonus: 2,
      tags: ["lens", "observation", "scrutiny", "unsettling"],
      description: "A dark lens revealing micro-tremors, pupil dilations, and sweat beads to instantly call out deception."
    },
    {
      id: "sw_awareness_tuning_fork",
      name: "Vocal Lie-Catcher Fork",
      stat: "awareness",
      mod: 3,
      composureDamageBonus: 1,
      tags: ["implement", "resonance", "truth", "piercing"],
      description: "Rings with discordant dissonance whenever words carry deceit, unnerving liars into hasty confessions."
    },
    {
      id: "sw_awareness_lens",
      name: "Surveyor's Triangulation Lens",
      stat: "awareness",
      mod: 2,
      composureDamageBonus: 2,
      tags: ["lens", "perspective", "unflinching", "tactical"],
      description: "A crystal reticle that sizes up an opponent's psychological vulnerabilities with chilling accuracy."
    }
  ],

  intuition: [
    {
      id: "sw_intuition_runes",
      name: "Omen-Carved Bone Runes",
      stat: "intuition",
      mod: 2,
      composureDamageBonus: 2,
      tags: ["runes", "divination", "omen", "eerie"],
      description: "Scattered knuckles from shadow beasts that reveal hidden guilt and unspoken dread before words are spoken."
    },
    {
      id: "sw_intuition_phial",
      name: "Dreamweaver's Liquid Phial",
      stat: "intuition",
      mod: 2,
      composureDamageBonus: 3,
      tags: ["phial", "subconscious", "astral", "haunting"],
      description: "Iridescent oil whose shimmering vapors coax repressed nightmares to the surface of an adversary's mind."
    },
    {
      id: "sw_intuition_tarot",
      name: "Cruorbus Eclipse Tarot Deck",
      stat: "intuition",
      mod: 3,
      composureDamageBonus: 1,
      tags: ["cards", "fate", "foreboding", "prophetic"],
      description: "Blood-stained deck whose revealed cards invariably predict ruin for anyone obstinately defying the truth."
    }
  ],

  charm: [
    {
      id: "sw_charm_signet",
      name: "Diplomat's Golden Signet",
      stat: "charm",
      mod: 2,
      composureDamageBonus: 2,
      tags: ["badge", "nobility", "allure", "commanding"],
      description: "Flawlessly polished gold seal that evokes admiration, easing resistance and melting suspicious guards."
    },
    {
      id: "sw_charm_siren_rose",
      name: "Siren-Silk Scented Corsage",
      stat: "charm",
      mod: 2,
      composureDamageBonus: 3,
      tags: ["flower", "perfume", "beguiling", "intoxicating"],
      description: "Infused with exotic blooms from the southern coasts, disarming hostilities with intoxicating warmth."
    },
    {
      id: "sw_charm_goblet",
      name: "Ambassador's Silver Goblet",
      stat: "charm",
      mod: 3,
      composureDamageBonus: 1,
      tags: ["goblet", "hospitality", "camaraderie", "persuasive"],
      description: "Raised in toast to forge immediate false camaraderie, making verbal betrayal feel utterly impossible."
    }
  ],

  willpower: [
    {
      id: "sw_willpower_brand",
      name: "Zealot's Holy Brand",
      stat: "willpower",
      mod: 2,
      composureDamageBonus: 2,
      tags: ["relic", "conviction", "zeal", "blazing"],
      description: "A smoking iron brand glowing with the wielder's unbendable faith, overwhelming moral cowardice."
    },
    {
      id: "sw_willpower_diadem",
      name: "Mind-Sovereign Iron Diadem",
      stat: "willpower",
      mod: 3,
      composureDamageBonus: 2,
      tags: ["crown", "ego", "dominion", "commanding"],
      description: "An unadorned circlet of cold iron radiating pure psychic weight, demanding unhesitating obedience."
    },
    {
      id: "sw_willpower_censer",
      name: "Inquisitor's Torment Censer",
      stat: "willpower",
      mod: 2,
      composureDamageBonus: 3,
      tags: ["censer", "penitence", "spiritual", "fear"],
      description: "Swung rhythmically with burning frankincense and sulfur, forcing apostates and heretics to their knees."
    }
  ]
};

export const STAT_SOCIAL_ARMOR_GROUPS: Record<StatKey, SocialArmorDef[]> = {
  might: [
    {
      id: "sa_might_mantle",
      name: "Grizzled Bear-Skin War Mantle",
      stat: "might",
      mod: 2,
      composureReduction: 2,
      tags: ["pelt", "feral", "commanding", "thick"],
      description: "A colossal predator hide draped across broad shoulders, warding off fear through primal physical supremacy."
    },
    {
      id: "sa_might_pauldrons",
      name: "Champion's Lion Pauldrons",
      stat: "might",
      mod: 3,
      composureReduction: 2,
      tags: ["metal", "glory", "champion", "imposing"],
      description: "Gilded shoulder plates that project an aura of invincibility, turning aside verbal insults like dull arrows."
    },
    {
      id: "sa_might_crest",
      name: "Warlord's Iron Crest",
      stat: "might",
      mod: 2,
      composureReduction: 3,
      tags: ["metal", "brute", "thick", "anchored"],
      description: "A brutal iron helm ridge that absorbs intimidating shouts without budging an inch."
    }
  ],

  endurance: [
    {
      id: "sa_endurance_greatcoat",
      name: "Trench-Beaten Greatcoat",
      stat: "endurance",
      mod: 2,
      composureReduction: 2,
      tags: ["cloth", "weathered", "survivor", "humble"],
      description: "Layered wool and boiled leather that has survived winters and sieges, shrugging off psychological wear."
    },
    {
      id: "sa_endurance_hairshirt",
      name: "Ascetic's Coarse Hairshirt",
      stat: "endurance",
      mod: 3,
      composureReduction: 2,
      tags: ["cloth", "penitence", "endurance", "numb"],
      description: "Scratchy coarse garment that grounds the wearer in bodily reality, making verbal mockery feel trivial."
    },
    {
      id: "sa_endurance_rosary",
      name: "Survivor's Quilted Gambeson",
      stat: "endurance",
      mod: 2,
      composureReduction: 3,
      tags: ["padded", "comfort", "resilient", "steady"],
      description: "Thick quilted linen padded with horsehair that muffles emotional panic with reassuring heaviness."
    }
  ],

  finesse: [
    {
      id: "sa_finesse_doublet",
      name: "Silk Brocade Diplomat Doublet",
      stat: "finesse",
      mod: 2,
      composureReduction: 2,
      tags: ["silk", "court", "refined", "unruffled"],
      description: "Immaculate embroidered silk that projects absolute social poise, deflecting awkward accusations."
    },
    {
      id: "sa_finesse_mask",
      name: "Porcelain Mask of Nonchalance",
      stat: "finesse",
      mod: 3,
      composureReduction: 2,
      tags: ["porcelain", "mask", "impassive", "enigmatic"],
      description: "A blank white half-mask that conceals all emotional tells, rendering mental probing utterly useless."
    },
    {
      id: "sa_finesse_scarf",
      name: "Venetian Shadow Scarf",
      stat: "finesse",
      mod: 2,
      composureReduction: 3,
      tags: ["silk", "shadow", "deceptive", "slippery"],
      description: "Lightweight gossamer weave that lets cutting remarks slide off without finding purchase."
    }
  ],

  reflex: [
    {
      id: "sa_reflex_ribbon",
      name: "Feathersprung Duelist Scarf",
      stat: "reflex",
      mod: 2,
      composureReduction: 2,
      tags: ["silk", "feather", "nimble", "buoyant"],
      description: "A dancing crimson scarf whose kinetic rustle keeps the wearer's mind one step ahead of verbal ambushes."
    },
    {
      id: "sa_reflex_pendant",
      name: "Gyroscopic Balance Pendant",
      stat: "reflex",
      mod: 3,
      composureReduction: 2,
      tags: ["brass", "balance", "reactive", "steady"],
      description: "Spinning gimbaled brass rings that immediately restore mental equilibrium after shock or surprise."
    },
    {
      id: "sa_reflex_cloak",
      name: "Quickstep Duelist Mantle",
      stat: "reflex",
      mod: 2,
      composureReduction: 3,
      tags: ["leather", "nimble", "evasive", "light"],
      description: "Short split cloak that pivots smoothly, helping the wearer verbally slip away from rhetorical traps."
    }
  ],

  vitality: [
    {
      id: "sa_vitality_locket",
      name: "Keepsake Locket of the Hearth",
      stat: "vitality",
      mod: 2,
      composureReduction: 2,
      tags: ["locket", "memory", "family", "comfort"],
      description: "A silver locket holding a pressed prairie blossom and a lock of hair from home, shielding the spirit from cosmic dread."
    },
    {
      id: "sa_vitality_shawl",
      name: "Warm Woolen Hearth Shawl",
      stat: "vitality",
      mod: 3,
      composureReduction: 2,
      tags: ["wool", "warmth", "hearth", "cozy"],
      description: "Knitted from home-spun lamb's wool, enveloping the wearer in comforting warmth that dispels phantom terrors."
    },
    {
      id: "sa_vitality_torc",
      name: "Bone-Carved Vitality Torc",
      stat: "vitality",
      mod: 2,
      composureReduction: 3,
      tags: ["bone", "vitality", "pulse", "enduring"],
      description: "A neck ring carved from stag antler that beats in rhythm with the pulse, keeping fear from choking the throat."
    }
  ],

  fortitude: [
    {
      id: "sa_fortitude_habit",
      name: "Lead-Embroidered Monastery Habit",
      stat: "fortitude",
      mod: 2,
      composureReduction: 2,
      tags: ["robe", "lead", "insulated", "unfeeling"],
      description: "Heavy monastic robes weighted with lead thread, insulating thoughts from psychic screams and horror."
    },
    {
      id: "sa_fortitude_torc",
      name: "Granite Mind Torc",
      stat: "fortitude",
      mod: 3,
      composureReduction: 2,
      tags: ["stone", "granite", "rigid", "solid"],
      description: "Carved from deep bedrock, giving thoughts the immovable density of a subterranean vault."
    },
    {
      id: "sa_fortitude_hood",
      name: "Ironclad Bastion Cowl",
      stat: "fortitude",
      mod: 2,
      composureReduction: 3,
      tags: ["iron", "cowl", "fortress", "unyielding"],
      description: "Leather cowl reinforced with overlapping cold iron rings, turning away psychic dissonance like hail on slate."
    }
  ],

  knowledge: [
    {
      id: "sa_knowledge_stole",
      name: "Star-Weave Magister Stole",
      stat: "knowledge",
      mod: 2,
      composureReduction: 2,
      tags: ["silk", "arcane", "constellation", "rational"],
      description: "Silk band embroidered with planetary orbits, reassuring the mind that chaos is merely an unmeasured variable."
    },
    {
      id: "sa_knowledge_robe",
      name: "Bibliophile's Padded Robe",
      stat: "knowledge",
      mod: 3,
      composureReduction: 2,
      tags: ["quilted", "library", "quiet", "scholarly"],
      description: "Dense linen robes lined with parchment scraps, providing the comforting quietude of an ancient library."
    },
    {
      id: "sa_knowledge_amulet",
      name: "Archivist's Seal of Precedent",
      stat: "knowledge",
      mod: 2,
      composureReduction: 3,
      tags: ["bronze", "history", "immutable", "sober"],
      description: "An ancient bronze medallion that grounds volatile arguments in thousands of years of recorded precedent."
    }
  ],

  logic: [
    {
      id: "sa_logic_toga",
      name: "Stoic Socratic Toga",
      stat: "logic",
      mod: 2,
      composureReduction: 2,
      tags: ["linen", "stoic", "socratic", "dispassionate"],
      description: "Austere unbleached linen garment that projects dispassionate clarity, immunizing the wearer to emotional appeals."
    },
    {
      id: "sa_logic_dampeners",
      name: "Clockwork Ear-Dampeners",
      stat: "logic",
      mod: 3,
      composureReduction: 2,
      tags: ["brass", "auditory", "filtering", "calm"],
      description: "Brass hearing cones that muffle hysterical screeches while letting reasoned syllogisms ring clear."
    },
    {
      id: "sa_logic_wig",
      name: "Jurist's Hermetic Court Wig",
      stat: "logic",
      mod: 2,
      composureReduction: 3,
      tags: ["wool", "court", "dignity", "armored"],
      description: "Traditional powdered wig that lends a sacred aura of institutional law, deadening personal insults."
    }
  ],

  awareness: [
    {
      id: "sa_awareness_veil",
      name: "Veil of Vigilance",
      stat: "awareness",
      mod: 2,
      composureReduction: 2,
      tags: ["gossamer", "perception", "attuned", "unblinking"],
      description: "Fine mesh veil that filters blinding glare and disorienting light, preserving situational clarity."
    },
    {
      id: "sa_awareness_hood",
      name: "Hound-Keeper's Scented Hood",
      stat: "awareness",
      mod: 3,
      composureReduction: 2,
      tags: ["leather", "scent", "calm", "alert"],
      description: "Herbal-lined cowl that prevents sensory overload in packed courts and bustling markets."
    },
    {
      id: "sa_awareness_earpiece",
      name: "Whisper-Catching Conch Earpiece",
      stat: "awareness",
      mod: 2,
      composureReduction: 3,
      tags: ["shell", "hearing", "eavesdrop", "prepared"],
      description: "A spiral conch ear-cuff that warns the wearer of sotto-voce plotting before social ambushes launch."
    }
  ],

  intuition: [
    {
      id: "sa_intuition_cowl",
      name: "Dreamer's Silver-Strand Cowl",
      stat: "intuition",
      mod: 2,
      composureReduction: 2,
      tags: ["silver", "dream", "cruorbus", "mystic"],
      description: "Shimmering silk hood tuned to the tides of Cruorbus, normalizing cosmic omens so they do not break sanity."
    },
    {
      id: "sa_intuition_circlet",
      name: "Third-Eye Obsidian Circlet",
      stat: "intuition",
      mod: 3,
      composureReduction: 2,
      tags: ["obsidian", "sight", "astral", "unblinking"],
      description: "A dark volcanic stone band resting against the brow, dissolving eldritch illusions into harmless smoke."
    },
    {
      id: "sa_intuition_shroud",
      name: "Soothsayer's Starry Shroud",
      stat: "intuition",
      mod: 2,
      composureReduction: 3,
      tags: ["cloth", "destiny", "fatalism", "peace"],
      description: "A mantle printed with constellations that instills deep philosophical peace with whatever fate brings."
    }
  ],

  charm: [
    {
      id: "sa_charm_sash",
      name: "Velvet Diplomatic Sash",
      stat: "charm",
      mod: 2,
      composureReduction: 2,
      tags: ["velvet", "poise", "diplomacy", "gracious"],
      description: "A ceremonial sash conferring ambassadorial dignity that makes verbal attacks seem uncouth and toothless."
    },
    {
      id: "sa_charm_mask",
      name: "Gilded Mask of Poise",
      stat: "charm",
      mod: 3,
      composureReduction: 2,
      tags: ["gold", "mask", "radiance", "dazzling"],
      description: "A serene smiling faceplate in hammered gold that dazzles onlookers and projects unflappable grace."
    },
    {
      id: "sa_charm_gown",
      name: "Peerless Courtier Regalia",
      stat: "charm",
      mod: 2,
      composureReduction: 3,
      tags: ["silk", "splendor", "magnetic", "imposing"],
      description: "Lavish robes demanding so much instinctual deference that opponents hesitate to speak with hostility."
    }
  ],

  willpower: [
    {
      id: "sa_willpower_crown",
      name: "Iron Crown of Conviction",
      stat: "willpower",
      mod: 2,
      composureReduction: 2,
      tags: ["iron", "zeal", "unbreakable", "holy"],
      description: "Spiked band of crude iron hammered on cold stone, anchoring the mind to a single, fanatical certainty."
    },
    {
      id: "sa_willpower_gorget",
      name: "Unyielding Soul Gorget",
      stat: "willpower",
      mod: 3,
      composureReduction: 2,
      tags: ["steel", "gorget", "bastion", "invulnerable"],
      description: "Steel throat collar inscribed with ancient warden oaths, guarding the soul against psychic decapitation."
    },
    {
      id: "sa_willpower_shroud",
      name: "Martyr's Blood-Stained Shroud",
      stat: "willpower",
      mod: 2,
      composureReduction: 3,
      tags: ["linen", "martyr", "sacrifice", "transcendent"],
      description: "A rough burial linen that elevates the wearer above mortal concerns of humiliation or terror."
    }
  ]
};

export function getSocialWeapon(nameOrId: string): SocialWeaponDef {
  const norm = (nameOrId || '').trim().toLowerCase();
  for (const group of Object.values(STAT_SOCIAL_WEAPON_GROUPS)) {
    for (const w of group) {
      if (w.name.toLowerCase() === norm || w.id.toLowerCase() === norm) return w;
    }
  }
  return STAT_SOCIAL_WEAPON_GROUPS.might[0]!;
}

export function getSocialArmor(nameOrId: string): SocialArmorDef {
  const norm = (nameOrId || '').trim().toLowerCase();
  for (const group of Object.values(STAT_SOCIAL_ARMOR_GROUPS)) {
    for (const a of group) {
      if (a.name.toLowerCase() === norm || a.id.toLowerCase() === norm) return a;
    }
  }
  return STAT_SOCIAL_ARMOR_GROUPS.vitality[0]!;
}

export function getRandomSocialWeaponForStat(stat: StatKey): SocialWeaponDef {
  const group = STAT_SOCIAL_WEAPON_GROUPS[stat] || STAT_SOCIAL_WEAPON_GROUPS.might;
  return group[Math.floor(Math.random() * group.length)]!;
}

export function getRandomSocialArmorForStat(stat: StatKey): SocialArmorDef {
  const group = STAT_SOCIAL_ARMOR_GROUPS[stat] || STAT_SOCIAL_ARMOR_GROUPS.vitality;
  return group[Math.floor(Math.random() * group.length)]!;
}
