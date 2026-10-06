export interface FactionState {
    id: number;
    name: string;
    treasury: number;
    avgUnrest: number;
    avgHealth: number;
    avgCrime: number;
    aggression: number;
    economy: number;
    magic: number;
    perceivedEconomy: number;
    perceivedDefense: number;
    myBurgs: any[];
    myUnits: any[];
    validNeighbors: number[];
    activeWars: number[];
    leaderName: string;
    tick: number;
    loreDate: string;
}
export interface FactionAction {
    id: string;
    name: string;
    evaluate: (state: FactionState) => number;
    execute: (state: FactionState, client: any) => Promise<string | null>;
}
export declare const FACTION_ACTIONS: FactionAction[];
//# sourceMappingURL=factionActions.d.ts.map