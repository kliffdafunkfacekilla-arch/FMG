/**
 * Pure hourly meso simulation step (Phase 10.3): zero DB or UI imports (Rule 8).
 * Advances entity-backed agents, resolves hourly ecology/predation/farm drift, convoy ambushes,
 * and warden-cultist encounters deterministically from seeded randomness.
 */
import { DAYS_PER_WEEK } from "../canon/calendar.js";
import { hashSeed, mulberry32 } from "../rng.js";
import type { Delta } from "../deltas/types.js";
import type { StoryProposalSpec } from "../story/sources/types.js";

export type MesoAgentKind =
  | "convoy"
  | "roaming"
  | "worker"
  | "wildlife_prey"
  | "wildlife_predator";

export interface MesoAgent {
  entityRef: string;
  kind: MesoAgentKind;
  name: string;
  role: string;
  cellId: number;
  rx: number;
  ry: number;
  targetRx: number;
  targetRy: number;
  count: number;
  speed: number;
  factionId?: number | null | undefined;
  burgId?: number | null | undefined;
  shipmentId?: number | null | undefined;
  agentId?: number | null | undefined;
  citizenId?: number | null | undefined;
  state: string;
  alive: boolean;
}

export interface MesoCellState {
  cellId: number;
  ecoPlants: number;
  ecoPrey: number;
  ecoPredators: number;
  ecoApex: number;
  ecoBlight: number;
  ecoMax: number;
  neighbors?: Partial<Record<"N" | "S" | "E" | "W", number>> | undefined;
}

export interface MesoBurgState {
  burgId: number;
  cellId: number;
  name: string;
  food: number;
  wealth: number;
  unrest: number;
  popNull: number;
}

export interface MesoSnapshot {
  tick: number;
  season: string;
  loreDate: string;
  cells: MesoCellState[];
  burgs: MesoBurgState[];
  agents: MesoAgent[];
}

export interface MesoHourResult {
  hour: number;
  deltas: Delta[];
  proposals: StoryProposalSpec[];
  predations: number;
  ambushes: number;
  arrests: number;
  farmWorkUnits: number;
}

export interface MesoDayResult {
  deltas: Delta[];
  proposals: StoryProposalSpec[];
  finalAgents: MesoAgent[];
  finalCells: MesoCellState[];
  summary: {
    hoursRun: number;
    predations: number;
    ambushes: number;
    arrests: number;
    farmWorkUnits: number;
  };
}

export function seasonalDailyPlantGrowth(season: string): number {
  switch (season) {
    case "Greenspan": return 2.5;
    case "Thawrise": return 1.6;
    case "Shadowburn":
    case "Dimburn": return 1.2;
    case "Dryspell": return -0.6;
    case "Cropfade": return -0.9;
    case "Frostin": return -1.0;
    case "Dimfreeze": return -1.8;
    default: return 1.0;
  }
}

