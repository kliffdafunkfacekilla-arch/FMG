import React from 'react';

interface SaveGameModalProps {
  showSaveModal: boolean;
  saveSlotName: string;
  regionalPos: { rx: number; ry: number };
  localPos: { lx: number; ly: number };
  character: any;
  activeBeat: any;
  onSlotNameChange: (name: string) => void;
  onClose: () => void;
  onSaveGame: () => void;
}

export const SaveGameModal: React.FC<SaveGameModalProps> = ({
  showSaveModal,
  saveSlotName,
  regionalPos,
  localPos,
  character,
  activeBeat,
  onSlotNameChange,
  onClose,
  onSaveGame,
}) => {
  if (!showSaveModal) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-850 border border-emerald-600/70 rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="p-4 border-b border-gray-700 bg-gray-900 flex justify-between items-center">
          <h2 className="text-base font-bold text-emerald-400 tracking-wider flex items-center gap-2">
            <span>💾</span> SAVE GAME PROGRESS
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white text-base font-bold p-1"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-gray-300 uppercase tracking-wider">Save Slot Name</label>
            <input
              type="text"
              value={saveSlotName}
              onChange={e => onSlotNameChange(e.target.value)}
              placeholder={`Campaign - Sector (${regionalPos.rx}, ${regionalPos.ry})`}
              className="bg-gray-900 border border-gray-700 focus:border-emerald-500 rounded px-3 py-2 text-sm text-white focus:outline-none"
            />
          </div>

          <div className="bg-gray-900 p-3 rounded border border-gray-750 text-xs font-mono space-y-1.5 text-gray-300">
            <div className="flex justify-between">
              <span className="text-gray-400">Hero:</span>
              <span className="text-amber-300 font-bold">{character?.name} (Lv. {character?.level})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Position:</span>
              <span className="text-blue-300">Sector ({regionalPos.rx}, {regionalPos.ry}) Tile ({localPos.lx}, {localPos.ly})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Health:</span>
              <span className="text-emerald-400 font-bold">{character?.current_hp}/{character?.max_hp} HP</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Quest:</span>
              <span className="text-white line-clamp-1">{activeBeat?.title || 'Wilderness Exploration'}</span>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-700 bg-gray-900 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-sm font-semibold transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSaveGame}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-sm font-bold transition flex items-center gap-1.5 shadow"
          >
            <span>💾</span> Confirm Save
          </button>
        </div>
      </div>
    </div>
  );
};

interface LoadGameModalProps {
  showLoadModal: boolean;
  saveSlots: any[];
  onClose: () => void;
  onLoadGame: (saveId: number) => void;
  onDeleteSave: (saveId: number) => void;
}

export const LoadGameModal: React.FC<LoadGameModalProps> = ({
  showLoadModal,
  saveSlots,
  onClose,
  onLoadGame,
  onDeleteSave,
}) => {
  if (!showLoadModal) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-850 border border-blue-600/70 rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="p-4 border-b border-gray-700 bg-gray-900 flex justify-between items-center">
          <h2 className="text-base font-bold text-blue-400 tracking-wider flex items-center gap-2">
            <span>📂</span> LOAD SAVED GAME
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white text-base font-bold p-1"
          >
            ✕
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-3 flex-1">
          {saveSlots.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm italic">
              No saved games found. Click &quot;Save&quot; in the HUD to record your journey.
            </div>
          ) : (
            saveSlots.map((slot) => {
              const wPos = typeof slot.world_pos === 'string' ? JSON.parse(slot.world_pos) : slot.world_pos;
              return (
                <div
                  key={slot.id}
                  className="bg-gray-900 hover:bg-gray-850 p-3.5 rounded-lg border border-gray-750 hover:border-blue-500/80 transition flex flex-col md:flex-row justify-between items-start md:items-center gap-3 shadow-md"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">{slot.slot_name}</span>
                      <span className="text-[10px] text-gray-400 font-mono">
                        {new Date(slot.updated_at).toLocaleDateString()} {new Date(slot.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="text-xs font-mono text-gray-300 flex flex-wrap gap-x-3 gap-y-0.5">
                      <span>Hero: <strong className="text-amber-300">{slot.player_name || 'Hero'}</strong> (Lv. {slot.player_level || 1})</span>
                      <span>HP: <strong className="text-emerald-400">{slot.player_hp}/{slot.player_max_hp}</strong></span>
                      <span>💰 {slot.player_gold ?? 50}g</span>
                      <span>Sector: <strong className="text-blue-300">({wPos?.rx ?? 105}, {wPos?.ry ?? 112})</strong></span>
                    </div>
                    {slot.quest_title && (
                      <div className="text-[11px] text-gray-400 italic">
                        Quest: <span className="text-amber-200">{slot.quest_title}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-center">
                    <button
                      type="button"
                      onClick={() => onLoadGame(slot.id)}
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-bold transition flex items-center gap-1 shadow"
                    >
                      <span>▶️</span> Load
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteSave(slot.id)}
                      className="px-2.5 py-1.5 bg-gray-800 hover:bg-red-950 text-gray-400 hover:text-red-400 border border-gray-700 hover:border-red-700 rounded text-xs font-bold transition"
                      title="Delete Save"
                    >
                      <span>🗑️</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="p-4 border-t border-gray-700 bg-gray-900 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-sm font-semibold transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
