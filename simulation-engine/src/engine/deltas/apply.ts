import { addCellTagsBatch } from "../cellTags.js";
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
  popNull: NumAcc;
  popAttuned: NumAcc;
  urbanTierSet: boolean;
  urbanTierVal: number;
  occSet: boolean;
  occVal: number | null;
  nameSet: boolean;
  nameVal: string | null;
}

function emptyBurgMerged(): BurgMerged {
  return {
    food: zeroAcc(),
    wealth: zeroAcc(),
    unrest: zeroAcc(),
    health: zeroAcc(),
    crimeRate: zeroAcc(),
    rawMaterials: zeroAcc(),
    popNull: zeroAcc(),
    popAttuned: zeroAcc(),
    urbanTierSet: false,
    urbanTierVal: 0,
    occSet: false,
    occVal: null,
    nameSet: false,
    nameVal: null,
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
  const cells = new Map<number, CellMerged>();
  const cellFactions = new Map<number, number | null>();
  const citizenStatuses = new Map<number, { status: string; cause: string | null; motivation: string | null }>();
  const citizenMoves = new Map<number, { settlementId: number; homeCellId: number }>();
  const agentUpdates = new Map<number, AgentUpdateFields>();
  const agentRemovals = new Set<number>();
  const cellTagsByLayer = new Map<number, Array<{ cellId: number; tags: string[] }>>();
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
  const entityCreates: UpsertEntityInput[] = [];
  const entityDeaths: Array<{ ref: string; diedTick: number }> = [];
  const citizenKillOnes: Array<Extract<Delta, { kind: "citizen.killOne" }>> = [];
  const paragonDies: Array<Extract<Delta, { kind: "paragon.die" }>> = [];
  const burgMilAdjusts: Array<Extract<Delta, { kind: "burg.militaryAdjust" }>> = [];
  const infraAdjusts: Array<Extract<Delta, { kind: "infrastructure.adjust" }>> = [];
  const overlayAdds: Array<Extract<Delta, { kind: "overlay.add" }>> = [];
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
        applyNumSet(m.popNull, f.pop_null);
        applyNumSet(m.popAttuned, f.pop_attuned);
        if (f.urban_tier !== undefined) { m.urbanTierSet = true; m.urbanTierVal = f.urban_tier; }
        if (f.occupier_faction_id !== undefined) { m.occSet = true; m.occVal = f.occupier_faction_id; }
        if (f.name !== undefined) { m.nameSet = true; m.nameVal = f.name; }
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
      case "agent.remove":
        agentRemovals.add(d.agentId);
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
  if (chaosUpserts.length > 0) {
    const byKey = new Map<string, { cellId: number; intensity: number; type: string }>();
    for (const z of chaosUpserts) {
      byKey.set(`${z.cellId}|${z.type}`, { cellId: z.cellId, intensity: z.intensity, type: z.type });
    }
    const vals = Array.from(byKey.values());
    const res = await db.query(
      `INSERT INTO sim_chaos_zones (cell_id, intensity, type)
       SELECT unnest($1::int[]), unnest($2::real[]), unnest($3::text[])
       ON CONFLICT DO NOTHING`,
      [vals.map((v) => v.cellId), vals.map((v) => v.intensity), vals.map((v) => v.type)]
    );
    counts.sim_chaos_zones = (counts.sim_chaos_zones || 0) + (res.rowCount || 0);
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
           unnest($38::boolean[]) AS name_set, unnest($39::text[]) AS name_val
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
           CASE WHEN v.popn_act THEN GREATEST(0, ROUND((CASE WHEN v.popn_set THEN v.popn_base + v.popn_delta ELSE COALESCE(b.pop_null, 0) + v.popn_delta END)::numeric))::int ELSE b.pop_null END AS next_pop_null,
           CASE WHEN v.popa_act THEN GREATEST(0, ROUND((CASE WHEN v.popa_set THEN v.popa_base + v.popa_delta ELSE COALESCE(b.pop_attuned, 0) + v.popa_delta END)::numeric))::int ELSE b.pop_attuned END AS next_pop_attuned,
           CASE WHEN v.tier_set THEN GREATEST(0, v.tier_val) ELSE b.urban_tier END AS next_tier,
           CASE WHEN v.occ_set THEN v.occ_val ELSE b.occupier_faction_id END AS next_occ,
           CASE WHEN v.name_set THEN v.name_val ELSE b.name END AS next_name
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
         pop_null = u.next_pop_null,
         pop_attuned = u.next_pop_attuned,
         urban_tier = u.next_tier,
         occupier_faction_id = u.next_occ,
         name = u.next_name
       FROM computed u
       WHERE b.burg_id = u.burg_id
         AND (
           b.food IS DISTINCT FROM u.next_food OR
           b.wealth IS DISTINCT FROM u.next_wealth OR
           b.unrest IS DISTINCT FROM u.next_unrest OR
           b.health IS DISTINCT FROM u.next_health OR
           b.crime_rate IS DISTINCT FROM u.next_crime OR
           b.raw_materials IS DISTINCT FROM u.next_raw OR
           b.pop_null IS DISTINCT FROM u.next_pop_null OR
           b.pop_attuned IS DISTINCT FROM u.next_pop_attuned OR
           b.urban_tier IS DISTINCT FROM u.next_tier OR
           b.occupier_faction_id IS DISTINCT FROM u.next_occ OR
           b.name IS DISTINCT FROM u.next_name
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
         age_ticks = CASE WHEN v.age_set THEN v.age_val ELSE a.age_ticks END
       FROM (
         SELECT
           unnest($1::int[]) AS id,
           unnest($2::boolean[]) AS loc_set, unnest($3::int[]) AS loc_val,
           unnest($4::boolean[]) AS tgt_set, unnest($5::int[]) AS tgt_val,
           unnest($6::boolean[]) AS st_set, unnest($7::text[]) AS st_val,
           unnest($8::boolean[]) AS cor_set, unnest($9::int[]) AS cor_val,
           unnest($10::boolean[]) AS dp_set, unnest($11::real[]) AS dp_val,
           unnest($12::boolean[]) AS ap_set, unnest($13::text[]) AS ap_val,
           unnest($14::boolean[]) AS age_set, unnest($15::int[]) AS age_val
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
      ]
    );
    counts.sim_agents = (counts.sim_agents || 0) + (res.rowCount || 0);
  }
  if (agentRemovals.size > 0) {
    const rmIds = Array.from(agentRemovals).sort((a, b) => a - b);
    const res = await db.query(
      `DELETE FROM sim_agents WHERE id = ANY($1::int[])`,
      [rmIds]
    );
    counts.sim_agents = (counts.sim_agents || 0) + (res.rowCount || 0);
    await markEntitiesDeadBatch(db, rmIds.map((id) => `agent:${id}`), 0);
  }

  // 8. sim_cell_tags
  for (const [zLayer, entries] of cellTagsByLayer.entries()) {
    await addCellTagsBatch(db, entries, zLayer);
    counts.sim_cell_tags = (counts.sim_cell_tags || 0) + entries.length;
  }

  // 9. sim_events (multi-row unnest insert)
  if (events.length > 0) {
    const res = await db.query(
      `INSERT INTO sim_events (tick, type, message, tier, lore_date, burg_id, cell_id, faction_id, outlaw_id)
       SELECT
         unnest($1::int[]),
         unnest($2::text[]),
         unnest($3::text[]),
         unnest($4::text[]),
         unnest($5::text[]),
         unnest($6::int[]),
         unnest($7::int[]),
         unnest($8::int[]),
         unnest($9::int[])`,
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
      ]
    );
    counts.sim_events = res.rowCount || events.length;
  }

  // 10. sim_threads
  for (const t of threads) {
    await createThread(db as any, t.spec);
    counts.sim_threads = (counts.sim_threads || 0) + 1;
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

  return counts;
}
