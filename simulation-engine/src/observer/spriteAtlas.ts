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
export const ICONS_SHEET0 = GENERAL_ICON_SHEET;
export const ICONS_SHEET1 =
  '/gfx/A_sheet_of_isolated_square_icons_each_icon_centered_in_its_o (1).jpg';
export const ICONS_SHEET3 =
  '/gfx/A_sheet_of_isolated_square_icons_each_icon_centered_in_its_o (3).jpg';

export const GROUND_TILE_SHEET =
  '/gfx/A_grid_of_seamless_3232_topdown_ground_tiles_each_tile_tilea.jpg';
export const GROUND_SHEET2 =
  '/gfx/A_grid_of_seamless_3232_topdown_ground_tiles_each_tile_tilea (2).jpg';
export const GROUND_SHEET3 =
  '/gfx/A_grid_of_seamless_3232_topdown_ground_tiles_each_tile_tilea (3).jpg';

export const TERRAIN_TEX3 =
  '/gfx/tileable_seamless_3232_topdown_orthographic_terrain_texture (3).jpg';

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

type PixelSpan = readonly [number, number];

function measuredRect(
  sheetUrl: string,
  colBounds: ReadonlyArray<PixelSpan>,
  rowBounds: ReadonlyArray<PixelSpan>,
  col: number,
  row: number,
  pad: number = 4
): SpriteRect {
  const safeCol = Math.max(0, Math.min(colBounds.length - 1, col));
  const safeRow = Math.max(0, Math.min(rowBounds.length - 1, row));
  const [x1, x2] = colBounds[safeCol] ?? [0, 64];
  const [y1, y2] = rowBounds[safeRow] ?? [0, 64];
  return {
    sheetUrl,
    sx: Math.round(x1 + pad),
    sy: Math.round(y1 + pad),
    sw: Math.max(8, Math.round(x2 - x1 - pad * 2)),
    sh: Math.max(8, Math.round(y2 - y1 - pad * 2))
  };
}

// ── Measured Pixel Coordinate Tables (1248x832) ─────────────────────────────────

const PORTRAIT_BASE_GRID: GridSpec = { cols: 8, rows: 6, padX: 8, padY: 8 };
const PORTRAIT_SHEET4_COLS: ReadonlyArray<PixelSpan> = [
  [26, 159], [194, 332], [351, 523], [539, 670],
  [701, 835], [838, 983], [986, 1115], [1119, 1239]
];
const PORTRAIT_SHEET4_ROWS: ReadonlyArray<PixelSpan> = [
  [19, 157], [169, 301], [315, 435], [448, 569], [582, 691], [702, 827]
];
const PORTRAIT_SHEET5_GRID: GridSpec = {
  cols: 8, rows: 6, x0: 14, y0: 12, gridW: 1220, gridH: 808, padX: 8, padY: 8
};
const PORTRAIT_SHEET6_COLS: ReadonlyArray<PixelSpan> = [
  [37, 174], [184, 317], [329, 468], [482, 624],
  [629, 769], [774, 918], [923, 1068], [1085, 1211]
];
const PORTRAIT_SHEET6_ROWS: ReadonlyArray<PixelSpan> = [
  [13, 147], [153, 287], [294, 423], [439, 554], [571, 688], [693, 823]
];
const PORTRAIT_SHEET7_GRID: GridSpec = { cols: 8, rows: 6, padX: 8, padY: 8 };

function portraitFromVerifiedSheet(sheetSlot: number, col: number, row: number): SpriteRect {
  switch (sheetSlot % 5) {
    case 0:
      return gridRect(PORTRAIT_SHEETS[0]!, col, row, PORTRAIT_BASE_GRID);
    case 1:
      return measuredRect(PORTRAIT_SHEETS[4]!, PORTRAIT_SHEET4_COLS, PORTRAIT_SHEET4_ROWS, col, row, 4);
    case 2:
      return gridRect(PORTRAIT_SHEETS[5]!, col, row, PORTRAIT_SHEET5_GRID);
    case 3:
      return measuredRect(PORTRAIT_SHEETS[6]!, PORTRAIT_SHEET6_COLS, PORTRAIT_SHEET6_ROWS, col, row, 4);
    default:
      return gridRect(PORTRAIT_SHEETS[7]!, col, row, PORTRAIT_SHEET7_GRID);
  }
}

const WEAPON_BASE_COLS: ReadonlyArray<PixelSpan> = [
  [107, 344], [370, 611], [637, 875], [902, 1139]
];
const WEAPON_BASE_ROWS: ReadonlyArray<PixelSpan> = [
  [17, 168], [180, 330], [343, 492], [505, 656], [668, 816]
];
const WEAPON_SHEET4_GRID: GridSpec = { cols: 5, rows: 8, padX: 8, padY: 8 };

