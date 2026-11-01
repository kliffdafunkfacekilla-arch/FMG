import React from 'react';

interface DeathModalProps {
  showDeathModal: boolean;
  character: any;
  hardcoreDeathProcessed: boolean;
  regionalPos: { rx: number; ry: number };
  localPos: { lx: number; ly: number };
  onRevivePlayer: () => void;
  onOpenLoadModal: () => void;
  onReturnToMainMenu: () => void;
  onOpenMemorialsModal: () => void;
  onForgeNewHero: () => void;
}

export const DeathModal: React.FC<DeathModalProps> = ({
  showDeathModal,
  character,
  hardcoreDeathProcessed,
  regionalPos,
  localPos,
  onRevivePlayer,
  onOpenLoadModal,
  onReturnToMainMenu,
  onOpenMemorialsModal,
  onForgeNewHero,
}) => {
  if (!showDeathModal) return null;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4 select-none">
      <div className="bg-gray-950 border-2 border-red-700/80 rounded-2xl w-full max-w-md shadow-[0_0_60px_rgba(220,38,38,0.6)] overflow-hidden text-center p-6 space-y-5">
        <div className="text-5xl animate-bounce">💀</div>
        <div>
          <h2 className="text-2xl font-black text-red-500 tracking-widest uppercase font-serif">
            YOU HAVE FALLEN
          </h2>
          <p className="text-xs text-gray-300 mt-2 leading-relaxed italic">
            Your strength gives out. The mortal wounds are too severe, and darkness claims your sight.
          </p>
          {character?.difficulty === 'casual' && (
            <p className="text-[11px] text-emerald-400/90 mt-1.5 leading-snug">
              [Casual Mode] You may recover your senses at a field camp or reload an earlier save.
            </p>
          )}
          {(character?.difficulty || 'survivor') === 'survivor' && (
            <p className="text-[11px] text-amber-400/90 mt-1.5 leading-snug">
              [Survivor Mode] Death is final for this attempt. No field respawn is granted. Reload your last saved game to try again.
            </p>
          )}
          {character?.difficulty === 'hardcore' && (
            <div className="space-y-1">
              <p className="text-[11px] text-red-400 font-bold mt-1.5 leading-snug">
                [Hardcore Permadeath] All save files for this character have been deleted. Your deeds are immortalized in the Hall of the Fallen.
              </p>
              {hardcoreDeathProcessed && (
                <span className="inline-block text-[10px] bg-red-950 text-red-300 border border-red-800 px-2.5 py-0.5 rounded font-mono">
                  ✓ Save Archive Purged • Memorial Etched
                </span>
              )}
            </div>
          )}
        </div>

        <div className="bg-gray-900 border border-red-950/80 p-3.5 rounded-xl text-xs font-mono text-gray-300 space-y-1.5 text-left">
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Hero:</span>
            <span className="text-amber-300 font-bold">{character?.name} (Lv. {character?.level || 1})</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Difficulty:</span>
            <span className={`font-bold uppercase ${
              character?.difficulty === 'casual'
                ? 'text-emerald-400'
                : character?.difficulty === 'hardcore'
                ? 'text-red-400'
                : 'text-amber-400'
            }`}>
              {character?.difficulty || 'survivor'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Loadout:</span>
            <span className="text-gray-200 truncate max-w-[220px]">{character?.equipped_weapon || 'Unarmed'} & {character?.equipped_armor || 'Rags'}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Purse:</span>
            <span className="text-yellow-400 font-bold">{character?.gold || 0} Gold</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Fallen At:</span>
            <span className="text-blue-300">Sector ({regionalPos.rx}, {regionalPos.ry}) Tile ({localPos.lx}, {localPos.ly})</span>
          </div>
        </div>

        {/* Difficulty-Specific Action Buttons */}
        <div className="flex flex-col gap-2.5 pt-2">
          {character?.difficulty === 'casual' && (
            <>
              <button
                type="button"
                onClick={onRevivePlayer}
                className="w-full py-3 px-4 bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-600 hover:to-teal-600 text-white font-black tracking-wider uppercase rounded-lg shadow-lg hover:shadow-emerald-600/30 transition text-xs flex items-center justify-center gap-2"
              >
                <span>🕯️</span> Recover & Continue (-25 Gold)
              </button>
              <button
                type="button"
                onClick={onOpenLoadModal}
                className="w-full py-2.5 px-4 bg-gray-850 hover:bg-gray-800 border border-gray-700 hover:border-gray-500 text-gray-300 hover:text-white font-bold tracking-wider uppercase rounded-lg transition text-xs flex items-center justify-center gap-2"
              >
                <span>📂</span> Load Saved Game
              </button>
              <button
                type="button"
                onClick={onReturnToMainMenu}
                className="w-full py-2 px-4 bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-400 hover:text-gray-200 font-semibold rounded-lg transition text-xs"
              >
                Return to Main Menu
              </button>
            </>
          )}

          {(character?.difficulty || 'survivor') === 'survivor' && (
            <>
              <button
                type="button"
                onClick={onOpenLoadModal}
                className="w-full py-3 px-4 bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-600 hover:to-indigo-600 text-white font-black tracking-wider uppercase rounded-lg shadow-lg hover:shadow-blue-600/30 transition text-xs flex items-center justify-center gap-2"
              >
                <span>📂</span> Load Last Saved Game
              </button>
              <button
                type="button"
                onClick={onReturnToMainMenu}
                className="w-full py-2.5 px-4 bg-gray-850 hover:bg-gray-800 border border-gray-700 hover:border-gray-500 text-gray-300 hover:text-white font-bold tracking-wider uppercase rounded-lg transition text-xs flex items-center justify-center gap-2"
              >
                <span>🏠</span> Return to Main Menu
              </button>
            </>
          )}

          {character?.difficulty === 'hardcore' && (
            <>
              <button
                type="button"
                onClick={onOpenMemorialsModal}
                className="w-full py-3 px-4 bg-gradient-to-r from-purple-800 to-red-800 hover:from-purple-700 hover:to-red-700 text-white font-black tracking-wider uppercase rounded-lg shadow-lg hover:shadow-purple-600/30 transition text-xs flex items-center justify-center gap-2"
              >
                <span>🏛️</span> View Hall of the Fallen
              </button>
              <button
                type="button"
                onClick={onForgeNewHero}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-gray-950 font-black tracking-wider uppercase rounded-lg transition text-xs flex items-center justify-center gap-2"
              >
                <span>✨</span> Forge New Hero
              </button>
              <button
                type="button"
                onClick={onReturnToMainMenu}
                className="w-full py-2 px-4 bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-400 hover:text-gray-200 font-semibold rounded-lg transition text-xs"
              >
                Return to Main Menu
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
