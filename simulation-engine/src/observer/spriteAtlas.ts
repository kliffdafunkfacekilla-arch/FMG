import React, { useEffect, useState } from 'react';

export const SHEET_WIDTH = 1248;
export const SHEET_HEIGHT = 832;

const numberedSheets = (prefix: string, count: number): string[] => {
  const list = [`/gfx/${prefix}.jpg`];
  for (let i = 1; i < count; i++) {
    list.push(`/gfx/${prefix} (${i}).jpg`);
  }
  return list;
};

export const PORTRAIT_SHEETS = numberedSheets(
  'A_sheet_of_isolated_square_character_portrait_icons_each_cen',
  32
);

export const WEAPON_SHEETS = numberedSheets(
  'A_sheet_of_isolated_square_weapon_icons_each_centered_in_its',
  8
);

export const ARMOR_SHEETS = numberedSheets(
  'A_sheet_of_isolated_square_armor_icons_each_centered_in_its',
  4
);

export const FOOD_SHEETS = numberedSheets(
  'A_sheet_of_isolated_square_food_icons_each_centered_in_its_o',
  4
);

export const POTION_SHEETS = numberedSheets(
  'A_sheet_of_isolated_square_potion_and_consumable_icons_each',
  4
);

export const SIGIL_SHEETS = numberedSheets(
  'A_sheet_of_isolated_square_sigil_icons_each_centered_in_its',
  5
);

export const UI_SHEETS = numberedSheets(
  'A_sheet_of_isolated_square_UI_icons_each_centered_in_its_own',
  4
);

export const GENERAL_ICON_SHEET =
  '/gfx/A_sheet_of_isolated_square_icons_each_icon_centered_in_its_o.jpg';

export const GROUND_TILE_SHEET =
  '/gfx/A_grid_of_seamless_3232_topdown_ground_tiles_each_tile_tilea.jpg';

export const REGIONAL_TILE_SHEET =
  '/gfx/A_grid_of_separate_3232_regionalmap_tiles_for_a_gritty_survi.jpg';

