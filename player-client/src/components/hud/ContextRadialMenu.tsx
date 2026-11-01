import React from 'react';

export interface RadialActionOption {
  id: string;
  label: string;
  icon: string;
  color: string;
  description: string;
  action: () => void;
}

interface ContextRadialMenuProps {
  isOpen: boolean;
  x: number;
  y: number;
  targetName: string;
  targetType: 'npc' | 'prop' | 'tile';
  options: RadialActionOption[];
  onClose: () => void;
}

export const ContextRadialMenu: React.FC<ContextRadialMenuProps> = ({
  isOpen,
  x,
  y,
  targetName,
  targetType,
  options,
  onClose
}) => {
  if (!isOpen || options.length === 0) return null;

  // Radius for positioning circular buttons around the center click point
  const radius = 72;
  const numOptions = options.length;

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden"
      onClick={onClose}
    >
      {/* Backdrop overlay */}
      <div className="absolute inset-0 bg-black/35 backdrop-blur-[1px]" />

      {/* Radial Menu Hub */}
      <div
        className="absolute transform -translate-x-1/2 -translate-y-1/2 select-none"
        style={{ left: `${x}px`, top: `${y}px` }}
        onClick={e => e.stopPropagation()}
      >
        {/* Center Target Indicator Hub */}
        <div className="relative w-16 h-16 rounded-full bg-slate-900 border-2 border-amber-500/80 shadow-2xl flex flex-col items-center justify-center p-1 z-20">
          <span className="text-sm">
            {targetType === 'npc' ? '👤' : targetType === 'prop' ? '📦' : '📍'}
          </span>
          <span className="text-[9px] font-bold text-amber-300 font-mono text-center leading-tight line-clamp-1 max-w-[56px]">
            {targetName.split(' ')[0]}
          </span>
        </div>

        {/* Circular Slice Action Buttons */}
        {options.map((opt, idx) => {
          // Calculate angle for radial distribution (starting from top -PI/2)
          const angle = -Math.PI / 2 + (idx * 2 * Math.PI) / numOptions;
          const btnX = Math.round(Math.cos(angle) * radius);
          const btnY = Math.round(Math.sin(angle) * radius);

          return (
            <div
              key={opt.id}
              className="absolute transform -translate-x-1/2 -translate-y-1/2 z-30"
              style={{ left: `calc(50% + ${btnX}px)`, top: `calc(50% + ${btnY}px)` }}
            >
              <button
                type="button"
                onClick={() => {
                  opt.action();
                  onClose();
                }}
                className={`w-13 h-13 rounded-full flex flex-col items-center justify-center transition-all duration-150 transform hover:scale-115 active:scale-95 shadow-xl border cursor-pointer ${opt.color} group`}
                title={`${opt.label}: ${opt.description}`}
              >
                <span className="text-base group-hover:scale-110 transition-transform">{opt.icon}</span>
                <span className="text-[9px] font-bold font-mono tracking-tight leading-none mt-0.5 text-white drop-shadow">
                  {opt.label}
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

