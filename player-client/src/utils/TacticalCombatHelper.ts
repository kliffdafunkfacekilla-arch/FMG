/**
 * TACTICAL COMBAT & GRID UTILITIES
 * =================================
 * Provides Line-of-Sight (LOS) raycasting, tactical path/reachability calculation,
 * cover determination from intervening props, and AP (Action Point) mechanics.
 */

import { SpatialHashGrid } from './SpatialHashGrid';

export type CoverLevel = 'NONE' | 'HALF' | 'FULL';

export interface LosResult {
  hasLos: boolean;
  coverLevel: CoverLevel;
  coverBonus: number;
  interveningObstacle?: string;
  rayPoints: [number, number][];
}

export interface TacticalUnit {
  id: string;
  name: string;
  pos: [number, number];
  isPlayer: boolean;
  hp: number;
  maxHp: number;
  ap: number;
  maxAp: number;
  initiative: number;
  faction?: string;
  disposition?: number;
}

import type { CombatParticipant, LoadoutTier } from '../types';

/**
 * Calculates Stamina and Focus Pool sizes and regeneration rates based on loadout fee ratio.
 * - Half or less of total (<= 50% used)  -> Starting pool of 10 points, 1 point regen per turn.
 * - 50% to 75% of total                 -> Starting pool of 5 points, 1 point every 2 turns.
 * - 75% to 100% of total                -> Starting pool of 3 points, 1 point every 3 rounds.
 */
export function calculatePoolTier(fee: number, totalCapacity: number): {
  tier: LoadoutTier;
  pool: number;
  regenRate: number;
  regenDesc: string;
  usageRatio: number;
} {
  const safeTotal = Math.max(1, totalCapacity);
  const ratio = Math.min(1.0, Math.max(0, fee / safeTotal));

  if (ratio <= 0.50) {
    return {
      tier: 'LIGHT',
      pool: 10,
      regenRate: 1,
      regenDesc: '+1 / turn',
      usageRatio: ratio
    };
  } else if (ratio <= 0.75) {
    return {
      tier: 'MEDIUM',
      pool: 5,
      regenRate: 0.5,
      regenDesc: '+1 / 2 turns',
      usageRatio: ratio
    };
  } else {
    return {
      tier: 'HEAVY',
      pool: 3,
      regenRate: 0.33,
      regenDesc: '+1 / 3 rounds',
      usageRatio: ratio
    };
  }
}

/**
 * Movement distance allowed per turn based on derived Movement Speed.
 */
export function calculateMoveRange(movementSpeed = 10): number {
  return Math.max(3, Math.min(8, Math.floor(movementSpeed / 3)));
}

/**
 * Phase 1: Movement Phase Order
 * Fastest characters move first (highest Movement Speed -> lowest).
 */
export function getMovementTurnOrder(participants: CombatParticipant[]): string[] {
  return [...participants]
    .filter(p => p.alive)
    .sort((a, b) => b.movementSpeed - a.movementSpeed)
    .map(p => p.id);
}

/**
 * Phase 2: Declaration Phase Order
 * Lowest perception declares FIRST. Highest perception declares LAST
 * (seeing all other participants' declared intentions).
 */
export function getDeclarationTurnOrder(participants: CombatParticipant[]): string[] {
  return [...participants]
    .filter(p => p.alive)
    .sort((a, b) => a.perception - b.perception)
    .map(p => p.id);
}

/**
 * Phase 3: Resolution / Execution Phase Order
 * Fastest characters act first (highest Movement Speed -> lowest).
 */
export function getResolutionTurnOrder(participants: CombatParticipant[]): string[] {
  return [...participants]
    .filter(p => p.alive)
    .sort((a, b) => b.movementSpeed - a.movementSpeed)
    .map(p => p.id);
}

/**
 * Calculates Euclidean and Chebyshev distance
 */
export function getGridDistance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2));
}

export function getEuclideanDistance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x1 - x2, y1 - y2);
}

/**
 * Calculates Maximum Action Points (AP) based on derived speed and reflex
 */
export function calculateMaxAP(speed = 10, reflex = 5): number {
  const base = 4;
  const speedBonus = Math.floor((speed - 10) / 4);
  const reflexBonus = Math.floor((reflex - 5) / 3);
  return Math.max(3, Math.min(8, base + speedBonus + reflexBonus));
}

/**
 * Bresenham Line algorithm to trace line of sight between two coordinates
 */
export function traceRay(x0: number, y0: number, x1: number, y1: number): [number, number][] {
  const points: [number, number][] = [];
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  let currX = x0;
  let currY = y0;

  while (true) {
    points.push([currX, currY]);
    if (currX === x1 && currY === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      currX += sx;
    }
    if (e2 < dx) {
      err += dx;
      currY += sy;
    }
  }

  return points;
}

