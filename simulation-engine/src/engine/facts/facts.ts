export interface BurgFactInput {
  food: number;
  wealth: number;
  unrest: number;
  pop_null?: number | undefined;
  pop_attuned?: number | undefined;
}

export const FAMINE_FOOD_THRESHOLD = 150;
export const SHORTAGE_FOOD_THRESHOLD = 350;
export const ABUNDANCE_FOOD_THRESHOLD = 800;
export const BLOCKADE_UNREST_THRESHOLD = 70;
export const COMMERCIAL_BOOM_WEALTH_THRESHOLD = 8000;
export const MARTIAL_LAW_UNREST_THRESHOLD = 60;
export const UNDERGROUND_UNREST_THRESHOLD = 45;
export const GUILD_DOMINANCE_WEALTH_THRESHOLD = 4000;

/**
 * Pure simulation facts predicates. Derived tags are computed from state here rather than stored
 * or duplicated across callers (Phase 6, S2). Zero DB or UI imports (Rule 8).
 */
export const facts = {
  famine: (b: BurgFactInput): boolean => b.food < FAMINE_FOOD_THRESHOLD,
  grainShortage: (b: BurgFactInput): boolean => !facts.famine(b) && b.food < SHORTAGE_FOOD_THRESHOLD,
  harvestAbundance: (b: BurgFactInput): boolean => b.food > ABUNDANCE_FOOD_THRESHOLD,
  tradeBlockade: (b: BurgFactInput): boolean => b.unrest > BLOCKADE_UNREST_THRESHOLD,
  marketCollapse: (b: BurgFactInput): boolean => b.unrest > BLOCKADE_UNREST_THRESHOLD,
  commercialBoom: (b: BurgFactInput): boolean => !facts.tradeBlockade(b) && b.wealth > COMMERCIAL_BOOM_WEALTH_THRESHOLD,
  martialLaw: (b: BurgFactInput): boolean => b.unrest > MARTIAL_LAW_UNREST_THRESHOLD,
  undergroundUnrest: (b: BurgFactInput): boolean => b.unrest > UNDERGROUND_UNREST_THRESHOLD,
  guildDominance: (b: BurgFactInput): boolean => b.wealth >= GUILD_DOMINANCE_WEALTH_THRESHOLD && b.unrest <= MARTIAL_LAW_UNREST_THRESHOLD,
  blockaded: (cellTags: readonly string[]): boolean =>
    cellTags.some((t) => t.includes("Blockade") || t.includes("Embargo")),
  garrisonStrength: (b: BurgFactInput): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" =>
    b.unrest > 75 ? "CRITICAL" : b.unrest > 50 ? "HIGH" : b.unrest > 25 ? "MEDIUM" : "LOW",
};

export function factTags(
  b: BurgFactInput,
  cellTags: readonly string[] = []
): { econTags: string[]; factionTags: string[]; allTags: string[] } {
  const econTags: string[] = [];
  if (facts.famine(b)) {
    econTags.push("#Famine", "#ResourceScarcity");
  } else if (facts.grainShortage(b)) {
    econTags.push("#GrainShortage");
  } else if (facts.harvestAbundance(b)) {
    econTags.push("#HarvestAbundance");
  }

  if (facts.tradeBlockade(b) || facts.blockaded(cellTags)) {
    econTags.push("#TradeBlockade", "#MarketCollapse");
  } else if (facts.commercialBoom(b)) {
    econTags.push("#CommercialBoom");
  }

  const factionTags: string[] = [];
  if (facts.martialLaw(b)) factionTags.push("#MartialLaw");
  if (facts.undergroundUnrest(b)) factionTags.push("#UndergroundUnrest");
  if (facts.guildDominance(b)) factionTags.push("#GuildDominance");

  const allTags = Array.from(new Set([...econTags, ...factionTags]));
  return { econTags, factionTags, allTags };
}
