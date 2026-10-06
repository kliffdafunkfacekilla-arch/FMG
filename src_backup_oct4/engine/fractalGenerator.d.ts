interface GenerateSubGridParams {
    seed: string;
    globalCellId: number;
}
/**
 * Generates 10,000 regional sub-cells (100x100 grid) for a specified parent global cell.
 */
export declare function generateSubGridCells(params: GenerateSubGridParams): Promise<void>;
export {};
//# sourceMappingURL=fractalGenerator.d.ts.map