/**
 * Evaluates Line-of-Sight and Cover along the ray between source and target
 */
export function evaluateLineOfSight(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  props: Array<{ id: string; name: string; pos: [number, number]; tags: string[] }> | SpatialHashGrid<any>,
  tilemap?: { grid: Uint8Array; size: number } | null
): LosResult {
  const ray = traceRay(x0, y0, x1, y1);
  let coverLevel: CoverLevel = 'NONE';
  let coverBonus = 0;
  let interveningObstacle: string | undefined;

  const isSpatialGrid = props instanceof SpatialHashGrid;

  // We inspect points along the ray excluding the origin and destination
  for (let i = 1; i < ray.length - 1; i++) {
    const [rx, ry] = ray[i];

    // Check terrain blocking (e.g. mountain cliff = 3, structure wall = 5, abyss rock = 12)
    if (tilemap) {
      const tile = tilemap.grid[ry * tilemap.size + rx];
      if (tile === 3 || tile === 5 || tile === 12) {
        return {
          hasLos: false,
          coverLevel: 'FULL',
          coverBonus: 6,
          interveningObstacle: tile === 3 ? 'Cliffside Obstruction' : (tile === 5 ? 'Fortified Wall' : 'Abyssal Rock'),
          rayPoints: ray
        };
      }
    }

    // Check props along the path (O(1) with SpatialHashGrid)
    const blockingProp = isSpatialGrid
      ? (props as SpatialHashGrid<any>).getExact(rx, ry)
      : (props as any[]).find(p => p.pos[0] === rx && p.pos[1] === ry);

    if (blockingProp) {
      const tags = Array.isArray(blockingProp.tags) ? blockingProp.tags : [];
      const hasFullCover = tags.some((t: string) => t.includes('cover_heavy') || t.includes('wall') || t.includes('stone') || t.includes('boulder'));
      const hasHalfCover = tags.some((t: string) => t.includes('cover_light') || t.includes('wood') || t.includes('crate') || t.includes('barrel') || t.includes('bush') || t.includes('obstacle'));

      if (hasFullCover) {
        // High density obstacle blocks sight completely
        return {
          hasLos: false,
          coverLevel: 'FULL',
          coverBonus: 4,
          interveningObstacle: blockingProp.name,
          rayPoints: ray
        };
      } else if (hasHalfCover) {
        coverLevel = 'HALF';
        coverBonus = 2;
        interveningObstacle = blockingProp.name;
      }
    }
  }

  // Check target's immediate adjacent cover
  const targetPropAdjacent = isSpatialGrid
    ? (props as SpatialHashGrid<any>).queryRadius(x1, y1, 1.5, p => {
        const d = getGridDistance(p.pos[0], p.pos[1], x1, y1);
        return d === 1 && (p.tags.includes('cover_light') || p.tags.includes('cover_heavy') || p.tags.includes('stone'));
      })[0]
    : (props as any[]).find(p => {
        const d = getGridDistance(p.pos[0], p.pos[1], x1, y1);
        return d === 1 && (p.tags.includes('cover_light') || p.tags.includes('cover_heavy') || p.tags.includes('stone'));
      });

  if (coverLevel === 'NONE' && targetPropAdjacent) {
    coverLevel = 'HALF';
    coverBonus = 2;
    interveningObstacle = targetPropAdjacent.name;
  }

  return {
    hasLos: true,
    coverLevel,
    coverBonus,
    interveningObstacle,
    rayPoints: ray
  };
}

/**
 * Calculates flood-fill reachable tiles within given AP movement budget
 */
export function getReachableTiles(
  startX: number,
  startY: number,
  apBudget: number,
  isWalkable: (x: number, y: number) => boolean
): Map<string, { x: number; y: number; cost: number }> {
  const reachable = new Map<string, { x: number; y: number; cost: number }>();
  const queue: Array<{ x: number; y: number; cost: number }> = [{ x: startX, y: startY, cost: 0 }];
  reachable.set(`${startX},${startY}`, { x: startX, y: startY, cost: 0 });

  const directions = [
    [0, -1], [0, 1], [-1, 0], [1, 0],
    [-1, -1], [1, -1], [-1, 1], [1, 1]
  ];

  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (curr.cost >= apBudget) continue;

    for (const [dx, dy] of directions) {
      const nx = curr.x + dx;
      const ny = curr.y + dy;
      const key = `${nx},${ny}`;
      const stepCost = (dx !== 0 && dy !== 0) ? 1.4 : 1.0;
      const totalCost = curr.cost + stepCost;

      if (totalCost <= apBudget && isWalkable(nx, ny)) {
        if (!reachable.has(key) || reachable.get(key)!.cost > totalCost) {
          reachable.set(key, { x: nx, y: ny, cost: totalCost });
          queue.push({ x: nx, y: ny, cost: totalCost });
        }
      }
    }
  }

  return reachable;
}

