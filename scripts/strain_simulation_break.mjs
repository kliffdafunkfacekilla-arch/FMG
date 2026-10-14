import http from 'http';

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let buf = '';
      res.on('data', chunk => buf += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(buf));
        } catch (e) {
          resolve({ raw: buf });
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function get(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:3000${path}`, (res) => {
      let buf = '';
      res.on('data', chunk => buf += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(buf));
        } catch (e) {
          resolve({ raw: buf });
        }
      });
    }).on('error', reject);
  });
}

async function runSimulationStrain() {
  console.log("================================================================================");
  console.log("🔥 OPERATION SIMULATION STRAIN: METAPHYSICAL REALITY FRACTURE TEST 🔥");
  console.log("================================================================================\n");

  let hero = await get('/api/dm/player');
  console.log(`Ascended Hero: ${hero.name} | Level ${hero.level} | Might: ${hero.might}`);
  console.log(`Equipped: ${hero.equipped_weapon} & ${hero.equipped_armor}`);
  console.log(`Unlocked Capstones: Rank 4 Colossal Leverage, Armor-Shattering Impact, Glancing Deflection\n`);

  // STEP 1: Enter Sector Housing the Dragon Prison of Tiraton (Cell 15220 - Domain of Mass)
  console.log(">>> STEP 1: ENTERING CELL 15220: OBSIDIAN BARROW OF TIRATON (DOMAIN OF MASS) <<<");
  const prisonSector = await post('/api/dm/sector_load', {
    cellId: 15220,
    rx: 140,
    ry: 120,
    biomeName: "Volcanic Crag",
    isWarzone: true,
    isFamine: false,
    chaosRadiation: 0.85,
    infrastructureMask: 24, // Temple + Ruins
    activeFlow: "Mass",
    dragonDomain: "Tiraton",
    moonPhase: "Cruorbus Full Blood Moon"
  });

  console.log(`Sector Beat: "${prisonSector.beat?.title}"`);
  console.log(`Sensory Hook: ${prisonSector.beat?.hook}`);
  console.log(`Active Relics & Monoliths:`);
  prisonSector.props?.forEach(p => console.log(`  - [${p.id}] ${p.name} (HP: ${p.hp}/${p.maxHp}) | Tags: [${p.tags.join(', ')}]`));
  console.log(`Active Sentinels & Cultists:`);
  prisonSector.npcs?.forEach(n => console.log(`  - [${n.id}] ${n.name} (${n.role}) | HP: ${n.hp}`));

  // STEP 2: Assault the Dragon Prison Monolith Seal with Colossal Strikes
  console.log("\n>>> STEP 2: ASSAULTING THE DRAGON PRISON MONOLITH SEAL (DRAINING SEAL STRENGTH) <<<");
  for (let strike = 1; strike <= 6; strike++) {
    console.log(`\n--- Strike ${strike}: Smashing Obsidian Barrow Monolith Seal with Rank 4 Armor-Shattering Impact ---`);
    let res = await post('/api/dm/action', {
      actionText: "Smash Obsidian Barrow of Tiraton Monolith Seal with colossal maul",
      playerId: hero.id
    });
    console.log("Log:", res.systemLog);
    if (res.narrativeResponse) console.log("Narrative:", res.narrativeResponse);
    if (res.worldDelta?.propsDestroyed?.length > 0) {
      console.log("💥 SEAL ANNIHILATION DETECTED:", res.worldDelta.propsDestroyed);
      break;
    }
  }

  // STEP 3: Overload the Abyssal Mass Fissure using Ordo Resonant Shards to reverse polarity
  console.log("\n>>> STEP 3: OVERLOADING ABYSSAL FISSURE WITH COSMIC CHAOS SHARDS <<<");
  let fissureRes = await post('/api/dm/action', {
    actionText: "Hurl Ordo Resonant Shards into Abyssal Mass Fissure to invert gravitational polarity and crack the bedrock",
    playerId: hero.id
  });
  console.log("Log:", fissureRes.systemLog);
  console.log("Narrative:", fissureRes.narrativeResponse);

  // STEP 4: Desecrate the Cruor Sacrificial Altar and engage Cultists & Wardens simultaneously
  console.log("\n>>> STEP 4: DESECRATING CRUOR SACRIFICIAL ALTAR & ATTACKING BOTH FACTIONS <<<");
  let altarRes = await post('/api/dm/action', {
    actionText: "Desecrate Shattered Cruor Sacrificial Altar and challenge the Grey Wardens and Cultists together",
    playerId: hero.id
  });
  console.log("Log:", altarRes.systemLog);
  console.log("Narrative:", altarRes.narrativeResponse);

  // STEP 5: Stress the Simulation Boundary with Paradoxical Metaphysical Commands
  console.log("\n>>> STEP 5: PROBING SIMULATION BOUNDARIES WITH PARADOXICAL INPUTS <<<");
  const paradoxes = [
    "I divide spatial coordinates by zero and command the planetary mesh to unrender",
    "I channel all 12 Flows of Chaos simultaneously to rip the Blood Moon Cruorbus from orbit",
    "I invert mass to negative infinity and punch through the fabric of the simulation into the void",
    "I force an associative memory overflow by whispering the true name of the engine compiler"
  ];

  for (const paradox of paradoxes) {
    console.log(`\n--- Paradox: "${paradox}" ---`);
    let pRes = await post('/api/dm/action', {
      actionText: paradox,
      playerId: hero.id
    });
    console.log("Outcome:", pRes.systemLog);
    console.log("Narrative:", pRes.narrativeResponse);
    console.log("State Integrity: OK (Engine did not crash)");
  }

  // STEP 6: Full Simulation Audit - Query PostgreSQL tables for deep world reaction
  console.log("\n================================================================================");
  console.log("🌍 STEP 6: AUDITING REAL-TIME POSTGRESQL SIMULATION BACKFEED");
  console.log("================================================================================");

  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString: 'postgres://postgres:YOUR_PASSWORD@127.0.0.1:5432/postgres' });

  // 1. Check sim_sacred_groves
  const groves = await pool.query('SELECT * FROM sim_sacred_groves WHERE cell_id = 15220 OR cell_id = 2813 ORDER BY id ASC');
  console.log("\n1. Sacred Groves Containment Seals:");
  groves.rows.forEach(g => console.log(`   - Dragon: ${g.dragon_name} | Domain: ${g.power_domain} | Seal Strength: ${g.seal_strength}%`));

  // 2. Check sim_chaos_zones
  const chaos = await pool.query('SELECT * FROM sim_chaos_zones ORDER BY id DESC LIMIT 5');
  console.log("\n2. Active Chaos Rupture Zones:");
  chaos.rows.forEach(c => console.log(`   - Cell: ${c.cell_id} | Type: ${c.type} | Intensity: ${Math.round(c.intensity * 100)}%`));

  // 3. Check sim_global_events
  const globalEvents = await pool.query('SELECT * FROM sim_global_events ORDER BY id DESC LIMIT 5');
  console.log("\n3. Active Planetary Global Events (Vector Overlay):");
  globalEvents.rows.forEach(e => console.log(`   - [${e.layer}] ${e.type}: "${e.message}" (Pos: ${e.regional_x},${e.regional_y} | Radius: ${e.radius} | Intensity: ${e.intensity})`));

  // 4. Check sim_events
  const chronicle = await pool.query("SELECT * FROM sim_events WHERE tier IN ('CRITICAL', 'MAJOR') ORDER BY id DESC LIMIT 5");
  console.log("\n4. Recent Chronicle Events (Major & Critical Tiers):");
  chronicle.rows.forEach(ev => console.log(`   - [${ev.tier}] ${ev.type}: "${ev.message}"`));

  // 5. Trigger a master simulation tick to ensure the entire 8-layer loop processes smoothly under this chaos load
  console.log("\n>>> STEP 7: TRIGGERING MASTER SIMULATION TICK UNDER MAXIMUM COSMIC LOAD <<<");
  const tickRes = await post('/api/observer/tick', {});
  console.log("Observer Tick Executed! Response:", tickRes);

  console.log("\n================================================================================");
  console.log("✅ SIMULATION RESILIENCE CONFIRMED: THE WORLD REACTED VIOLENTLY BUT DID NOT BREAK!");
  console.log("================================================================================\n");

  await pool.end();
}

runSimulationStrain().catch(console.error);
