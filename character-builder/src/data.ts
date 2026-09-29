export type StatKey = 
  | 'might' | 'endurance' | 'reflex' | 'finesse' | 'vitality' | 'fortitude'
  | 'knowledge' | 'logic' | 'awareness' | 'intuition' | 'charm' | 'willpower';

export interface V12Matrix {
  might: number; endurance: number; reflex: number; finesse: number; vitality: number; fortitude: number;
  knowledge: number; logic: number; awareness: number; intuition: number; charm: number; willpower: number;
}

export const KINGDOMS: Record<string, V12Matrix> = {
  Mammal:  { might: 4, endurance: 5, fortitude: 4, vitality: 6, reflex: 3, finesse: 2, intuition: 4, awareness: 5, willpower: 4, charm: 6, knowledge: 3, logic: 2 },
  Reptile: { might: 3, endurance: 6, fortitude: 5, vitality: 2, reflex: 4, finesse: 4, intuition: 6, awareness: 4, willpower: 2, charm: 3, knowledge: 5, logic: 4 },
  Aquatic: { might: 2, endurance: 3, fortitude: 4, vitality: 4, reflex: 5, finesse: 6, intuition: 3, awareness: 6, willpower: 5, charm: 4, knowledge: 2, logic: 4 },
  Avian:   { might: 5, endurance: 2, fortitude: 3, vitality: 4, reflex: 6, finesse: 4, intuition: 2, awareness: 4, willpower: 3, charm: 5, knowledge: 6, logic: 4 },
  Insect:  { might: 6, endurance: 4, fortitude: 2, vitality: 5, reflex: 4, finesse: 3, intuition: 5, awareness: 3, willpower: 4, charm: 2, knowledge: 4, logic: 6 },
  Plant:   { might: 4, endurance: 4, fortitude: 6, vitality: 3, reflex: 2, finesse: 5, intuition: 4, awareness: 2, willpower: 6, charm: 4, knowledge: 5, logic: 3 }
};

export interface LineageDef {
  kingdom: string;
  name: string;
  plus: StatKey;
  minus: StatKey;
  traitName: string;
  traitDesc: string;
}

