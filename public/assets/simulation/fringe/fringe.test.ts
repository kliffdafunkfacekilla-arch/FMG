import { describe, expect, it } from "vitest";
import type { Burg } from "../civilization/burg-generator";
import type { BurgMarket } from "../civilization/markets-generator";
import { generateFringeGroups } from "./fringe-generator";

describe("Fringe Group Generator", () => {
	it("should generate rebels on severe food shortage", () => {
		const burgs: Burg[] = [
			{
				id: 1,
				cell: 10,
				x: 0,
				y: 0,
				name: "CityA",
				population: 1000,
				isCapital: false,
				port: 0,
				harborRating: 0,
				crossroadRating: 0,
				defensiveRating: 0,
				capitalRating: 0,
			},
		];
		const markets: BurgMarket[] = [
			{ burgId: 1, supply: { 3: 0.5 }, demand: {}, prices: {} }, // 3 is Crop, low supply
		];
		const magicLevels = new Float32Array(100).fill(10); // Low magic

		const groups = generateFringeGroups(burgs, markets, magicLevels);

		expect(groups.length).toBe(1);
		expect(groups[0].type).toBe("Rebels");
		expect(groups[0].size).toBe(50); // 5% of 1000
	});

	it("should generate bandits on moderate food shortage", () => {
		const burgs: Burg[] = [
			{
				id: 1,
				cell: 10,
				x: 0,
				y: 0,
				name: "CityA",
				population: 1000,
				isCapital: false,
				port: 0,
				harborRating: 0,
				crossroadRating: 0,
				defensiveRating: 0,
				capitalRating: 0,
			},
		];
		const markets: BurgMarket[] = [
			{ burgId: 1, supply: { 3: 1.5 }, demand: {}, prices: {} }, // 3 is Crop, moderate supply
		];
		const magicLevels = new Float32Array(100).fill(10);

		const groups = generateFringeGroups(burgs, markets, magicLevels);

		expect(groups.length).toBe(1);
		expect(groups[0].type).toBe("Bandits");
		expect(groups[0].size).toBe(20); // 2% of 1000
	});

	it("should generate cultists on high magic level", () => {
		const burgs: Burg[] = [
			{
				id: 1,
				cell: 10,
				x: 0,
				y: 0,
				name: "CityA",
				population: 1000,
				isCapital: false,
				port: 0,
				harborRating: 0,
				crossroadRating: 0,
				defensiveRating: 0,
				capitalRating: 0,
			},
		];
		const markets: BurgMarket[] = [
			{ burgId: 1, supply: { 3: 10.0 }, demand: {}, prices: {} }, // Plenty of food
		];
		const magicLevels = new Float32Array(100).fill(0);
		magicLevels[10] = 90.0; // High magic at burg cell

		const groups = generateFringeGroups(burgs, markets, magicLevels);

		expect(groups.length).toBe(1);
		expect(groups[0].type).toBe("Cultists");
		expect(groups[0].size).toBe(30); // 3% of 1000
	});

	it("should generate both cultists and rebels if both conditions are met", () => {
		const burgs: Burg[] = [
			{
				id: 1,
				cell: 10,
				x: 0,
				y: 0,
				name: "CityA",
				population: 1000,
				isCapital: false,
				port: 0,
				harborRating: 0,
				crossroadRating: 0,
				defensiveRating: 0,
				capitalRating: 0,
			},
		];
		const markets: BurgMarket[] = [
			{ burgId: 1, supply: { 3: 0.5 }, demand: {}, prices: {} }, // Low food
		];
		const magicLevels = new Float32Array(100).fill(0);
		magicLevels[10] = 90.0; // High magic

		const groups = generateFringeGroups(burgs, markets, magicLevels);

		expect(groups.length).toBe(2);

		const types = groups.map((g) => g.type);
		expect(types).toContain("Rebels");
		expect(types).toContain("Cultists");
	});
});
