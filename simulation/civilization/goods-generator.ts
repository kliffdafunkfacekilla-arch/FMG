import { createPRNG } from "../../core/random";
import type { CultureType } from "./culture-generator";

const TIME = false;
const seed = "map-seed";
const pack = {
	goods: [] as any[],
	cells: {
		i: [] as number[],
		good: new Uint16Array(0),
		biome: new Uint8Array(0),
		h: new Uint8Array(0),
		t: new Int8Array(0),
		g: new Uint32Array(0),
		f: new Uint32Array(0),
		r: new Uint16Array(0),
		fl: new Float32Array(0),
	},
	features: [] as any[],
};
const grid = {
	cells: {
		temp: new Float32Array(0),
	},
};
const biomesData = {
<<<<<<< HEAD
	habitability: [
		0, 0, 0, 4, 10, 22, 25, 50, 100, 80, 50, 12, 0, 0, 80, 100, 30, 10, 5,
	],
=======
	habitability: [0, 0, 0, 4, 10, 22, 25, 50, 100, 80, 50, 12, 0, 0],
>>>>>>> 244c3607df6c9b04fdb870383198bfe25fbc42ee
};

type PackedGraph = {
	cells: typeof pack.cells;
	goods: any[];
};

function shuffler(rng: () => number) {
	return <T>(arr: T[]): T[] => {
		for (let i = arr.length - 1; i > 0; i--) {
			const j = Math.floor(rng() * (i + 1));
			[arr[i], arr[j]] = [arr[j], arr[i]];
		}
		return arr;
	};
}

function color(colorHex: string) {
	return {
		darker: (k: number) => ({
			hex: () => colorHex,
		}),
	};
}

let currentRNG = Math.random;

export interface Good {
	i: number;

	// generation
	chance?: number;
	distribution?: string;
	biomeOutput?: Partial<Record<number, number>>;
	recipes?: Record<number, number>[];

	// multipliers; absent or 1 = no effect; 0 = fully suppressed
	multipliers?: {
		cultureType?: Partial<Record<CultureType, number>>;
		culture?: Partial<Record<number, number>>;
		state?: Partial<Record<number, number>>;
		religion?: Partial<Record<number, number>>;
		biome?: Partial<Record<number, number>>;
		zone?: Partial<Record<number, number>>; // keyed by zone.i; rare, resolved via cell membership
	};

	// effects
	demandCoverage?: Partial<Record<DemandCategory, number>>;

	// lore
	name: string;
	tags: string[];
	value: number;
	unit: string;
	type: "raw" | "manufactured";

	// ui
	icon: string;
	color: string;
}

export const DEMAND_PRIORITY = [
	"food",
	"utilities",
	"construction",
	"military",
	"luxury",
] as const;
export type DemandCategory = (typeof DEMAND_PRIORITY)[number];
export const DEMAND_TARGET_FACTORS: Record<DemandCategory, number> = {
	food: 0.2,
	utilities: 0.15,
	construction: 0.1,
	military: 0.08,
	luxury: 0.07,
};
export const DEMAND_CATEGORY_ICONS: Record<DemandCategory, string> = {
	food: "🍖",
	utilities: "🛠️",
	construction: "🧱",
	military: "🛡️",
	luxury: "💎",
};

export function getDemandTargets(population: number): number[] {
	return DEMAND_PRIORITY.map(
		(category) => population * DEMAND_TARGET_FACTORS[category],
	);
}

