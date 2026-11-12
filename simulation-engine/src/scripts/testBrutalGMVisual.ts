import pool from '../db/pool.js';
import { BrutalGameMaster } from '../engine/rpg/BrutalGM.js';

async function main() {
  console.log("=== Testing BrutalGameMaster & Sector Visual Grounding ===");

  const gm = new BrutalGameMaster(pool);

  // 1. Setup sector mock entities
  gm.activeProps.set("prop_gate", {
    id: "prop_gate",
    name: "Reinforced Iron Gate Checkpoint",
    pos: [128, 128],
    type: "PROP",
    isDestroyed: false,
    tags: new Set(["iron", "gate", "locked"]),
    hp: 120,
    maxHp: 120,
    description: "Heavy iron portcullis"
  });

  gm.activeNPCs.set("npc_fletcher", {
    id: "npc_fletcher",
    name: "Watch Captain Kenneth Fletcher",
    role: "Garrison Watch Captain",
    faction: "Roromijima Municipal Guard",
    pos: [128, 126],
    tags: ["Guard", "Officer"],
    hp: 40,
    maxHp: 40,
    disposition: -1,
    alive: true,
    equippedWeapon: "Garrison Halberd",
    equippedArmor: "Riveted Mail",
    memoryNotes: ["Refuses uninspected transit"]
  });

  // 2. Test Tactical Visual Context Generation
  const dummyGrid = new Uint8Array(256 * 256);
  // Fill ground with cobblestone (4)
  dummyGrid.fill(4);
  // Add stone wall (5) at y=120
  for (let x = 120; x <= 135; x++) {
    dummyGrid[120 * 256 + x] = 5;
  }

  const visualSummary = gm.generateTacticalVisualContext([128, 134], dummyGrid, 0);
  console.log("Visual Summary:\n", visualSummary);

  if (!visualSummary.includes("cobblestone pavement")) {
    throw new Error("Visual context failed to identify cobblestone pavement");
  }
  if (!visualSummary.includes("Reinforced Iron Gate Checkpoint")) {
    throw new Error("Visual context failed to include Reinforced Iron Gate Checkpoint");
  }
  if (!visualSummary.includes("Watch Captain Kenneth Fletcher")) {
    throw new Error("Visual context failed to include Watch Captain Kenneth Fletcher");
  }

  console.log("✅ Visual Tactical Context Test Passed!");
  await pool.end();
}

main().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});

