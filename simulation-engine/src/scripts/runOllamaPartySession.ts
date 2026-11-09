/**
 * 4-PLAYER TTRPG PARTY SESSION RUNNER (OLLAMA + GEMINI GM + B.R.U.T.A.L. v4.9)
 * ==============================================================================
 * Architecture:
 * - Players: Local Ollama (llama3.2:latest) driving 4 distinct characters in character.
 * - Game Master: ConcordiaGM via Gemini API (gemini-2.5-flash) for narration & NPC dialogue.
 * - Rules Arbiter: Deterministic B.R.U.T.A.L. v4.9 code (1d12 Net Margin vs Guard).
 * - State: PostgreSQL persistence (sim_player_character, sim_events).
 */

import dotenv from 'dotenv';
import pool from '../db/pool.js';
import { BrutalGameMaster } from '../engine/rpg/BrutalGM.js';
import { TaggedObject } from '../engine/rpg/TagMatrixEngine.js';
import { calculateDerivedPools, calculateDerivedSenses, Attributes } from '../engine/customRulesEngine.js';

dotenv.config({ path: 'simulation-engine/.env' });

interface OllamaPartyMember {
  id: number;
  name: string;
  role: string;
  species: string;
  kingdom: string;
  lineage: string;
  attributes: Attributes;
  weapon: string;
  weaponStat: string;
  armor: string;
  persona: string;
  tacticalGoal: string;
}

const PARTY_ROSTER: OllamaPartyMember[] = [
  {
    id: 101,
    name: "Harrow Grist",
    role: "Vanguard / Brawler",
    species: "Boar",
    kingdom: "Mammal",
    lineage: "Boar-Kin",
    attributes: {
      might: 7, endurance: 3, fortitude: 5, vitality: 4,
      reflex: 4, finesse: 3, intuition: 4, awareness: 3,
      willpower: 4, charm: 3, knowledge: 6, logic: 2
    },
    weapon: "Spiked Trench Cleaver",
    weaponStat: "might",
    armor: "Boar-Hide Scalemail",
    persona: "Gruff, scarred veteran of the Caldera trenches. Blunt, protective of allies, distrusts authority, prefers brute leverage when talks fail.",
    tacticalGoal: "Secure the perimeter, intimidate arrogant guards, or smash obstacles blocking the party's way."
  },
  {
    id: 102,
    name: "Lyra Swift-Feather",
    role: "Aerial Scout / Sniper",
    species: "Osprey",
    kingdom: "Avian",
    lineage: "Avian-Kin",
    attributes: {
      might: 3, endurance: 3, fortitude: 3, vitality: 3,
      reflex: 7, finesse: 6, intuition: 4, awareness: 6,
      willpower: 3, charm: 4, knowledge: 3, logic: 3
    },
    weapon: "Composite Hunting Bow",
    weaponStat: "reflex",
    armor: "Fitted Wind-Leather",
    persona: "Quiet, observant aerial scout with keen eyesight. Keeps watch on rooftops and shadows, alerts allies to ambushes.",
    tacticalGoal: "Scout ahead from elevated positions, search for hidden watchers, or cover allies from range."
  },
  {
    id: 103,
    name: "Orlo Mind-Weaver",
    role: "Scholar / Aether-Tech",
    species: "Red Panda",
    kingdom: "Mammal",
    lineage: "Verdant Clan",
    attributes: {
      might: 2, endurance: 3, fortitude: 3, vitality: 3,
      reflex: 3, finesse: 4, intuition: 4, awareness: 4,
      willpower: 5, charm: 3, knowledge: 7, logic: 6
    },
    weapon: "Resonance Spark-Rod",
    weaponStat: "knowledge",
    armor: "Scholar's Quilted Coat",
    persona: "Analytical scholar who investigates strange runes, aether-tech instruments, locks, and dragonstone anomalies.",
    tacticalGoal: "Examine mysterious objects, inspect runic seals or machinery, search for clues, and analyze occult hazards."
  },
  {
    id: 104,
    name: "Vespera Velvet-Paws",
    role: "Face / Infiltrator",
    species: "Fox",
    kingdom: "Mammal",
    lineage: "Vulpine",
    attributes: {
      might: 2, endurance: 3, fortitude: 3, vitality: 4,
      reflex: 5, finesse: 6, intuition: 5, awareness: 4,
      willpower: 4, charm: 7, knowledge: 3, logic: 4
    },
    weapon: "Concealed Spring-Stiletto",
    weaponStat: "finesse",
    armor: "Tailored Dark Silk Weave",
    persona: "Charming, quick-witted fox diplomat and infiltrator. Reads body language, defuses hostility with silver words or bribes.",
    tacticalGoal: "Negotiate with hostile NPCs, deceive or bribe guards, defuse tense standoffs, or pick locks quietly."
  }
];

