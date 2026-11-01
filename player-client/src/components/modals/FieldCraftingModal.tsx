import React from 'react';
import {
  FIELD_CRAFTING_RECIPES,
  canCraftRecipe,
  executeFieldCraft,
  type CraftingRecipe
} from '../../utils/ElementalCascadeHelper';

interface FieldCraftingModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: string[];
  onCraftSuccess: (updatedInventory: string[], message: string, craftedItem: string) => void;
}

export const FieldCraftingModal: React.FC<FieldCraftingModalProps> = ({
  isOpen,
  onClose,
  inventory,
  onCraftSuccess
}) => {
  if (!isOpen) return null;

  const handleCraft = (recipe: CraftingRecipe) => {
    const result = executeFieldCraft(recipe, inventory);
    if (result.success && result.craftedItem) {
      onCraftSuccess(result.updatedInventory, result.message, result.craftedItem);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border-2 border-emerald-500/50 rounded-xl max-w-xl w-full p-6 shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🧪</span>
            <div>
              <h2 className="text-xl font-bold tracking-wide text-emerald-400">Field Alchemy & Crafting</h2>
              <p className="text-xs text-slate-400">Combine foraged botanicals, raw timber, and eldritch shards</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white px-2 py-1 rounded hover:bg-slate-800 text-lg"
          >
            ✕
          </button>
        </div>

        {/* Recipes List */}
        <div className="flex-1 overflow-y-auto space-y-3 my-4 pr-1">
          {FIELD_CRAFTING_RECIPES.map(recipe => {
            const canCraft = canCraftRecipe(recipe, inventory);
            return (
              <div
                key={recipe.id}
                className={`p-4 rounded-lg border transition-all ${
                  canCraft
                    ? 'bg-slate-800/80 border-emerald-500/40 hover:border-emerald-400'
                    : 'bg-slate-950/60 border-slate-800 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-100">{recipe.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
                        Field Recipe
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{recipe.description}</p>
                    <p className="text-xs text-amber-300 font-mono mt-1">✨ {recipe.effectDescription}</p>

                    {/* Ingredients summary */}
                    <div className="flex items-center gap-2 mt-2 text-xs">
                      <span className="text-slate-400">Requires:</span>
                      {recipe.ingredients.map((ing, idx) => {
                        const hasKeyword = inventory.some(it =>
                          ing.itemKeywords.some(kw => it.toLowerCase().includes(kw.toLowerCase()))
                        );
                        return (
                          <span
                            key={idx}
                            className={`px-2 py-0.5 rounded border text-[11px] font-mono ${
                              hasKeyword
                                ? 'bg-slate-700/80 text-emerald-300 border-emerald-700'
                                : 'bg-red-950/40 text-red-400 border-red-900/60'
                            }`}
                          >
                            {ing.count}x {ing.itemKeywords[0]} {hasKeyword ? '✓' : '✗'}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    disabled={!canCraft}
                    onClick={() => handleCraft(recipe)}
                    className={`px-4 py-2 rounded-lg font-bold text-sm tracking-wide transition-all shadow-md ${
                      canCraft
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer active:scale-95'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                    }`}
                  >
                    Craft
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer with pack preview */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div>
            Pack Contents: <span className="text-slate-200 font-mono">{inventory.length} items</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

