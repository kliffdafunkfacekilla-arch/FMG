import { Grid } from "../../core/types";

// Generate wind-driven surface currents deflected by coastlines
export function calculateOceanCurrents(
  grid: Grid,
  heights: Uint8Array,
  windX: number = 1.0, // default westerly winds
  windY: number = 0.0
): Float32Array {
  const pointsN = heights.length;
  const currents = new Float32Array(pointsN * 2); // packed x,y components
  const points = grid.points;

  for (let i = 0; i < pointsN; i++) {
    if (heights[i] >= 20) continue; // Only simulate currents in ocean cells

    const neighbors = grid.cells.c[i] || [];
    let curX = windX;
    let curY = windY;

    // Deflect currents near coastlines to flow parallel to the shore
    let coastNormX = 0;
    let coastNormY = 0;
    let coastNeighborsCount = 0;

    const [px, py] = points[i];

    for (const n of neighbors) {
      if (heights[n] >= 20) {
        // Neighbor is land, calculate boundary deflection vector
        const [nx, ny] = points[n];
        const dx = nx - px;
        const dy = ny - py;
        const dist = Math.hypot(dx, dy);
        if (dist > 0) {
          coastNormX += dx / dist;
          coastNormY += dy / dist;
          coastNeighborsCount++;
        }
      }
    }

    if (coastNeighborsCount > 0) {
      // Normalize coast norm
      const len = Math.hypot(coastNormX, coastNormY);
      const nx = coastNormX / len;
      const ny = coastNormY / len;

      // Project wind vector onto the tangent of the coastline (deflection)
      const dotProd = curX * nx + curY * ny;
      curX -= dotProd * nx;
      curY -= dotProd * ny;
    }

    const curLen = Math.hypot(curX, curY);
    if (curLen > 0) {
      currents[i * 2] = curX / curLen;
      currents[i * 2 + 1] = curY / curLen;
    }
  }

  return currents;
}

// Generate upwelling flux (ocean rivers) running from deep trenches to shelves
export function calculateUpwellingFlux(
  grid: Grid,
  heights: Uint8Array
): Float32Array {
  const pointsN = heights.length;
  const upwellingFlux = new Float32Array(pointsN);
  const upwellingDirections = new Int32Array(pointsN).fill(-1);

  // 1. Determine uphill upwelling flow routing direction (deepest ocean to shallowest shelf)
  for (let i = 0; i < pointsN; i++) {
    if (heights[i] >= 20) continue;

    const neighbors = grid.cells.c[i] || [];
    let bestTarget = -1;
    let bestHeight = heights[i];

    for (const n of neighbors) {
      if (heights[n] >= 20) {
        // Land neighbors terminate upwelling networks at coastal shelves
        bestTarget = n;
        break;
      }
      
      // Flow uphill from deep ocean to shallower ocean shelves
      if (heights[n] > bestHeight && heights[n] < 20) {
        bestHeight = heights[n];
        bestTarget = n;
      }
    }

    upwellingDirections[i] = bestTarget;
  }

  // 2. Accumulate upwelling volumes (Trenches heights < 5 act as springs)
  const sortedIndices = Array.from({ length: pointsN }, (_, idx) => idx)
    .sort((a, b) => heights[a] - heights[b]); // Sort deepest to shallowest

  // Set up baseline upwelling volumes
  for (let i = 0; i < pointsN; i++) {
    if (heights[i] < 20) {
      // Trench cells produce massive base upwelling flux
      upwellingFlux[i] = heights[i] < 5 ? 15.0 : 1.0;
    }
  }

  // Route and accumulate flow
  for (const i of sortedIndices) {
    if (heights[i] >= 20) continue;

    const target = upwellingDirections[i];
    if (target !== -1) {
      upwellingFlux[target] += upwellingFlux[i];
    }
  }

  return upwellingFlux;
}

// Compute coastal nutrient runoff and run cellular automata diffusion
export function calculateOceanNutrients(
  grid: Grid,
  heights: Uint8Array,
  flowDirections: Int32Array,
  landFlux: Float32Array,
  upwellingFlux: Float32Array
): Float32Array {
  const pointsN = heights.length;
  const nutrients = new Float32Array(pointsN);

  // 1. Add Land Runoff at river mouth cells
  for (let i = 0; i < pointsN; i++) {
    if (heights[i] >= 20) {
      const target = flowDirections[i];
      // If river target flows into ocean, it's a mouth cell
      if (target !== -1 && heights[target] < 20) {
        nutrients[target] += landFlux[i] * 1.5; // Nutrient runoff proportional to river flux
      }
    }
  }

  // 2. Add Upwelling shelf nutrient contribution
  for (let i = 0; i < pointsN; i++) {
    if (heights[i] < 20) {
      // Upwelling brings cold, nutrient-rich deep water to the shelves
      nutrients[i] += upwellingFlux[i] * 0.8;
    }
  }

  // 3. Cellular Automata: Diffuse nutrients through ocean cells
  const nextNutrients = new Float32Array(pointsN);
  const diffusionRate = 0.15;

  for (let i = 0; i < pointsN; i++) {
    if (heights[i] >= 20) continue;

    const neighbors = grid.cells.c[i] || [];
    let validNeighborsCount = 0;
    let sumNutrients = 0;

    for (const n of neighbors) {
      if (heights[n] < 20) {
        // Trench barriers: deep trench topography acts as a shadow barrier
        const isTrenchBarrier = heights[i] < 5 && heights[n] >= 15;
        const mixFactor = isTrenchBarrier ? 0.2 : 1.0;

        sumNutrients += nutrients[n] * mixFactor;
        validNeighborsCount += mixFactor;
      }
    }

    if (validNeighborsCount > 0) {
      nextNutrients[i] = nutrients[i] * (1 - diffusionRate) + (sumNutrients / validNeighborsCount) * diffusionRate;
    } else {
      nextNutrients[i] = nutrients[i];
    }
  }

  return nextNutrients;
}
