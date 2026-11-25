/**
 * Pure spatial navigation and target lookup helpers for macro agents (zero DB / UI imports).
 */

export interface CellPoint {
  x: number;
  y: number;
}

export interface GroveCoord {
  id: number;
  cellId: number;
  dragonName: string;
  powerDomain: string;
  sealStrength: number;
  x: number;
  y: number;
}

export interface OpposingAgentSnap {
  id: number;
  name: string;
  role: string;
  subRole?: string | null | undefined;
  locationCellId: number;
}

export interface PureMoveResult {
  nextCellId: number;
  arrived: boolean;
  collidedWith?: OpposingAgentSnap | null | undefined;
}

/**
 * Pure Euclidean step from `currentCellId` toward `targetCellId` using caller-supplied
 * coordinate and nearest-cell lookups, detecting any opposing agent in the stepped cell.
 */
export function stepTowardCellPure(
  currentCellId: number,
  targetCellId: number,
  stepDistance: number,
  getCoord: (cellId: number) => CellPoint | null,
  findNearest: (x: number, y: number) => number | null,
  opposingByCell?: Map<number, OpposingAgentSnap[]>
): PureMoveResult {
  if (currentCellId === targetCellId) {
    return { nextCellId: targetCellId, arrived: true };
  }

  const cur = getCoord(currentCellId);
  const tgt = getCoord(targetCellId);
  if (!cur || !tgt) {
    return { nextCellId: targetCellId, arrived: true };
  }

  const dx = tgt.x - cur.x;
  const dy = tgt.y - cur.y;
  const dist = Math.hypot(dx, dy);
  if (dist <= stepDistance) {
    return { nextCellId: targetCellId, arrived: true };
  }

  const nextX = cur.x + (dx / dist) * stepDistance;
  const nextY = cur.y + (dy / dist) * stepDistance;
  const nextCellId = findNearest(nextX, nextY) || targetCellId;
  const collision = opposingByCell?.get(nextCellId)?.[0] ?? null;

  return {
    nextCellId,
    arrived: nextCellId === targetCellId,
    collidedWith: collision,
  };
}

/** Returns the nearest sacred grove (by Euclidean distance squared) from `cellId`. */
export function findNearestGrovePure(
  cellId: number,
  groves: GroveCoord[],
  getCoord: (cellId: number) => CellPoint | null
): GroveCoord | null {
  const cur = getCoord(cellId);
  if (!cur) return null;

  let best: GroveCoord | null = null;
  let bestDistSq = Infinity;
  for (const g of groves) {
    const distSq = (g.x - cur.x) ** 2 + (g.y - cur.y) ** 2;
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      best = g;
    }
  }
  return best;
}

/**
 * Pure 2-pass nearest agent search (bounded square first, global fallback second) matching
 * `getNearestCultistCell` behavior.
 */
export function findNearestAgentCellPure<T extends { id: number; cellId: number; x: number; y: number }>(
  cellId: number,
  targets: T[],
  getCoord: (cellId: number) => CellPoint | null,
  pad = 500
): T | null {
  const cur = getCoord(cellId);
  if (!cur || targets.length === 0) return null;

  let bestBox: T | null = null;
  let bestBoxDistSq = Infinity;
  let bestGlobal: T | null = null;
  let bestGlobalDistSq = Infinity;

  for (const t of targets) {
    const dx = t.x - cur.x;
    const dy = t.y - cur.y;
    const distSq = dx * dx + dy * dy;
    if (Math.abs(dx) <= pad && Math.abs(dy) <= pad && distSq < bestBoxDistSq) {
      bestBoxDistSq = distSq;
      bestBox = t;
    }
    if (distSq < bestGlobalDistSq) {
      bestGlobalDistSq = distSq;
      bestGlobal = t;
    }
  }

  return bestBox ?? bestGlobal;
}
