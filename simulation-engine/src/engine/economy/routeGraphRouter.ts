/**
 * routeGraphRouter.ts
 * Pure cached logistics pathfinder over Ostraka's `sim_route_graph` + `sim_roads` network
 * and bounded aerial routes for air-capable factions (zero UI/observer imports).
 */
import { initSpatialCache, findNearestCell } from "../agents/agentMovementHelper.js";

export type TransportMode = "LAND" | "SEA" | "AIR";

export interface RouteEdge {
  to: number;
  roadGroup: string;
  dist: number;
  cost: number;
}

export interface RoutePlan {
  mode: TransportMode;
  pathCells: number[];
  totalDist: number;
  etaTicks: number;
  usesSea: boolean;
  usesRoad: boolean;
}

export interface RouteSearchMemo {
  goalReach: Map<string, { complete: boolean; reachable: Set<number> }>;
  dynamicPaths: Map<string, number[] | null>;
}

export function createRouteSearchMemo(): RouteSearchMemo {
  return {
    goalReach: new Map(),
    dynamicPaths: new Map(),
  };
}

export interface FindRouteOptions {
  fromCellId: number;
  toCellId: number;
  allowedModes: TransportMode[];
  blockedCells?: Set<number>;
  avoidFactionIds?: Set<number>;
  cellFactionMap?: Map<number, number>;
  memo?: RouteSearchMemo;
}

export interface PathStepResult {
  nextIndex: number;
  nextCellId: number;
  visitedCells: number[];
  arrived: boolean;
  stepDist: number;
}

/** Matches Rule 9 discrete single-tick movement limit in testCanonMandates.ts */
export const MAX_CONVOY_STEP_UNITS = 65;

export const MODE_STEP_BUDGET: Record<TransportMode, number> = {
  LAND: 56,
  SEA: 62,
  AIR: 60,
};

type Db = { query: (text: string, params?: any[]) => Promise<any> };

const BUCKET_SIZE = 100;
const MAX_SNAP_DIST = 140;
const MAX_EXPANSIONS = 14000;
const MAX_SAFE_PATH_CACHE = 4000;

let cacheLoaded = false;
const cellCoords = new Map<number, { x: number; y: number }>();
const adjacency = new Map<number, RouteEdge[]>();
const reverseAdjacency = new Map<number, RouteEdge[]>();
const graphBuckets = new Map<string, number[]>();
const safePathCache = new Map<string, number[] | null>();
const landComponentId = new Map<number, number>();
const allComponentId = new Map<number, number>();
const cellRiverMap = new Map<number, { riverId: number; width: number; discharge: number }>();

function bucketKey(x: number, y: number): string {
  return `${Math.floor(x / BUCKET_SIZE)},${Math.floor(y / BUCKET_SIZE)}`;
}

function edgeCostMultiplier(roadGroup: string): number {
  switch (roadGroup) {
    case "searoutes":
      return 0.65;
    case "roads":
      return 0.75;
    case "trails":
      return 1.0;
    default:
      return 1.1;
  }
}

export function resetRouteGraphCache(): void {
  cacheLoaded = false;
  cellCoords.clear();
  adjacency.clear();
  reverseAdjacency.clear();
  graphBuckets.clear();
  safePathCache.clear();
  landComponentId.clear();
  allComponentId.clear();
  cellRiverMap.clear();
}

/**
 * Computes ferry/bridge river-crossing tolls for a LAND convoy crossing major `sim_rivers`.
 */
