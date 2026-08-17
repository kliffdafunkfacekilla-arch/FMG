import { type Grid, Pack } from "../core/types";
import type { CalendarState } from "../simulation/time/tick-system";

export interface CustomMonth {
	name: string;
	weekCount: number;
}

export interface CustomSeason {
	name: string;
	startMonth: number; // 0-indexed
	endMonth: number; // 0-indexed
	tempMod: number; // e.g. -10 for cold, +10 for hot
	precMod: number; // e.g. 0.5 for dry, 1.5 for wet
	popMod: number; // population growth modifier e.g. 0.9, 1.1
	prodMod: number; // production modifier e.g. 0.8, 1.2
}

export interface CustomMoonPhase {
	name: string;
	ratio: number; // relative duration weight of this phase
	modifier: number; // modifier assigned to this phase
	effect?: string; // custom simulation/magical effect attached to this phase
}

export interface CustomHoliday {
	name: string;
	month: number; // 0-indexed month of year
	day: number; // 1-indexed day of month
	type: "holiday" | "darkday"; // holiday is festive, darkday is unholy/negative
	effect: "happiness" | "population" | "safety" | "health";
	modifier: number; // multiplier or flat shift (e.g. +5% or +0.05, etc.)
}

export interface CustomMoon {
	name: string;
	cycleLength: number; // in days
	customPhases: CustomMoonPhase[];
}

export interface NestedUnit {
	id: string;
	name: string;
	x: number;
	y: number;
	type: string;
	progress: number;
	speedX: number;
	speedY: number;
}

export interface TradeCaravan {
	id: string;
	routeId: string; // matches route id in routes[]
	goodId: number;
	stateId: number;
	progress: number; // 0..1 along route path
	speed: number; // progress units per tick (e.g. 0.02)
}

export interface NestedLocalZone {
	id: number;
	name: string;
	centerX: number;
	centerY: number;
	radius: number;
	units: NestedUnit[];
}

export interface NestedRegion {
	id: number;
	name: string;
	centerX: number;
	centerY: number;
	radius: number;
	localZones: NestedLocalZone[];
	units: NestedUnit[];
}

export interface NestedLog {
	time: string;
	msg: string;
	type: "info" | "military" | "caravan" | "magic" | "local" | "beast";
}

export function generateDefaultRegions(): NestedRegion[] {
	const regionNames = [
		"Dragon's Teeth Peaks",
		"Whispering Sylvanwood",
		"Scorched Wastes",
		"Golden Valley",
		"Emerald Reach",
		"Shimmering Sound",
		"Frostfell Marsh",
		"Serpent's Delta",
		"Shadowed Fen",
		"Sapphire Coast",
	];

	const localPrefixes = [
		"Old",
		"New",
		"Mist",
		"Shadow",
		"Green",
		"Sun",
		"Gale",
		"Glen",
		"River",
		"Deep",
	];
	const localSuffixes = [
		"Cove",
		"Vale",
		"Gully",
		"Hollow",
		"Ridge",
		"Grove",
		"Crossing",
		"Meadow",
		"Pass",
		"Chasm",
	];

	const regions: NestedRegion[] = [];
	for (let r = 0; r < 10; r++) {
		const rCol = r % 5;
		const rRow = Math.floor(r / 5);
		const centerX = rCol * 200 + 100;
		const centerY = rRow * 300 + 150;

		const localZones: NestedLocalZone[] = [];
		for (let l = 0; l < 10; l++) {
			const lCol = l % 5;
			const lRow = Math.floor(l / 5);
			const offsetX = (lCol - 2) * 60;
			const offsetY = (lRow - 0.5) * 150;
			const lx = centerX + offsetX;
			const ly = centerY + offsetY;
			const name = `${localPrefixes[l % 10]} ${localSuffixes[(r + l) % 10]}`;

			const units: NestedUnit[] = [
				{
					id: `unit-local-${r}-${l}-1`,
					name: `${name} Ranger Patrol`,
					x: lx,
					y: ly,
					type: "guard",
					progress: 0,
					speedX: (Math.random() - 0.5) * 3,
					speedY: (Math.random() - 0.5) * 3,
				},
				{
					id: `unit-local-${r}-${l}-2`,
					name: "Elusive Beast",
					x: lx + 5,
					y: ly + 5,
					type: "wildlife",
					progress: 0,
					speedX: (Math.random() - 0.5) * 5,
					speedY: (Math.random() - 0.5) * 5,
				},
			];

			localZones.push({
				id: l,
				name,
				centerX: lx,
				centerY: ly,
				radius: 65,
				units,
			});
		}

		const units: NestedUnit[] = [
			{
				id: `unit-region-${r}-1`,
				name: `Regimental Patrol of ${regionNames[r]}`,
				x: centerX,
				y: centerY,
				type: "patrol",
				progress: 0,
				speedX: (Math.random() - 0.5) * 6,
				speedY: (Math.random() - 0.5) * 6,
			},
			{
				id: `unit-region-${r}-2`,
				name: `Inter-city Trade Caravan`,
				x: centerX - 15,
				y: centerY + 15,
				type: "caravan",
				progress: 0,
				speedX: (Math.random() - 0.5) * 4,
				speedY: (Math.random() - 0.5) * 4,
			},
		];

		regions.push({
			id: r,
			name: regionNames[r],
			centerX,
			centerY,
			radius: 165,
			localZones,
			units,
		});
	}

	return regions;
}