export interface SpriteRect {
  sheetUrl: string;
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

interface GridSpec {
  cols: number;
  rows: number;
  x0?: number;
  y0?: number;
  gridW?: number;
  gridH?: number;
  padX?: number;
  padY?: number;
}

function gridRect(sheetUrl: string, col: number, row: number, spec: GridSpec): SpriteRect {
  const x0 = spec.x0 ?? 0;
  const y0 = spec.y0 ?? 0;
  const gridW = spec.gridW ?? SHEET_WIDTH - x0 * 2;
  const gridH = spec.gridH ?? SHEET_HEIGHT - y0 * 2;
  const cellW = gridW / spec.cols;
  const cellH = gridH / spec.rows;
  const padX = spec.padX ?? Math.round(cellW * 0.06);
  const padY = spec.padY ?? Math.round(cellH * 0.06);
  return {
    sheetUrl,
    sx: Math.round(x0 + col * cellW + padX),
    sy: Math.round(y0 + row * cellH + padY),
    sw: Math.max(8, Math.round(cellW - padX * 2)),
    sh: Math.max(8, Math.round(cellH - padY * 2))
  };
}

const PORTRAIT_GRID: GridSpec = { cols: 8, rows: 6, padX: 8, padY: 8 };
const WEAPON_GRID: GridSpec = {
  cols: 4,
  rows: 5,
  x0: 104,
  y0: 16,
  gridW: 1040,
  gridH: 800,
  padX: 16,
  padY: 12
};
const ARMOR_GRID: GridSpec = { cols: 4, rows: 4, padX: 20, padY: 14 };
const FOOD_GRID: GridSpec = { cols: 4, rows: 3, padX: 20, padY: 16 };
const POTION_GRID: GridSpec = { cols: 4, rows: 3, padX: 20, padY: 16 };
const GENERAL_GRID: GridSpec = { cols: 5, rows: 5, padX: 14, padY: 12 };
const GROUND_GRID: GridSpec = { cols: 12, rows: 8, padX: 8, padY: 8 };
const REGIONAL_GRID: GridSpec = { cols: 6, rows: 6, padX: 10, padY: 10 };

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface PortraitIdentity {
  id?: string | number | undefined;
  name?: string | undefined;
  species?: string | undefined;
  role?: string | undefined;
}

/**
 * Deterministic lookup from character/NPC species, name, or role to a portrait cell.
 */
export function getPortraitSlice(identity: PortraitIdentity): SpriteRect {
  const baseSheet = PORTRAIT_SHEETS[0]!;
  const hay = `${identity.name ?? ''} ${identity.species ?? ''} ${identity.role ?? ''}`.toLowerCase();

  // Named party archetypes & explicit species matches on base sheet (8x6)
  if (hay.includes('harrow') || hay.includes('boar')) {
    return gridRect(baseSheet, 7, 0, PORTRAIT_GRID);
  }
  if (hay.includes('vespera') || hay.includes('fox')) {
    return gridRect(baseSheet, hay.includes('scout') ? 2 : 1, 0, PORTRAIT_GRID);
  }
  if (hay.includes('lyra') || hay.includes('osprey') || hay.includes('hawk')) {
    return gridRect(baseSheet, 2, 3, PORTRAIT_GRID);
  }
  if (hay.includes('orlo') || hay.includes('owl') || hay.includes('red panda')) {
    return gridRect(baseSheet, 3, 3, PORTRAIT_GRID);
  }
  if (hay.includes('wolf') || hay.includes('canid') || hay.includes('hound')) {
    return gridRect(baseSheet, hay.includes('hound') ? 4 : 0, hay.includes('hound') ? 1 : 0, PORTRAIT_GRID);
  }
  if (hay.includes('bear') || hay.includes('ursine')) {
    return gridRect(baseSheet, 3, 0, PORTRAIT_GRID);
  }
  if (hay.includes('badger')) {
    return gridRect(baseSheet, hay.includes('guard') || hay.includes('warrior') ? 5 : 4, 0, PORTRAIT_GRID);
  }
  if (hay.includes('stag') || hay.includes('cervid') || hay.includes('deer')) {
    return gridRect(baseSheet, 6, 0, PORTRAIT_GRID);
  }
  if (hay.includes('rabbit') || hay.includes('hare')) {
    return gridRect(baseSheet, 0, 1, PORTRAIT_GRID);
  }
  if (hay.includes('mouse') || hay.includes('rat')) {
    return gridRect(baseSheet, hay.includes('rat') ? 2 : 1, 1, PORTRAIT_GRID);
  }
  if (hay.includes('cat') || hay.includes('felid')) {
    return gridRect(baseSheet, 3, 1, PORTRAIT_GRID);
  }
  if (hay.includes('lion')) {
    return gridRect(baseSheet, 0, 2, PORTRAIT_GRID);
  }
  if (hay.includes('tiger')) {
    return gridRect(baseSheet, 1, 2, PORTRAIT_GRID);
  }
  if (hay.includes('lizard') || hay.includes('saurian') || hay.includes('reptile')) {
    return gridRect(baseSheet, 2, 2, PORTRAIT_GRID);
  }
  if (hay.includes('croc') || hay.includes('gator')) {
    return gridRect(baseSheet, 5, 2, PORTRAIT_GRID);
  }
  if (hay.includes('tortoise') || hay.includes('turtle')) {
    return gridRect(baseSheet, 6, 2, PORTRAIT_GRID);
  }
  if (hay.includes('snake') || hay.includes('serpent') || hay.includes('viper') || hay.includes('cobra')) {
    return gridRect(baseSheet, hay.includes('viper') ? 1 : 0, 3, PORTRAIT_GRID);
  }
  if (hay.includes('raven') || hay.includes('crow') || hay.includes('avian')) {
    return gridRect(baseSheet, 5, 3, PORTRAIT_GRID);
  }
  if (hay.includes('spider') || hay.includes('beetle') || hay.includes('ant') || hay.includes('insect')) {
    return gridRect(baseSheet, hay.includes('spider') ? 2 : hay.includes('beetle') ? 3 : 4, 4, PORTRAIT_GRID);
  }
  if (hay.includes('mushroom') || hay.includes('myconid') || hay.includes('plant') || hay.includes('dryad')) {
    return gridRect(baseSheet, hay.includes('mushroom') || hay.includes('myconid') ? 0 : 2, 5, PORTRAIT_GRID);
  }
  if (hay.includes('frog') || hay.includes('amphibian')) {
    return gridRect(baseSheet, 3, 5, PORTRAIT_GRID);
  }
  if (hay.includes('guard') || hay.includes('commander') || hay.includes('captain') || hay.includes('warden')) {
    const h = hashString(`${identity.id ?? identity.name ?? 'guard'}`);
    return h % 2 === 0
      ? gridRect(baseSheet, 5, 0, PORTRAIT_GRID)
      : gridRect(baseSheet, 7, 0, PORTRAIT_GRID);
  }
  if (hay.includes('bandit') || hay.includes('outlaw') || hay.includes('smuggler') || hay.includes('rogue')) {
    const h = hashString(`${identity.id ?? identity.name ?? 'rogue'}`);
    return h % 2 === 0
      ? gridRect(baseSheet, 2, 1, PORTRAIT_GRID)
      : gridRect(baseSheet, 6, 1, PORTRAIT_GRID);
  }
  if (hay.includes('scholar') || hay.includes('mage') || hay.includes('arcanist') || hay.includes('priest')) {
    return gridRect(baseSheet, 4, 3, PORTRAIT_GRID);
  }

  // Fallback: deterministically distribute citizens across sheets 1..15
  const seed = hashString(String(identity.id ?? identity.name ?? identity.role ?? 'citizen'));
  const sheetIdx = 1 + (seed % 15);
  const col = (seed >>> 4) % 8;
  const row = (seed >>> 8) % 6;
  const sheetUrl = PORTRAIT_SHEETS[sheetIdx] ?? baseSheet;
  return gridRect(sheetUrl, col, row, PORTRAIT_GRID);
}

export function getEquipmentSlice(
  itemName: string | undefined,
  kind: 'weapon' | 'armor' | 'food' | 'potion' = 'weapon'
): SpriteRect {
  const n = (itemName ?? '').toLowerCase();
  const weaponBase = WEAPON_SHEETS[0]!;
  const armorBase = ARMOR_SHEETS[0]!;
  const foodBase = FOOD_SHEETS[0]!;
  const potionBase = POTION_SHEETS[0]!;

  if (kind === 'armor') {
    if (n.includes('shield') || n.includes('buckler')) {
      return gridRect(armorBase, n.includes('buckler') ? 1 : 2, 3, ARMOR_GRID);
    }
    if (n.includes('silk') || n.includes('robe') || n.includes('vestment') || n.includes('cloak') || n.includes('hood')) {
      return gridRect(armorBase, 0, 2, ARMOR_GRID);
    }
    if (n.includes('scale') || n.includes('hauberk') || n.includes('chain') || n.includes('mail')) {
      return gridRect(armorBase, 1, 1, ARMOR_GRID);
    }
    if (n.includes('plate') || n.includes('brigandine') || n.includes('cuirass')) {
      return gridRect(armorBase, 2, 1, ARMOR_GRID);
    }
    if (n.includes('gambeson') || n.includes('padded') || n.includes('tunic')) {
      return gridRect(armorBase, 2, 0, ARMOR_GRID);
    }
    if (n.includes('plume') || n.includes('fur') || n.includes('hide') || n.includes('vest')) {
      return gridRect(armorBase, 3, 0, ARMOR_GRID);
    }
    if (n.includes('leather') || n.includes('jerkin')) {
      return gridRect(armorBase, 1, 0, ARMOR_GRID);
    }
    return gridRect(armorBase, 0, 0, ARMOR_GRID);
  }

  if (kind === 'food') {
    if (n.includes('fish')) return gridRect(foodBase, 0, 1, FOOD_GRID);
    if (n.includes('stew') || n.includes('soup')) return gridRect(foodBase, 2, 1, FOOD_GRID);
    if (n.includes('bread') || n.includes('ration')) return gridRect(foodBase, 2, 2, FOOD_GRID);
    if (n.includes('berry') || n.includes('fruit')) return gridRect(foodBase, 1, 0, FOOD_GRID);
    if (n.includes('mushroom')) return gridRect(foodBase, 3, 0, FOOD_GRID);
    return gridRect(foodBase, 0, 0, FOOD_GRID);
  }

  if (kind === 'potion') {
    if (n.includes('herb')) return gridRect(potionBase, 1, 1, POTION_GRID);
    if (n.includes('focus') || n.includes('mana') || n.includes('elixir')) return gridRect(potionBase, 0, 1, POTION_GRID);
    if (n.includes('stamina') || n.includes('tonic')) return gridRect(potionBase, 1, 0, POTION_GRID);
    if (n.includes('poison') || n.includes('venom')) return gridRect(potionBase, 3, 0, POTION_GRID);
    return gridRect(potionBase, 0, 0, POTION_GRID);
  }

  // Weapon lookup (4x5 weapon sheet + general icon greatsword)
  if (n.includes('sword') || n.includes('greatsword')) {
    return gridRect(GENERAL_ICON_SHEET, 0, 1, GENERAL_GRID);
  }
  if (n.includes('dagger') || n.includes('knife') || n.includes('shiv')) {
    return gridRect(weaponBase, n.includes('flint') ? 0 : 3, 0, WEAPON_GRID);
  }
  if (n.includes('cleaver') || n.includes('machete') || n.includes('blade')) {
    return gridRect(weaponBase, 2, 4, WEAPON_GRID);
  }
  if (n.includes('spear') || n.includes('pike') || n.includes('halberd') || n.includes('lance') || n.includes('staff')) {
    return gridRect(weaponBase, n.includes('bastion') || n.includes('titanium') ? 3 : 2, 1, WEAPON_GRID);
  }
  if (n.includes('axe') || n.includes('hatchet')) {
    return gridRect(weaponBase, 2, 2, WEAPON_GRID);
  }
  if (n.includes('bow') || n.includes('crossbow')) {
    return gridRect(weaponBase, 0, 3, WEAPON_GRID);
  }
  if (n.includes('sling')) {
    return gridRect(weaponBase, 1, 3, WEAPON_GRID);
  }
  if (n.includes('hammer') || n.includes('maul') || n.includes('mace') || n.includes('club')) {
    return gridRect(weaponBase, n.includes('club') ? 2 : 3, 3, WEAPON_GRID);
  }
  return gridRect(weaponBase, 3, 0, WEAPON_GRID);
}

export function getPropSlice(prop: { id?: string; name?: string; tags?: string[] }): SpriteRect {
  const hay = `${prop.id ?? ''} ${prop.name ?? ''} ${(prop.tags ?? []).join(' ')}`.toLowerCase();
  if (hay.includes('fountain') || hay.includes('well') || hay.includes('spring') || hay.includes('basin')) {
    return gridRect(GROUND_TILE_SHEET, 11, 4, GROUND_GRID);
  }
  if (hay.includes('stair') || hay.includes('vault') || hay.includes('gate') || hay.includes('door') || hay.includes('sewer') || hay.includes('tunnel')) {
    return gridRect(GROUND_TILE_SHEET, 8, 2, GROUND_GRID);
  }
  if (hay.includes('fire') || hay.includes('brazier') || hay.includes('forge') || hay.includes('beacon') || hay.includes('lantern')) {
    return gridRect(GROUND_TILE_SHEET, 5, 5, GROUND_GRID);
  }
  if (hay.includes('shrine') || hay.includes('altar') || hay.includes('monolith') || hay.includes('obelisk')) {
    return gridRect(GROUND_TILE_SHEET, 8, 4, GROUND_GRID);
  }
  if (hay.includes('chest') || hay.includes('cache') || hay.includes('crate') || hay.includes('barrel') || hay.includes('supply')) {
    return gridRect(GROUND_TILE_SHEET, 4, 5, GROUND_GRID);
  }
  if (hay.includes('pick') || hay.includes('mine') || hay.includes('quarry')) {
    return gridRect(GENERAL_ICON_SHEET, 3, 2, GENERAL_GRID);
  }
  return gridRect(GENERAL_ICON_SHEET, 2, 2, GENERAL_GRID);
}

export function getRegionalTileSlice(tileType: string): SpriteRect {
  const t = tileType.toUpperCase();
  if (t.includes('FARM')) return gridRect(REGIONAL_TILE_SHEET, 1, 0, REGIONAL_GRID);
  if (t.includes('LOGGING') || t.includes('FOREST') || t.includes('WOOD')) {
    return gridRect(REGIONAL_TILE_SHEET, 2, 3, REGIONAL_GRID);
  }
  if (t.includes('MINE') || t.includes('MOUNTAIN') || t.includes('QUARRY')) {
    return gridRect(REGIONAL_TILE_SHEET, 0, 0, REGIONAL_GRID);
  }
  if (t.includes('WATCHTOWER') || t.includes('TOWER') || t.includes('BEACON')) {
    return gridRect(REGIONAL_TILE_SHEET, 0, 1, REGIONAL_GRID);
  }
  if (t.includes('BURG') || t.includes('CITY') || t.includes('KEEP')) {
    return gridRect(REGIONAL_TILE_SHEET, 1, 2, REGIONAL_GRID);
  }
  if (t.includes('SHRINE') || t.includes('TEMPLE') || t.includes('ALTAR')) {
    return gridRect(REGIONAL_TILE_SHEET, 1, 1, REGIONAL_GRID);
  }
  if (t.includes('WAR') || t.includes('BANNER') || t.includes('BATTLE')) {
    return gridRect(REGIONAL_TILE_SHEET, 2, 1, REGIONAL_GRID);
  }
  if (t.includes('BRIDGE') || t.includes('RIVER') || t.includes('FERRY')) {
    return gridRect(REGIONAL_TILE_SHEET, 3, 0, REGIONAL_GRID);
  }
  if (t.includes('CAMP') || t.includes('BANDIT')) {
    return gridRect(REGIONAL_TILE_SHEET, 5, 0, REGIONAL_GRID);
  }
  if (t.includes('RUIN')) return gridRect(REGIONAL_TILE_SHEET, 0, 2, REGIONAL_GRID);
  return gridRect(REGIONAL_TILE_SHEET, 4, 0, REGIONAL_GRID);
}

export interface SpriteBoxProps {
  rect: SpriteRect;
  width: number;
  height?: number | undefined;
  borderRadius?: number | string | undefined;
  border?: string | undefined;
  title?: string | undefined;
  style?: React.CSSProperties | undefined;
}

/**
 * Pixel-accurate CSS sprite slice renderer for 1248x832 JPG sprite sheets.
 */
export const SpriteBox: React.FC<SpriteBoxProps> = ({
  rect,
  width,
  height,
  borderRadius = 4,
  border = '1px solid #334155',
  title,
  style
}) => {
  const h = height ?? width;
  const bgW = (SHEET_WIDTH / rect.sw) * width;
  const bgH = (SHEET_HEIGHT / rect.sh) * h;
  const posX = -(rect.sx / rect.sw) * width;
  const posY = -(rect.sy / rect.sh) * h;

  return React.createElement('div', {
    ...(title ? { title } : {}),
    style: {
      width,
      height: h,
      flexShrink: 0,
      borderRadius,
      border,
      overflow: 'hidden',
      backgroundColor: '#0f172a',
      backgroundImage: `url("${encodeURI(rect.sheetUrl)}")`,
      backgroundRepeat: 'no-repeat',
      backgroundSize: `${bgW.toFixed(2)}px ${bgH.toFixed(2)}px`,
      backgroundPosition: `${posX.toFixed(2)}px ${posY.toFixed(2)}px`,
      ...style
    }
  });
};

export interface PortraitSpriteProps extends PortraitIdentity {
  size?: number | undefined;
  borderColor?: string | undefined;
  borderRadius?: number | string | undefined;
  title?: string | undefined;
}

export const PortraitSprite: React.FC<PortraitSpriteProps> = ({
  id,
  name,
  species,
  role,
  size = 38,
  borderColor = '#334155',
  borderRadius = 6,
  title
}) => {
  const rect = getPortraitSlice({ id, name, species, role });
  return React.createElement(SpriteBox, {
    rect,
    width: size,
    height: size,
    borderRadius,
    border: `1.5px solid ${borderColor}`,
    title: title ?? `${name ?? 'Character'}${species ? ` (${species})` : ''}`
  });
};

export interface EquipmentSpriteProps {
  itemName?: string | undefined;
  kind?: 'weapon' | 'armor' | 'food' | 'potion' | undefined;
  size?: number | undefined;
}

export const EquipmentSprite: React.FC<EquipmentSpriteProps> = ({
  itemName,
  kind = 'weapon',
  size = 18
}) => {
  const rect = getEquipmentSlice(itemName, kind);
  return React.createElement(SpriteBox, {
    rect,
    width: size,
    height: size,
    borderRadius: 3,
    border: '1px solid #334155',
    title: itemName ?? kind
  });
};

export interface PropSpriteProps {
  prop: { id?: string; name?: string; tags?: string[] };
  size?: number | undefined;
}

export const PropSprite: React.FC<PropSpriteProps> = ({ prop, size = 40 }) => {
  const rect = getPropSlice(prop);
  return React.createElement(SpriteBox, {
    rect,
    width: size,
    height: size,
    borderRadius: 6,
    border: '1.5px solid #f59e0b',
    title: prop.name ?? prop.id ?? 'Prop'
  });
};

export interface RegionalTileSpriteProps {
  tileType: string;
  size?: number | undefined;
  borderColor?: string | undefined;
}

export const RegionalTileSprite: React.FC<RegionalTileSpriteProps> = ({
  tileType,
  size = 24,
  borderColor = '#334155'
}) => {
  const rect = getRegionalTileSlice(tileType);
  return React.createElement(SpriteBox, {
    rect,
    width: size,
    height: size,
    borderRadius: 4,
    border: `1px solid ${borderColor}`,
    title: tileType
  });
};

// ── Canvas Image Cache & Drawing Helpers ─────────────────────────────────────────

const imageCache = new Map<string, HTMLImageElement>();
const loadCallbacks = new Set<() => void>();

function ensureCachedImage(sheetUrl: string): HTMLImageElement | null {
  if (typeof Image === 'undefined') return null;
  const existing = imageCache.get(sheetUrl);
  if (existing) {
    return existing.complete && existing.naturalWidth > 0 ? existing : null;
  }
  const img = new Image();
  img.onload = () => {
    for (const cb of loadCallbacks) cb();
  };
  img.src = encodeURI(sheetUrl);
  imageCache.set(sheetUrl, img);
  return null;
}

/**
 * React hook that preloads core sprite sheets and triggers a re-render once ready.
 */
export function useSpriteSheetImages(): number {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const cb = () => setTick((t) => t + 1);
    loadCallbacks.add(cb);

    ensureCachedImage(GROUND_TILE_SHEET);
    ensureCachedImage(GENERAL_ICON_SHEET);
    ensureCachedImage(PORTRAIT_SHEETS[0]!);
    ensureCachedImage(REGIONAL_TILE_SHEET);

    return () => {
      loadCallbacks.delete(cb);
    };
  }, []);

  return tick;
}

