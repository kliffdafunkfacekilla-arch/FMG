/**
 * OSTRAKA CANONICAL CHARACTER & ANIMAL SPECIES MATRIX
 * ===================================================
 * 6 Animal Kingdoms, 72 Lineage Species, 12 Cosmic Institutions,
 * Mastery Perks Tree (Levels 3 & 5), Active Skills, and Derived Stat Ratios.
 */

export type StatKey =
  | 'might' | 'endurance' | 'reflex' | 'finesse' | 'vitality' | 'fortitude'
  | 'knowledge' | 'logic' | 'awareness' | 'intuition' | 'charm' | 'willpower';

export interface V12Matrix {
  might: number;
  endurance: number;
  reflex: number;
  finesse: number;
  vitality: number;
  fortitude: number;
  knowledge: number;
  logic: number;
  awareness: number;
  intuition: number;
  charm: number;
  willpower: number;
  [key: string]: number;
}

export const KINGDOMS: Record<string, V12Matrix> = {
  Mammal:  { might: 4, endurance: 5, fortitude: 4, vitality: 6, reflex: 3, finesse: 2, intuition: 4, awareness: 5, willpower: 4, charm: 6, knowledge: 3, logic: 2 },
  Reptile: { might: 3, endurance: 6, fortitude: 5, vitality: 2, reflex: 4, finesse: 4, intuition: 6, awareness: 4, willpower: 2, charm: 3, knowledge: 5, logic: 4 },
  Aquatic: { might: 2, endurance: 3, fortitude: 4, vitality: 4, reflex: 5, finesse: 6, intuition: 3, awareness: 6, willpower: 5, charm: 4, knowledge: 2, logic: 4 },
  Avian:   { might: 5, endurance: 2, fortitude: 3, vitality: 4, reflex: 6, finesse: 4, intuition: 2, awareness: 4, willpower: 3, charm: 5, knowledge: 6, logic: 4 },
  Insect:  { might: 6, endurance: 4, fortitude: 2, vitality: 5, reflex: 4, finesse: 3, intuition: 5, awareness: 3, willpower: 4, charm: 2, knowledge: 4, logic: 6 },
  Plant:   { might: 4, endurance: 4, fortitude: 6, vitality: 3, reflex: 2, finesse: 5, intuition: 4, awareness: 2, willpower: 6, charm: 4, knowledge: 5, logic: 3 }
};

export const BODY_STAT_TO_KINGDOM: Record<string, string> = {
  vitality: "Mammal",
  endurance: "Reptile",
  reflex: "Avian",
  finesse: "Aquatic",
  might: "Insect",
  fortitude: "Plant"
};

export const KINGDOM_TO_BODY_STAT: Record<string, StatKey> = {
  Mammal: "vitality",
  Reptile: "endurance",
  Avian: "reflex",
  Aquatic: "finesse",
  Insect: "might",
  Plant: "fortitude"
};

export interface KingdomLore {
  name: string;
  stat: StatKey;
  icon: string;
  tagline: string;
  desc: string;
  statShiftHint: string;
}

export const KINGDOM_LORE: Record<string, KingdomLore> = {
  Mammal: {
    name: "Mammal",
    stat: "vitality",
    icon: "🐺",
    tagline: "Warm-Blooded Endurance & Cellular Vigor",
    desc: "Warm-blooded creatures with dense cellular recovery, visceral stamina, and deep social bonds. Masters of temperate forests, tundra, and open plains.",
    statShiftHint: "+7 VITALITY boosts maximum HP recovery, organ resilience, and life force."
  },
  Reptile: {
    name: "Reptile",
    stat: "endurance",
    icon: "🦎",
    tagline: "Cold-Blooded Tenacity & Slow Metabolism",
    desc: "Cold-blooded survivors with dermal heat storage, metabolic efficiency, and ancient patience. Impervious to starvation, fatigue, and environmental exhaustion.",
    statShiftHint: "+7 ENDURANCE boosts prolonged stamina, siege grit, and physical marching reserves."
  },
  Avian: {
    name: "Avian",
    stat: "reflex",
    icon: "🦅",
    tagline: "Hollow-Boned Velocity & Supersonic Speed",
    desc: "Aerodynamic masters with hollow bone lattice, 360-degree optic focus, and supersonic kinetic reaction time. Lords of heights, spires, and gale-force currents.",
    statShiftHint: "+7 REFLEX boosts combat reaction beats, evasion velocity, and initiative."
  },
  Aquatic: {
    name: "Aquatic",
    stat: "finesse",
    icon: "🐙",
    tagline: "Hydrodynamic Fluidity & Precision Edge",
    desc: "Fluid dwellers of abyssal trenches, reefs, and tidal rivers. Exceptional edge dexterity, mucosal slip, and baric equilibrium under crushing depths.",
    statShiftHint: "+7 FINESSE boosts surgical edge precision, weapon balance, and weakpoint targeting."
  },
  Insect: {
    name: "Insect",
    stat: "might",
    icon: "🦂",
    tagline: "Chitinous Leverage & Hydraulic Power",
    desc: "Hardened chitinous exoskeletons with hydraulic musculature capable of lifting ten times their body weight. Crushing power and subterranean hive discipline.",
    statShiftHint: "+7 MIGHT boosts raw crushing impact, armor-breaking blows, and carry capacity."
  },
  Plant: {
    name: "Plant",
    stat: "fortitude",
    icon: "🌲",
    tagline: "Rooted Hardwood & Unshakable Bedrock",
    desc: "Photosynthetic ancients anchored deep in bedrock. Ironwood dermal bark and fibrous sinew granting immunity to forced displacement, panic, and concussive shock.",
    statShiftHint: "+7 FORTITUDE boosts structural bone density, trauma mitigation, and wound resistance."
  }
};

export interface SubTypeLore {
  name: string;
  stat: StatKey;
  icon: string;
  tagline: string;
  desc: string;
  statShiftHint: string;
}

