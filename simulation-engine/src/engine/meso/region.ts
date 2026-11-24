/**
 * Regional ring generation, deterministic border stitching, persistence, and multi-focus caps (Phase 10 & 13.3).
 */
import type { Db } from "../deltas/types.js";
import { RegionalInstance } from "../../regional/RegionalInstance.js";
import { focusArea } from "../lod/focus.js";
import { unfocusArea } from "../lod/demote.js";
import { loadMesoAgents } from "./agents.js";
import type { MesoAgent } from "./mesoStep.js";

export const MAX_ACTIVE_REGIONS = 3;
export const MAX_CELLS_PER_REGION = 7;
export const MESO_VERSION = 1;

export interface StitchableRegionCell {
  cellId: number;
  centerX: number;
  centerY: number;
  mapData: Uint8Array;
  infraMap: Uint8Array;
  neighbors?: Partial<Record<"N" | "S" | "E" | "W", number>> | undefined;
}

export interface StitchedBorderPair {
  cellA: number;
  sideA: "N" | "S" | "E" | "W";
  cellB: number;
  sideB: "N" | "S" | "E" | "W";
  kind: "road" | "river";
  coord: number;
}

/**
 * Pure border stitcher aligning road (2) and river (3) crossings at facing edges of adjacent cells.
 */
export function stitchRegionBorders(cells: StitchableRegionCell[]): StitchedBorderPair[] {
  const pairs: StitchedBorderPair[] = [];
  if (cells.length < 2) return pairs;

  const findEdgeFeature = (cell: StitchableRegionCell, side: "N" | "S" | "E" | "W", code: number): number | null => {
    for (let i = 10; i <= 90; i++) {
      const idx =
        side === "E"
          ? i * 100 + 99
          : side === "W"
            ? i * 100 + 0
            : side === "S"
              ? 99 * 100 + i
              : 0 * 100 + i;
      if (cell.mapData[idx] === code || (code === 2 && (cell.infraMap[idx] ?? 0) > 0)) {
        return i;
      }
    }
    return null;
  };

  const paintEdgeCrossing = (cell: StitchableRegionCell, side: "N" | "S" | "E" | "W", pos: number, code: number) => {
    for (let d = 0; d < 4; d++) {
      const x = side === "E" ? 99 - d : side === "W" ? d : pos;
      const y = side === "S" ? 99 - d : side === "N" ? d : pos;
      const idx = Math.max(0, Math.min(9999, y * 100 + x));
      cell.mapData[idx] = code;
      if (code === 2) cell.infraMap[idx] = 1;
    }
  };

  for (let i = 0; i < cells.length; i++) {
    const a = cells[i]!;
    if (!a.neighbors) a.neighbors = {};
    for (let j = i + 1; j < cells.length; j++) {
      const b = cells[j]!;
      if (!b.neighbors) b.neighbors = {};

      const dx = b.centerX - a.centerX;
      const dy = b.centerY - a.centerY;
      const dist = Math.hypot(dx, dy);
      if (dist <= 0 || dist > 65) continue;

      let sideA: "N" | "S" | "E" | "W";
      let sideB: "N" | "S" | "E" | "W";
      if (Math.abs(dx) >= Math.abs(dy)) {
        sideA = dx >= 0 ? "E" : "W";
        sideB = dx >= 0 ? "W" : "E";
      } else {
        sideA = dy >= 0 ? "S" : "N";
        sideB = dy >= 0 ? "N" : "S";
      }
      if (!a.neighbors[sideA]) a.neighbors[sideA] = b.cellId;
      if (!b.neighbors[sideB]) b.neighbors[sideB] = a.cellId;

      for (const [code, kind] of [
        [2, "road"],
        [3, "river"],
      ] as const) {
        const cA = findEdgeFeature(a, sideA, code);
        const cB = findEdgeFeature(b, sideB, code);
        if (cA !== null || cB !== null) {
          const joined = cA !== null && cB !== null ? Math.round((cA + cB) / 2) : (cA ?? cB ?? 50);
          paintEdgeCrossing(a, sideA, joined, code);
          paintEdgeCrossing(b, sideB, joined, code);
          pairs.push({ cellA: a.cellId, sideA, cellB: b.cellId, sideB, kind, coord: joined });
        }
      }
    }
  }
  return pairs;
}

