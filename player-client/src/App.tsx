import React, { useState, useEffect, useRef } from 'react';
import './index.css';
import { generateLevel3Map } from './utils/Level3Generator';
import { audioManager } from './utils/AudioManager';

const CELL_ID = 13408;
const VIEWPORT_SIZE = 21; // 21x21 tiles visible at a time
const TILE_SIZE = 24; // pixels per tile

interface InjectedProp {
  id: string;
  name: string;
  pos: [number, number];
  tags: string[];
  hp: number;
  maxHp: number;
  isDestroyed: boolean;
}

interface InjectedNPC {
  id: string;
  name: string;
  role: string;
  pos: [number, number];
  tags: string[];
  faction: string;
  hp: number;
  maxHp: number;
  disposition: number;
  alive: boolean;
}

interface QuestObjective {
  id: string;
  type: string;
  description: string;
  targetId: string;
  requiredCount: number;
  currentCount: number;
  completed: boolean;
}

interface StoryBeat {
  beatId: string;
  category: string;
  title: string;
  hook: string;
  questGiver: { name: string; role: string; faction?: string };
  opposingFaction?: string;
  objectives: QuestObjective[];
  rewards: { xp: number; gold: number; item?: string };
  pivotDecision: string;
  variants: Array<{
    name: string;
    description: string;
    preferredStat: string;
  }>;
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

  if (role.includes('guard') || role.includes('soldier') || role.includes('knight')) {
    return { col: 4, row: 0 }; // Bear Knight
  } else if (role.includes('bandit') || role.includes('thief') || role.includes('raider')) {
    return { col: 0, row: 0 }; // Wolf Brigand
  } else if (role.includes('cultist') || role.includes('priest') || role.includes('warlock')) {
    return { col: 14, row: 6 }; // Octopus Occultist
  } else if (role.includes('merchant') || role.includes('trader')) {
    return { col: 4, row: 4 }; // Owl Merchant
  } else if (role.includes('druid') || role.includes('herbalist')) {
    return { col: 0, row: 8 }; // Tree-Kin Druid
  } else if (role.includes('scholar') || role.includes('scribe')) {
    return { col: 0, row: 2 }; // Ant-Kin Scholar
  } else if (role.includes('hunter') || role.includes('scout')) {
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

function App() {
  const [messages, setMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [character, setCharacter] = useState<any>(null);

  const [regionalPos, setRegionalPos] = useState({ rx: 105, ry: 112 });
  const [localPos, setLocalPos] = useState({ lx: 128, ly: 128 });

  const [manifest, setManifest] = useState<any>(null);
  const [tilemap, setTilemap] = useState<{ grid: Uint8Array; size: number } | null>(null);

  // DeepMind Concordia & WhatELSE Grounded State
  const [injectedProps, setInjectedProps] = useState<InjectedProp[]>([]);
  const [injectedNPCs, setInjectedNPCs] = useState<InjectedNPC[]>([]);
  const [activeBeat, setActiveBeat] = useState<StoryBeat | null>(null);
  const [campaignState, setCampaignState] = useState<any>(null);

  const [encounterTarget, setEncounterTarget] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isActing, setIsActing] = useState(false);

  // Background Music & SFX Manager State
  const [isPlayingMusic, setIsPlayingMusic] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(audioManager.getCurrentTrack());
  const [isMuted, setIsMuted] = useState(false);
  const [musicVol, setMusicVol] = useState(0.35);
  const [sfxMuted, setSfxMuted] = useState(false);

  const handleToggleMusic = () => {
    audioManager.toggleMusic();
    setIsPlayingMusic(audioManager.isMusicPlaying());
    setCurrentTrack(audioManager.getCurrentTrack());
  };

  const handleNextTrack = () => {
    audioManager.nextTrack();
    setIsPlayingMusic(true);
    setCurrentTrack(audioManager.getCurrentTrack());
  };

  const handleToggleMute = () => {
    audioManager.toggleMuteMusic();
    setIsMuted(audioManager.isMusicMute());
  };

  const handleToggleSfx = () => {
    audioManager.toggleMuteSfx();
    setSfxMuted(audioManager.isSfxMute());
  };

  const handleVolumeChange = (v: number) => {
    setMusicVol(v);
    audioManager.setMusicVolume(v);
  };

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastEncounterId = useRef<string | null>(null);

  // Pixel Art Tileset & Spritesheet Assets from /gfx
  const overworldImgRef = useRef<HTMLImageElement | null>(null);
  const objectsImgRef = useRef<HTMLImageElement | null>(null);
  const caveImgRef = useRef<HTMLImageElement | null>(null);
  const innerImgRef = useRef<HTMLImageElement | null>(null);
  const animalSpritesImgRef = useRef<HTMLImageElement | null>(null);
  const [gfxLoaded, setGfxLoaded] = useState(false);

  useEffect(() => {
    let count = 0;
    const onLoad = () => {
      count++;
      if (count >= 3) setGfxLoaded(true);
    };

    const ow = new Image();
    ow.onload = onLoad;
    ow.src = '/gfx/Overworld.png';
    overworldImgRef.current = ow;

    const obj = new Image();
    obj.onload = onLoad;
    obj.src = '/gfx/objects.png';
    objectsImgRef.current = obj;

    const cv = new Image();
    cv.onload = onLoad;
    cv.src = '/gfx/cave.png';
    caveImgRef.current = cv;

    const inn = new Image();
    inn.onload = onLoad;
    inn.src = '/gfx/Inner.png';
    innerImgRef.current = inn;

    const anim = new Image();
    anim.onload = onLoad;
    anim.src = '/gfx/Gemini_Generated_Image_a4motwa4motwa4mo.png';
    animalSpritesImgRef.current = anim;
  }, []);

  // View Tab: Tactical Battlegrid vs. World Map Reference
  const [activeCenterTab, setActiveCenterTab] = useState<'battlegrid' | 'worldMap'>('battlegrid');
  const [worldRefData, setWorldRefData] = useState<any>(null);

  // Game Save & Character Creation Modals
  const [inStartMenu, setInStartMenu] = useState(true);
  const [showCharModal, setShowCharModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [showDeathModal, setShowDeathModal] = useState(false);
  const [autoSaveToast, setAutoSaveToast] = useState<string | null>(null);

  const [creationTab, setCreationTab] = useState<'bodyHeritage' | 'mindDoctrine' | 'tracks' | 'review'>('bodyHeritage');
  const [optionsData, setOptionsData] = useState<any>(null);

  const BODY_STAT_KEYS: string[] = ['might', 'endurance', 'finesse', 'reflex', 'vitality', 'fortitude'];
  const MIND_STAT_KEYS: string[] = ['knowledge', 'logic', 'awareness', 'intuition', 'charm', 'willpower'];

  const KINGDOM_PROFILES: Record<string, {
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

  const QUICK_PRESETS = [
    {
      name: 'Juggernaut',
      icon: '🛡️',
      tagline: 'Vitality • Heavy Brawler',
      desc: 'Colossal bear-warrior clad in heavy Osmium plate, crushing armor with raw mass.',
      kingdom: 'Mammal',
      lineage: 'Ursine',
      species: 'Bear-Folk',
      institution: 'Mass',
      body7: 'vitality',
      body4: 'might',
      body6: 'fortitude',
      body3: 'endurance',
      body5: 'finesse',
      body2: 'reflex',
      mind7: 'knowledge',
      mind4: 'logic',
      mind6: 'awareness',
      mind3: 'intuition',
      mind5: 'willpower',
      mind2: 'charm',
      trackId: 'track_might',
      offenseSkillId: 'off_might',
      defenseSkillId: 'def_might',
      offenseBranchChoice: 'SPECIALIZATION',
      defenseBranchChoice: 'SPECIALIZATION',
      powerBranchChoice: 'OFFENSE',
      equippedWeapon: 'Osmium Greatsword',
      equippedArmor: 'Juggernaut Osmium Plate'
    },
    {
      name: 'Skirmisher',
      icon: '🗡️',
      tagline: 'Endurance • Blade Deflection',
      desc: 'Swift venomous duelist delivering surgical piercing strikes with high reflex and evasion.',
      kingdom: 'Reptile',
      lineage: 'Pit-Vipers',
      species: 'Viper-Folk',
      institution: 'Flux',
      body7: 'endurance',
      body4: 'finesse',
      body6: 'reflex',
      body3: 'might',
      body5: 'vitality',
      body2: 'fortitude',
      mind7: 'intuition',
      mind4: 'awareness',
      mind6: 'logic',
      mind3: 'knowledge',
      mind5: 'charm',
      mind2: 'willpower',
      trackId: 'track_finesse',
      offenseSkillId: 'off_finesse',
      defenseSkillId: 'def_finesse',
      offenseBranchChoice: 'SPECIALIZATION',
      defenseBranchChoice: 'SPECIALIZATION',
      powerBranchChoice: 'OFFENSE',
      equippedWeapon: 'Obsidian Rapier',
      equippedArmor: 'Scaled Viper Cuirass'
    },
    {
      name: 'Arcanist',
      icon: '🔮',
      tagline: 'Reflex • Forbidden Sorcery',
      desc: 'Strigid owl sage manipulating forbidden manuscripts, null wards, and arcane energy.',
      kingdom: 'Avian',
      lineage: 'Owls',
      species: 'Strigid-Folk',
      institution: 'Anumis',
      body7: 'reflex',
      body4: 'finesse',
      body6: 'vitality',
      body3: 'endurance',
      body5: 'might',
      body2: 'fortitude',
      mind7: 'knowledge',
      mind4: 'logic',
      mind6: 'awareness',
      mind3: 'intuition',
      mind5: 'willpower',
      mind2: 'charm',
      trackId: 'track_knowledge',
      offenseSkillId: 'off_knowledge',
      defenseSkillId: 'def_knowledge',
      offenseBranchChoice: 'ACTIVE',
      defenseBranchChoice: 'ACTIVE',
      powerBranchChoice: 'UTILITY',
      equippedWeapon: 'Blackstone Stave',
      equippedArmor: 'Aetheric Silk Mantle'
    },
    {
      name: 'Stalker',
      icon: '🏹',
      tagline: 'Finesse • Acute Tracker',
      desc: 'Keen canine tracker wielding composite bows, sensing hazards from across the sector.',
      kingdom: 'Aquatic',
      lineage: 'Catfish',
      species: 'Silurid-Folk',
      institution: 'Lux',
      body7: 'finesse',
      body4: 'reflex',
      body6: 'endurance',
      body3: 'might',
      body5: 'fortitude',
      body2: 'vitality',
      mind7: 'awareness',
      mind4: 'intuition',
      mind6: 'logic',
      mind3: 'knowledge',
      mind5: 'willpower',
      mind2: 'charm',
      trackId: 'track_awareness',
      offenseSkillId: 'off_awareness',
      defenseSkillId: 'def_awareness',
      offenseBranchChoice: 'SPECIALIZATION',
      defenseBranchChoice: 'PASSIVE',
      powerBranchChoice: 'UTILITY',
      equippedWeapon: 'Composite Recurve Bow',
      equippedArmor: 'Hardened Leather Cuirass'
    }
  ];

  const STAT_INFO: Record<string, { label: string; icon: string; desc: string }> = {
    might: { label: 'Might', icon: '⚔️', desc: 'Raw crushing power & colossal impact' },
    endurance: { label: 'Endurance', icon: '🛡️', desc: 'Stamina reserves & siege endurance' },
    finesse: { label: 'Finesse', icon: '🗡️', desc: 'Anatomical precision & edge control' },
    reflex: { label: 'Reflex', icon: '⚡', desc: 'Reaction velocity & kinetic evasion' },
    vitality: { label: 'Vitality', icon: '❤️', desc: 'Cellular recovery & visceral vigor' },
    fortitude: { label: 'Fortitude', icon: '🧱', desc: 'Adamantine bone density & trauma mitigation' },
    knowledge: { label: 'Knowledge', icon: '📜', desc: 'Cosmic manuscripts & forbidden lore' },
    logic: { label: 'Logic', icon: '📐', desc: 'Tactical geometry & trajectory calculation' },
    awareness: { label: 'Awareness', icon: '👁️', desc: 'Danger detection & micro-ambush foresight' },
    intuition: { label: 'Intuition', icon: '🔮', desc: 'Premonitory sixth sense & temporal ripples' },
    charm: { label: 'Charm', icon: '👑', desc: 'Magnetic pheromones & morale command' },
    willpower: { label: 'Willpower', icon: '🔥', desc: 'Indomitable soul fortitude & sanity defense' }
  };

  const recalculateForm = (form: any, opts: any) => {
    const kMap: Record<string, string> = {
      vitality: 'Mammal',
      endurance: 'Reptile',
      reflex: 'Avian',
      finesse: 'Aquatic',
      might: 'Insect',
      fortitude: 'Plant'
    };
    const kingdom = kMap[form.body7] || form.kingdom || 'Mammal';
    const lineageList = opts?.lineages?.[kingdom] || [];
    const lin = lineageList.find((l: any) => l.name === form.lineage)
      || lineageList.find((l: any) => l.plus === form.body6)
      || lineageList[0];
    const inst = opts?.institutions?.find((i: any) => i.name === form.institution) || opts?.institutions?.[0];

    // Strictly 60-point budget: start stats at 0
    const stats: Record<string, number> = {
      might: 0, endurance: 0, finesse: 0, reflex: 0, vitality: 0, fortitude: 0,
      knowledge: 0, logic: 0, awareness: 0, intuition: 0, charm: 0, willpower: 0
    };

    // Body Splits (+7, +4, +6, +3, +5, +2 = 27)
    if (form.body7) stats[form.body7] = (stats[form.body7] || 0) + 7;
    if (form.body4) stats[form.body4] = (stats[form.body4] || 0) + 4;
    if (form.body6) stats[form.body6] = (stats[form.body6] || 0) + 6;
    if (form.body3) stats[form.body3] = (stats[form.body3] || 0) + 3;
    if (form.body5) stats[form.body5] = (stats[form.body5] || 0) + 5;
    if (form.body2) stats[form.body2] = (stats[form.body2] || 0) + 2;

    // Mind Splits (+7, +4, +6, +3, +5, +2 = 27)
    if (form.mind7) stats[form.mind7] = (stats[form.mind7] || 0) + 7;
    if (form.mind4) stats[form.mind4] = (stats[form.mind4] || 0) + 4;
    if (form.mind6) stats[form.mind6] = (stats[form.mind6] || 0) + 6;
    if (form.mind3) stats[form.mind3] = (stats[form.mind3] || 0) + 3;
    if (form.mind5) stats[form.mind5] = (stats[form.mind5] || 0) + 5;
    if (form.mind2) stats[form.mind2] = (stats[form.mind2] || 0) + 2;

    // Choice 7: Track (+2 bonus: either 1 track for +2 or 2 tracks for +1 each)
    let trackDescName = 'Mass Track';
    let trackTraits: Array<{ name: string; desc: string }> = [];
    if (form.dualTrackMode) {
      const t1 = (opts?.powerNullTracks || []).find((t: any) => t.id === form.trackId) || opts?.powerNullTracks?.[0];
      const t2 = (opts?.powerNullTracks || []).find((t: any) => t.id === form.trackId2 && t.id !== t1?.id) || opts?.powerNullTracks?.[1];
      if (t1) stats[t1.stat] = (stats[t1.stat] || 0) + 1;
      if (t2) stats[t2.stat] = (stats[t2.stat] || 0) + 1;
      trackDescName = `${t1?.name || 'Track 1'} / ${t2?.name || 'Track 2'}`;
      if (t1) trackTraits.push({ name: `Dual Track: ${t1.powerName}`, desc: `${t1.powerDesc} (+1 ${t1.stat.toUpperCase()})` });
      if (t2) trackTraits.push({ name: `Dual Track: ${t2.nullName}`, desc: `${t2.nullDesc} (+1 ${t2.stat.toUpperCase()})` });
    } else {
      const track = (opts?.powerNullTracks || []).find((t: any) => t.id === form.trackId);
      if (track) {
        stats[track.stat] = (stats[track.stat] || 0) + 2;
        trackDescName = track.name;
        trackTraits.push({ name: `Track: ${track.powerName}`, desc: `${track.powerDesc} / Null: ${track.nullDesc} (+2 ${track.stat.toUpperCase()})` });
      }
    }

    // Choice 8: Offense Skill (+2)
    const offSkill = (opts?.offenseSkills || []).find((s: any) => s.id === form.offenseSkillId);
    if (offSkill) stats[offSkill.stat] = (stats[offSkill.stat] || 0) + 2;

    // Choice 9: Defense Skill (+2)
    const defSkill = (opts?.defenseSkills || []).find((s: any) => s.id === form.defenseSkillId);
    if (defSkill) stats[defSkill.stat] = (stats[defSkill.stat] || 0) + 2;

    // Canonical 3-Branch x 4-Rank Skill Progression Calculation
    const skillRanks: Record<string, number> = form.skillRanks ? { ...form.skillRanks } : {};

    const offStat = offSkill ? offSkill.stat : 'might';
    const offBranchType = form.offenseBranchChoice || 'SPECIALIZATION';
    const offBranchId = offBranchType === 'SPECIALIZATION'
      ? `spec_weapon_${offStat}`
      : offBranchType === 'PASSIVE'
      ? `pass_${offStat}`
      : `act_off_${offStat}`;
    if (!skillRanks[offBranchId]) skillRanks[offBranchId] = 1;

    const defStat = defSkill ? defSkill.stat : 'might';
    const defBranchType = form.defenseBranchChoice || 'SPECIALIZATION';
    const defBranchId = defBranchType === 'SPECIALIZATION'
      ? `spec_armor_${defStat}`
      : defBranchType === 'PASSIVE'
      ? `pass_def_${defStat}`
      : `act_def_${defStat}`;
    if (!skillRanks[defBranchId]) skillRanks[defBranchId] = 1;

    if (form.dualTrackMode) {
      const t1 = (opts?.powerNullTracks || []).find((t: any) => t.id === form.trackId) || opts?.powerNullTracks?.[0];
      const t2 = (opts?.powerNullTracks || []).find((t: any) => t.id === form.trackId2 && t.id !== t1?.id) || opts?.powerNullTracks?.[1];
      const bChoice1 = (form.powerBranchChoice || 'OFFENSE').toLowerCase();
      const bChoice2 = (form.powerBranchChoice2 || 'DEFENSE').toLowerCase();
      if (t1) {
        const pId1 = `pow_${bChoice1 === 'offense' ? 'off' : bChoice1 === 'defense' ? 'def' : 'util'}_${t1.stat}`;
        if (!skillRanks[pId1]) skillRanks[pId1] = 1;
      }
      if (t2) {
        const pId2 = `null_${bChoice2 === 'offense' ? 'off' : bChoice2 === 'defense' ? 'def' : 'util'}_${t2.stat}`;
        if (!skillRanks[pId2]) skillRanks[pId2] = 1;
      }
    } else {
      const track = (opts?.powerNullTracks || []).find((t: any) => t.id === form.trackId);
      if (track) {
        const bChoice = (form.powerBranchChoice || 'OFFENSE').toLowerCase();
        const pId = `pow_${bChoice === 'offense' ? 'off' : bChoice === 'defense' ? 'def' : 'util'}_${track.stat}`;
        if (!skillRanks[pId]) skillRanks[pId] = 1;
      }
    }

    // Unlocked perks
    const activePerks = (opts?.masteryPerks || []).filter((p: any) => (stats[p.stat] || 0) >= p.level);

    return {
      ...form,
      ...stats,
      kingdom,
      lineage: lin ? lin.name : form.lineage,
      species: lin ? lin.speciesType : form.species,
      powerNullTrack: trackDescName,
      offenseSkill: offSkill ? offSkill.name : form.offenseSkill,
      defenseSkill: defSkill ? defSkill.name : form.defenseSkill,
      skillRanks,
      passiveTraits: [
        lin ? { name: lin.traitName, desc: lin.traitDesc } : null,
        ...trackTraits,
        inst ? { name: `Brand of ${inst.name}`, desc: inst.descriptor } : null
      ].filter(Boolean),
      skills: [
        offSkill ? { id: offSkill.id, name: offSkill.name, cost: offSkill.cost, desc: `${offSkill.desc} (+2 ${offSkill.stat.toUpperCase()})` } : null,
        defSkill ? { id: defSkill.id, name: defSkill.name, cost: defSkill.cost, desc: `${defSkill.desc} (+2 ${defSkill.stat.toUpperCase()})` } : null
      ].filter(Boolean),
      masteryPerks: activePerks
    };
  };

  const [creationForm, setCreationForm] = useState<any>({
    name: 'Morvath Hearth-Bite',
    kingdom: 'Mammal',
    lineage: 'Ursine',
    species: 'Bear-Folk',
    institution: 'Mass',
    body7: 'vitality',
    body4: 'might',
    body6: 'fortitude',
    body3: 'endurance',
    body5: 'finesse',
    body2: 'reflex',
    mind7: 'knowledge',
    mind4: 'logic',
    mind6: 'awareness',
    mind3: 'intuition',
    mind5: 'willpower',
    mind2: 'charm',
    dualTrackMode: false,
    trackId: 'track_might',
    trackId2: 'track_endurance',
    powerNullTrack: 'Mass Track',
    offenseSkillId: 'off_might',
    offenseSkill: 'Shatter Impact',
    defenseSkillId: 'def_might',
    defenseSkill: 'Brace Impact',
    offenseBranchChoice: 'SPECIALIZATION',
    defenseBranchChoice: 'SPECIALIZATION',
    powerBranchChoice: 'OFFENSE',
    powerBranchChoice2: 'DEFENSE',
    skillRanks: {
      spec_weapon_might: 1,
      spec_armor_might: 1,
      pow_off_might: 1
    },
    might: 10,
    endurance: 3,
    finesse: 5,
    reflex: 2,
    vitality: 7,
    fortitude: 6,
    knowledge: 7,
    logic: 4,
    awareness: 6,
    intuition: 3,
    charm: 2,
    willpower: 5,
    equippedWeapon: 'Osmium Greatsword',
    weapon_stat: 'might',
    weapon_mod: 2,
    weapon_damage_bonus: 2,
    weapon_metal: 'Osmium',
    weapon_tags: ['metal', 'cut', 'slashing', 'heavy'],
    weapon_desc: 'Colossal blade of dense bluish Osmium. Delivers devastating cleaving blows using pure mass.',
    equippedArmor: 'Juggernaut Osmium Plate',
    armor_stat: 'might',
    armor_mod: 3,
    armor_dr: 3,
    armor_metal: 'Osmium',
    armor_tags: ['metal', 'heavy_plate'],
    armor_desc: 'Full segmented plate forged of unyielding Osmium.',
    passiveTraits: [
      { name: 'Hearth-Fat', desc: 'Thick adipose insulation grants immunity to absolute freezing and cold penalties.' },
      { name: 'Brand of Mass', desc: 'Implacable Gravity' }
    ],
    skills: [
      { id: 'off_might', name: 'Shatter Impact', cost: '2 Stamina', desc: 'Devastating overhead crushing strike that fractures defender armor DR. (+2 MIGHT)' },
      { id: 'def_might', name: 'Brace Impact', cost: '1 Stamina', desc: 'Anchor footing with brute brawn to halve incoming physical shock damage. (+2 MIGHT)' }
    ],
    masteryPerks: [],
    difficulty: 'survivor'
  });

  const [saveSlots, setSaveSlots] = useState<any[]>([]);
  const [saveSlotName, setSaveSlotName] = useState('');
  const [showMemorialModal, setShowMemorialModal] = useState(false);
  const [memorialList, setMemorialList] = useState<any[]>([]);
  const [hardcoreDeathProcessed, setHardcoreDeathProcessed] = useState(false);

  // 3-Branch x 4-Rank Skill Progression Modal State
  const [showSkillsModal, setShowSkillsModal] = useState(false);
  const [skillsModalTab, setSkillsModalTab] = useState<'active' | 'combat' | 'reality'>('active');
  const [skillsSelectedStat, setSkillsSelectedStat] = useState<string>('might');
  const [skillsRealityMode, setSkillsRealityMode] = useState<'POWER' | 'NULL'>('POWER');
  const [levelUpSubmitting, setLevelUpSubmitting] = useState(false);

  const handleInvestSkillRank = async (branchId?: string, grantFreeLevel?: boolean) => {
    if (levelUpSubmitting) return;
    setLevelUpSubmitting(true);
    try {
      const res = await fetch('http://localhost:3000/api/dm/player/levelup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branchId, grantFreeLevel })
      });
      const data = await res.json();
      if (data.success && data.character) {
        setCharacter(data.character);
      } else if (data.error) {
        alert(data.error);
      }
    } catch (err) {
      console.error('Failed to level up skill rank:', err);
    } finally {
      setLevelUpSubmitting(false);
    }
  };

  const FIRST_NAMES: Record<string, string[]> = {
    Mammal: ['Morvath', 'Garrick', 'Valeria', 'Torvold', 'Lysandra', 'Kaelen', 'Bran', 'Brynna', 'Morwen'],
    Reptile: ['Karkash', 'Ssilas', 'Varn', 'Zulkor', 'Ssaryx', 'Korith', 'Vasha', 'Skesh'],
    Avian: ['Aves', 'Aquila', 'Corvus', 'Vael', 'Zephyr', 'Talon', 'Phaeron', 'Skystride'],
    Aquatic: ['Nereus', 'Maris', 'Thalor', 'Kedge', 'Drakon', 'Pelagius', 'Undine', 'Vellor'],
    Insect: ['Chitin', 'Vespis', 'Khepri', 'Myrmex', 'Mantor', 'Scythe', 'Zorath', 'Skitter'],
    Plant: ['Sylvan', 'Bramble', 'Verdant', 'Oakhaven', 'Yggdra', 'Cortex', 'Spore', 'Liana']
  };

  const EPITHETS = [
    'Iron-Biter', 'the Red', 'the Swift', 'Stone-Foot', 'the Silent',
    'the Grim', 'the Defiant', 'Blood-Seeker', 'of the Ash', 'Void-Walker',
    'the Unyielding', 'Shadow-Stalker', 'Deep-Warden', 'Frost-Scarred'
  ];

  const handleRandomizeName = () => {
    const list = FIRST_NAMES[creationForm.kingdom] || FIRST_NAMES.Mammal;
    const fn = list[Math.floor(Math.random() * list.length)];
    const ep = EPITHETS[Math.floor(Math.random() * EPITHETS.length)];
    setCreationForm((prev: any) => ({ ...prev, name: `${fn} ${ep}` }));
  };

  const handleRollCharacter = async (reqK?: string, reqL?: string, reqI?: string) => {
    try {
      const res = await fetch('http://localhost:3000/api/dm/character/roll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kingdom: reqK || creationForm.kingdom,
          lineage: reqL || creationForm.lineage,
          institution: reqI || creationForm.institution
        })
      });
      if (res.ok) {
        const data = await res.json();
        setCreationForm((prev: any) => ({
          ...prev,
          kingdom: data.kingdom,
          lineage: data.lineage,
          species: data.species,
          institution: data.institution,
          powerNullTrack: data.powerNullTrack,
          trackId: data.trackId,
          offenseSkill: data.offenseSkill,
          offenseSkillId: data.offenseSkillId,
          defenseSkill: data.defenseSkill,
          defenseSkillId: data.defenseSkillId,
          body7: data.body7,
          body4: data.body4,
          body6: data.body6,
          body3: data.body3,
          body5: data.body5,
          body2: data.body2,
          mind7: data.mind7,
          mind4: data.mind4,
          mind6: data.mind6,
          mind3: data.mind3,
          mind5: data.mind5,
          mind2: data.mind2,
          might: data.might,
          endurance: data.endurance,
          finesse: data.finesse,
          reflex: data.reflex,
          vitality: data.vitality,
          fortitude: data.fortitude,
          knowledge: data.knowledge,
          logic: data.logic,
          awareness: data.awareness,
          intuition: data.intuition,
          charm: data.charm,
          willpower: data.willpower,
          equippedWeapon: data.equippedWeapon,
          weapon_stat: data.weapon_stat,
          weapon_mod: data.weapon_mod,
          weapon_damage_bonus: data.weapon_damage_bonus,
          weapon_metal: data.weapon_metal,
          weapon_tags: data.weapon_tags,
          weapon_desc: data.weapon_desc,
          equippedArmor: data.equippedArmor,
          armor_stat: data.armor_stat,
          armor_mod: data.armor_mod,
          armor_dr: data.armor_dr,
          armor_metal: data.armor_metal,
          armor_tags: data.armor_tags,
          armor_desc: data.armor_desc,
          passiveTraits: data.passiveTraits || [],
          skills: data.skills || [],
          masteryPerks: data.masteryPerks || []
        }));
      }
    } catch {}
  };