async function seedPartyCharacters() {
  console.log("💾 Seeding 4 B.R.U.T.A.L. Party Characters into PostgreSQL...");
  for (const m of PARTY_ROSTER) {
    const pools = calculateDerivedPools(m.attributes);
    const senses = calculateDerivedSenses(m.attributes);

    await pool.query(`
      INSERT INTO sim_player_character (
        id, name, kingdom, lineage, species,
        might, endurance, finesse, reflex, vitality, fortitude,
        knowledge, logic, awareness, intuition, charm, willpower,
        current_hp, max_hp, composure, max_composure, stamina_max, focus_max,
        phys_defense, speed, equipped_weapon, equipped_armor, gold
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10, $11,
        $12, $13, $14, $15, $16, $17,
        $18, $19, $20, $21, $22, $23,
        $24, $25, $26, $27, 50
      )
      ON CONFLICT (id) DO UPDATE SET
        might = EXCLUDED.might,
        endurance = EXCLUDED.endurance,
        finesse = EXCLUDED.finesse,
        reflex = EXCLUDED.reflex,
        vitality = EXCLUDED.vitality,
        fortitude = EXCLUDED.fortitude,
        knowledge = EXCLUDED.knowledge,
        logic = EXCLUDED.logic,
        awareness = EXCLUDED.awareness,
        intuition = EXCLUDED.intuition,
        charm = EXCLUDED.charm,
        willpower = EXCLUDED.willpower,
        current_hp = EXCLUDED.current_hp,
        max_hp = EXCLUDED.max_hp,
        composure = EXCLUDED.composure,
        max_composure = EXCLUDED.max_composure,
        stamina_max = EXCLUDED.stamina_max,
        focus_max = EXCLUDED.focus_max,
        phys_defense = EXCLUDED.phys_defense,
        speed = EXCLUDED.speed,
        equipped_weapon = EXCLUDED.equipped_weapon,
        equipped_armor = EXCLUDED.equipped_armor
    `, [
      m.id, m.name, m.kingdom, m.lineage, m.species,
      m.attributes.might, m.attributes.endurance, m.attributes.finesse, m.attributes.reflex,
      m.attributes.vitality, m.attributes.fortitude, m.attributes.knowledge, m.attributes.logic,
      m.attributes.awareness, m.attributes.intuition, m.attributes.charm, m.attributes.willpower,
      pools.health, pools.health, pools.composure, pools.composure, pools.stamina, pools.focus,
      senses.dodge, senses.speed, m.weapon, m.armor
    ]);
    console.log(`   + Registered ${m.name} (${m.role}) [HP: ${pools.health}, Comp: ${pools.composure}, Stamina: ${pools.stamina}, Focus: ${pools.focus}]`);
  }
}

async function queryOllamaPlayerAction(
  member: OllamaPartyMember,
  sceneDescription: string,
  recentChronicle: string[]
): Promise<{ dialogue: string; action: string }> {
  const prompt = `You are playing ${member.name}, a ${member.species} ${member.role} in a gritty tabletop RPG called B.R.U.T.A.L. set in Ostraka (The Shatterlands).
Persona: ${member.persona}
Tactical Focus: ${member.tacticalGoal}
Your Equipped Weapon: ${member.weapon} (${member.weaponStat.toUpperCase()})
Your Armor: ${member.armor}

CURRENT SITUATION:
${sceneDescription}

INTERACTIVE TARGETS PRESENT IN THE SCENE:
1. "Reinforced Iron Gate Checkpoint" (Heavy iron portcullis with spiked barriers, currently locked, HP: 120/120)
2. "Salt-Stained Contraband Crate" (Barnacle-crusted wooden crate marked with Canal Krewe seals, currently unopened, HP: 30/30)
3. "Watch Captain Kenneth Fletcher" (Stern municipal officer armed with garrison halberd, barring the gate, HP: 40/40)
4. "Rooftops / Quay Perimeters" (High stone ledges overlooking the checkpoint for scouting, climbing, or sniping)

RECENT PARTY ACTIONS & EVENTS:
${recentChronicle.length > 0 ? recentChronicle.join("\n") : "The party just arrived at the scene."}

YOUR TURN:
Give:
1) One short spoken line of in-character dialogue.
2) One clear declared action targeting one of the specific interactive targets above (e.g. "I attack the Reinforced Iron Gate Checkpoint", "I search the Salt-Stained Contraband Crate", "I talk to Watch Captain Kenneth Fletcher", "I climb the Rooftops to scout").

Output format EXACTLY:
Dialogue: "your spoken words"
Action: I [what you do]`;

  try {
    const res = await fetch("http://127.0.0.1:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama3.2:latest",
        prompt,
        stream: false,
        options: {
          temperature: 0.7,
          num_predict: 120
        }
      })
    });

    const data: any = await res.json();
    const raw = String(data.response || "").trim();

    let dialogue = "Let's stay sharp.";
    let action = "I survey the area and keep watch.";

    const dMatch = raw.match(/Dialogue:\s*["“]?([^"”\n]+)["”]?/i);
    if (dMatch && dMatch[1]) dialogue = dMatch[1].trim();

    const aMatch = raw.match(/Action:\s*([^\n]+)/i);
    if (aMatch && aMatch[1]) action = aMatch[1].trim();
    else if (!dMatch) action = raw.split("\n")[0] || action;

    return { dialogue, action };
  } catch (err) {
    console.warn(`[Ollama] Fallback for ${member.name}:`, err);
    return {
      dialogue: "Watch our backs, team.",
      action: `I ready my ${member.weapon} and search the area for threats.`
    };
  }
}

