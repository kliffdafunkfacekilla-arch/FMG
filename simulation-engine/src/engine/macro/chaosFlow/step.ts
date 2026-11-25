import { DAYS_PER_WEEK, MERCY_ALIGNMENT, NIGHTMARE_ALIGNMENT } from "../../canon/calendar.js";
import type { Delta } from "../../deltas/types.js";

/** One flow's fixed identity and endpoints, as seeded into sim_chaos_flows by the map ingest. */
export interface ChaosFlowAnchor {
  flowId: number;
  name: string;
  dragonName: string;
  elementalPower: string;
  source: { x: number; y: number };
  sink: { x: number; y: number };
}

export interface ChaosFlowWaypoint {
  x: number;
  y: number;
  segmentIndex: number;
}

export interface NarrowCrossingSpot {
  x: number;
  y: number;
  widthMeters: number;
  crossingDC: number;
  description: string;
}

export interface LiveChaosFlowState {
  flowId: number;
  name: string;
  dragonName: string;
  elementalPower: string;
  currentSurge: number;
  currentWidth: number;
  waypoints: ChaosFlowWaypoint[];
  narrowSpots: NarrowCrossingSpot[];
}

export interface ChaosPruneCandidate {
  flowId: number;
  cellId: number;
  centerX: number;
  centerY: number;
}

export interface ChaosShoreCell {
  cellId: number;
  leyTags: string[];
}

export interface ChaosSampleCell {
  id: number;
  centerX: number;
  centerY: number;
  ecoBlight: number;
}

export interface ChaosFlowSnapshot {
  tick: number;
  ctx: { activeFlow: string; dragonDomain: string; lunarSurgeMod: number };
  anchors: ChaosFlowAnchor[];
  liveFlows: LiveChaosFlowState[];
  pruneCandidates: ChaosPruneCandidate[];
  shoreCells: ChaosShoreCell[];
  /** Sample cells per (flowId, sampleIndex) flattened by point ordinal [0..35]. */
  sampleCellsByPoint: ChaosSampleCell[][];
  agentCounts: {
    cultist: number;
    warden: number;
    chainZealot: number;
  };
}

/** Environmental tags a flow leaves on the cells along its banks, by Power. */
export const FLOW_DOMAIN_TAGS: Record<string, string[]> = {
  Mass: ["#GraviticAnomaly", "#DenseIronwood", "#BasaltFaultLine"],
  Nexus: ["#SpatialFoldMirage", "#DimensionalFissure", "#PhaseSlip"],
  Ordo: ["#TemporalStasisFrost", "#CrystallineLichen", "#StasisField"],
  Lex: ["#IronRunicResonance", "#BindingLey", "#DecreeAura"],
  Motus: ["#KineticGaleRifts", "#SquallWarpedTerrain", "#HowlingLeys"],
  Flux: ["#BiomanticMutationZone", "#ChimericEcology", "#VolatileAether"],
  Vita: ["#BloodBloomOvergrowth", "#ApexPredatorFrenzy", "#PrimevalHypergrowth"],
  Ratio: ["#ClockworkFaultLines", "#HarmonicHum", "#GeometricResonance"],
  Lux: ["#BlindingPhosphorFlats", "#RadiantEmberFlora", "#SolarAether"],
  Omen: ["#EclipseShadowWash", "#OmenBlight", "#AstralWhispers"],
  Aura: ["#PhantasmagoricMists", "#HallucinogenicSpores", "#VioletAura"],
  Anumis: ["#SoulAshMiasma", "#RestlessShades", "#NecroticChill"],
};

/** A flow's banks: anything within this many map px of its current course (meander + band). */
export const FLOW_CORRIDOR = 250;

/** Reads an {x, y} object, an [x, y] array, or a JSON string of either. */
function parseCoord(raw: unknown): { x: number; y: number } | null {
  let v: any = raw;
  if (typeof raw === "string") {
    try { v = JSON.parse(raw); } catch { return null; }
  }
  if (Array.isArray(v) && v.length >= 2 && Number.isFinite(Number(v[0])) && Number.isFinite(Number(v[1]))) {
    return { x: Number(v[0]), y: Number(v[1]) };
  }
  if (v && typeof v === "object" && Number.isFinite(Number(v.x)) && Number.isFinite(Number(v.y))) {
    return { x: Number(v.x), y: Number(v.y) };
  }
  return null;
}

/** Turns a sim_chaos_flows row into an anchor, or null if its endpoints are missing. */
export function parseChaosFlowAnchor(row: any): ChaosFlowAnchor | null {
  const source = parseCoord(row?.source_coord);
  const sink = parseCoord(row?.sink_coord);
  if (!source || !sink) return null;
  return {
    flowId: Number(row.flow_id),
    name: String(row.name ?? ""),
    dragonName: String(row.dragon_name ?? ""),
    elementalPower: String(row.elemental_power ?? ""),
    source,
    sink,
  };
}

