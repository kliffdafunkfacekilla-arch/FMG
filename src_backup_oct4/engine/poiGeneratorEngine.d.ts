interface POIGenerationContext {
    seed: string;
    localId: number;
    biomeId: number;
    chaosIntensity: number;
    hasActiveFamine: boolean;
}
/**
 * Generates a dynamic Point of Interest (POI) when a map tile is entered.
 */
export declare function generateTilePOI(context: POIGenerationContext): Promise<{
    status: string;
    poiType: string;
    hookId: any;
    title: string;
    description: string;
    initialTask: string;
}>;
export {};
//# sourceMappingURL=poiGeneratorEngine.d.ts.map