export interface BuiltRegion {
  focusCellId: number;
  seed: string;
  version: number;
  cellIds: number[];
  cells: Array<StitchableRegionCell & { instance: RegionalInstance }>;
  stitchedPairs: StitchedBorderPair[];
}

export async function buildRegion(
  db: Db,
  focusCellId: number,
  opts: { seed?: string | undefined; maxCells?: number | undefined; entityAgents?: MesoAgent[] | undefined } = {}
): Promise<BuiltRegion> {
  const seed = opts.seed || process.env.SIM_SEED || "ostraka";
  const maxCells = Math.max(1, Math.min(MAX_CELLS_PER_REGION, opts.maxCells ?? MAX_CELLS_PER_REGION));

  const centerRes = await db.query(
    `SELECT c.*, f.name AS faction_name
     FROM sim_cells c
     LEFT JOIN sim_factions f ON f.id = c.faction_id
     WHERE c.id = $1
     LIMIT 1`,
    [focusCellId]
  );
  if (centerRes.rows.length === 0) {
    throw new Error(`[MesoRegion] Focus cell #${focusCellId} not found in sim_cells.`);
  }
  const c0 = centerRes.rows[0];
  const cx0 = Number(c0.center_x || 0);
  const cy0 = Number(c0.center_y || 0);

  const ringRes = await db.query(
    `SELECT c.*, f.name AS faction_name,
            ((COALESCE(c.center_x, 0) - $2)^2 + (COALESCE(c.center_y, 0) - $3)^2) AS dist2
     FROM sim_cells c
     LEFT JOIN sim_factions f ON f.id = c.faction_id
     WHERE c.id = $1
        OR (c.center_x BETWEEN $2 - 65 AND $2 + 65 AND c.center_y BETWEEN $3 - 65 AND $3 + 65)
     ORDER BY (c.id = $1) DESC, dist2 ASC, c.id ASC
     LIMIT $4`,
    [focusCellId, cx0, cy0, maxCells]
  );

  const cellIds = ringRes.rows.map((r: any) => Number(r.id));
  const burgsRes = await db.query(
    `SELECT * FROM sim_burg_economy WHERE cell_id = ANY($1::int[]) ORDER BY burg_id ASC`,
    [cellIds]
  );
  const burgByCell = new Map<number, any>();
  for (const b of burgsRes.rows) burgByCell.set(Number(b.cell_id), b);

  const builtCells: Array<StitchableRegionCell & { instance: RegionalInstance }> = [];

  for (const row of ringRes.rows) {
    const cid = Number(row.id);
    const cx = Number(row.center_x || 0);
    const cy = Number(row.center_y || 0);
    const neighbors = ringRes.rows
      .filter((n: any) => Number(n.id) !== cid)
      .map((n: any) => ({
        id: Number(n.id),
        biome: Number(n.biome || 4),
        elevation: Number(n.elevation || 50),
        center_x: Number(n.center_x || 0),
        center_y: Number(n.center_y || 0),
        angle: Math.atan2(Number(n.center_y || 0) - cy, Number(n.center_x || 0) - cx),
      }));

    const mappedAgents = (opts.entityAgents || [])
      .filter((a) => a.cellId === cid)
      .map((a, idx) => ({
        id: idx + 1,
        type: a.kind === "convoy" ? "Merchant" : a.role,
        speciesName: a.name,
        category: a.kind,
        color: "#38bdf8",
        speed: a.speed,
        disposition: 0,
        rx: a.rx,
        ry: a.ry,
        targetRx: a.targetRx,
        targetRy: a.targetRy,
        x: a.rx,
        y: a.ry,
        tx: a.targetRx,
        ty: a.targetRy,
      }));

    const instance = new RegionalInstance(cid, {
      cellId: cid,
      seed,
      version: MESO_VERSION,
      terrain: row,
      burg: burgByCell.get(cid) || null,
      features: row.cell_features || {},
      factionName: row.faction_name || "Wild Frontier",
      neighbors,
      entityAgents: mappedAgents,
    });

    builtCells.push({
      cellId: cid,
      centerX: cx,
      centerY: cy,
      mapData: instance.mapData,
      infraMap: instance.infraMap,
      neighbors: {},
      instance,
    });
  }

  const stitchedPairs = stitchRegionBorders(builtCells);
  return {
    focusCellId,
    seed,
    version: MESO_VERSION,
    cellIds,
    cells: builtCells,
    stitchedPairs,
  };
}

