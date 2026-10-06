interface StreamRequestParams {
    seed: string;
    globalId: number;
    regionalX: number;
    regionalY: number;
    currentTick: number;
}
/**
 * Streams the active 3x3 regional sliding window around player coordinates and evaluates temporal deltas.
 */
export declare function streamPlayerLODWindow(params: StreamRequestParams): Promise<{
    status: string;
    playerWindowCenter: {
        x: number;
        y: number;
    };
    activeStreamingCellsCount: number;
    cells: any[];
}>;
export {};
//# sourceMappingURL=streamingRouter.d.ts.map