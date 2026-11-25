import { PoolClient, Pool } from "pg";
import { flushStepDeltas } from "../deltas/index.js";
import { loadChaosFlow } from "../macro/chaosFlow/load.js";
import {
  type ChaosFlowAnchor,
  type ChaosFlowWaypoint,
  type NarrowCrossingSpot,
  type LiveChaosFlowState,
  parseChaosFlowAnchor,
  lunarSurgeModifier,
  computeChaosFlowState,
  evaluatePointChaosFlowProximity,
  stepChaosFlow,
} from "../macro/chaosFlow/step.js";

export type {
  ChaosFlowAnchor,
  ChaosFlowWaypoint,
  NarrowCrossingSpot,
  LiveChaosFlowState,
};

export {
  parseChaosFlowAnchor,
  lunarSurgeModifier,
  computeChaosFlowState,
  evaluatePointChaosFlowProximity,
};

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
  const snap = await loadChaosFlow(client, tick, calendarData);
  const out = stepChaosFlow(snap, { random: Math.random });
  if (out.deltas.length > 0) {
    await flushStepDeltas(client, "agent:chaosFlows", tick, out.deltas);
  }
  return out.liveFlows;
}

/**
 * Retrieves all currently persisted chaos flows from PostgreSQL.
 */
export async function getActiveChaosFlows(client: PoolClient | Pool): Promise<LiveChaosFlowState[]> {
  const res = await client.query("SELECT * FROM sim_chaos_flows ORDER BY flow_id ASC");
  return res.rows.map((r) => ({
    flowId: r.flow_id,
    name: r.name,
    dragonName: r.dragon_name,
    elementalPower: r.elemental_power,
    currentSurge: Number(r.current_surge),
    currentWidth: Number(r.current_width),
    waypoints: typeof r.waypoints === "string" ? JSON.parse(r.waypoints) : r.waypoints || [],
    narrowSpots: typeof r.narrow_spots === "string" ? JSON.parse(r.narrow_spots) : r.narrow_spots || [],
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
    statModifiers: { fortitude: 2, reflex: -1 },
  },
  {
    key: "flicker_iris",
    name: "Nexus Fold Iris",
    dragonName: "Carulkem",
    domain: "Nexus",
    description: "Your pupils fracture into violet spatial tears, perceiving dimensional folds but blurring sequential deductive thought.",
    statModifiers: { awareness: 2, logic: -1 },
  },
  {
    key: "stasis_frost_tendons",
    name: "Stasis Crystal Tendons",
    dragonName: "Stagus",
    domain: "Ordo",
    description: "Pale stasis crystals encrust your tendons, imparting immovable posture but stiffening fluid articulation.",
    statModifiers: { endurance: 2, finesse: -1 },
  },
  {
    key: "decree_brand",
    name: "Iron Decree Brand",
    dragonName: "Vahn",
    domain: "Lex",
    description: "Glowing crimson binding runes scorch your vocal cords; your voice commands fearful obedience while souring pleasantries.",
    statModifiers: { willpower: 2, charm: -1 },
  },
  {
    key: "gale_marrow",
    name: "Kinetic Gale Marrow",
    dragonName: "Vecelo",
    domain: "Motus",
    description: "Your bones hollow with whistling air currents, allowing blinding sprints but rendering your skeleton more brittle.",
    statModifiers: { reflex: 2, fortitude: -1 },
  },
  {
    key: "biomantic_polyp",
    name: "Chimeric Polyp Sprout",
    dragonName: "Ulex",
    domain: "Flux",
    description: "Bioluminescent mutating spores take root in your chest, knitting wounds rapidly while repulsive floral growths sprout.",
    statModifiers: { vitality: 2, charm: -2 },
  },
  {
    key: "predator_bone_teeth",
    name: "Serrated Dragon Bone",
    dragonName: "Gavusrix",
    domain: "Vita",
    description: "Fangs lengthen into predatory ivory serrations; raw bloodlust empowers brutal physical strikes while fraying mental calm.",
    statModifiers: { might: 2, composure: -4 },
  },
  {
    key: "clockwork_synapse",
    name: "Ratio Lattice Synapse",
    dragonName: "Eldra",
    domain: "Ratio",
    description: "Neural nodes hum with geometric clockwork frequency, calculating vectors flawlessly but numbing gut instincts.",
    statModifiers: { logic: 2, intuition: -1 },
  },
  {
    key: "solar_phosphor_sheath",
    name: "Luminescent Phosphor Sheath",
    dragonName: "Lophex",
    domain: "Lux",
    description: "Your epidermis radiates an unearthly golden celestial glow, captivating onlookers but rendering stealth impossible.",
    statModifiers: { charm: 2, finesse: -2 },
  },
  {
    key: "omen_void_socket",
    name: "Eclipse Void Socket",
    dragonName: "Sevrath",
    domain: "Omen",
    description: "One eye withers into a swirling eclipse abyss that gazes into impending tragedies, taxing your living vitality.",
    statModifiers: { intuition: 2, vitality: -1 },
  },
  {
    key: "phantasm_vapor_shroud",
    name: "Phantasmagoric Vapor Shroud",
    dragonName: "Virantor",
    domain: "Aura",
    description: "Violet psychic mist trails from your extremities, blurring your spatial silhouette while softening physical density.",
    statModifiers: { finesse: 2, fortitude: -1 },
  },
  {
    key: "soul_ash_frost",
    name: "Necrotic Ash Frost",
    dragonName: "Grolak",
    domain: "Anumis",
    description: "Black necrotic rime courses through your bloodstream, deadening mortal pain while freezing living warmth.",
    statModifiers: { fortitude: 2, vitality: -1 },
  },
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
  let matched = CHAOS_MUTATIONS.find(
    (m) => m.domain.toLowerCase() === flowDomain.toLowerCase() || m.dragonName.toLowerCase() === flowDomain.toLowerCase()
  );
  if (!matched || Math.random() < 0.3) {
    matched = CHAOS_MUTATIONS[Math.floor(Math.random() * CHAOS_MUTATIONS.length)];
  }
  const candidate: ChaosMutationDef = matched || CHAOS_MUTATIONS[0]!;

  await client.query(
    `INSERT INTO sim_player_mutations (player_id, mutation_key, mutation_name, description, stat_modifiers, acquired_at_tick, acquired_source)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [playerId, candidate.key, candidate.name, candidate.description, JSON.stringify(candidate.statModifiers), tick, sourceDescription]
  );

  const charRes = await client.query("SELECT * FROM sim_player_character WHERE id = $1", [playerId]);
  if (charRes.rows.length > 0) {
    const p = charRes.rows[0];
    const traits: string[] = typeof p.passive_traits === "string"
      ? JSON.parse(p.passive_traits)
      : Array.isArray(p.passive_traits)
        ? p.passive_traits
        : [];
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
