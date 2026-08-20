import type { AppState } from "../../state/store";

export interface TacticalBattleMap {
	elevation: number;
	biome: number;
	temperature: number;
	precipitation: number;
	waterPresence: boolean;
	threatLevel: number;
}

export function extractTacticalState(
	state: AppState,
	cellIndex: number,
): TacticalBattleMap | null {
	if (
		!state.heights ||
		!state.biomes ||
		!state.temp ||
		!state.prec ||
		!state.flux
	) {
		return null;
	}

	if (cellIndex < 0 || cellIndex >= state.cellsDesired) {
		return null;
	}

	const elevation = state.heights[cellIndex];
	const biome = state.biomes[cellIndex];
	const temperature = state.temp[cellIndex];
	const precipitation = state.prec[cellIndex];
	const flux = state.flux[cellIndex];

	const waterPresence = elevation < 20 || flux > 10;

	// Basic threat level calculation
	let threatLevel = 0;

	// Extreme temperatures are threatening
	if (temperature > 35 || temperature < -10) {
		threatLevel += 2;
	} else if (temperature > 30 || temperature < 0) {
		threatLevel += 1;
	}

	// Rough terrain (very high elevation)
	if (elevation > 80) {
		threatLevel += 2;
	} else if (elevation > 60) {
		threatLevel += 1;
	}

	// High precipitation + bad temp = extra threat
	if (precipitation > 80 && temperature < 5) {
		threatLevel += 1; // Blizzard conditions
	}

	// Cap threat level
	if (threatLevel > 10) threatLevel = 10;

	return {
		elevation,
		biome,
		temperature,
		precipitation,
		waterPresence,
		threatLevel,
	};
}