export function computeRiverTollForPath(
  pathCells: number[],
  mode: TransportMode
): { crossings: number; riverTollGold: number } {
  if (mode !== "LAND" || !Array.isArray(pathCells) || pathCells.length < 2) {
    return { crossings: 0, riverTollGold: 0 };
  }
  const originRiver = cellRiverMap.get(pathCells[0]!)?.riverId || 0;
  const destRiver = cellRiverMap.get(pathCells[pathCells.length - 1]!)?.riverId || 0;
  const sameRiverBarge = originRiver > 0 && originRiver === destRiver;
  const crossedRivers = new Set<number>();
  let riverTollGold = 0;

  for (const cid of pathCells) {
    const r = cellRiverMap.get(cid);
    if (!r || r.riverId <= 0) continue;
    if (sameRiverBarge && r.riverId === originRiver) continue;
    if ((r.width >= 0.15 || r.discharge >= 100) && !crossedRivers.has(r.riverId)) {
      crossedRivers.add(r.riverId);
      riverTollGold += Math.max(1, Math.min(5, Math.round(1 + r.width * 2 + r.discharge / 600)));
    }
  }
  return { crossings: crossedRivers.size, riverTollGold };
}

export function getCachedCellCoords(cellId: number): { x: number; y: number } | null {
  return cellCoords.get(cellId) || null;
}

export function distBetweenCells(a: number, b: number): number {
  if (a === b) return 0;
  const ca = cellCoords.get(a);
  const cb = cellCoords.get(b);
  if (!ca || !cb) return 0;
  return Math.hypot(cb.x - ca.x, cb.y - ca.y);
}

/**
 * Loads static map coordinates, road groups, and route graph adjacency once per process.
 */
export async function ensureRouteGraphCache(client: Db): Promise<void> {
  if (cacheLoaded && cellCoords.size > 0 && adjacency.size > 0) return;

  await initSpatialCache(client);

  const cellsRes = await client.query(`
    SELECT c.id, c.center_x, c.center_y,
           COALESCE(c.river_id, 0)::int AS river_id,
           COALESCE(r.width, 0)::real AS river_width,
           COALESCE(r.discharge, 0)::real AS river_discharge
    FROM sim_cells c
    LEFT JOIN sim_rivers r ON r.id = c.river_id
    ORDER BY c.id
  `);
  cellCoords.clear();
  cellRiverMap.clear();
  for (const r of cellsRes.rows) {
    const cid = Number(r.id);
    cellCoords.set(cid, {
      x: parseFloat(r.center_x) || 0,
      y: parseFloat(r.center_y) || 0,
    });
    const riverId = Number(r.river_id) || 0;
    if (riverId > 0) {
      cellRiverMap.set(cid, {
        riverId,
        width: Number(r.river_width) || 0,
        discharge: Number(r.river_discharge) || 0,
      });
    }
  }

  const roadsRes = await client.query(`SELECT id, road_group FROM sim_roads ORDER BY id`);
  const roadGroupById = new Map<number, string>();
  for (const r of roadsRes.rows) {
    roadGroupById.set(Number(r.id), String(r.road_group || "trails"));
  }

  const graphRes = await client.query(`SELECT cell_id, links FROM sim_route_graph ORDER BY cell_id`);
  adjacency.clear();
  reverseAdjacency.clear();
  graphBuckets.clear();
  safePathCache.clear();
  landComponentId.clear();
  allComponentId.clear();

  for (const row of graphRes.rows) {
    const cid = Number(row.cell_id);
    const c1 = cellCoords.get(cid);
    if (!c1) continue;

    let linksObj: Record<string, unknown> = {};
    if (typeof row.links === "string") {
      try {
        linksObj = JSON.parse(row.links);
      } catch {
        linksObj = {};
      }
    } else if (row.links && typeof row.links === "object") {
      linksObj = row.links as Record<string, unknown>;
    }

    const edges: RouteEdge[] = [];
    for (const [toStr, roadIdRaw] of Object.entries(linksObj)) {
      const to = Number(toStr);
      const c2 = cellCoords.get(to);
      if (!Number.isInteger(to) || to === cid || !c2) continue;
      const dist = Math.hypot(c2.x - c1.x, c2.y - c1.y);
      if (!(dist > 0)) continue;
      const roadGroup = roadGroupById.get(Number(roadIdRaw)) || "trails";
      edges.push({
        to,
        roadGroup,
        dist,
        cost: dist * edgeCostMultiplier(roadGroup),
      });
    }

    edges.sort((a, b) => a.to - b.to);
    if (edges.length > 0) {
      adjacency.set(cid, edges);
      for (const e of edges) {
        let revList = reverseAdjacency.get(e.to);
        if (!revList) {
          revList = [];
          reverseAdjacency.set(e.to, revList);
        }
        revList.push({ to: cid, roadGroup: e.roadGroup, dist: e.dist, cost: e.cost });
      }
      const key = bucketKey(c1.x, c1.y);
      const list = graphBuckets.get(key);
      if (list) list.push(cid);
      else graphBuckets.set(key, [cid]);
    }
  }

  for (const revList of reverseAdjacency.values()) {
    revList.sort((a, b) => a.to - b.to);
  }

  for (const list of graphBuckets.values()) {
    list.sort((a, b) => a - b);
  }

  const allNodesSet = new Set<number>([...adjacency.keys(), ...reverseAdjacency.keys()]);
  const sortedNodes = Array.from(allNodesSet).sort((a, b) => a - b);

  let compId = 0;
  for (const start of sortedNodes) {
    if (landComponentId.has(start)) continue;
    compId++;
    const queue: number[] = [start];
    landComponentId.set(start, compId);
    for (let qi = 0; qi < queue.length; qi++) {
      const cur = queue[qi]!;
      for (const edgeList of [adjacency.get(cur), reverseAdjacency.get(cur)]) {
        if (!edgeList) continue;
        for (const e of edgeList) {
          if (e.roadGroup === "searoutes") continue;
          if (!landComponentId.has(e.to)) {
            landComponentId.set(e.to, compId);
            queue.push(e.to);
          }
        }
      }
    }
  }

  let allCompId = 0;
  for (const start of sortedNodes) {
    if (allComponentId.has(start)) continue;
    allCompId++;
    const queue: number[] = [start];
    allComponentId.set(start, allCompId);
    for (let qi = 0; qi < queue.length; qi++) {
      const cur = queue[qi]!;
      for (const edgeList of [adjacency.get(cur), reverseAdjacency.get(cur)]) {
        if (!edgeList) continue;
        for (const e of edgeList) {
          if (!allComponentId.has(e.to)) {
            allComponentId.set(e.to, allCompId);
            queue.push(e.to);
          }
        }
      }
    }
  }

  cacheLoaded = true;
}

