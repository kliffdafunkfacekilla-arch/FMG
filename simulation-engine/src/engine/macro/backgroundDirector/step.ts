import { isChaosPeak } from "../../canon/calendar.js";
import type { Delta } from "../../deltas/types.js";
import { evaluateSectorReactions, type SectorContext } from "../../rpg/narrativeReactionEngine.js";
import type { Entity } from "../../rpg/narrativeTagEngine.js";

/** Sector tag for Cruorbus's chaos peak (Canon/04 §2: the Bleed). */
export const BLEED_TAG = "#TheBleed";

export interface DirectorBurgSnapshot {
  burgId: number;
  cellId: number;
  name: string;
  unrest: number;
  food: number;
  wealth: number;
  crimeRate: number;
}

export interface DirectorSectorSnapshot {
  cellId: number;
  rx: number;
  ry: number;
  zLayer: number;
  npcs: Entity[];
  props: Entity[];
  features: Record<string, any>;
}

export interface BackgroundDirectorSnapshot {
  tick: number;
  loreDate?: string | undefined;
  moonPhase: string;
  isShadowWeek: boolean;
  sectors: DirectorSectorSnapshot[];
  burgsByCell: Record<number, DirectorBurgSnapshot>;
}

export interface BackgroundDirectorStepResult {
  sectorsEvaluated: number;
  sectorsMutated: number;
  reactionsFired: number;
  eventsLogged: number;
  threadsProposed: number;
  sectorsFailed: number;
  deltas: Delta[];
}

/**
 * Pure Background Director step: evaluates deterministic tag-matrix collisions across rendered
 * sectors without mutating caller snapshots, emitting batched sector layer, thread & event deltas.
 */
export function stepBackgroundDirector(snap: BackgroundDirectorSnapshot): BackgroundDirectorStepResult {
  const deltas: Delta[] = [];
  let sectorsEvaluated = 0;
  let sectorsMutated = 0;
  let reactionsFired = 0;
  let eventsLogged = 0;
  let threadsProposed = 0;
  let sectorsFailed = 0;

  for (const sector of snap.sectors) {
    sectorsEvaluated++;
    if (sector.npcs.length === 0 && sector.props.length === 0) continue;

    try {
      const burg = snap.burgsByCell[sector.cellId] || null;
      const globalTags: string[] = [];

      if (burg) {
        if (burg.food < 1000) {
          globalTags.push("#Famine", "#ResourceScarcity");
        } else if (burg.food > 100000) {
          globalTags.push("#HarvestAbundance");
        }
        if (burg.unrest >= 40) {
          globalTags.push("#MartialLaw", "#HighUnrest");
        }
        if (burg.wealth > 10000) {
          globalTags.push("#CommercialBoom");
        }
        if (burg.crimeRate > 30) {
          globalTags.push("#UndergroundUnrest", "#SyndicatePresence");
        }
      }

      if (isChaosPeak(snap.moonPhase)) {
        globalTags.push(BLEED_TAG);
      }
      if (snap.isShadowWeek) {
        globalTags.push("#ShadowWeek");
      }

      const clonedNpcs = structuredClone(sector.npcs);
      const clonedProps = structuredClone(sector.props);
      const sectorEntities: Entity[] = [...clonedNpcs, ...clonedProps];

      const context: SectorContext = {
        burgId: burg ? burg.burgId : null,
        ...(burg?.name !== undefined ? { burgName: burg.name } : {}),
        cellId: sector.cellId,
        unrest: burg ? burg.unrest : 0,
        food: burg ? burg.food : 0,
        wealth: burg ? burg.wealth : 0,
        tick: snap.tick,
        cruorbusPhase: snap.moonPhase,
        isShadowWeek: snap.isShadowWeek,
        rx: sector.rx,
        ry: sector.ry,
      };

      const result = evaluateSectorReactions(sectorEntities, globalTags, context);
      if (!result.mutated) continue;

      sectorsMutated++;
      reactionsFired += result.rulesTriggered.length;

      const updatedNpcs = sectorEntities.filter((e) => e.type === "NPC");
      const updatedProps = sectorEntities.filter((e) => e.type === "PROP");
      const existingFeatures =
        sector.features && typeof sector.features === "object" ? structuredClone(sector.features) : {};
      const updatedFeatures = {
        ...existingFeatures,
        environmental_tags: result.newSectorTags,
        last_background_director_tick: snap.tick,
      };

      deltas.push({
        kind: "sectorLayer.update",
        cellId: sector.cellId,
        rx: sector.rx,
        ry: sector.ry,
        zLayer: sector.zLayer,
        npcs: updatedNpcs,
        props: updatedProps,
        features: updatedFeatures,
      });

      for (const th of result.threadsToOpen || []) {
        threadsProposed++;
        deltas.push({
          kind: "thread.open",
          spec: { ...th, created_tick: snap.tick },
          bestEffort: true,
        });
      }

      for (const ev of result.events) {
        eventsLogged++;
        deltas.push({
          kind: "event.log",
          tick: snap.tick,
          ...(ev.burgId ? { burgId: Number(ev.burgId) } : {}),
          zLayer: sector.zLayer,
          loreDate: snap.loreDate || `Tick ${snap.tick}`,
          type: ev.type,
          message: ev.message,
          tier: ev.tier,
        });
      }
    } catch (err: any) {
      sectorsFailed++;
      console.warn(
        `[Background Director] Sector ${sector.cellId} r[${sector.rx},${sector.ry}] z${sector.zLayer} skipped: ${err?.message || err}`
      );
    }
  }

  return {
    sectorsEvaluated,
    sectorsMutated,
    reactionsFired,
    eventsLogged,
    threadsProposed,
    sectorsFailed,
    deltas,
  };
}