type GoodData = Omit<Good, "i"> & { recipes?: Record<string, number>[] };
const GOODS_DATA: GoodData[] = [
	{
		name: "Wood",
		tags: ["construction", "fuel", "raw"],
		type: "raw",
		icon: "good-wood",
		color: "#966F33",
		value: 1,
		chance: 4,
<<<<<<< HEAD
		distribution: "land() && biome(5, 6, 7, 8, 9)",
		unit: "pile",
		demandCoverage: { construction: 1, utilities: 1 },
		multipliers: { cultureType: { Hunting: 1.5 } },
		biomeOutput: {
			5: 0.1,
			6: 0.1,
			7: 0.1,
			8: 0.1,
			9: 0.1,
			12: 0.05,
		},
=======
		distribution: "biome(5, 6, 7, 8, 9)",
		unit: "pile",
		demandCoverage: { construction: 1, utilities: 1 },
		multipliers: { cultureType: { Hunting: 1.5 } },
		biomeOutput: { 5: 0.1, 6: 0.1, 7: 0.1, 8: 0.1, 9: 0.1, 12: 0.05 },
>>>>>>> 244c3607df6c9b04fdb870383198bfe25fbc42ee
	},
	{
		name: "Stone",
		tags: ["construction", "raw"],
		type: "raw",
		icon: "good-stone",
		color: "#979EA2",
		value: 2,
		chance: 4,
		distribution:
<<<<<<< HEAD
			"land() && (minHeight(40) || (minHeight(20) && elevation())) && biome(1, 2, 3, 4)",
=======
			"(minHeight(40) || (minHeight(20) && elevation())) && biome(1, 2, 3, 4)",
>>>>>>> 244c3607df6c9b04fdb870383198bfe25fbc42ee
		unit: "pallet",
		demandCoverage: { construction: 1 },
		multipliers: { cultureType: { Hunting: 0.6, Nomadic: 0.6 } },
		biomeOutput: { 1: 0.05, 2: 0.05 },
	},
	{
		name: "Marble",
		tags: ["construction", "luxury", "raw"],
		type: "raw",
		icon: "good-marble",
		color: "#d6d0bf",
		value: 6,
		chance: 1,
<<<<<<< HEAD
		distribution: "land() && (minHeight(60) || (minHeight(30) && elevation()))",
=======
		distribution: "minHeight(60) || (minHeight(30) && elevation())",
>>>>>>> 244c3607df6c9b04fdb870383198bfe25fbc42ee
		unit: "pallet",
		demandCoverage: { construction: 0.5, luxury: 0.5 },
		multipliers: { cultureType: { Highland: 1.4 } },
	},
	{
		name: "Iron",
		tags: ["ore", "military", "raw"],
		type: "raw",
		icon: "good-iron",
		color: "#5D686E",
		value: 3,
		chance: 5,
		distribution:
<<<<<<< HEAD
			"land() && (minHeight(60) || (biome(12) && nth(7)) || (minHeight(20) && nth(10)))",
=======
			"minHeight(60) || (biome(12) && nth(7)) || (minHeight(20) && nth(10))",
>>>>>>> 244c3607df6c9b04fdb870383198bfe25fbc42ee
		unit: "wagon",
		multipliers: { cultureType: { Highland: 1.4 } },
		biomeOutput: { 12: 0.1 },
	},
	{
		name: "Copper",
		tags: ["ore", "raw"],
		type: "raw",
		icon: "good-copper",
		color: "#b87333",
		value: 4,
		chance: 2,
<<<<<<< HEAD
		distribution:
			"land() && (minHeight(60) || (minHeight(30) && elevation()))",
=======
		distribution: "minHeight(60) || (minHeight(30) && elevation())",
>>>>>>> 244c3607df6c9b04fdb870383198bfe25fbc42ee
		unit: "wagon",
		multipliers: { cultureType: { Highland: 1.4 } },
	},
	{
		name: "Tin",
		tags: ["ore", "raw"],
		type: "raw",
		icon: "good-tin",
		color: "#454343",
		value: 4,
		chance: 2,
<<<<<<< HEAD
		distribution:
			"land() && (minHeight(60) || (minHeight(30) && elevation()))",
=======
		distribution: "minHeight(60) || (minHeight(30) && elevation())",
>>>>>>> 244c3607df6c9b04fdb870383198bfe25fbc42ee
		unit: "wagon",
		multipliers: { cultureType: { Highland: 1.4 } },
	},
	{
		name: "Silver",
		tags: ["ore", "luxury", "raw"],
		type: "raw",
		icon: "good-silver",
		color: "#C0C0C0",
		value: 8,
		chance: 2,
<<<<<<< HEAD
		distribution:
			"land() && (minHeight(60) || (minHeight(30) && elevation()))",
=======
		distribution: "minHeight(60) || (minHeight(30) && elevation())",
>>>>>>> 244c3607df6c9b04fdb870383198bfe25fbc42ee
		unit: "bullion",
		multipliers: { cultureType: { Hunting: 0.5, Highland: 1.4, Nomadic: 0.5 } },
	},
	{
		name: "Gold",
		tags: ["ore", "luxury", "raw"],
		type: "raw",
		icon: "good-gold",
		color: "#ffd700",
		value: 15,
		chance: 2,
<<<<<<< HEAD
		distribution: "land() && river() && minHeight(40)",
=======
		distribution: "river() && minHeight(40)",
>>>>>>> 244c3607df6c9b04fdb870383198bfe25fbc42ee
		unit: "bullion",
		multipliers: { cultureType: { Highland: 1.4, Nomadic: 0.5 } },
	},
	{
		name: "Grain",
		tags: ["food", "raw"],
		type: "raw",
		icon: "good-grain",
		color: "#F5DEB3",
		value: 1,
		chance: 4,
<<<<<<< HEAD
		distribution: "land() && minHabitability(20) && habitability()",
=======
		distribution: "minHabitability(20) && habitability()",
>>>>>>> 244c3607df6c9b04fdb870383198bfe25fbc42ee
		unit: "wain",
		demandCoverage: { food: 1 },
		multipliers: { cultureType: { River: 1.2, Lake: 1.2, Nomadic: 0.5 } },
		biomeOutput: { 5: 0.1, 6: 0.1, 7: 0.1, 8: 0.1 },
	},
	{
		name: "Cattle",
		tags: ["food", "raw"],
		type: "raw",
		icon: "good-cattle",
		color: "#56b000",
		value: 2,
		chance: 4,
		distribution:
<<<<<<< HEAD
			"land() && ((biome(3, 4) && !elevation()) || (biome(6) && random(70)) || (biome(5) && nth(5)))",
=======
			"(biome(3, 4) && !elevation()) || (biome(6) && random(70)) || (biome(5) && nth(5))",
>>>>>>> 244c3607df6c9b04fdb870383198bfe25fbc42ee
		unit: "head",
		demandCoverage: { food: 1 },
		multipliers: { cultureType: { Nomadic: 2 } },
		biomeOutput: { 3: 0.1, 4: 0.1 },
	},
	{
		name: "Fish",
		tags: ["food", "aquatic", "raw"],
		type: "raw",
		icon: "good-fish",
		color: "#7fcdff",
		value: 1,
		chance: 4,
		distribution:
			'shore(-1) && (type("ocean", "freshwater", "salt") || (river() && shore(1, 2)))',
		unit: "wain",
		demandCoverage: { food: 1 },
		multipliers: {
			cultureType: { River: 1.4, Lake: 1.4, Naval: 1.4, Nomadic: 0.2 },
		},
	},
	{
		name: "Game",
		tags: ["food", "raw"],
		type: "raw",
		icon: "good-game",
		color: "#c38a8a",
		value: 2,
		chance: 3,
<<<<<<< HEAD
		distribution: "land() && biome(5, 6, 7, 8, 9)",
=======
		distribution: "biome(5, 6, 7, 8, 9)",
>>>>>>> 244c3607df6c9b04fdb870383198bfe25fbc42ee
		unit: "wain",
		demandCoverage: { food: 1 },
		multipliers: { cultureType: { Naval: 0.6, Nomadic: 1.4, Hunting: 2 } },
		biomeOutput: {
			3: 0.01,
			4: 0.01,
			5: 0.02,
			6: 0.02,
			7: 0.02,
			8: 0.02,
			9: 0.05,
		},
	},
	{
		name: "Wine",
		tags: ["food", "luxury", "raw"],
		type: "raw",
		icon: "good-wine",
		color: "#963e48",
		value: 2,
		chance: 3,
<<<<<<< HEAD
		distribution: "land() && (biome(6) || (biome(4) && random(50) && river()))",
=======
		distribution: "biome(6) || (biome(4) && random(50) && river())",
>>>>>>> 244c3607df6c9b04fdb870383198bfe25fbc42ee
		unit: "barrel",
		demandCoverage: { food: 0.5, luxury: 0.5 },
		multipliers: { cultureType: { Highland: 1.2, Nomadic: 0.5 } },
		biomeOutput: { 6: 0.1 },
	},
	{
		name: "Olives",
		tags: ["food", "raw"],
		type: "raw",
		icon: "good-olives",
		color: "#BDBD7D",
		value: 2,
		chance: 3,
<<<<<<< HEAD
		distribution: "land() && biome(3) && shore(1, 2)",
=======
		distribution: "biome(3) && shore(1, 2)",
>>>>>>> 244c3607df6c9b04fdb870383198bfe25fbc42ee
		unit: "barrel",
		demandCoverage: { food: 1 },
		multipliers: { cultureType: { Generic: 0.8, Nomadic: 0.5 } },
		biomeOutput: { 3: 0.1 },
	},
	{
		name: "Honey",
		tags: ["food", "preservative", "raw"],
		type: "raw",
		icon: "good-honey",
		color: "#DCBC66",
		value: 2,
		chance: 3,
<<<<<<< HEAD
		distribution: "land() && biome(6, 8, 9)",
=======
		distribution: "biome(6, 8, 9)",
>>>>>>> 244c3607df6c9b04fdb870383198bfe25fbc42ee
		unit: "barrel",
		demandCoverage: { food: 0.5 },
		multipliers: { cultureType: { Generic: 1.2 } },
		biomeOutput: { 6: 0.05, 8: 0.03, 9: 0.03 },
	},
	{
		name: "Salt",
		tags: ["preservative", "mineral", "raw"],
		type: "raw",
		icon: "good-salt",
		color: "#E5E4E5",
		value: 2,
		chance: 3,
		distribution:
<<<<<<< HEAD
			'land() && (shore(1) && type("salt", "dry") || (biome(1, 2) && random(70)) || (biome(12) && nth(10)))',
=======
			'shore(1) && type("salt", "dry") || (biome(1, 2) && random(70)) || (biome(12) && nth(10))',
>>>>>>> 244c3607df6c9b04fdb870383198bfe25fbc42ee
		unit: "bag",
		demandCoverage: { utilities: 1 },
		multipliers: { cultureType: { Naval: 1.2 } },
		biomeOutput: { 1: 0.1, 2: 0.1 },
	},
	{
		name: "Dates",
		tags: ["food", "raw"],
		type: "raw",
		icon: "good-dates",
		color: "#dbb2a3",
		value: 2,
		chance: 2,
		distribution: "biome(1)",
		unit: "wain",
		demandCoverage: { food: 1 },
		multipliers: { cultureType: { Hunting: 0.8, Highland: 0.8 } },
		biomeOutput: { 1: 0.1 },
	},
	{
		name: "Horses",
		tags: ["supply", "military", "raw"],
		type: "raw",
		icon: "good-horses",
		color: "#ba7447",
		value: 5,
		chance: 4,
		distribution: "biome(3) || (biome(2) && nth(4))",
		unit: "head",
		demandCoverage: { utilities: 0.6, military: 0.4 },
		multipliers: { cultureType: { Nomadic: 2 } },
		biomeOutput: { 4: 0.01 },
	},
	{
		name: "Elephants",
		tags: ["supply", "military", "raw"],
		type: "raw",
		icon: "good-elephants",
		color: "#C5CACD",
		value: 7,
		chance: 2,
		distribution: "biome(1, 3, 5, 7)",
		unit: "head",
		demandCoverage: { utilities: 0.2, military: 0.8 },
		multipliers: { cultureType: { Highland: 0.2 } },
	},
	{
		name: "Camels",
		tags: ["supply", "military", "raw"],
		type: "raw",
		icon: "good-camels",
		color: "#C19A6B",
		value: 5,
		chance: 3,
		distribution: "biome(1, 2)",
		unit: "head",
		demandCoverage: { utilities: 0.7, military: 0.3 },
		multipliers: { cultureType: { Nomadic: 2, Generic: 0.8 } },
		biomeOutput: { 1: 0.05, 2: 0.05 },
	},
	{
		name: "Hemp",
		tags: ["clothing", "naval", "raw"],
		type: "raw",
		icon: "good-hemp",
		color: "#069a06",
		value: 1,
		chance: 3,
		distribution: "biome(6, 7, 8)",
		unit: "wain",
		multipliers: { cultureType: { River: 1.4, Lake: 1.4 } },
		biomeOutput: { 6: 0.1, 7: 0.1, 8: 0.1 },
	},
	{
		name: "Pearls",
		tags: ["luxury", "aquatic", "raw"],
		type: "raw",
		icon: "good-pearls",
		color: "#EAE0C8",
		value: 13,
		chance: 2,
		distribution: "shore(-1) && minTemp(18)",
		unit: "pearl",
		demandCoverage: { luxury: 0.6 },
		multipliers: { cultureType: { Naval: 1.4 } },
	},
	{
		name: "Gemstones",
		tags: ["luxury", "mineral", "raw"],
		type: "raw",
		icon: "good-gemstones",
		color: "#e463e4",
		value: 15,
		chance: 2,
		distribution: "minHeight(60) || (minHeight(30) && elevation())",
		unit: "gem",
		demandCoverage: { luxury: 0.6 },
		multipliers: { cultureType: { Highland: 1.4 } },
	},
	{
		name: "Dyes",
		tags: ["luxury", "raw"],
		type: "raw",
		icon: "good-dyes",
		color: "#fecdea",
		value: 5,
		chance: 1,
		distribution: "shore(-1) || minHabitability(1)",
		unit: "bag",
		multipliers: { cultureType: { Generic: 1.2 } },
	},
	{
		name: "Incense",
		tags: ["luxury", "ritual", "raw"],
		type: "raw",
		icon: "good-incense",
		color: "#ebe5a7",
		value: 10,
		chance: 2,
		distribution: "biome(1, 7)",
		unit: "chest",
		demandCoverage: { luxury: 1 },
	},
	{
		name: "Silk",
		tags: ["luxury", "clothing", "raw"],
		type: "raw",
		icon: "good-silk",
		color: "#e0f0f8",
		value: 9,
		chance: 1,
		distribution: "biome(7)",
		unit: "bolt",
		demandCoverage: { luxury: 1 },
		multipliers: { cultureType: { River: 1.2, Lake: 1.2 } },
	},
	{
		name: "Spices",
		tags: ["luxury", "raw"],
		type: "raw",
		icon: "good-spices",
		color: "#e99c75",
		value: 15,
		chance: 2,
		distribution: "biome(7)",
		unit: "chest",
		demandCoverage: { luxury: 1 },
		multipliers: { cultureType: { Generic: 1.2 } },
	},
	{
		name: "Amber",
		tags: ["luxury", "raw"],
		type: "raw",
		icon: "good-amber",
		color: "#e68200",
		value: 7,
		chance: 2,
		distribution: "shore(1) && biome(6, 7, 8, 9)",
		unit: "stone",
		demandCoverage: { luxury: 0.5 },
		multipliers: { cultureType: { Generic: 1.2 } },
	},
	{
		name: "Furs",
		tags: ["clothing", "luxury", "raw"],
		type: "raw",
		icon: "good-furs",
		color: "#8a5e51",
		value: 4,
		chance: 2,
		distribution:
			"biome(9) || (biome(10) && nth(2)) || (biome(6, 8) && nth(5)) || (biome(12) && nth(10))",
		unit: "pelt",
		demandCoverage: { luxury: 0.5, utilities: 0.3 },
		multipliers: { cultureType: { Hunting: 2 } },
		biomeOutput: { 9: 0.02, 10: 0.02, 6: 0.02, 8: 0.02, 12: 0.02 },
	},
	{
		name: "Sheep",
		tags: ["clothing", "raw"],
		type: "raw",
		icon: "good-sheep",
		color: "#53b574",
		value: 2,
		chance: 3,
		distribution:
			"(biome(3, 4) && !elevation()) || (biome(6) && random(70)) || (biome(5) && nth(5))",
		unit: "head",
		demandCoverage: { food: 1 },
		multipliers: { cultureType: { Naval: 1.4, Highland: 1.4 } },
		biomeOutput: { 4: 0.1 },
	},
	{
		name: "Slaves",
		tags: ["supply", "raw"],
		type: "raw",
		icon: "good-slaves",
		color: "#757575",
		value: 8,
		chance: 2,
		distribution: "shore(1) && minHabitability(1) && !habitability()",
		unit: "slave",
		demandCoverage: { utilities: 1 },
		multipliers: {
			cultureType: { Naval: 1.4, Nomadic: 2, Hunting: 0.6, Highland: 0.4 },
		},
	},
	{
		name: "Tar",
		tags: ["naval", "manufactured"],
		type: "manufactured",
		icon: "good-tar",
		color: "#727272",
		value: 3,
		chance: 0,
		unit: "barrel",
		demandCoverage: { utilities: 0.4, military: 0.1 },
		multipliers: { cultureType: { Hunting: 1.2 } },
		recipes: [{ Wood: 1 }],
	},
	{
		name: "Saltpeter",
		tags: ["military", "mineral", "raw"],
		type: "raw",
		icon: "good-saltpeter",
		color: "#e6e3e3",
		value: 2,
		chance: 3,
		distribution: "biome(1, 2) || (minHeight(50) && random(20))",
		unit: "barrel",
		demandCoverage: {},
	},
	{
		name: "Coal",
		tags: ["fuel", "manufactured"],
		type: "manufactured",
		icon: "good-coal",
		color: "#5a6a75",
		value: 3,
		chance: 3,
		distribution: "minHeight(40) || (minHeight(20) && elevation(25))",
		unit: "wain",
		demandCoverage: { utilities: 0.5 },
		recipes: [{ Wood: 1.5 }],
	},
	{
		name: "Oil",
		tags: ["fuel", "manufactured"],
		type: "manufactured",
		icon: "good-oil",
		color: "#565656",
		value: 3,
		chance: 2,
		distribution: "biome(1, 2, 10) || (shore(-1) && minTemp(18) && random(15))",
		unit: "barrel",
		demandCoverage: { utilities: 1 },
		recipes: [{ Olives: 1 }, { Whales: 1 }],
	},
	{
		name: "Mahogany",
		tags: ["luxury", "raw"],
		type: "raw",
		icon: "good-tropicalTimber",
		color: "#a45a52",
		value: 7,
		chance: 1,
		distribution: "biome(5, 7) && random(50)",
		unit: "pile",
		demandCoverage: { luxury: 1 },
	},
	{
		name: "Whales",
		tags: ["food", "aquatic", "fuel", "raw"],
		type: "raw",
		icon: "good-whales",
		color: "#7fcdff",
		value: 1,
		chance: 3,
<<<<<<< HEAD
		distribution: "ocean() && maxTemp(7)",
=======
		distribution: "shore(-1) && type('ocean') && maxTemp(7)",
>>>>>>> 244c3607df6c9b04fdb870383198bfe25fbc42ee
		unit: "barrel",
		demandCoverage: { food: 1, utilities: 0.2 },
		multipliers: { cultureType: { Naval: 1.4, Nomadic: 0.5 } },
	},
	{
		name: "Sugarcane",
		tags: ["preservative", "food", "raw"],
		type: "raw",
		icon: "good-sugar",
		color: "#7abf87",
		value: 4,
		chance: 3,
		distribution: "biome(7)",
		unit: "bag",
		demandCoverage: { food: 0.6, luxury: 0.4 },
	},
	{
		name: "Tea",
		tags: ["luxury", "raw"],
		type: "raw",
		icon: "good-tea",
		color: "#d0f0c0",
		value: 5,
		chance: 2,
		distribution: "minHeight(40) && (biome(5) || (biome(7) || biome(8)))",
		unit: "bag",
		demandCoverage: { luxury: 1 },
		multipliers: { cultureType: { Highland: 1.2 } },
	},
	{
		name: "Tobacco",
		tags: ["luxury", "raw"],
		type: "raw",
		icon: "good-tobacco",
		color: "#6D5843",
		value: 5,
		chance: 1,
		distribution: "random(20) && (biome(3) || (biome(5) || biome(6)))",
		unit: "bag",
		demandCoverage: { luxury: 1 },
	},
	{
		name: "Clay",
		tags: ["mineral", "construction", "raw"],
		type: "raw",
		icon: "good-clay",
		color: "#b07c60",
		value: 1,
		chance: 5,
		distribution: "minTemp(8) && (shore(1) || river())",
		unit: "wain",
		demandCoverage: { construction: 1 },
		multipliers: { cultureType: { River: 1.4, Lake: 1.4 } },
	},
	{
		name: "White sand",
		tags: ["mineral", "raw"],
		type: "raw",
		icon: "good-sand",
		color: "#e6d69c",
		value: 1,
		chance: 4,
		distribution: "minTemp(8) && (shore(1) || river())",
		unit: "wain",
		multipliers: { cultureType: { River: 1.4, Lake: 1.4 } },
	},
	{
		name: "Leather",
		tags: ["clothing", "military", "manufactured"],
		type: "manufactured",
		icon: "good-leather",
		color: "#8b5a2b",
		value: 4,
		chance: 0,
		recipes: [{ Cattle: 1 }, { Game: 1 }, { Horses: 1 }, { Camels: 1 }],
		unit: "roll",
		multipliers: { cultureType: { Naval: 0.6 } },
	},
	{
		name: "Cloth",
		tags: ["clothing", "manufactured"],
		type: "manufactured",
		icon: "good-cloth",
		color: "#e8e69c",
		value: 4,
		chance: 0,
		recipes: [{ Sheep: 1 }, { Hemp: 1 }, { Silk: 0.5 }],
		unit: "bolt",
		demandCoverage: { utilities: 0.2 },
	},
	{
		name: "Garments",
		tags: ["clothing", "manufactured"],
		type: "manufactured",
		icon: "good-garments",
		color: "#bd21ec",
		value: 9,
		chance: 0,
		recipes: [
			{ Cloth: 1, Dyes: 0.5 },
			{ Cloth: 0.5, Furs: 1 },
		],
		unit: "set",
		demandCoverage: { utilities: 1 },
	},
	{
		name: "Ceramics",
		tags: ["storage", "construction", "manufactured"],
		type: "manufactured",
		icon: "good-ceramics",
		color: "#c1440e",
		value: 6,
		chance: 0,
		recipes: [{ Clay: 1 }],
		unit: "wain",
		demandCoverage: { utilities: 1 },
	},
	{
		name: "Glass",
		tags: ["storage", "construction", "manufactured"],
		type: "manufactured",
		icon: "good-glass",
		color: "#a0c8e8",
		value: 7,
		chance: 0,
		recipes: [{ "White sand": 1 }],
		unit: "wain",
		demandCoverage: { luxury: 1 },
		multipliers: { cultureType: { Nomadic: 0.2 } },
	},
	{
		name: "Ropes",
		tags: ["naval", "construction", "manufactured"],
		type: "manufactured",
		icon: "good-ropes",
		color: "#ba9773",
		value: 4,
		chance: 0,
		recipes: [{ Hemp: 1 }],
		unit: "coil",
		demandCoverage: { utilities: 1 },
	},
	{
		name: "Paper",
		tags: ["ritual", "educational", "manufactured"],
		type: "manufactured",
		icon: "good-paper",
		color: "#f5f5dc",
		value: 5,
		chance: 0,
		recipes: [{ Hemp: 1 }],
		unit: "ream",
		demandCoverage: {},
	},
	{
		name: "Ink",
		tags: ["ritual", "educational", "manufactured"],
		type: "manufactured",
		icon: "good-ink",
		color: "#000000",
		value: 5,
		chance: 0,
		recipes: [{ Oil: 1 }, { Dyes: 0.5 }],
		unit: "bottle",
		demandCoverage: {},
	},
	{
		name: "Books",
		tags: ["ritual", "educational", "manufactured"],
		type: "manufactured",
		icon: "good-books",
		color: "#deb887",
		value: 13,
		chance: 0,
		recipes: [
			{ Paper: 1, Ink: 0.5 },
			{ Leather: 1, Ink: 0.5 },
		],
		unit: "volume",
		demandCoverage: { luxury: 1 },
		multipliers: { cultureType: { Nomadic: 0.2, Hunting: 0.5 } },
	},
	{
		name: "Sails",
		tags: ["naval", "manufactured"],
		type: "manufactured",
		icon: "good-sails",
		color: "#ffffff",
		value: 7,
		chance: 0,
		recipes: [{ Cloth: 1 }],
		unit: "set",
		demandCoverage: { military: 1 },
	},
	{
		name: "Ships",
		tags: ["naval", "manufactured"],
		type: "manufactured",
		icon: "good-ships",
		color: "#654321",
		value: 50,
		chance: 0,
		recipes: [{ Wood: 4, Sails: 4, Ropes: 4, Tar: 2 }],
		unit: "ship",
		demandCoverage: { military: 0.5 },
		multipliers: { cultureType: { Naval: 2 } },
	},
	{
		name: "Boots",
		tags: ["clothing", "military", "manufactured"],
		type: "manufactured",
		icon: "good-boots",
		color: "#654321",
		value: 6,
		chance: 0,
		recipes: [{ Leather: 1 }, { Furs: 0.5 }],
		unit: "pair",
		demandCoverage: { utilities: 1 },
	},
	{
		name: "Harnesses",
		tags: ["military", "manufactured"],
		type: "manufactured",
		icon: "good-harnesses",
		color: "#a0522d",
		value: 8,
		chance: 0,
		recipes: [
			{ Leather: 0.5, Iron: 0.25 },
			{ Leather: 0.5, Bronze: 0.25 },
			{ Leather: 0.5, Copper: 0.25 },
		],
		unit: "set",
		demandCoverage: { military: 1 },
		multipliers: { cultureType: { Nomadic: 1.2 } },
	},
	{
		name: "Barrels",
		tags: ["naval", "storage", "manufactured"],
		type: "manufactured",
		icon: "good-barrels",
		color: "#b46e3b",
		value: 3,
		chance: 0,
		recipes: [{ Wood: 1 }],
		unit: "barrel",
		demandCoverage: { utilities: 1 },
	},
	{
		name: "Bronze",
		tags: ["military", "manufactured"],
		type: "manufactured",
		icon: "good-bronze",
		color: "#e46f21",
		value: 9,
		chance: 0,
		recipes: [
			{ Copper: 0.5, Coal: 1 },
			{ Tin: 0.5, Coal: 1 },
		],
		unit: "wagon",
		multipliers: { cultureType: { Highland: 1.2 } },
	},
	{
		name: "Tools",
		tags: ["construction", "military", "manufactured"],
		type: "manufactured",
		icon: "good-tools",
		color: "#808080",
		value: 17,
		chance: 0,
		recipes: [
			{ Iron: 0.5, Coal: 1 },
			{ Bronze: 0.5, Coal: 1 },
		],
		unit: "set",
		demandCoverage: { utilities: 1 },
	},
	{
		name: "Arms",
		tags: ["military", "manufactured"],
		type: "manufactured",
		icon: "good-arms",
		color: "#333333",
		value: 25,
		chance: 0,
		recipes: [
			{ Iron: 0.5, Coal: 1, Leather: 0.5 },
			{ Bronze: 0.25, Coal: 1, Leather: 0.5 },
		],
		unit: "set",
		demandCoverage: { military: 1 },
	},
	{
		name: "Gunpowder",
		tags: ["military", "manufactured"],
		type: "manufactured",
		icon: "good-gunpowder",
		color: "#b0c4de",
		value: 10,
		chance: 0,
		recipes: [{ Saltpeter: 0.5, Coal: 0.5 }],
		unit: "barrel",
		demandCoverage: { military: 2 },
	},
	{
		name: "Artillery",
		tags: ["military", "manufactured"],
		type: "manufactured",
		icon: "good-artillery",
		color: "#cd7f32",
		value: 21,
		chance: 0,
		recipes: [
			{ Iron: 2, Coal: 1 },
			{ Bronze: 1, Coal: 1 },
		],
		unit: "cannon",
		demandCoverage: { military: 1 },
	},
	{
		name: "Coins",
		tags: ["currency", "manufactured"],
		type: "manufactured",
		icon: "good-coins",
		color: "#ffd700",
		value: 25,
		chance: 0,
		recipes: [
			{ Gold: 0.5, Coal: 1 },
			{ Silver: 1, Coal: 1 },
		],
		unit: "bag",
		demandCoverage: { luxury: 1 },
	},
	{
		name: "Jewelry",
		tags: ["luxury", "manufactured"],
		type: "manufactured",
		icon: "good-jewelry",
		color: "#34861b",
		value: 34,
		chance: 0,
		recipes: [
			{ Gemstones: 1, Gold: 0.5 },
			{ Pearls: 1, Gold: 0.5 },
			{ Amber: 2, Gold: 0.5 },
			{ Gemstones: 1, Silver: 1 },
			{ Pearls: 1, Silver: 1 },
			{ Amber: 2, Silver: 1 },
		],
		unit: "piece",
		demandCoverage: { luxury: 1 },
	},
	{
		name: "Preserved food",
		tags: ["food", "manufactured"],
		type: "manufactured",
		icon: "good-salted-fish",
		color: "#c2b280",
		value: 4,
		chance: 0,
		recipes: [
			{ Fish: 1, Salt: 1 },
			{ Cattle: 1, Salt: 1 },
			{ Game: 1, Salt: 1 },
			{ Sheep: 1, Salt: 1 },
			{ Fish: 1, Vinegar: 0.5 },
			{ Cattle: 1, Vinegar: 0.5 },
			{ Game: 1, Vinegar: 0.5 },
			{ Sheep: 1, Vinegar: 0.5 },
			{ Fish: 1, Wood: 1 },
		],
		unit: "wain",
		demandCoverage: { food: 1 },
	},
	{
		name: "Vinegar",
		tags: ["food", "preservative", "manufactured"],
		type: "manufactured",
		icon: "good-vinegar",
		color: "#9b111e",
		value: 2,
		chance: 0,
		recipes: [{ Wine: 1 }, { Honey: 1 }],
		unit: "barrel",
		demandCoverage: { utilities: 0.5 },
	},
	{
		name: "Cheese",
		tags: ["food", "manufactured"],
		type: "manufactured",
		icon: "good-cheese",
		color: "#f5e1a4",
		value: 4,
		chance: 0,
		recipes: [
			{ Cattle: 0.5, Salt: 0.25 },
			{ Sheep: 0.5, Salt: 0.25 },
			{ Sheep: 0.5, Vinegar: 0.25 },
			{ Cattle: 0.5, Vinegar: 0.25 },
		],
		unit: "wain",
		demandCoverage: { food: 1 },
	},
	{
		name: "Beer",
		tags: ["food", "manufactured"],
		type: "manufactured",
		icon: "good-beer",
		color: "#fbb117",
		value: 7,
		chance: 0,
		recipes: [
			{ Grain: 1, Barrels: 1 },
			{ Honey: 0.5, Barrels: 1 },
		],
		unit: "barrel",
		demandCoverage: { food: 1 },
	},
	{
		name: "Liquor",
		tags: ["food", "luxury", "manufactured"],
		type: "manufactured",
		icon: "good-liquor",
		color: "#8a0303",
		value: 9,
		chance: 0,
		recipes: [
			{ Grain: 2, Wood: 1, Barrels: 0.5 },
			{ Wine: 1, Wood: 1, Barrels: 0.5 },
			{ Grain: 2, Wood: 1, Ceramics: 0.25 },
			{ Wine: 1, Wood: 1, Ceramics: 0.25 },
			{ Grain: 2, Wood: 1, Glass: 0.25 },
			{ Wine: 1, Wood: 1, Glass: 0.25 },
		],
		unit: "vessel",
		demandCoverage: { luxury: 1 },
	},
	{
		name: "Candles",
		tags: ["luxury", "ritual", "manufactured"],
		type: "manufactured",
		icon: "good-candles",
		color: "#fffacd",
		value: 8,
		chance: 0,
		recipes: [{ Honey: 2 }, { Oil: 1 }],
		unit: "block",
		demandCoverage: { utilities: 0.5, luxury: 0.5 },
	},
	{
		name: "Soap",
		tags: ["luxury", "ritual", "manufactured"],
		type: "manufactured",
		icon: "good-soap",
		color: "#e0e4cc",
		value: 5,
		chance: 0,
		recipes: [{ Olives: 1 }, { Cattle: 1 }],
		unit: "barrel",
		demandCoverage: { utilities: 0.4, luxury: 0.6 },
	},
	{
		name: "Perfume",
		tags: ["luxury", "ritual", "manufactured"],
		type: "manufactured",
		icon: "good-perfume",
		color: "#ff69b4",
		value: 17,
		chance: 0,
		recipes: [
			{ Olives: 1, Incense: 0.5, Glass: 0.5 },
			{ Olives: 1, Game: 3, Glass: 0.5 },
			{ Liquor: 0.25, Incense: 0.5, Whales: 0.5, Ceramics: 0.5 },
		],
		unit: "bottle",
		demandCoverage: { luxury: 2 },
	},
<<<<<<< HEAD
	{
		name: "Coral",
		tags: ["construction", "luxury", "raw"],
		type: "raw",
		icon: "good-wood",
		color: "#FF7F50",
		value: 3,
		chance: 4,
		distribution: "ocean() && biome(13, 14)",
		unit: "piece",
		demandCoverage: { construction: 1, luxury: 0.5 },
		biomeOutput: { 13: 0.1, 14: 0.05 },
	},
	{
		name: "Kelp",
		tags: ["food", "raw"],
		type: "raw",
		icon: "good-grain",
		color: "#2E8B57",
		value: 1,
		chance: 5,
		distribution: "ocean() && biome(14)",
		unit: "bundle",
		demandCoverage: { food: 1 },
		biomeOutput: { 14: 0.12 },
	},
	{
		name: "Crustaceans",
		tags: ["food", "raw"],
		type: "raw",
		icon: "good-game",
		color: "#E06666",
		value: 2,
		chance: 4,
		distribution: "ocean() && biome(13, 14, 15)",
		unit: "creel",
		demandCoverage: { food: 1 },
		biomeOutput: { 13: 0.05, 14: 0.05 },
	},
	{
		name: "Sea Silk",
		tags: ["clothing", "luxury", "raw"],
		type: "raw",
		icon: "good-silk",
		color: "#D4AF37",
		value: 10,
		chance: 2,
		distribution: "ocean() && biome(13, 14) && nth(6)",
		unit: "hank",
		demandCoverage: { luxury: 1 },
		biomeOutput: { 13: 0.02, 14: 0.02 },
	},
	{
		name: "Oyster Nectar",
		tags: ["food", "luxury", "raw"],
		type: "raw",
		icon: "good-honey",
		color: "#E6E6FA",
		value: 6,
		chance: 2,
		distribution: "ocean() && biome(13, 14) && nth(8)",
		unit: "flask",
		demandCoverage: { food: 0.5, luxury: 0.5 },
		biomeOutput: { 13: 0.03 },
	},
	{
		name: "Luminescent Algae",
		tags: ["luxury", "utilities", "raw"],
		type: "raw",
		icon: "good-dyes",
		color: "#00FFCC",
		value: 8,
		chance: 3,
		distribution: "ocean() && biome(15, 16, 17) && nth(10)",
		unit: "vial",
		demandCoverage: { utilities: 0.5, luxury: 0.5 },
		biomeOutput: { 16: 0.04, 17: 0.05 },
	},
	{
		name: "Vent Copper",
		tags: ["ore", "raw"],
		type: "raw",
		icon: "good-copper",
		color: "#CD7F32",
		value: 5,
		chance: 2,
		distribution: "ocean() && biome(16, 17) && nth(12)",
		unit: "ingot",
		biomeOutput: { 16: 0.05, 17: 0.08 },
	},
	{
		name: "Abyssal Gold",
		tags: ["ore", "luxury", "raw"],
		type: "raw",
		icon: "good-gold",
		color: "#FFD700",
		value: 18,
		chance: 1,
		distribution: "ocean() && biome(16, 17) && nth(20)",
		unit: "nugget",
		demandCoverage: { luxury: 1 },
		biomeOutput: { 17: 0.03 },
	},
	{
		name: "Sea Bed Salt",
		tags: ["preservative", "mineral", "raw"],
		type: "raw",
		icon: "good-salt",
		color: "#F0F8FF",
		value: 2,
		chance: 3,
		distribution: "ocean() && biome(15, 16)",
		unit: "sack",
		demandCoverage: { utilities: 1 },
		biomeOutput: { 15: 0.05, 16: 0.05 },
	},
=======
>>>>>>> 244c3607df6c9b04fdb870383198bfe25fbc42ee
];

