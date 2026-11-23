/**
 * parseAzgaarMap.ts
 * ─────────────────────────────────────────────────────────────────────────
 * Pure TypeScript parser for Azgaar Fantasy Map Generator `.map` save files
 * (tested on `Ostraka_full.map`, Azgaar v1.158.0, 6125 x 2496).
 *
 * Strictly read-only: reads from Shatterlands/Ostraka_full.map (Rule 3) and
 * reconstructs the exact 58,091-cell `pack` Voronoi graph using Azgaar's
 * `reGraph()` rules with zero cell drift.
 */

import fs from "fs";
import path from "path";

// d3-delaunay ships ESM-only types/exports depending on TS moduleResolution; load via require safely
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Delaunay } = require("d3-delaunay") as {
  Delaunay: {
    from(points: ArrayLike<[number, number]>): {
      neighbors(i: number): Iterable<number>;
      voronoi(bounds: [number, number, number, number]): {
        cellPolygon(i: number): Array<[number, number]> | null;
      };
    };
  };
};

export const OSTRAKA_MAP_CANDIDATES = [
  process.env.OSTRAKA_MAP_PATH || "",
  "C:/Users/krazy/Desktop/Shatterlands/Ostraka_full.map",
  path.resolve(__dirname, "../../data/Ostraka_full.map"),
  path.resolve(process.cwd(), "simulation-engine/data/Ostraka_full.map"),
].filter(Boolean);

export interface ParsedPackCell {
  i: number;
  p: [number, number];
  biome: number;
  burg: number;
  conf: number;
  culture: number;
  flux: number;
  pop: number;
  river: number;
  suitability: number;
  state: number;
  religion: number;
  market: number;
  elevation: number;
  baseTemp: number;
  featureId: number;
  cellType: number;
  geometry: string | null;
}

export interface ParsedAzgaarMap {
  mapPath: string;
  version: string;
  date: string;
  seed: string;
  width: number;
  height: number;
  biomes: any[];
  goods: any[];
  militaryConfig: any;
  features: any[];
  cultures: any[];
  states: any[];
  burgs: any[];
  religions: any[];
  rivers: any[];
  markers: any[];
  routes: any[];
  routeGraph: Record<string, Record<string, number>>;
  markets: any[];
  deals: any[];
  cells: ParsedPackCell[];
}

export function resolveOstrakaMapPath(): string {
  const found = OSTRAKA_MAP_CANDIDATES.find((p) => fs.existsSync(p));
  if (!found) {
    throw new Error(
      `Ostraka_full.map not found in candidates: ${OSTRAKA_MAP_CANDIDATES.join(", ")}`
    );
  }
  return found;
}

function parseCsvNumbers(line: string | undefined): number[] {
  if (!line || !line.trim()) return [];
  return line.split(",").map((v) => Number(v));
}

