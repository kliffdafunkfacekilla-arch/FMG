const fs = require('fs');
let text = fs.readFileSync('src/engine/masterOrchestrator.ts', 'utf8');

const regex = /for \(const cultist of cultists\) \{\s*\/\/ M-5: Real Euclidean distance instead of cell ID arithmetic\s*const caught = wardens\.some\(\(w: any\) => \{\s*const dx = \(w\.loc_x \|\| 0\) - \(cultist\.loc_x \|\| 0\);\s*const dy = \(w\.loc_y \|\| 0\) - \(cultist\.loc_y \|\| 0\);\s*return Math\.sqrt\(dx\*dx \+ dy\*dy\) < 150;\s*\}\);/m;

const replacement = `// Spatial binning for wardens to avoid O(N*M)
    const gridSize = 150;
    const wardenGrid = new Map<string, any[]>();
    for (const w of wardens) {
        const gx = Math.floor((w.loc_x || 0) / gridSize);
        const gy = Math.floor((w.loc_y || 0) / gridSize);
        const key = \`\${gx},\${gy}\`;
        if (!wardenGrid.has(key)) wardenGrid.set(key, []);
        wardenGrid.get(key)!.push(w);
    }

    for (const cultist of cultists) {
      const cx = cultist.loc_x || 0;
      const cy = cultist.loc_y || 0;
      const gx = Math.floor(cx / gridSize);
      const gy = Math.floor(cy / gridSize);
      
      let caught = false;
      for (let ix = -1; ix <= 1 && !caught; ix++) {
          for (let iy = -1; iy <= 1 && !caught; iy++) {
              const candidates = wardenGrid.get(\`\${gx+ix},\${gy+iy}\`) || [];
              caught = candidates.some(w => {
                  const dx = (w.loc_x || 0) - cx;
                  const dy = (w.loc_y || 0) - cy;
                  return (dx*dx + dy*dy) < 22500; // 150^2
              });
          }
      }`;

text = text.replace(regex, replacement);
fs.writeFileSync('src/engine/masterOrchestrator.ts', text);