export const SUB_TYPE_LORE: Record<StatKey, SubTypeLore> = {
  knowledge: {
    name: "Arcanist",
    stat: "knowledge",
    icon: "📜",
    tagline: "Scholar of Forgotten Runes & Antimagic Wards",
    desc: "Deciphers ancient cosmic manuscripts, star-charts, and null glyphs to dismantle occult sorcery.",
    statShiftHint: "+7 KNOWLEDGE boosts arcane spell defense, artifact activation, and lore deciphering."
  },
  logic: {
    name: "Tactician",
    stat: "logic",
    icon: "📐",
    tagline: "Cold Calculator of Trajectory & Geometry",
    desc: "Analyzes battlefield geometry, ricochet vectors, and supply logistics with mathematical precision.",
    statShiftHint: "+7 LOGIC boosts ranged trajectory precision, trap calculation, and critical angles."
  },
  awareness: {
    name: "Watcher",
    stat: "awareness",
    icon: "👁️",
    tagline: "Vigilant Sentry & Micro-Ambush Scout",
    desc: "Never sleeps unprepared. Detects camouflaged stalkers, micro-ambushes, and concealed passages.",
    statShiftHint: "+7 AWARENESS boosts danger detection range, ambush negation, and vision clarity."
  },
  intuition: {
    name: "Seer",
    stat: "intuition",
    icon: "🔮",
    tagline: "Premonitory Mystic & Danger Whisperer",
    desc: "Attuned to temporal ripples, hair-trigger gut instincts, and omens of impending doom.",
    statShiftHint: "+7 INTUITION boosts initiative rolls, premonitory reaction, and trap foresight."
  },
  charm: {
    name: "Emissary",
    stat: "charm",
    icon: "👑",
    tagline: "Magnetic Orator & Psychological Commander",
    desc: "Bends enemy resolve through presence, commands squad morale, and navigates high-stakes intrigue.",
    statShiftHint: "+7 CHARM boosts morale inspiration, intimidation checks, and barter margins."
  },
  willpower: {
    name: "Zealot",
    stat: "willpower",
    icon: "🔥",
    tagline: "Indomitable Soul & Sanity Bastion",
    desc: "An unyielding mental fortress immune to psychological terror, madness, and psionic rupture.",
    statShiftHint: "+7 WILLPOWER boosts composure defense, death saving throws, and psychic resistance."
  },
  might: { name: "Bruiser", stat: "might", icon: "⚔️", tagline: "Raw Power", desc: "Direct forceful intellect.", statShiftHint: "+7 Might." },
  endurance: { name: "Drudge", stat: "endurance", icon: "🛡️", tagline: "Mental Fortitude", desc: "Patience and endurance.", statShiftHint: "+7 Endurance." },
  finesse: { name: "Trickster", stat: "finesse", icon: "🗡️", tagline: "Deft Thoughts", desc: "Fast cunning thought.", statShiftHint: "+7 Finesse." },
  reflex: { name: "Scout", stat: "reflex", icon: "⚡", tagline: "Rapid Mind", desc: "Speedy reflexes.", statShiftHint: "+7 Reflex." },
  vitality: { name: "Survivor", stat: "vitality", icon: "❤️", tagline: "Tenacious Spirit", desc: "Will to survive.", statShiftHint: "+7 Vitality." },
  fortitude: { name: "Ironbound", stat: "fortitude", icon: "🧱", tagline: "Solid Resolve", desc: "Solid resolve.", statShiftHint: "+7 Fortitude." }
};

export interface LineageDef {
  kingdom: string;
  name: string;
  speciesType: string;
  plus: StatKey;
  minus: StatKey;
  traitName: string;
  traitDesc: string;
}

