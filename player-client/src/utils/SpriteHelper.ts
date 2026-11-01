import type { InjectedNPC } from '../types';

export const DEFAULT_START_CELL = 13408;
export const VIEWPORT_SIZE = 21; // 21x21 tiles visible at a time
export const TILE_SIZE = 24; // pixels per tile

export function getBiomeName(id?: number): string {
  const names = [
    'Marine', 'Hot Desert', 'Cold Desert', 'Savanna', 'Grassland', 'Chaparral',
    'Woodland', 'Boreal Forest', 'Temperate Forest', 'Tropical Forest', 'Tundra', 'Glacier', 'Wetland'
  ];
  return (id !== undefined && names[id]) ? names[id] : 'Wilderness';
}

// 128x128 Pixel Art Animal Kin Spritesheet (2816x1536: 22 cols x 12 rows)
export function getAnimalSpriteCoords(kingdom?: string, speciesName?: string, walkFrame: number = 0): { col: number; row: number } {
  const k = kingdom?.toLowerCase() || 'mammal';
  const s = speciesName?.toLowerCase() || '';

  let baseRow = 0;
  let baseCol = 0;

  if (k.includes('mammal')) {
    baseRow = 0;
    if (s.includes('bear') || s.includes('ursine')) baseCol = 4;
    else if (s.includes('rabbit') || s.includes('hare') || s.includes('small-paw')) baseCol = 8;
    else if (s.includes('lion') || s.includes('feline') || s.includes('cat') || s.includes('canopy')) baseCol = 12;
    else if (s.includes('deer') || s.includes('stag') || s.includes('elk') || s.includes('grazer')) baseCol = 18;
    else baseCol = 0; // wolf/fox/canid
  } else if (k.includes('insect')) {
    baseRow = 2;
    if (s.includes('mantis') || s.includes('locust')) baseCol = 4;
    else if (s.includes('ant') && (s.includes('red') || s.includes('fire'))) baseCol = 10;
    else if (s.includes('bee') || s.includes('wasp') || s.includes('sting')) baseCol = 16;
    else if (s.includes('butterfly') || s.includes('moth') || s.includes('silk')) baseCol = 19;
    else baseCol = 0; // ant/beetle
  } else if (k.includes('avian') || k.includes('bird')) {
    baseRow = 4;
    if (s.includes('owl')) baseCol = 4;
    else if (s.includes('duck') || s.includes('fowl')) baseCol = 10;
    else if (s.includes('chick') || s.includes('crow') || s.includes('jay')) baseCol = 13;
    else if (s.includes('parrot')) baseCol = 16;
    else if (s.includes('penguin')) baseCol = 19;
    else baseCol = 0; // eagle/falcon/hawk
  } else if (k.includes('aquatic') || k.includes('fish')) {
    baseRow = 6;
    if (s.includes('salmon') || s.includes('gar') || s.includes('pike')) baseCol = 3;
    else if (s.includes('crab') || s.includes('crustacean') || s.includes('lobster')) baseCol = 6;
    else if (s.includes('shark')) baseCol = 10;
    else if (s.includes('octopus') || s.includes('squid') || s.includes('moray')) baseCol = 14;
    else if (s.includes('mermaid') || s.includes('dolphin') || s.includes('siren')) baseCol = 19;
    else baseCol = 0; // catfish/fish-folk
  } else if (k.includes('plant') || k.includes('flora')) {
    baseRow = 8;
    if (s.includes('flower') || s.includes('blossom') || s.includes('lily') || s.includes('rose')) baseCol = 3;
    else if (s.includes('mushroom') || s.includes('fungus') || s.includes('spore')) baseCol = 8;
    else if (s.includes('vine') || s.includes('bramble') || s.includes('ivy') || s.includes('mangrove')) baseCol = 14;
    else if (s.includes('cactus') || s.includes('cacti') || s.includes('desert')) baseCol = 19;
    else baseCol = 0; // tree-folk/ancient/iron-wood
  } else if (k.includes('reptile')) {
    baseRow = 10;
    if (s.includes('snake') || s.includes('serpent') || s.includes('viper')) baseCol = 7;
    else if (s.includes('croc') || s.includes('alligator') || s.includes('gator')) baseCol = 10;
    else if (s.includes('turtle') || s.includes('tortoise') || s.includes('stone-scale')) baseCol = 15;
    else if (s.includes('gecko') || s.includes('chameleon') || s.includes('skink')) baseCol = 19;
    else baseCol = 0; // lizard/monitor/dino
  }

  const rowOffset = walkFrame % 2;
  return { col: baseCol + (walkFrame % 3), row: baseRow + rowOffset };
}

