/**
 * The 12 Dragon Prisons on the Ostraka map, and the sink their chaos flows run to.
 *
 * Canon source (read-only, never restate it here): Shatterlands/Canon/06_Dragons_and_the_Prisons.md §2
 * (clock, Power, dragon) and Canon/02_The_Twelve_Powers.md. If this table disagrees with canon,
 * this table is wrong (AGENT_RULES rule 3). testChaosFlows.ts pins clock -> dragon -> Power.
 *
 * Coordinates and cell IDs match Shatterlands/Ostraka_full.map (6125 x 2496, 58,091 pack cells).
 * Tiraton (north pole) and Gavusrix (south pole) sit past the poles, pinned to their nearest polar cells.
 * `clock` doubles as the flow_id in sim_chaos_flows.
 */

export const OSTRAKA_MAP_WIDTH = 6125;
export const OSTRAKA_MAP_HEIGHT = 2496;

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
  { clock: 1,  dragon: "Eldra",    power: "Ratio",  cell: 7584,  x: 3099, y: 374,  cult: "The Ghost-Light Cartel",  angleDeg: 30 },
  { clock: 2,  dragon: "Vecelo",   power: "Motus",  cell: 19401, x: 3099, y: 885,  cult: "The Strangler Fig",       angleDeg: 60 },
  { clock: 3,  dragon: "Lophex",   power: "Lux",    cell: 32123, x: 3099, y: 1395, cult: "The Blind Spot",          angleDeg: 90 },
  { clock: 4,  dragon: "Sevrath",  power: "Omen",   cell: 45501, x: 3099, y: 1906, cult: "The Rotting Vessel",      angleDeg: 120 },
  { clock: 5,  dragon: "Grolak",   power: "Anumis", cell: 56576, x: 3099, y: 2417, cult: "The Null-Equation",       angleDeg: 150 },
  { clock: 6,  dragon: "Gavusrix", power: "Vita",   cell: 57873, x: 1577, y: 2484, cult: "The Quicksilver Mother",  angleDeg: 180 },
  { clock: 7,  dragon: "Stagus",   power: "Ordo",   cell: 53188, x: 36,   y: 2124, cult: "The Frozen Heart",        angleDeg: 210 },
  { clock: 8,  dragon: "Carulkem", power: "Nexus",  cell: 37766, x: 36,   y: 1613, cult: "True Smelt",              angleDeg: 240 },
  { clock: 9,  dragon: "Virantor", power: "Aura",   cell: 24157, x: 36,   y: 1103, cult: "Siren Song",              angleDeg: 270 },
  { clock: 10, dragon: "Ulex",     power: "Flux",   cell: 12695, x: 36,   y: 592,  cult: "Toxic Liquidity",         angleDeg: 300 },
  { clock: 11, dragon: "Vahn",     power: "Lex",    cell: 2220,  x: 36,   y: 82,   cult: "The Cult of Identity",    angleDeg: 330 },
  { clock: 12, dragon: "Tiraton",  power: "Mass",   cell: 2315,  x: 1577, y: 12,   cult: "The Cult of the Crushed", angleDeg: 360 },
];

/** The Verge (Sacred Spire): where all 12 flows converge on Ostraka_full.map. */
export const VERGE_COORD = { x: 1577, y: 1171, cell: 26707 } as const;

/** The Coral Crown / Antiverge Trench on Ostraka_full.map. */
export const CORAL_CROWN_COORD = { x: 4629, y: 1249, cell: 30016 } as const;

/** Display name for a flow, as written by the map ingest. */
export function canonFlowName(p: CanonDragonPrison): string {
  return `Primordial Flow of ${p.dragon} (${p.power})`;
}