export const LINEAGES: Record<string, LineageDef[]> = {
  Mammal: [
    { kingdom: 'Mammal', name: 'Ursine', speciesType: 'Bear-Folk', plus: 'endurance', minus: 'finesse', traitName: 'Hearth-Fat', traitDesc: 'Thick adipose insulation grants immunity to absolute freezing and cold penalties.' },
    { kingdom: 'Mammal', name: 'Canid-Kin', speciesType: 'Wolf-Folk', plus: 'willpower', minus: 'charm', traitName: 'Perfect Pack', traitDesc: 'Advantage on combat and morale rolls when an ally occupies the same zone.' },
    { kingdom: 'Mammal', name: 'Equines', speciesType: 'Horse-Folk', plus: 'charm', minus: 'fortitude', traitName: 'Watchman’s Stride', traitDesc: 'Immense galloping stride grants +1 Move Beat on round 1.' },
    { kingdom: 'Mammal', name: 'Grazer-Kin', speciesType: 'Ram / Ox-Folk', plus: 'endurance', minus: 'reflex', traitName: 'Chaos-Cropping', traitDesc: 'Immune to temporal distortion and disorientation hazards.' },
    { kingdom: 'Mammal', name: 'Beavers', speciesType: 'Beaver-Folk', plus: 'logic', minus: 'reflex', traitName: 'Mud-Mason', traitDesc: 'Ignores difficult terrain caused by mud, silt, rivers, or rubble.' },
    { kingdom: 'Mammal', name: 'Raccoons', speciesType: 'Procyon-Folk', plus: 'finesse', minus: 'fortitude', traitName: 'Night-Shift', traitDesc: 'Superior low-light vision and dexterous manipulation of mechanisms in total dark.' },
    { kingdom: 'Mammal', name: 'Small-Paws', speciesType: 'Rodent / Mouse-Folk', plus: 'reflex', minus: 'might', traitName: 'Unseen Hand', traitDesc: 'Can slip through hostile lines and occupies cover without being spotted.' },
    { kingdom: 'Mammal', name: 'Canopy-Climbers', speciesType: 'Simian / Monkey-Folk', plus: 'finesse', minus: 'endurance', traitName: 'Arboreal Acrobat', traitDesc: 'Suffers no trauma from vertical falls up to 40 feet.' },
    { kingdom: 'Mammal', name: 'Ailurus', speciesType: 'Red Panda-Folk', plus: 'intuition', minus: 'might', traitName: 'Empty Cup', traitDesc: 'Enemies overlook presence until hostile action is initiated.' },
    { kingdom: 'Mammal', name: 'Quill-Kin', speciesType: 'Porcupine-Folk', plus: 'knowledge', minus: 'vitality', traitName: 'Healer’s Immunity', traitDesc: 'Organic barbed quills filter toxins and venoms.' },
    { kingdom: 'Mammal', name: 'Wolverines', speciesType: 'Glutton-Folk', plus: 'fortitude', minus: 'charm', traitName: 'Unmatched Guardian', traitDesc: 'Can intercept physical strikes aimed at adjacent allies.' },
    { kingdom: 'Mammal', name: 'Manis', speciesType: 'Pangolin-Folk', plus: 'fortitude', minus: 'intuition', traitName: 'Living Stone', traitDesc: 'Keratin scales provide natural armor damage reduction equal to 2.' }
  ],
  Reptile: [
    { kingdom: 'Reptile', name: 'Stone-Scales', speciesType: 'Armored Lizard', plus: 'fortitude', minus: 'reflex', traitName: 'Spear Wall', traitDesc: 'Can dig talons into terrain to provide full solid cover for allies.' },
    { kingdom: 'Reptile', name: 'Monitor-Kin', speciesType: 'Varanid-Folk', plus: 'endurance', minus: 'charm', traitName: 'Endless Stride', traitDesc: 'Ignores environmental exhaustion, heatstroke, and forced marches.' },
    { kingdom: 'Reptile', name: 'Geckos', speciesType: 'Gecko-Folk', plus: 'logic', minus: 'might', traitName: 'Wall-Crawler', traitDesc: 'Micro-suction pads allow hands-free vertical climbing on sheer surfaces.' },
    { kingdom: 'Reptile', name: 'Pit-Vipers', speciesType: 'Viper-Folk', plus: 'awareness', minus: 'charm', traitName: 'Thermal Vision', traitDesc: 'Detects infra-red heat signatures; immune to darkness, smoke, and mist blindness.' },
    { kingdom: 'Reptile', name: 'Gliding Skinks', speciesType: 'Skink-Folk', plus: 'finesse', minus: 'endurance', traitName: 'Perfect Polish', traitDesc: 'Reflective nacreous scales deflect glare and grant blindness immunity.' },
    { kingdom: 'Reptile', name: 'Frilled-Lizards', speciesType: 'Agamid-Folk', plus: 'logic', minus: 'fortitude', traitName: 'Thermal Vents', traitDesc: 'Cranial frill vents convective heat; completely immune to fire and scalding steam.' },
    { kingdom: 'Reptile', name: 'Shovel-Snouts', speciesType: 'Burrowing Saurian', plus: 'might', minus: 'intuition', traitName: 'Sand-Swimmer', traitDesc: 'Can burrow through loose sand, scree, or soft loam at running speed.' },
    { kingdom: 'Reptile', name: 'Serpent-Kin', speciesType: 'Constrictor-Folk', plus: 'might', minus: 'logic', traitName: 'The Coils', traitDesc: 'Grappled foes lose 1 action beat per turn from constricting pressure.' },
    { kingdom: 'Reptile', name: 'Crocodilians', speciesType: 'Gator-Folk', plus: 'willpower', minus: 'finesse', traitName: 'Vengeful Strike', traitDesc: 'Gain double advantage on attack rolls immediately after suffering major injury.' },
    { kingdom: 'Reptile', name: 'Toads', speciesType: 'Bufonid-Folk', plus: 'vitality', minus: 'reflex', traitName: 'Chem-Baron', traitDesc: 'Immune to chemical acids, caustic slimes, and toxic miasmas.' },
    { kingdom: 'Reptile', name: 'Newts', speciesType: 'Salamander-Folk', plus: 'reflex', minus: 'willpower', traitName: 'Hyper-Metabolic', traitDesc: 'Regenerates 2 HP at the start of combat encounters.' },
    { kingdom: 'Reptile', name: 'Frogs', speciesType: 'Anuran-Folk', plus: 'finesse', minus: 'fortitude', traitName: 'Warning Colors', traitDesc: 'Secretes contact neurotoxin when struck by unarmed melee strikes.' }
  ],
  Avian: [
    { kingdom: 'Avian', name: 'Eagles', speciesType: 'Raptor-Folk', plus: 'willpower', minus: 'finesse', traitName: 'Golden Talon', traitDesc: 'Apex aerial majesty grants advantage on all intimidation checks.' },
    { kingdom: 'Avian', name: 'Falcons', speciesType: 'Falcon-Folk', plus: 'reflex', minus: 'fortitude', traitName: 'Needle-Threader', traitDesc: 'Suffers no precision or speed penalty during high-speed vertical dives.' },
    { kingdom: 'Avian', name: 'Owls', speciesType: 'Strigid-Folk', plus: 'logic', minus: 'vitality', traitName: 'Silent Beak', traitDesc: 'Auditory acoustic mastery detects subtle vocal deceptions and lies.' },
    { kingdom: 'Avian', name: 'Crows', speciesType: 'Corvid-Folk', plus: 'knowledge', minus: 'charm', traitName: 'Blackstone Handler', traitDesc: 'Naturally attuned to chaos radiation and immune to magical backfires.' },
    { kingdom: 'Avian', name: 'Jays', speciesType: 'Cyan-Folk', plus: 'finesse', minus: 'endurance', traitName: 'Loud Saw', traitDesc: 'Screeching vocal resonance grants immunity to acoustic concussion and deafening.' },
    { kingdom: 'Avian', name: 'Buzzards', speciesType: 'Vulture-Folk', plus: 'fortitude', minus: 'charm', traitName: 'Iron Gut', traitDesc: 'Corrosive digestive system provides absolute immunity to disease and rot.' },
    { kingdom: 'Avian', name: 'Sparrows', speciesType: 'Passerine-Folk', plus: 'awareness', minus: 'might', traitName: 'High-Altitude Lungs', traitDesc: 'Immune to thin air, altitude sickness, and mountain frostbite.' },
    { kingdom: 'Avian', name: 'Cardinals', speciesType: 'Scarlet-Folk', plus: 'charm', minus: 'might', traitName: 'Eye-Catcher', traitDesc: 'Brilliant plumage draws enemy attention, taunting foes away from allies.' },
    { kingdom: 'Avian', name: 'Thrushes', speciesType: 'Songbird-Folk', plus: 'intuition', minus: 'might', traitName: 'Musical Cipher', traitDesc: 'Can encode complex battlefield tactical data into melodic whistling.' },
    { kingdom: 'Avian', name: 'Terror-Fowl', speciesType: 'Phorus-Folk', plus: 'might', minus: 'reflex', traitName: 'Sickle-Claw', traitDesc: 'Unarmed kicks count as Heavy Weapons dealing 1d10 piercing damage.' },
    { kingdom: 'Avian', name: 'Fowl', speciesType: 'Gallus-Folk', plus: 'endurance', minus: 'intuition', traitName: 'Flock Mentality', traitDesc: 'Immune to supernatural terror, panic, and awe while standing near allies.' },
    { kingdom: 'Avian', name: 'Penguins', speciesType: 'Spheniscid-Folk', plus: 'logic', minus: 'reflex', traitName: 'Contract Guardian', traitDesc: 'Rigid adherence to treaty arbitration yields advantage in trade negotiations.' }
  ],
  Aquatic: [
    { kingdom: 'Aquatic', name: 'Dolphin-Kin', speciesType: 'Cetacean-Folk', plus: 'charm', minus: 'might', traitName: 'Pulse-Read', traitDesc: 'Echolocation pulses detect living heartbeats through solid obstacles.' },
    { kingdom: 'Aquatic', name: 'Walrus-Kin', speciesType: 'Odobenid-Folk', plus: 'endurance', minus: 'finesse', traitName: 'Abyssal Bond', traitDesc: 'Advantage when taming, commanding, or communicating with wild beasts.' },
    { kingdom: 'Aquatic', name: 'Elephant Seals', speciesType: 'Mirounga-Folk', plus: 'fortitude', minus: 'reflex', traitName: 'Trench-Forged', traitDesc: 'Extreme baric tolerance makes you immune to crushing hydrostatic pressure.' },
    { kingdom: 'Aquatic', name: 'Orcas', speciesType: 'Apex Cetacean', plus: 'might', minus: 'charm', traitName: 'Midnight Wake', traitDesc: 'Hydrodynamic camouflage produces zero aquatic surface wake.' },
    { kingdom: 'Aquatic', name: 'Catfish', speciesType: 'Silurid-Folk', plus: 'intuition', minus: 'fortitude', traitName: 'Mud-Slick', traitDesc: 'Mucosal epidermal layer renders you immune to grapples, nets, and restraints.' },
    { kingdom: 'Aquatic', name: 'Otters', speciesType: 'Lutrine-Folk', plus: 'finesse', minus: 'endurance', traitName: 'Water-Whisper', traitDesc: 'Effortlessly darts across quicksand, mud, and turbulent river currents.' },
    { kingdom: 'Aquatic', name: 'Shark-Kin', speciesType: 'Selachian-Folk', plus: 'reflex', minus: 'logic', traitName: 'Blood-Frenzy', traitDesc: 'Gains a bonus movement beat whenever targeting an enemy suffering from Bleed.' },
    { kingdom: 'Aquatic', name: 'Crustacean-Kin', speciesType: 'Decapod-Folk', plus: 'fortitude', minus: 'intuition', traitName: 'Coral-Chitin', traitDesc: 'Calcareous exoskeleton provides natural +2 physical armor reduction.' },
    { kingdom: 'Aquatic', name: 'Seahorses', speciesType: 'Syngnathid-Folk', plus: 'awareness', minus: 'might', traitName: 'Unseen Conduit', traitDesc: 'Electroreceptive sensory aura renders you immune to clairvoyance scrying.' },
    { kingdom: 'Aquatic', name: 'Moray-Kin', speciesType: 'Muraenid-Folk', plus: 'logic', minus: 'reflex', traitName: 'Lead-Silicon', traitDesc: 'Heavy insulating hide grounds electrical discharge, giving shock immunity.' },
    { kingdom: 'Aquatic', name: 'Gar-Pikes', speciesType: 'Lepisosteid-Folk', plus: 'might', minus: 'charm', traitName: 'Delta Ambush', traitDesc: 'Attacks launched from water or marsh ignore defender physical armor DR.' },
    { kingdom: 'Aquatic', name: 'Salmon-Kin', speciesType: 'Salmonid-Folk', plus: 'vitality', minus: 'logic', traitName: 'Kinetic Surge', traitDesc: 'Can swim or leap against the strongest waterfalls and rapids without stamina cost.' }
  ],
  Insect: [
    { kingdom: 'Insect', name: 'Widow Spiders', speciesType: 'Arachnid-Folk', plus: 'charm', minus: 'vitality', traitName: 'Unseen Web', traitDesc: 'Can anchor invisible sensory silk threads to redirect hostile psychological mental checks.' },
    { kingdom: 'Insect', name: 'Ant-Kin', speciesType: 'Formicid-Folk', plus: 'endurance', minus: 'finesse', traitName: 'Hive-Echo', traitDesc: 'Can carry up to 10x body weight with zero encumbrance penalty.' },
    { kingdom: 'Insect', name: 'Mantises', speciesType: 'Mantid-Folk', plus: 'reflex', minus: 'charm', traitName: 'Apex Ambush', traitDesc: 'Upgrades damage category to Critical if striking before target takes an action.' },
    { kingdom: 'Insect', name: 'Scorpions', speciesType: 'Scorpionid-Folk', plus: 'fortitude', minus: 'reflex', traitName: 'Tremor-Sense', traitDesc: 'Pinpoints underground and wall vibrations within 2 full tactical zones.' },
    { kingdom: 'Insect', name: 'Beetles', speciesType: 'Coleoptera-Folk', plus: 'might', minus: 'intuition', traitName: 'Micro-Hook', traitDesc: 'Microscopic tarsal hooks permit carrying full party equipment up sheer cliffs.' },
    { kingdom: 'Insect', name: 'Stinging Hive', speciesType: 'Vespid-Folk', plus: 'reflex', minus: 'fortitude', traitName: 'Swarm-Tether', traitDesc: 'Immune to fear and route effects when fighting near comrades.' },
    { kingdom: 'Insect', name: 'Silk Worms', speciesType: 'Bombyx-Folk', plus: 'logic', minus: 'might', traitName: 'Spun-Cipher', traitDesc: 'Can weave secret tactical messages and maps into durable silk thread.' },
    { kingdom: 'Insect', name: 'Roach-Kin', speciesType: 'Blattid-Folk', plus: 'endurance', minus: 'finesse', traitName: 'Mag-Lock Scuttle', traitDesc: 'Can scuttle upside down across stone ceilings at sprint velocity.' },
    { kingdom: 'Insect', name: 'Moths', speciesType: 'Lepidoptera-Folk', plus: 'finesse', minus: 'vitality', traitName: 'Velvet Flight', traitDesc: 'Sound-dampening acoustic scales allow silent nocturnal flight.' },
    { kingdom: 'Insect', name: 'Ladybugs', speciesType: 'Coccinellid-Folk', plus: 'might', minus: 'intuition', traitName: 'Trickster Momentum', traitDesc: 'Grants a free disengage movement whenever landing a successful hit.' },
    { kingdom: 'Insect', name: 'Dragonflies', speciesType: 'Odonata-Folk', plus: 'awareness', minus: 'fortitude', traitName: 'Strobe-Cipher', traitDesc: 'Compound eye vision tracks 360-degree trajectories simultaneously.' },
    { kingdom: 'Insect', name: 'Flies', speciesType: 'Diptera-Folk', plus: 'reflex', minus: 'willpower', traitName: 'Supersonic Dart', traitDesc: 'Can instantly dart through narrow arrow slits and barricades without halting.' }
  ],
  Plant: [
    { kingdom: 'Plant', name: 'Cacti', speciesType: 'Xerophyte-Folk', plus: 'endurance', minus: 'intuition', traitName: 'Living Reservoir', traitDesc: 'Stores internal distilled hydration; immune to thirst, dehydration, and desert sun.' },
    { kingdom: 'Plant', name: 'Drifters', speciesType: 'Spore-Folk', plus: 'intuition', minus: 'might', traitName: 'Vibration Sense', traitDesc: 'Mycelial network blind-sight navigates subterranean caverns without sight.' },
    { kingdom: 'Plant', name: 'Sylvan Ancients', speciesType: 'Treant-Folk', plus: 'fortitude', minus: 'reflex', traitName: 'Rooted Stance', traitDesc: 'Roots anchor into bedrock; immune to forced knockbacks, pushes, and trips.' },
    { kingdom: 'Plant', name: 'Iron-Woods', speciesType: 'Hardwood-Folk', plus: 'might', minus: 'charm', traitName: 'Fireproof Sentinel', traitDesc: 'Dense silica bark core is completely non-combustible and immune to fire trauma.' },
    { kingdom: 'Plant', name: 'Weeping Mangroves', speciesType: 'Rhizophora-Folk', plus: 'vitality', minus: 'logic', traitName: 'Filter-Tree', traitDesc: 'Roots desalinate and detoxify standing water and swamp poisons around your camp.' },
    { kingdom: 'Plant', name: 'Moon-Blossoms', speciesType: 'Flora Oracle', plus: 'awareness', minus: 'might', traitName: 'Nocturnal Oracle', traitDesc: 'Blooms under moonlight to read past events from pollen historical memory.' },
    { kingdom: 'Plant', name: 'Sun-Blossoms', speciesType: 'Helianthus-Folk', plus: 'charm', minus: 'fortitude', traitName: 'Diplomat’s Hospitality', traitDesc: 'Calming floral aromatics render you untargetable during Round 1 of negotiation.' },
    { kingdom: 'Plant', name: 'Corpse-Lilies', speciesType: 'Rafflesia-Folk', plus: 'vitality', minus: 'charm', traitName: 'Noxious Bloom', traitDesc: 'Releases pungent carrion scent that drains 2 composure from approaching beasts.' },
    { kingdom: 'Plant', name: 'Iron-Brambles', speciesType: 'Briar-Folk', plus: 'fortitude', minus: 'finesse', traitName: 'Thorny Barricade', traitDesc: 'Razor bramble coat inflicts 1 injury point automatically on anyone grappling you.' },
    { kingdom: 'Plant', name: 'Berry-Bushes', speciesType: 'Vaccinium-Folk', plus: 'knowledge', minus: 'might', traitName: 'Alchemical Provisioner', traitDesc: 'Grows 3 restorative alchemical berries per day that heal 2 HP each.' },
    { kingdom: 'Plant', name: 'Vines', speciesType: 'Liana-Folk', plus: 'finesse', minus: 'logic', traitName: 'Creeping Strangler', traitDesc: 'Prehensile vine limbs extend melee attack reach into adjacent tactical zones.' },
    { kingdom: 'Plant', name: 'Mushrooms', speciesType: 'Fungal-Folk', plus: 'willpower', minus: 'charm', traitName: 'Fungal Alloy', traitDesc: 'Psychotropic mycelium grants advantage on all Chaos Resilience saves.' }
  ]
};

