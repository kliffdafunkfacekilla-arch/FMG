import { isYearEnd } from "../../canon/calendar.js";
import { VERGE_COORD } from "../../canon/dragonPrisons.js";
import type { Delta } from "../../deltas/types.js";
import {
  findNearestAgentCellPure,
  stepTowardCellPure,
  type CellPoint,
  type GroveCoord,
  type OpposingAgentSnap,
} from "../shared/agentNav.js";
import { recruitWardenPersona } from "../shared/personas.js";

const CONVERGENCE_SPIRE_CELL = VERGE_COORD.cell;
const TARGET_WARDEN_COUNT = 72;

export interface WardenAwakeningWard {
  id: number;
  cellId: number;
  flowId: number | null;
  pathName: string;
}

export interface WardenAwakeningCitizen {
  id: number | null;
  name: string;
  profession: string;
  species: string;
  sparkTier: string;
  temper: string;
  instinct: string;
  motivation: string;
}

export interface WardenAwakeningSnapshot {
  tick: number;
  loreDate: string;
  shouldRecharge: boolean;
  ward: WardenAwakeningWard | null;
  dbCitizen: WardenAwakeningCitizen | null;
}

export interface WardenAgentSnapshot {
  id: number;
  name: string;
  citizenName: string | null;
  profession: string | null;
  temper: string | null;
  sparkTier: string | null;
  subRole: string | null;
  locationCellId: number | null;
  targetCellId: number | null;
  targetGroveId: number | null;
  state: string;
  corruption: number;
  ageTicks: number;
}

export interface CultistTargetSnap extends OpposingAgentSnap {
  cellId: number;
  state: string;
  targetGroveId: number | null;
  x: number;
  y: number;
}

export interface HermitAgentSnapshot {
  id: number;
  name: string;
  locationCellId: number;
  ageTicks: number;
}

export interface WardensSnapshot {
  tick: number;
  loreDate: string;
  wardens: WardenAgentSnapshot[];
  cultists: CultistTargetSnap[];
  groves: GroveCoord[];
  flowWaypoints: Record<number, number[]>;
  hermits: HermitAgentSnapshot[];
  hermitCandidatesByMod: Record<number, number[]>;
  cellCoords: Record<number, CellPoint>;
  getCoord?: (cellId: number) => CellPoint | null;
  findNearestCell?: (x: number, y: number) => number | null;
}

/** Pure Stage 1 trigger check preserving exact short-circuit RNG draw order. */
export function planWardenAwakening(
  currentWardens: number,
  opts: { random?: () => number } = {}
): boolean {
  const random = opts.random ?? Math.random;
  return (currentWardens < TARGET_WARDEN_COUNT && random() < 0.04) || random() < 0.005;
}

/**
 * Pure Stage 1 awakening step: recharges ancient wards if due, discharges a triggered ward, and
 * either sends a Sparkborn Pilgrim to The Verge or shatters their mind into a Mad_Hermit.
 */