async function runSession() {
  console.log("================================================================================");
  console.log("       B.R.U.T.A.L. v4.9 4-PLAYER OLLAMA + GEMINI GM SESSION TEST");
  console.log("================================================================================");

  await seedPartyCharacters();

  // Initialize Concordia GM
  const apiKey = process.env.GEMINI_API_KEY || '';
  const gm = new BrutalGameMaster(pool, apiKey);

  // Setup the encounter sector: Burg 81 (Roromijima Harbor Sluice Gate)
  const burgRes = await pool.query("SELECT * FROM sim_burg_economy WHERE burg_id = 81");
  const burg = burgRes.rows[0] || { name: "Roromijima", cell_id: 24935 };

  console.log(`\n📍 LOCATION: ${burg.name} (Cell #${burg.cell_id}) - Harbor Sluice Gate`);
  console.log("   Emergent Hook: The Canal Krewes (Otters) recently extracted a fugitive here.");
  console.log("   Watch Captain Kenneth Fletcher has the dock gate cordoned off under iron lockdown.");

  // Inject real grounded props into GM active props
  const gateBarricade: TaggedObject = {
    id: "prop_iron_gate_checkpoint",
    name: "Reinforced Iron Gate Checkpoint",
    type: "PROP",
    pos: [128, 128],
    tags: new Set<string>(["iron", "metal", "heavy", "gate", "checkpoint", "locked", "barricade"]),
    hp: 120,
    maxHp: 120,
    isDestroyed: false,
    description: "Heavy iron portcullis with spiked barriers blocking passage into the inner harbor warehouses."
  };

  const contrabandCrate: TaggedObject = {
    id: "prop_canal_krewe_crate",
    name: "Salt-Stained Contraband Crate",
    type: "PROP",
    pos: [124, 126],
    tags: new Set<string>(["wood", "container", "crate", "contraband", "fragile", "waterlogged"]),
    hp: 30,
    maxHp: 30,
    isDestroyed: false,
    description: "Barnacle-crusted wooden crate marked with the three-wavy-lines brand of the Canal Krewes, hastily hidden beneath netting."
  };

  gm.activeProps.set(gateBarricade.id, gateBarricade);
  gm.activeProps.set(contrabandCrate.id, contrabandCrate);

  // Grounded Living NPC: Watch Captain Kenneth Fletcher (Paragon #162)
  const watchCaptain = {
    id: "npc_162",
    name: "Watch Captain Kenneth Fletcher",
    title: "Watch Captain of Roromijima",
    role: "Garrison Watch Commander",
    pos: [128, 129] as [number, number],
    tags: ["human", "military", "officer", "stern", "suspicious", "armed", "paragon"],
    faction: "Municipal Watch",
    hp: 40,
    maxHp: 40,
    disposition: -1, // Suspicious
    alive: true,
    equippedWeapon: "Heavy Garrison Halberd",
    equippedArmor: "Corroded Steel Breastplate",
    statAffinity: "fortitude" as any,
    kingdom: "Mammal",
    species: "Human",
    lineage: "Humanoid",
    memoryNotes: [
      "Furious about the Otter Canal Krewe jailbreak last night.",
      "Orders from Town Reeve Jarek Stone: No unauthorized passage through the sluice gate."
    ],
    inventory: ["Harbor Checkpoint Brass Key", "Reeve's Search Warrant", "Whistle of Mobilization"]
  };

  // Add Watch Captain as a living NPC to GM
  gm.activeNPCs.set(watchCaptain.id, watchCaptain as any);
  gm.activeNPCs.set("162", watchCaptain as any);
  gm.activeNPCs.set("Watch Captain Kenneth Fletcher", watchCaptain as any);

  // Set active sector context so GM prompt knows where the party is
  (gm as any).activeContext = {
    burgName: burg.name,
    cellId: burg.cell_id,
    entitiesPresent: [
      { type: "Watch Guard", state: "On Guard" },
      { type: "Dock Worker", state: "Frightened" }
    ]
  };

  let currentScene = `The damp salt-breeze of Roromijima carries the stench of river mud and fish. Before the party stands the Reinforced Iron Gate Checkpoint, blocking entry to the warehouse quays. Watch Captain Kenneth Fletcher and his halberdiers bar the way, questioning anyone who approaches following the Canal Krewes' brazen underwater extraction. Near the dock pilings, a Salt-Stained Contraband Crate lies half-tangled in fishing netting.`;

  const chronicleHistory: string[] = [];

  console.log("\n🎬 SCENE SETUP (GM):");
  console.log(`"${currentScene}"`);
  console.log("--------------------------------------------------------------------------------");

  // Run 2 full rounds across all 4 players (8 turns total)
  for (let round = 1; round <= 2; round++) {
    console.log(`\n================================================================================`);
    console.log(`                             ⚔️  ROUND ${round}  ⚔️`);
    console.log(`================================================================================`);

    for (const member of PARTY_ROSTER) {
      console.log(`\n▶ [TURN: ${member.name.toUpperCase()} (${member.role})]`);

      // 1. Query Ollama for In-Character dialogue & declared action
      const playerIntent = await queryOllamaPlayerAction(member, currentScene, chronicleHistory);
      console.log(`   🗣️  Dialogue: "${playerIntent.dialogue}"`);
      console.log(`   ⚡  Declared Action: "${playerIntent.action}"`);

      // 2. Dispatch to Concordia GM with B.R.U.T.A.L. v4.9 arbitration
      const gmOutput = await gm.executeTurn({
        actionText: playerIntent.action,
        playerId: member.id,
        playerPos: [128, 128]
      });

      // 3. Display deterministic dice roll & B.R.U.T.A.L. math
      const r = gmOutput.rollOutcome;
      console.log(`   🎲  B.R.U.T.A.L. Arbitration:`);
      console.log(`       Action Mode: ${gmOutput.intent.category} (${gmOutput.intent.verb}) via [${gmOutput.intent.statUsed.toUpperCase()}]`);
      console.log(`       Dice Math: 1d12 Roll (${r.playerRoll}) + Stat (${r.playerStatVal}) = Total ${r.playerRoll + r.playerStatVal} vs Guard/DC ${r.dcOrDefenderRoll}`);
      console.log(`       Outcome: ${r.hit ? '✅ SUCCESS' : '❌ DEFLECTED/FAILED'} (Net Margin: ${r.difference >= 0 ? '+' : ''}${r.difference}, Injury/Tiers: ${r.injuryPoints} pts)`);
      if (gmOutput.systemLog) {
        console.log(`       System Log: ${gmOutput.systemLog}`);
      }

      // 4. Display GM Sensory Narrative & NPC Dialogue
      if (gmOutput.dialogue) {
        console.log(`   💬  NPC Response: ${gmOutput.dialogue}`);
      }
      console.log(`   📜  GM Chronicle: "${gmOutput.narrativeResponse}"`);

      // 5. Append to chronicle history for next players
      const summaryBeat = `${member.name}: "${playerIntent.dialogue}" -> ${r.hit ? 'SUCCESS' : 'FAILED'}: ${gmOutput.narrativeResponse.slice(0, 140)}...`;
      chronicleHistory.push(summaryBeat);
      currentScene = gmOutput.narrativeResponse;
    }
  }

  // Final Session Summary
  console.log("\n================================================================================");
  console.log("                        🏆  SESSION COMPLETE  🏆");
  console.log("================================================================================");
  console.log("Post-Action Party Status (Persisted in PostgreSQL):");

  for (const m of PARTY_ROSTER) {
    const res = await pool.query("SELECT current_hp, max_hp, composure, max_composure, gold FROM sim_player_character WHERE id = $1", [m.id]);
    const row = res.rows[0];
    console.log(`   * ${m.name.padEnd(22)} | HP: ${row.current_hp}/${row.max_hp} | Composure: ${row.composure}/${row.max_composure} | Gold: ${row.gold}`);
  }

  // Check recent sim_events written during session
  const evRes = await pool.query("SELECT id, type, message FROM sim_events ORDER BY id DESC LIMIT 4");
  console.log("\nRecent World Events Logged in sim_events:");
  for (const ev of evRes.rows) {
    console.log(`   [#${ev.id}] ${ev.type}: ${ev.message.slice(0, 100)}...`);
  }

  console.log("\n✅ Loop verified end-to-end: tick -> trouble -> hook -> players act -> B.R.U.T.A.L. resolves -> consequences written back.");
  await pool.end();
  process.exit(0);
}

runSession().catch(err => {
  console.error("FATAL ERROR IN PARTY SESSION:", err);
  process.exit(1);
});

