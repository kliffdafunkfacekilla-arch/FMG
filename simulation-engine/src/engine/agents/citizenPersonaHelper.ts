/**
 * citizenPersonaHelper.ts - Generates authentic living citizens and calculates
 * how their distinct human personalities influence their behavior as Cultists,
 * Wardens, or Mandate Zealots.
 */
import { addCellTags } from "../cellTags.js";
import { promoteFromCohort } from "../lod/promote.js";
import { sqlShuffle } from "../rng.js";
import {
  type CitizenPersona,
  recruitCultistPersona,
  recruitWardenPersona,
  recruitMandatePersona,
} from "../macro/shared/personas.js";

export type { CitizenPersona };
export { recruitCultistPersona, recruitWardenPersona, recruitMandatePersona };

/**
 * Backfills any existing agents in sim_agents that lack citizen personas
 */
export async function backfillBlankPersonas(client: any): Promise<number> {
  const blankRes = await client.query(`
    SELECT id, role, sub_role, home_burg_id, name
    FROM sim_agents
    WHERE citizen_name IS NULL OR citizen_name = '' ORDER BY id
  `);

  if (!blankRes.rows || blankRes.rows.length === 0) return 0;

  for (const row of blankRes.rows) {
    let persona: CitizenPersona;
    if (row.role === "Cultist") {
      persona = recruitCultistPersona(`Burg #${row.home_burg_id || 1}`);
    } else if (row.role === "Warden") {
      persona = recruitWardenPersona();
    } else {
      persona = recruitMandatePersona(`Burg #${row.home_burg_id || 1}`);
    }

    const title = `${persona.citizenName} the ${persona.profession}`;
    await client.query(`
      UPDATE sim_agents
      SET citizen_name = $1,
          profession = $2,
          species = $3,
          spark_tier = $4,
          personality_temper = $5,
          personality_instinct = $6,
          motivation = $7,
          name = CASE 
            WHEN name LIKE 'Cabal of %' OR name = 'Grey Warden Flow-Patrol' OR name LIKE 'Chain Chapter of %' 
            THEN $8
            ELSE name 
          END
      WHERE id = $9
    `, [
      persona.citizenName,
      persona.profession,
      persona.species,
      persona.sparkTier,
      persona.temper,
      persona.instinct,
      persona.motivation,
      title,
      row.id
    ]);
  }

  return blankRes.rows.length;
}

/**
 * Injects narrative tags and emotional state updates into real citizens of a burg
 */
export async function tagBurgCitizens(
  client: any,
  settlementId: number,
  tags: string[],
  newTemper?: string | null,
  newMotivation?: string | null,
  professionFilter?: string | null,
  limit: number = 4
): Promise<number> {
  try {
    const tagsJson = JSON.stringify(tags);
    const res = await client.query(`
      UPDATE population_demographics
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
          -- A seeded random point in the burg's citizen id range, then the next $6 matching civilians
          -- (wrapping round). Two short index range scans: ranking every civilian by a hash to pick four
          -- cost ~4 ms a call, and this runs ~90 times a day.
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
      )
      RETURNING citizen_id
    `, [tagsJson, newTemper || null, newMotivation || null, settlementId, professionFilter || null, limit, Math.random()]);
    return res.rowCount || 0;
  } catch (err) {
    return 0;
  }
}

/**
 * Turns a vulnerable or disgruntled citizen inside a burg into a Syndicate Inside Man
 */
export async function recruitInsideMan(
  client: any,
  settlementId: number,
  cartelName: string,
  burgName: string
): Promise<{ name: string; profession: string } | null> {
  try {
    const candidateRes = await client.query(`
      SELECT citizen_id, name, profession, temper
      FROM population_demographics
      WHERE settlement_id = $1
        AND allegiance_status = 'CIVILIAN'
        AND NOT (traits::text LIKE '%#InsideMan%')
        AND (
          temper IN ('DESPERATE', 'BITTER', 'GREEDY', 'VENGEFUL')
          OR profession IN ('Disenfranchised Laborer', 'Gate Sentry', 'City Watchman', 'Merchant Trader', 'Blacksmith')
        )
      ORDER BY (CASE WHEN temper = 'DESPERATE' THEN 1 WHEN temper = 'GREEDY' THEN 2 ELSE 3 END), ${sqlShuffle('citizen_id')}
      LIMIT 1
    `, [settlementId]);

    let picked = candidateRes.rows[0] ? {
      citizen_id: Number(candidateRes.rows[0].citizen_id),
      name: String(candidateRes.rows[0].name),
      profession: String(candidateRes.rows[0].profession),
    } : null;

    if (!picked) {
      const prom = await promoteFromCohort(
        client,
        settlementId,
        { ageBand: "ADULT", allegiance: "CIVILIAN" },
        `insideman:${settlementId}:${cartelName}`
      );
      if (prom) {
        picked = { citizen_id: prom.citizenId, name: prom.name, profession: prom.profession };
        await client.query(`DELETE FROM promoted_slots WHERE citizen_id = $1`, [prom.citizenId]);
      }
    }

    if (!picked) return null;
    const c = picked;

    const tags = ['#InsideMan', '#SyndicateOperative', '#ContrabandContact'];
    if (c.profession.includes('Sentry') || c.profession.includes('Watch')) {
      tags.push('#BribedGateKeeper');
    } else if (c.profession.includes('Merchant') || c.profession.includes('Trader')) {
      tags.push('#FencedGoodsDealer');
    }

    const motiv = `Acting as the secret inside man for ${cartelName} in ${burgName}, facilitating smuggling flues and reporting watch patrol schedules.`;
    const tagsJson = JSON.stringify(tags);

    await client.query(`
      UPDATE population_demographics
      SET traits = (
          SELECT jsonb_agg(DISTINCT elem)
          FROM (
              SELECT jsonb_array_elements_text(COALESCE(traits, '[]'::jsonb)) AS elem
              UNION
              SELECT jsonb_array_elements_text($1::jsonb) AS elem
          ) t
      ),
      temper = 'COMPLICIT',
      motivation = $2
      WHERE citizen_id = $3
    `, [tagsJson, motiv, c.citizen_id]);

    return { name: c.name, profession: c.profession };
  } catch (err) {
    return null;
  }
}

/**
 * Adds environmental tags to a map cell (any cell, rendered tactical layer or not).
 */
export async function tagSectorEnvironment(
  client: any,
  cellId: number,
  tags: string[],
  zLayer: number = 0
): Promise<void> {
  // Stored per cell in sim_cell_tags (and mirrored into any rendered tactical layer); see engine/cellTags.ts.
  // No try/catch: a failed query inside the tick transaction aborts it, so the error must reach the tick.
  await addCellTags(client, cellId, tags, zLayer);
}

