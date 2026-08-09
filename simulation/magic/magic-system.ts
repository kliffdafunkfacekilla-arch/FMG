import { Grid } from "../../core/types";
import { MagicTypeConfig } from "../../state/store";

export interface MagicNetwork {
  nodes: number[];
  leyLines: [number, number][]; // pairs of node cell indices
}

// Generate magical nodes at peaks or deep forest centers
export function generateMagicNodes(
  grid: Grid,
  heights: Uint8Array,
  biomes: Uint8Array,
  count = 6
): number[] {
  const pointsN = heights.length;
  const candidates: { cellId: number; score: number }[] = [];

  for (let i = 0; i < pointsN; i++) {
    const isPeak = heights[i] > 70;
    const isDeepForest = biomes[i] === 9; // Tropical Forest
    if (isPeak || isDeepForest) {
      const score = (heights[i] - 20) + (isDeepForest ? 50 : 0);
      candidates.push({ cellId: i, score });
    }
  }

  // Sort candidates by score descending
  candidates.sort((a, b) => b.score - a.score);

  // Take nodes that are spatially separated
  const nodes: number[] = [];
  const points = grid.points;

  for (const c of candidates) {
    if (nodes.length >= count) break;
    const [x1, y1] = points[c.cellId];

    // Ensure it is at least 150 units away from already selected nodes
    const isFar = nodes.every(nId => {
      const [x2, y2] = points[nId];
      return Math.hypot(x2 - x1, y2 - y1) > 150;
    });

    if (isFar) {
      nodes.push(c.cellId);
    }
  }

  // Fallback to random centers if none found
  while (nodes.length < count && pointsN > 0) {
    const randCell = Math.floor(Math.random() * pointsN);
    if (!nodes.includes(randCell)) nodes.push(randCell);
  }

  return nodes;
}

// Connect nodes using Prim's algorithm to generate a Minimum Spanning Tree of Ley-Lines
export function generateLeyLines(grid: Grid, nodes: number[]): [number, number][] {
  const leyLines: [number, number][] = [];
  if (nodes.length < 2) return leyLines;

  const points = grid.points;
  const connected = new Set<number>([nodes[0]]);
  const remaining = new Set<number>(nodes.slice(1));

  while (remaining.size > 0) {
    let minDist = Infinity;
    let bestEdge: [number, number] | null = null;

    for (const u of connected) {
      const [ux, uy] = points[u];
      for (const v of remaining) {
        const [vx, vy] = points[v];
        const dist = Math.hypot(vx - ux, vy - uy);
        if (dist < minDist) {
          minDist = dist;
          bestEdge = [u, v];
        }
      }
    }

    if (bestEdge) {
      const [u, v] = bestEdge;
      leyLines.push([u, v]);
      connected.add(v);
      remaining.delete(v);
    } else {
      break;
    }
  }

  return leyLines;
}