export interface AppState {
	width: number;
	height: number;
	seed: string;
	cellsDesired: number;
	tick: number;
	calendar: CalendarState | null;
	grid: Grid | null;
	heights: Uint8Array | null;
	temp: Float32Array | null;
	prec: Uint8Array | null;
	flowDirections: Int32Array | null;
	flux: Float32Array | null;
	rivers: Uint16Array | null;
	biomes: Uint8Array | null;

	// Custom Calendar settings
	weekdays: string[];
	months: CustomMonth[];
	seasons: CustomSeason[];
	moons: CustomMoon[];
	holidays: CustomHoliday[];

	// Nested LOD & Simulation State
	regions: NestedRegion[] | null;
	activeRegionId: number | null;
	activeLocalId: number | null;
	globalLogs: NestedLog[];
	regionalLogs: Record<number, NestedLog[]>;
	localLogs: Record<string, NestedLog[]>;

	// Ecology & Stressors
	plants: Float32Array | null;
	herbivores: Float32Array | null;
	predators: Float32Array | null;
	farmingCells: Uint8Array | null;
	loggingCells: Uint8Array | null;

	// Magic System
	magicTypes: MagicTypeConfig[];
	magicNodes: number[] | null;
	magicLeyLines: [number, number][] | null;
	magicFlux: Float32Array | null;
	magePopulation: Uint32Array | null;

	// Marine Physical Simulation
	oceanCurrents: Float32Array | null; // packed x,y wind-driven current vectors
	oceanNutrients: Float32Array | null; // nutrient level mapping
	upwellingFlux: Float32Array | null; // reverse-flux ocean current upwelling

	// Navigation / View Transform
	zoom: number;
	offsetX: number;
	offsetY: number;
	zoomTier: "global" | "regional" | "local";
	parentStates: AppState[];
	focusBounds: { minX: number; minY: number; maxX: number; maxY: number } | null;
	preyRate: number;
	predRate: number;
	magicSens: number;

	// Layer Overlay Visibility flags
	showGrid: boolean;
	showRivers: boolean;
	showRoutes: boolean;
	showBurgs: boolean;
	showMilitary: boolean;
	showMarkers: boolean;
	showLabels: boolean;
	showZones: boolean;

	showHeightmap: boolean;
	showBiomes: boolean;
	showCultures: boolean;
	showStates: boolean;
	showProvinces: boolean;
	showReligions: boolean;
	showGoods: boolean;
	showTemp: boolean;
	showPrec: boolean;

