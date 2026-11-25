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
  refined_goods?: number | undefined;
  pop_null?: number | undefined;
  pop_attuned?: number | undefined;
  urban_tier?: number | undefined;
  occupier_faction_id?: number | null | undefined;
  name?: string | undefined;
  military_forces?: string | undefined;
  occupation_ticks?: number | undefined;
  resistance_strength?: number | undefined;
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
  target_grove_id?: number | null | undefined;
  state?: string | undefined;
  sub_role?: string | null | undefined;
  spark_tier?: string | null | undefined;
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

export type OverlayChange = "destroyed" | "burnt" | "opened" | "moved" | "looted" | "placed";

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
      refinedGoods?: number | undefined;
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
      kind: "agent.create";
      name: string;
      role: string;
      subRole?: string | undefined;
      citizenName?: string | null | undefined;
      profession?: string | null | undefined;
      species?: string | null | undefined;
      sparkTier?: string | null | undefined;
      personalityTemper?: string | null | undefined;
      personalityInstinct?: string | null | undefined;
      motivation?: string | null | undefined;
      locationCellId: number;
      targetCellId?: number | null | undefined;
      targetGroveId?: number | null | undefined;
      homeBurgId?: number | null | undefined;
      factionId?: number | null | undefined;
      state: string;
      corruption?: number | undefined;
      drainedPower?: number | undefined;
      ageTicks?: number | undefined;
      activePlot?: string | null | undefined;
      createdTick?: number | undefined;
    }
  | {
      kind: "agent.remove";
      agentId: number;
      reason: string;
      diedTick?: number | undefined;
    }
  | {
      kind: "tags.add";
      target: TagTarget;
      tags: string[];
    }
  | {
      kind: "tags.remove";
      target: TagTarget;
      tags: string[];
    }
  | {
      kind: "event.log";
      tick: number;
      type: string;
      message: string;
      tier: "BACKGROUND" | "MINOR" | "MAJOR" | "CRITICAL";
      loreDate?: string | undefined;
      burgId?: number | undefined;
      cellId?: number | undefined;
      factionId?: number | undefined;
      outlawId?: number | undefined;
      zLayer?: number | undefined;
    }
  | {
      kind: "thread.open";
      spec: CreateThreadInput;
      bestEffort?: boolean | undefined;
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
      updateOnConflict?: boolean | undefined;
    }
  | {
      kind: "chaosZone.adjust";
      cellId?: number | undefined;
      intensityDelta: number;
      deleteAtOrBelowZero?: boolean | undefined;
    }
  | {
      kind: "chaosZone.remove";
      cellId: number;
      type: string;
    }
  | {
      kind: "chaosFlow.update";
      flowId: number;
      currentSurge: number;
      currentWidth: number;
      waypoints: unknown[];
      narrowSpots: unknown[];
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
    }
  | {
      kind: "citizen.killOne";
      citizenId: number;
      cause: string;
      diedTick: number;
    }
  | {
      kind: "paragon.die";
      paragonId: number;
      diedTick: number;
      cause?: string | undefined;
    }
  | {
      kind: "burg.militaryAdjust";
      burgId: number;
      unitType: string;
      delta: number;
    }
  | {
      kind: "infrastructure.adjust";
      burgId: number;
      infraType: string;
      levelDelta?: number | undefined;
      status?: string | undefined;
    }
  | {
      kind: "overlay.add";
      cellId: number;
      rx: number;
      ry: number;
      z: number;
      x?: number | null | undefined;
      y?: number | null | undefined;
      objectRef?: string | null | undefined;
      change: OverlayChange;
      payload?: Record<string, any> | undefined;
      tick: number;
      minute?: number | undefined;
      source: string;
    }
  | {
      kind: "diplomacy.endWars";
      factionId: number;
    }
  | {
      kind: "standing.adjust";
      subjectRef: string;
      partyRef: string;
      delta: number;
      reason: string;
      tick?: number | undefined;
    }
  | {
      kind: "market.setGoods";
      marketId: number;
      goods: Record<string, { price: number; stock: number; refStock: number }>;
    }
  | {
      kind: "commodity.set";
      commodity: string;
      currentPrice: number;
      globalSupply: number;
      globalDemand: number;
      lastUpdatedTick: number;
    }
  | {
      kind: "grindCanyon.update";
      canyonId: number;
      richnessDelta?: number;
      stabilityTicksRemaining?: number;
      status?: "OPEN" | "COLLAPSING" | "SEALED";
      closedTick?: number;
    }
  | {
      kind: "grindCanyon.create";
      name: string;
      cellId: number;
      sectorX: number;
      sectorY: number;
      dragonName: string;
      dragonDomain: string;
      depthMeters: number;
      dragonstoneRichness: number;
      artifactsRemaining: number;
      stabilityTicksRemaining: number;
      totalDurationTicks: number;
      status: "OPEN" | "COLLAPSING" | "SEALED";
      minerCrewName: string;
      activeMiners: number;
      openedTick: number;
    }
  | {
      kind: "outlawFaction.adjust";
      outlawId: number;
      wealthDelta?: number;
      manpowerDelta?: number;
      heatDelta?: number;
    }
  | {
      kind: "fringeLair.mutate";
      action: "upsert" | "deleteByFactionCell";
      factionId: number;
      cellId: number;
      burgId?: number | null;
      lairType?: string;
      manpower?: number;
      heat?: number;
    }
  | {
      kind: "culture.adjustCells";
      cultureId: number;
      delta: number;
    }
  | {
      kind: "religion.adjustCells";
      religionId: number;
      delta: number;
    }
  | {
      kind: "npcInstance.update";
      npcId: string;
      needs?: Record<string, number> | undefined;
      mood?: Record<string, number> | undefined;
      beliefs?: unknown[] | undefined;
      disposition?: number | undefined;
      tradePriceMult?: number | undefined;
      processedForEconomy?: boolean | undefined;
    }
  | {
      kind: "fringeLair.addRations";
      burgId: number;
      rations: number;
    }
  | {
      kind: "sectorLayer.update";
      cellId: number;
      rx: number;
      ry: number;
      zLayer: number;
      npcs: unknown[];
      props: unknown[];
      features: Record<string, any>;
    }
  | {
      kind: "grove.adjust";
      groveId: number;
      sealDelta: number;
    }
  | {
      kind: "ancientWard.recharge";
      tick: number;
    }
  | {
      kind: "ancientWard.discharge";
      wardId: number;
      tick: number;
    }
  | {
      kind: "burg.createSatellite";
      burgId: number;
      cellId: number;
      name: string;
      parentBurgId: number;
      parentCellId: number;
      settlementType: "HAMLET" | "FARMLAND" | "LOGGING" | "WATCHTOWER";
      popNull: number;
      popAttuned: number;
      wealth: number;
      food: number;
      roadName: string;
    }
  | {
      kind: "paragon.setCorruption";
      paragonId: number;
      corruptionScore: number;
    }
  | {
      kind: "faction.update";
      factionId: number;
      treasurySet?: number | undefined;
      treasuryDelta?: number | undefined;
      fiscalEconomy?: Record<string, any> | undefined;
    }
  | {
      kind: "factionUnit.update";
      unitId: number;
      count: number;
      status: string;
    }
  | {
      kind: "diplomacy.upsert";
      factionAId: number;
      factionBId: number;
      status: string;
      tension: number;
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