// Distance from point p to line segment ab
function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(px - ax, py - ay);

  let t = ((px - ax) * dx + (py - ay) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// Calculate cell-by-cell magical flux intensity based on nodes and ley-lines
export function calculateMagicFlux(
  grid: Grid,
  nodes: number[],
  leyLines: [number, number][]
): Float32Array {
  const pointsN = grid.points.length;
  const flux = new Float32Array(pointsN);
  const points = grid.points;

  for (let i = 0; i < pointsN; i++) {
    const [px, py] = points[i];
    let totalIntensity = 0.0;

    // Node intensity drop-off
    for (const n of nodes) {
      const [nx, ny] = points[n];
      const dist = Math.hypot(nx - px, ny - py);
      totalIntensity += 120.0 / (1.0 + dist * 0.08);
    }

    // Ley-line proximity intensity
    for (const [u, v] of leyLines) {
      const [ux, uy] = points[u];
      const [vx, vy] = points[v];
      const dist = distToSegment(px, py, ux, uy, vx, vy);
      totalIntensity += 60.0 / (1.0 + dist * 0.1);
    }

    flux[i] = Math.min(100.0, totalIntensity);
  }

  return flux;
}

// Calculate mage population density based on magic flux and types config
export function calculateMagePopulations(
  magicFlux: Float32Array,
  populations: Float32Array,
  magicTypes: MagicTypeConfig[]
): Uint32Array {
  const pointsN = magicFlux.length;
  const magePop = new Uint32Array(pointsN);
  
  // Aggregate base rarity from all config types
  const baseRarity = magicTypes.reduce((sum, t) => sum + t.rarity, 0) || 0.01;

  for (let i = 0; i < pointsN; i++) {
    const pop = populations[i] || 0;
    const flux = magicFlux[i];
    
    // Mages thrive in high-flux areas (scales up to 4x base rarity)
    const localRarity = baseRarity * (0.5 + (flux / 100.0) * 3.5);
    magePop[i] = Math.round(pop * localRarity);
  }

  return magePop;
}

// Apply dynamic magical vector modifiers to economics, military, growth, and taxation
export function applyMagicGeopoliticalVectors(
  states: any[],
  updatedBurgs: any[],
  cellStates: Uint8Array,
  magicFlux: Float32Array,
  magePopulation: Uint32Array,
  magicTypes: MagicTypeConfig[]
): void {
  const stateMap = new Map(states.map(s => [s.id, s]));

  // Calculate total population per state
  const statePop = new Map<number, number>();
  const stateMages = new Map<number, number>();

  for (let i = 0; i < cellStates.length; i++) {
    const sId = cellStates[i];
    if (sId === 0) continue;

    statePop.set(sId, (statePop.get(sId) || 0) + (magePopulation[i] * 100)); // proxy total pop
    stateMages.set(sId, (stateMages.get(sId) || 0) + magePopulation[i]);
  }

  for (const state of states) {
    const magesCount = stateMages.get(state.id) || 0;
    const totalPop = statePop.get(state.id) || 1000;
    const mageRatio = magesCount / Math.max(1, totalPop);

    // Apply combined weights of all magic configs scaled by mage ratio
    let prodMult = 1.0;
    let milMult = 1.0;
    let taxMult = 1.0;

    for (const config of magicTypes) {
      // Leverage modifier represents how strongly mages skew the results
      const leverage = mageRatio * 5.0; 
      prodMult += (config.weights.production - 1.0) * leverage;
      milMult += (config.weights.military - 1.0) * leverage;
      taxMult += (config.weights.taxation - 1.0) * leverage;
    }

    state.treasury = Math.round(state.treasury * Math.max(0.5, taxMult));
    state.militaryPower = Math.round(state.militaryPower * Math.max(0.5, milMult));
  }
}

// Perform daily volatility rolls checks (accidents, mutated biomes)
export function runMagicVolatilityChecks(
  biomes: Uint8Array,
  magicFlux: Float32Array,
  magicTypes: MagicTypeConfig[]
): Uint8Array {
  const pointsN = biomes.length;
  const nextBiomes = new Uint8Array(biomes);

  // Aggregate volatilities
  const baseAccident = magicTypes.reduce((maxVal, t) => Math.max(maxVal, t.volatility.accidents), 0);
  const baseInstability = magicTypes.reduce((maxVal, t) => Math.max(maxVal, t.volatility.instability), 0);

  for (let i = 0; i < pointsN; i++) {
    const flux = magicFlux[i];
    if (flux < 55.0) continue; // High flux threshold

    // Magical Instability converts biomes randomly to Oasis (biome 4) or magical mutations
    const instChance = baseInstability * (flux / 100.0) * 0.05; // scaled daily probability
    if (Math.random() < instChance) {
      // Mutate to Sand Desert (biome 3) or Oasis (biome 4)
      nextBiomes[i] = Math.random() > 0.5 ? 3 : 4;
    }
  }

  return nextBiomes;
}