export function distToPolyline(x: number, y: number, pts: Array<{ x: number; y: number }>): number {
  let best = Infinity;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i]!, b = pts[i + 1]!;
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / len2));
    best = Math.min(best, Math.hypot(x - (a.x + t * dx), y - (a.y + t * dy)));
  }
  return best;
}

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const l2 = Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2);
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
}

/** Surge modifier from the blood moon's phase. */
export function lunarSurgeModifier(moonPhase: string): number {
  if (moonPhase === NIGHTMARE_ALIGNMENT) return 1.2;
  if (moonPhase === "The Open Eye") return 0.85;
  if (moonPhase === MERCY_ALIGNMENT) return -0.45;
  if (moonPhase === "The Halo") return -0.2;
  return 0.0;
}

/**
 * Pure: computes one flow's surge, width and meandering course for a tick.
 * The course always starts at the flow's own source (its prison) and ends at its sink (The Verge).
 */
export function computeChaosFlowState(
  anchor: ChaosFlowAnchor,
  tick: number,
  ctx: { activeFlow: string; dragonDomain: string; lunarSurgeMod: number }
): LiveChaosFlowState {
  const { source, sink } = anchor;

  const isDomainAligned =
    anchor.dragonName.toLowerCase() === ctx.dragonDomain.toLowerCase() ||
    anchor.elementalPower.toLowerCase() === ctx.activeFlow.toLowerCase();
  const baseSurge = isDomainAligned ? 2.1 : 1.0;
  const waveSurge = Math.sin(tick * 0.06 + anchor.flowId * 1.3) * 0.35;
  const netSurge = Math.max(0.3, parseFloat((baseSurge + ctx.lunarSurgeMod + waveSurge).toFixed(2)));
  const baseWidth = parseFloat((24.0 * Math.sqrt(netSurge)).toFixed(1));

  const NUM_SEGMENTS = 10;
  const waypoints: ChaosFlowWaypoint[] = [];
  const narrowSpots: NarrowCrossingSpot[] = [];

  const dx = sink.x - source.x;
  const dy = sink.y - source.y;
  const dist = Math.hypot(dx, dy) || 1;
  const nx = -dy / dist;
  const ny = dx / dist;

  for (let s = 0; s <= NUM_SEGMENTS; s++) {
    const t = s / NUM_SEGMENTS;
    const baseX = source.x + dx * t;
    const baseY = source.y + dy * t;

    const meanderPhase = tick * 0.04 + s * 0.8 + anchor.flowId * 1.2;
    const meanderAmplitude = Math.sin(t * Math.PI) * (70.0 * Math.min(1.8, netSurge));
    const lateralOffset = Math.sin(meanderPhase) * meanderAmplitude;

    const wx = Math.round(baseX + nx * lateralOffset);
    const wy = Math.round(baseY + ny * lateralOffset);

    waypoints.push({ x: wx, y: wy, segmentIndex: s });

    if (s === 3 || s === 7) {
      const pinchWidth = Math.max(4.0, parseFloat((baseWidth * 0.32).toFixed(1)));
      const crossingDC = Math.min(25, Math.max(11, Math.round(12 + netSurge * 3.5)));
      narrowSpots.push({
        x: wx,
        y: wy,
        widthMeters: pinchWidth,
        crossingDC,
        description: `The Glass-Rock Ford of ${anchor.dragonName}: roaring ${anchor.elementalPower} aether narrows into a jagged chasm (${pinchWidth}m wide).`,
      });
    }
  }

  return {
    flowId: anchor.flowId,
    name: anchor.name,
    dragonName: anchor.dragonName,
    elementalPower: anchor.elementalPower,
    currentSurge: netSurge,
    currentWidth: baseWidth,
    waypoints,
    narrowSpots,
  };
}

/**
 * Checks whether a map coordinate [x, y] is intersected by any of the 12 active Chaos Flows.
 */