export class GoodsModule {
	private cells!: PackedGraph["cells"];
	private cellId: number = 0;
	private goodById: Good[] = [];

	generate(options: { randomSeed?: string } = {}) {
		TIME && console.time("generateGoods");
		currentRNG = createPRNG(options.randomSeed || "goods-seed");
		const shuffle = shuffler(currentRNG);

		if (!pack.goods?.length) this.restoreDefaults();

		this.cells = pack.cells;
		this.cells.good = new Uint16Array(this.cells.i.length);

		const resourceMaxCells = Math.ceil((200 * this.cells.i.length) / 5000);
		const resources: Record<number, number> = {};

		const methods = `{${Object.keys(this.getMethods()).join(", ")}}`;
		const shuffledCells = shuffle(this.cells.i.slice());
		const goods = [...pack.goods];

		for (const cellId of shuffledCells) {
			if (!(cellId % 10)) shuffle(goods);
			if (this.cells.biome[cellId] === 11 && pack.biomes[11].habitability === 0)
				continue; // skip glaciers
			this.cellId = cellId;

			for (const good of goods) {
				if (!good.distribution || !good.chance) continue;
				if (resources[good.i] >= resourceMaxCells) continue;
				if (Math.random() * 100 > good.chance) continue;

				const spread = new Function(methods, `return ${good.distribution}`);
				if (!spread(this.getMethods())) continue;

				this.cells.good[cellId] = good.i;
				resources[good.i] = (resources[good.i] || 0) + 1;
				break;
			}
		}

		TIME && console.timeEnd("generateGoods");
		this.sync();
	}

