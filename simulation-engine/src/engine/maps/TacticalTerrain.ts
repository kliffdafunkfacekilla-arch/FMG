/**
 * Natural ground for a 256x256 tactical surface map (z = 0), painted from the regional map.
 *
 * A tactical map is one cell (rx, ry) of a region's 100x100 grid. This paints it from the 3x3 block of
 * regional cells around it, so the map reads like the region:
 *  - elevation, vegetation, chaos and "is water" are blended between the nine cell centres, so coasts,
 *    rivers, forest edges and high ground run in from the neighbours, and two adjacent tactical maps
 *    agree along their shared edge;
 *  - detail noise is sampled in region-wide pixel coordinates (rx * 256 + x), also seamless;
 *  - each biome has its own ground, patches, cover and rock (a glacier is snow and ice, not meadow);
 *  - roads and trails run from the centre towards the neighbouring cells that actually carry them.
 *
 * Regional codes (regional/RegionalInstance.ts):
 *   mapData: 0 open, 1 light vegetation, 2 dense forest, 3 water, 4 burg, 5 road, 6 trail, 7 shrine,
 *            8 crags, 9 farm, 10 logging, 11 mine, 12 watchtower
 *   infraMap: 1 burg, 2 road, 4 trail, 6 watchtower, 8/16 shrine, 12 mine, 24 logging, 32 river,
 *             48 farm, 64 bridge (plain codes, not bit flags)
 */
import { SimplexNoise } from "../../regional/SimplexNoise";

/**
 * Bump when the surface generator changes how a map looks. Cached regional surface maps
 * (sim_sector_layers, features.terrainVersion) older than this are regenerated on next view.
 */
export const TERRAIN_VERSION = 5;

/** Surface tile ids. 0-12 existed before; 13+ are the natural-ground tiles added here. */
export const TILE = {
  MEADOW: 0, TREES: 1, WATER: 2, DIRT: 3, COBBLE: 4, ROCK: 5, CHAOS: 6, ROOF: 7, FIRE: 8,
  SAND: 9, MONOLITH: 10, FROST: 11, BASALT: 12,
  SNOW: 13, ICE: 14, CONIFER: 15, TALL_GRASS: 16, MARSH: 17, SCREE: 18, DRY_GRASS: 19,
  JUNGLE: 20, DEEP_WATER: 21, BARE_EARTH: 22, SHRUB: 23, BRIDGE: 24,
} as const;

/** The 3x3 regional cells around (rx, ry); [dy + 1][dx + 1]. Cells off the region repeat the centre. */
export interface RegionalNeighborhood {
  terrain: number[][];
  infra: number[][];
  elevation: number[][];
  vegetation: number[][];
  chaos: number[][];
  biome: number[][];
}

/** Builds the neighbourhood from a RegionalInstance-like object (100x100 typed arrays). */
export function regionalNeighborhood(reg: any, rx: number, ry: number): RegionalNeighborhood | undefined {
  if (!reg?.mapData) return undefined;
  const W = reg.w || 100, H = reg.h || 100;
  const grab = (arr: ArrayLike<number> | undefined, fallback: number) => {
    const out: number[][] = [];
    for (let dy = -1; dy <= 1; dy++) {
      const row: number[] = [];
      for (let dx = -1; dx <= 1; dx++) {
        const x = Math.max(0, Math.min(W - 1, rx + dx));
        const y = Math.max(0, Math.min(H - 1, ry + dy));
        row.push(arr ? Number(arr[y * W + x]) : fallback);
      }
      out.push(row);
    }
    return out;
  };
  return {
    terrain: grab(reg.mapData, 0),
    infra: grab(reg.infraMap, 0),
    elevation: grab(reg.elevationMap, 50),
    vegetation: grab(reg.vegetationMap, 0.3),
    chaos: grab(reg.chaosMap, 0),
    biome: grab(reg.biomeMap, 4),
  };
}

interface BiomeProfile {
  ground: number;
  patch: number;        // secondary ground in noise patches
  cover: number | null; // tree / jungle / conifer tile, or none
  coverDensity: number; // 0..1 share of the map under cover at average vegetation
  shrub: number;        // fringe of cover, and scattered bushes
  rock: number;         // loose rock around outcrops
}

