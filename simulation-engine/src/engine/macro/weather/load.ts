import { seasonByName, moonPhaseFor, MERCY_ALIGNMENT, NIGHTMARE_ALIGNMENT } from "../../canon/calendar.js";
import type { Db } from "../../deltas/types.js";

export interface MapBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface WeatherFrontRow {
  id: number;
  type: string;
  x: number;
  y: number;
  dx: number;
  dy: number;
  radius: number;
  lifetime: number;
}

export interface WeatherBurgRow {
  burg_id: number;
  name: string;
  cell_id: number | null;
  food: number;
  unrest: number;
  health: number;
  pop_null: number;
  pop_attuned: number;
  architecture_type: string;
  center_x: number;
  center_y: number;
  river_id: number;
  cell_flux: number;
  current_temp: number;
  river_discharge: number;
  river_width: number;
  river_name: string | null;
}

export interface WeatherGroveRow {
  id: number;
  cell_id: number;
  seal_strength: number;
}

export interface WeatherDamagedCell {
  id: number;
  eco_health: number;
  eco_max: number;
}

export interface WeatherClimateCell {
  id: number;
  center_x: number;
  center_y: number;
  elevation: number;
  current_temp: number | null;
}

export interface WeatherSnapshot {
  tick: number;
  season: string;
  dayOfMonth: number;
  loreDate: string;
  isShadowWeek: boolean;
  phase: string;
  bounds: MapBounds;
  fronts: WeatherFrontRow[];
  burgs: WeatherBurgRow[];
  bleedGroves: WeatherGroveRow[];
  damagedCells: WeatherDamagedCell[];
  climateCells: WeatherClimateCell[];
}

let cachedMapBounds: MapBounds | null = null;

export function getCruorbusPhase(season: string, dayOfMonth: number, isShadowWeek?: boolean): string {
  if (isShadowWeek) return "SHADOW_WEEK";
  const s = seasonByName(season);
  if (!s) return "HALO";
  const phase = moonPhaseFor(s, dayOfMonth);
  if (phase === NIGHTMARE_ALIGNMENT) return "NIGHTMARE";
  if (phase === MERCY_ALIGNMENT) return "MERCY";
  if (phase === "The Open Eye") return "BLEED";
  if (phase === "The Leering") return "CHAOS_FLOW";
  if (phase === "The Receding") return "VOID_DRAIN";
  return "HALO";
}

export function frontToMapCircle(
  front: { x: number; y: number; radius: number },
  bounds: MapBounds
): { fx: number; fy: number; radiusMap: number } {
  const width = Math.max(1, bounds.maxX - bounds.minX);
  const height = Math.max(1, bounds.maxY - bounds.minY);
  const fx = bounds.minX + (Number(front.x) / 100) * width;
  const fy = bounds.minY + (Number(front.y) / 100) * height;
  const radiusMap = Math.max(1, (Number(front.radius) / 100) * Math.min(width, height));
  return { fx, fy, radiusMap };
}

async function getMapBounds(db: Db): Promise<MapBounds> {
  if (cachedMapBounds) return cachedMapBounds;
  const res = await db.query(
    `SELECT COALESCE(MIN(center_x), 0) AS min_x,
            COALESCE(MAX(center_x), 6120) AS max_x,
            COALESCE(MIN(center_y), 0) AS min_y,
            COALESCE(MAX(center_y), 2496) AS max_y
     FROM sim_cells`
  );
  const row = res.rows[0] || {};
  const minX = Number(row.min_x) || 0;
  const maxX = Math.max(minX + 1, Number(row.max_x) || 6120);
  const minY = Number(row.min_y) || 0;
  const maxY = Math.max(minY + 1, Number(row.max_y) || 2496);
  cachedMapBounds = { minX, maxX, minY, maxY };
  return cachedMapBounds;
}