	// Border & Fill Mode
	showBorders: boolean;
	borderType: "political" | "province" | "culture" | "all";
	/** Per thematic layer: "fill" draws colored cells, "border-only" draws only outlines, "both" draws both */
	layerFillModes: Record<string, "fill" | "border-only" | "both">;

	// Visual Detail Layers
	showReliefIcons: boolean; // procedural terrain sprites at zoom >= 3
	showEmblems: boolean;     // state heraldry shields over capitals
	showCoastlines: boolean;  // fractal concentric coastline rings at zoom >= 2.5
	showScalebar: boolean;    // scale bar overlay
	showLegend: boolean;      // color legend overlay for active thematic layer
	worldSizeKm: number;      // world diameter in km for scalebar calculation

	// Trade Caravans
	tradeCaravans: TradeCaravan[];

	// Civilization & Political Data
	states: any[] | null;
	burgs: any[] | null;
	cultures: any[] | null;
	religions: any[] | null;
	relations: any[] | null;
	provinces: any[] | null;
	military: any[] | null;
	fringeGroups: any[] | null;
	markets?: any[] | null;
	cellReligions?: Uint8Array | null;
	militaryUnitTypes?: { type: string; speed: number; combatValue: number }[];

	// Z-index Order & Styling
	layerOrder: string[];
	layerStyles: Record<string, { opacity: number; color: string; size: number }>;
}

export interface MagicVectorWeights {
	production: number; // production modifier
	military: number; // military modifier
	ecology: number; // ecology (plant growth) modifier
	growth: number; // population growth modifier
	taxation: number; // taxation modifier
}

export interface MagicTypeConfig {
	name: string;
	wieldability: "innate" | "learned" | "divine";
	rarity: number; // base chance of mages
	cost: number; // mana cost
	scope?: "zone" | "ley_line" | "global";
	costType?: string; // "wealth" | "life" | "ecology" or a Good name
	religionId?: number; // chosen religion for divine
	effect?:
		| "strength"
		| "speed"
		| "wealth"
		| "population"
		| "happiness"
		| "defense"
		| "diplomacy";
	dangerFactor?: number; // opposite effect based on crime
	volatility: {
		accidents: number; // probability of local accidents
		crime: number;
		instability: number;
	};
	weights: MagicVectorWeights;
}

type StateListener = (state: AppState) => void;

class StateStore {
	private state: AppState;
	private listeners: Set<StateListener> = new Set();

