/**
 * SPATIAL HASH GRID PARTITIONING ENGINE (O(1) PROXIMITY & COLLISION)
 * ===================================================================
 * Partitions 256x256 regional coordinates into 16x16 cell buckets (16x16 = 256 cells).
 * Replaces linear O(N) array scans with constant time O(1) spatial lookups:
 * - Exact tile entity collision checks
 * - Proximity detection (aggro radii, interaction thresholds, click picking)
 * - Raycast obstacle intersection for Line-of-Sight and Cover evaluations
 */

export interface SpatialEntity {
  pos: [number, number];
  id?: string | number;
  [key: string]: any;
}

export class SpatialHashGrid<T extends SpatialEntity> {
  private readonly cellSize: number;
  private readonly shift: number;
  private buckets: Map<number, T[]> = new Map();
  private count: number = 0;

  constructor(cellSize: number = 16) {
    this.cellSize = cellSize;
    // Log2 of 16 is 4, allowing bitshift operations (x >> 4)
    this.shift = Math.round(Math.log2(cellSize));
  }

  /**
   * Generates a fast 32-bit integer key for grid coordinates (zero string alloc).
   */
  private getHashKey(gx: number, gy: number): number {
    return ((gy & 0xffff) << 16) | (gx & 0xffff);
  }

  private getCellCoord(coord: number): number {
    return coord >> this.shift;
  }

  public clear(): void {
    this.buckets.clear();
    this.count = 0;
  }

  public size(): number {
    return this.count;
  }

  public getCellSize(): number {
    return this.cellSize;
  }

  public insert(item: T): void {
    const gx = this.getCellCoord(item.pos[0]);
    const gy = this.getCellCoord(item.pos[1]);
    const key = this.getHashKey(gx, gy);

    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = [];
      this.buckets.set(key, bucket);
    }
    bucket.push(item);
    this.count++;
  }

  public insertAll(items: T[]): void {
    for (let i = 0; i < items.length; i++) {
      this.insert(items[i]);
    }
  }

  public rebuild(items: T[]): void {
    this.clear();
    this.insertAll(items);
  }

  /**
   * O(1) exact tile match lookup: returns first item sitting on (x, y)
   */
  public getExact(x: number, y: number, predicate?: (item: T) => boolean): T | undefined {
    const gx = this.getCellCoord(x);
    const gy = this.getCellCoord(y);
    const key = this.getHashKey(gx, gy);
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.length === 0) return undefined;

    for (let i = 0; i < bucket.length; i++) {
      const it = bucket[i];
      if (it.pos[0] === x && it.pos[1] === y) {
        if (!predicate || predicate(it)) {
          return it;
        }
      }
    }
    return undefined;
  }

  /**
   * O(1) exact tile match: returns ALL items occupying (x, y)
   */
  public getAllExact(x: number, y: number, predicate?: (item: T) => boolean): T[] {
    const gx = this.getCellCoord(x);
    const gy = this.getCellCoord(y);
    const key = this.getHashKey(gx, gy);
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.length === 0) return [];

    const results: T[] = [];
    for (let i = 0; i < bucket.length; i++) {
      const it = bucket[i];
      if (it.pos[0] === x && it.pos[1] === y) {
        if (!predicate || predicate(it)) {
          results.push(it);
        }
      }
    }
    return results;
  }

  /**
   * Constant time radius query: checks only the bounding buckets intersecting the circle
   */
  public queryRadius(
    cx: number,
    cy: number,
    radius: number,
    predicate?: (item: T) => boolean
  ): T[] {
    const minGx = this.getCellCoord(Math.max(0, cx - radius));
    const maxGx = this.getCellCoord(Math.min(255, cx + radius));
    const minGy = this.getCellCoord(Math.max(0, cy - radius));
    const maxGy = this.getCellCoord(Math.min(255, cy + radius));

    const radiusSq = radius * radius;
    const results: T[] = [];

    for (let gy = minGy; gy <= maxGy; gy++) {
      for (let gx = minGx; gx <= maxGx; gx++) {
        const key = this.getHashKey(gx, gy);
        const bucket = this.buckets.get(key);
        if (!bucket) continue;

        for (let i = 0; i < bucket.length; i++) {
          const item = bucket[i];
          const dx = item.pos[0] - cx;
          const dy = item.pos[1] - cy;
          if (dx * dx + dy * dy <= radiusSq) {
            if (!predicate || predicate(item)) {
              results.push(item);
            }
          }
        }
      }
    }
    return results;
  }

  /**
   * Finds the single closest entity to (cx, cy) within maxRadius
   */
  public findNearest(
    cx: number,
    cy: number,
    maxRadius: number,
    predicate?: (item: T) => boolean
  ): { item: T; distance: number } | null {
    const candidates = this.queryRadius(cx, cy, maxRadius, predicate);
    if (candidates.length === 0) return null;

    let closest: T | null = null;
    let minDistanceSq = Infinity;

    for (let i = 0; i < candidates.length; i++) {
      const it = candidates[i];
      const dx = it.pos[0] - cx;
      const dy = it.pos[1] - cy;
      const distSq = dx * dx + dy * dy;
      if (distSq < minDistanceSq) {
        minDistanceSq = distSq;
        closest = it;
      }
    }

    if (!closest) return null;
    return {
      item: closest,
      distance: Math.sqrt(minDistanceSq)
    };
  }

  /**
   * Line of sight ray traversal: finds first obstacle intersecting the ray points
   */
  public findRayIntersection(
    ray: [number, number][],
    predicate?: (item: T) => boolean
  ): { item: T; point: [number, number] } | null {
    for (let i = 1; i < ray.length - 1; i++) {
      const [rx, ry] = ray[i];
      const item = this.getExact(rx, ry, predicate);
      if (item) {
        return { item, point: [rx, ry] };
      }
    }
    return null;
  }
}