const ARMOR_SHEET2_BOXES: Record<string, readonly [number, number, number, number]> = {
  cloth: [76, 36, 224, 230],
  leather: [388, 36, 224, 230],
  gambeson: [668, 36, 236, 230],
  fur: [960, 36, 224, 230],
  bone: [76, 302, 224, 224],
  scale: [388, 302, 224, 224],
  plate: [668, 302, 236, 224],
  helm: [960, 302, 224, 224],
  robe: [76, 560, 206, 224],
  mask: [304, 560, 164, 224],
  vambraces: [492, 560, 186, 224],
  greaves: [698, 560, 198, 224],
  shield: [920, 560, 290, 228]
};

const ICONS_SHEET0_COLS: ReadonlyArray<PixelSpan> = [
  [38, 260], [278, 500], [518, 734], [752, 972], [988, 1210]
];
const ICONS_SHEET0_ROWS: ReadonlyArray<PixelSpan> = [
  [14, 192], [206, 368], [382, 520], [534, 672], [686, 816]
];

const ICONS_SHEET1_COLS: ReadonlyArray<PixelSpan> = [
  [30, 209], [233, 409], [434, 609], [634, 816], [839, 1016], [1042, 1218]
];
const ICONS_SHEET1_ROWS: ReadonlyArray<PixelSpan> = [
  [17, 192], [201, 365], [374, 515], [525, 666], [676, 817]
];

const ICONS_SHEET3_COLS: ReadonlyArray<PixelSpan> = [
  [33, 219], [238, 419], [439, 617], [637, 816], [834, 1015], [1032, 1216]
];
const ICONS_SHEET3_ROWS: ReadonlyArray<PixelSpan> = [
  [18, 188], [204, 363], [379, 515], [530, 665], [678, 807]
];

const FOOD_GRID: GridSpec = { cols: 4, rows: 3, padX: 20, padY: 16 };
const POTION_GRID: GridSpec = { cols: 4, rows: 3, padX: 20, padY: 16 };

const GROUND_SHEET2_COLS: ReadonlyArray<PixelSpan> = [
  [7, 103], [106, 200], [204, 293], [297, 384],
  [389, 477], [482, 571], [575, 662], [665, 754],
  [757, 848], [852, 952], [955, 1048], [1052, 1145], [1150, 1243]
];
const GROUND_SHEET2_ROWS: ReadonlyArray<PixelSpan> = [
  [7, 101], [105, 198], [202, 288], [292, 383],
  [387, 477], [480, 563], [568, 656], [660, 742], [745, 829]
];

const GROUND_SHEET3_COLS: ReadonlyArray<PixelSpan> = [
  [29, 173], [181, 327], [334, 476], [484, 625],
  [633, 775], [787, 927], [935, 1076], [1084, 1223]
];
const GROUND_SHEET3_ROWS: ReadonlyArray<PixelSpan> = [
  [12, 152], [160, 294], [301, 426], [436, 557], [565, 670], [678, 813]
];

const REGIONAL_GRID: GridSpec = { cols: 6, rows: 6, padX: 14, padY: 12 };

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
 * Deterministic lookup from character/NPC species, name, or role to a verified 8x6 portrait cell.
 */