	constructor() {
		this.state = {
			width: 1000,
			height: 600,
			seed: "rebuild-seed",
			cellsDesired: 10000,
			tick: 0,
			calendar: null,
			grid: null,
			heights: null,
			temp: null,
			prec: null,
			flowDirections: null,
			flux: null,
			rivers: null,
			biomes: null,

			plants: null,
			herbivores: null,
			predators: null,
			farmingCells: null,
			loggingCells: null,

			magicNodes: null,
			magicLeyLines: null,
			magicFlux: null,
			magePopulation: null,

			oceanCurrents: null,
			oceanNutrients: null,
			upwellingFlux: null,

			zoom: 1.0,
			offsetX: 0,
			offsetY: 0,
			zoomTier: "global",
			parentStates: [],
			focusBounds: null,
			preyRate: 100,
			predRate: 100,
			magicSens: 1.0,

			showGrid: false,
			showRivers: true,
			showRoutes: true,
			showBurgs: true,
			showMilitary: true,
			showMarkers: true,
			showLabels: true,
			showZones: true,

			showHeightmap: true,
			showBiomes: false,
			showCultures: false,
			showStates: true,
			showProvinces: false,
			showReligions: false,
			showGoods: false,
			showTemp: false,
			showPrec: false,

			showBorders: true,
			borderType: "political",
			layerFillModes: {},

			showReliefIcons: true,
			showEmblems: true,
			showCoastlines: true,
			showScalebar: true,
			showLegend: false,
			worldSizeKm: 10000,

			tradeCaravans: [],

			states: [],
			burgs: [],
			cultures: [],
			religions: [],
			relations: [],
			provinces: [],
			military: [],
			fringeGroups: [],
			markets: [],
			cellReligions: null,
			militaryUnitTypes: [
				{ type: "infantry", speed: 1.0, combatValue: 10 },
				{ type: "cavalry", speed: 1.8, combatValue: 15 },
				{ type: "navy", speed: 2.2, combatValue: 20 },
			],

			layerOrder: [
				"heightmap",
				"biomes",
				"temp",
				"prec",
				"cultures",
				"states",
				"provinces",
				"religions",
				"goods",
				"coastlines",
				"borders",
				"grid",
				"rivers",
				"zones",
				"routes",
				"caravans",
				"relief",
				"markers",
				"burgs",
				"emblems",
				"military",
				"labels",
				"scalebar",
			],
			layerStyles: {
				heightmap: { opacity: 1.0, color: "rgba(0, 0, 0, 0.15)", size: 1.0 },
				biomes: { opacity: 1.0, color: "rgba(0, 0, 0, 0.15)", size: 1.0 },
				cultures: { opacity: 0.8, color: "rgba(0, 0, 0, 0.15)", size: 1.0 },
				states: { opacity: 0.85, color: "rgba(0, 0, 0, 0.25)", size: 1.0 },
				provinces: {
					opacity: 0.75,
					color: "rgba(255, 255, 255, 0.25)",
					size: 1.0,
				},
				religions: { opacity: 0.8, color: "rgba(0, 0, 0, 0.15)", size: 1.0 },
				goods: { opacity: 0.85, color: "rgba(0, 0, 0, 0.15)", size: 1.0 },
				temp: { opacity: 1.0, color: "rgba(0, 0, 0, 0.15)", size: 1.0 },
				prec: { opacity: 1.0, color: "rgba(0, 0, 0, 0.15)", size: 1.0 },
				grid: { opacity: 0.5, color: "rgba(0, 0, 0, 0.15)", size: 0.5 },
				rivers: { opacity: 0.9, color: "#466eab", size: 1.0 },
				routes: { opacity: 0.85, color: "rgba(141, 110, 99, 0.85)", size: 1.8 },
				burgs: { opacity: 1.0, color: "#ffffff", size: 4.0 },
				military: { opacity: 1.0, color: "#ffffff", size: 1.5 },
				markers: { opacity: 1.0, color: "#fbbf24", size: 1.0 },
				labels: { opacity: 1.0, color: "#ffffff", size: 11.0 },
				zones: { opacity: 0.4, color: "rgba(0, 0, 0, 0.1)", size: 1.0 },
				borders: { opacity: 1.0, color: "#1a1a1a", size: 1.5 },
				coastlines: { opacity: 0.6, color: "#1a4a6e", size: 1.0 },
				relief: { opacity: 0.85, color: "#5a7a3a", size: 1.0 },
				emblems: { opacity: 0.9, color: "#ffffff", size: 1.0 },
				caravans: { opacity: 1.0, color: "#f59e0b", size: 1.0 },
				scalebar: { opacity: 0.85, color: "#ffffff", size: 1.0 },
			},

			magicTypes: [
				{
					name: "Pyromancy",
					wieldability: "innate",
					rarity: 0.005,
					cost: 25,
					scope: "global",
					costType: "life",
					effect: "strength",
					dangerFactor: 0.25,
					volatility: { accidents: 0.3, crime: 0.05, instability: 0.1 },
					weights: {
						production: 1.25,
						military: 1.35,
						ecology: 0.7,
						growth: 0.95,
						taxation: 1.05,
					},
				},
				{
					name: "Restoration",
					wieldability: "learned",
					rarity: 0.02,
					cost: 15,
					scope: "zone",
					costType: "ecology",
					effect: "population",
					dangerFactor: 0.1,
					volatility: { accidents: 0.02, crime: 0.01, instability: 0.01 },
					weights: {
						production: 1.05,
						military: 0.9,
						ecology: 1.3,
						growth: 1.25,
						taxation: 1.0,
					},
				},
				{
					name: "Divination",
					wieldability: "divine",
					rarity: 0.01,
					cost: 20,
					scope: "ley_line",
					costType: "wealth",
					effect: "wealth",
					dangerFactor: 0.15,
					volatility: { accidents: 0.05, crime: 0.15, instability: 0.05 },
					weights: {
						production: 1.15,
						military: 1.0,
						ecology: 1.0,
						growth: 1.05,
						taxation: 1.25,
					},
				},
			],

			// Defaults
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
				{ name: "January", weekCount: 4 },
				{ name: "February", weekCount: 4 },
				{ name: "March", weekCount: 4 },
				{ name: "April", weekCount: 4 },
				{ name: "May", weekCount: 4 },
				{ name: "June", weekCount: 4 },
				{ name: "July", weekCount: 4 },
				{ name: "August", weekCount: 4 },
				{ name: "September", weekCount: 4 },
				{ name: "October", weekCount: 4 },
				{ name: "November", weekCount: 4 },
				{ name: "December", weekCount: 4 },
			],
			seasons: [
				{
					name: "Winter",
					startMonth: 11,
					endMonth: 1,
					tempMod: -15,
					precMod: 0.8,
					popMod: 0.85,
					prodMod: 0.9,
				},
				{
					name: "Spring",
					startMonth: 2,
					endMonth: 4,
					tempMod: 5,
					precMod: 1.2,
					popMod: 1.1,
					prodMod: 1.0,
				},
				{
					name: "Summer",
					startMonth: 5,
					endMonth: 7,
					tempMod: 15,
					precMod: 0.9,
					popMod: 1.15,
					prodMod: 1.15,
				},
				{
					name: "Autumn",
					startMonth: 8,
					endMonth: 10,
					tempMod: -5,
					precMod: 1.1,
					popMod: 1.0,
					prodMod: 0.95,
				},
			],
			moons: [
				{
					name: "Selene",
					cycleLength: 30, // 30 days
					customPhases: [
						{ name: "New Moon", ratio: 1.0, modifier: 0.9 },
						{ name: "Waxing", ratio: 1.0, modifier: 1.0 },
						{ name: "Full Moon", ratio: 1.0, modifier: 1.2 },
						{ name: "Waning", ratio: 1.0, modifier: 1.0 },
					],
				},
			],
			holidays: [
				{
					name: "Festival of Light",
					month: 5, // June (0-indexed 5)
					day: 21,
					type: "holiday",
					effect: "happiness",
					modifier: 15, // +15% happiness
				},
				{
					name: "Reaping Eve",
					month: 9, // October (0-indexed 9)
					day: 31,
					type: "darkday",
					effect: "safety",
					modifier: -10, // -10% safety / security
				},
				{
					name: "Founder's Day",
					month: 3, // April (0-indexed 3)
					day: 15,
					type: "holiday",
					effect: "population",
					modifier: 5, // +5% population growth (migration / births)
				},
			],
			regions: generateDefaultRegions(),
			activeRegionId: null,
			activeLocalId: null,
			globalLogs: [
				{
					time: "Day 1, Year 1",
					msg: "Fantasy Map Generator nested LOD engine initialized.",
					type: "info",
				},
			],
			regionalLogs: {},
			localLogs: {},
		};
	}

	getState(): AppState {
		return { ...this.state };
	}

	subscribe(listener: StateListener): () => void {
		this.listeners.add(listener);
		listener(this.getState());
		return () => {
			this.listeners.delete(listener);
		};
	}

	private notify() {
		const currentState = this.getState();
		for (const listener of this.listeners) {
			listener(currentState);
		}
	}

	updateState(updatedFields: Partial<AppState>) {
		this.state = {
			...this.state,
			...updatedFields,
		};
		this.notify();
	}
}

export const store = new StateStore();
export default store;