	regeneratePlacement(goodId: number) {
		this.sync();
		const good = this.get(goodId);
		if (!good) return;

		TIME && console.time("regenerateGoodPlacement");
		this.cells = pack.cells;
		if (!this.cells.good || this.cells.good.length !== this.cells.i.length) {
			this.cells.good = new Uint16Array(this.cells.i.length);
		}

		for (const cellId of this.cells.i) {
			if (this.cells.good[cellId] === goodId) this.cells.good[cellId] = 0;
		}

		if (!good.distribution || !good.chance) {
			TIME && console.timeEnd("regenerateGoodPlacement");
			return;
		}

		const resourceMaxCells = Math.ceil((200 * this.cells.i.length) / 5000);
		const resources: Record<number, number> = {};
		const methods = `{${Object.keys(this.getMethods()).join(", ")}}`;
		const shuffledCells = shuffler(currentRNG)(this.cells.i.slice());
		const spread = new Function(methods, `return ${good.distribution}`);

		for (const cellId of shuffledCells) {
			if (this.cells.biome[cellId] === 11 && pack.biomes[11].habitability === 0)
				continue; // skip glaciers
			this.cellId = cellId;

			if (this.cells.good[cellId]) continue;
			if (resources[good.i] >= resourceMaxCells) continue;
			if (currentRNG() * 100 > good.chance) continue;

			if (!spread(this.getMethods())) continue;

			this.cells.good[cellId] = good.i;
			resources[good.i] = (resources[good.i] || 0) + 1;
		}

		TIME && console.timeEnd("regenerateGoodPlacement");
	}

