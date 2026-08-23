import { store } from '../state/store';

export function processWorldFlags(flags: string[]) {
    if (!flags || flags.length === 0) return;

    const state = store.getState();
    const markers = state.markers || [];
    const units = []; // if we want to spawn units, we'll need to figure out where they go (e.g., active region)
    
    let stateUpdated = false;

    // Use player's cell or default to a random/center cell
    const spawnCell = state.playerCell || 1000; // default fallback cell
    const grid = state.grid;

    if (!grid) {
        console.warn("World Feedback Processor: No grid available to spawn entities.");
        return;
    }

    const [spawnX, spawnY] = grid.points[spawnCell] || [0, 0];

    for (const flag of flags) {
        // Look for [SPAWN: TYPE] or [SPAWN: TYPE @ CELL_ID]
        const spawnMatch = flag.match(/\[SPAWN:\s*([A-Z_]+)(?:\s*@\s*(\d+))?\]/);
        
        if (spawnMatch) {
            const entityType = spawnMatch[1].toLowerCase();
            const explicitCell = spawnMatch[2] ? parseInt(spawnMatch[2], 10) : spawnCell;
            const [ex, ey] = grid.points[explicitCell] || [spawnX, spawnY];

            console.log(`World Feedback Processor: Spawning ${entityType} at cell ${explicitCell} (${ex}, ${ey})`);

            if (entityType.includes('dungeon') || entityType.includes('ruin') || entityType.includes('lair')) {
                // Generate a map marker
                const newMarker = {
                    id: Date.now() + Math.floor(Math.random() * 1000),
                    type: entityType,
                    name: `Generated ${entityType}`,
                    cell: explicitCell,
                    x: ex,
                    y: ey
                };
                markers.push(newMarker);
                stateUpdated = true;
            } else if (entityType.includes('fleet') || entityType.includes('army') || entityType.includes('npc')) {
                // Log it as an event or a note for now, since nested units are complex to inject globally without region tracking
                const logs = state.globalLogs || [];
                logs.push({
                    time: `Tick ${state.tick}`,
                    msg: `A new ${entityType} has appeared near cell ${explicitCell}.`,
                    type: "info",
                    location: [ex, ey]
                });
                store.updateState({ globalLogs: logs });
                // We'll also drop a marker so it's visible on the map
                markers.push({
                    id: Date.now() + Math.floor(Math.random() * 1000),
                    type: 'camp',
                    name: `Generated ${entityType}`,
                    cell: explicitCell,
                    x: ex,
                    y: ey
                });
                stateUpdated = true;
            }
        }
    }

    if (stateUpdated) {
        store.updateState({ markers: [...markers] });
        console.log("World Feedback Processor: Map state updated with new entities.");
    }
}