// FMG biome ids (RegionalInstance.getBiomeLabel).
const PROFILES: Record<number, BiomeProfile> = {
  1: { ground: TILE.SAND, patch: TILE.BARE_EARTH, cover: null, coverDensity: 0, shrub: TILE.SHRUB, rock: TILE.SCREE },          // hot desert
  2: { ground: TILE.SCREE, patch: TILE.SAND, cover: null, coverDensity: 0, shrub: TILE.SHRUB, rock: TILE.ROCK },                // cold desert
  3: { ground: TILE.DRY_GRASS, patch: TILE.MEADOW, cover: TILE.TREES, coverDensity: 0.12, shrub: TILE.SHRUB, rock: TILE.SCREE }, // savanna
  4: { ground: TILE.MEADOW, patch: TILE.TALL_GRASS, cover: TILE.TREES, coverDensity: 0.18, shrub: TILE.SHRUB, rock: TILE.SCREE }, // grassland
  5: { ground: TILE.MEADOW, patch: TILE.TALL_GRASS, cover: TILE.TREES, coverDensity: 0.55, shrub: TILE.SHRUB, rock: TILE.SCREE }, // tropical seasonal forest
  6: { ground: TILE.MEADOW, patch: TILE.TALL_GRASS, cover: TILE.TREES, coverDensity: 0.62, shrub: TILE.SHRUB, rock: TILE.SCREE }, // temperate deciduous forest
  7: { ground: TILE.TALL_GRASS, patch: TILE.MARSH, cover: TILE.JUNGLE, coverDensity: 0.8, shrub: TILE.TREES, rock: TILE.SCREE },  // tropical rainforest
  8: { ground: TILE.TALL_GRASS, patch: TILE.MEADOW, cover: TILE.CONIFER, coverDensity: 0.75, shrub: TILE.SHRUB, rock: TILE.SCREE }, // temperate rainforest
  9: { ground: TILE.SNOW, patch: TILE.TALL_GRASS, cover: TILE.CONIFER, coverDensity: 0.55, shrub: TILE.SHRUB, rock: TILE.SCREE },   // taiga
  10: { ground: TILE.SNOW, patch: TILE.TALL_GRASS, cover: null, coverDensity: 0, shrub: TILE.SHRUB, rock: TILE.SCREE },             // tundra
  11: { ground: TILE.SNOW, patch: TILE.ICE, cover: null, coverDensity: 0, shrub: TILE.SNOW, rock: TILE.SCREE },                      // glacier
  12: { ground: TILE.TALL_GRASS, patch: TILE.MARSH, cover: TILE.TREES, coverDensity: 0.28, shrub: TILE.SHRUB, rock: TILE.BARE_EARTH }, // wetland
  18: { ground: TILE.BASALT, patch: TILE.BARE_EARTH, cover: null, coverDensity: 0, shrub: TILE.SCREE, rock: TILE.ROCK },            // chaos land
};
const DEFAULT_PROFILE = PROFILES[4]!;
const isWaterBiome = (b: number) => [0, 13, 14, 15, 16, 17, 19].includes(b);

export interface TerrainPaintInput {
  grid: Uint8Array;
  cellId: number;
  rx: number;
  ry: number;
  biomeId: number;
  hood?: RegionalNeighborhood | undefined;
  // Fallbacks when no neighbourhood is available (single-cell values)
  terrainType?: number | undefined;
  infraMask?: number | undefined;
  elevation?: number | undefined;
  vegetation?: number | undefined;
  chaos?: number | undefined;
}

export interface TerrainPaintResult {
  /** Fraction of the map that is water (0..1). */
  waterShare: number;
  /** True when a road or trail was laid. */
  hasRoad: boolean;
  /** A dry, open pixel near the centre for a point of interest. */
  openSpot: [number, number];
}

const SIZE = 256;

/** 1x1 neighbourhood from single-cell values (no regional instance). */
function flatHood(t: number, inf: number, e: number, v: number, c: number, b: number): RegionalNeighborhood {
  const f = (x: number) => [[x, x, x], [x, x, x], [x, x, x]];
  return { terrain: f(t), infra: f(inf), elevation: f(e), vegetation: f(v), chaos: f(c), biome: f(b) };
}