export interface FocusedRegionRecord {
  focus_cell_id: number;
  cell_ids: number[];
  seed: string;
  version: number;
  focused_tick: number;
  last_meso_tick: number;
  metadata: Record<string, any>;
}

export async function listFocusedRegions(db: Db): Promise<FocusedRegionRecord[]> {
  const readyRes = await db.query(`SELECT to_regclass('focused_regions') IS NOT NULL AS ready`);
  if (!readyRes.rows[0]?.ready) return [];
  const res = await db.query(
    `SELECT focus_cell_id, cell_ids, seed, version, focused_tick, last_meso_tick, metadata
     FROM focused_regions
     ORDER BY focused_tick ASC, focus_cell_id ASC`
  );
  return res.rows.map((r: any) => ({
    focus_cell_id: Number(r.focus_cell_id),
    cell_ids: Array.isArray(r.cell_ids) ? r.cell_ids.map(Number) : [],
    seed: String(r.seed || "ostraka"),
    version: Number(r.version || MESO_VERSION),
    focused_tick: Number(r.focused_tick || 0),
    last_meso_tick: Number(r.last_meso_tick || 0),
    metadata: r.metadata && typeof r.metadata === "object" ? r.metadata : {},
  }));
}

export async function getFocusedCellIds(db: Db): Promise<Set<number>> {
  const res = await db.query(
    `SELECT DISTINCT unnest(cell_ids)::int AS cid FROM focused_regions`
  ).catch(() => ({ rows: [] as any[] }));
  const set = new Set<number>();
  for (const r of res.rows) {
    const cid = Number(r.cid);
    if (Number.isFinite(cid) && cid > 0) set.add(cid);
  }
  return set;
}