  const handleSelectLineage = (lineageName: string) => {
    if (!optionsData?.lineages) return;
    const lineageList = optionsData.lineages[creationForm.kingdom] || [];
    const lin = lineageList.find((l: any) => l.name === lineageName);
    if (!lin) return;
    setCreationForm((prev: any) => {
      const updated = {
        ...prev,
        lineage: lin.name,
        species: lin.speciesType
      };
      return recalculateForm(updated, optionsData);
    });
  };

  const getAvailableBodyOptions = (slot: string) => {
    const current = creationForm[slot];
    if (slot === 'body7') return BODY_STAT_KEYS;
    if (slot === 'body4') return BODY_STAT_KEYS.filter(s => s !== creationForm.body7 || s === current);
    if (slot === 'body6') return BODY_STAT_KEYS.filter(s => (s !== creationForm.body7 && s !== creationForm.body4) || s === current);
    if (slot === 'body3') return BODY_STAT_KEYS.filter(s => (s !== creationForm.body7 && s !== creationForm.body4 && s !== creationForm.body6) || s === current);
    if (slot === 'body5') return BODY_STAT_KEYS.filter(s => (s !== creationForm.body7 && s !== creationForm.body4 && s !== creationForm.body6 && s !== creationForm.body3) || s === current);
    return BODY_STAT_KEYS.filter(s => (s !== creationForm.body7 && s !== creationForm.body4 && s !== creationForm.body6 && s !== creationForm.body3 && s !== creationForm.body5) || s === current);
  };

  const getAvailableMindOptions = (slot: string) => {
    const current = creationForm[slot];
    if (slot === 'mind7') return MIND_STAT_KEYS;
    if (slot === 'mind4') return MIND_STAT_KEYS.filter(s => s !== creationForm.mind7 || s === current);
    if (slot === 'mind6') return MIND_STAT_KEYS.filter(s => (s !== creationForm.mind7 && s !== creationForm.mind4) || s === current);
    if (slot === 'mind3') return MIND_STAT_KEYS.filter(s => (s !== creationForm.mind7 && s !== creationForm.mind4 && s !== creationForm.mind6) || s === current);
    if (slot === 'mind5') return MIND_STAT_KEYS.filter(s => (s !== creationForm.mind7 && s !== creationForm.mind4 && s !== creationForm.mind6 && s !== creationForm.mind3) || s === current);
    return MIND_STAT_KEYS.filter(s => (s !== creationForm.mind7 && s !== creationForm.mind4 && s !== creationForm.mind6 && s !== creationForm.mind3 && s !== creationForm.mind5) || s === current);
  };

  const setBodySplit = (role: string, stat: string) => {
    setCreationForm((prev: any) => {
      const slots = ['body7', 'body4', 'body6', 'body3', 'body5', 'body2'];
      const currentSlot = slots.find(s => prev[s] === stat);
      const updated = { ...prev };
      if (currentSlot && currentSlot !== role) {
        updated[currentSlot] = prev[role];
      }
      updated[role] = stat;
      if (role === 'body7') {
        const kMap: Record<string, string> = {
          vitality: 'Mammal',
          endurance: 'Reptile',
          reflex: 'Avian',
          finesse: 'Aquatic',
          might: 'Insect',
          fortitude: 'Plant'
        };
        updated.kingdom = kMap[stat] || 'Mammal';
      }
      return recalculateForm(updated, optionsData);
    });
  };

  const setMindSplit = (role: string, stat: string) => {
    setCreationForm((prev: any) => {
      const slots = ['mind7', 'mind4', 'mind6', 'mind3', 'mind5', 'mind2'];
      const currentSlot = slots.find(s => prev[s] === stat);
      const updated = { ...prev };
      if (currentSlot && currentSlot !== role) {
        updated[currentSlot] = prev[role];
      }
      updated[role] = stat;
      return recalculateForm(updated, optionsData);
    });
  };

  const handleToggleDualTrack = (dual: boolean) => {
    setCreationForm((prev: any) => {
      const updated = { ...prev, dualTrackMode: dual };
      return recalculateForm(updated, optionsData);
    });
  };

  const handleSelectTrack = (trackId: string) => {
    setCreationForm((prev: any) => {
      const updated = { ...prev, trackId };
      return recalculateForm(updated, optionsData);
    });
  };

  const handleSelectTrack2 = (trackId2: string) => {
    setCreationForm((prev: any) => {
      const updated = { ...prev, trackId2 };
      return recalculateForm(updated, optionsData);
    });
  };

  const handleSelectOffenseSkill = (offenseSkillId: string) => {
    setCreationForm((prev: any) => {
      const updated = { ...prev, offenseSkillId };
      return recalculateForm(updated, optionsData);
    });
  };

  const handleSelectOffenseBranch = (offenseBranchChoice: 'SPECIALIZATION' | 'PASSIVE' | 'ACTIVE') => {
    setCreationForm((prev: any) => {
      const updated = { ...prev, offenseBranchChoice };
      return recalculateForm(updated, optionsData);
    });
  };

  const handleSelectDefenseSkill = (defenseSkillId: string) => {
    setCreationForm((prev: any) => {
      const updated = { ...prev, defenseSkillId };
      return recalculateForm(updated, optionsData);
    });
  };

  const handleSelectDefenseBranch = (defenseBranchChoice: 'SPECIALIZATION' | 'PASSIVE' | 'ACTIVE') => {
    setCreationForm((prev: any) => {
      const updated = { ...prev, defenseBranchChoice };
      return recalculateForm(updated, optionsData);
    });
  };

  const handleSelectPowerBranch = (powerBranchChoice: 'OFFENSE' | 'DEFENSE' | 'UTILITY') => {
    setCreationForm((prev: any) => {
      const updated = { ...prev, powerBranchChoice };
      return recalculateForm(updated, optionsData);
    });
  };

  const handleSelectPowerBranch2 = (powerBranchChoice2: 'OFFENSE' | 'DEFENSE' | 'UTILITY') => {
    setCreationForm((prev: any) => {
      const updated = { ...prev, powerBranchChoice2 };
      return recalculateForm(updated, optionsData);
    });
  };

  const handleSelectWeapon = (weaponName: string) => {
    if (!optionsData?.weapons) return;
    let foundWpn: any = null;
    for (const group of Object.values(optionsData.weapons) as any[]) {
      const match = group.find((w: any) => w.name === weaponName);
      if (match) { foundWpn = match; break; }
    }
    if (foundWpn) {
      setCreationForm((prev: any) => ({
        ...prev,
        equippedWeapon: foundWpn.name,
        weapon_stat: foundWpn.stat,
        weapon_mod: foundWpn.mod,
        weapon_damage_bonus: foundWpn.damageBonus,
        weapon_metal: foundWpn.conductorMetal,
        weapon_tags: foundWpn.tags,
        weapon_desc: foundWpn.description
      }));
    }
  };

  const handleSelectArmor = (armorName: string) => {
    if (!optionsData?.armors) return;
    let foundArm: any = null;
    for (const group of Object.values(optionsData.armors) as any[]) {
      const match = group.find((a: any) => a.name === armorName);
      if (match) { foundArm = match; break; }
    }
    if (foundArm) {
      setCreationForm((prev: any) => ({
        ...prev,
        equippedArmor: foundArm.name,
        armor_stat: foundArm.stat,
        armor_mod: foundArm.mod,
        armor_dr: foundArm.damageReduction,
        armor_metal: foundArm.conductorMetal,
        armor_tags: foundArm.tags,
        armor_desc: foundArm.description
      }));
    }
  };

  const getDerivedCalculations = () => {
    const v = Number(creationForm.vitality) || 1;
    const e = Number(creationForm.endurance) || 1;
    const w = Number(creationForm.willpower) || 1;
    const m = Number(creationForm.might) || 1;
    const f = Number(creationForm.finesse) || 1;
    const it = Number(creationForm.intuition) || 1;
    const l = Number(creationForm.logic) || 1;
    const ch = Number(creationForm.charm) || 1;
    const r = Number(creationForm.reflex) || 1;
    const k = Number(creationForm.knowledge) || 1;
    const aw = Number(creationForm.awareness) || 1;
    const fort = Number(creationForm.fortitude) || 1;

    return {
      hp: 10 + v + e + Math.round(w / 2),
      composure: 10 + k + aw + Math.round(fort / 2),
      stamina: m + f + Math.round(it / 2),
      focus: l + ch + Math.round(r / 2),
      physDefense: m + fort + Math.round(l / 2),
      speed: v + r + Math.round(ch / 2),
      perception: aw + k + Math.round(f / 2),
      mentalDefense: w + it + Math.round(e / 2)
    };
  };

  const applyPreset = (preset: any) => {
    setCreationForm((prev: any) => {
      let updated = {
        ...prev,
        kingdom: preset.kingdom,
        lineage: preset.lineage,
        species: preset.species,
        institution: preset.institution,
        body7: preset.body7,
        body4: preset.body4,
        body6: preset.body6,
        body3: preset.body3,
        body5: preset.body5,
        body2: preset.body2,
        mind7: preset.mind7,
        mind4: preset.mind4,
        mind6: preset.mind6,
        mind3: preset.mind3,
        mind5: preset.mind5,
        mind2: preset.mind2,
        trackId: preset.trackId,
        offenseSkillId: preset.offenseSkillId,
        defenseSkillId: preset.defenseSkillId,
        equippedWeapon: preset.equippedWeapon,
        equippedArmor: preset.equippedArmor
      };
      return recalculateForm(updated, optionsData);
    });
  };