	restoreDefaults() {
		pack.goods = structuredClone(this.defaultGoods);
		this.sync();
	}

	getMethods(cellId: number = this.cellId) {
		return {
			random: (number: number) =>
				number >= 100 || (number > 0 && number / 100 > currentRNG()),
			nth: (number: number) => !(cellId % number),
			minHabitability: (min: number) =>
				(biomesData.habitability[pack.cells.biome[cellId]] ?? 0) >= min,
			habitability: () =>
				(biomesData.habitability[this.cells.biome[cellId]] ?? 0) >
				currentRNG() * 100,
			elevation: () => pack.cells.h[cellId] / 100 > currentRNG(),
			biome: (...biomes: number[]) => biomes.includes(pack.cells.biome[cellId]),
			minHeight: (heigh: number) => pack.cells.h[cellId] >= heigh,
			maxHeight: (heigh: number) => pack.cells.h[cellId] <= heigh,
			minTemp: (temp: number) => grid.cells.temp[pack.cells.g[cellId]] >= temp,
			maxTemp: (temp: number) => grid.cells.temp[pack.cells.g[cellId]] <= temp,
			shore: (...rings: number[]) => rings.includes(pack.cells.t[cellId]),
			type: (...types: string[]) => {
				const feature = pack.features[pack.cells.f[cellId]];
				return types.includes(feature.group || feature.type);
			},
			river: () => pack.cells.r[cellId],
<<<<<<< HEAD
			land: () => pack.cells.h[cellId] >= 20,
			ocean: () => pack.cells.h[cellId] < 20,
=======
>>>>>>> 244c3607df6c9b04fdb870383198bfe25fbc42ee
		};
	}