export interface InstitutionDef {
  name: string;
  stat: StatKey;
  descriptor: string;
}

export const INSTITUTIONS: InstitutionDef[] = [
  { name: 'Mass', stat: 'might', descriptor: 'Implacable Gravity' },
  { name: 'Ordo', stat: 'endurance', descriptor: 'Frozen Stasis' },
  { name: 'Motus', stat: 'reflex', descriptor: 'Kinetic Obliteration' },
  { name: 'Flux', stat: 'finesse', descriptor: 'Corrosive Greed' },
  { name: 'Vita', stat: 'vitality', descriptor: 'The Fecund Plague' },
  { name: 'Nexus', stat: 'fortitude', descriptor: 'Thermal Rage' },
  { name: 'Anumis', stat: 'knowledge', descriptor: 'Arcane Nullification' },
  { name: 'Ratio', stat: 'logic', descriptor: 'Architect of Zero' },
  { name: 'Lux', stat: 'awareness', descriptor: 'Clockwork Rot' },
  { name: 'Omen', stat: 'intuition', descriptor: 'Temporal Instability' },
  { name: 'Aura', stat: 'charm', descriptor: 'Toxic Euphoria' },
  { name: 'Lex', stat: 'willpower', descriptor: 'Volatile Reality' }
];

export interface MasteryPerk {
  stat: StatKey;
  level: number;
  name: string;
  desc: string;
}