export function stepMesoHour(
  snap: MesoSnapshot,
  opts: { hour: number; random: () => number; emitCellDeltas?: boolean | undefined }
): MesoHourResult {
  const { hour, random } = opts;
  const emitCellDeltas = opts.emitCellDeltas ?? true;
  const deltas: Delta[] = [];
  const proposals: StoryProposalSpec[] = [];
  let predations = 0;
  let ambushes = 0;
  let arrests = 0;
  let farmWorkUnits = 0;

  const cellMap = new Map<number, MesoCellState>();
  for (const c of snap.cells) cellMap.set(c.cellId, c);

  const burgByCell = new Map<number, MesoBurgState>();
  for (const b of snap.burgs) burgByCell.set(b.cellId, b);

  const dailyPlant = seasonalDailyPlantGrowth(snap.season);
  const hourlyPlant = dailyPlant / 24;
  const hourlyBlightDecay = 1.2 / 24;
  const hourlyPreyUp = 0.8 / DAYS_PER_WEEK / 24;
  const hourlyPreyDown = -0.9 / DAYS_PER_WEEK / 24;
  const hourlyPredUp = 0.5 / DAYS_PER_WEEK / 24;

  // 1. Hourly calibrated cell ecology
  for (const c of snap.cells) {
    const prevPlants = c.ecoPlants;
    const prevPrey = c.ecoPrey;
    const prevPred = c.ecoPredators;

    c.ecoPlants =
      c.ecoBlight < 40
        ? Math.min(c.ecoMax, Math.max(2.0, prevPlants + hourlyPlant))
        : Math.max(1.0, prevPlants - hourlyBlightDecay);

    if (prevPlants >= 40) {
      c.ecoPrey = Math.min(100.0, prevPrey + hourlyPreyUp);
    } else if (prevPlants < 25) {
      c.ecoPrey = Math.max(2.0, prevPrey + hourlyPreyDown);
    }

    if (prevPrey >= 35) {
      c.ecoPredators = Math.min(60.0, prevPred + hourlyPredUp);
    }

    if (emitCellDeltas) {
      deltas.push({
        kind: "cell.set",
        cellId: c.cellId,
        fields: {
          eco_plants: Number(c.ecoPlants.toFixed(4)),
          eco_prey: Number(c.ecoPrey.toFixed(4)),
          eco_predators: Number(c.ecoPredators.toFixed(4)),
        },
      });
    }
  }

  // 2. Move active meso agents across stitched 100x100 cell grids
  for (const ag of snap.agents) {
    if (!ag.alive || ag.state === "ARRESTED" || ag.state === "AMBUSHED") continue;

    // Bandits/outlaws intercept nearby convoys in the same cell
    if (ag.kind === "roaming" && /bandit|raider|outlaw|smuggler/i.test(`${ag.role} ${ag.name}`)) {
      const targetConvoy = snap.agents.find(
        (c) => c.kind === "convoy" && c.alive && c.state !== "AMBUSHED" && c.cellId === ag.cellId && Math.hypot(c.rx - ag.rx, c.ry - ag.ry) <= 60
      );
      if (targetConvoy) {
        ag.targetRx = targetConvoy.rx;
        ag.targetRy = targetConvoy.ry;
      }
    }

    if (Math.abs(ag.targetRx - ag.rx) <= ag.speed && Math.abs(ag.targetRy - ag.ry) <= ag.speed) {
      ag.rx = ag.targetRx;
      ag.ry = ag.targetRy;
      ag.targetRx = Math.max(4, Math.min(95, ag.rx + Math.round((random() - 0.5) * 18)));
      ag.targetRy = Math.max(4, Math.min(95, ag.ry + Math.round((random() - 0.5) * 18)));
    } else {
      const dx = Math.sign(ag.targetRx - ag.rx) * Math.min(ag.speed, Math.abs(ag.targetRx - ag.rx));
      const dy = Math.sign(ag.targetRy - ag.ry) * Math.min(ag.speed, Math.abs(ag.targetRy - ag.ry));
      ag.rx += dx;
      ag.ry += dy;
    }

    // Border crossing into adjacent focused cell if stitched
    const cell = cellMap.get(ag.cellId);
    if (cell?.neighbors) {
      if (ag.rx < 0 && cell.neighbors.W && cellMap.has(cell.neighbors.W)) {
        ag.cellId = cell.neighbors.W;
        ag.rx = 98;
      } else if (ag.rx > 99 && cell.neighbors.E && cellMap.has(cell.neighbors.E)) {
        ag.cellId = cell.neighbors.E;
        ag.rx = 1;
      } else if (ag.ry < 0 && cell.neighbors.N && cellMap.has(cell.neighbors.N)) {
        ag.cellId = cell.neighbors.N;
        ag.ry = 98;
      } else if (ag.ry > 99 && cell.neighbors.S && cellMap.has(cell.neighbors.S)) {
        ag.cellId = cell.neighbors.S;
        ag.ry = 1;
      }
    }
    ag.rx = Math.max(0, Math.min(99, Math.round(ag.rx)));
    ag.ry = Math.max(0, Math.min(99, Math.round(ag.ry)));
  }

  // 3. Hourly interactions inside each cell (ordered deterministically)
  const sorted = [...snap.agents].sort((a, b) => a.entityRef.localeCompare(b.entityRef));

  for (const ag of sorted) {
    if (!ag.alive || ag.state === "ARRESTED" || ag.state === "AMBUSHED") continue;
    const cell = cellMap.get(ag.cellId);
    const burg = burgByCell.get(ag.cellId);

    // 3a. Farm work
    if (ag.kind === "worker" && /farm|herder|miller|baker/i.test(ag.role) && burg && hour >= 6 && hour <= 18) {
      farmWorkUnits++;
      if (hour === 18) {
        deltas.push({ kind: "burg.adjust", burgId: burg.burgId, food: Math.max(2, Math.round(ag.count * 2)) });
      }
    }

    // 3b. Wildlife predation
    if (ag.kind === "wildlife_predator" && cell) {
      const prey = sorted.find(
        (p) =>
          p.alive &&
          p.kind === "wildlife_prey" &&
          p.cellId === ag.cellId &&
          Math.hypot(p.rx - ag.rx, p.ry - ag.ry) <= 6
      );
      if (prey && cell.ecoPrey > 5 && random() < 0.15) {
        const loss = 0.2;
        cell.ecoPrey = Math.max(2, cell.ecoPrey - loss);
        predations++;
        if (emitCellDeltas) {
          deltas.push({ kind: "cell.adjust", cellId: cell.cellId, ecoPrey: -loss });
        }
      }
    }

    // 3c. Convoy ambush by hostile bandit/raider/cultist
    if (ag.kind === "convoy" && ag.state !== "AMBUSHED") {
      const attacker = sorted.find(
        (h) =>
          h.alive &&
          h.cellId === ag.cellId &&
          h.entityRef !== ag.entityRef &&
          /bandit|raider|outlaw|smuggler/i.test(`${h.role} ${h.name}`) &&
          Math.hypot(h.rx - ag.rx, h.ry - ag.ry) <= 8
      );
      if (attacker) {
        ag.state = "AMBUSHED";
        ambushes++;
        const destBurg = ag.burgId ? snap.burgs.find((b) => b.burgId === ag.burgId) : burg;
        if (destBurg) {
          deltas.push({ kind: "burg.adjust", burgId: destBurg.burgId, wealth: -65, food: -25, unrest: 4 });
        }
        deltas.push({
          kind: "event.log",
          tick: snap.tick,
          type: "MESO_CONVOY_AMBUSH",
          message: `Raider ${attacker.name} ambushed convoy ${ag.name} in Cell #${ag.cellId} at (${ag.rx},${ag.ry}), seizing cargo.`,
          tier: "MAJOR",
          burgId: destBurg?.burgId ?? undefined,
          cellId: ag.cellId,
          loreDate: snap.loreDate,
        });
        proposals.push({
          scale: "thread",
          scope_cells: snap.cells.map((c) => c.cellId),
          cell_id: ag.cellId,
          rx: ag.rx,
          ry: ag.ry,
          z: 0,
          question: `Can ${ag.name}'s stolen cargo be recovered from ${attacker.name}?`,
          stakes: `An ambush at (${ag.rx},${ag.ry}) in Cell #${ag.cellId} cost ${destBurg?.name || `Cell #${ag.cellId}`} supplies and rattled merchants.`,
          actor_ids: [attacker.entityRef],
          clock_max: 6,
          source: "world",
          origin: "world",
          rule_id: `MESO_AMBUSH_${ag.cellId}_${snap.tick}_${hour}`,
          why: `Live hourly meso encounter: ${attacker.name} intercepted ${ag.name} at (${ag.rx},${ag.ry}).`,
          facts: [
            { kind: "entity", id: attacker.entityRef, summary: attacker.name },
            { kind: "convoy", id: ag.entityRef, summary: ag.name },
          ],
          hook: {
            dialogueLine: `Survivors limped in saying ${attacker.name} hit ${ag.name} at the crossroads (${ag.rx},${ag.ry}).`,
            clueName: "Shattered Wagon Wheel",
            clueDescription: `Splintered spokes and spilled grain from ${ag.name}.`,
            rumor: `${ag.name} was ambushed near (${ag.rx},${ag.ry}) in Cell #${ag.cellId}.`,
          },
          rank_score: 88,
          on_expire: { wealthDelta: -80, unrestDelta: 6, narrativeSummary: `${attacker.name} fenced the plunder from ${ag.name}.` },
          on_resolved_by_party: { wealthDelta: 95, unrestDelta: -5, narrativeSummary: `The party tracked ${attacker.name} and recovered ${ag.name}'s cargo.` },
        });
      }
    }

    // 3d. Warden/Patrol meets Cultist
    if (ag.kind === "roaming" && /warden|patrol|guard/i.test(ag.role)) {
      const cultist = sorted.find(
        (c) =>
          c.alive &&
          c.cellId === ag.cellId &&
          c.kind === "roaming" &&
          /cultist|zealot/i.test(c.role) &&
          c.state !== "ARRESTED" &&
          Math.hypot(c.rx - ag.rx, c.ry - ag.ry) <= 6
      );
      if (cultist && cultist.agentId) {
        const patrolRoll = Math.floor(random() * 12) + 2;
        const cultistRoll = Math.floor(random() * 12) + 1;
        if (patrolRoll >= cultistRoll) {
          cultist.state = "ARRESTED";
          arrests++;
          deltas.push({ kind: "agent.update", agentId: cultist.agentId, fields: { state: "ARRESTED" } });
          deltas.push({
            kind: "event.log",
            tick: snap.tick,
            type: "MESO_CULTIST_ARREST",
            message: `${ag.name} intercepted and arrested ${cultist.name} at (${cultist.rx},${cultist.ry}) in Cell #${ag.cellId}.`,
            tier: "MINOR",
            burgId: burg?.burgId ?? undefined,
            cellId: ag.cellId,
            loreDate: snap.loreDate,
          });
        }
      }
    }
  }

  return { hour, deltas, proposals, predations, ambushes, arrests, farmWorkUnits };
}