export function parseAzgaarMap(explicitPath?: string): ParsedAzgaarMap {
  const mapPath = explicitPath || resolveOstrakaMapPath();
  const lines = fs.readFileSync(mapPath, "utf8").split(/\r?\n/);
  const header = (lines[0] || "").split("|");
  const version = header[0] || "1.158.0";
  const date = header[2] || "";
  const seed = header[3] || "0";
  const width = Number(header[4]) || 6125;
  const height = Number(header[5]) || 2496;

  const settings = JSON.parse(lines[1] || "{}");
  const biomes: any[] = JSON.parse(lines[3] || "[]");

  const svgEnd = lines.findIndex((l, idx) => idx > 5 && l.includes("</svg>"));
  if (svgEnd < 0) {
    throw new Error(`Invalid .map file (missing </svg>): ${mapPath}`);
  }

  const at = (offset: number): string => lines[svgEnd + offset] || "";

  const gridMeta = JSON.parse(at(1));
  const gridHeights = parseCsvNumbers(at(2));
  const gridFeatures = parseCsvNumbers(at(4));
  const gridT = parseCsvNumbers(at(5));
  const gridTemps = parseCsvNumbers(at(6));

  const features: any[] = JSON.parse(at(7) || "[]");
  const rawCultures: any[] = JSON.parse(at(8) || "[]");
  const rawStates: any[] = JSON.parse(at(9) || "[]");
  const rawBurgs: any[] = JSON.parse(at(10) || "[]");

  const packBiomes = parseCsvNumbers(at(11));
  const packBurgs = parseCsvNumbers(at(12));
  const packConf = parseCsvNumbers(at(13));
  const packCultures = parseCsvNumbers(at(14));
  const packFlux = parseCsvNumbers(at(15));
  const packPop = parseCsvNumbers(at(16));
  const packRivers = parseCsvNumbers(at(17));
  const packSuitability = parseCsvNumbers(at(19));
  const packStates = parseCsvNumbers(at(20));
  const packReligions = parseCsvNumbers(at(21));

  const rawReligions: any[] = JSON.parse(at(24) || "[]");
  const rivers: any[] = JSON.parse(at(27) || "[]");
  const markers: any[] = JSON.parse(at(30) || "[]");
  const routeGraph: Record<string, Record<string, number>> = JSON.parse(at(31) || "{}");
  const routes: any[] = JSON.parse(at(32) || "[]");
  const markets: any[] = JSON.parse(at(37) || "[]");
  const deals: any[] = JSON.parse(at(38) || "[]");
  const packMarkets = parseCsvNumbers(at(39));

  // Reconstruct the exact `pack` points using Azgaar's reGraph() algorithm
  const gridPoints: [number, number][] = gridMeta.points || [];
  const boundary: [number, number][] = gridMeta.boundary || [];
  const spacing = Number(gridMeta.spacing) || 14.78;
  const sp2 = spacing * spacing;
  const n = gridPoints.length;
  const del = Delaunay.from(gridPoints.concat(boundary));
  const rn1 = (v: number) => Math.round(v * 10) / 10;

  const packPoints: [number, number][] = [];
  const packGridIdx: number[] = [];

  for (let i = 0; i < n; i++) {
    const h = gridHeights[i] ?? 0;
    const t = gridT[i] ?? 0;
    const isLake = features[gridFeatures[i] ?? 0]?.type === "lake";
    if (h < 20 && t !== -1 && t !== -2) continue;
    if (t === -2 && (i % 4 === 0 || isLake)) continue;

    const pt = gridPoints[i]!;
    packPoints.push([pt[0], pt[1]]);
    packGridIdx.push(i);

    if (t === 1 || t === -1) {
      const nbs = Array.from(del.neighbors(i));
      if (nbs.some((e) => e >= n)) continue;
      for (const e of nbs) {
        if (e > i && gridT[e] === t) {
          const pt2 = gridPoints[e]!;
          const d2 = (pt[1] - pt2[1]) ** 2 + (pt[0] - pt2[0]) ** 2;
          if (d2 < sp2) continue;
          packPoints.push([rn1((pt[0] + pt2[0]) / 2), rn1((pt[1] + pt2[1]) / 2)]);
          packGridIdx.push(i);
        }
      }
    }
  }

  if (packPoints.length !== packBiomes.length) {
    throw new Error(
      `Azgaar reGraph count mismatch on ${mapPath}: reconstructed ${packPoints.length} pack points vs ${packBiomes.length} pack CSV entries`
    );
  }

  // Build clipped Voronoi polygons for every pack cell
  const voronoi = Delaunay.from(packPoints).voronoi([0, 0, width, height]);
  const cells: ParsedPackCell[] = new Array(packPoints.length);

  for (let i = 0; i < packPoints.length; i++) {
    const gIdx = packGridIdx[i]!;
    const p = packPoints[i]!;
    const poly = voronoi.cellPolygon(i);
    let geometry: string | null = null;
    if (poly && poly.length >= 4) {
      const ring = poly.map(([vx, vy]) => [rn1(vx), rn1(vy)]);
      const first = ring[0]!;
      const last = ring[ring.length - 1]!;
      if (first[0] !== last[0] || first[1] !== last[1]) {
        ring.push([first[0]!, first[1]!]);
      }
      geometry = JSON.stringify({ type: "Polygon", coordinates: [ring] });
    }

    cells[i] = {
      i,
      p,
      biome: packBiomes[i] ?? 0,
      burg: packBurgs[i] ?? 0,
      conf: packConf[i] ?? 0,
      culture: packCultures[i] ?? 0,
      flux: Math.round(packFlux[i] ?? 0),
      pop: Number(packPop[i] ?? 0),
      river: packRivers[i] ?? 0,
      suitability: packSuitability[i] ?? 0,
      state: packStates[i] ?? 0,
      religion: packReligions[i] ?? 0,
      market: packMarkets[i] ?? 0,
      elevation: gridHeights[gIdx] ?? 0,
      baseTemp: gridTemps[gIdx] ?? 15,
      featureId: gridFeatures[gIdx] ?? 0,
      cellType: gridT[gIdx] ?? 0,
      geometry,
    };
  }

  return {
    mapPath,
    version,
    date,
    seed,
    width,
    height,
    biomes,
    goods: Array.isArray(settings.goods) ? settings.goods : [],
    militaryConfig: settings.military || {},
    features: features.filter((f) => f && typeof f === "object" && !f.removed),
    cultures: rawCultures.filter((c) => c && typeof c === "object" && c.name && !c.removed),
    states: rawStates.filter((s) => s && typeof s === "object" && s.name && !s.removed),
    burgs: rawBurgs.filter((b) => b && typeof b === "object" && b.name && !b.removed),
    religions: rawReligions.filter((r) => r && typeof r === "object" && r.name && !r.removed),
    rivers: rivers.filter((r) => r && typeof r === "object" && !r.removed),
    markers: markers.filter((m) => m && typeof m === "object" && !m.removed),
    routes: routes.filter((r) => r && typeof r === "object" && !r.removed),
    routeGraph,
    markets: markets.filter((m) => m && typeof m === "object"),
    deals: Array.isArray(deals) ? deals : [],
    cells,
  };
}