class MinHeap<T extends { f: number }> {
  private data: T[] = [];

  get size(): number {
    return this.data.length;
  }

  push(item: T): void {
    this.data.push(item);
    let idx = this.data.length - 1;
    while (idx > 0) {
      const parentIdx = (idx - 1) >> 1;
      const parent = this.data[parentIdx];
      const cur = this.data[idx];
      if (!parent || !cur || parent.f <= cur.f) break;
      this.data[parentIdx] = cur;
      this.data[idx] = parent;
      idx = parentIdx;
    }
  }

  pop(): T | undefined {
    if (this.data.length === 0) return undefined;
    const top = this.data[0];
    const last = this.data.pop();
    if (this.data.length > 0 && last) {
      this.data[0] = last;
      let idx = 0;
      const len = this.data.length;
      while (true) {
        const left = idx * 2 + 1;
        const right = left + 1;
        let smallest = idx;
        const cur = this.data[smallest];
        const lItem = left < len ? this.data[left] : undefined;
        const rItem = right < len ? this.data[right] : undefined;
        if (lItem && cur && lItem.f < cur.f) smallest = left;
        const bestSoFar = this.data[smallest];
        if (rItem && bestSoFar && rItem.f < bestSoFar.f) smallest = right;
        if (smallest === idx) break;
        const swapA = this.data[idx];
        const swapB = this.data[smallest];
        if (!swapA || !swapB) break;
        this.data[idx] = swapB;
        this.data[smallest] = swapA;
        idx = smallest;
      }
    }
    return top;
  }
}

