import './style.css';
import { KINGDOMS, LINEAGES, INSTITUTIONS } from './data';
import type { StatKey } from './data';
import { GEAR_DB, SKILL_DB } from './expansion-data';
import { generateCharacter, shiftOuroboros, applyDerivedStats } from './engine';
import type { CharacterChassis } from './engine';
import { generateStorySeeds, generateQuestFromSeed, talkToNpc, syncSimulation, getStoryState, getMesoGrid } from './api';

// Wizard Logic
let currentStep = 1;
const totalSteps = 7;
const prevBtn = document.getElementById('prev-btn') as HTMLButtonElement;
const nextBtn = document.getElementById('next-btn') as HTMLButtonElement;
const dots = document.querySelectorAll('.dot');

function updateWizard() {
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  document.getElementById(`step-${currentStep}`)?.classList.add('active');
  
  dots.forEach((d, i) => {
    if (i < currentStep) d.classList.add('active');
    else d.classList.remove('active');
  });

  prevBtn.disabled = currentStep === 1;
  nextBtn.disabled = currentStep === totalSteps;
}

prevBtn.addEventListener('click', () => { if (currentStep > 1) { currentStep--; updateWizard(); } });
nextBtn.addEventListener('click', () => { if (currentStep < totalSteps) { currentStep++; updateWizard(); } });

// DOM Elements
const kingdomSelect = document.getElementById('kingdom-select') as HTMLSelectElement;
const lineageSelect = document.getElementById('lineage-select') as HTMLSelectElement;
const instSelect = document.getElementById('inst-select') as HTMLSelectElement;

const bodyStats = document.getElementById('body-stats')!;
const mindStats = document.getElementById('mind-stats')!;
const derivedStats = document.getElementById('derived-stats')!;
const passiveTraits = document.getElementById('passive-traits')!;
const masteryPerks = document.getElementById('mastery-perks')!;

const physGearSelect = document.getElementById('phys-gear-select') as HTMLSelectElement;
const mentGearSelect = document.getElementById('ment-gear-select') as HTMLSelectElement;
const physSlots = document.getElementById('phys-slots')!;
const mentSlots = document.getElementById('ment-slots')!;
const addPhysBtn = document.getElementById('add-phys-btn')!;
const addMentBtn = document.getElementById('add-ment-btn')!;
const taxBanner = document.getElementById('tax-banner')!;

const bpItemInput = document.getElementById('bp-item-input') as HTMLInputElement;
const addBpBtn = document.getElementById('add-bp-btn')!;
const bpList = document.getElementById('bp-list')!;

const progressionList = document.getElementById('progression-list')!;

const skillSelect = document.getElementById('skill-select') as HTMLSelectElement;
const addSkillBtn = document.getElementById('add-skill-btn')!;
const skillList = document.getElementById('skill-list')!;

const customInjInput = document.getElementById('custom-inj-input') as HTMLInputElement;
const addCritBtn = document.getElementById('add-crit-btn')!;
const drawMinorBtn = document.getElementById('draw-minor-btn')!;
const drawMajorBtn = document.getElementById('draw-major-btn')!;
const adrenList = document.getElementById('adren-list')!;
const injuryList = document.getElementById('injury-list')!;

const exportBtn = document.getElementById('export-btn') as HTMLButtonElement;

// Step 7 DOM Elements
const syncSimBtn = document.getElementById('sync-sim-btn') as HTMLButtonElement;
const simLog = document.getElementById('sim-log')!;
const getRumorsBtn = document.getElementById('get-rumors-btn') as HTMLButtonElement;
const rumorsList = document.getElementById('rumors-list')!;
const questsList = document.getElementById('quests-list')!;
const chatWindow = document.getElementById('chat-window')!;
const chatNpcId = document.getElementById('chat-npc-id') as HTMLInputElement;
const chatInput = document.getElementById('chat-input') as HTMLInputElement;
const chatSendBtn = document.getElementById('chat-send-btn') as HTMLButtonElement;

