import React from 'react';

interface ChaosFlowCrossingModalProps {
  isOpen: boolean;
  targetCell: any;
  character: any;
  isSubmitting?: boolean;
  onClose: () => void;
  onConfirmTransit: (method: 'AIRSHIP_OWNED' | 'AIRSHIP_CHARTER' | 'ON_FOOT_HAZARD') => void;
}

export const ChaosFlowCrossingModal: React.FC<ChaosFlowCrossingModalProps> = ({
  isOpen,
  targetCell,
  character,
  isSubmitting = false,
  onClose,
  onConfirmTransit
}) => {
  if (!isOpen || !targetCell) return null;

  const inventory: string[] = Array.isArray(character?.inventory) ? character.inventory : [];
  const ownedAirship = inventory.find(it => /airship|skyship|sky vessel|cloud cruiser|aetheric craft/i.test(it));
  const playerGold = Number(character?.gold) || 0;
  const FERRY_COST = 80;
  const canAffordFerry = playerGold >= FERRY_COST;

  const flowName = targetCell.flow_name || "Primordial Chaos Torrent";
  const dragonName = targetCell.dragon_name || "Chaos Dragon";
  const power = targetCell.elemental_power || "Raw Aether";
  const surge = targetCell.current_surge ? `x${targetCell.current_surge}` : "x1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="bg-gray-950 border-2 border-purple-600/80 rounded-xl max-w-lg w-full shadow-2xl overflow-hidden font-mono text-gray-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-950 via-indigo-950 to-gray-950 p-4 border-b border-purple-700/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl animate-pulse">⚡</span>
            <div>
              <h3 className="text-sm font-bold text-amber-300 tracking-wide uppercase">
                Primordial Flow Barrier
              </h3>
              <p className="text-[11px] text-purple-300 font-semibold">
                {flowName} — {dragonName} ({power})
              </p>
            </div>
          </div>
          <span className="text-[10px] bg-purple-900/80 text-purple-200 px-2 py-0.5 rounded border border-purple-500/50">
            Surge {surge}
          </span>
        </div>

        {/* Body Content */}
        <div className="p-5 space-y-4 text-xs">
          {/* Scale & Hazard Callout */}
          <div className="bg-rose-950/40 border border-rose-700/60 rounded-lg p-3 space-y-1.5 text-rose-200">
            <div className="flex items-center gap-2 font-bold text-rose-300 uppercase tracking-wider text-[11px]">
              <span>⚠️</span>
              <span>Lethal Planetary Rift (Global Scale)</span>
            </div>
            <p className="text-[11.5px] leading-relaxed text-rose-200/90">
              This entire global cell spans a hundreds-of-leagues wide churning rift of pure <strong>{power}</strong> aether converging on the Central Void.
              Attempting to cross on foot across leagues of boiling chaos radiation is <strong>almost certain instant death</strong>.
            </p>
          </div>

          <div className="bg-gray-900/90 border border-gray-800 rounded-lg p-3 space-y-2 text-[11px] text-gray-300">
            <p>
              To safely breach the barrier and reach <strong>Global Cell #{targetCell.id}</strong>, travelers must fly through the atmospheric calm above the vortex via <strong>Airship</strong>.
            </p>
          </div>

          {/* Action Options */}
          <div className="space-y-2.5 pt-1">
            {/* 1. Owned Airship */}
            {ownedAirship ? (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => onConfirmTransit('AIRSHIP_OWNED')}
                className="w-full text-left p-3 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/70 border border-emerald-600/80 transition-all flex items-center justify-between group cursor-pointer"
              >
                <div>
                  <div className="font-bold text-emerald-300 text-xs flex items-center gap-2">
                    <span>🚀</span> Board Personal Skyship [{ownedAirship}]
                  </div>
                  <div className="text-[10px] text-emerald-400/80 mt-0.5">
                    100% Safe Transit • Runic dampening shields neutralize chaotic radiation
                  </div>
                </div>
                <span className="text-emerald-300 font-bold text-xs group-hover:translate-x-1 transition-transform">Fly →</span>
              </button>
            ) : null}

            {/* 2. Charter Skyship Ferry */}
            <button
              type="button"
              disabled={isSubmitting || !canAffordFerry}
              onClick={() => onConfirmTransit('AIRSHIP_CHARTER')}
              className={`w-full text-left p-3 rounded-lg border transition-all flex items-center justify-between ${
                canAffordFerry
                  ? 'bg-purple-950/60 hover:bg-purple-900/70 border-purple-600/80 cursor-pointer group'
                  : 'bg-gray-900/40 border-gray-800 text-gray-500 cursor-not-allowed opacity-60'
              }`}
            >
              <div>
                <div className="font-bold text-purple-300 text-xs flex items-center gap-2">
                  <span>⚓</span> Charter Imperial Sky-Ferry ({FERRY_COST} Gold)
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5">
                  Hire guild sky-captains to ferry your party across the rift (You have: {playerGold}g)
                </div>
              </div>
              <span className="text-purple-300 font-bold text-xs group-hover:translate-x-1 transition-transform">
                {canAffordFerry ? 'Charter →' : 'Too Poor'}
              </span>
            </button>

            {/* 3. Suicidal Foot Attempt */}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => onConfirmTransit('ON_FOOT_HAZARD')}
              className="w-full text-left p-3 rounded-lg bg-rose-950/30 hover:bg-rose-900/50 border border-rose-800/60 hover:border-rose-600 text-rose-300 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-rose-400 text-xs flex items-center gap-2">
                    <span>☠️</span> Attempt Desperate Crossing on Foot
                  </div>
                  <div className="text-[10px] text-rose-300/70 mt-0.5">
                    Opposed DC 25 Survival Check • 35-65 Primordial Damage • Severe Mutation
                  </div>
                </div>
                <span className="text-rose-400 font-bold text-xs group-hover:translate-x-1 transition-transform">Risk Death →</span>
              </div>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-900/90 p-3.5 border-t border-gray-800 flex justify-end">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-200 font-bold text-xs transition-colors cursor-pointer border border-gray-700"
          >
            Turn Back to Safety
          </button>
        </div>
      </div>
    </div>
  );
};

