interface LoreEntry {
    seed: string;
    title: string;
    category: 'MYTH' | 'HISTORY' | 'FACTION_LORE' | 'CHAOS_LORE';
    content: string;
    associatedCellId: number | null;
}
/**
 * Injects foundational world lore into the persistence layer.
 */
export declare function injectWorldLore(entry: LoreEntry): Promise<void>;
export {};
//# sourceMappingURL=loreEngine.d.ts.map