	getBiomesProduction(): Record<
		number,
		{ goodId: number; production: number }[]
	> {
		return pack.goods.reduce(
			(acc, good) => {
				if (!good.biomeOutput) return acc;
				for (const [biomeIdStr, production] of Object.entries(
					good.biomeOutput,
				)) {
					const biomeId = +biomeIdStr;
					if (production) {
						if (!acc[biomeId]) acc[biomeId] = [];
						acc[biomeId].push({ goodId: good.i, production });
					}
				}
				return acc;
			},
			{} as Record<number, { goodId: number; production: number }[]>,
		);
	}

	getStroke(colorHex: string): string {
		return (color(colorHex) as any).darker(2).hex();
	}

	get(i: number): Good | undefined {
		return this.goodById[i];
	}

	sync() {
		this.goodById = [];
		for (const good of pack.goods) this.goodById[good.i] = good;
	}

	private readonly defaultGoods = GOODS_DATA.map((good, index): Good => {
		let recipes: Good["recipes"];
		if ("recipes" in good && good.recipes) {
			recipes = good.recipes.map((recipe) => {
				const entries = Object.entries(recipe).map(([key, value]) => {
					const i = GOODS_DATA.findIndex((g) => g.name === key);
					if (i === -1)
						throw new Error(`Unknown ingredient ${key} in good ${good.name}`);
					return [i + 1, value];
				});
				return Object.fromEntries(entries);
			});
		}

		return { i: index + 1, ...good, ...(recipes && { recipes }) };
	});
}

