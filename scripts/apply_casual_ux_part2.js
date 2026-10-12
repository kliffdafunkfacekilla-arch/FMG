const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '..', 'player-client', 'src', 'App.tsx');
let content = fs.readFileSync(appPath, 'utf8');

console.log('App.tsx length before Part 2:', content.length);

// -------------------------------------------------------------
// 1. ADD QUICK PRESETS BAR IN CHARACTER STUDIO (just before tabs)
// -------------------------------------------------------------
const studioHeaderAnchor = `{/* Studio Navigation Tabs */}`;
const presetsBar = `{/* Quick Build Presets Bar */}
            <div className="bg-gray-950 px-4 py-2.5 border-b border-gray-800 flex items-center justify-between gap-3 overflow-x-auto select-none">
              <div className="flex items-center gap-1.5 text-xs text-amber-400 font-bold whitespace-nowrap">
                <span>⚡</span>
                <span className="tracking-wider uppercase text-[11px]">Quick Archetypes:</span>
              </div>
              <div className="flex gap-2">
                {QUICK_PRESETS.map(p => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className="px-2.5 py-1.5 bg-gray-900 hover:bg-amber-950/70 border border-gray-750 hover:border-amber-500 rounded-lg text-[11px] font-bold text-gray-200 hover:text-white transition flex items-center gap-1.5 shadow-sm whitespace-nowrap"
                    title={p.desc}
                  >
                    <span>{p.icon}</span>
                    <span>{p.name}</span>
                    <span className="text-[9.5px] text-gray-400 font-mono font-normal">({p.tagline})</span>
                  </button>
                ))}
              </div>
            </div>

            `;

if (!content.includes('Quick Archetypes:')) {
  content = content.replace(studioHeaderAnchor, presetsBar + studioHeaderAnchor);
  console.log('Added Quick Archetypes Presets bar');
}

// -------------------------------------------------------------
// 2. ENHANCE TAB 1: ADD SELECTED KINGDOM PROFILE CARD
// -------------------------------------------------------------
const kingdomGridEndAnchor = `                        </button>
                      ))}
                    </div>
                  </div>`;

const kingdomProfileCard = `                        </button>
                      ))}
                    </div>

                    {/* Selected Kingdom Deep Biological Profile & Stat Shift Hint */}
                    {(() => {
                      const profile = KINGDOM_PROFILES[creationForm.kingdom] || KINGDOM_PROFILES.Mammal;
                      return (
                        <div className="mt-3 p-3.5 bg-gray-850 border border-amber-900/60 rounded-xl space-y-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-amber-300">
                                  {creationForm.kingdom} Biological Profile
                                </span>
                                <span className="text-[10px] bg-amber-950 text-amber-400 px-2 py-0.5 rounded font-mono border border-amber-800">
                                  {profile.vibe}
                                </span>
                              </div>
                              <p className="text-[11px] text-gray-300 mt-0.5 leading-relaxed">
                                {profile.summary}
                              </p>
                              <p className="text-[10.5px] text-gray-400 italic mt-0.5">
                                <strong>Physiology:</strong> {profile.biology}
                              </p>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-gray-750 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-[11px]">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Natural Strengths:</span>
                              {profile.strengths.map((str, i) => (
                                <span key={i} className="bg-emerald-950/80 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded font-mono text-[10px]">
                                  {str}
                                </span>
                              ))}
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Biological Trade-offs:</span>
                              {profile.weaknesses.map((w, i) => (
                                <span key={i} className="bg-gray-900 text-gray-400 border border-gray-750 px-2 py-0.5 rounded font-mono text-[10px]">
                                  {w}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>`;

if (!content.includes('Biological Profile')) {
  content = content.replace(kingdomGridEndAnchor, kingdomProfileCard);
  console.log('Added Kingdom Biological Profile Card');
}

// -------------------------------------------------------------
// 3. ENHANCE TAB 5: WEAPON & ARMOR SYNERGY BADGES
// -------------------------------------------------------------
const weaponBoxAnchor = `                      <div className="bg-gray-850 p-3 rounded-xl border border-gray-750 space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-orange-300">{creationForm.equippedWeapon}</span>
                          <span className="text-[11px] text-gray-400 font-mono">Conductor: <strong className="text-amber-300">{creationForm.weapon_metal}</strong></span>
                        </div>
                        <p className="text-[11px] text-gray-300 italic">{creationForm.weapon_desc}</p>
                      </div>`;

