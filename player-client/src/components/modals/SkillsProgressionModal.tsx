import React, { useState } from 'react';
import { BODY_STAT_KEYS, MIND_STAT_KEYS } from '../../types';

interface SkillsProgressionModalProps {
  showSkillsModal: boolean;
  character: any;
  optionsData: any;
  levelUpSubmitting: boolean;
  onClose: () => void;
  onInvestSkillRank: (branchId?: string, grantCheatPoint?: boolean) => void;
}

export const SkillsProgressionModal: React.FC<SkillsProgressionModalProps> = ({
  showSkillsModal,
  character,
  optionsData,
  levelUpSubmitting,
  onClose,
  onInvestSkillRank,
}) => {
  const [skillsModalTab, setSkillsModalTab] = useState<'active' | 'combat' | 'reality'>('active');
  const [skillsSelectedStat, setSkillsSelectedStat] = useState<string>('might');
  const [skillsRealityMode, setSkillsRealityMode] = useState<'POWER' | 'NULL'>('POWER');

  if (!showSkillsModal) return null;

  const renderBranchCard = (branch: any) => {
    if (!branch) return null;
    const curRank = Number(character?.skill_ranks?.[branch.id]) || 0;
    return (
      <div key={branch.id} className="bg-gray-850 p-3.5 rounded-xl border border-gray-750 flex flex-col justify-between space-y-3">
        <div>
          <div className="flex justify-between items-start gap-2">
            <div>
              <span className="text-[10px] font-mono uppercase font-bold px-1.5 py-0.5 rounded bg-gray-900 border border-gray-700 text-amber-400">
                {branch.branchType || branch.branchRole || 'BRANCH'}
              </span>
              <h4 className="font-bold text-sm text-white mt-1">{branch.name}</h4>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-xs font-mono font-bold text-emerald-400">
                {curRank === 0 ? 'Locked' : `Rank ${curRank}/4`}
              </span>
              <div className="flex gap-1">
                {[1, 2, 3, 4].map(r => (
                  <div
                    key={r}
                    className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-mono font-bold ${
                      curRank >= r
                        ? 'bg-emerald-500 text-black shadow-sm'
                        : 'bg-gray-800 text-gray-500 border border-gray-700'
                    }`}
                  >
                    {r}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <p className="text-[11px] text-gray-400 italic mt-1 leading-snug">{branch.tagline}</p>

          {/* 4 Ranks Progression */}
          <div className="mt-2.5 space-y-1.5">
            {(branch.ranks || []).map((rk: any) => {
              const isCurrent = curRank === rk.rank;
              const isNext = curRank + 1 === rk.rank;
              return (
                <div
                  key={rk.rank}
                  className={`p-2 rounded-lg border text-xs transition ${
                    isCurrent
                      ? 'border-emerald-500/80 bg-emerald-950/40 text-emerald-200'
                      : isNext
                      ? 'border-amber-600/60 bg-amber-950/20 text-gray-200'
                      : 'border-gray-800 bg-gray-900/60 text-gray-400'
                  }`}
                >
                  <div className="flex justify-between items-center font-semibold text-[11px]">
                    <span className={isCurrent ? 'text-emerald-300 font-bold' : isNext ? 'text-amber-300 font-bold' : 'text-gray-300'}>
                      {rk.title}
                    </span>
                    {isCurrent && <span className="text-[9px] font-mono text-emerald-400 uppercase font-bold">● Active</span>}
                    {isNext && <span className="text-[9px] font-mono text-amber-400 uppercase font-bold">○ Next</span>}
                  </div>
                  <p className="text-[10.5px] mt-0.5 leading-snug text-gray-300">{rk.description}</p>
                  {rk.addedEffect && (
                    <div className="mt-1 text-[9.5px] font-mono text-purple-300 bg-purple-950/60 px-1.5 py-0.5 rounded border border-purple-800/50 inline-block">
                      ★ {rk.addedEffect}
                    </div>
                  )}
                  {(rk.cost || rk.range || rk.aoe) && (
                    <div className="flex gap-2 text-[9px] font-mono text-gray-400 mt-1">
                      {rk.cost && <span>Cost: {rk.cost}</span>}
                      {rk.range && <span>Range: {rk.range}</span>}
                      {rk.aoe && <span>AoE: {rk.aoe}</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Upgrade / Unlock CTA */}
        <div className="pt-2 border-t border-gray-800">
          {curRank < 4 ? (
            <button
              type="button"
              disabled={levelUpSubmitting || (character?.skill_points || 0) <= 0}
              onClick={() => onInvestSkillRank(branch.id)}
              className={`w-full py-2 px-3 rounded-lg font-mono text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md ${
                (character?.skill_points || 0) > 0
                  ? 'bg-amber-600 hover:bg-amber-500 text-black'
                  : 'bg-gray-850 text-gray-500 cursor-not-allowed border border-gray-750'
              }`}
            >
              {(character?.skill_points || 0) > 0 ? (
                <>
                  <span>⚡</span>
                  <span>{curRank === 0 ? 'Unlock at Rank 1 (-1 Pt)' : `Advance to Rank ${curRank + 1} (-1 Pt)`}</span>
                </>
              ) : (
                <span>Requires 1 Skill Point (Level Up)</span>
              )}
            </button>
          ) : (
            <div className="w-full py-1.5 bg-emerald-950 text-emerald-400 font-bold font-mono text-xs rounded-lg border border-emerald-800 text-center shadow-sm">
              ★ Fully Mastered (Rank 4)
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div className="bg-gray-900 border border-gray-700 w-full max-w-5xl max-h-[92vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-gray-800 bg-gray-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-amber-400 tracking-wide">
                ⚡ 3-Branch × 4-Rank Skill & Power Progression
              </h3>
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-emerald-950 border border-emerald-700 text-emerald-300 font-bold">
                Lv. {character?.level || 1}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Unlock branches at Rank 1, advance to Rank 4 Mastery. Every rank strictly scales passive traits, reduces resource costs, or eliminates disadvantage.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-gray-900 border border-amber-600/60 px-3 py-1.5 rounded-xl font-mono text-xs">
              <span className="text-gray-400">Skill Points:</span>
              <span className="text-amber-400 font-black text-sm">
                {character?.skill_points || 0}
              </span>
            </div>

            <button
              type="button"
              disabled={levelUpSubmitting}
              onClick={() => onInvestSkillRank(undefined, true)}
              className="px-2.5 py-1.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1 shadow-sm"
              title="Cheat/Test: Gain 1 free level and 1 skill point for instant testing"
            >
              <span>✨</span> +1 Test Point
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-750 rounded-lg transition"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="px-4 py-2 border-b border-gray-800 bg-gray-900 flex gap-2">
          <button
            type="button"
            onClick={() => setSkillsModalTab('active')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              skillsModalTab === 'active'
                ? 'bg-amber-600 text-black shadow'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
            }`}
          >
            <span>🎯</span> My Active Disciplines
          </button>
          <button
            type="button"
            onClick={() => setSkillsModalTab('combat')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              skillsModalTab === 'combat'
                ? 'bg-amber-600 text-black shadow'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
            }`}
          >
            <span>⚔️</span> All 24 Combat Tracks
          </button>
          <button
            type="button"
            onClick={() => setSkillsModalTab('reality')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              skillsModalTab === 'reality'
                ? 'bg-amber-600 text-black shadow'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
            }`}
          >
            <span>🌌</span> All 24 Reality Trees
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {skillsModalTab === 'active' && (() => {
            const activeOffSkill = (optionsData?.offenseSkills || []).find((s: any) => s.name === character?.offense_skill || s.id === character?.offense_skill) || optionsData?.offenseSkills?.[0];
            const offStat = activeOffSkill?.stat || character?.weapon_stat || 'might';
            const activeOffTrack = optionsData?.offensiveSkillTracks?.[offStat];

            const activeDefSkill = (optionsData?.defenseSkills || []).find((s: any) => s.name === character?.defense_skill || s.id === character?.defense_skill) || optionsData?.defenseSkills?.[0];
            const defStat = activeDefSkill?.stat || character?.armor_stat || 'might';
            const activeDefTrack = optionsData?.defensiveSkillTracks?.[defStat];

            const activePowerTrack = (optionsData?.powerNullTracks || []).find((t: any) => t.name === character?.power_null_track || t.id === character?.power_null_track) || optionsData?.powerNullTracks?.[0];
            const isNullTree = (activePowerTrack?.mode === 'NULL') || (character?.power_null_track && character.power_null_track.toLowerCase().includes('null'));
            const pwrStat = activePowerTrack?.stat || 'might';
            const activeRealityTree = isNullTree
              ? optionsData?.realityNullTrees?.[pwrStat]
              : optionsData?.realityPowerTrees?.[pwrStat];

            return (
              <div className="space-y-6">
                {/* Section 1: Active Offensive Combat Track */}
                {activeOffTrack && (
                  <div className="bg-gray-950 p-4 rounded-xl border border-amber-900/60 space-y-3">
                    <div className="flex justify-between items-center border-b border-gray-800 pb-2">
                      <div>
                        <span className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                          <span>⚔️</span> Offensive Combat Track: {activeOffTrack.trackName}
                        </span>
                        <p className="text-[11px] text-gray-400 italic mt-0.5">{activeOffTrack.flavor}</p>
                      </div>
                      <span className="text-xs font-mono text-amber-300 bg-amber-950 px-2 py-0.5 rounded border border-amber-800 font-bold uppercase">
                        +{offStat}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {renderBranchCard(activeOffTrack.specialization)}
                      {renderBranchCard(activeOffTrack.passive)}
                      {renderBranchCard(activeOffTrack.active)}
                    </div>
                  </div>
                )}

                {/* Section 2: Active Defensive Combat Track */}
                {activeDefTrack && (
                  <div className="bg-gray-950 p-4 rounded-xl border border-sky-900/60 space-y-3">
                    <div className="flex justify-between items-center border-b border-gray-800 pb-2">
                      <div>
                        <span className="text-xs font-black text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                          <span>🛡️</span> Defensive Combat Track: {activeDefTrack.trackName}
                        </span>
                        <p className="text-[11px] text-gray-400 italic mt-0.5">{activeDefTrack.flavor}</p>
                      </div>
                      <span className="text-xs font-mono text-sky-300 bg-sky-950 px-2 py-0.5 rounded border border-sky-800 font-bold uppercase">
                        +{defStat}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {renderBranchCard(activeDefTrack.specialization)}
                      {renderBranchCard(activeDefTrack.passive)}
                      {renderBranchCard(activeDefTrack.active)}
                    </div>
                  </div>
                )}

                {/* Section 3: Active Reality Constant Tree */}
                {activeRealityTree && (
                  <div className="bg-gray-950 p-4 rounded-xl border border-purple-900/60 space-y-3">
                    <div className="flex justify-between items-center border-b border-gray-800 pb-2">
                      <div>
                        <span className="text-xs font-black text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                          <span>🌌</span> {activeRealityTree.mode === 'NULL' ? 'Null Reality Discipline' : 'Reality Power Tree'}: {activeRealityTree.treeName}
                        </span>
                        <p className="text-[11px] text-gray-400 italic mt-0.5">{activeRealityTree.philosophicalCore}</p>
                      </div>
                      <span className="text-xs font-mono text-purple-300 bg-purple-950 px-2 py-0.5 rounded border border-purple-800 font-bold uppercase">
                        +{pwrStat}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {renderBranchCard(activeRealityTree.offense)}
                      {renderBranchCard(activeRealityTree.defense)}
                      {renderBranchCard(activeRealityTree.utility)}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {skillsModalTab === 'combat' && (() => {
            const allStats = [...BODY_STAT_KEYS, ...MIND_STAT_KEYS];
            const selOffTrack = optionsData?.offensiveSkillTracks?.[skillsSelectedStat];
            const selDefTrack = optionsData?.defensiveSkillTracks?.[skillsSelectedStat];

            return (
              <div className="space-y-4">
                {/* Stat Selector Pills */}
                <div className="flex flex-wrap gap-1.5 p-2 bg-gray-950 rounded-xl border border-gray-800">
                  {allStats.map(st => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setSkillsSelectedStat(st)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono capitalize transition ${
                        skillsSelectedStat === st
                          ? 'bg-amber-600 text-black font-black shadow'
                          : 'bg-gray-900 text-gray-400 hover:text-white border border-gray-800'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>

                {/* Offensive Track for Selected Stat */}
                {selOffTrack && (
                  <div className="bg-gray-950 p-4 rounded-xl border border-amber-900/60 space-y-3">
                    <div className="flex justify-between items-center border-b border-gray-800 pb-2">
                      <div>
                        <span className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                          <span>⚔️</span> Offensive Track: {selOffTrack.trackName}
                        </span>
                        <p className="text-[11px] text-gray-400 italic mt-0.5">{selOffTrack.flavor}</p>
                      </div>
                      <span className="text-xs font-mono text-amber-300 bg-amber-950 px-2 py-0.5 rounded border border-amber-800 font-bold uppercase">
                        +{skillsSelectedStat}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {renderBranchCard(selOffTrack.specialization)}
                      {renderBranchCard(selOffTrack.passive)}
                      {renderBranchCard(selOffTrack.active)}
                    </div>
                  </div>
                )}

                {/* Defensive Track for Selected Stat */}
                {selDefTrack && (
                  <div className="bg-gray-950 p-4 rounded-xl border border-sky-900/60 space-y-3">
                    <div className="flex justify-between items-center border-b border-gray-800 pb-2">
                      <div>
                        <span className="text-xs font-black text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                          <span>🛡️</span> Defensive Track: {selDefTrack.trackName}
                        </span>
                        <p className="text-[11px] text-gray-400 italic mt-0.5">{selDefTrack.flavor}</p>
                      </div>
                      <span className="text-xs font-mono text-sky-300 bg-sky-950 px-2 py-0.5 rounded border border-sky-800 font-bold uppercase">
                        +{skillsSelectedStat}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {renderBranchCard(selDefTrack.specialization)}
                      {renderBranchCard(selDefTrack.passive)}
                      {renderBranchCard(selDefTrack.active)}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {skillsModalTab === 'reality' && (() => {
            const allStats = [...BODY_STAT_KEYS, ...MIND_STAT_KEYS];
            const selTree = skillsRealityMode === 'POWER'
              ? optionsData?.realityPowerTrees?.[skillsSelectedStat]
              : optionsData?.realityNullTrees?.[skillsSelectedStat];

            return (
              <div className="space-y-4">
                {/* Mode Toggle: Power vs Null */}
                <div className="flex items-center justify-between p-2.5 bg-gray-950 rounded-xl border border-gray-800">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSkillsRealityMode('POWER')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                        skillsRealityMode === 'POWER'
                          ? 'bg-purple-600 text-white shadow'
                          : 'text-gray-400 hover:text-white bg-gray-900 border border-gray-800'
                      }`}
                    >
                      <span>⚡</span> Reality Powers (External Spells)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSkillsRealityMode('NULL')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                        skillsRealityMode === 'NULL'
                          ? 'bg-indigo-600 text-white shadow'
                          : 'text-gray-400 hover:text-white bg-gray-900 border border-gray-800'
                      }`}
                    >
                      <span>🛡️</span> Null Abilities (Inertia & Ignorance)
                    </button>
                  </div>
                  <span className="text-[11px] font-mono text-gray-400">
                    {skillsRealityMode === 'POWER' ? 'Manipulates constant directly' : 'Completely ignores constant'}
                  </span>
                </div>

                {/* Stat Selector Pills */}
                <div className="flex flex-wrap gap-1.5 p-2 bg-gray-950 rounded-xl border border-gray-800">
                  {allStats.map(st => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setSkillsSelectedStat(st)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono capitalize transition ${
                        skillsSelectedStat === st
                          ? 'bg-purple-600 text-white font-black shadow'
                          : 'bg-gray-900 text-gray-400 hover:text-white border border-gray-800'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>

                {/* Reality Constant Tree */}
                {selTree && (
                  <div className="bg-gray-950 p-4 rounded-xl border border-purple-900/60 space-y-3">
                    <div className="flex justify-between items-center border-b border-gray-800 pb-2">
                      <div>
                        <span className="text-xs font-black text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                          <span>🌌</span> {selTree.treeName} ({selTree.constantName})
                        </span>
                        <p className="text-[11px] text-gray-400 italic mt-0.5">{selTree.philosophicalCore}</p>
                      </div>
                      <span className="text-xs font-mono text-purple-300 bg-purple-950 px-2 py-0.5 rounded border border-purple-800 font-bold uppercase">
                        +{skillsSelectedStat}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {renderBranchCard(selTree.offense)}
                      {renderBranchCard(selTree.defense)}
                      {renderBranchCard(selTree.utility)}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* Modal Footer */}
        <div className="p-3 border-t border-gray-800 bg-gray-950 flex justify-between items-center text-xs font-mono text-gray-400">
          <span>Points invest immediately. Max Rank 4 per branch.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-bold transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