export const Goods = new GoodsModule();

export const GOODS: Record<number, Good> = {};
for (const good of (Goods as any).defaultGoods) {
	GOODS[good.i] = good;
}

import type { Grid } from "../../core/types";

export function generateGoods(
	grid: Grid,
	heights: Uint8Array,
	biomes: Uint8Array,
): Uint8Array {
	pack.cells.i = Array.from({ length: heights.length }, (_, idx) => idx);
	pack.cells.h = heights;
	pack.cells.biome = biomes;
	pack.cells.good = new Uint16Array(heights.length);
	pack.cells.t = grid.cells.t || new Int8Array(heights.length);
	pack.cells.g = grid.cells.g || new Uint32Array(heights.length);
	pack.cells.f = grid.cells.f || new Uint32Array(heights.length);
	pack.cells.r = grid.cells.r || new Uint16Array(heights.length);
	pack.cells.fl = grid.cells.fl || new Float32Array(heights.length);
	grid.cells.temp =
		grid.cells.temp || new Float32Array(heights.length).fill(15);
	pack.features = grid.features || [];

	Goods.generate({ randomSeed: "map-seed" });

	return pack.cells.good;
<<<<<<< HEAD
}

export function getGoodColorForCell(
	goodId: number,
	cellId: number,
	heights: Uint8Array | null,
): string {
	if (!GOODS[goodId]) return "#555";
	if (heights && heights[cellId] < 20) {
		if (goodId === 1) return "#FF7F50"; // Coral (underwater Wood variant)
		if (goodId === 9) return "#2E8B57"; // Kelp (underwater Grain variant)
		if (goodId === 10) return "#4682B4"; // Whales (underwater Cattle variant)
		if (goodId === 12) return "#E06666"; // Crustaceans (underwater Game variant)
		if (goodId === 13) return "#8FBC8F"; // Fermented Kelp (underwater Wine variant)
		if (goodId === 14) return "#556B2F"; // Sea Grapes (underwater Olives variant)
		if (goodId === 15) return "#E6E6FA"; // Pearl Oyster nectar (underwater Honey variant)
		if (goodId === 16) return "#F0F8FF"; // Sea Bed Salt (underwater Salt variant)
	}
	return GOODS[goodId].color;
}

