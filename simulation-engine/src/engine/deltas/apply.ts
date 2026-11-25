import { addCellTagsBatch, removeCellTagsBatch } from "../cellTags.js";
import { markEntitiesDeadBatch, upsertEntitiesBatch, type UpsertEntityInput } from "../entities/registry.js";
import { createThread } from "../threads/threadEngine.js";
import type { AgentUpdateFields, Db, Delta } from "./types.js";

interface NumAcc {
  hasSet: boolean;
  setVal: number;
  delta: number;
}

const zeroAcc = (): NumAcc => ({ hasSet: false, setVal: 0, delta: 0 });
const applyNumAdjust = (acc: NumAcc, delta: number | undefined) => {
  if (delta !== undefined && delta !== 0) acc.delta += delta;
};
const applyNumSet = (acc: NumAcc, val: number | undefined) => {
  if (val !== undefined) {
    acc.hasSet = true;
    acc.setVal = val;
    acc.delta = 0;
  }
};
const numActive = (acc: NumAcc): boolean => acc.hasSet || acc.delta !== 0;

interface BurgMerged {
  food: NumAcc;
  wealth: NumAcc;
  unrest: NumAcc;
  health: NumAcc;
  crimeRate: NumAcc;
  rawMaterials: NumAcc;
  refinedGoods: NumAcc;
  popNull: NumAcc;
  popAttuned: NumAcc;
  urbanTierSet: boolean;
  urbanTierVal: number;
  occSet: boolean;
  occVal: number | null;
  nameSet: boolean;
  nameVal: string | null;
  milSet: boolean;
  milVal: string | null;
  occTicksSet: boolean;
  occTicksVal: number;
  resSet: boolean;
  resVal: number;
}

function emptyBurgMerged(): BurgMerged {
  return {
    food: zeroAcc(),
    wealth: zeroAcc(),
    unrest: zeroAcc(),
    health: zeroAcc(),
    crimeRate: zeroAcc(),
    rawMaterials: zeroAcc(),
    refinedGoods: zeroAcc(),
    popNull: zeroAcc(),
    popAttuned: zeroAcc(),
    urbanTierSet: false,
    urbanTierVal: 0,
    occSet: false,
    occVal: null,
    nameSet: false,
    nameVal: null,
    milSet: false,
    milVal: null,
    occTicksSet: false,
    occTicksVal: 0,
    resSet: false,
    resVal: 0,
  };
}

interface CellMerged {
  ecoHealth: NumAcc;
  ecoMax: NumAcc;
  ecoPlants: NumAcc;
  ecoPrey: NumAcc;
  ecoPredators: NumAcc;
  ecoApex: NumAcc;
  ecoBlight: NumAcc;
  currentTemp: NumAcc;
  cultureSet: boolean;
  cultureVal: number;
  religionSet: boolean;
  religionVal: number;
}

function emptyCellMerged(): CellMerged {
  return {
    ecoHealth: zeroAcc(),
    ecoMax: zeroAcc(),
    ecoPlants: zeroAcc(),
    ecoPrey: zeroAcc(),
    ecoPredators: zeroAcc(),
    ecoApex: zeroAcc(),
    ecoBlight: zeroAcc(),
    currentTemp: zeroAcc(),
    cultureSet: false,
    cultureVal: 0,
    religionSet: false,
    religionVal: 0,
  };
}

/**
 * Applies validated deltas to PostgreSQL grouped and batched per table. Relative `adjust` deltas sum
 * cleanly; a `set` overrides earlier `adjust`s on the same field while later `adjust`s add on top.
 * Rows whose clamped post-update values match existing DB columns are skipped (`IS DISTINCT FROM`).
 */
