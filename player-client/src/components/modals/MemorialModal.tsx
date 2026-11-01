import React from 'react';

interface MemorialModalProps {
  showMemorialModal: boolean;
  memorialList: any[];
  onClose: () => void;
}

export const MemorialModal: React.FC<MemorialModalProps> = ({
  showMemorialModal,
  memorialList,
  onClose,
}) => {
  if (!showMemorialModal) return null;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4 select-none">
      <div className="bg-gray-950 border-2 border-purple-800/80 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-[0_0_80px_rgba(147,51,234,0.3)] overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 border-b border-gray-800 bg-gray-900 flex justify-between items-center">
          <div>
            <h2 className="text-base md:text-lg font-black text-purple-400 tracking-wider flex items-center gap-2 uppercase">
              <span>🏛️</span> HALL OF THE FALLEN — MEMORIAL ARCHIVE
            </h2>
            <p className="text-xs text-gray-400">Eternal records of heroes fallen under Hardcore Permadeath rules</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white text-base font-bold p-1 rounded hover:bg-gray-800 transition"
          >
            ✕
          </button>
        </div>

        {/* Memorials List */}
        <div className="p-5 overflow-y-auto space-y-3 flex-1 text-gray-200">
          {memorialList.length === 0 ? (
            <div className="p-12 text-center text-gray-400 space-y-2">
              <div className="text-4xl">🕯️</div>
              <div className="text-sm font-semibold text-gray-300">No Heroes Have Fallen</div>
              <p className="text-xs text-gray-500 max-w-md mx-auto">
                The memorial tablets stand clean and unetched. Those who braved Hardcore mode either still wander the wilds or have yet to meet defeat.
              </p>
            </div>
          ) : (
            memorialList.map((m: any) => (
              <div
                key={m.id}
                className="bg-gray-900 p-4 rounded-xl border border-purple-900/50 hover:border-purple-700/80 transition space-y-2 shadow-lg"
              >
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1.5 border-b border-gray-800 pb-2">
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">💀</span>
                    <div>
                      <span className="text-sm font-black text-amber-300">{m.player_name}</span>
                      <span className="text-xs text-gray-400 font-mono ml-2">Lv. {m.level || 1}</span>
                    </div>
                    <span className="text-[10px] bg-red-950 text-red-300 border border-red-800 px-2 py-0.5 rounded font-mono uppercase font-bold">
                      {m.difficulty || 'hardcore'}
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-400 font-mono">
                    {new Date(m.fallen_at).toLocaleDateString()} {new Date(m.fallen_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono text-gray-300">
                  <div>
                    <span className="text-gray-400 block text-[10px]">LINEAGE & SPECIES</span>
                    <span className="text-purple-300">{m.kingdom} • {m.species} ({m.lineage})</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px]">EQUIPMENT</span>
                    <span className="text-gray-200 truncate block">{m.equipped_weapon} / {m.equipped_armor}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px]">FINAL POSITION & PURSE</span>
                    <span className="text-blue-300">Sector ({m.sector_x}, {m.sector_y}) • 💰 {m.gold}g</span>
                  </div>
                </div>

                <div className="pt-1.5 text-xs italic text-gray-400 flex items-center gap-1.5">
                  <span className="text-red-400 font-bold not-italic">Cause of Death:</span>
                  <span>{m.cause_of_death}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-gray-800 bg-gray-900 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-xs font-bold transition"
          >
            Close Archive
          </button>
        </div>
      </div>
    </div>
  );
};
