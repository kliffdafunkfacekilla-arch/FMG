/**
 * The 12 Dragon Prisons on the Holgaland map, and the sink their chaos flows run to.
 *
 * Canon source (read-only, never restate it here): Shatterlands/Canon/06_Dragons_and_the_Prisons.md §2
 * (clock, Power, dragon) and Canon/02_The_Twelve_Powers.md. If this table disagrees with canon,
 * this table is wrong (AGENT_RULES rule 3). testChaosFlows.ts pins clock -> dragon -> Power.
 *
 * Coordinates and cell IDs are positions on the live Holgaland map (data/Holgaland.json).
 * `clock` doubles as the flow_id in sim_chaos_flows.
 */

export interface CanonDragonPrison {
  clock: number;
  dragon: string;
  power: string;
  cell: number;
  x: number;
  y: number;
  cult: string;
  angleDeg: number;
}

export const CANON_DRAGON_PRISONS: readonly CanonDragonPrison[] = [
  { clock: 1, dragon: "Eldra", power: "Ratio", cell: 12768, x: 2880.0, y: 1004.54, cult: "The Ghost-Light Cartel", angleDeg: 30 },
  { clock: 2, dragon: "Vecelo", power: "Motus", cell: 15004, x: 2787.84, y: 1147.39, cult: "The Strangler Fig", angleDeg: 60 },
  { clock: 3, dragon: "Lophex", power: "Lux", cell: 17855, x: 2769.41, y: 1320.19, cult: "The Blind Spot", angleDeg: 90 },
  { clock: 4, dragon: "Sevrath", power: "Omen", cell: 19502, x: 2827.01, y: 1483.78, cult: "The Rotting Vessel", angleDeg: 120 },
  { clock: 5, dragon: "Grolak", power: "Anumis", cell: 21943, x: 2960.64, y: 1594.37, cult: "The Null-Equation", angleDeg: 150 },
  { clock: 6, dragon: "Gavusrix", power: "Vita", cell: 22175, x: 3138.05, y: 1615.1, cult: "The Quicksilver Mother", angleDeg: 180 },
  { clock: 7, dragon: "Stagus", power: "Ordo", cell: 21260, x: 3297.02, y: 1539.07, cult: "The Frozen Heart", angleDeg: 210 },
  { clock: 8, dragon: "Carulkem", power: "Nexus", cell: 18826, x: 3389.18, y: 1393.92, cult: "True Smelt", angleDeg: 240 },
  { clock: 9, dragon: "Virantor", power: "Aura", cell: 16069, x: 3403.01, y: 1221.12, cult: "Siren Song", angleDeg: 270 },
  { clock: 10, dragon: "Ulex", power: "Flux", cell: 13720, x: 3340.8, y: 1059.84, cult: "Toxic Liquidity", angleDeg: 300 },
  { clock: 11, dragon: "Vahn", power: "Lex", cell: 11502, x: 3207.17, y: 951.55, cult: "The Cult of Identity", angleDeg: 330 },
  { clock: 12, dragon: "Tiraton", power: "Mass", cell: 11708, x: 3036.67, y: 930.82, cult: "The Cult of the Crushed", angleDeg: 360 },
];

/** The Verge (Sacred Spire): where all 12 flows converge on the Holgaland map. */
export const VERGE_COORD = { x: 783.36, y: 1216.51, cell: 16166 } as const;

/** Display name for a flow, as written by the map ingest. */
export function canonFlowName(p: CanonDragonPrison): string {
  return `Primordial Flow of ${p.dragon} (${p.power})`;
}
