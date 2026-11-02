import React from 'react';
import { getAnimalSpriteCoords, getBiomeName } from '../../utils/SpriteHelper';
import type { InjectedNPC, InjectedProp, StoryBeat } from '../../types';

interface HeroHudProps {
  character: any;
  manifest: any;
  calendarState: any;
  regionalPos: { rx: number; ry: number };
  localPos: { lx: number; ly: number };
  activeBeat: StoryBeat | null;
  injectedNPCs: InjectedNPC[];
  injectedProps: InjectedProp[];
  encounterTarget: any;
  activeCenterTab: 'battlegrid' | 'worldMap';
  isActing: boolean;
  currentTrack: { title: string; artist: string };
  isPlayingMusic: boolean;
  isMuted: boolean;
  musicVol: number;
  sfxMuted: boolean;
  ambientMuted?: boolean;
  onOpenStartMenu: () => void;
  onNewHero: () => void;
  onOpenSaveModal: () => void;
  onOpenLoadModal: () => void;
  onOpenSkillsModal: () => void;
  onOpenPaperdoll?: () => void;
  onTargetSelect: (target: any) => void;
  onToggleWorldMap: () => void;
  onToggleMusic: () => void;
  onNextTrack: () => void;
  onToggleMute: () => void;
  onVolumeChange: (vol: number) => void;
  onToggleSfx: () => void;
  onToggleAmbient?: () => void;
  onUseItem: (item: string) => void;
}

