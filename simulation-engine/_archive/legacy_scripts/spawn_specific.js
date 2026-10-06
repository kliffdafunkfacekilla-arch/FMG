const { Client } = require('pg');

async function specificSpawns() {
    const client = new Client('postgres://postgres:krazy@127.0.0.1:5432/postgres');
    await client.connect();

    console.log("Fetching cells...");
    const cellsRes = await client.query("SELECT id, faction_id, elevation, geometry FROM sim_cells WHERE elevation >= 20 AND faction_id != 0");
    
    // Parse geometries to find centers
    const cells = cellsRes.rows.map(c => {
        let cx = 0, cy = 0;
        try {
            const geo = JSON.parse(c.geometry);
            const ring = geo.coordinates[0];
            for (const p of ring) { cx += p[0]; cy += p[1]; }
            cx /= ring.length; cy /= ring.length;
        } catch(e) {}
        return { id: c.id, fid: c.faction_id, elev: c.elevation, x: cx, y: cy };
    });

    const factionCells = {};
    for (const c of cells) {
        if (!factionCells[c.fid]) factionCells[c.fid] = [];
        factionCells[c.fid].push(c);
    }

    const newBurgs = [];
    let nextBurgId = 2000;

    // Helper: Distance
    const dist = (c1, c2) => Math.sqrt((c1.x - c2.x)**2 + (c1.y - c2.y)**2);

    // Helper: Island Clustering (DBSCAN-lite)
    function getIslands(fCells, threshold = 40) {
        let clusters = [];
        let visited = new Set();
        for (const c of fCells) {
            if (visited.has(c.id)) continue;
            let cluster = [c];
            visited.add(c.id);
            let queue = [c];
            while (queue.length > 0) {
                const curr = queue.shift();
                for (const other of fCells) {
                    if (!visited.has(other.id) && dist(curr, other) < threshold) {
                        visited.add(other.id);
                        cluster.push(other);
                        queue.push(other);
                    }
                }
            }
            clusters.push(cluster);
        }
        return clusters;
    }

    // --- FACTION 14: THEOCRACY (Burg on each island) ---
    if (factionCells[14]) {
        const islands = getIslands(factionCells[14], 50);
        console.log(`Theocracy (14): Found ${islands.length} islands.`);
        for (const isl of islands) {
            newBurgs.push({ fid: 14, cell_id: isl[Math.floor(isl.length/2)].id });
        }
    }

    // --- FACTION 12: SUMPKIN (+8) ---
    if (factionCells[12]) {
        for(let i=0; i<8; i++) newBurgs.push({ fid: 12, cell_id: factionCells[12][Math.floor(Math.random()*factionCells[12].length)].id });
    }

    // --- FACTION 10: IRON CALADRA (Move cap, +3) ---
    if (factionCells[10]) {
        // Move capital to mountains
        let bestCell = factionCells[10][0];
        let bestScore = -1;
        for (const c of factionCells[10]) {
            let mountainNeighbors = 0;
            for (const other of cells) {
                if (other.elev >= 70 && dist(c, other) < 25) mountainNeighbors++;
            }
            if (mountainNeighbors > bestScore) {
                bestScore = mountainNeighbors;
                bestCell = c;
            }
        }
        console.log(`Iron Caladra: Moving capital to cell ${bestCell.id} (Score: ${bestScore} mountains nearby)`);
        // Find their capital burg_id
        const icBurgs = await client.query("SELECT b.burg_id FROM sim_burg_economy b JOIN sim_cells c ON b.cell_id = c.id WHERE c.faction_id = 10 ORDER BY b.pop_null DESC LIMIT 1");
        if (icBurgs.rows.length > 0) {
            await client.query("UPDATE sim_burg_economy SET cell_id = $1 WHERE burg_id = $2", [bestCell.id, icBurgs.rows[0].burg_id]);
        }
        for(let i=0; i<3; i++) newBurgs.push({ fid: 10, cell_id: factionCells[10][Math.floor(Math.random()*factionCells[10].length)].id });
    }

    // --- FACTION 25: VANEER (2 N, 1 SE, 4 Center) ---
    if (factionCells[25]) {
        let sortedY = [...factionCells[25]].sort((a,b) => a.y - b.y); // N border
        newBurgs.push({ fid: 25, cell_id: sortedY[0].id });
        newBurgs.push({ fid: 25, cell_id: sortedY[5].id }); // slightly spread
        let sortedSE = [...factionCells[25]].sort((a,b) => (b.x + b.y) - (a.x + a.y)); // SE
        newBurgs.push({ fid: 25, cell_id: sortedSE[0].id });
        
        let cx=0, cy=0; factionCells[25].forEach(c => {cx+=c.x; cy+=c.y}); cx/=factionCells[25].length; cy/=factionCells[25].length;
        let sortedCenter = [...factionCells[25]].sort((a,b) => dist(a, {x:cx,y:cy}) - dist(b, {x:cx,y:cy}));
        for(let i=0; i<4; i++) newBurgs.push({ fid: 25, cell_id: sortedCenter[i*4].id }); // Space them out a bit near center
    }

    // --- FACTION 3: URSINE (4 NW, 4 Center) ---
    if (factionCells[3]) {
        let sortedNW = [...factionCells[3]].sort((a,b) => (a.x + a.y) - (b.x + b.y));
        for(let i=0; i<4; i++) newBurgs.push({ fid: 3, cell_id: sortedNW[i*5].id });
        let cx=0, cy=0; factionCells[3].forEach(c => {cx+=c.x; cy+=c.y}); cx/=factionCells[3].length; cy/=factionCells[3].length;
        let sortedCenter = [...factionCells[3]].sort((a,b) => dist(a, {x:cx,y:cy}) - dist(b, {x:cx,y:cy}));
        for(let i=0; i<4; i++) newBurgs.push({ fid: 3, cell_id: sortedCenter[i*4].id });
    }

    // --- FACTION 4: HEARTLANDS (+12) ---
    if (factionCells[4]) {
        for(let i=0; i<12; i++) newBurgs.push({ fid: 4, cell_id: factionCells[4][Math.floor(Math.random()*factionCells[4].length)].id });
    }

    // --- FACTION 26: RIVERFOLK (1 per island, +3) ---
    if (factionCells[26]) {
        const islands = getIslands(factionCells[26], 50);
        console.log(`Riverfolk (26): Found ${islands.length} islands.`);
        for (const isl of islands) newBurgs.push({ fid: 26, cell_id: isl[Math.floor(isl.length/2)].id });
        for(let i=0; i<3; i++) newBurgs.push({ fid: 26, cell_id: factionCells[26][Math.floor(Math.random()*factionCells[26].length)].id });
    }

    // --- FACTION 23: AVIANS (+4) ---
    if (factionCells[23]) {
        for(let i=0; i<4; i++) newBurgs.push({ fid: 23, cell_id: factionCells[23][Math.floor(Math.random()*factionCells[23].length)].id });
    }

    // --- FACTION 27: FLOWER FOLK (+5) ---
    if (factionCells[27]) {
        for(let i=0; i<5; i++) newBurgs.push({ fid: 27, cell_id: factionCells[27][Math.floor(Math.random()*factionCells[27].length)].id });
    }

    console.log(`Total new burgs to spawn: ${newBurgs.length}`);

    // Insert them with lore baselines
    for (const b of newBurgs) {
      const fid = b.fid;
      const vary = (val) => Math.floor(val * (0.8 + Math.random() * 0.4));
      
      let pop = 2000; let mil = 50; let crime = 0; let food = 500; let wealth = 500;
      let inv = {}; let infra = [];

      switch (fid) {
        case 23: pop = 2000; wealth = 1000; break;
        case 4: pop = 3000; food = 1000; infra.push('FARM'); inv['grain'] = 250; break;
        case 10: pop = 4000; mil = 250; infra.push('WALL', 'MINE'); inv['forged_steel'] = 100; inv['iron'] = 250; break;
        case 3: pop = 2000; mil = 150; infra.push('CAMP'); inv['raw_wood'] = 250; inv['grain'] = 100; break;
        case 14: pop = 2500; mil = 200; wealth = 800; break; // Theocracy
        case 16: pop = 1500; inv['exotic'] = 200; wealth = 1000; break; 
        case 26: pop = 2500; mil = 100; wealth = 750; inv['fish'] = 250; break;
        case 25: pop = 3000; mil = 125; inv['red_meat'] = 150; inv['alchemical_potions'] = 50; break; 
        case 12: pop = 1750; mil = 50; inv['medicine'] = 50; inv['narcotic'] = 50; crime = 15; break;
        case 27: pop = 2000; mil = 100; inv['raw_herbs'] = 200; wealth = 800; break; // Flower Folk
        case 6: pop = 3000; mil = 75; infra.push('WALL'); inv['raw_wood'] = 200; inv['textiles'] = 100; break;
        case 1: pop = 500; mil = 200; wealth = 50; food = 50; break;
        case 9: pop = 1250; mil = 150; inv['narcotic'] = 100; inv['medicine'] = 100; break;
        case 21: pop = 2250; mil = 200; inv['raw_fiber'] = 150; inv['red_meat'] = 150; break;
        case 22: pop = 500; mil = 25; break;
        case 2: pop = 1750; wealth = 600; inv['spice'] = 100; break;
        case 17: pop = 3000; mil = 200; infra.push('WALL', 'MINE'); inv['stone'] = 250; break;
      }

      if (fid !== 25 && fid !== 16) {
          pop = vary(pop); mil = vary(mil); wealth = vary(wealth); food = vary(food);
      }

      await client.query(
        "INSERT INTO sim_burg_economy (burg_id, cell_id, pop_null, wealth, food, unrest, health, crime_rate, military_forces, demographics, species_demographics) VALUES ($1, $2, $3, $4, $5, 0, 100, $6, $7, '{}', '{}')",
        [nextBurgId, b.cell_id, pop, wealth, food, crime, JSON.stringify({ footmen: mil })]
      );
      
      await client.query("INSERT INTO sim_industrial_stockpiles (burg_id, complex_inventory) VALUES ($1, $2)", [nextBurgId, JSON.stringify(inv)]);
      for (const inf of infra) await client.query("INSERT INTO sim_infrastructure (burg_id, type) VALUES ($1, $2) ON CONFLICT DO NOTHING", [nextBurgId, inf]);
      
      nextBurgId++;
    }

    console.log("Specific spawning complete!");
    await client.end();
}

specificSpawns().catch(console.error);
