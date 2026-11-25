import type { Delta } from "../../deltas/types.js";

export interface ReaperGhostBurg {
  burgId: number;
  name: string;
  occupierFactionId: number | null;
  urbanTier: number;
}

export interface ReaperGhostShipment {
  id: number;
  merchantCitizenId: number;
  crewCitizenIds: number[];
  pathIndex: number;
  currentCellId: number;
  etaTicks: number;
}

export interface ReaperSnapshot {
  tick: number;
  ghostBurgs: ReaperGhostBurg[];
  ghostShipments: ReaperGhostShipment[];
  caravanCitizenIds: number[];
  paragonIds: number[];
}

export interface ReaperStepResult {
  deltas: Delta[];
  ruinedBurgIds: number[];
}

/**
 * Pure reaper step: strips uninhabited burgs (`pop_null <= 0 && pop_attuned <= 0`), aborts
 * their in-transit convoys, releases caravan crew back to CIVILIAN, removes burgs' paragons &
 * industrial/lair/infra assets, and marks the burg `[Ruin] ...` without deleting the map settlement.
 */
export function stepReaper(snap: ReaperSnapshot): ReaperStepResult {
  if (snap.ghostBurgs.length === 0) {
    return { deltas: [], ruinedBurgIds: [] };
  }

  const deltas: Delta[] = [];

  const uniqueCrewIds = Array.from(new Set(snap.caravanCitizenIds.filter((id) => id > 0))).sort(
    (a, b) => a - b
  );
  for (const citizenId of uniqueCrewIds) {
    deltas.push({
      kind: "citizen.status",
      citizenId,
      status: "CIVILIAN",
    });
  }

  for (const s of snap.ghostShipments) {
    deltas.push({
      kind: "tradeShipment.update",
      shipmentId: s.id,
      status: "ABORTED",
      pathIndex: s.pathIndex,
      currentCellId: s.currentCellId,
      etaTicks: s.etaTicks,
      resolvedTick: snap.tick,
    });
  }

  const uniqueParagonIds = Array.from(new Set(snap.paragonIds.filter((id) => id > 0))).sort(
    (a, b) => a - b
  );
  for (const paragonId of uniqueParagonIds) {
    deltas.push({
      kind: "paragon.die",
      paragonId,
      diedTick: snap.tick,
      cause: "Settlement ruined",
    });
  }

  const ruinedBurgIds: number[] = [];
  for (const b of snap.ghostBurgs) {
    ruinedBurgIds.push(b.burgId);
    deltas.push({
      kind: "burg.stripRuin",
      burgId: b.burgId,
    });

    const isRuinPrefixed = b.name.startsWith("[Ruin] ");
    deltas.push({
      kind: "burg.set",
      burgId: b.burgId,
      fields: {
        occupier_faction_id: null,
        urban_tier: 0,
        workforce_empty: true,
        ...(isRuinPrefixed ? {} : { name: `[Ruin] ${b.name}` }),
      },
    });
  }

  return { deltas, ruinedBurgIds };
}
