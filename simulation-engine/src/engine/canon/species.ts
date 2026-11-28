/**
 * Canon: the peoples of this world are evolved mammals, aquatics, avians, reptiles, insects and plants.
 * There are no humans: none alive, none in history. Nothing may generate, default to or describe one.
 *
 * DEFAULT_SPECIES is only a fallback for a record that somehow has no species; real people always carry their own.
 */
export const DEFAULT_SPECIES = "Wolf-Kin";

/** Species that do not exist in this world. Checked by testChaosFlows' canon guard and removeHumans. */
export const NOT_IN_WORLD = ["Human"] as const;

export function isWorldSpecies(species: string | null | undefined): boolean {
  const s = String(species || "").trim().toLowerCase();
  return s !== "" && !NOT_IN_WORLD.some((n) => s === n.toLowerCase() || s.startsWith(n.toLowerCase() + " "));
}

/** The species to record: the given one if it exists in this world, otherwise the default. */
export function worldSpecies(species: string | null | undefined): string {
  return isWorldSpecies(species) ? String(species).trim() : DEFAULT_SPECIES;
}
