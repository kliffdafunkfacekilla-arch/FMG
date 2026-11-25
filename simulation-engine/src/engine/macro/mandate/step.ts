import type { Delta } from "../../deltas/types.js";
import { findNearestGrovePure, stepTowardCellPure, type CellPoint, type GroveCoord } from "../shared/agentNav.js";
import { recruitMandatePersona } from "../shared/personas.js";

export interface MandateUnrestBurg {
  burgId: number;
  cellId: number;
  unrest: number;
  name: string;
  popNull: number;
  hasWarband: boolean;
}

export interface MandateRecruitCitizen {
  dbCitizenId: number | null;
  citizenName: string;
  profession: string;
  species: string;
  sparkTier: string;
  temper: string;
  instinct: string;
  motivation: string;
}

export interface MandateRecruitEntry {
  burg: MandateUnrestBurg;
  citizen: MandateRecruitCitizen | null;
}

export interface MandateWarbandSnapshot {
  id: number;
  name: string;
  citizenName: string | null;
  profession: string | null;
  temper: string | null;
  subRole: string | null;
  homeBurgId: number | null;
  locationCellId: number;
  targetCellId: number | null;
  targetGroveId: number | null;
  state: string;
  drainedPower: number;
  ageTicks: number;
}

export interface MandateWarbandsSnapshot {
  tick: number;
  loreDate: string;
  warbands: MandateWarbandSnapshot[];
  groves: GroveCoord[];
  homeCellByBurg: Record<number, number>;
  cellCoords: Record<number, CellPoint>;
  getCoord?: (cellId: number) => CellPoint | null;
  findNearestCell?: (x: number, y: number) => number | null;
}

/** Pure Stage 1 planner: picks unrestful burgs without a Chain_Zealot warband that roll < 0.25. */
export function planMandateRecruits(
  burgs: MandateUnrestBurg[],
  existingWarbandBurgIds: Set<number>,
  opts: { random?: () => number } = {}
): MandateUnrestBurg[] {
  const random = opts.random ?? Math.random;
  const chosen: MandateUnrestBurg[] = [];
  for (const b of burgs) {
    if (!b.hasWarband && !existingWarbandBurgIds.has(b.burgId) && random() < 0.25) {
      chosen.push(b);
    }
  }
  return chosen;
}

/**
 * Pure Stage 1 delta builder: emits civilian status conversions, new Chain_Zealot warband agents,
 * and CHAIN_WARBAND_FORGED events for already-resolved recruit candidates.
 */
export function buildMandateRecruitDeltas(
  tick: number,
  loreDate: string,
  recruits: MandateRecruitEntry[],
  opts: { random?: () => number } = {}
): Delta[] {
  const random = opts.random ?? Math.random;
  const deltas: Delta[] = [];

  for (const entry of recruits) {
    const burg = entry.burg;
    const burgName = burg.name || `Burg #${burg.burgId}`;
    const c =
      entry.citizen ??
      (() => {
        const p = recruitMandatePersona(burgName, random);
        return {
          dbCitizenId: null,
          citizenName: p.citizenName,
          profession: p.profession,
          species: p.species,
          sparkTier: p.sparkTier,
          temper: p.temper,
          instinct: p.instinct,
          motivation: p.motivation,
        };
      })();

    if (c.dbCitizenId) {
      deltas.push({
        kind: "citizen.status",
        citizenId: c.dbCitizenId,
        status: "MANDATE_ZEALOT",
      });
    }

    deltas.push({
      kind: "agent.create",
      name: `Inquisitor ${c.citizenName} (${c.profession})`,
      citizenName: c.citizenName,
      profession: c.profession,
      species: c.species,
      sparkTier: c.sparkTier,
      personalityTemper: c.temper,
      personalityInstinct: c.instinct,
      motivation: c.motivation,
      role: "Chain_Zealot",
      subRole: "Chain_Inquisitor",
      homeBurgId: burg.burgId,
      locationCellId: burg.cellId,
      state: "WITCH_HUNTING",
      drainedPower: 0,
      ageTicks: 0,
      activePlot: `Null crusade outside ${burg.name} [${c.temper}]: ${c.motivation}`,
      createdTick: tick,
    });

    if (random() < 0.3) {
      deltas.push({
        kind: "event.log",
        tick,
        type: "CHAIN_WARBAND_FORGED",
        message: `Fanatical Nulls outside ${burg.name} banded together under ${c.citizenName}, a ${c.temper.toLowerCase()} former ${c.profession.toLowerCase()}, forging a chapter of the Mandate of the Chain.`,
        tier: "MINOR",
        burgId: burg.burgId,
        loreDate,
      });
    }
  }

  return deltas;
}

/**
 * Pure Stage 2 step: advances active Mandate of the Chain warbands through witch-hunting,
 * spark saturation pilgrimage, and seal-reinforcing chain discharge.
 */