  const triggerAutoSave = async (slotLabel = 'AutoSave') => {
    if (!character) return;
    try {
      const res = await fetch('http://localhost:3000/api/dm/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotName: `${slotLabel} - (${regionalPos.rx}, ${regionalPos.ry})`,
          characterData: character,
          worldPos: { cellId: CELL_ID, rx: regionalPos.rx, ry: regionalPos.ry, lx: localPos.lx, ly: localPos.ly },
          storyState: { campaignState, activeBeat }
        })
      });
      if (res.ok) {
        setAutoSaveToast(`💾 Auto-Saved: Sector (${regionalPos.rx}, ${regionalPos.ry})`);
        setTimeout(() => setAutoSaveToast(null), 3000);
      }
    } catch {}
  };

  const handleRevivePlayer = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/dm/player/revive', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.character) {
          setCharacter(data.character);
        }
        setLocalPos({ lx: 128, ly: 128 });
        setShowDeathModal(false);
        setMessages(prev => [
          ...prev,
          {
            sender: 'The Chronicler',
            text: `🕯️ REVIVED: You awaken gasping for air near the embers of a traveler's campfire at sector center (128, 128). Your wounds have been bandaged to ${data.restoredHp || 10} HP. Scavengers claimed ${data.goldLost || 0} gold while you lay senseless.`,
            type: 'narrative'
          }
        ]);
        triggerAutoSave('AutoSave - Post Revive');
      }
    } catch (err: any) {
      alert(`Revive failed: ${err.message}`);
    }
  };

  const handleHardcorePermadeath = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/dm/player/permadeath', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          causeOfDeath: 'Fell in mortal combat',
          sectorX: regionalPos.rx,
          sectorY: regionalPos.ry
        })
      });
      if (res.ok) {
        setHardcoreDeathProcessed(true);
      }
    } catch (err) {
      console.error('Permadeath error:', err);
    }
  };

  const handleOpenMemorialsModal = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/dm/memorials');
      if (res.ok) {
        const data = await res.json();
        setMemorialList(data.memorials || []);
        setShowMemorialModal(true);
      }
    } catch (err: any) {
      alert(`Could not load memorials: ${err.message}`);
    }
  };

  const handleContinue = async () => {
    if (!audioManager.isMusicPlaying()) {
      audioManager.playMusic();
      setIsPlayingMusic(true);
      setCurrentTrack(audioManager.getCurrentTrack());
    }
    if (character) {
      setInStartMenu(false);
      return;
    }
    try {
      const res = await fetch('http://localhost:3000/api/dm/player');
      if (res.ok) {
        const data = await res.json();
        setCharacter(data);
        setInStartMenu(false);
      } else {
        await handleRollCharacter();
        setShowCharModal(true);
      }
    } catch {
      setInStartMenu(false);
    }
  };

  const handleCreateCharacter = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/dm/character/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(creationForm)
      });
      if (res.ok) {
        const data = await res.json();
        setCharacter(data.character);
        setShowCharModal(false);
        setInStartMenu(false);
        if (!audioManager.isMusicPlaying()) {
          audioManager.playMusic();
          setIsPlayingMusic(true);
          setCurrentTrack(audioManager.getCurrentTrack());
        }
        setMessages(prev => [
          ...prev,
          {
            sender: 'System',
            text: `⚔️ Character created: ${data.character.name} — ${data.character.kingdom} ${data.character.species} (${data.character.lineage}) attuned to ${data.character.equipped_weapon} [${data.character.weapon_stat?.toUpperCase()}] and ${data.character.equipped_armor}!`,
            type: 'info'
          }
        ]);
        fetchSectorState(regionalPos.rx, regionalPos.ry);
      }
    } catch (err: any) {
      alert(`Error creating character: ${err.message}`);
    }
  };

  const handleSaveGame = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/dm/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotName: saveSlotName,
          characterData: character,
          worldPos: { cellId: CELL_ID, rx: regionalPos.rx, ry: regionalPos.ry, lx: localPos.lx, ly: localPos.ly },
          storyState: { campaignState, activeBeat }
        })
      });
      if (res.ok) {
        const data = await res.json();
        setShowSaveModal(false);
        setSaveSlotName('');
        setMessages(prev => [
          ...prev,
          { sender: 'System', text: `💾 Game Saved: "${data.save.slot_name}" at Sector (${regionalPos.rx}, ${regionalPos.ry})`, type: 'info' }
        ]);
      }
    } catch (err: any) {
      alert(`Save failed: ${err.message}`);
    }
  };

  const handleOpenLoadModal = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/dm/saves');
      if (res.ok) {
        const data = await res.json();
        setSaveSlots(data.saves || []);
        setShowLoadModal(true);
      }
    } catch (err: any) {
      alert(`Could not fetch saves: ${err.message}`);
    }
  };

  const handleLoadGame = async (saveId: number) => {
    try {
      const res = await fetch(`http://localhost:3000/api/dm/load/${saveId}`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.character) setCharacter(data.character);
        if (data.worldPos?.rx && data.worldPos?.ry) {
          setRegionalPos({ rx: data.worldPos.rx, ry: data.worldPos.ry });
          if (data.worldPos.lx && data.worldPos.ly) {
            setLocalPos({ lx: data.worldPos.lx, ly: data.worldPos.ly });
          }
          await fetchSectorState(data.worldPos.rx, data.worldPos.ry);
        }
        setShowLoadModal(false);
        setInStartMenu(false);
        setMessages(prev => [
          ...prev,
          { sender: 'System', text: `📂 Game Loaded: ${data.character.name} (Lv. ${data.character.level}) at Sector (${data.worldPos.rx}, ${data.worldPos.ry})`, type: 'info' }
        ]);
      }
    } catch (err: any) {
      alert(`Load failed: ${err.message}`);
    }
  };

  const handleDeleteSave = async (saveId: number) => {
    if (!confirm('Are you sure you want to delete this save?')) return;
    try {
      await fetch(`http://localhost:3000/api/dm/saves/${saveId}`, { method: 'DELETE' });
      setSaveSlots(prev => prev.filter(s => s.id !== saveId));
    } catch {}
  };

  // Fetch character stats & options & world map reference
  useEffect(() => {
    fetch('http://localhost:3000/api/dm/player')
      .then(r => r.json())
      .then(data => setCharacter(data))
      .catch(() => {});

    fetch('http://localhost:3000/api/dm/character/options')
      .then(r => r.json())
      .then(data => setOptionsData(data))
      .catch(() => {});

    fetch('/world_reference.json')
      .then(r => r.json())
      .then(data => setWorldRefData(data))
      .catch(() => {});
  }, []);

  // Initialize Backend & WhatELSE Sector
  useEffect(() => {
    async function init() {
      try {
        setMessages([{ sender: 'System', text: `Booting Concordia ECGM Engine on Global Cell ${CELL_ID}...`, type: 'info' }]);
        await fetch(`http://localhost:3000/api/regional/start/${CELL_ID}`, { method: 'POST' });
        await fetchSectorState(regionalPos.rx, regionalPos.ry);
        setLoading(false);
      } catch (err: any) {
        setMessages(prev => [...prev, { sender: 'System', text: `Initialization failed: ${err.message}`, type: 'error' }]);
      }
    }
    init();
  }, []);

  const getBiomeName = (id: number) => {
    const names = [
      'Marine', 'Hot Desert', 'Cold Desert', 'Savanna', 'Grassland', 'Chaparral',
      'Woodland', 'Boreal Forest', 'Temperate Forest', 'Tropical Forest', 'Tundra', 'Glacier', 'Wetland'
    ];
    return names[id] || 'Wilderness';
  };

  // Loads WhatELSE StoryBeat, injected props, and Concordia Game Master loop
  const fetchSectorState = async (rx: number, ry: number) => {
    try {
      const res = await fetch(`http://localhost:3000/api/regional/manifest/${CELL_ID}?x=${rx}&y=${ry}`);
      if (res.ok) {
        const data = await res.json();
        setManifest(data);

        // Procedural 256x256 Tactical Grid
        const map = generateLevel3Map(data);
        setTilemap(map);

        // Load WhatELSE Sector Injection
        const sectorRes = await fetch('http://localhost:3000/api/dm/sector_load', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            context: {
              cellId: CELL_ID,
              rx,
              ry,
              biomeName: getBiomeName(data.global_context.biome_id),
              isWarzone: data.global_context.isWarzone,
              isFamine: data.global_context.isFamine,
              chaosRadiation: data.environment.chaos_radiation,
              infrastructureMask: data.environment.infrastructure_mask,
              factionOwner: data.global_context.faction_owner,
              crimeRate: data.global_context.crime_rate,
              entitiesPresent: data.entities_present
            }
          })
        });

        if (sectorRes.ok) {
          const sectorData = await sectorRes.json();
          setInjectedProps(sectorData.props || []);
          setInjectedNPCs(sectorData.npcs || []);
          setActiveBeat(sectorData.beat || null);
          setCampaignState(sectorData.campaignState || null);
          lastEncounterId.current = null;
          setEncounterTarget(null);

          // Trigger Concordia Sensory Arrival Scene (Gemini)
          fetch('http://localhost:3000/api/dm/scene', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              context: {
                sector: `Region (${rx}, ${ry})`,
                biome: getBiomeName(data.global_context.biome_id),
                props: (sectorData.props || []).map((p: any) => p.name),
                entities: (sectorData.npcs || []).map((n: any) => n.name)
              }
            })
          })
            .then(r => r.json())
            .then(sceneData => {
              if (sceneData.scene) {
                setMessages(prev => [...prev, { sender: 'GM', text: sceneData.scene, type: 'narrative' }]);
              }
            })
            .catch(() => {});
        }
      }
    } catch (err) {
      console.error('Fetch sector error:', err);
    }
  };

  // WASD Movement with proximity encounter checks
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT') return;

      if (e.key === 'Escape') {
        if (!showCharModal && !showSaveModal && !showLoadModal && !showSkillsModal && !showMemorialModal) {
          setInStartMenu(prev => !prev);
          return;
        } else {
          setShowCharModal(false);
          setShowSaveModal(false);
          setShowLoadModal(false);
          setShowSkillsModal(false);
          setShowMemorialModal(false);
          return;
        }
      }

      if (inStartMenu || showCharModal || showSaveModal || showLoadModal || showSkillsModal || showMemorialModal || showDeathModal) return;
      if (!tilemap) return;

      let nx = localPos.lx;
      let ny = localPos.ly;
      let nr_x = regionalPos.rx;
      let nr_y = regionalPos.ry;

      if (e.key === 'w' || e.key === 'ArrowUp') ny -= 1;
      if (e.key === 's' || e.key === 'ArrowDown') ny += 1;
      if (e.key === 'a' || e.key === 'ArrowLeft') nx -= 1;
      if (e.key === 'd' || e.key === 'ArrowRight') nx += 1;

      // Hotkey action triggers (1-5)
      if (e.key === '1') { triggerAction(`I attack ${encounterTarget ? encounterTarget.name : 'the nearest threat'} with my ${character?.equipped_weapon || 'weapon'}`); return; }
      if (e.key === '2') { triggerAction(`I sneak into the shadows around ${encounterTarget ? encounterTarget.name : 'the area'}`); return; }
      if (e.key === '3') { triggerAction(`I inspect and search ${encounterTarget ? encounterTarget.name : 'the surroundings'} for clues, traps, and loot`); return; }
      if (e.key === '4') { triggerAction(`I speak to ${encounterTarget ? encounterTarget.name : 'those nearby'} to negotiate or demand answers`); return; }
      if (e.key === '5') { triggerAction('I take a tactical pause to assess my wounds and environment'); return; }

      let changedRegion = false;

      // Screen transition (Zelda style border crossing)
      if (nx < 0) { nx = 255; nr_x -= 1; changedRegion = true; }
      if (nx > 255) { nx = 0; nr_x += 1; changedRegion = true; }
      if (ny < 0) { ny = 255; nr_y -= 1; changedRegion = true; }
      if (ny > 255) { ny = 0; nr_y += 1; changedRegion = true; }

      // Collision check
      if (!changedRegion) {
        const tileType = tilemap.grid[ny * tilemap.size + nx];
        if (tileType === 1 || tileType === 2) return; // Tree or deep water
      }

      if (changedRegion) {
        audioManager.playStep();
        setRegionalPos({ rx: nr_x, ry: nr_y });
        setLocalPos({ lx: nx, ly: ny });
        fetchSectorState(nr_x, nr_y);
        triggerAutoSave('AutoSave - Regional Border');
      } else if (nx !== localPos.lx || ny !== localPos.ly) {
        setLocalPos({ lx: nx, ly: ny });
        audioManager.playStep();

        // Check proximity to Injected NPCs (within 3 tiles)
        const nearbyNPC = injectedNPCs.find(n => n.alive && Math.hypot(n.pos[0] - nx, n.pos[1] - ny) <= 3);
        const nearbyProp = injectedProps.find(p => !p.isDestroyed && Math.hypot(p.pos[0] - nx, p.pos[1] - ny) <= 2);

        const target = nearbyNPC || nearbyProp;
        if (target) {
          setEncounterTarget(target);
          if (nearbyNPC && nearbyNPC.disposition < 0) {
            audioManager.playBattleMusic();
            setCurrentTrack(audioManager.getCurrentTrack());
            setIsPlayingMusic(true);
          }
          if (target.id !== lastEncounterId.current) {
            lastEncounterId.current = target.id;
            setMessages(prev => [
              ...prev,
              {
                sender: 'GM',
                text: nearbyNPC
                  ? `⚠️ ENCOUNTER: You stand face-to-face with ${nearbyNPC.name}! They eye you with ${nearbyNPC.disposition < 0 ? 'hostile intent' : 'cautious curiosity'}. What do you do?`
                  : `📍 INTERACTION: You approach ${nearbyProp?.name}. Tags: [${(Array.isArray(nearbyProp?.tags) ? nearbyProp.tags : []).join(', ')}]. How do you interact with it?`,
                type: 'narrative'
              }
            ]);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [localPos, regionalPos, tilemap, injectedNPCs, injectedProps, character, encounterTarget, inStartMenu, showCharModal, showSaveModal, showLoadModal]);

  // Mouse Click-to-Target on Battlegrid
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const half = Math.floor(VIEWPORT_SIZE / 2);
    const clickDx = Math.floor((e.clientX - rect.left) / TILE_SIZE) - half;
    const clickDy = Math.floor((e.clientY - rect.top) / TILE_SIZE) - half;
    const clickedX = localPos.lx + clickDx;
    const clickedY = localPos.ly + clickDy;

    const clickedNPC = injectedNPCs.find(n => n.alive && Math.hypot(n.pos[0] - clickedX, n.pos[1] - clickedY) <= 1.8);
    const clickedProp = injectedProps.find(p => !p.isDestroyed && Math.hypot(p.pos[0] - clickedX, p.pos[1] - clickedY) <= 1.8);

    const target = clickedNPC || clickedProp;
    if (target) {
      setEncounterTarget(target);
      const dist = Math.round(Math.hypot(target.pos[0] - localPos.lx, target.pos[1] - localPos.ly));
      setMessages(prev => [
        ...prev,
        {
          sender: 'Tactical Grid',
          text: `🎯 TARGET LOCKED: ${target.name} at (${target.pos[0]}, ${target.pos[1]}) [${dist} tiles away]. Contextual actions ready!`,
          type: 'info'
        }
      ]);
    }
  };

  // Render Canvas with Pixel Art Tiles and Sprites from /gfx
  useEffect(() => {
    if (!canvasRef.current || !tilemap || !manifest) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    // Enable nearest-neighbor scaling for crisp retro pixel art
    ctx.imageSmoothingEnabled = false;

    ctx.fillStyle = '#050811';
    ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);

    const half = Math.floor(VIEWPORT_SIZE / 2);

    const getTileCoords = (tile: number, biomeId: number): [number, number] => {
      // Coordinates on Overworld.png (16x16 grid: 40 cols x 36 rows)
      if (tile === 0) {
        if (biomeId === 1 || biomeId === 3) return [2, 14]; // Desert/Savanna sand
        if (biomeId === 10 || biomeId === 11) return [22, 0]; // Tundra/Glacier snow
        return [0, 0]; // Lush grass
      }
      if (tile === 1) return [32, 1]; // Tree canopy
      if (tile === 2) return [16, 0]; // Water
      if (tile === 3) return [12, 0]; // Mountain cliff
      if (tile === 4) return [26, 20]; // Cobblestone / Dirt road
      if (tile === 5) return [6, 0]; // Structure wall
      if (tile === 6) return [13, 0]; // Arcane rune
      if (tile === 7) return [14, 0]; // Danger / Ruins
      if (tile === 8) return [3, 23]; // Arid desert
      if (tile === 9) return [7, 0]; // Blight / Corruption
      if (tile === 10) return [23, 0]; // Ice / Snow
      if (tile === 11) return [31, 3]; // Marsh mud
      if (tile === 12) return [12, 1]; // Abyss rock
      return [0, 0];
    };

    const biomePalettes: Record<number, [string, string]> = {
      0: ['#1e3a8a', '#1e40af'],
      1: ['#fde047', '#a16207'],
      2: ['#d6d3d1', '#78716c'],
      3: ['#fcd34d', '#b45309'],
      4: ['#a3e635', '#4d7c0f'],
      5: ['#bef264', '#65a30d'],
      6: ['#86efac', '#166534'],
      7: ['#6ee7b7', '#065f46'],
      8: ['#4ade80', '#14532d'],
      9: ['#22c55e', '#064e3b'],
      10: ['#e0f2fe', '#94a3b8'],
      11: ['#f8fafc', '#cbd5e1'],
      12: ['#14b8a6', '#0f766e']
    };

    const hasOverworldGfx = !!(overworldImgRef.current && overworldImgRef.current.complete && overworldImgRef.current.naturalWidth > 0);
    const hasObjectsGfx = !!(objectsImgRef.current && objectsImgRef.current.complete && objectsImgRef.current.naturalWidth > 0);

    for (let dy = -half; dy <= half; dy++) {
      for (let dx = -half; dx <= half; dx++) {
        const tx = localPos.lx + dx;
        const ty = localPos.ly + dy;

        const screenX = (dx + half) * TILE_SIZE;
        const screenY = (dy + half) * TILE_SIZE;

        if (tx < 0 || tx >= tilemap.size || ty < 0 || ty >= tilemap.size) {
          ctx.fillStyle = '#0b0f19';
          ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
          continue;
        }

        const tile = tilemap.grid[ty * tilemap.size + tx];
        const biomeId = manifest.global_context.biome_id;
        const palette = biomePalettes[biomeId] || ['#4ade80', '#166534'];

        if (hasOverworldGfx) {
          const [srcCol, srcRow] = getTileCoords(tile, biomeId);
          // If tree, draw underlying terrain first
          if (tile === 1) {
            const [gCol, gRow] = getTileCoords(0, biomeId);
            ctx.drawImage(overworldImgRef.current!, gCol * 16, gRow * 16, 16, 16, screenX, screenY, TILE_SIZE, TILE_SIZE);
          }
          ctx.drawImage(
            overworldImgRef.current!,
            srcCol * 16,
            srcRow * 16,
            16,
            16,
            screenX,
            screenY,
            TILE_SIZE,
            TILE_SIZE
          );
        } else {
          // Color fallback if image not loaded yet
          if (tile === 0) ctx.fillStyle = palette[0];
          else if (tile === 1) ctx.fillStyle = palette[1];
          else if (tile === 2) ctx.fillStyle = '#3b82f6';
          else if (tile === 3) ctx.fillStyle = '#a8a29e';
          else if (tile === 4) ctx.fillStyle = '#451a03';
          else if (tile === 5) ctx.fillStyle = '#1c1917';
          else if (tile === 6) ctx.fillStyle = '#c026d3';
          else if (tile === 7) ctx.fillStyle = '#7f1d1d';
          else if (tile === 8) ctx.fillStyle = '#f97316';
          else if (tile === 9) ctx.fillStyle = '#991b1b';
          else if (tile === 10) ctx.fillStyle = '#f3f4f6';
          else if (tile === 11) ctx.fillStyle = '#78350f';
          else if (tile === 12) ctx.fillStyle = '#111827';
          ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
        }
      }
    }

    // 1. Render Injected Props with Pixel Art Sprites
    const getPropCoords = (name: string, tags: string[]): [number, number] => {
      const lower = name.toLowerCase();
      if (tags.includes('fire') || tags.includes('burning') || lower.includes('fire') || lower.includes('torch') || lower.includes('campfire')) {
        return [4, 3]; // Campfire flame
      }
      if (tags.includes('chest') || lower.includes('chest') || lower.includes('box')) {
        return [0, 0]; // Wooden treasure chest
      }
      if (tags.includes('altar') || lower.includes('altar') || lower.includes('shrine')) {
        return [10, 4]; // Sacred stone altar
      }
      if (tags.includes('door') || lower.includes('door') || lower.includes('gate')) {
        return [10, 0]; // Door
      }
      if (lower.includes('barrel') || lower.includes('keg') || lower.includes('crate')) {
        return [1, 0]; // Wooden barrel
      }
      if (tags.includes('magic') || lower.includes('crystal') || lower.includes('potion')) {
        return [2, 5]; // Magic crystal
      }
      return [0, 0];
    };

    injectedProps.forEach(prop => {
      if (prop.isDestroyed) return;
      const screenX = (prop.pos[0] - localPos.lx + half) * TILE_SIZE;
      const screenY = (prop.pos[1] - localPos.ly + half) * TILE_SIZE;

      if (screenX >= 0 && screenX < canvasRef.current!.width && screenY >= 0 && screenY < canvasRef.current!.height) {
        const tags = Array.isArray(prop.tags) ? prop.tags : [];

        // Ground shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.beginPath();
        ctx.ellipse(screenX + TILE_SIZE / 2, screenY + TILE_SIZE - 2, TILE_SIZE / 2 - 3, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        if (hasObjectsGfx) {
          const [propCol, propRow] = getPropCoords(prop.name, tags);
          ctx.drawImage(
            objectsImgRef.current!,
            propCol * 16,
            propRow * 16,
            16,
            16,
            screenX,
            screenY,
            TILE_SIZE,
            TILE_SIZE
          );
        } else {
          ctx.fillStyle = tags.includes('fire') ? '#ea580c' : '#78350f';
          ctx.fillRect(screenX + 2, screenY + 2, TILE_SIZE - 4, TILE_SIZE - 4);
          ctx.strokeStyle = '#fde047';
          ctx.strokeRect(screenX + 2, screenY + 2, TILE_SIZE - 4, TILE_SIZE - 4);
        }

        // Prop Label badge with dark backing
        const shortName = prop.name.split(' ')[0];
        ctx.font = 'bold 8px monospace';
        const textWidth = ctx.measureText(shortName).width;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fillRect(screenX + TILE_SIZE / 2 - textWidth / 2 - 2, screenY - 9, textWidth + 4, 9);
        ctx.fillStyle = '#fef08a';
        ctx.textAlign = 'center';
        ctx.fillText(shortName, screenX + TILE_SIZE / 2, screenY - 2);
      }
    });

    // 2. Render Injected NPCs with High-Contrast Tokens & Retro Animal Sprites
    injectedNPCs.forEach(npc => {
      if (!npc.alive) return;
      const screenX = (npc.pos[0] - localPos.lx + half) * TILE_SIZE;
      const screenY = (npc.pos[1] - localPos.ly + half) * TILE_SIZE;

      if (screenX >= 0 && screenX < canvasRef.current!.width && screenY >= 0 && screenY < canvasRef.current!.height) {
        const ringColor = npc.disposition < 0 ? '#ef4444' : npc.disposition > 0 ? '#22c55e' : '#3b82f6';

        // Drop shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.beginPath();
        ctx.ellipse(screenX + TILE_SIZE / 2, screenY + TILE_SIZE - 1, TILE_SIZE / 2 - 2, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        if (animalSpritesImgRef.current && animalSpritesImgRef.current.complete) {
          const { col, row } = getNPCSpriteCoords(npc);
          ctx.imageSmoothingEnabled = false;
          // Render animal sprite from 128x128 grid
          ctx.drawImage(
            animalSpritesImgRef.current,
            col * 128, row * 128, 128, 128,
            screenX - 2, screenY - 4, TILE_SIZE + 4, TILE_SIZE + 4
          );

          // Subtle disposition halo ring
          ctx.beginPath();
          ctx.arc(screenX + TILE_SIZE / 2, screenY + TILE_SIZE / 2, TILE_SIZE / 2 + 1, 0, Math.PI * 2);
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = ringColor;
          ctx.stroke();
        } else {
          // Fallback token body
          ctx.fillStyle = '#0f172a';
          ctx.beginPath();
          ctx.arc(screenX + TILE_SIZE / 2, screenY + TILE_SIZE / 2, TILE_SIZE / 2 - 2, 0, Math.PI * 2);
          ctx.fill();

          ctx.lineWidth = 2;
          ctx.strokeStyle = ringColor;
          ctx.stroke();

          ctx.font = '10px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(npc.disposition < 0 ? '⚔️' : npc.disposition > 0 ? '🤝' : '👤', screenX + TILE_SIZE / 2, screenY + TILE_SIZE / 2 + 4);
        }

        // Nameplate with black backing
        const npcShort = npc.name.split(' ')[0];
        ctx.font = 'bold 8.5px sans-serif';
        const nWidth = ctx.measureText(npcShort).width;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(screenX + TILE_SIZE / 2 - nWidth / 2 - 2, screenY - 10, nWidth + 4, 10);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(npcShort, screenX + TILE_SIZE / 2, screenY - 2);
      }
    });

    // 3. Draw Player Token at exact viewport center with Animal Kin Sprite
    const px = half * TILE_SIZE;
    const py = half * TILE_SIZE;

    // Ground shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.beginPath();
    ctx.ellipse(px + TILE_SIZE / 2, py + TILE_SIZE, TILE_SIZE / 2, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    if (animalSpritesImgRef.current && animalSpritesImgRef.current.complete) {
      const walkFrame = Math.abs(localPos.lx + localPos.ly);
      const { col, row } = getAnimalSpriteCoords(
        character?.kingdom,
        character?.species || character?.lineage,
        walkFrame
      );
      ctx.imageSmoothingEnabled = false;
      // Draw crisp 128x128 animal sprite scaled to player tile
      ctx.drawImage(
        animalSpritesImgRef.current,
        col * 128, row * 128, 128, 128,
        px - 3, py - 6, TILE_SIZE + 6, TILE_SIZE + 6
      );

      // Heroic Gold aura rings
      ctx.beginPath();
      ctx.arc(px + TILE_SIZE / 2, py + TILE_SIZE / 2, TILE_SIZE / 2 + 2, 0, Math.PI * 2);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#f59e0b';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(px + TILE_SIZE / 2, py + TILE_SIZE / 2, TILE_SIZE / 2 + 4, 0, Math.PI * 2);
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#fef08a';
      ctx.stroke();
    } else {
      // Fallback dark circular token backing
      ctx.fillStyle = '#1e1b4b';
      ctx.beginPath();
      ctx.arc(px + TILE_SIZE / 2, py + TILE_SIZE / 2, TILE_SIZE / 2 - 1, 0, Math.PI * 2);
      ctx.fill();

      // Heroic Gold aura rings
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#f59e0b';
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#fef08a';
      ctx.stroke();

      // Hero glyph / species emoji
      const heroIcon = character?.species?.includes('Bear') ? '🐻'
        : character?.kingdom === 'Reptile' ? '🦎'
        : character?.kingdom === 'Avian' ? '🦅'
        : character?.kingdom === 'Aquatic' ? '🐙'
        : character?.kingdom === 'Insect' ? '🐝'
        : character?.kingdom === 'Plant' ? '🌿'
        : '🐺';

      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(heroIcon, px + TILE_SIZE / 2, py + TILE_SIZE / 2 + 4);
    }

    // "YOU" Hero Badge
    ctx.font = 'bold 9px sans-serif';
    const youWidth = ctx.measureText('YOU').width;
    ctx.fillStyle = '#b45309';
    ctx.fillRect(px + TILE_SIZE / 2 - youWidth / 2 - 3, py - 12, youWidth + 6, 10);
    ctx.fillStyle = '#fef08a';
    ctx.fillText('YOU', px + TILE_SIZE / 2, py - 4);
  }, [localPos, tilemap, manifest, injectedProps, injectedNPCs, gfxLoaded, character]);

  // Execute Action through Concordia Game Master loop
  const triggerAction = async (actionText: string) => {
    if (!actionText.trim() || isActing) return;
    setIsActing(true);
    setMessages(prev => [...prev, { sender: 'You', text: actionText, type: 'player' }]);
    setChatInput('');

    // Trigger proactive action SFX and music mood
    const lowerAction = actionText.toLowerCase();
    if (lowerAction.includes('attack') || lowerAction.includes('strike') || lowerAction.includes('slash') || lowerAction.includes('stab')) {
      audioManager.playSfx('attack');
      audioManager.playBattleMusic();
      setCurrentTrack(audioManager.getCurrentTrack());
      setIsPlayingMusic(true);
    } else if (lowerAction.includes('rest') || lowerAction.includes('pause')) {
      audioManager.playExplorationMusic();
      setCurrentTrack(audioManager.getCurrentTrack());
    } else if (lowerAction.includes('open') || lowerAction.includes('chest') || lowerAction.includes('loot') || lowerAction.includes('crate') || lowerAction.includes('sack')) {
      audioManager.playSfx('chest');
    } else if (lowerAction.includes('door') || lowerAction.includes('gate')) {
      audioManager.playSfx('door');
    }

    try {
      const res = await fetch('http://localhost:3000/api/dm/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionText,
          playerId: character?.id || 1,
          playerPos: [localPos.lx, localPos.ly]
        })
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setMessages(prev => [...prev, { sender: 'System', text: `Concordia GM Error: ${data.error || res.statusText}`, type: 'error' }]);
        return;
      }

      if (data.systemLog) {
        setMessages(prev => [...prev, { sender: 'System', text: data.systemLog, type: 'system' }]);
        if (data.systemLog.includes('HIT')) {
          audioManager.playSfx('hit');
        } else if (data.systemLog.includes('MISS')) {
          audioManager.playSfx('miss');
        }
      }
      if (data.dialogue) {
        setMessages(prev => [...prev, { sender: data.intent?.targetName || 'Dialogue', text: data.dialogue, type: 'dialogue' }]);
      }
      if (data.narrativeResponse) {
        setMessages(prev => [...prev, { sender: 'GM', text: data.narrativeResponse, type: 'narrative' }]);
      }
      if (data.lootAwarded) {
        audioManager.playSfx('chest');
        setMessages(prev => [
          ...prev,
          {
            sender: 'Loot',
            text: `💰 Received +${data.lootAwarded.gold} Gold${data.lootAwarded.item ? ` and acquired ${data.lootAwarded.item}!` : '!'}`,
            type: 'info'
          }
        ]);
      }

      // Refresh player character sheet from DB
      fetch('http://localhost:3000/api/dm/player')
        .then(r => r.json())
        .then(p => {
          if (p && p.id) {
            if (character && Number(p.current_hp) < Number(character.current_hp)) {
              audioManager.playSfx('damage');
            }
            setCharacter(p);
            if (Number(p.current_hp) <= 0) {
              audioManager.playSfx('death');
              setShowDeathModal(true);
              if (p.difficulty === 'hardcore') {
                handleHardcorePermadeath();
              }
            }
          }
        })
        .catch(() => {});

      // Objective Progress & WhatELSE Quest Notification
      if (data.objectiveProgress?.description) {
        setMessages(prev => [
          ...prev,
          {
            sender: 'Quest Tracker',
            text: `🎯 [OBJECTIVE COMPLETED]: ${data.objectiveProgress.description}`,
            type: 'info'
          }
        ]);
      }

      if (data.objectiveProgress?.beatCompleted) {
        setMessages(prev => [
          ...prev,
          {
            sender: 'Story Director',
            text: `🌟 [STORY BEAT COMPLETED]: "${activeBeat?.title || 'Story Beat'}". The Campaign Arc advances!`,
            type: 'info'
          }
        ]);
        triggerAutoSave('AutoSave - Story Beat Complete');
      }

      // Sync active state from Concordia GM
      if (data.campaignState) {
        setCampaignState(data.campaignState);
        if (data.campaignState.activeBeat) {
          setActiveBeat(data.campaignState.activeBeat);
        }
      }

      // Refresh ground state props & NPCs
      fetch('http://localhost:3000/api/dm/state')
        .then(r => r.json())
        .then(state => {
          if (state.props) {
            setInjectedProps(state.props.map((p: any) => ({
              ...p,
              tags: Array.isArray(p.tags) ? p.tags : []
            })));
          }
          if (state.npcs) setInjectedNPCs(state.npcs);
        })
        .catch(() => {});
    } catch (err: any) {
      setMessages(prev => [...prev, { sender: 'System', text: `Concordia GM Error: ${err.message}`, type: 'error' }]);
    } finally {
      setIsActing(false);
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    triggerAction(chatInput);
  };

  // Direction & Distance to Sector Center (128, 128)
  const distToCenter = Math.round(Math.hypot(128 - localPos.lx, 128 - localPos.ly));
  const dxCenter = 128 - localPos.lx;
  const dyCenter = 128 - localPos.ly;
  let compassDir = '';
  if (dyCenter < -4) compassDir += 'North ';
  if (dyCenter > 4) compassDir += 'South ';
  if (dxCenter > 4) compassDir += 'East';
  if (dxCenter < -4) compassDir += 'West';
  if (!compassDir) compassDir = 'Sector Center';

  // Active Objective Distance Tracker
  const activeObj = activeBeat?.objectives?.find(o => !o.completed);
  const objTargetEntity = activeObj
    ? (injectedNPCs.find(n => n.id === activeObj.targetId) || injectedProps.find(p => p.id === activeObj.targetId))
    : null;
  const objDist = objTargetEntity
    ? Math.round(Math.hypot(objTargetEntity.pos[0] - localPos.lx, objTargetEntity.pos[1] - localPos.ly))
    : null;

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-900 text-gray-100 overflow-hidden font-sans">
      {/* Top Main Section */}
      <div className="flex-1 flex flex-row overflow-hidden">

        {/* Left Pane: Hero Sheet & WhatELSE Campaign Tracker */}
        <div className="w-72 bg-gray-800 border-r border-gray-700 flex flex-col">
          <div className="p-3 border-b border-gray-700 bg-gray-850 flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <h2 className="text-base font-bold text-amber-500 tracking-wider">HERO HUD</h2>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                CHRONICLER ACTIVE
              </span>
            </div>
            {/* Top Game Controls: Menu, New Hero, Save, Load */}
            <div className="grid grid-cols-4 gap-1 pt-1">
              <button
                type="button"
                onClick={() => setInStartMenu(true)}
                className="text-[11px] font-semibold bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 hover:border-gray-500 px-1 py-1 rounded transition flex items-center justify-center gap-1 shadow-sm"
                title="Return to App Start Menu (Esc)"
              >
                <span>🏠</span> Menu
              </button>
              <button
                type="button"
                onClick={() => { handleRollCharacter(); setShowCharModal(true); }}
                className="text-[11px] font-semibold bg-gray-800 hover:bg-amber-900/60 text-amber-300 border border-gray-700 hover:border-amber-500 px-1 py-1 rounded transition flex items-center justify-center gap-1 shadow-sm"
                title="Create a new character and start a fresh game"
              >
                <span>✨</span> New
              </button>
              <button
                type="button"
                onClick={() => setShowSaveModal(true)}
                className="text-[11px] font-semibold bg-gray-800 hover:bg-emerald-900/60 text-emerald-300 border border-gray-700 hover:border-emerald-500 px-1 py-1 rounded transition flex items-center justify-center gap-1 shadow-sm"
                title="Save current game progress"
              >
                <span>💾</span> Save
              </button>
              <button
                type="button"
                onClick={handleOpenLoadModal}
                className="text-[11px] font-semibold bg-gray-800 hover:bg-blue-900/60 text-blue-300 border border-gray-700 hover:border-blue-500 px-1 py-1 rounded transition flex items-center justify-center gap-1 shadow-sm"
                title="Load a saved game"
              >
                <span>📂</span> Load
              </button>
            </div>
          </div>

          <div className="p-4 flex-1 overflow-y-auto space-y-4">
            {/* Identity, Species & Health */}
            {character ? (
              <div className="bg-gray-900 p-3 rounded-xl border border-gray-700 space-y-2.5 shadow-md">
                <div className="flex items-center gap-3">
                  {/* Animal Kin Avatar Badge */}
                  <div className="w-12 h-12 rounded-xl bg-gray-950 border-2 border-amber-500/80 shadow-md flex items-center justify-center relative overflow-hidden shrink-0">
                    {(() => {
                      const { col, row } = getAnimalSpriteCoords(character.kingdom, character.species || character.lineage, 0);
                      return (
                        <div
                          className="w-full h-full"
                          style={{
                            backgroundImage: 'url(/gfx/Gemini_Generated_Image_a4motwa4motwa4mo.png)',
                            backgroundPosition: `-${col * 48}px -${row * 48}px`,
                            backgroundSize: `${22 * 48}px ${12 * 48}px`,
                            imageRendering: 'pixelated'
                          }}
                        />
                      );
                    })()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-300 text-sm tracking-wide truncate">{character.name}</span>
                      <span className="text-xs font-mono text-gray-400">HP: {character.current_hp}/{character.max_hp}</span>
                    </div>
                    <div className="text-[10.5px] text-gray-300 font-mono truncate">
                      🐾 {character.species || character.lineage || 'Hero'}
                    </div>
                  </div>
                </div>

                {/* Animal Species, Difficulty & Archetype Badges */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border font-mono ${
                    character.difficulty === 'casual'
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                      : character.difficulty === 'hardcore'
                      ? 'bg-red-950 text-red-300 border-red-800'
                      : 'bg-amber-950 text-amber-300 border-amber-800'
                  }`}>
                    {character.difficulty === 'casual' ? '🟢 Casual' : character.difficulty === 'hardcore' ? '🔴 Hardcore' : '🟡 Survivor'}
                  </span>
                  <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950/80 px-2 py-0.5 rounded-full border border-cyan-800 font-bold">
                    {character.kingdom || 'Mammalia'} • {character.institution || 'Aetheria'}
                  </span>
                </div>
                {(character.power_null_track || character.powerNullTrack) && (
                  <div className="text-[10px] text-purple-300 font-mono bg-purple-950/40 px-2 py-0.5 rounded border border-purple-800/60 flex items-center justify-between">
                    <span>🌌 {character.power_null_track || character.powerNullTrack}</span>
                    <span className="text-[9px] text-gray-400">{character.offense_skill || character.offenseSkill || 'Skill'}</span>
                  </div>
                )}

                {/* Health Bar */}
                <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.max(0, Math.min(100, (character.current_hp / character.max_hp) * 100))}%`,
                      backgroundColor: character.current_hp / character.max_hp > 0.5 ? '#22c55e' : character.current_hp / character.max_hp > 0.25 ? '#eab308' : '#ef4444'
                    }}
                  />
                </div>

                {/* Derived Vitals Mini Grid */}
                <div className="grid grid-cols-4 gap-1 text-[10px] font-mono text-center pt-1.5 border-t border-gray-800">
                  <div className="bg-gray-850 p-1 rounded" title="Max Stamina">
                    <span className="text-amber-400 font-bold block">⚡ {character.stamina_max || character.derived_stats?.maxStamina || 8}</span>
                    <span className="text-[9px] text-gray-400">STA</span>
                  </div>
                  <div className="bg-gray-850 p-1 rounded" title="Max Focus">
                    <span className="text-sky-400 font-bold block">🧠 {character.focus_max || character.derived_stats?.maxFocus || 8}</span>
                    <span className="text-[9px] text-gray-400">FOC</span>
                  </div>
                  <div className="bg-gray-850 p-1 rounded" title="Physical Defense">
                    <span className="text-teal-400 font-bold block">🛡️ {character.phys_defense || character.derived_stats?.physDefense || 10}</span>
                    <span className="text-[9px] text-gray-400">DEF</span>
                  </div>
                  <div className="bg-gray-850 p-1 rounded" title="Speed">
                    <span className="text-purple-400 font-bold block">👟 {character.speed || character.derived_stats?.speed || 10}</span>
                    <span className="text-[9px] text-gray-400">SPD</span>
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs font-mono pt-1.5 text-gray-300 border-t border-gray-800">
                  <span>Purse: <strong className="text-yellow-400">💰 {character.gold ?? 50} Gold</strong></span>
                  <span>Level: <strong className="text-emerald-400">Lv. {character.level ?? 1}</strong></span>
                </div>

                {/* 3-Branch x 4-Rank Skill Progression Trigger */}
                <button
                  type="button"
                  onClick={() => setShowSkillsModal(true)}
                  className={`w-full py-1.5 px-2.5 rounded-lg font-mono text-xs font-bold transition flex items-center justify-between border shadow-sm ${
                    (character.skill_points || 0) > 0
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500 animate-pulse hover:bg-amber-500/30'
                      : 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-750'
                  }`}
                  title="Open 3-Branch x 4-Rank Skill & Power Progression Trees"
                >
                  <span className="flex items-center gap-1.5">
                    <span>⚡</span> Disciplines & Skills
                  </span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                    (character.skill_points || 0) > 0 ? 'bg-amber-500 text-black font-extrabold' : 'bg-gray-900 text-gray-400'
                  }`}>
                    {(character.skill_points || 0) > 0 ? `+${character.skill_points} Pts` : 'View'}
                  </span>
                </button>

                {/* Unlocked Specializations & Active Disciplines */}
                {character.skill_ranks && Object.keys(character.skill_ranks).length > 0 && (
                  <div className="pt-2 border-t border-gray-800 space-y-1">
                    <span className="text-[9.5px] font-bold text-gray-400 uppercase tracking-wider block">Specializations (Ranks 1–4)</span>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(character.skill_ranks).map(([bId, rk]: [string, any]) => {
                        const cleanName = bId
                          .replace(/^spec_weapon_/, 'Wpn: ')
                          .replace(/^spec_armor_/, 'Arm: ')
                          .replace(/^trait_/, 'Trait: ')
                          .replace(/^act_/, 'Act: ')
                          .replace(/^pwr_/, 'Pwr: ')
                          .replace(/^null_/, 'Null: ')
                          .replace(/_/g, ' ');
                        return (
                          <span
                            key={bId}
                            className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-gray-850 border border-gray-750 text-gray-300 flex items-center gap-1"
                            title={`Branch ${bId} at Rank ${rk}`}
                          >
                            <span className="capitalize">{cleanName}</span>
                            <span className="text-emerald-400 font-bold bg-emerald-950 px-1 rounded border border-emerald-800">R{rk}</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-gray-400 italic animate-pulse">Loading hero profile...</div>
            )}

            {/* WHATELSE CAMPAIGN OUTLINE & QUEST TRACKER */}
            <div className="bg-gradient-to-b from-amber-950/50 to-gray-900 border border-amber-600/50 rounded-lg p-3 space-y-2 shadow">
              <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-wider text-amber-400">
                <span>{campaignState?.currentAct?.title || 'ACT 1: THE GATHERING STORM'}</span>
                <span className="font-mono text-amber-300 bg-amber-900/60 px-1.5 py-0.5 rounded">
                  ACT {campaignState?.actIndex || 1}/5
                </span>
              </div>

              {activeBeat ? (
                <>
                  <div className="border-t border-amber-800/40 pt-1.5">
                    <h4 className="text-xs font-bold text-white mb-0.5">{activeBeat.title}</h4>
                    <p className="text-[11px] text-gray-300 italic mb-2 leading-tight">{activeBeat.hook}</p>

                    <div className="space-y-1.5">
                      <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Objectives:</div>
                      {(activeBeat.objectives || []).map(obj => (
                        <div key={obj.id} className="text-xs flex items-start gap-1.5 bg-black/40 p-1.5 rounded border border-gray-750">
                          <span className={obj.completed ? 'text-emerald-400 font-bold' : 'text-gray-500'}>
                            {obj.completed ? '✓' : '○'}
                          </span>
                          <span className={obj.completed ? 'line-through text-gray-500' : 'text-gray-200'}>
                            {obj.description}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* WhatELSE Pivot Decision & Variants */}
                    <div className="mt-2.5 pt-2 border-t border-amber-800/30">
                      <div className="text-[10px] font-bold text-blue-300 uppercase tracking-wider mb-1">
                        Path Decision:
                      </div>
                      <p className="text-[10px] text-gray-300 mb-2">{activeBeat.pivotDecision}</p>

                      <div className="space-y-1">
                        {(activeBeat.variants || []).map((v, idx) => (
                          <button
                            key={idx}
                            onClick={() => triggerAction(`I choose to ${v.name}: ${v.description}`)}
                            disabled={isActing}
                            className="w-full text-left text-[11px] bg-gray-800/90 hover:bg-amber-950/80 text-amber-200 hover:text-white p-1.5 rounded border border-gray-700 hover:border-amber-500 transition flex justify-between items-center"
                          >
                            <span className="font-semibold">{v.name}</span>
                            <span className="font-mono text-[9px] uppercase bg-gray-900 px-1 py-0.5 rounded text-amber-400">
                              {v.preferredStat}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-xs text-gray-400 italic">No active story beat in sector.</div>
              )}
            </div>

            {/* 12 Attributes Matrix */}
            {character && (
              <>
                <div>
                  <h3 className="text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-1">Body Attributes</h3>
                  <div className="grid grid-cols-2 gap-1.5 text-xs font-mono bg-gray-900 rounded p-2 border border-gray-700/60">
                    {[
                      ['Might', character.might],
                      ['Endurance', character.endurance],
                      ['Finesse', character.finesse],
                      ['Reflex', character.reflex],
                      ['Vitality', character.vitality],
                      ['Fortitude', character.fortitude]
                    ].map(([label, val]) => (
                      <div key={label as string} className="flex justify-between">
                        <span className="text-gray-400">{label}</span>
                        <span className="text-amber-300 font-bold">{val}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-1">Mind Attributes</h3>
                  <div className="grid grid-cols-2 gap-1.5 text-xs font-mono bg-gray-900 rounded p-2 border border-gray-700/60">
                    {[
                      ['Knowledge', character.knowledge],
                      ['Logic', character.logic],
                      ['Awareness', character.awareness],
                      ['Intuition', character.intuition],
                      ['Charm', character.charm],
                      ['Willpower', character.willpower]
                    ].map(([label, val]) => (
                      <div key={label as string} className="flex justify-between">
                        <span className="text-gray-400">{label}</span>
                        <span className="text-blue-300 font-bold">{val}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-gray-900 rounded p-2.5 text-xs font-mono border border-gray-700/60 space-y-2 shadow">
                  <div className="flex flex-col gap-0.5">
                    <div className="flex justify-between items-center text-gray-400">
                      <span className="flex items-center gap-1">⚔️ Weapon:</span>
                      <span className="text-[10px] font-bold text-amber-400 bg-amber-950/80 px-1.5 py-0.5 rounded border border-amber-800 uppercase">
                        {character.weapon_stat ? `${character.weapon_stat} +${character.weapon_mod}` : 'MIGHT'}
                      </span>
                    </div>
                    <span className="text-orange-300 font-semibold truncate pl-2">{character.equipped_weapon}</span>
                  </div>
                  <div className="flex flex-col gap-0.5 pt-1.5 border-t border-gray-800">
                    <div className="flex justify-between items-center text-gray-400">
                      <span className="flex items-center gap-1">🛡️ Armor:</span>
                      <span className="text-[10px] font-bold text-sky-400 bg-sky-950/80 px-1.5 py-0.5 rounded border border-sky-800 uppercase">
                        {character.armor_stat ? `${character.armor_stat} +${character.armor_mod} (DR ${character.armor_dr ?? 0})` : 'DEFENSE'}
                      </span>
                    </div>
                    <span className="text-sky-300 font-semibold truncate pl-2">{character.equipped_armor}</span>
                  </div>
                </div>

                {/* Species Traits & Brands */}
                {character.passive_traits && character.passive_traits.length > 0 && (
                  <div className="bg-gray-900 rounded p-2.5 border border-gray-700/60 space-y-1.5 shadow">
                    <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                      Species Traits & Brands
                    </span>
                    <div className="space-y-1">
                      {character.passive_traits.map((t: any, idx: number) => (
                        <div key={idx} className="bg-gray-850 p-1.5 rounded border border-gray-800 text-[10px]">
                          <strong className="text-amber-300 block">✨ {t.name}</strong>
                          <span className="text-gray-400 leading-tight block text-[9.5px] mt-0.5">{t.desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Active Combat Abilities */}
                {character.skills && character.skills.length > 0 && (
                  <div className="bg-gray-900 rounded p-2.5 border border-gray-700/60 space-y-1.5 shadow">
                    <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider block">
                      Combat Abilities
                    </span>
                    <div className="space-y-1">
                      {character.skills.map((sk: any, idx: number) => (
                        <div key={idx} className="bg-gray-850 p-1.5 rounded border border-gray-800 text-[10px] flex justify-between items-center">
                          <span className="text-purple-300 font-bold">{sk.name}</span>
                          <span className="text-[9px] font-mono text-amber-400 bg-gray-900 px-1.5 py-0.5 rounded border border-gray-750">{sk.cost}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Adventurer's Pack (Inventory) */}
                <div className="bg-gray-900 rounded p-2.5 border border-gray-700/60 space-y-1.5 shadow">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-yellow-400 uppercase tracking-wider">
                      Adventurer's Pack
                    </span>
                    <span className="text-[9px] font-mono text-gray-400">
                      {Array.isArray(character.inventory) ? character.inventory.length : 0} Items
                    </span>
                  </div>
                  {Array.isArray(character.inventory) && character.inventory.length > 0 ? (
                    <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                      {character.inventory.map((item: string, idx: number) => (
                        <div key={idx} className="bg-gray-850 p-1.5 rounded border border-gray-800 text-[10px] flex justify-between items-center">
                          <span className="text-gray-200 truncate max-w-[140px]">📦 {item}</span>
                          <button
                            type="button"
                            onClick={() => triggerAction(`I use and apply my ${item}`)}
                            disabled={isActing}
                            className="px-2 py-0.5 bg-yellow-950/80 hover:bg-yellow-850 border border-yellow-700/60 hover:border-yellow-500 text-yellow-300 rounded text-[9px] font-bold transition"
                          >
                            Use
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[10px] text-gray-500 italic p-1">Pack is empty. Search ruins or loot fallen foes.</div>
                  )}
                </div>
              </>
            )}

            {/* GPS & Radar */}
            <div className="bg-gray-900 p-2.5 rounded border border-gray-700/60 text-xs font-mono space-y-1.5 text-gray-400">
              <div className="flex justify-between items-center pb-1 border-b border-gray-800">
                <span className="font-bold text-gray-300">POSITION MATRIX</span>
                <button
                  type="button"
                  onClick={() => setActiveCenterTab(prev => prev === 'worldMap' ? 'battlegrid' : 'worldMap')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold border transition flex items-center gap-1 ${
                    activeCenterTab === 'worldMap'
                      ? 'bg-amber-950 text-amber-300 border-amber-600'
                      : 'bg-gray-800 hover:bg-gray-750 text-sky-300 border-sky-800/80 hover:border-sky-500'
                  }`}
                  title="Toggle Global Static Reference Map"
                >
                  <span>🗺️</span>
                  <span>{activeCenterTab === 'worldMap' ? 'Close Map' : 'World Map'}</span>
                </button>
              </div>
              <div className="flex justify-between">
                <span>Sector:</span> <span className="text-blue-300">({regionalPos.rx}, {regionalPos.ry})</span>
              </div>
              <div className="flex justify-between">
                <span>Tile:</span> <span className="text-amber-400">({localPos.lx}, {localPos.ly})</span>
              </div>
              <div className="flex justify-between">
                <span>Biome:</span> <span className="text-emerald-400">{manifest ? getBiomeName(manifest.global_context.biome_id) : '—'}</span>
              </div>
            </div>

            {/* Music & SFX Deck */}
            <div className="bg-gradient-to-r from-gray-900 via-gray-850 to-gray-900 p-2.5 rounded border border-gray-700/80 shadow-md space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-amber-400 text-xs animate-pulse">🎵</span>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-gray-200 block truncate" title={currentTrack.title}>
                      {currentTrack.title}
                    </span>
                    <span className="text-[8.5px] text-gray-400 truncate block">
                      {currentTrack.artist}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={handleToggleMusic}
                    className="w-6 h-6 bg-amber-950/80 hover:bg-amber-900 border border-amber-700/80 rounded flex items-center justify-center text-amber-300 text-[10px] shadow-sm transition"
                    title={isPlayingMusic ? 'Pause Music' : 'Play Music'}
                  >
                    {isPlayingMusic ? '⏸' : '▶'}
                  </button>
                  <button
                    type="button"
                    onClick={handleNextTrack}
                    className="w-6 h-6 bg-gray-800 hover:bg-gray-700 border border-gray-650 rounded flex items-center justify-center text-gray-300 text-[10px] shadow-sm transition"
                    title="Next Track"
                  >
                    ⏭
                  </button>
                </div>
              </div>

              {/* Volume & SFX Toggles */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-800 text-[10px]">
                <div className="flex items-center gap-1.5 flex-1">
                  <button
                    type="button"
                    onClick={handleToggleMute}
                    className="text-gray-400 hover:text-white text-[11px]"
                    title={isMuted ? 'Unmute Music' : 'Mute Music'}
                  >
                    {isMuted ? '🔇' : '🔊'}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isMuted ? 0 : musicVol}
                    onChange={e => handleVolumeChange(parseFloat(e.target.value))}
                    className="w-full accent-amber-500 h-1 bg-gray-700 rounded cursor-pointer"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleToggleSfx}
                  className={`px-1.5 py-0.5 rounded text-[8.5px] font-mono font-bold border transition ${
                    sfxMuted
                      ? 'bg-red-950/60 text-red-400 border-red-800'
                      : 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                  }`}
                  title="Toggle Sound Effects"
                >
                  {sfxMuted ? 'SFX OFF' : 'SFX ON'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Center Pane: Tactical View or World Map Reference */}
        <div className="flex-1 bg-black flex flex-col items-center justify-center relative overflow-hidden">
          {/* Header Bar with Tabs */}
          <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/90 via-black/75 to-transparent z-10 flex justify-between items-center">
            <div className="flex items-center gap-3">
              {/* Tab Switcher */}
              <div className="flex items-center bg-gray-900/90 border border-gray-700 rounded-lg p-0.5 shadow-lg">
                <button
                  type="button"
                  onClick={() => setActiveCenterTab('battlegrid')}
                  className={`px-3 py-1 rounded text-xs font-bold transition flex items-center gap-1.5 ${
                    activeCenterTab === 'battlegrid'
                      ? 'bg-amber-600 text-white shadow'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <span>⚔️</span>
                  <span>TACTICAL BATTLEGRID</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCenterTab('worldMap')}
                  className={`px-3 py-1 rounded text-xs font-bold transition flex items-center gap-1.5 ${
                    activeCenterTab === 'worldMap'
                      ? 'bg-sky-600 text-white shadow'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <span>🗺️</span>
                  <span>WORLD MAP</span>
                </button>
              </div>

              {activeCenterTab === 'battlegrid' && encounterTarget && (
                <span className="text-xs bg-red-950 text-red-400 border border-red-700 px-2 py-0.5 rounded font-mono animate-pulse">
                  IN RANGE: {encounterTarget.name}
                </span>
              )}
            </div>

            <div className="flex gap-2 text-xs font-mono items-center">
              {activeCenterTab === 'battlegrid' ? (
                <>
                  {objDist !== null && (
                    <div className="bg-amber-950/80 border border-amber-600/80 px-2.5 py-1 rounded text-amber-300 flex items-center gap-1.5 shadow">
                      <span>🎯</span>
                      <span>Objective: <strong className="text-white">{objDist}m</strong></span>
                    </div>
                  )}
                  <div className="bg-gray-900/80 border border-gray-700 px-3 py-1 rounded text-gray-300">
                    🧭 Center: {distToCenter}m {compassDir}
                  </div>
                </>
              ) : (
                <div className="bg-gray-900/90 border border-sky-800/80 px-3 py-1 rounded text-sky-300 flex items-center gap-2 shadow">
                  <span>📍 Global Sector:</span>
                  <strong className="text-white font-mono">X:{regionalPos.rx} Y:{regionalPos.ry}</strong>
                  <span className="text-gray-500">•</span>
                  <span className="text-amber-400 font-mono">Cell {CELL_ID}</span>
                </div>
              )}
            </div>
          </div>

          {activeCenterTab === 'battlegrid' ? (
            loading ? (
              <div className="text-amber-500 animate-pulse text-lg tracking-widest">TRANSLATING GLOBAL MATRIX...</div>
            ) : (
              <div className="shadow-2xl border-4 border-gray-800 rounded relative">
                <canvas
                  ref={canvasRef}
                  width={VIEWPORT_SIZE * TILE_SIZE}
                  height={VIEWPORT_SIZE * TILE_SIZE}
                  onClick={handleCanvasClick}
                  className="bg-black block cursor-crosshair"
                  title="Click any prop or NPC to target directly"
                />
              </div>
            )
          ) : (
            /* World Map Reference Tab: Static Representation with Player Coordinates */
            <div className="flex flex-col items-center justify-center w-full h-full p-8 pt-16">
              <div className="relative bg-slate-950 border-2 border-sky-900/80 rounded-xl overflow-hidden shadow-2xl max-w-4xl max-h-[75vh] flex flex-col items-center">
                {/* Reference Map Image (Rendered from Okasha planetary geometry) */}
                <div className="relative overflow-hidden flex items-center justify-center bg-[#101828]">
                  <img
                    src="/world_reference.svg"
                    alt="World Map Reference"
                    className="max-h-[64vh] w-auto object-contain block opacity-90 select-none pointer-events-none"
                    style={{ imageRendering: 'pixelated' }}
                  />

                  {/* Player Location Marker Pin */}
                  {(() => {
                    // Map coordinate normalization: Okasha world reference is 280 x 148
                    // regionalPos.rx is typically around 0-225, CELL_ID 13408 center is at [1278, 574] -> x ~ 128, y ~ 57
                    const pinPercentX = Math.max(2, Math.min(98, (1278.22 / 2819) * 100 + ((regionalPos.rx - 105) * 0.1)));
                    const pinPercentY = Math.max(2, Math.min(98, (574.00 / 1481) * 100 + ((regionalPos.ry - 112) * 0.1)));

                    return (
                      <div
                        className="absolute z-20 flex flex-col items-center -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-all duration-300"
                        style={{ left: `${pinPercentX}%`, top: `${pinPercentY}%` }}
                      >
                        {/* Pulsing Target Radar Ring */}
                        <div className="w-7 h-7 rounded-full border-2 border-amber-400 bg-amber-500/20 animate-ping absolute -top-1 -left-1" />
                        <div className="w-5 h-5 rounded-full bg-red-600 border-2 border-white shadow-lg flex items-center justify-center text-[10px] font-bold text-white z-10">
                          ⚔️
                        </div>
                        <div className="mt-1 bg-black/90 border border-amber-500/80 px-2 py-0.5 rounded text-[10px] font-mono text-amber-300 shadow-xl whitespace-nowrap">
                          {character?.name || 'You'} (Sec: {regionalPos.rx}, {regionalPos.ry})
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Footer Reference Legend */}
                <div className="w-full bg-slate-900/95 border-t border-sky-950 px-4 py-2 flex items-center justify-between text-xs font-mono text-gray-400">
                  <div className="flex items-center gap-3">
                    <span className="text-gray-300 font-bold">LEGEND:</span>
                    <span className="flex items-center gap-1 text-[11px]"><span className="w-2.5 h-2.5 rounded-sm bg-[#101828] border border-gray-700" /> Deep Ocean</span>
                    <span className="flex items-center gap-1 text-[11px]"><span className="w-2.5 h-2.5 rounded-sm bg-[#46a758]" /> Deciduous / Wilds</span>
                    <span className="flex items-center gap-1 text-[11px]"><span className="w-2.5 h-2.5 rounded-sm bg-[#fde047]" /> Arid Plains</span>
                    <span className="flex items-center gap-1 text-[11px]"><span className="w-2.5 h-2.5 rounded-sm bg-[#0f766e]" /> Temperate Forest</span>
                    <span className="flex items-center gap-1 text-[11px]"><span className="w-2.5 h-2.5 rounded-sm bg-[#f8fafc]" /> Glaciers</span>
                  </div>
                  <div className="text-[11px] text-gray-400 italic">
                    Static macro chart for navigational reference • Sub-scale detail unrendered
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Pane: DM Story Engine & Action Controls */}
        <div className="w-[420px] bg-gray-800 border-l border-gray-700 flex flex-col">
          <div className="p-3 border-b border-gray-700 flex justify-between items-center bg-gray-850">
            <h2 className="text-base font-bold text-blue-400 flex items-center gap-2">
              <span>CHRONICLER OF OSTRAKA</span>
            </h2>
            <span className="text-[10px] bg-blue-950 text-blue-300 px-2 py-0.5 rounded border border-blue-800 font-mono">
              PROCEDURAL TTRPG
            </span>
          </div>

          {/* Narrative Log */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 font-serif text-sm flex flex-col">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`${
                  m.type === 'info'
                    ? 'text-amber-300 italic text-xs bg-amber-950/30 p-2 rounded border border-amber-800/40'
                    : m.type === 'error'
                    ? 'text-red-400 font-bold text-xs bg-red-950/40 p-2 rounded border border-red-800'
                    : m.type === 'player'
                    ? 'text-amber-200 text-right bg-amber-950/20 p-2 rounded border border-amber-900/40'
                    : m.type === 'dialogue'
                    ? 'text-amber-100 bg-amber-950/40 p-3 rounded border border-amber-700/60 shadow italic text-sm'
                    : m.type === 'system'
                    ? ''
                    : 'text-gray-100 bg-gray-900/80 p-3 rounded border border-gray-700/80 shadow'
                }`}
              >
                {m.type === 'player' && <span className="font-bold mr-2 text-amber-500 font-sans text-xs not-italic">YOU:</span>}
                {m.type === 'dialogue' && <span className="font-bold text-amber-400 mr-2 font-sans text-xs not-italic uppercase tracking-wider">{m.sender}:</span>}
                {m.type === 'narrative' && <span className="font-bold text-blue-400 mr-2 font-sans text-xs not-italic">DM:</span>}
                {m.type === 'system' ? (
                  <div className="font-mono text-xs text-green-400 bg-black/90 px-2 py-1.5 rounded border border-green-800/60 shadow">
                    {m.text}
                  </div>
                ) : (
                  m.text
                )}
              </div>
            ))}
          </div>

          {/* Action Chips & Input Section */}
          <div className="p-3 border-t border-gray-700 bg-gray-900 space-y-2">
            {/* Quick Action Suggestion Chips based on target */}
            <div className="flex flex-wrap gap-1.5">
              {encounterTarget && 'role' in encounterTarget ? (
                <>
                  <button
                    type="button"
                    disabled={isActing}
                    onClick={() => triggerAction(`I speak with ${encounterTarget.name} to demand what they are doing here and who sent them`)}
                    className="text-xs bg-amber-950/70 hover:bg-amber-800 text-amber-200 border border-amber-700/60 px-2.5 py-1 rounded transition flex items-center gap-1"
                  >
                    <span>🗣️</span> Talk
                  </button>
                  <button
                    type="button"
                    disabled={isActing}
                    onClick={() => triggerAction(`I strike ${encounterTarget.name} with my ${character?.equipped_weapon || 'blade'} (${character?.weapon_stat ? character.weapon_stat.toUpperCase() : 'MIGHT'})`)}
                    className="text-xs bg-red-950/70 hover:bg-red-800 text-red-300 border border-red-700/60 px-2.5 py-1 rounded transition flex items-center gap-1"
                  >
                    <span>⚔️</span> Attack ({character?.weapon_stat ? character.weapon_stat.toUpperCase() : 'MIGHT'})
                  </button>
                  <button
                    type="button"
                    disabled={isActing}
                    onClick={() => triggerAction(`I offer 10 gold coins to ${encounterTarget.name} to secure their aid and information`)}
                    className="text-xs bg-yellow-950/70 hover:bg-yellow-800 text-yellow-300 border border-yellow-700/60 px-2.5 py-1 rounded transition flex items-center gap-1"
                  >
                    <span>🪙</span> Bribe (10g)
                  </button>
                  <button
                    type="button"
                    disabled={isActing}
                    onClick={() => triggerAction(`I draw steel and threaten ${encounterTarget.name} to yield or suffer the consequences`)}
                    className="text-xs bg-purple-950/70 hover:bg-purple-800 text-purple-300 border border-purple-700/60 px-2.5 py-1 rounded transition flex items-center gap-1"
                  >
                    <span>💀</span> Intimidate
                  </button>
                </>
              ) : encounterTarget ? (
                <>
                  <button
                    type="button"
                    disabled={isActing}
                    onClick={() => triggerAction(`I attempt to pick the lock on ${encounterTarget.name} using my finesse`)}
                    className="text-xs bg-sky-950/70 hover:bg-sky-800 text-sky-300 border border-sky-700/60 px-2.5 py-1 rounded transition flex items-center gap-1"
                  >
                    <span>🗝️</span> Unlock
                  </button>
                  <button
                    type="button"
                    disabled={isActing}
                    onClick={() => triggerAction(`I search and inspect ${encounterTarget.name} closely for hidden catches or loot`)}
                    className="text-xs bg-emerald-950/70 hover:bg-emerald-800 text-emerald-300 border border-emerald-700/60 px-2.5 py-1 rounded transition flex items-center gap-1"
                  >
                    <span>🔍</span> Inspect
                  </button>
                  <button
                    type="button"
                    disabled={isActing}
                    onClick={() => triggerAction(`I smash ${encounterTarget.name} with brute force`)}
                    className="text-xs bg-red-950/70 hover:bg-red-800 text-red-300 border border-red-700/60 px-2.5 py-1 rounded transition flex items-center gap-1"
                  >
                    <span>🔨</span> Smash
                  </button>
                  <button
                    type="button"
                    disabled={isActing}
                    onClick={() => triggerAction(`I ignite ${encounterTarget.name} with a burning torch`)}
                    className="text-xs bg-orange-950/70 hover:bg-orange-800 text-orange-300 border border-orange-700/60 px-2.5 py-1 rounded transition flex items-center gap-1"
                  >
                    <span>🔥</span> Ignite
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={isActing}
                    onClick={() => triggerAction('I scout and search the surroundings for tracks, hidden caches, and threats')}
                    className="text-xs bg-emerald-950/70 hover:bg-emerald-800 text-emerald-300 border border-emerald-700/60 px-2.5 py-1 rounded transition flex items-center gap-1"
                  >
                    <span>🔍</span> Search Area
                  </button>
                  <button
                    type="button"
                    disabled={isActing}
                    onClick={() => triggerAction('I move stealthily from cover to cover without alerting enemies')}
                    className="text-xs bg-indigo-950/70 hover:bg-indigo-800 text-indigo-300 border border-indigo-700/60 px-2.5 py-1 rounded transition flex items-center gap-1"
                  >
                    <span>👤</span> Sneak
                  </button>
                  <button
                    type="button"
                    disabled={isActing}
                    onClick={() => triggerAction('I take a tactical pause to bandage wounds, catch my breath, and rest')}
                    className="text-xs bg-teal-950/70 hover:bg-teal-800 text-teal-300 border border-teal-700/60 px-2.5 py-1 rounded transition flex items-center gap-1"
                  >
                    <span>🏕️</span> Rest & Heal
                  </button>
                  <button
                    type="button"
                    disabled={isActing}
                    onClick={() => triggerAction('I open my senses to detect aetheric currents and hidden arcane hazards')}
                    className="text-xs bg-purple-950/70 hover:bg-purple-800 text-purple-300 border border-purple-700/60 px-2.5 py-1 rounded transition flex items-center gap-1"
                  >
                    <span>🔮</span> Sense Magic
                  </button>
                </>
              )}
            </div>

            {/* Action Resolving Banner */}
            {isActing && (
              <div className="flex items-center justify-between text-xs font-mono text-amber-300 bg-amber-950/80 border border-amber-600/80 px-3 py-1.5 rounded-lg animate-pulse shadow">
                <span className="flex items-center gap-2">
                  <span className="text-base animate-spin inline-block">🎲</span>
                  <span>The Chronicler weaves fate... Resolving opposed rolls & world tags</span>
                </span>
                <span className="text-[10px] text-amber-400 bg-black/60 px-2 py-0.5 rounded font-bold">1d20 CONTEST</span>
              </div>
            )}

                        {/* Freeform Prompt Form */}
            <form onSubmit={handleSend} className="flex gap-2">
              <input
                type="text"
                disabled={isActing}
                className="flex-1 bg-gray-800 text-white border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-500 placeholder-gray-500"
                placeholder={isActing ? 'Concordia GM resolving turn...' : 'What do you do? (e.g. "I smash the wooden barricade")'}
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
              />
              <button
                type="submit"
                disabled={isActing || !chatInput.trim()}
                className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white px-4 py-2 rounded text-sm font-bold transition flex items-center justify-center min-w-[70px]"
              >
                {isActing ? '...' : 'Act'}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Bottom Pane: Quick Action Key Bar */}
      <div className="h-16 bg-gray-950 border-t border-gray-700 flex items-center justify-center gap-3 px-4 shadow-[0_-5px_15px_rgba(0,0,0,0.5)] z-20">
        {[
          { label: 'Attack', key: '1', icon: '⚔️', text: `I strike ${encounterTarget ? encounterTarget.name : 'the enemy'} with my ${character?.equipped_weapon || 'blade'} (${character?.weapon_stat ? character.weapon_stat.toUpperCase() : 'MIGHT'})` },
          { label: 'Stealth', key: '2', icon: '👤', text: 'I slip into the shadows and scout unseen' },
          { label: 'Inspect', key: '3', icon: '🔍', text: 'I inspect the ground and props for hidden mechanisms' },
          { label: 'Negotiate', key: '4', icon: '🗣️', text: 'I call out and attempt to negotiate terms' },
          { label: 'Rest', key: '5', icon: '⛺', text: 'I take a tactical pause to assess my wounds and environment' }
        ].map((item) => (
          <button
            key={item.key}
            onClick={() => triggerAction(item.text)}
            disabled={isActing}
            className="h-11 px-4 bg-gray-850 border border-gray-700 hover:border-amber-500 rounded flex items-center gap-2 group transition"
          >
            <span className="text-gray-400 group-hover:text-amber-400 font-mono font-bold text-xs bg-gray-900 px-1.5 py-0.5 rounded border border-gray-700">
              {item.key}
            </span>
            <span className="text-sm">{item.icon}</span>
            <span className="text-xs text-gray-300 group-hover:text-white uppercase font-bold tracking-wider">{item.label}</span>
          </button>
        ))}
      </div>

      {/* App Start Menu / Title Screen */}
      {inStartMenu && (
        <div
          className="fixed inset-0 z-40 flex flex-col items-center justify-center p-6 select-none bg-cover bg-center shadow-2xl"
          style={{ backgroundImage: 'linear-gradient(to bottom, rgba(3, 7, 18, 0.76), rgba(0, 0, 0, 0.92)), url("/gfx/Gemini_Generated_Image_4xvege4xvege4xve.png")' }}
        >
          {/* Subtle Ambient Radial Glow */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-900/30 via-transparent to-transparent pointer-events-none" />

          <div className="relative z-10 flex flex-col items-center max-w-md w-full text-center space-y-7">
            {/* Title Header */}
            <div>
              <div className="text-amber-500/80 text-xs font-mono tracking-[0.35em] uppercase mb-2 flex items-center justify-center gap-2">
                <span>✦</span> AETHERIA TTRPG <span>✦</span>
              </div>
              <h1 className="text-5xl font-black text-amber-400 tracking-[0.25em] drop-shadow-[0_4px_16px_rgba(245,158,11,0.3)] font-serif">
                OSTRAKA
              </h1>
              <p className="text-[11px] text-gray-400 font-semibold tracking-[0.35em] uppercase mt-2">
                Fractal Simulation & RPG Engine
              </p>
            </div>

            {/* Active Hero Banner if exists */}
            {character ? (
              <div className="w-full bg-gray-900/90 border border-gray-700/80 rounded-lg p-3 text-left flex items-center justify-between shadow-lg">
                <div>
                  <div className="text-xs font-bold text-amber-300">{character.name}</div>
                  <div className="text-[11px] text-gray-400">
                    Lv. {character.level || 1} • HP {character.current_hp}/{character.max_hp} • {character.equipped_weapon || 'Unarmed'}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-mono bg-amber-950/80 text-amber-400 px-2 py-0.5 rounded border border-amber-800">
                    Active Hero
                  </span>
                </div>
              </div>
            ) : null}

            {/* Menu Buttons Stack */}
            <div className="w-full space-y-3">
              <button
                type="button"
                onClick={handleContinue}
                className="w-full py-3.5 px-6 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-gray-950 font-black tracking-widest uppercase rounded-lg shadow-lg hover:shadow-amber-600/30 transition flex items-center justify-center gap-3 text-sm group"
              >
                <span className="text-lg group-hover:translate-x-0.5 transition-transform">▶</span>
                {character ? 'CONTINUE JOURNEY' : 'ENTER WORLD'}
              </button>

              <button
                type="button"
                onClick={() => { handleRollCharacter(); setShowCharModal(true); }}
                className="w-full py-3 px-6 bg-gray-850 hover:bg-gray-800 border border-amber-500/50 hover:border-amber-400 text-amber-300 font-bold tracking-wider uppercase rounded-lg transition flex items-center justify-center gap-2 text-sm shadow"
              >
                <span>✨</span> NEW GAME / CREATE HERO
              </button>

              <button
                type="button"
                onClick={handleOpenLoadModal}
                className="w-full py-3 px-6 bg-gray-850 hover:bg-gray-800 border border-gray-700 hover:border-gray-500 text-gray-300 hover:text-white font-bold tracking-wider uppercase rounded-lg transition flex items-center justify-center gap-2 text-sm shadow"
              >
                <span>📂</span> LOAD SAVED CAMPAIGN
              </button>

              <button
                type="button"
                onClick={handleOpenMemorialsModal}
                className="w-full py-2.5 px-6 bg-gray-850 hover:bg-gray-800 border border-purple-800/60 hover:border-purple-600 text-purple-300 hover:text-purple-100 font-bold tracking-wider uppercase rounded-lg transition flex items-center justify-center gap-2 text-xs shadow"
              >
                <span>🏛️</span> HALL OF THE FALLEN (MEMORIALS)
              </button>

              <button
                type="button"
                onClick={() => setInStartMenu(false)}
                className="w-full py-2.5 px-6 bg-gray-900/60 hover:bg-gray-800/80 border border-gray-800 hover:border-gray-600 text-gray-400 hover:text-gray-200 font-medium tracking-wider uppercase rounded-lg transition flex items-center justify-center gap-2 text-xs"
              >
                <span>🗺️</span> Jump into Sector Map
              </button>
            </div>

            {/* Start Menu Audio Bar */}
            <div className="w-full bg-gray-900/80 border border-gray-750 rounded-lg p-2.5 flex items-center justify-between text-xs shadow-md">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-amber-400">🎵</span>
                <div className="text-left min-w-0">
                  <span className="text-[11px] font-bold text-gray-200 block truncate" title={currentTrack.title}>
                    {currentTrack.title}
                  </span>
                  <span className="text-[9px] text-gray-400 block truncate">
                    {currentTrack.artist}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleToggleMusic}
                  className="px-2.5 py-1 bg-amber-950 hover:bg-amber-900 border border-amber-700 rounded text-amber-300 font-mono text-xs transition"
                >
                  {isPlayingMusic ? '⏸ Pause' : '▶ Play'}
                </button>
                <button
                  type="button"
                  onClick={handleNextTrack}
                  className="px-2 py-1 bg-gray-800 hover:bg-gray-700 border border-gray-650 rounded text-gray-300 font-mono text-xs transition"
                  title="Next Track"
                >
                  ⏭
                </button>
              </div>
            </div>

            {/* System Details Footer */}
            <div className="pt-4 border-t border-gray-800/80 w-full flex justify-between items-center text-[10px] text-gray-500 font-mono">
              <span>12 ATTRIBUTES</span>
              <span>AI CHRONICLER</span>
              <span>PERSISTENT WORLD</span>
            </div>
          </div>
        </div>
      )}

      {/* Character Creation Studio Modal */}
      {showCharModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-3 md:p-6">
          <div className="bg-gray-900 border border-amber-600/70 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-[0_20px_60px_rgba(0,0,0,0.9)] overflow-hidden">
            {/* Studio Header */}
            <div className="p-4 border-b border-gray-800 bg-gray-950 flex justify-between items-center">
              <div>
                <h2 className="text-lg md:text-xl font-black text-amber-400 tracking-wider flex items-center gap-2">
                  <span>🐾</span> CHARACTER STUDIO — OSTRAKA
                </h2>
                <p className="text-xs text-gray-400">Animal Ancestry • 12-Stat Allocation • Loadout Attunement • Mastery Perks</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCharModal(false)}
                className="text-gray-400 hover:text-white text-lg font-bold p-1 rounded hover:bg-gray-800 transition"
              >
                ✕
              </button>
            </div>

            {/* Quick Build Presets Bar */}
            <div className="bg-gray-950 px-4 py-2.5 border-b border-gray-800 flex items-center justify-between gap-3 overflow-x-auto select-none">
              <div className="flex items-center gap-1.5 text-xs text-amber-400 font-bold whitespace-nowrap">
                <span>⚡</span>
                <span className="tracking-wider uppercase text-[11px]">Quick Archetypes:</span>
              </div>
              <div className="flex gap-2">
                {QUICK_PRESETS.map(p => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className="px-2.5 py-1.5 bg-gray-900 hover:bg-amber-950/70 border border-gray-750 hover:border-amber-500 rounded-lg text-[11px] font-bold text-gray-200 hover:text-white transition flex items-center gap-1.5 shadow-sm whitespace-nowrap"
                    title={p.desc}
                  >
                    <span>{p.icon}</span>
                    <span>{p.name}</span>
                    <span className="text-[9.5px] text-gray-400 font-mono font-normal">({p.tagline})</span>
                  </button>
                ))}
              </div>
            </div>

                        {/* Studio Navigation Tabs */}
            <div className="flex border-b border-gray-800 bg-gray-950/80 px-4 gap-2 overflow-x-auto text-xs font-bold">
              {[
                { id: 'bodyHeritage', label: '1. Physical Heritage (Choices 1-3)', icon: '⚡' },
                { id: 'mindDoctrine', label: '2. Mental Doctrine & Species (Choices 4-6)', icon: '🧠' },
                { id: 'tracks', label: '3. Powers & Disciplines (Choices 7-9)', icon: '🌌' },
                { id: 'review', label: '4. Arsenal, Difficulty & Review', icon: '⚔️' }
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCreationTab(tab.id as any)}
                  className={`py-3 px-3.5 border-b-2 flex items-center gap-1.5 transition uppercase tracking-wider whitespace-nowrap ${
                    creationTab === tab.id
                      ? 'border-amber-500 text-amber-300 bg-amber-950/20'
                      : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-700'
                  }`}
                >
                  <span>{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Studio Content Area */}
            <div className="p-5 overflow-y-auto space-y-6 flex-1 text-gray-200">
              {/* TAB 1: PHYSICAL HERITAGE (CHOICES 1, 2, 3 -> 27 BODY POINTS) */}
              {creationTab === 'bodyHeritage' && (
                <div className="space-y-6">
                  {/* Step Overview Banner */}
                  <div className="p-4 bg-gradient-to-r from-amber-950/70 via-gray-900 to-amber-900/40 border border-amber-600/70 rounded-xl space-y-2">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                      <div>
                        <span className="text-[11px] font-mono font-bold text-amber-400 uppercase tracking-wider">
                          Phase I: Physical Biological Matrix (27 Points)
                        </span>
                        <h3 className="text-base font-black text-white flex items-center gap-2 mt-0.5">
                          <span>🐾 Species Kingdom: {creationForm.kingdom}</span>
                          <span className="text-gray-500">•</span>
                          <span className="text-amber-300">Core Attribute: {creationForm.body7?.toUpperCase()} (+7)</span>
                        </h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded bg-amber-950 text-amber-300 border border-amber-800 text-xs font-mono font-bold">
                          Choices 1 - 3: 27 / 27 Body Pts
                        </span>
                      </div>
                    </div>
                    <p className="text-[11px] text-gray-300 leading-relaxed">
                      Allocate 6 body splits (<strong>+7 & +4</strong>, <strong>+6 & +3</strong>, <strong>+5 & +2</strong>).
                      Each physical stat is chosen <strong>exactly once</strong>. Your primary <strong>+7 choice</strong> establishes your <strong>Animal Kingdom</strong> and biological engine. Secondary and tertiary splits shape your anatomical build.
                    </p>
                  </div>

                  {/* Active Kingdom Deep Biological Profile & Stat Shift Hint */}
                  {(() => {
                    const profile = KINGDOM_PROFILES[creationForm.kingdom] || KINGDOM_PROFILES.Mammal;
                    const lore = optionsData?.kingdomLore?.[creationForm.kingdom];
                    return (
                      <div className="p-4 bg-gray-900 border border-amber-500/50 rounded-xl space-y-3 shadow-lg shadow-black/40">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                          <div className="flex items-center gap-3">
                            <span className="text-3xl">{profile.icon}</span>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-black text-amber-300 uppercase tracking-wide">
                                  {creationForm.kingdom} Kingdom Biology
                                </span>
                                <span className="text-[10px] bg-amber-950 text-amber-400 px-2 py-0.5 rounded font-mono border border-amber-800 font-bold">
                                  Primary: +7 {profile.stat.toUpperCase()}
                                </span>
                              </div>
                              <p className="text-xs text-gray-300 mt-0.5 leading-snug">
                                {lore?.summary || profile.summary}
                              </p>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono text-gray-400 bg-gray-950 px-2.5 py-1 rounded border border-gray-800 whitespace-nowrap">
                            Vibe: {lore?.vibe || profile.vibe}
                          </span>
                        </div>

                        {/* Rich Stat Shift & Physiological Rationale */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-gray-800">
                          <div className="bg-gray-950/80 p-2.5 rounded-lg border border-gray-800">
                            <span className="text-[10.5px] font-bold text-amber-400 uppercase tracking-wider block">
                              🔬 Physiological Architecture:
                            </span>
                            <p className="text-[10.5px] text-gray-300 mt-1 leading-relaxed">
                              {lore?.biology || profile.biology}
                            </p>
                          </div>
                          <div className="bg-gray-950/80 p-2.5 rounded-lg border border-amber-900/60">
                            <span className="text-[10.5px] font-bold text-emerald-400 uppercase tracking-wider block">
                              📈 Core Stat Shift & Combat Impact:
                            </span>
                            <p className="text-[10.5px] text-emerald-200 mt-1 leading-relaxed font-mono">
                              {lore?.statShiftHint || `+7 to ${profile.stat.toUpperCase()} shifts baseline physical endurance and recovery to an apex tier.`}
                            </p>
                          </div>
                        </div>

                        {/* Natural Strengths & Biological Trade-offs */}
                        <div className="pt-2 border-t border-gray-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-[11px]">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Natural Strengths:</span>
                            {profile.strengths.map((str: string, i: number) => (
                              <span key={i} className="bg-emerald-950/80 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded font-mono text-[10px]">
                                {str}
                              </span>
                            ))}
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Biological Trade-offs:</span>
                            {profile.weaknesses.map((w: string, i: number) => (
                              <span key={i} className="bg-gray-950 text-gray-400 border border-gray-800 px-2 py-0.5 rounded font-mono text-[10px]">
                                {w}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Active Kingdom Character Artwork & Gemini Animal Kin Sprites Showcase */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-900 border border-amber-600/50 rounded-xl p-3.5 shadow-lg shadow-black/40">
                    {/* Left Column: Lineage Portrait */}
                    <div className="flex flex-col items-center justify-center p-2.5 bg-gray-950 rounded-lg border border-gray-800">
                      <div className="w-28 h-28 rounded-lg overflow-hidden border-2 border-amber-500/70 shadow-md relative bg-gray-900">
                        <img
                          src={KINGDOM_PORTRAITS[creationForm.kingdom]?.image || '/gfx/fox_kin.jpg'}
                          alt={creationForm.kingdom}
                          className="w-full h-full object-cover object-top"
                        />
                        <div className="absolute bottom-0 inset-x-0 bg-black/80 px-1 py-0.5 text-center">
                          <span className="text-[9.5px] font-bold text-amber-300 truncate block">
                            {KINGDOM_PORTRAITS[creationForm.kingdom]?.name}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] text-gray-400 font-mono mt-1.5 text-center">
                        {KINGDOM_PORTRAITS[creationForm.kingdom]?.title}
                      </span>
                    </div>

                    {/* Right Columns: Gemini Animal Kin Sprites Gallery */}
                    <div className="md:col-span-2 flex flex-col justify-center space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-300 uppercase tracking-wide">
                          🐾 {creationForm.kingdom} Animal Kin Sprites (Gemini GFX)
                        </span>
                        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/70 px-2 py-0.5 rounded border border-emerald-800">
                          128x128 Pixel Matrix
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-300 leading-relaxed">
                        Every hero embodies a living animal lineage of Cruorbus. Choose your species to set your on-map pixel sprite and passive bonuses:
                      </p>
                      <div className="flex items-center gap-2 overflow-x-auto py-1">
                        {(optionsData?.lineages?.[creationForm.kingdom] || []).slice(0, 6).map((lin: any) => {
                          const { col, row } = getAnimalSpriteCoords(creationForm.kingdom, lin.name, 0);
                          const isSelected = creationForm.lineage === lin.name;
                          return (
                            <button
                              key={lin.name}
                              type="button"
                              onClick={() => {
                                setCreationForm((prev: any) => ({
                                  ...prev,
                                  lineage: lin.name,
                                  species: lin.name
                                }));
                              }}
                              className={`flex flex-col items-center p-1.5 rounded border transition shrink-0 min-w-[70px] ${
                                isSelected
                                  ? 'bg-amber-950/80 border-amber-500 shadow-sm shadow-amber-500/20'
                                  : 'bg-gray-950 border-gray-800 hover:border-gray-600'
                              }`}
                            >
                              <div
                                className="w-10 h-10 rounded overflow-hidden bg-gray-900 border border-gray-700/60"
                                style={{
                                  backgroundImage: 'url(/gfx/Gemini_Generated_Image_a4motwa4motwa4mo.png)',
                                  backgroundPosition: `-${col * 40}px -${row * 40}px`,
                                  backgroundSize: `${22 * 40}px ${12 * 40}px`,
                                  imageRendering: 'pixelated'
                                }}
                              />
                              <span className="text-[9.5px] font-mono font-bold text-amber-200 mt-1 text-center truncate max-w-[66px]" title={lin.name}>
                                {lin.name}
                              </span>
                              <span className="text-[8px] text-gray-400 font-mono">
                                +{lin.plus?.toUpperCase()}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* The 3 Body Choice Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* CHOICE 1: 7 / 4 Body Split */}
                    <div className="bg-gray-850 p-4 rounded-xl border border-amber-600/50 space-y-3 relative overflow-hidden">
                      <div className="border-b border-gray-700 pb-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-black text-amber-400 uppercase tracking-wider">Choice 1: 7 / 4 Split</span>
                          <span className="text-[9.5px] bg-amber-950 text-amber-300 px-2 py-0.5 rounded font-mono border border-amber-800 font-bold uppercase">
                            Sets Kingdom
                          </span>
                        </div>
                        <p className="text-[10.5px] text-gray-300 mt-1">
                          Primary (+7) sets your <strong>Animal Kingdom</strong>. Secondary (+4) boosts a complementary physical trait.
                        </p>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="text-[11px] font-bold text-amber-300 uppercase block mb-1">
                            Primary Stat (+7) ➔ Animal Kingdom
                          </label>
                          <select
                            value={creationForm.body7}
                            onChange={e => setBodySplit('body7', e.target.value)}
                            className="w-full bg-gray-900 border border-amber-500/70 rounded-lg p-2 text-xs text-amber-200 font-bold focus:outline-none"
                          >
                            {getAvailableBodyOptions('body7').map(st => {
                              const kName = optionsData?.bodyStatToKingdom?.[st] || 'Animal';
                              return (
                                <option key={st} value={st}>
                                  +7 {st.toUpperCase()} ➔ {kName} Kingdom
                                </option>
                              );
                            })}
                          </select>
                          <div className="text-[10px] text-gray-400 italic mt-1 leading-tight">
                            Primary physiological engine defining your species kingdom.
                          </div>
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-gray-300 uppercase block mb-1">
                            Secondary Stat (+4) ➔ Complementary Trait
                          </label>
                          <select
                            value={creationForm.body4}
                            onChange={e => setBodySplit('body4', e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-xs text-gray-200 font-bold focus:outline-none"
                          >
                            {getAvailableBodyOptions('body4').map(st => (
                              <option key={st} value={st}>
                                +4 {st.toUpperCase()}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* CHOICE 2: 6 / 3 Body Split */}
                    <div className="bg-gray-850 p-4 rounded-xl border border-orange-600/50 space-y-3 relative overflow-hidden">
                      <div className="border-b border-gray-700 pb-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-black text-orange-400 uppercase tracking-wider">Choice 2: 6 / 3 Split</span>
                          <span className="text-[9.5px] bg-orange-950 text-orange-300 px-2 py-0.5 rounded font-mono border border-orange-800 font-bold uppercase">
                            Major Physical Pair
                          </span>
                        </div>
                        <p className="text-[10.5px] text-gray-300 mt-1">
                          Major (+6) sharpens your secondary physical specialization. Minor (+3) reinforces it.
                        </p>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="text-[11px] font-bold text-orange-300 uppercase block mb-1">
                            Major Physical Stat (+6)
                          </label>
                          <select
                            value={creationForm.body6}
                            onChange={e => setBodySplit('body6', e.target.value)}
                            className="w-full bg-gray-900 border border-orange-500/70 rounded-lg p-2 text-xs text-orange-200 font-bold focus:outline-none"
                          >
                            {getAvailableBodyOptions('body6').map(st => (
                              <option key={st} value={st}>
                                +6 {st.toUpperCase()}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-gray-300 uppercase block mb-1">
                            Minor Stat (+3)
                          </label>
                          <select
                            value={creationForm.body3}
                            onChange={e => setBodySplit('body3', e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-xs text-gray-200 font-bold focus:outline-none"
                          >
                            {getAvailableBodyOptions('body3').map(st => (
                              <option key={st} value={st}>
                                +3 {st.toUpperCase()}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* CHOICE 3: 5 / 2 Body Split */}
                    <div className="bg-gray-850 p-4 rounded-xl border border-gray-700 space-y-3 relative overflow-hidden">
                      <div className="border-b border-gray-700 pb-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-black text-gray-300 uppercase tracking-wider">Choice 3: 5 / 2 Split</span>
                          <span className="text-[9.5px] bg-gray-900 text-gray-400 px-2 py-0.5 rounded font-mono border border-gray-750 font-bold uppercase">
                            Remainder Stats
                          </span>
                        </div>
                        <p className="text-[10.5px] text-gray-300 mt-1">
                          Allocates <strong>+5</strong> and <strong>+2</strong> across the last two remaining physical attributes.
                        </p>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="text-[11px] font-bold text-gray-200 uppercase block mb-1">
                            Minor-High Stat (+5)
                          </label>
                          <select
                            value={creationForm.body5}
                            onChange={e => setBodySplit('body5', e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-xs text-gray-200 font-bold focus:outline-none"
                          >
                            {getAvailableBodyOptions('body5').map(st => (
                              <option key={st} value={st}>
                                +5 {st.toUpperCase()}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-gray-400 uppercase block mb-1">
                            Base Stat (+2)
                          </label>
                          <select
                            value={creationForm.body2}
                            onChange={e => setBodySplit('body2', e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-xs text-gray-400 font-bold focus:outline-none"
                          >
                            {getAvailableBodyOptions('body2').map(st => (
                              <option key={st} value={st}>
                                +2 {st.toUpperCase()}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Body Stat Live Matrix */}
                  <div className="bg-gray-950 p-4 rounded-xl border border-gray-800">
                    <div className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2.5 flex justify-between items-center">
                      <span>Physical Body Matrix (6 Attributes)</span>
                      <span className="text-[10.5px] text-amber-300 font-mono font-bold">
                        Total Allocated: {BODY_STAT_KEYS.reduce((s, k) => s + (Number(creationForm[k]) || 0), 0)} / 27 Points
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                      {BODY_STAT_KEYS.map(st => {
                        let splitBonus = 0;
                        if (creationForm.body7 === st) splitBonus = 7;
                        else if (creationForm.body4 === st) splitBonus = 4;
                        else if (creationForm.body6 === st) splitBonus = 6;
                        else if (creationForm.body3 === st) splitBonus = 3;
                        else if (creationForm.body5 === st) splitBonus = 5;
                        else if (creationForm.body2 === st) splitBonus = 2;
                        const info = STAT_INFO[st];
                        return (
                          <div key={st} className="bg-gray-900 p-2.5 rounded-lg border border-gray-800 text-center font-mono">
                            <span className="text-base">{info?.icon || '⚡'}</span>
                            <div className="text-xs font-bold text-white uppercase mt-0.5">{st}</div>
                            <div className="text-xl font-black text-amber-400 mt-0.5">{creationForm[st] || 0}</div>
                            <div className="text-[10px] text-emerald-400 font-bold">+{splitBonus} split</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Navigation Buttons for Step 1 */}
                  <div className="flex justify-between items-center pt-2">
                    <button
                      type="button"
                      onClick={() => handleRollCharacter(creationForm.kingdom, creationForm.lineage, creationForm.institution)}
                      className="text-xs bg-gray-850 hover:bg-gray-800 text-amber-300 border border-gray-700 hover:border-amber-500 px-3 py-2 rounded transition font-bold flex items-center gap-1.5 shadow"
                    >
                      <span>🎲</span> Randomize Build Choices
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreationTab('mindDoctrine')}
                      className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-gray-950 rounded text-xs font-black tracking-wider uppercase transition flex items-center gap-1.5 shadow"
                    >
                      Next: Mental Doctrine & Species Lineage <span>➔</span>
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: MENTAL DOCTRINE & SPECIES (CHOICES 4, 5, 6 -> 27 MIND POINTS) */}
              {creationTab === 'mindDoctrine' && (
                <div className="space-y-6">
                  {/* Step Overview Banner */}
                  <div className="p-4 bg-gradient-to-r from-blue-950/70 via-gray-900 to-indigo-900/40 border border-blue-600/70 rounded-xl space-y-2">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                      <div>
                        <span className="text-[11px] font-mono font-bold text-blue-400 uppercase tracking-wider">
                          Phase II: Cognitive & Metaphysical Doctrine (27 Points)
                        </span>
                        <h3 className="text-base font-black text-white flex items-center gap-2 mt-0.5">
                          <span>🧠 Mind Core: {creationForm.mind7?.toUpperCase()} (+7)</span>
                          <span className="text-gray-500">•</span>
                          <span className="text-cyan-300">🐾 Determined Species: {creationForm.species} ({creationForm.lineage})</span>
                        </h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded bg-blue-950 text-blue-300 border border-blue-800 text-xs font-mono font-bold">
                          Choices 4 - 6: 27 / 27 Mind Pts
                        </span>
                      </div>
                    </div>
                    <p className="text-[11px] text-gray-300 leading-relaxed">
                      Allocate 6 mind splits (<strong>+7 & +4</strong>, <strong>+6 & +3</strong>, <strong>+5 & +2</strong>).
                      Each mental stat is chosen <strong>exactly once</strong>. Your primary <strong>+7 choice</strong> establishes your core cognitive discipline. Together with your physical choices, your exact <strong>Animal Species Lineage</strong> is formed.
                    </p>
                  </div>

                  {/* The 3 Mind Choice Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* CHOICE 4: 7 / 4 Mind Split */}
                    <div className="bg-gray-850 p-4 rounded-xl border border-blue-600/50 space-y-3 relative overflow-hidden">
                      <div className="border-b border-gray-700 pb-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-black text-blue-400 uppercase tracking-wider">Choice 4: 7 / 4 Split</span>
                          <span className="text-[9.5px] bg-blue-950 text-blue-300 px-2 py-0.5 rounded font-mono border border-blue-800 font-bold uppercase">
                            Primary Cognitive Pair
                          </span>
                        </div>
                        <p className="text-[10.5px] text-gray-300 mt-1">
                          Primary (+7) sets your dominant cognitive engine. Secondary (+4) sharpens tactical acumen.
                        </p>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="text-[11px] font-bold text-blue-300 uppercase block mb-1">
                            Primary Mind Stat (+7)
                          </label>
                          <select
                            value={creationForm.mind7}
                            onChange={e => setMindSplit('mind7', e.target.value)}
                            className="w-full bg-gray-900 border border-blue-500/70 rounded-lg p-2 text-xs text-blue-200 font-bold focus:outline-none"
                          >
                            {getAvailableMindOptions('mind7').map(st => (
                              <option key={st} value={st}>
                                +7 {st.toUpperCase()}
                              </option>
                            ))}
                          </select>
                          <div className="text-[10px] text-gray-400 italic mt-1 leading-tight">
                            Governs tactical composure, mental resistance, and cognitive aptitude.
                          </div>
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-gray-300 uppercase block mb-1">
                            Secondary Stat (+4)
                          </label>
                          <select
                            value={creationForm.mind4}
                            onChange={e => setMindSplit('mind4', e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-xs text-gray-200 font-bold focus:outline-none"
                          >
                            {getAvailableMindOptions('mind4').map(st => (
                              <option key={st} value={st}>
                                +4 {st.toUpperCase()}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* CHOICE 5: 6 / 3 Mind Split */}
                    <div className="bg-gray-850 p-4 rounded-xl border border-indigo-600/50 space-y-3 relative overflow-hidden">
                      <div className="border-b border-gray-700 pb-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-black text-indigo-400 uppercase tracking-wider">Choice 5: 6 / 3 Split</span>
                          <span className="text-[9.5px] bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded font-mono border border-indigo-800 font-bold uppercase">
                            Major / Minor
                          </span>
                        </div>
                        <p className="text-[10.5px] text-gray-300 mt-1">
                          Major (+6) elevates sensory depth or cosmic logic. Minor (+3) rounds out mental versatility.
                        </p>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="text-[11px] font-bold text-indigo-300 uppercase block mb-1">
                            Major Stat (+6)
                          </label>
                          <select
                            value={creationForm.mind6}
                            onChange={e => setMindSplit('mind6', e.target.value)}
                            className="w-full bg-gray-900 border border-indigo-500/70 rounded-lg p-2 text-xs text-indigo-200 font-bold focus:outline-none"
                          >
                            {getAvailableMindOptions('mind6').map(st => (
                              <option key={st} value={st}>
                                +6 {st.toUpperCase()}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-gray-300 uppercase block mb-1">
                            Minor Stat (+3)
                          </label>
                          <select
                            value={creationForm.mind3}
                            onChange={e => setMindSplit('mind3', e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-xs text-gray-200 font-bold focus:outline-none"
                          >
                            {getAvailableMindOptions('mind3').map(st => (
                              <option key={st} value={st}>
                                +3 {st.toUpperCase()}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* CHOICE 6: 5 / 2 Mind Split */}
                    <div className="bg-gray-850 p-4 rounded-xl border border-gray-700 space-y-3 relative overflow-hidden">
                      <div className="border-b border-gray-700 pb-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-black text-gray-300 uppercase tracking-wider">Choice 6: 5 / 2 Split</span>
                          <span className="text-[9.5px] bg-gray-900 text-gray-400 px-2 py-0.5 rounded font-mono border border-gray-750 font-bold uppercase">
                            Remainder Stats
                          </span>
                        </div>
                        <p className="text-[10.5px] text-gray-300 mt-1">
                          Allocates <strong>+5</strong> and <strong>+2</strong> to the remaining two cognitive attributes.
                        </p>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="text-[11px] font-bold text-gray-200 uppercase block mb-1">
                            Minor-High Stat (+5)
                          </label>
                          <select
                            value={creationForm.mind5}
                            onChange={e => setMindSplit('mind5', e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-xs text-gray-200 font-bold focus:outline-none"
                          >
                            {getAvailableMindOptions('mind5').map(st => (
                              <option key={st} value={st}>
                                +5 {st.toUpperCase()}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-gray-400 uppercase block mb-1">
                            Base Stat (+2)
                          </label>
                          <select
                            value={creationForm.mind2}
                            onChange={e => setMindSplit('mind2', e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-xs text-gray-400 font-bold focus:outline-none"
                          >
                            {getAvailableMindOptions('mind2').map(st => (
                              <option key={st} value={st}>
                                +2 {st.toUpperCase()}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Determined Species & Lineage Trait Card */}
                  <div className="p-4 bg-gray-900 border border-amber-600/40 rounded-xl space-y-3">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-gray-800 pb-2">
                      <div>
                        <span className="text-[11px] font-mono font-bold text-amber-400 uppercase tracking-wider block">
                          Determined Animal Lineage ({creationForm.kingdom})
                        </span>
                        <h4 className="text-sm font-bold text-white mt-0.5">
                          🐾 {creationForm.species} — <span className="text-amber-300">{creationForm.lineage}</span>
                        </h4>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-[10px] text-gray-400 font-mono">Lineage Variant:</label>
                        <select
                          value={creationForm.lineage}
                          onChange={e => handleSelectLineage(e.target.value)}
                          className="bg-gray-850 border border-gray-700 rounded p-1 text-xs text-amber-300 font-bold focus:outline-none"
                        >
                          {(optionsData?.lineages?.[creationForm.kingdom] || []).map((lin: any) => (
                            <option key={lin.name} value={lin.name}>
                              {lin.name} ({lin.speciesType})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {(() => {
                      const lin = (optionsData?.lineages?.[creationForm.kingdom] || []).find((l: any) => l.name === creationForm.lineage);
                      return (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          <div className="bg-gray-950 p-3 rounded-lg border border-gray-800">
                            <span className="text-[10px] font-bold text-amber-300 uppercase block mb-1">
                              ✨ Species Passive Trait: {lin?.traitName || 'Biological Resilience'}
                            </span>
                            <p className="text-[11px] text-gray-300 leading-snug">
                              {lin?.traitDesc || 'Natural biological fortitude hardened by harsh ecosystem conditions.'}
                            </p>
                          </div>
                          <div className="bg-gray-950 p-3 rounded-lg border border-gray-800">
                            <span className="text-[10px] font-bold text-emerald-300 uppercase block mb-1">
                              🧬 Instinctive Focus:
                            </span>
                            <p className="text-[11px] text-gray-300 leading-snug font-mono">
                              Attuned to +{lin?.plus?.toUpperCase()} combat resolution. Inherits the instincts of apex {creationForm.species}.
                            </p>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Mind Stat Live Matrix */}
                  <div className="bg-gray-950 p-4 rounded-xl border border-gray-800">
                    <div className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2.5 flex justify-between items-center">
                      <span>Cognitive Mind Matrix (6 Attributes)</span>
                      <span className="text-[10.5px] text-blue-300 font-mono font-bold">
                        Total Allocated: {MIND_STAT_KEYS.reduce((s, k) => s + (Number(creationForm[k]) || 0), 0)} / 27 Points
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                      {MIND_STAT_KEYS.map(st => {
                        let splitBonus = 0;
                        if (creationForm.mind7 === st) splitBonus = 7;
                        else if (creationForm.mind4 === st) splitBonus = 4;
                        else if (creationForm.mind6 === st) splitBonus = 6;
                        else if (creationForm.mind3 === st) splitBonus = 3;
                        else if (creationForm.mind5 === st) splitBonus = 5;
                        else if (creationForm.mind2 === st) splitBonus = 2;
                        const info = STAT_INFO[st];
                        return (
                          <div key={st} className="bg-gray-900 p-2.5 rounded-lg border border-gray-800 text-center font-mono">
                            <span className="text-base">{info?.icon || '🧠'}</span>
                            <div className="text-xs font-bold text-white uppercase mt-0.5">{st}</div>
                            <div className="text-xl font-black text-blue-400 mt-0.5">{creationForm[st] || 0}</div>
                            <div className="text-[10px] text-cyan-400 font-bold">+{splitBonus} split</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Navigation Buttons for Step 2 */}
                  <div className="flex justify-between items-center pt-2">
                    <button
                      type="button"
                      onClick={() => setCreationTab('bodyHeritage')}
                      className="px-4 py-2 bg-gray-850 hover:bg-gray-800 text-gray-300 rounded text-xs font-bold transition flex items-center gap-1.5"
                    >
                      <span>⬅</span> Back to Physical Heritage
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreationTab('tracks')}
                      className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-black tracking-wider uppercase transition flex items-center gap-1.5 shadow"
                    >
                      Next: Powers & Combat Skills <span>➔</span>
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 3: POWERS & COMBAT DISCIPLINES (CHOICES 7, 8, 9 -> 6 STAT POINTS) */}
              {creationTab === 'tracks' && (
                <div className="space-y-6">
                  {/* Step Overview Banner */}
                  <div className="p-4 bg-gradient-to-r from-purple-950/70 via-gray-900 to-indigo-950/70 border border-purple-600/70 rounded-xl space-y-2">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                      <div>
                        <span className="text-[11px] font-mono font-bold text-purple-400 uppercase tracking-wider">
                          Phase III: Powers & Combat Disciplines (6 Points)
                        </span>
                        <h3 className="text-base font-black text-white flex items-center gap-2 mt-0.5">
                          <span>🌌 Choice 7: Power or Null</span>
                          <span className="text-gray-500">•</span>
                          <span className="text-orange-400">⚔️ Choice 8: Offense</span>
                          <span className="text-gray-500">•</span>
                          <span className="text-sky-400">🛡️ Choice 9: Defense</span>
                        </h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded bg-purple-950 text-purple-300 border border-purple-800 text-xs font-mono font-bold">
                          Choices 7 - 9: 6 / 6 Points
                        </span>
                      </div>
                    </div>
                    <p className="text-[11px] text-gray-300 leading-relaxed">
                      Choices 7, 8, and 9 provide <strong>+2 stat points each</strong> (or +1/+1 in Dual Track mode), unlocking your active supernatural powers, offensive battle maneuvers, and defensive combat reactions.
                    </p>
                  </div>

                  {/* CHOICE 7: POWER OR NULL CONSTANT ATTUNEMENT & STARTING BRANCH (RANK 1) */}
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                      <div>
                        <label className="text-xs font-black text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                          <span>🌌</span> Choice 7: Power or Null Constant (+2 Pts)
                        </label>
                        <p className="text-[11px] text-gray-400">
                          Attunes you to one of the 12 constants of reality. Choose single focus (+2) or dual attunement (+1 / +1), and select which branch unlocks at <strong>Rank 1</strong>.
                        </p>
                      </div>

                      {/* Dual Track Mode Toggle */}
                      <div className="flex items-center gap-2 bg-gray-900 p-1 rounded-lg border border-gray-800 text-xs font-mono">
                        <button
                          type="button"
                          onClick={() => handleToggleDualTrack(false)}
                          className={`px-2.5 py-1 rounded font-bold transition ${
                            !creationForm.dualTrackMode
                              ? 'bg-purple-900 text-purple-200 border border-purple-600'
                              : 'text-gray-400 hover:text-white'
                          }`}
                        >
                          Single Focus (+2)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleDualTrack(true)}
                          className={`px-2.5 py-1 rounded font-bold transition ${
                            creationForm.dualTrackMode
                              ? 'bg-purple-900 text-purple-200 border border-purple-600'
                              : 'text-gray-400 hover:text-white'
                          }`}
                        >
                          Dual Attunement (+1 / +1)
                        </button>
                      </div>
                    </div>

                    {/* Dual Track Mode Selectors */}
                    {creationForm.dualTrackMode && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-gray-900 rounded-xl border border-purple-800/60">
                        <div>
                          <label className="text-[11px] font-bold text-purple-300 uppercase block mb-1">
                            Primary Track (+1 Stat):
                          </label>
                          <select
                            value={creationForm.trackId}
                            onChange={e => handleSelectTrack(e.target.value)}
                            className="w-full bg-gray-850 border border-purple-700 rounded-lg p-2 text-xs text-purple-200 font-bold focus:outline-none"
                          >
                            {(optionsData?.powerNullTracks || []).map((t: any) => (
                              <option key={t.id} value={t.id}>
                                {t.name} (+1 {t.stat?.toUpperCase()})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-purple-300 uppercase block mb-1">
                            Secondary Track (+1 Stat):
                          </label>
                          <select
                            value={creationForm.trackId2 || (optionsData?.powerNullTracks?.[1]?.id || 'track_endurance')}
                            onChange={e => handleSelectTrack2(e.target.value)}
                            className="w-full bg-gray-850 border border-purple-700 rounded-lg p-2 text-xs text-purple-200 font-bold focus:outline-none"
                          >
                            {(optionsData?.powerNullTracks || []).map((t: any) => (
                              <option key={t.id} value={t.id}>
                                {t.name} (+1 {t.stat?.toUpperCase()})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    {/* Grid of the 12 Power / Null Tracks */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 max-h-56 overflow-y-auto pr-1">
                      {(optionsData?.powerNullTracks || []).map((t: any) => {
                        const isSelected = creationForm.trackId === t.id || (creationForm.dualTrackMode && creationForm.trackId2 === t.id);
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => {
                              if (creationForm.dualTrackMode) {
                                if (creationForm.trackId === t.id) return;
                                handleSelectTrack2(t.id);
                              } else {
                                handleSelectTrack(t.id);
                              }
                            }}
                            className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                              isSelected
                                ? 'border-purple-500 bg-purple-950/60 shadow-md ring-1 ring-purple-500'
                                : 'border-gray-800 bg-gray-850 hover:bg-gray-800 hover:border-gray-700'
                            }`}
                          >
                            <div>
                              <div className="flex justify-between items-center">
                                <span className="font-bold text-xs text-white">{t.name}</span>
                                <span className="text-[10px] font-mono text-emerald-400 bg-gray-900 px-1.5 py-0.5 rounded border border-gray-800 font-bold">
                                  +{creationForm.dualTrackMode ? 1 : 2} {t.stat?.toUpperCase()}
                                </span>
                              </div>
                              <div className="text-[10px] text-purple-300 mt-1 font-semibold">✨ Power: {t.powerName}</div>
                              <p className="text-[10px] text-gray-300 line-clamp-1">{t.powerDesc}</p>
                            </div>
                            <div className="mt-2 pt-1.5 border-t border-gray-800/80">
                              <span className="text-[10px] text-sky-300 font-semibold">🌑 Null: {t.nullName}</span>
                              <p className="text-[10px] text-gray-400 line-clamp-1">{t.nullDesc}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Interactive 3-Branch Selector for Power / Null Choice */}
                    {(() => {
                      const selTrack = (optionsData?.powerNullTracks || []).find((t: any) => t.id === creationForm.trackId) || optionsData?.powerNullTracks?.[0];
                      const powerTree = optionsData?.realityPowerTrees?.[selTrack?.stat || 'might'];
                      const activeBranchRole = creationForm.powerBranchChoice || 'OFFENSE';
                      if (!powerTree) return null;
                      return (
                        <div className="bg-gray-950 p-3.5 rounded-xl border border-purple-700/60 space-y-2.5">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-purple-300 uppercase tracking-wide">
                              🌌 {powerTree.treeName} — Select Starting Branch (Unlocks at Rank 1)
                            </span>
                            <span className="text-[10px] font-mono text-purple-400 bg-purple-950 px-2 py-0.5 rounded border border-purple-800">
                              {powerTree.constantName}
                            </span>
                          </div>
                          <p className="text-[10.5px] text-gray-400 italic leading-snug">{powerTree.philosophicalCore}</p>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
                            {[
                              { role: 'OFFENSE', branch: powerTree.offense, icon: '⚡' },
                              { role: 'DEFENSE', branch: powerTree.defense, icon: '🛡️' },
                              { role: 'UTILITY', branch: powerTree.utility, icon: '🔮' }
                            ].map(({ role, branch, icon }) => {
                              const isPicked = activeBranchRole === role;
                              const r1 = branch.ranks[0];
                              const r4 = branch.ranks[3];
                              return (
                                <button
                                  key={role}
                                  type="button"
                                  onClick={() => handleSelectPowerBranch(role as any)}
                                  className={`p-2.5 rounded-lg border text-left transition flex flex-col justify-between ${
                                    isPicked
                                      ? 'border-purple-400 bg-purple-900/40 ring-1 ring-purple-400'
                                      : 'border-gray-800 bg-gray-900 hover:border-gray-700'
                                  }`}
                                >
                                  <div>
                                    <div className="flex justify-between items-center">
                                      <span className="text-[11px] font-bold text-white flex items-center gap-1">
                                        <span>{icon}</span> {role} BRANCH
                                      </span>
                                      <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                                        isPicked ? 'bg-purple-800 text-purple-200' : 'bg-gray-800 text-gray-400'
                                      }`}>
                                        {isPicked ? 'UNLOCKED R1' : 'LOCKED'}
                                      </span>
                                    </div>
                                    <div className="text-xs font-semibold text-purple-300 mt-1">{branch.name}</div>
                                    <p className="text-[10px] text-gray-300 mt-0.5 leading-snug line-clamp-2">{branch.tagline}</p>
                                  </div>
                                  <div className="mt-2 pt-1.5 border-t border-gray-800 text-[9.5px] text-gray-400 font-mono space-y-0.5">
                                    <div><strong className="text-purple-300">R1:</strong> {r1.description}</div>
                                    <div><strong className="text-amber-300">R4 Apex:</strong> {r4.description}</div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Interactive 3-Branch Selector for Secondary Track in Dual Attunement */}
                    {creationForm.dualTrackMode && (() => {
                      const selTrack2 = (optionsData?.powerNullTracks || []).find((t: any) => t.id === (creationForm.trackId2 || optionsData?.powerNullTracks?.[1]?.id)) || optionsData?.powerNullTracks?.[1];
                      const powerTree2 = optionsData?.realityPowerTrees?.[selTrack2?.stat || 'endurance'];
                      const activeBranchRole2 = creationForm.powerBranchChoice2 || 'DEFENSE';
                      if (!powerTree2) return null;
                      return (
                        <div className="bg-gray-950 p-3.5 rounded-xl border border-indigo-700/60 space-y-2.5">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-indigo-300 uppercase tracking-wide">
                              🌌 {powerTree2.treeName} — Select Secondary Starting Branch (Unlocks at Rank 1)
                            </span>
                            <span className="text-[10px] font-mono text-indigo-400 bg-indigo-950 px-2 py-0.5 rounded border border-indigo-800">
                              {powerTree2.constantName}
                            </span>
                          </div>
                          <p className="text-[10.5px] text-gray-400 italic leading-snug">{powerTree2.philosophicalCore}</p>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
                            {[
                              { role: 'OFFENSE', branch: powerTree2.offense, icon: '⚡' },
                              { role: 'DEFENSE', branch: powerTree2.defense, icon: '🛡️' },
                              { role: 'UTILITY', branch: powerTree2.utility, icon: '🔮' }
                            ].map(({ role, branch, icon }) => {
                              const isPicked = activeBranchRole2 === role;
                              const r1 = branch.ranks[0];
                              const r4 = branch.ranks[3];
                              return (
                                <button
                                  key={role}
                                  type="button"
                                  onClick={() => handleSelectPowerBranch2(role as any)}
                                  className={`p-2.5 rounded-lg border text-left transition flex flex-col justify-between ${
                                    isPicked
                                      ? 'border-indigo-400 bg-indigo-900/40 ring-1 ring-indigo-400'
                                      : 'border-gray-800 bg-gray-900 hover:border-gray-700'
                                  }`}
                                >
                                  <div>
                                    <div className="flex justify-between items-center">
                                      <span className="text-[11px] font-bold text-white flex items-center gap-1">
                                        <span>{icon}</span> {role} BRANCH
                                      </span>
                                      <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                                        isPicked ? 'bg-indigo-800 text-indigo-200' : 'bg-gray-800 text-gray-400'
                                      }`}>
                                        {isPicked ? 'UNLOCKED R1' : 'LOCKED'}
                                      </span>
                                    </div>
                                    <div className="text-xs font-semibold text-indigo-300 mt-1">{branch.name}</div>
                                    <p className="text-[10px] text-gray-300 mt-0.5 leading-snug line-clamp-2">{branch.tagline}</p>
                                  </div>
                                  <div className="mt-2 pt-1.5 border-t border-gray-800 text-[9.5px] text-gray-400 font-mono space-y-0.5">
                                    <div><strong className="text-indigo-300">R1:</strong> {r1.description}</div>
                                    <div><strong className="text-amber-300">R4 Apex:</strong> {r4.description}</div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* CHOICE 8: OFFENSE COMBAT TRACK & 3-BRANCH SELECTOR */}
                  <div className="space-y-4 pt-2 border-t border-gray-800">
                    <div className="flex justify-between items-center">
                      <div>
                        <label className="text-xs font-black text-orange-400 uppercase tracking-wider flex items-center gap-1.5">
                          <span>⚔️</span> Choice 8: Offensive Training (+2 Pts)
                        </label>
                        <p className="text-[11px] text-gray-400">12 Combat Maneuvers • Unlocks an offensive tree (+2 stat) with 3 branches scaling Rank 1 to 4</p>
                      </div>
                      <span className="text-[11px] font-mono text-orange-300 bg-orange-950 px-2 py-0.5 rounded border border-orange-800 font-bold">
                        Active: {creationForm.offenseSkill || 'Select Skill'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 max-h-48 overflow-y-auto pr-1">
                      {(optionsData?.offenseSkills || []).map((sk: any) => {
                        const isSelected = creationForm.offenseSkillId === sk.id;
                        return (
                          <button
                            key={sk.id}
                            type="button"
                            onClick={() => handleSelectOffenseSkill(sk.id)}
                            className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                              isSelected
                                ? 'border-orange-500 bg-orange-950/60 shadow-md ring-1 ring-orange-500'
                                : 'border-gray-800 bg-gray-850 hover:bg-gray-800 hover:border-gray-700'
                            }`}
                          >
                            <div>
                              <div className="flex justify-between items-center">
                                <span className="font-bold text-xs text-white">{sk.name}</span>
                                <span className="text-[10px] font-mono text-emerald-400 bg-gray-900 px-1.5 py-0.5 rounded border border-gray-800 font-bold">
                                  +2 {sk.stat?.toUpperCase()}
                                </span>
                              </div>
                              <span className="text-[10px] font-mono text-amber-400 block mt-1">{sk.cost}</span>
                            </div>
                            <p className="text-[10px] text-gray-300 line-clamp-1 mt-0.5 leading-tight">{sk.desc}</p>
                          </button>
                        );
                      })}
                    </div>

                    {/* Interactive 3-Branch Selector for Offensive Track */}
                    {(() => {
                      const selOff = (optionsData?.offenseSkills || []).find((s: any) => s.id === creationForm.offenseSkillId) || optionsData?.offenseSkills?.[0];
                      const offTrack = optionsData?.offensiveSkillTracks?.[selOff?.stat || 'might'];
                      const activeOffBranch = creationForm.offenseBranchChoice || 'SPECIALIZATION';
                      if (!offTrack) return null;
                      return (
                        <div className="bg-gray-950 p-3.5 rounded-xl border border-orange-700/60 space-y-2.5">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-orange-300 uppercase tracking-wide">
                              ⚔️ {offTrack.trackName} — Choose Starting Offensive Branch (Unlocks at Rank 1)
                            </span>
                            <span className="text-[10px] font-mono text-orange-400 bg-orange-950 px-2 py-0.5 rounded border border-orange-800">
                              +{selOff.stat.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-[10.5px] text-gray-400 italic leading-snug">{offTrack.flavor}</p>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
                            {[
                              { type: 'SPECIALIZATION', branch: offTrack.specialization, icon: '🗡️' },
                              { type: 'PASSIVE', branch: offTrack.passive, icon: '📈' },
                              { type: 'ACTIVE', branch: offTrack.active, icon: '💥' }
                            ].map(({ type, branch, icon }) => {
                              const isPicked = activeOffBranch === type;
                              const r1 = branch.ranks[0];
                              const r4 = branch.ranks[3];
                              return (
                                <button
                                  key={type}
                                  type="button"
                                  onClick={() => handleSelectOffenseBranch(type as any)}
                                  className={`p-2.5 rounded-lg border text-left transition flex flex-col justify-between ${
                                    isPicked
                                      ? 'border-orange-400 bg-orange-900/40 ring-1 ring-orange-400'
                                      : 'border-gray-800 bg-gray-900 hover:border-gray-700'
                                  }`}
                                >
                                  <div>
                                    <div className="flex justify-between items-center">
                                      <span className="text-[11px] font-bold text-white flex items-center gap-1">
                                        <span>{icon}</span> {type}
                                      </span>
                                      <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                                        isPicked ? 'bg-orange-800 text-orange-200' : 'bg-gray-800 text-gray-400'
                                      }`}>
                                        {isPicked ? 'UNLOCKED R1' : 'LOCKED'}
                                      </span>
                                    </div>
                                    <div className="text-xs font-semibold text-orange-300 mt-1">{branch.name}</div>
                                    <p className="text-[10px] text-gray-300 mt-0.5 leading-snug line-clamp-2">{branch.tagline}</p>
                                  </div>
                                  <div className="mt-2 pt-1.5 border-t border-gray-800 text-[9.5px] text-gray-400 font-mono space-y-0.5">
                                    <div><strong className="text-orange-300">R1:</strong> {r1.description}</div>
                                    <div><strong className="text-amber-300">R4 Apex:</strong> {r4.description}</div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* CHOICE 9: DEFENSE COMBAT TRACK & 3-BRANCH SELECTOR */}
                  <div className="space-y-4 pt-2 border-t border-gray-800">
                    <div className="flex justify-between items-center">
                      <div>
                        <label className="text-xs font-black text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                          <span>🛡️</span> Choice 9: Defensive Training (+2 Pts)
                        </label>
                        <p className="text-[11px] text-gray-400">12 Defensive Reactions • Unlocks a defensive tree (+2 stat) with 3 branches scaling Rank 1 to 4</p>
                      </div>
                      <span className="text-[11px] font-mono text-sky-300 bg-sky-950 px-2 py-0.5 rounded border border-sky-800 font-bold">
                        Active: {creationForm.defenseSkill || 'Select Skill'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 max-h-48 overflow-y-auto pr-1">
                      {(optionsData?.defenseSkills || []).map((sk: any) => {
                        const isSelected = creationForm.defenseSkillId === sk.id;
                        return (
                          <button
                            key={sk.id}
                            type="button"
                            onClick={() => handleSelectDefenseSkill(sk.id)}
                            className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                              isSelected
                                ? 'border-sky-500 bg-sky-950/60 shadow-md ring-1 ring-sky-500'
                                : 'border-gray-800 bg-gray-850 hover:bg-gray-800 hover:border-gray-700'
                            }`}
                          >
                            <div>
                              <div className="flex justify-between items-center">
                                <span className="font-bold text-xs text-white">{sk.name}</span>
                                <span className="text-[10px] font-mono text-emerald-400 bg-gray-900 px-1.5 py-0.5 rounded border border-gray-800 font-bold">
                                  +2 {sk.stat?.toUpperCase()}
                                </span>
                              </div>
                              <span className="text-[10px] font-mono text-sky-400 block mt-1">{sk.cost}</span>
                            </div>
                            <p className="text-[10px] text-gray-300 line-clamp-1 mt-0.5 leading-tight">{sk.desc}</p>
                          </button>
                        );
                      })}
                    </div>

                    {/* Interactive 3-Branch Selector for Defensive Track */}
                    {(() => {
                      const selDef = (optionsData?.defenseSkills || []).find((s: any) => s.id === creationForm.defenseSkillId) || optionsData?.defenseSkills?.[0];
                      const defTrack = optionsData?.defensiveSkillTracks?.[selDef?.stat || 'might'];
                      const activeDefBranch = creationForm.defenseBranchChoice || 'SPECIALIZATION';
                      if (!defTrack) return null;
                      return (
                        <div className="bg-gray-950 p-3.5 rounded-xl border border-sky-700/60 space-y-2.5">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-sky-300 uppercase tracking-wide">
                              🛡️ {defTrack.trackName} — Choose Starting Defensive Branch (Unlocks at Rank 1)
                            </span>
                            <span className="text-[10px] font-mono text-sky-400 bg-sky-950 px-2 py-0.5 rounded border border-sky-800">
                              +{selDef.stat.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-[10.5px] text-gray-400 italic leading-snug">{defTrack.flavor}</p>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
                            {[
                              { type: 'SPECIALIZATION', branch: defTrack.specialization, icon: '🛡️' },
                              { type: 'PASSIVE', branch: defTrack.passive, icon: '📈' },
                              { type: 'ACTIVE', branch: defTrack.active, icon: '🔄' }
                            ].map(({ type, branch, icon }) => {
                              const isPicked = activeDefBranch === type;
                              const r1 = branch.ranks[0];
                              const r4 = branch.ranks[3];
                              return (
                                <button
                                  key={type}
                                  type="button"
                                  onClick={() => handleSelectDefenseBranch(type as any)}
                                  className={`p-2.5 rounded-lg border text-left transition flex flex-col justify-between ${
                                    isPicked
                                      ? 'border-sky-400 bg-sky-900/40 ring-1 ring-sky-400'
                                      : 'border-gray-800 bg-gray-900 hover:border-gray-700'
                                  }`}
                                >
                                  <div>
                                    <div className="flex justify-between items-center">
                                      <span className="text-[11px] font-bold text-white flex items-center gap-1">
                                        <span>{icon}</span> {type}
                                      </span>
                                      <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                                        isPicked ? 'bg-sky-800 text-sky-200' : 'bg-gray-800 text-gray-400'
                                      }`}>
                                        {isPicked ? 'UNLOCKED R1' : 'LOCKED'}
                                      </span>
                                    </div>
                                    <div className="text-xs font-semibold text-sky-300 mt-1">{branch.name}</div>
                                    <p className="text-[10px] text-gray-300 mt-0.5 leading-snug line-clamp-2">{branch.tagline}</p>
                                  </div>
                                  <div className="mt-2 pt-1.5 border-t border-gray-800 text-[9.5px] text-gray-400 font-mono space-y-0.5">
                                    <div><strong className="text-sky-300">R1:</strong> {r1.description}</div>
                                    <div><strong className="text-amber-300">R4 Apex:</strong> {r4.description}</div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Navigation Buttons for Step 3 */}
                  <div className="flex justify-between items-center pt-2">
                    <button
                      type="button"
                      onClick={() => setCreationTab('mindDoctrine')}
                      className="px-4 py-2 bg-gray-850 hover:bg-gray-800 text-gray-300 rounded text-xs font-bold transition flex items-center gap-1.5"
                    >
                      <span>⬅</span> Back to Mental Doctrine
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreationTab('review')}
                      className="px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded text-xs font-black tracking-wider uppercase transition flex items-center gap-1.5 shadow"
                    >
                      Next: Arsenal, Difficulty & Review <span>➔</span>
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 4: ARSENAL, DIFFICULTY & COMPLETE REVIEW */}
              {creationTab === 'review' && (
                <div className="space-y-6">
                  {/* Stat Budget Verification Banner (Strict 60 Points) */}
                  {(() => {
                    const totalStats = [...BODY_STAT_KEYS, ...MIND_STAT_KEYS].reduce((sum, k) => sum + (Number(creationForm[k]) || 0), 0);
                    const bodySum = BODY_STAT_KEYS.reduce((sum, k) => sum + (Number(creationForm[k]) || 0), 0);
                    const mindSum = MIND_STAT_KEYS.reduce((sum, k) => sum + (Number(creationForm[k]) || 0), 0);
                    const discSum = totalStats - (bodySum + mindSum);
                    const isValid = totalStats === 60;
                    return (
                      <div className={`p-4 rounded-xl border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 ${
                        isValid
                          ? 'bg-gradient-to-r from-emerald-950/70 via-gray-900 to-amber-950/70 border-emerald-500/70'
                          : 'bg-red-950/50 border-red-500'
                      }`}>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-base font-black text-white">
                              {isValid ? '🛡️ Canon 60-Point Stat Allocation Verified' : '⚠️ Stat Budget Discrepancy'}
                            </span>
                            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-black/60 text-emerald-400 border border-emerald-700">
                              {totalStats} / 60 Total Points
                            </span>
                          </div>
                          <p className="text-xs text-gray-300 mt-1">
                            Exact Canonical Budget: Body (<strong>{bodySum}/27</strong>) + Mind (<strong>{mindSum}/27</strong>) + Disciplines (<strong>{discSum}/6</strong>) = <strong>{totalStats}/60</strong>. Range: 1-12 across all 12 attributes.
                          </p>
                        </div>
                        <div className="flex gap-2 font-mono text-xs">
                          <span className="bg-amber-950 px-2 py-1 rounded border border-amber-800 text-amber-300 font-bold">Body: {bodySum}</span>
                          <span className="bg-blue-950 px-2 py-1 rounded border border-blue-800 text-blue-300 font-bold">Mind: {mindSum}</span>
                          <span className="bg-purple-950 px-2 py-1 rounded border border-purple-800 text-purple-300 font-bold">Skills: {discSum}</span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Campaign Difficulty Selection */}
                  <div className="bg-gray-950 p-4 rounded-xl border border-gray-800 space-y-2.5">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                        <span>⚙️</span> Campaign Difficulty Rules
                      </label>
                      <span className="text-[11px] font-mono text-gray-400">Controls combat stakes and death permanence</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                      {/* Casual */}
                      <button
                        type="button"
                        onClick={() => setCreationForm((prev: any) => ({ ...prev, difficulty: 'casual' }))}
                        className={`p-3 rounded-xl border text-left transition ${
                          creationForm.difficulty === 'casual'
                            ? 'border-emerald-500 bg-emerald-950/40 ring-1 ring-emerald-500 shadow-md'
                            : 'border-gray-800 bg-gray-900 hover:border-gray-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-emerald-400">🟢 Casual</span>
                          <span className="text-[9px] font-mono bg-emerald-950 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-800 font-bold">Forgiving</span>
                        </div>
                        <p className="text-[10px] text-gray-300 mt-1 leading-snug">
                          +3 player combat roll advantage. Halved enemy retaliation damage. Option to recover from defeat (-25 Gold) or reload your last save.
                        </p>
                      </button>

                      {/* Survivor */}
                      <button
                        type="button"
                        onClick={() => setCreationForm((prev: any) => ({ ...prev, difficulty: 'survivor' }))}
                        className={`p-3 rounded-xl border text-left transition ${
                          (creationForm.difficulty || 'survivor') === 'survivor'
                            ? 'border-amber-500 bg-amber-950/40 ring-1 ring-amber-500 shadow-md'
                            : 'border-gray-800 bg-gray-900 hover:border-gray-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-amber-400">🟡 Survivor</span>
                          <span className="text-[9px] font-mono bg-amber-950 text-amber-300 px-1.5 py-0.5 rounded border border-amber-800 font-bold">Standard</span>
                        </div>
                        <p className="text-[10px] text-gray-300 mt-1 leading-snug">
                          Normal rules and opposed combat rolls. Death is final for this attempt—no magical respawn; reload your last saved game to try again.
                        </p>
                      </button>

                      {/* Hardcore */}
                      <button
                        type="button"
                        onClick={() => setCreationForm((prev: any) => ({ ...prev, difficulty: 'hardcore' }))}
                        className={`p-3 rounded-xl border text-left transition ${
                          creationForm.difficulty === 'hardcore'
                            ? 'border-red-600 bg-red-950/50 ring-1 ring-red-500 shadow-md'
                            : 'border-gray-800 bg-gray-900 hover:border-gray-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-red-400">🔴 Hardcore</span>
                          <span className="text-[9px] font-mono bg-red-950 text-red-300 px-1.5 py-0.5 rounded border border-red-800 font-bold">Permadeath</span>
                        </div>
                        <p className="text-[10px] text-gray-300 mt-1 leading-snug">
                          True Permadeath. Defeat wipes all saves for this character. Your saga is etched forever into the Hall of the Fallen memorial archive.
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* Canonical Lineage & Specializations Headline Banner */}
                  <div className="p-4 bg-gradient-to-r from-amber-950/70 via-gray-900 to-indigo-950/70 border border-amber-600/70 rounded-xl space-y-2">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                      <div>
                        <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">Canonical Lineage & Disciplines</span>
                        <div className="text-lg font-black text-white flex items-center gap-2 mt-0.5">
                          <span>🐾 {creationForm.species}</span>
                          <span className="text-gray-500">•</span>
                          <span className="text-amber-300 font-bold uppercase">{creationForm.kingdom || 'Mammalia'}</span>
                          <span className="text-gray-500">•</span>
                          <span className="text-blue-300">{creationForm.institution || 'Aetheria'}</span>
                        </div>
                      </div>
                      <div className="flex gap-1.5 flex-wrap">
                        <span className="text-[10px] font-mono text-purple-300 bg-purple-950 px-2 py-0.5 rounded border border-purple-800">
                          🌌 {creationForm.powerNullTrack} ({creationForm.powerBranchChoice || 'OFFENSE'}) [R1]
                        </span>
                        <span className="text-[10px] font-mono text-orange-300 bg-orange-950 px-2 py-0.5 rounded border border-orange-800">
                          ⚔️ {creationForm.offenseSkill} ({creationForm.offenseBranchChoice || 'SPECIALIZATION'}) [R1]
                        </span>
                        <span className="text-[10px] font-mono text-sky-300 bg-sky-950 px-2 py-0.5 rounded border border-sky-800">
                          🛡️ {creationForm.defenseSkill} ({creationForm.defenseBranchChoice || 'SPECIALIZATION'}) [R1]
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Derived Vitals Overview Bar */}
                  {(() => {
                    const vitals = getDerivedCalculations();
                    return (
                      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2 bg-gray-950 p-3 rounded-xl border border-gray-800 text-center font-mono text-xs">
                        <div className="p-1.5 rounded bg-gray-900 border border-gray-800">
                          <span className="text-[10px] text-gray-400 block">MAX HP</span>
                          <span className="text-emerald-400 font-bold text-sm">❤️ {vitals.hp}</span>
                        </div>
                        <div className="p-1.5 rounded bg-gray-900 border border-gray-800">
                          <span className="text-[10px] text-gray-400 block">COMPOSURE</span>
                          <span className="text-blue-400 font-bold text-sm">🛡️ {vitals.composure}</span>
                        </div>
                        <div className="p-1.5 rounded bg-gray-900 border border-gray-800">
                          <span className="text-[10px] text-amber-400 block">STAMINA</span>
                          <span className="text-amber-400 font-bold text-sm">⚡ {vitals.stamina}</span>
                        </div>
                        <div className="p-1.5 rounded bg-gray-900 border border-gray-800">
                          <span className="text-[10px] text-sky-400 block">FOCUS</span>
                          <span className="text-sky-400 font-bold text-sm">🧠 {vitals.focus}</span>
                        </div>
                        <div className="p-1.5 rounded bg-gray-900 border border-gray-800">
                          <span className="text-[10px] text-teal-400 block">PHYS DEF</span>
                          <span className="text-teal-400 font-bold text-sm">🛡️ {vitals.physDefense}</span>
                        </div>
                        <div className="p-1.5 rounded bg-gray-900 border border-gray-800">
                          <span className="text-[10px] text-purple-400 block">SPEED</span>
                          <span className="text-purple-400 font-bold text-sm">👟 {vitals.speed}</span>
                        </div>
                        <div className="p-1.5 rounded bg-gray-900 border border-gray-800">
                          <span className="text-[10px] text-yellow-400 block">PERCEPTION</span>
                          <span className="text-yellow-400 font-bold text-sm">👁️ {vitals.perception}</span>
                        </div>
                        <div className="p-1.5 rounded bg-gray-900 border border-gray-800">
                          <span className="text-[10px] text-indigo-400 block">MIND DEF</span>
                          <span className="text-indigo-400 font-bold text-sm">🔮 {vitals.mentalDefense}</span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* 12-Stat Final Sheet */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* 6 Body Attributes */}
                    <div className="bg-gray-850 p-4 rounded-xl border border-amber-900/40 space-y-2">
                      <div className="flex justify-between items-center border-b border-gray-800 pb-2">
                        <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">6 Body Attributes (27 Pts Base)</span>
                        <span className="text-[10px] text-gray-400 font-mono">Species: {creationForm.species}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {BODY_STAT_KEYS.map(st => (
                          <div key={st} className="flex items-center justify-between bg-gray-900 px-3 py-2 rounded-lg border border-gray-800">
                            <div>
                              <div className="text-xs font-bold text-gray-200 capitalize">{st}</div>
                              <div className="text-[9px] text-gray-400">{STAT_INFO[st]?.desc}</div>
                            </div>
                            <span className="font-mono font-bold text-amber-300 text-sm">{creationForm[st]}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 6 Mind Attributes */}
                    <div className="bg-gray-850 p-4 rounded-xl border border-blue-900/40 space-y-2">
                      <div className="flex justify-between items-center border-b border-gray-800 pb-2">
                        <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">6 Mind Attributes (27 Pts Base)</span>
                        <span className="text-[10px] text-gray-400 font-mono">Doctrine: {creationForm.institution || 'Scholar'}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {MIND_STAT_KEYS.map(st => (
                          <div key={st} className="flex items-center justify-between bg-gray-900 px-3 py-2 rounded-lg border border-gray-800">
                            <div>
                              <div className="text-xs font-bold text-gray-200 capitalize">{st}</div>
                              <div className="text-[9px] text-gray-400">{STAT_INFO[st]?.desc}</div>
                            </div>
                            <span className="font-mono font-bold text-blue-300 text-sm">{creationForm[st]}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Armory & Loadout Visual Banner */}
                  <div
                    className="rounded-xl overflow-hidden border border-amber-600/40 relative h-24 shadow-md bg-cover bg-center flex items-center"
                    style={{ backgroundImage: 'linear-gradient(to right, rgba(3, 7, 18, 0.9) 30%, rgba(3, 7, 18, 0.45)), url("/gfx/armor.png")' }}
                  >
                    <div className="p-4 z-10 flex flex-col justify-center">
                      <span className="text-[10px] font-mono uppercase text-amber-400 font-bold tracking-wider">Armory & Loadout Spec</span>
                      <h4 className="text-base font-black text-white drop-shadow">Conductor Alloy Armaments</h4>
                      <p className="text-[11px] text-gray-300 drop-shadow">Weapon momentum and armor damage reduction tuned to your primary attributes</p>
                    </div>
                  </div>

                  {/* Starting Weapons & Armor Selectors (12 Stat Groups) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Weapon Selection */}
                    <div className="space-y-2.5">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-bold text-orange-400 uppercase tracking-wider">⚔️ Starting Weapon</label>
                        <span className="text-[11px] font-mono text-amber-300 bg-amber-950 px-2 py-0.5 rounded border border-amber-800 uppercase">
                          {creationForm.weapon_stat} +{creationForm.weapon_mod}
                        </span>
                      </div>

                      <select
                        value={creationForm.equippedWeapon}
                        onChange={e => handleSelectWeapon(e.target.value)}
                        className="w-full bg-gray-850 border border-gray-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-amber-500 font-medium"
                      >
                        {optionsData?.weapons && Object.entries(optionsData.weapons).map(([stat, list]: [string, any]) => (
                          <optgroup key={stat} label={`── ${stat.toUpperCase()} WEAPONS ──`}>
                            {list.map((w: any) => (
                              <option key={w.name} value={w.name}>
                                {w.name} (+{w.mod} {w.stat.toUpperCase()} | Metal: {w.conductorMetal})
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>

                      {(() => {
                        const wpnStatVal = Number(creationForm[creationForm.weapon_stat]) || 1;
                        const isSynergized = wpnStatVal >= 10;
                        const isOffStat = wpnStatVal < 8;
                        return (
                          <div className="flex flex-col gap-1.5">
                            {isSynergized && (
                              <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-300 bg-emerald-950/80 border border-emerald-700 px-2.5 py-1 rounded">
                                <span>⭐</span>
                                <span>HIGH ATTUNEMENT: Synergizes with your {creationForm.weapon_stat?.toUpperCase()} ({wpnStatVal})!</span>
                              </div>
                            )}
                            {isOffStat && (
                              <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-300 bg-amber-950/80 border border-amber-750 px-2.5 py-1 rounded">
                                <span>⚠️</span>
                                <span>OFF-STAT WEAPON: Your {creationForm.weapon_stat?.toUpperCase()} is only {wpnStatVal}. Lower strike accuracy.</span>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      <div className="bg-gray-850 p-3 rounded-xl border border-gray-750 space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-orange-300">{creationForm.equippedWeapon}</span>
                          <span className="text-[11px] text-gray-400 font-mono">Conductor: <strong className="text-amber-300">{creationForm.weapon_metal}</strong></span>
                        </div>
                        <p className="text-[11px] text-gray-300 italic">{creationForm.weapon_desc}</p>
                      </div>
                    </div>

                    {/* Armor Selection */}
                    <div className="space-y-2.5">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-bold text-sky-400 uppercase tracking-wider">🛡️ Starting Armor</label>
                        <span className="text-[11px] font-mono text-sky-300 bg-sky-950 px-2 py-0.5 rounded border border-sky-800 uppercase">
                          {creationForm.armor_stat} +{creationForm.armor_mod} (DR {creationForm.armor_dr})
                        </span>
                      </div>

                      <select
                        value={creationForm.equippedArmor}
                        onChange={e => handleSelectArmor(e.target.value)}
                        className="w-full bg-gray-850 border border-gray-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-sky-500 font-medium"
                      >
                        {optionsData?.armors && Object.entries(optionsData.armors).map(([stat, list]: [string, any]) => (
                          <optgroup key={stat} label={`── ${stat.toUpperCase()} ARMOR ──`}>
                            {list.map((a: any) => (
                              <option key={a.name} value={a.name}>
                                {a.name} (+{a.mod} {a.stat.toUpperCase()} | DR {a.damageReduction} | Metal: {a.conductorMetal})
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>

                      {(() => {
                        const armStatVal = Number(creationForm[creationForm.armor_stat]) || 1;
                        const isSynergized = armStatVal >= 10;
                        const isOffStat = armStatVal < 8;
                        return (
                          <div className="flex flex-col gap-1.5">
                            {isSynergized && (
                              <div className="flex items-center gap-1.5 text-[10px] font-bold text-teal-300 bg-teal-950/80 border border-teal-700 px-2.5 py-1 rounded">
                                <span>⭐</span>
                                <span>HIGH ATTUNEMENT: Synergizes with your {creationForm.armor_stat?.toUpperCase()} ({armStatVal})!</span>
                              </div>
                            )}
                            {isOffStat && (
                              <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-300 bg-amber-950/80 border border-amber-750 px-2.5 py-1 rounded">
                                <span>⚠️</span>
                                <span>OFF-STAT ARMOR: Your {creationForm.armor_stat?.toUpperCase()} is only {armStatVal}.</span>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      <div className="bg-gray-850 p-3 rounded-xl border border-gray-750 space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-sky-300">{creationForm.equippedArmor}</span>
                          <span className="text-[11px] text-gray-400 font-mono">Conductor: <strong className="text-sky-300">{creationForm.armor_metal}</strong></span>
                        </div>
                        <p className="text-[11px] text-gray-300 italic">{creationForm.armor_desc}</p>
                      </div>
                    </div>
                  </div>

                  {/* Mastery Perks Unlocked Tree */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                        Mastery Perks Tree (Levels 3 & 5)
                      </label>
                      <span className="text-[11px] text-gray-400">Unlocked based on your final 12 attributes</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                      {(optionsData?.masteryPerks || []).map((pk: any) => {
                        const currentVal = Number(creationForm[pk.stat]) || 0;
                        const isUnlocked = currentVal >= pk.level;
                        return (
                          <div
                            key={`${pk.stat}_${pk.level}`}
                            className={`p-2.5 rounded-lg border text-xs font-mono transition ${
                              isUnlocked
                                ? 'border-emerald-600 bg-emerald-950/30 text-emerald-200'
                                : 'border-gray-800 bg-gray-900/60 text-gray-500 opacity-60'
                            }`}
                          >
                            <div className="flex justify-between items-center font-bold">
                              <span>{pk.name}</span>
                              <span className="text-[10px] uppercase">
                                {isUnlocked ? '✓ ACTIVE' : `${pk.stat} ${pk.level}`}
                              </span>
                            </div>
                            <p className="text-[10px] text-gray-300 mt-1 line-clamp-2 leading-tight">{pk.desc}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Back Button */}
                  <div className="flex justify-between items-center pt-2">
                    <button
                      type="button"
                      onClick={() => setCreationTab('tracks')}
                      className="px-4 py-2 bg-gray-850 hover:bg-gray-800 text-gray-300 rounded text-xs font-bold transition flex items-center gap-1.5"
                    >
                      <span>⬅</span> Back to Powers & Skills
                    </button>
                    <span className="text-xs text-gray-400 font-mono">Enter your hero's name and embark below ➔</span>
                  </div>
                </div>
              )}

            </div>

            {/* Studio Footer: Hero Name, Summary & Embark */}
            <div className="p-4 border-t border-gray-800 bg-gray-950 flex flex-col md:flex-row justify-between items-center gap-3">
              <div className="flex items-center gap-2 w-full md:w-auto">
                <input
                  type="text"
                  value={creationForm.name}
                  onChange={e => setCreationForm({ ...creationForm, name: e.target.value })}
                  placeholder="Hero Name..."
                  className="bg-gray-900 border border-gray-700 focus:border-amber-500 rounded px-3 py-1.5 text-xs text-white focus:outline-none w-56 font-bold"
                />
                <button
                  type="button"
                  onClick={handleRandomizeName}
                  className="bg-gray-800 hover:bg-gray-750 text-amber-300 border border-gray-700 px-2.5 py-1.5 rounded text-xs font-bold transition flex items-center gap-1"
                  title="Randomize Hero Name"
                >
                  <span>🎲</span>
                </button>
                <div className="text-[11px] text-gray-400 font-mono hidden lg:block">
                  {creationForm.kingdom} • {creationForm.species} • {creationForm.lineage}
                </div>
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setShowCharModal(false)}
                  className="px-4 py-2 bg-gray-850 hover:bg-gray-800 text-gray-400 hover:text-white rounded text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateCharacter}
                  className="px-6 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-gray-950 font-black tracking-wider uppercase rounded-lg shadow-lg hover:shadow-amber-600/30 transition flex items-center gap-2 text-xs"
                >
                  <span>⚔️</span> Embark into Ostraka
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Save Game Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-850 border border-emerald-600/70 rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-gray-700 bg-gray-900 flex justify-between items-center">
              <h2 className="text-base font-bold text-emerald-400 tracking-wider flex items-center gap-2">
                <span>💾</span> SAVE GAME PROGRESS
              </h2>
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                className="text-gray-400 hover:text-white text-base font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-300 uppercase tracking-wider">Save Slot Name</label>
                <input
                  type="text"
                  value={saveSlotName}
                  onChange={e => setSaveSlotName(e.target.value)}
                  placeholder={`Campaign - Sector (${regionalPos.rx}, ${regionalPos.ry})`}
                  className="bg-gray-900 border border-gray-700 focus:border-emerald-500 rounded px-3 py-2 text-sm text-white focus:outline-none"
                />
              </div>

              <div className="bg-gray-900 p-3 rounded border border-gray-750 text-xs font-mono space-y-1.5 text-gray-300">
                <div className="flex justify-between">
                  <span className="text-gray-400">Hero:</span>
                  <span className="text-amber-300 font-bold">{character?.name} (Lv. {character?.level})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Position:</span>
                  <span className="text-blue-300">Sector ({regionalPos.rx}, {regionalPos.ry}) Tile ({localPos.lx}, {localPos.ly})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Health:</span>
                  <span className="text-emerald-400 font-bold">{character?.current_hp}/{character?.max_hp} HP</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Quest:</span>
                  <span className="text-white line-clamp-1">{activeBeat?.title || 'Wilderness Exploration'}</span>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-700 bg-gray-900 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-sm font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveGame}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-sm font-bold transition flex items-center gap-1.5 shadow"
              >
                <span>💾</span> Confirm Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Load Game Modal */}
      {showLoadModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-850 border border-blue-600/70 rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-gray-700 bg-gray-900 flex justify-between items-center">
              <h2 className="text-base font-bold text-blue-400 tracking-wider flex items-center gap-2">
                <span>📂</span> LOAD SAVED GAME
              </h2>
              <button
                type="button"
                onClick={() => setShowLoadModal(false)}
                className="text-gray-400 hover:text-white text-base font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3 flex-1">
              {saveSlots.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm italic">
                  No saved games found. Click &quot;Save&quot; in the HUD to record your journey.
                </div>
              ) : (
                saveSlots.map((slot) => {
                  const wPos = typeof slot.world_pos === 'string' ? JSON.parse(slot.world_pos) : slot.world_pos;
                  return (
                    <div
                      key={slot.id}
                      className="bg-gray-900 hover:bg-gray-850 p-3.5 rounded-lg border border-gray-750 hover:border-blue-500/80 transition flex flex-col md:flex-row justify-between items-start md:items-center gap-3 shadow-md"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-white">{slot.slot_name}</span>
                          <span className="text-[10px] text-gray-400 font-mono">
                            {new Date(slot.updated_at).toLocaleDateString()} {new Date(slot.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="text-xs font-mono text-gray-300 flex flex-wrap gap-x-3 gap-y-0.5">
                          <span>Hero: <strong className="text-amber-300">{slot.player_name || 'Hero'}</strong> (Lv. {slot.player_level || 1})</span>
                          <span>HP: <strong className="text-emerald-400">{slot.player_hp}/{slot.player_max_hp}</strong></span>
                          <span>💰 {slot.player_gold ?? 50}g</span>
                          <span>Sector: <strong className="text-blue-300">({wPos?.rx ?? 105}, {wPos?.ry ?? 112})</strong></span>
                        </div>
                        {slot.quest_title && (
                          <div className="text-[11px] text-gray-400 italic">
                            Quest: <span className="text-amber-200">{slot.quest_title}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 self-end md:self-center">
                        <button
                          type="button"
                          onClick={() => handleLoadGame(slot.id)}
                          className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-bold transition flex items-center gap-1 shadow"
                        >
                          <span>▶️</span> Load
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSave(slot.id)}
                          className="px-2.5 py-1.5 bg-gray-800 hover:bg-red-950 text-gray-400 hover:text-red-400 border border-gray-700 hover:border-red-700 rounded text-xs font-bold transition"
                          title="Delete Save"
                        >
                          <span>🗑️</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-4 border-t border-gray-700 bg-gray-900 flex justify-end">
              <button
                type="button"
                onClick={() => setShowLoadModal(false)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-sm font-semibold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Auto-Save Floating Notification Toast */}
      {autoSaveToast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-950/95 text-emerald-300 border border-emerald-500/80 px-4 py-2.5 rounded-xl text-xs font-mono font-bold shadow-2xl flex items-center gap-2.5 animate-bounce">
          <span className="text-base">💾</span> {autoSaveToast}
        </div>
      )}

      {/* Fallen Hero / Defeat Modal */}
      {showDeathModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4 select-none">
          <div className="bg-gray-950 border-2 border-red-700/80 rounded-2xl w-full max-w-md shadow-[0_0_60px_rgba(220,38,38,0.6)] overflow-hidden text-center p-6 space-y-5">
            <div className="text-5xl animate-bounce">💀</div>
            <div>
              <h2 className="text-2xl font-black text-red-500 tracking-widest uppercase font-serif">
                YOU HAVE FALLEN
              </h2>
              <p className="text-xs text-gray-300 mt-2 leading-relaxed italic">
                Your strength gives out. The mortal wounds are too severe, and darkness claims your sight.
              </p>
              {character?.difficulty === 'casual' && (
                <p className="text-[11px] text-emerald-400/90 mt-1.5 leading-snug">
                  [Casual Mode] You may recover your senses at a field camp or reload an earlier save.
                </p>
              )}
              {(character?.difficulty || 'survivor') === 'survivor' && (
                <p className="text-[11px] text-amber-400/90 mt-1.5 leading-snug">
                  [Survivor Mode] Death is final for this attempt. No field respawn is granted. Reload your last saved game to try again.
                </p>
              )}
              {character?.difficulty === 'hardcore' && (
                <div className="space-y-1">
                  <p className="text-[11px] text-red-400 font-bold mt-1.5 leading-snug">
                    [Hardcore Permadeath] All save files for this character have been deleted. Your deeds are immortalized in the Hall of the Fallen.
                  </p>
                  {hardcoreDeathProcessed && (
                    <span className="inline-block text-[10px] bg-red-950 text-red-300 border border-red-800 px-2.5 py-0.5 rounded font-mono">
                      ✓ Save Archive Purged • Memorial Etched
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="bg-gray-900 border border-red-950/80 p-3.5 rounded-xl text-xs font-mono text-gray-300 space-y-1.5 text-left">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Hero:</span>
                <span className="text-amber-300 font-bold">{character?.name} (Lv. {character?.level || 1})</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Difficulty:</span>
                <span className={`font-bold uppercase ${
                  character?.difficulty === 'casual'
                    ? 'text-emerald-400'
                    : character?.difficulty === 'hardcore'
                    ? 'text-red-400'
                    : 'text-amber-400'
                }`}>
                  {character?.difficulty || 'survivor'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Loadout:</span>
                <span className="text-gray-200 truncate max-w-[220px]">{character?.equipped_weapon || 'Unarmed'} & {character?.equipped_armor || 'Rags'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Purse:</span>
                <span className="text-yellow-400 font-bold">{character?.gold || 0} Gold</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Fallen At:</span>
                <span className="text-blue-300">Sector ({regionalPos.rx}, {regionalPos.ry}) Tile ({localPos.lx}, {localPos.ly})</span>
              </div>
            </div>

            {/* Difficulty-Specific Action Buttons */}
            <div className="flex flex-col gap-2.5 pt-2">
              {character?.difficulty === 'casual' && (
                <>
                  <button
                    type="button"
                    onClick={handleRevivePlayer}
                    className="w-full py-3 px-4 bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-600 hover:to-teal-600 text-white font-black tracking-wider uppercase rounded-lg shadow-lg hover:shadow-emerald-600/30 transition text-xs flex items-center justify-center gap-2"
                  >
                    <span>🕯️</span> Recover & Continue (-25 Gold)
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowDeathModal(false); handleOpenLoadModal(); }}
                    className="w-full py-2.5 px-4 bg-gray-850 hover:bg-gray-800 border border-gray-700 hover:border-gray-500 text-gray-300 hover:text-white font-bold tracking-wider uppercase rounded-lg transition text-xs flex items-center justify-center gap-2"
                  >
                    <span>📂</span> Load Saved Game
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowDeathModal(false); setInStartMenu(true); }}
                    className="w-full py-2 px-4 bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-400 hover:text-gray-200 font-semibold rounded-lg transition text-xs"
                  >
                    Return to Main Menu
                  </button>
                </>
              )}

              {(character?.difficulty || 'survivor') === 'survivor' && (
                <>
                  <button
                    type="button"
                    onClick={() => { setShowDeathModal(false); handleOpenLoadModal(); }}
                    className="w-full py-3 px-4 bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-600 hover:to-indigo-600 text-white font-black tracking-wider uppercase rounded-lg shadow-lg hover:shadow-blue-600/30 transition text-xs flex items-center justify-center gap-2"
                  >
                    <span>📂</span> Load Last Saved Game
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowDeathModal(false); setInStartMenu(true); }}
                    className="w-full py-2.5 px-4 bg-gray-850 hover:bg-gray-800 border border-gray-700 hover:border-gray-500 text-gray-300 hover:text-white font-bold tracking-wider uppercase rounded-lg transition text-xs flex items-center justify-center gap-2"
                  >
                    <span>🏠</span> Return to Main Menu
                  </button>
                </>
              )}

              {character?.difficulty === 'hardcore' && (
                <>
                  <button
                    type="button"
                    onClick={() => { setShowDeathModal(false); handleOpenMemorialsModal(); }}
                    className="w-full py-3 px-4 bg-gradient-to-r from-purple-800 to-red-800 hover:from-purple-700 hover:to-red-700 text-white font-black tracking-wider uppercase rounded-lg shadow-lg hover:shadow-purple-600/30 transition text-xs flex items-center justify-center gap-2"
                  >
                    <span>🏛️</span> View Hall of the Fallen
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowDeathModal(false);
                      setCharacter(null);
                      handleRollCharacter();
                      setShowCharModal(true);
                    }}
                    className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-gray-950 font-black tracking-wider uppercase rounded-lg transition text-xs flex items-center justify-center gap-2"
                  >
                    <span>✨</span> Forge New Hero
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowDeathModal(false); setCharacter(null); setInStartMenu(true); }}
                    className="w-full py-2 px-4 bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-400 hover:text-gray-200 font-semibold rounded-lg transition text-xs"
                  >
                    Return to Main Menu
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Hall of the Fallen / Memorial Archive Modal */}
      {showMemorialModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4 select-none">
          <div className="bg-gray-950 border-2 border-purple-800/80 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-[0_0_80px_rgba(147,51,234,0.3)] overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-gray-800 bg-gray-900 flex justify-between items-center">
              <div>
                <h2 className="text-base md:text-lg font-black text-purple-400 tracking-wider flex items-center gap-2 uppercase">
                  <span>🏛️</span> HALL OF THE FALLEN — MEMORIAL ARCHIVE
                </h2>
                <p className="text-xs text-gray-400">Eternal records of heroes fallen under Hardcore Permadeath rules</p>
              </div>
              <button
                type="button"
                onClick={() => setShowMemorialModal(false)}
                className="text-gray-400 hover:text-white text-base font-bold p-1 rounded hover:bg-gray-800 transition"
              >
                ✕
              </button>
            </div>

            {/* Memorials List */}
            <div className="p-5 overflow-y-auto space-y-3 flex-1 text-gray-200">
              {memorialList.length === 0 ? (
                <div className="p-12 text-center text-gray-400 space-y-2">
                  <div className="text-4xl">🕯️</div>
                  <div className="text-sm font-semibold text-gray-300">No Heroes Have Fallen</div>
                  <p className="text-xs text-gray-500 max-w-md mx-auto">
                    The memorial tablets stand clean and unetched. Those who braved Hardcore mode either still wander the wilds or have yet to meet defeat.
                  </p>
                </div>
              ) : (
                memorialList.map((m: any) => (
                  <div
                    key={m.id}
                    className="bg-gray-900 p-4 rounded-xl border border-purple-900/50 hover:border-purple-700/80 transition space-y-2 shadow-lg"
                  >
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1.5 border-b border-gray-800 pb-2">
                      <div className="flex items-center gap-2.5">
                        <span className="text-lg">💀</span>
                        <div>
                          <span className="text-sm font-black text-amber-300">{m.player_name}</span>
                          <span className="text-xs text-gray-400 font-mono ml-2">Lv. {m.level || 1}</span>
                        </div>
                        <span className="text-[10px] bg-red-950 text-red-300 border border-red-800 px-2 py-0.5 rounded font-mono uppercase font-bold">
                          {m.difficulty || 'hardcore'}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-400 font-mono">
                        {new Date(m.fallen_at).toLocaleDateString()} {new Date(m.fallen_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono text-gray-300">
                      <div>
                        <span className="text-gray-400 block text-[10px]">LINEAGE & SPECIES</span>
                        <span className="text-purple-300">{m.kingdom} • {m.species} ({m.lineage})</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block text-[10px]">EQUIPMENT</span>
                        <span className="text-gray-200 truncate block">{m.equipped_weapon} / {m.equipped_armor}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block text-[10px]">FINAL POSITION & PURSE</span>
                        <span className="text-blue-300">Sector ({m.sector_x}, {m.sector_y}) • 💰 {m.gold}g</span>
                      </div>
                    </div>

                    <div className="pt-1.5 text-xs italic text-gray-400 flex items-center gap-1.5">
                      <span className="text-red-400 font-bold not-italic">Cause of Death:</span>
                      <span>{m.cause_of_death}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-800 bg-gray-900 flex justify-end">
              <button
                type="button"
                onClick={() => setShowMemorialModal(false)}
                className="px-5 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-xs font-bold transition"
              >
                Close Archive
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3-BRANCH x 4-RANK SKILL & POWER PROGRESSION MODAL */}
      {showSkillsModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
          <div className="bg-gray-900 border border-gray-700 w-full max-w-5xl max-h-[92vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-4 border-b border-gray-800 bg-gray-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-amber-400 tracking-wide">
                    ⚡ 3-Branch × 4-Rank Skill & Power Progression
                  </h3>
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-emerald-950 border border-emerald-700 text-emerald-300 font-bold">
                    Lv. {character?.level || 1}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  Unlock branches at Rank 1, advance to Rank 4 Mastery. Every rank strictly scales passive traits, reduces resource costs, or eliminates disadvantage.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-gray-900 border border-amber-600/60 px-3 py-1.5 rounded-xl font-mono text-xs">
                  <span className="text-gray-400">Skill Points:</span>
                  <span className="text-amber-400 font-black text-sm">
                    {character?.skill_points || 0}
                  </span>
                </div>

                <button
                  type="button"
                  disabled={levelUpSubmitting}
                  onClick={() => handleInvestSkillRank(undefined, true)}
                  className="px-2.5 py-1.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1 shadow-sm"
                  title="Cheat/Test: Gain 1 free level and 1 skill point for instant testing"
                >
                  <span>✨</span> +1 Test Point
                </button>

                <button
                  type="button"
                  onClick={() => setShowSkillsModal(false)}
                  className="p-1.5 text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-750 rounded-lg transition"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="px-4 py-2 border-b border-gray-800 bg-gray-900 flex gap-2">
              <button
                type="button"
                onClick={() => setSkillsModalTab('active')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  skillsModalTab === 'active'
                    ? 'bg-amber-600 text-black shadow'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                }`}
              >
                <span>🎯</span> My Active Disciplines
              </button>
              <button
                type="button"
                onClick={() => setSkillsModalTab('combat')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  skillsModalTab === 'combat'
                    ? 'bg-amber-600 text-black shadow'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                }`}
              >
                <span>⚔️</span> All 24 Combat Tracks
              </button>
              <button
                type="button"
                onClick={() => setSkillsModalTab('reality')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  skillsModalTab === 'reality'
                    ? 'bg-amber-600 text-black shadow'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                }`}
              >
                <span>🌌</span> All 24 Reality Trees
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {(() => {
                const renderBranchCard = (branch: any) => {
                  if (!branch) return null;
                  const curRank = Number(character?.skill_ranks?.[branch.id]) || 0;
                  return (
                    <div key={branch.id} className="bg-gray-850 p-3.5 rounded-xl border border-gray-750 flex flex-col justify-between space-y-3">
                      <div>
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <span className="text-[10px] font-mono uppercase font-bold px-1.5 py-0.5 rounded bg-gray-900 border border-gray-700 text-amber-400">
                              {branch.branchType || branch.branchRole || 'BRANCH'}
                            </span>
                            <h4 className="font-bold text-sm text-white mt-1">{branch.name}</h4>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-xs font-mono font-bold text-emerald-400">
                              {curRank === 0 ? 'Locked' : `Rank ${curRank}/4`}
                            </span>
                            <div className="flex gap-1">
                              {[1, 2, 3, 4].map(r => (
                                <div
                                  key={r}
                                  className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-mono font-bold ${
                                    curRank >= r
                                      ? 'bg-emerald-500 text-black shadow-sm'
                                      : 'bg-gray-800 text-gray-500 border border-gray-700'
                                  }`}
                                >
                                  {r}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                        <p className="text-[11px] text-gray-400 italic mt-1 leading-snug">{branch.tagline}</p>

                        {/* 4 Ranks Progression */}
                        <div className="mt-2.5 space-y-1.5">
                          {(branch.ranks || []).map((rk: any) => {
                            const isCurrent = curRank === rk.rank;
                            const isNext = curRank + 1 === rk.rank;
                            return (
                              <div
                                key={rk.rank}
                                className={`p-2 rounded-lg border text-xs transition ${
                                  isCurrent
                                    ? 'border-emerald-500/80 bg-emerald-950/40 text-emerald-200'
                                    : isNext
                                    ? 'border-amber-600/60 bg-amber-950/20 text-gray-200'
                                    : 'border-gray-800 bg-gray-900/60 text-gray-400'
                                }`}
                              >
                                <div className="flex justify-between items-center font-semibold text-[11px]">
                                  <span className={isCurrent ? 'text-emerald-300 font-bold' : isNext ? 'text-amber-300 font-bold' : 'text-gray-300'}>
                                    {rk.title}
                                  </span>
                                  {isCurrent && <span className="text-[9px] font-mono text-emerald-400 uppercase font-bold">● Active</span>}
                                  {isNext && <span className="text-[9px] font-mono text-amber-400 uppercase font-bold">○ Next</span>}
                                </div>
                                <p className="text-[10.5px] mt-0.5 leading-snug text-gray-300">{rk.description}</p>
                                {rk.addedEffect && (
                                  <div className="mt-1 text-[9.5px] font-mono text-purple-300 bg-purple-950/60 px-1.5 py-0.5 rounded border border-purple-800/50 inline-block">
                                    ★ {rk.addedEffect}
                                  </div>
                                )}
                                {(rk.cost || rk.range || rk.aoe) && (
                                  <div className="flex gap-2 text-[9px] font-mono text-gray-400 mt-1">
                                    {rk.cost && <span>Cost: {rk.cost}</span>}
                                    {rk.range && <span>Range: {rk.range}</span>}
                                    {rk.aoe && <span>AoE: {rk.aoe}</span>}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Upgrade / Unlock CTA */}
                      <div className="pt-2 border-t border-gray-800">
                        {curRank < 4 ? (
                          <button
                            type="button"
                            disabled={levelUpSubmitting || (character?.skill_points || 0) <= 0}
                            onClick={() => handleInvestSkillRank(branch.id)}
                            className={`w-full py-2 px-3 rounded-lg font-mono text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md ${
                              (character?.skill_points || 0) > 0
                                ? 'bg-amber-600 hover:bg-amber-500 text-black'
                                : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-750'
                            }`}
                          >
                            {(character?.skill_points || 0) > 0 ? (
                              <>
                                <span>⚡</span>
                                <span>{curRank === 0 ? 'Unlock at Rank 1 (-1 Pt)' : `Advance to Rank ${curRank + 1} (-1 Pt)`}</span>
                              </>
                            ) : (
                              <span>Requires 1 Skill Point (Level Up)</span>
                            )}
                          </button>
                        ) : (
                          <div className="w-full py-1.5 bg-emerald-950 text-emerald-400 font-bold font-mono text-xs rounded-lg border border-emerald-800 text-center shadow-sm">
                            ★ Fully Mastered (Rank 4)
                          </div>
                        )}
                      </div>
                    </div>
                  );
                };

                if (skillsModalTab === 'active') {
                  const activeOffSkill = (optionsData?.offenseSkills || []).find((s: any) => s.name === character?.offense_skill || s.id === character?.offense_skill) || optionsData?.offenseSkills?.[0];
                  const offStat = activeOffSkill?.stat || character?.weapon_stat || 'might';
                  const activeOffTrack = optionsData?.offensiveSkillTracks?.[offStat];

                  const activeDefSkill = (optionsData?.defenseSkills || []).find((s: any) => s.name === character?.defense_skill || s.id === character?.defense_skill) || optionsData?.defenseSkills?.[0];
                  const defStat = activeDefSkill?.stat || character?.armor_stat || 'might';
                  const activeDefTrack = optionsData?.defensiveSkillTracks?.[defStat];

                  const activePowerTrack = (optionsData?.powerNullTracks || []).find((t: any) => t.name === character?.power_null_track || t.id === character?.power_null_track) || optionsData?.powerNullTracks?.[0];
                  const isNullTree = (activePowerTrack?.mode === 'NULL') || (character?.power_null_track && character.power_null_track.toLowerCase().includes('null'));
                  const pwrStat = activePowerTrack?.stat || 'might';
                  const activeRealityTree = isNullTree
                    ? optionsData?.realityNullTrees?.[pwrStat]
                    : optionsData?.realityPowerTrees?.[pwrStat];

                  return (
                    <div className="space-y-6">
                      {/* Section 1: Active Offensive Combat Track */}
                      {activeOffTrack && (
                        <div className="bg-gray-950 p-4 rounded-xl border border-amber-900/60 space-y-3">
                          <div className="flex justify-between items-center border-b border-gray-800 pb-2">
                            <div>
                              <span className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                                <span>⚔️</span> Offensive Combat Track: {activeOffTrack.trackName}
                              </span>
                              <p className="text-[11px] text-gray-400 italic mt-0.5">{activeOffTrack.flavor}</p>
                            </div>
                            <span className="text-xs font-mono text-amber-300 bg-amber-950 px-2 py-0.5 rounded border border-amber-800 font-bold uppercase">
                              +{offStat}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {renderBranchCard(activeOffTrack.specialization)}
                            {renderBranchCard(activeOffTrack.passive)}
                            {renderBranchCard(activeOffTrack.active)}
                          </div>
                        </div>
                      )}

                      {/* Section 2: Active Defensive Combat Track */}
                      {activeDefTrack && (
                        <div className="bg-gray-950 p-4 rounded-xl border border-sky-900/60 space-y-3">
                          <div className="flex justify-between items-center border-b border-gray-800 pb-2">
                            <div>
                              <span className="text-xs font-black text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                                <span>🛡️</span> Defensive Combat Track: {activeDefTrack.trackName}
                              </span>
                              <p className="text-[11px] text-gray-400 italic mt-0.5">{activeDefTrack.flavor}</p>
                            </div>
                            <span className="text-xs font-mono text-sky-300 bg-sky-950 px-2 py-0.5 rounded border border-sky-800 font-bold uppercase">
                              +{defStat}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {renderBranchCard(activeDefTrack.specialization)}
                            {renderBranchCard(activeDefTrack.passive)}
                            {renderBranchCard(activeDefTrack.active)}
                          </div>
                        </div>
                      )}

                      {/* Section 3: Active Reality Constant Tree */}
                      {activeRealityTree && (
                        <div className="bg-gray-950 p-4 rounded-xl border border-purple-900/60 space-y-3">
                          <div className="flex justify-between items-center border-b border-gray-800 pb-2">
                            <div>
                              <span className="text-xs font-black text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                                <span>🌌</span> {activeRealityTree.mode === 'NULL' ? 'Null Reality Discipline' : 'Reality Power Tree'}: {activeRealityTree.treeName}
                              </span>
                              <p className="text-[11px] text-gray-400 italic mt-0.5">{activeRealityTree.philosophicalCore}</p>
                            </div>
                            <span className="text-xs font-mono text-purple-300 bg-purple-950 px-2 py-0.5 rounded border border-purple-800 font-bold uppercase">
                              +{pwrStat}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {renderBranchCard(activeRealityTree.offense)}
                            {renderBranchCard(activeRealityTree.defense)}
                            {renderBranchCard(activeRealityTree.utility)}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }

                if (skillsModalTab === 'combat') {
                  const allStats = [...BODY_STAT_KEYS, ...MIND_STAT_KEYS];
                  const selOffTrack = optionsData?.offensiveSkillTracks?.[skillsSelectedStat];
                  const selDefTrack = optionsData?.defensiveSkillTracks?.[skillsSelectedStat];

                  return (
                    <div className="space-y-4">
                      {/* Stat Selector Pills */}
                      <div className="flex flex-wrap gap-1.5 p-2 bg-gray-950 rounded-xl border border-gray-800">
                        {allStats.map(st => (
                          <button
                            key={st}
                            type="button"
                            onClick={() => setSkillsSelectedStat(st)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-mono capitalize transition ${
                              skillsSelectedStat === st
                                ? 'bg-amber-600 text-black font-black shadow'
                                : 'bg-gray-900 text-gray-400 hover:text-white border border-gray-800'
                            }`}
                          >
                            {st}
                          </button>
                        ))}
                      </div>

                      {/* Offensive Track for Selected Stat */}
                      {selOffTrack && (
                        <div className="bg-gray-950 p-4 rounded-xl border border-amber-900/60 space-y-3">
                          <div className="flex justify-between items-center border-b border-gray-800 pb-2">
                            <div>
                              <span className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                                <span>⚔️</span> Offensive Track: {selOffTrack.trackName}
                              </span>
                              <p className="text-[11px] text-gray-400 italic mt-0.5">{selOffTrack.flavor}</p>
                            </div>
                            <span className="text-xs font-mono text-amber-300 bg-amber-950 px-2 py-0.5 rounded border border-amber-800 font-bold uppercase">
                              +{skillsSelectedStat}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {renderBranchCard(selOffTrack.specialization)}
                            {renderBranchCard(selOffTrack.passive)}
                            {renderBranchCard(selOffTrack.active)}
                          </div>
                        </div>
                      )}

                      {/* Defensive Track for Selected Stat */}
                      {selDefTrack && (
                        <div className="bg-gray-950 p-4 rounded-xl border border-sky-900/60 space-y-3">
                          <div className="flex justify-between items-center border-b border-gray-800 pb-2">
                            <div>
                              <span className="text-xs font-black text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                                <span>🛡️</span> Defensive Track: {selDefTrack.trackName}
                              </span>
                              <p className="text-[11px] text-gray-400 italic mt-0.5">{selDefTrack.flavor}</p>
                            </div>
                            <span className="text-xs font-mono text-sky-300 bg-sky-950 px-2 py-0.5 rounded border border-sky-800 font-bold uppercase">
                              +{skillsSelectedStat}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {renderBranchCard(selDefTrack.specialization)}
                            {renderBranchCard(selDefTrack.passive)}
                            {renderBranchCard(selDefTrack.active)}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }

                if (skillsModalTab === 'reality') {
                  const allStats = [...BODY_STAT_KEYS, ...MIND_STAT_KEYS];
                  const selTree = skillsRealityMode === 'POWER'
                    ? optionsData?.realityPowerTrees?.[skillsSelectedStat]
                    : optionsData?.realityNullTrees?.[skillsSelectedStat];

                  return (
                    <div className="space-y-4">
                      {/* Mode Toggle: Power vs Null */}
                      <div className="flex items-center justify-between p-2.5 bg-gray-950 rounded-xl border border-gray-800">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setSkillsRealityMode('POWER')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                              skillsRealityMode === 'POWER'
                                ? 'bg-purple-600 text-white shadow'
                                : 'text-gray-400 hover:text-white bg-gray-900 border border-gray-800'
                            }`}
                          >
                            <span>⚡</span> Reality Powers (External Spells)
                          </button>
                          <button
                            type="button"
                            onClick={() => setSkillsRealityMode('NULL')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                              skillsRealityMode === 'NULL'
                                ? 'bg-indigo-600 text-white shadow'
                                : 'text-gray-400 hover:text-white bg-gray-900 border border-gray-800'
                            }`}
                          >
                            <span>🛡️</span> Null Abilities (Inertia & Ignorance)
                          </button>
                        </div>
                        <span className="text-[11px] font-mono text-gray-400">
                          {skillsRealityMode === 'POWER' ? 'Manipulates constant directly' : 'Completely ignores constant'}
                        </span>
                      </div>

                      {/* Stat Selector Pills */}
                      <div className="flex flex-wrap gap-1.5 p-2 bg-gray-950 rounded-xl border border-gray-800">
                        {allStats.map(st => (
                          <button
                            key={st}
                            type="button"
                            onClick={() => setSkillsSelectedStat(st)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-mono capitalize transition ${
                              skillsSelectedStat === st
                                ? 'bg-purple-600 text-white font-black shadow'
                                : 'bg-gray-900 text-gray-400 hover:text-white border border-gray-800'
                            }`}
                          >
                            {st}
                          </button>
                        ))}
                      </div>

                      {/* Reality Constant Tree */}
                      {selTree && (
                        <div className="bg-gray-950 p-4 rounded-xl border border-purple-900/60 space-y-3">
                          <div className="flex justify-between items-center border-b border-gray-800 pb-2">
                            <div>
                              <span className="text-xs font-black text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                                <span>🌌</span> {selTree.treeName} ({selTree.constantName})
                              </span>
                              <p className="text-[11px] text-gray-400 italic mt-0.5">{selTree.philosophicalCore}</p>
                            </div>
                            <span className="text-xs font-mono text-purple-300 bg-purple-950 px-2 py-0.5 rounded border border-purple-800 font-bold uppercase">
                              +{skillsSelectedStat}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {renderBranchCard(selTree.offense)}
                            {renderBranchCard(selTree.defense)}
                            {renderBranchCard(selTree.utility)}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }

                return null;
              })()}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-gray-800 bg-gray-950 flex justify-between items-center text-xs font-mono text-gray-400">
              <span>Points invest immediately. Max Rank 4 per branch.</span>
              <button
                type="button"
                onClick={() => setShowSkillsModal(false)}
                className="px-4 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-bold transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