function snapToGraphNode(cellId: number): { node: number; snapDist: number } | null {
  if (adjacency.has(cellId)) return { node: cellId, snapDist: 0 };
  const coord = cellCoords.get(cellId);
  if (!coord) return null;

  const bx = Math.floor(coord.x / BUCKET_SIZE);
  const by = Math.floor(coord.y / BUCKET_SIZE);
  let bestNode: number | null = null;
  let bestDistSq = MAX_SNAP_DIST * MAX_SNAP_DIST;

  for (let dx = -2; dx <= 2; dx++) {
    for (let dy = -2; dy <= 2; dy++) {
      const list = graphBuckets.get(`${bx + dx},${by + dy}`);
      if (!list) continue;
      for (const candidate of list) {
        const cc = cellCoords.get(candidate);
        if (!cc) continue;
        const dSq = (cc.x - coord.x) ** 2 + (cc.y - coord.y) ** 2;
        if (dSq < bestDistSq || (dSq === bestDistSq && (bestNode === null || candidate < bestNode))) {
          bestDistSq = dSq;
          bestNode = candidate;
        }
      }
    }
  }

  return bestNode !== null ? { node: bestNode, snapDist: Math.sqrt(bestDistSq) } : null;
}

function runGraphAStar(
  startNode: number,
  goalNode: number,
  mode: "LAND" | "SEA",
  blockedCells?: Set<number>,
  avoidFactionIds?: Set<number>,
  cellFactionMap?: Map<number, number>,
  memo?: RouteSearchMemo
): number[] | null {
  if (startNode === goalNode) return [startNode];
  if (allComponentId.get(startNode) !== allComponentId.get(goalNode)) {
    return null;
  }
  if (mode === "LAND" && landComponentId.get(startNode) !== landComponentId.get(goalNode)) {
    return null;
  }

  const isStaticQuery =
    (!blockedCells || blockedCells.size === 0) &&
    (!avoidFactionIds || avoidFactionIds.size === 0);
  const cacheKey = `${mode}:${startNode}:${goalNode}`;
  if (safePathCache.has(cacheKey)) {
    const cached = safePathCache.get(cacheKey);
    if (cached === null || cached === undefined) return null;
    if (isStaticQuery) return [...cached];
    let stillValid = true;
    for (let i = 1; i + 1 < cached.length; i++) {
      const nid = cached[i]!;
      if (blockedCells?.has(nid)) {
        stillValid = false;
        break;
      }
      if (avoidFactionIds?.size && cellFactionMap) {
        const fid = cellFactionMap.get(nid) || 0;
        if (fid > 0 && avoidFactionIds.has(fid)) {
          stillValid = false;
          break;
        }
      }
    }
    if (stillValid) return [...cached];
  }

  let dynKey: string | null = null;
  if (!isStaticQuery && memo) {
    const bKey = blockedCells?.size ? Array.from(blockedCells).sort((a, b) => a - b).join(",") : "";
    const aKey = avoidFactionIds?.size ? Array.from(avoidFactionIds).sort((a, b) => a - b).join(",") : "";
    const rSig = `${mode}|${bKey}|${aKey}`;
    dynKey = `${rSig}|${startNode}|${goalNode}`;
    if (memo.dynamicPaths.has(dynKey)) {
      const cached = memo.dynamicPaths.get(dynKey);
      return cached ? [...cached] : null;
    }

    const goalKey = `${rSig}|G:${goalNode}`;
    let reachEntry = memo.goalReach.get(goalKey);
    if (!reachEntry) {
      const visitedInterior = new Set<number>([goalNode]);
      const reachable = new Set<number>([goalNode]);
      const queue: number[] = [goalNode];
      let complete = true;
      bfs: for (let qi = 0; qi < queue.length; qi++) {
        const cur = queue[qi]!;
        const inEdges = reverseAdjacency.get(cur);
        if (!inEdges) continue;
        for (const e of inEdges) {
          if (mode === "LAND" && e.roadGroup === "searoutes") continue;
          const prev = e.to;
          reachable.add(prev);
          if (blockedCells?.has(prev)) continue;
          if (avoidFactionIds?.size && cellFactionMap) {
            const fid = cellFactionMap.get(prev) || 0;
            if (fid > 0 && avoidFactionIds.has(fid)) continue;
          }
          if (!visitedInterior.has(prev)) {
            if (visitedInterior.size >= 512) {
              complete = false;
              break bfs;
            }
            visitedInterior.add(prev);
            queue.push(prev);
          }
        }
      }
      reachEntry = { complete, reachable };
      memo.goalReach.set(goalKey, reachEntry);
    }
    if (reachEntry.complete && !reachEntry.reachable.has(startNode)) {
      memo.dynamicPaths.set(dynKey, null);
      return null;
    }
  }

  const goalCoord = cellCoords.get(goalNode);
  const startCoord = cellCoords.get(startNode);
  if (!goalCoord || !startCoord) return null;

  const heap = new MinHeap<{ cell: number; f: number; g: number }>();
  const gScore = new Map<number, number>();
  const cameFrom = new Map<number, number>();
  const closed = new Set<number>();

  gScore.set(startNode, 0);
  const h0 = Math.hypot(goalCoord.x - startCoord.x, goalCoord.y - startCoord.y) * 0.65;
  heap.push({ cell: startNode, f: h0, g: 0 });

  let expansions = 0;
  let found = false;

  while (heap.size > 0 && expansions < MAX_EXPANSIONS) {
    const current = heap.pop();
    if (!current) break;
    const u = current.cell;
    if (u === goalNode) {
      found = true;
      break;
    }
    if (closed.has(u)) continue;
    const knownG = gScore.get(u);
    if (knownG !== undefined && current.g > knownG + 1e-6) continue;
    closed.add(u);
    expansions++;

    const edges = adjacency.get(u);
    if (!edges) continue;

    for (const edge of edges) {
      if (mode === "LAND" && edge.roadGroup === "searoutes") continue;
      const v = edge.to;
      if (closed.has(v)) continue;

      if (v !== startNode && v !== goalNode) {
        if (blockedCells && blockedCells.has(v)) continue;
        if (avoidFactionIds && avoidFactionIds.size > 0 && cellFactionMap) {
          const fId = cellFactionMap.get(v) || 0;
          if (fId > 0 && avoidFactionIds.has(fId)) continue;
        }
      }

      const nextG = current.g + edge.cost;
      const prevBest = gScore.get(v);
      if (prevBest === undefined || nextG < prevBest) {
        gScore.set(v, nextG);
        cameFrom.set(v, u);
        const vc = cellCoords.get(v);
        const h = vc ? Math.hypot(goalCoord.x - vc.x, goalCoord.y - vc.y) * 0.65 : 0;
        heap.push({ cell: v, f: nextG + h, g: nextG });
      }
    }
  }

  let result: number[] | null = null;
  if (found) {
    const rev: number[] = [];
    let cur: number | undefined = goalNode;
    while (cur !== undefined) {
      rev.push(cur);
      if (cur === startNode) break;
      cur = cameFrom.get(cur);
    }
    if (rev[rev.length - 1] === startNode) {
      rev.reverse();
      result = rev;
    }
  }

  if (isStaticQuery) {
    if (safePathCache.size >= MAX_SAFE_PATH_CACHE) safePathCache.clear();
    safePathCache.set(cacheKey, result ? [...result] : null);
  } else if (memo && dynKey) {
    memo.dynamicPaths.set(dynKey, result ? [...result] : null);
  }
  return result;
}

