const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '..', 'player-client', 'src', 'App.tsx');
let content = fs.readFileSync(appPath, 'utf8');

console.log('Original App.tsx length:', content.length);

// -------------------------------------------------------------
// 1. ADD NEW CONSTANTS & STATE AT TOP OF APP()
// -------------------------------------------------------------

const stateAnchor = `  const [showLoadModal, setShowLoadModal] = useState(false);`;
const stateAddition = `  const [showLoadModal, setShowLoadModal] = useState(false);
  const [showDeathModal, setShowDeathModal] = useState(false);
  const [autoSaveToast, setAutoSaveToast] = useState<string | null>(null);`;

if (!content.includes('showDeathModal')) {
  content = content.replace(stateAnchor, stateAddition);
  console.log('Added showDeathModal and autoSaveToast states');
}

// -------------------------------------------------------------
// 2. ADD KINGDOM_PROFILES & QUICK_PRESETS RIGHT ABOVE STAT_INFO
// -------------------------------------------------------------

const statInfoAnchor = `  const STAT_INFO: Record<string, { label: string; icon: string; desc: string }> = {`;

const profilesAndPresets = `  const KINGDOM_PROFILES: Record<string, {
    summary: string;
    biology: string;
    strengths: string[];
    weaknesses: string[];
    vibe: string;
  }> = {
    Mammal: {
      summary: 'Warm-blooded, enduring, and bound by pack loyalty. Built for prolonged overland survival and visceral vitality.',
      biology: 'Endothermic metabolism with thick subcutaneous adipose insulation and dense musculature.',
      strengths: ['High Vitality (6)', 'Endurance (5)', 'Charm (6)'],
      weaknesses: ['Lower Finesse (2)', 'Lower Logic (2)'],
      vibe: 'Natural frontline guardians, resilient commanders, and colossal survivors.'
    },
    Reptile: {
      summary: 'Cold-blooded apex stalkers with sun-baked scutes and premonitory thermal awareness.',
      biology: 'Ectothermic efficiency requiring little food, protected by interlocking keratin plates and infra-red sensory pits.',
      strengths: ['High Endurance (6)', 'Fortitude (5)', 'Intuition (6)'],
      weaknesses: ['Lower Vitality (2)', 'Lower Willpower (2)'],
      vibe: 'Patient ambushers, adamantine sentinels, and premonitory seers.'
    },
    Avian: {
      summary: 'Feathered sovereigns of the thermals. Hollow-boned speed, keen manuscripts, and devastating dives.',
      biology: 'Pneumatized skeleton with high-efficiency flow-through lungs and hyper-acute optical resolving power.',
      strengths: ['High Reflex (6)', 'Knowledge (6)', 'Might (5)'],
      weaknesses: ['Lower Endurance (2)', 'Lower Intuition (2)'],
      vibe: 'Acrobatic duelists, scholars of forbidden lore, and lethal skirmishers.'
    },
    Aquatic: {
      summary: 'Fluid predators of the deep trenches. Hydrodynamic streamline with unmatched agility and sensory depth.',
      biology: 'Hydrophobic skin with electroreceptive lateral lines, allowing total situational awareness in liquid darkness.',
      strengths: ['High Finesse (6)', 'Awareness (6)', 'Reflex (5)'],
      weaknesses: ['Lower Might (2)', 'Lower Knowledge (2)'],
      vibe: 'Surgical assassins, evasive shadow-walkers, and acute aquatic trackers.'
    },
    Insect: {
      summary: 'Chitinous marvels of hydraulic mechanical strength and collective geometric coordination.',
      biology: 'Exoskeletal leverage multiplying physical load capacity ten-fold with compound optic telemetry.',
      strengths: ['Colossal Might (6)', 'Logic (6)', 'Vitality (5)'],
      weaknesses: ['Lower Fortitude (2)', 'Lower Charm (2)'],
      vibe: 'Relentless shock-troopers, calculation savants, and hive specialists.'
    },
    Plant: {
      summary: 'Photosynthetic ancients anchored in bedrock. Indomitable wooden flesh and unyielding psychic fortitude.',
      biology: 'Silica-dense hardwood bark and deep mycelial mycorrhizae granting immunity to panic and physical disruption.',
      strengths: ['Supreme Fortitude (6)', 'Willpower (6)', 'Finesse (5)'],
      weaknesses: ['Lower Reflex (2)', 'Lower Awareness (2)'],
      vibe: 'Unmovable bulwarks, mystical anchorites, and venomous bramble-weavers.'
    }
  };

  const QUICK_PRESETS = [
    {
      name: 'Juggernaut',
      icon: '🛡️',
      tagline: 'Titan • Tank',
      desc: 'Colossal bear-warrior clad in heavy Osmium plate, crushing armor with raw mass.',
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
      trackId: 'track_might',
      offenseSkillId: 'off_might',
      defenseSkillId: 'def_might',
      equippedWeapon: 'Osmium Greatsword',
      equippedArmor: 'Juggernaut Osmium Plate'
    },
    {
      name: 'Skirmisher',
      icon: '🗡️',
      tagline: 'Duelist • Agility',
      desc: 'Swift venomous duelist delivering surgical piercing strikes with high reflex and evasion.',
      kingdom: 'Reptile',
      lineage: 'Pit-Vipers',
      species: 'Viper-Folk',
      institution: 'Flux',
      body7: 'finesse',
      body4: 'reflex',
      body6: 'vitality',
      body3: 'fortitude',
      body5: 'might',
      body2: 'endurance',
      mind7: 'intuition',
      mind4: 'awareness',
      mind6: 'knowledge',
      mind3: 'logic',
      mind5: 'charm',
      mind2: 'willpower',
      trackId: 'track_finesse',
      offenseSkillId: 'off_finesse',
      defenseSkillId: 'def_finesse',
      equippedWeapon: 'Obsidian Rapier',
      equippedArmor: 'Scaled Viper Cuirass'
    },
    {
      name: 'Arcanist',
      icon: '🔮',
      tagline: 'Scholar • Mystic',
      desc: 'Strigid owl sage manipulating forbidden manuscripts, null wards, and arcane energy.',
      kingdom: 'Avian',
      lineage: 'Owls',
      species: 'Strigid-Folk',
      institution: 'Anumis',
      body7: 'reflex',
      body4: 'vitality',
      body6: 'might',
      body3: 'fortitude',
      body5: 'finesse',
      body2: 'endurance',
      mind7: 'knowledge',
      mind4: 'logic',
      mind6: 'intuition',
      mind3: 'awareness',
      mind5: 'willpower',
      mind2: 'charm',
      trackId: 'track_knowledge',
      offenseSkillId: 'off_knowledge',
      defenseSkillId: 'def_knowledge',
      equippedWeapon: 'Blackstone Stave',
      equippedArmor: 'Aetheric Silk Mantle'
    },
    {
      name: 'Stalker',
      icon: '🏹',
      tagline: 'Ranger • Scout',
      desc: 'Keen canine tracker wielding composite bows, sensing hazards from across the sector.',
      kingdom: 'Mammal',
      lineage: 'Canid-Kin',
      species: 'Wolf-Folk',
      institution: 'Lux',
      body7: 'reflex',
      body4: 'finesse',
      body6: 'endurance',
      body3: 'might',
      body5: 'vitality',
      body2: 'fortitude',
      mind7: 'awareness',
      mind4: 'intuition',
      mind6: 'logic',
      mind3: 'knowledge',
      mind5: 'willpower',
      mind2: 'charm',
      trackId: 'track_awareness',
      offenseSkillId: 'off_awareness',
      defenseSkillId: 'def_awareness',
      equippedWeapon: 'Composite Recurve Bow',
      equippedArmor: 'Hardened Leather Cuirass'
    }
  ];

`;

