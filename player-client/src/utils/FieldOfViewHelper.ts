/**
 * SHADOWCASTING FIELD-OF-VIEW & STEALTH UTILITY
 * ==============================================
 * Provides dynamic raycast shadowcasting FOV, exploration memory shroud,
 * and stealth / perception contest resolution for ambushes.
 */

export type VisibilityState = 0 | 1 | 2; // 0 = UNSEEN (pitch black), 1 = EXPLORED (memory/dimmed), 2 = VISIBLE (illuminated)

/**
 * Checks if a grid coordinate blocks sight/casts shadow.
 */
export function isTileSightBlocking(
  tx: number,
  ty: number,
  tilemap?: { grid: Uint8Array; size: number } | null,
  props?: Array<{ id: string; name: string; pos: [number, number]; tags: string[]; isDestroyed?: boolean }> | null
): boolean {
  if (!tilemap) return false;
  if (tx < 0 || tx >= tilemap.size || ty < 0 || ty >= tilemap.size) return true;

  const tile = tilemap.grid[ty * tilemap.size + tx];
  // 1 = Dense Tree Canopy, 3 = Mountain Cliff, 5 = Wall, 12 = Abyss Rock
  if (tile === 1 || tile === 3 || tile === 5 || tile === 12) {
    return true;
  }

  // Check intervening blocking props (stone walls, crates, dense barriers)
  if (props && props.length > 0) {
    const p = props.find(prop => !prop.isDestroyed && prop.pos[0] === tx && prop.pos[1] === ty);
    if (p) {
      const isOpaque = p.tags.some(t =>
        t.includes('cover_heavy') ||
        t.includes('stone') ||
        t.includes('wall') ||
        t.includes('barrier') ||
        t.includes('pillar')
      );
      if (isOpaque) return true;
    }
  }

  return false;
}

/**
 * Computes the set of visible coordinates from (startX, startY) within vision radius.
 * Uses ray casting around perimeter to create clean line-of-sight cones.
 */
export function computeFieldOfView(
  startX: number,
  startY: number,
  radius: number,
  tilemap?: { grid: Uint8Array; size: number } | null,
  props?: Array<{ id: string; name: string; pos: [number, number]; tags: string[]; isDestroyed?: boolean }> | null
): Set<string> {
  const visible = new Set<string>();
  visible.add(`${startX},${startY}`);

  const rad = Math.max(3, Math.min(14, Math.round(radius)));

  // Cast rays to each border point of the bounding box
  for (let dx = -rad; dx <= rad; dx++) {
    castFovRay(startX, startY, startX + dx, startY - rad, rad, visible, tilemap, props);
    castFovRay(startX, startY, startX + dx, startY + rad, rad, visible, tilemap, props);
  }
  for (let dy = -rad; dy <= rad; dy++) {
    castFovRay(startX, startY, startX - rad, startY + dy, rad, visible, tilemap, props);
    castFovRay(startX, startY, startX + rad, startY + dy, rad, visible, tilemap, props);
  }

  return visible;
}

function castFovRay(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  maxDist: number,
  visibleSet: Set<string>,
  tilemap?: { grid: Uint8Array; size: number } | null,
  props?: Array<{ id: string; name: string; pos: [number, number]; tags: string[]; isDestroyed?: boolean }> | null
): void {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  let cx = x0;
  let cy = y0;

  while (true) {
    const dist = Math.hypot(cx - x0, cy - y0);
    if (dist > maxDist) break;

    visibleSet.add(`${cx},${cy}`);

    // If this tile is sight blocking, stop ray after adding it (so the wall surface is visible)
    if ((cx !== x0 || cy !== y0) && isTileSightBlocking(cx, cy, tilemap, props)) {
      break;
    }

    if (cx === x1 && cy === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      cx += sx;
    }
    if (e2 < dx) {
      err += dx;
      cy += sy;
    }
  }
}

/**
 * Calculates dynamic vision radius based on perception attribute and active torch.
 */
export function calculateVisionRadius(perception = 10, hasTorch = false): number {
  const base = Math.max(5, Math.min(12, 6 + Math.floor(perception / 4)));
  return hasTorch ? base + 4 : base;
}

/**
 * Computes union of Field of View from multiple light sources (e.g. Player Torch + Sector Campfires/Hearths).
 */
export function computeMultiSourceFieldOfView(
  sources: Array<{ x: number; y: number; radius: number }>,
  tilemap?: { grid: Uint8Array; size: number } | null,
  props?: Array<{ id: string; name: string; pos: [number, number]; tags: string[]; isDestroyed?: boolean }> | null
): Set<string> {
  const allVisible = new Set<string>();

  for (const src of sources) {
    const fov = computeFieldOfView(src.x, src.y, src.radius, tilemap, props);
    fov.forEach(coord => allVisible.add(coord));
  }

  return allVisible;
}

/**
 * Resolves opposed Stealth check vs Perception check.
 * Margin >= 0 means stealth succeeds; < 0 means spotted.
 */
export function resolveStealthContest(
  stealthStat: number,
  perceptionStat: number,
  isInCover: boolean
): {
  hidden: boolean;
  stealthTotal: number;
  perceptionTotal: number;
  margin: number;
} {
  const d20Stealth = Math.floor(Math.random() * 20) + 1;
  const d20Perception = Math.floor(Math.random() * 20) + 1;
  const coverBonus = isInCover ? 3 : 0;

  const stealthTotal = d20Stealth + stealthStat + coverBonus;
  const perceptionTotal = d20Perception + perceptionStat;
  const margin = stealthTotal - perceptionTotal;

  return {
    hidden: margin >= 0,
    stealthTotal,
    perceptionTotal,
    margin
  };
}

