import http from 'http';

const BASE_URL = 'http://localhost:3000';

async function request(path, options = {}) {
  const url = new URL(path, BASE_URL);
  const body = options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : null;
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };

  return new Promise((resolve, reject) => {
    const req = http.request(url, {
      method: options.method || 'GET',
      headers,
      timeout: 20000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function playMayhem() {
  console.log('================================================================');
  console.log('🎮 LIVE PLAYER PLAYTHROUGH: CAUSING MAYHEM AS ZORATH VOID-WALKER');
  console.log('================================================================\n');

  // STEP 1: Enter an uncharted high-conflict sector
  console.log('📍 STEP 1: Stepping into Cell 18450 (Sector rx: 115, ry: 98)...');
  const loadRes = await request('/api/dm/sector_load', {
    method: 'POST',
    body: { cellId: 18450, rx: 115, ry: 98 }
  });

  const beat = loadRes.data?.beat;
  const props = loadRes.data?.props || [];
  const npcs = loadRes.data?.npcs || [];

  console.log(`\n📖 SENSORY ARRIVAL:`);
  console.log(`   TITLE: "${beat?.title}"`);
  console.log(`   SCENE: ${beat?.hook}`);
  console.log(`   DILEMMA: ${beat?.pivotDecision}\n`);

  console.log(`🔍 VISIBLE ON THE MAP:`);
  console.log(`   PROPS: ${props.slice(0, 8).map(p => `${p.name} [${Array.from(p.tags || []).join(', ')}]`).join(' | ')}`);
  console.log(`   LIVING ENTITIES: ${npcs.map(n => `${n.name} (${n.role}) [HP: ${n.hp}]`).join(' | ')}\n`);

  await sleep(1500);

  // STEP 2: Talk to a living entity with an aggressive demand (Charm check)
  const firstNPC = npcs.find(n => n.alive) || { name: 'Stranger' };
  console.log(`🗣️ STEP 2: Zorath glares down with compound eyes and barks: "Drop your weapons and tell me what you are guarding before I crush you!"`);
  const talkRes = await request('/api/dm/action', {
    method: 'POST',
    body: {
      actionText: `Intimidate and demand surrender from ${firstNPC.name}: Drop your weapons and surrender!`,
      playerId: 2
    }
  });

  console.log(`   SYSTEM: ${talkRes.data?.systemLog}`);
  console.log(`   DIALOGUE: ${talkRes.data?.dialogue || 'None'}`);
  console.log(`   GM PROSE: ${talkRes.data?.narrativeResponse}\n`);

  await sleep(2000);

  // STEP 3: Smash something with the Colossal Maul (Might check & structural damage)
  const smashTarget = props.find(p => p.tags && (p.tags.includes('stone') || p.tags.includes('metal') || p.tags.includes('wood') || p.tags.includes('container'))) || props[0] || { name: 'Boulder' };
  console.log(`🔨 STEP 3: Zorath raises the Osmium Colossal Maul and brings it down on the ${smashTarget.name} with all 11 Might!`);
  const smashRes = await request('/api/dm/action', {
    method: 'POST',
    body: {
      actionText: `Smash and shatter the ${smashTarget.name} with my colossal maul using overwhelming might!`,
      playerId: 2
    }
  });

  console.log(`   SYSTEM: ${smashRes.data?.systemLog}`);
  console.log(`   GM PROSE: ${smashRes.data?.narrativeResponse}\n`);

  await sleep(2000);

  // STEP 4: Cause Elemental Mayhem - Ignite and Burn (Magic/Ignite check)
  const burnTarget = props.find(p => p.tags && (p.tags.includes('wood') || p.tags.includes('flammable') || p.tags.includes('organic'))) || props[1] || { name: 'Thicket' };
  console.log(`🔥 STEP 4: Zorath strikes sparks with a ritual blade and hurls magical fire onto the ${burnTarget.name}!`);
  const burnRes = await request('/api/dm/action', {
    method: 'POST',
    body: {
      actionText: `Cast magical fire to ignite and burn the ${burnTarget.name}!`,
      playerId: 2
    }
  });

  console.log(`   SYSTEM: ${burnRes.data?.systemLog}`);
  console.log(`   GM PROSE: ${burnRes.data?.narrativeResponse}\n`);

  await sleep(2000);

  // STEP 5: Scavenge and Loot the smoking ruins (Exploration/Search check)
  console.log(`💰 STEP 5: Zorath steps into the smoking rubble to search the shattered wreckage for loot!`);
  const lootRes = await request('/api/dm/action', {
    method: 'POST',
    body: {
      actionText: `Search the rubble and loot any hidden gold, relics, or caches in the debris`,
      playerId: 2
    }
  });

  console.log(`   SYSTEM: ${lootRes.data?.systemLog}`);
  console.log(`   LOOT AWARDED:`, lootRes.data?.lootAwarded || 'None');
  console.log(`   GM PROSE: ${lootRes.data?.narrativeResponse}\n`);

  // Final player state check
  const finalPlayer = await request('/api/dm/player');
  console.log(`🏆 FINAL STATUS: HP: ${finalPlayer.data?.current_hp}/${finalPlayer.data?.max_hp} | Gold: ${finalPlayer.data?.gold}g | Inventory Count: ${finalPlayer.data?.inventory?.length || 0}`);
}

playMayhem().catch(console.error);
