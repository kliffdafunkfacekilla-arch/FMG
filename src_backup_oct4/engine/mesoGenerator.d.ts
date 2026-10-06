export declare function fetchGlobalContext(client: any, cell_id: number): Promise<{
    cell: any;
    neighbors: any;
    burgs: any;
    nearestBurg: any;
}>;
export declare function generateRegionGrid(context: any): {
    grid_size: number;
    civ_score: number;
    pois: any[];
    context: {
        temperature: any;
        base_temp: any;
        ecology: {
            plants: any;
            prey: any;
            predators: any;
        };
    };
    grid: any[];
};
//# sourceMappingURL=mesoGenerator.d.ts.map