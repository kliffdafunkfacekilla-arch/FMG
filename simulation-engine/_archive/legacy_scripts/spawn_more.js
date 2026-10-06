const { Client } = require('pg');

async function specificSpawnsPart2() {
    const client = new Client('postgres://postgres:krazy@127.0.0.1:5432/postgres');
    await client.connect();

    console.log("Fetching cells...");
    const cellsRes = await client.query("SELECT id, faction_id FROM sim_cells WHERE elevation >= 20 AND faction_id != 0");
    
    const factionCells = {};
    for (const c of cellsRes.rows) {
        if (!factionCells[c.faction_id]) factionCells[c.faction_id] = [];
        factionCells[c.faction_id].push(c);
    }

    const newBurgs = [];
    let nextBurgId = 3000;

    const adds = {
        22: 4,  // Dusk Husk
        24: 5,  // Prism
        2:  14, // Meridian Chain (at least a dozen)
        17: 4   // Scute
    };

    for (const [fidStr, count] of Object.entries(adds)) {
        const fid = parseInt(fidStr);
        if (factionCells[fid]) {
            for(let i=0; i<count; i++) {
                newBurgs.push({ 
                    fid: fid, 
                    cell_id: factionCells[fid][Math.floor(Math.random()*factionCells[fid].length)].id 
                });
            }
        } else {
            console.log(`Warning: No land cells found for faction ${fid}`);
        }
    }

    console.log(`Total new burgs to spawn: ${newBurgs.length}`);

    // Insert them with lore baselines
    for (const b of newBurgs) {
      const fid = b.fid;
      const vary = (val) => Math.floor(val * (0.8 + Math.random() * 0.4));
      
      let pop = 2000; let mil = 50; let crime = 0; let food = 500; let wealth = 500;
      let inv = {}; let infra = [];

      switch (fid) {
        case 22: pop = 500; mil = 25; break; // Dusk Husk (small, quiet)
        case 24: pop = 2000; mil = 100; wealth = 1500; inv['crystals'] = 300; break; // Prism (magic, crystals)
        case 2:  pop = 1750; wealth = 600; inv['spice'] = 100; break; // Meridian Chain
        case 17: pop = 3000; mil = 200; infra.push('WALL', 'MINE'); inv['stone'] = 250; break; // Scute
      }

      pop = vary(pop); mil = vary(mil); wealth = vary(wealth); food = vary(food);

      await client.query(
        "INSERT INTO sim_burg_economy (burg_id, cell_id, pop_null, wealth, food, unrest, health, crime_rate, military_forces, demographics, species_demographics) VALUES ($1, $2, $3, $4, $5, 0, 100, $6, $7, '{}', '{}')",
        [nextBurgId, b.cell_id, pop, wealth, food, crime, JSON.stringify({ footmen: mil })]
      );
      
      await client.query("INSERT INTO sim_industrial_stockpiles (burg_id, complex_inventory) VALUES ($1, $2)", [nextBurgId, JSON.stringify(inv)]);
      for (const inf of infra) await client.query("INSERT INTO sim_infrastructure (burg_id, type) VALUES ($1, $2) ON CONFLICT DO NOTHING", [nextBurgId, inf]);
      
      nextBurgId++;
    }

    console.log("Specific spawning part 2 complete!");
    await client.end();
}

specificSpawnsPart2().catch(console.error);
