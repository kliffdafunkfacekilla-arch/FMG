import type { Delta } from "../../deltas/types.js";
import {
  findNearestGrovePure,
  stepTowardCellPure,
  type CellPoint,
  type GroveCoord,
  type OpposingAgentSnap,
} from "../shared/agentNav.js";
import { recruitCultistPersona } from "../shared/personas.js";

export interface CultistRecruitCitizen {
  dbCitizenId: number | null;
  citizenName: string;
  profession: string;
  species: string;
  sparkTier: string;
  temper: string;
  instinct: string;
  motivation: string;
}

export interface CultistRecruitCandidate {
  burgId: number;
  cellId: number;
  wealth: number;
  unrest: number;
  burgName: string;
  citizen: CultistRecruitCitizen | null;
}

export interface CultistRecruitSnapshot {
  tick: number;
  loreDate: string;
  candidates: CultistRecruitCandidate[];
}

export interface CultistGroveSnapshot extends GroveCoord {
  repairRoll: boolean;
}

export interface CultistAgentSnapshot {
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
  corruption: number;
  ageTicks: number;
}

export interface CultistsSnapshot {
  tick: number;
  loreDate: string;
  isShadowWeek: boolean;
  groves: CultistGroveSnapshot[];
  cultists: CultistAgentSnapshot[];
  wardens: OpposingAgentSnap[];
  cellCoords: Record<number, CellPoint>;
  findNearestCell?: (x: number, y: number) => number | null;
  apocalypseLoggedMessages: string[];
  allBurgIds: number[];
}

const TARGET_BESIEGER_COUNT = 144;

/**
 * Pure Stage 1 step: converts resolved civilian recruits (or fallback personas) into new Cultist
 * infiltrators and optional CULT_INFILTRATION events.
 */
export function stepCultistRecruitment(
  snap: CultistRecruitSnapshot,
  opts: { random?: () => number } = {}
): Delta[] {
  const random = opts.random ?? Math.random;
  const deltas: Delta[] = [];

  for (const cand of snap.candidates) {
    const burgName = cand.burgName || `Burg #${cand.burgId}`;
    const c =
      cand.citizen ??
      (() => {
        const p = recruitCultistPersona(burgName, random);
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
        status: "CULTIST_INFILTRATOR",
      });
    }

    deltas.push({
      kind: "agent.create",
      name: `${c.citizenName} (${c.profession})`,
      citizenName: c.citizenName,
      profession: c.profession,
      species: c.species,
      sparkTier: c.sparkTier,
      personalityTemper: c.temper,
      personalityInstinct: c.instinct,
      motivation: c.motivation,
      role: "Cultist",
      subRole: "Cultist_Infiltrator",
      homeBurgId: cand.burgId,
      locationCellId: cand.cellId,
      state: "INFILTRATING",
      corruption: 5,
      ageTicks: 0,
      activePlot: `Infiltrating ${cand.burgName} [${c.temper}]: ${c.motivation}`,
      createdTick: snap.tick,
    });

    if (random() < 0.20) {
      deltas.push({
        kind: "event.log",
        tick: snap.tick,
        type: "CULT_INFILTRATION",
        message: `Whispers of Shlaar seep through the flawed prison matrix into ${cand.burgName}, echoing the dragons' madness. ${c.citizenName}, a Sparkborn ${c.profession.toLowerCase()}, was seduced by the cosmic whispers and initiated into the cabal.`,
        tier: "MINOR",
        burgId: cand.burgId,
        loreDate: snap.loreDate,
      });
    }
  }

  return deltas;
}

/**
 * Pure Stage 2 step: handles non-Shadowfall ambient grove self-repair, infiltrator siphoning &
 * exodus, overland pilgrimage + warden skirmishes, seal sieges, and broken-seal apocalypse checks.
 */
