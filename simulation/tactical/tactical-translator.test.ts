import { describe, it, expect } from "vitest";
import { extractTacticalState } from "./tactical-translator";
import { AppState } from "../../state/store";

describe("tactical-translator", () => {
  it("extracts tactical state correctly for a valid cell index", () => {
    const mockState = {
      cellsDesired: 10,
      heights: new Uint8Array([10, 50, 90, 0, 0, 0, 0, 0, 0, 0]),
      biomes: new Uint8Array([1, 2, 3, 0, 0, 0, 0, 0, 0, 0]),
      temp: new Float32Array([20, -5, 40, 0, 0, 0, 0, 0, 0, 0]),
      prec: new Uint8Array([50, 100, 10, 0, 0, 0, 0, 0, 0, 0]),
      flux: new Float32Array([5, 0, 20, 0, 0, 0, 0, 0, 0, 0])
    } as unknown as AppState;

    const result0 = extractTacticalState(mockState, 0);
    expect(result0).toEqual({
      elevation: 10,
      biome: 1,
      temperature: 20,
      precipitation: 50,
      waterPresence: true, // elevation < 20
      threatLevel: 0
    });

    const result1 = extractTacticalState(mockState, 1);
    expect(result1).toEqual({
      elevation: 50,
      biome: 2,
      temperature: -5,
      precipitation: 100,
      waterPresence: false,
      threatLevel: 2 // temp < 0 => +1, precip > 80 && temp < 5 => +1
    });

    const result2 = extractTacticalState(mockState, 2);
    expect(result2).toEqual({
      elevation: 90,
      biome: 3,
      temperature: 40,
      precipitation: 10,
      waterPresence: true, // flux > 10
      threatLevel: 4 // temp > 35 => +2, elev > 80 => +2
    });
  });

  it("returns null if arrays are missing from state", () => {
    const mockState = {
      cellsDesired: 10,
      heights: null,
      biomes: null,
      temp: null,
      prec: null,
      flux: null
    } as unknown as AppState;

    expect(extractTacticalState(mockState, 0)).toBeNull();
  });

  it("returns null for out of bounds index", () => {
    const mockState = {
      cellsDesired: 10,
      heights: new Uint8Array(10),
      biomes: new Uint8Array(10),
      temp: new Float32Array(10),
      prec: new Uint8Array(10),
      flux: new Float32Array(10)
    } as unknown as AppState;

    expect(extractTacticalState(mockState, -1)).toBeNull();
    expect(extractTacticalState(mockState, 10)).toBeNull();
    expect(extractTacticalState(mockState, 100)).toBeNull();
  });
});
