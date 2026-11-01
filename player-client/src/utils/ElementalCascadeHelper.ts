import type { InjectedProp, InjectedNPC } from '../types';

export interface CraftingRecipe {
  id: string;
  name: string;
  description: string;
  ingredients: { itemKeywords: string[]; count: number }[];
  resultItem: string;
  resultCount: number;
  effectDescription: string;
}

export const FIELD_CRAFTING_RECIPES: CraftingRecipe[] = [
  {
    id: 'herbal_salve',
    name: 'Herbal Healing Salve',
    description: 'Crush wild medicinal leaves into a soothing poultice that closes bleeding wounds.',
    ingredients: [
      { itemKeywords: ['herb', 'lichen', 'fern', 'flora', 'sage', 'moss', 'plant'], count: 1 }
    ],
    resultItem: 'Herbal Healing Salve',
    resultCount: 1,
    effectDescription: 'Restores +10 HP when consumed in or out of combat.'
  },
  {
    id: 'clarity_draught',
    name: 'Clarity Focus Draught',
    description: 'Distill pungent nightshade, fungi, or resonant crystals into an invigorating mental elixir.',
    ingredients: [
      { itemKeywords: ['herb', 'lichen', 'plant', 'flora'], count: 1 },
      { itemKeywords: ['shard', 'crystal', 'resin', 'phial', 'draught', 'fungi', 'mushroom'], count: 1 }
    ],
    resultItem: 'Clarity Focus Draught',
    resultCount: 1,
    effectDescription: 'Restores +10 Focus Points, refilling mental tactical reserves.'
  },
  {
    id: 'firebrand_torch',
    name: 'Firebrand Torch',
    description: 'Wrap dry timber in fibrous cloth to craft a blazing light source.',
    ingredients: [
      { itemKeywords: ['wood', 'timber', 'branch', 'log', 'pelt', 'fiber'], count: 1 }
    ],
    resultItem: 'Blazing Firebrand Torch',
    resultCount: 1,
    effectDescription: 'Illuminates darkness and expands Field of View vision radius by +2.'
  },
  {
    id: 'field_rations',
    name: 'Smoked Field Provisions',
    description: 'Dry and season raw game meat over a camp hearth for nutritious travel rations.',
    ingredients: [
      { itemKeywords: ['meat', 'venison', 'steak', 'haunch', 'game'], count: 1 }
    ],
    resultItem: 'Smoked Field Provisions',
    resultCount: 1,
    effectDescription: 'Nourishes the body, restoring +8 HP and stabilizing Stamina pool.'
  }
];

/**
 * Checks if the player's pack contains all required ingredients for a recipe
 */
export function canCraftRecipe(recipe: CraftingRecipe, inventory: string[]): boolean {
  const invCopy = [...inventory];
  for (const ing of recipe.ingredients) {
    let found = 0;
    for (let i = invCopy.length - 1; i >= 0; i--) {
      const it = invCopy[i].toLowerCase();
      if (ing.itemKeywords.some(kw => it.includes(kw.toLowerCase()))) {
        invCopy.splice(i, 1);
        found++;
        if (found >= ing.count) break;
      }
    }
    if (found < ing.count) return false;
  }
  return true;
}

/**
 * Executes a field crafting recipe, consuming ingredients and returning the updated inventory
 */
export function executeFieldCraft(
  recipe: CraftingRecipe,
  inventory: string[]
): { success: boolean; updatedInventory: string[]; message: string; craftedItem?: string } {
  if (!canCraftRecipe(recipe, inventory)) {
    return {
      success: false,
      updatedInventory: inventory,
      message: `Missing ingredients for ${recipe.name}.`
    };
  }

  const newInv = [...inventory];
  for (const ing of recipe.ingredients) {
    let removed = 0;
    for (let i = newInv.length - 1; i >= 0; i--) {
      const it = newInv[i].toLowerCase();
      if (ing.itemKeywords.some(kw => it.includes(kw.toLowerCase()))) {
        newInv.splice(i, 1);
        removed++;
        if (removed >= ing.count) break;
      }
    }
  }

  for (let i = 0; i < recipe.resultCount; i++) {
    newInv.push(recipe.resultItem);
  }

  return {
    success: true,
    updatedInventory: newInv,
    message: `Crafted ${recipe.resultCount}x ${recipe.resultItem}! (${recipe.effectDescription})`,
    craftedItem: recipe.resultItem
  };
}

/**
 * Forages wild flora props based on regional biome
 */
