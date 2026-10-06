const fs = require('fs');
let text = fs.readFileSync('src/engine/masterOrchestrator.ts', 'utf8');

const civicRegex = /\/\/ Priority 1: Civic \(Religion \/ Entertainment\)[\s\S]+?burg\.crime_rate = Math\.max\(0, \(burg\.crime_rate \|\| 0\) - Math\.floor\(civicWorkers \* 0\.2\)\);/m;

const replacement = `// Priority 1: Civic (Religion / Entertainment)
            const isStarving = effectiveFood < consumedFood;
            const unrestRatio = Math.max(0.1, (burg.unrest || 0) / 100);
            
            let civicWorkers = 0;
            if (isStarving) {
                // If starving, people refuse to work civic jobs and instead resort to crime
                burg.crime_rate = (burg.crime_rate || 0) + Math.floor(urbanWorkers * unrestRatio * 0.5);
                // No civic workers to reduce unrest
            } else {
                civicWorkers = Math.floor(urbanWorkers * unrestRatio);
                urbanWorkers -= civicWorkers;
                
                let civicBonus = 1;
                if ((inv['aromatics'] || 0) > 0) { inv['aromatics']--; civicBonus += 1; }
                if ((inv['spice'] || 0) > 0) { inv['spice']--; civicBonus += 1; }
                if ((inv['luxury'] || 0) > 0) { inv['luxury']--; civicBonus += 2; currentWealth += 10; }
                
                burg.unrest = Math.max(0, (burg.unrest || 0) - (civicWorkers * civicBonus));
                burg.crime_rate = Math.max(0, (burg.crime_rate || 0) - Math.floor(civicWorkers * 0.2));
            }`;

text = text.replace(civicRegex, replacement);
fs.writeFileSync('src/engine/masterOrchestrator.ts', text);