function buildAirPath(fromCellId: number, toCellId: number): number[] | null {
  if (fromCellId === toCellId) return [fromCellId];
  const from = cellCoords.get(fromCellId);
  const to = cellCoords.get(toCellId);
  if (!from || !to) return null;

  const totalDist = Math.hypot(to.x - from.x, to.y - from.y);
  const steps = Math.max(1, Math.ceil(totalDist / 42));
  const raw: number[] = [fromCellId];

  for (let s = 1; s < steps; s++) {
    const t = s / steps;
    const px = from.x + (to.x - from.x) * t;
    const py = from.y + (to.y - from.y) * t;
    const cid = findNearestCell(px, py);
    if (cid !== null && raw[raw.length - 1] !== cid) {
      raw.push(cid);
    }
  }
  if (raw[raw.length - 1] !== toCellId) {
    raw.push(toCellId);
  }

  // Refine any sparse Voronoi boundary jump above 58 map units so every hop stays <= 65
  const refined: number[] = [raw[0]!];
  for (let i = 1; i < raw.length; i++) {
    const prev = refined[refined.length - 1]!;
    const next = raw[i]!;
    const gap = distBetweenCells(prev, next);
    if (gap > 58) {
      const ca = cellCoords.get(prev);
      const cb = cellCoords.get(next);
      if (ca && cb) {
        const sub = Math.min(4, Math.ceil(gap / 45));
        for (let k = 1; k < sub; k++) {
          const mid = findNearestCell(
            ca.x + ((cb.x - ca.x) * k) / sub,
            ca.y + ((cb.y - ca.y) * k) / sub
          );
          if (mid !== null && refined[refined.length - 1] !== mid && mid !== next) {
            refined.push(mid);
          }
        }
      }
    }
    if (refined[refined.length - 1] !== next) refined.push(next);
  }

  return refined;
}

