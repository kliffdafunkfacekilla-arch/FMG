import React from 'react';

interface CenterHeaderBarProps {
  activeCenterTab: 'battlegrid' | 'worldMap';
  encounterTarget: any;
  objDist: number | null;
  distToCenter: number;
  compassDir: string;
  regionalPos: { rx: number; ry: number };
  currentCellId: number;
  cellTelemetry: any;
  onSelectTab: (tab: 'battlegrid' | 'worldMap') => void;
  onOpenCrafting?: () => void;
  isTorchLit?: boolean;
  onToggleTorch?: () => void;
  diurnalInfo?: { icon: string; name: string; timeString: string; phase: string };
}

export const CenterHeaderBar: React.FC<CenterHeaderBarProps> = ({
  activeCenterTab,
  encounterTarget,
  objDist,
  distToCenter,
  compassDir,
  regionalPos,
  currentCellId,
  cellTelemetry,
  onSelectTab,
  onOpenCrafting,
  isTorchLit,
  onToggleTorch,
  diurnalInfo,
}) => {
  return (
    <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/90 via-black/75 to-transparent z-10 flex justify-between items-center">
      <div className="flex items-center gap-3">
        {/* Tab Switcher */}
        <div className="flex items-center bg-gray-900/90 border border-gray-700 rounded-lg p-0.5 shadow-lg">
          <button
            type="button"
            onClick={() => onSelectTab('battlegrid')}
            className={`px-3 py-1 rounded text-xs font-bold transition flex items-center gap-1.5 ${
              activeCenterTab === 'battlegrid'
                ? 'bg-amber-600 text-white shadow'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <span>⚔️</span>
            <span>TACTICAL BATTLEGRID</span>
          </button>
          <button
            type="button"
            onClick={() => onSelectTab('worldMap')}
            className={`px-3 py-1 rounded text-xs font-bold transition flex items-center gap-1.5 ${
              activeCenterTab === 'worldMap'
                ? 'bg-sky-600 text-white shadow'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <span>🗺️</span>
            <span>WORLD MAP</span>
          </button>
        </div>

        {onOpenCrafting && (
          <button
            type="button"
            onClick={onOpenCrafting}
            className="px-2.5 py-1 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-600/70 rounded text-xs font-bold text-emerald-300 transition flex items-center gap-1 shadow cursor-pointer active:scale-95"
            title="Open Field Alchemy & Crafting"
          >
            <span>🧪</span>
            <span>FIELD CRAFT</span>
          </button>
        )}

        {onToggleTorch && (
          <button
            type="button"
            onClick={onToggleTorch}
            className={`px-2.5 py-1 rounded text-xs font-bold transition flex items-center gap-1 shadow cursor-pointer active:scale-95 border ${
              isTorchLit
                ? 'bg-amber-600/90 hover:bg-amber-500 border-amber-400 text-white shadow-amber-500/30 shadow-md animate-pulse'
                : 'bg-stone-900/80 hover:bg-stone-800 border-stone-600 text-stone-300'
            }`}
            title="Toggle Blazing Firebrand Torch (Hotkey: T)"
          >
            <span>🔥</span>
            <span>{isTorchLit ? 'TORCH LIT (+4 FOV)' : 'TORCH (T)'}</span>
          </button>
        )}

        {activeCenterTab === 'battlegrid' && encounterTarget && (
          <span className="text-xs bg-red-950 text-red-400 border border-red-700 px-2 py-0.5 rounded font-mono animate-pulse">
            IN RANGE: {encounterTarget.name}
          </span>
        )}
      </div>

      <div className="flex gap-2 text-xs font-mono items-center">
        {activeCenterTab === 'battlegrid' ? (
          <>
            {diurnalInfo && (
              <div className="bg-gray-900/90 border border-gray-700 px-2.5 py-1 rounded text-amber-200 flex items-center gap-1.5 shadow" title={diurnalInfo.name}>
                <span>{diurnalInfo.icon}</span>
                <span className="font-bold">{diurnalInfo.timeString}</span>
                <span className="text-[10px] text-gray-400 font-mono">[{diurnalInfo.phase}]</span>
              </div>
            )}
            {objDist !== null && (
              <div className="bg-amber-950/80 border border-amber-600/80 px-2.5 py-1 rounded text-amber-300 flex items-center gap-1.5 shadow">
                <span>🎯</span>
                <span>Objective: <strong className="text-white">{objDist}m</strong></span>
              </div>
            )}
            <div className="bg-gray-900/80 border border-gray-700 px-3 py-1 rounded text-gray-300">
              🧭 Center: {distToCenter}m {compassDir}
            </div>
          </>
        ) : (
          <div className="bg-gray-900/90 border border-sky-800/80 px-3 py-1 rounded text-sky-300 flex items-center gap-2 shadow">
            <span>📍 Global Sector:</span>
            <strong className="text-white font-mono">X:{regionalPos.rx} Y:{regionalPos.ry}</strong>
            <span className="text-gray-500">•</span>
            <span className="text-amber-400 font-mono">Cell {currentCellId}</span>
            {cellTelemetry?.cell?.current_temp !== undefined && (
              <>
                <span className="text-gray-500">•</span>
                <span className="text-cyan-300 font-mono">🌡️ {cellTelemetry.cell.current_temp}°C</span>
              </>
            )}
            {cellTelemetry?.cell?.elevation !== undefined && (
              <>
                <span className="text-gray-500">•</span>
                <span className="text-emerald-300 font-mono">⛰️ {cellTelemetry.cell.elevation}m</span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
