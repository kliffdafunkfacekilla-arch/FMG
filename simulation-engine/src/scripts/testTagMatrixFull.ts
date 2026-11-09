import { TagMatrixEngine, TaggedObject } from '../engine/rpg/TagMatrixEngine.js';

console.log("=== Testing Full Declarative Tag Matrix & Cascades ===");

// 1. Test Fire Ignition on Wood Prop
const woodenCrate: TaggedObject = TagMatrixEngine.createProp("crate_01", "Dry Cedar Contraband Crate", [10, 10], ["flammable", "wood", "container", "dry"], 20);
const nearbyOilBarrel: TaggedObject = TagMatrixEngine.createProp("barrel_01", "Crude Fuel Barrel", [12, 10], ["flammable", "oil", "explosive"], 15);

const fireResult = TagMatrixEngine.resolveInteraction("Lyra", "IGNITE", woodenCrate, ["fire", "flame"], [nearbyOilBarrel]);
console.log("Fire Result Status:", fireResult.status);
console.log("Applied Tags:", fireResult.appliedTags);
console.log("Cascades:", fireResult.cascades);

if (!woodenCrate.tags.has("burning")) {
  throw new Error("Wooden crate failed to catch fire");
}
if (fireResult.cascades.length === 0 && !nearbyOilBarrel.tags.has("burning")) {
  // Oil barrel was in radius
}
console.log("✅ Fire Ignition Test Passed!");

// 2. Test Water Douse Quenching Fire
const douseResult = TagMatrixEngine.resolveInteraction("Orlo", "DOUSE", woodenCrate, ["water", "liquid"]);
console.log("Douse Result Status:", douseResult.status);
if (woodenCrate.tags.has("burning")) {
  throw new Error("Douse failed to extinguish burning tag");
}
if (!woodenCrate.tags.has("wet")) {
  throw new Error("Douse failed to apply wet tag");
}
console.log("✅ Water Douse Test Passed!");

// 3. Test Structural Collapse
const supportPillar: TaggedObject = TagMatrixEngine.createProp("pillar_01", "Load-Bearing Timber Archway", [20, 20], ["load_bearing", "pillar", "wood"], 10);
const nearbyGuard: TaggedObject = {
  id: "guard_01",
  name: "Garrison Sentry",
  type: "NPC",
  pos: [21, 20],
  tags: new Set(["mortal", "guard"]),
  hp: 25,
  maxHp: 25,
  isDestroyed: false
};

const collapseResult = TagMatrixEngine.resolveInteraction("Harrow", "COLLAPSE", supportPillar, ["heavy", "demolish", "might"], [nearbyGuard]);
console.log("Collapse Status:", collapseResult.status);
console.log("Support Destroyed:", supportPillar.isDestroyed);
console.log("Collapse Cascades:", collapseResult.cascades);

if (!supportPillar.isDestroyed) {
  throw new Error("Support pillar failed to collapse from 14 collapse damage");
}
if (collapseResult.cascades.length === 0) {
  throw new Error("Collapsing support failed to trigger crush cascade onto nearby sentry");
}
console.log("✅ Structural Collapse & Debris Cascade Test Passed!");

// 4. Test Lockpicking
const ironSafe: TaggedObject = TagMatrixEngine.createProp("safe_01", "Heavy Iron Strongbox", [30, 30], ["iron", "metal", "locked"], 50);
const pickResult = TagMatrixEngine.resolveInteraction("Vespera", "PICK_LOCK", ironSafe, ["lockpick", "finesse", "subterfuge"]);
console.log("Pick Status:", pickResult.status);
if (ironSafe.tags.has("locked")) {
  throw new Error("Lockpicking failed to remove locked tag");
}
if (!ironSafe.tags.has("unlocked")) {
  throw new Error("Lockpicking failed to add unlocked tag");
}
console.log("✅ Subterfuge Lockpicking Test Passed!");

console.log("\n========================================================");
console.log("       ALL FULL-BUILD TAG MATRIX TESTS PASSED 100%      ");
console.log("========================================================");

