const fs = require('fs');
let orch = fs.readFileSync('src/engine/masterOrchestrator.ts', 'utf8');

// First, revert the broken "applyReplace"
const badSection = `              // --- THE VACUUM OF NEED (Counter-balancing the Toll of Labor) ---
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
orch = orch.replace(badSection, `              // L-7: Stockpile decay - excess beyond storage cap decays each tick`);

// Now inject it in the RIGHT place.
const rightTarget = `/* healthChange moved up */`;
const rightReplace = `              // --- THE VACUUM OF NEED (Counter-balancing the Toll of Labor) ---
              const popFactor = Math.max(1, popSize / 100); 
              let normalizedHealthDrain = laborHealthDrain / popFactor;
              let normalizedUnrestSpike = laborUnrestSpike / popFactor;

              if (normalizedUnrestSpike > 0) {
                  if ((inv['spice'] || 0) >= 1) { inv['spice']--; normalizedUnrestSpike = Math.max(0, normalizedUnrestSpike - 1); }
                  if ((inv['narcotic'] || 0) >= 1) { inv['narcotic']--; normalizedUnrestSpike = Math.max(0, normalizedUnrestSpike - 2); }
                  if (types.has('TEMPLE')) { normalizedUnrestSpike = Math.max(0, normalizedUnrestSpike - 0.5); }
              }
              if (normalizedHealthDrain > 0) {
                  if ((inv['medicine'] || 0) >= 1) { inv['medicine']--; normalizedHealthDrain = Math.max(0, normalizedHealthDrain - 2); }
                  if (types.has('HOSPITAL')) { normalizedHealthDrain = Math.max(0, normalizedHealthDrain - 1); }
              }

              unrestChange += normalizedUnrestSpike;
              let healthChange = (effectiveFood >= consumedFood) ? 2 : -5; // If food is good, they naturally heal slightly
              healthChange -= normalizedHealthDrain;`;

orch = orch.replace(rightTarget, rightReplace);

fs.writeFileSync('src/engine/masterOrchestrator.ts', orch);
console.log("Fixed Toll of Labor scope");
