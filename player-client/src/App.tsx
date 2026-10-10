import React, { useState, useEffect, useRef } from 'react';
import './index.css';
import { generateLevel3Map } from './utils/Level3Generator';

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

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastEncounterId = useRef<string | null>(null);

  // Game Save & Character Creation Modals
  const [inStartMenu, setInStartMenu] = useState(true);
  const [showCharModal, setShowCharModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);

  const [creationTab, setCreationTab] = useState<'species' | 'bodySplits' | 'mindSplits' | 'tracks' | 'review'>('species');
  const [optionsData, setOptionsData] = useState<any>(null);

  const BODY_STAT_KEYS: string[] = ['might', 'endurance', 'finesse', 'reflex', 'vitality', 'fortitude'];
  const MIND_STAT_KEYS: string[] = ['knowledge', 'logic', 'awareness', 'intuition', 'charm', 'willpower'];

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
    if (!opts?.kingdoms) return form;
    const kBase = opts.kingdoms[form.kingdom] || opts.kingdoms.Mammal || {};
    const lineageList = opts.lineages?.[form.kingdom] || [];
    const lin = lineageList.find((l: any) => l.name === form.lineage) || lineageList[0];
    const inst = opts.institutions?.find((i: any) => i.name === form.institution) || opts.institutions?.[0];

    const stats: any = {};
    [...BODY_STAT_KEYS, ...MIND_STAT_KEYS].forEach(s => {
      stats[s] = Number(kBase[s]) || 1;
    });

    if (lin) {
      stats[lin.plus] = (stats[lin.plus] || 1) + 1;
      stats[lin.minus] = Math.max(1, (stats[lin.minus] || 1) - 1);
    }
    if (inst) {
      stats[inst.stat] = (stats[inst.stat] || 1) + 1;
    }

    // Body Splits (+7, +4, +6, +3, +5, +2)
    if (form.body7) stats[form.body7] = (stats[form.body7] || 0) + 7;
    if (form.body4) stats[form.body4] = (stats[form.body4] || 0) + 4;
    if (form.body6) stats[form.body6] = (stats[form.body6] || 0) + 6;
    if (form.body3) stats[form.body3] = (stats[form.body3] || 0) + 3;
    if (form.body5) stats[form.body5] = (stats[form.body5] || 0) + 5;
    if (form.body2) stats[form.body2] = (stats[form.body2] || 0) + 2;

    // Mind Splits (+7, +4, +6, +3, +5, +2)
    if (form.mind7) stats[form.mind7] = (stats[form.mind7] || 0) + 7;
    if (form.mind4) stats[form.mind4] = (stats[form.mind4] || 0) + 4;
    if (form.mind6) stats[form.mind6] = (stats[form.mind6] || 0) + 6;
    if (form.mind3) stats[form.mind3] = (stats[form.mind3] || 0) + 3;
    if (form.mind5) stats[form.mind5] = (stats[form.mind5] || 0) + 5;
    if (form.mind2) stats[form.mind2] = (stats[form.mind2] || 0) + 2;

    // Track (+2)
    const track = (opts.powerNullTracks || []).find((t: any) => t.id === form.trackId);
    if (track) stats[track.stat] = (stats[track.stat] || 0) + (track.bonus || 2);

    // Offense Skill (+2)
    const offSkill = (opts.offenseSkills || []).find((s: any) => s.id === form.offenseSkillId);
    if (offSkill) stats[offSkill.stat] = (stats[offSkill.stat] || 0) + (offSkill.bonus || 2);

    // Defense Skill (+2)
    const defSkill = (opts.defenseSkills || []).find((s: any) => s.id === form.defenseSkillId);
    if (defSkill) stats[defSkill.stat] = (stats[defSkill.stat] || 0) + (defSkill.bonus || 2);

    // Dynamic Archetype designations
    const mainType = opts.mainTypes?.[form.body7]?.name || 'Titan';
    const subType = opts.subTypes?.[form.mind7]?.name || 'Arcanist';
    const finalType = opts.finalTypes?.[form.body6]?.name || 'Sentinel';

    // Unlocked perks
    const activePerks = (opts.masteryPerks || []).filter((p: any) => (stats[p.stat] || 0) >= p.level);

    return {
      ...form,
      ...stats,
      species: lin ? lin.speciesType : form.species,
      mainType,
      subType,
      finalType,
      powerNullTrack: track ? track.name : form.powerNullTrack,
      offenseSkill: offSkill ? offSkill.name : form.offenseSkill,
      defenseSkill: defSkill ? defSkill.name : form.defenseSkill,
      passiveTraits: [
        lin ? { name: lin.traitName, desc: lin.traitDesc } : null,
        track ? { name: `Track: ${track.powerName}`, desc: `${track.powerDesc} / Null: ${track.nullDesc}` } : null,
        inst ? { name: `Brand of ${inst.name}`, desc: inst.descriptor } : null
      ].filter(Boolean),
      skills: [
        offSkill ? { id: offSkill.id, name: offSkill.name, cost: offSkill.cost, desc: offSkill.desc } : null,
        defSkill ? { id: defSkill.id, name: defSkill.name, cost: defSkill.cost, desc: defSkill.desc } : null
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
    body7: 'might',
    body4: 'endurance',
    body6: 'fortitude',
    body3: 'vitality',
    body5: 'finesse',
    body2: 'reflex',
    mind7: 'knowledge',
    mind4: 'logic',
    mind6: 'awareness',
    mind3: 'intuition',
    mind5: 'charm',
    mind2: 'willpower',
    mainType: 'Titan',
    subType: 'Arcanist',
    finalType: 'Sentinel',
    trackId: 'track_might',
    powerNullTrack: 'Mass Track',
    offenseSkillId: 'off_might',
    offenseSkill: 'Shatter Impact',
    defenseSkillId: 'def_might',
    defenseSkill: 'Brace Impact',
    might: 18,
    endurance: 11,
    finesse: 7,
    reflex: 5,
    vitality: 9,
    fortitude: 10,
    knowledge: 11,
    logic: 6,
    awareness: 11,
    intuition: 7,
    charm: 11,
    willpower: 6,
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
      { id: 'off_might', name: 'Shatter Impact', cost: '2 Stamina', desc: 'Devastating overhead crushing strike that fractures defender armor DR.' },
      { id: 'def_might', name: 'Brace Impact', cost: '1 Stamina', desc: 'Anchor footing with brute brawn to halve incoming physical shock damage.' }
    ],
    masteryPerks: []
  });

  const [saveSlots, setSaveSlots] = useState<any[]>([]);
  const [saveSlotName, setSaveSlotName] = useState('');

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
          mainType: data.mainType,
          subType: data.subType,
          finalType: data.finalType,
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

  const handleSelectKingdom = (k: string) => {
    if (!optionsData?.kingdoms || !optionsData?.lineages) return;
    const lineageList = optionsData.lineages[k] || [];
    const firstLineage = lineageList[0];
    setCreationForm((prev: any) => {
      const updated = {
        ...prev,
        kingdom: k,
        lineage: firstLineage ? firstLineage.name : prev.lineage,
        species: firstLineage ? firstLineage.speciesType : prev.species
      };
      return recalculateForm(updated, optionsData);
    });
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

  const handleSelectInstitution = (instName: string) => {
    if (!optionsData?.institutions) return;
    setCreationForm((prev: any) => {
      const updated = { ...prev, institution: instName };
      return recalculateForm(updated, optionsData);
    });
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

  const handleSelectTrack = (trackId: string) => {
    setCreationForm((prev: any) => {
      const updated = { ...prev, trackId };
      return recalculateForm(updated, optionsData);
    });
  };

  const handleSelectOffenseSkill = (offenseSkillId: string) => {
    setCreationForm((prev: any) => {
      const updated = { ...prev, offenseSkillId };
      return recalculateForm(updated, optionsData);
    });
  };

  const handleSelectDefenseSkill = (defenseSkillId: string) => {
    setCreationForm((prev: any) => {
      const updated = { ...prev, defenseSkillId };
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

  const handleContinue = async () => {
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

  // Fetch character stats & options
  useEffect(() => {
    fetch('http://localhost:3000/api/dm/player')
      .then(r => r.json())
      .then(data => setCharacter(data))
      .catch(() => {});

    fetch('http://localhost:3000/api/dm/character/options')
      .then(r => r.json())
      .then(data => setOptionsData(data))
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
        if (!showCharModal && !showSaveModal && !showLoadModal) {
          setInStartMenu(prev => !prev);
          return;
        }
      }

      if (inStartMenu) return;
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
        setRegionalPos({ rx: nr_x, ry: nr_y });
        setLocalPos({ lx: nx, ly: ny });
        fetchSectorState(nr_x, nr_y);
      } else if (nx !== localPos.lx || ny !== localPos.ly) {
        setLocalPos({ lx: nx, ly: ny });

        // Check proximity to Injected NPCs (within 3 tiles)
        const nearbyNPC = injectedNPCs.find(n => n.alive && Math.hypot(n.pos[0] - nx, n.pos[1] - ny) <= 3);
        const nearbyProp = injectedProps.find(p => !p.isDestroyed && Math.hypot(p.pos[0] - nx, p.pos[1] - ny) <= 2);

        const target = nearbyNPC || nearbyProp;
        if (target) {
          setEncounterTarget(target);
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

  // Render Canvas
  useEffect(() => {
    if (!canvasRef.current || !tilemap || !manifest) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);

    const half = Math.floor(VIEWPORT_SIZE / 2);

    for (let dy = -half; dy <= half; dy++) {
      for (let dx = -half; dx <= half; dx++) {
        const tx = localPos.lx + dx;
        const ty = localPos.ly + dy;

        const screenX = (dx + half) * TILE_SIZE;
        const screenY = (dy + half) * TILE_SIZE;

        if (tx < 0 || tx >= tilemap.size || ty < 0 || ty >= tilemap.size) {
          ctx.fillStyle = '#111827';
          ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
          continue;
        }

        const tile = tilemap.grid[ty * tilemap.size + tx];
        const biomeId = manifest.global_context.biome_id;

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

        const palette = biomePalettes[biomeId] || ['#4ade80', '#166534'];

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

    // 1. Render Injected Props
    injectedProps.forEach(prop => {
      if (prop.isDestroyed) return;
      const screenX = (prop.pos[0] - localPos.lx + half) * TILE_SIZE;
      const screenY = (prop.pos[1] - localPos.ly + half) * TILE_SIZE;

      if (screenX >= 0 && screenX < canvasRef.current!.width && screenY >= 0 && screenY < canvasRef.current!.height) {
        // Draw Prop Box / Icon
        const tags = Array.isArray(prop.tags) ? prop.tags : [];
        ctx.fillStyle = tags.includes('fire') || tags.includes('burning')
          ? '#ea580c'
          : tags.includes('magic')
          ? '#9333ea'
          : tags.includes('metal')
          ? '#64748b'
          : '#78350f';

        ctx.fillRect(screenX + 2, screenY + 2, TILE_SIZE - 4, TILE_SIZE - 4);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#fde047';
        ctx.strokeRect(screenX + 2, screenY + 2, TILE_SIZE - 4, TILE_SIZE - 4);

        // Prop Label
        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(prop.name.split(' ')[0], screenX + TILE_SIZE / 2, screenY - 2);
      }
    });

    // 2. Render Injected NPCs
    injectedNPCs.forEach(npc => {
      if (!npc.alive) return;
      const screenX = (npc.pos[0] - localPos.lx + half) * TILE_SIZE;
      const screenY = (npc.pos[1] - localPos.ly + half) * TILE_SIZE;

      if (screenX >= 0 && screenX < canvasRef.current!.width && screenY >= 0 && screenY < canvasRef.current!.height) {
        ctx.fillStyle = npc.disposition < 0 ? '#ef4444' : npc.disposition > 0 ? '#22c55e' : '#3b82f6';
        ctx.beginPath();
        ctx.arc(screenX + TILE_SIZE / 2, screenY + TILE_SIZE / 2, TILE_SIZE / 2 - 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(npc.name.split(' ')[0], screenX + TILE_SIZE / 2, screenY - 3);
      }
    });

    // 3. Draw Player Token at exact viewport center
    const px = half * TILE_SIZE;
    const py = half * TILE_SIZE;
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(px + TILE_SIZE / 2, py + TILE_SIZE / 2, TILE_SIZE / 2 - 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#fff';
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('YOU', px + TILE_SIZE / 2, py - 4);
  }, [localPos, tilemap, manifest, injectedProps, injectedNPCs]);

  // Execute Action through Concordia Game Master loop
  const triggerAction = async (actionText: string) => {
    if (!actionText.trim() || isActing) return;
    setIsActing(true);
    setMessages(prev => [...prev, { sender: 'You', text: actionText, type: 'player' }]);
    setChatInput('');

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
      }
      if (data.dialogue) {
        setMessages(prev => [...prev, { sender: data.intent?.targetName || 'Dialogue', text: data.dialogue, type: 'dialogue' }]);
      }
      if (data.narrativeResponse) {
        setMessages(prev => [...prev, { sender: 'GM', text: data.narrativeResponse, type: 'narrative' }]);
      }
      if (data.lootAwarded) {
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
        .then(p => { if (p && p.id) setCharacter(p); })
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
                CONCORDIA ACTIVE
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
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-300 text-sm tracking-wide">{character.name}</span>
                  <span className="text-xs font-mono text-gray-400">HP: {character.current_hp}/{character.max_hp}</span>
                </div>

                {/* Animal Species & Cosmic Brand Badge */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800 px-2 py-0.5 rounded-full uppercase">
                    🐾 {character.species || character.lineage || 'Hero'}
                  </span>
                  <span className="text-[10px] text-gray-400 font-mono">
                    {character.kingdom || 'Mammal'} • {character.institution || 'Mass'}
                  </span>
                </div>

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
                        Narrative Pivot Branch:
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
              </>
            )}

            {/* GPS & Radar */}
            <div className="bg-gray-900 p-2.5 rounded border border-gray-700/60 text-xs font-mono space-y-1 text-gray-400">
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
          </div>
        </div>

        {/* Center Pane: Tactical View */}
        <div className="flex-1 bg-black flex flex-col items-center justify-center relative overflow-hidden">
          {/* Header Bar */}
          <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/90 via-black/60 to-transparent z-10 flex justify-between items-center">
            <div>
              <h1 className="text-lg font-bold text-white tracking-widest flex items-center gap-2">
                <span>TACTICAL BATTLEGRID</span>
                {encounterTarget && (
                  <span className="text-xs bg-red-950 text-red-400 border border-red-700 px-2 py-0.5 rounded font-mono animate-pulse">
                    IN RANGE: {encounterTarget.name}
                  </span>
                )}
              </h1>
              <p className="text-xs text-gray-400">WASD to walk. Touch map edges to cross sub-sectors.</p>
            </div>

            <div className="flex gap-2 text-xs font-mono">
              {objDist !== null && (
                <div className="bg-amber-950/80 border border-amber-600/80 px-2.5 py-1 rounded text-amber-300 flex items-center gap-1.5 shadow">
                  <span>🎯</span>
                  <span>Objective: <strong className="text-white">{objDist}m</strong> away</span>
                </div>
              )}
              <div className="bg-gray-900/80 border border-gray-700 px-3 py-1 rounded text-gray-300">
                🧭 Center: {distToCenter}m {compassDir}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="text-amber-500 animate-pulse text-lg tracking-widest">TRANSLATING GLOBAL MATRIX...</div>
          ) : (
            <div className="shadow-2xl border-4 border-gray-800 rounded relative">
              <canvas
                ref={canvasRef}
                width={VIEWPORT_SIZE * TILE_SIZE}
                height={VIEWPORT_SIZE * TILE_SIZE}
                className="bg-black block"
              />
            </div>
          )}
        </div>

        {/* Right Pane: DM Story Engine & Action Controls */}
        <div className="w-[420px] bg-gray-800 border-l border-gray-700 flex flex-col">
          <div className="p-3 border-b border-gray-700 flex justify-between items-center bg-gray-850">
            <h2 className="text-base font-bold text-blue-400 flex items-center gap-2">
              <span>CONCORDIA CHRONICLE</span>
            </h2>
            <span className="text-[10px] bg-blue-950 text-blue-300 px-2 py-0.5 rounded border border-blue-800 font-mono">
              ECGM ENGINE
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
        <div className="fixed inset-0 z-40 bg-gradient-to-b from-gray-950 via-gray-900 to-black flex flex-col items-center justify-center p-6 select-none">
          {/* Subtle Ambient Radial Glow */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-900/20 via-transparent to-transparent pointer-events-none" />

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
                onClick={() => setInStartMenu(false)}
                className="w-full py-2.5 px-6 bg-gray-900/60 hover:bg-gray-800/80 border border-gray-800 hover:border-gray-600 text-gray-400 hover:text-gray-200 font-medium tracking-wider uppercase rounded-lg transition flex items-center justify-center gap-2 text-xs"
              >
                <span>🗺️</span> Jump into Sector Map
              </button>
            </div>

            {/* System Details Footer */}
            <div className="pt-4 border-t border-gray-800/80 w-full flex justify-between items-center text-[10px] text-gray-500 font-mono">
              <span>12-STAT ATTUNEMENT</span>
              <span>CONCORDIA AI GM</span>
              <span>POSTGRES READY</span>
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

            {/* Studio Navigation Tabs */}
            <div className="flex border-b border-gray-800 bg-gray-950/80 px-4 gap-2 overflow-x-auto text-xs font-bold">
              {[
                { id: 'species', label: '1. Animal Ancestry', icon: '🐾' },
                { id: 'bodySplits', label: '2. Body Splits & Archetype', icon: '⚡' },
                { id: 'mindSplits', label: '3. Mind Splits & Sub-Type', icon: '🧠' },
                { id: 'tracks', label: '4. Track & Combat Skills', icon: '🌌' },
                { id: 'review', label: '5. Arsenal & Review', icon: '⚔️' }
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
              {/* TAB 1: SPECIES & LINEAGE */}
              {creationTab === 'species' && (
                <div className="space-y-6">
                  {/* Animal Kingdom Selection */}
                  <div>
                    <div className="flex justify-between items-center mb-2.5">
                      <label className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                        Step 1: Choose Animal Kingdom
                      </label>
                      <span className="text-[11px] text-gray-400">Sets biological attribute matrix baseline</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
                      {[
                        { id: 'Mammal', icon: '🐻', label: 'Mammal', focus: 'Vitality & Endurance' },
                        { id: 'Reptile', icon: '🦎', label: 'Reptile', focus: 'Intuition & Endurance' },
                        { id: 'Avian', icon: '🦅', label: 'Avian', focus: 'Reflex & Knowledge' },
                        { id: 'Aquatic', icon: '🐋', label: 'Aquatic', focus: 'Finesse & Awareness' },
                        { id: 'Insect', icon: '🦗', label: 'Insect', focus: 'Might & Logic' },
                        { id: 'Plant', icon: '🌿', label: 'Plant', focus: 'Fortitude & Willpower' }
                      ].map(k => (
                        <button
                          key={k.id}
                          type="button"
                          onClick={() => handleSelectKingdom(k.id)}
                          className={`p-3 rounded-xl border flex flex-col items-center text-center transition ${
                            creationForm.kingdom === k.id
                              ? 'border-amber-500 bg-amber-950/40 shadow-lg shadow-amber-950/30'
                              : 'border-gray-800 bg-gray-850 hover:bg-gray-800 hover:border-gray-700'
                          }`}
                        >
                          <span className="text-2xl mb-1">{k.icon}</span>
                          <span className="text-xs font-bold text-white">{k.label}</span>
                          <span className="text-[9px] text-gray-400 line-clamp-1 mt-0.5">{k.focus}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Lineage / Animal Species Selection */}
                  <div>
                    <div className="flex justify-between items-center mb-2.5">
                      <label className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                        Step 2: Choose Animal Lineage ({creationForm.kingdom})
                      </label>
                      <span className="text-[11px] text-gray-400">72 Lineages • Grants unique Species Passive Trait</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-72 overflow-y-auto pr-1">
                      {((optionsData?.lineages?.[creationForm.kingdom]) || []).map((lin: any) => {
                        const isSelected = creationForm.lineage === lin.name;
                        return (
                          <button
                            key={lin.name}
                            type="button"
                            onClick={() => handleSelectLineage(lin.name)}
                            className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                              isSelected
                                ? 'border-amber-500 bg-amber-950/40 shadow-md'
                                : 'border-gray-800 bg-gray-850 hover:bg-gray-800 hover:border-gray-700'
                            }`}
                          >
                            <div>
                              <div className="flex justify-between items-start">
                                <span className="font-bold text-xs text-white">{lin.name}</span>
                                <span className="text-[10px] font-mono text-amber-300 bg-amber-950 px-1.5 py-0.5 rounded border border-amber-800">
                                  {lin.speciesType}
                                </span>
                              </div>
                              <div className="text-[11px] text-emerald-400 font-mono mt-1">
                                +1 {lin.plus.toUpperCase()} • <span className="text-red-400">-1 {lin.minus.toUpperCase()}</span>
                              </div>
                            </div>
                            <div className="mt-2 pt-2 border-t border-gray-800/80">
                              <span className="text-[10px] font-bold text-amber-300 block">✨ {lin.traitName}</span>
                              <p className="text-[10px] text-gray-400 line-clamp-2 leading-tight">{lin.traitDesc}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Cosmic Institution / Brand */}
                  <div>
                    <div className="flex justify-between items-center mb-2.5">
                      <label className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                        Step 3: Cosmic Institution / Brand
                      </label>
                      <span className="text-[11px] text-gray-400">+1 Attribute Attunement</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {(optionsData?.institutions || []).map((inst: any) => {
                        const isSelected = creationForm.institution === inst.name;
                        return (
                          <button
                            key={inst.name}
                            type="button"
                            onClick={() => handleSelectInstitution(inst.name)}
                            className={`p-2.5 rounded-lg border text-left transition ${
                              isSelected
                                ? 'border-amber-500 bg-amber-950/40'
                                : 'border-gray-800 bg-gray-850 hover:bg-gray-800 hover:border-gray-700'
                            }`}
                          >
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-xs text-white">{inst.name}</span>
                              <span className="text-[9px] font-mono text-amber-400 uppercase">+{inst.stat}</span>
                            </div>
                            <div className="text-[10px] text-gray-400 italic line-clamp-1 mt-0.5">{inst.descriptor}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Biological Baseline Preview */}
                  <div className="bg-gray-950 p-4 rounded-xl border border-gray-800 space-y-2">
                    <div className="flex justify-between items-center text-xs font-bold text-amber-400 uppercase tracking-wider">
                      <span>Species Biological Baseline (Before Splits)</span>
                      <span className="text-[10px] text-gray-400 font-mono">{creationForm.kingdom} • {creationForm.species} ({creationForm.lineage})</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                      {[...BODY_STAT_KEYS, ...MIND_STAT_KEYS].map(st => {
                        const kBase = Number(optionsData?.kingdoms?.[creationForm.kingdom]?.[st]) || 1;
                        const lin = (optionsData?.lineages?.[creationForm.kingdom] || []).find((l: any) => l.name === creationForm.lineage);
                        const inst = (optionsData?.institutions || []).find((i: any) => i.name === creationForm.institution);
                        let baseVal = kBase;
                        if (lin?.plus === st) baseVal += 1;
                        if (lin?.minus === st) baseVal = Math.max(1, baseVal - 1);
                        if (inst?.stat === st) baseVal += 1;
                        return (
                          <div key={st} className="bg-gray-900 p-2 rounded-lg border border-gray-800 text-center font-mono">
                            <span className="text-[10px] text-gray-400 uppercase block">{st}</span>
                            <span className="text-sm font-bold text-amber-300">{baseVal}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Bottom Navigation for Step 1 */}
                  <div className="flex justify-between items-center pt-2">
                    <button
                      type="button"
                      onClick={() => handleRollCharacter(creationForm.kingdom, creationForm.lineage, creationForm.institution)}
                      className="text-xs bg-gray-800 hover:bg-gray-750 text-amber-300 border border-gray-700 hover:border-amber-500 px-3 py-2 rounded transition font-bold flex items-center gap-1.5 shadow"
                    >
                      <span>🎲</span> Randomize Species & Traits
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreationTab('bodySplits')}
                      className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-gray-950 rounded text-xs font-black tracking-wider uppercase transition flex items-center gap-1.5 shadow"
                    >
                      Next: Body Splits & Archetype <span>➔</span>
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: 12 ATTRIBUTES & POINT ALLOCATION */}
              {creationTab === 'stats' && (
                <div className="space-y-5">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider">Manual 12-Attribute Allocation</h3>
                      <p className="text-[11px] text-gray-400">Freely customize your 6 Body and 6 Mind stats (Scale 1 to 8)</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRollCharacter(creationForm.kingdom, creationForm.lineage, creationForm.institution)}
                      className="text-xs bg-gray-800 hover:bg-gray-750 text-amber-300 border border-gray-700 hover:border-amber-500 px-3 py-1.5 rounded transition font-bold flex items-center gap-1.5 shadow"
                    >
                      <span>🔄</span> Reset to Species Base
                    </button>
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
                          <span className="text-[10px] text-gray-400 block">STAMINA</span>
                          <span className="text-amber-400 font-bold text-sm">⚡ {vitals.stamina}</span>
                        </div>
                        <div className="p-1.5 rounded bg-gray-900 border border-gray-800">
                          <span className="text-[10px] text-gray-400 block">FOCUS</span>
                          <span className="text-sky-400 font-bold text-sm">🧠 {vitals.focus}</span>
                        </div>
                        <div className="p-1.5 rounded bg-gray-900 border border-gray-800">
                          <span className="text-[10px] text-gray-400 block">PHYS DEF</span>
                          <span className="text-teal-400 font-bold text-sm">🛡️ {vitals.physDefense}</span>
                        </div>
                        <div className="p-1.5 rounded bg-gray-900 border border-gray-800">
                          <span className="text-[10px] text-gray-400 block">SPEED</span>
                          <span className="text-purple-400 font-bold text-sm">👟 {vitals.speed}</span>
                        </div>
                        <div className="p-1.5 rounded bg-gray-900 border border-gray-800">
                          <span className="text-[10px] text-gray-400 block">PERCEPTION</span>
                          <span className="text-yellow-400 font-bold text-sm">👁️ {vitals.perception}</span>
                        </div>
                        <div className="p-1.5 rounded bg-gray-900 border border-gray-800">
                          <span className="text-[10px] text-gray-400 block">MENT DEF</span>
                          <span className="text-indigo-400 font-bold text-sm">🔮 {vitals.mentalDefense}</span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* 12 Stat Adjustment Sliders/Buttons */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* 6 Body Attributes */}
                    <div className="bg-gray-850 p-4 rounded-xl border border-amber-900/40 space-y-3">
                      <div className="flex justify-between items-center border-b border-gray-800 pb-2">
                        <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">6 Body Attributes</span>
                        <span className="text-[10px] text-gray-400">Physical Mastery</span>
                      </div>
                      <div className="space-y-2">
                        {[
                          { key: 'might', label: 'Might', desc: 'Heavy blows & brute lifting' },
                          { key: 'endurance', label: 'Endurance', desc: 'Stamina reserves & fatigue resistance' },
                          { key: 'finesse', label: 'Finesse', desc: 'Precision strikes & delicate dexterity' },
                          { key: 'reflex', label: 'Reflex', desc: 'Dodge speed & reaction timing' },
                          { key: 'vitality', label: 'Vitality', desc: 'Health pool & cellular recovery' },
                          { key: 'fortitude', label: 'Fortitude', desc: 'Bone density & blunt damage mitigation' }
                        ].map(st => (
                          <div key={st.key} className="flex items-center justify-between bg-gray-900 px-3 py-2 rounded-lg border border-gray-800">
                            <div>
                              <div className="text-xs font-bold text-gray-200">{st.label}</div>
                              <div className="text-[10px] text-gray-400">{st.desc}</div>
                            </div>
                            <div className="flex items-center gap-2.5">
                              <button
                                type="button"
                                onClick={() => handleStatChange(st.key, -1)}
                                disabled={creationForm[st.key] <= 1}
                                className="w-7 h-7 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-30 text-gray-200 font-bold flex items-center justify-center transition"
                              >
                                -
                              </button>
                              <span className="w-6 text-center font-mono font-bold text-amber-300 text-sm">
                                {creationForm[st.key]}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleStatChange(st.key, 1)}
                                disabled={creationForm[st.key] >= 8}
                                className="w-7 h-7 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-30 text-amber-300 font-bold flex items-center justify-center transition"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 6 Mind Attributes */}
                    <div className="bg-gray-850 p-4 rounded-xl border border-blue-900/40 space-y-3">
                      <div className="flex justify-between items-center border-b border-gray-800 pb-2">
                        <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">6 Mind Attributes</span>
                        <span className="text-[10px] text-gray-400">Cognitive & Metaphysical</span>
                      </div>
                      <div className="space-y-2">
                        {[
                          { key: 'knowledge', label: 'Knowledge', desc: 'Arcane lore & historical recall' },
                          { key: 'logic', label: 'Logic', desc: 'Tactical deduction & mechanism analysis' },
                          { key: 'awareness', label: 'Awareness', desc: 'Perception, tracking & ambush warning' },
                          { key: 'intuition', label: 'Intuition', desc: 'Gut instinct & initiative reflexes' },
                          { key: 'charm', label: 'Charm', desc: 'Persuasion, leadership & social leverage' },
                          { key: 'willpower', label: 'Willpower', desc: 'Sanity, psychic defense & pain tolerance' }
                        ].map(st => (
                          <div key={st.key} className="flex items-center justify-between bg-gray-900 px-3 py-2 rounded-lg border border-gray-800">
                            <div>
                              <div className="text-xs font-bold text-gray-200">{st.label}</div>
                              <div className="text-[10px] text-gray-400">{st.desc}</div>
                            </div>
                            <div className="flex items-center gap-2.5">
                              <button
                                type="button"
                                onClick={() => handleStatChange(st.key, -1)}
                                disabled={creationForm[st.key] <= 1}
                                className="w-7 h-7 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-30 text-gray-200 font-bold flex items-center justify-center transition"
                              >
                                -
                              </button>
                              <span className="w-6 text-center font-mono font-bold text-blue-300 text-sm">
                                {creationForm[st.key]}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleStatChange(st.key, 1)}
                                disabled={creationForm[st.key] >= 8}
                                className="w-7 h-7 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-30 text-blue-300 font-bold flex items-center justify-center transition"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: WEAPONS & ARMOR ARSENAL */}
              {creationTab === 'equipment' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider">Arsenal Selection</h3>
                    <p className="text-[11px] text-gray-400">Choose your weapon and armor from any of the 12 stat attunement groups</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Weapon Selection */}
                    <div className="space-y-3">
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

                      {/* Selected Weapon Detail Card */}
                      <div className="bg-gray-850 p-4 rounded-xl border border-gray-750 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-bold text-orange-300">{creationForm.equippedWeapon}</span>
                          <span className="text-xs text-gray-400 font-mono">Conductor: <strong className="text-amber-300">{creationForm.weapon_metal}</strong></span>
                        </div>
                        <p className="text-xs text-gray-300 italic">{creationForm.weapon_desc}</p>
                        <div className="flex gap-1.5 flex-wrap pt-1">
                          {(creationForm.weapon_tags || []).map((t: string) => (
                            <span key={t} className="text-[9px] font-mono bg-gray-900 text-gray-400 px-1.5 py-0.5 rounded border border-gray-800">
                              #{t}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Armor Selection */}
                    <div className="space-y-3">
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

                      {/* Selected Armor Detail Card */}
                      <div className="bg-gray-850 p-4 rounded-xl border border-gray-750 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-bold text-sky-300">{creationForm.equippedArmor}</span>
                          <span className="text-xs text-gray-400 font-mono">Conductor: <strong className="text-sky-300">{creationForm.armor_metal}</strong></span>
                        </div>
                        <p className="text-xs text-gray-300 italic">{creationForm.armor_desc}</p>
                        <div className="flex gap-1.5 flex-wrap pt-1">
                          {(creationForm.armor_tags || []).map((t: string) => (
                            <span key={t} className="text-[9px] font-mono bg-gray-900 text-gray-400 px-1.5 py-0.5 rounded border border-gray-800">
                              #{t}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: SKILLS & MASTERY TREES */}
              {creationTab === 'skills' && (
                <div className="space-y-6">
                  {/* Active Abilities Picker */}
                  <div>
                    <div className="flex justify-between items-center mb-2.5">
                      <label className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                        Active Combat Abilities (Select up to 3)
                      </label>
                      <span className="text-[11px] text-gray-400 font-mono">
                        Selected: {(creationForm.skills || []).length}/3
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                      {(optionsData?.skills || []).map((sk: any) => {
                        const isSelected = (creationForm.skills || []).some((s: any) => s.id === sk.id);
                        return (
                          <button
                            key={sk.id}
                            type="button"
                            onClick={() => handleToggleSkill(sk.id)}
                            className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                              isSelected
                                ? 'border-amber-500 bg-amber-950/40 shadow'
                                : 'border-gray-800 bg-gray-850 hover:bg-gray-800'
                            }`}
                          >
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-bold text-xs text-white flex items-center gap-1.5">
                                <span>{sk.icon}</span> {sk.name}
                              </span>
                              <span className="text-[10px] font-mono text-amber-400 bg-gray-900 px-1.5 py-0.5 rounded border border-gray-750">
                                {sk.cost}
                              </span>
                            </div>
                            <p className="text-[10px] text-gray-300 leading-tight">{sk.desc}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Mastery Perks Tree (Levels 3 & 5) */}
                  <div>
                    <div className="flex justify-between items-center mb-2.5">
                      <label className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                        Mastery Perks Tree (Levels 3 & 5)
                      </label>
                      <span className="text-[11px] text-gray-400">Automatically unlocked as attributes reach 3 and 5</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-60 overflow-y-auto pr-1">
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
    </div>
  );
}

export default App;
