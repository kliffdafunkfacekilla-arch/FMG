export interface Attributes {
  might: number;
  endurance: number;
  finesse: number;
  reflex: number;
  vitality: number;
  fortitude: number;
  knowledge: number;
  logic: number;
  awareness: number;
  intuition: number;
  charm: number;
  willpower: number;
}

export interface DerivedPools {
  health: number;     // Physical wellbeing: vitality + reflex + might
  stamina: number;    // Physical action resource: fortitude + finesse + endurance
  composure: number;  // Mind health: logic + intuition + charm
  focus: number;      // Mental action resource: knowledge + awareness + willpower
}

/**
 * Calculates derived stats based on the custom 12-attribute architecture.
 */
export function calculateDerivedPools(attr: Attributes): DerivedPools {
  return {
    health: attr.vitality + attr.reflex + attr.might,
    stamina: attr.fortitude + attr.finesse + attr.endurance,
    composure: attr.logic + attr.intuition + attr.charm,
    focus: attr.knowledge + attr.awareness + attr.willpower
  };
}

