import { DAYS_PER_WEEK, isChaosPeak } from "../../canon/calendar.js";
import type { Db } from "../../deltas/types.js";

export interface TrophicCalendarContext {
  month?: number | undefined;
  monthName?: string | undefined;
  activeDragon?: string | undefined;
  activeDomain?: string | undefined;
  cruorbusPhase?: string | undefined;
  isShadowWeek?: boolean | undefined;
}

export interface EcologyCellRow {
  id: number;
  center_x: number;
  center_y: number;
  eco_plants: number;
  eco_prey: number;
  eco_predators: number;
  eco_apex: number;
  eco_blight: number;
  eco_max: number;
}

export interface EcologyBurgRow {
  burg_id: number;
  name: string;
  cell_id: number | null;
  pop_null: number;
  food: number;
  unrest: number;
  wealth: number;
}

export interface EcologyChaosZoneRow {
  id: number;
  cell_id: number;
  intensity: number;
  type: string;
}

export interface EcologyGroveRow {
  id: number;
  cell_id: number;
  seal_strength: number;
}

export interface EcologySnapshot {
  active: boolean;
  tick: number;
  season: string;
  loreDate: string;
  dragonDomain: string;
  dragonName: string;
  moonPhase: string;
  isPeakChaos: boolean;
  cells: EcologyCellRow[];
  burgs: EcologyBurgRow[];
  chaosZones: EcologyChaosZoneRow[];
  groves: EcologyGroveRow[];
}

export async function loadEcology(
  db: Db,
  tick: number,
  season: string,
  loreDate: string,
  calCtx?: TrophicCalendarContext
): Promise<EcologySnapshot> {
  const dragonDomain = calCtx?.activeDomain || "Flux";
  const dragonName = calCtx?.activeDragon || "Ulex";
  const moonPhase = calCtx?.cruorbusPhase || "The Halo";
  const isPeakChaos = isChaosPeak(moonPhase);

  if (tick % DAYS_PER_WEEK !== 0 && !isPeakChaos) {
    return {
      active: false,
      tick,
      season,
      loreDate,
      dragonDomain,
      dragonName,
      moonPhase,
      isPeakChaos,
      cells: [],
      burgs: [],
      chaosZones: [],
      groves: [],
    };
  }

  const cellsRes = await db.query(
    `SELECT id, COALESCE(center_x, 0)::float8 AS center_x, COALESCE(center_y, 0)::float8 AS center_y,
            COALESCE(eco_plants, 50.0)::float8 AS eco_plants,
            COALESCE(eco_prey, 50.0)::float8 AS eco_prey,
            COALESCE(eco_predators, 10.0)::float8 AS eco_predators,
            COALESCE(eco_apex, 5.0)::float8 AS eco_apex,
            COALESCE(eco_blight, 0.0)::float8 AS eco_blight,
            COALESCE(eco_max, 100.0)::float8 AS eco_max
     FROM sim_cells
     ORDER BY id ASC`
  );
  const burgsRes = await db.query(
    `SELECT burg_id, name, cell_id, COALESCE(pop_null, 0)::int AS pop_null,
            COALESCE(food, 0)::int AS food, COALESCE(unrest, 0)::int AS unrest, COALESCE(wealth, 0)::int AS wealth
     FROM sim_burg_economy
     ORDER BY burg_id ASC`
  );
  const zonesRes = await db.query(
    `SELECT id, cell_id, COALESCE(intensity, 0)::float8 AS intensity, type
     FROM sim_chaos_zones
     ORDER BY id ASC`
  );
  const grovesRes = await db.query(
    `SELECT id, cell_id, COALESCE(seal_strength, 100)::int AS seal_strength
     FROM sim_sacred_groves
     ORDER BY id ASC`
  );

  return {
    active: true,
    tick,
    season,
    loreDate,
    dragonDomain,
    dragonName,
    moonPhase,
    isPeakChaos,
    cells: cellsRes.rows.map((r: any) => ({
      id: Number(r.id),
      center_x: Number(r.center_x),
      center_y: Number(r.center_y),
      eco_plants: Number(r.eco_plants),
      eco_prey: Number(r.eco_prey),
      eco_predators: Number(r.eco_predators),
      eco_apex: Number(r.eco_apex),
      eco_blight: Number(r.eco_blight),
      eco_max: Number(r.eco_max),
    })),
    burgs: burgsRes.rows.map((r: any) => ({
      burg_id: Number(r.burg_id),
      name: String(r.name || `Burg #${r.burg_id}`),
      cell_id: r.cell_id !== null && r.cell_id !== undefined ? Number(r.cell_id) : null,
      pop_null: Number(r.pop_null),
      food: Number(r.food),
      unrest: Number(r.unrest),
      wealth: Number(r.wealth),
    })),
    chaosZones: zonesRes.rows.map((r: any) => ({
      id: Number(r.id),
      cell_id: Number(r.cell_id),
      intensity: Number(r.intensity),
      type: String(r.type || ""),
    })),
    groves: grovesRes.rows.map((r: any) => ({
      id: Number(r.id),
      cell_id: Number(r.cell_id),
      seal_strength: Number(r.seal_strength),
    })),
  };
}