export function getPortraitSlice(identity: PortraitIdentity): SpriteRect {
  const hay = `${identity.name ?? ''} ${identity.species ?? ''} ${identity.role ?? ''}`.toLowerCase();

  if (hay.includes('harrow') || hay.includes('boar')) {
    return portraitFromVerifiedSheet(0, 7, 0);
  }
  if (hay.includes('vespera') || hay.includes('fox')) {
    return portraitFromVerifiedSheet(0, hay.includes('scout') ? 2 : 1, 0);
  }
  if (hay.includes('lyra') || hay.includes('osprey') || hay.includes('hawk')) {
    return portraitFromVerifiedSheet(0, 2, 3);
  }
  if (hay.includes('orlo') || hay.includes('owl') || hay.includes('red panda')) {
    return portraitFromVerifiedSheet(0, 3, 3);
  }
  if (hay.includes('wolf') || hay.includes('canid') || hay.includes('hound')) {
    return portraitFromVerifiedSheet(0, hay.includes('hound') ? 4 : 0, hay.includes('hound') ? 1 : 0);
  }
  if (hay.includes('bear') || hay.includes('ursine')) {
    return portraitFromVerifiedSheet(0, 3, 0);
  }
  if (hay.includes('badger')) {
    return portraitFromVerifiedSheet(0, hay.includes('guard') || hay.includes('warrior') ? 5 : 4, 0);
  }
  if (hay.includes('stag') || hay.includes('cervid') || hay.includes('deer')) {
    return portraitFromVerifiedSheet(0, 6, 0);
  }
  if (hay.includes('rabbit') || hay.includes('hare')) {
    return portraitFromVerifiedSheet(0, 0, 1);
  }
  if (hay.includes('mouse') || hay.includes('rat')) {
    return portraitFromVerifiedSheet(0, hay.includes('rat') ? 2 : 1, 1);
  }
  if (hay.includes('cat') || hay.includes('felid')) {
    return portraitFromVerifiedSheet(0, 3, 1);
  }
  if (hay.includes('lion')) {
    return portraitFromVerifiedSheet(0, 0, 2);
  }
  if (hay.includes('tiger')) {
    return portraitFromVerifiedSheet(0, 1, 2);
  }
  if (hay.includes('lizard') || hay.includes('saurian') || hay.includes('reptile')) {
    return portraitFromVerifiedSheet(0, 2, 2);
  }
  if (hay.includes('croc') || hay.includes('gator')) {
    return portraitFromVerifiedSheet(0, 5, 2);
  }
  if (hay.includes('tortoise') || hay.includes('turtle')) {
    return portraitFromVerifiedSheet(0, 6, 2);
  }
  if (hay.includes('snake') || hay.includes('serpent') || hay.includes('viper') || hay.includes('cobra')) {
    return portraitFromVerifiedSheet(0, hay.includes('viper') ? 1 : 0, 3);
  }
  if (hay.includes('raven') || hay.includes('crow') || hay.includes('avian')) {
    return portraitFromVerifiedSheet(0, 5, 3);
  }
  if (hay.includes('spider') || hay.includes('beetle') || hay.includes('ant') || hay.includes('insect')) {
    return portraitFromVerifiedSheet(0, hay.includes('spider') ? 2 : hay.includes('beetle') ? 3 : 4, 4);
  }
  if (hay.includes('mushroom') || hay.includes('myconid') || hay.includes('plant') || hay.includes('dryad')) {
    return portraitFromVerifiedSheet(0, hay.includes('mushroom') || hay.includes('myconid') ? 0 : 2, 5);
  }
  if (hay.includes('frog') || hay.includes('amphibian')) {
    return portraitFromVerifiedSheet(0, 3, 5);
  }
  if (hay.includes('guard') || hay.includes('commander') || hay.includes('captain') || hay.includes('warden')) {
    const h = hashString(`${identity.id ?? identity.name ?? 'guard'}`);
    return h % 2 === 0
      ? portraitFromVerifiedSheet(0, 5, 0)
      : portraitFromVerifiedSheet(0, 7, 0);
  }
  if (hay.includes('bandit') || hay.includes('outlaw') || hay.includes('smuggler') || hay.includes('rogue')) {
    const h = hashString(`${identity.id ?? identity.name ?? 'rogue'}`);
    return h % 2 === 0
      ? portraitFromVerifiedSheet(0, 2, 1)
      : portraitFromVerifiedSheet(0, 6, 1);
  }
  if (hay.includes('scholar') || hay.includes('mage') || hay.includes('arcanist') || hay.includes('priest')) {
    return portraitFromVerifiedSheet(0, 4, 3);
  }

  // Fallback across the 5 verified 8x6 sheets ([0], [4], [5], [6], [7]) -> 240 clean portraits
  const seed = hashString(String(identity.id ?? identity.name ?? identity.role ?? 'citizen'));
  const sheetSlot = seed % 5;
  const col = (seed >>> 4) % 8;
  const row = (seed >>> 8) % 6;
  return portraitFromVerifiedSheet(sheetSlot, col, row);
}

