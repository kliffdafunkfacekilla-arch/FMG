import React, { useState } from 'react';

interface VirtualTouchControlsProps {
  onMove: (dx: number, dy: number) => void;
  onAction: (key: string) => void;
  inCombat: boolean;
  onEndTurn: () => void;
}

export const VirtualTouchControls: React.FC<VirtualTouchControlsProps> = ({
  onMove,
  onAction,
  inCombat,
  onEndTurn,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="absolute bottom-6 right-6 z-40 flex flex-col items-end gap-2 pointer-events-none select-none">
      {/* Toggle button */}
      <button
        type="button"
        onClick={() => setIsCollapsed(prev => !prev)}
        className="pointer-events-auto bg-gray-900/90 border border-gray-700 hover:border-amber-500 text-gray-300 text-xs px-2.5 py-1 rounded-full shadow-lg backdrop-blur-sm transition flex items-center gap-1 font-mono"
        title="Toggle on-screen touch controls"
      >
        <span>🎮</span>
        <span>{isCollapsed ? 'Show Touchpad' : 'Hide Touchpad'}</span>
      </button>

      {!isCollapsed && (
        <div className="pointer-events-auto bg-gray-950/85 border border-gray-800 rounded-2xl p-3 shadow-2xl backdrop-blur-md flex flex-col gap-3">
          {/* Virtual D-Pad (Up, Down, Left, Right) */}
          <div className="grid grid-cols-3 gap-1.5 w-32 h-32 mx-auto">
            <div />
            <button
              type="button"
              onClick={() => onMove(0, -1)}
              className="bg-gray-800/90 hover:bg-amber-600 active:bg-amber-500 text-white rounded-xl flex items-center justify-center font-bold text-base shadow border border-gray-700 active:scale-95 transition"
            >
              ▲
            </button>
            <div />

            <button
              type="button"
              onClick={() => onMove(-1, 0)}
              className="bg-gray-800/90 hover:bg-amber-600 active:bg-amber-500 text-white rounded-xl flex items-center justify-center font-bold text-base shadow border border-gray-700 active:scale-95 transition"
            >
              ◀
            </button>
            <div className="flex items-center justify-center text-[10px] font-mono text-gray-500">
              MOVE
            </div>
            <button
              type="button"
              onClick={() => onMove(1, 0)}
              className="bg-gray-800/90 hover:bg-amber-600 active:bg-amber-500 text-white rounded-xl flex items-center justify-center font-bold text-base shadow border border-gray-700 active:scale-95 transition"
            >
              ▶
            </button>

            <div />
            <button
              type="button"
              onClick={() => onMove(0, 1)}
              className="bg-gray-800/90 hover:bg-amber-600 active:bg-amber-500 text-white rounded-xl flex items-center justify-center font-bold text-base shadow border border-gray-700 active:scale-95 transition"
            >
              ▼
            </button>
            <div />
          </div>

          {/* Quick Action Touch Buttons */}
          <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-gray-850">
            <button
              type="button"
              onClick={() => onAction('1')}
              className="px-2 py-1.5 rounded-lg bg-gray-900 hover:bg-rose-900/60 active:bg-rose-800 text-[11px] font-mono font-bold text-rose-300 border border-gray-800 flex items-center justify-center gap-1 shadow"
            >
              <span>⚔️</span> Atk
            </button>
            <button
              type="button"
              onClick={() => onAction('2')}
              className="px-2 py-1.5 rounded-lg bg-gray-900 hover:bg-indigo-900/60 active:bg-indigo-800 text-[11px] font-mono font-bold text-indigo-300 border border-gray-800 flex items-center justify-center gap-1 shadow"
            >
              <span>👤</span> Snk
            </button>
            <button
              type="button"
              onClick={() => onAction('3')}
              className="px-2 py-1.5 rounded-lg bg-gray-900 hover:bg-amber-900/60 active:bg-amber-800 text-[11px] font-mono font-bold text-amber-300 border border-gray-800 flex items-center justify-center gap-1 shadow"
            >
              <span>🔍</span> Srch
            </button>

            <button
              type="button"
              onClick={() => onAction('4')}
              className="px-2 py-1.5 rounded-lg bg-gray-900 hover:bg-blue-900/60 active:bg-blue-800 text-[11px] font-mono font-bold text-blue-300 border border-gray-800 flex items-center justify-center gap-1 shadow"
            >
              <span>💬</span> Talk
            </button>
            <button
              type="button"
              onClick={() => onAction('5')}
              className="px-2 py-1.5 rounded-lg bg-gray-900 hover:bg-emerald-900/60 active:bg-emerald-800 text-[11px] font-mono font-bold text-emerald-300 border border-gray-800 flex items-center justify-center gap-1 shadow"
            >
              <span>🛡️</span> Pause
            </button>
            {inCombat ? (
              <button
                type="button"
                onClick={onEndTurn}
                className="px-2 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 active:bg-amber-400 text-[11px] font-mono font-black text-black border border-amber-400 flex items-center justify-center gap-1 shadow"
              >
                <span>⏩</span> Pass
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onAction('T')}
                className="px-2 py-1.5 rounded-lg bg-gray-900 hover:bg-amber-900/60 active:bg-amber-800 text-[11px] font-mono font-bold text-amber-300 border border-gray-800 flex items-center justify-center gap-1 shadow"
              >
                <span>🔥</span> Torch
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

