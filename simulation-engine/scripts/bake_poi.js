const { Client } = require("pg");

async function run() {
    const client = new Client("postgres://postgres:krazy@127.0.0.1:5432/postgres");
    await client.connect();

    // 1. Fetch all cells with coords
    console.log("Fetching all cells...");
    const res = await client.query("SELECT id, center_x, center_y FROM sim_cells");
    const cells = res.rows;
    
    // Spatial grid for fast neighbor lookup (copied from bake_all_cell_neighbors logic)
    const BUCKET_SIZE = 10;
    const grid = new Map();
    const getBucket = (x, y) => `${Math.floor(x/BUCKET_SIZE)},${Math.floor(y/BUCKET_SIZE)}`;

    for (const c of cells) {
        const b = getBucket(c.center_x, c.center_y);
        if (!grid.has(b)) grid.set(b, []);
        grid.get(b).push(c);
    }

    const getNearestCell = (x, y, excludeId) => {
        const cx = Math.floor(x/BUCKET_SIZE);
        const cy = Math.floor(y/BUCKET_SIZE);
        let nearest = null;
        let minDist = Infinity;

        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                const b = `${cx+i},${cy+j}`;
                const bucketCells = grid.get(b);
                if (bucketCells) {
                    for (const c of bucketCells) {
                        if (c.id === excludeId) continue;
                        const dx = c.center_x - x;
                        const dy = c.center_y - y;
                        const d = dx*dx + dy*dy;
                        if (d < minDist) {
                            minDist = d;
                            nearest = c;
                        }
                    }
                }
            }
        }
        return nearest;
    };

    // 2. Fetch all burgs
    const burgRes = await client.query("SELECT cell_id FROM sim_burg_economy");
    const civCells = new Set(burgRes.rows.map(r => r.cell_id));

    // Fetch Outlaw Lairs to draw smuggling routes
    const lairRes = await client.query("SELECT cell_id, burg_id FROM sim_fringe_lairs");

    console.log("Assigning POIs to empty cells...");
    let ruinCount = 0, caveCount = 0, landmarkCount = 0;
    
    // Initialize updates Map
    const updates = new Map();
    for (const cell of cells) {
        let features = { routes: [] };
        if (!civCells.has(cell.id)) {
            const rand = Math.random();
            if (rand < 0.25) { features.poi = "Ancient Ruins"; ruinCount++; }
            else if (rand < 0.50) { features.poi = "Cavern System"; caveCount++; }
            else if (rand < 0.70) { features.poi = "Unique Landmark"; landmarkCount++; }
        }
        updates.set(cell.id, features);
    }

    console.log("Routing roads from major burgs to center...");
    // Find the center-most cell (approx width=2000, height=1200)
    let centerCellId = 17200; // default
    let centerCell = getNearestCell(1000, 600, -1);
    if (centerCell) centerCellId = centerCell.id;

    // Route Imperial Highway from 40 random burgs to the center
    const majorBurgs = burgRes.rows.sort(() => 0.5 - Math.random()).slice(0, 40);
    for (const burg of majorBurgs) {
        let cur = getNearestCell(cells.find(c => c.id === burg.cell_id).center_x, cells.find(c => c.id === burg.cell_id).center_y, -1);
        let sanity = 0;
        while (cur && cur.id !== centerCellId && sanity < 500) {
            sanity++;
            const u = updates.get(cur.id);
            if (u && !u.routes.includes("Imperial Highway")) u.routes.push("Imperial Highway");

            // Move step towards center
            const dx = centerCell.center_x - cur.center_x;
            const dy = centerCell.center_y - cur.center_y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            const stepX = cur.center_x + (dx/dist)*5;
            const stepY = cur.center_y + (dy/dist)*5;
            cur = getNearestCell(stepX, stepY, cur.id);
        }
    }

    console.log("Routing Smuggler Paths from Outlaw Lairs to nearest Burgs...");
    for (const lair of lairRes.rows) {
        if (!lair.cell_id || !lair.burg_id) continue;
        const startCell = cells.find(c => c.id === lair.cell_id);
        const endCell = cells.find(c => c.id === lair.burg_id);
        if (!startCell || !endCell) continue;

        let cur = startCell;
        let sanity = 0;
        while (cur && cur.id !== endCell.id && sanity < 500) {
            sanity++;
            const u = updates.get(cur.id);
            if (u && !u.routes.includes("Smuggler Route")) u.routes.push("Smuggler Route");

            const dx = endCell.center_x - cur.center_x;
            const dy = endCell.center_y - cur.center_y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < 5) break; // reached
            const stepX = cur.center_x + (dx/dist)*5;
            const stepY = cur.center_y + (dy/dist)*5;
            cur = getNearestCell(stepX, stepY, cur.id);
        }
    }

    console.log("Writing features to database...");
    const updatesArray = Array.from(updates.entries()).map(([id, features]) => ({id, features}));
    
    for (let i = 0; i < updatesArray.length; i += 5000) {
        const batch = updatesArray.slice(i, i + 5000);
        const query = `
            UPDATE sim_cells AS c SET
                cell_features = v.features::jsonb
            FROM (VALUES
                ${batch.map(u => `(${u.id}, '${JSON.stringify(u.features).replace(/'/g, "''")}')`).join(',\n')}
            ) AS v(id, features)
            WHERE c.id = v.id
        `;
        await client.query(query);
    }

    console.log(`Baking Complete!`);
    console.log(`- ${ruinCount} Ancient Ruins`);
    console.log(`- ${caveCount} Cavern Systems`);
    console.log(`- ${landmarkCount} Unique Landmarks`);
    console.log(`- Roads & Smuggler Routes baked into JSONB.`);

    await client.end();
}

run().catch(console.error);