export function getEquipmentSlice(
  itemName: string | undefined,
  kind: 'weapon' | 'armor' | 'food' | 'potion' = 'weapon'
): SpriteRect {
  const n = (itemName ?? '').toLowerCase();
  const weaponBase = WEAPON_SHEETS[0]!;
  const weaponSheet4 = WEAPON_SHEETS[4]!;
  const armorSheet2 = ARMOR_SHEETS[2]!;
  const foodBase = FOOD_SHEETS[0]!;
  const potionBase = POTION_SHEETS[0]!;

  if (kind === 'armor') {
    const pick = (key: string): SpriteRect => {
      const box = ARMOR_SHEET2_BOXES[key] ?? ARMOR_SHEET2_BOXES.cloth!;
      return { sheetUrl: armorSheet2, sx: box[0], sy: box[1], sw: box[2], sh: box[3] };
    };
    if (n.includes('shield') || n.includes('buckler')) return pick('shield');
    if (n.includes('helm') || n.includes('cap')) return pick('helm');
    if (n.includes('mask')) return pick('mask');
    if (n.includes('silk') || n.includes('robe') || n.includes('vestment') || n.includes('cloak') || n.includes('hood')) {
      return pick('robe');
    }
    if (n.includes('scale') || n.includes('hauberk') || n.includes('chain') || n.includes('mail')) {
      return pick('scale');
    }
    if (n.includes('plate') || n.includes('brigandine') || n.includes('cuirass')) {
      return pick('plate');
    }
    if (n.includes('bone') || n.includes('skull')) return pick('bone');
    if (n.includes('gambeson') || n.includes('padded') || n.includes('tunic')) {
      return pick('gambeson');
    }
    if (n.includes('plume') || n.includes('fur') || n.includes('hide') || n.includes('vest')) {
      return pick('fur');
    }
    if (n.includes('leather') || n.includes('jerkin')) return pick('leather');
    return pick('cloth');
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

  // Exact weapon slices (measured intervals + 5x8 weapon sheet 4)
  if (n.includes('twin') || (n.includes('dagger') && n.includes('paired'))) {
    return gridRect(weaponSheet4, 0, 4, WEAPON_SHEET4_GRID);
  }
  if (n.includes('greatsword') || n.includes('longsword') || n.includes('sword')) {
    return gridRect(weaponSheet4, n.includes('great') ? 2 : 1, 7, WEAPON_SHEET4_GRID);
  }
  if (n.includes('sabre') || n.includes('scimitar')) {
    return gridRect(weaponSheet4, 0, 5, WEAPON_SHEET4_GRID);
  }
  if (n.includes('staff') || n.includes('rod') || n.includes('wand') || n.includes('orb')) {
    return gridRect(weaponSheet4, n.includes('ley') || n.includes('mind') ? 4 : 3, 5, WEAPON_SHEET4_GRID);
  }
  if (n.includes('crossbow')) {
    return gridRect(weaponSheet4, 2, 3, WEAPON_SHEET4_GRID);
  }
  if (n.includes('dagger') || n.includes('knife') || n.includes('shiv')) {
    return measuredRect(weaponBase, WEAPON_BASE_COLS, WEAPON_BASE_ROWS, n.includes('flint') ? 0 : 3, 0, 6);
  }
  if (n.includes('cleaver') || n.includes('machete') || n.includes('blade')) {
    return measuredRect(weaponBase, WEAPON_BASE_COLS, WEAPON_BASE_ROWS, 2, 4, 6);
  }
  if (n.includes('spear') || n.includes('pike') || n.includes('halberd') || n.includes('lance')) {
    return measuredRect(weaponBase, WEAPON_BASE_COLS, WEAPON_BASE_ROWS, n.includes('bastion') || n.includes('titanium') ? 3 : 2, 1, 6);
  }
  if (n.includes('axe') || n.includes('hatchet')) {
    return measuredRect(weaponBase, WEAPON_BASE_COLS, WEAPON_BASE_ROWS, 2, 2, 6);
  }
  if (n.includes('bow')) {
    return measuredRect(weaponBase, WEAPON_BASE_COLS, WEAPON_BASE_ROWS, 0, 3, 6);
  }
  if (n.includes('sling')) {
    return measuredRect(weaponBase, WEAPON_BASE_COLS, WEAPON_BASE_ROWS, 1, 3, 6);
  }
  if (n.includes('hammer') || n.includes('maul')) {
    return gridRect(weaponSheet4, 2, 4, WEAPON_SHEET4_GRID);
  }
  if (n.includes('mace') || n.includes('club')) {
    return gridRect(weaponSheet4, 3, 7, WEAPON_SHEET4_GRID);
  }
  return gridRect(weaponSheet4, 1, 7, WEAPON_SHEET4_GRID);
}

/**
 * Maps props to genuine isolated objects, containers, wells, campfires, lanterns, shrines,
 * gates, and scrolls (never flat ground terrain tiles).
 */
export function getPropSlice(prop: { id?: string; name?: string; tags?: string[] }): SpriteRect {
  const hay = `${prop.id ?? ''} ${prop.name ?? ''} ${(prop.tags ?? []).join(' ')}`.toLowerCase();

  if (hay.includes('chest') || hay.includes('cache') || hay.includes('lockbox') || hay.includes('coffer') || hay.includes('strongbox')) {
    return measuredRect(GROUND_SHEET2, GROUND_SHEET2_COLS, GROUND_SHEET2_ROWS, 3, 8, 4);
  }
  if (hay.includes('crate') || hay.includes('box') || hay.includes('cargo') || hay.includes('supply')) {
    return measuredRect(GROUND_SHEET3, GROUND_SHEET3_COLS, GROUND_SHEET3_ROWS, 0, 4, 8);
  }
  if (hay.includes('barrel') || hay.includes('cask') || hay.includes('keg')) {
    return measuredRect(GROUND_SHEET2, GROUND_SHEET2_COLS, GROUND_SHEET2_ROWS, 5, 7, 4);
  }
  if (hay.includes('pack') || hay.includes('satchel') || hay.includes('bag')) {
    return measuredRect(ICONS_SHEET1, ICONS_SHEET1_COLS, ICONS_SHEET1_ROWS, 0, 2, 6);
  }
  if (hay.includes('fountain') || hay.includes('well') || hay.includes('spring') || hay.includes('basin') || hay.includes('cistern')) {
    return measuredRect(GROUND_SHEET3, GROUND_SHEET3_COLS, GROUND_SHEET3_ROWS, 4, 3, 8);
  }
  if (hay.includes('fire') || hay.includes('campfire') || hay.includes('brazier') || hay.includes('forge') || hay.includes('hearth') || hay.includes('beacon')) {
    return measuredRect(ICONS_SHEET1, ICONS_SHEET1_COLS, ICONS_SHEET1_ROWS, 3, 2, 6);
  }
  if (hay.includes('lantern') || hay.includes('lamp') || hay.includes('torch') || hay.includes('light') || hay.includes('chandelier')) {
    return measuredRect(ICONS_SHEET0, ICONS_SHEET0_COLS, ICONS_SHEET0_ROWS, 0, 2, 6);
  }
  if (hay.includes('shrine') || hay.includes('altar') || hay.includes('monolith') || hay.includes('obelisk') || hay.includes('statue') || hay.includes('pillar')) {
    return measuredRect(ICONS_SHEET1, ICONS_SHEET1_COLS, ICONS_SHEET1_ROWS, 5, 3, 6);
  }
  if (hay.includes('stair') || hay.includes('vault') || hay.includes('sewer') || hay.includes('flume') || hay.includes('tunnel') || hay.includes('ladder') || hay.includes('rope') || hay.includes('hatch')) {
    return measuredRect(ICONS_SHEET0, ICONS_SHEET0_COLS, ICONS_SHEET0_ROWS, 1, 2, 6);
  }
  if (hay.includes('gate') || hay.includes('door') || hay.includes('arch') || hay.includes('portcullis') || hay.includes('barricade')) {
    return measuredRect(GROUND_SHEET3, GROUND_SHEET3_COLS, GROUND_SHEET3_ROWS, 6, 3, 8);
  }
  if (hay.includes('map') || hay.includes('ledger') || hay.includes('scroll') || hay.includes('book') || hay.includes('clue') || hay.includes('desk') || hay.includes('table')) {
    return measuredRect(ICONS_SHEET3, ICONS_SHEET3_COLS, ICONS_SHEET3_ROWS, 5, 2, 6);
  }
  if (hay.includes('pick') || hay.includes('mine') || hay.includes('quarry') || hay.includes('anvil') || hay.includes('tool')) {
    return measuredRect(ICONS_SHEET0, ICONS_SHEET0_COLS, ICONS_SHEET0_ROWS, 3, 2, 6);
  }
  return measuredRect(ICONS_SHEET1, ICONS_SHEET1_COLS, ICONS_SHEET1_ROWS, 0, 2, 6);
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

// ── Canvas Image Cache & Terrain Texture Bank ───────────────────────────────────

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
 * React hook that preloads sprite & terrain tile sheets and triggers a re-render once ready.
 */
export function useSpriteSheetImages(): number {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const cb = () => setTick((t) => t + 1);
    loadCallbacks.add(cb);

    ensureCachedImage(GROUND_SHEET3);
    ensureCachedImage(GROUND_SHEET2);
    ensureCachedImage(TERRAIN_TEX3);
    ensureCachedImage(ICONS_SHEET0);
    ensureCachedImage(ICONS_SHEET1);
    ensureCachedImage(ICONS_SHEET3);
    ensureCachedImage(PORTRAIT_SHEETS[0]!);
    ensureCachedImage(PORTRAIT_SHEETS[4]!);
    ensureCachedImage(PORTRAIT_SHEETS[5]!);
    ensureCachedImage(PORTRAIT_SHEETS[6]!);
    ensureCachedImage(PORTRAIT_SHEETS[7]!);
    ensureCachedImage(REGIONAL_TILE_SHEET);

    return () => {
      loadCallbacks.delete(cb);
    };
  }, []);

  return tick;
}