const weaponBoxReplace = `                      {(() => {
                        const wpnStatVal = Number(creationForm[creationForm.weapon_stat]) || 1;
                        const isSynergized = wpnStatVal >= 10;
                        const isOffStat = wpnStatVal < 8;
                        return (
                          <div className="flex flex-col gap-1.5">
                            {isSynergized && (
                              <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-300 bg-emerald-950/80 border border-emerald-700 px-2.5 py-1 rounded">
                                <span>⭐</span>
                                <span>HIGH ATTUNEMENT: Synergizes with your {creationForm.weapon_stat?.toUpperCase()} ({wpnStatVal})!</span>
                              </div>
                            )}
                            {isOffStat && (
                              <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-300 bg-amber-950/80 border border-amber-750 px-2.5 py-1 rounded">
                                <span>⚠️</span>
                                <span>OFF-STAT WEAPON: Your {creationForm.weapon_stat?.toUpperCase()} is only {wpnStatVal}. Your strikes will have lower accuracy.</span>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      <div className="bg-gray-850 p-3 rounded-xl border border-gray-750 space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-orange-300">{creationForm.equippedWeapon}</span>
                          <span className="text-[11px] text-gray-400 font-mono">Conductor: <strong className="text-amber-300">{creationForm.weapon_metal}</strong></span>
                        </div>
                        <p className="text-[11px] text-gray-300 italic">{creationForm.weapon_desc}</p>
                      </div>`;

if (!content.includes('HIGH ATTUNEMENT: Synergizes with your')) {
  content = content.replace(weaponBoxAnchor, weaponBoxReplace);
  console.log('Added Weapon Synergy Card');
}

const armorBoxAnchor = `                      <div className="bg-gray-850 p-3 rounded-xl border border-gray-750 space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-sky-300">{creationForm.equippedArmor}</span>
                          <span className="text-[11px] text-gray-400 font-mono">Conductor: <strong className="text-sky-300">{creationForm.armor_metal}</strong></span>
                        </div>
                        <p className="text-[11px] text-gray-300 italic">{creationForm.armor_desc}</p>
                      </div>`;

const armorBoxReplace = `                      {(() => {
                        const armStatVal = Number(creationForm[creationForm.armor_stat]) || 1;
                        const isSynergized = armStatVal >= 10;
                        const isOffStat = armStatVal < 8;
                        return (
                          <div className="flex flex-col gap-1.5">
                            {isSynergized && (
                              <div className="flex items-center gap-1.5 text-[10px] font-bold text-teal-300 bg-teal-950/80 border border-teal-700 px-2.5 py-1 rounded">
                                <span>⭐</span>
                                <span>HIGH ATTUNEMENT: Synergizes with your {creationForm.armor_stat?.toUpperCase()} ({armStatVal})!</span>
                              </div>
                            )}
                            {isOffStat && (
                              <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-300 bg-amber-950/80 border border-amber-750 px-2.5 py-1 rounded">
                                <span>⚠️</span>
                                <span>OFF-STAT ARMOR: Your {creationForm.armor_stat?.toUpperCase()} is only {armStatVal}.</span>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      <div className="bg-gray-850 p-3 rounded-xl border border-gray-750 space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-sky-300">{creationForm.equippedArmor}</span>
                          <span className="text-[11px] text-gray-400 font-mono">Conductor: <strong className="text-sky-300">{creationForm.armor_metal}</strong></span>
                        </div>
                        <p className="text-[11px] text-gray-300 italic">{creationForm.armor_desc}</p>
                      </div>`;

if (!content.includes('HIGH ATTUNEMENT: Synergizes with your {creationForm.armor_stat')) {
  content = content.replace(armorBoxAnchor, armorBoxReplace);
  console.log('Added Armor Synergy Card');
}

// -------------------------------------------------------------
// 4. ACTION RESOLVING ANIMATION BANNER
// -------------------------------------------------------------
const formAnchor = `            {/* Freeform Prompt Form */}`;
const resolvingBanner = `            {/* Action Resolving Banner */}
            {isActing && (
              <div className="flex items-center justify-between text-xs font-mono text-amber-300 bg-amber-950/80 border border-amber-600/80 px-3 py-1.5 rounded-lg animate-pulse shadow">
                <span className="flex items-center gap-2">
                  <span className="text-base animate-spin inline-block">🎲</span>
                  <span>The Chronicler weaves fate... Resolving opposed rolls & world tags</span>
                </span>
                <span className="text-[10px] text-amber-400 bg-black/60 px-2 py-0.5 rounded font-bold">1d20 CONTEST</span>
              </div>
            )}

            `;