export function getForagedFloraItem(propName: string, biomeId: number): string {
  const lower = propName.toLowerCase();
  if (lower.includes('lichen') || biomeId === 10 || biomeId === 11) {
    return 'Glacial Frost-Lichen';
  }
  if (lower.includes('nightshade') || biomeId === 12) {
    return 'Bog Nightshade Petals';
  }
  if (biomeId === 1 || biomeId === 2 || biomeId === 3) {
    return 'Sun-Dried Dragonmoss';
  }
  if (lower.includes('fern') || biomeId === 6 || biomeId === 7) {
    return 'Sylvan Silver-Fern';
  }
  return 'Medicinal Wild Sage';
}

/**
 * Simulates fire spread across grid tiles and flammable props over turns
 */
export function processFireSpread(
  tilemap: { grid: Uint8Array; size: number },
  props: InjectedProp[],
  npcs: InjectedNPC[]
): {
  ignitedProps: InjectedProp[];
  damagedProps: InjectedProp[];
  destroyedProps: InjectedProp[];
  burntTiles: { x: number; y: number }[];
  logs: string[];
} {
  const ignitedProps: InjectedProp[] = [];
  const damagedProps: InjectedProp[] = [];
  const destroyedProps: InjectedProp[] = [];
  const burntTiles: { x: number; y: number }[] = [];
  const logs: string[] = [];

  const burningProps = props.filter(p => !p.isDestroyed && Array.isArray(p.tags) && p.tags.includes('burning'));

  for (const burner of burningProps) {
    // 1. Deal burning damage to self
    burner.hp = Math.max(0, burner.hp - 3);
    damagedProps.push(burner);

    if (burner.hp === 0) {
      burner.isDestroyed = true;
      burner.tags = burner.tags.filter(t => t !== 'burning');
      burner.tags.push('cinders', 'destroyed');
      destroyedProps.push(burner);
      logs.push(`🔥 '${burner.name}' burned to cinders.`);
    }

    // 2. Check nearby props for ignition
    for (const other of props) {
      if (other.id === burner.id || other.isDestroyed) continue;
      const dist = Math.hypot(other.pos[0] - burner.pos[0], other.pos[1] - burner.pos[1]);
      if (dist <= 1.5) {
        const otherTags = Array.isArray(other.tags) ? other.tags : [];
        if (!otherTags.includes('burning') && (otherTags.includes('flammable') || otherTags.includes('wood') || otherTags.includes('cloth') || otherTags.includes('dry') || otherTags.includes('flora'))) {
          // 40% chance per turn to spread to adjacent flammable prop
          if (Math.random() < 0.45) {
            other.tags.push('burning');
            ignitedProps.push(other);
            logs.push(`🔥 Blazing embers spread from '${burner.name}' to ignite '${other.name}'!`);
          }
        }
      }
    }

    // 3. Ignite or scorch adjacent tree tiles (tile 1 -> burnt ground 8 or scorched 4)
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const tx = burner.pos[0] + dx;
        const ty = burner.pos[1] + dy;
        if (tx >= 0 && tx < tilemap.size && ty >= 0 && ty < tilemap.size) {
          const tIdx = ty * tilemap.size + tx;
          if (tilemap.grid[tIdx] === 1) { // Tree canopy
            if (Math.random() < 0.35) {
              tilemap.grid[tIdx] = 8; // Turn tree to scorched arid ash
              burntTiles.push({ x: tx, y: ty });
              logs.push(`🔥 Trees at [${tx}, ${ty}] catch fire and collapse into smoking cinders!`);
            }
          }
        }
      }
    }

    // 4. Burn damage to creatures in immediate proximity
    for (const npc of npcs) {
      if (!npc.alive) continue;
      const d = Math.hypot(npc.pos[0] - burner.pos[0], npc.pos[1] - burner.pos[1]);
      if (d <= 1.2) {
        npc.hp = Math.max(0, npc.hp - 2);
        logs.push(`🔥 Radiant heat from '${burner.name}' scorches ${npc.name} for 2 fire damage!`);
        if (npc.hp === 0) npc.alive = false;
      }
    }
  }

  return { ignitedProps, damagedProps, destroyedProps, burntTiles, logs };
}

/**
 * Freezes a water tile into an ice bridge tile (Walkable)
 */
export function freezeWaterTile(
  tx: number,
  ty: number,
  tilemap: { grid: Uint8Array; size: number }
): { success: boolean; message: string } {
  if (tx < 0 || tx >= tilemap.size || ty < 0 || ty >= tilemap.size) {
    return { success: false, message: 'Coordinates out of bounds.' };
  }
  const idx = ty * tilemap.size + tx;
  if (tilemap.grid[idx] === 2) { // Water
    tilemap.grid[idx] = 10; // Ice tile (passable)
    return {
      success: true,
      message: `❄️ Deep freeze crystallizes water at [${tx}, ${ty}] into a solid ice bridge!`
    };
  }
  return { success: false, message: 'Target tile is not water.' };
}