export type TerrainTextureKey =
  | 'GRASS'
  | 'TALL_GRASS'
  | 'MUD'
  | 'COBBLESTONE'
  | 'FOREST_FLOOR'
  | 'DIRT_ROAD'
  | 'WOOD_PLANKS'
  | 'THATCH_ROOF'
  | 'OCEAN_WATER'
  | 'ROCK_CRAG'
  | 'FOREST_CANOPY'
  | 'SAND_DUNES'
  | 'SNOW_FROST'
  | 'MARSH_SWAMP'
  | 'RUIN_MASONRY';

const TERRAIN_SOURCE_RECTS: Record<TerrainTextureKey, SpriteRect> = {
  GRASS: measuredRect(GROUND_SHEET3, GROUND_SHEET3_COLS, GROUND_SHEET3_ROWS, 0, 0, 12),
  MUD: measuredRect(GROUND_SHEET3, GROUND_SHEET3_COLS, GROUND_SHEET3_ROWS, 1, 0, 12),
  COBBLESTONE: measuredRect(GROUND_SHEET3, GROUND_SHEET3_COLS, GROUND_SHEET3_ROWS, 2, 0, 12),
  FOREST_FLOOR: measuredRect(GROUND_SHEET3, GROUND_SHEET3_COLS, GROUND_SHEET3_ROWS, 3, 0, 12),
  TALL_GRASS: measuredRect(GROUND_SHEET3, GROUND_SHEET3_COLS, GROUND_SHEET3_ROWS, 4, 0, 12),
  DIRT_ROAD: measuredRect(GROUND_SHEET3, GROUND_SHEET3_COLS, GROUND_SHEET3_ROWS, 5, 1, 12),
  WOOD_PLANKS: measuredRect(GROUND_SHEET3, GROUND_SHEET3_COLS, GROUND_SHEET3_ROWS, 0, 2, 12),
  THATCH_ROOF: measuredRect(GROUND_SHEET3, GROUND_SHEET3_COLS, GROUND_SHEET3_ROWS, 6, 2, 12),
  OCEAN_WATER: { sheetUrl: TERRAIN_TEX3, sx: 336, sy: 24, sw: 260, sh: 360 },
  ROCK_CRAG: { sheetUrl: TERRAIN_TEX3, sx: 648, sy: 24, sw: 260, sh: 360 },
  FOREST_CANOPY: { sheetUrl: TERRAIN_TEX3, sx: 960, sy: 24, sw: 260, sh: 360 },
  SAND_DUNES: { sheetUrl: TERRAIN_TEX3, sx: 24, sy: 440, sw: 260, sh: 360 },
  SNOW_FROST: { sheetUrl: TERRAIN_TEX3, sx: 336, sy: 440, sw: 260, sh: 360 },
  MARSH_SWAMP: { sheetUrl: TERRAIN_TEX3, sx: 648, sy: 440, sw: 260, sh: 360 },
  RUIN_MASONRY: { sheetUrl: TERRAIN_TEX3, sx: 960, sy: 440, sw: 260, sh: 360 }
};

