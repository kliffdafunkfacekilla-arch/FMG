export interface CellEcologyState {
  eco_plants: number;
  eco_prey: number;
  eco_predators: number;
  eco_apex?: number;     // Apex predators
  eco_blight?: number;   // Plant disease
  eco_disease?: number;  // Prey disease
  eco_resources: number;
}

export function simulateCellEcology(
  state: CellEcologyState,
  drain: number = 0,
  month: number = 1
): CellEcologyState {
  let plants = state.eco_plants;
  let prey = state.eco_prey;
  let preds = state.eco_predators;
  let apex = state.eco_apex || 0;
  let blight = state.eco_blight || 0;
  let disease = state.eco_disease || 0;

  if (drain > 0) {
    plants = Math.max(0, plants - drain);
  }
  
  const isWinter = month >= 6 && month <= 8;
  const isSpring = month >= 1 && month <= 2;
  
  // Unified Lotka-Volterra Predator-Prey Coefficient Parameters
  let alpha = 0.15; // Plant natural regeneration rate
  let beta = 0.05;  // Herbivore consumption of plants coefficient
  let delta = 0.08; // Predator hunting conversion coefficient
  let gamma = 0.10; // Predator natural death/starvation rate
  let epsilon = 0.04; // Apex hunting conversion
  let zeta = 0.05; // Apex natural death
  
  if (isWinter) {
      // Hibernation: Animals sleep, flora dormant
      alpha *= 0.1;
      beta *= 0.2;
      delta *= 0.2;
      epsilon *= 0.2;
      gamma *= 0.5;
  } else if (isSpring) {
      // Breeding & Nesting: Massive bloom
      alpha *= 2.0;
      beta *= 1.5;
      delta *= 1.5;
  }
  
  // Apply Blights & Diseases before equations
  if (blight > 0) {
      alpha -= (blight * 0.01);
      plants -= (blight * 2);
      blight *= 0.8; // Decays over time
  }
  if (disease > 0) {
      prey -= (disease * 2);
      disease *= 0.8;
  }
  
  const maxCap = 200; // Increased capacity for deeper macro simulations

  const new_plants = Math.max(0, Math.min(maxCap, plants + (alpha * plants - beta * plants * Math.max(0, prey))));
  const new_prey = Math.max(0, Math.min(maxCap, prey + (beta * plants * prey - delta * prey * Math.max(0, preds) - epsilon * prey * apex * 0.5)));
  const new_preds = Math.max(0, Math.min(maxCap, preds + (delta * Math.max(0, prey) * preds - gamma * preds - epsilon * preds * apex)));
  const new_apex = Math.max(0, Math.min(maxCap, apex + (epsilon * preds * apex + epsilon * Math.max(0, prey) * apex * 0.5 - zeta * apex)));
  
  return {
    eco_plants: parseFloat(new_plants.toFixed(2)),
    eco_prey: parseFloat(new_prey.toFixed(2)),
    eco_predators: parseFloat(new_preds.toFixed(2)),
    eco_apex: parseFloat(new_apex.toFixed(2)),
    eco_blight: parseFloat((blight).toFixed(2)),
    eco_disease: parseFloat((disease).toFixed(2)),
    eco_resources: state.eco_resources || 100
  };
}

export function detectEcologyAnomaly(state: CellEcologyState): string {
    if (state.eco_prey > 85.0 && state.eco_predators < 10.0) {
        return 'BOOM_PREY_OVERABUNDANCE';
    } else if (state.eco_plants < 5.0 && state.eco_prey < 5.0) {
        return 'MIGRATION_TRIGGER_FAMINE';
    }
    return 'NORMAL';
}

// Global ecology tick (regen)
export function calculateGlobalEcologyRegen(plants: number, prey: number): { plants: number, prey: number } {
  return {
    plants: Math.min(100, plants + 5),
    prey: Math.min(100, prey + 5)
  };
}