export const HeroHud: React.FC<HeroHudProps> = ({
  character,
  manifest,
  calendarState,
  regionalPos,
  localPos,
  activeBeat,
  injectedNPCs,
  injectedProps,
  encounterTarget,
  activeCenterTab,
  isActing,
  currentTrack,
  isPlayingMusic,
  isMuted,
  musicVol,
  sfxMuted,
  ambientMuted,
  onOpenStartMenu,
  onNewHero,
  onOpenSaveModal,
  onOpenLoadModal,
  onOpenSkillsModal,
  onOpenPaperdoll,
  onTargetSelect,
  onToggleWorldMap,
  onToggleMusic,
  onNextTrack,
  onToggleMute,
  onVolumeChange,
  onToggleSfx,
  onToggleAmbient,
  onUseItem,
}) => {
  return (
    <div className="w-72 bg-gray-800 border-r border-gray-700 flex flex-col">
      <div className="p-3 border-b border-gray-700 bg-gray-850 flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <h2 className="text-base font-bold text-amber-500 tracking-wider">HERO HUD</h2>
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
            CHRONICLER ACTIVE
          </span>
        </div>
        {/* Top Game Controls: Menu, New Hero, Save, Load */}
        <div className="grid grid-cols-4 gap-1 pt-1">
          <button
            type="button"
            onClick={onOpenStartMenu}
            className="text-[11px] font-semibold bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 hover:border-gray-500 px-1 py-1 rounded transition flex items-center justify-center gap-1 shadow-sm"
            title="Return to App Start Menu (Esc)"
          >
            <span>🏠</span> Menu
          </button>
          <button
            type="button"
            onClick={onNewHero}
            className="text-[11px] font-semibold bg-gray-800 hover:bg-amber-900/60 text-amber-300 border border-gray-700 hover:border-amber-500 px-1 py-1 rounded transition flex items-center justify-center gap-1 shadow-sm"
            title="Create a new character and start a fresh game"
          >
            <span>✨</span> New
          </button>
          <button
            type="button"
            onClick={onOpenSaveModal}
            className="text-[11px] font-semibold bg-gray-800 hover:bg-emerald-900/60 text-emerald-300 border border-gray-700 hover:border-emerald-500 px-1 py-1 rounded transition flex items-center justify-center gap-1 shadow-sm"
            title="Save current game progress"
          >
            <span>💾</span> Save
          </button>
          <button
            type="button"
            onClick={onOpenLoadModal}
            className="text-[11px] font-semibold bg-gray-800 hover:bg-blue-900/60 text-blue-300 border border-gray-700 hover:border-blue-500 px-1 py-1 rounded transition flex items-center justify-center gap-1 shadow-sm"
            title="Load a saved game"
          >
            <span>📂</span> Load
          </button>
        </div>
      </div>

      <div className="p-4 flex-1 overflow-y-auto space-y-4">
        {/* Identity, Species & Health */}
        {character ? (
          <div className="bg-gray-900 p-3 rounded-xl border border-gray-700 space-y-2.5 shadow-md">
            <div className="flex items-center gap-3">
              {/* Animal Kin Avatar Badge */}
              <div className="w-12 h-12 rounded-xl bg-gray-950 border-2 border-amber-500/80 shadow-md flex items-center justify-center relative overflow-hidden shrink-0">
                {(() => {
                  const { col, row } = getAnimalSpriteCoords(character.kingdom, character.species || character.lineage, 0);
                  return (
                    <div
                      className="w-full h-full"
                      style={{
                        backgroundImage: 'url(/gfx/Gemini_Generated_Image_a4motwa4motwa4mo.png)',
                        backgroundPosition: `-${col * 48}px -${row * 48}px`,
                        backgroundSize: `${22 * 48}px ${12 * 48}px`,
                        imageRendering: 'pixelated'
                      }}
                    />
                  );
                })()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-300 text-sm tracking-wide truncate">{character.name}</span>
                  <span className="text-xs font-mono text-gray-400">HP: {character.current_hp}/{character.max_hp}</span>
                </div>
                <div className="text-[10.5px] text-gray-300 font-mono truncate">
                  🐾 {character.species || character.lineage || 'Hero'}
                </div>
              </div>
            </div>

            {/* Animal Species, Difficulty & Archetype Badges */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border font-mono ${
                character.difficulty === 'casual'
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                  : character.difficulty === 'hardcore'
                  ? 'bg-red-950 text-red-300 border-red-800'
                  : 'bg-amber-950 text-amber-300 border-amber-800'
              }`}>
                {character.difficulty === 'casual' ? '🟢 Casual' : character.difficulty === 'hardcore' ? '🔴 Hardcore' : '🟡 Survivor'}
              </span>
              <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950/80 px-2 py-0.5 rounded-full border border-cyan-800 font-bold">
                {character.kingdom || 'Mammalia'} • {character.institution || 'Aetheria'}
              </span>
            </div>
            {(character.power_null_track || character.powerNullTrack) && (
              <div className="text-[10px] text-purple-300 font-mono bg-purple-950/40 px-2 py-0.5 rounded border border-purple-800/60 flex items-center justify-between">
                <span>🌌 {character.power_null_track || character.powerNullTrack}</span>
                <span className="text-[9px] text-gray-400">{character.offense_skill || character.offenseSkill || 'Skill'}</span>
              </div>
            )}

            {/* Health Bar */}
            <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${Math.max(0, Math.min(100, (character.current_hp / character.max_hp) * 100))}%`,
                  backgroundColor: character.current_hp / character.max_hp > 0.5 ? '#22c55e' : character.current_hp / character.max_hp > 0.25 ? '#eab308' : '#ef4444'
                }}
              />
            </div>

            {/* Derived Vitals Mini Grid */}
            <div className="grid grid-cols-4 gap-1 text-[10px] font-mono text-center pt-1.5 border-t border-gray-800">
              <div className="bg-gray-850 p-1 rounded" title="Max Stamina">
                <span className="text-amber-400 font-bold block">⚡ {character.stamina_max || character.derived_stats?.maxStamina || 8}</span>
                <span className="text-[9px] text-gray-400">STA</span>
              </div>
              <div className="bg-gray-850 p-1 rounded" title="Max Focus">
                <span className="text-sky-400 font-bold block">🧠 {character.focus_max || character.derived_stats?.maxFocus || 8}</span>
                <span className="text-[9px] text-gray-400">FOC</span>
              </div>
              <div className="bg-gray-850 p-1 rounded" title="Physical Defense">
                <span className="text-teal-400 font-bold block">🛡️ {character.phys_defense || character.derived_stats?.physDefense || 10}</span>
                <span className="text-[9px] text-gray-400">DEF</span>
              </div>
              <div className="bg-gray-850 p-1 rounded" title="Speed">
                <span className="text-purple-400 font-bold block">👟 {character.speed || character.derived_stats?.speed || 10}</span>
                <span className="text-[9px] text-gray-400">SPD</span>
              </div>
            </div>

            <div className="flex justify-between items-center text-xs font-mono pt-1.5 text-gray-300 border-t border-gray-800">
              <span>Purse: <strong className="text-yellow-400">💰 {character.gold ?? 50} Gold</strong></span>
              <span>Level: <strong className="text-emerald-400">Lv. {character.level ?? 1}</strong></span>
            </div>

            {/* 3-Branch x 4-Rank Skill Progression Trigger */}
            <button
              type="button"
              onClick={onOpenSkillsModal}
              className={`w-full py-1.5 px-2.5 rounded-lg font-mono text-xs font-bold transition flex items-center justify-between border shadow-sm ${
                (character.skill_points || 0) > 0
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500 animate-pulse hover:bg-amber-500/30'
                  : 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-750'
              }`}
              title="Open 3-Branch x 4-Rank Skill & Power Progression Trees"
            >
              <span className="flex items-center gap-1.5">
                <span>⚡</span> Disciplines & Skills
              </span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                (character.skill_points || 0) > 0 ? 'bg-amber-500 text-black font-extrabold' : 'bg-gray-900 text-gray-400'
              }`}>
                {(character.skill_points || 0) > 0 ? `+${character.skill_points} Pts` : 'View'}
              </span>
            </button>

            {/* Unlocked Specializations & Active Disciplines */}
            {character.skill_ranks && Object.keys(character.skill_ranks).length > 0 && (
              <div className="pt-2 border-t border-gray-800 space-y-1">
                <span className="text-[9.5px] font-bold text-gray-400 uppercase tracking-wider block">Specializations (Ranks 1–4)</span>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(character.skill_ranks).map(([bId, rk]: [string, any]) => {
                    const cleanName = bId
                      .replace(/^spec_weapon_/, 'Wpn: ')
                      .replace(/^spec_armor_/, 'Arm: ')
                      .replace(/^trait_/, 'Trait: ')
                      .replace(/^act_/, 'Act: ')
                      .replace(/^pwr_/, 'Pwr: ')
                      .replace(/^null_/, 'Null: ')
                      .replace(/_/g, ' ');
                    return (
                      <span
                        key={bId}
                        className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-gray-850 border border-gray-750 text-gray-300 flex items-center gap-1"
                        title={`Branch ${bId} at Rank ${rk}`}
                      >
                        <span className="capitalize">{cleanName}</span>
                        <span className="text-emerald-400 font-bold bg-emerald-950 px-1 rounded border border-emerald-800">R{rk}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-xs text-gray-400 italic animate-pulse">Loading hero profile...</div>
        )}

        {/* ADVENTURER'S ASTROLOGICAL & SENSORY ALMANAC */}
        <div className="bg-gradient-to-b from-gray-900 via-gray-900 to-gray-950 border border-amber-900/40 rounded-xl p-3 space-y-2.5 shadow-lg">
          {/* Header: Sector Coordinates, Biome & Sovereignty */}
          <div className="flex justify-between items-center text-[10.5px] uppercase font-bold tracking-wider">
            <span className="text-amber-400 flex items-center gap-1">
              <span>🧭</span> Sector ({regionalPos.rx}, {regionalPos.ry})
            </span>
            <span className="font-mono text-cyan-300 bg-cyan-950/80 border border-cyan-800 px-2 py-0.5 rounded text-[9.5px]">
              {getBiomeName(manifest?.global_context?.biome_id)}
            </span>
          </div>

          {/* Faction Sovereign & Environmental Status Badges */}
          <div className="flex items-center gap-1.5 flex-wrap text-[9.5px] font-mono">
            <span className="text-gray-300 bg-gray-800 px-1.5 py-0.5 rounded border border-gray-700">
              👑 {manifest?.global_context?.faction_owner && manifest?.global_context?.faction_owner !== 'Unclaimed' ? manifest.global_context.faction_owner : 'Wild Frontier'}
            </span>
            {manifest?.global_context?.isWarzone && (
              <span className="text-red-300 bg-red-950/80 border border-red-800 px-1.5 py-0.5 rounded font-bold">
                ⚔️ Warzone
              </span>
            )}
            {manifest?.global_context?.isFamine && (
              <span className="text-amber-300 bg-amber-950/80 border border-amber-800 px-1.5 py-0.5 rounded font-bold">
                🌾 Famine
              </span>
            )}
          </div>

          {/* Lunar Cruorbus & 12 Flows of Chaos Almanac */}
          <div className="p-2 rounded-lg bg-gradient-to-r from-red-950/50 via-purple-950/40 to-slate-900 border border-red-900/40 text-[10px] space-y-1">
            <div className="flex justify-between items-center font-bold">
              <span className="text-red-300 flex items-center gap-1">
                <span>🌕</span> Cruorbus: {calendarState?.moon_phase || 'The Waxing Blood'}
              </span>
              <span className="text-purple-300 font-mono text-[9px] bg-purple-950/80 border border-purple-800/60 px-1.5 py-0.5 rounded">
                Flow of {calendarState?.active_flow || 'Mass'}
              </span>
            </div>
            <div className="text-gray-300 text-[9.5px] italic">
              {calendarState?.dragon_domain 
                ? `Celestial energy absorbed by the prison of ${calendarState.dragon_domain}` 
                : 'Radiating primordial chaos into ancient dragon barrows'}
            </div>
          </div>

          {/* Surroundings & Sensory Atmosphere */}
          <div className="bg-black/40 border border-gray-800/90 rounded-lg p-2 text-[10px] space-y-1">
            <div className="text-[9px] font-bold uppercase tracking-wider text-amber-400/90 flex items-center gap-1">
              <span>🌿</span> Field Surroundings
            </div>
            <div className="text-gray-300 text-[10px] leading-relaxed">
              {(() => {
                const elev = manifest?.environment?.elevation ?? 0.5;
                const veg = manifest?.environment?.vegetation_density ?? 0.5;
                const chaos = manifest?.environment?.chaos_radiation ?? 0;
                const terrainDesc = elev > 0.65 ? 'High alpine crags with biting gale-winds' : elev < 0.28 ? 'Sunken silt basin and heavy damp mist' : 'Rolling frontier wilds';
                const canopyDesc = veg > 0.65 ? 'under vaulted elderwood canopy' : veg < 0.25 ? 'across barren, wind-scoured scree' : 'flanked by sparse scrub and game trails';
                const auraDesc = chaos > 0.35 ? 'An eerie violet static hum tingles against your skin.' : 'The air smells of crushed pine and damp earth.';
                return `${terrainDesc} ${canopyDesc}. ${auraDesc}`;
              })()}
            </div>
          </div>

          {/* Dynamic Sector Title & Situation */}
          {activeBeat?.title && (
            <div className="space-y-1 pt-0.5 border-t border-gray-800/80">
              <div className="text-[11px] font-bold text-amber-300 tracking-wide flex items-center gap-1.5">
                <span>📍</span>
                <span className="truncate">{activeBeat.title}</span>
              </div>
              {activeBeat.hook && (
                <div className="text-[10.5px] text-gray-300 italic border-l-2 border-amber-500/60 pl-2 py-0.5 bg-black/30 rounded-r">
                  {activeBeat.hook}
                </div>
              )}
            </div>
          )}

          {/* Interactive Roaming Fauna & Wayfarers */}
          <div className="space-y-1 pt-1 border-t border-gray-800">
            <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-amber-400">
              <span>🐾 Roaming Fauna & Wayfarers</span>
              <span className="font-mono text-[9px] text-gray-400">{injectedNPCs.filter(n => n.alive).length} Detected</span>
            </div>
            <div className="space-y-1 max-h-32 overflow-y-auto pr-0.5">
              {injectedNPCs.filter(n => n.alive).map(npc => {
                const dist = Math.round(Math.hypot(npc.pos[0] - localPos.lx, npc.pos[1] - localPos.ly));
                const isTargeted = encounterTarget?.id === npc.id;
                const ringColor = npc.disposition < 0 ? 'text-red-400 border-red-800 bg-red-950/40' : npc.disposition > 0 ? 'text-emerald-400 border-emerald-800 bg-emerald-950/40' : 'text-sky-400 border-sky-800 bg-sky-950/40';
                return (
                  <button
                    type="button"
                    key={npc.id}
                    onClick={() => onTargetSelect(npc)}
                    className={`w-full text-left p-1.5 rounded border transition flex items-center justify-between text-xs font-mono ${
                      isTargeted ? 'bg-amber-950/60 border-amber-500 text-amber-200' : 'bg-black/40 border-gray-800 hover:border-gray-600 text-gray-200'
                    }`}
                    title="Click to target on battlegrid"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={`text-[10px] px-1 rounded border font-bold ${ringColor}`}>
                        {npc.disposition < 0 ? 'Hostile' : npc.disposition > 0 ? 'Ally' : 'Neutral'}
                      </span>
                      <span className="truncate font-semibold text-[11px]">{npc.name}</span>
                    </div>
                    <div className="text-[10px] text-gray-400 shrink-0 font-mono">
                      {dist}t • HP {npc.hp}/{npc.maxHp}
                    </div>
                  </button>
                );
              })}
              {injectedNPCs.filter(n => n.alive).length === 0 && (
                <div className="text-[10.5px] text-gray-500 italic py-0.5">No active creatures roaming in immediate sight.</div>
              )}
            </div>
          </div>

          {/* Interactive Detected Landmarks & Props */}
          <div className="space-y-1 pt-1 border-t border-gray-800">
            <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-amber-400">
              <span>📍 Discovered Landmarks & Props</span>
              <span className="font-mono text-[9px] text-gray-400">{injectedProps.filter(p => !p.isDestroyed).length} Present</span>
            </div>
            <div className="space-y-1 max-h-32 overflow-y-auto pr-0.5">
              {injectedProps.filter(p => !p.isDestroyed).map(prop => {
                const dist = Math.round(Math.hypot(prop.pos[0] - localPos.lx, prop.pos[1] - localPos.ly));
                const isTargeted = encounterTarget?.id === prop.id;
                const tags = Array.isArray(prop.tags) ? prop.tags : [];
                return (
                  <button
                    type="button"
                    key={prop.id}
                    onClick={() => onTargetSelect(prop)}
                    className={`w-full text-left p-1.5 rounded border transition flex items-center justify-between text-xs font-mono ${
                      isTargeted ? 'bg-amber-950/60 border-amber-500 text-amber-200' : 'bg-black/40 border-gray-800 hover:border-gray-600 text-gray-200'
                    }`}
                    title="Click to target on battlegrid"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[10px] text-amber-400">🏛️</span>
                      <span className="truncate font-semibold text-[11px]">{prop.name}</span>
                    </div>
                    <div className="text-[10px] text-gray-400 shrink-0 font-mono">
                      {dist}t • [{tags.slice(0, 2).join(', ')}]
                    </div>
                  </button>
                );
              })}
              {injectedProps.filter(p => !p.isDestroyed).length === 0 && (
                <div className="text-[10.5px] text-gray-500 italic py-0.5">No artificial landmarks nearby.</div>
              )}
            </div>
          </div>

          {/* Exploration Leads & Opportunities */}
          {activeBeat?.objectives && activeBeat.objectives.length > 0 && (
            <div className="space-y-1 pt-1 border-t border-gray-800">
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                📜 Regional Leads & Discoveries
              </div>
              <div className="space-y-1">
                {activeBeat.objectives.map(obj => (
                  <div key={obj.id} className="text-[11px] flex items-start gap-1.5 bg-black/30 p-1.5 rounded border border-gray-800">
                    <span className={obj.completed ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                      {obj.completed ? '✓' : '✦'}
                    </span>
                    <span className={obj.completed ? 'line-through text-gray-500' : 'text-gray-300'}>
                      {obj.description}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 12 Attributes Matrix */}
        {character && (
          <>
            <div>
              <h3 className="text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-1">Body Attributes</h3>
              <div className="grid grid-cols-2 gap-1.5 text-xs font-mono bg-gray-900 rounded p-2 border border-gray-700/60">
                {[
                  ['Might', character.might],
                  ['Endurance', character.endurance],
                  ['Finesse', character.finesse],
                  ['Reflex', character.reflex],
                  ['Vitality', character.vitality],
                  ['Fortitude', character.fortitude]
                ].map(([label, val]) => (
                  <div key={label as string} className="flex justify-between">
                    <span className="text-gray-400">{label}</span>
                    <span className="text-amber-300 font-bold">{val}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-1">Mind Attributes</h3>
              <div className="grid grid-cols-2 gap-1.5 text-xs font-mono bg-gray-900 rounded p-2 border border-gray-700/60">
                {[
                  ['Knowledge', character.knowledge],
                  ['Logic', character.logic],
                  ['Awareness', character.awareness],
                  ['Intuition', character.intuition],
                  ['Charm', character.charm],
                  ['Willpower', character.willpower]
                ].map(([label, val]) => (
                  <div key={label as string} className="flex justify-between">
                    <span className="text-gray-400">{label}</span>
                    <span className="text-blue-300 font-bold">{val}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gray-900 rounded p-2.5 text-xs font-mono border border-gray-700/60 space-y-2 shadow">
              <div className="flex flex-col gap-0.5">
                <div className="flex justify-between items-center text-gray-400">
                  <span className="flex items-center gap-1">⚔️ Weapon:</span>
                  <span className="text-[10px] font-bold text-amber-400 bg-amber-950/80 px-1.5 py-0.5 rounded border border-amber-800 uppercase">
                    {character.weapon_stat ? `${character.weapon_stat} +${character.weapon_mod}` : 'MIGHT'}
                  </span>
                </div>
                <span className="text-orange-300 font-semibold truncate pl-2">{character.equipped_weapon}</span>
              </div>
              <div className="flex flex-col gap-0.5 pt-1.5 border-t border-gray-800">
                <div className="flex justify-between items-center text-gray-400">
                  <span className="flex items-center gap-1">🛡️ Armor:</span>
                  <span className="text-[10px] font-bold text-sky-400 bg-sky-950/80 px-1.5 py-0.5 rounded border border-sky-800 uppercase">
                    {character.armor_stat ? `${character.armor_stat} +${character.armor_mod} (DR ${character.armor_dr ?? 0})` : 'DEFENSE'}
                  </span>
                </div>
                <span className="text-sky-300 font-semibold truncate pl-2">{character.equipped_armor}</span>
              </div>
              {onOpenPaperdoll && (
                <button
                  type="button"
                  onClick={onOpenPaperdoll}
                  className="w-full mt-2 py-1.5 px-2 bg-gradient-to-r from-amber-950/90 to-amber-900/80 hover:from-amber-900 hover:to-amber-850 border border-amber-600/70 hover:border-amber-400 rounded text-[10.5px] font-bold text-amber-300 transition flex items-center justify-center gap-1.5 shadow cursor-pointer active:scale-95"
                >
                  <span>🛡️</span>
                  <span>PAPERDOLL & LOADOUT</span>
                </button>
              )}
            </div>

            {/* Species Traits & Brands */}
            {character.passive_traits && character.passive_traits.length > 0 && (
              <div className="bg-gray-900 rounded p-2.5 border border-gray-700/60 space-y-1.5 shadow">
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                  Species Traits & Brands
                </span>
                <div className="space-y-1">
                  {character.passive_traits.map((t: any, idx: number) => (
                    <div key={idx} className="bg-gray-850 p-1.5 rounded border border-gray-800 text-[10px]">
                      <strong className="text-amber-300 block">✨ {typeof t === 'object' && t ? t.name : t}</strong>
                      {typeof t === 'object' && t?.desc && (
                        <span className="text-gray-400 leading-tight block text-[9.5px] mt-0.5">{t.desc}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Primordial Chaos Mutations */}
            {character.mutations && character.mutations.length > 0 && (
              <div className="bg-purple-950/40 rounded p-2.5 border border-purple-700/60 space-y-1.5 shadow">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-purple-300 uppercase tracking-wider block">
                    ⚡ Primordial Mutations ({character.mutations.length})
                  </span>
                  <span className="text-[9px] font-mono text-purple-400 bg-purple-900/60 px-1 rounded">CORRUPTED</span>
                </div>
                <div className="space-y-1">
                  {character.mutations.map((m: any, idx: number) => {
                    const mods = typeof m.stat_modifiers === 'string' ? JSON.parse(m.stat_modifiers) : (m.stat_modifiers || {});
                    const modStr = Object.entries(mods).map(([s, d]) => `${(d as number) > 0 ? `+${d}` : d} ${s}`).join(', ');
                    return (
                      <div key={idx} className="bg-gray-900/80 p-1.5 rounded border border-purple-900/80 text-[10px]">
                        <div className="flex items-center justify-between">
                          <strong className="text-purple-300">⚡ {m.mutation_name}</strong>
                          {modStr && <span className="text-[9px] text-amber-400 font-mono">[{modStr}]</span>}
                        </div>
                        <span className="text-gray-400 leading-tight block text-[9.5px] mt-0.5">{m.description}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Active Combat Abilities */}
            {character.skills && character.skills.length > 0 && (
              <div className="bg-gray-900 rounded p-2.5 border border-gray-700/60 space-y-1.5 shadow">
                <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider block">
                  Combat Abilities
                </span>
                <div className="space-y-1">
                  {character.skills.map((sk: any, idx: number) => (
                    <div key={idx} className="bg-gray-850 p-1.5 rounded border border-gray-800 text-[10px] flex justify-between items-center">
                      <span className="text-purple-300 font-bold">{sk.name}</span>
                      <span className="text-[9px] font-mono text-amber-400 bg-gray-900 px-1.5 py-0.5 rounded border border-gray-750">{sk.cost}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Adventurer's Pack (Inventory) */}
            <div className="bg-gray-900 rounded p-2.5 border border-gray-700/60 space-y-1.5 shadow">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-yellow-400 uppercase tracking-wider">
                  Adventurer's Pack
                </span>
                <span className="text-[9px] font-mono text-gray-400">
                  {Array.isArray(character.inventory) ? character.inventory.length : 0} Items
                </span>
              </div>
              {Array.isArray(character.inventory) && character.inventory.length > 0 ? (
                <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                  {character.inventory.map((item: string, idx: number) => (
                    <div key={idx} className="bg-gray-850 p-1.5 rounded border border-gray-800 text-[10px] flex justify-between items-center">
                      <span className="text-gray-200 truncate max-w-[140px]">📦 {item}</span>
                      <button
                        type="button"
                        onClick={() => onUseItem(item)}
                        disabled={isActing}
                        className="px-2 py-0.5 bg-yellow-950/80 hover:bg-yellow-850 border border-yellow-700/60 hover:border-yellow-500 text-yellow-300 rounded text-[9px] font-bold transition"
                      >
                        Use
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[10px] text-gray-500 italic p-1">Pack is empty. Search ruins or loot fallen foes.</div>
              )}
            </div>
          </>
        )}

        {/* GPS & Radar */}
        <div className="bg-gray-900 p-2.5 rounded border border-gray-700/60 text-xs font-mono space-y-1.5 text-gray-400">
          <div className="flex justify-between items-center pb-1 border-b border-gray-800">
            <span className="font-bold text-gray-300">POSITION MATRIX</span>
            <button
              type="button"
              onClick={onToggleWorldMap}
              className={`px-2 py-0.5 rounded text-[10px] font-bold border transition flex items-center gap-1 ${
                activeCenterTab === 'worldMap'
                  ? 'bg-amber-950 text-amber-300 border-amber-600'
                  : 'bg-gray-800 hover:bg-gray-750 text-sky-300 border-sky-800/80 hover:border-sky-500'
              }`}
              title="Toggle Global Static Reference Map"
            >
              <span>🗺️</span>
              <span>{activeCenterTab === 'worldMap' ? 'Close Map' : 'World Map'}</span>
            </button>
          </div>
          <div className="flex justify-between">
            <span>Sector:</span> <span className="text-blue-300">({regionalPos.rx}, {regionalPos.ry})</span>
          </div>
          <div className="flex justify-between">
            <span>Tile:</span> <span className="text-amber-400">({localPos.lx}, {localPos.ly})</span>
          </div>
          <div className="flex justify-between">
            <span>Biome:</span> <span className="text-emerald-400">{manifest ? getBiomeName(manifest.global_context.biome_id) : '—'}</span>
          </div>
        </div>

        {/* Music & SFX Deck */}
        <div className="bg-gradient-to-r from-gray-900 via-gray-850 to-gray-900 p-2.5 rounded border border-gray-700/80 shadow-md space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-amber-400 text-xs animate-pulse">🎵</span>
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-gray-200 block truncate" title={currentTrack.title}>
                  {currentTrack.title}
                </span>
                <span className="text-[8.5px] text-gray-400 truncate block">
                  {currentTrack.artist}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={onToggleMusic}
                className="w-6 h-6 bg-amber-950/80 hover:bg-amber-900 border border-amber-700/80 rounded flex items-center justify-center text-amber-300 text-[10px] shadow-sm transition"
                title={isPlayingMusic ? 'Pause Music' : 'Play Music'}
              >
                {isPlayingMusic ? '⏸' : '▶'}
              </button>
              <button
                type="button"
                onClick={onNextTrack}
                className="w-6 h-6 bg-gray-800 hover:bg-gray-700 border border-gray-650 rounded flex items-center justify-center text-gray-300 text-[10px] shadow-sm transition"
                title="Next Track"
              >
                ⏭
              </button>
            </div>
          </div>

          {/* Volume & SFX Toggles */}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-800 text-[10px]">
            <div className="flex items-center gap-1.5 flex-1">
              <button
                type="button"
                onClick={onToggleMute}
                className="text-gray-400 hover:text-white text-[11px]"
                title={isMuted ? 'Unmute Music' : 'Mute Music'}
              >
                {isMuted ? '🔇' : '🔊'}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : musicVol}
                onChange={e => onVolumeChange(parseFloat(e.target.value))}
                className="w-full accent-amber-500 h-1 bg-gray-700 rounded cursor-pointer"
              />
            </div>
            <button
              type="button"
              onClick={onToggleSfx}
              className={`px-1.5 py-0.5 rounded text-[8.5px] font-mono font-bold border transition ${
                sfxMuted
                  ? 'bg-red-950/60 text-red-400 border-red-800'
                  : 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
              }`}
              title="Toggle Sound Effects"
            >
              {sfxMuted ? 'SFX OFF' : 'SFX ON'}
            </button>
            {onToggleAmbient && (
              <button
                type="button"
                onClick={onToggleAmbient}
                className={`px-1.5 py-0.5 rounded text-[8.5px] font-mono font-bold border transition ${
                  ambientMuted
                    ? 'bg-red-950/60 text-red-400 border-red-800'
                    : 'bg-teal-950/60 text-teal-300 border-teal-800'
                }`}
                title="Toggle Procedural Biome Ambient Audio"
              >
                {ambientMuted ? 'AMB OFF' : 'AMB ON'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
