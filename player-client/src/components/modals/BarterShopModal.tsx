import React from 'react';

interface BarterShopModalProps {
  showBarterModal: boolean;
  tradeStatus: string | null;
  tradeCatalog: any[];
  character: any;
  onClose: () => void;
  onBuyItem: (ware: any) => void;
  onSellItem: (itemName: string, idx: number) => void;
}

export const BarterShopModal: React.FC<BarterShopModalProps> = ({
  showBarterModal,
  tradeStatus,
  tradeCatalog,
  character,
  onClose,
  onBuyItem,
  onSellItem,
}) => {
  if (!showBarterModal) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div className="bg-gray-900 border border-amber-600/70 w-full max-w-4xl max-h-[90vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-gray-800 bg-gray-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-amber-400 tracking-wide flex items-center gap-2">
                <span>⚖️</span> MERCANTILE BARTER & PROVISIONS
              </h3>
              <span className="font-mono text-xs px-2.5 py-0.5 rounded bg-amber-950 border border-amber-700 text-amber-300 font-bold">
                💰 {character?.gold ?? 0} Gold in Purse
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Exchange coin for adventuring gear and commodities. Liquidate field salvage and foraged goods.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-750 rounded-lg transition self-end sm:self-center"
          >
            ✕
          </button>
        </div>

        {/* Trade Status Feedback Toast */}
        {tradeStatus && (
          <div className="px-4 py-2 bg-amber-950/80 border-b border-amber-700/60 text-xs font-mono text-amber-300 flex items-center gap-2">
            <span>🔔</span> {tradeStatus}
          </div>
        )}

        {/* Modal Body: 2 Columns (Merchant Wares vs Player Pack) */}
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left Column: Merchant Wares */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-gray-800 pb-2">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <span>🛒</span> Merchant Inventory ({tradeCatalog.length} Items)
              </span>
              <span className="text-[10px] font-mono text-gray-500">Live Simulation Index</span>
            </div>

            <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
              {tradeCatalog.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-500 italic">
                  Fetching wares from merchant caravan...
                </div>
              ) : (
                tradeCatalog.map((ware, idx) => {
                  const canAfford = (character?.gold ?? 0) >= ware.price;
                  return (
                    <div
                      key={`${ware.name}-${idx}`}
                      className="bg-gray-850 hover:bg-gray-800 p-2.5 rounded-xl border border-gray-750 flex items-center justify-between gap-3 transition"
                    >
                      <div className="flex items-start gap-2.5 flex-1 min-w-0">
                        <span className="text-xl shrink-0 mt-0.5">{ware.icon || '📦'}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white truncate">{ware.name}</span>
                            <span className="text-[9px] font-mono uppercase px-1 rounded bg-gray-900 border border-gray-700 text-gray-400">
                              {ware.type}
                            </span>
                          </div>
                          <p className="text-[10px] text-gray-400 truncate mt-0.5" title={ware.desc}>
                            {ware.desc}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-xs font-bold text-amber-400">
                          {ware.price}g
                        </span>
                        <button
                          type="button"
                          disabled={!canAfford}
                          onClick={() => onBuyItem(ware)}
                          className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition shadow-sm ${
                            canAfford
                              ? 'bg-amber-600 hover:bg-amber-500 text-black'
                              : 'bg-gray-850 text-gray-500 cursor-not-allowed border border-gray-750'
                          }`}
                        >
                          Buy
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Player's Pack */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-gray-800 pb-2">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <span>🎒</span> Your Pack ({Array.isArray(character?.inventory) ? character.inventory.length : 0} Items)
              </span>
              <span className="text-[10px] font-mono text-gray-400">
                Purse: <strong className="text-amber-300">{character?.gold ?? 0}g</strong>
              </span>
            </div>

            <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
              {!Array.isArray(character?.inventory) || character.inventory.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-500 border border-dashed border-gray-800 rounded-xl space-y-1">
                  <p>Your pack is currently empty.</p>
                  <p className="text-[10px] text-gray-600">Forage flora, butcher wild game, or loot field caches to gather tradeable items.</p>
                </div>
              ) : (
                character.inventory.map((item: string, idx: number) => {
                  const matchingWare = tradeCatalog.find(w => w.name.toLowerCase() === item.toLowerCase());
                  const salePrice = matchingWare ? matchingWare.sellPrice : 6;
                  return (
                    <div
                      key={`${item}-${idx}`}
                      className="bg-gray-850 hover:bg-gray-800 p-2.5 rounded-xl border border-gray-750 flex items-center justify-between gap-3 transition"
                    >
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <span className="text-lg shrink-0">{matchingWare?.icon || '🎒'}</span>
                        <div className="min-w-0 flex-1">
                          <span className="text-xs font-bold text-emerald-200 truncate block">{item}</span>
                          <span className="text-[10px] text-gray-500 font-mono">Pack Slot #{idx + 1}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-xs font-bold text-emerald-400">
                          +{salePrice}g
                        </span>
                        <button
                          type="button"
                          onClick={() => onSellItem(item, idx)}
                          className="px-3 py-1 bg-emerald-950 hover:bg-emerald-800 text-emerald-300 border border-emerald-700/70 rounded-lg text-xs font-mono font-bold transition shadow-sm"
                        >
                          Sell
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-gray-800 bg-gray-950 flex justify-between items-center text-xs font-mono text-gray-400">
          <span>Prices fluctuate with municipal supply and demand loops.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-bold transition"
          >
            Close Barter
          </button>
        </div>
      </div>
    </div>
  );
};
