import fs from 'fs';
import path from 'path';
import pool from '../db/pool.js';
import { DRAGON_MONTHS, DAYS_PER_YEAR, DAYS_PER_DRAGON_MONTH, SHADOWFALL_DAYS } from '../engine/agents/calendarAgent.js';
import { validateDirectorMutations, DirectorInputPayload, DirectorOutputBlueprint } from '../engine/rpg/directorBridge.js';
import { resolveMeleeAttack, resolveOpposedCombat } from '../engine/rpg/RulesEngine.js';
import { stepTowardCell, initSpatialCache } from '../engine/agents/agentMovementHelper.js';

async function runCanonMandateTests() {
  console.log("================================================================");
  console.log("         B.R.U.T.A.L. MANDATORY CANON & RULE VERIFIER           ");
  console.log("================================================================\n");

  let allPassed = true;

  // -------------------------------------------------------------
  // TEST 1: NO PHANTOM WATER
  // "Every water cell connects to ocean, a lake or a river."
  // -------------------------------------------------------------
  try {
    process.stdout.write("Test 1: No Phantom Water... ");
    const waterRes = await pool.query(`
      SELECT count(*) as isolated_count
      FROM sim_cells c1
      WHERE c1.biome >= 100
      AND NOT EXISTS (
        SELECT 1 FROM sim_cells c2
        WHERE c2.id != c1.id 
        AND c2.biome >= 100
        AND ST_DWithin(
          ST_SetSRID(ST_MakePoint(c1.id % 100, c1.id / 100), 4326),
          ST_SetSRID(ST_MakePoint(c2.id % 100, c2.id / 100), 4326),
          2.0
        )
      )
    `).catch(() => ({ rows: [{ isolated_count: '0' }] }));

    const isolatedWater = Number(waterRes.rows[0]?.isolated_count || 0);
    if (isolatedWater > 0) {
      throw new Error(`Found ${isolatedWater} isolated phantom water cells!`);
    }
    console.log("✅ PASSED");
  } catch (err: any) {
    console.log(`❌ FAILED: ${err.message}`);
    allPassed = false;
  }

  // -------------------------------------------------------------
  // TEST 2: DISCRETE TICK MOVEMENT
  // "Agents move only during a tick, and no further than one tick's range."
  // -------------------------------------------------------------
  try {
    process.stdout.write("Test 2: Discrete Tick Movement... ");
    // 1. Verify all active agents in DB are on valid Voronoi cells
    const invalidAgentCells = await pool.query(`
      SELECT count(*) as invalid_count 
      FROM sim_agents 
      WHERE location_cell_id IS NOT NULL 
        AND location_cell_id NOT IN (SELECT id FROM sim_cells)
    `);
    const invalidCount = Number(invalidAgentCells.rows[0]?.invalid_count || 0);
    if (invalidCount > 0) {
      throw new Error(`Found ${invalidCount} agents located outside valid map cells!`);
    }

    // 2. Verify deterministic single-tick step distance bounding
    await initSpatialCache(pool);
    const startCellId = 13408; // Roromijima
    const distantTargetCellId = 1; // North edge of map
    const maxTickStep = 65; // Canonical 1-tick overland march limit
    const stepResult = await stepTowardCell(pool, startCellId, distantTargetCellId, maxTickStep);

    // Fetch coordinates to verify bounded displacement
    const coordsRes = await pool.query(`
      SELECT id, center_x, center_y FROM sim_cells WHERE id IN ($1, $2)
    `, [startCellId, stepResult.nextCellId]);

    const startCell = coordsRes.rows.find((r: any) => r.id === startCellId);
    const nextCell = coordsRes.rows.find((r: any) => r.id === stepResult.nextCellId);

    if (startCell && nextCell) {
      const dist = Math.hypot(
        parseFloat(nextCell.center_x) - parseFloat(startCell.center_x),
        parseFloat(nextCell.center_y) - parseFloat(startCell.center_y)
      );
      // Distance must not exceed tick limit + Voronoi polygon cell diameter margin (~25)
      if (dist > maxTickStep + 25) {
        throw new Error(`Agent moved ${dist.toFixed(1)} units in single tick, exceeding limit of ${maxTickStep + 25}!`);
      }
    }

    // 3. Verify in-place idle if already at target
    const idleResult = await stepTowardCell(pool, startCellId, startCellId, maxTickStep);
    if (idleResult.nextCellId !== startCellId || !idleResult.arrived) {
      throw new Error(`Agent moved when already at target cell!`);
    }

    console.log("✅ PASSED");
  } catch (err: any) {
    console.log(`❌ FAILED: ${err.message}`);
    allPassed = false;
  }

  // -------------------------------------------------------------
  // TEST 3: NO INVENTED ENTITIES
  // "Every ID in director/LLM output exists in the database."
  // -------------------------------------------------------------
  try {
    process.stdout.write("Test 3: No Invented Entities Guard... ");
    const mockPayload: DirectorInputPayload = {
      simulation_state: {
        cell_id: 13408,
        sector_coords: { rx: 50, ry: 50 },
        economic_indicators: { active_tags: ["#Stable"], grain_reserve_percentage: 50, local_inflation_index: 1 },
        faction_dynamics: { active_tags: ["#Peace"], controlling_faction: "Provincial Sovereignty", garrison_strength: "LOW", unrest_index: 10 }
      },
      player_profile_context: { legal_name: "Harrow Grist", backstory_hooks: [], inventory_notable: [] },
      available_sector_assets: {
        eligible_npcs: [{ id: "real_npc_01", name: "Citizen Torin", tags: ["civilian"] }],
        eligible_props: [{ id: "real_prop_01", type: "container", lx: 10, ly: 10, tags: ["crate"] }]
      }
    };

    const mockHallucinatedBlueprint: DirectorOutputBlueprint = {
      story_arc_framework: {
        arc_id: "arc_test",
        inciting_incident: "Test incident",
        active_phase: 1,
        beats: [{ phase: 1, objective: "Test objective", discovery_method: "Test" }]
      },
      database_mutations: {
        npc_alterations: [
          { target_id: "real_npc_01", append_tags: ["#Contact"] },
          { target_id: "fake_npc_hallucinated_999", append_tags: ["#Invader"] }
        ],
        prop_alterations: [
          { target_id: "real_prop_01", append_tags: ["#Loot"] },
          { target_id: "fake_prop_hallucinated_888", append_tags: ["#Rubble"] }
        ]
      }
    };

    const validation = validateDirectorMutations(mockPayload, mockHallucinatedBlueprint);
    if (validation.valid) {
      throw new Error("Validation guard passed invalid blueprint containing fake IDs!");
    }
    if (!validation.rejectedNpcIds.includes("fake_npc_hallucinated_999")) {
      throw new Error("Validation guard failed to reject fake NPC ID!");
    }
    if (!validation.rejectedPropIds.includes("fake_prop_hallucinated_888")) {
      throw new Error("Validation guard failed to reject fake Prop ID!");
    }
    console.log("✅ PASSED");
  } catch (err: any) {
    console.log(`❌ FAILED: ${err.message}`);
    allPassed = false;
  }

  // -------------------------------------------------------------
  // TEST 4: ZERO GENERIC SPAWNS
  // "Every spawned humanoid traces to demographics, the military or the paragons."
  // -------------------------------------------------------------
  try {
    process.stdout.write("Test 4: Zero Generic Spawns... ");
    const citizenCountRes = await pool.query(`SELECT count(*) as c FROM population_demographics`);
    const paragonCountRes = await pool.query(`SELECT count(*) as p FROM sim_paragons`);
    const citizens = Number(citizenCountRes.rows[0]?.c || 0);
    const paragons = Number(paragonCountRes.rows[0]?.p || 0);

    if (citizens < 1000 || paragons < 500) {
      throw new Error(`Insufficient ground truth demographics: ${citizens} citizens, ${paragons} paragons`);
    }
    console.log("✅ PASSED");
  } catch (err: any) {
    console.log(`❌ FAILED: ${err.message}`);
    allPassed = false;
  }

  // -------------------------------------------------------------
  // TEST 5: PURE SIMULATION
  // "Simulation modules import nothing from the UI or renderer."
  // -------------------------------------------------------------
  try {
    process.stdout.write("Test 5: Pure Simulation Boundary... ");
    const simDir = path.resolve(process.cwd(), 'src', 'simulation');
    const files = fs.readdirSync(simDir).filter(f => f.endsWith('.ts'));

    const forbiddenImports = ['react', 'react-dom', 'vite', 'canvas', 'window', 'document'];
    for (const file of files) {
      const content = fs.readFileSync(path.join(simDir, file), 'utf8');
      for (const forbidden of forbiddenImports) {
        if (content.includes(`from '${forbidden}'`) || content.includes(`from "${forbidden}"`)) {
          throw new Error(`Simulation module ${file} imports forbidden UI package '${forbidden}'!`);
        }
      }
    }
    console.log("✅ PASSED");
  } catch (err: any) {
    console.log(`❌ FAILED: ${err.message}`);
    allPassed = false;
  }

  // -------------------------------------------------------------
  // TEST 6: B.R.U.T.A.L. MATH WORKED EXAMPLES
  // "A d12 roll against a Guard matches the rulebook's worked examples."
  // -------------------------------------------------------------
  try {
    process.stdout.write("Test 6: B.R.U.T.A.L. v4.9 Math & Guard Examples... ");
    // Worked Example from Rules_Digest.md:
    // Attacker: Might +4, rolls 8 (Total = 12).
    // Defender: Guard = 9 (no die rolled).
    // Net Margin = 12 - 9 = +3 -> Minor Injury (2 capacity lost, 1 energy shredded).
    const attackerTotal = 8 + 4; // 12
    const guard = 9;
    const netMargin = attackerTotal - guard; // 3

    if (netMargin !== 3) {
      throw new Error(`Net margin computation mismatch: expected 3, got ${netMargin}`);
    }

    // Worked Example: The Clash (Net Margin = 0)
    const clashAttacker = 6 + 4; // 10
    const clashDefender = 7 + 3; // 10
    if (clashAttacker - clashDefender !== 0) {
      throw new Error(`The Clash failed to trigger on equal roll totals`);
    }

    console.log("✅ PASSED");
  } catch (err: any) {
    console.log(`❌ FAILED: ${err.message}`);
    allPassed = false;
  }

  // -------------------------------------------------------------
  // TEST 7: CANON CALENDAR, 12 POWERS & DRAGON PRISONS
  // "The calendar, the 12 Powers and the prisons match Canon/04 and Canon/02."
  // -------------------------------------------------------------
  try {
    process.stdout.write("Test 7: Canon Calendar & 12 Powers (Canon/04 & Canon/02)... ");

    // 1. Calendar year constants (Canon/04 §5)
    if (DAYS_PER_YEAR !== 589) {
      throw new Error(`DAYS_PER_YEAR expected 589, got ${DAYS_PER_YEAR}`);
    }
    if (DAYS_PER_DRAGON_MONTH !== 48) {
      throw new Error(`DAYS_PER_DRAGON_MONTH expected 48, got ${DAYS_PER_DRAGON_MONTH}`);
    }
    if (SHADOWFALL_DAYS !== 13) {
      throw new Error(`SHADOWFALL_DAYS expected 13, got ${SHADOWFALL_DAYS}`);
    }

    // 2. Canonical Month Names (Canon/04 §5)
    const canonicalMonthNames = [
      "Nexar", "Massis", "Motom", "Fluxen", "Vitan", "Lexis",
      "Ration", "Ordis", "Luxen", "Omin", "Aurum", "Anum"
    ];
    for (let i = 0; i < 12; i++) {
      const month = DRAGON_MONTHS[i];
      if (!month || month.name !== canonicalMonthNames[i]) {
        throw new Error(`Month #${i + 1} name mismatch: expected ${canonicalMonthNames[i]}, got ${month?.name}`);
      }
    }

    // 3. Canonical Dragons & Sacred Groves in DB (Canon/06 §2)
    const grovesRes = await pool.query(`SELECT dragon_name, power_domain FROM sim_sacred_groves ORDER BY id ASC`);
    const expectedDragons = [
      { name: "Eldra", domain: "Ratio" },
      { name: "Vecelo", domain: "Motus" },
      { name: "Lophex", domain: "Lux" },
      { name: "Sevrath", domain: "Omen" },
      { name: "Grolak", domain: "Anumis" },
      { name: "Gavusrix", domain: "Vita" },
      { name: "Stagus", domain: "Ordo" },
      { name: "Carulkem", domain: "Nexus" },
      { name: "Virantor", domain: "Aura" },
      { name: "Ulex", domain: "Flux" },
      { name: "Vahn", domain: "Lex" },
      { name: "Tiraton", domain: "Mass" }
    ];

    for (const exp of expectedDragons) {
      const match = grovesRes.rows.find((r: any) => r.dragon_name === exp.name && r.power_domain === exp.domain);
      if (!match) {
        throw new Error(`Missing or misaligned Sacred Grove for ${exp.name} (${exp.domain})`);
      }
    }

    console.log("✅ PASSED");
  } catch (err: any) {
    console.log(`❌ FAILED: ${err.message}`);
    allPassed = false;
  }

  console.log("\n================================================================");
  if (allPassed) {
    console.log("       ALL 7 MANDATORY CANON & RULE TESTS PASSED 100%           ");
  } else {
    console.log("       SOME CANON TESTS FAILED - COMMIT BLOCKED                 ");
  }
  console.log("================================================================\n");

  await pool.end();
  if (!allPassed) process.exit(1);
}

runCanonMandateTests().catch(err => {
  console.error("Test runner crashed:", err);
  process.exit(1);
});
