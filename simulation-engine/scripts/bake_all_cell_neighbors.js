const { Client } = require("pg");

async function bake() {
    console.log("Connecting to DB...");
    const c = new Client("postgres://postgres:krazy@127.0.0.1:5432/postgres");
    await c.connect();

    console.log("Adding neighbor_biomes column if it doesn't exist...");
    await c.query("ALTER TABLE sim_cells ADD COLUMN IF NOT EXISTS neighbor_biomes JSONB DEFAULT '[]'::jsonb;");

    console.log("Fetching all cells...");
    const res = await c.query("SELECT id, biome, center_x, center_y FROM sim_cells WHERE center_x IS NOT NULL");
    const cells = res.rows;
    console.log(`Loaded ${cells.length} cells.`);

    // Build spatial grid for fast lookup
    const GRID_SIZE = 10;
    const grid = new Map();
    const getGridKey = (x, y) => `${Math.floor(x / GRID_SIZE)},${Math.floor(y / GRID_SIZE)}`;

    for (const cell of cells) {
        const key = getGridKey(cell.center_x, cell.center_y);
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key).push(cell);
    }

    const getClosestCells = (cx, cy, count) => {
        const gx = Math.floor(cx / GRID_SIZE);
        const gy = Math.floor(cy / GRID_SIZE);
        let candidates = [];
        // Check surrounding 5x5 grid cells
        for (let x = gx - 2; x <= gx + 2; x++) {
            for (let y = gy - 2; y <= gy + 2; y++) {
                const key = `${x},${y}`;
                if (grid.has(key)) {
                    candidates.push(...grid.get(key));
                }
            }
        }
        
        // Compute distance and sort
        return candidates
            .map(c => ({
                id: c.id,
                biome: String(c.biome),
                dist: Math.pow(c.center_x - cx, 2) + Math.pow(c.center_y - cy, 2)
            }))
            .sort((a, b) => a.dist - b.dist);
    };

    console.log("Baking neighbors...");
    let updates = [];
    for (let i = 0; i < cells.length; i++) {
        const cell = cells[i];
        const myBiome = String(cell.biome);
        
        const distances = getClosestCells(cell.center_x, cell.center_y);
        
        const seen = new Set();
        const neighborBiomes = [];
        for (const d of distances) {
            if (d.id !== cell.id && d.biome !== myBiome) {
                if (!seen.has(d.biome)) {
                    seen.add(d.biome);
                    neighborBiomes.push(d.biome);
                }
                if (neighborBiomes.length >= 3) break;
            }
        }
        
        updates.push({ id: cell.id, neighbors: JSON.stringify(neighborBiomes) });
        
        if (i > 0 && i % 10000 === 0) console.log(`Processed ${i} cells...`);
    }

    console.log("Writing to DB in bulk...");
    // Bulk update using unnest
    await c.query(`
        UPDATE sim_cells AS c SET
            neighbor_biomes = v.neighbors::jsonb
        FROM (
            SELECT unnest($1::int[]) AS id, unnest($2::text[]) AS neighbors
        ) AS v
        WHERE c.id = v.id
    `, [
        updates.map(u => u.id),
        updates.map(u => u.neighbors)
    ]);

    console.log("Done baking all cell neighbors!");
    await c.end();
}

bake().catch(e => { console.error(e.stack); process.exit(1); });