export function stepMandateWarbands(
  snap: MandateWarbandsSnapshot,
  opts: { random?: () => number } = {}
): Delta[] {
  const random = opts.random ?? Math.random;
  const deltas: Delta[] = [];

  if (snap.warbands.length === 0) return deltas;

  const getCoord = snap.getCoord ?? ((cid: number): CellPoint | null => snap.cellCoords[cid] || null);
  const findNearest = snap.findNearestCell ?? (() => null);

  const groveStrengths = new Map<number, number>();
  const groveDragons = new Map<number, string>();
  const groveDeltas = new Map<number, number>();
  for (const g of snap.groves) {
    groveStrengths.set(g.id, g.sealStrength);
    groveDragons.set(g.id, g.dragonName);
  }

  for (const wb of snap.warbands) {
    const age = (wb.ageTicks || 0) + 1;
    let drainedPower = wb.drainedPower || 0;
    let state = wb.state || "WITCH_HUNTING";
    const subRole = wb.subRole || "Chain_Inquisitor";
    let locCellId = wb.locationCellId;
    let targetCellId = wb.targetCellId;
    let targetGroveId = wb.targetGroveId;
    const burgId = wb.homeBurgId;
    const temper = wb.temper || "FANATICAL";
    const citizenName = wb.citizenName || wb.name;
    const profession = wb.profession || "Laborer";

    const ferocityMult = temper === "VENGEFUL" ? 1.8 : temper === "BITTER" ? 1.5 : 1.0;

    const awayFromHome = state === "WITCH_HUNTING" && Boolean(targetCellId) && locCellId !== targetCellId;
    if (awayFromHome && targetCellId) {
      const moveResult = stepTowardCellPure(locCellId, targetCellId, 65, getCoord, findNearest);
      locCellId = moveResult.nextCellId;
      if (moveResult.arrived) locCellId = targetCellId;
    }

    if (state === "WITCH_HUNTING" && awayFromHome) {
      // still walking back from discharging at a prison
    } else if (state === "WITCH_HUNTING") {
      if (random() < 0.65) {
        const stolenSpark = Math.round(Math.floor(random() * 12 + 15) * ferocityMult);
        drainedPower += stolenSpark;

        if (burgId) {
          deltas.push({
            kind: "burg.adjust",
            burgId,
            popAttuned: -1,
            unrest: -1,
          });
        }

        if (random() < 0.05) {
          deltas.push({
            kind: "event.log",
            tick: snap.tick,
            type: "WITCH_HUNT_EXECUTION",
            message: `${citizenName} (${profession}) and their chain-militia cornered a wild sparkborn in the outskirts of Burg ${burgId || "province"}, draining their power into humming null-iron shackles.`,
            tier: "MINOR",
            ...(burgId ? { burgId } : {}),
            loreDate: snap.loreDate,
          });
        }
      }

      if (drainedPower >= 50) {
        const nearestGrove = findNearestGrovePure(locCellId, snap.groves, getCoord);
        if (nearestGrove) {
          state = "PILGRIMAGE_TO_SEAL";
          targetGroveId = nearestGrove.id;
          targetCellId = nearestGrove.cellId;

          if (random() < 0.25) {
            deltas.push({
              kind: "event.log",
              tick: snap.tick,
              type: "CHAIN_PILGRIMAGE",
              message: `Carrying shackles heavy with stolen spark power, ${citizenName} (${profession}) led their Mandate pilgrimage toward the Prison of ${nearestGrove.dragonName} to cleanse the land.`,
              tier: "MINOR",
              ...(burgId ? { burgId } : {}),
              loreDate: snap.loreDate,
            });
          }
        }
      }
    } else if (state === "PILGRIMAGE_TO_SEAL") {
      if (targetCellId && locCellId === targetCellId) {
        state = "DISCHARGING_CHAINS";
      } else if (targetCellId) {
        const moveResult = stepTowardCellPure(locCellId, targetCellId, 65, getCoord, findNearest);
        locCellId = moveResult.nextCellId;
        if (moveResult.arrived || locCellId === targetCellId) {
          state = "DISCHARGING_CHAINS";
        }
      }
    } else if (state === "DISCHARGING_CHAINS") {
      const preStrength = targetGroveId && groveStrengths.has(targetGroveId) ? groveStrengths.get(targetGroveId)! : 100;
      const dragonName = (targetGroveId && groveDragons.get(targetGroveId)) || "Chaos";
      const strengthBonus = Math.floor(random() * 3 + 5);

      if (targetGroveId) {
        groveDeltas.set(targetGroveId, (groveDeltas.get(targetGroveId) || 0) + strengthBonus);
        if (groveStrengths.has(targetGroveId)) {
          groveStrengths.set(targetGroveId, Math.min(100, preStrength + strengthBonus));
        }
      }

      drainedPower = 0;
      state = "WITCH_HUNTING";

      if (burgId && snap.homeCellByBurg[burgId] !== undefined) {
        targetCellId = snap.homeCellByBurg[burgId]!;
      } else if (burgId) {
        targetCellId = locCellId;
      }

      if ((preStrength || 100) < 40 || (snap.tick + wb.id) % 15 === 0) {
        deltas.push({
          kind: "event.log",
          tick: snap.tick,
          type: "CHAIN_PURIFICATION_IRON",
          message: `⛓️ THE IRON REINFORCEMENT: ${citizenName} (${profession}) knelt before the Prison of ${dragonName}, discharging their glowing chains! Convinced they purged a demonic font, their stolen spark energy has reinforced the ancient cosmic seal (+${strengthBonus}% Seal Strength)!`,
          tier: "MINOR",
          loreDate: snap.loreDate,
        });
      }
    }

    deltas.push({
      kind: "agent.update",
      agentId: wb.id,
      fields: {
        location_cell_id: locCellId,
        target_cell_id: targetCellId,
        target_grove_id: targetGroveId,
        state,
        sub_role: subRole,
        drained_power: drainedPower,
        age_ticks: age,
      },
    });
  }

  for (const groveId of Array.from(groveDeltas.keys()).sort((a, b) => a - b)) {
    const sealDelta = groveDeltas.get(groveId)!;
    if (sealDelta !== 0) {
      deltas.push({ kind: "grove.adjust", groveId, sealDelta });
    }
  }

  return deltas;
}
