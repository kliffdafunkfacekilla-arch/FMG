import { Grid } from "../../core/types";
import { Names } from "./name-generator";
import { Culture } from "./culture-generator";


export interface Burg {
  id: number;
  cell: number;
  x: number;
  y: number;
  name: string;
  population: number;
  isCapital: boolean;
  port: number; // 0 if none, or the feature ID of the ocean/lake it ports to
  harborRating: number;
  crossroadRating: number;
  defensiveRating: number;
  capitalRating: number;
}

const BURG_NAMES_PREFIX = ["Odin", "Gron", "New", "Old", "Al", "Roth", "Stone", "Black", "Oak", "River"];
const BURG_NAMES_SUFFIX = ["burg", "grad", "ville", "ton", "ford", "port", "shire", "field", "wood", "crag"];

export function calculateHarborRating(grid: Grid, heights: Uint8Array, cellId: number): number {
  if (heights[cellId] < 20) return 0; // Not on land

  let waterNeighbors = 0;
  let landNeighbors = 0;

  for (const n of grid.cells.c[cellId]) {
    if (heights[n] < 20) waterNeighbors++;
    else landNeighbors++;
  }

  // A protected cove or inlet has many land neighbors and some water neighbors
  if (waterNeighbors > 0 && landNeighbors >= waterNeighbors) {
    return waterNeighbors * 2.0; // good harbor
  }

  return waterNeighbors > 0 ? 1.0 : 0.0;
}

export function calculateCrossroadRating(grid: Grid, heights: Uint8Array, biomes: Uint8Array, cellId: number): number {
  if (heights[cellId] < 20) return 0;

  const h = heights[cellId];
  let rating = 0;

  // Flat areas are good crossroads
  if (h >= 20 && h < 50) rating += 3.0;

  // Passes between mountains
  let highNeighbors = 0;
  let lowNeighbors = 0;
  for (const n of grid.cells.c[cellId]) {
    if (heights[n] >= 70) highNeighbors++;
    else if (heights[n] < 50 && heights[n] >= 20) lowNeighbors++;
  }

  if (highNeighbors > 0 && lowNeighbors > 0) rating += 4.0; // valley or pass

  // Habitability multiplier
  if (biomes[cellId] >= 4 && biomes[cellId] <= 9) rating += 2.0;

  return rating;
}

export function calculateDefensiveRating(grid: Grid, heights: Uint8Array, cellId: number): number {
  if (heights[cellId] < 20) return 0;

  let rating = 0;
  const h = heights[cellId];

  // Elevated positions
  if (h > 60) rating += 4.0;
  else if (h > 40) rating += 2.0;

  // Natural choke points (peninsulas, surrounded by mountains/water)
  let impassableNeighbors = 0;
  for (const n of grid.cells.c[cellId]) {
    if (heights[n] < 20 || heights[n] > 80) impassableNeighbors++;
  }

  rating += impassableNeighbors * 1.5;

  return rating;
}

export function calculateCapitalRating(
  grid: Grid,
  heights: Uint8Array,
  biomes: Uint8Array,
  rivers: Uint16Array,
  flux: Float32Array,
  cellId: number
): number {
  if (heights[cellId] < 20) return 0;

  let rating = 0;

  // Centrality/Habitability (temperate biomes)
  const biome = biomes[cellId];
  if (biome === 6 || biome === 8) rating += 5.0; // Temperate forests
  else if (biome >= 4 && biome <= 9) rating += 3.0; // Other habitable

  // Water access
  if (rivers[cellId] > 0) rating += 3.0;
  if (flux && flux[cellId] > 50.0) rating += 3.0;

  let isCoast = false;
  for (const n of grid.cells.c[cellId]) {
    if (heights[n] < 20) {
      isCoast = true;
      break;
    }
  }
  if (isCoast) rating += 4.0;

  // Flat/buildable terrain
  const h = heights[cellId];
  if (h >= 20 && h < 50) rating += 3.0;

  return rating;
}