const TEX_SIZE = 64;
const texturePixelCache = new Map<TerrainTextureKey, Uint8ClampedArray>();

function getTerrainTexturePixels(key: TerrainTextureKey): Uint8ClampedArray | null {
  const cached = texturePixelCache.get(key);
  if (cached) return cached;

  const rect = TERRAIN_SOURCE_RECTS[key];
  const img = ensureCachedImage(rect.sheetUrl);
  if (!img || typeof document === 'undefined') return null;

  const off = document.createElement('canvas');
  off.width = TEX_SIZE;
  off.height = TEX_SIZE;
  const offCtx = off.getContext('2d');
  if (!offCtx) return null;

  offCtx.drawImage(img, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, TEX_SIZE, TEX_SIZE);
  const pixels = offCtx.getImageData(0, 0, TEX_SIZE, TEX_SIZE).data;
  texturePixelCache.set(key, pixels);
  return pixels;
}

function getTacticalTextureKey(tile: number, z: number): TerrainTextureKey {
  if (z === -1) {
    switch (tile) {
      case 1: return 'COBBLESTONE';
      case 2: return 'MARSH_SWAMP';
      case 3: return 'MUD';
      case 4: return 'RUIN_MASONRY';
      case 5: return 'OCEAN_WATER';
      case 7: return 'RUIN_MASONRY';
      case 8: return 'WOOD_PLANKS';
      default: return 'ROCK_CRAG';
    }
  }
  if (z === 1) {
    switch (tile) {
      case 1:
      case 2: return 'FOREST_CANOPY';
      case 3:
      case 8: return 'WOOD_PLANKS';
      case 4:
      case 6: return 'COBBLESTONE';
      case 5: return 'OCEAN_WATER';
      case 7: return 'THATCH_ROOF';
      default: return 'MARSH_SWAMP';
    }
  }
  // Surface (z = 0)
  switch (tile) {
    case 0: return 'GRASS';
    case 1:
    case 15:
    case 20: return 'FOREST_CANOPY';
    case 2:
    case 21: return 'OCEAN_WATER';
    case 3: return 'DIRT_ROAD';
    case 4: return 'COBBLESTONE';
    case 5:
    case 10:
    case 18: return 'ROCK_CRAG';
    case 6:
    case 12: return 'RUIN_MASONRY';
    case 7: return 'THATCH_ROOF';
    case 8: return 'MUD';
    case 9: return 'SAND_DUNES';
    case 11:
    case 13:
    case 14: return 'SNOW_FROST';
    case 16:
    case 19:
    case 23: return 'TALL_GRASS';
    case 17: return 'MARSH_SWAMP';
    case 22: return 'MUD';
    case 24: return 'WOOD_PLANKS';
    default: return 'GRASS';
  }
}

