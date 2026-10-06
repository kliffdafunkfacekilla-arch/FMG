const { Client } = require('pg');

async function applyLore() {
    const client = new Client('postgres://postgres:krazy@127.0.0.1:5432/postgres');
    await client.connect();

    console.log("Applying Lore Baselines to the 19 capitals...");
    
    // 1. Faction Traits & Wealth Overrides
    const factionProfiles = {
      23: { w: 20000, e: 9, a: 2, m: 5 }, // Avian
      4:  { w: 8000,  e: 9, a: 4, m: 2 }, // Heartlands
      10: { w: 8000,  e: 7, a: 4, m: 3 }, // Iron Caldera
      3:  { w: 6000,  e: 6, a: 4, m: 4 }, // Ursine
      16: { w: 10000, e: 8, a: 3, m: 5 }, // Canopy Clans
      26: { w: 15000, e: 10, a: 6, m: 3 }, // Riverfolk
      25: { w: 6000,  e: 6, a: 5, m: 4 }, // Vaneer
      12: { w: 4000,  e: 5, a: 7, m: 3 }, // Sumpkin
      6:  { w: 5000,  e: 5, a: 2, m: 7 }, // Sylvania
      1:  { w: 1500,  e: 2, a: 9, m: 4 }, // Guerrilla Clans
      8:  { w: 2000,  e: 3, a: 2, m: 8 }, // Reliance
      9:  { w: 3000,  e: 4, a: 8, m: 6 }, // Eastern Hounds
      21: { w: 4000,  e: 5, a: 8, m: 4 }, // Hive
      22: { w: 1500,  e: 3, a: 3, m: 6 }, // Dusk Husk
      2:  { w: 12000, e: 8, a: 4, m: 7 }, // Meridian Chain
      17: { w: 6000,  e: 6, a: 7, m: 3 }  // Scute Confederacy
    };

    for (const [fid, p] of Object.entries(factionProfiles)) {
      await client.query(
        "UPDATE sim_factions SET wealth = $1, trait_economy = $2, trait_aggression = $3, trait_magic = $4 WHERE id = $5",
        [p.w, p.e, p.a, p.m, fid]
      );
    }

    // 2. Burg & Economy Shaping
    const burgsRows = (await client.query("SELECT b.burg_id, c.faction_id FROM sim_burg_economy b JOIN sim_cells c ON b.cell_id = c.id")).rows;
    for (const b of burgsRows) {
      const fid = b.faction_id;
      let pop = 2000; let mil = 50; let crime = 0; let food = 500; let wealth = 500;
      let inv = {}; let infra = [];

      switch (fid) {
        case 23: pop = 4000; wealth = 2000; break;
        case 4: pop = 6000; food = 2000; infra.push('FARM'); inv['grain'] = 500; break;
        case 10: pop = 8000; mil = 500; infra.push('WALL', 'MINE'); inv['forged_steel'] = 200; inv['iron'] = 500; break;
        case 3: pop = 4000; mil = 300; infra.push('CAMP'); inv['raw_wood'] = 500; inv['grain'] = 200; break;
        case 16: pop = 1500; inv['exotic'] = 200; wealth = 1000; break;
        case 26: pop = 5000; mil = 200; wealth = 1500; inv['fish'] = 500; break;
        case 25: pop = 3000; mil = 250; inv['red_meat'] = 300; inv['alchemical_potions'] = 100; break;
        case 12: pop = 3500; mil = 100; inv['medicine'] = 100; inv['narcotic'] = 100; crime = 15; break;
        case 6: pop = 6000; mil = 150; infra.push('WALL'); inv['raw_wood'] = 400; inv['textiles'] = 200; break;
        case 1: pop = 1000; mil = 400; wealth = 100; food = 100; break;
        case 8: pop = 15000; wealth = 5000; break; // Reliance is just the capital
        case 9: pop = 2500; mil = 300; inv['narcotic'] = 200; inv['medicine'] = 200; break;
        case 21: pop = 4500; mil = 400; inv['raw_fiber'] = 300; inv['red_meat'] = 300; break;
        case 22: pop = 1000; mil = 50; break;
        case 2: pop = 3500; wealth = 1200; inv['spice'] = 200; break;
        case 17: pop = 6000; mil = 400; infra.push('WALL', 'MINE'); inv['stone'] = 500; break;
      }

      await client.query(
        "UPDATE sim_burg_economy SET pop_null = $1, pop_attuned = 0, wealth = $2, food = $3, crime_rate = $4, military_forces = $5 WHERE burg_id = $6",
        [pop, wealth, food, crime, JSON.stringify({ footmen: mil }), b.burg_id]
      );
      
      await client.query(
        "UPDATE sim_industrial_stockpiles SET complex_inventory = $1 WHERE burg_id = $2",
        [JSON.stringify(inv), b.burg_id]
      );
      
      for (const inf of infra) {
        await client.query("INSERT INTO sim_infrastructure (burg_id, type) VALUES ($1, $2) ON CONFLICT DO NOTHING", [b.burg_id, inf]);
      }
    }

    console.log("Done applying lore baselines!");
    await client.end();
}

applyLore().catch(console.error);
