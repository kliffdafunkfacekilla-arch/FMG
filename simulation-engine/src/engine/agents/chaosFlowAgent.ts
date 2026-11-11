import { MERCY_ALIGNMENT, NIGHTMARE_ALIGNMENT } from "../canon/calendar.js";
import { PoolClient, Pool } from "pg";
import { tagSectorEnvironment } from "./citizenPersonaHelper";

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

/** Surge modifier from the blood moon's phase. */
export function lunarSurgeModifier(moonPhase: string): number {
  if (moonPhase === NIGHTMARE_ALIGNMENT) return 1.2; // Reality-tearing flood
  if (moonPhase === "The Open Eye") return 0.85; // The Bleed: peak chaos surge
  if (moonPhase === MERCY_ALIGNMENT) return -0.45; // Wound shadowed, chaos damped
  if (moonPhase === "The Halo") return -0.2; // The mild seasons
  if (moonPhase.includes("Empty") || moonPhase.includes("Waxing")) return 0.2;
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

  // Ebb & flow power
  const isDomainAligned = anchor.dragonName.toLowerCase() === ctx.dragonDomain.toLowerCase() ||
                          anchor.elementalPower.toLowerCase() === ctx.activeFlow.toLowerCase();
  const baseSurge = isDomainAligned ? 2.1 : 1.0;
  // Harmonic oscillation over days
  const waveSurge = Math.sin((tick * 0.06) + (anchor.flowId * 1.3)) * 0.35;
  const netSurge = Math.max(0.3, parseFloat((baseSurge + ctx.lunarSurgeMod + waveSurge).toFixed(2)));

  // Channel width scales with surge
  const baseWidth = parseFloat((24.0 * Math.sqrt(netSurge)).toFixed(1));

  // Shifting meander waypoints from source to sink
  const NUM_SEGMENTS = 10;
  const waypoints: ChaosFlowWaypoint[] = [];
  const narrowSpots: NarrowCrossingSpot[] = [];

  const dx = sink.x - source.x;
  const dy = sink.y - source.y;
  const dist = Math.hypot(dx, dy) || 1;
  // Unit normal vector for lateral meander
  const nx = -dy / dist;
  const ny = dx / dist;

  for (let s = 0; s <= NUM_SEGMENTS; s++) {
    const t = s / NUM_SEGMENTS; // 0.0 at source, 1.0 at sink
    const baseX = source.x + dx * t;
    const baseY = source.y + dy * t;

    // Sinusoidal lateral drift that moves over game ticks; zero at both ends (sin(0) = sin(pi) = 0)
    const meanderPhase = (tick * 0.04) + (s * 0.8) + (anchor.flowId * 1.2);
    const meanderAmplitude = Math.sin(t * Math.PI) * (70.0 * Math.min(1.8, netSurge));
    const lateralOffset = Math.sin(meanderPhase) * meanderAmplitude;

    const wx = Math.round(baseX + nx * lateralOffset);
    const wy = Math.round(baseY + ny * lateralOffset);

    waypoints.push({ x: wx, y: wy, segmentIndex: s });

    // Natural narrow constriction points where the flow pinches
    if (s === 3 || s === 7) {
      const pinchWidth = Math.max(4.0, parseFloat((baseWidth * 0.32).toFixed(1)));
      const crossingDC = Math.min(25, Math.max(11, Math.round(12 + (netSurge * 3.5))));
      narrowSpots.push({
        x: wx,
        y: wy,
        widthMeters: pinchWidth,
        crossingDC,
        description: `The Glass-Rock Ford of ${anchor.dragonName}: roaring ${anchor.elementalPower} aether narrows into a jagged chasm (${pinchWidth}m wide).`
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
    narrowSpots
  };
}

/**
 * Evaluates the dynamic shifting paths and ebb/flow power of the 12 Primordial Chaos Flows
 * as they surge from their prisons toward The Verge.
 *
 * Identity (name, dragon, Power) and endpoints are owned by the map ingest
 * (engine/canon/dragonPrisons.ts); this agent only updates the per-tick fields.
 */
export async function runChaosFlowAgent(
  client: PoolClient | Pool,
  tick: number,
  calendarData?: { active_flow?: string; dragon_domain?: string; moon_phase?: string }
): Promise<LiveChaosFlowState[]> {
  const ctx = {
    activeFlow: calendarData?.active_flow || "Mass",
    dragonDomain: calendarData?.dragon_domain || "Tiraton",
    lunarSurgeMod: lunarSurgeModifier(calendarData?.moon_phase || "The Halo"),
  };

  const anchorRes = await client.query(
    `SELECT flow_id, name, dragon_name, elemental_power, source_coord, sink_coord
     FROM sim_chaos_flows ORDER BY flow_id ASC`
  );
  const anchors = anchorRes.rows
    .map(parseChaosFlowAnchor)
    .filter((a): a is ChaosFlowAnchor => a !== null);
  if (anchors.length === 0) {
    console.warn("[chaosFlowAgent] sim_chaos_flows has no seeded flows; run the map ingest (world reset).");
    return [];
  }

  const liveFlows: LiveChaosFlowState[] = [];

  for (const anchor of anchors) {
    const flowState = computeChaosFlowState(anchor, tick, ctx);
    liveFlows.push(flowState);

    await client.query(
      `UPDATE sim_chaos_flows SET
         current_surge = $2,
         current_width = $3,
         waypoints = $4,
         narrow_spots = $5,
         updated_at = CURRENT_TIMESTAMP
       WHERE flow_id = $1`,
      [
        anchor.flowId,
        flowState.currentSurge,
        flowState.currentWidth,
        JSON.stringify(flowState.waypoints),
        JSON.stringify(flowState.narrowSpots)
      ]
    );
  }

  // Inject critical event if a major flow is at flood surge
  const surging = liveFlows.find(f => f.currentSurge >= 2.4);
  if (surging && (tick % 7 === 0)) {
    await client.query(
      `INSERT INTO sim_events (tick, type, tier, message)
       VALUES ($1, 'CHAOS_SURGE', 'CRITICAL', $2)`,
      [
        tick,
        `⚡ PRIMORDIAL SURGE: ${surging.name} has flooded its banks! An iridescent torrent of ${surging.elementalPower} aether cuts across the province. Crossing on foot without an airship is deadly!`
      ]
    ).catch(() => {});
  }

  // 4. Update Ambient Chaos & Attract Cultists / Wardens along Flow Banks
  if (tick % 2 === 0) {
    try {
      for (const flow of liveFlows) {
        const samplePts = [flow.waypoints[2], flow.waypoints[5], flow.waypoints[8]].filter(Boolean);
        for (const pt of samplePts) {
          if (!pt) continue;
          const nearbyCellsRes = await client.query(
            `SELECT id, center_x, center_y, eco_blight FROM sim_cells
             WHERE center_x BETWEEN $1 AND $2 AND center_y BETWEEN $3 AND $4
             LIMIT 4`,
            [pt.x - 70, pt.x + 70, pt.y - 70, pt.y + 70]
          );

          for (const cell of nearbyCellsRes.rows) {
            const prox = evaluatePointChaosFlowProximity(cell.center_x, cell.center_y, [flow]);
            if (prox.intersected || prox.isAdjacent) {
              const zoneIntensity = Math.round(prox.ambientChaos * 100);
              await client.query(
                `INSERT INTO sim_chaos_zones (cell_id, intensity, type)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (cell_id, type) DO UPDATE SET intensity = EXCLUDED.intensity`,
                [cell.id, zoneIntensity, `${flow.elementalPower.toUpperCase()}_CHAOS_LEYS`]
              ).catch(() => {});

              await client.query(
                `UPDATE sim_cells
                 SET eco_blight = LEAST(100.0, COALESCE(eco_blight, 0) + 1.5)
                 WHERE id = $1`,
                [cell.id]
              ).catch(() => {});

              // Apply primordial chaos environmental tags to the sector layer
              const domainTags: Record<string, string[]> = {
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
                Anumis: ["#SoulAshMiasma", "#RestlessShades", "#NecroticChill"]
              };
              const flowTags = [
                "#ChaosFlowShores",
                `#DragonLeys_${flow.dragonName}`,
                ...(domainTags[flow.elementalPower] || ["#PrimordialAether"])
              ];
              await tagSectorEnvironment(client, cell.id, flowTags, 0);

              if (Math.random() < 0.10) {
                const roll = Math.random();
                if (roll < 0.50) {
                  const cCount = await client.query("SELECT COUNT(*) as cnt FROM sim_agents WHERE role = 'Cultist'");
                  if (parseInt(cCount.rows[0].cnt) < 288) {
                    await client.query(
                      `INSERT INTO sim_agents (name, role, sub_role, location_cell_id, state, corruption, age_ticks, active_plot)
                       VALUES ($1, 'Cultist', 'Cultist_Pilgrim', $2, 'TRAVELING_TO_SEAL', 20, 0, 'Communing with chaotic aether along flow banks')`,
                      [`Flow Cabal of ${flow.dragonName}`, cell.id]
                    ).catch(() => {});
                  }
                } else if (roll < 0.80) {
                  const wCount = await client.query("SELECT COUNT(*) as cnt FROM sim_agents WHERE role = 'Warden'");
                  if (parseInt(wCount.rows[0].cnt) < 72) {
                    await client.query(
                      `INSERT INTO sim_agents (name, role, sub_role, location_cell_id, state, corruption, age_ticks, active_plot)
                       VALUES ($1, 'Warden', 'Warden_Sentinel', $2, 'TRAVELING_TO_SEAL', 5, 0, 'Patrolling primordial flow perimeter')`,
                      [`Grey Warden Flow-Patrol`, cell.id]
                    ).catch(() => {});
                  }
                } else {
                  const zCount = await client.query("SELECT COUNT(*) as cnt FROM sim_agents WHERE role = 'Chain_Zealot'");
                  if (parseInt(zCount.rows[0].cnt) < 20) {
                    await client.query(
                      `INSERT INTO sim_agents (name, role, sub_role, location_cell_id, state, drained_power, age_ticks, active_plot)
                       VALUES ($1, 'Chain_Zealot', 'Chain_Inquisitor', $2, 'WITCH_HUNTING', 15, 0, 'Hunting wild sparks drawn to the flow')`,
                      [`Null-Chain Outriders`, cell.id]
                    ).catch(() => {});
                  }
                }
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn("Error updating flow adjacent chaos cells:", err);
    }
  }

  return liveFlows;
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
    // Check against river waypoint segments
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

    // Check narrow spots proximity
    for (const spot of flow.narrowSpots) {
      const spotDist = Math.hypot(px - spot.x, py - spot.y);
      if (spotDist <= 40) {
        matchedNarrow = spot;
        break;
      }
    }
  }

  const flowHalfWidth = closestFlow ? (closestFlow.currentWidth * 1.5) : 35;
  const intersected = closestFlow ? closestDist <= flowHalfWidth : false;
  const isAdjacent = closestFlow ? (!intersected && closestDist <= (flowHalfWidth + 75)) : false;
  const nearNarrowSpot = !!matchedNarrow;

  let ambientChaos = 0.10;
  if (closestFlow) {
    if (intersected) {
      ambientChaos = Math.min(1.0, 0.85 * (closestFlow.currentSurge || 1.0));
    } else if (isAdjacent) {
      const proximityFactor = Math.max(0, 1.0 - ((closestDist - flowHalfWidth) / 75.0));
      ambientChaos = Math.min(0.95, parseFloat((0.55 + (0.35 * proximityFactor * Math.min(1.4, closestFlow.currentSurge))).toFixed(2)));
    }
  }

  return {
    intersected,
    isAdjacent,
    nearNarrowSpot,
    nearestFlow: closestFlow,
    distToFlow: closestDist,
    narrowSpot: matchedNarrow,
    ambientChaos
  };
}

/**
 * Retrieves all currently persisted chaos flows from PostgreSQL.
 */
export async function getActiveChaosFlows(client: PoolClient | Pool): Promise<LiveChaosFlowState[]> {
  const res = await client.query("SELECT * FROM sim_chaos_flows ORDER BY flow_id ASC");
  return res.rows.map(r => ({
    flowId: r.flow_id,
    name: r.name,
    dragonName: r.dragon_name,
    elementalPower: r.elemental_power,
    currentSurge: Number(r.current_surge),
    currentWidth: Number(r.current_width),
    waypoints: typeof r.waypoints === "string" ? JSON.parse(r.waypoints) : (r.waypoints || []),
    narrowSpots: typeof r.narrow_spots === "string" ? JSON.parse(r.narrow_spots) : (r.narrow_spots || [])
  }));
}

export interface ChaosMutationDef {
  key: string;
  name: string;
  dragonName: string;
  domain: string;
  description: string;
  statModifiers: Record<string, number>;
}

export const CHAOS_MUTATIONS: ChaosMutationDef[] = [
  {
    key: "basalt_carapace",
    name: "Basalt Carapace Graft",
    dragonName: "Tiraton",
    domain: "Mass",
    description: "Hardened volcanic slate encases your torso and arms; your mass deflects heavy blows at the expense of agile evasion.",
    statModifiers: { fortitude: 2, reflex: -1 }
  },
  {
    key: "flicker_iris",
    name: "Nexus Fold Iris",
    dragonName: "Carulkem",
    domain: "Nexus",
    description: "Your pupils fracture into violet spatial tears, perceiving dimensional folds but blurring sequential deductive thought.",
    statModifiers: { awareness: 2, logic: -1 }
  },
  {
    key: "stasis_frost_tendons",
    name: "Stasis Crystal Tendons",
    dragonName: "Stagus",
    domain: "Ordo",
    description: "Pale stasis crystals encrust your tendons, imparting immovable posture but stiffening fluid articulation.",
    statModifiers: { endurance: 2, finesse: -1 }
  },
  {
    key: "decree_brand",
    name: "Iron Decree Brand",
    dragonName: "Vahn",
    domain: "Lex",
    description: "Glowing crimson binding runes scorch your vocal cords; your voice commands fearful obedience while souring pleasantries.",
    statModifiers: { willpower: 2, charm: -1 }
  },
  {
    key: "gale_marrow",
    name: "Kinetic Gale Marrow",
    dragonName: "Vecelo",
    domain: "Motus",
    description: "Your bones hollow with whistling air currents, allowing blinding sprints but rendering your skeleton more brittle.",
    statModifiers: { reflex: 2, fortitude: -1 }
  },
  {
    key: "biomantic_polyp",
    name: "Chimeric Polyp Sprout",
    dragonName: "Ulex",
    domain: "Flux",
    description: "Bioluminescent mutating spores take root in your chest, knitting wounds rapidly while repulsive floral growths sprout.",
    statModifiers: { vitality: 2, charm: -2 }
  },
  {
    key: "predator_bone_teeth",
    name: "Serrated Dragon Bone",
    dragonName: "Gavusrix",
    domain: "Vita",
    description: "Fangs lengthen into predatory ivory serrations; raw bloodlust empowers brutal physical strikes while fraying mental calm.",
    statModifiers: { might: 2, composure: -4 }
  },
  {
    key: "clockwork_synapse",
    name: "Ratio Lattice Synapse",
    dragonName: "Eldra",
    domain: "Ratio",
    description: "Neural nodes hum with geometric clockwork frequency, calculating vectors flawlessly but numbing gut instincts.",
    statModifiers: { logic: 2, intuition: -1 }
  },
  {
    key: "solar_phosphor_sheath",
    name: "Luminescent Phosphor Sheath",
    dragonName: "Lophex",
    domain: "Lux",
    description: "Your epidermis radiates an unearthly golden celestial glow, captivating onlookers but rendering stealth impossible.",
    statModifiers: { charm: 2, finesse: -2 }
  },
  {
    key: "omen_void_socket",
    name: "Eclipse Void Socket",
    dragonName: "Sevrath",
    domain: "Omen",
    description: "One eye withers into a swirling eclipse abyss that gazes into impending tragedies, taxing your living vitality.",
    statModifiers: { intuition: 2, vitality: -1 }
  },
  {
    key: "phantasm_vapor_shroud",
    name: "Phantasmagoric Vapor Shroud",
    dragonName: "Virantor",
    domain: "Aura",
    description: "Violet psychic mist trails from your extremities, blurring your spatial silhouette while softening physical density.",
    statModifiers: { finesse: 2, fortitude: -1 }
  },
  {
    key: "soul_ash_frost",
    name: "Necrotic Ash Frost",
    dragonName: "Grolak",
    domain: "Anumis",
    description: "Black necrotic rime courses through your bloodstream, deadening mortal pain while freezing living warmth.",
    statModifiers: { fortitude: 2, vitality: -1 }
  }
];

/**
 * Applies a cosmic corruption mutation to a player character in PostgreSQL.
 */
export async function applyPlayerChaosMutation(
  client: PoolClient | Pool,
  playerId: number,
  flowDomain: string,
  tick: number,
  sourceDescription: string
): Promise<ChaosMutationDef> {
  // Find mutation aligned with domain, or pick random
  let matched = CHAOS_MUTATIONS.find(
    m => m.domain.toLowerCase() === flowDomain.toLowerCase() || m.dragonName.toLowerCase() === flowDomain.toLowerCase()
  );
  if (!matched || Math.random() < 0.3) {
    matched = CHAOS_MUTATIONS[Math.floor(Math.random() * CHAOS_MUTATIONS.length)];
  }
  const candidate: ChaosMutationDef = matched || CHAOS_MUTATIONS[0]!;

  // Persist into sim_player_mutations
  await client.query(
    `INSERT INTO sim_player_mutations (player_id, mutation_key, mutation_name, description, stat_modifiers, acquired_at_tick, acquired_source)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [playerId, candidate.key, candidate.name, candidate.description, JSON.stringify(candidate.statModifiers), tick, sourceDescription]
  );

  // Apply stat delta and trait to sim_player_character
  const charRes = await client.query("SELECT * FROM sim_player_character WHERE id = $1", [playerId]);
  if (charRes.rows.length > 0) {
    const p = charRes.rows[0];
    const traits: string[] = typeof p.passive_traits === "string" ? JSON.parse(p.passive_traits) : (Array.isArray(p.passive_traits) ? p.passive_traits : []);
    if (!traits.includes(candidate.name)) {
      traits.push(candidate.name);
    }

    const updates: string[] = ["passive_traits = $2"];
    const params: any[] = [playerId, JSON.stringify(traits)];
    let paramIdx = 3;

    for (const [stat, delta] of Object.entries(candidate.statModifiers)) {
      if (["might", "endurance", "finesse", "reflex", "vitality", "fortitude", "knowledge", "logic", "awareness", "intuition", "charm", "willpower"].includes(stat)) {
        const curVal = Number(p[stat]) || 5;
        const newVal = Math.max(1, Math.min(30, curVal + delta));
        updates.push(`${stat} = $${paramIdx++}`);
        params.push(newVal);
      }
    }

    await client.query(`UPDATE sim_player_character SET ${updates.join(", ")} WHERE id = $1`, params);
  }

  return candidate;
}

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const l2 = Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2);
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
}