export function getNPCSpriteCoords(npc: InjectedNPC): { col: number; row: number } {
  const role = (npc.role || '').toLowerCase();
  const name = (npc.name || '').toLowerCase();

  // Apex Predators and dangerous beasts
  if (role.includes('predator') || npc.tags?.includes('predator') || name.includes('croc') || name.includes('wolf') || name.includes('bear') || name.includes('panther') || name.includes('lion') || name.includes('worg') || name.includes('lynx') || name.includes('jackal') || name.includes('coyote') || name.includes('beetle') || name.includes('viper') || name.includes('wyrm')) {
    if (name.includes('bear')) return { col: 4, row: 0 }; // Bear
    if (name.includes('wolf') || name.includes('worg') || name.includes('jackal') || name.includes('coyote')) return { col: 0, row: 0 }; // Canine
    if (name.includes('cat') || name.includes('lion') || name.includes('panther') || name.includes('lynx') || name.includes('puma')) return { col: 12, row: 0 }; // Feline
    if (name.includes('croc') || name.includes('viper') || name.includes('snake')) return { col: 10, row: 10 }; // Reptile / Serpent
    if (name.includes('beetle')) return { col: 6, row: 12 }; // Insect / Beetle
    if (name.includes('wyrm')) return { col: 2, row: 5 }; // Dragon / Wyrm
    return { col: 10, row: 10 }; // Croc / Reptile
  }

  // Grazing prey and wild fauna
  if (role.includes('fauna') || role.includes('prey') || npc.tags?.includes('prey') || role.includes('game') || name.includes('elk') || name.includes('stag') || name.includes('deer') || name.includes('caribou') || name.includes('reindeer') || name.includes('gazelle') || name.includes('zebra') || name.includes('ibex') || name.includes('hare') || name.includes('rabbit') || name.includes('marmot') || name.includes('tortoise') || name.includes('lemur')) {
    if (name.includes('hare') || name.includes('rabbit') || name.includes('marmot')) return { col: 8, row: 0 }; // Rabbit / Small herbivore
    if (name.includes('stag') || name.includes('elk') || name.includes('deer') || name.includes('caribou') || name.includes('reindeer') || name.includes('gazelle') || name.includes('zebra') || name.includes('ibex')) return { col: 18, row: 0 }; // Horned herd ungulate
    if (name.includes('tortoise')) return { col: 10, row: 8 }; // Shelled reptile
    if (name.includes('lemur')) return { col: 14, row: 0 }; // Arboreal mammal
    return { col: 0, row: 8 }; // Forest herbivore
  }

  if (role.includes('guard') || role.includes('soldier') || role.includes('knight') || role.includes('sentry') || role.includes('patrol')) {
    return { col: 4, row: 0 }; // Bear Knight
  } else if (role.includes('bandit') || role.includes('thief') || role.includes('raider') || role.includes('outlaw') || role.includes('skirmisher') || role.includes('cannibal')) {
    return { col: 0, row: 0 }; // Wolf Brigand
  } else if (role.includes('cultist') || role.includes('priest') || role.includes('warlock')) {
    return { col: 14, row: 6 }; // Octopus Occultist
  } else if (role.includes('merchant') || role.includes('trader') || role.includes('peddler') || role.includes('caravan')) {
    return { col: 4, row: 4 }; // Owl Merchant
  } else if (role.includes('druid') || role.includes('herbalist')) {
    return { col: 0, row: 8 }; // Tree-Kin Druid
  } else if (role.includes('scholar') || role.includes('scribe')) {
    return { col: 0, row: 2 }; // Ant-Kin Scholar
  } else if (role.includes('hunter') || role.includes('scout') || role.includes('trapper')) {
    return { col: 8, row: 0 }; // Rabbit Scout
  } else if (npc.disposition < 0) {
    return { col: 10, row: 10 }; // Croc Barbarian
  } else if (npc.disposition > 0) {
    return { col: 3, row: 8 }; // Flower-Kin Ally
  }
  return { col: 0, row: 10 }; // Lizard Wanderer
}

