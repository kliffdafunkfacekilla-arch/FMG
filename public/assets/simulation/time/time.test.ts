import { describe, expect, it } from "vitest";
import { TickSystem } from "./tick-system";

describe("TickSystem", () => {
	it("should initialize at zero", () => {
		const ts = new TickSystem();
		const state = ts.getState();
		expect(state.tick).toBe(0);
		expect(state.day).toBe(0);
		expect(state.month).toBe(0);
		expect(state.year).toBe(0);
		expect(state.seasonOffset).toBeCloseTo(0);
	});

	it("should advance ticks and wrap into days and months", () => {
		const ts = new TickSystem({
			ticksPerDay: 10,
			daysPerMonth: 10,
			monthsPerYear: 4,
		}); // Year is 400 ticks, 40 days

		// Advance half a day
		ts.advance(5);
		expect(ts.getState().tick).toBe(5);
		expect(ts.getState().day).toBe(0);
		expect(ts.getState().month).toBe(0);
		expect(ts.getState().year).toBe(0);

		// Advance to day 1 (10+ ticks total)
		ts.advance(6);
		expect(ts.getState().tick).toBe(11);
		expect(ts.getState().day).toBe(1);
		expect(ts.getState().month).toBe(0);

		// Advance to a new month (100+ ticks total)
		ts.advance(100);
		expect(ts.getState().tick).toBe(111);
		expect(ts.getState().day).toBe(1);
		expect(ts.getState().month).toBe(1);
		expect(ts.getState().year).toBe(0);
	});

	it("should calculate season offset correctly through a year", () => {
		// 360 days per year, 10 ticks per day => 3600 ticks per year
		const ts = new TickSystem({
			ticksPerDay: 10,
			daysPerMonth: 30,
			monthsPerYear: 12,
		});

		// Day 0: Equinox (seasonOffset ~0)
		expect(ts.getState().seasonOffset).toBeCloseTo(0, 4);

		// Day 90: Summer Solstice (seasonOffset ~1)
		ts.advance(90 * 10);
		expect(ts.getState().seasonOffset).toBeCloseTo(1, 4);

		// Day 180: Equinox (seasonOffset ~0)
		ts.advance(90 * 10);
		expect(ts.getState().seasonOffset).toBeCloseTo(0, 4);

		// Day 270: Winter Solstice (seasonOffset ~-1)
		ts.advance(90 * 10);
		expect(ts.getState().seasonOffset).toBeCloseTo(-1, 4);

		// Day 360: Year wrap around, Equinox again
		ts.advance(90 * 10);
		expect(ts.getState().seasonOffset).toBeCloseTo(0, 4);
		expect(ts.getState().year).toBe(1);
		expect(ts.getState().day).toBe(0);
	});
});