export const MASTERY_PERKS: MasteryPerk[] = [
  { stat: 'might', level: 3, name: 'Heavy Lifter', desc: 'No movement penalties from encumbrance or heavy load.' },
  { stat: 'might', level: 5, name: "Titan's Grip", desc: 'Wield two-handed colossal weapons in a single hand.' },
  { stat: 'endurance', level: 3, name: 'Iron Lung', desc: 'Hold breath for 1 hour; completely immune to suffocating gases.' },
  { stat: 'endurance', level: 5, name: 'Juggernaut', desc: 'Unstoppable kinetic inertia; cannot be pushed, knocked down, or restrained.' },
  { stat: 'finesse', level: 3, name: 'Needle Threader', desc: 'Ranged and melee attacks ignore defender partial cover penalties.' },
  { stat: 'finesse', level: 5, name: 'Perfect Balance', desc: 'Can traverse tightropes, liquids, thin ice, or smoke without sinking.' },
  { stat: 'reflex', level: 3, name: 'Catfall', desc: 'Suffer zero falling trauma from heights up to 50 feet.' },
  { stat: 'reflex', level: 5, name: 'Bullet Time', desc: 'Supernatural synaptic speed grants 2 tactical reactions per combat round.' },
  { stat: 'vitality', level: 3, name: 'Fast Metabolism', desc: 'All healing applied to you is automatically maximized.' },
  { stat: 'vitality', level: 5, name: 'Troll Blood', desc: 'Cellular regeneration recovers 1 HP at the start of every combat turn.' },
  { stat: 'fortitude', level: 3, name: 'Iron Stomach', desc: 'Biological fortitude renders you immune to ingested poisons and food-borne blight.' },
  { stat: 'fortitude', level: 5, name: 'Unstoppable', desc: 'Downgrades any Stun condition into a minor Slow.' },
  { stat: 'knowledge', level: 3, name: 'Warding Ward', desc: '+2 Defense bonus against arcane spells and sorcerous hazards.' },
  { stat: 'knowledge', level: 5, name: 'Master of All', desc: 'Can utilize any ancient arcane artifact or device regardless of restrictions.' },
  { stat: 'logic', level: 3, name: 'Geometry', desc: 'Ranged attacks into melee ignore friendly fire roll penalties.' },
  { stat: 'logic', level: 5, name: 'Cold Calculator', desc: 'Immune to psychological confusion, panic, and chaos surges.' },
  { stat: 'awareness', level: 3, name: 'Sleepless', desc: 'Keeps passive guard while sleeping; cannot be ambushed or surprised.' },
  { stat: 'awareness', level: 5, name: 'Blindsight', desc: 'Can accurately perceive all entities within 30 feet in total darkness.' },
  { stat: 'intuition', level: 3, name: 'Danger Sense', desc: '+5 bonus to combat initiative rolls.' },
  { stat: 'intuition', level: 5, name: 'Sixth Sense', desc: 'The GM whispers advance warning before traps trigger or ambushes spring.' },
  { stat: 'charm', level: 3, name: 'Silver Tongue', desc: 'Loot and trade items can be sold at 100% of their market value.' },
  { stat: 'charm', level: 5, name: 'Cult Personality', desc: 'Hostile sapient NPCs will not attack first unless explicitly provoked.' },
  { stat: 'willpower', level: 3, name: 'Die Hard', desc: 'Death saving throws succeed on a roll of 10 or higher.' },
  { stat: 'willpower', level: 5, name: 'Mind Over Matter', desc: 'Can spend Composure directly in place of Stamina or Focus points.' }
];

