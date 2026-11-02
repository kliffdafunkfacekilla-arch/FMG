import React from 'react';

interface WorldMapTabProps {
  cellTelemetry: any;
  regionalPos: { rx: number; ry: number };
  character: any;
  onFastTravel: (targetCell: any) => void;
}

export const WorldMapTab: React.FC<WorldMapTabProps> = ({
  cellTelemetry,
  regionalPos,
  character,
  onFastTravel,
}) => {
  const handleMapClick = async (e: React.MouseEvent<HTMLImageElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickPercentX = (e.clientX - rect.left) / rect.width;
    const clickPercentY = (e.clientY - rect.top) / rect.height;
    const worldX = clickPercentX * 2819;
    const worldY = clickPercentY * 1481;
    try {
      const res = await fetch(`http://localhost:3000/api/regional/nearest?x=${worldX}&y=${worldY}`);
      const data = await res.json();
      if (data.cell) {
        const targetCell = data.cell;
        if (targetCell.is_flow_cell) {
          // Primordial Chaos Flow: route to dedicated lethal crossing modal
          onFastTravel(targetCell);
        } else if (window.confirm(`Fast-travel across the realm to Global Cell ${targetCell.id} (${targetCell.faction_name || 'Wild Frontier'})?`)) {
          onFastTravel(targetCell);
        }
      }
    } catch (err) {
      console.error('World map travel error:', err);
    }
  };

  const pinPercentX = cellTelemetry?.cell
    ? Math.max(2, Math.min(98, (cellTelemetry.cell.center_x / 2819) * 100 + ((regionalPos.rx - 112) * 0.05)))
    : Math.max(2, Math.min(98, (1278.22 / 2819) * 100 + ((regionalPos.rx - 105) * 0.1)));
  const pinPercentY = cellTelemetry?.cell
    ? Math.max(2, Math.min(98, (cellTelemetry.cell.center_y / 1481) * 100 + ((regionalPos.ry - 112) * 0.05)))
    : Math.max(2, Math.min(98, (574.00 / 1481) * 100 + ((regionalPos.ry - 112) * 0.1)));

  return (
    <div className="flex flex-col items-center justify-center w-full h-full p-8 pt-16">
      <div className="relative bg-slate-950 border-2 border-sky-900/80 rounded-xl overflow-hidden shadow-2xl max-w-4xl max-h-[75vh] flex flex-col items-center">
        {/* Reference Map Image (Rendered from Okasha planetary geometry) */}
        <div className="relative overflow-hidden flex items-center justify-center bg-[#101828]">
          <img
            src="/world_reference.svg"
            alt="World Map Reference"
            onClick={handleMapClick}
            className="max-h-[64vh] w-auto object-contain block opacity-90 cursor-crosshair hover:opacity-100 transition"
            title="Click any territory on Ostraka to fast travel"
            style={{ imageRendering: 'pixelated' }}
          />

          {/* Player Location Marker Pin */}
          <div
            className="absolute z-20 flex flex-col items-center -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-all duration-300"
            style={{ left: `${pinPercentX}%`, top: `${pinPercentY}%` }}
          >
            {/* Pulsing Target Radar Ring */}
            <div className="w-7 h-7 rounded-full border-2 border-amber-400 bg-amber-500/20 animate-ping absolute -top-1 -left-1" />
            <div className="w-5 h-5 rounded-full bg-red-600 border-2 border-white shadow-lg flex items-center justify-center text-[10px] font-bold text-white z-10">
              ⚔️
            </div>
            <div className="mt-1 bg-black/90 border border-amber-500/80 px-2 py-0.5 rounded text-[10px] font-mono text-amber-300 shadow-xl whitespace-nowrap">
              {character?.name || 'You'} (Sec: {regionalPos.rx}, {regionalPos.ry})
            </div>
          </div>
        </div>

        {/* Footer Legend */}
        <div className="w-full bg-slate-900/95 border-t border-sky-950 px-4 py-2 flex items-center justify-between text-xs font-mono text-gray-400">
          <div className="flex items-center gap-3">
            <span className="text-gray-300 font-bold">LEGEND:</span>
            <span className="flex items-center gap-1 text-[11px]"><span className="w-2.5 h-2.5 rounded-sm bg-[#101828] border border-gray-700" /> Ocean</span>
            <span className="flex items-center gap-1 text-[11px]"><span className="w-2.5 h-2.5 rounded-sm bg-[#46a758]" /> Wilds</span>
            <span className="flex items-center gap-1 text-[11px]"><span className="w-2.5 h-2.5 rounded-sm bg-[#fde047]" /> Plains</span>
            <span className="flex items-center gap-1 text-[11px]"><span className="w-2.5 h-2.5 rounded-sm bg-[#0f766e]" /> Forest</span>
            <span className="flex items-center gap-1 text-[11px]"><span className="w-2.5 h-2.5 rounded-sm bg-[#f8fafc]" /> Glaciers</span>
          </div>
          <span className="text-gray-400 font-semibold">Realm Map</span>
        </div>
      </div>
    </div>
  );
};
