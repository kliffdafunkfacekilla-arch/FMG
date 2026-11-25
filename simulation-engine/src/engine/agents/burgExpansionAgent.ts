// ─────────────────────────────────────────────────────────────────────────────
//  Burg Expansion Agent
//  Handles both:
//  1. Outlying Regional Growth: Prosperous burgs establish satellite hamlets,
//     farming estates, logging camps, and watchtowers in adjacent cells.
//  2. Grand Faction Colonization: Rich factions fund frontier settlements.
// ─────────────────────────────────────────────────────────────────────────────

import { flushStepDeltas } from "../deltas/index.js";
import { getBurgLivingTotals, transferCohortsBetweenBurgs } from "../entities/population.js";
import { promoteBatchFromCohorts, type PromoteBatchSpec } from "../lod/promote.js";
import { loadBurgExpansion } from "../macro/burgExpansion/load.js";
import { stepBurgExpansion, uniqueBurgName, type SatelliteType } from "../macro/burgExpansion/step.js";

export { uniqueBurgName, type SatelliteType };

/** The trades a parent burg sends to found each kind of satellite (first choice; anyone fills the rest). */
const FOUNDER_TRADES: Record<SatelliteType, string[]> = {
  HAMLET: ["Farmer", "Miller", "Carpenter", "Baker", "Disenfranchised Laborer", "Stonemason"],
  FARMLAND: ["Farmer", "Miller", "Disenfranchised Laborer", "Brewmaster"],
  LOGGING: ["Carpenter", "Cooper", "Bowyer", "Tanner", "Disenfranchised Laborer"],
  WATCHTOWER: ["City Watchman", "Gate Sentry", "Armorer", "Bowyer", "Blacksmith"],
};

/**
 * Moves real people from the parent burg's cohorts to a newly founded satellite and promotes
 * named adult/child founders into `population_demographics` + `entities` so maps and stories have real residents.
 * Returns how many named founder records were promoted for the satellite.
 */
export async function settleSatellite(
  client: any,
  parent: { burg_id: number; name: string },
  satellite: { burg_id: number; cell_id: number; name: string; type: SatelliteType; pioneers: number }
): Promise<number> {
  const parentTotals = await getBurgLivingTotals(client, [parent.burg_id]);
  const pt = parentTotals.get(parent.burg_id);
  if (!pt || pt.people <= 0) return 0;

  const econRes = await client.query(`SELECT COALESCE(record_unit, 12)::int AS unit FROM sim_burg_economy WHERE burg_id = $1 LIMIT 1`, [parent.burg_id]);
  const perRecord = Math.min(40, Math.max(3, Number(econRes.rows[0]?.unit || 8.5)));

  const { movedPeople } = await transferCohortsBetweenBurgs(
    client,
    parent.burg_id,
    satellite.burg_id,
    satellite.pioneers,
    FOUNDER_TRADES[satellite.type]
  );
  if (movedPeople <= 0) return 0;

  await client.query(`UPDATE sim_burg_economy SET record_unit = $1 WHERE burg_id = $2`, [Math.round(perRecord), satellite.burg_id]);

  const totalFounders = Math.max(3, Math.min(16, Math.round(movedPeople / perRecord)));
  const adultsWanted = Math.max(2, Math.ceil(totalFounders * 0.75));
  const childrenWanted = Math.max(0, totalFounders - adultsWanted);
  const motivation = `Left ${parent.name} to help found ${satellite.name}.`;

  const specs: PromoteBatchSpec[] = [];
  for (let i = 0; i < adultsWanted; i++) {
    specs.push({
      burgId: satellite.burg_id,
      filter: {
        ageBand: "ADULT",
        allegiance: "CIVILIAN",
        preferredProfessions: FOUNDER_TRADES[satellite.type],
      },
      slotKey: `founder:${satellite.burg_id}:adult:${i}`,
      permanent: true,
      birthplace: parent.name,
      motivationOverride: motivation,
      workplaceBurgName: satellite.name,
    });
  }
  for (let i = 0; i < childrenWanted; i++) {
    specs.push({
      burgId: satellite.burg_id,
      filter: { ageBand: "CHILD", allegiance: "CIVILIAN" },
      slotKey: `founder:${satellite.burg_id}:child:${i}`,
      permanent: true,
      birthplace: parent.name,
      motivationOverride: motivation,
      workplaceBurgName: satellite.name,
    });
  }

  const promoted = (await promoteBatchFromCohorts(client, specs, 1)).filter((r) => r !== null);
  return promoted.length;
}

export async function runBurgExpansionAgent(client: any, tick: number, loreDate: string) {
  // Run expansion checks every 10 ticks
  if (tick % 10 !== 0) return;

  const snap = await loadBurgExpansion(client, tick, loreDate);
  const { deltas, founded } = stepBurgExpansion(snap, { random: Math.random });
  if (deltas.length === 0) return;

  const flushRes = await flushStepDeltas(client, "agent:burgExpansion", tick, deltas);
  const rejectedSatIds = new Set(
    flushRes.rejected
      .filter((r) => r.delta.kind === "burg.createSatellite")
      .map((r) => (r.delta as { burgId: number }).burgId)
  );

  for (const f of founded) {
    if (rejectedSatIds.has(f.burgId)) continue;
    const settlers = await settleSatellite(
      client,
      { burg_id: f.parentBurgId, name: f.parentName },
      {
        burg_id: f.burgId,
        cell_id: f.cellId,
        name: f.name,
        type: f.type,
        pioneers: f.pioneers,
      }
    );
    console.log(
      `[BurgExpansion] Founded satellite ${f.type} "${f.name}" (Burg #${f.burgId}) in Cell ${f.cellId} for parent ${f.parentName} with ${settlers} settler records`
    );
  }
}
