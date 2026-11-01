import React, { useState } from 'react';
import { BODY_STAT_KEYS, MIND_STAT_KEYS } from '../../types';
import { KINGDOM_PROFILES, KINGDOM_PORTRAITS, getAnimalSpriteCoords } from '../../utils/SpriteHelper';

interface CharacterCreationModalProps {
  showCharModal: boolean;
  optionsData: any;
  onClose: () => void;
  onCreateSuccess: (char: any) => void;
}

export const CharacterCreationModal: React.FC<CharacterCreationModalProps> = ({
  showCharModal,
  optionsData,
  onClose,
  onCreateSuccess,
}) => {
  const [creationTab, setCreationTab] = useState<'bodyHeritage' | 'mindDoctrine' | 'tracks' | 'attunements' | 'review'>('bodyHeritage');
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

  const handleFinishCreation = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/dm/character/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(creationForm)
      });
      if (res.ok) {
        const data = await res.json();
        onCreateSuccess(data.character);
        onClose();
      }
    } catch (err) {
      console.error('Character creation error:', err);
    }
  };

  if (!showCharModal) return null;

  return (
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
                onClick={() => onClose()}
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
                  onClick={() => onClose()}
                  className="px-4 py-2 bg-gray-850 hover:bg-gray-800 text-gray-400 hover:text-white rounded text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleFinishCreation}
                  className="px-6 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-gray-950 font-black tracking-wider uppercase rounded-lg shadow-lg hover:shadow-amber-600/30 transition flex items-center gap-2 text-xs"
                >
                  <span>⚔️</span> Embark into Ostraka
                </button>
              </div>
            </div>
          </div>
        </div>
  );
};