export const KINGDOM_PORTRAITS: Record<string, { image: string; name: string; title: string }> = {
  Mammal: { image: '/gfx/fox_kin.jpg', name: 'Clary', title: 'Fox-Kin Explorer' },
  Reptile: { image: '/gfx/lizard_kin.jpg', name: 'Kog', title: 'Lizard-Kin Mechanic' },
  Avian: { image: '/gfx/bird_kin.jpg', name: 'Falco', title: 'Avian Vanguard' },
  Aquatic: { image: '/gfx/captain_jax.jpg', name: 'Captain Jax', title: 'Catfish Mariner' },
  Insect: { image: '/gfx/ant_kin.jpg', name: 'Pipin Pringle', title: 'Ant-Kin Scholar' },
  Plant: { image: '/gfx/madame_verna.jpg', name: 'Madame Verna', title: 'Plant-Kin Matriarch' }
};

export const KINGDOM_PROFILES: Record<string, {
  name: string;
  stat: string;
  icon: string;
  summary: string;
  biology: string;
  strengths: string[];
  weaknesses: string[];
  vibe: string;
}> = {
  Mammal: {
    name: 'Mammal',
    stat: 'vitality',
    icon: '🐺',
    summary: 'Warm-blooded, enduring, and bound by pack loyalty. Built for prolonged overland survival and visceral vitality.',
    biology: 'Endothermic metabolism with thick subcutaneous adipose insulation and dense cellular recovery.',
    strengths: ['+7 Vitality (Core)', 'Endurance (Siege)', 'Charm (Pack Fealty)'],
    weaknesses: ['Lower Finesse', 'Lower Logic'],
    vibe: 'Natural frontline guardians, resilient commanders, and colossal survivors.'
  },
  Reptile: {
    name: 'Reptile',
    stat: 'endurance',
    icon: '🦎',
    summary: 'Cold-blooded apex stalkers with sun-baked scutes and premonitory thermal awareness.',
    biology: 'Ectothermic efficiency requiring little food, protected by interlocking keratin plates and infra-red sensory pits.',
    strengths: ['+7 Endurance (Core)', 'Fortitude (Armor)', 'Intuition (Omens)'],
    weaknesses: ['Lower Vitality', 'Lower Willpower'],
    vibe: 'Patient ambushers, adamantine sentinels, and premonitory seers.'
  },
  Avian: {
    name: 'Avian',
    stat: 'reflex',
    icon: '🦅',
    summary: 'Feathered sovereigns of the thermals. Hollow-boned speed, keen manuscripts, and devastating aerial strikes.',
    biology: 'Pneumatized skeleton with high-efficiency flow-through lungs and hyper-acute optical resolving power.',
    strengths: ['+7 Reflex (Core)', 'Knowledge (Manuscripts)', 'Might (Dives)'],
    weaknesses: ['Lower Endurance', 'Lower Intuition'],
    vibe: 'Acrobatic duelists, scholars of forbidden lore, and lethal skirmishers.'
  },
  Aquatic: {
    name: 'Aquatic',
    stat: 'finesse',
    icon: '🐙',
    summary: 'Fluid predators of the deep trenches. Hydrodynamic streamline with unmatched agility and sensory depth.',
    biology: 'Hydrophobic skin with electroreceptive lateral lines, allowing total situational awareness in liquid darkness.',
    strengths: ['+7 Finesse (Core)', 'Awareness (Echoes)', 'Reflex (Currents)'],
    weaknesses: ['Lower Might', 'Lower Knowledge'],
    vibe: 'Surgical assassins, evasive shadow-walkers, and acute aquatic trackers.'
  },
  Insect: {
    name: 'Insect',
    stat: 'might',
    icon: '🦂',
    summary: 'Chitinous marvels of hydraulic mechanical strength and collective geometric coordination.',
    biology: 'Exoskeletal leverage multiplying physical load capacity ten-fold with compound optic telemetry.',
    strengths: ['+7 Might (Core)', 'Logic (Geometry)', 'Vitality (Swarm)'],
    weaknesses: ['Lower Fortitude', 'Lower Charm'],
    vibe: 'Relentless shock-troopers, calculation savants, and hive specialists.'
  },
  Plant: {
    name: 'Plant',
    stat: 'fortitude',
    icon: '🌲',
    summary: 'Photosynthetic ancients anchored in bedrock. Indomitable wooden flesh and unyielding psychic fortitude.',
    biology: 'Silica-dense hardwood bark and deep mycelial mycorrhizae granting immunity to panic and physical disruption.',
    strengths: ['+7 Fortitude (Core)', 'Willpower (Bedrock)', 'Finesse (Vines)'],
    weaknesses: ['Lower Reflex', 'Lower Awareness'],
    vibe: 'Unmovable bulwarks, mystical anchorites, and venomous bramble-weavers.'
  }
};