export function stepWardenAwakening(
  snap: WardenAwakeningSnapshot,
  opts: { random?: () => number } = {}
): Delta[] {
  const random = opts.random ?? Math.random;
  const deltas: Delta[] = [];

  if (snap.shouldRecharge) {
    deltas.push({ kind: "ancientWard.recharge", tick: snap.tick });
  }

  if (!snap.ward) return deltas;

  const ward = snap.ward;
  const citizen: WardenAwakeningCitizen = snap.dbCitizen ?? {
    id: null,
    name: recruitWardenPersona(random).citizenName,
    profession: "Wayfarer",
    species: "Bear-Folk",
    sparkTier: "SENSITIVE",
    temper: "STOIC",
    instinct: "WARY",
    motivation: "Wandering the ancient overgrown roads",
  };

  deltas.push({ kind: "ancientWard.discharge", wardId: ward.id, tick: snap.tick });

  const resistsHorror =
    ["STOIC", "SCHOLARLY", "DISCIPLINED"].includes(citizen.temper) || random() < 0.60;

  if (resistsHorror) {
    if (citizen.id) {
      deltas.push({ kind: "citizen.status", citizenId: citizen.id, status: "WARDEN_PILGRIM" });
    }
    deltas.push({
      kind: "agent.create",
      name: `Pilgrim ${citizen.name} (${citizen.profession})`,
      citizenName: citizen.name,
      profession: citizen.profession,
      species: citizen.species,
      sparkTier: citizen.sparkTier,
      personalityTemper: citizen.temper,
      personalityInstinct: citizen.instinct,
      motivation: citizen.motivation,
      role: "Warden",
      subRole: "Warden_Pilgrim",
      locationCellId: ward.cellId,
      targetCellId: CONVERGENCE_SPIRE_CELL,
      targetGroveId: ward.flowId,
      state: "PILGRIMAGE_TO_SPIRE",
      corruption: 0,
      ageTicks: 0,
      activePlot:
        "Compelled by cosmic vision of the 12 Dragon Prisons and Chaos Flows to journey to the Sacred Spire",
      createdTick: snap.tick,
    });
    deltas.push({
      kind: "event.log",
      tick: snap.tick,
      type: "WARDEN_ANCIENT_WARD_AWAKENING",
      message: `⚡ COSMIC AWAKENING: ${citizen.name} (${citizen.profession}) stepped across an overgrown ancient ward along the ${ward.pathName} (Cell #${ward.cellId})! A flash of cosmic revelation exposed the 12 Dragon Prisons, the surging Chaos Flows, and Shlaar's whispering horror. Driven by the vision, they began their pilgrimage to the Sacred Spire to join the Grey Wardens!`,
      tier: "MAJOR",
      cellId: ward.cellId,
      loreDate: snap.loreDate,
    });
    deltas.push({
      kind: "tags.add",
      target: { kind: "cell", cellId: ward.cellId, zLayer: 0 },
      tags: ["#AncientWardDischarge", "#AwakenedSparkborn"],
    });
  } else {
    if (citizen.id) {
      deltas.push({ kind: "citizen.status", citizenId: citizen.id, status: "MAD_HERMIT" });
    }
    deltas.push({
      kind: "agent.create",
      name: `Mad Hermit ${citizen.name}`,
      citizenName: citizen.name,
      profession: citizen.profession,
      species: citizen.species,
      sparkTier: citizen.sparkTier,
      personalityTemper: citizen.temper,
      personalityInstinct: citizen.instinct,
      motivation: "Muttering cryptic prophecies of Shlaar and the dragons",
      role: "Mad_Hermit",
      subRole: "Mad_Hermit",
      locationCellId: ward.cellId,
      state: "WANDERING_WILDS",
      corruption: 20,
      ageTicks: 0,
      activePlot: "Mind shattered by the cosmic horror of the 12 Chaos Dragons and Shlaar",
      createdTick: snap.tick,
    });
    deltas.push({
      kind: "event.log",
      tick: snap.tick,
      type: "SPARKBORN_DRIVEN_MAD",
      message: `🌀 PSYCHIC SHATTER: ${citizen.name} (${citizen.profession}) crossed an ancient dormant ward at Cell #${ward.cellId}. The cosmic terror of the 12 Chaos Dragons and Shlaar's whispering madness shattered their sanity, driving them screaming into the wilderness as an insane wandering hermit!`,
      tier: "MINOR",
      cellId: ward.cellId,
      loreDate: snap.loreDate,
    });
    deltas.push({
      kind: "tags.add",
      target: { kind: "cell", cellId: ward.cellId, zLayer: 0 },
      tags: ["#MadHermitProphecy", "#VisionsOfTheVoid"],
    });
  }

  return deltas;
}

const HANDLED_STATES = new Set([
  "SPIRE_CRYPT_VIGIL",
  "PILGRIMAGE_TO_SPIRE",
  "TRAVELING_TO_SPIRE_TOMB",
  "PATROLLING_FLOW",
  "DEFENDING_SEAL",
  "HUNTING_CULTS",
]);

/**
 * Pure Stage 2 step: rebalances Warden prison assignments, processes all 6 Warden states,
 * executes sequential Cultist combat & seal reinforcement, and steps Mad Hermits.
 */
