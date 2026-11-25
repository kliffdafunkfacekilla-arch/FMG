import type { PoolClient } from "pg";
import { promoteFromCohort } from "../../lod/promote.js";
import type {
  AutonomousDramaSnapshot,
  DramaBurgSnapshot,
  DramaCitizenSnapshot,
  DramaParagonSnapshot,
} from "./step.js";

/**
 * Loads up to 3 pressured burgs without open AUTONOMOUS_CLASH threads along with batched local
 * paragons, adult civilian candidates (promoting from cohort if absent), and cell tags.
 */
export async function loadAutonomousDrama(
  client: PoolClient,
  tick: number,
  loreDate: string
): Promise<AutonomousDramaSnapshot> {
  const burgRes = await client.query(
    `SELECT b.burg_id, b.name, b.cell_id, b.unrest, b.crime_rate, b.food, b.wealth
     FROM sim_burg_economy b
     WHERE (b.unrest > 15 OR b.crime_rate > 15 OR b.food < 400)
       AND NOT EXISTS (
         SELECT 1 FROM sim_threads t
         WHERE t.cell_id = b.cell_id
           AND t.rule_id = 'AUTONOMOUS_CLASH'
           AND t.state IN ('open', 'escalated')
       )
     ORDER BY (b.unrest + b.crime_rate) DESC, b.food ASC, b.burg_id ASC
     LIMIT 3`
  );

  if (burgRes.rows.length === 0) {
    return { tick, loreDate, burgs: [] };
  }

  const burgIds = burgRes.rows.map((b: any) => Number(b.burg_id));
  const paragonRes = await client.query(
    `SELECT burg_id, id, name, title, want, flaw, line_wont_cross, corruption_score
     FROM (
       SELECT burg_id, id, name, title, want, flaw, line_wont_cross, corruption_score,
              ROW_NUMBER() OVER (PARTITION BY burg_id ORDER BY corruption_score DESC, id ASC) AS rn
       FROM sim_paragons
       WHERE burg_id = ANY($1::int[]) AND outlaw_id IS NULL
     ) p
     WHERE rn <= 3
     ORDER BY burg_id ASC, corruption_score DESC, id ASC`,
    [burgIds]
  );

  const paragonsByBurg = new Map<number, DramaParagonSnapshot[]>();
  for (const r of paragonRes.rows) {
    const bid = Number(r.burg_id);
    let list = paragonsByBurg.get(bid);
    if (!list) {
      list = [];
      paragonsByBurg.set(bid, list);
    }
    list.push({
      id: Number(r.id),
      name: String(r.name),
      title: r.title ? String(r.title) : null,
      want: r.want ? String(r.want) : null,
      flaw: r.flaw ? String(r.flaw) : null,
      lineWontCross: r.line_wont_cross ? String(r.line_wont_cross) : null,
      corruptionScore: Number(r.corruption_score) || 0,
    });
  }

  const activeBurgs = burgRes.rows.filter((b: any) => (paragonsByBurg.get(Number(b.burg_id))?.length || 0) > 0);
  if (activeBurgs.length === 0) {
    return { tick, loreDate, burgs: [] };
  }

  const needCitBurgIds: number[] = [];
  const activeCellIds: number[] = [];
  for (const b of activeBurgs) {
    const bid = Number(b.burg_id);
    activeCellIds.push(Number(b.cell_id));
    const pList = paragonsByBurg.get(bid)!;
    const instigator = pList[(tick + bid) % pList.length]!;
    const rivalParagon = pList.find((p) => p.id !== instigator.id);
    if (!(rivalParagon && (tick + bid) % 2 === 0)) {
      needCitBurgIds.push(bid);
    }
  }

  const citizensByBurg = new Map<number, DramaCitizenSnapshot[]>();
  if (needCitBurgIds.length > 0) {
    const citRes = await client.query(
      `SELECT settlement_id, citizen_id, name, profession
       FROM (
         SELECT settlement_id, citizen_id, name, profession,
                ROW_NUMBER() OVER (PARTITION BY settlement_id ORDER BY citizen_id ASC) AS rn
         FROM population_demographics
         WHERE settlement_id = ANY($1::int[]) AND life_stage = 'ADULT' AND allegiance_status = 'CIVILIAN'
       ) c
       WHERE rn <= 5
       ORDER BY settlement_id ASC, citizen_id ASC`,
      [needCitBurgIds]
    );
    for (const r of citRes.rows) {
      const bid = Number(r.settlement_id);
      let list = citizensByBurg.get(bid);
      if (!list) {
        list = [];
        citizensByBurg.set(bid, list);
      }
      list.push({
        targetTypedId: `citizen:${r.citizen_id}`,
        name: String(r.name),
        profession: r.profession ? String(r.profession) : null,
      });
    }
  }

  const tagsByCell = new Map<number, string[]>();
  if (activeCellIds.length > 0) {
    const tagRes = await client.query(
      `SELECT cell_id, tags FROM sim_cell_tags WHERE cell_id = ANY($1::int[]) AND z_layer = 0`,
      [activeCellIds]
    );
    for (const r of tagRes.rows) {
      tagsByCell.set(Number(r.cell_id), Array.isArray(r.tags) ? r.tags.map(String) : []);
    }
  }

  const burgs: DramaBurgSnapshot[] = [];
  for (const b of activeBurgs) {
    const bid = Number(b.burg_id);
    const cid = Number(b.cell_id);
    const pList = paragonsByBurg.get(bid)!;
    const instigator = pList[(tick + bid) % pList.length]!;
    const rivalParagon = pList.find((p) => p.id !== instigator.id);
    let cits = citizensByBurg.get(bid) || [];

    if (!(rivalParagon && (tick + bid) % 2 === 0) && cits.length === 0) {
      const promoted = await promoteFromCohort(
        client,
        bid,
        { ageBand: "ADULT", allegiance: "CIVILIAN" },
        `drama:${tick}:${bid}`,
        tick
      );
      if (promoted) {
        cits = [
          {
            targetTypedId: promoted.entityRef,
            name: promoted.name,
            profession: promoted.profession || "Citizen",
          },
        ];
      }
    }

    burgs.push({
      burgId: bid,
      name: String(b.name),
      cellId: cid,
      unrest: Number(b.unrest) || 0,
      crimeRate: Number(b.crime_rate) || 0,
      food: Number(b.food) || 0,
      wealth: Number(b.wealth) || 0,
      paragons: pList,
      citizens: cits,
      cellTags: tagsByCell.get(cid) || [],
    });
  }

  return { tick, loreDate, burgs };
}