// Grid Elements
const loadGridBtn = document.getElementById('load-grid-btn') as HTMLButtonElement;
const gridStatus = document.getElementById('grid-status')!;
const canvas = document.getElementById('world-canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

let currentCharacter: CharacterChassis | null = null;

function initApp() {
  Object.keys(KINGDOMS).forEach(k => kingdomSelect.appendChild(new Option(k, k)));
  INSTITUTIONS.forEach(i => instSelect.appendChild(new Option(`${i.name} (+1 ${i.stat})`, i.name)));
  
  GEAR_DB.filter(g => g.type === 'physical').forEach(g => physGearSelect.appendChild(new Option(`${g.name} (Tax: ${g.tax})`, g.id)));
  GEAR_DB.filter(g => g.type === 'mental').forEach(g => mentGearSelect.appendChild(new Option(`${g.name} (Tax: ${g.tax})`, g.id)));
  
  SKILL_DB.forEach(s => skillSelect.appendChild(new Option(`${s.name} [${s.cost}]`, s.id)));
  
  kingdomSelect.addEventListener('change', () => { updateLineageDropdown(); generateNew(); });
  lineageSelect.addEventListener('change', generateNew);
  instSelect.addEventListener('change', generateNew);

  addPhysBtn.addEventListener('click', () => addGear(physGearSelect.value, 'physical'));
  addMentBtn.addEventListener('click', () => addGear(mentGearSelect.value, 'mental'));
  addSkillBtn.addEventListener('click', addSkill);

  addBpBtn.addEventListener('click', () => {
    if (currentCharacter && bpItemInput.value) {
      currentCharacter.inventory.push(bpItemInput.value);
      bpItemInput.value = '';
      renderAll();
    }
  });

  drawMinorBtn.addEventListener('click', () => {
    if(currentCharacter) { currentCharacter.mechanics.adrenaline_deck.push("Minor"); renderAll(); }
  });
  drawMajorBtn.addEventListener('click', () => {
    if(currentCharacter) { currentCharacter.mechanics.adrenaline_deck.push("Major"); renderAll(); }
  });

  addCritBtn.addEventListener('click', () => { 
    if(currentCharacter && customInjInput.value) { 
      currentCharacter.injury_log.critical.push(customInjInput.value); 
      customInjInput.value=''; 
      renderAll(); 
    }
  });
  
  updateLineageDropdown();
  generateNew();
}

function updateLineageDropdown() {
  lineageSelect.innerHTML = '';
  const lineages = LINEAGES[kingdomSelect.value] || [];
  lineages.forEach(l => lineageSelect.appendChild(new Option(l.name, l.name)));
}

function generateNew() {
  const k = kingdomSelect.value;
  const l = lineageSelect.value;
  const i = instSelect.value;
  if (!k || !l || !i) return;
  currentCharacter = generateCharacter(k, l, i);
  renderAll();
}

function handleShift(stat: string) {
  if (!currentCharacter) return;
  if (shiftOuroboros(currentCharacter, stat as StatKey)) renderAll();
}
(window as any).handleShift = handleShift;

function addMark(trackName: string, markType: string) {
  if (!currentCharacter) return;
  
  let trackData = currentCharacter.metadata.experience.progression_tracks[trackName];
  if (!trackData) {
    trackData = { level: 1, marks: [], potency_tokens: 0, function_tokens: 0, attribute_tokens: 0 };
    currentCharacter.metadata.experience.progression_tracks[trackName] = trackData;
  }
  
  trackData.marks.push(markType);
  
  if (trackData.marks.length >= 3) {
    const cfCount = trackData.marks.filter(m => m === 'CF').length;
    const csCount = trackData.marks.filter(m => m === 'CS').length;
    const qrCount = trackData.marks.filter(m => m === 'QR').length;
    
    // CF Heavy = Potency (Improved Usage)
    // CS Heavy = Function (New Skill Effects)
    // QR Heavy = Attribute Up (Governing Stat)
    if (cfCount >= csCount && cfCount >= qrCount) {
      trackData.potency_tokens += 1;
    } else if (csCount >= cfCount && csCount >= qrCount) {
      trackData.function_tokens += 1;
    } else {
      trackData.attribute_tokens += 1;
    }
    trackData.marks = [];
  }
  renderAll();
}
(window as any).addMark = addMark;

function lvlUp(trackName: string, tokenType: 'potency'|'function'|'attribute') {
  if (!currentCharacter) return;
  let trackData = currentCharacter.metadata.experience.progression_tracks[trackName];
  if (!trackData) return;

  const cost = trackData.level + 1;
  if (tokenType === 'potency' && trackData.potency_tokens >= cost) {
    trackData.potency_tokens -= cost;
    trackData.level += 1;
  } else if (tokenType === 'function' && trackData.function_tokens >= cost) {
    trackData.function_tokens -= cost;
    trackData.level += 1;
  } else if (tokenType === 'attribute' && trackData.attribute_tokens >= cost) {
    trackData.attribute_tokens -= cost;
    trackData.level += 1;
  }
  renderAll();
}
(window as any).lvlUp = lvlUp;

function renderStatRow(name: string, value: number) {
  const row = document.createElement('div');
  row.className = 'stat-row';
  row.innerHTML = `<span class="stat-name">${name}</span><div class="stat-controls"><span class="stat-value">${value}</span><button class="round" style="width:24px;height:24px;" onclick="window.handleShift('${name}')">+</button></div>`;
  return row;
}

function renderAll() {
  if (!currentCharacter) return;

  // Step 2: Stats
  bodyStats.innerHTML = '<h3 style="color: var(--danger); margin-bottom: 1rem;">The Flesh</h3>';
  Object.entries(currentCharacter.attributes.body).forEach(([k, v]) => bodyStats.appendChild(renderStatRow(k, v)));
  mindStats.innerHTML = '<h3 style="color: var(--accent); margin-bottom: 1rem;">The Will</h3>';
  Object.entries(currentCharacter.attributes.mind).forEach(([k, v]) => mindStats.appendChild(renderStatRow(k, v)));

  // Step 3: Gear
  physSlots.innerHTML = currentCharacter.loadout_slots.physical.map((g, i) => `<li style="margin-bottom:0.5rem; display:flex; justify-content:space-between;"><span>${g.name} (Tax: ${g.tax})</span> <button class="round outline" style="width:20px;height:20px;" onclick="window.removeGear('physical', ${i})">x</button></li>`).join('');
  mentSlots.innerHTML = currentCharacter.loadout_slots.mental.map((g, i) => `<li style="margin-bottom:0.5rem; display:flex; justify-content:space-between;"><span>${g.name} (Tax: ${g.tax})</span> <button class="round outline" style="width:20px;height:20px;" onclick="window.removeGear('mental', ${i})">x</button></li>`).join('');
  
  const tax = currentCharacter.mechanics.gear_tax_total;
  const isPenalized = currentCharacter.mechanics.tax_threshold_met;
  taxBanner.textContent = `Total Gear Tax: ${tax} ${isPenalized ? '(THRESHOLD EXCEEDED: -1 REGEN)' : '(Optimal)'}`;
  taxBanner.style.backgroundColor = isPenalized ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)';
  taxBanner.style.color = isPenalized ? '#fca5a5' : '#6ee7b7';

  bpList.innerHTML = currentCharacter.inventory.map((item, i) => `<li style="margin-bottom:0.5rem; display:flex; justify-content:space-between;"><span>${item}</span> <button class="round outline" style="width:20px;height:20px;" onclick="window.removeBp(${i})">x</button></li>`).join('');

  // Step 4: Progression Tracks
  skillList.innerHTML = currentCharacter.active_powers.map((s, i) => `<li style="margin-bottom:0.5rem;"><strong>${s.name}</strong> [${s.cost}]: ${s.desc} <button style="padding:2px 5px; font-size:0.7rem; float:right;" onclick="window.removeSkill(${i})">X</button></li>`).join('');
  
  let pHTML = '';
  const renderTrackRow = (name: string) => {
    const track = currentCharacter!.metadata.experience.progression_tracks[name] || { level: 1, marks: [], potency_tokens: 0, function_tokens: 0, attribute_tokens: 0 };
    const cost = track.level + 1;
    const canPot = track.potency_tokens >= cost;
    const canFunc = track.function_tokens >= cost;
    const canAttr = track.attribute_tokens >= cost;
    const marks = track.marks.join(', ');
    pHTML += `<div style="display:flex; flex-direction: column; margin-bottom:0.5rem; padding: 0.5rem; background:rgba(255,255,255,0.02); border-radius:4px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
        <div>
          <strong>${name}</strong> (Lvl ${track.level})<br/>
          <span style="font-size:0.7rem; color:var(--text-muted);">Marks: [${marks}] | Potency: ${track.potency_tokens} | Function: ${track.function_tokens} | Attribute: ${track.attribute_tokens}</span>
        </div>
        <div style="display:flex; gap:0.2rem; align-items:center;">
          <button style="padding:2px 4px; font-size:0.7rem; background:#475569;" onclick="window.addMark('${name}', 'CF')">CF</button>
          <button style="padding:2px 4px; font-size:0.7rem; background:#475569;" onclick="window.addMark('${name}', 'CS')">CS</button>
          <button style="padding:2px 4px; font-size:0.7rem; background:#475569;" onclick="window.addMark('${name}', 'QR')">QR</button>
        </div>
      </div>
      <div style="display:flex; gap:0.5rem;">
        <button style="flex:1; padding:2px 4px; font-size:0.7rem; background:var(--accent);" ${canPot ? '' : 'disabled'} onclick="window.lvlUp('${name}','potency')">Potency Up (${cost})</button>
        <button style="flex:1; padding:2px 4px; font-size:0.7rem; background:var(--success);" ${canFunc ? '' : 'disabled'} onclick="window.lvlUp('${name}','function')">Function Up (${cost})</button>
        <button style="flex:1; padding:2px 4px; font-size:0.7rem; background:#f59e0b;" ${canAttr ? '' : 'disabled'} onclick="window.lvlUp('${name}','attribute')">Attribute Up (${cost})</button>
      </div>
    </div>`;
  };
  Object.keys(currentCharacter.attributes.body).forEach(k => renderTrackRow(k));
  Object.keys(currentCharacter.attributes.mind).forEach(k => renderTrackRow(k));
  currentCharacter.active_powers.forEach(s => renderTrackRow(s.name));
  progressionList.innerHTML = pHTML;

  // Step 5: Trauma & Adrenaline
  adrenList.innerHTML = currentCharacter.mechanics.adrenaline_deck.map((type, i) => `<li style="margin-bottom:0.5rem; display:flex; justify-content:space-between; align-items:center;">
    <span>Adrenaline Card (${type})</span> 
    <button class="round outline" style="padding:0.2rem 0.5rem; width:auto; height:auto; font-size:0.7rem; background:var(--danger);" onclick="window.flipAdren(${i}, '${type}')">FLIP (End Combat)</button>
  </li>`).join('');
  
  const iLog = currentCharacter.injury_log;
  injuryList.innerHTML = [
    ...iLog.minor.map((inj, i) => `<li>[Minor] ${inj} <button class="round outline" style="width:16px;height:16px;font-size:10px;" onclick="window.removeInj('minor', ${i})">x</button></li>`),
    ...iLog.major.map((inj, i) => `<li>[Major] ${inj} <button class="round outline" style="width:16px;height:16px;font-size:10px;" onclick="window.removeInj('major', ${i})">x</button></li>`),
    ...iLog.critical.map((inj, i) => `<li>[Critical] ${inj} <button class="round outline" style="width:16px;height:16px;font-size:10px;" onclick="window.removeInj('critical', ${i})">x</button></li>`)
  ].join('');

  // Step 6: Derived
  derivedStats.innerHTML = '';
  const d = currentCharacter.derived_stats;
  const dr = (n:string, v:any) => `<div style="display:flex; justify-content:space-between; padding:0.4rem 0; border-bottom:1px solid var(--glass-border);"><span style="font-weight:600;">${n}</span><span style="color:var(--text-main); font-weight:700;">${v}</span></div>`;
  derivedStats.innerHTML += dr('Health (HP)', `${d.hp.current} / ${d.hp.max}`);
  derivedStats.innerHTML += dr('Composure', `${d.composure.current} / ${d.composure.max}`);
  derivedStats.innerHTML += dr('Stamina (Max)', d.stamina.max);
  derivedStats.innerHTML += dr('Focus (Max)', d.focus.max);
  derivedStats.innerHTML += dr('Physical Defense', d.phys_defense);
  derivedStats.innerHTML += dr('Mental Defense', d.mental_defense);
  derivedStats.innerHTML += dr('Speed', d.speed);
  derivedStats.innerHTML += dr('Perception', d.perception);

  masteryPerks.innerHTML = currentCharacter.mastery_perks.map(p => `<li style="margin-bottom:0.5rem;">${p}</li>`).join('');
  passiveTraits.innerHTML = currentCharacter.passive_traits.map(t => `<li style="margin-bottom:0.5rem;">${t}</li>`).join('');
}

