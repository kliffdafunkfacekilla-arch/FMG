const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'player-client', 'src', 'App.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update Left Pane Hero HUD
const hudOld = `                {/* Animal Species & Cosmic Brand Badge */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800 px-2 py-0.5 rounded-full uppercase">
                    🐾 {character.species || character.lineage || 'Hero'}
                  </span>
                  <span className="text-[10px] text-gray-400 font-mono">
                    {character.kingdom || 'Mammal'} • {character.institution || 'Mass'}
                  </span>
                </div>`;

const hudNew = `                {/* Animal Species & Archetype Badges */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800 px-2 py-0.5 rounded-full uppercase">
                    🐾 {character.species || character.lineage || 'Hero'}
                  </span>
                  <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950/80 px-2 py-0.5 rounded-full border border-cyan-800 font-bold">
                    {character.main_type || character.mainType || 'Titan'} • {character.sub_type || character.subType || 'Arcanist'} • {character.final_type || character.finalType || 'Sentinel'}
                  </span>
                </div>
                {(character.power_null_track || character.powerNullTrack) && (
                  <div className="text-[10px] text-purple-300 font-mono bg-purple-950/40 px-2 py-0.5 rounded border border-purple-800/60 flex items-center justify-between">
                    <span>🌌 {character.power_null_track || character.powerNullTrack}</span>
                    <span className="text-[9px] text-gray-400">{character.offense_skill || character.offenseSkill || 'Skill'}</span>
                  </div>
                )}`;

if (content.includes(hudOld)) {
  content = content.replace(hudOld, hudNew);
  console.log('Successfully updated Left Pane HUD in App.tsx');
} else {
  console.log('HUD section already updated or text differed.');
}

// 2. Replace tabs stats, equipment, skills with bodySplits, mindSplits, tracks, review
const startMarker = '{/* TAB 2: 12 ATTRIBUTES & POINT ALLOCATION */}';
const startIndex = content.indexOf(startMarker);
const endMarker = '{/* Studio Footer: Hero Name, Summary & Embark */}';
const endIndex = content.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
  console.error('Could not locate start or end marker for tabs replacement!');
  process.exit(1);
}

const subStr = content.slice(startIndex, endIndex);
const lastDivIndex = subStr.lastIndexOf('</div>');
if (lastDivIndex === -1) {
  console.error('Could not find lastDivIndex in subStr!');
  process.exit(1);
}

const replacementTabs = fs.readFileSync(path.join(__dirname, 'modal_replacement.txt'), 'utf8');

content = content.slice(0, startIndex) + replacementTabs + '\n            ' + content.slice(startIndex + lastDivIndex);
fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully replaced Character Studio tabs in App.tsx!');