export function calculateSuitability(
  grid: Grid,
  heights: Uint8Array,
  biomes: Uint8Array,
  rivers: Uint16Array,
  flux: Float32Array
): Float32Array {
  const pointsN = heights.length;
  const score = new Float32Array(pointsN);

  for (let i = 0; i < pointsN; i++) {
    if (heights[i] < 20) continue; // no cities in the ocean/lakes

    let cellScore = 5.0;

    // 1. Biome habitability bonuses
    const biome = biomes[i];
    if (biome === 1 || biome === 2) cellScore -= 4.0; // desert penalty
    if (biome === 11) cellScore = 0; // glaciers are uninhabitable
    if (biome === 6 || biome === 8) cellScore += 5.0; // temperate dec/rain forests are great

    // 2. Proximity to water / coastlines
    let isCoast = false;
    for (const c of grid.cells.c[i]) {
      if (heights[c] < 20) {
        isCoast = true;
        break;
      }
    }
    if (isCoast) cellScore += 6.0; // port possibility

    // 3. Rivers & Confluences
    if (rivers[i] > 0) {
      cellScore += 4.0;
      // confluence bonus
      const fluxVal = flux ? flux[i] || 1.0 : 1.0;
      if (fluxVal > 50.0) {
        cellScore += 5.0;
      }
    }

    // 4. Integrations of Rating Equations
    const harborRating = calculateHarborRating(grid, heights, i);
    const crossroadRating = calculateCrossroadRating(grid, heights, biomes, i);
    const defensiveRating = calculateDefensiveRating(grid, heights, i);
    const capitalRating = calculateCapitalRating(grid, heights, biomes, rivers, flux, i);

    cellScore += harborRating * 0.5 + crossroadRating * 0.3 + defensiveRating * 0.2 + capitalRating * 0.4;

    score[i] = Math.max(0, cellScore);
  }

  return score;
}

export function generateBurgs(
  grid: Grid,
  heights: Uint8Array,
  biomes: Uint8Array,
  rivers: Uint16Array,
  flux: Float32Array,
  count = 20,
  cellCultures?: Uint8Array,
  cultures?: Culture[]
): Burg[] {
  const pointsN = heights.length;
  const score = calculateSuitability(grid, heights, biomes, rivers, flux);
  const burgs: Burg[] = [];

  const placedCellIds = new Set<number>();

  // Find local maxima / best candidates
  const candidates: { cellId: number; score: number }[] = [];
  for (let i = 0; i < pointsN; i++) {
    if (score[i] > 0) {
      candidates.push({ cellId: i, score: score[i] });
    }
  }

  // Sort descending by score
  candidates.sort((a, b) => b.score - a.score);

  let nextBurgId = 1;
  for (const candidate of candidates) {
    if (burgs.length >= count) break;

    // Ensure it's not too close to another placed burg
    let tooClose = false;
    for (const b of burgs) {
      const [x1, y1] = grid.points[b.cell];
      const [x2, y2] = grid.points[candidate.cellId];
      const dist = Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
      if (dist < grid.spacing * 3.5) {
        tooClose = true;
        break;
      }
    }

    if (tooClose) continue;

    const cellId = candidate.cellId;
    const [x, y] = grid.points[cellId];
    
    // Check if near coast to assign port flag
    let port = 0;
    for (const c of grid.cells.c[cellId]) {
      if (heights[c] < 20) {
        port = 1; // standard water body port
        break;
      }
    }

    let name = "";
    if (cellCultures && cultures) {
      const cultureId = cellCultures[cellId];
      const culture = cultures.find(c => c.id === cultureId);
      if (culture && culture.base !== undefined) {
        name = Names.getBase(culture.base);
      }
    }

    if (!name) {
      const pref = BURG_NAMES_PREFIX[Math.floor(Math.random() * BURG_NAMES_PREFIX.length)];
      const suff = BURG_NAMES_SUFFIX[Math.floor(Math.random() * BURG_NAMES_SUFFIX.length)];
      name = `${pref}${suff}`;
    }

    const harborRating = calculateHarborRating(grid, heights, cellId);
    const crossroadRating = calculateCrossroadRating(grid, heights, biomes, cellId);
    const defensiveRating = calculateDefensiveRating(grid, heights, cellId);
    const capitalRating = calculateCapitalRating(grid, heights, biomes, rivers, flux, cellId);

    burgs.push({
      id: nextBurgId++,
      cell: cellId,
      x,
      y,
      name,
      population: Math.round(1000 + candidate.score * 500 + Math.random() * 2000),
      isCapital: false,
      port,
      harborRating,
      crossroadRating,
      defensiveRating,
      capitalRating
    });
  }

  return burgs;
}
