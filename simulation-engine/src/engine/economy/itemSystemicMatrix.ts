/**
 * CANONICAL ITEM & COMMODITY SYSTEMIC MATRIX
 * 
 * Source of Truth:
 *  - C:\Users\krazy\Desktop\Shatterlands\Canon\10_Dragonstone_Aether-tech_and_Economy.md
 *  - C:\Users\krazy\Desktop\Shatterlands\Canon\11_Airships_Sky_Travel_and_Aerotime.md
 *  - C:\Users\krazy\Desktop\Shatterlands\Canon\12_Factions_and_Organisations.md
 *  - C:\Users\krazy\Desktop\Shatterlands\Canon\14_Bestiary_and_Flora.md
 *  - simulation-engine\data\Holgaland.json
 * 
 * Governs the unscripted, deterministic systemic effects and trade-offs of authentic
 * goods, contraband, and relics on burg demographics, health, unrest, weather resistance,
 * chaos suppression, and diplomatic tension.
 */

export interface SystemicItemEffect {
  goodId: number;
  goodKey: string;
  name: string;
  category: "FOOD" | "FUEL" | "ENERGY" | "NARCOTIC" | "METAPHYSICAL" | "NAVIGATIONAL" | "STRUCTURAL" | "DIPLOMATIC" | "MILITARY" | "RELIC";
  
  // Deterministic deltas per 10 units consumed/stocked in a settlement per tick
  healthDelta?: number;
  unrestDelta?: number;
  crimeDelta?: number;
  chaosDampening?: number;      // Suppresses ambient chaos mutation
  chaosSpike?: number;          // Volatile chaos bleed risk
  winterResilience?: number;    // Mitigates cold/freezing damage
  fireResistance?: number;      // Mitigates foundry fire / war scorched damage
  diplomaticTensionDelta?: number; // Reduces/increases sovereign hostility
  airshipNavigationBonus?: number; // Enhances sky route safety
  
  // Trade-off description for GM arbitration and lore logs
  tradeOffSummary: string;
}

