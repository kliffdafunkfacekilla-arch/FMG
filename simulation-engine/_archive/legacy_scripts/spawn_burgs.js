const { Client } = require('pg');

async function spawnBurgs() {
    const client = new Client('postgres://postgres:krazy@127.0.0.1:5432/postgres');
    await client.connect();

    console.log("Fetching cells...");
    const cellsRes = await client.query("SELECT id, faction_id, geometry FROM sim_cells WHERE elevation >= 20 AND faction_id != 0");
    
    // Map cell_id -> { x, y }
    const cellCoords = new Map();
    // Group cells by faction
    const factionCells = new Map();

    for (const c of cellsRes.rows) {
        try {
            const geo = JSON.parse(c.geometry);
            if (!geo.coordinates || !geo.coordinates[0]) continue;
            const ring = geo.coordinates[0];
            let cx = 0, cy = 0;
            for (const p of ring) { cx += p[0]; cy += p[1]; }
            cx /= ring.length; cy /= ring.length;
            
            cellCoords.set(c.id, { x: cx, y: cy });
            
            if (!factionCells.has(c.faction_id)) factionCells.set(c.faction_id, []);
            factionCells.get(c.faction_id).push(c.id);
        } catch(e) {}
    }

    console.log("Fetching existing burgs...");
    const existing = await client.query("SELECT burg_id, cell_id FROM sim_burg_economy");
    const activeBurgCells = existing.rows.map(r => r.cell_id);
    let nextBurgId = 1000;

    const configs = {
        4:  { add: 8, dist: 15 }, // Heartland
        21: { add: 8, dist: 20 }, // Hive
        1:  { add: 10, dist: 30 }, // Guerrilla
        16: { add: 11, dist: 30 }, // Canopy
        2:  { add: 8, dist: 30 }, // Meridian
        26: { add: 3, dist: 40 }, // Riverfolk
        25: { add: 5, dist: 60 }, // Vaneer
        10: { add: 3, dist: 80 }, // Iron Caladra
        6:  { add: 3, dist: 80 }, // Sylvania
        12: { add: 3, dist: 50 }, // Sumpkin
        22: { add: 2, dist: 50 }, // Dusk Husk
        3:  { add: 4, dist: 40 }, // Ursine
        9:  { add: 4, dist: 40 }, // Eastern Hounds
        17: { add: 4, dist: 50 }, // Scute
        23: { add: 4, dist: 40 }, // Avian
        8:  { add: 0, dist: 100 } // Reliance
    };

    function getDist(c1, c2) {
        const p1 = cellCoords.get(c1);
        const p2 = cellCoords.get(c2);
        if (!p1 || !p2) return 0;
        return Math.sqrt((p1.x - p2.x)**2 + (p1.y - p2.y)**2);
    }

    const newBurgs = [];

    for (const [fid, config] of Object.entries(configs)) {
        const factionId = parseInt(fid);
        const cands = factionCells.get(factionId) || [];
        let added = 0;
        let attempts = 0;
        
        while (added < config.add && attempts < 2000) {
            attempts++;
            const candidateCell = cands[Math.floor(Math.random() * cands.length)];
            
            // Check distance against ALL active burgs
            let tooClose = false;
            for (const bc of activeBurgCells) {
                if (getDist(candidateCell, bc) < config.dist) {
                    tooClose = true;
                    break;
                }
            }
            
            if (!tooClose) {
                activeBurgCells.push(candidateCell);
                newBurgs.push({
                    id: nextBurgId++,
                    cell_id: candidateCell,
                    faction_id: factionId
                });
                added++;
            }
        }
        console.log(`Faction ${factionId}: spawned ${added}/${config.add} new burgs.`);
    }

    // Now insert them with lore baselines
    for (const b of newBurgs) {
      const fid = b.faction_id;
      // Slightly randomize stats to add variance
      const vary = (val) => Math.floor(val * (0.8 + Math.random() * 0.4));
      
      let pop = 2000; let mil = 50; let crime = 0; let food = 500; let wealth = 500;
      let inv = {}; let infra = [];

      switch (fid) {
        case 23: pop = 2000; wealth = 1000; break;
        case 4: pop = 3000; food = 1000; infra.push('FARM'); inv['grain'] = 250; break;
        case 10: pop = 4000; mil = 250; infra.push('WALL', 'MINE'); inv['forged_steel'] = 100; inv['iron'] = 250; break;
        case 3: pop = 2000; mil = 150; infra.push('CAMP'); inv['raw_wood'] = 250; inv['grain'] = 100; break;
        case 16: pop = 1500; inv['exotic'] = 200; wealth = 1000; break; // Merchant princes
        case 26: pop = 2500; mil = 100; wealth = 750; inv['fish'] = 250; break;
        case 25: pop = 3000; mil = 125; inv['red_meat'] = 150; inv['alchemical_potions'] = 50; break; // identical clones
        case 12: pop = 1750; mil = 50; inv['medicine'] = 50; inv['narcotic'] = 50; crime = 15; break;
        case 6: pop = 3000; mil = 75; infra.push('WALL'); inv['raw_wood'] = 200; inv['textiles'] = 100; break;
        case 1: pop = 500; mil = 200; wealth = 50; food = 50; break;
        case 9: pop = 1250; mil = 150; inv['narcotic'] = 100; inv['medicine'] = 100; break;
        case 21: pop = 2250; mil = 200; inv['raw_fiber'] = 150; inv['red_meat'] = 150; break;
        case 22: pop = 500; mil = 25; break;
        case 2: pop = 1750; wealth = 600; inv['spice'] = 100; break;
        case 17: pop = 3000; mil = 200; infra.push('WALL', 'MINE'); inv['stone'] = 250; break;
      }

      // Apply variance EXCEPT for Vaneer (identical burgs lore)
      if (fid !== 25 && fid !== 16) {
          pop = vary(pop);
          mil = vary(mil);
          wealth = vary(wealth);
          food = vary(food);
      }

      await client.query(
        "INSERT INTO sim_burg_economy (burg_id, cell_id, pop_null, wealth, food, unrest, health, crime_rate, military_forces, demographics, species_demographics) VALUES ($1, $2, $3, $4, $5, 0, 100, $6, $7, '{}', '{}')",
        [b.id, b.cell_id, pop, wealth, food, crime, JSON.stringify({ footmen: mil })]
      );
      
      await client.query(
        "INSERT INTO sim_industrial_stockpiles (burg_id, complex_inventory) VALUES ($1, $2)",
        [b.id, JSON.stringify(inv)]
      );
      
      for (const inf of infra) {
        await client.query("INSERT INTO sim_infrastructure (burg_id, type) VALUES ($1, $2) ON CONFLICT DO NOTHING", [b.id, inf]);
      }
    }

    console.log("Done spawning wilderness burgs!");
    await client.end();
}

spawnBurgs().catch(console.error);