/**
 * Renders the 256x256 tactical grid onto a canvas using sampled terrain map tile textures.
 */
export function renderTacticalTileMapOnCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  grid: number[],
  z: number,
  getFallbackRgb: (tile: number, z: number) => [number, number, number]
): void {
  const GRID_SIZE = 256;
  const imgData = ctx.createImageData(width, height);
  const out = imgData.data;

  // Resolve texture pixel buffers once per unique tile ID present in this render pass
  const texByTile = new Map<number, Uint8ClampedArray | null>();
  const colorByTile = new Map<number, [number, number, number]>();

  const scaleX = GRID_SIZE / width;
  const scaleY = GRID_SIZE / height;

  for (let py = 0; py < height; py++) {
    const gy = Math.min(GRID_SIZE - 1, (py * scaleY) | 0);
    const ty = py & 63;
    const rowOffset = gy * GRID_SIZE;
    const outRowOffset = py * width * 4;

    for (let px = 0; px < width; px++) {
      const gx = Math.min(GRID_SIZE - 1, (px * scaleX) | 0);
      const tile = grid[rowOffset + gx] || 0;

      let rgb = colorByTile.get(tile);
      if (!rgb) {
        rgb = getFallbackRgb(tile, z);
        colorByTile.set(tile, rgb);
      }

      let tex = texByTile.get(tile);
      if (tex === undefined) {
        tex = getTerrainTexturePixels(getTacticalTextureKey(tile, z));
        texByTile.set(tile, tex);
      }

      const idx = outRowOffset + px * 4;
      if (tex) {
        const tx = px & 63;
        const tIdx = (ty * TEX_SIZE + tx) * 4;
        // Blend 78% real terrain tile texture with 22% palette tint for z-layer clarity
        out[idx] = Math.round((tex[tIdx] ?? rgb[0]) * 0.78 + rgb[0] * 0.22);
        out[idx + 1] = Math.round((tex[tIdx + 1] ?? rgb[1]) * 0.78 + rgb[1] * 0.22);
        out[idx + 2] = Math.round((tex[tIdx + 2] ?? rgb[2]) * 0.78 + rgb[2] * 0.22);
      } else {
        let h = (gx * 374761393 + gy * 668265263) ^ 0x5bd1e995;
        h = Math.imul(h ^ (h >>> 13), 1274126177);
        const fine = (((h >>> 16) & 255) / 255 - 0.5) * 0.14;
        const k = 1 + fine;
        out[idx] = Math.max(0, Math.min(255, rgb[0] * k));
        out[idx + 1] = Math.max(0, Math.min(255, rgb[1] * k));
        out[idx + 2] = Math.max(0, Math.min(255, rgb[2] * k));
      }
      out[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

function getRegionalTextureKey(tile: number, infra: number, biomeId: number): TerrainTextureKey {
  if (infra === 32 || tile === 3 || biomeId === 0 || (biomeId >= 13 && biomeId <= 17) || biomeId === 19) {
    return 'OCEAN_WATER';
  }
  if (infra === 128 || infra === 8 || tile === 7) return 'RUIN_MASONRY';
  if (tile === 4 || tile === 12) return 'COBBLESTONE';
  if (tile === 5 || tile === 6 || infra === 64) return 'DIRT_ROAD';
  if (tile === 8 || tile === 11) return 'ROCK_CRAG';
  if (tile === 2 || tile === 10) return 'FOREST_CANOPY';
  if (tile === 1 || tile === 9) {
    if (biomeId === 1) return 'SAND_DUNES';
    if (biomeId === 11) return 'SNOW_FROST';
    if (biomeId === 12) return 'MARSH_SWAMP';
    return 'TALL_GRASS';
  }
  if (biomeId === 1) return 'SAND_DUNES';
  if (biomeId === 2 || biomeId === 10) return 'ROCK_CRAG';
  if (biomeId === 11) return 'SNOW_FROST';
  if (biomeId === 12) return 'MARSH_SWAMP';
  if (biomeId === 18) return 'RUIN_MASONRY';
  if (biomeId >= 5 && biomeId <= 9) return 'FOREST_FLOOR';
  return 'GRASS';
}

function parseHexRgb(hex: string): [number, number, number] {
  const clean = hex.startsWith('#') ? hex.slice(1) : hex;
  if (clean.length < 6) return [120, 140, 100];
  return [
    parseInt(clean.slice(0, 2), 16) || 0,
    parseInt(clean.slice(2, 4), 16) || 0,
    parseInt(clean.slice(4, 6), 16) || 0
  ];
}

/**
 * Renders the 100x100 regional overland mesh using orthographic terrain map textures + biome tint.
 */
export function renderRegionalTileMapOnCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  gridW: number,
  gridH: number,
  mapData: number[],
  infraMap: number[],
  biomeMap: number[],
  defaultBiomeId: number,
  getTerrainColor: (tile: number, biomeId: number) => string
): void {
  const imgData = ctx.createImageData(width, height);
  const out = imgData.data;

  const texCacheByKey = new Map<TerrainTextureKey, Uint8ClampedArray | null>();
  const colorCache = new Map<string, [number, number, number]>();

  const scaleX = gridW / width;
  const scaleY = gridH / height;

  for (let py = 0; py < height; py++) {
    const ry = Math.min(gridH - 1, (py * scaleY) | 0);
    const ty = py & 63;
    const cellRow = ry * gridW;
    const outRow = py * width * 4;

    for (let px = 0; px < width; px++) {
      const rx = Math.min(gridW - 1, (px * scaleX) | 0);
      const cellIdx = cellRow + rx;
      const t = mapData[cellIdx] || 0;
      const inf = infraMap[cellIdx] || 0;
      const cellBiome = biomeMap[cellIdx] ?? defaultBiomeId;

      let hex = getTerrainColor(t, cellBiome);
      if (inf === 128) hex = '#334155';
      else if (inf === 64) hex = '#64748b';
      else if (inf === 32) hex = '#0284c7';
      else if (inf === 8) hex = '#7e22ce';

      let rgb = colorCache.get(hex);
      if (!rgb) {
        rgb = parseHexRgb(hex);
        colorCache.set(hex, rgb);
      }

      const key = getRegionalTextureKey(t, inf, cellBiome);
      let tex = texCacheByKey.get(key);
      if (tex === undefined) {
        tex = getTerrainTexturePixels(key);
        texCacheByKey.set(key, tex);
      }

      const outIdx = outRow + px * 4;
      if (tex) {
        const tx = px & 63;
        const tIdx = (ty * TEX_SIZE + tx) * 4;
        out[outIdx] = Math.round((tex[tIdx] ?? rgb[0]) * 0.72 + rgb[0] * 0.28);
        out[outIdx + 1] = Math.round((tex[tIdx + 1] ?? rgb[1]) * 0.72 + rgb[1] * 0.28);
        out[outIdx + 2] = Math.round((tex[tIdx + 2] ?? rgb[2]) * 0.72 + rgb[2] * 0.28);
      } else {
        out[outIdx] = rgb[0];
        out[outIdx + 1] = rgb[1];
        out[outIdx + 2] = rgb[2];
      }
      out[outIdx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

/**
 * Draws a cropped Regional Map tile onto the regional canvas at (cx, cy).
 */
export function drawRegionalPoiOnCanvas(
  ctx: CanvasRenderingContext2D,
  tileType: string,
  cx: number,
  cy: number,
  size: number,
  borderColor: string,
  isHighlighted: boolean
): void {
  const rect = getRegionalTileSlice(tileType);
  const img = ensureCachedImage(rect.sheetUrl);
  const half = size / 2;

  if (img) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(cx - half, cy - half, size, size, 3);
    ctx.clip();
    ctx.drawImage(img, rect.sx, rect.sy, rect.sw, rect.sh, cx - half, cy - half, size, size);
    ctx.restore();

    ctx.strokeStyle = isHighlighted ? '#ffffff' : borderColor;
    ctx.lineWidth = isHighlighted ? 2 : 1.25;
    ctx.strokeRect(cx - half, cy - half, size, size);
    return;
  }

  ctx.beginPath();
  ctx.arc(cx, cy, isHighlighted ? 6.5 : 4.5, 0, Math.PI * 2);
  ctx.fillStyle = borderColor;
  ctx.fill();
  ctx.strokeStyle = isHighlighted ? '#ffffff' : '#000000';
  ctx.lineWidth = isHighlighted ? 1.5 : 1;
  ctx.stroke();
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
    ctx.roundRect(px - half, py - half, size, size, 3);
    ctx.clip();
    ctx.drawImage(img, rect.sx, rect.sy, rect.sw, rect.sh, px - half, py - half, size, size);
    ctx.restore();

    ctx.strokeStyle = isSelected ? '#facc15' : '#f59e0b';
    ctx.lineWidth = isSelected ? 2 : 1;
    ctx.strokeRect(px - half, py - half, size, size);
    return;
  }

  const propId = prop.id ?? '';
  ctx.beginPath();
  ctx.arc(px, py, isSelected ? 8 : 5, 0, Math.PI * 2);
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
    ctx.lineWidth = isSelected ? 2.5 : 1.5;
    ctx.strokeStyle = strokeColor;
    ctx.stroke();
    return;
  }

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = fallbackFill;
  ctx.fill();
  ctx.lineWidth = isSelected ? 2.5 : 1.5;
  ctx.strokeStyle = strokeColor;
  ctx.stroke();

  if (badge) {
    ctx.fillStyle = '#ffffff';
    ctx.font = isSelected ? 'bold 11px monospace' : 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(badge, cx, cy);
  }
}
