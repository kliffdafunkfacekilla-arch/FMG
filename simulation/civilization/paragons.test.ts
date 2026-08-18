import { describe, it, expect } from "vitest";
import { generateParagons } from "./paragons-generator";

describe("Paragons Generator", () => {
	it("should generate paragons for states, burgs, and religions", () => {
		const mockStates = [
			{ i: 1, name: "State A" },
			{ i: 2, name: "State B" },
		];
		const mockBurgs = [
			{ i: 1, name: "Burg A", population: 1000 },
			{ i: 2, name: "Burg B", population: 500 },
			{ i: 3, name: "Burg C", population: 0 }, // Should not get a mayor
		];
		const mockReligions = [
			{ i: 1, name: "Religion A" },
		];

		const paragons = generateParagons(mockStates, mockBurgs, mockReligions, "test-seed");

		// 2 states + 2 populated burgs + 1 religion = 5 paragons
		expect(paragons.length).toBe(5);

		const stateParagons = paragons.filter(p => p.affiliationType === "state");
		expect(stateParagons.length).toBe(2);

		const burgParagons = paragons.filter(p => p.affiliationType === "burg");
		expect(burgParagons.length).toBe(2);
		expect(burgParagons.some(p => p.affiliationId === 3)).toBe(false);

		const religionParagons = paragons.filter(p => p.affiliationType === "religion");
		expect(religionParagons.length).toBe(1);
	});

	it("should generate stats within the 1-10 range", () => {
		const mockStates = [{ i: 1, name: "State A" }];
		const paragons = generateParagons(mockStates, [], [], "test-seed");

		expect(paragons.length).toBe(1);
		const stats = paragons[0].stats;

		for (const statValue of Object.values(stats)) {
			expect(statValue).toBeGreaterThanOrEqual(1);
			expect(statValue).toBeLessThanOrEqual(10);
		}
	});

	it("should consistently generate the same output given the same seed", () => {
		const mockStates = [{ i: 1 }];
		const paragons1 = generateParagons(mockStates, [], [], "seed-123");
		const paragons2 = generateParagons(mockStates, [], [], "seed-123");
		
		expect(paragons1).toEqual(paragons2);
	});

	it("should ensure the two neutral traits are unique", () => {
		const mockStates = Array.from({ length: 50 }, (_, i) => ({ i: i + 1 }));
		const paragons = generateParagons(mockStates, [], [], "trait-test");

		for (const paragon of paragons) {
			expect(paragon.neutralTraits[0]).not.toBe(paragon.neutralTraits[1]);
		}
	});
});