export interface SkillDef {
  id: string;
  name: string;
  category: 'General' | 'Stamina' | 'Focus';
  cost: string;
  desc: string;
  icon: string;
}

export const SKILL_DB: SkillDef[] = [
  { id: 's1', name: 'Tactician', category: 'General', cost: '1 Action', desc: 'Grant an ally +1d4 to their next Attack or contested roll.', icon: '♟️' },
  { id: 's2', name: 'Command', category: 'General', cost: '1 Action', desc: 'Forgo your attack to allow an ally in your zone to make an immediate strike.', icon: '👑' },
  { id: 's3', name: 'Kinetic Punch', category: 'Stamina', cost: '2 Stamina', desc: 'Deliver an overcharged blow that violently knocks the target back 10 feet.', icon: '💥' },
  { id: 's4', name: 'Anchor', category: 'Stamina', cost: '1 Stamina', desc: 'Reaction: Lock your footing to ignore forced displacement and gain +2 Defense.', icon: '⚓' },
  { id: 's5', name: 'Telekinetic Shove', category: 'Focus', cost: '2 Focus', desc: 'Channel raw willpower to deal 1d4 Force impact and push an enemy 5 feet.', icon: '🌀' },
  { id: 's6', name: 'Scan', category: 'Focus', cost: '1 Focus', desc: 'Analyze target anatomy to reveal one defensive weakness or primary stat.', icon: '👁️' },
  { id: 's7', name: 'Furious Cleave', category: 'Stamina', cost: '2 Stamina', desc: 'Sweep weapon in a wide arc, striking all adjacent targets in the zone.', icon: '🪓' },
  { id: 's8', name: 'Shadow Cloak', category: 'Focus', cost: '2 Focus', desc: 'Bend light around yourself to instantly enter stealth, even while observed.', icon: '🌑' },
  { id: 's9', name: 'Rallying Howl', category: 'General', cost: '1 Action', desc: 'Restore 2 Composure to all allies within earshot and clear demoralized status.', icon: '🐺' }
];

export interface DerivedStats {
  maxHp: number;
  maxComposure: number;
  maxStamina: number;
  maxFocus: number;
  physDefense: number;
  speed: number;
  perception: number;
  mentalDefense: number;
}

export function calcDerivedStats(matrix: Record<string, number>): DerivedStats {
  const get = (k: string) => Number(matrix[k]) || 1;
  const ratioBM = (b1: string, b2: string, m1: string) => get(b1) + get(b2) + Math.round(get(m1) / 2);
  const ratioMB = (m1: string, m2: string, b1: string) => get(m1) + get(m2) + Math.round(get(b1) / 2);

  return {
    maxHp: 10 + ratioBM('vitality', 'endurance', 'willpower'),
    maxComposure: 10 + ratioMB('knowledge', 'awareness', 'fortitude'),
    maxStamina: ratioBM('might', 'finesse', 'intuition'),
    maxFocus: ratioMB('logic', 'charm', 'reflex'),
    physDefense: ratioBM('might', 'fortitude', 'logic'),
    speed: ratioBM('vitality', 'reflex', 'charm'),
    perception: ratioMB('awareness', 'knowledge', 'finesse'),
    mentalDefense: ratioMB('willpower', 'intuition', 'endurance')
  };
}

export function getUnlockedPerks(stats: Record<string, number>): MasteryPerk[] {
  return MASTERY_PERKS.filter(p => (Number(stats[p.stat]) || 0) >= p.level);
}

// ==========================================
// CANONICAL OSTRAKA SPLIT & TYPE DEFINITIONS
// ==========================================

export interface TypeArchetype {
  id: string;
  name: string;
  stat: StatKey;
  description: string;
}

export const MAIN_TYPES: Record<StatKey, TypeArchetype> = {
  might:     { id: 'titan',     name: 'Titan',     stat: 'might',     description: 'Colossus of crushing power, unstoppable momentum, and overwhelming physical mass.' },
  endurance: { id: 'bastion',   name: 'Bastion',   stat: 'endurance', description: 'Unyielding wall of stamina, prolonged siege resistance, and unbreakable tenacity.' },
  finesse:   { id: 'duelist',   name: 'Duelist',   stat: 'finesse',   description: 'Master of lethal finesse, razor-sharp edge control, and anatomical weakpoint strikes.' },
  reflex:    { id: 'dervish',   name: 'Dervish',   stat: 'reflex',    description: 'Kinetic whirlwind of velocity, fluid evasion, and supersonic tactical reactions.' },
  vitality:  { id: 'behemoth',  name: 'Behemoth',  stat: 'vitality',  description: 'Primordial titan powered by cellular regeneration, restorative surge, and raw vigor.' },
  fortitude: { id: 'bulwark',   name: 'Bulwark',   stat: 'fortitude', description: 'Adamantine barrier impervious to concussive trauma, deep bone fractures, and caustic blight.' },
  // Mind fallback defaults if ever queried
  knowledge: { id: 'polymath',  name: 'Polymath',  stat: 'knowledge', description: 'Universal scholar of ancient laws and forgotten technologies.' },
  logic:     { id: 'architect', name: 'Architect', stat: 'logic',     description: 'Master builder of spatial geometries and impenetrable structures.' },
  awareness: { id: 'sentinel',  name: 'Sentinel',  stat: 'awareness', description: 'Ever-vigilant protector of boundaries and borders.' },
  intuition: { id: 'oracle',    name: 'Oracle',    stat: 'intuition', description: 'Conduit of prophetic foresight and cosmic intuition.' },
  charm:     { id: 'sovereign', name: 'Sovereign', stat: 'charm',     description: 'Regal ruler commanding total fealty and diplomatic mastery.' },
  willpower: { id: 'ironclad',  name: 'Ironclad',  stat: 'willpower', description: 'Indomitable spirit unyielding to mortal suffering.' }
};