function addGear(id: string, type: 'physical' | 'mental') {
  if (!currentCharacter) return;
  const gear = GEAR_DB.find(g => g.id === id);
  if (gear && currentCharacter.loadout_slots[type].length < 3) {
    currentCharacter.loadout_slots[type].push(gear);
    applyDerivedStats(currentCharacter);
    renderAll();
  }
}

function removeGear(type: 'physical' | 'mental', index: number) {
  if (!currentCharacter) return;
  currentCharacter.loadout_slots[type].splice(index, 1);
  applyDerivedStats(currentCharacter);
  renderAll();
}

function addSkill() {
  if (!currentCharacter) return;
  const skill = SKILL_DB.find(s => s.id === skillSelect.value);
  if (skill && !currentCharacter.active_powers.find(s => s.id === skill.id)) {
    currentCharacter.active_powers.push(skill);
    renderAll();
  }
}

function removeSkill(index: number) {
  if (!currentCharacter) return;
  currentCharacter.active_powers.splice(index, 1);
  renderAll();
}

(window as any).removeGear = removeGear;
(window as any).removeSkill = removeSkill;
(window as any).removeBp = (index: number) => { if(currentCharacter) { currentCharacter.inventory.splice(index, 1); renderAll(); } };

(window as any).flipAdren = (index: number, type: string) => { 
  if(currentCharacter) { 
    currentCharacter.mechanics.adrenaline_deck.splice(index, 1); 
    if(type === 'Minor') currentCharacter.injury_log.minor.push("Delayed Injury Applied");
    if(type === 'Major') currentCharacter.injury_log.major.push("Delayed Severe Injury Applied");
    renderAll(); 
  } 
};

