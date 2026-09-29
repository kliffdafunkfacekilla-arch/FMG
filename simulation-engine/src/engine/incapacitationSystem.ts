export interface IncapacitatedState {
  characterName: string;
  poolType: 'HEALTH' | 'COMPOSURE';
  turnsRemaining: number; // Starts at 10
  isConscious: boolean;
  isHelpless: boolean; // True if below 25% threshold post-recovery
  stabilized: boolean;
}

export function handleZeroPoolTrigger(characterName: string, poolType: 'HEALTH' | 'COMPOSURE'): IncapacitatedState {
  return {
    characterName,
    poolType,
    turnsRemaining: 10,
    isConscious: false,
    isHelpless: true,
    stabilized: false
  };
}

export function processTurnIncapacitation(
  state: IncapacitatedState,
  allyHelpCheckSuccess: boolean,
  currentPool: number,
  maxPool: number
): { message: string; updatedState: IncapacitatedState } {
  if (state.stabilized) {
    // Check if recovered above 25% threshold
    const threshold = maxPool * 0.25;
    const isHelpless = currentPool < threshold;
    return {
      message: `${state.characterName} is stabilized. ${isHelpless ? 'Still helpless (below 25% pool).' : 'Fully functional.'}`,
      updatedState: { ...state, isHelpless }
    };
  }

  if (allyHelpCheckSuccess) {
    return {
      message: `${state.characterName} responds to ally assistance! Regains consciousness, moves at half speed with help, but remains helpless until reaching 25% pool.`,
      updatedState: { ...state, isConscious: true, stabilized: true, isHelpless: true }
    };
  }

  state.turnsRemaining -= 1;
  if (state.turnsRemaining <= 0) {
    return {
      message: `${state.characterName} failed to stabilize within 10 turns. Permanent casualty / Null burnout occurred.`,
      updatedState: state
    };
  }

  return {
    message: `${state.characterName} is incapacitated. ${state.turnsRemaining} turns remaining before fatal collapse.`,
    updatedState: state
  };
}