export function stepCultists(
  snap: CultistsSnapshot,
  opts: { random?: () => number } = {}
): Delta[] {
  const random = opts.random ?? Math.random;
  const deltas: Delta[] = [];

  const besiegedGroveIds = new Set<number>();
  let currentBesiegers = 0;
  for (const c of snap.cultists) {
    if (c.state === "BESIEGING_SEAL" && c.targetGroveId !== null) {
      besiegedGroveIds.add(c.targetGroveId);
    }
    if (c.state === "BESIEGING_SEAL" || c.state === "TRAVELING_TO_SEAL") {
      currentBesiegers++;
    }
  }

  const groveStrengths = new Map<number, number>();
  const groveDeltas = new Map<number, number>();
  const groveById = new Map<number, CultistGroveSnapshot>();
  for (const g of snap.groves) {
    let strength = g.sealStrength;
    if (!snap.isShadowWeek && strength > 0 && strength < 100 && !besiegedGroveIds.has(g.id) && g.repairRoll) {
      strength = Math.min(100, strength + 1);
      groveDeltas.set(g.id, (groveDeltas.get(g.id) || 0) + 1);
    }
    groveStrengths.set(g.id, strength);
    groveById.set(g.id, g);
  }

  const getCoord = (cid: number): CellPoint | null => snap.cellCoords[cid] || null;
  const findNearest = snap.findNearestCell ?? (() => null);

  const wardensByCell = new Map<number, OpposingAgentSnap[]>();
  for (const w of snap.wardens) {
    let list = wardensByCell.get(w.locationCellId);
    if (!list) {
      list = [];
      wardensByCell.set(w.locationCellId, list);
    }
    list.push(w);
  }

  for (const c of snap.cultists) {
    const age = (c.ageTicks || 0) + 1;
    let corruption = c.corruption || 0;
    let state = c.state || "INFILTRATING";
    let subRole = c.subRole || "Cultist_Infiltrator";
    let locCellId = c.locationCellId;
    let targetCellId = c.targetCellId;
    let targetGroveId = c.targetGroveId;
    const temper = c.temper || "DESPERATE";
    const citizenName = c.citizenName || c.name;
    const profession = c.profession || "Laborer";

    const siphonMult = temper === "GREEDY" ? 2.0 : temper === "DESPERATE" ? 1.3 : 1.0;
    const unrestSpike = temper === "FANATICAL" ? 2 : 1;
    const sealDrainBonus = temper === "SCHOLARLY" ? 2 : 1;

    if (state === "INFILTRATING") {
      corruption += Math.floor(random() * 2 + 1);
      const burgId = c.homeBurgId;

      const coinTheft = Math.round(Math.floor(random() * 6 + 3) * siphonMult);
      if (burgId) {
        deltas.push({
          kind: "burg.adjust",
          burgId,
          wealth: -coinTheft,
          unrest: unrestSpike,
        });
      }

      if (locCellId) {
        deltas.push({
          kind: "cell.adjust",
          cellId: locCellId,
          ecoBlight: 0.03,
        });
      }

      const needsBesiegers = currentBesiegers < TARGET_BESIEGER_COUNT;
      const shouldExodus = needsBesiegers || corruption >= 35 || random() < 0.08;

      if (shouldExodus && locCellId) {
        const nearestGrove = findNearestGrovePure(locCellId, snap.groves, getCoord);
        if (nearestGrove) {
          state = "TRAVELING_TO_SEAL";
          subRole = "Cultist_Zealot";
          targetGroveId = nearestGrove.id;
          targetCellId = nearestGrove.cellId;

          if (random() < 0.25) {
            deltas.push({
              kind: "event.log",
              tick: snap.tick,
              type: "CULT_EXODUS",
              message: `Having siphoned coin from within the shadows, ${citizenName} (${profession}) slipped past city watchmen, marching a cabal toward the Prison of ${nearestGrove.dragonName}!`,
              tier: "MINOR",
              ...(burgId ? { burgId } : {}),
              loreDate: snap.loreDate,
            });
          }
        }
      }
    } else if (state === "TRAVELING_TO_SEAL") {
      corruption += 1;
      if (!targetCellId || !targetGroveId) {
        const nearestGrove = findNearestGrovePure(locCellId, snap.groves, getCoord);
        if (nearestGrove) {
          targetGroveId = nearestGrove.id;
          targetCellId = nearestGrove.cellId;
        }
      }

      if (targetCellId) {
        const moveResult = stepTowardCellPure(locCellId, targetCellId, 65, getCoord, findNearest, wardensByCell);
        locCellId = moveResult.nextCellId;

        deltas.push({
          kind: "cell.adjust",
          cellId: locCellId,
          ecoBlight: 0.02,
        });

        if (moveResult.collidedWith) {
          corruption = Math.min(100, corruption + 5);
          if (random() < 0.35) {
            deltas.push({
              kind: "event.log",
              tick: snap.tick,
              type: "CULT_WARDEN_SKIRMISH",
              message: `⚔️ INTERCEPTION: Cultist ${citizenName} (${profession}) was intercepted by Warden Sentinel ${moveResult.collidedWith.name} at Cell #${locCellId}! The cabal was forced into a desperate retreat into the shadows.`,
              tier: "MINOR",
              cellId: locCellId,
              loreDate: snap.loreDate,
            });
          }
        }

        if (moveResult.arrived || locCellId === targetCellId) {
          state = "BESIEGING_SEAL";
          const dragonName = (targetGroveId && groveById.get(targetGroveId)?.dragonName) || "Chaos";
          if (random() < 0.25) {
            deltas.push({
              kind: "event.log",
              tick: snap.tick,
              type: "SEAL_BESIEGED",
              message: `${citizenName} (${profession}) reached the perimeter of the Prison of ${dragonName}, joining the siege circle to shatter the dragon seal!`,
              tier: "MINOR",
              loreDate: snap.loreDate,
            });
          }
        }
      }
    } else if (state === "BESIEGING_SEAL") {
      corruption += 2;

      if (subRole !== "Cult_Priest" && (corruption >= 70 || age >= 40)) {
        subRole = "Cult_Priest";
        const dName = (targetGroveId && groveById.get(targetGroveId)?.dragonName) || "Chaos";
        deltas.push({
          kind: "event.log",
          tick: snap.tick,
          type: "CULT_PRIEST_ASCENSION",
          message: `The former ${profession.toLowerCase()}, ${citizenName}, has surrendered to primordial madness at the Prison of ${dName}, ascending as High Priest of ${dName}!`,
          tier: "MAJOR",
          loreDate: snap.loreDate,
        });
      }

      const isPriest = subRole === "Cult_Priest";
      const doesDrain = isPriest ? random() < 0.35 : random() < 0.15;
      const drainAmt = doesDrain ? (isPriest ? (random() < 0.5 ? 2 : 1) * sealDrainBonus : 1) : 0;

      if (targetGroveId && drainAmt > 0) {
        const grove = groveById.get(targetGroveId);
        if (grove) {
          const curStr = groveStrengths.get(targetGroveId) ?? grove.sealStrength;
          const nextStr = Math.max(0, curStr - drainAmt);
          groveStrengths.set(targetGroveId, nextStr);
          groveDeltas.set(targetGroveId, (groveDeltas.get(targetGroveId) || 0) - drainAmt);

          if (nextStr <= 50) {
            deltas.push({
              kind: "chaosZone.upsert",
              cellId: grove.cellId,
              intensity: Math.round((100 - nextStr) * 0.9),
              type: "CRACKED_DRAGON_SEAL_LEAK",
              updateOnConflict: true,
            });
          }

          if ((nextStr === 50 || nextStr === 25 || nextStr === 10) && snap.tick % 3 === 0) {
            deltas.push({
              kind: "event.log",
              tick: snap.tick,
              type: "DRAGON_SEAL_CRACKING",
              message: `⚠️ SEAL VULNERABILITY ALERT: The sacred seal binding ${grove.dragonName} has weakened to ${nextStr}% integrity! Ambient chaos torrents are leaking across Cell #${grove.cellId}!`,
              tier: "CRITICAL",
              cellId: grove.cellId,
              loreDate: snap.loreDate,
            });
          }
        }
      }

      if (locCellId) {
        deltas.push({
          kind: "cell.adjust",
          cellId: locCellId,
          ecoBlight: isPriest ? 0.06 : 0.03,
        });
      }
    }

    deltas.push({
      kind: "agent.update",
      agentId: c.id,
      fields: {
        location_cell_id: locCellId,
        target_cell_id: targetCellId,
        target_grove_id: targetGroveId,
        state,
        sub_role: subRole,
        corruption,
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

  // World-ending apocalypse check for any broken seal
  for (const g of snap.groves) {
    const finalStrength = groveStrengths.get(g.id) ?? g.sealStrength;
    if (finalStrength > 0) continue;
    const alreadyLogged = snap.apocalypseLoggedMessages.some((m) => m.includes(g.dragonName));
    if (alreadyLogged) continue;

    deltas.push({
      kind: "event.log",
      tick: snap.tick,
      type: "WORLD_ENDING_APOCALYPSE",
      message: `☠️ WORLD-ENDING APOCALYPSE: The sacred seal binding the Chaos Dragon ${g.dragonName} (${g.powerDomain}) has been completely shattered (0%)! The colossal Primordial Chaos Dragon bursts free from the abyssal subterranean depths into the sky! Reality tears asunder, liquid fire rains across continents, global unrest surges to 100%, and cataclysmic doom descends upon Ostraka!`,
      tier: "CRITICAL",
      cellId: g.cellId,
      loreDate: snap.loreDate,
    });

    for (const bid of snap.allBurgIds) {
      deltas.push({ kind: "burg.adjust", burgId: bid, unrest: 40 });
    }
    deltas.push({ kind: "cell.set", cellId: g.cellId, fields: { eco_blight: 100.0 } });
    deltas.push({
      kind: "tags.add",
      target: { kind: "cell", cellId: g.cellId, zLayer: 0 },
      tags: [
        "#BrokenDragonSeal",
        `#AwakenedChaosDragon_${g.dragonName}`,
        "#ApocalypseFire",
        "#PrimordialDoom",
      ],
    });
  }

  return deltas;
}