export function paintTacticalTerrain(input: TerrainPaintInput): TerrainPaintResult {
  const { grid, cellId, rx, ry } = input;
  const hood = input.hood ?? flatHood(input.terrainType ?? 0, input.infraMask ?? 0, input.elevation ?? 50,
    input.vegetation ?? 0.3, input.chaos ?? 0, input.biomeId);
  const centreBiome = hood.biome[1]![1]!;
  const profile = PROFILES[centreBiome] ?? PROFILES[input.biomeId] ?? DEFAULT_PROFILE;

  // Noise fields, seeded per region and sampled in region-wide pixel coordinates (seamless between maps).
  const nGround = new SimplexNoise(cellId * 7 + 1);
  const nCover = new SimplexNoise(cellId * 7 + 2);
  const nRock = new SimplexNoise(cellId * 7 + 3);
  const nWater = new SimplexNoise(cellId * 7 + 4);
  const nDetail = new SimplexNoise(cellId * 7 + 5);
  const nChaos = new SimplexNoise(cellId * 7 + 6);
  const fbm = (n: SimplexNoise, x: number, y: number, octaves = 4) => {
    let amp = 1, freq = 1, sum = 0, norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += n.noise2D(x * freq, y * freq) * amp;
      norm += amp; amp *= 0.5; freq *= 2;
    }
    return sum / norm; // ~ -1..1
  };

  // Per-cell scalar fields for bilinear blending between the nine regional cell centres.
  const waterness = hood.terrain.map(r => r.map(t => (t === 3 ? 1 : 0)));
  const coverClass = hood.terrain.map(r => r.map(t => (t === 2 ? 1 : t === 1 ? 0.65 : t === 10 ? 0.8 : t === 0 ? 0.3 : 0.15)));
  const crag = hood.terrain.map(r => r.map(t => (t === 8 ? 1 : 0)));
  for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) {
    if (isWaterBiome(hood.biome[dy]![dx]!)) waterness[dy]![dx] = 1;
  }

  // Bilinear sample of a 3x3 field at pixel (x, y): centres sit at -1, 0, +1 cell units around this map.
  const sample = (f: number[][], x: number, y: number) => {
    const px = (x + 0.5) / SIZE - 0.5, py = (y + 0.5) / SIZE - 0.5;
    const ix = px < 0 ? -1 : 0, iy = py < 0 ? -1 : 0;
    const tx = px - ix, ty = py - iy;
    const a = f[iy + 1]![ix + 1]!, b = f[iy + 1]![ix + 2]!, c = f[iy + 2]![ix + 1]!, d = f[iy + 2]![ix + 2]!;
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  };

  const gx0 = rx * SIZE, gy0 = ry * SIZE;
  let waterCount = 0;

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = y * SIZE + x;
      const gx = gx0 + x, gy = gy0 + y;

      // Water: blended "is water" with a ragged shoreline.
      const w = sample(waterness, x, y) + fbm(nWater, gx / 90, gy / 90, 3) * 0.18;
      if (w > 0.5) {
        grid[i] = w > 0.78 ? TILE.DEEP_WATER : TILE.WATER;
        waterCount++;
        continue;
      }
      // Wet margin along shores
      const shore = w > 0.43;

      const elevation = sample(hood.elevation, x, y) + fbm(nRock, gx / 140, gy / 140, 3) * 8;
      const vegetation = sample(hood.vegetation, x, y);
      const cover = sample(coverClass, x, y);
      const chaos = sample(hood.chaos, x, y);
      const cragness = sample(crag, x, y);

      // Base ground with large soft patches of the biome's secondary ground
      let tile: number = profile.ground;
      const patch = fbm(nGround, gx / 70, gy / 70, 4);
      if (patch > 0.22) tile = profile.patch;
      if (shore) tile = centreBiome === 11 || centreBiome === 10 ? TILE.ICE : centreBiome === 1 || centreBiome === 2 ? TILE.SAND : TILE.MARSH;

      // Biome signatures
      if (centreBiome === 11 && Math.abs(nDetail.noise2D(gx / 26, gy / 26)) < 0.035) tile = TILE.DEEP_WATER; // crevasses
      if (centreBiome === 12) {
        const pond = fbm(nWater, gx / 45 + 50, gy / 45, 3);
        if (pond > 0.42) tile = pond > 0.55 ? TILE.WATER : TILE.MARSH;
      }
      // Dune crests: long soft ridges (low-frequency warp) rather than speckle
      if (centreBiome === 1 && tile === TILE.SAND && Math.sin(gx / 23 + fbm(nDetail, gx / 120, gy / 120, 2) * 9) > 0.93) tile = TILE.DRY_GRASS;

      // Rock: outcrops grow with elevation and with crag cells nearby
      const rough = fbm(nRock, gx / 38, gy / 38, 4);
      const rockiness = Math.max(0, (elevation - 66) / 34) + cragness * 0.8;
      if (rockiness > 0) {
        if (rough > 0.62 - rockiness * 0.55) tile = TILE.ROCK;
        else if (rough > 0.48 - rockiness * 0.5) tile = profile.rock;
      }

      // Cover: clumped groves, denser where the regional cell is forest
      if (profile.cover !== null && tile !== TILE.ROCK && tile !== TILE.WATER && tile !== TILE.DEEP_WATER) {
        const density = Math.min(0.95, profile.coverDensity * (0.35 + cover * 1.1) * (0.6 + vegetation * 0.8));
        const grove = fbm(nCover, gx / 48, gy / 48, 4) + nDetail.noise2D(gx / 6, gy / 6) * 0.12;
        const threshold = 1 - density * 2;
        if (grove > threshold) tile = profile.cover;
        else if (grove > threshold - 0.09) tile = profile.shrub;
      } else if (profile.cover === null && tile === profile.ground && nDetail.noise2D(gx / 7, gy / 7) > 0.93) {
        tile = profile.shrub; // the odd lone bush, boulder or drift in open biomes
      }

      // Chaos veins only where the region's chaos is genuinely high (its chaos field averages ~0.5)
      if (chaos > 0.8 && Math.abs(nChaos.noise2D(gx / 40, gy / 40)) < (chaos - 0.8) * 0.12) tile = TILE.CHAOS;

      grid[i] = tile;
    }
  }

  // Roads and trails: from the centre towards each neighbouring cell that carries one.
  const isRoad = (t: number, inf: number) => t === 5 || t === 4 || inf === 2 || inf === 1 || inf === 64;
  const isTrail = (t: number, inf: number) => t === 6 || inf === 4;
  const centreRoad = isRoad(hood.terrain[1]![1]!, hood.infra[1]![1]!) || isTrail(hood.terrain[1]![1]!, hood.infra[1]![1]!);
  let hasRoad = false;
  const hub: [number, number] = [118 + ((cellId + rx * 3) % 21), 118 + ((cellId + ry * 5) % 21)];

  const lay = (tx: number, ty: number, width: number, tag: string) => {
    const roadNoise = new SimplexNoise(cellId * 13 + rx * 7 + ry * 11 + tag.length);
    const steps = 400;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const bx = hub[0] + (tx - hub[0]) * t, by = hub[1] + (ty - hub[1]) * t;
      // Meander that fades to zero at both ends so roads meet the hub and the map edge cleanly
      const fade = Math.sin(Math.PI * t);
      const len = Math.hypot(tx - hub[0], ty - hub[1]) || 1;
      const nx = -(ty - hub[1]) / len, ny = (tx - hub[0]) / len;
      const m = roadNoise.noise2D(t * 3, 0.5) * 14 * fade;
      const cx = Math.round(bx + nx * m), cy = Math.round(by + ny * m);
      const r = Math.floor(width / 2);
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const px = cx + dx, py = cy + dy;
        if (px < 0 || py < 0 || px >= SIZE || py >= SIZE) continue;
        const k = py * SIZE + px;
        const g = grid[k]!;
        grid[k] = g === TILE.WATER || g === TILE.DEEP_WATER || g === TILE.MARSH ? TILE.BRIDGE : TILE.DIRT;
      }
    }
    hasRoad = true;
  };

  if (centreRoad) {
    const exits: Array<[number, number, number, number]> = [[0, -1, hub[0], 0], [0, 1, hub[0], SIZE - 1], [-1, 0, 0, hub[1]], [1, 0, SIZE - 1, hub[1]]];
    let laid = 0;
    for (const [dx, dy, ex, ey] of exits) {
      const t = hood.terrain[dy + 1]![dx + 1]!, inf = hood.infra[dy + 1]![dx + 1]!;
      if (isRoad(t, inf)) { lay(ex, ey, 6, `r${dx}${dy}`); laid++; }
      else if (isTrail(t, inf)) { lay(ex, ey, 3, `t${dx}${dy}`); laid++; }
    }
    // Diagonal-only connections run to the corner
    if (laid < 2) {
      for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
        const t = hood.terrain[dy + 1]![dx + 1]!, inf = hood.infra[dy + 1]![dx + 1]!;
        if (isRoad(t, inf) || isTrail(t, inf)) {
          lay(dx < 0 ? 0 : SIZE - 1, dy < 0 ? 0 : SIZE - 1, isRoad(t, inf) ? 6 : 3, `d${dx}${dy}`);
          laid++;
        }
      }
    }
  }

  // An open, dry spot near the hub for whatever stands on this cell
  let openSpot: [number, number] = hub;
  const ok = (k: number) => {
    const g = grid[k]!;
    return g !== TILE.WATER && g !== TILE.DEEP_WATER && g !== TILE.ROCK && g !== TILE.MARSH && g !== TILE.CHAOS;
  };
  search: for (let r = 0; r < 100; r += 3) {
    for (let a = 0; a < 16; a++) {
      const px = Math.round(hub[0] + Math.cos(a * Math.PI / 8) * r), py = Math.round(hub[1] + Math.sin(a * Math.PI / 8) * r);
      if (px < 20 || py < 20 || px > SIZE - 21 || py > SIZE - 21) continue;
      if (ok(py * SIZE + px)) { openSpot = [px, py]; break search; }
    }
  }

  return { waterShare: waterCount / (SIZE * SIZE), hasRoad, openSpot };
}
