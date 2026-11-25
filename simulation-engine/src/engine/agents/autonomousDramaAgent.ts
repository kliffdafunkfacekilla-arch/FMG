import type { PoolClient } from "pg";
import { promoteFromCohort } from "../lod/promote.js";
import { createThread } from "../threads/threadEngine.js";

/**
 * Autonomous Drama Agent (Motive vs. Obstacle Loop)
 * Picks restless actors in pressured burgs, collides their `want`/`flaw`/`line_wont_cross`
 * against a real local target and cell tags via deterministic dice, mutates Postgres state,
 * and opens multi-actor `AUTONOMOUS_CLASH` threads that resolve with or without the party.
 */
export async function runAutonomousDramaAgent(
  client: PoolClient,
  tick: number,
  loreDate: string
): Promise<number> {
  // 1. Find up to 3 pressured burgs that do not already have an open autonomous clash
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

  let clashesOpened = 0;

  for (const burg of burgRes.rows) {
    // 2. Select an instigator paragon in this burg
    const paragonRes = await client.query(
      `SELECT id, name, title, want, flaw, line_wont_cross, corruption_score
       FROM sim_paragons
       WHERE burg_id = $1 AND outlaw_id IS NULL
       ORDER BY corruption_score DESC, id ASC
       LIMIT 3`,
      [burg.burg_id]
    );
    if (paragonRes.rows.length === 0) continue;

    const instigator = paragonRes.rows[(tick + Number(burg.burg_id)) % paragonRes.rows.length];
    const rivalParagon = paragonRes.rows.find((p: any) => p.id !== instigator.id);

    // 3. Pair against a rival paragon or a real adult citizen (promoting from cohort if needed)
    let targetTypedId: string | null = null;
    let targetLabel = "";
    let targetBonus = 1;

    if (rivalParagon && (tick + Number(burg.burg_id)) % 2 === 0) {
      targetTypedId = `paragon:${rivalParagon.id}`;
      targetLabel = `${rivalParagon.name} (${rivalParagon.title || "Paragon"})`;
      targetBonus = 2;
    } else {
      const citRes = await client.query(
        `SELECT citizen_id, name, profession, want, flaw
         FROM population_demographics
         WHERE settlement_id = $1 AND life_stage = 'ADULT' AND allegiance_status = 'CIVILIAN'
         ORDER BY citizen_id ASC
         LIMIT 5`,
        [burg.burg_id]
      );
      if (citRes.rows.length > 0) {
        const cit = citRes.rows[(tick + Number(instigator.id)) % citRes.rows.length];
        targetTypedId = `citizen:${cit.citizen_id}`;
        targetLabel = `${cit.name} (${cit.profession || "Citizen"})`;
        targetBonus = 1;
      } else {
        const promoted = await promoteFromCohort(
          client,
          Number(burg.burg_id),
          { ageBand: "ADULT", allegiance: "CIVILIAN" },
          `drama:${tick}:${burg.burg_id}`,
          tick
        );
        if (promoted) {
          targetTypedId = promoted.entityRef;
          targetLabel = `${promoted.name} (${promoted.profession || "Citizen"})`;
          targetBonus = 1;
        } else if (rivalParagon) {
          targetTypedId = `paragon:${rivalParagon.id}`;
          targetLabel = `${rivalParagon.name} (${rivalParagon.title || "Paragon"})`;
          targetBonus = 2;
        }
      }
    }

    if (!targetTypedId) continue;

    // 4. Read live cell tags to ground the collision in current world tags
    const tagRes = await client.query(
      `SELECT tags FROM sim_cell_tags WHERE cell_id = $1 AND z_layer = 0 LIMIT 1`,
      [burg.cell_id]
    );
    const cellTags: string[] = Array.isArray(tagRes.rows[0]?.tags) ? tagRes.rows[0].tags : [];
    const tagNote = cellTags.length > 0 ? ` [${cellTags.slice(0, 3).join(", ")}]` : "";

    // 5. Check line_wont_cross & roll deterministic opposed check (1d12 + bonus)
    const corruption = Number(instigator.corruption_score || 0);
    const unrest = Number(burg.unrest || 0);
    const oathBroken = unrest > 55 || corruption > 70;
    const instRoll = ((tick * 19 + Number(instigator.id) * 7) % 12) + 1 + Math.floor(corruption / 25);
    const targRoll = ((tick * 23 + Number(burg.burg_id) * 11) % 12) + 1 + targetBonus;
    const instWon = instRoll >= targRoll;

    const wantTxt = String(instigator.want || "consolidate leverage").trim().replace(/\.$/, "");
    const flawTxt = String(instigator.flaw || "ruthlessness").trim().replace(/\.$/, "");
    const lineTxt = String(instigator.line_wont_cross || "open bloodshed").trim().replace(/\.$/, "");

    const unrestBump = instWon ? (oathBroken ? 6 : 4) : 1;
    const crimeBump = instWon ? 2 : 0;

    await client.query(
      `UPDATE sim_burg_economy
       SET unrest = LEAST(100, unrest + $1),
           crime_rate = LEAST(100, crime_rate + $2)
       WHERE burg_id = $3`,
      [unrestBump, crimeBump, burg.burg_id]
    );

    const question = `Will ${instigator.name} force "${wantTxt}" over ${targetLabel} in ${burg.name}?`;
    const stakes = `${instigator.name} (${instigator.title || "Paragon"}, flaw: ${flawTxt}) collided with ${targetLabel} in ${burg.name}${tagNote}. ${oathBroken ? `Pressure pushed past their line (${lineTxt}).` : `Held back by line (${lineTxt}).`} Opening check ${instRoll} vs ${targRoll}.`;

    await createThread(client, {
      question,
      stakes,
      actor_ids: [`paragon:${instigator.id}`, targetTypedId],
      cell_id: Number(burg.cell_id),
      rx: 50,
      ry: 50,
      clock: instWon ? 1 : 0,
      clock_max: 5,
      origin: "reaction",
      rule_id: "AUTONOMOUS_CLASH",
      created_tick: tick,
      on_expire: {
        unrestDelta: 8,
        crimeRateDelta: 4,
        narrativeSummary: `${instigator.name} prevailed over ${targetLabel} in ${burg.name}, deepening local instability.`
      },
      on_resolved_by_party: {
        unrestDelta: -6,
        crimeRateDelta: -3,
        narrativeSummary: `The clash between ${instigator.name} and ${targetLabel} in ${burg.name} was contained.`
      }
    });

    await client.query(
      `INSERT INTO sim_events (tick, lore_date, type, tier, burg_id, cell_id, message)
       VALUES ($1, $2, 'AUTONOMOUS_CLASH', 'MINOR', $3, $4, $5)`,
      [
        tick,
        loreDate,
        burg.burg_id,
        burg.cell_id,
        `[CLASH] ${instigator.name} pressed "${wantTxt}" against ${targetLabel} in ${burg.name}${tagNote} (Roll ${instRoll} vs ${targRoll}; Unrest +${unrestBump}).`
      ]
    );

    clashesOpened++;
  }

  return clashesOpened;
}