function summarizePath(mode: TransportMode, pathCells: number[]): RoutePlan {
  let totalDist = 0;
  let usesSea = false;
  let usesRoad = false;

  for (let i = 0; i + 1 < pathCells.length; i++) {
    const a = pathCells[i]!;
    const b = pathCells[i + 1]!;
    totalDist += distBetweenCells(a, b);
    const edges = adjacency.get(a);
    const edge = edges?.find((e) => e.to === b);
    if (edge) {
      if (edge.roadGroup === "searoutes") usesSea = true;
      if (edge.roadGroup === "roads") usesRoad = true;
    }
  }

  const budget = MODE_STEP_BUDGET[mode];
  const etaTicks = Math.max(1, Math.ceil(totalDist / budget));
  return {
    mode,
    pathCells,
    totalDist: Math.round(totalDist * 100) / 100,
    etaTicks,
    usesSea,
    usesRoad,
  };
}

/** Returns true when a graph node cannot be traversed due to a blockade or wartime border. */
export function isCellBlockedOrHostile(
  cellId: number,
  blockedCells?: Set<number>,
  avoidFactionIds?: Set<number>,
  cellFactionMap?: Map<number, number>
): boolean {
  if (blockedCells?.has(cellId)) return true;
  if (avoidFactionIds?.size && cellFactionMap) {
    const fid = cellFactionMap.get(cellId) || 0;
    if (fid > 0 && avoidFactionIds.has(fid)) return true;
  }
  return false;
}

/**
 * Synchronous cached lookup finding the best legal trade route across requested transport modes.
 * Assumes `ensureRouteGraphCache` has already populated the static route graph in memory.
 */