export function evaluatePointChaosFlowProximity(
  px: number,
  py: number,
  flows: LiveChaosFlowState[]
): {
  intersected: boolean;
  isAdjacent: boolean;
  nearNarrowSpot: boolean;
  nearestFlow?: LiveChaosFlowState | undefined;
  distToFlow: number;
  narrowSpot?: NarrowCrossingSpot | undefined;
  ambientChaos: number;
} {
  let closestDist = Infinity;
  let closestFlow: LiveChaosFlowState | undefined;
  let matchedNarrow: NarrowCrossingSpot | undefined;

  for (const flow of flows) {
    for (let i = 0; i < flow.waypoints.length - 1; i++) {
      const p1 = flow.waypoints[i];
      const p2 = flow.waypoints[i + 1];
      if (!p1 || !p2) continue;

      const d = distToSegment(px, py, p1.x, p1.y, p2.x, p2.y);
      if (d < closestDist) {
        closestDist = d;
        closestFlow = flow;
      }
    }

    for (const spot of flow.narrowSpots) {
      const spotDist = Math.hypot(px - spot.x, py - spot.y);
      if (spotDist <= 40) {
        matchedNarrow = spot;
        break;
      }
    }
  }

  const flowHalfWidth = closestFlow ? closestFlow.currentWidth * 1.5 : 35;
  const intersected = closestFlow ? closestDist <= flowHalfWidth : false;
  const isAdjacent = closestFlow ? !intersected && closestDist <= flowHalfWidth + 75 : false;
  const nearNarrowSpot = !!matchedNarrow;

  let ambientChaos = 0.10;
  if (closestFlow) {
    if (intersected) {
      ambientChaos = Math.min(1.0, 0.85 * (closestFlow.currentSurge || 1.0));
    } else if (isAdjacent) {
      const proximityFactor = Math.max(0, 1.0 - (closestDist - flowHalfWidth) / 75.0);
      ambientChaos = Math.min(
        0.95,
        parseFloat((0.55 + 0.35 * proximityFactor * Math.min(1.4, closestFlow.currentSurge)).toFixed(2))
      );
    }
  }

  return {
    intersected,
    isAdjacent,
    nearNarrowSpot,
    nearestFlow: closestFlow,
    distToFlow: closestDist,
    narrowSpot: matchedNarrow,
    ambientChaos,
  };
}

/**
 * Pure Chaos Flow step: computes daily meanders, weekly corridor pruning, bi-daily chaos zone
 * updates, blight increments, environmental tags, and agent spawns along flow banks.
 */
