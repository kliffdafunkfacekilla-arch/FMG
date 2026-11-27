import type { Db } from "../../deltas/types.js";
import { adjustCohortsBatch, type CohortKey } from "../../entities/population.js";
import { markEntitiesDeadBatch, upsertEntitiesBatch } from "../../entities/registry.js";
import { INSTINCTS, TEMPERS } from "../../lod/promote.js";
import { deriveCitizenMotives } from "../../rpg/paragonMotives.js";
import type { LifeLink, LivesPlan } from "./step.js";

/**
 * Writes a LivesPlan. The population ledger stays balanced (pop_null + pop_attuned = cohorts + notable records):
 * - a death takes one person off the town's counter, and the rest of the record's unit (when a record
 *   stands for more than one person) goes back into the matching adult cohort;
 * - a birth draws one child out of the town's child cohort, so the town's total is unchanged.
 */
export async function applyLives(db: Db, plan: LivesPlan, tick: number, loreDate: string, random: () => number = Math.random): Promise<{ deaths: number; births: number; ties: number }> {
  // 1. Deaths
  if (plan.deaths.length > 0) {
    const ids = plan.deaths.map((d) => d.notable.citizenId);
    await db.query(
      `UPDATE population_demographics p SET allegiance_status = 'DECEASED', cause_of_death = v.cause
       FROM (SELECT unnest($1::int[]) AS citizen_id, unnest($2::text[]) AS cause) v
       WHERE p.citizen_id = v.citizen_id`,
      [ids, plan.deaths.map((d) => d.cause)]
    );
    await markEntitiesDeadBatch(db, ids.map((id) => `citizen:${id}`), tick);

    const counters = new Map<number, { nulls: number; attuned: number }>();
    const returns: Array<CohortKey & { delta: number }> = [];
    for (const d of plan.deaths) {
      const n = d.notable;
      const c = counters.get(n.burgId) || { nulls: 0, attuned: 0 };
      if (n.isNull) c.nulls += 1; else c.attuned += 1;
      counters.set(n.burgId, c);
      if (n.unitSize > 1) {
        returns.push({
          burgId: n.burgId, species: n.species, profession: n.profession,
          ageBand: n.lifeStage === "CHILD" ? "CHILD" : "ADULT", sparkTier: n.sparkTier, isNull: n.isNull,
          allegiance: "CIVILIAN", delta: n.unitSize - 1,
        });
      }
    }
    const bids = Array.from(counters.keys()).sort((a, b) => a - b);
    await db.query(
      `UPDATE sim_burg_economy b SET pop_null = GREATEST(0, b.pop_null - v.n), pop_attuned = GREATEST(0, COALESCE(b.pop_attuned, 0) - v.a)
       FROM (SELECT unnest($1::int[]) AS burg_id, unnest($2::int[]) AS n, unnest($3::int[]) AS a) v
       WHERE b.burg_id = v.burg_id`,
      [bids, bids.map((b) => counters.get(b)!.nulls), bids.map((b) => counters.get(b)!.attuned)]
    );
    if (returns.length > 0) await adjustCohortsBatch(db, returns);
  }

  // 2. Coming of age
  if (plan.comingOfAge.length > 0) {
    await db.query(`UPDATE population_demographics SET life_stage = 'ADULT' WHERE citizen_id = ANY($1::int[])`, [plan.comingOfAge]);
  }

  // 3. Changed ties (full lists), before births append parent/child links below.
  if (plan.links.size > 0) {
    const ids = Array.from(plan.links.keys()).sort((a, b) => a - b);
    await db.query(
      `UPDATE population_demographics p SET social_links = v.links
       FROM (SELECT unnest($1::int[]) AS citizen_id, unnest($2::jsonb[]) AS links) v
       WHERE p.citizen_id = v.citizen_id`,
      [ids, ids.map((id) => JSON.stringify(plan.links.get(id)))]
    );
  }

  const lifeRows = plan.lifeEvents.map((e) => ({ ...e }));

  // 4. Births (a few a day at most, so one insert each keeps the new ids exact).
  if (plan.births.length > 0) {
    await adjustCohortsBatch(db, plan.births.map((b) => ({
      burgId: b.burgId, species: b.cohort.species, profession: b.cohort.profession, ageBand: "CHILD",
      sparkTier: b.cohort.sparkTier, isNull: b.cohort.isNull, allegiance: "CIVILIAN", delta: -1,
    })));
    const entities = [];
    for (const b of plan.births) {
      const temper = TEMPERS[Math.floor(random() * TEMPERS.length)] || "CURIOUS";
      const instinct = INSTINCTS[Math.floor(random() * INSTINCTS.length)] || "CURIOUS";
      const motives = deriveCitizenMotives({ profession: b.cohort.profession, temper, instinct, allegiance_status: "CIVILIAN" } as any);
      const [pa, pb] = b.parentIds;
      const parents = await db.query(`SELECT citizen_id, name FROM population_demographics WHERE citizen_id = ANY($1::int[])`, [[pa, pb]]);
      const nameOf = new Map<number, string>(parents.rows.map((r: any) => [Number(r.citizen_id), String(r.name)]));
      const ins = await db.query(
        `INSERT INTO population_demographics (
           settlement_id, home_cell_id, name, profession, species, is_null, spark_tier, attunement_level, chaos_attraction_index,
           temper, instinct, motivation, traits, social_links, allegiance_status, unit_size, life_stage, age,
           childhood_background, is_immigrant, birthplace, want, flaw, line_wont_cross
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14::jsonb, 'CIVILIAN', 1, 'CHILD', 0,
                   $15, false, $16, $17, $18, $19)
         RETURNING citizen_id`,
        [
          b.burgId, b.homeCellId, b.name, b.cohort.profession, b.species, b.cohort.isNull, b.cohort.sparkTier,
          b.cohort.isNull ? 0 : 0.3, b.cohort.isNull ? 0 : 1.5, temper, instinct,
          `Growing up in the household of ${nameOf.get(pa) || "their parents"}.`,
          JSON.stringify([temper, instinct]),
          JSON.stringify(b.parentIds.map((pid) => parentLink(pid, nameOf.get(pid) || "", tick))),
          `Born at tick ${tick} to ${nameOf.get(pa) || "?"} and ${nameOf.get(pb) || "?"}.`,
          String(b.burgId), motives.want, motives.flaw, motives.lineWontCross,
        ]
      );
      const cid = Number(ins.rows[0].citizen_id);
      entities.push({
        ref: `citizen:${cid}`, kind: "person", name: b.name, alive: true, lod: "macro", cellId: b.homeCellId,
        sourceTable: "population_demographics", sourceId: String(cid), createdTick: tick,
      });
      const childLink = { targetNpcId: `citizen:${cid}`, citizenId: cid, name: b.name, relation: "child", relationship: "child", trust: 0.9, since: tick };
      await db.query(
        `UPDATE population_demographics SET social_links = COALESCE(social_links, '[]'::jsonb) || $2::jsonb WHERE citizen_id = ANY($1::int[])`,
        [[pa, pb], JSON.stringify([childLink])]
      );
      lifeRows.push({ citizenId: cid, kind: "born", text: `Born to ${nameOf.get(pa) || "?"} and ${nameOf.get(pb) || "?"}.`, otherCitizenId: pa, burgId: b.burgId });
    }
    await upsertEntitiesBatch(db, entities as any);
  }

  // 5. Each person's own history
  if (lifeRows.length > 0) {
    await db.query(
      `INSERT INTO sim_life_events (citizen_id, tick, kind, text, other_citizen_id, burg_id)
       SELECT unnest($1::int[]), $2, unnest($3::text[]), unnest($4::text[]), unnest($5::int[]), unnest($6::int[])`,
      [
        lifeRows.map((e) => e.citizenId), tick, lifeRows.map((e) => e.kind), lifeRows.map((e) => e.text),
        lifeRows.map((e) => e.otherCitizenId), lifeRows.map((e) => e.burgId),
      ]
    );
  }

  // 6. The town's own history gets the named moments: deaths, weddings, births.
  if (plan.townEvents.length > 0) {
    await db.query(
      `INSERT INTO sim_events (tick, type, message, tier, lore_date, burg_id, cell_id)
       SELECT $1, unnest($2::text[]), unnest($3::text[]), 'MINOR', $4, unnest($5::int[]), unnest($6::int[])`,
      [
        tick, plan.townEvents.map((e) => e.type), plan.townEvents.map((e) => e.message), loreDate,
        plan.townEvents.map((e) => e.burgId), plan.townEvents.map((e) => e.cellId || null),
      ]
    );
  }

  let ties = 0;
  for (const e of plan.lifeEvents) if (e.kind === "friend" || e.kind === "rival" || e.kind === "married") ties++;
  return { deaths: plan.deaths.length, births: plan.births.length, ties: ties / 2 };
}

function parentLink(pid: number, name: string, tick: number): LifeLink {
  return { targetNpcId: `citizen:${pid}`, citizenId: pid, name, relation: "parent", relationship: "parent", trust: 0.9, since: tick };
}