export function findTradeRouteSync(opts: FindRouteOptions): RoutePlan | null {
  const { fromCellId, toCellId, allowedModes, blockedCells, avoidFactionIds, cellFactionMap } = opts;
  if (!fromCellId || !toCellId || allowedModes.length === 0) return null;

  const candidates: RoutePlan[] = [];

  for (const mode of allowedModes) {
    if (mode === "AIR") {
      const airCells = buildAirPath(fromCellId, toCellId);
      if (airCells && airCells.length > 0) {
        candidates.push(summarizePath("AIR", airCells));
      }
      continue;
    }

    if (blockedCells?.has(fromCellId) || blockedCells?.has(toCellId)) {
      continue;
    }

    const fromSnap = snapToGraphNode(fromCellId);
    const toSnap = snapToGraphNode(toCellId);
    if (!fromSnap || !toSnap) continue;

    // Ensure a snapped entry/exit node does not force trespass through a hostile wartorn faction or blockaded chokepoint
    if (fromSnap.node !== fromCellId && isCellBlockedOrHostile(fromSnap.node, blockedCells, avoidFactionIds, cellFactionMap)) {
      continue;
    }
    if (toSnap.node !== toCellId && isCellBlockedOrHostile(toSnap.node, blockedCells, avoidFactionIds, cellFactionMap)) {
      continue;
    }

    const corePath = runGraphAStar(
      fromSnap.node,
      toSnap.node,
      mode,
      blockedCells,
      avoidFactionIds,
      cellFactionMap,
      opts.memo
    );
    if (!corePath || corePath.length === 0) continue;

    const fullPath: number[] = [];
    if (corePath[0] !== fromCellId) fullPath.push(fromCellId);
    for (const cid of corePath) {
      if (fullPath[fullPath.length - 1] !== cid) fullPath.push(cid);
    }
    if (fullPath[fullPath.length - 1] !== toCellId) fullPath.push(toCellId);

    const summary = summarizePath(mode, fullPath);
    if (mode === "SEA" && !summary.usesSea) {
      // Pure inland trail/road path should not be booked as a maritime voyage
      continue;
    }
    candidates.push(summary);
  }

  if (candidates.length === 0) return null;

  const modeOrder = (m: TransportMode) => allowedModes.indexOf(m);
  candidates.sort((a, b) => {
    if (a.etaTicks !== b.etaTicks) return a.etaTicks - b.etaTicks;
    if (Math.abs(a.totalDist - b.totalDist) > 1e-6) return a.totalDist - b.totalDist;
    return modeOrder(a.mode) - modeOrder(b.mode);
  });

  return candidates[0] || null;
}

/**
 * Finds the best legal trade route across requested transport modes.
 * Returns null if all allowed modes are blocked by geography, war borders, or embargoes.
 */
export async function findTradeRoute(client: Db, opts: FindRouteOptions): Promise<RoutePlan | null> {
  await ensureRouteGraphCache(client);
  return findTradeRouteSync(opts);
}

/**
 * Advances a convoy discretely along its precomputed `pathCells` by at most 1 tick's step budget
 * (strictly bounded to <= 65 map units straight-line displacement when multi-hopping).
 */
export function advanceAlongPath(
  pathCells: number[],
  currentIndex: number,
  mode: TransportMode
): PathStepResult {
  if (!Array.isArray(pathCells) || pathCells.length === 0) {
    return { nextIndex: 0, nextCellId: 0, visitedCells: [], arrived: true, stepDist: 0 };
  }

  const safeIdx = Math.max(0, Math.min(currentIndex, pathCells.length - 1));
  const startCell = pathCells[safeIdx]!;
  if (safeIdx >= pathCells.length - 1) {
    return {
      nextIndex: pathCells.length - 1,
      nextCellId: startCell,
      visitedCells: [],
      arrived: true,
      stepDist: 0,
    };
  }

  const budget = Math.min(MAX_CONVOY_STEP_UNITS, MODE_STEP_BUDGET[mode] || 56);
  let idx = safeIdx;
  let accDist = 0;
  const visitedCells: number[] = [];

  while (idx + 1 < pathCells.length) {
    const prevCell = pathCells[idx]!;
    const candidateCell = pathCells[idx + 1]!;
    const segDist = distBetweenCells(prevCell, candidateCell);
    const directDisp = distBetweenCells(startCell, candidateCell);

    if (
      visitedCells.length > 0 &&
      (accDist + segDist > budget || directDisp > MAX_CONVOY_STEP_UNITS)
    ) {
      break;
    }

    idx++;
    accDist += segDist;
    visitedCells.push(candidateCell);
  }

  const nextCellId = pathCells[idx]!;
  return {
    nextIndex: idx,
    nextCellId,
    visitedCells,
    arrived: idx >= pathCells.length - 1,
    stepDist: Math.round(accDist * 100) / 100,
  };
}
