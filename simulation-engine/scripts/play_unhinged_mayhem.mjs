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
      timeout: 25000
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

async function runUnhingedSession() {
  console.log('================================================================');
  console.log('🌀 OFF-THE-WALL MAYHEM & BACKWARDS ROLEPLAY STRESS TEST 🌀');
  console.log('================================================================\n');

  // STEP 1: Enter a fresh uncharted sector
  console.log('📍 STEP 1: Loading Uncharted Sector (Cell 22100, rx: 142, ry: 75)...');
  const loadRes = await request('/api/dm/sector_load', {
    method: 'POST',
    body: { cellId: 22100, rx: 142, ry: 75 }
  });

  const beat = loadRes.data?.beat;
  const props = loadRes.data?.props || [];
  const npcs = loadRes.data?.npcs || [];

  console.log(`   TITLE: "${beat?.title}"`);
  console.log(`   SCENE: ${beat?.hook}\n`);
  console.log(`   PROPS: ${props.map(p => p.name).join(' | ')}`);
  console.log(`   NPCS: ${npcs.map(n => n.name).join(' | ')}\n`);

  await sleep(1500);

  // ACTION 1: Roleplay completely backwards
  console.log('🌀 ACTION 1: Backwards Roleplay & Inverted Social Interaction');
  console.log('   INPUT: "!uoy rof ereh ma I !sloot ym ekat dna sgnilliw ym evig I. I bow upside down with my antennae in the mud and present my colossal maul as a delicate wedding bouquet to the nearest creature, apologizing for having not yet been eaten."');
  const act1 = await request('/api/dm/action', {
    method: 'POST',
    body: {
      actionText: '!uoy rof ereh ma I !sloot ym ekat dna sgnilliw ym evig I. I bow upside down with my antennae in the mud and present my colossal maul as a delicate wedding bouquet to the nearest creature, apologizing for having not yet been eaten.',
      playerId: 2
    }
  });

  console.log(`   PARSED: [Intent: ${act1.data?.intent?.verb} | Category: ${act1.data?.intent?.category} | Stat: ${act1.data?.intent?.statUsed} | Target: ${act1.data?.intent?.targetName}]`);
  console.log(`   SYSTEM: ${act1.data?.systemLog}`);
  console.log(`   DIALOGUE: ${act1.data?.dialogue || 'None'}`);
  console.log(`   GM PROSE: ${act1.data?.narrativeResponse}\n`);

  await sleep(2000);

  // ACTION 2: Total environmental destruction - Uproot tree, set it on fire, use as battering ram
  const treeTarget = props.find(p => p.tags && (p.tags.includes('wood') || p.tags.includes('shelter') || p.tags.includes('flora'))) || props[0] || { name: 'Tree' };
  const stoneTarget = props.find(p => p.tags && (p.tags.includes('stone') || p.tags.includes('metal'))) || props[1] || { name: 'Boulder' };

  console.log(`💥 ACTION 2: Improvised Siege Battering Ram Destruction`);
  console.log(`   INPUT: "I use my 11 Might to rip the ${treeTarget.name} out of the ground by its roots, ignite the branches with magical sparks, and swing it like a 50-foot flaming club into the ${stoneTarget.name} to smash both into dust!"`);
  const act2 = await request('/api/dm/action', {
    method: 'POST',
    body: {
      actionText: `I use my 11 Might to rip the ${treeTarget.name} out of the ground by its roots, ignite the branches with magical sparks, and swing it like a 50-foot flaming club into the ${stoneTarget.name} to smash both into dust!`,
      playerId: 2
    }
  });

  console.log(`   PARSED: [Intent: ${act2.data?.intent?.verb} | Category: ${act2.data?.intent?.category} | Stat: ${act2.data?.intent?.statUsed} | Target: ${act2.data?.intent?.targetName}]`);
  console.log(`   SYSTEM: ${act2.data?.systemLog}`);
  console.log(`   TAG RESULTS: Dealt ${act2.data?.tagResult?.damageDealt || 0} damage. Applied: [${act2.data?.tagResult?.appliedTags?.join(', ') || 'none'}]. Cascades: ${JSON.stringify(act2.data?.tagResult?.cascades || [])}`);
  console.log(`   GM PROSE: ${act2.data?.narrativeResponse}\n`);

  await sleep(2000);

  // ACTION 3: Bizarre biological weaponization
  console.log(`🦷 ACTION 3: Bizarre Biological Weaponization`);
  console.log(`   INPUT: "I chew off a chunk of raw stone and iron slag with my insect chitin mandibles, grind it with my digestive enzymes into molten shrapnel, and regurgitate it directly at the target while screeching a song in reverse!"`);
  const act3 = await request('/api/dm/action', {
    method: 'POST',
    body: {
      actionText: 'I chew off a chunk of raw stone and iron slag with my insect chitin mandibles, grind it with my digestive enzymes into molten shrapnel, and regurgitate it directly at the target while screeching a song in reverse!',
      playerId: 2
    }
  });

  console.log(`   PARSED: [Intent: ${act3.data?.intent?.verb} | Category: ${act3.data?.intent?.category} | Stat: ${act3.data?.intent?.statUsed} | Target: ${act3.data?.intent?.targetName}]`);
  console.log(`   SYSTEM: ${act3.data?.systemLog}`);
  console.log(`   GM PROSE: ${act3.data?.narrativeResponse}\n`);

  await sleep(2000);

  // ACTION 4: Apocalypse - Burn everything down
  console.log(`🔥 ACTION 4: Total Conflagration Inferno`);
  console.log(`   INPUT: "I unleash pure chaotic fire across the entire glade, igniting every single shrub, wagon, fence, and tree in a 360-degree storm of fire to burn the entire sector to cinders!"`);
  const act4 = await request('/api/dm/action', {
    method: 'POST',
    body: {
      actionText: 'I unleash pure chaotic fire across the entire glade, igniting every single shrub, wagon, fence, and tree in a 360-degree storm of fire to burn the entire sector to cinders!',
      playerId: 2
    }
  });

  console.log(`   PARSED: [Intent: ${act4.data?.intent?.verb} | Category: ${act4.data?.intent?.category} | Stat: ${act4.data?.intent?.statUsed} | Target: ${act4.data?.intent?.targetName}]`);
  console.log(`   SYSTEM: ${act4.data?.systemLog}`);
  console.log(`   GM PROSE: ${act4.data?.narrativeResponse}\n`);

  await sleep(2000);

  // ACTION 5: Backwards causality & thanking the flames
  console.log(`⏳ ACTION 5: Reverse Causality Logic Check`);
  console.log(`   INPUT: "I lay face-down in the smoldering ash, thank the fire for cleansing the world, and command the ashes to un-burn themselves and reconstruct backward into fresh green seedlings using my reverse Logic."`);
  const act5 = await request('/api/dm/action', {
    method: 'POST',
    body: {
      actionText: 'I lay face-down in the smoldering ash, thank the fire for cleansing the world, and command the ashes to un-burn themselves and reconstruct backward into fresh green seedlings using my reverse Logic.',
      playerId: 2
    }
  });

  console.log(`   PARSED: [Intent: ${act5.data?.intent?.verb} | Category: ${act5.data?.intent?.category} | Stat: ${act5.data?.intent?.statUsed} | Target: ${act5.data?.intent?.targetName}]`);
  console.log(`   SYSTEM: ${act5.data?.systemLog}`);
  console.log(`   GM PROSE: ${act5.data?.narrativeResponse}\n`);

  console.log('🏁 MAYHEM SESSION COMPLETE!');
}

runUnhingedSession().catch(console.error);