export const SUB_TYPES: Record<StatKey, TypeArchetype> = {
  knowledge: { id: 'arcanist',  name: 'Arcanist',  stat: 'knowledge', description: 'Scholar of ancient cosmic manuscripts, forgotten wards, and runic catalysts.' },
  logic:     { id: 'tactician', name: 'Tactician', stat: 'logic',     description: 'Cold calculator of geometry, tactical probability, and battlefield logistics.' },
  awareness: { id: 'watcher',   name: 'Watcher',   stat: 'awareness', description: 'Sharp-eyed sentry detecting micro-ambushes, hidden trails, and concealed threats.' },
  intuition: { id: 'seer',      name: 'Seer',      stat: 'intuition', description: 'Prescient mystic attuned to imminent peril, temporal ripples, and instinctual omens.' },
  charm:     { id: 'emissary',  name: 'Emissary',  stat: 'charm',     description: 'Magnetic orator wielding psychological sway, presence, and battlefield command.' },
  willpower: { id: 'zealot',    name: 'Zealot',    stat: 'willpower', description: 'Indomitable ascetic shielding the mind against psychic rupture, terror, and delirium.' },
  // Body fallback defaults
  might:     { id: 'bruiser',   name: 'Bruiser',   stat: 'might',     description: 'Aggressive street fighter with heavy fists.' },
  endurance: { id: 'drudge',    name: 'Drudge',    stat: 'endurance', description: 'Tireless worker accustomed to endless labor.' },
  finesse:   { id: 'trickster', name: 'Trickster', stat: 'finesse',   description: 'Quick-handed rogue adept at sleight of hand.' },
  reflex:    { id: 'scout',     name: 'Scout',     stat: 'reflex',    description: 'Fast-footed reconnaissance runner.' },
  vitality:  { id: 'survivor',  name: 'Survivor',  stat: 'vitality',  description: 'Tough wilderness survivor with dense constitution.' },
  fortitude: { id: 'ironbound', name: 'Ironbound', stat: 'fortitude', description: 'Hard-skinned laborer resistant to heavy strain.' }
};

export const FINAL_TYPES: Record<StatKey, TypeArchetype> = {
  might:     { id: 'breaker',    name: 'Breaker',    stat: 'might',     description: 'Front-line linebreaker smashing enemy formations, shields, and reinforced gates.' },
  endurance: { id: 'warden',     name: 'Warden',     stat: 'endurance', description: 'Relentless campaign veteran capable of enduring months of siege and physical attrition.' },
  finesse:   { id: 'skirmisher', name: 'Skirmisher', stat: 'finesse',   description: 'Flanking specialist slipping through shield lines to sever vital arteries and tendons.' },
  reflex:    { id: 'striker',    name: 'Striker',    stat: 'reflex',    description: 'Explosive high-mobility interceptor disrupting enemy ranks before they can form lines.' },
  vitality:  { id: 'reaver',     name: 'Reaver',     stat: 'vitality',  description: 'Indomitable shock trooper whose combat ferocity surges when wounded.' },
  fortitude: { id: 'sentinel',   name: 'Sentinel',   stat: 'fortitude', description: 'Immovable fortress warrior holding choke points and safeguarding brothers-in-arms.' },
  // Mind fallback defaults
  knowledge: { id: 'sage',       name: 'Sage',       stat: 'knowledge', description: 'Venerated scholar guiding strategic councils.' },
  logic:     { id: 'inquisitor', name: 'Inquisitor', stat: 'logic',     description: 'Relentless interrogator exposing tactical falsehoods.' },
  awareness: { id: 'ranger',     name: 'Ranger',     stat: 'awareness', description: 'Long-range scout marking high-value targets.' },
  intuition: { id: 'harbinger',  name: 'Harbinger',  stat: 'intuition', description: 'Herald of doom predicting the turning tide of war.' },
  charm:     { id: 'paragon',    name: 'Paragon',    stat: 'charm',     description: 'Inspirational standard-bearer lifting unit morale.' },
  willpower: { id: 'avenger',    name: 'Avenger',    stat: 'willpower', description: 'Wrathful champion driven by an unbreakable vow.' }
};

export interface PowerNullTrack {
  id: string;
  name: string;
  stat: StatKey;
  powerName: string;
  powerDesc: string;
  nullName: string;
  nullDesc: string;
  bonus: number;
}

export const POWER_NULL_TRACKS: PowerNullTrack[] = [
  { id: 'track_might',     name: 'Mass Track',      stat: 'might',     powerName: 'Graviton Power', powerDesc: 'Channel crushing gravitational force into every physical strike.', nullName: 'Mass Null', nullDesc: 'Nullify kinetic mass, rendering strikes feather-light on your guard.', bonus: 2 },
  { id: 'track_endurance', name: 'Ordo Track',      stat: 'endurance', powerName: 'Stasis Power',   powerDesc: 'Project cryogenic stasis preventing muscle exhaustion and thermal collapse.', nullName: 'Ordo Null', nullDesc: 'Neutralize thermodynamic entropy, maintaining perpetual physical equilibrium.', bonus: 2 },
  { id: 'track_reflex',    name: 'Motus Track',     stat: 'reflex',    powerName: 'Kinetic Power',  powerDesc: 'Hyper-accelerate neural pathways for lightning reflex bursts.', nullName: 'Motus Null', nullDesc: 'Cancel enemy vector momentum upon contact, halting their charge.', bonus: 2 },
  { id: 'track_finesse',   name: 'Flux Track',      stat: 'finesse',   powerName: 'Flux Power',     powerDesc: 'Vibrate weapon edges at molecular frequencies to bypass armor plates.', nullName: 'Razor Null', nullDesc: 'Erase surface friction, slipping free from any grapple or restraint.', bonus: 2 },
  { id: 'track_vitality',  name: 'Vita Track',      stat: 'vitality',  powerName: 'Biotic Power',   powerDesc: 'Trigger cellular hyper-regeneration to rapidly close lacerations.', nullName: 'Vita Null', nullDesc: 'Neutralize necrotic blight, biological toxins, and cellular decay.', bonus: 2 },
  { id: 'track_fortitude', name: 'Nexus Track',     stat: 'fortitude', powerName: 'Adamant Power',  powerDesc: 'Encase dermal tissue in crystallized silica and dense ceramic scales.', nullName: 'Nexus Null', nullDesc: 'Ground concussive shockwaves directly into the earth with zero trauma.', bonus: 2 },
  { id: 'track_knowledge', name: 'Anumis Track',    stat: 'knowledge', powerName: 'Aether Power',   powerDesc: 'Channel cosmic aether to awaken ancient artifacts and inscriptions.', nullName: 'Anumis Null', nullDesc: 'Radiate an antimagic null zone unraveling hostile sorcery and curses.', bonus: 2 },
  { id: 'track_logic',     name: 'Ratio Track',     stat: 'logic',     powerName: 'Chronos Power',  powerDesc: 'Calculate trajectory vectors and critical strike angles in real-time.', nullName: 'Ratio Null', nullDesc: 'Neutralize probability variance and chaotic distortions in your zone.', bonus: 2 },
  { id: 'track_awareness', name: 'Lux Track',       stat: 'awareness', powerName: 'Radiance Power', powerDesc: 'Project blinding photon halos and detect hidden infrared signatures.', nullName: 'Lux Null', nullDesc: 'Dispel magical obscurations, cloaks, and shadowy illusions.', bonus: 2 },
  { id: 'track_intuition', name: 'Omen Track',      stat: 'intuition', powerName: 'Echo Power',     powerDesc: 'Sense temporal ripples to anticipate lethal danger beats before they occur.', nullName: 'Omen Null', nullDesc: 'Sever prophetic scrying and fate cords targeted at your party.', bonus: 2 },
  { id: 'track_charm',     name: 'Aura Track',      stat: 'charm',     powerName: 'Phero Power',    powerDesc: 'Exude magnetic pheromones bending humanoid hostility into awe.', nullName: 'Aura Null', nullDesc: 'Project psychic silence dampening hostile morale auras and fear shouts.', bonus: 2 },
  { id: 'track_willpower', name: 'Lex Track',       stat: 'willpower', powerName: 'Void Power',     powerDesc: 'Unleash telekinetic psychic crush dealing direct internal trauma.', nullName: 'Lex Null', nullDesc: 'Anchor the soul against psionic rupture, possession, and madness.', bonus: 2 }
];