if (!content.includes('KINGDOM_PROFILES')) {
  content = content.replace(statInfoAnchor, profilesAndPresets + statInfoAnchor);
  console.log('Added KINGDOM_PROFILES and QUICK_PRESETS');
}

// -------------------------------------------------------------
// 3. ADD PRESET APPLIER FUNCTION, AUTOSAVE FUNCTION & REVIVE FUNCTION
// -------------------------------------------------------------

const handleContinueAnchor = `  const handleContinue = async () => {`;

const newUtilityFunctions = `  const applyPreset = (preset: any) => {
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
          slotName: \`\${slotLabel} - (\${regionalPos.rx}, \${regionalPos.ry})\`,
          characterData: character,
          worldPos: { cellId: CELL_ID, rx: regionalPos.rx, ry: regionalPos.ry, lx: localPos.lx, ly: localPos.ly },
          storyState: { campaignState, activeBeat }
        })
      });
      if (res.ok) {
        setAutoSaveToast(\`💾 Auto-Saved: Sector (\${regionalPos.rx}, \${regionalPos.ry})\`);
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
            text: \`🕯️ REVIVED: You awaken gasping for air near the embers of a traveler's campfire at sector center (128, 128). Your wounds have been bandaged to \${data.restoredHp || 10} HP. Scavengers claimed \${data.goldLost || 0} gold while you lay senseless.\`,
            type: 'narrative'
          }
        ]);
        triggerAutoSave('AutoSave - Post Revive');
      }
    } catch (err: any) {
      alert(\`Revive failed: \${err.message}\`);
    }
  };

`;