export async function focusRegion(
  db: Db,
  focusCellId: number,
  opts: { tick?: number | undefined; seed?: string | undefined; maxCells?: number | undefined } = {}
): Promise<{
  record: FocusedRegionRecord;
  region: BuiltRegion;
  agentsCount: number;
}> {
  const active = await listFocusedRegions(db);
  const existing = active.find((r) => r.focus_cell_id === focusCellId);
  if (!existing && active.length >= MAX_ACTIVE_REGIONS) {
    throw new Error(`[MesoRegion] Max active focused regions (${MAX_ACTIVE_REGIONS}) reached.`);
  }

  let tick = opts.tick;
  if (tick === undefined) {
    const calRes = await db.query(`SELECT COALESCE(MAX(tick), 0)::int AS t FROM sim_calendar`);
    tick = Number(calRes.rows[0]?.t || 0);
  }

  const prelim = await buildRegion(db, focusCellId, { seed: opts.seed, maxCells: opts.maxCells });
  const burgRes = await db.query(
    `SELECT burg_id FROM sim_burg_economy WHERE cell_id = $1 ORDER BY burg_id ASC LIMIT 1`,
    [focusCellId]
  );
  const focusBurgId = burgRes.rows[0]?.burg_id !== undefined ? Number(burgRes.rows[0].burg_id) : undefined;

  await focusArea(db, {
    cellIds: prelim.cellIds,
    burgId: focusBurgId,
    lod: "meso",
    desiredFaces: focusBurgId ? 2 : 0,
    tick,
  });

  const agents = await loadMesoAgents(db, prelim.cellIds, tick);

  await db.query(
    `INSERT INTO focused_regions (focus_cell_id, cell_ids, seed, version, focused_tick, last_meso_tick, metadata)
     VALUES ($1, $2::int[], $3, $4, $5, $5, $6::jsonb)
     ON CONFLICT (focus_cell_id) DO UPDATE SET
       cell_ids = EXCLUDED.cell_ids,
       seed = EXCLUDED.seed,
       version = EXCLUDED.version,
       metadata = EXCLUDED.metadata`,
    [
      focusCellId,
      prelim.cellIds,
      prelim.seed,
      prelim.version,
      tick,
      JSON.stringify({ stitchedPairCount: prelim.stitchedPairs.length, agentCount: agents.length }),
    ]
  );

  const region = await buildRegion(db, focusCellId, {
    seed: prelim.seed,
    maxCells: opts.maxCells,
    entityAgents: agents,
  });

  return {
    record: {
      focus_cell_id: focusCellId,
      cell_ids: prelim.cellIds,
      seed: prelim.seed,
      version: prelim.version,
      focused_tick: tick,
      last_meso_tick: tick,
      metadata: { stitchedPairCount: region.stitchedPairs.length, agentCount: agents.length },
    },
    region,
    agentsCount: agents.length,
  };
}

export async function unfocusRegion(
  db: Db,
  focusCellId: number,
  tick?: number | undefined
): Promise<{
  unfocused: boolean;
  demotedCount: number;
  keptRefs: string[];
}> {
  const existingRes = await db.query(
    `SELECT cell_ids, focused_tick FROM focused_regions WHERE focus_cell_id = $1 LIMIT 1`,
    [focusCellId]
  );
  if (existingRes.rows.length === 0) {
    return { unfocused: false, demotedCount: 0, keptRefs: [] };
  }
  const row = existingRes.rows[0];
  const cellIds: number[] = Array.isArray(row.cell_ids) ? row.cell_ids.map(Number) : [focusCellId];

  // Do not demote cells still owned by another concurrently focused region
  const otherRes = await db.query(
    `SELECT COALESCE(array_agg(DISTINCT cid), '{}'::int[]) AS kept
     FROM focused_regions, unnest(cell_ids) AS cid
     WHERE focus_cell_id <> $1`,
    [focusCellId]
  );
  const shared = new Set<number>(Array.isArray(otherRes.rows[0]?.kept) ? otherRes.rows[0].kept.map(Number) : []);
  const releaseCells = cellIds.filter((c) => !shared.has(c));

  await db.query(`DELETE FROM focused_regions WHERE focus_cell_id = $1`, [focusCellId]);

  if (releaseCells.length === 0) {
    return { unfocused: true, demotedCount: 0, keptRefs: [] };
  }
  const out = await unfocusArea(db, {
    cellIds: releaseCells,
    sinceTick: Number(row.focused_tick || 0),
  });
  return {
    unfocused: true,
    demotedCount: out.demotedCount,
    keptRefs: out.keptRefs,
  };
}

export async function rebuildFocusedRegions(db: Db): Promise<BuiltRegion[]> {
  const records = await listFocusedRegions(db);
  const rebuilt: BuiltRegion[] = [];
  for (const rec of records) {
    const agents = await loadMesoAgents(db, rec.cell_ids, rec.last_meso_tick || rec.focused_tick);
    const r = await buildRegion(db, rec.focus_cell_id, {
      seed: rec.seed,
      maxCells: rec.cell_ids.length,
      entityAgents: agents,
    });
    rebuilt.push(r);
  }
  return rebuilt;
}
