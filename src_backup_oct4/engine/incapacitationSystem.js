"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleZeroPoolTrigger = handleZeroPoolTrigger;
exports.processTurnIncapacitation = processTurnIncapacitation;
function handleZeroPoolTrigger(characterName, poolType) {
    return {
        characterName,
        poolType,
        turnsRemaining: 10,
        isConscious: false,
        isHelpless: true,
        stabilized: false
    };
}
function processTurnIncapacitation(state, allyHelpCheckSuccess, currentPool, maxPool) {
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
//# sourceMappingURL=incapacitationSystem.js.map