export const LINEAGES: Record<string, LineageDef[]> = {
  Mammal: [
    { kingdom: 'Mammal', name: 'Ursine', plus: 'endurance', minus: 'finesse', traitName: 'Hearth-Fat', traitDesc: 'Immune to absolute cold.' },
    { kingdom: 'Mammal', name: 'Canid-Kin', plus: 'willpower', minus: 'charm', traitName: 'Perfect Pack', traitDesc: 'Advantage with ally in Zone.' },
    { kingdom: 'Mammal', name: 'Equines', plus: 'charm', minus: 'fortitude', traitName: 'Watchman’s Stride', traitDesc: '+1 Move Beat on round 1.' },
    { kingdom: 'Mammal', name: 'Grazer-Kin', plus: 'endurance', minus: 'reflex', traitName: 'Chaos-Cropping', traitDesc: 'Immune to time-dilation.' },
    { kingdom: 'Mammal', name: 'Beavers', plus: 'logic', minus: 'reflex', traitName: 'Mud-Mason', traitDesc: 'Ignore water/mud difficult terrain.' },
    { kingdom: 'Mammal', name: 'Raccoons', plus: 'finesse', minus: 'fortitude', traitName: 'Night-Shift', traitDesc: 'Low-light vision.' },
    { kingdom: 'Mammal', name: 'Small-Paws', plus: 'reflex', minus: 'might', traitName: 'Unseen Hand', traitDesc: 'Stealthy movement in hostile Zones.' },
    { kingdom: 'Mammal', name: 'Canopy-Climbers', plus: 'finesse', minus: 'endurance', traitName: 'Arboreal Acrobat', traitDesc: 'No fall trauma.' },
    { kingdom: 'Mammal', name: 'Ailurus', plus: 'intuition', minus: 'might', traitName: 'Empty Cup', traitDesc: 'Ignored until attacking.' },
    { kingdom: 'Mammal', name: 'Quill-Kin', plus: 'knowledge', minus: 'vitality', traitName: 'Healer’s Immunity', traitDesc: 'Toxins/venoms immune.' },
    { kingdom: 'Mammal', name: 'Wolverines', plus: 'fortitude', minus: 'charm', traitName: 'Unmatched Guardian', traitDesc: 'Intercept strikes.' },
    { kingdom: 'Mammal', name: 'Manis', plus: 'fortitude', minus: 'intuition', traitName: 'Living Stone', traitDesc: 'Natural Plate mitigation.' }
  ],
  Reptile: [
    { kingdom: 'Reptile', name: 'Stone-Scales', plus: 'fortitude', minus: 'reflex', traitName: 'Spear Wall', traitDesc: 'Provide full cover.' },
    { kingdom: 'Reptile', name: 'Monitor-Kin', plus: 'endurance', minus: 'charm', traitName: 'Endless Stride', traitDesc: 'Ignore environmental exhaustion.' },
    { kingdom: 'Reptile', name: 'Geckos', plus: 'logic', minus: 'might', traitName: 'Wall-Crawler', traitDesc: 'Hands-free wall climbing.' },
    { kingdom: 'Reptile', name: 'Pit-Vipers', plus: 'awareness', minus: 'charm', traitName: 'Thermal Vision', traitDesc: 'Ignore darkness/smoke.' },
    { kingdom: 'Reptile', name: 'Gliding Skinks', plus: 'finesse', minus: 'endurance', traitName: 'Perfect Polish', traitDesc: 'Blinding immune.' },
    { kingdom: 'Reptile', name: 'Frilled-Lizards', plus: 'logic', minus: 'fortitude', traitName: 'Thermal Vents', traitDesc: 'Fire/steam immune.' },
    { kingdom: 'Reptile', name: 'Shovel-Snouts', plus: 'might', minus: 'intuition', traitName: 'Sand-Swimmer', traitDesc: 'Burrow/swim in earth.' },
    { kingdom: 'Reptile', name: 'Serpent-Kin', plus: 'might', minus: 'logic', traitName: 'The Coils', traitDesc: 'Grapples cost enemy beats.' },
    { kingdom: 'Reptile', name: 'Crocodilians', plus: 'willpower', minus: 'finesse', traitName: 'Vengeful Strike', traitDesc: 'Advantage after major injury.' },
    { kingdom: 'Reptile', name: 'Toads', plus: 'vitality', minus: 'reflex', traitName: 'Chem-Baron', traitDesc: 'Chemical hazard immune.' },
    { kingdom: 'Reptile', name: 'Newts', plus: 'reflex', minus: 'willpower', traitName: 'Hyper-Metabolic', traitDesc: 'Regenerate capacity at start.' },
    { kingdom: 'Reptile', name: 'Frogs', plus: 'finesse', minus: 'fortitude', traitName: 'Warning Colors', traitDesc: 'Contact toxin on skin.' }
  ],
  Avian: [
    { kingdom: 'Avian', name: 'Eagles', plus: 'willpower', minus: 'finesse', traitName: 'Golden Talon', traitDesc: 'Intimidation advantage.' },
    { kingdom: 'Avian', name: 'Falcons', plus: 'reflex', minus: 'fortitude', traitName: 'Needle-Threader', traitDesc: 'No vertical dive penalty.' },
    { kingdom: 'Avian', name: 'Owls', plus: 'logic', minus: 'vitality', traitName: 'Iron-Beak', traitDesc: 'Detect sapient lies.' },
    { kingdom: 'Avian', name: 'Crows', plus: 'knowledge', minus: 'charm', traitName: 'Blackstone Handler', traitDesc: 'Blowout immune.' },
    { kingdom: 'Avian', name: 'Jays', plus: 'finesse', minus: 'endurance', traitName: 'Loud Saw', traitDesc: 'Sonic trauma immune.' },
    { kingdom: 'Avian', name: 'Buzzards', plus: 'fortitude', minus: 'charm', traitName: 'Iron Gut', traitDesc: 'Poison/disease immune.' },
    { kingdom: 'Avian', name: 'Sparrows', plus: 'awareness', minus: 'might', traitName: 'High-Altitude Lungs', traitDesc: 'Cold/altitude immune.' },
    { kingdom: 'Avian', name: 'Cardinals', plus: 'charm', minus: 'might', traitName: 'Eye-Catcher', traitDesc: 'Taunt enemies in Zone.' }, // Added Might as a reasonable guess since 'Stealth' isn't a V12 stat
    { kingdom: 'Avian', name: 'Thrushes', plus: 'intuition', minus: 'might', traitName: 'Musical Cipher', traitDesc: 'Birdsong data encoding.' },
    { kingdom: 'Avian', name: 'Terror-Fowl', plus: 'might', minus: 'reflex', traitName: 'Sickle-Claw', traitDesc: 'Unarmed are Heavy Weapons.' },
    { kingdom: 'Avian', name: 'Fowl', plus: 'endurance', minus: 'intuition', traitName: 'Flock Mentality', traitDesc: 'Fear/Awe immune with allies.' },
    { kingdom: 'Avian', name: 'Penguins', plus: 'logic', minus: 'reflex', traitName: 'Contract Guardian', traitDesc: 'Arbitration advantage.' }
  ],
  Aquatic: [
    { kingdom: 'Aquatic', name: 'Dolphin-Kin', plus: 'charm', minus: 'might', traitName: 'Pulse-Read', traitDesc: 'Detect heartbeats.' },
    { kingdom: 'Aquatic', name: 'Walrus-Kin', plus: 'endurance', minus: 'finesse', traitName: 'Abyssal Bond', traitDesc: 'Beast taming advantage.' },
    { kingdom: 'Aquatic', name: 'Elephant Seals', plus: 'fortitude', minus: 'reflex', traitName: 'Trench-Forged', traitDesc: 'Gravity/crush immune.' },
    { kingdom: 'Aquatic', name: 'Orcas', plus: 'might', minus: 'charm', traitName: 'Midnight Wake', traitDesc: 'No aquatic wake.' },
    { kingdom: 'Aquatic', name: 'Catfish', plus: 'intuition', minus: 'fortitude', traitName: 'Mud-Slick', traitDesc: 'Grapple/restraint immune.' },
    { kingdom: 'Aquatic', name: 'Otters', plus: 'finesse', minus: 'endurance', traitName: 'Water-Whisper', traitDesc: 'Mud move advantage.' },
    { kingdom: 'Aquatic', name: 'Shark-Kin', plus: 'reflex', minus: 'logic', traitName: 'Blood-Frenzy', traitDesc: 'Extra move beat vs bleeding.' },
    { kingdom: 'Aquatic', name: 'Crustacean-Kin', plus: 'fortitude', minus: 'intuition', traitName: 'Coral-Chitin', traitDesc: 'Natural armor.' },
    { kingdom: 'Aquatic', name: 'Seahorses', plus: 'awareness', minus: 'might', traitName: 'Unseen Conduit', traitDesc: 'Scry immune.' },
    { kingdom: 'Aquatic', name: 'Moray-Kin', plus: 'logic', minus: 'reflex', traitName: 'Lead-Silicon', traitDesc: 'Shock/Lightning immune.' },
    { kingdom: 'Aquatic', name: 'Gar-Pikes', plus: 'might', minus: 'charm', traitName: 'Delta Ambush', traitDesc: 'Submerged bypass armor.' },
    { kingdom: 'Aquatic', name: 'Salmon-Kin', plus: 'vitality', minus: 'logic', traitName: 'Kinetic Surge', traitDesc: 'Ignore currents.' }
  ],
  Insect: [
    { kingdom: 'Insect', name: 'Widow Spiders', plus: 'charm', minus: 'vitality', traitName: 'Unseen Web', traitDesc: 'Redirect mental attacks.' },
    { kingdom: 'Insect', name: 'Ant-Kin', plus: 'endurance', minus: 'finesse', traitName: 'Hive-Echo', traitDesc: 'Synchronized team advantage.' },
    { kingdom: 'Insect', name: 'Mantises', plus: 'reflex', minus: 'charm', traitName: 'Apex Ambush', traitDesc: 'Upgrade trauma tier if first.' },
    { kingdom: 'Insect', name: 'Scorpions', plus: 'fortitude', minus: 'reflex', traitName: 'Tremor-Sense', traitDesc: 'Pinpoint in 2 Zones.' },
    { kingdom: 'Insect', name: 'Beetles', plus: 'might', minus: 'intuition', traitName: 'Micro-Hook', traitDesc: 'Climb at full load.' },
    { kingdom: 'Insect', name: 'Stinging Hive', plus: 'reflex', minus: 'fortitude', traitName: 'Swarm-Tether', traitDesc: 'Fear immune with allies.' },
    { kingdom: 'Insect', name: 'Silk Worms', plus: 'logic', minus: 'might', traitName: 'Spun-Cipher', traitDesc: 'Thread-based messages.' },
    { kingdom: 'Insect', name: 'Roach-Kin', plus: 'endurance', minus: 'finesse', traitName: 'Mag-Lock Scuttle', traitDesc: 'Ceiling walking.' },
    { kingdom: 'Insect', name: 'Moths', plus: 'finesse', minus: 'vitality', traitName: 'Velvet Flight', traitDesc: 'Silent nocturnal flight.' },
    { kingdom: 'Insect', name: 'Ladybugs', plus: 'might', minus: 'intuition', traitName: 'Trickster Momentum', traitDesc: 'Free move on hit.' },
    { kingdom: 'Insect', name: 'Dragonflies', plus: 'awareness', minus: 'fortitude', traitName: 'Strobe-Cipher', traitDesc: 'Visual data trans.' },
    { kingdom: 'Insect', name: 'Flies', plus: 'reflex', minus: 'willpower', traitName: 'Supersonic Dart', traitDesc: 'Move thru barricades.' }
  ],
  Plant: [
    { kingdom: 'Plant', name: 'Cacti', plus: 'endurance', minus: 'intuition', traitName: 'Living Reservoir', traitDesc: 'Starvation immune.' },
    { kingdom: 'Plant', name: 'Drifters', plus: 'intuition', minus: 'might', traitName: 'Vibration Sense', traitDesc: 'Blindsight navigation.' },
    { kingdom: 'Plant', name: 'Sylvan Ancients', plus: 'fortitude', minus: 'reflex', traitName: 'Rooted Stance', traitDesc: 'Forced move immune.' },
    { kingdom: 'Plant', name: 'Iron-Woods', plus: 'might', minus: 'charm', traitName: 'Fireproof Sentinel', traitDesc: 'Fire trauma immune.' },
    { kingdom: 'Plant', name: 'Weeping Mangroves', plus: 'vitality', minus: 'logic', traitName: 'Filter-Tree', traitDesc: 'Zone de-toxin.' },
    { kingdom: 'Plant', name: 'Moon-Blossoms', plus: 'awareness', minus: 'might', traitName: 'Nocturnal Oracle', traitDesc: 'History reconstruction.' },
    { kingdom: 'Plant', name: 'Sun-Blossoms', plus: 'charm', minus: 'fortitude', traitName: 'Diplomat’s Hospitality', traitDesc: 'Invisible Rd 1.' },
    { kingdom: 'Plant', name: 'Corpse-Lilies', plus: 'vitality', minus: 'charm', traitName: 'Noxious Bloom', traitDesc: 'Composure damage scent.' },
    { kingdom: 'Plant', name: 'Iron-Brambles', plus: 'fortitude', minus: 'finesse', traitName: 'Thorny Barricade', traitDesc: 'Grapplers take injury.' },
    { kingdom: 'Plant', name: 'Berry-Bushes', plus: 'knowledge', minus: 'might', traitName: 'Alchemical Provisioner', traitDesc: 'Daily berry heal.' },
    { kingdom: 'Plant', name: 'Vines', plus: 'finesse', minus: 'logic', traitName: 'Creeping Strangler', traitDesc: 'Reach to adjacent Zone.' },
    { kingdom: 'Plant', name: 'Mushrooms', plus: 'willpower', minus: 'charm', traitName: 'Fungal Alloy', traitDesc: 'Chaos Resilience advantage.' }
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