export async function loadWeather(
  db: Db,
  tick: number,
  season: string,
  dayOfMonth: number,
  loreDate: string,
  isShadowWeek?: boolean
): Promise<WeatherSnapshot> {
  const phase = getCruorbusPhase(season, dayOfMonth, isShadowWeek);
  const bounds = await getMapBounds(db);

  const frontsRes = await db.query(
    `SELECT id, type, x, y, dx, dy, radius, lifetime FROM sim_weather_fronts ORDER BY id ASC`
  );
  const fronts: WeatherFrontRow[] = frontsRes.rows.map((r: any) => ({
    id: Number(r.id),
    type: String(r.type || "STORM"),
    x: Number(r.x || 0),
    y: Number(r.y || 0),
    dx: Number(r.dx || 0),
    dy: Number(r.dy || 0),
    radius: Number(r.radius || 15),
    lifetime: Number(r.lifetime || 0),
  }));

  const burgsRes = await db.query(
    `SELECT b.burg_id, b.name, b.cell_id, b.food, b.unrest, b.health,
            COALESCE(b.pop_null, 0)::int AS pop_null,
            COALESCE(b.pop_attuned, 0)::int AS pop_attuned,
            b.architecture_type,
            COALESCE(c.center_x, 0)::float8 AS center_x,
            COALESCE(c.center_y, 0)::float8 AS center_y,
            COALESCE(c.river_id, 0)::int AS river_id,
            COALESCE(c.flux, 0)::int AS cell_flux,
            COALESCE(c.current_temp, c.base_temp, 15)::real AS current_temp,
            COALESCE(r.discharge, 0)::real AS river_discharge,
            COALESCE(r.width, 0)::real AS river_width,
            r.name AS river_name
     FROM sim_burg_economy b
     LEFT JOIN sim_cells c ON b.cell_id = c.id
     LEFT JOIN sim_rivers r ON r.id = c.river_id
     ORDER BY b.burg_id ASC`
  );
  const burgs: WeatherBurgRow[] = burgsRes.rows.map((r: any) => ({
    burg_id: Number(r.burg_id),
    name: String(r.name || `Burg #${r.burg_id}`),
    cell_id: r.cell_id !== null && r.cell_id !== undefined ? Number(r.cell_id) : null,
    food: Number(r.food || 0),
    unrest: Number(r.unrest || 0),
    health: Number(r.health || 90),
    pop_null: Number(r.pop_null || 0),
    pop_attuned: Number(r.pop_attuned || 0),
    architecture_type: String(r.architecture_type || "WOOD"),
    center_x: Number(r.center_x || 0),
    center_y: Number(r.center_y || 0),
    river_id: Number(r.river_id || 0),
    cell_flux: Number(r.cell_flux || 0),
    current_temp: Number(r.current_temp ?? 15),
    river_discharge: Number(r.river_discharge || 0),
    river_width: Number(r.river_width || 0),
    river_name: r.river_name ? String(r.river_name) : null,
  }));

  let bleedGroves: WeatherGroveRow[] = [];
  if (phase === "BLEED") {
    const gRes = await db.query(
      `SELECT id, cell_id, seal_strength FROM sim_sacred_groves WHERE seal_strength < 40 ORDER BY id ASC`
    );
    bleedGroves = gRes.rows.map((g: any) => ({
      id: Number(g.id),
      cell_id: Number(g.cell_id),
      seal_strength: Number(g.seal_strength || 0),
    }));
  }

  let damagedCells: WeatherDamagedCell[] = [];
  if (phase === "MERCY" || (phase === "VOID_DRAIN" && dayOfMonth % 12 === 5)) {
    const dRes = await db.query(
      `SELECT id, COALESCE(eco_health, 100)::float8 AS eco_health, COALESCE(eco_max, 100)::float8 AS eco_max
       FROM sim_cells
       WHERE COALESCE(eco_health, 100) < COALESCE(eco_max, 100)
       ORDER BY id ASC`
    );
    damagedCells = dRes.rows.map((c: any) => ({
      id: Number(c.id),
      eco_health: Number(c.eco_health),
      eco_max: Number(c.eco_max),
    }));
  }

  let climateCells: WeatherClimateCell[] = [];
  if (tick % 5 === 0) {
    const cRes = await db.query(
      `SELECT id, center_x, center_y, COALESCE(elevation, 50) AS elevation, current_temp
       FROM sim_cells
       ORDER BY id ASC`
    );
    climateCells = cRes.rows.map((c: any) => ({
      id: Number(c.id),
      center_x: Number(c.center_x || 0),
      center_y: Number(c.center_y || 0),
      elevation: Number(c.elevation ?? 50),
      current_temp: c.current_temp !== null && c.current_temp !== undefined ? Number(c.current_temp) : null,
    }));
  }

  return {
    tick,
    season,
    dayOfMonth,
    loreDate,
    isShadowWeek: Boolean(isShadowWeek),
    phase,
    bounds,
    fronts,
    burgs,
    bleedGroves,
    damagedCells,
    climateCells,
  };
}
