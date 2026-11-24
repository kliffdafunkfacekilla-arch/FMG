/**
 * civicFlags.ts
 * Pure mapping of `sim_burg_economy` civic boolean columns (`port`, `citadel`, `walls`, `plaza`,
 * `temple`, `shanty`, `is_capital`) into tactical map generation and siege defense multipliers.
 */

export interface BurgCivicFlags {
  port: boolean;
  citadel: boolean;
  walls: boolean;
  plaza: boolean;
  temple: boolean;
  shanty: boolean;
  isCapital: boolean;
}

function readBoolFlag(raw: unknown): boolean | undefined {
  if (typeof raw === "boolean") return raw;
  if (raw === 1 || raw === "true" || raw === "t") return true;
  if (raw === 0 || raw === "false" || raw === "f") return false;
  return undefined;
}

/**
 * Normalizes a burg row's civic flags (`port`, `citadel`, `walls`, `plaza`, `temple`, `shanty`,
 * `is_capital` / `capital`), preserving backwards-compatible tier walls only when `walls` is unset.
 */
export function extractBurgCivicFlags(burg: any, fallbackTier = 1): BurgCivicFlags {
  const wallsVal = readBoolFlag(burg?.walls);
  const capitalVal = readBoolFlag(burg?.is_capital ?? burg?.capital);
  return {
    port: readBoolFlag(burg?.port) ?? false,
    citadel: readBoolFlag(burg?.citadel) ?? false,
    walls: wallsVal !== undefined ? wallsVal : fallbackTier >= 2,
    plaza: readBoolFlag(burg?.plaza) ?? (fallbackTier >= 2),
    temple: readBoolFlag(burg?.temple) ?? false,
    shanty: readBoolFlag(burg?.shanty) ?? false,
    isCapital: capitalVal ?? false,
  };
}

/**
 * Computes siege defender combat multiplier from a burg's civic fortifications & sprawl.
 */
export function computeSiegeDefenseMultiplier(flags: Partial<BurgCivicFlags>): number {
  const mult =
    1.0 +
    (flags.walls ? 0.25 : 0) +
    (flags.citadel ? 0.35 : 0) +
    (flags.isCapital ? 0.15 : 0) +
    (flags.port ? 0.10 : 0) -
    (flags.shanty ? 0.08 : 0);
  return Math.max(0.75, Math.round(mult * 100) / 100);
}