export async function applyDeltas(deltas: Delta[], db: Db): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  if (deltas.length === 0) return counts;

  const burgs = new Map<number, BurgMerged>();
  const marketGoods = new Map<number, string>();
  const commoditySets = new Map<string, { currentPrice: number; globalSupply: number; globalDemand: number; lastUpdatedTick: number }>();
  const canyonUpdates = new Map<number, {
    richnessDelta: number;
    stabilityTicksRemaining?: number;
    status?: "OPEN" | "COLLAPSING" | "SEALED";
    closedTick?: number;
  }>();
  const canyonCreates: Array<Extract<Delta, { kind: "grindCanyon.create" }>> = [];
  const outlawAdjusts = new Map<number, { wealthDelta: number; manpowerDelta: number; heatDelta: number }>();
  const lairDeletes: Array<{ factionId: number; cellId: number }> = [];
  const lairUpserts: Array<{ factionId: number; cellId: number; burgId: number | null; lairType: string; manpower: number; heat: number }> = [];
  const cells = new Map<number, CellMerged>();
  const cellFactions = new Map<number, number | null>();
  const citizenStatuses = new Map<number, { status: string; cause: string | null; motivation: string | null }>();
  const citizenMoves = new Map<number, { settlementId: number; homeCellId: number }>();
  const agentUpdates = new Map<number, AgentUpdateFields>();
  const agentCreates: Array<Extract<Delta, { kind: "agent.create" }>> = [];
  const agentRemovals = new Map<number, number>();
  const cellTagsByLayer = new Map<number, Array<{ cellId: number; tags: string[] }>>();
  const cellTagRemovesByLayer = new Map<number, Array<{ cellId: number; tags: string[] }>>();
  const citizenTags: Array<{ citizenId: number; tags: string[]; temper: string | null; motivation: string | null }> = [];
  const citizenTagBurgs: Array<Extract<Delta, { kind: "citizen.tagBurg" }>> = [];
  const events: Array<Extract<Delta, { kind: "event.log" }>> = [];
  const threads: Array<Extract<Delta, { kind: "thread.open" }>> = [];
  const scheduled: Array<Extract<Delta, { kind: "scheduled.add" }>> = [];
  const frontUpdates = new Map<number, { x: number; y: number; lifetime: number }>();
  const frontCreates: Array<Extract<Delta, { kind: "weatherFront.create" }>> = [];
  const frontRemoves = new Set<number>();
  const chaosUpserts: Array<Extract<Delta, { kind: "chaosZone.upsert" }>> = [];
  const chaosAdjusts: Array<Extract<Delta, { kind: "chaosZone.adjust" }>> = [];
  const chaosRemoves: Array<Extract<Delta, { kind: "chaosZone.remove" }>> = [];
  const chaosFlowUpdates = new Map<number, Extract<Delta, { kind: "chaosFlow.update" }>>();
  const entityCreates: UpsertEntityInput[] = [];
  const entityDeaths: Array<{ ref: string; diedTick: number }> = [];
  const citizenKillOnes: Array<Extract<Delta, { kind: "citizen.killOne" }>> = [];
  const paragonDies: Array<Extract<Delta, { kind: "paragon.die" }>> = [];
  const burgMilAdjusts: Array<Extract<Delta, { kind: "burg.militaryAdjust" }>> = [];
  const infraAdjusts: Array<Extract<Delta, { kind: "infrastructure.adjust" }>> = [];
  const overlayAdds: Array<Extract<Delta, { kind: "overlay.add" }>> = [];
  const standingAdjusts: Array<Extract<Delta, { kind: "standing.adjust" }>> = [];
  const endWarFactions = new Set<number>();
  const cultureCellDeltas = new Map<number, number>();
  const religionCellDeltas = new Map<number, number>();
  const npcInstanceUpdates = new Map<string, {
    needs?: string;
    mood?: string;
    beliefs?: string;
    disposition?: number;
    tradePriceMult?: number;
    processedForEconomy?: boolean;
    touchUpdated: boolean;
  }>();
  const lairRationsByBurg = new Map<number, number>();
  const sectorLayerUpdates = new Map<string, Extract<Delta, { kind: "sectorLayer.update" }>>();
  const groveSealDeltas = new Map<number, number>();
  const wardDischarges = new Map<number, number>();
  const satelliteCreates: Array<Extract<Delta, { kind: "burg.createSatellite" }>> = [];
  const paragonCorruptions = new Map<number, number>();
  const factionUpdates = new Map<number, { treasury: NumAcc; fiscalSet: boolean; fiscalJson: string | null }>();
  const factionUnitUpdates = new Map<number, { count: number; status: string }>();
  const diplomacyUpserts = new Map<string, { factionAId: number; factionBId: number; status: string; tension: number }>();
  let wardRechargeTick: number | null = null;
  let lastCalendar: Extract<Delta, { kind: "calendar.set" }> | null = null;

  for (const d of deltas) {
    switch (d.kind) {
      case "burg.adjust": {
        let m = burgs.get(d.burgId);
        if (!m) { m = emptyBurgMerged(); burgs.set(d.burgId, m); }
        applyNumAdjust(m.food, d.food);
        applyNumAdjust(m.wealth, d.wealth);
        applyNumAdjust(m.unrest, d.unrest);
        applyNumAdjust(m.health, d.health);
        applyNumAdjust(m.crimeRate, d.crime);
        applyNumAdjust(m.rawMaterials, d.rawMaterials);
        applyNumAdjust(m.refinedGoods, d.refinedGoods);
        applyNumAdjust(m.popNull, d.popNull);
        applyNumAdjust(m.popAttuned, d.popAttuned);
        break;
      }
      case "burg.set": {
        let m = burgs.get(d.burgId);
        if (!m) { m = emptyBurgMerged(); burgs.set(d.burgId, m); }
        const f = d.fields;
        applyNumSet(m.food, f.food);
        applyNumSet(m.wealth, f.wealth);
        applyNumSet(m.unrest, f.unrest);
        applyNumSet(m.health, f.health);
        applyNumSet(m.crimeRate, f.crime_rate);
        applyNumSet(m.rawMaterials, f.raw_materials);
        applyNumSet(m.refinedGoods, f.refined_goods);
        applyNumSet(m.popNull, f.pop_null);
        applyNumSet(m.popAttuned, f.pop_attuned);
        if (f.urban_tier !== undefined) { m.urbanTierSet = true; m.urbanTierVal = f.urban_tier; }
        if (f.occupier_faction_id !== undefined) { m.occSet = true; m.occVal = f.occupier_faction_id; }
        if (f.name !== undefined) { m.nameSet = true; m.nameVal = f.name; }
        if (f.military_forces !== undefined) { m.milSet = true; m.milVal = f.military_forces; }
        if (f.occupation_ticks !== undefined) { m.occTicksSet = true; m.occTicksVal = f.occupation_ticks; }
        if (f.resistance_strength !== undefined) { m.resSet = true; m.resVal = f.resistance_strength; }
        break;
      }
      case "cell.adjust": {
        let m = cells.get(d.cellId);
        if (!m) { m = emptyCellMerged(); cells.set(d.cellId, m); }
        applyNumAdjust(m.ecoHealth, d.ecoHealth);
        applyNumAdjust(m.ecoMax, d.ecoMax);
        applyNumAdjust(m.ecoPlants, d.ecoPlants);
        applyNumAdjust(m.ecoPrey, d.ecoPrey);
        applyNumAdjust(m.ecoPredators, d.ecoPredators);
        applyNumAdjust(m.ecoApex, d.ecoApex);
        applyNumAdjust(m.ecoBlight, d.ecoBlight);
        applyNumAdjust(m.currentTemp, d.currentTemp);
        break;
      }
      case "cell.set": {
        let m = cells.get(d.cellId);
        if (!m) { m = emptyCellMerged(); cells.set(d.cellId, m); }
        const f = d.fields;
        applyNumSet(m.ecoHealth, f.eco_health);
        applyNumSet(m.ecoMax, f.eco_max);
        applyNumSet(m.ecoPlants, f.eco_plants);
        applyNumSet(m.ecoPrey, f.eco_prey);
        applyNumSet(m.ecoPredators, f.eco_predators);
        applyNumSet(m.ecoApex, f.eco_apex);
        applyNumSet(m.ecoBlight, f.eco_blight);
        applyNumSet(m.currentTemp, f.current_temp);
        if (f.culture_id !== undefined) { m.cultureSet = true; m.cultureVal = f.culture_id; }
        if (f.religion_id !== undefined) { m.religionSet = true; m.religionVal = f.religion_id; }
        break;
      }
      case "cell.setFaction":
        cellFactions.set(d.cellId, d.factionId);
        break;
      case "citizen.status":
        citizenStatuses.set(d.citizenId, {
          status: d.status,
          cause: d.cause ?? null,
          motivation: d.motivation ?? null,
        });
        break;
      case "citizen.move":
        citizenMoves.set(d.citizenId, { settlementId: d.settlementId, homeCellId: d.homeCellId });
        break;
      case "citizen.tagBurg":
        citizenTagBurgs.push(d);
        break;
      case "agent.update": {
        const prev = agentUpdates.get(d.agentId) || {};
        agentUpdates.set(d.agentId, { ...prev, ...d.fields });
        break;
      }
      case "agent.create":
        agentCreates.push(d);
        break;
      case "agent.remove":
        agentRemovals.set(d.agentId, d.diedTick ?? 0);
        agentUpdates.delete(d.agentId);
        break;
      case "tags.add":
        if (d.target.kind === "cell") {
          const z = d.target.zLayer ?? 0;
          let list = cellTagsByLayer.get(z);
          if (!list) { list = []; cellTagsByLayer.set(z, list); }
          list.push({ cellId: d.target.cellId, tags: d.tags });
        } else {
          citizenTags.push({
            citizenId: d.target.citizenId,
            tags: d.tags,
            temper: d.target.temper ?? null,
            motivation: d.target.motivation ?? null,
          });
        }
        break;
      case "tags.remove":
        if (d.target.kind === "cell") {
          const z = d.target.zLayer ?? 0;
          let list = cellTagRemovesByLayer.get(z);
          if (!list) { list = []; cellTagRemovesByLayer.set(z, list); }
          list.push({ cellId: d.target.cellId, tags: d.tags });
        }
        break;
      case "event.log":
        events.push(d);
        break;
      case "thread.open":
        threads.push(d);
        break;
      case "scheduled.add":
        scheduled.push(d);
        break;
      case "weatherFront.update":
        if (!frontRemoves.has(d.frontId)) {
          frontUpdates.set(d.frontId, { x: d.x, y: d.y, lifetime: d.lifetime });
        }
        break;
      case "weatherFront.create":
        frontCreates.push(d);
        break;
      case "weatherFront.remove":
        frontRemoves.add(d.frontId);
        frontUpdates.delete(d.frontId);
        break;
      case "chaosZone.upsert":
        chaosUpserts.push(d);
        break;
      case "chaosZone.adjust":
        chaosAdjusts.push(d);
        break;
      case "chaosZone.remove":
        chaosRemoves.push(d);
        break;
      case "chaosFlow.update":
        chaosFlowUpdates.set(d.flowId, d);
        break;
      case "calendar.set":
        lastCalendar = d;
        break;
      case "entity.create":
        entityCreates.push({
          ref: d.ref,
          kind: d.entityKind,
          name: d.name,
          alive: d.alive,
          lod: d.lod,
          cellId: d.cellId,
          rx: d.rx,
          ry: d.ry,
          z: d.z,
          x: d.x,
          y: d.y,
          sourceTable: d.sourceTable,
          sourceId: d.sourceId,
          createdTick: d.createdTick,
        });
        break;
      case "entity.die":
        entityDeaths.push({ ref: d.ref, diedTick: d.diedTick });
        break;
      case "citizen.killOne":
        citizenKillOnes.push(d);
        break;
      case "paragon.die":
        paragonDies.push(d);
        entityDeaths.push({ ref: `paragon:${d.paragonId}`, diedTick: d.diedTick });
        break;
      case "burg.militaryAdjust":
        burgMilAdjusts.push(d);
        break;
      case "infrastructure.adjust":
        infraAdjusts.push(d);
        break;
      case "overlay.add":
        overlayAdds.push(d);
        break;
      case "standing.adjust":
        standingAdjusts.push(d);
        break;
      case "diplomacy.endWars":
        endWarFactions.add(d.factionId);
        break;
      case "market.setGoods":
        marketGoods.set(d.marketId, JSON.stringify(d.goods));
        break;
      case "commodity.set":
        commoditySets.set(d.commodity, {
          currentPrice: d.currentPrice,
          globalSupply: Math.round(d.globalSupply),
          globalDemand: Math.round(d.globalDemand),
          lastUpdatedTick: Math.round(d.lastUpdatedTick),
        });
        break;
      case "grindCanyon.update": {
        let cur = canyonUpdates.get(d.canyonId);
        if (!cur) {
          cur = { richnessDelta: 0 };
          canyonUpdates.set(d.canyonId, cur);
        }
        if (d.richnessDelta !== undefined) cur.richnessDelta += Math.round(d.richnessDelta);
        if (d.stabilityTicksRemaining !== undefined) cur.stabilityTicksRemaining = Math.round(d.stabilityTicksRemaining);
        if (d.status !== undefined) cur.status = d.status;
        if (d.closedTick !== undefined) cur.closedTick = Math.round(d.closedTick);
        break;
      }
      case "grindCanyon.create":
        canyonCreates.push(d);
        break;
      case "outlawFaction.adjust": {
        let cur = outlawAdjusts.get(d.outlawId);
        if (!cur) {
          cur = { wealthDelta: 0, manpowerDelta: 0, heatDelta: 0 };
          outlawAdjusts.set(d.outlawId, cur);
        }
        if (d.wealthDelta !== undefined) cur.wealthDelta += Math.round(d.wealthDelta);
        if (d.manpowerDelta !== undefined) cur.manpowerDelta += Math.round(d.manpowerDelta);
        if (d.heatDelta !== undefined) cur.heatDelta += Math.round(d.heatDelta);
        break;
      }
      case "fringeLair.mutate":
        if (d.action === "deleteByFactionCell") {
          lairDeletes.push({ factionId: d.factionId, cellId: d.cellId });
        } else {
          lairUpserts.push({
            factionId: d.factionId,
            cellId: d.cellId,
            burgId: d.burgId ?? null,
            lairType: d.lairType || "HIDEOUT",
            manpower: Math.round(d.manpower ?? 10),
            heat: Math.round(d.heat ?? 10),
          });
        }
        break;
      case "culture.adjustCells":
        if (d.delta !== 0) {
          cultureCellDeltas.set(d.cultureId, (cultureCellDeltas.get(d.cultureId) || 0) + Math.round(d.delta));
        }
        break;
      case "religion.adjustCells":
        if (d.delta !== 0) {
          religionCellDeltas.set(d.religionId, (religionCellDeltas.get(d.religionId) || 0) + Math.round(d.delta));
        }
        break;
      case "npcInstance.update": {
        const cur = npcInstanceUpdates.get(d.npcId) || { touchUpdated: false };
        if (d.needs !== undefined) { cur.needs = JSON.stringify(d.needs); cur.touchUpdated = true; }
        if (d.mood !== undefined) { cur.mood = JSON.stringify(d.mood); cur.touchUpdated = true; }
        if (d.beliefs !== undefined) { cur.beliefs = JSON.stringify(d.beliefs); cur.touchUpdated = true; }
        if (d.disposition !== undefined) { cur.disposition = Math.round(d.disposition); cur.touchUpdated = true; }
        if (d.tradePriceMult !== undefined) { cur.tradePriceMult = d.tradePriceMult; cur.touchUpdated = true; }
        if (d.processedForEconomy !== undefined) { cur.processedForEconomy = d.processedForEconomy; }
        npcInstanceUpdates.set(d.npcId, cur);
        break;
      }
      case "fringeLair.addRations": {
        const amt = Math.round(d.rations);
        if (amt > 0) lairRationsByBurg.set(d.burgId, (lairRationsByBurg.get(d.burgId) || 0) + amt);
        break;
      }
      case "sectorLayer.update":
        sectorLayerUpdates.set(`${d.cellId}:${Math.round(d.rx)}:${Math.round(d.ry)}:${Math.round(d.zLayer)}`, d);
        break;
      case "grove.adjust":
        if (d.sealDelta !== 0) {
          groveSealDeltas.set(d.groveId, (groveSealDeltas.get(d.groveId) || 0) + Math.round(d.sealDelta));
        }
        break;
      case "ancientWard.recharge":
        wardRechargeTick = wardRechargeTick === null ? Math.round(d.tick) : Math.max(wardRechargeTick, Math.round(d.tick));
        break;
      case "ancientWard.discharge":
        wardDischarges.set(d.wardId, Math.round(d.tick));
        break;
      case "burg.createSatellite":
        satelliteCreates.push(d);
        break;
      case "paragon.setCorruption":
        paragonCorruptions.set(d.paragonId, d.corruptionScore);
        break;
      case "faction.update": {
        let f = factionUpdates.get(d.factionId);
        if (!f) {
          f = { treasury: zeroAcc(), fiscalSet: false, fiscalJson: null };
          factionUpdates.set(d.factionId, f);
        }
        applyNumSet(f.treasury, d.treasurySet);
        applyNumAdjust(f.treasury, d.treasuryDelta);
        if (d.fiscalEconomy !== undefined) {
          f.fiscalSet = true;
          f.fiscalJson = JSON.stringify(d.fiscalEconomy);
        }
        break;
      }
      case "factionUnit.update":
        factionUnitUpdates.set(d.unitId, { count: d.count, status: d.status });
        break;
      case "diplomacy.upsert":
        diplomacyUpserts.set(`${d.factionAId}:${d.factionBId}`, {
          factionAId: d.factionAId,
          factionBId: d.factionBId,
          status: d.status,
          tension: d.tension,
        });
        break;
    }
  }

  // 1. sim_calendar
  if (lastCalendar) {
    if (lastCalendar.id !== undefined && lastCalendar.id > 0) {
      await db.query(
        `UPDATE sim_calendar SET
            tick = $1, year = $2, month = $3, month_name = $4,
            day_of_month = $5, day_of_year = $6, season = $7,
            moon_phase = $8, active_flow = $9, dragon_domain = $10, is_shadow_week = $11
         WHERE id = $12`,
        [
          lastCalendar.tick, lastCalendar.year, lastCalendar.month, lastCalendar.monthName,
          lastCalendar.dayOfMonth, lastCalendar.dayOfYear, lastCalendar.season,
          lastCalendar.moonPhase, lastCalendar.activeFlow, lastCalendar.dragonDomain,
          lastCalendar.isShadowWeek, lastCalendar.id,
        ]
      );
    } else {
      await db.query(
        `INSERT INTO sim_calendar (
            tick, year, month, month_name, day_of_month, day_of_year,
            season, moon_phase, active_flow, dragon_domain, is_shadow_week
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          lastCalendar.tick, lastCalendar.year, lastCalendar.month, lastCalendar.monthName,
          lastCalendar.dayOfMonth, lastCalendar.dayOfYear, lastCalendar.season,
          lastCalendar.moonPhase, lastCalendar.activeFlow, lastCalendar.dragonDomain,
          lastCalendar.isShadowWeek,
        ]
      );
    }
    await db.query(
      `INSERT INTO world_clock (id, tick, minute_of_day, running, speed_ms, mode)
       VALUES (1, $1, 0, false, 1500, 'live')
       ON CONFLICT (id) DO UPDATE SET tick = EXCLUDED.tick, updated_at = now()`,
      [lastCalendar.tick]
    );
    counts.sim_calendar = 1;
  }

  // 2. sim_weather_fronts
  if (frontUpdates.size > 0) {
    const ids = Array.from(frontUpdates.keys()).sort((a, b) => a - b);
    const xs = ids.map((id) => frontUpdates.get(id)!.x);
    const ys = ids.map((id) => frontUpdates.get(id)!.y);
    const lifetimes = ids.map((id) => frontUpdates.get(id)!.lifetime);
    const res = await db.query(
      `UPDATE sim_weather_fronts f SET x = v.x, y = v.y, lifetime = v.lifetime
       FROM (SELECT unnest($1::int[]) AS id, unnest($2::real[]) AS x, unnest($3::real[]) AS y, unnest($4::int[]) AS lifetime) v
       WHERE f.id = v.id`,
      [ids, xs, ys, lifetimes]
    );
    counts.sim_weather_fronts = (counts.sim_weather_fronts || 0) + (res.rowCount || 0);
  }
  if (frontRemoves.size > 0) {
    const res = await db.query(
      `DELETE FROM sim_weather_fronts WHERE id = ANY($1::int[])`,
      [Array.from(frontRemoves).sort((a, b) => a - b)]
    );
    counts.sim_weather_fronts = (counts.sim_weather_fronts || 0) + (res.rowCount || 0);
  }
  if (frontCreates.length > 0) {
    const types = frontCreates.map((f) => f.type);
    const xs = frontCreates.map((f) => f.x);
    const ys = frontCreates.map((f) => f.y);
    const dxs = frontCreates.map((f) => f.dx);
    const dys = frontCreates.map((f) => f.dy);
    const radii = frontCreates.map((f) => f.radius);
    const lifetimes = frontCreates.map((f) => f.lifetime);
    const res = await db.query(
      `INSERT INTO sim_weather_fronts (type, x, y, dx, dy, radius, lifetime)
       SELECT unnest($1::text[]), unnest($2::real[]), unnest($3::real[]), unnest($4::real[]),
              unnest($5::real[]), unnest($6::real[]), unnest($7::int[])`,
      [types, xs, ys, dxs, dys, radii, lifetimes]
    );
    counts.sim_weather_fronts = (counts.sim_weather_fronts || 0) + (res.rowCount || 0);
  }

  // 3. sim_chaos_zones
  if (chaosRemoves.length > 0) {
    const uniq = new Map<string, { cellId: number; type: string }>();
    for (const r of chaosRemoves) uniq.set(`${r.cellId}|${r.type}`, { cellId: r.cellId, type: r.type });
    const list = Array.from(uniq.values()).sort((a, b) => a.cellId - b.cellId || a.type.localeCompare(b.type));
    const res = await db.query(
      `DELETE FROM sim_chaos_zones AS z
       USING (SELECT unnest($1::int[]) AS cell_id, unnest($2::text[]) AS type) AS v
       WHERE z.cell_id = v.cell_id AND z.type = v.type`,
      [list.map((v) => v.cellId), list.map((v) => v.type)]
    );
    counts.sim_chaos_zones = (counts.sim_chaos_zones || 0) + (res.rowCount || 0);
  }
  if (chaosUpserts.length > 0) {
    const byKey = new Map<string, { cellId: number; intensity: number; type: string; updateOnConflict: boolean }>();
    for (const z of chaosUpserts) {
      const k = `${z.cellId}|${z.type}`;
      const prev = byKey.get(k);
      byKey.set(k, {
        cellId: z.cellId,
        intensity: z.intensity,
        type: z.type,
        updateOnConflict: Boolean(z.updateOnConflict || prev?.updateOnConflict),
      });
    }
    const vals = Array.from(byKey.values());
    const noUpdate = vals.filter((v) => !v.updateOnConflict);
    const doUpdate = vals.filter((v) => v.updateOnConflict);
    if (noUpdate.length > 0) {
      const res = await db.query(
        `INSERT INTO sim_chaos_zones (cell_id, intensity, type)
         SELECT unnest($1::int[]), unnest($2::real[]), unnest($3::text[])
         ON CONFLICT DO NOTHING`,
        [noUpdate.map((v) => v.cellId), noUpdate.map((v) => v.intensity), noUpdate.map((v) => v.type)]
      );
      counts.sim_chaos_zones = (counts.sim_chaos_zones || 0) + (res.rowCount || 0);
    }
    if (doUpdate.length > 0) {
      const res = await db.query(
        `INSERT INTO sim_chaos_zones (cell_id, intensity, type)
         SELECT unnest($1::int[]), unnest($2::real[]), unnest($3::text[])
         ON CONFLICT (cell_id, type) DO UPDATE SET intensity = EXCLUDED.intensity`,
        [doUpdate.map((v) => v.cellId), doUpdate.map((v) => v.intensity), doUpdate.map((v) => v.type)]
      );
      counts.sim_chaos_zones = (counts.sim_chaos_zones || 0) + (res.rowCount || 0);
    }
  }
  if (chaosAdjusts.length > 0) {
    for (const adj of chaosAdjusts) {
      if (adj.cellId !== undefined) {
        await db.query(
          `UPDATE sim_chaos_zones SET intensity = LEAST(100, GREATEST(0, intensity + $1)) WHERE cell_id = $2`,
          [adj.intensityDelta, adj.cellId]
        );
        if (adj.deleteAtOrBelowZero) {
          await db.query(`DELETE FROM sim_chaos_zones WHERE cell_id = $1 AND intensity <= 0`, [adj.cellId]);
        }
      } else {
        await db.query(
          `UPDATE sim_chaos_zones SET intensity = LEAST(100, GREATEST(0, intensity + $1))`,
          [adj.intensityDelta]
        );
        if (adj.deleteAtOrBelowZero) {
          await db.query(`DELETE FROM sim_chaos_zones WHERE intensity <= 0`);
        }
      }
      counts.sim_chaos_zones = (counts.sim_chaos_zones || 0) + 1;
    }
  }

  // 3b. sim_chaos_flows
  if (chaosFlowUpdates.size > 0) {
    const ids = Array.from(chaosFlowUpdates.keys()).sort((a, b) => a - b);
    const list = ids.map((id) => chaosFlowUpdates.get(id)!);
    const res = await db.query(
      `UPDATE sim_chaos_flows AS f SET
         current_surge = v.surge,
         current_width = v.width,
         waypoints = v.waypoints,
         narrow_spots = v.narrow_spots,
         updated_at = CURRENT_TIMESTAMP
       FROM (
         SELECT unnest($1::int[]) AS flow_id,
                unnest($2::float[]) AS surge,
                unnest($3::float[]) AS width,
                unnest($4::jsonb[]) AS waypoints,
                unnest($5::jsonb[]) AS narrow_spots
       ) AS v
       WHERE f.flow_id = v.flow_id`,
      [
        list.map((r) => r.flowId),
        list.map((r) => r.currentSurge),
        list.map((r) => r.currentWidth),
        list.map((r) => JSON.stringify(r.waypoints)),
        list.map((r) => JSON.stringify(r.narrowSpots)),
      ]
    );
    counts.sim_chaos_flows = (counts.sim_chaos_flows || 0) + (res.rowCount || ids.length);
  }

  // 4. sim_burg_economy (batched unnest with IS DISTINCT FROM)
  if (burgs.size > 0) {
    const ids = Array.from(burgs.keys()).sort((a, b) => a - b);
    const rows = ids.map((id) => burgs.get(id)!);
    const res = await db.query(
      `WITH v AS (
         SELECT
           unnest($1::int[]) AS burg_id,
           unnest($2::boolean[]) AS food_act, unnest($3::boolean[]) AS food_set, unnest($4::float8[]) AS food_base, unnest($5::float8[]) AS food_delta,
           unnest($6::boolean[]) AS wealth_act, unnest($7::boolean[]) AS wealth_set, unnest($8::float8[]) AS wealth_base, unnest($9::float8[]) AS wealth_delta,
           unnest($10::boolean[]) AS unrest_act, unnest($11::boolean[]) AS unrest_set, unnest($12::float8[]) AS unrest_base, unnest($13::float8[]) AS unrest_delta,
           unnest($14::boolean[]) AS health_act, unnest($15::boolean[]) AS health_set, unnest($16::float8[]) AS health_base, unnest($17::float8[]) AS health_delta,
           unnest($18::boolean[]) AS crime_act, unnest($19::boolean[]) AS crime_set, unnest($20::float8[]) AS crime_base, unnest($21::float8[]) AS crime_delta,
           unnest($22::boolean[]) AS raw_act, unnest($23::boolean[]) AS raw_set, unnest($24::float8[]) AS raw_base, unnest($25::float8[]) AS raw_delta,
           unnest($26::boolean[]) AS popn_act, unnest($27::boolean[]) AS popn_set, unnest($28::float8[]) AS popn_base, unnest($29::float8[]) AS popn_delta,
           unnest($30::boolean[]) AS popa_act, unnest($31::boolean[]) AS popa_set, unnest($32::float8[]) AS popa_base, unnest($33::float8[]) AS popa_delta,
           unnest($34::boolean[]) AS tier_set, unnest($35::int[]) AS tier_val,
           unnest($36::boolean[]) AS occ_set, unnest($37::int[]) AS occ_val,
           unnest($38::boolean[]) AS name_set, unnest($39::text[]) AS name_val,
           unnest($40::boolean[]) AS ref_act, unnest($41::boolean[]) AS ref_set, unnest($42::float8[]) AS ref_base, unnest($43::float8[]) AS ref_delta,
           unnest($44::boolean[]) AS mil_set, unnest($45::text[]) AS mil_val,
           unnest($46::boolean[]) AS ot_set, unnest($47::int[]) AS ot_val,
           unnest($48::boolean[]) AS rs_set, unnest($49::int[]) AS rs_val
       ),
       computed AS (
         SELECT
           b.burg_id,
           CASE WHEN v.food_act THEN GREATEST(0, ROUND((CASE WHEN v.food_set THEN v.food_base + v.food_delta ELSE COALESCE(b.food, 0) + v.food_delta END)::numeric))::int ELSE b.food END AS next_food,
           CASE WHEN v.wealth_act THEN GREATEST(0, ROUND((CASE WHEN v.wealth_set THEN v.wealth_base + v.wealth_delta ELSE COALESCE(b.wealth, 0) + v.wealth_delta END)::numeric))::int ELSE b.wealth END AS next_wealth,
           CASE WHEN v.unrest_act THEN LEAST(100, GREATEST(0, ROUND((CASE WHEN v.unrest_set THEN v.unrest_base + v.unrest_delta ELSE COALESCE(b.unrest, 0) + v.unrest_delta END)::numeric)))::int ELSE b.unrest END AS next_unrest,
           CASE WHEN v.health_act THEN LEAST(100, GREATEST(0, ROUND((CASE WHEN v.health_set THEN v.health_base + v.health_delta ELSE COALESCE(b.health, 90) + v.health_delta END)::numeric)))::int ELSE b.health END AS next_health,
           CASE WHEN v.crime_act THEN LEAST(100.0, GREATEST(0.0, CASE WHEN v.crime_set THEN v.crime_base + v.crime_delta ELSE COALESCE(b.crime_rate, 0) + v.crime_delta END))::real ELSE b.crime_rate END AS next_crime,
           CASE WHEN v.raw_act THEN GREATEST(0, ROUND((CASE WHEN v.raw_set THEN v.raw_base + v.raw_delta ELSE COALESCE(b.raw_materials, 0) + v.raw_delta END)::numeric))::int ELSE b.raw_materials END AS next_raw,
           CASE WHEN v.ref_act THEN GREATEST(0, ROUND((CASE WHEN v.ref_set THEN v.ref_base + v.ref_delta ELSE COALESCE(b.refined_goods, 0) + v.ref_delta END)::numeric))::int ELSE b.refined_goods END AS next_refined,
           CASE WHEN v.popn_act THEN GREATEST(0, ROUND((CASE WHEN v.popn_set THEN v.popn_base + v.popn_delta ELSE COALESCE(b.pop_null, 0) + v.popn_delta END)::numeric))::int ELSE b.pop_null END AS next_pop_null,
           CASE WHEN v.popa_act THEN GREATEST(0, ROUND((CASE WHEN v.popa_set THEN v.popa_base + v.popa_delta ELSE COALESCE(b.pop_attuned, 0) + v.popa_delta END)::numeric))::int ELSE b.pop_attuned END AS next_pop_attuned,
           CASE WHEN v.tier_set THEN GREATEST(0, v.tier_val) ELSE b.urban_tier END AS next_tier,
           CASE WHEN v.occ_set THEN v.occ_val ELSE b.occupier_faction_id END AS next_occ,
           CASE WHEN v.name_set THEN v.name_val ELSE b.name END AS next_name,
           CASE WHEN v.mil_set THEN v.mil_val ELSE b.military_forces END AS next_mil,
           CASE WHEN v.ot_set THEN GREATEST(0, v.ot_val) ELSE b.occupation_ticks END AS next_ot,
           CASE WHEN v.rs_set THEN GREATEST(0, v.rs_val) ELSE b.resistance_strength END AS next_rs
         FROM v
         JOIN sim_burg_economy b ON b.burg_id = v.burg_id
       )
       UPDATE sim_burg_economy b SET
         food = u.next_food,
         wealth = u.next_wealth,
         unrest = u.next_unrest,
         health = u.next_health,
         crime_rate = u.next_crime,
         raw_materials = u.next_raw,
         refined_goods = u.next_refined,
         pop_null = u.next_pop_null,
         pop_attuned = u.next_pop_attuned,
         urban_tier = u.next_tier,
         occupier_faction_id = u.next_occ,
         name = u.next_name,
         military_forces = u.next_mil,
         occupation_ticks = u.next_ot,
         resistance_strength = u.next_rs
       FROM computed u
       WHERE b.burg_id = u.burg_id
         AND (
           b.food IS DISTINCT FROM u.next_food OR
           b.wealth IS DISTINCT FROM u.next_wealth OR
           b.unrest IS DISTINCT FROM u.next_unrest OR
           b.health IS DISTINCT FROM u.next_health OR
           b.crime_rate IS DISTINCT FROM u.next_crime OR
           b.raw_materials IS DISTINCT FROM u.next_raw OR
           b.refined_goods IS DISTINCT FROM u.next_refined OR
           b.pop_null IS DISTINCT FROM u.next_pop_null OR
           b.pop_attuned IS DISTINCT FROM u.next_pop_attuned OR
           b.urban_tier IS DISTINCT FROM u.next_tier OR
           b.occupier_faction_id IS DISTINCT FROM u.next_occ OR
           b.name IS DISTINCT FROM u.next_name OR
           b.military_forces IS DISTINCT FROM u.next_mil OR
           b.occupation_ticks IS DISTINCT FROM u.next_ot OR
           b.resistance_strength IS DISTINCT FROM u.next_rs
         )`,
      [
        ids,
        rows.map((r) => numActive(r.food)), rows.map((r) => r.food.hasSet), rows.map((r) => r.food.setVal), rows.map((r) => r.food.delta),
        rows.map((r) => numActive(r.wealth)), rows.map((r) => r.wealth.hasSet), rows.map((r) => r.wealth.setVal), rows.map((r) => r.wealth.delta),
        rows.map((r) => numActive(r.unrest)), rows.map((r) => r.unrest.hasSet), rows.map((r) => r.unrest.setVal), rows.map((r) => r.unrest.delta),
        rows.map((r) => numActive(r.health)), rows.map((r) => r.health.hasSet), rows.map((r) => r.health.setVal), rows.map((r) => r.health.delta),
        rows.map((r) => numActive(r.crimeRate)), rows.map((r) => r.crimeRate.hasSet), rows.map((r) => r.crimeRate.setVal), rows.map((r) => r.crimeRate.delta),
        rows.map((r) => numActive(r.rawMaterials)), rows.map((r) => r.rawMaterials.hasSet), rows.map((r) => r.rawMaterials.setVal), rows.map((r) => r.rawMaterials.delta),
        rows.map((r) => numActive(r.popNull)), rows.map((r) => r.popNull.hasSet), rows.map((r) => r.popNull.setVal), rows.map((r) => r.popNull.delta),
        rows.map((r) => numActive(r.popAttuned)), rows.map((r) => r.popAttuned.hasSet), rows.map((r) => r.popAttuned.setVal), rows.map((r) => r.popAttuned.delta),
        rows.map((r) => r.urbanTierSet), rows.map((r) => r.urbanTierVal),
        rows.map((r) => r.occSet), rows.map((r) => r.occVal),
        rows.map((r) => r.nameSet), rows.map((r) => r.nameVal),
        rows.map((r) => numActive(r.refinedGoods)), rows.map((r) => r.refinedGoods.hasSet), rows.map((r) => r.refinedGoods.setVal), rows.map((r) => r.refinedGoods.delta),
        rows.map((r) => r.milSet), rows.map((r) => r.milVal),
        rows.map((r) => r.occTicksSet), rows.map((r) => r.occTicksVal),
        rows.map((r) => r.resSet), rows.map((r) => r.resVal),
      ]
    );
    counts.sim_burg_economy = res.rowCount || 0;
  }

  // 5. sim_cells (batched unnest with IS DISTINCT FROM so untouched rows keep xmin)
  if (cells.size > 0) {
    const ids = Array.from(cells.keys()).sort((a, b) => a - b);
    const rows = ids.map((id) => cells.get(id)!);
    const res = await db.query(
      `WITH v AS (
         SELECT
           unnest($1::int[]) AS id,
           unnest($2::boolean[]) AS em_act, unnest($3::boolean[]) AS em_set, unnest($4::float8[]) AS em_base, unnest($5::float8[]) AS em_delta,
           unnest($6::boolean[]) AS eh_act, unnest($7::boolean[]) AS eh_set, unnest($8::float8[]) AS eh_base, unnest($9::float8[]) AS eh_delta,
           unnest($10::boolean[]) AS ep_act, unnest($11::boolean[]) AS ep_set, unnest($12::float8[]) AS ep_base, unnest($13::float8[]) AS ep_delta,
           unnest($14::boolean[]) AS py_act, unnest($15::boolean[]) AS py_set, unnest($16::float8[]) AS py_base, unnest($17::float8[]) AS py_delta,
           unnest($18::boolean[]) AS pd_act, unnest($19::boolean[]) AS pd_set, unnest($20::float8[]) AS pd_base, unnest($21::float8[]) AS pd_delta,
           unnest($22::boolean[]) AS ax_act, unnest($23::boolean[]) AS ax_set, unnest($24::float8[]) AS ax_base, unnest($25::float8[]) AS ax_delta,
           unnest($26::boolean[]) AS bl_act, unnest($27::boolean[]) AS bl_set, unnest($28::float8[]) AS bl_base, unnest($29::float8[]) AS bl_delta,
           unnest($30::boolean[]) AS tm_act, unnest($31::boolean[]) AS tm_set, unnest($32::float8[]) AS tm_base, unnest($33::float8[]) AS tm_delta,
           unnest($34::boolean[]) AS cu_set, unnest($35::int[]) AS cu_val,
           unnest($36::boolean[]) AS re_set, unnest($37::int[]) AS re_val
       ),
       em_calc AS (
         SELECT
           v.*,
           c.eco_max AS old_em, c.eco_health AS old_eh, c.eco_plants AS old_ep,
           c.eco_prey AS old_py, c.eco_predators AS old_pd, c.eco_apex AS old_ax,
           c.eco_blight AS old_bl, c.current_temp AS old_tm, c.culture_id AS old_cu, c.religion_id AS old_re,
           CASE WHEN v.em_act THEN GREATEST(10.0, CASE WHEN v.em_set THEN v.em_base + v.em_delta ELSE COALESCE(c.eco_max, 100.0) + v.em_delta END) ELSE c.eco_max END AS next_em
         FROM v
         JOIN sim_cells c ON c.id = v.id
       ),
       computed AS (
         SELECT
           e.id,
           e.next_em,
           CASE WHEN e.eh_act THEN LEAST(COALESCE(e.next_em, 100.0), GREATEST(0.0, CASE WHEN e.eh_set THEN e.eh_base + e.eh_delta ELSE COALESCE(e.old_eh, 100.0) + e.eh_delta END)) ELSE e.old_eh END AS next_eh,
           CASE WHEN e.ep_act THEN LEAST(200.0, GREATEST(0.0, CASE WHEN e.ep_set THEN e.ep_base + e.ep_delta ELSE COALESCE(e.old_ep, 50.0) + e.ep_delta END))::real ELSE e.old_ep END AS next_ep,
           CASE WHEN e.py_act THEN LEAST(100.0, GREATEST(0.0, CASE WHEN e.py_set THEN e.py_base + e.py_delta ELSE COALESCE(e.old_py, 50.0) + e.py_delta END))::real ELSE e.old_py END AS next_py,
           CASE WHEN e.pd_act THEN LEAST(60.0, GREATEST(0.0, CASE WHEN e.pd_set THEN e.pd_base + e.pd_delta ELSE COALESCE(e.old_pd, 10.0) + e.pd_delta END))::real ELSE e.old_pd END AS next_pd,
           CASE WHEN e.ax_act THEN LEAST(100.0, GREATEST(0.0, CASE WHEN e.ax_set THEN e.ax_base + e.ax_delta ELSE COALESCE(e.old_ax, 5.0) + e.ax_delta END))::real ELSE e.old_ax END AS next_ax,
           CASE WHEN e.bl_act THEN LEAST(100.0, GREATEST(0.0, CASE WHEN e.bl_set THEN e.bl_base + e.bl_delta ELSE COALESCE(e.old_bl, 0.0) + e.bl_delta END))::real ELSE e.old_bl END AS next_bl,
           CASE WHEN e.tm_act THEN (CASE WHEN e.tm_set THEN e.tm_base + e.tm_delta ELSE COALESCE(e.old_tm, 15.0) + e.tm_delta END)::real ELSE e.old_tm END AS next_tm,
           CASE WHEN e.cu_set THEN e.cu_val ELSE e.old_cu END AS next_cu,
           CASE WHEN e.re_set THEN e.re_val ELSE e.old_re END AS next_re
         FROM em_calc e
       )
       UPDATE sim_cells c SET
         eco_max = u.next_em,
         eco_health = u.next_eh,
         eco_plants = u.next_ep,
         eco_prey = u.next_py,
         eco_predators = u.next_pd,
         eco_apex = u.next_ax,
         eco_blight = u.next_bl,
         current_temp = u.next_tm,
         culture_id = u.next_cu,
         religion_id = u.next_re
       FROM computed u
       WHERE c.id = u.id
         AND (
           c.eco_max IS DISTINCT FROM u.next_em OR
           c.eco_health IS DISTINCT FROM u.next_eh OR
           c.eco_plants IS DISTINCT FROM u.next_ep OR
           c.eco_prey IS DISTINCT FROM u.next_py OR
           c.eco_predators IS DISTINCT FROM u.next_pd OR
           c.eco_apex IS DISTINCT FROM u.next_ax OR
           c.eco_blight IS DISTINCT FROM u.next_bl OR
           c.current_temp IS DISTINCT FROM u.next_tm OR
           c.culture_id IS DISTINCT FROM u.next_cu OR
           c.religion_id IS DISTINCT FROM u.next_re
         )`,
      [
        ids,
        rows.map((r) => numActive(r.ecoMax)), rows.map((r) => r.ecoMax.hasSet), rows.map((r) => r.ecoMax.setVal), rows.map((r) => r.ecoMax.delta),
        rows.map((r) => numActive(r.ecoHealth)), rows.map((r) => r.ecoHealth.hasSet), rows.map((r) => r.ecoHealth.setVal), rows.map((r) => r.ecoHealth.delta),
        rows.map((r) => numActive(r.ecoPlants)), rows.map((r) => r.ecoPlants.hasSet), rows.map((r) => r.ecoPlants.setVal), rows.map((r) => r.ecoPlants.delta),
        rows.map((r) => numActive(r.ecoPrey)), rows.map((r) => r.ecoPrey.hasSet), rows.map((r) => r.ecoPrey.setVal), rows.map((r) => r.ecoPrey.delta),
        rows.map((r) => numActive(r.ecoPredators)), rows.map((r) => r.ecoPredators.hasSet), rows.map((r) => r.ecoPredators.setVal), rows.map((r) => r.ecoPredators.delta),
        rows.map((r) => numActive(r.ecoApex)), rows.map((r) => r.ecoApex.hasSet), rows.map((r) => r.ecoApex.setVal), rows.map((r) => r.ecoApex.delta),
        rows.map((r) => numActive(r.ecoBlight)), rows.map((r) => r.ecoBlight.hasSet), rows.map((r) => r.ecoBlight.setVal), rows.map((r) => r.ecoBlight.delta),
        rows.map((r) => numActive(r.currentTemp)), rows.map((r) => r.currentTemp.hasSet), rows.map((r) => r.currentTemp.setVal), rows.map((r) => r.currentTemp.delta),
        rows.map((r) => r.cultureSet), rows.map((r) => r.cultureVal),
        rows.map((r) => r.religionSet), rows.map((r) => r.religionVal),
      ]
    );
    counts.sim_cells = (counts.sim_cells || 0) + (res.rowCount || 0);
  }

  if (endWarFactions.size > 0) {
    const fids = Array.from(endWarFactions).sort((a, b) => a - b);
    const res = await db.query(
      `UPDATE sim_diplomacy SET status = 'PEACE', tension = 0
       WHERE (faction_a_id = ANY($1::int[]) OR faction_b_id = ANY($1::int[])) AND status = 'WAR'`,
      [fids]
    );
    counts.sim_diplomacy = (counts.sim_diplomacy || 0) + (res.rowCount || 0);
  }

  if (cellFactions.size > 0) {
    const ids = Array.from(cellFactions.keys()).sort((a, b) => a - b);
    const fids = ids.map((id) => cellFactions.get(id) ?? null);
    const res = await db.query(
      `UPDATE sim_cells c SET faction_id = v.faction_id
       FROM (SELECT unnest($1::int[]) AS id, unnest($2::int[]) AS faction_id) v
       WHERE c.id = v.id AND c.faction_id IS DISTINCT FROM v.faction_id`,
      [ids, fids]
    );
    counts.sim_cells = (counts.sim_cells || 0) + (res.rowCount || 0);
  }

  // 6. population_demographics (statuses, moves, direct tags, burg-sampled tags)
  if (citizenStatuses.size > 0) {
    const ids = Array.from(citizenStatuses.keys()).sort((a, b) => a - b);
    const res = await db.query(
      `UPDATE population_demographics p SET
         allegiance_status = v.status,
         cause_of_death = COALESCE(v.cause, p.cause_of_death),
         motivation = COALESCE(v.motivation, p.motivation)
       FROM (
         SELECT unnest($1::int[]) AS citizen_id, unnest($2::text[]) AS status,
                unnest($3::text[]) AS cause, unnest($4::text[]) AS motivation
       ) v
       WHERE p.citizen_id = v.citizen_id`,
      [
        ids,
        ids.map((id) => citizenStatuses.get(id)!.status),
        ids.map((id) => citizenStatuses.get(id)!.cause),
        ids.map((id) => citizenStatuses.get(id)!.motivation),
      ]
    );
    counts.population_demographics = (counts.population_demographics || 0) + (res.rowCount || 0);
    const deceasedRefs = ids.filter((id) => citizenStatuses.get(id)!.status === "DECEASED").map((id) => `citizen:${id}`);
    if (deceasedRefs.length > 0) {
      await markEntitiesDeadBatch(db, deceasedRefs, 0);
    }
  }

  if (citizenMoves.size > 0) {
    const ids = Array.from(citizenMoves.keys()).sort((a, b) => a - b);
    const res = await db.query(
      `UPDATE population_demographics p SET
         settlement_id = v.settlement_id,
         home_cell_id = v.home_cell_id
       FROM (
         SELECT unnest($1::int[]) AS citizen_id, unnest($2::int[]) AS settlement_id, unnest($3::int[]) AS home_cell_id
       ) v
       WHERE p.citizen_id = v.citizen_id`,
      [
        ids,
        ids.map((id) => citizenMoves.get(id)!.settlementId),
        ids.map((id) => citizenMoves.get(id)!.homeCellId),
      ]
    );
    counts.population_demographics = (counts.population_demographics || 0) + (res.rowCount || 0);
  }

  if (citizenTags.length > 0) {
    const byCit = new Map<number, { tags: Set<string>; temper: string | null; motivation: string | null }>();
    for (const ct of citizenTags) {
      let cur = byCit.get(ct.citizenId);
      if (!cur) {
        cur = { tags: new Set<string>(), temper: ct.temper, motivation: ct.motivation };
        byCit.set(ct.citizenId, cur);
      }
      for (const t of ct.tags) cur.tags.add(t);
      if (ct.temper) cur.temper = ct.temper;
      if (ct.motivation) cur.motivation = ct.motivation;
    }
    const ids = Array.from(byCit.keys()).sort((a, b) => a - b);
    const res = await db.query(
      `UPDATE population_demographics p SET
         traits = (
           SELECT COALESCE(jsonb_agg(DISTINCT elem ORDER BY elem), '[]'::jsonb)
           FROM (
             SELECT jsonb_array_elements_text(COALESCE(p.traits, '[]'::jsonb)) AS elem
             UNION
             SELECT jsonb_array_elements_text(v.tags) AS elem
           ) t
         ),
         temper = COALESCE(v.temper, p.temper),
         motivation = COALESCE(v.motivation, p.motivation)
       FROM (
         SELECT unnest($1::int[]) AS citizen_id, unnest($2::jsonb[]) AS tags,
                unnest($3::text[]) AS temper, unnest($4::text[]) AS motivation
       ) v
       WHERE p.citizen_id = v.citizen_id`,
      [
        ids,
        ids.map((id) => JSON.stringify(Array.from(byCit.get(id)!.tags))),
        ids.map((id) => byCit.get(id)!.temper),
        ids.map((id) => byCit.get(id)!.motivation),
      ]
    );
    counts.population_demographics = (counts.population_demographics || 0) + (res.rowCount || 0);
  }

  for (const tb of citizenTagBurgs) {
    const res = await db.query(
      `UPDATE population_demographics
       SET traits = (
           SELECT jsonb_agg(DISTINCT elem)
           FROM (
               SELECT jsonb_array_elements_text(COALESCE(traits, '[]'::jsonb)) AS elem
               UNION
               SELECT jsonb_array_elements_text($1::jsonb) AS elem
           ) t
       ),
       temper = COALESCE($2, temper),
       motivation = COALESCE($3, motivation)
       WHERE citizen_id IN (
           WITH bounds AS (
               SELECT MIN(citizen_id) AS lo, MAX(citizen_id) AS hi FROM population_demographics
               WHERE settlement_id = $4 AND allegiance_status = 'CIVILIAN'
           ), start AS (SELECT lo + floor((hi - lo + 1) * $7::float)::int AS at FROM bounds)
           SELECT citizen_id FROM (
               (SELECT citizen_id, 0 AS lap FROM population_demographics
                WHERE settlement_id = $4 AND allegiance_status = 'CIVILIAN' AND citizen_id >= (SELECT at FROM start)
                  AND ($5::text IS NULL OR profession ILIKE $5)
                ORDER BY citizen_id LIMIT $6)
               UNION ALL
               (SELECT citizen_id, 1 AS lap FROM population_demographics
                WHERE settlement_id = $4 AND allegiance_status = 'CIVILIAN' AND citizen_id < (SELECT at FROM start)
                  AND ($5::text IS NULL OR profession ILIKE $5)
                ORDER BY citizen_id LIMIT $6)
           ) picks ORDER BY lap, citizen_id LIMIT $6
       )`,
      [
        JSON.stringify(tb.tags),
        tb.temper ?? null,
        tb.motivation ?? null,
        tb.burgId,
        tb.professionFilter ?? null,
        tb.limit ?? 4,
        tb.randomSeed,
      ]
    );
    counts.population_demographics = (counts.population_demographics || 0) + (res.rowCount || 0);
  }

  // 7. sim_agents
  if (agentCreates.length > 0) {
    const res = await db.query(
      `INSERT INTO sim_agents (
         name, role, sub_role, location_cell_id, target_cell_id, target_grove_id,
         home_burg_id, faction_id, state, corruption, drained_power, age_ticks, active_plot,
         citizen_name, profession, species, spark_tier, personality_temper, personality_instinct, motivation
       )
       SELECT
         unnest($1::text[]), unnest($2::text[]), unnest($3::text[]),
         unnest($4::int[]), unnest($5::int[]), unnest($6::int[]),
         unnest($7::int[]), unnest($8::int[]), unnest($9::text[]),
         unnest($10::int[]), unnest($11::real[]), unnest($12::int[]), unnest($13::text[]),
         unnest($14::text[]), unnest($15::text[]), unnest($16::text[]), unnest($17::text[]),
         unnest($18::text[]), unnest($19::text[]), unnest($20::text[])
       RETURNING id`,
      [
        agentCreates.map((c) => c.name),
        agentCreates.map((c) => c.role),
        agentCreates.map((c) => c.subRole ?? null),
        agentCreates.map((c) => c.locationCellId),
        agentCreates.map((c) => c.targetCellId ?? null),
        agentCreates.map((c) => c.targetGroveId ?? null),
        agentCreates.map((c) => c.homeBurgId ?? null),
        agentCreates.map((c) => c.factionId ?? null),
        agentCreates.map((c) => c.state),
        agentCreates.map((c) => Math.round(c.corruption ?? 0)),
        agentCreates.map((c) => c.drainedPower ?? 0),
        agentCreates.map((c) => Math.round(c.ageTicks ?? 0)),
        agentCreates.map((c) => c.activePlot ?? null),
        agentCreates.map((c) => c.citizenName ?? null),
        agentCreates.map((c) => c.profession ?? null),
        agentCreates.map((c) => c.species ?? null),
        agentCreates.map((c) => c.sparkTier ?? null),
        agentCreates.map((c) => c.personalityTemper ?? null),
        agentCreates.map((c) => c.personalityInstinct ?? null),
        agentCreates.map((c) => c.motivation ?? null),
      ]
    );
    counts.sim_agents = (counts.sim_agents || 0) + (res.rowCount || 0);
    const entityEntries: UpsertEntityInput[] = [];
    for (let idx = 0; idx < res.rows.length; idx++) {
      const id = Number(res.rows[idx]?.id);
      const spec = agentCreates[idx];
      if (!id || !spec) continue;
      entityEntries.push({
        ref: `agent:${id}`,
        kind: "person",
        name: spec.name,
        alive: true,
        lod: "macro",
        cellId: spec.locationCellId,
        sourceTable: "sim_agents",
        sourceId: String(id),
        createdTick: spec.createdTick ?? 0,
      });
    }
    if (entityEntries.length > 0) {
      counts.entities = (counts.entities || 0) + (await upsertEntitiesBatch(db, entityEntries));
    }
  }
  if (agentUpdates.size > 0) {
    const ids = Array.from(agentUpdates.keys()).sort((a, b) => a - b);
    const fields = ids.map((id) => agentUpdates.get(id)!);
    const res = await db.query(
      `UPDATE sim_agents a SET
         location_cell_id = CASE WHEN v.loc_set THEN v.loc_val ELSE a.location_cell_id END,
         target_cell_id = CASE WHEN v.tgt_set THEN v.tgt_val ELSE a.target_cell_id END,
         state = CASE WHEN v.st_set THEN v.st_val ELSE a.state END,
         corruption = CASE WHEN v.cor_set THEN v.cor_val ELSE a.corruption END,
         drained_power = CASE WHEN v.dp_set THEN v.dp_val ELSE a.drained_power END,
         active_plot = CASE WHEN v.ap_set THEN v.ap_val ELSE a.active_plot END,
         age_ticks = CASE WHEN v.age_set THEN v.age_val ELSE a.age_ticks END,
         target_grove_id = CASE WHEN v.tg_set THEN v.tg_val ELSE a.target_grove_id END,
         sub_role = CASE WHEN v.sr_set THEN v.sr_val ELSE a.sub_role END,
         spark_tier = CASE WHEN v.spk_set THEN v.spk_val ELSE a.spark_tier END
       FROM (
         SELECT
           unnest($1::int[]) AS id,
           unnest($2::boolean[]) AS loc_set, unnest($3::int[]) AS loc_val,
           unnest($4::boolean[]) AS tgt_set, unnest($5::int[]) AS tgt_val,
           unnest($6::boolean[]) AS st_set, unnest($7::text[]) AS st_val,
           unnest($8::boolean[]) AS cor_set, unnest($9::int[]) AS cor_val,
           unnest($10::boolean[]) AS dp_set, unnest($11::real[]) AS dp_val,
           unnest($12::boolean[]) AS ap_set, unnest($13::text[]) AS ap_val,
           unnest($14::boolean[]) AS age_set, unnest($15::int[]) AS age_val,
           unnest($16::boolean[]) AS tg_set, unnest($17::int[]) AS tg_val,
           unnest($18::boolean[]) AS sr_set, unnest($19::text[]) AS sr_val,
           unnest($20::boolean[]) AS spk_set, unnest($21::text[]) AS spk_val
       ) v
       WHERE a.id = v.id`,
      [
        ids,
        fields.map((f) => f.location_cell_id !== undefined), fields.map((f) => f.location_cell_id ?? null),
        fields.map((f) => f.target_cell_id !== undefined), fields.map((f) => f.target_cell_id ?? null),
        fields.map((f) => f.state !== undefined), fields.map((f) => f.state ?? null),
        fields.map((f) => f.corruption !== undefined), fields.map((f) => f.corruption ?? null),
        fields.map((f) => f.drained_power !== undefined), fields.map((f) => f.drained_power ?? null),
        fields.map((f) => f.active_plot !== undefined), fields.map((f) => f.active_plot ?? null),
        fields.map((f) => f.age_ticks !== undefined), fields.map((f) => f.age_ticks ?? null),
        fields.map((f) => f.target_grove_id !== undefined), fields.map((f) => f.target_grove_id ?? null),
        fields.map((f) => f.sub_role !== undefined), fields.map((f) => f.sub_role ?? null),
        fields.map((f) => f.spark_tier !== undefined), fields.map((f) => f.spark_tier ?? null),
      ]
    );
    counts.sim_agents = (counts.sim_agents || 0) + (res.rowCount || 0);
  }
  if (agentRemovals.size > 0) {
    const rmIds = Array.from(agentRemovals.keys()).sort((a, b) => a - b);
    const res = await db.query(
      `DELETE FROM sim_agents WHERE id = ANY($1::int[])`,
      [rmIds]
    );
    counts.sim_agents = (counts.sim_agents || 0) + (res.rowCount || 0);
    const refsByTick = new Map<number, string[]>();
    for (const id of rmIds) {
      const dt = agentRemovals.get(id) ?? 0;
      let arr = refsByTick.get(dt);
      if (!arr) { arr = []; refsByTick.set(dt, arr); }
      arr.push(`agent:${id}`);
    }
    for (const dt of Array.from(refsByTick.keys()).sort((a, b) => a - b)) {
      await markEntitiesDeadBatch(db, refsByTick.get(dt)!, dt);
    }
  }

  // 8. sim_cell_tags
  for (const [zLayer, entries] of cellTagRemovesByLayer.entries()) {
    await removeCellTagsBatch(db, entries, zLayer);
    counts.sim_cell_tags = (counts.sim_cell_tags || 0) + entries.length;
  }
  for (const [zLayer, entries] of cellTagsByLayer.entries()) {
    await addCellTagsBatch(db, entries, zLayer);
    counts.sim_cell_tags = (counts.sim_cell_tags || 0) + entries.length;
  }

  // 9. sim_events (multi-row unnest insert)
  if (events.length > 0) {
    const res = await db.query(
      `INSERT INTO sim_events (tick, type, message, tier, lore_date, burg_id, cell_id, faction_id, outlaw_id, z_layer)
       SELECT
         unnest($1::int[]),
         unnest($2::text[]),
         unnest($3::text[]),
         unnest($4::text[]),
         unnest($5::text[]),
         unnest($6::int[]),
         unnest($7::int[]),
         unnest($8::int[]),
         unnest($9::int[]),
         unnest($10::int[])`,
      [
        events.map((e) => e.tick),
        events.map((e) => e.type),
        events.map((e) => e.message),
        events.map((e) => e.tier),
        events.map((e) => e.loreDate ?? null),
        events.map((e) => e.burgId ?? null),
        events.map((e) => e.cellId ?? null),
        events.map((e) => e.factionId ?? null),
        events.map((e) => e.outlawId ?? null),
        events.map((e) => e.zLayer ?? 0),
      ]
    );
    counts.sim_events = res.rowCount || events.length;
  }

  // 10. sim_threads
  for (const t of threads) {
    if (!t.bestEffort) {
      await createThread(db as any, t.spec);
      counts.sim_threads = (counts.sim_threads || 0) + 1;
      continue;
    }
    let savepoint = true;
    try { await db.query("SAVEPOINT bd_thread"); } catch { savepoint = false; }
    try {
      await createThread(db as any, t.spec);
      if (savepoint) await db.query("RELEASE SAVEPOINT bd_thread");
      counts.sim_threads = (counts.sim_threads || 0) + 1;
    } catch (err: any) {
      if (savepoint) await db.query("ROLLBACK TO SAVEPOINT bd_thread").catch(() => {});
      console.warn(`[Background Director] Could not open thread: ${err?.message || err}`);
    }
  }

  // 11. scheduled_events
  if (scheduled.length > 0) {
    const res = await db.query(
      `INSERT INTO scheduled_events (due_tick, due_minute, kind, payload, created_tick)
       SELECT unnest($1::int[]), unnest($2::int[]), unnest($3::text[]), unnest($4::jsonb[]), unnest($5::int[])`,
      [
        scheduled.map((s) => s.at.tick),
        scheduled.map((s) => s.at.minute ?? 0),
        scheduled.map((s) => s.event.kind),
        scheduled.map((s) => JSON.stringify(s.event.payload ?? {})),
        scheduled.map((s) => s.at.tick),
      ]
    );
    counts.scheduled_events = res.rowCount || scheduled.length;
  }

  // 12. citizen.killOne (decrement unit_size > 1 & burg pop; or mark DECEASED when unit_size <= 1)
  if (citizenKillOnes.length > 0) {
    const cids = Array.from(new Set(citizenKillOnes.map((k) => k.citizenId))).sort((a, b) => a - b);
    const curRes = await db.query(
      `SELECT citizen_id, settlement_id, unit_size, is_null, allegiance_status
       FROM population_demographics
       WHERE citizen_id = ANY($1::int[])
       ORDER BY citizen_id`,
      [cids]
    );
    const state = new Map<number, {
      unitSize: number;
      settlementId: number | null;
      isNull: boolean;
      status: string;
      cause: string | null;
      diedTick: number;
    }>();
    for (const r of curRes.rows) {
      state.set(Number(r.citizen_id), {
        unitSize: Math.max(1, Number(r.unit_size || 1)),
        settlementId: r.settlement_id !== null && r.settlement_id !== undefined ? Number(r.settlement_id) : null,
        isNull: Boolean(r.is_null),
        status: String(r.allegiance_status || "").toUpperCase(),
        cause: null,
        diedTick: 0,
      });
    }

    const sizeChanged = new Set<number>();
    const newlyDeceased = new Set<number>();
    const burgPopDecr = new Map<number, { dn: number; da: number }>();

    for (const k of citizenKillOnes) {
      const st = state.get(k.citizenId);
      if (!st || st.status === "DECEASED") continue;
      if (st.unitSize > 1) {
        st.unitSize -= 1;
        sizeChanged.add(k.citizenId);
      } else {
        st.status = "DECEASED";
        st.cause = k.cause;
        st.diedTick = k.diedTick;
        newlyDeceased.add(k.citizenId);
      }
      if (st.settlementId && st.settlementId > 0) {
        let bDecr = burgPopDecr.get(st.settlementId);
        if (!bDecr) {
          bDecr = { dn: 0, da: 0 };
          burgPopDecr.set(st.settlementId, bDecr);
        }
        if (st.isNull) bDecr.dn += 1;
        else bDecr.da += 1;
      }
    }

    const sizeOnlyIds = Array.from(sizeChanged).filter((id) => !newlyDeceased.has(id)).sort((a, b) => a - b);
    if (sizeOnlyIds.length > 0) {
      const res = await db.query(
        `UPDATE population_demographics p SET unit_size = v.unit_size
         FROM (SELECT unnest($1::int[]) AS citizen_id, unnest($2::int[]) AS unit_size) v
         WHERE p.citizen_id = v.citizen_id`,
        [sizeOnlyIds, sizeOnlyIds.map((id) => state.get(id)!.unitSize)]
      );
      counts.population_demographics = (counts.population_demographics || 0) + (res.rowCount || 0);
    }

    const deadIds = Array.from(newlyDeceased).sort((a, b) => a - b);
    if (deadIds.length > 0) {
      const res = await db.query(
        `UPDATE population_demographics p SET
           allegiance_status = 'DECEASED',
           cause_of_death = COALESCE(v.cause, p.cause_of_death)
         FROM (SELECT unnest($1::int[]) AS citizen_id, unnest($2::text[]) AS cause) v
         WHERE p.citizen_id = v.citizen_id`,
        [deadIds, deadIds.map((id) => state.get(id)!.cause)]
      );
      counts.population_demographics = (counts.population_demographics || 0) + (res.rowCount || 0);
      for (const id of deadIds) {
        entityDeaths.push({ ref: `citizen:${id}`, diedTick: state.get(id)!.diedTick });
      }
    }

    if (burgPopDecr.size > 0) {
      const bids = Array.from(burgPopDecr.keys()).sort((a, b) => a - b);
      const res = await db.query(
        `UPDATE sim_burg_economy b SET
           pop_null = GREATEST(0, COALESCE(b.pop_null, 0) - v.dn),
           pop_attuned = GREATEST(0, COALESCE(b.pop_attuned, 0) - v.da)
         FROM (SELECT unnest($1::int[]) AS burg_id, unnest($2::int[]) AS dn, unnest($3::int[]) AS da) v
         WHERE b.burg_id = v.burg_id`,
        [bids, bids.map((id) => burgPopDecr.get(id)!.dn), bids.map((id) => burgPopDecr.get(id)!.da)]
      );
      counts.sim_burg_economy = (counts.sim_burg_economy || 0) + (res.rowCount || 0);
    }
  }

  // 13. paragon.die
  if (paragonDies.length > 0) {
    const pids = Array.from(new Set(paragonDies.map((p) => p.paragonId))).sort((a, b) => a - b);
    const res = await db.query(`DELETE FROM sim_paragons WHERE id = ANY($1::int[])`, [pids]);
    counts.sim_paragons = (counts.sim_paragons || 0) + (res.rowCount || 0);
  }

  // 14. burg.militaryAdjust (military_forces is TEXT storing JSON)
  if (burgMilAdjusts.length > 0) {
    const mergedMil = new Map<string, { burgId: number; unitType: string; delta: number }>();
    for (const m of burgMilAdjusts) {
      const key = `${m.burgId}:${m.unitType}`;
      const cur = mergedMil.get(key);
      if (cur) cur.delta += m.delta;
      else mergedMil.set(key, { burgId: m.burgId, unitType: m.unitType, delta: m.delta });
    }
    const keys = Array.from(mergedMil.keys()).sort();
    for (const k of keys) {
      const item = mergedMil.get(k)!;
      if (item.delta === 0) continue;
      const res = await db.query(
        `UPDATE sim_burg_economy
         SET military_forces = jsonb_set(
           CASE WHEN military_forces IS NULL OR btrim(military_forces) = '' THEN '{}'::jsonb ELSE military_forces::jsonb END,
           ARRAY[$2::text],
           to_jsonb(GREATEST(0, COALESCE(((CASE WHEN military_forces IS NULL OR btrim(military_forces) = '' THEN '{}'::jsonb ELSE military_forces::jsonb END) ->> $2::text)::int, 0) + $3::int)),
           true
         )::text
         WHERE burg_id = $1::int`,
        [item.burgId, item.unitType, item.delta]
      );
      counts.sim_burg_economy = (counts.sim_burg_economy || 0) + (res.rowCount || 0);
    }
  }

  // 15. infrastructure.adjust
  if (infraAdjusts.length > 0) {
    const mergedInf = new Map<string, { burgId: number; infraType: string; levelDelta: number; status: string | null }>();
    for (const inf of infraAdjusts) {
      const upperType = inf.infraType.toUpperCase();
      const key = `${inf.burgId}:${upperType}`;
      const cur = mergedInf.get(key);
      if (cur) {
        cur.levelDelta += inf.levelDelta ?? 0;
        if (inf.status !== undefined) cur.status = inf.status;
      } else {
        mergedInf.set(key, {
          burgId: inf.burgId,
          infraType: upperType,
          levelDelta: inf.levelDelta ?? 0,
          status: inf.status ?? null,
        });
      }
    }
    for (const k of Array.from(mergedInf.keys()).sort()) {
      const item = mergedInf.get(k)!;
      const res = await db.query(
        `UPDATE sim_infrastructure
         SET level = GREATEST(0, COALESCE(level, 1) + $3::int),
             status = COALESCE($4::text, CASE WHEN GREATEST(0, COALESCE(level, 1) + $3::int) = 0 THEN 'DAMAGED' ELSE status END)
         WHERE burg_id = $1::int AND UPPER(type) = UPPER($2::text)`,
        [item.burgId, item.infraType, item.levelDelta, item.status]
      );
      counts.sim_infrastructure = (counts.sim_infrastructure || 0) + (res.rowCount || 0);
    }
  }

  // 16. map_overlays
  if (overlayAdds.length > 0) {
    const res = await db.query(
      `INSERT INTO map_overlays (cell_id, rx, ry, z, x, y, object_ref, change, payload, tick, minute, source)
       SELECT
         unnest($1::int[]),
         unnest($2::int[]),
         unnest($3::int[]),
         unnest($4::int[]),
         unnest($5::int[]),
         unnest($6::int[]),
         unnest($7::text[]),
         unnest($8::text[]),
         unnest($9::jsonb[]),
         unnest($10::int[]),
         unnest($11::int[]),
         unnest($12::text[])`,
      [
        overlayAdds.map((o) => o.cellId),
        overlayAdds.map((o) => o.rx),
        overlayAdds.map((o) => o.ry),
        overlayAdds.map((o) => o.z),
        overlayAdds.map((o) => o.x ?? null),
        overlayAdds.map((o) => o.y ?? null),
        overlayAdds.map((o) => o.objectRef ?? null),
        overlayAdds.map((o) => o.change),
        overlayAdds.map((o) => JSON.stringify(o.payload ?? {})),
        overlayAdds.map((o) => o.tick),
        overlayAdds.map((o) => o.minute ?? 0),
        overlayAdds.map((o) => o.source),
      ]
    );
    counts.map_overlays = (counts.map_overlays || 0) + (res.rowCount || overlayAdds.length);
  }

  // 17. entities registry
  if (entityCreates.length > 0) {
    counts.entities = (counts.entities || 0) + (await upsertEntitiesBatch(db, entityCreates));
  }
  if (entityDeaths.length > 0) {
    const byTick = new Map<number, string[]>();
    for (const d of entityDeaths) {
      let arr = byTick.get(d.diedTick);
      if (!arr) {
        arr = [];
        byTick.set(d.diedTick, arr);
      }
      arr.push(d.ref);
    }
    const ticks = Array.from(byTick.keys()).sort((a, b) => a - b);
    for (const dt of ticks) {
      const refs = byTick.get(dt)!;
      counts.entities = (counts.entities || 0) + (await markEntitiesDeadBatch(db, refs, dt));
    }
  }

  // 18. standing adjustments
  if (standingAdjusts.length > 0) {
    const grouped = new Map<string, {
      subjectRef: string;
      partyRef: string;
      delta: number;
      reasons: Array<{ tick: number; delta: number; reason: string }>;
    }>();
    for (const s of standingAdjusts) {
      const key = `${s.subjectRef}\0${s.partyRef}`;
      let cur = grouped.get(key);
      if (!cur) {
        cur = { subjectRef: s.subjectRef, partyRef: s.partyRef, delta: 0, reasons: [] };
        grouped.set(key, cur);
      }
      cur.delta += Math.round(s.delta);
      cur.reasons.push({ tick: s.tick ?? 0, delta: Math.round(s.delta), reason: s.reason });
    }

    for (const key of Array.from(grouped.keys()).sort()) {
      const item = grouped.get(key)!;
      const res = await db.query(
        `INSERT INTO standing (subject_ref, party_ref, value, reasons)
         VALUES ($1, $2, LEAST(100, GREATEST(-100, $3::int)), $4::jsonb)
         ON CONFLICT (subject_ref, party_ref) DO UPDATE SET
           value = LEAST(100, GREATEST(-100, standing.value + $3::int)),
           reasons = (
             SELECT COALESCE(jsonb_agg(elem ORDER BY ord), '[]'::jsonb)
             FROM (
               SELECT elem, ord
               FROM jsonb_array_elements(COALESCE(standing.reasons, '[]'::jsonb) || EXCLUDED.reasons) WITH ORDINALITY AS t(elem, ord)
               ORDER BY ord DESC
               LIMIT 20
             ) sub
           )`,
        [item.subjectRef, item.partyRef, item.delta, JSON.stringify(item.reasons)]
      );
      counts.standing = (counts.standing || 0) + (res.rowCount || 1);
    }
  }

  // 19. regional markets
  if (marketGoods.size > 0) {
    const ids = Array.from(marketGoods.keys()).sort((a, b) => a - b);
    const goodsJson = ids.map((id) => marketGoods.get(id)!);
    const res = await db.query(
      `UPDATE sim_markets AS m
       SET goods = v.goods
       FROM (
         SELECT unnest($1::int[]) AS id, unnest($2::jsonb[]) AS goods
       ) AS v
       WHERE m.id = v.id`,
      [ids, goodsJson]
    );
    counts.sim_markets = (counts.sim_markets || 0) + (res.rowCount || ids.length);
  }

  // 20. global commodity prices
  if (commoditySets.size > 0) {
    const names = Array.from(commoditySets.keys()).sort();
    const res = await db.query(
      `UPDATE sim_commodity_prices AS c
       SET current_price = v.current_price,
           global_supply = v.global_supply,
           global_demand = v.global_demand,
           last_updated_tick = v.last_updated_tick
       FROM (
         SELECT unnest($1::text[]) AS commodity,
                unnest($2::float8[]) AS current_price,
                unnest($3::int[]) AS global_supply,
                unnest($4::int[]) AS global_demand,
                unnest($5::int[]) AS last_updated_tick
       ) AS v
       WHERE c.commodity = v.commodity`,
      [
        names,
        names.map((n) => commoditySets.get(n)!.currentPrice),
        names.map((n) => commoditySets.get(n)!.globalSupply),
        names.map((n) => commoditySets.get(n)!.globalDemand),
        names.map((n) => commoditySets.get(n)!.lastUpdatedTick),
      ]
    );
    counts.sim_commodity_prices = (counts.sim_commodity_prices || 0) + (res.rowCount || names.length);
  }

  // 21. grind canyons updates & creations
  if (canyonUpdates.size > 0) {
    const ids = Array.from(canyonUpdates.keys()).sort((a, b) => a - b);
    const res = await db.query(
      `UPDATE sim_grind_canyons AS g
       SET dragonstone_richness = GREATEST(0, g.dragonstone_richness + v.richness_delta),
           stability_ticks_remaining = COALESCE(v.stability, g.stability_ticks_remaining),
           status = COALESCE(v.status, g.status),
           closed_tick = COALESCE(v.closed_tick, g.closed_tick)
       FROM (
         SELECT unnest($1::int[]) AS id,
                unnest($2::int[]) AS richness_delta,
                unnest($3::int[]) AS stability,
                unnest($4::text[]) AS status,
                unnest($5::int[]) AS closed_tick
       ) AS v
       WHERE g.id = v.id`,
      [
        ids,
        ids.map((id) => canyonUpdates.get(id)!.richnessDelta),
        ids.map((id) => canyonUpdates.get(id)!.stabilityTicksRemaining ?? null),
        ids.map((id) => canyonUpdates.get(id)!.status ?? null),
        ids.map((id) => canyonUpdates.get(id)!.closedTick ?? null),
      ]
    );
    counts.sim_grind_canyons = (counts.sim_grind_canyons || 0) + (res.rowCount || ids.length);
  }

  if (canyonCreates.length > 0) {
    const res = await db.query(
      `INSERT INTO sim_grind_canyons (
         name, cell_id, sector_x, sector_y, dragon_name, dragon_domain,
         depth_meters, dragonstone_richness, artifacts_remaining,
         stability_ticks_remaining, total_duration_ticks, status,
         miner_crew_name, active_miners, opened_tick
       )
       SELECT unnest($1::text[]), unnest($2::int[]), unnest($3::int[]), unnest($4::int[]),
              unnest($5::text[]), unnest($6::text[]), unnest($7::int[]), unnest($8::int[]),
              unnest($9::int[]), unnest($10::int[]), unnest($11::int[]), unnest($12::text[]),
              unnest($13::text[]), unnest($14::int[]), unnest($15::int[])`,
      [
        canyonCreates.map((c) => c.name),
        canyonCreates.map((c) => c.cellId),
        canyonCreates.map((c) => Math.round(c.sectorX)),
        canyonCreates.map((c) => Math.round(c.sectorY)),
        canyonCreates.map((c) => c.dragonName),
        canyonCreates.map((c) => c.dragonDomain),
        canyonCreates.map((c) => Math.round(c.depthMeters)),
        canyonCreates.map((c) => Math.round(c.dragonstoneRichness)),
        canyonCreates.map((c) => Math.round(c.artifactsRemaining)),
        canyonCreates.map((c) => Math.round(c.stabilityTicksRemaining)),
        canyonCreates.map((c) => Math.round(c.totalDurationTicks)),
        canyonCreates.map((c) => c.status),
        canyonCreates.map((c) => c.minerCrewName),
        canyonCreates.map((c) => Math.round(c.activeMiners)),
        canyonCreates.map((c) => Math.round(c.openedTick)),
      ]
    );
    counts.sim_grind_canyons = (counts.sim_grind_canyons || 0) + (res.rowCount || canyonCreates.length);
  }

  // 22. outlaw factions & fringe lairs
  if (outlawAdjusts.size > 0) {
    const ids = Array.from(outlawAdjusts.keys()).sort((a, b) => a - b);
    const res = await db.query(
      `UPDATE sim_outlaw_factions AS o
       SET wealth = GREATEST(0, COALESCE(o.wealth, 0) + v.wealth_delta),
           manpower = GREATEST(0, COALESCE(o.manpower, 0) + v.manpower_delta),
           heat = LEAST(100, GREATEST(0, COALESCE(o.heat, 0) + v.heat_delta))
       FROM (
         SELECT unnest($1::int[]) AS id,
                unnest($2::int[]) AS wealth_delta,
                unnest($3::int[]) AS manpower_delta,
                unnest($4::int[]) AS heat_delta
       ) AS v
       WHERE o.id = v.id`,
      [
        ids,
        ids.map((id) => outlawAdjusts.get(id)!.wealthDelta),
        ids.map((id) => outlawAdjusts.get(id)!.manpowerDelta),
        ids.map((id) => outlawAdjusts.get(id)!.heatDelta),
      ]
    );
    counts.sim_outlaw_factions = (counts.sim_outlaw_factions || 0) + (res.rowCount || ids.length);
  }

  if (lairDeletes.length > 0) {
    const res = await db.query(
      `DELETE FROM sim_fringe_lairs AS l
       USING (SELECT unnest($1::int[]) AS faction_id, unnest($2::int[]) AS cell_id) AS v
       WHERE l.faction_id = v.faction_id AND l.cell_id = v.cell_id`,
      [lairDeletes.map((d) => d.factionId), lairDeletes.map((d) => d.cellId)]
    );
    counts.sim_fringe_lairs = (counts.sim_fringe_lairs || 0) + (res.rowCount || 0);
  }

  if (lairUpserts.length > 0) {
    const res = await db.query(
      `INSERT INTO sim_fringe_lairs (faction_id, cell_id, burg_id, lair_type, manpower, heat)
       SELECT unnest($1::int[]), unnest($2::int[]), unnest($3::int[]),
              unnest($4::text[]), unnest($5::int[]), unnest($6::int[])`,
      [
        lairUpserts.map((u) => u.factionId),
        lairUpserts.map((u) => u.cellId),
        lairUpserts.map((u) => u.burgId),
        lairUpserts.map((u) => u.lairType),
        lairUpserts.map((u) => u.manpower),
        lairUpserts.map((u) => u.heat),
      ]
    );
    counts.sim_fringe_lairs = (counts.sim_fringe_lairs || 0) + (res.rowCount || lairUpserts.length);
  }

  // 23. culture & religion cell counts
  if (cultureCellDeltas.size > 0) {
    const cIds = Array.from(cultureCellDeltas.keys()).sort((a, b) => a - b);
    const res = await db.query(
      `UPDATE sim_cultures AS cu
       SET cells = GREATEST(0, COALESCE(cu.cells, 0) + v.delta)
       FROM (SELECT unnest($1::int[]) AS id, unnest($2::int[]) AS delta) AS v
       WHERE cu.id = v.id
         AND cu.cells IS DISTINCT FROM GREATEST(0, COALESCE(cu.cells, 0) + v.delta)`,
      [cIds, cIds.map((id) => cultureCellDeltas.get(id)!)]
    );
    counts.sim_cultures = (counts.sim_cultures || 0) + (res.rowCount || 0);
  }

  if (religionCellDeltas.size > 0) {
    const rIds = Array.from(religionCellDeltas.keys()).sort((a, b) => a - b);
    const res = await db.query(
      `UPDATE sim_religions AS r
       SET cells = GREATEST(0, COALESCE(r.cells, 0) + v.delta)
       FROM (SELECT unnest($1::int[]) AS id, unnest($2::int[]) AS delta) AS v
       WHERE r.id = v.id
         AND r.cells IS DISTINCT FROM GREATEST(0, COALESCE(r.cells, 0) + v.delta)`,
      [rIds, rIds.map((id) => religionCellDeltas.get(id)!)]
    );
    counts.sim_religions = (counts.sim_religions || 0) + (res.rowCount || 0);
  }

  if (lairRationsByBurg.size > 0) {
    const bIds = Array.from(lairRationsByBurg.keys()).sort((a, b) => a - b);
    const res = await db.query(
      `UPDATE sim_fringe_lairs AS l
       SET inventory = jsonb_set(
         COALESCE(l.inventory, '{}'::jsonb),
         '{stolen_rations}',
         (COALESCE(l.inventory->>'stolen_rations', '0')::int + v.rations)::text::jsonb
       )
       FROM (SELECT unnest($1::int[]) AS burg_id, unnest($2::int[]) AS rations) AS v
       LEFT JOIN sim_burg_economy b ON b.burg_id = v.burg_id
       WHERE l.burg_id = v.burg_id OR (b.cell_id IS NOT NULL AND l.cell_id = b.cell_id)`,
      [bIds, bIds.map((id) => lairRationsByBurg.get(id)!)]
    );
    counts.sim_fringe_lairs = (counts.sim_fringe_lairs || 0) + (res.rowCount || 0);
  }

  // 24. sim_npc_instances
  if (npcInstanceUpdates.size > 0) {
    const ids = Array.from(npcInstanceUpdates.keys()).sort();
    const list = ids.map((id) => npcInstanceUpdates.get(id)!);
    const res = await db.query(
      `UPDATE sim_npc_instances AS n
       SET needs = CASE WHEN v.needs_set THEN v.needs_val ELSE n.needs END,
           mood = CASE WHEN v.mood_set THEN v.mood_val ELSE n.mood END,
           beliefs = CASE WHEN v.beliefs_set THEN v.beliefs_val ELSE n.beliefs END,
           disposition = CASE WHEN v.disp_set THEN v.disp_val ELSE n.disposition END,
           trade_price_mult = CASE WHEN v.mult_set THEN v.mult_val ELSE n.trade_price_mult END,
           processed_for_economy = CASE WHEN v.proc_set THEN v.proc_val ELSE n.processed_for_economy END,
           updated_at = CASE WHEN v.touch_updated THEN NOW() ELSE n.updated_at END
       FROM (
         SELECT
           unnest($1::text[]) AS id,
           unnest($2::boolean[]) AS needs_set, unnest($3::jsonb[]) AS needs_val,
           unnest($4::boolean[]) AS mood_set, unnest($5::jsonb[]) AS mood_val,
           unnest($6::boolean[]) AS beliefs_set, unnest($7::jsonb[]) AS beliefs_val,
           unnest($8::boolean[]) AS disp_set, unnest($9::int[]) AS disp_val,
           unnest($10::boolean[]) AS mult_set, unnest($11::float8[]) AS mult_val,
           unnest($12::boolean[]) AS proc_set, unnest($13::boolean[]) AS proc_val,
           unnest($14::boolean[]) AS touch_updated
       ) AS v
       WHERE n.id = v.id`,
      [
        ids,
        list.map((r) => r.needs !== undefined), list.map((r) => r.needs ?? null),
        list.map((r) => r.mood !== undefined), list.map((r) => r.mood ?? null),
        list.map((r) => r.beliefs !== undefined), list.map((r) => r.beliefs ?? null),
        list.map((r) => r.disposition !== undefined), list.map((r) => r.disposition ?? null),
        list.map((r) => r.tradePriceMult !== undefined), list.map((r) => r.tradePriceMult ?? null),
        list.map((r) => r.processedForEconomy !== undefined), list.map((r) => r.processedForEconomy ?? null),
        list.map((r) => r.touchUpdated),
      ]
    );
    counts.sim_npc_instances = (counts.sim_npc_instances || 0) + (res.rowCount || 0);
  }

  // 25. sim_sector_layers
  if (sectorLayerUpdates.size > 0) {
    const list = Array.from(sectorLayerUpdates.values()).sort(
      (a, b) => a.cellId - b.cellId || a.rx - b.rx || a.ry - b.ry || a.zLayer - b.zLayer
    );
    const res = await db.query(
      `UPDATE sim_sector_layers AS s
       SET npcs = v.npcs,
           props = v.props,
           features = v.features
       FROM (
         SELECT
           unnest($1::int[]) AS cell_id,
           unnest($2::int[]) AS rx,
           unnest($3::int[]) AS ry,
           unnest($4::int[]) AS z_layer,
           unnest($5::jsonb[]) AS npcs,
           unnest($6::jsonb[]) AS props,
           unnest($7::jsonb[]) AS features
       ) AS v
       WHERE s.cell_id = v.cell_id AND s.rx = v.rx AND s.ry = v.ry AND s.z_layer = v.z_layer`,
      [
        list.map((s) => s.cellId),
        list.map((s) => Math.round(s.rx)),
        list.map((s) => Math.round(s.ry)),
        list.map((s) => Math.round(s.zLayer)),
        list.map((s) => JSON.stringify(s.npcs)),
        list.map((s) => JSON.stringify(s.props)),
        list.map((s) => JSON.stringify(s.features)),
      ]
    );
    counts.sim_sector_layers = (counts.sim_sector_layers || 0) + (res.rowCount || 0);
  }

  // 26. sim_sacred_groves
  if (groveSealDeltas.size > 0) {
    const gIds = Array.from(groveSealDeltas.keys()).sort((a, b) => a - b);
    const res = await db.query(
      `UPDATE sim_sacred_groves AS g
       SET seal_strength = LEAST(100, GREATEST(0, COALESCE(g.seal_strength, 0) + v.delta))
       FROM (SELECT unnest($1::int[]) AS id, unnest($2::int[]) AS delta) AS v
       WHERE g.id = v.id
         AND g.seal_strength IS DISTINCT FROM LEAST(100, GREATEST(0, COALESCE(g.seal_strength, 0) + v.delta))`,
      [gIds, gIds.map((id) => groveSealDeltas.get(id)!)]
    );
    counts.sim_sacred_groves = (counts.sim_sacred_groves || 0) + (res.rowCount || 0);
  }

  // 27. sim_ancient_path_wards
  if (wardRechargeTick !== null) {
    const res = await db.query(
      `UPDATE sim_ancient_path_wards
       SET is_charged = true
       WHERE is_charged = false AND ($1 - last_triggered_tick) >= recharge_ticks`,
      [wardRechargeTick]
    );
    counts.sim_ancient_path_wards = (counts.sim_ancient_path_wards || 0) + (res.rowCount || 0);
  }

  if (wardDischarges.size > 0) {
    const wIds = Array.from(wardDischarges.keys()).sort((a, b) => a - b);
    const res = await db.query(
      `UPDATE sim_ancient_path_wards AS w
       SET is_charged = false, last_triggered_tick = v.tick
       FROM (SELECT unnest($1::int[]) AS id, unnest($2::int[]) AS tick) AS v
       WHERE w.id = v.id`,
      [wIds, wIds.map((id) => wardDischarges.get(id)!)]
    );
    counts.sim_ancient_path_wards = (counts.sim_ancient_path_wards || 0) + (res.rowCount || 0);
  }

  // 28. burg.createSatellite
  if (satelliteCreates.length > 0) {
    const burgRes = await db.query(
      `INSERT INTO sim_burg_economy (
         burg_id, cell_id, name, parent_burg_id, settlement_type,
         pop_null, pop_attuned, wealth, food, unrest, health, crime_rate,
         urban_tier, military_forces, demographics, species_demographics
       )
       SELECT
         unnest($1::int[]),
         unnest($2::int[]),
         unnest($3::text[]),
         unnest($4::int[]),
         unnest($5::text[]),
         unnest($6::int[]),
         unnest($7::int[]),
         unnest($8::int[]),
         unnest($9::int[]),
         0, 85, 0, 1, '{"militia":6}'::jsonb, '{}', '{}'
       ON CONFLICT (burg_id) DO NOTHING
       RETURNING burg_id`,
      [
        satelliteCreates.map((s) => s.burgId),
        satelliteCreates.map((s) => s.cellId),
        satelliteCreates.map((s) => s.name),
        satelliteCreates.map((s) => s.parentBurgId),
        satelliteCreates.map((s) => s.settlementType),
        satelliteCreates.map((s) => s.popNull),
        satelliteCreates.map((s) => s.popAttuned),
        satelliteCreates.map((s) => s.wealth),
        satelliteCreates.map((s) => s.food),
      ]
    );
    const insertedSet =
      burgRes.rows.length > 0
        ? new Set(burgRes.rows.map((r: any) => Number(r.burg_id)))
        : (burgRes.rowCount || 0) > 0
          ? new Set(satelliteCreates.map((s) => s.burgId))
          : new Set<number>();
    const insertedSats = satelliteCreates.filter((s) => insertedSet.has(s.burgId));
    counts.sim_burg_economy = (counts.sim_burg_economy || 0) + insertedSats.length;

    if (insertedSats.length > 0) {
      const stockRes = await db.query(
        `INSERT INTO sim_industrial_stockpiles (burg_id, complex_inventory)
         SELECT unnest($1::int[]), '{}'
         ON CONFLICT DO NOTHING`,
        [insertedSats.map((s) => s.burgId)]
      );
      counts.sim_industrial_stockpiles =
        (counts.sim_industrial_stockpiles || 0) + (stockRes.rowCount || insertedSats.length);

      const roadRes = await db.query(
        `INSERT INTO sim_roads (name, source_cell_id, dest_cell_id, road_group)
         SELECT unnest($1::text[]), unnest($2::int[]), unnest($3::int[]), 'HAMLET_TRAIL'`,
        [
          insertedSats.map((s) => s.roadName),
          insertedSats.map((s) => s.parentCellId),
          insertedSats.map((s) => s.cellId),
        ]
      );
      counts.sim_roads = (counts.sim_roads || 0) + (roadRes.rowCount || insertedSats.length);
    }
  }

  // 29. sim_paragons corruption
  if (paragonCorruptions.size > 0) {
    const pIds = Array.from(paragonCorruptions.keys()).sort((a, b) => a - b);
    const res = await db.query(
      `UPDATE sim_paragons AS p
       SET corruption_score = v.score
       FROM (SELECT unnest($1::int[]) AS id, unnest($2::int[]) AS score) AS v
       WHERE p.id = v.id AND p.corruption_score IS DISTINCT FROM v.score`,
      [pIds, pIds.map((id) => paragonCorruptions.get(id)!)]
    );
    counts.sim_paragons = (counts.sim_paragons || 0) + (res.rowCount || 0);
  }

  // 30. sim_factions
  if (factionUpdates.size > 0) {
    const fIds = Array.from(factionUpdates.keys()).sort((a, b) => a - b);
    const list = fIds.map((id) => factionUpdates.get(id)!);
    const res = await db.query(
      `WITH v AS (
         SELECT
           unnest($1::int[]) AS id,
           unnest($2::boolean[]) AS t_act, unnest($3::boolean[]) AS t_set,
           unnest($4::bigint[]) AS t_base, unnest($5::bigint[]) AS t_delta,
           unnest($6::boolean[]) AS f_set, unnest($7::jsonb[]) AS f_val
       ),
       computed AS (
         SELECT
           f.id,
           CASE WHEN v.t_act THEN GREATEST(0, CASE WHEN v.t_set THEN v.t_base + v.t_delta ELSE COALESCE(f.treasury, 0) + v.t_delta END)::bigint ELSE f.treasury END AS next_treasury,
           CASE WHEN v.f_set THEN v.f_val ELSE f.fiscal_economy END AS next_fiscal
         FROM v
         JOIN sim_factions f ON f.id = v.id
       )
       UPDATE sim_factions f SET
         treasury = u.next_treasury,
         fiscal_economy = u.next_fiscal
       FROM computed u
       WHERE f.id = u.id
         AND (f.treasury IS DISTINCT FROM u.next_treasury OR f.fiscal_economy IS DISTINCT FROM u.next_fiscal)`,
      [
        fIds,
        list.map((r) => numActive(r.treasury)),
        list.map((r) => r.treasury.hasSet),
        list.map((r) => Math.round(r.treasury.setVal)),
        list.map((r) => Math.round(r.treasury.delta)),
        list.map((r) => r.fiscalSet),
        list.map((r) => r.fiscalJson),
      ]
    );
    counts.sim_factions = (counts.sim_factions || 0) + (res.rowCount || 0);
  }

  // 31. sim_faction_units
  if (factionUnitUpdates.size > 0) {
    const uIds = Array.from(factionUnitUpdates.keys()).sort((a, b) => a - b);
    const res = await db.query(
      `UPDATE sim_faction_units AS u
       SET count = v.count, status = v.status
       FROM (SELECT unnest($1::int[]) AS id, unnest($2::int[]) AS count, unnest($3::text[]) AS status) AS v
       WHERE u.id = v.id AND (u.count IS DISTINCT FROM v.count OR u.status IS DISTINCT FROM v.status)`,
      [
        uIds,
        uIds.map((id) => factionUnitUpdates.get(id)!.count),
        uIds.map((id) => factionUnitUpdates.get(id)!.status),
      ]
    );
    counts.sim_faction_units = (counts.sim_faction_units || 0) + (res.rowCount || 0);
  }

  // 32. sim_diplomacy
  if (diplomacyUpserts.size > 0) {
    const keys = Array.from(diplomacyUpserts.keys()).sort();
    const list = keys.map((k) => diplomacyUpserts.get(k)!);
    const res = await db.query(
      `INSERT INTO sim_diplomacy (faction_a_id, faction_b_id, status, tension)
       SELECT unnest($1::int[]), unnest($2::int[]), unnest($3::text[]), unnest($4::int[])
       ON CONFLICT (faction_a_id, faction_b_id) DO UPDATE
       SET status = EXCLUDED.status, tension = EXCLUDED.tension`,
      [
        list.map((d) => d.factionAId),
        list.map((d) => d.factionBId),
        list.map((d) => d.status),
        list.map((d) => d.tension),
      ]
    );
    counts.sim_diplomacy = (counts.sim_diplomacy || 0) + (res.rowCount || list.length);
  }

  return counts;
}
