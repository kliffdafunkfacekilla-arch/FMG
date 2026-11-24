import type { CreateThreadInput } from "../threads/threadEngine.js";
import type { EntityKind, EntityLod } from "../entities/refs.js";

export interface Db {
  query: (text: string, params?: any[]) => Promise<any>;
}

export interface BurgSetFields {
  food?: number | undefined;
  wealth?: number | undefined;
  unrest?: number | undefined;
  health?: number | undefined;
  crime_rate?: number | undefined;
  raw_materials?: number | undefined;
  pop_null?: number | undefined;
  pop_attuned?: number | undefined;
  urban_tier?: number | undefined;
  occupier_faction_id?: number | null | undefined;
  name?: string | undefined;
}

export interface CellSetFields {
  current_temp?: number | undefined;
  eco_plants?: number | undefined;
  eco_prey?: number | undefined;
  eco_predators?: number | undefined;
  eco_apex?: number | undefined;
  eco_blight?: number | undefined;
  eco_health?: number | undefined;
  eco_max?: number | undefined;
  culture_id?: number | undefined;
  religion_id?: number | undefined;
}

export interface AgentUpdateFields {
  location_cell_id?: number | undefined;
  target_cell_id?: number | null | undefined;
  state?: string | undefined;
  corruption?: number | undefined;
  drained_power?: number | undefined;
  active_plot?: string | null | undefined;
  age_ticks?: number | undefined;
}

export type TagTarget =
  | { kind: "cell"; cellId: number; zLayer?: number | undefined }
  | { kind: "citizen"; citizenId: number; temper?: string | undefined; motivation?: string | undefined };

export interface ClockTimeSpec {
  tick: number;
  minute?: number | undefined;
}

export interface ScheduledEventSpec {
  kind: string;
  payload: Record<string, any>;
}

export type Delta =
  | {
      kind: "burg.adjust";
      burgId: number;
      food?: number | undefined;
      wealth?: number | undefined;
      unrest?: number | undefined;
      health?: number | undefined;
      crime?: number | undefined;
      rawMaterials?: number | undefined;
      popNull?: number | undefined;
      popAttuned?: number | undefined;
    }
  | {
      kind: "burg.set";
      burgId: number;
      fields: Partial<BurgSetFields>;
    }
  | {
      kind: "cell.adjust";
      cellId: number;
      ecoHealth?: number | undefined;
      ecoMax?: number | undefined;
      ecoPlants?: number | undefined;
      ecoPrey?: number | undefined;
      ecoPredators?: number | undefined;
      ecoApex?: number | undefined;
      ecoBlight?: number | undefined;
      currentTemp?: number | undefined;
    }
  | {
      kind: "cell.set";
      cellId: number;
      fields: Partial<CellSetFields>;
    }
  | {
      kind: "cell.setFaction";
      cellId: number;
      factionId: number | null;
    }
  | {
      kind: "citizen.status";
      citizenId: number;
      status: string;
      cause?: string | undefined;
      motivation?: string | undefined;
    }
  | {
      kind: "citizen.move";
      citizenId: number;
      settlementId: number;
      homeCellId: number;
    }
  | {
      kind: "citizen.tagBurg";
      burgId: number;
      tags: string[];
      temper?: string | null | undefined;
      motivation?: string | null | undefined;
      professionFilter?: string | null | undefined;
      limit?: number | undefined;
      randomSeed: number;
    }
  | {
      kind: "agent.update";
      agentId: number;
      fields: Partial<AgentUpdateFields>;
    }
  | {
      kind: "agent.remove";
      agentId: number;
      reason: string;
    }
  | {
      kind: "tags.add";
      target: TagTarget;
      tags: string[];
    }
  | {
      kind: "event.log";
      tick: number;
      type: string;
      message: string;
      tier: "MINOR" | "MAJOR" | "CRITICAL";
      loreDate?: string | undefined;
      burgId?: number | undefined;
      cellId?: number | undefined;
      factionId?: number | undefined;
      outlawId?: number | undefined;
    }
  | {
      kind: "thread.open";
      spec: CreateThreadInput;
    }
  | {
      kind: "scheduled.add";
      at: ClockTimeSpec;
      event: ScheduledEventSpec;
    }
  | {
      kind: "weatherFront.update";
      frontId: number;
      x: number;
      y: number;
      lifetime: number;
    }
  | {
      kind: "weatherFront.create";
      type: string;
      x: number;
      y: number;
      dx: number;
      dy: number;
      radius: number;
      lifetime: number;
    }
  | {
      kind: "weatherFront.remove";
      frontId: number;
    }
  | {
      kind: "chaosZone.upsert";
      cellId: number;
      intensity: number;
      type: string;
    }
  | {
      kind: "chaosZone.adjust";
      cellId?: number | undefined;
      intensityDelta: number;
      deleteAtOrBelowZero?: boolean | undefined;
    }
  | {
      kind: "calendar.set";
      id?: number | undefined;
      tick: number;
      year: number;
      month: number;
      monthName: string;
      dayOfMonth: number;
      dayOfYear: number;
      season: string;
      moonPhase: string;
      activeFlow: string;
      dragonDomain: string;
      isShadowWeek: boolean;
    }
  | {
      kind: "entity.create";
      ref: string;
      entityKind: EntityKind;
      name: string;
      alive?: boolean | undefined;
      lod?: EntityLod | undefined;
      cellId?: number | null | undefined;
      rx?: number | null | undefined;
      ry?: number | null | undefined;
      z?: number | null | undefined;
      x?: number | null | undefined;
      y?: number | null | undefined;
      sourceTable: string;
      sourceId: string;
      createdTick?: number | undefined;
    }
  | {
      kind: "entity.die";
      ref: string;
      diedTick: number;
    };

export type DeltaEmitter = (delta: Delta) => void;

export interface RejectedDelta {
  delta: Delta;
  reason: string;
}

export interface ValidateResult {
  ok: Delta[];
  rejected: RejectedDelta[];
}