if (!content.includes('The Chronicler weaves fate')) {
  content = content.replace(formAnchor, resolvingBanner + formAnchor);
  console.log('Added Action Resolving Banner');
}

// -------------------------------------------------------------
// 5. ADD DEATH MODAL & AUTOSAVE TOAST AT BOTTOM OF APP
// -------------------------------------------------------------
const endAnchor = `    </div>\n  );\n}\n\nexport default App;`;
const modalsAndToast = `      {/* Auto-Save Floating Notification Toast */}
      {autoSaveToast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-950/95 text-emerald-300 border border-emerald-500/80 px-4 py-2.5 rounded-xl text-xs font-mono font-bold shadow-2xl flex items-center gap-2.5 animate-bounce">
          <span className="text-base">💾</span> {autoSaveToast}
        </div>
      )}

      {/* Fallen Hero / Defeat Modal */}
      {showDeathModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4 select-none">
          <div className="bg-gray-950 border-2 border-red-700/80 rounded-2xl w-full max-w-md shadow-[0_0_60px_rgba(220,38,38,0.6)] overflow-hidden text-center p-6 space-y-5">
            <div className="text-5xl animate-bounce">💀</div>
            <div>
              <h2 className="text-2xl font-black text-red-500 tracking-widest uppercase font-serif">
                YOU HAVE FALLEN
              </h2>
              <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                Your vital humors have drained into the dust of Cruorbus. The shadow of the blood moon closes over you as your vision fades into oblivion.
              </p>
            </div>

            <div className="bg-gray-900 border border-red-950/80 p-3.5 rounded-xl text-xs font-mono text-gray-300 space-y-1.5 text-left">
              <div className="flex justify-between">
                <span className="text-gray-400">Hero:</span>
                <span className="text-amber-300 font-bold">{character?.name} (Lv. {character?.level || 1})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Purse:</span>
                <span className="text-yellow-400 font-bold">{character?.gold || 0} Gold</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Fallen At:</span>
                <span className="text-blue-300">Sector ({regionalPos.rx}, {regionalPos.ry}) Tile ({localPos.lx}, {localPos.ly})</span>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleRevivePlayer}
                className="w-full py-3 px-4 bg-gradient-to-r from-red-700 to-amber-700 hover:from-red-600 hover:to-amber-600 text-white font-black tracking-wider uppercase rounded-lg shadow-lg hover:shadow-red-600/30 transition text-xs flex items-center justify-center gap-2"
              >
                <span>🕯️</span> Revive at Safe Camp (-25 Gold)
              </button>
              <button
                type="button"
                onClick={() => { setShowDeathModal(false); handleOpenLoadModal(); }}
                className="w-full py-2.5 px-4 bg-gray-850 hover:bg-gray-800 border border-gray-700 hover:border-gray-500 text-gray-300 hover:text-white font-bold tracking-wider uppercase rounded-lg transition text-xs flex items-center justify-center gap-2"
              >
                <span>📂</span> Load Saved Game
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;`;

if (!content.includes('YOU HAVE FALLEN')) {
  content = content.replace(endAnchor, modalsAndToast);
  console.log('Added Death Modal and AutoSave Toast');
}

// -------------------------------------------------------------
// 6. HUMANIZE TERMINOLOGY
// -------------------------------------------------------------
content = content.replace(/Narrative Pivot Branch:/g, 'Path Decision:');
content = content.replace(/CONCORDIA ACTIVE/g, 'CHRONICLER ACTIVE');
content = content.replace(/CONCORDIA CHRONICLE/g, 'CHRONICLER OF OSTRAKA');
content = content.replace(/ECGM ENGINE/g, 'PROCEDURAL TTRPG');
content = content.replace(/12-STAT ATTUNEMENT/g, '12 ATTRIBUTES');
content = content.replace(/CONCORDIA AI GM/g, 'AI CHRONICLER');
content = content.replace(/POSTGRES READY/g, 'PERSISTENT WORLD');

fs.writeFileSync(appPath, content, 'utf8');
console.log('Part 2 completed successfully. File size:', content.length);