export function stepWardens(
  snap: WardensSnapshot,
  opts: { random?: () => number } = {}
): Delta[] {
  const random = opts.random ?? Math.random;
  const deltas: Delta[] = [];

  const getCoord = snap.getCoord ?? ((cid: number): CellPoint | null => snap.cellCoords[cid] || null);
  const findNearest = snap.findNearestCell ?? (() => null);

  const yearEnded = isYearEnd(snap.tick);
  const groveById = new Map<number, GroveCoord>();
  const groveStrengths = new Map<number, number>();
  const groveDeltas = new Map<number, number>();
  const staffing = new Map<number, number>();
  for (const g of snap.groves) {
    groveById.set(g.id, g);
    groveStrengths.set(g.id, g.sealStrength);
    staffing.set(g.id, 0);
  }

  const fieldWardens = snap.wardens.filter((w) => w.state !== "SPIRE_CRYPT_VIGIL");
  for (const w of fieldWardens) {
    if (w.targetGroveId !== null && staffing.has(w.targetGroveId)) {
      staffing.set(w.targetGroveId, staffing.get(w.targetGroveId)! + 1);
    }
  }
  const perGrove = Math.max(1, Math.ceil(fieldWardens.length / Math.max(1, snap.groves.length)));
  const leastStaffedGrove = (): number | null => {
    let best: number | null = null;
    for (const [g, n] of staffing) {
      if (best === null || n < staffing.get(best)!) best = g;
    }
    return best;
  };
  const reassign = (from: number | null): number | null => {
    if (from !== null && staffing.has(from)) staffing.set(from, staffing.get(from)! - 1);
    const to = leastStaffedGrove();
    if (to !== null) staffing.set(to, staffing.get(to)! + 1);
    return to;
  };

  // Mutable live cultist tracking so sequential warden slays reflect exact DB state
  let aliveCultists: CultistTargetSnap[] = [...snap.cultists];
  const cultistsByCell = new Map<number, CultistTargetSnap[]>();
  const rebuildCultistsByCell = () => {
    cultistsByCell.clear();
    for (const c of aliveCultists) {
      let arr = cultistsByCell.get(c.locationCellId);
      if (!arr) {
        arr = [];
        cultistsByCell.set(c.locationCellId, arr);
      }
      arr.push(c);
    }
  };
  rebuildCultistsByCell();

  const killCultists = (ids: number[], reason: string) => {
    if (ids.length === 0) return;
    const deadSet = new Set(ids);
    for (const id of ids) {
      deltas.push({ kind: "agent.remove", agentId: id, reason, diedTick: snap.tick });
    }
    aliveCultists = aliveCultists.filter((c) => !deadSet.has(c.id));
    rebuildCultistsByCell();
  };

  const pickFlowWaypoint = (flowId: number | null): number => {
    const list = flowId !== null ? snap.flowWaypoints[flowId] || [] : [];
    const picked = list[Math.floor(random() * list.length)];
    return picked ?? CONVERGENCE_SPIRE_CELL;
  };

  for (const w of snap.wardens) {
    const age = yearEnded ? (w.ageTicks || 0) + 1 : w.ageTicks || 0;
    let corruption = w.corruption || 0;
    let state = HANDLED_STATES.has(w.state) ? w.state : "PATROLLING_FLOW";
    let subRole = w.subRole || "Warden_Sentinel";
    let sparkTierUpdated: string | undefined;
    let locCellId = w.locationCellId || CONVERGENCE_SPIRE_CELL;
    let targetCellId = state === w.state ? w.targetCellId : null;
    let targetGroveId: number | null =
      w.targetGroveId !== null && staffing.has(w.targetGroveId) ? w.targetGroveId : null;

    if (state !== "SPIRE_CRYPT_VIGIL" && state !== "PILGRIMAGE_TO_SPIRE") {
      const crowded =
        targetGroveId !== null && staffing.get(targetGroveId)! > perGrove && state === "PATROLLING_FLOW";
      if (targetGroveId === null || crowded) {
        targetGroveId = reassign(targetGroveId);
        targetCellId = null;
      }
    }

    const temper = w.temper || "STOIC";
    const citizenName = w.citizenName || w.name;
    const profession = w.profession || "Guardian";

    // PHASE A: Eyeless Crypt Elders vigil beneath the Spire
    if (state === "SPIRE_CRYPT_VIGIL") {
      if (random() < 0.10) {
        deltas.push({
          kind: "tags.add",
          target: { kind: "cell", cellId: CONVERGENCE_SPIRE_CELL, zLayer: 0 },
          tags: ["#WhispersOfTheCryptElders", "#GuidanceOfTheAncestors", "#PropheticVigil"],
        });
      }
      if (yearEnded) {
        deltas.push({ kind: "agent.update", agentId: w.id, fields: { age_ticks: age } });
      }
      continue;
    }

    // PHASE B: Pilgrimage to The Spire
    if (state === "PILGRIMAGE_TO_SPIRE") {
      const moveResult = stepTowardCellPure(locCellId, CONVERGENCE_SPIRE_CELL, 70, getCoord, findNearest);
      locCellId = moveResult.nextCellId;

      if (moveResult.arrived || locCellId === CONVERGENCE_SPIRE_CELL) {
        state = "PATROLLING_FLOW";
        subRole = "Warden_Sentinel";
        targetGroveId = reassign(null);
        targetCellId = pickFlowWaypoint(targetGroveId);

        deltas.push({
          kind: "event.log",
          tick: snap.tick,
          type: "WARDEN_VOW_TAKEN",
          message: `🗡️ GREY VOW TAKEN: Pilgrim ${citizenName} (${profession}) has reached the Sacred Spire! Swearing the ancient Grey Vow, they were bound with aether-tech sigils to channel primordial chaos safely, deployed to patrol the flow corridors.`,
          tier: "MINOR",
          cellId: CONVERGENCE_SPIRE_CELL,
          loreDate: snap.loreDate,
        });
      }
    }

    // PHASE C: Veteran ascension to Eyeless Elder
    if (subRole === "Warden_Sentinel" && age >= 80 && corruption < 50) {
      subRole = "Eyeless_Elder";
      sparkTierUpdated = "EYELESS_ELDER";

      deltas.push({
        kind: "event.log",
        tick: snap.tick,
        type: "WARDEN_BECOMES_EYELESS_ELDER",
        message: `👁️ RITE OF THE BLIND SEER: Veteran Warden ${citizenName} surrendered physical sight to perceive pure Chaos Flow currents directly! Armed with their signature curved blade, their flow-sight grants uncanny fighting abilities to strike down cultist abominations with peerless precision.`,
        tier: "MAJOR",
        cellId: locCellId,
        loreDate: snap.loreDate,
      });
      deltas.push({
        kind: "tags.add",
        target: { kind: "cell", cellId: locCellId, zLayer: 0 },
        tags: ["#EyelessFlowSight", "#SignatureCurvedBlade"],
      });
    }

    const isEyelessElder = subRole === "Eyeless_Elder";

    // PHASE D: Extreme old age -> descent into the Spire tomb
    if (isEyelessElder && age >= 220 && state !== "TRAVELING_TO_SPIRE_TOMB") {
      state = "TRAVELING_TO_SPIRE_TOMB";
      targetCellId = CONVERGENCE_SPIRE_CELL;

      deltas.push({
        kind: "event.log",
        tick: snap.tick,
        type: "EYELESS_ELDER_RETIRING",
        message: `🏛️ CALL OF THE CRYPT: Eyeless Elder ${citizenName}, their mortal frame worn from over two centuries of wielding the curved blade along the roaring flows, has turned back toward the Sacred Spire to enter the eternal subterranean crypt alcoves.`,
        tier: "MINOR",
        cellId: locCellId,
        loreDate: snap.loreDate,
      });
    }

    if (state === "TRAVELING_TO_SPIRE_TOMB") {
      const moveResult = stepTowardCellPure(locCellId, CONVERGENCE_SPIRE_CELL, 75, getCoord, findNearest);
      locCellId = moveResult.nextCellId;

      if (moveResult.arrived || locCellId === CONVERGENCE_SPIRE_CELL) {
        deltas.push({
          kind: "event.log",
          tick: snap.tick,
          type: "EYELESS_ELDER_CRYPT_VIGIL",
          message: `🏛️ TOMB OF THE WATCHERS: Venerable Eyeless Elder ${citizenName} has descended into the subterranean tomb beneath the Sacred Spire. Taking their place in an ancient carved stone alcove, they will watch the 12 Chaos Flows across Ostraka forever, telepathically advising active Elders on the surface.`,
          tier: "MAJOR",
          cellId: CONVERGENCE_SPIRE_CELL,
          loreDate: snap.loreDate,
        });
        deltas.push({
          kind: "agent.update",
          agentId: w.id,
          fields: {
            state: "SPIRE_CRYPT_VIGIL",
            sub_role: "Eyeless_Crypt_Elder",
            location_cell_id: CONVERGENCE_SPIRE_CELL,
            target_cell_id: null,
            ...(sparkTierUpdated ? { spark_tier: sparkTierUpdated } : {}),
          },
        });
        continue;
      }
    }

    // PHASE E: Flow patrol & environmental cleansing
    if (state === "PATROLLING_FLOW") {
      if (random() < 0.40) {
        const besiegedGroves = new Set(
          aliveCultists
            .filter((c) => c.state === "BESIEGING_SEAL" && c.targetGroveId !== null)
            .map((c) => c.targetGroveId!)
        );
        const endangered = snap.groves
          .map((g) => ({ g, strength: groveStrengths.get(g.id) ?? g.sealStrength }))
          .filter((x) => x.strength < 85 || besiegedGroves.has(x.g.id))
          .sort((a, b) => {
            const ownA = a.g.id === (targetGroveId ?? 0) ? 0 : 1;
            const ownB = b.g.id === (targetGroveId ?? 0) ? 0 : 1;
            if (ownA !== ownB) return ownA - ownB;
            return a.strength - b.strength || a.g.id - b.g.id;
          });
        if (endangered.length > 0) {
          const picked = endangered[0]!.g;
          state = "DEFENDING_SEAL";
          targetGroveId = picked.id;
          targetCellId = picked.cellId;
        }
      }

      if (state === "PATROLLING_FLOW") {
        if (!targetCellId || random() < 0.15) {
          targetCellId = pickFlowWaypoint(targetGroveId);
        }

        if (targetCellId) {
          const moveResult = stepTowardCellPure(locCellId, targetCellId, 65, getCoord, findNearest, cultistsByCell);
          locCellId = moveResult.nextCellId;
          if (moveResult.collidedWith) {
            state = "HUNTING_CULTS";
            targetCellId = moveResult.collidedWith.locationCellId;
          }
        }

        const blightCleanse = isEyelessElder ? 1.0 : temper === "COMPASSIONATE" ? 0.8 : 0.4;
        deltas.push({ kind: "cell.adjust", cellId: locCellId, ecoBlight: -blightCleanse });

        if (random() < 0.05) {
          corruption += isEyelessElder ? 0 : 1;
        }

        const cultTarget = findNearestAgentCellPure(locCellId, aliveCultists, getCoord);
        if (cultTarget) {
          state = "HUNTING_CULTS";
          targetCellId = cultTarget.cellId;
        }
      }
    }

    // PHASE E2: Defending endangered dragon prisons
    else if (state === "DEFENDING_SEAL") {
      if (targetCellId) {
        const moveResult = stepTowardCellPure(locCellId, targetCellId, 85, getCoord, findNearest);
        locCellId = moveResult.nextCellId;

        if (moveResult.arrived || locCellId === targetCellId) {
          const cultsHere = cultistsByCell.get(locCellId) || [];
          const cultsBeforeCount = cultsHere.length;

          if (cultsBeforeCount > 0) {
            const slayCount = Math.min(cultsBeforeCount, isEyelessElder ? 3 : 2);
            const slainIds = cultsHere.slice(0, slayCount).map((c) => c.id);
            killCultists(slainIds, "warden_defends_seal");
            const weaponDesc = isEyelessElder ? "carved curved-blade sweeps" : "aether-sigil charges";
            deltas.push({
              kind: "event.log",
              tick: snap.tick,
              type: "WARDEN_DEFENDS_SEAL",
              message: `🛡️ DEFENSE OF THE PRISON: Warden ${citizenName} (${subRole.replace("_", " ")}) engaged the besieging cultists with ${weaponDesc}, striking down ${slayCount} Shlaar cabalists!`,
              tier: "MINOR",
              cellId: locCellId,
              loreDate: snap.loreDate,
            });
          }

          const repairAmount = isEyelessElder ? 2 : 1;
          let postSealStrength = 0;
          if (targetGroveId && groveById.has(targetGroveId)) {
            const curStr = groveStrengths.get(targetGroveId) ?? groveById.get(targetGroveId)!.sealStrength;
            postSealStrength = Math.min(100, curStr + repairAmount);
            groveStrengths.set(targetGroveId, postSealStrength);
            groveDeltas.set(targetGroveId, (groveDeltas.get(targetGroveId) || 0) + repairAmount);
          }

          deltas.push({ kind: "cell.adjust", cellId: locCellId, ecoBlight: -1.5 });

          if (postSealStrength >= 92 && cultsBeforeCount <= 1) {
            state = "PATROLLING_FLOW";
            targetCellId = null;
          }
        }
      }
    }

    // PHASE F: Hunting cults & aether-tech combat
    else if (state === "HUNTING_CULTS") {
      if (targetCellId) {
        const moveResult = stepTowardCellPure(locCellId, targetCellId, 80, getCoord, findNearest);
        locCellId = moveResult.nextCellId;

        if (moveResult.arrived || locCellId === targetCellId) {
          const cultsHere = cultistsByCell.get(locCellId) || [];
          const cultCount = cultsHere.length;

          if (cultCount > 0) {
            const terminalThreshold = temper === "STOIC" ? 95 : 85;
            const forcedMassiveChanneling = cultCount >= 5 && corruption >= 60;

            if (corruption >= terminalThreshold || forcedMassiveChanneling) {
              const purgedIds = cultsHere.map((c) => c.id);
              killCultists(purgedIds, "warden_supernova");
              deltas.push({ kind: "agent.remove", agentId: w.id, reason: "warden_final_sacrifice", diedTick: snap.tick });
              deltas.push({ kind: "cell.set", cellId: locCellId, fields: { eco_blight: 0.0 } });

              deltas.push({
                kind: "event.log",
                tick: snap.tick,
                type: "WARDEN_FINAL_SACRIFICE",
                message: `💥 HEROIC KAMIKAZE SACRIFICE: Warden ${citizenName} (${profession}, ${subRole.replace("_", " ")}), forced to channel an overwhelming torrent of primordial chaos through their aether-tech sigils, suffered a critical core overload! Choosing martyrdom over madness, they detonated their soul-spark in a blinding pure aether supernova at Cell #${locCellId}, incinerating ${purgedIds.length} Shlaar cultists and purging all blight before passing into legend!`,
                tier: "MAJOR",
                cellId: locCellId,
                loreDate: snap.loreDate,
              });
              deltas.push({
                kind: "tags.add",
                target: { kind: "cell", cellId: locCellId, zLayer: 0 },
                tags: ["#SacrificialAetherCrater", "#HallowedMartyrGround", "#PurifiedSanctuary"],
              });
              continue;
            } else {
              const killCount = Math.min(cultCount, isEyelessElder ? 2 : 1);
              const weaponDesc = isEyelessElder
                ? "swung their signature curved blade with uncanny flow-sight"
                : "discharged their aether-tech sigils and halberd";
              const targetBatch = cultsHere.slice(0, killCount);
              killCultists(targetBatch.map((t) => t.id), "warden_clash");
              for (const targetCultist of targetBatch) {
                deltas.push({
                  kind: "event.log",
                  tick: snap.tick,
                  type: "WARDEN_CLASH",
                  message: `⚔️ ${citizenName} (${subRole.replace("_", " ")}) ${weaponDesc}, striking down ${targetCultist.name} to purge Shlaar's corrupting influence!`,
                  tier: "MINOR",
                  cellId: locCellId,
                  loreDate: snap.loreDate,
                });
              }

              corruption += isEyelessElder ? 0 : 1;
            }
          } else {
            state = "PATROLLING_FLOW";
            targetCellId = null;
          }
        }
      }
    }

    deltas.push({
      kind: "agent.update",
      agentId: w.id,
      fields: {
        location_cell_id: locCellId,
        target_cell_id: targetCellId,
        target_grove_id: targetGroveId,
        state,
        sub_role: subRole,
        corruption,
        age_ticks: age,
        ...(sparkTierUpdated ? { spark_tier: sparkTierUpdated } : {}),
      },
    });
  }

  for (const groveId of Array.from(groveDeltas.keys()).sort((a, b) => a - b)) {
    const sealDelta = groveDeltas.get(groveId)!;
    if (sealDelta !== 0) {
      deltas.push({ kind: "grove.adjust", groveId, sealDelta });
    }
  }

  // Stage 3: Mad Hermits wandering the wilderness
  for (const h of snap.hermits) {
    if (random() < 0.20) {
      const candidates = (snap.hermitCandidatesByMod[h.locationCellId % 50] || []).filter(
        (id) => id !== h.locationCellId
      );
      const nextCell = candidates[Math.floor(random() * candidates.length)] || h.locationCellId;

      deltas.push({ kind: "agent.update", agentId: h.id, fields: { location_cell_id: nextCell } });

      if (random() < 0.15) {
        deltas.push({
          kind: "tags.add",
          target: { kind: "cell", cellId: nextCell, zLayer: 0 },
          tags: ["#MadHermitProphecy", "#VisionsOfTheVoid"],
        });
      }
    }
  }

  return deltas;
}
