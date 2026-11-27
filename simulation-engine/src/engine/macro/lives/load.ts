import type { Db } from "../../deltas/types.js";
import { FIRST_NAMES } from "../../lod/promote.js";
import type { ChildCohort, LifeLink, LifeNotable, LifeRaid, LivesSnapshot } from "./step.js";

/** Town troubles this tick that can touch a named person (read from what earlier steps logged today). */
const TROUBLE_TYPES = {
  famine: ["BURG_FAMINE"],
  battle: ["BATTLE", "SIEGE_WON", "BORDER_SKIRMISH", "AUTONOMOUS_CLASH"],
  murder: ["CARTEL_CONTRACT_KILLING"],
  witch: ["WITCH_HUNT_EXECUTION"],
  storm: ["CHAOS_STORM"],
};

function parseLinks(raw: any): LifeLink[] {
  const arr = Array.isArray(raw) ? raw : [];
  // Only links this step made (they carry a citizenId); older prerender links name a person but not an id.
  return arr.filter((l: any) => l && Number(l.citizenId) > 0).map((l: any) => ({
    targetNpcId: String(l.targetNpcId || `citizen:${l.citizenId}`),
    citizenId: Number(l.citizenId),
    name: String(l.name || ""),
    relation: String(l.relation || l.relationship || "friend"),
    relationship: String(l.relation || l.relationship || "friend"),
    trust: Number(l.trust ?? 0),
    since: Number(l.since ?? 0),
  }));
}

/**
 * Living named people (not those promoted into a focused region: the micro layer owns them while there),
 * today's town troubles, today's raided caravans and the child cohorts a newborn is drawn from.
 * Six queries regardless of world size.
 */
export async function loadLives(client: Db, tick: number): Promise<LivesSnapshot> {
  const notRes = await client.query(
    `SELECT p.citizen_id, p.settlement_id, COALESCE(p.home_cell_id, 0)::int AS home_cell_id, p.name, p.profession,
            p.species, COALESCE(p.is_null, true) AS is_null, COALESCE(p.spark_tier, 'NONE') AS spark_tier,
            COALESCE(p.unit_size, 1)::int AS unit_size, COALESCE(NULLIF(p.life_stage, ''), 'ADULT') AS life_stage,
            COALESCE(p.age, 30)::int AS age, COALESCE(p.temper, 'STOIC') AS temper, p.allegiance_status, p.social_links
     FROM population_demographics p
     WHERE p.settlement_id IS NOT NULL
       -- Townsfolk and caravan crews. Cultists, wardens and zealots belong to their agent rows' own steps.
       AND p.allegiance_status IN ('CIVILIAN', 'ON_CARAVAN')
       AND NOT EXISTS (SELECT 1 FROM promoted_slots ps WHERE ps.citizen_id = p.citizen_id)
     ORDER BY p.citizen_id`
  );
  const notables: LifeNotable[] = notRes.rows.map((r: any) => ({
    citizenId: Number(r.citizen_id),
    burgId: Number(r.settlement_id),
    homeCellId: Number(r.home_cell_id),
    name: String(r.name || "Unnamed"),
    profession: String(r.profession || "Laborer"),
    species: String(r.species || "Human"),
    isNull: Boolean(r.is_null),
    sparkTier: String(r.spark_tier),
    unitSize: Math.max(1, Number(r.unit_size) || 1),
    lifeStage: String(r.life_stage),
    age: Number(r.age),
    temper: String(r.temper),
    status: String(r.allegiance_status || "CIVILIAN"),
    links: parseLinks(r.social_links),
    legacyLinks: (Array.isArray(r.social_links) ? r.social_links : []).filter((l: any) => !(l && Number(l.citizenId) > 0)),
  }));

  const burgIds = Array.from(new Set(notables.map((n) => n.burgId))).sort((a, b) => a - b);
  const nameRes = await client.query(
    `SELECT burg_id, name FROM sim_burg_economy WHERE burg_id = ANY($1::int[])`,
    [burgIds]
  );
  const burgNames = new Map<number, string>(nameRes.rows.map((r: any) => [Number(r.burg_id), String(r.name)]));

  const allTypes = Object.values(TROUBLE_TYPES).flat();
  const evRes = await client.query(
    `SELECT DISTINCT type, burg_id FROM sim_events WHERE tick = $1 AND burg_id IS NOT NULL AND type = ANY($2::text[])`,
    [tick, allTypes]
  );
  const sets = { famine: new Set<number>(), battle: new Set<number>(), murder: new Set<number>(), witch: new Set<number>(), storm: new Set<number>() };
  for (const r of evRes.rows) {
    for (const [k, types] of Object.entries(TROUBLE_TYPES)) {
      if (types.includes(String(r.type))) sets[k as keyof typeof sets].add(Number(r.burg_id));
    }
  }

  const raidRes = await client.query(
    `SELECT s.id, s.merchant_citizen_id, s.crew_citizen_ids, COALESCE(b.name, 'a distant market') AS dest_name
     FROM sim_trade_shipments s LEFT JOIN sim_burg_economy b ON b.burg_id = s.dest_burg_id
     WHERE s.status = 'INTERCEPTED' AND s.resolved_tick = $1
     ORDER BY s.id`,
    [tick]
  );
  const raids: LifeRaid[] = raidRes.rows.map((r: any) => {
    const ids = new Set<number>();
    if (Number(r.merchant_citizen_id) > 0) ids.add(Number(r.merchant_citizen_id));
    for (const c of Array.isArray(r.crew_citizen_ids) ? r.crew_citizen_ids : []) if (Number(c) > 0) ids.add(Number(c));
    return { shipmentId: Number(r.id), citizenIds: Array.from(ids).sort((a, b) => a - b), destName: String(r.dest_name) };
  });

  const cohRes = await client.query(
    `SELECT DISTINCT ON (burg_id, species) burg_id, species, profession, spark_tier, is_null, count
     FROM population_cohorts
     WHERE burg_id = ANY($1::int[]) AND age_band = 'CHILD' AND allegiance = 'CIVILIAN' AND count > 0
     ORDER BY burg_id, species, count DESC, profession`,
    [burgIds]
  );
  const childCohorts = new Map<string, ChildCohort>();
  for (const r of cohRes.rows) {
    childCohorts.set(`${Number(r.burg_id)}:${String(r.species)}`, {
      burgId: Number(r.burg_id),
      species: String(r.species),
      profession: String(r.profession),
      sparkTier: String(r.spark_tier),
      isNull: Boolean(r.is_null),
      count: Number(r.count),
    });
  }

  return {
    tick,
    notables,
    burgNames,
    famineBurgs: sets.famine,
    battleBurgs: sets.battle,
    murderBurgs: sets.murder,
    witchHuntBurgs: sets.witch,
    stormBurgs: sets.storm,
    raids,
    childCohorts,
    firstNames: FIRST_NAMES,
  };
}
