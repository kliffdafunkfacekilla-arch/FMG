const fs = require('fs');
let orch = fs.readFileSync('src/engine/masterOrchestrator.ts', 'utf8');

const harvestTarget = `                      const coveredWorkers = Math.min(effectiveWorkers, infraCapacity);
                      const uncoveredWorkers = Math.max(0, effectiveWorkers - infraCapacity);
                      
                      const finalAmt = (coveredWorkers * 2) + (uncoveredWorkers * 1);
                      if (finalAmt > 0) {
                          addItem(res, finalAmt);
                          if (res === "wood")
                              stockpile.raw_wood += finalAmt;
                          else if (["iron", "copper", "gold", "silver"].includes(res))
                              stockpile.raw_ore += finalAmt;
                          else if (res === "fibre")
                              stockpile.raw_fiber += finalAmt;
                          else if (res === "herbs")
                              stockpile.raw_herbs += finalAmt;
                      }
                  }
              }`;

const harvestReplace = `                      const coveredWorkers = Math.min(effectiveWorkers, infraCapacity);
                      const uncoveredWorkers = Math.max(0, effectiveWorkers - infraCapacity);
                      
                      const finalAmt = (coveredWorkers * 2) + (uncoveredWorkers * 1);
                      if (finalAmt > 0) {
                          addItem(res, finalAmt);
                          if (res === "wood")
                              stockpile.raw_wood += finalAmt;
                          else if (["iron", "copper", "gold", "silver"].includes(res))
                              stockpile.raw_ore += finalAmt;
                          else if (res === "fibre")
                              stockpile.raw_fiber += finalAmt;
                          else if (res === "herbs")
                              stockpile.raw_herbs += finalAmt;
                      }

                      // THE TOLL OF LABOR: Manual labor in dangerous jobs degrades health and happiness
                      const dangerMult = ["iron", "stone", "copper", "gold", "silver", "dragon_stone_shard", "poison"].includes(res) ? 2.0 : 1.0;
                      laborHealthDrain += ((uncoveredWorkers * 0.05) + (coveredWorkers * 0.01)) * dangerMult;
                      laborUnrestSpike += ((uncoveredWorkers * 0.08) + (coveredWorkers * 0.02)) * dangerMult;
                  }
              }`;

orch = orch.replace(harvestTarget, harvestReplace);

// We need to initialize laborHealthDrain and laborUnrestSpike before the profile loop.
const profileLoopTarget = `              // --- HARVESTING (Flora/Fauna & Quantitative Ecology) ---
              if (profile.slots && profile.slots.length > 0) {
                  const totalBaseSlots = profile.slots.reduce((sum: number, s: any) => sum + s.workers, 0) || 1;`;

const profileLoopReplace = `              // --- HARVESTING (Flora/Fauna & Quantitative Ecology) ---
              let laborHealthDrain = 0;
              let laborUnrestSpike = 0;
              if (profile.slots && profile.slots.length > 0) {
                  const totalBaseSlots = profile.slots.reduce((sum: number, s: any) => sum + s.workers, 0) || 1;`;

orch = orch.replace(profileLoopTarget, profileLoopReplace);

// Now apply the counter-balance right after the loop.
const applyTarget = `              // L-7: Stockpile decay - excess beyond storage cap decays each tick`;

const applyReplace = `              // --- THE VACUUM OF NEED (Counter-balancing the Toll of Labor) ---
              const popFactor = Math.max(1, popSize / 100); 
              let normalizedHealthDrain = laborHealthDrain / popFactor;
              let normalizedUnrestSpike = laborUnrestSpike / popFactor;

              // Services & Goods naturally offset the pain of labor. If they run out, misery spikes.
              if (normalizedUnrestSpike > 0) {
                  if ((inv['spice'] || 0) >= 1) { inv['spice']--; normalizedUnrestSpike = Math.max(0, normalizedUnrestSpike - 1); }
                  if ((inv['narcotic'] || 0) >= 1) { inv['narcotic']--; normalizedUnrestSpike = Math.max(0, normalizedUnrestSpike - 2); }
                  if (types.has('TEMPLE')) { normalizedUnrestSpike = Math.max(0, normalizedUnrestSpike - 0.5); }
              }
              if (normalizedHealthDrain > 0) {
                  if ((inv['medicine'] || 0) >= 1) { inv['medicine']--; normalizedHealthDrain = Math.max(0, normalizedHealthDrain - 2); }
                  if (types.has('HOSPITAL')) { normalizedHealthDrain = Math.max(0, normalizedHealthDrain - 1); }
              }

              // Apply the final toll to the burg's baseline changes
              unrestChange += normalizedUnrestSpike;
              let healthChange = (effectiveFood >= consumedFood) ? 0 : -5; // Base health drift is now driven by labor, not arbitrary -2
              healthChange -= normalizedHealthDrain;

              // L-7: Stockpile decay - excess beyond storage cap decays each tick`;

orch = orch.replace(applyTarget, applyReplace);

// Remove the old flat healthChange declaration that is further down to prevent re-declaration
// The old code had: `let healthChange = (effectiveFood >= consumedFood) ? 2 : -5;`
const oldHealthTarget = `let healthChange = (effectiveFood >= consumedFood) ? 2 : -5;`;
const oldHealthReplace = `/* healthChange moved up */`;
orch = orch.replace(oldHealthTarget, oldHealthReplace);

fs.writeFileSync('src/engine/masterOrchestrator.ts', orch);
console.log("Patched the Toll of Labor");