export function stepChaosFlow(
  snap: ChaosFlowSnapshot,
  opts: { random?: () => number } = {}
): { liveFlows: LiveChaosFlowState[]; deltas: Delta[] } {
  const random = opts.random ?? Math.random;
  const deltas: Delta[] = [];

  if (snap.anchors.length === 0) {
    return { liveFlows: [], deltas };
  }

  const liveFlows =
    snap.liveFlows.length === snap.anchors.length
      ? snap.liveFlows
      : snap.anchors.map((a) => computeChaosFlowState(a, snap.tick, snap.ctx));

  for (const flowState of liveFlows) {
    deltas.push({
      kind: "chaosFlow.update",
      flowId: flowState.flowId,
      currentSurge: flowState.currentSurge,
      currentWidth: flowState.currentWidth,
      waypoints: flowState.waypoints,
      narrowSpots: flowState.narrowSpots,
    });
  }

  const surging = liveFlows.find((f) => f.currentSurge >= 2.4);
  if (surging && snap.tick % 7 === 0) {
    deltas.push({
      kind: "event.log",
      tick: snap.tick,
      type: "CHAOS_SURGE",
      tier: "CRITICAL",
      message: `⚡ PRIMORDIAL SURGE: ${surging.name} has flooded its banks! An iridescent torrent of ${surging.elementalPower} aether cuts across the province. Crossing on foot without an airship is deadly!`,
    });
  }

  // Weekly: prune drifted tags and chaos-ley zones from cells outside each flow's corridor.
  if (snap.tick % DAYS_PER_WEEK === 0) {
    const flowById = new Map(liveFlows.map((f) => [f.flowId, f]));
    const removedLeysByCell = new Map<number, Set<string>>();

    for (const cand of snap.pruneCandidates) {
      const flow = flowById.get(cand.flowId);
      if (!flow || !flow.waypoints?.length) continue;
      if (distToPolyline(cand.centerX, cand.centerY, flow.waypoints) <= FLOW_CORRIDOR) continue;

      const leyTag = `#DragonLeys_${flow.dragonName}`;
      const tagsToRemove = [leyTag, ...(FLOW_DOMAIN_TAGS[flow.elementalPower] || [])];
      deltas.push({
        kind: "tags.remove",
        target: { kind: "cell", cellId: cand.cellId, zLayer: 0 },
        tags: tagsToRemove,
      });
      deltas.push({
        kind: "chaosZone.remove",
        cellId: cand.cellId,
        type: `${flow.elementalPower.toUpperCase()}_CHAOS_LEYS`,
      });

      let set = removedLeysByCell.get(cand.cellId);
      if (!set) {
        set = new Set<string>();
        removedLeysByCell.set(cand.cellId, set);
      }
      set.add(leyTag);
    }

    for (const shore of snap.shoreCells) {
      const removed = removedLeysByCell.get(shore.cellId);
      const allGone = shore.leyTags.length === 0 || shore.leyTags.every((t) => removed?.has(t));
      if (allGone) {
        deltas.push({
          kind: "tags.remove",
          target: { kind: "cell", cellId: shore.cellId, zLayer: 0 },
          tags: ["#ChaosFlowShores"],
        });
      }
    }
  }

  // Bi-daily: update ambient chaos zones, blight, environmental tags, and spawn flow bank agents.
  if (snap.tick % 2 === 0) {
    let cultistCount = snap.agentCounts.cultist;
    let wardenCount = snap.agentCounts.warden;
    let zealotCount = snap.agentCounts.chainZealot;

    const zoneUpserts = new Map<string, { cellId: number; intensity: number; type: string }>();
    const blightDeltas = new Map<number, number>();
    const pendingTagEntries: Array<{ cellId: number; tags: string[] }> = [];

    let ptOrd = 0;
    for (const flow of liveFlows) {
      const samplePts = [flow.waypoints[2], flow.waypoints[5], flow.waypoints[8]].filter(Boolean);
      for (const _pt of samplePts) {
        const nearbyCells = snap.sampleCellsByPoint[ptOrd] || [];
        ptOrd++;
        for (const cell of nearbyCells) {
          const prox = evaluatePointChaosFlowProximity(cell.centerX, cell.centerY, [flow]);
          if (!(prox.intersected || prox.isAdjacent)) continue;

          const zoneIntensity = Math.round(prox.ambientChaos * 100);
          const zoneType = `${flow.elementalPower.toUpperCase()}_CHAOS_LEYS`;
          zoneUpserts.set(`${cell.id}:${zoneType}`, { cellId: cell.id, intensity: zoneIntensity, type: zoneType });
          blightDeltas.set(cell.id, (blightDeltas.get(cell.id) || 0) + 1.5);

          const flowTags = [
            "#ChaosFlowShores",
            `#DragonLeys_${flow.dragonName}`,
            ...(FLOW_DOMAIN_TAGS[flow.elementalPower] || ["#PrimordialAether"]),
          ];
          pendingTagEntries.push({ cellId: cell.id, tags: flowTags });

          if (random() < 0.10) {
            const roll = random();
            if (roll < 0.50) {
              if (cultistCount < 288) {
                cultistCount++;
                deltas.push({
                  kind: "agent.create",
                  name: `Flow Cabal of ${flow.dragonName}`,
                  role: "Cultist",
                  subRole: "Cultist_Pilgrim",
                  locationCellId: cell.id,
                  targetGroveId: flow.flowId,
                  state: "TRAVELING_TO_SEAL",
                  corruption: 20,
                  ageTicks: 0,
                  activePlot: "Communing with chaotic aether along flow banks",
                  createdTick: snap.tick,
                });
              }
            } else if (roll < 0.80) {
              if (wardenCount < 72) {
                wardenCount++;
                deltas.push({
                  kind: "agent.create",
                  name: "Grey Warden Flow-Patrol",
                  role: "Warden",
                  subRole: "Warden_Sentinel",
                  locationCellId: cell.id,
                  targetGroveId: flow.flowId,
                  state: "PATROLLING_FLOW",
                  corruption: 5,
                  ageTicks: 0,
                  activePlot: "Patrolling primordial flow perimeter",
                  createdTick: snap.tick,
                });
              }
            } else {
              if (zealotCount < 20) {
                zealotCount++;
                deltas.push({
                  kind: "agent.create",
                  name: "Null-Chain Outriders",
                  role: "Chain_Zealot",
                  subRole: "Chain_Inquisitor",
                  locationCellId: cell.id,
                  state: "WITCH_HUNTING",
                  drainedPower: 15,
                  ageTicks: 0,
                  activePlot: "Hunting wild sparks drawn to the flow",
                  createdTick: snap.tick,
                });
              }
            }
          }
        }
      }
    }

    const sortedZones = Array.from(zoneUpserts.values()).sort(
      (a, b) => a.cellId - b.cellId || a.type.localeCompare(b.type)
    );
    for (const z of sortedZones) {
      deltas.push({
        kind: "chaosZone.upsert",
        cellId: z.cellId,
        intensity: z.intensity,
        type: z.type,
        updateOnConflict: true,
      });
    }

    const sortedBlight = Array.from(blightDeltas.entries()).sort((a, b) => a[0] - b[0]);
    for (const [cellId, delta] of sortedBlight) {
      deltas.push({ kind: "cell.adjust", cellId, ecoBlight: delta });
    }

    for (const t of pendingTagEntries) {
      deltas.push({ kind: "tags.add", target: { kind: "cell", cellId: t.cellId, zLayer: 0 }, tags: t.tags });
    }
  }

  return { liveFlows, deltas };
}
