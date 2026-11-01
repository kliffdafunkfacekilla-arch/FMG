import React from 'react';

interface StartMenuModalProps {
  inStartMenu: boolean;
  character: any;
  currentTrack: { title: string; artist: string };
  isPlayingMusic: boolean;
  onContinue: () => void;
  onNewGame: () => void;
  onOpenLoadModal: () => void;
  onOpenMemorialsModal: () => void;
  onJumpToSector: () => void;
  onToggleMusic: () => void;
  onNextTrack: () => void;
}

export const StartMenuModal: React.FC<StartMenuModalProps> = ({
  inStartMenu,
  character,
  currentTrack,
  isPlayingMusic,
  onContinue,
  onNewGame,
  onOpenLoadModal,
  onOpenMemorialsModal,
  onJumpToSector,
  onToggleMusic,
  onNextTrack,
}) => {
  if (!inStartMenu) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col items-center justify-center p-6 select-none bg-cover bg-center shadow-2xl"
      style={{ backgroundImage: 'linear-gradient(to bottom, rgba(3, 7, 18, 0.76), rgba(0, 0, 0, 0.92)), url("/gfx/Gemini_Generated_Image_4xvege4xvege4xve.png")' }}
    >
      {/* Subtle Ambient Radial Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-900/30 via-transparent to-transparent pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center max-w-md w-full text-center space-y-7">
        {/* Title Header */}
        <div>
          <div className="text-amber-500/80 text-xs font-mono tracking-[0.35em] uppercase mb-2 flex items-center justify-center gap-2">
            <span>✦</span> AETHERIA TTRPG <span>✦</span>
          </div>
          <h1 className="text-5xl font-black text-amber-400 tracking-[0.25em] drop-shadow-[0_4px_16px_rgba(245,158,11,0.3)] font-serif">
            OSTRAKA
          </h1>
          <p className="text-[11px] text-gray-400 font-semibold tracking-[0.35em] uppercase mt-2">
            Fractal Simulation & RPG Engine
          </p>
        </div>

        {/* Active Hero Banner if exists */}
        {character ? (
          <div className="w-full bg-gray-900/90 border border-gray-700/80 rounded-lg p-3 text-left flex items-center justify-between shadow-lg">
            <div>
              <div className="text-xs font-bold text-amber-300">{character.name}</div>
              <div className="text-[11px] text-gray-400">
                Lv. {character.level || 1} • HP {character.current_hp}/{character.max_hp} • {character.equipped_weapon || 'Unarmed'}
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-mono bg-amber-950/80 text-amber-400 px-2 py-0.5 rounded border border-amber-800">
                Active Hero
              </span>
            </div>
          </div>
        ) : null}

        {/* Menu Buttons Stack */}
        <div className="w-full space-y-3">
          <button
            type="button"
            onClick={onContinue}
            className="w-full py-3.5 px-6 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-gray-950 font-black tracking-widest uppercase rounded-lg shadow-lg hover:shadow-amber-600/30 transition flex items-center justify-center gap-3 text-sm group"
          >
            <span className="text-lg group-hover:translate-x-0.5 transition-transform">▶</span>
            {character ? 'CONTINUE JOURNEY' : 'ENTER WORLD'}
          </button>

          <button
            type="button"
            onClick={onNewGame}
            className="w-full py-3 px-6 bg-gray-850 hover:bg-gray-800 border border-amber-500/50 hover:border-amber-400 text-amber-300 font-bold tracking-wider uppercase rounded-lg transition flex items-center justify-center gap-2 text-sm shadow"
          >
            <span>✨</span> NEW GAME / CREATE HERO
          </button>

          <button
            type="button"
            onClick={onOpenLoadModal}
            className="w-full py-3 px-6 bg-gray-850 hover:bg-gray-800 border border-gray-700 hover:border-gray-500 text-gray-300 hover:text-white font-bold tracking-wider uppercase rounded-lg transition flex items-center justify-center gap-2 text-sm shadow"
          >
            <span>📂</span> LOAD SAVED CAMPAIGN
          </button>

          <button
            type="button"
            onClick={onOpenMemorialsModal}
            className="w-full py-2.5 px-6 bg-gray-850 hover:bg-gray-800 border border-purple-800/60 hover:border-purple-600 text-purple-300 hover:text-purple-100 font-bold tracking-wider uppercase rounded-lg transition flex items-center justify-center gap-2 text-xs shadow"
          >
            <span>🏛️</span> HALL OF THE FALLEN (MEMORIALS)
          </button>

          <button
            type="button"
            onClick={onJumpToSector}
            className="w-full py-2.5 px-6 bg-gray-900/60 hover:bg-gray-800/80 border border-gray-800 hover:border-gray-600 text-gray-400 hover:text-gray-200 font-medium tracking-wider uppercase rounded-lg transition flex items-center justify-center gap-2 text-xs"
          >
            <span>🗺️</span> Jump into Sector Map
          </button>
        </div>

        {/* Start Menu Audio Bar */}
        <div className="w-full bg-gray-900/80 border border-gray-750 rounded-lg p-2.5 flex items-center justify-between text-xs shadow-md">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-amber-400">🎵</span>
            <div className="text-left min-w-0">
              <span className="text-[11px] font-bold text-gray-200 block truncate" title={currentTrack.title}>
                {currentTrack.title}
              </span>
              <span className="text-[9px] text-gray-400 block truncate">
                {currentTrack.artist}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onToggleMusic}
              className="px-2.5 py-1 bg-amber-950 hover:bg-amber-900 border border-amber-700 rounded text-amber-300 font-mono text-xs transition"
            >
              {isPlayingMusic ? '⏸ Pause' : '▶ Play'}
            </button>
            <button
              type="button"
              onClick={onNextTrack}
              className="px-2 py-1 bg-gray-800 hover:bg-gray-700 border border-gray-650 rounded text-gray-300 font-mono text-xs transition"
              title="Next Track"
            >
              ⏭
            </button>
          </div>
        </div>

        {/* System Details Footer */}
        <div className="pt-4 border-t border-gray-800/80 w-full flex justify-between items-center text-[10px] text-gray-500 font-mono">
          <span>12 ATTRIBUTES</span>
          <span>AI CHRONICLER</span>
          <span>PERSISTENT WORLD</span>
        </div>
      </div>
    </div>
  );
};