export const CANONICAL_ITEM_EFFECTS: Record<number, SystemicItemEffect> = {
  // Grain (ID 9): Foundational food staple
  9: {
    goodId: 9,
    goodKey: "grain",
    name: "Grain",
    category: "FOOD",
    healthDelta: 3,
    unrestDelta: -2,
    tradeOffSummary: "Sustains demographic growth and worker vitality; shortages cause famine mortality and riots."
  },

  // Coal (ID 34): High-temperature foundry fuel & winter heating
  34: {
    goodId: 34,
    goodKey: "coal",
    name: "Coal",
    category: "FUEL",
    winterResilience: 4,
    healthDelta: -1, // Minor smoke pollution in high densities
    tradeOffSummary: "Mitigates deep-winter freeze damage and powers foundries; dense burning causes minor municipal smog."
  },

  // Perfume (ID 71): Flower Valley luxury carrying ciphered diplomatic dossiers
  71: {
    goodId: 71,
    goodKey: "perfume",
    name: "Perfume",
    category: "DIPLOMATIC",
    unrestDelta: -1,
    diplomaticTensionDelta: -3,
    tradeOffSummary: "Soft power diplomacy: reduces sovereign war tension and extracts rumors; expensive luxury consumption."
  },

  // Grave-Berries (ID 86): Eastern Hounds barrow fruit
  86: {
    goodId: 86,
    goodKey: "grave_berries",
    name: "Grave-Berries",
    category: "FOOD",
    healthDelta: 4,
    unrestDelta: -1,
    tradeOffSummary: "Nutrient-dense endurance food for long campaigns; evokes haunting ancestral sensory flashbacks."
  },

  // Stone-Root Timber (ID 91): Fossil Ancestor-Tree roots mined by pangolins
  91: {
    goodId: 91,
    goodKey: "stone_root_timber",
    name: "Stone-Root Timber",
    category: "STRUCTURAL",
    fireResistance: 10,
    winterResilience: 5,
    tradeOffSummary: "Unburnable timber combining wood workability with stone density; eliminates foundry fire hazards."
  },

  // Jitter-Rigs (ID 104): Ursine 3-axis gimbal resonance navigation instruments
  104: {
    goodId: 104,
    goodKey: "jitter_rigs",
    name: "Jitter-Rigs",
    category: "NAVIGATIONAL",
    airshipNavigationBonus: 8,
    chaosDampening: 2,
    tradeOffSummary: "Navigational resonance gimbals that sing before a Chaos Flow shifts, granting early storm warning."
  },

  // Sheet Metal (ID 105): Caldera masterwork structural plating
  105: {
    goodId: 105,
    goodKey: "sheet_metal",
    name: "Sheet Metal",
    category: "MILITARY",
    unrestDelta: -1, // Increased security feeling
    tradeOffSummary: "Standardized fortress armor and airship hull plating, increasing wall durability against sieges."
  },

  // Aether-Clear (ID 108): Reliance chaos-resistant compound
  108: {
    goodId: 108,
    goodKey: "aether_clear",
    name: "Aether-Clear",
    category: "METAPHYSICAL",
    chaosDampening: 8,
    healthDelta: 2,
    tradeOffSummary: "Insulates living tissue and masonry against ambient chaos mutation, preventing eldritch blight."
  },

  // Viper-Haze (ID 114): Sump-Kin narcotic distributed by Silk-Sovereign Syndicate
  114: {
    goodId: 114,
    goodKey: "viper_haze",
    name: "Viper-Haze",
    category: "NARCOTIC",
    unrestDelta: -8, // Dramatic unrest suppression
    healthDelta: -4, // Gradual citizen vitality erosion
    crimeDelta: 3,   // Fosters underworld addiction
    tradeOffSummary: "Potent pain-numbing narcotic that placates riots and civil unrest, at the cost of public health."
  },

  // Dragonstone (ID 72): Raw primordial leyline shards
  72: {
    goodId: 72,
    goodKey: "dragonstone",
    name: "Dragonstone",
    category: "ENERGY",
    chaosSpike: 3,
    tradeOffSummary: "High-density aether-tech power source; unshielded handling causes localized chaos resonance spikes."
  }
};

/**
 * Evaluates the net systemic deltas on a burg based on its current stockpiled inventory.
 */
export function evaluateBurgInventoryEffects(complexInventory: Record<string, number>): {
  healthDelta: number;
  unrestDelta: number;
  crimeDelta: number;
  chaosDampening: number;
  winterResilience: number;
  appliedEffects: string[];
} {
  let healthDelta = 0;
  let unrestDelta = 0;
  let crimeDelta = 0;
  let chaosDampening = 0;
  let winterResilience = 0;
  const appliedEffects: string[] = [];

  for (const effect of Object.values(CANONICAL_ITEM_EFFECTS)) {
    const qty = complexInventory[effect.goodKey] || 0;
    if (qty >= 5) {
      const scale = Math.min(3, qty / 10); // Scaled multiplier capped at 3x
      if (effect.healthDelta) healthDelta += effect.healthDelta * scale;
      if (effect.unrestDelta) unrestDelta += effect.unrestDelta * scale;
      if (effect.crimeDelta) crimeDelta += effect.crimeDelta * scale;
      if (effect.chaosDampening) chaosDampening += effect.chaosDampening * scale;
      if (effect.winterResilience) winterResilience += effect.winterResilience * scale;

      appliedEffects.push(`${effect.name} (${Math.round(qty)} units): ${effect.tradeOffSummary}`);
    }
  }

  return {
    healthDelta: Math.round(healthDelta),
    unrestDelta: Math.round(unrestDelta),
    crimeDelta: Math.round(crimeDelta),
    chaosDampening: Math.round(chaosDampening),
    winterResilience: Math.round(winterResilience),
    appliedEffects
  };
}