export function getGoodNameForCell(
	goodId: number,
	cellId: number,
	heights: Uint8Array | null,
): string {
	if (!GOODS[goodId]) return "None";
	if (heights && heights[cellId] < 20) {
		if (goodId === 1) return "Coral";
		if (goodId === 9) return "Kelp/Seaweed";
		if (goodId === 10) return "Whales/Marine Mammals";
		if (goodId === 12) return "Crustaceans";
		if (goodId === 13) return "Fermented Kelp Brew";
		if (goodId === 14) return "Sea Grapes";
		if (goodId === 15) return "Pearl Oyster Nectar";
		if (goodId === 16) return "Sea Bed Salt";
	}
	return GOODS[goodId].name;
}

export function getGoodIconForCell(
	goodId: number,
	cellId: number,
	heights: Uint8Array | null,
): string {
	if (!GOODS[goodId]) return "";
	if (heights && heights[cellId] < 20) {
		if (goodId === 1) return "🪸";
		if (goodId === 9) return "🌿";
		if (goodId === 10) return "🐋";
		if (goodId === 12) return "🦀";
		if (goodId === 13) return "🧪";
		if (goodId === 14) return "🍇";
		if (goodId === 15) return "🦪";
		if (goodId === 16) return "🧂";
	}
	return GOODS[goodId].icon;
=======
>>>>>>> 244c3607df6c9b04fdb870383198bfe25fbc42ee
}