if (!content.includes('applyPreset')) {
  content = content.replace(handleContinueAnchor, newUtilityFunctions + handleContinueAnchor);
  console.log('Added applyPreset, triggerAutoSave, and handleRevivePlayer');
}

// -------------------------------------------------------------
// 4. AUTO-SAVE ON BORDER TRANSITION & ACTION RESULTS
// -------------------------------------------------------------

const changedRegionAnchor = `      if (changedRegion) {
        setRegionalPos({ rx: nr_x, ry: nr_y });
        setLocalPos({ lx: nx, ly: ny });
        fetchSectorState(nr_x, nr_y);`;

const changedRegionReplace = `      if (changedRegion) {
        setRegionalPos({ rx: nr_x, ry: nr_y });
        setLocalPos({ lx: nx, ly: ny });
        fetchSectorState(nr_x, nr_y);
        triggerAutoSave('AutoSave - Regional Border');`;

if (content.includes(changedRegionAnchor)) {
  content = content.replace(changedRegionAnchor, changedRegionReplace);
  console.log('Added auto-save on regional border crossing');
}

// Check death on player sheet refresh in triggerAction
const playerRefreshAnchor = `      // Refresh player character sheet from DB
      fetch('http://localhost:3000/api/dm/player')
        .then(r => r.json())
        .then(p => { if (p && p.id) setCharacter(p); })
        .catch(() => {});`;

const playerRefreshReplace = `      // Refresh player character sheet from DB
      fetch('http://localhost:3000/api/dm/player')
        .then(r => r.json())
        .then(p => {
          if (p && p.id) {
            setCharacter(p);
            if (Number(p.current_hp) <= 0) {
              setShowDeathModal(true);
            }
          }
        })
        .catch(() => {});`;

if (content.includes(playerRefreshAnchor)) {
  content = content.replace(playerRefreshAnchor, playerRefreshReplace);
  console.log('Added death check on player refresh');
}

// Auto-save on quest objective completion
const beatCompleteAnchor = `      if (data.objectiveProgress?.beatCompleted) {
        setMessages(prev => [
          ...prev,
          {
            sender: 'Story Director',
            text: \`🌟 [STORY BEAT COMPLETED]: "\${activeBeat?.title || 'Story Beat'}". The Campaign Arc advances!\`,
            type: 'info'
          }
        ]);
      }`;

const beatCompleteReplace = `      if (data.objectiveProgress?.beatCompleted) {
        setMessages(prev => [
          ...prev,
          {
            sender: 'Story Director',
            text: \`🌟 [STORY BEAT COMPLETED]: "\${activeBeat?.title || 'Story Beat'}". The Campaign Arc advances!\`,
            type: 'info'
          }
        ]);
        triggerAutoSave('AutoSave - Story Beat Complete');
      }`;

if (content.includes(beatCompleteAnchor)) {
  content = content.replace(beatCompleteAnchor, beatCompleteReplace);
  console.log('Added auto-save on story beat completion');
}

fs.writeFileSync(appPath, content, 'utf8');
console.log('Step 1-4 applied successfully. File size:', content.length);
