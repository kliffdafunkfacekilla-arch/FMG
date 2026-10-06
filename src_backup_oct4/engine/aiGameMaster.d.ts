export interface DMContextPayload {
    worldName: string;
    biome: string;
    chaosLevel: string;
    characterName: string;
    creatureType: string;
    currentAttributes: Record<string, number>;
    playerInput: string;
}
export declare function processPlayerActionWithDM(payload: DMContextPayload): Promise<{
    narrativeResponse: string;
    parsedCommand: {
        actionType: "SKILL_CHECK" | "CAST_POWER" | "NULL_EXEMPTION" | "EQUIP_GEAR" | "DIALOGUE" | "MOVEMENT" | "ATTACK" | "LOOT";
        targetAttribute?: string;
        targetItem?: string;
        targetName?: string;
        direction?: "N" | "S" | "E" | "W" | "NE" | "NW" | "SE" | "SW";
        rawIntent: string;
    };
}>;
//# sourceMappingURL=aiGameMaster.d.ts.map