interface TickParameters {
    seed: string;
    ticksToAdvance: number;
}
/**
 * Executes a planetary simulation tick, advancing time, updating climate vectors, and recalculating seasonal gradients.
 */
export declare function advancePlanetaryTick(params: TickParameters): Promise<{
    status: string;
    currentTick: number;
    dayOfYear: number;
    solarDeclination: number;
}>;
export {};
//# sourceMappingURL=climateEngine.d.ts.map