export interface CombatSkillOption {
  id: string;
  name: string;
  stat: StatKey;
  cost: string;
  desc: string;
  bonus: number;
}

export const OFFENSE_SKILLS: CombatSkillOption[] = [
  { id: 'off_might',     name: 'Shatter Impact',     stat: 'might',     cost: '2 Stamina', desc: 'Devastating overhead crushing strike that fractures defender armor DR.', bonus: 2 },
  { id: 'off_endurance', name: 'Phalanx Thrust',     stat: 'endurance', cost: '1 Stamina', desc: 'Relentless piercing spear thrust that forces the enemy to yield ground.', bonus: 2 },
  { id: 'off_reflex',    name: 'Cyclone Flurry',     stat: 'reflex',    cost: '2 Stamina', desc: 'Blinding rapid-strike combo delivering two attacks in a single combat beat.', bonus: 2 },
  { id: 'off_finesse',   name: 'Arterial Puncture',  stat: 'finesse',   cost: '1 Stamina', desc: 'Precision thrust targeting vital arteries, inflicting persistent Bleed trauma.', bonus: 2 },
  { id: 'off_vitality',  name: 'Reckless Carnage',   stat: 'vitality',  cost: '2 Stamina', desc: 'Blood-frenzied blow trading raw vitality for massive critical trauma tier.', bonus: 2 },
  { id: 'off_fortitude', name: 'Shield Slam',        stat: 'fortitude', cost: '1 Stamina', desc: 'Heavy concussive bash that knocks target prone and shatters active guard.', bonus: 2 },
  { id: 'off_knowledge', name: 'Arcane Disruption',  stat: 'knowledge', cost: '2 Focus',   desc: 'Sorcerous projectile piercing magical shields and disabling active wards.', bonus: 2 },
  { id: 'off_logic',     name: 'Weakpoint Exploit',  stat: 'logic',     cost: '1 Focus',   desc: 'Calculated geometric shot completely ignoring target cover and terrain.', bonus: 2 },
  { id: 'off_awareness', name: 'Vitals Sniping',     stat: 'awareness', cost: '1 Focus',   desc: 'Long-range aimed shot dealing maximum trauma from a concealed vantage.', bonus: 2 },
  { id: 'off_intuition', name: 'Instinctive Riposte',stat: 'intuition', cost: '1 Focus',   desc: 'Hair-trigger counter-strike punishing hostile offensive action instantly.', bonus: 2 },
  { id: 'off_charm',     name: 'Demoralizing Taunt', stat: 'charm',     cost: '1 Focus',   desc: 'Scathing demoralization shout that shatters target composure and courage.', bonus: 2 },
  { id: 'off_willpower', name: 'Mind Sunder',        stat: 'willpower', cost: '2 Focus',   desc: 'Raw psionic blast dealing severe psychic shock directly to target essence.', bonus: 2 }
];

export const DEFENSE_SKILLS: CombatSkillOption[] = [
  { id: 'def_might',     name: 'Brace Impact',       stat: 'might',     cost: '1 Stamina', desc: 'Anchor footing with brute brawn to halve incoming physical shock damage.', bonus: 2 },
  { id: 'def_endurance', name: 'Ironclad Resolve',   stat: 'endurance', cost: '1 Stamina', desc: 'Absorb incoming damage using stamina, completely ignoring wound penalties.', bonus: 2 },
  { id: 'def_reflex',    name: 'Sidestep Dodge',     stat: 'reflex',    cost: '1 Stamina', desc: 'Evasive roll completely avoiding an incoming melee or ranged strike.', bonus: 2 },
  { id: 'def_finesse',   name: 'Parry & Disarm',     stat: 'finesse',   cost: '1 Stamina', desc: 'Deft weapon deflection that turns aside the strike and disarms the foe.', bonus: 2 },
  { id: 'def_vitality',  name: 'Surge Recovery',     stat: 'vitality',  cost: '2 Stamina', desc: 'Channel rapid biological surge to restore 2 HP immediately in combat.', bonus: 2 },
  { id: 'def_fortitude', name: 'Adamantine Bastion', stat: 'fortitude', cost: '1 Stamina', desc: 'Lock into defensive stance granting +3 Armor DR for the entire round.', bonus: 2 },
  { id: 'def_knowledge', name: 'Spellward Sigil',    stat: 'knowledge', cost: '1 Focus',   desc: 'Inscribe a glowing ward deflecting elemental and chaos spell damage.', bonus: 2 },
  { id: 'def_logic',     name: 'Predictive Guard',   stat: 'logic',     cost: '1 Focus',   desc: 'Anticipate incoming attack angle, granting +3 Defense against next strike.', bonus: 2 },
  { id: 'def_awareness', name: 'Blindside Evasion',  stat: 'awareness', cost: '1 Focus',   desc: 'Passive danger reflex avoiding unseen rear attacks and stealth ambushes.', bonus: 2 },
  { id: 'def_intuition', name: 'Premonition Flash',  stat: 'intuition', cost: '1 Focus',   desc: 'Glimpse danger a fraction of a beat early to completely negate critical trauma.', bonus: 2 },
  { id: 'def_charm',     name: 'Divert Aggression',  stat: 'charm',     cost: '1 Focus',   desc: 'Psychological misdirection forcing attacker to switch target or hesitate.', bonus: 2 },
  { id: 'def_willpower', name: 'Iron Mind',          stat: 'willpower', cost: '1 Focus',   desc: 'Mental bulwark completely nullifying fear, panic, and psychic mental trauma.', bonus: 2 }
];

