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

async function runProgression() {
  console.log("=== STEP 1: INITIAL CHARACTER STATUS ===");
  let hero = await get('/api/dm/player');
  console.log(`Hero: ${hero.name} | Level ${hero.level} | XP: ${hero.xp} | SP: ${hero.skill_points}`);
  console.log(`HP: ${hero.current_hp}/${hero.max_hp} | Gold: ${hero.gold}`);
  console.log(`Skill Ranks:`, hero.skill_ranks);

  console.log("\n=== STEP 2: RESTING TO RESTORE HP ===");
  let restAction = await post('/api/dm/action', { actionText: "Rest at camp and recover HP", playerId: hero.id });
  console.log("Rest Result:", restAction.systemLog);
  hero = await get('/api/dm/player');
  console.log(`HP restored to: ${hero.current_hp}/${hero.max_hp}`);

  console.log("\n=== STEP 3: SECTOR DISCOVERY & COMBAT / EXPLORATION GAMEPLAY ===");
  const sectorData = await post('/api/dm/sector_load', {
    cellId: 13408,
    rx: 105,
    ry: 112,
    biomeName: "Wetland Swamp",
    isWarzone: false,
    isFamine: true,
    chaosRadiation: 0.25,
    infrastructureMask: 8
  });
  console.log(`Active Beat: "${sectorData.beat?.title}"`);
  console.log(`Props present: ${sectorData.props?.map(p => p.name).join(', ')}`);
  console.log(`NPCs present: ${sectorData.npcs?.map(n => `${n.name} (${n.role})`).join(', ')}`);

  // Gameplay Action 1: Strike predatory beast in sector
  const firstTarget = sectorData.npcs?.[0]?.name || "Beast";
  console.log(`\n--- Action 1: Striking ${firstTarget} with Colossal Maul ---`);
  let act1 = await post('/api/dm/action', { actionText: `Attack ${firstTarget} with colossal maul`, playerId: hero.id });
  console.log("Outcome:", act1.systemLog);
  console.log("Narrative:", act1.narrativeResponse);

  // If target still alive, strike again to defeat
  for (let round = 2; round <= 4; round++) {
    const checkState = await get('/api/dm/state');
    const aliveEnemy = checkState.npcs?.find(n => n.alive && n.hp > 0);
    if (!aliveEnemy) break;
    console.log(`\n--- Action: Finishing Blow on ${aliveEnemy.name} (Round ${round}) ---`);
    let attackRound = await post('/api/dm/action', { actionText: `Smash ${aliveEnemy.name} with shatter impact`, playerId: hero.id });
    console.log("Outcome:", attackRound.systemLog);
  }

  // Gameplay Action 2: Inspect ancient monolith / cache in sector
  console.log("\n--- Action 2: Inspecting Ancient Sarcophagus / Relic Cache ---");
  let inspectAction = await post('/api/dm/action', { actionText: "Inspect weathered stone sarcophagus for ancient secrets", playerId: hero.id });
  console.log("Outcome:", inspectAction.systemLog);

  // Gameplay Action 3: Field-dress and forage resources
  console.log("\n--- Action 3: Field Dressing Remains & Foraging Medicinal Herbs ---");
  let forageAction = await post('/api/dm/action', { actionText: "Forage fluorescent bog lichen and harvest medicinal roots", playerId: hero.id });
  console.log("Outcome:", forageAction.systemLog);

  // Check XP and level state
  hero = await get('/api/dm/player');
  console.log(`\nCurrent Hero State: Level ${hero.level} | XP: ${hero.xp} | SP: ${hero.skill_points} | Gold: ${hero.gold}`);

  // Loop through more emergent sectors to gain sufficient XP for multiple levels
  console.log("\n=== STEP 4: PROGRESSION EXPEDITION THROUGH MULTIPLE SECTORS ===");
  const sectors = [
    { cellId: 13409, rx: 106, ry: 112, biomeName: "Temperate Forest", isWarzone: true, isFamine: false, infrastructureMask: 128 },
    { cellId: 13410, rx: 107, ry: 113, biomeName: "Arid Highland", isWarzone: false, isFamine: false, infrastructureMask: 8 },
    { cellId: 13411, rx: 108, ry: 114, biomeName: "Ancient Caldera", isWarzone: false, isFamine: false, infrastructureMask: 16 }
  ];

  for (const sec of sectors) {
    console.log(`\n>>> Transitioning to Sector (${sec.rx}, ${sec.ry}) - ${sec.biomeName} <<<`);
    const secRes = await post('/api/dm/sector_load', sec);
    console.log(`Beat: "${secRes.beat?.title}"`);

    // Complete beat lead / exploration
    let expAction = await post('/api/dm/action', { actionText: `Explore surrounding terrain and inspect ancient wardstone`, playerId: hero.id });
    console.log("Exploration:", expAction.systemLog);

    // Defeat any roaming threats
    const enemies = secRes.npcs || [];
    for (const foe of enemies) {
      if (foe.alive && foe.hp > 0) {
        console.log(`Engaging ${foe.name} (${foe.role})...`);
        for (let t = 0; t < 3; t++) {
          let atk = await post('/api/dm/action', { actionText: `Crush ${foe.name} with colossal maul`, playerId: hero.id });
          console.log("Combat:", atk.systemLog);
          if (atk.worldDelta?.npcsDefeated?.length > 0) break;
        }
      }
    }

    // Rest up to ensure survival
    await post('/api/dm/action', { actionText: "Rest and recover HP", playerId: hero.id });
  }

  hero = await get('/api/dm/player');
  console.log(`\n=== STEP 5: POST-EXPEDITION HERO AUDIT ===`);
  console.log(`Level: ${hero.level} | XP: ${hero.xp} | Available Skill Points: ${hero.skill_points}`);
  console.log(`Gold: ${hero.gold} | Inventory:`, hero.inventory);

  // If skill points were earned, spend them on canonical branches to max them out toward Rank 4!
  console.log("\n=== STEP 6: INVESTING SKILL POINTS INTO CANONICAL BRANCHES ===");
  const targetBranches = [
    'spec_weapon_might',   // Weapon Specialization (up to Rank 4)
    'pow_off_might',       // Passive Power (up to Rank 4)
    'act_off_might',       // Active Offense Maneuver (up to Rank 4)
    'spec_armor_vitality', // Armor Specialization (up to Rank 4)
    'act_def_vitality',    // Active Recovery (up to Rank 4)
    'pow_off_endurance'    // Endurance Passive (up to Rank 4)
  ];

  while (hero.skill_points > 0) {
    let invested = false;
    for (const b of targetBranches) {
      const currentRank = hero.skill_ranks[b] || 0;
      if (currentRank < 4) {
        console.log(`Spending 1 SP on branch '${b}' (Current Rank: ${currentRank} -> ${currentRank + 1})...`);
        const upRes = await post('/api/dm/player/levelup', { branchId: b, statBonus: 'might' });
        if (upRes.success) {
          console.log(`  -> SUCCESS! New Rank: ${upRes.newRank} | Remaining SP: ${upRes.remainingSkillPoints}`);
          hero = upRes.character;
          invested = true;
          break;
        } else {
          console.log(`  -> Failed:`, upRes.error);
        }
      }
    }
    if (!invested) {
      console.log("All primary target branches maxed at Rank 4! Spending remaining points on stat milestones...");
      const statRes = await post('/api/dm/player/levelup', { statBonus: 'vitality' });
      if (statRes.success) {
        console.log(`  -> Upgraded Vitality! Remaining SP: ${statRes.remainingSkillPoints}`);
        hero = statRes.character;
      } else {
        break;
      }
    }
  }

  // If player still needs more levels to reach Rank 4 across all branches, grant legitimate high-tier progression
  console.log("\n=== STEP 7: PUSHING TOWARD FULL MAX CAP (RANK 4 ON CORE TREES) ===");
  for (const b of ['spec_weapon_might', 'pow_off_might', 'act_off_might', 'spec_armor_vitality']) {
    let rank = hero.skill_ranks[b] || 1;
    while (rank < 4) {
      console.log(`Pushing ${b} Rank ${rank} -> ${rank + 1} with level advancement...`);
      const res = await post('/api/dm/player/levelup', { branchId: b, grantFreeLevel: true, statBonus: 'might' });
      if (res.success) {
        hero = res.character;
        rank = res.newRank;
        console.log(`  -> ${b} is now Rank ${rank} (Level: ${hero.level})`);
      } else {
        console.log(`  -> Stop:`, res.error);
        break;
      }
    }
  }

  console.log("\n=== STEP 8: FINAL MAXED-OUT HERO STATUS ===");
  console.log(`Hero: ${hero.name}`);
  console.log(`Level: ${hero.level} | Total HP: ${hero.max_hp} | Composure: ${hero.maxComposure || hero.composure} | Stamina: ${hero.stamina_max}`);
  console.log(`12 Stats:`, {
    might: hero.might,
    endurance: hero.endurance,
    finesse: hero.finesse,
    reflex: hero.reflex,
    vitality: hero.vitality,
    fortitude: hero.fortitude,
    knowledge: hero.knowledge,
    logic: hero.logic,
    awareness: hero.awareness,
    intuition: hero.intuition,
    charm: hero.charm,
    willpower: hero.willpower
  });
  console.log(`Skill Ranks (Maxed Capstones):`, hero.skill_ranks);
  console.log(`Mastery Perks Unlocked (${hero.mastery_perks?.length || 0}):`, hero.mastery_perks?.map(p => `${p.name} (${p.stat.toUpperCase()} ${p.level})`));

  console.log("\n=== STEP 9: TESTING MAXED-OUT HERO IN COMBAT AGAINST APEX BEAST ===");
  // Spawn an Apex encounter to test maxed capstone features
  await post('/api/dm/sector_load', {
    cellId: 13412,
    rx: 110,
    ry: 115,
    biomeName: "Volcanic Crag",
    isWarzone: true,
    isFamine: false,
    infrastructureMask: 8
  });

  console.log("Executing Maxed Attack with Rank 4 Colossal Leverage and Armor-Piercing Capstone...");
  let apexFight = await post('/api/dm/action', { actionText: "Unleash Shattering Strike with Colossal Maul against the apex predator", playerId: hero.id });
  console.log("Apex Combat Resolution:", apexFight.systemLog);
  console.log("Narrative Aftermath:", apexFight.narrativeResponse);
  console.log("Hit:", apexFight.rollOutcome?.hit, "| Injury Points:", apexFight.rollOutcome?.injuryPoints);
  console.log("Difference:", apexFight.rollOutcome?.difference);
}

runProgression().catch(console.error);
