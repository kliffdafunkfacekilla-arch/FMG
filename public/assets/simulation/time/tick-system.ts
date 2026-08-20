import type { CustomMonth, CustomMoon, CustomSeason } from "../../state/store";

export interface CalendarState {
	tick: number;
	day: number; // Day of the month (0-indexed)
	month: number; // Month index (0-indexed)
	year: number; // Current year (0-indexed)
	seasonOffset: number; // For climate temperature shifts (-1.0 to 1.0)
	weekday: string;
	seasonName: string;
	moonPhases: { moonName: string; phaseName: string; modifier: number; effect?: string }[];
	activeModifiers?: {
		tempMod: number;
		precMod: number;
		popMod: number;
		prodMod: number;
		diplomacyMod: number;
	};
}

export interface PlanetaryCycles {
	ticksPerDay: number;
	weekdays: string[];
	months: CustomMonth[];
	seasons: CustomSeason[];
	moons: CustomMoon[];
}

export class TickSystem {
	private cycles: PlanetaryCycles;
	private state: CalendarState;

	constructor(cycles?: Partial<PlanetaryCycles>, initialState?: CalendarState) {
		const defaultCycles: PlanetaryCycles = {
			ticksPerDay: 24,
			weekdays: [
				"Sunday",
				"Monday",
				"Tuesday",
				"Wednesday",
				"Thursday",
				"Friday",
				"Saturday",
			],
			months: [
				{ name: "Month 1", weekCount: 4 },
				{ name: "Month 2", weekCount: 4 },
				{ name: "Month 3", weekCount: 4 },
				{ name: "Month 4", weekCount: 4 },
			],
			seasons: [],
			moons: [],
		};

		// Support legacy options for unit tests: ticksPerDay, daysPerMonth, monthsPerYear
		const legacyDaysPerMonth = cycles
			? (cycles as any).daysPerMonth
			: undefined;
		const legacyMonthsPerYear = cycles
			? (cycles as any).monthsPerYear
			: undefined;
		const daysPerWeek =
			cycles?.weekdays?.length ?? defaultCycles.weekdays.length;

		const safeCycles: PlanetaryCycles = {
			ticksPerDay: cycles?.ticksPerDay ?? defaultCycles.ticksPerDay,
			weekdays: cycles?.weekdays ?? defaultCycles.weekdays,
			months:
				cycles?.months ??
				(legacyDaysPerMonth && legacyMonthsPerYear
					? Array.from({ length: legacyMonthsPerYear }, (_, i) => ({
							name: `Month ${i + 1}`,
							weekCount: legacyDaysPerMonth / daysPerWeek, // mathematically recovers exact legacy days per month when multiplied back
						}))
					: defaultCycles.months),
			seasons: cycles?.seasons ?? defaultCycles.seasons,
			moons: cycles?.moons ?? defaultCycles.moons,
		};

		this.cycles = safeCycles;
		this.state = initialState || {
			tick: 0,
			day: 0,
			month: 0,
			year: 0,
			seasonOffset: 0,
			weekday: safeCycles.weekdays[0] || "Day",
			seasonName: "None",
			moonPhases: [],
			activeModifiers: {
				tempMod: 0,
				precMod: 1.0,
				popMod: 1.0,
				prodMod: 1.0,
				diplomacyMod: 1.0,
			},
		};
	}

	public getState(): CalendarState {
		return { ...this.state };
	}

	public advance(ticks: number = 1): CalendarState {
		this.state.tick += ticks;

		const { ticksPerDay, weekdays, months, seasons, moons } = this.cycles;
		const daysPassed = Math.floor(this.state.tick / ticksPerDay);

		// 1. Weekday Calculation
		if (weekdays.length > 0) {
			this.state.weekday = weekdays[daysPassed % weekdays.length];
		} else {
			this.state.weekday = "Day";
		}

		// 2. Month, Day of Month, Year Calculation
		const daysPerWeek = weekdays.length || 7;
		const monthLengths = months.map((m) => m.weekCount * daysPerWeek);
		const daysPerYear = monthLengths.reduce((sum, len) => sum + len, 0) || 360;

		this.state.year = Math.floor(daysPassed / daysPerYear);
		const dayOfYear = daysPassed % daysPerYear;

		let accumulatedDays = 0;
		let monthIdx = 0;
		let dayOfM = 0;

		for (let i = 0; i < monthLengths.length; i++) {
			if (dayOfYear < accumulatedDays + monthLengths[i]) {
				monthIdx = i;
				dayOfM = dayOfYear - accumulatedDays;
				break;
			}
			accumulatedDays += monthLengths[i];
		}

		this.state.month = monthIdx;
		this.state.day = Math.floor(dayOfM); // Ensure integer days

		// 3. Season Check
		let seasonName = "None";
		let activeSeason: CustomSeason | null = null;

		for (const s of seasons) {
			const start = s.startMonth;
			const end = s.endMonth;
			if (start <= end) {
				if (monthIdx >= start && monthIdx <= end) {
					activeSeason = s;
					break;
				}
			} else {
				// Wraps around new year
				if (monthIdx >= start || monthIdx <= end) {
					activeSeason = s;
					break;
				}
			}
		}

		if (activeSeason) {
			seasonName = activeSeason.name;
		}
		this.state.seasonName = seasonName;

		// Orbit progress for base seasonOffset
		this.state.seasonOffset = Math.sin((dayOfYear / daysPerYear) * Math.PI * 2);

		// 4. Moon Phases Calculation
		this.state.moonPhases = moons.map((moon) => {
			const moonDay = daysPassed % moon.cycleLength;
			const totalRatios =
				moon.customPhases.reduce((sum, p) => sum + p.ratio, 0) || 1.0;
			const dayFactor = moon.cycleLength / totalRatios;

			let accDays = 0;
			let phaseName = "Unknown";
			let modifier = 1.0;
			let effect = "";

			for (const p of moon.customPhases) {
				const phaseDuration = p.ratio * dayFactor;
				if (moonDay < accDays + phaseDuration) {
					phaseName = p.name;
					modifier = p.modifier;
					effect = p.effect || "";
					break;
				}
				accDays += phaseDuration;
			}

			return {
				moonName: moon.name,
				phaseName,
				modifier,
				effect,
			};
		});

		// 5. Populate Active Modifiers
		const tempMod = activeSeason ? activeSeason.tempMod : 0;
		const precMod = activeSeason ? activeSeason.precMod : 1.0;
		const popMod = activeSeason ? activeSeason.popMod : 1.0;
		const moonModProduct = this.state.moonPhases.reduce(
			(prod, m) => prod * m.modifier,
			1.0,
		);
		const prodMod =
			(activeSeason ? activeSeason.prodMod : 1.0) * moonModProduct;
		const diplomacyMod = activeSeason ? activeSeason.prodMod : 1.0;

		this.state.activeModifiers = {
			tempMod,
			precMod,
			popMod,
			prodMod,
			diplomacyMod,
		};

		return this.getState();
	}
}
