export declare function computeFactionStances(factions: any[], paragons: any[], factionBurgs: Map<number, any[]>): Map<number, {
    stance: string;
    aggression: number;
    economy: number;
    magic: number;
}>;
export declare function processFactionGeopolitics(client: any, tick: number, loreDate: string, factions: any[], factionStances: Map<number, any>, factionBurgs: Map<number, any[]>, diploMap: Map<string, any>): Promise<void>;
export declare function processFringeFactions(client: any, tick: number, loreDate: string, paragons: any[], burgs: any[]): Promise<void>;
//# sourceMappingURL=factionAI_Oct2_Backup.d.ts.map