(window as any).removeInj = (type: 'minor'|'major'|'critical', index: number) => { if(currentCharacter) { currentCharacter.injury_log[type].splice(index, 1); renderAll(); } };

exportBtn.addEventListener('click', () => {
  if (!currentCharacter) return;
  const blob = new Blob([JSON.stringify(currentCharacter, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `chassis-${currentCharacter.metadata.lineage.toLowerCase()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

// Step 7 Logic
syncSimBtn.addEventListener('click', async () => {
  try {
    const res = await syncSimulation();
    simLog.textContent = res.message;
    refreshQuests();
  } catch (e: any) {
    simLog.textContent = "Error: " + e.message;
  }
});

getRumorsBtn.addEventListener('click', async () => {
  if (!currentCharacter) return;
  rumorsList.innerHTML = '<p>Listening...</p>';
  try {
    const ctx = {
      kingdom: currentCharacter.metadata.kingdom,
      city_dominant_lineage: currentCharacter.metadata.lineage
    };
    const res = await generateStorySeeds(currentCharacter.metadata.kingdom, ctx);
    rumorsList.innerHTML = res.seeds.map((s: string) => `
      <div style="padding:0.5rem; background:rgba(255,255,255,0.05); border-radius:4px; font-size:0.8rem;">
        <p style="margin-bottom:0.5rem;">${s}</p>
        <button onclick="window.investigateRumor('${s.replace(/'/g, "\\'")}')" style="font-size:0.7rem; width:100%;">Investigate</button>
      </div>
    `).join('');
  } catch (e: any) {
    rumorsList.innerHTML = `<p style="color:var(--danger)">Error: ${e.message}</p>`;
  }
});

(window as any).investigateRumor = async (seedText: string) => {
  if (!currentCharacter) return;
  try {
    const res = await generateQuestFromSeed(seedText);
    alert(`Quest Started: ${res.quest.title}\n\nMutations Applied: ${res.mutations.length}`);
    refreshQuests();
    
    // Auto-fill NPC ID if a mutation spawned one
    const spawnMut = res.mutations.find((m: any) => m.type === 'SPAWN_NPC');
    if (spawnMut) {
      chatNpcId.value = "mock-npc-id-would-be-here"; // In reality, the backend doesn't return the exact spawned ID in this payload yet without a DB lookup, but we can instruct the user to check backend logs for the ID.
      chatWindow.innerHTML += `<div><i style="color:var(--text-muted)">Hint: Check backend console for spawned NPC ID.</i></div>`;
    }
  } catch(e: any) {
    alert("Failed to start quest: " + e.message);
  }
};

async function refreshQuests() {
  try {
    const state = await getStoryState();
    questsList.innerHTML = state.active_quests.map((q: any) => `
      <div style="padding:0.5rem; background:rgba(16, 185, 129, 0.1); border-left:2px solid var(--success); font-size:0.8rem;">
        <strong>${q.title}</strong> (TTL: ${q.time_to_live ? q.time_to_live - q.current_tick_age : 'Infinite'})
        <ul style="margin-top:0.2rem; margin-left:1rem; font-size:0.75rem;">
          ${q.objectives.map((o:string) => `<li>${o}</li>`).join('')}
        </ul>
      </div>
    `).join('');
    if (state.active_quests.length === 0) questsList.innerHTML = '<p style="font-size:0.8rem; color:var(--text-muted)">No active quests.</p>';
  } catch(e) {
    console.error(e);
  }
}

chatSendBtn.addEventListener('click', async () => {
  const npcId = chatNpcId.value;
  const input = chatInput.value;
  if (!npcId || !input || !currentCharacter) return;
  
  chatWindow.innerHTML += `<div><strong style="color:var(--accent)">You:</strong> ${input}</div>`;
  chatInput.value = '';
  chatWindow.scrollTop = chatWindow.scrollHeight;
  
  try {
    const ctx = {
      kingdom: currentCharacter.metadata.kingdom,
      city_dominant_lineage: currentCharacter.metadata.lineage
    };
    const res = await talkToNpc(npcId, "Player", input, ctx, "");
    
    chatWindow.innerHTML += `<div><strong style="color:var(--danger)">NPC:</strong> ${res.npc_response}</div>`;
    if (res.action_triggered) {
      chatWindow.innerHTML += `<div style="color:var(--success); font-size:0.7rem; font-style:italic;">[Action Result: ${res.action_triggered.description} (MoS: ${res.action_triggered.margin_of_success})]</div>`;
    }
    chatWindow.scrollTop = chatWindow.scrollHeight;
  } catch(e: any) {
    chatWindow.innerHTML += `<div style="color:var(--danger)">Error: ${e.message}</div>`;
  }
});

chatInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') chatSendBtn.click();
});

const TERRAIN_COLORS: Record<string, string> = {
  grass: '#166534', // green-800
  forest: '#064e3b', // emerald-900
  water: '#1e3a8a', // blue-900
  mountain: '#475569', // slate-600
  road: '#78716c', // stone-500
};

loadGridBtn.addEventListener('click', async () => {
  if (!currentCharacter) return;
  gridStatus.textContent = 'Generating 25x25 Meso Grid...';
  try {
    // Generate an arbitrary macro ID based on the kingdom/lineage
    const macroId = `cell_${currentCharacter.metadata.kingdom.toLowerCase()}`;
    const gridRes = await getMesoGrid(macroId, 12345);
    
    // Render the grid
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const tileSize = canvas.width / 25; // 400/25 = 16
    
    gridRes.tiles.forEach((tile: any) => {
      ctx.fillStyle = TERRAIN_COLORS[tile.terrain_type] || '#000';
      ctx.fillRect(tile.x * tileSize, tile.y * tileSize, tileSize, tileSize);
      
      if (tile.poi_id) {
        ctx.fillStyle = '#fbbf24'; // yellow for POI
        ctx.beginPath();
        ctx.arc(tile.x * tileSize + tileSize/2, tile.y * tileSize + tileSize/2, tileSize/4, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    
    // Draw player token at center
    ctx.fillStyle = '#ef4444'; // red for player
    ctx.beginPath();
    ctx.arc(12 * tileSize + tileSize/2, 12 * tileSize + tileSize/2, tileSize/3, 0, Math.PI * 2);
    ctx.fill();
    
    gridStatus.textContent = 'Meso Grid generated from World Data.';
  } catch (e: any) {
    gridStatus.textContent = `Error: ${e.message}`;
  }
});

initApp();
updateWizard();
refreshQuests();
