interface WorldEditParams {
    seed: string;
    axialTilt?: number;
    daysPerYear?: number;
}
/**
 * Updates core world metadata parameters (World Editing Console).
 */
export declare function editWorldMetadata(params: WorldEditParams): Promise<void>;
/**
 * Deep Inspection Tool: Extracts all details, active events, lore, and NPC setups for a clicked coordinate (DM Brief).
 */
export declare function getDmCellBrief(seed: string, globalId: number, regX: number, regY: number): Promise<{
    status: string;
    message: string;
    coordinates?: never;
    environment?: never;
    storyHooks?: never;
    loreSnippets?: never;
    dmPromptSuggestion?: never;
} | {
    message?: never;
    status: string;
    coordinates: {
        globalId: number;
        regX: number;
        regY: number;
    };
    environment: {
        elevation: any;
        moisture: any;
        temperature: any;
        biomeId: any;
        chaosIntensity: any;
    };
    storyHooks: any[];
    loreSnippets: any[];
    dmPromptSuggestion: string;
}>;
export {};
//# sourceMappingURL=dmToolkitRouter.d.ts.map