export function drawPropSpriteOnCanvas(
  ctx: CanvasRenderingContext2D,
  prop: { id?: string; name?: string; tags?: string[] },
  px: number,
  py: number,
  size: number,
  isSelected: boolean
): void {
  const rect = getPropSlice(prop);
  const img = ensureCachedImage(rect.sheetUrl);
  const half = size / 2;

  if (img) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(px - half, py - half, size, size, 2);
    ctx.clip();
    ctx.drawImage(img, rect.sx, rect.sy, rect.sw, rect.sh, px - half, py - half, size, size);
    ctx.restore();

    ctx.strokeStyle = isSelected ? '#facc15' : '#f59e0b';
    ctx.lineWidth = isSelected ? 1.5 : 0.8;
    ctx.strokeRect(px - half, py - half, size, size);
    return;
  }

  // Fallback vector dot while image loads
  const propId = prop.id ?? '';
  ctx.beginPath();
  ctx.arc(px, py, isSelected ? 5 : 3.5, 0, Math.PI * 2);
  ctx.fillStyle = propId.includes('fountain')
    ? '#38bdf8'
    : propId.includes('vault') || propId.includes('stair')
    ? '#ec4899'
    : propId.includes('chest')
    ? '#f59e0b'
    : '#a855f7';
  ctx.fill();
  ctx.lineWidth = isSelected ? 2 : 1;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
}

export function drawPortraitTokenOnCanvas(
  ctx: CanvasRenderingContext2D,
  identity: PortraitIdentity,
  cx: number,
  cy: number,
  radius: number,
  fallbackFill: string,
  strokeColor: string,
  isSelected: boolean,
  badge?: string | undefined
): void {
  const rect = getPortraitSlice(identity);
  const img = ensureCachedImage(rect.sheetUrl);

  if (img) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, rect.sx, rect.sy, rect.sw, rect.sh, cx - radius, cy - radius, radius * 2, radius * 2);
    ctx.restore();

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.lineWidth = isSelected ? 2 : 1.25;
    ctx.strokeStyle = strokeColor;
    ctx.stroke();
    return;
  }

  // Fallback vector token while image loads
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = fallbackFill;
  ctx.fill();
  ctx.lineWidth = isSelected ? 2 : 1.25;
  ctx.strokeStyle = strokeColor;
  ctx.stroke();

  if (badge) {
    ctx.fillStyle = '#ffffff';
    ctx.font = isSelected ? 'bold 8px monospace' : 'bold 6px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(badge, cx, cy);
  }
}