/**
 * Runs all 24 hourly sub-steps for a focused meso region day and consolidates final cell states.
 */
export function stepMesoDay(
  snapshot: MesoSnapshot,
  opts: { seed: string; tick?: number | undefined }
): MesoDayResult {
  const tick = opts.tick ?? snapshot.tick;
  const working: MesoSnapshot = {
    tick,
    season: snapshot.season,
    loreDate: snapshot.loreDate,
    cells: snapshot.cells.map((c) => ({ ...c, neighbors: c.neighbors ? { ...c.neighbors } : undefined })),
    burgs: snapshot.burgs.map((b) => ({ ...b })),
    agents: snapshot.agents.map((a) => ({ ...a })),
  };

  const deltas: Delta[] = [];
  const proposals: StoryProposalSpec[] = [];
  let predations = 0;
  let ambushes = 0;
  let arrests = 0;
  let farmWorkUnits = 0;

  for (let hour = 0; hour < 24; hour++) {
    const rng = mulberry32(hashSeed(`${opts.seed}:meso:${tick}:${hour}`));
    const hr = stepMesoHour(working, { hour, random: rng, emitCellDeltas: false });
    deltas.push(...hr.deltas);
    proposals.push(...hr.proposals);
    predations += hr.predations;
    ambushes += hr.ambushes;
    arrests += hr.arrests;
    farmWorkUnits += hr.farmWorkUnits;
  }

  for (const c of working.cells.sort((a, b) => a.cellId - b.cellId)) {
    deltas.push({
      kind: "cell.set",
      cellId: c.cellId,
      fields: {
        eco_plants: Number(c.ecoPlants.toFixed(4)),
        eco_prey: Number(c.ecoPrey.toFixed(4)),
        eco_predators: Number(c.ecoPredators.toFixed(4)),
        eco_apex: Number(c.ecoApex.toFixed(4)),
        eco_blight: Number(c.ecoBlight.toFixed(4)),
      },
    });
  }

  return {
    deltas,
    proposals,
    finalAgents: working.agents,
    finalCells: working.cells,
    summary: { hoursRun: 24, predations, ambushes, arrests, farmWorkUnits },
  };
}
